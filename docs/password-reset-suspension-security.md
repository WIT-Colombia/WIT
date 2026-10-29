# Recuperación de contraseña y suspensión: corrección separada

Base: staging `7ccd68aa4aa7bb7f2ab6a417533a787025f6ab8b`.
Rama: codex/security-password-reset-suspended. Este cambio no incluye ni modifica el PR #8.
Preparado para revisión: no hay merge, despliegue, migración ni intervención en EC2/polling.

## Causa y corrección

El token se emitía únicamente para cuentas activas, pero su consumo posterior no volvía
a comprobar el estado de la cuenta. Un usuario suspendido después de recibir el enlace
podía cambiar su contraseña; después, getCurrentUser rechazaba la respuesta con 401.
Una lectura adicional para el aviso de seguridad también podía fallar después del commit.

Ahora el consumo del token, el cambio de la identidad EMAIL verificada y la revocación de
sesiones permanecen en una sola transacción. Antes de cualquier escritura, SELECT ... FOR
UPDATE obtiene el estado actual de la fila User y exige ACTIVE. Es una lectura bloqueante,
no la instantánea de repeatable-read creada por la consulta inicial del token. Suspensión
y eliminación adquieren el mismo bloqueo de fila al actualizar el estado del usuario.
Una cuenta no activa recibe el mismo INVALID_AUTH_TOKEN genérico, sin revelar su estado;
no se consume el token, no se cambia el hash ni se crea una sesión para esa cuenta.

La expiración se vuelve a comprobar mediante consumo condicional después de esperar el
bloqueo; otro consumo o la emisión de un token nuevo impiden reutilizar el anterior.
La actualización de identidad exige EMAIL verificada y al menos una fila afectada;
los fallos de escritura o revocación propagan error y la transacción debe revertir todo.

Después del commit, el aviso usa los datos capturados en la transacción, sin otra lectura
de BD. Fallar el aviso no cambia el resultado de la contraseña. Cargar perfil y crear sesión
son una fase opcional: si falla cualquiera, se responde 200 con {user:{id},autoLogin:false}
y se limpia la cookie de renovación en la respuesta. Nunca se devuelve un token en ese caso.
Solo se llega a esa fase si el restablecimiento ya se completó; un fallo de la transacción
sigue siendo un error, no una confirmación.

Se conserva el autologin para cuentas activas, pero la nueva sesión se crea en una segunda
transacción con otra lectura bloqueante ACTIVE. Eso cubre la suspensión entre el commit
del cambio y la emisión de sesión. La creación y firma se completan dentro de esa transacción;
una excepción revierte la sesión. getCurrentUser, requireAuth y refresh conservan sus controles
de estado. Una suspensión posterior a la emisión sigue bloqueando el uso de la sesión.

## Compatibilidad y controles conservados

No cambia ningún endpoint ni entrada: token/password/rememberMe y validaciones existentes.
Se conservan aleatoriedad y SHA-256 del token, vencimiento de 30 minutos, tipo PASSWORD_RESET,
uso único, contraseña Argon2id, verificación EMAIL, límites de intentos, orígenes autorizados,
revocación de sesiones y atributos de cookies. No se convierte una cuenta suspendida en ACTIVE.

El resultado normal mantiene {user,accessToken}. El resultado sin autologin mantiene
{user,autoLogin:false}; si no se puede leer el perfil, user contiene solo id. Los consumidores
deben tratar autoLogin:false como contraseña guardada e inicio de sesión manual, sin inferir
que tienen un perfil completo. El manejo robusto de esa situación en las pantallas de frontend
se prepara por separado en PR #8; no se incorpora a esta rama ni se modifica ese PR.

## Validación realizada sin BD real

- Typecheck y compilación del backend: correctos.
- Suite backend: 107 pruebas correctas, incluyendo 19 nuevas.
- Nuevas pruebas: cuenta activa; SUSPENDED/DELETED; suspensión entre búsqueda y bloqueo;
  token vencido, consumido, propósito incorrecto, ausente; EMAIL no verificada; expiración
  durante espera; competencia y reutilización; rollback por fallo de identidad/revocación;
  identidad desaparecida; usuario ausente; autologin activo; fallo de lectura posterior;
  suspensión antes de emitir sesión y fallo de sesión posterior al cambio.
- Los tests existentes siguen comprobando que requireAuth rechaza usuarios suspendidos.
- Los dobles transaccionales son en memoria y validan orden, condiciones y resultados.
  El puerto configurado en la prueba local no tiene servicio de BD y no se usaron datos reales.

No se ejecutaron migraciones, transacciones contra BD real ni comandos AWS/EC2.
Los checks existentes de GitHub pueden utilizar su MySQL efímero de CI para sus comprobaciones
habituales; no acceden a la base de datos del proyecto en producción.

