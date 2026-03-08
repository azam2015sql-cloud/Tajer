// ==========================================
// Customers Screen - Fixed Payment Logic
// ==========================================

async function loadCustomers(searchQuery = '') {
    let customers = await getCustomers();
    const orders = await db.orders.toArray();
    const orderItems = await db.orderItems.toArray();

    let productSearchActive = false;
    let matchedCustomerIds = new Set();

    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const nameMatches = customers.filter(c =>
            c.name.toLowerCase().includes(q) ||
            (c.phone && c.phone.includes(q))
        );

        // Deep search: product names in order items
        const productMatches = orderItems.filter(oi =>
            oi.productName && oi.productName.toLowerCase().includes(q)
        );

        // Deep search: payment status keywords
        const isPaidSearch = q.includes('مدفوع') && !q.includes('غير');
        const isUnpaidSearch = q.includes('غير') || q.includes('غير مدفوع');
        const isSettledSearch = q.includes('خالص');
        const isOwedSearch = q.includes('مطالب');
        const paymentTypeSearch = q.includes('نقدي') ? 'cash' : q.includes('تقسيط') ? 'installment' : q.includes('مقدم') ? 'advance' : null;

        let statusMatchIds = new Set();

        if (isUnpaidSearch) {
            // Find customers with unpaid items
            const unpaidItems = orderItems.filter(oi => oi.isPaid !== 'yes');
            const unpaidOrderIds = [...new Set(unpaidItems.map(oi => oi.orderId))];
            orders.filter(o => unpaidOrderIds.includes(o.id)).forEach(o => statusMatchIds.add(o.customerId));
        } else if (isPaidSearch) {
            // Find customers with paid items
            const paidItems = orderItems.filter(oi => oi.isPaid === 'yes');
            const paidOrderIds = [...new Set(paidItems.map(oi => oi.orderId))];
            orders.filter(o => paidOrderIds.includes(o.id)).forEach(o => statusMatchIds.add(o.customerId));
        }

        if (isSettledSearch) {
            customers.forEach(c => {
                const cOrderIds = orders.filter(o => o.customerId === c.id).map(o => o.id);
                const cItems = orderItems.filter(i => cOrderIds.includes(i.orderId));
                const total = cItems.reduce((s, i) => s + (i.total || 0), 0);
                const paid = cItems.filter(i => i.isPaid === 'yes').reduce((s, i) => s + (i.total || 0), 0);
                if (total > 0 && (total - paid) <= 0) statusMatchIds.add(c.id);
            });
        }

        if (isOwedSearch) {
            customers.forEach(c => {
                const cOrderIds = orders.filter(o => o.customerId === c.id).map(o => o.id);
                const cItems = orderItems.filter(i => cOrderIds.includes(i.orderId));
                const total = cItems.reduce((s, i) => s + (i.total || 0), 0);
                const paid = cItems.filter(i => i.isPaid === 'yes').reduce((s, i) => s + (i.total || 0), 0);
                if ((total - paid) > 0) statusMatchIds.add(c.id);
            });
        }

        if (paymentTypeSearch) {
            orders.filter(o => o.paymentType === paymentTypeSearch).forEach(o => statusMatchIds.add(o.customerId));
        }

        if (productMatches.length > 0 || statusMatchIds.size > 0) {
            const matchedOrderIds = [...new Set(productMatches.map(oi => oi.orderId))];
            const matchedOrders = orders.filter(o => matchedOrderIds.includes(o.id));
            matchedOrders.forEach(o => matchedCustomerIds.add(o.customerId));

            const allMatchIds = new Set([...nameMatches.map(c => c.id), ...matchedCustomerIds, ...statusMatchIds]);
            customers = customers.filter(c => allMatchIds.has(c.id));
            productSearchActive = matchedCustomerIds.size > 0 || statusMatchIds.size > 0;
        } else {
            customers = nameMatches;
        }
    }

    const container = document.getElementById('customersList');
    if (customers.length === 0) {
        container.innerHTML = searchQuery
            ? '<p class="empty-state">لا توجد نتائج للبحث</p>'
            : '<p class="empty-state">لا يوجد عملاء. اضغط + لإضافة عميل جديد</p>';
        return;
    }

    let html = '';
    if (productSearchActive && searchQuery) {
        html += `<div class="search-hint" style="background:var(--accent-info-bg);border:1px solid var(--accent-info);padding:8px 12px;border-radius:var(--radius-md);margin-bottom:10px;font-size:0.78rem;text-align:center">🔍 نتائج البحث عن "${searchQuery}"</div>`;
    }

    html += customers.map(c => {
        const cOrders = orders.filter(o => o.customerId === c.id);
        const cOrderIds = cOrders.map(o => o.id);
        const cItems = orderItems.filter(i => cOrderIds.includes(i.orderId));

        // Calculate from order items isPaid status
        const totalAmount = cItems.reduce((s, i) => s + (i.total || 0), 0);
        const totalPaid = cItems.filter(i => i.isPaid === 'yes').reduce((s, i) => s + (i.total || 0), 0);
        const remaining = totalAmount - totalPaid;

        // Badge & color theme
        const isSettled = remaining <= 0 && totalAmount > 0;
        const isNew = totalAmount === 0;
        const badgeText = isNew ? 'جديد' : isSettled ? '✅ خالص' : '⏳ مطالب';
        const borderColor = isNew ? 'var(--accent-info)' : isSettled ? 'var(--accent-success)' : 'var(--accent-danger)';
        const bgTint = isNew ? 'rgba(99,179,237,0.05)' : isSettled ? 'rgba(72,199,142,0.05)' : 'rgba(245,101,101,0.07)';

        // Products list
        const productNames = [...new Set(cItems.map(i => i.productName).filter(Boolean))];
        const productsHtml = productNames.length > 0
            ? `<div style="padding:4px 14px 8px;font-size:0.72rem;color:#94a3b8">📦 ${productNames.slice(0, 3).join(' • ')}${productNames.length > 3 ? ` +${productNames.length - 3}` : ''}</div>`
            : '';

        return `
        <div class="card" onclick="navigateTo('CustomerDetail', ${c.id})" style="border-right:4px solid ${borderColor};background:${bgTint};margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 14px 4px">
                <div>
                    <span style="font-weight:800;font-size:1rem;color:var(--text-primary)">${c.name}</span>
                    ${c.phone ? `<span style="font-size:0.72rem;color:#64748b;margin-right:6px">📞 ${c.phone}</span>` : ''}
                </div>
                <span style="font-size:0.7rem;font-weight:700;padding:3px 10px;border-radius:20px;background:${borderColor};color:white">${badgeText}</span>
            </div>
            ${productsHtml}
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1px;background:rgba(255,255,255,0.03);padding:0 10px 10px">
                <div style="text-align:center;padding:8px 4px;background:var(--bg-card);border-radius:var(--radius-sm)">
                    <div style="font-size:0.65rem;color:#64748b;margin-bottom:2px">الإجمالي</div>
                    <div style="font-weight:800;font-size:0.85rem;color:var(--text-primary)">${formatCurrency(totalAmount)}</div>
                </div>
                <div style="text-align:center;padding:8px 4px;background:var(--bg-card);border-radius:var(--radius-sm)">
                    <div style="font-size:0.65rem;color:#64748b;margin-bottom:2px">المدفوع</div>
                    <div style="font-weight:800;font-size:0.85rem;color:var(--accent-success)">${formatCurrency(totalPaid)}</div>
                </div>
                <div style="text-align:center;padding:8px 4px;background:var(--bg-card);border-radius:var(--radius-sm)">
                    <div style="font-size:0.65rem;color:#64748b;margin-bottom:2px">المتبقي</div>
                    <div style="font-weight:800;font-size:0.85rem;color:${remaining > 0 ? 'var(--accent-danger)' : 'var(--accent-success)'}">${formatCurrency(remaining)}</div>
                </div>
            </div>
        </div>`;
    }).join('');

    container.innerHTML = html;
}

