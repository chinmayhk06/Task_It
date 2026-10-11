const reportService = require('../services/reportService');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

// ── Helper: stream Excel ──────────────────────────────────────────────────
const sendExcel = async (res, workbook, filename) => {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
};

// ── Helper: style header row ──────────────────────────────────────────────
const styleHeader = (row) => {
    row.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a1a2e' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    row.height = 20;
};

// ── Helper: simple PDF table ──────────────────────────────────────────────
const sendPDF = (res, title, headers, rows, filename) => {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);

    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
    doc.pipe(res);

    // Title
    doc.fontSize(18).font('Helvetica-Bold').text(title, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(1);

    if (rows.length === 0) {
        doc.fontSize(12).text('No data available.', { align: 'center' });
        doc.end();
        return;
    }

    // Column widths (distribute evenly across landscape A4 minus margins)
    const pageWidth = doc.page.width - 80;
    const colWidth = Math.floor(pageWidth / headers.length);
    const rowHeight = 22;
    let x = 40;
    let y = doc.y;

    // Draw header
    doc.font('Helvetica-Bold').fontSize(8);
    headers.forEach((h, i) => {
        doc.rect(x + i * colWidth, y, colWidth, rowHeight).fill('#1a1a2e').stroke();
        doc.fillColor('white').text(h, x + i * colWidth + 4, y + 6, {
            width: colWidth - 8,
            ellipsis: true,
        });
    });
    y += rowHeight;

    // Draw rows
    doc.font('Helvetica').fontSize(7.5);
    rows.forEach((row, rowIdx) => {
        // Page break check
        if (y + rowHeight > doc.page.height - 60) {
            doc.addPage({ layout: 'landscape' });
            y = 40;
            // Redraw header on new page
            doc.font('Helvetica-Bold').fontSize(8);
            headers.forEach((h, i) => {
                doc.rect(x + i * colWidth, y, colWidth, rowHeight).fill('#1a1a2e').stroke();
                doc.fillColor('white').text(h, x + i * colWidth + 4, y + 6, { width: colWidth - 8, ellipsis: true });
            });
            y += rowHeight;
            doc.font('Helvetica').fontSize(7.5);
        }

        const bgColor = rowIdx % 2 === 0 ? '#f8f8f8' : '#ffffff';
        row.forEach((cell, i) => {
            doc.rect(x + i * colWidth, y, colWidth, rowHeight).fill(bgColor).stroke('#cccccc');
            doc.fillColor('#111111').text(String(cell ?? '-'), x + i * colWidth + 4, y + 6, {
                width: colWidth - 8,
                ellipsis: true,
            });
        });
        y += rowHeight;
    });

    doc.end();
};

