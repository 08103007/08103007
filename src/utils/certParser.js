/**
 * Pure JavaScript X.509 Certificate Parser (.cer, .crt, .pem)
 * Supports DER & Base64 X.509 encoding for Vietnamese CAs (I-CA, Viettel-CA, VNPT-CA, FPT-CA, etc.)
 */

function decodeLength(bytes, offset) {
  let len = bytes[offset++];
  if ((len & 0x80) === 0) return { length: len, offset };
  const numBytes = len & 0x7F;
  if (numBytes === 0 || numBytes > 4) throw new Error("Invalid ASN.1 length");
  len = 0;
  for (let i = 0; i < numBytes; i++) len = (len << 8) | bytes[offset++];
  return { length: len, offset };
}

function decodeOID(bytes, offset, length) {
  if (length === 0) return "";
  const end = offset + length;
  let firstByte = bytes[offset++];
  let oid = Math.floor(firstByte / 40) + "." + (firstByte % 40);
  let val = 0;
  while (offset < end) {
    let b = bytes[offset++];
    val = (val << 7) | (b & 0x7F);
    if ((b & 0x80) === 0) {
      oid += "." + val;
      val = 0;
    }
  }
  return oid;
}

function decodeString(bytes, tag, offset, length) {
  const slice = bytes.subarray(offset, offset + length);
  if (tag === 0x0C) {
    try { return new TextDecoder("utf-8").decode(slice); } catch (e) {}
  }
  if (tag === 0x1E) {
    try { return new TextDecoder("utf-16be").decode(slice); } catch (e) {}
  }
  try {
    return new TextDecoder("utf-8").decode(slice);
  } catch (e) {
    let str = "";
    for (let i = 0; i < slice.length; i++) str += String.fromCharCode(slice[i]);
    return str;
  }
}

function decodeTime(bytes, tag, offset, length) {
  const str = String.fromCharCode.apply(null, bytes.subarray(offset, offset + length));
  if (tag === 0x17) {
    const year = parseInt(str.substring(0, 2), 10);
    const fullYear = year < 50 ? 2000 + year : 1900 + year;
    const month = parseInt(str.substring(2, 4), 10) - 1;
    const day = parseInt(str.substring(4, 6), 10);
    const hour = parseInt(str.substring(6, 8), 10);
    const min = parseInt(str.substring(8, 10), 10);
    const sec = parseInt(str.substring(10, 12), 10) || 0;
    return new Date(Date.UTC(fullYear, month, day, hour, min, sec));
  }
  if (tag === 0x18) {
    const fullYear = parseInt(str.substring(0, 4), 10);
    const month = parseInt(str.substring(4, 6), 10) - 1;
    const day = parseInt(str.substring(6, 8), 10);
    const hour = parseInt(str.substring(8, 10), 10);
    const min = parseInt(str.substring(10, 12), 10);
    const sec = parseInt(str.substring(12, 14), 10) || 0;
    return new Date(Date.UTC(fullYear, month, day, hour, min, sec));
  }
  return new Date();
}

const OID_MAP = {
  "2.5.4.3": "CN",
  "2.5.4.6": "C",
  "2.5.4.7": "L",
  "2.5.4.8": "S",
  "2.5.4.9": "STREET",
  "2.5.4.10": "O",
  "2.5.4.11": "OU",
  "2.5.4.12": "TITLE",
  "2.5.4.97": "organizationIdentifier",
  "0.9.2342.19200300.100.1.1": "OID.0.9.2342.19200300.100.1.1",
  "1.2.840.113549.1.9.1": "E"
};

function parseRDNSequence(bytes, offset, length) {
  const end = offset + length;
  const items = [];
  while (offset < end) {
    const setTag = bytes[offset++];
    if (setTag !== 0x31) {
      const skip = decodeLength(bytes, offset);
      offset = skip.offset + skip.length;
      continue;
    }
    const setL = decodeLength(bytes, offset);
    const setEnd = setL.offset + setL.length;
    offset = setL.offset;
    while (offset < setEnd) {
      const seqTag = bytes[offset++];
      if (seqTag !== 0x30) { offset++; continue; }
      const seqL = decodeLength(bytes, offset);
      const seqEnd = seqL.offset + seqL.length;
      offset = seqL.offset;
      if (offset < seqEnd && bytes[offset++] === 0x06) {
        const oidL = decodeLength(bytes, offset);
        const oid = decodeOID(bytes, oidL.offset, oidL.length);
        offset = oidL.offset + oidL.length;
        if (offset < seqEnd) {
          const strTag = bytes[offset++];
          const strL = decodeLength(bytes, offset);
          const val = decodeString(bytes, strTag, strL.offset, strL.length);
          offset = strL.offset + strL.length;
          const keyName = OID_MAP[oid] || oid;
          items.push({ oid, name: keyName, value: val });
        }
      } else {
        offset = seqEnd;
      }
    }
  }
  return items;
}

