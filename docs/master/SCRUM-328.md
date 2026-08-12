# SCRUM-328 · F1 — La decisión de posicionamiento, escrita (decisión + enmienda redactada, cero construcción)

**Fecha:** 10-ago-2026 · **Carril:** F (posicionamiento / landing) · **Gate:** sin gate — esta tarea **solo escribe documentos**

**Medido contra:** `origin/main` = `036241eb385835005de227631f973d49c17cc8be` · 2026-08-10T14:33:39+02:00

> **No se ha construido nada, y no se ha escrito copy de landing.** Ni una palabra de
> `public/index.html`, ni de las otras tres páginas públicas, ni del guion H2, ni de las banderas.
> **Y no se enmienda el máster**: la enmienda va **redactada y sin aplicar** en el **§6** de este
> mismo documento, porque el máster es del fundador y lo cambia él.

---

## 1 · LA DECISIÓN

**Decidida por el fundador el 7-ago-2026. Escrita aquí el 10-ago-2026.**

> **Opción 2 — «futuro honesto».** La landing **puede nombrar VeriFactu como obligación futura del
> LECTOR, con su fecha**. **No puede decir nada sobre el estado de YaQu ante esa norma.**

Las dos fechas, verificadas contra el Apéndice A del máster (marcado ✅ con fuente:
**RD-ley 15/2025**, BOE 3-dic-2025):

| Obligado | Fecha |
| --- | --- |
| **Sociedades** | **1 de enero de 2027** |
| **Autónomos** | **1 de julio de 2027** |

Y la fecha **no es el titular** (regla 26b): el gancho comercial nº1 sigue siendo la
**morosidad / el cobro**; VeriFactu es pilar de confianza nº2.

---

## 2 · EL MOTIVO — tres cosas medidas que descartaron la Opción 1

La Opción 1 era el **presente honesto**: contar lo que YaQu ya hace hoy con VeriFactu. El copy que
se aprobó el 7-ago-2026 iba por ahí y decía **«tus facturas ya se emiten con la huella
encadenada»**. **Está RETIRADO**, y estas son las tres medidas por las que no podía sostenerse.

### ① Ese copy es FALSO para todos los usuarios reales — [MEDIDO]

La condición para entrar en la cadena de huellas es **una sola línea**, en
`src/modules/invoicing/domain/portonDocumento.ts:84`:

```ts
return merchant?.country === 'ES' && !!merchant?.taxId && !isReceiptNumber(numero);
```

Cruzada con el modo de documento (`src/modules/invoicing/domain/emission.service.ts:36-41`) y con
la bandera `INVOICING_ES_ENABLED`, que está en **`false`** por defecto (`src/core/flags.ts:16`):

| Quién | Documento que recibe | ¿Entra en la cadena? | Por qué |
| --- | --- | --- | --- |
| **Merchant español REAL** (bandera OFF) | justificante **`J-…`** (`RECEIPT_NUMBER_PREFIX = 'J-'`, `invoiceNumber.service.ts:43`) | **NO** | `isReceiptNumber(numero)` lo excluye |
| **Merchant demo** (`id=1`) | factura con marca de agua «DEMO — no válida fiscalmente» | **SÍ** | es el único caso vivo |
| **Merchant NO español** | factura **real** | **NO** | la condición exige `country === 'ES'` |
| Merchant español con la bandera ON individualmente | factura real | SÍ | **hoy no existe ninguno** |

**O sea:** el español real recibe un `J-` y queda fuera; el no español recibe factura de verdad y
**también** queda fuera. **El único que entra en la cadena es el merchant demo**, cuyas facturas
llevan escrito que no valen fiscalmente. Decirle a un visitante «tus facturas ya se emiten con la
huella encadenada» le describe una situación que **ningún usuario real tiene**.

### ② El plazo del FABRICANTE ya venció, y el RDL 15/2025 no lo movió — [VERIFICADO EN FUENTE DEL MÁSTER]

Apéndice A del máster, marcado ✅: *«Productor: solo software adaptado desde **29-jul-2025** (fecha
mantenida por RDL 15/2025)»* — fuente AEAT FAQ + Orden HAC/1177/2024. Y el art. 201 bis LGT
sanciona *fabricar o comercializar* sistemas no conformes con hasta **150.000 €/ejercicio y tipo de
software**, más 1.000 €/sistema sin declaración responsable.

