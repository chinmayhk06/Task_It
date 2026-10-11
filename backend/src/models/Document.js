const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    fileType: {
      type: String,
      enum: ['PDF', 'PPT', 'Image', 'Research Paper', 'Dataset', 'Meeting Notes'],
      required: true,
    },
    fileUrl: {
      type: String,
      required: true,
    },
    publicId: {
      // Cloudinary public_id for deletion
      type: String,
      default: '',
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    fileSize: {
      type: Number, // bytes
      default: 0,
    },
    originalName: {
      type: String,
      default: '',
    },
    tags: [{ type: String, trim: true }],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Document', documentSchema);
