# SCRUM-405 · una sola forma de descargar, y un guard para que no nazca la quinta

**Fecha de esta constancia:** 9-ago-2026 · **Escrita por:** sesión 3 · **Código escrito aquí:** ninguno
**Medido contra:** `origin/main` = `8037a7a30049a442eb857733832c9eca0bf99ec2` · 2026-08-09T19:51:07+02:00

> ⚠️ **ENTRADA DE CONSTANCIA, NO DE TRABAJO.** El mecanismo lo construyó otra persona y esta
> entrada solo lo DEJA ESCRITO, citando su commit. No se reconstruye ni se interpreta.

**Commit:** `7b322a9f8edecf3b3f44a91d7ee4f0369ba92a89` · 2026-08-07 20:48 +0100 · Javier Pereira Fernández
*«fix(SCRUM-405): una sola forma de descargar, y un guard para que no nazca la quinta»*

## Mecanismo, en `main`

* `public/dashboard/js/api.js` (+91) — la forma ÚNICA de descargar.
* `public/dashboard/js/exportView.js` (+?/−98) y `reportsView.js` — pasan a usarla.

## Guard

`tests/scrum405-descarga-verificada.test.mjs` (+233 líneas, nacido en ese commit). El propio
mensaje declara su propósito: **que no nazca la quinta forma de descargar**.

## Estado

**HECHO.** ⚠️ Hay **dos ramas gemelas** vivas: `origin/scrum-405-descarga-verificada` y
`origin/scrum-405-descarga-verificada-rebasada`. La mergeada fue la `-rebasada` (PR #546); la otra
conviene cerrarla para que nadie la retome creyendo que está pendiente.
