import fs from 'fs';
import path from 'path';

const SUPABASE_URL = "https://iwkkkewyjuwnsmmtkdj.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_KEY || "";

console.log("🚀 CHƯƠNG TRÌNH PUSH DỮ LIỆU CŨ LÊN 8 BẢNG CLOUD SUPABASE");
console.log(`📡 URL Target: ${SUPABASE_URL}`);

async function run() {
  const jsonPath = path.join(process.cwd(), 'baogia_pmc.json');
  let data = { quotes: [], products: [], debtRecs: {}, paymentRequests: {}, handovers: {} };

  if (fs.existsSync(jsonPath)) {
    try {
      const text = fs.readFileSync(jsonPath, 'utf8');
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed.quotes)) data.quotes = parsed.quotes;
      if (Array.isArray(parsed)) data.quotes = parsed;
      if (parsed.debtRecs) data.debtRecs = parsed.debtRecs;
      if (parsed.paymentRequests) data.paymentRequests = parsed.paymentRequests;
      if (parsed.handovers) data.handovers = parsed.handovers;
      console.log(`✅ Đã nạp ${data.quotes.length} báo giá từ file baogia_pmc.json`);
    } catch (e) {
      console.error("⚠️ Lỗi nạp baogia_pmc.json:", e.message);
    }
  } else {
    console.log("ℹ️ Không thấy file baogia_pmc.json trong thư mục gốc. Đang tạo dữ liệu mẫu...");
  }

  if (!SUPABASE_KEY) {
    console.log("\n⚠️ Bạn chưa truyền SUPABASE_KEY. Hãy chạy theo cú pháp:");
    console.log("   $env:SUPABASE_KEY=\"eyJhbGci...\" ; node scripts/push_master_data.js\n");
    return;
  }

  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates'
  };

  // 1. Push Quotes
  console.log(`\n[1/5] 📤 Đang đẩy ${data.quotes.length} Báo giá vào bảng 'quotes'...`);
  const qRows = data.quotes.map(q => ({
    id: q.id || q.quoteNumber || `q_${Date.now()}_${Math.random().toString(36).substr(2,5)}`,
    quote_number: q.quoteNumber || "",
    date: q.date || "",
    customer: q.customer || "",
    status: q.status || "draft",
    total: q.total || 0,
    payload: q,
    updated_at: new Date().toISOString()
  }));

  qRows.push({
    id: "sys_master_payload",
    quote_number: "SYS_MASTER_PAYLOAD",
    date: new Date().toLocaleDateString("vi-VN"),
    customer: "HỆ THỐNG MASTER DATA",
    status: "system",
    total: 0,
    payload: data,
    updated_at: new Date().toISOString()
  });

  const chunkSize = 50;
  for (let i = 0; i < qRows.length; i += chunkSize) {
    const chunk = qRows.slice(i, i + chunkSize);
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/quotes`, { method: 'POST', headers, body: JSON.stringify(chunk) });
    if (!resp.ok) console.error(`   ❌ Lỗi push quotes chunk ${i}: ${await resp.text()}`);
  }
  console.log(`[1/5] ✅ Đã lưu ${qRows.length} Báo giá vào bảng 'quotes'!`);

  console.log("\n🎉 ĐÃ HOÀN TẤT ĐẨY DỮ LIỆU LÊN SUPABASE CLOUD!");
}

run().catch(console.error);
