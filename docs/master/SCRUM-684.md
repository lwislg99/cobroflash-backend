---

> ⚠️ **ESTE FICHERO TIENE DOS TRABAJOS QUE NO SON EL MISMO TICKET, y no es un error de nadie de
> los dos.** El fundador encargó los dos SIN número y cada sesión se inventó el suyo: los dos
> eligieron «684». Se conservan **los dos bloques** porque los dos son ciertos y están fechados.
>
> · El de arriba (Tecnosel: tipo de intervención y valorar un parte firmado) tiene ya su número
>   propio, **SCRUM-703**, y su propia sesión lo moverá a `docs/master/SCRUM-703.md`. **Aquí no
>   se ha tocado ni una palabra de su contenido.**
> · El de abajo pertenece a **SCRUM-683** (el cableado del dictado), y se ha retitulado para que
>   lo diga. No se mueve de fichero todavía: hacerlo ahora daría a la otra sesión un segundo
>   conflicto sobre el fichero que está a punto de editar.
# SCRUM-683 (cableado) · el dictado, cableado — y el aviso que la medición puso en singular

**Medido contra:** `origin/main` = `69300b6662752e8fe624b1f6ee6b555f02e3a3f2` · 2026-09-02T19:53:12+02:00

---

## 0 · PASO 0

```
git ls-tree -r --name-only origin/main | grep -iE 'partes.routes|parteDictado'
  → src/modules/jobs/app/routes/partes.routes.ts
  → src/modules/jobs/domain/parteDictado.ts                              [exit 0]

¿YA cableado?  grep -rn 'parteDictado' src/ public/ (fuera de su módulo)  → vacío [exit 1]
CONTROL POSITIVO del mismo barrido: `parteTrabajo` → 3 importadores       [exit 0]
```

**No estaba cableado.** No es la octava.

---

## 1 · La microcopy que faltaba: `Falta la cantidad — ponla tú`

Aprobada en **singular** después de que la medición desmintiera la primera versión. La historia
está en `docs/MICROCOPY_APROBADA_SIN_APLICAR.md` (addendum «la tercera») y resumida en
`parteDictado.ts`: se aprobó primero en plural dando por hecho que era un resumen, se midió que
`cantidadesRetiradas` trae **una entrada por línea** y **puede traer exactamente una**, se paró, y
el fundador la cambió. **El dato mandó el texto.**

Se pinta **una vez en cada línea** a la que le falta la cantidad. Un resumen («3 líneas sin
cantidad») sería un texto distinto y se aprueba aparte: hay un aserto que cae si vuelve el plural.

---

## 2 · El cable

```
POST /admin/partes/:id/dictado
  → suggestLineasDeParte  (ai.service.ts)   ── el texto al modelo
  → sanearDictadoDelParte (parteDictado.ts) ── la protección, sobre el dictado ORIGINAL
  → devuelve { propuesta, avisos }          ── y NO ESCRIBE NADA
```

Lo que escribe en el parte sigue siendo el `PATCH` de siempre, y solo cuando el técnico confirma.
La ruta lleva el mismo candado que el `PATCH` (`puedeEditarContenido`): proponerle líneas a un
parte firmado sería enseñar un camino que el paso siguiente cierra con un 409.

**El campo es un `<textarea>` normal.** El técnico dicta con el **micrófono del teclado de su
móvil**: funciona en iPhone y Android, es gratis y **el audio no sale del teléfono**. Para este
campo, *no hacer nada es la funcionalidad*.

**Sin red no se bloquea:** sin clave, con el modelo caído o con una respuesta ilegible, la ruta
devuelve la propuesta **vacía con su motivo y un 200**. Un 500 le diría «se ha roto» cuando lo
único que pasa es que no hay ayuda.

---

## 3 · Verificación — los tres rojos

**Commit de todo ANTES de inyectar: `bc09146d5a337f251317e617e93417d232c212ed`** (verde, 4.561 · 4.482 pass).

| rojo inyectado | resultado |
|---|---|
| **el cable se salta el saneador** y se fía del prompt | 🔴 **1 cae, exit 1** — *««Canalización con canaleta» ha cruzado el cable con cantidad 3»* |
| **`SpeechRecognition` en la vista** | 🔴 **1 cae, exit 1**, y solo esa |
| **un importe en la línea propuesta** | 🔴 **1 cae, exit 1** — *«el símbolo del euro, el precio unitario»* |

El primero es el que importa: con el modelo devolviendo un `1` y un `3` que el dictado no dice, la
propuesta vuelve **sin cantidad en las dos líneas**. El prompt lo pide; el saneador lo garantiza.

