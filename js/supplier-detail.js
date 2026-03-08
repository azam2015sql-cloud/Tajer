// ==========================================
// Supplier Detail Screen - with Supply Batches
// ==========================================

let _currentSupplierId = null;
let _currentSupplierTab = 'batches';

async function loadSupplierDetail(supplierId) {
    _currentSupplierId = supplierId;
    const supplier = await getSupplier(supplierId);
    if (!supplier) return;

    const products = await getProductsBySupplier(supplierId);
    const payments = await getSupplierPayments(supplierId);
    const batches = await getSupplyBatches(supplierId);

    // Calculate from supply batches (total received)
    const totalClaim = batches.reduce((s, b) => s + ((b.costPrice || 0) * (b.quantity || 0)), 0);
    const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);
    const remaining = totalClaim - totalPaid;
    const isSettled = remaining <= 0 && totalClaim > 0;

    document.getElementById('supplierInfo').innerHTML = `
        <div class="detail-name">${supplier.name}</div>
        ${supplier.phone ? `<div class="detail-phone">${supplier.phone}</div>` : ''}
        ${supplier.address ? `<div class="text-muted" style="font-size:0.8rem;margin-bottom:4px">📍 ${supplier.address}</div>` : ''}
        ${supplier.notes ? `<div class="text-muted" style="font-size:0.8rem;margin-bottom:8px">${supplier.notes}</div>` : ''}
        <div class="detail-stats">
            <div class="detail-stat">
                <div class="detail-stat-value">${formatCurrency(totalClaim)}</div>
                <div class="detail-stat-label">إجمالي المطالبة</div>
            </div>
            <div class="detail-stat">
                <div class="detail-stat-value text-success">${formatCurrency(totalPaid)}</div>
                <div class="detail-stat-label">المسدد</div>
            </div>
            <div class="detail-stat">
                <div class="detail-stat-value ${remaining > 0 ? 'text-warning' : 'text-success'}">${formatCurrency(remaining)}</div>
                <div class="detail-stat-label">المتبقي</div>
            </div>
        </div>
        <div style="margin-top:8px">
            <span class="badge ${totalClaim === 0 ? 'badge-info' : isSettled ? 'badge-success' : 'badge-warning'}">${totalClaim === 0 ? 'جديد' : isSettled ? '✅ خالص' : '⚠️ مطالب'}</span>
        </div>
        <div style="margin-top:12px; display:flex; gap:8px; justify-content:center">
            <button class="btn btn-sm btn-outline" onclick="showSupplierModal(${JSON.stringify(supplier).replace(/"/g, '&quot;')})">✏️ تعديل</button>
            <button class="btn btn-sm btn-success" onclick="showAddSupplierPaymentModal()">💵 تسجيل دفعة</button>
            <button class="btn btn-sm btn-info" onclick="showAddSupplyBatchModal()">📦 دفعة توريد</button>
        </div>
    `;

    // Update tabs
    const tabsHtml = `
        <div class="tab ${_currentSupplierTab === 'batches' ? 'active' : ''}" data-tab="batches" onclick="switchSupplierTab('batches')">📦 سجل التوريدات</div>
        <div class="tab ${_currentSupplierTab === 'products' ? 'active' : ''}" data-tab="products" onclick="switchSupplierTab('products')">🏷️ الأصناف</div>
        <div class="tab ${_currentSupplierTab === 'payments' ? 'active' : ''}" data-tab="payments" onclick="switchSupplierTab('payments')">💵 الدفعات</div>
    `;
    const tabBar = document.querySelector('#pageSupplierDetail .tabs');
    if (tabBar) tabBar.innerHTML = tabsHtml;

    switchSupplierTab(_currentSupplierTab);
}

