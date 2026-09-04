# SCRUM-710 · `constaAprobado` compara el hecho, no la forma

**Medido contra:** `origin/main` = `9747d16ad1699b57b6738728e938b530d006f1b8` · 2026-09-04T08:28:14+02:00
**Medido en:** host `DESKTOP-T5MONF5` · rama `scrum-710-consta-por-identidad`

**LA VÍCTIMA: quien pregunte si un texto está aprobado y reciba un «sí» que nadie firmó.** El agujero
lo declaré yo al cerrar SCRUM-709 y era peor de lo que dije: no era hipotético. Hay literales
aprobados de dos palabras —«Mano de obra», «Materiales», «Guardar precios», «Precio por unidad»— y
sus trozos aparecen en la prosa del propio registro.

**🔒 UN PREFIJO NO ES UN NOMBRE, Y UNA SUBCADENA TAMPOCO.** Cuarta cara de la misma avería en una
semana: `data-view="parte*"` por prefijo, `window.renderParte` dentro de `renderPartesOficinaView`,
un guard apuntando al alias en vez de a la función, y esta subcadena.

**EL MECANISMO.** No se busca dentro del texto del registro: se **extraen las unidades delimitadas**
en las que el registro escribe un literal y se compara por **identidad**. Los delimitadores se
midieron antes de tocar nada, y no se inventan aquí:

- **celda de la columna «Texto aprobado»** — así están escritas las 18 aprobaciones conocidas del
  registro congelado;
- **línea de cita (`>`)** en `docs/microcopy/` — así lo escribe el mecanismo nuevo.

Y las **citas del congelado NO cuentan**: ese fichero usa `>` para avisos, y aceptarlas convertiría
cada nota en un texto «firmado por el fundador». Hay control para eso.

**ME EQUIVOQUÉ AL ELEGIR EL CASO, Y QUEDA ESCRITO.** El mecanismo viejo buscaba la **consulta dentro
del documento**, así que una frase más larga que el literal —«Materiales del almacén central»— no
colaba: no está escrita en ninguna parte. Lo que colaba era lo contrario, una consulta **corta**.
Mis primeros cuatro casos pasaban con los dos mecanismos y no probaban nada; **lo tumbó mi propio
aserto de discriminación**, que exige que los casos se cuelen con el mecanismo viejo. Los buenos:
`Vuelve a intentarlo` (cola de un literal aprobado), `de obra` (trozo de «Mano de obra»),
`Precio por` (**prefijo** de «Precio por unidad») y `Libro registro` (prosa).

**CONTROL POSITIVO, ENUMERADO:** las **21** aprobaciones conocidas se siguen encontrando **una a
una**, incluidos los cuatro cortos. Apretar el matching **no tiró ninguna**. Si lo hubiera hecho, el
arreglo estaría mal y el aserto lo dice por su nombre en vez de esconderlo.

## El número en prosa: derivado donde podía mentir, intacto donde es historia

**El barrido.** 165 afirmaciones de cantidad sobre marcadores en `tests/`, `docs/`, `scripts/`,
`src/` y `public/`. Casi todas son la justificación de **una entrada concreta** —«se cuenta 1 y son
cinco textos»— y son ciertas y fechadas. Lo que puede envejecer sin que nadie lo note es el **total
global**, y de ésos quedaba **uno vivo**: el suelo del escáner de SCRUM-402, que decía «hay 36
medidos» cuando el censo suma 13. **Ahora se deriva** del censo declarado, que es lo que el propio
trinquete obliga a mantener al día. Un número derivado no puede envejecer.

**Y una distinción que no es la misma para todos los números:** los **suelos de alcance** («>= 100
ficheros leídos», «> 400 leídos») **se escriben a mano a propósito** y NO se derivan — derivarlos
haría que añadir un fichero subiera el listón solo y el suelo no podría caer nunca. Es la lección que
SCRUM-377 dejó escrita en este mismo árbol.

**Los dos números del registro congelado (13 y 38) NO se tocan.** Son historia fechada y eran
ciertos cuando se escribieron; corregirlos falsificaría el registro. El fichero ya avisa de que está
congelado.

## El patrón que se copia

