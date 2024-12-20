const { USER_DPI } = require("../../../config/constants/app");
const { pixelsToMm } = require("../services/conversion");
const { sampleInvoiceData } = require("./sampleInvoiceData");

const paymentMethod = {
    CASH: 'Cash',
    UPI: 'UPI',
    BANK_CHEQUE: 'Bank Cheque',
    BANK_TRANSFER: 'Bank Transfer',
}

const generateInvoicePDF = async (invoiceData, puppeteer) => {
    // sampleInvoiceData
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // Load invoice template or HTML content
    await page.setContent('<html><body><table><tr><td>Invoice Content</td></tr></table></body></html>');

    // Get row heights and convert to mm
    const rowHeightsInMm = await page.evaluate(evaluatePage, USER_DPI);

    // Check invoice item will fit to the invoice item table

    console.log('Row Heights in mm:', rowHeightsInMm);

    // Generate PDF
    await page.pdf({ path: 'invoice.pdf', format: 'A4', printBackground: true });
    await browser.close();
};

// Evaluate page
const evaluatePage = (dpi) => {
    // Get invoice height
    const invoiceHeight = getInvoiceBlockHeight()

    // Get invoice amount paid height
    const invoiceAmountPaidHeight = getInvoiceAmountPaidHeight()

    // Get invoice height
    const { invoiceItemTableHeight, invoiceAmountToWordHeight, invoiceTaxTableHeight } = getInvoiceHeight()

    // Get table row height
    getTableTrHeiht()

    /*
        Note: invoice item & invoice tax section height should be calculated based on the invoice item & invoice tax section height
        - There are 4 invoice item sections and 4 invoice tax sections
        - Each new tax of invoice item section will reflect the height of the invoice tax section
          Ex: 
            1. invoice item have 3 taxes (i.e.: 5%, 12%, 18%) then tax section have 3 rows of taxes (i.e: 5%, 12%, 18%)
            2. invoice item have 5 taxes (i.e.: 5%, 12%, 12%, 18%, 18%) then tax section have 3 rows of taxes (i.e: 5%, 12%, 18%) and so on..
            

    */

    // Get height of invoice item section

    // Get height of amount in words section

    // Get height of invoice tax section

    // Get heigh of amount paid section



    return 1
}

// Get invoice height
const getInvoiceHeight = () => {
    // Get invoice item table height
    const invoiceItemTableHeight = getInvoiceItemTableHeight()

    // Get invoice amount to word height
    const invoiceAmountToWordHeight = getInvoiceAmountToWordHeight()

    // Get invoice tax table height
    const invoiceTaxTableHeight = getInvoiceTaxTableHeight()

    return {
        invoiceItemTableHeight,
        invoiceAmountToWordHeight,
        invoiceTaxTableHeight
    }
}

// Get invoice block height
const getInvoiceBlockHeight = () => {
    const invoice = document.querySelectorAll('div.table-wrapper');
    return getHeightOfHtmlElement(invoice)
}

// Get invoice amount paid height
const getInvoiceAmountPaidHeight = () => {
    const invoice = document.querySelectorAll('div.amount-paid-section');
    return getHeightOfHtmlElement(invoice)
}

// Get invoice item table height
const getInvoiceItemTableHeight = () => {
    const invoice = document.querySelectorAll('table.inv-item-section');
    return getHeightOfHtmlElement(invoice)
}

// Get invoice block height
const getInvoiceItemTableRowHeight = () => {
    const invoice = document.querySelectorAll('div.table-wrapper');
    return getHeightOfHtmlElement(invoice)
}

// Get invoice amount to word height
const getInvoiceAmountToWordHeight = () => {
    const invoice = document.querySelectorAll('div.amount-word');
    return getHeightOfHtmlElement(invoice)
}

// Get invoice tax table height
const getInvoiceTaxTableHeight = () => {
    const invoice = document.querySelectorAll('div.table-wrapper');
    return getHeightOfHtmlElement(invoice)
}

// Get row height
function getTableTrHeiht() {
    const rows = document.querySelectorAll('table.inv-item-section');
    return Array.from(rows).map(getHeightOfHtmlElement);
}

// Get height of html element
const getHeightOfHtmlElement = (ele) => {
    try {
        const rect = ele.getBoundingClientRect();
        return rect.height;   // Conversion formula
    } catch (error) {
        console.log('Unable to get element height => ', error);
    }
}

// Restructure invoice item tax wise
const restructureInvoiceItemTaxWise = (invoiceData = []) => {
    try {
        // Check if invoice data is empty
        if (invoiceData.length > 0) {
            return invoiceData.map(item => {

            })
        }
    } catch (error) {
        console.log('Unable to restructure invoice item tax wise => ', error);
        
    }
}

/*
    Calculation of invoice
*/

// Get total of invoice
const getInvoiceTotal = () => {
    // Get total discount
    const discountedAmount = getTotalDiscount()

    // Get total taxable amount
    const taxableAmount = getTotalTaxableAmount()

    // Get total gst amount
    const {cgst, sgst} = getTotalGstAmount(taxableAmount, taxPercentage)

    // Get total of invoice amount / billing amount
    const invoiceTotalAmount = getInvoiceTotalAmount()
}

module.exports = { generateInvoicePDF };