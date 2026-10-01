# SCRUM-1128 · «Envío construido» deja de ser «las piezas existen»: llamante Y flag en ON

**Medido contra:** `origin/main` = `bf4d82c68cc74c390af36f92c90cdb915e8c31e8` · 2026-09-25T18:01:17Z

Sesión J1 (`jv-j1`), 25-sep-2026. Rama `scrum-1128-envio-construido-criterio`, separada de la de
SCRUM-1127 a propósito: así este cambio se audita solo. Criterio **aprobado por el fundador**
(«sí aprobado», transmitido por el orquestador de Javier). La interpretación del flag la confirmó el
orquestador (§③).

## ① El defecto, medido

Medido en SCRUM-1127, antes de escribir ninguna fila. La medición completa está en su expediente, §①.
`scripts/_guard-afirmacion-fiscal.mjs::envioConstruido()` daba «envío construido» con **una** de dos
piezas:

- un host de la AEAT junto a una primitiva de red en el mismo fichero de `src/`;
- una fila `model VfSubmission` en `prisma/schema.prisma`.

Con eso, la familia B/C dejaba de bloquear en la landing frases como «conforme a la AEAT» o «ya está
construida».

Llamando al guard en solo lectura sobre la misma `src/` más el esquema propuesto, la frase
**«Nuestra facturación es conforme a la AEAT y ya está construida.» PASABA**. Y la tabla sola no
envía nada: no hay certificado, no hay cableado y el flag está en OFF.

**La causa:** el criterio confundía «las piezas existen» con «el envío funciona».

## ② El criterio nuevo

«Envío construido» exige **las dos cosas a la vez**:

1. **Un llamante.** Un fichero de `src/`, que no sea el propio cliente ni su cola
   (`src/modules/fiscal/verifactu/sif.*.ts`), que importa `enviarSobre` de `sif.client` **como
   valor** y **lo llama**. Se mide **por AST**, no con `grep` (SCRUM-203):
   - **valen** el import directo, el renombrado y el de espacio de nombres (`* as x` → `x.enviarSobre()`);
   - **no valen** un comentario, una cadena, un `import type`, un `{ type enviarSobre }`, un import
     que no llama, una función local con el mismo nombre ni otro módulo.
2. **`SIF_ENABLED` en ON en su valor POR DEFECTO** de `src/core/flags.ts`. Se lee del AST de
   `FLAG_DEFAULTS`, y solo un `true` literal cuenta como ON.

Las piezas se siguen midiendo (`piezasDelEnvio()`, campo `señales`) y se devuelven para informar,
pero **ya no deciden**.

### 🔴 Por qué esto NO es relajar un guard (regla 41 / A7)

**El criterio nuevo es MÁS ESTRICTO.** Todo estado que antes daba «no construido» lo sigue dando.
Además deja de dar «construido» cuando solo existen las piezas. **La landing queda bloqueada MÁS
tiempo, no menos.**

No se afloja un guard para que pase un PR. Se corrige un criterio que abría la puerta demasiado
pronto. **Lo decide la dirección del riesgo, y aquí va al lado seguro.** Quien lo cuestione dentro
de seis meses tiene la prueba en la mutación MA de §④: volver al criterio viejo tumba cinco tests,
el primero de ellos el caso de la tabla.

### 🔴 Cuando duda, el guard BLOQUEA

- **Un `SIF_ENABLED` encendido SOLO en Railway** (variable de entorno) **no lo ve el guard**, y la
  landing sigue bloqueada. Si algún día alguien enciende el flag en el entorno y espera que la
  landing se desbloquee sola, **lo que tiene que fallar es ese despliegue, no el guard**. Hay un test
  que pone `SIF_ENABLED=true` en el entorno del proceso y exige que siga bloqueando.
- Un valor por defecto que no sea un `true` literal (por ejemplo, calculado desde el entorno)
  cuenta como OFF.
- Un `flags.ts` que no se puede leer, o que no tiene el flag, es **CIEGO** (`flag.leido: false`) y
  cuenta como OFF. En el árbol real, un test exige `leido: true`, para que la ceguera no pase por un
  OFF.

### Lo que decide cada caso

| esquema con `VfSubmission` | llamante | `SIF_ENABLED` por defecto | criterio viejo | **criterio nuevo** |
|---|---|---|---|---|
| sí | no | OFF | construido → **PASA** | **bloquea** |
| sí | sí | OFF | construido → PASA | **bloquea** |
| sí | no | ON | construido → PASA | **bloquea** |
| no | sí | OFF | no | **bloquea** |
| no (host + red) | no | ON | construido → PASA | **bloquea** |
| cualquiera | sí | ON | construido | **construido → PASA** |
| sí | sí | OFF en código, ON en Railway | construido → PASA | **bloquea** |

