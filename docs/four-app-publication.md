# Publicación independiente de las cuatro aplicaciones (pendiente de autorización)

Esta preparación no activa sitios. No cambia backend, BD, DNS, Nginx, certificados,
workflow de staging, scripts de despliegue ni polling. La publicación actual sigue
usando `apps/usuario/dist` como `web`; los nuevos paquetes no son consumidos por ella.

## Construcción y revisión

Desde `frontend`, con Node 24 y las dependencias de `npm ci` instaladas:

```
npm run typecheck
npm run test:publication
npm run package:publication
```

Se generan `dist/publication/release-*/{landing,usuario,business,admin}.tar.gz`
y un manifest con SHA de código y SHA-256 de cada archivo. Cada paquete contiene
`index.html` en su raíz y sus propios assets. Se compilan en directorios separados,
sin sobrescribir los dist usados por el despliegue actual; un fallo elimina el lote.
No incluyen código del backend ni archivos .env. Los valores VITE se incorporan al
JavaScript público: nunca usar RESEND_API_KEY ni otros secretos en esas variables.
Construir desde un checkout limpio del commit aprobado; conservar manifest y paquetes.

## Destinos propuestos, aún no activados

| Aplicación | Origen propuesto | Workspace |
| --- | --- | --- |
| Landing | https://xamuko.com y https://www.xamuko.com | @wit/landing |
| Usuario | https://user.xamuko.com | @wit/usuario |
| Business | https://business.xamuko.com | @wit/negocios |
| Admin | https://admin.xamuko.com | @wit/admin |

Son destinos acordados para preparar la publicación, no evidencia de dominios activos. Landing usa
los dos destinos anteriores en builds de producción; permite sustituirlos mediante
VITE_USUARIO_PUBLIC_URL y VITE_BUSINESS_PUBLIC_URL. En desarrollo conserva
127.0.0.1:5173 y 127.0.0.1:5174 y las rutas existentes de acceso/registro.
Cada aplicación asume alojamiento en la raíz de su propio origen, no subcarpetas.

Antes de autorizar activación, confirmar los dominios, rutas de API, CORS, cookies,
OAuth y retorno de login para cada origen. Revisar las variables públicas de cada
app (API, Maps y URLs de compartir) sin reutilizar secretos del servidor. Los paquetes
no preparan ni alteran esas dependencias. Probar en un entorno aislado: HTML, assets,
recarga de rutas SPA, login/logout, Google OAuth, catálogo y enlaces de Landing.
El servidor futuro debe resolver rutas SPA al index de la aplicación correspondiente
y encaminar /api/v1 al backend existente. Eso requiere revisión separada.

## Activación futura y reversión

No hacer merge de este PR como autorización implícita de publicación. El polling
actual continúa publicando Usuario desde staging y no sabe activar cuatro paquetes.
No sustituir esa automatización en este trabajo.

Tras una autorización explícita separada, el responsable debe registrar el estado
previo de cada sitio, sus rutas y configuración, conservar sus archivos y assets,
verificar hashes del manifest y preparar cada versión fuera de los directorios activos.
Acordar primero cómo convivirá la activación con el polling existente; no activar
manualmente algo que el siguiente ciclo pueda sobrescribir. Aprobar por separado
cualquier cambio de infraestructura que sea necesario.

Cambiar cada sitio a su versión aprobada solo dentro de ese procedimiento autorizado,
comprobar rutas y autenticación y registrar los resultados. Si falla un sitio, volver
su referencia a la versión previa y restaurar su configuración previamente guardada;
verificar HTML, assets, rutas profundas y login. Mantener los assets anteriores durante
la transición. Esta reversión es solo de archivos/configuración de frontend, sin
migraciones ni rollback de base de datos. Revertir el PR no restaura un sitio activado:
se necesitan los archivos y la configuración previa. La prueba real de activación y
reversión queda pendiente del entorno aislado y de la autorización correspondiente.

## Verificaciones de EC2 pendientes

El inventario, los comandos de solo lectura y los criterios de comprobación están en
[ec2-pending-verification.md](ec2-pending-verification.md). Ningún resultado de CI
confirma la versión activa en EC2 ni una restauración real.

La revisión de pantallas, autenticación y condiciones previas a la activación está en
[frontend-auth-publication-review.md](frontend-auth-publication-review.md).