Es decir: **lo que el RDL 15/2025 aplazó a 2027 es la obligación del CONTRIBUYENTE, no la del
productor.** La Opción 2 se apoya solo en la primera; la Opción 1 hablaba justo de la segunda, que
es la que está vencida.

> ⚠️ **Límite de esta verificación, dicho sin adornos:** el articulado **no está en el repositorio**.
> `docs/legal/fuentes/` contiene **un solo fichero** (`aeat-errores.properties`); no hay copia del
> RD 1007/2023, ni de la Orden HAC/1177/2024, ni del RDL 15/2025 (medido en P14, apartado E). Las
> dos fechas están verificadas **contra el Apéndice A del máster**, que las lleva con fuente; no
> contra el BOE, que aquí no está.

### ③ «Se envía» a la AEAT NO EXISTE — [MEDIDO]

* **`VfSubmission` no está en `prisma/schema.prisma`**: cero apariciones. La única mención en todo
  `src/` es **el comentario que lo dice** (`src/modules/invoicing/domain/modoVisible.ts:22`).
* **El sobre SOAP se construye y no lo manda nadie.** `construirCuerpoSoapRegFactu`
  (`src/modules/fiscal/verifactu/registro.builder.ts:597`) **no tiene ni un llamador en `src/`**:
  sus únicos usos están en `tests/registroBuilder.test.mjs` y `tests/scrum240-sobre-unico.test.mjs`.
* La bandera `SIF_ENABLED` está en **`false`** (`src/core/flags.ts:17`).

`applyVeriFactu` **sella en local** y ya está. Cualquier frase que diga o insinúe que YaQu *remite*
algo a la AEAT describe un mecanismo que no existe.

### ④ Y el precedente que ya costó una retirada

SCRUM-400 (7-ago-2026) retiró de la landing la insignia «Facturación VeriFactu en certificación» y
la FAQ entera que se autodenominaba fabricante, **porque invocaban un documento no emitido**:
`docs/legal/DECLARACION_RESPONSABLE.md` sigue siendo una plantilla con **25 placeholders** sin
rellenar. Verificado hoy contra `origin/main`:

```
[documento] docs/legal/DECLARACION_RESPONSABLE.md: NO EMITIDO — quedan 25 placeholder(s) …
✅ public/index.html · precios · terminos · privacidad: sin afirmaciones de conformidad
```

Y las cuatro páginas públicas tienen **cero apariciones de «VeriFactu»**. Ese es el punto de
partida sobre el que decide la Opción 2: **hoy la landing no dice nada**, así que la excepción no
corrige un texto — **abre una puerta que hoy está cerrada del todo**.

---

## 3 · LO QUE ESTA DECISIÓN **NO** DECIDE

Se escribe aparte y con este título a propósito, para que nadie la estire.

1. **No aprueba ni una sola frase.** La microcopy de landing es del fundador (regla 30) y lo de
   VeriFactu, además, es regla 26. Esta decisión dice **qué clase de frase cabe**, no cuál se
   publica. Ver §5.
2. **No enmienda el máster.** La enmienda está **redactada y sin aplicar** (§6). En disco, A4.1,
   AB5 y el guion H2 siguen **intactos**.
3. **No responde P14 — y P14 puede invalidarla.** La pregunta de si YaQu, hoy, «fabrica o
   comercializa» un sistema informático de facturación a efectos del art. 201 bis LGT está abierta
   (ver §4). Su matiz 1 es literalmente *«¿"comercializar" exige que el módulo esté operativo para el
   cliente, o basta con ofrecerlo o anunciarlo aunque esté apagado por bandera?»*. **Si la respuesta
   del asesor es «basta con anunciarlo», esta excepción hay que estrecharla o cerrarla.** Se decide
   con esa condición encima de la mesa, no ignorándola.
4. **No enciende nada.** `INVOICING_ES_ENABLED` y `SIF_ENABLED` siguen en `false`. Regla 24 intacta.
5. **No decide qué pasa con «factura» como funcionalidad.** Las 6 menciones de `public/index.html`
   y las de `public/terminos.html` (`:50` «emitir facturas», `:81` «Facturación y cumplimiento
   fiscal») están censadas en SCRUM-400 y **su suerte es del fundador**. Aquí no se toca ninguna.
6. **No reordena la cola** (regla 31) ni decide el contenido de F4, F5 y F7.
7. **No resuelve que el resultado no se pueda medir.** SCRUM-327 midió que **no hay instrumento**:
   cero analítica en `public/`, cero modelo de visitas en el schema. Rehacer secciones de landing
   **no se puede evaluar después**. Esta decisión no cambia eso.

