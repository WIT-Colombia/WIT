# Persistencia de sesiones XAMUKO

Rama: `fix/session-persistence-15-days`. Base: `integration/preserve-all-20261029` (d8617fc al iniciar la corrección). No se despliega ni fusiona este cambio. No requiere migración.

## Causas demostradas

1. `/auth/refresh` utilizaba el mismo limitador de 10 solicitudes por 15 minutos que otras operaciones de autenticación. Cada recarga restaura mediante refresh: la undécima podía recibir 429. Regresión cubierta con 30 solicitudes HTTP reales.
2. Refresh revocaba la fila Session y creaba otra. `requireAuth` verifica esa fila en cada solicitud, por lo que un refresh invalidaba inmediatamente los access tokens de otras pestañas. Dos pestañas con la misma cookie competían: una obtenía 401. Si se perdía la respuesta tras revocar, el navegador conservaba una credencial inválida.
3. La cookie se reescribía en cada refresh usando una preferencia de localStorage independiente de la sesión. Google no guardaba esa preferencia: una cookie persistente podía convertirse en cookie de sesión.
4. Usuario y Admin convertían también fallos de red/429/5xx al restaurar en estado anónimo, provocando redirecciones al login. `requireAuth` convertía excepciones de base de datos en 401; refresh convertía una caída consultando identidades en una revocación por email no verificado.
5. Business podía reintentar con un Authorization explícito obsoleto. Usuario no tenía renovación central para todas sus solicitudes autenticadas.
6. Admin tenía vencimiento fijo de 8 horas, sin diferencia de persistencia. La CSRF anterior comparaba dos valores proporcionados por el cliente sin vincularlos criptográficamente con la sesión.

## Política y solución

| Aplicación | Mantener sesión | Sin mantener sesión | Credencial |
|---|---|---|---|
| Usuario / Business | 30 días por defecto; `AUTH_REFRESH_TOKEN_TTL_DAYS` acepta 15–365 | Cookie sin Max-Age; vencimiento servidor de 8 horas | Opaque aleatorio de 48 bytes; hash SHA-256 en Session |
| Admin | 15 días absolutos | Cookie sin Max-Age; vencimiento servidor de 8 horas | Opaque aleatorio de 48 bytes; hash SHA-256 en AdminSession |

Access tokens de Usuario/Business: 900 segundos por defecto, conservando validación y límites existentes de 60–3600. Se guardan sólo en memoria y se renuevan al restaurar o ante 401, con una promesa compartida por aplicación/pestaña y un único reintento. 403 no dispara renovación ni omite permisos. Diferentes pestañas pueden renovar simultáneamente de forma segura; no se distribuyen access tokens entre pestañas ni subdominios.

El identificador opaco permanece estable durante la vida absoluta de la sesión. Renovar access tokens no revoca la sesión, no cambia la cookie ni prolonga su vencimiento. Es una sesión de servidor con credencial HttpOnly, no un refresh JWT público. Esto elimina carreras y tolera respuestas perdidas sin añadir un período en que tokens revocados sean aceptados. El compromiso de una credencial aún válida permite su uso hasta vencimiento/revocación: no se implementa detección de robo por rotación. Se mantienen comprobaciones de estado de cuenta, email verificado y revocación en cada acceso.

Cookies host-only (sin Domain), HttpOnly, Secure en producción, SameSite configurable (lax por defecto), Path `/api/v1/auth` o `/api/v1/admin`. Ningún token sensible se introduce en localStorage. Sólo email/preferencias e identificadores de negocio no secretos. Refresh conserva la elección original, incluso después de OAuth o de borrar preferencias locales.