## ③ Una interpretación, confirmada por el orquestador

«El flag en ON» = `SIF_ENABLED` con su **valor por defecto** en `src/core/flags.ts`. Motivo: es el
flag que gobierna la remisión («OFF hasta pruebas AEAT (S1-D)»). Y leer el código en vez del
entorno hace que la duda se resuelva hacia bloquear.

También es de este ticket: **«llamante en el camino de emisión» se mide como «llamante en `src/`
fuera del cliente»**, sin exigir que esté dentro de `invoicing/`. Un diseño con cola remite desde un
proceso periódico y no desde la emisión misma. Exigir la carpeta de emisión haría que el control
positivo **no se cumpliera nunca** en el diseño real, y entonces el guard nunca dejaría decir la
verdad cuando fuera verdad. Sigue siendo estricto porque va junto con el flag en ON: el cliente
no tiene hoy ningún llamante (lo exige un test de SCRUM-1127).

## ④ Verificación

**Las tres obligatorias:**

1. 🔴 **EN ROJO** · `model VfSubmission` + sin llamante + flag OFF → la familia B **sigue
   bloqueando** (`scrum1128 · EN ROJO`). Además la pieza se VE (`señales = ['cola']`) y el flag se
   LEE: no es un verde por ceguera. Tampoco basta una sola condición, en ningún orden: cinco
   combinaciones, todas bloquean.
2. ✅ **CONTROL POSITIVO** · llamante + flag ON → `construido: true` y las dos frases **pasan**. Vale
   con las tres formas de importar.
3. **`scrum537` sigue verde** con el árbol real. Hoy: 0 llamantes, flag OFF (leído), más de 100
   ficheros. El día que haya llamante y flag en ON, su aserción `construido === false` **cae**: es
   exactamente el estado del control positivo del punto 2.

**Mutaciones sobre el guard** (se editó `scripts/_guard-afirmacion-fiscal.mjs` y se restauró; la
restauración se verificó byte a byte):

| mutación | fallos (1128 + 537) |
|---|---|
| MA · volver al criterio viejo (basta una pieza) | 5 |
| MB · no exigir el flag | 3 |
| MC · no exigir llamante | 3 |
| MD · un `import type` cuenta como llamante | 1 |
| ME · el flag del ENTORNO manda | 1 |
| MF · cualquier valor que no sea `false` es ON | 1 |

Base sin mutar: `exit 0 · fail 0`.

**Error propio, corregido:** la primera pasada dio **MD MUDA**. Los casos `import type` del test no
llamaban a la función, así que un import de tipo no cambiaba nada que el test pudiera ver. Ahora
llaman, y MD cae.

**Un ajuste en `scrum537`:** su test «lo que se EMITE no cuenta como envío» mira ahora solo las
señales `host-aeat`, que son lo que vigila (una cadena emitida contada como llamada). La pieza
`cola` no es una cadena emitida. Sin ese filtro, el PR del esquema de SCRUM-1127 la pondría en
rojo por un motivo que no es el suyo. La aserción que importa (`construido === false` sobre el
árbol real) **no se ha tocado**. Su mensaje ahora nombra los llamantes y el flag.

**Tests:** `scrum1128` + `scrum537` sueltos: **29 · 29 pass · 0 fail**. `npm test` entero:
**NO SE COMPLETÓ en local.** Claude Code la paró por falta de memoria de la máquina, y no se relanzó por decisión propia. En su lugar se corrieron en primer plano los guards que tocan lo cambiado: `scrum537`, `scrum1128`, `scrum237`, `scrum694` ×3, `scrum267`, `scrum835`, `scrum838`, `scrum836` y `scrum400`. Son 13 ficheros: **117 tests · 117 pass · 0 fail · 0 skipped**. La tanda entera la da el CI del PR.

## ⑤ Lo que este ticket NO hace

- ⛔ **No toca los flags.** `SIF_ENABLED` e `INVOICING_ES_ENABLED` siguen en OFF.
- ⛔ **No toca el texto de la landing.** Cambia **cuándo** se permite decir algo, no **qué** se dice.
  Lo que se diga sigue siendo firma del fundador (regla 39).
- ⛔ **No toca el camino de emisión** (regla 40).
- **Desbloquea el PR ③ de SCRUM-1127** (el esquema de `VfSubmission`), que además necesita que
  Javier aplique antes el ALTER en las tres bases (A5). Las dos cosas, no una.

