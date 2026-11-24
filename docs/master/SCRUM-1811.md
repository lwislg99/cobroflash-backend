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
