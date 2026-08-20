# SCRUM-538 · Corregir las skills — el árbitro, la contradicción con el CI, y los dos documentos sin inventariar

**Medido contra:** `origin/main` = `164d092dc8e955aa1b01ce254133a24553ce91d9` · 2026-08-20T18:30:00+01:00

> ⚠️ Esa hora es la del trabajo de esta rama, no una lectura de reloj — criterio R14.

**Alcance:** dos skills corregidas, un guard nuevo, y el punto 4 cerrado. **El árbitro se
propone y NO se decide** (lo decide el fundador). No se toca `impeccable`, ni el copy, ni el
guion H2 —que es SCRUM-534—, ni `DECLARACION_RESPONSABLE.md`.

---

## PASO 0 — cuatro de los siete puntos ya estaban hechos

Medido byte a byte con `Buffer.indexOf`, no con `includes()`:

| punto | estado |
|---|---|
| 1 · el `description` con «cola VfSubmission, envío AEAT» | ✅ ya corregido |
| 3 · las cinco clase A de `yaqu-verifactu-sif` (`:26-27`, `:28-29`, `:30-31`, `:47`, `:49`) | ✅ ya corregidas |
| 3f · `yaqu-release-check:47` | ✅ ya corregido |
| 6 · la skill `verifactu` es la v2 | ✅ ya lo era |
| **2 · el árbitro** | 🔴 vivo |
| **5 · `docs/CLAUDE.md`** | 🔴 vivo |
| **★ · `cerebro-yaqu:48`** | 🔴 vivo |
| **4 · los dos documentos sin inventariar** | 🔴 vivo |

> ⚠️ **Un fallo de mi propio medidor, y casi me hace rehacer trabajo ajeno.** Etiqueté el punto 6
> con la **polaridad invertida** —encontrar «61 afirmaciones» ahí es *bueno*, no malo— y además
> busqué la frase entera cuando en el fichero está **partida por un salto de línea**. Lo cazó el
> segundo instrumento (`grep`) al contradecir al primero. Un solo instrumento habría cerrado el
> punto 6 como pendiente y habría reescrito una skill que ya estaba bien.

## ★ La contradicción que estaba viva: la skill mandaba lo que el CI rechaza

`cerebro-yaqu:48` ordenaba escribir la entrada en `YAQU_MASTER.md` — **exactamente lo que el
guard de SCRUM-273 bloquea en CI**. No es hipotético: costó un PR en rojo el 17-ago con la
entrada ya escrita.

Es la misma familia que SCRUM-532: **dos mecanismos correctos que juntos abren un hueco.** Ahora
manda a `docs/master/SCRUM-<n>.md` y cita `npm run guards:entrada`.

## 2 · El árbitro — propuesta, y se PARA

Queda escrito en la skill **por qué el máster no puede arbitrar**, con el número delante: el
inventario de **SCRUM-528** midió **61 afirmaciones** y encontró **19 falsas**, y la zona con más
era el propio máster — incluido el guion H2, que la regla 26 declara la única respuesta
autorizada ante un cliente. **Mandar a desempatar allí es mandar a la fuente menos fiable.**

**Mientras no haya decisión**, para un hecho medible gana **el código** (el arbitraje que fijó el
fundador, y el que ya aplica `_guard-afirmacion-fiscal.mjs`). Si el choque no es sobre un hecho
medible: se para y se pregunta.

| candidato | aporta | le falta |
|---|---|---|
| `AUDITORIA_CAMINO_EMISION.md` | qué existe hoy, con fichero y línea | es una foto con fecha: caduca al construir |
| el **código** | no caduca y no puede mentir | no responde de proceso ni de decisión |
| `INVENTARIO_AFIRMACIONES_VERIFACTU.md` | qué NO creerse | no es lo mismo que decir qué es cierto |

**Decide el fundador.**

---

## 4 · Los dos documentos que estaban «NO MEDIDOS»

Leídos **enteros** (178 líneas), no barridos. Criterio de clasificación: el de SCRUM-528.

### `docs/AUDITORIA_RRSIF.md` (77 líneas) — 🟢 LIMPIO

Es una **auditoría de lo ya construido**, con veredictos ✅/❌ y prueba: el vector oficial de la
AEAT pasa en `tests/verifactu.test.mjs`. Todo lo que afirma —huella, QR, leyenda— **existe**
(eslabones 4 y 6 de SCRUM-525).

**Y reconoce por sí solo lo que falta**, que es lo que lo hace fiable: *«no se remitirán nunca a
la AEAT»*, *«NO es aún el payload de remisión»*, *«Registros de ANULACIÓN: no implementados»*.

