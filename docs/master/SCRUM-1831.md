# SCRUM-1831 · La regla 4 de guard-dangerous reconoce `rm` recursivo + forzado por su significado

**Medido contra:** `origin/main` = `fc51ec7a2f11dd93e34141fae48b4357b72d9990` · 2026-11-24T12:21:23Z (cabecera `Date:` de GitHub)

A9: comprobación → `tests/scrum1831-regla4-banderas-por-significado.test.mjs`

Mutaciones: catálogo → `tests/scrum1831-regla4-banderas-por-significado.test.mjs`

## 1831 — qué · esperado · visto (jv-j6fs, carril J6, asignado por el orquestador J)

**Qué:** la regla 4 de `.claude/hooks/guard-dangerous.mjs` era la regex `rm +-[…]*r[…]*f[…]* +ruta-absoluta`:
exigía la `r` ANTES que la `f` y en el MISMO grupo. Ahora la regex se queda tal cual (regla 41: nada de lo
que paraba deja de parar) y se le SUMA `rmRecursivoForzadoFuera`, que mira las palabras desde un `rm` que se
ejecuta: recursivo (`r`/`R` o `--recursive`) + forzado (`f` o `--force`) en cualquier orden y posición hasta
`--`, y un operando absoluto (`/`, `~` o unidad).

**Esperado:** `rm -fr`, `rm -r -f`, `rm -f -r`, `rm --recursive --force` y `rm -R -f` con ruta `/c/…` y `C:\…` → PARA.

**Rojo (hook sin tocar, idéntico a `origin/main` fc51ec7a2, comprobado con `git diff --quiet`):** el test nuevo,
6 casos: 3 caen + 3 pasan = 6. Caen los tres casos: `-fr`, `-r -f`, `-f -r` y `-R -f` PASABAN con `/c/…` y con
`C:\…`, y también `rm "/c/…" -r -f` y `rm -f --recursive "C:\…"`.

**Lo que corrigió mi propio test (A9, error mío):** escribí los controles con lo que yo CREÍA que pasaba hoy, y
dos cayeron sobre el hook sin tocar: `rm --force "C:\…"` y `rm --recursive --force <relativa>` YA paraban, por
la regla 3 (`forcePeligrosa`, toda forma larga `--force`), que va antes de la 4. El hueco eran solo las formas
cortas. Los controles pasaron a ser la tabla `COMO_HOY`, medida sobre fc51ec7a2 con el propio fichero.

**Verde (con el arreglo):** 108 pass · 0 fail · 0 skip sobre 8 ficheros: el nuevo, `scrum1091`, `scrum176`,
`scrum176b`, `scrum454`, `scrum744`, `scrum774` y `scrum746`. Controles en verde: `rm -rf` absoluto sigue
parando; sin recursivo o sin forzado, las relativas en las seis formas y las menciones entre comillas se
comportan como en `COMO_HOY`.

**Sin medir, dicho aquí:** la regla 4 no depende de la plataforma (texto puro), así que el test no inyecta
`plataforma`; en modo fail-closed (JSON ilegible) solo actúa la regex vieja, como antes. La rama
`scrum-1792-regla7-ruta-msys` (sin mergear) toca el mismo fichero en otras zonas; no lo he mergeado con ella.
