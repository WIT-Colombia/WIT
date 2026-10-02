# WIT Frontend

Monorepo de frontend para WIT Usuario, WIT Negocios y WIT Admin. Cada app se ejecuta como una SPA Vite independiente; los paquetes bajo `packages/` contienen código compartido.

## Requisitos

- Node.js 20.19+ o 22.12+
- npm 10+

## Inicio

```sh
npm install
npm run dev:usuario
npm run dev:negocios
npm run dev:admin
```

Cada app puede ejecutarse en su propio terminal. Para comprobar todas:

```sh
npm run typecheck
npm run build
```

## Estructura

- `apps/usuario`: experiencia de descubrimiento para consumidores.
- `apps/negocios`: futura herramienta de gestión comercial.
- `apps/admin`: futura herramienta administrativa.
- `packages/ui`: componentes y estilos compartidos.
- `packages/types`: tipos compartidos.
- `packages/utils`: utilidades compartidas.

Las rutas iniciales de Usuario reservan `/welcome`, `/location` y `/home`. Las pantallas se desarrollarán por etapas.