---

## 4 · LA PREGUNTA AL ASESOR — **YA EXISTÍA. No se duplica: se enlaza**

**Comprobado antes de escribir nada.** La pregunta del **art. 201 bis** y del **plazo del
fabricante** está en `docs/legal/PREGUNTAS_ASESOR.md` como **P14**, escrita el **7-ago-2026**, y ya
está marcada como prioritaria en su propio título:

> `# 🔴🔴 P14 · PRIORITARIA — ¿YaQu, HOY, «fabrica o comercializa» un sistema informático de facturación?`

Cubre exactamente lo que pedía esta tarea, y con más detalle del que se habría escrito de cero:
el **RDL 15/2025** y las dos fechas de contribuyente, el **plazo del productor del 29-jul-2025 no
modificado**, el **art. 201 bis** con sus importes, y cinco apartados de hechos medidos (A–E).
**Duplicarla habría creado dos versiones de la misma pregunta**, que es como se llega a que el
asesor conteste a la que ya no vale.

**Único cambio hecho en ese fichero:** un **puntero de una línea al principio del documento**, para
que la prioridad sea operativa. P14 dice de sí misma *«va al final por orden de llegada, pero se lee
la primera»* y **nada en la cabecera lo decía**: son 500 líneas y la que urge estaba en la última.
No se ha tocado ni una palabra del contenido de P14 ni de ninguna otra pregunta.

---

## 5 · FRASES CANDIDATAS — **no he escrito ninguna, y hay un motivo mejor: ya existen dos en el máster**

No se inventa copy. Lo que sí se puede hacer sin inventar nada es **decir qué frases del máster son
de la clase que la Opción 2 necesita**, y qué le pasa a cada una contra el mecanismo. Son dos, las
dos ya aprobadas, y **ninguna de las dos es publicable hoy tal cual**:

| # | Frase (literal del máster) | Dónde | Estado contra el mecanismo |
| --- | --- | --- | --- |
| **C1** | «Y cuando llegue **lo de Hacienda en 2027**, ya estás dentro.» | **H6**, objeción *«mi gestor me lleva todo»* | 🟡 la **fecha** es verdad (Apéndice A ✅). **«Ya estás dentro» no lo es todavía**: promete un estado futuro que hoy no está construido (SIF-1 abierto, `SIF_ENABLED=false`, la declaración responsable sin emitir). Es una promesa, no un hecho. |
| **C2** | «(post-SIF) Y cuando llegue **VeriFactu**, ya estás dentro.» | **H7** | 🔴 **el propio máster la marca `post-SIF`**. Hoy está fuera por su propia etiqueta. |
| **C3** | «¿Te aviso cuando **lo de Hacienda sea obligatorio**? Quédate el vídeo.» | **H6**, objeción *«ahora no»* | 🟢 **no afirma nada sobre YaQu**: habla solo de la obligación del lector. Es la única de las tres que sobrevive intacta a las tres medidas del §2. |

**Las tres son guiones HABLADOS** (H5/H6 son argumentario de llamada y objeciones), **no microcopy
de landing** (N5/A22). Pasarlas a la web es un cambio de superficie que decide el fundador.

### Las tres, pasadas por el guard de SCRUM-400 — **ejecutado, no razonado**

Se han metido en `afirmacionesDeConformidad()` (`scripts/_guard-conformidad-landing.mjs`) **con
controles a los dos lados**, para que el verde signifique algo:

| Frase | Guard |
| --- | --- |
| **C1** «…cuando llegue lo de Hacienda en 2027, ya estás dentro» | ✅ pasa |
| **C2** «…cuando llegue VeriFactu, ya estás dentro» | ✅ pasa |
| **C3** «¿Te aviso cuando lo de Hacienda sea obligatorio?» | ✅ pasa |
| 🔴 **CONTROL POSITIVO** — el texto que SCRUM-400 retiró | **CAE** · *afirma un estado de conformidad fiscal* |
| **CONTROL** — la fecha desnuda: «VeriFactu será obligatorio para autónomos el 1 de julio de 2027» | ✅ pasa |
| 🔴 **CONTROL** — la variante que la excepción prohíbe en (b): «Cuando VeriFactu sea obligatorio en 2027, **con YaQu ya cumples**» | **CAE** · *afirma un estado de conformidad fiscal* |

El control positivo cae, así que el verde de las otras no es «no supe mirar». Y la última fila es la
más útil de todas: **la frase que la excepción prohíbe en su punto (b) la caza el guard sola**,
porque junta «cumples» con «VeriFactu» en la misma frase.

