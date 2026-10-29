# Recuperación y cambio de contraseña: auditoría del PR #8

Alcance: solo frontend y pruebas aisladas. Sin cambios en backend, BD, infraestructura,
AWS/EC2, DNS, polling o staging. No se enviaron correos reales ni se cambiaron contraseñas
reales. El PR continúa como borrador para revisión, no para activar producción.

## Contratos existentes inspeccionados

Las rutas están en backend/src/modules/auth/auth.routes.ts y auth.controller.ts;
la validación en auth.schemas.ts y la operación en auth-token.service.ts y account.service.ts.

| Operación | Endpoint POST bajo /api/v1 | Respuesta de éxito |
| --- | --- | --- |
| Solicitar recuperación | /auth/password-reset/request, {email} | 202, {message}; aceptación genérica, NO entrega confirmada |
| Restablecer por token | /auth/password-reset/confirm, {token,password,rememberMe} | 200, {user,accessToken} o {user,autoLogin:false} |
| Cambiar autenticado | /auth/change-password, {currentPassword,newPassword} | 204 vacío; requiere sesión, origen autorizado y límite de intentos |

Registro e inicio de sesión siguen utilizando /auth/register y /auth/login. Admin
comprueba /admin/me después de login: una identidad normal no obtiene acceso administrativo.
No se necesita crear endpoints para corregir las pantallas simuladas encontradas.

El token emitido por backend tiene 48 bytes aleatorios, se guarda mediante SHA-256,
vence a los 30 minutos y es de uso único. Emitir uno nuevo invalida los anteriores
activos. El consumo comprueba tipo, expiresAt y consumedAt y usa una actualización
condicional dentro de transacción. Restablecer revoca sesiones previas; cambiar
contraseña verifica la actual con Argon2id, rechaza reutilizarla y revoca otras sesiones.
Esto se constató leyendo el código; no se ejecutó una transacción real de BD.

Los límites existentes son token de 32 a 256 caracteres y contraseña de 8 a 128.
El navegador solo comprueba estructura/longitud: el servidor decide autenticidad,
vencimiento y uso previo. INVALID_AUTH_TOKEN no distingue entre inexistente, vencido
y usado; la UI conserva ese mensaje sin inventar un diagnóstico más específico.

## Problemas corregidos

- Admin: recuperación y cambio solo actualizaban estado local. Ahora hacen el POST
  correspondiente y esperan su resultado. Se quitó el correo personal precargado y
  se comprueba la confirmación de contraseña antes de enviar el cambio.
- Business: el cambio autenticado era simulado; ahora utiliza el endpoint existente
  con bearer en memoria y cookies. Se eliminaron temporizadores de navegación en
  competencia y se conserva el token antes de limpiar la URL.
- Usuario/Business: correo editable al recuperar sin sesión; ya no se depende de un
  correo recordado o de una cuenta de demostración. La aceptación es genérica y ya
  no afirma que se entregó un mensaje. No se redirige prematuramente tras solicitarlo.
- Usuario: /reset-password sin token no cae en el modo de cambio autenticado. Muestra
  el problema y bloquea el envío. Se eliminó la supresión de ciertos errores de sesión.
- Restablecer en Usuario y Business: una confirmación válida de guardado se conserva
  aunque falle la posterior restauración de sesión; se limpia el estado local obsoleto.
  El componente legado ResetPassword (no montado actualmente) mantiene el mismo criterio.
- Las operaciones usan un contrato compartido que exige 202 con mensaje, 200 con
  confirmación estructurada o 204 vacío, según corresponda. Un HTML 200 de proxy,
  un JSON vacío, un error o una conexión fallida nunca se convierten en éxito de UI.
  429 conserva el tiempo de espera enviado por el servidor.

No se cambian los mecanismos de registro/login ni se crea un alta pública de Admin.
Los tokens permanecen en memoria del formulario y se retiran de la URL. No se guardan
en localStorage, no se adjuntan a enlaces externos ni se usan parámetros next para
redirigir estos formularios; sus destinos posteriores son rutas internas fijas.

