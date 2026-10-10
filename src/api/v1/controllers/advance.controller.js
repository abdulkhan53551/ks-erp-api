const { asyncHandler } = require('../services/asyncHandler');
const { ApiError } = require('../services/ApiError');
const { ApiResponse } = require('../services/ApiResponse');
const { getContext } = require('../helpers/requestContext');
const { verifyRecordOwnership } = require('../middlewares/authorize.middleware');
const { db } = require('../database');
const {
    fetchAdvances,
    fetchAdvanceById,
    createAdvance,
    updateAdvance,
    togglePauseAdvance,
    recordManualRepayment,
    fetchEmployeeActiveAdvanceSummary
} = require('../models/advance.model');

const getEffectiveFirmId = (req) => {
    const context = getContext();
    if (req.query?.firmId !== undefined) {
        if (req.query.firmId === 'all' || req.query.firmId === '') return null;
        const parsed = parseInt(req.query.firmId, 10);
        return isNaN(parsed) ? null : parsed;
    }
    return context.firmId || req.user?.firmId || null;
};

/**
 * List all advances with filters and pagination
 */
const getAdvancesController = asyncHandler(async (req, res) => {
    const firmId = getEffectiveFirmId(req);
    const {
        employeeId,
        status,
        search,
        page = 1,
        pageSize = 20,
        sortBy = 'created_at',
        sortOrder = 'desc'
    } = req.query;

    const result = await fetchAdvances({
        firmId,
        employeeId: employeeId ? parseInt(employeeId, 10) : null,
        status,
        search,
        page: parseInt(page, 10),
        pageSize: parseInt(pageSize, 10),
        sortBy,
        sortOrder
    });

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: result,
            message: 'Employee advances fetched successfully.'
        })
    );
});

/**
 * Get detailed advance record with repayments ledger
 */
const getAdvanceDetailController = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const advance = await fetchAdvanceById(id);

    if (!advance) {
        throw new ApiError({ statusCode: 404, message: 'Employee advance record not found.' });
    }

    verifyRecordOwnership(req.user, advance, 'Employee Advance');

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: advance,
            message: 'Advance details fetched successfully.'
        })
    );
});

/**
 * Disburse a new advance to an employee
 */
const createAdvanceController = asyncHandler(async (req, res) => {
    const context = getContext();
    const { employeeId, totalAmount, advanceDate, recoveryType, monthlyDeduction, paymentMode, paymentReference, remarks } = req.body;

    let firmId = req.body.firmId || req.user?.firmId || context.firmId;

    // If firmId not provided in payload, look up from employee record
    if (!firmId) {
        const emp = await db('employees').where({ id: employeeId }).whereNull('deleted_at').first();
        if (emp) {
            firmId = emp.firm_id;
        }
    }

    if (!firmId) {
        throw new ApiError({ statusCode: 400, message: 'Firm context is required to issue an advance.' });
    }

    // Validate employee exists and is active
    const employee = await db('employees')
        .where({ id: employeeId, firm_id: firmId })
        .whereNull('deleted_at')
        .first();

    if (!employee) {
        throw new ApiError({ statusCode: 404, message: 'Employee not found in the selected firm.' });
    }

    if (!employee.is_active) {
        throw new ApiError({ statusCode: 400, message: 'Cannot disburse advance to an inactive employee.' });
    }

    const newAdvance = await createAdvance({
        firmId,
        employeeId,
        totalAmount,
        advanceDate,
        recoveryType,
        monthlyDeduction,
        paymentMode,
        paymentReference,
        remarks
    }, req.user?.id);

    return res.status(201).json(
        new ApiResponse({
            statusCode: 201,
            data: newAdvance,
            message: 'Employee advance disbursed successfully.'
        })
    );
});

/**
 * Update advance terms (EMI amount, recovery type, notes)
 */
const updateAdvanceController = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const existing = await fetchAdvanceById(id);

    if (!existing) {
        throw new ApiError({ statusCode: 404, message: 'Employee advance not found.' });
    }

    verifyRecordOwnership(req.user, existing, 'Employee Advance');

    if (existing.status === 'CLOSED') {
        throw new ApiError({ statusCode: 400, message: 'Cannot modify a closed advance.' });
    }

    const updated = await updateAdvance(id, req.body, req.user?.id);

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: updated,
            message: 'Advance terms updated successfully.'
        })
    );
});

/**
 * Pause or resume advance recovery
 */
const togglePauseController = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { isPaused } = req.body;

    const existing = await fetchAdvanceById(id);
    if (!existing) {
        throw new ApiError({ statusCode: 404, message: 'Employee advance not found.' });
    }

    verifyRecordOwnership(req.user, existing, 'Employee Advance');

    if (existing.status === 'CLOSED') {
        throw new ApiError({ statusCode: 400, message: 'Cannot pause or resume a closed advance.' });
    }

    const updated = await togglePauseAdvance(id, isPaused, req.user?.id);

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: updated,
            message: isPaused
                ? 'Advance recovery paused successfully. No deductions will be made during payroll.'
                : 'Advance recovery resumed successfully.'
        })
    );
});

/**
 * Record a manual cash / bank repayment
 */
const recordRepaymentController = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const existing = await fetchAdvanceById(id);

    if (!existing) {
        throw new ApiError({ statusCode: 404, message: 'Employee advance not found.' });
    }

    verifyRecordOwnership(req.user, existing, 'Employee Advance');

    try {
        const result = await recordManualRepayment(id, req.body, req.user?.id);

        return res.status(200).json(
            new ApiResponse({
                statusCode: 200,
                data: result,
                message: 'Manual repayment recorded successfully.'
            })
        );
    } catch (err) {
        throw new ApiError({ statusCode: 400, message: err.message || 'Failed to record manual repayment.' });
    }
});

/**
 * Summary of active advances for a specific employee
 */
const getEmployeeAdvanceSummaryController = asyncHandler(async (req, res) => {
    const { employeeId } = req.params;
    const firmId = getEffectiveFirmId(req);

    const summary = await fetchEmployeeActiveAdvanceSummary(employeeId, firmId);

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: summary,
            message: 'Employee active advance summary fetched successfully.'
        })
    );
});

module.exports = {
    getAdvancesController,
    getAdvanceDetailController,
    createAdvanceController,
    updateAdvanceController,
    togglePauseController,
    recordRepaymentController,
    getEmployeeAdvanceSummaryController
};
