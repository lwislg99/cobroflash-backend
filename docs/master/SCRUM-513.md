# SCRUM-513 · la afirmación de que la R1 se queda fuera del registro era FALSA, y llevaba 18 días escrita

**Medido contra:** `origin/main` = `a241b6e48c6553e453375bf705ca76ac3045ac0d` · 2026-08-17T14:03:00+01:00

> **17-ago-2026 · documentación + medición. NO cambia comportamiento: el diff de
> `verifactu.service.ts` es COMENTARIOS Y NADA MÁS, probado por dos vías.**

## La víctima, que es lo que dimensiona el ticket

`verifactu.service.ts` afirmaba, en el bloque que construye el registro de una rectificativa, que
**«hoy `MODO_TIPO_RECTIFICATIVA` vale SIN_CONFIRMAR, así que la R1 se EXCLUYE del registro»**. Las
dos mitades eran falsas desde el **30-jul-2026**, cuando el fundador movió el modo a
`INCREMENTAL_I`. El código cambió; la frase se quedó.

Quien construya la remisión al SIF en **octubre** iba a leer esa línea —dentro del propio fichero
que genera el registro, que es el sitio de máxima autoridad aparente— y podía dejar las
rectificativas fuera. Eso no es un fallo de interfaz: es un **incumplimiento**, con fecha límite
legal en enero, y con el primer profesional real (el padre de uno de los fundadores) emitiendo de
verdad para entonces.

## La premisa era DOBLE y las dos mitades se comprobaron por separado

| Mitad | Veredicto | Cómo |
|---|---|---|
| El comentario afirma que la R1 se EXCLUYE por `SIN_CONFIRMAR` | ✅ **CIERTA** (el defecto existía) | localizado por CONTENIDO, no por coordenada — grep de `SIN_CONFIRMAR\|EXCLU` sobre el fichero |
| El modo real vale `INCREMENTAL_I` | ✅ **CIERTA** | `MODO_TIPO_RECTIFICATIVA` en `registro.builder.ts`, y **valor observado en ejecución**, no leído del fuente |

**No hay entrada previa:** `docs/master/SCRUM-513.md` no existía en `main`. Búsqueda por contenido
sobre el repo (`FLAG-FISCAL`-style, aquí `SIN_CONFIRMAR`/`INCREMENTAL_I`/`resolverTipoRectificativa`):
el trabajo no estaba hecho bajo otro número.

## Punto 2 · LA MEDICIÓN: ¿entra hoy la R1 en el registro?

# SÍ ENTRA.

Se declara como **`TipoRectificativa` = I**, **sin** `ImporteRectificacion` (que es lo correcto:
AEAT 1119 lo prohíbe cuando no es por sustitución), con su bloque `FacturasRectificadas`, y el
paquete la **cuenta**.

**No se dedujo. Los dos indicios disponibles eran sospechosos** —el comentario, que ya había
mentido, y el nombre de la constante, que es un nombre— así que la respuesta sale del
**comportamiento**, ejercido con un doble.

### Instrumento A · sonda propia, doble propio (`buildVerifactuRegistrosXml`)

Fixture distinto al de la casa a propósito: si compartieran datos no serían dos instrumentos.

| Observable | R1 sola, modo por defecto |
|---|---|
| `count` | **1** |
| `excluidos` | **`[]`** |
| bloques `<sum1:RegistroAlta>` | **1** |
| la R1 **dentro** de un `RegistroAlta` | **1** |
| `TipoRectificativa` | **`I`** |
| `FacturasRectificadas` | presente |
| `ImporteRectificacion` | **ausente** (1119 ✓) |
| `TipoFactura` | `R1` |

Y a nivel de unidad, `resolverTipoRectificativa()` **sin pasar modo**: no lanza, devuelve
`<sum1:TipoRectificativa>I</sum1:TipoRectificativa>` con `importeXml` vacío.

**SUELO** — una F1 por el mismo camino da `count 1` y su propio `RegistroAlta`. Si NINGÚN tipo
hubiera producido registro, el resultado sería «no supe mirar», que es lo contrario de «no entra»
con el mismo número. La sonda **aborta** si eso pasa.

**CONTROL POSITIVO** — la MISMA R1 forzando `SIN_CONFIRMAR`: `count 0`, `excluidos[0].number` = la
R1, motivo nombrando 1114 y P12. O sea que la sonda **sabe ver una exclusión**: el `excluidos: []`
del caso por defecto significa algo.

