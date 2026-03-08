// ==========================================
// Reports Screen - with Chart.js animations
// ==========================================

let _chartInstances = {};

function destroyCharts() {
    Object.values(_chartInstances).forEach(c => { if (c && c.destroy) c.destroy(); });
    _chartInstances = {};
}

async function loadReports() {
    destroyCharts();
    if (typeof renderAIBanner === 'function') renderAIBanner();

    const period = document.getElementById('reportPeriod').value;
    const container = document.getElementById('reportsContent');

    const now = new Date();
    let startDate;
    switch (period) {
        case 'today': startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break;
        case 'week': startDate = new Date(now); startDate.setDate(startDate.getDate() - 7); break;
        case 'month': startDate = new Date(now.getFullYear(), now.getMonth(), 1); break;
        case 'quarter': startDate = new Date(now); startDate.setMonth(startDate.getMonth() - 3); break;
        case 'year': startDate = new Date(now.getFullYear(), 0, 1); break;
        case 'all': startDate = new Date(2000, 0, 1); break;
    }
    const startStr = startDate.toISOString().split('T')[0];

    const allOrders = await db.orders.toArray();
    const orders = allOrders.filter(o => o.date >= startStr);
    const allOrderItems = await db.orderItems.toArray();
    const orderItems = allOrderItems.filter(oi => orders.some(o => o.id === oi.orderId));
    const products = await db.products.toArray();
    const customers = await db.customers.toArray();
    const suppliers = await db.suppliers.toArray();
    const supplierPayments = (await db.supplierPayments.toArray()).filter(p => p.date >= startStr);
    const installments = await db.installments.toArray();

    const totalSales = orderItems.reduce((s, i) => s + (i.total || 0), 0);
    const totalPaid = orderItems.filter(i => i.isPaid === 'yes').reduce((s, i) => s + (i.total || 0), 0);
    const totalRemaining = totalSales - totalPaid;
    const totalCost = orderItems.reduce((s, i) => s + ((i.costPrice || 0) * (i.quantity || 0)), 0);
    const grossProfit = totalSales - totalCost;
    const supplierExpenses = supplierPayments.reduce((s, p) => s + (p.amount || 0), 0);

    const productSales = {};
    orderItems.forEach(item => {
        if (!productSales[item.productName]) productSales[item.productName] = { qty: 0, revenue: 0 };
        productSales[item.productName].qty += item.quantity || 0;
        productSales[item.productName].revenue += item.total || 0;
    });
    const topProducts = Object.entries(productSales).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 8);

    const customerSpend = {};
    orders.forEach(o => {
        const cust = customers.find(c => c.id === o.customerId);
        if (cust) {
            if (!customerSpend[cust.name]) customerSpend[cust.name] = 0;
            customerSpend[cust.name] += orderItems.filter(oi => oi.orderId === o.id).reduce((s, i) => s + (i.total || 0), 0);
        }
    });
    const topCustomers = Object.entries(customerSpend).sort((a, b) => b[1] - a[1]).slice(0, 8);

    const ordersByDate = {};
    orders.forEach(o => {
        if (!ordersByDate[o.date]) ordersByDate[o.date] = { count: 0, amount: 0 };
        ordersByDate[o.date].count++;
        ordersByDate[o.date].amount += orderItems.filter(oi => oi.orderId === o.id).reduce((s, i) => s + (i.total || 0), 0);
    });
    const sortedDates = Object.keys(ordersByDate).sort();

    const totalStockQty = products.reduce((s, p) => s + (p.stock || 0), 0);
    const totalStockValue = products.reduce((s, p) => s + ((p.costPrice || 0) * (p.stock || 0)), 0);

    const unpaidInst = installments.filter(i => i.isPaid === 'no');
    const overdueInst = unpaidInst.filter(i => isOverdue(i.dueDate));

    container.innerHTML = `
        <!-- Financial Summary -->
        <div class="report-card" style="animation-delay:0.05s">
            <h4>💰 الملخص المالي</h4>
            <div class="report-row"><span>إجمالي المبيعات</span><span style="font-weight:700">${formatCurrency(totalSales)}</span></div>
            <div class="report-row"><span>المحصّل</span><span class="text-success" style="font-weight:700">${formatCurrency(totalPaid)}</span></div>
            <div class="report-row"><span>مطالبات معلقة</span><span class="text-warning" style="font-weight:700">${formatCurrency(totalRemaining)}</span></div>
            <div class="report-row"><span>تكلفة البضاعة</span><span class="text-muted">${formatCurrency(totalCost)}</span></div>
            <div class="report-row"><span>إجمالي الربح</span><span class="${grossProfit >= 0 ? 'text-success' : 'text-danger'}" style="font-weight:700">${formatCurrency(grossProfit)}</span></div>
            <div class="report-row"><span>مدفوعات للموردين</span><span class="text-warning">${formatCurrency(supplierExpenses)}</span></div>
            <div class="report-row" style="border-top:2px solid var(--border-color);padding-top:8px;font-weight:700">
                <span>صافي الربح</span>
                <span class="${(grossProfit - supplierExpenses) >= 0 ? 'text-success' : 'text-danger'}">${formatCurrency(grossProfit - supplierExpenses)}</span>
            </div>
        </div>

        <!-- Sales Trend -->
        <div class="report-card chart-wrapper" style="animation-delay:0.15s">
            <h4>📈 تسلسل المبيعات</h4>
            <div style="position:relative;height:220px"><canvas id="chartSalesTrend"></canvas></div>
        </div>

        <!-- Cash Flow -->
        <div class="report-card chart-wrapper" style="animation-delay:0.25s">
            <h4>💹 التدفق المالي</h4>
            <div style="position:relative;height:220px"><canvas id="chartCashFlow"></canvas></div>
        </div>

        <!-- Product Distribution -->
        <div class="report-card chart-wrapper" style="animation-delay:0.35s">
            <h4>📊 توزيع المبيعات</h4>
            <div style="position:relative;height:260px"><canvas id="chartProductDist"></canvas></div>
        </div>

        <!-- Top Customers -->
        <div class="report-card chart-wrapper" style="animation-delay:0.45s">
            <h4>👥 أكثر العملاء شراءً</h4>
            <div style="position:relative;height:220px"><canvas id="chartCustomers"></canvas></div>
        </div>

        <!-- Installments & Orders -->
        <div class="report-card" style="animation-delay:0.55s">
            <h4>📅 الأقساط والطلبات</h4>
            <div class="report-row"><span>أقساط غير مدفوعة</span><span style="font-weight:700">${unpaidInst.length}</span></div>
            <div class="report-row"><span>أقساط متأخرة</span><span class="text-danger" style="font-weight:700">${overdueInst.length}</span></div>
            <div class="report-row"><span>عدد الطلبات</span><span style="font-weight:700">${orders.length}</span></div>
            <div class="report-row"><span>متوسط قيمة الطلب</span><span>${formatCurrency(orders.length ? totalSales / orders.length : 0)}</span></div>
            <div class="report-row"><span>نقدي / مقدم / تقسيط</span><span style="font-weight:700">${orders.filter(o => o.paymentType === 'cash').length} / ${orders.filter(o => o.paymentType === 'advance').length} / ${orders.filter(o => o.paymentType === 'installment').length}</span></div>
        </div>

        <!-- Stock Report -->
        <div class="report-card" style="animation-delay:0.65s">
            <h4>📦 المخزون (${totalStockQty} قطعة = ${formatCurrency(totalStockValue)})</h4>
            ${products.sort((a, b) => (b.stock || 0) - (a.stock || 0)).map(p => `
                <div class="report-row">
                    <span>${p.name} <span class="${(p.stock || 0) <= 0 ? 'text-danger' : 'text-muted'}">(${p.stock || 0})</span></span>
                    <span style="font-weight:700">${formatCurrency((p.costPrice || 0) * (p.stock || 0))}</span>
                </div>
            `).join('') || '<p class="text-muted" style="text-align:center;padding:12px">لا توجد منتجات</p>'}
        </div>
    `;

    // Animate report cards
    document.querySelectorAll('.report-card').forEach((card, i) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(30px)';
        setTimeout(() => {
            card.style.transition = 'all 0.5s cubic-bezier(0.34,1.56,0.64,1)';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, 100 + i * 80);
    });

    // Draw charts after slight delay for animation
    setTimeout(() => {
        if (typeof Chart === 'undefined') {
            console.log('Chart.js not loaded yet');
            document.querySelectorAll('.chart-wrapper').forEach(el => {
                el.innerHTML = '<p class="text-muted" style="text-align:center;padding:20px;font-size:0.8rem">جاري تحميل الرسوم البيانية...</p>';
            });
            // Retry in 2 seconds
            setTimeout(() => {
                if (typeof Chart !== 'undefined') {
                    loadReports();
                }
            }, 2000);
            return;
        }
        drawSalesTrendChart(sortedDates, ordersByDate);
        drawCashFlowChart(totalSales, totalPaid, totalRemaining, totalCost, grossProfit, supplierExpenses);
        drawProductDistChart(topProducts);
        drawCustomersChart(topCustomers);
    }, 300);
}

