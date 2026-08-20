# SCRUM-566 · `SIF_SPEC_NOTES.md` era un plan sin marca de estado

**Medido contra:** `origin/main` = `164d092dc8e955aa1b01ce254133a24553ce91d9` · 2026-08-20T19:40:00+01:00

> ⚠️ Esa hora es la del trabajo de esta rama, no una lectura de reloj — criterio R14.

**Alcance:** una marca de estado aplicada, un censo entregado, y **un guard que se propone NO
construir, con el número delante.** No se ha reescrito contenido técnico ni se ha borrado ninguna
frase: el defecto era que no se sabía qué eran, no que estuvieran.

---

## El defecto, en una línea

> «`SIF_SPEC_NOTES.md` no dice en ninguna parte que el envío NO ESTÁ CONSTRUIDO. Es un plan sin
> marca de estado, y por eso se lee igual antes y después de construirlo.»

Es la misma puerta por la que entraron las 19 falsas del máster (SCRUM-528) y la del `description`
de la skill (SCRUM-538): **un documento correcto sobre lo que se va a hacer, leído por alguien que
busca lo que hay.**

## La marca: cabecera + etiqueta por sección

Las dos, y cada una hace un trabajo distinto:

- **La cabecera** contesta la pregunta antes de que nadie lea una línea: *«Es un PLAN y una SPEC.
  NO es una descripción de lo que YaQu tiene construido. Hoy no existe el envío a la AEAT»*, con
  la coordenada de la auditoría que lo mide.
- **La etiqueta por sección** hace falta porque el documento **mezcla las tres cosas**: §5 describe
  algo que SÍ existe (la huella, con su vector oficial en verde) y §6 el stack de un fichero que
  no existe. Una cabecera sola dejaría a §5 marcada como plan, que es falso en la otra dirección.

| etiqueta | significa |
|---|---|
| **[NORMA]** | lo que la AEAT exige. Cierto hoy, y no depende de nosotros. |
| **[EXISTE]** | construido y en el repo. Verificable en el código ahora mismo. |
| **[SE HARÁ]** | diseño y decisiones tomadas. **Todavía no está.** |

Y la cabecera cierra el caso del que añade una sección nueva sin pensarlo: *«si no lleva etiqueta,
trátala como [SE HARÁ] y ponle la suya»* — el defecto por omisión cae del lado seguro.

### Dónde estaban las cuatro C, y qué las cubre ahora

| C | dónde | qué la cubre |
|---|---|---|
| «la cola `VfSubmission` **debe** persistir» | §4 | aviso de sección: «describe un envío que TODAVÍA NO EXISTE» |
| «**Diseñar** el cron de la cola» | §4 | idem |
| «Mapea limpio a **nuestra** FSM» | §4 | idem, con «léase [SE HARÁ]: esa cola no está en el esquema» |
| «**Cola:** tabla `VfSubmission {…}`» | §6 | **[SE HARÁ]** + «`sif.client.ts` NO EXISTE» |

---

## El censo: **1 de 50**, y ése es el número que decide

Derivado, sobre `docs/` y `docs/legal/`. `docs/master/` queda fuera: son entradas de trabajo, ya
llevan su ancla de medición y su fecha.

**Criterio declarado**, porque decide el número: un documento tiene el defecto si (a) tiene **señal
de plan** —describe algo que se va a hacer— y (b) **no tiene marca de estado** —no dice qué parte
todavía no existe—.

| | |
|---|---|
| Documentos censados | **50** |
| Con señal de plan | **17** |
| 🔴 Con plan y **sin** marca de estado | **1** — `SIF_SPEC_NOTES.md` |

**Calibración con dos casos de respuesta conocida** (medidos en SCRUM-538): `SIF_SPEC_NOTES.md`
sale ✔ y `AUDITORIA_RRSIF.md` —que está limpio— **no** sale ✔.

> ⚠️ **El censo dio 4 antes de verificarlos, y TRES ERAN FALSOS POSITIVOS.** `DECLARACION_RESPONSABLE.md`
> («PLANTILLA», «NO publicar hasta»), `SPRINT_DEMO_READY_EXT3.md` («📌 ESTADO DE EJECUCIÓN»,
> «Olas 1-9 completadas ✅») y `SPRINT_DEMO_READY_EXT.md` **sí marcan su estado**, con vocabulario
> que mi lista no cubría. Se amplió la lista y el número bajó a 1.
> **Si hubiera reportado los 4 sin abrirlos, habría propuesto una convención sobre un número
> inflado cuatro veces.**

## La propuesta: **NO construir el guard del punto 4**

