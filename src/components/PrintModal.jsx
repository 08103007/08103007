import React, { useState } from 'react';
import { COMPANY, getLogoUrl, showToast } from '../utils/gasStore';
import { calcItems, fmt } from '../utils/helpers';
import { printElementViaIframe, exportElementToPdf } from '../utils/pdfExporter';
import { 
  buildDocxBlob, dxPara, dxHeaderCell, dxRow, dxTable, 
  dxNoBorderTable, dxNoBorderCell, dxImage, downloadBlob
} from '../utils/docxBuilder';

const QUOTE_T = {
  vi: {
    title: "BẢNG BÁO GIÁ",
    ref: "Số",
    to: "Kính gửi:",
    contact: "Người liên hệ:",
    content: "Nội dung:",
    colStt: "STT",
    colImg: "HÌNH",
    colItem: "HÀNG HÓA / DỊCH VỤ",
    colQty: "SL",
    colUnit: "ĐVT",
    colPrice: "ĐƠN GIÁ",
    colVat: "VAT",
    colTotal: "THÀNH TIỀN",
    subtotalLabel: "CỘNG TIỀN HÀNG (CHƯA VAT):",
    vatLabel: "TỔNG TIỀN THUẾ VAT:",
    grandTotalLabel: "TỔNG CỘNG THANH TOÁN (GỒM VAT):",
    notesHeader: "Ghi chú & Điều khoản:",
    signTitle: COMPANY.short
  },
  vi_en: {
    title: "BẢNG BÁO GIÁ",
    titleB: "QUOTATION",
    ref: "Số / No",
    to: "Kính gửi / To:",
    contact: "Người liên hệ / Attn:",
    content: "Nội dung / Subject:",
    colStt: "STT",
    colImg: "HÌNH",
    colItem: "HÀNG HÓA / DỊCH VỤ\n(DESCRIPTION)",
    colQty: "SL\nQTY",
    colUnit: "ĐVT\nUNIT",
    colPrice: "ĐƠN GIÁ\nUNIT PRICE",
    colVat: "VAT",
    colTotal: "THÀNH TIỀN\nAMOUNT",
    subtotalLabel: "CỘNG TIỀN HÀNG (CHƯA VAT) / SUBTOTAL (EXCL. VAT):",
    vatLabel: "TỔNG TIỀN THUẾ VAT / VAT AMOUNT:",
    grandTotalLabel: "TỔNG CỘNG THANH TOÁN (GỒM VAT) / GRAND TOTAL:",
    notesHeader: "Ghi chú & Điều khoản / Notes & Terms:",
    signTitle: COMPANY.short
  },
  vi_zh: {
    title: "BẢNG BÁO GIÁ",
    titleB: "报价单",
    ref: "Số / 编号",
    to: "Kính gửi / 致:",
    contact: "Người liên hệ / 联系人:",
    content: "Nội dung / 主题:",
    colStt: "STT",
    colImg: "HÌNH",
    colItem: "HÀNG HÓA / DỊCH VỤ\n(货物/服务)",
    colQty: "SL\n数量",
    colUnit: "ĐVT\n单位",
    colPrice: "ĐƠN GIÁ\n单价",
    colVat: "VAT",
    colTotal: "THÀNH TIỀN\n金额",
    subtotalLabel: "CỘNG TIỀN HÀNG (CHƯA VAT) / 小计 (不含税):",
    vatLabel: "TỔNG TIỀN THUẾ VAT / 增值税额:",
    grandTotalLabel: "TỔNG CỘNG THANH TOÁN (GỒM VAT) / 总计:",
    notesHeader: "Ghi chú & Điều khoản / 备注与条款:",
    signTitle: COMPANY.short
  }
};

