/**
 * Anonymous, GET-only smoke test. May run against the production API manually
 * after deploy; does not submit credentials, write data or change zone state.
 */
export async function runSmoke(fetcher, origin) {
  const base = origin.replace(/\/$/, '') + '/api/v1';
  const checks = [
    ['API health', '/health', (r, b) => r.status === 200 &&
      b?.status === 'ok'],
    ['Próxima apertura', '/public/zones/next-launch', (r, b) => r.status === 200 &&
      typeof b?.serverTime === 'string' && ('next' in b)],
    ['Estado de Palmira', '/public/zones/status?city=Palmira&region=Valle%20del%20Cauca',
      (r, b) => r.status === 200 && b?.zone?.code === '76520' &&
        ['OPEN', 'SCHEDULED', 'PAUSED', 'CLOSED'].includes(b?.zone?.state)],
    ['Estado de Cali', '/public/zones/status?city=Cali&region=Valle%20del%20Cauca',
      (r, b) => r.status === 200 && b?.zone?.code === '76001' &&
        ['OPEN', 'SCHEDULED', 'PAUSED', 'CLOSED'].includes(b?.zone?.state)],
    ['Catálogo público', '/public/businesses', (r, b) => r.status === 200 &&
      b !== null && typeof b === 'object'],
    ['Admin Zonas requiere autenticación', '/admin/zones',
      (r) => [401, 403].includes(r.status)],
    ['Admin Categorías requiere autenticación', '/admin/categories',
      (r) => [401, 403].includes(r.status)],
  ];
  const results = [];
  for (const [name, path, accepts] of checks) {
    try {
      const response = await fetcher(base + path, {
        method: 'GET',
        redirect: 'error',
        credentials: 'omit',
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(12000),
      });
      const body = await response.json().catch(() => null);
      results.push({ name, status: response.status, passed: Boolean(accepts(response, body)) });
    } catch {
      results.push({ name, status: 'network-error', passed: false });
    }
  }
  return results;
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  const origin = process.env.XAMUKO_PROBE_ORIGIN || 'https://api.xamuko.com';
  if (!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/.test(origin) &&
    !/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) {
    console.error('Origen de comprobación inválido.');
    process.exitCode = 2;
  } else {
    const rows = await runSmoke(fetch, origin);
    rows.forEach(row => console.log((row.passed ? 'OK' : 'FALLO') +
      ' · ' + row.name + ' · HTTP ' + row.status));
    if (rows.some(row => !row.passed)) process.exitCode = 1;
  }
}
