// ==========================================
// Customer Detail Screen - Fixed
// ==========================================

let _currentCustomerId = null;
let _currentCustomerTab = 'orders';
let _orderItems = [];

async function loadCustomerDetail(customerId) {
    _currentCustomerId = customerId;
    const customer = await getCustomer(customerId);
    if (!customer) return;

    const orders = await getCustomerOrders(customerId);
    const allOrderItems = [];
    for (const order of orders) {
        const items = await getOrderItems(order.id);
        allOrderItems.push(...items);
    }
    const installments = await getCustomerInstallments(customerId);

    // Calculate from order items isPaid status
    const totalAmount = allOrderItems.reduce((s, i) => s + (i.total || 0), 0);
    const paidAmount = allOrderItems.filter(i => i.isPaid === 'yes').reduce((s, i) => s + (i.total || 0), 0);
    const remaining = totalAmount - paidAmount;
    const overdueCount = installments.filter(i => i.isPaid === 'no' && isOverdue(i.dueDate)).length;
    const isSettled = remaining <= 0 && totalAmount > 0;

    document.getElementById('customerInfo').innerHTML = `
        <div class="detail-name">${customer.name}</div>
        ${customer.phone ? `<div class="detail-phone">${customer.phone}</div>` : ''}
        ${customer.notes ? `<div class="text-muted" style="font-size:0.8rem;margin-bottom:8px">${customer.notes}</div>` : ''}
        <div class="detail-stats">
            <div class="detail-stat">
                <div class="detail-stat-value">${formatCurrency(totalAmount)}</div>
                <div class="detail-stat-label">إجمالي المشتريات</div>
            </div>
            <div class="detail-stat">
                <div class="detail-stat-value text-success">${formatCurrency(paidAmount)}</div>
                <div class="detail-stat-label">المدفوع</div>
            </div>
            <div class="detail-stat">
                <div class="detail-stat-value ${remaining > 0 ? 'text-danger' : 'text-success'}">${formatCurrency(remaining)}</div>
                <div class="detail-stat-label">المتبقي</div>
            </div>
        </div>
        <div style="margin-top:8px">
            <span class="badge ${totalAmount === 0 ? 'badge-info' : isSettled ? 'badge-success' : 'badge-danger'}">${totalAmount === 0 ? 'جديد' : isSettled ? '✅ خالص' : '⚠️ مطالب'}</span>
            ${overdueCount > 0 ? `<span class="badge badge-danger" style="margin-right:6px">⏰ ${overdueCount} أقساط متأخرة</span>` : ''}
        </div>
        <div style="margin-top:12px; display:flex; gap:8px; justify-content:center">
            <button class="btn btn-sm btn-outline" onclick="showCustomerModal(${JSON.stringify(customer).replace(/"/g, '&quot;')})">✏️ تعديل</button>
            <button class="btn btn-sm btn-primary" onclick="showNewOrderModal()">🛒 طلب جديد</button>
            <button class="btn btn-sm btn-success" onclick="showAddPaymentModal()">💵 دفعة</button>
        </div>
    `;

    switchCustomerTab(_currentCustomerTab);
}

