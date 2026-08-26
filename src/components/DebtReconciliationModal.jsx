import React, { useState, useRef, useEffect } from 'react';
import { COMPANY, _mem, getLogoUrl } from '../utils/gasStore';
import { fmt, todayStr, parseInvoiceXml, numberToWordsVN, numberToWordsEN, numberToWordsCN } from '../utils/helpers';
import { upsertSupabaseDebtRecs, fetchSupabaseDebtRecs } from '../utils/supabaseClient';

export default function DebtReconciliationModal({ onClose, onOpenPaymentRequest }) {
  const [lang, setLang] = useState("vi_en");
  const [refNum, setRefNum] = useState(`BBDCCN-01/${new Date().getFullYear()}`);
  const [dateStr, setDateStr] = useState(todayStr());
  const [reconcileDate, setReconcileDate] = useState(todayStr());
  
  // Party A (Seller)
  const [sellerRep, setSellerRep] = useState(COMPANY.representative || "TRẦN VĂN THỊNH");
  const [sellerPos, setSellerPos] = useState(COMPANY.position || "Giám Đốc");

  // Party B (Buyer)
  const [buyerName, setBuyerName] = useState("");
  const [buyerNameEn, setBuyerNameEn] = useState("");
  const [buyerTax, setBuyerTax] = useState("");
  const [buyerAddr, setBuyerAddr] = useState("");
  const [buyerAddrEn, setBuyerAddrEn] = useState("");
  const [buyerRep, setBuyerRep] = useState("");
  const [buyerPos, setBuyerPos] = useState("");

  // Invoices & Items List
  const [invoices, setInvoices] = useState([]);
  const [savedList, setSavedList] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [translating, setTranslating] = useState(false);
  const [xmlError, setXmlError] = useState("");

  const fileInputRef = useRef(null);

  // Load saved debt reconciliation statements from Supabase / Memory
  useEffect(() => {
    (async () => {
      setLoadingList(true);
      try {
        const cloudData = await fetchSupabaseDebtRecs();
        if (cloudData && Object.keys(cloudData).length > 0) {
          _mem.debtRecs = cloudData;
          setSavedList(Object.values(cloudData));
        } else if (_mem.debtRecs) {
          setSavedList(Object.values(_mem.debtRecs));
        }
      } catch (e) {
        if (_mem.debtRecs) setSavedList(Object.values(_mem.debtRecs));
      } finally {
        setLoadingList(false);
      }
    })();
  }, []);

  // 1. XML Invoice Import (VNPT, MISA, FAST, Viettel)
  const handleXmlUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setXmlError("");

    const newInvoices = [];
    for (const file of Array.from(files)) {
      try {
        const text = await file.text();
        const parsed = parseInvoiceXml(text);
        parsed._id = Math.random().toString(36).substring(2, 9);
        parsed._fileName = file.name;
        newInvoices.push(parsed);
      } catch (err) {
        setXmlError("Lỗi đọc XML file " + file.name + ": " + err.message);
      }
    }

    if (newInvoices.length > 0) {
      setInvoices(prev => [...prev, ...newInvoices]);
      const last = newInvoices[newInvoices.length - 1];
      if (last.buyerName && !buyerName) setBuyerName(last.buyerName);
      if (last.buyerTax && !buyerTax) setBuyerTax(last.buyerTax);
      if (last.buyerAddr && !buyerAddr) setBuyerAddr(last.buyerAddr);
      setSaveMsg(`⚡ Đã import ${newInvoices.length} file XML hóa đơn thành công!`);
      setTimeout(() => setSaveMsg(""), 4000);
    }
  };

  // 2. Select saved statement to edit
  const handleSelectSaved = (recId) => {
    const found = savedList.find(s => s.id === recId || s.refNum === recId);
    if (found) {
      setRefNum(found.refNum || found.id);
      setBuyerName(found.buyerName || "");
      setBuyerNameEn(found.buyerNameEn || "");
      setBuyerTax(found.buyerTax || "");
      setBuyerAddr(found.buyerAddr || "");
      setBuyerAddrEn(found.buyerAddrEn || "");
      setBuyerRep(found.buyerRep || "");
      setBuyerPos(found.buyerPos || "");
      setDateStr(found.dateStr || todayStr());
      setReconcileDate(found.reconcileDate || todayStr());
      if (Array.isArray(found.invoices)) setInvoices(found.invoices);
    }
  };

  // 3. Auto Translate
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
      const [tName, tAddr] = await Promise.all([
        translate(buyerName),
        translate(buyerAddr)
      ]);
      setBuyerNameEn(tName);
      setBuyerAddrEn(tAddr);

      const updatedInvoices = await Promise.all(invoices.map(async inv => ({
        ...inv,
        items: await Promise.all(inv.items.map(async it => ({
          ...it,
          nameEn: await translate(it.name)
        })))
      })));
      setInvoices(updatedInvoices);

      setSaveMsg(`✓ Đã tự động dịch sang ${lang === "vi_zh" ? "Tiếng Trung" : "Tiếng Anh"} thành công!`);
      setTimeout(() => setSaveMsg(""), 4000);
    } catch (err) {
      alert("Lỗi dịch tự động: " + err.message);
    } finally {
      setTranslating(false);
    }
  };

  // Totals calculations
  const totalGoods = invoices.reduce((s, inv) => s + (inv.subtotal || 0), 0);
  const totalVat = invoices.reduce((s, inv) => s + (inv.vatTotal || 0), 0);
  const grandTotal = invoices.reduce((s, inv) => s + (inv.grandTotal || 0), 0);

  // Save to Cloud
  const handleSaveToCloud = async () => {
    setSaving(true);
    setSaveMsg("");
    try {
      const record = {
        id: refNum,
        refNum,
        buyerName,
        buyerNameEn,
        buyerTax,
        buyerAddr,
        buyerAddrEn,
        buyerRep,
        buyerPos,
        sellerRep,
        sellerPos,
        dateStr,
        reconcileDate,
        invoices,
        subtotal: totalGoods,
        vatAmount: totalVat,
        grandTotal,
        updatedAt: new Date().toISOString()
      };

      _mem.debtRecs = _mem.debtRecs || {};
      _mem.debtRecs[refNum] = record;
      await upsertSupabaseDebtRecs({ [refNum]: record });

      setSaveMsg("✅ Đã lưu Biên bản đối chiếu công nợ lên Supabase Cloud!");
      setTimeout(() => setSaveMsg(""), 4000);
    } catch (e) {
      setSaveMsg("⚠️ Lỗi lưu Cloud: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  // Translations Map
  const tMap = {
    vi_en: {
      title: "BIÊN BẢN ĐỐI CHIẾU CÔNG NỢ",
      titleSub: "DEBT RECONCILIATION STATEMENT",
      intro: `Hôm nay, ngày ${dateStr}, Hai bên cùng nhau đối chiếu công nợ phải thu tính đến hết ngày ${reconcileDate}:`,
      introSub: `Today, on ${dateStr}, Both parties hereby reconcile receivables up to ${reconcileDate}:`,
      partyA: "ĐẠI DIỆN BÊN BÁN (Bên A) / SELLER REPRESENTATIVE (Party A)",
      partyB: "ĐẠI DIỆN BÊN MUA (Bên B) / BUYER REPRESENTATIVE (Party B)",
      company: "Công ty / Company",
      tax: "MST / Tax ID",
      address: "Địa chỉ / Address",
      rep: "Người đại diện / Representative",
      position: "Chức vụ / Position",
      summary: `Hai bên cùng nhau đối chiếu công nợ phải thu tính đến hết ngày ${reconcileDate}, còn phải thu của ${buyerName || "Quý công ty"} số tiền là: ${fmt(grandTotal)} đồng.`,
      summarySub: `Both parties have reconciled receivables up to ${reconcileDate}, the amount due from ${buyerNameEn || buyerName || "Your company"} is: ${fmt(grandTotal)} VND.`,
      wordsPrefix: "Viết bằng chữ / In words: ",
      wordsText: numberToWordsVN(grandTotal),
      wordsTextSub: numberToWordsEN(grandTotal),
      copyNote: "Biên bản này được lập thành 02 bản, mỗi bên giữ 01 bản có giá trị như nhau.",
      copyNoteSub: "This statement is made in 02 copies of equal legal validity, each party keeps 01 copy.",
      buyerSign: "ĐẠI DIỆN BÊN MUA (BÊN B)",
      buyerSignSub: "(Ký, ghi rõ họ tên & đóng dấu / Sign & Stamp)",
      sellerSign: "ĐẠI DIỆN BÊN BÁN (BÊN A)",
      sellerSignSub: "(Ký, ghi rõ họ tên & đóng dấu / Sign & Stamp)"
    },
    vi_zh: {
      title: "BIÊN BẢN ĐỐI CHIẾU CÔNG NỢ",
      titleSub: "应收账款对账单",
      intro: `Hôm nay, ngày ${dateStr}, Hai bên cùng nhau đối chiếu công nợ phải thu tính đến hết ngày ${reconcileDate}:`,
      introSub: `今天，双方组成如下: ${dateStr}, 双方已就截至该日的应收账款进行核对，具体如下: ${reconcileDate}.`,
      partyA: "ĐẠI DIỆN BÊN BÁN (Bên A) / 销售方代表 (甲方)",
      partyB: "ĐẠI DIỆN BÊN MUA (Bên B) / 采购方代表 (乙方)",
      company: "Công ty / 公司",
      tax: "MST / 税号",
      address: "Địa chỉ / 地址",
      rep: "Người đại diện / 代表人",
      position: "Chức vụ / 职位",
      summary: `Hai bên cùng nhau đối chiếu công nợ phải thu tính đến hết ngày ${reconcileDate}, còn phải thu của ${buyerName || "Quý công ty"} số tiền là: ${fmt(grandTotal)} đồng.`,
      summarySub: `双方已就截至该日的应收账款进行核对，具体如下: ${reconcileDate}, 需向 ${buyerNameEn || buyerName || "贵公司"} 金额为: ${fmt(grandTotal)} VND.`,
      wordsPrefix: "Viết bằng chữ / 大写金额: ",
      wordsText: numberToWordsVN(grandTotal),
      wordsTextSub: numberToWordsCN(grandTotal),
      copyNote: "Biên bản này được lập thành 02 bản, mỗi bên giữ 01 bản có giá trị như nhau.",
      copyNoteSub: "本对账单一式两份，双方各执一份，效力相同。",
      buyerSign: "ĐẠI DIỆN BÊN MUA (BÊN B)",
      buyerSignSub: "(Ký, ghi rõ họ tên / 采购方代表)",
      sellerSign: "ĐẠI DIỆN BÊN BÁN (BÊN A)",
      sellerSignSub: "(Ký, ghi rõ họ tên / 销售方代表)"
    },
    vi: {
      title: "BIÊN BẢN ĐỐI CHIẾU CÔNG NỢ",
      titleSub: "",
      intro: `Hôm nay, ngày ${dateStr}, Hai bên cùng nhau đối chiếu công nợ phải thu tính đến hết ngày ${reconcileDate}:`,
      introSub: "",
      partyA: "ĐẠI DIỆN BÊN BÁN (Bên A)",
      partyB: "ĐẠI DIỆN BÊN MUA (Bên B)",
      company: "Công ty",
      tax: "MST",
      address: "Địa chỉ",
      rep: "Người đại diện",
      position: "Chức vụ",
      summary: `Hai bên cùng nhau đối chiếu công nợ phải thu tính đến hết ngày ${reconcileDate}, còn phải thu của ${buyerName || "Quý công ty"} số tiền là: ${fmt(grandTotal)} đồng.`,
      summarySub: "",
      wordsPrefix: "Viết bằng chữ: ",
      wordsText: numberToWordsVN(grandTotal),
      wordsTextSub: "",
      copyNote: "Biên bản này được lập thành 02 bản, mỗi bên giữ 01 bản có giá trị như nhau.",
      copyNoteSub: "",
      buyerSign: "ĐẠI DIỆN BÊN MUA (BÊN B)",
      buyerSignSub: "(Ký, ghi rõ họ tên & đóng dấu)",
      sellerSign: "ĐẠI DIỆN BÊN BÁN (BÊN A)",
      sellerSignSub: "(Ký, ghi rõ họ tên & đóng dấu)"
    }
  };

  const currentT = tMap[lang] || tMap.vi_en;

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
            onClick={() => onOpenPaymentRequest && onOpenPaymentRequest({
              requestType: "debt_recon",
              buyerName,
              buyerTaxCode: buyerTax,
              buyerAddress: buyerAddr,
              buyerRep,
              buyerPosition: buyerPos,
              debtReconNo: refNum,
              debtReconDate: dateStr,
              amount: grandTotal,
              reason: `Thanh toán số tiền công nợ theo Biên bản đối chiếu công nợ số ${refNum} ngày ${dateStr}`
            })}
            disabled={invoices.length === 0}
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

      {/* Main Container */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Left Form Controls Sidebar */}
        <div className="no-print" style={{
          width: 350,
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
            <option value="vi_zh">🇻🇳 🇨🇳 Song ngữ Việt - Trung (giản thể)</option>
          </select>

          <h3 style={{ fontSize: 14, color: "#94a3b8", marginBottom: 10 }}>📂 Import hóa đơn XML</h3>
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
            🗂️ Click chọn file XML (VNPT, MISA, FAST...)
          </button>
          {xmlError && <div style={{ color: "#f87171", fontSize: 12, marginBottom: 12 }}>{xmlError}</div>}

          {savedList.length > 0 && (
            <>
              <h3 style={{ fontSize: 14, color: "#94a3b8", marginBottom: 10 }}>🗂️ Biên bản đã lưu</h3>
              <select
                onChange={e => handleSelectSaved(e.target.value)}
                style={{ width: "100%", padding: 8, background: "#0f172a", border: "1px solid #475569", color: "#fff", borderRadius: 6, marginBottom: 16 }}
              >
                <option value="">-- Select Saved Statement --</option>
                {savedList.map(s => (
                  <option key={s.id || s.refNum} value={s.id || s.refNum}>
                    {s.refNum || s.id} - {s.buyerName} ({fmt(s.grandTotal)}đ)
                  </option>
                ))}
              </select>
            </>
          )}

          <h3 style={{ fontSize: 14, color: "#94a3b8", marginBottom: 10 }}>📝 Thông tin Biên bản</h3>
          <label style={{ fontSize: 12, color: "#cbd5e1" }}>Số Biên Bản</label>
          <input
            type="text" value={refNum} onChange={e => setRefNum(e.target.value)}
            style={{ width: "100%", padding: 8, background: "#0f172a", border: "1px solid #475569", color: "#fff", borderRadius: 6, marginBottom: 12 }}
          />

          <label style={{ fontSize: 12, color: "#cbd5e1" }}>Ngày Lập</label>
          <input
            type="text" value={dateStr} onChange={e => setDateStr(e.target.value)}
            style={{ width: "100%", padding: 8, background: "#0f172a", border: "1px solid #475569", color: "#fff", borderRadius: 6, marginBottom: 12 }}
          />

          <label style={{ fontSize: 12, color: "#cbd5e1" }}>Đối Chiếu Đến Ngày</label>
          <input
            type="text" value={reconcileDate} onChange={e => setReconcileDate(e.target.value)}
            style={{ width: "100%", padding: 8, background: "#0f172a", border: "1px solid #475569", color: "#fff", borderRadius: 6, marginBottom: 12 }}
          />

          <h3 style={{ fontSize: 14, color: "#94a3b8", marginBottom: 10 }}>🏢 Bên Bán (Party A)</h3>
          <label style={{ fontSize: 12, color: "#cbd5e1" }}>Người Đại Diện</label>
          <input
            type="text" value={sellerRep} onChange={e => setSellerRep(e.target.value)}
            style={{ width: "100%", padding: 8, background: "#0f172a", border: "1px solid #475569", color: "#fff", borderRadius: 6, marginBottom: 8 }}
          />
          <label style={{ fontSize: 12, color: "#cbd5e1" }}>Chức Vụ</label>
          <input
            type="text" value={sellerPos} onChange={e => setSellerPos(e.target.value)}
            style={{ width: "100%", padding: 8, background: "#0f172a", border: "1px solid #475569", color: "#fff", borderRadius: 6, marginBottom: 12 }}
          />

          <h3 style={{ fontSize: 14, color: "#94a3b8", marginBottom: 10 }}>🧑‍💼 Bên Mua (Party B)</h3>
          <label style={{ fontSize: 12, color: "#cbd5e1" }}>Tên Công Ty / Đơn Vị</label>
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

          <label style={{ fontSize: 12, color: "#cbd5e1" }}>Người Đại Diện</label>
          <input
            type="text" value={buyerRep} onChange={e => setBuyerRep(e.target.value)}
            style={{ width: "100%", padding: 8, background: "#0f172a", border: "1px solid #475569", color: "#fff", borderRadius: 6, marginBottom: 8 }}
          />
          <label style={{ fontSize: 12, color: "#cbd5e1" }}>Chức Vụ</label>
          <input
            type="text" value={buyerPos} onChange={e => setBuyerPos(e.target.value)}
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
            {/* Header Table */}
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16 }}>
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
            <div style={{ textAlign: "center", margin: "16px 0 14px" }}>
              <h1 style={{ fontSize: 18, fontWeight: 800, textTransform: "uppercase", margin: 0, fontFamily: "var(--font-display)" }}>
                {currentT.title}
              </h1>
              {currentT.titleSub && (
                <div style={{ fontSize: 12, fontStyle: "italic", color: "#555", marginTop: 2 }}>{currentT.titleSub}</div>
              )}
              <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>Số: {refNum}</div>
              <div style={{ fontSize: 11, color: "#444", marginTop: 2 }}>
                Ngày lập: <b>{dateStr}</b> — Đối chiếu đến ngày: <b>{reconcileDate}</b>
              </div>
            </div>

            {/* Opening Intro */}
            <div style={{ fontSize: 12.5, marginBottom: 12, lineHeight: 1.6 }}>
              <div>{currentT.intro}</div>
              {currentT.introSub && <div style={{ fontSize: 11, fontStyle: "italic", color: "#555" }}>{currentT.introSub}</div>}
            </div>

            {/* Party A */}
            <div style={{ marginBottom: 12, fontSize: 12, lineHeight: 1.6 }}>
              <div style={{ fontWeight: 700 }}>{currentT.partyA}</div>
              <table style={{ width: "100%", borderCollapse: "collapse", marginLeft: 10 }}>
                <tbody>
                  <tr>
                    <td style={{ width: "55%" }}>{currentT.company}: <b>{COMPANY.name}</b></td>
                    <td>{currentT.tax}: {COMPANY.mst}</td>
                  </tr>
                  <tr>
                    <td>{currentT.rep}: <b>{sellerRep}</b></td>
                    <td>{currentT.position}: {sellerPos}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Party B */}
            <div style={{ marginBottom: 14, fontSize: 12, lineHeight: 1.6 }}>
              <div style={{ fontWeight: 700 }}>{currentT.partyB}</div>
              <table style={{ width: "100%", borderCollapse: "collapse", marginLeft: 10 }}>
                <tbody>
                  <tr>
                    <td style={{ width: "55%" }}>
                      {currentT.company}: <b>{buyerName || "……………………………………………………"}</b>
                      {buyerNameEn && <div style={{ fontSize: 11, fontStyle: "italic", color: "#555" }}>{buyerNameEn}</div>}
                    </td>
                    <td style={{ verticalAlign: "top" }}>{currentT.tax}: {buyerTax || "………………………"}</td>
                  </tr>
                  {buyerAddr && (
                    <tr>
                      <td colSpan="2">
                        {currentT.address}: {buyerAddr}
                        {buyerAddrEn && <div style={{ fontSize: 11, fontStyle: "italic", color: "#555" }}>{buyerAddrEn}</div>}
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td>{currentT.rep}: <b>{buyerRep || "…………………………………………"}</b></td>
                    <td>{currentT.position}: {buyerPos || "……………………"}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Summary Line */}
            <div style={{ fontSize: 12.5, marginBottom: 14, lineHeight: 1.6 }}>
              <div>{currentT.summary}</div>
              {currentT.summarySub && <div style={{ fontSize: 11, fontStyle: "italic", color: "#555" }}>{currentT.summarySub}</div>}
            </div>

            {/* Invoices & Items Table */}
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 14, fontSize: 11.5 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th style={{ border: "1px solid #000", padding: "6px 4px", width: 36, textAlign: "center" }}>STT / 序号</th>
                  <th style={{ border: "1px solid #000", padding: "6px 4px", width: 120 }}>Số / Ký hiệu HĐ / 发票号/系列</th>
                  <th style={{ border: "1px solid #000", padding: "6px 4px", textAlign: "left" }}>Hàng hóa / Dịch vụ / 货物/服务</th>
                  <th style={{ border: "1px solid #000", padding: "6px 4px", width: 45, textAlign: "center" }}>ĐVT / 单位</th>
                  <th style={{ border: "1px solid #000", padding: "6px 4px", width: 40, textAlign: "center" }}>SL / 数量</th>
                  <th style={{ border: "1px solid #000", padding: "6px 4px", width: 85, textAlign: "right" }}>Đơn giá / 单价</th>
                  <th style={{ border: "1px solid #000", padding: "6px 4px", width: 65, textAlign: "center" }}>Thuế (%) / 税率</th>
                  <th style={{ border: "1px solid #000", padding: "6px 4px", width: 95, textAlign: "right" }}>Thành tiền / 金额</th>
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ border: "1px solid #000", padding: 16, textAlign: "center", color: "#888", fontStyle: "italic" }}>
                      Chưa có hóa đơn nào — hãy import file XML hóa đơn điện tử ở cột bên trái
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv, invIdx) => {
                    let globalIdx = 0;
                    return (
                      <React.Fragment key={inv._id || invIdx}>
                        {/* Invoice Header Sub-row */}
                        <tr style={{ background: "#f0f4ff", fontWeight: 700 }}>
                          <td colSpan="2" style={{ border: "1px solid #000", padding: "5px 8px" }}>
                            HĐ: {inv.serial ? `${inv.serial} / ` : ""}{inv.invoiceNumber || "—"}
                          </td>
                          <td colSpan="2" style={{ border: "1px solid #000", padding: "5px 8px" }}>
                            Ngày: {inv.invoiceDate || "—"}
                          </td>
                          <td colSpan="4" style={{ border: "1px solid #000", padding: "5px 8px", textAlign: "right" }}>
                            Tổng HĐ: {fmt(inv.grandTotal)} đ
                          </td>
                        </tr>

                        {/* Invoice Items */}
                        {inv.items.map((it, itIdx) => {
                          globalIdx++;
                          const vatDisplay = it.vatRate === -1 ? "KCT" : `${it.vatRate || 0}%`;
                          return (
                            <tr key={itIdx}>
                              <td style={{ border: "1px solid #000", padding: "5px 4px", textAlign: "center" }}>{itIdx + 1}</td>
                              <td style={{ border: "1px solid #000", padding: "5px 4px" }}>
                                {inv.serial ? `${inv.serial} / ` : ""}{inv.invoiceNumber || "—"}
                              </td>
                              <td style={{ border: "1px solid #000", padding: "5px 6px" }}>
                                <div>{it.name}</div>
                                {it.nameEn && <div style={{ fontSize: 10, fontStyle: "italic", color: "#555" }}>{it.nameEn}</div>}
                              </td>
                              <td style={{ border: "1px solid #000", padding: "5px 4px", textAlign: "center" }}>{it.unit}</td>
                              <td style={{ border: "1px solid #000", padding: "5px 4px", textAlign: "center" }}>{it.qty}</td>
                              <td style={{ border: "1px solid #000", padding: "5px 6px", textAlign: "right" }}>{fmt(it.price)}</td>
                              <td style={{ border: "1px solid #000", padding: "5px 4px", textAlign: "center" }}>{vatDisplay}</td>
                              <td style={{ border: "1px solid #000", padding: "5px 6px", textAlign: "right" }}>{fmt(it.lineTotal + it.vatAmt)}</td>
                            </tr>
                          );
                        })}

                        {/* Invoice Subtotal Row */}
                        <tr style={{ background: "#fafafb", fontWeight: 600 }}>
                          <td colSpan="6" style={{ border: "1px solid #000", padding: "5px 8px", textAlign: "right" }}>
                            Tiền hàng: {fmt(inv.subtotal)} đ | VAT: {fmt(inv.vatTotal)} đ
                          </td>
                          <td colSpan="2" style={{ border: "1px solid #000", padding: "5px 8px", textAlign: "right" }}>
                            Tổng: {fmt(inv.grandTotal)} đ
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
              {invoices.length > 0 && (
                <tfoot>
                  <tr style={{ background: "#f1f5f9", fontWeight: 700 }}>
                    <td colSpan="6" style={{ border: "1px solid #000", padding: "6px 8px", textAlign: "right" }}>
                      Tổng tiền hàng (chưa VAT) / 货物总额 (不含增值税):
                    </td>
                    <td colSpan="2" style={{ border: "1px solid #000", padding: "6px 8px", textAlign: "right" }}>
                      {fmt(totalGoods)} đ
                    </td>
                  </tr>
                  <tr style={{ background: "#f1f5f9", fontWeight: 700 }}>
                    <td colSpan="6" style={{ border: "1px solid #000", padding: "6px 8px", textAlign: "right" }}>
                      Tổng thuế VAT / 增值税总额:
                    </td>
                    <td colSpan="2" style={{ border: "1px solid #000", padding: "6px 8px", textAlign: "right" }}>
                      {fmt(totalVat)} đ
                    </td>
                  </tr>
                  <tr style={{ background: "#e2e8f0", fontWeight: 800 }}>
                    <td colSpan="6" style={{ border: "1px solid #000", padding: "8px 8px", textAlign: "right", fontSize: 13 }}>
                      TỔNG CỘNG PHẢI THU / 应收总额:
                    </td>
                    <td colSpan="2" style={{ border: "1px solid #000", padding: "8px 8px", textAlign: "right", fontSize: 14 }}>
                      {fmt(grandTotal)} đ
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>

            {/* Closing Notes */}
            <div style={{ fontSize: 12, lineHeight: 1.7, marginBottom: 20 }}>
              <div>
                Như vậy, tính đến ngày <b>{reconcileDate}</b>, {COMPANY.name} còn phải thu của <b>{buyerName || "Quý công ty"}</b> số tiền là: <b>{fmt(grandTotal)} đồng</b>.
              </div>
              <div style={{ marginTop: 4 }}>
                <b>{currentT.wordsPrefix}</b><i>{currentT.wordsText}</i>
              </div>
              {currentT.wordsTextSub && (
                <div style={{ fontSize: 11, color: "#555" }}>
                  <i>{currentT.wordsTextSub}</i>
                </div>
              )}
              <div style={{ marginTop: 8 }}>
                {currentT.copyNote}
              </div>
              {currentT.copyNoteSub && (
                <div style={{ fontSize: 11, color: "#555" }}>
                  {currentT.copyNoteSub}
                </div>
              )}
            </div>

            {/* Signatures */}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 30, textAlign: "center", fontSize: 12 }}>
              <div style={{ width: "45%" }}>
                <div style={{ fontWeight: 700 }}>{currentT.buyerSign}</div>
                <div style={{ fontSize: 11, color: "#555", fontStyle: "italic" }}>{currentT.buyerSignSub}</div>
                <div style={{ height: 70 }}></div>
                <div style={{ fontWeight: 600 }}>{buyerRep || buyerName || "...................................."}</div>
              </div>
              <div style={{ width: "45%" }}>
                <div style={{ fontWeight: 700 }}>{currentT.sellerSign}</div>
                <div style={{ fontSize: 11, color: "#555", fontStyle: "italic" }}>{currentT.sellerSignSub}</div>
                <div style={{ height: 70 }}></div>
                <div style={{ fontWeight: 600 }}>{sellerRep}</div>
                <div style={{ fontSize: 11 }}>{sellerPos}</div>
                <div style={{ fontSize: 11 }}>{COMPANY.name}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
