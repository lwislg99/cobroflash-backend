# SCRUM-762 · el PDF de una factura emitida se regenera con el código de hoy — medido

**Fecha:** 6-sep-2026 · **Carril:** fiscal · emisión · **Gate:** sin gate
**Medido contra:** `origin/main` = `ff4e1c4a14f474d0fb4095cb0643e069388e4935` · 2026-09-06T20:16:48+01:00
**Tanda:** 5683 tests, 5591 pass, 0 fail, 92 skipped (salida 0), tras mezclar main

> 🛑 **ESTE TICKET MIDE. NO CONSTRUYE.** El camino de emisión no se toca: el generador se mutó
> TEMPORALMENTE para poder medir y se restauró con `sha256sum -c`. El fixture vivió en la base de
> DESARROLLO y se borró. `git status` queda vacío y la decisión es del fundador.

---

## ① 🔴 EL CONTROL QUE DECIDE — el mismo documento, dos aspectos

Factura emitida en **desarrollo**, su PDF abierto dos veces sobre la MISMA fila y el MISMO número,
con un cambio visible del generador en medio y el fichero de disco borrado — que es exactamente
lo que hace Railway en cada despliegue (`fs` efímero, dicho por el propio `src/lib/invoicing.ts`).

```
(1) abierto con el generador de HOY  -> 5091 bytes
    [despliegue] generador cambiado + recompilado + fichero de disco borrado
(2) abierto DESPUES del despliegue   -> 5097 bytes

¿el TEXTO que ve el cliente ha CAMBIADO?  SI
rotulo antes  : "CLIENTE"
rotulo despues: "CLIENTE (v2)"
mismo numero  : si (2026-S762-001)
```

**La hipótesis del encargo queda confirmada.** El documento que el cliente descarga hoy no es el
que descargó ayer, con el mismo número y la misma fila.

### 🔴 Dos veces me equivoqué de instrumento antes de llegar aquí, y las dos importan

**(a) Comparar BYTES no vale.** Medido aparte: dos generaciones del MISMO documento con el MISMO
generador dan **bytes distintos** (el PDF lleva fecha de creación embebida) y **texto idéntico**.
El primer «rojo» que obtuve comparando `sha` no probaba nada — era un rojo por el motivo
equivocado. Se compara el TEXTO extraído del PDF.

**(b) Las dos aperturas en el MISMO proceso dieron VERDE, y era falso.** `import(...?v=2)`
invalida la caché de `invoicing.js` pero **no la de su dependencia `pdf.service.js`**, así que la
segunda apertura seguía usando el generador viejo. Un despliegue es un **proceso nuevo**: cada
apertura corre ahora en su propio proceso, que además es más fiel a lo que pasa en producción.

## ② ✅ CONTROL POSITIVO — lo que NO cambia, y lo que NO se pudo comprobar

| campo | resultado |
|---|---|
| `number` | IGUAL ✅ |
| `total` | IGUAL ✅ |
| huella del contenido de la fila | IGUAL ✅ |
| `vfHash` | los dos `null` ⚠️ **no prueba nada** |

**Queda separado lo que cambia (el ASPECTO) de lo que no (el CONTENIDO canónico)** — pero sólo en
los tres primeros. Y **dos correcciones al enunciado**:

- **`contentHash` NO EXISTE en `Invoice`.** Vive en `Albaran.firma` (JSON). En la factura la
  integridad canónica es `vfHash`, la huella de la cadena VeriFactu. Mi primera versión leía
  `f.contentHash`, obtenía `undefined` y comparaba `null` contra `null` de un campo inexistente.
- **En dev no hay ninguna factura sellada:** 0 de 5 tienen `vfHash` o `vfTimestamp`. Así que la
  parte del control positivo que mira la huella **no se ha podido ejercer**. Para cerrarla haría
  falta una factura sellada, y en dev no existe.

## ③ Cuántas hay — y el hallazgo que cambia la urgencia

En **desarrollo**: **5 facturas**, las cinco en `pendiente_de_sellado`.

```
PUEDEN producir PDF hoy: 0 de 5
```

🔴 **Ninguna de las cinco llega siquiera a la regeneración**: `puedeProducirDocumento` corta antes
con `invoice_pendiente_de_sellado`. Para poder medir hubo que crear una factura `no_aplica` (un
merchant sin NIF, que es lo que `entraEnLaCadena` mira). O sea: **en dev el defecto está latente
pero no se puede disparar con los datos que hay**.

