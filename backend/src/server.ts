import { env } from './config/env.js';
import { app } from './app.js';

const server = app.listen(env.port, env.host, () => {
  console.info(`WIT backend disponible en http://${env.host}:${env.port}/api/v1/health`);
});
server.on('error', (error) => {
  console.error('No se pudo iniciar el servidor:', error.message);
  process.exitCode = 1;
});

let closing = false;
function shutdown(signal: string) {
  if (closing) return;
  closing = true;
  console.info(`Cerrando servidor (${signal})...`);
  const timeout = setTimeout(() => {
    console.error('Se agotó el tiempo de cierre del servidor.');
    server.closeAllConnections();
    process.exit(1);
  }, 10_000);
  timeout.unref();
  server.close((error) => {
    clearTimeout(timeout);
    if (error) {
      console.error('Error al cerrar el servidor:', error.message);
      process.exitCode = 1;
    }
  });
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
