// ==========================================
// Database Layer - Dexie.js (IndexedDB)
// ==========================================

const db = new Dexie('TajerDB');

db.version(1).stores({
    settings: '++id',
    categories: '++id, name',
    products: '++id, categoryId, name',
    customers: '++id, name, phone',
    orders: '++id, customerId, date, paymentType, status',
    orderItems: '++id, orderId, productId',
    installments: '++id, orderId, customerId, dueDate, isPaid',
    payments: '++id, customerId, orderId, date',
    suppliers: '++id, name, phone',
    supplierItems: '++id, supplierId, productId, date',
    supplierPayments: '++id, supplierId, date'
});

// Version 2: Add supplierId index to products
db.version(2).stores({
    products: '++id, categoryId, name, supplierId'
});

// Version 3: Add supplyBatches for tracking supply history
db.version(3).stores({
    supplyBatches: '++id, productId, supplierId, date'
});

// Initialize default settings
async function initSettings() {
    const count = await db.settings.count();
    if (count === 0) {
        await db.settings.add({
            storeName: 'متجري',
            currency: 'جنيه',
            defaultUnit: 'قطعة',
            theme: 'dark',
            storePhone: '',
            bankAccounts: '',
            country: '',
            city: ''
        });
    }
    window._settings = await db.settings.toCollection().first();

    // Migrate: ensure new fields exist for old installs
    if (window._settings && !window._settings.hasOwnProperty('storePhone')) {
        await db.settings.update(window._settings.id, {
            storePhone: '', bankAccounts: '', country: '', city: ''
        });
        window._settings = await db.settings.toCollection().first();
    }

    // Run migration for existing products without supply batches
    await migrateExistingProductsToBatches();
}

// One-time migration: create supply batches for existing products linked to suppliers
async function migrateExistingProductsToBatches() {
    const migrated = localStorage.getItem('tajer_batch_migration_v2');
    if (migrated) return;

    try {
        const products = await db.products.toArray();
        const existingBatches = await db.supplyBatches.toArray();
        const allOrderItems = await db.orderItems.toArray();

        for (const p of products) {
            if (!p.supplierId) continue;

            // Check if product already has batches
            const hasBatches = existingBatches.some(b => b.productId === p.id);
            if (hasBatches) continue;

            // Calculate total quantity ever received = current stock + sold qty
            const soldQty = allOrderItems
                .filter(oi => oi.productId === p.id)
                .reduce((sum, oi) => sum + (oi.quantity || 0), 0);
            const totalReceived = (p.stock || 0) + soldQty;

            if (totalReceived <= 0) continue;

            await db.supplyBatches.add({
                productId: p.id,
                supplierId: p.supplierId,
                productName: p.name,
                quantity: totalReceived,
                costPrice: p.costPrice || 0,
                unit: p.unit || 'قطعة',
                date: p.createdAt ? p.createdAt.split('T')[0] : today(),
                notes: 'دفعة تاريخية (ترحيل تلقائي)',
                createdAt: now()
            });
        }

        localStorage.setItem('tajer_batch_migration_v2', 'done');
        console.log('Supply batch migration completed');
    } catch (e) {
        console.error('Migration error:', e);
    }
}

// Initialize default categories
async function initCategories() {
    const count = await db.categories.count();
    if (count === 0) {
        await db.categories.bulkAdd([
            { name: 'عام', color: '#6366f1' },
            { name: 'أغذية', color: '#10b981' },
            { name: 'إلكترونيات', color: '#06b6d4' },
            { name: 'ملابس', color: '#f59e0b' },
            { name: 'أخرى', color: '#8b5cf6' }
        ]);
    }
}

// ==========================================
// Products CRUD
// ==========================================
async function getProducts() {
    return await db.products.toArray();
}

async function getProduct(id) {
    return await db.products.get(id);
}

async function addProduct(product) {
    product.createdAt = now();
    return await db.products.add(product);
}

async function updateProduct(id, changes) {
    return await db.products.update(id, changes);
}

async function deleteProduct(id) {
    return await db.products.delete(id);
}

async function getProductsBySupplier(supplierId) {
    return await db.products.where('supplierId').equals(supplierId).toArray();
}

// ==========================================
// Customers CRUD
// ==========================================
async function getCustomers() {
    return await db.customers.toArray();
}

async function getCustomer(id) {
    return await db.customers.get(id);
}

async function addCustomer(customer) {
    customer.createdAt = now();
    return await db.customers.add(customer);
}

