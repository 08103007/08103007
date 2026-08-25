// Cache keys (localStorage – backup offline)
export const LS_GAS_URL   = "pmc_gas_url_v1"; 
export const LS_QUOTES    = "pmc_quotes_v4";
export const LS_PRODUCTS  = "pmc_products_v4";
export const LS_CUSTOMERS = "pmc_customers_v4";
export const LS_CONTRACTS  = "pmc_contracts_v4";
export const LS_HANDOVERS  = "pmc_handovers_v4";
export const LS_TASKS      = "pmc_tasks_v4";
export const LS_NOTES      = "pmc_notes_v4";
export const LS_DELIVERIES = "pmc_deliveries_v4";
export const LS_DEBTRECS   = "pmc_debtrecs_v1"; 
export const LS_TOKEN      = "pmc_session_token";  
export const LS_COMPANY      = "pmc_company_v2";
export const LS_CONTRACTS_DF = "pmc_contracts_df_v2";
export const LS_CATALOG      = "pmc_catalog_v2";

// Dynamic App Instance Prefix (Namespace for running multiple app instances without data collisions)
export function getAppPrefix() {
  let prefix = localStorage.getItem("pmc_app_prefix");
  if (!prefix) {
    prefix = "default";
    try {
      localStorage.setItem("pmc_app_prefix", prefix);
    } catch (e) {}
  }
  return prefix;
}

export function setAppPrefix(newPrefix) {
  const clean = (newPrefix || "").replace(/[^a-zA-Z0-9_-]/g, "").trim();
  if (clean) {
    localStorage.setItem("pmc_app_prefix", clean);
    location.reload();
  }
}

export function getLSKey(key) {
  return `${key}_${getAppPrefix()}`;
}

export function getLS(key) {
  return localStorage.getItem(getLSKey(key));
}

export function setLS(key, val) {
  localStorage.setItem(getLSKey(key), val);
}

export function removeLS(key) {
  localStorage.removeItem(getLSKey(key));
}

// Global company and catalog definitions
export const COMPANY = {};
export const CONTRACT_DEFAULTS = {};
export const PRODUCT_CATALOG = [];

export function getLogoUrl() {
  return (COMPANY.logo && COMPANY.logo.length > 10) ? COMPANY.logo : "";
}

// In-memory store
export const _mem = {
  quotes:    null,
  products:  [],
  customers: [],
  contracts:  {},
  handovers:  {},
  deliveries: {},
  debtRecs:   {},
  paymentRequests: {},
  tasks:      [],
  notes:      [],
};

// GAS_URL getter/setter
export function getGasUrl() { return getLS(LS_GAS_URL) || ""; }
export function setGasUrl(url) { setLS(LS_GAS_URL, url.trim()); }
export function hasGasUrl() { const u = getGasUrl(); return !!u && u !== "PASTE_GAS_URL_HERE"; }

// Toast implementation
export function showToast(msg, duration = 3000) {
  const t = document.createElement("div");
  t.style.cssText = "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1a2540;color:#fff;padding:10px 22px;border-radius:8px;font-size:13px;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,0.3);font-family:'Plus Jakarta Sans',sans-serif;pointer-events:none;";
  t.innerHTML = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), duration);
}

import { 
  hasSupabase, fetchSupabaseQuotes, upsertSupabaseQuotes, deleteSupabaseQuote,
  fetchSupabaseProducts, upsertSupabaseProducts, fetchSupabaseSettings, upsertSupabaseSettings 
} from './supabaseClient';

// Debounce save timer
let _saveTimer = null;
const SAVE_DELAY = 1500; 

export function _scheduleSave() {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(_flushToGAS, SAVE_DELAY);
}

// Flush immediately when tab is hidden or closed
window.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    _flushToLocalStorage();
    if (_saveTimer) {
      clearTimeout(_saveTimer);
      _flushToGAS();
    }
  }
});

window.addEventListener("beforeunload", () => {
  _flushToLocalStorage();
  if (_saveTimer) {
    clearTimeout(_saveTimer);
    _flushToGAS();
  }
});

let _lastSyncedPayloadJson = null;

function _buildSyncPayload() {
  return {
    quotes:    _mem.quotes    ?? [],
    products:  _mem.products,
    customers: _mem.customers,
    contracts:  _mem.contracts,
    handovers:  _mem.handovers,
    deliveries: _mem.deliveries,
    debtRecs:   _mem.debtRecs,
    tasks:      _mem.tasks,
    notes:      _mem.notes,
  };
}

