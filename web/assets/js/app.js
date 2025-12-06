async function fetchJSON(url, opts){
  opts = opts || {};
  // include same-origin credentials by default so session cookies are sent
  if(!opts.credentials) opts.credentials = 'same-origin';
  const r = await fetch(url, opts);
  if(!r.ok) throw new Error('HTTP '+r.status);
  return r.json();
}

// Update the header auth button text/state based on `window.currentUser`
function updateAuthButton(){
  try{
    const b = document.getElementById('authBtn');
    if(!b) return;
    if(window.currentUser){
      b.textContent = 'Logout';
      b.classList.remove('btn-success');
      b.classList.add('btn-outline-danger');
    } else {
      b.textContent = 'Login';
      b.classList.remove('btn-outline-danger');
      b.classList.add('btn-success');
    }
  }catch(e){/* ignore */}
}

// Delegated sidebar click handler: ensures toggles and links work even if initDashboard
document.addEventListener('click', (ev)=>{
  try{
    const toggle = ev.target.closest && ev.target.closest('.sidebar-parent-toggle');
    if(toggle){
      const parent = toggle.closest('.sidebar-parent');
      if(parent){
        // accordion behaviour: close siblings
        document.querySelectorAll('#appSidebar .sidebar-parent').forEach(p=>{ if(p!==parent) p.classList.remove('open'); });
        parent.classList.toggle('open');
        // if opening, show sensible default child
        if(parent.classList.contains('open')){
          const dashboardLink = parent.querySelector('.sidebar-link[data-section="dashboard_daily_sales"]');
          const first = parent.querySelector('.sidebar-link');
          if(dashboardLink) showDashboardSection('dashboard_daily_sales');
          else if(first && first.dataset && first.dataset.section) showDashboardSection(first.dataset.section);
        }
        ev.preventDefault();
        return;
      }
    }
    const link = ev.target.closest && ev.target.closest('.sidebar-link');
    if(link){
      const sec = link.dataset ? link.dataset.section : null;
      if(sec){ ev.preventDefault(); showDashboardSection(sec); }
    }
  }catch(e){ /* swallow delegation errors */ }
});

// Hide admin-only sidebar menu items for non-admin users
function hideAdminMenuItems(){
  try{
    const isAdmin = window.currentUser && window.currentUser.role === 'admin';
    if(!isAdmin){
      const inventoryParent = Array.from(document.querySelectorAll('#appSidebar .sidebar-parent')).find(p => p.textContent.includes('Inventory'));
      const reportsParent = Array.from(document.querySelectorAll('#appSidebar .sidebar-parent')).find(p => p.textContent.includes('Reports'));
      const adminParent = Array.from(document.querySelectorAll('#appSidebar .sidebar-parent')).find(p => p.textContent.includes('Admin'));
      if(inventoryParent) inventoryParent.style.display = 'none';
      if(reportsParent) reportsParent.style.display = 'none';
      if(adminParent) adminParent.style.display = 'none';
    }
  }catch(e){ console.warn('hideAdminMenuItems failed', e); }
}

// Initialize dashboard UI: sidebar behaviour, data loaders, and logout wiring
async function initDashboard(){
  try{
    hideAdminMenuItems();
    initSidebarAccordion(); initSidebarCollapse();
    // ensure sidebar link clicks are bound (some environments may strip inline handlers)
    try{
      document.querySelectorAll('#appSidebar .sidebar-link').forEach(a=>{
        a.removeEventListener('click', a._boundClick);
        const handler = (ev)=>{ try{ ev.preventDefault(); const sec = a.dataset.section; if(sec) showDashboardSection(sec); }catch(e){} };
        a.addEventListener('click', handler);
        a._boundClick = handler;
      });
    }catch(e){}
    // load products into the new-order form and list
    try{ if(typeof loadProducts==='function') await loadProducts(); }catch(e){ console.warn('loadProducts failed', e); }
    try{ if(typeof loadProductsList==='function') await loadProductsList(); }catch(e){}
    // NOW wire the forms after products are loaded (forms must exist in DOM)
    try{ wireNewOrderForm(); }catch(e){ console.error('wireNewOrderForm failed', e); }
    try{ if(typeof wireProductForm === 'function') wireProductForm(); }catch(e){ console.error('wireProductForm failed', e); }
    // load sales/orders for admins or users as appropriate
    try{ if(typeof loadSales==='function') await loadSales(); }catch(e){}
    try{ if(typeof loadOrders==='function') await loadOrders(); }catch(e){}
    // load stock and related admin panels for admins; read-only views for users
    if(window.currentUser && window.currentUser.role === 'admin'){
      try{ if(typeof loadStock === 'function') await loadStock(); }catch(e){}
      try{ if(typeof loadWaterStock === 'function') await loadWaterStock(); }catch(e){}
      try{ if(typeof loadBottleStock === 'function') await loadBottleStock(); }catch(e){}
      try{ if(typeof loadRefillTracking === 'function') await loadRefillTracking(); }catch(e){}
      try{ if(typeof loadReportsStock === 'function') await loadReportsStock(); }catch(e){}
    } else {
      try{ if(typeof loadInventoryReadOnly === 'function') await loadInventoryReadOnly(); }catch(e){}
    }
    // wire single auth button in the header (toggles login/logout)
    try{
      const authBtn = document.getElementById('authBtn');
      if(authBtn){
        // avoid duplicate binding
        if(authBtn._bound) authBtn.removeEventListener('click', authBtn._bound);
        const handler = async ()=>{
          if(window.currentUser){
            try{ await fetch('/api/logout', {method:'POST'}); }catch(e){}
            window.currentUser = null;
            updateAuthButton();
            showView('home');
          } else {
            showView('login');
          }
        };
        authBtn.addEventListener('click', handler);
        authBtn._bound = handler;
        // ensure button text matches current state
        updateAuthButton();
      }
    }catch(e){}
    // Show default dashboard section
    try{ showDashboardSection('dashboard_daily_sales'); }catch(e){}
  }catch(e){ console.error('initDashboard', e); }
}

// initialize sidebar accordion behavior (call after sidebar exists)
function initSidebarAccordion(){
  try{
    const parents = Array.from(document.querySelectorAll('#appSidebar .sidebar-parent'));
    parents.forEach(p=>{
      const toggle = p.querySelector('.sidebar-parent-toggle');
      if(!toggle) return;
        toggle.addEventListener('click', ()=>{
          // close other parents (accordion behaviour)
          parents.forEach(x=>{ if(x !== p) x.classList.remove('open'); });
          // toggle this one
          const willOpen = !p.classList.contains('open');
          p.classList.toggle('open');
          // If opening Dashboard, show Daily Sales by default
          try{
            if(willOpen){
              const dashboardLink = p.querySelector('.sidebar-link[data-section="dashboard_daily_sales"]');
              const firstLink = p.querySelector('.sidebar-link');
              if(dashboardLink){
                showDashboardSection('dashboard_daily_sales');
              } else if(firstLink){
                const sec = firstLink.dataset.section;
                if(sec) showDashboardSection(sec);
              }
            }
          }catch(e){}
        });
    });
  }catch(e){ /* ignore init errors */ }
}

// Sidebar collapse/expand behavior
function initSidebarCollapse(){
  try{
    const sidebar = document.getElementById('appSidebar');
    const btn = document.getElementById('sidebarCollapseBtn');
    if(!sidebar || !btn) return;
    // set initial ARIA
    btn.setAttribute('aria-pressed', sidebar.classList.contains('collapsed'));
    btn.addEventListener('click', ()=>{
      const collapsed = sidebar.classList.toggle('collapsed');
      if(collapsed){ document.body.classList.add('sidebar-collapsed'); sidebar.classList.remove('expanded'); } else { document.body.classList.remove('sidebar-collapsed'); sidebar.classList.add('expanded'); }
      btn.setAttribute('aria-pressed', collapsed);
      // re-create water drops if needed (harmless)
      try{ createWaterDrops(10); }catch(e){}
    });
  }catch(e){ /* ignore */ }
}

// Single-view helpers: move a card into a temporary full-width container so the user
// Single-view helpers: show only the requested card in the right column without
// moving DOM nodes. This keeps event listeners and bindings intact while hiding
// other cards and the left column.
function enterSingleView(cardId){
  try{
    const leftCol = document.querySelector('.row > .col-md-4');
    const rightCol = document.querySelector('.row > .col-md-8');
    const target = document.getElementById(cardId);
    if(!target) return;
    // if the target is inside the left column, show left-only single view
    if(leftCol && leftCol.contains(target)){
      // hide right column children
      if(rightCol) Array.from(rightCol.children).forEach(ch=> ch.style.display = 'none');
      // ensure left column is visible
      if(leftCol) leftCol.style.display = '';
      document.body.classList.remove('dashboard-single-view-right');
      document.body.classList.add('dashboard-single-view-left');
    } else {
      // target is in right column: hide left column and show only the target in right column
      if(leftCol) leftCol.style.display = 'none';
      if(!rightCol) return;
      Array.from(rightCol.children).forEach(ch=>{ ch.style.display = (ch.id === cardId) ? 'block' : 'none'; });
      document.body.classList.remove('dashboard-single-view-left');
      document.body.classList.add('dashboard-single-view-right');
    }
  }catch(e){ console.error('enterSingleView', e); }
}

function exitSingleView(){
  try{
    const leftCol = document.querySelector('.row > .col-md-4');
    const rightCol = document.querySelector('.row > .col-md-8');
    if(leftCol) leftCol.style.display = '';
    if(rightCol) Array.from(rightCol.children).forEach(ch=> ch.style.display = '');
    document.body.classList.remove('dashboard-single-view-right');
    document.body.classList.remove('dashboard-single-view-left');
  }catch(e){ console.error('exitSingleView', e); }
}

// show specific dashboard section with new menu structure
function showDashboardSection(name){
  console.log('showDashboardSection called with:', name);
  // hide all content cards
  const allCardIds = [
    // Legacy
    'newOrderCard','productsCard','salesCard','ordersCard','dailySummaryCard','waterStockCard','bottleStockCard','refillTrackingCard',
    'stockCard','uploadSectionCard',
    // New structure
    'dashboardDailySalesCard','dashboardWaterVolumeCard','dashboardRevenueCard',
    'salesNewOrderCard','salesMyOrdersCard',
    'inventoryWaterStockCard','inventoryBottleStockCard',
    'reportsDailySalesCard','reportsWeeklySalesCard','reportsMonthlySalesCard','reportsInventoryCard','reportsPLCard',
    'adminManagePricesCard',
    // Legacy reports
    'reportsDailyCard','reportsStockCard'
  ];
  allCardIds.forEach(id=>{ const el = document.getElementById(id); if(el) el.style.display='none'; });
  
  // update active link styling
  try{
    document.querySelectorAll('#appSidebar .sidebar-link').forEach(a=>a.classList.remove('active'));
    const link = document.querySelector(`#appSidebar .sidebar-link[data-section="${name}"]`);
    if(link) link.classList.add('active');
    // open parent for the active link
    try{
      document.querySelectorAll('#appSidebar .sidebar-parent').forEach(p=>p.classList.remove('open'));
      if(link){
        const parent = link.closest('.sidebar-parent');
        if(parent) parent.classList.add('open');
      }
    }catch(e){}
  }catch(e){}

  // Route to appropriate section
  const cardMap = {
    // Dashboard
    'dashboard_daily_sales': { card: 'dashboardDailySalesCard', load: ()=>loadDailySummary() },
    'dashboard_water_volume': { card: 'dashboardWaterVolumeCard', load: ()=>loadWaterVolume() },
    'dashboard_revenue': { card: 'dashboardRevenueCard', load: ()=>loadRevenueChart() },
    // Sales
    'sales_new_order': { card: 'salesNewOrderCard', load: ()=>loadNewOrderForm() },
    'sales_my_orders': { card: 'salesMyOrdersCard', load: ()=>loadMyOrders() },
    // Inventory
    'inventory_water_stock': { card: 'inventoryWaterStockCard', load: ()=>loadWaterStock() },
    'inventory_bottle_stock': { card: 'inventoryBottleStockCard', load: ()=>loadBottleStock() },
    // Reports
    'reports_daily_sales': { card: 'reportsDailySalesCard', load: ()=>loadReportsDaily() },
    'reports_weekly_sales': { card: 'reportsWeeklySalesCard', load: ()=>loadReportsWeekly() },
    'reports_monthly_sales': { card: 'reportsMonthlySalesCard', load: ()=>loadReportsMonthly() },
    'reports_inventory': { card: 'reportsInventoryCard', load: ()=>loadReportsStock() },
    'reports_pl': { card: 'reportsPLCard', load: ()=>loadPLSummary() },
    // Admin
    'admin_manage_prices': { card: 'adminManagePricesCard', load: ()=>loadAdminManagePrices() }
  };

  const config = cardMap[name];
  console.log('cardMap config for', name, ':', config);
  if(config && config.card){
    const card = document.getElementById(config.card);
    console.log('Found card element:', card);
    if(card) {
      card.style.display = 'block';
      console.log('Set card display to block');
    }
    try{ config.load(); }catch(e){ console.error('Failed to load section:', name, e); }
  }
}

