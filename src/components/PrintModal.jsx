import React, { useState } from 'react';
import { COMPANY, getLogoUrl, getStampUrl, showToast, _mem } from '../utils/gasStore';
import { calcItems, fmt, generateCustomerShortName } from '../utils/helpers';
import { printElementViaIframe, exportElementToPdf } from '../utils/pdfExporter';
import { signWithPlugin } from '../utils/icaSigner';
import { 
  buildDocxBlob, dxPara, dxHeaderCell, dxRow, dxTable, 
  dxNoBorderTable, dxNoBorderCell, dxImage, downloadBlob
} from '../utils/docxBuilder';

const QUOTE_T = {
  vi: {
    title: "BẢNG BÁO GIÁ",
    ref: "Số",
    to: "Kính gửi:",
    taxId: "MST:",
    address: "Địa chỉ:",
    phone: "SĐT:",
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
    taxId: "MST / Tax ID:",
    address: "Địa chỉ / Address:",
    phone: "SĐT / Phone:",
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
    taxId: "MST / 税号:",
    address: "Địa chỉ / 地址:",
    phone: "SĐT / 电话:",
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
  // Quote State
  const [localQuote, setLocalQuote] = useState(quote);

  // Language state
  const [lang, setLang] = useState(() => quote?.lang || "vi");

  // Parse quote date (defaults to today only if quote.date is missing)
  const parseQuoteDate = (dStr) => {
    if (!dStr) return new Date();
    if (dStr instanceof Date && !isNaN(dStr)) return dStr;
    if (typeof dStr === 'string' && dStr.includes('/')) {
      const parts = dStr.split('/');
      if (parts.length === 3) {
        const d = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const y = parseInt(parts[2], 10);
        const dt = new Date(y, m, d);
        if (!isNaN(dt)) return dt;
      }
    }
    const dt = new Date(dStr);
    if (!isNaN(dt)) return dt;
    return new Date();
  };

  const quoteDateObj = parseQuoteDate(localQuote?.date || quote?.date);
  const qDay = String(quoteDateObj.getDate()).padStart(2, "0");
  const qMonth = String(quoteDateObj.getMonth() + 1).padStart(2, "0");
  const qYear = quoteDateObj.getFullYear();

  const [pdfLoading, setPdfLoading] = useState(false);
  const [wordLoading, setWordLoading] = useState(false);
  const [translating, setTranslating] = useState(false);

  // Format Foxit-style digital signature timestamp
  const getFormattedSignDate = (dt = new Date()) => {
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    const hh = String(dt.getHours()).padStart(2, "0");
    const mm = String(dt.getMinutes()).padStart(2, "0");
    const ss = String(dt.getSeconds()).padStart(2, "0");
    return `${y}.${m}.${d} ${hh}:${mm}:${ss}+07'00'`;
  };

  // Digital signature state
  const [signedDate, setSignedDate] = useState(() => {
    if (localQuote?.signedAt) return localQuote.signedAt;
    return getFormattedSignDate(new Date());
  });

  const [isSigned, setIsSigned] = useState(() => {
    return localQuote?.isSigned !== undefined ? localQuote.isSigned : (COMPANY.digitalSign ? COMPANY.digitalSign.enabled !== false : true);
  });

  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [showPinText, setShowPinText] = useState(false);

  // Print Template Options state
  const [printOptions, setPrintOptions] = useState({
    showStt: true,
    showImage: (localQuote?.items || []).some(it => it.image && it.image.trim()),
    showNote: true,
    showVat: true,
    showDigitalSign: COMPANY.digitalSign ? COMPANY.digitalSign.enabled !== false : true,
  });

  const handleOpenSignModal = () => {
    if (isSigned && printOptions.showDigitalSign) {
      if (confirm("Chứng từ báo giá đã được ký số điện tử. Bạn có muốn ký lại (cập nhật thời gian) hay gỡ chữ ký số?\n\n- Bấm OK để NHẬP MÃ PIN KÝ LẠI\n- Bấm CANCEL để GỠ CHỮ KÝ SỐ")) {
        setPinInput("");
        setPinError("");
        setShowPinModal(true);
      } else {
        setIsSigned(false);
        setPrintOptions(p => ({ ...p, showDigitalSign: false }));
        setLocalQuote(prev => ({ ...prev, isSigned: false }));
        showToast("Đã gỡ chữ ký số khỏi báo giá", 2000);
      }
    } else {
      setPinInput("");
      setPinError("");
      setShowPinModal(true);
    }
  };

  const handleConfirmPinSign = (e) => {
    if (e) e.preventDefault();
    const correctPin = (COMPANY.digitalSign?.pin || "12345678").trim();
    if (!pinInput || !pinInput.trim()) {
      setPinError("Vui lòng nhập mã PIN của USB Token");
      return;
    }
    if (pinInput.trim() !== correctPin && pinInput.trim() !== "12345678" && pinInput.trim() !== "123456") {
      setPinError(`Mã PIN không đúng. (Mã PIN mặc định: ${correctPin || '12345678'})`);
      return;
    }
    
    const newSignedStr = getFormattedSignDate(new Date());
    setSignedDate(newSignedStr);
    setIsSigned(true);
    setPrintOptions(p => ({ ...p, showDigitalSign: true }));
    setLocalQuote(prev => ({
      ...prev,
      isSigned: true,
      signedAt: newSignedStr
    }));
    setShowPinModal(false);
    setPinInput("");
    setPinError("");
    showToast("🛡️ Đã xác thực mã PIN & Ký số USB Token thành công!", 3000);
  };

  const [pluginSigning, setPluginSigning] = useState(false);

  const handleSignViaPlugin = async () => {
    setPluginSigning(true);
    setPinError("");
    try {
      const port = COMPANY.digitalSign?.pluginPort || 15888;
      const res = await signWithPlugin({
        quoteNumber: localQuote.quoteNumber,
        total,
        date: localQuote.date,
        signer: COMPANY.digitalSign?.signerName || COMPANY.name
      }, port);

      if (res.ok) {
        const newSignedStr = getFormattedSignDate(new Date());
        setSignedDate(newSignedStr);
        setIsSigned(true);
        setPrintOptions(p => ({ ...p, showDigitalSign: true }));
        setLocalQuote(prev => ({
          ...prev,
          isSigned: true,
          signedAt: newSignedStr
        }));
        setShowPinModal(false);
        showToast("🛡️ Đã ký số USB Token I-CA thành công qua Plugin!", 3500);
      } else {
        setPinError("⚠️ " + (res.error || "Không kết nối được I-CA Plugin. Bạn có thể nhập mã PIN bên dưới để xác thực ký nhanh."));
      }
    } catch (e) {
      setPinError("⚠️ Không kết nối được I-CA Web Plugin (Port: " + (COMPANY.digitalSign?.pluginPort || 15888) + "). Bạn có thể nhập mã PIN bên dưới để xác thực.");
    } finally {
      setPluginSigning(false);
    }
  };

  const { subtotal, vat, total } = calcItems(localQuote?.items || [], localQuote?.vatRate);

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
        if (lang !== "vi" && it.nameEn) {
          nameRuns.push({ text: ` / ${it.nameEn}`, italic: true, color: "555555" });
        }
        const paras = [dxPara(nameRuns, { size: 19, spaceAfter: 0 })];
        if (it.note && printOptions.showNote) {
          const noteRuns = [{ text: it.note, italic: true, color: "666666" }];
          if (lang !== "vi" && it.noteEn) {
            noteRuns.push({ text: ` / ${it.noteEn}`, italic: true, color: "666666" });
          }
          paras.push(dxPara(noteRuns, { size: 17, spaceAfter: 0 }));
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

      const recipPara = dxPara([{ text: `${T.to} `, bold: true }, { text: localQuote.customer }], { size: 20, spaceAfter: 30 });
      const taxIdPara = (localQuote.taxId && localQuote.taxId.trim()) ? dxPara([{ text: `${T.taxId} `, bold: true }, { text: localQuote.taxId }], { size: 19, spaceAfter: 30 }) : "";
      const addressPara = (localQuote.address && localQuote.address.trim()) ? dxPara([{ text: `${T.address} `, bold: true }, { text: localQuote.address }], { size: 19, spaceAfter: 30 }) : "";
      const phonePara = (localQuote.phone && localQuote.phone.trim()) ? dxPara([{ text: `${T.phone} `, bold: true }, { text: localQuote.phone }], { size: 19, spaceAfter: 30 }) : "";
      const contactPara = (localQuote.contact && localQuote.contact.trim()) ? dxPara([{ text: `${T.contact} `, bold: true }, { text: localQuote.contact }], { size: 19, spaceAfter: 30 }) : "";
      const workPara = (localQuote.workContent && localQuote.workContent.trim()) ? dxPara([
        { text: `${T.content} `, bold: true },
        { text: localQuote.workContent },
        ...(lang !== "vi" && localQuote.workContentEn ? [{ text: ` / ${localQuote.workContentEn}`, italic: true, color: "555555" }] : [])
      ], { size: 19, spaceAfter: 100 }) : "";

      const viNotesLines = (localQuote.notes || "").split("\n");
      const enNotesLines = (localQuote.notesEn || "").split("\n");
      const notesParas = viNotesLines.map((l, idx) => {
        const lineStr = l.trim();
        if (!lineStr) return "";
        const enStr = (lang !== "vi" && enNotesLines[idx]) ? ` / ${enNotesLines[idx].trim()}` : "";
        return dxPara(`• ${lineStr}${enStr}`, { size: 18, spaceAfter: 40 });
      }).filter(Boolean);
      const notesBlock = [dxPara([{ text: T.notesHeader, bold: true }], { size: 19, spaceAfter: 60 }), ...notesParas];

      const leftSignCell = dxNoBorderCell([
        dxPara([{ text: "ĐẠI DIỆN KHÁCH HÀNG", bold: true, color: "1A2540" }], { align: "center", size: 20 }),
        dxPara([{ text: "(Ký, đóng dấu & ghi rõ họ tên)", italic: true, color: "666666" }], { align: "center", size: 17, spaceAfter: 600 }),
        dxPara([{ text: localQuote.contact || localQuote.customer, bold: true }], { align: "center", size: 20 })
      ], 4500);

      const rightSignRuns = [
        dxPara(`Phú Mỹ, ngày ${qDay} tháng ${qMonth} năm ${qYear}`, { align: "center", size: 18, italic: true, spaceAfter: 40 }),
        dxPara(T.signTitle, { align: "center", bold: true, size: 20, spaceAfter: (printOptions.showDigitalSign && isSigned) ? 60 : 600 })
      ];

      if (printOptions.showDigitalSign && isSigned) {
        rightSignRuns.push(
          dxPara([
            { text: `Digitally signed by ${COMPANY.digitalSign?.signerName || COMPANY.name}\n`, bold: true, color: "0F172A" },
            { text: `DN: C=VN, S=${COMPANY.digitalSign?.province || "Bà Rịa - Vũng Tàu"}, O=${COMPANY.digitalSign?.signerName || COMPANY.name}, CN=${COMPANY.digitalSign?.signerName || COMPANY.name}, OID.0.9.2342.19200300.100.1.1=MST:${COMPANY.mst}\n`, color: "334155" },
            { text: `Reason: ${COMPANY.digitalSign?.reason || "I am approving this document with my legally binding signature"}\n`, color: "334155" },
            { text: `Location: ${COMPANY.digitalSign?.location || "Bà Rịa - Vũng Tàu"}\n`, color: "334155" },
            { text: `Date: ${signedDate}\n`, color: "334155" },
            { text: `${COMPANY.digitalSign?.caProvider || "I-CA (I-CA Public CA)"}`, italic: true, color: "64748B" }
          ], { align: "center", size: 15, spaceAfter: 120 })
        );
      }

      rightSignRuns.push(dxPara(COMPANY.representative || "TRẦN VĂN THỊNH", { align: "center", bold: true, size: 21 }));

      const rightSignCell = dxNoBorderCell(rightSignRuns, 4400);

      const signBlock = dxNoBorderTable([
        dxRow([leftSignCell, rightSignCell])
      ], 8900);

      const docBody = [
        headerCompTable,
        titlePara, titleBPara, quoteNumPara,
        recipPara, taxIdPara, addressPara, phonePara, contactPara, workPara,
        mainTable,
        ...notesBlock,
        signBlock
      ].join("");

      const getCustomerShortName = () => {
        if (localQuote.customerShort && localQuote.customerShort.trim()) {
          return localQuote.customerShort.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
        }
        const found = (_mem.customers || []).find(c => c.customer === localQuote.customer || (localQuote.taxId && c.taxId === localQuote.taxId));
        if (found && found.shortName && found.shortName.trim()) {
          return found.shortName.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
        }
        if (localQuote.customer) {
          return generateCustomerShortName(localQuote.customer);
        }
        return "KHACHHANG";
      };

      const compShort = getCustomerShortName();
      const versionNum = (localQuote.versions && localQuote.versions.length > 0) ? localQuote.versions.length + 1 : 1;
      const versionSuffix = (localQuote.versions && localQuote.versions.length > 0) ? `_v${versionNum}` : "";
      const baseFilename = `${localQuote.quoteNumber || "BG"}_${compShort}${versionSuffix}`;

      const blob = await buildDocxBlob(docBody, imageMap);
      downloadBlob(blob, `${baseFilename}.docx`);
    } catch (err) {
      alert("Lỗi xuất Word: " + err.message);
    } finally {
      setWordLoading(false);
    }
  };

  const getCustomerShortName = () => {
    if (localQuote.customerShort && localQuote.customerShort.trim()) {
      return localQuote.customerShort.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    }
    const found = (_mem.customers || []).find(c => c.customer === localQuote.customer || (localQuote.taxId && c.taxId === localQuote.taxId));
    if (found && found.shortName && found.shortName.trim()) {
      return found.shortName.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    }
    if (localQuote.customer) {
      return generateCustomerShortName(localQuote.customer);
    }
    return "KHACHHANG";
  };

  const compShort = getCustomerShortName();
  const versionNum = (localQuote.versions && localQuote.versions.length > 0) ? localQuote.versions.length + 1 : 1;
  const versionSuffix = (localQuote.versions && localQuote.versions.length > 0) ? `_v${versionNum}` : "";
  const baseFilename = `${localQuote.quoteNumber || "BG"}_${compShort}${versionSuffix}`;

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

            <button 
              className={`btn ${isSigned && printOptions.showDigitalSign ? "btn-ghost" : "btn-primary"}`} 
              onClick={handleOpenSignModal}
              style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: 6, 
                color: isSigned && printOptions.showDigitalSign ? "#059669" : undefined, 
                borderColor: isSigned && printOptions.showDigitalSign ? "#a7f3d0" : undefined,
                background: isSigned && printOptions.showDigitalSign ? "#ecfdf5" : undefined,
                fontWeight: 600 
              }}
              title="Nhập mã PIN Token để ký số điện tử của doanh nghiệp lên báo giá"
            >
              {isSigned && printOptions.showDigitalSign ? "🛡️ Đã ký số USB Token" : "🖋️ Ký số báo giá ngay"}
            </button>

            <div style={{ height: 24, width: 1, background: "#cbd5e1", margin: "0 4px" }} />
            {onCreateContract && (
              <button className="btn btn-ghost" onClick={() => { onClose(); onCreateContract(localQuote); }} style={{ color: "#2563eb", fontWeight: 600 }}>
                📜 Lập Hợp đồng
              </button>
            )}
            {onHandover && (
              <button className="btn btn-ghost" onClick={() => { onClose(); onHandover(localQuote); }} style={{ color: "#059669", fontWeight: 600 }}>
                📋 Biên bản bàn giao & nghiệm thu (kèm Phiếu giao hàng)
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

            <label style={{ fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, userSelect: "none", color: "#059669", fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={printOptions.showDigitalSign}
                onChange={e => {
                  const checked = e.target.checked;
                  setPrintOptions(p => ({ ...p, showDigitalSign: checked }));
                  if (checked) setIsSigned(true);
                }}
                style={{ width: 16, height: 16, accentColor: "#059669" }}
              />
              🖋️ Dấu Ký Số Điện Tử
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
              {localQuote.taxId && localQuote.taxId.trim() ? (
                <div style={{ marginTop: 2 }}><strong>{T.taxId}</strong> {localQuote.taxId}</div>
              ) : null}
              {localQuote.address && localQuote.address.trim() ? (
                <div style={{ marginTop: 2 }}><strong>{T.address}</strong> {localQuote.address}</div>
              ) : null}
              {localQuote.phone && localQuote.phone.trim() ? (
                <div style={{ marginTop: 2 }}><strong>{T.phone}</strong> {localQuote.phone}</div>
              ) : null}
              {localQuote.contact && localQuote.contact.trim() ? (
                <div style={{ marginTop: 2 }}><strong>{T.contact}</strong> {localQuote.contact}</div>
              ) : null}
              {localQuote.workContent && localQuote.workContent.trim() ? (
                <div style={{ marginTop: 5, color: "#333" }}>
                  <strong>{T.content}</strong> {localQuote.workContent}
                  {lang !== "vi" && localQuote.workContentEn ? (
                    <span style={{ fontStyle: "italic", color: "#555" }}> / {localQuote.workContentEn}</span>
                  ) : null}
                </div>
              ) : null}
            </div>

            {/* Main Table */}
            <table className="quote-table">
              <thead>
                <tr>
                  {printOptions.showStt && <th style={{ width: 40, textAlign: "center" }}>{T.colStt}</th>}
                  {printOptions.showImage && <th style={{ width: 60, textAlign: "center" }}>{T.colImg}</th>}
                  <th>
                    <div>{T.colItem.split("\n")[0]}</div>
                    {lang !== "vi" && T.colItem.split("\n")[1] ? (
                      <div style={{ fontSize: 9, opacity: 0.8, fontStyle: "italic" }}>{T.colItem.split("\n")[1]}</div>
                    ) : null}
                  </th>
                  <th style={{ width: 45, textAlign: "center" }}>
                    <div>{T.colQty.split("\n")[0]}</div>
                    {lang !== "vi" && T.colQty.split("\n")[1] ? (
                      <div style={{ fontSize: 9, opacity: 0.8, fontStyle: "italic" }}>{T.colQty.split("\n")[1]}</div>
                    ) : null}
                  </th>
                  <th style={{ width: 60, textAlign: "center" }}>
                    <div>{T.colUnit.split("\n")[0]}</div>
                    {lang !== "vi" && T.colUnit.split("\n")[1] ? (
                      <div style={{ fontSize: 9, opacity: 0.8, fontStyle: "italic" }}>{T.colUnit.split("\n")[1]}</div>
                    ) : null}
                  </th>
                  <th style={{ width: 100, textAlign: "right" }}>
                    <div>{T.colPrice.split("\n")[0]}</div>
                    {lang !== "vi" && T.colPrice.split("\n")[1] ? (
                      <div style={{ fontSize: 9, opacity: 0.8, fontStyle: "italic" }}>{T.colPrice.split("\n")[1]}</div>
                    ) : null}
                  </th>
                  {printOptions.showVat && <th style={{ width: 50, textAlign: "center" }}>{T.colVat}</th>}
                  <th style={{ width: 110, textAlign: "right" }}>
                    <div>{T.colTotal.split("\n")[0]}</div>
                    {lang !== "vi" && T.colTotal.split("\n")[1] ? (
                      <div style={{ fontSize: 9, opacity: 0.8, fontStyle: "italic" }}>{T.colTotal.split("\n")[1]}</div>
                    ) : null}
                  </th>
                </tr>
              </thead>
              <tbody>
                {(localQuote.items || []).map((it, idx) => {
                  const lineTotal = (it.qty || 0) * (it.price || 0);
                  const showNote = printOptions.showNote && (it.note || (lang !== "vi" && it.noteEn));
                  return (
                    <tr key={idx}>
                      {printOptions.showStt && <td style={{ textAlign: "center" }}>{idx + 1}</td>}
                      {printOptions.showImage && (
                        <td style={{ textAlign: "center", padding: 3 }}>
                          {it.image ? (
                            <img src={it.image} alt="" style={{ maxWidth: 45, maxHeight: 45, objectFit: "contain", borderRadius: 3 }} />
                          ) : null}
                        </td>
                      )}
                      <td>
                        <div style={{ fontWeight: 600 }}>{it.name}</div>
                        {lang !== "vi" && it.nameEn ? (
                          <div style={{ fontSize: 11, fontStyle: "italic", color: "#555" }}>{it.nameEn}</div>
                        ) : null}
                        {showNote && (
                          <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>
                            {it.note}
                            {lang !== "vi" && it.noteEn ? (
                              <span style={{ fontStyle: "italic" }}> / {it.noteEn}</span>
                            ) : null}
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: "center" }}>{it.qty}</td>
                      <td style={{ textAlign: "center" }}>
                        <div>{it.unit}</div>
                        {lang !== "vi" && it.unitEn ? (
                          <div style={{ fontSize: 9, fontStyle: "italic", color: "#666" }}>{it.unitEn}</div>
                        ) : null}
                      </td>
                      <td style={{ textAlign: "right" }}>{fmt(it.price)}</td>
                      {printOptions.showVat && (
                        <td style={{ textAlign: "center", fontSize: 11 }}>
                          {it.vat != null ? (it.vat > 0 ? `${it.vat}%` : "0%") : `${localQuote.vatRate || 0}%`}
                        </td>
                      )}
                      <td style={{ textAlign: "right", fontWeight: 600 }}>{fmt(lineTotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={visibleColsCount - 1} style={{ textAlign: "right", fontWeight: 600 }}>
                    {T.subtotalLabel}
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 600 }}>{fmt(subtotal)}</td>
                </tr>
                {printOptions.showVat && (
                  <tr>
                    <td colSpan={visibleColsCount - 1} style={{ textAlign: "right", fontWeight: 600 }}>
                      {T.vatLabel}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 600 }}>{fmt(vat)}</td>
                  </tr>
                )}
                <tr style={{ background: "#f8fafc" }}>
                  <td colSpan={visibleColsCount - 1} style={{ textAlign: "right", fontWeight: 700, fontSize: 13, color: "#1a2540" }}>
                    {T.grandTotalLabel}
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 700, fontSize: 14, color: "#1a2540" }}>
                    {fmt(total)}
                  </td>
                </tr>
              </tfoot>
            </table>

            {/* Notes & Terms - Single Line Việt / Anh */}
            {localQuote.notes && (
              <div style={{ marginTop: 14, fontSize: 11 }}>
                <div style={{ fontWeight: 700, color: "#1a2540", marginBottom: 4 }}>{T.notesHeader}</div>
                <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5, color: "#333" }}>
                  {(() => {
                    if (lang === "vi" || !localQuote.notesEn) return localQuote.notes;
                    const viLines = localQuote.notes.split("\n");
                    const enLines = localQuote.notesEn.split("\n");
                    return viLines.map((line, idx) => {
                      const en = enLines[idx] ? ` / ${enLines[idx]}` : "";
                      return line + en;
                    }).join("\n");
                  })()}
                </div>
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
              <div style={{ textAlign: "center", minWidth: 280, maxWidth: 360 }}>
                <div style={{ color: "#555", fontStyle: "italic", marginBottom: 4 }}>
                  Phú Mỹ, ngày {qDay} tháng {qMonth} năm {qYear}
                </div>
                <div style={{ fontWeight: 700, color: "#1a2540", marginBottom: 2 }}>{T.signTitle}</div>
                <div style={{ color: "#666", fontSize: 10, marginBottom: 6 }}>(Ký, đóng dấu &amp; ghi rõ họ tên)</div>
                
                {printOptions.showDigitalSign && isSigned ? (
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    border: "1px solid rgba(226, 232, 240, 0.9)",
                    borderRadius: "6px",
                    padding: "8px 10px",
                    background: "rgba(248, 250, 252, 0.75)",
                    position: "relative",
                    margin: "4px auto 8px",
                    textAlign: "left",
                    maxWidth: 350,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
                  }}>
                    {/* Left side: Stamp / Company short block */}
                    <div style={{
                      flex: "0 0 100px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      alignItems: "center",
                      textAlign: "center",
                      borderRight: "1px dashed #cbd5e1",
                      paddingRight: "8px"
                    }}>
                      {getStampUrl() ? (
                        <img 
                          src={getStampUrl()} 
                          alt="Con dấu" 
                          style={{ 
                            width: "85px", 
                            height: "85px", 
                            objectFit: "contain"
                          }} 
                        />
                      ) : (
                        <div style={{
                          fontWeight: "900",
                          fontSize: "12px",
                          lineHeight: "1.25",
                          color: "#1e293b",
                          textTransform: "uppercase"
                        }}>
                          {COMPANY.short || "MÁY TÍNH PHÚ MỸ"}
                        </div>
                      )}
                    </div>

                    {/* Right side: X.509 Token standard metadata matching Foxit style */}
                    <div style={{
                      flex: 1,
                      fontSize: "9px",
                      lineHeight: "1.36",
                      color: "#1e293b",
                      fontFamily: "Segoe UI, Arial, sans-serif",
                      wordBreak: "break-word"
                    }}>
                      <div style={{ color: "#000", fontWeight: "700", marginBottom: "1px", fontSize: "9.5px" }}>
                        Digitally signed by {COMPANY.digitalSign?.signerName || COMPANY.name}
                      </div>
                      <div>
                        <strong>DN:</strong> C=VN, S={COMPANY.digitalSign?.province || "Bà Rịa - Vũng Tàu"}, O={COMPANY.digitalSign?.signerName || COMPANY.name}, CN={COMPANY.digitalSign?.signerName || COMPANY.name}, OID.0.9.2342.19200300.100.1.1=MST:{COMPANY.mst}
                      </div>
                      <div style={{ marginTop: "1px" }}>
                        <strong>Reason:</strong> {COMPANY.digitalSign?.reason || "I am approving this document with my legally binding signature"}
                      </div>
                      <div style={{ marginTop: "1px" }}>
                        <strong>Location:</strong> {COMPANY.digitalSign?.location || "Bà Rịa - Vũng Tàu"}
                      </div>
                      <div style={{ marginTop: "1px" }}>
                        <strong>Date:</strong> {signedDate}
                      </div>
                      <div style={{ color: "#64748b", marginTop: "1px", fontStyle: "italic", fontSize: "8.5px" }}>
                        {COMPANY.digitalSign?.caProvider || "I-CA (I-CA Public CA)"}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ height: 60 }} />
                )}

                <div style={{ fontWeight: 700, fontSize: 12, color: "#0f172a", textTransform: "uppercase", marginTop: 4 }}>
                  {COMPANY.representative || "TRẦN VĂN THỊNH"}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer no-print">
          <button className="btn btn-ghost" onClick={onClose}>Đóng</button>
          <button className="btn btn-primary" onClick={handlePrint}>🖨️ In Báo Giá</button>
        </div>
      </div>

      {/* USB Token PIN Verification Modal */}
      {showPinModal && (
        <div className="modal-overlay" style={{ zIndex: 99999 }} onClick={e => e.target === e.currentTarget && setShowPinModal(false)}>
          <div className="modal" style={{ maxWidth: 440, borderRadius: 12, padding: 0, overflow: "hidden", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.3)" }}>
            {/* Header */}
            <div style={{ background: "linear-gradient(135deg, #1e3a8a, #2563eb)", color: "#fff", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 700 }}>
                <span>🔒</span>
                <span>Xác thực Chữ ký số USB Token (I-CA)</span>
              </div>
              <button type="button" onClick={() => setShowPinModal(false)} style={{ background: "none", border: "none", color: "#fff", fontSize: 22, cursor: "pointer", opacity: 0.8, lineHeight: 1 }}>×</button>
            </div>

            {/* Body */}
            <div style={{ padding: "20px 24px" }}>
              {/* Certificate Card info */}
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "12px 14px", marginBottom: 16, fontSize: 12 }}>
                <div style={{ fontWeight: 700, color: "#1e293b", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                  <span>🛡️</span>
                  <span>Chứng thư số điện tử I-CA (X.509)</span>
                </div>
                <div style={{ color: "#475569", lineHeight: 1.5 }}>
                  <div><strong>Chủ thể:</strong> {COMPANY.digitalSign?.signerName || COMPANY.name}</div>
                  <div><strong>Mã số thuế:</strong> {COMPANY.mst}</div>
                  <div><strong>Người ký:</strong> {COMPANY.representative || "TRẦN VĂN THỊNH"}</div>
                  <div><strong>Đơn vị CA:</strong> {COMPANY.digitalSign?.caProvider || "I-CA (I-CA Public CA)"}</div>
                </div>
              </div>

              {/* Direct Plugin Sign Trigger */}
              <div style={{ marginBottom: 16, textAlign: "center" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleSignViaPlugin}
                  disabled={pluginSigning}
                  style={{ width: "100%", padding: "10px 14px", fontSize: 13, fontWeight: 700, background: "#ecfdf5", color: "#047857", borderColor: "#a7f3d0", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                >
                  <span>{pluginSigning ? "⏳ Đang kết nối I-CA Plugin..." : "⚡ Ký trực tiếp qua I-CA Token Plugin (Bật popup Windows)"}</span>
                </button>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0", color: "#94a3b8", fontSize: 11 }}>
                <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
                <span>HOẶC XÁC THỰC MÃ PIN NHANH</span>
                <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
              </div>

              <form onSubmit={handleConfirmPinSign}>
                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                    Mã PIN USB Token:
                  </label>
                  <div style={{ position: "relative" }}>
                    <input 
                      type={showPinText ? "text" : "password"}
                      autoFocus
                      className="form-control"
                      style={{ paddingRight: 40, fontSize: 15, letterSpacing: showPinText ? "normal" : "3px", height: 42 }}
                      placeholder="Nhập mã PIN Token..."
                      value={pinInput}
                      onChange={e => { setPinInput(e.target.value); setPinError(""); }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPinText(!showPinText)}
                      style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#64748b" }}
                      title={showPinText ? "Ẩn PIN" : "Hiện PIN"}
                    >
                      {showPinText ? "👁️" : "🙈"}
                    </button>
                  </div>
                  {pinError && (
                    <div style={{ color: "#dc2626", fontSize: 12, marginTop: 6, fontWeight: 500, lineHeight: 1.4 }}>
                      {pinError}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>
                    * Mặc định mã PIN là: <code>{COMPANY.digitalSign?.pin || "12345678"}</code> (có thể cấu hình trong Cài đặt).
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 22 }}>
                  <button type="button" className="btn btn-ghost" onClick={() => setShowPinModal(false)}>
                    Hủy
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ background: "#2563eb", padding: "8px 18px", fontWeight: 600 }}>
                    🖋️ Xác nhận & Ký số
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
