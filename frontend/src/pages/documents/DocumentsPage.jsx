import { useState, useRef, useCallback } from "react";
import {
    FiUploadCloud, FiFile, FiFileText, FiImage, FiTrash2,
    FiEye, FiX, FiDownload, FiSearch, FiPlus
} from "react-icons/fi";
import {
    getDocuments, uploadDocument, deleteDocument
} from "../../services/documentService";
import { getProjects } from "../../services/projectService";
import { canManageProjects, getCurrentUserId, getTeamRole } from "../../utils/rbac";
import { useEffect } from "react";

// Section
const FILE_TYPES = ["All", "PDF", "PPT", "Image", "Research Paper", "Dataset", "Meeting Notes"];

const TYPE_META = {
    PDF:              { color: "bg-red-100 text-red-700",    icon: FiFileText, ext: ".pdf" },
    PPT:              { color: "bg-orange-100 text-orange-700", icon: FiFileText, ext: ".pptx" },
    Image:            { color: "bg-blue-100 text-blue-700",  icon: FiImage,    ext: ".png/.jpg" },
    "Research Paper": { color: "bg-[var(--hover-bg)] text-[var(--title-color)]", icon: FiFile,  ext: ".pdf/.doc" },
    Dataset:          { color: "bg-green-100 text-green-700", icon: FiFile,    ext: ".csv/.xlsx" },
    "Meeting Notes":  { color: "bg-yellow-100 text-yellow-700", icon: FiFileText, ext: ".doc/.txt" },
};

function formatSize(bytes) {
    if (!bytes || bytes === 0) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 30) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
}

