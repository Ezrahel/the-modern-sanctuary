import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Eye, 
  Download, 
  Clock, 
  Activity,
  Monitor,
  Laptop,
  Smartphone,
  Tablet as TabletIcon,
  RefreshCw,
  FileSpreadsheet,
  BookOpen,
  ChevronRight
} from 'lucide-react';
import { buildApiUrl } from '../../api';

interface AnalyticsData {
  summary: {
    activeUsers: number;
    visitorsToday: number;
    visitorsGrowth: number;
    pageviewsToday: number;
    pageviewsGrowth: number;
    downloadsToday: number;
    downloadsGrowth: number;
    totalUniqueVisitors: number;
    totalPageviews: number;
    totalDownloads: number;
    totalBooks: number;
    avgSessionDuration: number;
    bounceRate: number;
  };
  dailyTrends: Array<{ date: string; pageviews: number; uniques: number }>;
  dailyDownloads: Array<{ date: string; count: number }>;
  topBooks: Array<{ id: string; title: string; author: string; category: string; cover?: string; downloads: number }>;
  topCategories: Array<{ category: string; views: number }>;
  technology: {
    devices: Array<{ name: string; value: number }>;
    browsers: Array<{ name: string; value: number }>;
    os: Array<{ name: string; value: number }>;
  };
  liveFeed: Array<{ timestamp: string; title: string; category: string; type: 'view' | 'download' }>;
}