export async function _flushToGAS() {
  const payload = _buildSyncPayload();
  const payloadJson = JSON.stringify(payload);
  if (payloadJson === _lastSyncedPayloadJson) return; 

  _flushToLocalStorage();

  // 1. Primary Cloud Sync: Supabase PostgreSQL (~30ms)
  if (hasSupabase() && Array.isArray(_mem.quotes) && _mem.quotes.length > 0) {
    upsertSupabaseQuotes(_mem.quotes).then(ok => {
      if (ok) console.log("⚡ Đã đồng bộ Supabase Cloud Database thành công");
    });
  }

  // 2. Secondary Cloud Backup: GAS Google Drive
  if (!hasGasUrl()) {
    _lastSyncedPayloadJson = payloadJson;
    return;
  }
  try {
    const token = getLS(LS_TOKEN) || "";
    const resp = await fetch(getGasUrl(), {
      method: "POST",
      redirect: "follow",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        token: token,
        action: "save_all",
        payload: payload,
      }),
    });
    const rawText = await resp.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch(parseErr) {
      console.error("GAS response not JSON:", rawText.slice(0, 300));
      throw new Error("GAS did not respond with valid JSON");
    }
    if (!data.ok) {
      if (data.error === "Unauthorized") { _onGASUnauthorized(); return; }
      throw new Error(data.error || "GAS returned ok:false");
    }
    _lastSyncedPayloadJson = payloadJson;
    showToast("💾 Đã lưu Supabase & Google Drive backup", 1500);
  } catch(e) {
    console.error("GAS save error:", e);
    showToast("⚠️ Lỗi lưu GAS: " + e.message, 5000);
  }
}

export function _flushToLocalStorage() {
  try {
    setLS(LS_QUOTES,    JSON.stringify(_mem.quotes    ?? []));
    setLS(LS_PRODUCTS,  JSON.stringify(_mem.products));
    setLS(LS_CUSTOMERS, JSON.stringify(_mem.customers));
    setLS(LS_CONTRACTS,  JSON.stringify(_mem.contracts));
    setLS(LS_HANDOVERS,  JSON.stringify(_mem.handovers));
    setLS(LS_DELIVERIES, JSON.stringify(_mem.deliveries));
    setLS(LS_DEBTRECS,   JSON.stringify(_mem.debtRecs));
    setLS(LS_TASKS,      JSON.stringify(_mem.tasks));
    setLS(LS_NOTES,      JSON.stringify(_mem.notes));

    setLS(LS_COMPANY,      JSON.stringify(COMPANY));
    setLS(LS_CONTRACTS_DF, JSON.stringify(CONTRACT_DEFAULTS));
    setLS(LS_CATALOG,      JSON.stringify(PRODUCT_CATALOG));

    if (Array.isArray(_mem.quotes) && _mem.quotes.length > 0) {
      setLS("pmc_quotes_emergency_backup", JSON.stringify(_mem.quotes));
    }

    if (_currentFileHandle) {
      writeToLocalJsonFile();
    }
  } catch(e) { console.warn("localStorage full:", e); }
}

