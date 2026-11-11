# SEO público de XAMUKO

## Alcance y política

Consultar [la auditoría anterior a la implementación](auditoria-inicial.md). No se han modificado Admin, backend, API, base de datos, autenticación, permisos, sesiones, validaciones o handlers de formularios. Los archivos originales de marca e ilustraciones se conservan. No hay dependencias nuevas.

| Página | Política |
| --- | --- |
| `https://xamuko.com/` | Indexable; canonical raíz; contenido React prerenderizado |
| `https://user.xamuko.com/business/:publicId` | Indexable solo si el API anónimo devuelve una ficha pública útil |
| Ficha con preview, demo, parámetros sensibles, datos insuficientes o error | Noindex; canonical sin query; 404 si no existe o no está publicada; 503 con Retry-After para errores temporales |
| `/product/:id`, `/service/:id` | Metadatos descriptivos solo tras consulta real; noindex en esta fase, por la resolución indirecta por catálogo y los estados iniciales de demostración |
| `/business/:id/products`, `/business/:id/services` | Noindex: las listas existentes usan catálogo de demostración |
| Búsqueda, filtros, mapa, ubicación, home personalizado | Noindex; no se crean páginas por ciudad o categoría |
| Registro, login, recuperación, verificación y callback OAuth | Noindex; no se bloquea su rastreo en robots |
| Cuenta, perfiles personales y paneles Business | Noindex; se conservan los controles existentes de acceso |
| Landing `#usuarios`, `#negocios`, `#planes`, `#preguntas` | Fragmentos de la misma URL canónica, sin sitemap duplicado |

## Implementación

### Landing

- Título y descripción alineados con el descubrimiento comercial local, no con checkout o comercio electrónico.
- Canonical `https://xamuko.com/`, OG/Twitter completos y recurso oficial de 1200×630 para compartir.
- JSON-LD `Organization` y `WebSite`, sin cifras, reseñas ni SearchAction que no exista.
- Prerender de **la misma aplicación React** durante el build: contenido real visible sin JavaScript, sin reconstruir la página como imagen o introducir contenido oculto para robots.
- Hidratación del árbol prerenderizado en la URL canónica de producción. Las entradas por fragmento y el desarrollo local conservan el montaje/navegación existentes para evitar discrepancias iniciales.
- Corrige el preload obsoleto de `reference-art.jpg`: precarga el WebP de alta resolución que realmente se utiliza. No se amplía, degrada o regenera la ilustración.

### Usuarios

- El build añade un Worker de Cloudflare Pages avanzado (`dist/_worker.js`) y `_routes.json`, restringido a `/business/*`, `/sitemap.xml` y `/sitemaps/*`. El resto del sitio sigue utilizando Assets y React como antes.
- Para una ficha, consulta únicamente `https://api.xamuko.com/api/v1/public/businesses/:id`, **sin Cookie ni Authorization**, para todos los visitantes, sin distinguir bots. Inserta title/description/canonical/OG/JSON-LD en el HTML antes de enviarlo.
- No cambia el cuerpo, diseño o controles de la ficha. El cuerpo dinámico todavía se carga con JavaScript. El estado de carga del cliente conserva los metadatos correctos del servidor; no introduce un noindex transitorio en una ficha pública válida.
- Errores reales 404/503 y `X-Robots-Tag`; no se convierten fallos de transporte en una ficha vacía con HTTP 200. El Worker no almacena en caché fichas o respuestas de API: se evita mantener contenido retirado en caché propia.
- Canonical por ID público sin `tab`, `ref`, `source`, tokens ni parámetros arbitrarios. Previews noindex y sin sitemap en hosts de preview.
- `LocalBusiness`, `PostalAddress`, `GeoCoordinates`, `OpeningHoursSpecification` y `BreadcrumbList` solo con campos públicos presentes. Coordenadas y dirección exacta requieren visibilidad PUBLIC. Se omiten AggregateRating, precios, disponibilidad y campos personales. Se valida y escapa texto no confiable; se rechazan URLs con credenciales o parámetros sensibles para imágenes/enlaces de schema.
- Metadatos del cliente sincronizados al navegar internamente, sin duplicar etiquetas y con limpieza al salir de la ruta.

### Business y acceso