async function updateCustomer(id, changes) {
    return await db.customers.update(id, changes);
}

async function deleteCustomer(id) {
    const orders = await db.orders.where('customerId').equals(id).toArray();
    for (const order of orders) {
        // Restore product stock before deleting order items
        const items = await db.orderItems.where('orderId').equals(order.id).toArray();
        for (const item of items) {
            if (item.productId) {
                const product = await getProduct(item.productId);
                if (product) {
                    await updateProduct(item.productId, {
                        stock: (product.stock || 0) + (item.quantity || 0)
                    });
                }
            }
        }
        await db.orderItems.where('orderId').equals(order.id).delete();
        await db.installments.where('orderId').equals(order.id).delete();
    }
    await db.orders.where('customerId').equals(id).delete();
    await db.payments.where('customerId').equals(id).delete();
    return await db.customers.delete(id);
}

// ==========================================
// Orders CRUD
// ==========================================
async function getCustomerOrders(customerId) {
    return await db.orders.where('customerId').equals(customerId).reverse().toArray();
}

async function getOrder(id) {
    return await db.orders.get(id);
}

async function addOrder(order) {
    return await db.orders.add(order);
}

async function getOrderItems(orderId) {
    return await db.orderItems.where('orderId').equals(orderId).toArray();
}

async function addOrderItem(item) {
    return await db.orderItems.add(item);
}

async function updateOrderItem(id, changes) {
    return await db.orderItems.update(id, changes);
}

async function deleteOrder(orderId) {
    // Restore product stock before deleting order items
    const items = await db.orderItems.where('orderId').equals(orderId).toArray();
    for (const item of items) {
        if (item.productId) {
            const product = await getProduct(item.productId);
            if (product) {
                await updateProduct(item.productId, {
                    stock: (product.stock || 0) + (item.quantity || 0)
                });
            }
        }
    }
    await db.orderItems.where('orderId').equals(orderId).delete();
    await db.installments.where('orderId').equals(orderId).delete();
    return await db.orders.delete(orderId);
}

// ==========================================
// Installments CRUD
// ==========================================
async function getCustomerInstallments(customerId) {
    return await db.installments.where('customerId').equals(customerId).toArray();
}

async function getOrderInstallments(orderId) {
    return await db.installments.where('orderId').equals(orderId).toArray();
}

async function addInstallment(inst) {
    return await db.installments.add(inst);
}

async function markInstallmentPaid(id) {
    return await db.installments.update(id, { isPaid: 'yes', paidDate: today() });
}

async function getDueInstallments() {
    const now = new Date();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    return await db.installments
        .where('isPaid').equals('no')
        .filter(i => i.dueDate <= monthEnd)
        .toArray();
}

// ==========================================
// Payments CRUD (installment payments)
// ==========================================
async function getCustomerPayments(customerId) {
    return await db.payments.where('customerId').equals(customerId).reverse().toArray();
}

async function addPayment(payment) {
    payment.date = payment.date || today();
    return await db.payments.add(payment);
}

async function updatePayment(id, changes) {
    return await db.payments.update(id, changes);
}

async function deletePayment(id) {
    return await db.payments.delete(id);
}

// ==========================================
// Customer Financial Calculations
// ==========================================
async function getCustomerFinancials(customerId) {
    const orders = await getCustomerOrders(customerId);
    const allOrderItems = [];
    for (const order of orders) {
        const items = await getOrderItems(order.id);
        allOrderItems.push(...items);
    }

    const totalAmount = allOrderItems.reduce((s, i) => s + (i.total || 0), 0);
    const paidAmount = allOrderItems.filter(i => i.isPaid === 'yes').reduce((s, i) => s + (i.total || 0), 0);
    const remaining = totalAmount - paidAmount;

    return { totalAmount, paidAmount, remaining, orders, allOrderItems };
}

// ==========================================
// Suppliers CRUD
// ==========================================
async function getSuppliers() {
    return await db.suppliers.toArray();
}

async function getSupplier(id) {
    return await db.suppliers.get(id);
}

async function addSupplier(supplier) {
    supplier.createdAt = now();
    return await db.suppliers.add(supplier);
}

async function updateSupplier(id, changes) {
    return await db.suppliers.update(id, changes);
}

