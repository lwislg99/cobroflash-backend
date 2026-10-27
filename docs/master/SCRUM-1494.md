# SCRUM-1494 · PASO 0 del 15-oct: el cuelgue del job de zona NO aparece hoy (Sesión 5)

**Medido contra:** `origin/main` = `73e41ab00f727fae5c6c8f1715d6eb6749133502` · 2026-10-15T16:11:46Z

A9: sin fallo que generalice — sólo medición: el PASO 0 dio cero y se dijo, con el control positivo de la sonda.

**Sólo medición. No se construye nada**, porque el defecto no se reproduce en la ventana de hoy (A2).

Sonda de solo lectura (`gh api`, en el temporal del job `2558c165`): los jobs cuyo nombre contiene «zona» en las
**80 últimas corridas** del workflow `CI`, creadas entre el 2026-10-14T09:15:36Z y el 2026-10-15T16:09:11Z.

| | jobs de zona |
|---|---|
| total | 58 |
| `success` | 35 |
| `failure` | 6 |
| `cancelled` | 12 (**ninguno** a ≥ 44 min: se cortaron antes, por un empujón nuevo) |
| sin terminar | 5 |
| **al techo (≥ 44 min)** | **0** |
| terminados, duración | de 12,7 a 22,2 min |
| entre 20 y 44 min | 15 |

**Control positivo de la sonda:** dos de los 8 runs del ticket (`37470969758`, `37511808504`) salen `cancelled` a
45,3 y 45,9 min. Si hoy hubiera alguno al techo, la sonda lo vería.

**Lo que esto NO dice:**
- No dice que esté arreglado: no sé qué lo trajo el 6-oct ni qué lo quitó. Si fue un fichero de test que se colgaba
  y después se cambió, puede volver con otro.
- Los terminados ahora tardan hasta 22,2 min; el 6-oct, 11-17. Puede ser más tests o máquinas más lentas. No lo he
  separado.
- La propuesta del ticket (un límite por fichero en `run()` de `scripts/_trinquete-de-zona-hijo.mjs`, para que un
  cuelgue salga NOMBRADO y no se coma 45 min) sigue teniendo sentido como seguro. Pero hoy no hay un rojo con el que
  verla caer, y la aceptación 1 pide un caso sembrado. Construirla o no lo decide el orquestador.

## SCRUM-1494b · el caso SEMBRADO, medido, y por qué todavía no está construido (Sesión 5)

**Medido contra:** `origin/main` = `73e41ab00f727fae5c6c8f1715d6eb6749133502` · 2026-10-15 ~16:3xZ (`Date:` de GitHub
16:13:17Z al empezar la tanda) · node v24.8.0 · Windows.

A9: comprobación → `tests/scrum1294-a9-leccion-en-a10.test.mjs`

*(El fallo de esta tanda: escribí tres registros sin su línea A9, y lo vi porque el CI de #2484 —la 1557 de mi
puesto— cayó por lo mismo. Ese test ya lo para; en 1467 y 1506 el ancla, además, iba con «15-oct-2026» y el guard
no la veía. Corregido en los tres.)*

El orquestador decidió construirlo (15-oct, 1ª tanda), con el rojo sembrado primero. **El rojo está visto. Lo
construido NO, por carril** (abajo).

### El banco

`docs/master/evidencias/SCRUM-1494/banco-cuelgue-sembrado.mjs` siembra en un temporal FUERA del árbol tres ficheros que
no terminan de tres maneras y les lanza el hijo de zona en tres variantes, cada una construida sustituyendo UNA línea
de `run()` (aborta si la sustitución no se aplicó). Tope de pared 30 s. Cada pasada lleva además un `sano.test.mjs`.

| variante | colgado DENTRO de un test | colgado AL CARGAR (fuera de test) | test que acaba y deja un temporizador |
|---|---|---|---|
| `antes` (el hijo de hoy) | **TOPE 30 s**, sin medida, sin nombre | **TOPE 30 s**, sin medida, sin nombre | acaba 0,1 s (lo salva `forceExit`) |
| `timeout: 5000` (la propuesta del ticket) | acaba 5,1 s · `fail` con su nombre (`testTimeoutFailure`) | **TOPE 30 s: NO lo corta** | acaba 0,1 s |
| `timeout` + `signal: AbortSignal.timeout(10000)` | acaba 5,2 s · nombrado | acaba 10,1 s · `fail` con el nombre del FICHERO (`testAborted`) | acaba 0,2 s |

