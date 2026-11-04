export const LOGIN_RATE_LIMIT = 10;
export const LOGIN_IP_WINDOW_SECONDS = 60;
export const LOGIN_ACCOUNT_WINDOW_SECONDS = 15 * 60;

// A valid session refresh must not consume the abuse quota. Invalid refreshes
// remain limited to protect the endpoint without logging users out on reload.
export const REFRESH_RATE_LIMIT_POLICY = {
  windowMs: 15 * 60 * 1000,
  limit: 120,
  skipSuccessfulRequests: true,
} as const;
