# SCRUM-1004 · «Cómo llegar» en la ficha del cliente (hoy solo dentro de un Trabajo)

**Medido contra:** `origin/main` = `5588e3263847bd40ea906d325e4f83c883c24e6e` · 2026-09-22T08:42:00Z (hora de GitHub, cabecera `Date:` de `gh api -i zen`).
**Rama:** `scrum-1003-vcard-como-llegar`, montada sobre `scrum-1033-ficha-datos-y-etiquetas` = `bbeb3bb83cc31d2f2255be877ef71501c37bde34` (PR B, misma rama que SCRUM-1003).
**Microcopy:** ✅ **texto firmado** por el orquestador por delegación del fundador (22-sep-2026, comentario de Jira en SCRUM-1004): enlace **«Cómo llegar»** — reuso literal del MECANISMO de `jobRailBlocks.js` (mismo proveedor, Google Maps por texto, sin clave ni mapa incrustado), con su propio rótulo (el del Trabajo sigue siendo «Abrir en mapa», sin tocar).

## Paso 0: el defecto existía hoy

El enlace a Google Maps por dirección solo existía en el carril del Trabajo (`jobRailBlocks.js:94`). La ficha del cliente no lo tenía: quien la abre antes de ir a verlo tiene que copiar la dirección a mano.

## Por qué la fórmula NO se comparte con `jobRailBlocks.js` (decisión con su motivo)

`jobRailBlocks.js` es funciones puras **sin ninguna dependencia** a propósito (su propia cabecera lo dice: «para poder probarlas en `npm test` sin base y sin navegador») y se `require()` a pelo en `tests/scrum424-donde-tiene-dato.test.mjs`, sin `window`. Engancharlo a un global de `api.js` le rompería esa garantía por una fórmula de una línea. Se extrajo `hrefAbrirEnMapa(direccion)` a `api.js` **solo para la ficha del cliente** (que ya carga `api.js` en todos sus contextos, tests incluidos) y `jobRailBlocks.js` se dejó exactamente como estaba. La duplicación que queda (la misma URL de Google Maps escrita en dos sitios) está documentada en los dos ficheros con referencia cruzada: si el proveedor cambia, se cambia en los dos.

## Lo que cambia

| fichero | qué |
|---|---|
| `public/dashboard/js/api.js` | `hrefAbrirEnMapa(direccion)`, publicada en `window`. |
| `public/dashboard/js/customerDetailView.js` | enlace `#c360-como-llegar` (`.contacto-link`, `target=_blank`) junto al chip «Dirección» de SCRUM-1033 — **solo si hay algún campo de dirección** (ausente ≠ vacío, igual que el resto de chips de esa cabecera). |
| `tests/scrum1003-1004-vcard-como-llegar.test.mjs` (nuevo, compartido con SCRUM-1003) | con dirección: el enlace existe, lleva el texto firmado y su `href` es EXACTAMENTE `hrefAbrirEnMapa(direccionTexto)` (control cruzado con la misma fórmula que ya prueba `jobRailBlocks.js` en SCRUM-424, dos sondas independientes de la misma URL); sin ningún campo de dirección: el enlace no existe. |

## Verificado en rojo

`tests/scrum424-donde-tiene-dato.test.mjs` y `scrum318-rail-contenido.test.mjs` (11 tests de `jobRailBlocks.js`) corridos ANTES y DESPUÉS de tocar `api.js`: sin cambios, siguen en verde — confirma que no se tocó su comportamiento. Mutación real sobre `customerDetailView.js`: cambié el `if (direccionTexto)` que envuelve el chip y el enlace por `if (true)` (con `direccionTexto` vacío, el chip queda «Dirección: » y el enlace se pinta igual) — cayeron los dos tests que dependen de esa rama: el de SCRUM-1004 («sin dirección, NO hay enlace») y el de SCRUM-1033 («cliente casi vacío, sin chips»); restaurado, los dos vuelven a verde.

## Pendiente

Verificar en yaqu.app: abrir un cliente con dirección, pulsar «Cómo llegar» y comprobar que abre Google Maps con la dirección correcta.
