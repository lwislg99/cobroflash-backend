# SCRUM-1326 · «Vale» ya no acepta un presupuesto: el bot pregunta

**Medido contra:** `origin/main` = `01d99084936c73ce975d708c31397281ebc1538f` · 2026-10-01T06:31:49Z

1-oct-2026 · **J1g** (equipo de Javier), relevo de J1f.

Lo firmado está en tres comentarios de SCRUM-1326, y **los tres los he abierto en Jira**:

- **17692** («1-Firmo»): el texto de la pregunta y la decisión de que hay palabras que preguntan.
- **17802** («1-Firmo»): el reparto completo, palabra por palabra, que amplía el anterior.
- **17801**: tres decisiones de construcción que toma el orquestador del equipo de Javier.

La orden de construirlo («2-Sí metelo») y la de que sin respuesta el presupuesto se queda en `sent`
**me llegaron por el orquestador** (`cobroflash-backend-5b`); no están escritas en el ticket.

A9: comprobación → `tests/scrum921c-firma-con-respaldo-en-codigo.test.mjs`

## El defecto

Un cliente con un presupuesto enviado contesta «vale» por WhatsApp. El bot lo tomaba como
aceptación: el presupuesto pasaba a `accepted`, se creaba el Trabajo y al profesional se le decía
que su cliente había aceptado. «Vale» puede ser sólo «recibido», y el profesional se presenta en
casa de alguien que no ha dicho que sí.

## El reparto firmado

**Preguntan (8):** `vale` · `ok` · `okay` · `okey` · `perfecto` · `listo` · `claro` · `va`.
Son acuses de recibo. `okay` y `okey` van con `ok`; `va` es «vale» abreviado.

**Aceptan a la primera (9):** `acepto`/`aceptar` · `sí` · `confirmo` · `dale` · `adelante` ·
`de acuerdo` · `me interesa` · `quiero` · `sale`. Son autorizaciones o deseos. `sale` la decidió el
fundador: el orquestador le dijo que no tenía criterio, y él eligió que acepte.

**Las doce que el reparto no nombra, y siguen aceptando.** La lista de aceptar tenía 30 entradas
antes de este ticket; 18 son las del reparto. Las otras 12 son flexiones de palabras que aceptan,
y el criterio firmado las resuelve sin decisión nueva (comentario 17801 y respuesta del
orquestador). Una por una, por si el fundador quiere mover alguna:

`aceptado` · `aceptamos` · `lo acepto` · `acepto el presupuesto` · `confirmar` · `confirmado` ·
`confirmamos` · `lo confirmo` · `lo quiero` · `claro que sí` · y las raíces sueltas `acept` y
`confirm`.

`claro` a secas pregunta; `claro que sí` acepta.

## Lo que se ha construido

- `src/modules/whatsappBot/domain/decisionPorTexto.ts`: una lista nueva, `PREGUNTA`, con las ocho,
  que salen de `ACEPTA`. La función tiene una cuarta respuesta, `ask`. No se ha tocado cómo se
  parte el mensaje en palabras ni cómo se quitan las tildes.
- `src/modules/whatsappBot/app/routes/whatsappIncoming.routes.ts`: con `ask`, el bot contesta con
  el texto firmado y termina. No escribe en el presupuesto ni en ninguna otra tabla.
- `docs/microcopy/2026-10-01-SCRUM-1326-vale-pregunta-una-vez.md`: la ficha del texto.
- `tests/scrum1326-vale-pregunta-una-vez.test.mjs`: 16 casos.
- `tests/scrum1322-el-bot-entiende-lo-que-pide.test.mjs`: cambian sus expectativas sobre las ocho
  palabras, que enumeraba entre las que aceptan; ahora las espera como `ask`. No se ha quitado
  ningún caso.

Sin estado nuevo, sin ALTER, sin envío automático nuevo: la pregunta es la respuesta a un mensaje
del cliente, por el mismo camino y con las mismas exenciones que el «no te entiendo» de al lado.
El camino de emisión fiscal no se toca.

## Tres decisiones de construcción (comentario 17801)

**Los asteriscos se reconstruyen.** El comentario 17692 guarda «Acepto» y «No» en cursiva y sin
asteriscos: Jira se los comió. Van en el código porque el mismo comentario dice que van y porque
al mensaje de «no te entiendo», citado al lado, le pasó lo mismo y en el código los lleva. Es una
reconstrucción, no una copia byte a byte. El hueco, igual: en Jira es `<número>` y en la ficha
`{número}`.

**«Sueltas» es «sin una aceptación clara al lado».** «Vale, gracias», «hola, ok» y «ok perfecto»
preguntan. «Sí, vale» y «vale, acepto» aceptan a la primera. La otra lectura dejaría aceptando a
«vale, gracias», que es la forma más corriente de decir «recibido».

**El segundo «vale» recibe la misma pregunta otra vez.** No se guarda que se preguntó, y por eso
«no contesta» es exactamente `sent`. El orquestador pidió medir si existe un registro de mensajes
salientes del que leer «mi último mensaje fue esa pregunta», porque leerlo no sería un estado
nuevo. **Medido: no existe.** `sendWhatsAppText` (`src/integrations/whatsapp.ts`) sólo registra
sus fallos; un texto que sale bien no deja fila. Y la tabla `WhatsAppMessage` no tiene columna para
el texto ni para qué mensaje era: la pregunta y el «no te entiendo» serían la misma fila. Saberlo
exigiría escribir una marca nueva, que es otro ticket y otra firma. El bucle se queda, con un caso
que lo fija por su nombre.

