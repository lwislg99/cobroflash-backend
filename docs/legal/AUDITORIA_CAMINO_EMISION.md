# Auditoría del camino de emisión — qué existe HOY de VeriFactu

**Medido:** 19-ago-2026 · **Contra:** `origin/main` = `8fe28531` · **Rama:** `scrum-525-auditoria-emision`
**Alcance:** solo lectura. No se modificó ni una línea de código. No se tocó producción, ni leyendo.
**Instrumentos:** búsqueda de texto (`grep`) y lectura del árbol sintáctico (AST con `typescript`).

> **Cómo leer esto.** Cada sección empieza con **la conclusión en una frase**. Debajo va el detalle
> con fichero y línea. Toda afirmación sin coordenada está marcada **NO MEDIDO**, con esas palabras.
> Si un documento del proyecto y el código discrepan, **gana el código**.

---

## Resumen para quien tenga que explicarlo en una reunión

**Hoy YaQu prepara la factura entera y la sella, pero no la manda a ningún sitio. No hay envío a la
Agencia Tributaria, y no lo ha habido nunca desde este código.**

Y la respuesta a la pregunta de los dos carriles es la tercera: **no existe ninguno de los dos.** El
código no distingue «remito en nombre de otro» de «remito en nombre propio», porque **no remite**.

Lo que sí existe, y es mucho, es toda la parte de **preparar y sellar**: la huella encadenada, el QR
de cotejo, y el XML del registro con el formato oficial. Ese XML **se descarga**, no se transmite.

---

## 1 · El camino de una factura, de punta a punta

**En una frase: de nueve eslabones, siete existen y funcionan; los dos últimos —la cola de remisión
y el envío— no se han construido nunca.**

| # | Eslabón | Estado | Fichero y línea |
|---|---|---|---|
| 1 | Puerta de emisión (el usuario pulsa emitir) | **EXISTE** | `src/modules/invoicing/app/routes/invoice.routes.ts:12` · `src/modules/system/app/routes/invoicesAdmin.routes.ts:81` |
| 2 | Decide qué documento sale (factura / justificante / ninguno) | **EXISTE** | `src/modules/invoicing/domain/facturaSuelta.ts` (`modoDocumentoSuelto`) |
| 3 | Numeración de serie | **EXISTE** | `src/modules/invoicing/domain/invoiceNumber.service.ts` |
| 4 | Huella SHA-256 y encadenado a la anterior | **EXISTE** | `prisma/schema.prisma:102-103` (`vf_hash`, `vf_prev_hash`) |
| 5 | Sellado en el momento de emitir | **EXISTE** | `src/modules/invoicing/domain/selladoEstado.ts:116` (`sellarTrasEmision`), invocado desde `src/lib/invoicing.ts:17` |
| 6 | QR de cotejo para el cliente | **EXISTE** | `src/modules/invoicing/domain/verifactu.service.ts:152` |
| 7 | XML del registro, con el sobre oficial | **EXISTE — pero su destino es una DESCARGA** | `src/modules/fiscal/verifactu/registro.builder.ts:558` (`construirSobreRegFactu`) → `src/modules/invoicing/domain/verifactu.service.ts:535` (`buildVerifactuRegistrosXml`) → consumido en `src/modules/exports/app/routes/exports.routes.ts:252` y `:556` |
| 8 | Cola de remisión (`VfSubmission`) | **NO EXISTE** | ningún modelo del esquema; ver medición abajo |
| 9 | Envío telemático a la AEAT | **NO EXISTE** | ninguna llamada de red; ver medición abajo |

**Los tres números cuadran:** EXISTE 7 + EXISTE PERO APAGADO 0 + NO EXISTE 2 = **9 eslabones**.

> 🔴 **Que la columna «APAGADO» esté a cero es el hallazgo, no un detalle.** No hay un interruptor
> esperando a que alguien lo encienda: los dos últimos eslabones **no están escritos**. Es una
> diferencia enorme para planificar — «encender algo» son horas; «construirlo» es otra cosa.

