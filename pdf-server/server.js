/**
 * PMC PDF Server — Local Puppeteer PDF generator
 * Chạy song song với app, lắng nghe POST /pdf từ browser.
 *
 * Usage:
 *   node server.js          (default port 3456)
 *   PORT=3457 node server.js
 */

const express  = require('express');
const cors     = require('cors');
const puppeteer = require('puppeteer');

const PORT = process.env.PORT || 3456;
const app = express();

// Allow requests from any localhost origin (app opened via file:// or localhost:*)
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '20mb' }));

// ──────────────────────────────────────────
// Reuse a single browser instance for speed
// ──────────────────────────────────────────
let browser = null;

async function getBrowser() {
  if (browser && browser.isConnected()) return browser;
  console.log('[PDF Server] Launching Chromium...');
  browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--font-render-hinting=none',   // sharper font rendering in headless
    ]
  });
  browser.on('disconnected', () => { browser = null; });
  console.log('[PDF Server] Chromium ready.');
  return browser;
}

// ──────────────────────────────────────────
// GET /health  — used by the app to check
//               if the server is available
// ──────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ ok: true, version: '1.0.0' });
});

// ──────────────────────────────────────────
// POST /shutdown — shutdown the server gracefully
// ──────────────────────────────────────────
app.post('/shutdown', (req, res) => {
  res.json({ success: true, message: 'Server is shutting down...' });
  console.log('[PDF Server] Shutdown request received. Graceful exit in 1s...');
  setTimeout(shutdown, 1000);
});

