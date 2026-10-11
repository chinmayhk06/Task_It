import { useState, useEffect } from "react";
import {
    FiUsers, FiPlus, FiEdit2, FiTrash2, FiSearch,
    FiX, FiShield, FiUserCheck, FiUserX
} from "react-icons/fi";
import {
    getUsers, createUser, updateUser, deleteUser, assignRole, toggleActivate
} from "../../services/userService";

const ROLES = ["Admin", "Team Lead", "Member"];

const ROLE_COLORS = Object.fromEntries(ROLES.map(role => [role, "bg-[var(--hover-bg)] text-[var(--title-color)]"]));

function getInitials(name) {
    return (name || "?").split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

// Section
function UserModal({ user, onClose, onSave }) {
    const isEdit = Boolean(user?._id);
    const [form, setForm] = useState({
        fullName: user?.fullName || "",
        email: user?.email || "",
        password: "",
        role: user?.role || "Member",
        department: user?.department || "",
        phone: user?.phone || "",
        jobTitle: user?.jobTitle || "",
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        if (!form.fullName || !form.email) return setError("Full name and email are required.");
        if (!isEdit && !form.password) return setError("Password is required for new users.");
        setLoading(true);
        try {
            if (isEdit) {
                const payload = { fullName: form.fullName, email: form.email, role: form.role, department: form.department, phone: form.phone, jobTitle: form.jobTitle };
                await updateUser(user._id, payload);
            } else {
                await createUser(form);
            }
            onSave();
            onClose();
        } catch (err) {
            setError(err?.response?.data?.message || "Operation failed.");
        } finally {
            setLoading(false);
        }
    };

    const field = (label, key, type = "text", placeholder = "") => (
        <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--subtitle-color)]">{label}</label>
            <input
                type={type}
                value={form[key]}
                placeholder={placeholder}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                className="w-full rounded-md border border-[var(--border-color)] px-3 py-2 text-sm outline-none focus:border-[var(--title-color)] focus:ring-1 focus:ring-gray-200"
            />
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg bg-[var(--surface-card)] dark:bg-zinc-900 border border-[var(--border-color)] dark:border-zinc-800 rounded-md  text-[var(--title-color)] dark:text-zinc-100">
                <div className="flex items-center justify-between border-b border-[var(--border-color)] dark:border-zinc-800 px-6 py-4">
                    <h2 className="text-lg font-bold text-[var(--title-color)] dark:text-zinc-50">{isEdit ? "Edit User" : "Create User"}</h2>
                    <button onClick={onClose} className="rounded-md p-2 hover:bg-[var(--hover-bg)] transition"><FiX size={18} /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">{field("Full Name *", "fullName", "text", "Jane Doe")}</div>
                        <div className="col-span-2">{field("Job title (optional)", "jobTitle")}</div>
                        <div className="col-span-2">{field("Email *", "email", "email", "jane@example.com")}</div>
                        {!isEdit && <div className="col-span-2">{field("Password *", "password", "password", "Min 8 characters")}</div>}
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-[var(--subtitle-color)]">Role</label>
                            <select
                                value={form.role}
                                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                                className="w-full rounded-md border border-[var(--border-color)] px-3 py-2 text-sm outline-none focus:border-[var(--title-color)]"
                            >
                                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>
                        <div>{field("Department", "department", "text", "Engineering")}</div>
                        <div className="col-span-2">{field("Phone", "phone", "text", "+91 9999999999")}</div>
                    </div>
                    {error && <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{error}</p>}
                    <div className="flex justify-end gap-2 pt-1">
                        <button type="button" onClick={onClose} className="rounded-md border border-[var(--border-color)] px-4 py-2 text-sm font-medium text-[var(--subtitle-color)] hover:bg-[var(--surface-muted)] transition">Cancel</button>
                        <button type="submit" disabled={loading}
                            className="flex items-center gap-2 rounded-md bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)] disabled:opacity-60 transition">
                            {loading ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : null}
                            {isEdit ? "Save Changes" : "Create User"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// Section
function RoleModal({ user, onClose, onSave }) {
    const [role, setRole] = useState(user.role);
    const [loading, setLoading] = useState(false);

    const handleSave = async () => {
        setLoading(true);
        try {
            await assignRole(user._id, role);
            onSave();
            onClose();
        } catch (err) { alert(err.response?.data?.message || "Failed to update role."); }
        finally { setLoading(false); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm bg-[var(--surface-card)] dark:bg-zinc-900 border border-[var(--border-color)] dark:border-zinc-800 rounded-md  text-[var(--title-color)] dark:text-zinc-100 p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-[var(--hover-bg)]">
                    <FiShield size={18} className="text-[var(--title-color)]" />
                </div>
                <h3 className="mb-1 text-lg font-bold text-[var(--title-color)] dark:text-zinc-50">Assign Role</h3>
                <p className="mb-4 text-sm text-[var(--subtitle-color)] dark:text-zinc-400">Changing role for <span className="font-semibold text-[var(--title-color)] dark:text-zinc-100">{user.fullName}</span></p>
                <select value={role} onChange={e => setRole(e.target.value)}
                    className="w-full rounded-md border border-[var(--border-color)] px-3 py-2 text-sm outline-none focus:border-[var(--title-color)] mb-4">
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <div className="flex gap-2">
                    <button onClick={onClose} className="flex-1 rounded-md border border-[var(--border-color)] py-2 text-sm font-medium text-[var(--subtitle-color)] hover:bg-[var(--surface-muted)] transition">Cancel</button>
                    <button onClick={handleSave} disabled={loading}
                        className="flex-1 rounded-md bg-[var(--accent)] py-2 text-sm font-semibold text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)] disabled:opacity-60 transition">
                        {loading ? "Saving..." : "Assign Role"}
                    </button>
                </div>
            </div>
        </div>
    );
}

// Section
function DeleteConfirm({ user, onConfirm, onCancel, loading }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm bg-[var(--surface-card)] dark:bg-zinc-900 border border-[var(--border-color)] dark:border-zinc-800 rounded-md  text-[var(--title-color)] dark:text-zinc-100 p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-red-50">
                    <FiTrash2 size={22} className="text-red-500" />
                </div>
                <h3 className="mb-1 text-lg font-bold text-[var(--title-color)] dark:text-zinc-50">Delete User</h3>
                <p className="text-sm text-[var(--subtitle-color)] dark:text-zinc-400">Delete <span className="font-semibold text-[var(--title-color)] dark:text-zinc-100">"{user.fullName}"</span>? This cannot be undone.</p>
                <div className="mt-5 flex gap-2">
                    <button onClick={onCancel} className="flex-1 rounded-md border border-[var(--border-color)] py-2 text-sm font-medium text-[var(--subtitle-color)] hover:bg-[var(--surface-muted)] transition">Cancel</button>
                    <button onClick={onConfirm} disabled={loading}
                        className="flex flex-1 items-center justify-center gap-2 rounded-md bg-red-500 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-60 transition">
                        {loading ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : null}
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
}

// Section
export default function UsersPage() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState("All");
    const [showCreate, setShowCreate] = useState(false);
    const [editUser, setEditUser] = useState(null);
    const [roleUser, setRoleUser] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [toggling, setToggling] = useState(null);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const res = await getUsers();
            setUsers(res.data.data || []);
        } catch { /* ignore */ }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchUsers(); }, []);

    const handleDelete = async () => {
        setDeleting(true);
        try {
            await deleteUser(deleteTarget._id);
            setUsers(prev => prev.filter(u => u._id !== deleteTarget._id));
            setDeleteTarget(null);
        } catch { alert("Failed to delete user."); }
        finally { setDeleting(false); }
    };

    const handleToggle = async (user) => {
        setToggling(user._id);
        try {
            await toggleActivate(user._id);
            setUsers(prev => prev.map(u => u._id === user._id ? { ...u, isActive: !u.isActive } : u));
        } catch { alert("Failed to update user status."); }
        finally { setToggling(null); }
    };

    const filtered = users.filter(u => {
        const matchSearch = !search ||
            u.fullName.toLowerCase().includes(search.toLowerCase()) ||
            u.email.toLowerCase().includes(search.toLowerCase());
        const matchRole = roleFilter === "All" || u.role === roleFilter;
        return matchSearch && matchRole;
    });

    return (
        <div className="min-h-full bg-[var(--main-bg)] dark:bg-zinc-950 p-8 transition-colors duration-200">
            <div className="mx-auto max-w-7xl">

                {/* Header */}
                <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-[var(--title-color)] dark:text-zinc-50">User Management</h1>
                        <p className="mt-1 text-[var(--subtitle-color)] dark:text-zinc-400">Manage team members, roles, and access.</p>
                    </div>
                    <button
                        id="create-user-btn"
                        onClick={() => setShowCreate(true)}
                        className="flex items-center gap-2 rounded-md bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)] transition "
                    >
                        <FiPlus size={16} /> Add User
                    </button>
                </div>

                {/* Filters */}
                <div className="mb-6 flex flex-wrap items-center gap-3">
                    <div className="relative">
                        <FiSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-color)]" />
                        <input
                            type="text"
                            placeholder="Search users..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-56 rounded-md border border-[var(--border-color)] dark:border-zinc-800 bg-[var(--surface-card)] dark:bg-zinc-900 py-2 pl-9 pr-4 text-sm text-[var(--title-color)] dark:text-zinc-100 outline-none focus:border-[var(--title-color)] focus:ring-1 focus:ring-gray-200"
                        />
                    </div>
                    <select
                        value={roleFilter}
                        onChange={e => setRoleFilter(e.target.value)}
                        className="rounded-md border border-[var(--border-color)] dark:border-zinc-800 bg-[var(--surface-card)] dark:bg-zinc-900 px-3 py-2 text-sm text-[var(--title-color)] dark:text-zinc-100 outline-none focus:border-[var(--title-color)]"
                    >
                        <option value="All">All Roles</option>
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <span className="text-sm text-[var(--subtitle-color)] dark:text-zinc-400">{filtered.length} user{filtered.length !== 1 ? "s" : ""}</span>
                </div>

                {/* Table */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--border-color)] border-t-[var(--title-color)]" />
                    </div>
                ) : (
                    <div className="bg-[var(--surface-card)] dark:bg-zinc-900 border border-[var(--border-color)] dark:border-zinc-800 rounded-md  text-[var(--title-color)] dark:text-zinc-100 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-[var(--border-color)] dark:border-zinc-800 bg-[var(--surface-muted)] dark:bg-zinc-900/50 text-left text-xs font-semibold uppercase tracking-wider text-[var(--subtitle-color)] dark:text-zinc-400">
                                    <th className="px-5 py-3.5">User</th>
                                    <th className="px-5 py-3.5">Role</th>
                                    <th className="px-5 py-3.5">Department</th>
                                    <th className="px-5 py-3.5">Status</th>
                                    <th className="px-5 py-3.5">Joined</th>
                                    <th className="px-5 py-3.5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="py-16 text-center text-[var(--muted-color)]">
                                            <FiUsers size={36} className="mx-auto mb-2 text-[var(--muted-color)]" />
                                            No users found
                                        </td>
                                    </tr>
                                ) : filtered.map(user => (
                                    <tr key={user._id} className="border-b border-[var(--border-color)] dark:border-zinc-800 hover:bg-[var(--surface-muted)]/70 dark:hover:bg-zinc-800/50 transition">
                                        {/* User */}
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold
                                                    ${user.isActive ? "bg-[var(--accent)] text-[var(--accent-contrast)]" : "bg-gray-200 text-[var(--subtitle-color)]"}`}>
                                                    {getInitials(user.fullName)}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-[var(--title-color)] dark:text-zinc-50">{user.fullName}</p>
                                                    <p className="text-xs text-[var(--subtitle-color)] dark:text-zinc-400">{user.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        {/* Role */}
                                        <td className="px-5 py-4">
                                            <span className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${ROLE_COLORS[user.role] || "bg-[var(--hover-bg)] text-[var(--subtitle-color)]"}`}>
                                                {user.role}
                                            </span>
                                        </td>
                                        {/* Department */}
                                        <td className="px-5 py-4 text-[var(--subtitle-color)]">{user.department || "-"}</td>
                                        {/* Status */}
                                        <td className="px-5 py-4">
                                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold
                                                ${user.isActive ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                                                <span className={`h-1.5 w-1.5 rounded-full ${user.isActive ? "bg-green-500" : "bg-red-400"}`} />
                                                {user.isActive ? "Active" : "Inactive"}
                                            </span>
                                        </td>
                                        {/* Joined */}
                                        <td className="px-5 py-4 text-[var(--muted-color)] text-xs">
                                            {new Date(user.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                                        </td>
                                        {/* Actions */}
                                        <td className="px-5 py-4">
                                            <div className="flex items-center justify-end gap-1">
                                                <button onClick={() => setEditUser(user)} title="Edit"
                                                    className="rounded-lg p-1.5 text-[var(--muted-color)] hover:bg-[var(--surface-muted)] hover:text-[var(--title-color)] transition">
                                                    <FiEdit2 size={14} />
                                                </button>
                                                <button onClick={() => setRoleUser(user)} title="Assign Role"
                                                    className="rounded-lg p-1.5 text-[var(--muted-color)] hover:bg-blue-50 hover:text-blue-600 transition">
                                                    <FiShield size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleToggle(user)}
                                                    disabled={toggling === user._id}
                                                    title={user.isActive ? "Deactivate" : "Activate"}
                                                    className={`rounded-lg p-1.5 transition
                                                        ${user.isActive
                                                            ? "text-[var(--muted-color)] hover:bg-amber-50 hover:text-amber-600"
                                                            : "text-[var(--muted-color)] hover:bg-green-50 hover:text-green-600"}`}
                                                >
                                                    {user.isActive ? <FiUserX size={14} /> : <FiUserCheck size={14} />}
                                                </button>
                                                <button onClick={() => setDeleteTarget(user)} title="Delete"
                                                    className="rounded-lg p-1.5 text-[var(--muted-color)] hover:bg-red-50 hover:text-red-500 transition">
                                                    <FiTrash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modals */}
            {showCreate && <UserModal onClose={() => setShowCreate(false)} onSave={fetchUsers} />}
            {editUser && <UserModal user={editUser} onClose={() => setEditUser(null)} onSave={fetchUsers} />}
            {roleUser && <RoleModal user={roleUser} onClose={() => setRoleUser(null)} onSave={fetchUsers} />}
            {deleteTarget && (
                <DeleteConfirm
                    user={deleteTarget}
                    onConfirm={handleDelete}
                    onCancel={() => setDeleteTarget(null)}
                    loading={deleting}
                />
            )}
        </div>
    );
}