async function switchSupplierTab(tab) {
    _currentSupplierTab = tab;
    document.querySelectorAll('#pageSupplierDetail .tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tab);
    });

    const container = document.getElementById('supplierTabContent');

    if (tab === 'batches') {
        const batches = await getSupplyBatches(_currentSupplierId);
        if (batches.length === 0) {
            container.innerHTML = `
                <p class="empty-state">لا توجد دفعات توريد مسجلة</p>
                <p class="text-muted" style="text-align:center;font-size:0.8rem">اضغط "📦 دفعة توريد" لتسجيل استلام بضاعة</p>
            `;
            return;
        }

        let totalQty = 0, totalCost = 0;
        const html = batches.map(b => {
            const batchTotal = (b.costPrice || 0) * (b.quantity || 0);
            totalQty += b.quantity || 0;
            totalCost += batchTotal;
            return `
            <div class="card" style="border-right:3px solid var(--accent-info);margin-bottom:8px;padding:0">
                <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px 4px">
                    <div>
                        <span style="font-weight:700;font-size:0.9rem">${b.productName || 'صنف'}</span>
                        <span style="font-size:0.65rem;color:#64748b;margin-right:4px">📅 ${formatDate(b.date)}</span>
                    </div>
                    <div style="display:flex;gap:4px">
                        <button class="btn-icon" style="width:26px;height:26px" onclick="showEditSupplyBatchModal(${b.id})">✏️</button>
                        <button class="btn-icon" style="width:26px;height:26px" onclick="confirmDeleteBatch(${b.id})">🗑️</button>
                    </div>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1px;padding:4px 10px 10px">
                    <div style="text-align:center;padding:4px;background:var(--bg-card);border-radius:var(--radius-sm)">
                        <div style="font-size:0.6rem;color:#64748b">الكمية</div>
                        <div style="font-weight:700;font-size:0.82rem">${b.quantity} ${b.unit || 'قطعة'}</div>
                    </div>
                    <div style="text-align:center;padding:4px;background:var(--bg-card);border-radius:var(--radius-sm)">
                        <div style="font-size:0.6rem;color:#64748b">سعر الوحدة</div>
                        <div style="font-weight:700;font-size:0.82rem">${formatCurrency(b.costPrice)}</div>
                    </div>
                    <div style="text-align:center;padding:4px;background:var(--bg-card);border-radius:var(--radius-sm)">
                        <div style="font-size:0.6rem;color:#64748b">الإجمالي</div>
                        <div style="font-weight:700;font-size:0.82rem;color:var(--accent-info)">${formatCurrency(batchTotal)}</div>
                    </div>
                </div>
                ${b.notes ? `<div style="padding:0 14px 8px;font-size:0.7rem;color:#94a3b8">📝 ${b.notes}</div>` : ''}
            </div>`;
        }).join('');

        container.innerHTML = `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px">
                <div style="text-align:center;padding:8px;background:var(--bg-card);border-radius:var(--radius-md);border-top:3px solid var(--accent-info)">
                    <div style="font-size:0.65rem;color:#64748b">إجمالي الكميات</div>
                    <div style="font-weight:800;font-size:1rem;color:var(--accent-info)">${totalQty}</div>
                </div>
                <div style="text-align:center;padding:8px;background:var(--bg-card);border-radius:var(--radius-md);border-top:3px solid var(--accent-warning)">
                    <div style="font-size:0.65rem;color:#64748b">إجمالي المطالبة</div>
                    <div style="font-weight:800;font-size:1rem;color:var(--accent-warning)">${formatCurrency(totalCost)}</div>
                </div>
            </div>
            ${html}
        `;

    } else if (tab === 'products') {
        const products = await getProductsBySupplier(_currentSupplierId);
        if (products.length === 0) {
            container.innerHTML = `
                <p class="empty-state">لا توجد أصناف مرتبطة بهذا المورد</p>
                <p class="text-muted" style="text-align:center;font-size:0.8rem">لربط صنف بالمورد، اذهب لشاشة الأصناف واختر المورد عند إضافة/تعديل الصنف</p>
            `;
            return;
        }

        container.innerHTML = '<div class="cards-list">' + products.map(p => {
            const stockValue = (p.costPrice || 0) * (p.stock || 0);
            return `
            <div class="card" onclick="navigateTo('Products')">
                <div class="card-header">
                    <span class="card-title">${p.name}</span>
                    <span class="card-stat-value">${formatCurrency(stockValue)}</span>
                </div>
                <div class="card-body">
                    <div class="card-stat">
                        <span class="card-stat-label">رأس المال</span>
                        <span class="card-stat-value">${formatCurrency(p.costPrice)}</span>
                    </div>
                    <div class="card-stat">
                        <span class="card-stat-label">المخزون</span>
                        <span class="card-stat-value">${p.stock || 0} ${p.unit || 'قطعة'}</span>
                    </div>
                    <div class="card-stat">
                        <span class="card-stat-label">قيمة المخزون</span>
                        <span class="card-stat-value text-info">${formatCurrency(stockValue)}</span>
                    </div>
                </div>
            </div>`;
        }).join('') + '</div>';

    } else if (tab === 'payments') {
        const payments = await getSupplierPayments(_currentSupplierId);
        if (payments.length === 0) {
            container.innerHTML = '<p class="empty-state">لا توجد دفعات مسجلة</p>';
            return;
        }
        container.innerHTML = '<div class="cards-list">' + payments.map(p => `
            <div class="card">
                <div class="card-header">
                    <span class="card-title text-success">${formatCurrency(p.amount)}</span>
                    <div style="display:flex;gap:6px;align-items:center">
                        <span class="card-subtitle">${formatDate(p.date)}</span>
                        <button class="btn-icon" style="width:28px;height:28px" onclick="event.stopPropagation();showEditSupplierPaymentModal(${p.id},${p.amount},'${(p.notes || '').replace(/'/g, "\\'")}')">✏️</button>
                        <button class="btn-icon" style="width:28px;height:28px" onclick="event.stopPropagation();confirmDeleteSupplierPay(${p.id})">🗑️</button>
                    </div>
                </div>
                ${p.notes ? `<div class="text-muted" style="font-size:0.8rem">${p.notes}</div>` : ''}
            </div>
        `).join('') + '</div>';
    }
}

