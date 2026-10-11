const mongoose = require('mongoose');

// Subtasks schema (checklist)
const subtaskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  isCompleted: {
    type: Boolean,
    default: false
  }
});

// Attachments schema (links to documents/assets)
const attachmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  url: {
    type: String,
    required: true,
    trim: true
  }
});

// Comments schema
const commentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  text: {
    type: String,
    required: true,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Task Schema
const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical'],
      default: 'Medium'
    },
    status: {
      type: String,
      enum: ['Pending', 'In Progress', 'Completed'],
      default: 'Pending'
    },
    progress: { type: Number, min: 0, max: 100, default: 0 },
    deadline: {
      type: Date
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true
    },
    assignee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      alias: 'assignedTo'
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    deadlineReminderSentAt: {
      type: Date
    },
    overdueNotificationSentAt: {
      type: Date
    },
    subtasks: [subtaskSchema],
    attachments: [attachmentSchema],
    comments: [commentSchema]
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Task', taskSchema);
