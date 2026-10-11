import { useCallback, useEffect, useState } from "react";
import { FiPlus, FiRefreshCw, FiUsers } from "react-icons/fi";

import { canCreateTeam } from "../../utils/rbac";
import { getTeams } from "../../services/teamService";

import TeamCard from "../../components/team/TeamCard";
import EmptyState from "../../components/team/EmptyState";
import CreateTeamModal from "../../components/team/CreateTeamModal";

export default function TeamList() {
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");
    const [showModal, setShowModal] = useState(false);

    const fetchTeams = useCallback(async () => {
        try {
            setError("");
            const data = await getTeams();
            setTeams(data.data);
        } catch (error) {
            console.error(error);
            setError(
                error.response?.data?.message ||
                    "Failed to load teams."
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchTeams();
    }, [fetchTeams]);

    const totalMembers = teams.reduce(
        (count, team) => count + (team.members?.length || 0),
        0
    );

    const handleRefresh = () => {
        setRefreshing(true);
        fetchTeams();
    };

    if (loading) {
        return (
            <div className="app-page">
                <div className="h-9 w-40 animate-pulse rounded-lg bg-gray-200" />
                <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                    {[1, 2, 3].map((item) => (
                        <div
                            key={item}
                            className="h-44 animate-pulse rounded-md border border-[var(--border-color)] bg-[var(--surface-card)]"
                        />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="app-page">
            <div className="mb-8 flex flex-col gap-5 border-b border-[var(--border-color)] pb-6 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <p className="text-sm font-medium text-[var(--subtitle-color)]">
                        Workspace
                    </p>

                    <h1 className="mt-1 text-3xl font-bold text-[var(--title-color)]">
                        Teams
                    </h1>

                    <p className="mt-2 text-[var(--subtitle-color)]">
                        Create, open, and manage your collaboration spaces.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-3 rounded-md border border-[var(--border-color)] bg-[var(--surface-card)] px-4 py-3 text-sm text-[var(--subtitle-color)]">
                        <FiUsers className="text-[var(--muted-color)]" />
                        <span>
                            {teams.length} teams
                        </span>
                        <span className="h-4 w-px bg-gray-200" />
                        <span>
                            {totalMembers} members
                        </span>
                    </div>

                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="inline-flex items-center gap-2 rounded-md border border-[var(--border-color)] bg-[var(--surface-card)] px-4 py-3 text-[var(--title-color)] hover:bg-[var(--hover-bg)] disabled:opacity-60"
                        title="Refresh teams"
                    >
                        <FiRefreshCw
                            className={refreshing ? "animate-spin" : ""}
                        />
                        Refresh
                    </button>

                    {canCreateTeam() && <button
                        onClick={() => setShowModal(true)}
                        className="inline-flex items-center gap-2 rounded-md bg-[var(--accent)] px-5 py-3 text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)]"
                    >
                        <FiPlus />
                        New Team
                    </button>}
                </div>
            </div>

            {error && (
                <div className="mb-6 rounded-md border border-red-100 bg-red-50 px-4 py-3 text-red-600">
                    {error}
                </div>
            )}

            {teams.length === 0 ? (
                <EmptyState onCreate={canCreateTeam() ? () => setShowModal(true) : undefined} />
            ) : (
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">

                    {teams.map((team) => (
                        <TeamCard
                            key={team._id}
                            team={team}
                        />
                    ))}

                </div>
            )}

            {showModal && (
                <CreateTeamModal
                    close={() => setShowModal(false)}
                    refresh={fetchTeams}
                />
            )}

        </div>
    );
}






