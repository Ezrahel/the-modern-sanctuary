/**
 * Lightweight, non-blocking client-side analytics tracker.
 * Automatically manages anonymous Visitor ID, Session Tokens, heartbeats,
 * bot filtering, and coordinates event capturing to local database and GA4.
 */

import { buildApiUrl } from '../../api';

const VISITOR_COOKIE_NAME = 'sanctuary_visitor_id';
const SESSION_COOKIE_NAME = 'sanctuary_session_token';
const HEARTBEAT_INTERVAL_MS = 20 * 1000; // heartbeat every 20s
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // session expires after 30m

// Bot patterns to filter out common automated requests
const BOT_USER_AGENTS = [
  /bot/i, /spider/i, /crawl/i, /slurp/i, /lighthouse/i,
  /headless/i, /selenium/i, /puppeteer/i, /screaming/i
];

class AnalyticsTracker {
  private visitorId: string = '';
  private sessionToken: string = '';
  private isInitialized: boolean = false;
  private lastActivityTime: number = Date.now();
  private heartbeatIntervalId: ReturnType<typeof setInterval> | null = null;
  private currentPath: string = window.location.pathname;
  private currentScreenName: string = 'home';

  constructor() {
    if (typeof window === 'undefined') return;
    this.init();
  }

  private isBot(): boolean {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent;
    return BOT_USER_AGENTS.some(regex => regex.test(ua));
  }

  private getCookie(name: string): string | null {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return decodeURIComponent(parts.pop()!.split(';').shift()!);
    return null;
  }

