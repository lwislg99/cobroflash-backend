# SCRUM-525 · La contradicción del A/B: la hipótesis del fundador es CORRECTA, son dos ejes distintos

**Fecha:** 16-sep-2026 · **Carril:** fiscal (LECTURA) · **Gate:** sin gate
**Medido contra:** `origin/main` = `1be773a3e6d929d2f033ae94bc1654855a68731a` · 2026-09-16T07:52:06Z
**Rama:** `scrum-834-853-contradiccion-medida`

⛔ **Solo lectura.** No se toca el máster, ni el camino de emisión (regla 38), ni ningún ticket.
`src/` y `prisma/` a 0 líneas.

---

## 1 · 🔴 EL VEREDICTO: la hipótesis es correcta, y NO hay contradicción en el máster

El fundador escribió: *«son DOS A/B distintos — el del máster es `TipoUsoPosibleSoloVerifactu`, y el
que está parado es el carril de REPRESENTACIÓN»*, y pidió que se dijera sin miramientos si era falsa.

**No lo es. Es correcta, y además el máster ya lo distingue en su propio texto.**

| eje | qué decide | dónde | estado |
|---|---|---|---|
| **MODALIDAD** | VERI\*FACTU (remisión) frente a no-remisión | máster **S1-B** | ✅ **DONE 12-jun-26** · `TipoUsoPosibleSoloVerifactu=S` |
| **REPRESENTACIÓN** | quién pone el certificado ante la AEAT | máster **S1-D** | ⏸ **PAUSA** |

Son preguntas **de ejes distintos**: una es *en qué modo opera el SIF*, la otra es *en nombre de
quién se remite*. Cerrar la primera no toca la segunda.

### Y el máster NO se contradice: lo dice en la misma línea

`docs/YAQU_MASTER.md:959` lleva las dos cosas juntas, con estados distintos:

> «S1-B ✅ (modalidad documentada) · **S1-D ⏸ PAUSA (espera decisión de representación del asesor)**»

🔒 **La contradicción no estaba en el máster: estaba en leer «el carril A/B» como si fuera uno.** El
`✅ DONE` de S1-B nunca afirmó nada sobre la representación.

---

## 2 · Qué son de verdad los dos carriles, con las palabras del ticket

SCRUM-525 los enuncia, y no se parecen a una modalidad:

* **COLABORADOR SOCIAL** — YaQu remite con **su** certificado en nombre de todos los merchants,
  por apoderamiento.
* **MERCHANT** — cada profesional aporta su certificado y YaQu remite «como representante».

`TipoUsoPosibleSoloVerifactu` no aparece **ni una vez** en `docs/legal/AUDITORIA_CAMINO_EMISION.md`,
que es el documento que audita los carriles. No es el mismo asunto y no comparten campo.

---

## 3 · Lo que ya está medido, y encoge la decisión

La auditoría que este ticket pedía **existe** y contesta la pregunta de los tres resultados posibles:

| afirmación | dónde |
|---|---|
| «la respuesta a la pregunta de los dos carriles es la tercera: **no existe ninguno de los dos**» | `AUDITORIA_CAMINO_EMISION.md:18` |
| «Colaborador social (YaQu remite con su certificado por apoderamiento) → **no existe**» | `:88` |
| el semáforo que se recordaba del carril colaborador es **de conformidad del registro, no de representación**, y es **un documento, no código** | `:122-124` |
| «**Elegir el carril de representación.** Está planteada como pregunta abierta» | `:181` |

> 🔒 **Lo que esto encoge:** no hay que decidir entre «lo construido y lo no construido». **No hay
> nada construido de ninguno de los dos**, así que la decisión es libre — y es del asesor, no una
> corrección de rumbo sobre código existente. `PREGUNTAS_ASESOR.md` punto 1 lo ata: **«Sin esta
> respuesta no se construye S1-D»**.

## 4 · Lo NO tocado

`docs/YAQU_MASTER.md` · `docs/legal/AUDITORIA_CAMINO_EMISION.md` · el camino de emisión (leído,
regla 38) · ningún ticket cerrado ni reabierto · `src/` · `prisma/schema.prisma`. **Nada ejecutado
contra producción ni contra staging.**

---

# SCRUM-525 · APÉNDICE · 16-sep-2026 · ¿Está cumplida la promesa? INCOMPLETA por cinco líneas y un punto caducado

**Medido contra:** `origin/main` = `396e65caa92cd008632d0eb79d39bb56b7f2faef` · 2026-09-16T09:10:02Z
**Rama:** `scrum-525-promesa-cumplida` · **Carril:** medición · **Gate:** sin gate

⛔ Esto mide. No se construye nada, **no se corrige la auditoría**, `src/` intacto, regla 38 en pie.

---

## 1 · 🔴 LO QUE EL FUNDADOR ESTÁ ESPERANDO: la afirmación de los dos carriles, CONFIRMADA

