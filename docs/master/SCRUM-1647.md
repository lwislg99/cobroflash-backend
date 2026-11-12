# SCRUM-1647 · CSP paso 2, mitad del equipo de Javier · tramo J2: las tres páginas de pago sin código en línea

**Medido contra:** `origin/main` = `31858144e08886024d72808c5da1479a5122219a` · 2026-11-12T11:34:50Z (cabecera `Date` de GitHub; la rama lleva ese main mergeado y ninguno de sus commits toca los ficheros de este tramo)

A9: aviso → cicatriz J2 «otra vez la muestra local de guards elegida a mano: no llevaba scrum553, y un control de mi test con el `>` pegado tumbó el obligatorio de #3098» — no se pudo comprobar: esta vez scrum553 SÍ estaba en la muestra y cazó tres etiquetas literales antes de empujar; que esté o no lo sigue decidiendo la sesión, y ningún guard obliga a correrlo

Lo escribe J2 (`jv-j2bs`). Sólo el tramo J2 del ticket (`payBank`, `payBizum`, `payInvoice`); las líneas de J1 (`invoicesAdmin.routes.ts`) y J3 (`public/login.html`) siguen sin hacer.

## PASO 0

- Ticket, comentarios y etiquetas leídos el 12-nov: `area-j1`, `area-j2`, `area-j3`, `equipo-javier`. Sin rama `scrum-1647*`, sin PR, sin commits en main.
- La cabecera del paso 1 (SCRUM-1637) está en main: `src/core/http/csp.ts`, montada en `src/app.ts` (`app.use(cspSoloInforme)`), y el test de este tramo la ve en la respuesta de `/pay/bank`.
- Medido en `origin/main` = `9cdf6a24d` (el de arranque), por `grep` del fuente de las tres rutas:

| fichero | `on*=` | `<script>` en línea |
| --- | --- | --- |
| `payBank.routes.ts` | 3 · `onclick="copyText(…)"` (CLABE, IBAN, referencia) | 1 (`copyText`) |
| `payBizum.routes.ts` | 1 · `onerror` del logo | 1 (los botones de copiar) |
| `payInvoice.routes.ts` | 1 · `onerror` del logo | 0 |

El ticket contaba los 5 `on*=` y no los dos `<script>`; con `script-src 'self'` caen igual, así que entran en este tramo.

## Qué se ha cambiado

Patrón de S1 en SCRUM-1646 (`albaranFirmaNavegador.ts`, PR #3048):

- **`src/modules/billing/app/routes/pagoNavegador.ts` (nuevo):** el guion, una cadena CONSTANTE (`String.raw`, sin `${`). Lo sirve `GET /pay/js/pago.js?v=<huella>` desde el router de `payInvoice` (`immutable` sólo con la huella buena; si no, `no-cache`). Cada página lo enlaza en su `<head>` con `data-pagina` = `banco` | `bizum` | `factura` (constante del servidor, nunca un dato).
- **Copiar:** los botones de `/pay/bank` llevan `data-copy="${esc(…)}"` en lugar del `onclick`; el guion escucha el clic por delegación. Mismo comportamiento que antes en cada página: en `/pay/bank`, clase `copied`, 2000 ms y el respaldo con `execCommand`; en `/pay/bizum`, 1600 ms y sin respaldo.
- **El logo que no carga:** sin `onerror`; el guion escucha `error` en FASE DE CAPTURA en el documento (el `error` de una imagen no burbujea) y oculta el `.logo-img`. El `<script src>` va en el `<head>`, síncrono, así que el escuchador existe antes de que se cree el `<img>`.
- **Ningún texto nuevo ni cambiado** (regla 39): «¡Copiado!» y los rótulos son los de antes. Nada del cobro tocado: ni consultas, ni estados, ni el POST de Bizum.
- **`src/core/http/publicAccessDeclarations.ts` (carril S1): UNA línea**, la declaración de `GET /pay/js/pago.js` como `no-sensitive-resource`. Sin ella `scrum98` sale rojo (es lo que tiene #3048 en rojo con `/albaran/js/firma.js`: job `130022347058`). Excepción firmada por el fundador en SCRUM-1647 c.21631, declarada en `docs/equipo/dos-equipos.md` §3.4 y regenerada con `node scripts/carriles.mjs generar`.

## El test, en rojo primero

`tests/scrum1647-pago-sin-manejadores-en-linea.test.mjs`, 9 casos, por la ruta de verdad (`dist/app.js` con sus montajes; sólo prisma es un doble en `require.cache`; ni BD ni red). Cuenta `on*=` dentro de ETIQUETAS y `<script>` sin `src` en el HTML servido de `/pay/bank` (IBAN y CLABE), `/pay/bizum` y `/pay/invoice`, con un control positivo sembrado (un HTML fabricado con un `onerror` y un `<script>` en línea que tiene que dar 1 y 1). Comprueba que el `data-copy` descodificado es lo que copiaba el `onclick` (IBAN, CLABE y una referencia con `&"<'`), sirve el guion y lo ejecuta en `node:vm` contra un DOM doble.

- Rojo: las tres rutas de `origin/main` (`9cdf6a24d`) compiladas con el test de la rama: **5 caen** (las cuatro páginas y el guion servido), 4 pasan (el control sembrado y los 3 de comportamiento, que miden el guion nuevo y no las rutas). Con la rama, 9 de 9.
- Mutaciones: las 6 de `MUTACIONES_QUE_ME_TUMBAN`, corridas con `correr` y `aplicarUna` de `scripts/meta-guard-mutaciones.mjs` (línea base limpia: 9 pasan, 0 caen, 0 saltan): **6 de 6 tumban su caso**, sin colaterales. Árbol y `dist/` restaurados (comprobado con `git status` y buscando los textos mutados en el fuente y en el compilado: sólo salen en comentarios).
- Build con tipos (`tsc -p .`, sin `--noCheck`): salida 0, también después del merge de main.
- Muestra local: 35 ficheros (el nuevo, los de las páginas de pago, scrum98, 1637, 237, 976, 1387, 1415, 411, 553, 700, 719, 723, 737, 747, 812, 921c, 1177, 1295, 1295b…): 296 casos, 293 pasan, 2 se saltan (scrum85 y scrum90, gateados por base) y **1 cayó: scrum553**, por tres etiquetas literales con el `>` pegado en mi test. Arreglado en el test (la etiqueta esperada sale de `etiquetaGuionDePago`), y después 58 de 58 en los seis que importan, `guards:entrada` 15 de 15 y los 5 de árbol entero que nombra, 38 de 38. Suite entera local: NO CORRIDA (día de cola; lo dice el obligatorio).

## No medido, y se dice

- **El navegador de verdad.** El comportamiento se mide en un DOM doble, no en Edge ni Chrome. Que con la CSP puesta la consola de las tres páginas no dé informes de `script-src` (la aceptación del ticket) es un recorrido en yaqu.app tras el merge, y no lo he hecho.
- **`style-src 'self'`**: las tres páginas siguen con `<style>` y `style=` en línea, y la política del paso 1 también los informa. El ticket pide sólo `script-src`; queda para el tramo de estilos, si lo hay.
- `scrum85` y `scrum90` (las rutas de pago contra base) no han corrido en local: están gateados.