function showAddCustomerModal() {
    showCustomerModal(null);
}

async function showCustomerModal(customer) {
    const isEdit = !!customer;
    const title = isEdit ? 'تعديل العميل' : 'إضافة عميل جديد';
    const body = `
        <div class="form-group">
            <label>اسم العميل *</label>
            <input type="text" id="custName" class="input-field" placeholder="اسم العميل" value="${customer?.name || ''}">
        </div>
        <div class="form-group">
            <label>رقم الهاتف</label>
            <input type="tel" id="custPhone" class="input-field" placeholder="05xxxxxxxx" value="${customer?.phone || ''}" style="direction:ltr; text-align:right">
        </div>
        <div class="form-group">
            <label>حد الائتمان (اختياري)</label>
            <input type="number" id="custCreditLimit" class="input-field" placeholder="0 = بدون حد" value="${customer?.creditLimit || ''}">
        </div>
        <div class="form-group">
            <label>ملاحظات</label>
            <input type="text" id="custNotes" class="input-field" placeholder="ملاحظات..." value="${customer?.notes || ''}">
        </div>
    `;
    const footer = `
        ${isEdit ? `<button class="btn btn-danger" onclick="confirmDeleteCustomer(${customer.id})">حذف</button>` : ''}
        <div style="flex:1"></div>
        <button class="btn btn-ghost" onclick="closeModal()">إلغاء</button>
        <button class="btn btn-primary" onclick="saveCustomer(${customer?.id || 'null'})">💾 حفظ</button>
    `;
    openModal(title, body, footer);
}

async function saveCustomer(id) {
    const name = document.getElementById('custName').value.trim();
    const phone = document.getElementById('custPhone').value.trim();
    const creditLimit = parseFloat(document.getElementById('custCreditLimit').value) || 0;
    const notes = document.getElementById('custNotes').value.trim();
    if (!name) { showToast('يرجى إدخال اسم العميل', 'error'); return; }
    const data = { name, phone, creditLimit, notes };
    if (id) {
        await updateCustomer(id, data);
        showToast('تم تحديث بيانات العميل ✅');
    } else {
        await addCustomer(data);
        showToast('تم إضافة العميل ✅');
    }
    closeModal();
    loadCustomers();
}

async function confirmDeleteCustomer(id) {
    const confirmed = await showConfirm('هل تريد حذف هذا العميل وجميع بياناته؟');
    if (confirmed) {
        await deleteCustomer(id);
        showToast('تم حذف العميل');
        closeModal();
        navigateTo('Customers');
    }
}
