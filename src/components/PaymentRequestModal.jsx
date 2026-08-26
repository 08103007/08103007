import React, { useState, useEffect, useRef } from 'react';
import { COMPANY, getLogoUrl, savePaymentRequest, generatePaymentRequestNumber, listPaymentRequests, listDebtRecs, showToast } from '../utils/gasStore';
import { fmt, numberToWordsVN, numberToWordsEN, numberToWordsCN, parseInvoiceXml } from '../utils/helpers';
import { exportViaPuppeteer } from '../utils/pdfExporter';
import { 
  ensurePdfMake, ensureBeVietnamPro, buildDocxBlob, dxPara, dxBi, dxCell, dxHeaderCell, dxRow, dxTable, 
  downloadBlob 
} from '../utils/docxBuilder';

const PAY_REQ_I18N = {
  vi_en: {
    subTitle: "PAYMENT REQUEST",
    toLabel: "To",
    addressLabel: "Address",
    taxLabel: "Tax ID",
    attentionLabel: "Attention",
    basisHeading: "1. CĂN CỨ ĐỀ NGHỊ THANH TOÁN (PAYMENT BASIS):",
    basisHeadingSimple: "Căn cứ đề nghị thanh toán / Payment Basis:",
    debtReconLine: (no, date) => `Based on Debt Reconciliation Minutes No: ${no || "........"} dated ${date || "........"}`,
    debtPeriodLine: (period) => `Reconciliation Period: ${period || "........"}`,
    invoiceLine: (no, series, date) => `Based on VAT Invoice No: ${no || "........"}${series ? ` (Series: ${series})` : ""} dated ${date || "........"}`,
    contractLine: (no) => `Ref Contract / Quotation No: ${no}`,
    amountHeading: "2. SỐ TIỀN ĐỀ NGHỊ THANH TOÁN (REQUESTED AMOUNT):",
    amountHeadingSimple: "Số tiền đề nghị thanh toán / Requested Amount:",
    inWordsPrefix: "In words: ",
    inWordsFunc: (val) => numberToWordsEN(val),
    reasonHeading: "3. NỘI DUNG / LÝ DO THANH TOÁN (REASON):",
    reasonHeadingSimple: "Lý do thanh toán / Payment Reason:",
    bankHeading: "4. THÔNG TIN TÀI KHOẢN THỤ HƯỞNG (BANK TRANSFER DETAILS):",
    bankHeadingSimple: "Thông tin chuyển khoản thụ hưởng / Bank Transfer Details:",
    accNameLabel: "Account Name",
    accNoLabel: "Account Number",
    bankNameLabel: "Bank Name",
    applicantSignLabel: "APPLICANT",
    approvedSignLabel: "APPROVED BY BUYER",
  },
  vi_zh: {
    subTitle: "付款申请书",
    toLabel: "致",
    addressLabel: "地址",
    taxLabel: "税号",
    attentionLabel: "代表",
    basisHeading: "1. CĂN CỨ ĐỀ NGHỊ THANH TOÁN (付款依据):",
    basisHeadingSimple: "Căn cứ đề nghị thanh toán / 付款依据:",
    debtReconLine: (no, date) => `根据对账单编号: ${no || "........"} 日期 ${date || "........"}`,
    debtPeriodLine: (period) => `对账期间: ${period || "........"}`,
    invoiceLine: (no, series, date) => `根据增值税发票编号: ${no || "........"}${series ? ` (代号: ${series})` : ""} 日期 ${date || "........"}`,
    contractLine: (no) => `根据合同/报价单编号: ${no}`,
    amountHeading: "2. SỐ TIỀN ĐỀ NGHỊ THANH TOÁN (申请付款金额):",
    amountHeadingSimple: "Số tiền đề nghị thanh toán / 申请付款金额:",
    inWordsPrefix: "大写: ",
    inWordsFunc: (val) => numberToWordsCN(val),
    reasonHeading: "3. NỘI DUNG / LÝ DO THANH TOÁN (付款事由):",
    reasonHeadingSimple: "Lý do thanh toán / 付款事由:",
    bankHeading: "4. THÔNG TIN TÀI KHOẢN THỤ HƯỞNG (收款账户信息):",
    bankHeadingSimple: "Thông tin chuyển khoản thụ hưởng / 收款账户信息:",
    accNameLabel: "户名",
    accNoLabel: "账号",
    bankNameLabel: "开户行",
    applicantSignLabel: "申请人",
    approvedSignLabel: "付款批准人",
  },
  vi: {
    subTitle: "",
    toLabel: "",
    addressLabel: "",
    taxLabel: "",
    attentionLabel: "",
    basisHeading: "1. CĂN CỨ ĐỀ NGHỊ THANH TOÁN:",
    basisHeadingSimple: "Căn cứ đề nghị thanh toán:",
    debtReconLine: () => "",
    debtPeriodLine: () => "",
    invoiceLine: () => "",
    contractLine: () => "",
    amountHeading: "2. SỐ TIỀN ĐỀ NGHỊ THANH TOÁN:",
    amountHeadingSimple: "Số tiền đề nghị thanh toán:",
    inWordsPrefix: "",
    inWordsFunc: () => "",
    reasonHeading: "3. NỘI DUNG / LÝ DO THANH TOÁN:",
    reasonHeadingSimple: "Lý do thanh toán:",
    bankHeading: "4. THÔNG TIN TÀI KHOẢN THỤ HƯỞNG:",
    bankHeadingSimple: "Thông tin chuyển khoản thụ hưởng:",
    accNameLabel: "",
    accNoLabel: "",
    bankNameLabel: "",
    applicantSignLabel: "",
    approvedSignLabel: "",
  }
};

