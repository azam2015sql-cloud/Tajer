async function loadSuppliers(searchQuery = '') {
    let suppliers = await getSuppliers();
    const products = await getProducts();
    const supplierPayments = await db.supplierPayments.toArray();
    const allBatches = await db.supplyBatches.toArray();

    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        suppliers = suppliers.filter(s =>
            s.name.toLowerCase().includes(q) ||
            (s.phone && s.phone.includes(q))
        );
    }

    const container = document.getElementById('suppliersList');
    if (suppliers.length === 0) {
        container.innerHTML = searchQuery
            ? '<p class="empty-state">لا توجد نتائج للبحث</p>'
            : '<p class="empty-state">لا يوجد موردين. اضغط + لإضافة مورد جديد</p>';
        return;
    }

    container.innerHTML = suppliers.map(s => {
        const sProducts = products.filter(p => p.supplierId === s.id);
        // Calculate from supply batches (total received, NOT current stock)
        const sBatches = allBatches.filter(b => b.supplierId === s.id);
        const totalClaim = sBatches.reduce((sum, b) => sum + ((b.costPrice || 0) * (b.quantity || 0)), 0);

        // Payments made
        const sPays = supplierPayments.filter(p => p.supplierId === s.id);
        const totalPaid = sPays.reduce((sum, p) => sum + (p.amount || 0), 0);

        const remaining = totalClaim - totalPaid;
        const isSettled = remaining <= 0 && totalClaim > 0;
        const isNew = totalClaim === 0;
        const badgeText = isNew ? 'جديد' : isSettled ? '✅ خالص' : '⏳ مطالب';
        const borderColor = isNew ? 'var(--accent-info)' : isSettled ? 'var(--accent-success)' : 'var(--accent-warning)';
        const bgTint = isNew ? 'rgba(99,179,237,0.05)' : isSettled ? 'rgba(72,199,142,0.05)' : 'rgba(245,158,11,0.07)';

        return `
        <div class="card" onclick="navigateTo('SupplierDetail', ${s.id})" style="border-right:4px solid ${borderColor};background:${bgTint};margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 14px 4px">
                <div>
                    <span style="font-weight:800;font-size:1rem;color:var(--text-primary)">${s.name}</span>
                    ${s.phone ? `<span style="font-size:0.72rem;color:#64748b;margin-right:6px">📞 ${s.phone}</span>` : ''}
                </div>
                <span style="font-size:0.7rem;font-weight:700;padding:3px 10px;border-radius:20px;background:${borderColor};color:white">${badgeText}</span>
            </div>
            ${sProducts.length > 0 ? `<div style="padding:4px 14px 8px;font-size:0.72rem;color:#94a3b8">📦 ${sProducts.map(p => p.name).slice(0, 3).join(' • ')}${sProducts.length > 3 ? ` +${sProducts.length - 3}` : ''}</div>` : ''}
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1px;padding:0 10px 10px">
                <div style="text-align:center;padding:8px 4px;background:var(--bg-card);border-radius:var(--radius-sm)">
                    <div style="font-size:0.65rem;color:#64748b;margin-bottom:2px">المطالبة</div>
                    <div style="font-weight:800;font-size:0.85rem;color:var(--text-primary)">${formatCurrency(totalClaim)}</div>
                </div>
                <div style="text-align:center;padding:8px 4px;background:var(--bg-card);border-radius:var(--radius-sm)">
                    <div style="font-size:0.65rem;color:#64748b;margin-bottom:2px">المسدد</div>
                    <div style="font-weight:800;font-size:0.85rem;color:var(--accent-success)">${formatCurrency(totalPaid)}</div>
                </div>
                <div style="text-align:center;padding:8px 4px;background:var(--bg-card);border-radius:var(--radius-sm)">
                    <div style="font-size:0.65rem;color:#64748b;margin-bottom:2px">المتبقي</div>
                    <div style="font-weight:800;font-size:0.85rem;color:${remaining > 0 ? 'var(--accent-warning)' : 'var(--accent-success)'}">${formatCurrency(remaining)}</div>
                </div>
            </div>
        </div>`;
    }).join('');
}

function showAddSupplierModal() {
    showSupplierModal(null);
}

async function showSupplierModal(supplier) {
    const isEdit = !!supplier;
    const title = isEdit ? 'تعديل المورد' : 'إضافة مورد جديد';
    const body = `
        <div class="form-group">
            <label>اسم المورد *</label>
            <input type="text" id="supName" class="input-field" placeholder="اسم المورد" value="${supplier?.name || ''}">
        </div>
        <div class="form-group">
            <label>رقم الهاتف</label>
            <input type="tel" id="supPhone" class="input-field" placeholder="05xxxxxxxx" value="${supplier?.phone || ''}" style="direction:ltr; text-align:right">
        </div>
        <div class="form-group">
            <label>العنوان</label>
            <input type="text" id="supAddress" class="input-field" placeholder="العنوان" value="${supplier?.address || ''}">
        </div>
        <div class="form-group">
            <label>ملاحظات</label>
            <input type="text" id="supNotes" class="input-field" placeholder="ملاحظات..." value="${supplier?.notes || ''}">
        </div>
    `;
    const footer = `
        ${isEdit ? `<button class="btn btn-danger" onclick="confirmDeleteSupplier(${supplier.id})">حذف</button>` : ''}
        <div style="flex:1"></div>
        <button class="btn btn-ghost" onclick="closeModal()">إلغاء</button>
        <button class="btn btn-primary" onclick="saveSupplierRecord(${supplier?.id || 'null'})">💾 حفظ</button>
    `;
    openModal(title, body, footer);
}

async function saveSupplierRecord(id) {
    const name = document.getElementById('supName').value.trim();
    const phone = document.getElementById('supPhone').value.trim();
    const address = document.getElementById('supAddress').value.trim();
    const notes = document.getElementById('supNotes').value.trim();
    if (!name) { showToast('يرجى إدخال اسم المورد', 'error'); return; }
    const data = { name, phone, address, notes };

    if (id) {
        await updateSupplier(id, data);
        showToast('تم تحديث بيانات المورد ✅');
    } else {
        await addSupplier(data);
        showToast('تم إضافة المورد ✅');
    }
    closeModal();
    loadSuppliers();
}

async function confirmDeleteSupplier(id) {
    const confirmed = await showConfirm('هل تريد حذف هذا المورد وجميع بياناته؟');
    if (confirmed) {
        await deleteSupplier(id);
        showToast('تم حذف المورد');
        closeModal();
        navigateTo('Suppliers');
    }
}