### ¿Dónde se para hoy el camino?

**Se para justo después de sellar.** Se genera el registro, se sella la huella, se encadena y se
pinta el QR. **No se encola y no se envía.**

### ¿Se ha enviado alguna vez algo a la AEAT desde este código?

**No.** Y no es una impresión: es lo que dieron los dos instrumentos.

* **Instrumento de texto.** Buscando `aeat.es`, `agenciatributaria`, `SistemaFacturacion` y
  similares en `src/`, los únicos aciertos son: dos **espacios de nombres XSD**
  (`registro.builder.ts:10-11`), la **URL del QR que escanea el cliente**
  (`verifactu.service.ts:152`) y **enlaces a la especificación dentro de comentarios**
  (`verifactu.service.ts:8`). Ninguno es un destino de envío.
* **Instrumento AST.** Contando llamadas de red en `src/modules/fiscal/` y `src/modules/invoicing/`:
  18 aciertos, y al mirarlos uno a uno **ninguno sale a la AEAT** — son definiciones de rutas de
  Express (`router.get` / `router.post`), lecturas de `Map` (`.get`) y una sola llamada real,
  `src/modules/invoicing/infra/pdf/pdf.service.ts:24`, que es un `axios.get` **para descargar el
  logo del profesional** y ponerlo en el PDF.
* **Control positivo del detector:** el mismo instrumento encuentra **16** llamadas de red en
  `src/integrations/` (por ejemplo `enviarCorreo.ts:112`, `gemini.ts:43`, `mercadopago.ts:51`). Si
  hubiera dado cero ahí, el detector estaría roto y su «cero» en la zona fiscal no valdría nada.
* **Suelo de ceguera, y saltó de verdad.** En su primera ejecución el instrumento no supo localizar
  la zona fiscal y **abortó diciendo `CIEGO: zona fiscal = 0`** en vez de informar «0 llamadas de
  red». Se corrigió el emparejado de rutas y se repitió. Queda escrito porque es la diferencia
  entre «medido que no hay» y «no supe mirar», y aquí esa diferencia es un incumplimiento
  tributario de un tercero.

---

## 2 · Los dos carriles de representación

**En una frase: no existe ninguno de los dos. El código no distingue en nombre de quién se remite,
porque no remite.**

**La respuesta es la (c).** Y con las palabras que pedía el encargo: **no existe**.

| Carril | ¿Existe código? |
|---|---|
| Colaborador social (YaQu remite con su certificado por apoderamiento) | **no existe** |
| Merchant (cada profesional aporta su certificado) | **no existe** |

**Cómo se midió.** Búsqueda en `src/` de `certificad`, `.p12`, `.pfx`, `pkcs12`, `mtls`,
`clientCertificate`, `apoderamiento`, `colaborador social`, `representante`. Los aciertos son
**todos ajenos** a la remisión:

* `src/modules/exports/app/routes/exports.routes.ts:524` — un **comentario** que dice que el envío
  telemático requiere certificado y está pendiente.
* `src/modules/invoicing/domain/verifactu.service.ts:527` — otro **comentario** con el mismo aviso.
* `src/modules/jobs/domain/albaranFirmante.ts:53-63` — «representante» referido a **quién firma un
  albarán en obra**, no a representación ante la AEAT.
* `src/modules/jobs/infra/albaranPdf.service.ts:72-73` y `albaran.service.ts:843` — «certificado de
  evidencias» de una **firma en obra**, nada que ver con un certificado digital de la FNMT.

**No hay lectura de ningún fichero de certificado, ni configuración de mTLS, ni ningún campo que
distinga «en nombre propio» de «en nombre de otro».**

> ✅ **La hipótesis del fundador era correcta.** Se midió para desmentirla y no se pudo: el carril
> colaborador **no está construido**. Lo que sí existe es lo de la sección 3.

---

## 3 · Los semáforos: son tres y ninguno mira antes de enviar