> 🔴 **El guard de la voz lee el código SIN COMENTARIOS**, porque la propia vista explica por qué no
> usa `SpeechRecognition` y un guard de texto se caza a sí mismo en el comentario que explica la
> prohibición. Lleva su suelo (el despojador tiene que seguir viendo `pintarDictado`) y su control
> positivo (sobre `new webkitSpeechRecognition()` tiene que saltar).

---

## 4 · 🔴 Hallazgo: el detector de dinero de SCRUM-652c NO cazó el importe inyectado

Al inyectar el tercer rojo, **mi control negativo cayó y el suyo no**. Verificado el motivo leyendo
su test (`scrum652c-parte-en-el-movil.test.mjs:213`): escanea `contenedor.innerHTML` **después de
`renderParte`**, con su razón escrita — *«se busca en el MARCADO PINTADO, no en el fichero: es la
única forma de afirmar “no se ve”»*.

Ese razonamiento es correcto para lo que mide, pero deja un punto ciego: **el dinero que viva en un
camino que ese render no ejercita le es invisible**, y la propuesta del dictado es exactamente uno
de esos caminos.

Los dos son complementarios, no redundantes:

| | qué mira | qué se le escapa |
|---|---|---|
| SCRUM-652c | el marcado **pintado** por `renderParte` | dinero en un camino que ese render no ejercita |
| SCRUM-683b (éste) | el **fichero** de la vista | podría acusar a un comentario (por eso el de la voz despoja) |

**No se toca el suyo** (regla 9, carril de SCRUM-652 fase C). Con el de este ticket, el árbol queda
cubierto por los dos lados; queda dicho por si su cobertura se quiere ampliar en su propio carril.

---

## 5 · Declaraciones que movió el cable

* **SCRUM-411: 9 → 8**, y **recontado ejecutando** `analizar()` sobre el árbol de hoy: **126 módulos
  de dominio, 289 alcanzables, 8 inalcanzables**. `parteDictado.ts` ya no está. Queda `revision.ts`.
  La entrada anterior prometía «baja cuando `parteDictado.ts` tenga consumidor» y **no prometía un
  número**: por eso no ha hecho falta corregirla.
* **SCRUM-55**: la ruta declara rol de Operario, con motivo. Es trabajo de campo puro y no abre
  ninguna puerta a dinero.
* **Huérfanos declarados**: `aLineaDelParte` entra como `MOTOR_EN_ESPERA` (la confirmación viaja hoy
  por el `PATCH`), y **`cantidadRespaldadaPorElTexto` pierde el `export`** — su consumidor real está
  dentro del módulo. Sus **11 asertos** pasan a medir por la superficie pública.

## 6 · 🔴 Hallazgo de otro carril, reportado y NO arreglado (regla 9)

`validarLineasDelTecnico` (`partes.routes.ts`, SCRUM-652 fase C) acepta `Number.isFinite(unds)` —o
sea, **0 y negativas**— mientras `aLineaDelParte` exige `> 0`. Las dos guardan la misma frontera y
no comprueban lo mismo. Tocar la validación de esa ruta cambiaría el comportamiento de una pantalla
ya mergeada por otra sesión: **se reporta**.

## 7 · El detector de enriquecimiento: NO se construye (decisión, no olvido)

Se propuso marcar las descripciones cuyas palabras no aparecen en el dictado, para que el técnico
mire ahí primero. **El fundador lo descartó con el motivo que se dio al proponerlo**: reformular
legítimamente («Sustitución de videograbador» por «sustituir el videograbador») marcaría casi todas,
y **un detector que acusa a los sanos se desactiva**. Queda escrito como decisión.

La descripción sigue protegida solo por que **el técnico confirma** — y la línea del prompt que
prohíbe completar marcas **es un consejo, no un mecanismo**. Está dicho en `parteDictado.ts`.

---

# SCRUM-684 (b) · ¿PUEDE UN ALBARÁN NACER SOBRE UN TRABAJO SIN PRESUPUESTO? — **FASE A: medir y preguntar**

**Medido contra:** `origin/main` = `1304643497934441f88950e441182b7e344dbb57` · 2026-09-04T20:22:09+01:00