export async function doLoad() {
  const localQuotes = mergeAllLocalStorageSources();
  const quoteMap = new Map();

  const addOrMergeQuote = (q) => {
    if (!q) return;
    if (!q.id) {
      q.id = q.quoteNumber ? `q_${q.quoteNumber}_${q.date || ""}` : `q_${Date.now()}_${Math.random().toString(36).substr(2,5)}`;
    }

    const existing = quoteMap.get(q.id);
    if (!existing) {
      quoteMap.set(q.id, q);
    } else {
      const existingLen  = (existing.items && Array.isArray(existing.items)) ? existing.items.length : 0;
      const newLen       = (q.items && Array.isArray(q.items)) ? q.items.length : 0;
      const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime() || 0;
      const newTime      = new Date(q.updatedAt || q.createdAt || 0).getTime() || 0;

      if (newTime > existingTime || (newTime === existingTime && newLen >= existingLen)) {
        quoteMap.set(q.id, q);
      }
    }
  };

  (localQuotes || []).forEach(addOrMergeQuote);

  // 1. Fetch from Supabase Cloud Database (~30ms)
  if (hasSupabase()) {
    try {
      const sbQuotes = await fetchSupabaseQuotes();
      if (Array.isArray(sbQuotes) && sbQuotes.length > 0) {
        sbQuotes.forEach(addOrMergeQuote);
        console.log(`⚡ Supabase Load & Merge: ${sbQuotes.length} báo giá từ Cloud Database`);
      } else if (localQuotes.length > 0) {
        console.log(`🚀 Supabase kết nối nhưng chưa có dữ liệu. Tự động đẩy ${localQuotes.length} báo giá lên Cloud...`);
        upsertSupabaseQuotes(localQuotes).then(ok => {
          if (ok) showToast(`🚀 Đã tự động đẩy ${localQuotes.length} báo giá lên Supabase Cloud!`, 4000);
        });
        if (Array.isArray(_mem.products) && _mem.products.length > 0) {
          upsertSupabaseProducts(_mem.products);
        }
        upsertSupabaseSettings("master_settings", { company: COMPANY, contractDefaults: CONTRACT_DEFAULTS, productCatalog: PRODUCT_CATALOG });
      }

      const sbProducts = await fetchSupabaseProducts();
      if (Array.isArray(sbProducts) && sbProducts.length > 0) {
        _mem.products = sbProducts;
      }

      const sbSettings = await fetchSupabaseSettings("master_settings");
      if (sbSettings && typeof sbSettings === "object") {
        if (sbSettings.company && typeof sbSettings.company === "object") Object.assign(COMPANY, sbSettings.company);
        if (sbSettings.contractDefaults && typeof sbSettings.contractDefaults === "object") Object.assign(CONTRACT_DEFAULTS, sbSettings.contractDefaults);
        if (Array.isArray(sbSettings.productCatalog) && sbSettings.productCatalog.length > 0) {
          PRODUCT_CATALOG.splice(0, PRODUCT_CATALOG.length, ...sbSettings.productCatalog);
        }
      }
    } catch (e) {
      console.warn("Lỗi tải từ Supabase:", e);
    }
  }

  // 2. Fetch from GAS Google Drive Backup
  if (hasGasUrl()) {
    try {
      const token = getLS(LS_TOKEN) || "";
      const url = `${getGasUrl()}?action=load&token=${encodeURIComponent(token)}`;
      const resp = await fetch(url);
      const rawText = await resp.text();
      let data;
      try {
        data = JSON.parse(rawText);
      } catch(parseErr) {
        console.error("GAS load response not JSON:", rawText.slice(0, 300));
        throw new Error("GAS did not respond with valid JSON");
      }
      if (data.ok) {
        const gasQuotes = Array.isArray(data.quotes) ? data.quotes : [];
        gasQuotes.forEach(addOrMergeQuote);

        _mem.products  = Array.isArray(data.products) && data.products.length ? data.products : _mem.products;
        _mem.customers = Array.isArray(data.customers) && data.customers.length ? data.customers : _mem.customers;
        _mem.contracts  = (data.contracts  && typeof data.contracts  === "object") ? { ..._mem.contracts, ...data.contracts } : _mem.contracts;
        _mem.handovers  = (data.handovers   && typeof data.handovers   === "object") ? { ..._mem.handovers, ...data.handovers } : _mem.handovers;
        _mem.deliveries = (data.deliveries  && typeof data.deliveries  === "object") ? { ..._mem.deliveries, ...data.deliveries } : _mem.deliveries;
        _mem.debtRecs   = (data.debtRecs    && typeof data.debtRecs    === "object") ? { ..._mem.debtRecs, ...data.debtRecs } : _mem.debtRecs;
        _mem.tasks      = Array.isArray(data.tasks) && data.tasks.length ? data.tasks : _mem.tasks;
        _mem.notes      = Array.isArray(data.notes) && data.notes.length ? data.notes : _mem.notes;
        
        if (data.company)          Object.assign(COMPANY, data.company);
        if (data.contractDefaults) Object.assign(CONTRACT_DEFAULTS, data.contractDefaults);
        if (Array.isArray(data.productCatalog) && data.productCatalog.length) {
          PRODUCT_CATALOG.splice(0, PRODUCT_CATALOG.length, ...data.productCatalog);
        }
      }
    } catch(e) {
      console.warn("GAS load backup failed, using local/supabase cache:", e);
    }
  }

  _mem.quotes = Array.from(quoteMap.values());
  _flushToLocalStorage();
  _scheduleSave();
  return _mem.quotes ?? [];
}

export function mergeAllLocalStorageSources() {
  const quoteMap = new Map();

  const addQuotes = (raw) => {
    if (!raw) return;
    try {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!Array.isArray(parsed)) return;
      parsed.forEach((q) => {
        if (!q) return;
        if (!q.id) {
          q.id = q.quoteNumber ? `q_${q.quoteNumber}_${q.date || ""}` : `q_${Date.now()}_${Math.random().toString(36).substr(2,5)}`;
        }
        const existing = quoteMap.get(q.id);
        if (!existing) {
          quoteMap.set(q.id, q);
        } else {
          const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime() || 0;
          const newTime      = new Date(q.updatedAt || q.createdAt || 0).getTime() || 0;
          const existingLen  = (existing.items && Array.isArray(existing.items)) ? existing.items.length : 0;
          const newLen       = (q.items && Array.isArray(q.items)) ? q.items.length : 0;

          if (newTime > existingTime || (newTime === existingTime && newLen >= existingLen)) {
            quoteMap.set(q.id, q);
          }
        }
      });
    } catch {}
  };

  // Add in-memory quotes first (e.g. from currently bound local JSON file)
  if (Array.isArray(_mem.quotes) && _mem.quotes.length > 0) {
    addQuotes(_mem.quotes);
  }

  addQuotes(getLS(LS_QUOTES));

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("pmc_quotes")) {
        try {
          addQuotes(localStorage.getItem(k));
        } catch {}
      }
    }
  } catch {}

  return Array.from(quoteMap.values());
}

