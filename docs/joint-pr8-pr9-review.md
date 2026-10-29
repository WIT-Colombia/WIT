# Compatibilidad de PR #8 y PR #9

Revisión conjunta del 29 de octubre de 2026. Ambas propuestas siguen separadas y en
borrador hacia staging; no se hizo merge ni se probó contra producción.

## Incompatibilidad detectada y corregida en #8

Admin podía renovar dos veces simultáneamente la misma cookie al restaurar sesión.
El backend rota correctamente el token: una petición recibe 200 y la otra 401; la
última podía borrar una sesión válida. adminRefresh ahora comparte una única promesa
para la renovación y /admin/me, y la libera tanto al completar como al fallar.
Dos pruebas cubren restauraciones concurrentes y reintento tras rechazo. La prueba
real de navegador con el backend de #9 confirma recarga de rutas privadas y logout.
No se modifican los controles de rotación, roles ni suspensión del backend.

## Matriz de contratos comprobados

| Operación | Backend #9 | Frontend #8 |
| --- | --- | --- |
| Solicitud | 202 con message genérico | Aceptación genérica, sin afirmar entrega |
| Reset normal | 200 user + accessToken | Restaura sesión y confirma cambio |
| Reset completado sin sesión | 200 user:{id}, autoLogin:false | Confirma guardado, limpia estado local y ofrece login |
| Cuenta no activa/token inválido | 400 INVALID_AUTH_TOKEN | Error, sin confirmación falsa |
| Cambio autenticado | 204 vacío | Éxito solo tras respuesta válida |
| Sesión o acceso no válido | 401/403 | Error o retorno al login; sin elevación de permisos |

Se conservan token opaco de uso único y vencimiento de servidor, contraseñas Argon2id,
EMAIL verificada, revocación y renovación rotativa, bearer en memoria y credenciales
incluidas. Las redirecciones de estos formularios son internas, no URLs next arbitrarias.
El correo común de recuperación continúa usando PASSWORD_RESET_URL del backend: no se
han inventado destinos por aplicación ni cambiado configuración de correo.

## Evidencia final

- 21 escenarios integrados con MySQL 8.4.11 temporal, Express real y frontend compilado
  en producción: aprobados. Incluyen concurrencia de consumo, suspensión y expiración
  durante bloqueos reales observados, rollback y éxito posterior al commit sin sesión.
- 107 pruebas de backend, 29 de publicación/contratos frontend y 66 pruebas de navegador
  con API simulada: aprobadas. Typecheck y compilación de ambos componentes: correctos.
- Las tres apps solicitaron recuperación, iniciaron sesión, cambiaron contraseña y
  cerraron sesión contra la API real. Usuario/Business ejercitaron reset con sesión,
  respuesta mínima sin sesión y rechazo de cuenta suspendida sin afirmar éxito.
- Una cuenta normal no obtuvo permisos Admin; una suspensión bloqueó acceso y refresh.

El reproductor está en [la rama de #9](https://github.com/WIT-Colombia/WIT/blob/codex/security-password-reset-suspended/docs/password-reset-suspension-security.md).
Crea una instancia MySQL nueva, valida su identidad y la destruye al terminar; no
consulta ni modifica las bases del proyecto. Los correos solo se capturan en memoria.

## Riesgos pendientes

La prueba del navegador usa un puente local que conserva los atributos reales de cookies
al mapear los dominios simulados. No demuestra Nginx, TLS, cookies Secure, CORS ni OAuth
reales del hosting. Quedan pendientes la entrega de correo, los valores de producción,
la topología OAuth y pruebas operativas con su configuración final, sin activarlas aquí.
Tampoco elimina la ambigüedad de red durante commit/respuesta o los riesgos de esperas y
deadlocks con otras operaciones del sistema. Consultar la auditoría de #9.

Tras la corrección de Admin no quedan incompatibilidades bloqueantes en los contratos
probados. Ambos PR pueden pasar a revisión final de código; esto no autoriza merge o
publicación y no incorpora un PR dentro del otro.
