# SCRUM-1743 — El runner de la tanda por tramos se niega a ir encadenado: un `--tramo` por comando del arnés

**Puesto:** J6 (jv-j6eg) · **Rama:** `scrum-1743-un-tramo-por-comando` · 18-nov-2026
**Medido contra:** `origin/main` = `35153debff1a7adbb5a1176262c57f2a456d2632` · 2026-11-18T04:32:42Z (cabecera `Date:` de `gh api -i zen`)
A9: comprobación → `tests/scrum1743-un-tramo-por-comando.test.mjs`
Mutaciones: catálogo → `tests/scrum1743-un-tramo-por-comando.test.mjs` · las dos de `MUTACIONES_QUE_ME_TUMBAN`, corridas con `correr` y `aplicarUna` de `scripts/meta-guard-mutaciones.mjs` (línea base limpia: 3 pasan, 0 caen, 0 saltan): **2 de 2 tumban su caso**, 0 colaterales. Quitar la hora de creación de la comparación tumba «raíz DISTINTA (mismo pid, otra hora…)»; anular el `if (repetida)` tumba «EL CASO». Fuente restaurado, comprobado después con `grep -c` de las dos anclas (1 y 1) y `git status`.

## Decisiones

- **c.21992** (orquestador J): GO a (A) y el fichero `scripts/tanda-entera-por-tramos.mjs` asignado a J6. Antes de construir, medir el `ppid`.
- **c.21996** (esta sesión): la medición. El `ppid` NO es estable dentro de un `for` desde Git Bash: 11 de 11 llamadas con padre distinto, porque cada `node` sale de un bash recién forkeado. Lo estable es la **raíz del comando**, el primer ancestro cuyo padre es `claude.exe`. Población: 7 comandos del arnés (5 Bash, 2 PowerShell), 15 llamadas, bucles de 5 y 3 vueltas, una sesión, Claude Code 2.1.327. Reutilización de PID medida: el 19380 fue un node y 22 s después un bash de otro comando.
- **c.21998** (orquestador J): GO a (A′), con seis condiciones. Esta entrega las cumple así:

| condición / aceptación (literal resumido) | dónde se ve |
|---|---|
| pid + hora de creación de la raíz | `scripts/tanda-entera-por-tramos.mjs`, `comprobarRaiz` (`raiz-tramo-<i>.json` en el directorio de la pasada) · caso «raíz DISTINTA (mismo pid, otra hora de creación…)» |
| dos `--tramo` con el mismo padre: el segundo sale 2 y el mensaje; con el arreglo quitado, el test cae | `tests/scrum1743-un-tramo-por-comando.test.mjs`, «EL CASO»; rojo primero (abajo) y mutación nº 2 |
| un tramo suelto en su comando sigue saliendo 0 | el mismo caso, su primera llamada (CONTROL) |
| sin `claude.exe` → 0 y un CIEGO que se ve en la salida y en el TAP | caso «sin claude.exe…»: la línea se exige en la salida y se publica con `t.diagnostic` |
| cabecera del runner con el reaper y el ticket | `scripts/tanda-entera-por-tramos.mjs`, bloque «🔴 SCRUM-1743» de la cabecera |
| coste CIM medido sobre tramos reales | abajo, «Coste» |
| §7 de `trampas-del-entorno.md` | **NO HECHO, fuera de carril**: el texto se propuso a la S0 en c.21996 |

## Rojo primero

Con el test escrito y el runner sin tocar: 3 tests, **1 pass y 2 fail** («EL CASO» y «sin claude.exe»). El de raíz distinta pasa también sin el arreglo, porque hoy nada bloquea. Con el arreglo: 3 de 3.

## Lo que también cambió: `tests/scrum1244c-tanda-entera-por-tramos.test.mjs`

Con el arreglo y la cadena REAL, dos casos de 1244c cayeron con el mensaje de 1743 (raíz pid 12864): ese test lanza `--tramo 1/2` y `--tramo 2/2` desde el mismo proceso. Era la detección funcionando de verdad, no un defecto. Su `correr` simula ahora un comando distinto en cada llamada (`TANDA_TRAMOS_CADENA`), que es lo que el test describe: «cada tramo en su comando». Sus asertos no cambian. Después: 9 de 9 entre los dos ficheros.

## Control positivo en vivo (cadena real, sin simular)

En UN comando del arnés, `--tramo 2/15` y después `--tramo 3/15`: el 2 salió con 0 (732 tests) y el 3 **salió con 2 sin correr nada**, con el mensaje y la raíz real (pid 4856, creada 2026-11-18T04:42:00.1443230Z). Después, el 3 en su propio comando corrió normal.

## Coste

Una consulta `Get-CimInstance Win32_Process` por tramo, leída por la línea «raíz del comando comprobada en N ms» de cada tramo real de la pasada. **Población: 15 de 15 tramos** → entre 388 y 491 ms, con mediana de 409 ms. Los tramos duraron entre 18 s y 3 min 16 s.

