import { hasGasUrl, getGasUrl, LS_TOKEN, getLS } from './gasStore';

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

export function generateQuoteNumber(quotes) {
  const today = new Date();
  const d = String(today.getDate()).padStart(2,"0");
  const m = String(today.getMonth()+1).padStart(2,"0");
  const y = String(today.getFullYear()).slice(-2);
  const prefix = `BG${d}${m}${y}`;
  const sameDay = quotes.filter(q => q.quoteNumber && q.quoteNumber.startsWith(prefix));
  const seq = sameDay.length + 1;
  return `${prefix}${String(seq).padStart(2,"0")}`;
}

export function fmt(n) {
  const num = Number(n || 0);
  return num.toLocaleString("vi-VN", { maximumFractionDigits: 4 });
}

export function removeAccents(str) {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

export function todayStr() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
}

export function parseInvoiceXml(xmlText) {
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

  const subtotal = parseFloat(subtotalRaw.replace(/,/g,"")) || items.reduce((s,i)=>s+i.lineTotal, 0);
  const vatTotal = parseFloat(vatTotalRaw.replace(/,/g,"")) || items.reduce((s,i)=>s+i.vatAmt, 0);
  const grandTotal = parseFloat(grandRaw.replace(/,/g,"")) || (subtotal + vatTotal);

  return {
    invoiceNumber, serial, invoiceDate,
    sellerName, sellerTax, sellerAddr,
    buyerName, buyerTax, buyerAddr,
    subtotal, vatTotal, grandTotal,
    items
  };
}

const CUSTOMER_COLORS = [
  { bg:"#dbeafe", text:"#1e40af" }, 
  { bg:"#dcfce7", text:"#166534" }, 
  { bg:"#fef9c3", text:"#854d0e" }, 
  { bg:"#fce7f3", text:"#9d174d" }, 
  { bg:"#ede9fe", text:"#5b21b6" }, 
  { bg:"#ffedd5", text:"#9a3412" }, 
  { bg:"#cffafe", text:"#155e75" }, 
  { bg:"#fef2f2", text:"#991b1b" }, 
  { bg:"#f0fdf4", text:"#14532d" }, 
  { bg:"#faf5ff", text:"#6b21a8" }, 
  { bg:"#fff7ed", text:"#c2410c" }, 
  { bg:"#ecfdf5", text:"#065f46" }, 
];

export function getCustomerColor(name) {
  if (!name) return { bg:"#f3f4f6", text:"#374151" };
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return CUSTOMER_COLORS[Math.abs(hash) % CUSTOMER_COLORS.length];
}

export function calcItems(items, quoteVatRate) {
  const safeItems = Array.isArray(items) ? items : [];
  const subtotal = safeItems.reduce((s, it) => s + ((it?.qty||0)*(it?.price||0)), 0);
  const vatTotal = safeItems.reduce((s, it) => {
    if (!it) return s;
    const line = (it.qty||0)*(it.price||0);
    const iRate = it.vatRate !== undefined ? it.vatRate : (quoteVatRate !== undefined ? quoteVatRate : 8);
    if (iRate === -1) return s;
    return s + Math.round(line * (iRate||0) / 100);
  }, 0);
  return { subtotal, vat: vatTotal, total: subtotal + vatTotal };
}

const _wordsCache = new Map();

export async function numberToWords(num, lang="vi") {
  const key = lang + "_" + Math.round(num);
  if (_wordsCache.has(key)) return _wordsCache.get(key);

  if (!hasGasUrl()) {
    return new Intl.NumberFormat("vi-VN").format(num) + " đồng";
  }

  try {
    const token = getLS(LS_TOKEN) || "";
    const url = `${getGasUrl()}?action=words&num=${num}&lang=${lang}&token=${encodeURIComponent(token)}`;
    const resp = await fetch(url);
    const data = JSON.parse(await resp.text());
    if (data.ok) {
      _wordsCache.set(key, data.words);
      setTimeout(() => _wordsCache.delete(key), 60000);
      return data.words;
    }
  } catch(e) { }
  return new Intl.NumberFormat("vi-VN").format(num) + " đồng";
}

