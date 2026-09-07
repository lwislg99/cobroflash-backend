# SCRUM-810 · El suelo hablaba 63 pérdidas tarde: ahora habla en la primera

**Fecha:** 7-sep-2026 · **Carril:** proceso · vigilancia de la vigilancia · **Gate:** sin gate — corre en `npm test`
**Medido contra:** `origin/main` = `6fb51ab77713af1261dcf2e3f7819545c57c35b6` · 2026-09-07T03:16:20+01:00

> Sale del hallazgo del final de [SCRUM-804](SCRUM-804.md), donde se midió y **no** se arregló.
> Aquí se arregla. Y el lector de declaraciones **NO se toca**: es SCRUM-757, y ya ha mordido a
> tres sesiones en un día.

---

## Obligación (a) · cuánto puede encoger hoy sin que salte nada — PROVOCADO, no calculado

Sobre una **copia** del árbol, quitando declaraciones **de una en una** y preguntándole al suelo
después de cada una:

```
SUELOS CABLEADOS : 20 guards / 54 declaraciones
REALIDAD HOY     : 41 guards / 117 declaraciones
el suelo con el árbol tal cual: CALLA (verde)

quitando declaraciones DE UNA EN UNA…
>>> EL SUELO HABLÓ en la 64ª. Antes se habían perdido 63 EN SILENCIO.
```

**Sesenta y tres declaraciones —el 54% de la vigilancia— podían desaparecer sin que nada lo dijera.**

> ⚠️ **Corrección de un fuera-de-uno mío.** La primera lectura de la sonda dijo «habla en la 65,
> 64 perdidas». Estaba mal por uno: 117 − 63 = 54 **iguala** el suelo y pasa; 117 − 64 = 53 ya no.
> Lo cazó el propio test al fijar los dos números pegados. Va corregido en todas partes.

Y la pérdida **de a una OCURRE**: el 7-sep tres sesiones escribieron un campo no literal en su
declaración y el lector la descartó. Ninguna de esas tres habría movido un suelo de 54.

---

## Obligación (b) · de qué se deriva el suelo — el filo, contestado antes de escribir nada

Tres candidatos. Los dos primeros están descartados **por construcción**:

| | |
|---|---|
| ① **Número cableado** | Un censo **congelado el día que se escribió**. Es lo que hay, y medido arriba: 63 declaraciones por detrás. |
| ② **Derivado de la población de HOY** | **Circular**: lo que el suelo vigila **es** la población, así que un suelo calculado desde ella no puede hablar nunca. No es un suelo, es un espejo. |
| ③ ✅ **Derivado de `origin/main`, POR GUARD** | Rompe el círculo: main es un árbol **distinto** del que se juzga. Y se pone al día **solo**, sin que nadie se acuerde de subir un número. |

### El filo del encargo: ¿y la retirada LEGÍTIMA?

Contestado en el diseño, no después:

- **Crecer es gratis.** Añadir guards o declaraciones no dispara nada. *Un suelo que salta en cada
  PR se desactiva antes que uno que no salta nunca* — y hay un test que fija esa mitad.
- **Perder habla a la primera.** No hacen falta 63: que un guard que declaraba tres pase a declarar
  dos ya lo dice, **y nombra cuál**.
- **Retirar a propósito cuesta UNA LÍNEA**: el guard se apunta en `RETIRADAS_A_PROPOSITO` con su
  motivo y su fecha, en el mismo commit. El diff lo dice en voz alta — que es exactamente lo que el
  mensaje del suelo viejo ya pedía y nadie hacía nunca, porque nunca llegaba a hablar.

### 🔴 Y una corrección que encontró el control positivo, no yo

La primera versión comparaba contra **la punta de main**. El control positivo salió **rojo**: main
había avanzado con SCRUM-804 y sus 3 declaraciones, y esta rama «había perdido» algo que **nunca
tuvo** — sólo iba por detrás. Contra la punta, **toda rama que no acabe de nacer sale roja**, que es
la definición del suelo que se acaba desactivando.

**La referencia es la BASE DE FUSIÓN de la rama con main**, no su punta: así se mide sólo lo que
*esta* rama hizo, que es de lo que responde.

---

## Obligación (c) · ¿tienen el mismo desfase los demás suelos? Sí, y es de la casa

Censo por AST, **sin lista cableada**: una constante numérica cuyo nombre dice que es mínimo o tope.
**Control positivo:** el detector tiene que ver `SUELO_GUARDS` y `SUELO_DECLARACIONES`, que sabemos
que existen. Los ve.

