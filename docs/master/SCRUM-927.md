# SCRUM-927 · Los censos que no corre nadie, y las excepciones que nadie volvió a mirar

**Medido contra:** `origin/main` = `963c2732400c8ea786994c80214a65bae80bed17` · 2026-09-17T20:07:55+01:00

**Rama:** `scrum-927-censos-que-no-corre-nadie`

> ⛔ **No se ha convertido ningún censo en guard**, que es lo que el encargo prohíbe: esto mide y
> propone. El único test que entra NO juzga el árbol — le pone un caso conocido al instrumento.
> ⛔ **No se ha borrado ninguna evidencia fechada.** Una medición vieja CON su fecha es un dato.
> ⛔ `src/` intacto · sin estado ni flag nuevos (27) · sin dependencias (36).

---

## 1 · ① LAS DOS CIFRAS, JUNTAS

> 🔒 **Convertir 27 sitios arregla 27 sitios; no impide que nazca el 28.**

| | |
|---|---|
| ficheros ejecutables de `docs/` y `scripts/` (población) | **277** |
| de ellos, **contienen una medición** | **166** |
| ✅ las ejecuta algo (tanda, CI o hook) | **68 · 41%** |
| ⚠️ invocables **a mano** por npm, que CI no lanza | **30 · 18%** |
| 🔴 **no las corre nadie** | **68 · 41%** |

Suman 166 de 166. **Dos de cada cinco mediciones de esta casa no las ejecuta nada.** No era un
caso: es el patrón que SCRUM-864 enseñó de una en una.

Y sigue naciendo: **`scripts/censo-alcance-vs-sujeto.mjs` es de SCRUM-732, mergeado ayer**, y ya
está en la columna de la derecha. El 28 nació mientras se escribía esto.

### Cómo se decide qué es «una medición» — y por qué no por el nombre

Por AST, nunca por `grep`. Un fichero MIDE si **lee un sujeto** (recorre ficheros, lee del disco,
interroga a git) **y produce un agregado** (cuenta, clasifica, o imprime algo calculado). Leer sin
agregar es un script que hace un trabajo; agregar sin leer es aritmética sobre constantes.

Y **no cuenta como medición lo que cambia el mundo**: `backup-bd.mjs`, `renumerar-documentos.mjs`
o `migrate-stripe-prices-live.mjs` leen y agregan igual que un censo, pero su producto es un
cambio. Nadie espera que corran solos, y meterlos dentro habría inflado el titular.

### Y «lo ejecuta algo» es ALCANZABILIDAD, no mención

Resuelto por alcance transitivo desde raíces que de verdad arrancan: la TANDA (889 semillas), CI
(14), los HOOKS (2) y el ARRANQUE (2). Que un `.md` nombre un fichero no lo ejecuta; que otra
evidencia muerta lo lance con `spawnSync`, tampoco — una cadena muerta entera no resucita por
tener eslabones.

## 2 · ② POR QUÉ NO CORREN · tres formas, tres remedios

| | cuántas | remedio |
|---|---|---|
| **(a) Nunca se pensó que corrieran** — actas de un ticket en `docs/master/evidencias/` | **44** | **Ninguno.** Un acta fechada es un dato, y está bien que lo sea |
| **(b) Se pueden invocar, pero nadie mira su salida** — declaradas en `package.json`, CI no las lanza | **30** | O las lanza CI y su salida decide, o se admite que son de consulta |
| **(c) Reproducibles, en `scripts/`, y nadie las corre** | **8** | Las únicas candidatas a guard (§4) |

De las 98 dormidas, sólo **30 son reproducibles** con el árbol delante y ya está. Las otras 68
están atadas a algo efímero: piden una ruta por argumento, llevan una ruta absoluta de otro
worktree cableada, necesitan red, base de datos o navegador. **Ésas no son instrumentos dormidos:
son actas, y no pueden ser otra cosa.** Varias leen un `runs1.json` del scratchpad de una sesión
que ya no existe.

## 3 · ③ 🔴 LAS EXCEPCIONES APARCADAS — y aquí está el hallazgo

| | |
|---|---|
| listas de excepción declaradas | **132** |
| ✅ **VIGILADAS** · algo AFIRMA sobre ellas; si cambian, salta | **94** |
| ⚠️ **SÓLO AVISAN** · su consecuencia acaba en un `console.log` | **7** |
| 🔴 **APARCADAS** · sólo sirven para excluir; nada las mira | **27** |
| · vacías (no dejan a nadie fuera) | 15 |
| **elementos fuera de los números**, en listas no vigiladas | **220** |
| listas sin un motivo escrito al lado | **6** |

