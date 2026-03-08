// ==========================================
// Utility Functions
// ==========================================

// Get currency from settings or default
function getCurrency() {
    return window._settings?.currency || 'ر.س';
}

// Format currency
function formatCurrency(amount) {
    if (amount === null || amount === undefined || isNaN(amount)) return `0 ${getCurrency()}`;
    const num = parseFloat(amount);
    const formatted = num.toLocaleString('ar-SA', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    return `${formatted} ${getCurrency()}`;
}

// Format number
function formatNumber(num) {
    if (num === null || num === undefined || isNaN(num)) return '0';
    return parseFloat(num).toLocaleString('ar-SA');
}

// Format date
function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Format date short
function formatDateShort(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' });
}

// Get today's date as ISO string
function today() {
    return new Date().toISOString().split('T')[0];
}

// Get now as ISO string
function now() {
    return new Date().toISOString();
}

// Show toast notification
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast toast-${type}`;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 2500);
}

// Show confirm dialog
let _confirmResolve = null;
function showConfirm(message) {
    return new Promise(resolve => {
        _confirmResolve = resolve;
        document.getElementById('confirmMessage').textContent = message;
        document.getElementById('confirmDialog').classList.remove('hidden');
    });
}

function closeConfirm(result) {
    document.getElementById('confirmDialog').classList.add('hidden');
    if (_confirmResolve) {
        _confirmResolve(result);
        _confirmResolve = null;
    }
}

// Modal helpers
function openModal(title, bodyHTML, footerHTML) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = bodyHTML;
    document.getElementById('modalFooter').innerHTML = footerHTML || '';
    document.getElementById('modal').classList.remove('hidden');
    document.getElementById('modalOverlay').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('modal').classList.add('hidden');
    document.getElementById('modalOverlay').classList.add('hidden');
}

// Generate unique ID
function generateId() {
    return Date.now() + Math.floor(Math.random() * 1000);
}

// Calculate months array for installments
function calculateInstallments(totalAmount, months, startDate) {
    const installments = [];
    const monthlyAmount = Math.ceil((totalAmount / months) * 100) / 100;
    let remaining = totalAmount;

    for (let i = 0; i < months; i++) {
        const dueDate = new Date(startDate);
        dueDate.setMonth(dueDate.getMonth() + i); // Start from current month (i=0 = down payment)

        const amount = i === months - 1 ? remaining : monthlyAmount;
        remaining -= monthlyAmount;

        installments.push({
            amount: Math.round(amount * 100) / 100,
            dueDate: dueDate.toISOString().split('T')[0],
            isPaid: 'no',
            paidDate: null,
            label: i === 0 ? 'مقدم' : `قسط ${i}`
        });
    }
    return installments;
}

// Check if a date is overdue
function isOverdue(dateStr) {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date(today());
}

// Debounce function for search
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}
