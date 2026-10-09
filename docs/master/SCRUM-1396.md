# SCRUM-1396 · El censo de temporales emparejaba por NOMBRE: arreglar una fuga ponía en verde a todas las que se llamaban igual, y 24 llamadas de hoy dependían de eso

**Medido contra:** `origin/main` = `c92d8182697e15667652b786d76a5f8398c2f770` · 2026-10-06T13:28:51Z
(J6 del equipo de Javier, sesión `jv-j6l`; encargo del orquestador `cobroflash-backend-90`. La medición que abre el
ticket es de J6k, del 1-oct.)

A9: comprobación → `tests/scrum1396-el-borrado-de-otra-funcion.test.mjs`

## En corto

`scripts/_censo-mkdtemp.mjs` decidía qué borrado era de qué temporal por el nombre de la variable, en todo el
fichero. Ahora lo decide por la variable: dos `dir` de dos funciones ya no son el mismo.

Con el arreglo puesto, `tests/scrum864c-el-temporal-no-vuelve.test.mjs` cae sobre el árbol de hoy con **24
llamadas** que antes salían GARANTIZADA. **Este PR no puede entrar solo, y qué se hace con esas 24 es una
decisión que no es de este puesto** (§5). No se ha tocado `scrum864c`, ni su lista de declaradas, ni ninguno de
los 22 ficheros.

## 1 · El defecto, visto quedarse en verde

`evidencias/SCRUM-1396/sonda-n-menos-uno.mjs` le pasa fuentes fabricadas al `clasificaFuente` de verdad.
Salida con el censo de `c92d8182` en `salida-sonda-c92d8182-por-nombre.txt`; con el de esta rama, en
`salida-sonda-por-variable.txt`. Población: 13 llamadas en 5 fuentes.

| Fuente | por nombre (`c92d8182`) | por variable (esta rama) |
|---|---|---|
| `b()` crea `dir` y no lo borra | SIN_LIMPIEZA | SIN_LIMPIEZA |
| lo mismo, y otra función `a()` borra su `dir` en un `finally` | **GARANTIZADA** | SIN_LIMPIEZA |
| control: el de `a()` se llama distinto | SIN_LIMPIEZA | SIN_LIMPIEZA |
| cuatro funciones que fugan un `dir` | 4 de 4 acusadas | 4 de 4 acusadas |
| las mismas cuatro, arreglada sólo la primera | **0 de 3 fugas vivas acusadas** | 3 de 3 acusadas |

Las tres primeras son las de la tabla del ticket. No estaban guardadas en el repositorio (vivían en la carpeta de
trabajo de la sesión del 1-oct): se han reconstruido de esa tabla, y ahora están en la sonda.

## 2 · A quién afecta: la pregunta del ticket y la población de verdad no son la misma

El ticket pedía contar los ficheros con dos o más temporales del mismo nombre. Sobre `c92d8182`
(`evidencias/SCRUM-1396/censo-nombres-repetidos.mjs`, salida en
`salida-censo-nombres-repetidos-c92d8182-por-nombre.txt`):

- 2.509 ficheros mirados · 159 llamadas a `mkdtemp*` (154 nuestras, 4 de código ajeno, 1 declarada de 1).
- **99 ficheros con temporales · 21 con nombres repetidos** (64 creaciones, las 64 GARANTIZADA).
- Mirando esas 64 por contención —¿hay algún borrado dentro del bloque donde vive su variable?—, **1** sólo tenía
  borrados de fuera: `tests/scrum754-el-juez-que-oscila.test.mjs:345`.

Ese «1» no es el alcance. El emparejamiento por nombre no casaba sólo dos variables homónimas: casaba también el
`b.dir` de quien llama (el nombre de una propiedad) con el `dir` de la función que crea. Eso le pasa a un fichero
con un solo temporal, y la sonda de arriba, limitada a los nombres repetidos, no podía verlo.