// Show dashboard if user is authenticated
async function showDashboardIfAuthed(){
  try{
    const r = await fetch('/api/whoami');
    if(r.ok){
      const j = await r.json();
      // API returns { user: { ... } } — normalize to the inner user object
      const u = j && j.user ? j.user : j;
      window.currentUser = u;
      // reflect auth state in the header
      try{ updateAuthButton(); }catch(e){}
      showView('dashboard');
      await initDashboard();
    }
  }catch(e){ console.error('showDashboardIfAuthed', e); }
}

// on page load, if the URL has #dashboard or user has a session, try to show dashboard
document.addEventListener('DOMContentLoaded', async ()=>{
  try{
    // if hash requests dashboard, or default to checking session to auto-open dashboard
    if(window.location.hash === '#dashboard'){
      await showDashboardIfAuthed();
      return;
    }
    // try quietly to see if user is logged in; if yes, show dashboard
    const r = await fetch('/api/whoami');
    if(r.ok){
      await showDashboardIfAuthed();
    }
  }catch(e){ /* ignore - user not logged in */ }
});

// As a fallback, ensure sidebar elements have direct handlers in case delegation fails
document.addEventListener('DOMContentLoaded', ()=>{
  try{
    setTimeout(()=>{
      const parents = document.querySelectorAll('#appSidebar .sidebar-parent-toggle');
      parents.forEach(btn=>{
        // avoid double-binding
        if(btn._bound) return; btn._bound = true;
        btn.addEventListener('click', (ev)=>{
          try{
            const p = btn.closest('.sidebar-parent');
            if(!p) return;
            document.querySelectorAll('#appSidebar .sidebar-parent').forEach(x=>{ if(x!==p) x.classList.remove('open'); });
            p.classList.toggle('open');
            // open first child section when expanding
            if(p.classList.contains('open')){
              const first = p.querySelector('.sidebar-link');
              if(first && first.dataset && first.dataset.section) showDashboardSection(first.dataset.section);
            }
          }catch(e){ console.error('sidebar parent toggle handler', e); }
        });
      });
      const links = document.querySelectorAll('#appSidebar .sidebar-link');
      links.forEach(a=>{
        if(a._bound) return; a._bound = true;
        a.addEventListener('click', (ev)=>{ try{ ev.preventDefault(); const sec = a.dataset.section; if(sec) showDashboardSection(sec); }catch(e){} });
      });
    }, 120);
  }catch(e){ console.error('sidebar fallback binding failed', e); }
});

async function loadSales(){
  try{
    // guard: only admins should load and render the sales graph
    if(!(window.currentUser && window.currentUser.role === 'admin')){
      // clear any existing content to be safe
      const el = document.getElementById('salesList'); if(el) el.innerHTML = '<p class="muted">Sales are available to administrators only.</p>';
      return;
    }
    const date = (document.getElementById('salesDate') && document.getElementById('salesDate').value) || null;
    const url = date ? `/api/orders?date=${encodeURIComponent(date)}` : '/api/orders';
    const sales = await fetchJSON(url);
    const el = document.getElementById('salesList');
    el.innerHTML = '';
    // Prepare aggregated data by date (YYYY-MM-DD) and by payment method
    const totalsCashByDate = {};
    const totalsMpesaByDate = {};
    const qtyByDate = {};
    (sales || []).forEach(s => {
      const d = (s.timestamp || '').slice(0,10) || new Date().toISOString().slice(0,10);
      const t = parseFloat(s.total || 0);
      const q = parseFloat(s.quantity || 0);
      const pm = (s.payment_method || '').toLowerCase();
      if(pm === 'mpesa' || pm === 'm-pesa' || pm === 'm pesa'){
        totalsMpesaByDate[d] = (totalsMpesaByDate[d] || 0) + t;
      } else {
        // treat everything else as cash
        totalsCashByDate[d] = (totalsCashByDate[d] || 0) + t;
      }
      qtyByDate[d] = (qtyByDate[d] || 0) + q;
    });
    // produce sorted date list (union of keys)
    const datesSet = new Set([...Object.keys(totalsCashByDate), ...Object.keys(totalsMpesaByDate), ...Object.keys(qtyByDate)]);
    const dates = Array.from(datesSet).sort();
    // build chart area
    const chartWrap = document.createElement('div'); chartWrap.className = 'sales-chart-wrapper';
    const canvas = document.createElement('canvas'); canvas.id = 'salesChartCanvas'; canvas.className = 'sales-chart';
    chartWrap.appendChild(canvas);
    el.appendChild(chartWrap);
    // compute period totals
    const totalCash = Object.values(totalsCashByDate).reduce((a,b)=>a+b,0);
    const totalMpesa = Object.values(totalsMpesaByDate).reduce((a,b)=>a+b,0);
    const totalAmount = totalCash + totalMpesa;
    const totalQty = Object.values(qtyByDate).reduce((a,b)=>a+b,0);
    // summary: show cash, mpesa and total amount
    const summary = document.createElement('div'); summary.className = 'mb-2';
    summary.innerHTML = `<div class="muted">Period: <strong>${dates[0]||'-'}</strong> to <strong>${dates[dates.length-1]||'-'}</strong> — Units: <strong>${totalQty}</strong> • Cash: <strong>${totalCash.toFixed(2)} KSH</strong> • Mpesa: <strong>${totalMpesa.toFixed(2)} KSH</strong> • <strong>Total amount: ${totalAmount.toFixed(2)} KSH</strong></div>`;
    el.insertBefore(summary, chartWrap);
    // create chart data for payment method curves
    const labels = dates;
    const dataCash = labels.map(d=>parseFloat((totalsCashByDate[d]||0).toFixed(2)));
    const dataMpesa = labels.map(d=>parseFloat((totalsMpesaByDate[d]||0).toFixed(2)));
    const dataTotal = labels.map((d,i)=>parseFloat(((dataCash[i]||0) + (dataMpesa[i]||0)).toFixed(2)));
    // render Chart.js line chart (destroy previous if exists)
    try{ if(window.salesChart) { window.salesChart.destroy(); window.salesChart = null; } }catch(e){}
    const ctx = canvas.getContext('2d');
    window.salesChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          { label: 'Cash', data: dataCash, borderColor: '#0ea5b7', backgroundColor: 'rgba(14,165,183,0.06)', tension: 0.28, fill: false },
          { label: 'Mpesa', data: dataMpesa, borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.06)', tension: 0.28, fill: false },
          { label: 'Total amount', data: dataTotal, borderColor: '#1d4ed8', backgroundColor: 'rgba(29,78,216,0.06)', tension: 0.28, borderDash: [6,4], fill: false }
        ]
      },
      options: {
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { position: 'top' } },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'KSH' } }
        }
      }
    });
  }catch(e){ console.error(e); }
}

