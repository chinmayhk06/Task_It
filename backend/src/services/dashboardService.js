const Task = require('../models/Task');
const Team = require('../models/Team');
const Project = require('../models/Project');
const { getAccessibleProjectsByRole, getAccessibleTeamIds } = require('../utils/rbac');

const getDashboardStats = async (userId) => {
    // 1. Total Stats
    const { managerProjectIds, memberProjectIds } = await getAccessibleProjectsByRole(userId);
    const accessibleProjectIds = [...managerProjectIds, ...memberProjectIds];
    const projects = await Project.find({ _id: { $in: accessibleProjectIds } }).select('projectName status deadline');
    const totalProjects = projects.length;
    const activeProjects = projects.filter((project) => project.status !== 'Completed').length;
    
    // Find teams where user is owner or member
    const teams = await Team.find({ _id: { $in: await getAccessibleTeamIds(userId) } });
    const totalTeams = teams.length;

    // Fetch tasks where user is creator or assignee
    const tasks = await Task.find({
        $or: [
            { project: { $in: managerProjectIds } },
            { project: { $in: memberProjectIds }, assignee: userId },
        ]
    }).populate('assignee', 'fullName profileImage')
      .populate('createdBy', 'fullName profileImage')
      .sort({ updatedAt: -1 });

    const totalTasks = tasks.length;

    // 2. Task Status Breakdown
    const taskStatus = {
        Pending: 0,
        "In Progress": 0,
        Completed: 0
    };

    const now = new Date();
    const overdueTasks = [];
    const upcomingDeadlines = [];
    
    // 3. Member Workload
    const memberWorkloadMap = {};

    tasks.forEach(task => {
        // Status count
        if (taskStatus[task.status] !== undefined) {
            taskStatus[task.status]++;
        }

        // Overdue check
        if (task.deadline && task.deadline < now && task.status !== 'Completed') {
            overdueTasks.push(task);
        }

        // Upcoming check (next 7 days)
        if (task.deadline && task.status !== 'Completed') {
            const timeDiff = task.deadline.getTime() - now.getTime();
            const daysDiff = timeDiff / (1000 * 3600 * 24);
            if (daysDiff >= 0 && daysDiff <= 7) {
                upcomingDeadlines.push(task);
            }
        }

        // Member Workload
        if (task.assignee && task.status !== 'Completed') {
            const assigneeId = task.assignee._id.toString();
            const assigneeName = task.assignee.fullName;
            if (!memberWorkloadMap[assigneeId]) {
                memberWorkloadMap[assigneeId] = { name: assigneeName, taskCount: 0 };
            }
            memberWorkloadMap[assigneeId].taskCount++;
        }
    });

    const memberWorkload = Object.values(memberWorkloadMap);

    const overdueCount = overdueTasks.length;
    const upcomingCount = upcomingDeadlines.length;
    const completedTasks = taskStatus.Completed;
    const activeTasks = totalTasks - completedTasks;
    const projectProgress = projects.map((project) => {
        const projectTasks = tasks.filter((task) => task.project?.toString?.() === project._id.toString() || task.project?._id?.toString?.() === project._id.toString());
        const completed = projectTasks.filter((task) => task.status === 'Completed').length;
        return {
            id: project._id,
            name: project.projectName,
            status: project.status,
            deadline: project.deadline,
            totalTasks: projectTasks.length,
            completedTasks: completed,
            progress: projectTasks.length === 0 ? 0 : Math.round((completed / projectTasks.length) * 100),
        };
    });

    // 4. Activity Feed (Top 10 recently updated tasks)
    const activityFeed = tasks.slice(0, 10).map(task => ({
        id: task._id,
        title: task.title,
        status: task.status,
        updatedAt: task.updatedAt,
        actionBy: task.assignee ? task.assignee.fullName : 'Unassigned'
    }));

    // 5. Chart Data Formats
    const statusChartData = [
        { name: 'Pending', value: taskStatus.Pending, color: '#f59e0b' },
        { name: 'In Progress', value: taskStatus["In Progress"], color: '#3b82f6' },
        { name: 'Completed', value: taskStatus.Completed, color: '#10b981' }
    ];

    return {
        totalStats: {
            projects: totalProjects,
            activeProjects,
            teams: totalTeams,
            tasks: totalTasks,
            activeTasks,
            completedTasks,
            pendingTasks: taskStatus.Pending,
            inProgressTasks: taskStatus["In Progress"],
            overdueTasks: overdueCount,
            upcomingDeadlines: upcomingCount
        },
        taskStatus: statusChartData,
        overdueTasks: overdueTasks.slice(0, 5), // Top 5
        upcomingDeadlines: upcomingDeadlines.slice(0, 5).sort((a, b) => new Date(a.deadline) - new Date(b.deadline)), // Top 5 soonest
        projectProgress,
        memberWorkload,
        activityFeed
    };
};

module.exports = {
    getDashboardStats
};
