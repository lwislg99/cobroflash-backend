# SCRUM-1179 · Los 25 instrumentos «que no corren en ningún sitio», uno a uno — y las citas que mentían

**Medido contra:** `origin/main` = `a59dc1e692bae683d2d035fe52534b5589d0c7b3` · 2026-09-28T14:57:39Z

28-sep-2026 · **S3**. La propuesta completa está en Jira, SCRUM-1179, comentario 17339. La decisión
del orquestador (por delegación del fundador) está en el comentario 17340.

## Lo medido, en una línea por grupo
La premisa del ticket se corrigió midiendo: al npm script no lo llama nadie, pero **21 de los 25 los
importa algún `tests/*.test.mjs`**, y **7 ya bloquean** lo que vigilan. La pregunta útil no era
«¿corre?», sino **«¿el test lo comprueba sobre el árbol REAL y bloquea algo NUEVO?»**.

| Grupo | Cuántos | Decisión |
|---|---|---|
| A · ya bloquean | 7 | nada (`guards:entrada` es redundante: se escribe) |
| B · el test existe, falta la mitad que cierra | 4 (~9 s) | al check obligatorio, uno por PR |
| C · no caben o no son deterministas en CI | 7 | job informativo; `tactil-panel` primero |
| D · herramientas manuales | 6 | se quedan; PROHIBIDO citarlas como red |
| E · vigila algo que ya no existe | 1 | se borra `censo:escalera-por-estado` |

## Este PR — las citas que presentaban como red algo que no corre
| Fichero | Antes | Ahora |
|---|---|---|
| `scripts/guard-objetivo-tactil.mjs` (cabecera) | «las otras quince siguen medidas por `censo:tactil-panel`» | no las vigila nada que corra; censo MANUAL; no se cite como red. La corrección de SCRUM-1172 arregló el cuerpo y el mensaje final, **no la cabecera** |
| `tests/scrum719-el-suelo-de-los-doce.test.mjs` (mensaje) | «comprobación completa: `censo:mudez`» | `censo:mudez` es manual; la única red que bloquea es esa lista |
| `scripts/meta-guard-mutaciones.mjs` | `censo:mudez` «que ya existe» | existe, pero es manual: no es una red |
| `tests/scrum711-guards-sin-sitio.test.mjs` (cabecera) | «sus cuatro comprobaciones» | todas las de su lista `GUARDS`: un atajo, no una red más |
| `docs/master/README.md` | «No es un guard, son CUATRO» | son los de la lista `GUARDS` (sin cifra, que caducó una vez); atajo, no red |
| `scripts/guards-entrada.mjs` (cabecera) | — | ATAJO, NO RED: todo lo que corre ya está en la tanda |

**Sin cifra a propósito:** «cuatro» caducó cuando la lista creció a 12. Escribir «doce» caducaría igual.

## No tocado, y por qué
- `docs/master/SCRUM-641.md:216` (`npm run cr:censo --limpiar`: sin `--`, npm se come el flag),
  `SCRUM-791.md:29` y `SCRUM-917.md:874` («medida por `censo:tactil-panel`»): son **registros
  históricos**. Cuentan lo que se hizo, no instruyen, y no se reescriben. Quedan señalados aquí.
  **Corregido por decisión del orquestador (28-sep):** `SCRUM-641.md:216` no es narración, es un
  comando que se puede copiar. No se reescribe, pero lleva al lado un apéndice que dice que no
  limpia nada y cuál sí. Medido: `npm run <script> --limpiar` avisa `Unknown cli config` y el
  script recibe `argv` vacío. 791 y 917 se quedan como están.
- Las 3 promesas de la landing congeladas en `SIN_ANCLA_HOY` (`censo:anclas-f`): la landing es STOP
  del fundador; las sube el orquestador.
- B, C, D (cabeceras y guard) y E: PR aparte, uno por instrumento.

Tests afectados (42 ficheros): 364 verdes y 4 saltos ajenos (`QA_DB_TEST`, SCRUM-781).

## B · 1 de 4 — `censo:decisiones-encerradas`, con su mitad que cierra

`tests/scrum837-decisiones-encerradas.test.mjs` ya estaba en el check obligatorio, pero solo fijaba
cuatro nombres (lo ya arreglado no vuelve). Una decisión NUEVA encerrada en una vista pasaba.

- **Mitad que cierra:** el censo del árbol de trabajo se compara con
  `scripts/_decisiones-encerradas-declaradas.json` en las dos direcciones. NUEVA sin declarar →
  rojo; declarada que ya no sale → rojo hasta moverla a `retiradas` con motivo. Clave
  `fichero · función`, nunca la línea. Las 9 de hoy entran declaradas, no aceptadas.
- **Control positivo real:** el árbol `9cacafad^` (antes de SCRUM-831) acusa
  `jobDetailView.js · primariaDeAlbaran` como NUEVA.
- **Control negativo real:** en `9cacafad` (el arreglo) ya no sale, y entre los dos árboles cambia
  exactamente esa acusación y ninguna otra.