async function loadOrders(){
  // for this simple prototype orders and sales are same
  try{
    const date = (document.getElementById('ordersDate') && document.getElementById('ordersDate').value) || null;
    const url = date ? `/api/orders?date=${encodeURIComponent(date)}` : '/api/orders';
    const orders = await fetchJSON(url);
    const el = document.getElementById('ordersList');
    el.innerHTML = '';
    const wrapper = document.createElement('div'); wrapper.className = 'table-wrapper';
    const table = document.createElement('table'); table.className = 'modern-table';
    const thead = document.createElement('thead');
    thead.innerHTML = `<tr><th style="width:64px">#</th><th>Date</th><th>Product</th><th style="width:90px">Qty</th><th style="width:110px">Unit</th><th style="width:110px">Total</th><th style="width:120px">Payment</th><th style="width:120px">Created By</th></tr>`;
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    (orders || []).forEach(o=>{
      const tr = document.createElement('tr');
      const createdBy = o.created_by_name || o.created_by_username || o.created_by || '';
      const date = (o.timestamp || '').replace('T',' ').replace('Z','');
      // action button to view details in modal
      const viewBtn = `<button class="btn btn-sm btn-outline-primary" onclick='(function(){ window.showOrderDetails(${JSON.stringify(o).replaceAll("'","\\'")}); })()'>View</button>`;
      tr.innerHTML = `<td class="muted">${o.id}</td><td class="muted">${date}</td><td><strong>${o.product_name || ''}</strong></td><td>${parseFloat(o.quantity || 0)}</td><td>${parseFloat(o.unit_price || 0).toFixed(2)} KSH</td><td><strong>${parseFloat(o.total || 0).toFixed(2)} KSH</strong></td><td class="muted">${o.payment_method || ''}</td><td class="muted">${createdBy}</td><td>${viewBtn}</td>`;
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrapper.appendChild(table);
    el.appendChild(wrapper);
  }catch(e){ console.error(e); }
}

async function loadMyOrders(){
  // Load orders for current user (backend filters automatically)
  try{
    const date = (document.getElementById('myOrdersDate') && document.getElementById('myOrdersDate').value) || null;
    const typeFilter = (document.getElementById('myOrdersTypeFilter') && document.getElementById('myOrdersTypeFilter').value) || null;
    const url = date ? `/api/orders?date=${encodeURIComponent(date)}` : '/api/orders';
    const orders = await fetchJSON(url);
    const el = document.getElementById('salesMyOrdersBody');
    if(!el) return;
    
    // Filter orders based on product type
    let filteredOrders = orders;
    if(typeFilter){
      filteredOrders = orders.filter(o => {
        const productName = (o.product_name || '').toLowerCase();
        const bottlesUsed = parseInt(o.bottles_used || 0);
        const bottlePrice = parseFloat(o.bottle_price || 0);
        if(typeFilter === 'water'){
          // water orders are product names containing 'water' and not empty/bottle-only orders
          return (productName.includes('water') && !productName.includes('bottle')) && bottlesUsed === 0 && bottlePrice === 0;
        } else if(typeFilter === 'bottle'){
          // include explicit bottle products and any sale that consumed bottles or included a bottle price
          return productName.includes('bottle') || productName.includes('empty') || bottlesUsed > 0 || bottlePrice > 0;
        }
        return true;
      });
    }
    
    el.innerHTML = '';
    const wrapper = document.createElement('div'); wrapper.className = 'table-wrapper';
    const table = document.createElement('table'); table.className = 'modern-table';
    const thead = document.createElement('thead');
    thead.innerHTML = `<tr><th style="width:64px">#</th><th>Date</th><th>Product</th><th style="width:90px">Qty</th><th style="width:110px">Unit</th><th style="width:110px">Total</th><th style="width:120px">Payment</th><th style="width:100px">Actions</th></tr>`;
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    if(!filteredOrders || !filteredOrders.length){ tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No orders found.</td></tr>'; }
    else {
      filteredOrders.forEach(o=>{
        const tr = document.createElement('tr');
        const date = (o.timestamp || '').replace('T',' ').replace('Z','');
        const viewBtn = `<button class="btn btn-sm btn-outline-primary" onclick='(function(){ window.showOrderDetails(${JSON.stringify(o).replaceAll("'","\\'")}); })()'>View</button>`;
        tr.innerHTML = `<td class="muted">${o.id}</td><td class="muted">${date}</td><td><strong>${o.product_name || ''}</strong></td><td>${parseFloat(o.quantity || 0)}</td><td>${parseFloat(o.unit_price || 0).toFixed(2)} KSH</td><td><strong>${parseFloat(o.total || 0).toFixed(2)} KSH</strong></td><td class="muted">${o.payment_method || ''}</td><td>${viewBtn}</td>`;
        tbody.appendChild(tr);
      });
    }
    table.appendChild(tbody);
    wrapper.appendChild(table);
    el.appendChild(wrapper);
  }catch(e){ console.error('loadMyOrders error:', e); }
}

async function loadDailySummary(){
  try{
    // For richer breakdown (cash vs mpesa), fetch orders for the date and aggregate client-side.
    const date = (document.getElementById('dailyDate') && document.getElementById('dailyDate').value) || null;
    const url = date ? `/api/orders?date=${encodeURIComponent(date)}` : '/api/orders';
    const orders = await fetchJSON(url);
    const el = document.getElementById('dailySummary');
    // aggregate
    let qty = 0; let cash = 0; let mpesa = 0;
    (orders || []).forEach(o=>{
      const amt = parseFloat(o.total || 0);
      qty += parseFloat(o.quantity || 0);
      const pm = (o.payment_method || '').toLowerCase();
      if(pm === 'mpesa' || pm === 'm-pesa' || pm === 'm pesa') mpesa += amt; else cash += amt;
    });
    const total = cash + mpesa;
    if(el){
      el.innerHTML = `<p>Total water sold: <strong>${qty.toFixed(2)}</strong> L</p><p>Cash: <strong>${cash.toFixed(2)} KSH</strong> • Mpesa: <strong>${mpesa.toFixed(2)} KSH</strong></p><p><strong>Total amount: ${total.toFixed(2)} KSH</strong></p>`;
    }
    // also populate the dashboard daily sales card body if present
    try{
      const dbody = document.getElementById('dashboardDailySalesBody');
      if(dbody){
        dbody.innerHTML = `
          <div style="padding:12px">
            <div style="font-size:1.05rem; font-weight:700; margin-bottom:6px">Today's totals</div>
            <div style="display:flex;gap:12px;flex-wrap:wrap">
              <div style="flex:1; min-width:160px; background:rgba(255,255,255,0.04); padding:10px; border-radius:8px">
                <div style="font-size:0.85rem; color:#cfeff9">Total litres</div>
                <div style="font-size:1.1rem; font-weight:700">${qty.toFixed(2)} L</div>
              </div>
              <div style="flex:1; min-width:160px; background:rgba(255,255,255,0.04); padding:10px; border-radius:8px">
                <div style="font-size:0.85rem; color:#cfeff9">Total amount</div>
                <div style="font-size:1.1rem; font-weight:700">${total.toFixed(2)} KSH</div>
              </div>
            </div>
            <div style="margin-top:10px; color:#dff6fb">Cash: ${cash.toFixed(2)} KSH • Mpesa: ${mpesa.toFixed(2)} KSH</div>
          </div>`;
      }
    }catch(e){}
    // update sidebar quick stats if present
    const sbSales = document.getElementById('sidebarSales');
    const sbAmt = document.getElementById('sidebarAmount');
    if(sbSales) sbSales.textContent = qty;
    if(sbAmt) sbAmt.textContent = total.toFixed(2) + ' KSH';
    // also populate reports panel if present
    try{
      const rBody = document.getElementById('reportsDailyBody') || document.getElementById('reportsDailySalesBody');
      if(rBody){
        rBody.innerHTML = `<p>Total units: <strong>${qty.toFixed(2)} L</strong></p><p>Cash: <strong>${cash.toFixed(2)} KSH</strong> • Mpesa: <strong>${mpesa.toFixed(2)} KSH</strong> • <strong>Total: ${total.toFixed(2)} KSH</strong>`;
      }
    }catch(e){}
  }catch(e){ console.error(e); }
}

// -- Inventory / reports quick loaders --
async function loadWaterStock(){
  const el = document.getElementById('inventoryWaterStockBody'); if(!el) return;
  el.innerHTML = 'Loading water stock...';
  try{
    const sources = await fetchJSON('/api/sources').catch(()=>[]);
    // Build UI: add tank form + table
    el.innerHTML = `
      <div class="mb-3 d-flex gap-2 align-items-center">
        <input id="wsName" class="form-control" placeholder="Tank name (e.g. Tank 1)" style="max-width:260px" />
        <input id="wsQty" class="form-control" placeholder="Quantity (L)" style="max-width:160px" type="number" step="0.01" />
        <button id="wsAddBtn" class="btn btn-primary">Add Tank</button>
      </div>
      <div id="wsTableWrap">Loading...</div>
    `;

    async function refresh(){
      const list = await fetchJSON('/api/sources').catch(()=>[]);
      const wrap = document.getElementById('wsTableWrap'); wrap.innerHTML = '';
      if(!list || !list.length){
        const info = document.createElement('div'); info.className = 'text-muted';
        info.innerHTML = 'No tanks found. Add one using the form above.';
        wrap.appendChild(info);
        return;
      }
      const tbl = document.createElement('table'); tbl.className = 'modern-table';
      tbl.innerHTML = '<thead><tr><th>Tank Name</th><th style="width:120px">Quantity (L)</th><th style="width:160px">Last Updated</th><th style="width:140px">Actions</th></tr></thead>';
      const tbody = document.createElement('tbody');
      (list||[]).forEach(s=>{
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><strong>${s.name}</strong></td><td>${parseFloat(s.quantity||0).toFixed(2)}</td><td class='muted'>${(s.last_updated||'').replace('T',' ').slice(0,16)}</td><td><button class="btn btn-sm btn-outline-primary ws-edit">Edit</button> <button class="btn btn-sm btn-outline-danger ws-del">Delete</button></td>`;
        // wire actions
        setTimeout(()=>{
          const editBtn = tr.querySelector('.ws-edit');
          const delBtn = tr.querySelector('.ws-del');
          editBtn.addEventListener('click', async ()=>{
            const name = prompt('Tank name', s.name); if(name===null) return;
            const qtyStr = prompt('Quantity (L)', String(s.quantity || 0)); if(qtyStr===null) return;
            const qty = parseFloat(qtyStr||0);
            try{ await fetchJSON(`/api/sources/${s.id}`, {method:'PUT', headers:{'content-type':'application/json'}, body: JSON.stringify({name, quantity: qty})}); await refresh(); }catch(e){ alert('Update failed'); }
          });
          delBtn.addEventListener('click', async ()=>{
            if(!confirm('Delete tank '+s.name+'?')) return; try{ await fetchJSON(`/api/sources/${s.id}`, {method:'DELETE'}); await refresh(); }catch(e){ alert('Delete failed'); }
          });
        },0);
        tbody.appendChild(tr);
      });
      tbl.appendChild(tbody); wrap.appendChild(tbl);
    }

    // wire add
    document.getElementById('wsAddBtn').addEventListener('click', async (ev)=>{
      ev.preventDefault(); const name = document.getElementById('wsName').value.trim(); const qty = parseFloat(document.getElementById('wsQty').value || 0);
      if(!name){ alert('Name required'); return; }
      try{ await fetchJSON('/api/sources', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({name, quantity: qty})}); document.getElementById('wsName').value=''; document.getElementById('wsQty').value=''; await refresh(); }catch(e){ alert('Create failed: '+(e.message||e)); }
    });

    // initial refresh
    await refresh();
  }catch(e){ console.error('loadWaterStock', e); el.innerHTML = '<div class="alert alert-danger">Failed to load water stock: ' + (e.message||e) + '</div>'; }
}

// Dashboard helper: show total water volume across tanks and breakdown per tank
async function loadWaterVolume(){
  const el = document.getElementById('dashboardWaterVolumeBody'); if(!el) return;
  el.innerHTML = 'Loading water volumes...';
  try{
    const sources = await fetchJSON('/api/sources').catch(()=>[]);
    if(!sources || !sources.length){ el.innerHTML = '<div class="text-muted">No tanks found.</div>'; return; }
    const total = (sources||[]).reduce((s,x)=>s + parseFloat(x.quantity||0), 0);
    const parts = sources.map(s=>`<div style="display:flex;justify-content:space-between;padding:6px 8px;border-radius:6px;background:rgba(255,255,255,0.02);margin-bottom:6px"><div><strong>${s.name}</strong><div class="muted small">${s.unit||'L'}</div></div><div style="text-align:right"><strong>${parseFloat(s.quantity||0).toFixed(2)}</strong><div class="muted small">${s.last_updated? s.last_updated.replace('T',' ').slice(0,16):''}</div></div></div>`).join('');
    el.innerHTML = `<div style="padding:10px"><div style="font-size:1.05rem;font-weight:700;margin-bottom:6px">Total water in tanks</div><div style="font-size:1.25rem;font-weight:800;color:#7dd3fc">${total.toFixed(2)} L</div><div style="margin-top:10px">${parts}</div></div>`;
  }catch(e){ console.error('loadWaterVolume', e); el.innerHTML = '<div class="text-danger">Failed to load water volume</div>'; }
}

async function loadBottleStock(){
  const body = document.getElementById('inventoryBottleStockBody'); if(!body) return;
  body.innerHTML = 'Loading bottle stock...';
  try{
    // UI: initialize default bottles if none exist
    body.innerHTML = `
      <div class="mb-3 d-flex gap-2 align-items-center">
        <input id="bsName" class="form-control" placeholder="Bottle type (e.g. 1L)" style="max-width:220px" />
        <input id="bsQty" class="form-control" placeholder="Quantity" style="max-width:140px" type="number" step="1" />
        <button id="bsAddBtn" class="btn btn-primary">Add Bottle Type</button>
        <button id="bsInitDefaults" class="btn btn-outline-secondary">Init Default Types</button>
      </div>
      <div id="bsTableWrap">Loading...</div>
    `;

    async function refresh(){
      const inv = await fetchJSON('/api/stock').catch(()=>[]);
      // consider inventory entries that look like bottles (we'll accept anything but prefer product_name containing 'L' or 'litre')
      const bottles = (inv||[]).filter(i => /(L|litre|liters|litres)/i.test(i.product_name || '') || i.is_bottle || true);
      const wrap = document.getElementById('bsTableWrap'); wrap.innerHTML = '';
      if(!bottles.length){ const info = document.createElement('div'); info.className='text-muted'; info.innerHTML='No bottle types found. Click "Init Default Types" to add 1L, 5L, 10L and 20L types.'; wrap.appendChild(info); return; }
      const tbl = document.createElement('table'); tbl.className = 'modern-table';
      tbl.innerHTML = '<thead><tr><th>Bottle Type</th><th style="width:100px">Qty</th><th style="width:140px">Last Updated</th><th style="width:140px">Actions</th></tr></thead>';
      const tbody = document.createElement('tbody');
      (bottles||[]).forEach(b=>{
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><strong>${b.product_name}</strong></td><td>${parseInt(b.quantity||0)}</td><td class='muted'>${(b.last_updated||'').replace('T',' ').slice(0,16)}</td><td><button class="btn btn-sm btn-outline-primary bs-edit">Edit</button> <button class="btn btn-sm btn-outline-danger bs-del">Delete</button></td>`;
        setTimeout(()=>{
          const editBtn = tr.querySelector('.bs-edit');
          const delBtn = tr.querySelector('.bs-del');
          editBtn.addEventListener('click', async ()=>{
            const name = prompt('Bottle type name', b.product_name); if(name===null) return;
            const qtyStr = prompt('Quantity (integer)', String(b.quantity||0)); if(qtyStr===null) return;
            const qty = parseInt(qtyStr||0);
            try{ await fetchJSON(`/api/stock/${b.id}`, {method:'PUT', headers:{'content-type':'application/json'}, body: JSON.stringify({product_name: name, quantity: qty})}); await refresh(); }catch(e){ alert('Update failed'); }
          });
          delBtn.addEventListener('click', async ()=>{ if(!confirm('Delete '+b.product_name+'?')) return; try{ await fetchJSON(`/api/stock/${b.id}`, {method:'DELETE'}); await refresh(); }catch(e){ alert('Delete failed'); } });
        },0);
        tbody.appendChild(tr);
      });
      tbl.appendChild(tbody); wrap.appendChild(tbl);
    }

    document.getElementById('bsAddBtn').addEventListener('click', async (ev)=>{ ev.preventDefault(); const name = document.getElementById('bsName').value.trim(); const qty = parseInt(document.getElementById('bsQty').value || 0); if(!name){ alert('Name required'); return; } try{ await fetchJSON('/api/stock', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({product_name: name, quantity: qty})}); document.getElementById('bsName').value=''; document.getElementById('bsQty').value=''; await refresh(); }catch(e){ alert('Create failed'); } });

    document.getElementById('bsInitDefaults').addEventListener('click', async ()=>{
      if(!confirm('Create default bottle types (1L, 5L, 10L, 20L)?')) return;
      const defaults = [ {product_name:'1 L Bottle', quantity:0}, {product_name:'5 L Bottle', quantity:0}, {product_name:'10 L Bottle', quantity:0}, {product_name:'20 L Bottle', quantity:0} ];
      for(const d of defaults){ try{ await fetchJSON('/api/stock', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(d)}); }catch(e){ console.warn('init default failed', e); } }
      await refresh();
    });

    await refresh();
  }catch(e){ console.error('loadBottleStock', e); body.innerHTML = '<div class="alert alert-danger">Failed to load bottle stock: ' + (e.message||e) + '</div>'; }
}

async function loadRefillTracking(){
  try{
    const el = document.getElementById('refillTrackingBody'); if(!el) return;
    const rows = await fetchJSON('/api/movements?kind=source&limit=200');
    el.innerHTML = '';
    if(!rows || !rows.length){ el.innerHTML = '<p>No refill movements found.</p>'; return; }
    const table = document.createElement('table'); table.className='modern-table';
    table.innerHTML = '<thead><tr><th>#</th><th>Ref</th><th style="width:120px">Delta</th><th>Reason</th><th style="width:160px">Time</th></tr></thead>';
    const tbody = document.createElement('tbody');
    rows.forEach(r=>{ const tr=document.createElement('tr'); tr.innerHTML = `<td class="muted">${r.id}</td><td class="muted">${r.ref_id}</td><td>${parseFloat(r.delta||0).toFixed(2)}</td><td class="muted">${r.reason||''}</td><td class="muted">${(r.timestamp||'').replace('T',' ').replace('Z','')}</td>`; tbody.appendChild(tr); });
    table.appendChild(tbody); const wrap=document.createElement('div'); wrap.className='table-wrapper'; wrap.appendChild(table); el.appendChild(wrap);
  }catch(e){ console.error('loadRefillTracking', e); }
}

// (removed duplicate simple loadReportsStock) - detailed loader is defined later

// Chart rendering helper (uses Chart.js already included on the page)
function renderSalesTrend(containerId, labels, data, opts){
  try{
    const wrap = document.getElementById(containerId);
    if(!wrap) return;
    wrap.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.id = containerId + '-chart';
    wrap.appendChild(canvas);
    // destroy previous chart if exists
    try{ if(window[containerId+'Chart']){ window[containerId+'Chart'].destroy(); window[containerId+'Chart'] = null; } }catch(e){}
    const ctx = canvas.getContext('2d');
    window[containerId+'Chart'] = new Chart(ctx, {
      type: 'line',
      data: { labels: labels, datasets: [{ label: opts && opts.label ? opts.label : 'Sales', data: data, borderColor: '#7dd3fc', backgroundColor: 'rgba(125,211,252,0.08)', tension: 0.3, fill: true }] },
      options: { plugins:{legend:{display:false}}, scales:{ y:{ beginAtZero:true } } }
    });
  }catch(e){ console.error('renderSalesTrend', e); }
}

// Weekly report: last 7 days totals + chart
async function loadReportsWeekly(){
  const outEl = document.getElementById('reportsWeeklySalesBody') || document.getElementById('reportsWeeklyBody');
  if(!outEl) return;
  outEl.innerHTML = 'Loading weekly report...';
  try{
    const orders = await fetchJSON('/api/orders').catch(()=>null);
    if(!orders) { outEl.innerHTML = '<div class="muted">No data — backend unreachable. Start the server (python app.py).</div>'; return; }
    const days = 7; const now = new Date(); const labels = []; const map = {};
    for(let i=days-1;i>=0;i--){ const d=new Date(now); d.setDate(now.getDate()-i); const key=d.toISOString().slice(0,10); labels.push(key); map[key]=0; }
    let qty = 0;
    (orders||[]).forEach(o=>{ const d=(o.timestamp||'').slice(0,10); if(d in map){ map[d] += parseFloat(o.total||0); qty += parseFloat(o.quantity||0); } });
    const data = labels.map(l=>parseFloat((map[l]||0).toFixed(2)));
    const total = data.reduce((a,b)=>a+b,0);
    outEl.innerHTML = `<p><strong>Last ${days} days</strong> • Total litres: <strong>${qty.toFixed(2)} L</strong> • Total amount: <strong>${total.toFixed(2)} KSH</strong></p><div id="reportsWeeklyChartWrap"></div>`;
    renderSalesTrend('reportsWeeklyChartWrap', labels, data, {label:'Last 7 days'});
  }catch(e){ console.error('loadReportsWeekly', e); outEl.innerHTML = '<div class="text-danger">Failed to load weekly report</div>'; }
}

// Monthly report: this month's daily totals + chart
async function loadReportsMonthly(){
  const outEl = document.getElementById('reportsMonthlySalesBody') || document.getElementById('reportsMonthlyBody');
  if(!outEl) return;
  outEl.innerHTML = 'Loading monthly report...';
  try{
    const now = new Date(); const year = now.getFullYear(); const month = now.getMonth();
    const daysInMonth = new Date(year, month+1, 0).getDate();
    const labels = []; const map = {};
    for(let d=1; d<=daysInMonth; d++){ const dd=new Date(year, month, d); const key=dd.toISOString().slice(0,10); labels.push(key); map[key]=0; }
    const orders = await fetchJSON('/api/orders').catch(()=>null);
    if(!orders){ outEl.innerHTML = '<div class="muted">No data — backend unreachable. Start the server (python app.py).</div>'; return; }
    let qty = 0;
    (orders||[]).forEach(o=>{ const d=(o.timestamp||'').slice(0,10); if(d in map){ map[d] += parseFloat(o.total||0); qty += parseFloat(o.quantity||0); } });
    const data = labels.map(l=>parseFloat((map[l]||0).toFixed(2)));
    const total = data.reduce((a,b)=>a+b,0);
    outEl.innerHTML = `<p><strong>This month</strong> • Total litres: <strong>${qty.toFixed(2)} L</strong> • Total amount: <strong>${total.toFixed(2)} KSH</strong></p><div id="reportsMonthlyChartWrap"></div>`;
    renderSalesTrend('reportsMonthlyChartWrap', labels, data, {label:'This month'});
  }catch(e){ console.error('loadReportsMonthly', e); outEl.innerHTML = '<div class="text-danger">Failed to load monthly report</div>'; }
}

// Revenue/P&L chart (last 30 days)
async function loadRevenueChart(){
  const outEl = document.getElementById('dashboardRevenueBody') || document.getElementById('reportsPLBody');
  if(!outEl) return;
  outEl.innerHTML = 'Loading revenue chart...';
  try{
    const days = 30; const now = new Date(); const labels = []; const map = {};
    for(let i=days-1;i>=0;i--){ const d=new Date(now); d.setDate(now.getDate()-i); const key=d.toISOString().slice(0,10); labels.push(key); map[key]=0; }
    const orders = await fetchJSON('/api/orders').catch(()=>null);
    if(!orders){ outEl.innerHTML = '<div class="muted">No data — backend unreachable. Start the server (python app.py).</div>'; return; }
    (orders||[]).forEach(o=>{ const d=(o.timestamp||'').slice(0,10); if(d in map) map[d] += parseFloat(o.total||0); });
    const data = labels.map(l=>parseFloat((map[l]||0).toFixed(2)));
    outEl.innerHTML = '<div id="revenueChartWrap"></div>';
    renderSalesTrend('revenueChartWrap', labels, data, {label:'Revenue (KSH)'});
  }catch(e){ console.error('loadRevenueChart', e); outEl.innerHTML = '<div class="text-danger">Failed to load revenue chart</div>'; }
}

// Daily report: show sales for a specific day (default today). Adds a date picker and hourly chart.
async function loadReportsDaily(dateStr){
  const outEl = document.getElementById('reportsDailySalesBody');
  if(!outEl) return;
  const today = new Date();
  const defaultDate = dateStr || today.toISOString().slice(0,10);
  outEl.innerHTML = `
    <div class="d-flex align-items-center gap-2 mb-2">
      <label class="m-0">Date:</label>
      <input id="reportsDailyDate" type="date" value="${defaultDate}" class="form-control" style="width:180px" />
      <button id="reportsDailyRefresh" class="btn btn-sm btn-primary">Refresh</button>
    </div>
    <div id="reportsDailySummary">Loading daily report...</div>
    <div id="reportsDailyChartWrap" style="min-height:160px; margin-top:10px"></div>
    <div id="reportsDailyOrders" style="margin-top:10px"></div>
  `;

  async function renderFor(dateISO){
    const summaryEl = document.getElementById('reportsDailySummary');
    const chartWrap = document.getElementById('reportsDailyChartWrap');
    const ordersEl = document.getElementById('reportsDailyOrders');
    summaryEl.innerHTML = 'Computing...'; chartWrap.innerHTML=''; ordersEl.innerHTML='';
    const orders = await fetchJSON('/api/orders').catch(()=>null);
    if(!orders){ summaryEl.innerHTML = '<div class="muted">No data — backend unreachable.</div>'; return; }
    const dayOrders = (orders||[]).filter(o => (o.timestamp||'').slice(0,10) === dateISO);
    const totalAmount = dayOrders.reduce((s,o)=>s + parseFloat(o.total||0), 0);
    const totalQty = dayOrders.reduce((s,o)=>s + parseFloat(o.quantity||0), 0);
    
    // Separate water and bottle orders
    const waterOrders = dayOrders.filter(o => {
      const pname = (o.product_name || '').toLowerCase();
      const bottlesUsed = parseInt(o.bottles_used || 0);
      const bottlePrice = parseFloat(o.bottle_price || 0);
      // water orders exclude any that consumed bottles or had bottle_price attached
      return pname.includes('water') && !pname.includes('bottle') && bottlesUsed === 0 && bottlePrice === 0;
    });
    const bottleOrders = dayOrders.filter(o => {
      const pname = (o.product_name || '').toLowerCase();
      const bottlesUsed = parseInt(o.bottles_used || 0);
      const bottlePrice = parseFloat(o.bottle_price || 0);
      // include explicit bottle product orders and any water sale that consumed bottles or included a bottle_price
      return pname.includes('bottle') || pname.includes('empty') || bottlesUsed > 0 || bottlePrice > 0;
    });
    
    const waterTotal = waterOrders.reduce((s,o)=>s + parseFloat(o.total||0), 0);
    const bottleTotal = bottleOrders.reduce((s,o)=>s + parseFloat(o.total||0), 0);
    const waterQty = waterOrders.reduce((s,o)=>s + parseFloat(o.quantity||0), 0);
    const bottleCount = bottleOrders.reduce((s,o)=>s + Math.ceil(parseFloat(o.quantity||0)), 0);
    
    // hourly breakdown
    const hours = Array.from({length:24}, (_,i)=>String(i).padStart(2,'0')+':00');
    const hourMap = {}; hours.forEach((h,i)=> hourMap[String(i).padStart(2,'0')] = 0);
    dayOrders.forEach(o=>{
      const t=(o.timestamp||''); const hr = t.slice(11,13);
      if(hr in hourMap) hourMap[hr] += parseFloat(o.total||0);
    });
    const hourData = Object.keys(hourMap).map(k=>parseFloat((hourMap[k]||0).toFixed(2)));
    // previous day comparison
    const d = new Date(dateISO);
    const prev = new Date(d); prev.setDate(d.getDate()-1); const prevISO = prev.toISOString().slice(0,10);
    const prevOrders = (orders||[]).filter(o => (o.timestamp||'').slice(0,10) === prevISO);
    const prevTotal = prevOrders.reduce((s,o)=>s + parseFloat(o.total||0), 0);
    const delta = prevTotal === 0 ? null : ((totalAmount - prevTotal)/prevTotal * 100);

    // payment method breakdown
    const payMap = {};
    dayOrders.forEach(o=>{ const pm = o.payment_method || 'Unknown'; payMap[pm] = (payMap[pm]||0) + parseFloat(o.total||0); });

    let deltaHtml = '';
    if(delta === null) deltaHtml = '<small class="text-muted">No previous-day data to compare.</small>';
    else deltaHtml = `<small class="${delta>=0? 'text-success':'text-danger'}">${delta>=0?'+':''}${delta.toFixed(1)}% vs prev day</small>`;

    summaryEl.innerHTML = `
      <div class="d-flex justify-content-between align-items-center">
        <div>
          <div><strong>Total amount</strong>: KSH ${totalAmount.toFixed(2)}</div>
          <div><strong>Total litres</strong>: ${totalQty.toFixed(2)} L</div>
          ${deltaHtml}
        </div>
        <div>
          <small class="text-muted">Orders: ${dayOrders.length}</small>
        </div>
      </div>
      <div class="mt-2">
        <strong>Sales Breakdown</strong>
        <ul class="mb-2">
          <li>💧 <strong>Water</strong>: ${waterOrders.length} orders | ${waterQty.toFixed(2)} L | KSH ${waterTotal.toFixed(2)}</li>
          <li>🔋 <strong>Bottles</strong>: ${bottleOrders.length} orders | ${bottleCount} units | KSH ${bottleTotal.toFixed(2)}</li>
        </ul>
      </div>
      <div class="mt-2">
        <strong>Payment breakdown</strong>
        <ul class="mb-0">
          ${Object.keys(payMap).map(k=>`<li>${k}: KSH ${payMap[k].toFixed(2)}</li>`).join('')}
        </ul>
      </div>
    `;

    renderSalesTrend('reportsDailyChartWrap', hours.map(h=>h.slice(0,2)), hourData, {label:'Hourly sales'});

    // list orders
    ordersEl.innerHTML = `<h6 class="mt-3">Orders (${dayOrders.length})</h6>` + (dayOrders.length? `<div class="list-group">${dayOrders.map(o=>`<div class="list-group-item"><div><strong>${o.customer||'Unknown'}</strong> — ${o.timestamp} — KSH ${parseFloat(o.total||0).toFixed(2)} — ${parseFloat(o.quantity||0)} L</div></div>`).join('')}</div>` : '<div class="text-muted">No orders for this day.</div>');
  }

  // wire controls
  document.getElementById('reportsDailyDate').addEventListener('change', (e)=>{ renderFor(e.target.value); });
  document.getElementById('reportsDailyRefresh').addEventListener('click', ()=>{ const v=document.getElementById('reportsDailyDate').value; renderFor(v); });
  // initial render
  renderFor(defaultDate);
}

// P&L summary: supports range = 'day'|'week'|'month' and comparison to previous period
async function loadPLSummary(){
  const outEl = document.getElementById('reportsPLBody');
  if(!outEl) return;
  outEl.innerHTML = `
    <div class="d-flex gap-2 mb-2 align-items-center">
      <label class="m-0">Range:</label>
      <select id="plRange" class="form-select" style="width:140px">
        <option value="day">Day</option>
        <option value="week">Week</option>
        <option value="month" selected>Month</option>
      </select>
      <input id="plDate" type="date" class="form-control" style="width:180px" />
      <input id="plMonth" type="month" class="form-control" style="width:160px; display:none" />
      <button id="plRefresh" class="btn btn-sm btn-primary">Apply</button>
    </div>
    <div id="plSummaryArea">Loading P&L...</div>
    <div id="plTrendChartWrap" style="min-height:160px; margin-top:10px"></div>
  `;

  // helpers
  function getRangeDates(range, refDate){
    const d = new Date(refDate);
    if(range==='day'){
      const from = new Date(d); from.setHours(0,0,0,0); const to = new Date(d); to.setHours(23,59,59,999);
      return {from, to};
    }
    if(range==='week'){
      // week starting monday
      const day = d.getDay(); const diff = (day + 6) % 7; // days since monday
      const monday = new Date(d); monday.setDate(d.getDate() - diff); monday.setHours(0,0,0,0);
      const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6); sunday.setHours(23,59,59,999);
      return {from: monday, to: sunday};
    }
    // month
    const from = new Date(d.getFullYear(), d.getMonth(), 1); from.setHours(0,0,0,0);
    const to = new Date(d.getFullYear(), d.getMonth()+1, 0); to.setHours(23,59,59,999);
    return {from, to};
  }

  async function renderPL(range, refDateStr){
    const area = document.getElementById('plSummaryArea'); area.innerHTML = 'Computing...';
    const orders = await fetchJSON('/api/orders').catch(()=>null);
    if(!orders){ area.innerHTML = '<div class="muted">No data — backend unreachable.</div>'; return; }

    const refDate = refDateStr ? new Date(refDateStr) : new Date();
    const {from,to} = getRangeDates(range, refDate);
    const prevFrom = new Date(from); const prevTo = new Date(to);
    // shift prev range by same period length
    const shift = to.getTime() - from.getTime() + 1;
    prevFrom.setTime(prevFrom.getTime() - shift); prevTo.setTime(prevTo.getTime() - shift);

    function inRange(ts, a,b){ const t = new Date(ts); return t >= a && t <= b; }
    const selOrders = (orders||[]).filter(o => inRange(o.timestamp, from, to));
    const prevOrders = (orders||[]).filter(o => inRange(o.timestamp, prevFrom, prevTo));
    const total = selOrders.reduce((s,o)=>s + parseFloat(o.total||0), 0);
    const qty = selOrders.reduce((s,o)=>s + parseFloat(o.quantity||0), 0);
    const prevTotal = prevOrders.reduce((s,o)=>s + parseFloat(o.total||0), 0);
    const delta = prevTotal === 0 ? null : ((total - prevTotal)/prevTotal * 100);

    area.innerHTML = `
      <div class="d-flex justify-content-between">
        <div>
          <div><strong>Total sales</strong>: KSH ${total.toFixed(2)}</div>
          <div><strong>Total litres</strong>: ${qty.toFixed(2)} L</div>
        </div>
        <div>
          ${delta === null ? '<small class="text-muted">No previous period</small>' : `<div class="${delta>=0?'text-success':'text-danger'}">${delta>=0?'+':''}${delta.toFixed(1)}% vs previous</div>`}
        </div>
      </div>
    `;

    // render trend: last 30 days irrespective of range
    const days = 30; const labels = []; const map = {};
    const now = new Date(to);
    for(let i=days-1;i>=0;i--){ const d2 = new Date(now); d2.setDate(now.getDate()-i); const k = d2.toISOString().slice(0,10); labels.push(k); map[k]=0; }
    (orders||[]).forEach(o=>{ const k=(o.timestamp||'').slice(0,10); if(k in map) map[k]+= parseFloat(o.total||0); });
    const data = labels.map(l=>parseFloat((map[l]||0).toFixed(2)));
    renderSalesTrend('plTrendChartWrap', labels.map(l=>l.slice(5)), data, {label:'Revenue (last 30 days)'});
  }

  // control wiring
  const plRange = document.getElementById('plRange');
  const plDate = document.getElementById('plDate');
  const plMonth = document.getElementById('plMonth');
  const plRefresh = document.getElementById('plRefresh');
  // set defaults
  const now = new Date(); plDate.value = now.toISOString().slice(0,10); plMonth.value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  plRange.addEventListener('change', ()=>{
    if(plRange.value==='month'){ plMonth.style.display='inline-block'; plDate.style.display='none'; }
    else { plMonth.style.display='none'; plDate.style.display='inline-block'; }
  });
  plRefresh.addEventListener('click', ()=>{
    const range = plRange.value;
    const ref = range==='month' ? (plMonth.value? plMonth.value+'-01': null) : plDate.value;
    renderPL(range, ref);
  });
  // initial render
  plRange.dispatchEvent(new Event('change'));
  plRefresh.click();
}



