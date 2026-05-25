import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  CheckCircle2,
  XCircle,
  Trash2,
  Edit3,
  LogOut,
  Shield,
  Clock,
  Search,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { CATEGORIES } from '../constants';
import {
  adminLogin,
  adminLogout,
  adminSession,
  deleteAdminBook,
  fetchAdminBooks,
  moderateBook,
  updateAdminBook,
  type AdminBook,
  type ModerationStatus,
} from '../adminApi';
import { buildApiUrl } from '../api';

type StatusFilter = 'pending' | 'approved' | 'rejected' | 'all';

interface AdminPanelProps {
  onExit: () => void;
}

const STATUS_TABS: { id: StatusFilter; label: string }[] = [
  { id: 'pending', label: 'Pending review' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'all', label: 'All' },
];

function statusBadge(status?: ModerationStatus) {
  if (status === 'approved') {
    return 'bg-emerald-100 text-emerald-800';
  }
  if (status === 'rejected') {
    return 'bg-red-100 text-red-800';
  }
  return 'bg-amber-100 text-amber-900';
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onExit }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [configured, setConfigured] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [books, setBooks] = useState<AdminBook[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingBook, setEditingBook] = useState<AdminBook | null>(null);
  const [moderationNote, setModerationNote] = useState('');
  const [rejectTarget, setRejectTarget] = useState<AdminBook | null>(null);

  const loadBooks = useCallback(async () => {
    setActionError(null);
    try {
      const data = await fetchAdminBooks({
        status: statusFilter,
        query: searchQuery.trim() || undefined,
      });
      setBooks(data.books);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to load books');
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    (async () => {
      try {
        const session = await adminSession();
        setConfigured(session.configured);
        setAuthenticated(session.authenticated);
        setAdminEmail(session.email || null);
      } catch {
        setConfigured(false);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (authenticated) {
      loadBooks();
    }
  }, [authenticated, loadBooks]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    try {
      const result = await adminLogin(email, password);
      setAuthenticated(true);
      setAdminEmail(result.email);
      setPassword('');
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  const handleLogout = async () => {
    await adminLogout().catch(() => undefined);
    setAuthenticated(false);
    setAdminEmail(null);
    setBooks([]);
  };

  const handleApprove = async (book: AdminBook) => {
    try {
      await moderateBook(book.id, 'approve', moderationNote || undefined);
      setModerationNote('');
      await loadBooks();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Approve failed');
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    try {
      await moderateBook(rejectTarget.id, 'reject', moderationNote || 'Does not meet library guidelines.');
      setRejectTarget(null);
      setModerationNote('');
      await loadBooks();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Reject failed');
    }
  };

  const openBookFile = async (book: AdminBook) => {
    if (!book.has_file) {
      setActionError('No file attached to this submission.');
      return;
    }
    try {
      const res = await fetch(buildApiUrl(`/api/admin/books/${book.id}/file`), { credentials: 'include' });
      const data = await res.json();
      if (!res.ok || !data.file_data) {
        throw new Error(data.error || 'Could not load file');
      }
      window.open(data.file_data, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not preview file');
    }
  };

  const handleDelete = async (book: AdminBook) => {
    if (!window.confirm(`Delete "${book.title}" permanently?`)) return;
    try {
      await deleteAdminBook(book.id);
      await loadBooks();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBook) return;
    try {
      await updateAdminBook(editingBook.id, {
        title: editingBook.title,
        author: editingBook.author,
        category: editingBook.category,
        description: editingBook.description,
        rating: editingBook.rating,
        pages: editingBook.pages,
        format: editingBook.format,
        cover: editingBook.cover,
        uploader: editingBook.uploader,
        moderation_status: editingBook.moderation_status,
        moderation_note: editingBook.moderation_note,
      });
      setEditingBook(null);
      await loadBooks();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Update failed');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-28 pb-16 flex items-center justify-center">
        <p className="text-secondary">Loading admin…</p>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen pt-28 pb-16 px-6">
        <div className="max-w-md mx-auto bg-white rounded-3xl border border-surface-container-high shadow-lg p-8">
          <div className="flex items-center gap-3 mb-6">
            <Shield className="text-primary" size={28} />
            <div>
              <h1 className="text-2xl font-bold text-charcoal">Admin</h1>
              <p className="text-sm text-secondary">Curate uploads and manage the library</p>
            </div>
          </div>

          {!configured && (
            <div className="mb-4 p-4 rounded-xl bg-amber-50 text-amber-900 text-sm flex gap-2">
              <AlertTriangle size={18} className="shrink-0" />
              <span>Admin env vars are not set on the server (ADMIN_EMAIL, ADMIN_PASSWORD_HASH).</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-charcoal mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-surface-container-high px-4 py-3"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-charcoal mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-surface-container-high px-4 py-3"
                required
              />
            </div>
            {loginError && <p className="text-sm text-red-600">{loginError}</p>}
            <button
              type="submit"
              className="w-full bg-primary text-white py-3 rounded-full font-semibold hover:opacity-90"
            >
              Sign in
            </button>
          </form>

          <button type="button" onClick={onExit} className="mt-6 text-sm text-secondary hover:text-charcoal">
            ← Back to site
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-28 pb-16 px-4 md:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-charcoal flex items-center gap-2">
              <Shield className="text-primary" />
              Admin curation
            </h1>
            <p className="text-secondary text-sm mt-1">
              Signed in as {adminEmail}. Review community uploads before they appear in the library.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={loadBooks}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-surface-container-high text-sm font-semibold hover:bg-surface-container"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-surface-container-high text-sm font-semibold"
            >
              <LogOut size={16} />
              Logout
            </button>
            <button type="button" onClick={onExit} className="px-4 py-2 rounded-full text-sm font-semibold text-secondary">
              Exit
            </button>
          </div>
        </div>

        <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-100 text-sm text-amber-950">
          <strong>Moderation policy:</strong> Approve only faith-appropriate, non-copyright-infringing submissions.
          Reject explicit, pirated, or off-mission material and leave an internal note when helpful.
        </div>

        {actionError && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-700 text-sm">{actionError}</div>
        )}

        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          <div className="flex flex-wrap gap-2">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-4 py-2 rounded-full text-sm font-semibold capitalize ${
                  statusFilter === tab.id ? 'bg-primary text-white' : 'bg-surface-container text-secondary'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" size={18} />
            <input
              type="search"
              placeholder="Search title, author, uploader…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-full border border-surface-container-high"
            />
          </div>
        </div>

        {books.length === 0 ? (
          <div className="text-center py-20 text-secondary rounded-3xl border border-dashed border-surface-container-high">
            <Clock size={40} className="mx-auto mb-3 opacity-40" />
            No books in this queue.
          </div>
        ) : (
          <div className="space-y-4">
            {books.map((book) => (
              <motion.div
                key={book.id}
                layout
                className="bg-white rounded-2xl border border-surface-container-high p-5 shadow-sm"
              >
                <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                  <img
                    src={book.cover || '/Sacred+Rhythms.png'}
                    alt=""
                    className="w-20 h-28 object-cover rounded-lg shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h2 className="font-bold text-lg text-charcoal">{book.title}</h2>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full capitalize ${statusBadge(book.moderation_status)}`}>
                        {book.moderation_status || 'pending'}
                      </span>
                    </div>
                    <p className="text-secondary text-sm">
                      {book.author} · {book.category} · uploaded by {book.uploader || 'Unknown'}
                    </p>
                    <p className="text-sm text-charcoal/80 mt-2 line-clamp-2">{book.description}</p>
                    {book.moderation_note && (
                      <p className="text-xs text-secondary mt-2">
                        <strong>Note:</strong> {book.moderation_note}
                      </p>
                    )}
                    <p className="text-xs text-secondary mt-1">
                      {book.date_added ? new Date(book.date_added).toLocaleString() : ''}
                      {book.has_file ? ' · has file' : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    {book.has_file && (
                      <button
                        type="button"
                        onClick={() => openBookFile(book)}
                        className="inline-flex items-center gap-1 px-3 py-2 rounded-full border border-surface-container-high text-sm font-semibold"
                      >
                        Preview file
                      </button>
                    )}
                    {book.moderation_status !== 'approved' && (
                      <button
                        type="button"
                        onClick={() => handleApprove(book)}
                        className="inline-flex items-center gap-1 px-3 py-2 rounded-full bg-emerald-600 text-white text-sm font-semibold"
                      >
                        <CheckCircle2 size={16} />
                        Approve
                      </button>
                    )}
                    {book.moderation_status !== 'rejected' && (
                      <button
                        type="button"
                        onClick={() => {
                          setRejectTarget(book);
                          setModerationNote('');
                        }}
                        className="inline-flex items-center gap-1 px-3 py-2 rounded-full bg-red-600 text-white text-sm font-semibold"
                      >
                        <XCircle size={16} />
                        Reject
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setEditingBook({ ...book })}
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-full border border-surface-container-high text-sm font-semibold"
                    >
                      <Edit3 size={16} />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(book)}
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-full border border-red-200 text-red-700 text-sm font-semibold"
                    >
                      <Trash2 size={16} />
                      Delete
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        <div className="mt-6">
          <label className="block text-sm font-semibold text-charcoal mb-1">
            Moderation note (optional, used for next approve/reject)
          </label>
          <input
            type="text"
            value={moderationNote}
            onChange={(e) => setModerationNote(e.target.value)}
            placeholder="e.g. Approved — aligns with Christian living focus"
            className="w-full rounded-xl border border-surface-container-high px-4 py-2 text-sm"
          />
        </div>
      </div>

      {rejectTarget && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h3 className="font-bold text-lg mb-2">Reject “{rejectTarget.title}”?</h3>
            <p className="text-sm text-secondary mb-4">This book will not appear in the public library.</p>
            <textarea
              value={moderationNote}
              onChange={(e) => setModerationNote(e.target.value)}
              placeholder="Reason (copyright concern, inappropriate content, etc.)"
              className="w-full rounded-xl border border-surface-container-high p-3 text-sm min-h-[100px] mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setRejectTarget(null)} className="px-4 py-2 rounded-full text-sm font-semibold">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                className="px-4 py-2 rounded-full bg-red-600 text-white text-sm font-semibold"
              >
                Reject submission
              </button>
            </div>
          </div>
        </div>
      )}

      {editingBook && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={handleSaveEdit} className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-xl my-8">
            <h3 className="font-bold text-lg mb-4">Edit book</h3>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {(['title', 'author', 'category', 'format', 'cover', 'uploader'] as const).map((field) => (
                <div key={field}>
                  <label className="block text-xs font-semibold capitalize mb-1">{field}</label>
                  {field === 'category' ? (
                    <select
                      value={editingBook.category}
                      onChange={(e) => setEditingBook({ ...editingBook, category: e.target.value })}
                      className="w-full rounded-lg border px-3 py-2"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={String(editingBook[field] || '')}
                      onChange={(e) => setEditingBook({ ...editingBook, [field]: e.target.value })}
                      className="w-full rounded-lg border px-3 py-2"
                    />
                  )}
                </div>
              ))}
              <div>
                <label className="block text-xs font-semibold mb-1">Description</label>
                <textarea
                  value={editingBook.description || ''}
                  onChange={(e) => setEditingBook({ ...editingBook, description: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 min-h-[80px]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Rating</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    step={0.1}
                    value={editingBook.rating ?? 5}
                    onChange={(e) => setEditingBook({ ...editingBook, rating: Number(e.target.value) })}
                    className="w-full rounded-lg border px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Pages</label>
                  <input
                    type="number"
                    min={1}
                    value={editingBook.pages ?? 100}
                    onChange={(e) => setEditingBook({ ...editingBook, pages: Number(e.target.value) })}
                    className="w-full rounded-lg border px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Status</label>
                <select
                  value={editingBook.moderation_status || 'pending'}
                  onChange={(e) =>
                    setEditingBook({
                      ...editingBook,
                      moderation_status: e.target.value as ModerationStatus,
                    })
                  }
                  className="w-full rounded-lg border px-3 py-2"
                >
                  <option value="pending">pending</option>
                  <option value="approved">approved</option>
                  <option value="rejected">rejected</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-6">
              <button type="button" onClick={() => setEditingBook(null)} className="px-4 py-2 rounded-full text-sm font-semibold">
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 rounded-full bg-primary text-white text-sm font-semibold">
                Save changes
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