- **Fail-closed:** censo ciego, población vacía o clave repetida → CIEGO, sin comparar nada.
- **Probado en rojo:** quitar `jobsView.js · jobRow` del JSON → «NUEVA … jobRow»; añadir una
  fantasma → «SOBRA … fantasma».
- **Coste:** va en el mismo fichero para reutilizar los censos que ya pagaba. Cada árbol se censa
  una vez por proceso: se añade un censo (`9cacafad`) y se ahorran dos repetidos, así que el
  fichero hace cinco censos en vez de seis. Local, con cuatro sesiones cargando la máquina: 19,1 s antes y 20,5 s después; con esa
  carga no sirve para comparar (SCRUM-790). El coste real se toma del check del PR.

## B · 2 de 4 — `censo:suelos`, con su mitad que cierra

`tests/scrum775-suelo-que-no-dispara.test.mjs` exigía «conectado» para un solo fichero. Un suelo
nuevo sin conectar salía en `npm run censo:suelos` con código 1, y ese comando no lo corre nadie.
Un suelo nuevo que el censo no sabe leer caía en «NO SÉ LEER» (75 hoy) sin que nadie lo mirase.

- **Mitad que cierra:** en el árbol real, NO CONECTADOS tiene que ser cero (hoy lo es), y los NO SÉ
  LEER se comparan con `scripts/_suelos-sin-leer-declarados.json` en las dos direcciones. Clave
  `fichero · función productora · variable.propiedad` con su cuenta (8 claves salen dos veces en el
  mismo fichero), nunca la línea. Tras mejorar el censo (abajo) entran declarados **18** casos en
  17 claves, cada uno con el motivo del censo. Declarados, no aceptados.
- **¿Ilegibles por cómo están escritos o porque el censo se quedaba corto?** (pregunta del
  orquestador). Medido clasificando qué `return` no sabía seguir: **de los 75, 54 eran corteza del
  censo y se han arreglado, no declarado**:
  · 34: el productor tenía `return null` (o un `return;`) en un camino, y eso cegaba la función
    entera. Ahora ese camino no fabrica nada ni impide leer los demás; si todos son así, sigue ciega.
  · 20: `r.status`/`r.error` sobre un `spawnSync` de Node. Su forma se DERIVA ahora ejecutándolo
    dos veces (uno que funciona y otro que no existe), sin lista escrita a mano.
  · Y derivar `spawnSync` destapó un **defecto del censo que venía de antes**: resolvía la variable
    con un `Map` por FICHERO, así que el último `const r = …` pisaba a los otros. En
    `turno-staging.mjs`, `test-staging-gated.mjs` y `_prisma-sync.mjs` salieron **10 «no
    conectados» FALSOS** (el `r.ok` de un `await adquirirLock()` atribuido al `spawnSync` de otra
    función). Ahora la variable se resuelve en SU ámbito (`declaracionVisible`). Los guards
    reconocidos pasan de 148 a 135: los 13 que se van estaban mal atribuidos.
  · De los **18 que quedan**, unos 13 siguen siendo límite del censo (una llamada o un ternario en
    el `return`, `new Set`, un `...spread`, un import de `dist/`) y unos 5 son de forma (devuelven un
    parámetro, o el productor no está en la población). No se ha seguido: rinde poco y cada paso más
    es análisis de flujo.
  · Resultado: conectados 73 → **117**, no conectados **0**, NO SÉ LEER 75 → **18**.
- **Control positivo real:** el árbol real con dos defectos inyectados en memoria: el
  `censo-tablero-vs-arbol.mjs` roto de SCRUM-775 sale NO CONECTADO, y un guard opaco nuevo sale
  como NUEVO sin leer.
  Y (a petición del orquestador, porque el censo cambió mucho en una tanda) dos guards de HOY
  **desconectados a propósito** en ese mismo corpus, uno de cada clase nueva: `p.host` de
  `censo-etiquetas-del-documento.mjs` (productor con `return null`) y `r.status` de
  `guards-entrada.mjs` (`spawnSync`). Tienen que salir los tres, y exactamente los tres. Probado
  quitando la lectura del `return null`: el control cae con «desconecté a propósito … y el censo
  NO lo acusa».
- **Control negativo:** el árbol real da cero, que es el propio trinquete en verde.
- **Fail-closed:** si `motivosParaNoFiarse` dice algo (población vacía incluida), CIEGO y no se compara.
- **Probado en rojo:** quitar una clave del JSON → «NUEVO … nav.ok (1 vistos, 0 declarados)»;
  añadir una fantasma → «SOBRA … (0 vistos, 1 declarados)». Las tres capacidades nuevas llevan su
  test, con lo que TIENEN que acusar y lo que NO (`r.ok` sobre `spawnSync` sale no conectado; dos
  `r` en dos funciones no se pisan; una función que sólo devuelve `null` sigue ciega).
