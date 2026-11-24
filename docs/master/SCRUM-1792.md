# SCRUM-1792 · La regla 7 de guard-dangerous no veía el enlace de node_modules con la ruta en forma MSYS

**Medido contra:** `origin/main` = `e7be8c3d897e266cd26c80815065476ec2cc8f99` · 2026-11-24T12:09:40Z (cabecera `Date:` de GitHub)

A9: comprobación → `tests/scrum1792-regla7-ruta-msys.test.mjs`

Mutaciones: catálogo → `tests/scrum1792-regla7-ruta-msys.test.mjs`

Puesto J6 (sesión jv-j6fq), encargo del orquestador J. Carril: `.claude/hooks/guard-dangerous.mjs` sin cerradura, «lo asigna un jefe» (`dos-equipos.md:210`).

## Qué · esperado · visto

| qué | esperado | visto |
|---|---|---|
| `git worktree remove "/c/…/con-enlace"` (node_modules = enlace fabricado), host win32, hook SIN arreglo | PARA (regla 7) | **PASA** — rojo, `not ok 6` |
| `rm -r "/c/…"` y `rmdir /s /q "/c/…"` sobre el mismo árbol, SIN arreglo | PARA | **PASA** — rojo, `not ok 7` |
| lo mismo con `C:\…` entre comillas simples, y con ruta relativa | PARA | PARA (control, ya antes del arreglo) |
| árbol SIN enlace, relativo y MSYS | no para | no para |
| las cuatro anteriores, CON arreglo | — | 18/18 verde (10 de este test + 8 de scrum1091), 0 saltados |

**La causa, medida (no la del ticket):** el ticket leyó `path.resolve` → `C:\c\Users\…`. Lo que pasaba antes es que el
bucle de la regla 7 filtra `!t.startsWith('/')` (para no tomar `/s` de `rmdir` por una ruta), y una ruta MSYS empieza
por `/`: se tiraba ENTERA y no se preguntaba nada. El arreglo traduce con `posixADrive` (SCRUM-1091) ANTES del filtro y
sólo `/<letra>/…`, así que `/s`, `/q` y `/c` siguen siendo opciones (el caso determinista lo fija con la lista EXACTA de
lo que se pregunta). Para que corra igual en el CI de Linux, `evaluar()` acepta `plataforma` y `esEnlace` en `opciones`,
como ya aceptaba `cwd`; en uso real son `process.platform` y el `lstat` de siempre.

**Rojo antes del arreglo** (TAP fuera del árbol): 10 casos, 4 ok + 6 not ok = 10. Los 4 deterministas caían también
porque `opciones.plataforma/esEnlace` aún no existían; el rojo sin costuras es el de los dos end-to-end del host (6 y 7).

## Lo que NO he hecho o NO he medido

- 🔴 **La mutación del catálogo NO la he corrido** con `scripts/meta-guard-mutaciones.mjs`: el contexto pasó el tope del
  encargo (165.740) antes. Está declarada (`de` copiado del fichero, ancla única) y la corre el meta-guard de CI.
- **Hallazgo fuera del encargo, no tocado:** la regla 4 (AA2, `rm -rf` con ruta absoluta) es una regex que exige la `r`
  antes de la `f`: con una sonda sobre una ruta inexistente, `rm -rf "/c/…"` BLOQUEA, pero `rm -fr "/c/…"` y
  `rm -r -f "/c/…"` PASAN. Con un `node_modules` enlazado los para ahora la regla 7; sin enlace, no los para nadie.
- No medido: si `rm -r` desde MSYS sigue de verdad el enlace (no se probó contra nada real, por encargo).
- Suite entera NO corrida (encargo: «NO corras la suite entera»).