Y el desfase se **mide**, no se estima: se sube el suelo hasta que su guard se rompe; el último
valor que aguanta **es** la población de hoy.

```
POBLACIÓN : 938 ficheros · 66 suelos numéricos cableados (49 en tests/, 17 en scripts/)
MEDIDOS   : 42 de 48 suelos de tests/  ·  6 no medibles
HOLGURA MEDIA: 27% de la población puede perderse en silencio
suelos AL DÍA (desfase 0): 14
```

| desfase | suelo | valor | población real | fichero |
|---|---|---|---|---|
| **+344** | `MINIMO_ENTRADAS` | 90 | **434** | `scrum391-guards-declarados-presentes` |
| **+235** | `MINIMO_DECLARACIONES` | 90 | **325** | `scrum391-guards-declarados-presentes` |
| +122 | `MINIMO_PARES` | 300 | 422 | `scrum461-censo-no-encoge` |
| +122 | `MINIMO` | 300 | 422 | `scrum733-el-censo-no-se-encoge-en-silencio` |
| +68 | `MINIMO_QUE_FILTRAN` | 196 | 264 | `scrum243-tenencia-lectura` |
| +62 | `MINIMO_RUTAS_ESCRITURA` | 50 | 112 | `scrum337-aviso-atado-al-bloqueo` |
| +55 | `MINIMO_LOCALES` | 34 | 89 | `scrum274-huella-estaticos` |
| +53 | `MINIMO_SCRIPTS` | 31 | 84 | `scrum274-huella-estaticos` |
| +47 | `SUELO_FICHEROS` | 40 | 87 | `public-js-parsea` |

**El del arnés (54%) es peor que la media, pero no una excepción: es la enfermedad de la casa.**
Sólo 14 de 42 suelos están al día.

> **Límite declarado:** para las constantes `TOPE_*` / `LIMITE_*` la dirección está invertida —subir
> un máximo **afloja**, no aprieta—, así que su «población» medida significa «hasta dónde podría
> subirse el tope», no un hueco de cobertura. Van en la tabla completa, no en el titular.
> Los **17 suelos que viven en `scripts/`** no se pueden correr sueltos y quedan **sin medir**: son
> el hueco de esta medición, no un cero.

---

## Obligación (d) · el impacto ANTES de conectar

Cada rama viva se compara con **su propia base de fusión**, que es lo que hará el suelo de verdad.

```
ramas remotas 540 · VIVAS (por delante de main) 84 · no medibles 0
  cuya BASE ya tenía declaraciones (las ÚNICAS que pueden perder algo) :  6
  cuya base NO tenía ninguna (su cero NO informa)                      : 78

>>> SE PONDRÍAN ROJAS: 0 de 6
```

| estado | base → rama | rama |
|---|---|---|
| verde | 120 → **127** | `scrum-716-el-verde-ciego` |
| verde | 120 → **122** | `scrum-755-el-contador-que-cuadro-solo` |
| verde | 107 → **109** | `scrum-795-quien-crea-clientes` |
| verde | 57 → 57 | `scrum-592-doc02-verificacion` |
| verde | 12 → 12 | `scrum-598-cierre-medido` |
| verde | 12 → 12 | `scrum-606-albaran-desde-presupuesto` |

**Conectarlo hoy no cuesta ni un rojo**, y se ve POR QUÉ: tres ramas **crecieron** y tres se
quedaron igual. Ninguna encogió. Que es justo lo que decía el diseño: crecer es gratis.

### 🔴 Y el primer cero era FALSO

La primera pasada dijo «0 de 83 ramas vivas» y me lo iba a creer. El control lo tumbó: sobre la
rama que usé de muestra, `declaracionesEn` devolvía **0 guards / 0 declaraciones** tanto en la base
como en la rama — su base es **anterior al mecanismo de declaraciones**, así que no tenía nada que
perder. Setenta y ocho de las 84 están en ese caso: **su cero no informa**.

El comparador sí ve: con una referencia trucada (un guard de más), lo caza y lo nombra
(`inventado.test.mjs: 7 → 0`). *Cero sobre población vacía no es un cero* — la población que
importa son 6, no 84.

### Dónde queda CONECTADO

En `npm test`, que es donde existe un artefacto (el scratchpad es efímero y el CI no lo ve). El
control positivo del propio guard **es** la conexión: si esta rama pierde vigilancia respecto a su
base, ese test se pone rojo y nombra el guard. No hace falta tocar el arnés — y no se toca:
`cayo()`, `murioElFichero()`, `MUERTE_CUENTA_COMO` y los veredictos quedan intactos.