El alcance sale de clasificar el mismo árbol con los dos censos y comparar llamada a llamada
(`evidencias/SCRUM-1396/antes-y-despues.mjs`, que importa la copia literal del censo de `c92d8182` guardada en
`censo-por-nombre-c92d8182.mjs`; salida en `salida-antes-y-despues.txt`):

| | GARANTIZADA | NO_GARANTIZADA | SIN_LIMPIEZA | ESCAPA | FABRICA |
|---|---|---|---|---|---|
| por nombre | 154 | 0 | 0 | 0 | 0 |
| por variable | 130 | 6 | 0 | 18 | 0 |

159 llamadas en los dos, ninguna sólo en uno. **Cambian 24 de las 154 nuestras** (y la declarada,
`tests/_temporal.mjs:93`, que pasa de NO_GARANTIZADA a ESCAPA y sigue declarada). De las 24, 7 están en ficheros
con nombres repetidos y 17 no.

## 3 · Las 24, leídas una a una

`evidencias/SCRUM-1396/los-que-cambian.mjs` imprime de cada una la línea que crea, la función que la contiene, el
texto de cada borrado que antes se le atribuía y cuántos llamadores tiene esa función en su fichero (salida en
`salida-los-que-cambian.txt`). Son dos formas:

- **18 ESCAPA.** Una función auxiliar crea el directorio y lo devuelve; cada llamador lo borra en su `finally` o en
  un `after`. El contador de llamadores marca dos con alguno sin borrado cubierto en su función, y leídos no lo son:
  en `scrum1424-ya-esta.test.mjs:232` quien llama es otra auxiliar, cuyos llamadores sí borran; en
  `scrum454-destructivo-sin-comprobacion.test.mjs:186-187` las llamadas son de módulo y el borrado va en `test.after`.
- **6 NO_GARANTIZADA.** La auxiliar devuelve `{ dir, limpia: () => rmSync(dir) }` y el llamador llama a esa función
  en su `finally` (`scrum252`, `scrum754:703`, `scrum757`, `scrum759`, `scrum836:83` y `:491`). Leídos los
  llamadores con `grep`: todos la llaman bajo `finally`.

Las dos frases, enfrentadas, y ninguna sustituye a la otra:

- **No hay 24 fugas.** Fuga viva demostrada hoy: 0 de 24.
- **Hay 24 sitios donde una fuga nueva sería invisible.**

**La pregunta del ticket describía una FORMA del defecto, no su población.** El censo por contención, hecho sobre
esa forma, veía 1; el censo entero ve 24.

Lo que hay son 24 sitios de la forma que `scrum864c` prohíbe desde el
17-sep —el directorio sale de la función y lo limpia quien lo recibe— y que han ido entrando en verde porque el
nombre los tapaba. En cualquiera de ellos, un llamador nuevo que no borre sale hoy GARANTIZADA. Esa cuenta de
llamadores es por contención dentro del fichero: dice dónde mirar, no prueba que no haya fuga.

## 4 · El arreglo

En `clasificaFuente`, cada identificador se resuelve a su variable preguntándoselo al compilador de TypeScript
(un programa de un solo fichero en memoria, sin librerías y sin seguir imports), y un borrado sólo cuenta para una
creación si nombra **su** variable. El `dir` de `b.dir` no es variable de nadie. Coste sobre el árbol: 591-718 ms
por nombre, 742-764 ms por variable (dos pasadas de cada uno, mismo proceso).

Si una creación no tiene variable que enlazar (el directorio va a una propiedad, o a un nombre que nadie declara)
se sigue emparejando por nombre y se cuenta aparte. Hoy son 0 de 154.

Lo que sigue saliendo GARANTIZADA, cada caso en `tests/scrum1396-el-borrado-de-otra-funcion.test.mjs`: crear y
borrar en la misma función; una variable de módulo que se llena en un `before` y se borra en un `after`;
`process.on('exit')`; el `dirname` de una ruta de dentro; y el caso que el ticket pedía no romper, comprobado sobre
el fichero real: el `process.on('exit')` de `docs/master/evidencias/SCRUM-1391/banco.mjs`.

