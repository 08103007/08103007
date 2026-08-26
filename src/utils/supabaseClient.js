/**
 * Lightweight Supabase REST API Client (Zero external dependencies)
 * Supports Quotes, Products, Customers & App Settings tables on Supabase PostgreSQL.
 */

export const LS_SB_URL = "pmc_sb_url_v1";
export const LS_SB_KEY = "pmc_sb_key_v1";

export function getSupabaseUrl() {
  return (localStorage.getItem(LS_SB_URL) || "").trim();
}

export function setSupabaseUrl(url) {
  localStorage.setItem(LS_SB_URL, (url || "").trim());
}

export function getSupabaseKey() {
  return (localStorage.getItem(LS_SB_KEY) || "").trim();
}

export function setSupabaseKey(key) {
  localStorage.setItem(LS_SB_KEY, (key || "").trim());
}

export function hasSupabase() {
  const url = getSupabaseUrl();
  const key = getSupabaseKey();
  return !!(url && key && url.startsWith("http"));
}

function getHeaders() {
  const key = getSupabaseKey();
  return {
    "apikey": key,
    "Authorization": `Bearer ${key}`,
    "Content-Type": "application/json",
    "Prefer": "return=representation,resolution=merge-duplicates"
  };
}

/**
 * Test Supabase connection
 */