> ⚠️ **Y el verde NO es una aprobación de copy.** El guard vigila **la conformidad afirmada sin
> documento detrás**, no la verdad de una promesa a futuro. **C1 y C2 pasan el guard y aun así
> prometen un estado que hoy no existe** — por eso la excepción las prohíbe explícitamente en su
> punto (b) aunque el guard las deje pasar. Un guard verde no sustituye a la regla 30.

> **Conclusión honesta:** la Opción 2 **no tiene hoy ninguna frase del máster que se pueda publicar
> tal cual**. La que es verdad (C3) no menciona la fecha; las que mencionan el futuro (C1, C2)
> prometen un estado de YaQu. **Escribir la frase que falta es del fundador** (reglas 26 y 30) y no
> se hace aquí.

---

## 6 · 🔴 LA ENMIENDA A A4.1 — **REDACTADA, NO APLICADA**

> **ESTA SECCIÓN NO ES EL MÁSTER Y NO CAMBIA NADA.** Es una **propuesta de texto** para que el
> fundador la aplique, la corrija o la tire. **En disco, A4.1 y AB5 siguen exactamente como
> estaban** — comprobado contra `origin/main` = `036241eb` al escribir esto.

### 6.1 · Antes del texto: la regla está en DOS sitios, y hay que cambiar los DOS

Buscada la prohibición en todo `docs/`, **no vive en un solo lugar**:

| # | Fichero:línea | Texto vigente hoy |
| --- | --- | --- |
| **①** | `docs/SPRINT_DEMO_READY_EXT.md:105-106` **(A4.1)** | «PROHIBIDO en toda la landing: "factura", "VeriFactu", claims fiscales (pre-SIF). Si existe sección VeriFactu, SOLO con el wording del guion H2.» |
| **②** | `docs/YAQU_MASTER.md:1693` **(AB5)** | «**Sección VeriFactu: SOLO post-SIF**, o pre-SIF únicamente con el wording del guion H2.» |

**Si se enmienda una y no la otra, divergen** — y es exactamente el fallo que `docs/ASESOR.md` §4
documenta con la zona roja: *«una lista repetida en prosa es una lista que se separa»*, que ya
había derivado en tres copias antes de que alguien lo notara. Por eso esta enmienda trae los **dos**
textos, para aplicarse **en el mismo commit**.

> **Nota de ubicación, por precisión:** **A4.1 no está dentro de `docs/YAQU_MASTER.md`**, sino en
> `docs/SPRINT_DEMO_READY_EXT.md` (OLA 4). El guard de SCRUM-400 la cita como «la entrada A4.1 del
> máster» y así se ha hablado siempre de ella; se anota para que quien aplique la enmienda no la
> busque en el fichero equivocado.

> **Hay una tercera copia y NO se toca:**
> `docs/historico/YAQU_MASTER_v5.3_pre-14jun_con-progreso.md:610` lleva la misma frase de AB5. Es
> **histórico congelado** —una foto de una versión anterior del máster— y enmendarlo sería
> reescribir el pasado. Se anota para que no parezca un descuido de la búsqueda.

**Y un cuarto sitio que encontré y que NO propongo tocar:** `docs/SPRINT_DEMO_READY_EXT.md:148-149`
**(A4.7, demo interactiva)** — *«PROHIBIDO dentro de la maqueta: la palabra "factura" o claims
fiscales; el documento final se llama justificante (regla 26)»*. **Se deja intacta a propósito:** la
maqueta enseña **el producto de YaQu**, y la excepción de abajo solo cubre **nombrar la obligación
del lector**. Nada de lo que la excepción permite tiene sitio dentro de una simulación del producto.

### 6.2 · ① A4.1 — `docs/SPRINT_DEMO_READY_EXT.md:105-106`

**Texto vigente** (no tocar hasta que el fundador aplique):

```markdown
- PROHIBIDO en toda la landing: "factura", "VeriFactu", claims fiscales (pre-SIF). Si existe
  sección VeriFactu, SOLO con el wording del guion H2.
```

**Texto propuesto:**

