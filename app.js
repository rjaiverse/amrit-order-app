/* ===== Amrit Foods Sales Order App — main logic ===== */
(function () {
  'use strict';

  var AUTH_KEY = 'amrit_auth';

  // --- Auth guard: bounce to gate if not signed in this session ---
  if (sessionStorage.getItem(AUTH_KEY) !== 'ok') {
    window.location.replace('index.html');
    return;
  }

  // --- State ---
  var categories = [];          // from products.json
  var productsBySku = {};       // sku -> product (with category name)
  var order = {};               // sku -> { product, qty }
  var activeCategory = 'all';   // 'all' or a category name
  var searchTerm = '';

  // --- Elements ---
  var el = {
    signOut: document.getElementById('signOutBtn'),
    customer: document.getElementById('customerName'),
    salesperson: document.getElementById('salespersonName'),
    date: document.getElementById('orderDate'),
    notes: document.getElementById('orderNotes'),
    search: document.getElementById('searchInput'),
    tabs: document.getElementById('categoryTabs'),
    catalogue: document.getElementById('catalogue'),
    orderBar: document.getElementById('orderBar'),
    orderCount: document.getElementById('orderCount'),
    orderUnits: document.getElementById('orderUnits'),
    viewOrder: document.getElementById('viewOrderBtn'),
    orderSheet: document.getElementById('orderSheet'),
    orderLines: document.getElementById('orderLines'),
    clearOrder: document.getElementById('clearOrderBtn'),
    submitOrder: document.getElementById('submitOrderBtn'),
    summarySheet: document.getElementById('summarySheet'),
    summaryText: document.getElementById('summaryText'),
    copyBtn: document.getElementById('copyBtn'),
    printBtn: document.getElementById('printBtn'),
    copyStatus: document.getElementById('copyStatus')
  };

  // --- Init ---
  el.date.value = todayISO();
  loadProducts();
  wireEvents();

  function loadProducts() {
    fetch('products.json', { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        categories = (data && data.categories) || [];
        categories.forEach(function (cat) {
          (cat.products || []).forEach(function (p) {
            productsBySku[p.sku] = { sku: p.sku, name: p.name, unit: p.unit, category: cat.name };
          });
        });
        renderTabs();
        renderCatalogue();
      })
      .catch(function (err) {
        el.catalogue.innerHTML =
          '<p class="empty-note">Could not load products.json (' +
          escapeHtml(err.message) + '). Check the file and reload.</p>';
      });
  }

  function wireEvents() {
    el.signOut.addEventListener('click', function () {
      sessionStorage.removeItem(AUTH_KEY);
      window.location.replace('index.html');
    });

    el.search.addEventListener('input', function () {
      searchTerm = el.search.value.trim().toLowerCase();
      renderCatalogue();
    });

    el.viewOrder.addEventListener('click', function () { openSheet(el.orderSheet); renderOrderLines(); });
    el.clearOrder.addEventListener('click', clearOrder);
    el.submitOrder.addEventListener('click', submitOrder);
    el.copyBtn.addEventListener('click', copySummary);
    el.printBtn.addEventListener('click', function () { window.print(); });

    document.querySelectorAll('[data-close-sheet]').forEach(function (n) {
      n.addEventListener('click', function () { closeSheet(el.orderSheet); });
    });
    document.querySelectorAll('[data-close-summary]').forEach(function (n) {
      n.addEventListener('click', function () { closeSheet(el.summarySheet); });
    });
  }

  // --- Rendering: category tabs ---
  function renderTabs() {
    var tabs = [{ name: 'all', label: 'All' }].concat(
      categories.map(function (c) { return { name: c.name, label: c.name }; })
    );
    el.tabs.innerHTML = '';
    tabs.forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'category-tab' + (t.name === activeCategory ? ' active' : '');
      b.textContent = t.label;
      b.addEventListener('click', function () {
        activeCategory = t.name;
        renderTabs();
        renderCatalogue();
      });
      el.tabs.appendChild(b);
    });
  }

  // --- Rendering: catalogue ---
  function renderCatalogue() {
    el.catalogue.innerHTML = '';
    var anyShown = false;

    categories.forEach(function (cat) {
      if (activeCategory !== 'all' && cat.name !== activeCategory) return;

      var matches = (cat.products || []).filter(function (p) {
        if (!searchTerm) return true;
        return (p.name + ' ' + p.sku).toLowerCase().indexOf(searchTerm) !== -1;
      });
      if (!matches.length) return;
      anyShown = true;

      // Only show category heading in "All" view (tabs already label single-category views)
      if (activeCategory === 'all') {
        var h = document.createElement('div');
        h.className = 'cat-heading';
        h.textContent = cat.name;
        el.catalogue.appendChild(h);
      }

      matches.forEach(function (p) {
        el.catalogue.appendChild(productRow(p));
      });
    });

    if (!anyShown) {
      el.catalogue.innerHTML = '<p class="empty-note">No products match your search.</p>';
    }
  }

  function productRow(p) {
    var inOrder = !!order[p.sku];
    var row = document.createElement('div');
    row.className = 'product' + (inOrder ? ' in-order' : '');

    var info = document.createElement('div');
    info.className = 'product-info';
    var nm = document.createElement('div');
    nm.className = 'product-name';
    nm.textContent = p.name;
    var meta = document.createElement('div');
    meta.className = 'product-meta';
    meta.textContent = p.sku + ' · ' + (p.unit || 'unit') +
      (inOrder ? ' · ' + order[p.sku].qty + ' in order' : '');
    info.appendChild(nm);
    info.appendChild(meta);

    var add = document.createElement('button');
    add.className = 'product-add';
    add.type = 'button';
    add.textContent = '+';
    add.setAttribute('aria-label', 'Add ' + p.name);
    add.addEventListener('click', function () { addToOrder(p.sku); });

    row.appendChild(info);
    row.appendChild(add);
    return row;
  }

  // --- Order operations ---
  function addToOrder(sku) {
    var p = productsBySku[sku];
    if (!p) return;
    if (order[sku]) order[sku].qty += 1;
    else order[sku] = { product: p, qty: 1 };
    refreshOrderUi();
  }

  function setQty(sku, qty) {
    if (!order[sku]) return;
    qty = Math.max(0, Math.floor(qty || 0));
    if (qty === 0) delete order[sku];
    else order[sku].qty = qty;
    refreshOrderUi();
    renderOrderLines();
  }

  function clearOrder() {
    if (!orderSkus().length) return;
    if (!window.confirm('Clear the whole order?')) return;
    order = {};
    refreshOrderUi();
    renderOrderLines();
    closeSheet(el.orderSheet);
  }

  function refreshOrderUi() {
    var skus = orderSkus();
    var units = skus.reduce(function (sum, s) { return sum + order[s].qty; }, 0);
    el.orderBar.hidden = skus.length === 0;
    el.orderCount.textContent = String(skus.length);
    el.orderUnits.textContent = units + (units === 1 ? ' unit' : ' units');
    renderCatalogue(); // reflect in-order highlighting / counts
  }

  function renderOrderLines() {
    var skus = orderSkus();
    el.orderLines.innerHTML = '';
    if (!skus.length) {
      el.orderLines.innerHTML = '<p class="empty-note">No items yet. Tap “+” on a product to add it.</p>';
      el.submitOrder.disabled = true;
      return;
    }
    el.submitOrder.disabled = false;

    skus.forEach(function (sku) {
      var item = order[sku];
      var line = document.createElement('div');
      line.className = 'order-line';

      var info = document.createElement('div');
      info.className = 'order-line-info';
      var nm = document.createElement('div');
      nm.className = 'order-line-name';
      nm.textContent = item.product.name;
      var sub = document.createElement('div');
      sub.className = 'order-line-sku';
      sub.textContent = sku + ' · ' + (item.product.unit || 'unit');
      info.appendChild(nm);
      info.appendChild(sub);

      var right = document.createElement('div');
      right.appendChild(stepper(sku, item.qty));
      var rm = document.createElement('button');
      rm.className = 'order-line-remove';
      rm.type = 'button';
      rm.textContent = 'Remove';
      rm.addEventListener('click', function () { setQty(sku, 0); });
      right.appendChild(rm);

      line.appendChild(info);
      line.appendChild(right);
      el.orderLines.appendChild(line);
    });
  }

  function stepper(sku, qty) {
    var wrap = document.createElement('div');
    wrap.className = 'stepper';

    var minus = document.createElement('button');
    minus.type = 'button';
    minus.textContent = '−';
    minus.addEventListener('click', function () { setQty(sku, order[sku].qty - 1); });

    var input = document.createElement('input');
    input.type = 'number';
    input.inputMode = 'numeric';
    input.min = '0';
    input.value = String(qty);
    input.addEventListener('change', function () { setQty(sku, parseInt(input.value, 10)); });

    var plus = document.createElement('button');
    plus.type = 'button';
    plus.textContent = '+';
    plus.addEventListener('click', function () { setQty(sku, order[sku].qty + 1); });

    wrap.appendChild(minus);
    wrap.appendChild(input);
    wrap.appendChild(plus);
    return wrap;
  }

  // --- Submit / summary ---
  function submitOrder() {
    var skus = orderSkus();
    if (!skus.length) return;

    if (!el.customer.value.trim()) {
      window.alert('Please enter a customer name before submitting.');
      closeSheet(el.orderSheet);
      el.customer.focus();
      return;
    }

    el.summaryText.textContent = buildSummary();
    closeSheet(el.orderSheet);
    el.copyStatus.hidden = true;
    openSheet(el.summarySheet);
  }

  function buildSummary() {
    var lines = [];
    lines.push('AMRIT FOODS — SALES ORDER');
    lines.push('==========================');
    lines.push('Customer:    ' + (el.customer.value.trim() || '-'));
    lines.push('Salesperson: ' + (el.salesperson.value.trim() || '-'));
    lines.push('Date:        ' + formatDate(el.date.value));
    lines.push('');
    lines.push('ITEMS');
    lines.push('--------------------------');

    var totalUnits = 0;
    orderSkus().forEach(function (sku) {
      var item = order[sku];
      totalUnits += item.qty;
      // e.g. "  3 x  Basmati Rice 20 lb (bag)  [RC-001]"
      lines.push(
        pad(item.qty, 3) + ' x  ' + item.product.name +
        ' (' + (item.product.unit || 'unit') + ')  [' + sku + ']'
      );
    });

    lines.push('--------------------------');
    lines.push('Total items: ' + orderSkus().length + '  ·  Total units: ' + totalUnits);

    var notes = el.notes.value.trim();
    if (notes) {
      lines.push('');
      lines.push('NOTES');
      lines.push('--------------------------');
      lines.push(notes);
    }
    return lines.join('\n');
  }

  function copySummary() {
    var text = el.summaryText.textContent;
    function done() { el.copyStatus.hidden = false; }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { legacyCopy(text, done); });
    } else {
      legacyCopy(text, done);
    }
  }

  function legacyCopy(text, done) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try { document.execCommand('copy'); done(); }
    catch (e) { window.alert('Copy not supported — select the text manually.'); }
    document.body.removeChild(ta);
  }

  // --- Sheet helpers ---
  // Toggle inline display: the `.sheet { display: flex }` rule overrides the
  // [hidden] attribute, so we must set display directly to actually hide it.
  function openSheet(node) { node.hidden = false; node.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
  function closeSheet(node) { node.hidden = true; node.style.display = 'none'; document.body.style.overflow = ''; }

  // --- Utils ---
  function orderSkus() { return Object.keys(order); }

  function todayISO() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  function formatDate(iso) {
    if (!iso) return '-';
    var parts = iso.split('-');
    if (parts.length !== 3) return iso;
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return parts[2] + ' ' + months[parseInt(parts[1], 10) - 1] + ' ' + parts[0];
  }

  function pad(n, width) {
    var s = String(n);
    while (s.length < width) s = ' ' + s;
    return s;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
})();