// ==========================================
// Chart.js Configuration
// ==========================================
const COLORS = {
    primary: '#6366f1',
    primaryLight: '#818cf8',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#06b6d4',
    purple: '#8b5cf6',
    pink: '#ec4899',
    teal: '#14b8a6',
    orange: '#f97316',
    palette: ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#84cc16']
};

const CHART_DEFAULTS = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            labels: { color: '#94a3b8', font: { family: 'Tajawal', size: 11 }, padding: 12, usePointStyle: true, pointStyleWidth: 8 }
        },
        tooltip: {
            backgroundColor: '#1e293b',
            titleColor: '#f1f5f9',
            bodyColor: '#cbd5e1',
            borderColor: '#334155',
            borderWidth: 1,
            titleFont: { family: 'Tajawal', weight: '700' },
            bodyFont: { family: 'Tajawal' },
            padding: 12,
            cornerRadius: 10,
            displayColors: true
        }
    },
    scales: {
        x: { ticks: { color: '#64748b', font: { family: 'Tajawal', size: 10 } }, grid: { color: '#1e293b' }, border: { color: '#334155' } },
        y: { ticks: { color: '#64748b', font: { family: 'Tajawal', size: 10 } }, grid: { color: '#1e293b' }, border: { color: '#334155' } }
    }
};

