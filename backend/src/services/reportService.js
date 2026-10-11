const Task = require('../models/Task');
const Project = require('../models/Project');
const Team = require('../models/Team');
const { getManagedTeamIds, getManagedProjectIds, getActor, getAccountCapabilities } = require('../utils/rbac');

const requireReportProjects = async (userId) => {
    const projectIds = await getManagedProjectIds(userId);
    if (!(await getAccountCapabilities(await getActor(userId))).canViewReports) {
        const error = new Error('Insufficient report permissions');
        error.statusCode = 403;
        throw error;
    }
    return projectIds;
};

// 1. Project Report
const getProjectReport = async (userId) => {
    const projectIds = await requireReportProjects(userId);
    const projects = await Project.find({ _id: { $in: projectIds } })
        .populate('owner', 'fullName email')
        .populate('team', 'teamName')
        .sort({ createdAt: -1 });

    return projects.map((p) => ({
        name: p.projectName,
        description: p.description,
        status: p.status,
        priority: p.priority,
        owner: p.owner?.fullName || 'N/A',
        team: p.team?.teamName || '-',
        startDate: p.startDate ? new Date(p.startDate).toLocaleDateString() : '-',
        deadline: p.deadline ? new Date(p.deadline).toLocaleDateString() : '-',
        githubRepo: p.githubRepo || '-',
        deploymentLink: p.deploymentLink || '-',
        technologies: (p.technologies || []).join(', ') || '-',
    }));
};

// 2. Team Report
const getTeamReport = async (userId) => {
    const teamIds = await getManagedTeamIds(userId);
    if (!(await getAccountCapabilities(await getActor(userId))).canViewReports) {
        const error = new Error('Insufficient report permissions');
        error.statusCode = 403;
        throw error;
    }
    const teams = await Team.find({ _id: { $in: teamIds } })
        .populate('manager', 'fullName email')
        .populate('members.user', 'fullName email role');

    return teams.map((t) => ({
        teamName: t.teamName,
        description: t.description || '-',
        manager: t.manager?.fullName || 'N/A',
        memberCount: t.members.length,
        members: t.members.map((m) => ({
            name: m.user?.fullName || 'Unknown',
            email: m.user?.email || '-',
            role: m.role,
        })),
        createdAt: new Date(t.createdAt).toLocaleDateString(),
    }));
};

// 3. Intern / Team participant report
const getInternReport = async (userId) => {
    const teamIds = await getManagedTeamIds(userId);
    if (!(await getAccountCapabilities(await getActor(userId))).canViewReports) {
        const error = new Error('Insufficient report permissions');
        error.statusCode = 403;
        throw error;
    }
    const teams = await Team.find({ _id: { $in: teamIds } }).populate('members.user', 'fullName email role');

    const seen = new Set();
    const members = [];
    for (const team of teams) {
        for (const m of team.members) {
            if (m.user && !seen.has(m.user._id.toString())) {
                seen.add(m.user._id.toString());
                members.push(m.user);
            }
        }
    }

    const now = new Date();
    const projectIds = await requireReportProjects(userId);
    const report = await Promise.all(
        members.map(async (member) => {
            const tasks = await Task.find({
                assignee: member._id,
                project: { $in: projectIds },
            });
            const completed = tasks.filter((t) => t.status === 'Completed').length;
            const overdue = tasks.filter(
                (t) => t.deadline && t.deadline < now && t.status !== 'Completed'
            ).length;
            const completionRate = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;
            return {
                name: member.fullName,
                email: member.email,
                role: member.role,
                totalTasks: tasks.length,
                completed,
                inProgress: tasks.filter((t) => t.status === 'In Progress').length,
                pending: tasks.filter((t) => t.status === 'Pending').length,
                overdue,
                completionRate: `${completionRate}%`,
            };
        })
    );
    return report;
};

// 4. Monthly Report
const getMonthlyReport = async (userId, monthParam) => {
    let year, month;
    if (monthParam) {
        [year, month] = monthParam.split('-').map(Number);
    } else {
        const now = new Date();
        year = now.getFullYear();
        month = now.getMonth() + 1;
    }
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59);

    const projectIds = await requireReportProjects(userId);
    const tasks = await Task.find({
        $or: [
            { project: { $in: projectIds } },
        ],
        createdAt: { $gte: startOfMonth, $lte: endOfMonth },
    })
        .populate('assignee', 'fullName')
        .populate('createdBy', 'fullName')
        .sort({ createdAt: 1 });

    return {
        month: `${year}-${String(month).padStart(2, '0')}`,
        totalTasks: tasks.length,
        completed: tasks.filter((t) => t.status === 'Completed').length,
        overdue: tasks.filter((t) => t.deadline && t.deadline < endOfMonth && t.status !== 'Completed').length,
        pending: tasks.filter((t) => t.status === 'Pending').length,
        inProgress: tasks.filter((t) => t.status === 'In Progress').length,
        tasks: tasks.map((t) => ({
            title: t.title,
            status: t.status,
            priority: t.priority,
            assignee: t.assignee?.fullName || 'Unassigned',
            createdBy: t.createdBy?.fullName || '-',
            deadline: t.deadline ? new Date(t.deadline).toLocaleDateString() : '-',
            createdAt: new Date(t.createdAt).toLocaleDateString(),
        })),
    };
};

// 5. Completed Tasks Report
const getCompletedTasksReport = async (userId) => {
    const projectIds = await requireReportProjects(userId);
    const tasks = await Task.find({
        $or: [
            { project: { $in: projectIds } },
        ],
        status: 'Completed',
    })
        .populate('assignee', 'fullName email')
        .populate('createdBy', 'fullName')
        .sort({ updatedAt: -1 });

    return tasks.map((t) => ({
        title: t.title,
        description: t.description || '-',
        priority: t.priority,
        assignee: t.assignee?.fullName || 'Unassigned',
        createdBy: t.createdBy?.fullName || '-',
        deadline: t.deadline ? new Date(t.deadline).toLocaleDateString() : '-',
        completedOn: new Date(t.updatedAt).toLocaleDateString(),
        subtasksTotal: t.subtasks.length,
        subtasksDone: t.subtasks.filter((s) => s.isCompleted).length,
    }));
};

// 6. Delayed / Overdue Tasks Report
const getDelayedTasksReport = async (userId) => {
    const now = new Date();
    const projectIds = await requireReportProjects(userId);
    const tasks = await Task.find({
        $or: [
            { project: { $in: projectIds } },
        ],
        deadline: { $lt: now },
        status: { $ne: 'Completed' },
    })
        .populate('assignee', 'fullName email')
        .populate('createdBy', 'fullName')
        .sort({ deadline: 1 });

    return tasks.map((t) => {
        const daysOverdue = Math.floor(
            (now.getTime() - new Date(t.deadline).getTime()) / (1000 * 60 * 60 * 24)
        );
        return {
            title: t.title,
            description: t.description || '-',
            priority: t.priority,
            status: t.status,
            assignee: t.assignee?.fullName || 'Unassigned',
            assigneeEmail: t.assignee?.email || '-',
            createdBy: t.createdBy?.fullName || '-',
            deadline: new Date(t.deadline).toLocaleDateString(),
            daysOverdue,
        };
    });
};

module.exports = {
    getProjectReport,
    getTeamReport,
    getInternReport,
    getMonthlyReport,
    getCompletedTasksReport,
    getDelayedTasksReport,
};
