# SCRUM-1399 · CRUCE DE CARRIL (`area-j1`, lo hace J5c) · Tras una anulación, el guion de pruebas nombraba como «registro anterior» una serie que no es de ningún registro

**Medido contra:** `origin/main` = `35e1060e365a4cc11f16e4ccee393581679e73d9` · 2026-10-02T05:54:23Z

A9: comprobación → `tests/scrum1399-el-anterior-de-una-anulacion.test.mjs`

2-oct-2026 · **J5c** (puesto J5, equipo de Javier), por encargo del orquestador (`cobroflash-backend-5b`).
El ticket es de `area-j1`. El orquestador lo repartió fuera de carril porque J1 estaba con SCRUM-1252, y
lo declaró en el encargo. El hallazgo es de **J1a**, que lo dejó escrito en `docs/master/SCRUM-1398.md`
sin arreglarlo.

## En corto

- **Ningún envío a la AEAT.** No se ha generado ningún sobre para enviar, no se ha tocado ningún
  certificado y no se ha leído ni tocado el `tmp/` de ningún árbol que no sea una copia desechable.
- El primer paso del ticket —buscar si ya constaba una respuesta de la AEAT a un registro posterior a una
  anulación— sale **negativo**: no consta (sección ①).
- Se arregla el guion (`scripts/sobre-soap-prueba-aeat.mjs`), con el rojo visto antes (sección ②).
- Qué hace la AEAT con un «registro anterior» mal identificado sigue **sin medir**. Con el arreglo deja de
  hacer falta medirlo para la tanda de S1-D: el guion ya no lo produce.

## Por qué importa

El Done de S1-D (`docs/YAQU_MASTER.md`, Parte U, U1.3) pide ≥10 registros —alta, anulación y R1—
aceptados consecutivos. Esa tanda se envía a mano con este guion, y los sobres posteriores a una anulación
eran exactamente los que salían mal. Si la AEAT valida la identificación del registro anterior, la tanda
se habría rechazado y el rechazo habría parecido del producto cuando era del guion. Los códigos con los
que llegaría ese rechazo están en la sección ①.

La prioridad de tener VeriFactu listo para cuando llegue el certificado de la empresa la transmite el
orquestador en el encargo y en el ticket. Aquí no se cita como palabra del fundador: esta sesión no se la
oyó.

## ① ¿Constaba ya una respuesta de la AEAT a un registro posterior a una anulación? No

Medido por esta sesión el 2-oct-2026, leyendo Jira y el repositorio. No se envió nada.

**En Jira.** Cinco búsquedas por texto (que alcanzan descripciones y comentarios) y ocho tickets leídos
enteros, comentarios incluidos:

| ticket | comentarios | qué respuesta de la AEAT recoge |
|---|---|---|
| SCRUM-1110 | 1 (16732) | siete envíos del 24-sep, todos de **alta**; el séptimo, «Correcto» |
| SCRUM-1140 | 0 | ninguna: es el ticket que añadió anulación y R1 al guion, y dice «NO probado contra la AEAT» |
| SCRUM-1211 | 1 (17334) | dos **altas** del 28-sep (la sonda de colisión) y un duplicado con error 3000 |
| SCRUM-1127 | 5 | ninguna nueva: cita los CSV de las altas |
| SCRUM-1296 | 3 | ninguna nueva: cita los CSV de las altas |
| SCRUM-1319 | 0 | ninguna nueva: «3 CSV aceptados», los tres de alta |
| SCRUM-1398 | 2 | ninguna nueva: transcribe el 17334 |
| SCRUM-1399 | 0 al cogerlo | — |

- Control positivo del lector: el mismo que da «0 comentarios» en SCRUM-1140 saca el 17334 de SCRUM-1211.
- Los tres identificadores que nombra el ticket (`963853`, `921981`, `970375`) salen en tres tickets y en
  ninguno más: SCRUM-1211, SCRUM-1398 y SCRUM-1399. De la R1 `PRUEBA-AEAT-963853` sigue sin haber rastro
  de envío ni de respuesta.
- La búsqueda de anulación junto a una respuesta (`CSV`, `Correcto`, `AceptadoConErrores`,
  `EstadoRegistro`, desde el 24-sep) da 11 tickets; ninguno recoge una respuesta a una anulación.

**En el repositorio.** Los CSV con forma de la AEAT que hay en `docs/`, `scripts/` y `tests/` son seis
distintos: cinco reales (`A-KR84MFNPTPDHMN`, `A-RRC3W7HBRRATXM`, `A-RWSKNNRGRBNNS9`, `A-SAQQXM7MXBDX3L`,
`A-ALQ5VMP5QV7QLQ`) y uno de mentira que usan los tests (`A-FALSO000000001`). Los cinco reales son de
**altas**.

