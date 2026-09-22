const { db } = require('../database');

/**
 * Fetch attendance records based on filters
 */
const fetchAttendance = async (filters = {}) => {
    const {
        firmId,
        branchId,
        employeeId,
        startDate,
        endDate,
        month,
        year,
        status
    } = filters;

    let query = db('employee_attendance as ea')
        .join('employees as e', 'ea.employee_id', 'e.id')
        .leftJoin('shifts as sh', 'ea.shift_id', 'sh.id')
        .leftJoin('users as u', 'ea.marked_by', 'u.id')
        .whereNull('ea.deleted_at')
        .where('ea.is_active', true)
        .select(
            'ea.id',
            'ea.employee_id as employeeId',
            'e.emp_code as empCode',
            'e.first_name as firstName',
            'e.last_name as lastName',
            'e.department',
            'e.designation',
            'ea.firm_id as firmId',
            'ea.branch_id as branchId',
            'ea.shift_id as shiftId',
            'sh.shift_name as shiftName',
            'ea.attendance_date as attendanceDate',
            'ea.status',
            'ea.check_in as checkIn',
            'ea.check_out as checkOut',
            'ea.total_hours as totalHours',
            'ea.overtime_hours as overtimeHours',
            'ea.overtime_type as overtimeType',
            'ea.remarks',
            'ea.marked_by as markedBy',
            'u.user_name as markedByUserName',
            'ea.created_at as createdAt',
            'ea.updated_at as updatedAt'
        )
        .orderBy('ea.attendance_date', 'desc')
        .orderBy('e.first_name', 'asc');

    if (firmId && firmId !== 'all') {
        query = query.where('ea.firm_id', firmId);
    }
    if (branchId) {
        query = query.where('ea.branch_id', branchId);
    }
    if (employeeId) {
        query = query.where('ea.employee_id', employeeId);
    }
    if (status && status !== 'ALL') {
        query = query.where('ea.status', status);
    }
    if (startDate) {
        query = query.where('ea.attendance_date', '>=', startDate);
    }
    if (endDate) {
        query = query.where('ea.attendance_date', '<=', endDate);
    }
    if (month && year) {
        query = query.whereRaw('EXTRACT(MONTH FROM ea.attendance_date) = ?', [month])
                     .whereRaw('EXTRACT(YEAR FROM ea.attendance_date) = ?', [year]);
    }

    return query;
};

/**
 * Mark or update single attendance record (Upsert)
 */
const markSingleAttendance = async (data, markedBy = null) => {
    const payload = {
        employee_id: data.employeeId,
        firm_id: data.firmId,
        branch_id: data.branchId || null,
        shift_id: data.shiftId || null,
        attendance_date: data.attendanceDate,
        status: data.status,
        check_in: data.checkIn || null,
        check_out: data.checkOut || null,
        total_hours: data.totalHours || 0,
        overtime_hours: data.overtimeHours || 0,
        overtime_type: data.overtimeType || 'NORMAL',
        remarks: data.remarks || null,
        marked_by: markedBy || null,
        updated_at: new Date()
    };

    const query = db.raw(`
        INSERT INTO employee_attendance 
            (employee_id, firm_id, branch_id, shift_id, attendance_date, status, check_in, check_out, total_hours, overtime_hours, overtime_type, remarks, marked_by, updated_at)
        VALUES 
            (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (employee_id, attendance_date)
        DO UPDATE SET
            status = EXCLUDED.status,
            check_in = EXCLUDED.check_in,
            check_out = EXCLUDED.check_out,
            total_hours = EXCLUDED.total_hours,
            overtime_hours = EXCLUDED.overtime_hours,
            overtime_type = EXCLUDED.overtime_type,
            remarks = EXCLUDED.remarks,
            marked_by = EXCLUDED.marked_by,
            updated_at = NOW()
        RETURNING *;
    `, [
        payload.employee_id,
        payload.firm_id,
        payload.branch_id,
        payload.shift_id,
        payload.attendance_date,
        payload.status,
        payload.check_in,
        payload.check_out,
        payload.total_hours,
        payload.overtime_hours,
        payload.overtime_type,
        payload.remarks,
        payload.marked_by,
        payload.updated_at
    ]);

    const result = await query;
    return result.rows[0];
};

/**
 * Bulk mark attendance for multiple employees on a single date
 */
const bulkMarkAttendance = async (firmId, attendanceDate, records = [], markedBy = null) => {
    return db.transaction(async (trx) => {
        let savedCount = 0;

        for (const record of records) {
            await trx.raw(`
                INSERT INTO employee_attendance 
                    (employee_id, firm_id, branch_id, shift_id, attendance_date, status, check_in, check_out, total_hours, overtime_hours, overtime_type, remarks, marked_by, updated_at)
                VALUES 
                    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (employee_id, attendance_date)
                DO UPDATE SET
                    status = EXCLUDED.status,
                    check_in = EXCLUDED.check_in,
                    check_out = EXCLUDED.check_out,
                    total_hours = EXCLUDED.total_hours,
                    overtime_hours = EXCLUDED.overtime_hours,
                    overtime_type = EXCLUDED.overtime_type,
                    remarks = EXCLUDED.remarks,
                    marked_by = EXCLUDED.marked_by,
                    updated_at = NOW();
            `, [
                record.employeeId,
                firmId,
                record.branchId || null,
                record.shiftId || null,
                attendanceDate,
                record.status,
                record.checkIn || null,
                record.checkOut || null,
                record.totalHours || 0,
                record.overtimeHours || 0,
                record.overtimeType || 'NORMAL',
                record.remarks || null,
                markedBy,
                new Date()
            ]);
            savedCount++;
        }

        return { savedCount };
    });
};