// ==========================================
// Supply Batch Management
// ==========================================
async function showAddSupplyBatchModal() {
    const products = await getProductsBySupplier(_currentSupplierId);
    const allProducts = await getProducts();
    const supplier = await getSupplier(_currentSupplierId);

    const productOptions = allProducts.map(p =>
        `<option value="${p.id}" ${products.some(sp => sp.id === p.id) ? 'selected' : ''}>${p.name} (مخزون: ${p.stock || 0})</option>`
    ).join('');

    const body = `
        <div class="form-group">
            <label>الصنف *</label>
            <select id="batchProductId" class="input-field" onchange="onBatchProductChange()">
                <option value="">-- اختر الصنف --</option>
                ${productOptions}
            </select>
        </div>
        <div class="input-row">
            <div class="form-group">
                <label>الكمية *</label>
                <input type="number" id="batchQty" class="input-field" placeholder="0">
            </div>
            <div class="form-group">
                <label>سعر الوحدة (رأس مال) *</label>
                <input type="number" id="batchCostPrice" class="input-field" placeholder="0">
            </div>
        </div>
        <div class="form-group">
            <label>التاريخ</label>
            <input type="date" id="batchDate" class="input-field" value="${today()}" style="direction:ltr">
        </div>
        <div class="form-group">
            <label>ملاحظات</label>
            <input type="text" id="batchNotes" class="input-field" placeholder="ملاحظات...">
        </div>
    `;
    const footer = `
        <button class="btn btn-ghost" onclick="closeModal()">إلغاء</button>
        <button class="btn btn-primary btn-block" onclick="saveSupplyBatch()">📦 تسجيل الدفعة</button>
    `;
    openModal('📦 دفعة توريد جديدة - ' + (supplier?.name || ''), body, footer);
}

function onBatchProductChange() {
    const select = document.getElementById('batchProductId');
    const productId = parseInt(select.value);
    if (productId) {
        getProduct(productId).then(p => {
            if (p) {
                document.getElementById('batchCostPrice').value = p.costPrice || '';
            }
        });
    }
}

async function saveSupplyBatch() {
    const productId = parseInt(document.getElementById('batchProductId').value);
    const quantity = parseInt(document.getElementById('batchQty').value);
    const costPrice = parseFloat(document.getElementById('batchCostPrice').value);
    const date = document.getElementById('batchDate').value || today();
    const notes = document.getElementById('batchNotes').value.trim();

    if (!productId) { showToast('يرجى اختيار الصنف', 'error'); return; }
    if (!quantity || quantity <= 0) { showToast('يرجى إدخال الكمية', 'error'); return; }
    if (!costPrice || costPrice <= 0) { showToast('يرجى إدخال سعر الوحدة', 'error'); return; }

    const product = await getProduct(productId);
    const productName = product ? product.name : 'صنف';
    const unit = product ? product.unit || 'قطعة' : 'قطعة';

    // Ensure product is linked to this supplier
    if (product && product.supplierId !== _currentSupplierId) {
        await updateProduct(productId, { supplierId: _currentSupplierId });
    }

    await addSupplyBatch({
        productId,
        supplierId: _currentSupplierId,
        productName,
        quantity,
        costPrice,
        unit,
        date,
        notes
    });

    showToast('تم تسجيل دفعة التوريد ✅');
    closeModal();
    loadSupplierDetail(_currentSupplierId);
}

