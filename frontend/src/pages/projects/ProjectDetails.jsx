import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getProjectById } from "../../services/projectService";
import { canManageProjects, getCurrentUserId, getTeamRole } from "../../utils/rbac";

const ProjectDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const res = await getProjectById(id);
        setProject(res.data.data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchProject();
  }, [id]);

  if (loading) {
    return (
      <div className="app-page">
        <p className="text-[var(--subtitle-color)]">Loading project...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="app-page">
        <h1 className="text-2xl font-bold mb-3">
          Project not found
        </h1>

        <button
          onClick={() => navigate("/projects")}
          className="border px-4 py-2 rounded-lg"
        >
          Back to Projects
        </button>
      </div>
    );
  }

  const currentUserId = getCurrentUserId();
  const role = getTeamRole(project.team, currentUserId);
  const canEditProject = canManageProjects(role);

  return (
    <div className="app-page">

      <div className="flex items-center justify-between mb-8">
        <div>
          <button
            onClick={() => navigate("/projects")}
            className="text-sm text-[var(--subtitle-color)] hover:text-[var(--title-color)] mb-3"
          >
            Back to Projects
          </button>

          <h1 className="text-3xl font-bold">
            {project.projectName}
          </h1>

          <p className="text-[var(--subtitle-color)] mt-2">
            {project.team?.teamName ? `${project.team.teamName} workspace` : "Project details and information"}
          </p>
        </div>

        {canEditProject && (
          <button
            onClick={() =>
              navigate("/projects", {
                  state: {
                      editProjectId: project._id,
                  },
              })
            }
            className="bg-[var(--accent)] text-[var(--accent-contrast)] px-4 py-2 rounded-lg"
          >
            Edit Project
          </button>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">

        {/* Description */}
        <div className="border rounded-lg p-6 bg-[var(--surface-card)]  md:col-span-2">
          <h2 className="text-lg font-semibold mb-3">
            Description
          </h2>

          <p className="text-[var(--subtitle-color)] leading-relaxed">
            {project.description || "No description provided."}
          </p>
        </div>

        {/* Status */}
        <div className="border rounded-lg p-6 bg-[var(--surface-card)] ">
          <h2 className="text-sm text-[var(--subtitle-color)] mb-2">
            Status
          </h2>

          <span className="inline-block px-3 py-1 rounded-full bg-[var(--hover-bg)] text-[var(--title-color)] text-sm">
            {project.status}
          </span>
        </div>

        <div className="border rounded-lg p-6 bg-[var(--surface-card)] md:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm text-[var(--subtitle-color)]">
              Progress
            </h2>
            <span className="text-sm font-semibold text-[var(--title-color)]">
              {project.progress || 0}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--hover-bg)]">
            <div
              className="h-full rounded-full bg-[var(--title-color)]"
              style={{ width: `${project.progress || 0}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-[var(--subtitle-color)]">
            {project.completedTasks || 0} of {project.totalTasks || 0} tasks completed
          </p>
        </div>

        {/* Priority */}
        <div className="border rounded-lg p-6 bg-[var(--surface-card)] ">
          <h2 className="text-sm text-[var(--subtitle-color)] mb-2">
            Priority
          </h2>

          <p className="font-semibold">
            {project.priority}
          </p>
        </div>

        {/* Start Date */}
        <div className="border rounded-lg p-6 bg-[var(--surface-card)] ">
          <h2 className="text-sm text-[var(--subtitle-color)] mb-2">
            Start Date
          </h2>

          <p>
            {project.startDate
              ? project.startDate.slice(0, 10)
              : "Not set"}
          </p>
        </div>

        {/* Deadline */}
        <div className="border rounded-lg p-6 bg-[var(--surface-card)] ">
          <h2 className="text-sm text-[var(--subtitle-color)] mb-2">
            Deadline
          </h2>

          <p>
            {project.deadline
              ? project.deadline.slice(0, 10)
              : "Not set"}
          </p>
        </div>

        {/* Technologies */}
        <div className="border rounded-lg p-6 bg-[var(--surface-card)]  md:col-span-2">
          <h2 className="text-lg font-semibold mb-4">
            Technologies
          </h2>

          <div className="flex flex-wrap gap-2">
            {project.technologies?.length > 0 ? (
              project.technologies.map((technology, index) => (
                <span
                  key={index}
                  className="px-3 py-1 rounded-full bg-[var(--hover-bg)] text-[var(--title-color)] text-sm"
                >
                  {technology}
                </span>
              ))
            ) : (
              <p className="text-[var(--subtitle-color)]">
                No technologies added.
              </p>
            )}
          </div>
        </div>

        {/* Links */}
        <div className="border rounded-lg p-6 bg-[var(--surface-card)]  md:col-span-2">
          <h2 className="text-lg font-semibold mb-4">
            Project Links
          </h2>

          <div className="space-y-3">

            {project.githubRepo ? (
              <div>
                <span className="text-sm text-[var(--subtitle-color)]">
                  GitHub Repository
                </span>

                <br />

                <a
                  href={project.githubRepo}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline break-all"
                >
                  {project.githubRepo}
                </a>
              </div>
            ) : (
              <p className="text-[var(--subtitle-color)]">
                No GitHub repository added.
              </p>
            )}

            {project.deploymentLink ? (
              <div>
                <span className="text-sm text-[var(--subtitle-color)]">
                  Deployment
                </span>

                <br />

                <a
                  href={project.deploymentLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline break-all"
                >
                  {project.deploymentLink}
                </a>
              </div>
            ) : (
              <p className="text-[var(--subtitle-color)]">
                No deployment link added.
              </p>
            )}

          </div>
        </div>

      </div>

      <div className="mt-6 rounded-lg border border-[var(--border-color)] bg-[var(--surface-card)] p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Project Tasks</h2>
            <p className="text-sm text-[var(--subtitle-color)]">
              {project.tasks?.length || 0} tasks linked to this project
            </p>
          </div>
        </div>

        {project.tasks?.length > 0 ? (
          <div className="divide-y divide-[var(--border-color)]">
            {project.tasks.map((task) => (
              <div key={task._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium text-[var(--title-color)]">{task.title}</p>
                  <p className="text-sm text-[var(--subtitle-color)]">
                    {task.assignee?.fullName || "Unassigned"} • {task.deadline ? task.deadline.slice(0, 10) : "No deadline"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="ui-badge badge-neutral">{task.priority}</span>
                  <span className="ui-badge badge-info">{task.status}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--subtitle-color)]">No tasks have been created for this project yet.</p>
        )}
      </div>
    </div>
  );
};

export default ProjectDetails;