`aprobacionesDeMicrocopy()` queda documentada en `docs/microcopy/README.md`, en una sección dirigida
a **quien vaya a escribir el próximo lector**: usar el buscador compartido en vez de abrir un fichero
por su ruta, comparar por identidad y no por subcadena, y que un barrido vacío se declare ciego.
`tests/scrum654` **no se toca**: es carril ajeno (regla 9) y hoy funciona porque el registro viejo se
conservó entero.

---

# FASE 2 · El número de línea, y las líneas base que chocan (4-sep-2026)

**Medido contra:** `origin/main` = `119484af9d0fdf9f4beb008751a2be86d5179acd` · 2026-09-04T15:04:26+01:00

**Tanda:** **5.099 pruebas · 5.015 en verde · 0 fallos · 84 saltadas** — con `main` mergeado dentro
y medida DESPUÉS del último cambio de código.

> ⚠️ **ESTE FICHERO YA CONTENÍA UNA ENTRADA, Y NO ERA DE ESTE TICKET.** El paso 2 del arranque
> —`git ls-remote --heads origin` en listado COMPLETO— encontró `scrum-710-consta-por-identidad`
> **ya mergeada en main**, con entrada de máster y todo. Paré y lo reporté, que es lo que manda ese
> paso. **La aclaración vino del asesor: ese trabajo es de SCRUM-715** (subcadena → identidad en
> `constaAprobado()`), no de SCRUM-710 — que estaba **abierto y sin empezar**. Ya está avisado a su
> autor.
>
> Lo que **sí** medí antes de seguir, y por eso este apéndice existe: **el anclaje por número de
> línea del censo de SCRUM-622 seguía vivo en `origin/main`**, en el fichero, no supuesto. Este
> ticket no era un duplicado.
>
> La rama se llama `scrum-710b-…` porque se creó cuando aún parecía una segunda fase. El nombre
> se queda: renombrarla exigiría reescribir historia, y eso no se hace.

## PASO 0

**ENTRADA: no hay entrada de usuario.** Esto no está en ninguna pantalla: vive en `tests/` y
`scripts/`. La víctima es **cualquier sesión que edite un fichero vigilado** — me mordió a mí en
SCRUM-599 y costó una vuelta.

**MECANISMO.** El censo de SCRUM-622 ya existía y estaba bien construido: barre el árbol, detecta
por AST las cuatro formas de «red benigna» y compara contra una lista exacta. **Lo único mal era
CÓMO GUARDABA su excepción.** No había que rehacerlo: había que cambiar el anclaje.

## (a) El anclaje por número de línea — ARREGLADO

El censo componía `fichero:LÍNEA  texto` y comparaba **esa cadena entera**. Ahora devuelve `id`
—lo que la red **es**: fichero + expresión— y `linea` **aparte**. Se compara por `id`; la línea va
en el mensaje, para poder ir a mirarla.

**Lo que el guard EXIGE no se ha relajado**: sigue siendo la lista exacta, y dos redes idénticas
dan dos entradas iguales, así que duplicar también cae.

| se prueba | resultado |
|---|---|
| **CONTROL POSITIVO** · 12 líneas por encima (lo que hizo SCRUM-599) | la red pasa de la **532 a la 544** y el guard **SIGUE VERDE** |
| la red **desaparece** | **cae** |
| la red **se duplica** | **cae** |

> Un anclaje que ya no puede caer no es un anclaje: es un `skip`. Por eso los dos negativos.

Y la prosa dejó de fijar el número en otros **dos** sitios del mismo fichero (cabecera y mensaje
de error), que caducaban igual aunque no tumbaran nada.

## El censo de las dos formas — con suelo, y por AST

Barrido de **817 ficheros** de `tests/` y `scripts/`:

| forma | hallados |
|---|---|
| **(a)** anclajes por número de línea | **41** — 25 aparecen como dato, 16 dentro del mensaje de un `assert` |
| **(b)** líneas base con dos o más pares `[texto, número]` en la misma línea física | **3** |

**La clasificación 25/16 va como información y NO decide nada.** Es frágil —la prosa dentro de un
campo `motivo:` sale como «dato»— y colgar un trinquete de un criterio frágil es cómo se acaban
apagando. **Lo que se vigila es el total**, y por identidad (fichero + cita), nunca por posición.

### El primer criterio de (b) daba 323, y era un cajón