`POBLACION=3 variantes × 3 semillas · CONTROL · «antes» se cuelga con una semilla · EXIT=0`. **Coste: ~2,5 min el
banco entero** (los 30 s de cada TOPE); **el caso que prueba el arreglo cuesta 5-10 s**. Comprobado además a mano: tras
el aborto por `signal` no queda ningún `node.exe` con el fichero colgado en `Win32_Process`.

### Lo que dice

1. **La propuesta del ticket tal cual (`timeout` en `run()`) NO basta:** es un límite POR TEST. Un fichero que se
   cuelga al cargarse (un `await` de nivel superior, un import que no vuelve) sigue comiéndose el techo. Los 8 del
   6-oct dejaban 3 `node` vivos, lo que encaja con los dos tipos; no sé cuál fue.
2. **El que corta los dos es un `signal` de pared** en `run()`: mata al hijo de test, y el fichero sale nombrado. Pero
   es GLOBAL a la pasada: lo que aún no hubiera acabado sale abortado también.
3. **Por eso la aceptación 3 no es opcional:** hoy el hijo apunta todo `test:fail` como `fail`. Un fichero cortado en
   una zona y verde en la otra sería un `pass`↔`fail` = acusación de zona falsa. El `failureType` lo distingue
   (`testTimeoutFailure`, `testAborted`), así que el hijo puede apuntarlo como un estado aparte y el comparador
   (`_trinquete-de-zona.mjs`) tratarlo como «no pude comparar», igual que hace con `ausente` desde SCRUM-1335b.

### Por qué no está construido: carril

Todo el arreglo vive en `scripts/_trinquete-de-zona-hijo.mjs`, `scripts/_trinquete-de-zona.mjs` y
`tests/scrum813-trinquete-de-zona.test.mjs`. **`ci.yml` (lo de S5) no cambia ni una línea.** En `dos-equipos.md`:
`trinquete-de-zona.mjs` y `_trinquete-de-zona.mjs` son «un cruce que se coordina» (S3 por la excepción de SCRUM-1335
c.18387, ticket con `area-j6`), y el hijo no tiene fila. El comentario 19439 de este ticket ya lo previó: «si la parte
del guion acaba siendo trabajo aparte, se dice entonces y se reparte entonces». Se dice ahora. Falta la excepción
escrita de quien pueda darla para que lo construya la S5, o el reparto a S3.

## SCRUM-1494c · CONSTRUIDO: el hijo corta por test y por pared, y lo cortado no acusa (Sesión 5)

**Medido contra:** `origin/main` = `95bb7e71de1b7989716d7a713d2792ae560702e0` · 2026-10-15T17:50:00Z (`Date:` de GitHub) ·
node v24.8.0 · Windows.

A9: comprobación → `tests/scrum813-trinquete-de-zona.test.mjs`

La comprobación son los cinco casos SCRUM-1494 de ese fichero y las mutaciones ㉓-㉖ de §③.

**Excepción de carril, literal (orquestador, 15-oct-2026):** «`_trinquete-de-zona-hijo.mjs` no tiene fila de dueño → es
tuyo. Y te autorizo a tocar `_trinquete-de-zona.mjs`, que es carril S3/J6, SÓLO en lo que exija este arreglo, con tres
condiciones: ① declara línea por línea qué cambias ahí · ② avisa a `s3-15octc` cuando lo hagas · ③ si el cambio crece
más allá del corte por techo, PARA y dímelo. `tests/scrum813…` va con ello. `ci.yml` no se toca.» Aviso a `s3-15octc`
enviado ANTES de tocarlo (17:4xZ), con la lista de abajo. Respuesta de S3: «adelante… Ninguna rama mía lo toca», con
la advertencia de que **no lo ha revisado contra el código** (cierre por fin de uso). Revisión de S3 pendiente.

### ① Lo que cambia en `_trinquete-de-zona.mjs` (carril S3/J6), línea por línea