// ──────────────────────────────────────────
// POST /pdf
//   Body (JSON):
//     html     {string}  Complete HTML document to render
//     filename {string}  Desired download filename  (default: document.pdf)
//     format   {string}  Page format                (default: A4)
//     margin   {object}  { top, right, bottom, left } in mm
//                        defaults to 10mm all sides
// Returns: application/pdf binary
// ──────────────────────────────────────────
app.post('/pdf', async (req, res) => {
  const {
    html,
    filename = 'document.pdf',
    format   = 'A4',
    margin   = { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
  } = req.body || {};

  if (!html) {
    return res.status(400).json({ error: 'Missing required field: html' });
  }

  let page;
  try {
    const b = await getBrowser();
    page = await b.newPage();

    // Set viewport to A4 width at 96 dpi
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });

    // Load fonts from Google Fonts before rendering
    await page.setContent(html, {
      waitUntil: 'networkidle0',   // wait for Google Fonts to finish loading
      timeout: 30_000,
    });

    // Extra wait to ensure fonts are fully rendered (handles FOUT)
    await new Promise(resolve => setTimeout(resolve, 300));

    const pdfBuffer = await page.pdf({
      format,
      printBackground: true,
      margin,
      preferCSSPageSize: false,
    });

    await page.close();
    page = null;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
    );
    res.send(Buffer.from(pdfBuffer));
    console.log(`[PDF Server] Generated: ${filename} (${Math.round(pdfBuffer.length / 1024)} KB)`);

  } catch (err) {
    console.error('[PDF Server] Error:', err.message);
    if (page) { try { await page.close(); } catch (_) {} }
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────
// System Tray Icon Integration (systray2)
// ──────────────────────────────────────────
const path = require('path');
const { exec } = require('child_process');

let systray = null;

const ICON_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAOxAAADsQBlSsOGwAAADh0RVh0U29mdHdhcmUARGVzaWduZXIgKEMpIENvcmVsIENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLjhY10gAAAJJSURBVFiF7ZXNS1RhGMZ/z3lGnaY0l4yC1E20aREtW7hwoW1atWgRQRv/ghb9AVpGQWv/gqCFIoKwhQurwKCISjMLp8x0xsnRmbFv5znvhW/M1Ix1XvCwcPh+55z3eX6873veM84oFAqF/xNtb1+xV/P5kCJSrVaT6vV6rFQqtYhIpVKpt/4p8TxPhBAvgyCYKBaLq6lU6pVS6nkURW+01m86YhRF0Y2Z92T20f2D/Rtz0/OnjDFXjDH3nXMfi8XiW73+83oF4zjeY4x56pw7p7U+Z4x50+v7jUZjLgiCJ2b2wjn3YHx8/NtsNrvsnDtpZj+NMTeVUveUUl+995t7BWPp9H6l1KzW+pBzbgP4CvwEPs/NzX1oNpsXnXMXzOwTUAxDsC+gXq8v+b7/EMi1l3vAx878T7w3Z/2q1WqJ4zg+K4R4C2TbC0u/r0fALyEEpVLpvBDijVLqufPuQ71eb3me94m5v+v707u7d8x6vb7U/k29L4SwgVfOub3AHaXUdWPM217f/yvg3/2pUCg8933/iZmdB24A3Z/T3T+Tfwtw3vd92w03/h7guu7j1s/p0i8/H0C5XD7k+/5d4Hjrdw44rZSarFQq5Z/9e/r06d5sNnvPzJpA11f+2z8t+gKq1Wp9dHSEVqv1y/u/tF367Vb/N3jX/P9PZ/26L/97QKlU6jV3wDnHvwcIgoC9e/fi+/6vP/3/B8r27Rvv9ff3v2g2mywkJCYnJyksLCR3dDR0dHQsLi4unltYWJj+D0q5XB7xfX/YGLPFzLqA1/Z7s/v19fV1r6/7B0Tj/wH9B70X/C31ZAAAAABJRU5ErkJggg==';

function initSystemTray() {
  try {
    const SysTray = require('systray2').default;
    
    const itemStatus = {
      title: `🟢 PMC PDF Server (Port ${PORT}) — Đang chạy`,
      tooltip: 'Trạng thái PMC PDF Server',
      checked: false,
      enabled: false
    };

    const itemOpenApp = {
      title: '🌐 Mở ứng dụng Báo Giá',
      tooltip: 'Mở ứng dụng Báo giá trên trình duyệt',
      checked: false,
      enabled: true
    };

    const itemOpenFolder = {
      title: '📁 Mở thư mục dự án',
      tooltip: 'Mở thư mục chứa file PDF Server',
      checked: false,
      enabled: true
    };

    const itemExit = {
      title: '❌ Thoát PDF Server',
      tooltip: 'Tắt hoàn toàn PDF Server',
      checked: false,
      enabled: true
    };

    systray = new SysTray({
      menu: {
        icon: ICON_BASE64,
        title: 'PMC PDF Server',
        tooltip: `PMC PDF Server (Port ${PORT})`,
        items: [
          itemStatus,
          { title: '', tooltip: '', checked: false, enabled: false },
          itemOpenApp,
          itemOpenFolder,
          { title: '', tooltip: '', checked: false, enabled: false },
          itemExit
        ]
      },
      debug: false,
      copyDir: true
    });

    systray.onClick(action => {
      if (action.item.title === itemOpenApp.title) {
        const appPath = path.resolve(__dirname, '..', 'dist', 'index.html');
        exec(`start "" "${appPath}"`);
      } else if (action.item.title === itemOpenFolder.title) {
        const folderPath = path.resolve(__dirname, '..');
        exec(`explorer "${folderPath}"`);
      } else if (action.item.title === itemExit.title) {
        console.log('[PDF Server] Thoát từ System Tray Icon...');
        shutdown();
      }
    });

    console.log('[PDF Server] Đã thu nhỏ thành công vào System Tray Icon!');
  } catch (err) {
    console.log('[PDF Server] Warning: Could not initialize System Tray Icon:', err.message);
  }
}

// ──────────────────────────────────────────
// Start
// ──────────────────────────────────────────
app.listen(PORT, async () => {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║      PMC PDF Server đang chạy            ║');
  console.log(`║      http://localhost:${PORT}               ║`);
  console.log('║                                          ║');
  console.log('║  Thu nhỏ: Nằm ở khay hệ thống (Tray Icon) ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
  
  // Initialize System Tray Icon
  initSystemTray();

  // Pre-warm browser so first PDF is fast
  try { await getBrowser(); } catch (_) {}
});

// Cleanup on exit
async function shutdown() {
  console.log('\n[PDF Server] Đang tắt...');
  if (systray) { try { systray.kill(); } catch (_) {} }
  if (browser) { try { await browser.close(); } catch (_) {} }
  process.exit(0);
}
process.on('SIGINT',  shutdown);
process.on('SIGTERM', shutdown);
