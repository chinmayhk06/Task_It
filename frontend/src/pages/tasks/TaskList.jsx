import { useCallback, useEffect, useState } from "react";
import { FiPlus, FiSearch, FiCalendar, FiCheckSquare, FiAlertCircle } from "react-icons/fi";
import { getTasks, createTask, updateTask, deleteTask } from "../../services/taskService";
import { getProjects } from "../../services/projectService";
import TaskFormModal from "../../components/tasks/TaskFormModal";
import TaskDetailsModal from "../../components/tasks/TaskDetailsModal";
import { canManageTasks, getCurrentUserId, getTeamRole } from "../../utils/rbac";

const getDeadlineLabel = (task) => {
    if (task.status === "Completed") return "Completed";
    if (!task.deadline) return "No deadline";

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadline = new Date(task.deadline);
    deadline.setHours(0, 0, 0, 0);
    const days = Math.round((deadline.getTime() - today.getTime()) / 86400000);

    if (days < 0) return "Overdue";
    if (days === 0) return "Due Today";
    if (days <= 7) return "Due Soon";
    return new Date(task.deadline).toLocaleDateString();
};

export default function TaskList() {
    const [tasks, setTasks] = useState([]);
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [statusTab, setStatusTab] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [priorityFilter, setPriorityFilter] = useState("All");
    const [projectFilter, setProjectFilter] = useState("");
    const [assigneeFilter, setAssigneeFilter] = useState("");
    const [sortFilter, setSortFilter] = useState("");

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);
    const [activeTaskId, setActiveTaskId] = useState(null);

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            setError("");
            const params = {
                status: statusTab || undefined,
                search: searchQuery || undefined,
                priority: priorityFilter !== "All" ? priorityFilter : undefined,
                project: projectFilter || undefined,
                assignee: assigneeFilter || undefined,
                sort: sortFilter || undefined,
            };
            const [taskRes, projectRes] = await Promise.all([
                getTasks(params),
                getProjects(),
            ]);
            setTasks(taskRes.data);
            setProjects(projectRes.data.data);
        } catch (err) {
            console.error("Failed to load task dashboard.", err);
            setError(err.response?.data?.message || "Failed to load tasks.");
        } finally {
            setLoading(false);
        }
    }, [assigneeFilter, priorityFilter, projectFilter, searchQuery, sortFilter, statusTab]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleCreateOrUpdate = async (formData) => {
        try {
            if (selectedTask) {
                await updateTask(selectedTask._id, formData);
            } else {
                await createTask(formData);
            }
            setIsFormOpen(false);
            setSelectedTask(null);
            await loadData();
        } catch (err) {
            setError(err.response?.data?.message || "Failed to save task.");
        }
    };

    const handleDeleteTask = async (id) => {
        if (!confirm("Are you sure you want to delete this task?")) return;
        try {
            await deleteTask(id);
            setIsDetailsOpen(false);
            await loadData();
        } catch (err) {
            setError(err.response?.data?.message || "Failed to delete task.");
        }
    };

    const currentUserId = getCurrentUserId();
    const canCreateTask = projects.some((project) => {
        return canManageTasks(getTeamRole(project.team, currentUserId));
    });
    const canManageTask = (task) => {
        const taskProject = task.project && typeof task.project === "object" ? task.project : null;
        const project = !taskProject?.team?.members
            ? projects.find((item) => item._id === (taskProject?._id || task.project))
            : taskProject;

        return canManageTasks(getTeamRole(project?.team, currentUserId));
    };
    const assigneeOptions = Array.from(
        new Map(
            projects
                .filter((project) => canManageTasks(getTeamRole(project.team, currentUserId)))
                .flatMap((project) =>
                    project.team?.members?.map((member) => member.user).filter(Boolean) || []
                )
                .map((user) => [user._id, user])
        ).values()
    );

    return (
        <div className="app-page">
            <div className="mx-auto max-w-6xl">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Workspace Tasks</h1>
                        <p className="page-description">Create, assign, track checklist items, and discuss tasks.</p>
                    </div>
                    {canCreateTask && (
                        <button
                            onClick={() => {
                                setSelectedTask(null);
                                setIsFormOpen(true);
                            }}
                            className="ui-button ui-button-primary"
                        >
                            <FiPlus />
                            Add New Task
                        </button>
                    )}
                </div>

                {error && (
                    <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                        {error}
                    </p>
                )}

                <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex gap-1 rounded-md border border-[var(--border-color)] bg-[var(--surface-card)] p-1">
                        {[
                            { label: "All", value: "" },
                            { label: "Pending", value: "Pending" },
                            { label: "In Progress", value: "In Progress" },
                            { label: "Completed", value: "Completed" },
                        ].map((tab) => (
                            <button
                                key={tab.label}
                                onClick={() => setStatusTab(tab.value)}
                                className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                                    statusTab === tab.value
                                        ? "bg-[var(--accent)] text-[var(--accent-contrast)]"
                                        : "text-[var(--subtitle-color)] hover:bg-[var(--hover-bg)]"
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
                        <div className="relative flex-1 sm:w-64">
                            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted-color)]" />
                            <input
                                type="text"
                                placeholder="Search tasks..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full rounded-md border border-[var(--border-color)] bg-[var(--surface-card)] px-10 py-3 text-sm outline-none focus:border-[var(--title-color)] focus:ring-2 focus:ring-gray-200"
                            />
                        </div>
                        <select
                            value={priorityFilter}
                            onChange={(e) => setPriorityFilter(e.target.value)}
                            className="rounded-md border border-[var(--border-color)] bg-[var(--surface-card)] px-4 py-3 text-sm outline-none focus:border-[var(--title-color)] focus:ring-2 focus:ring-gray-200"
                        >
                            <option value="All">All Priorities</option>
                            <option value="Low">Low</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                            <option value="Critical">Critical</option>
                        </select>
                        <select
                            value={projectFilter}
                            onChange={(e) => setProjectFilter(e.target.value)}
                            className="rounded-md border border-[var(--border-color)] bg-[var(--surface-card)] px-4 py-3 text-sm outline-none focus:border-[var(--title-color)] focus:ring-2 focus:ring-gray-200"
                        >
                            <option value="">All Projects</option>
                            {projects.map((project) => (
                                <option key={project._id} value={project._id}>
                                    {project.projectName}
                                </option>
                            ))}
                        </select>
                        {assigneeOptions.length > 0 && (
                            <select
                                value={assigneeFilter}
                                onChange={(e) => setAssigneeFilter(e.target.value)}
                                className="rounded-md border border-[var(--border-color)] bg-[var(--surface-card)] px-4 py-3 text-sm outline-none focus:border-[var(--title-color)] focus:ring-2 focus:ring-gray-200"
                            >
                                <option value="">All Assignees</option>
                                <option value="me">Assigned to me</option>
                                {assigneeOptions.map((user) => (
                                    <option key={user._id} value={user._id}>
                                        {user.fullName || user.email}
                                    </option>
                                ))}
                            </select>
                        )}
                        <select
                            value={sortFilter}
                            onChange={(e) => setSortFilter(e.target.value)}
                            className="rounded-md border border-[var(--border-color)] bg-[var(--surface-card)] px-4 py-3 text-sm outline-none focus:border-[var(--title-color)] focus:ring-2 focus:ring-gray-200"
                        >
                            <option value="">Newest first</option>
                            <option value="deadline">Deadline</option>
                        </select>
                    </div>
                </div>

                {loading ? (
                    <div className="mt-12 text-center font-medium text-[var(--subtitle-color)]">Loading Tasks...</div>
                ) : (
                    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {tasks.map((t) => {
                            const completedCount = t.subtasks?.filter((s) => s.isCompleted).length || 0;
                            const totalCount = t.subtasks?.length || 0;
                            const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

                            return (
                                <div
                                    key={t._id}
                                    className="ui-card ui-card-hover group relative flex cursor-pointer flex-col justify-between p-5"
                                    onClick={() => {
                                        setActiveTaskId(t._id);
                                        setIsDetailsOpen(true);
                                    }}
                                >
                                    <div>
                                        <div className="flex items-center justify-between">
                                            <span className={`ui-badge uppercase ${
                                                t.priority === "Critical" ? "badge-danger" :
                                                t.priority === "High" ? "badge-warning" :
                                                t.priority === "Medium" ? "badge-info" : "badge-neutral"
                                            }`}
                                            >
                                                {t.priority}
                                            </span>

                                            {canManageTask(t) && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedTask(t);
                                                        setIsFormOpen(true);
                                                    }}
                                                    className="text-xs text-[var(--muted-color)] opacity-0 transition hover:text-[var(--title-color)] group-hover:opacity-100"
                                                >
                                                    Edit
                                                </button>
                                            )}
                                        </div>

                                        <h3 className="mt-3 line-clamp-1 text-base font-semibold text-[var(--title-color)]">{t.title}</h3>
                                        <p className="mt-1 text-xs text-[var(--muted-color)]">
                                            {t.project?.projectName || "Legacy task"}
                                        </p>
                                        <p className="mt-1 line-clamp-2 text-sm text-[var(--subtitle-color)]">{t.description || "No description."}</p>
                                    </div>

                                    <div className="mt-6 border-t border-[var(--border-color)] pt-4">
                                        {totalCount > 0 && (
                                            <div className="mb-4">
                                                <div className="mb-1 flex justify-between text-xs text-[var(--subtitle-color)]">
                                                    <span className="flex items-center gap-1">
                                                        <FiCheckSquare /> Checklist
                                                    </span>
                                                    <span>{completedCount}/{totalCount} ({progressPercent}%)</span>
                                                </div>
                                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--hover-bg)]">
                                                    <div
                                                        className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
                                                        style={{ width: `${progressPercent}%` }}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between text-xs text-[var(--subtitle-color)]">
                                            <span className="flex items-center gap-1">
                                                <FiCalendar /> {getDeadlineLabel(t)}
                                            </span>

                                            <span className="rounded-full bg-[var(--hover-bg)] px-2 py-0.5 font-semibold text-[var(--title-color)]">
                                                {t.assignee?.fullName ? t.assignee.fullName.split(" ")[0] : "Unassigned"}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {tasks.length === 0 && (
                            <div className="col-span-full mt-8 rounded-lg border border-dashed border-[var(--border-color)] py-16 text-center">
                                <FiAlertCircle className="mx-auto text-[var(--muted-color)]" size={32} />
                                <h3 className="mt-4 text-lg font-semibold text-[var(--title-color)]">No tasks found</h3>
                                <p className="mt-1 text-[var(--subtitle-color)]">Try changing filters or search terms.</p>
                            </div>
                        )}
                    </div>
                )}

                <TaskFormModal
                    isOpen={isFormOpen}
                    onClose={() => setIsFormOpen(false)}
                    onSubmit={handleCreateOrUpdate}
                    task={selectedTask}
                    projects={projects}
                />

                <TaskDetailsModal
                    isOpen={isDetailsOpen}
                    onClose={() => setIsDetailsOpen(false)}
                    taskId={activeTaskId}
                    onTaskUpdated={loadData}
                    onDelete={handleDeleteTask}
                />
            </div>
        </div>
    );
}
