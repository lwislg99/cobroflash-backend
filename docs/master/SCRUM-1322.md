# SCRUM-1322 · el bot entiende la palabra que pide, y sólo decide el mensaje que ENTERO es una decisión

**Medido contra:** `origin/main` = `e9e71cab67574538943cd94392bdecf5f3dcbfa2` · 2026-10-01T03:31:48+02:00 (J2b, equipo de Javier)

A9: comprobación → `tests/scrum1322-el-bot-entiende-lo-que-pide.test.mjs`

**Decisión:** del orquestador del equipo de Javier (`cobroflash-backend-5b`), por mensaje entre
sesiones el 1-oct-2026, a la medición de abajo: «ADELANTE con lo del ④, el arreglo entero. No lo
recortes», con dos condiciones (la cortesía, lista blanca enumerada entera en el test; y las frases
medidas, población del test una por una). No es firma del fundador ni la necesita: no cambia ningún
texto, ningún estado ni ningún envío. El orquestador se lo sube a Javier como aviso.

## Lo primero que pedía el ticket: ¿el botón manda «Acepto»?

**No.** Leído en el código; a Meta no se llega desde aquí.

- `quote_decision_es` lleva UN botón y es de URL («Ver presupuesto» → `/pay/quote/<token>`):
  `src/integrations/whatsappTemplates.ts` lo manda con `sub_type: 'url'`. En ventana abierta el botón
  es «Ver y firmar», también URL (`sendQuote.service.ts`).
- Un botón de plantilla llega como `type: 'button'` y va a `handleTemplateButtonReply`; uno
  interactivo llega como `listReplyId`. **Ninguno pasa por `parseDecision`.**

El camino principal (enlace → página → firmar) no usa esta función. Lo roto era el secundario: el
cliente que contesta ESCRIBIENDO, con exactamente un presupuesto en `sent`.

## Qué pasaba, medido

La función compilada de `main`, ejecutada sobre 87 entradas (el instrumento distingue: «hola»,
«gracias», «nota», «noche», «casino» → `unknown`):

1. **Lo del ticket (J6), confirmado.** `Acepto`, `acepto`, `ACEPTO`, `Acepto.`, `*Acepto*`, `aceptar`,
   `rechazo`, `cancelar`, `confirmo` → `unknown`. La expresión cerraba con `\b` detrás de la raíz.
2. **Una segunda causa, que no estaba en el ticket.** `sí` con tilde → `unknown`, y no por la raíz:
   sin modo unicode, `\b` no ve frontera detrás de «í».
3. **Y lo que cambió el tamaño.** La expresión no estaba anclada: buscaba la palabra en cualquier
   parte del mensaje. **18 frases de 18 que no son una decisión movían el presupuesto:**
   - lo **rechazaban** (10): «no sé», «no se», «no entiendo», «no me llega el enlace», «no puedo
     abrirlo», «ahora no puedo, luego te digo», «por qué no incluye el IVA?», «no lo veo», «todavía
     no lo he mirado», «si no hay mas remedio»;
   - lo **aceptaban** (8) —y creaban el Trabajo, y le decían al profesional «aceptó el presupuesto»—:
     «quiero saber si incluye IVA», «si pago en efectivo hay descuento?», «vale cuanto?», «cuanto
     sale el metro?», «va con IVA?», «claro que es caro», «ok pero me lo tengo que pensar», «me
     interesa pero es caro».

El control ④ del ticket («no sé» no puede leerse como rechazo) no era un riesgo del arreglo: **ya
fallaba en `main`.**

**La población que pedía el ①:** el bot pide escribir **4** palabras en todo `src/` («Acepto» y «No»
en un único literal; «cancelar» y «a domicilio» en `botFlow.service.ts`). No entendía **1** de las 4:
«Acepto». Las otras dos se midieron ejecutando sus propias expresiones (`CANCEL_RE`, `NO_ZONE_RE`): sí.

## Qué cambia

- `parseDecision` sale de `whatsappIncoming.routes.ts` a `src/modules/whatsappBot/domain/decisionPorTexto.ts`,
  módulo puro. Ningún catálogo de `tests/` ni de `scripts/` la nombraba (grep antes de moverla).
- **La regla:** el mensaje se parte en palabras y CADA una tiene que estar en una de tres listas
  cerradas — `ACEPTA`, `RECHAZA`, `CORTESIA`. Una palabra fuera de las tres, las dos direcciones a la
  vez, o un signo de pregunta → `unknown`. Se compara sin tildes y sin mayúsculas; la puntuación parte
  el mensaje en tramos y una entrada de varias palabras no cruza de tramo («no, acepto» son dos cosas,
  «no acepto» es una).
- `unknown` es el camino que ya existía: con el bot apagado repite la instrucción con el enlace; con
  el bot encendido lo atiende el menú. **No mueve el presupuesto.**
- **Ningún texto cambia** (regla 39), ningún estado, ningún envío nuevo (regla 28). Lo único que
  cambia es CUÁNDO se disparan `accepted` y `rejected`.

**Coste declarado:** frases que antes se daban por decisión dejan de serlo. «ok pero me lo tengo que
pensar» ya no acepta: vuelve a preguntar. Es a propósito.

## Las tres listas, enteras

Son cerradas, y el test las enumera completas: añadir una entrada es cambiar el test a propósito.

- **`ACEPTA` (30):** las formas de «acepto» y «confirmo», «si», y lo que ya se entendía suelto antes
  (`ok`, `vale`, `dale`, `perfecto`, `de acuerdo`, `me interesa`, `quiero`, `listo`, `va`, `sale`,
  `claro`…, raíces sueltas incluidas).