Admin conserva la arquitectura de sesiones opacas y sus roles/permisos actuales; no se agrega un JWT administrativo duradero. Las escrituras administrativas requieren identidad confirmada en los últimos 15 minutos; vencida esa ventana responden `ADMIN_REAUTH_REQUIRED` sin terminar la sesión de lectura. El cliente abre el login al recibir ese código para volver a confirmar identidad por los métodos ya autorizados; un 403 de permisos ordinario no redirige. Logout sigue disponible tras esa ventana. CSRF es HMAC de la credencial con el secreto de servidor y se devuelve por la respuesta autenticada existente `csrfToken`; sirve entre subdominios sin leer cookies de la API desde el frontend. Origin/CORS y comprobaciones de rol permanecen activas.

Restauración mantiene loading ante fallos temporales y reintenta al recuperar conectividad; Business conserva su estado de error recuperable. Logout de Usuario/Business sólo confirma el cierre después de completar revocación en servidor; si está offline, informa el fallo en lugar de afirmar que la sesión fue revocada. Revocar invalida tanto la credencial como los access tokens asociados. Business conserva selección por usuario y sólo acepta un ID incluido en la lista autorizada devuelta por backend; limpia la selección visible al pasar a anónimo.

## Investigación separada de Admin

La copia de trabajo original estaba atrasada respecto de integración y contenía cambios locales no confirmados de login. La base de integración actual ya incluye `/admin/auth/password`, callback Google y recuperación CSRF entre subdominios. Se preservan esas funciones: el login normal con `/auth/login` por sí solo no satisface `requireAdminSession` y recibe 401 al consultar `/admin/me`. El rol SUPER_ADMIN, estado activo, credenciales correctas y política de email siguen siendo obligatorios; Google/passkey mantienen sus verificaciones existentes.

La restauración original ocultaba todos los fallos como ausencia de sesión, impidiendo distinguir fallos de conectividad de rechazos reales. Ahora sólo 401/403 limpian la sesión. Se probó acceso Admin con la cuenta simulada autorizada y restauración del navegador. **No se autenticó una cuenta administrativa real ni se determinó el motivo específico de rechazo de una cuenta de producción**: para eso hace falta reproducirlo con esa cuenta y revisar su código de error/logs, sin cambiar contraseña, roles ni datos.

## Validación reproducible y resultados

Los tests nuevos usan repositorios Prisma simulados en memoria y una URL deliberadamente inalcanzable. No crean, eliminan ni modifican usuarios reales. APIs ajenas a autenticación se aíslan en la prueba de navegador.

- Backend: `npm run prisma:generate` (sólo generación de cliente) y `npm run build` pasan.
- Frontend: `npm run build --workspaces --if-present` pasa para las cuatro aplicaciones. Persisten advertencias de tamaño de bundle y dos referencias de assets de Landing ajenas al cambio.
- Admin: 36 pruebas pasan, incluidas renovación concurrente de Usuario y Business, reintento con token nuevo, rechazo 403, fallos de red y CSRF.
- Usuario: 9 pruebas existentes pasan.
- Business: suite existente actualizada para esperar `/inicio`, ruta ya vigente en integración, sin cambiar navegación.
- Backend: `src/modules/auth/session-persistence.test.ts` y `src/shared/middleware/require-auth.test.ts` cubren login, expiración real de JWT, 30 refreshes, 20 peticiones concurrentes, TTL/cookies, caída de DB, revocación de refresh y access, 30 restauraciones Admin, CSRF de otra sesión y reautenticación sensible.
- Chromium: **las tres aplicaciones reales** contra el backend con Prisma simulado pasan 30 recargas por app, cuatro pestañas, fallo de fetch offline y recuperación, cierre completo y relanzamiento con perfil persistente. Se comprueba conservación de cookie persistente y desaparición de cookie no persistente al relanzar. El inicio de sesión se hace por API real, no por completar el formulario; el formulario Admin se cubre con Testing Library.

Desde backend (usar valores de prueba, nunca credenciales de producción):