/**
 * Mark date status (HOLIDAY or WEEKLY_OFF) for all active employees of a firm
 */
const markDateStatus = async (firmId, branchId = null, attendanceDate, status, remarks = null, markedBy = null) => {
    return db.transaction(async (trx) => {
        let empQuery = trx('employees')
            .where({ firm_id: firmId, is_active: true, status: 'ACTIVE' })
            .whereNull('deleted_at');

        if (branchId) {
            empQuery = empQuery.where('branch_id', branchId);
        }

        const activeEmployees = await empQuery.select('id', 'branch_id');

        for (const emp of activeEmployees) {
            await trx.raw(`
                INSERT INTO employee_attendance 
                    (employee_id, firm_id, branch_id, attendance_date, status, remarks, marked_by, updated_at)
                VALUES 
                    (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (employee_id, attendance_date)
                DO UPDATE SET
                    status = EXCLUDED.status,
                    remarks = EXCLUDED.remarks,
                    marked_by = EXCLUDED.marked_by,
                    updated_at = NOW();
            `, [
                emp.id,
                firmId,
                emp.branch_id || branchId || null,
                attendanceDate,
                status,
                remarks || (status === 'HOLIDAY' ? 'Firm Holiday' : 'Weekly Off'),
                markedBy,
                new Date()
            ]);
        }

        return { affectedEmployees: activeEmployees.length, status, attendanceDate };
    });
};

/**
 * Fetch monthly attendance summary for a firm
 */
const fetchAttendanceSummary = async (filters = {}) => {
    const { firmId, month, year, branchId } = filters;

    let baseQuery = db('employee_attendance as ea')
        .join('employees as e', 'ea.employee_id', 'e.id')
        .whereNull('ea.deleted_at')
        .where('ea.is_active', true)
        .whereRaw('EXTRACT(MONTH FROM ea.attendance_date) = ?', [month])
        .whereRaw('EXTRACT(YEAR FROM ea.attendance_date) = ?', [year]);

    if (firmId && firmId !== 'all') {
        baseQuery = baseQuery.where('ea.firm_id', firmId);
    }
    if (branchId) {
        baseQuery = baseQuery.where('ea.branch_id', branchId);
    }

    // Per-employee breakdown
    const employeeBreakdown = await baseQuery.clone()
        .select(
            'e.id as employeeId',
            'e.emp_code as empCode',
            'e.first_name as firstName',
            'e.last_name as lastName',
            'e.department',
            'e.employment_type as employmentType',
            'e.salary_type as salaryType'
        )
        .select(db.raw(`COUNT(CASE WHEN ea.status = 'PRESENT' THEN 1 END) as present_days`))
        .select(db.raw(`COUNT(CASE WHEN ea.status = 'ABSENT' THEN 1 END) as absent_days`))
        .select(db.raw(`COUNT(CASE WHEN ea.status = 'HALF_DAY' THEN 1 END) as half_days`))
        .select(db.raw(`COUNT(CASE WHEN ea.status = 'LEAVE' THEN 1 END) as leave_days`))
        .select(db.raw(`COUNT(CASE WHEN ea.status = 'HOLIDAY' THEN 1 END) as holiday_days`))
        .select(db.raw(`COUNT(CASE WHEN ea.status = 'WEEKLY_OFF' THEN 1 END) as weekly_off_days`))
        .select(db.raw(`COALESCE(SUM(ea.overtime_hours), 0) as total_ot_hours`))
        .groupBy('e.id', 'e.emp_code', 'e.first_name', 'e.last_name', 'e.department', 'e.employment_type', 'e.salary_type')
        .orderBy('e.first_name', 'asc');

    // Overall aggregated totals
    let totalPresent = 0;
    let totalAbsent = 0;
    let totalHalfDays = 0;
    let totalLeaves = 0;
    let totalHolidays = 0;
    let totalOTHours = 0;

    const formattedBreakdown = employeeBreakdown.map(row => {
        const p = parseFloat(row.present_days || 0);
        const a = parseFloat(row.absent_days || 0);
        const h = parseFloat(row.half_days || 0);
        const l = parseFloat(row.leave_days || 0);
        const hol = parseFloat(row.holiday_days || 0);
        const wo = parseFloat(row.weekly_off_days || 0);
        const ot = parseFloat(row.total_ot_hours || 0);

        totalPresent += p;
        totalAbsent += a;
        totalHalfDays += h;
        totalLeaves += l;
        totalHolidays += hol;
        totalOTHours += ot;

        return {
            employeeId: row.employeeId,
            empCode: row.empCode,
            name: `${row.firstName || ''} ${row.lastName || ''}`.trim(),
            department: row.department || 'Unassigned',
            employmentType: row.employmentType,
            salaryType: row.salaryType,
            presentDays: p,
            absentDays: a,
            halfDays: h,
            leaveDays: l,
            holidayDays: hol,
            weeklyOffDays: wo,
            overtimeHours: ot,
            effectiveWorkingDays: p + (h * 0.5) + l + hol + wo
        };
    });

    return {
        month: parseInt(month, 10),
        year: parseInt(year, 10),
        employeeCount: formattedBreakdown.length,
        summary: {
            totalPresent,
            totalAbsent,
            totalHalfDays,
            totalLeaves,
            totalHolidays,
            totalOTHours
        },
        employeeBreakdown: formattedBreakdown
    };
};

module.exports = {
    fetchAttendance,
    markSingleAttendance,
    bulkMarkAttendance,
    markDateStatus,
    fetchAttendanceSummary
};
