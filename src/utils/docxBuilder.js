import { showToast } from './gasStore';

// Dynamic library loaders using window global injection
export var _scriptCache = {};

export function loadScriptOnce(src) {
  if (_scriptCache[src]) return _scriptCache[src];
  _scriptCache[src] = new Promise(function(resolve, reject) {
    var s = document.createElement("script");
    s.src = src;
    s.onload = function() { resolve(); };
    s.onerror = function() { delete _scriptCache[src]; reject(new Error("Không tải được thư viện: " + src)); };
    document.head.appendChild(s);
  });
  return _scriptCache[src];
}

export function ensurePdfMake() {
  if (window.pdfMake && window.pdfMake.vfs) return Promise.resolve();
  return loadScriptOnce("https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/pdfmake.min.js")
    .then(function(){ return loadScriptOnce("https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/vfs_fonts.js"); });
}

// ──────────────────────────────────────────────────────────────
// Be Vietnam Pro font loader for pdfMake
// Fetches TTF from Google Fonts GitHub repo (CORS-enabled),
// caches result in localStorage to avoid re-download on next use.
// ──────────────────────────────────────────────────────────────
const BVP_FONTS = {
  regular: {
    key: "pmc_bvp_regular",
    url: "https://raw.githubusercontent.com/google/fonts/main/ofl/bevietnampro/BeVietnamPro-Regular.ttf",
    vfsName: "BeVietnamPro-Regular.ttf",
  },
  bold: {
    key: "pmc_bvp_bold",
    url: "https://raw.githubusercontent.com/google/fonts/main/ofl/bevietnampro/BeVietnamPro-Bold.ttf",
    vfsName: "BeVietnamPro-Bold.ttf",
  },
  semibold: {
    key: "pmc_bvp_semibold",
    url: "https://raw.githubusercontent.com/google/fonts/main/ofl/bevietnampro/BeVietnamPro-SemiBold.ttf",
    vfsName: "BeVietnamPro-SemiBold.ttf",
  },
};

async function fetchAsBase64(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("HTTP " + response.status + " - " + url);
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  // Convert in chunks to avoid call-stack overflow on large files
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(binary);
}

let _bvpPromise = null;

export async function ensureBeVietnamPro() {
  // Already registered in this session?
  if (window.pdfMake && window.pdfMake.vfs && window.pdfMake.vfs[BVP_FONTS.regular.vfsName]) return true;
  // Deduplicate concurrent calls
  if (_bvpPromise) return _bvpPromise;

  _bvpPromise = (async () => {
    try {
      for (const variant of Object.values(BVP_FONTS)) {
        let b64 = null;
        // 1. Try localStorage cache first
        try { b64 = localStorage.getItem(variant.key); } catch (_) {}
        // 2. Fetch if not cached
        if (!b64) {
          b64 = await fetchAsBase64(variant.url);
          try { localStorage.setItem(variant.key, b64); } catch (_) {}
        }
        window.pdfMake.vfs[variant.vfsName] = b64;
      }

      // Register font family in pdfMake
      window.pdfMake.fonts = window.pdfMake.fonts || {};
      window.pdfMake.fonts["BeVietnamPro"] = {
        normal:      BVP_FONTS.regular.vfsName,
        bold:        BVP_FONTS.bold.vfsName,
        italics:     BVP_FONTS.regular.vfsName,
        bolditalics: BVP_FONTS.bold.vfsName,
      };
      return true;
    } catch (err) {
      console.warn("[pdfMake] Could not load Be Vietnam Pro, falling back to Roboto:", err);
      _bvpPromise = null; // allow retry next time
      return false;
    }
  })();

  return _bvpPromise;
}

export function ensureHtmlDocx() {
  if (window.htmlDocx) return Promise.resolve();
  return loadScriptOnce("https://cdn.jsdelivr.net/npm/html-docx-js@0.3.1/dist/html-docx.js");
}

export function ensureXlsx() {
  if (window.XLSX) return Promise.resolve();
  return loadScriptOnce("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js");
}

export function ensureJSZip() {
  if (window.JSZip) return Promise.resolve();
  return loadScriptOnce("https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js");
}

export function ensureHtml2Canvas() {
  if (window.html2canvas) return Promise.resolve();
  return loadScriptOnce("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js");
}

export function ensureJsPdf() {
  if (window.jspdf) return Promise.resolve();
  return loadScriptOnce("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
}

export function preloadAllExportLibs() {
  const runner = () => {
    ensureJSZip().catch(() => {});
    ensureHtml2Canvas().catch(() => {});
    ensureJsPdf().catch(() => {});
    ensurePdfMake().catch(() => {});
    ensureXlsx().catch(() => {});
  };
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    window.requestIdleCallback(runner, { timeout: 4000 });
  } else {
    setTimeout(runner, 3000);
  }
}

