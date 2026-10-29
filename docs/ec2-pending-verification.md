# EC2: verificaciones pendientes, sin autorización de cambios

Registro: 29 de octubre de 2026, America/Bogota.
Instancia indicada por el usuario: `i-0bc484a461397e2b1`, región `us-east-2`.

## Límite de esta revisión

No se accedió a AWS ni se ejecutaron comandos en EC2 durante esta revisión.
No se cambió producción, no se reiniciaron servicios y no se alteró el polling.
Los comandos siguientes son un plan de consulta pendiente: antes de usarlos,
presentarlos al usuario y obtener autorización de ejecución en AWS. No requieren
modificar archivos y no incluyen ninguna orden de despliegue o restauración.
No solicitar credenciales por chat ni mostrar archivos .env.

## Evidencia disponible fuera de EC2

El PR [#8](https://github.com/WIT-Colombia/WIT/pull/8) permanece en borrador,
sin merge y sin auto-merge. La base consultada es staging en
`7ccd68aa4aa7bb7f2ab6a417533a787025f6ab8b`.

Para el commit inicial `e4ee69cc83d14f8b1c5df64c5d6005898b90a2c4`:

| Control GitHub | Resultado |
| --- | --- |
| [Paquetes de cuatro apps](https://github.com/WIT-Colombia/WIT/actions/runs/40878061249) | success |
| [Backend CI](https://github.com/WIT-Colombia/WIT/actions/runs/40878060830) | success |
| [Verificación de staging](https://github.com/WIT-Colombia/WIT/actions/runs/40878060709) | verify: success; deploy: skipped |

Estos resultados acreditan compilación y pruebas del repositorio, no despliegue,
versión activa, salud actual de EC2, entrega de correos ni restauración del servidor.
Una actualización del PR debe revisarse con sus propias ejecuciones de CI.

## Consultas propuestas, todavía NO ejecutadas

Desde una futura sesión SSM abierta en la instancia y región correctas:

```bash
readlink -f /opt/xamuko/deploy/current
sudo cat /opt/xamuko/deploy/current/COMMIT
sudo systemctl show xamuko-api.service --no-pager -p ActiveState -p SubState -p Result -p TimeoutStopUSec
sudo systemctl show xamuko-poll.service --no-pager -p ActiveState -p Result
sudo systemctl is-active xamuko-poll.timer
sudo systemctl list-timers xamuko-poll.timer --all --no-pager
sudo test -f /opt/xamuko/deploy/POLL_ENABLED && echo 'POLL_ENABLED presente'
sudo tail -10 /opt/xamuko/deploy/history.log
sudo cat /opt/xamuko/deploy/status.json
sudo journalctl -u xamuko-poll.service --no-pager -o cat -n 30
sudo journalctl -u xamuko-api.service --no-pager -o short-iso -n 30
curl --max-time 15 -fsS http://127.0.0.1:3000/api/v1/health
curl --max-time 15 -fsS https://xamuko.com/ -o /dev/null -w 'Web: HTTP %{http_code}\n'
curl --max-time 15 -fsS https://xamuko.com/api/v1/health
curl --max-time 15 -fsS https://xamuko.com/api/v1/public/businesses -o /dev/null -w 'Catálogo: HTTP %{http_code}\n'
```

Registrar cada resultado y código de salida; un archivo ausente también es un
hallazgo, no una instrucción para crearlo. Revisar los diarios sin copiar datos
personales o posibles secretos al PR. El marcador presente no demuestra por sí
solo que el polling esté activo: correlacionar timer, servicio, estado e historial.

## Criterios de aceptación y cuestiones abiertas

- [ ] Confirmar instancia/región de la sesión antes de cualquier consulta.
- [ ] Identificar el SHA activo: enlace current, COMMIT e historial deben concordar.
- [ ] Confirmar estado de API y respuestas de salud interna y pública.
- [ ] Confirmar HTTP 200 en web y catálogo; comprobar assets y rutas profundas.
- [ ] Registrar estado del polling sin detenerlo, iniciarlo ni reconfigurarlo.
- [ ] Revisar el último resultado de publicación y errores observables.
- [ ] Buscar en los registros ya existentes evidencia de cierre correcto de la API;
      no provocar un reinicio para medirlo. Sin evidencia, la medición queda pendiente.
- [ ] Identificar la versión previa recuperable y los assets conservados antes de
      proponer una reversión. No asumir que bootstrap o un SHA antiguo sigue disponible.
- [ ] Aclarar qué restauración desea verificar el usuario y cuál es su versión objetivo.

No se ha demostrado una restauración nueva ni se ha elegido un objetivo de rollback.
Para una futura restauración autorizada, acordar primero versión y alcance,
presentar las órdenes exactas y los archivos/referencias que cambiarían y explicar
cómo conviviría con el polling. Después exigir coincidencia con el SHA objetivo,
API activa, salud correcta, web/catálogo HTTP 200, assets y rutas correctos y registro
de la operación. Una consulta HTTP o un CI correcto no bastan para demostrarla.

## Pendientes de publicación independiente

El PR prepara paquetes; no activa dominios. Confirmar los orígenes propuestos,
API, CORS, cookies, OAuth y Maps por aplicación. Pruebas de login/logout, recarga de
rutas SPA y reversión real requieren un entorno aislado aprobado. No realizar estas
pruebas con cuentas o escrituras en producción. No ejecutar workflow_dispatch ni
habilitar despliegues como parte de las comprobaciones de GitHub.
