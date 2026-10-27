# Estadísticas Business v1 — fuentes y límites

La pantalla usa `GET /api/v1/businesses/:businessId/analytics?period=day|week|month|year|all`. El servidor comprueba membresía activa y permiso `READ_ANALYTICS` (o rol propietario) para **el negocio solicitado**. Los cinco valores gratuitos se devuelven con esa autorización. Los datos de referidos y PRO solo se incluyen cuando el servidor confirma, respectivamente, cinco referidos válidos o una suscripción PRO vigente. PRO también habilita el bloque de referidos. El frontend no decide derechos ni recibe los datos restringidos si no corresponden.

Los intervalos son `[inicio, fin)` en zona `America/Bogota`; los eventos se guardan como instantes UTC. Día, semana (lunes), mes y año empiezan a medianoche local. La comparación toma la misma porción transcurrida del intervalo anterior; si el intervalo anterior fue más corto, se omite. El total «Todo el tiempo» no tiene comparación. Sus gráficos muestran los 24 meses más recientes, mientras el total conserva todo el historial. No se reconstruye actividad anterior a la instrumentación.

| Nº | Estadística | Estado | Origen / pendiente |
| ---: | --- | --- | --- |
| 1 | Visualizaciones del negocio | Funcional con datos reales | `BusinessAnalyticsEvent.BUSINESS_VIEW`; aperturas, no personas. |
| 2 | Apariciones en búsquedas | Funcional con datos reales | `SEARCH_IMPRESSION`; no clics. |
| 3 | Clics en WhatsApp | Funcional con datos reales | `WHATSAPP_CLICK`. |
| 4 | Clics en llamar | Funcional con datos reales | `PHONE_CLICK`. |
| 5 | Usuarios que te guardaron | Funcional con datos reales | `BusinessFavorite`, total vigente. Es una foto actual y no cambia con el filtro. |
| 6 | Clics en cómo llegar | Pendiente de instrumentación | Falta registrar ese evento. |
| 7 | Me gusta recibidos | Funcional con datos reales, sujeto a acceso | `BusinessOfferLike`, vigentes creados en el período. |
| 8 | Opiniones recibidas | Funcional con datos reales, sujeto a acceso | `BusinessReview` publicadas creadas en el período. |
| 9 | Calificación promedio | Funcional con datos reales, sujeto a acceso | Media de las reseñas del mismo período; sin reseñas se indica ausencia de datos. |
| 10 | Productos y servicios más consultados | Pendiente de instrumentación | Faltan eventos de apertura por publicación. |
| 11 | Visitantes únicos | Pendiente de instrumentación | Los eventos anónimos no permiten deduplicar personas con fiabilidad. |
| 12 | Visitantes recurrentes | Pendiente de instrumentación | Depende de visitantes únicos fiables. |
| 13 | Evolución de visualizaciones | Funcional con datos reales, sujeto a PRO | Agrupación temporal de `BUSINESS_VIEW`. |
| 14 | Evolución de apariciones en búsquedas | Funcional con datos reales, sujeto a PRO | Agrupación temporal de `SEARCH_IMPRESSION`. |
| 15 | Tasa de interacción | Pendiente de desarrollo | Definir alcance completo de interacciones e instrumentarlo antes de dividir. |
| 16 | Tasa de contacto | Funcional con datos reales, sujeto a PRO | `(WhatsApp + llamadas) / visualizaciones × 100`; no equivale a clientes o ventas. |
| 17 | Tasa de navegación | Pendiente de instrumentación | Necesita clics en cómo llegar. |
| 18 | Horarios de mayor actividad | Funcional con datos reales, sujeto a PRO | Aperturas por hora de Bogotá. |
| 19 | Días de mayor actividad | Funcional con datos reales, sujeto a PRO | Aperturas por día de semana de Bogotá. |
| 20 | Origen de las visitas | Pendiente de instrumentación | Falta fuente de cada apertura. |
| 21 | Palabras clave de búsqueda | Pendiente de instrumentación | Falta contexto de búsqueda agregado por negocio. |
| 22 | Posición promedio en búsquedas | Pendiente de instrumentación | Falta posición en cada impresión. |
| 23 | Rendimiento por categoría | Pendiente de instrumentación | Falta atribución de eventos a categorías. |
| 24 | Productos más vistos | Pendiente de instrumentación | Faltan aperturas por producto. |
| 25 | Servicios más vistos | Pendiente de instrumentación | Faltan aperturas por servicio. |
| 26 | Evolución de favoritos | Funcional parcial con datos reales, sujeto a PRO | Altas que **siguen vigentes** agrupadas por fecha; al borrar un favorito se pierde el alta histórica. |
| 27 | Evolución de calificaciones | Funcional parcial con datos reales, sujeto a PRO | Media de reseñas publicadas por fecha de creación; las ediciones no tienen historial. |
| 28 | Rendimiento de destacados | Pendiente de instrumentación | Falta asociar exposición e interacciones a cada campaña destacada. |
| 29 | Comparación entre períodos | Funcional cuando hay base comparable, sujeto a PRO | Variación de visualizaciones frente a la misma porción del intervalo anterior; sin base se indica medición pendiente. |
| 30 | Índice de rendimiento comercial | Pendiente de desarrollo | Fórmula propuesta: 40 % visibilidad + 35 % contacto + 25 % reputación, cada componente normalizado frente a una línea base por categoría y zona. Falta definir esa base y el tratamiento de muestras pequeñas. Nunca debe presentarse como ventas. |

## Captura y extensiones necesarias

Los eventos existentes guardan negocio, tipo, instante, usuario autenticado opcional y clave de deduplicación. La ficha registra aperturas y clics; los resultados registran impresiones. La clave evita reintentos duplicados, pero cada montaje de ficha y clic legítimo crea un evento nuevo. Hay límite de peticiones en el endpoint público; todavía falta una política de bots y recargas que reduzca tráfico artificial sin excluir interacciones reales. No se envían contraseñas ni tokens a los eventos.

Para completar las estadísticas pendientes hace falta proponer una migración futura: un evento de `DIRECTIONS_CLICK` y una estructura de eventos de publicaciones con `businessId`, `offerId`, tipo, fecha, fuente y deduplicación, con índices por negocio/tipo/fecha y publicación/fecha. Origen, posición y categoría necesitan campos de contexto acotados; términos de búsqueda requieren evaluación de privacidad y agregación mínima. Los visitantes únicos requerirían una base legítima para un identificador seudónimo; no se estiman con la cuenta de vistas. Una tabla histórica de cambios de favoritos y reseñas sería necesaria para reconstruir bajas y ediciones. **No se creó ni ejecutó ninguna migración.**

Los gráficos y porcentajes solo usan respuestas reales del servidor. Cero eventos se distingue de fuente no disponible. Los porcentajes se ocultan cuando el período anterior vale cero o no es comparable. Ninguna tarjeta usa cifras de la referencia visual.
