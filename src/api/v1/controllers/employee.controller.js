const { asyncHandler } = require('../services/asyncHandler');
const { ApiError } = require('../services/ApiError');
const { ApiResponse } = require('../services/ApiResponse');
const { getContext } = require('../helpers/requestContext');
const {
    fetchEmployees,
    fetchEmployeesMeta,
    fetchEmployeeById,
    findEmployeeByEmpCode,
    createEmployee,
    updateEmployee,
    softDeleteEmployee,
    restoreEmployee,
    permanentDeleteEmployee,
    fetchEmployeesDropdown,
    fetchNextEmployeeCode
} = require('../models/employee.model');

const getEffectiveFirmId = (req) => {
    const context = getContext();
    if (req.query.firmId !== undefined) {
        if (req.query.firmId === 'all' || req.query.firmId === '') return null;
        const parsed = parseInt(req.query.firmId, 10);
        return isNaN(parsed) ? null : parsed;
    }
    return context.firmId || null;
};

const getEmployees = asyncHandler(async (req, res) => {
    const firmId = getEffectiveFirmId(req);

    const result = await fetchEmployees({
        ...req.query,
        firmId
    });

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: result,
            message: 'Employees fetched successfully.'
        })
    );
});

const getEmployeesMeta = asyncHandler(async (req, res) => {
    const firmId = getEffectiveFirmId(req);
    const branchId = req.query.branchId;

    const meta = await fetchEmployeesMeta({ firmId, branchId });

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: meta,
            message: 'Employee directory metadata fetched successfully.'
        })
    );
});

const getEmployeeDetail = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const employee = await fetchEmployeeById(id);

    if (!employee) {
        throw new ApiError({ statusCode: 404, message: 'Employee not found.' });
    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: employee,
            message: 'Employee details fetched successfully.'
        })
    );
});

const createEmployeeController = asyncHandler(async (req, res) => {
    const context = getContext();
    const firmId = req.body.firmId || req.user?.firmId || context.firmId;

    if (!firmId) {
        throw new ApiError({ statusCode: 400, message: 'Firm ID is required to create an employee.' });
    }

    // Check unique emp_code
    const existing = await findEmployeeByEmpCode(firmId, req.body.empCode);
    if (existing) {
        throw new ApiError({ statusCode: 409, message: `Employee code '${req.body.empCode}' is already in use in this firm.` });
    }

    const { shiftId, ...employeeData } = req.body;
    const employee = await createEmployee({ ...employeeData, firmId }, shiftId);

    return res.status(201).json(
        new ApiResponse({
            statusCode: 201,
            data: employee,
            message: 'Employee created successfully.'
        })
    );
});

const updateEmployeeController = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const existing = await fetchEmployeeById(id);
    if (!existing) {
        throw new ApiError({ statusCode: 404, message: 'Employee not found.' });
    }

    // If empCode changed, check duplicate
    if (req.body.empCode && req.body.empCode !== existing.emp_code) {
        const duplicate = await findEmployeeByEmpCode(existing.firm_id, req.body.empCode, id);
        if (duplicate) {
            throw new ApiError({ statusCode: 409, message: `Employee code '${req.body.empCode}' is already in use in this firm.` });
        }
    }

    const { shiftId, ...employeeData } = req.body;
    const updated = await updateEmployee(id, employeeData, shiftId);

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: updated,
            message: 'Employee updated successfully.'
        })
    );
});

const deleteEmployeeController = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { permanent } = req.query;

    const existing = await fetchEmployeeById(id);
    if (!existing) {
        throw new ApiError({ statusCode: 404, message: 'Employee not found.' });
    }

    if (String(permanent) === 'true') {
        await permanentDeleteEmployee(id);
    } else {
        await softDeleteEmployee(id, req.user?.id);
    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: { id },
            message: String(permanent) === 'true' ? 'Employee permanently deleted.' : 'Employee moved to recycle bin.'
        })
    );
});

const restoreEmployeeController = asyncHandler(async (req, res) => {
    const { id } = req.params;
    await restoreEmployee(id);

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: { id },
            message: 'Employee restored successfully.'
        })
    );
});

const getEmployeesDropdown = asyncHandler(async (req, res) => {
    const firmId = getEffectiveFirmId(req);
    const branchId = req.query.branchId;

    const list = await fetchEmployeesDropdown(firmId, branchId);

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: list,
            message: 'Employee dropdown list fetched successfully.'
        })
    );
});

const getNextEmployeeCodeController = asyncHandler(async (req, res) => {
    const firmId = getEffectiveFirmId(req);
    const nextEmpCode = await fetchNextEmployeeCode(firmId);

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: { nextEmpCode, nextCode: nextEmpCode },
            message: 'Next employee code generated successfully.'
        })
    );
});

module.exports = {
    getEmployees,
    getEmployeesMeta,
    getEmployeeDetail,
    createEmployeeController,
    updateEmployeeController,
    deleteEmployeeController,
    restoreEmployeeController,
    getEmployeesDropdown,
    getNextEmployeeCodeController
};
