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

const app = express()
app.get('/test-pdf', async (req, res, next) => {
      const browser = await puppeteer.launch({
        // executablePath: path.join(
        //   process.cwd(),
        //   ".cache/puppeteer/chrome/linux-150.0.7871.24/chrome-linux64/chrome"
        // ),
        executablePath: await puppeteer.executablePath(),
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
        ],
      });
      const page = await browser.newPage();
      await page.setContent("<h1>Hello, World!</h1>");
      const pdf = await page.pdf();
      const pdfBuffer = Buffer.from(pdf);

      await browser.close();
  
      // Set the headers for the response as a PDF file
      res.setHeader('Content-Type', 'application/pdf');
      res.send(pdfBuffer);
})
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }))
app.use(express.json({ limit: '16kb' }));
app.use(setUserContext);
app.use(express.urlencoded({ extended: true, limit: '16kb' }));
app.use(express.static('public'))
app.use(cookieParser())
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
