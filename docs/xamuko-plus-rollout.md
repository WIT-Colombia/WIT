# XAMUKO Plus — primer despliegue controlado

## Alcance
Se incluyen seis capacidades para Usuarios:
1. Radar de publicaciones y promociones recientes de negocios favoritos, con avisos personales.
2. Seguimiento de precios numéricos y avisos por reducción real; historial a partir del despliegue de este código.
3. Comparación de hasta 4 productos o servicios publicados.
4. Colecciones personales y búsquedas guardadas (área geográfica vigente al ejecutar la búsqueda).
5. Rutas de varios negocios favoritos con coordenadas en Google Maps.
6. Supresión de los espacios reservados de publicidad de terceros para suscriptores Plus.

**No** se ofrecen cupones ni descuentos exclusivos para miembros.
**No** se ofrece contratación ni cobro por Xamuko Plus: la asignación administrativa manual está destinada a pruebas controladas.

## Modelo de autorización
- El interruptor global `PaidPlanAvailability.xamukoPlus` es el primero en verificarse.
- Cada petición premium comprueba la suscripción de **ese** usuario: estado ACTIVE, inicio alcanzado, expiración futura y revocación nula.
- Apagar el interruptor o vencer la suscripción no elimina búsquedas, listas, vigilancia ni historial.
- Las rutas premium requieren sesión de usuario, y las modificaciones requieren origen confiable.
- Solo SUPER_ADMIN puede crear o revocar manualmente las membresías desde Admin, con motivo, confirmación y auditoría.
- Las notificaciones de precios solo se envían tras una disminución numérica en la misma moneda. Cambios en la moneda no se califican falsamente como descuento.
- El contenido retirado, no publicado o restringido por edad no se expone a través de listas ni comparaciones.

## Orden de despliegue seguro
1. Realizar copia de seguridad de la base de datos y aprobar la migración conforme al procedimiento existente.
2. Aplicar migraciones de Prisma, incluida `20261119163000_user_plus_features`, **antes de desplegar el backend**. La operación de catálogo pasa a registrar precios en la nueva tabla.
3. En el entorno de compilación backend ejecutar `npm run prisma:generate`, `npm run typecheck`, `npm test` y `npm run build` (o los scripts equivalentes según la raíz del monorepo).
4. Compilar los frontends `@wit/usuario` y `@wit/admin` con `npm run build --workspace=@wit/usuario` y `npm run build --workspace=@wit/admin` desde `frontend/`.
5. Desplegar backend actualizado, verificar `GET /api/v1/health` y `GET /api/v1/public/paid-plans` y después publicar las dos aplicaciones.
6. Desde Admin → Xamuko Plus, habilitar el interruptor, localizar un usuario real por su ID y otorgarle una membresía de prueba con fecha de expiración y justificación.
7. Verificar con dos sesiones diferentes: un usuario Plus y uno Básico. Confirmar que uno no puede consultar datos del otro.
8. Desactivar temporalmente el interruptor y verificar que los endpoints premium respondan 403, que los espacios de anuncios reaparezcan para el usuario Básico y que al reactivar Plus se recuperen colecciones e historial sin volver a crear datos.
9. Confirmar auditoría administrativa y probar desde escritorio, tableta y móvil.

## Límites conscientes de esta primera entrega
- El historial de precios empieza con las nuevas escrituras del backend; no se fabrican precios anteriores.
- El radar consulta las publicaciones de negocios favoritos de los últimos 14 días. Los avisos personales se generan en la transacción de nuevas publicaciones o bajas de precio; no se agregan canales de correo ni SMS automáticamente.
- Las rutas múltiples se delegan a Google Maps: no se garantizan tiempos, disponibilidad comercial ni rutas fuera de su servicio.
- El control de publicidad se aplica hoy a los componentes reservados `AdMobBanner`. Cualquier integración publicitaria futura debe volver a verificar la suscripción Plus.
- El guardado de búsquedas conserva el texto, categoría, orden, calificación y disponibilidad. La búsqueda se ejecuta con la ubicación seleccionada en Usuarios al abrirla, no cambia la ciudad del usuario silenciosamente.
- Las suscripciones de prueba no constituyen pagos ni facturación; desarrollar el proceso comercial, tributario y de cancelación antes de ofrecer Plus al público.

## Prohibiciones operativas
No efectuar modificaciones directas a producción ni habilitar cobros sin pruebas, respaldo, revisión de migración y autorización de despliegue.
