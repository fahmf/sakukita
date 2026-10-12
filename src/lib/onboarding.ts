/**
 * Onboarding gate. New users (no transactions in any of their households)
 * land on /onboarding after login; finishing or skipping it sets this cookie
 * so they are never sent back there on this device.
 */
export const ONBOARDED_COOKIE = "saku-onboarded";

/** Client-side: remember that onboarding was finished or skipped. */
export function markOnboarded(): void {
  document.cookie = `${ONBOARDED_COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 365 * 5}; samesite=lax`;
}