> 🔴 **EL NÚMERO ESTÁ OCUPADO, Y ES LA TERCERA VEZ EN ESTE FICHERO.** Arriba viven ya dos trabajos
> que no son el mismo ticket —el aviso lo escribió la sesión anterior— y `scrum-684-cablear-dictado`
> está **mergeada en `main`**. Éste es un TERCER encargo con el mismo número.
>
> Se anexa aquí como manda la skill («si ya existe, se AÑADE como apéndice y no se borra nada»,
> precedente `SCRUM-244.md`) **y se pide número propio**: el precedente de esta misma casa es
> SCRUM-703, que salió de este fichero a uno suyo. **La rama se llama `scrum-684b-…` a propósito**,
> para no fingir que el número es libre.
>
> **NO LLEVA CÓDIGO.** El encargo es «medir y preguntar», y la pregunta no es técnica.

## La pregunta, que decide el fundador

> **¿Un albarán DEBE poder existir sobre un trabajo SIN presupuesto?**
>
> · Si **NO** → los fixtures están mal; el arreglo es de tests y no toca el producto.
> · Si **SÍ** → el guard está mal, el defecto está en el PRODUCTO, y dar presupuesto a los fixtures
>   **taparía un defecto real**.

## 🔴 Lo que cambia la pregunta: NO es una regla que nadie revisara. Son DOS decisiones correctas que nadie reconcilió

La hipótesis del encargo era que alguien metió una regla nueva sin mirar si el resto la asumía.
**Medido: es al revés, y el orden importa.**

| cuándo | qué pasó | dónde |
|---|---|---|
| **16-jul-2026** | un test afirma que un **Job manual SIN `quoteId`** con un albarán devuelve ese albarán en el detalle. **Albarán sobre trabajo sin presupuesto era un estado probado.** | `tests/scrum51-job-sin-quote.test.mjs:1-4` |
| **5-ago-2026** | **SCRUM-257** pone el guard `409 job_without_quote`. Y su comentario dice, con razón **entonces**: «la única vía de creación de `Job` en todo `src/` es `job.service.ts`… **No hay endpoint de trabajo manual**» | `jobs.routes.ts:942-958` |
| **2-sep-2026** | **SCRUM-651 (T2)** abre `POST /admin/jobs`: el **trabajo directo**. Su cabecera: «Una empresa de electricidad. Llaman por una AVERÍA… **Nadie presupuesta una urgencia**» | `src/modules/jobs/domain/trabajoDirecto.ts` |

**SCRUM-651 abrió exactamente la puerta que el comentario del guard daba por cerrada**, cuatro
semanas después. Y **no menciona el albarán ni una vez** —medido: cero coincidencias de «albar» en
`docs/master/SCRUM-651.md`—, aunque sí razonó con cuidado qué OTRAS cosas le faltan a un trabajo
sin presupuesto (`totalAceptado` en `null` y no `0`, sin `importeDeReferencia`, sin `estadoCobro`).

> Las dos decisiones son del fundador y las dos siguen teniendo sentido por separado. Lo que no
> existe es la respuesta a qué pasa cuando se cruzan.

## 1 · ¿Está la regla en el MÁSTER?

**NO está en `docs/YAQU_MASTER.md`** — con esas palabras. Medido: cero coincidencias de
`job_without_quote`, «sin presupuesto no hay albarán» ni variantes.

Dónde sí vive:

* **En el código**, `src/modules/jobs/app/routes/jobs.routes.ts:954-959` (y otra vez en `:1151`,
  para el plan de cobro).
* **En `docs/master/SCRUM-257.md`**, que es registro de trabajo y no el máster, y que la atribuye a
  una **decisión del fundador del 2-ago-2026**: *«Las tres decisiones del fundador se respetan tal
  cual: **no hay albarán sin presupuesto** · …»*

⚠️ **Y no la puso SCRUM-195.** El encargo lo atribuye a ese ticket; medido, `SCRUM-195` es
*«PAGOS-FLEX-2: pertenencia por Job, lectura serializada y el loop del adicional»* y no toca esto.
El guard es de **SCRUM-257** (4-ago, mergeado el 5-ago).

## 2 · ¿Hay hoy un camino EN EL PRODUCTO que cree un job sin presupuesto?

**SÍ, y es de primera clase.** Dos altas de `Job` en todo `src/`:

| fichero:línea | qué | ¿fija `quoteId`? |
|---|---|---|
| `src/modules/jobs/domain/job.service.ts:95` | aceptar un presupuesto (`ensureJobForQuote`) | **sí** (`quoteId: quote.id`) |
| `src/modules/jobs/app/routes/jobs.routes.ts:648` | **`POST /admin/jobs`** · trabajo directo, vía `filaDeTrabajoDirecto` | **NO** — la función no lo escribe (`trabajoDirecto.ts:124-141`) |

