import React, { useState, useRef } from 'react';
import { COMPANY, _mem, getLogoUrl } from '../utils/gasStore';
import { fmt, todayStr } from '../utils/helpers';
import { upsertSupabasePaymentRequests } from '../utils/supabaseClient';

export default function PaymentRequestModal({ initialData = {}, onClose }) {
  const [buyerName, setBuyerName] = useState(initialData.buyerName || "");
  const [buyerNameEn, setBuyerNameEn] = useState("");
  const [reqNumber, setReqNumber] = useState(initialData.refNum ? `DNTT-${initialData.refNum}` : `DNTT-${Date.now().toString().slice(-6)}`);
  const [dateStr, setDateStr] = useState(todayStr());
  const [amount, setAmount] = useState(Number(initialData.grandTotal || 0));
  const [reason, setReason] = useState("Thanh toán tiền mua hàng / dịch vụ theo Biên bản đối chiếu công nợ & Hợp đồng");
  const [reasonEn, setReasonEn] = useState("");
  const [lang, setLang] = useState("vi");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [translating, setTranslating] = useState(false);
  const [xmlError, setXmlError] = useState("");
  const fileInputRef = useRef(null);

  // 1. XML Invoice Import
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
          if (parseErr) throw new Error("File XML không đúng định dạng hóa đơn");

          const getVal = (...tags) => {
            for (const t of tags) {
              const el = xmlDoc.querySelector(t);
              if (el && el.textContent.trim()) return el.textContent.trim();
            }
            return "";
          };

          const buyer = getVal("TenNguoiMua", "TenDonVi", "NMua", "buyerName", "NMuaTen");
          const invoiceNo = getVal("SoHoaDon", "SHDon", "invoiceNumber", "No");
          const totalStr = getVal("TongTienThanhToan", "TongTien", "grandTotal", "TgTTien");

          if (buyer) setBuyerName(buyer);
          if (invoiceNo) {
            setReqNumber(`DNTT-HD${invoiceNo}`);
            setReason(`Thanh toán tiền hàng/dịch vụ theo Hóa đơn GTGT số ${invoiceNo}`);
          }
          if (totalStr) {
            const tot = parseFloat(totalStr.replace(/,/g, "")) || 0;
            if (tot > 0) setAmount(tot);
          }

          setSaveMsg("⚡ Đã import thông tin từ file XML!");
          setTimeout(() => setSaveMsg(""), 3000);
        } catch (err) {
          setXmlError("Lỗi đọc XML: " + err.message);
        }
      };
      reader.readAsText(file);
    });
  };

  // 2. Auto Translation
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
      const [tBuyer, tReason] = await Promise.all([
        translateText(buyerName),
        translateText(reason)
      ]);
      setBuyerNameEn(tBuyer);
      setReasonEn(tReason);
      setSaveMsg(`✓ Đã tự động dịch sang ${lang === "vi_zh" ? "Tiếng Trung" : "Tiếng Anh"} thành công!`);
      setTimeout(() => setSaveMsg(""), 4000);
    } catch (err) {
      alert("Lỗi dịch tự động: " + err.message);
    } finally {
      setTranslating(false);
    }
  };

  const handleSaveToCloud = async () => {
    setSaving(true);
    setSaveMsg("");
    try {
      const record = {
        id: reqNumber,
        reqNumber,
        buyerName,
        dateStr,
        amount,
        reason,
        updatedAt: new Date().toISOString()
      };
      _mem.paymentRequests = _mem.paymentRequests || {};
      _mem.paymentRequests[reqNumber] = record;
      await upsertSupabasePaymentRequests({ [reqNumber]: record });
      setSaveMsg("✅ Đã lưu Giấy đề nghị thanh toán lên Supabase Cloud!");
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
            📝 GIẤY ĐỀ NGHỊ THANH TOÁN
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

      {/* Main Body */}
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
            📂 Chọn file XML hóa đơn
          </button>
          {xmlError && <div style={{ color: "#f87171", fontSize: 12, marginBottom: 12 }}>{xmlError}</div>}

          <h3 style={{ fontSize: 14, color: "#94a3b8", marginBottom: 14 }}>Thông tin Đề Nghị Thanh Toán</h3>
          
          <label style={{ fontSize: 12, color: "#cbd5e1" }}>Số Giấy Đề Nghị</label>
          <input
            type="text" value={reqNumber} onChange={e => setReqNumber(e.target.value)}
            style={{ width: "100%", padding: 8, background: "#0f172a", border: "1px solid #475569", color: "#fff", borderRadius: 6, marginBottom: 12 }}
          />

          <label style={{ fontSize: 12, color: "#cbd5e1" }}>Kính Gửi (Khách Hàng / Đơn Vị Thanh Toán)</label>
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

          <label style={{ fontSize: 12, color: "#cbd5e1" }}>Số Tiền Đề Nghị Thanh Toán (đ)</label>
          <input
            type="number" value={amount} onChange={e => setAmount(Number(e.target.value))}
            style={{ width: "100%", padding: 8, background: "#0f172a", border: "1px solid #475569", color: "#fff", borderRadius: 6, marginBottom: 12 }}
          />

          <label style={{ fontSize: 12, color: "#cbd5e1" }}>Lý Do / Nội Dung Thanh Toán</label>
          <textarea
            rows={3} value={reason} onChange={e => setReason(e.target.value)}
            style={{ width: "100%", padding: 8, background: "#0f172a", border: "1px solid #475569", color: "#fff", borderRadius: 6, marginBottom: 8 }}
          />
          {lang !== "vi" && (
            <textarea
              rows={2} value={reasonEn} onChange={e => setReasonEn(e.target.value)}
              placeholder={`Nội dung tiếng ${lang === "vi_zh" ? "Trung" : "Anh"}...`}
              style={{ width: "100%", padding: 6, background: "#1e1b4b", border: "1px solid #6366f1", color: "#c7d2fe", borderRadius: 6, marginBottom: 12, fontSize: 12 }}
            />
          )}
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
            lineHeight: 1.6,
            fontFamily: "var(--font), 'Plus Jakarta Sans', -apple-system, sans-serif"
          }}>
            {/* Header Company Info with LOGO */}
            <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "2px solid #000", paddingBottom: 12, marginBottom: 20 }}>
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
                <div style={{ fontWeight: 700 }}>Số: {reqNumber}</div>
                <div style={{ fontSize: 11 }}>Ngày: {dateStr}</div>
              </div>
            </div>

            {/* Document Title */}
            <div style={{ textAlign: "center", margin: "24px 0" }}>
              <h1 style={{ fontSize: 19, fontWeight: 800, textTransform: "uppercase", margin: 0, fontFamily: "var(--font-display)" }}>
                GIẤY ĐỀ NGHỊ THANH TOÁN
              </h1>
              <div style={{ fontSize: 11, fontStyle: "italic", color: "#555" }}>
                {lang === "vi_zh" ? "付款申请书 PAYMENT REQUEST" : "PAYMENT REQUEST"}
              </div>
            </div>

            {/* Recipient */}
            <div style={{ fontSize: 14, margin: "16px 0" }}>
              <b>Kính gửi (To):</b> <span style={{ fontSize: 15, fontWeight: 700 }}>{buyerName || "......................................................................................."}</span>
              {buyerNameEn && <div style={{ fontSize: 12, fontStyle: "italic", color: "#475569", marginLeft: 85 }}>{buyerNameEn}</div>}
            </div>

            <div style={{ marginBottom: 16 }}>
              Căn cứ kết quả cung cấp hàng hóa / dịch vụ và Biên bản đối chiếu công nợ giữa hai bên, <b>{COMPANY.name}</b> trân trọng đề nghị Quý công ty thanh toán số tiền nợ như sau:
            </div>

            {/* Table Amount Breakdown */}
            <table style={{ width: "100%", borderCollapse: "collapse", margin: "20px 0", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f1f5f9" }}>
                  <th style={{ border: "1px solid #000", padding: "8px 12px", textAlign: "left" }}>Nội dung đề nghị thanh toán</th>
                  <th style={{ border: "1px solid #000", padding: "8px 12px", textAlign: "right", width: 160 }}>Số tiền (VND)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ border: "1px solid #000", padding: "10px 12px" }}>
                    <div><b>{reason}</b></div>
                    {reasonEn && <div style={{ fontSize: 11, fontStyle: "italic", color: "#475569" }}>{reasonEn}</div>}
                  </td>
                  <td style={{ border: "1px solid #000", padding: "10px 12px", textAlign: "right", fontWeight: 700, fontSize: 14 }}>
                    {fmt(amount)} đ
                  </td>
                </tr>
                <tr style={{ background: "#f8fafc" }}>
                  <td style={{ border: "1px solid #000", padding: "10px 12px", fontWeight: 800 }}>TỔNG SỐ TIỀN ĐỀ NGHỊ THANH TOÁN:</td>
                  <td style={{ border: "1px solid #000", padding: "10px 12px", textAlign: "right", fontWeight: 800, fontSize: 15, color: "#000" }}>
                    {fmt(amount)} đ
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Bank Transfer Info */}
            <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 6, padding: 14, margin: "20px 0", fontSize: 12.5 }}>
              <div style={{ fontWeight: 700, textDecoration: "underline", marginBottom: 6, fontSize: 13 }}>THÔNG TIN CHUYỂN KHOẢN:</div>
              <div>• Tên tài khoản: <b>{COMPANY.name}</b></div>
              <div>• Số tài khoản: <b style={{ fontSize: 14, color: "#0284c7" }}>{COMPANY.bankAccount}</b></div>
              <div>• Ngân hàng: <b>{COMPANY.bankName}</b></div>
              <div>• Nội dung chuyển khoản: <b>Thanh toan cho {reqNumber}</b></div>
            </div>

            <div>
              Rất mong nhận được sự hợp tác và thanh toán đúng hạn từ Quý công ty. Trân trọng cảm ơn!
            </div>

            {/* Signatures */}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 40, textAlign: "center" }}>
              <div style={{ width: "45%" }}>
                <div style={{ fontWeight: 700 }}>ĐẠI DIỆN KHÁCH HÀNG</div>
                <div style={{ fontSize: 11, color: "#555", fontStyle: "italic" }}>(Ký & nhận giấy)</div>
                <div style={{ height: 60 }}></div>
                <div style={{ fontWeight: 600 }}>{buyerName || "...................................."}</div>
              </div>
              <div style={{ width: "45%" }}>
                <div style={{ fontWeight: 700 }}>ĐẠI DIỆN BÊN ĐỀ NGHỊ (BÊN A)</div>
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
