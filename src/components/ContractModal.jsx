import React, { useState, useEffect } from 'react';
import { loadContract, saveContract, COMPANY, getLogoUrl, generateContractNumber } from '../utils/gasStore';
import { calcItems, fmt, numberToWordsVN, numberToWordsEN, numberToWordsCN } from '../utils/helpers';
import { vatLabel } from './FormattedNumberInput';
import { exportViaPuppeteer } from '../utils/pdfExporter';
import { 
  ensurePdfMake, ensureBeVietnamPro, ensureHtml2Canvas, ensureJsPdf, buildDocxBlob, dxPara, dxBi, dxCell, dxHeaderCell, dxRow, dxTable, 
  dxNoBorderTable, dxNoBorderCell, downloadBlob 
} from '../utils/docxBuilder';

const CONTRACT_TEXT = {
  vi_en: {
    natTitle1: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", natTitle1b: "SOCIALIST REPUBLIC OF VIETNAM",
    natTitle2: "Độc lập - Tự do - Hạnh phúc", natTitle2b: "Independence – Freedom - Happiness",
    title: "HỢP ĐỒNG MUA BÁN", titleB: "SALES CONTRACT",
    legalBasis: "Căn cứ Bộ Luật Thương mại được Quốc Hội nước Cộng hòa Xã hội Chủ nghĩa Việt Nam khóa XI, Kỳ họp thứ 7 thông qua ngày 14/06/2005 và có hiệu lực từ ngày 01/01/2006.",
    legalBasisB: "Base on the Commercial Code ratified on Jun 14th, 2005 by The National Assembly of Social Republic of Vietnam Term XI, Session 7th, being effective from Jan 1st, 2006.",
    today: (d) => `Hôm nay, ngày ${d.day} tháng ${d.month} năm ${d.year}, chúng tôi gồm:`,
    todayB: (d) => `Today, ${d.day}/${d.month}/${d.year}, By and between:`,
    seller: "BÊN BÁN", sellerB: "THE SELLER",
    buyer: "BÊN MUA", buyerB: "THE BUYER",
    rep: "Người đại diện", repB: "Representative",
    position: "Chức vụ", positionB: "Position",
    address: "Địa chỉ", addressB: "Address",
    tel: "Điện thoại", telB: "Tel",
    taxCode: "Mã số thuế", taxCodeB: "Tax Code",
    accountNo: "Tài khoản số", accountNoB: "Account No",
    atBank: "Tại ngân hàng", atBankB: "At Bank",
    agree: "Bên Bán đồng ý bán và bên Mua đồng ý mua hàng hóa được đề cập sau đây theo các điều kiện và điều khoản của hợp đồng này.",
    agreeB: "The Seller wishes to sell and the Buyer wishes to buy the under mentioned commodity subject to the terms and conditions of this Contract.",
    art1: "ĐIỀU 1: HÀNG HÓA, DỊCH VỤ", art1B: "ARTICLE 1: COMMODITY, SERVICES",
    art1_1: "Hàng hóa, số lượng, giá cả và xuất xứ", art1_1B: "Commodity, Quantity, Unit price and origin",
    art1_desc: "Hàng hóa được mô tả như bên dưới và sau đây được gọi chung là \"Hàng hóa\" tùy ngữ cảnh thích hợp.",
    art1_descB: "Commodity is described as below and herein after referred to as \"Goods\" where appropriate.",
    inWords: (s) => `(Bằng chữ: ${s})`,
    inWordsB: (s) => `(In words: ${s})`,
    art1_2: "Chất lượng", art1_2B: "Quality",
    quality: "Hàng mới 100%", qualityB: "Brand new 100%",
    art1_3: "Chứng từ thanh toán: Bên Bán sẽ cung cấp cho bên Mua các chứng từ sau đây:",
    art1_3B: "Documents required: The Seller shall provide the documents to the Buyer with following:",
    docs: ["Hợp đồng mua bán","Báo giá","Đơn đặt hàng","Biên bản bàn giao kèm phiếu bảo hành","Đề nghị thanh toán","Hóa đơn GTGT"],
    docsB: ["Sales contract","Quotation","Purchase order","Handover minutes with warranty certificate attached","Payment request","VAT Invoice"],
    art2: "ĐIỀU 2: ĐIỀU KHOẢN THANH TOÁN", art2B: "ARTICLE 2: PAYMENT TERM",
    art2_lead: "Thanh toán được thực hiện như sau", art2_leadB: "Payment shall be made as follows",
    art3: "ĐIỀU 3: ĐIỀU KHOẢN GIAO HÀNG", art3B: "ARTICLE 3: DELIVERY TERM",
    art3_1: (d) => `3.1 Thời gian giao hàng: ${d} ngày kể từ ngày hai bên ký hợp đồng.`,
    art3_1B: (d) => `3.1 Delivery time: ${d} days since the date of contract signed.`,
    art3_2: (p) => `3.2 Địa điểm giao hàng: ${p}`,
    art3_2B: (p) => `3.2 Place of delivery: ${p}`,
    art4: "ĐIỀU 4: PHẠT HỢP ĐỒNG", art4B: "ARTICLE 4: DELAY PENALTY",
    art4_1: "4.1 Nếu bên Bán chậm giao hàng quá thời hạn được quy định ở điều 3, thì sẽ chịu phạt với lãi suất 0.2%/tuần trên giá trị hàng giao trễ nhưng không tính 1 tuần đầu. Tuy nhiên, tổng số tiền phạt không được vượt quá 2% tổng giá trị Hợp Đồng.",
    art4_1B: "4.1 If the Seller fails to deliver commodity on time as the regulation of Article 3, the Seller shall pay for penalty of 0.2%/week of the delayed value except the first week as grace period. However, total of compensation shall not exceed 2% of the total contract value.",
    art4_2: "4.2 Nếu bên Mua chậm thanh toán quá thời hạn được quy định ở điều 2, thì sẽ chịu phạt với lãi suất 0.2%/tuần trên giá trị thanh toán trễ. Tuy nhiên, tổng số tiền phạt không được vượt quá 2% tổng giá trị Hợp Đồng.",
    art4_2B: "4.2 If the Buyer fails to make payment on time as the regulation of Article 2, the Buyer shall pay for penalty of 0.2% of the delayed value per week. However, total of compensation shall not exceed 2% of the total contract value.",
    art4_3: "4.3 Điều khoản này sẽ không được áp dụng trong trường hợp Bất khả kháng.",
    art4_3B: "4.3 This article shall not be applicable in Force Majeure cases.",
    art4_4: "4.4 Không bên nào có trách nhiệm bồi thường các thiệt hại gián tiếp nếu có phát sinh từ hợp đồng này.",
    art4_4B: "4.4 Neither party shall be liable for indirect damages which arising from this contract (if any).",
    art5: "ĐIỀU 5: GIẢI QUYẾT TRANH CHẤP", art5B: "ARTICLE 5: DISPUTES",
    art5_body: "Bất cứ tranh chấp nào liên quan đến Hợp đồng sẽ được thương lượng giữa hai bên. Nếu hai bên không giải quyết được bằng thương lượng thì sẽ đưa ra Tòa án có thẩm quyền xem xét. Tòa án này sẽ giải quyết vụ việc theo quy tắc tố tụng hiện hành của pháp luật Việt Nam.",
    art5_bodyB: "The Purchaser and the Supplier shall make every effort to resolve amicably by direct informal negotiation. In case no settlement can be reached, the disputes would be submitted to the competent Court. This Court will resolve the case under the current procedural rules of the law of Vietnam.",
    art6: "ĐIỀU 6: ĐIỀU KHOẢN CHUNG", art6B: "ARTICLE 6: GENERAL PROVISIONS",
    art6_1: "Bất cứ bổ sung và/hoặc sửa đổi điều khoản nào của hợp đồng chỉ có giá trị khi được lập bằng văn bản và có xác nhận của hai bên.",
    art6_1B: "Amendments of or additional to this Contract shall only be effective upon written agreement signed by the Parties.",
    art6_2: "Hợp đồng này sẽ được các bên thực hiện theo qui định của pháp luật hiện hành của nước Cộng Hòa Xã Hội Chủ Nghĩa Việt Nam.",
    art6_2B: "This contract shall be implemented following the Vietnam's law.",
    art6_3: "Sau khi các bên thực hiện xong các nghĩa vụ được quy định trong hợp đồng này, nếu hai bên không có khiếu nại gì thì hợp đồng xem như được thanh lý.",
    art6_3B: "This contract is automatically liquidated when two parties finished their responsibilities regulated in this contract.",
    art6_4: "Hợp đồng này có hiệu lực kể từ ngày ký.",
    art6_4B: "This Contract shall become into force and effect from the date of signing.",
    art6_5: "Hợp đồng này được lập thành hai (02) bản song ngữ tiếng Việt và tiếng Anh. Mỗi bên giữ một (01) bản có giá trị như nhau. Trong trường hợp có sự sai khác giữa tiếng Anh và tiếng Việt thì tiếng Việt sẽ là căn cứ quyết định.",
    art6_5B: "This Contract is made and signed in two (02) copies in Vietnamese and English. Each party shall keep one (01) copy with equal validity. In the case of discrepancy, Vietnamese shall be governed.",
    itemsHeader: ["STT","HÀNG HÓA / DỊCH VỤ","SL","ĐVT","ĐƠN GIÁ","VAT","THÀNH TIỀN"],
    itemsHeaderB: ["NO.","COMMODITY/SERVICES","QTY","UNIT","UNIT PRICE","VAT","AMOUNT"],
    rowTotal: "THÀNH TIỀN:", rowTotalB: "SUBTOTAL:",
    rowVat: (l) => `VAT (${l})`, rowVatB: (l) => `VAT (${l})`,
    rowGrand: "TỔNG CỘNG:", rowGrandB: "TOTAL:",
    signSeller: "ĐẠI DIỆN BÊN BÁN", signSellerB: "THE SELLER",
    signBuyer: "ĐẠI DIỆN BÊN MUA", signBuyerB: "THE BUYER",
  }
};