Contaba **cualquier** array con dos números en la misma línea: datos de prueba como `[1, 2]`
incluidos. Un número grande y ruidoso no es una medida. Acotado a **pares `[texto, número]`** —que
es lo que el defecto **es**— quedan **3**, y sólo **uno** es una línea base de las que chocan
(`scrum698`, el caso del encargo). Los otros dos son datos de formateo y **se vigilan igual**,
porque el conflicto lo causa la **forma**, no la intención.

### 🔴 El censo se cazaba a sí mismo

La lista declarada `CONOCIDOS_A` **contiene, por necesidad, las mismas citas `fichero:línea` que
vigila**: son literales y el AST las ve como lo que son. Es la naturaleza de un censo declarado, no
un caso raro. Se excluye **sólo** este fichero, con motivo escrito y con un aserto que comprueba
que **la exclusión no crece** — una exclusión que crece deja de ser una excepción y pasa a ser una
lista blanca.

### El trinquete mira en las dos direcciones

Si el número **sube**, cae y nombra los nuevos. Si **baja** —alguien arregló uno— también cae y
pide borrarlos de la lista **en el mismo commit**: una lista que se queda atrás deja de apretar.

## 🔴 LA PROPUESTA PARA (b) — escrita, NO ejecutada

El encargo lo pidió así, y con razón: tocar esas líneas base cruza ficheros que otras sesiones
están editando ahora mismo.

**Forma recomendada: UNA ENTRADA POR LÍNEA.** No un registro por ticket.

```js
//  hoy — dos tickets que suban números distintos chocan sobre la MISMA línea
for (const [vista, nodos] of [['renderQuotesView', 237], ['renderProductsView', 166],
  ['renderCustomersView', 63], ['renderHomeView', 109]]) {

//  propuesto — cada línea base en su línea física
for (const [vista, nodos] of [
  ['renderQuotesView', 237],
  ['renderProductsView', 166],
  ['renderCustomersView', 63],
  ['renderHomeView', 109],
]) {
```

**Por qué ésta y no un registro por ticket:** son **tres** sitios. Un registro nuevo —un fichero
por ticket, como hizo SCRUM-709 con la microcopy— cuesta un mecanismo que hay que mantener, y se
paga cuando hay decenas de escritores concurrentes. Aquí hay tres arrays: **pagar un mecanismo por
tres sitios es pagar de más**, y ese criterio ya está escrito en esta casa.

**Qué se rompe: nada funcional.** Es reformateo puro — mismos elementos, mismo orden, mismos
valores. Los tests que los usan no cambian.

**Qué NO arregla, y hay que decirlo:** si dos tickets tocan **la misma entrada** (los dos suben
`renderCustomersView`), sigue habiendo conflicto. Y **debe haberlo**: ahí sí son cambios sobre lo
mismo y alguien tiene que decidir. Lo que se elimina es el conflicto **falso**, el de dos cambios
independientes que comparten renglón.

**Sitios a tocar: 3 ficheros, 3 arrays.**

| fichero | qué es |
|---|---|
| `tests/scrum698-vistas-que-no-se-miden.test.mjs` | **la línea base de verdad** — la del encargo. La toca S3 ahora mismo |
| `tests/scrum229-margen-en-pie.test.mjs` | datos de formateo |
| `tests/scrum488-un-solo-vocabulario.test.mjs` | datos de formateo |

⚠️ **El primero lo está editando S3.** Ejecutar esto hoy es garantizar el octavo conflicto del día
— exactamente el defecto que viene a cerrar.

## 🔴 EL TRINQUETE NACIÓ HOY Y SU PRIMERA CAPTURA FUE UNA MEJORA

Al mergear main se puso rojo: *«se han ARREGLADO 1 anclajes (bien) y la lista se ha quedado
atrás»* — `tests/scrum514-…  invoicesView.js:172`.

**No era una regresión: era una mejora.** SCRUM-514 se mergeó DESPUÉS de medir los 41, y al
decidirse la grafía de «Nueva factura» su excepción de `APARCADOS` se borró, y con ella la cita.
La lista decía 41 y el árbol tenía 40.

> **Un trinquete que sólo sabe cazar empeoramientos es medio trinquete.** Éste mira en las dos
> direcciones desde el primer día, y la primera vez que apretó fue para decir que la lista se
> había quedado atrás respecto a una limpieza real.