  private setCookie(name: string, value: string, days?: number) {
    let expires = '';
    if (days) {
      const date = new Date();
      date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
      expires = `; expires=${date.toUTCString()}`;
    }
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${name}=${encodeURIComponent(value)}${expires}; path=/${secure}; SameSite=Lax`;
  }

  private generateUUID(): string {
    // Basic fast UUID generator
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  public init() {
    if (this.isInitialized || this.isBot()) return;

    // Load or create Visitor ID (Persists in localStorage + Cookie)
    let localVisitorId = localStorage.getItem(VISITOR_COOKIE_NAME);
    let cookieVisitorId = this.getCookie(VISITOR_COOKIE_NAME);
    
    if (localVisitorId) {
      this.visitorId = localVisitorId;
    } else if (cookieVisitorId) {
      this.visitorId = cookieVisitorId;
      localStorage.setItem(VISITOR_COOKIE_NAME, this.visitorId);
    } else {
      this.visitorId = this.generateUUID();
      localStorage.setItem(VISITOR_COOKIE_NAME, this.visitorId);
      this.setCookie(VISITOR_COOKIE_NAME, this.visitorId, 365); // 1 year cookie
    }

    // Load or create Session Token (sessionStorage + Cookie)
    let localSessionToken = sessionStorage.getItem(SESSION_COOKIE_NAME);
    let cookieSessionToken = this.getCookie(SESSION_COOKIE_NAME);

    if (localSessionToken) {
      this.sessionToken = localSessionToken;
    } else if (cookieSessionToken) {
      this.sessionToken = cookieSessionToken;
      sessionStorage.setItem(SESSION_COOKIE_NAME, this.sessionToken);
    } else {
      this.sessionToken = this.generateUUID();
      sessionStorage.setItem(SESSION_COOKIE_NAME, this.sessionToken);
      this.setCookie(SESSION_COOKIE_NAME, this.sessionToken); // Session-only cookie
    }

    this.isInitialized = true;
    this.lastActivityTime = Date.now();

    // Start heartbeat
    this.startHeartbeat();

    // Listen for user interactions to keep session alive and record active time
    this.setupActivityListeners();
    window.addEventListener('beforeunload', this.cleanup);
  }

  private cleanup = () => {
    this.removeActivityListeners();
    this.stopHeartbeat();
    window.removeEventListener('beforeunload', this.cleanup);
  };

  public destroy() {
    this.cleanup();
    this.isInitialized = false;
  }

  private setupActivityListeners() {
    const keepAlive = () => {
      const now = Date.now();
      // If returning after long inactivity (>30m), reset session token
      if (now - this.lastActivityTime > INACTIVITY_TIMEOUT_MS) {
        this.sessionToken = this.generateUUID();
        sessionStorage.setItem(SESSION_COOKIE_NAME, this.sessionToken);
        this.setCookie(SESSION_COOKIE_NAME, this.sessionToken);
      }
      
      // If they were completely inactive (heartbeat was paused), send a heartbeat on resume
      if (now - this.lastActivityTime > 120000) {
        this.sendHeartbeat();
      }
      
      this.lastActivityTime = now;
    };

    window.addEventListener('click', keepAlive);
    window.addEventListener('keypress', keepAlive);
    window.addEventListener('scroll', keepAlive, { passive: true });
    window.addEventListener('focus', keepAlive);

    this.removeActivityListeners = () => {
      window.removeEventListener('click', keepAlive);
      window.removeEventListener('keypress', keepAlive);
      window.removeEventListener('scroll', keepAlive);
      window.removeEventListener('focus', keepAlive);
    };
  }

  private removeActivityListeners: (() => void) | null = null;

  private startHeartbeat() {
    if (this.heartbeatIntervalId) clearInterval(this.heartbeatIntervalId);
    
    this.heartbeatIntervalId = setInterval(() => {
      const now = Date.now();
      
      // If inactive for more than 2 minutes, pause heartbeats to prevent DB write flood and metric inflation
      if (now - this.lastActivityTime > 120000) {
        return;
      }
      
      this.sendHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);
  }

  private async sendEvent(endpoint: string, data: Record<string, unknown>) {
    if (!this.isInitialized) return;
    
    const payload = {
      visitorId: this.visitorId,
      sessionToken: this.sessionToken,
      referrer: document.referrer || '',
      path: this.currentPath,
      screenName: this.currentScreenName,
      browserWidth: window.innerWidth,
      browserHeight: window.innerHeight,
      ...data,
      timestamp: new Date().toISOString(),
    };

    // Use async background request to prevent blocking UI thread
    try {
      const response = await fetch(buildApiUrl(`/api/analytics`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-xsrf-token': this.getCookie('XSRF-TOKEN') || '',
        },
        body: JSON.stringify({
          type: endpoint,
          payload,
        }),
        keepalive: true, // keeps request alive if tab is closed
      });

      if (!response.ok) {
        // Silently capture issues in development
        if (import.meta.env.DEV) {
          console.debug('[Analytics] Failed to send event:', endpoint, await response.json().catch(() => ({})));
        }
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.debug('[Analytics] Error sending tracking event:', err);
      }
    }
  }

  private stopHeartbeat() {
    if (this.heartbeatIntervalId !== null) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }
  }

  private sendHeartbeat() {
    const elapsedSeconds = Math.round(HEARTBEAT_INTERVAL_MS / 1000);
    this.sendEvent('heartbeat', { durationSeconds: elapsedSeconds });
  }

  // --- Public APIs for Page/Screen and Interaction Tracking ---

  public trackPageView(screenName: string, path: string = window.location.pathname) {
    this.currentScreenName = screenName;
    this.currentPath = path;
    this.sendEvent('pageview', {
      screenName,
      path,
    });

    // Also trigger GA4 if it's installed
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'page_view', {
        page_title: screenName,
        page_location: window.location.href,
        page_path: path,
      });
    }
  }

  public trackBookView(bookId: string, title: string) {
    this.sendEvent('bookview', {
      bookId,
      title,
    });

    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'book_view', {
        book_id: bookId,
        book_title: title,
      });
    }
  }

  public trackDownload(bookId: string, title: string, format: string) {
    this.sendEvent('download', {
      bookId,
      title,
      format,
    });

    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'book_download', {
        book_id: bookId,
        book_title: title,
        file_format: format,
      });
    }
  }

  public trackCustomEvent(eventType: string, eventData?: Record<string, unknown>) {
    this.sendEvent('custom', {
      eventType,
      eventData: eventData ? JSON.stringify(eventData) : null,
    });

    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', eventType, eventData || {});
    }
  }
}

export const tracker = new AnalyticsTracker();
