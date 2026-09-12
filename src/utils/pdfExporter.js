import { ensureHtml2Canvas, ensureJsPdf } from './docxBuilder';
import { COMPANY, getLogoUrl, getStampUrl, showToast } from './gasStore';
import { calcItems, fmt, generateCustomerShortName } from './helpers';

export function buildPrintHtml(elementId, extraCss) {
  const el = document.getElementById(elementId);
  if (!el) return null;
  const styles = Array.from(document.querySelectorAll("style,link[rel='stylesheet']"))
    .map(s => s.outerHTML).join("\n");
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap">
    ${styles}
    <style>
      @page { margin:10mm; size:A4; }
      html, body { background:#fff; margin:0; padding:0; height:auto !important; overflow:visible !important; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      * {
        font-family: 'Plus Jakarta Sans', sans-serif !important;
        letter-spacing: normal !important;
        word-spacing: normal !important;
        font-variant-numeric: normal !important;
        font-feature-settings: normal !important;
      }
      .no-print { display:none !important; }
      #${elementId} { position:relative !important; width:100% !important; max-width:100% !important; height:auto !important; overflow:visible !important; margin:0 !important; padding:0 !important; box-shadow:none !important; }
      table, th, td { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      table.quote-table, table.quote-items-table, table.handover-items-table, table.debt-items-table, table.contract-table, table.payreq-table, table.print-table {
        border-collapse: collapse !important;
        border-spacing: 0 !important;
        border: 0.5px solid #000000 !important;
        width: 100% !important;
        background: #ffffff !important;
      }
      table.quote-table th, table.quote-table td, table.quote-table tfoot td,
      table.quote-items-table th, table.quote-items-table td, table.quote-items-table tfoot td,
      table.handover-items-table th, table.handover-items-table td, table.handover-items-table tfoot td,
      table.debt-items-table th, table.debt-items-table td, table.debt-items-table tfoot td,
      table.contract-table th, table.contract-table td, table.contract-table tfoot td,
      table.payreq-table th, table.payreq-table td, table.payreq-table tfoot td,
      table.print-table th, table.print-table td, table.print-table tfoot td {
        border: 0.5px solid #000000 !important;
        box-sizing: border-box !important;
        background: #ffffff !important;
        color: #000000 !important;
      }
      img.company-stamp-img {
        width: 40mm !important;
        height: 40mm !important;
        max-width: 40mm !important;
        max-height: 40mm !important;
        object-fit: contain !important;
        aspect-ratio: 1 / 1 !important;
      }
      ${extraCss || ""}
    </style>
  </head><body>${el.outerHTML}</body></html>`;
}

const PDF_SERVER = 'http://localhost:3456';
let _serverAvailable = null; // null = unknown, true/false = cached

export async function checkPuppeteerServer() {
  try {
    const res = await fetch(`${PDF_SERVER}/health`, { signal: AbortSignal.timeout(800) });
    _serverAvailable = res.ok;
  } catch (_) {
    _serverAvailable = false;
  }
  return _serverAvailable;
}

export async function shutdownPuppeteerServer() {
  try {
    const res = await fetch(`${PDF_SERVER}/shutdown`, { method: 'POST', signal: AbortSignal.timeout(1000) });
    _serverAvailable = !res.ok;
    return res.ok;
  } catch (_) {
    return false;
  }
}

/**
 * Try to export via local Puppeteer server.
 * Returns true if PDF was generated and downloaded successfully.
 * Returns false if server unavailable (caller should fall back to pdfMake).
 */
export async function exportViaPuppeteer(html, filename) {
  if (!html) return false;
  // Dynamic health check: test if PDF server is online right now
  const isAlive = await checkPuppeteerServer();
  if (!isAlive) return false;
  try {
    const res = await fetch(`${PDF_SERVER}/pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html, filename }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      console.warn('[exportViaPuppeteer] Server error:', res.status);
      _serverAvailable = false;
      return false;
    }
    _serverAvailable = true;
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 2000);
    return true;
  } catch (err) {
    _serverAvailable = false;
    console.warn('[exportViaPuppeteer] Falling back to html2canvas:', err.message);
    return false;
  }
}

export function printElementViaIframe(elementId, extraCss) {
  const html = buildPrintHtml(elementId, extraCss);
  if (!html) return;
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:794px;height:1px;border:none;";
  iframe.srcdoc = html;
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
}

