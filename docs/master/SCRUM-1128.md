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
