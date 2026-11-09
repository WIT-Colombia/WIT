# XAMUKO — preparación de actualización backend AWS

Base: `integration/preserve-all-20261029`. Este documento NO acredita despliegue ni ejecución de pruebas.

## Antes de desplegar (en casa)
1. Revisar PR y CI: typecheck, build, tests, integración MySQL y compatibilidad Usuario/Business.
2. Confirmar commit exacto de la rama `integration/preserve-all-20261029` después de incorporar los cambios aprobados. Evitar desplegar `main` por accidente.
3. Respaldar RDS/MySQL y verificar credenciales, región, certificado TLS, configuración Resend, URLs Usuario/Business y origen confiable. No copiar secretos a GitHub.
4. Ejecutar migraciones Prisma pendientes en AWS **antes** de activar el backend. Confirmar que existe `PendingEmailRegistration`; no ejecutar `db push` destructivo.
5. Publicar backend por el mecanismo de release aprobado y comprobar salud, logs y endpoints:
   - `GET /api/v1/auth/registration-policy` debe anunciar `emailVerificationRequiredBeforeCreation: true`.
   - `GET /api/v1/auth/referrals/availability` debe anunciar `enabled: true`.
6. Confirmar que el frontend no habilita registros contra el backend antiguo. Coordinar el release de Usuario y Business con backend.
7. Prueba real controlada: registro con correo y referido; antes de verificar no deben existir `User`, `AuthIdentity`, `BusinessReferral` ni aumento de contador; después sí, exactamente una vez. Probar clic repetido, enlace vencido a 15 minutos, reenvío, fallo Resend, registro sin referido y Google.
8. Auditar referidos históricos de usuarios sin verificar, sin borrar registros automáticamente.
9. Revisar además las novedades de `/results`, plantillas de correo y demás PR fusionados en integration: no asumir que un merge despliega AWS.

## Limpieza de solicitudes vencidas
La creación de nuevas solicitudes ya realiza limpieza oportunista. Para limpieza periódica:
- Vista previa: `cd backend && npm exec -- tsx scripts/cleanup-pending-registrations.ts`
- Ejecución explícita: `cd backend && npm exec -- tsx scripts/cleanup-pending-registrations.ts --apply`
- La programación en AWS (cron/systemd timer) queda pendiente de autorización y verificación de permisos. No ejecutar contra producción sin respaldo y comprobación previa.

## Rollback
Conservar artefacto anterior, respaldo de base y commit de origen. Preferir rollback de aplicación compatible con esquema aditivo. No revertir migraciones destructivamente ni borrar cuentas/referidos.
