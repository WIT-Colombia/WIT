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

En esta instalación, el archivo real es `/opt/xamuko/api/backend/.env` y permanece fuera del artefacto de Git, con permisos restringidos. La preparación segura consiste en editar ese archivo desde una sesión SSM autorizada, conservar todas las variables existentes y establecer únicamente `EMAIL_MODE=resend` y `EMAIL_FROM="XAMUKO <notificaciones@xamuko.com>"`; la clave se añade como `RESEND_API_KEY` sin mostrarla en la consola. Después se debe validar el formato, reiniciar `xamuko-api` durante una ventana acordada y comprobar `/api/v1/health`. No se debe poner la clave en GitHub Actions porque el transporte actual de despliegue por polling no la necesita.

La consulta DNS pública observada el 28-10-2026 muestra SPF de Hostinger (`include:_spf.mail.hostinger.com`), MX de Hostinger y un registro TXT en `resend._domainkey.xamuko.com`. No se puede confirmar desde DNS si ese DKIM corresponde al proyecto Resend; hay que comparar el valor que muestra Resend. No se modificó DNS.

## Webhooks y recuperación

Resend ofrece eventos `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained` y `email.failed`, con firma del webhook. El siguiente paso seguro es crear un endpoint HTTPS que valide `svix-id`, `svix-timestamp` y `svix-signature`, registre solo `event`, `email_id`, estado y destinatario anonimizado, y responda rápidamente. La URL y el secreto de firma deben configurarse en Resend y en producción mediante autorización explícita; no se activan en esta rama.

Ante un fallo de entrega: revisar el evento en Resend, corregir dominio/remitente o dirección, volver a emitir el enlace desde la interfaz y no reintentar manualmente a ciegas. Para recuperar una regresión, volver al commit anterior de la rama de despliegue; la configuración de secretos permanece fuera de Git.

## Variables pendientes

No se encontraron secretos ni variables de Actions con `gh secret list`/`gh variable list`. Por tanto, el código está listo pero el repositorio no demuestra que producción tenga `RESEND_API_KEY` ni `EMAIL_MODE=resend`. No se hicieron cambios de credenciales, DNS, facturación ni producción.
