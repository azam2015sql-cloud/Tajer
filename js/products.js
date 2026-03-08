// ==========================================
// Products Screen - With Supplier Linking
// ==========================================

let _currentCategoryFilter = 'all';

async function loadProducts(searchQuery = '') {
    let products = await getProducts();
    const categories = await getCategories();
    const suppliers = await getSuppliers();

    // Render category tabs
    const tabsContainer = document.getElementById('categoriesTabs');
    tabsContainer.innerHTML = `
        <button class="category-tab ${_currentCategoryFilter === 'all' ? 'active' : ''}" data-cat="all" onclick="filterByCategory('all')">الكل (${products.length})</button>
        ${categories.map(c => {
        const count = products.filter(p => p.categoryId === c.id).length;
        return `<button class="category-tab ${_currentCategoryFilter === c.id ? 'active' : ''}" 
                data-cat="${c.id}" onclick="filterByCategory(${c.id})" 
                style="border-color:${c.color}">${c.name} (${count})</button>`;
    }).join('')}
        <button class="category-tab" onclick="showAddCategoryModal()" style="border-style:dashed">+ تصنيف</button>
    `;

    // Filter
    if (_currentCategoryFilter !== 'all') {
        products = products.filter(p => p.categoryId === _currentCategoryFilter);
    }
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        products = products.filter(p => {
            const cat = categories.find(c => c.id === p.categoryId);
            const supplier = suppliers.find(s => s.id === p.supplierId);
            const nameMatch = p.name.toLowerCase().includes(q);
            const catMatch = cat && cat.name.toLowerCase().includes(q);
            const supMatch = supplier && supplier.name.toLowerCase().includes(q);
            const outMatch = q.includes('نفد') && (p.stock || 0) <= 0;
            const lowMatch = q.includes('منخفض') && p.lowStockAlert && p.stock <= p.lowStockAlert;
            return nameMatch || catMatch || supMatch || outMatch || lowMatch;
        });
    }

    const container = document.getElementById('productsList');
    if (products.length === 0) {
        container.innerHTML = '<p class="empty-state">لا توجد أصناف. اضغط + لإضافة صنف جديد</p>';
        return;
    }

    // Calculate ordered quantities per product
    const orderItems = await db.orderItems.toArray();
    const orderedQty = {};
    orderItems.forEach(oi => {
        orderedQty[oi.productId] = (orderedQty[oi.productId] || 0) + (oi.quantity || 0);
    });

    container.innerHTML = products.map(p => {
        const cat = categories.find(c => c.id === p.categoryId);
        const supplier = suppliers.find(s => s.id === p.supplierId);
        const profit = (p.sellPrice || 0) - (p.costPrice || 0);
        const lowStock = p.lowStockAlert && p.stock <= p.lowStockAlert;
        const ordered = orderedQty[p.id] || 0;
        const currentStock = p.stock || 0;
        const totalStock = currentStock + ordered; // original stock before orders
        const outOfStock = currentStock <= 0;

        return `
        <div class="card ${lowStock ? 'card-warning' : ''} ${outOfStock ? 'card-danger-border' : ''}" onclick="showEditProductModal(${p.id})">
            <div class="card-header">
                <div>
                    <span class="card-title">${p.name}</span>
                    ${cat ? `<span class="card-subtitle" style="color:${cat.color}"> • ${cat.name}</span>` : ''}
                </div>
                <div style="display:flex;gap:4px;align-items:center">
                    ${supplier ? `<span class="badge badge-info">${supplier.name}</span>` : ''}
                    ${outOfStock ? '<span class="badge badge-danger">نفد</span>' : lowStock ? '<span class="badge badge-warning">منخفض</span>' : ''}
                </div>
            </div>
            <div class="card-body">
                <div class="card-stat">
                    <span class="card-stat-label">رأس المال</span>
                    <span class="card-stat-value">${formatCurrency(p.costPrice)}</span>
                </div>
                <div class="card-stat">
                    <span class="card-stat-label">سعر البيع</span>
                    <span class="card-stat-value text-success">${formatCurrency(p.sellPrice)}</span>
                </div>
                <div class="card-stat">
                    <span class="card-stat-label">الربح</span>
                    <span class="card-stat-value" style="color:${profit > 0 ? 'var(--accent-success)' : 'var(--accent-danger)'}">${formatCurrency(profit)}</span>
                </div>
                <div class="card-stat">
                    <span class="card-stat-label">الكلي</span>
                    <span class="card-stat-value">${totalStock} ${p.unit || 'قطعة'}</span>
                </div>
                <div class="card-stat">
                    <span class="card-stat-label">مباع</span>
                    <span class="card-stat-value text-warning">${ordered}</span>
                </div>
                <div class="card-stat">
                    <span class="card-stat-label">المتبقي</span>
                    <span class="card-stat-value ${currentStock <= 0 ? 'text-danger' : 'text-success'}">${currentStock} ${p.unit || 'قطعة'}</span>
                </div>
            </div>
        </div>`;
    }).join('');
}

