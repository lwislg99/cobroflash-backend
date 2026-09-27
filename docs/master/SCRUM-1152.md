# SCRUM-1152 · Generador del ancla de medición (SCRUM-267)

**Fecha:** 26-sep-2026 12:19Z (GitHub) · **Carril:** S5 · automatización y eficiencia
**Medido contra:** `origin/main` = `305666c5c6a87d1bd9ed374099cadc3f99796305` · 2026-09-26T12:19:57Z
**Rama:** `scrum-1152-generador-ancla`

> Esta misma línea de arriba salió de `node scripts/equipo/ancla.mjs` — el control positivo más
> directo que existe: si el generador no funcionara, este registro no llevaría un ancla válida.

## 0 · El encargo, en una línea

El ancla de SCRUM-267 (`**Medido contra:** \`origin/main\` = \`<sha40>\` · <ISO-8601>`) tumbó
**cinco veces en dos días** (#1793, #1795, S2, y dos veces esta misma sesión en el mismo turno),
siempre por el mismo motivo: es un dato de dos partes que se teclea a mano, y es fácil escribir
una sin la otra. Encargo directo del orquestador `cobroflash-backend-06`.

## 1 · Qué se construyó

`scripts/equipo/ancla.mjs` (nuevo). `node scripts/equipo/ancla.mjs` imprime la línea completa:

- El **sha**: `git rev-parse origin/main`, local — no fetchea por ti (fetchear es una decisión de
  red de quien lo llama, no de un generador de texto).
- El **instante**: la cabecera `Date:` de `gh api -i zen` (A14) — nunca el reloj de la máquina.
  Prueba `gh` del PATH y, si no existe (ENOENT), la ruta fija de esta máquina
  (`C:\Program Files\GitHub CLI\gh.exe`, SCRUM-360). Un `gh` que existe pero responde mal (status
  ≠ 0) **no** prueba otro binario ni rellena con el reloj local: falla cerrado.
- Si cualquiera de los dos datos no se puede leer, sale `NO PUDE MIRAR` con código 2 — nunca
  imprime un ancla a medias.

También se enlaza el generador desde los dos sitios donde alguien se topa con el problema:

- El mensaje de la aserción de `tests/scrum267-ancla-de-medicion.test.mjs` (la que hoy dice «HAY
  ENTRADAS SIN ANCLA») ahora dice también `node scripts/equipo/ancla.mjs`.
- `docs/master/README.md`, en la sección "El ancla de medición" y en la plantilla de apéndice.

## 2 · Lo que NO se tocó

El `RE_ANCLA` y el resto del guard de SCRUM-267: sin cambios. Esto es un generador que apunta al
mismo contrato que ya existía, no un guard nuevo ni uno relajado.

## 3 · Verificación

- `tests/scrum1152-generador-ancla.test.mjs` (8 casos): camino feliz con el `RE_ANCLA` REAL
  importado del propio guard (no una copia del patrón); fallback entre binarios de `gh` cuando el
  primero da ENOENT; fail-closed cuando ninguno responde, cuando uno responde pero falla de
  verdad, cuando el sha no tiene 40 hex, cuando `git rev-parse` falla, y cuando la cabecera `Date:`
  no se puede parsear. Un caso final ejecuta el script real (sin dobles) contra este repo.
- Suite completa del registro (`scrum267`, `scrum649`, `scrum811c`, `scrum859`, más el nuevo):
  **91/91 pass**, incluyendo el test que comprueba que el README declara el formato del ancla (no
  rompí ese guard al añadir la mención del generador).
- Control positivo real: la línea `**Medido contra:**` de la cabecera de este mismo fichero salió
  de `node scripts/equipo/ancla.mjs`, sin tocarla a mano.