```sh
AUTH_ACCESS_TOKEN_SECRET=fixture-only-secret-at-least-32-characters DATABASE_URL=mysql://fixture:fixture@127.0.0.1:1/unused NODE_ENV=test node --import tsx --test src/modules/auth/session-persistence.test.ts src/shared/middleware/require-auth.test.ts
```

Para Chromium, instalar dependencias de frontend y su Chromium Playwright, y añadir `SESSION_BROWSER_TEST=1` al comando anterior. Por defecto esa única subprueba de navegador se omite para no exigir Chromium en cada ejecución de backend. `npm test` incluye la regresión HTTP sin navegador.

## Pendientes antes de aprobar y desplegar

| Verificación | Estado |
|---|---|
| Login, 30 recargas, reapertura, pestañas, offline | Automatizadas con apps reales y backend/DB simulada |
| Renovación vencida, concurrencia, revocación | Automatizadas con JWT real y repositorios simulados |
| Cookies con y sin persistencia | Automatizadas en servidor y Chromium |
| Duración mínima 15 días | Configuración y expiración comprobadas; no han transcurrido 15 días reales |
| MySQL real, OAuth/passkey físico y cuenta Admin afectada | Manual/integración pendiente |
| HTTPS y tres subdominios reales | Pendiente en entorno de integración autorizado |
| Selección entre dos negocios y cambio de usuario con datos reales | Pendiente; ID se restringe a lista autorizada |

En integración: iniciar sesión por formulario con ambas preferencias en las tres apps; repetir pruebas con dos usuarios y dos establecimientos, navegador cerrado de verdad (sin restauración automática de sesiones), permisos denegados y logout en otra pestaña. Verificar ausencia de acceso con cookie revocada, reautenticación de escrituras Admin tras 15 minutos y lectura continua. Revisar cookies y `Cache-Control: no-store` en DevTools. Confirmar `NODE_ENV=production`, secreto configurado, TTL >=15, HTTPS, URLs públicas de API, CORS con orígenes exactos y credenciales, y SameSite acorde con los dominios. La configuración de producción desplegada no fue leída ni modificada; una cookie de sesión puede ser restaurada por la función de restauración de sesiones del propio navegador, por lo que sigue existiendo el límite absoluto de 8 horas del servidor.

No se ejecuta la suite completa de integración que crea/elimina fixtures MySQL: la restricción del encargo prohíbe eliminar usuarios. CI deberá usar exclusivamente su base desechable.

## Archivos modificados

- `backend/package.json`
- `backend/src/config/env.ts`
- `backend/src/modules/admin/admin-auth.routes.ts`
- `backend/src/modules/admin/admin-security.http.test.ts`
- `backend/src/modules/admin/admin-session.service.ts`
- `backend/src/modules/auth/auth.controller.ts`
- `backend/src/modules/auth/auth.routes.ts`
- `backend/src/modules/auth/auth.service.ts`
- `backend/src/shared/middleware/require-auth.ts`
- `frontend/apps/admin/src/App.tsx`
- `frontend/apps/admin/src/pages/LoginPage.test.tsx`
- `frontend/apps/admin/src/pages/LoginPage.tsx`
- `frontend/apps/admin/src/services/adminApiClient.ts`
- `frontend/apps/admin/src/services/adminService.ts`
- `frontend/apps/negocios/src/services/businessApiClient.ts`
- `frontend/apps/negocios/src/services/businessAuthContext.tsx`
- `frontend/apps/negocios/src/services/businessAuthService.ts`
- `frontend/apps/negocios/src/services/businessStore.tsx`
- `frontend/apps/usuario/src/context/AuthContext.tsx`
- `frontend/apps/usuario/src/services/authService.ts`
- `frontend/apps/usuario/src/services/httpClient.ts`
- `frontend/tests/business-auth-api.test.ts`
- `backend/src/modules/auth/session-persistence.test.ts`
- `frontend/apps/admin/src/services/sessionPersistence.test.tsx`
- `docs/session-persistence.md`
