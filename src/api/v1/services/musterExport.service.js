const ExcelJS = require('exceljs');
const path = require('path');
const ejs = require('ejs');
const puppeteer = require('puppeteer');
const { projectPaths } = require('../../../config/constants');
const { getBrowser } = require('../controllers/invoice.controller');
const { db } = require('../database');

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

const STATUS_SHORTHAND = {
    PRESENT: 'P',
    ABSENT: 'A',
    HALF_DAY: 'HD',
    LEAVE: 'L',
    WEEKLY_OFF: 'WO',
    HOLIDAY: 'H'
};

const STATUS_COLORS = {
    P: { fill: 'DCFCE7', font: '15803D' },
    A: { fill: 'FEE2E2', font: 'B91C1C' },
    HD: { fill: 'FEF3C7', font: 'B45309' },
    L: { fill: 'E0F2FE', font: '0369A1' },
    WO: { fill: 'F1F5F9', font: '475569' },
    H: { fill: 'F3E8FF', font: '7E22CE' }
};

const getFirmInfo = async (firmId) => {
    let firm = null;
    if (firmId && firmId !== 'all') {
        firm = await db('firms as f')
            .leftJoin('firm_branches as fb', 'f.id', 'fb.firm_id')
            .where('f.id', firmId)
            .select(
                'f.firm_name',
                'f.trade_name',
                'f.gstin',
                'fb.branch_name',
                'fb.phone',
                'fb.email'
            )
            .first();
    }
    if (!firm) {
        firm = await db('firms as f')
            .leftJoin('firm_branches as fb', 'f.id', 'fb.firm_id')
            .select(
                'f.firm_name',
                'f.trade_name',
                'f.gstin',
                'fb.branch_name',
                'fb.phone',
                'fb.email'
            )
            .first();
    }
    return firm || { firm_name: 'KS ENGINEERING WORKS', gstin: '' };
};

/**
 * Helper to compute column letter (1 -> A, 27 -> AA, etc.)
 */
const getColLetter = (colIdx) => {
    let temp, letter = '';
    while (colIdx > 0) {
        temp = (colIdx - 1) % 26;
        letter = String.fromCharCode(temp + 65) + letter;
        colIdx = Math.floor((colIdx - temp - 1) / 26);
    }
    return letter;
};

/**
 * Safely merge cells only if valid and catch any duplicate merge
 */
const safeMerge = (sheet, r1, c1, r2, c2) => {
    if (r1 === r2 && c1 === c2) return;
    if (r2 < r1 || c2 < c1) return;
    try {
        sheet.mergeCells(r1, c1, r2, c2);
    } catch (e) {
        // gracefully ignore already merged or conflicting range
    }
};

/**
 * Calculates 3 strictly non-overlapping signature column ranges
 */
const getSignatureRanges = (totalCols) => {
    const part = Math.max(2, Math.floor((totalCols - 1) / 3));
    const s1 = 2;
    const e1 = Math.min(totalCols - 2, 1 + part);
    const s2 = e1 + 1;
    const e2 = Math.min(totalCols - 1, s2 + part - 1);
    const s3 = e2 + 1;
    const e3 = totalCols;
    return [
        { start: s1, end: e1 },
        { start: s2, end: e2 },
        { start: s3, end: e3 }
    ];
};

/**
 * =========================================================================
 * 1. ATTENDANCE MUSTER EXPORT (EXCEL) - MATCHING PDF FORM II REGISTER
 * =========================================================================
 */