La decisión del 17-sep sobre ESCAPA y FABRICA no se toca: siguen contando como fuga.

La línea que sale siempre (`lineaDePoblacion`, impresa por el test ⑤ también con cero):

    99 ficheros con temporales (154 llamadas, de 2513 ficheros mirados) · 21 con nombres repetidos · 200 emparejamientos fuera de ámbito, que ya no cuentan · 0 emparejadas sólo por nombre

Los 200 son pares «creación · borrado» que llevan el nombre y no la variable. Casi todos son inofensivos —cada test
con su `dir` y su `finally` los produce contra los demás—; 24 creaciones no tenían otra cosa.

Visto en rojo, con la mutación declarada en el test (la línea del filtro, a `if (false) return false;`,
`git diff --numstat` 91/5 con ella puesta): caen ① y ③ del test nuevo, y `scrum864c` vuelve a sus 4 de 4 en verde.
Con el arreglo: los 5 del nuevo en verde y `scrum864c` 3 de 4, con ③ en rojo por las 24.

## 5 · Lo que queda por decidir

`scrum864c` ③ cae en `main` con este cambio. **Decidido por el orquestador el 6-oct: la salida 4, a propósito y
declarada.** La rama se empuja con el obligatorio en rojo y el PR queda APARCADO; la 1 la coordina él con el otro
equipo, y la 2 es firma del fundador. Las cuatro, como se le llevaron:

1. **Convertir los 24 sitios a `temporal()`**, que es lo que manda el mensaje del propio guard, en un PR anterior
   que es verde con el censo viejo y con el nuevo; después entra éste. Son 22 ficheros de `tests/`, casi todos de
   otros carriles y varios del otro equipo: necesita excepción de carril escrita, o que cada dueño convierta los
   suyos.
2. **Que el censo siga al llamador** y dé por buena una auxiliar cuyos llamadores borran todos. Deja las 24 en
   verde sin tocarlas, y es relajar la decisión del 17-sep, que el ticket prohíbe tocar de paso.
3. **Declararlas en `DECLARADAS`.** Es ensanchar la lista.
4. **Dejar esta rama sin mergear** hasta que se decida. El defecto sigue en `main` mientras tanto.

## 6 · Lo que no se ha hecho

- No se ha corrido la tanda entera ni el meta-guard: sólo los dos ficheros de test y los guards de registro y de
  `scripts/` que se citan en la entrega.
- No se ha comprobado ninguna de las 24 ejecutando su test y mirando TMPDIR: «0 fugas vivas» es lectura del
  código, no una medición de restos.
- El censo sigue sin ver si un `finally` que cuelga de otra función llega a ejecutarse, ni dos asignaciones a una
  misma variable de módulo con un solo borrado. Ninguna de las dos formas aparece hoy entre las 154.

## Aceptación → dónde se ve

| aceptación (del ticket) | dónde se ve |
|---|---|
| ① el emparejamiento es por ámbito, no por nombre | `scripts/_censo-mkdtemp.mjs` (`enlazador`, filtro de `suyos`) · `tests/scrum1396-el-borrado-de-otra-funcion.test.mjs` ① y ③ |
| ② censar a quién afecta hoy | §2 y §3 · `docs/master/evidencias/SCRUM-1396/salida-antes-y-despues.txt` |
| ③ el rojo primero, con las tres fuentes | §1 · `docs/master/evidencias/SCRUM-1396/salida-sonda-c92d8182-por-nombre.txt` |
| ④ el positivo sigue GARANTIZADA; ESCAPA/FABRICA no se relajan | test ② y ④ del fichero nuevo · §5 |
| ⑤ la línea que sale siempre | test ⑤ del fichero nuevo |
| `scrum864c` en verde en `main` con el arreglo | NO HECHO → decisión del orquestador del equipo de Javier (§5) |