**En una frase: los tres «semáforos» son cosas distintas, ninguno comprueba nada antes de enviar, y
dos de los tres son documentación, no código.**

| Semáforo | Qué mide | ¿Vivo o documentación? | ¿Antes o después de enviar? |
|---|---|---|---|
| `docs/legal/SEMAFORO_CALIBRACION.md` | Gravedad de cada **código de error de la AEAT** (rojo/ámbar/verde) | **Documentación.** Su propia cabecera dice «RECON fiscal. **Cero código**» (`SEMAFORO_CALIBRACION.md:3`) | **DESPUÉS** — clasifica lo que la AEAT respondería |
| `docs/legal/SEMAFORO_MAPA_EMISION.md` | Mapa del camino de emisión | **Documentación**, y con coordenadas desfasadas (SCRUM-513) | Ninguno: es un mapa |
| `public/dashboard/js/semaforoFiscal.js` | Avisos fiscales en pantalla | **Código vivo y cargado** (`public/dashboard/index.html:230`), pero su texto sale con marcador `PENDIENTE_ASESOR` (`semaforoFiscal.js:37`) | **Ninguno de los dos** — no mira envíos |

> 🔴 **Aquí está deshecha la confusión del encargo.** El semáforo que se recordaba «del carril
> colaborador» existe —es `SEMAFORO_CALIBRACION.md`— pero **es un semáforo de conformidad del
> registro, no de representación**, y además **es un documento, no código**: lo dice su propia
> cabecera. Clasifica qué gravedad tendría cada error que devolviera la AEAT; es decir, sirve para
> **interpretar una respuesta que hoy no se puede recibir, porque no se envía nada**.

---

## 4 · Las comprobaciones previas al envío

**En una frase: lo que valida la FORMA del registro está construido; lo que gobierna el ENVÍO no
existe, porque no hay envío.**

| Comprobación | Estado | Fichero y línea |
|---|---|---|
| Validación contra los XSD oficiales | **CONSTRUIDA** | `tests/scrum240-sobre-unico.test.mjs` (citado en `verifactu.service.ts:919`); espacios de nombres en `registro.builder.ts:10-11` |
| Huella encadenada (cada factura apunta a la anterior) | **CONSTRUIDA** | `prisma/schema.prisma:102-103`; sellado en `selladoEstado.ts:116` |
| Estado de sellado explícito (`pendiente_de_sellado` / `sellado`) | **CONSTRUIDA** | `prisma/schema.prisma:98-99` |
| Campos obligatorios del registro | **CONSTRUIDA** | `registro.builder.ts:536` (generador único del contenido) |
| Puerta que impide producir documento sin huella | **CONSTRUIDA** | `src/lib/invoicing.ts:97` y `:228` (`exigirDocumentoEmitible`) |
| `Subsanacion` / `RechazoPrevio` / `SinRegistroPrevio` | **NO MEDIDO** | no se buscaron una a una en esta tanda |
| Cola `VfSubmission` | **INEXISTENTE** | el esquema tiene **25 modelos** (`prisma/schema.prisma`) y **ninguno** se llama `Vf*`, `*Submission` ni `*Verifactu`. Ningún fichero de `src/` menciona `vfSubmission` |
| Control de flujo de envío (reintentos, ritmo) | **INEXISTENTE** | no hay envío que gobernar |

---

## 5 · Las banderas, y su valor real

**En una frase: las dos banderas fiscales están en `false` por decisión escrita en el código, y ese
`false` es una decisión, no un hueco.**

| Bandera | Dónde se declara | Valor por defecto | ¿Decisión o hueco? |
|---|---|---|---|
| `INVOICING_ES_ENABLED` | `src/core/flags.ts:16` | `false` | **DECISIÓN.** El propio fichero escribe el motivo al lado: «OFF hasta SIF-1 v2 8/8» |
| `SIF_ENABLED` | `src/core/flags.ts:17` | `false` | **DECISIÓN.** Con su motivo: «OFF hasta pruebas AEAT (S1-D)» |

