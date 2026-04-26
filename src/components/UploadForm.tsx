import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { Upload, X, CheckCircle2, Image as ImageIcon, Link as LinkIcon, FileUp, AlertCircle } from 'lucide-react';
import { CATEGORIES, FORMATS } from '../constants';
import { API_BASE_URL, buildApiUrl } from '../api';

interface UploadFormProps {
  onSuccess: (book: unknown) => void;
  onCancel: () => void;
}

export const UploadForm: React.FC<UploadFormProps> = ({ onSuccess, onCancel }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coverMode, setCoverMode] = useState<'url' | 'file'>('url');
  const [dragActive, setDragActive] = useState(false);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    category: CATEGORIES[0],
    description: '',
    rating: 5,
    pages: 100,
    format: FORMATS[0],
    cover: '',
    coverFile: null as File | null
  });

  useEffect(() => {
    const fetchCsrf = async () => {
      try {
        const res = await fetch(buildApiUrl('/api/csrf-token'), {
          credentials: 'include',
        });
        const data = await res.json();
        setCsrfToken(data.token);
      } catch (err) {
        console.error("Failed to fetch CSRF token", err);
      }
    };
    fetchCsrf();
  }, []);

  const validate = () => {
    if (!formData.title.trim()) return "Book title is required";
    if (!formData.author.trim()) return "Author is required";
    if (!formData.description.trim()) return "Description is required";
    if (formData.rating < 1 || formData.rating > 5) return "Rating must be between 1 and 5";
    if (formData.pages < 1) return "Page count must be at least 1";
    return null;
  };

  const parseResponseBody = async (response: Response) => {
    const contentType = response.headers.get('content-type') || '';
    const rawText = await response.text();

    if (contentType.includes('application/json')) {
      try {
        return rawText ? JSON.parse(rawText) : null;
      } catch {
        throw new Error('The server returned invalid JSON.');
      }
    }

    if (rawText.trim().startsWith('<!doctype') || rawText.trim().startsWith('<html')) {
      throw new Error(
        window.location.port === '5173'
          ? 'The app is running on Vite dev server instead of the Express API server. Open the app from http://localhost:3000 and try again.'
          : API_BASE_URL
            ? `The configured API base URL (${API_BASE_URL}) returned an HTML page instead of API JSON.`
            : 'The server returned an HTML page instead of API JSON. Please verify the app is running from the Express server.'
      );
    }

    return rawText;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    
    try {
      const response = await fetch(buildApiUrl('/api/books'), {
        method: 'POST',
        credentials: 'include',
        mode: API_BASE_URL ? 'cors' : 'same-origin',
        headers: { 
          'Content-Type': 'application/json',
          'x-xsrf-token': csrfToken || ''
        },
        body: JSON.stringify({
          ...formData,
          rating: Number(formData.rating),
          pages: Number(formData.pages)
        }),
      });

      const responseBody = await parseResponseBody(response);

      if (!response.ok) {
        if (responseBody && typeof responseBody === 'object' && 'error' in responseBody) {
          throw new Error(String(responseBody.error));
        }
        if (typeof responseBody === 'string' && responseBody.trim()) {
          throw new Error(responseBody);
        }
        throw new Error('Upload failed');
      }

      if (!responseBody || typeof responseBody !== 'object') {
        throw new Error('The server did not return the uploaded book details.');
      }

      setIsSubmitting(false);
      setIsSuccess(true);
      setTimeout(() => {
        onSuccess(responseBody);
      }, 2000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to upload book. Please check your connection.');
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFormData(prev => ({ ...prev, coverFile: file, cover: URL.createObjectURL(file) }));
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setFormData(prev => ({ ...prev, coverFile: file, cover: URL.createObjectURL(file) }));
    }
  };

  if (isSuccess) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center p-6 md:p-12 text-center bg-white rounded-3xl shadow-xl border border-surface-container-high"
      >
        <div className="w-16 h-16 md:w-20 md:h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 size={32} className="md:w-10 md:h-10" />
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-charcoal mb-4">Upload Successful!</h2>
        <p className="text-secondary max-w-sm text-sm md:text-base">Your contribution has been added to the sanctuary. Thank you for sharing your wisdom.</p>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto bg-white rounded-2xl md:rounded-3xl shadow-xl border border-surface-container-high overflow-hidden"
    >
      <div className="p-6 md:p-12">
        <div className="flex justify-between items-start md:items-center mb-8 md:mb-10">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-charcoal tracking-tight">Upload to the Sanctuary</h2>
            <p className="text-secondary mt-2 text-sm md:text-base">Share a spiritual work with our global community.</p>
          </div>
          <button 
            onClick={onCancel}
            className="p-2 md:p-3 hover:bg-surface-container rounded-full transition-colors text-secondary"
          >
            <X size={20} className="md:w-6 md:h-6" />
          </button>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl flex items-center gap-3 text-sm md:text-base"
          >
            <AlertCircle size={20} className="flex-shrink-0" />
            <p className="font-medium">{error}</p>
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
          <div className="space-y-4 md:space-y-6">
            <div className="flex flex-col gap-1 md:gap-2">
              <label className="text-[10px] md:text-xs font-black text-secondary/40 uppercase tracking-widest px-1">Book Title</label>
              <input 
                required
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="The Way of the Wise"
                className="w-full px-4 md:px-5 py-3 md:py-3.5 bg-surface-container-low border border-surface-container-high rounded-xl md:rounded-2xl focus:ring-2 focus:ring-primary focus:bg-white transition-all text-sm outline-none"
              />
            </div>

            <div className="flex flex-col gap-1 md:gap-2">
              <label className="text-[10px] md:text-xs font-black text-secondary/40 uppercase tracking-widest px-1">Author Name</label>
              <input 
                required
                name="author"
                value={formData.author}
                onChange={handleChange}
                placeholder="Marcus Aurelius"
                className="w-full px-4 md:px-5 py-3 md:py-3.5 bg-surface-container-low border border-surface-container-high rounded-xl md:rounded-2xl focus:ring-2 focus:ring-primary focus:bg-white transition-all text-sm outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <div className="flex flex-col gap-1 md:gap-2">
                <label className="text-[10px] md:text-xs font-black text-secondary/40 uppercase tracking-widest px-1">Category</label>
                <div className="relative">
                  <select 
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    className="w-full px-4 md:px-5 py-3 md:py-3.5 bg-surface-container-low border border-surface-container-high rounded-xl md:rounded-2xl focus:ring-2 focus:ring-primary focus:bg-white transition-all text-sm outline-none appearance-none cursor-pointer"
                  >
                    {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-1 md:gap-2">
                <label className="text-[10px] md:text-xs font-black text-secondary/40 uppercase tracking-widest px-1">Format</label>
                <select 
                  name="format"
                  value={formData.format}
                  onChange={handleChange}
                  className="w-full px-4 md:px-5 py-3 md:py-3.5 bg-surface-container-low border border-surface-container-high rounded-xl md:rounded-2xl focus:ring-2 focus:ring-primary focus:bg-white transition-all text-sm outline-none appearance-none cursor-pointer"
                >
                  {FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <div className="flex flex-col gap-1 md:gap-2">
                <label className="text-[10px] md:text-xs font-black text-secondary/40 uppercase tracking-widest px-1">Page Count</label>
                <input 
                  type="number"
                  name="pages"
                  value={formData.pages}
                  onChange={handleChange}
                  className="w-full px-4 md:px-5 py-3 md:py-3.5 bg-surface-container-low border border-surface-container-high rounded-xl md:rounded-2xl focus:ring-2 focus:ring-primary focus:bg-white transition-all text-sm outline-none"
                />
              </div>
              <div className="flex flex-col gap-1 md:gap-2">
                <label className="text-[10px] md:text-xs font-black text-secondary/40 uppercase tracking-widest px-1">Rating (1-5)</label>
                <input 
                  type="number"
                  min="1"
                  max="5"
                  step="0.1"
                  name="rating"
                  value={formData.rating}
                  onChange={handleChange}
                  className="w-full px-4 md:px-5 py-3 md:py-3.5 bg-surface-container-low border border-surface-container-high rounded-xl md:rounded-2xl focus:ring-2 focus:ring-primary focus:bg-white transition-all text-sm outline-none"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 md:space-y-6">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-1">
                <label className="text-[10px] md:text-xs font-black text-secondary/40 uppercase tracking-widest">Cover Image</label>
                <div className="flex bg-surface-container rounded-lg p-0.5">
                  <button 
                    type="button"
                    onClick={() => setCoverMode('url')}
                    className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${coverMode === 'url' ? 'bg-white text-primary shadow-sm' : 'text-secondary hover:text-charcoal'}`}
                  >
                    URL
                  </button>
                  <button 
                    type="button"
                    onClick={() => setCoverMode('file')}
                    className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${coverMode === 'file' ? 'bg-white text-primary shadow-sm' : 'text-secondary hover:text-charcoal'}`}
                  >
                    Upload
                  </button>
                </div>
              </div>

              {coverMode === 'url' ? (
                <div className="relative">
                  <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary" size={16} />
                  <input 
                    name="cover"
                    value={formData.cover}
                    onChange={handleChange}
                    placeholder="https://example.com/cover.jpg"
                    className="w-full pl-11 pr-4 py-3 md:py-3.5 bg-surface-container-low border border-surface-container-high rounded-xl md:rounded-2xl focus:ring-2 focus:ring-primary focus:bg-white transition-all text-sm outline-none"
                  />
                </div>
              ) : (
                <div 
                  className={`relative border-2 border-dashed rounded-xl md:rounded-2xl p-6 md:p-8 flex flex-col items-center justify-center transition-all cursor-pointer ${dragActive ? 'border-primary bg-primary/5' : 'border-surface-container-high bg-surface-container-low hover:border-primary/50'}`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden" 
                    accept="image/*"
                  />
                  {formData.cover ? (
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-16 rounded overflow-hidden shadow-md">
                        <img src={formData.cover} className="w-full h-full object-cover" alt="Preview" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-charcoal">Image selected</span>
                        <span className="text-[10px] text-primary hover:underline" onClick={(e) => { e.stopPropagation(); setFormData(p => ({ ...p, cover: '', coverFile: null })); }}>Remove</span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <FileUp className="text-secondary mb-2" size={24} />
                      <span className="text-sm font-bold text-charcoal">Click to upload or drag & drop</span>
                      <span className="text-[10px] text-secondary mt-1 text-center">PNG, JPG or WebP (max 4MB)</span>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1 md:gap-2">
              <label className="text-[10px] md:text-xs font-black text-secondary/40 uppercase tracking-widest px-1">Description / Synopsis</label>
              <textarea 
                required
                name="description"
                rows={4}
                value={formData.description}
                onChange={handleChange}
                placeholder="A brief overview of the book's contents..."
                className="w-full px-4 md:px-5 py-3 md:py-4 bg-surface-container-low border border-surface-container-high rounded-xl md:rounded-2xl focus:ring-2 focus:ring-primary focus:bg-white transition-all text-sm outline-none resize-none"
              />
            </div>

            <div className="pt-2 md:pt-4">
              <button 
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-primary text-white py-3.5 md:py-4 rounded-xl md:rounded-2xl font-bold hover:shadow-xl shadow-orange-500/20 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Upload size={18} className="md:w-5 md:h-5" />
                    Submit to Library
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </motion.div>
  );
};