La auditoría dice (`docs/legal/AUDITORIA_CAMINO_EMISION.md:88-89`):

| Carril | ¿Existe código? |
|---|---|
| Colaborador social (YaQu remite con su certificado por apoderamiento) | **no existe** |
| Merchant (cada profesional aporta su certificado) | **no existe** |

**Re-medido hoy contra el árbol, no releído:**

| marcador | ficheros en `src/` |
|---|---|
| `clientCertificate` · `apoderamiento` · `colaborador social` · `pfx` · «certificado del merchant» | **0** |
| `mTLS` | **1**, y es un **comentario** — `modoVisible.ts:21`, que dice «**«se envía» NO EXISTE**. Cero clientes SOAP/mTLS» |
| llamadas de red a `agenciatributaria` en `.ts` (fuera de comentarios) | **0** |
| `sif.client.ts` (el cliente de envío que pedía S1-D) | **no existe**: `src/modules/fiscal/verifactu/` tiene `productor.ts`, `registro.builder.ts` y `xsd/` |

> 🔒 **CONFIRMADA. La decisión del asesor es LIBRE, no una corrección sobre código existente.** No
> hay que elegir «entre lo construido y lo no construido»: no hay nada construido de ninguno de los
> dos carriles, ni hay por dónde enviar.

---

## 2 · El censo: los dos números

**Criterio declarado antes del número.** Afirmación = fila de tabla con contenido o viñeta; la prosa
corrida no cuenta, y las viñetas que describen el INSTRUMENTO tampoco (el ticket no pedía anclarlas).
Anclada = lleva `fichero.ext:NN`.

| | nº |
|---|---|
| **afirmaciones** | **31** |
| ✅ con **fichero Y línea** | **20** |
| ✅ declaradas (`NO MEDIDO` / `no existe` / `INEXISTENTE`) | 6 |
| ⚠️ **con fichero pero SIN línea** | **5** |
| 🔴 sin ancla de ningún tipo | **0** |

**Los dos números que pedía el encargo: 31 afirmaciones · 20 con fichero y línea.** Sumando las
declaradas —que el ticket acepta como salida válida— quedan **26 de 31 cubiertas**.

> ⚠️ Mi primer censo dijo **35 afirmaciones y 5 sin ancla ninguna**. Estaba mal por dos motivos
> míos: no reconocía **`INEXISTENTE`** como declaración (la auditoría la usa) y contaba como
> afirmación las viñetas que describen el método. Corregido antes de publicar el número.

### Y las 35 coordenadas resuelven, pero con un matiz que importa

Las **35** coordenadas citadas **resuelven hoy**: 0 fuera de rango, 0 ficheros ausentes. Pero **14 de
las 35 se citan sin ruta**, sólo por el nombre (`verifactu.service.ts:152`, `flags.ts:16`).

> 🔒 Hoy resuelven las 14 porque **ningún basename está repetido** en el árbol. Eso es suerte, no
> diseño: el día que haya dos `flags.ts`, esa cita deja de ser una coordenada y pasa a ser una pista.

---

## 3 · 🔴 LA CADUCIDAD, que era el hallazgo que el encargo pedía buscar

De los **tres** puntos de «Qué queda NO MEDIDO»:

| # | punto | hoy |
|---|---|---|
| 1 | las banderas **en producción** | ✅ **sigue vigente** — no se toca producción (regla 3) |
| 2 | `Subsanacion` / `RechazoPrevio` / `SinRegistroPrevio` | ⚠️ sigue sin implementarse, pero **ya es localizable**: sólo viven en los **XSD** (`RespuestaConsultaLR.xsd`, `SuministroInformacion.xsd`), en ningún `.ts` |
| 3 | el comentario de `verifactu.service.ts:673` sobre rectificativas | 🔴 **CADUCADO** |

El punto 3 la auditoría lo dejó como «según el encargo, un comentario que **miente sobre las
rectificativas**. **NO MEDIDO en esta tanda**». **Ya no es cierto: se corrigió.** Hoy ese sitio dice:

> «🔴 **AQUÍ HUBO UNA AFIRMACIÓN FALSA DURANTE 18 DÍAS**, y conviene que conste por qué se corrige en
> vez de borrarse: este comentario decía «hoy `MODO_TIPO_RECTIFICATIVA` vale SIN_CONFIRMAR, así que
> la R1 se EXCLUYE del registro». Las dos mitades eran falsas desde el 30-jul-2026, cuando el
> fundador movió el modo a `INCREMENTAL_I`.»

Es decir: **SCRUM-513 lo cerró**, y la auditoría sigue listándolo como pendiente. Y la línea ha
derivado: hoy la 673 está **vacía** y el comentario empieza en la **674**.

---

## 4 · EL VEREDICTO: **INCOMPLETA**, y falta poco y concreto

