# SCRUM-1811 · El vigía de la tanda lista lo que mata antes de matarlo (S5, 24-nov)

**Medido contra:** `origin/main` = `a7cd8dea5e0b2f1193b724ba2fcb196d1d980159` · 2026-11-24T18:41:51Z

A9: aviso → A10 «Un guion de mutaciones sin recuento en la base da por vivo al mutante cuando el que no corre es el guion: antes de mutar, la base dice cuántos casos pasan.» — no se pudo comprobar: el guion de mutaciones es mío y vive fuera del árbol, y no lo ve ningún guard. Mi primer guion de mutaciones no tenía control positivo. Lanzaba la tanda con `NODE_TEST_CONTEXT` vacío y un `NODE_OPTIONS` heredado, no corría ningún caso, y dio «3 de 3 mutantes vivos». Lo cacé porque la base decía «ninguno cae», que tampoco distingue nada. Le puse a la base el recuento (`ℹ pass 4`) y salieron 3 de 3 muertos.

Hijo de SCRUM-1527, abierto por el orquestador J (`cobroflash-backend-2d`). El encargo lo trajo el orquestador
(`orquestador`) por SendMessage el 24-nov, con la descripción íntegra del ticket, que no tiene comentarios.
Puesto S5: `scripts/tanda-con-veredicto.mjs` y `scripts/_huella-de-la-caida.mjs` son de este carril.

## Qué pasaba

Cuando la tanda pasa su tope de silencio (`TANDA_SILENCIO_MAX_MIN`, 15 min), el vigía para el árbol del hijo y
sale con 3. No decía qué había vivo en ese momento. Así cada colgada se clasificaba a ciegas: «el runner se quedó
sin memoria», «un hijo de node no terminó» y «el reporter se cortó» dejaban el mismo rastro (SCRUM-1527b §⑧.1).

## Qué cambia

- `scripts/_huella-de-la-caida.mjs` gana cuatro funciones puras y una que lee la máquina:
  - `leerPs` lee las filas de `ps -e -o pid=,ppid=,pgid=,rss=,args=` (Linux, el CI). `leerProcesosWindows` lee
    `pid⇥ppid⇥bytes⇥orden` (en local), sacado de `Get-CimInstance` como texto con tabuladores y no como JSON:
    hay líneas de órdenes con caracteres de control y `JSON.parse` rechazaba la lista entera (medido hoy en
    esta máquina).
  - `arbolDeProcesos(filas, raíz)` devuelve la raíz, sus descendientes por `ppid` y, en POSIX, su grupo (el hijo
    se lanza `detached`, así que su pgid es su pid). Nunca «todos los node» de la máquina.
  - `redactarArbol` hace la cabecera con el total de procesos y el RSS sumado, y una línea por proceso con pid,
    padre, RSS en MB y orden (hasta 300 caracteres). **Falla cerrado:** con un error dice «NO PUDE LISTAR … Se
    para igual», y con una lista vacía dice «NO es "no había nada"».
  - `listarArbol(raíz, { spawnSync, plataforma })` es la única que lee la máquina, con un tope de 20 s. La
    plataforma la pasa quien llama, para que este módulo no lea el entorno (el censo de SCRUM-702 cuenta los
    ficheros que lo hacen, y el tope sigue en 24).
- `scripts/tanda-con-veredicto.mjs`: **una línea** entre el aviso de TANDA SIN VEREDICTO y `pararArbol()`. Escribe
  la lista en la salida de error, que es el log del job. **No cambia** el código de salida (sigue siendo 3), ni
  el tope, ni qué se para.

## Test

`tests/scrum1811-vigia-lista-procesos.test.mjs`, 4 casos:

- ① **por efecto**: una tanda que de verdad se calla (un `node -e` que no escribe nunca, con una marca en su
  línea de órdenes) sale con 3 y, antes de parar, lista ese proceso con su RSS.
- ② el árbol es el del hijo: descendientes, un huérfano del mismo grupo dentro y un node ajeno con la MISMA orden
  fuera. Sin grupo, que es como llega en Windows, entra sólo lo que cuelga por padre.
