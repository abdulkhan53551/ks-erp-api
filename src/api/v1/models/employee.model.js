const { db } = require('../database');
const { ApiError } = require('../services/ApiError');

/**
 * Fetch employees with pagination, filtering, search, and sorting
 */
const fetchEmployees = async (filters = {}) => {
    const {
        page = 1,
        pageSize = 10,
        search = '',
        status,
        employmentType,
        salaryType,
        department,
        designation,
        branchId,
        firmId,
        trash = false,
        sortBy = 'e.created_at',
        sortOrder = 'desc'
    } = filters;

    const offset = (page - 1) * pageSize;
    const isTrash = String(trash) === 'true';

    let query = db('employees as e')
        .leftJoin('firms as f', 'e.firm_id', 'f.id')
        .leftJoin('firm_branches as fb', 'e.branch_id', 'fb.id')
        .leftJoin('salary_templates as st', 'e.salary_template_id', 'st.id')
        .leftJoin('city as c', 'e.city_id', 'c.id')
        .leftJoin('state as s', 'e.state_id', 's.id')
        .leftJoin('employee_shift_assignments as esa', function () {
            this.on('e.id', '=', 'esa.employee_id')
                .andOn('esa.is_active', '=', db.raw('?', [true]))
                .andOnNull('esa.deleted_at');
        })
        .leftJoin('shifts as sh', 'esa.shift_id', 'sh.id');

    // Soft delete / trash filter
    if (isTrash) {
        query = query.whereNotNull('e.deleted_at');
    } else {
        query = query.whereNull('e.deleted_at').where('e.is_active', true);
    }

    // Firm filter
    if (firmId && firmId !== 'all') {
        query = query.where('e.firm_id', firmId);
    }

    // Branch filter
    if (branchId) {
        query = query.where('e.branch_id', branchId);
    }

    // Status filter
    if (status && status !== 'ALL') {
        query = query.where('e.status', status);
    }

    // Employment type filter
    if (employmentType && employmentType !== 'ALL') {
        query = query.where('e.employment_type', employmentType);
    }

    // Salary type filter
    if (salaryType && salaryType !== 'ALL') {
        query = query.where('e.salary_type', salaryType);
    }

    // Department filter
    if (department) {
        query = query.where('e.department', department);
    }

    // Designation filter
    if (designation) {
        query = query.where('e.designation', designation);
    }

    // Search query across multiple fields
    if (search && search.trim() !== '') {
        const term = `%${search.trim()}%`;
        query = query.where(builder => {
            builder.whereILike('e.emp_code', term)
                .orWhereILike('e.first_name', term)
                .orWhereILike('e.last_name', term)
                .orWhereILike('e.phone', term)
                .orWhereILike('e.email', term)
                .orWhereILike('e.designation', term)
                .orWhereILike('e.department', term);
        });
    }

    // Total count for pagination
    const countQuery = query.clone().clearSelect().clearOrder().count('e.id as total').first();
    const countResult = await countQuery;
    const total = parseInt(countResult?.total || 0, 10);

    // Sorting & pagination
    const validSortColumns = {
        'emp_code': 'e.emp_code',
        'first_name': 'e.first_name',
        'department': 'e.department',
        'designation': 'e.designation',
        'date_of_joining': 'e.date_of_joining',
        'base_salary': 'e.base_salary',
        'created_at': 'e.created_at'
    };
    const orderColumn = validSortColumns[sortBy] || 'e.created_at';
    const direction = String(sortOrder).toLowerCase() === 'asc' ? 'asc' : 'desc';

    const employees = await query
        .select(
            'e.id',
            'e.firm_id as firmId',
            'f.firm_name as firmName',
            'e.branch_id as branchId',
            'fb.branch_name as branchName',
            'e.user_id as userId',
            'e.emp_code as empCode',
            'e.first_name as firstName',
            'e.last_name as lastName',
            'e.email',
            'e.phone',
            'e.photo_url as photoUrl',
            'e.date_of_birth as dateOfBirth',
            'e.gender',
            'e.blood_group as bloodGroup',
            'e.department',
            'e.designation',
            'e.employment_type as employmentType',
            'e.status',
            'e.salary_type as salaryType',
            'e.base_salary as baseSalary',
            'e.salary_template_id as salaryTemplateId',
            'st.template_name as salaryTemplateName',
            'e.date_of_joining as dateOfJoining',
            'e.date_of_exit as dateOfExit',
            'e.bank_name as bankName',
            'e.account_number as accountNumber',
            'e.ifsc_code as ifscCode',
            'e.pan_number as panNumber',
            'e.aadhar_number as aadharNumber',
            'e.uan_number as uanNumber',
            'e.esi_number as esiNumber',
            'sh.id as currentShiftId',
            'sh.shift_name as currentShiftName',
            'sh.shift_code as currentShiftCode',
            'sh.start_time as shiftStartTime',
            'sh.end_time as shiftEndTime',
            'e.is_active as isActive',
            'e.created_at as createdAt',
            'e.updated_at as updatedAt',
            'e.deleted_at as deletedAt'
        )
        .orderBy(orderColumn, direction)
        .limit(pageSize)
        .offset(offset);

    return {
        employees,
        pagination: {
            page: parseInt(page, 10),
            pageSize: parseInt(pageSize, 10),
            total,
            totalPages: Math.ceil(total / pageSize)
        }
    };
};