---

## Los controles

| control | resultado |
|---|---|
| 🔴 **EL QUE DECIDE** · los dos números pegados | suelo cableado: **calla con 63 pérdidas**, habla en la 64ª · suelo contra main: **habla en la 1ª**. Fijado en el test, no sólo aquí. |
| ✅ **POSITIVO** · con el árbol tal cual, verde | el suelo **calla**. Y el crecimiento no dispara nada: hay un test propio para esa mitad, porque *un suelo que salta siempre se desactiva antes que uno que no salta nunca*. |
| ✅ **Retirada legítima sin pelea** | una línea en `RETIRADAS_A_PROPOSITO` y el suelo calla para ese guard. Test propio: *«si duele, el suelo está mal puesto»*. |
| 🔴 **No haber mirado NO es verde** | si no se puede leer la referencia, `medible: false` con motivo — nunca «no falta nada». |

Las **3 mutaciones declaradas** se han visto caer, **nombran su propio test**, y el fichero vuelve
**byte a byte**.

---

## LA TANDA · y los cinco trinquetes que me cazaron a mí

| | |
|---|---|
| `npm test` | **5789 tests · 5687 pass · 0 fail · 102 skipped** · exit 0 |
| `guards:entrada` | 4 guards, 21 tests, verde |
| las 3 mutaciones | caen, **nombran su propio test**, y el fichero vuelve **byte a byte** |
| censo del arnés | 43 guards · 123 declaraciones |

Meter dos ficheros nuevos puso en rojo a **cinco** guards de la casa. Los cinco tenían razón, y
ninguno es ruido — es la casa haciendo exactamente lo que este ticket defiende:

| guard | qué me dijo | qué hice |
|---|---|---|
| **SCRUM-456** | mi motivo de salto iba por variable (`skip: sinRef`): en el log, un salto mudo no se distingue de un test roto | el motivo va como **literal dentro del propio `skip`** |
| **SCRUM-474** | mi `slice(indexOf(':'))` era una **tercera implementación** de la partición `<metodo>:<pasarela>` | se quita el prefijo **conocido**, no se parte por el primer `:` |
| **SCRUM-710b** | mis `new Map([…])` metían varias cifras base **en una línea física**: dos tickets que suban números distintos chocarían | **un elemento por línea** |
| **SCRUM-723** | «ha cambiado quién nombra una referencia MÓVIL» | dados de alta el script y su guard, **con su motivo** — y es pertinente: este suelo defiende justo lo que ese guard defiende, la BASE y no la punta |
| **SCRUM-737** | una cifra sin ancla en su propia línea (`41 guards y 117 declaraciones`) | **fechada en el sitio**, sin subir el censo congelado |

---

## HUECOS DECLARADOS

1. **Los 17 suelos de `scripts/` no están medidos.** No se pueden correr sueltos como un fichero de
   test. Están censados y nombrados; el desfase de cada uno, no.
2. **6 de los 48 suelos de `tests/` no dieron número**: o su guard ya estaba rojo sin tocar nada, o
   aguanta más de 32× sin romperse (no acota). Se declaran, no se cuentan como 0.
3. **Este suelo cubre la declaración que DESAPARECE, no la que nace coja.** La declaración
   incompleta —campo no literal— ya la denuncia SCRUM-745, y hoy ha mordido tres veces. Son dos
   mitades del mismo agujero y **ninguna de las dos toca el lector de SCRUM-757**.
4. **No arreglo los otros 41 suelos desfasados.** Es hallazgo de otro carril (regla 37): están
   medidos y en la tabla, con nombre y cifra, para que se decida qué se hace con ellos.

---
---

# APÉNDICE · SEGUNDA VUELTA (7-sep-2026) — y una corrección a mi propia obligación (c)

**Medido contra:** `origin/main` = `6fb51ab77713af1261dcf2e3f7819545c57c35b6` · 2026-09-07T03:16:20+01:00

> El asesor devolvió el ticket por mi propio hallazgo: *«dejar 41 suelos decorativos mientras uno
> solo funciona es peor que antes: da la sensación de que el problema está resuelto»*. Tenía razón
> en el fondo. Lo que cambia es **por qué** estaban así.

## 🔴 Lo primero: mi (c) mezcló DOS instrumentos distintos