```markdown
- PROHIBIDO en toda la landing: "factura", "VeriFactu", claims fiscales (pre-SIF). Si existe
  sección VeriFactu, SOLO con el wording del guion H2.
- **EXCEPCIÓN ACOTADA (SCRUM-328 · decisión del fundador 7-ago-2026, «futuro honesto»).** La
  landing PUEDE nombrar VeriFactu **como obligación futura del LECTOR, con su fecha**:
  sociedades **1-ene-2027**, autónomos **1-jul-2027** (RD-ley 15/2025; Apéndice A del máster).
  La excepción alcanza a eso y **a nada más**. **Sigue prohibido, sin excepción:**
  (a) **cualquier afirmación sobre el estado de YaQu ante esa norma** —construido, en
      certificación, certificado, conforme, homologado, adaptado, cumple, con declaración
      responsable— y **autodenominarse fabricante o productor**, mientras
      `docs/legal/DECLARACION_RESPONSABLE.md` no esté EMITIDO (criterio de
      `scripts/_guard-conformidad-landing.mjs`, SCRUM-400);
  (b) **prometer que el lector "ya estará dentro" o "ya cumplirá" con YaQu en esa fecha**: es una
      afirmación sobre un futuro que hoy no está construido (SIF-1 abierto, `SIF_ENABLED=false`);
  (c) **decir o insinuar que YaQu envía o remite algo a la AEAT**: no existe — `VfSubmission` no
      está en el schema y el cuerpo SOAP se construye sin un solo llamador (§2③).
  **La fecha NO es el titular** (regla 26b): el gancho nº1 sigue siendo la morosidad / el cobro.
  **Y esta excepción abre una puerta; no escribe lo que pasa por ella:** cada frase concreta la
  aprueba el fundador (reglas 26 y 30).
```

### 6.3 · ② AB5 — `docs/YAQU_MASTER.md:1693`

**Texto vigente** (no tocar hasta que el fundador aplique):

```markdown
**Sección VeriFactu: SOLO post-SIF**, o pre-SIF únicamente con el wording del guion H2.
```

**Texto propuesto:**

```markdown
**Sección VeriFactu: SOLO post-SIF**, o pre-SIF únicamente con el wording del guion H2 — salvo la
**excepción acotada de A4.1 (SCRUM-328)**: nombrar la obligación del LECTOR con su fecha
(sociedades 1-ene-2027, autónomos 1-jul-2027) SIN afirmar nada sobre el estado de YaQu.
```

### 6.4 · 🔴 ③ EL GUION H2 QUEDA TOCADO, Y ESO **NO** LO ARREGLA ESTA ENMIENDA

Las dos entradas de arriba remiten a *«el wording del guion H2»* como la salida permitida. **Esa
salida, hoy, no es utilizable en la landing**, y no es una opinión.

El guion H2 vigente (`docs/YAQU_MASTER.md:214`) dice, literal:

> *«Te contesto **como fabricante**: la facturación VeriFactu **está construida y en certificación**
> — **con declaración responsable del productor**, que es lo que tu gestor te pedirá. […]»*

**Es el texto que SCRUM-400 RETIRÓ de `public/index.html:510` el 7-ago-2026**, por invocar un
documento que no está emitido. **Comparados los dos literales** (el guion en `:214` contra el HTML
recuperado de `265fca83^`), **la única diferencia en todo el párrafo es una cláusula**: el guion
dice *«Los **founding** la **estrenáis**…»* y la web decía *«Los **primeros usuarios** la
**estrenarán**…»*. **La frase que dispara el problema —la primera— es idéntica.**

**Y el guard la caza — ejecutado, no razonado:** metida en `afirmacionesDeConformidad()`, **cae**
con motivo *«afirma un estado de conformidad fiscal»*. Cumple **las dos** condiciones de
`scripts/_guard-conformidad-landing.mjs:64-68` a la vez —«como fabricante» dispara el
autonombramiento, y «certificación»/«declaración responsable» junto a «VeriFactu» disparan la
afirmación de estado—, aunque el mensaje solo nombre la segunda. Es el **control positivo** de la
tabla del §5.

**Consecuencia práctica:** mientras H2 diga eso, la frase *«SOLO con el wording del guion H2»*
remite a un texto **que el propio repositorio bloquea al publicarse**. La regla no se contradice a
sí misma por accidente: H2 nació como **guion HABLADO** para responder a una pregunta en una
llamada, no como copy de web — y en boca es una respuesta, mientras que en la web es un claim
ofrecido sin que nadie pregunte (el matiz que SCRUM-327 ya levantó sobre la insignia).

**Enmendar H2 es decisión del fundador y NO se hace aquí** (regla 26: la pregunta de VeriFactu se
responde SOLO con el guion H2 — y cambiar el guion es cambiar el máster). **Se deja señalado con su
medida**, que es lo que corresponde a esta tarea.