export function _initFromLocalStorage() {
  _mem.quotes = mergeAllLocalStorageSources();
  try { setLS(LS_QUOTES, JSON.stringify(_mem.quotes)); } catch {}

  try { const p = getLS(LS_PRODUCTS);  _mem.products  = p  ? JSON.parse(p)  : []; } catch { _mem.products = []; }
  try { const c = getLS(LS_CUSTOMERS); _mem.customers = c  ? JSON.parse(c)  : []; } catch { _mem.customers = []; }
  try { const ct= getLS(LS_CONTRACTS);  _mem.contracts  = ct  ? JSON.parse(ct)  : {}; } catch { _mem.contracts  = {}; }
  try { const hw= getLS(LS_HANDOVERS);   _mem.handovers  = hw  ? JSON.parse(hw)  : {}; } catch { _mem.handovers  = {}; }
  try { const dv= getLS(LS_DELIVERIES);  _mem.deliveries = dv  ? JSON.parse(dv)  : {}; } catch { _mem.deliveries = {}; }
  try { const dr= getLS(LS_DEBTRECS);     _mem.debtRecs   = dr  ? JSON.parse(dr)  : {}; } catch { _mem.debtRecs   = {}; }
  try { const tk= getLS(LS_TASKS);        _mem.tasks      = tk  ? JSON.parse(tk)  : []; } catch { _mem.tasks      = []; }
  try { const nt= getLS(LS_NOTES);        _mem.notes      = nt  ? JSON.parse(nt)  : []; } catch { _mem.notes      = []; }

  try { const comp = getLS(LS_COMPANY); if (comp) Object.assign(COMPANY, JSON.parse(comp)); } catch {}
  try { const df = getLS(LS_CONTRACTS_DF); if (df) Object.assign(CONTRACT_DEFAULTS, JSON.parse(df)); } catch {}
  try { const cat = getLS(LS_CATALOG); if (cat) PRODUCT_CATALOG.splice(0, PRODUCT_CATALOG.length, ...JSON.parse(cat)); } catch {}
}

export function loadQuotes() { return Promise.resolve(_mem.quotes ?? []); }
export function saveQuotes(quotes) {
  _mem.quotes = quotes;
  _flushToLocalStorage();
  _scheduleSave();
  return Promise.resolve();
}

export function loadProductCatalog() { return Promise.resolve(_mem.products); }
export function saveProductCatalog(catalog) { _mem.products = catalog; _scheduleSave(); return Promise.resolve(); }

export async function upsertCatalogItems(items) {
  const byName = new Map(_mem.products.map(p => [p.name, p]));
  items.forEach(it => {
    if (!it.name || !it.name.trim()) return;
    const prev = byName.get(it.name) || {};
    byName.set(it.name, {
      name: it.name, note: it.note || "", unit: it.unit || "Cái",
      price: it.price || 0,
      cost:      it.cost      !== undefined ? it.cost      : (prev.cost      || 0),
      costNoVat: it.costNoVat !== undefined ? it.costNoVat : (prev.costNoVat || 0),
      vatRate:   it.vatRate   !== undefined ? it.vatRate   : (prev.vatRate   !== undefined ? prev.vatRate : 8),
      image:     it.image     !== undefined ? it.image     : (prev.image     || ""),
    });
  });
  _mem.products = [...byName.values()];
  _scheduleSave();
}

export async function upsertProductImage(name, image, extra = {}) {
  const byName = new Map(_mem.products.map(p => [p.name, p]));
  const prev = byName.get(name) || { name, note: "", unit: "Cái", price: 0, cost: 0, costNoVat: 0 };
  byName.set(name, { ...prev, ...extra, name, image });
  _mem.products = [...byName.values()];
  _scheduleSave();
}

export function loadCustomerCatalog() { return Promise.resolve(_mem.customers); }
export function saveCustomerCatalog(catalog) { _mem.customers = catalog; _scheduleSave(); return Promise.resolve(); }

export async function upsertCatalogCustomer(cust) {
  if (!cust.customer || !cust.customer.trim()) return;
  const byName = new Map(_mem.customers.map(c => [c.customer, c]));
  byName.set(cust.customer, {
    customer: cust.customer, contact: cust.contact || "",
    address: cust.address || "", taxId: cust.taxId || "", phone: cust.phone || "",
  });
  _mem.customers = [...byName.values()];
  _scheduleSave();
}

