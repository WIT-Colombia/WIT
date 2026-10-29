# Revisión de entrada y autenticación para PR #8

Revisión del 29 de octubre de 2026. Alcance: frontend y pruebas aisladas; sin AWS,
EC2, DNS, Nginx, certificados, backend, BD ni cambios al polling. No implica autorización
de merge o publicación. Los valores reales de producción no se consultaron.

## Pantallas acordadas

| Origen | Entrada preparada | Evidencia aislada |
| --- | --- | --- |
| https://xamuko.com | Landing | HTML de Landing y enlaces HTTPS comprobados |
| https://www.xamuko.com | Landing | Mismo artefacto de Landing, sin redirección obligatoria |
| https://user.xamuko.com | Registro; alternar a login; enlace para explorar /home | Navegador sin sesión, registro y exploración |
| https://business.xamuko.com | Login; alternativa /registro | Navegador sin sesión y registro |
| https://admin.xamuko.com | Login administrativo, sin registro público | Ruta protegida, ausencia de registro y rechazo de usuario sin rol |

Los hosts no están activados por este PR. Su resolución real y la selección de artefactos
por dominio requieren revisión posterior autorizada de infraestructura. En el origen
actual xamuko.com, si sigue sirviéndose Usuario, su raíz continúa abriendo /home.
Solo user.xamuko.com cambia la entrada anónima a /register; una sesión restaurada abre /home.

## Correcciones limitadas de frontend

- Usuario usa user.xamuko.com en Landing, pruebas y documentación.
- Registro de Usuario ofrece un enlace explícito a /home sin registro.
- Los destinos `next` de login de Usuario y Business se validan como rutas internas:
  se rechazan URLs externas, barras invertidas, controles y retornos a la propia
  autenticación, incluido el callback. Se conservan query y fragmento de rutas válidas.
- El comando optativo package:publication aporta los valores públicos por defecto
  VITE_USUARIO_PUBLIC_URL=https://user.xamuko.com y
  VITE_BUSINESS_PUBLIC_URL=https://business.xamuko.com. Esto permite preparar enlaces
  de compartir y regreso a Business dentro de esos paquetes; se permiten overrides.
  No cambia npm run build, deploy/build.sh, el workflow de staging ni su artefacto activo.
- El nuevo workflow del PR ejecuta navegador Chromium con respuestas simuladas;
  no se comunica con API real, cuentas Google ni AWS. Los archivos compilados se
  sirven mediante interceptación, sin resolver esos dominios por DNS.

## Flujos revisados y límites

Usuario y Business mantienen el access token en memoria y envían credentials: include.
Admin también usa token en memoria y consulta /admin/me antes de admitir el acceso.
Usuario/Admin usan rutas relativas /api/v1. Business usa /api/v1 por defecto y permite
VITE_API_BASE_URL; configurar una URL externa solo allí NO configura las otras apps.
No se pasan tokens por URLs entre aplicaciones ni se incorpora RESEND_API_KEY.

Los tests cubren registro con espera de verificación, login, restauración de Usuario
tras recarga, logout y protección posterior de su perfil, login/logout de Business
y Admin, y rechazo de una identidad sin rol Admin. La API de prueba simula el estado
de sesión; no demuestra almacenamiento o expiración de cookies del backend real.

Google: Usuario inicia con application=usuario, Business con application=negocios;
ambos conservan sus rutas existentes de /api/v1/auth/google/start y callback.
Usuario restaura sesión y abre /home; Business abre un next validado o /mis-negocios.
Las cancelaciones muestran error y enlace para reintentar. Se prueba el contrato del
frontend y las redirecciones; no el intercambio real de código, PKCE, state ni Google.

## Condiciones que bloquean la activación hasta verificación/autorización

1. **Cookies y OAuth entre hosts.** backend/src/shared/auth/refresh-cookie.ts emite
   wit_refresh_token HttpOnly y Secure en producción, Path=/api/v1/auth y sin Domain
   (cookie del host). google-oauth.service.ts emite el state de OAuth también sin
   Domain, Path=/api/v1/auth/google. Un inicio por user.xamuko.com y callback por
   otro host no comparten state; un callback que fija refresh en otro host tampoco
   entrega automáticamente sesión al frontend de destino. Confirmar una topología
   coherente de inicio/callback/API antes de activar. No ampliar Domain ni rebajar
   SameSite o HttpOnly para resolverlo sin un diseño y autorización separados.