## Backend: corrección separada preparada en PR #9, sin integrar

**Hallazgo en el backend base de staging: cuenta que deja de estar activa después de emitir el enlace.** sendPasswordResetRequest
solo emite para una cuenta ACTIVE, pero resetPassword no vuelve a comprobar ese estado
antes de consumir el token y modificar la contraseña. Después del commit, el controlador
llama a getCurrentUser, que rechaza una cuenta suspendida/eliminada con 401. Por tanto,
la contraseña podría haberse modificado aunque el cliente reciba un error. Además, un
fallo de lectura posterior al commit puede impedir confirmar un cambio ya realizado.

La corrección autorizada se preparó por separado en el PR #9: exige ACTIVE bajo bloqueo
antes del consumo y de la emisión de sesión opcional, y mantiene una respuesta de cambio
completado cuando falla la fase posterior de perfil/sesión. La revisión conjunta validó
los contratos y la concurrencia con una instancia MySQL temporal y datos sintéticos.
Esta rama #8 no incorpora cambios de backend; ambos PR permanecen separados y sin merge.

## Correo y publicación: pendientes separados

El backend acepta solo {email}, sin aplicación/origen de retorno. email-service.ts usa
la única PASSWORD_RESET_URL configurada y la presentación por defecto de Usuario.
Por tanto, Business y Admin pueden solicitar recuperación mediante el servicio existente,
pero el enlace recibido lleva a ese destino común. No hay un endpoint ni un parámetro
existente para elegir libremente un retorno independiente por app. No se inventó uno.

Confirmar posteriormente que PASSWORD_RESET_URL apunta a un formulario válido de Usuario,
que el correo llega y que después se puede iniciar sesión en Business/Admin con la nueva
contraseña. Si se requieren correos/destinos por app, se propone un enum permitido de
aplicación y URLs de servidor preconfiguradas; nunca aceptar una URL arbitraria del cliente.
Ese cambio de backend/configuración requiere autorización previa y no está implementado.

Se mantienen pendientes las condiciones de OAuth, cookies/orígenes y proxy descritas en
frontend-auth-publication-review.md y las consultas de ec2-pending-verification.md.
No se ha accedido a producción para verificarlas. Las cuentas sin identidad EMAIL
verificada no reciben recuperación; para ellas se mantiene una respuesta genérica, sin
inventar un mecanismo para añadir contraseña a una identidad Google.

## Pruebas y criterio de revisión

Pruebas automatizadas con fetch/API simulados: aceptación genérica de solicitud solo tras
202, ausencia de éxito durante espera, errores 429/500/red/HTML, cambio real del contrato
solo tras 204, contraseña actual incorrecta, 401/403/500, confirmaciones distintas, token
faltante, rechazo de token inválido/vencido/usado y éxito de cambio aunque falle autologin.
Se comprueban cuerpo, bearer y rutas de API, sin enviar credenciales reales.

Ejecutar desde frontend:

```bash
npm run typecheck
npm run test:publication
npm run build
npm run test:publication:browser
npm run package:publication
```

Los resultados finales y ejecuciones de GitHub se registran en el PR. Las pruebas
simuladas verifican el comportamiento del frontend frente a los contratos existentes;
no demuestran entrega real de correo, cambios reales de BD ni resolución del hallazgo
de backend pendiente. El PR queda revisable; este documento no autoriza activación.

Resultado local final: typecheck y compilación de las cuatro aplicaciones correctos;
27 pruebas unitarias/de publicación, 66 pruebas de navegador con API simulada y 30
pruebas existentes de contratos/navegación/esquema aprobadas. Empaquetado de cuatro
apps e integridad de archivos correctos; git diff --check sin incidencias. Ningún
archivo de backend, deploy o workflow de despliegue de staging fue modificado.


Actualización de revisión conjunta: la corrección del hallazgo del backend está preparada
en el PR #9, sin integrar. Se validó con MySQL temporal real y el frontend de #8; ver
[joint-pr8-pr9-review.md](joint-pr8-pr9-review.md). Los dos PR siguen separados y sin merge.
