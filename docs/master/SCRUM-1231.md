# SCRUM-1231 · El logo es una imagen subida, no una dirección que elige el profesional

**Medido contra:** `origin/main` = `64dc3211d039cedece0cccf9fa3fcaf7d491319d` · 2026-10-01T13:01:52Z

A9: aviso → cicatriz S1 «Un mutante que rompe la sintaxis del fichero muere igual que uno que funciona.» — no se pudo comprobar: el mutante se fabrica a mano en cada tanda y no pasa por ningún guard

Sesión S1 (`s1-1octd`, relevo de `s1-1octc`) · carril: `src/core/validation/schemas.ts` y `src/app.ts`
(S1 por `dos-equipos.md` §3) · rama `scrum-1231-logo-solo-imagen-subida`.

## El defecto, y si existía HOY (PASO 0)

`merchantProfileUpdateSchema.logoUrl` era un `union` de dos ramas: `z.string().url()` y el data-URI de
la imagen subida. Seis páginas públicas pintan ese valor en un `<img src>` (Bizum, selector de pago,
albarán, portal, aceptación del presupuesto y perfil público): el navegador del **cliente final** iba
a un servidor elegido por el profesional. Decisión de Javier (28-sep-2026): solo imagen subida.

Comprobado contra `origin/main` antes de tocar: el `union` seguía ahí (se había movido de la línea
472 a la 457; el contenido, igual).

Las tres preguntas del PASO 0 del ticket:

| Pregunta | Medido |
|---|---|
| ¿Hay merchants con URL externa guardada? | **NO MEDIDO**: ningún árbol de trabajo tiene la base de producción (regla 3). Por eso el arreglo no depende de la respuesta (abajo). La consulta, para quien sí la tiene: contar `Merchant` cuyo `logoUrl` no empieza por `data:image/png`, `jpeg`, `jpg` ni `webp` |
| ¿Qué ofrece la pantalla? | `settingsView.js` ya NO tiene campo de pegar enlace: el `input` es `hidden` y solo lo rellena «Subir logo». **`public/admin.html` SÍ** conserva un campo de texto «Logo (URL opcional)» que hace `PUT /admin/merchant`: desde este cambio, una URL escrita ahí da 400. Reportado, no tocado |
| ¿Algo depende de que sea una URL? | No. Los seis `<img>` aceptan un data-URI, y `loadLogoBuffer` (PDF) ya trata `data:` |

## Lo que el ticket no decía, y salió al medir

1. **`z.string().url()` no era «http(s)».** Acepta cualquier esquema. Por esa rama entraba un `data:`
   de cualquier tipo y tamaño —saltándose el tope de 1,5M de la otra rama— y un `javascript:`.
2. **La cuenta demo guarda un `data:image/svg+xml`**, sembrado por `scripts/seed-demo.mjs` sin pasar
   por el esquema. Entraba por la rama `url()`. Configuración manda `logoUrl` **siempre**, con lo que
   cargó: quitar la rama sin más habría dejado a la demo (y a cualquier logo heredado) con un 400 al
   guardar **cualquier** ajuste — el defecto de SCRUM-1161 otra vez. Es el punto 1 del PASO 0, y por
   eso el arreglo tiene dos mitades.

## Arreglo

- `schemas.ts`: `logoUrl` queda en la rama del data-URI (`png`, `jpeg`/`jpg`, `webp`, ≤ 1,5M). Fuera el `union`.
- `schemas.ts`: `sinLogoHeredadoIntacto(body, logoGuardado)`. Un `logoUrl` **idéntico** al guardado se
  lee como «no lo ha tocado» y se retira del cuerpo: ni se valida ni se escribe. No acepta nada nuevo.
- `app.ts`, `PUT /admin/merchant`: si el esquema rechaza **por el logo**, lee `logoUrl` de la fila de
  `req.merchantId` y reintenta con el cuerpo sin el heredado intacto. El camino normal no hace ni una
  consulta más.

Sin texto nuevo en pantalla: el 400 es el `validation_error` de siempre.

## Test — `tests/scrum1231-logo-solo-imagen-subida.test.mjs` (7 casos)

Control positivo (las cuatro extensiones subidas entran, `null` quita el logo) · 7 formas de «no es
una imagen subida», ninguna entra · el tope no se rodea · el heredado intacto no tumba el guardado y
no se reescribe · cambiar a otra URL externa se rechaza · la función no muta ni toca lo ajeno · la
ruta usa las dos piezas y lee por `req.merchantId`.

Mutantes sobre `dist`, con la BASE sin mutar primero (7 ok, 0 fallos):

| Mutante | Resultado |
|---|---|
| M1 · vuelve la rama `url()` (lo que hay en `main`) | 3 ok, **4 caen** |
| M2 · nunca se retira el heredado | 5 ok, **2 caen** |
| M3 · se retira aunque no coincida | 5 ok, **2 caen** |

## El error propio

El primer M1 lo escribí mal y **rompía la sintaxis** de `schemas.js`: salió `not ok 1` a nivel de
fichero, 0 casos corridos. Leído deprisa es «el mutante muere». No medía nada: lo delató que `ok=0`.
Rehecho con el `union` de verdad. De ahí la cicatriz.

## De paso, en este PR (no es de este ticket)

- La lección y las cicatrices de SCRUM-1355 que quedaron fuera del repo: apéndice `SCRUM-1355b` y
  `docs/equipo/cicatrices/S1.md`.
- Una frase en A10, a petición del orquestador (medida por S2 en yaqu.app, presupuesto #203): «El
  `updatedAt` de una fila no es la versión de un trozo de esa fila». Las notas de un presupuesto se
  autoguardan y mueven el `updatedAt` de la fila, así que «Guardar plan» devolvía un 409 «versión
  superada» por la nota de la propia persona. Aviso de diseño para las 21 escrituras sin versión del
  censo de SCRUM-1285c; aquí no se cambia código por ello.

## Suelos

- ⚠️ **La ruta no se ejecuta en el test**: `app.ts` arranca el servidor entero. Se prueban sus dos
  piezas y, sobre el código sin comentarios, que la ruta las usa. La ruta de verdad se mira en
  yaqu.app tras el despliegue.
- ⚠️ **Esto cierra la ENTRADA, no lo ya guardado.** Un merchant con una URL externa guardada la sigue
  sirviendo en las seis páginas hasta que suba una imagen o se limpie la fila. Cuántos son, no medido
  (arriba). Las seis páginas son de varios carriles (S1, J2, J3): reportado en el ticket.
- Tanda **dirigida**, no completa: 11 ficheros, 100 casos, 0 fallos, 1 salto. El juez es el CI.
