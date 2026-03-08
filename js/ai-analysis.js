// ==========================================
// Premium AI Analysis - Groq Llama 3.3 70B
// ==========================================
// API key is fetched securely from Firebase Realtime Database at runtime
// Never stored in source code — safe for GitHub

const AI_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const AI_MODEL = 'llama-3.3-70b-versatile';
const PREMIUM_COOLDOWN_DAYS = 30;
const PREMIUM_STORAGE_KEY = 'tajer_premium_last_used';
const PREMIUM_GOLD_KEY = 'tajer_premium_gold';

// Cached key (fetched once per session)
let _cachedAIKey = null;

async function getAIKey() {
    if (_cachedAIKey) return _cachedAIKey;
    try {
        const keyData = await fbGet('config/ai_api_key');
        if (keyData) {
            _cachedAIKey = keyData;
            return _cachedAIKey;
        }
    } catch (e) {
        console.error('Failed to fetch AI key:', e);
    }
    return null;
}

// ==========================================
// Premium Access Control
// ==========================================
function getPremiumStatus() {
    const lastUsed = localStorage.getItem(PREMIUM_STORAGE_KEY);
    if (!lastUsed) return { available: true, daysRemaining: 0, lastUsed: null };
    const lastDate = new Date(lastUsed);
    const now = new Date();
    const diffDays = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));
    return {
        available: diffDays >= PREMIUM_COOLDOWN_DAYS,
        daysRemaining: Math.max(0, PREMIUM_COOLDOWN_DAYS - diffDays),
        lastUsed: lastDate.toISOString().split('T')[0]
    };
}

function isPremiumGoldActive() {
    try { return JSON.parse(localStorage.getItem(PREMIUM_GOLD_KEY))?.active === true; }
    catch { return false; }
}

async function activatePremiumGold(key) {
    try {
        const keyData = await fbGet(`premiumGoldKeys/${key}`);
        if (!keyData) { showToast('مفتاح غير صالح', 'error'); return false; }
        if (keyData.used) { showToast('المفتاح مستخدم بالفعل', 'error'); return false; }
        await fbUpdate(`premiumGoldKeys/${key}`, { used: true, usedAt: new Date().toISOString(), deviceId: getDeviceId() });
        localStorage.setItem(PREMIUM_GOLD_KEY, JSON.stringify({ active: true, key, activatedAt: new Date().toISOString() }));
        showToast('تم تفعيل Premium Gold بنجاح! 🌟');
        return true;
    } catch (e) {
        showToast('تعذر التحقق. تأكد من الاتصال بالإنترنت', 'error');
        return false;
    }
}