// Section
function UploadModal({ onClose, onSuccess, projects }) {
    const [file, setFile] = useState(null);
    const [dragging, setDragging] = useState(false);
    const [form, setForm] = useState({ name: "", description: "", fileType: "PDF", tags: "", project: projects[0]?._id || "" });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const inputRef = useRef();

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        setDragging(false);
        const dropped = e.dataTransfer.files[0];
        if (dropped) { setFile(dropped); setForm(f => ({ ...f, name: dropped.name })); }
    }, []);

    const handleFileSelect = (e) => {
        const selected = e.target.files[0];
        if (selected) { setFile(selected); setForm(f => ({ ...f, name: selected.name })); }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!file) return setError("Please select a file.");
        if (!form.fileType) return setError("Please select a file type.");
        if (!form.project) return setError("Please select a project.");
        setLoading(true); setError("");
        try {
            const fd = new FormData();
            fd.append("file", file);
            fd.append("name", form.name || file.name);
            fd.append("description", form.description);
            fd.append("fileType", form.fileType);
            fd.append("tags", form.tags);
            fd.append("project", form.project);
            await uploadDocument(fd);
            onSuccess();
            onClose();
        } catch (err) {
            setError(err?.response?.data?.message || "Upload failed.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg rounded-lg bg-[var(--surface-card)] ">
                {/* Header */}
                <div className="flex items-center justify-between border-b px-6 py-4">
                    <div className="flex items-center gap-2">
                        <FiUploadCloud size={20} className="text-[var(--title-color)]" />
                        <h2 className="text-lg font-bold text-[var(--title-color)]">Upload Document</h2>
                    </div>
                    <button onClick={onClose} className="rounded-md p-2 hover:bg-[var(--hover-bg)] transition">
                        <FiX size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Drop Zone */}
                    <div
                        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={handleDrop}
                        onClick={() => inputRef.current.click()}
                        className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition
                            ${dragging ? "border-[var(--title-color)] bg-[var(--surface-muted)]" : "border-[var(--border-color)] hover:border-[var(--title-color)] hover:bg-[var(--surface-muted)]"}`}
                    >
                        <input ref={inputRef} type="file" className="hidden" onChange={handleFileSelect} />
                        <FiUploadCloud size={32} className="mx-auto mb-2 text-[var(--muted-color)]" />
                        {file ? (
                            <div>
                                <p className="font-semibold text-[var(--title-color)]">{file.name}</p>
                                <p className="text-xs text-[var(--muted-color)]">{formatSize(file.size)}</p>
                            </div>
                        ) : (
                            <>
                                <p className="text-sm font-medium text-[var(--subtitle-color)]">Drag & drop a file here</p>
                                <p className="text-xs text-[var(--muted-color)] mt-1">or click to browse - Max 50 MB</p>
                            </>
                        )}
                    </div>

                    {/* Form Fields */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                            <label className="mb-1 block text-xs font-semibold text-[var(--subtitle-color)]">Document Name</label>
                            <input
                                className="w-full rounded-md border border-[var(--border-color)] px-3 py-2 text-sm outline-none focus:border-[var(--title-color)] focus:ring-1 focus:ring-gray-200"
                                placeholder="Document name"
                                value={form.name}
                                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="mb-1 block text-xs font-semibold text-[var(--subtitle-color)]">Project *</label>
                            <select
                                required
                                value={form.project}
                                onChange={(e) => setForm(f => ({ ...f, project: e.target.value }))}
                                className="w-full rounded-md border border-[var(--border-color)] px-3 py-2 text-sm outline-none focus:border-[var(--title-color)]"
                            >
                                <option value="">Select project</option>
                                {projects.map(project => (
                                    <option key={project._id} value={project._id}>
                                        {project.projectName}
                                        {project.team?.teamName ? ` - ${project.team.teamName}` : ""}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-[var(--subtitle-color)]">File Type *</label>
                            <select
                                required
                                value={form.fileType}
                                onChange={(e) => setForm(f => ({ ...f, fileType: e.target.value }))}
                                className="w-full rounded-md border border-[var(--border-color)] px-3 py-2 text-sm outline-none focus:border-[var(--title-color)]"
                            >
                                {FILE_TYPES.filter(t => t !== "All").map(t => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-[var(--subtitle-color)]">Tags (comma-separated)</label>
                            <input
                                className="w-full rounded-md border border-[var(--border-color)] px-3 py-2 text-sm outline-none focus:border-[var(--title-color)]"
                                placeholder="ml, research, q2"
                                value={form.tags}
                                onChange={(e) => setForm(f => ({ ...f, tags: e.target.value }))}
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="mb-1 block text-xs font-semibold text-[var(--subtitle-color)]">Description</label>
                            <textarea
                                rows={2}
                                className="w-full rounded-md border border-[var(--border-color)] px-3 py-2 text-sm outline-none focus:border-[var(--title-color)] resize-none"
                                placeholder="Brief description of this document..."
                                value={form.description}
                                onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                            />
                        </div>
                    </div>

                    {error && <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{error}</p>}

                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={onClose}
                            className="rounded-md border border-[var(--border-color)] px-4 py-2 text-sm font-medium text-[var(--subtitle-color)] hover:bg-[var(--surface-muted)] transition">
                            Cancel
                        </button>
                        <button type="submit" disabled={loading}
                            className="flex items-center gap-2 rounded-md bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)] disabled:opacity-60 transition">
                            {loading ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <FiUploadCloud size={14} />}
                            {loading ? "Uploading..." : "Upload"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// Section
function PreviewModal({ doc, onClose }) {
    if (!doc) return null;
    const isImage = doc.fileType === "Image";
    const isPDF = doc.fileType === "PDF" || doc.originalName?.endsWith(".pdf");

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="flex h-[90vh] w-full max-w-4xl flex-col rounded-lg bg-[var(--surface-card)]  overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between border-b px-6 py-4 flex-shrink-0">
                    <div>
                        <h3 className="font-bold text-[var(--title-color)]">{doc.name}</h3>
                        <p className="text-xs text-[var(--muted-color)]">{doc.fileType} · {formatSize(doc.fileSize)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <a href={doc.fileUrl} target="_blank" rel="noreferrer" download
                            className="flex items-center gap-1.5 rounded-md border border-[var(--border-color)] px-3 py-1.5 text-sm font-medium text-[var(--title-color)] hover:bg-[var(--surface-muted)] transition">
                            <FiDownload size={14} /> Download
                        </a>
                        <button onClick={onClose} className="rounded-md p-2 hover:bg-[var(--hover-bg)] transition">
                            <FiX size={18} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden bg-[var(--hover-bg)]">
                    {isImage ? (
                        <div className="flex h-full items-center justify-center p-6">
                            <img src={doc.fileUrl} alt={doc.name}
                                className="max-h-full max-w-full rounded-md object-contain " />
                        </div>
                    ) : isPDF ? (
                        <iframe src={doc.fileUrl} className="h-full w-full border-0" title={doc.name} />
                    ) : (
                        <div className="flex h-full flex-col items-center justify-center gap-4">
                            <FiFile size={56} className="text-[var(--muted-color)]" />
                            <p className="text-[var(--subtitle-color)]">Preview not available for this file type.</p>
                            <a href={doc.fileUrl} target="_blank" rel="noreferrer" download
                                className="flex items-center gap-2 rounded-md bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)] transition">
                                <FiDownload size={14} /> Download File
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// Section
function DocumentCard({ doc, onPreview, onDelete, canDelete }) {
    const meta = TYPE_META[doc.fileType] || { color: "bg-[var(--hover-bg)] text-[var(--title-color)]", icon: FiFile };
    const Icon = meta.icon;
    const initials = doc.uploadedBy?.fullName
        ? doc.uploadedBy.fullName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
        : "?";

    return (
        <div className="group relative flex flex-col rounded-lg border border-[var(--border-color)] bg-[var(--surface-card)] p-5  hover:bg-[var(--surface-muted)] transition">
            {/* Type badge */}
            <span className={`mb-3 inline-flex w-fit items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold ${meta.color}`}>
                <Icon size={12} /> {doc.fileType}
            </span>

            <h3 className="mb-1 line-clamp-2 text-sm font-semibold text-[var(--title-color)]">{doc.name}</h3>
            {doc.description && (
                <p className="mb-2 line-clamp-1 text-xs text-[var(--muted-color)]">{doc.description}</p>
            )}

            {/* Tags */}
            {doc.tags?.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-1">
                    {doc.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="rounded-md bg-[var(--hover-bg)] px-2 py-0.5 text-xs text-[var(--subtitle-color)]">
                            #{tag}
                        </span>
                    ))}
                </div>
            )}

            <div className="mt-auto flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--hover-bg)] text-xs font-bold text-[var(--title-color)]">
                        {initials}
                    </div>
                    <div>
                        <p className="text-xs font-medium text-[var(--title-color)]">{doc.uploadedBy?.fullName || "Unknown"}</p>
                        <p className="text-xs text-[var(--muted-color)]">{timeAgo(doc.createdAt)} · {formatSize(doc.fileSize)}</p>
                    </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-1">
                    <button
                        onClick={() => onPreview(doc)}
                        className="rounded-lg p-1.5 text-[var(--muted-color)] hover:bg-[var(--surface-muted)] hover:text-[var(--title-color)] transition"
                        title="Preview"
                    >
                        <FiEye size={15} />
                    </button>
                    <a href={doc.fileUrl} download target="_blank" rel="noreferrer"
                        className="rounded-lg p-1.5 text-[var(--muted-color)] hover:bg-blue-50 hover:text-blue-600 transition"
                        title="Download">
                        <FiDownload size={15} />
                    </a>
                    {canDelete && (
                        <button
                            onClick={() => onDelete(doc)}
                            className="rounded-lg p-1.5 text-[var(--muted-color)] hover:bg-red-50 hover:text-red-500 transition"
                            title="Delete"
                        >
                            <FiTrash2 size={15} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// Section
function DeleteConfirm({ doc, onConfirm, onCancel, loading }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-lg bg-[var(--surface-card)] p-6 ">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-red-50">
                    <FiTrash2 size={22} className="text-red-500" />
                </div>
                <h3 className="mb-1 text-lg font-bold text-[var(--title-color)]">Delete Document</h3>
                <p className="text-sm text-[var(--subtitle-color)]">
                    Are you sure you want to delete <span className="font-semibold text-[var(--title-color)]">"{doc.name}"</span>? This action cannot be undone.
                </p>
                <div className="mt-5 flex gap-2">
                    <button onClick={onCancel}
                        className="flex-1 rounded-md border border-[var(--border-color)] py-2 text-sm font-medium text-[var(--subtitle-color)] hover:bg-[var(--surface-muted)] transition">
                        Cancel
                    </button>
                    <button onClick={onConfirm} disabled={loading}
                        className="flex flex-1 items-center justify-center gap-2 rounded-md bg-red-500 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-60 transition">
                        {loading ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : null}
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
}

// Section
export default function DocumentsPage() {
    const [documents, setDocuments] = useState([]);
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [activeType, setActiveType] = useState("All");
    const [search, setSearch] = useState("");
    const [showUpload, setShowUpload] = useState(false);
    const [previewDoc, setPreviewDoc] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const currentUserId = getCurrentUserId();
    const manageableProjects = projects.filter((project) => {
        return canManageProjects(getTeamRole(project.team, currentUserId));
    });
    const canDeleteDocument = (doc) => {
        return canManageProjects(getTeamRole(doc.project?.team, currentUserId));
    };

    const fetchDocuments = useCallback(async (type = activeType) => {
        try {
            setLoading(true);
            const [res, projectRes] = await Promise.all([
                getDocuments(type),
                getProjects(),
            ]);
            setDocuments(res.data.data || []);
            setProjects(projectRes.data.data || []);
        } catch {
            setError("Failed to load documents.");
        } finally {
            setLoading(false);
        }
    }, [activeType]);

    useEffect(() => { fetchDocuments(activeType); }, [activeType, fetchDocuments]);

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await deleteDocument(deleteTarget._id);
            setDocuments(prev => prev.filter(d => d._id !== deleteTarget._id));
            setDeleteTarget(null);
        } catch {
            alert("Failed to delete document.");
        } finally {
            setDeleting(false);
        }
    };

    const filtered = documents.filter(d =>
        !search || d.name.toLowerCase().includes(search.toLowerCase()) ||
        d.description?.toLowerCase().includes(search.toLowerCase()) ||
        d.tags?.some(t => t.toLowerCase().includes(search.toLowerCase()))
    );

    return (
        <div className="app-page">
            <div className="mx-auto max-w-7xl">

                {/* Header */}
                <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-[var(--title-color)]">Documents</h1>
                        <p className="mt-1 text-[var(--subtitle-color)]">Manage PPTs, PDFs, Datasets, Research Papers and more.</p>
                    </div>
                    {manageableProjects.length > 0 && (
                        <button
                            id="upload-document-btn"
                            onClick={() => setShowUpload(true)}
                            className="flex items-center gap-2 rounded-md bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)] transition "
                        >
                            <FiPlus size={16} /> Upload Document
                        </button>
                    )}
                </div>

                {/* Filter Tabs + Search */}
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-2">
                        {FILE_TYPES.map(type => (
                            <button
                                key={type}
                                onClick={() => setActiveType(type)}
                                className={`rounded-md px-4 py-2 text-sm font-medium transition
                                    ${activeType === type
                                        ? "bg-[var(--accent)] text-[var(--accent-contrast)] "
                                        : "bg-[var(--surface-card)] border border-[var(--border-color)] text-[var(--subtitle-color)] hover:bg-[var(--surface-muted)]"}`}
                            >
                                {type}
                            </button>
                        ))}
                    </div>
                    <div className="relative">
                        <FiSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-color)]" />
                        <input
                            type="text"
                            placeholder="Search documents..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-56 rounded-md border border-[var(--border-color)] bg-[var(--surface-card)] py-2 pl-9 pr-4 text-sm outline-none focus:border-[var(--title-color)] focus:ring-1 focus:ring-gray-200"
                        />
                    </div>
                </div>

                {/* Content */}
                {loading && (
                    <div className="flex items-center justify-center py-20">
                        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--border-color)] border-t-[var(--title-color)]" />
                    </div>
                )}

                {!loading && error && (
                    <div className="rounded-md bg-red-50 border border-red-200 p-4 text-sm text-red-600">{error}</div>
                )}

                {!loading && !error && filtered.length === 0 && (
                    <div className="py-20 text-center">
                        <FiUploadCloud size={48} className="mx-auto mb-3 text-[var(--muted-color)]" />
                        <p className="text-lg font-medium text-[var(--muted-color)]">No documents found</p>
                        <p className="text-sm text-[var(--muted-color)] mt-1">
                            {search ? "Try a different search term." : "Upload your first document to get started."}
                        </p>
                    </div>
                )}

                {!loading && !error && filtered.length > 0 && (
                    <>
                        <p className="mb-4 text-xs text-[var(--muted-color)]">{filtered.length} document{filtered.length !== 1 ? "s" : ""}</p>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {filtered.map(doc => (
                                <DocumentCard
                                    key={doc._id}
                                    doc={doc}
                                    onPreview={setPreviewDoc}
                                    onDelete={setDeleteTarget}
                                    canDelete={canDeleteDocument(doc)}
                                />
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* Modals */}
            {showUpload && (
                <UploadModal
                    onClose={() => setShowUpload(false)}
                    onSuccess={() => fetchDocuments(activeType)}
                    projects={manageableProjects}
                />
            )}
            {previewDoc && (
                <PreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />
            )}
            {deleteTarget && (
                <DeleteConfirm
                    doc={deleteTarget}
                    onConfirm={handleDelete}
                    onCancel={() => setDeleteTarget(null)}
                    loading={deleting}
                />
            )}
        </div>
    );
}






