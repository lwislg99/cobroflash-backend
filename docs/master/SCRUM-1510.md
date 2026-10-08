# SCRUM-1510 · Los cuatro puntos ciegos de `scrum205`: cuántos están llenos hoy, y quién más los mira

**Medido contra:** `origin/main` = `c1bad3c34e5ac6379d2b7fadd9615fd5d2b5d189` · 2026-10-08T01:36:55Z (hora de GitHub)

A9: comprobación → `.claude/hooks/guard-dangerous.sh`

Sesión J6 (`jv-j6`, relevo, 8-oct), por encargo del orquestador de Javier (`cobroflash-backend-90`):
**medir y proponer**. Sólo `docs/`: dos guiones, sus salidas y este registro. Cero líneas de `src/`,
cero de `tests/`. `scrum205` no se ha tocado, ni el camino de emisión. Al escribir esto `origin/main`
iba por `8518dc7a16164530863d657cb0f2f817a4691d78`: entre los dos, 0 ficheros de `src/` y 0 de los
cinco tests nombrados abajo (sólo `docs/`).

El hook de arranque dijo «SIN IDENTIDAD» (no reconoce `jv-j6`; es SCRUM-1498, carril de S5). Seguí por
la norma común del 8-oct, y queda dicho.

## Pregunta ① · ¿Cuántos llamadores de la puerta escapan HOY al punto ciego ③?

**CERO por alias y CERO por «recojo el resultado y no le hago caso». El punto ciego existe y está
vacío.** Guion: `evidencias/SCRUM-1510/censo-escapes-de-la-puerta.mjs` · salida al lado.

| | hoy |
| --- | --- |
| ficheros `.ts` de `src/` leídos | 321 |
| el nombre de la puerta como identificador | 21 = 1 declaración + 8 imports + 1 tipo + **11 llamadas** |
| llamadas directas (lo que ve `scrum205 ③`) | 11 en 8 ficheros |
| valor sin llamar (semilla de alias) | 0 |
| import renombrado · llamadas por otro nombre | 0 · 0 |
| módulo traído sin nombrar (espacio de nombres, `require`, `import()`, `export *`) | 0 |
| re-exportada desde otro fichero · el nombre como cadena | 0 · 0 |
| recogen el resultado y no lo leen | 0 |
| recogen, producen bytes y no pasan por portero | 0 |

**Los dos controles, corridos antes de fiarse del número.**
A cero: el mismo censo con un nombre derivado que no puede estar en el árbol (lleva el sha256 de
`src/`) da 0 en todo, **con 321 ficheros leídos**. Positivo: la declaración sale 1 vez; las 11
llamadas en 8 ficheros son las que leyó la medición anterior (se lee de su salida, no se escribe); y
**cinco siembras sobre un espejo de `src/` dentro de `dist/` —alias, import renombrado, recoger y no
leer, leer y entregar igual, espacio de nombres— las ve las cinco**. Árbol de verdad: huella sha256
de los 321 ficheros igual antes y después.

**De las 11, qué hacen con lo que devuelve la puerta** (el censo lo clasifica; lo que hace cada
condición lo he leído a mano, fichero y línea):

- 2 lo tiran (`jobs.routes.ts:1596`, `quotes.routes.ts:681`): son las dos que `scrum205` ya cuenta
  en su tope. Ninguna produce bytes.
- 4 cambian lo que pasa después: `lib/invoicing.ts:241`, `quotesAdmin.routes.ts:388` (contesta 409),
  `reintentoSellado.ts:289` y `recapitulativa.service.ts:145`.
- 5 **sólo lo cuentan en la respuesta** (201 con la marca; 3 además eligen el mensaje):
  `albaranes.routes.ts:1340` y `:1618`, `invoicesAdmin.routes.ts:208` y `:1121`,
  `quotesAdmin.routes.ts:653`. Ninguna produce bytes en su función.

Sólo una de las 11 vive en una función que produce bytes (`lib/invoicing.ts:241`), y pasa por portero.

**El hueco del doble inyectable:** la propiedad `sellar` (`reintentoSellado.ts:232`) se llama en 1
sitio de `src/` (`:288`) y **no la rellena nadie en `src/`**: 0. Hoy sólo la usan los tests.

**Lo que este censo NO mide.** Es sintáctico, fichero a fichero: no usa el comprobador de tipos. No
sigue la indirección de una función que llama a la puerta y a la que otro llama y descarta (el
«descarte un piso más arriba»): eso no lo he censado. Y «hacer caso» lo he decidido leyendo 9
sitios, no con una regla.

