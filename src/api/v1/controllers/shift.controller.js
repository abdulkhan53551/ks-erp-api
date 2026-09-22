const { asyncHandler } = require('../services/asyncHandler');
const { ApiError } = require('../services/ApiError');
const { ApiResponse } = require('../services/ApiResponse');
const { getContext } = require('../helpers/requestContext');
const {
    fetchShifts,
    fetchShiftById,
    findShiftByCode,
    createShift,
    updateShift,
    deleteShift,
    assignShiftToEmployees,
    fetchShiftAssignments
} = require('../models/shift.model');

const getShifts = asyncHandler(async (req, res) => {
    const context = getContext();
    const firmId = req.query.firmId || req.user?.firmId || context.firmId;
    const { search } = req.query;

    const shifts = await fetchShifts(firmId, search);

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: shifts,
            message: 'Shifts fetched successfully.'
        })
    );
});

const getShiftDetail = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const shift = await fetchShiftById(id);

    if (!shift) {
        throw new ApiError({ statusCode: 404, message: 'Shift not found.' });
    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: shift,
            message: 'Shift fetched successfully.'
        })
    );
});

const createShiftController = asyncHandler(async (req, res) => {
    const context = getContext();
    const firmId = req.body.firmId || req.user?.firmId || context.firmId;

    if (!firmId) {
        throw new ApiError({ statusCode: 400, message: 'Firm ID is required to create a shift.' });
    }

    const existing = await findShiftByCode(firmId, req.body.shiftCode);
    if (existing) {
        throw new ApiError({ statusCode: 409, message: `Shift code '${req.body.shiftCode}' is already in use in this firm.` });
    }

    const shift = await createShift({ ...req.body, firmId });

    return res.status(201).json(
        new ApiResponse({
            statusCode: 201,
            data: shift,
            message: 'Shift created successfully.'
        })
    );
});

const updateShiftController = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const existing = await fetchShiftById(id);
    if (!existing) {
        throw new ApiError({ statusCode: 404, message: 'Shift not found.' });
    }

    if (req.body.shiftCode && req.body.shiftCode !== existing.shift_code) {
        const duplicate = await findShiftByCode(existing.firm_id, req.body.shiftCode, id);
        if (duplicate) {
            throw new ApiError({ statusCode: 409, message: `Shift code '${req.body.shiftCode}' is already in use in this firm.` });
        }
    }

    const updated = await updateShift(id, req.body);

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: updated,
            message: 'Shift updated successfully.'
        })
    );
});

const deleteShiftController = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const existing = await fetchShiftById(id);
    if (!existing) {
        throw new ApiError({ statusCode: 404, message: 'Shift not found.' });
    }

    await deleteShift(id, req.user?.id);

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: { id },
            message: 'Shift deleted successfully.'
        })
    );
});

const assignShiftController = asyncHandler(async (req, res) => {
    const { shiftId, employeeIds, effectiveFrom, effectiveTo } = req.body;

    const shift = await fetchShiftById(shiftId);
    if (!shift) {
        throw new ApiError({ statusCode: 404, message: 'Shift not found.' });
    }

    const result = await assignShiftToEmployees(shiftId, employeeIds, effectiveFrom, effectiveTo, req.user?.id);

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: result,
            message: `Shift assigned to ${result.assignedCount} employees successfully.`
        })
    );
});

const getShiftAssignmentsController = asyncHandler(async (req, res) => {
    const context = getContext();
    const firmId = req.query.firmId || req.user?.firmId || context.firmId;
    const { shiftId, employeeId } = req.query;

    const assignments = await fetchShiftAssignments({ firmId, shiftId, employeeId });

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: assignments,
            message: 'Shift assignments fetched successfully.'
        })
    );
});

module.exports = {
    getShifts,
    getShiftDetail,
    createShiftController,
    updateShiftController,
    deleteShiftController,
    assignShiftController,
    getShiftAssignmentsController
};
