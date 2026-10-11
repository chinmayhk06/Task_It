import { FiPlus, FiUsers } from "react-icons/fi";

export default function EmptyState({ onCreate }) {
    return (
        <div className="flex min-h-80 flex-col items-center justify-center rounded-md border border-dashed border-[var(--border-color)] bg-[var(--surface-card)] px-6 py-16 text-center">

            <div className="flex h-14 w-14 items-center justify-center rounded-md bg-[var(--hover-bg)] text-[var(--subtitle-color)]">
                <FiUsers size={26} />
            </div>

            <h2 className="mt-5 text-xl font-semibold text-[var(--title-color)]">
                No Teams Yet
            </h2>

            <p className="mt-2 max-w-sm text-[var(--subtitle-color)]">
                {onCreate ? "Create your first team to start collaborating." : "Teams you join will appear here."}
            </p>

            {onCreate && <button
                onClick={onCreate}
                className="mt-6 inline-flex items-center gap-2 rounded-md bg-[var(--accent)] px-5 py-3 text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)]"
            >
                <FiPlus />
                New Team
            </button>}

        </div>
    );
}






