const Document = require('../models/Document');
const cloudinary = require('cloudinary').v2;
const {
  ROLE,
  getAccessibleProjectIds,
  requireProjectAccess,
} = require('../utils/rbac');

// Configure cloudinary (only if credentials exist)
if (process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

// POST /api/documents — Upload a document
const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file provided' });
    }

    const { name, description, fileType, tags, project } = req.body;

    if (!fileType) {
      return res.status(400).json({ success: false, message: 'fileType is required' });
    }

    if (!project) {
      return res.status(400).json({ success: false, message: 'project is required' });
    }

    await requireProjectAccess(project, req.user._id, [ROLE.ADMIN, ROLE.TEAM_LEAD]);

    let fileUrl = '';
    let publicId = '';

    if (process.env.CLOUDINARY_CLOUD_NAME) {
      // Upload to Cloudinary using the buffer from multer memoryStorage
      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'taskit_documents',
            resource_type: 'auto',
            use_filename: true,
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        stream.end(req.file.buffer);
      });

      fileUrl = uploadResult.secure_url;
      publicId = uploadResult.public_id;
    } else {
      // Fallback: use base64 data URL (dev mode without Cloudinary)
      const base64 = req.file.buffer.toString('base64');
      fileUrl = `data:${req.file.mimetype};base64,${base64}`;
      publicId = '';
      console.log('[DocumentController] Cloudinary not configured — using base64 fallback');
    }

    const document = await Document.create({
      name: name || req.file.originalname,
      description: description || '',
      fileType,
      fileUrl,
      publicId,
      uploadedBy: req.user._id,
      project,
      fileSize: req.file.size,
      originalName: req.file.originalname,
      tags: tags ? tags.split(',').map((t) => t.trim()) : [],
    });

    await document.populate('uploadedBy', 'fullName email');
    await document.populate({
      path: 'project',
      select: 'projectName team owner',
      populate: { path: 'team', select: 'teamName manager members' },
    });

    res.status(201).json({ success: true, message: 'Document uploaded successfully', data: document });
  } catch (err) {
    console.error('[DocumentController] Upload error:', err);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

// GET /api/documents — List all documents (optional ?type= filter)
const getDocuments = async (req, res) => {
  try {
    const filter = {};
    if (req.query.type && req.query.type !== 'All') {
      filter.fileType = req.query.type;
    }

    const projectIds = await getAccessibleProjectIds(req.user._id);
    filter.$or = [
      { project: { $in: projectIds } },
    ];

    const documents = await Document.find(filter)
      .populate('uploadedBy', 'fullName email')
      .populate({
        path: 'project',
        select: 'projectName team owner',
        populate: { path: 'team', select: 'teamName manager members' },
      })
      .sort({ createdAt: -1 });

    res.json({ success: true, count: documents.length, data: documents });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

// GET /api/documents/:id — Get a single document
const getDocument = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id)
      .populate('uploadedBy', 'fullName email')
      .populate({
        path: 'project',
        select: 'projectName team owner',
        populate: { path: 'team', select: 'teamName manager members' },
      });
    if (!document) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }
    if (document.project) {
      await requireProjectAccess(document.project._id || document.project, req.user._id);
    } else {
      return res.status(403).json({ success: false, message: 'Not authorized to view this document' });
    }
    res.json({ success: true, data: document });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

// DELETE /api/documents/:id — Delete document from Cloudinary + DB
const deleteDocument = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);
    if (!document) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    if (document.project) {
      const { role } = await requireProjectAccess(document.project, req.user._id);
      const isManager = [ROLE.ADMIN, ROLE.TEAM_LEAD].includes(role);
      if (!isManager) {
        return res.status(403).json({ success: false, message: 'Not authorized to delete this document' });
      }
    } else {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this document' });
    }

    // Remove from Cloudinary if publicId exists
    if (document.publicId && process.env.CLOUDINARY_CLOUD_NAME) {
      await cloudinary.uploader.destroy(document.publicId, { resource_type: 'auto' });
    }

    await Document.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Document deleted successfully' });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

module.exports = { uploadDocument, getDocuments, getDocument, deleteDocument };
