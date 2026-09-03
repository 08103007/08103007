import React, { useState, useEffect } from 'react';
import { loadHandover, saveHandover, COMPANY, getLogoUrl, showToast } from '../utils/gasStore';
import { generateId } from '../utils/helpers';
import { printElementViaIframe, exportElementToPdf } from '../utils/pdfExporter';
import { 
  buildDocxBlob, dxPara, dxBi, dxCell, dxHeaderCell, dxRow, dxTable, 
  dxNoBorderTable, dxNoBorderCell, downloadBlob 
} from '../utils/docxBuilder';

const TEMPLATE_T = {
  vi: {
    docTitle: "PHIẾU GIAO HÀNG KIÊM BIÊN BẢN BÀN GIAO & NGHIỆM THU",
    docSub: "",
    codeLabel: "Mã chứng từ",
    dateLabel: "Ngày lập",
    orderRefLabel: "Theo ĐH/HĐ số",
    copyLabel: "(Liên 1: Lưu - Liên 2: Giao Khách hàng)",
    timeLabel: "Thời gian giao & nghiệm thu",
    
    sec1Title: "I. THÔNG TIN CÁC BÊN GIAO NHẬN",
    partyATitle: "ĐƠN VỊ GIAO HÀNG (BÊN A)",
    partyBTitle: "ĐƠN VỊ NHẬN HÀNG (BÊN B)",
    unitLabel: "Đơn vị",
    delivererLabel: "Người giao",
    receiverLabel: "Người nhận",
    phoneLabel: "Số ĐT",
    phoneIdLabel: "Số ĐT/CCCD",
    installLocLabel: "Vị trí lắp đặt",

    sec2Title: "II. CHI TIẾT HÀNG HÓA BÀN GIAO",
    colStt: "STT",
    colName: "Tên hàng hóa, quy cách kỹ thuật",
    colUnit: "ĐVT",
    colQty: "SL",
    colSerial: "Số S/N\n(Nếu có)",
    colNote: "Ghi chú",
    totalQtyLabel: "TỔNG CỘNG SỐ LƯỢNG THIẾT BỊ / VẬT TƯ:",
    matchingNote: "(Khớp 100% so với đơn hàng)",

    sec3Title: "III. NỘI DUNG ĐÁNH GIÁ & KẾT LUẬN NGHIỆM THU",
    crit1Title: "1. Kiểm tra số lượng, chủng loại:",
    crit1Pass: "Đúng & đủ 100% chủng loại theo đơn hàng hoặc hợp đồng.",
    crit1Fail: "Có sai lệch (ghi chú rõ tại mục ghi chú).",
    
    crit2Title: "2. Kiểm tra quy cách đóng gói & ngoại quan:",
    crit2Pass: "Thiết bị mới 100%, không móp méo, trầy xước.",
    crit2Fail: "Bao bì rách vỡ / có dấu hiệu cạy mở.",

    crit3Title: "3. Kiểm tra lắp đặt & vận hành chạy thử:",
    crit3Pass: "Thiết bị vận hành ổn định, thông số đạt yêu cầu.",
    crit3Fail: "Chưa đạt yêu cầu kỹ thuật (cần hiệu chỉnh).",

    crit4Title: "4. Đánh giá chung & Kết luận bàn giao:",
    crit4Pass: "ĐỒNG Ý NGHIỆM THU VÀ BÀN GIAO toàn bộ số hàng hóa trên để đưa vào sử dụng chính thức.",

    notesCommitTitle: "Ghi chú & Cam kết trách nhiệm:",
    commit1: "Kể từ thời điểm ký biên bản này, quyền quản lý và sử dụng hàng hóa được chuyển giao cho Bên B. Bên B có trách nhiệm bảo quản thiết bị theo quy định.",
    commit2: "Bên A cam kết thực hiện đúng chế độ bảo hành theo tiêu chuẩn nhà sản xuất kể từ ngày ký biên bản nghiệm thu.",
    commit3: "Biên bản này được lập thành 02 bản có giá trị pháp lý như nhau, mỗi bên giữ 01 bản làm căn cứ thanh toán và thực hiện nghĩa vụ bảo hành.",

    signReceiver: "ĐẠI DIỆN BÊN NHẬN",
    signDeliverer: "ĐẠI DIỆN BÊN GIAO",
    signSub: "(Ký, ghi rõ họ tên & đóng dấu)"
  },

  vi_en: {
    docTitle: "PHIẾU GIAO HÀNG KIÊM BIÊN BẢN BÀN GIAO & NGHIỆM THU",
    docSub: "(Delivery Receipt & Handover - Acceptance Report)",
    codeLabel: "Mã chứng từ / Doc No.",
    dateLabel: "Ngày lập / Date",
    orderRefLabel: "Theo ĐH/HĐ số / Ref Order/Contract No.",
    copyLabel: "(Liên 1: Lưu - Liên 2: Giao Khách hàng / Copy 1: Issuer - Copy 2: Customer)",
    timeLabel: "Thời gian giao & nghiệm thu / Handover Time & Date",
    
    sec1Title: "I. THÔNG TIN CÁC BÊN GIAO NHẬN / DELIVERY & RECEPTION PARTIES INFORMATION",
    partyATitle: "ĐƠN VỊ GIAO HÀNG (BÊN A) / DELIVERER (PARTY A)",
    partyBTitle: "ĐƠN VỊ NHẬN HÀNG (BÊN B) / RECEIVER (PARTY B)",
    unitLabel: "Đơn vị / Company",
    delivererLabel: "Người giao / Delivered by",
    receiverLabel: "Người nhận / Received by",
    phoneLabel: "Số ĐT / Phone",
    phoneIdLabel: "Số ĐT/CCCD / Phone/ID",
    installLocLabel: "Vị trí lắp đặt / Install Location",

    sec2Title: "II. CHI TIẾT HÀNG HÓA BÀN GIAO / HANDOVER GOODS & SPECIFICATIONS",
    colStt: "STT\nNO.",
    colName: "Tên hàng hóa, quy cách kỹ thuật\nItem description & specifications",
    colUnit: "ĐVT\nUnit",
    colQty: "SL\nQty",
    colSerial: "Số S/N (Nếu có)\nSerial No. (If any)",
    colNote: "Ghi chú\nNote",
    totalQtyLabel: "TỔNG CỘNG SỐ LƯỢNG THIẾT BỊ / VẬT TƯ (TOTAL QUANTITY):",
    matchingNote: "(Khớp 100% so với đơn hàng / 100% matching order)",

    sec3Title: "III. NỘI DUNG ĐÁNH GIÁ & KẾT LUẬN NGHIỆM THU / EVALUATION & ACCEPTANCE CONCLUSION",
    crit1Title: "1. Kiểm tra số lượng, chủng loại / Quantity & specification inspection:",
    crit1Pass: "Đúng & đủ 100% chủng loại theo đơn hàng hoặc hợp đồng. / 100% matching order/contract.",
    crit1Fail: "Có sai lệch (ghi chú rõ tại mục ghi chú). / Discrepancies noted in remarks.",
    
    crit2Title: "2. Kiểm tra quy cách đóng gói & ngoại quan / Packaging & appearance inspection:",
    crit2Pass: "Thiết bị mới 100%, không móp méo, trầy xước. / 100% brand new, no scratches or dents.",
    crit2Fail: "Bao bì rách vỡ / có dấu hiệu cạy mở. / Damaged package / sign of tampering.",

    crit3Title: "3. Kiểm tra lắp đặt & vận hành chạy thử / Installation & test run inspection:",
    crit3Pass: "Thiết bị vận hành ổn định, thông số đạt yêu cầu. / Operates stably, parameters meet specs.",
    crit3Fail: "Chưa đạt yêu cầu kỹ thuật (cần hiệu chỉnh). / Below specs (requires calibration).",

    crit4Title: "4. Đánh giá chung & Kết luận bàn giao / Overall evaluation & handover conclusion:",
    crit4Pass: "ĐỒNG Ý NGHIỆM THU VÀ BÀN GIAO toàn bộ số hàng hóa trên để đưa vào sử dụng chính thức. / AGREE TO ACCEPT AND HANDOVER all goods above for official use.",

    notesCommitTitle: "Ghi chú & Cam kết trách nhiệm / Notes & Commitments:",
    commit1: "Kể từ thời điểm ký biên bản này, quyền quản lý và sử dụng hàng hóa được chuyển giao cho Bên B. Bên B có trách nhiệm bảo quản thiết bị theo quy định. / From the signing moment, management and usage rights are transferred to Party B. Party B is responsible for preserving the equipment as regulated.",
    commit2: "Bên A cam kết thực hiện đúng chế độ bảo hành theo tiêu chuẩn nhà sản xuất kể từ ngày ký biên bản nghiệm thu. / Party A commits to complying with warranty policies in accordance with manufacturer standards from the date of signing the acceptance minute.",
    commit3: "Biên bản này được lập thành 02 bản có giá trị pháp lý như nhau, mỗi bên giữ 01 bản làm căn cứ thanh toán và thực hiện nghĩa vụ bảo hành. / Made in 02 copies of equal legal validity, each party keeping 01 copy for payment and warranty purposes.",

    signReceiver: "ĐẠI DIỆN BÊN NHẬN (RECEIVER)",
    signDeliverer: "ĐẠI DIỆN BÊN GIAO (DELIVERER)",
    signSub: "(Ký, ghi rõ họ tên & đóng dấu / Sign, Full Name & Seal)"
  },

  vi_zh: {
    docTitle: "PHIẾU GIAO HÀNG KIÊM BIÊN BẢN BÀN GIAO & NGHIỆM THU",
    docSub: "(送货单兼交接验收记录)",
    codeLabel: "Mã chứng từ / 单据编号",
    dateLabel: "Ngày lập / 开单日期",
    orderRefLabel: "Theo ĐH/HĐ số / 依据订单/合同号",
    copyLabel: "(Liên 1: Lưu - Liên 2: Giao Khách hàng / 第一联: 存根 - 第二联: 客户联)",
    timeLabel: "Thời gian giao & nghiệm thu / 交接与验收时间",
    
    sec1Title: "I. THÔNG TIN CÁC BÊN GIAO NHẬN / 收发双方信息",
    partyATitle: "ĐƠN VỊ GIAO HÀNG (BÊN A) / 送货方 (甲方)",
    partyBTitle: "ĐƠN VỊ NHẬN HÀNG (BÊN B) / 收货方 (乙方)",
    unitLabel: "Đơn vị / 单位",
    delivererLabel: "Người giao / 送货人",
    receiverLabel: "Người nhận / 收货人",
    phoneLabel: "Số ĐT / 电话",
    phoneIdLabel: "Số ĐT/CCCD / 电话/身份证",
    installLocLabel: "Vị trí lắp đặt / 安装位置",

    sec2Title: "II. CHI TIẾT HÀNG HÓA BÀN GIAO / 交接货物明细",
    colStt: "STT\n序号",
    colName: "Tên hàng hóa, quy cách kỹ thuật\n货物名称及技术规格",
    colUnit: "ĐVT\n单位",
    colQty: "SL\n数量",
    colSerial: "Số S/N (Nếu có)\n序列号 (如有)",
    colNote: "Ghi chú\n备注",
    totalQtyLabel: "TỔNG CỘNG SỐ LƯỢNG THIẾT BỊ / VẬT TƯ (设备/物资总数):",
    matchingNote: "(Khớp 100% so với đơn hàng / 与订单100%相符)",

    sec3Title: "III. NỘI DUNG ĐÁNH GIÁ & KẾT LUẬN NGHIỆM THU / 验收评估与交接结论",
    crit1Title: "1. Kiểm tra số lượng, chủng loại / 数量与规格检验:",
    crit1Pass: "Đúng & đủ 100% chủng loại theo đơn hàng hoặc hợp đồng. / 数量与规格100%相符。",
    crit1Fail: "Có sai lệch (ghi chú rõ tại mục ghi chú). / 有偏差 (见备注说明)。",
    
    crit2Title: "2. Kiểm tra quy cách đóng gói & ngoại quan / 包装与外观检验:",
    crit2Pass: "Thiết bị mới 100%, không móp méo, trầy xước. / 设备100%全新，无变形划伤。",
    crit2Fail: "Bao bì rách vỡ / có dấu hiệu cạy mở. / 包装破损 / 有拆封痕迹。",

    crit3Title: "3. Kiểm tra lắp đặt & vận hành chạy thử / 安装与试运行检验:",
    crit3Pass: "Thiết bị vận hành ổn định, thông số đạt yêu cầu. / 运行平稳，参数符合要求。",
    crit3Fail: "Chưa đạt yêu cầu kỹ thuật (cần hiệu chỉnh). / 未达技术要求 (需校准)。",

    crit4Title: "4. Đánh giá chung & Kết luận bàn giao / 综合评估与交接结论:",
    crit4Pass: "ĐỒNG Ý NGHIỆM THU VÀ BÀN GIAO toàn bộ số hàng hóa trên để đưa vào sử dụng chính thức. / 同意验收并交接全部上述货物正式投入使用。",

    notesCommitTitle: "Ghi chú & Cam kết trách nhiệm / 备注与责任承诺:",
    commit1: "Kể từ thời điểm ký biên bản này, quyền quản lý và sử dụng hàng hóa được chuyển giao cho Bên B. Bên B có trách nhiệm bảo quản thiết bị theo quy định. / 自签署本记录之日起，货物的管理与使用权移交乙方。乙方有责任按规定保管设备。",
    commit2: "Bên A cam kết thực hiện đúng chế độ bảo hành theo tiêu chuẩn nhà sản xuất kể từ ngày ký biên bản nghiệm thu. / 甲方承诺自签署验收记录之日起按制造商标准执行保修制度。",
    commit3: "Biên bản này được lập thành 02 bản có giá trị pháp lý như nhau, mỗi bên giữ 01 bản làm căn cứ thanh toán và thực hiện nghĩa vụ bảo hành. / 本记录一式02份，具有同等法律效力，双方各执01份作为付款及保修依据。",

    signReceiver: "ĐẠI DIỆN BÊN NHẬN (收货方)",
    signDeliverer: "ĐẠI DIỆN BÊN GIAO (送货方)",
    signSub: "(Ký, ghi rõ họ tên & đóng dấu / 签字、注明全名并盖章)"
  }
};

