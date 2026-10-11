const Project = require('../models/Project');
const Task = require('../models/Task');
const {
  ROLE,
  getAccessibleTeamIds,
  requireProjectAccess,
  requireTeamAccess,
} = require('../utils/rbac');

const PROJECT_MANAGERS = [ROLE.ADMIN, ROLE.TEAM_LEAD];
const projectFields = new Set(['projectName', 'description', 'team', 'status', 'priority', 'technologies', 'startDate', 'deadline', 'githubRepo', 'deploymentLink']);
const safeProjectData = (data) => Object.fromEntries(Object.entries(data).filter(([key]) => projectFields.has(key)));

const attachProjectProgress = async (projects) => {
  const projectList = Array.isArray(projects) ? projects : [projects];
  const projectIds = projectList.map((project) => project._id);
  const counts = await Task.aggregate([
    { $match: { project: { $in: projectIds } } },
    {
      $group: {
        _id: '$project',
        totalTasks: { $sum: 1 },
        completedTasks: {
          $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] },
        },
      },
    },
  ]);

  const countMap = counts.reduce((acc, item) => {
    acc[item._id.toString()] = item;
    return acc;
  }, {});

  const withProgress = projectList.map((project) => {
    const plain = typeof project.toObject === 'function' ? project.toObject() : project;
    const count = countMap[plain._id.toString()] || { totalTasks: 0, completedTasks: 0 };
    const progress =
      count.totalTasks === 0 ? 0 : Math.round((count.completedTasks / count.totalTasks) * 100);
    return {
      ...plain,
      totalTasks: count.totalTasks,
      completedTasks: count.completedTasks,
      progress,
    };
  });

  return Array.isArray(projects) ? withProgress : withProgress[0];
};

const createProject = async (data, userId) => {
  if (!data.team) {
    throw new Error('Team is required to create a project');
  }

  await requireTeamAccess(data.team, userId, PROJECT_MANAGERS);

  return await Project.create({
    ...safeProjectData(data),
    owner: userId,
    team: data.team,
  });
};

const getAllProjects = async (userId, filters = {}) => {
  const teamIds = await getAccessibleTeamIds(userId);
  const query = {
    $or: [
      { team: { $in: teamIds } },
    ],
  };

  if (filters.team) {
    await requireTeamAccess(filters.team, userId);
    query.team = filters.team;
    delete query.$or;
  }

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.search) {
    query.projectName = { $regex: filters.search, $options: 'i' };
  }

  const sort = filters.sort === 'deadline' ? { deadline: 1, createdAt: -1 } : { createdAt: -1 };

  const projects = await Project.find(query)
    .populate('owner', 'fullName email')
    .populate({
      path: 'team',
      select: 'teamName manager members',
      populate: { path: 'members.user', select: 'fullName email role' },
    })
    .sort(sort);

  return await attachProjectProgress(projects);
};

const getProjectById = async (projectId, userId) => {
  const { project, role } = await requireProjectAccess(projectId, userId);
  const projectDetails = await Project.findById(project._id)
    .populate('owner', 'fullName email')
    .populate({
      path: 'team',
      select: 'teamName manager members',
      populate: { path: 'members.user', select: 'fullName email role' },
    });
  const taskQuery = { project: project._id };
  if (role === ROLE.INTERN) {
    taskQuery.assignee = userId;
  }

  const tasks = await Task.find(taskQuery)
    .populate('assignee', 'fullName email role')
    .populate('createdBy', 'fullName email role')
    .sort({ createdAt: -1 });

  return {
    ...projectDetails.toObject(),
    ...(await attachProjectProgress(projectDetails)),
    tasks,
  };
};

const updateProject = async (projectId, userId, data) => {
  const { project } = await requireProjectAccess(projectId, userId, PROJECT_MANAGERS);
  data = safeProjectData(data);
  if ('team' in data && !data.team) throw Object.assign(new Error('Project team is required'), { statusCode: 400 });

  if (data.team && data.team.toString() !== project.team?._id?.toString()) {
    await requireTeamAccess(data.team, userId, PROJECT_MANAGERS);
    if (await Task.exists({ project: projectId })) throw Object.assign(new Error('Cannot move a project with tasks; preserve assignment relationships'), { statusCode: 409 });
  }

  Object.assign(project, data);
  await project.save();

  return await Project.findById(project._id)
    .populate('owner', 'fullName email')
    .populate({
      path: 'team',
      select: 'teamName manager members',
      populate: { path: 'members.user', select: 'fullName email role' },
    });
};

const deleteProject = async (projectId, userId) => {
  const { project } = await requireProjectAccess(projectId, userId, PROJECT_MANAGERS);

  const taskCount = await Task.countDocuments({ project: project._id });
  if (taskCount > 0) {
    const error = new Error('Cannot delete project while tasks exist.');
    error.statusCode = 409;
    throw error;
  }

  if (await require('../models/Document').exists({ project: project._id })) {
    throw Object.assign(new Error('Cannot delete project while documents exist.'), { statusCode: 409 });
  }
  await Project.findByIdAndDelete(project._id);
  return true;
};

module.exports = {
  createProject,
  getAllProjects,
  getProjectById,
  updateProject,
  deleteProject,
};