async function deleteSupplier(id) {
    // Remove supplier link from products
    const products = await getProductsBySupplier(id);
    for (const p of products) {
        await updateProduct(p.id, { supplierId: null });
    }
    await db.supplierItems.where('supplierId').equals(id).delete();
    await db.supplierPayments.where('supplierId').equals(id).delete();
    await db.supplyBatches.where('supplierId').equals(id).delete();
    return await db.suppliers.delete(id);
}

// ==========================================
// Supplier Items & Payments
// ==========================================
async function getSupplierItems(supplierId) {
    return await db.supplierItems.where('supplierId').equals(supplierId).toArray();
}

async function addSupplierItem(item) {
    item.date = item.date || today();
    if (item.productId) {
        const product = await getProduct(item.productId);
        if (product) {
            await updateProduct(item.productId, { stock: (product.stock || 0) + item.quantity });
        }
    }
    return await db.supplierItems.add(item);
}

async function deleteSupplierItem(id) {
    const item = await db.supplierItems.get(id);
    if (item && item.productId) {
        const product = await getProduct(item.productId);
        if (product) {
            await updateProduct(item.productId, { stock: Math.max(0, (product.stock || 0) - item.quantity) });
        }
    }
    return await db.supplierItems.delete(id);
}

async function getSupplierPayments(supplierId) {
    return await db.supplierPayments.where('supplierId').equals(supplierId).reverse().toArray();
}

async function addSupplierPayment(payment) {
    payment.date = payment.date || today();
    return await db.supplierPayments.add(payment);
}

async function deleteSupplierPayment(id) {
    return await db.supplierPayments.delete(id);
}

// ==========================================
// Supply Batches CRUD
// ==========================================
async function getSupplyBatches(supplierId) {
    return await db.supplyBatches.where('supplierId').equals(supplierId).reverse().toArray();
}

async function getProductSupplyBatches(productId) {
    return await db.supplyBatches.where('productId').equals(productId).reverse().toArray();
}

async function addSupplyBatch(batch) {
    batch.date = batch.date || today();
    batch.createdAt = now();
    // Also increase product stock
    if (batch.productId) {
        const product = await getProduct(batch.productId);
        if (product) {
            await updateProduct(batch.productId, { stock: (product.stock || 0) + (batch.quantity || 0) });
        }
    }
    return await db.supplyBatches.add(batch);
}

async function updateSupplyBatch(id, changes) {
    const old = await db.supplyBatches.get(id);
    if (old && old.productId && changes.quantity !== undefined) {
        const diff = (changes.quantity || 0) - (old.quantity || 0);
        if (diff !== 0) {
            const product = await getProduct(old.productId);
            if (product) {
                await updateProduct(old.productId, { stock: Math.max(0, (product.stock || 0) + diff) });
            }
        }
    }
    return await db.supplyBatches.update(id, changes);
}

async function deleteSupplyBatch(id) {
    const batch = await db.supplyBatches.get(id);
    if (batch && batch.productId) {
        const product = await getProduct(batch.productId);
        if (product) {
            await updateProduct(batch.productId, { stock: Math.max(0, (product.stock || 0) - (batch.quantity || 0)) });
        }
    }
    return await db.supplyBatches.delete(id);
}

// ==========================================
// Supplier Financial Calculations
// ==========================================
async function getSupplierFinancials(supplierId) {
    // Debt = total from supplyBatches (all received quantities, not current stock)
    const batches = await getSupplyBatches(supplierId);
    const totalBatchesCost = batches.reduce((s, b) => s + ((b.costPrice || 0) * (b.quantity || 0)), 0);

    // Also include old supplier items
    const supplierItems = await getSupplierItems(supplierId);
    const totalItemsCost = supplierItems.reduce((s, i) => s + (i.totalCost || 0), 0);

    const products = await getProductsBySupplier(supplierId);
    const totalCost = totalBatchesCost + totalItemsCost;

    // Payments
    const payments = await getSupplierPayments(supplierId);
    const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);

    const remaining = totalCost - totalPaid;

    return { totalCost, totalPaid, remaining, products, batches, supplierItems, payments };
}

// ==========================================
// Categories
// ==========================================
async function getCategories() {
    return await db.categories.toArray();
}

async function addCategory(cat) {
    return await db.categories.add(cat);
}

async function deleteCategory(id) {
    return await db.categories.delete(id);
}

