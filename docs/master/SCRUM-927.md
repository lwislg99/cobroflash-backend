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
