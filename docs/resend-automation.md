# Automatización de correo con Resend

## Estado

El backend ya selecciona Resend con `EMAIL_MODE=resend`, `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_VERIFICATION_URL` y `PASSWORD_RESET_URL`. Las rutas de verificación y recuperación usan el mismo remitente. Esta rama añade las plantillas de bienvenida y aviso de seguridad, claves de idempotencia y reintentos acotados.

Los reintentos solo aplican a errores de red, `408`, `429` y `5xx`, con un máximo de tres intentos. Los errores de cliente no se repiten. Cada evento lleva una clave estable en el encabezado `Idempotency-Key`, por lo que un timeout o reintento no debe crear un correo duplicado. Los registros solo incluyen estado, tipo de evento y código genérico del proveedor; nunca el destinatario, el contenido ni la clave API.

## Mensajes

- Verificación: se emite al registrar la cuenta o solicitar otro enlace.
- Recuperación: se emite cuando la cuenta elegible solicita restablecimiento.
- Bienvenida: se emite al crear la cuenta; su fallo no invalida el registro.
- Seguridad: se emite después de cambiar la contraseña; su fallo no revierte el cambio.

Todos los flujos de prueba sustituyen `fetch`; no se envían correos reales.

## Producción

Configurar los valores anteriores como secreto/variable en el entorno de despliegue, sin guardarlos en Git. `EMAIL_MODE=resend` requiere `RESEND_API_KEY`. Antes de activar el envío, verificar el dominio en Resend y mantener `EMAIL_FROM` dentro de un dominio verificado.

En esta instalación, el archivo real es `/opt/xamuko/deploy/current/xamuko-api.env` y permanece fuera del artefacto de Git, con permisos restringidos. La preparación segura consiste en editar ese archivo desde una sesión SSM autorizada, conservar todas las variables existentes y establecer únicamente `EMAIL_MODE=resend` y `EMAIL_FROM="XAMUKO <notificaciones@xamuko.com>"`; la clave se añade como `RESEND_API_KEY` sin mostrarla en la consola. Después se debe validar el formato, reiniciar `xamuko-api` durante una ventana acordada y comprobar `/api/v1/health`. No se debe poner la clave en GitHub Actions porque el transporte actual de despliegue por polling no la necesita.

La consulta DNS pública observada el 28-10-2026 muestra SPF de Hostinger (`include:_spf.mail.hostinger.com`), MX de Hostinger y un registro TXT en `resend._domainkey.xamuko.com`. No se puede confirmar desde DNS si ese DKIM corresponde al proyecto Resend; hay que comparar el valor que muestra Resend. No se modificó DNS.

## Webhooks y recuperación

Resend ofrece eventos `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained` y `email.failed`, con firma del webhook. El siguiente paso seguro es crear un endpoint HTTPS que valide `svix-id`, `svix-timestamp` y `svix-signature`, registre solo `event`, `email_id`, estado y destinatario anonimizado, y responda rápidamente. La URL y el secreto de firma deben configurarse en Resend y en producción mediante autorización explícita; no se activan en esta rama.

Ante un fallo de entrega: revisar el evento en Resend, corregir dominio/remitente o dirección, volver a emitir el enlace desde la interfaz y no reintentar manualmente a ciegas. Para recuperar una regresión, volver al commit anterior de la rama de despliegue; la configuración de secretos permanece fuera de Git.

## Variables pendientes

No se encontraron secretos ni variables de Actions con `gh secret list`/`gh variable list`. Por tanto, el código está listo pero el repositorio no demuestra que producción tenga `RESEND_API_KEY` ni `EMAIL_MODE=resend`. No se hicieron cambios de credenciales, DNS, facturación ni producción.

## Configuración explícita de XAMUKO Usuario y Business (noviembre de 2026)

Una sola `RESEND_API_KEY` sirve para ambas aplicaciones; los cuatro enlaces son **rutas**, no claves independientes.

Configurar **exclusivamente en el backend de producción** (`/opt/xamuko/deploy/current/xamuko-api.env` mediante sesión SSM autorizada, sin guardar secretos en Git ni Cloudflare Pages):

```dotenv
EMAIL_MODE=resend
EMAIL_FROM="XAMUKO <notificaciones@xamuko.com>"
EMAIL_VERIFICATION_TTL_MINUTES=15
EMAIL_VERIFICATION_URL_USUARIO=https://user.xamuko.com/verify-email
EMAIL_VERIFICATION_URL_NEGOCIOS=https://business.xamuko.com/verify-email
PASSWORD_RESET_URL_USUARIO=https://user.xamuko.com/reset-password
PASSWORD_RESET_URL_NEGOCIOS=https://business.xamuko.com/recuperar
# RESEND_API_KEY se proporciona de forma privada en la instancia; nunca imprimirla.
```

Conservar `AUTH_TRUSTED_ORIGINS` e incluir `https://user.xamuko.com` y `https://business.xamuko.com` sin sobrescribir los otros orígenes existentes. Verificar el dominio `xamuko.com` y el remitente `notificaciones@xamuko.com` en el panel Resend. Después, reiniciar `xamuko-api` durante una ventana de mantenimiento y probar con cuentas nuevas en cada aplicación. El conector GitHub no lee ni cambia el contenido de `.env` en EC2; **no declarar Resend operativo sin prueba real**.

Al registrarse, el backend devuelve `user.verificationExpiresAt` (ISO 8601) solamente si el correo se envió sin error. El contador en Usuario/Business calcula el tiempo restante respecto de esa fecha, aunque la pestaña se refresque. Cada reenvío correcto genera un token nuevo de un solo uso e invalida en la misma transacción los enlaces anteriores de esa cuenta, aunque todavía no hayan vencido. El contador de Usuario y Business se reinicia con una nueva vigencia de 15 minutos calculada por el backend. Los enlaces emitidos antes de este despliegue también quedan sujetos al máximo de 15 minutos desde su creación: no conservan su antigua vigencia de 24 horas.

La ruta de reenvío devuelve el mismo mensaje y una fecha de vencimiento calculada del mismo modo para **cualquier correo sintácticamente válido**, exista o no una cuenta elegible. Esto evita revelar la existencia de cuentas por el contenido de la respuesta. El frontend reinicia el contador solo al recibir una respuesta satisfactoria del backend.

**Limitación pendiente:** El esquema actual continúa creando `User` y `AuthIdentity` antes de confirmar. Los 15 minutos invalidan el enlace, pero **no eliminan automáticamente el usuario no verificado** ni permiten por sí mismos repetir el registro con el mismo correo. Esto requiere una futura migración de solicitudes de registro pendientes, separada y probada antes de activarse.

## Despliegue observado el 8 de noviembre de 2026

La producción utiliza `/opt/xamuko/deploy/current/xamuko-api.env` (archivo `600 root:root`), y `systemd` carga dicho fichero. Cada release copia la configuración de la versión anterior; la ruta `current` es un symlink a la release activa. Se confirmó `EMAIL_MODE=resend` y la existencia de `RESEND_API_KEY` sin exponer el secreto. El usuario instaló las cinco variables nuevas y preservó los permisos.

El archivo de versión válido en esta instalación es `/opt/xamuko/deploy/current/backend/RELEASE_COMMIT` (no `/opt/xamuko/deploy/current/COMMIT`). Las herramientas de despliegue por GitHub Release están instaladas, pero `GITHUB_RELEASE_POLL_ENABLED` no existe y el temporizador automático está inactivo. No asumir que fusionar el PR despliega la API. Activación del polling o despliegue manual requieren verificación específica y seguimiento del estado del backend antes de validar frontend contra producción.