---

# SCRUM-1128b · Las tres comprobaciones, medidas por efecto con la fila YA en el esquema

**Medido contra:** `origin/main` = `e9e71cab67574538943cd94392bdecf5f3dcbfa2` · 2026-10-01T01:55:21Z

A9: sin fallo que generalice — la medición confirma lo construido; los dos enganches que el guard no cuenta (§⑤) ya los pone en rojo `tests/scrum1127-sif-client.test.mjs`, medido en X1 y X2.

Sesión J6b (`jv-j6b`), 1-oct-2026, por encargo del orquestador de Javier. Rama
`scrum-1128b-las-tres-por-efecto`. **Sólo registro y banco: ni `src/`, ni `scripts/`, ni `tests/`,
ni flags, ni landing.**

## ① Por qué se vuelve a medir

Las tres verificaciones del enunciado se corrieron el 25 y el 26-sep (§④ de arriba; comentario
17153 de Jira, S0, sobre `942e90d1`), **cuando `model VfSubmission` todavía no existía en el
esquema**: el caso que importa sólo se había visto sobre una raíz fabricada. La fila entró en `main`
el **30-sep a las 21:35:42Z** (PR #2014, merge `d568599635ab018262aae596843eeb6206925ce5`,
SCRUM-1296). Desde ese momento el caso ① dejó de ser una fixture y pasó a ser el estado de `main`.

Lo que ya estaba medido sin que nadie lo dijera: `scrum537` corre sobre el árbol real en el check
obligatorio, así que **cada merge desde #2014 ha comprobado `construido === false` con la fila
dentro**. Lo que no estaba medido en ningún sitio: qué habría pasado con el criterio viejo, y el
control positivo y la caída de `scrum537` sobre el `src/` de verdad en vez de sobre una raíz de
cuatro ficheros.

## ② El banco

`docs/master/evidencias/SCRUM-1128/medir.mjs`. Saca una copia de `origin/main` **fuera del árbol**
y hace de ella ocho escenarios; cada uno es la copia con una modificación declarada. El llamante y
el flag en ON existen **sólo en la copia**: en el repositorio no se ha encendido nada ni se ha
cableado nada. Sobre cada escenario corre el guard de hoy, el guard de antes de SCRUM-1128
(`32da2be5^`) y los dos tests enteros **dentro de la copia**, con el entorno construido a mano y el
TAP leído de fichero.

Población de cada escenario (la declara el banco, y sale CIEGO si no llega a sus suelos): **310 ficheros `.ts`
de `src/`** (311 con el llamante), **5 menciones de hosts de la AEAT**, esquema leído, flag leído,
**4 páginas públicas, 17.942 caracteres visibles**. Las frases son las cuatro del enunciado: «ya está
construida» (familia B), «ya cumple», «conforme a la AEAT» y «validada por la AEAT» (familia C).

## ③ Lo medido

| | escenario | piezas | llamantes | flag | criterio de hoy | criterio viejo | las 4 frases (hoy) | `scrum537` |
|---|---|---|---|---|---|---|---|---|
| **H** | **`main` tal cual** | cola | 0 | OFF | **no construido** | construido | **BLOQUEA las 4** | 18/18 verde |
| H0 | hoy sin la fila | — | 0 | OFF | no construido | no construido | bloquea las 4 | 18/18 verde |
| **P** | **llamante en `src/core/cron/` + flag ON** | cola | 1 | ON | **construido** | construido | **pasan las 4** | **17/18 · cae 1** |
| P1 | sólo el llamante | cola | 1 | OFF | no construido | construido | bloquea las 4 | 18/18 verde |
| P2 | sólo el flag ON | cola | 0 | ON | no construido | construido | bloquea las 4 | 18/18 verde |
| X1 | llamante en `verifactu/sif.cron.ts` + flag ON | cola | 0 | ON | no construido | construido | bloquea las 4 | 18/18 verde |
| X2 | `enviarSobre` pasado por referencia + flag ON | cola | 0 | ON | no construido | construido | bloquea las 4 | 18/18 verde |
| M | hoy, con el guard viejo puesto en su sitio | cola | — | — | — | construido | — | **17/18 · cae 1** |

**① El caso que importa — SIGUE BLOQUEANDO (fila H).** Con la fila en el esquema, sin llamante y con
el flag en OFF, las cuatro frases caen. No es un verde por ceguera: la pieza `cola` se VE, el flag se
LEE, y un `SIF_ENABLED=true` puesto en el entorno del proceso no cambia nada.

