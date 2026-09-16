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