## Tanda

- **Dirigida:** `scrum1743` y `scrum1244c` → 9 de 9. Guards de registro: ver la entrega.
- **Suite por tramos**, un tramo por comando y en primer plano, sobre el árbol de la rama (main `35153deb` + este cambio): **15 de 15 tramos vistos · 1.696 ficheros · 13.762 tests · 13.562 pass · 19 fail** → ROJO.
  - 1 es mío y se cierra con este registro: SCRUM-854 «esta rama, si toca código, trae su entrada de registro».
  - Los otros 18 no nombran el runner. Los únicos tests que lo nombran son `scrum1244c` y `scrum1743`.
    - 2 de SCRUM-1298b (el latido mide el árbol principal): los mismos que el ticket ya vio el 16-nov en el tramo 3, antes de este cambio.
    - 11 de cliente o generador de Prisma: 6 del tramo 8 (SCRUM-235, 244 y el censo de producción), 2 de SCRUM-461, 1 de SCRUM-498 y 2 de SCRUM-733. Que el de 733 sea por el cliente lo deduzco de su nombre, no lo he leído. El guard de A1 dice que el cliente compartido no trae el modelo `FiscalPlazoEstado`. El `node_modules` de este árbol cuelga del compartido por junction, así que NO regeneré (A1). Se lo dije al orquestador.
    - 1 de SCRUM-351 (sin `node_modules` en ningún ancestro).
    - 4 de scrum932 (el cargador de credenciales).
  - **No medí estos 18 sobre `main` sin mi cambio**: digo que no son míos porque no tocan el runner, no porque los haya visto rojos en main.

A9 (error mío): el primer driver de mutación le pasó a `correr` la ruta con `tests/` delante. La casa contestó CIEGA («no aparece EN VERDE en la pasada limpia»), no un falso veredicto. Al corregir el nombre salieron 2 de 2. Antes, una sonda de PowerShell con comillas anidadas no corrió (c.21996). Las dos están en la familia de mis cicatrices de comillas y rutas. La comprobación de esta entrega es el test de arriba.

# SCRUM-1743c — Medición de cierre: ¿se puede cerrar el ticket? (solo docs; propone J6, cierra el orquestador: A13)

**Puesto:** J6 (jv-j6fk) · **Rama:** `scrum-1743c-medicion-de-cierre` · 24-nov-2026
**Medido contra:** `origin/main` = `093a128766d1d45c01c0f1cef3557c8680b1463c` · 2026-11-24T06:52:05Z
A9: sin fallo que generalice — es una medición de solo lectura; el único tropiezo (sin `dist/` en el árbol anidado, ver ①) no cambia el veredicto y ya está en las trampas de la máquina.

Leído entero este registro y, de Jira, el ticket entero (8 comentarios; el último, c.22067). Las mediciones de ①-③ se hicieron sobre `origin/main` `c3051127c94854ac296638bbffad0fc665d150ca` (06:50Z); main avanzó 9 commits hasta el ancla y **ninguno toca** el runner, su test, `trampas-del-entorno.md`, `.claude/` ni este registro (`git diff --name-only`: 7 ficheros cambiados en esos 9, 0 de los cinco).

## ① El mecanismo: sigue en `main` y para lo encadenado

