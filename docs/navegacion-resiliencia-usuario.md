# Resiliencia de navegación en Usuarios

## Alcance

El Home se incluye en la carga inicial. Las demás rutas siguen cargándose bajo demanda. Un límite de errores alrededor de las rutas muestra una opción de reintento si falla el renderizado. Para errores reconocibles de descarga de módulos o CSS se intenta como máximo una recarga automática por pestaña cada diez minutos, solamente en rutas públicas de exploración. No se recarga automáticamente en rutas de formularios, con ciertos parámetros sensibles, cuando hay controles modificados o cuando el almacenamiento de sesión no está disponible. La opción manual recarga la página por decisión del usuario.

El mensaje de consola no contiene URL, parámetros, identificadores ni datos de formularios. No existe aquí un servicio de telemetría conectado: estos avisos por sí solos no permiten medir incidentes agregados en producción. La comprobación de campos modificados reduce el riesgo de perder texto, pero no puede detectar todo el estado guardado exclusivamente en memoria. Una recarga puede restablecer ese estado.

## Caché y Cloudflare

No se modificó la configuración remota ni se añadió un service worker. Según la [documentación de Cloudflare Pages](https://developers.cloudflare.com/pages/configuration/serving-pages/), la respuesta estática cacheable utiliza por defecto `max-age=0, must-revalidate`, y los assets de despliegues anteriores pueden desaparecer en cualquier momento; no se debe asumir que se conservan durante una semana. Los encabezados de `_headers` tampoco se aplican a respuestas generadas por el [Worker de Pages](https://developers.cloudflare.com/pages/configuration/headers/). El Worker de SEO ya establece `Cache-Control: no-store` para las fichas de negocio que genera.

Antes de cambiar la caché hay que comprobar en una vista previa los encabezados efectivos del HTML en `/`, `/home`, rutas de autenticación y `/business/:id`, además de JS y CSS existentes y ausentes. También hay que identificar y probar la política de retención y reversión del proyecto real. Dar caché inmutable a una respuesta HTML de error servida bajo una ruta de asset podría prolongar una falla.

## Límites y seguimiento

- La causa de los incidentes intermitentes no se ha confirmado con registros de producción. Un fallo de chunk es una hipótesis, no un diagnóstico.
- Si falla el archivo principal antes de que React arranque, el límite de errores no puede ejecutarse. Tampoco corrige fallos de red, autenticación, backend o del Worker.
- La compilación local genera un archivo principal de aproximadamente 540 kB minificados (148 kB gzip). Cargar Home de forma anticipada aumenta el trabajo inicial para otras rutas; evaluar rendimiento real en dispositivos y conexiones lentas antes de promoverlo.
- No se han cambiado las consultas de catálogo, publicidad, ubicación ni autenticación. Su aislamiento ante fallos debe evaluarse por separado con escenarios reales.
- No se ha probado la capacidad para un millón de usuarios. Se necesitan métricas, escenarios de concurrencia y pruebas de carga controladas en un entorno preparado.

## Verificación y reversión

Ejecutar `npm run build` y `npm test` en `frontend/apps/usuario`. Verificar en una vista previa una navegación normal, una descarga de módulo rechazada, la ausencia de bucles de recarga, un formulario con datos pendientes y la recuperación con el botón. El PR puede revertirse con `git revert -m 1 <commit-de-merge>` cuando se haya fusionado mediante un commit de merge; antes de fusionar, basta cerrar el PR.