La buena noticia primero, porque es la mayoría: **94 de 132 están vigiladas de verdad**. Esta casa
declara sus excepciones y casi siempre les pone un mecanismo detrás. El ticket preguntaba si lo de
SCRUM-864 era el patrón, y en excepciones **no lo es**.

### ⚠️ Pero apareció una tercera categoría que no estaba en el encargo, y es la interesante

**Siete listas cuya vigilancia es un `console.log`.** El caso que la destapó:

```
PARES_SIN_TESTIGO_CONGELADOS   (87 elementos)   scripts/_anclas-sin-testigo.congelado.mjs
```

Su test calcula los `muertos` —los pares que ya no hacen falta— y hasta explica cómo recogerlos.
Pero ese cálculo termina en un `console.log`, **no en un `assert`**. Si el conjunto deja de ser
correcto, la tanda sigue verde y el aviso se pierde entre 7.390 tests.

    🔒 Contar no es avisar — y avisar no es exigir.

Se cuentan aparte a propósito: llamarlas «vigiladas» sería mentir, y llamarlas «aparcadas» taparía
que alguien se molestó en calcular la consecuencia. **Lo que les falta es el mecanismo, no la
idea** — y son las más baratas de cerrar, porque el cálculo ya está escrito.

### ¿Alguien midió la consecuencia de aparcarlas?

Para las 94 vigiladas, sí: por eso saltan. Para las 27 aparcadas y las 7 que sólo avisan, **no
consta que nadie lo haya hecho**, y este ticket tampoco lo hace: medir la consecuencia de cada una
es mirar su sujeto, una por una. Lo que sí queda es la lista y quién es cada cual.

**El precedente dice que esa cuenta llega.** SCRUM-864 aparcó 15 llamadas con un argumento
correcto —«la limpieza es del llamador»— y un día después esas 15 eran el 100 % de la fuga.

    🔒 EL LLAMADOR NO SE ACUERDA.

## 4 · ④ LA PROPUESTA · qué debe volverse guard y qué debe quedarse como acta

**No se implementa nada de esto en este ticket.** Es la propuesta que el encargo pide.

### Las tres preguntas, y hacen falta las TRES en sí

1. **¿Se puede volver a correr con sólo el árbol delante?** Sin que nadie le pase una ruta, sin
   red, sin base, sin navegador, sin una ruta absoluta de otro worktree. Si no → **acta**, y no
   hay discusión: no es que nadie la corra, es que **no se puede**.
2. **¿Su propiedad sigue importando HOY, y hay víctima si se rompe?** Un censo del PASO 0 de un
   ticket ya cerrado midió para decidir; su valor es histórico. Si no hay víctima → **acta**.
3. **¿Su veredicto es binario y su rojo nombra el sitio?** Un guard que dice «hay 12» sin decir
   cuáles se arregla apagándolo. Si no lo tiene, **primero se le da eso**; convertirlo antes es
   fabricar el guard ruidoso que el encargo avisa que se acaba desactivando.

### Lo que sale al aplicarlas

**8 candidatos** de 166 mediciones (**5 %**), y mirándolos uno a uno se quedan en ~5: dos son
herramientas que el detector aún cuenta como medición (`setup-stripe-prices.mjs`,
`romper-los-quince.mjs`) y uno ya lo lanza `npm run guards:entrada`.

```
scripts/censo-bancos-fijados.mjs        scripts/censo-eventos-de-pasarela.mjs
scripts/censo-peso-prefijos.mjs         scripts/censo-mudez.mjs
scripts/verificar-evidencia-tanda.mjs
```

Muy por debajo de la mitad, que es lo que el encargo pedía sospechar. **Y el orden importa:
primero las 7 que SÓLO AVISAN**, porque ahí el cálculo ya está hecho y sólo falta decidir si esa
propiedad se exige o no se exige. Convertir un aviso en un `assert` cuesta una línea; escribir un
guard nuevo cuesta una tanda.

### Y lo que NO debe convertirse, dicho igual de claro

- **Las 44 actas de `docs/master/evidencias/`.** No se convierten ni se borran. Son el registro de
  lo que se midió, con su fecha. Lo que no vale es una medición vieja SIN fecha presentándose como
  actual — y eso ya lo vigila `scrum737`.