const generateAttendanceMusterExcel = async ({ firmId, branchId, month, year, options = {} }) => {
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);
    const daysInMonth = new Date(y, m, 0).getDate();
    const monthName = `${MONTH_NAMES[m - 1]} ${y}`;
    const firm = await getFirmInfo(firmId);

    // Active employees
    let empQuery = db('employees as e')
        .whereNull('e.deleted_at')
        .where('e.is_active', true)
        .where('e.status', 'ACTIVE')
        .select(
            'e.id',
            'e.emp_code as empCode',
            'e.first_name as firstName',
            'e.last_name as lastName',
            'e.department',
            'e.designation'
        )
        .orderBy('e.first_name', 'asc');

    if (firmId && firmId !== 'all') empQuery = empQuery.where('e.firm_id', firmId);
    if (branchId) empQuery = empQuery.where('e.branch_id', branchId);
    const employees = await empQuery;

    // Monthly attendance logs
    let attQuery = db('employee_attendance as ea')
        .whereNull('ea.deleted_at')
        .where('ea.is_active', true)
        .whereRaw('EXTRACT(MONTH FROM ea.attendance_date) = ?', [m])
        .whereRaw('EXTRACT(YEAR FROM ea.attendance_date) = ?', [y])
        .select(
            'ea.employee_id as employeeId',
            db.raw("TO_CHAR(ea.attendance_date, 'YYYY-MM-DD') as \"attendanceDate\""),
            'ea.status',
            'ea.total_hours as totalHours',
            'ea.overtime_hours as overtimeHours'
        );

    if (firmId && firmId !== 'all') attQuery = attQuery.where('ea.firm_id', firmId);
    const logs = await attQuery;

    const matrix = {};
    for (const log of logs) {
        const empId = log.employeeId;
        const d = parseInt(String(log.attendanceDate).split('-')[2], 10);
        if (!matrix[empId]) matrix[empId] = {};
        matrix[empId][d] = {
            status: log.status,
            ot: parseFloat(log.overtimeHours || 0)
        };
    }

    const includeOt = options.includeOt !== false && options.includeOt !== 'false';
    const totalCols = 5 + daysInMonth + 7 + (includeOt ? 1 : 0);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'KS Engineering Works ERP';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(`Attendance - ${MONTH_NAMES[m - 1]}`, {
        views: [{ state: 'frozen', xSplit: 5, ySplit: 7, showGridLines: true }],
        pageSetup: {
            orientation: 'landscape',
            paperSize: 8, // A3
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 }
        }
    });

    // 1. Company Letterhead Header Block (Rows 1 to 4) - CLEAN CORPORATE WHITE
    // Row 1: Company Title
    safeMerge(sheet, 1, 1, 1, totalCols);
    const titleCell = sheet.getCell('A1');
    titleCell.value = (firm.firm_name || 'KS ENGINEERING WORKS').toUpperCase();
    titleCell.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FF0F172A' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).height = 32;

    // Row 2: Company Meta (Branch, GSTIN, Phone, Email)
    safeMerge(sheet, 2, 1, 2, totalCols);
    const metaRowCell = sheet.getCell('A2');
    const metaParts = [
        firm.branch_name,
        firm.gstin ? `GSTIN: ${firm.gstin}` : '',
        firm.phone ? `Phone: ${firm.phone}` : '',
        firm.email ? `Email: ${firm.email}` : ''
    ].filter(Boolean);
    metaRowCell.value = metaParts.join('   •   ');
    metaRowCell.font = { name: 'Segoe UI', size: 9, color: { argb: 'FF475569' } };
    metaRowCell.alignment = { horizontal: 'center', vertical: 'middle' };
    metaRowCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
    sheet.getRow(2).height = 18;

    // Row 3: Statutory Form Title (Form II)
    safeMerge(sheet, 3, 1, 3, totalCols);
    const formCell = sheet.getCell('A3');
    formCell.value = 'FORM II — MUSTER ROLL (ATTENDANCE REGISTER)';
    formCell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FF0284C7' } };
    formCell.alignment = { horizontal: 'center', vertical: 'middle' };
    formCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F9FF' } };
    sheet.getRow(3).height = 24;

    // Row 4: Period & Headcount Metadata
    safeMerge(sheet, 4, 1, 4, totalCols);
    const periodCell = sheet.getCell('A4');
    periodCell.value = `Wage Period: ${monthName.toUpperCase()}   •   Total Headcount: ${employees.length} Active Workers   •   Generated: ${new Date().toLocaleDateString('en-IN')}`;
    periodCell.font = { name: 'Segoe UI', size: 8.5, italic: true, color: { argb: 'FF64748B' } };
    periodCell.alignment = { horizontal: 'center', vertical: 'middle' };
    periodCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
    sheet.getRow(4).height = 20;

    // Bottom divider border on Row 4
    for (let c = 1; c <= totalCols; c++) {
        sheet.getCell(4, c).border = { bottom: { style: 'medium', color: { argb: 'FF0284C7' } } };
    }

    sheet.getRow(5).height = 8; // Spacer

    // 2. Super-Header (Row 6)
    safeMerge(sheet, 6, 1, 6, 5);
    const shEmp = sheet.getCell('A6');
    shEmp.value = 'EMPLOYEE PARTICULARS';
    shEmp.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    shEmp.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    shEmp.alignment = { horizontal: 'center', vertical: 'middle' };

    safeMerge(sheet, 6, 6, 6, 5 + daysInMonth);
    const shDays = sheet.getCell('F6');
    shDays.value = `DAILY ATTENDANCE LOG — ${MONTH_NAMES[m - 1].toUpperCase()} (DAYS 1 TO ${daysInMonth})`;
    shDays.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0284C7' } };
    shDays.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    shDays.alignment = { horizontal: 'center', vertical: 'middle' };

    safeMerge(sheet, 6, 6 + daysInMonth, 6, 5 + daysInMonth + 7);
    const shSummary = sheet.getCell(6, 6 + daysInMonth);
    shSummary.value = 'MONTHLY ATTENDANCE SUMMARY';
    shSummary.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
    shSummary.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    shSummary.alignment = { horizontal: 'center', vertical: 'middle' };

    if (includeOt) {
        safeMerge(sheet, 6, totalCols, 7, totalCols);
        const shOt = sheet.getCell(6, totalCols);
        shOt.value = 'OT (h)';
        shOt.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
        shOt.font = { name: 'Segoe UI', size: 8.5, bold: true, color: { argb: 'FFFFFFFF' } };
        shOt.alignment = { horizontal: 'center', vertical: 'middle' };
    }
    sheet.getRow(6).height = 22;

    // 3. Sub-Header (Row 7)
    const subHeaders = ['#', 'Emp Code', 'Employee Name', 'Department', 'Designation'];
    for (let day = 1; day <= daysInMonth; day++) {
        subHeaders.push(String(day));
    }
    subHeaders.push('Days', 'P', 'A', '½', 'L', 'WO', 'H');
    if (includeOt) subHeaders.push(''); // handled via merge in Row 6

    const subHeaderRow = sheet.getRow(7);
    subHeaderRow.values = subHeaders;
    subHeaderRow.height = 24;

    subHeaderRow.eachCell((cell, colNum) => {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
            top: { style: 'thin', color: { argb: 'FF64748B' } },
            left: { style: 'thin', color: { argb: 'FF64748B' } },
            bottom: { style: 'medium', color: { argb: 'FF0284C7' } },
            right: { style: 'thin', color: { argb: 'FF64748B' } }
        };

        if (colNum <= 5) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
            cell.font = { name: 'Segoe UI', size: 8.5, bold: true, color: { argb: 'FFFFFFFF' } };
        } else if (colNum <= 5 + daysInMonth) {
            const dayNum = colNum - 5;
            const isSunday = new Date(y, m - 1, dayNum).getDay() === 0;
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isSunday ? 'FF0369A1' : 'FF1E293B' } };
            cell.font = { name: 'Segoe UI', size: 8, bold: true, color: { argb: 'FFFFFFFF' } };
        } else if (colNum === 6 + daysInMonth) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
            cell.font = { name: 'Segoe UI', size: 8.5, bold: true, color: { argb: 'FFFFFFFF' } };
        } else if (colNum === 7 + daysInMonth) { // P
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF15803D' } };
            cell.font = { name: 'Segoe UI', size: 8.5, bold: true, color: { argb: 'FFFFFFFF' } };
        } else if (colNum === 8 + daysInMonth) { // A
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB91C1C' } };
            cell.font = { name: 'Segoe UI', size: 8.5, bold: true, color: { argb: 'FFFFFFFF' } };
        } else if (colNum === 9 + daysInMonth) { // 1/2
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB45309' } };
            cell.font = { name: 'Segoe UI', size: 8.5, bold: true, color: { argb: 'FFFFFFFF' } };
        } else if (colNum === 10 + daysInMonth) { // L
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0369A1' } };
            cell.font = { name: 'Segoe UI', size: 8.5, bold: true, color: { argb: 'FFFFFFFF' } };
        } else if (colNum === 11 + daysInMonth) { // WO
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF475569' } };
            cell.font = { name: 'Segoe UI', size: 8.5, bold: true, color: { argb: 'FFFFFFFF' } };
        } else if (colNum === 12 + daysInMonth) { // H
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7E22CE' } };
            cell.font = { name: 'Segoe UI', size: 8.5, bold: true, color: { argb: 'FFFFFFFF' } };
        }
    });

    // Column widths
    sheet.getColumn(1).width = 5;
    sheet.getColumn(2).width = 13;
    sheet.getColumn(3).width = 24;
    sheet.getColumn(4).width = 16;
    sheet.getColumn(5).width = 18;
    for (let i = 6; i <= 5 + daysInMonth; i++) sheet.getColumn(i).width = 4.5;
    for (let i = 6 + daysInMonth; i <= 5 + daysInMonth + 7; i++) sheet.getColumn(i).width = 9;
    if (includeOt) sheet.getColumn(totalCols).width = 10;

    const firstDayCol = getColLetter(6);
    const lastDayCol = getColLetter(5 + daysInMonth);

    // 4. Data Rows (Starting Row 8)
    if (employees.length === 0) {
        const emptyRow = sheet.getRow(8);
        emptyRow.height = 30;
        safeMerge(sheet, 8, 1, 8, totalCols);
        const emptyCell = sheet.getCell('A8');
        emptyCell.value = 'No active employee attendance records found for this period.';
        emptyCell.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF94A3B8' } };
        emptyCell.alignment = { horizontal: 'center', vertical: 'middle' };
    }

    employees.forEach((emp, idx) => {
        const rowNum = 8 + idx;
        const row = sheet.getRow(rowNum);
        row.height = 20;

        let otHoursTotal = 0;
        const rowValues = [
            idx + 1,
            emp.empCode,
            `${emp.firstName} ${emp.lastName || ''}`.trim(),
            emp.department || '—',
            emp.designation || '—'
        ];

        for (let day = 1; day <= daysInMonth; day++) {
            const entry = matrix[emp.id]?.[day];
            const rawStatus = entry?.status;
            const isSunday = new Date(y, m - 1, day).getDay() === 0;

            let short = '·';
            if (rawStatus && STATUS_SHORTHAND[rawStatus]) {
                short = STATUS_SHORTHAND[rawStatus];
            } else if (isSunday) {
                short = 'WO';
            }

            rowValues.push(short);
            if (entry?.ot) otHoursTotal += entry.ot;
        }

        // Native Excel formulas for summaries
        rowValues.push(daysInMonth);
        rowValues.push({ formula: `COUNTIF(${firstDayCol}${rowNum}:${lastDayCol}${rowNum}, "P")` });
        rowValues.push({ formula: `COUNTIF(${firstDayCol}${rowNum}:${lastDayCol}${rowNum}, "A")` });
        rowValues.push({ formula: `COUNTIF(${firstDayCol}${rowNum}:${lastDayCol}${rowNum}, "HD")` });
        rowValues.push({ formula: `COUNTIF(${firstDayCol}${rowNum}:${lastDayCol}${rowNum}, "L")` });
        rowValues.push({ formula: `COUNTIF(${firstDayCol}${rowNum}:${lastDayCol}${rowNum}, "WO")` });
        rowValues.push({ formula: `COUNTIF(${firstDayCol}${rowNum}:${lastDayCol}${rowNum}, "H")` });
        if (includeOt) rowValues.push(otHoursTotal > 0 ? otHoursTotal : '—');

        row.values = rowValues;

        row.eachCell((cell, colNum) => {
            cell.font = { name: 'Segoe UI', size: 8.5 };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
            };

            if (colNum === 1) {
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.font = { name: 'Segoe UI', size: 8.5, color: { argb: 'FF64748B' } };
            } else if (colNum === 2) {
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF0284C7' } };
            } else if (colNum === 3) {
                cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
                cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
            } else if (colNum === 4 || colNum === 5) {
                cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
                cell.font = { name: 'Segoe UI', size: 8.5, color: { argb: 'FF334155' } };
            } else if (colNum >= 6 && colNum <= 5 + daysInMonth) {
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                const val = cell.value;
                if (STATUS_COLORS[val]) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${STATUS_COLORS[val].fill}` } };
                    cell.font = { name: 'Segoe UI', size: 8.5, bold: true, color: { argb: `FF${STATUS_COLORS[val].font}` } };
                } else {
                    const dayNum = colNum - 5;
                    const isSunday = new Date(y, m - 1, dayNum).getDay() === 0;
                    if (isSunday) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
                    }
                    cell.font = { name: 'Segoe UI', size: 8, color: { argb: 'FFCBD5E1' } };
                }
            } else {
                // Summary columns
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
                cell.font = { name: 'Segoe UI', size: 9, bold: true };

                if (colNum === 7 + daysInMonth) { // P
                    cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF15803D' } };
                } else if (colNum === 8 + daysInMonth) { // A
                    cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FFB91C1C' } };
                } else if (colNum === 9 + daysInMonth) { // 1/2
                    cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FFB45309' } };
                } else if (colNum === 10 + daysInMonth) { // L
                    cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF0369A1' } };
                } else if (colNum === 11 + daysInMonth) { // WO
                    cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF475569' } };
                } else if (colNum === 12 + daysInMonth) { // H
                    cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF7E22CE' } };
                } else if (includeOt && colNum === totalCols) {
                    cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF0284C7' } };
                }
            }
        });
    });

    // 5. Grand Totals Row
    const totalRowNum = 8 + employees.length;
    const totRow = sheet.getRow(totalRowNum);
    totRow.height = 24;

    const totRowValues = [
        'GRAND TOTALS (DAILY PRESENT):',
        '',
        '',
        '',
        ''
    ];

    for (let day = 1; day <= daysInMonth; day++) {
        const colLet = getColLetter(5 + day);
        totRowValues.push({ formula: `COUNTIF(${colLet}8:${colLet}${totalRowNum - 1}, "P")` });
    }

    // Summary totals formulas
    totRowValues.push(employees.length * daysInMonth);
    for (let col = 7 + daysInMonth; col <= totalCols; col++) {
        const colLet = getColLetter(col);
        totRowValues.push({ formula: `SUM(${colLet}8:${colLet}${totalRowNum - 1})` });
    }

    totRow.values = totRowValues;
    safeMerge(sheet, totalRowNum, 1, totalRowNum, 5);

    totRow.eachCell((cell, colNum) => {
        cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF0F172A' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        cell.border = {
            top: { style: 'medium', color: { argb: 'FF0F172A' } },
            bottom: { style: 'double', color: { argb: 'FF0F172A' } },
            left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };

        if (colNum === 7 + daysInMonth) { // P total
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
            cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF15803D' } };
        } else if (colNum === 8 + daysInMonth) { // A total
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
            cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FFB91C1C' } };
        } else if (colNum === 9 + daysInMonth) { // 1/2 total
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
            cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FFB45309' } };
        } else if (colNum === 10 + daysInMonth) { // L total
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };
            cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF0369A1' } };
        } else if (colNum === 11 + daysInMonth) { // WO total
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
            cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF475569' } };
        } else if (colNum === 12 + daysInMonth) { // H total
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3E8FF' } };
            cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF7E22CE' } };
        } else if (includeOt && colNum === totalCols) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };
            cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF0284C7' } };
        }
    });

    sheet.getCell(totalRowNum, 1).alignment = { horizontal: 'right', vertical: 'middle' };

    // 6. Formal Signatures Section (Matching PDF Signature Block)
    const sigLineRow = totalRowNum + 3;
    const sigTextRow = sigLineRow + 1;
    const [attSig1, attSig2, attSig3] = getSignatureRanges(totalCols);

    // Prepared By (Time Office)
    safeMerge(sheet, sigLineRow, attSig1.start, sigLineRow, attSig1.end);
    for (let c = attSig1.start; c <= attSig1.end; c++) sheet.getCell(sigLineRow, c).border = { top: { style: 'thin', color: { argb: 'FF475569' } } };
    safeMerge(sheet, sigTextRow, attSig1.start, sigTextRow, attSig1.end);
    const sig1 = sheet.getCell(sigTextRow, attSig1.start);
    sig1.value = 'PREPARED BY (TIME OFFICE)';
    sig1.font = { name: 'Segoe UI', size: 8.5, bold: true, color: { argb: 'FF334155' } };
    sig1.alignment = { horizontal: 'center', vertical: 'middle' };

    // Checked By (HR / Accounts)
    safeMerge(sheet, sigLineRow, attSig2.start, sigLineRow, attSig2.end);
    for (let c = attSig2.start; c <= attSig2.end; c++) sheet.getCell(sigLineRow, c).border = { top: { style: 'thin', color: { argb: 'FF475569' } } };
    safeMerge(sheet, sigTextRow, attSig2.start, sigTextRow, attSig2.end);
    const sig2 = sheet.getCell(sigTextRow, attSig2.start);
    sig2.value = 'CHECKED BY (HR / ACCOUNTS)';
    sig2.font = { name: 'Segoe UI', size: 8.5, bold: true, color: { argb: 'FF334155' } };
    sig2.alignment = { horizontal: 'center', vertical: 'middle' };

    // Factory Manager / Authorized Signatory
    safeMerge(sheet, sigLineRow, attSig3.start, sigLineRow, attSig3.end);
    for (let c = attSig3.start; c <= attSig3.end; c++) sheet.getCell(sigLineRow, c).border = { top: { style: 'thin', color: { argb: 'FF475569' } } };
    safeMerge(sheet, sigTextRow, attSig3.start, sigTextRow, attSig3.end);
    const sig3 = sheet.getCell(sigTextRow, attSig3.start);
    sig3.value = 'AUTHORIZED SIGNATORY / FACTORY MANAGER';
    sig3.font = { name: 'Segoe UI', size: 8.5, bold: true, color: { argb: 'FF334155' } };
    sig3.alignment = { horizontal: 'center', vertical: 'middle' };

    // 7. Statutory Note Footer
    const footerRow = sigTextRow + 2;
    safeMerge(sheet, footerRow, 1, footerRow, totalCols);
    const footerCell = sheet.getCell(footerRow, 1);
    footerCell.value = 'This is a certified digital attendance register under Rule 26 of the Factories Act. Generated via KS Engineering Works ERP software.';
    footerCell.font = { name: 'Segoe UI', size: 8, italic: true, color: { argb: 'FF94A3B8' } };
    footerCell.alignment = { horizontal: 'center', vertical: 'middle' };
    footerCell.border = { top: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
    sheet.getRow(footerRow).height = 18;

    return workbook.xlsx.writeBuffer();
};

/**
 * =========================================================================
 * 2. ATTENDANCE MUSTER EXPORT (LANDSCAPE PDF VIA PUPPETEER)
 * =========================================================================
 */
const generateAttendanceMusterPdf = async ({ firmId, branchId, month, year, options = {} }) => {
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);
    const daysInMonth = new Date(y, m, 0).getDate();
    const monthName = `${MONTH_NAMES[m - 1]} ${y}`;
    const firm = await getFirmInfo(firmId);

    // Active employees
    let empQuery = db('employees as e')
        .whereNull('e.deleted_at')
        .where('e.is_active', true)
        .where('e.status', 'ACTIVE')
        .select('e.id', 'e.emp_code as empCode', 'e.first_name as firstName', 'e.last_name as lastName', 'e.department', 'e.designation')
        .orderBy('e.first_name', 'asc');

    if (firmId && firmId !== 'all') empQuery = empQuery.where('e.firm_id', firmId);
    if (branchId) empQuery = empQuery.where('e.branch_id', branchId);
    const employees = await empQuery;

    // Monthly attendance logs
    let attQuery = db('employee_attendance as ea')
        .whereNull('ea.deleted_at')
        .where('ea.is_active', true)
        .whereRaw('EXTRACT(MONTH FROM ea.attendance_date) = ?', [m])
        .whereRaw('EXTRACT(YEAR FROM ea.attendance_date) = ?', [y])
        .select(
            'ea.employee_id as employeeId',
            db.raw("TO_CHAR(ea.attendance_date, 'YYYY-MM-DD') as \"attendanceDate\""),
            'ea.status',
            'ea.overtime_hours as overtimeHours'
        );

    if (firmId && firmId !== 'all') attQuery = attQuery.where('ea.firm_id', firmId);
    const logs = await attQuery;

    const matrix = {};
    const summaryMap = {};
    const dailyPresentCount = {};
    const totalStats = { p: 0, a: 0, hd: 0, l: 0, wo: 0, h: 0, ot: 0 };

    for (let d = 1; d <= daysInMonth; d++) dailyPresentCount[d] = 0;

    for (const log of logs) {
        const empId = log.employeeId;
        const d = parseInt(String(log.attendanceDate).split('-')[2], 10);
        if (!matrix[empId]) matrix[empId] = {};
        matrix[empId][d] = { status: log.status, ot: parseFloat(log.overtimeHours || 0) };

        if (!summaryMap[empId]) summaryMap[empId] = { p: 0, a: 0, hd: 0, l: 0, wo: 0, h: 0, ot: 0 };
        const st = summaryMap[empId];
        if (log.status === 'PRESENT') { st.p++; dailyPresentCount[d]++; totalStats.p++; }
        else if (log.status === 'ABSENT') { st.a++; totalStats.a++; }
        else if (log.status === 'HALF_DAY') { st.hd++; dailyPresentCount[d] += 0.5; totalStats.hd++; }
        else if (log.status === 'LEAVE') { st.l++; totalStats.l++; }
        else if (log.status === 'WEEKLY_OFF') { st.wo++; totalStats.wo++; }
        else if (log.status === 'HOLIDAY') { st.h++; totalStats.h++; }
        st.ot += parseFloat(log.overtimeHours || 0);
        totalStats.ot += parseFloat(log.overtimeHours || 0);
    }

    const templatePath = path.join(`${projectPaths.ROOT_DIR}/templates/attendance/`, 'attendance-muster-template.ejs');
    const filledHtml = await ejs.renderFile(templatePath, {
        firm,
        monthName,
        daysInMonth,
        employees,
        matrix,
        summaryMap,
        dailyPresentCount,
        totalStats,
        includeOt: options.includeOt !== false && options.includeOt !== 'false',
        statusShorthand: STATUS_SHORTHAND,
        generatedAt: new Date().toLocaleDateString('en-IN')
    });

    const browser = await getBrowser(puppeteer);
    let page;
    try {
        page = await browser.newPage();
        await page.setContent(filledHtml, { waitUntil: 'load' });
        const pdf = await page.pdf({
            format: 'A3',
            landscape: true,
            printBackground: true,
            margin: { top: '8mm', bottom: '8mm', left: '8mm', right: '8mm' }
        });
        return Buffer.from(pdf);
    } finally {
        if (page) await page.close().catch(() => {});
    }
};

/**
 * =========================================================================
 * 3. SALARY MUSTER EXPORT (EXCEL - FORM T & BANK TRANSFER)
 * =========================================================================
 */
const generateSalaryMusterExcel = async ({ firmId, month, year, type = 'full' }) => {
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);
    const monthName = `${MONTH_NAMES[m - 1]} ${y}`;
    const firm = await getFirmInfo(firmId);

    let query = db('employee_salary_slips as ess')
        .join('employees as e', 'ess.employee_id', 'e.id')
        .whereNull('ess.deleted_at')
        .where('ess.is_active', true)
        .where('ess.month', m)
        .where('ess.year', y);

    if (firmId && firmId !== 'all') query = query.where('ess.firm_id', firmId);

    const slips = await query.select(
        'ess.*',
        'e.emp_code as empCode',
        'e.first_name as firstName',
        'e.last_name as lastName',
        'e.department',
        'e.designation',
        'e.bank_name as bankName',
        'e.account_number as accountNumber',
        'e.ifsc_code as ifscCode',
        'e.pan_number as panNumber',
        'e.uan_number as uanNumber'
    ).orderBy('e.first_name', 'asc');

    const totalNetDisbursement = slips.reduce((sum, s) => sum + parseFloat(s.net_salary || s.netSalary || 0), 0);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'KS Engineering Works ERP';
    workbook.created = new Date();

    // =========================================================================
    // CASE A: BANK DISBURSEMENT EXPORT (NEFT / RTGS / NACH BATCH)
    // =========================================================================
    if (type === 'bank') {
        const totalCols = 8;
        const sheet = workbook.addWorksheet(`Bank Transfer - ${MONTH_NAMES[m - 1]}`, {
            views: [{ state: 'frozen', xSplit: 2, ySplit: 6, showGridLines: true }],
            pageSetup: {
                orientation: 'landscape',
                paperSize: 9, // A4
                fitToPage: true,
                fitToWidth: 1,
                fitToHeight: 0,
                margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 }
            }
        });

        // 1. Letterhead Header Block - Clean Corporate White
        safeMerge(sheet, 1, 1, 1, totalCols);
        const titleCell = sheet.getCell('A1');
        titleCell.value = `${(firm.firm_name || 'KS ENGINEERING WORKS').toUpperCase()} — SALARY DISBURSEMENT (NEFT/RTGS)`;
        titleCell.font = { name: 'Segoe UI', size: 15, bold: true, color: { argb: 'FF0F172A' } };
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
        sheet.getRow(1).height = 32;

        safeMerge(sheet, 2, 1, 2, totalCols);
        const metaRowCell = sheet.getCell('A2');
        const metaParts = [
            firm.branch_name,
            firm.gstin ? `GSTIN: ${firm.gstin}` : '',
            firm.phone ? `Phone: ${firm.phone}` : '',
            firm.email ? `Email: ${firm.email}` : ''
        ].filter(Boolean);
        metaRowCell.value = metaParts.join('   •   ');
        metaRowCell.font = { name: 'Segoe UI', size: 9, color: { argb: 'FF475569' } };
        metaRowCell.alignment = { horizontal: 'center', vertical: 'middle' };
        metaRowCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
        sheet.getRow(2).height = 18;

        safeMerge(sheet, 3, 1, 3, totalCols);
        const formCell = sheet.getCell('A3');
        formCell.value = 'BANK TRANSFER ADVICE & NEFT / RTGS PAYMENT SCHEDULE';
        formCell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FF0284C7' } };
        formCell.alignment = { horizontal: 'center', vertical: 'middle' };
        formCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F9FF' } };
        sheet.getRow(3).height = 24;

        safeMerge(sheet, 4, 1, 4, totalCols);
        const subCell = sheet.getCell('A4');
        subCell.value = `Wage Period: ${monthName.toUpperCase()}   •   Beneficiaries: ${slips.length} Staff   •   Total Disbursement: ₹${totalNetDisbursement.toLocaleString('en-IN', { minimumFractionDigits: 2 })}   •   Generated: ${new Date().toLocaleDateString('en-IN')}`;
        subCell.font = { name: 'Segoe UI', size: 8.5, italic: true, color: { argb: 'FF64748B' } };
        subCell.alignment = { horizontal: 'center', vertical: 'middle' };
        subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
        sheet.getRow(4).height = 20;

        for (let c = 1; c <= totalCols; c++) {
            sheet.getCell(4, c).border = { bottom: { style: 'medium', color: { argb: 'FF0284C7' } } };
        }

        sheet.getRow(5).height = 8; // Spacer

        // 2. Table Headers (Row 6)
        const headers = [
            '#',
            'Beneficiary Name',
            'Bank Account Number',
            'IFSC Code',
            'Bank Name',
            'Net Disbursement Amount (₹)',
            'Employee Code',
            'Narration / Remarks'
        ];
        const headerRow = sheet.getRow(6);
        headerRow.values = headers;
        headerRow.height = 26;

        headerRow.eachCell((cell, colNum) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0284C7' } };
            cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
            cell.alignment = { horizontal: colNum === 6 ? 'right' : (colNum <= 4 ? 'center' : 'left'), vertical: 'middle' };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FF64748B' } },
                left: { style: 'thin', color: { argb: 'FF64748B' } },
                bottom: { style: 'medium', color: { argb: 'FF0369A1' } },
                right: { style: 'thin', color: { argb: 'FF64748B' } }
            };
        });

        sheet.getColumn(1).width = 5;
        sheet.getColumn(2).width = 24;
        sheet.getColumn(3).width = 22;
        sheet.getColumn(4).width = 14;
        sheet.getColumn(5).width = 20;
        sheet.getColumn(6).width = 22;
        sheet.getColumn(7).width = 14;
        sheet.getColumn(8).width = 26;

        // 3. Data Rows (Starting Row 7)
        slips.forEach((s, idx) => {
            const rowNum = 7 + idx;
            const row = sheet.getRow(rowNum);
            const net = parseFloat(s.net_salary || s.netSalary || 0);

            row.values = [
                idx + 1,
                `${s.firstName} ${s.lastName || ''}`.trim(),
                String(s.accountNumber || '—'),
                s.ifscCode || '—',
                s.bankName || '—',
                net,
                s.empCode,
                `Sal ${MONTH_NAMES[m - 1].substring(0, 3)} ${y}`
            ];

            row.height = 20;
            row.eachCell((cell, colNum) => {
                cell.font = { name: 'Segoe UI', size: 8.5 };
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
                };

                if (colNum === 1) {
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    cell.font = { name: 'Segoe UI', size: 8.5, color: { argb: 'FF64748B' } };
                } else if (colNum === 2) {
                    cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
                    cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
                } else if (colNum === 3) {
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    cell.numFmt = '@'; // force string
                    cell.font = { name: 'Segoe UI', size: 9, color: { argb: 'FF334155' } };
                } else if (colNum === 4 || colNum === 7) {
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    cell.font = { name: 'Segoe UI', size: 9, bold: colNum === 7, color: { argb: colNum === 7 ? 'FF0284C7' : 'FF334155' } };
                } else if (colNum === 5) {
                    cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
                    cell.font = { name: 'Segoe UI', size: 8.5, color: { argb: 'FF334155' } };
                } else if (colNum === 6) {
                    cell.alignment = { horizontal: 'right', vertical: 'middle' };
                    cell.numFmt = '₹#,##0.00';
                    cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF15803D' } };
                } else {
                    cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
                    cell.font = { name: 'Segoe UI', size: 8.5, color: { argb: 'FF64748B' } };
                }
            });
        });

        // 4. Totals Row
        const totRowNum = 7 + slips.length;
        const totRow = sheet.getRow(totRowNum);
        totRow.height = 24;
        safeMerge(sheet, totRowNum, 1, totRowNum, 5);
        totRow.getCell(1).value = 'TOTAL DISBURSEMENT:';
        totRow.getCell(1).font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
        totRow.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' };

        totRow.getCell(6).value = { formula: `SUM(F7:F${totRowNum - 1})` };
        totRow.getCell(6).font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FF15803D' } };
        totRow.getCell(6).numFmt = '₹#,##0.00';
        totRow.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };

        totRow.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
            cell.border = {
                top: { style: 'medium', color: { argb: 'FF0F172A' } },
                bottom: { style: 'double', color: { argb: 'FF0F172A' } },
                left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
            };
        });
        totRow.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };

        // 5. Signatures Section
        const sigLineRow = totRowNum + 3;
        const sigTextRow = sigLineRow + 1;
        const [bankSig1, bankSig2, bankSig3] = getSignatureRanges(totalCols);

        // Prepared By (Accounts)
        safeMerge(sheet, sigLineRow, bankSig1.start, sigLineRow, bankSig1.end);
        for (let c = bankSig1.start; c <= bankSig1.end; c++) sheet.getCell(sigLineRow, c).border = { top: { style: 'thin', color: { argb: 'FF475569' } } };
        safeMerge(sheet, sigTextRow, bankSig1.start, sigTextRow, bankSig1.end);
        const bSig1 = sheet.getCell(sigTextRow, bankSig1.start);
        bSig1.value = 'PREPARED BY (ACCOUNTS)';
        bSig1.font = { name: 'Segoe UI', size: 8.5, bold: true, color: { argb: 'FF334155' } };
        bSig1.alignment = { horizontal: 'center', vertical: 'middle' };

        // Verified By (Finance Head)
        safeMerge(sheet, sigLineRow, bankSig2.start, sigLineRow, bankSig2.end);
        for (let c = bankSig2.start; c <= bankSig2.end; c++) sheet.getCell(sigLineRow, c).border = { top: { style: 'thin', color: { argb: 'FF475569' } } };
        safeMerge(sheet, sigTextRow, bankSig2.start, sigTextRow, bankSig2.end);
        const bSig2 = sheet.getCell(sigTextRow, bankSig2.start);
        bSig2.value = 'VERIFIED BY (FINANCE HEAD)';
        bSig2.font = { name: 'Segoe UI', size: 8.5, bold: true, color: { argb: 'FF334155' } };
        bSig2.alignment = { horizontal: 'center', vertical: 'middle' };

        // Authorized Bank Signatory
        safeMerge(sheet, sigLineRow, bankSig3.start, sigLineRow, bankSig3.end);
        for (let c = bankSig3.start; c <= bankSig3.end; c++) sheet.getCell(sigLineRow, c).border = { top: { style: 'thin', color: { argb: 'FF475569' } } };
        safeMerge(sheet, sigTextRow, bankSig3.start, sigTextRow, bankSig3.end);
        const bSig3 = sheet.getCell(sigTextRow, bankSig3.start);
        bSig3.value = 'AUTHORIZED BANK SIGNATORY';
        bSig3.font = { name: 'Segoe UI', size: 8.5, bold: true, color: { argb: 'FF334155' } };
        bSig3.alignment = { horizontal: 'center', vertical: 'middle' };

        // 6. Confidential Note
        const footerRow = sigTextRow + 2;
        safeMerge(sheet, footerRow, 1, footerRow, totalCols);
        const footerCell = sheet.getCell(footerRow, 1);
        footerCell.value = 'Confidential Bank Transfer Register. Generated via KS Engineering Works ERP software.';
        footerCell.font = { name: 'Segoe UI', size: 8, italic: true, color: { argb: 'FF94A3B8' } };
        footerCell.alignment = { horizontal: 'center', vertical: 'middle' };
        footerCell.border = { top: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
        sheet.getRow(footerRow).height = 18;

        return workbook.xlsx.writeBuffer();
    }

    // =========================================================================
    // CASE B: FULL WAGE REGISTER (FORM T) - STATUTORY SALARY MUSTER
    // =========================================================================
    const slipIds = slips.map(s => s.id);
    let details = [];
    if (slipIds.length > 0) {
        details = await db('salary_slip_details')
            .whereIn('salary_slip_id', slipIds)
            .whereNull('deleted_at')
            .orderBy('sort_order', 'asc');
    }

    const earningHeads = [...new Set(details.filter(d => d.component_type === 'EARNING').map(d => d.component_name))];
    const deductionHeads = [...new Set(details.filter(d => d.component_type === 'DEDUCTION').map(d => d.component_name))];

    const compMap = {};
    for (const d of details) {
        if (!compMap[d.salary_slip_id]) compMap[d.salary_slip_id] = {};
        compMap[d.salary_slip_id][d.component_name] = parseFloat(d.amount || 0);
    }

    // Column Mapping:
    // 1: S.No
    // 2: Emp Code
    // 3: Employee Name
    // 4: Designation
    // 5: Department
    // 6: Bank A/C No.
    // 7: Working Days
    // 8: Present Days
    // 9: OT Hours
    // 10 .. (9 + earningHeads.length): Earning components
    // (10 + earningHeads.length): OT Pay
    // (11 + earningHeads.length): Gross Earnings (A)
    // Next deductionHeads.length: Deduction components
    // Then: Total Deductions (B)
    // Then: Net Salary Payable (A - B)
    // Then: Status
    // Then: Payment Mode
    // Then: Acknowledgment / Signature
    const fixedHeaders = ['#', 'Code', 'Employee Name', 'Designation', 'Department', 'Bank A/C No.', 'Days', 'Pres', 'OT(h)'];

    const earnStartCol = 10;
    const otPayCol = earnStartCol + earningHeads.length;
    const grossCol = otPayCol + 1;

    const dedStartCol = grossCol + 1;
    const dedEndCol = dedStartCol + deductionHeads.length - 1;
    const totDedCol = dedStartCol + deductionHeads.length;

    const netCol = totDedCol + 1;
    const statusCol = netCol + 1;
    const modeCol = statusCol + 1;
    const signCol = modeCol + 1;
    const totalCols = signCol;

    const sheet = workbook.addWorksheet(`Wage Register - ${MONTH_NAMES[m - 1]}`, {
        views: [{ state: 'frozen', xSplit: 3, ySplit: 7, showGridLines: true }],
        pageSetup: {
            orientation: 'landscape',
            paperSize: 8, // A3
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 }
        }
    });

    // 1. Company Letterhead Header Block (Rows 1 to 4) - CLEAN CORPORATE WHITE
    // Row 1: Company Title
    safeMerge(sheet, 1, 1, 1, totalCols);
    const titleCell = sheet.getCell('A1');
    titleCell.value = (firm.firm_name || 'KS ENGINEERING WORKS').toUpperCase();
    titleCell.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FF0F172A' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).height = 32;

    // Row 2: Company Meta
    safeMerge(sheet, 2, 1, 2, totalCols);
    const metaRowCell = sheet.getCell('A2');
    const metaParts = [
        firm.branch_name,
        firm.gstin ? `GSTIN: ${firm.gstin}` : '',
        firm.phone ? `Phone: ${firm.phone}` : '',
        firm.email ? `Email: ${firm.email}` : ''
    ].filter(Boolean);
    metaRowCell.value = metaParts.join('   •   ');
    metaRowCell.font = { name: 'Segoe UI', size: 9, color: { argb: 'FF475569' } };
    metaRowCell.alignment = { horizontal: 'center', vertical: 'middle' };
    metaRowCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
    sheet.getRow(2).height = 18;

    // Row 3: Statutory Form Title (Form T)
    safeMerge(sheet, 3, 1, 3, totalCols);
    const formCell = sheet.getCell('A3');
    formCell.value = 'FORM T — WAGE REGISTER / SALARY MUSTER (COMBINED STATUTORY REGISTER)';
    formCell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FF15803D' } };
    formCell.alignment = { horizontal: 'center', vertical: 'middle' };
    formCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
    sheet.getRow(3).height = 24;

    // Row 4: Period & Headcount Metadata
    safeMerge(sheet, 4, 1, 4, totalCols);
    const periodCell = sheet.getCell('A4');
    periodCell.value = `Wage Period: ${monthName.toUpperCase()}   •   Headcount: ${slips.length} Staff   •   Total Net Disbursement: ₹${totalNetDisbursement.toLocaleString('en-IN', { minimumFractionDigits: 2 })}   •   Generated: ${new Date().toLocaleDateString('en-IN')}`;
    periodCell.font = { name: 'Segoe UI', size: 8.5, italic: true, color: { argb: 'FF64748B' } };
    periodCell.alignment = { horizontal: 'center', vertical: 'middle' };
    periodCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
    sheet.getRow(4).height = 20;

    // Bottom divider border on Row 4
    for (let c = 1; c <= totalCols; c++) {
        sheet.getCell(4, c).border = { bottom: { style: 'medium', color: { argb: 'FF15803D' } } };
    }

    sheet.getRow(5).height = 8; // Spacer

    // 2. Super-Headers (Row 6)
    // 1. Employee Particulars (A..F)
    safeMerge(sheet, 6, 1, 6, 6);
    const shEmp = sheet.getCell('A6');
    shEmp.value = 'EMPLOYEE PARTICULARS';
    shEmp.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    shEmp.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    shEmp.alignment = { horizontal: 'center', vertical: 'middle' };

    // 2. Attendance Factors (G..I)
    safeMerge(sheet, 6, 7, 6, 9);
    const shAtt = sheet.getCell('G6');
    shAtt.value = 'ATTENDANCE';
    shAtt.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
    shAtt.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    shAtt.alignment = { horizontal: 'center', vertical: 'middle' };

    // 3. Earnings Breakdown
    if (grossCol > earnStartCol) {
        safeMerge(sheet, 6, earnStartCol, 6, grossCol);
    }
    const shEarn = sheet.getCell(6, earnStartCol);
    shEarn.value = 'EARNINGS BREAKDOWN (₹)';
    shEarn.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF15803D' } };
    shEarn.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    shEarn.alignment = { horizontal: 'center', vertical: 'middle' };

    // 4. Deductions Breakdown
    if (totDedCol > dedStartCol) {
        safeMerge(sheet, 6, dedStartCol, 6, totDedCol);
    }
    const shDed = sheet.getCell(6, dedStartCol);
    shDed.value = 'DEDUCTIONS BREAKDOWN (₹)';
    shDed.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB91C1C' } };
    shDed.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    shDed.alignment = { horizontal: 'center', vertical: 'middle' };

    // 5. Net Payable
    const shNet = sheet.getCell(6, netCol);
    shNet.value = 'NET PAYABLE';
    shNet.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0284C7' } };
    shNet.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    shNet.alignment = { horizontal: 'center', vertical: 'middle' };

    // 6. Settlement
    if (signCol > statusCol) {
        safeMerge(sheet, 6, statusCol, 6, signCol);
    }
    const shSet = sheet.getCell(6, statusCol);
    shSet.value = 'PAYMENT SETTLEMENT';
    shSet.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    shSet.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    shSet.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(6).height = 22;

    // 3. Sub-Headers (Row 7)
    const headers = [
        ...fixedHeaders,
        ...earningHeads,
        'OT Pay',
        'Gross (A)',
        ...deductionHeads,
        'Total Ded (B)',
        'Net Pay (A-B)',
        'Status',
        'Payment Mode',
        'Bank Ref / Signature'
    ];

    const headerRow = sheet.getRow(7);
    headerRow.values = headers;
    headerRow.height = 26;

    headerRow.eachCell((cell, colNum) => {
        cell.font = { name: 'Segoe UI', size: 8.5, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { horizontal: colNum >= earnStartCol && colNum <= netCol ? 'right' : 'center', vertical: 'middle' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
        cell.border = {
            top: { style: 'thin', color: { argb: 'FF64748B' } },
            left: { style: 'thin', color: { argb: 'FF64748B' } },
            bottom: { style: 'medium', color: { argb: 'FF15803D' } },
            right: { style: 'thin', color: { argb: 'FF64748B' } }
        };

        if (colNum === grossCol) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
            cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF15803D' } };
        } else if (colNum === totDedCol) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
            cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FFB91C1C' } };
        } else if (colNum === netCol) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };
            cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF0284C7' } };
        }
    });

    // Column widths
    sheet.getColumn(1).width = 5;
    sheet.getColumn(2).width = 12;
    sheet.getColumn(3).width = 24;
    sheet.getColumn(4).width = 18;
    sheet.getColumn(5).width = 16;
    sheet.getColumn(6).width = 18;
    sheet.getColumn(7).width = 8;
    sheet.getColumn(8).width = 8;
    sheet.getColumn(9).width = 8;

    let p = earnStartCol;
    earningHeads.forEach(() => { sheet.getColumn(p++).width = 14; });
    sheet.getColumn(otPayCol).width = 12; // OT Pay
    sheet.getColumn(grossCol).width = 18; // Gross Pay
    deductionHeads.forEach(() => { sheet.getColumn(p++).width = 14; });
    sheet.getColumn(totDedCol).width = 18; // Total Ded
    sheet.getColumn(netCol).width = 20; // Net Pay
    sheet.getColumn(statusCol).width = 12; // Status
    sheet.getColumn(modeCol).width = 14; // Mode
    sheet.getColumn(signCol).width = 24; // Sign

    // 4. Data Rows (Starting Row 8)
    if (slips.length === 0) {
        const emptyRow = sheet.getRow(8);
        emptyRow.height = 30;
        safeMerge(sheet, 8, 1, 8, totalCols);
        const emptyCell = sheet.getCell('A8');
        emptyCell.value = 'No payroll salary slip records found for this period.';
        emptyCell.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF94A3B8' } };
        emptyCell.alignment = { horizontal: 'center', vertical: 'middle' };
    }

    slips.forEach((s, idx) => {
        const rowNum = 8 + idx;
        const row = sheet.getRow(rowNum);
        row.height = 20;

        const rowValues = [
            idx + 1,
            s.empCode,
            `${s.firstName} ${s.lastName || ''}`.trim(),
            s.designation || '—',
            s.department || '—',
            String(s.accountNumber || '—'),
            parseFloat(s.total_working_days || s.totalWorkingDays || 26),
            parseFloat(s.present_days || s.presentDays || 0),
            parseFloat(s.overtime_hours || s.overtimeHours || 0)
        ];

        // Earning head amounts
        earningHeads.forEach(eh => rowValues.push(compMap[s.id]?.[eh] || 0));

        // OT Pay amount
        rowValues.push(parseFloat(s.overtime_pay || s.overtimePay || 0));

        // Gross Earnings (A) formula: =SUM(earning cols + OT Pay)
        rowValues.push({
            formula: `SUM(${getColLetter(earnStartCol)}${rowNum}:${getColLetter(otPayCol)}${rowNum})`
        });

        // Deduction head amounts
        deductionHeads.forEach(dh => rowValues.push(compMap[s.id]?.[dh] || 0));

        // Total Deductions (B) formula: =SUM(deduction cols)
        if (deductionHeads.length > 0) {
            rowValues.push({
                formula: `SUM(${getColLetter(dedStartCol)}${rowNum}:${getColLetter(dedEndCol)}${rowNum})`
            });
        } else {
            rowValues.push(0);
        }

        // Net Salary Payable (A - B) formula: =Gross - Total Ded
        rowValues.push({
            formula: `${getColLetter(grossCol)}${rowNum}-${getColLetter(totDedCol)}${rowNum}`
        });

        rowValues.push(s.status || 'GENERATED');
        rowValues.push(s.payment_mode || 'BANK_TRANSFER');
        rowValues.push(''); // Sign

        row.values = rowValues;

        row.eachCell((cell, colNum) => {
            cell.font = { name: 'Segoe UI', size: 8.5 };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
            };

            if (colNum === 1) {
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.font = { name: 'Segoe UI', size: 8.5, color: { argb: 'FF64748B' } };
            } else if (colNum === 2) {
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF0284C7' } };
            } else if (colNum === 3) {
                cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
                cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
            } else if (colNum === 4 || colNum === 5) {
                cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
                cell.font = { name: 'Segoe UI', size: 8.5, color: { argb: 'FF334155' } };
            } else if (colNum === 6) {
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.numFmt = '@';
                cell.font = { name: 'Segoe UI', size: 8.5, color: { argb: 'FF475569' } };
            } else if (colNum === 7 || colNum === 9) {
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.font = { name: 'Segoe UI', size: 8.5, color: { argb: 'FF334155' } };
            } else if (colNum === 8) {
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF15803D' } };
            } else if (colNum >= earnStartCol && colNum <= netCol) {
                cell.numFmt = '₹#,##0.00';
                cell.alignment = { horizontal: 'right', vertical: 'middle' };

                if (colNum === grossCol) {
                    cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF15803D' } };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
                } else if (colNum === totDedCol) {
                    cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FFB91C1C' } };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } };
                } else if (colNum === netCol) {
                    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF0284C7' } };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };
                } else {
                    cell.font = { name: 'Segoe UI', size: 8.5, color: { argb: 'FF0F172A' } };
                }
            } else if (colNum === statusCol) {
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                const isPaid = cell.value === 'PAID';
                cell.font = { name: 'Segoe UI', size: 8, bold: true, color: { argb: isPaid ? 'FF15803D' : 'FF0284C7' } };
            } else if (colNum === modeCol) {
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.font = { name: 'Segoe UI', size: 8, color: { argb: 'FF475569' } };
            } else {
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            }
        });
    });

    // 5. Grand Totals Row
    const totalRowNum = 8 + slips.length;
    const totRow = sheet.getRow(totalRowNum);
    totRow.height = 24;

    const totRowValues = [
        'GRAND TOTALS:',
        '',
        '',
        '',
        '',
        '',
        '—',
        '—',
        '—'
    ];

    // Formulas for Earnings
    for (let col = earnStartCol; col <= otPayCol; col++) {
        const colLet = getColLetter(col);
        totRowValues.push({ formula: `SUM(${colLet}8:${colLet}${totalRowNum - 1})` });
    }
    // Gross (A) total
    totRowValues.push({ formula: `SUM(${getColLetter(grossCol)}8:${getColLetter(grossCol)}${totalRowNum - 1})` });

    // Deductions totals
    for (let col = dedStartCol; col <= totDedCol; col++) {
        const colLet = getColLetter(col);
        totRowValues.push({ formula: `SUM(${colLet}8:${colLet}${totalRowNum - 1})` });
    }

    // Net Salary total
    totRowValues.push({ formula: `SUM(${getColLetter(netCol)}8:${getColLetter(netCol)}${totalRowNum - 1})` });

    // Empty for settlement
    totRowValues.push('');
    totRowValues.push('');
    totRowValues.push('');

    totRow.values = totRowValues;
    safeMerge(sheet, totalRowNum, 1, totalRowNum, 6);

    totRow.eachCell((cell, colNum) => {
        cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF0F172A' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        cell.border = {
            top: { style: 'medium', color: { argb: 'FF0F172A' } },
            bottom: { style: 'double', color: { argb: 'FF0F172A' } },
            left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
        };

        if (colNum >= earnStartCol && colNum <= netCol) {
            cell.numFmt = '₹#,##0.00';
            cell.alignment = { horizontal: 'right', vertical: 'middle' };

            if (colNum === grossCol) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
                cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF15803D' } };
            } else if (colNum === totDedCol) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
                cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFB91C1C' } };
            } else if (colNum === netCol) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };
                cell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FF0284C7' } };
            }
        } else {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }
    });

    sheet.getCell(totalRowNum, 1).alignment = { horizontal: 'right', vertical: 'middle' };

    // 6. Formal Signatures Section (Matching PDF Signature Block)
    const sigLineRow = totalRowNum + 3;
    const sigTextRow = sigLineRow + 1;
    const [salSig1, salSig2, salSig3] = getSignatureRanges(totalCols);

    // Prepared By (Payroll Accountant)
    safeMerge(sheet, sigLineRow, salSig1.start, sigLineRow, salSig1.end);
    for (let c = salSig1.start; c <= salSig1.end; c++) sheet.getCell(sigLineRow, c).border = { top: { style: 'thin', color: { argb: 'FF475569' } } };
    safeMerge(sheet, sigTextRow, salSig1.start, sigTextRow, salSig1.end);
    const sig1 = sheet.getCell(sigTextRow, salSig1.start);
    sig1.value = 'PREPARED BY (PAYROLL ACCOUNTANT)';
    sig1.font = { name: 'Segoe UI', size: 8.5, bold: true, color: { argb: 'FF334155' } };
    sig1.alignment = { horizontal: 'center', vertical: 'middle' };

    // Verified By (Internal Auditor / Finance)
    safeMerge(sheet, sigLineRow, salSig2.start, sigLineRow, salSig2.end);
    for (let c = salSig2.start; c <= salSig2.end; c++) sheet.getCell(sigLineRow, c).border = { top: { style: 'thin', color: { argb: 'FF475569' } } };
    safeMerge(sheet, sigTextRow, salSig2.start, sigTextRow, salSig2.end);
    const sig2 = sheet.getCell(sigTextRow, salSig2.start);
    sig2.value = 'VERIFIED BY (INTERNAL AUDITOR / FINANCE)';
    sig2.font = { name: 'Segoe UI', size: 8.5, bold: true, color: { argb: 'FF334155' } };
    sig2.alignment = { horizontal: 'center', vertical: 'middle' };

    // Authorized Signatory / Partner
    safeMerge(sheet, sigLineRow, salSig3.start, sigLineRow, salSig3.end);
    for (let c = salSig3.start; c <= salSig3.end; c++) sheet.getCell(sigLineRow, c).border = { top: { style: 'thin', color: { argb: 'FF475569' } } };
    safeMerge(sheet, sigTextRow, salSig3.start, sigTextRow, salSig3.end);
    const sig3 = sheet.getCell(sigTextRow, salSig3.start);
    sig3.value = 'AUTHORIZED SIGNATORY / PARTNER';
    sig3.font = { name: 'Segoe UI', size: 8.5, bold: true, color: { argb: 'FF334155' } };
    sig3.alignment = { horizontal: 'center', vertical: 'middle' };

    // 7. Statutory Note Footer
    const footerRow = sigTextRow + 2;
    safeMerge(sheet, footerRow, 1, footerRow, totalCols);
    const footerCell = sheet.getCell(footerRow, 1);
    footerCell.value = 'Certified statutory wage register under Form T of the Payment of Wages Rules. Generated via KS Engineering Works ERP software.';
    footerCell.font = { name: 'Segoe UI', size: 8, italic: true, color: { argb: 'FF94A3B8' } };
    footerCell.alignment = { horizontal: 'center', vertical: 'middle' };
    footerCell.border = { top: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
    sheet.getRow(footerRow).height = 18;

    return workbook.xlsx.writeBuffer();
};

/**
 * =========================================================================
 * 4. SALARY MUSTER EXPORT (LANDSCAPE PDF VIA PUPPETEER)
 * =========================================================================
 */
const generateSalaryMusterPdf = async ({ firmId, month, year }) => {
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);
    const monthName = `${MONTH_NAMES[m - 1]} ${y}`;
    const firm = await getFirmInfo(firmId);

    let query = db('employee_salary_slips as ess')
        .join('employees as e', 'ess.employee_id', 'e.id')
        .whereNull('ess.deleted_at')
        .where('ess.is_active', true)
        .where('ess.month', m)
        .where('ess.year', y);

    if (firmId && firmId !== 'all') query = query.where('ess.firm_id', firmId);

    const slips = await query.select(
        'ess.*',
        'e.emp_code as empCode',
        'e.first_name as firstName',
        'e.last_name as lastName',
        'e.department',
        'e.designation',
        'e.bank_name as bankName',
        'e.account_number as accountNumber',
        'e.ifsc_code as ifscCode'
    ).orderBy('e.first_name', 'asc');

    const slipIds = slips.map(s => s.id);
    let details = [];
    if (slipIds.length > 0) {
        details = await db('salary_slip_details')
            .whereIn('salary_slip_id', slipIds)
            .whereNull('deleted_at')
            .orderBy('sort_order', 'asc');
    }

    const earningHeads = [...new Set(details.filter(d => d.component_type === 'EARNING').map(d => d.component_name))];
    const deductionHeads = [...new Set(details.filter(d => d.component_type === 'DEDUCTION').map(d => d.component_name))];

    const compMap = {};
    const earningTotals = {};
    const deductionTotals = {};
    earningHeads.forEach(eh => earningTotals[eh] = 0);
    deductionHeads.forEach(dh => deductionTotals[dh] = 0);

    let totalGross = 0;
    let totalDeductions = 0;
    let totalOTPay = 0;
    let totalNet = 0;

    for (const d of details) {
        if (!compMap[d.salary_slip_id]) compMap[d.salary_slip_id] = {};
        const amt = parseFloat(d.amount || 0);
        compMap[d.salary_slip_id][d.component_name] = amt;

        if (d.component_type === 'EARNING') earningTotals[d.component_name] = (earningTotals[d.component_name] || 0) + amt;
        else if (d.component_type === 'DEDUCTION') deductionTotals[d.component_name] = (deductionTotals[d.component_name] || 0) + amt;
    }

    for (const s of slips) {
        totalGross += parseFloat(s.gross_earnings || s.grossEarnings || 0) + parseFloat(s.overtime_pay || s.overtimePay || 0);
        totalDeductions += parseFloat(s.total_deductions || s.totalDeductions || 0);
        totalOTPay += parseFloat(s.overtime_pay || s.overtimePay || 0);
        totalNet += parseFloat(s.net_salary || s.netSalary || 0);
    }

    const templatePath = path.join(`${projectPaths.ROOT_DIR}/templates/payroll/`, 'salary-muster-template.ejs');
    const filledHtml = await ejs.renderFile(templatePath, {
        firm,
        monthName,
        slips,
        earningHeads,
        deductionHeads,
        compMap,
        earningTotals,
        deductionTotals,
        totalGross,
        totalDeductions,
        totalOTPay,
        totalNet
    });

    const browser = await getBrowser(puppeteer);
    let page;
    try {
        page = await browser.newPage();
        await page.setContent(filledHtml, { waitUntil: 'load' });
        const pdf = await page.pdf({
            format: 'A3',
            landscape: true,
            printBackground: true,
            margin: { top: '8mm', bottom: '8mm', left: '8mm', right: '8mm' }
        });
        return Buffer.from(pdf);
    } finally {
        if (page) await page.close().catch(() => {});
    }
};

module.exports = {
    generateAttendanceMusterExcel,
    generateAttendanceMusterPdf,
    generateSalaryMusterExcel,
    generateSalaryMusterPdf
};
