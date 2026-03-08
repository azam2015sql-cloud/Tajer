// ==========================================
// Orders History Screen
// ==========================================

async function loadOrdersHistory(searchQuery = '') {
    const orders = await db.orders.toArray();
    const customers = await db.customers.toArray();
    const orderItems = await db.orderItems.toArray();
    const payments = await db.payments.toArray();

    // Sort by date (newest first)
    orders.sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date);
        return dateCompare !== 0 ? dateCompare : b.id - a.id;
    });

    // Filter by search (deep search)
    let filteredOrders = orders;
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filteredOrders = orders.filter(o => {
            const customer = customers.find(c => c.id === o.customerId);
            const items = orderItems.filter(oi => oi.orderId === o.id);
            const paidItems = items.filter(i => i.isPaid === 'yes').length;
            const allPaid = paidItems === items.length && items.length > 0;

            // Payment status search
            const isPaidSearch = q.includes('مدفوع') && !q.includes('غير');
            const isUnpaidSearch = q.includes('غير') || q.includes('مطالب');
            const isCashSearch = q.includes('نقدي');
            const isInstSearch = q.includes('تقسيط');
            const isAdvSearch = q.includes('مقدم');
            const isDeferredSearch = q.includes('آجل');

            if (isPaidSearch && allPaid) return true;
            if (isUnpaidSearch && !allPaid && items.length > 0) return true;
            if (isCashSearch && o.paymentType === 'cash') return true;
            if (isInstSearch && o.paymentType === 'installment') return true;
            if (isAdvSearch && o.paymentType === 'advance') return true;
            if (isDeferredSearch && o.paymentType === 'deferred') return true;

            return (
                (customer && customer.name.toLowerCase().includes(q)) ||
                items.some(i => i.productName && i.productName.toLowerCase().includes(q)) ||
                String(o.id).includes(q)
            );
        });
    }

    const container = document.getElementById('ordersHistoryList');
    if (filteredOrders.length === 0) {
        container.innerHTML = searchQuery
            ? '<p class="empty-state">لا توجد نتائج للبحث</p>'
            : '<p class="empty-state">لا توجد طلبات بعد</p>';
        return;
    }

    // Summary stats
    const totalAmount = filteredOrders.reduce((s, o) => s + (o.totalAmount || 0), 0);
    const paidOrdersCount = filteredOrders.filter(o => o.status === 'paid').length;

    let html = `
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:14px">
            <div style="text-align:center;padding:10px;background:var(--bg-card);border-radius:var(--radius-md);border-top:3px solid var(--accent-info)">
                <div style="font-size:1.2rem;font-weight:800;color:var(--accent-info)">${filteredOrders.length}</div>
                <div style="font-size:0.65rem;color:#64748b">طلب</div>
            </div>
            <div style="text-align:center;padding:10px;background:var(--bg-card);border-radius:var(--radius-md);border-top:3px solid var(--accent-success)">
                <div style="font-size:1.2rem;font-weight:800;color:var(--accent-success)">${paidOrdersCount}</div>
                <div style="font-size:0.65rem;color:#64748b">مكتمل</div>
            </div>
            <div style="text-align:center;padding:10px;background:var(--bg-card);border-radius:var(--radius-md);border-top:3px solid var(--accent-warning)">
                <div style="font-size:0.9rem;font-weight:800;color:var(--accent-warning)">${formatCurrency(totalAmount)}</div>
                <div style="font-size:0.65rem;color:#64748b">الإجمالي</div>
            </div>
        </div>
    `;

    // Group orders by date
    const ordersByDate = {};
    filteredOrders.forEach(o => {
        if (!ordersByDate[o.date]) ordersByDate[o.date] = [];
        ordersByDate[o.date].push(o);
    });

    for (const [date, dateOrders] of Object.entries(ordersByDate)) {
        const dayTotal = dateOrders.reduce((s, o) => s + (o.totalAmount || 0), 0);
        html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:rgba(165,180,252,0.1);border-radius:var(--radius-md);margin:10px 0 6px;font-size:0.78rem;font-weight:700;border-right:3px solid var(--accent-info)">
            <span>📅 ${formatDate(date)}</span>
            <span style="color:var(--accent-info)">${formatCurrency(dayTotal)} (${dateOrders.length} طلب)</span>
        </div>`;

        for (const order of dateOrders) {
            const customer = customers.find(c => c.id === order.customerId);
            const items = orderItems.filter(oi => oi.orderId === order.id);
            const itemNames = items.map(i => i.productName).filter(Boolean);
            const paidItems = items.filter(i => i.isPaid === 'yes').length;
            const allPaid = paidItems === items.length && items.length > 0;
            const paidAmount = items.filter(i => i.isPaid === 'yes').reduce((s, i) => s + (i.total || 0), 0);

            const payTypeLabel = order.paymentType === 'cash' ? '💵 نقدي' :
                order.paymentType === 'advance' ? '💰 مقدم' :
                    order.paymentType === 'installment' ? '📋 تقسيط' : '⏳ آجل';
            const borderColor = allPaid ? 'var(--accent-success)' : 'var(--accent-warning)';
            const bgTint = allPaid ? 'rgba(72,199,142,0.04)' : 'rgba(245,158,11,0.04)';
            const statusIcon = allPaid ? '✅' : `${paidItems}/${items.length}`;

            html += `
            <div class="card" onclick="showOrderDetailFromHistory(${order.id}, ${order.customerId})" style="border-right:4px solid ${borderColor};background:${bgTint};margin-bottom:8px;padding:0">
                <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px 4px">
                    <div>
                        <span style="font-weight:800;font-size:0.95rem;color:var(--text-primary)">${customer?.name || 'عميل محذوف'}</span>
                        <span style="font-size:0.65rem;color:#475569;margin-right:4px">#${order.id}</span>
                    </div>
                    <span style="font-size:0.68rem;padding:2px 8px;border-radius:12px;background:${allPaid ? 'var(--accent-success)' : 'var(--accent-warning)'};color:white;font-weight:700">${statusIcon}</span>
                </div>
                <div style="padding:2px 14px 6px;font-size:0.7rem;color:#94a3b8">
                    📦 ${itemNames.slice(0, 2).join(' • ')}${itemNames.length > 2 ? ` +${itemNames.length - 2}` : ''}
                    <span style="margin-right:8px">${payTypeLabel}</span>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:1px;padding:0 10px 10px">
                    <div style="text-align:center;padding:6px;background:var(--bg-card);border-radius:var(--radius-sm)">
                        <div style="font-size:0.6rem;color:#64748b">المبلغ</div>
                        <div style="font-weight:800;font-size:0.82rem;color:var(--text-primary)">${formatCurrency(order.totalAmount)}</div>
                    </div>
                    <div style="text-align:center;padding:6px;background:var(--bg-card);border-radius:var(--radius-sm)">
                        <div style="font-size:0.6rem;color:#64748b">المدفوع</div>
                        <div style="font-weight:800;font-size:0.82rem;color:${allPaid ? 'var(--accent-success)' : 'var(--accent-warning)'}">${formatCurrency(paidAmount)}</div>
                    </div>
                </div>
            </div>`;
        }
    }

    container.innerHTML = html;
}

async function showOrderDetailFromHistory(orderId, customerId) {
    _currentCustomerId = customerId;
    await showOrderDetail(orderId);
}