async function switchCustomerTab(tab) {
    _currentCustomerTab = tab;
    document.querySelectorAll('#pageCustomerDetail .tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tab);
    });

    const container = document.getElementById('customerTabContent');

    if (tab === 'orders') {
        const orders = await getCustomerOrders(_currentCustomerId);
        if (orders.length === 0) {
            container.innerHTML = '<p class="empty-state">لا توجد طلبات بعد</p>';
            return;
        }
        let html = '<div class="cards-list">';
        for (const order of orders) {
            const items = await getOrderItems(order.id);
            const paidItems = items.filter(i => i.isPaid === 'yes');
            const paidTotal = paidItems.reduce((s, i) => s + (i.total || 0), 0);
            const orderTotal = items.reduce((s, i) => s + (i.total || 0), 0);

            // Product names
            const productNames = items.map(i => i.productName).join('، ');

            html += `
            <div class="card" onclick="showOrderDetail(${order.id})">
                <div class="card-header">
                    <span class="card-title">طلب #${order.id}</span>
                    <span class="badge ${order.paymentType === 'cash' ? 'badge-success' : order.paymentType === 'installment' ? 'badge-info' : 'badge-warning'}">${order.paymentType === 'cash' ? 'نقدي' : order.paymentType === 'installment' ? 'تقسيط' : 'مقدم'}</span>
                </div>
                <div class="order-history-items">${productNames || 'لا أصناف'}</div>
                <div class="card-body">
                    <div class="card-stat">
                        <span class="card-stat-label">التاريخ</span>
                        <span class="card-stat-value">${formatDate(order.date)}</span>
                    </div>
                    <div class="card-stat">
                        <span class="card-stat-label">المبلغ</span>
                        <span class="card-stat-value">${formatCurrency(orderTotal)}</span>
                    </div>
                    <div class="card-stat">
                        <span class="card-stat-label">مدفوع</span>
                        <span class="card-stat-value ${paidItems.length === items.length ? 'text-success' : 'text-warning'}">${paidItems.length}/${items.length}</span>
                    </div>
                </div>
            </div>`;
        }
        html += '</div>';
        container.innerHTML = html;

    } else if (tab === 'installments') {
        const installments = await getCustomerInstallments(_currentCustomerId);
        if (installments.length === 0) {
            container.innerHTML = '<p class="empty-state">لا توجد أقساط</p>';
            return;
        }
        container.innerHTML = installments
            .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
            .map(inst => {
                const overdue = inst.isPaid === 'no' && isOverdue(inst.dueDate);
                return `
                <div class="installment-row ${inst.isPaid === 'yes' ? 'paid' : ''} ${overdue ? 'overdue' : ''}">
                    <div>
                        <strong>${formatCurrency(inst.amount)}</strong>
                        <div class="text-muted" style="font-size:0.75rem">${formatDate(inst.dueDate)}</div>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px">
                        ${inst.isPaid === 'yes'
                        ? `<span class="badge badge-success">✅ مدفوع</span>`
                        : overdue
                            ? `<span class="badge badge-danger">متأخر</span>`
                            : `<span class="badge badge-warning">قادم</span>`
                    }
                        ${inst.isPaid === 'no' ? `<button class="btn btn-sm btn-success" onclick="payInstallment(${inst.id})">دفع</button>` : ''}
                    </div>
                </div>`;
            }).join('');

    } else if (tab === 'payments') {
        const payments = await getCustomerPayments(_currentCustomerId);
        if (payments.length === 0) {
            container.innerHTML = '<p class="empty-state">لا توجد دفعات</p>';
            return;
        }
        container.innerHTML = '<div class="cards-list">' + payments.map(p => `
            <div class="card">
                <div class="card-header">
                    <span class="card-title text-success">${formatCurrency(p.amount)}</span>
                    <div style="display:flex;gap:6px;align-items:center">
                        <span class="card-subtitle">${formatDate(p.date)}</span>
                        <button class="btn-icon" style="width:28px;height:28px" onclick="event.stopPropagation();showEditPaymentModal(${p.id},${p.amount},'${(p.notes || '').replace(/'/g, "\\'")}')">✏️</button>
                        <button class="btn-icon" style="width:28px;height:28px" onclick="event.stopPropagation();confirmDeletePayment(${p.id})">🗑️</button>
                    </div>
                </div>
                ${p.notes ? `<div class="text-muted" style="font-size:0.8rem">${p.notes}</div>` : ''}
            </div>
        `).join('') + '</div>';
    }
}

async function payInstallment(id) {
    const confirmed = await showConfirm('هل تم دفع هذا القسط؟');
    if (confirmed) {
        await markInstallmentPaid(id);
        const inst = await db.installments.get(id);
        if (inst) {
            await addPayment({
                customerId: inst.customerId,
                orderId: inst.orderId,
                amount: inst.amount,
                notes: 'دفع قسط'
            });
        }
        showToast('تم تسجيل دفع القسط ✅');
        loadCustomerDetail(_currentCustomerId);
    }
}