- **Las 68 atadas a algo efímero.** No pueden ser guards aunque se quiera.
- **Ninguna cuya propiedad no tenga víctima hoy.** Un guard sin víctima es ruido con autoridad.

## 5 · Los controles, EJECUTADOS

### 🔴 POSITIVO · el censo de SCRUM-864 sale en «no lo corre nadie», Y POR EL EJE CORRECTO

```
docs/master/evidencias/scrum864/censo-mkdtemp.mjs
   ¿lo ve como medición? sí   |   ¿lo ejecuta algo? NADIE   |   a mano: no
```

**Y la primera versión de este censo lo daba por VIVO.** Decía «lo ejecuta la TANDA» porque el
guard de SCRUM-864c lo NOMBRA en su cabecera para explicar por qué existe, y yo estaba aplicando
el extractor de rutas por texto plano también a los ficheros JS: una ruta escrita en un comentario
contaba como ejecución. **El mismo defecto que este ticket mide, cometido por el instrumento que
lo mide.** Lo cazó este control, que para eso estaba. En los ficheros JS ahora decide sólo el AST,
que no ve comentarios.

### ✅ NEGATIVO · un censo que SÍ se ejecuta desde `tests/` sale limpio

```
scripts/_temporales-en-el-arbol.mjs                     → TANDA
scripts/_censo-mkdtemp.mjs                              → TANDA
scripts/verificacion-s5/censo-instrumentos-sin-caso.mjs → TANDA
```

Los tres tienen «censo» en el nombre igual que el positivo: **la diferencia la hace quién los
invoca, no cómo se llaman.** Sin este control, un detector que se guiara por el nombre habría
pasado los dos.

### SUELO · sobre un árbol sin mediciones, dice CIEGO

Está en el test ④ y aborta con motivo en vez de publicar «0 dormidas».

### El caso conocido del instrumento, en la tanda

`tests/scrum927-el-censo-de-los-censos.test.mjs` — 4 casos, fabricados, en los dos sentidos:
distingue medición de herramienta, no se guía por el nombre, **una mención no es una ejecución**,
una cadena muerta sigue muerta, y separa VIGILADA / SÓLO AVISA / APARCADA.

## 6 · Lo que esta tanda NO ha medido

1. **Si cada excepción aparcada sigue siendo correcta.** Eso es mirar su sujeto, una por una. Lo
   que se sabe es que nada lo comprobaría si dejara de serlo.
2. **Cuántas de las 68 dormidas midieron algo que hoy sería distinto.** Habría que correrlas, y
   varias no se pueden correr.
3. **La categoría (c) del encargo —«corrían y se rompieron»— no se ha podido separar** de la (a)
   con datos: distinguir «nació sin que nadie la llamara» de «la llamaban y dejaron de hacerlo»
   exige leer el historial de cada fichero, no su estado. Lo digo en vez de repartir a ojo.
4. **El coste del instrumento** (~2-10 s por pasada): medido una sola vez y con varianza alta. No
   afirmo nada sobre su rendimiento, que es de lo que me corrigieron ayer.

## 7 · Errores míos

1. **Mi censo contaba menciones como ejecuciones**, exactamente el error que el ticket prohíbe.
   Lo cazó el control positivo. Está contado arriba, en §5, porque es el error más instructivo de
   la tanda.
2. **Un `return` donde iba un `continue`** abortaba el barrido de vigilancia en el primer fichero
   sin imports nombrados. Lo destapó que las cifras no se movieran tras un cambio que tenía que
   moverlas: cuando el instrumento y la expectativa se contradicen, se mira el instrumento.
3. **Acusé en falso a dos listas al revisarlas a mano.** `DECLARADOS` (149 elementos) y
   `PARES_SIN_TESTIGO_CONGELADOS` (87) me parecieron aparcadas; la primera está vigilada a través
   de dos saltos (una función exportada y un renombrado) y la segunda resultó ser la que destapó
   la categoría «sólo avisa». Con 149 elementos, publicarla como aparcada habría torcido el
   titular entero.
4. **Mi primer criterio de «medición» contaba backups y migraciones de Stripe** como mediciones
   dormidas. Habría publicado un 42 % inflado con ficheros que nadie espera ver correr solos.