El ticket lo dejaba condicionado a que fueran muchos. **Son 1 de 50, y de los 17 documentos con
señal de plan, 16 ya marcan su estado.** La convención existe de facto; lo que falló fue un
documento, no la práctica.

Y el argumento que más pesa es mi propia medición: **el criterio automático dio 3 falsos positivos
de 4.** Un guard con ese criterio habría dado **tres rojos falsos el primer día** sobre documentos
que están bien — y un rojo permanente es el que el segundo que lo ve desactiva (SCRUM-559).

**Lo que sí queda**, y es más barato que un guard:

1. La cabecera de `SIF_SPEC_NOTES.md` **es la convención escrita**, con su tabla de tres etiquetas
   y la regla de qué hacer si falta una. Sirve de modelo copiable.
2. Si el fundador quiere elevarla a norma del repo, el sitio natural es `docs/METODO_YAQU.md` o
   `CLAUDE.md`. **No lo he tocado**: elevar una convención es decisión suya, y `YAQU_MASTER.md`
   está bloqueado por el guard de SCRUM-273.

**Si algún día aparece un tercero o un cuarto, el guard se paga solo y este censo ya está escrito
para repetirlo.** Hoy no.

## Verificación

- **Control positivo:** `AUDITORIA_RRSIF.md` **no** se denuncia — es la mitad de la calibración
  del censo, no una comprobación aparte.
- **Suelo:** el censo no devuelve cero (encuentra 1 de 50, y ve 17 con señal de plan). Si hubiera
  dado cero habría que haber declarado ceguera: sabemos que hay al menos uno.
- **Rojo por el mecanismo:** no aplica, **y se dice con esas palabras** — la verificación lo pedía
  *«si construyes el guard del punto 4»*, y la propuesta medida es no construirlo.

---

# Remate (20-ago-2026) · la marca pasa a NORMA ESCRITA, y sigue sin haber guard

> ⚠️ **Lo de arriba se escribió antes de la decisión y se deja como estaba** (el rastro vale más
> que la coherencia): decía *«no lo he tocado: elevar una convención es decisión suya»*. **Ya la
> ha tomado.** Lo que sigue es lo que cambia a partir de aquí.

## Las dos decisiones son del fundador, no mías

1. **La marca de estado pasa a norma escrita del repo** — `[NORMA]` / `[EXISTE]` / `[SE HARÁ]`,
   con la regla de omisión («sin etiqueta = `[SE HARÁ]`») adoptada tal cual porque el defecto por
   omisión cae del lado seguro.
2. **No se construye el guard.** El argumento aceptado es la medición: el criterio automático dio
   falsos positivos, y un rojo permanente es el que el segundo que lo ve desactiva (SCRUM-559).

Y la tensión entre las dos la nombró él: **una norma sin mecanismo es lo que llevamos toda la
semana cerrando.** La salida no es reabrir el guard descartado, sino que la norma sea **barata de
cumplir** y esté **donde se lee**. Eso es lo que decide el sitio.

## Dónde va: `CLAUDE.md` de la raíz — y los tres candidatos se midieron

| candidato | medición | veredicto |
|---|---|---|
| **`CLAUDE.md` (raíz)** | se carga **íntegro** en toda sesión sin que nadie lo invoque · y `cerebro-yaqu:12` ya manda leerlo como **paso 1** del arranque | ✅ **elegido** |
| `AGENTS.md` | **fosilizado**, medido abajo | ❌ |
| skill `cerebro-yaqu` | de una skill lo que se carga siempre es el **`description`** (una línea) — el cuerpo, al invocarla; es justo lo que hizo rentable el `description` en SCRUM-538. Además tiene cambio **sin mergear** (rama `scrum-565-encargo-completo`) con un test que sujeta sus piezas: tocarla desde otra rama es conflicto seguro | ❌ |

### ⚠️ Hallazgo, se reporta y NO se arregla (regla 9, otro carril): `AGENTS.md` está fosilizado

Es la copia para Codex de `CLAUDE.md`, y de cuatro afirmaciones contrastadas contra su gemelo
vivo, **tres están desactualizadas**: «deploy = push a `main`» (main está protegida), «`.env`
apunta a PROD» (contradice el registro medido del 10-ago, SCRUM-418) y «una tarea → un commit →
push» (hoy es rama + PR con merge humano). La cuarta, `npx prisma migrate diff`, aparece en
**los dos** — pero en `CLAUDE.md` como **prohibición** y en `AGENTS.md` como **instrucción**. Y
nombra `src/integrations/` … `Codex`, que no existe: el fichero real es `claude.ts`, renombrado
por una sustitución automática. **Escribir la norma ahí sería escribirla donde nadie la mantiene.**