export function generateContractNumber(dateObj = new Date(), currentQuoteId = null) {
  let d, m, y;
  if (typeof dateObj === "object" && dateObj.day && dateObj.month && dateObj.year) {
    d = String(dateObj.day).padStart(2, "0");
    m = String(dateObj.month).padStart(2, "0");
    y = String(dateObj.year).slice(-2);
  } else {
    const dt = (dateObj instanceof Date && !isNaN(dateObj)) ? dateObj : new Date();
    d = String(dt.getDate()).padStart(2, "0");
    m = String(dt.getMonth() + 1).padStart(2, "0");
    y = String(dt.getFullYear()).slice(-2);
  }
  const datePattern = `${d}${m}${y}`;

  let count = 1;
  const contractsObj = _mem.contracts || {};
  const existingNumbers = Object.entries(contractsObj)
    .filter(([id, c]) => id !== currentQuoteId && c && c.contractNumber)
    .map(([_, c]) => c.contractNumber);

  const matched = existingNumbers.filter(num => num && num.includes(`-${datePattern}/PMC`));
  count = matched.length + 1;

  const seq = String(count).padStart(2, "0");
  return `${seq}-${datePattern}/PMC`;
}

export function loadContract(quoteId) { return Promise.resolve(_mem.contracts[quoteId] || null); }
export function saveContract(quoteId, contractData) {
  _mem.contracts[quoteId] = { ...contractData, quoteId };
  _flushToLocalStorage();
  _scheduleSave();
  return Promise.resolve();
}

export function loadHandover(id) { return Promise.resolve(_mem.handovers[id] || null); }
export function saveHandover(id, data) {
  _mem.handovers[id] = { ...data, id };
  _flushToLocalStorage();
  _scheduleSave();
  return Promise.resolve();
}

export function loadDelivery(id) { return Promise.resolve(_mem.deliveries[id] || null); }
export function saveDelivery(id, data) {
  _mem.deliveries[id] = { ...data, id };
  _flushToLocalStorage();
  _scheduleSave();
  return Promise.resolve();
}

export function loadDebtRec(id) { return Promise.resolve(_mem.debtRecs[id] || null); }
export function listDebtRecs() { return Promise.resolve(Object.values(_mem.debtRecs || {})); }
export function saveDebtRec(id, data) {
  _mem.debtRecs[id] = { ...data, id, updatedAt: Date.now() };
  _flushToLocalStorage();
  _scheduleSave();
  return Promise.resolve();
}

export function generateDebtRecNumber() {
  const year = new Date().getFullYear();
  const existing = Object.values(_mem.debtRecs || {});
  const countThisYear = existing.filter(r => (r.refNum || "").includes("/" + year)).length;
  const seq = String(countThisYear + 1).padStart(2, "0");
  return `BBDCCN-${seq}/${year}`;
}

export function loadPaymentRequest(id) { return Promise.resolve(_mem.paymentRequests[id] || null); }
export function listPaymentRequests() { return Promise.resolve(Object.values(_mem.paymentRequests || {})); }
export function savePaymentRequest(id, data) {
  _mem.paymentRequests[id] = { ...data, id, updatedAt: Date.now() };
  _flushToLocalStorage();
  _scheduleSave();
  return Promise.resolve();
}

export function generatePaymentRequestNumber() {
  const d = new Date();
  const dateStr = `${String(d.getDate()).padStart(2,"0")}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getFullYear()).slice(-2)}`;
  const existing = Object.values(_mem.paymentRequests || {});
  const count = existing.length + 1;
  return `${String(count).padStart(2,"0")}-${dateStr}/DNTT`;
}

export function loadTasks() { return Promise.resolve([...(_mem.tasks || [])]); }
export function saveTasks(tasks) {
  _mem.tasks = tasks;
  _flushToLocalStorage();
  _scheduleSave();          
  return Promise.resolve();
}

export function loadNotes() { return Promise.resolve([...(_mem.notes || [])]); }
export function saveNotes(notes) {
  _mem.notes = notes;
  _flushToLocalStorage();
  _scheduleSave();
  return Promise.resolve();
}

