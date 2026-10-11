import { useState } from "react";
import {
    FiFolder, FiUsers, FiUser, FiCalendar,
    FiCheckCircle, FiAlertTriangle, FiDownload,
    FiChevronRight, FiX, FiFileText
} from "react-icons/fi";
import {
    getProjectReport, getTeamReport, getMemberReport,
    getMonthlyReport, getCompletedTasksReport, getDelayedTasksReport,
    exportReport,
} from "../../services/reportService";

// -- Priority / Status badge colours ----------------------------------------
const priorityColor = {
    Low: "ui-badge badge-neutral",
    Medium: "ui-badge badge-info",
    High: "ui-badge badge-warning",
    Critical: "ui-badge badge-danger",
};

const statusColor = {
    Pending: "ui-badge badge-warning",
    "In Progress": "ui-badge badge-info",
    Completed: "ui-badge badge-success",
};

const Badge = ({ text, colorMap }) => (
    <span className={colorMap?.[text] || "ui-badge badge-neutral"}>
        {text}
    </span>
);

// -- Report definitions ------------------------------------------------------
const REPORTS = [
    {
        key: "projects",
        label: "Project Report",
        description: "All your projects with status, priority, owner, and timeline details.",
        icon: FiFolder,
        fetch: getProjectReport,
        columns: ["Project Name", "Status", "Priority", "Created by", "Start Date", "Deadline", "Technologies"],
        renderRow: (r) => [
            r.name,
            <Badge text={r.status} colorMap={statusColor} />,
            <Badge text={r.priority} colorMap={priorityColor} />,
            r.owner,
            r.startDate,
            r.deadline,
            r.technologies,
        ],
    },
    {
        key: "teams",
        label: "Team Report",
        description: "Teams you manage, their members, and designated managers.",
        icon: FiUsers,
        fetch: getTeamReport,
        columns: ["Team Name", "Manager", "Members", "Created At"],
        renderRow: (r) => [
            r.teamName,
            r.manager,
            r.members.map((m) => m.name).join(", "),
            r.createdAt,
        ],
    },
    {
        key: "interns",
        label: "Team participant report",
        description: "Per-member task breakdown: completion rates, overdue counts, workload.",
        icon: FiUser,
        fetch: getMemberReport,
        columns: ["Name", "Role", "Total", "Done", "In Progress", "Pending", "Overdue", "Rate"],
        renderRow: (r) => [
            r.name,
            r.role,
            r.totalTasks,
            r.completed,
            r.inProgress,
            r.pending,
            <span className={r.overdue > 0 ? "text-red-600 font-semibold" : ""}>{r.overdue}</span>,
            <span className="font-semibold">{r.completionRate}</span>,
        ],
    },
    {
        key: "monthly",
        label: "Monthly Report",
        description: "Task breakdown for any given month — creation, completion and overdue counts.",
        icon: FiCalendar,
        isMonthly: true,
        fetch: getMonthlyReport,
        columns: ["Title", "Status", "Priority", "Assignee", "Deadline", "Created At"],
        renderRow: (r) => [
            r.title,
            <Badge text={r.status} colorMap={statusColor} />,
            <Badge text={r.priority} colorMap={priorityColor} />,
            r.assignee,
            r.deadline,
            r.createdAt,
        ],
        formatData: (d) => d.tasks,
        summaryOf: (d) => [
            { label: "Total Tasks", value: d.totalTasks },
            { label: "Completed", value: d.completed },
            { label: "In Progress", value: d.inProgress },
            { label: "Pending", value: d.pending },
            { label: "Overdue", value: d.overdue },
        ],
    },
    {
        key: "completedTasks",
        label: "Completed Tasks",
        description: "Full list of all tasks that have been marked as Completed.",
        icon: FiCheckCircle,
        fetch: getCompletedTasksReport,
        columns: ["Title", "Priority", "Assignee", "Created By", "Deadline", "Completed On", "Subtasks"],
        renderRow: (r) => [
            r.title,
            <Badge text={r.priority} colorMap={priorityColor} />,
            r.assignee,
            r.createdBy,
            r.deadline,
            r.completedOn,
            `${r.subtasksDone}/${r.subtasksTotal}`,
        ],
    },
    {
        key: "delayedTasks",
        label: "Delayed Tasks",
        description: "Tasks that are past their deadline and still not completed.",
        icon: FiAlertTriangle,
        fetch: getDelayedTasksReport,
        columns: ["Title", "Priority", "Status", "Assignee", "Deadline", "Days Overdue"],
        renderRow: (r) => [
            r.title,
            <Badge text={r.priority} colorMap={priorityColor} />,
            <Badge text={r.status} colorMap={statusColor} />,
            r.assignee,
            r.deadline,
            <span className={`font-bold ${r.daysOverdue > 7 ? "text-red-600" : "text-orange-500"}`}>
                {r.daysOverdue}d
            </span>,
        ],
    },
];