export function parseX509Certificate(input) {
  let bytes;
  if (typeof input === "string") {
    let clean = input.replace(/-----BEGIN[^-]+-----/g, "").replace(/-----END[^-]+-----/g, "").replace(/\s+/g, "");
    try {
      const binStr = (typeof atob === "function") ? atob(clean) : Buffer.from(clean, "base64").toString("binary");
      bytes = new Uint8Array(binStr.length);
      for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
    } catch (e) { throw new Error("File chứng thư Base64/PEM không hợp lệ"); }
  } else if (input instanceof ArrayBuffer) {
    bytes = new Uint8Array(input);
  } else if (input instanceof Uint8Array) {
    bytes = input;
  } else {
    throw new Error("Định dạng dữ liệu không được hỗ trợ");
  }

  if (bytes[0] === 0x2D && bytes[1] === 0x2D) {
    const text = new TextDecoder().decode(bytes);
    return parseX509Certificate(text);
  }

  let offset = 0;
  if (bytes[offset++] !== 0x30) throw new Error("File không phải chứng thư số X.509 DER");
  offset = decodeLength(bytes, offset).offset;
  if (bytes[offset++] !== 0x30) throw new Error("Cấu trúc TBSCertificate không hợp lệ");
  offset = decodeLength(bytes, offset).offset;
  if (bytes[offset] === 0xA0) {
    offset++;
    const v = decodeLength(bytes, offset);
    offset = v.offset + v.length;
  }
  let serialHex = "";
  if (bytes[offset++] === 0x02) {
    const s = decodeLength(bytes, offset);
    serialHex = Array.from(bytes.subarray(s.offset, s.offset + s.length)).map(b => b.toString(16).padStart(2, "0").toUpperCase()).join(":");
    offset = s.offset + s.length;
  }
  if (bytes[offset++] === 0x30) {
    const alg = decodeLength(bytes, offset);
    offset = alg.offset + alg.length;
  }
  let issuerItems = [];
  if (bytes[offset++] === 0x30) {
    const iss = decodeLength(bytes, offset);
    issuerItems = parseRDNSequence(bytes, iss.offset, iss.length);
    offset = iss.offset + iss.length;
  }
  let notBefore = new Date();
  let notAfter = new Date();
  if (bytes[offset++] === 0x30) {
    const val = decodeLength(bytes, offset);
    const valEnd = val.offset + val.length;
    let vOff = val.offset;
    if (vOff < valEnd) {
      const tag1 = bytes[vOff++];
      const l1 = decodeLength(bytes, vOff);
      notBefore = decodeTime(bytes, tag1, l1.offset, l1.length);
      vOff = l1.offset + l1.length;
    }
    if (vOff < valEnd) {
      const tag2 = bytes[vOff++];
      const l2 = decodeLength(bytes, vOff);
      notAfter = decodeTime(bytes, tag2, l2.offset, l2.length);
    }
    offset = valEnd;
  }
  let subjectItems = [];
  if (bytes[offset++] === 0x30) {
    const sub = decodeLength(bytes, offset);
    subjectItems = parseRDNSequence(bytes, sub.offset, sub.length);
    offset = sub.offset + sub.length;
  }
  const subMap = {};
  subjectItems.forEach(it => { subMap[it.name] = it.value; subMap[it.oid] = it.value; });
  const issMap = {};
  issuerItems.forEach(it => { issMap[it.name] = it.value; });
  let mst = "";
  const uidVal = subMap["OID.0.9.2342.19200300.100.1.1"] || subMap["0.9.2342.19200300.100.1.1"] || subMap["UID"] || "";
  if (uidVal) {
    const m = uidVal.match(/(?:MST:?|TAX:?|ID:?)?\s*([0-9]{10}(?:-[0-9]{3})?)/i);
    mst = m ? m[1] : uidVal.replace(/[^0-9-]/g, "");
  }
  if (!mst && subMap["organizationIdentifier"]) {
    const m = subMap["organizationIdentifier"].match(/([0-9]{10}(?:-[0-9]{3})?)/);
    if (m) mst = m[1];
  }
  if (!mst) {
    for (const it of subjectItems) {
      const m = it.value.match(/MST:?\s*([0-9]{10}(?:-[0-9]{3})?)/i);
      if (m) { mst = m[1]; break; }
    }
  }
  const signerName = subMap["CN"] || subMap["O"] || "";
  const province = subMap["S"] || subMap["ST"] || subMap["L"] || "Bà Rịa - Vũng Tàu";
  const location = province;
  const country = subMap["C"] || "VN";
  const dnParts = [];
  if (country) dnParts.push("C=" + country);
  if (province) dnParts.push("S=" + province);
  if (subMap["O"]) dnParts.push("O=" + subMap["O"]);
  if (subMap["CN"]) dnParts.push("CN=" + subMap["CN"]);
  if (uidVal) {
    dnParts.push("OID.0.9.2342.19200300.100.1.1=" + (uidVal.startsWith("MST:") ? uidVal : ("MST:" + (mst || uidVal))));
  } else if (mst) {
    dnParts.push("OID.0.9.2342.19200300.100.1.1=MST:" + mst);
  }
  const dnString = dnParts.join(", ");
  const caProvider = issMap["CN"] || issMap["O"] || "I-CA (I-CA Public CA)";
  const pad = n => String(n).padStart(2, "0");
  const formatDate = d => pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + "/" + d.getFullYear();
  const validFromStr = formatDate(notBefore);
  const validToStr = formatDate(notAfter);
  const now = new Date();
  const daysRemaining = Math.ceil((notAfter.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const isExpired = daysRemaining <= 0;
  return {
    signerName,
    mst,
    province,
    location,
    country,
    dnString,
    caProvider,
    serialNumber: serialHex,
    validFrom: validFromStr,
    validTo: validToStr,
    notBefore,
    notAfter,
    daysRemaining,
    isExpired,
    subjectItems,
    issuerItems
  };
}
