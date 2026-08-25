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
      html { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      body { background:#fff; margin:0; padding:0; }
      * { font-family: 'Plus Jakarta Sans', sans-serif !important; }
      .no-print { display:none !important; }
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

  // 2. Fallback: Render PDF bang client-side html2canvas + jsPDF
  const save = { width: el.style.width, maxWidth: el.style.maxWidth, padding: el.style.padding, margin: el.style.margin, bg: el.style.background };
  el.style.width = a4Px + "px"; el.style.maxWidth = a4Px + "px";
  el.style.padding = pad + "px"; el.style.margin = "0"; el.style.background = "#ffffff";
  el.classList.add("pdf-mono");

  const noCutRanges = [];
  if (respectNoCut) {
    el.querySelectorAll("p, h1, h2, h3, h4, h5, h6, table, tr, ul, ol, blockquote, section, header, footer").forEach(elm => {
      const r = elm.getBoundingClientRect(), p = el.getBoundingClientRect();
      noCutRanges.push({ top: r.top - p.top, bottom: r.bottom - p.top });
    });
  }

  try {
    await Promise.all([ensureHtml2Canvas(), ensureJsPdf()]);
    if (!window.html2canvas) {
      throw new Error("html2canvas library is not loaded yet");
    }
    const canvas = await window.html2canvas(el, { scale, useCORS: true, allowTaint: true, backgroundColor: "#ffffff", logging: false, width: a4Px, height: el.scrollHeight, windowWidth: a4Px, imageTimeout: 0 });
    
    if (!window.jspdf) {
      throw new Error("jsPDF library is not loaded yet");
    }
    const { jsPDF } = window.jspdf;
    const MARGIN = 10, printW = 210 - MARGIN * 2, printH = 297 - MARGIN * 2;
    const realW = canvas.width / scale, realH = canvas.height / scale;
    const mmPerPx = printW / realW, pxPerPage = printH / mmPerPx;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    let srcY = 0, page = 0;
    while (srcY < realH) {
      if (page > 0) doc.addPage();
      let slicePx = Math.min(pxPerPage, realH - srcY);
      if (respectNoCut && srcY + slicePx < realH) {
        for (const rng of noCutRanges) {
          if ((srcY + slicePx) > rng.top + 0.5 && (srcY + slicePx) < rng.bottom - 0.5) {
            const adj = rng.top - srcY; if (adj > 0) slicePx = adj; break;
          }
        }
      }
      const sliceMm = slicePx * mmPerPx;
      const slice = document.createElement("canvas");
      slice.width = canvas.width; slice.height = Math.ceil(slicePx * scale);
      const ctx = slice.getContext("2d");
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, Math.floor(srcY * scale), canvas.width, Math.ceil(slicePx * scale), 0, 0, slice.width, slice.height);
      doc.addImage(slice.toDataURL("image/jpeg", 0.92), "JPEG", MARGIN, MARGIN, printW, sliceMm);
      srcY += slicePx; page++;
    }
    doc.save(filename);
  } finally {
    el.style.width = save.width; el.style.maxWidth = save.maxWidth;
    el.style.padding = save.padding; el.style.margin = save.margin; el.style.background = save.bg;
    el.classList.remove("pdf-mono");
  }
}