export default function PrintModal({ quote, onClose, onCreateContract, onHandover, onDelivery }) {
  const { subtotal, vat, total } = calcItems(quote.items, quote.vatRate);
  const today = new Date();
  const [pdfLoading, setPdfLoading] = useState(false);
  const [wordLoading, setWordLoading] = useState(false);
  const [translating, setTranslating] = useState(false);

  // Quote State
  const [localQuote, setLocalQuote] = useState(quote);

  // Language state
  const [lang, setLang] = useState(() => quote.lang || "vi");

  // Print Template Options state
  const [printOptions, setPrintOptions] = useState({
    showStt: true,
    showImage: localQuote.items.some(it => it.image && it.image.trim()),
    showNote: true,
    showVat: true,
  });

  const T = QUOTE_T[lang] || QUOTE_T.vi;

  const handleAutoTranslate = async () => {
    if (lang === "vi") {
      showToast("💡 Vui lòng chọn ngôn ngữ Song ngữ (Việt - Anh hoặc Việt - Trung)", 2500);
      return;
    }
    setTranslating(true);
    const targetLangCode = lang === "vi_en" ? "en" : "zh-CN";

    const translateStr = async (str) => {
      if (!str || !str.trim()) return "";
      try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=vi&tl=${targetLangCode}&dt=t&q=${encodeURIComponent(str.trim())}`;
        const res = await fetch(url);
        const data = await res.json();
        return data?.[0]?.map(x => x[0]).join("") || str;
      } catch (e) {
        return str;
      }
    };

    try {
      let workContentEn = localQuote.workContentEn;
      let notesEn = localQuote.notesEn;

      if (localQuote.workContent && !workContentEn) {
        workContentEn = await translateStr(localQuote.workContent);
      }
      if (localQuote.notes && !notesEn) {
        notesEn = await translateStr(localQuote.notes);
      }

      const updatedItems = await Promise.all(localQuote.items.map(async it => {
        let nameEn = it.nameEn;
        let noteEn = it.noteEn;
        if (it.name && !nameEn) {
          nameEn = await translateStr(it.name);
        }
        if (it.note && !noteEn) {
          noteEn = await translateStr(it.note);
        }
        return { ...it, nameEn, noteEn };
      }));

      setLocalQuote(prev => ({
        ...prev,
        workContentEn,
        notesEn,
        items: updatedItems
      }));

      showToast("✓ Tự động dịch báo giá thành công!", 2000);
    } catch (e) {
      showToast("⚠️ Lỗi dịch: " + e.message, 2500);
    } finally {
      setTranslating(false);
    }
  };

  const handleWord = async () => {
    setWordLoading(true);
    try {
      const colW = [];
      if (printOptions.showStt) colW.push(400);
      if (printOptions.showImage) colW.push(900);
      colW.push(2600); // Hàng hóa
      colW.push(560);  // SL
      colW.push(660);  // ĐVT
      colW.push(1100); // Đơn giá
      if (printOptions.showVat) colW.push(600);
      colW.push(1200); // Thành tiền

      const totalW = colW.reduce((a, b) => a + b, 0);

      const imageMap = {};
      let imgCounter = 0;
      const getImgRid = (dataUrl) => {
        if (!dataUrl) return null;
        imgCounter++;
        const rId = `rIdImg${imgCounter}`;
        const ext = dataUrl.startsWith("data:image/png") ? "png" : "jpg";
        imageMap[rId] = { dataUrl, ext };
        return rId;
      };

      const logoRid = getLogoUrl() && getLogoUrl().length > 100 ? getImgRid(getLogoUrl()) : null;

      const logoCell = logoRid
        ? dxNoBorderCell(`<w:p><w:pPr><w:jc w:val="center"/></w:pPr>${dxImage(logoRid, 571500, 571500)}</w:p>`, 1100)
        : dxNoBorderCell("<w:p/>", 1100);
      const companyCell = dxNoBorderCell([
        dxPara([{ text: COMPANY.name, bold: true, color: "1A2540" }], { size: 26, spaceAfter: 0 }),
        dxPara([{ text: `MST: ${COMPANY.mst}`, color: "555555" }], { size: 18, spaceAfter: 0 }),
        dxPara([{ text: `Địa chỉ: ${COMPANY.address}`, color: "555555" }], { size: 18, spaceAfter: 0 }),
        dxPara([{ text: `ĐT: ${COMPANY.phone} | Email: ${COMPANY.email}`, color: "555555" }], { size: 18, spaceAfter: 80 }),
      ], 7800);
      const headerCompTable = dxNoBorderTable([dxRow([logoCell, companyCell])], 8900);

      const headers = [];
      if (printOptions.showStt) headers.push(T.colStt);
      if (printOptions.showImage) headers.push(T.colImg);
      headers.push(T.colItem, T.colQty, T.colUnit, T.colPrice);
      if (printOptions.showVat) headers.push(T.colVat);
      headers.push(T.colTotal);

      const headerRow = dxRow(headers.map((h, i) => dxHeaderCell(h, "", colW[i])), { header: true });

      const itemRows = localQuote.items.map((it, idx) => {
        const line = (it.qty || 0) * (it.price || 0);
        const iRate = it.vatRate !== undefined ? it.vatRate : (localQuote.vatRate !== undefined ? localQuote.vatRate : 8);
        const vatLbl = iRate === -1 ? "KCT" : iRate + "%";
        const imgRid = (printOptions.showImage && it.image) ? getImgRid(it.image) : null;

        const cells = [];
        let cIdx = 0;

        if (printOptions.showStt) {
          cells.push(`<w:tc><w:tcPr><w:tcW w:w="${colW[cIdx++]}" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>${dxPara(String(idx + 1), { align: "center", size: 18 })}</w:tc>`);
        }
        if (printOptions.showImage) {
          const imgContent = imgRid ? dxImage(imgRid, 381000, 381000) : "";
          cells.push(`<w:tc><w:tcPr><w:tcW w:w="${colW[cIdx++]}" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr>${imgContent}</w:p></w:tc>`);
        }

        // Product Name & Note
        const nameRuns = [{ text: it.name, bold: true }];
        const paras = [dxPara(nameRuns, { size: 19, spaceAfter: 0 })];
        if (lang !== "vi" && it.nameEn) {
          paras.push(dxPara(it.nameEn, { size: 17, italic: true, color: "555555", spaceAfter: 0 }));
        }
        if (it.note && printOptions.showNote) {
          paras.push(dxPara(it.note, { size: 17, italic: true, color: "666666", spaceAfter: 0 }));
          if (lang !== "vi" && it.noteEn) {
            paras.push(dxPara(it.noteEn, { size: 16, italic: true, color: "666666", spaceAfter: 0 }));
          }
        }
        cells.push(`<w:tc><w:tcPr><w:tcW w:w="${colW[cIdx++]}" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>${paras.join("")}</w:tc>`);

        cells.push(`<w:tc><w:tcPr><w:tcW w:w="${colW[cIdx++]}" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>${dxPara(String(it.qty || 0), { align: "center", size: 19 })}</w:tc>`);
        cells.push(`<w:tc><w:tcPr><w:tcW w:w="${colW[cIdx++]}" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>${dxPara(it.unit || "Cái", { align: "center", size: 19 })}</w:tc>`);
        cells.push(`<w:tc><w:tcPr><w:tcW w:w="${colW[cIdx++]}" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>${dxPara(fmt(it.price || 0), { align: "right", size: 19, bold: true })}</w:tc>`);
        if (printOptions.showVat) {
          cells.push(`<w:tc><w:tcPr><w:tcW w:w="${colW[cIdx++]}" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>${dxPara(vatLbl, { align: "center", size: 18 })}</w:tc>`);
        }
        cells.push(`<w:tc><w:tcPr><w:tcW w:w="${colW[cIdx++]}" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>${dxPara(fmt(line), { align: "right", size: 19, bold: true })}</w:tc>`);

        return dxRow(cells);
      });

      const labelColSpan = headers.length - 1;
      const labelW = colW.slice(0, labelColSpan).reduce((a, b) => a + b, 0);
      const valW = colW[colW.length - 1];

      const subtotalRow = dxRow([
        `<w:tc><w:tcPr><w:gridSpan w:val="${labelColSpan}"/><w:tcW w:w="${labelW}" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>${dxPara(T.subtotalLabel, { align: "right", bold: true, size: 19 })}</w:tc>`,
        `<w:tc><w:tcPr><w:tcW w:w="${valW}" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>${dxPara(fmt(subtotal), { align: "right", bold: true, size: 19 })}</w:tc>`
      ]);

      const vatRow = dxRow([
        `<w:tc><w:tcPr><w:gridSpan w:val="${labelColSpan}"/><w:tcW w:w="${labelW}" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>${dxPara(T.vatLabel, { align: "right", bold: true, size: 19 })}</w:tc>`,
        `<w:tc><w:tcPr><w:tcW w:w="${valW}" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>${dxPara(fmt(vat), { align: "right", bold: true, size: 19 })}</w:tc>`
      ]);

      const grandRow = dxRow([
        `<w:tc><w:tcPr><w:gridSpan w:val="${labelColSpan}"/><w:tcW w:w="${labelW}" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>${dxPara(T.grandTotalLabel, { align: "right", bold: true, size: 20, color: "1A2540" })}</w:tc>`,
        `<w:tc><w:tcPr><w:tcW w:w="${valW}" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>${dxPara(fmt(total), { align: "right", bold: true, size: 20, color: "1A2540" })}</w:tc>`
      ]);

      const mainTable = dxTable([headerRow, ...itemRows, subtotalRow, vatRow, grandRow], totalW);

      const titlePara = dxPara([{ text: T.title, bold: true, color: "1A2540" }], { align: "center", size: 36, spaceAfter: 20 });
      const titleBPara = (lang !== "vi" && T.titleB) ? dxPara([{ text: T.titleB, italic: true, color: "555555" }], { align: "center", size: 22, spaceAfter: 40 }) : "";
      const quoteNumPara = dxPara([{ text: `${T.ref}: ${localQuote.quoteNumber}`, color: "555555" }], { align: "center", size: 20, spaceAfter: 160 });

      const recipPara = dxPara([{ text: `${T.to} `, bold: true }, { text: localQuote.customer }], { size: 20, spaceAfter: 40 });
      const contactPara = localQuote.contact ? dxPara([{ text: `${T.contact} `, bold: true }, { text: localQuote.contact }], { size: 20, spaceAfter: 40 }) : "";
      const workPara = localQuote.workContent ? dxPara([{ text: `${T.content} `, bold: true }, { text: localQuote.workContent }], { size: 20, spaceAfter: 120 }) : "";

      const notesParas = (localQuote.notes || "").split("\n").filter(l => l.trim()).map(l => dxPara(`• ${l.trim()}`, { size: 18, spaceAfter: 40 }));
      const notesBlock = [dxPara([{ text: T.notesHeader, bold: true }], { size: 19, spaceAfter: 60 }), ...notesParas];

      const signBlock = dxNoBorderTable([
        dxRow([
          dxNoBorderCell("<w:p/>", 5000),
          dxNoBorderCell([
            dxPara(`Phú Mỹ, ngày ${String(today.getDate()).padStart(2, "0")} tháng ${String(today.getMonth() + 1).padStart(2, "0")} năm ${today.getFullYear()}`, { align: "center", size: 18, italic: true, spaceAfter: 40 }),
            dxPara(T.signTitle, { align: "center", bold: true, size: 20, spaceAfter: 600 }),
            dxPara(COMPANY.representative || "Trần Văn Thịnh", { align: "center", bold: true, size: 20 })
          ], 3900)
        ])
      ], 8900);

      const docBody = [
        headerCompTable,
        titlePara, titleBPara, quoteNumPara,
        recipPara, contactPara, workPara,
        mainTable,
        ...notesBlock,
        signBlock
      ].join("");

      const versionNum = (localQuote.versions && localQuote.versions.length > 0) ? localQuote.versions.length + 1 : 1;
      const versionSuffix = `_v${versionNum}`;
      const baseFilename = `BaoGia_${localQuote.quoteNumber}${versionSuffix}`;

      const blob = await buildDocxBlob(docBody, imageMap);
      downloadBlob(blob, `${baseFilename}.docx`);
    } catch (err) {
      alert("Lỗi xuất Word: " + err.message);
    } finally {
      setWordLoading(false);
    }
  };

  const versionNum = (localQuote.versions && localQuote.versions.length > 0) ? localQuote.versions.length + 1 : 1;
  const versionSuffix = `_v${versionNum}`;
  const baseFilename = `BaoGia_${localQuote.quoteNumber}${versionSuffix}`;

  const handlePrint = () => {
    printElementViaIframe("quotePreviewContent", baseFilename);
  };

  const handlePDFClick = async () => {
    setPdfLoading(true);
    try {
      await exportElementToPdf("quotePreviewContent", `${baseFilename}.pdf`);
    } catch (err) {
      alert("Lỗi xuất PDF: " + err.message);
    } finally {
      setPdfLoading(false);
    }
  };

  const visibleColsCount = (printOptions.showStt ? 1 : 0) +
    (printOptions.showImage ? 1 : 0) +
    1 + // Tên hàng hóa
    1 + // SL
    1 + // ĐVT
    1 + // Đơn giá
    (printOptions.showVat ? 1 : 0) +
    1;  // Thành tiền

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 1050 }}>
        <div className="modal-header no-print">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="modal-title">🖨️ Xem trước & In Báo Giá</span>
            <button 
              className="btn btn-ghost btn-sm" 
              onClick={handleAutoTranslate} 
              disabled={translating || lang === "vi"} 
              title="Tự động dịch sang tiếng Anh/Trung"
            >
              {translating ? "⏳ Đang dịch..." : `🌐 Tự động dịch → ${lang === "vi_zh" ? "中文" : "EN"}`}
            </button>
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body" style={{ background: "#f8fafc", padding: 20 }}>
          {/* Quick Actions Bar */}
          <div className="no-print" style={{ 
            display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center",
            background: "#fff", padding: "12px 16px", borderRadius: 8, border: "1px solid #e2e8f0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
          }}>
            <button className="btn btn-primary" onClick={handlePrint} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              🖨️ In Báo Giá
            </button>
            <button className="btn btn-ghost" onClick={handlePDFClick} disabled={pdfLoading} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {pdfLoading ? "⏳ Đang tạo PDF..." : "📄 Xuất PDF (Xem trước)"}
            </button>
            <button className="btn btn-ghost" onClick={handleWord} disabled={wordLoading} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {wordLoading ? "⏳ Đang tạo Word..." : "📝 Xuất File Word (.docx)"}
            </button>
            <div style={{ height: 24, width: 1, background: "#cbd5e1", margin: "0 4px" }} />
            {onCreateContract && (
              <button className="btn btn-ghost" onClick={() => { onClose(); onCreateContract(localQuote); }} style={{ color: "#2563eb", fontWeight: 600 }}>
                📜 Lập Hợp đồng
              </button>
            )}
            {onHandover && (
              <button className="btn btn-ghost" onClick={() => { onClose(); onHandover(localQuote); }} style={{ color: "#059669", fontWeight: 600 }}>
                📋 Biên bản bàn giao
              </button>
            )}
            {onDelivery && (
              <button className="btn btn-ghost" onClick={() => { onClose(); onDelivery(localQuote); }} style={{ color: "#d97706", fontWeight: 600 }}>
                🚚 Phiếu giao hàng
              </button>
            )}
          </div>

          {/* Print Options Bar */}
          <div className="no-print" style={{ 
            display: "flex", gap: 18, marginBottom: 16, alignItems: "center", flexWrap: "wrap",
            background: "#fff", padding: "10px 16px", borderRadius: 8, border: "1px solid #e2e8f0"
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>⚙️ Cấu hình hiển thị:</span>
            
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, color: "#666" }}>Ngôn ngữ:</span>
              <select className="form-control" style={{ padding: "3px 8px", fontSize: 12, height: 28 }} value={lang} onChange={e => setLang(e.target.value)}>
                <option value="vi">🇻🇳 Chỉ Tiếng Việt (Mặc định)</option>
                <option value="vi_en">🇻🇳 🇬🇧 Song ngữ Việt - Anh</option>
                <option value="vi_zh">🇻🇳 🇨🇳 Song ngữ Việt - Trung</option>
              </select>
            </div>

            <label style={{ fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, userSelect: "none" }}>
              <input
                type="checkbox"
                checked={printOptions.showStt}
                onChange={e => setPrintOptions(p => ({ ...p, showStt: e.target.checked }))}
                style={{ width: 16, height: 16, accentColor: "var(--accent)" }}
              />
              Cột STT
            </label>
            <label style={{ fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, userSelect: "none" }}>
              <input
                type="checkbox"
                checked={printOptions.showImage}
                onChange={e => setPrintOptions(p => ({ ...p, showImage: e.target.checked }))}
                style={{ width: 16, height: 16, accentColor: "var(--accent)" }}
              />
              Cột Hình Ảnh
            </label>
            <label style={{ fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, userSelect: "none" }}>
              <input
                type="checkbox"
                checked={printOptions.showNote}
                onChange={e => setPrintOptions(p => ({ ...p, showNote: e.target.checked }))}
                style={{ width: 16, height: 16, accentColor: "var(--accent)" }}
              />
              Dòng Ghi Chú SP
            </label>
            <label style={{ fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, userSelect: "none" }}>
              <input
                type="checkbox"
                checked={printOptions.showVat}
                onChange={e => setPrintOptions(p => ({ ...p, showVat: e.target.checked }))}
                style={{ width: 16, height: 16, accentColor: "var(--accent)" }}
              />
              Cột Thuế VAT
            </label>
          </div>

          {/* Live Preview */}
          <div className="quote-preview" id="quotePreviewContent">
            <div className="quote-company-header">
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <img src={getLogoUrl()} className="company-logo-img" alt="PMC Logo" />
                <div className="company-info">
                  <h2>{COMPANY.name}</h2>
                  <p>MST: {COMPANY.mst}</p>
                  <p>Địa chỉ: {COMPANY.address}</p>
                  <p>ĐT: {COMPANY.phone} | Email: {COMPANY.email}</p>
                </div>
              </div>
            </div>
            <div className="quote-title-block">
              <h1>{localQuote.status === "provisional" ? "BẢNG BÁO GIÁ TẠM TÍNH" : T.title}</h1>
              {lang !== "vi" && T.titleB ? (
                <div style={{ fontSize: 13, fontStyle: "italic", color: "#555", marginTop: 2 }}>
                  {localQuote.status === "provisional" ? (lang === "vi_zh" ? "暂估报价单" : "ESTIMATED QUOTATION") : T.titleB}
                </div>
              ) : null}
              <div className="quote-num">{T.ref}: {localQuote.quoteNumber}</div>
            </div>
            <div className="quote-recipient">
              <div><strong>{T.to}</strong> {localQuote.customer}</div>
              {localQuote.contact && <div style={{ marginTop: 4 }}><strong>{T.contact}</strong> {localQuote.contact}</div>}
              {localQuote.workContent && (
                <div style={{ marginTop: 6, color: "#333" }}>
                  <div><strong>{T.content}</strong> {localQuote.workContent}</div>
                  {lang !== "vi" && localQuote.workContentEn ? (
                    <div style={{ fontStyle: "italic", color: "#555", marginLeft: 16 }}>{localQuote.workContentEn}</div>
                  ) : null}
                </div>
              )}
            </div>

            <table className="quote-items-table" style={{ width: "100%", borderCollapse: "collapse", marginBottom: 12, fontSize: 11, border: "1.5px solid #222", tableLayout: "fixed" }}>
              <thead>
                <tr>
                  {printOptions.showStt && <th style={{ width: 32, background: "transparent", color: "#1a2540", padding: "6px 2px", fontWeight: 600, textAlign: "center", borderRight: "1.5px solid #222", borderBottom: "1.5px solid #222", whiteSpace: "pre-line", lineHeight: 1.25 }}>{T.colStt}</th>}
                  {printOptions.showImage && <th style={{ width: 60, background: "transparent", color: "#1a2540", padding: "6px 2px", fontWeight: 600, textAlign: "center", borderRight: "1.5px solid #222", borderBottom: "1.5px solid #222", whiteSpace: "pre-line", lineHeight: 1.25 }}>{T.colImg}</th>}
                  <th style={{ background: "transparent", color: "#1a2540", padding: "6px 5px", fontWeight: 600, textAlign: "left", borderRight: "1.5px solid #222", borderBottom: "1.5px solid #222", whiteSpace: "pre-line", lineHeight: 1.25 }}>{T.colItem}</th>
                  <th style={{ width: 48, background: "transparent", color: "#1a2540", padding: "6px 2px", fontWeight: 600, textAlign: "center", borderRight: "1.5px solid #222", borderBottom: "1.5px solid #222", whiteSpace: "pre-line", lineHeight: 1.25 }}>{T.colQty}</th>
                  <th style={{ width: 52, background: "transparent", color: "#1a2540", padding: "6px 2px", fontWeight: 600, textAlign: "center", borderRight: "1.5px solid #222", borderBottom: "1.5px solid #222", whiteSpace: "pre-line", lineHeight: 1.25 }}>{T.colUnit}</th>
                  <th style={{ width: 110, background: "transparent", color: "#1a2540", padding: "6px 3px", fontWeight: 600, textAlign: "right", borderRight: "1.5px solid #222", borderBottom: "1.5px solid #222", whiteSpace: "pre-line", lineHeight: 1.25 }}>{T.colPrice}</th>
                  {printOptions.showVat && <th style={{ width: 45, background: "transparent", color: "#1a2540", padding: "6px 2px", fontWeight: 600, textAlign: "center", borderRight: "1.5px solid #222", borderBottom: "1.5px solid #222", whiteSpace: "pre-line", lineHeight: 1.25 }}>{T.colVat}</th>}
                  <th style={{ width: 115, background: "transparent", color: "#1a2540", padding: "6px 3px", fontWeight: 600, textAlign: "right", borderRight: "1.5px solid #222", borderBottom: "1.5px solid #222", whiteSpace: "pre-line", lineHeight: 1.25 }}>{T.colTotal}</th>
                </tr>
              </thead>
              <tbody>
                {localQuote.items.map((it, i) => {
                  const line = (it.qty || 0) * (it.price || 0);
                  const iRate = it.vatRate !== undefined ? it.vatRate : (localQuote.vatRate !== undefined ? localQuote.vatRate : 8);
                  const iLabel = iRate === -1 ? "KCT" : (iRate || 0) + "%";
                  const numStyle = (align, extra = {}) => ({
                    padding: "6px 5px",
                    borderRight: "1.5px solid #222",
                    borderBottom: "1.5px solid #222",
                    textAlign: align,
                    verticalAlign: "middle",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    fontSize: 11,
                    ...extra
                  });
                  return (
                    <tr key={it.id || i}>
                      {printOptions.showStt && <td style={numStyle("center")}>{i + 1}</td>}
                      {printOptions.showImage && (
                        <td style={{ textAlign: "center", verticalAlign: "middle", padding: "6px 4px", borderRight: "1.5px solid #222", borderBottom: "1.5px solid #222" }}>
                          {it.image && <img src={it.image} alt="" style={{ width: 48, height: 48, objectFit: "contain", borderRadius: 4 }} />}
                        </td>
                      )}
                      <td style={{ padding: "6px 5px", borderRight: "1.5px solid #222", borderBottom: "1.5px solid #222", verticalAlign: "top", wordBreak: "break-word", whiteSpace: "normal", fontSize: 11 }}>
                        <div style={{ fontWeight: 500 }}>{it.name}</div>
                        {lang !== "vi" && it.nameEn ? (
                          <div style={{ fontSize: 10, color: "#555", fontStyle: "italic" }}>{it.nameEn}</div>
                        ) : null}
                        {printOptions.showNote && it.note && (
                          <div style={{ fontSize: 10, color: "#666", fontStyle: "italic", marginTop: 2, whiteSpace: "pre-wrap" }}>
                            <div>{it.note}</div>
                            {lang !== "vi" && it.noteEn ? (
                              <div style={{ color: "#555" }}>{it.noteEn}</div>
                            ) : null}
                          </div>
                        )}
                      </td>
                      <td style={numStyle("center")}>{it.qty}</td>
                      <td style={numStyle("center")}>{it.unit || "Cái"}</td>
                      <td style={numStyle("right", { fontWeight: 600 })}>{fmt(it.price || 0)}</td>
                      {printOptions.showVat && <td style={numStyle("center", { fontWeight: 600 })}>{iLabel}</td>}
                      <td style={numStyle("right", { fontWeight: 600 })}>{fmt(line)}</td>
                    </tr>
                  );
                })}
                <tr>
                  <td colSpan={visibleColsCount - 1} style={{ textAlign: "right", fontWeight: 700, padding: "8px 5px", borderRight: "1.5px solid #222", fontSize: 11, borderBottom: "1.5px solid #222" }}>
                    {T.subtotalLabel}
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 700, padding: "8px 5px", fontSize: 11, whiteSpace: "nowrap", borderRight: "1.5px solid #222", borderBottom: "1.5px solid #222" }}>
                    {fmt(subtotal)}
                  </td>
                </tr>
                <tr>
                  <td colSpan={visibleColsCount - 1} style={{ textAlign: "right", fontWeight: 700, padding: "8px 5px", borderRight: "1.5px solid #222", fontSize: 11, borderBottom: "1.5px solid #222" }}>
                    {T.vatLabel}
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 700, padding: "8px 5px", fontSize: 11, whiteSpace: "nowrap", borderRight: "1.5px solid #222", borderBottom: "1.5px solid #222" }}>
                    {fmt(vat)}
                  </td>
                </tr>
                <tr style={{ background: "#f8fafc" }}>
                  <td colSpan={visibleColsCount - 1} style={{ textAlign: "right", fontWeight: 800, color: "#1a2540", padding: "10px 5px", borderRight: "1.5px solid #222", fontSize: 12 }}>
                    {T.grandTotalLabel}
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 800, color: "#1a2540", padding: "10px 5px", fontSize: 12, whiteSpace: "nowrap" }}>
                    {fmt(total)} đ
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Notes & Terms */}
            {localQuote.notes && (
              <div style={{ marginTop: 14, fontSize: 11 }}>
                <div style={{ fontWeight: 700, color: "#1a2540", marginBottom: 4 }}>{T.notesHeader}</div>
                <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, color: "#333" }}>{localQuote.notes}</div>
                {lang !== "vi" && localQuote.notesEn ? (
                  <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, color: "#555", fontStyle: "italic", marginTop: 4 }}>{localQuote.notesEn}</div>
                ) : null}
              </div>
            )}

            {/* Signatures */}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24, fontSize: 11, pageBreakInside: "avoid" }}>
              <div style={{ textAlign: "center", minWidth: 200 }}>
                <div style={{ fontWeight: 700, color: "#1a2540" }}>ĐẠI DIỆN KHÁCH HÀNG</div>
                <div style={{ color: "#666", fontSize: 10 }}>(Ký, đóng dấu &amp; ghi rõ họ tên)</div>
                <div style={{ height: 60 }} />
                <div style={{ fontWeight: 600 }}>{localQuote.contact || localQuote.customer}</div>
              </div>
              <div style={{ textAlign: "center", minWidth: 200 }}>
                <div style={{ color: "#555", fontStyle: "italic", marginBottom: 4 }}>
                  Phú Mỹ, ngày {String(today.getDate()).padStart(2, "0")} tháng {String(today.getMonth() + 1).padStart(2, "0")} năm {today.getFullYear()}
                </div>
                <div style={{ fontWeight: 700, color: "#1a2540" }}>{T.signTitle}</div>
                <div style={{ color: "#666", fontSize: 10 }}>(Ký, đóng dấu &amp; ghi rõ họ tên)</div>
                <div style={{ height: 60 }} />
                <div style={{ fontWeight: 600 }}>{COMPANY.representative || "Trần Văn Thịnh"}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer no-print">
          <button className="btn btn-ghost" onClick={onClose}>Đóng</button>
          <button className="btn btn-primary" onClick={handlePrint}>🖨️ In Báo Giá</button>
        </div>
      </div>
    </div>
  );
}
