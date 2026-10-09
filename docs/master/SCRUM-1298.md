# SCRUM-1298 · Mesa fija por puesto: cada sesión arranca en su `mesa-<puesto>`, al día con origin/main

**Medido contra:** `origin/main` = `45181d233c74ee36a39db4913d9593e7e9a284df` · 2026-09-29T17:53:08Z

## El defecto
`CLAUDE.md`, `.claude/settings.json` (hooks) y `.claude/rules` se cargan del directorio de ARRANQUE
(medido por S0). Las sesiones heredaban el `cwd` de quien las lanzaba: el checkout compartido, en una
rama del 22-sep. Ninguna norma ni hook mergeado desde entonces llegaba a nadie.

## Lo medido por S5 (29-sep)
- `claude --bg` toma el `cwd` del proceso que lo lanza: control `983223e8` (`control-cwd-s5`, modelo
  haiku) lanzado desde `D:\MILLONARIO\cobroFlash\mesa-control-s5` sale en `agents --json` con ese `cwd`.
- Una carpeta fuera de ruta de confianza hace que `claude --bg` se NIEGUE: «Workspace not trusted».
  `D:/MILLONARIO/cobroFlash` es de confianza y sus hijas la heredan (el control anterior arrancó).
  Por eso las mesas van ahí; la confianza NO se escribe a mano.
- ⚠️ Resto del control sin limpiar: `claude stop/rm 983223e8` y borrar la carpeta vacía
  `D:\MILLONARIO\cobroFlash\mesa-control-s5` los DENEGÓ el permiso de esta sesión. Está en `done`.

## Lo construido
- `sesion.mjs`: `rutaDeMesa`, `puestoDeIdentidad`, `suciedadDeMesa`, `prepararMesa`,
  `mesaDelLanzamiento`. `lanzar` y `relevar` preparan la mesa (fetch → worktree `--detach` o
  checkout → CONTROL `HEAD == origin/main` → generador de identidad de S0) y lanzan `claude` con
  `cwd` en ella. `relevar` la prepara ANTES de parar a la anterior. Cualquier paso que falla = no se lanza.
- `equipoVivo` cuenta también `<mesas>/mesa-*` (si no, el guard del segundo orquestador quedaba ciego).
- `instalar.mjs --mesas <ruta absoluta>`: EL INTERRUPTOR. Sin él, todo sigue como antes y el
  veredicto dice `SIN-MESA`.
- Test `tests/scrum1298-mesa-por-puesto.test.mjs`, git real en un temporal; sus dos mutaciones
  caen con su `cae` (runner local).

## Lo que falta para el interruptor (con el equipo PARADO; no se migra nada aquí)
1. Que entre el PR de S0 (SCRUM-1295: `scripts/carriles.mjs mesa <PUESTO> <mesa>` + `.gitignore`).
   Sin él, todo lanzamiento con mesas sale `SIN-IDENTIDAD` — a propósito.
2. Añadir `"mesas": "D:/MILLONARIO/cobroFlash"` al `config.json` de la instalación.
3. Que el orquestador lance SOLO por `sesion.mjs lanzar|relevar sesion-N`: el nombre `-n` tiene que
   decir el puesto (el hook de S0 contrasta carpeta contra nombre). Hoy lanza a pelo con `sN-29x`.
4. **El modelo (decisión del orquestador, 29-sep):** `sesion.mjs` fuerza `--model sonnet` (SCRUM-990)
   y hoy se lanza con opus. El lanzador tiene que respetar el modelo pedido (parámetro explícito), no
   imponer uno; opus frente a sonnet lo decide el fundador. Hasta entonces el interruptor NO se da.

## 1-oct-2026 · por qué este PR estuvo dos días en rojo, y lo que cambió

**Medido contra:** `origin/main` = `fe5b3c18f038eb5c1200b8c067ed69d0bfda0898` · 2026-10-01T10:37:17Z

A9: aviso → A10 «Empujar no es entregar: antes de cerrar, mira el check obligatorio de tu último push, o di que no lo miraste.» — no se pudo comprobar: la comprobación (que ninguna sesión cierre con su último push en rojo sin decirlo) es SCRUM-1350 y todavía no existe; hasta que entre, esto es lo único que llega a todas las sesiones.