/**
 * Fetch employee directory metadata (KPI counters)
 */
const fetchEmployeesMeta = async (filters = {}) => {
    const { firmId, branchId } = filters;

    let baseQuery = db('employees as e');
    if (firmId && firmId !== 'all') {
        baseQuery = baseQuery.where('e.firm_id', firmId);
    }
    if (branchId) {
        baseQuery = baseQuery.where('e.branch_id', branchId);
    }

    const [
        totalAll,
        activeCount,
        trashCount,
        permanentCount,
        dailyWageCount,
        contractCount,
        departments
    ] = await Promise.all([
        baseQuery.clone().count('e.id as count').first(),
        baseQuery.clone().whereNull('e.deleted_at').where('e.is_active', true).where('e.status', 'ACTIVE').count('e.id as count').first(),
        baseQuery.clone().whereNotNull('e.deleted_at').count('e.id as count').first(),
        baseQuery.clone().whereNull('e.deleted_at').where('e.employment_type', 'PERMANENT').count('e.id as count').first(),
        baseQuery.clone().whereNull('e.deleted_at').where('e.employment_type', 'DAILY_WAGE').count('e.id as count').first(),
        baseQuery.clone().whereNull('e.deleted_at').where('e.employment_type', 'CONTRACT').count('e.id as count').first(),
        baseQuery.clone().whereNull('e.deleted_at').select('e.department').count('e.id as count').groupBy('e.department')
    ]);

    return {
        totalEmployees: parseInt(totalAll?.count || 0, 10),
        activeEmployees: parseInt(activeCount?.count || 0, 10),
        trashEmployees: parseInt(trashCount?.count || 0, 10),
        permanentEmployees: parseInt(permanentCount?.count || 0, 10),
        dailyWageEmployees: parseInt(dailyWageCount?.count || 0, 10),
        contractEmployees: parseInt(contractCount?.count || 0, 10),
        departmentBreakdown: departments.map(d => ({
            department: d.department || 'Unassigned',
            count: parseInt(d.count, 10)
        }))
    };
};

/**
 * Fetch single employee by ID
 */
const fetchEmployeeById = async (id) => {
    const employee = await db('employees as e')
        .leftJoin('firms as f', 'e.firm_id', 'f.id')
        .leftJoin('firm_branches as fb', 'e.branch_id', 'fb.id')
        .leftJoin('salary_templates as st', 'e.salary_template_id', 'st.id')
        .leftJoin('city as c', 'e.city_id', 'c.id')
        .leftJoin('state as s', 'e.state_id', 's.id')
        .leftJoin('users as u', 'e.user_id', 'u.id')
        .where('e.id', id)
        .select(
            'e.*',
            'f.firm_name as firmName',
            'fb.branch_name as branchName',
            'st.template_name as salaryTemplateName',
            'c.name as cityName',
            's.name as stateName',
            'u.user_name as userName'
        )
        .first();

    if (!employee) return null;

    // Fetch shift assignments history
    const shiftAssignments = await db('employee_shift_assignments as esa')
        .join('shifts as sh', 'esa.shift_id', 'sh.id')
        .where('esa.employee_id', id)
        .whereNull('esa.deleted_at')
        .select(
            'esa.id as assignmentId',
            'esa.shift_id as shiftId',
            'sh.shift_name as shiftName',
            'sh.shift_code as shiftCode',
            'sh.start_time as startTime',
            'sh.end_time as endTime',
            'sh.break_minutes as breakMinutes',
            'esa.effective_from as effectiveFrom',
            'esa.effective_to as effectiveTo',
            'esa.is_active as isActive'
        )
        .orderBy('esa.effective_from', 'desc');

    return {
        ...employee,
        shiftAssignments,
        currentShift: shiftAssignments.find(s => s.isActive) || null
    };
};

