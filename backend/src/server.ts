import { env } from './config/env.js';
import { app } from './app.js';
import { prisma } from './config/prisma.js';
import { startVisibilityNotificationScheduler } from './modules/business/visibility-notifications.service.js';
import { startZoneLaunchAlertScheduler } from './modules/zones/zones-alerts.service.js';
import { startPlusDailyDigestScheduler } from './modules/user-plus/user-plus-digest.service.js';

let stopVisibilityScheduler: (() => void) | undefined;
let stopZoneAlertScheduler: (() => void) | undefined;
let stopPlusDailyDigestScheduler: (() => void) | undefined;
const server = app.listen(env.port, env.host, () => {
  console.info(`WIT backend disponible en http://${env.host}:${env.port}/api/v1/health`);
  stopVisibilityScheduler = startVisibilityNotificationScheduler();
  stopZoneAlertScheduler = startZoneLaunchAlertScheduler();
  stopPlusDailyDigestScheduler = startPlusDailyDigestScheduler();
});
server.on('error', (error) => {
  console.error('No se pudo iniciar el servidor:', error.message);
  process.exitCode = 1;
});

let closing = false;
function shutdown(signal: string) {
  if (closing) return;
  closing = true;
  stopVisibilityScheduler?.();
  stopZoneAlertScheduler?.();
  stopPlusDailyDigestScheduler?.();
  console.info(`Cerrando servidor (${signal})...`);
  const timeout = setTimeout(() => {
    console.error('Se agotó el tiempo de cierre del servidor.');
    server.closeAllConnections();
    process.exit(1);
  }, 10_000);
  timeout.unref();
  server.close(async (error) => {
    if (error) {
      console.error('Error al cerrar el servidor:', error.message);
      process.exitCode = 1;
    }
    try {
      await prisma.$disconnect();
    } catch {
      console.error('No se pudo cerrar la conexión de base de datos.');
      process.exitCode = 1;
    } finally {
      clearTimeout(timeout);
    }
  });
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
