const { projectPaths } = require("../../../config/constants");
const { sampleInvoiceData } = require("./sampleInvoiceData");
const path = require('path')
const ejs = require('ejs')
const { ApiError } = require('./../services/ApiError');

// Generate invoice PDF
const generateInvoicePDF = async (invoiceData, puppeteer) => {
    try {
        /* 
            =========================================
            Pass 1: render with estimated filler rows
            =========================================
        */

        // Get invoice template file
        const templatePath = path.join(`${projectPaths.ROOT_DIR}/templates/invoice/`, 'invoice-template.ejs');

        // Fill the template with invoice data
        const filledHtml = await ejs.renderFile(templatePath, sampleInvoiceData);

        // Launch the browser and open a new blank page
        // const browser = await puppeteer.launch();
        const browser = await puppeteer.launch({
            executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // Path to Chrome
            // headless: false,
        });

        // Initialize a new page
        const page = await browser.newPage();

        // Set the content of the page to the filled HTML
        await page.setContent(filledHtml, { waitUntil: 'networkidle0' });

        // Measure rendered table height
        const { invoiceHeight, invoiceOccupiedHeight } = await page.evaluate(evaluatePage);

        // Check if the occupied height exceeds the allowed height
        if (invoiceOccupiedHeight > invoiceHeight) {
            // Throw an error if the occupied height exceeds the allowed height
            throw new ApiError(
                422,
                'Invoice content exceeds allowed page height',
                [{
                    maxHeight: invoiceHeight,
                    actualHeight: invoiceOccupiedHeight
                }]
            )

        }

        // Calculate the remaining height
        const remainingHeight = invoiceHeight - invoiceOccupiedHeight;

        // Close the browser
        await browser.close();

        /* 
            =========================================
            Pass 2: re-render with correct blank rows
            =========================================
        */
        // Update the remaining height in the sample invoice data
        sampleInvoiceData.emptyRowHeightNeededInPx = remainingHeight;

        // Fill the template again with updated data
        const html = await ejs.renderFile(templatePath, sampleInvoiceData);

        // Launch the browser and open a new blank page
        const browser2 = await puppeteer.launch({
            executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // Path to Chrome
            headless: false,
        });

        // Initialize a new page
        const page2 = await browser2.newPage();

        // Set the content of the page to the filled HTML
        await page2.setContent(html, { waitUntil: 'networkidle0' });

        // Save the PDF to a file
        await page2.pdf({
            format: 'A4',
            path: 'invoice.pdf', // Save to file
            printBackground: true,
            width: `210mm`,
            height: `297mm`,
            margin: { top: '3mm', bottom: '3mm', left: '3mm', right: '3mm' },
        });

        // Close the browser
        await browser2.close();
    } catch (error) {
        throw error instanceof ApiError ? error : new ApiError(500, 'Error generating PDF')
    }
};

// Evaluate page
const evaluatePage = () => {
    // Get total invoice height
    const table = document.querySelector('.table-container');
    const invoiceHeight = table.getBoundingClientRect().height;

    // Get invoice occupied height
    const invoiceOccupiedHeightDiv = document.querySelector('.table-invoice-wrapper');
    const invoiceOccupiedHeight = invoiceOccupiedHeightDiv.getBoundingClientRect().height;

    return {
        invoiceHeight,
        invoiceOccupiedHeight
    }
}

module.exports = { generateInvoicePDF };