// ==========================================
// Data Collection & Enrichment Pipeline
// ==========================================
async function collectAnalysisData(fullData = false) {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const startStr = thirtyDaysAgo.toISOString().split('T')[0];
    const todayStr = now.toISOString().split('T')[0];

    const allOrders = await db.orders.toArray();
    const allOrderItems = await db.orderItems.toArray();
    const products = await db.products.toArray();
    const customers = await db.customers.toArray();
    const suppliers = await db.suppliers.toArray();
    const installments = await db.installments.toArray();
    const supplierPayments = await db.supplierPayments.toArray();
    const batches = await db.supplyBatches.toArray();

    const orders = fullData ? allOrders : allOrders.filter(o => o.date >= startStr);
    const orderItems = allOrderItems.filter(oi => orders.some(o => o.id === oi.orderId));

    // ═══ Core Financial Metrics ═══
    const totalSales = orderItems.reduce((s, i) => s + (i.total || 0), 0);
    const totalPaid = orderItems.filter(i => i.isPaid === 'yes').reduce((s, i) => s + (i.total || 0), 0);
    const totalCost = orderItems.reduce((s, i) => s + ((i.costPrice || 0) * (i.quantity || 0)), 0);
    const grossProfit = totalSales - totalCost;
    const totalRemaining = totalSales - totalPaid;

    // ═══ Calculated KPIs ═══
    const profitMarginPct = totalSales > 0 ? ((grossProfit / totalSales) * 100).toFixed(1) : 0;
    const collectionRate = totalSales > 0 ? ((totalPaid / totalSales) * 100).toFixed(1) : 0;
    const avgOrderValue = orders.length > 0 ? Math.round(totalSales / orders.length) : 0;
    const avgDailyRevenue = orders.length > 0 ? Math.round(totalSales / 30) : 0;

    // ═══ Product Deep Analysis ═══
    const productPerf = {};
    orderItems.forEach(item => {
        const key = item.productName || item.productId;
        if (!productPerf[key]) productPerf[key] = { qty: 0, revenue: 0, cost: 0 };
        productPerf[key].qty += item.quantity || 0;
        productPerf[key].revenue += item.total || 0;
        productPerf[key].cost += (item.costPrice || 0) * (item.quantity || 0);
    });

    const productAnalysis = Object.entries(productPerf).map(([name, d]) => {
        const profit = d.revenue - d.cost;
        const margin = d.revenue > 0 ? ((profit / d.revenue) * 100).toFixed(1) : 0;
        const revenueShare = totalSales > 0 ? ((d.revenue / totalSales) * 100).toFixed(1) : 0;
        return { name, qty: d.qty, revenue: d.revenue, cost: d.cost, profit, margin: `${margin}%`, revenueShare: `${revenueShare}%` };
    }).sort((a, b) => b.revenue - a.revenue);

    // ═══ Customer Deep Analysis (ABC) ═══
    const customerPerf = {};
    orders.forEach(o => {
        const cust = customers.find(c => c.id === o.customerId);
        if (!cust) return;
        if (!customerPerf[cust.name]) customerPerf[cust.name] = { orders: 0, total: 0, paid: 0, dates: [] };
        customerPerf[cust.name].orders++;
        customerPerf[cust.name].dates.push(o.date);
        const items = orderItems.filter(oi => oi.orderId === o.id);
        customerPerf[cust.name].total += items.reduce((s, i) => s + (i.total || 0), 0);
        customerPerf[cust.name].paid += items.filter(i => i.isPaid === 'yes').reduce((s, i) => s + (i.total || 0), 0);
    });

    const customerAnalysis = Object.entries(customerPerf).map(([name, d]) => {
        const remaining = d.total - d.paid;
        const payRate = d.total > 0 ? ((d.paid / d.total) * 100).toFixed(0) : 0;
        const avgOrder = d.orders > 0 ? Math.round(d.total / d.orders) : 0;
        const daysSorted = d.dates.sort();
        const lastPurchase = daysSorted[daysSorted.length - 1] || '';
        const revenueShare = totalSales > 0 ? ((d.total / totalSales) * 100).toFixed(1) : 0;
        return { name, orders: d.orders, total: d.total, paid: d.paid, remaining, payRate: `${payRate}%`, avgOrder, lastPurchase, revenueShare: `${revenueShare}%` };
    }).sort((a, b) => b.total - a.total);

    // ABC Classification
    let cumRevenue = 0;
    customerAnalysis.forEach(c => {
        cumRevenue += c.total;
        const pct = totalSales > 0 ? (cumRevenue / totalSales) * 100 : 0;
        c.class = pct <= 70 ? 'A' : pct <= 90 ? 'B' : 'C';
    });

    // ═══ Daily Sales Trend ═══
    const dailySales = {};
    orders.forEach(o => {
        if (!dailySales[o.date]) dailySales[o.date] = { count: 0, amount: 0 };
        dailySales[o.date].count++;
        dailySales[o.date].amount += orderItems.filter(oi => oi.orderId === o.id).reduce((s, i) => s + (i.total || 0), 0);
    });
    const dailyArr = Object.entries(dailySales).sort((a, b) => a[0].localeCompare(b[0]));
    const bestDay = dailyArr.length > 0 ? dailyArr.reduce((a, b) => a[1].amount > b[1].amount ? a : b) : null;
    const worstDay = dailyArr.length > 0 ? dailyArr.reduce((a, b) => a[1].amount < b[1].amount ? a : b) : null;

    // Weekly comparison
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - 7);
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const thisWeekSales = orders.filter(o => o.date >= thisWeekStart.toISOString().split('T')[0]).reduce((s, o) => {
        return s + orderItems.filter(oi => oi.orderId === o.id).reduce((ss, i) => ss + (i.total || 0), 0);
    }, 0);
    const lastWeekSales = orders.filter(o => o.date >= lastWeekStart.toISOString().split('T')[0] && o.date < thisWeekStart.toISOString().split('T')[0]).reduce((s, o) => {
        return s + orderItems.filter(oi => oi.orderId === o.id).reduce((ss, i) => ss + (i.total || 0), 0);
    }, 0);
    const weekGrowth = lastWeekSales > 0 ? (((thisWeekSales - lastWeekSales) / lastWeekSales) * 100).toFixed(1) : 'N/A';

    // ═══ Installments Risk Analysis ═══
    const unpaidInst = installments.filter(i => i.isPaid === 'no');
    const overdueInst = unpaidInst.filter(i => i.dueDate < todayStr);
    const upcomingInst = unpaidInst.filter(i => {
        const d = new Date(i.dueDate);
        const diff = (d - now) / (1000 * 60 * 60 * 24);
        return diff >= 0 && diff <= 14;
    });

    // ═══ Stock Analysis ═══
    const lowStockProducts = products.filter(p => p.lowStockAlert && (p.stock || 0) <= p.lowStockAlert);
    const outOfStockProducts = products.filter(p => (p.stock || 0) <= 0);
    const totalStockValue = products.reduce((s, p) => s + ((p.costPrice || 0) * (p.stock || 0)), 0);
    const totalStockRetail = products.reduce((s, p) => s + ((p.sellPrice || 0) * (p.stock || 0)), 0);
    const potentialProfit = totalStockRetail - totalStockValue;

    // ═══ Supplier Analysis ═══
    const supplierAnalysis = suppliers.map(s => {
        const sBatches = batches.filter(b => b.supplierId === s.id);
        const sPays = supplierPayments.filter(p => p.supplierId === s.id);
        const totalClaim = sBatches.reduce((sum, b) => sum + ((b.costPrice || 0) * (b.quantity || 0)), 0);
        const totalPaidSup = sPays.reduce((sum, p) => sum + (p.amount || 0), 0);
        const payRate = totalClaim > 0 ? ((totalPaidSup / totalClaim) * 100).toFixed(0) : 0;
        return { name: s.name, totalClaim, totalPaid: totalPaidSup, remaining: totalClaim - totalPaidSup, payRate: `${payRate}%`, batchCount: sBatches.length };
    });

    // ═══ Payment Type Distribution ═══
    const paymentTypes = { cash: 0, installment: 0, credit: 0, advance: 0 };
    orders.forEach(o => {
        const oTotal = orderItems.filter(oi => oi.orderId === o.id).reduce((s, i) => s + (i.total || 0), 0);
        if (o.paymentType === 'cash') paymentTypes.cash += oTotal;
        else if (o.paymentType === 'installment') paymentTypes.installment += oTotal;
        else if (o.paymentType === 'advance') paymentTypes.advance += oTotal;
        else paymentTypes.credit += oTotal;
    });

    // ═══ Top Combinations ═══
    const orderCombos = {};
    orders.forEach(o => {
        const items = orderItems.filter(oi => oi.orderId === o.id).map(oi => oi.productName).filter(Boolean);
        if (items.length >= 2) {
            for (let i = 0; i < items.length; i++) {
                for (let j = i + 1; j < items.length; j++) {
                    const combo = [items[i], items[j]].sort().join(' + ');
                    orderCombos[combo] = (orderCombos[combo] || 0) + 1;
                }
            }
        }
    });
    const topCombos = Object.entries(orderCombos).sort((a, b) => b[1] - a[1]).slice(0, 5);

    return {
        period: fullData ? 'جميع البيانات التاريخية' : `آخر 30 يوم (${startStr} إلى ${todayStr})`,
        financial: {
            totalSales, totalPaid, totalRemaining, totalCost, grossProfit,
            profitMarginPct: `${profitMarginPct}%`,
            collectionRate: `${collectionRate}%`,
            avgOrderValue, avgDailyRevenue,
            ordersCount: orders.length,
            customersCount: customers.length,
            productsCount: products.length
        },
        trends: {
            dailySales: dailyArr.slice(-14),
            bestDay: bestDay ? { date: bestDay[0], amount: bestDay[1].amount, orders: bestDay[1].count } : null,
            worstDay: worstDay ? { date: worstDay[0], amount: worstDay[1].amount, orders: worstDay[1].count } : null,
            thisWeekSales, lastWeekSales, weekGrowth: `${weekGrowth}%`
        },
        products: productAnalysis,
        customers: customerAnalysis,
        installments: {
            total: installments.length,
            unpaid: unpaidInst.length,
            overdue: overdueInst.length,
            overdueAmount: overdueInst.reduce((s, i) => s + (i.amount || 0), 0),
            upcoming: upcomingInst.length,
            upcomingAmount: upcomingInst.reduce((s, i) => s + (i.amount || 0), 0)
        },
        stock: {
            totalProducts: products.length,
            totalStockValue, totalStockRetail, potentialProfit,
            lowStock: lowStockProducts.map(p => ({ name: p.name, stock: p.stock, alert: p.lowStockAlert })),
            outOfStock: outOfStockProducts.map(p => p.name)
        },
        suppliers: supplierAnalysis,
        paymentTypes,
        topCombos
    };
}