- **Dónde vive:** `scripts/tanda-entera-por-tramos.mjs` — cabecera `:31-39` (reaper + ticket), mensaje literal `:123-125`, CIEGO `:127`, `comprobarRaiz` `:177-190`, llamada y `process.exit(2)` `:255-257`. Último commit que toca el fichero: `d650bcbf9` (el de #3204); `git log d650bcbf9^..origin/main` sobre el fichero da 1 (él mismo), así que nadie lo ha quitado.
- **Test de la casa:** `tests/scrum1743-un-tramo-por-comando.test.mjs` → `# tests 3 · pass 3 · fail 0 · cancelled 0 · skipped 0` (los tres casos: EL CASO, raíz distinta, CIEGO; la línea CIEGO aparece en el TAP).
- **En vivo, cadena real** (base de pasada fuera del árbol con `TANDA_TRAMOS_BASE`, 400 tramos para que cada uno sea de 5 ficheros):
  - UN comando del arnés con `--tramo 1/400` y después `--tramo 2/400` (separados por `;`, sin `for`): el 1 arrancó («raíz del comando comprobada en 562 ms») y corrió; el 2 **salió con 2 sin correr nada**, con el mensaje literal del ticket y «raíz pid 33440, creada 2026-11-24T06:50:39.9363810Z».
  - **Control:** `--tramo 2/400` solo, en su propio comando y sobre la MISMA pasada: arrancó («comprobada en 543 ms») y corrió 5 ficheros. No hizo falta matarlo: terminó en 1 s.
  - ⚠️ Los dos tramos que corrieron salieron con 1 (3 `not ok` cada uno: `albaran`, `billingPlan`, `emission`…): el árbol anidado **no tiene `dist/`** (`ls dist` → no existe) y esos tests leen de `dist/`. No compilé: no afecta a lo medido (arrancar o negarse), y no es un veredicto de la suite.

## ② El hook `PreToolUse` de las sesiones: NO está en el repositorio

- En `main`: `git ls-tree -r origin/main -- .claude` tiene 6 hooks (`carril`, `guard-dangerous` ×2, `identidad`, `latido-arranque`, `latido-cierre`) y **ninguno** de tramos; `git grep -i tramo` en `.claude/settings*.json` y `.claude/hooks/*` → 0. Control positivo de esa búsqueda: `PreToolUse` sí aparece en `.claude/settings.json` (1).
- **Dónde vive:** en el scratchpad del orquestador, `…/Temp/claude/c--Users-Javier-Pereira-cobroflash-backend/scratchpad-orq/un-tramo-por-comando.mjs` (1.293 B, 16-nov 17:02), cargado por `ajustes.json` de la misma carpeta. Fuera de git: lo que dice c.22009 («vive en el scratchpad»), sigue igual.
- **Está activo en esta sesión:** un `for i in 1; do echo "… --tramo $i/2 …"; done` (solo `echo`) lo paró el hook con su «PARO (orquestador J, 16-nov)».
- **Lo que cada uno ve, medido hoy:** el `;` de ① (dos tramos sin `for`) **pasó el hook** y lo paró el runner; el `for` lo para el hook. `run_in_background` solo lo ve el hook (c.22009). Se complementan; ninguno cubre al otro.

## ③ Lo que se pedía a Luis (`aviso-a-luis`): la aceptación 4, y NO está hecha

- **Qué era** (descripción del ticket, aceptación 4): «`docs/equipo/trampas-del-entorno.md` §7 dice que el reaper sólo mata comandos en segundo plano, y lo cita con la versión del binario». Texto propuesto a S0 en c.21996; c.22009 y c.22048 la dejan PENDIENTE en S0; c.22067 dice «sigue en S0, sin tocar».
- **Hoy en `main`:** `docs/equipo/trampas-del-entorno.md:140-152` (dueño S0: `node scripts/carriles.mjs de` → `docs/equipo/dos-equipos.md:158`) tiene el párrafo del reaper de **SCRUM-1254** (`319662e34`, 14-oct): «puede matar la tanda entera si va en SEGUNDO PLANO». No dice «sólo», no cita versión del binario, no nombra SCRUM-1743 ni la ruta de los 600 s; `grep -i '1743\|backgrounded'` en el fichero → 0 (control: `reaper` → 2 líneas).
- **Y hay una contradicción con lo medido aquí:** `:143-144` da como receta «correr la tanda en PRIMER PLANO … con un `timeout` de 600.000», y `:148` dice que al agotarse el tope «no hay veredicto». Lo de SCRUM-1743 es que un comando que pasa de 600 s **va a segundo plano**, que es justo donde el reaper mata. Ninguna de las dos frases es de mi carril: se describen abajo para el hijo.
- Ningún PR abierto toca `trampas-del-entorno.md` (15 abiertos a las 06:51Z) y en Jira no hay ticket desde el 16-nov que nombre «reaper» o el fichero salvo este (control: SCRUM-1743 sale en la misma búsqueda).

## ④ Veredicto propuesto: CERRAR, con un hijo `aviso-a-luis` para la §7

Las aceptaciones 1-3 son de J y están hechas y vivas hoy (①). Lo que falta es de S0 y no lo puede hacer J. Propongo cerrar SCRUM-1743 y que el orquestador abra este hijo (no lo abro yo: A13):

- **Título:** «trampas-del-entorno §7: el reaper sólo mata comandos en segundo plano (versión del binario) y la receta de 600 s en primer plano lleva a él» · etiquetas `equipo-luis`, `area-s0`, `aviso-a-luis` · enlace a SCRUM-1743.
- **Qué pide:** ① reescribir `docs/equipo/trampas-del-entorno.md:140-152` con el texto literal de c.21996 (o el que S0 decida), que diga «sólo» y la versión (2.1.325 leída por jv-j6ef; 2.1.327 re-leída el 18-nov); ② quitar o corregir la receta «tanda en primer plano con `timeout` de 600.000» de `:143-144` y lo de `:148`: a los 600 s el comando pasa a segundo plano; la receta de la casa es un tramo por comando (`scripts/tanda-entera-por-tramos.mjs`, CLAUDE.md «Comandos»).
- **Aparte, para el orquestador J (no es del hijo):** el hook (0) sigue fuera de git; si debe durar (cubre `run_in_background`, que el runner no ve), pasarlo a `.claude/` es de S0 y es otra decisión.
