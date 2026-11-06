# XAMUKO — publicación aislada de avatares (PR #205)

**Estado:** preparación, sin publicación en producción.

## Alcance autorizado

- Cloudflare Pages **xamuko-usuario** -> `user.xamuko.com`.
- Cloudflare Pages **xamuko-business** -> `business.xamuko.com`.
- No desplegar backend, no fusionar a `integration/preserve-all-20261029`, no modificar AWS EC2/RDS/S3, DNS, OAuth ni secretos.
- Mantener `xamuko-admin` y `xamuko-landing` sin cambios.

## Origen y verificación

- PR: https://github.com/WIT-Colombia/WIT/pull/205
- CI: `.github/workflows/frontend-validation.yml`, rama fuente `fix/avatar-uploads-usuario-business-20261106`.
- CI debe aprobar `typecheck`, pruebas Usuario (incluidos 4 tests de avatar), pruebas Business (incluidos 4 tests de avatar) y `build`.
- El workflow publica **únicamente artefactos de compilación**, no despliega nada:
  - `xamuko-usuario-pages-pr-205` -> contenido de `frontend/apps/usuario/dist/`
  - `xamuko-business-pages-pr-205` -> contenido de `frontend/apps/negocios/dist/`
- Los artefactos se descargan desde la ejecución de *XAMUKO frontend validation* en el PR. Caducan a los 7 días. Verificar que ambas carpetas contienen `index.html` y `assets/`.

## Publicación de **prueba** separada, no productiva

1. Verificar primero en Cloudflare el nombre exacto de cada proyecto y su rama de producción; registrar el despliegue actual y sus opciones de reversión.
2. Comprobar que el valor de `VITE_API_BASE_URL` en los artefactos coincide con el API esperado: `https://api.xamuko.com/api/v1`. Los builds de GitHub usan los valores por defecto de Vite; revisar posibles diferencias con variables de compilación de Cloudflare.
3. Iniciar sesión en Wrangler con una cuenta autorizada (no comunicar tokens ni credenciales por chat).
4. Descomprimir por separado los dos artefactos de GitHub. Cada directorio debe contener directamente `index.html` y `assets/`.
5. Sólo para preview; sustituir `DIRECTORIO_USUARIO` y `DIRECTORIO_BUSINESS` por las rutas locales reales:

```sh
npx wrangler pages deploy DIRECTORIO_USUARIO --project-name=xamuko-usuario --branch=avatar-hotfix-preview
npx wrangler pages deploy DIRECTORIO_BUSINESS --project-name=xamuko-business --branch=avatar-hotfix-preview
```

Estos comandos son **instrucciones pendientes de ejecutar**, no un despliegue ya hecho. Las URLs de preview que devuelva Cloudflare deben validarse antes de publicarlas en los dominios de producción. Si la política de ramas/CORS no permite realizar pruebas autenticadas sobre previews, no abrir producción sin acordar una alternativa segura.

## Criterios de aceptación

- Iniciar sesión en Usuario (contraseña y Google) y subir una foto JPG/PNG/WebP menor o igual a 5 MB.
- Confirmar HTTP 204 del POST `/api/v1/auth/me/avatar`, actualizar el perfil, recargar y comprobar foto persistente.
- En Business: repetir subida de **avatar personal**, recarga y sesión renovada tras 401.
- Verificar por separado la foto de portada y perfil **del negocio**: deben seguir mostrándose, sin modificar sus objetos.
- Confirmar que las rutas `user.xamuko.com` y `business.xamuko.com` mantienen login y que la API continúa saludable.
- Registrar errores, código HTTP, URL del despliegue y referencia a la versión previa.

## Producción y reversión

**No ejecutar aún publicación en producción.** Antes de hacerlo:
- Reconfirmar el nombre de las ramas de producción de ambos proyectos desde Cloudflare, los artefactos validados, variables de compilación, CORS y autorización expresa para desplegar.
- Publicar individualmente con Wrangler en la rama de producción de cada proyecto, sin fusionar PR #205 a la rama que dispara despliegue de AWS.
- Si hay falla, revertir sólo el Pages correspondiente desde `Deployments` > despliegue anterior exitoso > `Rollback to this deployment`; **no** reiniciar ni revertir el backend AWS.

Referencias: https://developers.cloudflare.com/pages/get-started/direct-upload/ y https://developers.cloudflare.com/pages/configuration/rollbacks/