// ==========================================
// Professional Analysis Prompt
// ==========================================
function buildAnalysisPrompt(data) {
    const f = data.financial;
    const t = data.trends;

    return `أنت محلل بيانات تجارية محترف ومستشار أعمال استراتيجي بخبرة 15 عاماً في قطاع التجزئة.

⚠️ تعليمات صارمة:
- اكتب بالعربية الفصحى فقط. لا تستخدم أي لغة أخرى.
- استخدم الأرقام والنسب المئوية في كل نقطة. لا تكن عاماً أبداً.
- اذكر أسماء الأصناف والعملاء بالتحديد.
- كل توصية يجب أن تكون قابلة للتنفيذ فوراً.
- استخدم الرموز التعبيرية لتنظيم الأقسام.
- التقرير يجب أن يكون شاملاً ومفصلاً (1500-2000 كلمة على الأقل).

═══════════════════════════════════════
📊 بيانات المتجر - ${data.period}
═══════════════════════════════════════

▸ الملخص المالي:
  إجمالي المبيعات: ${f.totalSales} | المحصّل: ${f.totalPaid} | المتبقي: ${f.totalRemaining}
  تكلفة البضاعة: ${f.totalCost} | إجمالي الربح: ${f.grossProfit}
  هامش الربح: ${f.profitMarginPct} | نسبة التحصيل: ${f.collectionRate}
  متوسط قيمة الطلب: ${f.avgOrderValue} | متوسط الإيراد اليومي: ${f.avgDailyRevenue}
  عدد الطلبات: ${f.ordersCount} | عدد العملاء: ${f.customersCount}

▸ اتجاه المبيعات الأسبوعي:
  هذا الأسبوع: ${t.thisWeekSales} | الأسبوع الماضي: ${t.lastWeekSales} | النمو: ${t.weekGrowth}
  أفضل يوم: ${t.bestDay ? `${t.bestDay.date} (${t.bestDay.amount})` : 'لا بيانات'}
  أضعف يوم: ${t.worstDay ? `${t.worstDay.date} (${t.worstDay.amount})` : 'لا بيانات'}

▸ المبيعات اليومية (آخر 14 يوم):
${t.dailySales.map(([date, d]) => `  ${date}: ${d.count} طلب × ${d.amount}`).join('\n')}

▸ أداء الأصناف (مرتبة بالإيراد):
${data.products.slice(0, 20).map((p, i) =>
        `  ${i + 1}. ${p.name}: إيراد ${p.revenue} | كمية ${p.qty} | ربح ${p.profit} | هامش ${p.margin} | حصة ${p.revenueShare}`
    ).join('\n')}

▸ تحليل العملاء (مرتبة بالإنفاق + تصنيف ABC):
${data.customers.slice(0, 15).map(c =>
        `  [${c.class}] ${c.name}: إجمالي ${c.total} | مدفوع ${c.paid} | متبقي ${c.remaining} | معدل سداد ${c.payRate} | ${c.orders} طلبات | متوسط الطلب ${c.avgOrder} | حصة ${c.revenueShare} | آخر شراء ${c.lastPurchase}`
    ).join('\n')}

▸ توزيع طرق الدفع:
  نقدي: ${data.paymentTypes.cash} | تقسيط: ${data.paymentTypes.installment} | آجل: ${data.paymentTypes.credit} | مقدم: ${data.paymentTypes.advance}

▸ الأصناف الأكثر شراءً معاً:
${data.topCombos.map(([combo, count]) => `  ${combo} (${count} مرة)`).join('\n') || '  لا بيانات كافية'}

▸ حالة الأقساط:
  إجمالي: ${data.installments.total} | غير مدفوع: ${data.installments.unpaid}
  متأخر: ${data.installments.overdue} (مبلغ: ${data.installments.overdueAmount})
  مستحق خلال 14 يوم: ${data.installments.upcoming} (مبلغ: ${data.installments.upcomingAmount})

▸ حالة المخزون:
  قيمة المخزون (بالتكلفة): ${data.stock.totalStockValue}
  قيمة المخزون (بالبيع): ${data.stock.totalStockRetail}
  الربح المحتمل من المخزون: ${data.stock.potentialProfit}
  منخفض: ${data.stock.lowStock.map(p => `${p.name}(${p.stock}/${p.alert})`).join(', ') || 'لا يوجد'}
  نفد: ${data.stock.outOfStock.join(', ') || 'لا يوجد'}

▸ حسابات الموردين:
${data.suppliers.map(s => `  ${s.name}: مطالبة ${s.totalClaim} | مسدد ${s.totalPaid} | متبقي ${s.remaining} | نسبة سداد ${s.payRate} | ${s.batchCount} دفعات`).join('\n')}

═══════════════════════════════════════
📋 المطلوب: قدم تقريراً احترافياً بالهيكل التالي بالضبط:
═══════════════════════════════════════

## 📋 الملخص التنفيذي
(فقرة واحدة مكثفة تلخص الوضع المالي والتشغيلي بجملتين أو ثلاث قوية. يجب أن تحتوي على الأرقام الرئيسية.)

## 📈 تحليل الإيرادات والنمو
(تحليل عميق لاتجاه المبيعات: هل ينمو أم يتراجع؟ مقارنة أسبوعية. ما أفضل وأسوأ الأيام ولماذا؟ توقع المبيعات للأسبوعين القادمين.)

## 💰 تحليل الربحية والهوامش
(ما هو هامش الربح الإجمالي؟ أي الأصناف لديها أعلى هامش وأيها أقل؟ كيف يمكن تحسين الهوامش؟ أعطِ أسماء أصناف محددة.)

## 👥 تصنيف العملاء وتحليل السلوك
(تحليل ABC مفصل. من هم العملاء الأكثر قيمة؟ من لديه مطالبات متأخرة؟ من يشتري بانتظام ومن توقف؟ ما استراتيجية التعامل مع كل فئة؟)

## 💵 تحليل التدفق النقدي والتحصيل
(نسبة التحصيل. المبالغ المعلقة. الأقساط المتأخرة. تقييم المخاطر الائتمانية. توصيات لتحسين التحصيل بأسماء عملاء محددين.)

## 📦 تحليل المخزون وسلسلة التوريد
(قيمة المخزون. الأصناف التي نفدت أو أوشكت. الربح المحتمل من المخزون الحالي. توصيات بإعادة الطلب من الموردين.)

## 🤝 تحليل علاقات الموردين
(تقييم كل مورد: حجم التعامل، نسبة السداد، التوصيات.)

## 🛒 تحليل سلة الشراء
(الأصناف التي تُشترى معاً. فرص البيع المتقاطع والبيع الإضافي.)

## ⚠️ المخاطر والتحذيرات العاجلة
(أي مشاكل تحتاج انتباه فوري: ديون متأخرة كبيرة، مخزون ناقص، عملاء مشكوك فيهم.)

## 🎯 خطة العمل الفورية (5 خطوات)
(5 إجراءات محددة وقابلة للتنفيذ هذا الأسبوع، كل إجراء يتضمن: ماذا، لمن، كم المتوقع.)

## 📊 لوحة مؤشرات الأداء
(جدول بـ 8-10 مؤشرات KPI مع القيمة الحالية والقيمة المستهدفة والتقييم (ممتاز/جيد/يحتاج تحسين).)

## 🔮 التوقعات والسيناريوهات
(3 سيناريوهات للشهر القادم: متفائل، متوقع، متشائم. مع أرقام محددة لكل سيناريو.)`;
}

