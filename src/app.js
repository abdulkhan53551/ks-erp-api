const express = require('express')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const globalErrorHandler = require('./api/v1/middlewares/globalErrorHandler.middleware')
const path = require('path')
const puppeteer = require('puppeteer');
const { projectPaths } = require('./config/constants')
const fs = require('fs')
const { generateInvoicePDF, prepareInvoicePdfJsonData } = require('./api/v1/controllers/invoice.controller')
const dbTransaction = require('./api/v1/middlewares/dbTransaction.middleware')
const setUserContext = require('./api/v1/middlewares/setUserContext')
const routes = require('./api/v1/routes/index')
const { ERROR_CODES } = require('./config/constants/statusCodeMap')
const { fetchChallanPOEwayBillsForInvoice } = require('./api/v1/models/invoice.model')
const { configuredHelmet, hppMiddleware, globalRateLimiter, authRateLimiter } = require('./api/v1/middlewares/security.middleware')
const { sanitizeMiddleware } = require('./api/v1/middlewares/sanitize.middleware')

const app = express()

// Trust Render.com and Cloudflare reverse proxy headers (crucial for real client IP extraction & rate limiting)
app.set('trust proxy', 1)

// HTTP Security Headers (API-tuned Helmet)
app.use(configuredHelmet)
app.get('/test-pdf', async (req, res, next) => {
  // const browser = await puppeteer.launch({
  //   executablePath: path.join(
  //     process.cwd(),
  //     ".cache/puppeteer/chrome/linux-150.0.7871.24/chrome-linux64/chrome"
  //   ),
  //   headless: true,
  //   args: [
  //     "--no-sandbox",
  //     "--disable-setuid-sandbox",
  //     "--disable-dev-shm-usage",
  //   ],
  // });

  const chromeRoot = path.join(
    process.cwd(),
    ".cache",
    "puppeteer",
    "chrome"
  );

  const version = fs.readdirSync(chromeRoot)[0];

  const executablePath = path.join(
    chromeRoot,
    version,
    "chrome-linux64",
    "chrome"
  );

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    // args: [
    //   "--no-sandbox",
    //   "--disable-setuid-sandbox",
    //   "--disable-dev-shm-usage",
    // ],
  });
  const page = await browser.newPage();
  await page.setContent("<h1>Hello, World!</h1>");
  const pdf = await page.pdf();
  const pdfBuffer = Buffer.from(pdf);

  await browser.close();

  // Set the headers for the response as a PDF file
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
  const fileName = 'test.pdf';
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send(pdfBuffer);
})
app.use(cors({
  origin: process.env.CORS_ORIGIN,
  credentials: true,
  maxAge: 86400 // Cache preflight OPTIONS for 24 hours to reduce latency
}))
app.use(cookieParser())

// Lightweight health check (zero DB overhead for Render and React wakeup)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// Global DoS / DDoS Rate Limiter (Render /health is excluded)
app.use(globalRateLimiter);

// Payload size buffer limit tuned to 32kb
app.use(express.json({ limit: '32kb' }));
app.use(express.urlencoded({ extended: true, limit: '32kb' }));

// Anti-XSS & Puppeteer PDF SSRF / Local File Inclusion defense
app.use(sanitizeMiddleware);

// HTTP Parameter Pollution protection
app.use(hppMiddleware);
app.use(express.static('public'))

// Strict Auth Rate Limiter applied early before DB transaction to shield PostgreSQL pool from brute-force
app.use(['/auth/login', '/auth/register', '/auth/forgot-password', '/auth/reset-password'], authRateLimiter);

app.use(setUserContext);
app.use(dbTransaction); // <-- USE TRANSACTION MIDDLEWARE

// Routes declaration
app.use(routes)

// Generate PDF
app.get('/generate-pdf', async (req, res, next) => {
  try {
    // Fetch invoice data by ID
    let invoiceData = await fetchInvoiceById(invoiceData.invoiceId);

    // If invoiceData is not found, throw an error
    if (!invoiceData) {
      throw new ApiError({ statusCode: 404, errorCode: ERROR_CODES.NOT_FOUND, message: 'Invoice not found' });
    }

    const invoiceChallanPOEwaybillData = await fetchChallanPOEwayBillsForInvoice(invoiceData.invoiceId);
    invoiceData = {
      ...invoiceData,
      ...invoiceChallanPOEwaybillData
    }

    const invoicePdfJsonData = prepareInvoicePdfJsonData(invoiceData);


    // Get the path to the generated PDF file
    const filePath = path.join(projectPaths.ROOT_DIR, './invoice.pdf');



    // Generate the PDF
    await generateInvoicePDF(invoicePdfJsonData, puppeteer); // generates the PDF and saves it

    // Set the headers for the response as a PDF file
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="invoice.pdf"');

    // Stream the PDF file to the response
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

    // Handle errors during the streaming
    fileStream.on('end', () => {
      fs.unlink(filePath, () => { }); // optional: clean up after download
    });
  } catch (error) {
    next(error);
  }
});

// Global error-handling middleware (must be last)
app.use(globalErrorHandler);

module.exports = {
  app
}
