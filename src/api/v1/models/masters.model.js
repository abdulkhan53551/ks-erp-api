const { db } = require("../database");
const { ApiError } = require("../services/ApiError");

// Fetch payment statuses
const fetchPaymentStatuses = async () => {
    try {
        const paymentStatus = await db('payment_statuses')
            .select('id', 'code', 'label')
            .where({ is_active: true })
            .orderBy('code', 'asc');

        return paymentStatus;
    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching payment status.',
        });
    }
};

// Fetch payment modes
const fetchPaymentModes = async () => {
    try {
        const paymentMode = await db('payment_modes')
            .select('id', 'code', 'label')
            .where({ is_active: true })
            .orderBy('code', 'asc');

        return paymentMode;
    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching payment modes.',
        });
    }
};

// Fetch GST slabs
const fetchGSTSlabs = async () => {
    try {
        const gstSlab = await db('gst_slabs')
            .select('id', 'gst_rate', 'description', 'cgst_rate', 'sgst_rate', 'igst_rate')
            .where({ is_active: true })
            .orderBy('gst_rate', 'asc');

        return gstSlab;
    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching gst slabs.',
        });
    }
};

// Fetch item units
const fetchProductUnits = async () => {
    try {
        // Note: Maps to `item_units` table in DB
        const productUnit = await db('item_units')
            .select('id', 'uqc', 'description')
            .where({ is_active: true })
            .orderBy('uqc', 'asc');

        return productUnit;
    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching product units.',
        });
    }
};

// Fetch all states
const fetchStates = async () => {
    try {
        const states = await db('state')
            .select('id', 'name')
            .where({ is_active: true })
            .orderBy('name', 'asc');

        return states;
    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching states.',
        });
    }
};

// Fetch cities by state ID
const fetchCities = async (stateId) => {
    try {
        const cities = await db('city')
            .select('id', 'name')
            .where({ state_id: stateId, is_active: true })
            .orderBy('name', 'asc');

        return cities;
    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching cities of given state.',
        });
    }
};

// Fetch all cities
const fetchAllCities = async (stateId) => {
    try {
        const cities = await db('city')
            .select('id', 'name')
            .where({ is_active: true })
            .orderBy('name', 'asc');

        return cities;
    } catch (error) {
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching cities.',
        });
    }
};

module.exports = {
    fetchPaymentStatuses,
    fetchPaymentModes,
    fetchGSTSlabs,
    fetchProductUnits,
    fetchStates,
    fetchCities,
    fetchAllCities
};