5. **Repetí el error que me corrigieron ayer.** Escribí «cerró 27 sitios» en un comentario, sin
   fecha, y `scrum737` lo cazó — la misma frase que ayer tuve que arreglar en el otro fichero. La
   corregí reformulando, que es la opción ② de las cinco que ese guard ofrece: ahora la frase no
   dice número y remite al registro, donde la cifra vive CON su fecha.
6. **Mi módulo disparó `scrum746`** («punto de conexión nuevo sin comprobar destino»), porque
   nombra `PrismaClient` y `DATABASE_URL` — los BUSCA en el AST de otros ficheros para separar
   una medición de una herramienta que toca la base. Se ha declarado en `NO_SON_PROBLEMA` con su
   motivo, que es una de las dos salidas que el propio guard ofrece. **No se ha tocado lo que el
   guard exige** (regla 41). Y tiene su gracia: es una excepción declarada, con motivo, en una
   lista VIGILADA —el test comprueba que sus miembros existen y siguen siendo de sólo lectura—,
   o sea justo lo que este ticket llama una excepción bien hecha.

## 8 · Ficheros

| fichero | qué |
|---|---|
| `scripts/_censo-de-censos.mjs` | el instrumento: qué mide, quién lo ejecuta, y las excepciones por categoría |
| `tests/scrum927-el-censo-de-los-censos.test.mjs` | su caso conocido, en los dos sentidos. **No es un trinquete** |
| `docs/master/evidencias/scrum927/censar.mjs` | el acta de esta tanda, y lo dice en su cabecera |
| `docs/master/evidencias/scrum927/salida-censo.txt` | las cifras de arriba, tal y como salieron |
| `tests/scrum746-barrera-y-punto-de-conexion.test.mjs` | +1 línea en `NO_SON_PROBLEMA`, con su motivo (§7.6) |

---

# SCRUM-927b · Contar no es avisar: la única que estaba en la tanda, exigida

**Medido contra:** `origin/main` = `a863416b5d303b4016e68a6134eac2908627679f` · 2026-09-17T21:25:53+01:00

**Rama:** `scrum-927b-contar-no-es-avisar`

> ⛔ **Sólo se convierte UNA.** Las otras seis quedan nombradas con su motivo (§2) y sin tocar.
> ⛔ Ninguna de las 94 ya vigiladas · ninguna evidencia fechada borrada · sin estado ni flag
> nuevos (27) · sin dependencias (36).

---

## 1 · ① Lo convertido, y por qué era la única

`PARES_SIN_TESTIGO_CONGELADOS` — 87 elementos, `scripts/_anclas-sin-testigo.congelado.mjs`,
exigido desde `tests/scrum525d-anclas-que-apuntan.test.mjs`.

Ese test tenía **dos mitades y sólo una con dientes**:

| | qué vigila | antes | ahora |
|---|---|---|---|
| un par NUEVO sin testigo | que la deuda no crezca | `assert.fail` | igual, no se toca |
| el conjunto que **ENCOGE** | que una línea que ya no hace falta se recoja | 🔴 `console.log` | ✅ `assert.deepEqual` |

La intención estaba bien: el cálculo ya estaba escrito, y el mensaje hasta explicaba cómo
recogerlo. Lo que faltaba era el mecanismo. Un aviso dentro de una tanda de más de siete mil
tests no lo lee nadie.

    🔒 Contar no es avisar — y avisar no es exigir.

**Y NO destapa deuda de nadie.** Antes de convertir se volvió a medir contra el `main` de ahora
—no contra la medición de hace unas horas, que es lo que el encargo avisaba— y salió en verde:
`0 pares nuevos sin testigo · congelados 87`, sin un solo muerto. Nace en verde.

### Por qué importa que encoja, y no es cosmética

Una entrada que ya no excluye a nadie **no es inofensiva**: deja una puerta abierta con la
etiqueta de otro. El día que alguien vuelva a citar ese par sin testigo, el trinquete de arriba lo
tomará por deuda vieja y lo dejará pasar. Es la misma forma del defecto de SCRUM-864, una capa más
arriba: la excepción sobrevive a su motivo.

## 2 · ② Las otras seis · por qué NO se tocan

