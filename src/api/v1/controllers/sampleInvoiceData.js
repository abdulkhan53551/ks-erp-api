const invoiceData = {
    id: 1,
    customerName: 'John Doe',
    items: [
        {
            id: 1,
            name: 'Colgate 200 gm', 
            hsnAndSacCode: '33061020', 
            taxPercentage: '18', 
            qty: '5', 
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
    total: [
        { name: 'Total', qty: '22.000', totalAmount: '2563.00' },
    ],
    taxDetail: {
        items: [
            {
                taxableValue: '322.03',
                centralTaxPercentage: '9',
                centralTaxAmount: '28.98',
                stateTaxPercentage: '9',
                stateTaxAmount: '28.98',
                totalTaxAmount: '57.97'
            },
            {
                taxableValue: '252.54',
                centralTaxPercentage: '9',
                centralTaxAmount: '22.73',
                stateTaxPercentage: '9',
                stateTaxAmount: '22.73',
                totalTaxAmount: '45.46'
            },
            {
                taxableValue: '330.51',
                centralTaxPercentage: '9',
                centralTaxAmount: '29.75',
                stateTaxPercentage: '9',
                stateTaxAmount: '29.75',
                totalTaxAmount: '59.49'
            },
            {
                taxableValue: '1266.95',
                centralTaxPercentage: '9',
                centralTaxAmount: '114.03',
                stateTaxPercentage: '9',
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
    }
};

module.exports = {
    sampleInvoiceData: invoiceData,
}