// ==========================================
// API Call (Groq - key from Firebase)
// ==========================================
async function callAIAnalysis(prompt) {
    const apiKey = await getAIKey();
    if (!apiKey) {
        throw new Error('لم يتم العثور على مفتاح API. تأكد من إضافته في Firebase.');
    }

    const response = await fetch(AI_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: AI_MODEL,
            messages: [
                { role: 'system', content: 'أنت أفضل محلل بيانات تجارية في العالم العربي. تكتب تقارير ذكاء أعمال احترافية بالعربية الفصحى فقط. تقاريرك دقيقة ومفصلة ومدعومة بالأرقام والنسب المئوية. لا تستخدم أي لغة غير العربية. كل توصياتك عملية ومحددة بأسماء أصناف وعملاء.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.6,
            max_tokens: 8000
        })
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `API Error: ${response.status}`);
    }

    const result = await response.json();
    return result.choices?.[0]?.message?.content || 'لم يتم إنشاء تقرير';
}

// ==========================================
// Premium AI Banner (Reports Page)
// ==========================================
function renderAIBanner() {
    const status = getPremiumStatus();
    const isGold = isPremiumGoldActive();
    const owner = typeof isOwner === 'function' && isOwner();
    const container = document.getElementById('aiBannerContainer');
    if (!container) return;

    let statusText, btnDisabled;
    if (owner) {
        statusText = '🔓 وضع المالك — تحليل غير محدود';
        btnDisabled = '';
    } else if (isGold) {
        statusText = '👑 Gold نشط — تحليل غير محدود';
        btnDisabled = '';
    } else if (status.available) {
        statusText = '🎁 تحليلك المجاني متاح الآن!';
        btnDisabled = '';
    } else {
        statusText = `⏳ متبقي ${status.daysRemaining} يوم للتحليل القادم`;
        btnDisabled = 'opacity:0.5;pointer-events:none;';
    }

    container.innerHTML = `
        <div onclick="showPremiumModal()" style="background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 40%,#a855f7 100%);border-radius:var(--radius-lg);padding:16px 18px;margin-bottom:14px;cursor:pointer;position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(99,102,241,0.3)">
            <div style="position:absolute;top:-20px;left:-20px;width:80px;height:80px;background:rgba(255,255,255,0.08);border-radius:50%"></div>
            <div style="position:absolute;bottom:-15px;right:-15px;width:60px;height:60px;background:rgba(255,255,255,0.06);border-radius:50%"></div>
            <div style="display:flex;align-items:center;gap:12px;position:relative;z-index:1">
                <div style="font-size:2.2rem;animation:pulse 2s infinite">🤖</div>
                <div style="flex:1">
                    <div style="font-weight:800;font-size:1rem;color:white;margin-bottom:3px">تحليل الذكاء الاصطناعي</div>
                    <div style="font-size:0.72rem;color:rgba(255,255,255,0.85)">${statusText}</div>
                </div>
                <div style="background:rgba(255,255,255,0.2);backdrop-filter:blur(4px);padding:8px 14px;border-radius:20px;font-size:0.75rem;font-weight:700;color:white;${btnDisabled}">تحليل ←</div>
            </div>
        </div>
        <style>@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}</style>
    `;
}

