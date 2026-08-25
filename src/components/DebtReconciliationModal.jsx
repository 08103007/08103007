import React, { useState, useEffect, useRef } from 'react';
import { 
  loadDebtRec, listDebtRecs, saveDebtRec, generateDebtRecNumber, 
  COMPANY, getLogoUrl, showToast 
} from '../utils/gasStore';
import { fmt, numberToWordsVN, numberToWordsEN, numberToWordsCN } from '../utils/helpers';
import { printElementViaIframe, exportElementToPdf } from '../utils/pdfExporter';
import { ensureHtmlDocx } from '../utils/docxBuilder';

function parseInvoiceXml(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("File XML không hợp lệ");
 
  const get = (...tags) => {
    for (const t of tags) {
      const el = doc.querySelector(t);
      if (el && el.textContent.trim()) return el.textContent.trim();
    }
    return "";
  };
 
  const invoiceNumber = get("SHDon","so","invoiceNumber","SoHD","KHMSo","KHSo");
  const serial        = get("KHHDon","KHieu","serial","KyHieu","KHMHDon");
  const invoiceDate   = get("NLap","ngayLap","invoiceDate","NgayHD","TDLap");
  const sellerName    = get("NMSThue","tenNguoiBan","sellerName","TenNBan","NBan > Ten","Ten");
  const sellerTax     = get("MSThue","maSoThueNguoiBan","sellerTaxCode","MSTNBan","NBan > MST","MST");
  const sellerAddr    = get("DChi","diaChiNguoiBan","sellerAddress","DCNBan","NBan > DChi");
  const buyerName     = get("TNMHang","tenNguoiMua","buyerName","TenNMua","NMua > Ten","TenKH");
  const buyerTax      = get("MSTNMHang","maSoThueNguoiMua","buyerTaxCode","MSTNMua","NMua > MST","MSTKH");
  const buyerAddr     = get("DCNMHang","diaChiNguoiMua","buyerAddress","DCNMua","NMua > DChi","DCKH");
 
  const itemNodes = doc.querySelectorAll("HHDVu,ChiTiet,Item,InvoiceItem,HangHoa");
  const items = [];
  itemNodes.forEach(node => {
    const gname  = node.querySelector("THHDVu,TenHH,tenHangHoa,itemName,TenHangHoa,Ten")?.textContent?.trim() || "";
    const unit   = node.querySelector("DVTinh,DonViTinh,donViTinh,unit,DVT")?.textContent?.trim() || "";
    const qty    = parseFloat(node.querySelector("SLuong,soLuong,quantity,SoLuong,SL")?.textContent?.trim() || "0") || 0;
    const price  = parseFloat((node.querySelector("DGia,donGia,unitPrice,DonGia,Gia")?.textContent?.trim() || "0").replace(/,/g,"")) || 0;
    const vatRateRaw = node.querySelector("TSuat,thueVAT,vatRate,ThueVAT,TS,TSuatVAT")?.textContent?.trim() || "";
    const vatAmt = parseFloat((node.querySelector("TThue,tienThueVAT,vatAmount,TienThue,ThueGTGT")?.textContent?.trim() || "0").replace(/,/g,"")) || 0;
    const lineTotal = parseFloat((node.querySelector("ThTien,tienHangHoa,lineAmount,ThanhTien,TienHang")?.textContent?.trim() || "0").replace(/,/g,"")) || 0;
 
    if (!gname) return;
 
    let vatRate = 10;
    const vr = vatRateRaw.replace("%","").trim().toUpperCase();
    if (vr === "KCT" || vr === "KK" || vr === "KCTUE" || vr === "") vatRate = -1;
    else { const n = parseFloat(vr); if (!isNaN(n)) vatRate = n; }
 
    const computedLine = lineTotal || (qty * price);
    const computedVat  = vatAmt || (vatRate > 0 ? Math.round(computedLine * vatRate / 100) : 0);
 
    items.push({ name: gname, unit, qty, price, vatRate, vatAmt: computedVat, lineTotal: computedLine });
  });
 
  const subtotalRaw = get("TTCThue","tienHangTruocThue","totalBeforeTax","TongTienHang","TTHang");
  const vatTotalRaw = get("TgTThue","tienThueGTGT","totalVat","TongTienThue","TThueGTGT");
  const grandRaw    = get("TgTTTBSo","tongTienThanhToan","grandTotal","TongTienThanhToan","TTToan");
 
  const subtotal = parseFloat(subtotalRaw.replace(/,/g,"")) || items.reduce((s,it)=>s+it.lineTotal,0);
  const vatTotal = parseFloat(vatTotalRaw.replace(/,/g,"")) || items.reduce((s,it)=>s+it.vatAmt,0);
  const grand    = parseFloat(grandRaw.replace(/,/g,"")) || subtotal + vatTotal;
 
  return {
    invoiceNumber, serial, invoiceDate,
    sellerName, sellerTax, sellerAddr,
    buyerName, buyerTax, buyerAddr,
    items, subtotal, vatTotal, grand,
  };
}

