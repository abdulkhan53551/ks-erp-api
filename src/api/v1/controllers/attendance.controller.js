const { asyncHandler } = require('../services/asyncHandler');
const { ApiError } = require('../services/ApiError');
const { ApiResponse } = require('../services/ApiResponse');
const { getContext } = require('../helpers/requestContext');
const {
    fetchAttendance,
    markSingleAttendance,
    bulkMarkAttendance,
    markDateStatus,
    fetchAttendanceSummary
} = require('../models/attendance.model');

const getEffectiveFirmId = (req) => {
    const context = getContext();
    if (req.query.firmId !== undefined) {
        if (req.query.firmId === 'all' || req.query.firmId === '') return null;
        const parsed = parseInt(req.query.firmId, 10);
        return isNaN(parsed) ? null : parsed;
    }
    return context.firmId || null;
};

const getAttendance = asyncHandler(async (req, res) => {
    const firmId = getEffectiveFirmId(req);

    const records = await fetchAttendance({
        ...req.query,
        firmId
    });

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: records,
            message: 'Attendance records fetched successfully.'
        })
    );
});

const markAttendanceController = asyncHandler(async (req, res) => {
    const context = getContext();
    const firmId = req.body.firmId || req.user?.firmId || context.firmId;

    if (!firmId) {
        throw new ApiError({ statusCode: 400, message: 'Firm ID is required to mark attendance.' });
    }

    const record = await markSingleAttendance({ ...req.body, firmId }, req.user?.id);

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: record,
            message: 'Attendance marked successfully.'
        })
    );
});

const bulkMarkAttendanceController = asyncHandler(async (req, res) => {
    const context = getContext();
    const firmId = req.body.firmId || req.user?.firmId || context.firmId;

    if (!firmId) {
        throw new ApiError({ statusCode: 400, message: 'Firm ID is required for bulk attendance marking.' });
    }

    const { attendanceDate, records } = req.body;
    const result = await bulkMarkAttendance(firmId, attendanceDate, records, req.user?.id);

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: result,
            message: `Attendance marked for ${result.savedCount} employees on ${attendanceDate}.`
        })
    );
});

const markDateStatusController = asyncHandler(async (req, res) => {
    const context = getContext();
    const firmId = req.body.firmId || req.user?.firmId || context.firmId;

    if (!firmId) {
        throw new ApiError({ statusCode: 400, message: 'Firm ID is required.' });
    }

    const { branchId, attendanceDate, status, remarks } = req.body;
    const result = await markDateStatus(firmId, branchId, attendanceDate, status, remarks, req.user?.id);

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: result,
            message: `${result.affectedEmployees} employees marked as ${status} for ${attendanceDate}.`
        })
    );
});

const getAttendanceSummaryController = asyncHandler(async (req, res) => {
    const firmId = getEffectiveFirmId(req);
    const { month, year, branchId } = req.query;

    const summary = await fetchAttendanceSummary({ firmId, month, year, branchId });

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: summary,
            message: 'Attendance summary fetched successfully.'
        })
    );
});

module.exports = {
    getAttendance,
    markAttendanceController,
    bulkMarkAttendanceController,
    markDateStatusController,
    getAttendanceSummaryController
};
