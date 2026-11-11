# Auditoría inicial SEO XAMUKO — 2026-11-11

Base: `integration/preserve-all-20261029`, commit `c5521ec`. Rama de trabajo: `perf/auth-registration-seo`. Estado inicial limpio. Ningún cambio en Admin, backend, base de datos o autenticación.

## Evidencia anterior a la implementación integral

- Landing: HTML inicial con title, description, canonical `https://xamuko.com/`, OG parcial y WebSite JSON-LD; `#root` vacío. No SSR/prerender. Preload de `reference-art.jpg` aunque React utiliza `reference-art-4k.webp`: descarga duplicada. No robots/sitemap en el proyecto.
- Usuarios: index.html con título genérico, sin descripción, canonical, OG, Twitter, robots ni sitemap. Todo el contenido depende de JavaScript. Registro carga inicialmente ~701 kB JS y ~405 kB CSS sin comprimir, además de un logo PNG de 573 kB.
- Business: index.html con título genérico, sin descripción, canonical, OG, Twitter, robots ni sitemap. No existe una página pública informativa independiente: `/` redirige a `/inicio`, protegido por AppShell. Registro carga ~908 kB JS y ~495 kB CSS sin comprimir.
- Comprobaciones HTTP sin credenciales: `https://xamuko.com/` devuelve HTML de 2029 bytes con root vacío; `https://user.xamuko.com/robots.txt` y `https://business.xamuko.com/sitemap.xml` devuelven el HTML de la SPA, no robots/XML. El API público responde sin autenticación y contiene tres negocios al auditarlo; no se guardan nombres ni contactos en este informe.
- No hay configuración Cloudflare versionada, Workers ni Pages Functions en estas aplicaciones. No hay conector Cloudflare disponible: no se han confirmado reglas de cuenta, caché, redirección `www` o rama de producción. Los encabezados y respuestas públicas son evidencia de comportamiento externo, no de permisos sobre la cuenta.

## Rutas y datos

- Landing `/`: pública informativa, indexable. Secciones `#usuarios`, `#negocios`, `#planes`, `#preguntas` son fragmentos de la misma página, no páginas canónicas separadas.
- Usuarios `/business/:id`: pública, obtiene la ficha exclusivamente del API público. Adecuada para SEO local cuando tiene contenido suficiente. Parámetros `tab`, `source`, `ref` no deben generar duplicados. `preview`, `demoCatalog` y estados de error no deben indexarse.
- Usuarios `/product/:id`, `/service/:id`: rutas reales públicas. El componente empieza con catálogo de demostración y después intenta resolver un registro real. Solo deben emitirse metadatos indexables después de confirmar datos públicos reales. No existe endpoint público directo por ID de oferta: el cliente consulta negocios y sus catálogos; es una limitación de escalabilidad existente.
- `/business/:id/products` y `/business/:id/services` usan listas del catálogo de demostración: no aptas para indexación hasta que se conecten a datos reales (fuera del alcance SEO).
- `/home`, `/results`, `/search`, `/map`, `/filters`, ubicación y búsquedas con filtros: contenido variable/personalizado. No se crearán páginas masivas de ciudad o categoría.
- Perfil, cuenta, favoritos, notificaciones, panel Business, colaboradores y configuración: noindex, conservando exactamente los controles de acceso actuales.
- Registro, login, recuperación, verificación y callback OAuth: noindex por la política aprobada en el prompt integral.

## Publicación y privacidad existentes

Inspección de `backend/src/modules/public-business/public-business.service.ts`: el API público filtra `PUBLISHED`, `VISIBLE`, períodos vigentes y contenido permitido al visitante; dirección y coordenadas se anulan cuando `location.visibility !== PUBLIC`. Los controladores aceptan autenticación opcional, por lo que el SEO del servidor debe consultar SIN cookies ni Authorization. No se usarán endpoints administrativos ni datos de cuentas.

## Estrategia compatible

Prerenderizar el contenido real React de la landing. Generar metadatos estáticos de las rutas de autenticación; resolver metadatos/HTTP/sitemaps públicos mediante un Worker de Pages en el artefacto de Usuarios, sin cambiar API o infraestructura. Mantener idéntico tratamiento para visitantes y rastreadores. El cuerpo de las fichas dinámicas continuará dependiendo del renderizado JavaScript; documentar SSR/hidratación de fichas como siguiente fase, sin migrar de framework ni simular contenido oculto.
