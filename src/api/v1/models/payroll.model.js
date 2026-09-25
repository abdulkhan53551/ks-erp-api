const { db } = require('../database');

/**
 * Fetch firm payroll settings (or create default if none exists)
 */
const fetchPayrollSettings = async (firmId) => {
    let settings = await db('firm_payroll_settings')
        .where({ firm_id: firmId })
        .whereNull('deleted_at')
        .first();

    if (!settings) {
        const [newSettings] = await db('firm_payroll_settings')
            .insert({
                firm_id: firmId,
                working_days_per_month: 26,
                weekly_off_day: 'SUNDAY',
                ot_rate_type: 'FIXED',
                ot_hourly_rate: 0,
                ot_multiplier_normal: 1.5,
                ot_multiplier_holiday: 2.0,
                ot_multiplier_weekend: 2.0,
                pf_enabled: false,
                pf_employer_percent: 12.00,
                pf_employee_percent: 12.00,
                pf_wage_ceiling: 15000.00,
                esi_enabled: false,
                esi_employer_percent: 3.25,
                esi_employee_percent: 0.75,
                esi_wage_ceiling: 21000.00,
                pt_enabled: false,
                pt_monthly_amount: 200.00
            })
            .returning('*');
        settings = newSettings;
    }

    return settings;
};

/**
 * Update firm payroll settings
 */
const updatePayrollSettings = async (firmId, data) => {
    const payload = {
        working_days_per_month: data.workingDaysPerMonth,
        weekly_off_day: data.weeklyOffDay,
        ot_rate_type: data.otRateType,
        ot_hourly_rate: data.otHourlyRate,
        ot_multiplier_normal: data.otMultiplierNormal,
        ot_multiplier_holiday: data.otMultiplierHoliday,
        ot_multiplier_weekend: data.otMultiplierWeekend,
        pf_enabled: data.pfEnabled,
        pf_employer_percent: data.pfEmployerPercent,
        pf_employee_percent: data.pfEmployeePercent,
        pf_wage_ceiling: data.pfWageCeiling,
        esi_enabled: data.esiEnabled,
        esi_employer_percent: data.esiEmployerPercent,
        esi_employee_percent: data.esiEmployeePercent,
        esi_wage_ceiling: data.esiWageCeiling,
        pt_enabled: data.ptEnabled,
        pt_monthly_amount: data.ptMonthlyAmount,
        updated_at: new Date()
    };

    const existing = await db('firm_payroll_settings').where({ firm_id: firmId }).first();
    if (existing) {
        const [updated] = await db('firm_payroll_settings')
            .where({ firm_id: firmId })
            .update(payload)
            .returning('*');
        return updated;
    } else {
        const [created] = await db('firm_payroll_settings')
            .insert({ firm_id: firmId, ...payload })
            .returning('*');
        return created;
    }
};

/**
 * Fetch salary templates with components for a firm
 */
const fetchSalaryTemplates = async (firmId) => {
    let query = db('salary_templates')
        .whereNull('deleted_at')
        .where('is_active', true)
        .orderBy('is_default', 'desc')
        .orderBy('template_name', 'asc');

    if (firmId && firmId !== 'all') {
        query = query.where('firm_id', firmId);
    }

    const templates = await query;
    const templateIds = templates.map(t => t.id);

    const components = templateIds.length > 0
        ? await db('salary_template_components')
            .whereIn('template_id', templateIds)
            .whereNull('deleted_at')
            .where('is_active', true)
            .orderBy('sort_order', 'asc')
        : [];

    return templates.map(t => ({
        ...t,
        components: components.filter(c => c.template_id === t.id)
    }));
};

/**
 * Fetch single salary template by ID with components
 */
const fetchSalaryTemplateById = async (id) => {
    const template = await db('salary_templates')
        .where({ id })
        .whereNull('deleted_at')
        .first();

    if (!template) return null;

    const components = await db('salary_template_components')
        .where({ template_id: id })
        .whereNull('deleted_at')
        .where('is_active', true)
        .orderBy('sort_order', 'asc');

    return {
        ...template,
        components
    };
};

/**
 * Create salary template with components
 */
