# Ficha administrativa del negocio — XAMUKO 1.0

Implementación sobre `integration/preserve-all-20261029`. Referencia visual: la ficha aprobada adjunta a la solicitud. Se conservan el sidebar y el logo oficial. Los cambios se limitan a la ficha, sus consultas de Admin y las pruebas asociadas. No se modifica Business, el directorio de Negocios ni el esquema de base de datos.

## Comportamiento entregado

- Encabezado con regreso al directorio, identificación y menú con la sesión real. El cierre de sesión del menú utiliza la confirmación y el mecanismo existentes de Layout.
- Portada y perfil procedentes de almacenamiento autorizado. Galería y ampliación conservan las proporciones; miniaturas privadas se reducen en memoria y los originales siguen disponibles. Las URLs Blob se revocan al salir de la ficha. No se agregan imágenes comerciales ni datos de ejemplo a la aplicación.
- Cinco indicadores: visibilidad, verificación, completitud, plan efectivo y reportes del establecimiento. La vigencia vencida se identifica aunque el estado persistido todavía indique VISIBLE.
- Siete pestañas: Resumen, Información general, Productos y servicios, Opiniones, Fotografías, Actividad del negocio e Historial administrativo. La identidad permanece montada. Las secciones se consultan al abrirlas y conservan sus filtros al navegar; cambiar de pestaña no vuelve a consultar el negocio.
- Información general de solo lectura, propietario activo, registrador y miembros vinculados. Categoría, ubicación y contacto proceden del registro del negocio.
- Catálogo separado en Productos y Servicios, con búsqueda, publicación, activación y paginación de seis registros. Detalle de consulta; se conserva el enlace al procedimiento existente de moderación únicamente con permisos de catálogo y moderación. No se añaden controles para modificar información comercial.
- Opiniones con promedio público actual, autor público, puntuación, fechas, estado y reportes disponibles; filtros por puntuación y fecha con paginación. Una calificación no disponible no se representa como cero estrellas.
- Galería de establecimiento, portada, perfil y catálogo. Paginación de doce imágenes; el acceso al catálogo conserva su permiso específico.
- Actividad real por hora, día o mes según el período. Vistas de ficha, clics de contacto, vistas de catálogo y altas de productos, servicios y opiniones. La línea vertical se maneja con cursor, toque o teclado. Los intervalos transcurridos sin registros se representan con cero y se explica cada indicador. No se calculan visitantes únicos ni estimaciones.
- Historial paginado, motivo, observaciones, responsable y estados anterior/nuevo disponibles. Solo se exponen campos de estado pertinentes; no se devuelve indiscriminadamente el JSON de auditoría. Un responsable ausente no se sustituye por una identidad inventada.

## Seguridad y reglas conservadas

La sesión administrativa, CSRF, origen confiable, reautenticación y autorización SUPER_ADMIN de las decisiones permanecen en los endpoints existentes. No hay nuevas rutas de escritura.

Ocultar, suspender y levantar una restricción reutilizan la política vigente. La restitución **no concede días de vigencia** ni revierte un ocultamiento voluntario del propietario. Si el negocio solo está oculto por su propietario, no se ofrece una restitución administrativa inexistente. Eliminar conserva la baja lógica, la auditoría, la cuenta personal del propietario, la cancelación de transferencias y la revocación de planes. En la ficha, una eliminación exitosa actualiza los indicadores y deja disponible la consulta histórica sin acciones incompatibles.

El acceso real al panel continúa sujeto a la política existente de AdminSession: actualmente SUPER_ADMIN. No se amplía el acceso de otros roles para efectuar las pruebas o habilitar la pantalla.

## Endpoints

Todos están bajo `/api/v1/admin` y devuelven respuestas privadas sin caché.

| Método y ruta | Uso | Autorización |
| --- | --- | --- |
| GET `/businesses/:id` | Reutilizado; se amplía únicamente la ficha con miembros, promedio, conteos, posiciones de imágenes y vigencia efectiva | BUSINESSES_READ |
| GET `/businesses/:id/history` | Reutilizado; conserva el límite predeterminado de 60 y añade paginación opcional y estados filtrados | BUSINESSES_READ |
| POST `/businesses/:id/visibility` | Reutilizado sin cambiar su semántica: ocultar, suspender, restituir | SUPER_ADMIN, BUSINESSES_READ, CSRF y origen confiable |
| POST `/businesses/:id/delete` | Reutilizado sin cambiar su semántica ni confirmación ELIMINAR | SUPER_ADMIN, BUSINESSES_READ, CSRF y origen confiable |
| GET `/businesses/:id/catalog` | Nuevo: consulta paginada por tipo, nombre/código, publicación y activación | BUSINESSES_READ y CATALOG_READ |
| GET `/businesses/:id/reviews` | Nuevo: opiniones paginadas y filtros | BUSINESSES_READ y REPORTS_REVIEW |
| GET `/businesses/:id/photos` | Nuevo: metadatos de galería sin claves de almacenamiento | BUSINESSES_READ; imágenes de catálogo requieren CATALOG_READ |
| GET `/businesses/:id/photos/:photoId/content` | Nuevo: imagen original autenticada y limitada al negocio indicado | Mismos permisos que galería |
| GET `/businesses/:id/activity` | Nuevo: series y conteos del establecimiento | BUSINESSES_READ |