const CONTRACT_TEXT_VI_ZH = {
  natTitle1: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", natTitle1b: "越南社会主义共和国",
  natTitle2: "Độc lập - Tự do - Hạnh phúc", natTitle2b: "独立 - 自由 - 幸福",
  title: "HỢP ĐỒNG MUA BÁN", titleB: "买卖合同",
  legalBasis: "Căn cứ Bộ Luật Thương mại được Quốc Hội nước Cộng hòa Xã hội Chủ nghĩa Việt Nam khóa XI, Kỳ họp thứ 7 thông qua ngày 14/06/2005 và có hiệu lực từ ngày 01/01/2006.",
  legalBasisB: "依据越南社会主义共和国第十一届国会第七次会议于2005年6月14日通过、自2006年1月1日起生效的《商法》。",
  today: (d) => `Hôm nay, ngày ${d.day} tháng ${d.month} năm ${d.year}, chúng tôi gồm:`,
  todayB: (d) => `今天，${d.year}年${d.month}月${d.day}日，双方如下：`,
  seller: "BÊN BÁN", sellerB: "卖方",
  buyer: "BÊN MUA", buyerB: "买方",
  rep: "Người đại diện", repB: "代表人",
  position: "Chức vụ", positionB: "职位",
  address: "Địa chỉ", addressB: "地址",
  tel: "Điện thoại", telB: "电话",
  taxCode: "Mã số thuế", taxCodeB: "税号",
  accountNo: "Tài khoản số", accountNoB: "账号",
  atBank: "Tại ngân hàng", atBankB: "开户银行",
  agree: "Bên Bán đồng ý bán và bên Mua đồng ý mua hàng hóa được đề cập sau đây theo các điều kiện và điều khoản của hợp đồng này.",
  agreeB: "卖方同意出售、买方同意购买以下商品，并遵守本合同的条款 and 条件。",
  art1: "ĐIỀU 1: HÀNG HÓA, DỊCH VỤ", art1B: "第一条：货物、服务",
  art1_1: "Hàng hóa, số lượng, giá cả và xuất xứ", art1_1B: "货物、数量、单价及产地",
  art1_desc: "Hàng hóa được mô tả như bên dưới và sau đây được gọi chung là \"Hàng hóa\" tùy ngữ cảnh thích hợp.",
  art1_descB: "货物描述如下，以下视情况统称为\"货物\"。",
  inWords: (s) => `(Bằng chữ: ${s})`,
  inWordsB: (s) => `(大写：${s})`,
  art1_2: "Chất lượng", art1_2B: "质量",
  quality: "Hàng mới 100%", qualityB: "全新100%",
  art1_3: "Chứng từ thanh toán: Bên Bán sẽ cung cấp cho bên Mua các chứng từ sau đây:",
  art1_3B: "付款单据：卖方应向买方提供以下单据：",
  docs: ["Hợp đồng mua bán","Báo giá","Đơn đặt hàng","Biên bản bàn giao kèm phiếu bảo hành","Đề nghị thanh toán","Hóa đơn GTGT"],
  docsB: ["买卖合同","报价单","订购单","附带保修单的交接记录","付款申请书","增值税发票"],
  art2: "ĐIỀU 2: ĐIỀU KHOẢN THANH TOÁN", art2B: "第二条：付款条款",
  art2_lead: "Thanh toán được thực hiện như sau", art2_leadB: "付款方式如下",
  art3: "ĐIỀU 3: ĐIỀU KHOẢN GIAO HÀNG", art3B: "第三条：交货条款",
  art3_1: (d) => `3.1 Thời gian giao hàng: ${d} ngày kể từ ngày hai bên ký hợp đồng.`,
  art3_1B: (d) => `3.1 交货时间：自双方签订合同之日起 ${d} 天内。`,
  art3_2: (p) => `3.2 Địa điểm giao hàng: ${p}`,
  art3_2B: (p) => `3.2 交货地点：${p}`,
  art4: "ĐIỀU 4: PHẠT HỢP ĐỒNG", art4B: "第四条：违约罚款",
  art4_1: "4.1 Nếu bên Bán chậm giao hàng quá thời hạn được quy định ở điều 3, thì sẽ chịu phạt với lãi suất 0.2%/tuần trên giá trị hàng giao trễ nhưng không tính 1 tuần đầu. Tuy nhiên, tổng số tiền phạt không được vượt quá 2% tổng giá trị Hợp Đồng.",
  art4_1B: "4.1 若卖方延迟交货超过第三条规定的期限，除第一周宽限期外，每延迟一周按延迟交货金额的0.2%支付违约金，但违约金总额不超过合同总价值的2%。",
  art4_2: "4.2 Nếu bên Mua chậm thanh toán quá thời hạn được quy định ở điều 2, thì sẽ chịu phạt với lãi suất 0.2%/tuần trên giá trị thanh toán trễ. Tuy nhiên, tổng số tiền phạt không được vượt quá 2% tổng giá trị Hợp Đồng.",
  art4_2B: "4.2 若买方延迟付款超过第二条规定的期限，每延迟一周按延迟付款金额 of 0.2% 支付违约金，但违约金总额不超过合同总价值的2%。",
  art4_3: "4.3 Điều khoản này sẽ không được áp dụng trong trường hợp Bất khả kháng.",
  art4_3B: "4.3 本条款不适用于不可抗力情形。",
  art4_4: "4.4 Không bên nào có trách nhiệm bồi thường các thiệt hại gián tiếp nếu có phát sinh từ hợp đồng này.",
  art4_4B: "4.4 任何一方均不对因本合同产生的间接损失承担赔偿责任（如有）。",
  art5: "ĐIỀU 5: GIẢI QUYẾT TRANH CHẤP", art5B: "第五条：争议解决",
  art5_body: "Bất cứ tranh chấp nào liên quan đến Hợp đồng sẽ được thương lượng giữa hai bên. Nếu hai bên không giải quyết được bằng thương lượng thì sẽ đưa ra Tòa án có thẩm quyền xem xét. Tòa án này sẽ giải quyết vụ việc theo quy tắc tố tụng hiện hành của pháp luật Việt Nam.",
  art5_bodyB: "与本合同有关的任何争议应由双方协商解决。若协商不成，应提交有管辖权的法院处理，该法院将依照越南现行法律程序规则审理本案。",
  art6: "ĐIỀU 6: ĐIỀU KHOẢN CHUNG", art6B: "第六条：一般条款",
  art6_1: "Bất cứ bổ sung và/hoặc sửa đổi điều khoản nào của hợp đồng chỉ có giá trị khi được lập bằng văn bản và có xác nhận của hai bên.",
  art6_1B: "本合同任何条款的补充和/或修改，仅在双方以书面形式确认后方为有效。",
  art6_2: "Hợp đồng này sẽ được các bên thực hiện theo qui định của pháp luật hiện hành của nước Cộng Hòa Xã Hội Chủ Nghĩa Việt Nam.",
  art6_2B: "本合同应按照越南社会主义共和国现行法律规定执行。",
  art6_3: "Sau khi các bên thực hiện xong các nghĩa vụ được quy định trong hợp đồng này, nếu hai bên không có khiếu nại gì thì hợp đồng xem như được thanh lý.",
  art6_3B: "双方履行完本合同规定的义务后，若无异议，则本合同视为自动清算。",
  art6_4: "Hợp đồng này có hiệu lực kể từ ngày ký.",
  art6_4B: "本合同自签署之日起生效。",
  art6_5: "Hợp đồng này được lập thành hai (02) bản song ngữ tiếng Việt và tiếng Trung. Mỗi bên giữ một (01) bản có giá trị như nhau. Trong trường hợp có sự sai khác giữa tiếng Việt và tiếng Trung thì tiếng Việt sẽ là căn cứ quyết định.",
  art6_5B: "本合同以越南文和中文（简体）两种文字制作，一式两份，双方各执一份，具有同等效力。如越南文与中文有不一致之处，以越南文为准。",
  itemsHeader: ["STT","HÀNG HÓA / DỊCH VỤ","SL","ĐVT","ĐƠN GIÁ","VAT","THÀNH TIỀN"],
  itemsHeaderB: ["序号","货物/服务","数量","单位","单价","税率","金额"],
  rowTotal: "THÀNH TIỀN:", rowTotalB: "小计：",
  rowVat: (l) => `VAT (${l})`, rowVatB: (l) => `增值税 (${l})`,
  rowGrand: "TỔNG CỘNG:", rowGrandB: "合计：",
  signSeller: "ĐẠI DIỆN BÊN BÁN", signSellerB: "卖方代表",
  signBuyer: "ĐẠI DIỆN BÊN MUA", signBuyerB: "买方代表",
};