// show order details in modal (uses Bootstrap modal)
window.showOrderDetails = function(order){
  try{
    const body = document.getElementById('orderDetailBody');
    if(!body) return;
    const rows = [];
    rows.push(`<p><strong>Order ID:</strong> ${order.id}</p>`);
    rows.push(`<p><strong>Product:</strong> ${order.product_name || order.product_id}</p>`);
    rows.push(`<p><strong>Quantity:</strong> ${order.quantity}</p>`);
    rows.push(`<p><strong>Unit price:</strong> ${parseFloat(order.unit_price||0).toFixed(2)} KSH</p>`);
    rows.push(`<p><strong>Total:</strong> ${parseFloat(order.total||0).toFixed(2)} KSH</p>`);
    rows.push(`<p><strong>Payment method:</strong> ${order.payment_method || 'Cash'}</p>`);
    rows.push(`<p><strong>Timestamp:</strong> ${order.timestamp || ''}</p>`);
    if(order.created_by) rows.push(`<p><strong>Created by (id):</strong> ${order.created_by}</p>`);
    // show bottle info when present
    if(order.bottles_used && parseInt(order.bottles_used) > 0) rows.push(`<p><strong>Bottles used:</strong> ${order.bottles_used}</p>`);
    if(order.bottle_price && parseFloat(order.bottle_price) > 0) rows.push(`<p><strong>Bottle price:</strong> ${parseFloat(order.bottle_price).toFixed(2)} KSH</p>`);
    body.innerHTML = rows.join('\n');
    const modalEl = document.getElementById('orderDetailModal');
    const bsModal = new bootstrap.Modal(modalEl);
    bsModal.show();
  }catch(e){ console.error(e); alert('Failed to show order details'); }
}

