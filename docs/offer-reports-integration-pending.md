# Reportes de productos y servicios — integración pendiente

## Estado (frontend, 2026-11-13)

- Usuarios: `/product/:id` y `/service/:id` enlazan al formulario `/report?type=product|service&id=...`.
- El formulario ahora puede resolver productos y servicios reales consultando la API pública por ID, además del catálogo de demostración.
- Hasta crear el endpoint, `saveUserReport` guarda reportes **solo en localStorage del navegador del usuario**.
- El mensaje de confirmación aclara que **el reporte no se ha transmitido a Admin**. No puede afirmarse que exista radicado de servidor.
- Admin: `/offer-reports` bajo «Atención y soporte» tiene filtros de tipo, estado y texto, detalle de registros y estado de integración pendiente, sin ejemplos ficticios.
- Admin consulta el contrato `GET /api/v1/admin/offer-reports`; hoy responderá 404 hasta la implementación del backend.
- Las aplicaciones `user.xamuko.com` y Admin son orígenes distintos. **localStorage no sincroniza entre ellas.**

## Contratos propuestos para fase backend

### Crear reporte desde Usuarios

`POST /api/v1/public/offers/:offerId/reports`

Body:
```json
{
  "reason": "WRONG_INFORMATION",
  "description": "Texto opcional de hasta 1500 caracteres"
}
```

Motivos sugeridos:
- `UNAVAILABLE`
- `WRONG_INFORMATION`
- `WRONG_IMAGE` (solo productos si aplica)
- `OTHER`

El servidor debe derivar `kind` (PRODUCT / SERVICE) y `businessId` desde la oferta persistida, no confiar en valores enviados por cliente. Respuesta sugerida: `201 { report: { id, status: "PENDING", createdAt } }`. No aceptar ID de oferta inexistente ni eliminada. Definir límites de frecuencia y anti-abuso.

### Consultar bandeja desde Admin

`GET /api/v1/admin/offer-reports`

Proteger con sesión administrativa y permiso `REPORTS_REVIEW`. Respuesta propuesta:
```json
{
  "reports": [
    {
      "id": "uuid",
      "reason": "WRONG_INFORMATION",
      "description": null,
      "status": "PENDING",
      "createdAt": "2026-11-13T20:00:00.000Z",
      "offer": {
        "id": "uuid",
        "name": "Croissant",
        "kind": "PRODUCT",
        "business": { "id": "uuid", "name": "Panadería Patico" }
      },
      "reporter": { "displayName": "Usuario" }
    }
  ]
}
```
El ejemplo de este documento **no es un registro real**. Implementar paginación y filtros de servidor antes de usar volúmenes grandes. Restringir exposición de datos personales según necesidad, permiso y finalidad.

### Moderación

`PATCH /api/v1/admin/offer-reports/:reportId` (por definir), con cambios de estado `PENDING`, `UNDER_REVIEW`, `RESOLVED`, `REJECTED`, nota de decisión y auditoría (actor, fecha, motivo). No habilitar decisiones en Admin hasta existir API transaccional y auditada.

## Criterios para cerrar la fase backend

1. Reporte de usuario persiste en base de datos y devuelve identificador real.
2. Admin lo consulta desde otra sesión/dispositivo, con control de acceso.
3. UI de Usuarios cambia «Guardado localmente» por confirmación de recepción **solo después** de respuesta exitosa del servidor.
4. Tratamiento adecuado de duplicados, límites de frecuencia, CSRF, estados y datos sensibles.
5. Pruebas de integración con cuentas y ofertas reales, incluidas ofertas eliminadas y usuarios no autenticados, según política definida.
