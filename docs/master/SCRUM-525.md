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