// ensure gallery loads on page load
/* gallery removed — no-op */


async function loadProductsList(){
  try{
    const prods = await fetchJSON('/api/products');
    const el = document.getElementById('productsList');
    el.innerHTML = '';
    prods.forEach(p=>{
      const d = document.createElement('div'); d.className='d-flex align-items-center justify-content-between py-2 border-bottom';
      d.innerHTML = `<div><strong>${p.name}</strong><div class="text-muted">${p.unit_price} KSH</div></div>`;
      const btns = document.createElement('div');
      const hist = document.createElement('button'); hist.className='btn btn-sm btn-outline-secondary me-2'; hist.textContent='History';
      hist.addEventListener('click', ()=> showPriceHistory(p.id, p.name));
      const edit = document.createElement('button'); edit.className='btn btn-sm btn-outline-primary me-2'; edit.textContent='Edit';
      edit.addEventListener('click', ()=>{ document.getElementById('prodName').value=p.name; document.getElementById('prodPrice').value=p.unit_price; document.getElementById('prodId').value=p.id; });
      const del = document.createElement('button'); del.className='btn btn-sm btn-outline-danger'; del.textContent='Delete';
      del.addEventListener('click', async ()=>{ if(confirm('Delete product?')){ await fetchJSON(`/api/products/${p.id}`, {method:'DELETE'}); loadProducts(); loadProductsList(); }});
      btns.appendChild(edit); btns.appendChild(del);
      btns.insertBefore(hist, btns.firstChild);
      d.appendChild(btns);
      el.appendChild(d);
    });
    // clear backend error marker if present
    if(el && el.dataset.error){ el.dataset.error = ''; el.classList.remove('text-danger'); }
  }catch(e){ console.error(e); const el = document.getElementById('productsList'); if(el){ el.innerHTML = '<div class="text-danger">Failed to load products — backend unreachable. Start the server with <code>python app.py</code>.</div>'; el.dataset.error = '1'; } }
}


// Populate product selects and simple caches
async function loadProducts(){
  try{
    const products = await fetchJSON('/api/products');
    window._products = products;
    const sel = document.getElementById('productSelect');
    if(sel){
      sel.innerHTML = products.map(p=>`<option value="${p.id}">${p.name} — ${parseFloat(p.unit_price).toFixed(2)} KSH</option>`).join('');
    }
    // also update any simple legacy select used in newOrderForm
    const newOrderProduct = document.getElementById('newOrderProduct');
    if(newOrderProduct){
      newOrderProduct.innerHTML = products.map(p=>`<option value="${p.id}" data-price="${p.unit_price}">${p.name} — ${parseFloat(p.unit_price).toFixed(2)} KSH</option>`).join('');
    }
  }catch(e){ console.error('loadProducts failed', e); }
}


// Wire product add/update form for admin
function wireProductForm(){
  try{
    const form = document.getElementById('productForm');
    if(!form) return;
    form.addEventListener('submit', async (ev)=>{
      ev.preventDefault();
      const name = (document.getElementById('prodName').value || '').trim();
      const price = parseFloat(document.getElementById('prodPrice').value);
      const id = document.getElementById('prodId').value || '';
      if(!name || isNaN(price)) return alert('Please provide valid name and price');
      try{
        if(id){
          await fetchJSON(`/api/products/${id}`, { method: 'PUT', headers: {'content-type':'application/json'}, body: JSON.stringify({ name, unit_price: price }) });
        } else {
          await fetchJSON('/api/products', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ name, unit_price: price }) });
        }
        // refresh
        await loadProducts();
        await loadProductsList();
        // clear form
        document.getElementById('prodName').value=''; document.getElementById('prodPrice').value=''; document.getElementById('prodId').value='';
      }catch(err){ console.error('Failed to save product', err); alert('Failed to save product: ' + (err.message||err)); }
    });
    const cancel = document.getElementById('prodCancel');
    if(cancel){ cancel.addEventListener('click', ()=>{ document.getElementById('prodName').value=''; document.getElementById('prodPrice').value=''; document.getElementById('prodId').value=''; }); }
  }catch(e){ console.error('wireProductForm failed', e); }
}


// Show price history modal
async function showPriceHistory(productId, productName){
  try{
    const rows = await fetchJSON(`/api/products/${productId}/history`);
    const body = document.getElementById('priceHistoryBody');
    if(!body) return;
    if(!rows || !rows.length){ body.innerHTML = `<p class="muted">No price history for ${productName}</p>`; }
    else{
      const wrap = document.createElement('div'); wrap.className = 'table-wrapper';
      const tbl = document.createElement('table'); tbl.className = 'modern-table';
      tbl.innerHTML = '<thead><tr><th>#</th><th>Old</th><th>New</th><th>Changed by</th><th style="width:180px">Timestamp</th><th>Reason</th></tr></thead>';
      const tbody = document.createElement('tbody');
      rows.forEach(r=>{ const tr = document.createElement('tr'); tr.innerHTML = `<td class='muted'>${r.id}</td><td>${r.old_price==null?'-':parseFloat(r.old_price).toFixed(2)}</td><td>${parseFloat(r.new_price).toFixed(2)}</td><td class='muted'>${r.changed_by||'-'}</td><td class='muted'>${(r.timestamp||'').replace('T',' ').replace('Z','')}</td><td class='muted'>${r.reason||''}</td>`; tbody.appendChild(tr); });
      tbl.appendChild(tbody); wrap.appendChild(tbl); body.innerHTML = ''; body.appendChild(wrap);
    }
    const modalEl = document.getElementById('priceHistoryModal');
    const bs = new bootstrap.Modal(modalEl); bs.show();
  }catch(e){ console.error('showPriceHistory', e); alert('Failed to load price history'); }
}