const createSalaryTemplate = async (data) => {
    return db.transaction(async (trx) => {
        if (data.isDefault) {
            await trx('salary_templates')
                .where({ firm_id: data.firmId })
                .update({ is_default: false });
        }

        const [template] = await trx('salary_templates')
            .insert({
                firm_id: data.firmId,
                template_name: data.templateName,
                template_type: data.templateType || 'MONTHLY',
                description: data.description || null,
                is_default: Boolean(data.isDefault)
            })
            .returning('*');

        if (Array.isArray(data.components) && data.components.length > 0) {
            const compRows = data.components.map((c, idx) => ({
                template_id: template.id,
                component_name: c.componentName,
                component_type: c.componentType,
                calc_type: c.calcType,
                value: c.value,
                is_statutory: Boolean(c.isStatutory),
                sort_order: c.sortOrder !== undefined ? c.sortOrder : idx
            }));

            await trx('salary_template_components').insert(compRows);
        }

        return fetchSalaryTemplateById(template.id);
    });
};

/**
 * Update salary template with components
 */
const updateSalaryTemplate = async (id, data) => {
    return db.transaction(async (trx) => {
        const updatePayload = {};
        if (data.templateName !== undefined) updatePayload.template_name = data.templateName;
        if (data.templateType !== undefined) updatePayload.template_type = data.templateType;
        if (data.description !== undefined) updatePayload.description = data.description;

        if (data.isDefault !== undefined) {
            updatePayload.is_default = Boolean(data.isDefault);
            if (data.isDefault) {
                const current = await trx('salary_templates').where({ id }).first();
                if (current) {
                    await trx('salary_templates')
                        .where({ firm_id: current.firm_id })
                        .whereNot({ id })
                        .update({ is_default: false });
                }
            }
        }

        await trx('salary_templates').where({ id }).update(updatePayload);

        if (Array.isArray(data.components)) {
            // Delete old components
            await trx('salary_template_components').where({ template_id: id }).del();

            if (data.components.length > 0) {
                const compRows = data.components.map((c, idx) => ({
                    template_id: id,
                    component_name: c.componentName,
                    component_type: c.componentType,
                    calc_type: c.calcType,
                    value: c.value,
                    is_statutory: Boolean(c.isStatutory),
                    sort_order: c.sortOrder !== undefined ? c.sortOrder : idx
                }));
                await trx('salary_template_components').insert(compRows);
            }
        }

        return fetchSalaryTemplateById(id);
    });
};

/**
 * Delete salary template
 */
const deleteSalaryTemplate = async (id, userId) => {
    return db('salary_templates')
        .where({ id })
        .update({
            is_active: false,
            deleted_at: new Date(),
            deleted_by: userId || null
        });
};

/**
 * Fetch salary slips with pagination and filtering
 */
