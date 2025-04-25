const invoiceData = {
    id: 1,
    customerName: 'John Doe',
    company: {
        logo: 'https://www.unilever.com/Images/unilever-logo_tcm244-500123_w600.png',
        name: 'Hindustan Uniliver Test',
        gstNo: '27ABCDE1234F1Z5',
        address: '64, Whilefield Main Rd, Palm Meadows, White field <br> Bengaluru KARNATAKA, 560066',
        mobile: '+91 99800 12345',
        email: 'info@unilever.com'
    },
    customer: {
        name: 'Hein Schumacher',
        gstNo: '27ABCDE1234F1Z5',
        billingAddress: 'Marathahalli - Sarjapur Outer Ring Road, Kadabeesanahalli, <br> Bengaluru, Karnataka, 560087',
        shippingAddress: 'Marathahalli - Sarjapur Outer Ring Road, Kadabeesanahalli test, <br> Bengaluru, Karnataka, 560087',
        mobile: '9890241776',
        email: 'hein.schumacher@unilever.com'
    },
    invoiceDetails: {
        invoiceNo: "INV-11",
        invoiceDate: "15 JUN 2023",
        placeOfSupply: "29-KARNATAKA",
        dueDate: "15 JUN 2023",
        challanNo: "01, 02, 03, 04, 05",
        challanDate: "15 JUN 2023",
        poNumber: "PO123456",
        poDate: "20 JUN 2023",
        ewayBillNo: "PO123456",
        modeOfPayment: "CASH / ONLINE"
    },
    items: [
        {
            id: 1,
            name: 'Colgate 200 gm',
            hsnAndSacCode: '33061020',
            taxPercentage: '18',
            qty: '5 NOS',
            unit: 'NOS',
            price: '64.41',
            totalAmount: '322.03'
        },
        {
            id: 2,
            name: 'Surf Excel Easy Wash Detergent Powder 1kg',
            hsnAndSacCode: '340119',
            taxPercentage: '18',
            qty: '2',
            unit: 'NOS',
            price: '126.27',
            totalAmount: '252.54'
        },
        {
            id: 3,
            name: 'Dove Soap',
            hsnAndSacCode: '34011919',
            taxPercentage: '18',
            qty: '10',
            unit: 'NOS',
            price: '33.05',
            totalAmount: '330.51'
        },
        {
            id: 4,
            name: 'Head & Shoulders Shampoo',
            hsnAndSacCode: '3304',
            taxPercentage: '18',
            qty: '5',
            unit: 'NOS',
            price: '253.39',
            totalAmount: '1266.95'
        },
    ],
    subTotal: [
        { name: 'Discount 2.0%', totalAmount: '2172.03' },
        { name: 'Taxable Amount', totalAmount: '2172.03' },
        { name: 'CGST', totalAmount: '195.49' },
        { name: 'SGST', totalAmount: '195.49' },
    ],
    total: {
        qty: '22.000',
        totalAmount: '₹2,563.00',
        totalAmountInWords: 'Two Thousand, Five Hundred and Sixty Three Rupees Only.'
    },
    taxDetail: {
        items: [
            {
                taxableValue: '322.03',
                centralTaxPercentage: '9%',
                centralTaxAmount: '28.98',
                stateTaxPercentage: '9%',
                stateTaxAmount: '28.98',
                totalTaxAmount: '57.97'
            },
            {
                taxableValue: '252.54',
                centralTaxPercentage: '9%',
                centralTaxAmount: '22.73',
                stateTaxPercentage: '9%',
                stateTaxAmount: '22.73',
                totalTaxAmount: '45.46'
            },
            {
                taxableValue: '330.51',
                centralTaxPercentage: '9%',
                centralTaxAmount: '29.75',
                stateTaxPercentage: '9%',
                stateTaxAmount: '29.75',
                totalTaxAmount: '59.49'
            },
            {
                taxableValue: '1266.95',
                centralTaxPercentage: '9%',
                centralTaxAmount: '114.03',
                stateTaxPercentage: '9%',
                stateTaxAmount: '114.03',
                totalTaxAmount: '228.05'
            },
        ],
        total: {
            taxableValue: '2172.03',
            centralTaxAmount: '195.49',
            stateTaxAmount: '195.49',
            totalTaxAmount: '390.97'
        }
    },
    bank: {
        bankName: 'YES BANK',
        accountNumber: '66789999222445',
        ifscCode: 'YESBBIN4567',
        branch: 'Kodihalli'
    },
    termsAndConditions: [
        '1. Goolds once sold cannot be taken back or exchanged.',
        '2. We are not the manufacturers, company will stand for warranty as per their terms and conditions.',
        '3. Interest @24% p.a. will be charged for uncleared bill beyond 15 days.',
        '4. Subject to local jurisdiction.'
    ],
    emptyRowNeeded: 0,
    emptyRowHeightNeededInPx: 0,
};

module.exports = {
    sampleInvoiceData: invoiceData,
}