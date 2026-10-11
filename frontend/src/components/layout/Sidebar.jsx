import { useNavigate } from "react-router-dom";
import {
    FiGrid,
    FiUsers,
    FiCheckSquare,
    FiFolder,
    FiBarChart2,
    FiFile,
    FiUserCheck,
    FiLogOut,
    FiSettings,
    FiGithub,
} from "react-icons/fi";
import { isAdmin, canViewReports } from "../../utils/rbac";

const menu = [
    { id: "dashboard",  label: "Dashboard",  icon: FiGrid },
    { id: "projects",   label: "Projects",   icon: FiFolder },
    { id: "teams",      label: "Teams",      icon: FiUsers },
    { id: "tasks",      label: "Tasks",      icon: FiCheckSquare },
    { id: "documents",  label: "Documents",  icon: FiFile },
    { id: "reports",    label: "Reports",    icon: FiBarChart2 },
    { id: "users",      label: "Users",      icon: FiUserCheck },
    { id: "github",     label: "GitHub",     icon: FiGithub },
    { id: "settings",   label: "Settings",   icon: FiSettings },
];

export default function Sidebar({ activePage, setActivePage, isOpen = false }) {
    const navigate = useNavigate();
    const user = (() => {
        try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; }
    })();
    const visibleMenu = menu.filter((item) => (item.id !== "users" || isAdmin(user)) && (item.id !== "reports" || canViewReports(user)));

    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/login");
    };

    return (
        <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-shrink-0 flex-col border-r border-[var(--border-color)] bg-[var(--sidebar-bg)] transition-transform duration-200 lg:static lg:translate-x-0 ${isOpen ? "translate-x-0" : "-translate-x-full"}`}>
            <div className="border-b border-[var(--border-color)] px-4 py-6">
                <div className="min-w-0">
                    <h1 className="truncate text-xl font-bold text-[var(--title-color)]">Task It</h1>
                    <p className="mt-1 text-sm text-[var(--subtitle-color)]">Team Workspace</p>
                </div>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-4">
                {visibleMenu.map((item) => {
                    const Icon = item.icon;
                    const isActive = activePage === item.id;
                    return (
                        <button
                            key={item.id}
                            id={`nav-${item.id}`}
                            onClick={() => setActivePage(item.id)}
                            className={`relative mb-1 flex h-9 w-full items-center gap-3 rounded-md px-3 text-sm font-medium transition
                                ${isActive
                                    ? "bg-[var(--nav-active-bg)] text-[var(--nav-active-text)]"
                                    : "text-[var(--nav-inactive)] hover:bg-[var(--hover-bg)] hover:text-[var(--title-color)]"
                                }`}
                        >
                            <Icon size={16} />
                            {item.label}
                        </button>
                    );
                })}
            </nav>

            <div className="border-t border-[var(--border-color)] p-3">
                <button
                    onClick={handleLogout}
                    className="flex h-9 w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-[var(--nav-inactive)] transition hover:bg-[var(--hover-bg)] hover:text-red-500"
                >
                    <FiLogOut size={16} />
                    Logout
                </button>
            </div>
        </aside>
    );
}






