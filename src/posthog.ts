import posthog from 'posthog-js';

const POSTHOG_KEY = import.meta.env.VITE_PUBLIC_POSTHOG_KEY?.trim();
const POSTHOG_HOST = import.meta.env.VITE_PUBLIC_POSTHOG_HOST?.trim() || 'https://us.i.posthog.com';

export function initPostHog() {
  if (!POSTHOG_KEY) {
    if (import.meta.env.DEV) {
      console.info('PostHog disabled: missing VITE_PUBLIC_POSTHOG_KEY');
    }
    return;
  }

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    autocapture: true,
    capture_pageleave: true,
    capture_pageview: false,
    person_profiles: 'identified_only',
  });
}

export { posthog };
