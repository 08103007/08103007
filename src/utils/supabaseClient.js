/**
 * Lightweight Supabase REST API Client (Zero external dependencies)
 * Supports Quotes, Products, Customers & App Settings tables on Supabase PostgreSQL.
 */

export const LS_SB_URL = "pmc_sb_url_v1";
export const LS_SB_KEY = "pmc_sb_key_v1";

export const DEFAULT_SB_URL = "https://iwkkkewyjjuwnsmmtkdj.supabase.co";

export function getSupabaseUrl() {
  const pfx = localStorage.getItem("pmc_app_prefix") || "default";
  const custom = localStorage.getItem(LS_SB_URL) 
    || localStorage.getItem(`${LS_SB_URL}_${pfx}`) 
    || localStorage.getItem(`${LS_SB_URL}_default`) 
    || DEFAULT_SB_URL;
  return (custom || "").trim();
}

export function setSupabaseUrl(url) {
  const pfx = localStorage.getItem("pmc_app_prefix") || "default";
  const val = (url || "").trim();
  localStorage.setItem(LS_SB_URL, val);
  localStorage.setItem(`${LS_SB_URL}_${pfx}`, val);
}

export function getSupabaseKey() {
  const pfx = localStorage.getItem("pmc_app_prefix") || "default";
  const custom = localStorage.getItem(LS_SB_KEY) 
    || localStorage.getItem(`${LS_SB_KEY}_${pfx}`) 
    || localStorage.getItem(`${LS_SB_KEY}_default`) 
    || "";
  return (custom || "").trim();
}

export function setSupabaseKey(key) {
  const pfx = localStorage.getItem("pmc_app_prefix") || "default";
  const val = (key || "").trim();
  localStorage.setItem(LS_SB_KEY, val);
  localStorage.setItem(`${LS_SB_KEY}_${pfx}`, val);
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

async function fetchWithRetry(url, options = {}, retries = 2, delayMs = 300) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fetch(url, options);
    } catch (err) {
      if (i === retries) throw err;
      await new Promise(r => setTimeout(r, delayMs * (i + 1)));
    }
  }
}

/**
 * Fetch all quotes from Supabase (Fast direct fetch with fallback pagination)
 */