## Pregunta ③ · ¿Hay otro test de la tanda que cace esos cuatro?

**Sí para tres de los cuatro, por mecanismos distintos y ninguno completo. Para el ② no, entre los
candidatos.** Guion: `evidencias/SCRUM-1510/otros-tests-por-efecto.mjs` · salidas al lado (dos
pasadas; la segunda lleva lo que dice cada rojo).

Medido **por efecto**: cada punto ciego se siembra en un espejo (fuente `.ts` **y** compilado `.js`)
y se corren los tests que tocan el concepto. Población buscada por concepto (13 nombres: la puerta,
el estado, el predicado, el portero, la acción, quien produce el PDF…), más los que llegan por un
ayudante: **70 ficheros de 1.292, 603 casos, 586 pasan, 0 caen, 17 SALTAN** sin sembrar nada.
Controles: la búsqueda con un nombre que no existe da 0 sobre 1.292 leídos; el propio `scrum205`
está entre los 70; y **una siembra ruidosa (la que `scrum205 ①` sí caza) lo tumba**: el corredor ve
rojos. `scrum205` sale MUDO en las seis siembras ciegas, como se predijo.

| punto ciego, sembrado en | ¿cae otro? | quién, y qué dice |
| --- | --- | --- |
| ① fallo devuelve «sellado», el nombre en un comentario | **SÍ, 1** | `scrum1296-emitir-encola`: ejecuta la puerta con un sellado que falla y exige el estado que devuelve |
| ② quien genera el PDF deja de preguntar al predicado | **NO, 0 de 69** | — |
| ③ alias + tirar + entregar, en el reintento | SÍ, 2 | `scrum206 (b)`: «consumidor NUEVO de `ensureInvoicePdf`» · `scrum1404b`: 5 casos, ninguno nombra la propiedad |
| ③bis leer + entregar igual, en el reintento | SÍ, 2 | los mismos dos (`scrum1404b`: 2 casos) |
| ③ alias + tirar + entregar, en una ruta (`invoicesAdmin`) | SÍ, 3 | `scrum205-un-solo-punto` y `scrum206b`: «llamada a `emitInvoice` que NO SELLA» · `scrum346`: 500 en vez de 201 |
| ③bis recoger + entregar sin mirar, en esa ruta | SÍ, 1 | sólo `scrum346`: 500 en vez de 201 |

**Cómo leerlo, que es donde está el resultado:**

- **①** lo cubre `scrum1296` **por el destino**: no lee texto, ejecuta la puerta compilada. Es un
  control de ceguera de otro caso (línea 162), no un test puesto para esto, y prueba UNA causa de
  fallo (factura sin líneas).
- **③ y ③bis** los cubre `scrum206 (b)` **sin mirar la puerta**: tiene una lista cerrada de los 4
  ficheros que llaman a `ensureInvoicePdf`. Un fichero NUEVO que entregue salta, lo llame por alias o
  no. **Lo que no cubre: los 4 que ya están en su lista** (en la ruta sembrada, que es uno de ellos,
  sale mudo).
- **③ en la ruta** lo cazan `scrum205-un-solo-punto` y `scrum206b` **por el mismo punto ciego, del
  revés**: buscan la puerta por su nombre, no ven el alias y dicen «no sella». Sólo porque la siembra
  QUITÓ la llamada con nombre. Con las dos (la de nombre y la de alias) **no lo he medido**.
- `scrum1404b` y `scrum346` caen porque la siembra rompe la pasada o la ruta bajo sus dobles. Su
  mensaje no nombra la propiedad. **No he abierto por qué exactamente**, y no los cuento como
  cobertura.
- **El hueco que queda, cruzando las tres:** recoger el resultado y entregar sin mirarlo **dentro de
  un fichero que ya consume `ensureInvoicePdf`**. De los 4, sólo `invoicesAdmin.routes.ts` llama a
  la puerta. Ahí sólo saltó un test de comportamiento, por tropiezo.
- **②** no lo mira nadie de los 70. Que no es agujero por comportamiento (lo para el segundo portón)
  lo midió la sesión anterior; yo no lo he repetido.

**Lo que NO se midió.** Los otros 1.222 ficheros de la tanda: no nombran el concepto y no se han
corrido. Los 17 casos que saltan (12 ficheros, los que piden base). Sólo se sembró
`ensureInvoicePdf`; **los otros dos productores de bytes que lista `scrum205` (`generateInvoicePdf`,
`createReadStream`) no**. Una siembra por punto y sitio: otra redacción del mismo defecto puede dar
otro resultado. La tanda completa, no. Nada en yaqu.app, staging ni producción.

