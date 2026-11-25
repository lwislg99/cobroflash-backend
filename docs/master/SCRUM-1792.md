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

# SCRUM-1792b · El test de 1792 tropezaba con dos guards de la casa (189 y 702)

**Medido contra:** `origin/main` = `f14c253600aae315d1758524ae28872a81286758` · 2026-11-24T13:49:37Z (cabecera `Date:` de GitHub)

Carril J6. Sesión jv-j6fu, por encargo del orquestador J: poner en verde #3389 sin tocar el hook. `origin/main` va
fusionado dentro de la rama (A4), porque el CI prueba el merge. Un solo empujón, a la misma rama del PR.

A9: comprobación → `tests/scrum702-suelo-misma-poblacion.test.mjs`

## Qué · esperado · visto

- **① scrum189** (`toda cita numerada a la doctrina nombra su fichero`): `tests/scrum1792-regla7-ruta-msys.test.mjs:5`
  decía «la regla 7 de» y, cerca, sólo un `.mjs`. El guard sólo acepta un `.md` o «máster». Arreglado en el
  comentario: ahora nombra el fichero del hook y dice «en su regla 7 (…)». El guard no se toca.
- **② scrum702** (`no entra NINGUNA dependencia del entorno nueva sin declararla`): 24 ficheros y tope 23. El nuevo es
  `tests/scrum1792-regla7-ruta-msys.test.mjs:103` (`process.platform`). Lo usan los 3 casos de extremo a extremo,
  que montan una junction real y llaman a `evaluar()` sin inyectarle nada: son los que reproducen el incidente.
  Decisión del fundador en Jira, **SCRUM-1792 c.22646** (regla 41; creado a las 13:46:44Z según Jira, aunque el
  texto dice «~13:55Z»): «Subir el tope a 24 (Recomendado)». Descartada: «Quitar los casos de Windows». Hecho:
  `TOPE_LEEN_EL_ENTORNO` pasa de 23 a 24 y lleva un párrafo como el de 1091. Va en el mismo commit que el arreglo
  del test: el test ya estaba empujado, y reescribir la historia está prohibido (A4).
- Antes del cambio, en local: scrum702 en rojo con este mismo mensaje (24 > 23) y scrum189 ya en verde tras
  arreglar el comentario.

## Lo que NO he hecho o NO he medido

- Suite entera NO corrida (encargo). Tanda dirigida y `guards:entrada`: en el comentario de entrega del ticket.
- No he medido por qué la tanda dirigida de 1792 no cazó el ② en local.
- #3390 (SCRUM-1831) NO mirado: me pasé del tope de contexto del encargo (155k medidos; tope 145k). Cicatriz en
  `docs/equipo/cicatrices/J6.md`, del 24-nov.