Dije que los otros 41 suelos eran «la enfermedad de la casa», con **27% de holgura media y sólo
14 al día**. La cifra era real. **La etiqueta, no.** Medido después, casi todos son **suelos de
ESCÁNER CIEGO**, y su holgura está puesta a propósito y escrita en su propio comentario:

| guard | lo que dice de sí mismo |
|---|---|
| `public-js-parsea` | *«el suelo va por debajo para que un borrado legítimo no lo dispare, pero **no tanto como para que un recorrido roto —que devolvería 0 o 3— se cuele**»* |
| `scrum391` | *«El suelo es un NÚMERO, y se sube a mano a propósito: **derivarlo del propio directorio haría que borrar entradas bajara el mínimo y el suelo dejara de ser suelo** (lección de SCRUM-379)»* |
| `scrum337` | *«Suelos. **No son redondos por gusto**: hoy hay 5 avisos y 95 rutas de escritura, y el margen deja…»* |
| `scrum377` | *«El tope se sube A MANO, **nunca se deriva del censo**: derivarlo haría que añadir uno subiera el techo solo»* |

Y en `scrum733` y `scrum461` —los que se llaman «no encoge»— **el anti-encogimiento ya existe
aparte**: *«si el censo ENCOGE, no se escribe, y el mensaje NOMBRA lo que desaparece»* junto a
*«CONTROL NEGATIVO: crecer es lo normal y no pide permiso»*. Eso es este mecanismo, ya construido
ahí. El número de al lado es otra cosa.

**Conclusión: el suelo del arnés era la ANOMALÍA, no la regla.** Era un trinquete anti-encogimiento
disfrazado de número —su mensaje decía «EL CENSO HA ENCOGIDO»—, y por eso su arreglo era el bueno.

## Pero eso no los deja sin trinquete — y ahí el asesor acierta

Un suelo de ceguera y un trinquete anti-encogimiento son **dos instrumentos**, y **faltaba el
segundo**. Así que se añade, **sin mover ni un umbral**: cada número se queda donde está haciendo
su trabajo, y el trinquete se pone al lado.

### La medida que decidió, y decidió CONTRA mi lectura

Mi hipótesis era «convertirlos fabricaría rojos». **Falsa, medida.** Sobre las **85 ramas vivas**,
cada una contra SU base de fusión:

| población | bajan | suben | igual |
|---|---|---|---|
| `ficheros-js-de-public` | **0** | 3 | 82 |
| `entradas-de-master` | **0** | 29 | 56 |
| `scripts-del-dashboard` | **0** | 3 | 82 |

**Ni una rama legítima baja ninguna.** Y el cero está controlado: las tres sondas **se mueven**
entre árboles (87→62, 436→226, 84→60 contra un main de mediados de agosto), así que no es un cero
de no haber mirado. La primera pasada de esta misma sonda dio `null` en las tres y **el control lo
cazó**: a `git()` le faltaba `.trim()` y el SHA llevaba un salto de línea, así que toda ref era
inválida — y el resumen llegó a imprimir «✅ ninguna baja» sobre **cero ramas medibles**.

## Obligación 1 · el MISMO mecanismo, no uno parecido

`scripts/_suelo-contra-main.mjs` —la pieza de la primera vuelta— crece con:

- **`DIRECCIONES`**: `no-encoger` y `no-crecer`. **Un TOPE es el mismo trinquete del revés**, no
  otro mecanismo. Y eso responde a la objeción de `scrum377`: derivar del censo de HOY sí subiría
  el techo solo; derivar de **la base de fusión** hace que añadir uno **salte**.
- **`arbolDeLaBase()`**: materializa la base en un temporal (1,6 s la primera vez, 0,03 s
  cacheada) para poder correr **el censo de hoy sobre el árbol de entonces** — si no, se
  confundiría «la población encogió» con «el censo cambió».
- **`poblacionesContraLaBase()` / `sueloDerivado()`**: el mismo «crecer gratis, perder habla a la
  primera, retirar a propósito cuesta una línea».

Y **un solo guard nuevo con REGISTRO** (`tests/scrum810b-los-suelos-derivados.test.mjs`) en vez de
editar 15 guards ajenos: añadir una población es una entrada, y no se toca ni un fichero de otro
ticket con cinco sesiones trabajando a la vez.

> **`tar --force-local`**: sin él, GNU tar lee `C:\Users\…` como `host:ruta` y contesta *«Cannot
> connect to C: resolve failed»*. En Windows no es opcional.

## Obligación 3 · lo que NO se deriva, declarado