### 6.5 · Cómo aplicar esto, si se aplica

1. **Los dos textos, en el MISMO commit** (① y ②). Si solo se aplica uno, la regla diverge.
2. **A4.7 y el histórico no se tocan** (§6.1).
3. **H2 aparte**, con su propia decisión (§6.4).
4. **Y sigue sin haber una frase aprobada**: la excepción dice qué cabe, no qué se publica (§5).
5. **Condición que puede tumbar todo esto:** si el asesor contesta en **P14** que *ofrecer o
   anunciar* el módulo apagado ya es «comercializar» a efectos del art. 201 bis LGT, esta excepción
   **hay que estrecharla o cerrarla**. Ver `docs/legal/PREGUNTAS_ASESOR.md`, P14, matiz 1.

---

## 7 · LO QUE ESTA TAREA HA TOCADO

| Fichero | Qué |
| --- | --- |
| `docs/master/SCRUM-328.md` | **nuevo** — la decisión (§1-§5) **y** la enmienda redactada y NO aplicada (§6) |
| `docs/legal/PREGUNTAS_ASESOR.md` | **+1 línea** de puntero a P14 en la cabecera. Cero cambios de contenido |

> **Por qué la enmienda vive DENTRO de este fichero y no en uno propio.** Se escribió primero como
> `SCRUM-328-ENMIENDA-A4.1.md` y **el guard de SCRUM-273 la tumbó** (`npm test`): en `docs/master/`
> solo caben ficheros `SCRUM-<n>.md`, *«porque el nombre es lo que garantiza que dos tickets nunca
> escriban en el mismo fichero»*. **No se tocó el guard, se movió el documento** — un guard que
> estorba se arregla cambiando lo que hizo saltar la alarma, no la alarma.

**No se ha tocado:** `public/**` · `docs/YAQU_MASTER.md` · `docs/SPRINT_DEMO_READY_EXT.md` (donde
vive A4.1) · el guion H2 · `src/**` · `prisma/schema.prisma` · las banderas · el guard de SCRUM-400
· el camino de emisión (regla 38).

---

## 8 · SOBRE F4, F5 y F7 — lo que puedo afirmar y lo que no

El encargo dice que esta decisión desbloquea **F4, F5 y F7**. **En el repositorio no hay registro
del bloque F**: buscado `Bloque F` en todo `docs/`, las **únicas dos apariciones** son de
`docs/master/SCRUM-327.md:231,237`, y hablan de él sin enumerarlo. **No he podido verificar ni sus
enunciados ni la naturaleza del bloqueo** — viven en Jira, fuera del alcance de esta sesión.

Lo que esta decisión les entrega es lo único que puede entregarles: **qué se puede nombrar
(la obligación del lector, con fecha) y qué sigue prohibido (todo lo que hable de YaQu)**. Si alguno
de los tres necesitaba una frase concreta aprobada, **sigue bloqueado por la regla 30**, y eso lo
desbloquea el fundador escribiéndola, no este documento.

---

# SCRUM-328 · F1 fase 1 · INVENTARIO MEDIDO de lo que el producto hace HOY

**Medido en:** host `DESKTOP-T5MONF5` · rama `scrum-328-inventario-medido` · `HEAD` =
`84f60528e626f6bc569c43e08e635497fc351d13` (= `origin/main` de las 13:22 CEST) ·
**2026-08-12T13:22:58+02:00**

**Qué se midió y dónde:** la superficie (`public/dashboard/`), el dominio (`src/`), los flags
(`src/core/flags.ts`) y los montajes de `src/app.ts`. **Cero código tocado.**

**Dos instrumentos independientes**, cada uno con su control positivo — porque una ausencia
afirmada por uno solo no vale:

| instrumento | de dónde sale | control positivo |
|---|---|---|
| **superficie** — `tests/_censo-vistas-dispatch.mjs` (SCRUM-433) | el `switch` de `renderView`, la barra lateral y quién abre cada vista | encuentra **25 vistas con camino**; si diera 0 en las dos columnas, estaría ciego |
| **dominio** — `tests/_alcance-dominio.mjs` (SCRUM-411) | grafo de imports desde `index.ts`, `app.ts` y los scripts de `package.json`, **por export** | encuentra **99 módulos alcanzables** de 107 |

---

# 🔴 LA RESPUESTA A LA PREGUNTA QUE IMPORTA

> **«¿Qué puede prometer la landing HOY sin mentir?»**