// ==========================================
// New Order Modal
// ==========================================
async function showNewOrderModal() {
    _orderItems = [];
    const products = await getProducts();

    const body = `
        <div class="form-group">
            <label>إضافة منتج للطلب</label>
            <select id="orderProductSelect" class="input-field" onchange="addOrderItemFromSelect()">
                <option value="">-- اختر منتج --</option>
                ${products.map(p => {
        const stockWarning = (p.stock || 0) <= 0 ? ' ⚠️ نفد' : '';
        return `<option value="${p.id}" data-price="${p.sellPrice}" data-cost="${p.costPrice}" data-name="${p.name}" data-stock="${p.stock || 0}">${p.name} - ${formatCurrency(p.sellPrice)} (متاح: ${p.stock || 0})${stockWarning}</option>`;
    }).join('')}
            </select>
        </div>
        <div id="orderItemsList" class="order-items-container"></div>
        <div style="margin-top:12px; padding:12px; background:var(--bg-input); border-radius:var(--radius-md)">
            <div style="display:flex; justify-content:space-between; font-weight:700">
                <span>الإجمالي:</span>
                <span id="orderTotal">0 ${getCurrency()}</span>
            </div>
        </div>
        <div id="stockWarningMsg" class="hidden" style="margin-top:8px;padding:8px 12px;background:var(--accent-danger-bg);border:1px solid var(--accent-danger);border-radius:var(--radius-md);font-size:0.8rem;color:var(--accent-danger)">
            ⚠️ بعض الأصناف تتجاوز الكمية المتاحة في المخزون
        </div>
        <div class="form-group" style="margin-top:14px">
            <label>نوع الدفع</label>
            <select id="orderPaymentType" class="input-field" onchange="toggleInstallmentFields()">
                <option value="deferred">آجل (غير مدفوع)</option>
                <option value="cash">دفع كامل (نقدي)</option>
                <option value="advance">دفع مقدم</option>
                <option value="installment">تقسيط</option>
            </select>
        </div>
        <div id="advanceFields" class="hidden">
            <div class="form-group">
                <label>المبلغ المقدم</label>
                <input type="number" id="orderAdvanceAmount" class="input-field" placeholder="0">
            </div>
        </div>
        <div id="installmentFields" class="hidden">
            <div class="input-row">
                <div class="form-group">
                    <label>عدد الأشهر</label>
                    <input type="number" id="orderInstMonths" class="input-field" placeholder="3" value="3" min="1">
                </div>
                <div class="form-group">
                    <label>المبلغ الإضافي</label>
                    <input type="number" id="orderInstExtra" class="input-field" placeholder="0" value="0">
                </div>
            </div>
        </div>
    `;

    const footer = `
        <button class="btn btn-ghost" onclick="closeModal()">إلغاء</button>
        <button class="btn btn-primary btn-block" onclick="saveOrder()">💾 حفظ الطلب</button>
    `;

    openModal('🛒 طلب جديد', body, footer);
}

function addOrderItemFromSelect() {
    const select = document.getElementById('orderProductSelect');
    const opt = select.selectedOptions[0];
    if (!opt || !opt.value) return;

    const productId = parseInt(opt.value);
    if (_orderItems.find(i => i.productId === productId)) {
        showToast('المنتج مضاف مسبقاً', 'error');
        select.value = '';
        return;
    }

    _orderItems.push({
        productId,
        productName: opt.dataset.name,
        unitPrice: parseFloat(opt.dataset.price),
        costPrice: parseFloat(opt.dataset.cost),
        quantity: 1,
        maxStock: parseInt(opt.dataset.stock),
        isPaid: 'no'
    });

    select.value = '';
    renderOrderItems();
}