export default function ContractModal({ quote, onClose }) {
  const { subtotal, vat, total } = calcItems(quote.items, quote.vatRate);
  const today = new Date();
  const defaultDateObj = { day: String(today.getDate()).padStart(2,"0"), month: String(today.getMonth()+1).padStart(2,"0"), year: String(today.getFullYear()) };
  const autoNum = generateContractNumber(defaultDateObj, quote.id);

  const DEFAULT_FORM = {
    contractNumber: autoNum,
    contractDate: defaultDateObj,
    buyerName: quote.customer || "",
    buyerNameEn: "",
    buyerRep: quote.contact || "",
    buyerRepEn: "",
    buyerPosition: "",
    buyerPositionEn: "",
    buyerAddress: quote.address || "",
    buyerAddressEn: "",
    buyerTel: quote.phone || "",
    buyerTaxCode: quote.taxId || "",
    buyerAccountNo: "",
    buyerBank: "",
    buyerBankEn: "",
    deliveryDays: "05",
    deliveryPlace: quote.address || "",
    deliveryPlaceEn: "",
    paymentTerm: `thanh toán 100% giá trị hợp đồng tương đương ${fmt(total)} VNĐ (${numberToWordsVN(total)}) sau khi bàn giao và lắp đặt thiết bị.`,
    paymentTermEn: "",
    paymentTermZh: "",
    art1_2_vi: "1.2 Chất lượng: Hàng mới 100%",
    art1_2_b: "",
    art1_3_vi: "",
    art1_3_b: "",
    art4_1_vi: "", art4_1_b: "",
    art4_2_vi: "", art4_2_b: "",
    art4_3_vi: "", art4_3_b: "",
    art4_4_vi: "", art4_4_b: "",
    art5_vi: "",   art5_b: "",
    art6_1_vi: "", art6_1_b: "",
    art6_2_vi: "", art6_2_b: "",
    art6_3_vi: "", art6_3_b: "",
    art6_4_vi: "", art6_4_b: "",
    art6_5_vi: "", art6_5_b: "",
  };

  const [lang, setLang] = useState("vi_en");
  const [form, setForm] = useState(DEFAULT_FORM);
  const [loaded, setLoaded] = useState(false);
  const [wordLoading, setWordLoading] = useState(false);
  const [pdfLoadingC, setPdfLoadingC] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [translating, setTranslating] = useState(false);

  const [fontSize, setFontSize] = useState(12);          
  const [lineSpacing, setLineSpacing] = useState(1.45);
  const [tablePadding, setTablePadding] = useState(6);
  const [pageMargins, setPageMargins] = useState({ top: 20, right: 20, bottom: 20, left: 30 }); 

  const defaultQualityVi = "1.2 Chất lượng: Hàng mới 100%";
  const defaultQualityB = lang === "vi_en" ? "1.2 Quality: 100% Brand New" : "1.2 质量：全新100%";
  const qualityVi = form.art1_2_vi !== undefined && form.art1_2_vi !== "" ? form.art1_2_vi : defaultQualityVi;
  const qualityB = form.art1_2_b || defaultQualityB;

  const defaultDocListVi = `1.3 Chứng từ thanh toán:\nBên Bán sẽ cung cấp cho bên Mua các chứng từ sau đây:\n- Hợp đồng mua bán\n- Báo giá\n- Đơn đặt hàng\n- Biên bản bàn giao kèm phiếu bảo hành\n- Đề nghị thanh toán\n- Hóa đơn GTGT`;
  const defaultDocListEn = `1.3 Documents required:\nThe Seller shall provide the documents to the Buyer with following:\n- Sales contract\n- Quotation\n- Purchase order\n- Handover minutes with warranty certificate attached\n- Payment request\n- VAT Invoice`;
  const defaultDocListZh = `1.3 付款单据：\n卖方应向买方提供以下单据：\n- 买卖合同\n- 报价单\n- 订购单\n- 附带保修单的交接记录\n- 付款申请书\n- 增值税发票`;
  const defaultArt13B = lang === "vi_en" ? defaultDocListEn : defaultDocListZh;

  const art13ViText = form.art1_3_vi !== undefined && form.art1_3_vi !== "" ? form.art1_3_vi : defaultDocListVi;
  const art13BText = form.art1_3_b || defaultArt13B;
  const art13ViLines = art13ViText.split("\n").map(s => s.trim()).filter(Boolean);
  const art13BLines = art13BText.split("\n").map(s => s.trim()).filter(Boolean); 

  useEffect(() => {
    loadContract(quote.id).then(saved => {
      if (saved) {
        const { quoteId, ...rest } = saved;
        const savedDate = rest.contractDate || defaultDateObj;
        const finalNum = rest.contractNumber || generateContractNumber(savedDate, quote.id);
        setForm(prev => ({ ...DEFAULT_FORM, ...rest,
          contractNumber: finalNum,
          buyerName: rest.buyerName || quote.customer || "",
          buyerRep:  rest.buyerRep  || quote.contact  || "",
          buyerAddress: rest.buyerAddress || quote.address || "",
          buyerTel:  rest.buyerTel  || quote.phone   || "",
          buyerTaxCode: rest.buyerTaxCode || quote.taxId || "",
        }));
        if (rest.lang) setLang(rest.lang);
        if (rest.fontSize) setFontSize(rest.fontSize);
        if (rest.lineSpacing) setLineSpacing(rest.lineSpacing);
        if (rest.tablePadding) setTablePadding(rest.tablePadding);
        if (rest.pageMargins) setPageMargins(rest.pageMargins);
      }
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, [quote.id]);

  const setField = (f, v) => setForm(p => ({...p, [f]: v}));
  const T = lang === "vi_en" ? CONTRACT_TEXT.vi_en : CONTRACT_TEXT_VI_ZH;

  const clause = (viKey, tDefault) => form[viKey] || tDefault;
  const clauseB = (bKey, tDefault) => form[bKey] || tDefault;

  const paymentB = lang === "vi_en"
    ? (form.paymentTermEn || `Pay 100% of the contract value equivalent to ${fmt(total)} VND (${numberToWordsEN(total)}) after handover and installation of the equipment.`)
    : (form.paymentTermZh || `合同总价值的100%，相当于 ${fmt(total)} 越南盾（${numberToWordsCN(total)}），在设备交接安装完成后支付。`);

  const handleSave = async () => {
    await saveContract(quote.id, { ...form, lang, fontSize, lineSpacing, tablePadding, pageMargins });
    setSaveMsg("✓ Đã lưu");
    setTimeout(() => setSaveMsg(""), 2000);
  };

  const handleAutoTranslate = async () => {
    setTranslating(true);
    const targetLangCode = lang === "vi_en" ? "en" : "zh-CN";

    const POSITION_DICT = {
      en: {
        "giám đốc": "Director",
        "giam doc": "Director",
        "giám đốc công ty": "Company Director",
        "tổng giám đốc": "General Director",
        "phó giám đốc": "Deputy Director",
        "phó tổng giám đốc": "Deputy General Director",
        "chủ tịch": "Chairman",
        "chủ tịch hội đồng quản trị": "Chairman of the Board",
        "chủ tịch hđqt": "Chairman of the Board",
        "trưởng phòng": "Department Head",
        "kế toán trưởng": "Chief Accountant",
        "đại diện pháp luật": "Legal Representative"
      },
      "zh-CN": {
        "giám đốc": "总经理",
        "giam doc": "总经理",
        "giám đốc công ty": "公司总经理",
        "tổng giám đốc": "总经理",
        "phó giám đốc": "副总经理",
        "phó tổng giám đốc": "副总经理",
        "chủ tịch": "董事长",
        "trưởng phòng": "部门经理",
        "kế toán trưởng": "财务总监",
        "đại diện pháp luật": "法定代表人"
      }
    };

    try {
      const translateOne = async (str, isPosition = false) => {
        if (!str || !str.trim()) return "";
        const cleanStr = str.trim().toLowerCase();
        
        if (isPosition && POSITION_DICT[targetLangCode] && POSITION_DICT[targetLangCode][cleanStr]) {
          return POSITION_DICT[targetLangCode][cleanStr];
        }

        try {
          const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=vi&tl=${targetLangCode}&dt=t&q=${encodeURIComponent(str.trim())}`;
          const res = await fetch(url);
          const data = await res.json();
          if (data && data[0]) {
            let resStr = data[0].map(s => s[0]).join("");
            if (isPosition && targetLangCode === "en") {
              resStr = resStr.replace(/\bmanager\b/gi, "Director");
            }
            return resStr;
          }
        } catch (_) {}

        if (isPosition && targetLangCode === "en" && cleanStr.includes("giám đốc")) {
          return "Director";
        }
        return str;
      };

      const [buyerNameEn, buyerRepEn, buyerPositionEn, buyerAddressEn, buyerBankEn, deliveryPlaceEn, paymentTermTrans] = await Promise.all([
        translateOne(form.buyerName),
        translateOne(form.buyerRep),
        translateOne(form.buyerPosition, true),
        translateOne(form.buyerAddress),
        translateOne(form.buyerBank),
        translateOne(form.deliveryPlace),
        translateOne(form.paymentTerm),
      ]);

      const termKey = lang === "vi_en" ? "paymentTermEn" : "paymentTermZh";
      setForm(p => ({
        ...p,
        buyerNameEn: buyerNameEn || p.buyerName,
        buyerRepEn: buyerRepEn || p.buyerRep,
        buyerPositionEn: buyerPositionEn || p.buyerPosition,
        buyerAddressEn: buyerAddressEn || p.buyerAddress,
        buyerBankEn: buyerBankEn || p.buyerBank,
        deliveryPlaceEn: deliveryPlaceEn || p.deliveryPlace,
        [termKey]: paymentTermTrans || p[termKey]
      }));
      setSaveMsg("✓ Đã dịch tự động xong!");
      setTimeout(() => setSaveMsg(""), 3000);
    } catch (e) {
      alert("Lỗi dịch tự động: " + e.message);
    } finally {
      setTranslating(false);
    }
  };

  const itemRowsHtml = quote.items.map((it,i) => {
    const line = (it.qty||0)*(it.price||0);
    const iRate = it.vatRate !== undefined ? it.vatRate : (quote.vatRate !== undefined ? quote.vatRate : 8);
    const iLabel = iRate === -1 ? "KCT" : (iRate||0)+"%";
    const cellBorder = "1px solid #1a2540";
    return (
      <tr key={it.id}>
        <td style={{ border: cellBorder, padding: `${tablePadding}px 4px`, textAlign: "center", verticalAlign: "top", whiteSpace: "nowrap" }}>{i+1}</td>
        <td style={{ border: cellBorder, padding: `${tablePadding}px 6px`, textAlign: "left", verticalAlign: "top", wordBreak: "break-word", overflowWrap: "break-word" }}>
          <div style={{ fontWeight: 600 }}>{it.name}</div>
          {it.note ? <div style={{ fontSize: `${fontSize*0.85}pt`, color: "#555", fontStyle: "italic", whiteSpace: "pre-wrap", marginTop: 2 }}>{it.note}</div> : null}
        </td>
        <td style={{ border: cellBorder, padding: `${tablePadding}px 4px`, textAlign: "center", verticalAlign: "top", whiteSpace: "nowrap" }}>{it.qty}</td>
        <td style={{ border: cellBorder, padding: `${tablePadding}px 6px`, textAlign: "center", verticalAlign: "top", whiteSpace: "nowrap" }}>{it.unit || "Cái"}</td>
        <td style={{ border: cellBorder, padding: `${tablePadding}px 6px`, textAlign: "right", verticalAlign: "top", fontWeight: 600, whiteSpace: "nowrap" }}>{fmt(it.price)}</td>
        <td style={{ border: cellBorder, padding: `${tablePadding}px 4px`, textAlign: "center", verticalAlign: "top", whiteSpace: "nowrap" }}>{iLabel}</td>
        <td style={{ border: cellBorder, padding: `${tablePadding}px 6px`, textAlign: "right", verticalAlign: "top", fontWeight: 600, whiteSpace: "nowrap" }}>{fmt(line)}</td>
      </tr>
    );
  });

  const handleWord = async () => {
    const colW = [540, 3600, 540, 810, 1350, 540, 1620];
    const totalW = colW.reduce((a,b)=>a+b,0);

    const SZ     = Math.round(fontSize * 2);       
    const SZ_SM  = Math.round(fontSize * 1.8);     
    const SZ_H1  = Math.round(fontSize * 2.8);     
    const SZ_H2  = Math.round(fontSize * 2.4);     
    const SZ_LG  = Math.round(fontSize * 2.2);     
    const SZ_XSM = Math.round(fontSize * 1.6);     

    const mmToTwips = mm => Math.round(mm * 56.7);

    const partyBlock = (titleVi, titleEn, name, nameEn, rep, repEn, pos, posEn, addr, addrEn, tel, taxCode, accNo, bankName, bankNameEn) => {
      const rows = [];
      rows.push(dxBi(`${titleVi}: ${name}`, `${titleEn}: ${nameEn||name}`, {bold:true, gap:40, size:SZ}));
      if (rep)      rows.push(dxBi(`${T.rep}: ${rep}`, `${T.repB}: ${repEn||rep}`, {gap:20, size:SZ}));
      if (pos)      rows.push(dxBi(`${T.position}: ${pos}`, `${T.positionB}: ${posEn||pos}`, {gap:20, size:SZ}));
      if (addr)     rows.push(dxBi(`${T.address}: ${addr}`, `${T.addressB}: ${addrEn||addr}`, {gap:20, size:SZ}));
      if (tel)      rows.push(dxBi(`${T.tel}: ${tel}`, `${T.telB}: ${tel}`, {gap:20, size:SZ}));
      if (taxCode)  rows.push(dxBi(`${T.taxCode}: ${taxCode}`, `${T.taxCodeB}: ${taxCode}`, {gap:20, size:SZ}));
      if (accNo)    rows.push(dxBi(`${T.accountNo}: ${accNo}`, `${T.accountNoB}: ${accNo}`, {gap:20, size:SZ}));
      if (bankName) rows.push(dxBi(`${T.atBank}: ${bankName}`, `${T.atBankB}: ${bankNameEn||bankName}`, {gap:80, size:SZ}));
      return rows.join("");
    };

    const dxHeading = (vi, other) => [
      dxPara([{text: vi, bold:true}], {size:SZ_H2, spaceBefore:160, spaceAfter:0}),
      dxPara([{text: other, italic:true, color:"000000"}], {size:SZ_LG, spaceBefore:0, spaceAfter:80}),
    ].join("");

    const headerRow = dxRow(T.itemsHeader.map((h,i) => dxHeaderCell(h, T.itemsHeaderB[i], colW[i])), {header:true});
    const itemRows = quote.items.map((it, i) => {
      const line = (it.qty||0)*(it.price||0);
      const iRate = it.vatRate !== undefined ? it.vatRate : (quote.vatRate !== undefined ? quote.vatRate : 8);
      const vatLbl = iRate === -1 ? "KCT" : (iRate||0)+"%";
      const nameParas = [dxPara(it.name, {size:SZ})];
      if (it.note) {
        it.note.split("\n").forEach(line => {
          nameParas.push(dxPara([{text:line, italic:true, color:"000000"}], {size:SZ_XSM, spaceAfter:0}));
        });
      }
      return dxRow([
        dxCell(dxPara(String(i+1), {align:"center", size:SZ}), colW[0]),
        dxCell(nameParas, colW[1]),
        dxCell(dxPara(String(it.qty), {align:"center", size:SZ}), colW[2]),
        dxCell(dxPara(it.unit, {align:"center", size:SZ}), colW[3]),
        dxCell(dxPara(fmt(it.price), {align:"right", size:SZ}), colW[4]),
        dxCell(dxPara(vatLbl, {align:"center", size:SZ}), colW[5]),
        dxCell(dxPara(fmt(line), {align:"right", size:SZ}), colW[6]),
      ]);
    });

    const itemsTable = dxTable([
      headerRow, 
      ...itemRows,
      dxRow([
        dxCell([
          dxPara(T.rowTotal, {align:"right", bold:true, size:SZ, spaceAfter:0}),
          dxPara(T.rowTotalB, {align:"right", italic:true, color:"000000", size:SZ_SM}),
        ], colW.slice(0,6).reduce((a,b)=>a+b,0), {span:6}),
        dxCell(dxPara(fmt(subtotal), {align:"right", bold:true, size:SZ}), colW[6]),
      ]),
      dxRow([
        dxCell([
          dxPara(T.rowVat(vatLabel(quote.vatRate)), {align:"right", bold:true, size:SZ, spaceAfter:0}),
          dxPara(T.rowVatB(vatLabel(quote.vatRate)), {align:"right", italic:true, color:"000000", size:SZ_SM}),
        ], colW.slice(0,6).reduce((a,b)=>a+b,0), {span:6}),
        dxCell(dxPara(fmt(vat), {align:"right", bold:true, size:SZ}), colW[6]),
      ]),
      dxRow([
        dxCell([
          dxPara(T.rowGrand, {align:"right", bold:true, size:SZ, spaceAfter:0}),
          dxPara(T.rowGrandB, {align:"right", italic:true, color:"000000", size:SZ_SM}),
        ], colW.slice(0,6).reduce((a,b)=>a+b,0), {span:6}),
        dxCell(dxPara(fmt(total), {align:"right", bold:true, size:SZ}), colW[6]),
      ]),
    ], totalW);

    const signRow = dxRow([
      dxNoBorderCell([
        dxPara(T.signSeller, {align:"center", bold:true, spaceAfter:0, size:SZ}),
        dxPara(T.signSellerB, {align:"center", italic:true, color:"000000", size:SZ_SM, spaceAfter:240}),
        "<w:p/>","<w:p/>","<w:p/>",
        dxPara("(Ký, ghi rõ họ tên)", {align:"center", italic:true, size:SZ_SM, spaceAfter:0}),
        dxPara(COMPANY.representative, {align:"center", bold:true, size:SZ}),
      ], 4500),
      dxNoBorderCell([
        dxPara(T.signBuyer, {align:"center", bold:true, spaceAfter:0, size:SZ}),
        dxPara(T.signBuyerB, {align:"center", italic:true, color:"000000", size:SZ_SM, spaceAfter:240}),
        "<w:p/>","<w:p/>","<w:p/>",
        dxPara("(Ký, ghi rõ họ tên)", {align:"center", italic:true, size:SZ_SM, spaceAfter:0}),
        dxPara(form.buyerRep||"", {align:"center", bold:true, size:SZ}),
      ], 4500),
    ]);

    const body = [
      dxBi(T.natTitle1, T.natTitle1b, {bold:true, align:"center", size:SZ_LG, gap:20}),
      dxBi(T.natTitle2, T.natTitle2b, {bold:true, align:"center", size:SZ, gap:200}),
      dxBi(T.title, T.titleB, {bold:true, align:"center", size:SZ_H1, gap:60}),
      dxPara(`Số/No: ${form.contractNumber||"......"}`, {align:"center", size:SZ_SM, color:"000000", spaceAfter:160}),
      dxBi(T.legalBasis, T.legalBasisB, {gap:120, size:SZ}),
      dxBi(T.today(form.contractDate), T.todayB(form.contractDate), {gap:160, size:SZ}),

      partyBlock(T.seller, T.sellerB, COMPANY.name, COMPANY.nameEn, COMPANY.representative, COMPANY.representativeEn, COMPANY.position, COMPANY.positionEn, COMPANY.address, COMPANY.addressEn, COMPANY.phone, COMPANY.mst, COMPANY.bankAccount, COMPANY.bankName, COMPANY.bankNameEn),
      "<w:p/>",
      partyBlock(T.buyer, T.buyerB, form.buyerName, form.buyerNameEn||form.buyerName, form.buyerRep, form.buyerRepEn, form.buyerPosition, form.buyerPositionEn, form.buyerAddress, form.buyerAddressEn, form.buyerTel, form.buyerTaxCode, form.buyerAccountNo, form.buyerBank, form.buyerBankEn),
      "<w:p/>",
      dxBi(T.agree, T.agreeB, {gap:160, size:SZ}),

      dxHeading(T.art1, T.art1B),
      dxBi(`1.1 ${T.art1_1}`, T.art1_1B, {gap:40, size:SZ}),
      dxBi(T.art1_desc, T.art1_descB, {gap:80, size:SZ}),
      itemsTable,
      dxPara(T.inWords(numberToWordsVN(total)), {align:"right", bold:true, size:SZ_LG, spaceAfter:0}),
      dxPara(T.inWordsB(lang==="vi_en"?numberToWordsEN(total):numberToWordsCN(total)), {align:"right", italic:true, color:"000000", size:SZ, spaceAfter:120}),
      dxBi(qualityVi, qualityB, {gap:40, size:SZ}),
      ...art13ViLines.map((vLine, idx) => {
        const bLine = art13BLines[idx] || "";
        return dxBi(vLine, bLine, {gap:20, size:SZ});
      }),
      "<w:p/>",

      dxHeading(T.art2, T.art2B),
      dxBi(`${T.art2_lead}: ${form.paymentTerm}`, `${T.art2_leadB}: ${paymentB}`, {gap:160, size:SZ}),

      dxHeading(T.art3, T.art3B),
      dxBi(T.art3_1(form.deliveryDays), T.art3_1B(form.deliveryDays), {gap:40, size:SZ}),
      dxBi(T.art3_2(form.deliveryPlace), T.art3_2B(form.deliveryPlaceEn||form.deliveryPlace), {gap:160, size:SZ}),

      dxHeading(T.art4, T.art4B),
      dxBi(clause("art4_1_vi",T.art4_1), clauseB("art4_1_b",T.art4_1B), {gap:40, size:SZ}),
      dxBi(clause("art4_2_vi",T.art4_2), clauseB("art4_2_b",T.art4_2B), {gap:40, size:SZ}),
      dxBi(clause("art4_3_vi",T.art4_3), clauseB("art4_3_b",T.art4_3B), {gap:40, size:SZ}),
      dxBi(clause("art4_4_vi",T.art4_4), clauseB("art4_4_b",T.art4_4B), {gap:160, size:SZ}),

      dxHeading(T.art5, T.art5B),
      dxBi(clause("art5_vi",T.art5_body), clauseB("art5_b",T.art5_bodyB), {gap:160, size:SZ}),

      dxHeading(T.art6, T.art6B),
      dxBi(`6.1 ${clause("art6_1_vi",T.art6_1)}`, `6.1 ${clauseB("art6_1_b",T.art6_1B)}`, {gap:40, size:SZ}),
      dxBi(`6.2 ${clause("art6_2_vi",T.art6_2)}`, `6.2 ${clauseB("art6_2_b",T.art6_2B)}`, {gap:40, size:SZ}),
      dxBi(`6.3 ${clause("art6_3_vi",T.art6_3)}`, `6.3 ${clauseB("art6_3_b",T.art6_3B)}`, {gap:40, size:SZ}),
      dxBi(`6.4 ${clause("art6_4_vi",T.art6_4)}`, `6.4 ${clauseB("art6_4_b",T.art6_4B)}`, {gap:40, size:SZ}),
      dxBi(`6.5 ${clause("art6_5_vi",T.art6_5)}`, `6.5 ${clauseB("art6_5_b",T.art6_5B)}`, {gap:240, size:SZ}),

      dxNoBorderTable([signRow], 9000),
    ];

    const blob = await buildDocxBlob(body, {}, {
      top:    mmToTwips(pageMargins.top),
      bottom: mmToTwips(pageMargins.bottom),
      left:   mmToTwips(pageMargins.left),
      right:  mmToTwips(pageMargins.right),
      header: 0,
      footer: 0,
    });
    downloadBlob(blob, "HopDong_" + (form.contractNumber || quote.quoteNumber) + ".docx");
  };

  const handleWordClick = async () => {
    setWordLoading(true);
    try {
      await saveContract(quote.id, { ...form, lang, fontSize, pageMargins });
      await handleWord();
    } catch(e) { alert("Lỗi xuất Word: " + e.message); } finally { setWordLoading(false); }
  };

  const handlePDFClick = async () => {
    setPdfLoadingC(true);
    const contractPdfName = "HopDong_" + (form.contractNumber || quote.quoteNumber) + ".pdf";
    try {
      const el = document.getElementById("contract-preview-area");
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
            #contract-preview-area { width: 100% !important; max-width: 100% !important; margin: 0 !important; font-size: ${fontSize}pt !important; line-height: ${lineSpacing} !important; }
            table { width: 100% !important; border-collapse: collapse !important; table-layout: fixed !important; margin: 10px 0 !important; }
            th, td { border: 1px solid #1a2540 !important; }
            th { background-color: #f1f5f9 !important; -webkit-print-color-adjust: exact; }
            td:nth-child(1), td:nth-child(3), td:nth-child(4), td:nth-child(5), td:nth-child(6), td:nth-child(7) { white-space: nowrap !important; }
            td:nth-child(2) { word-break: break-word !important; overflow-wrap: break-word !important; }
            .no-print { display: none !important; }
          </style>
        </head><body>${el.outerHTML}</body></html>`;

        const puppeteerOk = await exportViaPuppeteer(documentHtml, contractPdfName);
        if (puppeteerOk) {
          return;
        }
      }

      if (lang === "vi_zh") {
        const FS       = fontSize || 12;
        const FS_SM    = Math.round(FS * 0.88 * 10) / 10;
        const FS_LG    = Math.round(FS * 1.1  * 10) / 10;
        const FS_TITLE = Math.round(FS * 1.55 * 10) / 10;
        const COL_NAVY = "#000000";
        const COL_GRAY = "#000000";
        const COL_LIGHT= "#000000";

        const paymentB_zh = form.paymentTermZh ||
          `合同总价值的100%，相当于 ${fmt(total)} 越南盾（${numberToWordsCN(total)}），在设备交接安装完成后支付。`;

        const biRow = (vi, zh) =>
          `<p style="margin:0 0 1px;font-size:${FS}pt;color:#000">${vi}</p>
           <p style="margin:0 0 4px;font-size:${FS_SM}pt;color:${COL_GRAY};font-style:italic">${zh}</p>`;

        const artHead = (vi, zh) =>
          `<p style="margin:10px 0 1px;font-size:${FS_LG}pt;font-weight:700;color:${COL_NAVY};text-transform:uppercase">${vi}</p>
           <p style="margin:0 0 5px;font-size:${FS_SM}pt;color:${COL_GRAY};font-style:italic">${zh}</p>`;

        const partyHtml = (titleVi, titleZh, name, nameZh, rep, repZh, pos, posZh, addr, addrZh, tel, taxCode, accNo, bankVi, bankZh) => {
          let h = biRow(`<b>${titleVi}: ${name}</b>`, `<b>${titleZh}: ${nameZh||name}</b>`);
          if (rep)     h += biRow(`${T.rep}: ${rep}`,        `${T.repB}: ${repZh||rep}`);
          if (pos)     h += biRow(`${T.position}: ${pos}`,    `${T.positionB}: ${posZh||pos}`);
          if (addr)    h += biRow(`${T.address}: ${addr}`,    `${T.addressB}: ${addrZh||addr}`);
          if (tel)     h += biRow(`${T.tel}: ${tel}`,          `${T.telB}: ${tel}`);
          if (taxCode) h += biRow(`${T.taxCode}: ${taxCode}`,  `${T.taxCodeB}: ${taxCode}`);
          if (accNo)   h += biRow(`${T.accountNo}: ${accNo}`,  `${T.accountNoB}: ${accNo}`);
          if (bankVi)  h += biRow(`${T.atBank}: ${bankVi}`,    `${T.atBankB}: ${bankZh||bankVi}`);
          return h;
        };

        const tdS = (align, extra) =>
          `style="padding:${tablePadding}px 4px;border:0.5px solid #aaa;font-size:${FS_SM}pt;text-align:${align};vertical-align:top;${extra||''}"`;

        let itemRowsHtml2 = "";
        quote.items.forEach((it, i) => {
          const line = (it.qty||0)*(it.price||0);
          const iRate = it.vatRate !== undefined ? it.vatRate : (quote.vatRate !== undefined ? quote.vatRate : 8);
          const iLabel = iRate === -1 ? "KCT" : (iRate||0)+"%";
          itemRowsHtml2 += `<tr>
            <td ${tdS("center", "white-space:nowrap")}>${i+1}</td>
            <td ${tdS("left", "word-break:break-word;overflow-wrap:break-word")}>${it.name}${it.note?`<div style="font-size:${FS_SM*0.85}pt;color:${COL_LIGHT};font-style:italic;white-space:pre-wrap">${it.note}</div>`:""}</td>
            <td ${tdS("center", "white-space:nowrap")}>${it.qty}</td>
            <td ${tdS("center", "white-space:nowrap")}>${it.unit||"Cái"}</td>
            <td ${tdS("right", "white-space:nowrap")}>${fmt(it.price)}</td>
            <td ${tdS("center", "white-space:nowrap")}>${iLabel}</td>
            <td ${tdS("right", "white-space:nowrap")}>${fmt(line)}</td>
          </tr>`;
        });

        const thS = `style="padding:${tablePadding}px 4px;border:0.5px solid #aaa;font-size:${FS_SM}pt;font-weight:700;background:#f0f0f0;text-align:center"`;
        const tableHtml = `
          <table style="width:100%;border-collapse:collapse;margin:4px 0;table-layout:fixed">
            <colgroup>
              <col style="width:6%" />
              <col style="width:40%" />
              <col style="width:6%" />
              <col style="width:9%" />
              <col style="width:15%" />
              <col style="width:6%" />
              <col style="width:18%" />
            </colgroup>
            <thead><tr>
              ${T.itemsHeader.map((h,i)=>`<th ${thS}>${h}<br><span style="font-size:${FS_SM*0.82}pt;color:${COL_LIGHT};font-weight:normal;font-style:italic">${T.itemsHeaderB[i]}</span></th>`).join("")}
            </tr></thead>
            <tbody>
              ${itemRowsHtml2}
              <tr>
                <td colspan="6" ${tdS("right", "")}>
                  <span style="font-size:${FS_SM}pt">${T.rowTotal}</span><br>
                  <span style="font-size:${FS_SM*0.85}pt;color:${COL_GRAY};font-style:italic">${T.rowTotalB}</span>
                </td>
                <td ${tdS("right", "font-weight:700;white-space:nowrap")}>${fmt(subtotal)}</td>
              </tr>
              <tr>
                <td colspan="6" ${tdS("right", "")}>
                  <span style="font-size:${FS_SM}pt">${T.rowVat(vatLabel(quote.vatRate))}</span><br>
                  <span style="font-size:${FS_SM*0.85}pt;color:${COL_GRAY};font-style:italic">${T.rowVatB(vatLabel(quote.vatRate))}</span>
                </td>
                <td ${tdS("right", "font-weight:700")}>${fmt(vat)}</td>
              </tr>
              <tr>
                <td colspan="6" ${tdS("right", "font-weight:700")}>
                  <span style="font-size:${FS_SM}pt">${T.rowGrand}</span><br>
                  <span style="font-size:${FS_SM*0.85}pt;color:${COL_GRAY};font-style:italic">${T.rowGrandB}</span>
                </td>
                <td ${tdS("right", `font-weight:700;color:${COL_NAVY};font-size:${FS_SM*1.05}pt`)}>${fmt(total)}</td>
              </tr>
            </tbody>
          </table>`;

        const signHtml = `
          <table style="width:100%;border-collapse:collapse;margin-top:24px">
            <tr>
              <td style="width:50%;border:none;vertical-align:top;padding:0">
                <div style="width:240px;margin-right:auto;text-align:center">
                  <p style="margin:0;font-size:${FS_SM}pt;font-weight:700">${T.signSeller}</p>
                  <p style="margin:0 0 8px;font-size:${FS_SM*0.85}pt;color:${COL_GRAY};font-style:italic">${T.signSellerB}</p>
                  <p style="margin:0;font-size:${FS_SM*0.85}pt;font-style:italic;color:${COL_GRAY}">(Ký, ghi rõ họ tên)</p>
                  <div style="height:64px"></div>
                  <p style="margin:0;font-size:${FS_SM}pt;font-weight:700">${COMPANY.representative||""}</p>
                </div>
              </td>
              <td style="width:50%;border:none;vertical-align:top;padding:0">
                <div style="width:240px;margin-left:auto;text-align:center">
                  <p style="margin:0;font-size:${FS_SM}pt;font-weight:700">${T.signBuyer}</p>
                  <p style="margin:0 0 8px;font-size:${FS_SM*0.85}pt;color:${COL_GRAY};font-style:italic">${T.signBuyerB}</p>
                  <p style="margin:0;font-size:${FS_SM*0.85}pt;font-style:italic;color:${COL_GRAY}">(Ký, ghi rõ họ tên)</p>
                  <div style="height:64px"></div>
                  <p style="margin:0;font-size:${FS_SM}pt;font-weight:700">${form.buyerRep||""}</p>
                </div>
              </td>
            </tr>
          </table>`;

        const ML = pageMargins.left   || 30;
        const MR = pageMargins.right  || 20;
        const MT = pageMargins.top    || 20;
        const MB = pageMargins.bottom || 20;

        const fullHtml = `
          <div id="contract-preview-area" style="font-family:'Plus Jakarta Sans','Noto Sans SC','PingFang SC','Microsoft YaHei',sans-serif;font-size:${FS}pt;line-height:${lineSpacing};color:#000;background:#fff;padding:${MT}mm ${MR}mm ${MB}mm ${ML}mm;box-sizing:border-box;width:794px">
            <p style="text-align:center;margin:0;font-size:${FS*1.05}pt;font-weight:700">${T.natTitle1}</p>
            <p style="text-align:center;margin:0 0 1px;font-size:${FS_SM}pt;color:${COL_GRAY};font-style:italic">${T.natTitle1b}</p>
            <p style="text-align:center;margin:0;font-size:${FS}pt;font-weight:700">${T.natTitle2}</p>
            <p style="text-align:center;margin:0 0 14px;font-size:${FS_SM}pt;color:${COL_GRAY};font-style:italic">${T.natTitle2b}</p>
            <p style="text-align:center;margin:0;font-size:${FS_TITLE}pt;font-weight:700;color:${COL_NAVY};text-transform:uppercase">${T.title}</p>
            <p style="text-align:center;margin:0 0 2px;font-size:${FS_LG}pt;color:${COL_GRAY};font-style:italic">${T.titleB}</p>
            <p style="text-align:center;margin:0 0 14px;font-size:${FS_SM}pt;color:${COL_LIGHT}">Số/No: ${form.contractNumber||"......"}</p>
            ${biRow(T.legalBasis, T.legalBasisB)}
            ${biRow(T.today(form.contractDate), T.todayB(form.contractDate))}
            <div style="margin-bottom:10px"></div>
            ${partyHtml(T.seller,T.sellerB,COMPANY.name,COMPANY.nameEn,COMPANY.representative,COMPANY.representativeEn,COMPANY.position,COMPANY.positionEn,COMPANY.address,COMPANY.addressEn,COMPANY.phone,COMPANY.mst,COMPANY.bankAccount,COMPANY.bankName,COMPANY.bankNameEn)}
            <div style="margin-bottom:8px"></div>
            ${partyHtml(T.buyer,T.buyerB,form.buyerName,form.buyerNameEn||form.buyerName,form.buyerRep,form.buyerRepEn,form.buyerPosition,form.buyerPositionEn,form.buyerAddress,form.buyerAddressEn,form.buyerTel,form.buyerTaxCode,form.buyerAccountNo,form.buyerBank,form.buyerBankEn)}
            <div style="margin-bottom:8px"></div>
            ${biRow(T.agree, T.agreeB)}
            <div style="margin-bottom:12px"></div>
            ${artHead(T.art1, T.art1B)}
            ${biRow(`<b>1.1 ${T.art1_1}</b>`, T.art1_1B)}
            ${biRow(T.art1_desc, T.art1_descB)}
            ${tableHtml}
            <p style="text-align:right;margin:2px 0 1px;font-size:${FS_SM}pt;font-weight:700">${T.inWords(numberToWordsVN(total))}</p>
            <p style="text-align:right;margin:0 0 8px;font-size:${FS_SM*0.9}pt;color:${COL_GRAY};font-style:italic">${T.inWordsB(numberToWordsCN(total))}</p>
            ${biRow(qualityVi, qualityB)}
            ${art13ViLines.map((vLine, idx) => {
              const bLine = art13BLines[idx] || "";
              const isIndent = vLine.startsWith("-") || vLine.startsWith("•");
              const prefix = isIndent ? "&nbsp;&nbsp;" : "";
              return biRow(`${prefix}${vLine}`, bLine ? `${prefix}${bLine}` : "");
            }).join("")}
            ${artHead(T.art2, T.art2B)}
            ${biRow(`${T.art2_lead}: ${form.paymentTerm}`, `${T.art2_leadB}: ${paymentB_zh}`)}
            <div style="margin-bottom:10px"></div>
            ${artHead(T.art3, T.art3B)}
            ${biRow(T.art3_1(form.deliveryDays), T.art3_1B(form.deliveryDays))}
            ${biRow(T.art3_2(form.deliveryPlace), T.art3_2B(form.deliveryPlaceEn||form.deliveryPlace))}
            <div style="margin-bottom:10px"></div>
            ${artHead(T.art4, T.art4B)}
            ${biRow(clause("art4_1_vi",T.art4_1), clauseB("art4_1_b",T.art4_1B))}
            ${biRow(clause("art4_2_vi",T.art4_2), clauseB("art4_2_b",T.art4_2B))}
            ${biRow(clause("art4_3_vi",T.art4_3), clauseB("art4_3_b",T.art4_3B))}
            ${biRow(clause("art4_4_vi",T.art4_4), clauseB("art4_4_b",T.art4_4B))}
            <div style="margin-bottom:10px"></div>
            ${artHead(T.art5, T.art5B)}
            ${biRow(clause("art5_vi",T.art5_body), clauseB("art5_b",T.art5_bodyB))}
            <div style="margin-bottom:10px"></div>
            ${artHead(T.art6, T.art6B)}
            ${biRow(`6.1 ${clause("art6_1_vi",T.art6_1)}`,`6.1 ${clauseB("art6_1_b",T.art6_1B)}`)}
            ${biRow(`6.2 ${clause("art6_2_vi",T.art6_2)}`,`6.2 ${clauseB("art6_2_b",T.art6_2B)}`)}
            ${biRow(`6.3 ${clause("art6_3_vi",T.art6_3)}`,`6.3 ${clauseB("art6_3_b",T.art6_3B)}`)}
            ${biRow(`6.4 ${clause("art6_4_vi",T.art6_4)}`,`6.4 ${clauseB("art6_4_b",T.art6_4B)}`)}
            ${biRow(`6.5 ${clause("art6_5_vi",T.art6_5)}`,`6.5 ${clauseB("art6_5_b",T.art6_5B)}`)}
            <div style="margin-bottom:16px"></div>
            ${signHtml}
          </div>`;

        const contractPdfName = "HopDong_" + (form.contractNumber || quote.quoteNumber) + ".pdf";
        const documentHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8">
          <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap">
          <style>
            @page { margin:${MT}mm ${MR}mm ${MB}mm ${ML}mm; size:A4; }
            html { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
            body { background:#fff; margin:0; padding:0; font-family:'Plus Jakarta Sans',sans-serif; }
            * { font-family: 'Plus Jakarta Sans', sans-serif !important; }
            .no-print { display:none !important; }
          </style>
        </head><body>${fullHtml}</body></html>`;

        try {
          const puppeteerOk = await exportViaPuppeteer(documentHtml, contractPdfName);
          if (puppeteerOk) {
            setPdfLoadingC(false);
            return;
          }
        } catch (pErr) {
          console.warn("Puppeteer contract PDF export failed, falling back:", pErr);
        }

        await Promise.all([ensureHtml2Canvas(), ensureJsPdf()]);
        const wrapper = document.createElement("div");
        wrapper.style.cssText = "position:fixed;top:-99999px;left:-99999px;width:794px;background:#fff;";
        wrapper.innerHTML = fullHtml;
        document.body.appendChild(wrapper);

        const noCutRanges = [];
        wrapper.querySelectorAll("p, h1, h2, h3, h4, h5, h6, table, tr, ul, ol, blockquote, section, header, footer").forEach(elm => {
          const r = elm.getBoundingClientRect();
          const p = wrapper.getBoundingClientRect();
          noCutRanges.push({ top: r.top - p.top, bottom: r.bottom - p.top });
        });

        const SCALE = 3;
        const canvas = await window.html2canvas(wrapper, {
          scale: SCALE, useCORS: true, allowTaint: true,
          backgroundColor: "#ffffff", logging: false,
          width: 794, height: wrapper.scrollHeight,
          windowWidth: 794, imageTimeout: 0,
        });
        document.body.removeChild(wrapper);

        const { jsPDF } = window.jspdf;
        const MARGIN = 10;
        const printW = 210 - MARGIN * 2, printH = 297 - MARGIN * 2;
        const realW = canvas.width / SCALE, realH = canvas.height / SCALE;
        const mmPerPx = printW / realW, pxPerPage = printH / mmPerPx;
        const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        let srcY = 0, page = 0;

        while (srcY < realH) {
          if (page > 0) doc.addPage();
          let slicePx = Math.min(pxPerPage, realH - srcY);
          if (srcY + slicePx < realH) {
            for (const rng of noCutRanges) {
              if ((srcY + slicePx) > rng.top + 0.5 && (srcY + slicePx) < rng.bottom - 0.5) {
                const adj = rng.top - srcY;
                if (adj > 0) slicePx = adj;
                break;
              }
            }
          }
          const sliceMm = slicePx * mmPerPx;
          const slice = document.createElement("canvas");
          slice.width = canvas.width;
          slice.height = Math.ceil(slicePx * SCALE);
          const ctx = slice.getContext("2d");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, slice.width, slice.height);
          ctx.drawImage(canvas, 0, Math.floor(srcY*SCALE), canvas.width, Math.ceil(slicePx*SCALE), 0, 0, slice.width, slice.height);
          doc.addImage(slice.toDataURL("image/jpeg", 0.92), "JPEG", MARGIN, MARGIN, printW, sliceMm);
          srcY += slicePx;
          page++;
        }

        doc.save("HopDong_" + (form.contractNumber || quote.quoteNumber) + ".pdf");
        return; 
      }

      await ensurePdfMake();
      if (!window.pdfMake) {
        alert("pdfmake chưa load. Kiểm tra kết nối internet và thử lại.");
        return;
      }

      const FS       = fontSize || 12;
      const FS_SM    = Math.round(FS * 0.88 * 10) / 10;
      const FS_LG    = Math.round(FS * 1.1  * 10) / 10;
      const FS_TITLE = Math.round(FS * 1.55 * 10) / 10;
      const FS_NAT   = Math.round(FS * 1.05 * 10) / 10;

      const mmToPt = mm => Math.round(mm * 2.8346 * 10) / 10;
      const ML_pt = mmToPt(pageMargins.left   || 30);
      const MR_pt = mmToPt(pageMargins.right  || 20);
      const MT_pt = mmToPt(pageMargins.top    || 20);
      const MB_pt = mmToPt(pageMargins.bottom || 20);

      const COL_NAVY  = "#000000";
      const COL_GRAY  = "#000000";
      const COL_LIGHT = "#000000";

      const bi = (vi, other, opts) => {
        const o = opts || {};
        return [
          { text: vi, fontSize: o.size || FS, bold: o.bold || false, color: o.color || "#000000", alignment: o.align || "justify", margin: [0, o.spaceBefore || 0, 0, 1] },
          { text: other, fontSize: o.sizeB || FS_SM, italics: true, color: COL_GRAY, alignment: o.align || "justify", margin: [0, 0, 0, o.spaceAfter || 4] },
        ];
      };

      const artHeading = (vi, other) => [
        { text: vi,    fontSize: FS_LG, bold: true, color: COL_NAVY, margin: [0, 10, 0, 1] },
        { text: other, fontSize: FS_SM, italics: true, color: COL_GRAY, margin: [0, 0, 0, 5] },
      ];

      const partyBlock2 = (titleVi, titleEn, name, nameEn, rep, repEn, pos, posEn, addr, addrEn, tel, taxCode, accNo, bankVi, bankEn) => {
        const rows = [];
        rows.push(...bi(titleVi + ": " + name, titleEn + ": " + (nameEn || name), { bold: true, spaceAfter: 1 }));
        if (rep)     rows.push(...bi(T.rep      + ": " + rep,     T.repB      + ": " + (repEn  || rep),     { spaceAfter: 1 }));
        if (pos)     rows.push(...bi(T.position + ": " + pos,     T.positionB + ": " + (posEn  || pos),     { spaceAfter: 1 }));
        if (addr)    rows.push(...bi(T.address  + ": " + addr,    T.addressB  + ": " + (addrEn || addr),    { spaceAfter: 1 }));
        if (tel)     rows.push(...bi(T.tel      + ": " + tel,     T.telB      + ": " + tel,                 { spaceAfter: 1 }));
        if (taxCode) rows.push(...bi(T.taxCode  + ": " + taxCode, T.taxCodeB  + ": " + taxCode,             { spaceAfter: 1 }));
        if (accNo)   rows.push(...bi(T.accountNo+ ": " + accNo,   T.accountNoB+ ": " + accNo,               { spaceAfter: 1 }));
        if (bankVi)  rows.push(...bi(T.atBank   + ": " + bankVi,  T.atBankB   + ": " + (bankEn || bankVi),  { spaceAfter: 8 }));
        return rows;
      };

      const tableHeader = T.itemsHeader.map((h, i) => ({
        stack: [
          { text: h,                 fontSize: FS_SM, bold: true,   color: "#000000" },
          { text: T.itemsHeaderB[i], fontSize: FS_SM * 0.82, italics: true, color: COL_LIGHT },
        ],
        alignment: i === 1 ? "left" : "center",
        margin: [2, 3, 2, 3],
        fillColor: "#F0F0F0",
      }));

      const tableBody = [tableHeader];
      quote.items.forEach((it, i) => {
        const line = (it.qty || 0) * (it.price || 0);
        const iRate = it.vatRate !== undefined ? it.vatRate : (quote.vatRate !== undefined ? quote.vatRate : 8);
        const iLabel = iRate === -1 ? "KCT" : (iRate||0)+"%";
        tableBody.push([
          { text: String(i + 1), alignment: "center", fontSize: FS_SM, margin: [2, 3, 2, 3] },
          { stack: [{ text: it.name, fontSize: FS_SM }, ...(it.note ? [{ text: it.note, fontSize: FS_SM * 0.85, italics: true, color: COL_LIGHT }] : [])], margin: [2, 3, 2, 3] },
          { text: String(it.qty), alignment: "center", fontSize: FS_SM, margin: [2, 3, 2, 3] },
          { text: it.unit,        alignment: "center", fontSize: FS_SM, margin: [2, 3, 2, 3] },
          { text: fmt(it.price),  alignment: "right",  fontSize: FS_SM, margin: [2, 3, 2, 3] },
          { text: iLabel,         alignment: "center", fontSize: FS_SM, margin: [2, 3, 2, 3] },
          { text: fmt(line),      alignment: "right",  fontSize: FS_SM, margin: [2, 3, 2, 3] },
        ]);
      });

      // Cộng tiền hàng (chưa VAT)
      tableBody.push([
        { colSpan: 5, stack: [{ text: T.rowTotal, alignment: "right", fontSize: FS_SM }, { text: T.rowTotalB, alignment: "right", italics: true, color: COL_GRAY, fontSize: FS_SM * 0.85 }], border: [true,true,true,true], margin: [2,3,4,3] },
        {}, {}, {}, {},
        { text: fmt(subtotal), alignment: "right", fontSize: FS_SM, margin: [2,3,2,3] },
        { text: "", margin: [2,3,2,3] },
      ]);

      // Thuế GTGT
      tableBody.push([
        { colSpan: 6, stack: [{ text: T.rowVat(vatLabel(quote.vatRate)), alignment: "right", fontSize: FS_SM }, { text: T.rowVatB(vatLabel(quote.vatRate)), alignment: "right", italics: true, color: COL_GRAY, fontSize: FS_SM * 0.85 }], border: [true,true,true,true], margin: [2,3,4,3] },
        {}, {}, {}, {}, {},
        { text: fmt(vat), alignment: "right", fontSize: FS_SM, margin: [2,3,2,3] }
      ]);

      // Tổng cộng
      tableBody.push([
        { colSpan: 6, stack: [{ text: T.rowGrand, alignment: "right", bold: true, fontSize: FS_SM }, { text: T.rowGrandB, alignment: "right", italics: true, color: COL_GRAY, fontSize: FS_SM * 0.85 }], border: [true,true,true,true], margin: [2,3,4,3] },
        {}, {}, {}, {}, {},
        { text: fmt(total), alignment: "right", bold: true, fontSize: FS_SM*1.05, color: COL_NAVY, margin: [2,3,2,3] }
      ]);

      const itemsTable2 = {
        table: { headerRows: 1, widths: [28, "*", 30, 32, 58, 42, 64], body: tableBody },
        layout: { hLineWidth: function() { return 0.5; }, vLineWidth: function() { return 0.5; }, hLineColor: function() { return "#AAAAAA"; }, vLineColor: function() { return "#AAAAAA"; } },
        margin: [0, 4, 0, 4],
      };

      const signTable2 = {
        table: { widths: [200, "*", 200], body: [[
          { stack: [{ text: T.signSeller, bold: true, fontSize: FS_SM, alignment: "center" }, { text: T.signSellerB, italics: true, fontSize: FS_SM*0.85, color: COL_GRAY, alignment: "center" }, { text: "\n\n\n\n", fontSize: FS_SM }, { text: "(Ký, ghi rõ họ tên)", italics: true, fontSize: FS_SM*0.85, alignment: "center" }, { text: COMPANY.representative, bold: true, fontSize: FS_SM, alignment: "center" }], border: [false,false,false,false] },
          { text: "", border: [false,false,false,false] },
          { stack: [{ text: T.signBuyer,  bold: true, fontSize: FS_SM, alignment: "center" }, { text: T.signBuyerB,  italics: true, fontSize: FS_SM*0.85, color: COL_GRAY, alignment: "center" }, { text: "\n\n\n\n", fontSize: FS_SM }, { text: "(Ký, ghi rõ họ tên)", italics: true, fontSize: FS_SM*0.85, alignment: "center" }, { text: form.buyerRep||"", bold: true, fontSize: FS_SM, alignment: "center" }], border: [false,false,false,false] },
        ]]},
        margin: [0, 24, 0, 0],
      };

      const paymentB_en2 = form.paymentTermEn ||
        `Pay 100% of the contract value equivalent to ${fmt(total)} VND (${numberToWordsEN(total)}) after handover and installation of the equipment.`;

      const docDefinition = {
        pageSize: "A4",
        pageMargins: [ML_pt, MT_pt, MR_pt, MB_pt],
        defaultStyle: { font: "Roboto", fontSize: FS, lineHeight: 1.45 },
        content: [
          ...bi(T.natTitle1, T.natTitle1b, { bold:true, align:"center", size:FS_NAT, spaceAfter:1 }),
          ...bi(T.natTitle2, T.natTitle2b, { bold:true, align:"center", size:FS_SM,  spaceAfter:14 }),
          { text: T.title,  bold:true, fontSize:FS_TITLE, color:COL_NAVY, alignment:"center", margin:[0,0,0,2] },
          { text: T.titleB, italics:true, fontSize:FS_LG, color:COL_GRAY, alignment:"center", margin:[0,0,0,2] },
          { text: "So/No: "+(form.contractNumber||"......"), fontSize:FS_SM, color:COL_LIGHT, alignment:"center", margin:[0,0,0,14] },
          ...bi(T.legalBasis, T.legalBasisB, { spaceAfter:8 }),
          ...bi(T.today(form.contractDate), T.todayB(form.contractDate), { spaceAfter:10 }),
          ...partyBlock2(T.seller,T.sellerB,COMPANY.name,COMPANY.nameEn,COMPANY.representative,COMPANY.representativeEn,COMPANY.position,COMPANY.positionEn,COMPANY.address,COMPANY.addressEn,COMPANY.phone,COMPANY.mst,COMPANY.bankAccount,COMPANY.bankName,COMPANY.bankNameEn),
          ...partyBlock2(T.buyer,T.buyerB,form.buyerName,form.buyerNameEn||form.buyerName,form.buyerRep,form.buyerRepEn,form.buyerPosition,form.buyerPositionEn,form.buyerAddress,form.buyerAddressEn,form.buyerTel,form.buyerTaxCode,form.buyerAccountNo,form.buyerBank,form.buyerBankEn),
          ...bi(T.agree, T.agreeB, { spaceAfter:12 }),
          ...artHeading(T.art1, T.art1B),
          ...bi("1.1 "+T.art1_1, T.art1_1B, { bold:true, spaceAfter:2 }),
          ...bi(T.art1_desc, T.art1_descB, { spaceAfter:4 }),
          itemsTable2,
          { text:T.inWords(numberToWordsVN(total)), alignment:"right", bold:true, fontSize:FS_SM, margin:[0,2,0,1] },
          { text:T.inWordsB(numberToWordsEN(total)), alignment:"right", italics:true, color:COL_GRAY, fontSize:FS_SM*0.9, margin:[0,0,0,8] },
          ...bi("1.2 "+T.art1_2+": "+T.quality, T.art1_2B+": "+T.qualityB, { spaceAfter:2 }),
          ...bi(T.art1_3, T.art1_3B, { spaceAfter:2 }),
          ...T.docs.flatMap(function(d,i){ return bi("  - "+d,"  - "+T.docsB[i],{ spaceAfter:1 }); }),
          ...artHeading(T.art2, T.art2B),
          ...bi(T.art2_lead+": "+form.paymentTerm, T.art2_leadB+": "+paymentB_en2, { spaceAfter:10 }),
          ...artHeading(T.art3, T.art3B),
          ...bi(T.art3_1(form.deliveryDays), T.art3_1B(form.deliveryDays), { spaceAfter:2 }),
          ...bi(T.art3_2(form.deliveryPlace), T.art3_2B(form.deliveryPlaceEn||form.deliveryPlace), { spaceAfter:10 }),
          ...artHeading(T.art4, T.art4B),
          ...bi(clause("art4_1_vi",T.art4_1), clauseB("art4_1_b",T.art4_1B), { spaceAfter:2 }),
          ...bi(clause("art4_2_vi",T.art4_2), clauseB("art4_2_b",T.art4_2B), { spaceAfter:2 }),
          ...bi(clause("art4_3_vi",T.art4_3), clauseB("art4_3_b",T.art4_3B), { spaceAfter:2 }),
          ...bi(clause("art4_4_vi",T.art4_4), clauseB("art4_4_b",T.art4_4B), { spaceAfter:10 }),
          ...artHeading(T.art5, T.art5B),
          ...bi(clause("art5_vi",T.art5_body), clauseB("art5_b",T.art5_bodyB), { spaceAfter:10 }),
          ...artHeading(T.art6, T.art6B),
          ...bi("6.1 "+clause("art6_1_vi",T.art6_1),"6.1 "+clauseB("art6_1_b",T.art6_1B),{ spaceAfter:2 }),
          ...bi("6.2 "+clause("art6_2_vi",T.art6_2),"6.2 "+clauseB("art6_2_b",T.art6_2B),{ spaceAfter:2 }),
          ...bi("6.3 "+clause("art6_3_vi",T.art6_3),"6.3 "+clauseB("art6_3_b",T.art6_3B),{ spaceAfter:2 }),
          ...bi("6.4 "+clause("art6_4_vi",T.art6_4),"6.4 "+clauseB("art6_4_b",T.art6_4B),{ spaceAfter:2 }),
          ...bi("6.5 "+clause("art6_5_vi",T.art6_5),"6.5 "+clauseB("art6_5_b",T.art6_5B),{ spaceAfter:16 }),
          signTable2,
        ],
      };

      await ensurePdfMake();
      const bvpLoaded = await ensureBeVietnamPro();
      if (bvpLoaded) docDefinition.defaultStyle.font = "BeVietnamPro";
      window.pdfMake.createPdf(docDefinition).download("HopDong_"+(form.contractNumber||quote.quoteNumber)+".pdf");

    } catch(e) {
      alert("Lỗi xuất PDF: " + e.message);
      console.error(e);
    } finally {
      setPdfLoadingC(false);
    }
  };

  const handlePrint = () => {
    const el = document.getElementById("contract-preview-area");
    if (!el) {
      alert("Không tìm thấy nội dung hợp đồng để in!");
      return;
    }

    const ML = pageMargins.left || 30;
    const MR = pageMargins.right || 20;
    const MT = pageMargins.top || 20;
    const MB = pageMargins.bottom || 20;

    const printHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8">
      <title>In Hợp Đồng - ${form.contractNumber || quote.quoteNumber}</title>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap">
      <style>
        @page { margin:${MT}mm ${MR}mm ${MB}mm ${ML}mm; size:A4 portrait; }
        html, body { width: 100%; margin: 0; padding: 0; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-family: 'Plus Jakarta Sans', sans-serif; }
        * { box-sizing: border-box; font-family: 'Plus Jakarta Sans', sans-serif !important; }
        #contract-preview-area { width: 100% !important; max-width: 100% !important; margin: 0 !important; font-size: ${fontSize}pt !important; line-height: ${lineSpacing} !important; box-shadow: none !important; padding: 0 !important; }
        table { width: 100% !important; border-collapse: collapse !important; table-layout: fixed !important; margin: 10px 0 !important; }
        th, td { border: 1px solid #1a2540 !important; }
        th { background-color: #f1f5f9 !important; -webkit-print-color-adjust: exact; }
        td:nth-child(1), td:nth-child(3), td:nth-child(4), td:nth-child(5), td:nth-child(6), td:nth-child(7) { white-space: nowrap !important; }
        td:nth-child(2) { word-break: break-word !important; overflow-wrap: break-word !important; }
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
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 1000);
      }, 400);
    };
  };

  return (
    <div className="modal-overlay" >
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">📃 Soạn hợp đồng — {quote.quoteNumber} {saveMsg && <span style={{fontSize:13,color:"#16a34a",marginLeft:10}}>{saveMsg}</span>}</span>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <button className="btn btn-ghost btn-sm" onClick={handleAutoTranslate} disabled={translating} title="Tự động dịch sang tiếng Anh/Trung">
              {translating ? "⏳ Đang dịch..." : `🌐 Tự động dịch → ${lang==="vi_en"?"EN":"中文"}`}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={handlePrint} title="In hợp đồng trực tiếp">🖨️ In hợp đồng</button>
            <button className="btn btn-ghost btn-sm" onClick={handleSave}>💾 Lưu hợp đồng</button>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>
        </div>
        <div className="modal-body">
          <div className="section-title">⚙️ Thiết lập</div>
          <div className="form-row form-row-3" style={{marginBottom:12}}>
            <div className="form-group">
              <label>Ngôn ngữ song ngữ</label>
              <select className="form-control" value={lang} onChange={e=>setLang(e.target.value)}>
                <option value="vi_en">Việt - Anh</option>
                <option value="vi_zh">Việt - Trung (giản thể)</option>
              </select>
            </div>
            <div className="form-group">
              <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Số hợp đồng</span>
                <button type="button" className="btn btn-ghost btn-xs" style={{ padding: "0 4px", fontSize: 11, color: "#2563eb" }}
                  onClick={() => setField("contractNumber", generateContractNumber(form.contractDate, quote.id))}
                  title="Tự động tính số hợp đồng theo định dạng 01-ddmmy/PMC">
                  🔄 Tự tính số
                </button>
              </label>
              <input className="form-control" placeholder="VD: 01-100826/PMC" value={form.contractNumber} onChange={e=>setField("contractNumber",e.target.value)} />
            </div>
            <div className="form-group">
              <label>Ngày ký (ngày/tháng/năm)</label>
              <div style={{display:"flex",gap:6}}>
                <input className="form-control" style={{width:60}} value={form.contractDate.day} onChange={e=>setField("contractDate",{...form.contractDate,day:e.target.value})} />
                <input className="form-control" style={{width:60}} value={form.contractDate.month} onChange={e=>setField("contractDate",{...form.contractDate,month:e.target.value})} />
                <input className="form-control" style={{width:80}} value={form.contractDate.year} onChange={e=>setField("contractDate",{...form.contractDate,year:e.target.value})} />
              </div>
            </div>
          </div>

          <div style={{background:"#f5f7fc",border:"1px solid #e0e4f0",borderRadius:8,padding:"12px 16px",marginBottom:16}}>
            <div style={{fontSize:12,fontWeight:600,color:"#5b6b94",marginBottom:10,textTransform:"uppercase",letterSpacing:"0.06em"}}>
              📐 Định dạng trang & Phông chữ
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14,marginBottom:12}}>
              <div className="form-group" style={{marginBottom:0}}>
                <label style={{display:"flex",justifyContent:"space-between"}}>
                  <span>Cỡ chữ</span>
                  <span style={{fontWeight:700,color:"#1a2540"}}>{fontSize}pt</span>
                </label>
                <input type="range" min={9} max={16} step={0.5} value={fontSize}
                  onChange={e=>setFontSize(Number(e.target.value))}
                  style={{width:"100%",accentColor:"#1a2540"}} />
              </div>
              <div className="form-group" style={{marginBottom:0}}>
                <label style={{display:"flex",justifyContent:"space-between"}}>
                  <span>Khoảng cách dòng</span>
                  <span style={{fontWeight:700,color:"#1a2540"}}>{lineSpacing}x</span>
                </label>
                <input type="range" min={1.1} max={2.0} step={0.05} value={lineSpacing}
                  onChange={e=>setLineSpacing(Number(e.target.value))}
                  style={{width:"100%",accentColor:"#1a2540"}} />
              </div>
              <div className="form-group" style={{marginBottom:0}}>
                <label style={{display:"flex",justifyContent:"space-between"}}>
                  <span>Độ thoáng bảng hàng</span>
                  <span style={{fontWeight:700,color:"#1a2540"}}>{tablePadding}px</span>
                </label>
                <input type="range" min={2} max={14} step={1} value={tablePadding}
                  onChange={e=>setTablePadding(Number(e.target.value))}
                  style={{width:"100%",accentColor:"#1a2540"}} />
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:12,alignItems:"end"}}>
              <div className="form-group" style={{marginBottom:0}}>
                <label>Lề trên (mm)</label>
                <input type="number" className="form-control" min={5} max={40}
                  value={pageMargins.top}
                  onChange={e=>setPageMargins(p=>({...p,top:Number(e.target.value)}))}
                />
              </div>
              <div className="form-group" style={{marginBottom:0}}>
                <label>Lề dưới (mm)</label>
                <input type="number" className="form-control" min={5} max={40}
                  value={pageMargins.bottom}
                  onChange={e=>setPageMargins(p=>({...p,bottom:Number(e.target.value)}))}
                />
              </div>
              <div className="form-group" style={{marginBottom:0}}>
                <label>Lề trái (mm)</label>
                <input type="number" className="form-control" min={5} max={50}
                  value={pageMargins.left}
                  onChange={e=>setPageMargins(p=>({...p,left:Number(e.target.value)}))}
                />
              </div>
              <div className="form-group" style={{marginBottom:0}}>
                <label>Lề phải (mm)</label>
                <input type="number" className="form-control" min={5} max={40}
                  value={pageMargins.right}
                  onChange={e=>setPageMargins(p=>({...p,right:Number(e.target.value)}))}
                />
              </div>
            </div>
          </div>

          <div className="section-title">🧑‍💼 Thông tin Bên Mua</div>
          <div className="form-row form-row-2" style={{marginBottom:8}}>
            <div className="form-group">
              <label>Tên công ty/khách hàng (VI)</label>
              <input className="form-control" value={form.buyerName} onChange={e=>setField("buyerName",e.target.value)} />
            </div>
            <div className="form-group">
              <label>Tên ({lang==="vi_en"?"EN":"中文/拼音"})</label>
              <input className="form-control" value={form.buyerNameEn} onChange={e=>setField("buyerNameEn",e.target.value)} placeholder="Để trống nếu giống tiếng Việt" />
            </div>
          </div>
          <div className="form-row form-row-2" style={{marginBottom:8}}>
            <div className="form-group">
              <label>Người đại diện</label>
              <input className="form-control" value={form.buyerRep} onChange={e=>setField("buyerRep",e.target.value)} />
            </div>
            <div className="form-group">
              <label>Chức vụ</label>
              <input className="form-control" value={form.buyerPosition} onChange={e=>setField("buyerPosition",e.target.value)} placeholder="VD: Giám đốc" />
            </div>
          </div>
          <div className="form-row form-row-2" style={{marginBottom:8}}>
            <div className="form-group">
              <label>Địa chỉ</label>
              <input className="form-control" value={form.buyerAddress} onChange={e=>setField("buyerAddress",e.target.value)} />
            </div>
            <div className="form-group">
              <label>Điện thoại</label>
              <input className="form-control" value={form.buyerTel} onChange={e=>setField("buyerTel",e.target.value)} />
            </div>
          </div>
          <div className="form-row form-row-3" style={{marginBottom:8}}>
            <div className="form-group">
              <label>Mã số thuế</label>
              <input className="form-control" value={form.buyerTaxCode} onChange={e=>setField("buyerTaxCode",e.target.value)} />
            </div>
            <div className="form-group">
              <label>Số tài khoản</label>
              <input className="form-control" value={form.buyerAccountNo} onChange={e=>setField("buyerAccountNo",e.target.value)} />
            </div>
            <div className="form-group">
              <label>Tên ngân hàng</label>
              <input className="form-control" value={form.buyerBank} onChange={e=>setField("buyerBank",e.target.value)} />
            </div>
          </div>

          <div className="section-title">🚚 Điều khoản giao hàng & thanh toán</div>
          <div className="form-row form-row-2" style={{marginBottom:8}}>
            <div className="form-group">
              <label>Số ngày giao hàng</label>
              <input className="form-control" value={form.deliveryDays} onChange={e=>setField("deliveryDays",e.target.value)} />
            </div>
            <div className="form-group">
              <label>Địa điểm giao hàng</label>
              <input className="form-control" value={form.deliveryPlace} onChange={e=>setField("deliveryPlace",e.target.value)} />
            </div>
          </div>
          <div className="form-group" style={{marginBottom:8}}>
            <label>Điều khoản thanh toán (tiếng Việt)</label>
            <textarea className="form-control" rows={2} value={form.paymentTerm} onChange={e=>setField("paymentTerm",e.target.value)} />
          </div>
          <div className="form-group" style={{marginBottom:16}}>
            <label>Điều khoản thanh toán ({lang==="vi_en"?"English":"中文"}) — để trống để dùng mặc định</label>
            <textarea className="form-control" rows={2} value={lang==="vi_en"?form.paymentTermEn:form.paymentTermZh} onChange={e=>setField(lang==="vi_en"?"paymentTermEn":"paymentTermZh",e.target.value)} />
          </div>

          <details style={{marginBottom:16}}>
            <summary style={{cursor:"pointer",fontWeight:600,fontSize:14,color:"#1a2540",padding:"8px 0",borderTop:"1px solid #e5e3dc",userSelect:"none"}}>
              ⚖️ Điều khoản hợp đồng (Mục 1.2, 1.3, Điều 4–6) — click để chỉnh sửa
            </summary>
            <div style={{marginTop:12,display:"grid",gap:12}}>
              {[
                ["art1_2_vi","art1_2_b","1.2 (Chất lượng)", defaultQualityVi, defaultQualityB],
                ["art1_3_vi","art1_3_b","1.3 (Chứng từ thanh toán)", defaultDocListVi, defaultArt13B],
                ["art4_1_vi","art4_1_b","4.1",T.art4_1, T.art4_1B],
                ["art4_2_vi","art4_2_b","4.2",T.art4_2, T.art4_2B],
                ["art4_3_vi","art4_3_b","4.3",T.art4_3, T.art4_3B],
                ["art4_4_vi","art4_4_b","4.4",T.art4_4, T.art4_4B],
                ["art5_vi","art5_b","Điều 5",T.art5_body, T.art5_bodyB],
                ["art6_1_vi","art6_1_b","6.1",T.art6_1, T.art6_1B],
                ["art6_2_vi","art6_2_b","6.2",T.art6_2, T.art6_2B],
                ["art6_3_vi","art6_3_b","6.3",T.art6_3, T.art6_3B],
                ["art6_4_vi","art6_4_b","6.4",T.art6_4, T.art6_4B],
                ["art6_5_vi","art6_5_b","6.5",T.art6_5, T.art6_5B],
              ].map(([viKey, bKey, label, viDef, bDef]) => (
                <div key={viKey} style={{background:"#f8f9fc",borderRadius:8,padding:"10px 14px",border:"1px solid #e8eaf0"}}>
                  <div style={{fontWeight:600,fontSize:12,color:"#5b6b94",marginBottom:6}}>{label}</div>
                  <div className="form-row form-row-2" style={{gap:8}}>
                    <div className="form-group" style={{marginBottom:0}}>
                      <label style={{fontSize:11}}>Tiếng Việt</label>
                      <textarea className="form-control" rows={3} style={{fontSize:13}}
                        value={form[viKey] || viDef}
                        onChange={e=>setField(viKey, e.target.value)}
                      />
                    </div>
                    <div className="form-group" style={{marginBottom:0}}>
                      <label style={{fontSize:11}}>{lang==="vi_en"?"English":"中文"} — để trống để dùng mặc định</label>
                      <textarea className="form-control" rows={3} style={{fontSize:13,fontStyle:"italic",color:"#555"}}
                        placeholder={bDef}
                        value={form[bKey] || ""}
                        onChange={e=>setField(bKey, e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </details>

          <div className="section-title">👀 Xem trước</div>
          <div style={{
            border:"1px solid #e5e3dc", background:"#fff",
            padding:`${pageMargins.top}mm ${pageMargins.right}mm ${pageMargins.bottom}mm ${pageMargins.left}mm`,
            width:"21cm", margin:"0 auto", boxSizing:"border-box",
          }}>
            <div id="contract-preview-area" style={{
              background:"#fff",
              fontSize:`${fontSize}pt`, lineHeight:1.7,
            }}>
              <div style={{ position: "relative", marginBottom: 20, minHeight: 65 }}>
                <div style={{ position: "absolute", left: 0, top: 0, height: "100%", display: "flex", alignItems: "center" }}>
                  {getLogoUrl() ? (
                    <img src={getLogoUrl()} alt="Logo" style={{ maxHeight: 68, maxWidth: 135, objectFit: "contain" }} />
                  ) : (
                    <div style={{ border: "1.5px dashed #cbd5e1", borderRadius: 6, padding: "6px 10px", textAlign: "center", fontSize: "9pt", color: "#94a3b8", fontWeight: 600 }}>
                      [ LOGO ]
                    </div>
                  )}
                </div>
                <div style={{ textAlign: "center", width: "100%" }}>
                  <div style={{ fontWeight: 700, textTransform: "uppercase", fontSize: `${fontSize*1.05}pt`, whiteSpace: "nowrap" }}>{T.natTitle1}</div>
                  <div style={{ fontStyle: "italic", color: "#475569", fontSize: `${fontSize*0.85}pt`, marginBottom: 2, whiteSpace: "nowrap" }}>{T.natTitle1b}</div>
                  <div style={{ fontWeight: 700, fontSize: `${fontSize}pt`, whiteSpace: "nowrap" }}>{T.natTitle2}</div>
                  <div style={{ fontStyle: "italic", color: "#475569", fontSize: `${fontSize*0.85}pt`, whiteSpace: "nowrap" }}>{T.natTitle2b}</div>
                </div>
              </div>
              <div style={{ textAlign: "center", marginBottom: 18 }}>
                <div style={{ fontWeight: 700, fontSize: `${fontSize*1.4}pt`, color: "#1a2540", textTransform: "uppercase" }}>{T.title}</div>
                <div style={{ fontStyle: "italic", color: "#555", fontSize: `${fontSize*0.95}pt`, marginBottom: 3 }}>{T.titleB}</div>
                <div style={{ fontSize: `${fontSize*0.9}pt`, color: "#888" }}>Số/No: {form.contractNumber||"......"}</div>
              </div>

              <p style={{margin:"4px 0"}}>{T.legalBasis}</p>
              <p style={{margin:"2px 0 12px",fontStyle:"italic",color:"#555"}}>{T.legalBasisB}</p>

              <p style={{margin:"4px 0"}}>{T.today(form.contractDate)}</p>
              <p style={{margin:"2px 0 14px",fontStyle:"italic",color:"#555"}}>{T.todayB(form.contractDate)}</p>

              <p style={{margin:"4px 0",fontWeight:700}}>{T.seller}: {COMPANY.name}</p>
              <p style={{margin:"2px 0",fontStyle:"italic",color:"#555"}}>{T.sellerB}: {COMPANY.nameEn}</p>
              <p style={{margin:"2px 0"}}>{T.rep}: {COMPANY.representative}</p>
              <p style={{margin:"2px 0",fontStyle:"italic",color:"#555"}}>{T.repB}: {COMPANY.representativeEn}</p>
              <p style={{margin:"2px 0"}}>{T.position}: {COMPANY.position}</p>
              <p style={{margin:"2px 0",fontStyle:"italic",color:"#555"}}>{T.positionB}: {COMPANY.positionEn}</p>
              <p style={{margin:"2px 0"}}>{T.address}: {COMPANY.address}</p>
              <p style={{margin:"2px 0",fontStyle:"italic",color:"#555"}}>{T.addressB}: {COMPANY.addressEn}</p>
              <p style={{margin:"2px 0"}}>{T.tel}: {COMPANY.phone}</p>
              <p style={{margin:"2px 0"}}>{T.taxCode}: {COMPANY.mst}</p>
              <p style={{margin:"2px 0"}}>{T.accountNo}: {COMPANY.bankAccount}</p>
              <p style={{margin:"2px 0 14px"}}>{T.atBank}: {COMPANY.bankName}</p>

              <p style={{margin:"4px 0",fontWeight:700}}>{T.buyer}: {form.buyerName}</p>
              {form.buyerNameEn && <p style={{margin:"2px 0",fontStyle:"italic",color:"#555"}}>{T.buyerB}: {form.buyerNameEn}</p>}
              {form.buyerRep && <><p style={{margin:"2px 0"}}>{T.rep}: {form.buyerRep}</p>{form.buyerRepEn&&<p style={{margin:"2px 0",fontStyle:"italic",color:"#555"}}>{T.repB}: {form.buyerRepEn}</p>}</>}
              {form.buyerPosition && <><p style={{margin:"2px 0"}}>{T.position}: {form.buyerPosition}</p>{form.buyerPositionEn&&<p style={{margin:"2px 0",fontStyle:"italic",color:"#555"}}>{T.positionB}: {form.buyerPositionEn}</p>}</>}
              {form.buyerAddress && <><p style={{margin:"2px 0"}}>{T.address}: {form.buyerAddress}</p>{form.buyerAddressEn&&<p style={{margin:"2px 0",fontStyle:"italic",color:"#555"}}>{T.addressB}: {form.buyerAddressEn}</p>}</>}
              {form.buyerTel && <p style={{margin:"2px 0"}}>{T.tel}: {form.buyerTel}</p>}
              {form.buyerTaxCode && <p style={{margin:"2px 0"}}>{T.taxCode}: {form.buyerTaxCode}</p>}
              {form.buyerAccountNo && <p style={{margin:"2px 0"}}>{T.accountNo}: {form.buyerAccountNo}</p>}
              {form.buyerBank && <><p style={{margin:"2px 0"}}>{T.atBank}: {form.buyerBank}</p>{form.buyerBankEn&&<p style={{margin:"2px 0 14px",fontStyle:"italic",color:"#555"}}>{T.atBankB}: {form.buyerBankEn}</p>}</>}

              <p style={{margin:"10px 0"}}>{T.agree}</p>
              <p style={{margin:"2px 0 16px",fontStyle:"italic",color:"#555"}}>{T.agreeB}</p>

              <div style={{fontWeight:700,margin:"12px 0 2px",textTransform:"uppercase"}}>{T.art1}</div>
              <div style={{fontStyle:"italic",color:"#555",marginBottom:8}}>{T.art1B}</div>
              <p style={{margin:"4px 0",fontWeight:600}}>1.1 {T.art1_1}</p>
              <p style={{margin:"2px 0",fontStyle:"italic",color:"#555"}}>1.1 {T.art1_1B}</p>
              <p style={{margin:"4px 0"}}>{T.art1_desc}</p>
              <p style={{margin:"2px 0 8px",fontStyle:"italic",color:"#555"}}>{T.art1_descB}</p>
              <table style={{width:"100%",borderCollapse:"collapse",border:"1px solid #1a2540",fontSize:`${fontSize*0.9}pt`,tableLayout:"fixed",marginTop:10,marginBottom:10}}>
                <colgroup>
                  <col style={{ width: "6%" }} />   {/* STT */}
                  <col style={{ width: "40%" }} />  {/* Hàng hóa / Dịch vụ */}
                  <col style={{ width: "6%" }} />   {/* SL */}
                  <col style={{ width: "9%" }} />   {/* ĐVT */}
                  <col style={{ width: "15%" }} />  {/* Đơn giá */}
                  <col style={{ width: "6%" }} />   {/* VAT */}
                  <col style={{ width: "18%" }} />  {/* Thành tiền */}
                </colgroup>
                <thead><tr>
                  {T.itemsHeader.map((h,i)=>(
                    <th key={i} style={{
                      border: "1px solid #1a2540",
                      padding: `${tablePadding}px 5px`,
                      background: "#f1f5f9",
                      color: "#0f172a",
                      fontWeight: 700,
                      textAlign: i === 1 ? "left" : (i >= 4 ? "right" : "center"),
                      wordBreak: "break-word",
                      overflowWrap: "break-word"
                    }}>
                      {h}
                      <div style={{fontSize:`${fontSize*0.75}pt`,fontStyle:"italic",fontWeight:"normal",color:"#475569"}}>{T.itemsHeaderB[i]}</div>
                    </th>
                  ))}
                </tr></thead>
                <tbody>
                  {itemRowsHtml}
                  <tr>
                    <td colSpan={6} style={{ border: "1px solid #1a2540", padding: `${tablePadding}px 6px`, textAlign: "right", fontWeight: 600 }}>{T.rowTotal} / {T.rowTotalB}</td>
                    <td style={{ border: "1px solid #1a2540", padding: `${tablePadding}px 6px`, textAlign: "right", fontWeight: 600, whiteSpace: "nowrap" }}>{fmt(subtotal)}</td>
                  </tr>
                  <tr>
                    <td colSpan={6} style={{ border: "1px solid #1a2540", padding: `${tablePadding}px 6px`, textAlign: "right", fontWeight: 600 }}>{T.rowVat(vatLabel(quote.vatRate))} / {T.rowVatB(vatLabel(quote.vatRate))}</td>
                    <td style={{ border: "1px solid #1a2540", padding: `${tablePadding}px 6px`, textAlign: "right", fontWeight: 600 }}>{fmt(vat)}</td>
                  </tr>
                  <tr>
                    <td colSpan={6} style={{ border: "1px solid #1a2540", padding: `${tablePadding}px 6px`, textAlign: "right", fontWeight: 700, fontSize: `${fontSize*0.95}pt` }}>{T.rowGrand} / {T.rowGrandB}</td>
                    <td style={{ border: "1px solid #1a2540", padding: `${tablePadding}px 6px`, textAlign: "right", fontWeight: 700, fontSize: `${fontSize*0.95}pt`, color: "#1e293b" }}>{fmt(total)} đ</td>
                  </tr>
                </tbody>
              </table>
              <p style={{textAlign:"right",fontStyle:"italic",fontWeight:600,margin:"6px 0 0"}}>{T.inWords(numberToWordsVN(total))}</p>
              <p style={{textAlign:"right",fontStyle:"italic",color:"#555",margin:"0 0 8px"}}>{T.inWordsB(lang==="vi_en"?numberToWordsEN(total):numberToWordsCN(total))}</p>
              <p style={{margin:"4px 0",fontWeight:600}}>{qualityVi}</p>
              <p style={{margin:"2px 0 6px",fontStyle:"italic",color:"#555"}}>{qualityB}</p>
              {art13ViLines.map((vLine, idx) => {
                const bLine = art13BLines[idx] || "";
                const isIndent = vLine.startsWith("-") || vLine.startsWith("•");
                const isHeader = idx === 0 || vLine.startsWith("1.3");
                return (
                  <React.Fragment key={idx}>
                    <p style={{ margin: "2px 0", fontWeight: isHeader ? 600 : 400, paddingLeft: isIndent ? 16 : 0 }}>{vLine}</p>
                    {bLine ? <p style={{ margin: "0 0 4px", fontStyle: "italic", color: "#555", paddingLeft: isIndent ? 16 : 0 }}>{bLine}</p> : null}
                  </React.Fragment>
                );
              })}

              <div style={{fontWeight:700,margin:"16px 0 2px",textTransform:"uppercase"}}>{T.art2}</div>
              <div style={{fontStyle:"italic",color:"#555",marginBottom:8}}>{T.art2B}</div>
              <p style={{margin:"4px 0"}}>{T.art2_lead}: {form.paymentTerm}</p>
              <p style={{margin:"2px 0 14px",fontStyle:"italic",color:"#555"}}>{T.art2_leadB}: {paymentB}</p>

              <div style={{fontWeight:700,margin:"12px 0 2px",textTransform:"uppercase"}}>{T.art3}</div>
              <div style={{fontStyle:"italic",color:"#555",marginBottom:8}}>{T.art3B}</div>
              <p style={{margin:"4px 0"}}>{T.art3_1(form.deliveryDays)}</p>
              <p style={{margin:"2px 0",fontStyle:"italic",color:"#555"}}>{T.art3_1B(form.deliveryDays)}</p>
              <p style={{margin:"4px 0"}}>{T.art3_2(form.deliveryPlace)}</p>
              <p style={{margin:"2px 0 14px",fontStyle:"italic",color:"#555"}}>{T.art3_2B(form.deliveryPlaceEn||form.deliveryPlace)}</p>

              <div style={{fontWeight:700,margin:"12px 0 2px",textTransform:"uppercase"}}>{T.art4}</div>
              <div style={{fontStyle:"italic",color:"#555",marginBottom:8}}>{T.art4B}</div>
              <p style={{margin:"4px 0"}}>{clause("art4_1_vi",T.art4_1)}</p>
              <p style={{margin:"2px 0",fontStyle:"italic",color:"#555"}}>{clauseB("art4_1_b",T.art4_1B)}</p>
              <p style={{margin:"4px 0"}}>{clause("art4_2_vi",T.art4_2)}</p>
              <p style={{margin:"2px 0",fontStyle:"italic",color:"#555"}}>{clauseB("art4_2_b",T.art4_2B)}</p>
              <p style={{margin:"4px 0"}}>{clause("art4_3_vi",T.art4_3)}</p>
              <p style={{margin:"2px 0",fontStyle:"italic",color:"#555"}}>{clauseB("art4_3_b",T.art4_3B)}</p>
              <p style={{margin:"4px 0"}}>{clause("art4_4_vi",T.art4_4)}</p>
              <p style={{margin:"2px 0 14px",fontStyle:"italic",color:"#555"}}>{clauseB("art4_4_b",T.art4_4B)}</p>

              <div style={{fontWeight:700,margin:"12px 0 2px",textTransform:"uppercase"}}>{T.art5}</div>
              <div style={{fontStyle:"italic",color:"#555",marginBottom:8}}>{T.art5B}</div>
              <p style={{margin:"4px 0"}}>{clause("art5_vi",T.art5_body)}</p>
              <p style={{margin:"2px 0 14px",fontStyle:"italic",color:"#555"}}>{clauseB("art5_b",T.art5_bodyB)}</p>

              <div style={{fontWeight:700,margin:"12px 0 2px",textTransform:"uppercase"}}>{T.art6}</div>
              <div style={{fontStyle:"italic",color:"#555",marginBottom:8}}>{T.art6B}</div>
              <p style={{margin:"4px 0"}}>6.1 {clause("art6_1_vi",T.art6_1)}</p>
              <p style={{margin:"2px 0",fontStyle:"italic",color:"#555"}}>6.1 {clauseB("art6_1_b",T.art6_1B)}</p>
              <p style={{margin:"4px 0"}}>6.2 {clause("art6_2_vi",T.art6_2)}</p>
              <p style={{margin:"2px 0",fontStyle:"italic",color:"#555"}}>6.2 {clauseB("art6_2_b",T.art6_2B)}</p>
              <p style={{margin:"4px 0"}}>6.3 {clause("art6_3_vi",T.art6_3)}</p>
              <p style={{margin:"2px 0",fontStyle:"italic",color:"#555"}}>6.3 {clauseB("art6_3_b",T.art6_3B)}</p>
              <p style={{margin:"4px 0"}}>6.4 {clause("art6_4_vi",T.art6_4)}</p>
              <p style={{margin:"2px 0",fontStyle:"italic",color:"#555"}}>6.4 {clauseB("art6_4_b",T.art6_4B)}</p>
              <p style={{margin:"4px 0"}}>6.5 {clause("art6_5_vi",T.art6_5)}</p>
              <p style={{margin:"2px 0 24px",fontStyle:"italic",color:"#555"}}>6.5 {clauseB("art6_5_b",T.art6_5B)}</p>

              <div style={{display:"flex",justifyContent:"space-between",marginTop:24}}>
                <div style={{textAlign:"center",width:"240px"}}>
                  <div style={{fontWeight:700}}>{T.signSeller}</div>
                  <div style={{fontStyle:"italic",color:"#000",fontSize:`${fontSize*0.85}pt`,marginBottom:60}}>{T.signSellerB}</div>
                  <div style={{fontWeight:700}}>{COMPANY.representative}</div>
                </div>
                <div style={{textAlign:"center",width:"240px"}}>
                  <div style={{fontWeight:700}}>{T.signBuyer}</div>
                  <div style={{fontStyle:"italic",color:"#000",fontSize:`${fontSize*0.85}pt`,marginBottom:60}}>{T.signBuyerB}</div>
                  <div style={{fontWeight:700}}>{form.buyerRep}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Đóng</button>
          <button className="btn btn-ghost" onClick={handleSave}>💾 Lưu hợp đồng {saveMsg && <span style={{color:"#16a34a",marginLeft:6}}>{saveMsg}</span>}</button>
          <button className="btn btn-ghost" onClick={handlePrint} style={{minWidth:110}}>
            🖨️ In Hợp Đồng
          </button>
          <button className="btn btn-ghost" onClick={handlePDFClick} disabled={pdfLoadingC} style={{minWidth:120}}>
            {pdfLoadingC ? "⏳ Đang tạo..." : "📄 Xuất PDF"}
          </button>
          <button className="btn btn-primary" onClick={handleWordClick} disabled={wordLoading} style={{minWidth:120}}>
            {wordLoading ? "⏳ Đang tạo..." : "📝 Xuất Word"}
          </button>
        </div>
      </div>
    </div>
  );
}