export function recoverEmergencyBackup() {
  try {
    const backupStr = getLS("pmc_quotes_emergency_backup");
    if (!backupStr) throw new Error("Không tìm thấy dữ liệu sao lưu khẩn cấp");
    const backupQuotes = JSON.parse(backupStr);
    if (!Array.isArray(backupQuotes) || backupQuotes.length === 0) throw new Error("Dữ liệu sao lưu rỗng");

    const currentMap = new Map((_mem.quotes || []).map(q => [q.id, q]));
    backupQuotes.forEach(bq => {
      if (bq && bq.id && !currentMap.has(bq.id)) {
        currentMap.set(bq.id, bq);
      }
    });

    _mem.quotes = Array.from(currentMap.values());
    _flushToLocalStorage();
    _scheduleSave();
    return _mem.quotes;
  } catch(e) {
    throw e;
  }
}

export async function migrateFromLocalStorage() {
  let migrated = false;
  if (!Array.isArray(_mem.quotes) || _mem.quotes.length === 0) {
    const legacyKeys = ["pmc_quotes_emergency_backup", "pmc_quotes_v4", "pmc_quotes_v3", "pmc_quotes_v2", "pmc_quotes_v1", "pmc_quotes"];
    for (const k of legacyKeys) {
      try {
        const q = localStorage.getItem(k);
        if (q) {
          const parsed = JSON.parse(q);
          if (Array.isArray(parsed) && parsed.length > 0) {
            _mem.quotes = parsed;
            migrated = true;
            break;
          }
        }
      } catch {}
    }
  }
  if (migrated) {
    _flushToLocalStorage();
    showToast("✅ Đã tự động khôi phục dữ liệu từ phiên bản cũ", 4000);
  }
}

export function exportToJSON() {
  _flushToLocalStorage();
  const data = {
    quotes: _mem.quotes ?? [],
    products: _mem.products,
    customers: _mem.customers,
    contracts: _mem.contracts,
    handovers: _mem.handovers,
    deliveries: _mem.deliveries,
    debtRecs: _mem.debtRecs,
    tasks: _mem.tasks,
    notes: _mem.notes,
    exportedAt: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = `pmc_baogia_${new Date().toISOString().slice(0,10).replace(/-/g,"")}.json`; a.click();
  URL.revokeObjectURL(url);
  showToast("📤 Đã xuất file JSON");
}

export function importFromJSON(onDone) {
  const input = document.createElement("input");
  input.type = "file"; input.accept = ".json,application/json";
  input.onchange = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.quotes)) throw new Error("File không hợp lệ");
      _mem.quotes    = data.quotes;
      _mem.products  = Array.isArray(data.products)  ? data.products  : [];
      _mem.customers = Array.isArray(data.customers) ? data.customers : [];
      _mem.contracts  = (data.contracts  && typeof data.contracts  === "object") ? data.contracts  : {};
      _mem.handovers  = (data.handovers   && typeof data.handovers   === "object") ? data.handovers  : {};
      _mem.deliveries = (data.deliveries  && typeof data.deliveries  === "object") ? data.deliveries : {};
      _mem.debtRecs   = (data.debtRecs   && typeof data.debtRecs   === "object") ? data.debtRecs   : {};
      await _flushToGAS();
      showToast(`✅ Đã nhập ${data.quotes.length} báo giá từ ${file.name}`);
      if (typeof onDone === "function") onDone(_mem.quotes);
    } catch(e) { showToast("❌ Lỗi nhập file: " + e.message, 5000); }
  };
  input.click();
}

export function isAuthenticated() {
  return !!getLS(LS_TOKEN);
}

export function setSessionToken(token) {
  setLS(LS_TOKEN, token);
}

export async function doLogin(password) {
  if (!hasGasUrl()) {
    throw new Error("Chưa cấu hình GAS_URL");
  }
  const url  = `${getGasUrl()}?action=login&password=${encodeURIComponent(password)}`;
  const resp = await fetch(url);
  const data = JSON.parse(await resp.text());
  if (!data.ok) throw new Error(data.error || "Đăng nhập thất bại");
  setSessionToken(data.token);
  return data.token;
}

export async function logout() {
  clearTimeout(_saveTimer);          
  try { await _flushToGAS(); } catch {} 
  const token = getLS(LS_TOKEN);
  removeLS(LS_TOKEN);
  if (token && hasGasUrl()) {
    try { await fetch(`${getGasUrl()}?action=logout&token=${encodeURIComponent(token)}`); } catch {}
  }
  location.reload();
}

function _onGASUnauthorized() {
  removeLS(LS_TOKEN);
  window.dispatchEvent(new CustomEvent("gas_unauthorized"));
  showToast("⛔ Phiên đăng nhập hết hạn — vui lòng đăng nhập lại", 4000);
}

// --- File System Access API for Direct PC Local JSON File Storage ---
const IDB_STORE = "handles";
let _currentFileHandle = null;