La auditoría **existe, contesta las tres preguntas** (qué existe, hasta dónde llega, cuál de los dos
carriles) y su afirmación principal **se sostiene re-medida**. Lo que le falta para cumplir su
promesa literal —«**fichero y línea en CADA afirmación**»— es esto y nada más:

1. **5 afirmaciones llevan fichero pero no línea.** Están en el apéndice de abajo con su número de
   línea en el documento, para que sea trabajo de minutos y no de búsqueda.
2. **El punto 3 de «NO MEDIDO» ha caducado** y hay que retirarlo o reescribirlo: el comentario ya no
   miente, y dejarlo listado hace que alguien vuelva a mirarlo para nada.
3. *(no lo pedía el ticket, pero cuesta lo mismo)* **14 citas sin ruta**. Ponerles la ruta las
   convierte de pista en coordenada.

**Las cinco sin línea, con su sitio en el documento:**

| doc | afirmación |
|---|---|
| `:34` | eslabón 2 · «Decide qué documento sale» → `invoicing/domain/…` sin línea |
| `:35` | eslabón 3 · «Numeración de serie» → `invoiceNumber.service.ts` sin línea |
| `:119` | `SEMAFORO_MAPA_EMISION.md` · «Documentación, con coordenadas desfasadas» |
| `:143` | «Cola `VfSubmission` INEXISTENTE» → cita `prisma/schema.prisma` sin línea |
| `:209` | la discrepancia del mapa, sin coordenada |

> 🔒 **No es un reproche y no lo arreglo yo**: el encargo dice que lo que falte es el encargo
> siguiente. Son cinco líneas, un punto a retirar y catorce rutas.

## 5 · Lo NO tocado

`docs/legal/AUDITORIA_CAMINO_EMISION.md` (**leída, no corregida**) · `src/` · el camino de emisión
(regla 38) · `prisma/schema.prisma` · ningún ticket cerrado ni reabierto · ningún estado ni flag (27)
· ninguna dependencia (36). **Nada ejecutado contra producción ni contra staging.**

---

# SCRUM-525 · APÉNDICE b · 16-sep-2026 · Los tres huecos, cerrados — y 15 anclas que resuelven apuntando a otra cosa

**Medido contra:** `origin/main` = `e778e7b232c99b5b46ce44b6c4c90d526b67b175` · 2026-09-16T09:32:02Z
**Rama:** `scrum-525b-anclas-completas` · **Carril:** documentación · **Gate:** sin gate

⛔ Sólo se han tocado **anclas** y el **punto caducado** de `AUDITORIA_CAMINO_EMISION.md`. Lo que la
auditoría afirma no se ha cambiado en ninguna línea: es de quien la escribió. `src/` intacto.

---

## 1 · 🔴 EL NÚMERO QUE DECIDE

| | antes | después |
|---|---|---|
| afirmaciones | 31 | 31 |
| ✅ con **fichero Y línea** | **20** | **24** |
| ⚠️ con fichero pero SIN línea | 5 | **1** |
| ✅ declaradas (`NO MEDIDO` / `no existe` / `INEXISTENTE`) | 6 | 6 |
| 🔴 sin ancla de ningún tipo | 0 | 0 |
| **cubiertas** (ancladas + declaradas) | 26/31 | **30/31** |

**No son 31/31, y la que falta tiene motivo escrito**, que es la otra salida que el encargo aceptaba:

> **`:143` · «Cola `VfSubmission` **INEXISTENTE**» no puede llevar línea.** Afirma una **ausencia**, y
> ninguna línea testifica que algo no está. Re-medido hoy: **0 modelos** `Vf*` / `*Submission` /
> `*Verifactu` en el esquema, **0 ficheros** de `src/` que mencionen `vfSubmission` — la afirmación
> **se sostiene**, simplemente no es anclable. En rigor es una **DECLARADA**, y sólo cayó en el cubo
> «sin línea» porque mi censo mira si hay fichero ANTES de mirar si hay declaración, y esta fila
> nombra `prisma/schema.prisma`. Defecto de mi criterio, no de la auditoría.

---

## 2 · 🔴 EL HALLAZGO QUE NO IBA BUSCANDO: 15 de las 44 coordenadas apuntan a otra cosa

El encargo me hizo verificar que **cada línea que yo añadiera dijese lo que la afirmación afirma**.
Al aplicar ese mismo listón a las anclas **que ya estaban**, salta esto:

| | nº |
|---|---|
| coordenadas en el documento | **44** |
| ✅ **resuelven** (fichero existe, línea dentro) | **44** · 0 rotas |
| ✅ **FIRMES** (la línea DICE lo que se le atribuye) | **29** |
| ⚠️ **DERIVADAS** (resuelven, pero apuntan a otra cosa) | **15** |
| 🔴 AUSENTES (el símbolo ya no está en el fichero) | 0 |

