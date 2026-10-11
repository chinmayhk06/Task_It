const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema(
  {
    projectName: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
    },

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
    },

    status: {
      type: String,
      enum: ['Planning', 'Active', 'On Hold', 'Completed'],
      default: 'Planning',
    },

    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical'],
      default: 'Medium',
    },

    technologies: [{ 
        type: String
    }],

    startDate: Date,

    deadline: Date,

    githubRepo: String,

    deploymentLink: String,
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Project', projectSchema);
