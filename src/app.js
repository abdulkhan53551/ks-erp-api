const express = require('express')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const globalErrorHandler = require('./api/v1/middlewares/globalErrorHandler.middleware')
const path = require('path')
const puppeteer = require('puppeteer');
const {ROOT_DIR} = require('./config/constant')
const htmlPdf = require('html-pdf')
const fs = require('fs')

const app = express()

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}))

app.use(express.json({limit: '16kb'}));
app.use(express.urlencoded({ extended: true, limit: '16kb' }));
app.use(express.static('public'))
app.use(cookieParser())

// Routes import
const userRoutes = require('./api/v1/routes/user.routes')
const { ApiError } = require('./api/v1/services/ApiError')

// Routes declaration
app.use('/users', userRoutes)

// Generate PDF
app.get('/generate-pdf', async (req, res) => {
    try {
       // Launch the browser and open a new blank page
        // const browser = await puppeteer.launch();
        const browser = await puppeteer.launch({
            executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // Path to Chrome
            // headless: false,
            // args: ['--no-sandbox', '--disable-setuid-sandbox'],
          });
        const page = await browser.newPage();

        // Navigate the page to a URL.
        await page.goto(`file://${path.join(`${ROOT_DIR}/templates/invoice/`, 'invoice.template.html')}`, { waitUntil: 'load' });



        // await page.setContent('<h1>Hello World</h1>')


        // Save the PDF to a file
        await page.pdf({
          format: 'A4',
          path: 'table.pdf', // Save to file
          printBackground: true,
        });

        await browser.close();

        // Set proper headers for downloading the PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="table.pdf"');

        // res.status(200).send({message: 'PDF generated successfully'})
          // Stream the generated PDF to the client
      fs.createReadStream('table.pdf').pipe(res);
      // return res.status(200).send({message: 'PDF generated successfully'})
    } catch (error) {
        console.log('error => ', error);
        
        throw new ApiError(500, 'Error generating PDF')
    }
});

// Global error-handling middleware (must be last)
app.use(globalErrorHandler);

module.exports = {
    app
}