La entrada se **BORRA** —no se pone a cero ni se comenta, convención del censo de SCRUM-402
(precedente SCRUM-424/405)— con quién la retiró y cuándo. Y la cifra baja **41 → 40**
**re-medida sobre el árbol YA MEZCLADO**: contar antes de mezclar me caducó dos mediciones el
mismo día.

⚠️ **40 hallazgos, 39 identidades**, y no falta ninguno: `scrum390` cita la misma posición dos
veces en el mismo fichero. Queda declarado en el propio test, porque ver «39» al lado de un censo
que dice «40» invita a perseguir un fantasma.

## El rojo, probado por el mecanismo — cuatro mutaciones con post-condición

| se rompe a propósito | cae |
|---|---|
| nace un anclaje por línea nuevo | «los anclajes… no crecen», **nombrando `homeView.js:123`** |
| nace una línea base con dos pares en la misma línea | «las líneas base… no crecen» |
| vuelve el número de línea a la comparación de 622 | «el censo de 622 ya NO ancla por número de línea» |
| el detector deja de reconocer la forma | **los dos suelos**, antes de que un cero falso pase por bueno |

Y dos **controles negativos**: una cita en un **comentario** no cuenta —nadie compara contra ella,
y contarla llenaría el censo de ruido hasta que alguien lo apagara— y un array **bien escrito**, con
un elemento por línea, no entra.

## Ficheros

`tests/scrum622-desconocido-no-es-verde.test.mjs` (el re-anclaje) ·
`tests/_censo-por-posicion.mjs` (**nuevo**, el censo por AST) ·
`tests/scrum710b-anclaje-por-identidad.test.mjs` (**nuevo**, 7 tests) · este apéndice.

**No se ha tocado:** `tests/scrum698-…` ni `tests/scrum402-…` —los está editando S3, y aquí se
**censan**, no se editan— · `quotesView.js` · `customersView.js` · `docs/MICROCOPY_APROBADA…` ·
`prisma/schema.prisma` · el camino de emisión.

## Los huecos que declaro

1. **No he arreglado los 41.** Es un trinquete de no-crecimiento, no una campaña. Cuáles de los 41
   merecen arreglo y cuáles son prosa aceptable **no está decidido**, y decidirlo por mi cuenta
   habría sido inventar una política.
2. **La clasificación dato/mensaje es orientativa** y lo digo en el propio fichero: no distingue la
   prosa dentro de un campo de objeto, que sale como «dato».
3. **El censo sólo mira `tests/` y `scripts/`.** No he medido `src/` ni `public/`, donde también
   puede haber referencias por posición — el encargo acotaba a estos dos.
4. **No he medido los siete conflictos del día uno a uno.** Sé que uno de ellos es el array de
   `scrum698` porque lo dice el encargo; los otros seis no los he reconstruido, así que no puedo
   afirmar que la forma (b) los explique todos.
5. **La forma (b) sólo cubre pares `[texto, número]`.** Una línea base escrita de otra manera
   —un objeto `{vista: 237, otra: 166}` en una línea— no la vería, y no he medido si las hay.

## HALLAZGOS FUERA DE CARRIL — una línea cada uno

* `tests/scrum553-etiquetas-pegadas.test.mjs` concentra **siete** anclajes por número de línea a otros ficheros de tests: es el que más tiene y el que más probable es que caduque en la próxima edición ajena.
* `tests/_huerfanos-declarados.mjs` ancla **cuatro** posiciones de ficheros de producto (`cobrosView.js:117`, `jobDetailView.js:803`…), así que editar esas vistas por encima puede tumbarlo sin que cambie nada de lo que declara.
* El fichero `docs/master/SCRUM-710.md` de la fase 1 no lleva la línea `**Tanda:**` que el resto de entradas sí lleva; no lo toco porque es de otra sesión y su guard no la exige.


---

# SCRUM-710c · El trinquete era un cepo, y los frágiles eran siete

**Medido contra:** `origin/main` = `da5af22e347bbdfa3e57e1e658676e1cbd9bf310` · 2026-09-04T18:15:31+02:00
**Rama:** `scrum-710-anclas-por-el-hecho`