function renderOrderItems() {
    const container = document.getElementById('orderItemsList');
    if (_orderItems.length === 0) {
        container.innerHTML = '<p class="text-muted" style="text-align:center; padding:20px; font-size:0.85rem">اختر منتجات لإضافتها للطلب</p>';
        updateOrderTotal();
        return;
    }

    let hasOverstock = false;
    container.innerHTML = _orderItems.map((item, idx) => {
        const overstock = item.quantity > item.maxStock;
        if (overstock) hasOverstock = true;
        const customPrice = item.customPrice !== undefined && item.customPrice !== item.unitPrice;
        const effectivePrice = item.customPrice !== undefined ? item.customPrice : item.unitPrice;
        return `
        <div class="order-item-row ${overstock ? 'order-item-overstock' : ''}">
            <div style="flex:1">
                <div class="order-item-name">${item.productName} ${overstock ? '<span class="text-danger">(عجز!)</span>' : ''} ${customPrice ? '<span class="text-info" style="font-size:0.7rem">💲 سعر خاص</span>' : ''}</div>
                <div class="order-item-price">${formatCurrency(effectivePrice)} × ${item.quantity} = ${formatCurrency(effectivePrice * item.quantity)}</div>
                ${overstock ? `<div class="text-danger" style="font-size:0.7rem">⚠️ متاح: ${item.maxStock} - مطلوب: ${item.quantity} = عجز ${item.quantity - item.maxStock}</div>` : ''}
                ${customPrice ? `<div class="text-muted" style="font-size:0.68rem">السعر الأصلي: ${formatCurrency(item.unitPrice)} | الربح: ${formatCurrency(effectivePrice - item.costPrice)}</div>` : ''}
            </div>
            <div style="display:flex;flex-direction:column;gap:4px;align-items:center">
                <input type="number" value="${effectivePrice}" min="0"
                    class="input-field" style="width:70px; text-align:center; padding:4px; font-size:0.8rem" 
                    onchange="updateOrderItemPrice(${idx}, this.value)" title="سعر البيع">
                <input type="number" value="${item.quantity}" min="1"
                    class="input-field" style="width:60px; text-align:center; padding:4px; font-size:0.8rem" 
                    onchange="updateOrderItemQty(${idx}, this.value)" title="الكمية">
            </div>
            <select class="input-field" style="width:75px; padding:4px; font-size:0.7rem" onchange="updateOrderItemPaid(${idx}, this.value)">
                <option value="no" ${item.isPaid === 'no' ? 'selected' : ''}>غير مدفوع</option>
                <option value="yes" ${item.isPaid === 'yes' ? 'selected' : ''}>مدفوع</option>
            </select>
            <button class="remove-item-btn" onclick="removeOrderItem(${idx})">×</button>
        </div>`;
    }).join('');

    // Show/hide overstock warning
    const warnEl = document.getElementById('stockWarningMsg');
    if (warnEl) warnEl.classList.toggle('hidden', !hasOverstock);

    updateOrderTotal();
}

function updateOrderItemPrice(idx, price) {
    _orderItems[idx].customPrice = parseFloat(price) || 0;
    renderOrderItems();
}

function updateOrderItemQty(idx, qty) {
    _orderItems[idx].quantity = parseInt(qty) || 1;
    renderOrderItems();
}

function updateOrderItemPaid(idx, val) {
    _orderItems[idx].isPaid = val;
}

function removeOrderItem(idx) {
    _orderItems.splice(idx, 1);
    renderOrderItems();
}

function updateOrderTotal() {
    const total = _orderItems.reduce((s, i) => {
        const price = i.customPrice !== undefined ? i.customPrice : i.unitPrice;
        return s + (price * i.quantity);
    }, 0);
    const el = document.getElementById('orderTotal');
    if (el) el.textContent = formatCurrency(total);
}

function toggleInstallmentFields() {
    const type = document.getElementById('orderPaymentType').value;
    document.getElementById('installmentFields').classList.toggle('hidden', type !== 'installment');
    document.getElementById('advanceFields').classList.toggle('hidden', type !== 'advance');
}

