# XAMUKO Admin: espacios de trabajo y archivo documental

Rama: `integration/preserve-all-20261029`. Esta entrega conserva los 33 nombres, rutas y grupos de navegación, el logo oficial, la sesión administrativa y las fuentes de datos existentes. Solo Admin recibe cambios visuales.

## Diseño y alcance funcional

Paleta: azul noche `#0F172A`, violeta `#7B3FFB`, azul `#2563EB`, fondo `#F8FAFC` y verde `#22C55E`. Todas las rutas reciben una cabecera contextual y estilos compartidos para encabezados, paneles, tablas, filtros y estados. Los textos y controles son HTML. El recurso de cabecera tiene variantes WebP de 960 × 540 y 3840 × 2160; el archivo 4K es una exportación remuestreada de una ilustración generada de 1672 × 941, no una fuente nativa 4K.

| Área | Pestañas | Función conservada o añadida |
| --- | --- | --- |
| Inicio | Inicio | Indicadores y actividad desde servicios existentes. |
| Plataforma | Negocios, Usuarios, Contenido, Opiniones, Negocios Pioneros | Directorios, consulta y operaciones existentes. |
| Crecimiento | Planes y suscripciones, Business PRO, XAMUKO Plus, Promociones, Referidos | Diseño por módulo; resumen, flujo previsto y conexiones. Integraciones aún pendientes, sin registros ficticios. |
| Finanzas | Ingresos y facturación, Transacciones, Reembolsos | Diseño por módulo; integraciones aún pendientes. |
| Finanzas | Gastos tecnológicos | Resumen de consumos y proveedores desde datos reales; secciones y estados vacíos renovados; edición accesible con campos en español y motivo obligatorio. Se corrige la exigencia accidental de un token de Usuarios: usa AdminSession y conserva FINANCE_READ/FINANCE_MANAGE, CSRF y origen confiable. |
| Tecnología | Estado de servicios, Despliegues, Necesidades | Diseño por módulo; integraciones aún pendientes. |
| Soporte | Verificaciones, Necesidades de usuarios, Reportes de negocios, Reportes de productos, Reportes de comentarios, Mensajes de soporte, Sugerencias | Bandejas y acciones existentes conectadas a su API. |
| Jurídica | Documentos legales, Estatutos, Procesos judiciales | Archivo privado PDF: adjuntar, buscar, consultar página a página, descargar, eliminar con motivo y restaurar. Procesos judiciales gestiona documentos, no estados procesales ni plazos judiciales. |
| Configuración | Zonas y categorías, Parámetros, Auditoría | Diseño por módulo; integraciones aún pendientes. |
| Configuración | Categorías, Administradores y accesos | Catálogo y accesos existentes. |

Resultado: 19 pestañas con servicios operativos y 14 con integración pendiente. Un diseño completo no implica que los 14 servicios pendientes estén implementados.

## Activación del archivo documental

El frontend y el backend deben actualizarse juntos para habilitar las tres secciones documentales. Un backend anterior muestra un aviso de actualización requerida, sin presentar una lista vacía como si fuera válida.

1. Generar Prisma, compilar y aplicar el procedimiento habitual de migración del backend (`npx prisma migrate deploy`). La nueva migración `20261115140000_admin_documents` crea una tabla independiente y su relación con el usuario que adjuntó el archivo; no elimina ni transforma registros existentes.
2. Configurar **una** opción de almacenamiento persistente antes de habilitar cargas:
   - Local: `ADMIN_DOCUMENT_STORAGE_BACKEND=local` y `ADMIN_DOCUMENT_STORAGE_DIR` como ruta absoluta privada, persistente entre releases y escribible solo por el usuario del servicio. Nunca debe pertenecer a `public/`, una raíz estática ni a un directorio de release descartable. Los subdirectorios se crean con modo 0700 y los archivos con 0600.
   - S3: `ADMIN_DOCUMENT_STORAGE_BACKEND=s3`, `ADMIN_DOCUMENT_S3_BUCKET` explícito y `AWS_REGION`. El bucket debe bloquear todo acceso público, no tener políticas públicas y no estar conectado a una distribución pública. El rol del backend necesita `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` únicamente en `arn:aws:s3:::BUCKET/admin-documents/*`. DeleteObject se usa solo para retirar una carga nueva cuya transacción de registro falló. Se usa cifrado AES256, sin ACL pública. No se reutiliza automáticamente el bucket de fotografías.
