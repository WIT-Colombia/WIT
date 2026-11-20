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
La página puede registrar una **solicitud de adquisición**, pero enviarla **no cobra, activa ni renueva** una membresía. La habilitación administrativa manual está reservada a pruebas controladas; no se debe confundir solicitud registrada con pago aprobado.

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

## Aceptación funcional y visual de las tres mejoras (noviembre de 2026)

**Rama autorizada:** `integration/preserve-all-20261029`. Las comprobaciones automatizadas asociadas al commit `566a0a107060717a6ebf12e008f4d69c57776867` finalizaron correctamente:
- Frontend, pruebas, compilación, auditoría de dependencias y verificación responsive de Plus: [GitHub Actions #44762148552](https://github.com/WIT-Colombia/WIT/actions/runs/44762148552).
- Backend, pruebas de integración con MySQL: [GitHub Actions #44762148515](https://github.com/WIT-Colombia/WIT/actions/runs/44762148515).
- Flujo de entrega: etapa de verificación aprobada, **despliegue omitido**; un workflow exitoso no equivale a una publicación: [GitHub Actions #44762148575](https://github.com/WIT-Colombia/WIT/actions/runs/44762148575).

### Prueba manual exigida antes de certificar producción

**Estado: PENDIENTE.** Las pruebas automáticas usan datos y sesiones de prueba; no sustituyen una sesión real de un usuario Plus con backend actualizado. Ejecutar únicamente en un entorno autorizado, después de respaldos y de validar migraciones. No registrar contraseñas, tokens, identificadores privados ni datos personales en los resultados.

| Caso | Acción de prueba | Resultado requerido |
| --- | --- | --- |
| 1. Acceso | Ingresar con cuenta básica y cuenta Plus habilitada | Los datos y herramientas premium solo son accesibles a la cuenta autorizada |
| 2. Precio objetivo | Seguir un producto con precio numérico y fijar objetivo inferior al precio | El objetivo se guarda y se muestra en la ficha Plus de esa cuenta |
| 3. Edición / baja | Modificar y retirar el objetivo | Se actualiza o elimina sin tocar otros productos |
| 4. Alerta única | Publicar un precio real que alcance el objetivo y repetir una actualización equivalente | Aparece una alerta autorizada, sin duplicaciones por el mismo objetivo |
| 5. Consentimiento | Desactivar alertas generales de bajada y conservar un objetivo explícito | El servicio distingue ambas preferencias sin modificar una por la otra |
| 6. Envío inmediato | Elegir entrega inmediata y generar una novedad permitida | La notificación se atribuye exclusivamente a la cuenta Plus destinataria |
| 7. Resumen diario | Seleccionar una zona IANA válida y hora local | La preferencia persiste y el envío se realiza en la hora local elegida |
| 8. Configuración inválida | Ingresar una zona horaria inexistente | Se indica error y no se envía configuración errónea al servidor |
| 9. Caducidad | Simular expiración o revocación autorizada de la membresía | Se bloquean funciones premium y avisos futuros sin destruir datos guardados |
| 10. Ruta de dos a cuatro | Elegir 2–4 negocios favoritos georreferenciados y optimizar | Orden conforme a distancia geográfica y controles de cambio/restablecimiento |
| 11. Horario de cierre | Incluir negocio cuyo horario publicado indique cierre estimado | Advertencia visible sin afirmar disponibilidad garantizada |
| 12. Google Maps | Abrir ruta optimizada | Origen, paradas y modo coinciden con la selección; no se inventa información de tráfico |
| 13. Estados vacíos | Probar sin favoritos ni precios seguidos y con caída de un endpoint | Mensajes claros, sin métricas ficticias ni bloqueo del resto de herramientas |
| 14. Responsive | Comprobar a 360, 390, 820, 1180 y 1440 px; teclado y controles táctiles | Sin desbordamiento ni botones truncados; foco visible y legibilidad consistente |
| 15. Seguridad | Revisar solicitudes cruzadas entre dos cuentas y registros administrativos | No hay acceso transversal; cambios de membresía quedan auditados |

**Criterio de cierre:** registrar evidencia de los 15 casos y obtener resultados satisfactorios. Si falta sesión real o falla un caso crítico, mantener el estado **PENDIENTE**, sin declarar la versión apta para producción. No habilitar cobros ni efectuar despliegue por el solo hecho de aprobar el pipeline.
