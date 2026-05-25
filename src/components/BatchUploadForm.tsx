import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Upload,
  X,
  CheckCircle2,
  FileUp,
  AlertCircle,
  Layers,
  User,
  Star,
  FileText,
  Trash2,
  Edit2,
} from 'lucide-react';
import { CATEGORIES, DEFAULT_COVER_URL } from '../constants';
import { API_BASE_URL, buildApiUrl } from '../api';
import {
  ALLOWED_BOOK_ACCEPT,
  MAX_BATCH_CONCURRENCY,
  MAX_BATCH_FILES,
  MAX_BOOK_FILE_BYTES,
  formatMegabytes,
} from '../lib/uploadLimits';
import {
  fetchCsrfToken,
  getExtension,
  isAllowedBookExtension,
  mapWithConcurrency,
  parseApiResponse,
} from '../lib/apiClient';
import { UploadGuidelines } from './UploadGuidelines';

interface BatchUploadFormProps {
  onSuccess: (books: any[]) => void;
  onCancel: () => void;
}

interface BatchFile {
  id: string;
  file: File;
  title: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

export const BatchUploadForm: React.FC<BatchUploadFormProps> = ({ onSuccess, onCancel }) => {
  const [files, setFiles] = useState<BatchFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ ok: number; failed: number } | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

  const [commonMetadata, setCommonMetadata] = useState({
    author: '',
    category: CATEGORIES[0],
    rating: 5,
    description: 'Shared via batch upload.',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const addMoreInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchCsrfToken().then(setCsrfToken).catch(() => setCsrfToken(null));
  }, []);