## Los controles

1. **El rojo, por efecto.** Sobre `main` `01d99084`, con el reparto de cinco: 14 casos, 11 caen
   (`rojo-sobre-main-01d99084.tap.txt`); el primero dice «vale ha movido el presupuesto a
   accepted». Y sobre mi commit `4ed07c5a`, con las tres palabras nuevas: 16 casos, 5 caen
   (`rojo-de-okay-okey-va-sobre-4ed07c5a.tap.txt`); dicen «okay ha movido el presupuesto a
   accepted» y «va ha movido el presupuesto».
2. **El positivo.** Las nueve que aceptan, una por una: `accepted`, Trabajo creado, profesional
   avisado, y la respuesta al cliente no es la pregunta.
3. **`va` y `sale`**, que estaban juntas y van a grupos distintos: un caso por efecto para cada una.
4. **El que no contesta.** Tras la pregunta, la fila del presupuesto es idéntica a la de antes y no
   hay ni una escritura en ninguna tabla. El doble de la base apunta cualquier escritura, también
   en una tabla que no conoce; el control de que apunta de verdad es el «Acepto» siguiente, que deja
   exactamente una.
5. **El texto.** Lo que sale por WhatsApp es la cita de la ficha con el número puesto, letra a
   letra, con `quoteNumber` y con `id` cuando no hay `quoteNumber`; y el número es el mismo que
   pone el «no te entiendo» para ese presupuesto.
6. **Las tildes.** `vále`, `ók`, `perfécto`, `lísto`, `cláro`, `vá`, en carácter compuesto y en
   descompuesto, preguntan; `sí`, `acépto`, `confírmo`, `sále` aceptan; «sí vale» y «vale sí» no se
   pegan. El módulo ya partía las palabras en modo unicode; no se ha tocado.
7. **La lista cerrada.** La de preguntar son las ocho. La de aceptar es exactamente las del reparto
   más las doce flexiones: ni falta ni sobra una, y entre las dos suman las 30 de antes.
8. **Con el bot encendido.** «Vale» sobre un presupuesto enviado pregunta y no pasa por el menú; a
   mitad de la captación de un presupuesto nuevo sigue siendo del bot.

## Medido

Sobre la rama con `main` `eb3d3b367e62e95ca86c217a0a39a32764200075` mezclado dentro (sin
conflictos), con `prisma generate` y build en 0:

- `tests/scrum1326-…`: 16 de 16. `tests/scrum1322-…`: 11 de 11.
- Tanda dirigida: 213 ficheros de 1.159 (los que nombran el webhook, el módulo, la microcopy, los
  envíos de WhatsApp y `docs/master`, más los guards de suite), 1.960 tests, 1.945 pasan, 15
  saltados, 0 caen. Antes de terminar habían caído dos, los dos míos: `scrum854` (faltaba este
  registro) y `scrum921c` (ver «Errores míos»).
- `guards:entrada`: 12 guards, 122 tests, verde.
- Mutaciones (`docs/master/evidencias/scrum1326/mutar.mjs`, resultado en `mutaciones.json`): base
  16 de 16 antes y después; 20 corridas de 20, **las 20 caen**, y `src/` queda limpio al terminar.
  Entre ellas: «vale» vuelve a aceptar; `va` vuelve a aceptar; `okay` acepta mientras `ok`
  pregunta; `sale` pasa a preguntar; una flexión deja de aceptar; todo pregunta, también «Acepto»;
  la pregunta deja una marca en el presupuesto; la pregunta apunta que preguntó en otra tabla; una
  palabra distinta en el texto; sin «Entendido»; sin negritas; avisa también al profesional; sin
  quitar las tildes. Corrieron antes de mezclar `main`.
- La tanda completa y lo que diga CI van en el comentario de entrega del ticket, no aquí.

**Sin medir, dicho:** el texto en un WhatsApp de verdad (aquí sale por un doble: los asteriscos y
el emoji se comprueban como caracteres, no como se pintan en el teléfono); y si
`BOT_INBOUND_ENABLED` está encendido en producción, que no he mirado.

## Errores míos

- Escribí en el test «lo que el fundador firmó» sin decir en qué ticket. `scrum921c` lo cazó en la
  tanda dirigida: una marca de aprobación sin respaldo, y el trinquete pasaba de 28 a 29. Corregido
  nombrando el ticket, el comentario y la ficha. Es la línea `A9:` de arriba.
- Le dije al orquestador «13 formas que el reparto no nombra» y son 12. Lo sumé a ojo y él lo
  repitió. Hoy lo fija un caso: la lista tiene que medir 12 y sumar 30 con las demás.
- La mutación M4 se llamaba «con un rechazo gana el rechazo» y hacía otra cosa: dejaba a «vale»
  sin respuesta. Caía, pero no por lo que decía su nombre. La vi al leer por qué caían ocho casos
  donde esperaba uno; la reescribí para que haga lo que dice.
- Dejé en Jira el «lo coge J1g» diez minutos después de empezar a leer el código, no antes (A13).
- Le pasé a `node` un guion con `\x` escapados por un heredoc de bash y los escapes llegaron
  cambiados. No escribió nada: el guion cuenta sus anclas y se declaró ciego. Lo rehice con la
  herramienta de edición. La trampa ya estaba en las cicatrices de J1.
