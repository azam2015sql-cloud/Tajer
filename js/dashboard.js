// ==========================================
// Dashboard Screen - Fixed
// ==========================================

async function loadDashboard() {
    const stats = await getDashboardStats();

    // Remove old quick-access if exists
    const oldQA = document.querySelector('.quick-access');
    if (oldQA) oldQA.remove();

    const grid = document.getElementById('dashboardGrid');
    grid.innerHTML = `
        <div class="stat-card stat-sales">
            <div class="stat-icon">💰</div>
            <div class="stat-value">${formatCurrency(stats.totalSales)}</div>
            <div class="stat-label">إجمالي المبيعات</div>
        </div>
        <div class="stat-card stat-profit">
            <div class="stat-icon">📈</div>
            <div class="stat-value">${formatCurrency(stats.netProfit)}</div>
            <div class="stat-label">صافي الربح</div>
        </div>
        <div class="stat-card stat-customers">
            <div class="stat-icon">👥</div>
            <div class="stat-value">${formatNumber(stats.customerCount)}</div>
            <div class="stat-label">عدد العملاء</div>
        </div>
        <div class="stat-card stat-debt">
            <div class="stat-icon">⏳</div>
            <div class="stat-value">${formatCurrency(stats.totalDebt)}</div>
            <div class="stat-label">مطالبات العملاء</div>
        </div>
        <div class="stat-card stat-debtors">
            <div class="stat-icon">🔔</div>
            <div class="stat-value">${formatNumber(stats.debtors.length)}</div>
            <div class="stat-label">عملاء مطالبون</div>
        </div>
        <div class="stat-card stat-stock">
            <div class="stat-icon">📦</div>
            <div class="stat-value">${formatNumber(stats.totalStock)}</div>
            <div class="stat-label">إجمالي المخزون</div>
        </div>
    `;

    // Due installments
    const dueInst = await getDueInstallments();
    const dueContainer = document.getElementById('dueInstallments');
    if (dueInst.length === 0) {
        dueContainer.innerHTML = '<p class="empty-state">لا توجد أقساط مستحقة هذا الشهر ✅</p>';
    } else {
        let html = '';
        for (const inst of dueInst) {
            const customer = await getCustomer(inst.customerId);
            const overdue = isOverdue(inst.dueDate);
            html += `
                <div class="installment-row ${overdue ? 'overdue' : ''}" onclick="navigateTo('CustomerDetail', ${inst.customerId})">
                    <div>
                        <strong>${customer?.name || ''}</strong>
                        <div class="text-muted" style="font-size:0.75rem">${formatDate(inst.dueDate)}</div>
                    </div>
                    <div>
                        <span class="${overdue ? 'text-danger' : ''}">${formatCurrency(inst.amount)}</span>
                        ${overdue ? '<span class="badge badge-danger" style="margin-right:6px">متأخر</span>' : ''}
                    </div>
                </div>
            `;
        }
        dueContainer.innerHTML = html;
    }

    // Debtors
    const debtorsContainer = document.getElementById('debtorsList');
    if (stats.debtors.length === 0) {
        debtorsContainer.innerHTML = '<p class="empty-state">لا يوجد عملاء مطالبون ✅</p>';
    } else {
        debtorsContainer.innerHTML = stats.debtors
            .sort((a, b) => b.debt - a.debt)
            .slice(0, 10)
            .map(d => `
                <div class="card" onclick="navigateTo('CustomerDetail', ${d.id})">
                    <div class="card-header">
                        <span class="card-title">${d.name}</span>
                        <span class="text-danger" style="font-weight:700">${formatCurrency(d.debt)}</span>
                    </div>
                </div>
            `).join('');
    }

    // Low stock
    const lowStockContainer = document.getElementById('lowStockList');
    if (stats.lowStock.length === 0) {
        lowStockContainer.innerHTML = '<p class="empty-state">المخزون جيد ✅</p>';
    } else {
        lowStockContainer.innerHTML = stats.lowStock.map(p => `
            <div class="card card-warning" onclick="navigateTo('Products')">
                <div class="card-header">
                    <span class="card-title">${p.name}</span>
                    <span class="badge badge-warning">${p.stock} ${p.unit || 'قطعة'}</span>
                </div>
            </div>
        `).join('');
    }
}
