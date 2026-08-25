const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

module.exports = async (req, res) => {
  // CORS Headers for cross-origin access (GitHub Pages, Vercel, Localhost)
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { html, url, landscape, format, scale, margin } = req.body || {};

    if (!html && !url) {
      return res.status(400).json({ error: 'Cần cung cấp dữ liệu HTML hoặc URL để tạo PDF' });
    }

    // Configure sparticuz/chromium for Vercel Serverless Environment
    const executablePath = await chromium.executablePath();
    
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();

    if (html) {
      await page.setContent(html, { waitUntil: 'networkidle0', timeout: 15000 });
    } else if (url) {
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 15000 });
    }

    const pdfBuffer = await page.pdf({
      format: format || 'A4',
      printBackground: true,
      landscape: !!landscape,
      scale: scale ? parseFloat(scale) : 1,
      margin: margin || { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' }
    });

    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="bao-gia-cloud.pdf"');
    return res.status(200).send(pdfBuffer);
  } catch (error) {
    console.error('Vercel Serverless Puppeteer PDF Error:', error);
    return res.status(500).json({ 
      error: 'Lỗi tạo PDF từ Vercel Serverless: ' + (error.message || error.toString()) 
    });
  }
};