// ==========================================
// UI — Premium Modal
// ==========================================
function showPremiumModal() {
    const status = getPremiumStatus();
    const isGold = isPremiumGoldActive();
    const owner = typeof isOwner === 'function' && isOwner();

    let statusHtml;
    if (owner) {
        statusHtml = `<div style="background:linear-gradient(135deg,#10b981,#059669);padding:16px;border-radius:var(--radius-md);color:white;text-align:center;margin-bottom:14px">
            <div style="font-size:2rem">🔓</div>
            <div style="font-weight:800;font-size:1.1rem">وضع المالك</div>
            <div style="font-size:0.78rem;opacity:0.9">تحليل غير محدود لجميع البيانات</div>
        </div>`;
    } else if (isGold) {
        statusHtml = `<div style="background:linear-gradient(135deg,#f59e0b,#d97706);padding:16px;border-radius:var(--radius-md);color:white;text-align:center;margin-bottom:14px">
            <div style="font-size:2rem">👑</div>
            <div style="font-weight:800;font-size:1.1rem">Premium Gold نشط</div>
            <div style="font-size:0.78rem;opacity:0.9">تحليل شامل لجميع البيانات التاريخية</div>
        </div>`;
    } else if (status.available) {
        statusHtml = `<div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:16px;border-radius:var(--radius-md);color:white;text-align:center;margin-bottom:14px">
            <div style="font-size:2rem">🎯</div>
            <div style="font-weight:800;font-size:1.1rem">التحليل الذكي متاح!</div>
            <div style="font-size:0.78rem;opacity:0.9">تقرير ذكاء أعمال احترافي لآخر 30 يوم</div>
        </div>`;
    } else {
        statusHtml = `<div style="background:var(--bg-card);padding:16px;border-radius:var(--radius-md);text-align:center;margin-bottom:14px;border:1px solid var(--border-color)">
            <div style="font-size:2rem">⏳</div>
            <div style="font-weight:700;color:var(--text-secondary)">التحليل غير متاح حالياً</div>
            <div style="font-size:0.78rem;color:#94a3b8">متبقي ${status.daysRemaining} يوم للاستخدام القادم</div>
            ${status.lastUsed ? `<div style="font-size:0.7rem;color:#64748b;margin-top:4px">آخر تقرير: ${status.lastUsed}</div>` : ''}
        </div>`;
    }

    const body = `
        <div style="max-height:70vh;overflow-y:auto;padding:4px">
            ${statusHtml}
            <div style="display:flex;gap:8px;margin-top:12px">
                <button class="btn btn-primary btn-block" style="padding:12px;font-size:0.85rem;font-weight:700" onclick="runAIAnalysis(false)" ${!status.available && !isGold && !owner ? 'disabled style="opacity:0.5;padding:12px"' : ''}>
                    🎯 تحليل آخر 30 يوم
                </button>
                ${isGold || owner ? `<button class="btn btn-block" style="background:linear-gradient(135deg,${owner ? '#10b981,#059669' : '#f59e0b,#d97706'});color:white;padding:12px;font-size:0.85rem;font-weight:700" onclick="runAIAnalysis(true)">
                    ${owner ? '🔓' : '👑'} تحليل شامل
                </button>` : ''}
            </div>
            ${!isGold ? `
            <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border-color)">
                <div style="font-size:0.8rem;font-weight:700;margin-bottom:8px">👑 ترقية لـ Premium Gold</div>
                <div style="display:flex;gap:8px">
                    <input type="text" id="premiumGoldKeyInput" class="input-field" placeholder="أدخل مفتاح Gold" style="direction:ltr;font-size:0.78rem">
                    <button class="btn btn-sm" style="background:linear-gradient(135deg,#f59e0b,#d97706);color:white;white-space:nowrap" onclick="activateGoldKey()">تفعيل</button>
                </div>
            </div>` : ''}
        </div>
    `;
    openModal('🤖 تحليل الذكاء الاصطناعي', body, '<button class="btn btn-ghost btn-block" onclick="closeModal()">إغلاق</button>');
}

