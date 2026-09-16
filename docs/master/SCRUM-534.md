# SCRUM-534 · CENSO-AFIRMACIONES: las 19 falsas, verificadas hoy y clasificadas para decidir

**Fecha:** 16-sep-2026 · **Carril:** documentación / fiscal · **Gate:** sin gate — **no se corrige nada**
**Medido contra:** `origin/main` = `68aeb3920966a92ffb23c48802aa8f1fb26e2d4d` · 2026-09-16T10:17:30+01:00

> ⛔ **ESTA ENTRADA NO CORRIGE NI UNA PALABRA.** Regla 30: todo lo que hay aquí es texto que lee un
> cliente o un tercero, y lo escribe el fundador. Esta sesión lo encuentra, lo verifica y lo
> clasifica.

## 🔴 Lo primero: el recuento del ticket no cuadra, y ése es el primer dato

| | el ticket dice | medido hoy |
| --- | --- | --- |
| guion H2 | 1 (con «dos mitades falsas») | **1**, vivo en `YAQU_MASTER.md:214` |
| en documentos a terceros | «**8** afirmaciones» | 🔴 **9** — `PACK_GESTORIA` 5 + `DECLARACION_RESPONSABLE` 4 |
| clase A total | 19 | **19, las 19 VIVAS hoy** |

**Ninguna se ha resuelto sola en los dos meses transcurridos.** Se verificaron una a una contra el
árbol de hoy: las 19 siguen ahí, con las líneas movidas (el máster ha crecido ~14 líneas, así que
las coordenadas del inventario del 19-ago ya no valen — las de aquí sí).

## La lista, clasificada — que es la columna que el fundador pidió

**Criterio del fundador:** si es landing, espera; si es de yaqu.app o sale por la puerta a un
tercero, entra.

### 🔴 ENTRA — PRODUCTO / DOCUMENTO A TERCEROS (10)

| id | fichero:línea | texto literal (fragmento) |
| --- | --- | --- |
| **A1** | `docs/YAQU_MASTER.md:214` | *«la facturación VeriFactu **está construida** y en certificación… Por ley no puedo **activarla** hasta cerrarla»* |
| **A11** | `docs/legal/PACK_GESTORIA.md:13` | *«emite cada factura con una huella digital encadenada y la **remite automáticamente a la AEAT** en el momento»* |
| **A12** | `docs/legal/PACK_GESTORIA.md:19` | *«Cada registro de facturación… **se envía a la AEAT en tiempo real** a través de su servicio web»* |
| **A13** | `docs/legal/PACK_GESTORIA.md:21` | *«la huella SHA-256 encadenada + **la remisión autenticada** cumplen el requisito (RRSIF)»* |
| **A14** | `docs/legal/PACK_GESTORIA.md:39` | *«Al cobrar, YaQu emite la factura, calcula su huella y **la remite a la AEAT**»* |
| **A15** | `docs/legal/PACK_GESTORIA.md:64` | *«es el sistema de **facturación** que **genera y remite** los registros»* |
| **A16** | `docs/legal/DECLARACION_RESPONSABLE.md:12` | *«…el bloque SistemaInformatico que **YaQu remite en cada registro de facturación**»* |
| **A17** | `docs/legal/DECLARACION_RESPONSABLE.md:39` | *«**Tipología:** sistema… en modalidad **VERI\*FACTU** (**remisión de los registros de facturación a la AEAT**)»* |
| **A18** | `docs/legal/DECLARACION_RESPONSABLE.md:49` | *«…y **remisión telemática al servicio web de la AEAT**»* |
| **A19** | `docs/legal/DECLARACION_RESPONSABLE.md:52` | *«**Remisión inmediata a la AEAT** (modalidad VERI\*FACTU), **con control de flujo**»* |

🔴 **A1 es la de más impacto y no admite espera:** la **regla 26** la declara *la única respuesta
autorizada* ante un cliente. El mecanismo que existe para que nadie improvise está distribuyendo la
frase equivocada.

🔴 **A16–A19 están en un documento que se FIRMA** (art. 13 RRSIF + art. 15 Orden HAC/1177/2024). Una
declaración responsable que afirma capacidades que el sistema no tiene no es un error de redacción.

### ⚪ INTERNO — no sale por la puerta (9)

`A2` `YAQU_MASTER.md:401` (la FSM de `VfSubmission`, Parte L «FUENTE DE VERDAD») · `A3` `:448` (runbook
R7) · `A4` `:463` (fila `SIF_ENABLED` de la Parte P) · `A5` `:720` · `A6` `:969` · `A7` `:1559` ·
`A8` y `A9` `docs/legal/SEMAFORO_CALIBRACION.md:262` · `A10` `:419`.

⚠️ **A2 no es «una más»:** de ella beben A3, A4 y el runbook. Corregirla sin corregir las que la
citan las deja huérfanas apuntando a algo que ya no dice eso.

### ✅ LANDING — CERO, y está medido