- No existe una página pública informativa Business independiente. Se mantiene la sección de negocios de la landing como destino informativo indexable; no se crean páginas comerciales.
- HTML por ruta para registro, login y recuperación con metadatos reales de cada aplicación y noindex desde el HTML inicial. El login de Usuarios comparte `/register?mode=login`: noindex también desde el documento base; React actualiza su título sin alterar el modo o la URL existentes.
- Sitemap de Business **no generado**, al no existir páginas públicas indexables. Robots permite leer el noindex, no anuncia un sitemap vacío ni protege paneles.
- Campos, validaciones, llamadas y handlers del formulario permanecen idénticos; se comparó el JSX completo de cada `<form>` con `c5521ec`. Cambios semánticos de encabezado fuera del formulario conservan sus estilos: un H1 visible también en móviles.

### Rendimiento y accesibilidad

- Pantallas ajenas al registro se cargan por ruta con React.lazy/Suspense. Los providers y guards se conservan.
- Logos WebP sin pérdida, con tamaños 320/640/960 y original 2170, conservando los archivos PNG y la proporción. Se comprobó identidad de píxeles en la conversión completa; variantes pequeñas solo para densidades adecuadas.
- La ilustración decorativa de Usuarios no se descarga cuando está oculta en móvil; se conserva la variante nítida para escritorio/alta densidad. Preconexión a los hosts de la fuente existente, que ya usa font-display:swap.
- Foco, etiquetas, autocompletado, enlaces legales, recuperación, Google, consentimientos y estados de error/carga se conservan.

## Sitemaps

- `https://xamuko.com/sitemap.xml`: URL raíz canónica, sin lastmod inventado.
- `https://user.xamuko.com/sitemap.xml`: índice dinámico.
- `https://user.xamuko.com/sitemaps/businesses-N.xml`: lotes de 20 fichas obtenidas del catálogo **anónimo** publicado/visible, con contenido suficiente; URLs absolutas y únicas por lote.
- No se serializan respuestas completas del API, contactos, emails, sesiones o parámetros del visitante. No se usa createdAt como lastmod. El API no publica una fecha de modificación significativa; se omite lastmod.
- Los fallos del API devuelven 503/Retry-After, no un sitemap exitoso vacío. No se usan endpoints administrativos ni credenciales.
- Se respeta el rate limit existente; cada sitemap de lote necesita una sola consulta pública, sin N+1.

## Validación y límites

Se documentan resultados locales en el PR. Los recursos iniciales sin comprimir se midieron con Chromium sobre builds, viewport de 390 px, caché vacía y fuentes externas omitidas de forma idéntica antes/después; las API se simularon para no crear cuentas o sesiones reales:

| Registro | Antes | Después | Reducción |
| --- | ---: | ---: | ---: |
| Usuarios | 1.794 MB | 0.505 MB | 71.8% |
| Business | 1.985 MB | 0.602 MB | 69.7% |

Son mediciones de recursos, **no puntuaciones Lighthouse ni datos de campo de LCP/INP/CLS**. Los tamaños finales pueden variar ligeramente con el código SEO. Se conservaron dimensiones, posiciones y fuentes de los campos frente al baseline. Navegador: 320, 390, 768, 1440 y 3840 px, sin overflow ni errores JS en los registros. Capturas y resultados en `/workspace/artifacts/auth-registration-seo/`.

Pruebas automatizadas: formularios de Usuarios/Business, flujo de login/registro con mocks, consentimiento, Google, errores, recuperación, canonical/noindex, limpieza de metadatos, HTML de build, JSON-LD, XSS, privacidad de ubicación, Worker 200/404/503, exclusión de previews y sitemaps. Un resultado JSON-LD válido no implica aprobación de resultados enriquecidos de Google.

Pendiente de una preview autorizada y de la integración posterior:

1. El artefacto avanzado de Pages y ASSETS ya se comprobaron en la preview indicada abajo. Tras una integración/publicación autorizada, repetir URLs limpias, Worker, sitemaps en host canónico y cabeceras de producción; no publicar únicamente assets estáticos. No se ha publicado en producción.
2. Reglas de cuenta Cloudflare, DNS, redirección `www`, caché, robots externos y posibles cabeceras globales X-Robots-Tag no se pudieron inspeccionar por falta de acceso confirmado a la cuenta. El comportamiento HTTP actual sí fue auditado. No se modificó infraestructura.
3. Medir Lighthouse/Rich Results Test y Core Web Vitals sobre la preview/URL publicada. No se han ejecutado los validadores externos de Google ni se afirma indexación.
4. SSR/hidratación completa de fichas dinámicas: fase posterior compatible con Vite + React y un renderer público común. Requiere revisar providers que hoy dependen del navegador y obtener todos los datos públicos en servidor; no se sustituyó contenido por HTML oculto ni se migró de framework.
5. Productos/servicios: solicitar autorización separada para un endpoint público directo por ID que aplique los mismos filtros de publicación. Después habilitar SSR, indexación y sitemaps de ofertas reales; no indexar el catálogo de demostración actual.
6. Ciudades/categorías: fase posterior de producto, con datos reales suficientes, contenido útil y rutas aprobadas. No generar páginas masivas/vacías.
7. Vigilar crecimiento del catálogo, cambios entre páginas durante publicación y límites del API. Si excede 1 millón de fichas, dividir índices adicionales antes de alcanzar 50 000 sitemaps.