## El punto que me tocaba: qué se hace con el vocabulario que ya se usa

Las dos salidas valían. **Se acepta el vocabulario en uso como marca válida**, y las tres
etiquetas quedan como forma canónica **sólo para documentos nuevos**. Tres razones, y la primera
es un número:

1. **El vocabulario vivo es más ancho que cualquier lista.** Mi criterio automático dio **cuatro
   falsos positivos de cinco candidatos**: `DECLARACION_RESPONSABLE.md` («PLANTILLA», «NO publicar
   hasta»), `SPRINT_DEMO_READY_EXT3.md` y `SPRINT_DEMO_READY_EXT.md` («ESTADO DE EJECUCIÓN»,
   «completadas ✅»), y el cuarto apareció al re-medir: **`docs/master/SCRUM-308.md`**, que es una
   caracterización del presente («qué hace **HOY**») y marca lo suyo con **«EN DISCUSIÓN / NO está
   bendecido»**. Cuatro vocabularios distintos, ninguno en mi lista.
2. **Unificar obligaría a una pasada masiva** sobre documentos que ya cumplen — prohibida en el
   encargo, y sin víctima que la justifique.
3. Por eso la norma **exige el EFECTO, no las palabras**: que quien busca *lo que hay* no pueda
   confundirlo con *lo que habrá*. Las formas en uso se citan por su nombre para que nadie las
   tome por incumplimiento.

## El suelo del encargo: se re-midió, y el censo de 50 estaba bien contado

| | |
|---|---|
| `.md` bajo `docs/` **incluyendo `docs/master/`** (contra `origin/main`) | **302** |
| con señal de plan | **31** |
| candidatos sin marca | **2** — y uno (`SCRUM-308.md`) es falso positivo |
| 🔴 **con el defecto de verdad** | **1** — `SIF_SPEC_NOTES.md` |

**Y mi razón para excluir `docs/master/` era una afirmación, así que se comprobó:** de las **252**
entradas, **0 sin ancla de medición ni fecha**. La exclusión se sostiene, y ampliar la población a
302 no mueve el veredicto: **sigue siendo 1 real**, ahora sobre seis veces más documentos.

## Verificación

- 🔴 **El control que decide** — los **cuatro** falsos positivos salen **conformes SIN TOCARLOS**.
  Y el verificador **no puede hacer trampa**: el vocabulario **se extrae del texto de la norma tal
  como quedó en `CLAUDE.md`**, no de una lista escrita en el script — que sólo mediría mi memoria.
  Si la norma dejara fuera una marca viva, el rojo saldría contra la norma.
- ✅ **Control positivo** — los **31** documentos con señal de plan cumplen la norma: **0 quedan
  fuera.**
- 🔴 **Control negativo** — un documento inventado con señal de plan y **sin marca ninguna** sale
  **NO CONFORME**. Sin esto, los dos verdes de arriba no probarían nada.

## ⚠️ Y un verde mío que medía la mitad equivocada

Antes de commitear comprobé el CRLF **del blob** —`CR: 0 ✅`, dos veces— y di el fichero por
limpio. **El guard de SCRUM-533 tumbó la tanda igual:** él mira el **DISCO**, y `CLAUDE.md` estaba
en CRLF (146) desde antes de que yo lo abriera, por `core.autocrlf=true`. Venía de fuera, pero al
tocarlo pasa a viajar en mi commit, y su mensaje explica por qué importa: al mergear, un fichero
en CRLF contra una rama en LF conflicta **entero** (`quotesView.js`, 5.144 líneas).

**La comprobación no era falsa: era incompleta**, y las dos mitades no son la misma —blob y disco
pueden discrepar justo aquí. Se arregló quitando los CR byte a byte y verificando con
`Buffer.compare(disco, blob) === 0`. Queda escrito porque el guard hizo exactamente lo que se le
pide: cazar al que se conformó con el verde que tenía a mano.

## Lo que queda fuera, dicho

- **No se construye el guard.** Y la norma **lo dice en su propio texto**: *«NO HAY GUARD: esto se
  cumple LEYENDO. El CI no vigila esto.»* Escrito, no implícito — figurar como cobertura sin serlo
  es el defecto de SCRUM-522.
- **`YAQU_MASTER.md` no se toca** (guard de SCRUM-273). Si la norma debe subir de `CLAUDE.md` al
  máster —que es su sitio natural por la regla 35, ya que `CLAUDE.md` es derivado— **es del
  fundador**. Queda anotado aquí para que no se pierda.
- **`AGENTS.md` no se arregla**: otro carril.
- **No se ha reetiquetado ningún documento.** Cero pasadas masivas.