export default function HandoverModal({ quote, onClose }) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const defaultDate = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
  const defaultTime = `09 giờ 30 phút, ngày ${pad(now.getDate())} tháng ${pad(now.getMonth() + 1)} năm ${now.getFullYear()}`;

  const [lang, setLang] = useState("vi");
  const [translating, setTranslating] = useState(false);

  // General Header & Meta
  const [refNum, setRefNum] = useState(() => `PGH-${now.getFullYear()}/${pad(now.getMonth() + 1)}-${quote?.quoteNumber?.replace(/[^0-9]/g,"")?.slice(-4) || "0482"}`);
  const [dateStr, setDateStr] = useState(defaultDate);
  const [contractRefNum, setContractRefNum] = useState(() => quote?.quoteNumber || "");
  const [deliveryTime, setDeliveryTime] = useState(defaultTime);
  const [deliveryTimeEn, setDeliveryTimeEn] = useState("");

  // Party A (Deliverer) - Auto from COMPANY / Staff
  const [delivererCompany, setDelivererCompany] = useState(COMPANY.name || "CÔNG TY TNHH MÁY TÍNH PHÚ MỸ");
  const [delivererCompanyEn, setDelivererCompanyEn] = useState("");
  const [delivererName, setDelivererName] = useState(quote?.staffName || "Trần Văn Thịnh");
  const [delivererPhone, setDelivererPhone] = useState(COMPANY.phone || "0922.872.872 - 0907.125.966");

  // Party B (Receiver) - Auto from quote
  const [receiverCompany, setReceiverCompany] = useState(quote?.customer || "");
  const [receiverCompanyEn, setReceiverCompanyEn] = useState("");
  const [receiverName, setReceiverName] = useState(quote?.contactPerson || "");
  const [receiverTitle, setReceiverTitle] = useState(quote?.position || "");
  const [receiverTitleEn, setReceiverTitleEn] = useState("");
  const [receiverPhone, setReceiverPhone] = useState(quote?.phone || "");
  
  // Install Location (empty by default, only shown when filled)
  const [installLocation, setInstallLocation] = useState(quote?.installLocation || "");
  const [installLocationEn, setInstallLocationEn] = useState("");

  // Items
  const [items, setItems] = useState(() => {
    if (quote && Array.isArray(quote.items) && quote.items.length > 0) {
      return quote.items.map((it) => ({
        id: it.id || generateId(),
        name: it.name || "",
        nameEn: "",
        unit: it.unit || "Bộ",
        qty: it.qty || 1,
        serialNo: it.serialNo || "",
        note: ""
      }));
    }
    return [
      { id: generateId(), name: "Máy chủ Dell PowerEdge R750\nXeon Gold 6330 / 64GB RAM / 2x960GB SSD Enterprise", nameEn: "", unit: "Bộ", qty: 1, serialNo: "", note: "" },
      { id: generateId(), name: "Switch Cisco Catalyst C9200L-24P-4G-E\n24 Port PoE+, 4x1G SFP Uplink", nameEn: "", unit: "Chiếc", qty: 2, serialNo: "", note: "" },
      { id: generateId(), name: "Bộ lưu điện APC Smart-UPS SRT 3000VA\nOn-Line 230V, LCD, Rack/Tower 3U", nameEn: "", unit: "Bộ", qty: 1, serialNo: "", note: "" },
      { id: generateId(), name: "Thùng cáp mạng CommScope Cat6 UTP\nMã 1427071-6, cuộn 305m chính hãng", nameEn: "", unit: "Cuộn", qty: 4, serialNo: "", note: "" }
    ];
  });

  // Criteria Checkboxes
  const [crit1, setCrit1] = useState("pass");
  const [crit2, setCrit2] = useState("pass");
  const [crit3, setCrit3] = useState("pass");
  const [crit4, setCrit4] = useState("pass");

  const [pdfLoading, setPdfLoading]   = useState(false);
  const [wordLoading, setWordLoading] = useState(false);
  const [saving, setSaving]           = useState(false);
  const [saveMsg, setSaveMsg]         = useState("");

  const storageId = quote ? ("hw_" + quote.id) : null;

  const addItem = () => setItems(prev => [...prev, { id: generateId(), name: "", nameEn: "", unit: "Bộ", qty: 1, serialNo: "", note: "" }]);
  const removeItem = (id) => setItems(prev => prev.filter(it => it.id !== id));
  const setItemField = (id, field, val) => setItems(prev => prev.map(it => it.id === id ? { ...it, [field]: val } : it));

  // Load saved state
  useEffect(() => {
    if (!storageId) return;
    loadHandover(storageId).then(saved => {
      if (!saved) return;
      if (saved.lang) setLang(saved.lang);
      if (saved.refNum) setRefNum(saved.refNum);
      if (saved.dateStr) setDateStr(saved.dateStr);
      if (saved.contractRefNum) setContractRefNum(saved.contractRefNum);
      if (saved.deliveryTime) setDeliveryTime(saved.deliveryTime);
      if (saved.deliveryTimeEn) setDeliveryTimeEn(saved.deliveryTimeEn);

      if (saved.delivererCompany) setDelivererCompany(saved.delivererCompany);
      if (saved.delivererCompanyEn) setDelivererCompanyEn(saved.delivererCompanyEn);
      if (saved.delivererName) setDelivererName(saved.delivererName);
      if (saved.delivererPhone) setDelivererPhone(saved.delivererPhone);

      if (saved.receiverCompany) setReceiverCompany(saved.receiverCompany);
      if (saved.receiverCompanyEn) setReceiverCompanyEn(saved.receiverCompanyEn);
      if (saved.receiverName !== undefined) setReceiverName(saved.receiverName);
      if (saved.receiverTitle !== undefined) setReceiverTitle(saved.receiverTitle);
      if (saved.receiverTitleEn !== undefined) setReceiverTitleEn(saved.receiverTitleEn);
      if (saved.receiverPhone !== undefined) setReceiverPhone(saved.receiverPhone);
      if (saved.installLocation !== undefined) setInstallLocation(saved.installLocation);
      if (saved.installLocationEn !== undefined) setInstallLocationEn(saved.installLocationEn);

      if (saved.crit1) setCrit1(saved.crit1);
      if (saved.crit2) setCrit2(saved.crit2);
      if (saved.crit3) setCrit3(saved.crit3);
      if (saved.crit4) setCrit4(saved.crit4);

      if (Array.isArray(saved.items) && saved.items.length > 0) {
        setItems(saved.items);
      }
    }).catch(() => {});
  }, [storageId]);

  const handleSave = async () => {
    if (!storageId) { showToast("⚠️ Cần mở biên bản từ một báo giá để lưu trữ", 2500); return; }
    setSaving(true);
    try {
      await saveHandover(storageId, {
        lang, refNum, dateStr, contractRefNum, deliveryTime, deliveryTimeEn,
        delivererCompany, delivererCompanyEn, delivererName, delivererPhone,
        receiverCompany, receiverCompanyEn, receiverName, receiverTitle, receiverTitleEn, receiverPhone,
        installLocation, installLocationEn,
        items, crit1, crit2, crit3, crit4
      });
      setSaveMsg("✓ Đã lưu");
      setTimeout(() => setSaveMsg(""), 2000);
      showToast("💾 Đã lưu thành công chứng từ!", 2000);
    } finally {
      setSaving(false);
    }
  };

  const handleAutoTranslate = async () => {
    if (lang === "vi") {
      showToast("💡 Vui lòng chuyển sang chế độ Song ngữ (Việt - Anh hoặc Việt - Trung) trước khi dịch", 3000);
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
      } catch {
        return str;
      }
    };

    try {
      if (deliveryTime) setDeliveryTimeEn(await translateStr(deliveryTime));
      if (receiverTitle) setReceiverTitleEn(await translateStr(receiverTitle));
      if (installLocation) setInstallLocationEn(await translateStr(installLocation));

      const updated = await Promise.all(items.map(async it => ({
        ...it,
        nameEn: it.name ? await translateStr(it.name) : it.nameEn
      })));
      setItems(updated);
      showToast("🌐 Đã tự động dịch song ngữ toàn bộ chứng từ!", 3000);
    } catch {
      showToast("⚠️ Lỗi dịch tự động", 3000);
    } finally {
      setTranslating(false);
    }
  };

  const handlePrint = () => {
    printElementViaIframe("handoverPreviewContent", `
      #handoverPreviewContent { width:100% !important; max-width:100% !important; padding:0 !important; margin:0 !important; font-family:'Plus Jakarta Sans',sans-serif !important; }
      table { width:100% !important; border-collapse:collapse !important; }
    `);
  };

  const handlePDF = async () => {
    setPdfLoading(true);
    try {
      await exportElementToPdf("handoverPreviewContent", {
        filename: `${refNum || "PGH_BBBG"}.pdf`,
        pad: 20
      });
    } finally {
      setPdfLoading(false);
    }
  };

  const totalQty = items.reduce((acc, it) => acc + (Number(it.qty) || 0), 0);
  const totalQtyStr = String(totalQty).padStart(2, "0");

  const T = TEMPLATE_T[lang] || TEMPLATE_T.vi;

  const handleWord = async () => {
    setWordLoading(true);
    try {
      const totalW = 9000;
      const colW = [600, 4200, 800, 800, 1300, 1300];

      // Header company & meta
      const compInfo = [
        dxPara([{ text: COMPANY.name, bold: true, size: 20 }]),
        dxPara([{ text: `Địa chỉ: ${COMPANY.address}`, size: 16, color: "555555" }]),
        dxPara([{ text: `ĐT: ${COMPANY.phone} | Email: ${COMPANY.email}`, size: 16, color: "555555" }])
      ];

      const metaInfo = [
        dxPara([{ text: `${T.codeLabel}: `, bold: true, size: 16 }, { text: refNum, bold: true, color: "991B1B", size: 17 }], { align: "right" }),
        dxPara([{ text: `${T.dateLabel}: `, size: 16 }, { text: dateStr, bold: true, size: 16 }], { align: "right" }),
        dxPara([{ text: `${T.orderRefLabel}: `, size: 16 }, { text: contractRefNum, bold: true, size: 16 }], { align: "right" }),
        dxPara([{ text: T.copyLabel, italic: true, size: 14, color: "666666" }], { align: "right" })
      ];

      const headerTable = dxNoBorderTable([
        dxRow([dxNoBorderCell(compInfo, 5000), dxNoBorderCell(metaInfo, 4000)])
      ], totalW);

      const titlePara = dxPara([{ text: T.docTitle, bold: true, color: "111827" }], { align: "center", size: 28, spaceBefore: 80, spaceAfter: 20 });
      const titleSub = (lang !== "vi" && T.docSub) ? dxPara([{ text: T.docSub, italic: true, color: "4B5563" }], { align: "center", size: 18, spaceAfter: 30 }) : "";
      
      const timePara = dxPara([
        { text: `${T.timeLabel}: `, size: 17 },
        { text: deliveryTime, bold: true, size: 17 },
        ...(lang !== "vi" && deliveryTimeEn ? [{ text: ` / ${deliveryTimeEn}`, italic: true, color: "555555" }] : [])
      ], { align: "center", size: 17, spaceAfter: 100 });

      // Sec 1: 2 Boxes
      const sec1Head = dxPara([{ text: T.sec1Title, bold: true, color: "1E3A8A" }], { size: 19, spaceBefore: 60, spaceAfter: 40 });

      const partyACellContent = [
        dxPara([{ text: T.partyATitle, bold: true, color: "1F2937", size: 17 }], { spaceAfter: 30 }),
        dxPara([{ text: `• ${T.unitLabel}: `, bold: true }, { text: delivererCompany }, ...(lang !== "vi" && delivererCompanyEn ? [{ text: ` / ${delivererCompanyEn}`, italic: true }] : [])], { size: 16, spaceAfter: 20 }),
        dxPara([{ text: `• ${T.delivererLabel}: `, bold: true }, { text: delivererName, bold: true }], { size: 16, spaceAfter: 20 }),
        dxPara([{ text: `• ${T.phoneLabel}: `, bold: true }, { text: delivererPhone }], { size: 16 })
      ];

      const receiverDisplay = receiverName ? `${receiverName}${receiverTitle ? ` (${receiverTitle})` : ""}` : "…………………………………………";

      const partyBCellContent = [
        dxPara([{ text: T.partyBTitle, bold: true, color: "1F2937", size: 17 }], { spaceAfter: 30 }),
        dxPara([{ text: `• ${T.unitLabel}: `, bold: true }, { text: receiverCompany || "…………………………………………" }, ...(lang !== "vi" && receiverCompanyEn ? [{ text: ` / ${receiverCompanyEn}`, italic: true }] : [])], { size: 16, spaceAfter: 20 }),
        dxPara([{ text: `• ${T.receiverLabel}: `, bold: true }, { text: receiverDisplay }], { size: 16, spaceAfter: 20 }),
        dxPara([{ text: `• ${T.phoneIdLabel}: `, bold: true }, { text: receiverPhone || "…………………………………………" }], { size: 16, spaceAfter: (installLocation ? 20 : 0) }),
        ...(installLocation ? [
          dxPara([{ text: `• ${T.installLocLabel}: `, bold: true }, { text: installLocation }, ...(lang !== "vi" && installLocationEn ? [{ text: ` / ${installLocationEn}`, italic: true }] : [])], { size: 16 })
        ] : [])
      ];

      const partiesTable = dxTable([
        dxRow([dxCell(partyACellContent, 4500), dxCell(partyBCellContent, 4500)])
      ], totalW);

      // Sec 2: Items Table
      const sec2Head = dxPara([{ text: T.sec2Title, bold: true, color: "1E3A8A" }], { size: 19, spaceBefore: 100, spaceAfter: 40 });

      const headerRow = dxRow([
        dxHeaderCell(T.colStt, "", colW[0]),
        dxHeaderCell(T.colName, "", colW[1]),
        dxHeaderCell(T.colUnit, "", colW[2]),
        dxHeaderCell(T.colQty, "", colW[3]),
        dxHeaderCell(T.colSerial, "", colW[4]),
        dxHeaderCell(T.colNote, "", colW[5])
      ], { header: true });

      const itemRows = items.map((it, idx) => {
        const nameRuns = [{ text: it.name, bold: true }];
        if (lang !== "vi" && it.nameEn) {
          nameRuns.push({ text: `\n${it.nameEn}`, italic: true, color: "555555" });
        }
        return dxRow([
          dxCell(dxPara(String(idx + 1), { align: "center", size: 17 }), colW[0]),
          dxCell(dxPara(nameRuns, { size: 17 }), colW[1]),
          dxCell(dxPara(it.unit || "Bộ", { align: "center", size: 17 }), colW[2]),
          dxCell(dxPara(String(it.qty || 1).padStart(2, "0"), { align: "center", bold: true, size: 17 }), colW[3]),
          dxCell(dxPara(it.serialNo || "-", { align: "center", size: 16, color: "555555" }), colW[4]),
          dxCell(dxPara(it.note || "", { size: 16, color: "555555" }), colW[5])
        ]);
      });

      const totalRow = dxRow([
        dxCell(dxPara([{ text: `${T.totalQtyLabel} `, bold: true }, { text: totalQtyStr, bold: true, size: 18 }], { align: "right" }), colW[0] + colW[1] + colW[2]),
        dxCell(dxPara([{ text: totalQtyStr, bold: true, size: 18 }], { align: "center" }), colW[3]),
        dxCell(dxPara([{ text: T.matchingNote, italic: true, size: 15, color: "1E40AF" }], { align: "center" }), colW[4] + colW[5])
      ]);

      const itemsTable = dxTable([headerRow, ...itemRows, totalRow], totalW);

      // Sec 3: Evaluation Criteria
      const sec3Head = dxPara([{ text: T.sec3Title, bold: true, color: "1E3A8A" }], { size: 19, spaceBefore: 100, spaceAfter: 40 });

      const critCol1 = [
        dxPara([{ text: T.crit1Title, bold: true, size: 16 }], { spaceAfter: 10 }),
        dxPara([{ text: crit1 === "pass" ? "[X] " : "[  ] ", bold: true, color: crit1 === "pass" ? "15803D" : "000000" }, { text: T.crit1Pass, size: 15 }], { spaceAfter: 10 }),
        dxPara([{ text: crit1 === "fail" ? "[X] " : "[  ] ", bold: true, color: crit1 === "fail" ? "B91C1C" : "000000" }, { text: T.crit1Fail, size: 15 }], { spaceAfter: 40 }),

        dxPara([{ text: T.crit3Title, bold: true, size: 16 }], { spaceAfter: 10 }),
        dxPara([{ text: crit3 === "pass" ? "[X] " : "[  ] ", bold: true, color: crit3 === "pass" ? "15803D" : "000000" }, { text: T.crit3Pass, size: 15 }], { spaceAfter: 10 }),
        dxPara([{ text: crit3 === "fail" ? "[X] " : "[  ] ", bold: true, color: crit3 === "fail" ? "B91C1C" : "000000" }, { text: T.crit3Fail, size: 15 }])
      ];

      const critCol2 = [
        dxPara([{ text: T.crit2Title, bold: true, size: 16 }], { spaceAfter: 10 }),
        dxPara([{ text: crit2 === "pass" ? "[X] " : "[  ] ", bold: true, color: crit2 === "pass" ? "15803D" : "000000" }, { text: T.crit2Pass, size: 15 }], { spaceAfter: 10 }),
        dxPara([{ text: crit2 === "fail" ? "[X] " : "[  ] ", bold: true, color: crit2 === "fail" ? "B91C1C" : "000000" }, { text: T.crit2Fail, size: 15 }], { spaceAfter: 40 }),

        dxPara([{ text: T.crit4Title, bold: true, size: 16 }], { spaceAfter: 10 }),
        dxPara([{ text: crit4 === "pass" ? "[X] " : "[  ] ", bold: true, color: "15803D" }, { text: T.crit4Pass, bold: true, size: 15 }])
      ];

      const evalTable = dxTable([
        dxRow([dxCell(critCol1, 4500), dxCell(critCol2, 4500)])
      ], totalW);

      // Commitments
      const notesHead = dxPara([{ text: T.notesCommitTitle, bold: true, size: 16 }], { spaceBefore: 60, spaceAfter: 20 });
      const com1 = dxPara([{ text: `- ${T.commit1}`, size: 15, color: "374151" }], { spaceAfter: 15 });
      const com2 = dxPara([{ text: `- ${T.commit2}`, size: 15, color: "374151" }], { spaceAfter: 15 });
      const com3 = dxPara([{ text: `- ${T.commit3}`, size: 15, color: "374151" }], { spaceAfter: 80 });

      // Signatures
      const signTable = dxNoBorderTable([
        dxRow([
          dxNoBorderCell([
            dxPara(T.signReceiver, { align: "center", bold: true, size: 18 }),
            dxPara(T.signSub, { align: "center", size: 15, color: "6B7280", spaceAfter: 600 }),
            dxPara(receiverName || "……………………………………", { align: "center", bold: true, size: 18 }),
            dxPara(receiverCompany || "", { align: "center", size: 15, color: "4B5563" })
          ], 4500),
          dxNoBorderCell([
            dxPara(T.signDeliverer, { align: "center", bold: true, size: 18 }),
            dxPara(T.signSub, { align: "center", size: 15, color: "6B7280", spaceAfter: 600 }),
            dxPara(delivererName || "……………………………………", { align: "center", bold: true, size: 18 }),
            dxPara(delivererCompany || COMPANY.name, { align: "center", size: 15, color: "4B5563" })
          ], 4500)
        ])
      ], totalW);

      const docParts = [
        headerTable,
        titlePara, titleSub, timePara,
        sec1Head, partiesTable,
        sec2Head, itemsTable,
        sec3Head, evalTable,
        notesHead, com1, com2, com3,
        signTable
      ];

      const blob = await buildDocxBlob(docParts);
      downloadBlob(blob, `${refNum || "PGH_BBBG"}.docx`);
      showToast("✓ Đã xuất file Word thành công!", 2500);
    } catch(e) {
      alert("Lỗi xuất Word: " + e.message);
    } finally {
      setWordLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 1100, width: "95vw", height: "92vh", display: "flex", flexDirection: "column" }}>
        
        {/* Modal Header */}
        <div className="modal-header no-print" style={{ flexShrink: 0, padding: "12px 18px", borderBottom: "1px solid var(--border)" }}>
          <span className="modal-title" style={{ fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
            📦 PHIẾU GIAO HÀNG KIÊM BIÊN BẢN BÀN GIAO & NGHIỆM THU
          </span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button 
              className="btn btn-ghost btn-sm" 
              onClick={handleAutoTranslate} 
              disabled={translating}
              title="Tự động dịch thông tin hàng hóa, quy cách và vị trí sang ngôn ngữ đã chọn"
              style={{ fontWeight: 600, color: "#2563eb", background: "#eff6ff", border: "1px solid #bfdbfe" }}
            >
              {translating ? "⏳ Đang dịch..." : "🌐 Tự động dịch song ngữ"}
            </button>
            <button className="btn-close" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>

        {/* Modal Body: Sidebar Form (Left) & Preview (Right) */}
        <div className="modal-body" style={{ display: "flex", gap: 16, padding: 14, flex: 1, overflow: "hidden" }}>
          
          {/* Left Form Sidebar */}
          <div className="hw-sidebar no-print" style={{ width: 340, flexShrink: 0, overflowY: "auto", paddingRight: 6, display: "flex", flexDirection: "column", gap: 12 }}>
            
            {/* Language Switch */}
            <div style={{ background: "#f8fafc", padding: 10, borderRadius: 8, border: "1px solid #e2e8f0" }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#334155", display: "block", marginBottom: 6 }}>Ngôn ngữ hiển thị:</label>
              <div style={{ display: "flex", gap: 4 }}>
                <button type="button" className={`btn btn-xs ${lang === "vi" ? "btn-primary" : "btn-ghost"}`} onClick={() => setLang("vi")} style={{ flex: 1 }}>🇻🇳 Tiếng Việt</button>
                <button type="button" className={`btn btn-xs ${lang === "vi_en" ? "btn-primary" : "btn-ghost"}`} onClick={() => setLang("vi_en")} style={{ flex: 1 }}>🇻🇳/🇬🇧 Việt-Anh</button>
                <button type="button" className={`btn btn-xs ${lang === "vi_zh" ? "btn-primary" : "btn-ghost"}`} onClick={() => setLang("vi_zh")} style={{ flex: 1 }}>🇻🇳/🇨🇳 Việt-Trung</button>
              </div>
            </div>

            {/* General Meta */}
            <div className="hw-form-section" style={{ background: "#ffffff", padding: 10, borderRadius: 8, border: "1px solid #e2e8f0" }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: "#1e3a8a", marginBottom: 8 }}>📋 Thông tin chứng từ</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11 }}>
                <div>
                  <label style={{ fontWeight: 600, color: "#475569" }}>Mã chứng từ:</label>
                  <input className="form-control" style={{ fontSize: 11, padding: "3px 6px", height: 26 }} value={refNum} onChange={e => setRefNum(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontWeight: 600, color: "#475569" }}>Ngày lập:</label>
                  <input className="form-control" style={{ fontSize: 11, padding: "3px 6px", height: 26 }} value={dateStr} onChange={e => setDateStr(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontWeight: 600, color: "#475569" }}>Theo ĐH/HĐ số:</label>
                  <input className="form-control" style={{ fontSize: 11, padding: "3px 6px", height: 26 }} value={contractRefNum} onChange={e => setContractRefNum(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontWeight: 600, color: "#475569" }}>Thời gian giao & nghiệm thu:</label>
                  <input className="form-control" style={{ fontSize: 11, padding: "3px 6px", height: 26 }} value={deliveryTime} onChange={e => setDeliveryTime(e.target.value)} />
                </div>
              </div>
            </div>

            {/* Deliverer (Party A) */}
            <div className="hw-form-section" style={{ background: "#ffffff", padding: 10, borderRadius: 8, border: "1px solid #e2e8f0" }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: "#1e3a8a", marginBottom: 8 }}>🚚 Đơn vị giao hàng (Bên A)</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11 }}>
                <div>
                  <label style={{ fontWeight: 600, color: "#475569" }}>Đơn vị giao:</label>
                  <input className="form-control" style={{ fontSize: 11, padding: "3px 6px", height: 26 }} value={delivererCompany} onChange={e => setDelivererCompany(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontWeight: 600, color: "#475569" }}>Người giao:</label>
                  <input className="form-control" style={{ fontSize: 11, padding: "3px 6px", height: 26 }} value={delivererName} onChange={e => setDelivererName(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontWeight: 600, color: "#475569" }}>Số ĐT người giao:</label>
                  <input className="form-control" style={{ fontSize: 11, padding: "3px 6px", height: 26 }} value={delivererPhone} onChange={e => setDelivererPhone(e.target.value)} />
                </div>
              </div>
            </div>

            {/* Receiver (Party B) */}
            <div className="hw-form-section" style={{ background: "#ffffff", padding: 10, borderRadius: 8, border: "1px solid #e2e8f0" }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: "#1e3a8a", marginBottom: 8 }}>🏢 Đơn vị nhận hàng (Bên B)</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11 }}>
                <div>
                  <label style={{ fontWeight: 600, color: "#475569" }}>Đơn vị nhận:</label>
                  <input className="form-control" style={{ fontSize: 11, padding: "3px 6px", height: 26 }} value={receiverCompany} onChange={e => setReceiverCompany(e.target.value)} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 4 }}>
                  <div>
                    <label style={{ fontWeight: 600, color: "#475569" }}>Người nhận (để trống nếu điền tay):</label>
                    <input className="form-control" placeholder="Để trống nếu điền tay..." style={{ fontSize: 11, padding: "3px 6px", height: 26 }} value={receiverName} onChange={e => setReceiverName(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontWeight: 600, color: "#475569" }}>Chức vụ:</label>
                    <input className="form-control" placeholder="Chức vụ..." style={{ fontSize: 11, padding: "3px 6px", height: 26 }} value={receiverTitle} onChange={e => setReceiverTitle(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label style={{ fontWeight: 600, color: "#475569" }}>Số ĐT/CCCD:</label>
                  <input className="form-control" style={{ fontSize: 11, padding: "3px 6px", height: 26 }} value={receiverPhone} onChange={e => setReceiverPhone(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontWeight: 600, color: "#475569" }}>Vị trí lắp đặt (để trống nếu không có):</label>
                  <input className="form-control" placeholder="Để trống nếu không có..." style={{ fontSize: 11, padding: "3px 6px", height: 26 }} value={installLocation} onChange={e => setInstallLocation(e.target.value)} />
                </div>
              </div>
            </div>

            {/* Items Management */}
            <div className="hw-form-section" style={{ background: "#ffffff", padding: 10, borderRadius: 8, border: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 12, color: "#1e3a8a" }}>📦 Danh mục hàng hóa ({items.length})</span>
                <button type="button" className="btn btn-primary btn-xs" onClick={addItem}>+ Thêm dòng</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 180, overflowY: "auto" }}>
                {items.map((it, idx) => (
                  <div key={it.id} style={{ background: "#f8fafc", padding: 6, borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 11 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                      <span style={{ fontWeight: 700 }}>#{idx + 1}</span>
                      <button type="button" onClick={() => removeItem(it.id)} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 12 }}>✕</button>
                    </div>
                    <textarea 
                      className="form-control" 
                      rows={2} 
                      style={{ fontSize: 11, padding: 4, marginBottom: 4 }} 
                      placeholder="Tên hàng hóa, quy cách..." 
                      value={it.name} 
                      onChange={e => setItemField(it.id, "name", e.target.value)} 
                    />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 1fr", gap: 4 }}>
                      <input className="form-control" placeholder="ĐVT" style={{ fontSize: 10, padding: 2, height: 24 }} value={it.unit} onChange={e => setItemField(it.id, "unit", e.target.value)} />
                      <input className="form-control" type="number" placeholder="SL" style={{ fontSize: 10, padding: 2, height: 24 }} value={it.qty} onChange={e => setItemField(it.id, "qty", Number(e.target.value))} />
                      <input className="form-control" placeholder="S/N" style={{ fontSize: 10, padding: 2, height: 24 }} value={it.serialNo} onChange={e => setItemField(it.id, "serialNo", e.target.value)} />
                    </div>
                    <input 
                      className="form-control" 
                      placeholder="Ghi chú thêm cho hàng này (nếu có)..." 
                      style={{ fontSize: 10, padding: "2px 4px", height: 24, marginTop: 4 }} 
                      value={it.note || ""} 
                      onChange={e => setItemField(it.id, "note", e.target.value)} 
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Criteria */}
            <div className="hw-form-section" style={{ background: "#ffffff", padding: 10, borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 11 }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: "#1e3a8a", marginBottom: 8 }}>✅ Đánh giá nghiệm thu</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div>
                  <label style={{ fontWeight: 600, color: "#475569" }}>1. Số lượng, chủng loại:</label>
                  <select className="form-control" style={{ fontSize: 11, height: 26, padding: "2px 6px" }} value={crit1} onChange={e => setCrit1(e.target.value)}>
                    <option value="pass">Đúng & đủ 100%</option>
                    <option value="fail">Có sai lệch</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontWeight: 600, color: "#475569" }}>2. Quy cách & ngoại quan:</label>
                  <select className="form-control" style={{ fontSize: 11, height: 26, padding: "2px 6px" }} value={crit2} onChange={e => setCrit2(e.target.value)}>
                    <option value="pass">Mới 100%, không móp méo</option>
                    <option value="fail">Bao bì rách vỡ / cạy mở</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontWeight: 600, color: "#475569" }}>3. Lắp đặt & chạy thử:</label>
                  <select className="form-control" style={{ fontSize: 11, height: 26, padding: "2px 6px" }} value={crit3} onChange={e => setCrit3(e.target.value)}>
                    <option value="pass">Vận hành ổn định, đạt yêu cầu</option>
                    <option value="fail">Chưa đạt kỹ thuật</option>
                  </select>
                </div>
              </div>
            </div>

          </div>

          {/* Right Live Preview Area */}
          <div style={{ flex: 1, overflowY: "auto", background: "#e2e8f0", padding: 14, borderRadius: 8, display: "flex", justifyContent: "center" }}>
            
            {/* The Printable Page with App Global Font */}
            <div className="handover-doc-page" id="handoverPreviewContent" style={{
              background: "#ffffff",
              width: "100%",
              maxWidth: 794,
              minHeight: 1120,
              padding: "28px 32px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
              color: "#111827",
              fontSize: 11.5,
              lineHeight: 1.45,
              boxSizing: "border-box"
            }}>

              {/* Top Header with Logo */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, maxWidth: "60%" }}>
                  {getLogoUrl() ? (
                    <img src={getLogoUrl()} style={{ width: 48, height: 48, objectFit: "contain", flexShrink: 0 }} alt="PMC Logo" />
                  ) : null}
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 13, textTransform: "uppercase", color: "#111827" }}>{COMPANY.name}</div>
                    <div style={{ fontSize: 10, color: "#4b5563", marginTop: 2 }}>Địa chỉ: {COMPANY.address}</div>
                    <div style={{ fontSize: 10, color: "#4b5563", marginTop: 1 }}>ĐT: {COMPANY.phone} | Email: {COMPANY.email}</div>
                  </div>
                </div>

                <div style={{ textAlign: "right", fontSize: 10.5 }}>
                  <div style={{ fontWeight: 700, color: "#111827" }}>
                    {T.codeLabel}: <span style={{ color: "#b91c1c", fontWeight: 800 }}>{refNum}</span>
                  </div>
                  <div style={{ color: "#374151", marginTop: 2 }}>
                    {T.dateLabel}: <strong>{dateStr}</strong>
                  </div>
                  <div style={{ color: "#374151", marginTop: 1 }}>
                    {T.orderRefLabel}: <strong>{contractRefNum}</strong>
                  </div>
                  <div style={{ fontSize: 9, fontStyle: "italic", color: "#6b7280", marginTop: 2 }}>
                    {T.copyLabel}
                  </div>
                </div>
              </div>

              {/* Title Section */}
              <div style={{ textAlign: "center", margin: "16px 0 14px 0" }}>
                <h1 style={{ margin: 0, fontSize: 15.5, fontWeight: 800, textTransform: "uppercase", color: "#111827", letterSpacing: "0.02em" }}>
                  {T.docTitle}
                </h1>
                {lang !== "vi" && T.docSub ? (
                  <div style={{ fontSize: 11, fontStyle: "italic", color: "#4b5563", marginTop: 2 }}>
                    {T.docSub}
                  </div>
                ) : null}
                <div style={{ fontSize: 10.5, fontStyle: "italic", color: "#374151", marginTop: 4 }}>
                  {T.timeLabel}: <strong>{deliveryTime}</strong>
                  {lang !== "vi" && deliveryTimeEn ? <span style={{ color: "#64748b" }}> / {deliveryTimeEn}</span> : null}
                </div>
              </div>

              {/* Section I: THÔNG TIN CÁC BÊN GIAO NHẬN */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11.5, fontWeight: 800, textTransform: "uppercase", color: "#1e3a8a", marginBottom: 5 }}>
                  {T.sec1Title}
                </div>

                <div style={{ display: "flex", gap: 12, width: "100%", boxSizing: "border-box" }}>
                  
                  {/* Party A Box */}
                  <div style={{ flex: 1, border: "1px solid #94a3b8", borderRadius: 4, padding: "8px 10px", fontSize: 10.5, boxSizing: "border-box" }}>
                    <div style={{ fontWeight: 800, color: "#1e293b", textTransform: "uppercase", marginBottom: 5, fontSize: 10.5 }}>
                      {T.partyATitle}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3.5 }}>
                      <div>• <strong>{T.unitLabel}:</strong> {delivererCompany} {lang !== "vi" && delivererCompanyEn ? <span style={{ fontStyle: "italic", color: "#64748b" }}>/ {delivererCompanyEn}</span> : null}</div>
                      <div>• <strong>{T.delivererLabel}:</strong> <span style={{ fontWeight: 700 }}>{delivererName}</span></div>
                      <div>• <strong>{T.phoneLabel}:</strong> {delivererPhone}</div>
                    </div>
                  </div>

                  {/* Party B Box */}
                  <div style={{ flex: 1, border: "1px solid #94a3b8", borderRadius: 4, padding: "8px 10px", fontSize: 10.5, boxSizing: "border-box" }}>
                    <div style={{ fontWeight: 800, color: "#1e293b", textTransform: "uppercase", marginBottom: 5, fontSize: 10.5 }}>
                      {T.partyBTitle}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3.5 }}>
                      <div>• <strong>{T.unitLabel}:</strong> <span style={{ fontWeight: 700 }}>{receiverCompany || "…………………………………………"}</span> {lang !== "vi" && receiverCompanyEn ? <span style={{ fontStyle: "italic", color: "#64748b" }}>/ {receiverCompanyEn}</span> : null}</div>
                      <div>• <strong>{T.receiverLabel}:</strong> <span style={{ fontWeight: 700 }}>{receiverName || "…………………………………………"}</span> {receiverTitle ? `(${receiverTitle})` : ""}</div>
                      <div>• <strong>{T.phoneIdLabel}:</strong> {receiverPhone || "…………………………………………"}</div>
                      {installLocation && installLocation.trim() ? (
                        <div>• <strong>{T.installLocLabel}:</strong> {installLocation} {lang !== "vi" && installLocationEn ? <span style={{ fontStyle: "italic", color: "#64748b" }}>/ {installLocationEn}</span> : null}</div>
                      ) : null}
                    </div>
                  </div>

                </div>
              </div>

              {/* Section II: CHI TIẾT HÀNG HÓA BÀN GIAO */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11.5, fontWeight: 800, textTransform: "uppercase", color: "#1e3a8a", marginBottom: 5 }}>
                  {T.sec2Title}
                </div>

                <table style={{ width: "100%", tableLayout: "fixed", borderCollapse: "collapse", fontSize: 10, textAlign: "left", boxSizing: "border-box" }}>
                  <thead>
                    <tr style={{ background: "#1e3a8a", color: "#ffffff", textAlign: "center", fontWeight: 700 }}>
                      <th style={{ border: "1px solid #1e3a8a", padding: "6px 4px", width: "6%", whiteSpace: "pre-line" }}>{T.colStt}</th>
                      <th style={{ border: "1px solid #1e3a8a", padding: "6px 8px", width: "48%", whiteSpace: "pre-line" }}>{T.colName}</th>
                      <th style={{ border: "1px solid #1e3a8a", padding: "6px 4px", width: "8%", whiteSpace: "pre-line" }}>{T.colUnit}</th>
                      <th style={{ border: "1px solid #1e3a8a", padding: "6px 4px", width: "7%", whiteSpace: "pre-line" }}>{T.colQty}</th>
                      <th style={{ border: "1px solid #1e3a8a", padding: "6px 6px", width: "16%", whiteSpace: "pre-line" }}>{T.colSerial}</th>
                      <th style={{ border: "1px solid #1e3a8a", padding: "6px 6px", width: "15%", whiteSpace: "pre-line" }}>{T.colNote}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, idx) => (
                      <tr key={it.id || idx}>
                        <td style={{ border: "1px solid #94a3b8", padding: "5px 4px", textAlign: "center" }}>{idx + 1}</td>
                        <td style={{ border: "1px solid #94a3b8", padding: "5px 8px", wordBreak: "break-word" }}>
                          <div style={{ fontWeight: 700, color: "#111827", whiteSpace: "pre-line" }}>{it.name}</div>
                          {lang !== "vi" && it.nameEn ? (
                            <div style={{ fontSize: 9, fontStyle: "italic", color: "#4b5563", marginTop: 2, whiteSpace: "pre-line" }}>
                              {it.nameEn}
                            </div>
                          ) : null}
                        </td>
                        <td style={{ border: "1px solid #94a3b8", padding: "5px 4px", textAlign: "center" }}>{it.unit || "Bộ"}</td>
                        <td style={{ border: "1px solid #94a3b8", padding: "5px 4px", textAlign: "center", fontWeight: 700 }}>{String(it.qty || 1).padStart(2, "0")}</td>
                        <td style={{ border: "1px solid #94a3b8", padding: "5px 6px", textAlign: "center", color: "#4b5563", fontSize: 9.5 }}>{it.serialNo || "-"}</td>
                        <td style={{ border: "1px solid #94a3b8", padding: "5px 6px", color: "#4b5563", fontSize: 9.5 }}>{it.note || ""}</td>
                      </tr>
                    ))}
                    <tr style={{ background: "#f8fafc", fontWeight: 700 }}>
                      <td colSpan={3} style={{ border: "1px solid #94a3b8", padding: "6px 8px", textAlign: "right" }}>
                        {T.totalQtyLabel}
                      </td>
                      <td style={{ border: "1px solid #94a3b8", padding: "6px 4px", textAlign: "center", fontSize: 11, color: "#1e3a8a", fontWeight: 800 }}>
                        {totalQtyStr}
                      </td>
                      <td colSpan={2} style={{ border: "1px solid #94a3b8", padding: "6px 8px", fontStyle: "italic", color: "#1e40af", fontSize: 9.5, textAlign: "center" }}>
                        {T.matchingNote}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Section III: NỘI DUNG ĐÁNH GIÁ & KẾT LUẬN NGHIỆM THU */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11.5, fontWeight: 800, textTransform: "uppercase", color: "#1e3a8a", marginBottom: 5 }}>
                  {T.sec3Title}
                </div>

                <div style={{ border: "1px solid #94a3b8", borderRadius: 4, padding: "8px 10px", fontSize: 10, boxSizing: "border-box" }}>
                  <div style={{ display: "flex", gap: 12, width: "100%", boxSizing: "border-box" }}>
                    
                    {/* Left criteria */}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, marginBottom: 2 }}>{T.crit1Title}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                        <span style={{ fontWeight: 800, color: crit1 === "pass" ? "#16a34a" : "#6b7280" }}>{crit1 === "pass" ? "[X]" : "[  ]"}</span>
                        <span>{T.crit1Pass}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                        <span style={{ fontWeight: 800, color: crit1 === "fail" ? "#dc2626" : "#6b7280" }}>{crit1 === "fail" ? "[X]" : "[  ]"}</span>
                        <span>{T.crit1Fail}</span>
                      </div>

                      <div style={{ fontWeight: 700, marginBottom: 2 }}>{T.crit3Title}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                        <span style={{ fontWeight: 800, color: crit3 === "pass" ? "#16a34a" : "#6b7280" }}>{crit3 === "pass" ? "[X]" : "[  ]"}</span>
                        <span>{T.crit3Pass}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontWeight: 800, color: crit3 === "fail" ? "#dc2626" : "#6b7280" }}>{crit3 === "fail" ? "[X]" : "[  ]"}</span>
                        <span>{T.crit3Fail}</span>
                      </div>
                    </div>

                    {/* Right criteria */}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, marginBottom: 2 }}>{T.crit2Title}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                        <span style={{ fontWeight: 800, color: crit2 === "pass" ? "#16a34a" : "#6b7280" }}>{crit2 === "pass" ? "[X]" : "[  ]"}</span>
                        <span>{T.crit2Pass}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                        <span style={{ fontWeight: 800, color: crit2 === "fail" ? "#dc2626" : "#6b7280" }}>{crit2 === "fail" ? "[X]" : "[  ]"}</span>
                        <span>{T.crit2Fail}</span>
                      </div>

                      <div style={{ fontWeight: 700, marginBottom: 2 }}>{T.crit4Title}</div>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                        <span style={{ fontWeight: 800, color: "#16a34a" }}>[X]</span>
                        <span style={{ fontWeight: 700, color: "#111827" }}>{T.crit4Pass}</span>
                      </div>
                    </div>

                  </div>
                </div>
              </div>

              {/* Notes & Responsibility Commitments */}
              <div style={{ fontSize: 9.5, color: "#374151", marginBottom: 18, lineHeight: 1.45 }}>
                <div style={{ fontWeight: 700, color: "#111827", marginBottom: 2 }}>{T.notesCommitTitle}</div>
                <div>- {T.commit1}</div>
                <div>- {T.commit2}</div>
                <div>- {T.commit3}</div>
              </div>

              {/* Signatures */}
              <div style={{ display: "flex", width: "100%", justifyContent: "space-between", textAlign: "center", marginTop: 10 }}>
                <div style={{ flex: 1, textAlign: "center" }}>
                  <div style={{ fontWeight: 800, textTransform: "uppercase", fontSize: 11, color: "#111827" }}>
                    {T.signReceiver}
                  </div>
                  <div style={{ fontStyle: "italic", fontSize: 9, color: "#6b7280", marginTop: 1 }}>
                    {T.signSub}
                  </div>
                  <div style={{ height: 54 }} />
                  <div style={{ fontWeight: 700, fontSize: 11, color: receiverName ? "#111827" : "#9ca3af" }}>
                    {receiverName || "……………………………………"}
                  </div>
                </div>

                <div style={{ flex: 1, textAlign: "center" }}>
                  <div style={{ fontWeight: 800, textTransform: "uppercase", fontSize: 11, color: "#111827" }}>
                    {T.signDeliverer}
                  </div>
                  <div style={{ fontStyle: "italic", fontSize: 9, color: "#6b7280", marginTop: 1 }}>
                    {T.signSub}
                  </div>
                  <div style={{ height: 54 }} />
                  <div style={{ fontWeight: 700, fontSize: 11, color: "#111827" }}>
                    {delivererName}
                  </div>
                </div>
              </div>

            </div>

          </div>

        </div>

        {/* Modal Footer */}
        <div className="modal-footer no-print" style={{ flexShrink: 0, padding: "10px 18px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="btn btn-ghost" onClick={onClose}>Đóng</button>
          {storageId && (
            <button className="btn btn-ghost" onClick={handleSave} disabled={saving}>
              {saving ? "⏳ Đang lưu..." : "💾 Lưu biên bản"}{saveMsg && <span style={{ color: "#16a34a", marginLeft: 6 }}>{saveMsg}</span>}
            </button>
          )}
          <button className="btn btn-ghost" onClick={handleWord} disabled={wordLoading} style={{ minWidth: 110 }}>
            {wordLoading ? "⏳ Đang tạo..." : "📝 Xuất Word"}
          </button>
          <button className="btn btn-ghost" onClick={handlePDF} disabled={pdfLoading} style={{ minWidth: 110 }}>
            {pdfLoading ? "⏳ Đang tạo..." : "📄 Xuất PDF"}
          </button>
          <button className="btn btn-primary" onClick={handlePrint} style={{ minWidth: 90 }}>
            🖨️ In
          </button>
        </div>

      </div>
    </div>
  );
}
