import { useCallback, useEffect, useState } from "react";
import {
    FiArrowLeft,
    FiEdit2,
    FiMail,
    FiTrash2,
    FiUserMinus,
    FiUsers,
} from "react-icons/fi";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getUsers } from "../../services/userService";

import {
    deleteTeam,
    getTeam,
    inviteMember,
    leaveTeam,
    removeMember,
    updateMemberRole,
    getInvitations, resendInvitation, revokeInvitation, reassignManager,
} from "../../services/teamService";
import {
    canDeleteTeam,
    canEditTeam,
    canManageMembers,
    getCurrentUserId,
    getTeamRole,
    normalizeRole,
} from "../../utils/rbac";

export default function TeamDetails() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [team, setTeam] = useState(null);
    const [email, setEmail] = useState("");
    const [inviteRole, setInviteRole] = useState("Intern");
    const [invitations, setInvitations] = useState([]);
    const [managerCandidates, setManagerCandidates] = useState([]);
    const [newManager, setNewManager] = useState("");
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const [currentUserId] = useState(getCurrentUserId);

    const currentTeamRole = getTeamRole(team, currentUserId);
    const canManageTeamMembers = canManageMembers(currentTeamRole);
    const canEditCurrentTeam = canEditTeam(currentTeamRole);
    const canDeleteCurrentTeam = canDeleteTeam(currentTeamRole);

    const fetchTeam = useCallback(async () => {
        try {
            setError("");
            const response = await getTeam(id);
            setTeam(response.data);
            if (getTeamRole(response.data, getCurrentUserId()) === "Admin") {
                const users = (await getUsers()).data.data;
                setManagerCandidates(users.filter(user => user.isActive && (["Admin", "Team Lead"].includes(user.role) || response.data.members.some(member => (member.user?._id || member.user) === user._id && member.role === "Team Lead"))));
            }
            if (canManageMembers(getTeamRole(response.data, getCurrentUserId()))) {
                setInvitations((await getInvitations(id)).data);
            } else { setInvitations([]); }
        } catch (err) {
            setError(
                err.response?.data?.message ||
                    "Failed to load team."
            );
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchTeam();
    }, [fetchTeam]);

    const handleInvite = async (e) => {
        e.preventDefault();

        if (!email.trim()) {
            setError("Member email is required");
            return;
        }

        try {
            setActionLoading(true);
            setError("");
            setSuccess("");
            await inviteMember(id, email.trim(), inviteRole);
            setEmail("");
            setSuccess("Invitation sent successfully.");
            await fetchTeam();
        } catch (err) {
            await fetchTeam();
            setError(
                err.response?.data?.message ||
                    "Failed to invite member."
            );
        } finally {
            setActionLoading(false);
        }
    };

    const handleInvitation = async (invitationId, resend) => {
        setActionLoading(true); setError(""); setSuccess("");
        try {
            await (resend ? resendInvitation : revokeInvitation)(id, invitationId);
            await fetchTeam();
            setSuccess(resend ? "Invitation resent." : "Invitation revoked.");
        } catch (err) { setError(err.response?.data?.message || "Unable to update invitation."); }
        finally { setActionLoading(false); }
    };

    const handleTransfer = async () => {
        if (!newManager || !confirm("Reassign the team manager? The previous manager will become an Intern.")) return;
        setActionLoading(true); setError("");
        try { await reassignManager(id, newManager); setNewManager(""); await fetchTeam(); setSuccess("Manager reassigned."); }
        catch (err) { setError(err.response?.data?.message || "Unable to reassign manager."); }
        finally { setActionLoading(false); }
    };

    const handleRemoveMember = async (userId) => {
        if (!confirm("Remove this member from the team?")) return;

        try {
            setActionLoading(true);
            setError("");
            setSuccess("");
            await removeMember(id, userId);
            setSuccess("Member removed successfully.");
            await fetchTeam();
        } catch (err) {
            setError(
                err.response?.data?.message ||
                    "Failed to remove member."
            );
        } finally {
            setActionLoading(false);
        }
    };

    const handleRoleChange = async (userId, role) => {
        try {
            setActionLoading(true);
            setError("");
            setSuccess("");
            await updateMemberRole(id, userId, role);
            setSuccess("Member role updated successfully.");
            await fetchTeam();
        } catch (err) {
            setError(
                err.response?.data?.message ||
                    "Failed to update member role."
            );
        } finally {
            setActionLoading(false);
        }
    };

    const handleLeaveTeam = async () => {
        if (!confirm("Leave this team?")) return;

        try {
            setActionLoading(true);
            await leaveTeam(id);
            navigate("/teams");
        } catch (err) {
            setError(
                err.response?.data?.message ||
                    "Failed to leave team."
            );
            setActionLoading(false);
        }
    };

    const handleDeleteTeam = async () => {
        if (!confirm("Delete this team permanently?")) return;

        try {
            setActionLoading(true);
            await deleteTeam(id);
            navigate("/teams");
        } catch (err) {
            setError(
                err.response?.data?.message ||
                    "Failed to delete team."
            );
            setActionLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="p-10 text-[var(--subtitle-color)]">
                Loading Team...
            </div>
        );
    }

    if (!team) {
        return (
            <div className="p-10">
                <p className="text-red-500">
                    {error || "Team not found."}
                </p>
            </div>
        );
    }

    return (
        <div className="app-page">
            <div className="mx-auto max-w-5xl">
                <Link
                    to="/teams"
                    className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-[var(--subtitle-color)] hover:text-[var(--title-color)]"
                >
                    <FiArrowLeft />
                    Back to teams
                </Link>

                <div className="mb-8 rounded-md border border-[var(--border-color)] bg-[var(--surface-card)] p-6 ">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <p className="text-sm font-medium text-[var(--subtitle-color)]">
                            Team
                        </p>

                        <h1 className="mt-1 text-3xl font-bold text-[var(--title-color)]">
                            {team.teamName}
                        </h1>

                        <p className="mt-2 max-w-2xl text-[var(--subtitle-color)]">
                            {team.description || "No description added yet."}
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        {canEditCurrentTeam ? (
                            <>
                                <Link
                                    to={`/teams/${id}/edit`}
                                    className="inline-flex items-center gap-2 rounded-md border border-[var(--border-color)] px-4 py-3 hover:bg-[var(--surface-card)]"
                                >
                                    <FiEdit2 />
                                    Edit
                                </Link>

                                {canDeleteCurrentTeam && (
                                    <button
                                        onClick={handleDeleteTeam}
                                        disabled={actionLoading}
                                        className="inline-flex items-center gap-2 rounded-md bg-red-500 px-4 py-3 text-white hover:bg-red-600 disabled:opacity-60"
                                    >
                                        <FiTrash2 />
                                        Delete
                                    </button>
                                )}
                            </>
                        ) : null}
                        {(team.manager?._id || team.manager) !== currentUserId && team.members.some(m => (m.user?._id || m.user) === currentUserId) && (
                            <button
                                onClick={handleLeaveTeam}
                                disabled={actionLoading}
                                className="rounded-md border border-red-200 px-4 py-3 text-red-500 hover:bg-red-50 disabled:opacity-60"
                            >
                                Leave Team
                            </button>
                        )}
                    </div>
                    </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
                    <div className="rounded-md border border-[var(--border-color)] bg-[var(--surface-card)] p-6 ">
                        <div className="mb-6 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-semibold">
                                    Members
                                </h2>

                                <p className="mt-1 text-sm text-[var(--subtitle-color)]">
                                    {team.members.length} people in this team
                                </p>
                            </div>

                            <FiUsers className="text-[var(--muted-color)]" size={24} />
                        </div>

                        <div className="divide-y divide-[var(--border-color)]">
                            {team.members.map((member) => {
                                const user = member.user;
                                const userId = user?._id || user;
                                const isManager =
                                    userId === (team.manager?._id || team.manager);

                                return (
                                    <div
                                        key={userId}
                                        className="flex items-center justify-between gap-4 py-4"
                                    >
                                        <div>
                                            <p className="font-medium">
                                                {user?.fullName || "Team Member"}
                                            </p>

                                            <p className="text-sm text-[var(--subtitle-color)]">
                                                {user?.email || "No email available"}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            {canManageTeamMembers && !isManager ? (
                                                <select
                                                    value={normalizeRole(member.role)}
                                                    onChange={(e) =>
                                                        handleRoleChange(userId, e.target.value)
                                                    }
                                                    disabled={actionLoading}
                                                    className="rounded-md border border-[var(--border-color)] bg-[var(--surface-card)] px-3 py-1 text-sm outline-none focus:border-[var(--title-color)]"
                                                >
                                                    <option value="Intern">Intern</option>
                                                    <option value="Team Lead">Team Lead</option>
                                                </select>
                                            ) : (
                                                <span className="rounded-full bg-[var(--hover-bg)] px-3 py-1 text-sm">
                                                    {normalizeRole(member.role)}
                                                </span>
                                            )}

                                            {canManageTeamMembers && !isManager && (
                                                <button
                                                    onClick={() =>
                                                        handleRemoveMember(userId)
                                                    }
                                                    disabled={actionLoading}
                                                    className="rounded-lg p-2 text-red-500 hover:bg-red-50 disabled:opacity-60"
                                                    title="Remove member"
                                                >
                                                    <FiUserMinus />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="rounded-md border border-[var(--border-color)] bg-[var(--surface-card)] p-6 lg:col-span-2">
                        <div className="mb-6 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-semibold">
                                    Projects
                                </h2>

                                <p className="mt-1 text-sm text-[var(--subtitle-color)]">
                                    {team.projects?.length || 0} projects in this team
                                </p>
                            </div>
                        </div>

                        {team.projects?.length > 0 ? (
                            <div className="grid gap-3 md:grid-cols-2">
                                {team.projects.map((project) => (
                                    <Link
                                        key={project._id}
                                        to={`/projects/${project._id}`}
                                        className="rounded-md border border-[var(--border-color)] p-4 hover:bg-[var(--hover-bg)]"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="font-medium text-[var(--title-color)]">
                                                    {project.projectName}
                                                </p>
                                                <p className="mt-1 line-clamp-2 text-sm text-[var(--subtitle-color)]">
                                                    {project.description || "No description."}
                                                </p>
                                            </div>

                                            <span className="ui-badge badge-neutral">
                                                {project.status}
                                            </span>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-[var(--subtitle-color)]">
                                No projects have been linked to this team yet.
                            </p>
                        )}
                    </div>

                    <div className="rounded-md border border-[var(--border-color)] bg-[var(--surface-card)] p-6 ">
                        <h2 className="text-xl font-semibold">
                            Team Actions
                        </h2>

                        <div className="mt-5 space-y-4">
                            <div className="rounded-md bg-[var(--surface-muted)] p-4">
                                <p className="text-sm text-[var(--subtitle-color)]">
                                    Manager
                                </p>

                                <p className="mt-1 font-medium">
                                    {team.manager?.fullName || "Team Manager"}
                                </p>
                            </div>

                            {canManageTeamMembers && (
                                <form
                                    onSubmit={handleInvite}
                                    className="space-y-3"
                                >
                                    <label className="block font-medium">
                                        Invite Member
                                    </label>

                                    <label className="block">Team role
                                        <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className="ml-2 rounded-md border border-[var(--border-color)] bg-[var(--surface-card)] p-2">
                                            <option value="Intern">Intern</option><option value="Team Lead">Team Lead</option>
                                        </select>
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) =>
                                                setEmail(e.target.value)
                                            }
                                            placeholder="name@example.com"
                                            className="min-w-0 flex-1 rounded-md border border-[var(--border-color)] px-4 py-3 outline-none focus:border-[var(--title-color)] focus:ring-2 focus:ring-gray-200"
                                        />

                                        <button
                                            type="submit"
                                            disabled={actionLoading}
                                            className="rounded-md bg-[var(--accent)] px-4 py-3 text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)] disabled:opacity-60"
                                            title="Invite member"
                                        >
                                            <FiMail />
                                        </button>
                                    </div>
                                </form>
                            )}

                            {currentTeamRole === "Admin" && <section className="space-y-3">
                                <label className="block">Reassign manager
                                    <select value={newManager} onChange={(e) => setNewManager(e.target.value)} className="mt-2 w-full rounded-md border border-[var(--border-color)] bg-[var(--surface-card)] p-2">
                                        <option value="">Choose a Team Lead</option>
                                        {managerCandidates.filter(user => user._id !== (team.manager?._id || team.manager)).map(user => <option key={user._id} value={user._id}>{user.fullName} ({user.email})</option>)}
                                    </select>
                                </label>
                                <button disabled={actionLoading || !newManager} className="underline disabled:opacity-50" onClick={handleTransfer}>Reassign manager</button>
                            </section>}
                            {canManageTeamMembers && <section className="space-y-3">
                                <h3 className="font-semibold">Pending invitations</h3>
                                {invitations.length === 0 && <p className="text-sm">No pending invitations.</p>}
                                {invitations.map((invitation) => <div key={invitation._id} className="rounded-md border border-[var(--border-color)] p-3 space-y-2">
                                    <p className="break-all">{invitation.email}</p>
                                    <p className="text-sm">{invitation.role} · {invitation.status}</p>
                                    <p className="text-sm">Expires {new Date(invitation.expiresAt).toLocaleString()}</p>
                                    <div className="flex gap-4">
                                        <button disabled={actionLoading} className="underline disabled:opacity-50" onClick={() => handleInvitation(invitation._id, true)}>Resend</button>
                                        <button disabled={actionLoading} className="underline disabled:opacity-50" onClick={() => handleInvitation(invitation._id, false)}>Revoke</button>
                                    </div>
                                </div>)}
                            </section>}
                            {error && (
                                <p className="text-sm text-red-500">
                                    {error}
                                </p>
                            )}

                            {success && (
                                <p className="text-sm text-green-600">
                                    {success}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}






