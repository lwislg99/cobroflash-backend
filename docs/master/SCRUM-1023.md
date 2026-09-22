# SCRUM-1023 · Preguntas para asesores externos, agrupadas por especialista y listas para enviar

**Fecha:** 22-sep-2026 · **Carril:** legal / J4 · **Gate:** sin gate — no se corrige ni se envía nada
**Medido contra:** `origin/main` = `b8e3f81a61344f5cfa94184be9e31c45c1270cdd` · 2026-09-22T08:43:12Z

## Encargo

Javier, literal, 22-sep-2026: *"también quiero listadas todas las preguntas o consultas que hay que
hacer a asesores externos para trabajarlas."* La materia prima es `docs/legal/PREGUNTAS_ASESOR.md`
(835 líneas, 28 preguntas numeradas + 5 sub-preguntas del bloque 21 + P11-P17), que sigue siendo el
expediente técnico (fichero, línea y medición detrás de cada pregunta). Faltaba convertirlo en algo
que se le pueda mandar a un asesor tal cual.

## Entrega

`docs/legal/PREGUNTAS_ASESOR_POR_ESPECIALISTA.md` (nuevo). Reorganiza el expediente en **23
preguntas de envío**, agrupadas por a quién se le preguntan — no por su número original:

- **15 fiscales** (AEAT/IVA/VeriFactu) — F1 es la más urgente de todo el documento (P14 del
  original: ¿"fabrica o comercializa" ya YaQu un sistema de facturación, art. 201 bis LGT?).
- **5 mercantiles/societarias** (contratos, ToS, consumo, presupuesto adicional).
- **3 de protección de datos** (supresión de profesional, supresión de cliente final, revisión de
  privacidad/cookies).

Cada una lleva: el enunciado sin jerga de código ("para el asesor"), qué desbloquea (ticket o pieza
del producto), y qué pasa si no se contesta. Dentro de cada especialista, ordenadas por lo que
desbloquean — no por número.

**Tres se sacan de la lista** porque no necesitan asesor (se dice por qué, en vez de mandarlas
igual): el coste/plazo de la revisión fiscal (es logística de la cita), una pregunta de producto que
depende de otra ya contestada, y la elección de modelo de representación ante la AEAT — que Javier ya
decidió el 16-sep-2026 (colaborador social); lo que falta del asesor es solo confirmar el trámite, no
elegir de nuevo.

**Un hallazgo cruzado con el trabajo de hoy mismo (SCRUM-534h):** la pregunta M3 (revisión del
alcance legal de la oferta Founding) manda a revisar `docs/legal/ALCANCE_BETA.md`, que cita
literalmente "se activa al cerrar la certificación" — la misma frase que el censo de SCRUM-534h de
hoy propone corregir porque no existe una "certificación" de VeriFactu. Se avisa en la propia
pregunta: si se manda al asesor antes de que esa corrección esté firmada, puede estar revisando una
frase que ya sabemos que hay que cambiar.

## SCRUM-143, dicho por Javier hoy — no se ha vuelto a buscar la respuesta de julio

Instrucción literal de Javier: *"no te preocupes, lo vuelvo a preguntar"* sobre si el Convenio 017 de
la AEAT exige sociedad mercantil. Esta sesión NO ha gastado tiempo buscando la respuesta de julio: la
pregunta entra en la lista (F3) como pendiente y se sigue.

## Lo que NO cubre esta entrada

* No contesta ninguna pregunta — ni siquiera las que esta sesión cree saber. El valor del documento
  es ser la lista.
* No envía nada a ningún asesor: eso lo hace un jefe (regla de puesto de J4).
* No aplica la corrección de "certificación" que menciona en el cruce con SCRUM-534h — eso vive en
  esa ficha, propuesto y sin aplicar, a la espera de firma verificable.
* No vuelve a medir el expediente técnico original (`PREGUNTAS_ASESOR.md`): se usa tal como está.