⚠️ **Producción NO se ha tocado ni consultado.** Cuántas facturas emitidas hay ahí, y en qué
estado, **es el dato que decide la urgencia y hay que pedirlo**. Con 5 en dev y 0 producibles, lo
que esta medición demuestra es la **corrección** del defecto, no su tamaño.

## ④ Cuánto ha cambiado el generador desde la primera emisión

Primera factura de dev: **19-ago-2026**.

| fichero | commits totales | commits desde el 19-ago |
|---|---|---|
| `pdf.service.ts` (el generador) | 39 | **17** |
| `lib/invoicing.ts` (el que decide regenerar) | 21 | 2 |

**Diecisiete cambios del generador desde que existe la primera factura.** No es una ventana
teórica: si esas facturas hubieran sido producibles, su aspecto habría cambiado diecisiete veces.
*El daño no está demostrado; la exposición sí.*

## ⑤ El presupuesto: **peor que la factura**

`GET /admin/quotes/:id/pdf` (`quotesAdmin.routes.ts`) **regenera SIEMPRE**. No hay `existsSync`,
no hay condición `needs`: llama a `generateQuotePdf` en cada petición y sobrescribe `quote.pdfUrl`.
Su propio comentario lo dice.

O sea que un presupuesto **ya firmado por el cliente** (la ruta contempla explícitamente el caso:
«el PDF sale SIEMPRE con la firma») cambia de aspecto **en cada apertura**, no sólo tras un
despliegue. No está bajo la regla 29, pero es el documento que el cliente firmó.

## ⑥ El coste de la salida ① — lo medible, medido

Tamaño real de un PDF de factura, generado con el código de hoy:

| líneas | tamaño |
|---|---|
| 1 | 5,0 KB |
| 5 | 5,2 KB |
| 20 | 6,2 KB |
| 50 | 7,3 KB |

**El almacenamiento no es el problema**: diez mil facturas caben en menos de 75 MB.

**Lo que sí es el problema, medido:** no existe hoy ningún almacenamiento persistente en el
proyecto. `invoicesDir` es `process.cwd()/storage/invoices`, disco local del contenedor. No hay
S3, ni R2, ni volumen declarado. Congelar el PDF al emitir exige **infraestructura nueva** —
volumen persistente de Railway o almacén de objetos— y eso es **decisión del fundador** (una
dependencia nueva no la decide una sesión).

## ⑦ Las tres salidas, escritas como tales

**① Congelar al emitir.** El PDF se genera una vez, se guarda en almacenamiento persistente y
nunca se regenera. Coste: infraestructura nueva (decisión del fundador) + tocar el camino de
emisión (STOP con firma). El almacenamiento en sí es despreciable.

**② Versionar el generador** y conservar todas las versiones vivas para siempre. Coste: cada
cambio del generador queda inmortal; hoy serían 17 versiones desde agosto y subiendo. Es la
salida que más código deja vivo para siempre.

**③ NO DECIDIR — y hay que escribirla como salida.** Es lo que está pasando hoy: el aspecto de un
documento firmado deriva con cada despliegue y **nadie se entera**, porque el contenido canónico
verifica y el número no cambia. No hay ninguna alarma que salte. La única razón por la que hoy no
hay daño demostrado en dev es que ninguna factura es producible — y eso es una casualidad del
estado de sellado, no una protección.

---

**Tanda:** 5683 tests · 5591 pass · 0 fail · 92 skipped · salida 0, tras mezclar main. Ningún fichero de producción
modificado (`git status` vacío tras las mediciones; generador verificado byte a byte).

---

# APÉNDICE (7-sep-2026) · el control ya no vive en una sesión: vive en la tanda

**Fecha:** 7-sep-2026 · **Carril:** fiscal · emisión · **Gate:** sin gate
**Medido contra:** `origin/main` = `9c989bf0` · rama `scrum-762b-el-control-en-ci`
**Tanda:** 5859 tests, 5757 pass, **0 fail**, 102 skipped, salida **0** (árbol con el test dentro)

