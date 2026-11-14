# Reportes de productos y servicios — implementación y activación

## Código implementado (2026-11-13)

- En XAMUKO Usuarios, la ficha de cada producto o servicio abre `/report?type=product|service&id=...`.
- El botón **Enviar reporte** llama `POST /api/v1/public/offers/:offerId/reports`. Únicamente informa «Reporte recibido» cuando la API devuelve HTTP 201 y un ID real.
- El formulario valida el motivo y permite hasta 500 caracteres de descripción opcional; los errores del servidor se muestran sin descartar el texto.
- En MySQL los reportes se almacenan en `OfferReport` (Prisma) con motivo, descripción, fecha, estado y referencias a oferta y reportante (cuando existe).
- `GET /api/v1/admin/offer-reports` requiere una sesión administrativa con permiso `REPORTS_REVIEW`. Devuelve registros persistidos, totales, filtros y paginación.
- Admin → Atención y soporte → Reportes de productos consulta esa API; permite filtrar y ver el detalle de productos y servicios.
- El formulario de negocios ya existente se conserva. Los formularios legados de opiniones/negocios en `/report` no se migran por este cambio.

## Activación en producción — requiere procedimiento autorizado

**Implementado en el repositorio no equivale a desplegado ni a operativo en producción.**

El despliegue seguro de XAMUKO incluye una validación en `deploy/deploy.sh` que rechaza cambios en `backend/prisma` frente a la versión activa con el mensaje **"Prisma changes require manual review"**. Este control es intencional; NO debe desactivarse por esta funcionalidad.

1. Revisar y aprobar la nueva migración `backend/prisma/migrations/20261114000000_offer_reports/migration.sql` (una tabla nueva con claves foráneas e índices).
2. Crear un respaldo verificable de la base de datos de producción según el procedimiento operacional.
3. Probar `npx prisma migrate deploy`, `npm run prisma:generate`, `npm run typecheck` y las pruebas automáticas primero en un entorno seguro con MySQL 8.4.
4. Aplicar la migración en producción mediante el procedimiento de base de datos autorizado y llevar a cabo el despliegue **revisado** del backend. El proceso de publicación deberá conciliar el resguardo de cambios Prisma entre versiones sin suprimir el control de seguridad.
5. Publicar las versiones actualizadas de Usuarios y Admin.
6. Probar con un producto publicado y un servicio publicado reales: enviar reportes, recibir HTTP 201 con ID; consultar desde otra sesión de Admin y verificar el ID, el motivo, la fecha y el estado `PENDING`. Validar también error 404 para ofertas inexistentes, 409 para duplicado del usuario y 403 para Admin sin permiso.
7. Después del despliegue, comprobar que `GET /api/v1/admin/offer-reports` devuelve HTTP 200 con `reports`, `pagination` y `pendingTotal`.

No usar `prisma db push` en producción ni ejecutar instrucciones de alteración de tablas fuera del proceso de migración aprobado.

## Contratos activos en código

**Público:** `POST /api/v1/public/offers/:offerId/reports`
```json
{ "reason": "WRONG_INFORMATION", "description": "La información del producto no corresponde." }
```
Motivos: `UNAVAILABLE`, `WRONG_INFORMATION`, `WRONG_IMAGE` (solo producto), `OTHER`.
Respuesta exitosa:
```json
{ "report": { "id": "uuid", "status": "PENDING", "createdAt": "2026-11-14T00:00:00.000Z" } }
```

**Administrativo:** `GET /api/v1/admin/offer-reports?page=1&pageSize=25&status=PENDING&kind=PRODUCT&q=pan`

Respuesta:
```json
{
  "reports": [
    {
      "id": "uuid",
      "reason": "WRONG_INFORMATION",
      "description": "Información incorrecta",
      "status": "PENDING",
      "createdAt": "2026-11-14T00:00:00.000Z",
      "offer": {
        "id": "uuid",
        "name": "Nombre del producto",
        "kind": "PRODUCT",
        "business": { "id": "uuid", "name": "Nombre del negocio" }
      },
      "reporter": { "displayName": "Nombre del usuario" }
    }
  ],
  "pagination": { "page": 1, "pageSize": 25, "total": 1, "totalPages": 1 },
  "pendingTotal": 1
}
```
Los datos anteriores **solo ilustran el contrato**; no son registros reales.

## Siguiente fase opcional

Las decisiones administrativas de moderación aún no están implementadas. Si se necesitan, añadir una ruta `PATCH /api/v1/admin/offer-reports/:reportId` protegida por `CONTENT_MODERATE`, con notas obligatorias, control de estados y auditoría. No exponer acciones de moderación sin ese backend.