// Stock management (admin-only)
async function loadStock(){
  const card = document.getElementById('stockCard');
  if(!card) return;
  card.innerHTML = '';
  try{
    const heading = document.createElement('div'); heading.className = 'card-header';
    heading.innerHTML = `<h5 class="card-title">Stock (Sources)</h5><small class="text-muted">Manage source tanks and map products to sources</small>`;
    card.appendChild(heading);
    const body = document.createElement('div'); body.className = 'card-body';

    // Sources form
    const srcForm = document.createElement('form'); srcForm.className = 'mb-3 d-flex gap-2 align-items-start';
    srcForm.innerHTML = `
      <input id="srcName" class="form-control" placeholder="Source name (e.g. Main Tank)" style="min-width:220px" />
      <input id="srcQty" class="form-control" type="number" step="0.1" min="0" placeholder="Quantity (L)" />
      <button class="btn btn-primary" id="srcCreateBtn">Create Source</button>
    `;
    body.appendChild(srcForm);

    const srcTableWrap = document.createElement('div'); srcTableWrap.className = 'table-wrapper mb-3';
    const srcTable = document.createElement('table'); srcTable.className = 'modern-table';
    srcTable.innerHTML = `<thead><tr><th>Source</th><th style="width:140px">Quantity</th><th style="width:160px">Last updated</th><th style="width:140px">Actions</th></tr></thead><tbody id="sourcesTbody"></tbody>`;
    srcTableWrap.appendChild(srcTable);
    body.appendChild(srcTableWrap);

    // Product -> Source mappings
    const mapHeader = document.createElement('h6'); mapHeader.textContent = 'Product → Source Mapping';
    body.appendChild(mapHeader);
    const mapWrap = document.createElement('div'); mapWrap.className = 'mb-2';
    const mapTable = document.createElement('div'); mapTable.className = 'table-wrapper';
    mapTable.innerHTML = `<table class="modern-table"><thead><tr><th>Product</th><th style="width:240px">Source</th><th style="width:140px">Factor (L per unit)</th><th style="width:140px">Actions</th></tr></thead><tbody id="mappingsTbody"></tbody></table>`;
    mapWrap.appendChild(mapTable);
    body.appendChild(mapWrap);

    card.appendChild(body);

    // load data
    const [prods, sources, mappings] = await Promise.all([
      fetchJSON('/api/products'),
      fetchJSON('/api/sources'),
      fetchJSON('/api/product_sources')
    ]);

    // populate sources table
    const stbody = document.getElementById('sourcesTbody'); stbody.innerHTML = '';
    (sources||[]).forEach(s => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td><strong>${s.name}</strong></td><td>${parseFloat(s.quantity).toFixed(2)} ${s.unit||'L'}</td><td class="muted">${s.last_updated||''}</td><td><button class="btn btn-sm btn-outline-primary me-2">Edit</button><button class="btn btn-sm btn-outline-danger">Delete</button></td>`;
      const editBtn = tr.querySelector('button.btn-outline-primary');
      const delBtn = tr.querySelector('button.btn-outline-danger');
      editBtn.addEventListener('click', ()=>{
        const name = prompt('Source name', s.name); if(name===null) return;
        const qty = prompt('Quantity (L)', s.quantity);
        fetchJSON(`/api/sources/${s.id}`, {method:'PUT', headers:{'content-type':'application/json'}, body: JSON.stringify({name, quantity: qty})}).then(()=>loadStock()).catch(()=>alert('Update failed'));
      });
      delBtn.addEventListener('click', async ()=>{
        if(!confirm('Delete source '+s.name+'?')) return; try{ await fetchJSON(`/api/sources/${s.id}`, {method:'DELETE'}); await loadStock(); }catch(e){ alert('Failed to delete'); }
      });
      stbody.appendChild(tr);
    });

    // Stock movements chart controls
    const chartHeader = document.createElement('h6'); chartHeader.textContent = 'Stock movements (per source)';
    body.appendChild(chartHeader);
    const chartControls = document.createElement('div'); chartControls.className = 'd-flex gap-2 align-items-center mb-2';
    const srcSelectHtml = `<select id="chartSourceSelect" class="form-select" style="width:220px">${(sources||[]).map(s=>`<option value="${s.id}">${s.name}</option>`).join('')}</select>`;
    chartControls.innerHTML = srcSelectHtml + `<input id="chartDays" class="form-control" style="width:120px" value="30" /> <button id="chartRefresh" class="btn btn-sm btn-primary">Refresh Chart</button>`;
    body.appendChild(chartControls);
    const chartWrap2 = document.createElement('div'); chartWrap2.className = 'sales-chart-wrapper mb-2'; chartWrap2.innerHTML = `<canvas id="stockChartCanvas" class="sales-chart"></canvas>`;
    body.appendChild(chartWrap2);

    async function reloadStockChart(){
      try{
        const sid = document.getElementById('chartSourceSelect').value;
        const days = parseInt(document.getElementById('chartDays').value || '30');
        if(!sid) return;
        // fetch source current quantity
        const src = await fetchJSON(`/api/sources`);
        const found = src.find(x=>String(x.id)===String(sid));
        const curQty = found ? parseFloat(found.quantity||0) : 0;
        // fetch movements for source (large limit)
        const rows = await fetchJSON(`/api/movements?kind=source&ref_id=${encodeURIComponent(sid)}&limit=1000`);
        // aggregate by date (YYYY-MM-DD)
        const byDate = {};
        (rows||[]).forEach(r=>{
          const d = (r.timestamp||'').slice(0,10) || new Date().toISOString().slice(0,10);
          byDate[d] = (byDate[d]||0) + parseFloat(r.delta||0);
        });
        // build date list for last `days` days
        const dates = [];
        const today = new Date();
        for(let i=days-1;i>=0;i--){ const dd = new Date(today); dd.setDate(today.getDate()-i); dates.push(dd.toISOString().slice(0,10)); }
        const daily = dates.map(d=> parseFloat((byDate[d]||0).toFixed(2)) );
        // Compute stock series (end-of-day) from daily deltas in a straightforward way:
        // Let totalDelta = sum(daily[0..n-1]). Let prefix[i] = sum(daily[0..i]).
        // Then end-of-day stock for day i = curQty - (totalDelta - prefix[i]).
        const totalDelta = daily.reduce((a,b)=>a+b, 0);
        let running = 0;
        const stockSeries = daily.map((d,i)=>{ running += d; return parseFloat((curQty - (totalDelta - running)).toFixed(2)); });
        // stockSeries is end-of-day stock; ensure numeric
        // render Chart.js: line for stock (green), optional bars for daily deltas (subtle)
        try{ if(window.stockChart) { window.stockChart.destroy(); window.stockChart = null; } }catch(e){}
        const ctx = document.getElementById('stockChartCanvas').getContext('2d');
        // Add a horizontal line dataset for the current stock level so users have a clear anchor.
        const currentLine = Array(dates.length).fill(parseFloat(curQty.toFixed(2)));
        window.stockChart = new Chart(ctx, {
          type: 'line',
          data: {
            labels: dates,
            datasets: [
              { label: 'Stock level (L)', data: stockSeries, borderColor: '#059669', backgroundColor: 'rgba(5,150,105,0.08)', tension:0.18, fill: true, pointRadius: 2 },
              { label: 'Current (now)', data: currentLine, borderColor: '#94a3b8', borderDash: [6,4], pointRadius: 0, fill: false, borderWidth: 1 }
            ]
          },
          options: { interaction:{mode:'index', intersect:false}, plugins:{ legend:{ position:'top'} }, scales:{ y:{ beginAtZero:false, title:{ display:true, text:'Litres' } } }
        }
        });
  // also show current quantity above chart and the net change over the period
  const summaryElId = 'stockChartSummary';
  let summaryEl = document.getElementById(summaryElId);
  if(!summaryEl){ summaryEl = document.createElement('div'); summaryEl.id = summaryElId; summaryEl.className = 'mb-2 muted'; chartWrap2.parentNode.insertBefore(summaryEl, chartWrap2); }
  const netChange = totalDelta;
  summaryEl.innerHTML = `<strong>Current ${found ? found.name : 'Source'}:</strong> ${curQty.toFixed(2)} L — Net change (period): ${netChange.toFixed(2)} L`;
      }catch(e){ console.error('reloadStockChart', e); }
    }
    document.getElementById('chartRefresh').addEventListener('click', async ()=>{ await reloadStockChart(); });
    // initial chart load (first source)
    try{ if((sources||[]).length) { document.getElementById('chartSourceSelect').value = sources[0].id; await reloadStockChart(); } }catch(e){}

    // wire create source
    document.getElementById('srcCreateBtn').addEventListener('click', async (ev)=>{
      ev.preventDefault();
      const name = document.getElementById('srcName').value.trim();
      const qty = parseFloat(document.getElementById('srcQty').value || 0);
      if(!name){ alert('Name required'); return; }
      try{ await fetchJSON('/api/sources', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({name, quantity: qty})}); document.getElementById('srcName').value=''; document.getElementById('srcQty').value=''; await loadStock(); }catch(e){ alert('Create failed'); }
    });

    // populate mappings table
    const mtbody = document.getElementById('mappingsTbody'); mtbody.innerHTML = '';
    (prods||[]).forEach(p => {
      const current = (mappings||[]).find(m=>m.product_id===p.id) || null;
      const tr = document.createElement('tr');
      const srcOptions = ['<option value="">(none)</option>'].concat((sources||[]).map(s=>`<option value="${s.id}" ${current && current.source_id===s.id ? 'selected' : ''}>${s.name}</option>`)).join('\n');
      tr.innerHTML = `<td><strong>${p.name}</strong></td><td><select class="form-select mapping-select">${srcOptions}</select></td><td><input class="form-control mapping-factor" type="number" step="0.1" value="${current ? current.factor : 1}" /></td><td><button class="btn btn-sm btn-primary mapping-save">Save</button> <button class="btn btn-sm btn-outline-danger mapping-remove">Clear</button></td>`;
      const saveBtn = tr.querySelector('.mapping-save');
      const removeBtn = tr.querySelector('.mapping-remove');
      saveBtn.addEventListener('click', async ()=>{
        const sel = tr.querySelector('.mapping-select'); const factor = parseFloat(tr.querySelector('.mapping-factor').value || 1);
        const sid = sel.value; if(!sid){ alert('Select a source or use Clear to remove mapping'); return; }
        try{ await fetchJSON('/api/product_sources', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({product_id: p.id, source_id: parseInt(sid), factor})}); await loadStock(); }catch(e){ alert('Save failed'); }
      });
      removeBtn.addEventListener('click', async ()=>{
        if(!confirm('Clear mapping for '+p.name+'?')) return; try{ await fetchJSON(`/api/product_sources/${p.id}`, {method:'DELETE'}); await loadStock(); }catch(e){ alert('Remove failed'); }
      });
      mtbody.appendChild(tr);
    });

    // Movements (audit) section
    const movHeader = document.createElement('h6'); movHeader.textContent = 'Movements (audit log)';
    body.appendChild(movHeader);
    const movControls = document.createElement('div'); movControls.className = 'd-flex gap-2 align-items-center mb-2';
    movControls.innerHTML = `
      <select id="movKind" class="form-select" style="width:180px">
        <option value="">All kinds</option>
        <option value="source">Source</option>
        <option value="inventory">Inventory</option>
      </select>
      <input id="movRefId" class="form-control" style="width:120px" placeholder="ref id" />
      <input id="movLimit" class="form-control" style="width:100px" value="50" />
      <button id="movRefresh" class="btn btn-sm btn-primary">Refresh</button>
    `;
    body.appendChild(movControls);
    const movWrap = document.createElement('div'); movWrap.className = 'table-wrapper';
    movWrap.innerHTML = `<table class="modern-table"><thead><tr><th style="width:60px">#</th><th>Kind</th><th style="width:80px">Ref</th><th style="width:90px">Delta</th><th>Reason</th><th style="width:180px">Timestamp</th><th style="width:80px">User</th></tr></thead><tbody id="movementsTbody"></tbody></table>`;
    body.appendChild(movWrap);

    async function reloadMovements(){
      try{
        const kind = document.getElementById('movKind').value || '';
        const ref = document.getElementById('movRefId').value || '';
        const limit = parseInt(document.getElementById('movLimit').value || '50');
        const q = [];
        if(limit) q.push('limit='+encodeURIComponent(limit));
        if(kind) q.push('kind='+encodeURIComponent(kind));
        if(ref) q.push('ref_id='+encodeURIComponent(ref));
        const url = '/api/movements' + (q.length ? ('?'+q.join('&')) : '');
        const rows = await fetchJSON(url);
        const mt = document.getElementById('movementsTbody'); mt.innerHTML = '';
        (rows || []).forEach(r=>{
          const tr = document.createElement('tr');
          const delta = parseFloat(r.delta || 0);
          const deltaClass = delta > 0 ? 'delta-plus' : (delta < 0 ? 'delta-minus' : 'muted');
          tr.innerHTML = `<td class="muted">${r.id}</td><td>${r.kind}</td><td class="muted">${r.ref_id}</td><td><span class="${deltaClass}">${delta.toFixed(2)}</span></td><td class="muted">${r.reason||''}</td><td class="muted">${(r.timestamp||'').replace('T',' ').replace('Z','')}</td><td class="muted">${r.user_id||''}</td>`;
          mt.appendChild(tr);
        });
      }catch(e){ console.error('reloadMovements', e); }
    }
    document.getElementById('movRefresh').addEventListener('click', async ()=>{ await reloadMovements(); });
    // initial load
    try{ await reloadMovements(); }catch(e){}

  }catch(e){ console.error('loadStock', e); card.innerHTML = '<div class="card-body">Failed to load stock</div>'; }
}

// --- NEW: loaders for the new sidebar entries ---


async function loadRefillTracking(){
  const el = document.getElementById('refillTrackingBody'); if(!el) return; el.innerHTML = 'Loading refill movements...';
  try{
    const rows = await fetchJSON('/api/movements?kind=source&limit=200');
    if(!rows || !rows.length){ el.innerHTML = '<div class="muted">No refill/movement records.</div>'; return; }
    const wrap = document.createElement('div'); wrap.className = 'table-wrapper';
    const tbl = document.createElement('table'); tbl.className = 'modern-table';
    tbl.innerHTML = '<thead><tr><th>#</th><th>Source</th><th style="width:120px">Delta</th><th>Reason</th><th style="width:180px">Timestamp</th></tr></thead>';
    const tbody = document.createElement('tbody');
    rows.forEach(r=>{ const tr = document.createElement('tr'); tr.innerHTML = `<td class='muted'>${r.id}</td><td>${r.ref_id}</td><td>${parseFloat(r.delta||0).toFixed(2)}</td><td class='muted'>${r.reason||''}</td><td class='muted'>${(r.timestamp||'').replace('T',' ').replace('Z','')}</td>`; tbody.appendChild(tr); });
    tbl.appendChild(tbody); wrap.appendChild(tbl); el.innerHTML = ''; el.appendChild(wrap);
  }catch(e){ console.error('loadRefillTracking', e); el.innerHTML = '<div class="text-danger">Failed to load refill tracking</div>'; }
}



async function loadReportsStock(){
  // The dashboard uses `reportsInventoryBody` for the inventory card; fallback to legacy `reportsStockBody` if present.
  let el = document.getElementById('reportsInventoryBody');
  if(!el) el = document.getElementById('reportsStockBody');
  if(!el) return;
  el.innerHTML = 'Loading stock report...';
  try{
    const [sources, inv] = await Promise.all([ fetchJSON('/api/sources').catch(()=>[]), fetchJSON('/api/stock').catch(()=>[]) ]);
    // compute totals
    const tankTotal = (sources || []).reduce((s, x) => s + parseFloat(x.quantity || 0), 0);
    const bottleTotal = (inv || []).reduce((s, x) => s + parseFloat(x.quantity || 0), 0);
    // build UI
    const hdr = document.createElement('div'); hdr.className = 'mb-2';
    hdr.innerHTML = `<div class="d-flex justify-content-between"><div><strong>Water in tanks</strong>: <span id="reportsTankTotal">${tankTotal.toFixed(2)} L</span></div><div><strong>Bottles in stock</strong>: <span id="reportsBottleTotal">${bottleTotal}</span></div></div>`;
    el.innerHTML = '';
    el.appendChild(hdr);

    const wrap = document.createElement('div'); wrap.className = 'table-wrapper';
    const tbl = document.createElement('table'); tbl.className = 'modern-table';
    tbl.innerHTML = '<thead><tr><th>Type</th><th>Name</th><th style="width:160px">Quantity</th></tr></thead>';
    const tbody = document.createElement('tbody');
    (sources||[]).forEach(s=>{ const tr = document.createElement('tr'); tr.innerHTML = `<td>Tank</td><td><strong>${s.name}</strong></td><td>${parseFloat(s.quantity||0).toFixed(2)} ${s.unit||'L'}</td>`; tbody.appendChild(tr); });
    // list bottle inventory (group by product_name)
    const invByName = {};
    (inv||[]).forEach(i=>{ const k = (i.product_name||'Unknown'); invByName[k] = (invByName[k]||0) + parseFloat(i.quantity||0); });
    Object.keys(invByName).forEach(name => { const tr = document.createElement('tr'); tr.innerHTML = `<td>Bottle</td><td>${name}</td><td>${parseFloat(invByName[name]||0).toFixed(0)}</td>`; tbody.appendChild(tr); });
    tbl.appendChild(tbody); wrap.appendChild(tbl); el.appendChild(wrap);
  }catch(e){ console.error('loadReportsStock', e); el.innerHTML = '<div class="text-danger">Failed to load stock report</div>'; }
}

// Load and render the new order form in the dashboard's Sales > New Order card
async function loadNewOrderForm(){
  const el = document.getElementById('salesNewOrderBody'); 
  if(!el) return;
  
  try {
    // Fetch products for the form
    let products;
    try {
      products = await fetchJSON('/api/products');
    } catch(e) {
      console.error('Failed to fetch products:', e);
      el.innerHTML = '<div class="alert alert-danger">Failed to load products: ' + e.message + '</div>';
      return;
    }
    
    if(!products || !products.length) {
      el.innerHTML = '<p class="text-warning">No products available.</p>';
      return;
    }

    // Separate water and bottle products
    const waterProducts = products.filter(p => p.name.toLowerCase().includes('water'));
    const bottleProducts = products.filter(p => p.name.toLowerCase().includes('bottle') || p.name.toLowerCase().includes('empty'));
    
    // Build HTML for the form
    const form = document.createElement('div');
    let productOptions = '';
    
    // Group water products
    if(waterProducts.length > 0) {
      productOptions += '<optgroup label="💧 Water Products">';
      waterProducts.forEach(p => {
        productOptions += `<option value="${p.id}" data-price="${p.unit_price}" data-is-bottle="false">${p.name} — ${parseFloat(p.unit_price).toFixed(2)} KSH</option>`;
      });
      productOptions += '</optgroup>';
    }
    
    // Group bottle products
    if(bottleProducts.length > 0) {
      productOptions += '<optgroup label="🔋 Empty Bottles">';
      bottleProducts.forEach(p => {
        productOptions += `<option value="${p.id}" data-price="${p.unit_price}" data-is-bottle="true">${p.name} — ${parseFloat(p.unit_price).toFixed(2)} KSH</option>`;
      });
      productOptions += '</optgroup>';
    }
    
    form.innerHTML = `
      <div class="form-group mb-3">
        <label class="form-label" for="newOrderProduct">Product</label>
        <select id="newOrderProduct" class="form-control form-select">
          <option value="">Select a product</option>
          ${productOptions}
        </select>
      </div>
      
      <div class="form-group mb-3">
        <label class="form-label" for="newOrderQty">Quantity</label>
        <input type="number" id="newOrderQty" class="form-control" min="1" value="1" step="0.01" />
      </div>
      
      <div class="form-group mb-3">
        <label class="form-label" for="newOrderPayment">Payment Method</label>
        <select id="newOrderPayment" class="form-control form-select">
          <option value="Cash">Cash</option>
          <option value="Mpesa">Mpesa</option>
        </select>
      </div>
      
      <div class="form-group mb-3" id="bottleOptionsWrap" style="display:none;">
        <label class="form-label" for="newOrderBottle">Include Empty Bottles</label>
        <select id="newOrderBottle" class="form-control form-select">
          <option value="false">No</option>
          <option value="true">Yes</option>
        </select>
      </div>
      <div class="form-group mb-3" id="newOrderBottleSizeWrap" style="display:none;">
        <label class="form-label" for="newOrderBottleSize">Bottle Size</label>
        <select id="newOrderBottleSize" class="form-control form-select">
          <option value="5">5 L</option>
          <option value="10">10 L</option>
          <option value="20">20 L</option>
        </select>
      </div>
      <div class="form-group mb-3" id="newOrderBottleCountWrap" style="display:none;">
        <label class="form-label" for="newOrderBottleCount">Bottles Count</label>
        <input type="number" id="newOrderBottleCount" class="form-control" min="1" value="1" step="1" />
        <small class="text-muted">Number of empty bottles to decrement (auto-calculated from quantity by default).</small>
      </div>
      
      <div class="form-group mb-3">
        <label class="form-label" for="newOrderDate">Order Date</label>
        <input type="date" id="newOrderDate" class="form-control" />
        <small class="text-muted">Cannot be in the future</small>
      </div>
      
      <div class="alert alert-info mb-3" id="newOrderSummary" style="display:none;">
        <small id="newOrderSummaryText"></small>
      </div>
      
      <button type="button" class="btn btn-primary w-100" id="submitNewOrderBtn">Create Order</button>
    `;
    
    el.innerHTML = '';
    el.appendChild(form);
    
    // Set today's date by default and set max to today
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('newOrderDate');
    if(dateInput) {
      dateInput.value = today;
      dateInput.max = today; // prevent future dates
    }
    
    // Wire up submit button click
    const submitBtn = document.getElementById('submitNewOrderBtn');
    if(submitBtn) {
      submitBtn.addEventListener('click', submitNewOrder);
    }
    // show/hide bottle size & count when bottle option toggles
    const bottleSelect = document.getElementById('newOrderBottle');
    const bottleSizeWrap = document.getElementById('newOrderBottleSizeWrap');
    const bottleCountWrap = document.getElementById('newOrderBottleCountWrap');
    if(bottleSelect){
      bottleSelect.addEventListener('change', ()=>{
        const use = bottleSelect.value === 'true';
        if(bottleSizeWrap) bottleSizeWrap.style.display = use ? '' : 'none';
        if(bottleCountWrap) bottleCountWrap.style.display = use ? '' : 'none';
        updateNewOrderSummary();
      });
    }
    // when product changes, try to default bottle size from product_sources
    const productSelect = document.getElementById('newOrderProduct');
    if(productSelect){
      productSelect.addEventListener('change', async ()=>{
        try{
          const pid = parseInt(productSelect.value);
          const option = productSelect.querySelector(`option[value="${pid}"]`);
          const isBottleProduct = option && option.getAttribute('data-is-bottle') === 'true';
          
          // Show/hide bottle options based on product type
          const bottleOptionsWrap = document.getElementById('bottleOptionsWrap');
          if(bottleOptionsWrap){
            bottleOptionsWrap.style.display = isBottleProduct ? 'none' : '';
          }
          
          const srcs = await fetchJSON('/api/product_sources');
          const mapping = (srcs || []).find(m => parseInt(m.product_id) === pid);
          if(mapping && mapping.factor){
            const size = parseInt(mapping.factor);
            const bs = document.getElementById('newOrderBottleSize');
            if(bs){
              // if the option exists, set; otherwise keep default
              const opt = bs.querySelector(`option[value="${size}"]`);
              if(opt) bs.value = String(size);
            }
          }
          
          // Update summary
          updateNewOrderSummary();
        }catch(e){/* ignore */}
      });
    }
    
    // Wire up live summary update with guards
    ['newOrderProduct', 'newOrderQty', 'newOrderBottle', 'newOrderBottleSize', 'newOrderBottleCount'].forEach(id => {
      const elem = document.getElementById(id);
      if(elem) {
        elem.addEventListener('change', updateNewOrderSummary);
        elem.addEventListener('input', updateNewOrderSummary);
      }
    });
    
    // Initial summary
    updateNewOrderSummary();
  } catch(e) {
    console.error('loadNewOrderForm error', e);
    el.innerHTML = '<div class="text-danger">Failed to load order form.</div>';
  }
}

// Update the summary display for new order
function updateNewOrderSummary(){
  try {
    const productSelect = document.getElementById('newOrderProduct');
    const qtyInput = document.getElementById('newOrderQty');
    const summaryDiv = document.getElementById('newOrderSummary');
    const summaryText = document.getElementById('newOrderSummaryText');
    
    if(!productSelect || !qtyInput || !summaryDiv || !summaryText) {
      return; // Elements not ready
    }
    
    const productId = productSelect.value;
    const option = productSelect.querySelector(`option[value="${productId}"]`);
    if(!option) return;
    
    const price = parseFloat(option.getAttribute('data-price') || 0);
    const qty = parseFloat(qtyInput.value || 1);
    let total = price * qty;
    
    const productName = option.textContent.split(' — ')[0];
    const isBottleProduct = option.getAttribute('data-is-bottle') === 'true';
    
    let extra = '';
    
    // Only show bottle options if the product is NOT a bottle
    if(!isBottleProduct){
      try{
        const useBottle = document.getElementById('newOrderBottle') && document.getElementById('newOrderBottle').value === 'true';
        if(useBottle){
          const bs = document.getElementById('newOrderBottleSize');
          const bc = document.getElementById('newOrderBottleCount');
          const sizeText = bs ? (bs.value + ' L') : '';
          const countText = bc ? bc.value : Math.ceil(qty);
          
          // Find bottle product price
          let bottlePrice = 0;
          if(window._products){
            const bottleProductName = `Empty ${bs ? bs.value : 5}L bottle`;
            const bottleProduct = window._products.find(p => p.name === bottleProductName);
            if(bottleProduct) bottlePrice = parseFloat(bottleProduct.unit_price || 0);
          }
          
          const bottleTotal = bottlePrice * countText;
          total += bottleTotal;
          extra = `<br/><small>Bottle: ${sizeText} — Count: ${countText} @ ${bottlePrice.toFixed(2)} KSH each = ${bottleTotal.toFixed(2)} KSH</small>`;
        }
      }catch(e){/* ignore */}
    }
    
    summaryText.innerHTML = `
      <strong>${productName}</strong> × ${qty} @ ${price.toFixed(2)} KSH each = ${(price * qty).toFixed(2)} KSH
      ${extra}
      <br/><strong>Total: ${total.toFixed(2)} KSH</strong>
    `;
    summaryDiv.style.display = 'block';
  } catch(e) {
    console.error('updateNewOrderSummary error', e);
  }
}

// Submit the new order from the dashboard form
async function submitNewOrder(){
  try {
    const productSelect = document.getElementById('newOrderProduct');
    const product_id = parseInt(productSelect.value);
    const quantity = parseFloat(document.getElementById('newOrderQty').value) || 1;
    const payment_method = document.getElementById('newOrderPayment').value || 'Cash';
    const order_date = document.getElementById('newOrderDate').value;
    
    if(!product_id || quantity <= 0) {
      alert('Please select a valid product and quantity.');
      return;
    }
    
    // Check if the selected product is a bottle product
    const option = productSelect.querySelector(`option[value="${product_id}"]`);
    const isBottleProduct = option && option.getAttribute('data-is-bottle') === 'true';
    
    // Validate date is not in future
    if(order_date) {
      const selectedDate = new Date(order_date).getTime();
      const today = new Date().toISOString().split('T')[0];
      const todayTime = new Date(today).getTime();
      if(selectedDate > todayTime) {
        alert('Order date cannot be in the future.');
        return;
      }
    }
    
    // Build payload
    let payload = {
      product_id,
      quantity,
      payment_method,
      order_date
    };
    
    // If it's a bottle product, don't add bottle-related fields
    if(isBottleProduct) {
      // Bottle is the main product, no additional bottle charge
      payload.use_bottle = false;
    } else {
      // It's a water product, check if bottles are being purchased
      const use_bottle = document.getElementById('newOrderBottle') && document.getElementById('newOrderBottle').value === 'true';
      const bottle_size = document.getElementById('newOrderBottleSize') ? parseInt(document.getElementById('newOrderBottleSize').value) : null;
      const bottle_count_input = document.getElementById('newOrderBottleCount');
      const bottle_count = bottle_count_input ? parseInt(bottle_count_input.value) : null;
      
      payload.use_bottle = use_bottle;
      if(use_bottle){
        payload.bottles_used = (Number.isInteger(quantity) ? Math.ceil(quantity) : Math.ceil(quantity));
        payload.bottle_size = bottle_size;
        
        // Calculate bottle price if applicable
        let bottle_price = 0;
        if(bottle_size && window._products){
          const bottleProductName = `Empty ${bottle_size}L bottle`;
          const bottleProduct = window._products.find(p => p.name === bottleProductName);
          if(bottleProduct) bottle_price = parseFloat(bottleProduct.unit_price || 0);
        }
        payload.bottle_price = bottle_price;
      }
    }
    
    console.log('Submitting order:', payload);
    
    let resp, body;
    try{
      resp = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'same-origin'
      });
      body = await resp.json().catch(() => ({}));
      console.log('Order response:', resp.status, body);
      if(!resp.ok){
        const msg = body && body.error ? body.error : `HTTP ${resp.status}`;
        alert('Failed to create order: ' + msg);
        return;
      }
      alert('Order created successfully! (ID: ' + (body.id || '-') + ')');
    }catch(fetchErr){
      console.warn('Network error when submitting order, saving offline', fetchErr);
      // Save to offline outbox if available
      try{
        if(window.offlineQueue && typeof window.offlineQueue.save === 'function'){
          await window.offlineQueue.save(payload);
          alert('You are offline. Order saved locally and will sync when online.');
        } else {
          alert('Network error and offline queue unavailable: ' + (fetchErr.message||fetchErr));
        }
      }catch(saveErr){
        console.error('Failed to save offline order', saveErr);
        alert('Failed to save order for later: ' + (saveErr.message||saveErr));
      }
      // reset form even when queued
      document.getElementById('newOrderQty').value = '1';
      document.getElementById('newOrderPayment').value = 'Cash';
      document.getElementById('newOrderBottle').value = 'false';
      document.getElementById('newOrderDate').value = new Date().toISOString().split('T')[0];
      updateNewOrderSummary();
      return;
    }
    
    // Reset form
    document.getElementById('newOrderQty').value = '1';
    document.getElementById('newOrderPayment').value = 'Cash';
    document.getElementById('newOrderBottle').value = 'false';
    document.getElementById('newOrderDate').value = new Date().toISOString().split('T')[0];
    updateNewOrderSummary();
  }catch(e){
    console.error('submitNewOrder error', e);
    alert('Error: ' + e.message);
  }
}