export async function generateElementPdfBlob(elementId, opts) {
  const el = document.getElementById(elementId);
  if (!el) return null;
  const options = typeof opts === "string" ? { filename: opts } : (opts || {});
  const { filename = "document.pdf", scale = 3, a4Px = 794, pad = 32 } = options;

  const container = document.createElement("div");
  container.style.cssText = `position:fixed;top:0;left:-9999px;width:${a4Px}px;min-width:${a4Px}px;max-width:${a4Px}px;background:#ffffff;z-index:-9999;box-sizing:border-box;`;
  
  const clone = el.cloneNode(true);
  clone.id = elementId + "_pdf_blob_clone";
  clone.style.width = `${a4Px}px`;
  clone.style.maxWidth = `${a4Px}px`;
  clone.style.minWidth = `${a4Px}px`;
  clone.style.padding = `${pad}px`;
  clone.style.margin = "0";
  clone.style.background = "#ffffff";
  clone.style.boxSizing = "border-box";
  clone.classList.add("pdf-mono");

  container.appendChild(clone);
  document.body.appendChild(container);

  try {
    await Promise.all([ensureHtml2Canvas(), ensureJsPdf()]);
    if (!window.html2canvas || !window.jspdf) {
      throw new Error("Thư viện tạo PDF chưa tải xong, vui lòng thử lại.");
    }

    await new Promise(r => setTimeout(r, 60));

    const canvas = await window.html2canvas(clone, { 
      scale: Math.min(scale, 3), 
      useCORS: true, 
      allowTaint: true, 
      backgroundColor: "#ffffff", 
      logging: false, 
      width: a4Px, 
      windowWidth: a4Px, 
      imageTimeout: 0 
    });
    
    const { jsPDF } = window.jspdf;
    const MARGIN = 8, printW = 210 - MARGIN * 2, printH = 297 - MARGIN * 2;
    const canvasScale = canvas.width / a4Px;
    const totalHeightPx = canvas.height / canvasScale;
    const mmPerPx = printW / a4Px;
    const pxPerPage = printH / mmPerPx;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    let srcY = 0, page = 0;
    while (srcY < totalHeightPx) {
      if (page > 0) doc.addPage();
      const slicePx = Math.min(pxPerPage, totalHeightPx - srcY);
      const sliceMm = slicePx * mmPerPx;
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = Math.ceil(slicePx * canvasScale);
      const ctx = slice.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(
        canvas,
        0, Math.floor(srcY * canvasScale), canvas.width, Math.ceil(slicePx * canvasScale),
        0, 0, slice.width, slice.height
      );
      doc.addImage(slice.toDataURL("image/jpeg", 0.95), "JPEG", MARGIN, MARGIN, printW, sliceMm);
      srcY += slicePx;
      page++;
    }
    const pdfBlob = doc.output("blob");
    const pdfFile = new File([pdfBlob], filename, { type: "application/pdf" });
    return { blob: pdfBlob, file: pdfFile, filename };
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}

export async function exportElementToPdf(elementId, opts) {
  const options = typeof opts === "string" ? { filename: opts } : (opts || {});
  const { filename = "document.pdf", extraCss = "" } = options;

  // 1. Export via Puppeteer PDF Server (localhost:3456) if server is running
  try {
    const html = buildPrintHtml(elementId, extraCss);
    if (html) {
      const puppeteerOk = await exportViaPuppeteer(html, filename);
      if (puppeteerOk) return;
    }
  } catch (pErr) {
    console.warn("Puppeteer PDF server export failed/unavailable, falling back to html2canvas:", pErr);
  }

  // 2. Fallback: Render PDF via client-side html2canvas + jsPDF
  const res = await generateElementPdfBlob(elementId, options);
  if (res && res.blob) {
    const url = URL.createObjectURL(res.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 2000);
  }
}

export function buildQuoteHtmlString(quote, options = {}) {
  const { subtotal, vat, total } = calcItems(quote.items || [], quote.vatRate);
  const showStt = options.showStt !== false;
  const showImage = options.showImage !== false && (quote.items || []).some(it => it.image && it.image.trim());
  const showNote = options.showNote !== false;
  const showVat = options.showVat !== false;
  const showStamp = options.showStamp !== false && COMPANY.showStamp !== false;
  const stampUrl = options.stampUrl || getStampUrl();
  const logoUrl = options.logoUrl || getLogoUrl();

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

  const dt = parseQuoteDate(quote.date);
  const qDay = String(dt.getDate()).padStart(2, "0");
  const qMonth = String(dt.getMonth() + 1).padStart(2, "0");
  const qYear = dt.getFullYear();

  const visibleCols = (showStt ? 1 : 0) +
    (showImage ? 1 : 0) +
    1 + // Hàng hóa
    1 + // SL
    1 + // ĐVT
    1 + // Đơn giá
    (showVat ? 1 : 0) +
    1;  // Thành tiền

  const rows = (quote.items || []).map((it, idx) => {
    const lineTotal = (it.qty || 0) * (it.price || 0);
    const hasNote = showNote && it.note;
    const vatStr = it.vat != null ? (it.vat > 0 ? `${it.vat}%` : "0%") : `${quote.vatRate || 0}%`;

    return `
      <tr>
        ${showStt ? `<td style="border:0.5px solid #000;background:#fff;color:#000;text-align:center;padding:5px 4px;font-size:11px;">${idx + 1}</td>` : ''}
        ${showImage ? `<td style="border:0.5px solid #000;background:#fff;color:#000;text-align:center;padding:3px;">${it.image ? `<img src="${it.image}" style="max-width:45px;max-height:45px;object-fit:contain;border-radius:3px;" />` : ''}</td>` : ''}
        <td style="border:0.5px solid #000;background:#fff;color:#000;padding:5px 6px;font-size:11px;">
          <div style="font-weight:600;font-size:11px;">${it.name || ''}</div>
          ${hasNote ? `<div style="font-size:9.5px;color:#555;margin-top:2px;white-space:pre-wrap;">${it.note}</div>` : ''}
        </td>
        <td style="border:0.5px solid #000;background:#fff;color:#000;text-align:center;padding:5px 4px;font-size:11px;">${it.qty || 0}</td>
        <td style="border:0.5px solid #000;background:#fff;color:#000;text-align:center;padding:5px 4px;font-size:11px;">${it.unit || ''}</td>
        <td style="border:0.5px solid #000;background:#fff;color:#000;text-align:right;padding:5px 4px;font-size:11px;">${fmt(it.price)}</td>
        ${showVat ? `<td style="border:0.5px solid #000;background:#fff;color:#000;text-align:center;padding:5px 4px;font-size:11px;">${vatStr}</td>` : ''}
        <td style="border:0.5px solid #000;background:#fff;color:#000;text-align:right;font-weight:600;padding:5px 4px;font-size:11px;">${fmt(lineTotal)}</td>
      </tr>
    `;
  }).join('');

  return `
    <div id="_offscreen_quote_preview" class="quote-preview" style="background:#fff;color:#000;font-family:'Plus Jakarta Sans',Arial,sans-serif;padding:16px 8px;width:730px;box-sizing:border-box;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px;border-bottom:3px solid #000;padding-bottom:14px;">
        <div style="display:flex;align-items:center;gap:14px;">
          <img src="${logoUrl}" style="width:56px;height:56px;object-fit:contain;" alt="PMC Logo" />
          <div>
            <h2 style="font-size:14px;font-weight:700;margin:0 0 3px 0;color:#000;">${COMPANY.name || ''}</h2>
            <p style="font-size:11px;margin:2px 0;color:#000;">MST: ${COMPANY.mst || ''}</p>
            <p style="font-size:11px;margin:2px 0;color:#000;">Địa chỉ: ${COMPANY.address || ''}</p>
            <p style="font-size:11px;margin:2px 0;color:#000;">ĐT: ${COMPANY.phone || ''} | Email: ${COMPANY.email || ''}</p>
          </div>
        </div>
      </div>

      <div style="text-align:center;margin-bottom:16px;">
        <h1 style="font-size:18px;font-weight:700;margin:0 0 4px 0;color:#000;">${quote.status === "provisional" ? "BẢNG BÁO GIÁ TẠM TÍNH" : "BẢNG BÁO GIÁ"}</h1>
        <div style="font-size:11.5px;color:#000;">Số: ${quote.quoteNumber || ''}</div>
      </div>

      <div style="margin-bottom:16px;font-size:11px;line-height:1.6;color:#000;">
        <div><strong>Kính gửi:</strong> ${quote.customer || ''}</div>
        ${quote.taxId ? `<div><strong>MST:</strong> ${quote.taxId}</div>` : ''}
        ${quote.address ? `<div><strong>Địa chỉ:</strong> ${quote.address}</div>` : ''}
        ${quote.phone ? `<div><strong>SĐT:</strong> ${quote.phone}</div>` : ''}
        ${quote.contact ? `<div><strong>Người liên hệ:</strong> ${quote.contact}</div>` : ''}
        ${quote.workContent ? `<div style="margin-top:4px;"><strong>Nội dung:</strong> ${quote.workContent}</div>` : ''}
      </div>

      <table class="quote-items-table quote-table" style="width:100%;border-collapse:collapse;border:0.5px solid #000;background:#fff;margin-bottom:12px;font-size:11px;">
        <thead>
          <tr>
            ${showStt ? `<th style="border:0.5px solid #000;background:#fff;color:#000;font-weight:700;text-align:center;padding:5px 4px;width:40px;font-size:11px;">STT</th>` : ''}
            ${showImage ? `<th style="border:0.5px solid #000;background:#fff;color:#000;font-weight:700;text-align:center;padding:5px 4px;width:60px;font-size:11px;">HÌNH</th>` : ''}
            <th style="border:0.5px solid #000;background:#fff;color:#000;font-weight:700;text-align:left;padding:5px 6px;font-size:11px;">HÀNG HÓA / DỊCH VỤ</th>
            <th style="border:0.5px solid #000;background:#fff;color:#000;font-weight:700;text-align:center;padding:5px 4px;width:45px;font-size:11px;">SL</th>
            <th style="border:0.5px solid #000;background:#fff;color:#000;font-weight:700;text-align:center;padding:5px 4px;width:60px;font-size:11px;">ĐVT</th>
            <th style="border:0.5px solid #000;background:#fff;color:#000;font-weight:700;text-align:right;padding:5px 4px;width:100px;font-size:11px;">ĐƠN GIÁ</th>
            ${showVat ? `<th style="border:0.5px solid #000;background:#fff;color:#000;font-weight:700;text-align:center;padding:5px 4px;width:50px;font-size:11px;">VAT</th>` : ''}
            <th style="border:0.5px solid #000;background:#fff;color:#000;font-weight:700;text-align:right;padding:5px 4px;width:110px;font-size:11px;">THÀNH TIỀN</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="${visibleCols - 1}" style="border:0.5px solid #000;background:#fff;color:#000;padding:5px 6px;text-align:right;font-weight:600;font-size:11px;">CỘNG TIỀN HÀNG (CHƯA VAT):</td>
            <td style="border:0.5px solid #000;background:#fff;color:#000;padding:5px 4px;text-align:right;font-weight:600;font-size:11px;">${fmt(subtotal)}</td>
          </tr>
          ${showVat ? `
          <tr>
            <td colspan="${visibleCols - 1}" style="border:0.5px solid #000;background:#fff;color:#000;padding:5px 6px;text-align:right;font-weight:600;font-size:11px;">TỔNG TIỀN THUẾ VAT:</td>
            <td style="border:0.5px solid #000;background:#fff;color:#000;padding:5px 4px;text-align:right;font-weight:600;font-size:11px;">${fmt(vat)}</td>
          </tr>` : ''}
          <tr style="background:#fff;">
            <td colspan="${visibleCols - 1}" style="border:0.5px solid #000;background:#fff;color:#000;padding:5px 6px;text-align:right;font-weight:700;font-size:11.5px;">TỔNG CỘNG THANH TOÁN (GỒM VAT):</td>
            <td style="border:0.5px solid #000;background:#fff;color:#000;padding:5px 4px;text-align:right;font-weight:700;font-size:12px;">${fmt(total)}</td>
          </tr>
        </tfoot>
      </table>

      ${quote.notes ? `
        <div style="margin-top:14px;font-size:11px;">
          <div style="font-weight:700;color:#000;margin-bottom:4px;">Ghi chú & Điều khoản:</div>
          <div style="white-space:pre-wrap;line-height:1.5;color:#000;">${quote.notes}</div>
        </div>
      ` : ''}

      <div style="display:flex;justify-content:space-between;margin-top:24px;font-size:11px;page-break-inside:avoid;">
        <div style="text-align:center;min-width:200px;">
          <div style="font-weight:700;color:#000;">ĐẠI DIỆN KHÁCH HÀNG</div>
          <div style="color:#666;font-size:10px;">(Ký, đóng dấu &amp; ghi rõ họ tên)</div>
          <div style="height:100px;"></div>
          <div style="font-weight:600;color:#000;">${quote.contact || quote.customer || ''}</div>
        </div>
        <div style="text-align:center;min-width:260px;max-width:320px;">
          <div style="color:#555;font-style:italic;margin-bottom:4px;">Phú Mỹ, ngày ${qDay} tháng ${qMonth} năm ${qYear}</div>
          <div style="font-weight:700;color:#000;margin-bottom:2px;">${COMPANY.short || "PMC"}</div>
          <div style="color:#666;font-size:10px;margin-bottom:4px;">(Ký, đóng dấu &amp; ghi rõ họ tên)</div>
          <div style="position:relative;min-height:90px;display:flex;justify-content:center;align-items:center;margin:4px 0;">
            ${showStamp && stampUrl ? `
              <img 
                src="${stampUrl}" 
                alt="Con dấu" 
                class="company-stamp-img"
                style="width:151px;height:151px;max-width:151px;max-height:151px;object-fit:contain;aspect-ratio:1/1;position:absolute;top:-24px;opacity:0.95;pointer-events:none;" 
              />
            ` : ''}
          </div>
          <div style="font-weight:700;font-size:12px;color:#000;text-transform:uppercase;margin-top:4px;">
            ${COMPANY.representative || "TRẦN VĂN THỊNH"}
          </div>
        </div>
      </div>
    </div>
  `;
}

export async function generateQuotePdfBlob(quote, options = {}) {
  const container = document.createElement("div");
  container.id = "_temp_quote_wrap";
  container.style.cssText = "position:fixed;top:0;left:-9999px;z-index:-9999;";
  container.innerHTML = buildQuoteHtmlString(quote, options);
  document.body.appendChild(container);

  try {
    const res = await generateElementPdfBlob("_offscreen_quote_preview", options);
    return res;
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}

export function showZaloPcModal({ filename, text, blob }) {
  const old = document.getElementById("zalo_pc_modal");
  if (old) old.remove();

  const modal = document.createElement("div");
  modal.id = "zalo_pc_modal";
  modal.style.cssText = `
    position: fixed;
    top: 0; left: 0; width: 100vw; height: 100vh;
    background: rgba(15, 23, 42, 0.65);
    backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center;
    z-index: 10000;
    font-family: 'Plus Jakarta Sans', Arial, sans-serif;
  `;

  modal.innerHTML = `
    <div style="background: #ffffff; width: 92%; max-width: 480px; border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2), 0 10px 10px -5px rgba(0,0,0,0.1); overflow: hidden; border: 1px solid #e2e8f0; animation: scaleUp 0.18s ease-out;">
      <div style="background: #0068ff; color: #fff; padding: 14px 18px; display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 15px;">
          <span style="font-size: 20px;">💬</span> Gửi Báo Giá Qua Zalo
        </div>
        <button id="_zalo_modal_close" style="background: none; border: none; color: #fff; font-size: 22px; cursor: pointer; line-height: 1; padding: 0 4px;">×</button>
      </div>

      <div style="padding: 18px 20px; color: #1e293b;">
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px 14px; margin-bottom: 12px; display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 26px;">📄</span>
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 700; font-size: 13px; color: #166534; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
              ${filename}
            </div>
            <div style="font-size: 11.5px; color: #15803d;">
              ✅ Đã tải file PDF báo giá về máy tính
            </div>
          </div>
        </div>

        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px; display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 24px;">📋</span>
          <div style="flex: 1;">
            <div style="font-weight: 700; font-size: 13px; color: #1e40af;">
              Đã sao chép nội dung báo giá vào bộ nhớ tạm
            </div>
            <div style="font-size: 11.5px; color: #2563eb;">
              Bạn chỉ cần nhấn <strong>Ctrl + V</strong> trong ô chat Zalo để dán
            </div>
          </div>
        </div>

        <div style="font-size: 13px; font-weight: 600; color: #334155; margin-bottom: 10px;">
          👉 Chọn cách mở Zalo:
        </div>

        <div style="display: flex; gap: 10px; margin-bottom: 16px;">
          <button id="_btn_open_zalo_app" style="flex: 1; padding: 12px 14px; background: #0068ff; color: #fff; border: none; border-radius: 8px; font-weight: 600; font-size: 13px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 2px 6px rgba(0,104,255,0.25);">
            💬 Mở Zalo App (PC)
          </button>
          <button id="_btn_open_zalo_web" style="flex: 1; padding: 12px 14px; background: #ffffff; color: #0068ff; border: 1.5px solid #0068ff; border-radius: 8px; font-weight: 600; font-size: 13px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
            🌐 Mở Zalo Web
          </button>
        </div>

        <div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 10px 12px; font-size: 11.5px; color: #64748b; line-height: 1.6;">
          <strong>💡 3 bước gửi nhanh cho khách:</strong><br/>
          1. Bấm nút <strong>"Mở Zalo App (PC)"</strong> hoặc chuyển sang Zalo.<br/>
          2. Chọn khách hàng $\rightarrow$ bấm <strong>Ctrl + V</strong> để dán lời nhắn báo giá.<br/>
          3. Kéo thả file PDF vừa tải (ở góc dưới trình duyệt hoặc thư mục Downloads) vào ô chat.
        </div>
      </div>

      <div style="background: #f8fafc; padding: 10px 18px; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 8px;">
        <button id="_btn_recopy_text" style="padding: 7px 12px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12px; cursor: pointer; color: #334155; font-weight: 500;">
          📋 Sao chép lại lời nhắn
        </button>
        <button id="_zalo_modal_done" style="padding: 7px 18px; background: #0068ff; color: #fff; border: none; border-radius: 6px; font-size: 12px; cursor: pointer; font-weight: 600;">
          Đóng
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeModal = () => {
    if (document.body.contains(modal)) document.body.removeChild(modal);
  };

  modal.querySelector("#_zalo_modal_close").onclick = closeModal;
  modal.querySelector("#_zalo_modal_done").onclick = closeModal;
  modal.onclick = (e) => { if (e.target === modal) closeModal(); };

  modal.querySelector("#_btn_open_zalo_app").onclick = () => {
    // Open Zalo PC application protocol
    window.location.href = "zalo://";
  };

  modal.querySelector("#_btn_open_zalo_web").onclick = () => {
    window.open("https://chat.zalo.me/", "_blank");
  };

  modal.querySelector("#_btn_recopy_text").onclick = async () => {
    try {
      await navigator.clipboard.writeText(text);
      showToast("📋 Đã sao chép lại nội dung báo giá!", 2000);
    } catch (_) {}
  };
}

export async function shareQuoteViaZalo(quote, options = {}) {
  if (!quote) return;
  const { total } = calcItems(quote.items || [], quote.vatRate);
  
  const text = `📄 BÁO GIÁ PMC - ${COMPANY.short || "PMC"}\n----------------------------\n` +
    `• Số BG: ${quote.quoteNumber || "BG"}\n` +
    `• Khách hàng: ${quote.customer || ""}\n` +
    `• Ngày: ${quote.date || ""}\n` +
    `• Tổng tiền: ${fmt(total)} VNĐ\n` +
    `----------------------------\n` +
    `Vui lòng xem file PDF đính kèm. Trân trọng!`;

  const compShort = (options.customerShortName || generateCustomerShortName(quote.customer) || "KH");
  const filename = `${quote.quoteNumber || "BG"}_${compShort}.pdf`;

  showToast("⏳ Đang tạo file PDF báo giá...", 2500);

  try {
    let pdfRes = null;
    const previewEl = document.getElementById("quotePreviewContent");
    if (previewEl) {
      pdfRes = await generateElementPdfBlob("quotePreviewContent", { filename });
    } else {
      pdfRes = await generateQuotePdfBlob(quote, { filename });
    }

    if (!pdfRes || !pdfRes.file) {
      throw new Error("Không thể tạo file PDF");
    }

    const { file, blob } = pdfRes;
    const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');

    // 1. Mobile: Native Web Share with attached PDF file
    if (isMobile && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: `Báo Giá ${quote.quoteNumber} - ${quote.customer}`,
          text: text,
          files: [file]
        });
        showToast("✅ Đã mở chia sẻ Báo giá kèm file PDF!", 3000);
        return;
      } catch (err) {
        if (err.name === "AbortError") return; // User cancelled
        console.warn("navigator.share with file failed, falling back:", err);
      }
    }

    // 2. PC / Desktop: Download PDF + Copy text + Open Zalo Modal
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 3000);

    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {}

    showZaloPcModal({ filename, text, blob });
  } catch (err) {
    console.error("Lỗi gửi Zalo:", err);
    showToast("⚠️ Lỗi tạo PDF gửi Zalo: " + err.message, 4000);
  }
}

