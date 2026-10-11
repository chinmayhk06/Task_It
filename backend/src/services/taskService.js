const Task = require('../models/Task');
const Project = require('../models/Project');
const {
  ROLE,
  getAccessibleProjectsByRole,
  toId,
  isTeamMember,
  requireProjectAccess,
  requireTaskAccess,
} = require('../utils/rbac');

const TASK_MANAGERS = [ROLE.ADMIN, ROLE.TEAM_LEAD];
const INTERN_SAFE_FIELDS = new Set(['status', 'progress']);
const TASK_FIELDS = new Set(['title', 'description', 'priority', 'status', 'progress', 'deadline', 'project', 'assignee']);

const forbidden = (message) => {
  const error = new Error(message);
  error.statusCode = 403;
  return error;
};

const populateTask = async (task) => {
  return await task.populate([
    { path: 'assignee', select: 'fullName email role' },
    { path: 'createdBy', select: 'fullName email role' },
    { path: 'project', select: 'projectName team status priority' },
    { path: 'comments.user', select: 'fullName email' },
  ]);
};

const assertAssigneeInProjectTeam = async (projectId, assigneeId) => {
  if (!assigneeId) return;

  const project = await Project.findById(projectId).populate('team', 'manager members');
  if (!project?.team) {
    throw new Error('Project team is required before assigning tasks');
  }

  if (!isTeamMember(project.team, assigneeId)) {
    throw forbidden('Assignee must be a member of the selected project team');
  }
};

const createTask = async (taskData, userId) => {
  if (!taskData.project) {
    throw new Error('Project is required to create a task');
  }

  await requireProjectAccess(taskData.project, userId, TASK_MANAGERS);
  const assignee = taskData.assignee || taskData.assignedTo || null;
  await assertAssigneeInProjectTeam(taskData.project, assignee);
  const data = Object.fromEntries(Object.entries(taskData).filter(([key]) => TASK_FIELDS.has(key)));
  if (data.deadline === '') data.deadline = undefined;

  const task = await Task.create({
    ...data,
    assignee,
    createdBy: userId,
  });

  return await populateTask(task);
};

const getTasks = async (userId, filters = {}) => {
  const query = {};
  let canFilterAnyAssignee = false;

  if (filters.project) {
    const { role } = await requireProjectAccess(filters.project, userId);
    query.project = filters.project;
    if (role === ROLE.INTERN) {
      query.assignee = userId;
    } else if (TASK_MANAGERS.includes(role)) {
      canFilterAnyAssignee = true;
    }
  } else {
    const { managerProjectIds, memberProjectIds } = await getAccessibleProjectsByRole(userId);
    canFilterAnyAssignee = managerProjectIds.length > 0;
    query.$or = [
      { project: { $in: managerProjectIds } },
      { project: { $in: memberProjectIds }, assignee: userId },
    ];
  }

  if (filters.assignee && !query.assignee && canFilterAnyAssignee) {
    query.assignee = filters.assignee === 'me' ? userId : filters.assignee;
  }

  if (filters.mine === 'true') {
    query.assignee = userId;
  }

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.priority) {
    query.priority = filters.priority;
  }

  if (filters.search) {
    query.title = { $regex: filters.search, $options: 'i' };
  }

  const sort = filters.sort === 'deadline' ? { deadline: 1, createdAt: -1 } : { createdAt: -1 };

  return await Task.find(query)
    .populate('assignee', 'fullName email role')
    .populate('createdBy', 'fullName email role')
    .populate('project', 'projectName team status priority')
    .sort(sort);
};

const getTaskById = async (taskId, userId) => {
  const { task, role } = await requireTaskAccess(taskId, userId);
  return {
    ...task.toObject(),
    permissions: {
      canManage: TASK_MANAGERS.includes(role),
      canUpdateStatus: TASK_MANAGERS.includes(role) || toId(task.assignee) === toId(userId),
      canDelete: TASK_MANAGERS.includes(role),
    },
  };
};

const assertInternSafeUpdate = (task, userId, updateData) => {
  if (toId(task.assignee) !== toId(userId)) {
    throw forbidden('Interns can only update tasks assigned to them');
  }

  const unsafeFields = Object.keys(updateData).filter((field) => !INTERN_SAFE_FIELDS.has(field));
  if (unsafeFields.length > 0) {
    throw forbidden('Interns can only update safe task fields');
  }
};