export function numberToWordsVN(n) {
  if (n === 0) return "Không đồng";
  if (!n || isNaN(n)) return "";
  const num = Math.abs(Math.round(n));
  
  const digits = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
  
  function readGroupOfThree(group, isFirst) {
    let hundred = Math.floor(group / 100);
    let ten = Math.floor((group % 100) / 10);
    let unit = group % 10;
    let res = "";

    if (hundred > 0 || !isFirst) {
      res += digits[hundred] + " trăm ";
    }

    if (ten > 1) {
      res += digits[ten] + " mươi ";
      if (unit === 1) res += "mốt ";
      else if (unit === 5) res += "lăm ";
      else if (unit > 0) res += digits[unit] + " ";
    } else if (ten === 1) {
      res += "mười ";
      if (unit === 1) res += "một ";
      else if (unit === 5) res += "lăm ";
      else if (unit > 0) res += digits[unit] + " ";
    } else if (ten === 0 && unit > 0) {
      if (hundred > 0 || !isFirst) res += "lẻ ";
      res += digits[unit] + " ";
    }
    return res;
  }

  const units = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ"];
  let temp = num;
  let groupIdx = 0;
  let strParts = [];

  while (temp > 0) {
    let group = temp % 1000;
    if (group > 0) {
      let isFirst = Math.floor(temp / 1000) === 0;
      let groupStr = readGroupOfThree(group, isFirst).trim();
      let unitStr = units[groupIdx];
      strParts.unshift((groupStr + " " + unitStr).trim());
    }
    temp = Math.floor(temp / 1000);
    groupIdx++;
  }

  let result = strParts.join(" ").trim();
  result = result.charAt(0).toUpperCase() + result.slice(1) + " đồng";
  return result;
}

export function numberToWordsEN(n) {
  if (n === 0) return "Zero VND";
  if (!n || isNaN(n)) return "";
  const num = Math.abs(Math.round(n));

  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const thousands = ["", "Thousand", "Million", "Billion", "Trillion"];

  function convertGroup(num) {
    let str = "";
    if (num >= 100) {
      str += ones[Math.floor(num / 100)] + " Hundred ";
      num %= 100;
    }
    if (num >= 20) {
      str += tens[Math.floor(num / 10)] + (num % 10 > 0 ? "-" + ones[num % 10].toLowerCase() : "") + " ";
    } else if (num > 0) {
      str += ones[num] + " ";
    }
    return str.trim();
  }

  let temp = num;
  let i = 0;
  let parts = [];

  while (temp > 0) {
    let group = temp % 1000;
    if (group > 0) {
      let groupStr = convertGroup(group);
      let unitStr = thousands[i];
      parts.unshift((groupStr + " " + unitStr).trim());
    }
    temp = Math.floor(temp / 1000);
    i++;
  }

  return parts.join(" ").trim() + " VND";
}

export function numberToWordsCN(n) {
  if (n === 0) return "零越南盾整";
  if (!n || isNaN(n)) return "";
  const num = Math.abs(Math.round(n));

  const digits = ["零", "壹", "贰", "叁", "肆", "伍", "陆", "柒", "捌", "玖"];
  const units = ["", "拾", "佰", "仟"];
  const bigUnits = ["", "万", "亿", "兆"];

  let strNum = String(num);
  let len = strNum.length;
  let result = "";
  let zeroFlag = false;

  for (let i = 0; i < len; i++) {
    let digit = parseInt(strNum[i], 10);
    let pos = len - 1 - i;
    let unitPos = pos % 4;
    let bigUnitPos = Math.floor(pos / 4);

    if (digit === 0) {
      zeroFlag = true;
    } else {
      if (zeroFlag) {
        result += "零";
        zeroFlag = false;
      }
      result += digits[digit] + units[unitPos];
    }

    if (unitPos === 0 && bigUnitPos > 0) {
      if (result.slice(-1) !== "零") {
        result += bigUnits[bigUnitPos];
      }
      zeroFlag = false;
    }
  }

  return result.replace(/零+/g, "零").replace(/零万/g, "万").replace(/零亿/g, "亿") + "越南盾整";
}

export const STATUS_LABELS = {
  draft: "Nháp",
  provisional: "Tạm tính",
  sent: "Đã gửi",
  accepted: "Chấp nhận",
  rejected: "Từ chối",
};