export default function PaymentRequestModal({ initialData = {}, onClose }) {
  const today = new Date();
  const defaultDateObj = { 
    day: String(today.getDate()).padStart(2, "0"), 
    month: String(today.getMonth() + 1).padStart(2, "0"), 
    year: String(today.getFullYear()) 
  };

  const [requestType, setRequestType] = useState(initialData.requestType || "debt_recon"); // "debt_recon" | "invoice"
  const [lang, setLang] = useState(initialData.lang || "vi_en");

  const [form, setForm] = useState({
    reqNumber: initialData.reqNumber || generatePaymentRequestNumber(),
    reqDate: initialData.reqDate || defaultDateObj,
    
    // Customer / Buyer info
    buyerName: initialData.buyerName || "",
    buyerNameEn: initialData.buyerNameEn || "",
    buyerTaxCode: initialData.buyerTaxCode || "",
    buyerAddress: initialData.buyerAddress || "",
    buyerAddressEn: initialData.buyerAddressEn || "",
    buyerRep: initialData.buyerRep || "",
    buyerPosition: initialData.buyerPosition || "",

    // Type 1: Debt Recon basis
    debtReconNo: initialData.debtReconNo || "",
    debtReconDate: initialData.debtReconDate || `${defaultDateObj.day}/${defaultDateObj.month}/${defaultDateObj.year}`,
    debtPeriod: initialData.debtPeriod || `Tính đến ngày ${defaultDateObj.day}/${defaultDateObj.month}/${defaultDateObj.year}`,
    
    // Type 2: Invoice basis
    invoiceNo: initialData.invoiceNo || "",
    invoiceSeries: initialData.invoiceSeries || "",
    invoiceDate: initialData.invoiceDate || `${defaultDateObj.day}/${defaultDateObj.month}/${defaultDateObj.year}`,
    contractNo: initialData.contractNo || "",

    // Payment Amount & Reason
    amount: initialData.amount || 0,
    reason: initialData.reason || "",
    reasonEn: initialData.reasonEn || "",
  });

  const [fontSize, setFontSize] = useState(12);
  const [lineSpacing, setLineSpacing] = useState(1.45);
  const [pageMargins, setPageMargins] = useState({ top: 20, right: 20, bottom: 20, left: 30 });
  const [saveMsg, setSaveMsg] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [wordLoading, setWordLoading] = useState(false);
  const [translating, setTranslating] = useState(false);

  const fileRef = useRef(null);
  const [xmlMsg, setXmlMsg] = useState("");
  const [xmlInvoices, setXmlInvoices] = useState([]);
  const [savedReqs, setSavedReqs] = useState([]);
  const [reqListLoading, setReqListLoading] = useState(false);

  const fetchSavedPaymentRequests = async () => {
    setReqListLoading(true);
    try {
      const list = await listPaymentRequests();
      const combined = [...(list || [])];
      try {
        const { _mem } = await import('../utils/gasStore');
        if (_mem && _mem.debtRecs) {
          Object.values(_mem.debtRecs).forEach(d => {
            if (d && d.id && !combined.some(r => r.id === d.id)) {
              combined.push({
                id: d.id,
                reqNumber: d.refNum || d.id,
                buyerName: d.buyerName || "",
                amount: (d.invoices || []).reduce((s, inv) => s + (inv.grand || 0), 0),
                type: "debt_recon",
                dateStr: d.dateStr || ""
              });
            }
          });
        }
        if (_mem && Array.isArray(_mem.quotes)) {
          _mem.quotes.forEach(q => {
            if (q && q.id && !combined.some(r => r.id === q.id)) {
              combined.push({
                id: q.id,
                reqNumber: q.quoteNumber || q.id,
                buyerName: q.customer || "",
                amount: (q.items || []).reduce((s, i) => s + ((i.price||0)*(i.qty||1)), 0),
                type: "quote",
                dateStr: q.date || ""
              });
            }
          });
        }
      } catch(e) {}
      setSavedReqs(combined.sort((a,b) => (b.updatedAt||0) - (a.updatedAt||0)));
    } finally {
      setReqListLoading(false);
    }
  };

  useEffect(() => {
    fetchSavedPaymentRequests();
  }, []);

  const handleAutoTranslate = async () => {
    if (lang === "vi") {
      alert("Vui lòng chọn ngôn ngữ song ngữ (Tiếng Anh hoặc Tiếng Trung) trước khi dịch.");
      return;
    }
    const targetLangCode = lang === "vi_zh" ? "zh-CN" : "en";
    setTranslating(true);

    const translateOne = async (str) => {
      if (!str || !str.trim()) return "";
      try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=vi&tl=${targetLangCode}&dt=t&q=${encodeURIComponent(str.trim())}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data && data[0]) {
          return data[0].map(x => x[0]).join("");
        }
        return str;
      } catch (_) {
        return str;
      }
    };

    try {
      const [transReason, transBuyerName, transBuyerAddr] = await Promise.all([
        translateOne(form.reason),
        translateOne(form.buyerName),
        translateOne(form.buyerAddress),
      ]);

      setForm(p => ({
        ...p,
        reasonEn: transReason || p.reasonEn,
        buyerNameEn: transBuyerName || p.buyerNameEn,
        buyerAddressEn: transBuyerAddr || p.buyerAddressEn,
      }));

      setXmlMsg(`✓ Đã tự động dịch sang ${lang === "vi_zh" ? "Tiếng Trung" : "Tiếng Anh"} thành công!`);
      setTimeout(() => setXmlMsg(""), 5000);
    } catch (e) {
      alert("Lỗi dịch tự động: " + e.message);
    } finally {
      setTranslating(false);
    }
  };

  const handleXmlFiles = async (fileList) => {
    if (!fileList || fileList.length === 0) return;
    const xmlFiles = [...fileList].filter(f => f.name.toLowerCase().endsWith(".xml"));
    if (xmlFiles.length === 0) {
      alert("Vui lòng chọn các file có định dạng .xml");
      return;
    }

    try {
      const readPromises = xmlFiles.map(file => 
        file.text().then(text => {
          try {
            const inv = parseInvoiceXml(text);
            inv._fileName = file.name;
            inv._id = Math.random().toString(36).substring(2, 9);
            return { ok: true, inv };
          } catch(err) {
            return { ok: false, fileName: file.name, error: err.message };
          }
        })
      );

      const results = await Promise.all(readPromises);
      const successfulInvoices = results.filter(r => r.ok).map(r => r.inv);
      const failedFiles = results.filter(r => !r.ok);

      if (successfulInvoices.length === 0) {
        alert("Không đọc được dữ liệu hóa đơn từ các file XML đã chọn. Vui lòng kiểm tra lại!");
        return;
      }

      setXmlInvoices(prev => {
        const merged = [...prev, ...successfulInvoices];
        return merged;
      });

      if (successfulInvoices.length === 1 && xmlInvoices.length === 0) {
        const inv = successfulInvoices[0];
        setForm(p => ({
          ...p,
          invoiceNo: inv.invoiceNumber || p.invoiceNo,
          invoiceSeries: inv.serial || p.invoiceSeries,
          invoiceDate: inv.invoiceDate || p.invoiceDate,
          buyerName: inv.buyerName || p.buyerName,
          buyerTaxCode: inv.buyerTax || p.buyerTaxCode,
          buyerAddress: inv.buyerAddr || p.buyerAddress,
          amount: inv.grandTotal || p.amount,
          reason: `Thanh toán tiền hàng/dịch vụ theo Hóa đơn GTGT số ${inv.invoiceNumber || "..."}${inv.serial ? ` (Ký hiệu ${inv.serial})` : ""} ngày ${inv.invoiceDate || "..."}`
        }));
        setXmlMsg(`✓ Đã tự động đọc hóa đơn ${inv.invoiceNumber || ""} (${fmt(inv.grandTotal)} đ)`);
      } else {
        const allInvoices = [...xmlInvoices, ...successfulInvoices];
        const totalGrand = allInvoices.reduce((sum, i) => sum + (i.grandTotal || 0), 0);
        const invNos = allInvoices.map(i => i.invoiceNumber).filter(Boolean).join(", ");
        const invSerials = [...new Set(allInvoices.map(i => i.serial).filter(Boolean))].join(", ");
        const invDates = [...new Set(allInvoices.map(i => i.invoiceDate).filter(Boolean))].join(", ");
        const firstBuyer = allInvoices.find(i => i.buyerName) || {};

        setForm(p => ({
          ...p,
          invoiceNo: invNos || p.invoiceNo,
          invoiceSeries: invSerials || p.invoiceSeries,
          invoiceDate: invDates || p.invoiceDate,
          buyerName: firstBuyer.buyerName || p.buyerName,
          buyerTaxCode: firstBuyer.buyerTax || p.buyerTaxCode,
          buyerAddress: firstBuyer.buyerAddr || p.buyerAddress,
          amount: totalGrand || p.amount,
          reason: `Thanh toán tiền hàng/dịch vụ theo ${allInvoices.length} Hóa đơn GTGT (Số: ${invNos}) ngày ${invDates}`
        }));
        setXmlMsg(`✓ Đã nhập thành công ${successfulInvoices.length} file Hóa đơn GTGT (Tổng ${allInvoices.length} HĐ: ${fmt(totalGrand)} đ)${failedFiles.length ? ` (Lỗi ${failedFiles.length} file)` : ""}`);
      }
      setTimeout(() => setXmlMsg(""), 6000);
    } catch(e) {
      alert("Lỗi đọc file XML hóa đơn: " + e.message);
    }
  };

  const handleRemoveXmlInvoice = (id) => {
    const updated = xmlInvoices.filter(i => i._id !== id);
    setXmlInvoices(updated);
    if (updated.length > 0) {
      const totalGrand = updated.reduce((sum, i) => sum + (i.grandTotal || 0), 0);
      const invNos = updated.map(i => i.invoiceNumber).filter(Boolean).join(", ");
      const invSerials = [...new Set(updated.map(i => i.serial).filter(Boolean))].join(", ");
      const invDates = [...new Set(updated.map(i => i.invoiceDate).filter(Boolean))].join(", ");
      setForm(p => ({
        ...p,
        invoiceNo: invNos,
        invoiceSeries: invSerials,
        invoiceDate: invDates,
        amount: totalGrand,
        reason: `Thanh toán tiền hàng/dịch vụ theo ${updated.length} Hóa đơn GTGT (Số: ${invNos}) ngày ${invDates}`
      }));
    }
  };

  const setField = (f, v) => setForm(p => ({ ...p, [f]: v }));

  // Auto-generate default reason when amount or type changes if reason is empty
  useEffect(() => {
    if (!form.reason) {
      if (requestType === "debt_recon") {
        setField("reason", `Thanh toán số tiền công nợ theo Biên bản đối chiếu công nợ số ${form.debtReconNo || "..."} ngày ${form.debtReconDate || "..."}`);
      } else {
        setField("reason", `Thanh toán tiền hàng/dịch vụ theo Hóa đơn GTGT số ${form.invoiceNo || "..."} ngày ${form.invoiceDate || "..."}`);
      }
    }
  }, [requestType]);

  const handleSave = async () => {
    const id = initialData.id || "PAY_REQ_" + Date.now();
    await savePaymentRequest(id, { ...form, requestType, lang, fontSize, lineSpacing, pageMargins });
    setSaveMsg("✓ Đã lưu");
    setTimeout(() => setSaveMsg(""), 2000);
  };

  const handlePrint = () => {
    const el = document.getElementById("pay-req-preview-area");
    if (!el) return;

    const ML = pageMargins.left || 30;
    const MR = pageMargins.right || 20;
    const MT = pageMargins.top || 20;
    const MB = pageMargins.bottom || 20;

    const printHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8">
      <title>In Đề Nghị Thanh Toán - ${form.reqNumber}</title>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap">
      <style>
        @page { margin:${MT}mm ${MR}mm ${MB}mm ${ML}mm; size:A4 portrait; }
        html, body { width: 100%; margin: 0; padding: 0; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-family: 'Plus Jakarta Sans', sans-serif; }
        * { box-sizing: border-box; font-family: 'Plus Jakarta Sans', sans-serif !important; }
        #pay-req-preview-area { width: 100% !important; max-width: 100% !important; margin: 0 !important; font-size: ${fontSize}pt !important; line-height: ${lineSpacing} !important; box-shadow: none !important; padding: 0 !important; }
        table { width: 100% !important; border-collapse: collapse !important; table-layout: fixed !important; margin: 10px 0 !important; }
        th, td { border: 1px solid #1a2540 !important; }
        th { background-color: #f1f5f9 !important; -webkit-print-color-adjust: exact; }
        .no-print { display: none !important; }
      </style>
    </head><body>${el.outerHTML}</body></html>`;

    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:794px;height:1px;border:none;";
    iframe.srcdoc = printHtml;
    document.body.appendChild(iframe);

    iframe.onload = () => {
      setTimeout(() => {
        if (iframe.contentWindow) {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        }
        setTimeout(() => {
          if (document.body.contains(iframe)) document.body.removeChild(iframe);
        }, 1000);
      }, 400);
    };
  };

  const handlePDFClick = async () => {
    setPdfLoading(true);
    try {
      const el = document.getElementById("pay-req-preview-area");
      if (el) {
        const ML = pageMargins.left || 30;
        const MR = pageMargins.right || 20;
        const MT = pageMargins.top || 20;
        const MB = pageMargins.bottom || 20;

        const documentHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8">
          <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap">
          <style>
            @page { margin:${MT}mm ${MR}mm ${MB}mm ${ML}mm; size:A4 portrait; }
            html, body { width: 100%; margin: 0; padding: 0; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-family: 'Plus Jakarta Sans', sans-serif; }
            * { box-sizing: border-box; font-family: 'Plus Jakarta Sans', sans-serif !important; }
            #pay-req-preview-area { width: 100% !important; max-width: 100% !important; margin: 0 !important; font-size: ${fontSize}pt !important; line-height: ${lineSpacing} !important; }
            table { width: 100% !important; border-collapse: collapse !important; table-layout: fixed !important; margin: 10px 0 !important; }
            th, td { border: 1px solid #1a2540 !important; }
            .no-print { display: none !important; }
          </style>
        </head><body>${el.outerHTML}</body></html>`;

        const filename = `DeNghiThanhToan_${form.reqNumber.replace(/[/\\?%*:|"<>]/g, "-")}.pdf`;
        const puppeteerOk = await exportViaPuppeteer(documentHtml, filename);
        if (puppeteerOk) return;
      }
    } catch(e) {
      alert("Lỗi xuất PDF: " + e.message);
    } finally {
      setPdfLoading(false);
    }
  };

  const handleWordClick = async () => {
    setWordLoading(true);
    try {
      const t = PAY_REQ_I18N[lang] || PAY_REQ_I18N.vi;
      const SZ = Math.round(fontSize * 2);
      const SZ_LG = Math.round(fontSize * 2.3);
      const SZ_SM = Math.round(fontSize * 1.7);

      const amountVal = Number(form.amount || 0);
      const inWordsStr = numberToWordsVN(amountVal);
      const inWordsTransStr = t.inWordsFunc ? t.inWordsFunc(amountVal) : "";

      const children = [
        dxPara("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", { align: "center", bold: true, size: SZ_SM }),
        dxPara("Độc lập - Tự do - Hạnh phúc", { align: "center", italic: true, size: SZ_SM, spaceAfter: 120 }),
        dxPara("GIẤY ĐỀ NGHỊ THANH TOÁN", { align: "center", bold: true, size: SZ_LG, color: "1A2540" }),
        ...(t.subTitle ? [dxPara(t.subTitle, { align: "center", italic: true, size: SZ, color: "555555", spaceAfter: 80 })] : []),
        dxPara(`Số / No: ${form.reqNumber}`, { align: "center", size: SZ_SM, spaceAfter: 140 }),
        
        dxPara(`Kính gửi${t.toLabel ? ` / ${t.toLabel}` : ""}: ${form.buyerName || "........................................................"}`, { bold: true, size: SZ }),
        ...(form.buyerAddress ? [dxPara(`Địa chỉ${t.addressLabel ? ` / ${t.addressLabel}` : ""}: ${form.buyerAddress} ${form.buyerAddressEn ? `(${form.buyerAddressEn})` : ""}`, { size: SZ_SM })] : []),
        ...(form.buyerTaxCode ? [dxPara(`Mã số thuế${t.taxLabel ? ` / ${t.taxLabel}` : ""}: ${form.buyerTaxCode}`, { size: SZ_SM })] : []),
        "<w:p/>",

        dxPara(t.basisHeadingSimple || "Căn cứ đề nghị thanh toán:", { bold: true, size: SZ, color: "1A2540" }),
        ...(requestType === "debt_recon" ? [
          dxPara(`- Theo Biên bản đối chiếu công nợ số: ${form.debtReconNo || "........"} lập ngày ${form.debtReconDate || "........"}`, { size: SZ }),
          ...(t.debtReconLine(form.debtReconNo, form.debtReconDate) ? [dxPara(`  ${t.debtReconLine(form.debtReconNo, form.debtReconDate)}`, { italic: true, color: "555555", size: SZ_SM })] : []),
          dxPara(`- Kỳ đối chiếu công nợ: ${form.debtPeriod || "........"}`, { size: SZ }),
          ...(t.debtPeriodLine(form.debtPeriod) ? [dxPara(`  ${t.debtPeriodLine(form.debtPeriod)}`, { italic: true, color: "555555", size: SZ_SM })] : []),
        ] : [
          dxPara(`- Theo Hóa đơn GTGT số: ${form.invoiceNo || "........"} ${form.invoiceSeries ? `(Ký hiệu: ${form.invoiceSeries})` : ""} ngày ${form.invoiceDate || "........"}`, { size: SZ }),
          ...(t.invoiceLine(form.invoiceNo, form.invoiceSeries, form.invoiceDate) ? [dxPara(`  ${t.invoiceLine(form.invoiceNo, form.invoiceSeries, form.invoiceDate)}`, { italic: true, color: "555555", size: SZ_SM })] : []),
          ...(form.contractNo ? [
            dxPara(`- Theo Hợp đồng / Báo giá số: ${form.contractNo}`, { size: SZ }),
            ...(t.contractLine(form.contractNo) ? [dxPara(`  ${t.contractLine(form.contractNo)}`, { italic: true, color: "555555", size: SZ_SM })] : []),
          ] : []),
        ]),
        "<w:p/>",

        dxPara(t.amountHeadingSimple || "Số tiền đề nghị thanh toán:", { bold: true, size: SZ_LG, color: "1A2540" }),
        dxPara(`${fmt(amountVal)} VNĐ`, { bold: true, size: SZ_LG }),
        dxPara(`(Bằng chữ: ${inWordsStr})`, { italic: true, bold: true, size: SZ }),
        ...(inWordsTransStr ? [dxPara(`(${t.inWordsPrefix}${inWordsTransStr})`, { italic: true, color: "555555", size: SZ_SM })] : []),
        "<w:p/>",

        dxPara(t.reasonHeadingSimple || "Lý do thanh toán:", { bold: true, size: SZ }),
        dxPara(form.reason || "........................................................", { size: SZ }),
        ...(form.reasonEn ? [dxPara(form.reasonEn, { italic: true, color: "555555", size: SZ_SM })] : []),
        "<w:p/>",

        dxPara(t.bankHeadingSimple || "Thông tin chuyển khoản thụ hưởng:", { bold: true, size: SZ, color: "1A2540" }),
        dxPara(`• Tên tài khoản${t.accNameLabel ? ` / ${t.accNameLabel}` : ""}: ${COMPANY.name}`, { size: SZ }),
        dxPara(`• Số tài khoản${t.accNoLabel ? ` / ${t.accNoLabel}` : ""}: ${COMPANY.bankAccount}`, { bold: true, size: SZ }),
        dxPara(`• Tại ngân hàng${t.bankNameLabel ? ` / ${t.bankNameLabel}` : ""}: ${COMPANY.bankName}`, { size: SZ, spaceAfter: 200 }),

        // Signatures table
        dxTable({
          rows: [
            dxRow([
              dxCell([
                dxPara("BÊN ĐỀ NGHỊ THANH TOÁN", { align: "center", bold: true, size: SZ }),
                ...(t.applicantSignLabel ? [dxPara(t.applicantSignLabel, { align: "center", italic: true, size: SZ_SM, color: "555555" })] : []),
                dxPara("\n\n\n", { size: SZ }),
                dxPara(COMPANY.representative, { align: "center", bold: true, size: SZ })
              ], 4500, { border: [false,false,false,false] }),
              dxCell([
                dxPara("BÊN PHÊ DUYỆT THANH TOÁN", { align: "center", bold: true, size: SZ }),
                ...(t.approvedSignLabel ? [dxPara(t.approvedSignLabel, { align: "center", italic: true, size: SZ_SM, color: "555555" })] : []),
                dxPara("\n\n\n", { size: SZ }),
                dxPara(form.buyerRep || "............................", { align: "center", bold: true, size: SZ })
              ], 4500, { border: [false,false,false,false] }),
            ])
          ],
          widths: [4500, 4500]
        })
      ];

      const blob = await buildDocxBlob(children);
      const filename = `DeNghiThanhToan_${form.reqNumber.replace(/[/\\?%*:|"<>]/g, "-")}.docx`;
      downloadBlob(blob, filename);
    } catch(e) {
      alert("Lỗi xuất Word: " + e.message);
    } finally {
      setWordLoading(false);
    }
  };

  const amountVal = Number(form.amount || 0);

  return (
    <div className="fullpage-screen" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, width: "100vw", height: "100vh", maxWidth: "100vw", maxHeight: "100vh", zIndex: 999999, background: "#f8fafc", display: "flex", flexDirection: "column", margin: 0, padding: 0, borderRadius: 0, border: "none", boxShadow: "none" }}>
      <div className="modal-header no-print" style={{ background: "#1a2540", color: "#fff", padding: "14px 24px", flexShrink: 0, borderBottom: "1px solid #334155" }}>
        <span className="modal-title" style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>🧾 GIẤY ĐỀ NGHỊ THANH TOÁN (TOÀN MÀN HÌNH)</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button 
            className="btn btn-ghost btn-sm" 
            onClick={handleAutoTranslate} 
            disabled={translating || lang === "vi"} 
            title="Tự động dịch nội dung ĐNTT sang Tiếng Anh / Tiếng Trung"
            style={{ color: lang === "vi" ? "#94a3b8" : "#60a5fa", fontWeight: 600 }}
          >
            {translating ? "⏳ Đang dịch..." : `🌐 Tự động dịch → ${lang === "vi_zh" ? "中文" : "EN"}`}
          </button>
          <button className="btn btn-ghost btn-sm" style={{ color: "#e2e8f0" }} onClick={handlePrint}>🖨️ In Đề nghị thanh toán</button>
          <button className="btn btn-ghost btn-sm" style={{ color: "#e2e8f0" }} onClick={handleSave}>💾 Lưu đề nghị</button>
          <button className="close-btn" style={{ color: "#fff" }} onClick={onClose}>×</button>
        </div>
      </div>

      <div className="modal-body" style={{ display: "flex", gap: 0, padding: 0, overflow: "hidden", flex: 1 }}>
        {/* Controls Panel */}
        <div className="no-print" style={{ width: 360, minWidth: 360, borderRight: "1px solid #e5e3dc", overflowY: "auto", padding: "16px 18px", background: "#fafafa" }}>
          
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div className="section-title" style={{ marginBottom: 0 }}>🗂️ Danh sách đã lưu & Biên bản ({savedReqs.length})</div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={fetchSavedPaymentRequests} style={{ fontSize: 11 }}>🔄 Tải lại</button>
            </div>
            {reqListLoading ? (
              <div style={{ fontSize: 12, color: "#666" }}>Đang tải danh sách...</div>
            ) : savedReqs.length === 0 ? (
              <div style={{ fontSize: 12, color: "#666" }}>Chưa có bản ghi nào.</div>
            ) : (
              <div style={{ display: "grid", gap: 6, maxHeight: 220, overflowY: "auto", marginBottom: 10 }}>
                {savedReqs.map(rec => (
                  <div key={rec.id} style={{ padding: "8px 10px", background: rec.reqNumber === form.reqNumber ? "#eff6ff" : "#fff", border: "1px solid #cbd5e1", borderRadius: 6, cursor: "pointer" }} onClick={() => {
                    if (rec.reqNumber) setField("reqNumber", rec.reqNumber);
                    if (rec.buyerName) setField("buyerName", rec.buyerName);
                    if (rec.buyerAddress) setField("buyerAddress", rec.buyerAddress);
                    if (rec.amount) setField("amount", rec.amount);
                    if (rec.reason) setField("reason", rec.reason);
                    if (rec.debtReconNo) setField("debtReconNo", rec.debtReconNo);
                    showToast("📂 Đã nạp dữ liệu: " + (rec.reqNumber || rec.id), 1500);
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{rec.reqNumber || rec.id}</div>
                      <span style={{ fontSize: 10, background: "#dcfce7", color: "#166534", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>{rec.type || "ĐNTT"}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                      {rec.buyerName || "Khách hàng"} {rec.amount ? `· ${fmt(rec.amount)} đ` : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="section-title">📌 Loại đề nghị thanh toán</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <button 
                type="button" 
                className={`btn btn-sm ${requestType === "debt_recon" ? "btn-primary" : "btn-ghost"}`}
                style={{ flex: 1, fontSize: 12, padding: "6px 8px" }}
                onClick={() => setRequestType("debt_recon")}
              >
                1. Theo BB đối chiếu công nợ
              </button>
              <button 
                type="button" 
                className={`btn btn-sm ${requestType === "invoice" ? "btn-primary" : "btn-ghost"}`}
                style={{ flex: 1, fontSize: 12, padding: "6px 8px" }}
                onClick={() => setRequestType("invoice")}
              >
                2. Theo hóa đơn GTGT
              </button>
            </div>

            <div className="section-title">⚙️ Thiết lập & Thông tin</div>
            <div className="form-group" style={{ marginBottom: 10 }}>
              <label>Ngôn ngữ song ngữ</label>
              <select className="form-control" value={lang} onChange={e => setLang(e.target.value)}>
                <option value="vi_en">Tiếng Việt + Tiếng Anh</option>
                <option value="vi_zh">Tiếng Việt + Tiếng Trung</option>
                <option value="vi">Chỉ Tiếng Việt</option>
              </select>
              {lang !== "vi" ? (
                <button 
                  type="button" 
                  className="btn btn-ghost btn-sm" 
                  style={{ fontSize: 11, width: "100%", marginTop: 6, background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", fontWeight: 600 }}
                  onClick={handleAutoTranslate} 
                  disabled={translating} 
                  title="Tự động dịch Tên công ty, địa chỉ, lý do thanh toán sang ngôn ngữ đã chọn"
                >
                  {translating ? "⏳ Đang tự động dịch..." : `🌐 Dịch tự động nội dung ĐNTT → ${lang === "vi_zh" ? "Tiếng Trung" : "Tiếng Anh"}`}
                </button>
              ) : null}
            </div>

            <div className="form-row form-row-2" style={{ marginBottom: 10 }}>
              <div className="form-group">
                <label>Số ĐNTT</label>
                <input className="form-control" value={form.reqNumber} onChange={e => setField("reqNumber", e.target.value)} />
              </div>
              <div className="form-group">
                <label>Ngày đề nghị</label>
                <div style={{ display: "flex", gap: 4 }}>
                  <input className="form-control" style={{ width: 45 }} value={form.reqDate.day} onChange={e => setField("reqDate", { ...form.reqDate, day: e.target.value })} />
                  <input className="form-control" style={{ width: 45 }} value={form.reqDate.month} onChange={e => setField("reqDate", { ...form.reqDate, month: e.target.value })} />
                  <input className="form-control" style={{ width: 60 }} value={form.reqDate.year} onChange={e => setField("reqDate", { ...form.reqDate, year: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="section-title">🏢 Bên thanh toán (Khách hàng)</div>
            <div className="form-group" style={{ marginBottom: 8 }}>
              <label>Tên công ty / Khách hàng</label>
              <input className="form-control" value={form.buyerName} onChange={e => setField("buyerName", e.target.value)} placeholder="Tên bên mua..." />
            </div>
            <div className="form-group" style={{ marginBottom: 8 }}>
              <label>Địa chỉ</label>
              <input className="form-control" value={form.buyerAddress} onChange={e => setField("buyerAddress", e.target.value)} />
            </div>
            <div className="form-row form-row-2" style={{ marginBottom: 12 }}>
              <div className="form-group">
                <label>Mã số thuế</label>
                <input className="form-control" value={form.buyerTaxCode} onChange={e => setField("buyerTaxCode", e.target.value)} />
              </div>
              <div className="form-group">
                <label>Người đại diện / Kính gửi</label>
                <input className="form-control" value={form.buyerRep} onChange={e => setField("buyerRep", e.target.value)} />
              </div>
            </div>

            {requestType === "debt_recon" ? (
              <>
                <div className="section-title">📋 Căn cứ Biên bản đối chiếu công nợ</div>
                <div className="form-group" style={{ marginBottom: 8 }}>
                  <label>Số Biên bản đối chiếu công nợ</label>
                  <input className="form-control" value={form.debtReconNo} onChange={e => setField("debtReconNo", e.target.value)} placeholder="VD: BBDCCN-01/2026" />
                </div>
                <div className="form-row form-row-2" style={{ marginBottom: 12 }}>
                  <div className="form-group">
                    <label>Ngày lập biên bản</label>
                    <input className="form-control" value={form.debtReconDate} onChange={e => setField("debtReconDate", e.target.value)} placeholder="DD/MM/YYYY" />
                  </div>
                  <div className="form-group">
                    <label>Kỳ đối chiếu</label>
                    <input className="form-control" value={form.debtPeriod} onChange={e => setField("debtPeriod", e.target.value)} placeholder="VD: Đợt 1 / Tháng 08" />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="section-title">🧾 Căn cứ Hóa đơn GTGT</div>
                
                <div 
                  style={{
                    background: "#f0fdf4",
                    border: "1.5px dashed #22c55e",
                    borderRadius: 8,
                    padding: "12px",
                    marginBottom: 12,
                    textAlign: "center",
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                  onClick={() => fileRef.current && fileRef.current.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    e.preventDefault();
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      handleXmlFiles(e.dataTransfer.files);
                    }
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#15803d" }}>📂 Import 1 hoặc nhiều file XML Hóa đơn GTGT</div>
                  <div style={{ fontSize: 11, color: "#166534", marginTop: 2 }}>Click hoặc kéo thả nhiều file XML (VNPT, MISA, Fast, Viettel...) cùng lúc</div>
                  <input 
                    ref={fileRef} 
                    type="file" 
                    accept=".xml,text/xml,application/xml" 
                    multiple
                    style={{ display: "none" }} 
                    onChange={e => {
                      if (e.target.files && e.target.files.length > 0) {
                        handleXmlFiles(e.target.files);
                        e.target.value = "";
                      }
                    }} 
                  />
                </div>
                {xmlMsg ? <div style={{ fontSize: 12, color: "#16a34a", fontWeight: 600, marginBottom: 10 }}>{xmlMsg}</div> : null}

                {xmlInvoices.length > 0 ? (
                  <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 10, marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#1e293b" }}>
                        Danh sách {xmlInvoices.length} Hóa đơn XML đã nạp:
                      </div>
                      <button 
                        type="button" 
                        onClick={() => { setXmlInvoices([]); }}
                        style={{ fontSize: 11, color: "#ef4444", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
                      >
                        Xóa tất cả
                      </button>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 130, overflowY: "auto" }}>
                      {xmlInvoices.map(inv => (
                        <div key={inv._id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", border: "1px solid #cbd5e1", borderRadius: 4, padding: "4px 8px", fontSize: 11 }}>
                          <div>
                            <span style={{ fontWeight: 600, color: "#0f172a" }}>HĐ số: {inv.invoiceNumber || "N/A"}</span>
                            <span style={{ color: "#64748b", marginLeft: 6 }}>({inv.serial || ""})</span>
                            <span style={{ color: "#64748b", marginLeft: 6 }}>- Ngày: {inv.invoiceDate}</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontWeight: 700, color: "#166534" }}>{fmt(inv.grandTotal)} đ</span>
                            <button 
                              type="button" 
                              onClick={() => handleRemoveXmlInvoice(inv._id)}
                              style={{ border: "none", background: "none", color: "#94a3b8", cursor: "pointer", fontSize: 12, padding: "0 2px" }}
                              title="Xóa hóa đơn này"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="form-row form-row-2" style={{ marginBottom: 8 }}>
                  <div className="form-group">
                    <label>Số Hóa đơn GTGT</label>
                    <input className="form-control" value={form.invoiceNo} onChange={e => setField("invoiceNo", e.target.value)} placeholder="VD: 0001234" />
                  </div>
                  <div className="form-group">
                    <label>Ký hiệu HĐ</label>
                    <input className="form-control" value={form.invoiceSeries} onChange={e => setField("invoiceSeries", e.target.value)} placeholder="VD: 1K26T..." />
                  </div>
                </div>
                <div className="form-row form-row-2" style={{ marginBottom: 12 }}>
                  <div className="form-group">
                    <label>Ngày hóa đơn</label>
                    <input className="form-control" value={form.invoiceDate} onChange={e => setField("invoiceDate", e.target.value)} placeholder="DD/MM/YYYY" />
                  </div>
                  <div className="form-group">
                    <label>Số Hợp đồng / Báo giá</label>
                    <input className="form-control" value={form.contractNo} onChange={e => setField("contractNo", e.target.value)} placeholder="VD: 01-100826/PMC" />
                  </div>
                </div>
              </>
            )}

            <div className="section-title">💵 Số tiền & Lý do đề nghị</div>
            <div className="form-group" style={{ marginBottom: 8 }}>
              <label>Số tiền đề nghị thanh toán (VNĐ)</label>
              <input 
                type="number" 
                className="form-control" 
                value={form.amount} 
                onChange={e => setField("amount", parseFloat(e.target.value) || 0)} 
                style={{ fontWeight: 700, color: "#1a2540" }}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 8 }}>
              <label>Nội dung / Lý do thanh toán (Tiếng Việt)</label>
              <textarea className="form-control" rows={2} value={form.reason} onChange={e => setField("reason", e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label>Lý do thanh toán ({lang === "vi_en" ? "English" : "中文"})</label>
              <textarea className="form-control" rows={2} value={form.reasonEn} onChange={e => setField("reasonEn", e.target.value)} placeholder="Optionally enter translation..." />
            </div>

            <div className="section-title">📐 Định dạng trang</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 11 }}>Cỡ chữ: {fontSize}pt</label>
                <input type="range" min="10" max="15" step="0.5" value={fontSize} onChange={e => setFontSize(parseFloat(e.target.value))} style={{ width: "100%" }} />
              </div>
              <div>
                <label style={{ fontSize: 11 }}>Giãn dòng: {lineSpacing}x</label>
                <input type="range" min="1.1" max="2.0" step="0.05" value={lineSpacing} onChange={e => setLineSpacing(parseFloat(e.target.value))} style={{ width: "100%" }} />
              </div>
            </div>

          </div>

          {/* Document Preview Area */}
          <div style={{ flex: 1, overflowY: "auto", padding: 24, background: "#f1f5f9", display: "flex", justifyContent: "center" }}>
            <div 
              id="pay-req-preview-area"
              style={{
                width: 794,
                minHeight: 1000,
                background: "#fff",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                padding: `${pageMargins.top}mm ${pageMargins.right}mm ${pageMargins.bottom}mm ${pageMargins.left}mm`,
                boxSizing: "border-box",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontSize: `${fontSize}pt`,
                lineHeight: lineSpacing,
                color: "#0f172a",
                position: "relative"
              }}
            >
              {/* Header section with Logo & Company Info */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, borderBottom: "2px solid #1a2540", paddingBottom: 12 }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  {getLogoUrl() ? <img src={getLogoUrl()} style={{ height: 50, objectFit: "contain" }} alt="Logo" /> : null}
                  <div>
                    <div style={{ fontWeight: 700, fontSize: `${fontSize * 1.1}pt`, color: "#1a2540" }}>{COMPANY.name}</div>
                    <div style={{ fontSize: `${fontSize * 0.85}pt`, color: "#475569" }}>{COMPANY.address}</div>
                    <div style={{ fontSize: `${fontSize * 0.85}pt`, color: "#475569" }}>MST: {COMPANY.mst} | SĐT: {COMPANY.phone}</div>
                  </div>
                </div>
              </div>

              {/* Title Header */}
              {(() => {
                const t = PAY_REQ_I18N[lang] || PAY_REQ_I18N.vi;
                return (
                  <>
                    <div style={{ textAlign: "center", marginBottom: 20 }}>
                      <div style={{ fontSize: `${fontSize * 1.5}pt`, fontWeight: 700, color: "#1a2540", textTransform: "uppercase" }}>GIẤY ĐỀ NGHỊ THANH TOÁN</div>
                      {t.subTitle ? (
                        <div style={{ fontSize: `${fontSize * 1.05}pt`, fontStyle: "italic", color: "#64748b" }}>{t.subTitle}</div>
                      ) : null}
                      <div style={{ fontSize: `${fontSize * 0.9}pt`, color: "#64748b", marginTop: 4 }}>
                        Số / No: <strong style={{ color: "#0f172a" }}>{form.reqNumber}</strong> | Ngày / Date: {form.reqDate.day}/{form.reqDate.month}/{form.reqDate.year}
                      </div>
                    </div>

                    {/* Customer / Buyer Information Block */}
                    <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, padding: "12px 16px", marginBottom: 20 }}>
                      <div style={{ fontWeight: 600, fontSize: `${fontSize * 1.05}pt`, marginBottom: 4 }}>
                        Kính gửi{t.toLabel ? ` (${t.toLabel})` : ""}: <span style={{ color: "#1a2540", textTransform: "uppercase" }}>{form.buyerName || "........................................................................"}</span>
                      </div>
                      {form.buyerAddress ? <div style={{ fontSize: `${fontSize * 0.9}pt`, color: "#334155" }}>• Địa chỉ{t.addressLabel ? ` (${t.addressLabel})` : ""}: {form.buyerAddress} {form.buyerAddressEn ? `(${form.buyerAddressEn})` : ""}</div> : null}
                      {form.buyerTaxCode ? <div style={{ fontSize: `${fontSize * 0.9}pt`, color: "#334155" }}>• Mã số thuế{t.taxLabel ? ` (${t.taxLabel})` : ""}: {form.buyerTaxCode}</div> : null}
                      {form.buyerRep ? <div style={{ fontSize: `${fontSize * 0.9}pt`, color: "#334155" }}>• Người đại diện{t.attentionLabel ? ` (${t.attentionLabel})` : ""}: {form.buyerRep} {form.buyerPosition ? `(${form.buyerPosition})` : ""}</div> : null}
                    </div>

                    {/* Payment Basis Details Section */}
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontWeight: 700, color: "#1a2540", marginBottom: 8, borderLeft: "3px solid #1a2540", paddingLeft: 8 }}>
                        {t.basisHeading}
                      </div>

                      {requestType === "debt_recon" ? (
                        <div style={{ paddingLeft: 12 }}>
                          <p style={{ margin: "4px 0" }}>• Căn cứ <strong>Biên bản đối chiếu công nợ số: {form.debtReconNo || "........"}</strong> lập ngày {form.debtReconDate || "........"}</p>
                          {t.debtReconLine(form.debtReconNo, form.debtReconDate) ? <p style={{ margin: "0 0 4px", fontStyle: "italic", color: "#64748b", paddingLeft: 12 }}>{t.debtReconLine(form.debtReconNo, form.debtReconDate)}</p> : null}

                          <p style={{ margin: "4px 0" }}>• Kỳ đối chiếu công nợ: <strong>{form.debtPeriod}</strong></p>
                          {t.debtPeriodLine(form.debtPeriod) ? <p style={{ margin: "0 0 4px", fontStyle: "italic", color: "#64748b", paddingLeft: 12 }}>{t.debtPeriodLine(form.debtPeriod)}</p> : null}
                        </div>
                      ) : (
                        <div style={{ paddingLeft: 12 }}>
                          <p style={{ margin: "4px 0" }}>• Căn cứ <strong>Hóa đơn GTGT số: {form.invoiceNo || "........"}</strong> {form.invoiceSeries ? `(Ký hiệu: ${form.invoiceSeries})` : ""} ngày {form.invoiceDate || "........"}</p>
                          {t.invoiceLine(form.invoiceNo, form.invoiceSeries, form.invoiceDate) ? <p style={{ margin: "0 0 4px", fontStyle: "italic", color: "#64748b", paddingLeft: 12 }}>{t.invoiceLine(form.invoiceNo, form.invoiceSeries, form.invoiceDate)}</p> : null}

                          {form.contractNo ? (
                            <>
                              <p style={{ margin: "4px 0" }}>• Theo Hợp đồng / Báo giá số: <strong>{form.contractNo}</strong></p>
                              {t.contractLine(form.contractNo) ? <p style={{ margin: "0 0 4px", fontStyle: "italic", color: "#64748b", paddingLeft: 12 }}>{t.contractLine(form.contractNo)}</p> : null}
                            </>
                          ) : null}
                        </div>
                      )}
                    </div>

                    {/* Payment Amount Section (No bounding box, uniform heading) */}
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontWeight: 700, color: "#1a2540", marginBottom: 8, borderLeft: "3px solid #1a2540", paddingLeft: 8 }}>
                        {t.amountHeading}
                      </div>
                      <div style={{ paddingLeft: 12 }}>
                        <div style={{ fontSize: `${fontSize * 1.3}pt`, fontWeight: 700, color: "#0f172a", margin: "4px 0" }}>
                          {fmt(amountVal)} VNĐ
                        </div>
                        <div style={{ fontWeight: 600, fontStyle: "italic" }}>
                          (Bằng chữ: {numberToWordsVN(amountVal)})
                        </div>
                        {t.inWordsPrefix && t.inWordsFunc(amountVal) ? (
                          <div style={{ fontStyle: "italic", color: "#475569", fontSize: `${fontSize * 0.9}pt` }}>
                            ({t.inWordsPrefix}{t.inWordsFunc(amountVal)})
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {/* Reason / Details Section */}
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontWeight: 700, color: "#1a2540", marginBottom: 8, borderLeft: "3px solid #1a2540", paddingLeft: 8 }}>
                        {t.reasonHeading}
                      </div>
                      <div style={{ paddingLeft: 12 }}>
                        <p style={{ margin: "4px 0 2px" }}>{form.reason}</p>
                        {form.reasonEn ? <p style={{ margin: "0 0 4px", fontStyle: "italic", color: "#64748b" }}>{form.reasonEn}</p> : null}
                      </div>
                    </div>

                    {/* Bank Transfer Details Section (No bounding box, uniform heading) */}
                    <div style={{ marginBottom: 30 }}>
                      <div style={{ fontWeight: 700, color: "#1a2540", marginBottom: 8, borderLeft: "3px solid #1a2540", paddingLeft: 8 }}>
                        {t.bankHeading}
                      </div>
                      <div style={{ paddingLeft: 12, fontSize: `${fontSize * 0.95}pt` }}>
                        <div>• Tên tài khoản{t.accNameLabel ? ` (${t.accNameLabel})` : ""}: <strong>{COMPANY.name}</strong></div>
                        <div>• Số tài khoản{t.accNoLabel ? ` (${t.accNoLabel})` : ""}: <strong style={{ color: "#1a2540", fontSize: `${fontSize * 1.05}pt` }}>{COMPANY.bankAccount}</strong></div>
                        <div>• Ngân hàng{t.bankNameLabel ? ` (${t.bankNameLabel})` : ""}: <strong>{COMPANY.bankName}</strong></div>
                      </div>
                    </div>

                    {/* Signature Block */}
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 40 }}>
                      <div style={{ textAlign: "center", width: 260 }}>
                        <div style={{ fontWeight: 700, textTransform: "uppercase" }}>BÊN ĐỀ NGHỊ THANH TOÁN</div>
                        {t.applicantSignLabel ? <div style={{ fontStyle: "italic", color: "#64748b", fontSize: `${fontSize * 0.85}pt` }}>{t.applicantSignLabel}</div> : null}
                        <div style={{ fontSize: `${fontSize * 0.8}pt`, color: "#94a3b8", margin: "4px 0 60px" }}>(Ký, đóng dấu, ghi rõ họ tên)</div>
                        <div style={{ fontWeight: 700, color: "#1a2540" }}>{COMPANY.representative}</div>
                      </div>

                      <div style={{ textAlign: "center", width: 260 }}>
                        <div style={{ fontWeight: 700, textTransform: "uppercase" }}>BÊN PHÊ DUYỆT THANH TOÁN</div>
                        {t.approvedSignLabel ? <div style={{ fontStyle: "italic", color: "#64748b", fontSize: `${fontSize * 0.85}pt` }}>{t.approvedSignLabel}</div> : null}
                        <div style={{ fontSize: `${fontSize * 0.8}pt`, color: "#94a3b8", margin: "4px 0 60px" }}>(Ký, đóng dấu, ghi rõ họ tên)</div>
                        <div style={{ fontWeight: 700, color: "#1a2540" }}>{form.buyerRep || "...................................."}</div>
                      </div>
                    </div>
                  </>
                );
              })()}

            </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Đóng</button>
          <button className="btn btn-ghost" onClick={handleSave}>
            💾 Lưu đề nghị {saveMsg && <span style={{ color: "#16a34a", marginLeft: 6 }}>{saveMsg}</span>}
          </button>
          <button className="btn btn-ghost" onClick={handlePrint}>🖨️ In Đề Nghị Thanh Toán</button>
          <button className="btn btn-ghost" onClick={handlePDFClick} disabled={pdfLoading} style={{ minWidth: 120 }}>
            {pdfLoading ? "⏳ Đang tạo..." : "📄 Xuất PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}