const fetchSalarySlips = async (filters = {}) => {
    const {
        page = 1,
        pageSize = 20,
        firmId,
        month,
        year,
        status,
        employeeId,
        search
    } = filters;

    const offset = (page - 1) * pageSize;

    let query = db('employee_salary_slips as ess')
        .join('employees as e', 'ess.employee_id', 'e.id')
        .join('firms as f', 'ess.firm_id', 'f.id')
        .leftJoin('users as ug', 'ess.generated_by', 'ug.id')
        .leftJoin('users as ua', 'ess.approved_by', 'ua.id')
        .whereNull('ess.deleted_at')
        .where('ess.is_active', true);

    if (firmId && firmId !== 'all') {
        query = query.where('ess.firm_id', firmId);
    }
    if (month) {
        query = query.where('ess.month', month);
    }
    if (year) {
        query = query.where('ess.year', year);
    }
    if (status && status !== 'ALL') {
        query = query.where('ess.status', status);
    }
    if (employeeId) {
        query = query.where('ess.employee_id', employeeId);
    }
    if (search && search.trim() !== '') {
        const term = `%${search.trim()}%`;
        query = query.where(b => {
            b.whereILike('e.emp_code', term)
                .orWhereILike('e.first_name', term)
                .orWhereILike('e.last_name', term);
        });
    }

    const countResult = await query.clone().count('ess.id as total').first();
    const total = parseInt(countResult?.total || 0, 10);

    const slips = await query
        .select(
            'ess.id',
            'ess.employee_id as employeeId',
            'e.emp_code as empCode',
            'e.first_name as firstName',
            'e.last_name as lastName',
            'e.department',
            'e.designation',
            'e.employment_type as employmentType',
            'e.salary_type as salaryType',
            'e.base_salary as baseSalary',
            'ess.firm_id as firmId',
            'f.firm_name as firmName',
            'ess.month',
            'ess.year',
            'ess.total_working_days as totalWorkingDays',
            'ess.present_days as presentDays',
            'ess.absent_days as absentDays',
            'ess.half_days as halfDays',
            'ess.paid_leave_days as paidLeaveDays',
            'ess.overtime_hours as overtimeHours',
            'ess.gross_earnings as grossEarnings',
            'ess.total_deductions as totalDeductions',
            'ess.overtime_pay as overtimePay',
            'ess.net_salary as netSalary',
            'ess.status',
            'ess.payment_date as paymentDate',
            'ess.payment_mode as paymentMode',
            'ess.payment_reference as paymentReference',
            'ug.user_name as generatedByUserName',
            'ua.user_name as approvedByUserName',
            'ess.approved_at as approvedAt',
            'ess.created_at as createdAt'
        )
        .orderBy('ess.id', 'desc')
        .limit(pageSize)
        .offset(offset);

    return {
        slips,
        pagination: {
            page: parseInt(page, 10),
            pageSize: parseInt(pageSize, 10),
            total,
            totalPages: Math.ceil(total / pageSize)
        }
    };
};

/**
 * Fetch single salary slip by ID with full details & company letterhead
 */
const fetchSalarySlipById = async (id) => {
    const slip = await db('employee_salary_slips as ess')
        .join('employees as e', 'ess.employee_id', 'e.id')
        .join('firms as f', 'ess.firm_id', 'f.id')
        .leftJoin('firm_branches as fb', 'e.branch_id', 'fb.id')
        .leftJoin('users as ug', 'ess.generated_by', 'ug.id')
        .leftJoin('users as ua', 'ess.approved_by', 'ua.id')
        .where('ess.id', id)
        .whereNull('ess.deleted_at')
        .select(
            'ess.*',
            'e.emp_code as empCode',
            'e.first_name as firstName',
            'e.last_name as lastName',
            'e.department',
            'e.designation',
            'e.employment_type as employmentType',
            'e.salary_type as salaryType',
            'e.base_salary as employeeBaseSalary',
            'e.date_of_joining as dateOfJoining',
            'e.bank_name as bankName',
            'e.account_number as accountNumber',
            'e.ifsc_code as ifscCode',
            'e.pan_number as panNumber',
            'e.aadhar_number as aadharNumber',
            'e.uan_number as uanNumber',
            'e.esi_number as esiNumber',
            'f.firm_name as firmName',
            'f.trade_name as tradeName',
            'f.gstin as firmGstin',
            'fb.email as firmEmail',
            'fb.phone as firmPhone',
            'fb.branch_name as branchName',
            'ug.user_name as generatedByUserName',
            'ua.user_name as approvedByUserName'
        )
        .first();

    if (!slip) return null;

    const details = await db('salary_slip_details')
        .where({ salary_slip_id: id })
        .whereNull('deleted_at')
        .orderBy('sort_order', 'asc');

    const earnings = details.filter(d => d.component_type === 'EARNING');
    const deductions = details.filter(d => d.component_type === 'DEDUCTION');

    return {
        ...slip,
        earnings,
        deductions,
        details
    };
};

/**
 * ⭐ PAYROLL GENERATION ENGINE
 * Computes monthly salary slips for all active employees of a firm based on attendance & rules
 */