**Cómo se resuelve el valor** (`src/core/flags.ts`, función `isFlagEnabled`): primero el país —las
dos son solo para España—, luego un posible override por merchant, luego la variable de entorno, y
si no hay nada, el valor por defecto de arriba.

> ⚠️ **«Ausente» y «false» aquí no se confunden, y conviene decirlo bien.** El `false` de
> `flags.ts:16-17` está **escrito y razonado en el código**: es una decisión. Lo que queda
> **NO MEDIDO** es si esas variables están además presentes o ausentes en el entorno de producción
> — **este ticket no toca producción, ni leyendo**. El efecto práctico hoy es el mismo (apagadas),
> pero la fuente de esa decisión sí está medida: es el código.

**Qué hace `SIF_ENABLED` hoy:** se **consulta y se guarda**, no decide un envío. En
`src/modules/invoicing/domain/invoiceNumber.service.ts:310` se lee junto a `INVOICING_ES_ENABLED`
para **congelar el modo fiscal del momento en el registro de auditoría**. No hay ninguna rama del
código que, al ponerla en `true`, empiece a transmitir: **ese código no existe**.

---

## 6 · Lo que falta para poder enviar de verdad

**En una frase: falta una decisión que no es técnica, y falta construir los dos últimos eslabones.**

### Decisiones (no las toma quien programa)

1. **Elegir el carril de representación.** Está planteada como pregunta abierta en
   `docs/legal/PREGUNTAS_ASESOR.md` punto 1, y ese documento dice literalmente que **sin esa
   respuesta no se construye S1-D** (la remisión telemática). **Decisión del fundador con su
   asesor.** Hoy está aplazada.
2. **Aprobar el microcopy fiscal que ya está marcado.** `semaforoFiscal.js:37` sale con
   `PENDIENTE_ASESOR`. **Decisión del asesor.**
3. **Decidir cuándo se encienden las dos banderas**, hoy apagadas por decisión escrita
   (`flags.ts:16-17`). **Decisión del fundador.**

### Construcción (después de la decisión 1, y solo entonces)

4. **La cola de remisión** (`VfSubmission` o equivalente): tabla, estados y reintentos. Hoy
   **inexistente**.
5. **El cliente de envío a la AEAT**, con el certificado del carril que se elija y su mTLS. Hoy
   **inexistente**.
6. **La lectura de la respuesta de la AEAT**, aplicando la clasificación que ya está calibrada en
   `SEMAFORO_CALIBRACION.md` — que hoy no puede usarse porque no llega ninguna respuesta.
7. **Las banderas `Subsanacion` / `RechazoPrevio` / `SinRegistroPrevio`** — **NO MEDIDO** si alguna
   parte existe ya; hay que medirlo antes de estimar.
8. **Que el profesional vea en qué modo está.** El máster (parte A8) describe los dos modos —«se
   guarda» y «se envía»— y dice que falta esa visibilidad.

---

## Discrepancias entre documentación y código

Se anotan porque el encargo lo pide, **y no se arreglan aquí** (SCRUM-513 tiene ticket propio):

* `docs/legal/SEMAFORO_MAPA_EMISION.md` tiene **coordenadas desfasadas**. Constatado, no corregido.
* `src/modules/invoicing/domain/verifactu.service.ts:673` tiene, según el encargo, un comentario que
  **miente sobre las rectificativas**. **NO MEDIDO en esta tanda**: no se verificó línea a línea.
* `src/modules/invoicing/domain/modoVisible.ts:21` afirma en un comentario que «**se envía** NO
  EXISTE. Cero clientes SOAP/mTLS». **Esta auditoría lo confirma por su cuenta**, con los dos
  instrumentos y el control positivo — no por creerse el comentario.

## Qué queda NO MEDIDO

1. El valor de las banderas **en el entorno de producción** (no se toca producción).
2. Las banderas `Subsanacion` / `RechazoPrevio` / `SinRegistroPrevio`.
3. El comentario de `verifactu.service.ts:673` sobre rectificativas.