function _openIDB() {
  const dbName = "pmc_file_store_" + getAppPrefix();
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getStoredFileHandle() {
  try {
    const db = await _openIDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get("json_handle");
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function setStoredFileHandle(handle) {
  try {
    const db = await _openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      if (handle) {
        tx.objectStore(IDB_STORE).put(handle, "json_handle");
      } else {
        tx.objectStore(IDB_STORE).delete("json_handle");
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {}
}

export async function initLocalFileHandle() {
  if (typeof window.showOpenFilePicker !== "function") return null;
  if (!_currentFileHandle) {
    _currentFileHandle = await getStoredFileHandle();
  }
  return _currentFileHandle;
}

export function getCurrentFileHandle() {
  return _currentFileHandle;
}

export async function writeToLocalJsonFile() {
  if (!_currentFileHandle) return false;
  try {
    if (typeof _currentFileHandle.queryPermission === "function") {
      const status = await _currentFileHandle.queryPermission({ mode: "readwrite" });
      if (status !== "granted") {
        const req = await _currentFileHandle.requestPermission({ mode: "readwrite" });
        if (req !== "granted") return false;
      }
    }
    const writable = await _currentFileHandle.createWritable();
    const payload = _buildSyncPayload();
    payload.company = COMPANY;
    payload.contractDefaults = CONTRACT_DEFAULTS;
    payload.productCatalog = PRODUCT_CATALOG;
    payload.updatedAt = new Date().toISOString();
    await writable.write(JSON.stringify(payload, null, 2));
    await writable.close();
    return true;
  } catch (e) {
    console.warn("Lỗi ghi file local JSON:", e);
    return false;
  }
}

export async function readFromLocalJsonFile() {
  if (!_currentFileHandle) return false;
  try {
    if (typeof _currentFileHandle.queryPermission === "function") {
      const status = await _currentFileHandle.queryPermission({ mode: "read" });
      if (status !== "granted") {
        const req = await _currentFileHandle.requestPermission({ mode: "read" });
        if (req !== "granted") return false;
      }
    }
    const file = await _currentFileHandle.getFile();
    const text = await file.text();
    if (!text || !text.trim()) return false;
    const data = JSON.parse(text);
    if (Array.isArray(data.quotes)) _mem.quotes = data.quotes;
    if (Array.isArray(data.products)) _mem.products = data.products;
    if (Array.isArray(data.customers)) _mem.customers = data.customers;
    if (data.contracts && typeof data.contracts === "object") _mem.contracts = data.contracts;
    if (data.handovers && typeof data.handovers === "object") _mem.handovers = data.handovers;
    if (data.deliveries && typeof data.deliveries === "object") _mem.deliveries = data.deliveries;
    if (data.debtRecs && typeof data.debtRecs === "object") _mem.debtRecs = data.debtRecs;
    if (data.tasks && Array.isArray(data.tasks)) _mem.tasks = data.tasks;
    if (data.notes && Array.isArray(data.notes)) _mem.notes = data.notes;
    if (data.company && typeof data.company === "object") Object.assign(COMPANY, data.company);
    if (data.contractDefaults && typeof data.contractDefaults === "object") Object.assign(CONTRACT_DEFAULTS, data.contractDefaults);
    if (Array.isArray(data.productCatalog)) PRODUCT_CATALOG.splice(0, PRODUCT_CATALOG.length, ...data.productCatalog);

    _flushToLocalStorage();
    return true;
  } catch (e) {
    console.warn("Lỗi đọc file local JSON:", e);
    return false;
  }
}

export async function selectAndBindLocalJsonFile() {
  if (typeof window.showOpenFilePicker !== "function") {
    throw new Error("Trình duyệt không hỗ trợ File System Access API. Vui lòng dùng Chrome / MS Edge trên PC.");
  }
  const [handle] = await window.showOpenFilePicker({
    types: [{
      description: "File dữ liệu JSON",
      accept: { "application/json": [".json"] }
    }],
    multiple: false
  });
  if (!handle) return null;
  _currentFileHandle = handle;
  await setStoredFileHandle(handle);
  const readSuccess = await readFromLocalJsonFile();
  if (!readSuccess) {
    await writeToLocalJsonFile();
  }
  showToast(`📁 Đã liên kết với file ${handle.name}`, 3000);
  return handle;
}

export async function createAndBindLocalJsonFile() {
  if (typeof window.showSaveFilePicker !== "function") {
    throw new Error("Trình duyệt không hỗ trợ File System Access API. Vui lòng dùng Chrome / MS Edge trên PC.");
  }
  const handle = await window.showSaveFilePicker({
    suggestedName: `pmc_baogia_data_${new Date().toISOString().slice(0,10).replace(/-/g,"")}.json`,
    types: [{
      description: "File dữ liệu JSON",
      accept: { "application/json": [".json"] }
    }]
  });
  if (!handle) return null;
  _currentFileHandle = handle;
  await setStoredFileHandle(handle);
  await writeToLocalJsonFile();
  showToast(`✨ Đã tạo & liên kết file ${handle.name}`, 3000);
  return handle;
}

export async function disconnectLocalJsonFile() {
  _currentFileHandle = null;
  await setStoredFileHandle(null);
  showToast("🔌 Đã hủy kết nối file JSON local", 2000);
}

/**
 * Compare local quotes vs Google Apps Script / Google Drive quotes
 * Returns detailed comparison report & master merged quotes
 */
export async function compareLocalAndGAS() {
  if (!hasGasUrl()) {
    throw new Error("Chưa kết nối Google Apps Script (GAS URL)");
  }

  // 1. Get all local quotes
  const localQuotes = mergeAllLocalStorageSources();
  const localMap = new Map();
  localQuotes.forEach(q => {
    if (q && q.id) localMap.set(q.id, q);
    if (q && q.quoteNumber) localMap.set(q.quoteNumber, q);
  });

  // 2. Fetch remote quotes from GAS
  const token = getLS(LS_TOKEN) || "";
  const url = `${getGasUrl()}?action=load&token=${encodeURIComponent(token)}`;
  const resp = await fetch(url);
  const rawText = await resp.text();
  let data;
  try {
    data = JSON.parse(rawText);
  } catch (err) {
    throw new Error("GAS did not respond with valid JSON");
  }

  if (!data.ok) {
    throw new Error(data.error || "Không thể tải dữ liệu từ GAS");
  }

  const gasQuotes = Array.isArray(data.quotes) ? data.quotes : [];
  const gasMap = new Map();
  gasQuotes.forEach(q => {
    if (q && q.id) gasMap.set(q.id, q);
    if (q && q.quoteNumber) gasMap.set(q.quoteNumber, q);
  });

  const localOnly = [];
  const gasOnly = [];
  const mismatches = [];
  const synced = [];
  const processedKeys = new Set();

  localQuotes.forEach(lq => {
    const key = lq.id || lq.quoteNumber;
    if (!key || processedKeys.has(key)) return;
    processedKeys.add(key);

    const gq = (lq.id ? gasMap.get(lq.id) : null) || (lq.quoteNumber ? gasMap.get(lq.quoteNumber) : null);
    if (!gq) {
      localOnly.push(lq);
    } else {
      const lLen = (lq.items && Array.isArray(lq.items)) ? lq.items.length : 0;
      const gLen = (gq.items && Array.isArray(gq.items)) ? gq.items.length : 0;
      if (lLen !== gLen || lq.customer !== gq.customer || lq.status !== gq.status) {
        mismatches.push({ local: lq, gas: gq });
      } else {
        synced.push(lq);
      }
    }
  });

  gasQuotes.forEach(gq => {
    const key = gq.id || gq.quoteNumber;
    if (!key || processedKeys.has(key)) return;
    const lq = (gq.id ? localMap.get(gq.id) : null) || (gq.quoteNumber ? localMap.get(gq.quoteNumber) : null);
    if (!lq) {
      gasOnly.push(gq);
    }
  });

  // Build Master Merged Dataset
  const masterMap = new Map();
  localQuotes.forEach(q => {
    const k = q.id || q.quoteNumber;
    if (k) masterMap.set(k, q);
  });
  gasQuotes.forEach(gq => {
    const k = gq.id || gq.quoteNumber;
    if (!k) return;
    const existing = masterMap.get(k);
    if (!existing) {
      masterMap.set(k, gq);
    } else {
      const eLen = (existing.items && Array.isArray(existing.items)) ? existing.items.length : 0;
      const gLen = (gq.items && Array.isArray(gq.items)) ? gq.items.length : 0;
      if (gLen > eLen) {
        masterMap.set(k, gq);
      }
    }
  });
  const masterQuotes = Array.from(masterMap.values());

  return {
    localCount: localQuotes.length,
    gasCount: gasQuotes.length,
    masterCount: masterQuotes.length,
    localOnly,
    gasOnly,
    mismatches,
    syncedCount: synced.length,
    masterQuotes
  };
}

export async function applyReconciledQuotes(masterQuotes) {
  _mem.quotes = masterQuotes;
  _flushToLocalStorage();
  await _flushToGAS();
  showToast(`✅ Đã đồng bộ & hợp nhất hoàn toàn ${masterQuotes.length} báo giá!`, 4000);
  return masterQuotes;
}

// Khởi chạy đồng bộ để nạp cache (bao gồm cả COMPANY và logo) ngay lập tức khi load script
try {
  _initFromLocalStorage();
  initLocalFileHandle();
} catch (e) {
  console.warn("Lỗi nạp cache ban đầu:", e);
}
