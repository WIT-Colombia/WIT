# XAMUKO — Lista de aprobación del backend de producción

## Propósito y límites

Este procedimiento prepara un release **sin activarlo automáticamente**. El repositorio
`integration/preserve-all-20261029` se utiliza para preparar los artefactos, pero la
aprobación del PR y CI no comprueban que la API de producción, RDS, TLS, los orígenes
de Admin o los archivos instalados en EC2 correspondan a ese commit.

**Nunca interpretar `verify: success` como despliegue cuando el job `deploy` está
`skipped`.** El workflow OIDC solo publica en producción si
`XAMUKO_PRODUCTION_DEPLOY_ENABLED=true` y están operativos el rol IAM, el bucket,
SSM y las aprobaciones de ambiente.

Las migraciones de Prisma que se aplican en CI utilizan **MySQL 8.4 aislado**.
Ninguna prueba aplica migraciones en la base de producción.

## 1. Fijar exactamente qué se pretende activar

- Confirmar el SHA íntegro de la rama `integration/preserve-all-20261029`.
- Confirmar que el release backend (artefacto .tar.gz y SHA256) y sus GitHub Actions
  pertenecen a ese mismo SHA y que todas las pruebas pasaron.
- Revisar el job `deploy`: si está `skipped`, **no está instalado** ese release.
- En SSM de EC2, con autorización administrativa, comprobar sin divulgar secretos:

```bash
sudo systemctl is-active xamuko-api
sudo cat /opt/xamuko/deploy/current/COMMIT
sudo cat /opt/xamuko/deploy/status.json
sudo readlink -f /opt/xamuko/deploy/current
```

Si los valores no concuerdan, registrar la versión activa antes de continuar. No
reintentar despliegues anteriores de forma automática.

## 2. Copia, compatibilidad y migraciones

Antes de alterar un esquema de producción:

1. Crear **snapshot real de RDS** o copia íntegra verificable, con fecha, identificador,
   mecanismo de restauración y personal autorizado. Comprobar que es recuperable.
2. Obtener de forma segura el `DATABASE_URL` existente mediante el EnvironmentFile
   del servicio (no imprimirlo, no subirlo a GitHub, no pasarlo por parámetros SSM).
3. Desde un checkout verificado del **SHA final**, instalar Node 22 y dependencias de
   desarrollo solo en un directorio de preparación protegido. Ejecutar
   `npm ci`, `npm run prisma:generate` y `npx prisma migrate status`.
4. Comparar el historial `_prisma_migrations` con `backend/prisma/migrations`.
   Revisar una por una **todas** las pendientes, incluidas los `ALTER TABLE`
   que pueden tomar locks en MySQL. Determinar ventana y plan de contingencia.
5. Con aprobación expresa y backup verificable, ejecutar
   `npx prisma migrate deploy` **una sola vez** contra producción, en un
   proceso supervisado (nunca desde el job de CI). Abortarlo ante errores;
   no usar `migrate reset`, `db push` ni `migrate resolve` sin revisión.
6. Con la misma configuración de conexión, ejecutar desde el directorio
   `backend` del SHA aprobado:

```bash
npm run typecheck
npm run build
npm run preflight:production
```

`preflight:production` es **solo lectura** y falla si detecta migraciones
pendientes, interrumpidas o desconocidas, si faltan ZoneLaunch, ZoneLaunchAlert,
PlatformNotification, Business, BusinessOffer, Category o AuditLog, si el ENUM
no admite ZONE o si falta el registro inicial de Palmira. También comprueba
las consultas reales de Zonas y el conteo de Categorías.

**STOP:** Si falla el preflight o las migraciones, **no activar el backend**.
El comando solo es válido con credenciales y conectividad del servidor
autorizado: el éxito contra MySQL de CI no prueba la base de producción.

## 3. Instalar el control de aprobación de cambios Prisma