**Lo que sale de ahí:** de lo que consta, la AEAT no ha contestado nunca a una anulación de YaQu, ni
aceptándola ni rechazándola. Por tanto tampoco a un registro posterior a una. El `[VALIDAR]` de la huella
de anulación que SCRUM-1140 dejó dicho sigue abierto por el mismo motivo.

**Lo que NO se miró, y limita ese «no consta»:**

- La búsqueda de Jira es por palabras. Una respuesta pegada como imagen, o contada sin ninguna de las
  palabras buscadas, no la encuentra.
- De la búsqueda ancha (50 tickets en la primera página, y había más páginas, todas anteriores al
  27-jul-2026 y por tanto anteriores al guion) sólo se leyeron enteros los ocho de la tabla. SCRUM-1225 y
  SCRUM-1228 salen en la ancha y no en la de anulaciones: no se abrieron.
- El `tmp/` del árbol compartido no se ha leído (límite del encargo). Que «hubo anulaciones antes ese
  mismo día» lo dice el ticket por los punteros que leyó J1a; esta sesión no lo ha comprobado.
- Lo que el fundador viera en su navegador y nadie escribiera.

**La fuente primaria que sí está en el repositorio, y hasta dónde llega.**
`docs/legal/fuentes/aeat-errores.properties` (253 líneas; es el catálogo de errores de la AEAT, y su
último commit es de SCRUM-201b, del 29-jul-2026) tiene códigos propios para este bloque. Literales:

- `1174` — «El valor del campo FechaExpedicionFactura del bloque RegistroAnteriores incorrecto.»
- `1175` — «El valor del campo NumSerieFactura del bloque RegistroAnterior es incorrecto.»
- `1269` — «El bloque Registro Anterior no esta informado correctamente.»
- `1180` — «Error en el bloque de Encadenamiento.»

El catálogo dice que esos rechazos existen. **No dice cuándo saltan**: si «incorrecto» es de formato o es
«no corresponde a ningún registro que la AEAT tenga». Ninguna línea del catálogo habla de un registro
anterior que no exista o no conste (buscadas `anterior`, `encadenam`, `huella` y `primer`: 21 líneas, con
el 2007 entre ellas; control aparte, el 3000 y el 2004, que también salen). Así que la pregunta del ticket no se contesta leyendo, y sólo se contesta
enviando. Lo que sí deja el catálogo es el nombre del síntoma: si en una tanda un registro posterior a una
anulación vuelve con 1174, 1175 o 1269, lo primero que hay que mirar es el puntero del guion.

## ② El arreglo

### El defecto, visto antes de tocar nada

El guion guarda en `tmp/ultimo-registro.json` lo que el sobre siguiente escribirá en su
`RegistroAnterior`. Guardaba `SERIE` y `FECHA` —la serie y la fecha de la pasada— para los tres tipos. Un
alta y una R1 se identifican por su propia serie. Una anulación no tiene serie propia: se identifica por
la factura que anula (`NumSerieFacturaAnulada` y su fecha).

El test nuevo, corrido sobre el guion de `origin/main` sin tocar (blob
`b781339c4a503995c8e6aabfd1572325adfd5be4`), commit `f792693b0a23466e61d8653c6f03ffc91d137e6c`:
**5 de 9 caen**. Las líneas del TAP están en `docs/master/evidencias/scrum1399/rojo-antes.txt`.

| caso | antes | qué dijo |
|---|---|---|
| ⓪ la copia aislada carga | pasa | — |
| ① la SERIE del anterior es la de la factura anulada | **cae** | el anterior lleva «NO-ES-DE-NADIE» |
| ② la FECHA del anterior es la de la factura anulada | **cae** | el anterior lleva «15-09-2026» |
| ③ la huella del anterior es la de la anulación | pasa | la huella ya era la buena, como decía el ticket |
| ④ sin banderas, que es como se usa | **cae** | el anterior lleva otra serie de prueba, la de la pasada de la anulación |
| ⑤ anulando una factura señalada con `--serie` y `--fecha` | **cae** | ni la serie ni la fecha son las de esa factura |
| ⑥ tras un alta o una R1 no cambia nada | pasa | — |
| ⑦ un puntero de anulación del guion viejo no se usa | **cae** | salió 0 y generó el sobre |
| ⑧ el `tmp/` del árbol no se mueve | pasa | — |

El caso ④ importa más que el ①: el defecto no dependía de forzar una serie a mano. En el uso normal la
anulación generaba una serie de prueba nueva que no pertenecía a nada, y ésa era la que viajaba.

### Lo que cambia en el guion

Dos sitios de `scripts/sobre-soap-prueba-aeat.mjs`, 29 líneas añadidas y 1 quitada. `src/` no se toca.

