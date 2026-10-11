const Project = require("../models/Project");
const axios = require("axios");
const {
    ROLE,
    getAccessibleProjectIds,
    getManagedProjectIds,
    requireProjectAccess,
} = require("../utils/rbac");

// Helper: parse owner/repo from a GitHub URL
const parseGitHubUrl = (url) => {
    try {
        const match = url.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/.*)?$/);
        if (match) return { owner: match[1], repo: match[2] };
        return null;
    } catch {
        return null;
    }
};

// Helper: GitHub API request with optional token
const ghRequest = async (path, token) => {
    const headers = {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await axios.get(`https://api.github.com${path}`, { headers, timeout: 10000 });
    return res.data;
};

// GET /api/github/projects  — list projects that have a GitHub repo URL
const getLinkedProjects = async (req, res) => {
    try {
        const projectIds = await getAccessibleProjectIds(req.user._id);
        const projects = await Project.find({
            _id: { $in: projectIds },
            githubRepo: { $nin: [null, ""] },
        })
            .select("projectName description githubRepo status");
        res.json({ success: true, data: projects });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// PUT /api/github/projects/:id/repo  — update / set repo URL on a project
const setProjectRepo = async (req, res) => {
    try {
        const { githubRepo } = req.body;
        if (!githubRepo) {
            return res.status(400).json({ success: false, message: "githubRepo URL is required" });
        }
        await requireProjectAccess(req.params.id, req.user._id, [ROLE.ADMIN, ROLE.TEAM_LEAD]);
        const project = await Project.findByIdAndUpdate(
            req.params.id,
            { githubRepo },
            { new: true }
        ).select("projectName githubRepo");
        if (!project) return res.status(404).json({ success: false, message: "Project not found" });
        res.json({ success: true, data: project });
    } catch (err) {
        res.status(err.statusCode || 500).json({ success: false, message: err.message });
    }
};

// GET /api/github/repo-info?url=<github_url>  — fetch info, commits, contributors, issues
const getRepoInfo = async (req, res) => {
    try {
        const { url, projectId } = req.query;
        const token = req.headers["x-github-token"] || process.env.GITHUB_TOKEN || null;

        if (!url) return res.status(400).json({ success: false, message: "url query param is required" });

        if (projectId) {
            const { project } = await requireProjectAccess(projectId, req.user._id);
            if (project.githubRepo !== url) {
                return res.status(403).json({ success: false, message: "Repository is not linked to this project" });
            }
        } else {
            const projectIds = await getAccessibleProjectIds(req.user._id);
            const linkedProject = await Project.findOne({ _id: { $in: projectIds }, githubRepo: url }).select("_id");
            if (!linkedProject) {
                return res.status(403).json({ success: false, message: "Not authorized to inspect this repository" });
            }
        }

        const parsed = parseGitHubUrl(url);
        if (!parsed) return res.status(400).json({ success: false, message: "Invalid GitHub URL" });

        const { owner, repo } = parsed;

        // Fetch in parallel with Promise.allSettled to handle missing permissions gracefully
        const [repoRes, commitsRes, contributorsRes, issuesRes] = await Promise.allSettled([
            ghRequest(`/repos/${owner}/${repo}`, token),
            ghRequest(`/repos/${owner}/${repo}/commits?per_page=10`, token),
            ghRequest(`/repos/${owner}/${repo}/contributors?per_page=10`, token),
            ghRequest(`/repos/${owner}/${repo}/issues?state=open&per_page=10`, token),
        ]);

        const repoData    = repoRes.status === "fulfilled"         ? repoRes.value         : null;
        const commits     = commitsRes.status === "fulfilled"      ? commitsRes.value      : [];
        const contributors = contributorsRes.status === "fulfilled" ? contributorsRes.value : [];
        const issues      = issuesRes.status === "fulfilled"       ? issuesRes.value       : [];

        if (!repoData) {
            const errMsg = repoRes.reason?.response?.data?.message || "Could not fetch repo (may be private or not found)";
            return res.status(404).json({ success: false, message: errMsg });
        }

        res.json({
            success: true,
            data: {
                repo: {
                    name: repoData.full_name,
                    description: repoData.description,
                    stars: repoData.stargazers_count,
                    forks: repoData.forks_count,
                    watchers: repoData.subscribers_count,
                    openIssues: repoData.open_issues_count,
                    language: repoData.language,
                    defaultBranch: repoData.default_branch,
                    url: repoData.html_url,
                    updatedAt: repoData.updated_at,
                    topics: repoData.topics || [],
                },
                commits: commits.map(c => ({
                    sha: c.sha?.slice(0, 7),
                    message: c.commit?.message?.split("\n")[0] || "",
                    author: c.commit?.author?.name || "",
                    date: c.commit?.author?.date || "",
                    url: c.html_url,
                })),
                contributors: contributors.map(c => ({
                    login: c.login,
                    avatar: c.avatar_url,
                    contributions: c.contributions,
                    url: c.html_url,
                })),
                issues: issues
                    .filter(i => !i.pull_request) // exclude PRs
                    .map(i => ({
                        number: i.number,
                        title: i.title,
                        state: i.state,
                        labels: (i.labels || []).map(l => ({ name: l.name, color: l.color })),
                        author: i.user?.login,
                        url: i.html_url,
                        createdAt: i.created_at,
                    })),
            },
        });
    } catch (err) {
        res.status(err.statusCode || 500).json({ success: false, message: err.message });
    }
};

// GET /api/github/all-projects  — all projects (to allow linking)
const getAllProjects = async (req, res) => {
    try {
        const projectIds = await getManagedProjectIds(req.user._id);
        const projects = await Project.find({ _id: { $in: projectIds } }).select("projectName description githubRepo status");
        res.json({ success: true, data: projects });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

module.exports = { getLinkedProjects, setProjectRepo, getRepoInfo, getAllProjects };