O sea: **el producto crea hoy trabajos sin presupuesto por una puerta que se construyó a propósito,
y el guard del albarán los rechaza.** No es un caso hipotético de los fixtures.

## 3 · El censo de fixtures, con sus dos controles

Por **AST** y no por texto: un comentario que hable de `quoteId` no crea nada.

```
POBLACIÓN: 727 ficheros bajo `tests/`
altas de Job encontradas: 36  (con quoteId: 4 · SIN: 32)
FICHEROS que crean Jobs SIN presupuesto: 22
```

* ✅ **CONTROL POSITIVO** (el que pidió el encargo): encuentra los **2/2** de
  `tests/albaran.test.mjs`, líneas **224** y **350** — las mismas que midió S3.
* ✅ **CONTROL NEGATIVO**: hay **4** altas CON `quoteId`, así que el detector no dice «sin» a todo.

Los 22 ficheros: `albaran` · `scrum106` · `scrum120` · `scrum127` · `scrum136` · `scrum148` ·
`scrum17` · `scrum170` · `scrum171a` · `scrum22` · `scrum24` · `scrum25-export-zip` ·
`scrum25-exports` · `scrum296` · `scrum297` · `scrum47` · `scrum49` · **`scrum51-job-sin-quote`** ·
`scrum57` · `scrum66` · `scrum68` · `tenancy-permisos`.

> 🔴 **`scrum51-job-sin-quote.test.mjs` no es un fixture descuidado: es un test cuyo NOMBRE y cuyo
> propósito son ese estado.** Eso convierte la hipótesis del encargo en algo medido: cuando se
> escribieron, «job sin presupuesto» **era** un estado normal — y con albarán encima.

## 4 · Cuántos jobs sin presupuesto hay HOY — **en dev, y sólo en dev**

```
destino: acela.proxy.rlwy.net/yaqu_dev_javier   ⚠️ DEV
jobs en dev: 5   ·  CON presupuesto: 5  ·  SIN presupuesto: 0   ✅ la suma cuadra
albaranes en dev: 0  ·  de trabajos SIN presupuesto: 0

CONTROL · creado un job sin presupuesto (id 387, quoteId=null)
          la consulta pasa de 0 a 1  ✅ SABE encontrarlo
          fila borrada; vuelve a 0   ✅
```

**El cero es un cero medido**, no un cero ciego: la consulta encuentra uno cuando lo hay. La fila de
control se creó y se borró, comprobado.

> ⚠️ **LÍMITE, y es duro: dev NO es producción.** Este número **no autoriza a decir nada** sobre
> producción — ni «no hay ninguno» ni «hay pocos». Si hace falta el de producción, lo pide el
> asesor. **No he leído staging ni producción, ni siquiera un preview.**

## Lo que NO he hecho, y consta

**No he dado presupuesto a ningún fixture.** Estaba expresamente prohibido y además sería ajustar
la medida al instrumento: si la respuesta es «SÍ, un albarán puede existir sin presupuesto»,
hacerlo **taparía el defecto** en 22 ficheros a la vez.

**No he tocado el guard, ni los fixtures, ni la ruta.** Esto es FASE A.

## El material, resumido para decidir

| a favor de **SÍ** (el guard está mal) | a favor de **NO** (los fixtures están mal) |
|---|---|
| El producto **ya crea** trabajos sin presupuesto por una puerta hecha a propósito (SCRUM-651), y su motivo es el caso más frecuente del primer cliente real: **una avería no se presupuesta** | La regla es una **decisión explícita del fundador** (2-ago-2026), recogida en `SCRUM-257.md` |
| Un test de julio afirma que **albarán sobre job sin presupuesto** funcionaba y se esperaba (`scrum51`) | Cuando se tomó, era **coherente con el producto de entonces**: no había forma de crear un job sin presupuesto |
| 22 ficheros de tests lo asumen | El guard formalizaba un invariante que **entonces** se cumplía de hecho |
| Un técnico que abre una avería, la arregla y **no puede entregar un albarán** se queda sin papel que entregar — que es la víctima de ALB-02 | — |

**La pregunta afinada que le llevaría al fundador**, y que el material sugiere que es la de verdad:

> No es «¿albarán sin presupuesto sí o no?». Es: **cuando abriste la puerta del trabajo directo
> (SCRUM-651) para las averías, ¿querías que esas averías pudieran entregar un albarán?** Si la
> respuesta es sí, el guard de SCRUM-257 quedó viejo el 2 de septiembre y hay que acotarlo, no
> quitarlo.