function filterByCategory(catId) {
    _currentCategoryFilter = catId;
    loadProducts();
}

function showAddProductModal() {
    showProductModal(null);
}

async function showEditProductModal(id) {
    const product = await getProduct(id);
    if (product) showProductModal(product);
}

async function showProductModal(product) {
    const categories = await getCategories();
    const suppliers = await getSuppliers();
    const isEdit = !!product;
    const title = isEdit ? 'تعديل الصنف' : 'إضافة صنف جديد';

    const body = `
        <div class="form-group">
            <label>اسم الصنف *</label>
            <input type="text" id="prodName" class="input-field" placeholder="مثال: أرز" value="${product?.name || ''}">
        </div>
        <div class="input-row">
            <div class="form-group">
                <label>التصنيف</label>
                <select id="prodCategory" class="input-field">
                    ${categories.map(c => `<option value="${c.id}" ${product?.categoryId === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>المورد</label>
                <select id="prodSupplier" class="input-field">
                    <option value="">بدون مورد</option>
                    ${suppliers.map(s => `<option value="${s.id}" ${product?.supplierId === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
                </select>
            </div>
        </div>
        <div class="input-row">
            <div class="form-group">
                <label>سعر رأس المال *</label>
                <input type="number" id="prodCost" class="input-field" placeholder="0" value="${product?.costPrice || ''}" oninput="calcSellPrice()">
            </div>
            <div class="form-group">
                <label>هامش الربح</label>
                <input type="number" id="prodMargin" class="input-field" placeholder="0" value="${product?.profitMargin || ''}" oninput="calcSellPrice()">
            </div>
        </div>
        <div class="form-group">
            <label>سعر البيع (محسوب تلقائياً)</label>
            <input type="number" id="prodSellPrice" class="input-field" placeholder="0" value="${product?.sellPrice || ''}" style="font-weight:700; color:var(--accent-success)">
        </div>
        <div class="input-row">
            <div class="form-group">
                <label>${isEdit ? 'الكمية الحالية (قابلة للتعديل)' : 'الكمية الابتدائية'}</label>
                <input type="number" id="prodStock" class="input-field" placeholder="0" value="${product?.stock || 0}">
            </div>
            <div class="form-group">
                <label>الوحدة</label>
                <input type="text" id="prodUnit" class="input-field" placeholder="${window._settings?.defaultUnit || 'قطعة'}" value="${product?.unit || ''}">
            </div>
        </div>
        ${isEdit ? `
        <div style="background:var(--accent-info-bg);padding:10px 12px;border-radius:var(--radius-md);border:1px solid var(--accent-info);margin-bottom:8px">
            <label style="color:var(--accent-info);font-size:0.78rem;font-weight:700">📦 تعديل سريع للكمية</label>
            <div style="display:flex;gap:6px;margin-top:6px;align-items:center">
                <button type="button" class="btn btn-sm" style="background:var(--accent-danger);color:white;font-size:1rem;width:36px" onclick="document.getElementById('prodStock').value = Math.max(0, parseInt(document.getElementById('prodStock').value || 0) - 1)">−</button>
                <span id="stockQuickDisplay" style="font-weight:800;font-size:1.1rem;flex:1;text-align:center">${product.stock || 0}</span>
                <button type="button" class="btn btn-sm" style="background:var(--accent-success);color:white;font-size:1rem;width:36px" onclick="document.getElementById('prodStock').value = parseInt(document.getElementById('prodStock').value || 0) + 1">+</button>
            </div>
            <div class="text-muted" style="font-size:0.7rem;margin-top:4px;text-align:center">يمكنك أيضاً تعديل الكمية مباشرة في الحقل أعلاه</div>
        </div>
        ` : ''}
        <div class="form-group">
            <label>تنبيه عند نفاد المخزون (اختياري)</label>
            <input type="number" id="prodLowStock" class="input-field" placeholder="مثال: 5" value="${product?.lowStockAlert || ''}">
        </div>
    `;

    const footer = `
        ${isEdit ? `<button class="btn btn-danger" onclick="confirmDeleteProduct(${product.id})">حذف</button>` : ''}
        <div style="flex:1"></div>
        <button class="btn btn-ghost" onclick="closeModal()">إلغاء</button>
        <button class="btn btn-primary" onclick="saveProduct(${product?.id || 'null'})">💾 حفظ</button>
    `;

    openModal(title, body, footer);
}

function calcSellPrice() {
    const cost = parseFloat(document.getElementById('prodCost').value) || 0;
    const margin = parseFloat(document.getElementById('prodMargin').value) || 0;
    document.getElementById('prodSellPrice').value = cost + margin;
}

async function saveProduct(id) {
    const name = document.getElementById('prodName').value.trim();
    const categoryId = parseInt(document.getElementById('prodCategory').value);
    const supplierIdVal = document.getElementById('prodSupplier').value;
    const supplierId = supplierIdVal ? parseInt(supplierIdVal) : null;
    const costPrice = parseFloat(document.getElementById('prodCost').value) || 0;
    const profitMargin = parseFloat(document.getElementById('prodMargin').value) || 0;
    const sellPrice = parseFloat(document.getElementById('prodSellPrice').value) || 0;
    const unit = document.getElementById('prodUnit').value.trim() || window._settings?.defaultUnit || 'قطعة';
    const lowStockAlert = parseInt(document.getElementById('prodLowStock').value) || 0;

    if (!name) {
        showToast('يرجى إدخال اسم الصنف', 'error');
        return;
    }

    let newStock = parseInt(document.getElementById('prodStock').value) || 0;

    const data = { name, categoryId, supplierId, costPrice, profitMargin, sellPrice, stock: newStock, unit, lowStockAlert };

    if (id) {
        // Editing existing product
        const oldProduct = await getProduct(id);
        const stockDiff = newStock - (oldProduct?.stock || 0);

        await updateProduct(id, data);

        // If stock increased and product has a supplier, create a supply batch
        if (stockDiff > 0 && supplierId) {
            await db.supplyBatches.add({
                productId: id,
                supplierId: supplierId,
                productName: name,
                quantity: stockDiff,
                costPrice: costPrice,
                unit: unit,
                date: today(),
                notes: 'إضافة كمية من شاشة الأصناف',
                createdAt: now()
            });
        }

        showToast('تم تحديث الصنف ✅');
    } else {
        // New product
        const productId = await addProduct(data);

        // If product has supplier and initial stock, create supply batch
        if (supplierId && newStock > 0) {
            await db.supplyBatches.add({
                productId: productId,
                supplierId: supplierId,
                productName: name,
                quantity: newStock,
                costPrice: costPrice,
                unit: unit,
                date: today(),
                notes: 'دفعة ابتدائية عند إنشاء الصنف',
                createdAt: now()
            });
        }

        showToast('تم إضافة الصنف ✅');
    }

    closeModal();
    loadProducts();
}

async function confirmDeleteProduct(id) {
    const confirmed = await showConfirm('هل تريد حذف هذا الصنف؟');
    if (confirmed) {
        await deleteProduct(id);
        showToast('تم حذف الصنف');
        closeModal();
        loadProducts();
    }
}

// Category modal
function showAddCategoryModal() {
    const body = `
        <div class="form-group">
            <label>اسم التصنيف</label>
            <input type="text" id="catName" class="input-field" placeholder="مثال: أغذية">
        </div>
        <div class="form-group">
            <label>اللون</label>
            <input type="color" id="catColor" class="input-field" value="#6366f1" style="height:45px; padding:4px;">
        </div>
    `;
    const footer = `
        <button class="btn btn-ghost" onclick="closeModal()">إلغاء</button>
        <button class="btn btn-primary" onclick="saveCategory()">💾 حفظ</button>
    `;
    openModal('إضافة تصنيف', body, footer);
}

async function saveCategory() {
    const name = document.getElementById('catName').value.trim();
    const color = document.getElementById('catColor').value;
    if (!name) { showToast('يرجى إدخال اسم التصنيف', 'error'); return; }
    await addCategory({ name, color });
    showToast('تم إضافة التصنيف ✅');
    closeModal();
    loadProducts();
}
