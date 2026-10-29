export function landingDestinations(dev: boolean, overrides: { user?: string; business?: string } = {}) {
  function origin(value: string | undefined, fallback: string) {
    const url = new URL(value?.trim() || fallback);
    if (!['http:', 'https:'].includes(url.protocol) || (!dev && url.protocol !== 'https:') || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw new Error('Landing destinations must be origins; production requires HTTPS');
    }
    return url.origin;
  }
  const user = origin(overrides.user, dev ? 'http://127.0.0.1:5173' : 'https://app.xamuko.com');
  const business = origin(overrides.business, dev ? 'http://127.0.0.1:5174' : 'https://business.xamuko.com');
  return {
    businessLogin: `${business}/login`, businessRegister: `${business}/registro`,
    userLogin: `${user}/register?mode=login`, userRegister: `${user}/register`, explore: `${user}/home`,
  };
}
