const express = require('express')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const globalErrorHandler = require('./api/v1/middlewares/globalErrorHandler.middleware')
const path = require('path')
const puppeteer = require('puppeteer');
const { projectPaths } = require('./config/constants')
const htmlPdf = require('html-pdf')
const fs = require('fs')
const { generateInvoicePDF } = require('./api/v1/controllers/invoice.controller')

const app = express()

app.use(cors({
  origin: process.env.CORS_ORIGIN,
  credentials: true
}))

app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: true, limit: '16kb' }));
app.use(express.static('public'))
app.use(cookieParser())

// Routes import
const userRoutes = require('./api/v1/routes/user.routes')
const { ApiError } = require('./api/v1/services/ApiError')
const { productRoutes } = require('./api/v1/routes/product')
const { ApiResponse } = require('./api/v1/services/ApiResponse')

// Routes declaration
// app.use('/users', userRoutes)
app.use('/products', productRoutes)
// app.use('/api', (req, res, next) => {
//   console.log('Request to /api');
//   next();
// });


// Generate PDF
app.get('/generate-pdf', async (req, res, next) => {
  try {
    // Get the path to the generated PDF file
    const filePath = path.join(projectPaths.ROOT_DIR, './invoice.pdf');

    // Generate the PDF
    await generateInvoicePDF("", puppeteer); // generates the PDF and saves it

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
