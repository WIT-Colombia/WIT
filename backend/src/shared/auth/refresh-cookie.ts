import { parseCookie, stringifySetCookie } from 'cookie';
import type { Response } from 'express';
import { env } from '../../config/env.js';

export const REFRESH_COOKIE_NAME = 'wit_refresh_token';
const REFRESH_COOKIE_PATH = '/api/v1/auth';

export function getRefreshToken(request: { headers: { cookie?: string } }): string | undefined {
  return parseCookie(request.headers.cookie ?? '')[REFRESH_COOKIE_NAME];
}

export function setRefreshCookie(response: Response, token: string): void {
  response.appendHeader('Set-Cookie', stringifySetCookie({ name: REFRESH_COOKIE_NAME, value: token,
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: env.authCookieSameSite,
    path: REFRESH_COOKIE_PATH,
    maxAge: env.refreshTokenTtlDays * 24 * 60 * 60,
  }));
}

export function clearRefreshCookie(response: Response): void {
  response.appendHeader('Set-Cookie', stringifySetCookie({ name: REFRESH_COOKIE_NAME, value: '',
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: env.authCookieSameSite,
    path: REFRESH_COOKIE_PATH,
    maxAge: 0,
  }));
}