## Hueco declarado

**No he ejecutado la tanda gateada.** Toma el turno de staging y hoy hay seis sesiones; el
diagnóstico de S3 ya está medido y citado, y repetirlo habría bloqueado a otro carril sin añadir
nada. Lo que sí he comprobado es que el fixture del 409 tiene la forma que S3 describió
(`tests/albaran.test.mjs:224` crea el job sin `quoteId`; el POST de la línea siguiente espera 201).

---

# SCRUM-684 (b) · **FASE B: el guard acotado — una avería también se entrega en papel**

**Medido contra:** `origin/main` = `f707619865a5be86988a4d34b9b0e97b4449169b` · 2026-09-05T00:17:11+01:00

> **Re-anclado el 5-sep-2026 al mezclar `main` dentro de la rama**, porque una base caduca cuando
> `main` se mueve — y aquí se movió **tres veces en una hora**. El ancla previa —el `origin/main`
> que terminaba en `8303db75`, del 4-sep-2026 a las 21:37:50+01:00— era la del árbol sobre el que se
> midieron la caja del modal y los seis rojos, y se conserva aquí escrita para que no se pierda
> contra qué se midió aquello.

> ⚠️ **CORREGIDO el 4-sep-2026: NO es SCRUM-725, es SCRUM-683** — lo dice el propio encabezado del
> bloque de arriba, y el asesor rectificó su cita («la saqué del título de un ticket de Jira sin
> medir»). La línea de abajo se deja tal cual, tachada, porque es el registro de lo que se creyó.
>
> ~~El número sigue compartido con el trabajo de DICTADO de arriba (que es SCRUM-725, según el
> asesor).~~ **684 es este ticket** y la reubicación de aquél —a `docs/master/SCRUM-683.md`— la hace
> el asesor; aquí no se mueve nada, porque hacerlo daría un segundo conflicto a la sesión que tiene
> ese fichero.

## La decisión, tomada por el fundador

**SÍ.** Una avería abierta como TRABAJO DIRECTO puede entregar albarán. El guard de SCRUM-257 **se
ACOTA, no se quita**, y los 22 ficheros de fixtures **no se tocan**: no estaban mal, reflejaban un
estado que el producto sí permite.

## 🔴 La distinción real, medida: NO es el trabajo, es LA LÍNEA

El encargo pedía criterio, no una condición inventada. Se midieron los candidatos obvios y **ninguno
sirve**:

| candidato | por qué NO distingue |
|---|---|
| `tipoOperacion` (SCRUM-66) | es agrupación **fiscal** —recapitulativa o factura al concluir— y vale `TRABAJO_UNICO` por defecto en **los dos** casos |
| `tipoIntervencion` (SCRUM-651) | nullable y sin `@default`: un trabajo de presupuesto también lo tiene a `null` |
| `quoteId` a secas | **es la pregunta, no la respuesta**: acotar por él sería el guard de hoy |

Lo que de verdad depende del presupuesto en este camino es **una sola cosa**, y está medida:
**`quoteLineIndex`** (SCRUM-367). `contarLineasDePresupuesto` devuelve `undefined` cuando el trabajo
no tiene presupuesto, y entonces `validarLineas` **conserva el índice sin validarlo** — lo dice su
propio comentario: *«un enlace roto es peor que ningún enlace, porque C6 se lo creería y respondería
“no queda nada por entregar” sobre una correspondencia que no existe»*.

Así que el invariante que hay que sostener **no** es «no hay albarán sin presupuesto», sino:

> 🔴 **NINGUNA LÍNEA PUEDE DECIR QUE VIENE DE UN PRESUPUESTO QUE NO EXISTE.**

Una avería **sin** líneas enlazadas no rompe nada: no hay correspondencia que mentir.

## Y va en las DOS puertas, porque hoy sólo estaba en una

**Medido**: el `POST` traía el `job_without_quote` y el `PATCH` **no**. O sea que el agujero que
aquel guard decía tapar **ya estaba abierto por el otro lado**: un albarán anterior al guard se
podía parchear con cualquier `quoteLineIndex` y nada lo validaba. Aquí se cierra por las dos.

## ✅ El microcopy: FIRMADO por el asesor, y por qué hubo que firmar uno nuevo

El de SCRUM-257 decía «Este trabajo no tiene presupuesto; **no se puede crear un albarán**». Con el
guard acotado eso es **falso**: sí se puede, salvo para la línea que afirma un origen inexistente.