async function showEditSupplyBatchModal(id) {
    const batch = await db.supplyBatches.get(id);
    if (!batch) return;

    const body = `
        <div class="form-group">
            <label>الصنف</label>
            <input type="text" class="input-field" value="${batch.productName || 'صنف'}" readonly style="opacity:0.7">
        </div>
        <div class="input-row">
            <div class="form-group">
                <label>الكمية *</label>
                <input type="number" id="editBatchQty" class="input-field" value="${batch.quantity}">
            </div>
            <div class="form-group">
                <label>سعر الوحدة *</label>
                <input type="number" id="editBatchCost" class="input-field" value="${batch.costPrice}">
            </div>
        </div>
        <div class="form-group">
            <label>التاريخ</label>
            <input type="date" id="editBatchDate" class="input-field" value="${batch.date}" style="direction:ltr">
        </div>
        <div class="form-group">
            <label>ملاحظات</label>
            <input type="text" id="editBatchNotes" class="input-field" value="${batch.notes || ''}">
        </div>
    `;
    const footer = `
        <button class="btn btn-ghost" onclick="closeModal()">إلغاء</button>
        <button class="btn btn-primary btn-block" onclick="updateBatchRecord(${id})">💾 حفظ التعديل</button>
    `;
    openModal('✏️ تعديل دفعة توريد', body, footer);
}

async function updateBatchRecord(id) {
    const quantity = parseInt(document.getElementById('editBatchQty').value);
    const costPrice = parseFloat(document.getElementById('editBatchCost').value);
    const date = document.getElementById('editBatchDate').value;
    const notes = document.getElementById('editBatchNotes').value.trim();

    if (!quantity || quantity <= 0) { showToast('يرجى إدخال الكمية', 'error'); return; }
    if (!costPrice || costPrice <= 0) { showToast('يرجى إدخال السعر', 'error'); return; }

    await updateSupplyBatch(id, { quantity, costPrice, date, notes });
    showToast('تم تحديث الدفعة ✅');
    closeModal();
    loadSupplierDetail(_currentSupplierId);
}

async function confirmDeleteBatch(id) {
    const confirmed = await showConfirm('هل تريد حذف هذه الدفعة؟ سيتم خصم الكمية من المخزون.');
    if (confirmed) {
        await deleteSupplyBatch(id);
        showToast('تم حذف الدفعة');
        loadSupplierDetail(_currentSupplierId);
    }
}

// ==========================================
// Payment management
// ==========================================
function showAddSupplierPaymentModal() {
    const body = `
        <div class="form-group">
            <label>المبلغ *</label>
            <input type="number" id="supPayAmount" class="input-field" placeholder="0">
        </div>
        <div class="form-group">
            <label>ملاحظات</label>
            <input type="text" id="supPayNotes" class="input-field" placeholder="ملاحظات...">
        </div>
    `;
    const footer = `
        <button class="btn btn-ghost" onclick="closeModal()">إلغاء</button>
        <button class="btn btn-success btn-block" onclick="saveSupplierPay()">💵 تسجيل الدفعة</button>
    `;
    openModal('💵 تسجيل دفعة للمورد', body, footer);
}

async function saveSupplierPay() {
    const amount = parseFloat(document.getElementById('supPayAmount').value);
    const notes = document.getElementById('supPayNotes').value.trim();
    if (!amount || amount <= 0) { showToast('يرجى إدخال المبلغ', 'error'); return; }
    await addSupplierPayment({ supplierId: _currentSupplierId, amount, notes });
    showToast('تم تسجيل الدفعة ✅');
    closeModal();
    loadSupplierDetail(_currentSupplierId);
}

function showEditSupplierPaymentModal(id, amount, notes) {
    const body = `
        <div class="form-group">
            <label>المبلغ *</label>
            <input type="number" id="editSupPayAmount" class="input-field" value="${amount}">
        </div>
        <div class="form-group">
            <label>ملاحظات</label>
            <input type="text" id="editSupPayNotes" class="input-field" value="${notes || ''}">
        </div>
    `;
    const footer = `
        <button class="btn btn-ghost" onclick="closeModal()">إلغاء</button>
        <button class="btn btn-primary btn-block" onclick="updateSupplierPayRecord(${id})">💾 حفظ التعديل</button>
    `;
    openModal('✏️ تعديل دفعة', body, footer);
}

async function updateSupplierPayRecord(id) {
    const amount = parseFloat(document.getElementById('editSupPayAmount').value);
    const notes = document.getElementById('editSupPayNotes').value.trim();
    if (!amount || amount <= 0) { showToast('يرجى إدخال المبلغ', 'error'); return; }
    await db.supplierPayments.update(id, { amount, notes });
    showToast('تم تحديث الدفعة ✅');
    closeModal();
    loadSupplierDetail(_currentSupplierId);
}

async function confirmDeleteSupplierPay(id) {
    const confirmed = await showConfirm('هل تريد حذف هذه الدفعة؟');
    if (confirmed) {
        await deleteSupplierPayment(id);
        showToast('تم حذف الدفعة');
        loadSupplierDetail(_currentSupplierId);
    }
}

// Handle FAB for supplier detail
function showAddSupplierItemModal() {
    showAddSupplyBatchModal();
}