// ==========================================
// Dashboard Stats
// ==========================================
async function getDashboardStats() {
    const orders = await db.orders.toArray();
    const orderItems = await db.orderItems.toArray();
    const customers = await db.customers.toArray();
    const products = await db.products.toArray();
    const payments = await db.payments.toArray();
    const installments = await db.installments.toArray();
    const suppliers = await db.suppliers.toArray();
    const supplierPayments = await db.supplierPayments.toArray();

    // Total sales (from order items)
    const totalSales = orderItems.reduce((sum, i) => sum + (i.total || 0), 0);

    // Total cost
    const totalCost = orderItems.reduce((sum, i) => sum + ((i.costPrice || 0) * (i.quantity || 0)), 0);

    // Net profit
    const netProfit = totalSales - totalCost;

    // Total paid (from order items marked as paid)
    const totalPaid = orderItems.filter(i => i.isPaid === 'yes').reduce((sum, i) => sum + (i.total || 0), 0);

    // Total remaining (debt)
    const totalDebt = totalSales - totalPaid;

    // Customers with debt
    const debtors = [];
    for (const c of customers) {
        const cOrders = orders.filter(o => o.customerId === c.id);
        const cOrderIds = cOrders.map(o => o.id);
        const cItems = orderItems.filter(i => cOrderIds.includes(i.orderId));
        const cTotal = cItems.reduce((s, i) => s + (i.total || 0), 0);
        const cPaid = cItems.filter(i => i.isPaid === 'yes').reduce((s, i) => s + (i.total || 0), 0);
        const cDebt = cTotal - cPaid;
        if (cDebt > 0) {
            debtors.push({ ...c, debt: cDebt });
        }
    }

    // Low stock products
    const lowStock = products.filter(p => p.lowStockAlert && p.stock <= p.lowStockAlert);

    // Supplier stats
    const supplierTotalPaid = supplierPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const supplyBatches = await db.supplyBatches.toArray();
    const supplierProductsCost = supplyBatches.reduce((sum, b) => sum + ((b.costPrice || 0) * (b.quantity || 0)), 0);

    // Total stock value
    const totalStock = products.reduce((sum, p) => sum + (p.stock || 0), 0);

    return {
        totalSales,
        totalCost,
        netProfit,
        totalPaid,
        totalDebt,
        customerCount: customers.length,
        debtors,
        lowStock,
        supplierProductsCost,
        supplierTotalPaid,
        totalStock
    };
}

// ==========================================
// Backup / Restore
// ==========================================
async function exportAllData() {
    const data = {
        version: 3,
        exportDate: now(),
        settings: await db.settings.toArray(),
        categories: await db.categories.toArray(),
        products: await db.products.toArray(),
        customers: await db.customers.toArray(),
        orders: await db.orders.toArray(),
        orderItems: await db.orderItems.toArray(),
        installments: await db.installments.toArray(),
        payments: await db.payments.toArray(),
        suppliers: await db.suppliers.toArray(),
        supplierItems: await db.supplierItems.toArray(),
        supplierPayments: await db.supplierPayments.toArray(),
        supplyBatches: await db.supplyBatches.toArray()
    };
    return JSON.stringify(data, null, 2);
}

async function importAllData(jsonStr) {
    const data = JSON.parse(jsonStr);

    await db.settings.clear();
    await db.categories.clear();
    await db.products.clear();
    await db.customers.clear();
    await db.orders.clear();
    await db.orderItems.clear();
    await db.installments.clear();
    await db.payments.clear();
    await db.suppliers.clear();
    await db.supplierItems.clear();
    await db.supplierPayments.clear();
    await db.supplyBatches.clear();

    if (data.settings?.length) await db.settings.bulkAdd(data.settings);
    if (data.categories?.length) await db.categories.bulkAdd(data.categories);
    if (data.products?.length) await db.products.bulkAdd(data.products);
    if (data.customers?.length) await db.customers.bulkAdd(data.customers);
    if (data.orders?.length) await db.orders.bulkAdd(data.orders);
    if (data.orderItems?.length) await db.orderItems.bulkAdd(data.orderItems);
    if (data.installments?.length) await db.installments.bulkAdd(data.installments);
    if (data.payments?.length) await db.payments.bulkAdd(data.payments);
    if (data.suppliers?.length) await db.suppliers.bulkAdd(data.suppliers);
    if (data.supplierItems?.length) await db.supplierItems.bulkAdd(data.supplierItems);
    if (data.supplierPayments?.length) await db.supplierPayments.bulkAdd(data.supplierPayments);
    if (data.supplyBatches?.length) await db.supplyBatches.bulkAdd(data.supplyBatches);

    window._settings = await db.settings.toCollection().first();
}
