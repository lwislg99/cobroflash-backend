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