// Ensure stock UI refreshes after creating an order (admins)
// Patch: after order creation we should reload stock for admin users.

// Read-only inventory view for regular users
async function loadInventoryReadOnly(){
  const el = document.getElementById('inventoryWaterStockBody'); 
  if(!el) return;
  try{
    el.innerHTML = 'Loading inventory...';
    const [sources, inventory] = await Promise.all([
      fetchJSON('/api/sources').catch(()=>[]),
      fetchJSON('/api/stock').catch(()=>[])
    ]);
    el.innerHTML = '';
    const hdr = document.createElement('div'); hdr.className = 'mb-3';
    hdr.innerHTML = `<p class='text-muted'><strong>View Only:</strong> Contact admin to modify inventory.</p>`;
    el.appendChild(hdr);
    
    const wrp = document.createElement('div'); wrp.className = 'table-wrapper';
    const tbl = document.createElement('table'); tbl.className = 'modern-table';
    tbl.innerHTML = '<thead><tr><th>Type</th><th>Name</th><th style="width:160px">Quantity</th></tr></thead>';
    const tbody = document.createElement('tbody');
    
    (sources||[]).forEach(s=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>Tank</td><td><strong>${s.name}</strong></td><td>${parseFloat(s.quantity||0).toFixed(2)} ${s.unit||'L'}</td>`;
      tbody.appendChild(tr);
    });
    
    const invByName = {};
    (inventory||[]).forEach(i=>{ const k = (i.product_name||'Unknown'); invByName[k] = (invByName[k]||0) + parseFloat(i.quantity||0); });
    Object.keys(invByName).forEach(name => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>Bottle</td><td>${name}</td><td>${parseFloat(invByName[name]||0).toFixed(0)}</td>`;
      tbody.appendChild(tr);
    });
    
    tbl.appendChild(tbody);
    wrp.appendChild(tbl);
    el.appendChild(wrp);
  }catch(e){ console.error('loadInventoryReadOnly', e); el.innerHTML = '<div class="text-danger">Failed to load inventory</div>'; }
}