export async function fetchSupabaseQuotes() {
  if (!hasSupabase()) {
    console.log("ℹ️ Supabase chưa được cấu hình hoặc chưa nhập Key");
    return [];
  }

  console.log("⚡ Supabase: Đang kết nối tải danh sách báo giá...");

  // Cách 1: Tải nhanh trực tiếp 1 request
  try {
    const directUrl = `${getSupabaseUrl()}/rest/v1/quotes?select=*`;
    const resp = await fetchWithRetry(directUrl, { headers: getHeaders() }, 1, 200);
    if (resp && resp.ok) {
      const rows = await resp.json();
      if (Array.isArray(rows) && rows.length > 0) {
        console.log(`⚡ Supabase: Đã tải thành công ${rows.length} báo giá`);
        return rows.map(r => {
          if (r.payload && typeof r.payload === "object") {
            return { ...r.payload, id: r.id || r.payload.id, quoteNumber: r.quote_number || r.payload.quoteNumber, payload: r.payload };
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
      }
    }
  } catch(err) {
    console.warn("Direct quotes fetch failed, fallback to chunked pagination:", err.message);
  }

  // Cách 2: Phân trang theo từng chunk nếu request trực tiếp bị nghẽn gói tin
  const allRows = [];
  const limit = 100;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    try {
      const url = `${getSupabaseUrl()}/rest/v1/quotes?select=*&limit=${limit}&offset=${offset}`;
      const resp = await fetchWithRetry(url, { headers: getHeaders() }, 2, 250);
      if (!resp.ok) {
        hasMore = false;
        break;
      }
      const rows = await resp.json();
      if (Array.isArray(rows)) {
        allRows.push(...rows);
        if (rows.length < limit) {
          hasMore = false;
        } else {
          offset += limit;
        }
      } else {
        hasMore = false;
      }
    } catch (err) {
      console.warn(`Lỗi chunk offset ${offset}:`, err.message);
      hasMore = false;
    }
  }

  if (allRows.length === 0) return [];

  console.log(`⚡ Supabase (Phân trang): Đã tải thành công ${allRows.length} báo giá`);
  return allRows.map(r => {
    if (r.payload && typeof r.payload === "object") {
      return { ...r.payload, id: r.id || r.payload.id, quoteNumber: r.quote_number || r.payload.quoteNumber, payload: r.payload };
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

      const url = `${getSupabaseUrl()}/rest/v1/quotes?on_conflict=id`;
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
      const sysUrl = `${getSupabaseUrl()}/rest/v1/quotes?on_conflict=id`;
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

      const url = `${getSupabaseUrl()}/rest/v1/products?on_conflict=id`;
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
    const url = `${getSupabaseUrl()}/rest/v1/debt_reconciliations?on_conflict=id`;
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
    const url = `${getSupabaseUrl()}/rest/v1/payment_requests?on_conflict=id`;
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
    const url = `${getSupabaseUrl()}/rest/v1/handovers?on_conflict=id`;
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
 * Sync Customers to customers table
 */
export async function upsertSupabaseCustomers(customers) {
  if (!hasSupabase() || !Array.isArray(customers) || customers.length === 0) return false;
  try {
    const chunkSize = 50;
    for (let i = 0; i < customers.length; i += chunkSize) {
      const chunk = customers.slice(i, i + chunkSize);
      const rows = chunk.map((c, idx) => ({
        id: c.id || `c_${idx}_${Date.now()}`,
        customer: c.customer || "",
        short_name: c.shortName || "",
        contact: c.contact || "",
        address: c.address || "",
        tax_id: c.taxId || "",
        phone: c.phone || "",
        email: c.email || "",
        notes: c.notes || "",
        payload: c,
        updated_at: new Date().toISOString()
      }));

      const url = `${getSupabaseUrl()}/rest/v1/customers?on_conflict=id`;
      await fetch(url, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(rows)
      });
    }
    return true;
  } catch (e) {
    console.warn("Supabase customer upsert error:", e);
    return false;
  }
}

export async function fetchSupabaseCustomers() {
  if (!hasSupabase()) return [];
  try {
    const url = `${getSupabaseUrl()}/rest/v1/customers?select=*`;
    const resp = await fetch(url, { headers: getHeaders() });
    if (!resp.ok) return [];
    const rows = await resp.json();
    if (!Array.isArray(rows)) return [];
    return rows.map(r => {
      if (r.payload && typeof r.payload === "object") {
        return { ...r.payload, id: r.id || r.payload.id, customer: r.customer || r.payload.customer };
      }
      return {
        id: r.id,
        customer: r.customer || "",
        shortName: r.short_name || "",
        contact: r.contact || "",
        address: r.address || "",
        taxId: r.tax_id || "",
        phone: r.phone || "",
        email: r.email || "",
        notes: r.notes || "",
        updatedAt: r.updated_at
      };
    });
  } catch (err) {
    console.warn("Lỗi tải Khách Hàng từ Supabase:", err);
    return [];
  }
}

export async function deleteSupabaseCustomer(id) {
  if (!hasSupabase() || !id) return false;
  try {
    const url = `${getSupabaseUrl()}/rest/v1/customers?id=eq.${encodeURIComponent(id)}`;
    const resp = await fetch(url, { method: "DELETE", headers: getHeaders() });
    return resp.ok;
  } catch { return false; }
}

/**
 * Sync Tasks to tasks table
 */
export async function upsertSupabaseTasks(tasks) {
  if (!hasSupabase() || !Array.isArray(tasks) || tasks.length === 0) return false;
  try {
    const chunkSize = 50;
    for (let i = 0; i < tasks.length; i += chunkSize) {
      const chunk = tasks.slice(i, i + chunkSize);
      const rows = chunk.map((t, idx) => ({
        id: t.id || `t_${idx}_${Date.now()}`,
        title: t.title || "",
        description: t.description || "",
        status: t.status || "todo",
        priority: t.priority || "medium",
        progress: t.progress || 0,
        due_date: t.dueDate || "",
        quote_id: t.quoteId || "",
        payload: t,
        updated_at: new Date().toISOString()
      }));

      const url = `${getSupabaseUrl()}/rest/v1/tasks?on_conflict=id`;
      await fetch(url, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(rows)
      });
    }
    return true;
  } catch (e) {
    console.warn("Supabase tasks upsert error:", e);
    return false;
  }
}

export async function fetchSupabaseTasks() {
  if (!hasSupabase()) return [];
  try {
    const url = `${getSupabaseUrl()}/rest/v1/tasks?select=*`;
    const resp = await fetch(url, { headers: getHeaders() });
    if (!resp.ok) return [];
    const rows = await resp.json();
    if (!Array.isArray(rows)) return [];
    return rows.map(r => {
      if (r.payload && typeof r.payload === "object") {
        return { ...r.payload, id: r.id || r.payload.id, title: r.title || r.payload.title };
      }
      return {
        id: r.id,
        title: r.title || "",
        description: r.description || "",
        status: r.status || "todo",
        priority: r.priority || "medium",
        progress: Number(r.progress) || 0,
        dueDate: r.due_date || "",
        quoteId: r.quote_id || "",
        updatedAt: r.updated_at
      };
    });
  } catch (err) {
    console.warn("Lỗi tải Công Việc từ Supabase:", err);
    return [];
  }
}

export async function deleteSupabaseTask(id) {
  if (!hasSupabase() || !id) return false;
  try {
    const url = `${getSupabaseUrl()}/rest/v1/tasks?id=eq.${encodeURIComponent(id)}`;
    const resp = await fetch(url, { method: "DELETE", headers: getHeaders() });
    return resp.ok;
  } catch { return false; }
}

/**
 * Sync Notes to notes table
 */
export async function upsertSupabaseNotes(notes) {
  if (!hasSupabase() || !Array.isArray(notes) || notes.length === 0) return false;
  try {
    const chunkSize = 50;
    for (let i = 0; i < notes.length; i += chunkSize) {
      const chunk = notes.slice(i, i + chunkSize);
      const rows = chunk.map((n, idx) => ({
        id: n.id || `n_${idx}_${Date.now()}`,
        title: n.title || "",
        body: n.body || "",
        pinned: !!n.pinned,
        color: n.color || "#fff9db",
        payload: n,
        updated_at: new Date().toISOString()
      }));

      const url = `${getSupabaseUrl()}/rest/v1/notes?on_conflict=id`;
      await fetch(url, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(rows)
      });
    }
    return true;
  } catch (e) {
    console.warn("Supabase notes upsert error:", e);
    return false;
  }
}

export async function fetchSupabaseNotes() {
  if (!hasSupabase()) return [];
  try {
    const url = `${getSupabaseUrl()}/rest/v1/notes?select=*`;
    const resp = await fetch(url, { headers: getHeaders() });
    if (!resp.ok) return [];
    const rows = await resp.json();
    if (!Array.isArray(rows)) return [];
    return rows.map(r => {
      if (r.payload && typeof r.payload === "object") {
        return { ...r.payload, id: r.id || r.payload.id, title: r.title || r.payload.title, pinned: r.pinned !== undefined ? !!r.pinned : !!r.payload.pinned };
      }
      return {
        id: r.id,
        title: r.title || "",
        body: r.body || "",
        pinned: !!r.pinned,
        color: r.color || "#fff9db",
        tags: [],
        updatedAt: r.updated_at
      };
    });
  } catch (err) {
    console.warn("Lỗi tải Ghi Chú từ Supabase:", err);
    return [];
  }
}

export async function deleteSupabaseNote(id) {
  if (!hasSupabase() || !id) return false;
  try {
    const url = `${getSupabaseUrl()}/rest/v1/notes?id=eq.${encodeURIComponent(id)}`;
    const resp = await fetch(url, { method: "DELETE", headers: getHeaders() });
    return resp.ok;
  } catch { return false; }
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
    const url = `${getSupabaseUrl()}/rest/v1/app_settings?on_conflict=key`;
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
 * 1-Click Master Data Migration from Local Memory & Storage to Supabase Cloud (Syncs all 9 tables)
 */
export async function migrateAllLocalDataToSupabase(_mem, company, contractDefaults, productCatalog) {
  if (!hasSupabase()) throw new Error("Chưa kết nối Supabase URL và Key");
  
  let quotesCount = 0;
  let productsCount = 0;
  let customersCount = 0;
  let tasksCount = 0;
  let notesCount = 0;
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

  // 3. Upload Customers (customers table)
  if (Array.isArray(_mem.customers) && _mem.customers.length > 0) {
    await upsertSupabaseCustomers(_mem.customers);
    customersCount = _mem.customers.length;
  }

  // 4. Upload Tasks (tasks table)
  if (Array.isArray(_mem.tasks) && _mem.tasks.length > 0) {
    await upsertSupabaseTasks(_mem.tasks);
    tasksCount = _mem.tasks.length;
  }

  // 5. Upload Notes (notes table)
  if (Array.isArray(_mem.notes) && _mem.notes.length > 0) {
    await upsertSupabaseNotes(_mem.notes);
    notesCount = _mem.notes.length;
  }

  // 6. Upload Debt Reconciliations (debt_reconciliations table)
  if (_mem.debtRecs && typeof _mem.debtRecs === "object") {
    await upsertSupabaseDebtRecs(_mem.debtRecs);
    debtRecsCount = Object.keys(_mem.debtRecs).length;
  }

  // 7. Upload Payment Requests (payment_requests table)
  if (_mem.paymentRequests && typeof _mem.paymentRequests === "object") {
    await upsertSupabasePaymentRequests(_mem.paymentRequests);
    payReqsCount = Object.keys(_mem.paymentRequests).length;
  }

  // 8. Upload Handovers (handovers table)
  if (_mem.handovers && typeof _mem.handovers === "object") {
    await upsertSupabaseHandovers(_mem.handovers);
    handoversCount = Object.keys(_mem.handovers).length;
  }

  // 9. Upload Master Settings (app_settings table)
  await upsertSupabaseSettings("master_settings", settingsData);

  return { quotesCount, productsCount, customersCount, tasksCount, notesCount, debtRecsCount, payReqsCount, handoversCount, contractsCount, deliveriesCount };
}

export const SUPABASE_SQL_SCHEMA = `-- CÂU LỆNH MẪU TẠO ĐẦY ĐỦ BẢNG TRÊN SUPABASE (SQL EDITOR):

-- 1. Báo giá
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

-- 2. Sản phẩm & Hàng hóa
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

-- 3. Khách hàng
create table if not exists customers (
  id text primary key,
  customer text,
  short_name text,
  contact text,
  address text,
  tax_id text,
  phone text,
  email text,
  notes text,
  payload jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 4. Công việc
create table if not exists tasks (
  id text primary key,
  title text,
  description text,
  status text default 'todo',
  priority text default 'medium',
  progress numeric default 0,
  due_date text,
  quote_id text,
  payload jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 5. Ghi chú nội bộ
create table if not exists notes (
  id text primary key,
  title text,
  body text,
  pinned boolean default false,
  color text,
  payload jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 6. Biên bản bàn giao & Giao hàng
create table if not exists handovers (
  id text primary key,
  quote_id text,
  ref_num text,
  customer text,
  date text,
  payload jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 7. Biên bản đối chiếu công nợ
create table if not exists debt_reconciliations (
  id text primary key,
  ref_num text,
  buyer_name text,
  date_str text,
  amount numeric default 0,
  payload jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 8. Đề nghị thanh toán
create table if not exists payment_requests (
  id text primary key,
  req_number text,
  buyer_name text,
  amount numeric default 0,
  payload jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 9. Cài đặt hệ thống
create table if not exists app_settings (
  key text primary key,
  value jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Phân quyền Row Level Security (RLS) cho phép truy cập qua Anon Key:
alter table quotes enable row level security;
alter table products enable row level security;
alter table customers enable row level security;
alter table tasks enable row level security;
alter table notes enable row level security;
alter table handovers enable row level security;
alter table debt_reconciliations enable row level security;
alter table payment_requests enable row level security;
alter table app_settings enable row level security;

create policy "Public Access Quotes" on quotes for all using (true) with check (true);
create policy "Public Access Products" on products for all using (true) with check (true);
create policy "Public Access Customers" on customers for all using (true) with check (true);
create policy "Public Access Tasks" on tasks for all using (true) with check (true);
create policy "Public Access Notes" on notes for all using (true) with check (true);
create policy "Public Access Handovers" on handovers for all using (true) with check (true);
create policy "Public Access DebtRecs" on debt_reconciliations for all using (true) with check (true);
create policy "Public Access PayReqs" on payment_requests for all using (true) with check (true);
create policy "Public Access Settings" on app_settings for all using (true) with check (true);
`;

