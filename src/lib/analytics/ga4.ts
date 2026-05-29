/**
 * Google Analytics 4 (GA4) Integration Utility
 * Automatically injects the global gtag.js script if a GA Measurement ID is defined.
 */

const GA_MEASUREMENT_ID = import.meta.env.VITE_PUBLIC_GA_MEASUREMENT_ID?.trim();

export function initGA4() {
  if (!GA_MEASUREMENT_ID || typeof window === 'undefined' || typeof document === 'undefined') {
    if (import.meta.env.DEV) {
      console.info('GA4 disabled: missing VITE_PUBLIC_GA_MEASUREMENT_ID environment variable.');
    }
    return;
  }

  // Check if already injected
  if (document.getElementById('ga4-script')) return;

  // Inject Global Site Tag (gtag.js) script
  const script = document.createElement('script');
  script.id = 'ga4-script';
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);

  // Configure gtag options
  const dataLayer = (window as any).dataLayer || [];
  (window as any).dataLayer = dataLayer;
  
  function gtag(...args: any[]) {
    dataLayer.push(arguments);
  }
  (window as any).gtag = gtag;

  gtag('js', new Date());
  gtag('config', GA_MEASUREMENT_ID, {
    send_page_view: false, // Page view tracking is managed manually in tracker.ts
    anonymize_ip: true, // IP Anonymization is standard for privacy
  });

  if (import.meta.env.DEV) {
    console.info(`GA4 initialized successfully with ID: ${GA_MEASUREMENT_ID}`);
  }
}

/**
 * Send custom event to Google Analytics
 */
export function trackGA4Event(name: string, params?: Record<string, any>) {
  if (typeof window !== 'undefined' && (window as any).gtag && GA_MEASUREMENT_ID) {
    (window as any).gtag('event', name, params || {});
  }
}