// Load and display admin price management interface
async function loadAdminManagePrices(){
  try{
    const el = document.getElementById('adminPricesBody');
    if(!el) return;
    el.innerHTML = 'Loading prices...';
    
    // Fetch all products
    const products = await fetchJSON('/api/products');
    
    // Filter to water products and bottle products
    const waterProducts = products.filter(p => p.name.toLowerCase().includes('water'));
    const bottleProducts = products.filter(p => p.name.toLowerCase().includes('bottle') || p.name.toLowerCase().includes('empty'));
    
    if(waterProducts.length === 0 && bottleProducts.length === 0){
      el.innerHTML = '<div class="alert alert-info">No water or bottle products found.</div>';
      return;
    }
    
    // Create a form to edit prices
    let html = '<div class="table-responsive"><table class="table table-sm table-bordered align-middle"><thead><tr><th>Product Name</th><th style="width:150px">Current Price</th><th style="width:150px">New Price</th><th style="width:100px">Action</th></tr></thead><tbody>';
    
    // Add water products section
    if(waterProducts.length > 0){
      html += '<tr class="table-info"><td colspan="4"><strong>💧 Water Products</strong></td></tr>';
      waterProducts.forEach(p => {
        html += `
          <tr>
            <td>${p.name}</td>
            <td>${parseFloat(p.unit_price || 0).toFixed(2)} KSH</td>
            <td><input type="number" class="form-control form-control-sm price-input" data-product-id="${p.id}" data-old-price="${p.unit_price}" value="${p.unit_price}" step="0.01" min="0"></td>
            <td><button class="btn btn-sm btn-primary update-price-btn" data-product-id="${p.id}">Update</button></td>
          </tr>
        `;
      });
    }
    
    // Add bottle products section
    if(bottleProducts.length > 0){
      html += '<tr class="table-warning"><td colspan="4"><strong>🔋 Empty Bottle Products</strong></td></tr>';
      bottleProducts.forEach(p => {
        html += `
          <tr>
            <td>${p.name}</td>
            <td>${parseFloat(p.unit_price || 0).toFixed(2)} KSH</td>
            <td><input type="number" class="form-control form-control-sm price-input" data-product-id="${p.id}" data-old-price="${p.unit_price}" value="${p.unit_price}" step="0.01" min="0"></td>
            <td><button class="btn btn-sm btn-primary update-price-btn" data-product-id="${p.id}">Update</button></td>
          </tr>
        `;
      });
    }
    
    html += '</tbody></table></div>';
    el.innerHTML = html;
    
    // Wire up update buttons
    el.querySelectorAll('.update-price-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const productId = btn.getAttribute('data-product-id');
        const input = el.querySelector(`[data-product-id="${productId}"]`);
        const newPrice = parseFloat(input.value);
        const oldPrice = parseFloat(input.getAttribute('data-old-price'));
        
        if(isNaN(newPrice) || newPrice < 0){
          alert('Please enter a valid price');
          return;
        }
        
        if(newPrice === oldPrice){
          alert('Price is the same, no update needed');
          return;
        }
        
        btn.disabled = true;
        btn.textContent = 'Updating...';
        
        try{
          const response = await fetch('/api/products/' + productId, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            credentials: 'same-origin',
            body: JSON.stringify({ unit_price: newPrice })
          });
          
          if(!response.ok){
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to update price');
          }
          
          const result = await response.json();
          input.setAttribute('data-old-price', newPrice);
          alert(`Price updated successfully! ${result.name}: ${newPrice} KSH`);
          
          // Reload prices to refresh the display
          await loadAdminManagePrices();
        }catch(err){
          alert('Error updating price: ' + err.message);
          btn.disabled = false;
          btn.textContent = 'Update';
        }
      });
    });
    
  }catch(e){
    console.error('loadAdminManagePrices failed', e);
    const el = document.getElementById('adminPricesBody');
    if(el) el.innerHTML = '<div class="alert alert-danger">Failed to load prices: ' + e.message + '</div>';
  }
}