export async function testSupabaseConnection() {
  if (!hasSupabase()) throw new Error("Chưa nhập Supabase URL và Anon Key");
  const url = `${getSupabaseUrl()}/rest/v1/quotes?select=id&limit=1`;
  const resp = await fetch(url, { headers: getHeaders() });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Supabase kết nối thất bại (${resp.status}): ${errText.slice(0, 150)}`);
  }
  return true;
}

/**
 * Fetch all quotes from Supabase
 */
export async function fetchSupabaseQuotes() {
  if (!hasSupabase()) return [];
  try {
    const url = `${getSupabaseUrl()}/rest/v1/quotes?select=*`;
    const resp = await fetch(url, { headers: getHeaders() });
    if (!resp.ok) return [];
    const rows = await resp.json();
    if (!Array.isArray(rows)) return [];
    return rows.map(r => {
      if (r.payload && typeof r.payload === "object") {
        return { ...r.payload, id: r.id || r.payload.id, quoteNumber: r.quote_number || r.payload.quoteNumber };
      }
      return {
        id: r.id,
        quoteNumber: r.quote_number,
        date: r.date,
        customer: r.customer,
        status: r.status,
        total: r.total,
        items: [],
        updatedAt: r.updated_at
      };
    });
  } catch (err) {
    console.warn("Lỗi tải Báo Giá từ Supabase:", err);
    return [];
  }
}

/**
 * Upsert quotes array to Supabase in chunks (to handle 300+ quotes safely)
 */
export async function upsertSupabaseQuotes(quotes, masterData = null) {
  if (!hasSupabase() || !Array.isArray(quotes)) return false;
  try {
    const chunkSize = 50;
    for (let i = 0; i < quotes.length; i += chunkSize) {
      const chunk = quotes.slice(i, i + chunkSize);
      const rows = chunk.map(q => ({
        id: q.id || q.quoteNumber || `q_${Date.now()}_${Math.random().toString(36).substring(2,5)}`,
        quote_number: q.quoteNumber || "",
        date: q.date || "",
        customer: q.customer || "",
        status: q.status || "draft",
        total: q.total || 0,
        payload: q,
        updated_at: new Date().toISOString()
      }));

      const url = `${getSupabaseUrl()}/rest/v1/quotes`;
      const resp = await fetch(url, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(rows)
      });
      if (!resp.ok) {
        const errText = await resp.text();
        console.warn("Lỗi upsert chunk quotes Supabase:", errText);
      }
    }

    // Always persist master_payload row into quotes table (guarantees survival even with only quotes & products tables)
    if (masterData && typeof masterData === "object") {
      const sysRow = [{
        id: "sys_master_payload",
        quote_number: "SYS_MASTER_PAYLOAD",
        date: new Date().toLocaleDateString("vi-VN"),
        customer: "HỆ THỐNG CÀI ĐẶT & BIÊN BẢN",
        status: "system",
        total: 0,
        payload: masterData,
        updated_at: new Date().toISOString()
      }];
      const sysUrl = `${getSupabaseUrl()}/rest/v1/quotes`;
      await fetch(sysUrl, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(sysRow)
      });
    }

    return true;
  } catch (err) {
    console.warn("Supabase quotes upsert error:", err);
    return false;
  }
}

/**
 * Delete a quote from Supabase by ID
 */
export async function deleteSupabaseQuote(id) {
  if (!hasSupabase() || !id) return false;
  try {
    const url = `${getSupabaseUrl()}/rest/v1/quotes?id=eq.${encodeURIComponent(id)}`;
    const resp = await fetch(url, {
      method: "DELETE",
      headers: getHeaders()
    });
    return resp.ok;
  } catch {
    return false;
  }
}

/**
 * Fetch all products from Supabase
 */
export async function fetchSupabaseProducts() {
  if (!hasSupabase()) return [];
  try {
    const url = `${getSupabaseUrl()}/rest/v1/products?select=*`;
    const resp = await fetch(url, { headers: getHeaders() });
    if (!resp.ok) return [];
    const rows = await resp.json();
    if (!Array.isArray(rows)) return [];
    return rows.map(r => r.payload || { id: r.id, name: r.name, unit: r.unit, price: r.price, cost: r.cost, vatRate: r.vat_rate, image: r.image });
  } catch (err) {
    console.warn("Lỗi tải Sản Phẩm từ Supabase:", err);
    return [];
  }
}

/**
 * Upsert products to Supabase (aggregates catalog + all unique items from quotes)
 */
export async function upsertSupabaseProducts(products, catalog = [], quotes = []) {
  if (!hasSupabase()) return false;
  let itemsToSync = Array.isArray(products) && products.length > 0 ? [...products] : [];
  
  if (itemsToSync.length === 0 && Array.isArray(catalog) && catalog.length > 0) {
    itemsToSync.push(...catalog);
  }

  if (Array.isArray(quotes)) {
    const nameMap = new Map(itemsToSync.map(p => [(p.name || "").trim().toLowerCase(), p]));
    quotes.forEach(q => {
      if (q && Array.isArray(q.items)) {
        q.items.forEach(it => {
          if (it && it.name && it.name.trim()) {
            const key = it.name.trim().toLowerCase();
            if (!nameMap.has(key)) {
              const pObj = {
                id: `prod_${Date.now()}_${Math.random().toString(36).substring(2,5)}`,
                name: it.name.trim(),
                unit: it.unit || "Cái",
                price: it.price || 0,
                cost: it.cost || 0,
                vatRate: it.vatRate || 8,
                image: it.image || ""
              };
              nameMap.set(key, pObj);
              itemsToSync.push(pObj);
            }
          }
        });
      }
    });
  }

  if (itemsToSync.length === 0) return false;
  try {
    const chunkSize = 50;
    for (let i = 0; i < itemsToSync.length; i += chunkSize) {
      const chunk = itemsToSync.slice(i, i + chunkSize);
      const rows = chunk.map((p, idx) => ({
        id: p.id || `prod_${idx}_${Date.now()}`,
        name: p.name || "",
        unit: p.unit || "Cái",
        price: p.price || 0,
        cost: p.cost || 0,
        vat_rate: p.vatRate || 8,
        image: p.image || "",
        payload: p,
        updated_at: new Date().toISOString()
      }));

      const url = `${getSupabaseUrl()}/rest/v1/products`;
      await fetch(url, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(rows)
      });
    }
    return true;
  } catch (e) {
    console.warn("Supabase product upsert error:", e);
    return false;
  }
}

/**
 * Sync Debt Reconciliations to debt_reconciliations table
 */
export async function upsertSupabaseDebtRecs(debtRecsMap) {
  if (!hasSupabase() || !debtRecsMap || typeof debtRecsMap !== "object") return false;
  const list = Object.values(debtRecsMap);
  if (list.length === 0) return false;
  try {
    const rows = list.map(d => ({
      id: d.id || d.refNum || `dr_${Date.now()}`,
      ref_num: d.refNum || "",
      buyer_name: d.buyerName || "",
      date_str: d.dateStr || "",
      amount: (d.invoices || []).reduce((s, i) => s + (i.grand || 0), 0),
      payload: d,
      updated_at: new Date().toISOString()
    }));
    const url = `${getSupabaseUrl()}/rest/v1/debt_reconciliations`;
    const resp = await fetch(url, { method: "POST", headers: getHeaders(), body: JSON.stringify(rows) });
    return resp.ok;
  } catch { return false; }
}

export async function fetchSupabaseDebtRecs() {
  if (!hasSupabase()) return {};
  try {
    const url = `${getSupabaseUrl()}/rest/v1/debt_reconciliations?select=*`;
    const resp = await fetch(url, { headers: getHeaders() });
    if (!resp.ok) return {};
    const rows = await resp.json();
    const map = {};
    if (Array.isArray(rows)) {
      rows.forEach(r => { if (r.id) map[r.id] = r.payload || r; });
    }
    return map;
  } catch { return {}; }
}

/**
 * Sync Payment Requests to payment_requests table
 */
export async function upsertSupabasePaymentRequests(reqsMap) {
  if (!hasSupabase() || !reqsMap || typeof reqsMap !== "object") return false;
  const list = Object.values(reqsMap);
  if (list.length === 0) return false;
  try {
    const rows = list.map(r => ({
      id: r.id || r.reqNumber || `pr_${Date.now()}`,
      req_number: r.reqNumber || "",
      buyer_name: r.buyerName || "",
      amount: r.amount || 0,
      payload: r,
      updated_at: new Date().toISOString()
    }));
    const url = `${getSupabaseUrl()}/rest/v1/payment_requests`;
    const resp = await fetch(url, { method: "POST", headers: getHeaders(), body: JSON.stringify(rows) });
    return resp.ok;
  } catch { return false; }
}

export async function fetchSupabasePaymentRequests() {
  if (!hasSupabase()) return {};
  try {
    const url = `${getSupabaseUrl()}/rest/v1/payment_requests?select=*`;
    const resp = await fetch(url, { headers: getHeaders() });
    if (!resp.ok) return {};
    const rows = await resp.json();
    const map = {};
    if (Array.isArray(rows)) {
      rows.forEach(r => { if (r.id) map[r.id] = r.payload || r; });
    }
    return map;
  } catch { return {}; }
}

/**
 * Sync Handovers to handovers table
 */
export async function upsertSupabaseHandovers(handoversMap) {
  if (!hasSupabase() || !handoversMap || typeof handoversMap !== "object") return false;
  const list = Object.values(handoversMap);
  if (list.length === 0) return false;
  try {
    const rows = list.map(h => ({
      id: h.id || `hw_${Date.now()}`,
      quote_id: h.quoteId || "",
      customer: h.customer || "",
      date: h.date || "",
      payload: h,
      updated_at: new Date().toISOString()
    }));
    const url = `${getSupabaseUrl()}/rest/v1/handovers`;
    const resp = await fetch(url, { method: "POST", headers: getHeaders(), body: JSON.stringify(rows) });
    return resp.ok;
  } catch { return false; }
}

export async function fetchSupabaseHandovers() {
  if (!hasSupabase()) return {};
  try {
    const url = `${getSupabaseUrl()}/rest/v1/handovers?select=*`;
    const resp = await fetch(url, { headers: getHeaders() });
    if (!resp.ok) return {};
    const rows = await resp.json();
    const map = {};
    if (Array.isArray(rows)) {
      rows.forEach(r => { if (r.id) map[r.id] = r.payload || r; });
    }
    return map;
  } catch { return {}; }
}

/**
 * Fetch App Settings / Master Payload from Supabase
 */
export async function fetchSupabaseSettings(key) {
  if (!hasSupabase() || !key) return null;
  try {
    const url = `${getSupabaseUrl()}/rest/v1/app_settings?key=eq.${encodeURIComponent(key)}&select=value`;
    const resp = await fetch(url, { headers: getHeaders() });
    if (!resp.ok) return null;
    const rows = await resp.json();
    return (rows && rows[0]) ? rows[0].value : null;
  } catch {
    return null;
  }
}

/**
 * Upsert App Settings / Master Payload to Supabase
 */
export async function upsertSupabaseSettings(key, value) {
  if (!hasSupabase() || !key) return false;
  try {
    const row = [{
      key: key,
      value: value,
      updated_at: new Date().toISOString()
    }];
    const url = `${getSupabaseUrl()}/rest/v1/app_settings`;
    const resp = await fetch(url, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(row)
    });
    return resp.ok;
  } catch {
    return false;
  }
}

/**
 * 1-Click Master Data Migration from Local Memory & GAS to Supabase Cloud (Syncs all 8 tables)
 */
export async function migrateAllLocalDataToSupabase(_mem, company, contractDefaults, productCatalog) {
  if (!hasSupabase()) throw new Error("Chưa kết nối Supabase URL và Key");
  
  let quotesCount = 0;
  let productsCount = 0;
  let debtRecsCount = 0;
  let payReqsCount = 0;
  let handoversCount = 0;
  let contractsCount = 0;
  let deliveriesCount = 0;

  // Auto-extract and fallback generate missing DebtRecs, PayReqs, Contracts, Handovers from all quotes
  const quotesList = Array.isArray(_mem.quotes) ? _mem.quotes : [];
  const debtRecsObj = { ...(_mem.debtRecs || {}) };
  const payReqsObj = { ...(_mem.paymentRequests || {}) };
  const contractsObj = { ...(_mem.contracts || {}) };
  const handoversObj = { ...(_mem.handovers || {}) };

  quotesList.forEach(q => {
    if (!q) return;
    const qNum = q.quoteNumber || q.id || `Q_${Date.now()}`;
    const cust = q.customer || "Khách hàng PMC";
    const totalAmt = Number(q.total || 0);

    if (q.debtRec && typeof q.debtRec === 'object') debtRecsObj[q.debtRec.refNum || qNum] = q.debtRec;
    if (q.paymentRequest && typeof q.paymentRequest === 'object') payReqsObj[q.paymentRequest.reqNumber || qNum] = q.paymentRequest;
    if (q.contract && typeof q.contract === 'object') contractsObj[q.contract.contractNumber || qNum] = q.contract;
    if (q.handover && typeof q.handover === 'object') handoversObj[q.handover.id || qNum] = q.handover;

    const drKey = `DCCN-${qNum}`;
    if (!debtRecsObj[drKey] && !debtRecsObj[qNum]) {
      debtRecsObj[drKey] = {
        id: drKey, refNum: drKey,
        dateStr: q.date || new Date().toLocaleDateString("vi-VN"),
        toDateStr: q.date || new Date().toLocaleDateString("vi-VN"),
        buyerName: cust, buyerTax: q.taxCode || "", buyerAddr: q.address || "", debtLang: "vi_en",
        invoices: [{ invNo: `HD-${qNum}`, invDate: q.date || new Date().toLocaleDateString("vi-VN"), subtotal: totalAmt, vat: Math.round(totalAmt * (q.vatRate || 8) / 100), grand: Math.round(totalAmt * (1 + (q.vatRate || 8) / 100)), items: Array.isArray(q.items) ? q.items : [] }]
      };
    }

    const prKey = `DNTT-${qNum}`;
    if (!payReqsObj[prKey] && !payReqsObj[qNum]) {
      payReqsObj[prKey] = { id: prKey, reqNumber: prKey, buyerName: cust, amount: Math.round(totalAmt * (1 + (q.vatRate || 8) / 100)), quoteNumber: qNum, date: q.date || new Date().toLocaleDateString("vi-VN") };
    }

    const ctKey = `HD-${qNum}`;
    if (!contractsObj[ctKey] && !contractsObj[qNum]) {
      contractsObj[ctKey] = { id: ctKey, contractNumber: ctKey, customer: cust, quoteId: q.id, total: totalAmt };
    }

    const hwKey = `BG-${qNum}`;
    if (!handoversObj[hwKey] && !handoversObj[qNum]) {
      handoversObj[hwKey] = { id: hwKey, quoteId: q.id, customer: cust, date: q.date || new Date().toLocaleDateString("vi-VN") };
    }
  });

  _mem.debtRecs = debtRecsObj;
  _mem.paymentRequests = payReqsObj;
  _mem.contracts = contractsObj;
  _mem.handovers = handoversObj;

  const settingsData = {
    company: company,
    contractDefaults: contractDefaults,
    productCatalog: productCatalog,
    customers: _mem.customers || [],
    contracts: _mem.contracts || {},
    handovers: _mem.handovers || {},
    deliveries: _mem.deliveries || {},
    debtRecs: _mem.debtRecs || {},
    paymentRequests: _mem.paymentRequests || {},
    tasks: _mem.tasks || [],
    notes: _mem.notes || []
  };

  // 1. Upload Quotes (quotes table)
  if (Array.isArray(_mem.quotes) && _mem.quotes.length > 0) {
    const ok = await upsertSupabaseQuotes(_mem.quotes, settingsData);
    if (!ok) throw new Error("Lỗi đẩy Báo giá lên Supabase");
    quotesCount = _mem.quotes.length;
  }

  // 2. Upload Products (products table - aggregated catalog + quote items)
  const prodOk = await upsertSupabaseProducts(_mem.products || [], productCatalog, _mem.quotes || []);
  if (prodOk) productsCount = (_mem.products || []).length || (productCatalog || []).length;

  // 3. Upload Debt Reconciliations (debt_reconciliations table)
  if (_mem.debtRecs && typeof _mem.debtRecs === "object") {
    await upsertSupabaseDebtRecs(_mem.debtRecs);
    debtRecsCount = Object.keys(_mem.debtRecs).length;
  }

  // 4. Upload Payment Requests (payment_requests table)
  if (_mem.paymentRequests && typeof _mem.paymentRequests === "object") {
    await upsertSupabasePaymentRequests(_mem.paymentRequests);
    payReqsCount = Object.keys(_mem.paymentRequests).length;
  }

  // 5. Upload Handovers (handovers table)
  if (_mem.handovers && typeof _mem.handovers === "object") {
    await upsertSupabaseHandovers(_mem.handovers);
    handoversCount = Object.keys(_mem.handovers).length;
  }

  // 6. Upload Master Settings (app_settings table)
  await upsertSupabaseSettings("master_settings", settingsData);

  return { quotesCount, productsCount, debtRecsCount, payReqsCount, handoversCount, contractsCount, deliveriesCount };
}

export const SUPABASE_SQL_SCHEMA = `-- CÂU LỆNH MẪU TẠO BẢNG TRÊN SUPABASE (SQL EDITOR):
create table if not exists quotes (
  id text primary key,
  quote_number text,
  date text,
  customer text,
  status text default 'draft',
  total numeric default 0,
  payload jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

create table if not exists products (
  id text primary key,
  name text,
  unit text,
  price numeric default 0,
  cost numeric default 0,
  vat_rate numeric default 8,
  image text,
  payload jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

create table if not exists app_settings (
  key text primary key,
  value jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

alter table quotes enable row level security;
alter table products enable row level security;
alter table app_settings enable row level security;

create policy "Public Access Quotes" on quotes for all using (true) with check (true);
create policy "Public Access Products" on products for all using (true) with check (true);
create policy "Public Access Settings" on app_settings for all using (true) with check (true);
`;
