import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useCallback } from "react";
import {
  getProjects,
  createProject,
  updateProject,
  deleteProject,
} from "../../services/projectService";
import { getTeams } from "../../services/teamService";
import {
  canDeleteProject,
  canManageProjects,
  getCurrentUserId,
  getId,
  getTeamRole,
} from "../../utils/rbac";

const ProjectsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [projects, setProjects] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    team: "",
    sort: "",
  });

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [formData, setFormData] = useState({
    projectName: "",
    team: "",
    description: "",
    status: "Active",
    priority: "Medium",
    startDate: "",
    deadline: "",
    technologies: "",
    githubRepo: "",
    deploymentLink: "",
  });

  const fetchProjects = useCallback(async (activeFilters = filters) => {
    try {
      setError("");
      const params = Object.fromEntries(
        Object.entries(activeFilters).filter(([, value]) => value)
      );
      const [projectRes, teamRes] = await Promise.all([getProjects(params), getTeams()]);
      setProjects(projectRes.data.data);
      setTeams(teamRes.data);
    } catch (error) {
      console.error(error);
      setError(error.response?.data?.message || "Failed to load projects.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchProjects(filters);
  }, [fetchProjects, filters]);

  useEffect(() => {
    if (!location.state?.editProjectId || projects.length === 0) {
      return;
    }

    const project = projects.find(
      (p) => p._id === location.state.editProjectId
    );

    if (project) {
      openEditModal(project);
    }

    // Clear navigation state so refreshing doesn't reopen the modal
    navigate("/projects", { replace: true, state: {} });
  }, [location.state, navigate, projects]);

  const currentUserId = getCurrentUserId();
  const manageableTeams = teams.filter((team) =>
    canManageProjects(getTeamRole(team, currentUserId))
  );
  const canCreateProject = manageableTeams.length > 0;

  const projectRole = (project) => {
    return getTeamRole(project.team, currentUserId);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      ...formData,
      technologies: formData.technologies
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    };

    try {
      setError("");
      if (editingId) {
        await updateProject(editingId, payload);
      } else {
        await createProject(payload);
      }

      setShowModal(false);
      setEditingId(null);

      setFormData({
        projectName: "",
        team: "",
        description: "",
        status: "Active",
        priority: "Medium",
        startDate: "",
        deadline: "",
        technologies: "",
        githubRepo: "",
        deploymentLink: "",
      });

      fetchProjects();
    } catch (error) {
      console.error(error);
      setError(error.response?.data?.message || "Failed to save project.");
    }
  };

  const handleDelete = async (id) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this project?"
    );

    if (!confirmDelete) return;

    try {
      setError("");
      await deleteProject(id);
      setProjects(projects.filter((p) => p._id !== id));
    } catch (error) {
      console.error(error);
      setError(error.response?.data?.message || "Failed to delete project.");
    }
  };

  const openCreateModal = () => {
    setEditingId(null);

    setFormData({
      projectName: "",
      team: manageableTeams[0]?._id || "",
      description: "",
      status: "Active",
      priority: "Medium",
      startDate: "",
      deadline: "",
      technologies: "",
      githubRepo: "",
      deploymentLink: "",
    });

    setShowModal(true);
  };

  function openEditModal(project) {
    setEditingId(project._id);

    setFormData({
      projectName: project.projectName || "",
      team: getId(project.team) || "",
      description: project.description || "",
      status: project.status || "Active",
      priority: project.priority || "Medium",
      startDate: project.startDate?.slice(0, 10) || "",
      deadline: project.deadline?.slice(0, 10) || "",
      technologies: project.technologies?.join(", ") || "",
      githubRepo: project.githubRepo || "",
      deploymentLink: project.deploymentLink || "",
    });

    setShowModal(true);
  }

  if (loading) {
    return <div className="app-page">Loading projects...</div>;
  }

  return (
    <div className="app-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="page-description">
            Manage your startup projects and deployments
          </p>
        </div>

        {canCreateProject && (
          <button
            onClick={openCreateModal}
            className="ui-button ui-button-primary"
          >
            + New Project
          </button>
        )}
      </div>

      {error && (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <div className="md:col-span-2 xl:col-span-3 grid gap-3 rounded-lg border border-[var(--border-color)] bg-[var(--surface-card)] p-3 md:grid-cols-4">
          <input
            type="search"
            value={filters.search}
            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
            placeholder="Search projects"
            className="ui-input"
          />
          <select
            value={filters.status}
            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
            className="ui-input"
          >
            <option value="">All statuses</option>
            <option value="Planning">Planning</option>
            <option value="Active">Active</option>
            <option value="On Hold">On Hold</option>
            <option value="Completed">Completed</option>
          </select>
          <select
            value={filters.team}
            onChange={(e) => setFilters((prev) => ({ ...prev, team: e.target.value }))}
            className="ui-input"
          >
            <option value="">All teams</option>
            {teams.map((team) => (
              <option key={team._id} value={team._id}>
                {team.teamName}
              </option>
            ))}
          </select>
          <select
            value={filters.sort}
            onChange={(e) => setFilters((prev) => ({ ...prev, sort: e.target.value }))}
            className="ui-input"
          >
            <option value="">Newest first</option>
            <option value="deadline">Deadline</option>
          </select>
        </div>

        {projects.map((project) => (
          <div
            key={project._id}
            className="ui-card ui-card-hover h-fit p-5"
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-base font-semibold">
                  {project.projectName}
                </h2>
                <p className="text-sm text-[var(--subtitle-color)] mt-1">
                  {project.team?.teamName || "Legacy project"} • {project.priority} priority
                </p>
              </div>

              <span className="ui-badge badge-success">
                {project.status}
              </span>
            </div>

            <p className="text-[var(--subtitle-color)] mb-4 line-clamp-3">
              {project.description}
            </p>

            {project.technologies?.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {project.technologies.map((tech) => (
                  <span
                    key={tech}
                    className="ui-badge badge-neutral"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            )}

            <div className="space-y-1 text-sm text-[var(--subtitle-color)] mb-4">
              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span>Progress</span>
                  <span>{project.progress || 0}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--hover-bg)]">
                  <div
                    className="h-full rounded-full bg-[var(--title-color)]"
                    style={{ width: `${project.progress || 0}%` }}
                  />
                </div>
              </div>
              <p>
                <span className="font-medium">Start:</span>{' '}
                {project.startDate?.slice(0, 10) || "Not set"}
              </p>
              <p>
                <span className="font-medium">Deadline:</span>{' '}
                {project.deadline?.slice(0, 10) || "Not set"}
              </p>
            </div>

            <div className="flex gap-2 mb-4 flex-wrap">
              {project.githubRepo && (
                <a
                  href={project.githubRepo}
                  target="_blank"
                  rel="noreferrer"
                  className="ui-button ui-button-secondary"
                >
                  GitHub
                </a>
              )}

              {project.deploymentLink && (
                <a
                  href={project.deploymentLink}
                  target="_blank"
                  rel="noreferrer"
                  className="ui-button ui-button-secondary"
                >
                  Live
                </a>
              )}
            </div>

            <div className="flex gap-2 flex-wrap">
              <button
                className="ui-button ui-button-secondary"
                onClick={() => navigate(`/projects/${project._id}`)}
              >
                View
              </button>

              {canManageProjects(projectRole(project)) && (
                <button
                  onClick={() => openEditModal(project)}
                  className="ui-button ui-button-secondary"
                >
                  Edit
                </button>
              )}

              {canDeleteProject(projectRole(project)) && (
                <button
                  onClick={() => handleDelete(project._id)}
                  className="ui-button border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:hover:bg-red-950/30"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="ui-modal-panel w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <h2 className="mb-6 text-xl font-semibold">
              {editingId ? "Edit Project" : "Create Project"}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <select
                value={formData.team}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    team: e.target.value,
                  })
                }
                className="ui-input"
                required
              >
                <option value="">Select team</option>
                {manageableTeams.map((team) => (
                  <option key={team._id} value={team._id}>
                    {team.teamName}
                  </option>
                ))}
              </select>

              <input
                type="text"
                placeholder="Project name"
                value={formData.projectName}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    projectName: e.target.value,
                  })
                }
                className="ui-input"
                required
              />

              <textarea
                placeholder="Project description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    description: e.target.value,
                  })
                }
                className="ui-input"
                rows={4}
                required
              />

              <div className="grid grid-cols-2 gap-3">
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      startDate: e.target.value,
                    })
                  }
                  className="ui-input"
                />

                <input
                  type="date"
                  value={formData.deadline}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      deadline: e.target.value,
                    })
                  }
                  className="ui-input"
                />
              </div>

              <input
                type="text"
                placeholder="React, Node, MongoDB"
                value={formData.technologies}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    technologies: e.target.value,
                  })
                }
                className="ui-input"
              />

              <input
                type="url"
                placeholder="GitHub repository URL"
                value={formData.githubRepo}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    githubRepo: e.target.value,
                  })
                }
                className="ui-input"
              />

              <input
                type="url"
                placeholder="Live deployment URL"
                value={formData.deploymentLink}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    deploymentLink: e.target.value,
                  })
                }
                className="ui-input"
              />

              <div className="grid grid-cols-2 gap-3">
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      status: e.target.value,
                    })
                  }
                  className="ui-input"
                >
                  <option>Active</option>
                  <option>Planning</option>
                  <option>Completed</option>
                  <option>On Hold</option>
                </select>

                <select
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      priority: e.target.value,
                    })
                  }
                  className="ui-input"
                >
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                  <option>Critical</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingId(null);
                  }}
                  className="ui-button ui-button-secondary"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="ui-button ui-button-primary"
                >
                  {editingId ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectsPage;