**Criterio, dicho antes del número:** por cada coordenada declaré **a mano** el token que esa línea
tendría que contener para sostener la afirmación (el símbolo, o el texto citado). La máquina sólo
comprueba y, cuando falla, dice dónde está hoy. Adivinar el token habría sido medir con el
instrumento el resultado que yo quería.

**Las peores, por distancia:**

| doc | ancla | afirma | dónde está hoy | salto |
|---|---|---|---|---|
| `:139` | `prisma/schema.prisma:98-99` | `vf_estado` (`pendiente_de_sellado`/`sellado`) | **864** | **766 líneas** |
| `:36` · `:138` | `prisma/schema.prisma:102-103` | `vf_hash`, `vf_prev_hash` | **865-866** | **763 líneas** |
| `:169` | `invoiceNumber.service.ts:310` | se lee junto a `INVOICING_ES_ENABLED` | 72, 436, 455 | 126 |
| `:66` | `pdf.service.ts:24` | un `axios.get` del logo | **120** | 96 |
| `:100` | `albaran.service.ts:843` | «certificado de evidencias» | **896** | 53 |
| `:33` | `invoicesAdmin.routes.ts:81` | la puerta de emisión | el `router.post` está en **100** | 19 |
| `:100` | `albaranPdf.service.ts:72-73` | «certificado de evidencias» | ahí pone `emisor` / `emisorNif` | — |
| `:211` · `:221` | `verifactu.service.ts:673` | el comentario de rectificativas | **674** (673 vacía) | 8 |
| `:38` · `:61` | `verifactu.service.ts:152` | la URL del QR | **153** | 1 |
| `:39` | `verifactu.service.ts:535` | `buildVerifactuRegistrosXml` | **536** | 1 |
| `:141` | `lib/invoicing.ts:97` | `exigirDocumentoEmitible` | 93, 100 | 3 |

> 🔒 **MEDIDO Y PARADO. No las he corregido, y el motivo no es pereza.** Cuatro son mecánicas (el
> símbolo existe en un solo sitio y basta mover el número). Las otras exigen **decidir qué afirma**
> la frase —cuál de los tres `router.post` es «la puerta de emisión»— y eso es reescribir el
> criterio de quien la escribió, no mover su ancla. Es el encargo siguiente, con su número ya medido.

> ⚠️ **`prisma/schema.prisma:102-103` es el aviso serio.** No es sólo un número desfasado: la línea
> 102 es hoy **un comentario sobre husos horarios**. Alguien que compruebe la auditoría por ahí lee
> algo coherente, que no tiene nada que ver, y se lo cree.

---

## 3 · Los tres huecos, uno a uno

**① Las 5 sin línea → 4 ancladas, 1 con motivo.** Cada línea añadida se leyó antes:

| doc | ancla puesta | por qué esa línea y no otra |
|---|---|---|
| `:34` | `…/facturaSuelta.ts:74-78` | la afirmación enumera **tres** salidas; el tipo con los tres valores (`'factura' \| 'justificante' \| 'no'`) está en la **74**, la función en la 76 y la decisión en la 78. La línea de la función sola no diría los tres |
| `:35` | `…/invoiceNumber.service.ts:390` | `allocateInvoiceNumber`, que es donde se **reserva** el número de la serie |
| `:119` | `SEMAFORO_MAPA_EMISION.md:226` y `:258` | son **las dos únicas líneas** donde el mapa cita coordenadas, así que son exactamente las desfasadas |
| `:209` | igual | la coordenada va en la **línea de la propia afirmación**: la puse debajo y el censo dejó de verla — un ancla en la línea siguiente no es un ancla |
| `:143` | **ninguna** | afirma una ausencia (ver §1) |

**② El punto 3 de «NO MEDIDO», jubilado diciendo qué pasó.** No borrado: tachado, con SCRUM-513
nombrado como quien lo cerró y con la deriva 673→674 escrita. Un punto que desaparece en silencio
deja al lector siguiente sin saber si se midió o si alguien lo tapó.

> ⛔ **Lo que NO he tocado, y es deliberado:** la viñeta de «Discrepancias» que dice «**NO MEDIDO en
> esta tanda**» sobre ese mismo comentario. Ésa **sigue siendo cierta**: habla de lo que aquella
> tanda midió, en pasado. La caducada era la lista de «qué QUEDA por medir», que mira al futuro.

**③ Las 14 citas sin ruta → 0.** Eran **14 distintas en 17 apariciones** (`registro.builder.ts:10-11`,
`semaforoFiscal.js:37` y `flags.ts:16-17` salen dos veces cada una). Hoy las 44 coordenadas del
documento llevan ruta completa.

