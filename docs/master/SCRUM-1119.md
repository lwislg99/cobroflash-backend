# SCRUM-1119 · censo de los rojos de `npm test` en `main` — sin arreglar nada

**Medido contra:** `origin/main` = `4f4a6f3c6417f70e312eabee8468e73253ca95ae` · 2026-09-25T15:41:18Z

J5 (jv-j5), árbol `cobroflash-jv5`. Las dos tandas enteras se corrieron sobre `dac1f9d7f9cd5237778aa2cd3f9241bd2210855a`;
entre ese sha y el del ancla, de todo lo que se mide aquí **solo cambió `tests/scrum804b-el-barrido-de-la-42.test.mjs`**
(`git diff --stat dac1f9d7 4f4a6f3c` sobre los ficheros de test y el código que miden), y 804b se volvió a correr sobre el ancla.
Censo y documento: no se ha tocado ningún test, guard, tope ni código.

## 0 · Lo que cambia el reparto

**De los siete rojos «de `main`», sólo UNO rompía la línea de montaje: 804b.** Era el único rojo del CI de `main` y tumbaba
el check obligatorio de todos los PR. Los otros —**815, 824b, 910d y 939b ×3**— **no caen en CI**: 0 apariciones en los 40
últimos runs de `ci.yml` en fallo (23-sep 08:33Z → 25-sep 15:08Z). Son **ruido en las máquinas de los que trabajamos**, y
así hay que tratarlos: no paran a nadie, pero tapan el rojo propio de quien corre la tanda aquí.