- ③ `ps` con espacios en la orden y con basura; las filas de Windows, incluido un proceso del sistema sin orden y
  sin memoria leída.
- ④ no poder listar se dice: un error, una respuesta vacía, una lista vacía, una llamada sin plataforma y un `ps`
  que sale 1.

**Rojo primero:** antes de conectar la llamada en el vigía, ① salía rojo (sin lista) y ③ ④ verdes. ② también
salió rojo, pero por un error mío en la suma del test (puse 957 MB y son 956), no del código. Lo corregí antes de
conectar nada. La primera pasada ya conectada sacó a la luz el fallo del JSON de Windows: la lista salía «NO PUDE
LISTAR … Bad control character», es decir, el fallo cerrado funcionó. Con la cura salen 4/4. Contando los 12
ficheros de test que usan el envoltorio o el lector de huellas: 72 pasan, 0 fallan y 1 se salta (`SCRUM-858b` de
señales, «en Windows no hay señales POSIX que propagar; lo mide el CI»).

Mutaciones: catálogo → tests/scrum1811-vigia-lista-procesos.test.mjs

Las corrí con un guion fuera del árbol, con la base primero (`ℹ pass 4`, ninguno cae) y restaurando los bytes cada
vez. **3 de 3 vivas:** quitar la llamada tumba ①, ensanchar el árbol a toda la máquina tumba ②, y aceptar una
lista vacía como buena tumba ④.

## Lo que NO se ha medido

- **La rama POSIX por efecto** (`ps`, grupo de procesos) sólo la he probado con funciones puras. ① la ejerce en
  Linux cuando corra en el CI. En esta máquina ① va por la rama de Windows.
- **Una colgada real del CI.** Lo que pide el ticket («con eso J6 vuelve a medir las colgadas que haya») lo
  podrá ver J6 en el log del primer job que pase el tope después del merge.
- El cuarto caso del ticket (138160787095: lo cortó el techo de 25 min del job, sin aviso y con 112 s de
  silencio) **no pasa por este vigía**. Ahí mata GitHub y no el envoltorio, así que no saldrá ninguna lista. Lo
  digo para que nadie la espere en esos casos.

# SCRUM-1811b

**Medido contra:** `origin/main` = `77c000deadc9fa6b80ae97b6b02752e18b2c9392` · 2026-11-25T07:57:58Z

A9: aviso → cicatriz S5 «Un catálogo de mutaciones nuevo se mide con el meta-guard (`--solo-censo`) antes del push, no con un guion propio: guards:entrada no lo corre.» — no se pudo comprobar: `scripts/guards-entrada.mjs` no corre ese censo ni `tests/scrum757-la-declaracion-que-nadie-lee.test.mjs`, y llevarlo ahí es otra pieza.

Relevo del 25-nov (S5). El PR #3419 amaneció en rojo en el CI (run 45463680370, sobre `3e463f42d`).

## Qué estaba rojo y por qué

| Job | Lo que dice el log | Causa |
|---|---|---|
| meta-guard partes 1/2/3 y «los guards caen cuando deben» | exit 2 a los 4 s: «1 DECLARACIÓN QUE NO PUEDO EVALUAR · scrum1811…:24 · el campo `de` no es un literal: es TemplateExpression» | La primera mutación del catálogo usaba una plantilla `${'process'}.${'platform'}` para partir la señal del censo 702. El meta-guard sólo acepta un literal de cadena, y si no puede leer una declaración no la descarta: sale 2. |
| build + tests (con banco desechable) | 3 fallos de 14 414 (TAP del artifact `tanda-tap`): SCRUM-745, SCRUM-757 (positivo del árbol real) y SCRUM-765 (el meta-guard arranca) | La misma declaración ilegible, vista por los tres tests que vigilan al meta-guard. |

**La rama POSIX no tenía la culpa.** En ese mismo TAP los 4 casos de SCRUM-1811 salen `ok` en Linux, ① por
efecto incluido. Así que lo que el tramo anterior dejó en «Lo que NO se ha medido» («la rama POSIX por efecto»)
ya está medido: lo midió el CI, en el run 45463680370 (`ok 6253` a `ok 6256`). El cambio de ruta del censo 702
tampoco: SCRUM-702 sale verde en ese run.

