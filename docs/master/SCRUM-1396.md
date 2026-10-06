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