> 🛑 **SIGUE SIN CONSTRUIRSE NADA DEL CAMINO DE EMISIÓN.** Este apéndice sólo LEE (regla 38). El
> árbol no se ha tocado ni un instante: el «despliegue» se modela reasignando la exportación del
> generador en el módulo YA CARGADO, y el rojo se probó sobre `dist/` —artefacto de compilación, no
> versionado— restaurándolo byte a byte (`Buffer.compare` contra los bytes originales de disco: 0).

---

## ⓪ OBLIGACIÓN 0 — dos respuestas distintas, y las dos importan

**(a) ¿Está hecho el congelado? NO.** Medido sobre el árbol de `origin/main` = `9c989bf0`, hoy:

| lo que se buscó | dónde | resultado |
|---|---|---|
| la condición que regenera | `src/lib/invoicing.ts:73` | `!fs.existsSync(diskPath)` SIGUE AHÍ |
| una columna donde vivan los bytes del PDF | `model Invoice` (leído entero) | NO EXISTE ninguna |
| almacenamiento persistente declarado | árbol entero | NO HAY `railway.json`, ni Dockerfile, ni S3/R2 |

`invoicesDir` sigue siendo `process.cwd()/storage/invoices`, disco local del contenedor.

**(b) ¿Estaban hechas las tres medidas que el encargo pedía? SÍ, LAS TRES, y hay que decirlo antes
que nada.** No es memoria: `git merge-base --is-ancestor` dice que las dos ramas están en `main`.