- **Qué ve quien lo pone rojo** (texto literal del test): «🔴 NUEVO suelo que el censo NO SABE
  LEER: <clave>. Nadie puede decir si ese guard puede saltar. Escríbelo legible (que el productor
  esté en la población y devuelva algo que se pueda leer) o decláralo en «ciegos» de
  scripts/_suelos-sin-leer-declarados.json con su motivo. Detalle: `node scripts/censo-suelos.mjs
  --ciegos`.» Declarar exige `cuantos` y `motivo` (otro test lo comprueba), y queda en el diff.
- **Coste:** el árbol real se censa una vez por proceso (lo usan cuatro tests). El control positivo
  añade un censo (~3,4 s) y el test que lo repetía ahorra otro (~4 s). Local: 29,9 s antes y 29,1 s
  después, con carga en la máquina. El coste real se toma del check del PR.

## B · 3 de 4 — `censo:escritores-arbol`, con su mitad que cierra

`tests/scrum808-el-arbol-que-queda-mutado.test.mjs` sólo exigía que el censo no estuviera ciego y
que viera al meta-guard. Un script nuevo que capture un fichero del árbol, lo escriba y prometa
devolverlo en un `finally` SIN la red de SCRUM-808 salía en el censo y nadie lo leía.

- **Mitad que cierra, dos partes:**
  · todo el que CAPTURA Y DEVUELVE dentro del árbol lleva la red (hoy son 2 y los 2 la llevan:
    `meta-guard-mutaciones` y `censo-mudez`). Uno nuevo sin red → rojo, sin lista: no se declara.
  · la parte CIEGA: los que leen un fichero y lo REESCRIBEN, con `finally`, sobre una ruta que el
    censo no sabe resolver (`capturaOpaca`, nuevo en el instrumento). Hoy son 10, todos tests, y
    los 10 se miraron A MANO: todos escriben en un temporal propio. Van en
    `scripts/_escritores-opacos-declarados.json` con adónde apunta cada uno. Clave: el fichero.
  · Borrar lo que se leyó (`rmSync(outPath)` de los tests de PDF, 11 casos) NO cuenta: es limpiar,
    no devolver. Contarlo habría llenado la lista de ruido.
- **Control positivo real:** `meta-guard-mutaciones` tal como estaba antes de la red (`cc0bf7e1^`),
  metido en el censo de hoy en lugar del actual, sale SIN RED.
- **Control negativo real:** el de `cc0bf7e1` (con la red) no sale. Y un script que sólo borra lo
  que leyó no sale como opaco; uno que lo reescribe, sí.
- **Fail-closed:** censo ciego (población bajo el suelo) o sin su control positivo → CIEGO.
- **Probado en rojo:** quitar `scrum293` del JSON → «NUEVO fichero que lee un fichero y lo
  reescribe…»; añadir uno fantasma → «SOBRA … Muévelo a «retiradas»».
- **Coste:** un censo (~1,9 s en local, con carga), compartido con el test de SCRUM-808 que ya lo
  hacía, así que el neto es ~0. El CLI lista también la parte ciega, que es donde manda el rojo.

## B · 4 de 4 — `censo:guards-navegador --solo-censo`: NO SE CONSTRUYE

Su mitad que cierra ya existía y ya bloqueaba: `tests/scrum548-peaje-package-json.test.mjs:99-243`
compara los solapes y los «no resueltos» con listas exactas (un guard nuevo sobre una página ya
medida cambia el recuento → rojo), y `:37` fija los dos suelos del CLI (≥9 guards, ninguno
declarado sin fichero). Comprobado que no se salta: sale ✔ en el log del CI de #1881. Un PR que no
cambia nada y cierra un punto de la lista no se abre.

## D — las seis herramientas manuales, marcadas «HERRAMIENTA MANUAL, NO RED»

`censo:vias-de-cobro`, `censo:conflictos-package`, `cr:censo`, `cr:tecnica`, `cr:limpiar` y
`topologia` (cuatro ficheros: los tres `cr:*` son el mismo). Cada cabecera dice, justo bajo el
título, que no vigila nada por sí sola y que no se cita como red al retirar un guard (SCRUM-1172).
Medido antes de escribirlo: ninguna aparece en `test`, `pretest` ni en `.github/workflows/`. Los
tests que las importan prueban la HERRAMIENTA, no el árbol, y la cabecera lo dice así.

`tests/scrum1179d-herramientas-no-red.test.mjs` mantiene la cabecera cierta en las DOS direcciones:
cae si la marca desaparece, y cae si alguien empieza a correr una de ellas en `test`/`pretest` o en
un workflow (entonces sí es red y la marca miente). Probado en rojo las dos: quitando la marca de
`topologia` y añadiendo `npm run cr:censo` a `pretest`. El detector no confunde un comentario YAML
ni un nombre parecido (test propio).

No se ha hecho el guard que busque en los comentarios citas de estas herramientas como red: sería
un guard por TEXTO sobre prosa, que casa con el comentario que lo explica (la trampa de
`_guard-texto.mjs`). La marca en la cabecera corta el caso en origen.