## La cura

Una línea del test: `de` pasa a ser UN literal de cadena, y la señal se parte con el escape unicode del punto
dentro del literal. El meta-guard lee el valor ya cocinado (`nodo.text`), así que la mutación sigue siendo la
línea exacta del vigía. El censo 702 lee el fuente sin comentarios, y ahí no aparece la señal entera.

**Lo que me salió mal al curarlo:** la herramienta de edición escribió el escape como un punto literal, igual
que la cicatriz de S5 del 7-oct. Lo cacé porque SCRUM-702 se puso rojo («25 ficheros y el tope es 24», con
`scrum1811` en la lista). Una sonda con `soloCodigo` me enseñó el punto en disco, y reescribí la línea con un
guion de node que exige una coincidencia única.

## Medido (Windows, sobre la rama con la cura)

- 1811 + 702 + 745 + 757 + 765: `# pass 41 · fail 0 · skipped 0`. Los 4 casos de 1811 están en verde.
- Los otros 10 ficheros de test que usan `tanda-con-veredicto.mjs`: `# tests 59 · pass 58 · fail 0 · skipped 1`.
  El que se salta es `SCRUM-858b`, «en Windows no hay señales POSIX que propagar; lo mide el CI (Linux)».
  Esta población (los 12 ficheros que nombran el envoltorio, ya sin el lector de huellas) no es la misma que la
  de los «72» del tramo anterior. Por eso no comparo las dos cifras.
- `node scripts/meta-guard-mutaciones.mjs --solo-censo`: sale 0, sin declaraciones ilegibles.
- Las 3 mutaciones del catálogo, aplicadas una a una y restauradas: quitar la llamada tumba ①, ensanchar el
  árbol tumba ② y aceptar una lista vacía tumba ④. `git status` después: sólo el test.

## Lo que NO he medido

- El meta-guard ENTERO con mutaciones (las tres partes del CI) no lo he corrido en local, sólo su censo y las 3
  mutaciones de este catálogo. Lo juzga el CI en el push.
- La rama no está al día con `main` (89 commits por detrás). No la he mezclado: el CI juzga el merge.

# SCRUM-1811c

**Medido contra:** `origin/main` = `77c000deadc9fa6b80ae97b6b02752e18b2c9392` · 2026-11-25T08:16:22Z

A9: comprobación → `tests/scrum757-la-declaracion-que-nadie-lee.test.mjs`

Encargo del orquestador del 25-nov, en respuesta al tramo 1811b: que `guards:entrada` corra el censo del meta-guard,
porque ése fue el agujero por el que #3419 se empujó en verde con una declaración ilegible dentro. Rama
`scrum-1811c-censo-en-entrada`, desde `main` y con la rama de #3419 mezclada, porque este registro sólo vive allí.
Hasta que #3419 entre, este PR enseña también sus commits.

## Qué cambia

- `scripts/guards-entrada.mjs`: entra `tests/scrum757-la-declaracion-que-nadie-lee.test.mjs` en `GUARDS`, como
  decimoséptimo. Su caso «el ÁRBOL REAL… CERO ilegibles» llama a `declaracionesIlegibles()`. Ésa es la función con
  la que el meta-guard sale 2, en `--solo-censo` y en las tres partes del CI.
- `MINIMO` pasa de 15 a 17. El 1801 entró sin subirlo, así que quitar una línea de la lista no tumbaba nada.
- `tests/scrum976-guards-entrada-con-techo.test.mjs`: una mutación nueva en el catálogo. Quitar la entrada de 757
  tumba `SCRUM-976 ①` («la lista es menor que su propio suelo»).
- La cicatriz de S5 del 25-nov pasa de «sin comprobación» a «comprobación: scrum757».

