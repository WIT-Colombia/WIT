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

- Validar el SQL/bloqueo y la concurrencia con MySQL 8.4 en un entorno aislado autorizado;
  el doble en memoria no prueba las garantías físicas del motor o del adaptador Prisma.
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