async function saveOrder() {
    if (_orderItems.length === 0) {
        showToast('يرجى إضافة منتج واحد على الأقل', 'error');
        return;
    }

    const paymentType = document.getElementById('orderPaymentType').value;
    const baseTotal = _orderItems.reduce((s, i) => {
        const price = i.customPrice !== undefined ? i.customPrice : i.unitPrice;
        return s + (price * i.quantity);
    }, 0);

    let totalAmount = baseTotal;
    let paidAmount = 0;
    let installmentMonths = 0;
    let installmentExtra = 0;

    // For cash payment, mark all items as paid
    if (paymentType === 'cash') {
        _orderItems.forEach(i => i.isPaid = 'yes');
        paidAmount = totalAmount;
    } else if (paymentType === 'advance') {
        paidAmount = parseFloat(document.getElementById('orderAdvanceAmount').value) || 0;
    } else if (paymentType === 'installment') {
        installmentMonths = parseInt(document.getElementById('orderInstMonths').value) || 3;
        installmentExtra = parseFloat(document.getElementById('orderInstExtra').value) || 0;
        totalAmount = baseTotal + installmentExtra;
    }

    const orderId = await addOrder({
        customerId: _currentCustomerId,
        date: today(),
        paymentType,
        totalAmount,
        paidAmount,
        installmentMonths,
        installmentExtra,
        status: paymentType === 'cash' ? 'paid' : 'pending'
    });

    for (const item of _orderItems) {
        const effectivePrice = item.customPrice !== undefined ? item.customPrice : item.unitPrice;
        await addOrderItem({
            orderId,
            productId: item.productId,
            productName: item.productName,
            unitPrice: effectivePrice,
            originalPrice: item.unitPrice,
            costPrice: item.costPrice,
            quantity: item.quantity,
            total: effectivePrice * item.quantity,
            isPaid: item.isPaid
        });

        // Decrease stock
        const product = await getProduct(item.productId);
        if (product) {
            await updateProduct(item.productId, {
                stock: Math.max(0, (product.stock || 0) - item.quantity)
            });
        }
    }

    // If installment, create schedule
    if (paymentType === 'installment') {
        const installments = calculateInstallments(totalAmount, installmentMonths, today());
        let firstInstId = null;
        for (let idx = 0; idx < installments.length; idx++) {
            const inst = installments[idx];
            const instId = await addInstallment({
                orderId,
                customerId: _currentCustomerId,
                ...inst
            });
            if (idx === 0) firstInstId = instId;
        }

        showToast('تم حفظ الطلب بنجاح ✅');
        closeModal();
        loadCustomerDetail(_currentCustomerId);

        // Ask about first payment (down payment)
        setTimeout(async () => {
            const paidFirst = await showConfirm(`هل تم دفع المقدم (القسط الأول)؟\n\nالمبلغ: ${formatCurrency(installments[0].amount)}`);
            if (paidFirst && firstInstId) {
                await markInstallmentPaid(firstInstId);
                showToast('تم تسجيل دفع المقدم ✅');
                loadCustomerDetail(_currentCustomerId);
            }
        }, 500);
        return;
    }

    showToast('تم حفظ الطلب بنجاح ✅');
    closeModal();
    loadCustomerDetail(_currentCustomerId);
}

// ==========================================
// Order Detail
// ==========================================
async function showOrderDetail(orderId) {
    const order = await getOrder(orderId);
    const items = await getOrderItems(orderId);
    if (!order) return;

    let body = `
        <div style="padding:12px; background:var(--bg-input); border-radius:var(--radius-md); margin-bottom:12px">
            <div style="display:flex; justify-content:space-between; margin-bottom:4px">
                <span>التاريخ:</span><span>${formatDate(order.date)}</span>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:4px">
                <span>نوع الدفع:</span>
                <span class="badge ${order.paymentType === 'cash' ? 'badge-success' : 'badge-info'}">
                    ${order.paymentType === 'cash' ? 'نقدي' : order.paymentType === 'advance' ? 'مقدم' : 'تقسيط'}
                </span>
            </div>
            <div style="display:flex; justify-content:space-between; font-weight:700; font-size:1.1rem; padding-top:8px; border-top:1px solid var(--border-color)">
                <span>الإجمالي:</span><span>${formatCurrency(order.totalAmount)}</span>
            </div>
        </div>
        <h4 style="margin-bottom:8px">الأصناف</h4>
    `;

    for (const item of items) {
        body += `
        <div class="order-item-row">
            <div style="flex:1">
                <div class="order-item-name">${item.productName}</div>
                <div class="order-item-price">${formatCurrency(item.unitPrice)} × ${item.quantity}</div>
            </div>
            <div style="text-align:left">
                <div style="font-weight:700">${formatCurrency(item.total)}</div>
                <select class="input-field" style="width:100px; padding:4px; font-size:0.72rem; margin-top:4px" 
                    onchange="updateItemPayStatus(${item.id}, this.value)">
                    <option value="no" ${item.isPaid !== 'yes' ? 'selected' : ''}>غير مدفوع</option>
                    <option value="yes" ${item.isPaid === 'yes' ? 'selected' : ''}>مدفوع ✅</option>
                </select>
            </div>
        </div>`;
    }

    const footer = `
        <button class="btn btn-danger" onclick="confirmDeleteOrder(${orderId})">🗑️ حذف الطلب</button>
        <div style="flex:1"></div>
        <button class="btn btn-ghost" onclick="closeModal()">إغلاق</button>
    `;

    openModal(`تفاصيل الطلب #${orderId}`, body, footer);
}

