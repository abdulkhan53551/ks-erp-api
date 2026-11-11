const { db } = require('../database');

/**
 * Fetch advances with pagination, filters, and aggregated metrics
 */
const fetchAdvances = async ({
    firmId = null,
    employeeId = null,
    status = null,
    search = '',
    page = 1,
    pageSize = 20,
    sortBy = 'created_at',
    sortOrder = 'desc'
}) => {
    const offset = (page - 1) * pageSize;

    const baseQuery = db('employee_advances as ea')
        .join('employees as e', 'ea.employee_id', 'e.id')
        .join('firms as f', 'ea.firm_id', 'f.id')
        .leftJoin('users as u', 'ea.disbursed_by', 'u.id')
        .whereNull('ea.deleted_at')
        .whereNull('e.deleted_at');

    if (firmId && firmId !== 'all') {
        baseQuery.where('ea.firm_id', firmId);
    }

    if (employeeId) {
        baseQuery.where('ea.employee_id', employeeId);
    }

    if (status && status !== 'ALL') {
        baseQuery.where('ea.status', status);
    }

    if (search && search.trim() !== '') {
        const term = `%${search.trim()}%`;
        baseQuery.where((builder) => {
            builder
                .whereILike('e.first_name', term)
                .orWhereILike('e.last_name', term)
                .orWhereILike('e.emp_code', term)
                .orWhereILike('ea.payment_reference', term)
                .orWhereILike('ea.remarks', term);
        });
    }

    // Clone query for count
    const totalResult = await baseQuery.clone().count('ea.id as count').first();
    const total = parseInt(totalResult?.count || 0, 10);

    // Dynamic sorting
    const validSortCols = {
        id: 'ea.id',
        advance_date: 'ea.advance_date',
        advanceDate: 'ea.advance_date',
        total_amount: 'ea.total_amount',
        totalAmount: 'ea.total_amount',
        recovered_amount: 'ea.recovered_amount',
        remaining_balance: 'ea.remaining_balance',
        remainingBalance: 'ea.remaining_balance',
        status: 'ea.status',
        created_at: 'ea.created_at'
    };
    const sortCol = validSortCols[sortBy] || 'ea.created_at';
    const sortDir = (sortOrder && String(sortOrder).toLowerCase() === 'asc') ? 'asc' : 'desc';

    const advances = await baseQuery
        .clone()
        .select(
            'ea.id',
            'ea.firm_id as firmId',
            'f.firm_name as firmName',
            'ea.employee_id as employeeId',
            'e.emp_code as empCode',
            'e.first_name as firstName',
            'e.last_name as lastName',
            'e.department',
            'e.designation',
            'ea.advance_date as advanceDate',
            'ea.total_amount as totalAmount',
            'ea.recovery_type as recoveryType',
            'ea.monthly_deduction as monthlyDeduction',
            'ea.recovered_amount as recoveredAmount',
            'ea.remaining_balance as remainingBalance',
            'ea.is_paused as isPaused',
            'ea.status',
            'ea.payment_mode as paymentMode',
            'ea.payment_reference as paymentReference',
            'ea.remarks',
            'ea.disbursed_by as disbursedBy',
            'u.user_name as disbursedByUserName',
            'ea.created_at as createdAt',
            'ea.updated_at as updatedAt'
        )
        .orderBy(sortCol, sortDir)
        .limit(pageSize)
        .offset(offset);

    // Summary metrics calculation across filtered scope
    const summaryQuery = db('employee_advances as ea')
        .whereNull('ea.deleted_at');

    if (firmId && firmId !== 'all') {
        summaryQuery.where('ea.firm_id', firmId);
    }
    if (employeeId) {
        summaryQuery.where('ea.employee_id', employeeId);
    }

    const summaryResult = await summaryQuery
        .select(
            db.raw('COALESCE(SUM(total_amount), 0) as "totalDisbursed"'),
            db.raw('COALESCE(SUM(recovered_amount), 0) as "totalRecovered"'),
            db.raw('COALESCE(SUM(remaining_balance), 0) as "totalOutstanding"'),
            db.raw('COUNT(CASE WHEN status = \'ACTIVE\' THEN 1 END) as "activeCount"'),
            db.raw('COUNT(CASE WHEN status = \'PAUSED\' THEN 1 END) as "pausedCount"'),
            db.raw('COUNT(CASE WHEN status = \'CLOSED\' THEN 1 END) as "closedCount"')
        )
        .first();

    return {
        advances,
        pagination: {
            page: parseInt(page, 10),
            pageSize: parseInt(pageSize, 10),
            total,
            totalPages: Math.ceil(total / pageSize)
        },
        summary: {
            totalDisbursed: parseFloat(summaryResult?.totalDisbursed || 0),
            totalRecovered: parseFloat(summaryResult?.totalRecovered || 0),
            totalOutstanding: parseFloat(summaryResult?.totalOutstanding || 0),
            activeCount: parseInt(summaryResult?.activeCount || 0, 10),
            pausedCount: parseInt(summaryResult?.pausedCount || 0, 10),
            closedCount: parseInt(summaryResult?.closedCount || 0, 10)
        }
    };
};