  const cleanFileName = (name: string) =>
    name
      .replace(/\.[^/.]+$/, '')
      .replace(/[_-]/g, ' ')
      .replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());

  const getFormatFromFileName = (fileName: string) => getExtension(fileName).toUpperCase() || 'PDF';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const addFiles = (newFiles: File[]) => {
    const remainingSlots = Math.max(0, MAX_BATCH_FILES - files.length);
    if (remainingSlots === 0) {
      setError(`Batch upload supports up to ${MAX_BATCH_FILES} files at a time.`);
      return;
    }

    const skipped: string[] = [];
    const accepted: File[] = [];

    for (const file of newFiles.slice(0, remainingSlots)) {
      if (!isAllowedBookExtension(file.name)) {
        skipped.push(`${file.name} (unsupported type)`);
        continue;
      }
      if (file.size > MAX_BOOK_FILE_BYTES) {
        skipped.push(`${file.name} (over ${formatMegabytes(MAX_BOOK_FILE_BYTES)})`);
        continue;
      }
      accepted.push(file);
    }

    if (newFiles.length > remainingSlots) {
      skipped.push(`Only ${remainingSlots} more file(s) could be added (max ${MAX_BATCH_FILES}).`);
    }

    if (skipped.length > 0) {
      setError(skipped.join(' '));
    } else {
      setError(null);
    }

    if (accepted.length === 0) return;

    const batchFiles: BatchFile[] = accepted.map((file) => ({
      id: Math.random().toString(36).substring(7),
      file,
      title: cleanFileName(file.name),
      status: 'pending',
    }));

    setFiles((prev) => [...prev, ...batchFiles]);
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const updateFileTitle = (id: string, newTitle: string) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, title: newTitle } : f)));
  };

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
      reader.readAsDataURL(file);
    });

  const uploadOne = async (batchFile: BatchFile, token: string) => {
    const fileData = await readFileAsDataUrl(batchFile.file);
    const response = await fetch(buildApiUrl('/api/books'), {
      method: 'POST',
      credentials: 'include',
      mode: API_BASE_URL ? 'cors' : 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'x-xsrf-token': token,
      },
      body: JSON.stringify({
        title: batchFile.title,
        author: commonMetadata.author,
        category: commonMetadata.category,
        description: commonMetadata.description,
        rating: Number(commonMetadata.rating),
        pages: 100,
        format: getFormatFromFileName(batchFile.file.name),
        cover: DEFAULT_COVER_URL,
        fileName: batchFile.file.name,
        fileType: batchFile.file.type,
        fileSize: batchFile.file.size,
        fileData,
      }),
    });

    const responseBody = await parseApiResponse(response);
    if (!response.ok) {
      const message =
        responseBody && typeof responseBody === 'object' && 'error' in responseBody
          ? String(responseBody.error)
          : `Upload failed for ${batchFile.file.name}`;
      throw new Error(message);
    }
    if (!responseBody || typeof responseBody !== 'object') {
      throw new Error(`Invalid server response for ${batchFile.file.name}`);
    }
    return responseBody;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) {
      setError('Please add at least one book file.');
      return;
    }

    if (!commonMetadata.author.trim()) {
      setError('Common author name is required.');
      return;
    }

    let token = csrfToken;
    if (!token) {
      token = await fetchCsrfToken();
      setCsrfToken(token);
    }
    if (!token) {
      setError('Could not start a secure session. Refresh the page and try again.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSummary(null);

    const uploadedBooks: any[] = [];
    let failed = 0;

    setFiles((prev) => prev.map((f) => ({ ...f, status: 'pending' as const, error: undefined })));

    await mapWithConcurrency<BatchFile, void>(files, MAX_BATCH_CONCURRENCY, async (batchFile) => {
      setFiles((prev) =>
        prev.map((file) =>
          file.id === batchFile.id ? { ...file, status: 'uploading', error: undefined } : file
        )
      );

      try {
        const result = await uploadOne(batchFile, token!);
        uploadedBooks.push(result);
        setFiles((prev) =>
          prev.map((file) =>
            file.id === batchFile.id ? { ...file, status: 'success', error: undefined } : file
          )
        );
      } catch (fileError: unknown) {
        failed += 1;
        const message = fileError instanceof Error ? fileError.message : 'Upload failed';
        setFiles((prev) =>
          prev.map((file) =>
            file.id === batchFile.id ? { ...file, status: 'error', error: message } : file
          )
        );
      }
    });

    setIsSubmitting(false);
    setSummary({ ok: uploadedBooks.length, failed });

    if (uploadedBooks.length === 0) {
      setError('No files uploaded. Fix errors above or try again.');
      return;
    }

    setIsSuccess(true);
    setTimeout(() => onSuccess(uploadedBooks), 2500);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files) addFiles(Array.from(e.dataTransfer.files));
  };

  if (isSuccess) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-3xl shadow-xl border border-surface-container-high"
      >
        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 size={40} />
        </div>
        <h2 className="text-3xl font-bold text-charcoal mb-4">Batch upload complete</h2>
        <p className="text-secondary max-w-md">
          {summary?.ok ?? files.length} file(s) submitted for review.
          {summary && summary.failed > 0 ? ` ${summary.failed} failed — see the queue for details.` : ''}
          {' '}Approved books will appear in the library.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-5xl mx-auto bg-white rounded-3xl shadow-2xl border border-surface-container-high overflow-hidden"
    >
      <div className="flex flex-col lg:flex-row h-[80vh]">
        <div className="w-full lg:w-80 bg-surface-container-low border-r border-surface-container-high p-8 flex flex-col gap-6 overflow-y-auto">
          <div>
            <h3 className="text-lg font-bold text-charcoal mb-1">Batch Settings</h3>
            <p className="text-xs text-secondary">Applied to all files in this batch.</p>
          </div>
          <UploadGuidelines />
          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-secondary/40 uppercase tracking-widest px-1">Common Author</label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
                <input
                  value={commonMetadata.author}
                  onChange={(e) => setCommonMetadata((prev) => ({ ...prev, author: e.target.value }))}
                  placeholder="Author Name"
                  className="w-full pl-9 pr-4 py-2.5 bg-white border border-surface-container-high rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-secondary/40 uppercase tracking-widest px-1">Common Category</label>
              <div className="relative">
                <Layers size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
                <select
                  value={commonMetadata.category}
                  onChange={(e) => setCommonMetadata((prev) => ({ ...prev, category: e.target.value }))}
                  className="w-full pl-9 pr-4 py-2.5 bg-white border border-surface-container-high rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none appearance-none cursor-pointer h-10"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-secondary/40 uppercase tracking-widest px-1">Default Rating</label>
              <div className="relative">
                <Star size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={commonMetadata.rating}
                  onChange={(e) => setCommonMetadata((prev) => ({ ...prev, rating: Number(e.target.value) }))}
                  className="w-full pl-9 pr-4 py-2.5 bg-white border border-surface-container-high rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col bg-white overflow-hidden">
          <div className="p-8 border-b border-surface-container-high flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-charcoal">Batch Upload Queue</h2>
              <p className="text-secondary text-sm">
                {files.length} / {MAX_BATCH_FILES} files · uploads run {MAX_BATCH_CONCURRENCY} at a time
              </p>
            </div>
            <button onClick={onCancel} className="p-2 hover:bg-surface-container rounded-full transition-colors text-secondary">
              <X size={24} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-8">
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl flex items-center gap-3">
                <AlertCircle size={20} />
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}

            {files.length === 0 ? (
              <div
                className={`h-full border-2 border-dashed rounded-3xl flex flex-col items-center justify-center transition-all cursor-pointer ${dragActive ? 'border-primary bg-primary/5' : 'border-surface-container-high bg-surface-container-low hover:border-primary/50'}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input ref={fileInputRef} type="file" multiple accept={ALLOWED_BOOK_ACCEPT} className="hidden" onChange={handleFileChange} />
                <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-4">
                  <FileUp size={32} />
                </div>
                <h4 className="text-lg font-bold text-charcoal">Drop your books here</h4>
                <p className="text-sm text-secondary mt-1 text-center px-6">
                  PDF, EPUB, MOBI, DOC, DOCX — max {formatMegabytes(MAX_BOOK_FILE_BYTES)} each
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <AnimatePresence>
                  {files.map((f) => (
                    <motion.div
                      key={f.id}
                      layout
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="p-4 bg-surface-container-low border border-surface-container-high rounded-2xl flex items-center gap-4 group"
                    >
                      <div className="w-12 h-12 rounded-xl bg-white border border-surface-container flex items-center justify-center text-primary shadow-sm flex-shrink-0">
                        <FileText size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <input
                            value={f.title}
                            onChange={(e) => updateFileTitle(f.id, e.target.value)}
                            className="bg-transparent font-bold text-charcoal text-sm outline-none border-b border-transparent focus:border-primary w-full"
                          />
                          <Edit2 size={12} className="text-secondary opacity-0 group-hover:opacity-100" />
                        </div>
                        <p className="text-[11px] text-secondary flex items-center gap-2">
                          {f.file.name} · {(f.file.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                        {(f.status !== 'pending' || f.error) && (
                          <p
                            className={`text-[11px] mt-1 ${f.status === 'error' ? 'text-red-600' : f.status === 'success' ? 'text-green-600' : 'text-primary'}`}
                          >
                            {f.status === 'uploading' && 'Uploading…'}
                            {f.status === 'success' && 'Submitted for review'}
                            {f.status === 'error' && (f.error || 'Upload failed')}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(f.id)}
                        disabled={isSubmitting}
                        className="p-2 text-secondary hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {files.length < MAX_BATCH_FILES && (
                  <button
                    type="button"
                    onClick={() => addMoreInputRef.current?.click()}
                    disabled={isSubmitting}
                    className="w-full py-4 border-2 border-dashed border-surface-container-high rounded-2xl text-secondary hover:text-primary hover:border-primary/50 text-sm font-bold transition-all"
                  >
                    + Add More Files
                    <input ref={addMoreInputRef} type="file" multiple accept={ALLOWED_BOOK_ACCEPT} className="hidden" onChange={handleFileChange} />
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="p-8 bg-surface-container-low border-t border-surface-container-high flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-charcoal">{files.length} files selected</span>
              <span className="text-[10px] text-secondary">Each file is reviewed before going live</span>
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || files.length === 0}
              className="bg-primary text-white px-10 py-4 rounded-2xl font-bold flex items-center gap-3 shadow-xl shadow-orange-500/20 active:scale-95 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <Upload size={20} />
                  Submit batch
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