**CONTROL NEGATIVO, y la primera versión NO PROBABA NADA.** Miraba el XML de la R1 sola bloqueada
para comprobar que mencionar el número no cuenta como registrarlo — pero cuando se excluye TODO, el
constructor devuelve `xml: ''`, así que el número no aparecía y la discriminación **nunca se
ejercía**: un control que pasa porque el caso difícil no se dio se lee igual que uno que funciona.
Rehecho mezclando **F1 declarada + R1 excluida**: el XML sale no vacío, su parte de exclusiones
(SCRUM-209) **nombra** la R1, y la sonda cuenta `0` dentro de `RegistroAlta` para ella y `1` para la
F1. Ahora sí discrimina.

### Instrumento B · el test de la casa (`tests/scrum216-tipo-rectificativa-sin-defecto.test.mjs`)

**13 tests, 13 pass, 0 fail, 0 skip.** Incluye —y esto es lo importante— un caso que ya afirmaba
exactamente lo contrario que el comentario: *«POR DEFECTO la R1 se declara, y se declara como I»*,
con `count === 1`, `excluidos` vacío y el XML **validado contra el XSD de la AEAT** vía
`xmllint-wasm` (comprobado que esa validación devuelve el `valid` real y no un verde de cortesía).

🔴 **El hallazgo de proceso, y vale más que la corrección:** el repo **ya contenía la prueba de que
el comentario mentía**, en verde, desde el 30-jul. Un test correcto y un comentario falso
convivieron 18 días sin que nada los atara, porque **nada compara prosa con comportamiento**. Es el
patrón de la casa —*dos cosas que deben cuadrar y nada las une*— aplicado esta vez a un comentario.

## Punto 1 · La corrección, y por qué NO repite el valor

El comentario reescrito describe lo que hace el código hoy, y sobre todo **deja de duplicar la
constante en prosa**. Duplicarla es lo que permitió que envejeciera en silencio: la próxima vez que
alguien mueva el modo, una frase con el valor dentro volvería a mentir. Ahora la autoridad es
`MODO_TIPO_RECTIFICATIVA` en `registro.builder.ts` —donde vive con su ratchet— y lo que se escribe
aquí es la **consecuencia de cada modo**, que no caduca:

- `INCREMENTAL_I` → declara con `I`, **sin** `ImporteRectificacion` (1119).
- `SUSTITUTIVA_S` → declara con `S`, **con** `ImporteRectificacion` (1118).
- `SIN_CONFIRMAR` → **no declara**: lanza y la R1 sale excluida con su motivo.

Se conserva lo que seguía siendo verdad: omitir el campo no es una cuarta opción (era un 1114 en
CADA rectificativa, SCRUM-216) y el **pendiente fiscal de P12 sigue abierto** — el `I` alinea la
etiqueta con lo que el documento ya contiene, no zanja el dictamen.

### Prueba de que el diff es solo comentarios, por DOS vías

```
docs/legal/SEMAFORO_MAPA_EMISION.md               | 136 +++++++++++++---------
src/modules/invoicing/domain/verifactu.service.ts |  45 +++++--
2 files changed, 120 insertions(+), 61 deletions(-)
```

1. **Toda línea añadida o borrada empieza por `//`.** `git diff -U0` filtrando las que NO son
   comentario devuelve **cero líneas**.
2. **Las dos versiones, con los comentarios retirados, son IDÉNTICAS** (`diff` de
   `git show main:…` contra el árbol, ambos sin líneas `//`): cero líneas ejecutables tocadas.

`TipoRectificativa` y `registro.builder.ts` **no se han tocado** (consulta fiscal abierta encima).

## Punto 3 · El mapa del semáforo: el alcance dado era una MUESTRA, no una medición

El encargo nombraba **cuatro** coordenadas desviadas. El censo del documento devuelve **75 anclas
`#L<n>`** apuntando a **23 ficheros**. Medidas contra el árbol de hoy:

| | |
|---|---|
| anclas con ancla de línea | **75** |
| OK (símbolo a ±3 líneas del ancla) | **2** |
| 🔴 **DESVIADAS** | **41** |
| no comprobables por este instrumento (sin símbolo al lado) | **32** |
| **verificables (ok + desviadas)** | **43** |

**Cómo se contó:** el documento escribe, junto a casi cada enlace y entre comillas invertidas, el
token que ese enlace ilustra (`verifactu_cadena_rota`, `requireRole('admin')`, `getEmissionMode`…).
Se busca ese token en el fichero destino y se compara su línea con el ancla. Las 32 que no llevan
token utilizable **se declaran, no se cuentan como buenas** — que es como se fabrica un verde hueco.
Desvíos típicos de tres cifras: `verifactu_cadena_rota` a **+127** líneas, `getEmissionMode` a
**+457**, `requireRole('admin')` de C7b a **−301**.

### La decisión: se QUITAN los números, no se actualizan

Las 75 anclas pasan a apuntar al **fichero + SÍMBOLO** (nombre de función, constante o código de
error). Dos motivos, y el primero es el que manda:

