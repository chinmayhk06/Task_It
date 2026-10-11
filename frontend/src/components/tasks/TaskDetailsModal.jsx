import { useEffect, useState } from "react";
import { FiX, FiCheckSquare, FiPlus, FiTrash2, FiPaperclip, FiMessageSquare } from "react-icons/fi";
import {
    getTask,
    addSubtask,
    toggleSubtask,
    deleteSubtask,
    addComment,
    deleteComment,
    addAttachment,
    deleteAttachment,
    updateTask
} from "../../services/taskService";

export default function TaskDetailsModal({ isOpen, onClose, taskId, onTaskUpdated, onDelete }) {
    const [task, setTask] = useState(null);
    const [loading, setLoading] = useState(true);
    const [newSubtask, setNewSubtask] = useState("");
    const [commentText, setCommentText] = useState("");
    const [attachment, setAttachment] = useState({ name: "", url: "" });
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchFullDetails = async () => {
            try {
                setLoading(true);
                const data = await getTask(taskId);
                setTask(data.data);
            } catch {
                setError("Failed to fetch task details.");
            } finally {
                setLoading(false);
            }
        };

        if (isOpen && taskId) {
            fetchFullDetails();
        }
    }, [isOpen, taskId]);

    if (!isOpen) return null;

    const handleAddSubtask = async (e) => {
        e.preventDefault();
        if (!newSubtask.trim()) return;
        try {
            await addSubtask(taskId, newSubtask.trim());
            setTask((await getTask(taskId)).data);
            setNewSubtask("");
            onTaskUpdated();
        } catch {
            setError("Failed to add subtask.");
        }
    };

    const handleToggleSubtask = async (subtaskId, isCompleted) => {
        try {
            await toggleSubtask(taskId, subtaskId, isCompleted);
            setTask((await getTask(taskId)).data);
            onTaskUpdated();
        } catch {
            setError("Failed to toggle subtask.");
        }
    };

    const handleDeleteSubtask = async (subtaskId) => {
        try {
            await deleteSubtask(taskId, subtaskId);
            setTask((await getTask(taskId)).data);
            onTaskUpdated();
        } catch {
            setError("Failed to delete subtask.");
        }
    };

    const handleAddComment = async (e) => {
        e.preventDefault();
        if (!commentText.trim()) return;
        try {
            await addComment(taskId, commentText.trim());
            setTask((await getTask(taskId)).data);
            setCommentText("");
            onTaskUpdated();
        } catch {
            setError("Failed to add comment.");
        }
    };

    const handleDeleteComment = async (commentId) => {
        try {
            await deleteComment(taskId, commentId);
            setTask((await getTask(taskId)).data);
            onTaskUpdated();
        } catch {
            setError("Failed to delete comment.");
        }
    };

    const handleAddAttachment = async (e) => {
        e.preventDefault();
        if (!attachment.name.trim() || !attachment.url.trim()) return;
        try {
            await addAttachment(taskId, attachment.name.trim(), attachment.url.trim());
            setTask((await getTask(taskId)).data);
            setAttachment({ name: "", url: "" });
            onTaskUpdated();
        } catch {
            setError("Failed to add attachment.");
        }
    };

    const handleDeleteAttachment = async (attachmentId) => {
        try {
            await deleteAttachment(taskId, attachmentId);
            setTask((await getTask(taskId)).data);
            onTaskUpdated();
        } catch {
            setError("Failed to delete attachment.");
        }
    };

    const handleStatusChange = async (status) => {
        try {
            await updateTask(taskId, { status });
            setTask((await getTask(taskId)).data);
            onTaskUpdated();
        } catch {
            setError("Failed to update status.");
        }
    };

    const canManageTask = Boolean(task?.permissions?.canManage);
    const canUpdateStatus = Boolean(task?.permissions?.canUpdateStatus);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/45 backdrop-blur-sm">
            <div className="h-full w-full max-w-2xl bg-[var(--surface-card)]  flex flex-col border-l border-[var(--border-color)]">
                {/* Header */}
                <div className="flex items-center justify-between border-b p-6">
                    <div>
                        <span className="rounded-full bg-[var(--hover-bg)] px-3 py-1 text-xs font-semibold uppercase text-[var(--subtitle-color)]">
                            Task Details
                        </span>
                        <h2 className="mt-2 text-2xl font-bold text-[var(--title-color)]">
                            {loading ? "Loading..." : task?.title}
                        </h2>
                    </div>
                    <button onClick={onClose} className="rounded-lg p-2 text-[var(--muted-color)] hover:bg-[var(--hover-bg)] hover:text-[var(--title-color)]">
                        <FiX size={22} />
                    </button>
                </div>

                {loading ? (
                    <div className="flex-1 p-6 text-[var(--subtitle-color)]">Loading task details...</div>
                ) : (
                    <div className="flex-1 overflow-y-auto p-6 space-y-8">
                        {error && (
                            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                                {error}
                            </p>
                        )}

                        {/* Meta Grid */}
                        <div className="grid grid-cols-2 gap-4 rounded-md bg-[var(--surface-muted)] p-4 border text-sm text-[var(--title-color)]">
                            <div>
                                <span className="font-semibold text-[var(--subtitle-color)] block">Status</span>
                                {canUpdateStatus ? (
                                    <select
                                        value={task?.status || "Pending"}
                                        onChange={(e) => handleStatusChange(e.target.value)}
                                        className="mt-1 rounded-md border border-[var(--border-color)] bg-[var(--surface-card)] px-2 py-1 text-sm outline-none focus:border-[var(--title-color)]"
                                    >
                                        <option value="Pending">Pending</option>
                                        <option value="In Progress">In Progress</option>
                                        <option value="Completed">Completed</option>
                                    </select>
                                ) : (
                                    <span className={`inline-block mt-1 font-semibold ${
                                        task?.status === "Completed" ? "text-green-600" :
                                        task?.status === "In Progress" ? "text-blue-600" : "text-amber-600"
                                    }`}>
                                        {task?.status}
                                    </span>
                                )}
                            </div>
                            <div>
                                <span className="font-semibold text-[var(--subtitle-color)] block">Priority</span>
                                <span className={`inline-block mt-1 font-semibold ${
                                    task?.priority === "Critical" ? "text-red-600" :
                                    task?.priority === "High" ? "text-orange-600" :
                                    task?.priority === "Medium" ? "text-blue-600" : "text-[var(--subtitle-color)]"
                                }`}>
                                    {task?.priority}
                                </span>
                            </div>
                            <div>
                                <span className="font-semibold text-[var(--subtitle-color)] block">Assignee</span>
                                <span className="inline-block mt-1 font-medium text-[var(--title-color)]">
                                    {task?.assignee?.fullName || "Unassigned"}
                                </span>
                            </div>
                            <div>
                                <span className="font-semibold text-[var(--subtitle-color)] block">Project</span>
                                <span className="inline-block mt-1 font-medium text-[var(--title-color)]">
                                    {task?.project?.projectName || "Legacy task"}
                                </span>
                            </div>
                            <div>
                                <span className="font-semibold text-[var(--subtitle-color)] block">Deadline</span>
                                <span className="inline-block mt-1 font-medium text-[var(--title-color)]">
                                    {task?.deadline ? new Date(task.deadline).toLocaleDateString() : "No deadline"}
                                </span>
                            </div>
                        </div>

                        {/* Description */}
                        <div>
                            <h3 className="font-semibold text-[var(--title-color)]">Description</h3>
                            <p className="mt-2 text-[var(--subtitle-color)] leading-relaxed bg-[var(--surface-muted)] p-4 rounded-md border">
                                {task?.description || "No description provided."}
                            </p>
                        </div>

                        {/* Subtasks (Checklist) */}
                        <div>
                            <div className="flex items-center gap-2 font-semibold text-[var(--title-color)]">
                                <FiCheckSquare />
                                <h3>Subtasks Checklist</h3>
                            </div>
                            {canManageTask && (
                                <form onSubmit={handleAddSubtask} className="mt-3 flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Add subtask..."
                                        value={newSubtask}
                                        onChange={(e) => setNewSubtask(e.target.value)}
                                        className="flex-1 rounded-md border border-[var(--border-color)] px-4 py-2 outline-none focus:border-[var(--title-color)] focus:ring-2 focus:ring-gray-200"
                                    />
                                    <button type="submit" className="rounded-md bg-[var(--accent)] px-4 text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)]">
                                        <FiPlus />
                                    </button>
                                </form>
                            )}
                            <div className="mt-4 space-y-2">
                                {task?.subtasks?.map((sub) => (
                                    <div key={sub._id} className="flex items-center justify-between rounded-md border p-3 hover:bg-[var(--surface-muted)]">
                                        <label className="flex items-center gap-3 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={sub.isCompleted}
                                                onChange={(e) => handleToggleSubtask(sub._id, e.target.checked)}
                                                className="h-5 w-5 rounded border-[var(--border-color)] text-black focus:ring-black cursor-pointer"
                                            />
                                            <span className={sub.isCompleted ? "line-through text-[var(--muted-color)]" : "text-[var(--title-color)]"}>
                                                {sub.title}
                                            </span>
                                        </label>
                                        {canManageTask && (
                                            <button onClick={() => handleDeleteSubtask(sub._id)} className="text-red-500 hover:text-red-700">
                                                <FiTrash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Attachments */}
                        <div>
                            <div className="flex items-center gap-2 font-semibold text-[var(--title-color)]">
                                <FiPaperclip />
                                <h3>Attachments (Links)</h3>
                            </div>
                            {canManageTask && (
                                <form onSubmit={handleAddAttachment} className="mt-3 grid grid-cols-2 gap-2">
                                    <input
                                        type="text"
                                        placeholder="Link name (e.g. Figma)"
                                        value={attachment.name}
                                        onChange={(e) => setAttachment({ ...attachment, name: e.target.value })}
                                        className="rounded-md border border-[var(--border-color)] px-4 py-2 outline-none focus:border-[var(--title-color)] focus:ring-2 focus:ring-gray-200"
                                    />
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            placeholder="URL (https://...)"
                                            value={attachment.url}
                                            onChange={(e) => setAttachment({ ...attachment, url: e.target.value })}
                                            className="flex-1 rounded-md border border-[var(--border-color)] px-4 py-2 outline-none focus:border-[var(--title-color)] focus:ring-2 focus:ring-gray-200"
                                        />
                                        <button type="submit" className="rounded-md bg-[var(--accent)] px-4 text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)]">
                                            <FiPlus />
                                        </button>
                                    </div>
                                </form>
                            )}
                            <div className="mt-4 space-y-2">
                                {task?.attachments?.map((att) => (
                                    <div key={att._id} className="flex items-center justify-between rounded-md border p-3 hover:bg-[var(--surface-muted)]">
                                        <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                            {att.name}
                                        </a>
                                        {canManageTask && (
                                            <button onClick={() => handleDeleteAttachment(att._id)} className="text-red-500 hover:text-red-700">
                                                <FiTrash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {canUpdateStatus && <form className="flex items-center gap-3" onSubmit={async e => {
                            e.preventDefault();
                            const progress = Number(new FormData(e.currentTarget).get("progress"));
                            try { await updateTask(taskId, { progress }); setTask((await getTask(taskId)).data); onTaskUpdated(); }
                            catch { setError("Failed to update progress."); }
                        }}>
                            <label>Progress (%) <input key={task?.progress} name="progress" type="number" min="0" max="100" required defaultValue={task?.progress || 0} className="w-20 rounded border border-[var(--border-color)] bg-[var(--surface-card)] p-2" /></label>
                            <button className="rounded bg-[var(--accent)] px-3 py-2 text-[var(--accent-contrast)]">Save progress</button>
                        </form>}
                        {/* Comments */}
                        <div>
                            <div className="flex items-center gap-2 font-semibold text-[var(--title-color)]">
                                <FiMessageSquare />
                                <h3>Discussion Comments</h3>
                            </div>
                            {canManageTask && <form onSubmit={handleAddComment} className="mt-3 flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Ask a question or post update..."
                                    value={commentText}
                                    onChange={(e) => setCommentText(e.target.value)}
                                    className="flex-1 rounded-md border border-[var(--border-color)] px-4 py-2 outline-none focus:border-[var(--title-color)] focus:ring-2 focus:ring-gray-200"
                                />
                                <button type="submit" className="rounded-md bg-[var(--accent)] px-6 text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)]">
                                    Comment
                                </button>
                            </form>}
                            <div className="mt-6 space-y-4">
                                {task?.comments?.map((com) => (
                                    <div key={com._id} className="rounded-md border p-4 bg-[var(--surface-muted)]/50">
                                        <div className="flex items-center justify-between text-xs text-[var(--subtitle-color)]">
                                            <span className="font-semibold text-[var(--title-color)]">{com.user?.fullName}</span>
                                            <div className="flex items-center gap-3">
                                                <span>{new Date(com.createdAt).toLocaleString()}</span>
                                                {canManageTask && <button onClick={() => handleDeleteComment(com._id)} className="text-red-500 hover:text-red-700">
                                                    Delete
                                                </button>}
                                            </div>
                                        </div>
                                        <p className="mt-2 text-sm text-[var(--title-color)]">{com.text}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                <div className="border-t p-6 bg-[var(--surface-muted)] flex justify-between gap-3">
                    {canManageTask ? (
                        <button
                            onClick={() => onDelete(task?._id)}
                            className="rounded-md bg-red-500 px-5 py-3 text-white hover:bg-red-600 transition font-medium"
                        >
                            Delete Task
                        </button>
                    ) : <span />}
                    <button
                        onClick={onClose}
                        className="rounded-md border border-[var(--border-color)] px-5 py-3 bg-[var(--surface-card)] hover:bg-[var(--surface-muted)] transition"
                    >
                        Close Details
                    </button>
                </div>
            </div>
        </div>
    );
}






