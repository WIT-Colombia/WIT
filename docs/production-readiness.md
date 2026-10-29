# Preparación de producción XAMUKO

Este documento no crea recursos ni ejecuta cambios. Sirve como lista de
aprobación para la separación de staging y producción.

## Recursos que requieren aprobación

| Recurso | Propósito | Estimación mensual |
|---|---|---:|
| EC2 Linux t3.micro, 730 h | API productiva y Nginx | US$7,59 |
| RDS MySQL db.t4g.micro Single-AZ, 730 h | Base productiva privada | US$13,87 |
| EBS gp3, 20 GB por entorno | Sistema y datos persistentes | US$3,20 total |
| RDS storage, 20 GB por entorno | Almacenamiento provisionado | US$4,60 total |
| IPv4 pública de EC2 | Acceso HTTP/HTTPS | US$3,65 |
| Snapshots y backups | Reversión y recuperación | US$1–4 |
| S3 + CloudFront | Cuatro frontends | US$2–7 inicial |
| Transferencia y solicitudes | Variable | US$1–6 inicial |

Producción más staging temporal optimizado: **US$38–57/mes** antes de créditos,
aproximadamente **COP $125.400–188.100** a COP $3.300/USD. Para permanecer bajo
COP $150.000, staging debe usarse alrededor de dos días al mes, RDS staging no
debe tener IPv4 pública y no debe crearse NAT Gateway.

## Configuración preparada

- Producción: EC2 pública, RDS privado, Security Group de API y Security Group
  de base de datos que solo acepta tráfico desde la EC2 productiva.
- Staging: EC2/RDS actuales, secretos separados y dominio independiente.
- Variables separadas por entorno: `DATABASE_URL`, secretos de sesión, OAuth,
  Resend, CORS y dominios confiables.
- `main` despliega producción solo con aprobación; `staging` conserva su flujo
  automático independiente.
- Acceso administrativo mediante Session Manager; no se requiere SSH público.
- `AWS_FREE_TIER_ENABLED=false` por defecto y Cost Explorer solo manual.

## Orden de integración

1. PR #12: Finanzas y migración, validado en MySQL efímero; aplicar a una copia
   aislada antes de cualquier RDS.
2. PR #13: estados de catálogo y reintento de Usuario.
3. PR #14: pruebas de contacto comercial.
4. Validar builds y E2E en staging separado.
5. Solicitar aprobación para crear producción y cambiar DNS.

## Autorizaciones pendientes

Crear EC2/RDS/Security Groups/certificados, configurar IAM y secretos, aplicar
migraciones sobre la copia productiva, modificar DNS y ejecutar el primer
despliegue.
