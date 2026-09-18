# Afirmaciones del orquestador de Javier, pasadas por J6

**Dueño: J6 · calidad y seguridad (equipo de Javier)**, según `dos-equipos.md` §3.3. Es el mismo
mecanismo que `afirmaciones-verificadas.md`, que es de la Sesión 0 del equipo de Luis, pero para el
otro equipo. **Cada equipo tiene el suyo**, porque los orquestadores no pueden hablarse y la memoria
de una máquina no la ve la otra.

La regla: **lo que el orquestador escriba como HECHO sobre el código pasa por J6 antes, o se escribe
como PREGUNTA** (`orquestador.md` §13).

## Cómo se usa

1. El orquestador va a escribir algo como hecho → se lo manda a J6.
2. J6 lo mide y añade una fila: **lo que se afirmó · lo que se midió · el comando exacto**.
3. Si no hay comando que lo mida, no es un hecho: es una pregunta, y se devuelve como pregunta.

⚠️ El comando va **entero y pegable**. Una fila sin comando es una opinión con dos columnas de adorno.
⚠️ Los números caducan: la columna del medio dice lo que se midió **el día que se midió**, y el comando
sirve para volver a preguntarlo. Si hoy dan cosas distintas, el árbol se ha movido, y eso también es
un dato.
⚠️ **Rutas:** en esta máquina el nombre de usuario lleva un espacio. Donde el comando necesita la
carpeta del usuario va `$LOCALAPPDATA` (Git Bash), y entre comillas, que es justo la trampa de la
fila 3.

Marcas: **[re-medido por J6]** = lo he corrido yo al escribir la fila · **[del registro]** = lo midió
otro, se conserva con su comando y se dice que no se ha vuelto a medir.

## Las de la instalación (18-sep-2026)

Sembradas el 18-sep-2026 sobre `origin/main` = `17b0c86b84fb0544013923314d250d7181d913db`, entre las
15:25Z y las 15:50Z (hora de GitHub).

| lo que se afirmó | lo que se midió | comando exacto |
| --- | --- | --- |
| «`gh` no está instalado en la máquina de Javier» | **FALSO desde hoy**: `gh version 2.101.0 (2026-09-15)`, exit 0, en `C:\Program Files\GitHub CLI\gh.exe`. **[re-medido por J6]**. Que no esté en el PATH no quiere decir que no esté instalado (A3) | `"C:/Program Files/GitHub CLI/gh.exe" --version` |
| «las sesiones de fondo alimentan el aviso de uso» | **NO**: después de lanzar y parar una sesión de fondo, `uso.json` seguía sin existir. **[del registro: lo midió el orquestador el 18-sep]**. ⚠️ Hoy el comando ya no lo distingue: `uso.json` existe desde que el `statusLine` de una sesión interactiva escribe en él | `node "$LOCALAPPDATA/yaqu-equipo/uso.mjs" leer` |
| «el `statusLine` que escribe el instalador funciona en cualquier máquina» | **FALSO**, y hay **dos sondas independientes** que dicen lo mismo (A3). ① **El orquestador** (18-sep, ~14:50Z) ejecutó la orden del `settings.json` tal cual: sin comillas sale **1**; con comillas escribe, y `leer` da VERDE. ② **J6** ejecutó `lineaStatusLine()` de `scripts/equipo/instalar.mjs:82-84` sobre main `17b0c86b`: devuelve `node <ruta> escribir` **sin comillas**, y esa orden, con una ruta que lleva un espacio, sale con **exit 1** («Cannot find module 'C:\Users\<nombre>'»). En esta máquina el `settings.json` ya lleva la ruta entre comillas porque se arregló a mano, pero **el instalador sigue igual**. Pedido a S5 como **SCRUM-953**; `scripts/equipo/` no se toca desde aquí | `node --input-type=module -e "import { lineaStatusLine } from './scripts/equipo/instalar.mjs'; console.log(lineaStatusLine('C:/Users/Nombre Apellido/AppData/Local/yaqu-equipo').statusLine.command)"` y ejecutar la línea que imprime, tal cual, con `bash -c "<línea>" < /dev/null; echo $?` |

## Las de SCRUM-908 (18-sep-2026)

Medidas por J6 sobre `origin/main` = `4d8f3a15f6b3489d7f53bfbde550c587ee9d7c61`, entre las 14:55Z y
las 15:45Z. El detalle está en `docs/master/SCRUM-908.md`, § 908c, y el banco en
`docs/master/evidencias/scrum908c/`.

