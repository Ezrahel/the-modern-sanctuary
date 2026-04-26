/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Download, 
  Search as SearchIcon, 
  Upload, 
  ChevronRight, 
  Star, 
  User, 
  Quote as QuoteIcon, 
  Globe as PublicIcon, 
  Edit3, 
  TrendingUp, 
  Globe, 
  Mail,
  ArrowRight,
  Filter,
  SortAsc,
  Calendar,
  Layers,
  FileText,
  Settings,
  Maximize2,
  X,
  CheckCircle2,
  Instagram,
  Linkedin,
  Twitter,
  Bookmark,
  BookmarkCheck,
  ChevronDown,
  ChevronsUpDown,
  Settings2,
  Type
} from 'lucide-react';
import Fuse from 'fuse.js';
import { BookCard } from './components/BookCard';
import { UploadForm } from './components/UploadForm';
import { ListSkeleton, SearchSkeleton } from './components/Skeleton';
import { BOOKS, CATEGORIES, FORMATS, Screen, BookType } from './constants';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [selectedBook, setSelectedBook] = useState<BookType | null>(null);

  // Reading Mode State
  const [isReadingMode, setIsReadingMode] = useState(false);
  const [readingSettings, setReadingSettings] = useState({
    fontSize: 18,
    lineHeight: 1.6,
    theme: 'sepia' // 'light', 'dark', 'sepia'
  });

  // Reading Progress State (bookId -> percentage)
  const [progressData, setProgressData] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('sanctuary_progress');
    return saved ? JSON.parse(saved) : {};
  });

  // Bookmark State (bookId -> {id, name, paragraphIndex, timestamp}[])
  const [bookmarks, setBookmarks] = useState<Record<string, {id: string, name: string, paragraphIndex: number, timestamp: number}[]>>(() => {
    const saved = localStorage.getItem('sanctuary_bookmarks');
    return saved ? JSON.parse(saved) : {};
  });

  const addBookmark = (bookId: string, paragraphIndex: number, name?: string) => {
    const newBookmark = {
      id: Math.random().toString(36).substring(7),
      name: name || `Section ${paragraphIndex + 1}`,
      paragraphIndex,
      timestamp: Date.now()
    };
    const newBookmarks = { 
      ...bookmarks, 
      [bookId]: [...(bookmarks[bookId] || []), newBookmark] 
    };
    setBookmarks(newBookmarks);
    localStorage.setItem('sanctuary_bookmarks', JSON.stringify(newBookmarks));
  };

  const removeBookmark = (bookId: string, bookmarkId: string) => {
    const newBookmarks = {
      ...bookmarks,
      [bookId]: (bookmarks[bookId] || []).filter(b => b.id !== bookmarkId)
    };
    setBookmarks(newBookmarks);
    localStorage.setItem('sanctuary_bookmarks', JSON.stringify(newBookmarks));
  };

  const updateProgress = (bookId: string, percentage: number) => {
    const newData = { ...progressData, [bookId]: percentage };
    setProgressData(newData);
    localStorage.setItem('sanctuary_progress', JSON.stringify(newData));
  };

  // Filter and Sort State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedFormat, setSelectedFormat] = useState<string>('All');
  const [sortBy, setSortBy] = useState<string>('newest'); // newest, oldest, title, author, rating

  // Backend Data State
  const [books, setBooks] = useState<BookType[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalBooks, setTotalBooks] = useState(0);

  const fetchBooks = async (page: number = 1) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        query: searchQuery,
        category: selectedCategory,
        format: selectedFormat,
        sortBy: sortBy,
        page: page.toString(),
        limit: "50"
      });
      const response = await fetch(`/api/books?${params}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown server error' }));
        console.warn('API Error:', errorData);
        setBooks([]); // Fallback to empty
        return;
      }

      const data = await response.json();
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        setBooks(data.books || []);
        setTotalPages(data.totalPages || 1);
        setTotalBooks(data.total || 0);
        setCurrentPage(data.page || 1);
      } else {
        setBooks(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Only fetch if we are on screens that need book data
    if (currentScreen === 'home' || currentScreen === 'library' || currentScreen === 'search') {
      fetchBooks(1); // Reset to page 1 when filters change
    }
  }, [currentScreen, searchQuery, selectedCategory, selectedFormat, sortBy]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      fetchBooks(newPage);
      window.scrollTo(0, 0);
    }
  };

  const navigateTo = (screen: Screen, book?: BookType) => {
    if (book) setSelectedBook(book);
    setCurrentScreen(screen);
    window.scrollTo(0, 0);
  };

  const Nav = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    return (
      <nav className="fixed top-0 w-full z-50 glass border-b border-surface-container-high shadow-[0_10px_30px_rgba(0,0,0,0.04)] h-20">
        <div className="flex justify-between items-center h-full px-6 md:px-8 max-w-7xl mx-auto">
          <div 
            className="text-lg md:text-xl font-bold tracking-tight text-charcoal cursor-pointer flex-shrink-0"
            onClick={() => { navigateTo('home'); setIsMenuOpen(false); }}
          >
            The Modern Sanctuary
          </div>
          
          <div className="hidden lg:flex items-center gap-8 xl:gap-10">
            {['home', 'library', 'search', 'about'].map((screen) => (
              <button 
                key={screen}
                className={`text-sm font-semibold transition-all pb-1 border-b-2 capitalize ${currentScreen === screen ? 'text-primary border-primary' : 'text-secondary border-transparent hover:text-charcoal'}`}
                onClick={() => navigateTo(screen as Screen)}
              >
                {screen}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <button 
              className="hidden sm:block bg-primary text-white px-5 md:px-7 py-2 md:py-2.5 rounded-full font-semibold text-xs md:text-sm hover:opacity-90 active:scale-95 transition-all shadow-md"
              onClick={() => navigateTo(currentScreen === 'detail' ? 'library' : 'upload')}
            >
              {currentScreen === 'detail' ? 'Browse Collection' : 'Upload a Book'}
            </button>
            
            <button 
              className="lg:hidden p-2 text-secondary hover:text-charcoal transition-colors"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X size={24} /> : <ChevronDown size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="lg:hidden bg-white border-b border-surface-container-high overflow-hidden"
            >
              <div className="flex flex-col p-6 gap-4">
                {['home', 'library', 'search', 'about'].map((screen) => (
                  <button 
                    key={screen}
                    className={`text-left py-3 px-4 rounded-xl font-bold transition-all capitalize ${currentScreen === screen ? 'bg-primary/10 text-primary' : 'text-secondary hover:bg-surface-container'}`}
                    onClick={() => { navigateTo(screen as Screen); setIsMenuOpen(false); }}
                  >
                    {screen}
                  </button>
                ))}
                <button 
                  className="sm:hidden bg-primary text-white py-4 rounded-xl font-bold text-center mt-2 shadow-lg shadow-orange-500/10"
                  onClick={() => { navigateTo('upload'); setIsMenuOpen(false); }}
                >
                  Upload a Book
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    );
  };

  const Footer = () => (
    <footer className="w-full py-16 mt-24 bg-surface-container-low border-t border-surface-container-high">
      <div className="max-w-7xl mx-auto px-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-10">
          <div className="flex flex-col gap-3 items-center md:items-start text-center md:text-left">
            <div className="text-lg font-bold text-charcoal">The Modern Sanctuary</div>
            <p className="text-sm text-secondary">© 2026 The Modern Sanctuary. A free community platform.</p>
            <p className="text-xs text-primary font-bold">Courtesy of Di-Tech Inc</p>
          </div>
          
          <div className="flex items-center gap-6">
            <a href="https://www.instagram.com/ditechinc_?igsh=eDlvazhnZnNiZHF4" target="_blank" rel="noopener noreferrer" className="p-3 bg-white rounded-full text-secondary hover:text-primary transition-all shadow-sm hover:shadow-md">
              <Instagram size={20} />
            </a>
            <a href="https://www.linkedin.com/in/adelakin-israel-5364a0215" target="_blank" rel="noopener noreferrer" className="p-3 bg-white rounded-full text-secondary hover:text-primary transition-all shadow-sm hover:shadow-md">
              <Linkedin size={20} />
            </a>
            <a href="https://x.com/Israelbenkong" target="_blank" rel="noopener noreferrer" className="p-3 bg-white rounded-full text-secondary hover:text-primary transition-all shadow-sm hover:shadow-md">
              <Twitter size={20} />
            </a>
          </div>
          
          <div className="flex flex-wrap justify-center gap-8 text-sm font-medium text-secondary">
            <button onClick={() => navigateTo('about')} className="hover:text-charcoal hover:underline underline-offset-4 transition-colors">Terms of Use</button>
            <button onClick={() => navigateTo('about')} className="hover:text-charcoal hover:underline underline-offset-4 transition-colors">Privacy Policy</button>
            <button onClick={() => navigateTo('about')} className="hover:text-charcoal hover:underline underline-offset-4 transition-colors">Contact</button>
            <button onClick={() => navigateTo('about')} className="hover:text-charcoal hover:underline underline-offset-4 transition-colors">Authors</button>
          </div>

          <div className="flex gap-5 text-secondary">
            <Globe size={20} className="hover:text-primary cursor-pointer transition-colors" />
            <Mail size={20} className="hover:text-primary cursor-pointer transition-colors" />
          </div>
        </div>
      </div>
    </footer>
  );

  const HomeScreen = () => (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      className="pt-32"
    >
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 md:px-8 mb-16 md:mb-24">
        <div className="grid md:grid-cols-12 gap-10 md:gap-16 items-center bg-white rounded-2xl p-8 md:p-16 shadow-[0_10px_40px_rgba(0,0,0,0.04)] overflow-hidden relative group">
          <div className="md:col-span-12 lg:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-left gap-6 relative z-10">
            <span className="text-primary text-xs font-bold uppercase tracking-[0.2em]">Community Choice</span>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-charcoal tracking-tight leading-tight md:leading-[1.1]">The Sacred Rhythm: Walking with Christ</h1>
            <p className="text-base md:text-lg text-secondary leading-relaxed max-w-lg">A profound exploration of finding sacred rhythm in an age of constant noise. Discover the transformative power of walking with Christ through prayer and contemplation, shared freely by our community.</p>
            
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 md:gap-5 text-sm">
              <span className="text-charcoal font-bold">By Jonathan P. Silas</span>
              <div className="hidden sm:block h-4 w-[1px] bg-surface-container-high" />
              <span className="text-secondary italic">Christian Living</span>
            </div>

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-4">
              <button 
                className="bg-primary text-white px-8 md:px-10 py-3.5 md:py-4 rounded-full font-bold text-sm md:text-base shadow-lg hover:shadow-orange-200/50 transition-all active:scale-95"
                onClick={() => navigateTo('detail', BOOKS[0])}
              >
                Read Now
              </button>
              <button className="bg-surface-container-high text-charcoal px-8 md:px-10 py-3.5 md:py-4 rounded-full font-bold text-sm md:text-base hover:bg-surface-container-highest transition-all active:scale-95">
                Download Free
              </button>
            </div>
          </div>
          
          <div className="md:col-span-12 lg:col-span-5 relative flex justify-center lg:justify-end mt-4 md:mt-0">
            <div className="w-64 md:w-80 h-[380px] md:h-[480px] bg-white rounded-xl shadow-2xl overflow-hidden animate-float">
              <img 
                src="/public/Sacred+Rhythms.png" 
                alt="The Sacred Rhythm: Walking with Christ" 
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute -z-10 w-48 md:w-64 h-48 md:h-64 bg-primary/10 rounded-full blur-[80px] md:blur-[100px] bottom-0 left-1/4 lg:left-0" />
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="max-w-7xl mx-auto px-8 mb-16 flex flex-wrap gap-3">
        <button className="bg-primary text-white px-6 py-2.5 rounded-full text-sm font-bold shadow-sm">All Genres</button>
        {CATEGORIES.slice(0, 5).map(cat => (
          <button key={cat} className="bg-surface-container text-secondary hover:bg-surface-container-high hover:text-charcoal px-6 py-2.5 rounded-full text-sm font-bold transition-all">{cat}</button>
        ))}
      </section>

      {/* Grid Section */}
      <section className="max-w-7xl mx-auto px-8 mb-24">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="text-3xl font-bold text-charcoal tracking-tight">Newly Uploaded</h2>
            <p className="text-secondary mt-1">The latest spiritual texts shared by our community.</p>
          </div>
          <button 
            className="text-primary font-bold flex items-center gap-1.5 hover:underline decoration-2 underline-offset-4"
            onClick={() => navigateTo('library')}
          >
            Browse All <ArrowRight size={18} />
          </button>
        </div>
        
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-8">
          {isLoading ? (
            <ListSkeleton count={5} />
          ) : (
            books.slice(0, 5).map(book => (
              <BookCard key={book.id} book={book} progress={progressData[book.id]} onClick={() => navigateTo('detail', book)} />
            ))
          )}
        </div>
      </section>

      {/* Bento Trending */}
      <section className="max-w-7xl mx-auto px-8 mb-24">
        <h2 className="text-3xl font-bold text-charcoal tracking-tight mb-8">Trending Now</h2>
        <div className="grid md:grid-cols-12 gap-8">
          <div className="md:col-span-8 bg-charcoal rounded-3xl overflow-hidden relative group h-[480px]">
            <img 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBki7AH9dZFWpDyJYzhA1bi2BJ92Fsncgy-zLAgTuYBTBfgqssIcM8_0ix90DrxQbjsqG3_fUuC5D4dIn3sb8orjKM0rCu7qjT12QmFmi0DtKRoED5d-Y3XHpsrjzYYL1PFBGUV_JDxE6zDA-hGHfDlzrlIvY8pwfH2s5h-y28LAJqF1tJSBK9D7tb8pLVzOoqqMMcFTL2Vlk4PJYvWwicPiji_-BCF3jKHLB-lM-gqHuPLpuNML0XbCuKp2mKFKyVBd_W9Sy7o8YDK" 
              className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-1000"
              alt="Feature library"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />
            <div className="absolute bottom-0 p-12 text-white">
              <div className="mb-4 inline-block bg-primary px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest">Open Collection</div>
              <h3 className="text-4xl font-bold mb-4">The Desert Fathers</h3>
              <p className="text-white/80 max-w-md leading-relaxed">Access the timeless wisdom of the early mystics in this free 12-volume digital restoration project.</p>
              <button 
                className="mt-8 border-2 border-white/40 hover:bg-white/10 px-8 py-3 rounded-full text-base font-bold transition-all active:scale-95"
                onClick={() => navigateTo('library')}
              >
                Read Now
              </button>
            </div>
          </div>
          
          <div className="md:col-span-4 bg-primary rounded-3xl p-10 flex flex-col justify-between text-white relative overflow-hidden shadow-xl shadow-orange-500/20">
            <div className="relative z-10">
              <h3 className="text-3xl font-bold mb-6 leading-tight">A Library Built by the People</h3>
              <p className="text-white/80 leading-relaxed">Every book in this sanctuary is uploaded by readers like you. No fees, no paywalls—just shared wisdom for the journey.</p>
            </div>
            
            <div className="relative z-10 mt-12">
              <div className="flex items-center gap-4 mb-6">
                <div className="flex -space-x-3">
                  {[0,1,2].map(i => (
                    <div key={i} className={`w-11 h-11 rounded-full border-2 border-primary bg-surface-container-high`} />
                  ))}
                </div>
                <span className="text-sm font-black whitespace-nowrap">12k+ Contributors</span>
              </div>
              <button className="w-full bg-white text-primary py-4 rounded-full font-black text-base hover:bg-surface active:scale-95 transition-all shadow-lg">
                Start Uploading
              </button>
            </div>
            {/* Abstract element */}
            <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-6 md:px-8 mb-24">
        <div className="bg-surface-container rounded-[2.5rem] md:rounded-[40px] p-10 md:p-20 text-center flex flex-col items-center gap-6 md:gap-8 border border-surface-container-high shadow-sm">
          <div className="w-16 h-16 md:w-20 md:h-20 bg-primary/10 rounded-[1.5rem] md:rounded-3xl flex items-center justify-center text-primary mb-2">
            <Upload size={32} className="md:size-[40px]" />
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-charcoal tracking-tighter">Contribute to the Sanctuary</h2>
          <p className="text-sm md:text-lg text-secondary max-w-xl leading-relaxed opacity-80">Help grow our collective wisdom. Upload spiritual books, historical texts, or your own reflections to share them freely with the world.</p>
          <button 
            className="bg-primary text-white px-10 py-4 md:px-16 md:py-5 rounded-full font-black uppercase tracking-widest text-xs md:text-lg shadow-xl shadow-orange-500/20 hover:-translate-y-1 active:scale-95 transition-all mt-4"
            onClick={() => navigateTo('upload')}
          >
            Upload Now
          </button>
          <p className="text-[10px] md:text-xs text-secondary mt-2 md:mt-4 opacity-40 max-w-xs md:max-w-none">By uploading, you confirm that the content is free to distribute or that you own the rights.</p>
        </div>
      </section>
    </motion.div>
  );

  const LibraryScreen = () => {
    // Process books: Filter first, then Sort
    const processedBooks = React.useMemo(() => {
      let filtered = BOOKS;

      if (searchQuery) {
        const fuse = new Fuse(BOOKS, {
          keys: [
            { name: 'title', weight: 1.0 },
            { name: 'author', weight: 0.7 },
            { name: 'category', weight: 0.4 },
            { name: 'description', weight: 0.3 }
          ],
          threshold: 0.3,
          includeScore: true,
          useExtendedSearch: true,
          distance: 100,
          location: 0,
          minMatchCharLength: 2
        });
        filtered = fuse.search(searchQuery).map(result => result.item);
      }

      return filtered.filter(book => {
        const matchesCategory = selectedCategory === 'All' || book.category === selectedCategory;
        const matchesFormat = selectedFormat === 'All' || book.format?.includes(selectedFormat);
        return matchesCategory && matchesFormat;
      }).sort((a, b) => {
        switch (sortBy) {
          case 'title': return a.title.localeCompare(b.title);
          case 'author': return a.author.localeCompare(b.author);
          case 'rating': return (b.rating || 0) - (a.rating || 0);
          case 'oldest': return new Date(a.dateAdded).getTime() - new Date(b.dateAdded).getTime();
          case 'newest':
          default: return new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime();
        }
      });
    }, [searchQuery, selectedCategory, selectedFormat, sortBy]);

    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-32">
        <div className="max-w-7xl mx-auto px-8">
          <header className="mb-12 text-center md:text-left">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-6xl font-black text-charcoal tracking-tighter mb-4"
            >
              The <span className="text-primary italic">Library</span>.
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-base md:text-lg text-secondary max-w-2xl leading-relaxed mx-auto md:mx-0"
            >
              A community-driven sanctuary of free wisdom. Explore, download, and share timeless works of theology, philosophy, and mysticism.
            </motion.p>
          </header>

          {/* Enhanced Filtering Header */}
          <div className="bg-white rounded-[2.5rem] p-6 md:p-10 mb-12 shadow-sm border border-surface-container-high">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
              {/* Search */}
              <div className="lg:col-span-1">
                <label className="text-[10px] font-black text-secondary/40 uppercase tracking-widest mb-3 block text-left md:text-left">Search Catalog</label>
                <div className="relative">
                  <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary" size={18} />
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Title or author..." 
                    className="w-full pl-11 pr-4 py-3 bg-surface-container-low border border-surface-container-high rounded-xl focus:ring-2 focus:ring-primary focus:bg-white transition-all text-sm outline-none"
                  />
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="text-[10px] font-black text-secondary/40 uppercase tracking-widest mb-3 block text-left">Category</label>
                <div className="relative">
                  <Layers className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary" size={18} />
                  <select 
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full pl-11 pr-10 py-3 bg-surface-container-low border border-surface-container-high rounded-xl focus:ring-2 focus:ring-primary focus:bg-white appearance-none transition-all text-sm outline-none cursor-pointer"
                  >
                    <option value="All">All Categories</option>
                    {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                  <ChevronsUpDown className="absolute right-4 top-1/2 -translate-y-1/2 text-secondary/30 pointer-events-none" size={14} />
                </div>
              </div>

              {/* Format */}
              <div>
                <label className="text-[10px] font-black text-secondary/40 uppercase tracking-widest mb-2 block text-left">Format</label>
                <div className="relative">
                  <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary" size={18} />
                  <select 
                    value={selectedFormat}
                    onChange={(e) => setSelectedFormat(e.target.value)}
                    className="w-full pl-11 pr-10 py-3 bg-surface-container-low border border-surface-container-high rounded-xl focus:ring-2 focus:ring-primary focus:bg-white appearance-none transition-all text-sm outline-none cursor-pointer"
                  >
                    <option value="All">All Formats</option>
                    {FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <ChevronsUpDown className="absolute right-4 top-1/2 -translate-y-1/2 text-secondary/30 pointer-events-none" size={14} />
                </div>
              </div>

              {/* Sort By */}
              <div>
                <label className="text-[10px] font-black text-secondary/40 uppercase tracking-widest mb-2 block text-left">Sort By</label>
                <div className="relative">
                  <SortAsc className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary" size={18} />
                  <select 
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full pl-11 pr-10 py-3 bg-surface-container-low border border-surface-container-high rounded-xl focus:ring-2 focus:ring-primary focus:bg-white appearance-none transition-all text-sm outline-none cursor-pointer font-bold"
                  >
                    <option value="newest">Newest Upload</option>
                    <option value="oldest">Oldest First</option>
                    <option value="title">Title (A-Z)</option>
                    <option value="author">Author (A-Z)</option>
                    <option value="rating">Top Rated</option>
                  </select>
                  <ChevronsUpDown className="absolute right-4 top-1/2 -translate-y-1/2 text-secondary/30 pointer-events-none" size={14} />
                </div>
              </div>
            </div>

            {/* Active Filters / Results Count */}
            {(selectedCategory !== 'All' || selectedFormat !== 'All' || searchQuery) && (
              <div className="mt-6 pt-6 border-t border-surface-container-high flex flex-wrap items-center gap-2">
                <span className="text-xs text-secondary mr-2">
                  {isLoading ? (
                    <span className="flex items-center gap-2 opacity-50 italic">
                      <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                      Refining collection...
                    </span>
                  ) : (
                    <>Filtered results: <span className="font-bold text-charcoal">{totalBooks}</span></>
                  )}
                </span>
                {selectedCategory !== 'All' && (
                  <button 
                    onClick={() => setSelectedCategory('All')}
                    className="px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-black uppercase flex items-center gap-1 hover:bg-primary/20 transition-all"
                  >
                    Category: {selectedCategory} <span>×</span>
                  </button>
                )}
                {selectedFormat !== 'All' && (
                  <button 
                    onClick={() => setSelectedFormat('All')}
                    className="px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-black uppercase flex items-center gap-1 hover:bg-primary/20 transition-all"
                  >
                    Format: {selectedFormat} <span>×</span>
                  </button>
                )}
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-black uppercase flex items-center gap-1 hover:bg-primary/20 transition-all"
                  >
                    Search: "{searchQuery}" <span>×</span>
                  </button>
                )}
                <button 
                  onClick={() => {
                    setSelectedCategory('All');
                    setSelectedFormat('All');
                    setSearchQuery('');
                  }}
                  className="text-secondary text-xs hover:text-primary transition-colors ml-auto font-bold"
                >
                  Clear All
                </button>
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="py-24 w-full">
              <ListSkeleton count={4} />
            </div>
          ) : books.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-10 gap-y-16">
                {books.map(book => (
                  <BookCard key={book.id} book={book} showOverlay progress={progressData[book.id]} onClick={() => navigateTo('detail', book)} />
                ))}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="mt-20 flex justify-center items-center gap-4">
                  <button 
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="p-3 rounded-full border border-surface-container-high hover:bg-surface-container transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ArrowRight className="rotate-180" size={20} />
                  </button>
                  
                  <div className="flex items-center gap-2">
                    {Array.from({ length: totalPages }).map((_, i) => {
                      const p = i + 1;
                      // Only show first, last, and around current page
                      if (p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1)) {
                        return (
                          <button
                            key={p}
                            onClick={() => handlePageChange(p)}
                            className={`w-10 h-10 rounded-full font-bold transition-all ${currentPage === p ? 'bg-primary text-white shadow-lg shadow-orange-500/20' : 'hover:bg-surface-container text-secondary'}`}
                          >
                            {p}
                          </button>
                        );
                      } else if (p === currentPage - 2 || p === currentPage + 2) {
                        return <span key={p} className="text-secondary opacity-30 px-1">...</span>;
                      }
                      return null;
                    })}
                  </div>

                  <button 
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="p-3 rounded-full border border-surface-container-high hover:bg-surface-container transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ArrowRight size={20} />
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="py-32 text-center flex flex-col items-center gap-4">
              <div className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center text-secondary mb-4 opacity-40">
                <Filter size={32} />
              </div>
              <h3 className="text-2xl font-bold text-charcoal">No matches found</h3>
              <p className="text-secondary">Try adjusting your filters or search terms to find what you're looking for.</p>
              <button 
                onClick={() => {
                  setSelectedCategory('All');
                  setSelectedFormat('All');
                  setSearchQuery('');
                }}
                className="mt-6 px-10 py-3 bg-primary text-white rounded-full font-bold shadow-lg shadow-orange-500/20 active:scale-95 transition-all"
              >
                Reset All Filters
              </button>
            </div>
          )}

          <section className="mt-32 grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 bg-orange-50 rounded-[2.5rem] p-8 md:p-16 flex flex-col items-center md:items-start text-center md:text-left justify-center border border-orange-100 shadow-sm">
            <QuoteIcon className="text-primary opacity-20 mb-8 md:mb-10 md:size-[48px]" size={40} />
            <blockquote className="text-2xl md:text-3xl font-black md:font-bold text-charcoal tracking-tighter md:tracking-tight leading-tight mb-8">
              "True silence is the rest of the mind, and is to the spirit what sleep is to the body, nourishment and refreshment."
            </blockquote>
            <cite className="text-[10px] md:text-xs font-black text-primary uppercase tracking-[0.2em] not-italic">— William Penn</cite>
          </div>
          
          <div className="lg:col-span-4 bg-white rounded-3xl p-10 border border-surface-container-high shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary mb-8">
              <TrendingUp size={24} />
            </div>
            <h4 className="text-2xl font-bold mb-8">Recently Uploaded</h4>
            <div className="space-y-6">
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2].map(i => (
                    <div key={i} className="flex gap-4 animate-pulse">
                      <div className="w-12 h-16 bg-surface-container rounded-lg" />
                      <div className="flex-1 space-y-2 py-1">
                        <div className="h-4 bg-surface-container rounded w-3/4" />
                        <div className="h-3 bg-surface-container rounded w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : books.slice(0, 2).map((book, i) => (
                <div key={book.id + i} className="flex items-center gap-4 group cursor-pointer" onClick={() => navigateTo('detail', book)}>
                  <div className="w-12 h-16 bg-surface-container-low rounded-lg overflow-hidden shadow-sm flex-shrink-0">
                    <img src={book.cover} className="w-full h-full object-cover" alt="recent" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-charcoal group-hover:text-primary transition-colors">{book.title}</p>
                    <p className="text-xs text-secondary mt-1">Recently Added</p>
                  </div>
                </div>
              ))}
            </div>
            <button className="mt-10 text-primary font-bold hover:underline decoration-2 underline-offset-4 text-sm flex items-center gap-2">
              Browse Feed <ChevronRight size={16} />
            </button>
          </div>
        </section>
      </div>
    </motion.div>
    );
  };

  const SearchScreen = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-32">
      <div className="max-w-7xl mx-auto px-8">
        <section className="flex flex-col items-center text-center mb-24">
          <h1 className="text-5xl font-bold text-charcoal tracking-tight mb-6">Find Your Next Moment of Peace</h1>
          <p className="text-lg text-secondary max-w-2xl mb-12">Explore our curated collection of ancient wisdom and modern thought, organized for the discerning seeker.</p>
          
          <div className="w-full max-w-3xl relative mb-12 group">
            <SearchIcon className="absolute left-8 top-1/2 -translate-y-1/2 text-secondary group-focus-within:text-primary transition-colors" size={24} />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, author, or theme..." 
              className="w-full pl-20 pr-8 py-6 rounded-full border-none bg-white shadow-[0_20px_50px_rgba(0,0,0,0.06)] focus:ring-2 focus:ring-primary transition-all text-xl outline-none"
            />
          </div>
          
          <div className="flex flex-wrap justify-center gap-3">
            {['Inspiration', 'Study', 'Meditation', 'Philosophy', 'Silence'].map((tag, i) => (
              <span 
                key={tag} 
                onClick={() => setSearchQuery(tag)}
                className={`px-6 py-2.5 rounded-full text-xs font-bold cursor-pointer transition-all ${searchQuery === tag ? 'bg-primary text-white' : 'bg-surface-container text-secondary hover:bg-surface-container-high'}`}
              >
                #{tag}
              </span>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-3">
            <h3 className="text-xl font-bold mb-8 text-charcoal">Popular Searches</h3>
            <ul className="space-y-6">
              {['The Way of Silence', 'Modern Stoicism', 'Ancient Prayers', 'Digital Minimalism'].map(search => (
                <li 
                  key={search} 
                  onClick={() => setSearchQuery(search)}
                  className="flex items-center gap-3 text-secondary hover:text-primary cursor-pointer transition-all group font-medium"
                >
                  <TrendingUp size={18} className="opacity-40 group-hover:opacity-100" />
                  <span className="text-sm">{search}</span>
                </li>
              ))}
            </ul>
            
            <div className="mt-16 p-10 rounded-3xl bg-surface-container-high relative overflow-hidden border border-surface-container-highest">
              <h4 className="text-2xl font-bold text-charcoal relative z-10 leading-tight">Upload Your Favorites</h4>
              <p className="text-sm text-secondary mt-3 relative z-10 mb-8">Contribute to the world's largest open library of wisdom.</p>
              <button 
                className="w-full py-4 bg-primary text-white rounded-2xl font-bold text-sm hover:opacity-90 transition-all relative z-10 flex items-center justify-center gap-2 shadow-lg shadow-orange-500/10 active:scale-95"
                onClick={() => navigateTo('upload')}
              >
                <Upload size={18} />
                Upload Now
              </button>
              <div className="absolute -bottom-16 -right-16 w-48 h-48 bg-primary/10 rounded-full blur-[80px]" />
            </div>
          </div>
          
          <div className="lg:col-span-9">
            <div className="flex justify-between items-end mb-8">
              <h2 className="text-2xl font-bold text-charcoal">Discover Treasures</h2>
              <span className="text-xs font-black uppercase text-secondary/40 tracking-widest">
                {isLoading ? 'Searching...' : `${totalBooks} results found`}
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10">
              {isLoading ? (
                <SearchSkeleton count={6} />
              ) : books.length > 0 ? (
                books.map(book => (
                  <div key={book.id + 'search'} className="group cursor-pointer" onClick={() => navigateTo('detail', book)}>
                    <div className="aspect-[3/4] rounded-2xl overflow-hidden mb-5 shadow-sm bg-white transition-all group-hover:shadow-xl group-hover:-translate-y-2 border border-surface-container-high relative">
                      <img src={book.cover} className="w-full h-full object-cover" alt="grid item" />
                      {progressData[book.id] > 0 && (
                        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/20 backdrop-blur-md">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${progressData[book.id]}%` }}
                            className="h-full bg-primary"
                          />
                        </div>
                      )}
                    </div>
                    <h4 className="text-lg font-bold text-charcoal group-hover:text-primary transition-colors">{book.title}</h4>
                    <div className="flex justify-between items-center mt-1">
                      <p className="text-sm text-secondary font-medium">{book.author} • {book.category.split(' ')[0]}</p>
                      <span className="text-primary font-black text-xs flex items-center gap-1 uppercase tracking-widest">
                        <Download size={14} /> Free
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full py-20 text-center text-secondary">No books found matching your search.</div>
              )}
            </div>
          </div>
        </section>
      </div>
    </motion.div>
  );

  const DetailScreen = () => {
    const book = selectedBook || BOOKS[10];
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-32 pb-24">
        <div className="max-w-7xl mx-auto px-8">
          <section className="grid grid-cols-1 md:grid-cols-12 gap-20 mb-24">
            <div className="md:col-span-5 lg:col-span-4">
              <div className="sticky top-32">
                <motion.div 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="w-full aspect-[2/3] relative rounded-2xl shadow-[0_30px_60px_rgba(0,0,0,0.12)] overflow-hidden border border-white/20"
                >
                  <img src={book.cover} alt={book.title} className="w-full h-full object-cover" />
                </motion.div>
                <div className="mt-10 flex flex-col gap-5">
                  <button 
                    onClick={() => setIsReadingMode(true)}
                    className="w-full bg-charcoal text-white font-bold py-5 rounded-2xl shadow-xl hover:bg-black transition-all active:scale-95 flex items-center justify-center gap-3 text-lg"
                  >
                    <Maximize2 size={22} />
                    Enter Reading Mode
                  </button>
                  <button className="w-full bg-primary text-white font-bold py-5 rounded-2xl shadow-xl shadow-orange-500/20 hover:shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-3 text-lg">
                    <Download size={22} strokeWidth={2.5} />
                    Download Now (Free)
                  </button>
                  <div className="flex items-center justify-center gap-2 text-xs font-black text-secondary/40 uppercase tracking-[0.25em] py-2">
                    <PublicIcon size={16} />
                    <span>Community Contribution</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="md:col-span-7 lg:col-span-8 flex flex-col gap-10">
              <AnimatePresence>
                {isReadingMode && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="fixed inset-0 z-50 overflow-y-auto"
                    style={{
                      backgroundColor: 
                        readingSettings.theme === 'sepia' ? '#f4ecd8' : 
                        readingSettings.theme === 'dark' ? '#1a1a1a' : '#ffffff'
                    }}
                  >
                    <div className="sticky top-0 z-10 w-full border-b backdrop-blur-md bg-white/50 dark:bg-black/50 flex flex-col md:flex-row items-center justify-between px-6 md:px-8 py-4 gap-4 md:gap-0 border-black/5">
                      <div className="flex items-center justify-between w-full md:w-auto gap-4">
                        <button 
                          onClick={() => setIsReadingMode(false)}
                          className="p-3 hover:bg-black/5 rounded-full transition-colors"
                          style={{ color: readingSettings.theme === 'dark' ? 'white' : 'inherit' }}
                        >
                          <X size={24} />
                        </button>
                        <h2 className="font-bold whitespace-nowrap overflow-hidden text-ellipsis" style={{ color: readingSettings.theme === 'dark' ? 'white' : 'inherit' }}>
                          {book.title}
                        </h2>
                      </div>

                      <div className="flex items-center gap-2 md:gap-4 flex-wrap justify-center">
                        {/* Reading Preferences Popover */}
                        <div className="relative group">
                          <button className="flex items-center gap-2 p-2.5 md:px-4 md:py-2.5 bg-black/5 hover:bg-black/10 rounded-2xl transition-all" style={{ color: readingSettings.theme === 'dark' ? 'white' : 'inherit' }}>
                            <Settings2 size={18} />
                            <span className="hidden md:inline text-xs font-black uppercase tracking-wider">Appearance</span>
                          </button>

                          {/* Dropdown Panel */}
                          <div className="absolute right-0 top-full mt-2 w-72 md:w-80 bg-white dark:bg-[#222] rounded-3xl shadow-2xl border border-black/5 p-6 opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto transition-all origin-top-right z-50">
                            <div className="space-y-6">
                              {/* Font Size Control */}
                              <div>
                                <div className="flex items-center justify-between mb-3">
                                  <span className="text-[10px] font-black text-secondary/40 uppercase tracking-widest">Text Size</span>
                                  <span className="text-xs font-bold" style={{ color: readingSettings.theme === 'dark' ? 'white' : 'inherit' }}>{readingSettings.fontSize}px</span>
                                </div>
                                <div className="flex items-center gap-4">
                                  <button 
                                    onClick={() => setReadingSettings(s => ({ ...s, fontSize: Math.max(12, s.fontSize - 2) }))}
                                    className="w-10 h-10 flex items-center justify-center bg-black/5 hover:bg-black/10 rounded-xl transition-all"
                                    style={{ color: readingSettings.theme === 'dark' ? 'white' : 'inherit' }}
                                  >
                                    <Type size={14} />
                                  </button>
                                  <input 
                                    type="range" 
                                    min="12" 
                                    max="32" 
                                    step="2"
                                    value={readingSettings.fontSize}
                                    onChange={(e) => setReadingSettings(s => ({ ...s, fontSize: parseInt(e.target.value) }))}
                                    className="flex-1 accent-primary h-1.5 bg-black/5 rounded-full appearance-none cursor-pointer"
                                  />
                                  <button 
                                    onClick={() => setReadingSettings(s => ({ ...s, fontSize: Math.min(32, s.fontSize + 2) }))}
                                    className="w-10 h-10 flex items-center justify-center bg-black/5 hover:bg-black/10 rounded-xl transition-all"
                                    style={{ color: readingSettings.theme === 'dark' ? 'white' : 'inherit' }}
                                  >
                                    <Type size={20} />
                                  </button>
                                </div>
                              </div>

                              {/* Line Height Control */}
                              <div>
                                <div className="flex items-center justify-between mb-3">
                                  <span className="text-[10px] font-black text-secondary/40 uppercase tracking-widest">Line Spacing</span>
                                  <span className="text-xs font-bold" style={{ color: readingSettings.theme === 'dark' ? 'white' : 'inherit' }}>{readingSettings.lineHeight}x</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                  {[1.2, 1.6, 2.0].map(sp => (
                                    <button 
                                      key={sp}
                                      onClick={() => setReadingSettings(s => ({ ...s, lineHeight: sp }))}
                                      className={`py-2 rounded-xl text-xs font-bold transition-all border-2 ${readingSettings.lineHeight === sp ? 'border-primary bg-primary/5 text-primary' : 'border-transparent bg-black/5 hover:bg-black/10'}`}
                                      style={{ color: readingSettings.lineHeight === sp ? 'rgb(249, 115, 22)' : readingSettings.theme === 'dark' ? 'white' : 'inherit' }}
                                    >
                                      {sp === 1.2 ? 'Tight' : sp === 1.6 ? 'Normal' : 'Loose'}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* Theme Selection */}
                              <div>
                                <span className="text-[10px] font-black text-secondary/40 uppercase tracking-widest block mb-3">Theme</span>
                                <div className="flex items-center justify-between gap-3">
                                  {['light', 'sepia', 'dark'].map(t => (
                                    <button 
                                      key={t}
                                      onClick={() => setReadingSettings(s => ({ ...s, theme: t }))}
                                      className={`flex-1 h-12 rounded-2xl transition-all border-2 flex items-center justify-center text-[10px] font-black uppercase tracking-wider ${readingSettings.theme === t ? 'border-primary shadow-lg shadow-primary/10' : 'border-black/5'}`}
                                      style={{
                                        backgroundColor: t === 'sepia' ? '#f4ecd8' : t === 'dark' ? '#1a1a1a' : '#ffffff',
                                        color: t === 'dark' ? 'white' : 'black'
                                      }}
                                    >
                                      {t}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Progress Tracker */}
                        <div className="hidden sm:flex items-center gap-2 bg-black/5 px-3 py-2 rounded-2xl">
                          <div className="w-16 md:w-24 h-1.5 bg-black/10 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${progressData[book.id] || 0}%` }}
                              className="h-full bg-primary"
                            />
                          </div>
                          <span className="text-[10px] font-black w-8 text-center" style={{ color: readingSettings.theme === 'dark' ? 'white' : 'inherit' }}>
                            {Math.round(progressData[book.id] || 0)}%
                          </span>
                        </div>

                        {/* Bookmarks Toggle (Mobile/Tablet helper) */}
                        <div className="relative group">
                          <button className="flex items-center gap-2 p-2.5 md:px-4 md:py-2.5 bg-black/5 hover:bg-black/10 rounded-2xl transition-all" style={{ color: readingSettings.theme === 'dark' ? 'white' : 'inherit' }}>
                            <Bookmark size={18} className={bookmarks[book.id]?.length ? 'text-primary fill-primary' : ''} />
                            <span className="text-[10px] font-black">{bookmarks[book.id]?.length || 0}</span>
                          </button>
                          
                          {/* Bookmarks Dropdown */}
                          <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-[#2a2a2a] rounded-2xl shadow-2xl border border-black/5 p-4 opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto transition-all origin-top-right z-50">
                            <h3 className="text-xs font-black uppercase tracking-widest mb-4 flex items-center justify-between" style={{ color: readingSettings.theme === 'dark' ? 'white' : 'inherit' }}>
                              Your Bookmarks
                              <span className="text-[10px] font-normal opacity-60">Hover to delete</span>
                            </h3>
                            <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                              {bookmarks[book.id]?.length ? (
                                bookmarks[book.id].map(bm => (
                                  <div key={bm.id} className="group/item relative">
                                    <button 
                                      onClick={() => {
                                        const el = document.getElementById(`para-${bm.paragraphIndex}`);
                                        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                      }}
                                      className="w-full text-left p-3 rounded-xl bg-black/5 hover:bg-primary/10 hover:text-primary transition-all text-sm font-medium"
                                      style={{ color: readingSettings.theme === 'dark' ? '#eee' : 'inherit' }}
                                    >
                                      {bm.name}
                                    </button>
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); removeBookmark(book.id, bm.id); }}
                                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-red-500 opacity-0 group-hover/item:opacity-100 transition-opacity bg-white dark:bg-black rounded-lg shadow-sm"
                                    >
                                      <X size={14} />
                                    </button>
                                  </div>
                                ))
                              ) : (
                                <p className="text-xs text-center py-4 opacity-40" style={{ color: readingSettings.theme === 'dark' ? 'white' : 'inherit' }}>No bookmarks yet.</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="max-w-3xl mx-auto px-8 py-20 min-h-screen font-serif">
                       <header className="mb-16 text-center">
                          <h1 className="text-4xl md:text-5xl font-bold mb-4" style={{ color: readingSettings.theme === 'dark' ? '#f0f0f0' : '#111111' }}>{book.title}</h1>
                          <p className="text-xl font-medium opacity-60" style={{ color: readingSettings.theme === 'dark' ? '#cccccc' : '#555555' }}>
                            {book.format?.includes('DOC') ? 'Document View' : 'Chapter 1: The Gateway of Silence'}
                          </p>
                       </header>
                       <div 
                         style={{ 
                           fontSize: `${readingSettings.fontSize}px`, 
                           lineHeight: readingSettings.lineHeight,
                           color: readingSettings.theme === 'dark' ? '#aaaaaa' : '#333333'
                         }}
                         className="space-y-8"
                       >
                          {[
                            "The stillness of the morning was not an absence of sound, but an invitation to listen. In the vast landscape of the digital age, we have traded the resonance of silence for the static of convenience.",
                            "We find ourselves at a crossroads where the depth of human thought is often sacrificed for the breadth of information. But wisdom, as the ancients knew, is not discovered in the noise. It is gathered in the quiet recesses of the mind, where attention is not a commodity to be sold, but a sacred gift to be bestowed.",
                            "To read is to enter into a conversation with a voice that has been preserved across time. When we allow that voice to speak without interruption, we begin to see the world not as a series of problems to be solved, but as a mystery to be experienced.",
                            "This book is an attempt to recover that lost art of contemplation. It is a guide for the modern seeker who wishes to walk the path of digital minimalism without losing the richness of human connection."
                          ].map((text, idx, arr) => {
                            const isBookmarked = (bookmarks[book.id] || []).some(b => b.paragraphIndex === idx);
                            return (
                              <div key={idx} id={`para-${idx}`} className="relative group">
                                <p className={idx === 0 ? "first-letter:text-7xl first-letter:font-bold first-letter:mr-3 first-letter:float-left first-letter:text-primary" : ""}>
                                  {text}
                                </p>
                                <div className="absolute -left-12 top-0 bottom-0 flex flex-col items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button 
                                    onClick={() => updateProgress(book.id, ((idx + 1) / arr.length) * 100)}
                                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${((progressData[book.id] || 0) >= ((idx + 1) / arr.length) * 100 - 1) ? 'bg-green-500 border-green-500 text-white' : 'border-black/20 hover:border-primary text-transparent'}`}
                                    title="Mark as read to this point"
                                  >
                                    <CheckCircle2 size={12} />
                                  </button>
                                  <button 
                                    onClick={() => isBookmarked ? removeBookmark(book.id, bookmarks[book.id].find(b => b.paragraphIndex === idx)!.id) : addBookmark(book.id, idx)}
                                    className={`w-6 h-6 rounded-full border-2 mt-2 flex items-center justify-center transition-all ${isBookmarked ? 'bg-primary border-primary text-white' : 'border-black/20 hover:border-primary text-transparent'}`}
                                    title={isBookmarked ? "Remove bookmark" : "Add bookmark here"}
                                  >
                                    <Bookmark size={12} className={isBookmarked ? 'fill-white' : ''} />
                                  </button>
                                  <div className="w-[1px] h-full bg-black/5 mt-2" />
                                </div>
                              </div>
                            );
                          })}
                       </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex flex-col gap-4">
                <nav className="flex gap-2 text-xs font-black text-secondary/40 uppercase tracking-[0.2em] mb-2">
                  <span className="cursor-pointer hover:text-charcoal" onClick={() => navigateTo('library')}>Library</span>
                  <span>/</span>
                  <span className="text-secondary">{book.category}</span>
                </nav>
                <div>
                  <h1 className="text-5xl md:text-6xl font-bold text-charcoal tracking-tight mb-3 leading-[1.1]">{book.title}</h1>
                  <p className="text-2xl font-bold text-primary">By {book.author}</p>
                  <div className="mt-4 flex items-center gap-2 text-sm text-secondary">
                    <User size={18} />
                    <span>Uploaded by <span className="font-bold text-charcoal">{book.uploader || 'Anonymous'}</span></span>
                  </div>
                </div>
              </div>

              <div className="flex gap-12 py-8 border-y border-surface-container-high">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-black text-secondary/40 uppercase tracking-[0.2em]">Rating</span>
                  <div className="flex items-center gap-1.5 text-primary">
                    <Star size={18} fill="currentColor" />
                    <span className="font-black text-charcoal text-lg">{book.rating || 'N/A'}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-black text-secondary/40 uppercase tracking-[0.2em]">Pages</span>
                  <span className="font-black text-charcoal text-lg">{book.pages || '280'}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-black text-secondary/40 uppercase tracking-[0.2em]">Format</span>
                  <span className="font-black text-charcoal text-lg">{book.format || 'EPUB, PDF'}</span>
                </div>
              </div>

              <div className="flex flex-col gap-6">
                <h2 className="text-3xl font-bold tracking-tight">Synopsis</h2>
                <div className="text-lg text-charcoal/70 space-y-6 max-w-2xl leading-relaxed">
                  <p>In "{book.title}," the author explores the profound intersection of ancient contemplative practices and the relentless pace of the modern digital age. This work serves as both a philosophical treatise and a practical guide.</p>
                  <p>The core argument is that true wisdom is not found in the accumulation of data, but in the spaciousness of silence. Through a series of meditative essays, it guides the reader toward a state of digital minimalism that masters technology instead of rejecting it.</p>
                </div>
              </div>

              <div className="flex flex-col gap-10 mt-8">
                <div className="flex justify-between items-center">
                  <h2 className="text-3xl font-bold tracking-tight">Reader Reviews</h2>
                  <button className="text-primary font-bold hover:underline decoration-2 underline-offset-4 flex items-center gap-2 text-sm uppercase tracking-widest">
                    <Edit3 size={18} />
                    Write a Review
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-8 rounded-3xl bg-white shadow-sm border border-surface-container-high">
                    <div className="flex justify-between mb-6">
                      <span className="font-black text-[10px] text-secondary/40 uppercase tracking-widest">Anonymous Visitor</span>
                      <div className="flex text-primary">
                        {[1,2,3,4,5].map(i => <Star key={i} size={14} fill="currentColor" />)}
                      </div>
                    </div>
                    <p className="text-charcoal font-medium italic opacity-70">"A transformative read. The author has a way of making complex philosophical concepts feel like a warm conversation."</p>
                  </div>
                  <div className="p-8 rounded-3xl bg-white shadow-sm border border-surface-container-high">
                    <div className="flex justify-between mb-6">
                      <span className="font-black text-[10px] text-secondary/40 uppercase tracking-widest">David Chen</span>
                      <div className="flex text-primary">
                        {[1,2,3,4].map(i => <Star key={i} size={14} fill="currentColor" />)}
                        <Star size={14} />
                      </div>
                    </div>
                    <p className="text-charcoal font-medium italic opacity-70">"Finally, a book that addresses the 'noise' of our times with elegance and practical insight. Highly recommended."</p>
                  </div>
                </div>
                <p className="text-center text-xs text-secondary/40 italic font-medium">Anyone can share their thoughts. No account required.</p>
              </div>
            </div>
          </section>

          <section className="pt-20 border-t border-surface-container-high">
            <h2 className="text-3xl font-black mb-10 tracking-tight">Related Titles</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
              {BOOKS.slice(1, 6).map(b => (
                <div key={b.id + 'rel'} className="group cursor-pointer" onClick={() => navigateTo('detail', b)}>
                  <div className="aspect-[2/3] overflow-hidden rounded-xl shadow-md transition-all group-hover:shadow-2xl group-hover:-translate-y-2 mb-4 border border-surface-container-high">
                    <img src={b.cover} className="w-full h-full object-cover" alt="related" />
                  </div>
                  <h3 className="font-bold text-sm leading-tight text-charcoal group-hover:text-primary transition-colors">{b.title}</h3>
                  <p className="text-xs text-secondary mt-1 font-medium">{b.author}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </motion.div>
    );
  };

  const AboutScreen = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-32 pb-24">
      <div className="max-w-4xl mx-auto px-8 space-y-20">
        <section className="text-center space-y-6">
          <span className="text-primary text-xs font-bold uppercase tracking-[0.2em]">Our Mission</span>
          <h1 className="text-5xl font-bold text-charcoal tracking-tight leading-tight">Wisdom is a Common Heritage</h1>
          <p className="text-xl text-secondary leading-relaxed max-w-3xl mx-auto">
            The Modern Sanctuary was founded on the belief that spiritual and philosophical wisdom should not be gated behind paywalls or complex institution. We provide a breathing space for the soul in the digital age.
          </p>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-charcoal tracking-tight">Community Driven</h2>
            <p className="text-secondary leading-relaxed">
              Every work in this library is contributed by our members. From ancient mystical texts to modern reflections on stoicism and mindfulness, our collection grows through the collective generosity of truth-seekers worldwide.
            </p>
            <div className="pt-4 flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-primary">
                  <PublicIcon size={20} />
                </div>
                <span className="font-bold text-charcoal">Global Accessibility</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-primary">
                  <User size={20} />
                </div>
                <span className="font-bold text-charcoal">Reader Moderated</span>
              </div>
            </div>
          </div>
          <div className="bg-surface-container rounded-3xl aspect-square overflow-hidden relative shadow-lg">
            <img 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBki7AH9dZFWpDyJYzhA1bi2BJ92Fsncgy-zLAgTuYBTBfgqssIcM8_0ix90DrxQbjsqG3_fUuC5D4dIn3sb8orjKM0rCu7qjT12QmFmi0DtKRoED5d-Y3XHpsrjzYYL1PFBGUV_JDxE6zDA-hGHfDlzrlIvY8pwfH2s5h-y28LAJqF1tJSBK9D7tb8pLVzOoqqMMcFTL2Vlk4PJYvWwicPiji_-BCF3jKHLB-lM-gqHuPLpuNML0XbCuKp2mKFKyVBd_W9Sy7o8YDK" 
              className="w-full h-full object-cover opacity-80"
              alt="Sanctuary atmosphere"
            />
            <div className="absolute inset-0 bg-primary/10 mix-blend-overlay" />
          </div>
        </section>

        <section className="bg-charcoal text-white rounded-[40px] p-12 md:p-16 text-center space-y-8 shadow-2xl">
          <h2 className="text-3xl font-bold tracking-tight">How You Can Help</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
            <div className="space-y-3">
              <div className="text-primary font-black uppercase text-[10px] tracking-widest">Share</div>
              <h4 className="font-bold text-lg">Upload Works</h4>
              <p className="text-white/60 text-sm">Contribute digital versions of public domain spiritual texts or your own writings.</p>
            </div>
            <div className="space-y-3">
              <div className="text-primary font-black uppercase text-[10px] tracking-widest">Guide</div>
              <h4 className="font-bold text-lg">Write Reviews</h4>
              <p className="text-white/60 text-sm">Help others navigate the treasures by sharing your insights and experiences.</p>
            </div>
            <div className="space-y-3">
              <div className="text-primary font-black uppercase text-[10px] tracking-widest">Support</div>
              <h4 className="font-bold text-lg">Spread Peace</h4>
              <p className="text-white/60 text-sm">Share our sanctuary with friends who are seeking quiet reflection.</p>
            </div>
          </div>
          <button 
            onClick={() => navigateTo('upload')}
            className="bg-primary text-white px-12 py-4 rounded-full font-bold hover:shadow-xl hover:shadow-orange-500/20 active:scale-95 transition-all mt-6"
          >
            Start Contributing
          </button>
        </section>

        <section className="text-center pt-20 border-t border-surface-container-high space-y-10">
          <h2 className="text-4xl font-bold text-charcoal tracking-tight">Get in Touch</h2>
          <div className="flex flex-wrap justify-center gap-12">
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 bg-white shadow-md rounded-2xl flex items-center justify-center text-primary border border-surface-container-high">
                <Mail size={28} />
              </div>
              <span className="font-bold text-charcoal">contact@modernsanctuary.org</span>
              <p className="text-xs text-secondary">General Inquiries</p>
            </div>
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 bg-white shadow-md rounded-2xl flex items-center justify-center text-primary border border-surface-container-high">
                <Globe size={28} />
              </div>
              <span className="font-bold text-charcoal">@modern_sanctuary</span>
              <p className="text-xs text-secondary">Social Channels</p>
            </div>
          </div>
        </section>
      </div>
    </motion.div>
  );

  const UploadScreen = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-32 pb-24">
      <div className="max-w-7xl mx-auto px-8">
        <UploadForm 
          onSuccess={() => navigateTo('library')} 
          onCancel={() => navigateTo('home')} 
        />
      </div>
    </motion.div>
  );

  const renderScreen = () => {
    switch (currentScreen) {
      case 'home': return <HomeScreen />;
      case 'library': return <LibraryScreen />;
      case 'search': return <SearchScreen />;
      case 'detail': return <DetailScreen />;
      case 'upload': return <UploadScreen />;
      case 'about': return <AboutScreen />;
      default: return <HomeScreen />;
    }
  };

  return (
    <div className="min-h-screen">
      <Nav />
      <AnimatePresence mode="wait">
        <div key={currentScreen}>
          {renderScreen()}
        </div>
      </AnimatePresence>
      <Footer />
    </div>
  );
}