## Pregunta ② del ticket · ¿Se puede medir la afirmación ① sin texto?

**Sí, y ya hay una prueba de que se puede en la tanda:** `scrum1296-emitir-encola`, línea 162,
ejecuta la puerta compilada con un sellado que falla y compara el estado que DEVUELVE. Sembrado el
punto ciego ①, cae; `scrum205 ①` no. No he construido nada: es de quien lleve SCRUM-205. Dos
límites de esa prueba tal como está: compara con el literal y no con la constante, y depende de
`dist/` — que es justo lo que la cabecera de `scrum205 ②` dice que quiso evitar.

## Para la decisión ④ (que no es de una sesión)

Baja la prioridad: ③ y ③bis están vacíos hoy, y entre `scrum206 (b)`, `scrum205-un-solo-punto` y
`scrum1296` queda sin vigilar un solo sitio concreto, no una clase. Lo que sigue sin estar escrito
es la cabecera de `scrum205`, que promete más de lo que mide.

## Mis errores

- Un parche pasado por heredoc de bash se comió las barras invertidas de una expresión regular: el
  guion no arrancó (error de sintaxis, visible). Lo reescribí con la herramienta de edición.
- Esa pasada fallida dejó una salida de 0 bytes en el árbol, y al ir a pisarla me paró el hook dos
  veces. La segunda vez comprobé que tenía 0 bytes y añadí en vez de truncar. Es el mismo tropiezo
  que declaró mi antecesora; la línea `A9:` apunta al hook que lo paró.
- La primera versión del censo llamaba «decide» a devolver el valor en la respuesta. Leyendo los
  sitios vi que 5 de 9 sólo lo cuentan; cambié la etiqueta y lo escribí arriba.

# SCRUM-1510b · El punto ciego ②: la factura pendiente que el segundo portón deja pasar EXISTE, y ya tiene test

**Medido contra:** `origin/main` = `16e80dea496dad3819bf444983f9974d3c13ebb9` · 2026-10-08T07:41:39Z (hora de GitHub)

A9: comprobación → `tests/scrum1510b-pendiente-que-el-porton-dejaria-pasar.test.mjs`

Sesión J6 (`jv-j6`, relevo de la mañana del 8-oct), por encargo del orquestador de Javier
(`cobroflash-backend-90`). Carril: J6 (instrumentos), ticket `area-j6`. Un test nuevo, dos guiones y
sus salidas. Cero líneas de `src/`. No se han tocado `scrum205`, `scrum206`, `scrum1296` ni ningún
censo. El hook de arranque dijo «SIN IDENTIDAD» (SCRUM-1498, carril de S5); seguí por la norma común.

## La pregunta que quedó sin comprobar, y su respuesta

`ensureInvoicePdf` tiene dos cortes: el del ESTADO (`lib/invoicing.ts:61`) y el portón de la HUELLA
(`:104`). Mi antecesora propuso un test sobre «una factura pendiente a la que el segundo portón
dejaría pasar» y declaró que no había comprobado que esa factura pudiera existir.

**Puede existir. Fabricadas cuatro**, con `sellarTrasEmision`, `applyVeriFactu` y `ensureInvoicePdf`
de `dist/`; sólo la base va doblada, y lo único que se le hace es que una escritura concreta falle.
Ningún campo de la fila se escribe a mano.

| caso | cómo se llega | fila que queda | 1er corte | 2º portón |
|---|---|---|---|---|
| A (control) | factura ES, sin fallo | `sellado`, con huella | pasa | pasa |
| B (control) | el sellado revienta antes de la huella | pendiente, sin huella | niega | niega |
| C | la huella se escribe y la escritura siguiente, la del estado, falla | pendiente, CON huella | niega | **pasa** |
| D | justificante `J-`: la escritura de «no aplica» falla (la puerta LANZA) | pendiente, sin huella | niega | **pasa** |
| E | comercio no español: lo mismo | pendiente, sin huella | niega | **pasa** |
| F | justificante al que no llega a llamarse la puerta | pendiente, sin huella | niega | **pasa** |

