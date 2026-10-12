# XAMUKO

XAMUKO es una plataforma local para descubrir negocios, productos y servicios cercanos. El repositorio conserva las tres aplicaciones frontend y un backend común. La interfaz de Usuario utiliza actualmente la identidad visual XAMUKO; el repositorio y algunos nombres técnicos mantienen el legado WIT para preservar compatibilidad.

## Arquitectura

- `frontend/apps/usuario`: aplicación React, TypeScript y Vite para visitantes y usuarios finales.
- `frontend/apps/negocios`: aplicación React, TypeScript y Vite para la gestión comercial.
- `frontend/apps/admin`: aplicación React, TypeScript y Vite para administración.
- `frontend/packages`: paquetes compartidos de UI, tipos y utilidades.
- `backend`: API Express con TypeScript, Prisma y MySQL/MariaDB adapter.

## Estado actual

### Implementado

- Backend Express con endpoint `GET /api/v1/health`.
- Autenticación por correo y contraseña con Argon2id, sesiones, rotación de refresh tokens en cookies HttpOnly y cierre de sesión.
- Verificación de correo y recuperación de contraseña con tokens de un solo uso, expiración y envío desacoplado.
- Proveedor de correo de desarrollo y adaptador Resend configurable por variables de entorno.
- OAuth de Google mediante backend, con `state`, `nonce`, PKCE, validación y diagnósticos seguros.
- Usuario: registro, inicio de sesión, perfil, cuenta y privacidad, favoritos, opiniones, notificaciones y recuperación/verificación.
- Ubicación centralizada con `LocationContext`, persistencia local y Palmira como ubicación inicial (`3.5394, -76.3036`).
- Mapa interactivo en `/map` con carga diferida de Maps JavaScript API y geocodificación para ciudades manuales.
- Pantalla `/directions` con enlaces a Google Maps y Waze cuando existen coordenadas verificadas.
- Maps Static API preparada en `BusinessStaticMap`; la vista previa de Ferretería El Martillo está limitada a desarrollo y no marca sus coordenadas como verificadas.
- Catálogo ficticio conservado para las pruebas del frontend.

### En pruebas

- La vista previa de Maps Static para `ferreteria-martillo` usa temporalmente el centro aproximado de Palmira y solo está habilitada en desarrollo.
- La integración de correo real requiere un remitente y un dominio/proveedor configurados para el entorno correspondiente.
- Las aplicaciones Negocios y Administración conservan sus flujos actuales y aún no comparten todos los flujos de autenticación del Usuario.

### Pendiente

- Sustituir datos ficticios por catálogo y coordenadas verificadas provenientes del backend.
- Configurar restricciones de aplicación, dominios y facturación de las claves de Google Maps para cada entorno.
- Completar los módulos de negocio de Negocios y los flujos administrativos de Administración sobre la API real.
- Definir despliegue, observabilidad y políticas de correo para producción.

## Tecnologías

React 19, TypeScript, Vite, React Router, Node.js, Express 5, Prisma 7, MySQL 8.4/MariaDB adapter, Argon2id, JWT, cookies HttpOnly, Google Maps APIs y Resend opcional.

## Configuración local

1. Instala Node.js (versión compatible con los `engines` del backend) y MySQL 8.4 o MariaDB.
2. Instala dependencias desde los directorios `frontend` y `backend`.
3. Copia `backend/.env.example` a `backend/.env` y completa solo las variables privadas localmente.
4. Copia `frontend/apps/usuario/.env.example` a `frontend/apps/usuario/.env` y configura las claves públicas de Google Maps con restricciones por dominio. No guardes claves reales en Git.
5. Prepara la base de desarrollo y verifica el esquema Prisma según la documentación del backend.
6. Ejecuta los procesos:

```bash
cd backend
npm run dev

cd ../frontend
npm run dev:usuario
```

Usuario queda disponible normalmente en `http://localhost:5173` y la API en `http://localhost:3000`. Negocios y Administración pueden iniciarse con `npm run dev:negocios` y `npm run dev:admin` desde `frontend`.

## Verificaciones

```bash
# Frontend
cd frontend
npm run typecheck
npm run build
npm run test:verification

# Backend
cd ../backend
npm run typecheck
npm test
npm run build
```

Los directorios `dist`, `node_modules`, archivos `.env` y credenciales locales están excluidos del control de versiones. Las claves públicas de Maps deben restringirse en Google Cloud; nunca se deben incluir secretos de backend, MySQL, JWT, OAuth o Resend en el repositorio.
