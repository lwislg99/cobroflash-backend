# SCRUM-192 · el PORQUÉ del borrado de merchant vive en UN solo sitio

**Fecha de esta constancia:** 9-ago-2026 · **Escrita por:** sesión 3 · **Código escrito aquí:** ninguno
**Medido contra:** `origin/main` = `8037a7a30049a442eb857733832c9eca0bf99ec2` · 2026-08-09T19:51:07+02:00

> ⚠️ **ENTRADA DE CONSTANCIA, NO DE TRABAJO.** El mecanismo lo construyó otra persona y esta
> entrada solo lo DEJA ESCRITO, citando su commit. No se reconstruye ni se interpreta.

**Commit:** `9110c7279c607c978304730ffc1a6c829a44088b` · 2026-08-05 00:13 +0100 · Javier Pereira Fernández
*«SCRUM-192: el porque del borrado vive en UN sitio, y los otros dos lo referencian»*

## Mecanismo, en `main`

`src/modules/system/domain/borradoMerchant.ts` (+31/−20 en ese commit). El motivo del orden de
borrado deja de estar copiado en tres sitios: vive en uno y los otros dos lo referencian.

## Guard

`tests/scrum192-borrado-merchant.test.mjs`, tocado en el mismo commit (+21/−? líneas).

## Estado

**HECHO.** Rama viva sin mergear: `origin/scrum-192-porque-en-un-solo-sitio` — conviene comprobar
si aporta algo que no esté ya en `main` o si se puede cerrar.