Sobre el compilado de hoy, las cinco pendientes se niegan con `invoice_pendiente_de_sellado`, sin
escrituras y sin PDF; sólo A produce PDF (6.538 B). **Sobre un espejo del compilado sin el primer
corte, de C, D, E y F sale un PDF de verdad** (6.489, 5.154, 5.078 y 5.069 B, los cuatro empiezan
por `%PDF-`) y se escribe `pdfUrl`; B sigue negada, ahora por el portón. El espejo vive en
`dist/__espejo-1510b/`; `src/lib/invoicing.ts`, su compilado y `selladoEstado.ts` son iguales por
sha256 antes y después.

**El primer corte no es redundante.** Y C no es un caso de papel: el propio reintento ya la nombra
(`conHuellaSinMarcar`, `reintentoSellado.ts:258`), la cuenta y no la arregla; y su registro no se
ha encolado para la AEAT (0 escrituras en `vfSubmission`, comprobado en el test).

Por qué D, E y F son posibles: **toda factura nace pendiente**. `estadoAlNacer` sólo aparece en su
declaración (1 aparición en el código de 321 ficheros `.ts`; la misma búsqueda ve 3 de
`entraEnLaCadena`), así que el estado de nacimiento es el `@default` del esquema, y «no aplica» se
escribe después, en otra llamada.

## El test

`tests/scrum1510b-pendiente-que-el-porton-dejaria-pasar.test.mjs`, vecino de `scrum206`. Tres casos:
el POSITIVO (la misma factura, sellada entera, sí deja PDF en disco y `pdfUrl` escrito) y las dos
negaciones, C y D. Cada negación comprueba antes que el portón de la huella, preguntado de verdad,
dejaría pasar esa fila; y exige que `ensureInvoicePdf` se niegue, con el error del corte del estado,
sin escrituras y sin fichero.

**Visto en rojo antes que en verde.** Sobre el espejo: 3 casos, pasa 1 (el positivo), caen 2, y el
mensaje dice «SALIÓ EL DOCUMENTO». Sobre hoy: 3 de 3.

**El doble de los vecinos no sirve tal cual**, comprobado leyéndolos: el de `scrum206` hace reventar
`$transaction`, así que no deja escribir la huella; el de `scrum1296` falla por `modelo.método`
entero, y aquí hace falta que falle UNA escritura de `invoice.update` y no la anterior. El test
lleva el suyo, calcado del de `scrum1296` con el fallo por argumento.

## Lo que NO se midió

Que alguna de esas filas exista en una base de verdad: las cuatro piden un fallo entre dos
escrituras, o que el proceso muera entre el commit y el sellado, y aquí se provoca. Nada contra
dev, staging ni producción. Sólo `ensureInvoicePdf`: los otros dos productores de bytes
(`generateInvoicePdf` suelto, `createReadStream`) no. Una factura pendiente con el PDF ya en disco
(la rama en la que el portón de la huella ni se ejecuta) tampoco. No he declarado la mutación al
instrumento de mutaciones: el rojo de arriba es de una pasada a mano, no un control permanente.
La tanda completa, no.

## De paso, sin tocar (no es de este carril)

- El error del primer corte no lo reconoce `esErrorSinSellar` (medido: `false` en las cinco
  pendientes; sobre el espejo, el del portón sí). `GET /recibo/:token/pdf` sólo ramifica por esa
  función. **Leído, no ejecutado:** una factura pendiente daría ahí un 500 y no el 409 con el texto
  firmado de SCRUM-206. `tests/scrum206` no lo ve porque su fila no lleva `vfEstado`.
- `sellarTrasEmision` LANZA si falla la escritura de «no aplica» (está fuera de su `try`), aunque su
  cabecera dice que no lanza.

## Mis errores

- La primera pasada «en rojo» era ciega: el espejo no llevaba `prisma/schema.prisma`, el fichero
  murió al cargar y la salida decía «tests 1 · fail 1». Lo vi por el recuento (1 y no 3), añadí el
  esquema al espejo y repetí. El caso POSITIVO del test es lo que distingue las dos cosas.
- Avisé del contexto con 252.971 medidos, no a los 200k: lo medí tarde.
- El primer montaje del espejo intentó copiar `dist/` dentro de sí mismo y node se negó.

## Ficheros

- `tests/scrum1510b-pendiente-que-el-porton-dejaria-pasar.test.mjs`
- `docs/master/evidencias/SCRUM-1510/fabricar-la-factura-del-segundo-porton.mjs` y sus dos salidas
- `docs/master/evidencias/SCRUM-1510/espejo-sin-el-primer-corte.mjs` y `salida-montar-el-espejo.txt`
- `docs/master/evidencias/SCRUM-1510/salida-test-en-rojo-sobre-el-espejo.txt` y `salida-test-en-verde-sobre-hoy.txt`