1. **Donde se escribe el puntero:** se guarda la identidad del registro. En una anulación, la serie y la
   fecha de la factura anulada; en un alta o una R1, las propias, como antes. La huella no cambia. El
   puntero lleva además un campo `identifica` (`factura-anulada` o `registro`) que dice cuál de las dos
   cosas guardó.
2. **Donde se lee el puntero:** si es de una anulación y no lleva esa marca, lo escribió el guion viejo y
   su serie no identifica nada. El guion **aborta sin escribir**. El puntero vive fuera de git y sobrevive
   al arreglo; sin esta puerta, el primer sobre generado después de actualizar el guion podía repetir el
   defecto entero. Los punteros viejos de alta y de R1 no llevan la marca y siguen valiendo: su serie sí
   es la suya.

Después: **9 de 9**, y los 7 de `tests/scrum1398-la-sonda-de-colision.test.mjs` siguen en verde (16 de
16 en la misma pasada).

### El criterio, y de dónde sale

Que el anterior de una anulación se nombra por la factura anulada lo dice el ticket, y es lo que hace el
camino de emisión: en `src/modules/invoicing/domain/verifactu.service.ts`, la lista `registrosOrdenados`
mete cada anulación con el número y la fecha de **su factura**, y `anulacionPrev` y el alta sacan de ahí
el `RegistroAnterior` buscando por la huella guardada. Eso está **leído, no ejercitado** aquí: no afirmo
que el producto esté bien, afirmo que nombra con el mismo criterio que ahora usa el guion. Tampoco he ido
a la documentación de la AEAT a confirmar el criterio; lo que lo confirmaría de verdad es una respuesta
suya.

### Mutaciones

Cinco, declaradas en `MUTACIONES_QUE_ME_TUMBAN` del test, para que las ejecute el meta-guard del CI. Aquí
se aplicaron a mano con la base primero (9 pasan, 0 caen), sobre el commit
`3afec3c1424e77a9afd57b6d13da72fe6c6e66bd`, comprobando por sha256 que el fichero cambió y que quedó
restaurado, y con el árbol limpio al acabar:

| qué se le hizo al guion | casos que caen (de 9) |
|---|---|
| el puntero vuelve a guardar la serie de la pasada | ①, ④ y ⑤ |
| guarda la serie buena y la fecha de la pasada | ② y ⑤ |
| guarda la huella a la que se encadenó en vez de la propia | ③ y ⑥ |
| trata la R1 como una anulación | ⑥ |
| el puntero del guion viejo vuelve a valer | ⑦ |

El instrumento de esa pasada era efímero y no se sube: leía las declaraciones del test por AST y lo
sustituye el meta-guard.

## Lo que queda fuera, dicho

- **Sin medir contra la AEAT.** Ni el arreglo ni el defecto. Medirlo pide un envío a mano con certificado,
  y sigue en pie la precondición que dejó escrita `docs/master/SCRUM-1398.md`: antes de enviar hay que
  saber qué fue lo último que la AEAT aceptó.
- **El puntero real no se ha mirado.** Si el del árbol compartido fuera de una anulación generada con el
  guion viejo, la próxima generación abortará con el mensaje de SCRUM-1399 en vez de sacar un sobre malo.
  El ticket dice que apunta a una R1; si es así, no aborta.
- **El segundo defecto que J1a dejó en el registro de SCRUM-1398 sigue igual:** una anulación como primer
  registro de la cadena la aborta el propio guion por su control `nifEnEmisor`. No es de este ticket.
- **La identidad del anterior coincide con la del anterior de la propia anulación** cuando se anula la
  última alta: los dos sobres nombran la misma factura y se distinguen por la huella. Es lo que sale del
  criterio; se deja dicho porque a la vista parece una repetición.

## Lo que dije mal

- En la evidencia del rojo escribí que el caso ④ fallaba «por la serie y la fecha». Falla sólo por la
  serie: todo es del mismo día y la fecha coincide. Lo vi al leer el TAP y lo corregí antes de comitear.
- Declaré dos mutaciones con el ancla en una constante compartida. El meta-guard lee las declaraciones por
  AST y sólo entiende literales: las habría dejado fuera sin avisar. Lo corregí antes de correr nada.
- Hice esa corrección con `node -e` desde bash, que es justo lo que el traspaso de este puesto dice que no
  se haga. Esta vez salió bien (comprobado con el diff); no es el camino.

## Qué no se corrió

La tanda completa local no cabe en esta máquina y la dirigida no se corre (decisión del orquestador para
todas las sesiones de hoy). Corridos, en ficheros sueltos: el test del ticket (visto en rojo primero), el
de SCRUM-1398 y los guards de registro y de suite que se nombran en el comentario de entrega del ticket,
más `npm run guards:entrada`. El obligatorio del CI es la pasada entera sobre el merge; lo que compensa el
hueco es leer en él los nueve casos `SCRUM-1399 ·` por nombre.
