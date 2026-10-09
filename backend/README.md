# WIT Backend — Fase 1

API independiente para WIT. En esta fase solo contiene infraestructura y un módulo de salud; no implementa autenticación, MySQL, tablas ni migraciones.

## Requisitos

- Node.js 22.12 o superior.
- npm.

## Instalación y desarrollo

Desde la raíz WIT:

```sh
cd backend
npm ci
cp .env.example .env
npm run dev
```

El archivo `.env` es opcional: sin él se usan los valores predeterminados. Las variables del proceso tienen prioridad sobre el archivo. `.env` está excluido de Git.

| Variable | Valor predeterminado | Uso |
| --- | --- | --- |
| NODE_ENV | development | development, test o production |
| HOST | 127.0.0.1 | Interfaz de escucha; usar 0.0.0.0 si el despliegue lo requiere |
| PORT | 3000 | Puerto entero entre 1 y 65535 |

La configuración inválida impide el arranque. No agregar secretos a `.env.example`.

## Comprobación, compilación y ejecución

```sh
npm run typecheck
npm run build
npm start
```

La compilación genera `dist/`. `npm start` requiere compilar previamente. Desarrollo utiliza recarga automática con tsx. Detener con Ctrl+C; el servidor también maneja SIGTERM.

## Endpoint de salud

```sh
curl -i http://127.0.0.1:3000/api/v1/health
```

Responde HTTP 200 con `status: "ok"`, `service: "wit-backend"`, fecha UTC ISO y tiempo de actividad en segundos. Comprueba únicamente que el proceso HTTP está disponible; no comprueba una base de datos.

## Organización

- `src/server.ts`: configuración, escucha HTTP y cierre ordenado.
- `src/app.ts`: composición de Express y middleware.
- `src/config/env.ts`: carga nativa de entorno y validación.
- `src/routes.ts`: registro de módulos bajo `/api/v1`.
- `src/modules/health/`: rutas, controlador y servicio independientes.
- `src/shared/errors/`: errores esperados de aplicación.
- `src/shared/middleware/`: respuesta centralizada de errores y rutas inexistentes.

Los futuros módulos tendrán su propia carpeta en `src/modules/` y se registrarán en `src/routes.ts`. No importar código de las aplicaciones frontend.

## Errores

Formato uniforme: `{ "error": { "code": "NOT_FOUND", "message": "Ruta no encontrada." } }`.

Rutas inexistentes responden 404, JSON inválido 400 y cuerpos superiores a 100 KB 413. Los errores inesperados responden 500 con un mensaje genérico; los detalles se registran en el servidor. Express 5 transmite automáticamente al middleware los errores de manejadores que devuelven promesas rechazadas.

## Dependencias

- Ejecución: `express`.
- Desarrollo: `typescript`, `tsx`, `@types/node`, `@types/express`.

Se usa el cargador `.env` nativo de Node.js. No se necesitan paquetes de autenticación, SQL, ORM ni integración con las aplicaciones en esta fase. El frontend no se modifica y conserva su instalación y ejecución independientes.

## Prisma y MySQL

Prisma ORM 7.10.0 está preparado para MySQL mediante `@prisma/adapter-mariadb` y `mariadb`. La configuración vive en `prisma.config.ts` y el schema inicial en `prisma/schema.prisma`; todavía no contiene modelos ni migraciones.

Configura `DATABASE_URL` en `.env` usando el usuario local de WIT. Ese archivo está excluido de Git y nunca debe copiarse a `.env.example`.

```sh
npm run prisma:generate
```

La conexión inicial se comprobó con una consulta de solo lectura. No se ejecutaron `prisma migrate`, `prisma db push` ni introspecciones que modifiquen el schema.
