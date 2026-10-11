const { body } = require('express-validator');

const createTaskValidator = [
  body('progress').optional().isFloat({ min: 0, max: 100 }).withMessage('Progress must be between 0 and 100'),
  body('title')
    .notEmpty()
    .withMessage('Task title is required')
    .trim(),

  body('priority')
    .optional()
    .isIn(['Low', 'Medium', 'High', 'Critical'])
    .withMessage('Priority must be Low, Medium, High, or Critical'),

  body('status')
    .optional()
    .isIn(['Pending', 'In Progress', 'Completed'])
    .withMessage('Status must be Pending, In Progress, or Completed'),

  body('deadline')
    .optional()
    .custom((value) => !value || !Number.isNaN(Date.parse(value)))
    .withMessage('Deadline must be a valid date'),

  body('project')
    .notEmpty()
    .withMessage('Project is required')
    .isMongoId()
    .withMessage('Project must be a valid MongoDB Project ID'),

  body('assignee')
    .optional()
    .custom((value) => {
      if (value === null || value === '') return true;
      const mongoose = require('mongoose');
      return mongoose.Types.ObjectId.isValid(value);
    })
    .withMessage('Assignee must be a valid MongoDB User ID or null'),

  body('assignedTo')
    .optional()
    .custom((value) => {
      if (value === null || value === '') return true;
      const mongoose = require('mongoose');
      return mongoose.Types.ObjectId.isValid(value);
    })
    .withMessage('Assigned user must be a valid MongoDB User ID or null')
];

const updateTaskValidator = [
  body('progress').optional().isFloat({ min: 0, max: 100 }).withMessage('Progress must be between 0 and 100'),
  body('title')
    .optional()
    .notEmpty()
    .withMessage('Task title cannot be empty')
    .trim(),

  body('priority')
    .optional()
    .isIn(['Low', 'Medium', 'High', 'Critical'])
    .withMessage('Priority must be Low, Medium, High, or Critical'),

  body('status')
    .optional()
    .isIn(['Pending', 'In Progress', 'Completed'])
    .withMessage('Status must be Pending, In Progress, or Completed'),

  body('deadline')
    .optional()
    .custom((value) => !value || !Number.isNaN(Date.parse(value)))
    .withMessage('Deadline must be a valid date'),

  body('project')
    .optional()
    .isMongoId()
    .withMessage('Project must be a valid MongoDB Project ID'),

  body('assignee')
    .optional()
    .custom((value) => {
      if (value === null || value === '') return true;
      const mongoose = require('mongoose');
      return mongoose.Types.ObjectId.isValid(value);
    })
    .withMessage('Assignee must be a valid MongoDB User ID or null'),

  body('assignedTo')
    .optional()
    .custom((value) => {
      if (value === null || value === '') return true;
      const mongoose = require('mongoose');
      return mongoose.Types.ObjectId.isValid(value);
    })
    .withMessage('Assigned user must be a valid MongoDB User ID or null')
];

module.exports = {
  createTaskValidator,
  updateTaskValidator
};
