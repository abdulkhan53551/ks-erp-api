const path = require('path');
const ejs = require('ejs');
const puppeteer = require('puppeteer');
const { projectPaths } = require('../../../config/constants');
const { getBrowser } = require('./invoice.controller');
const { amountToWords } = require('../services/conversion');
const { asyncHandler } = require('../services/asyncHandler');
const { ApiError } = require('../services/ApiError');
const { ApiResponse } = require('../services/ApiResponse');
const { getContext } = require('../helpers/requestContext');
const {
    fetchPayrollSettings,
    updatePayrollSettings,
    fetchSalaryTemplates,
    fetchSalaryTemplateById,
    createSalaryTemplate,
    updateSalaryTemplate,
    deleteSalaryTemplate,
    fetchSalarySlips,
    fetchSalarySlipById,
    generateMonthlyPayroll,
    approveSalarySlip,
    bulkPaySalarySlips,
    fetchPayrollReport
} = require('../models/payroll.model');

const getEffectiveFirmId = (req) => {
    const context = getContext();
    if (req.query.firmId !== undefined) {
        if (req.query.firmId === 'all' || req.query.firmId === '') return null;
        const parsed = parseInt(req.query.firmId, 10);
        return isNaN(parsed) ? null : parsed;
    }
    return context.firmId || null;
};

// --- Firm Payroll Settings ---
const getPayrollSettingsController = asyncHandler(async (req, res) => {
    const firmId = getEffectiveFirmId(req);

    if (!firmId) {
        throw new ApiError({ statusCode: 400, message: 'Please select a specific firm to configure payroll settings.' });
    }

    const settings = await fetchPayrollSettings(firmId);

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: settings,
            message: 'Firm payroll settings fetched successfully.'
        })
    );
});

const updatePayrollSettingsController = asyncHandler(async (req, res) => {
    const context = getContext();
    const firmId = req.body.firmId || req.user?.firmId || context.firmId;

    if (!firmId) {
        throw new ApiError({ statusCode: 400, message: 'Firm ID is required.' });
    }

    const updated = await updatePayrollSettings(firmId, req.body);

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: updated,
            message: 'Firm payroll settings updated successfully.'
        })
    );
});

// --- Salary Templates ---
const getSalaryTemplatesController = asyncHandler(async (req, res) => {
    const firmId = getEffectiveFirmId(req);

    const templates = await fetchSalaryTemplates(firmId);

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: templates,
            message: 'Salary templates fetched successfully.'
        })
    );
});

const getSalaryTemplateDetail = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const template = await fetchSalaryTemplateById(id);

    if (!template) {
        throw new ApiError({ statusCode: 404, message: 'Salary template not found.' });
    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: template,
            message: 'Salary template details fetched successfully.'
        })
    );
});

const createSalaryTemplateController = asyncHandler(async (req, res) => {
    const context = getContext();
    const firmId = req.body.firmId || req.user?.firmId || context.firmId;

    if (!firmId) {
        throw new ApiError({ statusCode: 400, message: 'Firm ID is required.' });
    }

    const template = await createSalaryTemplate({ ...req.body, firmId });

    return res.status(201).json(
        new ApiResponse({
            statusCode: 201,
            data: template,
            message: 'Salary template created successfully.'
        })
    );
});

const updateSalaryTemplateController = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const existing = await fetchSalaryTemplateById(id);

    if (!existing) {
        throw new ApiError({ statusCode: 404, message: 'Salary template not found.' });
    }

    const updated = await updateSalaryTemplate(id, req.body);

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: updated,
            message: 'Salary template updated successfully.'
        })
    );
});

const deleteSalaryTemplateController = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const existing = await fetchSalaryTemplateById(id);

    if (!existing) {
        throw new ApiError({ statusCode: 404, message: 'Salary template not found.' });
    }

    await deleteSalaryTemplate(id, req.user?.id);

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: { id },
            message: 'Salary template deleted successfully.'
        })
    );
});

// --- Salary Slips & Payroll Run ---
const getSalarySlipsController = asyncHandler(async (req, res) => {
    const firmId = getEffectiveFirmId(req);

    const result = await fetchSalarySlips({ ...req.query, firmId });

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: result,
            message: 'Salary slips fetched successfully.'
        })
    );
});

const getSalarySlipDetail = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const slip = await fetchSalarySlipById(id);

    if (!slip) {
        throw new ApiError({ statusCode: 404, message: 'Salary slip not found.' });
    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: slip,
            message: 'Salary slip details fetched successfully.'
        })
    );
});