function drawSalesTrendChart(dates, data) {
    const canvas = document.getElementById('chartSalesTrend');
    if (!canvas || dates.length === 0) return;

    const values = dates.map(d => data[d].amount);
    const labels = dates.map(d => d.substring(5));

    _chartInstances.salesTrend = new Chart(canvas, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'المبيعات',
                data: values,
                borderColor: COLORS.primary,
                backgroundColor: (ctx) => {
                    const grad = ctx.chart.ctx.createLinearGradient(0, 0, 0, 200);
                    grad.addColorStop(0, 'rgba(99,102,241,0.3)');
                    grad.addColorStop(1, 'rgba(99,102,241,0.02)');
                    return grad;
                },
                fill: true,
                tension: 0.4,
                borderWidth: 2.5,
                pointRadius: 4,
                pointBackgroundColor: COLORS.primary,
                pointBorderColor: '#0f172a',
                pointBorderWidth: 2,
                pointHoverRadius: 7
            }]
        },
        options: {
            ...CHART_DEFAULTS,
            animation: { duration: 1200, easing: 'easeOutQuart' },
            plugins: { ...CHART_DEFAULTS.plugins, legend: { display: false } },
            interaction: { intersect: false, mode: 'index' }
        }
    });
}

function drawCashFlowChart(sales, paid, remaining, cost, profit, supplierExp) {
    const canvas = document.getElementById('chartCashFlow');
    if (!canvas) return;

    _chartInstances.cashFlow = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: ['المبيعات', 'المحصل', 'المطالبات', 'التكلفة', 'الربح', 'الموردين'],
            datasets: [{
                data: [sales, paid, remaining, cost, profit, supplierExp],
                backgroundColor: [
                    'rgba(99,102,241,0.8)', 'rgba(16,185,129,0.8)', 'rgba(245,158,11,0.8)',
                    'rgba(239,68,68,0.8)', 'rgba(6,182,212,0.8)', 'rgba(139,92,246,0.8)'
                ],
                borderColor: [COLORS.primary, COLORS.success, COLORS.warning, COLORS.danger, COLORS.info, COLORS.purple],
                borderWidth: 1.5,
                borderRadius: 8,
                borderSkipped: false
            }]
        },
        options: {
            ...CHART_DEFAULTS,
            animation: { duration: 1000, easing: 'easeOutBounce', delay: (ctx) => ctx.dataIndex * 100 },
            plugins: { ...CHART_DEFAULTS.plugins, legend: { display: false } },
            scales: {
                ...CHART_DEFAULTS.scales,
                y: { ...CHART_DEFAULTS.scales.y, beginAtZero: true }
            }
        }
    });
}

function drawProductDistChart(topProducts) {
    const canvas = document.getElementById('chartProductDist');
    if (!canvas || topProducts.length === 0) return;

    _chartInstances.productDist = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: topProducts.map(([name]) => name),
            datasets: [{
                data: topProducts.map(([, d]) => d.revenue),
                backgroundColor: COLORS.palette.slice(0, topProducts.length).map(c => c + 'CC'),
                borderColor: COLORS.palette.slice(0, topProducts.length),
                borderWidth: 2,
                hoverOffset: 12
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                animateRotate: true,
                animateScale: true,
                duration: 1200,
                easing: 'easeOutBack'
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#94a3b8', font: { family: 'Tajawal', size: 10 }, padding: 8, usePointStyle: true, pointStyleWidth: 8 }
                },
                tooltip: CHART_DEFAULTS.plugins.tooltip
            },
            cutout: '55%'
        }
    });
}

function drawCustomersChart(topCustomers) {
    const canvas = document.getElementById('chartCustomers');
    if (!canvas || topCustomers.length === 0) return;

    _chartInstances.customers = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: topCustomers.map(([name]) => name.substring(0, 12)),
            datasets: [{
                label: 'المشتريات',
                data: topCustomers.map(([, v]) => v),
                backgroundColor: topCustomers.map((_, i) => COLORS.palette[i % COLORS.palette.length] + '99'),
                borderColor: topCustomers.map((_, i) => COLORS.palette[i % COLORS.palette.length]),
                borderWidth: 1.5,
                borderRadius: 6,
                borderSkipped: false
            }]
        },
        options: {
            ...CHART_DEFAULTS,
            indexAxis: 'y',
            animation: { duration: 1000, easing: 'easeOutQuart', delay: (ctx) => ctx.dataIndex * 80 },
            plugins: { ...CHART_DEFAULTS.plugins, legend: { display: false } },
            scales: {
                x: { ...CHART_DEFAULTS.scales.x, beginAtZero: true },
                y: { ...CHART_DEFAULTS.scales.y, ticks: { ...CHART_DEFAULTS.scales.y.ticks, font: { family: 'Tajawal', size: 10 } } }
            }
        }
    });
}
