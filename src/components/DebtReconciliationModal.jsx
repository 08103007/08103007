import React, { useState, useRef } from 'react';
import { COMPANY, _mem, getLogoUrl } from '../utils/gasStore';
import { fmt, todayStr } from '../utils/helpers';
import { upsertSupabaseDebtRecs } from '../utils/supabaseClient';

export default function DebtReconciliationModal({ onClose, onOpenPaymentRequest }) {
  const [selectedQuoteId, setSelectedQuoteId] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerNameEn, setBuyerNameEn] = useState("");
  const [buyerTax, setBuyerTax] = useState("");
  const [buyerAddr, setBuyerAddr] = useState("");
  const [buyerAddrEn, setBuyerAddrEn] = useState("");
  const [refNum, setRefNum] = useState(`DCCN-${Date.now().toString().slice(-6)}`);
  const [dateStr, setDateStr] = useState(todayStr());
  const [items, setItems] = useState([]);
  const [vatRate, setVatRate] = useState(8);
  const [lang, setLang] = useState("vi");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [translating, setTranslating] = useState(false);
  const [xmlError, setXmlError] = useState("");
  const fileInputRef = useRef(null);

  const quotesList = Array.isArray(_mem.quotes) ? _mem.quotes : [];

  // 1. Select Quote from System
  const handleSelectQuote = (qId) => {
    setSelectedQuoteId(qId);
    const q = quotesList.find(item => item.id === qId);
    if (q) {
      setBuyerName(q.customer || "");
      setBuyerTax(q.taxCode || "");
      setBuyerAddr(q.address || "");
      setRefNum(`DCCN-${q.quoteNumber || q.id}`);
      setVatRate(q.vatRate !== undefined ? q.vatRate : 8);
      const qItems = Array.isArray(q.items) ? q.items : [];
      setItems(qItems.map(it => ({
        name: it.name || "",
        nameEn: it.nameEn || "",
        unit: it.unit || "Cái",
        qty: Number(it.qty || 1),
        price: Number(it.price || 0),
        amount: Number(it.qty || 1) * Number(it.price || 0)
      })));
    }
  };

  // 2. XML Invoice Parser
  const handleXmlUpload = (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setXmlError("");

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(event.target.result, "application/xml");
          
          const parseErr = xmlDoc.querySelector("parsererror");
          if (parseErr) throw new Error("File XML không đúng định dạng hóa đơn điện tử");

          const getVal = (...tags) => {
            for (const t of tags) {
              const el = xmlDoc.querySelector(t);
              if (el && el.textContent.trim()) return el.textContent.trim();
            }
            return "";
          };

          const buyer = getVal("TenNguoiMua", "TenDonVi", "NMua", "buyerName", "NMuaTen");
          const tax = getVal("MSTNguoiMua", "MST", "MaSoThue", "buyerTaxCode", "NMuaMST");
          const addr = getVal("DiaChiNguoiMua", "DChi", "DiaChi", "buyerAddress", "NMuaDChi");
          const invoiceNo = getVal("SoHoaDon", "SHDon", "invoiceNumber", "No");

          if (buyer) setBuyerName(buyer);
          if (tax) setBuyerTax(tax);
          if (addr) setBuyerAddr(addr);
          if (invoiceNo) setRefNum(`DCCN-HD${invoiceNo}`);

          const nodes = xmlDoc.querySelectorAll("HHDVu, ChiTiet, Item, InvoiceItem, HangHoa");
          if (nodes.length > 0) {
            const parsedItems = [];
            nodes.forEach(node => {
              const getItemVal = (...tags) => {
                for (const t of tags) {
                  const el = node.querySelector(t);
                  if (el && el.textContent.trim()) return el.textContent.trim();
                }
                return "";
              };
              const name = getItemVal("THHDVu", "TenHH", "tenHangHoa", "itemName", "Ten");
              const unit = getItemVal("DVTinh", "DonViTinh", "unit", "DVT") || "Cái";
              const qty = parseFloat((getItemVal("SLuong", "soLuong", "quantity", "SL") || "1").replace(/,/g, "")) || 1;
              const price = parseFloat((getItemVal("DGia", "donGia", "unitPrice", "Gia") || "0").replace(/,/g, "")) || 0;

              if (name) {
                parsedItems.push({
                  name,
                  unit,
                  qty,
                  price,
                  amount: qty * price
                });
              }
            });

            if (parsedItems.length > 0) {
              setItems(parsedItems);
            }
          }

          setSaveMsg("⚡ Đã import thành công dữ liệu từ file XML!");
          setTimeout(() => setSaveMsg(""), 3000);
        } catch (err) {
          setXmlError("Lỗi đọc XML: " + err.message);
        }
      };
      reader.readAsText(file);
    });
  };

  // 3. Auto Translation via Google Translate API
  const handleAutoTranslate = async () => {
    if (lang === "vi") {
      alert("Vui lòng chọn ngôn ngữ Song ngữ (Tiếng Anh hoặc Tiếng Trung) trước khi dịch.");
      return;
    }
    const targetLang = lang === "vi_zh" ? "zh-CN" : "en";
    setTranslating(true);

    const translateText = async (text) => {
      if (!text || !text.trim()) return "";
      try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=vi&tl=${targetLang}&dt=t&q=${encodeURIComponent(text.trim())}`;
        const res = await fetch(url);
        const data = await res.json();
        return (data && data[0]) ? data[0].map(x => x[0]).join("") : text;
      } catch {
        return text;
      }
    };

    try {
      const [tBuyer, tAddr] = await Promise.all([
        translateText(buyerName),
        translateText(buyerAddr)
      ]);
      setBuyerNameEn(tBuyer);
      setBuyerAddrEn(tAddr);

      const translatedItems = await Promise.all(items.map(async (it) => ({
        ...it,
        nameEn: await translateText(it.name)
      })));
      setItems(translatedItems);

      setSaveMsg(`✓ Đã tự động dịch sang ${lang === "vi_zh" ? "Tiếng Trung" : "Tiếng Anh"} thành công!`);
      setTimeout(() => setSaveMsg(""), 4000);
    } catch (err) {
      alert("Lỗi dịch tự động: " + err.message);
    } finally {
      setTranslating(false);
    }
  };

  const subtotal = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
  const vatAmount = vatRate > 0 ? Math.round(subtotal * vatRate / 100) : 0;
  const grandTotal = subtotal + vatAmount;

  const handleSaveToCloud = async () => {
    setSaving(true);
    setSaveMsg("");
    try {
      const record = {
        id: refNum,
        refNum,
        buyerName,
        buyerTax,
        buyerAddr,
        dateStr,
        vatRate,
        subtotal,
        vatAmount,
        grandTotal,
        items,
        updatedAt: new Date().toISOString()
      };
      _mem.debtRecs = _mem.debtRecs || {};
      _mem.debtRecs[refNum] = record;
      await upsertSupabaseDebtRecs({ [refNum]: record });
      setSaveMsg("✅ Đã lưu Biên bản đối chiếu công nợ lên Supabase Cloud!");
      setTimeout(() => setSaveMsg(""), 3000);
    } catch (e) {
      setSaveMsg("⚠️ Lỗi lưu Cloud: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      width: "100vw",
      height: "100vh",
      background: "#0f172a",
      zIndex: 999999,
      display: "flex",
      flexDirection: "column",
      color: "#f8fafc",
      fontFamily: "var(--font), 'Plus Jakarta Sans', -apple-system, sans-serif"
    }}>
      {/* Top Action Bar */}
      <div className="no-print" style={{
        background: "#1e293b",
        borderBottom: "1px solid #334155",
        padding: "12px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#38bdf8", margin: 0, fontFamily: "var(--font-display)" }}>
            📋 BIÊN BẢN ĐỐI CHIẾU CÔNG NỢ
          </h2>
          <span style={{ fontSize: 12, background: "#0369a1", padding: "3px 8px", borderRadius: 4 }}>
            Supabase Cloud Mode
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {saveMsg && <span style={{ fontSize: 13, color: "#4ade80", fontWeight: 600 }}>{saveMsg}</span>}
          
          <button
            onClick={handleAutoTranslate}
            disabled={translating}
            style={{
              background: "#6366f1", color: "#fff", border: "none", padding: "8px 14px", borderRadius: 6, fontWeight: 600, cursor: "pointer"
            }}
          >
            {translating ? "⏳ Đang dịch..." : `🌐 Tự động dịch (${lang === "vi_zh" ? "Trung" : "Anh"})`}
          </button>

          <button
            onClick={handleSaveToCloud}
            disabled={saving}
            style={{
              background: "#16a34a", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 6, fontWeight: 600, cursor: "pointer"
            }}
          >
            💾 {saving ? "Đang lưu..." : "Lưu Cloud"}
          </button>

          <button
            onClick={() => onOpenPaymentRequest && onOpenPaymentRequest({ buyerName, grandTotal, refNum })}
            style={{
              background: "#0284c7", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 6, fontWeight: 600, cursor: "pointer"
            }}
          >
            📑 Tạo Đề Nghị Thanh Toán
          </button>

          <button
            onClick={() => window.print()}
            style={{
              background: "#475569", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 6, fontWeight: 600, cursor: "pointer"
            }}
          >
            🖨️ In (A4)
          </button>

          <button
            onClick={onClose}
            style={{
              background: "#dc2626", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 6, fontWeight: 600, cursor: "pointer"
            }}
          >
            ❌ Đóng
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Left Control Panel */}
        <div className="no-print" style={{
          width: 340,
          background: "#1e293b",
          borderRight: "1px solid #334155",
          padding: 20,
          overflowY: "auto"
        }}>
          <h3 style={{ fontSize: 14, color: "#94a3b8", marginBottom: 10 }}>🌐 Ngôn ngữ hiển thị</h3>
          <select
            value={lang}
            onChange={e => setLang(e.target.value)}
            style={{ width: "100%", padding: 8, background: "#0f172a", border: "1px solid #475569", color: "#fff", borderRadius: 6, marginBottom: 16 }}
          >
            <option value="vi">🇻🇳 Chỉ Tiếng Việt</option>
            <option value="vi_en">🇻🇳 🇬🇧 Song ngữ Việt - Anh</option>
            <option value="vi_zh">🇻🇳 🇨🇳 Song ngữ Việt - Trung</option>
          </select>

          <h3 style={{ fontSize: 14, color: "#94a3b8", marginBottom: 10 }}>📂 Import từ Hóa đơn XML</h3>
          <input
            type="file"
            accept=".xml"
            ref={fileInputRef}
            onChange={handleXmlUpload}
            style={{ display: "none" }}
            multiple
          />
          <button
            type="button"
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
            style={{
              width: "100%",
              padding: "10px",
              background: "#334155",
              border: "1px dashed #64748b",
              color: "#38bdf8",
              borderRadius: 6,
              fontWeight: 600,
              cursor: "pointer",
              marginBottom: 16
            }}
          >
            📂 Chọn file XML hóa đơn (VNPT, MISA, FAST...)
          </button>
          {xmlError && <div style={{ color: "#f87171", fontSize: 12, marginBottom: 12 }}>{xmlError}</div>}

          <h3 style={{ fontSize: 14, color: "#94a3b8", marginBottom: 10 }}>1. Chọn Báo giá từ hệ thống</h3>
          <select
            value={selectedQuoteId}
            onChange={(e) => handleSelectQuote(e.target.value)}
            style={{
              width: "100%", padding: "8px 12px", background: "#0f172a", border: "1px solid #475569", color: "#fff", borderRadius: 6, marginBottom: 16
            }}
          >
            <option value="">-- Chọn Báo giá mẫu --</option>
            {quotesList.map(q => (
              <option key={q.id} value={q.id}>
                {q.quoteNumber || q.id} - {q.customer} ({fmt(q.total)}đ)
              </option>
            ))}
          </select>

          <h3 style={{ fontSize: 14, color: "#94a3b8", marginBottom: 10 }}>2. Thông tin Khách hàng</h3>
          <label style={{ fontSize: 12, color: "#cbd5e1" }}>Tên Đơn Vị / Khách Hàng</label>
          <input
            type="text" value={buyerName} onChange={e => setBuyerName(e.target.value)}
            style={{ width: "100%", padding: 8, background: "#0f172a", border: "1px solid #475569", color: "#fff", borderRadius: 6, marginBottom: 8 }}
          />
          {lang !== "vi" && (
            <input
              type="text" value={buyerNameEn} onChange={e => setBuyerNameEn(e.target.value)}
              placeholder={`Tên tiếng ${lang === "vi_zh" ? "Trung" : "Anh"}...`}
              style={{ width: "100%", padding: 6, background: "#1e1b4b", border: "1px solid #6366f1", color: "#c7d2fe", borderRadius: 6, marginBottom: 12, fontSize: 12 }}
            />
          )}

          <label style={{ fontSize: 12, color: "#cbd5e1" }}>Mã Số Thuế</label>
          <input
            type="text" value={buyerTax} onChange={e => setBuyerTax(e.target.value)}
            style={{ width: "100%", padding: 8, background: "#0f172a", border: "1px solid #475569", color: "#fff", borderRadius: 6, marginBottom: 12 }}
          />

          <label style={{ fontSize: 12, color: "#cbd5e1" }}>Địa Chỉ</label>
          <input
            type="text" value={buyerAddr} onChange={e => setBuyerAddr(e.target.value)}
            style={{ width: "100%", padding: 8, background: "#0f172a", border: "1px solid #475569", color: "#fff", borderRadius: 6, marginBottom: 8 }}
          />
          {lang !== "vi" && (
            <input
              type="text" value={buyerAddrEn} onChange={e => setBuyerAddrEn(e.target.value)}
              placeholder={`Địa chỉ tiếng ${lang === "vi_zh" ? "Trung" : "Anh"}...`}
              style={{ width: "100%", padding: 6, background: "#1e1b4b", border: "1px solid #6366f1", color: "#c7d2fe", borderRadius: 6, marginBottom: 12, fontSize: 12 }}
            />
          )}

          <label style={{ fontSize: 12, color: "#cbd5e1" }}>Thuế VAT (%)</label>
          <input
            type="number" value={vatRate} onChange={e => setVatRate(Number(e.target.value))}
            style={{ width: "100%", padding: 8, background: "#0f172a", border: "1px solid #475569", color: "#fff", borderRadius: 6, marginBottom: 12 }}
          />
        </div>

        {/* Right Printable A4 Document Preview */}
        <div style={{ flex: 1, padding: 30, overflowY: "auto", background: "#334155", display: "flex", justifyContent: "center" }}>
          <div className="print-page" style={{
            width: "210mm",
            minHeight: "297mm",
            background: "#fff",
            color: "#000",
            padding: "20mm",
            boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
            fontSize: 13,
            lineHeight: 1.5,
            fontFamily: "var(--font), 'Plus Jakarta Sans', -apple-system, sans-serif"
          }}>
            {/* Header Company Info with LOGO */}
            <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "2px solid #000", paddingBottom: 12, marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                {getLogoUrl() && (
                  <img src={getLogoUrl()} style={{ width: 54, height: 54, objectFit: "contain" }} alt="Logo" />
                )}
                <div>
                  <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, fontFamily: "var(--font-display)" }}>{COMPANY.name}</h2>
                  <div style={{ fontSize: 11, color: "#333" }}>{COMPANY.address}</div>
                  <div style={{ fontSize: 11, color: "#333" }}>MST: {COMPANY.mst} | ĐT: {COMPANY.phone} | Email: {COMPANY.email}</div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 700 }}>Số: {refNum}</div>
                <div style={{ fontSize: 11 }}>Ngày: {dateStr}</div>
              </div>
            </div>

            {/* Document Title */}
            <div style={{ textAlign: "center", margin: "20px 0" }}>
              <h1 style={{ fontSize: 18, fontWeight: 800, textTransform: "uppercase", margin: 0, fontFamily: "var(--font-display)" }}>
                BIÊN BẢN ĐỐI CHIẾU CÔNG NỢ
              </h1>
              <div style={{ fontSize: 11, fontStyle: "italic", color: "#555" }}>
                {lang === "vi_zh" ? "对账单 STATEMENT OF DEBT" : "DEBT RECONCILIATION STATEMENT"}
              </div>
            </div>

            {/* Parties Info */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, textDecoration: "underline", marginBottom: 4 }}>
                BÊN A (BÊN BÁN / SELLER):
              </div>
              <div><b>{COMPANY.name}</b></div>
              <div>Địa chỉ: {COMPANY.address}</div>
              <div>Mã số thuế: {COMPANY.mst}</div>
              <div>Đại diện: <b>{COMPANY.representative}</b> - Chức vụ: {COMPANY.position}</div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 700, textDecoration: "underline", marginBottom: 4 }}>
                BÊN B (BÊN MUA / BUYER):
              </div>
              <div><b>{buyerName || "......................................................................................."}</b></div>
              {buyerNameEn && <div style={{ fontStyle: "italic", color: "#475569" }}>{buyerNameEn}</div>}
              <div>Địa chỉ: {buyerAddr || "......................................................................................."}</div>
              {buyerAddrEn && <div style={{ fontStyle: "italic", color: "#475569" }}>{buyerAddrEn}</div>}
              <div>Mã số thuế: {buyerTax || "......................................................................................."}</div>
            </div>

            {/* Table of Items */}
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16, fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#f1f5f9" }}>
                  <th style={{ border: "1px solid #000", padding: "6px 8px" }}>STT</th>
                  <th style={{ border: "1px solid #000", padding: "6px 8px", textAlign: "left" }}>Tên Hàng Hóa / Dịch Vụ</th>
                  <th style={{ border: "1px solid #000", padding: "6px 8px" }}>ĐVT</th>
                  <th style={{ border: "1px solid #000", padding: "6px 8px" }}>SL</th>
                  <th style={{ border: "1px solid #000", padding: "6px 8px", textAlign: "right" }}>Đơn Giá (đ)</th>
                  <th style={{ border: "1px solid #000", padding: "6px 8px", textAlign: "right" }}>Thành Tiền (đ)</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ border: "1px solid #000", padding: 12, textAlign: "center", color: "#666" }}>
                      Chưa có hàng hóa nào — chọn Báo giá hoặc import file XML ở cột trái để tải dữ liệu
                    </td>
                  </tr>
                ) : (
                  items.map((it, idx) => (
                    <tr key={idx}>
                      <td style={{ border: "1px solid #000", padding: "6px 8px", textAlign: "center" }}>{idx + 1}</td>
                      <td style={{ border: "1px solid #000", padding: "6px 8px" }}>
                        <div>{it.name}</div>
                        {it.nameEn && <div style={{ fontSize: 11, fontStyle: "italic", color: "#475569" }}>{it.nameEn}</div>}
                      </td>
                      <td style={{ border: "1px solid #000", padding: "6px 8px", textAlign: "center" }}>{it.unit}</td>
                      <td style={{ border: "1px solid #000", padding: "6px 8px", textAlign: "center" }}>{it.qty}</td>
                      <td style={{ border: "1px solid #000", padding: "6px 8px", textAlign: "right" }}>{fmt(it.price)}</td>
                      <td style={{ border: "1px solid #000", padding: "6px 8px", textAlign: "right" }}>{fmt(it.amount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="5" style={{ border: "1px solid #000", padding: "6px 8px", fontWeight: 700, textAlign: "right" }}>Tiền hàng (chưa VAT):</td>
                  <td style={{ border: "1px solid #000", padding: "6px 8px", fontWeight: 700, textAlign: "right" }}>{fmt(subtotal)} đ</td>
                </tr>
                <tr>
                  <td colSpan="5" style={{ border: "1px solid #000", padding: "6px 8px", fontWeight: 700, textAlign: "right" }}>Thuế VAT ({vatRate}%):</td>
                  <td style={{ border: "1px solid #000", padding: "6px 8px", fontWeight: 700, textAlign: "right" }}>{fmt(vatAmount)} đ</td>
                </tr>
                <tr style={{ background: "#f8fafc" }}>
                  <td colSpan="5" style={{ border: "1px solid #000", padding: "8px 8px", fontWeight: 800, textAlign: "right", fontSize: 13 }}>TỔNG CỘNG PHẢI THU:</td>
                  <td style={{ border: "1px solid #000", padding: "8px 8px", fontWeight: 800, textAlign: "right", fontSize: 14, color: "#000" }}>{fmt(grandTotal)} đ</td>
                </tr>
              </tfoot>
            </table>

            {/* Signatures */}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 40, textAlign: "center" }}>
              <div style={{ width: "45%" }}>
                <div style={{ fontWeight: 700 }}>ĐẠI DIỆN BÊN MUA (BÊN B)</div>
                <div style={{ fontSize: 11, color: "#555", fontStyle: "italic" }}>(Ký, ghi rõ họ tên & đóng dấu)</div>
                <div style={{ height: 60 }}></div>
                <div style={{ fontWeight: 600 }}>{buyerName || "...................................."}</div>
              </div>
              <div style={{ width: "45%" }}>
                <div style={{ fontWeight: 700 }}>ĐẠI DIỆN BÊN BÁN (BÊN A)</div>
                <div style={{ fontSize: 11, color: "#555", fontStyle: "italic" }}>(Ký, ghi rõ họ tên & đóng dấu)</div>
                <div style={{ height: 60 }}></div>
                <div style={{ fontWeight: 600 }}>{COMPANY.representative}</div>
                <div style={{ fontSize: 11 }}>{COMPANY.name}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