---

## Tramo 2 · ¿Dejan resto las 24? Medido por efecto, con el test pasando y con el test en rojo

**Medido contra:** `origin/main` = `fc639ef96164b56ae99c129b7202c56c66abdaf4` · 2026-10-08T00:54:25Z
(J4 del equipo de Javier, sesión `jv-j4`; encargo del orquestador `cobroflash-backend-90`. Los restos se midieron
sobre esta rama, `33e3d9d4`; las 24 `fichero:línea` son las mismas que sobre `main` de hoy. Jira: c.18861, c.18874,
c.18875 y c.18877 de SCRUM-1396.)

A9: aviso → A10 «Un laboratorio que le presta su entorno al sujeto mide la suma de los dos.» — no se pudo comprobar: el fallo fue de una medición hecha a mano (un `TEMP` con espacios rompió `scrum1289b` y lo di por «ya en rojo»); el guion guardado se niega ahora a correr con espacios en la ruta, pero nada impide que la próxima medición a mano preste otro entorno.

Este tramo no cambia código: ni `src/`, ni `tests/`, ni el censo. Añade una medición y sus instrumentos.

### Qué se midió

El §6 decía: «"0 fugas vivas" es lectura del código, no una medición de restos». Esto es la medición.

`evidencias/SCRUM-1396/medir-restos.sh` corre cada fichero de test solo, con `TEMP`/`TMP`/`TMPDIR` en una carpeta
vacía propia, y con `espia-mkdtemp.cjs` cargado por `NODE_OPTIONS`. El espía anota cada `mkdtempSync` con el
`fichero:línea` que lo llama y el directorio creado. En la pasada de fallo, tras cada llamada acusada hace que el
siguiente método de `assert` lance un `AssertionError`: el test cae por un assert, no por un `exit` (un `exit` se
salta el `finally` y mediría el arnés). Al acabar se mira cuáles de los directorios anotados siguen existiendo.
Salida completa en `salida-medir-restos.txt`; las 24 líneas, en `las-24-llamadas.txt`.

### Los cuatro controles del instrumento

`control-del-espia.fixture.txt` es un test fabricado con tres auxiliares que crean y devuelven. Se guarda como texto
y el guion lo copia fuera del árbol para correrlo: fuga a propósito, y como `.mjs` aquí dentro el censo lo acusaría.

| caso | creados | siguen vivos | esperado |
|---|---|---|---|
| pasa, el llamador borra | 2 | 0 | 0 |
| pasa, nadie borra | 3 | 1 | 1 |
| assert inyectado, llamador con `finally` | 2 | 0 | 0 |
| assert inyectado, llamador que borra sin `finally` | 2 | 1 | 1 |