**No hay ninguna.** Barridas las **108** superficies publicadas de `public/`: 38 menciones de
VeriFactu/AEAT, todas en el dashboard, y **ni una afirma la remisión**. El único acierto del filtro
es un **comentario que dice lo contrario** —`settingsView.js:190`: *«diría al profesional que puede
elegir remitir a la AEAT, y no puede»*—, o sea código escrito para **evitar** el error.

## 🔴 Por qué son falsas — la contraprueba, medida hoy

No basta «es falsa». Esto es contra qué lo es:

**① `VfSubmission` no existe** (contraprueba de A2, A3, A4)

```
modelos en prisma/schema.prisma                      : 30
modelos Vf* / *Submission / *Verifactu               : 0  — NINGUNO
control positivo · modelos con "Invoice" que SÍ están: Invoice, InvoiceAssignee
```

El control positivo importa: el lector **sí** ve modelos, así que ese 0 no es ceguera.

**② Cero llamadas de red a la AEAT en `src/`** (contraprueba de A11–A19)

```
ficheros .ts en src/                        : 282
mencionan la AEAT                           : 31
mención de AEAT + patrón de red             : 3  → los TRES son falsos positivos
control positivo · ficheros con red (a cualquier sitio): 23
```

Los tres, mirados uno a uno:

* `registro.builder.ts` — «SOAP» aparece en **comentarios**; `construirCuerpoSoapRegFactu`
  **construye** el cuerpo XML y el propio fichero dice que *«el envío SOAP de S1-D irá por aquí»*,
  en futuro.
* `pdf.service.ts` — `axios.get(logoUrl)`: descarga un logo.
* `modoVisible.ts:21` — 🔴 **lleva escrita la contraprueba**: *«"se envía" NO EXISTE. Cero clientes
  SOAP/mTLS contra…»*.

**③ `SIF_ENABLED` se lee y se guarda; no enciende nada** (contraprueba de A4, A5)

Los **11** usos en `src/`: su declaración en `flags.ts`, y el resto **escribiéndola en la auditoría**
(`invoiceNumber.service.ts:456`, `audit.service.ts:211-254`, `flagFiscal.service.ts`). **Ninguna rama
que al ponerla en verdadero empiece a transmitir.**

## ⚠️ Un defecto de MI instrumento, dicho porque casi cambia el resultado

La primera pasada dio **A11 como «ya no está»** — habría entregado una afirmación viva en el
documento de la gestoría como resuelta. No estaba resuelta: el markdown **envuelve**, y la frase
vive partida entre las líneas 13 y 14, con un `**` en medio. Mi buscador miraba **línea a línea**.

Afecta a **todas** las entradas que el inventario anota con rango (`13-14`, `18-19`, `39-40`,
`48-49`, `262-263`). Corregido: se normaliza el fichero entero (saltos y `**` a espacio) y se busca
sobre el texto continuo, recuperando la línea después.

> Es la misma familia que el aviso del encargo sobre `[oó]`: **en un repo en español, buscar por la
> forma que uno imagina devuelve ceros donde hay cosas.**

## Verificación

* ✅ **CONTROL POSITIVO** — el buscador encuentra el guion H2 y las frases que el ticket ya nombra
  (`está construida`, `no puedo activarla`, `VfSubmission`, `la cola remite al reanudar`,
  `VERIFACTU_EVIDENCIAS`): **15 coincidencias** en la primera pasada. Si no las viera, no vería nada.
* 🔴 **SUELO** — un cero habría sido instrumento roto: el ticket nombra el guion H2. No hubo cero.
* **Dos instrumentos** — búsqueda por línea y búsqueda sobre texto normalizado. **Discreparon en
  A11**, y la discrepancia fue el dato.
* **Todo con node**, no con `grep`: el de Git Bash normaliza CRLF al leer y las clases con acento
  devuelven ceros falsos.

## Lo que NO cubre

* **Las clases B (1), C (16) y D (25)** del inventario no se han re-verificado: este ticket es la
  clase A. La C sigue pendiente y cada una es una lectura falsa esperando.
* **`docs/VERIFACTU_EVIDENCIAS.md` sigue sin existir** y lo citan el máster (`:448`, `:1042`), el
  runbook y dos skills. Estaba en el comentario del ticket; se confirma hoy.
* **No se ha corregido nada.** Ni una palabra, ni de las 19 ni del inventario.

---

## Observación de la sesión (fuera del encargo)

⚠️ Va aparte y marcada, como pide el encargo: no es parte de la lista de afirmaciones falsas.

La atenuante de **BORRADOR** que llevan `PACK_GESTORIA.md` y `DECLARACION_RESPONSABLE.md` tiene una
consecuencia que conviene tener delante al decidir el orden: **quien los revise el día de su
publicación leerá afirmaciones ya escritas, no las escribirá de nuevo.** Un texto heredado se
revisa con menos desconfianza que uno en blanco — que es justo lo contrario de lo que hace falta en
un documento con régimen jurídico propio.
