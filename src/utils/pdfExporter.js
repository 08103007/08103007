import { ensureHtml2Canvas, ensureJsPdf } from './docxBuilder';

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
      table.quote-items-table, table.handover-items-table, table.debt-items-table, table.contract-table, table.payreq-table, table.print-table {
        border-collapse: collapse !important;
        border-spacing: 0 !important;
        border: 1px solid #000000 !important;
      }
      table.quote-items-table th, table.quote-items-table td,
      table.handover-items-table th, table.handover-items-table td,
      table.debt-items-table th, table.debt-items-table td,
      table.contract-table th, table.contract-table td,
      table.payreq-table th, table.payreq-table td,
      table.print-table th, table.print-table td {
        border: 1px solid #000000 !important;
        box-sizing: border-box !important;
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

export async function exportElementToPdf(elementId, opts) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const options = typeof opts === "string" ? { filename: opts } : (opts || {});
  const { filename = "document.pdf", scale = 3, a4Px = 794, pad = 32, respectNoCut = false, extraCss = "" } = options;

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

  // 2. Fallback: Render PDF via client-side html2canvas + jsPDF with full-width offscreen clone
  const container = document.createElement("div");
  container.style.cssText = `position:fixed;top:0;left:-9999px;width:${a4Px}px;min-width:${a4Px}px;max-width:${a4Px}px;background:#ffffff;z-index:-9999;box-sizing:border-box;`;
  
  const clone = el.cloneNode(true);
  clone.id = elementId + "_pdf_clone";
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
    if (!window.html2canvas) {
      throw new Error("html2canvas library is not loaded yet");
    }

    // Wait a tick for layout and images to settle in clone
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
    
    if (!window.jspdf) {
      throw new Error("jsPDF library is not loaded yet");
    }
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
    doc.save(filename);
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}