// -- ExportDropdown ---------------------------------------------------------
function ExportDropdown({ reportKey, month, onExport }) {
    const [open, setOpen] = useState(false);

    const handle = async (type) => {
        setOpen(false);
        await onExport(reportKey, type, month);
    };

    return (
        <div className="relative">
            <button
                onClick={() => setOpen((o) => !o)}
                className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-color)] bg-[var(--surface-card)] px-4 py-2 text-sm font-medium text-[var(--title-color)]  hover:bg-[var(--surface-muted)] transition"
            >
                <FiDownload size={14} />
                Export
                <FiChevronRight size={12} className={`transition-transform ${open ? "rotate-90" : ""}`} />
            </button>
            {open && (
                <div className="absolute right-0 z-50 mt-1 w-36 rounded-md border border-[var(--border-color)] bg-[var(--surface-card)]">
                    <button
                        onClick={() => handle("excel")}
                        className="flex w-full items-center gap-2 rounded-t-md px-4 py-2.5 text-sm text-[var(--title-color)] transition hover:bg-[var(--hover-bg)]"
                    >
                        <FiFileText size={14} /> Excel (.xlsx)
                    </button>
                    <button
                        onClick={() => handle("pdf")}
                        className="flex w-full items-center gap-2 rounded-b-md px-4 py-2.5 text-sm text-[var(--title-color)] transition hover:bg-[var(--hover-bg)]"
                    >
                        <FiFileText size={14} /> PDF (.pdf)
                    </button>
                </div>
            )}
        </div>
    );
}

