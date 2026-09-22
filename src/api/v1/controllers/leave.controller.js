const { asyncHandler } = require('../services/asyncHandler');
const { ApiError } = require('../services/ApiError');
const { ApiResponse } = require('../services/ApiResponse');
const { getContext } = require('../helpers/requestContext');
const {
    fetchLeaves,
    fetchLeaveById,
    applyLeave,
    reviewLeave,
    cancelLeave
} = require('../models/leave.model');

const getLeaves = asyncHandler(async (req, res) => {
    const context = getContext();
    const firmId = req.query.firmId || req.user?.firmId || context.firmId;

    const result = await fetchLeaves({
        ...req.query,
        firmId
    });

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: result,
            message: 'Leaves fetched successfully.'
        })
    );
});

const getLeaveDetail = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const leave = await fetchLeaveById(id);

    if (!leave) {
        throw new ApiError({ statusCode: 404, message: 'Leave record not found.' });
    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: leave,
            message: 'Leave details fetched successfully.'
        })
    );
});

const applyLeaveController = asyncHandler(async (req, res) => {
    const context = getContext();
    const firmId = req.body.firmId || req.user?.firmId || context.firmId;

    if (!firmId) {
        throw new ApiError({ statusCode: 400, message: 'Firm ID is required to apply for leave.' });
    }

    const leave = await applyLeave({ ...req.body, firmId });

    return res.status(201).json(
        new ApiResponse({
            statusCode: 201,
            data: leave,
            message: 'Leave application submitted successfully.'
        })
    );
});

const reviewLeaveController = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;

    const existing = await fetchLeaveById(id);
    if (!existing) {
        throw new ApiError({ statusCode: 404, message: 'Leave record not found.' });
    }

    if (existing.status !== 'PENDING') {
        throw new ApiError({ statusCode: 400, message: `Leave is already ${existing.status.toLowerCase()}.` });
    }

    const updated = await reviewLeave(id, status, rejectionReason, req.user?.id);

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: updated,
            message: `Leave application ${status.toLowerCase()} successfully.`
        })
    );
});

const cancelLeaveController = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const existing = await fetchLeaveById(id);

    if (!existing) {
        throw new ApiError({ statusCode: 404, message: 'Leave record not found.' });
    }

    await cancelLeave(id, req.user?.id);

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: { id },
            message: 'Leave application cancelled.'
        })
    );
});

module.exports = {
    getLeaves,
    getLeaveDetail,
    applyLeaveController,
    reviewLeaveController,
    cancelLeaveController
};