El PR (#2002) **nació rojo** el 29-sep: la sesión cerró sin mirar su check. No fue podredumbre — la
primera corrida, minutos después de abrirse, ya traía los cinco fallos propios. Lo que caía y lo hecho:

| Guard | Qué decía | Arreglo |
|---|---|---|
| `scrum836` (anclas) | las mutaciones de `scrum951a` apuntaban a dos líneas que este PR cambió | re-ancladas en `scrum951a` (lo que quitan sigue siendo lo mismo) |
| `scrum836d` (`cae`) | los dos `cae` de este test no eran títulos de test | ahora nombran el título |
| `scrum723` | `sesion.mjs` y este test nombran `origin/main` fuera de los argumentos de git | declarados con su motivo |
| `scrum824` | este test crea temporales que el censo no puede probar | declarado (cuelga de `temporal()`, como 951d) |
| `scrum812` | la cobertura subió | suelo 26 → 27 |

Y un cambio de conducta, pedido por S0: `prepararMesa` pasa **siempre** `--nombre <sesión>` al
generador de identidad. Sin él, el equipo con prefijo (sus `sesion-N` son `JN`) saldría 2 al lanzar.
Aserción en «una mesa que no existe nace en origin/main…».

Tanda completa en local (Windows): 9.623 tests, 9.481 pasan, 138 saltan, 4 caen — los cuatro se
declaran CIEGOS por la máquina (`scrum1093h` ×3 y `scrum1321`: el temporal está en otra unidad),
no por este cambio. El veredicto que vale es el del CI.

## 9-oct-2026 · SCRUM-1298b · el latido dice si el árbol de arranque trae lo que `main` trae

**Medido contra:** `origin/main` = `ebd9bd8e9c4329edbdc35fffced5ff5b173f885c` · 2026-10-09T11:03:49Z (hora de GitHub)

A9: comprobación → `tests/scrum1298b-latido-arbol-de-arranque.test.mjs`

Lo que salió mal: en cuatro comentarios de este ticket (del 29-sep al 9-oct) dije «le falta el
interruptor» y medí a mano, cada vez, que el checkout compartido iba miles de commits por detrás y
cargaba 1 hook de 5. Cuatro mediciones a mano de lo mismo son un instrumento que falta. Ahora lo dice
el latido en cada pasada.

### Qué cambia

| Pieza | Qué hace |
|---|---|
| `scripts/equipo/arranque.mjs` (nuevo) | `medirArranque` pregunta la punta de `main` al remoto (`ls-remote`, no escribe referencias), la congela en un sha y compara con ella el árbol PRINCIPAL del repositorio, que es donde se lanzan hoy las sesiones. `seccionArranque` monta la sección. Sólo lee. |
| `scripts/equipo/latido.mjs` | sección 12 · ARRANQUE, dentro del veredicto. |
| `tests/scrum723-guard-contra-su-base.test.mjs` | dos entradas declaradas con su motivo: aquí la punta es el sujeto. |

**Qué avisa.** Si al `settings.json` que hay EN DISCO le falta un hook de los que declara `main`, o si
una sola de las piezas que una sesión carga al arrancar (`CLAUDE.md`, lo que importa con `@`, y
`.claude/`) es distinta en `main`.

**Por qué el umbral no es un número de commits.** En los siete días anteriores `main` recibió 201
merges; «va 40 por detrás» es verdad cualquier tarde y no dice si a quien arranca le falta algo. En esos
mismos siete días, 26 commits tocaron alguna pieza de arranque: eso es lo que se compara. Los commits
por detrás salen siempre en la línea, como dato.

**Si no puede preguntar al remoto, la sección sale «NO PUDE MIRAR» (salida 2).** No compara contra la
copia local de la referencia, que es de cuando alguien trajo por última vez.

### El rojo, demostrado

| Dónde | Resultado |
|---|---|
| El repositorio de verdad, 9-oct 11:01Z | 🔴 rama `scrum-1082…`, `e4ea95e5` · 2.588 por detrás · carga 1 de 5 hooks · 21 piezas distintas · salida 1 |
| Un clon aislado, 6 commits por detrás y sin ninguna pieza distinta | ✅ no avisa, y enseña los 6 · salida 0 |
| El mismo clon, puesto al día | ✅ 0 por detrás · 5 de 5 · 0 piezas · salida 0 |
| Las 4 mutaciones declaradas en el test | las 4 caen en el test que nombran, y el fichero se restaura byte a byte |

### El salto del checkout compartido (plan; NO ejecutado)

Lo ejecuta el orquestador con el equipo parado: cambiar de rama bajo una sesión viva le cambia los
ficheros en la mano. Ensayado entero el 9-oct en un clon aislado que reproduce las 47 entradas sin
commit del compartido (14 comprobaciones, las 14 en verde; el compartido no se tocó).

Estado medido: rama `scrum-1082-flujo-crear-factura-competencia`, `e4ea95e5`, 0 commits propios (su
commit ya está en `main`). 47 entradas sin commit: 24 frenan el salto (3 modificados que `main` también
cambia, 19 capturas que `main` ya trae byte a byte, y 2 ficheros que `main` trae con otro contenido) y
23 no chocan (`.claude/settings.local.json`, 21 ficheros que `main` no trae y un árbol de trabajo
anidado).

| Paso | Qué hace | Qué se pierde |
|---|---|---|
| 0 | Nadie trabajando en ese árbol. | — |
| 1 | Copiar a una carpeta de rescate, fuera del repositorio, TODO lo que no está en ningún commit, con su sha256, y releer la copia. | Nada: sólo copia. |
| 2 | Devolver a `HEAD` los 3 modificados que `main` también cambia y quitar del árbol los 21 sin seguir que `main` trae en esa ruta. | Del árbol salen 24 ficheros; los 24 están en el rescate, comprobados. |
| 3 | `git merge-base --is-ancestor main origin/main` (el `main` local no tiene nada propio) y `git switch -C main origin/main`. | Nada. Si aún queda algo que choque, git se niega y no toca nada. |
| 4 | Comprobar: al día, los 5 hooks declarados y cargables, la cerradura muerde (`public/app.js` sale 2 para una sesión de nombre `s5-…`), `settings.local.json` idéntico, el stash sigue, los 23 que no chocaban siguen idénticos. | — |
| 5 | Lanzar una sesión y leer en la ESTRUCTURA de su transcript que el hook de inicio corrió (`hook_success` de `SessionStart`). | — |
| Después, cada tanda | `git merge --ff-only origin/main` en ese árbol. | Nada; falla cerrado. |

Lo que el salto NO arregla y lo que cambia: el `node_modules` de ese árbol (del que cuelgan 29 árboles
por enlace) se queda como está, y a `main` le falta ahí una dependencia (`read-excel-file`). A partir
del salto los cuatro hooks nuevos corren en toda sesión que arranque ahí: la cerradura para a una sesión
con nombre de puesto que edite fuera de su carril; el orquestador pasa siempre, y una sesión sin nombre
también.

### Los materiales que sólo viven en ese disco

21 ficheros del checkout compartido no están en ningún commit y `main` no los trae: 17 notas de sesión
bajo `docs/Srpint Scrum/`, una auditoría de la superficie pública, una semilla de demo y dos capturas en
la raíz. El repositorio es público (SCRUM-1283) y son materiales del fundador, así que NO van a git.
Siguen en su sitio —el salto no los toca— y desde el 9-oct tienen copia, con su sha256, en una carpeta
`rescate-compartido-9oct` hermana del repositorio.

### Lo que NO se ha corrido

La tanda dirigida que calcula `tests-que-cubren` son 233 ficheros de test. En la máquina quedaban
0,63 GB de memoria libre y el árbol de trabajo no tenía `dist/`: no se compiló.

| Qué | Cuántos |
|---|---|
| ficheros de la dirigida | 233 |
| NO corridos (nombran `dist/`, la base de datos o un navegador en su fuente) | 55 |
| corridos | 178 → 1.797 tests: 1.745 pasan, 1 salta, 51 caen |
| de los 51, por no existir `dist/` (lo dice su error) | 49 |
| de los 51, ciego por la máquina (`scrum1321`: el temporal está en otra unidad) | 1 |
| de los 51, por este cambio | 1: `scrum824` no podía probar de dónde colgaban los ficheros del banco del test nuevo. Arreglado en el test (las rutas se dan relativas a la carpeta temporal) y vuelto a correr en verde |

Lo que no se compiló lo dirá el CI.