Identificación por UUID interno o ID público. Las consultas de actividad reutilizan las ventanas y el relleno de intervalos de `statistics.service.ts`, con zona `America/Bogota`. Los eventos de contacto no equivalen a personas únicas. Las altas por fecha incluyen registros retirados posteriormente y no se presentan como acumulados. En Todo el historial, los totales incluyen el historial completo y la gráfica se limita a los últimos 24 meses.

## Archivos principales

- `frontend/apps/admin/src/pages/AdminBusinessesPage.tsx`: conserva la exportación del directorio y delega únicamente la ficha al nuevo componente.
- `frontend/apps/admin/src/pages/businessRecord/`: pantalla, información y resumen, catálogo, opiniones, galería, actividad, historial, estilos y pruebas DOM.
- `frontend/apps/admin/src/components/businesses/BusinessRecordPhoto.tsx`: imágenes autenticadas y caché temporal de la ficha.
- `frontend/apps/admin/src/services/adminBusinessRecord.ts` y `adminApiClient.ts`: contratos y transporte con la sesión existente.
- `frontend/apps/admin/src/components/Icon.tsx`: pictogramas de información y copia.
- `backend/src/modules/admin/admin-business-record.service.ts`: nuevas consultas de solo lectura.
- `backend/src/modules/admin/admin-businesses.service.ts` y `admin.routes.ts`: información complementaria, historial y rutas protegidas.
- `backend/src/modules/admin/admin-business-record.http.test.ts`, `admin-business-record.test-fixture.ts`, `backend/scripts/check-admin-business-record.ts` y `backend/package.json`: verificaciones reproducibles e inclusión en la suite habitual.

## Verificación local ejecutada

- Admin: **86 pruebas DOM/unitarias** aprobadas. Compilación y TypeScript aprobados. Vite conserva el aviso de fragmentos grandes; no hay error de compilación.
- Backend: suite completa con **216 aprobadas, cero fallidas y una omitida** por la suite existente. La integración específica de la ficha contiene **8 pruebas** aprobadas y se incluye en `npm test`. Typecheck y build aprobados.
- TypeScript de las cuatro aplicaciones frontend aprobado.
- Chromium con sesión real y MySQL aislado: **63 combinaciones** de las siete pestañas en 1440×1000, 1920×1080, 3840×2160, 768×1024, 820×1180, 1024×768, 1180×820, 390×844 y 430×932. Sin desbordamiento de página ni cortes de palabras en ciudad/departamento. No equivale a una prueba física en Safari o un iPad real.
- Flujo de navegador aprobado: copia del ID al portapapeles; filtros y paginación; catálogo sin edición; fotografías ampliadas; guía de actividad con teclado y valor cero; historial con estados; cancelación de decisiones; ocultamiento, suspensión, cambio a ocultamiento y restitución conservando la vigencia; eliminación conservando la cuenta del propietario; actualización de plan e indicadores; logout y rechazo posterior de la ruta protegida. El menú también se comprueba a 390 px.
- Comprobación existente del sidebar aprobada en escritorio y móvil para Negocios, Inicio y Verificaciones. El directorio permanece en sus archivos actuales, sin cambios de esta entrega.

Las capturas están en `frontend/test-results/admin-business-record/` y las comprobaciones funcionales adicionales en `frontend/test-results/admin-business-record-flows/`; ambos contienen `results.json` y están excluidos de Git. Las imágenes y datos de estas pruebas pertenecen exclusivamente a fixtures identificados como pruebas aisladas. No se usaron cuentas ni datos de producción.

### Repetir las pruebas de navegador

Usar un MySQL migrado cuyo nombre incluya `test`, Chromium instalado y las dependencias del repositorio. Iniciar Vite con `VITE_ADMIN_PORT=5198 VITE_ADMIN_BACKEND_URL=http://127.0.0.1:35159 npm run dev --workspace=@wit/admin` desde frontend. Ejecutar desde backend `node --import tsx scripts/check-admin-business-record.ts` con `NODE_ENV=test`, DATABASE_URL de pruebas, AUTH_ACCESS_TOKEN_SECRET de pruebas y `AUTH_TRUSTED_ORIGINS=http://localhost:5198`. El script levanta su backend, crea fixtures aislados y elimina sus registros y archivos al terminar. `--flows-only` repite las operaciones sin regenerar las 63 capturas.

## Publicación

Frontend y backend deben recibir esta versión para habilitar las consultas completas. No requiere una migración nueva de esta entrega; el servidor debe conservar las migraciones previas ya exigidas por integración. La publicación y las pruebas locales no certifican por sí solas la versión desplegada: verificar las comprobaciones del commit y el resultado efectivo del despliegue por separado.
