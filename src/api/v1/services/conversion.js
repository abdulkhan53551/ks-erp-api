const { ToWords } = require("to-words");
const { USER_DPI } = require("../../../config/constants/app");

const pixelsToMm = (pixels, dpi = USER_DPI) => {
    return (pixels / dpi) * 25.4;
};

// Convert number into words
const convertToWords = (num = 0, options = {}) => {
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

module.exports = {
    pixelsToMm,
    convertToWords
};