**Criterio mecánico, con controles** (scrum553 → derivable; scrum377 y scrum694 → no; los tres
aciertan): un suelo sólo se puede derivar si **su censo acepta una raíz**. Si está cableado a su
propio `RAIZ` —`function censo() {}` sin parámetro—, derivarlo exige reescribir el censo de otro
ticket, que es otro carril (regla 37).

| | |
|---|---|
| suelos censados en `tests/` | **48** |
| **derivables** (su censo acepta una raíz) | **15** |
| **no derivables** (censo cableado a su `RAIZ`) | **33** — declarados, con el criterio escrito para que se conviertan de uno en uno |
| de los 15 derivables, ya a desfase ≤ 1 | **13** — no hay nada que apretar en ellos |

Y uno **declarado y NO conectado a propósito**: **`bocas-de-emision`**. Su censo corre en los dos
árboles (11 y 11, verificado), pero su **impacto no se ha podido medir**: extrayendo sólo `src/`
el control salió **«NO MIDE»** con **79 de 86 ramas no medibles**. Un «0 bajan» sobre 7 ramas no es
el cero que pide la obligación 2, así que **no se conecta**. Medirlo con el árbol entero son ~5 GB:
es otra tarea, no un descuido de ésta.

## Obligación 4 · el titular, y por qué el «14 de 42» era la métrica equivocada

«Al día» sólo significa algo para un **trinquete**. Para un suelo de **ceguera**, la pregunta no es
cuánto se separa de la población, sino **qué escáner roto caza**. Medido sobre los 37 mínimos
(los 5 topes van aparte, su dirección es la inversa):

| | |
|---|---|
| cazan un escáner que devuelve **0** | **37 de 37** |
| cazan un escáner que devuelve **la mitad** | **29 de 37** |

Los **8 que no cazarían medio escáner roto** —ésa es la lista que sustituye a mi «14 de 42»:

| cobertura | suelo | población |
|---|---|---|
| **21%** | `MINIMO_ENTRADAS = 90` | 434 |
| 25% | `SUELO_SELECT = 1` | 4 |
| 26% | `MINIMO_REFERENCIAS = 10` | 39 |
| **28%** | `MINIMO_DECLARACIONES = 90` | 325 |
| 37% | `MINIMO_SCRIPTS = 31` | 84 |
| 38% | `MINIMO_LOCALES = 34` | 89 |
| 45% | `MINIMO_RUTAS_ESCRITURA = 50` | 112 |
| 46% | `SUELO_FICHEROS = 40` | 87 |

**Y el número que sí cambia:** poblaciones con un trinquete que habla **a la primera pérdida**:

| | antes | ahora |
|---|---|---|
| poblaciones con trinquete derivado | **1** (las declaraciones del arnés) | **4** |

Tres de las ocho de esa tabla —`MINIMO_ENTRADAS`, `MINIMO_SCRIPTS`, `SUELO_FICHEROS`— **ya no
dependen sólo de su número**: aunque el escáner devuelva 100 de 434, el trinquete lo dice.
No se ha subido ni bajado un solo umbral: se ha añadido el instrumento que faltaba.

## Y un SEXTO trinquete de la casa me cazó otra vez

**SCRUM-258 · «ningún script guarda estado en una ruta fija compartida por la máquina».**
`arbolDeLaBase` extraía a `%TEMP%/yaqu-base-<sha>` — una ruta fija. En esta máquina hay **cinco
árboles de trabajo**, y dos en la misma base habrían compartido ese directorio: exactamente el
defecto de la nota de turno que aquel ticket persigue.

Arreglado con `mkdtempSync`, que es la forma que ese guard sanciona. **El precio es real y se
declara:** se pierde la caché entre procesos (1,6 s por proceso en vez de 0,03 s), y a cambio dos
sesiones no se pisan un árbol. Lo que se crea se recoge al salir — comprobado: una corrida limpia
no deja nada en el temporal.

---

## HUECOS DECLARADOS DE ESTA VUELTA

1. **33 de 48 suelos siguen sin trinquete derivado**, por el criterio mecánico de arriba. No es
   «otro carril» como dije antes: es una tarea por guard, y el criterio para hacerla está escrito.
2. **`bocas-de-emision` no se conecta** porque su impacto no se ha medido. Declarado en el propio
   registro, no en un comentario suelto.
3. **Los 17 suelos de `scripts/`** siguen sin medir (heredado de la primera vuelta).
4. **La cobertura «caza medio escáner roto» es una métrica nueva**, no un umbral: no se ha usado
   para mover ningún número, sólo para nombrar los 8 que quedan expuestos.