| lista | elem | dónde | por qué no |
|---|---|---|---|
| `CONOCIDOS` | 5 | `docs/…/SCRUM-863/censo-region-863.mjs` | **Acta fechada.** Un acta con su fecha es un dato, no un defecto |
| `EXCLUIDAS` | 1 | `docs/…/SCRUM-863/censo-region-863.mjs` | Acta fechada |
| `EXCLUIDAS` | 1 | `docs/…/SCRUM-523/censo-523.mjs` | Acta fechada |
| `CONOCIDOS` | 4 | `scripts/guard-contraste.mjs` | **Fuera de alcance:** necesita Edge para saber si quedaría verde |
| `SIN_DTO` | 3 | `scripts/guard-descuentos-en-el-detalle.mjs` | Fuera de alcance, por lo mismo |
| `CONOCIDOS` | 2 | `scripts/censo-bancos-fijados.mjs` | 🔴 **Los dos defectos a la vez** (abajo) |

### Los dos guards de navegador · qué haría falta EXACTAMENTE para decidirlos

No es que «no dé tiempo»: es que **no se puede medir desde aquí**. Los dos corren fuera de
`npm test` y los lanza CI a través de `npm run guards:visuales`, que deriva su lista de los
`guard:*` de `package.json`. Convertir su aviso en un rojo sin poder ejecutarlos antes es
**fabricar cobertura aparente**: quedaría un `assert` cuyo resultado nadie ha visto nunca, en un
job que sí corre en CI.

Para decidirlos hace falta, en una máquina con Edge:

1. `npm run guard:contraste` y `npm run guard:descuentos-en-el-detalle`, y **leer si sus listas
   `CONOCIDOS` / `SIN_DTO` tienen hoy algún elemento muerto**;
2. si lo tienen, eso es deuda que alguien decide —no se convierte y ya—;
3. si no, la conversión es la misma línea que la de aquí, y entonces sí.

Son dos comandos. Lo que no vale es escribir el `assert` a ciegas y descubrirlo en CI.

### 🔴 `censo-bancos-fijados.mjs` es un HALLAZGO, no un pendiente

Está en la **intersección de los dos defectos que mide este ticket**: su lista **sólo avisa** Y
**no lo corre nadie**. Convertir su `console.log` en un `assert` no cambiaría absolutamente nada,
porque no hay quien ejecute el fichero donde ese `assert` viviría.

Es el ejemplo puro de por qué las dos mitades de SCRUM-927 son el mismo problema: **una medición
sin mecanismo y un mecanismo que nadie dispara son la misma frase, dicha de dos maneras.** Y
enseña el orden correcto: darle dientes a algo que nadie corre es empezar por el final.

## 3 · ③ La regla · qué debe acabar en `assert` y qué informa legítimamente

El criterio propuesto era de tres, y se ha comprobado contra las siete, con ① y ② **medidos** por
el instrumento de la fase a y ③ **declarado** con su motivo (no es derivable del código):

```
elem  lista                          ①tanda ②sin-externo ③víctima  veredicto
  87  PARES_SIN_TESTIGO_CONGELADOS   true   true         SÍ        CONVERTIR
   5  CONOCIDOS   (SCRUM-863)        false  false        no        acta fechada — no se toca
   4  CONOCIDOS   (guard-contraste)  false  false        ?         fuera de alcance
   3  SIN_DTO     (guard-descuentos) false  false        ?         fuera de alcance
   2  CONOCIDOS   (censo-bancos)     false  true         no        los DOS defectos a la vez
   1  EXCLUIDAS   (SCRUM-523)        false  false        no        acta fechada — no se toca
   1  EXCLUIDAS   (SCRUM-863)        false  false        no        acta fechada — no se toca
```

**Sí sostiene** — clasifica las siete sin dejar ninguna a medias. Pero con una precisión que la
tabla hace visible y que el enunciado no tenía:

> 🔴 **Los tres criterios NO son independientes: ③ depende de ①.** Si nadie la corre, su rotura no
> tiene víctima hoy — y no porque la propiedad no importe, sino porque **nadie se enteraría
> igual**. Por eso `censo-bancos-fijados` sale «sin víctima» teniendo una propiedad perfectamente
> razonable detrás.

Así que la regla se aplica **en orden, y ① es una puerta, no un factor**:

1. **¿Está en la tanda?** Si no → no se convierte *todavía*; primero se decide si debe correr.
   Convertir aquí no añade cobertura: añade un `assert` que nadie ejecuta.
2. **¿Es comprobable sin nada externo?** Si necesita navegador, red o base → no se convierte sin
   haberlo medido antes en un sitio donde se pueda. Un rojo que nadie ha visto no es un control.