/**
 * Check if employee code already exists in firm
 */
const findEmployeeByEmpCode = async (firmId, empCode, excludeId = null) => {
    let query = db('employees')
        .where({ firm_id: firmId, emp_code: empCode })
        .whereNull('deleted_at');

    if (excludeId) {
        query = query.whereNot('id', excludeId);
    }

    return query.first();
};

/**
 * Create a new employee with optional shift assignment
 */
const createEmployee = async (employeeData, shiftId = null) => {
    return db.transaction(async (trx) => {
        const [employee] = await trx('employees')
            .insert({
                firm_id: employeeData.firmId,
                branch_id: employeeData.branchId || null,
                user_id: employeeData.userId || null,
                emp_code: employeeData.empCode,
                first_name: employeeData.firstName,
                last_name: employeeData.lastName || null,
                email: employeeData.email || null,
                phone: employeeData.phone || null,
                photo_url: employeeData.photoUrl || null,
                photo_public_id: employeeData.photoPublicId || null,
                date_of_birth: employeeData.dateOfBirth || null,
                gender: employeeData.gender || null,
                blood_group: employeeData.bloodGroup || null,
                address: employeeData.address || null,
                city_id: employeeData.cityId || null,
                state_id: employeeData.stateId || null,
                pincode: employeeData.pincode || null,
                emergency_contact_name: employeeData.emergencyContactName || null,
                emergency_contact_phone: employeeData.emergencyContactPhone || null,
                date_of_joining: employeeData.dateOfJoining,
                date_of_exit: employeeData.dateOfExit || null,
                department: employeeData.department || null,
                designation: employeeData.designation || null,
                employment_type: employeeData.employmentType || 'PERMANENT',
                status: employeeData.status || 'ACTIVE',
                salary_type: employeeData.salaryType || 'MONTHLY',
                base_salary: employeeData.baseSalary || 0,
                salary_template_id: employeeData.salaryTemplateId || null,
                bank_name: employeeData.bankName || null,
                account_number: employeeData.accountNumber || null,
                ifsc_code: employeeData.ifscCode || null,
                pan_number: employeeData.panNumber || null,
                aadhar_number: employeeData.aadharNumber || null,
                uan_number: employeeData.uanNumber || null,
                esi_number: employeeData.esiNumber || null
            })
            .returning('*');

        // Assign initial shift if provided
        if (shiftId) {
            await trx('employee_shift_assignments').insert({
                employee_id: employee.id,
                shift_id: shiftId,
                effective_from: employeeData.dateOfJoining || new Date(),
                is_active: true
            });
        }

        return employee;
    });
};

/**
 * Update an existing employee
 */