## Google Search Console (preparación, no configuración confirmada)

1. Preferir la propiedad **Dominio `xamuko.com`**, que cubre los tres subdominios y protocolos. Verificación mediante TXT de Google en Cloudflare DNS: requiere autorización explícita; no se agregó ningún registro.
2. Como alternativa, propiedades de prefijo `https://xamuko.com/`, `https://user.xamuko.com/` y, solo para vigilar exclusiones, `https://business.xamuko.com/`. Son verificables mediante archivo HTML estático en public/ o meta de verificación, usando el valor que proporcione Google; no se inventaron valores. Revisar las reglas de asociación de sitemaps si se utilizan propiedades separadas.
3. Tras validar el despliegue, enviar los dos sitemaps canónicos de Landing y Usuarios. No enviar registro, login, perfiles personales ni sitemap de Business vacío.
4. En Inspección de URL, revisar landing y una ficha pública real: prueba en vivo, respuesta HTTP, HTML renderizado, recursos bloqueados, canonical declarado/seleccionado y noindex. Solicitar indexación solo después de resolver errores.
5. Supervisar "Rastreada/descubierta, actualmente sin indexar", duplicadas/canonical, soft 404, 5xx/429, recursos bloqueados, exclusión correcta por noindex y URLs retiradas. Revisar LCP/INP/CLS y mejoras de datos estructurados. No solicitar indexación de rutas privadas o previews.

No hay Search Console conectado ni evidencia de páginas nuevas indexadas. No se han enviado sitemaps ni solicitado indexaciones.

## Entrega

Rama `seo/public-ecosystem`, base `integration/preserve-all-20261029`. Lista completa en [archivos-modificados.md](archivos-modificados.md). No fusionar ni publicar hasta revisar el PR y verificar una preview. Compilaciones completas de Landing, Usuarios y Business exitosas; 103 pruebas automatizadas exitosas en total (75 Usuarios, 11 formulario Business, 6 servicios Business, 6 Landing y 5 sobre los artefactos construidos). Las pruebas de login/registro utilizan mocks; no se han creado cuentas, enviado correos o iniciado sesiones reales.

## Preview y CI verificadas

Código funcional verificado: `cb57b2d`, PR [#302](https://github.com/WIT-Colombia/WIT/pull/302), sin fusionar.

- [Landing](https://557fc069.xamuko-landing.pages.dev/): HTTP 200; contenido React prerenderizado presente en el HTML inicial y título SEO correcto.
- [Usuarios](https://495dcf0a.xamuko-usuario.pages.dev/register): HTTP 200 y noindex. Una ficha real consultada desde el API anónimo a través del Worker devolvió HTTP 200, canonical oficial y LocalBusiness en el HTML inicial. El host de preview lleva noindex; `/sitemap.xml` devuelve 404 allí deliberadamente para no exponer índices de previews.
- [Business](https://b186ac63.xamuko-business.pages.dev/registro): HTTP 200, título específico y noindex.
- El Worker utiliza `redirect: manual`: `redirect: error` no está implementado por Cloudflare Workers. Se rechazan los 3xx en lugar de seguirlos, con encabezados públicos explícitos y sin copiar cookies/Authorization del visitante.
- La consulta posterior a `https://user.xamuko.com/register` seguía devolviendo el documento anterior (sin estos nuevos metadatos): no se ha publicado en producción.
- GitHub **Frontend validation: success**, y construcciones Pages de las tres aplicaciones autorizadas exitosas. Dos workflows de backend continúan fallando por tipado `BusinessWhereInput`/`publicationStatus` en código no modificado; no se corrigieron archivos backend ajenos al alcance SEO.
- Estas pruebas HTTP de preview verifican los metadatos y el acceso servidor→API. El login/registro con credenciales reales, CORS de sesiones sobre previews y los validadores externos de Google no se han dado por probados.