/**
 * Fetch a single advance record with repayment history
 */
const fetchAdvanceById = async (id) => {
    const advance = await db('employee_advances as ea')
        .join('employees as e', 'ea.employee_id', 'e.id')
        .join('firms as f', 'ea.firm_id', 'f.id')
        .leftJoin('users as u', 'ea.disbursed_by', 'u.id')
        .where('ea.id', id)
        .whereNull('ea.deleted_at')
        .select(
            'ea.*',
            'f.firm_name as firmName',
            'e.emp_code as empCode',
            'e.first_name as firstName',
            'e.last_name as lastName',
            'e.department',
            'e.designation',
            'e.salary_type as salaryType',
            'e.base_salary as baseSalary',
            'u.user_name as disbursedByUserName'
        )
        .first();

    if (!advance) return null;

    const repayments = await db('employee_advance_repayments as ear')
        .leftJoin('employee_salary_slips as ess', 'ear.salary_slip_id', 'ess.id')
        .leftJoin('users as u', 'ear.recorded_by', 'u.id')
        .where('ear.advance_id', id)
        .whereNull('ear.deleted_at')
        .select(
            'ear.id',
            'ear.advance_id as advanceId',
            'ear.repayment_date as repaymentDate',
            'ear.amount_deducted as amountDeducted',
            'ear.repayment_type as repaymentType',
            'ear.balance_after as balanceAfter',
            'ear.remarks',
            'ear.salary_slip_id as salarySlipId',
            'ess.month as slipMonth',
            'ess.year as slipYear',
            'u.user_name as recordedByUserName',
            'ear.created_at as createdAt'
        )
        .orderBy('ear.repayment_date', 'desc')
        .orderBy('ear.id', 'desc');

    return {
        ...advance,
        repayments
    };
};

/**
 * Disburse a new employee advance
 */
const createAdvance = async (advanceData, userId = null) => {
    return db.transaction(async (trx) => {
        const totalAmount = parseFloat(advanceData.totalAmount);
        const monthlyDeduction = advanceData.recoveryType === 'EMI' && advanceData.monthlyDeduction
            ? parseFloat(advanceData.monthlyDeduction)
            : totalAmount;

        const payload = {
            firm_id: advanceData.firmId,
            employee_id: advanceData.employeeId,
            advance_date: advanceData.advanceDate,
            total_amount: totalAmount,
            recovery_type: advanceData.recoveryType || 'FULL',
            monthly_deduction: monthlyDeduction,
            recovered_amount: 0,
            remaining_balance: totalAmount,
            is_paused: false,
            status: 'ACTIVE',
            payment_mode: advanceData.paymentMode || 'CASH',
            payment_reference: advanceData.paymentReference || null,
            disbursed_by: userId,
            remarks: advanceData.remarks || null,
            created_by: userId,
            created_at: new Date(),
            updated_at: new Date()
        };

        const [created] = await trx('employee_advances').insert(payload).returning('*');
        return created;
    });
};

/**
 * Update advance terms (recovery type, monthly EMI amount, payment ref, remarks)
 */
const updateAdvance = async (id, updateData, userId = null) => {
    const existing = await db('employee_advances')
        .where({ id })
        .whereNull('deleted_at')
        .first();

    if (!existing) return null;

    const payload = {
        updated_at: new Date(),
        updated_by: userId
    };

    if (updateData.monthlyDeduction !== undefined) {
        payload.monthly_deduction = parseFloat(updateData.monthlyDeduction);
    }
    if (updateData.recoveryType !== undefined) {
        payload.recovery_type = updateData.recoveryType;
    }
    if (updateData.paymentReference !== undefined) {
        payload.payment_reference = updateData.paymentReference;
    }
    if (updateData.remarks !== undefined) {
        payload.remarks = updateData.remarks;
    }

    const [updated] = await db('employee_advances')
        .where({ id })
        .update(payload)
        .returning('*');

    return updated;
};