const generatePayrollController = asyncHandler(async (req, res) => {
    const context = getContext();
    const firmId = req.body.firmId || req.user?.firmId || context.firmId;
    const { month, year, employeeIds } = req.body;

    if (!firmId) {
        throw new ApiError({ statusCode: 400, message: 'Firm ID is required to generate payroll.' });
    }

    const result = await generateMonthlyPayroll(firmId, month, year, employeeIds, req.user?.id);

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: result,
            message: `Payroll successfully generated for ${result.totalGenerated} employees.`
        })
    );
});

const approveSalarySlipController = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const existing = await fetchSalarySlipById(id);

    if (!existing) {
        throw new ApiError({ statusCode: 404, message: 'Salary slip not found.' });
    }

    const updated = await approveSalarySlip(id, req.user?.id);

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: updated,
            message: 'Salary slip approved successfully.'
        })
    );
});

const bulkPaySlipsController = asyncHandler(async (req, res) => {
    const { slipIds, paymentDate, paymentMode, paymentReference, remarks } = req.body;

    await bulkPaySalarySlips(slipIds, { paymentDate, paymentMode, paymentReference, remarks }, req.user?.id);

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: { count: slipIds.length },
            message: `${slipIds.length} salary slips marked as PAID successfully.`
        })
    );
});

const getPayrollReportController = asyncHandler(async (req, res) => {
    const context = getContext();
    const firmId = req.query.firmId || req.user?.firmId || context.firmId;
    const { month, year } = req.query;

    if (!month || !year) {
        throw new ApiError({ statusCode: 400, message: 'Month and year are required for the payroll report.' });
    }

    const report = await fetchPayrollReport(firmId, month, year);

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: report,
            message: 'Payroll report fetched successfully.'
        })
    );
});

const getSalarySlipPdfController = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const slip = await fetchSalarySlipById(id);

    if (!slip) {
        throw new ApiError({ statusCode: 404, message: 'Salary slip not found.' });
    }

    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthName = `${monthNames[(slip.month || 1) - 1]} ${slip.year}`;

    const netSalaryVal = parseFloat(slip.net_salary || slip.netSalary || 0);
    const netSalaryInWords = amountToWords(netSalaryVal);
    const generatedAt = new Date().toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short'
    });

    const templatePath = path.join(`${projectPaths.ROOT_DIR}/templates/payroll/`, 'salary-slip-template.ejs');
    const filledHtml = await ejs.renderFile(templatePath, {
        slip,
        monthName,
        netSalaryInWords,
        generatedAt
    });

    const browser = await getBrowser(puppeteer);
    let page;

    try {
        page = await browser.newPage();
        await page.setContent(filledHtml, { waitUntil: 'load' });

        const pdf = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '10mm',
                bottom: '10mm',
                left: '10mm',
                right: '10mm'
            }
        });

        const safeEmpCode = (slip.empCode || 'EMP').replace(/[^a-zA-Z0-9_-]/g, '_');
        const fileName = `SalarySlip-${safeEmpCode}-${slip.month}-${slip.year}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        return res.send(Buffer.from(pdf));
    } finally {
        if (page) {
            await page.close().catch(() => {});
        }
    }
});

const {
    generateSalaryMusterExcel,
    generateSalaryMusterPdf
} = require('../services/musterExport.service');

const exportSalaryMusterController = asyncHandler(async (req, res) => {
    const firmId = getEffectiveFirmId(req);
    const { month, year, type = 'full', format = 'xlsx' } = req.query;

    if (!month || !year) {
        throw new ApiError({ statusCode: 400, message: 'Month and year are required to export wage muster.' });
    }

    if (format === 'pdf') {
        const buffer = await generateSalaryMusterPdf({
            firmId,
            month,
            year
        });
        const fileName = `SalaryWageMuster-${month}-${year}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        return res.send(buffer);
    } else {
        const buffer = await generateSalaryMusterExcel({
            firmId,
            month,
            year,
            type
        });

        const prefix = type === 'bank' ? 'BankTransfer-NEFT' : 'SalaryWageMuster';
        const fileName = `${prefix}-${month}-${year}.xlsx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        return res.send(buffer);
    }
});

module.exports = {
    getPayrollSettingsController,
    updatePayrollSettingsController,
    getSalaryTemplatesController,
    getSalaryTemplateDetail,
    createSalaryTemplateController,
    updateSalaryTemplateController,
    deleteSalaryTemplateController,
    getSalarySlipsController,
    getSalarySlipDetail,
    getSalarySlipPdfController,
    generatePayrollController,
    approveSalarySlipController,
    bulkPaySlipsController,
    getPayrollReportController,
    exportSalaryMusterController
};