2. **Orígenes confiables y CORS.** AUTH_TRUSTED_ORIGINS debe admitir los orígenes
   realmente utilizados (User, Business y Admin; Landing/www solo si llaman API).
   require-trusted-origin.ts devuelve 403 para un origen no autorizado incluso
   detrás de proxy. No se encontró middleware CORS general en backend/src. Un API
   externo necesitaría CORS explícito con credenciales, preflight y encabezados
   permitidos; Access-Control-Allow-Origin: * no sirve con cookies. Con proxy del
   mismo origen no hace falta CORS entre navegador y API, pero sí el control de Origin.
3. **/api/v1 y SPA.** Cada host de app debe encaminar /api/v1 al backend existente,
   conservar encabezados/cookies y no responder index.html a solicitudes API.
   Las rutas profundas y /auth/google/callback del frontend necesitan fallback SPA.
   Eso no se puede validar ni configurar con archivos del frontend solamente.
4. **Configuración Google y correo.** Revisar GOOGLE_FRONTEND_URL_USUARIO,
   GOOGLE_FRONTEND_URL_NEGOCIOS, GOOGLE_REDIRECT_URI y la URI autorizada en Google
   para la topología aprobada. Revisar EMAIL_VERIFICATION_URL y PASSWORD_RESET_URL
   para User. Sus valores por defecto del repositorio incluyen localhost: no son
   prueba de una configuración correcta o incorrecta en producción.
5. **Alcance de sesión/logout.** Las cookies del host y localStorage están separados
   por origen. No hay SSO ni logout global implementados por este PR. Verificar el
   comportamiento esperado entre User, Business y Admin; no prometer sesión compartida.
   Si falla el POST de logout, puede seguir vigente la cookie del servidor; varios
   consumidores de UI tampoco muestran un error claro. Probar pérdida de red y
   revocación reales antes de autorizar publicación.

Cualquier cambio de backend o infraestructura para resolver estas condiciones
requiere autorización explícita previa. Esta revisión no lo realiza ni lo autoriza.

## Hallazgos existentes que necesitan una decisión de alcance

- Las simulaciones de recuperación/cambio detectadas inicialmente se corrigieron
  mediante los endpoints existentes. Ver [auditoría de contraseña](password-recovery-audit.md)
  para contratos, pruebas y un hallazgo de backend que queda detenido, pendiente de autorización.
- Admin adminRefresh envía rememberMe=false aunque login ofrece Recordar sesión:
  verificar la duración esperada en servidor y navegador tras una recarga.
- El callback Google de Business no limita explícitamente su espera si refresh nunca
  termina; Usuario sí usa un límite de ocho segundos. Prueba de red real pendiente.
- El backend tiene una única configuración de destino de restablecimiento/verificación;
  revisar la experiencia de quien se registra desde Business antes de activar dominios.

## Pruebas repetibles y verificación posterior

Desde frontend, Node 24 y dependencias instaladas:

```bash
npm run typecheck
npm run test:publication
npm run build
npx playwright install --with-deps chromium
npm run test:publication:browser
npm run package:publication
```

La suite de publicación comprueba destinos y rechaza paquetes incompletos/corruptos.
El navegador usa datos sintéticos; todos los accesos ajenos a sus archivos y API
simulados son abortados. No se ejecuta backend ni se escribe en base de datos.

Después de autorizar un entorno aislado y las dependencias necesarias: verificar
HTTPS real en los cinco hosts, rutas profundas, /api/v1 JSON, cabeceras Origin/CORS,
atributos reales de cookies, login/refresh/expiración/logout, OAuth real con ambos
application, cancelación/reintento, verificación por correo y recuperación. Confirmar
que un usuario normal no obtiene acceso administrativo. Conservar evidencia sin tokens.
Las comprobaciones de EC2 siguen en ec2-pending-verification.md y NO fueron ejecutadas.

Resultados en el entorno de trabajo: typecheck de las cuatro apps correcto;
compilación de las cuatro apps correcta; 11 pruebas de publicación, 19 pruebas de
navegador y 28 pruebas existentes de contrato/navegación correctas. Los cuatro
paquetes optativos se construyeron y pasaron la verificación de hashes/recursos.
git diff --check sin incidencias. La confirmación de CI del commit final se enlaza
en el PR para no confundir resultados locales con la ejecución de GitHub.
