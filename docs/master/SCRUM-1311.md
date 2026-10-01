# SCRUM-1311 · Suelo de población propio en `scrum244` «ningún borrado sin filtro» y en nueve bucles más que pasaban con la colección vacía

**Medido contra:** `origin/main` = `e9e71cab67574538943cd94392bdecf5f3dcbfa2` · 2026-10-01T00:51:17Z

A9: comprobación → `tests/scrum244-colgados-de-otro-modelo.test.mjs`

J6 (jv-j6), sobre el censo de J5 (243 bucles sin suelo por forma, 10 de tipo A). Sólo se tocan tests: se
**añade** una aserción a cada uno, no se cambia ninguna de las que había (regla 41). No se toca
`borrarMerchant` ni nada de `src/`.

## Qué se ha hecho

Diez ficheros de test, una aserción «la colección no está vacía» delante de cada bucle. El suelo es
**«mayor que cero», no un número exacto**: decidido en el ticket con la medición de J5, porque un exacto
sobre una población que crece (el recorrido de `borrarMerchant` gana una llamada con cada modelo nuevo)
caduca sin que haya nada que decidir.

## El rojo primero, caso a caso, y la población de hoy

Para cada suelo, tres pasadas del fichero entero, con los bytes restaurados después de cada una (el `git
diff` del árbol tiene el mismo sha256 antes y después de las treinta pasadas):

| test | población hoy | colección vaciada, SIN el suelo | colección vaciada, CON el suelo | cómo se vacía |
| --- | --- | --- | --- | --- |
| `scrum244-colgados` · un charge de otro merchant… | 27 llamadas | 2 fail de 10 (los vecinos) | **3 fail de 10** | el doble sin `count`: el caso real del 1-oct |
| `scrum145-verifactu-xsd` · elementos obligatorios | **1** alternativa | **0 fail de 8** | 1 fail de 8 | la expresión del extractor deja de casar |
| `scrum446-cabecera-modal` · `aria-labelledby` | 3 referencias | **0 fail de 6** | 1 fail de 6 | la expresión deja de casar |
| `scrum652-parte-trabajo` · control negativo del técnico | 3 líneas | **0 fail de 12** | 1 fail de 12 | un parte sin líneas |
| `scrum1155-alta-rediseno` · mapa campo→input | 9 ids | **0 fail de 9** | 1 fail de 9 | el mapa cambia de comillas |
| `scrum534b-documentos-fantasma` · la prosa no exime | **1** fantasma | **0 fail de 10** | 1 fail de 10 | el filtro deja de casar |
| `scrum568-promesa-con-mecanismo` · lo no condicionado | 14 promesas | **0 fail de 12** | 1 fail de 12 | ningún veredicto en el grupo |
| `scrum590b-el-campo-en-la-pantalla` · los dos lados | 2 llamadas | **0 fail de 6** | 1 fail de 6 | la función se renombra |
| `scrum727-constancia-del-vigia` · cero medido | 6 ejecuciones | **0 fail de 9** | 1 fail de 9 | el filtro no deja pasar ninguna |
| `scrum861-firma-por-delegacion` · árbol real | 255 literales | **0 fail de 8** | 1 fail de 8 | los registros llegan sin literales |

En las diez, el rojo nuevo **nombra el suelo** («🔴 CIEGO: …»), no otra cosa.

Control positivo: los diez ficheros juntos, con los suelos y sin mutar, **90 tests · 90 pass · 0 fail · 0
saltados**.

## Lo que la tabla dice, sin inflarlo

- **`scrum244` no era un verde que no mira**: con el doble sin `count`, el FICHERO ya caía (2 de 10) por
  dos vecinos que usan el mismo doble. Lo que faltaba es que el caso tuviera su suelo PROPIO y no
  dependiera de la vecindad. Ahora cae él también, diciendo que no recorrió nada.
- **Los otros nueve sí eran verdes en vacío a nivel de FICHERO**: con la colección vaciada, cero rojos.
  Ninguno tenía vecino que lo cubriera. Eso incluye los seis que clasificaron agentes y nadie había
  re-verificado (`scrum534b`, `scrum568`, `scrum590b`, `scrum727`, `scrum861`, `scrum1155`): los seis quedan
  confirmados **por efecto**, no por lectura.
- **Hoy no hay víctima en ninguno**: las diez poblaciones son mayores que cero.

## Dos suelos que cuelgan de UN solo elemento

`scrum145` (una alternativa en el XSD) y `scrum534b` (un fantasma citado sólo con verbos de escritura)
tienen hoy población **1**.

- El de `scrum145` es estable: es el `choice` NIF | IDOtro del esquema de la AEAT.
- El de `scrum534b` **no**: el día que alguien arregle ese documento, el suelo saltará. No será un fallo
  del producto: será el aviso de que ese control se ha quedado sin caso y hay que rehacerlo con uno
  fabricado. El mensaje dice las dos salidas —si el filtro dejó de casar, se arregla el test; si se
  arregló el documento, se le fabrica un caso— para que quien lo vea saltar no crea que ha roto algo ni
  lo ensanche. Decidido con el orquestador: no se fabrica el caso ahora, porque el día que salte saltará
  con razón.

## Tests que parecen de otro carril — declarado, no medido

Varios de los diez no son del puesto J6, y alguno puede ser del equipo de Luis: por el tema,
`scrum568-promesa-con-mecanismo`, `scrum727-constancia-del-vigia` y `scrum861-firma-por-delegacion`, y
quizá `scrum534b-documentos-fantasma`. **No está medido de quién es cada uno**: el historial de git sólo
da la cuenta de Javier para todos los commits, de los dos equipos. Se han tocado igual por decisión del
orquestador de Javier (1-oct): a cada uno se le AÑADE una aserción y no se le cambia ninguna de las que
tenía, y esperar siete u ocho horas a su dueño por una línea cuesta más que avisarle después. El aviso a
Luis lo traslada Javier.

## Lo que NO se ha hecho

- **`scrum173-cadena-verifactu-serializada`** (el décimo de tipo A del censo) **no lleva suelo**. Su
  colección sale de una consulta a la base y sólo corre con `QA_DB_TEST=1`, contra staging; el CI no lo
  ejecuta. No puedo ver cuántas facturas selladas hay allí ni ver el suelo en rojo y en verde, así que no
  lo escribo a ciegas: en una base recién creada, cero selladas es un estado limpio y el suelo daría un
  rojo falso. Queda para quien tenga el turno de staging.
- **El escáner de J5 no entra en el repositorio**: sigue siendo un instrumento de medida, fuera del árbol.
- **La clase C del censo** (62 constantes de `src`/`scripts` cuyo vaciado no cazaría nadie) no se toca:
  es otra forma y pide su propio ticket.
- **La tanda completa no se ha corrido en local** (SCRUM-1244). Corridos: los diez ficheros tocados y los
  guards de registro y de suite. El veredicto completo es el del CI.

## Reproducir

    node --test --test-force-exit tests/scrum244-colgados-de-otro-modelo.test.mjs     # 10/10

Y el rojo: quitar la línea `count: async () => 0,` del doble `prismaFalso` de ese fichero → 3 fail, uno de
ellos «🔴 CIEGO: `borrarMerchant` no ha hecho NI UNA llamada de borrado».