const generateMonthlyPayroll = async (firmId, month, year, employeeIds = null, generatedBy = null) => {
    return db.transaction(async (trx) => {
        // 1. Fetch firm payroll settings
        let settings = await trx('firm_payroll_settings').where({ firm_id: firmId }).first();
        if (!settings) {
            const [newSettings] = await trx('firm_payroll_settings').insert({
                firm_id: firmId,
                working_days_per_month: 26,
                ot_rate_type: 'FIXED',
                ot_hourly_rate: 0,
                ot_multiplier_normal: 1.5
            }).returning('*');
            settings = newSettings;
        }

        const workingDaysPerMonth = settings.working_days_per_month || 26;

        // 2. Fetch employees to process
        let empQuery = trx('employees as e')
            .leftJoin('salary_templates as st', 'e.salary_template_id', 'st.id')
            .where('e.firm_id', firmId)
            .where('e.is_active', true)
            .where('e.status', 'ACTIVE')
            .whereNull('e.deleted_at')
            .select('e.*', 'st.id as templateId', 'st.template_name as templateName');

        if (Array.isArray(employeeIds) && employeeIds.length > 0) {
            empQuery = empQuery.whereIn('e.id', employeeIds);
        }

        const employees = await empQuery;
        const generatedSlips = [];

        for (const emp of employees) {
            // 3. Pull attendance for this month & year
            const attendanceRecords = await trx('employee_attendance')
                .where({ employee_id: emp.id, firm_id: firmId })
                .whereNull('deleted_at')
                .where('is_active', true)
                .whereRaw('EXTRACT(MONTH FROM attendance_date) = ?', [month])
                .whereRaw('EXTRACT(YEAR FROM attendance_date) = ?', [year]);

            let presentDays = 0;
            let absentDays = 0;
            let halfDays = 0;
            let leaveDays = 0;
            let holidayDays = 0;
            let weeklyOffDays = 0;
            let totalOTHours = 0;
            let totalHoursWorked = 0;

            for (const att of attendanceRecords) {
                if (att.status === 'PRESENT') presentDays++;
                else if (att.status === 'ABSENT') absentDays++;
                else if (att.status === 'HALF_DAY') halfDays++;
                else if (att.status === 'LEAVE') leaveDays++;
                else if (att.status === 'HOLIDAY') holidayDays++;
                else if (att.status === 'WEEKLY_OFF') weeklyOffDays++;

                totalOTHours += parseFloat(att.overtime_hours || 0);
                totalHoursWorked += parseFloat(att.total_hours || 0);
            }

            // Effective payable days
            const payableDays = presentDays + (halfDays * 0.5) + leaveDays + holidayDays + weeklyOffDays;

            // 4. Base Pay Calculation
            const baseSalary = parseFloat(emp.base_salary || 0);
            let baseEarnings = 0;

            if (emp.salary_type === 'MONTHLY') {
                const perDayRate = workingDaysPerMonth > 0 ? (baseSalary / workingDaysPerMonth) : 0;
                baseEarnings = Math.round(perDayRate * payableDays * 100) / 100;
            } else if (emp.salary_type === 'DAILY') {
                baseEarnings = Math.round(baseSalary * payableDays * 100) / 100;
            } else if (emp.salary_type === 'HOURLY') {
                baseEarnings = Math.round(baseSalary * totalHoursWorked * 100) / 100;
            }

            // 5. Overtime Pay Calculation
            let overtimePay = 0;
            if (totalOTHours > 0) {
                if (settings.ot_rate_type === 'FIXED') {
                    overtimePay = Math.round(totalOTHours * parseFloat(settings.ot_hourly_rate || 0) * 100) / 100;
                } else {
                    // Multiplier based on hourly rate
                    const hourlyRate = (workingDaysPerMonth * 8) > 0 ? (baseSalary / (workingDaysPerMonth * 8)) : 0;
                    overtimePay = Math.round(totalOTHours * hourlyRate * parseFloat(settings.ot_multiplier_normal || 1.5) * 100) / 100;
                }
            }

            // 6. Salary Components Breakdown
            const slipComponents = [];
            let totalDeductions = 0;
            let grossEarnings = baseEarnings;

            // Check if template assigned
            if (emp.salary_template_id) {
                const templateComponents = await trx('salary_template_components')
                    .where({ template_id: emp.salary_template_id, is_active: true })
                    .whereNull('deleted_at')
                    .orderBy('sort_order', 'asc');

                let basicAmount = baseEarnings;

                for (const comp of templateComponents) {
                    // Rule: Only PERMANENT employees get statutory deductions (PF/ESI/PT)
                    if (comp.is_statutory && emp.employment_type !== 'PERMANENT') {
                        continue; // Skip statutory for daily wage / contract
                    }

                    let amount = 0;
                    if (comp.calc_type === 'FIXED') {
                        amount = parseFloat(comp.value);
                    } else if (comp.calc_type === 'PERCENT_OF_BASIC') {
                        amount = Math.round(basicAmount * (parseFloat(comp.value) / 100) * 100) / 100;
                    } else if (comp.calc_type === 'PERCENT_OF_GROSS') {
                        amount = Math.round(baseEarnings * (parseFloat(comp.value) / 100) * 100) / 100;
                    }

                    if (comp.component_name.toLowerCase().includes('basic')) {
                        basicAmount = amount;
                    }

                    if (comp.component_type === 'EARNING') {
                        grossEarnings += amount;
                        slipComponents.push({
                            component_name: comp.component_name,
                            component_type: 'EARNING',
                            amount,
                            sort_order: comp.sort_order
                        });
                    } else if (comp.component_type === 'DEDUCTION') {
                        totalDeductions += amount;
                        slipComponents.push({
                            component_name: comp.component_name,
                            component_type: 'DEDUCTION',
                            amount,
                            sort_order: comp.sort_order
                        });
                    }
                }
            } else {
                // Default breakdown: Basic Pay = baseEarnings
                slipComponents.push({
                    component_name: 'Basic Pay',
                    component_type: 'EARNING',
                    amount: baseEarnings,
                    sort_order: 1
                });

                // Apply firm-level statutory settings for permanent employees
                if (emp.employment_type === 'PERMANENT') {
                    if (settings.pf_enabled) {
                        const pfEligible = Math.min(baseEarnings, parseFloat(settings.pf_wage_ceiling || 15000));
                        const pfAmount = Math.round(pfEligible * (parseFloat(settings.pf_employee_percent || 12) / 100) * 100) / 100;
                        totalDeductions += pfAmount;
                        slipComponents.push({
                            component_name: 'Provident Fund (PF)',
                            component_type: 'DEDUCTION',
                            amount: pfAmount,
                            sort_order: 10
                        });
                    }

                    if (settings.esi_enabled && baseEarnings <= parseFloat(settings.esi_wage_ceiling || 21000)) {
                        const esiAmount = Math.round(baseEarnings * (parseFloat(settings.esi_employee_percent || 0.75) / 100) * 100) / 100;
                        totalDeductions += esiAmount;
                        slipComponents.push({
                            component_name: 'ESI',
                            component_type: 'DEDUCTION',
                            amount: esiAmount,
                            sort_order: 11
                        });
                    }

                    if (settings.pt_enabled) {
                        const ptAmount = parseFloat(settings.pt_monthly_amount || 200);
                        totalDeductions += ptAmount;
                        slipComponents.push({
                            component_name: 'Professional Tax (PT)',
                            component_type: 'DEDUCTION',
                            amount: ptAmount,
                            sort_order: 12
                        });
                    }
                }
            }

            // Net Salary
            const netSalary = Math.max(0, Math.round((grossEarnings + overtimePay - totalDeductions) * 100) / 100);

            // Upsert into employee_salary_slips
            const slipPayload = {
                employee_id: emp.id,
                firm_id: firmId,
                month,
                year,
                total_working_days: workingDaysPerMonth,
                present_days: presentDays,
                absent_days: absentDays,
                half_days: halfDays,
                paid_leave_days: leaveDays + holidayDays + weeklyOffDays,
                overtime_hours: totalOTHours,
                gross_earnings: grossEarnings,
                total_deductions: totalDeductions,
                overtime_pay: overtimePay,
                net_salary: netSalary,
                status: 'GENERATED',
                generated_by: generatedBy,
                updated_at: new Date()
            };

            const existingSlip = await trx('employee_salary_slips')
                .where({ employee_id: emp.id, month, year })
                .first();

            let slipId;
            if (existingSlip) {
                await trx('employee_salary_slips')
                    .where({ id: existingSlip.id })
                    .update(slipPayload);
                slipId = existingSlip.id;
            } else {
                const [newSlip] = await trx('employee_salary_slips')
                    .insert(slipPayload)
                    .returning('*');
                slipId = newSlip.id;
            }

            // Replace salary_slip_details
            await trx('salary_slip_details').where({ salary_slip_id: slipId }).del();

            if (slipComponents.length > 0) {
                await trx('salary_slip_details').insert(
                    slipComponents.map(sc => ({
                        salary_slip_id: slipId,
                        component_name: sc.component_name,
                        component_type: sc.component_type,
                        amount: sc.amount,
                        sort_order: sc.sort_order || 0
                    }))
                );
            }

            generatedSlips.push({
                slipId,
                employeeId: emp.id,
                empCode: emp.emp_code,
                name: `${emp.first_name} ${emp.last_name || ''}`.trim(),
                grossEarnings,
                totalDeductions,
                overtimePay,
                netSalary
            });
        }

        return {
            month,
            year,
            totalGenerated: generatedSlips.length,
            slips: generatedSlips
        };
    });
};

