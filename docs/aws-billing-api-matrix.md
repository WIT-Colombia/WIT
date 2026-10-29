# Matriz de APIs de facturación AWS

| Indicador | API/operación | Permiso mínimo | Estado |
|---|---|---|---|
| Costos diarios por servicio | Cost Explorer `GetCostAndUsage` (`UnblendedCost`, `NetUnblendedCost`) | `ce:GetCostAndUsage` | Disponible; valores del período pueden ser provisionales |
| Uso y previsión Free Tier | Free Tier `GetFreeTierUsage` | `freetier:GetFreeTierUsage` | Disponible; devuelve unidades de uso, no dinero ni saldo de créditos |
| Plan/ciclo de cuenta gratuita | Free Tier `GetAccountPlanState` | `freetier:GetAccountPlanState` | Disponible según el tipo de cuenta |
| Créditos emitidos/utilizados/saldo | Billing Console Credits | No existe operación pública equivalente confirmada | No automatizable con las APIs evaluadas; conservar último valor confirmado con fecha |
| Importe pendiente de pago | Billing Console/Bills | No existe operación pública equivalente confirmada | No automatizable con las APIs evaluadas |
| Consumo estimado de proyecto | Billing Console Projects | No existe operación pública equivalente confirmada | No automatizable con las APIs evaluadas |
| Descuentos y créditos aplicados | Cost Explorer puede exponer métricas/categorías, pero no sustituye Credits/Bills | `ce:GetCostAndUsage` | No interpretar diferencias como créditos; requiere conciliación de Bills/CUR |

`GetFreeTierUsage` no tiene cargo por consulta según la documentación de AWS.
Cost Explorer se consulta solo bajo demanda o mediante una sincronización diaria
controlada; no se activa ninguna tarea automática en esta fase.