- **`RECHAZA` (23):** `no`, las formas de «rechazo» y «cancelo», lo que ya se entendía suelto, y las
  que niegan una palabra de aceptar, ENTERAS: `no acepto`, `no me interesa`, `no quiero`, `claro que no`.
- **`CORTESIA` (4), lista blanca, cada una con su motivo en el módulo:** `gracias`, `muchas gracias`,
  `hola`, `por favor`. Sola no decide. Es lo ÚNICO que puede acompañar a una decisión; ni «muchas»,
  ni «por», ni «favor» entran sueltas.

## Cómo se comprobó

`tests/scrum1322-el-bot-entiende-lo-que-pide.test.mjs` — 11 casos, sin BD ni red. La función de
`dist/` y, por efecto, la ruta real del webhook con dobles en `require.cache` (mensaje firmado, POST
de verdad).

- 🔴 **Rojo primero**, con la función vieja movida tal cual al módulo nuevo: caen 10 de 11 (pasa
  sólo el control negativo). Por efecto: «Acepto» no acepta, y «no sé» deja el presupuesto en
  `rejected`. Con el arreglo: 11 de 11.
- Las dos palabras que el bot pide **se leen de su literal** en la ruta, no se copian en el test; si
  la instrucción cambia de forma, el caso cae por CIEGO en vez de quedarse verde.
- Las 18 frases, una por una y nombradas → `unknown`. Los cinco controles («hola», «gracias», «nota»,
  «noche», «casino») → `unknown`. El positivo completo: 44 que aceptan y 27 que rechazan.
- Por efecto: «no sé», «va con IVA?», «no me llega el enlace», «ok pero me lo tengo que pensar» y
  «aceptaría si me bajas el precio» → cero cambios en el presupuesto, cero avisos al profesional, y
  el cliente recibe la instrucción (control de que el mensaje sí se procesó).
- **10 mutaciones, 10 caen** (`tests/banco-scrum1322/mutar.mjs`, un build entero por mutación, base
  verde antes y árbol limpio después). A la primera pasada cayeron 8 y **2 salieron MUDAS**:
  - *sin quitar las tildes*: muda porque partir por la tilde y quitarla dan lo mismo cuando la tilde
    va al final («sí»). Faltaba el caso que las separa: una tilde en medio («vále»). Añadido.
  - *la ruta decide por su cuenta si ve «acept»*: muda porque ningún caso por efecto llevaba «acept»
    dentro de una frase que no decide. Añadido «aceptaría si me bajas el precio».
- **Tanda dirigida, no la completa:** 198 ficheros de los 1.140 de `tests/` (los que nombran el
  webhook o el bot, los de microcopy, los de `docs/master/` y los guards de suite: 237, 976, 377,
  1294, 267, 273, 649, 850) → 1.778 casos, 1.765 pasan, **0 fallos**, 13 saltos (todos gateados por
  una base: `QA_DB_TEST`, `LIBRO_PG_URL`, `SERIE_PG_URL`, y uno por no poder crear un enlace a
  fichero en Windows). `npm run guards:entrada`: 12 guards, 112 casos, verde. **La tanda completa
  no se ha corrido en local: la corre CI.**

## Lo que NO se ha medido, y lo que queda fuera

- **Meta.** Que el botón de la plantilla es de URL está leído en el código que la envía, no en el
  administrador de plantillas.
- **Producción.** Cuántas veces una frase así movió un presupuesto real no se ha mirado: no se toca
  ninguna base.
- **`ok`, `vale`, `perfecto`, `listo`, `claro` sueltas siguen ACEPTANDO.** Ya lo hacían, y el control
  positivo del ticket pide que sigan. Pero un cliente que contesta «vale» a un presupuesto puede estar
  diciendo «recibido», no «acepto». Es una pregunta de producto, no de esta función: se deja dicha.
- **`NO_ZONE_RE` de `botFlow.service.ts` tiene el mismo `\b` detrás de «é»:** «no sé» con tilde no
  casa y «no se» sí. Sin víctima hoy (`isValidZone` lo acepta por su segunda rama). No se toca.
- **La frase «…Te avisaremos con los siguientes pasos»** a un cliente dado de baja (segunda parte del
  ticket) es texto: firma del fundador. No se arregla aquí.

## Errores propios (A9)

- Conté **17** frases y eran **18**: di el número a ojo sobre la tabla y me dejé «no lo veo». Así
  salió en el primer mensaje al orquestador y en el comentario 17685 de Jira. La comprobación es el
  propio test: las frases van en dos listas y el caso exige que sumen 18, una por una.
- Llamé al módulo `decisionDelCliente.ts` antes de mirar si el nombre existía: existe, en
  `src/modules/quotes/domain/` (SCRUM-1276). Lo destapó el grep de catálogos que pidió el orquestador,
  antes de comitear. Se llama `decisionPorTexto.ts`.
- Escribí la tilde combinatoria con `\u` y aterrizó como el carácter literal, invisible (A22). Lo
  cacé contando bytes antes de compilar; en el test va con `String.fromCharCode`.
- Exporté las tres listas sólo para que el test las leyera, y metí `typescript` por `require_`
  dentro de una función. Los dos los cazó la tanda dirigida antes de empujar, y no yo:
  `scrum411` (un `export` cuyo único consumidor de fuera es su test es un huérfano) y `scrum775`
  (un suelo que el censo no sabe leer). Arreglado en el código, no en los guards: las listas no se
  exportan y el test las lee del fuente por AST, con `typescript` importado arriba.