async function activateGoldKey() {
    const key = document.getElementById('premiumGoldKeyInput').value.trim();
    if (!key) { showToast('أدخل المفتاح', 'error'); return; }
    const success = await activatePremiumGold(key);
    if (success) { closeModal(); setTimeout(() => showPremiumModal(), 300); }
}

// ==========================================
// Run Analysis
// ==========================================
async function runAIAnalysis(fullData = false) {
    const isGold = isPremiumGoldActive();
    const owner = typeof isOwner === 'function' && isOwner();
    if (!fullData && !isGold && !owner) {
        const status = getPremiumStatus();
        if (!status.available) {
            showToast(`التحليل غير متاح. متبقي ${status.daysRemaining} يوم`, 'error');
            return;
        }
    }

    closeModal();

    const loadingBody = `
        <div style="text-align:center;padding:40px 20px">
            <div style="font-size:3.5rem;animation:aiPulse 1.5s infinite">🤖</div>
            <div style="font-weight:800;margin-top:14px;font-size:1.1rem;color:var(--text-primary)">جاري إعداد تقرير ذكاء الأعمال...</div>
            <div style="color:#94a3b8;font-size:0.8rem;margin-top:8px">تحليل عميق لـ ${fullData ? 'جميع البيانات' : 'آخر 30 يوم'}</div>
            <div style="margin-top:20px;height:6px;background:var(--border-color);border-radius:6px;overflow:hidden">
                <div style="height:100%;background:linear-gradient(90deg,#6366f1,#a855f7,#6366f1);background-size:200%;animation:loadShimmer 2s linear infinite;width:0%;animation:loadBar 25s linear forwards,loadShimmer 2s linear infinite"></div>
            </div>
            <div style="margin-top:12px;font-size:0.7rem;color:#64748b">يتم تحليل الأصناف والعملاء والمبيعات والأقساط...</div>
        </div>
        <style>
            @keyframes loadBar{0%{width:0}70%{width:80%}100%{width:95%}}
            @keyframes loadShimmer{0%{background-position:200%}100%{background-position:-200%}}
            @keyframes aiPulse{0%,100%{transform:scale(1) rotate(0deg)}25%{transform:scale(1.1) rotate(-5deg)}75%{transform:scale(1.1) rotate(5deg)}}
        </style>
    `;
    openModal('🤖 جاري التحليل...', loadingBody, '');

    try {
        const data = await collectAnalysisData(fullData);
        const prompt = buildAnalysisPrompt(data);
        const report = await callAIAnalysis(prompt);

        // Mark as used only for non-Gold non-owner standard analysis
        if (!fullData && !isGold && !owner) {
            localStorage.setItem(PREMIUM_STORAGE_KEY, new Date().toISOString());
        }

        closeModal();
        showAnalysisReport(report, data);
    } catch (e) {
        closeModal();
        showToast('خطأ في التحليل: ' + e.message, 'error');
    }
}