**Por qué el test y no el comando `--solo-censo`:** la lista es cerrada y de ficheros de test, y su veredicto lo lee
`veredictoDe` sobre la salida de `node --test`. Así se hicieron las altas anteriores (1548b, 1801). Meter un
comando aparte es otra maquinaria. **Lo que no trae del `--solo-censo`:** el CIEGO por otra pasada viva del
meta-guard (de eso ya se ocupa la puerta de SCRUM-1349 de este comando) y su suelo de población. El tamaño del
censo sí lo trae, a medias: 757 exige `>= 127` declaraciones.

## Rojo primero (por efecto, con una declaración ilegible sembrada)

La siembra: en `tests/scrum1349-…test.mjs:45` el `cae` pasa a ser `'…' + '…'` (una BinaryExpression). La pongo y la
quito con un guion que exige una coincidencia única. `git status` sale limpio después de cada pasada.

| Árbol | `guards:entrada` | Qué cae |
|---|---|---|
| `main` + siembra, sin el alta | 1ª pasada: exit 2, CIEGO (90,0 s, la CPU al 100 %) · 2ª: exit 1 (86,9 s) | sólo `SCRUM-1340`, el rojo de `main` (abajo). **La siembra no la ve ninguno de los 16.** |
| rama + siembra | exit 1 (38,1 s) | `SCRUM-757 ✅ POSITIVO: el ÁRBOL REAL…`, que nombra `scrum1349…:40 · el campo cae (línea 45)… BinaryExpression`, y `SCRUM-1340` |
| rama sin siembra | exit 1 (46,3 s, 17 guards) | sólo `SCRUM-1340` |

`meta-guard --solo-censo` sale 2 con la siembra y 0 sin ella: el test y el comando están de acuerdo.

**`main` está en rojo hoy, y no es de esta pieza.** `SCRUM-1340` cae por `SCRUM-1852.md` (J2, sin `**Skill UI:**`).
Por eso `guards:entrada` no sale 0 en ningún árbol de hoy, y `SCRUM-976 ④` (que lo lanza de verdad) cae igual en
`main` que en esta rama. El orquestador tiene el arreglo en vuelo. El verde de esta pieza hay que leerlo después.

## Coste (lo que pidió el orquestador que se declarara)

- En el CI (run 45463680370), el caso del árbol real de 757 tarda **2,7 s**. La lista entera (`976 ④`) tardaba
  15,2 s, así que la cuenta queda en unos 18 s de 90.
- Aquí: 757 solo, 8,7 s con la CPU al 100 % y 22 procesos node (7,2 s de ellos en ese caso). La lista entera, de
  38 a 46 s con el alta. Pero hoy, **sin el alta**, una pasada salió CIEGA a los 90,0 s y otra se quedó en 86,9 s.
  En una máquina así cargada, el plazo ya se agota sin esta pieza, y con ella se agota unos segundos antes.

## Medido

- `scrum976` + `757` + `1152c`: 25 de 26. El que cae es `976 ④`, por `SCRUM-1340` (lo de arriba).
- La mutación nueva de 976: base `pass 1 · fail 0`, mutada `pass 0 · fail 1`. Restaurada.
- `meta-guard --solo-censo` sobre la rama: exit 0, y la declaración nueva se lee.

**Lo que me salió mal:** el primer guion para la mutación de 976 vaciaba `NODE_TEST_CONTEXT` en vez de quitarlo, y la
base no traía recuento (`pass undefined`). Es la frase de A10 que dejó el tramo de 1811 (la base dice cuántos casos
pasan). La cumplí porque imprimí la base antes de mirar el mutado. Lo arreglé quitando las dos variables, como hace
`tests/scrum976`.

## Lo que NO he medido

- La tanda completa (`npm test`) sobre esta rama. La juzga el CI.
- ~~Que `guards:entrada` salga 0, porque hoy no sale 0 en ningún árbol (`SCRUM-1340`, de `main`).~~ **Medido
  después**, con `main` curado por #3440 y mezclado en la rama: `✓ 17 guards de entrada en verde (186 tests, 29.0 s
  de 90)`, exit 0. `tests/scrum976-guards-entrada-con-techo.test.mjs`: 11 de 11, `976 ④` incluido.