> 🔴 **La precondición que el encargo exigía, medida antes de tocar nada: 0 ambiguas hoy.** Los 10
> basenames citados son únicos en un índice de **2.674**. Y el índice sabe encontrar colisiones
> cuando las hay: en el árbol existen **117** basenames repetidos. El cero significa algo.
> El riesgo era **prospectivo**, no actual: el día que naciera un segundo `flags.ts`, catorce citas
> se habrían vuelto pistas sin que nada se pusiera rojo.

---

## 4 · Controles

* ✅ **POSITIVO · las ancladas siguen resolviendo, una a una.** Las **44** coordenadas: fichero
  presente y línea dentro de rango. **0 rotas, 0 sin ruta.** Listado completo con el contenido de
  cada línea, no un contador.
* 🔴 **SUELO.** El censo aborta con `CIEGO` si ve **0 afirmaciones** o **0 ancladas**; el índice de
  basenames aborta si indexa menos de 100 ficheros; el verificador de tokens aborta si **ninguna**
  sale firme — porque entonces el roto es él, no la auditoría.
* 🔴 **El editor aborta si su ancla no aparece EXACTAMENTE una vez**, y exige ver **17** citas cortas
  (no «al menos una»). Un editor que no encuentra y sigue deja el fichero intacto y el informe verde.
* ⚠️ **Mi instrumento me dio un verde falso y lo corregí antes de publicar.** Para
  `albaranPdf.service.ts:72-73` declaré el token `emisor`, pero lo que la auditoría afirma ahí es
  «certificado de evidencias»; y para `:919` declaré `excluidos` cuando lo afirmado es que **cita el
  test**. Con los tokens correctos, FIRMES bajó de **31 a 29**. El número bueno es el peor.

## 5 · Lo que he visto y NO es mi ticket

* **`:143` dice «el esquema tiene 25 modelos». Hoy tiene 30.** Es **contenido**, no ancla: no lo
  toco. Su afirmación de fondo (ninguno es `Vf*`/`*Submission`/`*Verifactu`) **sigue siendo cierta**.
* **El mapa `SEMAFORO_MAPA_EMISION.md` no sólo tiene las líneas movidas: dos de sus tres coordenadas
  citan código que ya no existe** — el `catch` del fail-open de sellado que reproduce en su bloque
  `:226` no está en `lib/invoicing.ts`, y en esa zona hoy hay un `throw`. Es de SCRUM-513.
* `docs/master/SCRUM-635.md` lleva un apéndice que empieza por `# APÉNDICE` en vez de `# SCRUM-635`
  (el defecto de SCRUM-532).

## 6 · Lo NO tocado

`src/` · el camino de emisión (regla 38) · `prisma/schema.prisma` · el **contenido** de la auditoría
· ningún ticket cerrado ni reabierto · ningún estado ni flag (27) · ninguna dependencia (36).
**Nada ejecutado contra producción ni contra staging.**

---

# SCRUM-525 · APÉNDICE c · 16-sep-2026 · Las doce anclas que apuntaban a otra cosa, y la red para mañana