⚠️ **Ni la § 908c ni el banco están en `main`.** Medido el 18-sep a las 15:56Z sobre `origin/main` =
`17b0c86b84fb0544013923314d250d7181d913db`: **0 ficheros** bajo `docs/master/evidencias/scrum908c/`, y la
misma consulta SÍ ve `docs/master/evidencias/SCRUM-307/`, así que no está ciega. Viven en la rama
`scrum-908c-la-cola-que-se-pierde` (PR #1519), que sigue **en rojo a propósito** hasta que el caso se
recalibre. Mientras no entre, los scripts de estas filas y el de la fila de SCRUM-942 se sacan de su
cabeza empujada, `d0295b0d21d2d46a30cb575a1eebce43c1858a83`, que no se reescribe. Son `.mjs` sueltos que
solo usan módulos de node, así que basta con sacarlos a una carpeta temporal y correrlos desde la raíz
del repo:
`git show d0295b0d21d2d46a30cb575a1eebce43c1858a83:docs/master/evidencias/scrum908c/<script>.mjs > "<carpeta temporal>/<script>.mjs"`.
Probado así con `bytes-control.mjs`: da los mismos 1 y 4 NUL que su fila. Cuando #1519 entre, esta nota
sobra y se quita.

| lo que se afirmó | lo que se midió | comando exacto |
| --- | --- | --- |
| «el log del job del meta-guard no se puede leer sin permisos de admin: 403» (SCRUM-908b ③) | **FALSO en esta máquina**: se baja entero con la cuenta de `gh` de Javier (scopes `repo`), 83.130 bytes y exit 0. ⚠️ **La trampa:** sin `--allow-escape-sequences`, `gh` sale con **1** y el mensaje «the response contains terminal escape sequences», que parece un «no tienes acceso» y no lo es. **[re-medido por J6]** | `"C:/Program Files/GitHub CLI/gh.exe" api --allow-escape-sequences repos/lwislg99/cobroflash-backend/actions/jobs/105552194145/logs > log.txt; echo $?` |
| «los `cancelled` del meta-guard son de veredicto desconocido, cancelados por concurrencia» (SCRUM-908b ①) | **71 de 112 son el propio tope del job** («exceeded the maximum execution time of 10m0s», 611–651 s). Los otros 41 sí son de concurrencia. De 148 runs, **solo 28 dan veredicto**. **[re-medido por J6]**. El `conclusion` del job dice `cancelled` en los dos casos: la diferencia sólo está en la anotación | `node docs/master/evidencias/scrum908c/cancel-clasif.mjs` (con `J6_908C_DIR` apuntando a la salida de `censo-meta-ci.mjs`); a mano, para un job: `"C:/Program Files/GitHub CLI/gh.exe" api repos/lwislg99/cobroflash-backend/check-runs/<job>/annotations --jq '.[].message'` |
| «la mutación nº 2 de `scrum859` sale muda en 15 de 72, en rachas» (SCRUM-908b ②, y el encargo de J6) | **Mezclaba dos mudas.** Entre las 08:35Z y las 16:13Z del 17-sep hubo 16 fallos del meta-guard: **8 de `scrum859`** y **8 de `scrum738`** («PASÓ · 7 pasados»). La racha de las 13:54-14:33Z era sobre todo de `scrum738`. La nº 2 de `scrum859`, desde el 17-sep a las 16:00Z: **8 MUDA de 49 medidas**, sin rachas, y siempre con la misma firma. **[re-medido por J6]** | `node docs/master/evidencias/scrum908c/censo-meta-ci.mjs 2026-09-17T08:35:37Z censo.json` y luego `node docs/master/evidencias/scrum908c/logs-mudos.mjs` (lee el log de cada `failure` y nombra el guard mudo) |
| «el meta-guard falla sin bloquear el auto-merge» (SCRUM-836 ②) | **VERDAD hoy**: el PR #1505 se mergeó a las **09:40:06Z** con la cabeza `03a54c39e5799da2641500f4169d466fdf42ed23`, y el meta-guard de esa cabeza acabó en **failure** a las 09:42:38Z. **[re-medido por J6]** | `"C:/Program Files/GitHub CLI/gh.exe" pr list --repo lwislg99/cobroflash-backend --state all --head scrum-949-el-suelo-como-cociente --json number,mergedAt,headRefOid` y `"C:/Program Files/GitHub CLI/gh.exe" api repos/lwislg99/cobroflash-backend/commits/03a54c39e5/check-runs --jq '.check_runs[] \| [.name,.conclusion] \| @tsv'` |

## Calibración de J6 (18-sep-2026)

Antes de dar ningún «existe hoy», el puesto se calibra en las dos direcciones (`sesion-0.md`): dos
tickets que sé ARREGLADOS y dos que sé VIVOS, comprobados corriendo.

| ticket | veredicto | lo que se midió | comando exacto |
| --- | --- | --- | --- |
| SCRUM-928 | **arreglado** (#1472, #1481) | `guards:entrada` con color: **26 tests, 0 fail, exit 0**, y **120 bytes ESC** en el log, así que el color SÍ estaba puesto. El defecto era «0 tests» y rojo | `FORCE_COLOR=3 npm run guards:entrada > log 2>&1; echo $?` y contar los ESC del log con node (no con `grep`: `trampas-del-entorno.md` §1) |
| SCRUM-850 | **arreglado** (su guard vive) | `scrum850`: 6 de 6 sobre **12 invocaciones**. Con `\| tail -20` inyectado en el `test` de `package.json` → **2 fail, exit 1**. Restaurado, `git status` vacío | `node --test tests/scrum850-la-poblacion-del-instrumento.test.mjs` antes y después de la inyección |
| SCRUM-942 | **vivo** | bytes de control hoy: `tests/scrum806-…` **1 NUL**, `tests/scrum807-…` **4 NUL**. Control fabricado: un fichero con un NUL da 1 y uno limpio da 0 | `node docs/master/evidencias/scrum908c/bytes-control.mjs . tests/scrum806-el-pdf-del-portal.test.mjs tests/scrum807-esquemas-del-href.test.mjs` |
| SCRUM-836 ② | **vivo** | la fila de arriba: #1505 entró antes de que acabara su meta-guard, que acabó en failure | la de arriba |