| clase | fallos | estado |
|---|---|---|
| rompe la línea de montaje (CI) | 804b | en `main` se re-eligió el número a mano (#1760); el arreglo de fondo, **SCRUM-1120**, en PR #1766 (abierto) |
| sólo local, con ticket | 939b ×3 | **SCRUM-1113**, PR #1764 (abierto) |
| sólo local, sin ticket, causa medida | 910d | §2 y §3: el disparador es `--test-force-exit` en Windows |
| sólo local, sin reproducir | 815, 824b | §4: una sola caída vista, causa sin determinar |

## 1 · La población, antes que el resultado

| tanda | dónde | tests | pass | fail | skipped | fallos |
|---|---|---|---|---|---|---|
| CI de `main`, run 36150352928, «build + tests» | Linux, Node 24 de `setup-node` | 8.318 | 8.224 | **1** | 93 | 804b |
| J5 · tanda 1 (15:23:27Z → 15:28:04Z) | esta máquina, Node v24.18.0 | 8.314 | 8.175 | **5** | 134 | 804b · 910d · 939b ×3 |
| J5 · tanda 2 (15:33:37Z → 15:37:14Z), con 815+824b en bucle a la vez | esta máquina | 8.314 | 8.175 | **5** | 134 | los mismos cinco |
| J3 · pasada 1 (su `npmtest.txt`, ~15:03Z), en `cobroflash-jv3` | esta máquina | 8.322 | 8.179 | 9 | 134 | 804b · 815 · 824b · 864c* · 910d · 921c* · 939b ×3 |
| J3 · pasada 2 (su `npmtest2.txt`, ~15:22Z) | esta máquina | 8.314 | 8.179 | 1 | 134 | 804b |

\* 864c y 921c eran de la rama de J3 y los arregló él (`docs/master/SCRUM-1105.md` §4.1, en su rama).

- **Invocación:** `node scripts/tanda-con-veredicto.mjs node --test --test-force-exit` con reporter `spec` a un fichero y
  `tap` a otro, los dos FUERA del árbol, con el patrón `'tests/*.test.mjs'` entre comillas (lo expande `node --test`, no la
  shell). El recuento se leyó en un segundo comando.
- **Los 41 saltados de más aquí (134 frente a 93)** son lo que esta máquina no puede correr: sin Postgres ni Docker, lo
  gateado por `TRAMOS_PG_URL` / `LIBRO_PG_URL` no se ejecuta. **No cuenta ni como verde ni como rojo**; CI sí los corre
  («con banco desechable»). No se ha comprobado uno a uno que los 41 sean exactamente esos.
- **Los 4 tests de más en CI (8.318 frente a 8.314)** no se han casado uno a uno: sin determinar.

## 2 · El censo — una fila por fallo

| fallo | qué afirma (del mensaje real) | por qué cae | ¿CI también? | desde cuándo | causa | carril del arreglo |
|---|---|---|---|---|---|---|
| **804b** · «SUELO y CONTROLES» | que el censo de la regla 42 saca FUERA a `NEGATIVO`, un ticket con rama viva sin mergear: «SCRUM-1107 tiene rama viva SIN mergear y el criterio lo saca DENTRO … `'DENTRO' !== 'FUERA'`» | la última rama de 1107 (`scrum-1107c-garantia-desatasco`, PR #1758) se mergeó en el propio `dac1f9d7` (14:52:01Z); en el remoto no quedó ninguna `scrum-1107*` | **SÍ, y era el único**: `main` (run 36150352928) y los PR posteriores (vistos 1096 y 1105) | 14:52:05Z del 25-sep. En `main` desde las 15:27:51Z con `NEGATIVO = 1118` (#1760, `2010ced5`); sobre el ancla pasa 5/5 | **estructural, medida:** el control depende del estado VIVO del remoto y caduca cada vez que su ticket se mergea. `git log -p` del fichero: **4 valores escritos a mano en 8 días — 880 (17-sep, `3c051e06`) → 1099 (23-sep, `1061a9d2`) → 1107 (24-sep, `f543524e`) → 1118 (25-sep, `2010ced5`)**. 1118 caduca en cuanto entre su PR (#1761, con auto-merge) | **cerrado en este censo por SCRUM-1120** (PR #1766, abierto al escribir esto): el negativo se deriva del estado vivo. No se investiga más aquí |
| **939b** ×3 · «los tres controles de la fase a», «EL TRINQUETE», «EL QUE DECIDE» | el trinquete de las skills obligatorias | confirmado, **no reinvestigado** (encargo): depende de la ruta de `gh.exe` en Windows | **NO** | ya medido en SCRUM-1113 | **SCRUM-1113**, PR #1764 (abierto al escribir esto) | J3. Queda sin explicar que **en la pasada 2 de J3 no cayera** |
| **910d** · el fichero entero (`not ok 919`, `testCodeFailure`) | los **5** tests del fichero **pasan**: nombran en `/recibo` solo el botón que se pinta | el **proceso** muere al salir: `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c, line 94`, código `3221226505` (0xC0000409) | **NO** | desde que nació el test: 23-sep (#1694, `62176956`). Ya lo citan SCRUM-1008, 1051, 1086 y 1103 como «ruido» | **disparador medido** (§3): `--test-force-exit` + libuv de Windows | **J2** (dueño de `billing/` y del test de SCRUM-910); ver §3 por qué puede ser de la tanda y no del test |
| **815** · «③ con UNA sola instancia, el tope de 500 también lo olvida» (`scrum815-idempotencia-del-webhook.test.mjs:98`) | que otra instancia del proceso olvida los eventos de Stripe ya vistos | en J3/pasada 1: «SUELO: el proceso hijo no ha arrancado (1)» — `spawnSync(process.execPath, ['-e', …])` salió con **1 y stderr vacío** | **NO** | **no se reproduce hoy** (§4) | **sin determinar** | sin carril hasta reproducirlo; el test es de **J2** (`stripe.routes.ts`) |
| **824b** · «el vigía calcula desde el commit MÁS ANTIGUO» (`scrum824b-el-mas-antiguo-no-es-el-primero.test.mjs:135`) | que el vigía de despliegue mide el hueco desde el commit más antiguo | en J3/pasada 1: `git commit --allow-empty -q` en un repo temporal salió con **`status: 1`, stdout y stderr vacíos** | **NO** | **no se reproduce hoy** (§4) | **sin determinar** | sin carril hasta reproducirlo; el vigía es de **S5** |

## 3 · 910d: qué hay aquí que el runner no tiene

«Windows» es un sitio, no una causa. Lo que se midió, sobre el ancla, cambiando **una sola cosa** cada vez:

| cómo se corre `tests/scrum910d-microcopy-recibo-pendiente.test.mjs` | resultado |
|---|---|
| `node --test --test-force-exit …` (la forma de `npm test`) | **aborta 3 de 3** (y 11 de 11 antes: 5 desde bash, 6 desde PowerShell con tubería y con fichero) |
| `node --test …` **sin** `--test-force-exit` | **verde 3 de 3** |
| `node tests/scrum910d-….test.mjs` (sin el runner) | **verde 3 de 3** |

- **El disparador es `--test-force-exit`**, que va en el script `test` de `package.json` y por tanto en toda tanda.
- **Lo que hay aquí y no en el runner:** el **libuv de Windows**. La aserción está en `src\win\async.c`, un fichero que la
  compilación de Linux de Node no lleva; CI corre con la misma bandera y no tiene ese código. La salida forzada corta el
  proceso mientras un manejador asíncrono se está cerrando, y el libuv de Windows lo trata como fallo fatal.
- **Qué manejador:** probable, **no demostrado** — el `fetch()` del test contra `server.listen(0)` y el `server.close()`
  posterior (las únicas E/S del fichero, líneas 70–73). No se ha medido cuál es.
- **Por qué el carril está abierto:** el test es de J2, pero la bandera es de la tanda (`package.json`). Si el arreglo es
  cerrar bien lo que abre el test, es de J2; si es cómo sale la tanda en Windows, es de quien lleve `tanda-con-veredicto`.
  No lo decido: lo digo.
- **Sin explicar:** J3 lo vio verde una vez (pasada 2), con `node_modules` idénticos a los míos (407 paquetes, 0 versiones
  distintas). Es una carrera, con tasa muy alta aquí, no un determinismo.

## 4 · 815 y 824b: lo que se midió y lo que NO se puede afirmar

El encargo los traía como «solo caen con la suite entera», y por eso como interferencia entre tests. Medido, **eso no se
sostiene todavía**:

- **Solo se han visto caer una vez**: la pasada 1 de J3. En la pasada 2 de J3, en mis dos tandas enteras y en CI, verdes.
  Una de cuatro tandas enteras no es «siempre con la suite entera»: es «**una vez**, en una tanda entera». Sueltos, 47/47 ×3.
- **Lo que las dos caídas SÍ comparten, medido en su salida:** no es una aserción de lógica, es un **proceso hijo que sale
  con 1 sin escribir una línea** (`node -e …` en 815, `git commit` en 824b). No se agrupan como una causa: se deja escrito
  que **el síntoma es el mismo** y la causa, sin determinar.
- **Qué cambia entre correrlos solos y con la suite entera — lo probado, y descartado como disparador suficiente:**
  - **carga:** 8 pasadas de los dos ficheros con una tanda entera mía corriendo a la vez (y otra `npm test` de otra sesión
    viva desde las 15:14:57Z): 8 de 8 verdes;
  - **orden y compañía de la suite:** mis dos tandas enteras, verdes;
  - **versión de Node:** las trazas de J3 y las mías dan las mismas líneas internas (`test:911/1332/1390/1465`);
  - **agotamiento de recursos de Windows:** el log de Sistema no tiene **ningún evento** entre 14:45Z y 15:15Z (control
    positivo: el mismo log sí devuelve 278 eventos en 24 h); la máquina tiene 15,9 GB de RAM.
- **Qué hay aquí que el runner no:** **sin determinar**. No hay dato que lo diga, y no se rellena el hueco con una hipótesis.
- **Siguiente medida** para quien lo coja: que el test guarde `r.error`, `r.signal` y el código real del hijo cuando caiga
  (hoy 815 imprime `stderr`, que llegó vacío, y 824b solo `status`). Sin eso, la próxima caída tampoco dirá nada.

## 5 · Errores propios (A9)

- **La primera tanda no valía:** `node_modules` del árbol era viejo (le faltaba `read-excel-file`) y el `tsc` salió con 2;
  la tanda arrancó igual contra un `dist/` viejo. La paré, hice `npm ci` con el lockfile de `main` y la relancé exigiendo
  build en 0 antes de correr.
- **Un `grep` del recuento no vio nada** por los códigos de color de la salida `spec`; un «rc=0 sin recuento» casi se lee
  como verde. Se volvió a leer quitando los escapes.
- **Leí mal el huso de `CreationDate`** y creí que mi propia tanda era de otra sesión.
- **Mandé al orquestador un BLOQUEO por 804b ya caducado:** no hice `fetch` antes de avisar, y `main` lo había arreglado
  8 minutos antes. Lo corregí en el siguiente mensaje.

## 6 · Suelo declarado

- Sin Postgres ni Docker: lo gateado por `TRAMOS_PG_URL` / `LIBRO_PG_URL` (41 saltados de más frente a CI) **no se ha
  corrido**.
- «¿CI también?» se contestó con los logs de CI de `main` (run 36150352928) y con los de los **40** últimos runs de `ci.yml`
  en fallo (23-sep 08:33Z → 25-sep 15:08Z). Control positivo del barrido: encontró 59 fallos, 4 de ellos de 804b.
- Los ficheros de J3 se leyeron en su carpeta temporal, **solo lectura**.
- Los guards que leen `docs/master/` (117 ficheros, 1.103 tests) se corrieron sobre este expediente: solo caen los tres de
  939b ya censados. El ancla casa con el `RE_ANCLA` real de `scrum267` y un sha corto no casa (control negativo).