// -- Detail Panel -----------------------------------------------------------
function DetailPanel({ report, data, loading, error, month, onClose, onExport }) {
    if (!report) return null;

    const rows = report.formatData ? report.formatData(data) : data;
    const summary = report.summaryOf ? report.summaryOf(data) : null;

    return (
        <div className="fixed inset-0 z-40 flex">
            {/* Backdrop */}
            <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />

            {/* Slide-in panel */}
            <div className="animate-slide-in-right w-full max-w-4xl overflow-y-auto border-l border-[var(--border-color)] bg-[var(--surface-card)]">
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border-color)] bg-[var(--surface-card)] px-8 py-5">
                    <div className="flex items-center gap-3 text-[var(--title-color)]">
                        <span className="flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border-color)] bg-[var(--surface-muted)] text-[var(--title-color)]">
                            <report.icon size={18} />
                        </span>
                        <div>
                            <h2 className="text-xl font-semibold">{report.label}</h2>
                            <p className="text-sm text-[var(--subtitle-color)]">{report.description}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <ExportDropdown reportKey={report.key} month={month} onExport={onExport} />
                        <button onClick={onClose} className="ui-icon-button ml-2">
                            <FiX size={20} />
                        </button>
                    </div>
                </div>

                <div className="app-page">
                    {/* Monthly Summary Pills */}
                    {summary && (
                        <div className="mb-6 grid grid-cols-5 gap-3">
                            {summary.map((s) => (
                                <div key={s.label} className="rounded-lg border bg-[var(--surface-muted)] p-4 text-center">
                                    <p className="text-2xl font-bold text-[var(--title-color)]">{s.value}</p>
                                    <p className="mt-1 text-xs text-[var(--subtitle-color)]">{s.label}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    {loading && (
                        <div className="flex items-center justify-center py-20">
                            <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--border-color)] border-t-[var(--title-color)]" />
                        </div>
                    )}

                    {error && (
                        <div className="rounded-md bg-red-50 p-4 text-sm text-red-600 border border-red-200">{error}</div>
                    )}

                    {!loading && !error && rows?.length === 0 && (
                        <div className="py-16 text-center text-[var(--muted-color)]">
                            <FiFileText size={36} className="mx-auto mb-3" />
                            <p className="font-medium">No data found for this report.</p>
                        </div>
                    )}

                    {!loading && !error && rows?.length > 0 && (
                        <div className="overflow-x-auto rounded-lg border border-[var(--border-color)] ">
                            <table className="ui-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        {report.columns.map((col, i) => (
                                            <th
                                                key={col}
                                                className={i === report.columns.length - 1 ? "rounded-tr-md" : ""}
                                            >
                                                {col}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row, ri) => (
                                        <tr key={ri}>
                                            <td className="text-xs text-[var(--muted-color)]">{ri + 1}</td>
                                            {report.renderRow(row).map((cell, ci) => (
                                                <td key={ci}>
                                                    {cell}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div className="border-t border-[var(--border-color)] bg-[var(--surface-muted)] px-6 py-3 text-xs text-[var(--muted-color)]">
                                {rows.length} record{rows.length !== 1 ? "s" : ""} found
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// -- Main Reports Page -------------------------------------------------------
export default function Reports() {
    const [activeReport, setActiveReport] = useState(null);
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

    const openReport = async (report) => {
        setActiveReport(report);
        setReportData(null);
        setError("");
        setLoading(true);
        try {
            const res = report.isMonthly
                ? await report.fetch(month)
                : await report.fetch();
            setReportData(res.data.data);
        } catch (err) {
            setError(err.response?.data?.message || "Failed to load report data.");
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async (key, type, m) => {
        try {
            await exportReport(key, type, m);
        } catch {
            alert("Export failed. Make sure the backend server is running.");
        }
    };

    return (
        <div className="app-page">
            <div className="mx-auto max-w-6xl">

                {/* Header */}
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Reports</h1>
                        <p className="page-description">
                            Generate, view and export analytical reports across your workspace.
                        </p>
                    </div>
                    {/* Month picker for Monthly Report quick access */}
                    <div className="flex items-center gap-2 rounded-md border border-[var(--border-color)] bg-[var(--surface-card)] px-4 py-2.5 ">
                        <FiCalendar size={16} className="text-[var(--muted-color)]" />
                        <label className="text-xs font-medium text-[var(--subtitle-color)] mr-1">Month:</label>
                        <input
                            type="month"
                            value={month}
                            onChange={(e) => setMonth(e.target.value)}
                            className="text-sm outline-none bg-transparent text-[var(--title-color)]"
                        />
                    </div>
                </div>

                {/* Report Cards Grid */}
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {REPORTS.map((report) => {
                        const Icon = report.icon;
                        return (
                            <div
                                key={report.key}
                                className="ui-card ui-card-hover group relative overflow-hidden p-6"
                            >
                                <div>
                                    {/* Icon */}
                                    <div className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border-color)] bg-[var(--surface-muted)] text-[var(--title-color)]">
                                        <Icon size={20} />
                                    </div>

                                    <h3 className="text-base font-semibold text-[var(--title-color)]">{report.label}</h3>
                                    <p className="mt-1 text-sm text-[var(--subtitle-color)] leading-relaxed">{report.description}</p>

                                    {/* Actions */}
                                    <div className="mt-5 flex items-center gap-2">
                                        <button
                                            id={`view-report-${report.key}`}
                                            onClick={() => openReport(report)}
                                            className="ui-button ui-button-primary flex-1"
                                        >
                                            View Report
                                        </button>
                                        <ExportDropdown
                                            reportKey={report.key}
                                            month={report.isMonthly ? month : null}
                                            onExport={handleExport}
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Detail Panel */}
            {activeReport && (
                <DetailPanel
                    report={activeReport}
                    data={reportData}
                    loading={loading}
                    error={error}
                    month={month}
                    onClose={() => setActiveReport(null)}
                    onExport={handleExport}
                />
            )}

            {/* Inline style for slide-in animation */}
            <style>{`
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to   { transform: translateX(0);    opacity: 1; }
                }
                .animate-slide-in-right {
                    animation: slideInRight 0.28s cubic-bezier(0.22, 1, 0.36, 1) both;
                }
            `}</style>
        </div>
    );
}