3. **¿Su rotura tiene víctima hoy?** Si la propiedad ya no le importa a nadie, lo honesto es
   retirar la lista, no ascenderla a guard.

Y una cuarta pregunta que no decide *si*, pero sí *en qué orden*: **¿el cálculo ya está escrito?**
Donde el aviso ya computa su consecuencia —como aquí— convertir cuesta una línea. Donde no, hay
que escribir el instrumento antes, y eso es otra tanda.

    🔒 Un acta que informa está bien. Lo que no vale es una promesa de vigilancia sin mecanismo.

## 4 · Los controles, EJECUTADOS

### 🔴 EL QUE DECIDE · se le mete un MUERTO al conjunto, y se compara antes con después

Un par que no cita en ninguna parte (`docs/legal/NO-EXISTE-927B.md # fichero-inventado-927b.ts`):
en cuanto entra en la lista, es exactamente lo que el trinquete dice vigilar.

```
① ANTES (forma vieja, console.log)  →  ¿la tanda se entera? 🔴 NO — sigue VERDE con el muerto dentro
② DESPUÉS (con el assert)           →  ¿la tanda CAE? sí   ·   ¿NOMBRA el elemento? sí
③ POST-CONDICIÓN (árbol intacto)    →  pasa ✅
```

Los dos sentidos: **rota → cae · intacta → pasa**. Y el ① es el que da sentido al ②: sin él,
«ahora cae» no diría si antes también caía.

### MUTACIÓN · que entró, y que entró UNA vez

El banco no acepta un `replace` que no encuentre su texto **ni uno que lo encuentre dos veces**:
exige exactamente una ocurrencia y aborta con el motivo. Todo se restaura byte a byte, verificado
por SHA-256.

### SUELO · y disparó de verdad

La primera versión del suelo exigía «que sigan siendo 7 las que sólo avisan» y **se puso CIEGO**:
ya eran 6, porque esta misma fase acababa de convertir una. El suelo tenía razón y el enunciado
estaba mal. Ahora comprueba lo correcto y es más fuerte: **que las siete de la fase a sigan
localizables y que exactamente UNA haya pasado a vigilada.** Si mañana alguien convierte otra sin
decirlo, salta.

### ✅ POSITIVO · el árbol de hoy sigue verde

`tests/scrum525d` — 8 de 8, con `0 pares nuevos sin testigo · congelados 87`.

## 5 · Lo que esta fase NO ha medido

1. **Si las listas de los dos guards de navegador tienen muertos hoy.** Hace falta Edge; queda
   escrito en §2 qué dos comandos lo contestan.
2. **Si las 27 aparcadas de la fase a siguen siendo correctas.** Eso es mirar el sujeto de cada
   una, y no es esta fase.
3. **Cuánto tarda en aparecer el primer muerto** en el conjunto de 87. Hoy son cero; si dentro de
   unas semanas siguen siendo cero, la conversión no habrá costado nada y tampoco habrá probado
   nada. Eso sólo lo dice el tiempo.

## 6 · Errores míos

1. **Escribí el suelo contra el estado de antes de mi propio cambio**, así que se puso CIEGO en su
   primera ejecución. Es un error real —el suelo de un banco tiene que aguantar el cambio que ese
   banco mide— y, de paso, la prueba de que el suelo funciona. Reescrito a algo más fuerte que lo
   que pedía el encargo.
2. **Mi frase de la fase a era optimista**: «primero las 7 que sólo avisan, porque el cálculo ya
   está hecho». Medido: sólo **1 de 7** está en la tanda. La corregí yo mismo anoche, antes de
   que llegara este encargo, y el orquestador la asumió; queda escrita aquí porque una frase
   optimista repetida por otro se convierte en un plan.

## 7 · Ficheros

| fichero | qué |
|---|---|
| `tests/scrum525d-anclas-que-apuntan.test.mjs` | el `console.log` pasa a `assert.deepEqual`, con el mensaje que NOMBRA los pares |
| `scripts/_anclas-sin-testigo.congelado.mjs` | su cabecera decía media verdad: ahora encoger sin recoger también tumba el guard |
| `docs/master/evidencias/scrum927b/el-que-decide.mjs` | el antes y el después, con el muerto inyectado |
| `docs/master/evidencias/scrum927b/la-regla.mjs` | la regla de tres, comprobada contra las 7, con su suelo |