// ═══════════════════════════════════════════════════════════════════════════
// 1. PROJECT REPORT
// ═══════════════════════════════════════════════════════════════════════════
const getProjectReport = async (req, res) => {
    try {
        const data = await reportService.getProjectReport(req.user._id);
        const { export: exportType } = req.query;

        if (exportType === 'excel') {
            const wb = new ExcelJS.Workbook();
            const ws = wb.addWorksheet('Project Report');
            ws.columns = [
                { header: 'Project Name', key: 'name', width: 25 },
                { header: 'Status', key: 'status', width: 14 },
                { header: 'Priority', key: 'priority', width: 12 },
                { header: 'Created by', key: 'owner', width: 20 },
                { header: 'Start Date', key: 'startDate', width: 14 },
                { header: 'Deadline', key: 'deadline', width: 14 },
                { header: 'Technologies', key: 'technologies', width: 25 },
                { header: 'GitHub', key: 'githubRepo', width: 30 },
            ];
            styleHeader(ws.getRow(1));
            data.forEach((r) => ws.addRow(r));
            return await sendExcel(res, wb, 'Project_Report');
        }

        if (exportType === 'pdf') {
            const headers = ['Project Name', 'Status', 'Priority', 'Created by', 'Start Date', 'Deadline', 'Technologies'];
            const rows = data.map((r) => [r.name, r.status, r.priority, r.owner, r.startDate, r.deadline, r.technologies]);
            return sendPDF(res, 'Project Report', headers, rows, 'Project_Report');
        }

        res.json({ success: true, count: data.length, data });
    } catch (err) {
        res.status(err.statusCode || 500).json({ success: false, message: err.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// 2. TEAM REPORT
// ═══════════════════════════════════════════════════════════════════════════
const getTeamReport = async (req, res) => {
    try {
        const data = await reportService.getTeamReport(req.user._id);
        const { export: exportType } = req.query;

        if (exportType === 'excel') {
            const wb = new ExcelJS.Workbook();
            const ws = wb.addWorksheet('Team Report');
            ws.columns = [
                { header: 'Team Name', key: 'teamName', width: 22 },
                { header: 'Description', key: 'description', width: 30 },
                { header: 'Manager', key: 'manager', width: 20 },
                { header: 'Member Count', key: 'memberCount', width: 14 },
                { header: 'Members', key: 'membersStr', width: 40 },
                { header: 'Created At', key: 'createdAt', width: 16 },
            ];
            styleHeader(ws.getRow(1));
            data.forEach((t) => {
                ws.addRow({
                    ...t,
                    membersStr: t.members.map((m) => `${m.name} (${m.role})`).join(', '),
                });
            });
            return await sendExcel(res, wb, 'Team_Report');
        }

        if (exportType === 'pdf') {
            const headers = ['Team Name', 'Manager', 'Members', 'Created At'];
            const rows = data.map((t) => [
                t.teamName,
                t.manager,
                t.members.map((m) => m.name).join(', '),
                t.createdAt,
            ]);
            return sendPDF(res, 'Team Report', headers, rows, 'Team_Report');
        }

        res.json({ success: true, count: data.length, data });
    } catch (err) {
        res.status(err.statusCode || 500).json({ success: false, message: err.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// 3. INTERN / INTERN REPORT
// ═══════════════════════════════════════════════════════════════════════════
const getInternReport = async (req, res) => {
    try {
        const data = await reportService.getInternReport(req.user._id);
        const { export: exportType } = req.query;

        if (exportType === 'excel') {
            const wb = new ExcelJS.Workbook();
            const ws = wb.addWorksheet('Team participant report');
            ws.columns = [
                { header: 'Name', key: 'name', width: 22 },
                { header: 'Email', key: 'email', width: 28 },
                { header: 'Role', key: 'role', width: 18 },
                { header: 'Total Tasks', key: 'totalTasks', width: 13 },
                { header: 'Completed', key: 'completed', width: 13 },
                { header: 'In Progress', key: 'inProgress', width: 13 },
                { header: 'Pending', key: 'pending', width: 13 },
                { header: 'Overdue', key: 'overdue', width: 13 },
                { header: 'Completion Rate', key: 'completionRate', width: 16 },
            ];
            styleHeader(ws.getRow(1));
            data.forEach((r) => ws.addRow(r));
            return await sendExcel(res, wb, 'Team_Participant_Report');
        }

        if (exportType === 'pdf') {
            const headers = ['Name', 'Role', 'Total', 'Done', 'In Progress', 'Pending', 'Overdue', 'Rate'];
            const rows = data.map((r) => [r.name, r.role, r.totalTasks, r.completed, r.inProgress, r.pending, r.overdue, r.completionRate]);
            return sendPDF(res, 'Team participant report', headers, rows, 'Team_Participant_Report');
        }

        res.json({ success: true, count: data.length, data });
    } catch (err) {
        res.status(err.statusCode || 500).json({ success: false, message: err.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// 4. MONTHLY REPORT
// ═══════════════════════════════════════════════════════════════════════════
const getMonthlyReport = async (req, res) => {
    try {
        const data = await reportService.getMonthlyReport(req.user._id, req.query.month);
        const { export: exportType } = req.query;

        if (exportType === 'excel') {
            const wb = new ExcelJS.Workbook();

            // Summary sheet
            const sumSheet = wb.addWorksheet('Summary');
            sumSheet.columns = [
                { header: 'Metric', key: 'metric', width: 20 },
                { header: 'Value', key: 'value', width: 12 },
            ];
            styleHeader(sumSheet.getRow(1));
            sumSheet.addRows([
                { metric: 'Month', value: data.month },
                { metric: 'Total Tasks', value: data.totalTasks },
                { metric: 'Completed', value: data.completed },
                { metric: 'In Progress', value: data.inProgress },
                { metric: 'Pending', value: data.pending },
                { metric: 'Overdue', value: data.overdue },
            ]);

            // Tasks detail sheet
            const taskSheet = wb.addWorksheet('Tasks');
            taskSheet.columns = [
                { header: 'Title', key: 'title', width: 28 },
                { header: 'Status', key: 'status', width: 14 },
                { header: 'Priority', key: 'priority', width: 12 },
                { header: 'Assignee', key: 'assignee', width: 20 },
                { header: 'Deadline', key: 'deadline', width: 14 },
                { header: 'Created At', key: 'createdAt', width: 14 },
            ];
            styleHeader(taskSheet.getRow(1));
            data.tasks.forEach((t) => taskSheet.addRow(t));

            return await sendExcel(res, wb, `Monthly_Report_${data.month}`);
        }

        if (exportType === 'pdf') {
            const headers = ['Title', 'Status', 'Priority', 'Assignee', 'Deadline', 'Created At'];
            const rows = data.tasks.map((t) => [t.title, t.status, t.priority, t.assignee, t.deadline, t.createdAt]);
            return sendPDF(res, `Monthly Report — ${data.month}`, headers, rows, `Monthly_Report_${data.month}`);
        }

        res.json({ success: true, data });
    } catch (err) {
        res.status(err.statusCode || 500).json({ success: false, message: err.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// 5. COMPLETED TASKS REPORT
// ═══════════════════════════════════════════════════════════════════════════
const getCompletedTasksReport = async (req, res) => {
    try {
        const data = await reportService.getCompletedTasksReport(req.user._id);
        const { export: exportType } = req.query;

        if (exportType === 'excel') {
            const wb = new ExcelJS.Workbook();
            const ws = wb.addWorksheet('Completed Tasks');
            ws.columns = [
                { header: 'Title', key: 'title', width: 28 },
                { header: 'Priority', key: 'priority', width: 12 },
                { header: 'Assignee', key: 'assignee', width: 20 },
                { header: 'Created By', key: 'createdBy', width: 20 },
                { header: 'Deadline', key: 'deadline', width: 14 },
                { header: 'Completed On', key: 'completedOn', width: 14 },
                { header: 'Subtasks Done', key: 'subtasksDone', width: 14 },
                { header: 'Subtasks Total', key: 'subtasksTotal', width: 14 },
            ];
            styleHeader(ws.getRow(1));
            data.forEach((r) => ws.addRow(r));
            return await sendExcel(res, wb, 'Completed_Tasks_Report');
        }

        if (exportType === 'pdf') {
            const headers = ['Title', 'Priority', 'Assignee', 'Deadline', 'Completed On'];
            const rows = data.map((r) => [r.title, r.priority, r.assignee, r.deadline, r.completedOn]);
            return sendPDF(res, 'Completed Tasks Report', headers, rows, 'Completed_Tasks_Report');
        }

        res.json({ success: true, count: data.length, data });
    } catch (err) {
        res.status(err.statusCode || 500).json({ success: false, message: err.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// 6. DELAYED / OVERDUE TASKS REPORT
// ═══════════════════════════════════════════════════════════════════════════
const getDelayedTasksReport = async (req, res) => {
    try {
        const data = await reportService.getDelayedTasksReport(req.user._id);
        const { export: exportType } = req.query;

        if (exportType === 'excel') {
            const wb = new ExcelJS.Workbook();
            const ws = wb.addWorksheet('Delayed Tasks');
            ws.columns = [
                { header: 'Title', key: 'title', width: 28 },
                { header: 'Priority', key: 'priority', width: 12 },
                { header: 'Status', key: 'status', width: 14 },
                { header: 'Assignee', key: 'assignee', width: 20 },
                { header: 'Assignee Email', key: 'assigneeEmail', width: 26 },
                { header: 'Deadline', key: 'deadline', width: 14 },
                { header: 'Days Overdue', key: 'daysOverdue', width: 14 },
            ];
            styleHeader(ws.getRow(1));
            // Highlight overdue rows in red
            data.forEach((r) => {
                const row = ws.addRow(r);
                const daysCell = row.getCell('daysOverdue');
                if (r.daysOverdue > 7) {
                    daysCell.font = { bold: true, color: { argb: 'FFCC0000' } };
                }
            });
            return await sendExcel(res, wb, 'Delayed_Tasks_Report');
        }

        if (exportType === 'pdf') {
            const headers = ['Title', 'Priority', 'Status', 'Assignee', 'Deadline', 'Days Overdue'];
            const rows = data.map((r) => [r.title, r.priority, r.status, r.assignee, r.deadline, r.daysOverdue]);
            return sendPDF(res, 'Delayed / Overdue Tasks Report', headers, rows, 'Delayed_Tasks_Report');
        }

        res.json({ success: true, count: data.length, data });
    } catch (err) {
        res.status(err.statusCode || 500).json({ success: false, message: err.message });
    }
};

module.exports = {
    getProjectReport,
    getTeamReport,
    getInternReport,
    getMonthlyReport,
    getCompletedTasksReport,
    getDelayedTasksReport,
};