## Riesgos y pendientes de revisión

- La revisión conjunta posterior validó SQL, bloqueo y concurrencia con MySQL 8.4.11
  temporal real y el adaptador Prisma. No se ha validado la configuración del servidor
  productivo; las pruebas originales en memoria, por sí solas, no demostraban esas garantías.
- Los bloqueos de fila pueden introducir esperas o deadlocks ante operaciones con otro
  orden de bloqueo. Un error antes del commit debe fallar cerrado; no se añadieron reintentos.
- Si se suspende después del cambio pero antes de la sesión, la contraseña queda cambiada,
  la cuenta sigue suspendida y el resultado es 200 sin autologin. Esa respuesta acredita
  el cambio, nunca el derecho a acceder a una cuenta suspendida.
- Un fallo de transporte durante el commit o al enviar la respuesta HTTP puede dejar al
  cliente sin confirmación aun si el motor confirmó la transacción. Este cambio no promete
  resolver esa ambigüedad de red; un reintento no puede reutilizar el token consumido.
- Verificar integración de correo y autologin/cookies solo en un entorno aislado aprobado.
  No se cambia PASSWORD_RESET_URL ni se resuelven los pendientes de OAuth/infraestructura.
- Revertir este cambio sería revertir código mediante otro PR; no requiere revertir esquema.
  Ningún procedimiento de despliegue o rollback de producción fue ejecutado ni autorizado.


## Revisión conjunta de PR #8 y #9

Se ensayó una copia temporal con el frontend de #8 y el backend de #9, sin hacer merge
ni modificar staging. Se detectó en Admin una doble renovación simultánea de la misma
cookie (React StrictMode/concurrencia): una respuesta 401 podía anular otra restauración
correcta. La deduplicación y sus dos pruebas se incorporan SOLO en #8, no en esta rama.
El backend mantiene la rotación estricta de tokens; no se habilita reutilización.

Resultados finales: 21 escenarios integrados reales aprobados con MySQL 8.4.11 e InnoDB,
Express y el frontend compilado en producción. También pasaron 107 pruebas de backend,
29 de publicación/contratos frontend y 66 de navegador con API simulada, además de tipos
y compilación de ambos componentes. El contrato 202 de solicitud, 200 de reset con sesión,
200 mínimo {user:{id},autoLogin:false}, 204 de cambio y rechazos 400/401/403 son compatibles.

Cobertura real: hash y cookie, refresh y revocación, no acceso administrativo de una cuenta
normal, bloqueo de acceso/refresh después de suspensión, cuentas suspendidas/eliminadas,
tokens vencidos/usados/otro propósito, dos consumos simultáneos, suspensión y expiración
durante una espera InnoDB observada en performance_schema, rollback real ante un fallo
inyectado de revocación y fallo de perfil posterior al commit. Las pantallas reales de
Usuario/Business aceptan tanto autologin como éxito mínimo y no confirman un rechazo.
Las tres apps solicitan recuperación, inician sesión, cambian contraseña y cierran sesión
contra Express y MySQL reales. Los correos se capturan en el emisor de desarrollo en memoria.

La interceptación del navegador sirve archivos y encamina /api/v1 al Express local;
transfiere las cookies host-only al dominio simulado conservando sus atributos. Esto no
prueba el Nginx, TLS, Secure o CORS reales de producción ni Google OAuth o la entrega por
Resend. Esos puntos continúan pendientes sin AWS. No se encontraron otras incompatibilidades
bloqueantes en los contratos ejercitados, tras el ajuste de Admin en #8.

### Repetición segura

Con MySQL server/client, Python 3, Node 24, dependencias y Prisma Client generados:

```
cd backend
npm run test:integration:password-reset
```

Para incluir el frontend, compilar una copia independiente de #8 en modo producción
(sin NODE_ENV=development), instalar Chromium de Playwright en esa copia y ejecutar:

```
npm run test:integration:password-reset -- --frontend-root /ruta/absoluta/al/frontend-del-pr8
```

El runner NO acepta DATABASE_URL ni servidores existentes como destino. Crea datadir,
socket, puerto, usuario y esquema propios; valida @@datadir/@@port antes de escribir;
genera DDL desde cero fuera del repositorio y lo aplica SOLO a ese esquema desechable.
No ejecuta ni cambia el historial de migraciones del proyecto. El harness exige además
un marcador del directorio y comprueba la identidad del servidor antes de crear fixtures.
Al terminar detiene únicamente su proceso hijo y elimina su directorio temporal, incluso
si fallan las pruebas. En la revisión se verificó la limpieza. No se modificaron ni
consultaron bases de datos del proyecto y no se accedió a AWS/EC2.