async function updateItemPayStatus(itemId, status) {
    await updateOrderItem(itemId, { isPaid: status });
    showToast(status === 'yes' ? 'تم تحديد الصنف كمدفوع ✅' : 'تم تحديد الصنف كغير مدفوع');
    loadCustomerDetail(_currentCustomerId);
}

async function confirmDeleteOrder(orderId) {
    const confirmed = await showConfirm('هل تريد حذف هذا الطلب؟');
    if (confirmed) {
        // Stock restoration is handled by deleteOrder() in db.js
        await deleteOrder(orderId);
        showToast('تم حذف الطلب');
        closeModal();
        loadCustomerDetail(_currentCustomerId);
    }
}

// ==========================================
// Payment Management
// ==========================================
function showAddPaymentModal() {
    const body = `
        <div class="form-group">
            <label>المبلغ *</label>
            <input type="number" id="payAmount" class="input-field" placeholder="0">
        </div>
        <div class="form-group">
            <label>ملاحظات</label>
            <input type="text" id="payNotes" class="input-field" placeholder="ملاحظات...">
        </div>
    `;
    const footer = `
        <button class="btn btn-ghost" onclick="closeModal()">إلغاء</button>
        <button class="btn btn-success btn-block" onclick="savePayment()">💵 تسجيل الدفعة</button>
    `;
    openModal('💵 تسجيل دفعة', body, footer);
}

async function savePayment() {
    const amount = parseFloat(document.getElementById('payAmount').value);
    const notes = document.getElementById('payNotes').value.trim();
    if (!amount || amount <= 0) {
        showToast('يرجى إدخال المبلغ', 'error');
        return;
    }
    await addPayment({ customerId: _currentCustomerId, orderId: null, amount, notes });
    showToast('تم تسجيل الدفعة ✅');
    closeModal();
    loadCustomerDetail(_currentCustomerId);
}

function showEditPaymentModal(id, amount, notes) {
    const body = `
        <div class="form-group">
            <label>المبلغ *</label>
            <input type="number" id="editPayAmount" class="input-field" value="${amount}">
        </div>
        <div class="form-group">
            <label>ملاحظات</label>
            <input type="text" id="editPayNotes" class="input-field" value="${notes || ''}">
        </div>
    `;
    const footer = `
        <button class="btn btn-ghost" onclick="closeModal()">إلغاء</button>
        <button class="btn btn-primary btn-block" onclick="updatePaymentRecord(${id})">💾 حفظ التعديل</button>
    `;
    openModal('✏️ تعديل دفعة', body, footer);
}

async function updatePaymentRecord(id) {
    const amount = parseFloat(document.getElementById('editPayAmount').value);
    const notes = document.getElementById('editPayNotes').value.trim();
    if (!amount || amount <= 0) {
        showToast('يرجى إدخال المبلغ', 'error');
        return;
    }
    await updatePayment(id, { amount, notes });
    showToast('تم تحديث الدفعة ✅');
    closeModal();
    loadCustomerDetail(_currentCustomerId);
}

async function confirmDeletePayment(id) {
    const confirmed = await showConfirm('هل تريد حذف هذه الدفعة؟');
    if (confirmed) {
        await deletePayment(id);
        showToast('تم حذف الدفعة');
        loadCustomerDetail(_currentCustomerId);
    }
}
