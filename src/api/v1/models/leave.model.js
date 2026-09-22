const { db } = require('../database');

/**
 * Fetch leaves with pagination and filtering
 */
const fetchLeaves = async (filters = {}) => {
    const {
        page = 1,
        pageSize = 10,
        firmId,
        employeeId,
        status,
        leaveType,
        startDate,
        endDate
    } = filters;

    const offset = (page - 1) * pageSize;

    let query = db('employee_leaves as el')
        .join('employees as e', 'el.employee_id', 'e.id')
        .leftJoin('users as u', 'el.approved_by', 'u.id')
        .whereNull('el.deleted_at')
        .where('el.is_active', true);

    if (firmId && firmId !== 'all') {
        query = query.where('el.firm_id', firmId);
    }
    if (employeeId) {
        query = query.where('el.employee_id', employeeId);
    }
    if (status && status !== 'ALL') {
        query = query.where('el.status', status);
    }
    if (leaveType && leaveType !== 'ALL') {
        query = query.where('el.leave_type', leaveType);
    }
    if (startDate) {
        query = query.where('el.to_date', '>=', startDate);
    }
    if (endDate) {
        query = query.where('el.from_date', '<=', endDate);
    }

    const countResult = await query.clone().count('el.id as total').first();
    const total = parseInt(countResult?.total || 0, 10);

    const leaves = await query
        .select(
            'el.id',
            'el.employee_id as employeeId',
            'e.emp_code as empCode',
            'e.first_name as firstName',
            'e.last_name as lastName',
            'e.department',
            'el.firm_id as firmId',
            'el.leave_type as leaveType',
            'el.from_date as fromDate',
            'el.to_date as toDate',
            'el.total_days as totalDays',
            'el.half_day_on as halfDayOn',
            'el.reason',
            'el.status',
            'el.approved_by as approvedBy',
            'u.user_name as approvedByUserName',
            'el.approved_at as approvedAt',
            'el.rejection_reason as rejectionReason',
            'el.created_at as createdAt'
        )
        .orderBy('el.created_at', 'desc')
        .limit(pageSize)
        .offset(offset);

    return {
        leaves,
        pagination: {
            page: parseInt(page, 10),
            pageSize: parseInt(pageSize, 10),
            total,
            totalPages: Math.ceil(total / pageSize)
        }
    };
};

/**
 * Fetch single leave by ID
 */
const fetchLeaveById = async (id) => {
    return db('employee_leaves as el')
        .join('employees as e', 'el.employee_id', 'e.id')
        .leftJoin('users as u', 'el.approved_by', 'u.id')
        .where('el.id', id)
        .whereNull('el.deleted_at')
        .select(
            'el.*',
            'e.emp_code as empCode',
            'e.first_name as firstName',
            'e.last_name as lastName',
            'e.department',
            'u.user_name as approvedByUserName'
        )
        .first();
};

/**
 * Apply for leave
 */
const applyLeave = async (data) => {
    const [leave] = await db('employee_leaves')
        .insert({
            employee_id: data.employeeId,
            firm_id: data.firmId,
            leave_type: data.leaveType,
            from_date: data.fromDate,
            to_date: data.toDate,
            total_days: data.totalDays,
            half_day_on: data.halfDayOn || null,
            reason: data.reason || null,
            status: 'PENDING'
        })
        .returning('*');

    return leave;
};

/**
 * Review leave (Approve or Reject)
 * If APPROVED, automatically marks the date range as LEAVE in employee_attendance!
 */
const reviewLeave = async (id, status, rejectionReason = null, reviewerId = null) => {
    return db.transaction(async (trx) => {
        const leave = await trx('employee_leaves').where({ id }).first();
        if (!leave) return null;

        const updatePayload = {
            status,
            approved_by: reviewerId || null,
            approved_at: new Date(),
            rejection_reason: rejectionReason || null,
            updated_at: new Date()
        };

        const [updatedLeave] = await trx('employee_leaves')
            .where({ id })
            .update(updatePayload)
            .returning('*');

        // If approved, auto-mark attendance as LEAVE for each day in range
        if (status === 'APPROVED') {
            const start = new Date(leave.from_date);
            const end = new Date(leave.to_date);

            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                const dateStr = d.toISOString().split('T')[0];
                const isHalfDay = (leave.total_days < 1) ||
                    (leave.half_day_on === 'FROM' && dateStr === leave.from_date) ||
                    (leave.half_day_on === 'TO' && dateStr === leave.to_date);

                await trx.raw(`
                    INSERT INTO employee_attendance 
                        (employee_id, firm_id, attendance_date, status, remarks, marked_by, updated_at)
                    VALUES 
                        (?, ?, ?, ?, ?, ?, NOW())
                    ON CONFLICT (employee_id, attendance_date)
                    DO UPDATE SET
                        status = EXCLUDED.status,
                        remarks = EXCLUDED.remarks,
                        marked_by = EXCLUDED.marked_by,
                        updated_at = NOW();
                `, [
                    leave.employee_id,
                    leave.firm_id,
                    dateStr,
                    isHalfDay ? 'HALF_DAY' : 'LEAVE',
                    `Approved Leave (${leave.leave_type})`,
                    reviewerId
                ]);
            }
        }

        return updatedLeave;
    });
};

/**
 * Cancel leave
 */
const cancelLeave = async (id, userId = null) => {
    return db('employee_leaves')
        .where({ id })
        .update({
            status: 'CANCELLED',
            updated_at: new Date(),
            updated_by: userId || null
        });
};

module.exports = {
    fetchLeaves,
    fetchLeaveById,
    applyLeave,
    reviewLeave,
    cancelLeave
};
