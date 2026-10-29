# Fuentes de facturación en Finanzas

El resumen de Finanzas mantiene separadas las fuentes que AWS presenta en sus
productos de facturación:

| Indicador | Fuente | Estado |
| --- | --- | --- |
| Consumo de proyecto | Billing/Projects de AWS | Pendiente de integración API; se conserva el último valor con fecha cuando exista |
| Costos de Cost Explorer | `GetCostAndUsage` (`UnblendedCost`) | Integrado, provisional mientras AWS cierra el período |
| Costo neto | `NetUnblendedCost` | Integrado como métrica independiente |
| Créditos promocionales | Billing/Credits | Pendiente de integración; no se infiere desde diferencias de métricas |
| Importe pendiente | Billing/Amount due | Pendiente de integración; Cost Explorer no lo proporciona |

`UnblendedCost` y `NetUnblendedCost` nunca se suman. La diferencia se conserva
solo como diferencia de métricas y no se etiqueta como crédito confirmado.
Una respuesta vacía de Cost Explorer se marca como información incompleta, no
como prueba de ausencia de consumo.

La activación de los indicadores pendientes requiere una API de Billing
autorizada y de solo lectura. Hasta entonces Admin debe mostrar “No disponible
por API” junto con la fecha del último valor confirmado, sin sustituirlo por
cero.