export const DOCX_CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
</Types>`;

export const DOCX_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

export const DOCX_SETTINGS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:defaultTabStop w:val="708"/>
</w:settings>`;

export const DOCX_STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault><w:rPr>
      <w:sz w:val="22"/><w:szCs w:val="22"/>
    </w:rPr></w:rPrDefault>
  </w:docDefaults>
</w:styles>`;

export function esc(s) {
  return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

export function dxPara(runs, opts={}) {
  if (typeof runs === "string") runs = [{text: runs}];
  const pPr = [];
  if (opts.align) pPr.push(`<w:jc w:val="${opts.align}"/>`);
  if (opts.spaceBefore || opts.spaceAfter) {
    const b = opts.spaceBefore || 0, a = opts.spaceAfter || 0;
    pPr.push(`<w:spacing w:before="${b}" w:after="${a}"/>`);
  }
  if (opts.indent) pPr.push(`<w:ind w:left="${opts.indent}"/>`);
  const pPrXml = pPr.length ? `<w:pPr>${pPr.join("")}</w:pPr>` : "";

  const runsXml = runs.map(r => {
    if (typeof r === "string") r = {text: r};
    const rPr = [];
    if (r.bold || opts.bold) rPr.push("<w:b/><w:bCs/>");
    if (r.italic || opts.italic) rPr.push("<w:i/><w:iCs/>");
    const sz = r.size || opts.size;
    if (sz) rPr.push(`<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>`);
    const col = r.color || opts.color;
    if (col) rPr.push(`<w:color w:val="${col}"/>`);
    const rPrXml = rPr.length ? `<w:rPr>${rPr.join("")}</w:rPr>` : "";
    const text = esc(r.text||"");
    return `<w:r>${rPrXml}<w:t xml:space="preserve">${text}</w:t></w:r>`;
  }).join("");

  return `<w:p>${pPrXml}${runsXml}</w:p>`;
}

export function dxBi(vi, other, opts={}) {
  const sz = opts.size || 22;
  return [
    dxPara([{text: vi, bold: opts.bold}], {align: opts.align, spaceBefore: 0, spaceAfter: 0, size: sz}),
    dxPara([{text: other, italic: true, color: "666666"}], {align: opts.align, spaceBefore: 0, spaceAfter: opts.gap !== undefined ? opts.gap : 80, size: sz - 2}),
  ].join("");
}

export function dxEmpty(n=1) { return Array(n).fill("<w:p/>").join(""); }

export function dxCell(content, width, opts={}) {
  const tcPr = [`<w:tcW w:w="${width}" w:type="dxa"/>`,
    `<w:tcBorders>
      <w:top w:val="single" w:sz="4" w:color="333333"/>
      <w:left w:val="single" w:sz="4" w:color="333333"/>
      <w:bottom w:val="single" w:sz="4" w:color="333333"/>
      <w:right w:val="single" w:sz="4" w:color="333333"/>
    </w:tcBorders>`,
    "<w:vAlign w:val=\"center\"/>",
  ];
  if (opts.bg) tcPr.push(`<w:shd w:val="clear" w:color="auto" w:fill="${opts.bg}"/>`);
  if (opts.span) tcPr.push(`<w:gridSpan w:val="${opts.span}"/>`);
  const tcPrXml = `<w:tcPr>${tcPr.join("")}</w:tcPr>`;
  const inner = Array.isArray(content) ? content.join("") : content;
  return `<w:tc>${tcPrXml}${inner}</w:tc>`;
}

export function dxHeaderCell(vi, en, width) {
  return dxCell([
    dxPara([{text: vi, bold:true, color:"FFFFFF"}], {align:"center", spaceAfter:0, size:18}),
    dxPara([{text: en, bold:true, italic:true, color:"FFFFFF"}], {align:"center", spaceAfter:0, size:16}),
  ], width, {bg:"1A2540"});
}

export function dxRow(cells, opts={}) {
  const trPr = opts.header ? "<w:trPr><w:tblHeader/></w:trPr>" : "";
  const inner = Array.isArray(cells) ? cells.join("") : String(cells || "");
  return `<w:tr>${trPr}${inner}</w:tr>`;
}

export function dxTable(rows, totalWidth) {
  const inner = Array.isArray(rows) ? rows.join("") : String(rows || "");
  return `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="${totalWidth}" w:type="dxa"/>
      <w:tblBorders>
        <w:top w:val="single" w:sz="4" w:color="333333"/>
        <w:left w:val="single" w:sz="4" w:color="333333"/>
        <w:bottom w:val="single" w:sz="4" w:color="333333"/>
        <w:right w:val="single" w:sz="4" w:color="333333"/>
        <w:insideH w:val="single" w:sz="4" w:color="333333"/>
        <w:insideV w:val="single" w:sz="4" w:color="333333"/>
      </w:tblBorders>
      <w:tblLayout w:type="fixed"/>
    </w:tblPr>
    ${inner}
  </w:tbl>`;
}

export function dxNoBorderTable(rows, totalWidth) {
  const inner = Array.isArray(rows) ? rows.join("") : String(rows || "");
  return `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="${totalWidth}" w:type="dxa"/>
      <w:tblBorders>
        <w:top w:val="none" w:sz="0" w:color="auto"/>
        <w:left w:val="none" w:sz="0" w:color="auto"/>
        <w:bottom w:val="none" w:sz="0" w:color="auto"/>
        <w:right w:val="none" w:sz="0" w:color="auto"/>
        <w:insideH w:val="none" w:sz="0" w:color="auto"/>
        <w:insideV w:val="none" w:sz="0" w:color="auto"/>
      </w:tblBorders>
      <w:tblLayout w:type="fixed"/>
    </w:tblPr>
    ${inner}
  </w:tbl>`;
}

export function dxNoBorderCell(content, width) {
  const tcPr = `<w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>
    <w:tcBorders><w:top w:val="none" w:sz="0" w:color="auto"/><w:left w:val="none" w:sz="0" w:color="auto"/><w:bottom w:val="none" w:sz="0" w:color="auto"/><w:right w:val="none" w:sz="0" w:color="auto"/></w:tcBorders>
    <w:vAlign w:val="center"/></w:tcPr>`;
  const inner = Array.isArray(content) ? content.join("") : String(content || "");
  return `<w:tc>${tcPr}${inner}</w:tc>`;
}

export async function buildDocxBlob(bodyXmlParts, imageMap, margins) {
  await ensureJSZip();
  if (!window.JSZip) throw new Error("JSZip chưa tải. Kiểm tra kết nối mạng.");
  const zip = new window.JSZip();
  const m = Object.assign({ top:720, right:900, bottom:720, left:900, header:0, footer:0 }, margins||{});
  zip.file("[Content_Types].xml", DOCX_CONTENT_TYPES);
  zip.file("_rels/.rels", DOCX_RELS);
  zip.file("word/_rels/document.xml.rels", buildWordRels(imageMap));
  zip.file("word/styles.xml", DOCX_STYLES);
  zip.file("word/settings.xml", DOCX_SETTINGS);

  if (imageMap) {
    for (const [rId, {dataUrl, ext}] of Object.entries(imageMap)) {
      const base64 = dataUrl.split(",")[1];
      zip.file(`word/media/${rId}.${ext}`, base64, {base64:true});
    }
  }

  const innerBody = Array.isArray(bodyXmlParts) ? bodyXmlParts.join("\n") : String(bodyXmlParts || "");

  const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"
  xmlns:v="urn:schemas-microsoft-com:vml">
  <w:body>
    ${innerBody}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="${m.top}" w:right="${m.right}" w:bottom="${m.bottom}" w:left="${m.left}" w:header="${m.header}" w:footer="${m.footer}"/>
    </w:sectPr>
  </w:body>
</w:document>`;
  zip.file("word/document.xml", docXml);

  const blob = await zip.generateAsync({type:"blob", mimeType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"});
  return blob;
}

export function buildWordRels(imageMap) {
  const imgRels = imageMap ? Object.entries(imageMap).map(([rId, {ext}]) =>
    `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${rId}.${ext}"/>`
  ).join("") : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
  ${imgRels}
</Relationships>`;
}

export function dxImage(rId, widthEmu, heightEmu) {
  return `<w:r><w:rPr/><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">
    <wp:extent cx="${widthEmu}" cy="${heightEmu}"/>
    <wp:docPr id="1" name="img_${rId}"/>
    <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
      <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
        <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
          <pic:nvPicPr><pic:cNvPr id="0" name="img_${rId}"/><pic:cNvPicPr/></pic:nvPicPr>
          <pic:blipFill>
            <a:blip r:embed="${rId}"/>
            <a:stretch><a:fillRect/></a:stretch>
          </pic:blipFill>
          <pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${widthEmu}" cy="${heightEmu}"/></a:xfrm>
            <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          </pic:spPr>
        </pic:pic>
      </a:graphicData>
    </a:graphic>
  </wp:inline></w:drawing></w:r>`;
}

export const DEFAULT_SAVE_PATH = "D:\\Cloud\\DOC";

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  try {
    navigator.clipboard.writeText(DEFAULT_SAVE_PATH + "\\" + filename).catch(()=>{});
  } catch(e) {}
  
  const toast = document.createElement("div");
  toast.style.cssText = "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1a2540;color:#fff;padding:10px 20px;border-radius:8px;font-size:13px;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,0.3);";
  toast.innerHTML = `💾 Đã tải: <b>${filename}</b><br><span style="font-size:11px;opacity:0.8">Đường dẫn lưu: ${DEFAULT_SAVE_PATH} (đã copy vào clipboard)</span>`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}
