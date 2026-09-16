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