- **Clase A: 0 · B: 0 · C: 1 · D: el resto.**
- La única C: `:27` — *«la remisión empieza post-SIF con `SIF_ENABLED`»*, que se lee como que la
  bandera gobierna una remisión. Es la familia de A4/A5 del máster: hoy la bandera sólo viaja en
  el sobre de auditoría. **Está atenuada** por el contexto («post-SIF»), y por eso es C y no A.

### `docs/SIF_SPEC_NOTES.md` (101 líneas) — 🟡 ES UN PLAN, Y AHÍ ESTÁ SU RIESGO

El aviso era razonable —promete «endpoints» y «flujo de control», el vocabulario exacto de las
falsas— pero **la lectura completa lo desmiente en parte**: casi todo el documento describe **lo
que la AEAT exige**, no lo que YaQu tiene. Describir la spec es correcto.

**Clase A: 0 · B: 0 · C: 4 · D: el resto.** Las cuatro C, todas por la misma razón —se leen como
estado y son diseño futuro—:

| línea | texto | por qué C |
|---|---|---|
| `:51-52` | «La cola `VfSubmission` del máster **debe** persistir/respetar este valor» | prescriptivo, pero da la cola por existente |
| `:57` | «**Diseñar** el cron de la cola con periodo ≤60 s» | diseño futuro |
| `:63-64` | «Mapea limpio a **nuestra** FSM `VfSubmission`» | «nuestra» afirma posesión de algo que no existe |
| `:86-88` | «**Cola:** tabla `VfSubmission {…}` + FSM de la Parte L» | dentro de «Stack elegido para `sif.client.ts` (S1-D)», un fichero que no existe |

> 🔴 **El defecto real no es ninguna frase suelta: es que el documento no dice EN NINGUNA PARTE
> que el envío no está construido.** Es un plan sin marca de estado, y por eso se lee igual antes
> y después de construirlo. Sus marcas de fase (S1-0b, S1-D, «elegido», «diseñar») lo salvan para
> quien las conozca; para quien llegue buscando qué hay, no.
>
> **No se corrige aquí**: es contenido técnico con dueño (S1-0b) y su enmienda es otro ticket.
> Queda inventariado, que es lo que este punto pedía.

**Total de los dos: 0 de clase A, 0 de B, 5 de C.** El aviso de que `SIF_SPEC_NOTES.md` era
«probable clase A» **no se confirma**: lo que tiene es ambigüedad de plan, no afirmación falsa.

### El suelo de este censo

No devuelve cero: encuentra **5 afirmaciones de clase C** y 178 líneas leídas en dos documentos.
Si hubiera devuelto cero, habría que haber declarado ceguera — «están limpios» y «no supe
mirarlos» son el mismo resultado con significados opuestos.

---

## El guard nuevo: ninguna skill nombra un fichero que no existe

`tests/scrum538-skills-no-prometen-ficheros.test.mjs` (4 tests). SCRUM-242 ya lo hacía para los
**scripts**; las skills no entraban, y son la zona con **peor mecanismo de entrega**: un documento
espera a que alguien lo abra, una skill se entrega a cada sesión sin que nadie la pida.

🔴 **Y cazó algo que el PASO 0 no vio:** `yaqu-verifactu-sif:91` seguía nombrando
`docs/VERIFACTU_EVIDENCIAS.md`. Mi búsqueda iba por la frase vieja, ya reescrita; **la ruta seguía
en otro contexto**. Buscar por frase no encuentra lo que buscar por ruta sí.

⚠️ **Nombrar no es prometer**, y esa excepción la trajo un **falso positivo de este mismo guard**:
esa línea 91 cita el fichero **para decir que no existe** — es el arreglo, no el defecto.
Denunciarlo obligaría a borrar la advertencia para callar el guard, y el documento inexistente
volvería a citarse como si existiera dentro de seis meses. La excepción va **probada en las dos
direcciones**.

`impeccable` queda fuera del recorrido, y se dice por qué: es de terceros y está gobernada por
hash en `skills-lock.json`.

## Lo que no se toca, con su motivo

- **Las tres C del guion H2** — se arreglan arreglando el H2 (SCRUM-534, del fundador).
- **`impeccable`** — rompería la verificación por hash.
- **El árbitro** — se propone, no se decide.
- **Clase B = 0** — ya descartado en SCRUM-536: las nueve menciones de la familia de la firma
  dicen lo contrario de lo que esa clase castiga.
