const { ToWords } = require("to-words");
const { USER_DPI } = require("../../../config/constants/app");
const { default: Decimal } = require("decimal.js");

const pixelsToMm = (pixels, dpi = USER_DPI) => {
    return (pixels / dpi) * 25.4;
};

// Convert number into words
const amountToWords = (num = 0, options = {}) => {
    // Sanitize the number
    const number = isNaN(Number(num)) ? 0 : Number(num);

    // Configuration of the library. To convert numbers to words
    const toWords = new ToWords({
        localeCode: 'en-IN',
        converterOptions: {
            currency: true,
            ignoreDecimal: false,
            ignoreZeroCurrency: false,
            doNotAddOnly: false,
            currencyOptions: {
                // can be used to override defaults for the selected locale
                name: 'Rupee',
                plural: 'Rupees',
                symbol: '₹',
                fractionalUnit: {
                    name: 'Paisa',
                    plural: 'Paise',
                    symbol: '',
                },
            },
            ...options
        },
    });

    // Return the number in words
    return toWords.convert(number);
}

// Format amount to Indian currency format
const formatAmount = (amount, config = {}) => {
    const { showSymbol } = config
    const dec = new Decimal(amount ?? 0);
    let currencyConfig = {}

    // Append cofig of currency symbol
    if (showSymbol) {
        currencyConfig = {
            style: 'currency',
            currency: 'INR',
        }
    }

    return new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: 2,
        ...currencyConfig
    }).format(dec.toNumber());
};

// Convert to camel case
const toCamelCase = (obj) => {
    if (Array.isArray(obj)) {
        return obj.map(v => toCamelCase(v));
    } else if (obj !== null && obj.constructor === Object) {
        return Object.keys(obj).reduce((result, key) => {
            const camelKey = key.replace(/_([a-z])/g, (_, g) => g.toUpperCase());
            result[camelKey] = toCamelCase(obj[key]);
            return result;
        }, {});
    }
    return obj;
}

module.exports = {
    pixelsToMm,
    amountToWords,
    formatAmount,
    toCamelCase
};