> 🔴 **Un mensaje aprobado que ha dejado de ser verdad es peor que uno con marcador.** Retirar un
> texto FIRMADO porque el producto cambió debajo pide más criterio que escribir uno nuevo.

**Texto aprobado por el asesor el 4-sep-2026** (provisional, a la espera del fundador):

> **«La línea N dice venir de un presupuesto y este trabajo no tiene ninguno.»**

Nombra la línea **primero**, que es lo que el profesional necesita para arreglarlo. El plural
concuerda: «Las líneas 1, 3 **dicen**…».

### 📏 La caja, medida en navegador real — y es OTRA superficie que la de S5

No es «la caja de aviso del dashboard» (45 car. en una línea, 93 en dos): este 409 se pinta en el
`.alert.error` **del modal**, que es más estrecho — la cadena real es
`.modal-overlay > .modal > .alert.error`, en `jobDetailView.js:1471` y `:2523`.

| | 929 px | 390 px |
|---|---|---|
| caja | 472,0 px | 342,0 px |
| ancho útil | 444,0 px | 314,0 px |
| el firmado (72 car.) | **1 línea** | **2 líneas** |
| peor caso: plural con dos números (78 car.) | 2 líneas | **2 líneas** |

**Nunca pasa de dos líneas**, que era la condición. Se pinta, y el marcador se retira.

> 🔴 **Y me cazó la propia medida**: la regla `.alert:empty { display: none }` deja la caja en
> **0 px** si se mide vacía, y ese cero se habría leído como «no cabe nada». Se mide con el texto dentro.

**Censo de SCRUM-667**: la entrada entró con 1 por la tarde y **se BORRA** el mismo día, no se pone
a 0. Comprobado: cero marcadores en el fichero. Que no quede marcador **no** significa que esté
firmado por el fundador — eso lo dice `SIN_APROBAR = 1`, y hay un guard que exige que cuadre.

Y un tope medido: si el mensaje crece por encima de **78 caracteres**, el guard obliga a volver a
medir la caja antes de pintarlo.

> El apartado de abajo es la versión previa de éste, de cuando el texto aún no estaba firmado.
> Se conserva por el motivo de siempre: no se borra lo escrito.

### El microcopy, antes de la firma

El de SCRUM-257 decía «Este trabajo no tiene presupuesto; **no se puede crear un albarán**». Con el
guard acotado eso es **falso**: sí se puede, salvo para la línea que afirma un origen inexistente.

**Un mensaje aprobado que ha dejado de ser verdad es peor que uno con marcador.** El nuevo sale con
`[PENDIENTE` desde un solo sitio y **nombra qué línea**, declarado en `CENSO_SERVIDOR` de SCRUM-667
—y **no** en `EN_EL_PAPEL`: lo ve el profesional en el panel, no el cliente en el papel—.

> 🔴 **LA FRASE QUE SIGUE QUEDÓ DESMENTIDA AL MEDIR, y se deja escrita en vez de borrarla.** Decía
> que la caja no se medía «porque es un toast y no un control», y es **falso**: este 409 se pinta en
> el `.alert.error` del modal, que **sí** tiene caja y se midió — 472,0 px a 929 y 342,0 px a 390,
> con el resultado en el apartado de arriba. Un registro que contradice al de arriba sin decirlo es
> peor que no tenerlo.

Candidato para firmar, con la caja no medida porque es un toast y no un control:
**«La línea N dice venir de un presupuesto y este trabajo no tiene ninguno.»**

## Rojo por el mecanismo, en los DOS sentidos

Seis casos en `tests/scrum684-albaran-en-averia.test.mjs`, y los dos guards de la regla vieja
**re-anclados a la nueva** en vez de borrados:

| caso | antes | ahora |
|---|---|---|
| avería sin presupuesto, sin líneas enlazadas | 🔴 409 | ✅ **201** |
| línea con `quoteLineIndex` sin presupuesto | 409 (por el motivo equivocado) | 🔴 **409**, nombrando la línea |
| `quoteLineIndex: 0` | — | 🔴 409 — `0` es la PRIMERA línea, no un hueco (familia SCRUM-271) |
| `undefined` · `null` · `''` | — | ✅ pasa: es lo que manda el navegador cuando no hay origen |
| con presupuesto, cualquier cosa | 201 | ✅ **201** — el rango lo sigue validando `validarLineas` |