const updateEmployee = async (id, employeeData, shiftId = null) => {
    return db.transaction(async (trx) => {
        const updatePayload = {};

        if (employeeData.branchId !== undefined) updatePayload.branch_id = employeeData.branchId;
        if (employeeData.userId !== undefined) updatePayload.user_id = employeeData.userId;
        if (employeeData.empCode !== undefined) updatePayload.emp_code = employeeData.empCode;
        if (employeeData.firstName !== undefined) updatePayload.first_name = employeeData.firstName;
        if (employeeData.lastName !== undefined) updatePayload.last_name = employeeData.lastName;
        if (employeeData.email !== undefined) updatePayload.email = employeeData.email;
        if (employeeData.phone !== undefined) updatePayload.phone = employeeData.phone;
        if (employeeData.photoUrl !== undefined) updatePayload.photo_url = employeeData.photoUrl;
        if (employeeData.photoPublicId !== undefined) updatePayload.photo_public_id = employeeData.photoPublicId;
        if (employeeData.dateOfBirth !== undefined) updatePayload.date_of_birth = employeeData.dateOfBirth;
        if (employeeData.gender !== undefined) updatePayload.gender = employeeData.gender;
        if (employeeData.bloodGroup !== undefined) updatePayload.blood_group = employeeData.bloodGroup;
        if (employeeData.address !== undefined) updatePayload.address = employeeData.address;
        if (employeeData.cityId !== undefined) updatePayload.city_id = employeeData.cityId;
        if (employeeData.stateId !== undefined) updatePayload.state_id = employeeData.stateId;
        if (employeeData.pincode !== undefined) updatePayload.pincode = employeeData.pincode;
        if (employeeData.emergencyContactName !== undefined) updatePayload.emergency_contact_name = employeeData.emergencyContactName;
        if (employeeData.emergencyContactPhone !== undefined) updatePayload.emergency_contact_phone = employeeData.emergencyContactPhone;
        if (employeeData.dateOfJoining !== undefined) updatePayload.date_of_joining = employeeData.dateOfJoining;
        if (employeeData.dateOfExit !== undefined) updatePayload.date_of_exit = employeeData.dateOfExit;
        if (employeeData.department !== undefined) updatePayload.department = employeeData.department;
        if (employeeData.designation !== undefined) updatePayload.designation = employeeData.designation;
        if (employeeData.employmentType !== undefined) updatePayload.employment_type = employeeData.employmentType;
        if (employeeData.status !== undefined) updatePayload.status = employeeData.status;
        if (employeeData.salaryType !== undefined) updatePayload.salary_type = employeeData.salaryType;
        if (employeeData.baseSalary !== undefined) updatePayload.base_salary = employeeData.baseSalary;
        if (employeeData.salaryTemplateId !== undefined) updatePayload.salary_template_id = employeeData.salaryTemplateId;
        if (employeeData.bankName !== undefined) updatePayload.bank_name = employeeData.bankName;
        if (employeeData.accountNumber !== undefined) updatePayload.account_number = employeeData.accountNumber;
        if (employeeData.ifscCode !== undefined) updatePayload.ifsc_code = employeeData.ifscCode;
        if (employeeData.panNumber !== undefined) updatePayload.pan_number = employeeData.panNumber;
        if (employeeData.aadharNumber !== undefined) updatePayload.aadhar_number = employeeData.aadharNumber;
        if (employeeData.uanNumber !== undefined) updatePayload.uan_number = employeeData.uanNumber;
        if (employeeData.esiNumber !== undefined) updatePayload.esi_number = employeeData.esiNumber;

        const [updatedEmployee] = await trx('employees')
            .where({ id })
            .update(updatePayload)
            .returning('*');

        // Update shift assignment if provided and changed
        if (shiftId) {
            const activeAssignment = await trx('employee_shift_assignments')
                .where({ employee_id: id, is_active: true })
                .first();

            if (!activeAssignment || activeAssignment.shift_id !== shiftId) {
                // Deactivate old active assignment
                if (activeAssignment) {
                    await trx('employee_shift_assignments')
                        .where({ id: activeAssignment.id })
                        .update({ is_active: false, effective_to: new Date() });
                }

                // Insert new active shift assignment
                await trx('employee_shift_assignments').insert({
                    employee_id: id,
                    shift_id: shiftId,
                    effective_from: new Date(),
                    is_active: true
                });
            }
        }

        return updatedEmployee;
    });
};

/**
 * Soft delete an employee (move to trash)
 */
const softDeleteEmployee = async (id, userId) => {
    return db('employees')
        .where({ id })
        .update({
            is_active: false,
            deleted_at: new Date(),
            deleted_by: userId || null
        });
};

/**
 * Restore an employee from trash
 */
const restoreEmployee = async (id) => {
    return db('employees')
        .where({ id })
        .update({
            is_active: true,
            deleted_at: null,
            deleted_by: null
        });
};

/**
 * Permanently delete employee
 */
const permanentDeleteEmployee = async (id) => {
    return db('employees').where({ id }).del();
};

/**
 * Fetch lightweight employee list for select dropdowns
 */
const fetchEmployeesDropdown = async (firmId, branchId = null) => {
    let query = db('employees')
        .whereNull('deleted_at')
        .where('is_active', true)
        .where('status', 'ACTIVE')
        .select(
            'id',
            'emp_code as empCode',
            'first_name as firstName',
            'last_name as lastName',
            'department',
            'designation',
            'salary_type as salaryType',
            'base_salary as baseSalary'
        )
        .orderBy('first_name', 'asc');

    if (firmId && firmId !== 'all') {
        query = query.where('firm_id', firmId);
    }
    if (branchId) {
        query = query.where('branch_id', branchId);
    }

    return query;
};

module.exports = {
    fetchEmployees,
    fetchEmployeesMeta,
    fetchEmployeeById,
    findEmployeeByEmpCode,
    createEmployee,
    updateEmployee,
    softDeleteEmployee,
    restoreEmployee,
    permanentDeleteEmployee,
    fetchEmployeesDropdown
};