**Medido contra:** `origin/main` = `5135683049a0d002f9aea5efdf13fd9ba837b280` · 2026-09-16T10:05:32Z
**Rama:** `scrum-525c-anclas-que-apuntan` (continuación de `scrum-525b`, que entró en `main` en el
PR #1341) · **Carril:** documentación + guard · **Gate:** sin gate

⛔ Sólo **anclas**. Ninguna afirmación de la auditoría cambia una letra salvo la que el fundador
ordenó reescribir (6a, que dejaba de ser «NO MEDIDO»). `src/` intacto; esquema leído, no tocado
(regla 40).

---

## 1 · 🔴 EL REPARTO REAL: 6 y 6, no 4 y ~11

El encargo partía de un número mío de la 525b —«cuatro son mecánicas»— que **era una estimación a
ojo, no una medida**. Aplicado el criterio declarado —*el texto que la afirmación cita existe HOY
en el fichero, **una sola vez**, y sólo cambió de número de línea*—:

| | anclas distintas | apariciones en el doc |
|---|---|---|
| ① **MECÁNICAS** | **6** | 7 |
| ② **CRITERIO DEL FUNDADOR** | **6** | 8 |
| **total derivadas de la 525b** | **12** | **15** |

Las dos cuentas son correctas y miden cosas distintas: `prisma/schema.prisma:102-103` salía **dos
veces** en el documento.

> ⚠️ **Se me había quedado una fuera de la tabla del instrumento.** Al montar el clasificador omití
> `verifactu.service.ts:919`, una de las 15. Resultó **mecánica**. La cacé al cuadrar apariciones
> contra anclas (15 = 7 + 8); si no llego a cuadrarlas habría entregado 5 y 6, y nadie lo habría
> notado, porque 11 también suena razonable.

---

## 2 · ① Las seis mecánicas

Ninguna decide nada: el texto citado existe hoy, **una sola vez**, y sólo cambió de número.

| doc | antes | después | el texto que lo justifica |
|---|---|---|---|
| `:36` · `:138` | `prisma/schema.prisma:102-103` | **`:865-866`** | `vf_hash` 1× (865), `vf_prev_hash` 1× (866) |
| `:139` | `prisma/schema.prisma:98-99` | **`:864`** | `vf_estado` 1× |
| `:39` | `verifactu.service.ts:535` | **`:536`** | `buildVerifactuRegistrosXml` 1× |
| `:137` | `verifactu.service.ts:919` | **`:947`** | la cita de `tests/scrum240-sobre-unico.test.mjs` 1× |
| `:66` | `pdf.service.ts:24` | **`:120`** | el **único** `axios.` del fichero, y descarga el logo |
| `:100` | `albaran.service.ts:843` | **`:896`** | «certificado de evidencias» 1× |

> ⚠️ **Una candidata se cayó por el propio criterio.** `albaranPdf.service.ts:72-73` cita
> «certificado de evidencias», y esa frase **no existe** en ese fichero (0 veces). Con el token
> flojo —la palabra suelta `certificado`— habría pasado por mecánica. Fue al bloque ②.

---

## 3 · ② Las seis que decidió el fundador

**Su regla, literal:** *el ancla apunta a lo que la frase AFIRMA, y el rango cubre TODO lo que la
frase afirma. No a lo que está cerca, no al comentario que lo explica. Un comentario no es una
puerta: es el cartel de la puerta.*

| # | doc | resuelto | por qué |
|---|---|---|---|
| 1 | `:33` | `invoicesAdmin.routes.ts:81` → **`:100`** | la tabla cita PUERTAS, y una puerta es una ruta. La 150 es el acto |
| 2 | `:38` → **`:141`** · `:61` → **`:153`** | dos anclas distintas | son dos afirmaciones distintas: el eslabón que EXISTE, y la URL que escanea el cliente |
| 3 | `:100` | `albaranPdf.service.ts:72-73` → **`:382`** | el propósito de la frase es DESAMBIGUAR, así que el testigo va donde la palabra aparece con ese sentido |
| 4 | `:141` | `:97` y `:228` → **`:100` y `:236`** | dice CONSTRUIDA, y lo que construye una puerta es la llamada |
| 5 | `:169` | `:310` → **`:452-457`** | la frase afirma TRES cosas; el rango las cubre las tres |
| 6a | `:210` | reescrita | dejaba de ser «NO MEDIDO»: ya está medido |
| 6b | `:220` | conservada + una frase | el tachado era deliberado, y ahora lo dice por escrito |

> 🔒 **La 402 se descartó a propósito** en el caso 3: es texto que ve el cliente, es del fundador
> (regla 30) y puede cambiar sin avisar. **Un ancla sobre microcopy nace con fecha de caducidad.**

> 🔴 **Una corrección que le debo al fundador, y que cambia su número.** En el caso 5 su decisión
> decía «453-457», heredando un **error de uno mío** en el informe: el comentario de SCRUM-207 —la
> línea que dice «congelado en el registro», que es la tercera cosa que la frase afirma— empieza en
> la **452**, no en la 453. Su REGLA manda sobre mi cifra, así que el rango puesto es **452-457**.

> ⚠️ **Lo que el caso 1 deja incoherente, y él pidió que constara:** la fila dice «el **usuario**
> pulsa emitir», y la ruta reanclada es `router.post('/', requireRole('admin'), …)`. Ahí quien pulsa
> es un **admin**, no el profesional. Eso cambia la AFIRMACIÓN, no su ancla: **ticket aparte**.

**Resultado de ① + ②: FIRMES 29 de 44 → 45 de 45.** Ninguna coordenada de la auditoría apunta ya a
otra cosa.

> ⚠️ **El denominador sube de 44 a 45, y no es un truco.** La fila del portón escribe su segunda
> cita en forma abreviada —`` `:236` ``— y **eso es una coordenada**, pero mi tabla de la 525b la
> contaba junto a su hermana en una sola entrada. Al separarlas aparece la que faltaba. Los dos
> números están bien medidos; el de la 525b contaba filas donde debía contar coordenadas.

---

## 4 · ③ La red: `docs/legal/` entero, con testigo y trinquete

**El problema, dicho antes que el diseño:** mientras el ancla sea sólo `fichero:NN`, ninguna máquina
puede saber si apunta a lo que dice **sin adivinar la intención de la frase** — y adivinarla es lo
que produjo mi verde falso en la 525b. Así que el testigo no se infiere: se **exige escrito**, con
la notación que la auditoría ya usaba. **El guard no inventa convención: hace cumplir la que hay.**

* **Criterio:** `scripts/_anclas-con-testigo.mjs` (un solo sitio) · **Guard:**
  `tests/scrum525d-anclas-que-apuntan.test.mjs` · **Congelado:**
  `scripts/_anclas-sin-testigo.congelado.mjs`.
* **POBLACIÓN, declarada siempre con las dos cifras:** 15 ficheros de `docs/legal/` ·
  **195 coordenadas vivas · 12 con testigo**. Hoy: **9 FIRMES · 0 DESFASADAS · 81 sin testigo ·
  102 sin ruta · 3 que no resuelven · 1 tachada exenta.**
* **Trinquete por PAR documento↔fichero citado** —sin número de línea— que sólo puede **encoger**:
  **87 pares congelados**. Un par nuevo que cite sin testigo tumba el guard. Añadir una línea al
  congelado es declarar por escrito que la deuda crece, y el mensaje del rojo lo dice.

> 🔴 **SCRUM-710b me cazó a mí con su propia lección, y tenía razón.** La primera versión de este
> trinquete congelaba **165 identidades** de la forma `documento#ruta:LÍNEA`. Su guard las vio y
> cayó: una identidad que lleva la posición dentro **caduca en cuanto alguien edita el fichero por
> encima**, y entonces lo que se toca para volver al verde es el guard. Rehecho por pares. Lo
> mismo con mi propio control: escribía a mano las coordenadas rotas de ayer (`:97` y `:228`) y
> ahora las **deriva del testigo**. **⚠️ Precio que se paga a sabiendas:** el trinquete ya no caza
> una coordenada nueva sin testigo en un par que YA está congelado.
* **Cero umbrales escritos a mano** (SCRUM-804), comprobado por AST sobre la propia fuente del
  guard: 8 comparaciones, todas contra `0`.
* **Una coordenada tachada (`~~…~~`) está exenta**: su propia tipografía la declara muerta. Es lo
  que permite que el punto jubilado del caso 6b conserve la `:673` histórica sin poner nada rojo.

**Las cuatro patas del control positivo, todas obligatorias:**

1. **Suelo** — si ve 0 ficheros, 0 coordenadas, 0 testigos o 0 firmes, aborta `CIEGO` en vez de
   informar «0 desfasadas».
2. **Verde real** — `selladoEstado.ts:116` (`sellarTrasEmision`) sale FIRME.
3. **Rojo real** — coge la fila que estuvo rota de verdad hasta ayer, **la del portón**, y mueve
   sus **dos** anclas a una línea que no lleva su testigo: exige que caigan las dos. La fila se
   busca **por su testigo**, no por su línea, y el destino se **deriva** del fichero citado: si
   escribiera aquí las coordenadas rotas de ayer, este control sería el mismo defecto que vigila.
4. **Mutación, y asegura haber mutado** — desplaza un ancla buena **una** línea y exige que caiga.
   La sustitución **comprueba que casó**. Es exactamente lo que faltó en SCRUM-844, donde una
   mutación no casó ni una vez, el fichero quedó intacto y el control pasó en verde.

---

## 5 · Lo que el guard encontró y NO es de este ticket

* **3 coordenadas que no resuelven**, todas en `docs/legal/AUDITLOG_FISCAL_CONTRATO.md`
  (`:287` ×2, `:639`): citan `lib/invoicing.ts:58` y `:152`, **sin el `src/` delante**. No existe
  esa ruta. Congeladas, no arregladas: documento ajeno (regla 9).
* **102 coordenadas citadas por basename, sin ruta**, repartidas por `docs/legal/`. Es el mismo
  defecto que la 525b cerró **dentro de la auditoría**, vivo en los demás documentos. Hoy resuelven
  por suerte —ningún basename repetido—; el día que haya dos, dejan de ser coordenadas.

## 6 · Tres defectos MÍOS: dos los cazó el instrumento, el tercero lo cazó otro guard

Los tres primeros números que dio fueron **falsos**, y ninguno lo habría notado nadie:

1. **«171 no resuelven de 285».** Dos causas mías: 166 eran **citas por basename**, que no es «el
   fichero no existe» —decirlo así manda a buscar lo que no falta—; y 5 «fuera de rango» salían de
   que la herencia del fichero **cruzaba líneas**: una tabla de `PREGUNTAS_ASESOR.md` cuyas filas son
   `` `:377` `` —líneas de OTRO fichero— se colgó de un `src/core/flags.ts` de dos líneas más arriba.
2. **«14 con testigo» cuando eran 12.** Dos paréntesis que contenían `` `:229` `` —una coordenada
   abreviada, no un símbolo— se contaban como testigo. Eso **regala cobertura**: el ancla quedaba
   «comprobada» contra un número de línea.

3. **Y el tercero no lo cacé yo: lo cazó SCRUM-710b**, con la lección que este mismo guard
   predica. Mi congelado guardaba 165 identidades `documento#ruta:LÍNEA` — anclaje por POSICIÓN,
   exactamente lo que ese guard prohíbe. También me cazó dos coordenadas escritas a mano dentro
   de mi propio control. **La suite salió en rojo con 2 fallos**, los dos míos, y los dos se
   arreglaron en mi código: nunca en el guard (regla 41 del máster, `docs/YAQU_MASTER.md`).
   El otro fallo era de redacción: escribí «la regla 41 **del** revés» y SCRUM-189 lo leyó como
   una cita numerada que no nombra su documento. Tenía razón: ahora lo nombra.

> 🔒 Los dos primeros los cacé por **mirar la lista, no el contador**. Un «171 de 285» que se
> acepta sin abrir es el mismo error que este guard existe para impedir. Y el tercero lo cacé
> porque la tanda se corrió ENTERA y con la salida a fichero: con `| tail` el código de salida
> habría sido el de la tubería —0— y el rojo no habría existido para mí (SCRUM-850).

## 7 · Lo NO tocado

El **contenido** de la auditoría (salvo 6a, ordenado) · `src/` · el camino de emisión (regla 38) ·
`prisma/schema.prisma` (leído, no modificado — regla 40) · los 3 ficheros con citas rotas de otros
documentos · ningún estado ni flag (27) · ninguna dependencia (36). **Nada ejecutado contra
producción ni contra staging.**

---

# SCRUM-525 · APÉNDICE d · 16-sep-2026 · Faltaba la otra mitad del trinquete, y la vio el fundador

**Medido contra:** `origin/main` = `5135683049a0d002f9aea5efdf13fd9ba837b280` · 2026-09-16T10:05:32Z
**Rama:** `scrum-525c-anclas-que-apuntan` · **Carril:** documentación + guard · **Gate:** sin gate

---

## 1 · 🔴 LA PREGUNTA QUE NO CONTESTÉ, Y LA RESPUESTA ES «NO ESTABA»

El encargo pedía **trinquete sobre la proporción con testigo** (12 de 195). Yo entregué «cero
umbrales escritos a mano, 13 comparaciones todas contra `0`» —que es cierto— **como si eso cubriera
esta mitad. No la cubre.** El fundador lo leyó y preguntó si estaba o no estaba.

**Medido antes de contestar**, en vez de repasar el código de memoria: la auditoría cita
`selladoEstado.ts` **dos veces**, una con testigo y otra sin, así que su par ya estaba congelado en
la lista de «sin testigo». **Quitarle el testigo a `sellarTrasEmision` no ponía nada rojo.**

> 🔒 Mi trinquete sólo vigilaba el lado que CRECE. La forma barata de apagar un rojo de «esta ancla
> no apunta a lo que dice» seguía siendo **borrar el testigo**: el ancla deja de ser comprobable, el
> guard calla, y el documento queda peor que antes con mejor cara.

## 2 · Puesto — y por IDENTIDAD, que es más fuerte que una proporción

`TESTIGOS_PUESTOS` en `scripts/_anclas-sin-testigo.congelado.mjs`: **12 triples**
`documento # ruta # testigo`, un conjunto que **sólo puede CRECER**.

* **La identidad es el símbolo, no su línea** (SCRUM-710b): mover la coordenada no toca esta lista;
  quitar el símbolo, sí.
* **No es un trinquete de proporción, es de cobertura.** Una proporción se mantiene quitando un
  testigo aquí y poniendo otro allá, y eso no es lo mismo.
* **Con su mutación**, porque un trinquete sin prueba de que sabe dispararse es una declaración de
  intenciones: se borra un testigo real sobre una copia y se exige que su triple desaparezca, con la
  sustitución comprobada. El guard pasa de 7 a **8 tests**.

## 3 · ⓪ El caso 1, cerrado con una línea

Rótulo de la fila 1: «Puerta de emisión **(usuario y admin)**», conservando las **dos** coordenadas.
Decisión del fundador —documentación interna de auditoría, no microcopy de producto—, así que no
hay ticket aparte y lo anotado en el apéndice c queda resuelto aquí.

## 4 · Lo que el fundador corrigió de su propio instrumento

Su plantilla de OBLIGACIÓN 0 usaba `refs/heads/scrum-<n>(-|$)`, que **no casa las ramas de fase**
(`scrum-525b`). Llevaba semanas devolviendo cero sobre las ramas que más usamos. Corregido a
`([^0-9]|$)`.

> 🔒 **Un cero producido por un criterio que no alcanza al caso no es un veredicto: es la forma del
> criterio.** Es la misma lección que este ticket lleva tres tandas midiendo, en otra superficie.

## 5 · Lo NO tocado

El contenido de la auditoría · `src/` · el camino de emisión (regla 38) · `prisma/schema.prisma`
(leído, no modificado — regla 40) · ningún estado ni flag (27) · ninguna dependencia (36).
**Nada ejecutado contra producción ni contra staging.**