> Continúa la entrada de arriba (Javier). Aquí se cierra la cara que faltaba: **cómo se CORRIGE un
> anclaje cuando el propio trinquete lo impide**, y qué anclajes eran de verdad frágiles.

---

## 1 · PASO 0 (regla 39)

`main` se movió tres veces mientras se trabajaba. Remedido sobre el árbol ya mezclado:
**835 ficheros leídos, 40 anclajes por número de línea** (descontando el censo declarado del propio
`scrum710b`).

🔴 **Y el control positivo del encargo estaba medio caducado, así que manda el árbol:**

| control pedido | resultado |
|---|---|
| el barrido encuentra `scrum553:90 → scrum363:133` | ✅ **1 hallazgo** |
| el barrido encuentra «el de `scrum622` que motivó el ticket» | 🔴 **CERO** |

El de `scrum622` **ya no existe**: lo arregló SCRUM-710b, y su propio test **exige** que no esté
(*«el censo sigue viendo un anclaje por línea en `scrum622`: el arreglo no está completo»*). Usarlo
como control positivo habría sido exigir que estuviera roto.

## 2 · 🔴 El coste real, medido — y desmiente la deducción

La forma cómoda de contestar «¿cuántos son frágiles?» es deducirlo: los que se comparan como DATO.
Eso da **24**. **Es falso.**

Se midió: **una línea en blanco arriba de cada fichero anclado, y se corre el guard que lo ancla.**

| | |
|---|---|
| anclajes por línea | **40** |
| **se rompen de verdad** | **7** |
| aguantan | 29 |
| destino no resoluble (se DECLARAN, no se cuentan como sanos) | 3 |

**Los 33 que aguantan citan la posición como DECLARACIÓN y no la recalculan.** Los 7 que caen se
comparan contra un `${fichero}:${linea}` **recién calculado**, y son **todos de `scrum553`** — los
mismos que bloquearon a la sesión 1.

> 🔒 24 por deducción, 7 por medición. El coste no estaba repartido: estaba concentrado en un
> fichero, y ese fichero era justo el del bloqueo.

Los 3 no resolubles quedan nombrados y **no** se cuentan como sanos: `index.html:380` (ambiguo, dos
ficheros), `falso.mjs:2` y `BrowserLauncher.ts:363` (no existen en el árbol — el segundo es de
`node_modules`).

## 3 · Las dos preguntas del encargo, contestadas

### 🔴 «Cuando `scrum710b` impide CORREGIR un ancla, ¿cómo se corrige?»

Porque **la identidad del censo llevaba la línea dentro**. Pasar de `:133` a `:141` producía a la
vez un id nuevo (*«has añadido un anclaje»*) y un id desaparecido (*«has arreglado uno, actualiza
la lista»*): **dos rojos por un cambio que no añade nada.**

> 🔒 **Un guard contra el anclaje por posición identificaba sus propias entradas por posición.**
> Es la autorreferencia de siempre, esta vez dentro del trinquete — y la misma lección que
> SCRUM-622 aplicó una capa más arriba: *separar el `id` de la `línea`*, que aquí sólo se había
> hecho para el fichero que ancla, no para el fichero anclado.

**El arreglo:** la identidad pasa a ser `guard  fichero` — sin línea, lo único que no se mueve
cuando alguien edita por encima. La línea sigue viajando en `cita` y `lineaDestino`, para el
mensaje, que es donde una posición sí sirve.

### 🔴 «Y al soltarlo, ¿no queda permitido AÑADIR?»

No, y esa es la mitad que evita cambiar un cepo por una fuga. **Lo que distingue «otro anclaje más
al mismo fichero» de «el mismo, corregido» es la CUENTA.** `CONOCIDOS_A` pasa de `Set` a
**`Map` identidad → cuántos**, y son dos hechos con dos tests:

| hecho | veredicto |
|---|---|
| identidad nueva | 🔴 rojo |
| identidad declarada, **cuenta mayor** | 🔴 rojo |
| identidad declarada, misma cuenta, **otra línea** | ✅ verde — es una corrección |
| identidad declarada, **cuenta menor** | 🔴 rojo: se arregló y la lista se quedó atrás |