3. Mantener respaldo coherente de base de datos y objetos. No configurar un ciclo de vida que elimine documentos activos o en papelera sin una política de conservación acordada.
4. Verificar con una cuenta SUPER_ADMIN autorizada: carga, consulta, descarga, papelera y restauración. Comprobar que una petición sin sesión devuelve 401. No registrar cookies, tokens ni contenido de documentos en logs.

El almacenamiento local de producción sin ruta explícita y S3 sin bucket documental fallan de forma cerrada (503). La entrega no establece credenciales, políticas de bucket ni variables de producción automáticamente.

## Seguridad y comportamiento

- Solo SUPER_ADMIN con ADMINS_MANAGE puede gestionar documentos. Se conserva la reautenticación y el CSRF de AdminSession.
- PDF de hasta 10 MB: validación de tipo, nombre, cabecera y cierre. Esta comprobación de formato no sustituye un análisis antivirus. El visor PDF.js no ejecuta acciones, formularios ni scripts del PDF; recursos y worker se sirven desde el propio sitio, sin CDN.
- Los documentos se recuperan por una ruta autenticada con `private, no-store`; no se entregan claves de almacenamiento ni URLs públicas. Se comprueba SHA-256 antes de servir contenido.
- La consulta usa un Blob temporal revocado al cerrar. El visor se carga solo al abrir un documento, ajusta el ancho al dispositivo y expone el texto extraído para lectores de pantalla. Los PDF escaneados conservan su imagen; no se añade OCR.
- Eliminar significa **mover a papelera**, con motivo obligatorio de 10–500 caracteres. No existe borrado irreversible en esta entrega. Una entrada en papelera no permite leer el contenido hasta restaurarla.
- Carga, eliminación y restauración generan auditoría dentro de la misma transacción que el cambio de metadatos.

## Comprobación reproducible

- `cd frontend && npm run test --workspace=@wit/admin`.
- `cd frontend && npm run build --workspace=@wit/admin` (incluye TypeScript).
- `cd backend && npm run typecheck && npm test`, con las variables de pruebas de `.github/workflows/backend-ci.yml` y MySQL migrado aislado.
- `backend/scripts/check-admin-workbench.ts` comprueba sesión real, los tres archivos documentales, PDF renderizado, descarga, cancelación, papelera, restauración, búsqueda, 33 rutas en 1440/820/390 px, diálogo a 320 px y logout que impide volver a una ruta protegida. Solo acepta una base cuyo nombre contenga `test` y rechaza NODE_ENV=production. Necesita Chromium y las dependencias de frontend/backend.
- Para el navegador, iniciar Vite Admin con `VITE_ADMIN_PORT=5197 VITE_ADMIN_BACKEND_URL=http://127.0.0.1:35158`. Ejecutar el script desde backend con `NODE_ENV=test`, una DATABASE_URL de pruebas y `AUTH_TRUSTED_ORIGINS=http://localhost:5197`. El script levanta su backend, crea una cuenta aislada y elimina sus propios registros y archivos al terminar. Las capturas y `results.json` quedan en `frontend/test-results/admin-workbench/`, excluido de Git.

La comprobación local no certifica la configuración de almacenamiento ni el despliegue de producción. Confirmar ambos por separado con evidencia del servicio de despliegue.

## Resultados locales

- Admin: 65 pruebas aprobadas y compilación con TypeScript aprobada. El visor PDF se distribuye como carga diferida; Vite avisa de un fragmento de aproximadamente 503 kB, sin error de compilación.
- TypeScript de las cuatro aplicaciones frontend: aprobado. Backend: typecheck y build aprobados.
- Suite backend completa con configuración de CI: 168 aprobadas, ninguna fallida y una omitida por la suite existente. Verificación documental HTTP específica: 6 aprobadas.
- Navegador con sesión, archivos y registros reales de una base aislada: flujo documental de las tres secciones aprobado; resolución de soporte y edición financiera auditada aprobadas; 99 combinaciones de ruta/tamaño sin desbordamiento horizontal; siete secciones financieras navegables; consulta PDF y formulario a 320 px; cancelación de logout, cierre y acceso protegido posterior aprobados.
- Comprobación existente del sidebar: escritorio y móvil aprobados en Negocios, Inicio y Verificaciones.
- `npm audit --audit-level=high` en frontend: cero vulnerabilidades.

Las capturas usan una cuenta y registros identificados como pruebas aisladas. No contienen documentos ni datos personales de producción.