const DEBT_TEXT = {
  vi_en: {
    title: "Biên bản đối chiếu công nợ",
    titleB: "Debt Reconciliation Statement",
    partyIntro: "Hôm nay, chúng tôi gồm có:",
    partyIntroB: "Today, the parties are as follows:",
    seller: "ĐẠI DIỆN BÊN BÁN (Bên A)",
    sellerB: "SELLER REPRESENTATIVE (Party A)",
    buyer: "ĐẠI DIỆN BÊN MUA (Bên B)",
    buyerB: "BUYER REPRESENTATIVE (Party B)",
    company: "Công ty",
    companyB: "Company",
    tax: "MST",
    taxB: "Tax ID",
    person: "Ông/Bà",
    personB: "Name",
    rep: "Người đại diện",
    repB: "Representative",
    position: "Chức vụ",
    positionB: "Position",
    address: "Địa chỉ",
    addressB: "Address",
    reconcileSentence: "Hai bên cùng nhau đối chiếu công nợ phải thu tính đến hết ngày",
    reconcileSentenceB: "Both parties have reconciled the receivables as of",
    invoiceHeaders: [
      ["STT", "No."],
      ["Số / Ký hiệu HĐ", "Invoice No. / Series"],
      ["Hàng hóa / Dịch vụ", "Goods / Services"],
      ["ĐVT", "Unit"],
      ["SL", "Qty"],
      ["Đơn giá", "Unit Price"],
      ["Thuế (%)", "Tax (%)"],
      ["Thành tiền", "Amount"],
    ],
    invoiceGroup: "HĐ:",
    invoiceGroupB: "Inv:",
    invoiceDateLabel: "Ngày:",
    invoiceDateLabelB: "Date:",
    invoiceTotalLabel: "Tổng HĐ:",
    invoiceTotalLabelB: "Invoice total:",
    invoiceSubtotalLabel: "Tiền hàng:",
    invoiceSubtotalLabelB: "Goods:",
    invoiceVatLabel: "VAT:",
    invoiceVatLabelB: "VAT:",
    invoiceGrandLabel: "Tổng:",
    invoiceGrandLabelB: "Total:",
    noInvoices: "Chưa có hóa đơn nào — vui lòng import file XML",
    noInvoicesB: "No invoices yet — please import XML files",
    totalGoods: "Tổng tiền hàng (chưa VAT):",
    totalGoodsB: "Total goods (excl. VAT):",
    totalVat: "Tổng thuế VAT:",
    totalVatB: "Total VAT:",
    grandTotal: "TỔNG CỘNG PHẢI THU:",
    grandTotalB: "TOTAL RECEIVABLE:",
    totalDue: "Như vậy, tính đến ngày",
    totalDueB: "Therefore, as of",
    oweAmount: "còn phải thu của",
    oweAmountB: "the amount receivable from",
    amountIs: "số tiền là:",
    amountIsB: "is:",
    inWords: "Viết bằng chữ:",
    inWordsB: "In words:",
    copiesNote: "Biên bản này được lập thành 02 bản, mỗi bên giữ 01 bản có giá trị như nhau.",
    copiesNoteB: "This statement is made in two copies, each party keeps one with equal validity.",
    buyerSign: "ĐẠI DIỆN BÊN MUA (BÊN B)",
    buyerSignB: "BUYER REPRESENTATIVE (PARTY B)",
    sellerSign: "ĐẠI DIỆN BÊN BÁN (BÊN A)",
    sellerSignB: "SELLER REPRESENTATIVE (PARTY A)",
    signSubNote: "(Ký, ghi rõ họ tên)",
    signSubNoteB: "(Sign and print full name)",
    paymentTitle: "Đề nghị thanh toán",
    paymentTitleB: "Payment Request",
    paymentBasedOn: "Căn cứ Biên bản đối chiếu công nợ",
    paymentBasedOnB: "Based on the Debt Reconciliation Statement",
    paymentTo: "Kính gửi",
    paymentToB: "To",
    paymentAmountText: "Số tiền bằng chữ:",
    paymentAmountTextB: "Amount in words:",
    paymentInfo1: "Căn cứ kết quả đối chiếu công nợ giữa hai bên,",
    paymentInfo1B: "Based on the debt reconciliation result between the two parties,",
    paymentInfo2: "trân trọng đề nghị quý công ty thanh toán số tiền còn nợ như sau:",
    paymentInfo2B: "we respectfully request your company to pay the outstanding amount as follows:",
    paymentContent: "Nội dung",
    paymentContentB: "Description",
    paymentAmountHeader: "Số tiền (đ)",
    paymentAmountHeaderB: "Amount (VND)",
    paymentGoods: "Tổng tiền hàng (chưa VAT)",
    paymentGoodsB: "Total goods (excl. VAT)",
    paymentVat: "Tổng thuế VAT",
    paymentVatB: "Total VAT",
    paymentTotal: "TỔNG SỐ TIỀN ĐỀ NGHỊ THANH TOÁN",
    paymentTotalB: "PAYMENT REQUEST TOTAL",
    paymentRequestNote: "Kính đề nghị quý công ty thanh toán số tiền trên cho",
    paymentRequestNoteB: "We kindly request your company to pay the above amount to",
    paymentReferNote: "Mọi thông tin chi tiết về các hóa đơn liên quan, đề nghị tham khảo Biên bản đối chiếu công nợ",
    paymentReferNoteB: "For details of the related invoices, please refer to the Debt Reconciliation Statement",
    paymentBankInfo: "Thông tin chuyển khoản:",
    paymentBankInfoB: "Bank transfer information:",
    paymentBankHolderLabel: "Chủ TK",
    paymentBankHolderLabelB: "Account holder",
    paymentCooperate: "Rất mong nhận được sự hợp tác và thanh toán đúng hạn từ Quý công ty. Trân trọng cảm ơn!",
    paymentCooperateB: "We appreciate your cooperation and timely payment. Thank you!",
    paymentBuyerSign: "NGƯỜI ĐẠI DIỆN BÊN MUA",
    paymentBuyerSignB: "BUYER REPRESENTATIVE",
    paymentSellerSign: "ĐẠI DIỆN BÊN ĐỀ NGHỊ (BÊN A)",
    paymentSellerSignB: "REQUESTING REPRESENTATIVE (PARTY A)",
  },
  vi_zh: {
    title: "Biên bản đối chiếu công nợ",
    titleB: "应收账款对账单",
    partyIntro: "Hôm nay, chúng tôi gồm có:",
    partyIntroB: "今天，双方组成如下：",
    seller: "ĐẠI DIỆN BÊN BÁN (Bên A)",
    sellerB: "销售方代表（甲方）",
    buyer: "ĐẠI DIỆN BÊN MUA (Bên B)",
    buyerB: "采购方代表（乙方）",
    company: "Công ty",
    companyB: "公司",
    tax: "MST",
    taxB: "税号",
    person: "Ông/Bà",
    personB: "姓名",
    rep: "Người đại diện",
    repB: "代表人",
    position: "Chức vụ",
    positionB: "职位",
    address: "Địa chỉ",
    addressB: "地址",
    reconcileSentence: "Hai bên cùng nhau đối chiếu công nợ phải thu tính đến hết ngày",
    reconcileSentenceB: "双方已就截至该日的应收账款进行核对，具体如下：",
    invoiceHeaders: [
      ["STT", "序号"],
      ["Số / Ký hiệu HĐ", "发票号/系列"],
      ["Hàng hóa / Dịch vụ", "货物/服务"],
      ["ĐVT", "单位"],
      ["SL", "数量"],
      ["Đơn giá", "单价"],
      ["Thuế (%)", "税率"],
      ["Thành tiền", "金额"],
    ],
    invoiceGroup: "HĐ:",
    invoiceGroupB: "发票:",
    invoiceDateLabel: "Ngày:",
    invoiceDateLabelB: "日期:",
    invoiceTotalLabel: "Tổng HĐ:",
    invoiceTotalLabelB: "发票总额:",
    invoiceSubtotalLabel: "Tiền hàng:",
    invoiceSubtotalLabelB: "货物总额:",
    invoiceVatLabel: "VAT:",
    invoiceVatLabelB: "增值税:",
    invoiceGrandLabel: "Tổng:",
    invoiceGrandLabelB: "总计:",
    noInvoices: "Chưa có hóa đơn nào — vui lòng import file XML",
    noInvoicesB: "暂无发票 - 请导入 XML 文件",
    totalGoods: "Tổng tiền hàng (chưa VAT):",
    totalGoodsB: "货物总额（不含增值税）：",
    totalVat: "Tổng thuế VAT:",
    totalVatB: "增值税总额：",
    grandTotal: "TỔNG CỘNG PHẢI THU:",
    grandTotalB: "应收总额：",
    totalDue: "Như vậy, tính đến ngày",
    totalDueB: "因此，截至",
    oweAmount: "còn phải thu của",
    oweAmountB: "需向",
    amountIs: "số tiền là:",
    amountIsB: "金额为：",
    inWords: "Viết bằng chữ:",
    inWordsB: "大写金额：",
    copiesNote: "Biên bản này được lập thành 02 bản, mỗi bên giữ 01 bản có giá trị như nhau.",
    copiesNoteB: "本对账单一式两份，双方各执一份，效力相同。",
    buyerSign: "ĐẠI DIỆN BÊN MUA (BÊN B)",
    buyerSignB: "采购方代表（乙方）",
    sellerSign: "ĐẠI DIỆN BÊN BÁN (BÊN A)",
    sellerSignB: "销售方代表（甲方）",
    signSubNote: "(Ký, ghi rõ họ tên)",
    signSubNoteB: "(签名并填写姓名)",
    paymentTitle: "Đề nghị thanh toán",
    paymentTitleB: "付款申请书",
    paymentBasedOn: "Căn cứ Biên bản đối chiếu công nợ",
    paymentBasedOnB: "依据应收账款对账单",
    paymentTo: "Kính gửi",
    paymentToB: "致：",
    paymentAmountText: "Số tiền bằng chữ:",
    paymentAmountTextB: "大写金额：",
    paymentInfo1: "Căn cứ kết quả đối chiếu công nợ giữa hai bên,",
    paymentInfo1B: "根据双方对账结果，",
    paymentInfo2: "trân trọng đề nghị quý công ty thanh toán số tiền còn nợ như sau:",
    paymentInfo2B: "特此敬请贵公司支付如下欠款：",
    paymentContent: "Nội dung",
    paymentContentB: "内容",
    paymentAmountHeader: "Số tiền (đ)",
    paymentAmountHeaderB: "金额（VND）",
    paymentGoods: "Tổng tiền hàng (chưa VAT)",
    paymentGoodsB: "货物总额（不含增值税）",
    paymentVat: "Tổng thuế VAT",
    paymentVatB: "增值税总额",
    paymentTotal: "TỔNG SỐ TIỀN ĐỀ NGHỊ THANH TOÁN",
    paymentTotalB: "付款申请总额",
    paymentRequestNote: "Kính đề nghị quý công ty thanh toán số tiền trên cho",
    paymentRequestNoteB: "敬请贵公司向以下账户支付上述金额：",
    paymentReferNote: "Mọi thông tin chi tiết về các hóa đơn liên quan, đề nghị tham khảo Biên bản đối chiếu công nợ",
    paymentReferNoteB: "有关相关发票的详细信息，请参阅应收账款对账单",
    paymentBankInfo: "Thông tin chuyển khoản:",
    paymentBankInfoB: "银行转账信息：",
    paymentBankHolderLabel: "Chủ TK",
    paymentBankHolderLabelB: "账户持有人",
    paymentCooperate: "Rất mong nhận được sự hợp tác và thanh toán đúng hạn từ Quý công ty. Trân trọng cảm ơn!",
    paymentCooperateB: "感谢贵公司的配合与及时付款。谢谢！",
    paymentBuyerSign: "NGƯỜI ĐẠI DIỆN BÊN MUA",
    paymentBuyerSignB: "采购方代表",
    paymentSellerSign: "ĐẠI DIỆN BÊN ĐỀ NGHỊ (BÊN A)",
    paymentSellerSignB: "申请方代表（甲方）",
  }
};