**CONTROL NEGATIVO**: los 22 ficheros de fixtures **pasan sin tocar ni uno**. Los dos guards que sí
cambiaron —`scrum257` y `scrum303`— **no son fixtures: son los guards de la regla vieja**, y
conservan sus dos caras (el 409 que queda y el 201 nuevo).

## 🔴 La tanda gateada: ABORTADA, y no por esto

```
❌ preflight: DERIVA DE ESQUEMA — la BD NO coincide con prisma/schema.prisma.
   SENTIDO: MIXTO — 1 por detrás (ADD/CREATE) y 1 por delante (DROP).
     ALTER TABLE "customers" DROP COLUMN "dto_por_defecto";
     CREATE UNIQUE INDEX "partes_trabajo_merchant_id_numero_key" ON "partes_trabajo"("merchant_id","numero");
```

**Las dos derivas son de otros carriles y NO se tocan:**

* `customers.dto_por_defecto` está en la base y **no** en `main`: lo metió `64b498ba` **SCRUM-587**,
  que es el carril de **S3**. Sincronizar con `db push` **haría `DROP` de esa columna** mientras su
  rama está viva. **No se hace.**
* el índice único de `partes_trabajo` es el **cerrojo de serie, SCRUM-728 — S4**.

**Lo que sí se pudo medir**, corriendo el fichero del albarán con su puerta (`QA_DB_TEST=1`) y
saltándome el envoltorio —lo digo porque es un desvío del procedimiento, no un atajo silencioso—:

```
tests/albaran.test.mjs → 17 tests · 15 pass · 2 fail
```

**El `409 job_without_quote` HA DESAPARECIDO.** Los dos que quedan **no son míos y no los redondeo**:

| línea | fallo | de quién |
|---|---|---|
| **252** | `'AB260001'` no casa con `/^ALB-\d{4}-001$/` | el **formato de numeración** cambió. El propio fichero **se contradice**: su test unitario de arriba ya afirma `AB260001` |
| **376** | espera `400` y recibe `409 albaran_cambiado_al_editar` | **SCRUM-361 (H6)**: el PATCH no manda `version`, y ese candado dice literalmente *«SI LA VERSIÓN NO LLEGA, NO SE ESCRIBE… consecuencia declarada, no descubierta»* |

Los dos estaban **tapados** por el 409 del guard: el fixture nunca llegaba tan lejos. Es el mismo
patrón que S3 midió («el fallo AVANZÓ»), dos capas más adelante. **No los toco**: el encargo dice
que los fixtures no se tocan, y además son de la numeración (S4) y del candado de versión.

## Lo que NO se ha tocado

`prisma/schema.prisma` · ninguna columna · el camino de emisión · los 22 fixtures · la base de
staging ni la de producción. El turno de staging se tomó y **se soltó** (lo hace el propio script).

---

## El merge de `main`, y la tanda RE-MEDIDA después (S1 · 5-sep-2026)

`main` había avanzado mucho desde que se abrió el conflicto de esta rama, así que se mezcló
**DENTRO** de la rama —nunca rebase, nunca `--force`— y **la tanda se corrió DESPUÉS del merge, no
antes**: mezclar `main` es un cambio, y una tanda anterior al cambio no dice nada del árbol que se
entrega.

Se mezcló **tres veces**, y ninguna de las dos últimas estaba planeada: cada vez que se fue a
re-anclar, `main` se había vuelto a mover. **71 commits de `main` en total** — 51 hasta `9545711d`,
6 más hasta `5b95cad2` y 14 más hasta `f7076198`. Es el ritmo real de un día con varias sesiones
abiertas, y por eso el ancla se re-mide en vez de escribirse una vez.

| tanda | árbol medido | tests | pass | fail | saltados |
|---|---|---:|---:|---:|---:|
| tras el 1.er merge | `origin/main` = `9545711d` · 2026-09-05T00:01:44+01:00 | 5406 | 5318 | **0** | 88 |
| tras el 2.º merge | `origin/main` = `5b95cad2` · 2026-09-05T00:08:47+01:00 | 5411 | 5323 | **0** | 88 |
| tras el 3.er merge | `origin/main` = `f7076198` · 2026-09-05T00:19:21+01:00 | 5439 | 5351 | **0** | 88 |

La tercera vuelta **no fue por rutina**: entre los 14 commits venía **SCRUM-738**, un censo que lee
`docs/master/` y los números de los títulos, y este fichero es precisamente uno con **el número
compartido** por dos trabajos. Medido después: `main` no había tocado ninguno de los cuatro
ficheros de este carril, y sus huellas siguen siendo las mismas tras los tres merges.