La primera vez que corrí el guion guardado no arrancó nada (una `\` dentro de `NODE_OPTIONS` se comía los
separadores de la ruta del espía) y los cuatro controles salieron «creados 0»: fue el control el que lo dijo, no el
número de las 24, que habría salido «0 restos» igual.

### El número, las 24

Camino feliz: de los directorios creados por las 24 líneas, 0 siguen vivos.

Camino de fallo, los dos grupos aparte:

| grupo | líneas medidas | fallos inyectados | líneas que dejan resto | directorios que quedan |
|---|---|---|---|---|
| NO_GARANTIZADA (`{ dir, limpia }`) | 6 de 6 | 26 | 0 | 0 |
| ESCAPA (devuelve el directorio) | 18 de 18 | 58 | 2 | 6 |

Las 4 de los ayudantes (`tests/_alcance-desde-entradas.mjs`, `_comparador-alcance.mjs`, `_export-que-sobra.mjs`,
`_huerfanos-en-modulos-vivos.mjs`) no son tests: se ejercitan a través de los 6 tests que los importan.

### Las dos que fugan, y por qué

- **`tests/scrum1263-gancho-pre-push.test.mjs:52`, `montar()` — 4 de 4.** Sus cuatro llamadores borran en un
  `finally`. Pero `montar()` hace sus propios `assert.equal(git(…).status, 0)` (líneas 59, 60 y 68) después de crear
  el directorio y antes de devolverlo. Si uno cae, el llamador todavía no tiene `m` ni ha entrado en su `try`.
- **`tests/scrum454-destructivo-sin-comprobacion.test.mjs:157`, `repo()` — 2 directorios.** Se llama a nivel de módulo
  (`SUCIO`, `LIMPIO`) y se borra en `test.after`. Con un assert cayendo a nivel de módulo el fichero muere al cargarse
  (1 test, 1 rojo) y el `after` no corre. No se identificó cuál de los `assert` de módulo saltó.

**Lo que esto le hace a la salida 2 del §5** («que el censo siga al llamador y dé por buena una auxiliar cuyos
llamadores borran todos»): `scrum1263` cumple ese criterio al pie de la letra y fuga. El hueco está dentro de la
auxiliar, entre crear y devolver, que es donde un censo que mira al llamador no mira. `temporal()` lo cubre porque
borra al salir el proceso, lo tenga quien lo tenga. Decisión: no es de este puesto (c.18876).

### Lo que se dijo mal por el camino, y lo que queda débil

- **Autocorrección a c.18875.** Allí escribí que los 2 fallos inyectados en `scrum1289b` caían sobre tests «ya en rojo
  en mi árbol». El rojo lo causaba mi propio `TEMP` de medición, que tenía un espacio en la ruta. En esas pasadas
  `scrum1289b:80` fue la línea peor medida de las 24: 0 restos, pero sobre tests que el instrumento ya había roto.
  En la pasada guardada aquí (carpeta sin espacios) el camino feliz sale 9 de 9 y los 2 rojos de la pasada de fallo
  son los inyectados: 2 fallos, 0 restos.
- **Aviso que queda, y no es de este ticket:** `tests/scrum1289b-reporters-como-argumentos.test.mjs` no aguanta un
  directorio temporal con espacios en la ruta (`EPERM: operation not permitted, open 'C:\Users\Javier'`). La carpeta
  de usuario de esta máquina es `C:\Users\Javier Pereira`; hoy pasa porque `os.tmpdir()` devuelve la forma corta
  (`C:\Users\JAVIER~1\…`). No se ha arreglado.
- **Los 3 rojos de este árbol no son de `main`.** `scrum836` (1) y `scrum631` (no carga) caen aquí porque el árbol no
  tiene `dist/`; siguen saliendo así en `salida-medir-restos.txt`. Sobre `fc639ef9` limpio, con `dist/` compilado
  (`tsc --noCheck`) y sin tocar `TEMP`: `scrum1289b` 9 de 9, `scrum836` 17 de 17, `scrum631` 18 de 18, 0 saltos.
- **Un resto que no es de las 24:** `yaqu-454-no-es-un-repo`, que `scrum454…test.mjs:333` crea con nombre fijo. No
  es un `mkdtemp`, el censo no lo ve, y por eso «en TEMP al final» da 1 en su camino feliz. No se ha tocado.

### Límites

- El fallo cae en el **primer método de `assert`** que se llama tras crear. No intercepta `assert(x)` llamado como
  función ni un `throw` que no venga de assert. Un fallo más tardío en el mismo test no está medido.
- Dos pasadas completas con el mismo resultado, las dos en Windows. Ninguna en Linux.
- El espía sólo arma en el proceso del test: un `mkdtempSync` hecho por un proceso hijo se anota, pero no se arma.

### Lo que no se ha hecho

- No se ha convertido ninguna de las 24, ni las 2 que fugan: son ficheros de otro carril (los dos los creó la cuenta
  del equipo de Luis; reparto de los 22 en SCRUM-1506 c.18864).
- `scrum864c` ③ sigue en rojo con este PR, por las mismas 24. El PR sigue aparcado.
