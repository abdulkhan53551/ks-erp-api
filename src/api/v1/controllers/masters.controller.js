const { ApiError } = require('../services/ApiError');
const { asyncHandler } = require("../services/asyncHandler");
const { ApiResponse } = require("../services/ApiResponse");
const { fetchStates, fetchCities, fetchPaymentStatuses, fetchPaymentModes, fetchGSTSlabs } = require("../models/masters.model");

// Fetch all states
const getStates = asyncHandler(async (req, res) => {
    const result = await fetchStates();

    // Check if result is empty
    if (!result || result.length === 0) {
        throw new ApiError({ statusCode: 404, message: 'No states found.' });

    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            message: 'States fetched successfully.',
            data: result,
        })
    );
});

// Fetch all cities by state ID
const getCityByState = asyncHandler(async (req, res) => {
    const { stateId = 1 } = req.query;

    const result = await fetchCities(stateId);

    // Check if result is empty
    if (!result || result.length === 0) {
        throw new ApiError({ statusCode: 404, message: 'No city found.' });

    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            message: 'Cities fetched successfully.',
            data: result,
        })
    );
});

// Fetch all payment statuses
const getPyamentStatuses = asyncHandler(async (req, res) => {
    const result = await fetchPaymentStatuses();

    // Check if result is empty
    if (!result || result.length === 0) {
        throw new ApiError({ statusCode: 404, message: 'No payment statuses found.' });

    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            message: 'Payment statuses fetched successfully.',
            data: result,
        })
    );
});

// Fetch all payment modes
const getPyamentModes = asyncHandler(async (req, res) => {
    const result = await fetchPaymentModes();

    // Check if result is empty
    if (!result || result.length === 0) {
        throw new ApiError({ statusCode: 404, message: 'No payment modes found.' });

    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            message: 'Payment modes fetched successfully.',
            data: result,
        })
    );
});

// Fetch all GST slabs
const getGstSlabs = asyncHandler(async (req, res) => {
    const result = await fetchGSTSlabs();

    // Check if result is empty
    if (!result || result.length === 0) {
        throw new ApiError({ statusCode: 404, message: 'No gst slabs found.' });

    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            message: 'GST slabs fetched successfully.',
            data: result,
        })
    );
});



module.exports = {
    getStates,
    getCityByState,
    getPyamentStatuses,
    getPyamentModes,
    getGstSlabs
};