| medida del encargo | dónde estaba ya | commit |
|---|---|---|
| ① el control que decide (factura) | este mismo fichero, arriba | `988c40b3` (PR #1105) |
| ② cuánto ha cambiado el generador | este mismo fichero, § ④ | `988c40b3` |
| ③ ¿el presupuesto también? | `docs/master/SCRUM-799.md` — ticket PROPIO, entero | `89b77e51` |

Y el código lo dice de su puño: `quoteDecisionLanding.routes.ts:818` lleva escrito *«HEREDA
SCRUM-799: regenera el PDF con el código de hoy en cada apertura»*.

**Entonces, ¿qué falta de verdad?** Lo que ninguna de las dos mediciones dejó: **un control que
CORRA**. Las dos se hicieron a mano, en dos procesos, contra la base de desarrollo, mutando el
generador y restaurándolo. Eso no está en `npm test`, así que **no vigila nada**: el día que
alguien toque la condición, nadie se entera. Y quedó **un hueco declarado** que aquí se cierra.

---

## ① Lo que este apéndice AÑADE: `tests/scrum762-el-pdf-emitido-se-rehace.test.mjs`

**9 casos, en la tanda normal, sin BD y sin gate.** `ensureInvoicePdf` recibe `prisma` como
parámetro, así que se le inyecta uno de mentira que además REGISTRA lo que se escribe.

```
① SUELO           la factura del escenario está SELLADA y su huella verifica ANTES de nada
② SUELO           el MISMO generador dos veces imprime el MISMO texto  (y bytes distintos)
③ CONTROL DEL     con el fichero en disco NO se vuelve a generar
   CONTROL        -> la causa de ④ es el fichero que falta, y no otra cosa
④ 🔴 EL CONTROL   [despliegue: disco vacío + otro generador] -> OTRO documento, misma fila
⑤ ✅ POSITIVO     número, importe y huella IGUALES; la huella se recomputa y verifica
⑥ ✅ POSITIVO     rehacer el papel no escribe NADA fuera de {pdfUrl, qrData}
⑦⑧ TRINQUETE     el censo por AST de quién rehace un documento al abrirlo
⑨ SUELO del      sobre los ficheros REALES con un cambio quirúrgico, el veredicto GIRA
   censo
```

### 🔴 EL HUECO QUE SE CIERRA — el control positivo sobre la huella

La medición del 6-sep lo dejó escrito: *«en dev no hay ninguna factura sellada: 0 de 5 (...) la
parte del control positivo que mira la huella no se ha podido ejercer»*. Con `prisma` inyectado la
factura del escenario **sí está sellada**, y su `vfHash` no es una cadena inventada: sale de
`computeVeriFactuHash`, la misma función que lo escribe en producción. Se recomputa **antes y
después** del despliegue y da lo mismo.

Medido, en la misma pasada que ④:

| campo | antes | después |
|---|---|---|
| `number` | `2026-S762-001` | IGUAL ✅ |
| `total` | `121.00` | IGUAL ✅ |
| `vfHash` | 64 hex | IGUAL ✅ |
| huella RECOMPUTADA desde la fila | = `vfHash` | = `vfHash` ✅ |
| claves escritas en la fila | — | `{pdfUrl, qrData}` y nada más ✅ |
| **texto del documento** | sin marcador | **CAMBIADO** 🔴 |

**Queda separado lo que cambia (el ASPECTO) de lo que no (el CONTENIDO canónico)** — ahora también
en la parte fiscal, que era la que faltaba. Y ahí está la razón de que nadie se entere: el
verificador dice que todo cuadra, porque el sello no miente. El que cambia es el papel.

### La corrección al enunciado sigue en pie

**`contentHash` NO EXISTE en `Invoice`** (modelo leído entero, hoy). En la factura la integridad
canónica es `vfHash`. Un test escrito contra `contentHash` compararía `undefined` con `undefined`
y sería verde para siempre. El encargo del 7-sep vuelve a pedirlo por ese nombre; se mide lo que
hay.

---

## ② El generador, contra la historia de git — medido hoy, no heredado

```
src/modules/invoicing/infra/pdf/pdf.service.ts   39 commits totales (el primero, 19-nov-2025)
                                                 17 commits desde el 19-ago-2026
src/lib/invoicing.ts                             21 commits totales   ·   2 desde el 19-ago-2026
```

Mismos números que el 6-sep, re-derivados sobre `9c989bf0`. El último cambio del generador es del
**6-sep-2026** (`c45b89c6`, con qué nombre sale el cliente): diecisiete cambios en tres semanas, y
el más reciente fue ayer.

**No ha habido daño demostrado todavía. Eso es una VENTANA, no una ABSOLUCIÓN.** Las dos palabras,
separadas, porque significan cosas distintas: en desarrollo ninguna factura llega a regenerarse
(las cinco están `pendiente_de_sellado`), y eso es una casualidad del estado de sellado, no una
protección. En cuanto haya una factura sellada y un despliegue, la ventana se cierra sola.

---

## ③ El presupuesto — la respuesta, y el censo que la sostiene

**`ensureQuotePdf` NO EXISTE.** No hay «ensure» para el presupuesto: no hay `existsSync`, no hay
`needs`, no hay nada que reutilizar. Lo que hay son **cuatro bocas** que llaman al generador sin
condición ninguna, y el censo por AST (caso ⑧) las cuenta:

```
[existsSync]  src/lib/invoicing.ts:101                            generateInvoicePdf   <- la ÚNICA guardada
              src/lib/invoicing.ts:239                            generateInvoicePdf   (emisión)
              src/modules/system/app/routes/invoicesAdmin.routes.ts:1047  generateInvoicePdf   (regeneración PEDIDA a mano)
              src/modules/quotes/app/routes/quotes.routes.ts:235          generateQuotePdf
              src/modules/quotes/app/routes/quotes.routes.ts:553          generateQuotePdf
              src/modules/system/app/routes/quoteDecisionLanding.routes.ts:835  generateQuotePdf   <- PÚBLICA (/pay)
              src/modules/system/app/routes/quotesAdmin.routes.ts:541          generateQuotePdf
                                                                  ---- 7 bocas, 1 guardada ----
```

**Sí: el presupuesto también, y peor.** La factura al menos INTENTA reutilizar el fichero; el
presupuesto no lo intenta. Un presupuesto **ya firmado** cambia de aspecto en CADA apertura, no
sólo después de un despliegue — y una de las cuatro bocas es la landing PÚBLICA, o sea la que abre
el cliente. Está medido entero en `SCRUM-799.md`; lo que este apéndice añade es el **número** (4 de
4 sin guardar) y el trinquete que avisa si cambia.

---

## ④ Cuántas facturas emitidas hay en producción — **NO MEDIBLE desde sesión**

No hay credencial de producción en este árbol y no se ha pedido ninguna. Medido hoy sobre ESTE
worktree (`cobroflash-b3`), que es lo único que se ha mirado: su `.env` lleva `DATABASE_URL_DEV`,
`_STAGING` y `_TESTS`, **no lleva `DATABASE_URL` a secas** y **no existe `.env.local`**. Coincide
con el registro de SCRUM-418 (10-ago-2026), que midió los cuatro.

**Ese número es el que decide la URGENCIA de la salida ①, y hay que pedírselo al fundador.** Lo que
esta medición demuestra es la CORRECCIÓN del defecto, nunca su tamaño. Un número plausible
inventado aquí sería peor que este hueco.

---

## ⑤ El rojo, probado — y contado bien

Un guard que nunca se ha visto caer no es un suelo. Los dos mecanismos se rompieron a propósito:

| qué se rompió | cómo | resultado |
|---|---|---|
| el comportamiento | quitar `!fs.existsSync(diskPath)` del **compilado** (`dist/`, no versionado) | **4 de 9 en rojo**, incluido ④ |
| el censo por AST | copiar los ficheros REALES a un árbol de usar y tirar y hacerles UN cambio | el veredicto GIRA en los dos sentidos |

🔴 **Y el primer rojo salió ilegible, que es medio rojo.** Al no generarse documento, la medición
moría con un `ENOENT` crudo en mitad de la pasada: motivo correcto, mensaje inservible. Se arregló
el instrumento (`papel()` dice «no hay documento» en vez de reventar) y se volvió a romper: ahora
el rojo dice que la factura se ha quedado **sin** documento, que es justo la salida que el encargo
prohíbe (*«NO arreglas quitando el existsSync»*). El guard sabe distinguir las dos formas de
fallar.

`dist/lib/invoicing.js` quedó restaurado byte a byte y verificado (`Buffer.compare` = 0, y la
condición vuelve a estar presente). `git status` no vio nada de esto en ningún momento: `dist/`
está en `.gitignore`.

### 🔴 Y LA TANDA COMPLETA ME CAZÓ A MÍ — se corrigió mi código, no el guard

La primera versión del trinquete anclaba el censo por **número de línea**
(`…invoicing.ts:101 generateInvoicePdf`). Los 9 casos salían verdes en solitario, y la tanda
completa la tumbó: **SCRUM-710b · «los anclajes por NÚMERO DE LÍNEA no crecen»**, con el mensaje
exacto del defecto — *«un número de línea es una POSICIÓN: el día que alguien edite ese fichero por
encima, esto caduca y quien lo pague no sabrá por qué»*.

La corrección fue **retirar el anclaje**, no declarar una excepción: la identidad de una boca es
`fichero + generador + si guarda`, y lo que distingue «una boca MÁS» de «la misma, movida» es la
CUENTA (`x1`, `x2`). La línea se quedó sólo en el mensaje del rojo. Un guard nuevo que obliga a
aflojar otro guard no es un guard: es una excepción con otro nombre.

Vale la pena decirlo por lo que enseña del proceso: **en solitario salía verde**. El guard que
faltaba lo tenía la tanda, no yo.

---

## ⑥ Lo que este trinquete hará el día que se ejecute la salida ①

Se pondrá **ROJO**, a propósito, y su mensaje lo dice: *«si es porque el PDF ya se CONGELA al
emitir, esto no se ajusta: se re-mide y se reescribe `docs/master/SCRUM-762.md`»*. No se toca el
guard para que pase — se vuelve a medir. Y si el rojo viene de que alguien quitó el `existsSync` a
pelo, el caso ④ lo separa: dirá que la factura se ha quedado sin documento.

---

## SEPARADO: lo MEDIDO y lo SUPUESTO

**MEDIDO** (ejecutado en esta sesión, sobre `9c989bf0`): el `existsSync` sigue en su sitio ·
`Invoice` no tiene columna para el PDF · no hay almacenamiento persistente declarado · las dos
ramas previas están en `main` · el censo de 7 bocas, 1 guardada, 4 de presupuesto sin guardar ·
`ensureQuotePdf` no existe · 39/17 y 21/2 commits · los 9 casos en verde y 4 de ellos en rojo al
romper el mecanismo.

**SUPUESTO — dicho como suposición**: que en producción exista alguna factura SELLADA a la que
esto le pase de verdad. En desarrollo no la hay, y desde aquí no se puede mirar (⑤ del ticket
original, ④ de este apéndice). El defecto está demostrado sobre el mecanismo, no sobre una víctima
concreta.

**NO MEDIBLE desde sesión:** cuántas facturas emitidas hay en producción.

---

**La decisión sigue siendo del fundador.** La salida ① está firmada (7-sep-2026) y este apéndice no
la ejecuta: el volumen persistente lo monta el fundador y `prisma/schema.prisma` es suyo. Lo que
cambia hoy es que el defecto **ya no depende de que alguien se acuerde de medirlo**.