**Se puede prometer:** presupuestar en el móvil, mandarlo por WhatsApp, que el cliente lo **firme**,
convertirlo en **trabajo**, el **albarán/parte firmado**, la ficha de **clientes**, **productos y
proveedores**, **gastos**, **informes**, el **libro de registro** por trimestre y **descargar tus
datos**.

**NO se puede prometer, y son tres cosas, no una:**

1. **Facturar.** `INVOICING_ES_ENABLED = false` (y `SIF_ENABLED = false`). Es la regla 24 y no hay
   discusión.
2. **Cobrar con tarjeta.** `PAYMENTS_CONNECT_ENABLED = false` → sin Connect activo no se procesan
   pagos de clientes finales (regla 18).
3. **Cobrar por Bizum.** `BIZUM_MANUAL_ENABLED = false` **y** `BIZUM_AUTO_ENABLED = false`. Esto es
   lo que **no esperaba encontrar**: la vía que el máster describe como «mientras tanto,
   transferencia/Bizum manual» **está apagada por defecto**.

> **Doce de los trece flags del producto están en `false`.** El único encendido es
> `WHATSAPP_TEMPLATES_ENABLED`. Cualquier promesa de la landing que no sea presupuesto, firma,
> albarán o gestión interna **hay que comprobarla contra esa lista antes de escribirla**.

---

# A) VIVO Y ALCANZABLE — 25 de 25 vistas tienen camino

**Población: las 25 vistas del `switch` de `renderView`.** 17 están en la barra lateral; las 8
restantes se abren desde otra vista (detalle). **Ninguna se queda sin camino** — y ese cero **sí se
puede creer** porque el mismo instrumento encuentra las 25 que sí lo tienen.

| vista | cómo se llega | ruta de servidor |
|---|---|---|
| `home` | barra | `/admin/metrics` |
| `quote-requests` | barra | `/admin/quote-requests` · `/admin/attachments` |
| `quotes-new` · `quotes-list` · `quotes-detail` | barra (2) + detalle | `/admin/quotes` |
| `jobs` · `jobs-detail` | barra + detalle | `/admin/jobs` |
| `albaranes` · `albaran-detail` | barra + detalle | `/admin/albaranes` |
| `invoices` · `invoice-detail` | barra + detalle | `/admin/invoices` |
| `cobros` | barra | `/admin/cobros` · `/admin/charges` |
| `customers` · `customer-360` | barra + detalle | `/admin/customers` |
| `products` · `providers` | barra | `/admin/products` · `/admin/providers` |
| `expenses` | barra | `/admin/expenses` |
| `reports` | barra | `/admin/reports` |
| `libro-registro` | barra | `/admin/libro-registro` · `/admin/libros` |
| `team` (+ alias `operarios`) | barra | `/admin/team` |
| `plans` | barra | `/admin/billing` |
| `settings` | barra | `/admin` |
| `export` | desde Configuración | `/admin/exports` |
| `templates` | desde otra vista | `/admin/templates` |

**A = 25.**

---

# B) MOTOR SIN SUPERFICIE — 8 módulos + 3 rutas

**Población: los 107 módulos de dominio de `src/`.** El instrumento encuentra **99 alcanzables**
(control positivo) y **8 que ningún camino de usuario alcanza**:

| motor | qué NO puede hacer hoy un profesional |
|---|---|
| `invoicing/recargoEquivalencia` | facturar bien a un cliente en recargo — **el dato del cliente ya se guarda (SCRUM-294-a), el cable no** |
| `invoicing/retencionIrpf` | facturar a empresa con retención: sale por el bruto |
| `invoicing/criterioCaja` | ver qué IVA le toca declarar este trimestre |
| `invoicing/finalInvoice.service` | emitir la factura final **descontando la señal** ya cobrada |
| `invoicing/huecosSerie` | enterarse de que en su serie **falta un número** |
| `jobs/albaranSerie` | ver qué número tendrá su siguiente albarán |
| `jobs/ventanaDeFirma` | que una firma hecha sin cobertura **no quede fechada el día que sube** |
| `system/flagFiscal.service` | encender su facturación **dejando rastro** (hoy es un UPDATE a mano) |

Y **tres rutas montadas que ninguna pantalla pide** — medido barriendo `public/`:
`/admin/modelo-303` · `/admin/evidencias.zip` · `libros/recibidas.csv` (la UI solo pide
`expedidas.csv`; **sin recibidas no hay IVA soportado**).

**B = 8 módulos + 3 rutas.**

---