> ✅ **Y valió la vuelta: SCRUM-738 trae un test QUE HABLA DE ESTE TICKET**, y en la tercera tanda
> sale en verde — *«SCRUM-684 NO se da por hecho: su entrada está titulada para OTRO»*. Su censo
> daba 684 por **ENTERO** por el número compartido, y ahora lo devuelve como **`NO_MEDIBLE`** con el
> motivo `NÚMERO COMPARTIDO`. Se apoya en que el **primer** título del fichero siga siendo
> `# SCRUM-683`, que es lo que este trabajo **no ha tocado**; si algún día se separan los ficheros,
> ese test se retira con ellos y él mismo lo dice. Sin la tercera vuelta, un guard nuevo que mira
> esta entrada se habría quedado sin correr contra ella.

> ⚠️ **Un recuento que me falló a mí mientras escribía esto, y va aquí porque es el mismo defecto de
> siempre.** Al comparar las tandas conté los saltos «de este carril» buscando `684`, y la tercera
> dio **1** donde las otras daban 0. No era un salto: el patrón casaba con **`0.2684ms`**, el tiempo
> de ejecución de un test ajeno. Con el patrón estricto (`SCRUM-684`) las tres dan **0**. Un número
> buscado por un trozo de texto que también aparece en otra cosa no es una medición.

Las unidades son **tests**, no ficheros: los 5 de diferencia entre la primera tanda y la segunda son
los que entraron con **SCRUM-747** en el segundo merge, no tests míos. Los **7 tests** de
`tests/scrum684-albaran-en-averia.test.mjs` salen en verde en las dos, y el barrido que los busca
devuelve **10 líneas** —los 7 más las 3 de `scrum257` y `scrum303` que citan el ticket—: un cero
ahí habría sido «no supe mirar», no «no hay».

### ⚠️ Los 88 saltados, y por qué NINGUNO es un fallo tapado

Los 88 **declaran su motivo** —comprobado: **cero** saltos mudos, y **cero** de este carril—. Por
grupos, y suman 88 exactos: **78 tests** gateados por `QA_DB_TEST` / `A55_DB_TEST` /
`BOT_SUITE_TEST` (la tanda de staging), **9** por `LIBRO_PG_URL` (piden un Postgres desechable) y
**1** por no poder crear un enlace a fichero en esta máquina (EPERM de Windows), que declara además
qué control positivo portable cubre el mismo mecanismo. Los 9 de `LIBRO_PG_URL` los canta la propia
suite por su nombre al terminar, que es lo que impide leer su «0 fallos» como «todo corrió».

### 🔴 EL HUECO, y hay que decirlo: los dos fallos de arriba NO se han vuelto a medir

Los dos que quedan en `tests/albaran.test.mjs` —el formato `AB260001` y el candado de versión de
SCRUM-361— viven **dentro de los dos únicos tests gateados de ese fichero** (`SCRUM-14`, línea 202,
y `SCRUM-65`, línea 331). En esta tanda **saltaron**, así que el `fail 0` de arriba **no dice nada
sobre ellos**: no están arreglados, están sin ejecutar. Los otros **15 tests** del fichero sí
corrieron y pasan, incluido el unitario de `formatAlbaranNumber`, que es justamente el que
contradice al fixture. Esta sesión **no ejecuta nada contra staging**, ni el preview, así que el
hueco se declara en vez de rellenarlo con una suposición.

### Los dos censos de mudez: medido que este carril NO entra en ninguno

Son **dos poblaciones distintas** y se midieron por separado, que es la única forma de no
confundirlas:

| censo | qué población mide | los ficheros de este carril |
|---|---|---|
| **SCRUM-719** (`censo:mudez`) | guards que llaman a `soloEjecutable` | **0 llamadas** → NO APLICA |
| **SCRUM-745** (`meta:mutaciones`) | preguntar por TEXTO sobre un fuente | **0 sitios** en la superficie |

La segunda se midió **reusando el detector del propio `scrum745`** —extraído de su fichero por AST,
sin escribir un segundo criterio que pudiera divergir del suyo— y con su suelo delante: el detector
reusado ve **1 + 1** sitios en los dos sintéticos de control, **0** en el control negativo de la
lista, y **1 sitio real** en `scrum740`. O sea que el **0** de este carril es «no lo hace», no «no
supe mirar».

Así que aquí no hay ninguna `MUTACIONES_QUE_ME_TUMBAN` que declarar: declararla sin que exista el
defecto que vigila sería la «cobertura aparente» contra la que avisa el propio SCRUM-745.