/**
 * Approve a salary slip
 */
const approveSalarySlip = async (id, approverId) => {
    return db('employee_salary_slips')
        .where({ id })
        .update({
            status: 'APPROVED',
            approved_by: approverId,
            approved_at: new Date(),
            updated_at: new Date()
        })
        .returning('*');
};

/**
 * Bulk mark salary slips as PAID
 */
const bulkPaySalarySlips = async (slipIds = [], paymentData = {}, userId = null) => {
    return db('employee_salary_slips')
        .whereIn('id', slipIds)
        .update({
            status: 'PAID',
            payment_date: paymentData.paymentDate || new Date(),
            payment_mode: paymentData.paymentMode || 'BANK_TRANSFER',
            payment_reference: paymentData.paymentReference || null,
            remarks: paymentData.remarks || null,
            updated_at: new Date(),
            updated_by: userId || null
        });
};

/**
 * Monthly payroll report for dashboard & export
 */
const fetchPayrollReport = async (firmId, month, year) => {
    let query = db('employee_salary_slips as ess')
        .join('employees as e', 'ess.employee_id', 'e.id')
        .whereNull('ess.deleted_at')
        .where('ess.is_active', true)
        .where('ess.month', month)
        .where('ess.year', year);

    if (firmId && firmId !== 'all') {
        query = query.where('ess.firm_id', firmId);
    }

    const slips = await query.select(
        'ess.id',
        'e.emp_code as empCode',
        'e.first_name as firstName',
        'e.last_name as lastName',
        'e.department',
        'e.designation',
        'e.employment_type as employmentType',
        'e.salary_type as salaryType',
        'ess.present_days as presentDays',
        'ess.absent_days as absentDays',
        'ess.overtime_hours as overtimeHours',
        'ess.gross_earnings as grossEarnings',
        'ess.overtime_pay as overtimePay',
        'ess.total_deductions as totalDeductions',
        'ess.net_salary as netSalary',
        'ess.status',
        'ess.payment_date as paymentDate',
        'ess.payment_mode as paymentMode'
    );

    let totalGross = 0;
    let totalDeductions = 0;
    let totalOTPay = 0;
    let totalNet = 0;
    let paidCount = 0;
    let pendingCount = 0;

    for (const s of slips) {
        totalGross += parseFloat(s.grossEarnings || 0);
        totalDeductions += parseFloat(s.totalDeductions || 0);
        totalOTPay += parseFloat(s.overtimePay || 0);
        totalNet += parseFloat(s.netSalary || 0);
        if (s.status === 'PAID') paidCount++;
        else pendingCount++;
    }

    return {
        month: parseInt(month, 10),
        year: parseInt(year, 10),
        totalEmployees: slips.length,
        totalGross: Math.round(totalGross * 100) / 100,
        totalDeductions: Math.round(totalDeductions * 100) / 100,
        totalOTPay: Math.round(totalOTPay * 100) / 100,
        totalNet: Math.round(totalNet * 100) / 100,
        paidCount,
        pendingCount,
        slips
    };
};

module.exports = {
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
};