# C) ESPECIFICACIÓN EJECUTABLE SIN SUPERFICIE — 1 canónico

`system/borradoMerchant.ts → borrarMerchant`: **cero llamadores en producción**, pero es el **sujeto
ejecutable** de dos guards (`scrum192` verifica el ORDEN de borrado; `scrum244`, que
`reconciliation` se borra antes que sus charges). No es código muerto: es la **especificación
ejecutable** del orden de borrado seguro para las claves ajenas. La supresión real la hace
`suprimirMerchant`, que **anonimiza y conserva el asiento**.

**C = 1.**

---

# D) DETRÁS DE FLAG — 13, y 12 apagados

| flag | estado | qué apaga |
|---|---|---|
| `WHATSAPP_TEMPLATES_ENABLED` | **true** | las plantillas de WhatsApp — **lo único encendido** |
| `INVOICING_ES_ENABLED` | false | **facturación fiscal** (regla 24) |
| `SIF_ENABLED` | false | la remisión a la AEAT |
| `PAYMENTS_CONNECT_ENABLED` | false | **cobro con tarjeta** de clientes finales (regla 18) |
| `BIZUM_MANUAL_ENABLED` · `BIZUM_AUTO_ENABLED` | false · false | **cobro por Bizum**, las dos vías |
| `VOICE_QUOTE_ENABLED` · `VOICE_ALBARAN_ENABLED` | false · false | dictar presupuesto y albarán |
| `BOT_INBOUND_ENABLED` · `BOT_AI_ENABLED` | false · false | el bot de WhatsApp entrante |
| `MERCHANT_DELETE_ENABLED` | false | ejecutar la supresión de cuenta (ruta montada, responde 404) |
| `PUBLIC_PROFILE_ENABLED` | false | el perfil público |
| `MAINTENANCE_ENABLED` | false | los recordatorios de mantenimiento |

**D = 13.**

⚠️ **Un flag en `false` por defecto puede estar encendido por merchant** (Parte P: overrides en
`Merchant.flags`). **Esto es un «no sé» honesto:** el estado real por merchant vive en la base y
**no he consultado ninguna**. La landing no habla de un merchant: habla del producto, y para el
producto el valor por defecto es el que manda.

---

# E) NO SÉ — 4, con su motivo

1. **Si algún merchant real tiene flags encendidos por override.** Vive en la base y no consulto
   ninguna. Lo puede mirar el fundador en un minuto.
2. **Si el bot de WhatsApp funciona de punta a punta.** Sus dos flags están en `false`, así que
   **no he podido observar el camino completo**; el código existe.
3. **Si las 25 vistas funcionan de verdad para un usuario.** Este censo demuestra que **hay
   camino**, no que la pantalla haga lo que promete: eso es QA con navegador, no un censo.
4. **Cuánto de la landing actual coincide con esto.** **No he abierto `public/index.html`** — me
   dijiste que no la toco, y tampoco la he leído para no contaminar el inventario con lo que ya
   dice. Comparar las dos cosas es la fase 2.

**E = 4.**

---

# LAS CUENTAS, y cada población suma la suya

**No hay un único total: hay tres poblaciones, y mezclarlas sería el defecto que este censo
persigue.** Cada una suma lo suyo:

| población | total | reparto |
|---|---|---|
| **vistas del dispatch** | **25** | A) 25 con camino + 0 sin camino = **25** ✅ |
| **módulos de dominio** | **107** | alcanzables 99 + B) 8 inalcanzables = **107** ✅ |
| **flags** | **13** | D) 1 encendido + 12 apagados = **13** ✅ |

**C (1) y E (4)** no pertenecen a esas poblaciones: C es un export dentro de un módulo vivo, y E son
preguntas, no funcionalidades. **Se cuentan aparte a propósito** — meterlos en una suma común daría
un número que no significa nada.

---

# LO QUE NO CUBRE ESTE INVENTARIO, declarado

* **`import * as` esconde huérfanos** (`_alcance-dominio.mjs`): los 8 son un **suelo**, no un techo.
* El **import dinámico por nombre** tiene 1 falso positivo conocido y declarado.
* **No he abierto la landing** ni tocado `public/index.html`.
* **No he consultado ninguna base**, ni de producción ni de staging.
* **No se ha tocado** el camino de emisión, ninguna factura ni `prisma/schema.prisma`.
* Esto mide **qué existe y quién llega**, no **si funciona bien**. Un camino que existe puede estar
  roto: eso lo dice QA, no un grafo.