export default function DebtReconciliationModal({ onClose, onOpenPaymentRequest }) {
  const today = new Date();
  const todayFull = `${String(today.getDate()).padStart(2,"0")} tháng ${String(today.getMonth()+1).padStart(2,"0")} năm ${today.getFullYear()}`;
  const endOfMonth = `${String(today.getDate()).padStart(2,"0")}/${String(today.getMonth()+1).padStart(2,"0")}/${today.getFullYear()}`;
 
  const [refNum,           setRefNum]           = useState("");
  const [dateStr,          setDateStr]          = useState(todayFull);
  const [toDateStr,        setToDateStr]        = useState(endOfMonth);
  const [sellerRep,        setSellerRep]        = useState(COMPANY.representative || "");
  const [sellerTitle,      setSellerTitle]      = useState(COMPANY.position || "");
  const [buyerName,        setBuyerName]        = useState("");
  const [buyerTax,         setBuyerTax]         = useState("");
  const [buyerAddr,        setBuyerAddr]        = useState("");
  const [buyerRep,         setBuyerRep]         = useState("");
  const [buyerTitle,       setBuyerTitle]       = useState("");
  const [debtLang,         setDebtLang]         = useState("vi_en");
 
  const T = DEBT_TEXT[debtLang] || DEBT_TEXT.vi_en;
 
  const [invoices,         setInvoices]         = useState([]);
  const [expandedInv,      setExpandedInv]      = useState(new Set());
  const [xmlError,         setXmlError]         = useState("");
  const [viewMode,         setViewMode]         = useState("form"); 
  const [pdfLoading,       setPdfLoading]       = useState(false);
  const [saving,           setSaving]           = useState(false);
  const [saveMsg,          setSaveMsg]          = useState("");
  const [savedRecs,        setSavedRecs]        = useState([]);
  const [recListLoading,   setRecListLoading]   = useState(false);
  const fileRef = useRef(null);

  const fetchSavedRecs = async () => {
    setRecListLoading(true);
    try {
      const recs = await listDebtRecs();
      setSavedRecs((recs || []).slice().sort((a,b) => (b.updatedAt||0) - (a.updatedAt||0)));
    } finally {
      setRecListLoading(false);
    }
  };

  const handleNewDebtRec = () => {
    const newRef = generateDebtRecNumber();
    setRefNum(newRef);
    setDateStr(todayFull);
    setToDateStr(endOfMonth);
    setSellerRep(COMPANY.representative || "");
    setSellerTitle(COMPANY.position || "");
    setBuyerName("");
    setBuyerTax("");
    setBuyerAddr("");
    setBuyerRep("");
    setBuyerTitle("");
    setInvoices([]);
    setExpandedInv(new Set());
    setSaveMsg("");
    showToast("🆕 Tạo biên bản mới", 1500);
  };

  const handleReloadSavedRecs = async () => {
    await fetchSavedRecs();
    showToast("🔄 Đã tải lại danh sách biên bản", 1500);
  };

  const [translating,      setTranslating]      = useState(false);

  const handleAutoTranslate = async () => {
    const targetLang = debtLang === "vi_zh" ? "zh-CN" : "en";
    setTranslating(true);

    const translateText = async (text) => {
      if (!text || !text.trim()) return "";
      try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=vi&tl=${targetLang}&dt=t&q=${encodeURIComponent(text.trim())}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data && data[0]) {
          return data[0].map(s => s[0]).join("");
        }
        return text;
      } catch (e) {
        return text;
      }
    };

    try {
      const [tBuyerName, tBuyerAddr] = await Promise.all([
        translateText(buyerName),
        translateText(buyerAddr)
      ]);

      if (tBuyerName) setBuyerName(tBuyerName);
      if (tBuyerAddr) setBuyerAddr(tBuyerAddr);

      showToast(`✓ Đã tự động dịch thông tin khách hàng sang ${debtLang === "vi_zh" ? "Tiếng Trung" : "Tiếng Anh"}!`, 3000);
    } catch (e) {
      showToast("⚠️ Lỗi dịch tự động: " + e.message, 3000);
    } finally {
      setTranslating(false);
    }
  };

  useEffect(() => {
    if (!refNum) setRefNum(generateDebtRecNumber());
    fetchSavedRecs();
  }, []);

  const loadSavedByRefNum = async (num) => {
    if (!num || !num.trim()) return;
    try {
      const saved = await loadDebtRec(num.trim());
      if (!saved) return;
      setDateStr(saved.dateStr || dateStr);
      setToDateStr(saved.toDateStr || toDateStr);
      setSellerRep(saved.sellerRep || sellerRep);
      setSellerTitle(saved.sellerTitle || sellerTitle);
      setBuyerName(saved.buyerName || "");
      setBuyerTax(saved.buyerTax || "");
      setBuyerAddr(saved.buyerAddr || "");
      setBuyerRep(saved.buyerRep || "");
      setBuyerTitle(saved.buyerTitle || "");
      setDebtLang(saved.debtLang || "vi_en");
      if (Array.isArray(saved.invoices) && saved.invoices.length) setInvoices(saved.invoices);
      showToast("📂 Đã tải biên bản đã lưu: " + num, 2000);
    } catch(e) { }
  };

  const handleDeleteDebtRec = async (id) => {
    if (!window.confirm("Xóa biên bản này? Hành động không thể hoàn tác.")) return;
    try {
      const { deleteDebtRec } = await import('../utils/gasStore');
      await deleteDebtRec(id);
      setSavedRecs(prev => prev.filter(r => r.id !== id));
      if (refNum === id) setRefNum(generateDebtRecNumber());
      showToast("🗑️ Đã xóa biên bản đối chiếu công nợ", 2000);
    } catch (e) {
      showToast("⚠️ Lỗi xóa biên bản: " + e.message, 3000);
    }
  };

  const handleSaveDebtRec = async () => {
    const num = refNum.trim() || generateDebtRecNumber();
    if (!refNum.trim()) setRefNum(num);
    setSaving(true); setSaveMsg("");
    try {
      await saveDebtRec(num, {
        refNum: num, dateStr, toDateStr,
        sellerRep, sellerTitle,
        buyerName, buyerTax, buyerAddr, buyerRep, buyerTitle,
        debtLang,
        invoices,
      });
      setSaveMsg("✓ Đã lưu");
      await fetchSavedRecs();
      showToast("💾 Đã lưu biên bản đối chiếu công nợ", 2000);
      setTimeout(() => setSaveMsg(""), 2500);
    } catch(e) {
      showToast("⚠️ Lỗi lưu biên bản: " + e.message, 3000);
    } finally {
      setSaving(false);
    }
  };
 
  const grandSubtotal = invoices.reduce((s, inv) => s + inv.subtotal, 0);
  const grandVat      = invoices.reduce((s, inv) => s + inv.vatTotal, 0);
  const grandTotal    = invoices.reduce((s, inv) => s + inv.grand, 0);
 
  const handleFiles = (files) => {
    setXmlError("");
    const readers = [...files].filter(f => f.name.toLowerCase().endsWith(".xml")).map(file =>
      new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const inv = parseInvoiceXml(ev.target.result);
            inv._id = Date.now().toString(36) + Math.random().toString(36).slice(2,5);
            inv._fileName = file.name;
            resolve({ ok: true, inv });
          } catch(e) {
            resolve({ ok: false, name: file.name, err: e.message });
          }
        };
        reader.readAsText(file, "utf-8");
      })
    );
 
    Promise.all(readers).then(results => {
      const good = results.filter(r => r.ok).map(r => r.inv);
      const bad  = results.filter(r => !r.ok);
 
      if (good.length > 0) {
        setInvoices(prev => {
          const existing = new Set(prev.map(i => i.serial + "_" + i.invoiceNumber));
          const newOnes  = good.filter(i => !existing.has(i.serial + "_" + i.invoiceNumber));
          const merged   = [...prev, ...newOnes];
          const firstWithBuyer = merged.find(i => i.buyerName);
          if (firstWithBuyer && !buyerName) {
            setBuyerName(firstWithBuyer.buyerName);
            setBuyerTax(firstWithBuyer.buyerTax);
            setBuyerAddr(firstWithBuyer.buyerAddr);
          }
          return merged;
        });
        setExpandedInv(prev => {
          const next = new Set(prev);
          good.forEach(i => next.add(i._id));
          return next;
        });
      }
      if (bad.length > 0) {
        setXmlError(`⚠️ ${bad.length} file lỗi: ${bad.map(b => b.name).join(", ")}`);
      }
    });
  };
 
  const removeInvoice = (id) => setInvoices(prev => prev.filter(i => i._id !== id));
  
  const updateItemNote = (invId, itemIdx, value) => {
    setInvoices(prev => prev.map(inv => {
      if (inv._id !== invId) return inv;
      const items = inv.items.map((it, i) => i === itemIdx ? { ...it, extraNote: value } : it);
      return { ...inv, items };
    }));
  };

  const toggleExpand = (id) => {
    setExpandedInv(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
 
  const sortedInvoices = [...invoices].sort((a, b) => {
    const parseDate = d => {
      if (!d) return 0;
      const m = d.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
      if (m) return new Date(m[3], m[2]-1, m[1]).getTime();
      return new Date(d).getTime() || 0;
    };
    return parseDate(a.invoiceDate) - parseDate(b.invoiceDate);
  });
 
  const handlePrint = () => {
    printElementViaIframe("debtPreviewContent", `
      .debt-preview * { color:#000 !important; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .debt-items-table { border:1px solid #000 !important; border-collapse: collapse !important; width: 100% !important; }
      .debt-items-table th, .debt-items-table td { border-right:1px solid #000 !important; border-bottom:1px solid #000 !important; white-space: normal !important; word-break: break-word !important; }
      .debt-items-table th:last-child, .debt-items-table td:last-child { border-right:none !important; }
      .debt-items-table tr:last-child td { border-bottom:none !important; }
      .debt-items-table th { background:#fff !important; white-space: normal !important; vertical-align: middle !important; }
      .debt-grand-row td { background:#eef0f8 !important; }
      .debt-header-table { width:100% !important; table-layout:fixed !important; border-collapse:collapse !important; margin-bottom:14px !important; }
      .debt-header-table td { border:none !important; }
      .debt-header-left { width:52% !important; border-right:2px solid #000 !important; vertical-align:top !important; padding-right:10px !important; }
      .debt-header-right { width:48% !important; text-align:center !important; vertical-align:top !important; padding-left:10px !important; }
      .debt-header-right div { white-space:nowrap !important; }
    `);
  };
 
  const handlePDF = async () => {
    const prefix = viewMode === "payment" ? "DNTT_" : "BBDCCN_";
    await exportElementToPdf("debtPreviewContent", {
      filename: prefix + (refNum || todayFull.replace(/ /g,"_")) + ".pdf",
      pad: 32,
      respectNoCut: true,
    });
  };
 
  const handlePDFClick = async () => { setPdfLoading(true); try { await handlePDF(); } finally { setPdfLoading(false); } };
  
  const [wordLoading, setWordLoading] = useState(false);

  const handleExportWord = async () => {
    const el = document.getElementById("debtPreviewContent");
    if (!el) return;
    await ensureHtmlDocx();

    const htmlString = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <title>${refNum || "BienBan"}</title>
  <style>
    @page { size: 21cm 29.7cm; margin: 1.5cm; }
    body { font-family: "Times New Roman", serif; font-size: 13px; color:#1a1a1a; }
    table { border-collapse: collapse; width: 100%; }
    .debt-items-table td, .debt-items-table th { border: 1px solid #999; padding: 4px 6px; }
    .debt-header-table td, .debt-header-table th { border: none; }
    h1 { text-align:center; font-size:18px; margin-bottom:2px; }
    .debt-title { text-align:center; margin-bottom:14px; }
    .debt-sign { width:100%; }
    .debt-sign-block { display:inline-block; width:48%; text-align:center; vertical-align:top; }
    .sign-space { height:60px; }
  </style>
</head>
<body>${el.outerHTML}</body>
</html>`;

    const blob = window.htmlDocx.asBlob(htmlString);
    const prefix = viewMode === "payment" ? "DNTT_" : "BBDCCN_";
    const filename = prefix + (refNum || todayFull.replace(/ /g, "_")) + ".docx";

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const handleWordClick = async () => {
    setWordLoading(true);
    try { await handleExportWord(); showToast("📝 Đã xuất file Word", 2000); }
    catch(e) { showToast("⚠️ Lỗi xuất Word: " + e.message, 3000); }
    finally { setWordLoading(false); }
  };
 
  const renderPreview = () => {
    const T = DEBT_TEXT[debtLang];
    let rowIdx = 0;
    return (
      <div className="debt-preview" id="debtPreviewContent">
        <table className="debt-header-table" style={{ width:"100%", tableLayout:"fixed", borderCollapse:"collapse", marginBottom:14 }}>
          <tbody>
            <tr>
              <td className="debt-header-left" style={{ width:"52%", verticalAlign:"top", borderRight:"2px solid #000", paddingRight:10 }}>
                <table style={{width:"100%", borderCollapse:"collapse"}}><tbody><tr>
                  <td style={{verticalAlign:"top",paddingRight:10,width:48}}>
                    <img src={getLogoUrl()} style={{width:48,height:48,objectFit:"contain"}} alt="Logo" />
                  </td>
                  <td style={{verticalAlign:"top"}}>
                    <div style={{fontWeight:700,fontSize:13,color:"#1a2540"}}>{COMPANY.name}</div>
                    <div style={{fontSize:10,color:"#555"}}>MST: {COMPANY.mst}</div>
                    <div style={{fontSize:10,color:"#555"}}>ĐT: {COMPANY.phone} | Email: {COMPANY.email}</div>
                    <div style={{fontSize:10,color:"#555"}}>{COMPANY.address}</div>
                  </td>
                </tr></tbody></table>
              </td>
              <td className="debt-header-right" style={{ width:"48%", verticalAlign:"top", textAlign:"center", paddingLeft:10 }}>
                <div style={{fontWeight:700,fontSize:12,whiteSpace:"nowrap"}}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                <div style={{fontWeight:600,fontSize:12,whiteSpace:"nowrap",marginTop:2}}>Độc lập – Tự do – Hạnh phúc</div>
                <div style={{fontSize:11,marginTop:2,letterSpacing:"-1px"}}>⸻⸻⸻</div>
              </td>
            </tr>
          </tbody>
        </table>
 
        <div className="debt-title">
          <h1>{T.title}</h1>
          <div style={{fontSize:12,color:"#555",marginTop:4}}>{T.titleB}</div>
          {refNum && <div className="ref">Số: {refNum}</div>}
          <div style={{fontSize:11,color:"#666",marginTop:2}}>
            Ngày lập: {dateStr} — Đối chiếu đến ngày: <strong>{toDateStr}</strong>
          </div>
        </div>
 
        <div className="debt-party-block">
          <p>{T.partyIntro} <strong>{dateStr}</strong>, {T.reconcileSentence} <strong>{toDateStr}</strong>:</p>
          <p style={{fontSize:11,color:"#555",marginTop:2}}>{T.partyIntroB} <strong>{dateStr}</strong>, {T.reconcileSentenceB} <strong>{toDateStr}</strong>。</p>
 
          <p style={{marginTop:8}}><strong>{T.seller}</strong></p>
          <p style={{fontSize:11,color:"#555",marginTop:2}}>{T.sellerB}</p>
          <table style={{width:"100%",fontSize:12,borderCollapse:"collapse",paddingLeft:16}}>
            <tbody>
              <tr>
                <td style={{width:"50%",paddingLeft:20,paddingBottom:2}}>{T.company} / {T.companyB}: <strong>{COMPANY.name}</strong></td>
                <td style={{paddingBottom:2}}>{T.tax} / {T.taxB}: {COMPANY.mst}</td>
              </tr>
              <tr>
                <td style={{paddingLeft:20,paddingBottom:2}}>{T.rep} / {T.repB}: <strong>{sellerRep || "……………………………"}</strong></td>
                <td style={{paddingBottom:2}}>{T.position} / {T.positionB}: {sellerTitle || "……………………"}</td>
              </tr>
            </tbody>
          </table>

          <p style={{marginTop:8}}><strong>{T.buyer}</strong></p>
          <p style={{fontSize:11,color:"#555",marginTop:2}}>{T.buyerB}</p>
          <table style={{width:"100%",fontSize:12,borderCollapse:"collapse"}}>
            <tbody>
              <tr>
                <td style={{width:"60%",paddingLeft:20,paddingBottom:2}}>{T.company} / {T.companyB}: <strong>{buyerName || "……………………………………………………"}</strong></td>
                <td style={{paddingBottom:2}}>{T.tax} / {T.taxB}: {buyerTax || "………………………"}</td>
              </tr>
              {buyerAddr && <tr><td colSpan={2} style={{paddingLeft:20,paddingBottom:2}}>{T.address} / {T.addressB}: {buyerAddr}</td></tr>}
              <tr>
                <td style={{paddingLeft:20,paddingBottom:2}}>{T.rep} / {T.repB}: <strong>{buyerRep || "……………………………"}</strong></td>
                <td style={{paddingBottom:2}}>{T.position} / {T.positionB}: {buyerTitle || "……………………"}</td>
              </tr>
            </tbody>
          </table>

          <p style={{marginTop:10}}>{T.reconcileSentence} <strong>{toDateStr}</strong>, {T.oweAmount} <strong>{buyerName || "Quý công ty"}</strong> {T.amountIs} <strong>{fmt(grandTotal)} đồng</strong>.</p>
          <p style={{fontSize:11,color:"#555",marginTop:2}}>{T.reconcileSentenceB} <strong>{toDateStr}</strong>, {T.oweAmountB} <strong>{buyerName || (debtLang === "vi_en" ? "Your company" : "贵公司")}</strong> {T.amountIsB} <strong>{fmt(grandTotal)} VND</strong>.</p>
        </div>

        <table className="debt-items-table">
          <thead>
            <tr>
              {T.invoiceHeaders.map(([vi, other], idx) => (
                <th key={idx} style={{
                  width: idx === 0 ? 36 : idx === 1 ? 120 : idx === 3 ? 45 : idx === 4 ? 40 : idx === 5 ? 85 : idx === 6 ? 65 : idx === 7 ? 95 : undefined,
                  textAlign: idx === 0 || idx === 3 || idx === 4 || idx === 6 ? "center" : idx === 5 || idx === 7 ? "right" : "left",
                  whiteSpace: "normal",
                  wordBreak: "break-word",
                  verticalAlign: "middle",
                  padding: "6px 5px"
                }}>
                  <div style={{lineHeight:1.2}}>{vi}</div>
                  <div style={{fontSize:10,color:"#555",marginTop:2,fontWeight:400,lineHeight:1.2}}>{other}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedInvoices.length === 0 ? (
              <tr>
                <td colSpan={8} style={{textAlign:"center",color:"#aaa",padding:"20px",fontStyle:"italic"}}>
                  <div>{T.noInvoices}</div>
                  <div style={{marginTop:4,fontSize:11,color:"#555"}}>{T.noInvoicesB}</div>
                </td>
              </tr>
            ) : sortedInvoices.map((inv) => {
              const rows = [];
              rows.push(
                <tr key={"inv-" + inv._id} style={{background:"#f0f4ff"}}>
                  <td colSpan={2} style={{fontWeight:700,fontSize:11,color:"#1a2540",padding:"6px 8px"}}>
                    {T.invoiceGroup} {inv.serial && <span style={{fontFamily:"monospace"}}>{inv.serial}</span>}
                    {inv.serial && inv.invoiceNumber ? " / " : ""}
                    {inv.invoiceNumber && <span style={{fontFamily:"monospace",marginLeft:2}}>{T.invoiceGroupB} {inv.invoiceNumber}</span>}
                  </td>
                  <td colSpan={2} style={{fontSize:11,color:"#555",padding:"6px 8px"}}>
                    {T.invoiceDateLabel} <strong>{inv.invoiceDate || "…"}</strong>
                    <div style={{fontSize:10,color:"#888",marginTop:2}}>{T.invoiceDateLabelB}</div>
                  </td>
                  <td colSpan={4} style={{textAlign:"right",fontSize:11,fontWeight:600,color:"#1a2540",padding:"6px 8px"}}>
                    {T.invoiceTotalLabel} {fmt(inv.grand)} đ
                    <div style={{fontSize:10,color:"#888",marginTop:2}}>{T.invoiceTotalLabelB}</div>
                  </td>
                </tr>
              );
              inv.items.forEach((it, iIdx) => {
                rowIdx++;
                const vatLbl = it.vatRate === -1 ? "KCT" : (it.vatRate || 0) + "%";
                rows.push(
                  <tr key={`it-${inv._id}-${iIdx}`}>
                    <td className="center" style={{fontSize:11,color:"#888"}}>{rowIdx}</td>
                    <td style={{fontSize:11,wordBreak:"break-word",padding:"5px 7px"}}>
                      {inv.serial || ""}{inv.serial && inv.invoiceNumber ? " / " : ""}{inv.invoiceNumber || ""}
                    </td>
                    <td style={{fontSize:11,wordBreak:"break-word",padding:"5px 7px"}}>
                      {it.name}
                    </td>
                    <td className="center" style={{fontSize:11}}>{it.unit}</td>
                    <td className="center" style={{fontSize:11}}>{it.qty !== 0 ? it.qty : "—"}</td>
                    <td className="right" style={{fontSize:11}}>{it.price ? fmt(it.price) : "—"}</td>
                    <td className="center" style={{fontSize:11,fontWeight:600}}>{vatLbl}</td>
                    <td className="right" style={{fontSize:11,fontWeight:500}}>{fmt(it.lineTotal + it.vatAmt)}</td>
                  </tr>
                );
                if (it.extraNote) {
                  rows.push(
                    <tr key={`note-${inv._id}-${iIdx}`}>
                      <td colSpan={2}></td>
                      <td colSpan={2} style={{padding:"0 7px 6px",borderTop:"none"}}>
                        <div style={{fontSize:10,color:"#000",fontStyle:"italic",background:"#fafbfd",border:"1px dashed #000",borderRadius:3,padding:"2px 6px"}}>
                          {it.extraNote}
                        </div>
                      </td>
                      <td colSpan={4}></td>
                    </tr>
                  );
                }
              });
              rows.push(
                <tr key={"sub-" + inv._id} className="debt-subtotal-row">
                  <td colSpan={6} style={{textAlign:"right",padding:"5px 8px",fontSize:11}}>
                    {T.invoiceSubtotalLabel} {fmt(inv.subtotal)} đ &nbsp;|&nbsp; {T.invoiceVatLabel} {fmt(inv.vatTotal)} đ
                    <div style={{fontSize:10,color:"#888",marginTop:2}}>{T.invoiceSubtotalLabelB} {fmt(inv.subtotal)} VND · {T.invoiceVatLabelB} {fmt(inv.vatTotal)} VND</div>
                  </td>
                  <td style={{textAlign:"right",fontWeight:700,fontSize:12,padding:"5px 8px",color:"#1a2540"}} colSpan={2}>
                    {T.invoiceGrandLabel} {fmt(inv.grand)} đ
                    <div style={{fontSize:10,color:"#888",marginTop:2}}>{T.invoiceGrandLabelB} {fmt(inv.grand)} VND</div>
                  </td>
                </tr>
              );
              return rows;
            })}

            {sortedInvoices.length > 0 && (
              <>
                <tr style={{background:"#eef0f8"}}>
                  <td colSpan={6} style={{textAlign:"right",fontWeight:600,padding:"6px 8px",fontSize:12}}>
                    {T.totalGoods}
                    <div style={{fontSize:11,color:"#555",marginTop:2}}>{T.totalGoodsB}</div>
                  </td>
                  <td colSpan={2} style={{textAlign:"right",fontWeight:600,padding:"6px 8px",fontSize:12}}>
                    {fmt(grandSubtotal)} đ
                  </td>
                </tr>
                <tr style={{background:"#eef0f8"}}>
                  <td colSpan={6} style={{textAlign:"right",fontWeight:600,padding:"6px 8px",fontSize:12}}>
                    {T.totalVat}
                    <div style={{fontSize:11,color:"#555",marginTop:2}}>{T.totalVatB}</div>
                  </td>
                  <td colSpan={2} style={{textAlign:"right",fontWeight:600,padding:"6px 8px",fontSize:12}}>
                    {fmt(grandVat)} đ
                  </td>
                </tr>
                <tr className="debt-grand-row">
                  <td colSpan={6} style={{textAlign:"right",padding:"8px 10px",fontSize:14}}>
                    {T.grandTotal}
                    <div style={{fontSize:11,color:"#555",marginTop:2}}>{T.grandTotalB}</div>
                  </td>
                  <td colSpan={2} style={{textAlign:"right",padding:"8px 10px",fontSize:15,letterSpacing:"0.02em"}}>
                    {fmt(grandTotal)} đ
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
 
        {sortedInvoices.length > 0 && (
          <div style={{marginTop:12,fontSize:12,lineHeight:1.8}}>
            <p>
              {T.totalDue} <strong>{toDateStr}</strong>, {COMPANY.name} {T.oweAmount} <strong>{buyerName || "Quý công ty"}</strong> {T.amountIs} <strong>{fmt(grandTotal)} đồng</strong>.
            </p>
            <p style={{fontSize:11,color:"#555",marginTop:2}}>
              {T.totalDueB} <strong>{toDateStr}</strong>, {COMPANY.name} {T.oweAmountB} <strong>{buyerName || (debtLang === "vi_en" ? "Your company" : "贵公司")}</strong> {T.amountIsB} <strong>{fmt(grandTotal)} VND</strong>。
            </p>
            <p style={{fontStyle:"italic",color:"#555",marginTop:8}}>
              {T.inWords} {numberToWordsVN(grandTotal)}
            </p>
            <p style={{fontSize:11,color:"#555",marginTop:4}}>
              {T.inWordsB} {debtLang === "vi_en" ? numberToWordsEN(grandTotal) : numberToWordsCN(grandTotal)}
            </p>
            <p style={{marginTop:8}}>
              {T.copiesNote}
              <br />
              <span style={{fontSize:11,color:"#555"}}>{T.copiesNoteB}</span>
            </p>
          </div>
        )}
 
        <div className="debt-sign" style={{marginTop:28}}>
          <div className="debt-sign-block">
            <div className="sign-title">{T.buyerSign}</div>
            <div style={{fontSize:11,color:"#666",fontStyle:"italic"}}>{T.signSubNote}</div>
            <div className="sign-space" />
            <div style={{fontWeight:600,borderBottom:buyerRep?"none":"1px solid #333",minWidth:160,display:"inline-block",minHeight:18}}>
              {buyerRep || ""}
            </div>
            {buyerTitle && <div style={{fontSize:11,color:"#666",marginTop:2}}>{buyerTitle}</div>}
            <div style={{fontSize:11,color:"#666"}}>{buyerName || ""}</div>
            <div style={{fontSize:11,color:"#555",marginTop:4}}>{T.buyerSignB}</div>
          </div>
          <div className="debt-sign-block">
            <div className="sign-title">{T.sellerSign}</div>
            <div style={{fontSize:11,color:"#666",fontStyle:"italic"}}>{T.signSubNote}</div>
            <div className="sign-space" />
            <div style={{fontWeight:600}}>{sellerRep || "……………………………"}</div>
            <div style={{fontSize:11,color:"#666"}}>{sellerTitle}</div>
            <div style={{fontSize:11,color:"#666"}}>{COMPANY.name}</div>
            <div style={{fontSize:11,color:"#555",marginTop:4}}>{T.sellerSignB}</div>
          </div>
        </div>
      </div>
    );
  };

  const renderPaymentRequest = () => {
    const T = DEBT_TEXT[debtLang];
    const payNum = "DNTT-" + (refNum ? refNum.replace(/^BBDCCN-/, "") : todayFull.replace(/ /g,"_"));
    return (
      <div className="debt-preview" id="debtPreviewContent">
        <table className="debt-header-table" style={{ width:"100%", tableLayout:"fixed", borderCollapse:"collapse", marginBottom:14 }}>
          <tbody>
            <tr>
              <td className="debt-header-left" style={{ width:"52%", verticalAlign:"top", borderRight:"2px solid #000", paddingRight:10 }}>
                <table style={{width:"100%", borderCollapse:"collapse"}}><tbody><tr>
                  <td style={{verticalAlign:"top",paddingRight:10,width:48}}>
                    <img src={getLogoUrl()} style={{width:48,height:48,objectFit:"contain"}} alt="Logo" />
                  </td>
                  <td style={{verticalAlign:"top"}}>
                    <div style={{fontWeight:700,fontSize:13,color:"#1a2540"}}>{COMPANY.name}</div>
                    <div style={{fontSize:10,color:"#555"}}>MST: {COMPANY.mst}</div>
                    <div style={{fontSize:10,color:"#555"}}>ĐT: {COMPANY.phone} | Email: {COMPANY.email}</div>
                    <div style={{fontSize:10,color:"#555"}}>{COMPANY.address}</div>
                  </td>
                </tr></tbody></table>
              </td>
              <td className="debt-header-right" style={{ width:"48%", verticalAlign:"top", textAlign:"center", paddingLeft:10 }}>
                <div style={{fontWeight:700,fontSize:12,whiteSpace:"nowrap"}}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                <div style={{fontWeight:600,fontSize:12,whiteSpace:"nowrap",marginTop:2}}>Độc lập – Tự do – Hạnh phúc</div>
                <div style={{fontSize:11,marginTop:2,letterSpacing:"-1px"}}>⸻⸻⸻</div>
              </td>
            </tr>
          </tbody>
        </table>
 
        <div className="debt-title">
          <h1>{T.paymentTitle}</h1>
          <div style={{fontSize:12,color:"#555",marginTop:4}}>{T.paymentTitleB}</div>
          <div className="ref">Số: {payNum}</div>
          <div style={{fontSize:11,color:"#666",marginTop:2}}>
            {T.paymentBasedOn} {refNum ? <strong>{T.paymentBasedOnB} {refNum}</strong> : <strong>{T.paymentBasedOnB}</strong>}
          </div>
          <div style={{fontSize:11,color:"#666",marginTop:2}}>
            {T.paymentInfo1} <strong>{dateStr}</strong>, {T.paymentInfo2}
          </div>
        </div>
 
        <div className="debt-party-block">
          <p>{T.paymentTo} / {T.paymentToB}:</p>
          <p style={{marginTop:4}}>{T.company} / {T.companyB}: <strong>{buyerName || "……………………………………………………"}</strong></p>
          {buyerAddr && <p style={{marginTop:2}}>{T.address} / {T.addressB}: {buyerAddr}</p>}
          <p style={{marginTop:2}}>{T.tax} / {T.taxB}: {buyerTax || "………………………"}</p>
 
          <p style={{marginTop:10}}>
            {T.paymentRequestNote} <strong>{COMPANY.name}</strong>.
          </p>
          <p style={{fontSize:11,color:"#555",marginTop:2}}>
            {T.paymentRequestNoteB} <strong>{COMPANY.name}</strong>.
          </p>
        </div>
 
        <table className="debt-items-table">
          <thead>
            <tr>
              <th style={{textAlign:"left"}}>{T.paymentContent}</th>
              <th style={{width:140}}>{T.paymentAmountHeader}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{fontSize:12,padding:"7px 10px"}}>
                {T.paymentGoods}
                <div style={{fontSize:10,color:"#555",marginTop:2}}>{T.paymentGoodsB}</div>
              </td>
              <td className="right" style={{fontSize:12,padding:"7px 10px"}}>{fmt(grandSubtotal)}</td>
            </tr>
            <tr>
              <td style={{fontSize:12,padding:"7px 10px"}}>
                {T.paymentVat}
                <div style={{fontSize:10,color:"#555",marginTop:2}}>{T.paymentVatB}</div>
              </td>
              <td className="right" style={{fontSize:12,padding:"7px 10px"}}>{fmt(grandVat)}</td>
            </tr>
            <tr className="debt-grand-row">
              <td style={{padding:"8px 10px",fontSize:14}}>
                {T.paymentTotal}
                <div style={{fontSize:11,color:"#555",marginTop:2}}>{T.paymentTotalB}</div>
              </td>
              <td className="right" style={{padding:"8px 10px",fontSize:15,letterSpacing:"0.02em"}}>{fmt(grandTotal)}</td>
            </tr>
          </tbody>
        </table>
 
        <div className="debt-sign" style={{marginTop:28}}>
          <div className="debt-sign-block">
            <div className="sign-title">{T.paymentBuyerSign}</div>
            <div style={{fontSize:11,color:"#666",fontStyle:"italic"}}>{T.signSubNote}</div>
            <div className="sign-space" />
            <div style={{fontWeight:600}}>{buyerRep || "……………………………"}</div>
            <div style={{fontSize:11,color:"#666"}}>{buyerTitle}</div>
          </div>
          <div className="debt-sign-block">
            <div className="sign-title">{T.paymentSellerSign}</div>
            <div style={{fontSize:11,color:"#666",fontStyle:"italic"}}>{T.signSubNote}</div>
            <div className="sign-space" />
            <div style={{fontWeight:600}}>{sellerRep || "……………………………"}</div>
            <div style={{fontSize:11,color:"#666"}}>{sellerTitle}</div>
            <div style={{fontSize:11,color:"#666"}}>{COMPANY.name}</div>
          </div>
        </div>
      </div>
    );
  };
 
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{maxWidth:1100}}>
        <div className="modal-header no-print">
          <span className="modal-title">💰 Biên bản đối chiếu công nợ</span>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <button className={`btn btn-sm ${viewMode==="form"?"btn-primary":"btn-ghost"}`}
              onClick={() => setViewMode("form")}>⚙️ Nhập liệu</button>
            <button className={`btn btn-sm ${viewMode==="preview"?"btn-primary":"btn-ghost"}`}
              onClick={() => setViewMode("preview")}>👁️ Xem trước</button>
            <button className="btn btn-sm btn-ghost"
              onClick={() => {
                if (onOpenPaymentRequest) {
                  onOpenPaymentRequest({
                    requestType: "debt_recon",
                    buyerName: customerName,
                    buyerTaxCode: taxCode,
                    buyerAddress: customerAddress,
                    buyerRep: buyerRep,
                    buyerPosition: buyerTitle,
                    debtReconNo: refNum,
                    debtReconDate: dateStr,
                    debtPeriod: periodText,
                    amount: grandClosingBalance,
                    reason: `Thanh toán số tiền công nợ theo Biên bản đối chiếu công nợ số ${refNum || "..."} ngày ${dateStr || "..."}`
                  });
                }
              }} 
              disabled={invoices.length===0}
              title="Tạo Giấy đề nghị thanh toán dựa trên biên bản này">🧾 Đề nghị thanh toán</button>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>
        </div>
 
        <div className="modal-body" style={{display:"flex",gap:0,padding:0,overflow:"hidden"}}>
          <div className="no-print" style={{
            width: viewMode==="preview" ? 0 : 340,
            minWidth: viewMode==="preview" ? 0 : 340,
            overflow:"hidden",
            transition:"width 0.2s, min-width 0.2s",
            borderRight:"1px solid #e5e3dc",
            overflowY:"auto",
            padding: viewMode==="preview" ? 0 : "16px 18px",
          }}>
            {viewMode === "form" && (
              <>
                <div style={{marginBottom:16}}>
                  <div className="section-title" style={{marginBottom:8}}>📂 Import hóa đơn XML</div>
                  <div className="debt-xml-dropzone"
                    onClick={() => fileRef.current && fileRef.current.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}>
                    <div style={{fontSize:28,marginBottom:6}}>🗂️</div>
                    <div style={{fontSize:13,color:"#555",fontWeight:500}}>Click hoặc kéo thả file XML</div>
                    <div style={{fontSize:11,color:"#aaa",marginTop:3}}>Hỗ trợ nhiều file cùng lúc · VNPT, MISA, FAST...</div>
                    <input ref={fileRef} type="file" accept=".xml,text/xml,application/xml" multiple style={{display:"none"}}
                      onChange={e => { handleFiles(e.target.files); e.target.value=""; }} />
                  </div>
                  {xmlError && <div style={{background:"#fee2e2",color:"#dc2626",padding:"8px 12px",borderRadius:6,fontSize:12,marginTop:8}}>{xmlError}</div>}
                </div>
 
                <div style={{marginBottom:16}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:8}}>
                    <div className="section-title" style={{marginBottom:0}}>🗂️ Danh sách biên bản đã lưu</div>
                    <div style={{display:"flex",gap:6}}>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={handleReloadSavedRecs}>🔄 Tải lại</button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={handleNewDebtRec}>🆕 Tạo mới</button>
                    </div>
                  </div>
                  {recListLoading ? (
                    <div style={{fontSize:12,color:"#666"}}>Đang tải danh sách...</div>
                  ) : savedRecs.length === 0 ? (
                    <div style={{fontSize:12,color:"#666"}}>Chưa có biên bản nào. Lưu biên bản để nó xuất hiện tại đây.</div>
                  ) : (
                    <div style={{display:"grid",gap:10,marginBottom:10}}>
                      {savedRecs.map(rec => (
                        <div key={rec.id} className="debt-invoice-card" style={{borderColor:rec.id===refNum?"#1a2540":"#e5e3dc"}}>
                          <div className="debt-invoice-card-header" style={{cursor:"pointer"}} onClick={() => { setRefNum(rec.id); loadSavedByRefNum(rec.id); }}>
                            <div>
                              <div className="inv-num" style={{fontSize:12,fontWeight:600}}>{rec.refNum}</div>
                              <div className="inv-date" style={{fontSize:11,color:"#888"}}>
                                {rec.buyerName ? `${rec.buyerName} · ` : ""}{rec.invoices?.length || 0} hóa đơn
                              </div>
                            </div>
                            <div style={{display:"flex",alignItems:"center",gap:8}}>
                              <div className="inv-total" style={{fontSize:12,fontWeight:600}}>{fmt((rec.invoices||[]).reduce((s,i)=>s+(i.grand||0),0))} đ</div>
                              <button type="button" className="btn btn-ghost btn-sm" style={{padding:"4px 8px"}} onClick={e => { e.stopPropagation(); handleDeleteDebtRec(rec.id); }}>
                                🗑️
                              </button>
                            </div>
                          </div>
                          <div style={{padding:"6px 10px",fontSize:11,color:"#555"}}>
                            Cập nhật: {new Date(rec.updatedAt||0).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
 
                {invoices.length > 0 && (
                  <div style={{marginBottom:16}}>
                    <div className="section-title" style={{marginBottom:6}}>
                      📋 {invoices.length} hóa đơn đã nhập
                      <span style={{fontSize:11,fontWeight:400,marginLeft:8,color:"#888"}}>Tổng: {fmt(grandTotal)} đ</span>
                    </div>
                    {invoices.map(inv => (
                      <div key={inv._id} className="debt-invoice-card">
                        <div className="debt-invoice-card-header" onClick={() => toggleExpand(inv._id)} style={{cursor:"pointer"}}>
                          <div>
                            <div className="inv-num">
                              {inv.serial && <span style={{fontFamily:"monospace",fontSize:11}}>{inv.serial}</span>}
                              {inv.serial && inv.invoiceNumber ? " / " : ""}
                              {inv.invoiceNumber && <span>No. {inv.invoiceNumber}</span>}
                            </div>
                            <div className="inv-date">📅 {inv.invoiceDate || "—"} · {inv.items.length} dòng hàng</div>
                          </div>
                          <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
                            <div className="inv-total">{fmt(inv.grand)} đ</div>
                            <button onClick={e => { e.stopPropagation(); removeInvoice(inv._id); }}
                              style={{background:"none",border:"none",color:"#dc2626",cursor:"pointer",fontSize:16,lineHeight:1,padding:"2px 4px",opacity:0.5}}
                              onMouseEnter={e => e.currentTarget.style.opacity="1"}
                              onMouseLeave={e => e.currentTarget.style.opacity="0.5"}
                              title="Xóa hóa đơn này">✕</button>
                            <span style={{color:"#aaa",fontSize:12}}>{expandedInv.has(inv._id)?"▲":"▼"}</span>
                          </div>
                        </div>
                        {expandedInv.has(inv._id) && (
                          <div style={{padding:"8px 10px",fontSize:11,background:"#fff"}}>
                            {inv.items.map((it, i) => (
                              <div key={i} style={{display:"flex",gap:6,padding:"3px 0",borderBottom:"1px solid #f0ede6",alignItems:"flex-start"}}>
                                <span style={{color:"#aaa",minWidth:16,textAlign:"right",flexShrink:0}}>{i+1}.</span>
                                <div style={{flex:1}}>
                                  <div style={{fontWeight:500,wordBreak:"break-word"}}>{it.name}</div>
                                  <div style={{color:"#888",fontSize:10,marginTop:1}}>
                                    {it.unit && `${it.unit} · `}SL: {it.qty} · {fmt(it.price)} đ ·&nbsp;
                                    VAT {it.vatRate === -1 ? "KCT" : it.vatRate + "%"} →&nbsp;
                                    <strong>{fmt(it.lineTotal + it.vatAmt)} đ</strong>
                                  </div>
                                  <input
                                    type="text"
                                    value={it.extraNote || ""}
                                    onChange={e => updateItemNote(inv._id, i, e.target.value)}
                                    placeholder="+ Thêm thông tin hiển thị trong biên bản..."
                                    style={{width:"100%",fontSize:10,padding:"3px 6px",marginTop:4,border:"1px dashed #ccc",borderRadius:4,outline:"none",boxSizing:"border-box"}}
                                  />
                                </div>
                              </div>
                            ))}
                            <div style={{marginTop:6,textAlign:"right",color:"#555",fontSize:11}}>
                              Hàng: {fmt(inv.subtotal)} · VAT: {fmt(inv.vatTotal)} · Tổng: <strong>{fmt(inv.grand)} đ</strong>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
 
                <div className="section-title" style={{marginBottom:8}}>📝 Thông tin biên bản</div>
                <div className="form-group">
                  <label>Ngôn ngữ song ngữ</label>
                  <select className="form-control" value={debtLang} onChange={e => setDebtLang(e.target.value)}>
                    <option value="vi_en">Việt - Anh</option>
                    <option value="vi_zh">Việt - Trung (giản thể)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Số biên bản</label>
                  <div style={{display:"flex",gap:6}}>
                    <input className="form-control" value={refNum} onChange={e => setRefNum(e.target.value)}
                      onBlur={e => loadSavedByRefNum(e.target.value)} placeholder="VD: BBDCCN-01/2026" />
                    <button type="button" className="btn btn-ghost btn-sm" title="Sinh số mới"
                      onClick={() => setRefNum(generateDebtRecNumber())}>🔄</button>
                  </div>
                  <div style={{marginTop:8,display:"flex",alignItems:"center",gap:8}}>
                    <button type="button" className="btn btn-success btn-sm" onClick={handleSaveDebtRec} disabled={saving}>
                      {saving ? "⏳ Đang lưu..." : "💾 Lưu biên bản"}
                    </button>
                    {saveMsg && <span style={{color:"#16a34a",fontSize:12}}>{saveMsg}</span>}
                  </div>
                </div>
                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label>Ngày lập</label>
                    <input className="form-control" value={dateStr} onChange={e => setDateStr(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Đối chiếu đến ngày</label>
                    <input className="form-control" value={toDateStr} onChange={e => setToDateStr(e.target.value)} />
                  </div>
                </div>
 
                <div className="section-title" style={{marginBottom:8}}>🏢 Bên bán (Bên A)</div>
                <div style={{background:"#f5f7fb",borderRadius:8,padding:"10px 12px",marginBottom:12,fontSize:12,color:"#555"}}>
                  <div style={{fontWeight:700,color:"#1a2540"}}>{T.company} / {T.companyB}</div>
                  <strong style={{color:"#1a2540"}}>{COMPANY.name}</strong><br/>
                  {T.tax} / {T.taxB}: {COMPANY.mst} · {T.address} / {T.addressB}: {COMPANY.address}
                </div>
                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label>{T.rep} / {T.repB}</label>
                    <input className="form-control" value={sellerRep} onChange={e => setSellerRep(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>{T.position} / {T.positionB}</label>
                    <input className="form-control" value={sellerTitle} onChange={e => setSellerTitle(e.target.value)} />
                  </div>
                </div>
 
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <div className="section-title" style={{marginBottom:0}}>🧑‍💼 {T.buyer} / {T.buyerB}</div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={handleAutoTranslate}
                    disabled={translating}
                    title="🌐 Tự động dịch tên & địa chỉ bên mua"
                  >
                    🌐 {translating ? "Đang dịch..." : "Tự động dịch"}
                  </button>
                </div>
                <div style={{fontSize:11,color:"#888",marginBottom:8}}>
                  💡 Tự động điền từ file XML — có thể chỉnh sửa
                </div>
                <div className="form-group">
                  <label>{T.company} / {T.companyB}</label>
                  <input className="form-control" value={buyerName} onChange={e => setBuyerName(e.target.value)} placeholder={T.companyB} />
                </div>
                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label>{T.tax} / {T.taxB}</label>
                    <input className="form-control" value={buyerTax} onChange={e => setBuyerTax(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>{T.address} / {T.addressB}</label>
                    <input className="form-control" value={buyerAddr} onChange={e => setBuyerAddr(e.target.value)} />
                  </div>
                </div>
                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label>{T.rep} / {T.repB}</label>
                    <input className="form-control" value={buyerRep} onChange={e => setBuyerRep(e.target.value)} placeholder={T.repB} />
                  </div>
                  <div className="form-group">
                    <label>{T.position} / {T.positionB}</label>
                    <input className="form-control" value={buyerTitle} onChange={e => setBuyerTitle(e.target.value)} placeholder={T.positionB} />
                  </div>
                </div>
              </>
            )}
          </div>
 
          <div style={{flex:1,overflowY:"auto",padding:"16px",background:"#f9f8f5"}}>
            <div style={{maxWidth:794,margin:"0 auto",boxShadow:"0 2px 16px rgba(0,0,0,0.10)",borderRadius:4}}>
              {viewMode === "payment" ? renderPaymentRequest() : renderPreview()}
            </div>
          </div>
        </div>
 
        <div className="modal-footer no-print">
          <button className="btn btn-ghost" onClick={onClose}>Đóng</button>
          <div style={{flex:1}} />
          {invoices.length === 0 && (
            <span style={{fontSize:12,color:"#aaa",alignSelf:"center"}}>⚠️ Import ít nhất 1 file XML để xuất</span>
          )}
          <button className="btn btn-ghost" onClick={handlePDFClick} disabled={pdfLoading || invoices.length === 0} style={{minWidth:120}}>
            {pdfLoading ? "⏳ Đang tạo..." : "📄 Xuất PDF"}
          </button>
          <button className="btn btn-ghost" onClick={handleWordClick} disabled={wordLoading || invoices.length === 0} style={{minWidth:120}}>
            {wordLoading ? "⏳ Đang tạo..." : "📝 Xuất Word"}
          </button>
          <button className="btn btn-primary" onClick={handlePrint} disabled={invoices.length === 0}>
            🖨️ In
          </button>
        </div>
      </div>
    </div>
  );
}
