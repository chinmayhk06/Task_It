import { FiArrowRight, FiUsers } from "react-icons/fi";
import { Link } from "react-router-dom";

export default function TeamCard({ team }) {
    const memberCount = team.members?.length || 0;
    const managerName = team.manager?.fullName || "Manager";

    return (
        <Link
            to={`/teams/${team._id}`}
            className="ui-card ui-card-hover group block p-5"
        >
            <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[var(--icon-bg)] text-[var(--icon-contrast)]">
                        <FiUsers size={20} />
                    </div>

                    <div className="min-w-0">
                        <h2 className="truncate text-lg font-semibold text-[var(--title-color)]">
                            {team.teamName}
                        </h2>

                        <p className="mt-1 text-sm text-[var(--subtitle-color)]">
                            Managed by {managerName}
                        </p>
                    </div>
                </div>

                <FiArrowRight className="mt-3 shrink-0 text-[var(--muted-color)] transition group-hover:translate-x-1 group-hover:text-[var(--title-color)]" />
            </div>

            <p className="mt-5 line-clamp-2 min-h-10 text-sm leading-5 text-[var(--subtitle-color)]">
                {team.description || "No description added yet."}
            </p>

            <div className="mt-6 flex items-center justify-between border-t border-[var(--border-color)] pt-4">

                <div className="flex items-center gap-2 text-sm text-[var(--subtitle-color)]">

                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--hover-bg)] font-semibold text-[var(--title-color)]">
                        {memberCount}
                    </span>

                    <span>
                        {memberCount === 1 ? "Member" : "Members"}
                    </span>

                </div>

                <span className="rounded-full bg-[var(--hover-bg)] px-3 py-1 text-sm text-[var(--subtitle-color)]">
                    {memberCount === 1 ? "Solo" : "Active"}
                </span>

            </div>

        </Link>
    );
}






