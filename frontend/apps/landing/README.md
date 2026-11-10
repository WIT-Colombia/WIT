# Landing definitiva de XAMUKO

Cambios limitados a `frontend/apps/landing`. Reutiliza React, Vite y la configuración de dominios existente. No requiere servicios, variables ni dependencias adicionales.

## Diseño y recursos

La estructura, textos, tarjetas, iconos, botones, navegación y footer son componentes HTML/SVG/CSS reales. La imagen proporcionada no se muestra como una página ni como su fondo completo.

`public/assets/definitiva/reference-art.jpg` conserva la referencia original. Se utiliza únicamente en ventanas SVG que recortan las ilustraciones de los dispositivos y las personas; los textos y controles de la landing se construyen por separado. La ilustración de dispositivos se identifica como ilustrativa y sus cifras como ejemplos. El símbolo oficial se conserva en `official-logo.png`, optimizado a partir del recurso existente.

Los paisajes aislados `colombia-city.jpg` y `community-city.jpg` se prepararon con la herramienta integrada ImageGen y se optimizaron a JPEG. Prompts utilizados:

- Ciudad: extraer únicamente el paisaje de la referencia —ciudad colombiana, montañas azules, cielo luminoso y torre de iglesia a la derecha— sin dispositivos, personas, texto, logotipos ni interfaz.
- Banner: extraer únicamente el paisaje del banner inferior de la referencia, conservando montañas, atardecer rosado y violeta, ciudad, iglesia a la derecha y ondas moradas a la izquierda; eliminar todo texto, iconos y botones y reconstruir el paisaje detrás.

La primera vista conserva la composición de la referencia. Planes y Preguntas se abren como secciones mediante sus enlaces y soportan acceso directo con `#planes` y `#preguntas`. Las preguntas usan elementos `details` y `summary`. Los selectores de acceso y registro se cierran con Escape, clic fuera o navegación. Las animaciones respetan `prefers-reduced-motion`.

La suscripción a novedades se omite porque no existe un servicio de newsletter conectado. PRO se describe sin ofrecer una contratación que no está disponible.

## Rutas verificadas

| Acción | Destino oficial |
| --- | --- |
| Explorar | `https://user.xamuko.com/home` |
| Registro de Usuarios | `https://user.xamuko.com/register` |
| Login de Usuarios | `https://user.xamuko.com/register?mode=login` |
| Registro de Business | `https://business.xamuko.com/registro` |
| Login de Business | `https://business.xamuko.com/login` |
| Ayuda de Business | `https://business.xamuko.com/ayuda` |
| Soporte de Business | `https://business.xamuko.com/soporte` |
| Términos | `https://user.xamuko.com/legal/terms` |
| Privacidad | `https://user.xamuko.com/legal/privacy` |

Se contrastaron con los routers de las aplicaciones y el selector `mode=login` de Usuarios. Las nueve direcciones respondieron HTTP 200 el 10 de noviembre de 2026. Ayuda y soporte conservan la protección de sesión de Business. El entorno local sigue utilizando los puertos de desarrollo existentes. Se cubren tanto `xamuko.com` como `www.xamuko.com` sin modificar DNS ni despliegues.

## Comprobaciones

Desde `frontend`:

```sh
npm run test --workspace=@wit/landing
npm run typecheck --workspace=@wit/landing
npm run build --workspace=@wit/landing
```

- 6 pruebas de la landing correctas: destinos reales, fragmentos, enlaces, preguntas y dominios locales/oficiales.
- 98 pruebas existentes del frontend correctas: Admin (35), Usuarios (54), Business (6), persistencia de ubicación (3).
- Landing, Usuarios y Business pasan tipos y compilación. Las comprobaciones generales fallan por un error JSX preexistente en `frontend/apps/admin/src/pages/AdminBusinessesPage.tsx:113`. El archivo es idéntico al de la rama de destino, con blob `7f1831cd4b8ca0a9406cb792d90e8d645796eaf5`; no se modifica.
- Revisión real en Chrome a 320, 390, 768, 820, 1024, 1169 y 1440 px; sin desbordamiento horizontal tras corregir el ancho mínimo y los botones del hero.
- Verificados selectores, Escape, clic fuera, menú móvil, navegación por secciones y apertura de preguntas; sin errores de consola observados.
- Metadatos SEO, canonical, Open Graph, idioma español, enlace de salto, foco visible y áreas táctiles móviles.

Capturas reales del código implementado: [escritorio](review/desktop.png), [iPad](review/ipad.png), [móvil](review/mobile.png) y [preguntas](review/faq.png). Las revisiones de iPad y móvil se hicieron emulando el tamaño de pantalla en Chrome; no se comprobó Safari en dispositivos físicos.

No se ha desplegado ni fusionado este cambio.
