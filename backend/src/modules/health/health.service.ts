export function getHealth() {
  return {
    status: 'ok',
    service: 'wit-backend',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  };
}