export function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportingTraffic, setExportingTraffic] = useState(false);
  const [exportingBooks, setExportingBooks] = useState(false);
  const [activeTab, setActiveTab] = useState<'traffic' | 'books'>('traffic');
  
  // Custom interactive hover states for SVG charts
  const [hoveredLineIndex, setHoveredLineIndex] = useState<number | null>(null);
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);

  const fetchAnalytics = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const response = await fetch(buildApiUrl('/api/admin/analytics?mode=summary'), {
        credentials: 'include',
      });
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized access. Please log in.');
        }
        throw new Error(`Failed to fetch analytics metrics (HTTP ${response.status})`);
      }
      const json = await response.json();
      setData(json);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  // Poll for live/realtime updates every 15 seconds
  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(() => {
      fetchAnalytics(true);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleExport = async (type: 'traffic' | 'books') => {
    if (type === 'traffic') setExportingTraffic(true);
    if (type === 'books') setExportingBooks(true);

    try {
      const response = await fetch(buildApiUrl(`/api/admin/analytics?mode=export&type=${type}`), {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sanctuary_${type}_analytics_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    } finally {
      if (type === 'traffic') setExportingTraffic(false);
      if (type === 'books') setExportingBooks(false);
    }
  };

  const formatDuration = (secs: number) => {
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins}m ${remainingSecs}s`;
  };

  const formatTimeAgo = (isoString: string) => {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    if (diffSecs < 10) return 'Just now';
    if (diffSecs < 60) return `${diffSecs}s ago`;
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return `${diffMins}m ago`;
    return new Date(isoString).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="space-y-8 animate-pulse">
        {/* Header Skeleton */}
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <div className="h-8 w-64 bg-zinc-800 rounded"></div>
            <div className="h-4 w-96 bg-zinc-800 rounded"></div>
          </div>
          <div className="h-10 w-40 bg-zinc-800 rounded"></div>
        </div>

        {/* Stats Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
              <div className="flex justify-between">
                <div className="h-4 w-24 bg-zinc-800 rounded"></div>
                <div className="h-6 w-6 bg-zinc-800 rounded-full"></div>
              </div>
              <div className="h-8 w-16 bg-zinc-800 rounded"></div>
            </div>
          ))}
        </div>

        {/* Charts Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-96 bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <div className="h-6 w-32 bg-zinc-800 rounded mb-6"></div>
              <div className="h-64 bg-zinc-800/50 rounded-xl"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-950/20 border border-red-800 rounded-2xl p-8 text-center space-y-4 my-10 max-w-xl mx-auto">
        <div className="text-red-500 font-semibold text-lg">Analytics Loading Failed</div>
        <p className="text-zinc-400 text-sm">{error}</p>
        <button 
          onClick={() => fetchAnalytics()}
          className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium rounded-xl transition duration-200"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  if (!data) return null;

  const s = data.summary;

  return (
    <div className="space-y-8 pb-10">
      {/* Header Area */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white tracking-tight">Platform Performance & Telemetry</h1>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-xs font-semibold select-none">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>{s.activeUsers} {s.activeUsers === 1 ? 'user' : 'users'} live online</span>
            </div>
          </div>
          <p className="text-sm text-zinc-400 mt-1">Real-time engagement logs and high-performance server statistics.</p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => handleExport('traffic')}
            disabled={exportingTraffic}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 disabled:opacity-50 text-zinc-300 hover:text-white text-xs font-medium rounded-xl transition duration-150"
          >
            {exportingTraffic ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5 text-zinc-400" />}
            <span>Export Traffic Report</span>
          </button>
          
          <button 
            onClick={() => handleExport('books')}
            disabled={exportingBooks}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 hover:border-amber-500/30 disabled:opacity-50 text-amber-300 hover:text-amber-200 text-xs font-medium rounded-xl transition duration-150"
          >
            {exportingBooks ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
            <span>Export Book Engagement</span>
          </button>

          <button
            onClick={() => fetchAnalytics()}
            className="p-2.5 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 rounded-xl transition duration-150"
            title="Refresh statistics"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Unique Visitors */}
        <div className="bg-zinc-950/40 border border-zinc-900 rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-amber-500/5 to-transparent rounded-full pointer-events-none"></div>
          <div className="flex justify-between items-start">
            <span className="text-xs font-medium text-zinc-400 tracking-wider uppercase">Unique Visitors</span>
            <div className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 space-y-1">
            <div className="text-3xl font-bold text-white tracking-tight">{s.visitorsToday}</div>
            <div className="flex items-center gap-1.5 text-xs">
              {s.visitorsGrowth >= 0 ? (
                <span className="text-emerald-400 flex items-center font-medium">
                  <TrendingUp className="h-3.5 w-3.5 mr-0.5" /> +{s.visitorsGrowth.toFixed(1)}%
                </span>
              ) : (
                <span className="text-rose-400 flex items-center font-medium">
                  <TrendingDown className="h-3.5 w-3.5 mr-0.5" /> {s.visitorsGrowth.toFixed(1)}%
                </span>
              )}
              <span className="text-zinc-500">vs yesterday</span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-zinc-900/50 flex justify-between text-[11px] text-zinc-500">
            <span>Cumulative:</span>
            <span className="text-zinc-300 font-semibold">{s.totalUniqueVisitors.toLocaleString()}</span>
          </div>
        </div>

        {/* Page Views */}
        <div className="bg-zinc-950/40 border border-zinc-900 rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-amber-500/5 to-transparent rounded-full pointer-events-none"></div>
          <div className="flex justify-between items-start">
            <span className="text-xs font-medium text-zinc-400 tracking-wider uppercase">Page Views</span>
            <div className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400">
              <Eye className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 space-y-1">
            <div className="text-3xl font-bold text-white tracking-tight">{s.pageviewsToday}</div>
            <div className="flex items-center gap-1.5 text-xs">
              {s.pageviewsGrowth >= 0 ? (
                <span className="text-emerald-400 flex items-center font-medium">
                  <TrendingUp className="h-3.5 w-3.5 mr-0.5" /> +{s.pageviewsGrowth.toFixed(1)}%
                </span>
              ) : (
                <span className="text-rose-400 flex items-center font-medium">
                  <TrendingDown className="h-3.5 w-3.5 mr-0.5" /> {s.pageviewsGrowth.toFixed(1)}%
                </span>
              )}
              <span className="text-zinc-500">vs yesterday</span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-zinc-900/50 flex justify-between text-[11px] text-zinc-500">
            <span>Grand Total:</span>
            <span className="text-zinc-300 font-semibold">{s.totalPageviews.toLocaleString()}</span>
          </div>
        </div>

        {/* Downloads */}
        <div className="bg-zinc-950/40 border border-zinc-900 rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-amber-500/5 to-transparent rounded-full pointer-events-none"></div>
          <div className="flex justify-between items-start">
            <span className="text-xs font-medium text-zinc-400 tracking-wider uppercase">Downloads</span>
            <div className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400">
              <Download className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 space-y-1">
            <div className="text-3xl font-bold text-white tracking-tight">{s.downloadsToday}</div>
            <div className="flex items-center gap-1.5 text-xs">
              {s.downloadsGrowth >= 0 ? (
                <span className="text-emerald-400 flex items-center font-medium">
                  <TrendingUp className="h-3.5 w-3.5 mr-0.5" /> +{s.downloadsGrowth.toFixed(1)}%
                </span>
              ) : (
                <span className="text-rose-400 flex items-center font-medium">
                  <TrendingDown className="h-3.5 w-3.5 mr-0.5" /> {s.downloadsGrowth.toFixed(1)}%
                </span>
              )}
              <span className="text-zinc-500">vs yesterday</span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-zinc-900/50 flex justify-between text-[11px] text-zinc-500">
            <span>Sanctuary Vault:</span>
            <span className="text-zinc-300 font-semibold">{s.totalDownloads.toLocaleString()}</span>
          </div>
        </div>

        {/* Session Duration & Bounce */}
        <div className="bg-zinc-950/40 border border-zinc-900 rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-amber-500/5 to-transparent rounded-full pointer-events-none"></div>
          <div className="flex justify-between items-start">
            <span className="text-xs font-medium text-zinc-400 tracking-wider uppercase">Duration & Bounce</span>
            <div className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 space-y-1">
            <div className="text-3xl font-bold text-white tracking-tight">{formatDuration(s.avgSessionDuration)}</div>
            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
              <span className="font-semibold text-zinc-300">Bounce: {s.bounceRate}%</span>
              <span>average rate</span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-zinc-900/50 flex justify-between text-[11px] text-zinc-500">
            <span>Active Library:</span>
            <span className="text-zinc-300 font-semibold">{s.totalBooks} indexed books</span>
          </div>
        </div>
      </div>

      {/* Main Trends and Interactive SVG Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Line Chart: Visitors Traffic Trends */}
        <div className="bg-zinc-950/30 border border-zinc-900 rounded-2xl p-6 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-sm font-semibold text-white">Visitor & Traffic Trends</h2>
              <p className="text-xs text-zinc-500 mt-0.5">Historical overview of uniques and views over 7 days.</p>
            </div>
            
            <div className="flex gap-4 text-[10px] text-zinc-400 font-semibold">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500"></span>Pageviews</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-zinc-600"></span>Unique Visitors</span>
            </div>
          </div>

          {/* Interactive SVG Rendering */}
          <div className="relative pt-6 h-64 select-none">
            {data.dailyTrends.length === 0 ? (
              <div className="flex h-full items-center justify-center text-zinc-600 text-xs">Insufficient time-series data yet.</div>
            ) : (
              (() => {
                const width = 500;
                const height = 200;
                const padding = 25;
                const chartW = width - padding * 2;
                const chartH = height - padding * 2;
                
                const maxVal = Math.max(...data.dailyTrends.map(t => Math.max(t.pageviews, t.uniques, 5)));
                
                const pointsPageviews = data.dailyTrends.map((t, idx) => {
                  const x = padding + (idx / (data.dailyTrends.length - 1 || 1)) * chartW;
                  const y = padding + chartH - (t.pageviews / maxVal) * chartH;
                  return { x, y, data: t };
                });

                const pointsUniques = data.dailyTrends.map((t, idx) => {
                  const x = padding + (idx / (data.dailyTrends.length - 1 || 1)) * chartW;
                  const y = padding + chartH - (t.uniques / maxVal) * chartH;
                  return { x, y, data: t };
                });

                const pageviewsPath = pointsPageviews.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                const uniquesPath = pointsUniques.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                
                // Curved Pageviews Path helper
                const pageviewsCurvedPath = pointsPageviews.reduce((acc, p, i, arr) => {
                  if (i === 0) return `M ${p.x} ${p.y}`;
                  const prev = arr[i - 1];
                  const cpX1 = prev.x + (p.x - prev.x) / 2;
                  const cpY1 = prev.y;
                  const cpX2 = prev.x + (p.x - prev.x) / 2;
                  const cpY2 = p.y;
                  return `${acc} C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p.x} ${p.y}`;
                }, '');

                const pageviewsGradientPath = `${pageviewsCurvedPath} L ${pointsPageviews[pointsPageviews.length-1].x} ${height - padding} L ${pointsPageviews[0].x} ${height - padding} Z`;

                return (
                  <>
                    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
                      <defs>
                        <linearGradient id="chartGlow" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Grid Lines */}
                      {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                        const y = padding + ratio * chartH;
                        return (
                          <line 
                            key={i} 
                            x1={padding} 
                            y1={y} 
                            x2={width - padding} 
                            y2={y} 
                            stroke="#18181b" 
                            strokeWidth="1" 
                            strokeDasharray="4 4"
                          />
                        );
                      })}

                      {/* Pageviews Area Gradient Fill */}
                      {pointsPageviews.length > 1 && (
                        <path d={pageviewsGradientPath} fill="url(#chartGlow)" />
                      )}

                      {/* Unique Visitors (Background Line) */}
                      {pointsUniques.length > 1 && (
                        <motion.path 
                          d={uniquesPath} 
                          fill="none" 
                          stroke="#3f3f46" 
                          strokeWidth="2" 
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                          transition={{ duration: 1 }}
                        />
                      )}

                      {/* Pageviews Main Line (Curved Glow) */}
                      {pointsPageviews.length > 1 && (
                        <motion.path 
                          d={pageviewsCurvedPath} 
                          fill="none" 
                          stroke="#f59e0b" 
                          strokeWidth="3" 
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                          transition={{ duration: 1.2, ease: "easeOut" }}
                        />
                      )}

                      {/* Interactive Hover Indicators */}
                      {pointsPageviews.map((p, idx) => (
                        <g 
                          key={idx}
                          onMouseEnter={() => setHoveredLineIndex(idx)}
                          onMouseLeave={() => setHoveredLineIndex(null)}
                          className="cursor-pointer"
                        >
                          {/* Invisible wide capture area */}
                          <rect 
                            x={p.x - 15} 
                            y={padding} 
                            width={30} 
                            height={chartH} 
                            fill="transparent" 
                          />

                          {/* Hover Guideline */}
                          {hoveredLineIndex === idx && (
                            <line 
                              x1={p.x} 
                              y1={padding} 
                              x2={p.x} 
                              y2={height - padding} 
                              stroke="#f59e0b" 
                              strokeWidth="1" 
                              strokeOpacity="0.4"
                            />
                          )}

                          {/* Dots */}
                          <circle 
                            cx={p.x} 
                            cy={p.y} 
                            r={hoveredLineIndex === idx ? 6 : 4} 
                            fill="#f59e0b" 
                            stroke="#09090b" 
                            strokeWidth="2"
                          />
                          
                          <circle 
                            cx={p.x} 
                            cy={pointsUniques[idx].y} 
                            r={hoveredLineIndex === idx ? 5 : 3.5} 
                            fill="#71717a" 
                            stroke="#09090b" 
                            strokeWidth="2"
                          />
                        </g>
                      ))}

                      {/* X Axis Labels */}
                      {data.dailyTrends.map((t, idx) => {
                        const x = padding + (idx / (data.dailyTrends.length - 1 || 1)) * chartW;
                        // Only draw start, middle, and end date to prevent crowding
                        if (idx % 2 !== 0 && idx !== data.dailyTrends.length - 1) return null;
                        return (
                          <text 
                            key={idx} 
                            x={x} 
                            y={height - 5} 
                            fill="#52525b" 
                            fontSize="9" 
                            fontWeight="600"
                            textAnchor="middle"
                          >
                            {t.date.split(',')[0]}
                          </text>
                        );
                      })}
                    </svg>

                    {/* Chart Floating HTML Tooltip */}
                    <AnimatePresence>
                      {hoveredLineIndex !== null && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 5 }}
                          className="absolute bg-zinc-950 border border-zinc-800 rounded-xl p-3 shadow-2xl text-xs space-y-1 pointer-events-none select-none z-10"
                          style={{
                            left: `${(pointsPageviews[hoveredLineIndex].x / width) * 100}%`,
                            top: `${Math.min(pointsPageviews[hoveredLineIndex].y, pointsUniques[hoveredLineIndex].y) - 60}px`,
                            transform: 'translateX(-50%)'
                          }}
                        >
                          <div className="font-bold text-zinc-300">{data.dailyTrends[hoveredLineIndex].date}</div>
                          <div className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                            <span className="text-zinc-400">Pageviews:</span>
                            <span className="font-bold text-white">{data.dailyTrends[hoveredLineIndex].pageviews}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-zinc-500"></span>
                            <span className="text-zinc-400">Uniques:</span>
                            <span className="font-bold text-white">{data.dailyTrends[hoveredLineIndex].uniques}</span>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                );
              })()
            )}
          </div>
        </div>

        {/* Bar Chart: Book Downloads Trends */}
        <div className="bg-zinc-950/30 border border-zinc-900 rounded-2xl p-6 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-sm font-semibold text-white">Sanctuary Book Downloads</h2>
              <p className="text-xs text-zinc-500 mt-0.5">Historical log of complete PDF and EPUB downloads.</p>
            </div>
            
            <div className="flex gap-2.5 items-center px-3 py-1 bg-amber-500/10 rounded-lg text-amber-400 text-[10px] font-bold">
              <Download className="h-3 w-3" />
              <span>Vault Access Logs</span>
            </div>
          </div>

          {/* Interactive SVG Bar Chart */}
          <div className="relative pt-6 h-64 select-none">
            {data.dailyDownloads.length === 0 ? (
              <div className="flex h-full items-center justify-center text-zinc-600 text-xs">Insufficient downloads data yet.</div>
            ) : (
              (() => {
                const width = 500;
                const height = 200;
                const padding = 25;
                const chartW = width - padding * 2;
                const chartH = height - padding * 2;

                const maxVal = Math.max(...data.dailyDownloads.map(d => d.count), 5);
                const barSpacing = chartW / data.dailyDownloads.length;
                const barWidth = Math.max(barSpacing * 0.5, 12);

                return (
                  <>
                    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
                      <defs>
                        <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f59e0b" stopOpacity="1" />
                          <stop offset="100%" stopColor="#d97706" stopOpacity="0.4" />
                        </linearGradient>
                        <linearGradient id="barGradientHover" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#fbbf24" stopOpacity="1" />
                          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.6" />
                        </linearGradient>
                      </defs>

                      {/* Grid Lines */}
                      {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                        const y = padding + ratio * chartH;
                        return (
                          <line 
                            key={i} 
                            x1={padding} 
                            y1={y} 
                            x2={width - padding} 
                            y2={y} 
                            stroke="#18181b" 
                            strokeWidth="1" 
                            strokeDasharray="4 4"
                          />
                        );
                      })}

                      {/* Bars */}
                      {data.dailyDownloads.map((d, idx) => {
                        const barHeight = (d.count / maxVal) * chartH;
                        const x = padding + idx * barSpacing + (barSpacing - barWidth) / 2;
                        const y = padding + chartH - barHeight;

                        return (
                          <g 
                            key={idx}
                            onMouseEnter={() => setHoveredBarIndex(idx)}
                            onMouseLeave={() => setHoveredBarIndex(null)}
                            className="cursor-pointer"
                          >
                            {/* Wide background hit-area */}
                            <rect 
                              x={padding + idx * barSpacing} 
                              y={padding} 
                              width={barSpacing} 
                              height={chartH} 
                              fill="transparent" 
                            />

                            {/* Actual Animated Bar */}
                            <motion.rect
                              x={x}
                              y={y}
                              width={barWidth}
                              height={barHeight}
                              rx={3}
                              fill={hoveredBarIndex === idx ? "url(#barGradientHover)" : "url(#barGradient)"}
                              initial={{ scaleY: 0, originY: 1 }}
                              animate={{ scaleY: 1 }}
                              transition={{ duration: 0.8, delay: idx * 0.05, ease: "easeOut" }}
                            />

                            {/* X Axis Date Label */}
                            {idx % 2 === 0 && (
                              <text 
                                x={x + barWidth / 2} 
                                y={height - 5} 
                                fill="#52525b" 
                                fontSize="9" 
                                fontWeight="600"
                                textAnchor="middle"
                              >
                                {d.date.split(',')[0]}
                              </text>
                            )}
                          </g>
                        );
                      })}
                    </svg>

                    {/* Bar Chart HTML Tooltip */}
                    <AnimatePresence>
                      {hoveredBarIndex !== null && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 5 }}
                          className="absolute bg-zinc-950 border border-zinc-800 rounded-xl p-3 shadow-2xl text-xs pointer-events-none select-none z-10"
                          style={{
                            left: `${((padding + hoveredBarIndex * (chartW / data.dailyDownloads.length) + (chartW / data.dailyDownloads.length) / 2) / width) * 100}%`,
                            top: `${padding + chartH - (data.dailyDownloads[hoveredBarIndex].count / maxVal) * chartH - 45}px`,
                            transform: 'translateX(-50%)'
                          }}
                        >
                          <div className="font-bold text-zinc-300">{data.dailyDownloads[hoveredBarIndex].date}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                            <span className="text-zinc-400">Downloads:</span>
                            <span className="font-bold text-white">{data.dailyDownloads[hoveredBarIndex].count}</span>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                );
              })()
            )}
          </div>
        </div>

      </div>

      {/* Row 3: Top Content & Technology Splits */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* Top Books Table (Leaderboard) */}
        <div className="xl:col-span-2 bg-zinc-950/30 border border-zinc-900 rounded-2xl p-6 space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-sm font-semibold text-white">Trending Learning Resources</h2>
              <p className="text-xs text-zinc-500 mt-0.5">Most active books sorted by daily download frequency.</p>
            </div>
            
            <div className="flex items-center gap-1.5 text-xs text-amber-500 font-medium">
              <BookOpen className="h-4 w-4" />
              <span>Resource Leaderboard</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-900 text-zinc-500 font-medium uppercase tracking-wider">
                  <th className="py-3 font-semibold">Resource Details</th>
                  <th className="py-3 font-semibold">Category</th>
                  <th className="py-3 font-semibold text-right">Downloads</th>
                  <th className="py-3 font-semibold text-right">Engagement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900/50">
                {data.topBooks.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-zinc-600">No downloads tracked on books yet.</td>
                  </tr>
                ) : (
                  data.topBooks.map((book, idx) => {
                    const totalDownloadsCount = Math.max(...data.topBooks.map(b => b.downloads), 1);
                    const pct = (book.downloads / totalDownloadsCount) * 100;
                    
                    return (
                      <tr key={book.id} className="group hover:bg-zinc-900/20 transition duration-150">
                        <td className="py-4 flex items-center gap-3">
                          <span className="w-5 text-center text-zinc-500 group-hover:text-amber-500 font-bold select-none">{idx + 1}</span>
                          {book.cover ? (
                            <img src={book.cover} alt="" className="w-8 h-10 object-cover rounded shadow-md" />
                          ) : (
                            <div className="w-8 h-10 bg-zinc-900 border border-zinc-800 rounded flex items-center justify-center"><BookOpen className="h-4 w-4 text-zinc-600" /></div>
                          )}
                          <div>
                            <div className="font-semibold text-zinc-200 group-hover:text-white transition duration-150 line-clamp-1">{book.title}</div>
                            <div className="text-[10px] text-zinc-500 mt-0.5">by {book.author}</div>
                          </div>
                        </td>
                        <td className="py-4">
                          <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded-full text-zinc-400 text-[10px] select-none font-medium">
                            {book.category}
                          </span>
                        </td>
                        <td className="py-4 text-right font-bold text-white text-sm">
                          {book.downloads}
                        </td>
                        <td className="py-4 pl-6 text-right w-32">
                          <div className="flex items-center justify-end gap-2.5">
                            <span className="text-[10px] text-zinc-500 font-semibold">{Math.round(pct)}%</span>
                            <div className="w-16 h-1.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800/40">
                              <motion.div 
                                className="h-full bg-amber-500" 
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 1, delay: idx * 0.1 }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Technology & Devices Column */}
        <div className="bg-zinc-950/30 border border-zinc-900 rounded-2xl p-6 space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-white">Visitor Tech Profile</h2>
              <p className="text-xs text-zinc-500 mt-0.5">Hardware and operating system distribution.</p>
            </div>

            {/* Device Type List */}
            <div className="space-y-3.5 pt-2">
              {data.technology.devices.length === 0 ? (
                <div className="text-center py-6 text-zinc-600 text-xs">No user hardware logs.</div>
              ) : (
                (() => {
                  const totalDev = data.technology.devices.reduce((acc, curr) => acc + curr.value, 0) || 1;
                  
                  return data.technology.devices.map((dev) => {
                    const pct = (dev.value / totalDev) * 100;
                    
                    const getIcon = (name: string) => {
                      const lower = name.toLowerCase();
                      if (lower.includes('mobile')) return <Smartphone className="h-4 w-4" />;
                      if (lower.includes('tablet')) return <TabletIcon className="h-4 w-4" />;
                      if (lower.includes('desktop')) return <Laptop className="h-4 w-4" />;
                      return <Monitor className="h-4 w-4" />;
                    };

                    return (
                      <div key={dev.name} className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs text-zinc-400 font-medium">
                          <span className="flex items-center gap-2">
                            <span className="text-zinc-500">{getIcon(dev.name)}</span>
                            <span>{dev.name}</span>
                          </span>
                          <span className="font-bold text-white">{pct.toFixed(0)}%</span>
                        </div>
                        <div className="w-full h-2 bg-zinc-900 border border-zinc-800 rounded-full overflow-hidden">
                          <motion.div 
                            className="h-full bg-zinc-500" 
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.8 }}
                          />
                        </div>
                      </div>
                    );
                  });
                })()
              )}
            </div>
          </div>

          <div className="border-t border-zinc-900/50 pt-4 space-y-4">
            <h3 className="text-xs font-bold text-zinc-400 tracking-wide uppercase">Top Browsers & OS</h3>
            
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="space-y-2">
                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Browsers</span>
                <div className="space-y-1">
                  {data.technology.browsers.map((b, i) => (
                    <div key={b.name} className="flex justify-between text-[11px] text-zinc-400">
                      <span className="truncate pr-1">{b.name}</span>
                      <span className="font-semibold text-zinc-300">{b.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Operating Systems</span>
                <div className="space-y-1">
                  {data.technology.os.map((os, i) => (
                    <div key={os.name} className="flex justify-between text-[11px] text-zinc-400">
                      <span className="truncate pr-1">{os.name}</span>
                      <span className="font-semibold text-zinc-300">{os.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Row 4: Real-time Live Site Activity Feed */}
      <div className="bg-zinc-950/20 border border-zinc-900 rounded-2xl p-6 space-y-5">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-sm font-semibold text-white">Real-Time Site Activity</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Live streaming event feed of user navigation and learning content access.</p>
          </div>
          
          <div className="flex items-center gap-1.5 text-xs text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg font-semibold select-none">
            <Activity className="h-3.5 w-3.5 animate-pulse" />
            <span>Live Stream</span>
          </div>
        </div>

        <div className="space-y-3">
          {data.liveFeed.length === 0 ? (
            <div className="py-8 text-center text-zinc-600 text-xs border border-dashed border-zinc-900 rounded-xl">No active clicks logged in the last hour. Events populate instantly on visits.</div>
          ) : (
            <div className="divide-y divide-zinc-900/40">
              {data.liveFeed.map((event, idx) => (
                <div key={idx} className="py-3 flex items-center justify-between text-xs group hover:bg-zinc-900/10 rounded-lg px-2 transition duration-150">
                  <div className="flex items-center gap-3.5">
                    {event.type === 'download' ? (
                      <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/20">
                        <Download className="h-3.5 w-3.5" />
                      </div>
                    ) : (
                      <div className="p-2 bg-zinc-900 text-zinc-400 rounded-lg border border-zinc-800">
                        <Eye className="h-3.5 w-3.5" />
                      </div>
                    )}
                    
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-zinc-300 group-hover:text-white transition duration-150">{event.type === 'download' ? 'Book Downloaded' : 'Book Viewed'}</span>
                        <span className="px-1.5 py-0.5 bg-zinc-900 rounded text-[9px] font-medium text-zinc-500">{event.category}</span>
                      </div>
                      <p className="text-[10px] text-zinc-500 mt-0.5 line-clamp-1 max-w-sm xl:max-w-lg">{event.title}</p>
                    </div>
                  </div>

                  <span className="text-[10px] font-semibold text-zinc-500 select-none">{formatTimeAgo(event.timestamp)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