/**
 * Pause or resume deductions for an advance
 */
const togglePauseAdvance = async (id, isPaused, userId = null) => {
    const existing = await db('employee_advances')
        .where({ id })
        .whereNull('deleted_at')
        .first();

    if (!existing) return null;

    const newStatus = existing.remaining_balance <= 0
        ? 'CLOSED'
        : (isPaused ? 'PAUSED' : 'ACTIVE');

    const [updated] = await db('employee_advances')
        .where({ id })
        .update({
            is_paused: isPaused,
            status: newStatus,
            updated_at: new Date(),
            updated_by: userId
        })
        .returning('*');

    return updated;
};

/**
 * Record a manual cash/bank repayment against an advance
 */
const recordManualRepayment = async (advanceId, repaymentData, userId = null) => {
    return db.transaction(async (trx) => {
        const advance = await trx('employee_advances')
            .where({ id: advanceId })
            .whereNull('deleted_at')
            .forUpdate()
            .first();

        if (!advance) {
            throw new Error('Advance not found.');
        }

        if (advance.status === 'CLOSED' || advance.remaining_balance <= 0) {
            throw new Error('This advance is already fully settled.');
        }

        const repaymentAmount = parseFloat(repaymentData.amount);
        if (repaymentAmount <= 0) {
            throw new Error('Repayment amount must be greater than zero.');
        }

        if (repaymentAmount > parseFloat(advance.remaining_balance)) {
            throw new Error(`Repayment amount (₹${repaymentAmount}) cannot exceed remaining balance (₹${advance.remaining_balance}).`);
        }

        const currentRecovered = parseFloat(advance.recovered_amount || 0);
        const currentRemaining = parseFloat(advance.remaining_balance);

        const newRecovered = Math.round((currentRecovered + repaymentAmount) * 100) / 100;
        const newRemaining = Math.max(0, Math.round((currentRemaining - repaymentAmount) * 100) / 100);
        const newStatus = newRemaining <= 0 ? 'CLOSED' : advance.status;

        // 1. Insert repayment ledger entry
        const [repayment] = await trx('employee_advance_repayments').insert({
            advance_id: advance.id,
            firm_id: advance.firm_id,
            employee_id: advance.employee_id,
            salary_slip_id: null,
            repayment_date: repaymentData.repaymentDate || new Date(),
            amount_deducted: repaymentAmount,
            repayment_type: repaymentData.repaymentType || 'DIRECT_CASH',
            balance_after: newRemaining,
            recorded_by: userId,
            remarks: repaymentData.remarks || 'Manual repayment directly recorded by admin',
            created_at: new Date(),
            updated_at: new Date()
        }).returning('*');

        // 2. Update parent advance record
        const [updatedAdvance] = await trx('employee_advances')
            .where({ id: advance.id })
            .update({
                recovered_amount: newRecovered,
                remaining_balance: newRemaining,
                status: newStatus,
                updated_at: new Date(),
                updated_by: userId
            })
            .returning('*');

        return {
            advance: updatedAdvance,
            repayment
        };
    });
};

/**
 * Fetch active advance balance summary for an employee
 */
const fetchEmployeeActiveAdvanceSummary = async (employeeId, firmId = null) => {
    const query = db('employee_advances')
        .where({
            employee_id: employeeId,
            status: 'ACTIVE',
            is_paused: false
        })
        .where('remaining_balance', '>', 0)
        .whereNull('deleted_at');

    if (firmId && firmId !== 'all') {
        query.where({ firm_id: firmId });
    }

    const activeAdvances = await query.orderBy('advance_date', 'asc');
    const totalOutstanding = activeAdvances.reduce((sum, a) => sum + parseFloat(a.remaining_balance || 0), 0);

    return {
        activeAdvances,
        totalOutstanding
    };
};

module.exports = {
    fetchAdvances,
    fetchAdvanceById,
    createAdvance,
    updateAdvance,
    togglePauseAdvance,
    recordManualRepayment,
    fetchEmployeeActiveAdvanceSummary
};
