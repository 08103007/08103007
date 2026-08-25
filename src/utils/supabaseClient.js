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
export async function upsertSupabaseQuotes(quotes) {
  if (!hasSupabase() || !Array.isArray(quotes) || quotes.length === 0) return false;
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
 * Upsert products to Supabase
 */
export async function upsertSupabaseProducts(products) {
  if (!hasSupabase() || !Array.isArray(products) || products.length === 0) return false;
  try {
    const chunkSize = 50;
    for (let i = 0; i < products.length; i += chunkSize) {
      const chunk = products.slice(i, i + chunkSize);
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
  } catch {
    return false;
  }
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
 * 1-Click Master Data Migration from Local Memory to Supabase Cloud
 */
export async function migrateAllLocalDataToSupabase(_mem, company, contractDefaults, productCatalog) {
  if (!hasSupabase()) throw new Error("Chưa kết nối Supabase URL và Key");
  
  let quotesCount = 0;
  let productsCount = 0;

  // 1. Upload Quotes
  if (Array.isArray(_mem.quotes) && _mem.quotes.length > 0) {
    const ok = await upsertSupabaseQuotes(_mem.quotes);
    if (!ok) throw new Error("Lỗi đẩy Báo giá lên Supabase");
    quotesCount = _mem.quotes.length;
  }

  // 2. Upload Products
  if (Array.isArray(_mem.products) && _mem.products.length > 0) {
    await upsertSupabaseProducts(_mem.products);
    productsCount = _mem.products.length;
  }

  // 3. Upload App Settings & Master Data
  const settingsData = {
    company: company,
    contractDefaults: contractDefaults,
    productCatalog: productCatalog,
    customers: _mem.customers || [],
    contracts: _mem.contracts || {},
    handovers: _mem.handovers || {},
    deliveries: _mem.deliveries || {},
    debtRecs: _mem.debtRecs || {},
    tasks: _mem.tasks || [],
    notes: _mem.notes || []
  };

  await upsertSupabaseSettings("master_settings", settingsData);

  return { quotesCount, productsCount };
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