1. **Escribir 41 coordenadas nuevas sin verificar cada una a mano sería fabricar una medición.** La
   «línea real» de mi sonda es una heurística de proximidad de token, no un objetivo verificado.
   Quitar una coordenada equivocada **no afirma nada**; sustituirla por otra sí.
2. Volverían a derivar con el siguiente commit, que es exactamente el defecto que este ticket
   corrige. Un símbolo sobrevive a que alguien añada un import diez líneas más arriba.

63 textos del tipo `fichero.ts:NN` se limpiaron por script; **2** ya eran simbólicos; **10** del
tipo `:NN` (sin nombre de fichero) se resolvieron **a mano**, midiendo el símbolo real en cada caso
— entre ellos los cuatro guards de integridad, que ahora se nombran:
`invoice_without_lines_not_sealable`, `isReceiptNumber`, `pg_advisory_xact_lock` y
`verifactu_cadena_rota`. La columna `Fichero:línea` pasa a `Fichero · símbolo`, porque prometía algo
que ya no da.

**Post-condición comprobada:** re-corrida la sonda sobre el documento editado → **0 anclas**, y
`grep` de `@@AMANO\|#L[0-9]` → vacío. (La sonda **avisa de SUELO ROTO** con 0 anclas, y es correcto
que lo haga: no puede distinguir «no hay nada que mirar» de «no supe mirar». Aquí el cero es el
estado buscado, y se dice en vez de silenciarlo.)

### 🔴 Y un aviso de vigencia dentro del documento, porque corregir coordenadas NO es re-medir

El mapa es un RECON del 29-jul-2026 y **al menos dos afirmaciones parecen superadas** por tickets
posteriores. **No se reescriben aquí** —exige re-medir cada una con su propia evidencia— pero se
marcan donde tocan, en vez de dejar que alguien las lea como estado de hoy:

- §6.3, fila *«Cualquier fallo de sellado → SIGUE, sin rastro consultable»* — SCRUM-205/206 dicen
  haber cerrado ese fail-open.
- § *«AuditLog no cubre lo fiscal»* — SCRUM-207 añadió `factura_emitida` y las acciones bloqueantes.

## El test exploratorio NO se commitea, y el motivo importa

La sonda respondió el punto 2 y se queda fuera del repo. **No aporta vigilancia permanente que no
exista ya**: `scrum216-tipo-rectificativa-sin-defecto.test.mjs` cubre el mismo comportamiento (caso
por defecto + ratchet de la constante) y **con validación XSD**, que la sonda no hace. Commitearla
sería la duplicación que ese mismo fichero documenta haber consolidado en su cabecera: dos tests que
deben cuadrar, los dos en verde, y la divergencia callada.

**Y lo que SÍ falta no es un test más, es honesto decirlo:** lo que rotó fue la PROSA, y no hay
guard que compare un comentario con el comportamiento. No se ha construido uno porque el comentario
nuevo **ya menciona los tres literales de modo** (en la lista de consecuencias), así que un guard de
texto daría rojo contra código correcto — y un guard que estorba se acaba desactivando (SCRUM-182).
La protección real es estructural y ya está puesta: **el comentario no vuelve a poder mentir sobre
el valor porque ya no lo dice**, y el ratchet de SCRUM-216 obliga a pasar por el fichero de la
constante el día que alguien la mueva.

## Tanda

**Rama:** 3674 tests · 3596 pass · **1 fail** · 77 skip.
**Línea base (`main`), medida APARTE** con los dos ficheros guardados en stash y recompilando:
3674 · 3596 · **1 fail** · 77 skip. **Idénticas.**

El fail es **`scrum480-fin-de-linea.test.mjs` caso 4** («el ÁRBOL DE TRABAJO no tiene ni un `\r`») y
**no es de este cambio**: cae por 25 ficheros de `.agents/skills/impeccable/**` con CRLF en el árbol
de trabajo, versionados el 4-jun-2026 (`d06f6542`, Luis). **Probado sobre la base limpia**: el mismo
caso 4 falla con la misma lista, y los otros 7 de ese fichero pasan. Este diff toca dos ficheros y
ninguno está bajo `.agents/`.

Cliente de Prisma regenerado desde ESTE worktree (`v6.18.0`) antes de medir.

## Ficheros

- `src/modules/invoicing/domain/verifactu.service.ts` — **solo comentarios**, la afirmación corregida.
- `docs/legal/SEMAFORO_MAPA_EMISION.md` — 75 anclas de línea → símbolos, 10 resueltas a mano,
  encabezado de columna, y el aviso de vigencia con lo que NO se re-midió.
- `docs/master/SCRUM-513.md` — esta entrada.
