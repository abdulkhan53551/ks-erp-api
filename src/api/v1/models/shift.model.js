const { db } = require('../database');

/**
 * Fetch all shifts for a firm
 */
const fetchShifts = async (firmId, search = '') => {
    let query = db('shifts')
        .whereNull('deleted_at')
        .where('is_active', true)
        .select(
            'id',
            'firm_id as firmId',
            'shift_name as shiftName',
            'shift_code as shiftCode',
            'start_time as startTime',
            'end_time as endTime',
            'break_minutes as breakMinutes',
            'is_default as isDefault',
            'created_at as createdAt'
        )
        .orderBy('is_default', 'desc')
        .orderBy('shift_name', 'asc');

    if (firmId && firmId !== 'all') {
        query = query.where('firm_id', firmId);
    }

    if (search && search.trim() !== '') {
        const term = `%${search.trim()}%`;
        query = query.where(builder => {
            builder.whereILike('shift_name', term)
                .orWhereILike('shift_code', term);
        });
    }

    return query;
};

/**
 * Fetch single shift by ID
 */
const fetchShiftById = async (id) => {
    return db('shifts')
        .where({ id })
        .whereNull('deleted_at')
        .first();
};

/**
 * Find shift by shift code in firm
 */
const findShiftByCode = async (firmId, shiftCode, excludeId = null) => {
    let query = db('shifts')
        .where({ firm_id: firmId, shift_code: shiftCode })
        .whereNull('deleted_at');

    if (excludeId) {
        query = query.whereNot('id', excludeId);
    }

    return query.first();
};

/**
 * Create a new shift
 */
const createShift = async (data) => {
    return db.transaction(async (trx) => {
        // If this shift is marked default, unset default on others in this firm
        if (data.isDefault) {
            await trx('shifts')
                .where({ firm_id: data.firmId })
                .update({ is_default: false });
        }

        const [shift] = await trx('shifts')
            .insert({
                firm_id: data.firmId,
                shift_name: data.shiftName,
                shift_code: data.shiftCode,
                start_time: data.startTime,
                end_time: data.endTime,
                break_minutes: data.breakMinutes !== undefined ? data.breakMinutes : 60,
                is_default: Boolean(data.isDefault)
            })
            .returning('*');

        return shift;
    });
};

/**
 * Update shift
 */
const updateShift = async (id, data) => {
    return db.transaction(async (trx) => {
        const updatePayload = {};
        if (data.shiftName !== undefined) updatePayload.shift_name = data.shiftName;
        if (data.shiftCode !== undefined) updatePayload.shift_code = data.shiftCode;
        if (data.startTime !== undefined) updatePayload.start_time = data.startTime;
        if (data.endTime !== undefined) updatePayload.end_time = data.endTime;
        if (data.breakMinutes !== undefined) updatePayload.break_minutes = data.breakMinutes;

        if (data.isDefault !== undefined) {
            updatePayload.is_default = Boolean(data.isDefault);
            if (data.isDefault) {
                const current = await trx('shifts').where({ id }).first();
                if (current) {
                    await trx('shifts')
                        .where({ firm_id: current.firm_id })
                        .whereNot({ id })
                        .update({ is_default: false });
                }
            }
        }

        const [updated] = await trx('shifts')
            .where({ id })
            .update(updatePayload)
            .returning('*');

        return updated;
    });
};

/**
 * Soft delete shift
 */
const deleteShift = async (id, userId) => {
    return db('shifts')
        .where({ id })
        .update({
            is_active: false,
            deleted_at: new Date(),
            deleted_by: userId || null
        });
};

/**
 * Assign a shift to multiple employees
 */
const assignShiftToEmployees = async (shiftId, employeeIds = [], effectiveFrom, effectiveTo = null, assignedBy = null) => {
    return db.transaction(async (trx) => {
        for (const empId of employeeIds) {
            // Deactivate any currently active shift assignment for this employee
            await trx('employee_shift_assignments')
                .where({ employee_id: empId, is_active: true })
                .update({
                    is_active: false,
                    effective_to: effectiveFrom
                });

            // Insert new shift assignment
            await trx('employee_shift_assignments').insert({
                employee_id: empId,
                shift_id: shiftId,
                effective_from: effectiveFrom,
                effective_to: effectiveTo || null,
                assigned_by: assignedBy || null,
                is_active: true
            });
        }

        return { assignedCount: employeeIds.length };
    });
};

/**
 * Fetch shift assignments with employee details
 */
const fetchShiftAssignments = async (filters = {}) => {
    const { firmId, shiftId, employeeId } = filters;

    let query = db('employee_shift_assignments as esa')
        .join('employees as e', 'esa.employee_id', 'e.id')
        .join('shifts as sh', 'esa.shift_id', 'sh.id')
        .leftJoin('users as u', 'esa.assigned_by', 'u.id')
        .whereNull('esa.deleted_at')
        .where('esa.is_active', true)
        .select(
            'esa.id',
            'esa.employee_id as employeeId',
            'e.emp_code as empCode',
            'e.first_name as firstName',
            'e.last_name as lastName',
            'e.department',
            'esa.shift_id as shiftId',
            'sh.shift_name as shiftName',
            'sh.shift_code as shiftCode',
            'sh.start_time as startTime',
            'sh.end_time as endTime',
            'esa.effective_from as effectiveFrom',
            'esa.effective_to as effectiveTo',
            'u.user_name as assignedByUserName',
            'esa.created_at as createdAt'
        )
        .orderBy('esa.effective_from', 'desc');

    if (firmId && firmId !== 'all') {
        query = query.where('e.firm_id', firmId);
    }
    if (shiftId) {
        query = query.where('esa.shift_id', shiftId);
    }
    if (employeeId) {
        query = query.where('esa.employee_id', employeeId);
    }

    return query;
};

module.exports = {
    fetchShifts,
    fetchShiftById,
    findShiftByCode,
    createShift,
    updateShift,
    deleteShift,
    assignShiftToEmployees,
    fetchShiftAssignments
};