1. `export const CORTADA = 'cortada'` junto a `AUSENTE`, con su comentario.
2. `compararZonas`, el `porZona`: un `cortada` se lee como `AUSENTE` (va a «sin comparar», nunca acusa).
3. `resolverRepesca`, el `return` final de `aSolasDe`: «igual» exige además que a solas no esté `cortada`. Sin esto, una
   prueba cortada otra vez a solas tiene clave y saldría «comparada, y da lo mismo».
4. `medirEnZona({ …, topes })`: parámetro opcional que pasa al hijo el límite por test y la pared (para que el 813 siembre
   cuelgues de segundos); y la medida devuelve `topes` (lo que el hijo usó y si saltó la pared).

Nada más. El guion `trinquete-de-zona.mjs` (también S3) y `ci.yml` **no cambian**. ③ no se disparó: el cambio no creció.

### ② Lo de `_trinquete-de-zona-hijo.mjs` (sin dueño)

- `run({ …, timeout: LIMITE_TEST_MS, signal: AbortSignal.timeout(PARED_MS) })`.
- Topes por defecto: **5 min por test**; **pared = min(15 min, 2 min × nº de ficheros)**. Medido hoy en las 4 últimas
  corridas verdes de `main` (`38524399363`, `38523752814`, `38513039979`, `38503362389`): una pasada de 1.338 ficheros
  tarda **346-559 s**. 15 min = 1,6 × la más lenta. Con un cuelgue: 2 pasadas × 15 + repesca 2 × 2 min ≈ 34 min + el
  montaje del job, bajo el techo de 45. **Si una pasada normal se acerca a ~12 min, hay que subir la pared.**
- `failureType` `testTimeoutFailure` / `testAborted` / `cancelledByParent` → `cortada`, no `fail`.
- 🔴 **Medido al construir, no estaba en el diseño de 1494b:** un test cortado dentro de un `describe` deja al `describe`
  con `failureType: 'subtestsFailed'`. Leído como `fail`, el corte volvía a acusar por la puerta del padre. El hijo lleva
  por fichero y nivel (`nesting`) qué hubo debajo: si sólo cortes, el padre es `cortada`; si alguna caída real, `fail`.

### ③ Rojo primero, verde, mutación

| corrida | resultado |
|---|---|
| 813 con los dos scripts de `HEAD` (+ sólo la constante `CORTADA`, para que el import no muera por enlace) | **TOPE 120 s: el fichero NO ACABA** (el hijo espera para siempre al cuelgue al cargar). Ningún `node` huérfano después |
| 813 con el arreglo | **48/48 en verde, 11,8-12,5 s** |
| ㉓ el corte vuelve a ser `fail` | CAZADA (7 rojos) |
| ㉔ el padre del cortado cae | CAZADA (5 rojos) |
| ㉕ el comparador lee `cortada` como veredicto | CAZADA (7 rojos) |
| ㉖ la repesca da por comparado lo cortado | CAZADA (5 rojos) |

Las mutaciones se aplicaron con un guion de la tanda (fuera del árbol) que restaura los bytes; `git diff --stat` igual
antes y después. **`npm run meta:mutaciones` NO lo he corrido.** La mutación que quita el `signal` no está en la lista a
propósito: su rojo es un cuelgue.

### 💰 Coste, para que nadie lo agrande sin saberlo

- **El banco** (`banco-cuelgue-sembrado.mjs`): ~2,5 min. No va en ninguna tanda.
- **Los casos nuevos del 813** (sí van en cada `npm test`): pared de 4 s, límite de 1 s, cuelgue sólo en Midway ⇒ ~4 s la
  pasada de Midway y ~5 s su repesca. El 813 entero pasa de ~3 s a ~12 s. Bajar la pared de 4 s haría que un CI cargado
  cortara también lo sano.

### Lo que NO dice / no está hecho

- El guion imprime lo cortado dentro de «NO PUDE COMPARAR», nombrado por fichero, pero **no dice que fue un corte por
  tiempo** (sigue citando SCRUM-1405). Decirlo exige tocar `trinquete-de-zona.mjs`, que no entra en la excepción.
- No he visto el arreglo en el job de CI con un cuelgue real: el defecto no se reproduce hoy (1494, PASO 0).
- La propagación al padre supone que los eventos de un fichero llegan hijo-antes-que-padre (medido en un fichero; no
  probado con `describe` concurrentes dentro del mismo fichero).