Los scripts instalados en EC2 no se actualizan por hacer merge. Primero revisar
su diferencia respecto de la versión actualmente instalada y respaldar las
versiones anteriores. En una ventana administrada:

```bash
bash -n deploy/verify-schema-approval.sh
bash -n deploy/deploy.sh
bash -n deploy/deploy-github-release.sh
bash deploy/test-schema-approval.sh

sudo install -o root -g root -m 0755 deploy/verify-schema-approval.sh \
  /usr/local/sbin/xamuko-verify-schema-approval
# Tras verificar los scripts completos y su mecanismo de rollback:
sudo install -o root -g root -m 0755 deploy/deploy.sh \
  /usr/local/sbin/xamuko-deploy
sudo install -o root -g root -m 0755 deploy/deploy-github-release.sh \
  /usr/local/sbin/xamuko-deploy-github-release
```

Al cambiar Prisma, el wrapper verifica el directorio protegido
`/opt/xamuko/deploy/schema-approvals`. Crear la aprobación **solo después**
de verificar backup, migraciones y preflight y solo para el SHA exacto:

```bash
SHA=<commit-de-40-caracteres-validado>
sudo install -d -o root -g root -m 0700 /opt/xamuko/deploy/schema-approvals
printf '%s\n' "$SHA" | sudo tee "/opt/xamuko/deploy/schema-approvals/$SHA.approved" >/dev/null
sudo chown root:root "/opt/xamuko/deploy/schema-approvals/$SHA.approved"
sudo chmod 0600 "/opt/xamuko/deploy/schema-approvals/$SHA.approved"
```

Una aprobación para otro SHA, permisiva, simbólica o ausente se rechaza.
No crear aprobaciones por anticipado ni generalizar este control mediante
variables de entorno. Conservar registro del responsable y el backup aprobado.

## 4. Activación, comprobación y recuperación

- Seleccionar **un solo mecanismo** de despliegue (OIDC/SSM o poller GitHub),
  respetando los requisitos del mecanismo instalado. Nunca ejecutarlos
  simultáneamente.
- Habilitar el despliegue desde CI únicamente tras validar IAM, SSM, rutas,
  permisos, bucket, EnvironmentFile y la aprobación del SHA.
- Activar el artefacto exacto con checksum, prueba aislada del proceso,
  conmutación, `health` y comprobación del release activo. No ejecutar migraciones
  durante el cambio de symlink.
- Una vez activado, ejecutar **sin credenciales ni escrituras**:

```bash
node scripts/backend-production-smoke.mjs
```

Debe pasar `/api/v1/health`, `/api/v1/public/zones/next-launch`,
estados públicos de Palmira y Cali, catálogo público y protección 401/403 de
`/api/v1/admin/zones` y `/api/v1/admin/categories` para visitantes anónimos.
Después comprobar en navegador con sesión SUPER_ADMIN que Zonas y Categorías
cargan, y registrar HTTP, código de error y logs si falla.

**Rollback:** conservar release anterior verificado y estrategia de recuperación
de la base. Una reversión de código **no revierte migraciones SQL**. Confirmar
compatibilidad del esquema antes de recuperar la versión anterior; ante una
migración incompatible, escalar al plan restauración verificado y una ventana
de mantenimiento. Ningún script elimina backups ni revierte datos automáticamente.

## Bloqueos que no puede levantar CI por sí sola

- El SHA realmente desplegado en EC2 y la disponibilidad del servidor.
- El inventario real de migraciones pendientes en RDS.
- Una copia recuperable, cambios de esquema aprobados y EnvironmentFile vigente.
- Autenticación real de una sesión SUPER_ADMIN con cookie/CSRF y carga de Zonas.
- Que el frontend publicado de Admin coincida con las rutas y el backend nuevos.

**Apto para despliegue** significa que CI y preflight **de producción** son verdes,
el operador aprobó cambios de esquema, existe backup recuperable, el release
está preparado y hay plan de rollback. Hasta entonces: preparado en GitHub,
pero despliegue no autorizado.
