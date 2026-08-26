import React, { useState, useRef, useEffect } from 'react';
import { COMPANY, _mem, getLogoUrl } from '../utils/gasStore';
import { fmt, todayStr, parseInvoiceXml, numberToWordsVN, numberToWordsEN, numberToWordsCN } from '../utils/helpers';
import { upsertSupabasePaymentRequests, fetchSupabasePaymentRequests } from '../utils/supabaseClient';

export default function PaymentRequestModal({ initialData = {}, onClose }) {
  const [requestType, setRequestType] = useState(initialData.requestType || "debt_recon"); // "debt_recon" | "invoice"
  const [lang, setLang] = useState("vi_en");
  const [reqNumber, setReqNumber] = useState(initialData.reqNumber || `DNTT-${Date.now().toString().slice(-6)}`);
  const [reqDate, setReqDate] = useState(todayStr());

  // Buyer Info
  const [buyerName, setBuyerName] = useState(initialData.buyerName || "");
  const [buyerNameEn, setBuyerNameEn] = useState(initialData.buyerNameEn || "");
  const [buyerTaxCode, setBuyerTaxCode] = useState(initialData.buyerTaxCode || "");
  const [buyerAddress, setBuyerAddress] = useState(initialData.buyerAddress || "");
  const [buyerAddressEn, setBuyerAddressEn] = useState(initialData.buyerAddressEn || "");
  const [buyerRep, setBuyerRep] = useState(initialData.buyerRep || "");

  // References
  const [debtReconNo, setDebtReconNo] = useState(initialData.debtReconNo || "");
  const [debtReconDate, setDebtReconDate] = useState(initialData.debtReconDate || todayStr());
  const [invoiceNo, setInvoiceNo] = useState(initialData.invoiceNo || "");
  const [invoiceSeries, setInvoiceSeries] = useState(initialData.invoiceSeries || "");
  const [invoiceDate, setInvoiceDate] = useState(initialData.invoiceDate || todayStr());
  
  // Amounts & Reasons
  const [amount, setAmount] = useState(Number(initialData.amount || 0));
  const [reason, setReason] = useState(initialData.reason || "");
  const [reasonEn, setReasonEn] = useState(initialData.reasonEn || "");

  // States
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [translating, setTranslating] = useState(false);
  const [xmlError, setXmlError] = useState("");
  const fileInputRef = useRef(null);

  // Auto-set initial reason text based on mode if empty
  useEffect(() => {
    if (!reason) {
      if (requestType === "debt_recon") {
        setReason(`Thanh toán số tiền công nợ theo Biên bản đối chiếu công nợ số ${debtReconNo || "..."} ngày ${debtReconDate || "..."}`);
      } else {
        setReason(`Thanh toán tiền hàng/dịch vụ theo Hóa đơn GTGT số ${invoiceNo || "..."}${invoiceSeries ? ` (Ký hiệu ${invoiceSeries})` : ""} ngày ${invoiceDate || "..."}`);
      }
    }
  }, [requestType]);

  // 1. XML Invoice Import
  const handleXmlUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setXmlError("");

    for (const file of Array.from(files)) {
      try {
        const text = await file.text();
        const parsed = parseInvoiceXml(text);
        
        if (parsed.buyerName) setBuyerName(parsed.buyerName);
        if (parsed.buyerTax) setBuyerTaxCode(parsed.buyerTax);
        if (parsed.buyerAddr) setBuyerAddress(parsed.buyerAddr);
        if (parsed.invoiceNumber) setInvoiceNo(parsed.invoiceNumber);
        if (parsed.serial) setInvoiceSeries(parsed.serial);
        if (parsed.invoiceDate) setInvoiceDate(parsed.invoiceDate);
        if (parsed.grandTotal) setAmount(parsed.grandTotal);

        setRequestType("invoice");
        setReason(`Thanh toán tiền hàng/dịch vụ theo Hóa đơn GTGT số ${parsed.invoiceNumber || "..."}${parsed.serial ? ` (Ký hiệu ${parsed.serial})` : ""} ngày ${parsed.invoiceDate || "..."}`);

        setSaveMsg("⚡ Đã import thông tin từ file XML thành công!");
        setTimeout(() => setSaveMsg(""), 4000);
      } catch (err) {
        setXmlError("Lỗi đọc file XML: " + err.message);
      }
    }
  };

  // 2. Auto Translation
  const handleAutoTranslate = async () => {
    if (lang === "vi") {
      alert("Vui lòng chọn ngôn ngữ Song ngữ trước khi dịch.");
      return;
    }
    const targetLang = lang === "vi_zh" ? "zh-CN" : "en";
    setTranslating(true);

    const translate = async (txt) => {
      if (!txt || !txt.trim()) return "";
      try {
        const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=vi&tl=${targetLang}&dt=t&q=${encodeURIComponent(txt.trim())}`);
        const data = await res.json();
        return data && data[0] ? data[0].map(x => x[0]).join("") : txt;
      } catch {
        return txt;
      }
    };

    try {
      const [tBuyer, tAddr, tReason] = await Promise.all([
        translate(buyerName),
        translate(buyerAddress),
        translate(reason)
      ]);
      setBuyerNameEn(tBuyer);
      setBuyerAddressEn(tAddr);
      setReasonEn(tReason);

      setSaveMsg(`✓ Đã tự động dịch sang ${lang === "vi_zh" ? "Tiếng Trung" : "Tiếng Anh"} thành công!`);
      setTimeout(() => setSaveMsg(""), 4000);
    } catch (err) {
      alert("Lỗi dịch tự động: " + err.message);
    } finally {
      setTranslating(false);
    }
  };

  // Save to Cloud
  const handleSaveToCloud = async () => {
    setSaving(true);
    setSaveMsg("");
    try {
      const record = {
        id: reqNumber,
        reqNumber,
        reqDate,
        requestType,
        buyerName,
        buyerNameEn,
        buyerTaxCode,
        buyerAddress,
        buyerAddressEn,
        buyerRep,
        debtReconNo,
        debtReconDate,
        invoiceNo,
        invoiceSeries,
        invoiceDate,
        amount,
        reason,
        reasonEn,
        updatedAt: new Date().toISOString()
      };

      _mem.paymentRequests = _mem.paymentRequests || {};
      _mem.paymentRequests[reqNumber] = record;
      await upsertSupabasePaymentRequests({ [reqNumber]: record });

      setSaveMsg("✅ Đã lưu Giấy đề nghị thanh toán lên Supabase Cloud!");
      setTimeout(() => setSaveMsg(""), 4000);
    } catch (e) {
      setSaveMsg("⚠️ Lỗi lưu Cloud: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const isZh = lang === "vi_zh";
  const isEn = lang === "vi_en";

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
      {/* Top Header Action Bar */}
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
            {requestType === "debt_recon" ? "Theo Đối Chiếu Công Nợ" : "Theo Hóa Đơn GTGT"}
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
            {translating ? "⏳ Đang dịch..." : `🌐 Tự động dịch (${isZh ? "Trung" : "Anh"})`}
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

      {/* Main Container */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Left Form Controls Panel */}
        <div className="no-print" style={{
          width: 350,
          background: "#1e293b",
          borderRight: "1px solid #334155",
          padding: 20,
          overflowY: "auto"
        }}>
          <h3 style={{ fontSize: 14, color: "#94a3b8", marginBottom: 10 }}>🎯 Loại Đề Nghị Thanh Toán</h3>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <button
              type="button"
              onClick={() => setRequestType("debt_recon")}
              style={{
                flex: 1, padding: 8, borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
                background: requestType === "debt_recon" ? "#0284c7" : "#334155",
                color: "#fff", border: "none"
              }}
            >
              📋 Theo ĐCCN
            </button>
            <button
              type="button"
              onClick={() => setRequestType("invoice")}
              style={{
                flex: 1, padding: 8, borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
                background: requestType === "invoice" ? "#0284c7" : "#334155",
                color: "#fff", border: "none"
              }}
            >
              📄 Theo Hóa Đơn
            </button>
          </div>

          <h3 style={{ fontSize: 14, color: "#94a3b8", marginBottom: 10 }}>🌐 Ngôn ngữ hiển thị</h3>
          <select
            value={lang}
            onChange={e => setLang(e.target.value)}
            style={{ width: "100%", padding: 8, background: "#0f172a", border: "1px solid #475569", color: "#fff", borderRadius: 6, marginBottom: 16 }}
          >
            <option value="vi">🇻🇳 Chỉ Tiếng Việt</option>
            <option value="vi_en">🇻🇳 🇬🇧 Song ngữ Việt - Anh</option>
            <option value="vi_zh">🇻🇳 🇨🇳 Song ngữ Việt - Trung (giản thể)</option>
          </select>

          <h3 style={{ fontSize: 14, color: "#94a3b8", marginBottom: 10 }}>📂 Import Hóa Đơn XML</h3>
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
              width: "100%", padding: "10px", background: "#334155", border: "1px dashed #64748b",
              color: "#38bdf8", borderRadius: 6, fontWeight: 600, cursor: "pointer", marginBottom: 16
            }}
          >
            📂 Chọn file XML hóa đơn
          </button>
          {xmlError && <div style={{ color: "#f87171", fontSize: 12, marginBottom: 12 }}>{xmlError}</div>}

          <h3 style={{ fontSize: 14, color: "#94a3b8", marginBottom: 10 }}>📝 Thông tin Đề Nghị</h3>
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
              placeholder={`Tên tiếng ${isZh ? "Trung" : "Anh"}...`}
              style={{ width: "100%", padding: 6, background: "#1e1b4b", border: "1px solid #6366f1", color: "#c7d2fe", borderRadius: 6, marginBottom: 12, fontSize: 12 }}
            />
          )}

          {requestType === "debt_recon" ? (
            <>
              <label style={{ fontSize: 12, color: "#cbd5e1" }}>Căn cứ Biên bản đối chiếu công nợ số</label>
              <input
                type="text" value={debtReconNo} onChange={e => setDebtReconNo(e.target.value)}
                style={{ width: "100%", padding: 8, background: "#0f172a", border: "1px solid #475569", color: "#fff", borderRadius: 6, marginBottom: 12 }}
              />
            </>
          ) : (
            <>
              <label style={{ fontSize: 12, color: "#cbd5e1" }}>Căn cứ Hóa đơn GTGT số</label>
              <input
                type="text" value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)}
                style={{ width: "100%", padding: 8, background: "#0f172a", border: "1px solid #475569", color: "#fff", borderRadius: 6, marginBottom: 12 }}
              />
            </>
          )}

          <label style={{ fontSize: 12, color: "#cbd5e1" }}>Số Tiền Đề Nghị (VND)</label>
          <input
            type="number" value={amount} onChange={e => setAmount(Number(e.target.value))}
            style={{ width: "100%", padding: 8, background: "#0f172a", border: "1px solid #475569", color: "#fff", borderRadius: 6, marginBottom: 12 }}
          />

          <label style={{ fontSize: 12, color: "#cbd5e1" }}>Nội dung / Lý do thanh toán</label>
          <textarea
            rows={3} value={reason} onChange={e => setReason(e.target.value)}
            style={{ width: "100%", padding: 8, background: "#0f172a", border: "1px solid #475569", color: "#fff", borderRadius: 6, marginBottom: 8 }}
          />
          {lang !== "vi" && (
            <textarea
              rows={2} value={reasonEn} onChange={e => setReasonEn(e.target.value)}
              placeholder={`Lý do tiếng ${isZh ? "Trung" : "Anh"}...`}
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
            {/* Header Table */}
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 20 }}>
              <tbody>
                <tr>
                  <td style={{ width: "52%", verticalAlign: "top", borderRight: "2px solid #000", paddingRight: 12 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      {getLogoUrl() && (
                        <img src={getLogoUrl()} style={{ width: 48, height: 48, objectFit: "contain" }} alt="Logo" />
                      )}
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: "#000" }}>{COMPANY.name}</div>
                        <div style={{ fontSize: 10, color: "#555" }}>MST: {COMPANY.mst}</div>
                        <div style={{ fontSize: 10, color: "#555" }}>ĐT: {COMPANY.phone} | Email: {COMPANY.email}</div>
                        <div style={{ fontSize: 10, color: "#555" }}>{COMPANY.address}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ width: "48%", verticalAlign: "top", textAlign: "center", paddingLeft: 12 }}>
                    <div style={{ fontWeight: 700, fontSize: 12, whiteSpace: "nowrap" }}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                    <div style={{ fontWeight: 600, fontSize: 12, whiteSpace: "nowrap", marginTop: 2 }}>Độc lập – Tự do – Hạnh phúc</div>
                    <div style={{ fontSize: 11, marginTop: 4, letterSpacing: "-1px" }}>⸻⸻⸻</div>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Document Title */}
            <div style={{ textAlign: "center", margin: "20px 0" }}>
              <h1 style={{ fontSize: 19, fontWeight: 800, textTransform: "uppercase", margin: 0, fontFamily: "var(--font-display)" }}>
                GIẤY ĐỀ NGHỊ THANH TOÁN
              </h1>
              <div style={{ fontSize: 11, fontStyle: "italic", color: "#555" }}>
                {isZh ? "付款申请书 PAYMENT REQUEST" : isEn ? "PAYMENT REQUEST" : ""}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>Số: {reqNumber}</div>
              <div style={{ fontSize: 11, color: "#444" }}>Ngày: {reqDate}</div>
            </div>

            {/* Recipient */}
            <div style={{ fontSize: 13.5, margin: "16px 0" }}>
              <b>Kính gửi / To:</b> <span style={{ fontSize: 14.5, fontWeight: 700 }}>{buyerName || "......................................................................................."}</span>
              {buyerNameEn && <div style={{ fontSize: 12, fontStyle: "italic", color: "#475569", marginLeft: 85 }}>{buyerNameEn}</div>}
            </div>

            {/* Basis */}
            <div style={{ marginBottom: 14, fontSize: 12.5, lineHeight: 1.6 }}>
              {requestType === "debt_recon" ? (
                <div>
                  Căn cứ kết quả cung cấp hàng hóa / dịch vụ và Biên bản đối chiếu công nợ số <b>{debtReconNo || "..."}</b> giữa hai bên, <b>{COMPANY.name}</b> trân trọng đề nghị Quý công ty thanh toán số tiền như sau:
                  {isZh && <div style={{ fontSize: 11, fontStyle: "italic", color: "#555" }}>根据双方供货结果及第 {debtReconNo || "..."} 号对账单，我司特此申请付款如下:</div>}
                  {isEn && <div style={{ fontSize: 11, fontStyle: "italic", color: "#555" }}>Based on the supply results and Debt Reconciliation Minutes No: {debtReconNo || "..."}, we kindly request payment as follows:</div>}
                </div>
              ) : (
                <div>
                  Căn cứ Hóa đơn GTGT số <b>{invoiceNo || "..."}</b> {invoiceSeries ? `(Ký hiệu ${invoiceSeries})` : ""}, <b>{COMPANY.name}</b> trân trọng đề nghị Quý công ty thanh toán số tiền như sau:
                  {isZh && <div style={{ fontSize: 11, fontStyle: "italic", color: "#555" }}>根据第 {invoiceNo || "..."} 号增值税发票，我司特此申请付款如下:</div>}
                  {isEn && <div style={{ fontSize: 11, fontStyle: "italic", color: "#555" }}>Based on VAT Invoice No: {invoiceNo || "..."}, we kindly request payment as follows:</div>}
                </div>
              )}
            </div>

            {/* Amount Table */}
            <table style={{ width: "100%", borderCollapse: "collapse", margin: "16px 0", fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th style={{ border: "1px solid #000", padding: "8px 12px", textAlign: "left" }}>
                    Nội dung đề nghị thanh toán / Reason
                  </th>
                  <th style={{ border: "1px solid #000", padding: "8px 12px", textAlign: "right", width: 160 }}>
                    Số tiền (VND)
                  </th>
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
                <tr style={{ background: "#f1f5f9" }}>
                  <td style={{ border: "1px solid #000", padding: "10px 12px", fontWeight: 800 }}>
                    TỔNG SỐ TIỀN ĐỀ NGHỊ THANH TOÁN:
                  </td>
                  <td style={{ border: "1px solid #000", padding: "10px 12px", textAlign: "right", fontWeight: 800, fontSize: 14.5 }}>
                    {fmt(amount)} đ
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Words */}
            <div style={{ fontSize: 12, marginBottom: 16 }}>
              <div><b>Bằng chữ:</b> <i>{numberToWordsVN(amount)}</i></div>
              {isEn && <div style={{ fontSize: 11, color: "#555" }}><b>In words:</b> <i>{numberToWordsEN(amount)}</i></div>}
              {isZh && <div style={{ fontSize: 11, color: "#555" }}><b>大写金额:</b> <i>{numberToWordsCN(amount)}</i></div>}
            </div>

            {/* Bank Transfer Info */}
            <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 6, padding: 14, margin: "16px 0", fontSize: 12 }}>
              <div style={{ fontWeight: 700, textDecoration: "underline", marginBottom: 6, fontSize: 12.5 }}>THÔNG TIN CHUYỂN KHOẢN / BANK TRANSFER DETAILS:</div>
              <div>• Tên tài khoản / Account Name: <b>{COMPANY.name}</b></div>
              <div>• Số tài khoản / Account No: <b style={{ fontSize: 13.5, color: "#0284c7" }}>{COMPANY.bankAccount || "3864136868"}</b></div>
              <div>• Ngân hàng / Bank Name: <b>{COMPANY.bankName || "MB Bank - Ngân hàng Quân Đội (Chi nhánh BRVT)"}</b></div>
              <div>• Nội dung chuyển khoản / Remark: <b>Thanh toan cho {reqNumber}</b></div>
            </div>

            <div style={{ fontSize: 12 }}>
              Rất mong nhận được sự hợp tác và thanh toán đúng hạn từ Quý công ty. Trân trọng cảm ơn!
            </div>

            {/* Signatures */}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 36, textAlign: "center", fontSize: 12 }}>
              <div style={{ width: "45%" }}>
                <div style={{ fontWeight: 700 }}>ĐẠI DIỆN KHÁCH HÀNG</div>
                <div style={{ fontSize: 11, color: "#555", fontStyle: "italic" }}>(Ký & nhận giấy / Buyer Representative)</div>
                <div style={{ height: 65 }}></div>
                <div style={{ fontWeight: 600 }}>{buyerRep || buyerName || "...................................."}</div>
              </div>
              <div style={{ width: "45%" }}>
                <div style={{ fontWeight: 700 }}>ĐẠI DIỆN BÊN ĐỀ NGHỊ (BÊN A)</div>
                <div style={{ fontSize: 11, color: "#555", fontStyle: "italic" }}>(Ký, ghi rõ họ tên & đóng dấu)</div>
                <div style={{ height: 65 }}></div>
                <div style={{ fontWeight: 600 }}>{COMPANY.representative}</div>
                <div style={{ fontSize: 11 }}>{COMPANY.position}</div>
                <div style={{ fontSize: 11 }}>{COMPANY.name}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