const updateTask = async (taskId, userId, updateData) => {
  const { task, role } = await requireTaskAccess(taskId, userId);

  const data = { ...updateData };
  if ('project' in data && !data.project) throw Object.assign(new Error('Task project is required'), { statusCode: 400 });
  if (data.assignedTo && !data.assignee) data.assignee = data.assignedTo;
  delete data.assignedTo;
  if (data.deadline === '') data.deadline = undefined;

  if (role === ROLE.INTERN) {
    assertInternSafeUpdate(task, userId, data);
  } else if (!TASK_MANAGERS.includes(role)) {
    throw forbidden('Insufficient task permissions');
  }
  if (Object.keys(data).some((key) => !TASK_FIELDS.has(key))) throw forbidden('Cannot update protected task fields');

  const projectId = data.project || task.project?._id || task.project;
  if (data.project && data.project.toString() !== toId(task.project)) {
    await requireProjectAccess(data.project, userId, TASK_MANAGERS);
    await assertAssigneeInProjectTeam(data.project, data.assignee === undefined ? toId(task.assignee) : data.assignee);
  }

  if (data.assignee === '' || data.assignee === null) {
    data.assignee = undefined;
    task.set('assignee', undefined);
  } else if (data.assignee !== undefined) {
    await assertAssigneeInProjectTeam(projectId, data.assignee);
  }

  Object.assign(task, data);
  await task.save();

  return await populateTask(task);
};

const deleteTask = async (taskId, userId) => {
  const { task } = await requireTaskAccess(taskId, userId, TASK_MANAGERS);
  await Task.findByIdAndDelete(task._id);
  return true;
};

const addSubtask = async (taskId, userId, subtaskTitle) => {
  const { task } = await requireTaskAccess(taskId, userId, TASK_MANAGERS);
  task.subtasks.push({ title: subtaskTitle, isCompleted: false });
  await task.save();
  return task;
};

const toggleSubtask = async (taskId, userId, subtaskId, isCompleted) => {
  const { task, role } = await requireTaskAccess(taskId, userId);
  if (role === ROLE.INTERN && toId(task.assignee) !== toId(userId)) {
    throw forbidden('Interns can only update their own assigned task');
  }

  const subtask = task.subtasks.id(subtaskId);
  if (!subtask) throw new Error('Subtask not found');

  subtask.isCompleted = isCompleted;
  await task.save();
  return task;
};

const deleteSubtask = async (taskId, userId, subtaskId) => {
  const { task } = await requireTaskAccess(taskId, userId, TASK_MANAGERS);
  task.subtasks.pull(subtaskId);
  await task.save();
  return task;
};

const addComment = async (taskId, userId, text) => {
  const { task } = await requireTaskAccess(taskId, userId, TASK_MANAGERS);
  task.comments.push({ user: userId, text });
  await task.save();
  return await task.populate('comments.user', 'fullName email');
};

const deleteComment = async (taskId, userId, commentId) => {
  const { task, role } = await requireTaskAccess(taskId, userId, TASK_MANAGERS);
  const comment = task.comments.id(commentId);
  if (!comment) throw new Error('Comment not found');

  const canDelete =
    TASK_MANAGERS.includes(role) ||
    toId(comment.user) === toId(userId) ||
    toId(task.createdBy) === toId(userId);

  if (!canDelete) {
    throw forbidden('Not authorized to delete this comment');
  }

  task.comments.pull(commentId);
  await task.save();
  return task;
};

const addAttachment = async (taskId, userId, attachmentName, attachmentUrl) => {
  const { task } = await requireTaskAccess(taskId, userId, TASK_MANAGERS);
  task.attachments.push({ name: attachmentName, url: attachmentUrl });
  await task.save();
  return task;
};

const deleteAttachment = async (taskId, userId, attachmentId) => {
  const { task } = await requireTaskAccess(taskId, userId, TASK_MANAGERS);
  task.attachments.pull(attachmentId);
  await task.save();
  return task;
};

module.exports = {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  deleteTask,
  addSubtask,
  toggleSubtask,
  deleteSubtask,
  addComment,
  deleteComment,
  addAttachment,
  deleteAttachment,
};
