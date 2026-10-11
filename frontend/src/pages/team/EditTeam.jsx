import { useEffect, useState } from "react";
import { FiArrowLeft } from "react-icons/fi";
import { Link, useNavigate, useParams } from "react-router-dom";

import { getTeam, updateTeam } from "../../services/teamService";
import { canEditTeam, getTeamRole, getCurrentUserId } from "../../utils/rbac";

export default function EditTeam() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        teamName: "",
        description: "",
    });
    const [loading, setLoading] = useState(true);
    const [allowed, setAllowed] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchTeam = async () => {
            try {
                const response = await getTeam(id);
                setAllowed(canEditTeam(getTeamRole(response.data, getCurrentUserId())));
                setFormData({
                    teamName: response.data.teamName || "",
                    description: response.data.description || "",
                });
            } catch (err) {
                setError(
                    err.response?.data?.message ||
                        "Failed to load team."
                );
            } finally {
                setLoading(false);
            }
        };

        fetchTeam();
    }, [id]);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
        setError("");
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!allowed) return;

        if (!formData.teamName.trim()) {
            setError("Team name is required");
            return;
        }

        try {
            setSaving(true);
            await updateTeam(id, formData);
            navigate(`/teams/${id}`);
        } catch (err) {
            setError(
                err.response?.data?.message ||
                    "Failed to update team."
            );
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="p-10 text-[var(--subtitle-color)]">
                Loading Team...
            </div>
        );
    }

    if (!allowed) return <div className="app-page">{error || "Only Admins and Team Leads can edit this team."}</div>;
    return (
        <div className="app-page">
            <div className="mx-auto max-w-2xl">
                <Link
                    to={`/teams/${id}`}
                    className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-[var(--subtitle-color)] hover:text-[var(--title-color)]"
                >
                    <FiArrowLeft />
                    Back to team
                </Link>

                <div className="rounded-md border border-[var(--border-color)] bg-[var(--surface-card)] p-8 ">
                    <h1 className="text-3xl font-bold">
                        Edit Team
                    </h1>

                    <form
                        onSubmit={handleSubmit}
                        className="mt-8 space-y-6"
                    >
                        <div>
                            <label className="mb-2 block font-medium">
                                Team Name
                            </label>

                            <input
                                name="teamName"
                                value={formData.teamName}
                                onChange={handleChange}
                                className="w-full rounded-md border border-[var(--border-color)] px-4 py-3 outline-none focus:border-[var(--title-color)] focus:ring-2 focus:ring-gray-200"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block font-medium">
                                Description
                            </label>

                            <textarea
                                name="description"
                                rows={5}
                                value={formData.description}
                                onChange={handleChange}
                                className="w-full resize-none rounded-md border border-[var(--border-color)] px-4 py-3 outline-none focus:border-[var(--title-color)] focus:ring-2 focus:ring-gray-200"
                            />
                        </div>

                        {error && (
                            <p className="text-red-500">
                                {error}
                            </p>
                        )}

                        <div className="flex justify-end gap-4">
                            <Link
                                to={`/teams/${id}`}
                                className="rounded-md border border-[var(--border-color)] px-5 py-3 hover:bg-[var(--surface-muted)]"
                            >
                                Cancel
                            </Link>

                            <button
                                type="submit"
                                disabled={saving}
                                className="rounded-md bg-[var(--accent)] px-6 py-3 text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)] disabled:opacity-60"
                            >
                                {saving ? "Saving..." : "Save Changes"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}