// ==========================================
// Report Display — Premium Design
// ==========================================
function showAnalysisReport(report, data) {
    // Convert markdown to styled HTML
    let html = report
        .replace(/\*\*(.*?)\*\*/g, '<strong style="color:var(--text-primary)">$1</strong>')
        .replace(/^## (.*$)/gm, (_, title) => {
            const colors = { '📋': '#6366f1', '📈': '#10b981', '💰': '#f59e0b', '👥': '#06b6d4', '💵': '#22c55e', '📦': '#8b5cf6', '🤝': '#ec4899', '🛒': '#14b8a6', '⚠': '#ef4444', '🎯': '#f97316', '📊': '#3b82f6', '🔮': '#a855f7' };
            const emoji = title.substring(0, 2);
            const color = colors[emoji] || '#6366f1';
            return `<div style="margin:20px 0 10px;padding:10px 14px;background:linear-gradient(135deg,${color}15,${color}05);border-right:4px solid ${color};border-radius:0 var(--radius-md) var(--radius-md) 0"><h3 style="margin:0;font-size:0.95rem;font-weight:800;color:${color}">${title}</h3></div>`;
        })
        .replace(/^### (.*$)/gm, '<h4 style="color:var(--accent-info);margin:12px 0 6px;font-size:0.85rem;font-weight:700">$1</h4>')
        .replace(/^\|(.+)\|$/gm, (match) => {
            const cells = match.split('|').filter(c => c.trim());
            if (cells.every(c => c.trim().match(/^[-:]+$/))) return '';
            const tag = cells.every(c => c.trim().match(/^\*\*/)) ? 'th' : 'td';
            return '<tr>' + cells.map(c => `<${tag} style="padding:6px 8px;border:1px solid var(--border-color);font-size:0.72rem">${c.trim().replace(/\*\*/g, '')}</${tag}>`).join('') + '</tr>';
        })
        .replace(/(<tr>.*<\/tr>\n?)+/g, '<table style="width:100%;border-collapse:collapse;margin:8px 0;background:var(--bg-card);border-radius:var(--radius-sm)">$&</table>')
        .replace(/^[•\-\*] (.*$)/gm, '<li style="margin:4px 0;font-size:0.8rem;line-height:1.6">$1</li>')
        .replace(/(<li.*<\/li>\n?)+/g, '<ul style="padding-right:18px;margin:6px 0">$&</ul>')
        .replace(/\n{2,}/g, '<br>')
        .replace(/\n/g, '<br>');

    // Summary cards at top
    const f = data.financial;
    const summaryCards = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:16px">
            <div style="background:linear-gradient(135deg,#6366f115,#6366f105);border:1px solid #6366f130;border-radius:var(--radius-md);padding:10px;text-align:center">
                <div style="font-size:0.6rem;color:#94a3b8">إجمالي المبيعات</div>
                <div style="font-size:1rem;font-weight:800;color:#6366f1">${formatCurrency(f.totalSales)}</div>
            </div>
            <div style="background:linear-gradient(135deg,#10b98115,#10b98105);border:1px solid #10b98130;border-radius:var(--radius-md);padding:10px;text-align:center">
                <div style="font-size:0.6rem;color:#94a3b8">صافي الربح</div>
                <div style="font-size:1rem;font-weight:800;color:#10b981">${formatCurrency(f.grossProfit)}</div>
            </div>
            <div style="background:linear-gradient(135deg,#f59e0b15,#f59e0b05);border:1px solid #f59e0b30;border-radius:var(--radius-md);padding:10px;text-align:center">
                <div style="font-size:0.6rem;color:#94a3b8">هامش الربح</div>
                <div style="font-size:1rem;font-weight:800;color:#f59e0b">${f.profitMarginPct}</div>
            </div>
            <div style="background:linear-gradient(135deg,#06b6d415,#06b6d405);border:1px solid #06b6d430;border-radius:var(--radius-md);padding:10px;text-align:center">
                <div style="font-size:0.6rem;color:#94a3b8">نسبة التحصيل</div>
                <div style="font-size:1rem;font-weight:800;color:#06b6d4">${f.collectionRate}</div>
            </div>
        </div>
    `;

    const body = `
        <div style="max-height:75vh;overflow-y:auto;padding:4px;line-height:1.7">
            <div style="background:linear-gradient(135deg,#6366f1,#a855f7);padding:16px;border-radius:var(--radius-md);color:white;text-align:center;margin-bottom:16px">
                <div style="font-size:1.4rem;font-weight:800">🤖 تقرير ذكاء الأعمال</div>
                <div style="font-size:0.75rem;opacity:0.9;margin-top:4px">${data.period} | ${today()}</div>
                <div style="font-size:0.65rem;opacity:0.7;margin-top:2px">Powered by Llama 3.3 70B</div>
            </div>
            ${summaryCards}
            <div style="font-size:0.82rem">${html}</div>
        </div>
    `;

    const footer = `
        <button class="btn btn-ghost" onclick="closeModal()">إغلاق</button>
        <button class="btn btn-primary" onclick="copyReport()">📋 نسخ التقرير</button>
    `;

    openModal('🤖 تقرير ذكاء الأعمال', body, footer);
    window._lastAIReport = report;
}

function copyReport() {
    if (window._lastAIReport) {
        navigator.clipboard.writeText(window._lastAIReport).then(() => {
            showToast('تم نسخ التقرير ✅');
        }).catch(() => {
            const ta = document.createElement('textarea');
            ta.value = window._lastAIReport;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            showToast('تم نسخ التقرير ✅');
        });
    }
}

// ==========================================
// Owner: Premium Gold Key Management
// ==========================================
async function showGoldKeyManagement() {
    if (!isOwner()) { showToast('هذه الميزة للمالك فقط', 'error'); return; }

    let keysHtml = '<div style="text-align:center;color:#94a3b8;padding:20px">جاري التحميل...</div>';

    const body = `
        <div style="max-height:70vh;overflow-y:auto;padding:4px">
            <div style="background:linear-gradient(135deg,#f59e0b15,#f59e0b05);border:1px solid #f59e0b30;border-radius:var(--radius-md);padding:12px;margin-bottom:14px;font-size:0.75rem;line-height:1.6">
                <strong>👑 مفاتيح Premium Gold</strong><br>
                أنشئ مفاتيح للمستخدمين لتفعيل التحليل الذكي غير المحدود.
            </div>
            <button class="btn btn-block" style="background:linear-gradient(135deg,#f59e0b,#d97706);color:white;padding:12px;font-weight:700;margin-bottom:14px" onclick="generateAndShowGoldKey()">
                ✨ إنشاء مفتاح Gold جديد
            </button>
            <div id="goldKeysListContainer">${keysHtml}</div>
        </div>
    `;

    openModal('👑 إدارة مفاتيح Premium Gold', body, '<button class="btn btn-ghost btn-block" onclick="closeModal()">إغلاق</button>');

    // Load existing keys
    try {
        const keysData = await fbGet('premiumGoldKeys');
        const container = document.getElementById('goldKeysListContainer');
        if (!keysData || Object.keys(keysData).length === 0) {
            container.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:20px;font-size:0.8rem">لا توجد مفاتيح بعد</div>';
            return;
        }
        const keys = Object.entries(keysData);
        container.innerHTML = keys.map(([key, data]) => `
            <div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-md);padding:10px 12px;margin-bottom:8px">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
                    <code style="font-size:0.7rem;color:${data.used ? '#94a3b8' : '#f59e0b'};direction:ltr;flex:1;word-break:break-all">${key}</code>
                    <span style="font-size:0.65rem;padding:3px 8px;border-radius:10px;background:${data.used ? '#ef444420' : '#10b98120'};color:${data.used ? '#ef4444' : '#10b981'};white-space:nowrap">${data.used ? 'مستخدم' : 'متاح'}</span>
                </div>
                <div style="font-size:0.65rem;color:#64748b;margin-top:4px">
                    أُنشئ: ${data.created?.split('T')[0] || '-'}
                    ${data.used ? ` | فُعّل: ${data.usedAt?.split('T')[0] || '-'}` : ''}
                </div>
                <div style="display:flex;gap:6px;margin-top:6px">
                    <button class="btn btn-sm btn-outline" style="font-size:0.65rem" onclick="navigator.clipboard.writeText('${key}');showToast('تم نسخ المفتاح ✅')">📋 نسخ</button>
                    ${!data.used ? `<button class="btn btn-sm" style="font-size:0.65rem;background:#ef4444;color:white" onclick="revokeGoldKey('${key}')">🗑️ حذف</button>` : ''}
                </div>
            </div>
        `).join('');
    } catch (e) {
        document.getElementById('goldKeysListContainer').innerHTML = '<div style="color:#ef4444;text-align:center;padding:10px">خطأ في تحميل المفاتيح</div>';
    }
}

async function generateAndShowGoldKey() {
    try {
        const key = 'GOLD-' + Math.random().toString(36).substring(2, 8).toUpperCase() + '-' + Date.now().toString(36).toUpperCase();
        await fbSet(`premiumGoldKeys/${key}`, { created: new Date().toISOString(), used: false });
        showToast('تم إنشاء المفتاح ✅');
        // Refresh list
        showGoldKeyManagement();
    } catch (e) {
        showToast('خطأ: ' + e.message, 'error');
    }
}

async function revokeGoldKey(key) {
    const confirmed = await showConfirm('هل تريد حذف هذا المفتاح؟');
    if (!confirmed) return;
    try {
        await fbSet(`premiumGoldKeys/${key}`, null);
        showToast('تم حذف المفتاح');
        showGoldKeyManagement();
    } catch (e) {
        showToast('خطأ: ' + e.message, 'error');
    }
}

// Show Gold key section for owner in Settings
function initOwnerUI() {
    if (typeof isOwner === 'function' && isOwner()) {
        const goldSection = document.getElementById('goldKeySection');
        if (goldSection) goldSection.style.display = '';
        const gsheetSection = document.getElementById('gsheetSection');
        if (gsheetSection) gsheetSection.style.display = '';
    }
}
