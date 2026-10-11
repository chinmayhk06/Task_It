import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import api from "../services/api";
import Login from "../pages/auth/Login";
import Register from "../pages/auth/Register";
import Dashboard from "../pages/dashboard/Dashboard";
import AppShell from "../components/layout/AppShell";

import TeamList from "../pages/team/TeamList";
import CreateTeam from "../pages/team/CreateTeam";
import TeamDetails from "../pages/team/TeamDetails";
import Invitation from "../pages/team/Invitation";
import EditTeam from "../pages/team/EditTeam";

import ProjectsPage from "../pages/projects/ProjectsPage";
import ProjectDetails from "../pages/projects/ProjectDetails";

import TaskList from "../pages/tasks/TaskList";
import Reports from "../pages/reports/Reports";
import DocumentsPage from "../pages/documents/DocumentsPage";
import UsersPage from "../pages/users/UsersPage";
import SettingsPage from "../pages/settings/SettingsPage";
import GitHubPage from "../pages/github/GitHubPage";
import { isAdmin, canCreateTeam, canViewReports } from "../utils/rbac";

function getStoredUser() {
    try {
        return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
        return {};
    }
}

function ProtectedRoute({ children, requireAdmin = false }) {
    const token = localStorage.getItem("token");
    const location = useLocation();
    const [profile, setProfile] = useState(null);
    useEffect(() => {
        let active = true;
        if (token) api.get("/auth/profile").then(({ data }) => {
            if (!active) return;
            localStorage.setItem("user", JSON.stringify(data.user));
            setProfile({ key: location.key, user: data.user });
        }).catch(() => { if (active) setProfile({ key: location.key, error: true }); });
        return () => { active = false; };
    }, [token, location.key]);
    const user = profile?.user || getStoredUser();

    if (!token || !user?.id) {
        return <Navigate to="/login" replace />;
    }

    if (profile?.key !== location.key) return <div className="app-page">Loading permissions...</div>;
    if (profile.error) return <div className="app-page">Unable to verify access. Please sign in again.</div>;
    if ((location.pathname === "/teams/new" && !canCreateTeam(user)) || (location.pathname === "/reports" && !canViewReports(user))) return <Navigate to="/dashboard" replace />;
    if (requireAdmin && !isAdmin(user)) {
        return <Navigate to="/dashboard" replace />;
    }

    return children;
}

function AppRoutes() {
    return (
        <Routes>
            {/* Public */}
            <Route path="/" element={<Login />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/invitations/:token" element={<Invitation />} />

            {/* Dashboard */}
            <Route path="/dashboard" element={<ProtectedRoute><AppShell activePage="dashboard"><Dashboard /></AppShell></ProtectedRoute>} />

            {/* Teams */}
            <Route path="/teams"          element={<ProtectedRoute><AppShell activePage="teams"><TeamList /></AppShell></ProtectedRoute>} />
            <Route path="/teams/new"      element={<ProtectedRoute><AppShell activePage="teams"><CreateTeam /></AppShell></ProtectedRoute>} />
            <Route path="/teams/:id"      element={<ProtectedRoute><AppShell activePage="teams"><TeamDetails /></AppShell></ProtectedRoute>} />
            <Route path="/teams/:id/edit" element={<ProtectedRoute><AppShell activePage="teams"><EditTeam /></AppShell></ProtectedRoute>} />

            {/* Projects */}
            <Route path="/projects"     element={<ProtectedRoute><AppShell activePage="projects"><ProjectsPage /></AppShell></ProtectedRoute>} />
            <Route path="/projects/:id" element={<ProtectedRoute><AppShell activePage="projects"><ProjectDetails /></AppShell></ProtectedRoute>} />

            {/* Tasks */}
            <Route path="/tasks" element={<ProtectedRoute><AppShell activePage="tasks"><TaskList /></AppShell></ProtectedRoute>} />

            {/* Reports */}
            <Route path="/reports" element={<ProtectedRoute><AppShell activePage="reports"><Reports /></AppShell></ProtectedRoute>} />

            {/* Documents */}
            <Route path="/documents" element={<ProtectedRoute><AppShell activePage="documents"><DocumentsPage /></AppShell></ProtectedRoute>} />

            {/* Users */}
            <Route path="/users" element={<ProtectedRoute requireAdmin><AppShell activePage="users"><UsersPage /></AppShell></ProtectedRoute>} />

            {/* Settings */}
            <Route path="/settings" element={<ProtectedRoute><AppShell activePage="settings"><SettingsPage /></AppShell></ProtectedRoute>} />

            {/* GitHub */}
            <Route path="/github" element={<ProtectedRoute><AppShell activePage="github"><GitHubPage /></AppShell></ProtectedRoute>} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" />} />
        </Routes>
    );
}

export default AppRoutes;





