# Publicar XAMUKO Admin con correo y contraseña

**Objetivo:** que `https://admin.xamuko.com/login` muestre el frontend real de Admin (`frontend/apps/admin`) con correo y contraseña. El formulario **ya existe** en `LoginPage.tsx` y envía `POST /api/v1/auth/login`. No necesita Google y **no hay que cambiar las credenciales ni los roles**.

## Preparación realizada
- El script de despliegue incorpora `frontend/apps/admin/dist` en `/opt/xamuko/deploy/current/admin` (separado del frontend Usuario, `/web`).
- Plantilla de Nginx: `deploy/nginx-admin.example.conf`. **No se activa automáticamente** para evitar romper subdominios/certificados que actualmente pudieran tener otro destino.
- Test de pantalla de inicio de sesión para prevenir una regresión a Google-only.

## Activación supervisada necesaria (infraestructura)
1. Determinar con DNS y configuración real **qué servicio atiende `admin.xamuko.com`**. Si se aloja en Cloudflare Pages/S3/CloudFront, publicar el build `frontend/apps/admin/dist` allí, NO instalar Nginx duplicado. Si es la EC2 de XAMUKO, continuar.
2. Validar certificado TLS correcto para `admin.xamuko.com` y que su DNS apunte a la infraestructura prevista. Sin un certificado válido, **no instalar la plantilla**.
3. Comprobar estado del despliegue `/opt/xamuko/deploy/status.json`, release actual, y si bootstrap/poller funcionan; no sobreescribir configuración no revisada.
4. Incorporar la plantilla a Nginx solo tras revisar reglas existentes y certificados. `nginx -t` antes de `systemctl reload nginx`. Mantener `/api/v1` sobre el backend actual.
5. Configurar `AUTH_TRUSTED_ORIGINS` incluyendo `https://admin.xamuko.com` en entorno del backend **sin retirar los orígenes válidos** y revisar la política de cookies y sesiones. No imprimir secretos.
6. En `admin.xamuko.com/login`, verificar formulario visible, POST de autenticación válido, autorización `/api/v1/admin/me`, cierre de sesión y 403 a cuentas sin rol administrativo. Verificar también desde móvil e incógnito (sin caché).
7. Si no existe un `AuthIdentity.EMAIL` verificado para la cuenta del fundador, **no reasignar ni crear rol privilegiado automáticamente**: verificar titularidad y mecanismo de vinculación de identidad por canal autorizado.

## Criterios de aceptación
- Se ve el formulario email/password como opción principal, sin Google obligatorio.
- Las credenciales existentes se validan a través del backend, no del frontend ni de una simulación.
- Usuario, Business, landing, API y DB mantienen su operación.
- Producción solo tras aprobación explícita y comprobación real; rollback disponible.

**NOTA:** una publicación de código de GitHub por sí sola puede no cambiar el sitio si el subdominio está servido por otro proveedor. La infraestructura conectada debe verificarse primero.