Sin la cuenta habría fuga real, y no es hipotética: **tres identidades tienen DOS anclajes** —
`scrum390`, `scrum514` y `scrum656b`—. Añadir un tercero a cualquiera de ellas habría pasado por
«corregir».

**33 hallazgos en 30 identidades**, y se declara aquí porque ver un 30 al lado de un censo que dice
33 invita a perseguir un fantasma.

## 4 · El caso que motivó el ticket, corrido en las dos direcciones

`tests/scrum363-eje-de-cobro.test.mjs:108` fijaba la firma por texto: `\(job: any\)`. Eso no
vigilaba la delegación — vigilaba que nadie tipara la firma.

**La matriz completa, medida:**

| | ancla vieja `\(job: any\)` | ancla nueva `\([^)]*\)` |
|---|---|---|
| firma intacta, delegación intacta | VERDE | VERDE |
| **🔴 firma TIPADA (una mejora)** | **ROJO** | **VERDE** |
| **🔴 delegación ROTA** | ROJO | **ROJO** |
| tipada **y** rota | ROJO | ROJO |

La columna izquierda es *«cae con el mecanismo viejo»*: tiparla lo tumbaba. La derecha es el
arreglo: **deja de castigar la mejora y sigue cazando el defecto.** Lo que el test afirma vive
entero en la línea siguiente —`const base = await serializeJob(job)`— y el paréntesis se deja
abierto a cualquier firma a propósito.

### Y la cascada, rota en su origen

Añadir ese comentario desplaza la línea 133 de `scrum363`. Con el mecanismo viejo eso tumbaba
`scrum553` y corregirlo tumbaba `scrum710b`. **Hoy no tumba nada**, porque `scrum553` identifica sus
siete por **fichero + etiqueta + cuántos hay** — la etiqueta es lo que el censo ya devuelve y lo que
el guard de verdad vigila.

⚠️ La multiplicidad no es adorno: `scrum331-heroe` tiene `<span class="eyebrow">` **dos veces**. Con
un `Set` de identidades, arreglar una de las dos habría pasado desapercibido. **7 hallazgos en 6
identidades.**

## 5 · Verificación · 8 controles de 8

| | control | esperado | medido |
|---|---|---|---|
| ✅ | `scrum363` caza la delegación rota | ROJO | ROJO |
| ✅ | `scrum363` **no** cae al tipar la firma | VERDE | VERDE |
| ✅ | `scrum553` caza una etiqueta pegada nueva | ROJO | ROJO |
| ✅ | `scrum553` avisa si uno de los 7 desaparece | ROJO | ROJO |
| ✅ | `scrum553` aguanta que su fichero anclado crezca | VERDE | VERDE |
| 🔴 | anclaje **nuevo** a fichero no declarado | ROJO | ROJO |
| 🔴 | anclaje **nuevo** a fichero ya declarado (sube la cuenta) | ROJO | ROJO |
| ✅ | **corregir** la línea de un anclaje declarado | VERDE | VERDE |

Y el barrido de fragilidad, repetido sobre el árbol arreglado: **se rompen 0 de 33** (eran 7).

**Suite completa: 5189 · 5101 pass · 0 fail · 88 skipped**, re-medida sobre el árbol YA
MEZCLADO — contar antes de mezclar caducó dos veces el mismo día, y esta entrada declara
`da5af22e`. `guards:entrada` **21/21, exit 0**.

## 6 · 📌 Lo que queda para la sesión 1, y un aviso

**La puerta está abierta: tipar `serializeJobDetail` ya no tumba nada.** No se ha tipado aquí
porque es suyo (⛔ del encargo).

⚠️ **Y hay un comentario que ha quedado obsoleto en su fichero**, que NO se toca por regla 9:
`src/modules/jobs/app/routes/jobs.routes.ts:370` sigue diciendo que el guard fija
«`serializeJobDetail(job: any)`» para exigir la delegación. Ya no la fija. Si nadie lo retira,
puede disuadir de volver a intentarlo — que es justo lo que este ticket viene a desbloquear.

## ⛔ No tocado

`src/` entero, incluida la firma de `serializeJobDetail` · la LÓGICA de `scrum363`, `scrum553` y
`scrum710b` (sólo sus anclas) · `prisma/schema.prisma` · el camino de emisión (regla 38) · los dos
vigías y su `continue-on-error` · producción · ninguna base.