Y la puerta estuvo abierta de verdad: **el criterio viejo, sobre el `main` de hoy, da «construido» y
deja pasar las cuatro frases.** Que es la fila lo que la abría lo dice H0: quitándola, el viejo vuelve
a bloquear. Y que hay algo permanente sujetándola lo dice M: con el guard viejo puesto en la copia de
hoy, `scrum537` cae en «el hecho se DERIVA del codigo, y hoy el envio NO existe».

Lo que **no** había hoy era nadie cruzándola: las cuatro páginas públicas llevan **0 afirmaciones**
de ninguna familia, con cualquiera de los dos criterios.

**② El control positivo — DEJA DE BLOQUEAR (fila P).** Con un llamante fuera del cliente y el flag en
ON por defecto, `construido: true`, la salida dice «SI (familia B deja de bloquear)» y las cuatro
frases pasan. No se ha apagado el guard: en ese mismo escenario la familia A («en certificación»)
**sigue bloqueando**, y con una sola de las dos condiciones (P1, P2) siguen cayendo las cuatro.

**③ `scrum537` — verde hoy, y cae cuando funcione.** Verde en H (18 tests, 18 pass, 0 fail, 0
saltados). En P cae **exactamente uno**, «el hecho se DERIVA del codigo, y hoy el envio NO existe»,
y no cae con una sola condición (P1, P2: 0 fallos).

## ④ Lo que el banco NO mide

- El llamante de P es **simulado**: un fichero de siete líneas que envuelve `enviarSobre` en el
  `enviar` que pide `procesarObligado`. No compila contra nada ni se ejecuta. Lo que prueba es qué
  **ve el guard**, no que el envío funcione — que es justo lo que el guard tampoco puede saber.
- `scrum1128` en la fila M sale «1 test, 1 fallo»: es el fichero que **no carga** (el guard viejo no
  exporta lo que importa), no un hallazgo. Un rojo sin población no cuenta, y no se cuenta.
- La columna «importan `sif.client`» del banco replica la expresión de
  `tests/scrum1127-sif-client.test.mjs` en vez de correr ese fichero, que exige `dist/`.

## ⑤ Dos enganches que el guard NO cuenta — y por qué hoy no son un hueco

Los dos van hacia el lado seguro (bloquea de más, nunca de menos), y se dejan escritos porque el día
que ocurran la landing seguirá bloqueada con el envío funcionando, y `scrum537` **no** caerá para
avisarlo:

- **X1 · el enganche se llama `sif.<algo>.ts` y vive en `verifactu/`.** El guard excluye
  `sif.[a-z]+.ts` entero («el cliente y su cola no son llamantes de sí mismos»), así que un
  `sif.cron.ts` que llame a `enviarSobre` no cuenta.
- **X2 · `enviarSobre` se pasa por referencia** (`procesarObligado(nif, enviarSobre)`): no hay
  llamada en el AST.

Ninguno pasa en silencio: en los dos, el fichero nuevo importa `sif.client`, y
`tests/scrum1127-sif-client.test.mjs` exige que el único importador sea `sif.cola.ts`. Ese rojo es
el que obliga a decidir. **No se ha tocado el guard**: la exclusión es del criterio aprobado y
cambiarla es otro ticket, de su dueño.

## Reproducir

Desde la raíz del repo, con `B` apuntando a un directorio vacío **fuera del árbol**:

    git rev-parse origin/main > "$B/sha-main.txt"
    mkdir -p "$B/hoy" "$B/node_modules"
    git archive origin/main src prisma/schema.prisma public/index.html public/precios.html public/terminos.html public/privacidad.html scripts/_guard-afirmacion-fiscal.mjs tests/scrum537-afirmacion-falsa.test.mjs tests/scrum400-conformidad-landing.test.mjs tests/scrum1128-envio-construido.test.mjs | tar -x -C "$B/hoy"
    cp -r node_modules/typescript "$B/node_modules/typescript"
    git show 32da2be5^:scripts/_guard-afirmacion-fiscal.mjs > "$B/guard-viejo.mjs"
    node docs/master/evidencias/SCRUM-1128/medir.mjs "$B"

Sale 0 si las catorce comprobaciones dan lo esperado, 1 si alguna no, 2 si el instrumento está ciego.
La salida de esta pasada, entera: `docs/master/evidencias/SCRUM-1128/medicion.txt` (14 de 14,
`ciegos=0`, `EXIT=0`).
