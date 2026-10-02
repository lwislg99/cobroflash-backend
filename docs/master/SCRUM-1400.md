# SCRUM-1400 · «ASIGNAR NO ES UN PERMISO» deja de cubrir VER — la línea fechada en cada sitio donde vive la frase

**Medido contra:** `origin/main` = `7779b0cbd473bc1a14e75308ce740ddc4e1e74cb` · 2026-10-02T05:43:46Z

2-oct-2026 · **J2d** (puesto J2, equipo de Javier), por encargo del orquestador (`cobroflash-backend-5b`).
[Escrito por J2d. El ticket y sus comentarios los he leído en Jira; la decisión del fundador que se cita
(SCRUM-1390 c.17962) la tomo del máster y de `docs/master/SCRUM-1390.md`, que la transcriben.]

A9: comprobación → `.claude/hooks/guard-dangerous.mjs`

## Ⓐ De dónde sale

El máster, Parte S1, cierra la nota de «autor o asignado» con esta frase: «Esa decisión deja falsa la
frase “ASIGNAR NO ES UN PERMISO” del comentario de SCRUM-597 en `prisma/schema.prisma`; se corrige en un
paso propio y declarado, nunca de paso en otro PR.» Este ticket es ese paso.

La decisión que la deja falsa es del fundador, del 1-oct-2026: **la asignación AL DOCUMENTO cuenta para
VER** (SCRUM-1390 c.17962, literal «1-Sí»).

Lo que NO cambia, y por eso la frase no se borra: para **editar** y para **emitir**, y para ver **coste y
margen**, asignar sigue sin ser un permiso. Lo que cambia es el alcance de la frase, no la frase.

## Ⓑ Dónde vive la frase: lo que decía el encargo y lo que hay

El encargo traía cuatro sitios «por corregir». Re-medido con `git grep` sobre `fb7cbbc7` (la punta de
`main` al empezar), con un nombre inventado al lado que da 0:

| # | fichero | línea que traía el encargo | línea medida | ¿llevaba ya la línea fechada? |
|---|---|---|---|---|
| 1 | `prisma/schema.prisma` | 1723 | 1723 | no |
| 2 | `src/core/documentos/asignacionDeDocumento.ts` | 6 | 6 | **sí**: líneas 17 a 20, de SCRUM-1397 |
| 3 | `src/modules/system/app/routes/invoicesAdmin.routes.ts` | 1291 | **1308** | no |
| 4 | `src/modules/system/app/routes/quotesAdmin.routes.ts` | 978 | 978 | no |

Dos datos del encargo no cuadraban, y el orquestador los ha confirmado en `main`:

- El sitio 3 estaba 17 líneas más abajo: SCRUM-1397 metió código por encima.
- Por corregir eran **tres**, no cuatro. El sitio 2 ya dice, desde SCRUM-1397, que alguien decidió que
  cuente para ver, con la cita de c.17962. No se ha tocado.

**¿Hay un quinto?** La frase aparece además en `tests/scrum597-asignar-usuario-al-documento.test.mjs`
(el título de una sección y el mensaje de un `assert`) y, acotada, en `docs/master/SCRUM-597.md`. Ninguna
de las tres es falsa: ese caso de test sólo prueba emitir, cobrar, cambiar el estado, rectificar y
asignar, y el registro dice «no cambia quién edita ni quién emite». No se han tocado. Con otras palabras
(«no es una llave», «quién lleva», «no decide quién…») no he encontrado más copias en `src/`, `public/`,
`prisma/` ni `scripts/`.

## Ⓒ Lo que se ha escrito

Seis líneas en cada uno de los tres sitios, debajo del párrafo de la frase y sin quitarle una letra. En
las dos rutas el texto es el mismo:

    🔵 2-oct-2026 (SCRUM-1400) · ESA FRASE YA NO CUBRE **VER**. El fundador firmó el 1-oct-2026
    (SCRUM-1390 c.17962, «1-Sí») que estar asignado a un documento cuenta para que un Técnico lo
    VEA. Para EDITAR y EMITIR sigue siendo verdad tal cual, y esta ruta sigue sin decidir nada de
    eso: sólo escribe la fila. La regla de quién ve vive en el máster, Parte S1 («autor o
    asignado»), no en este comentario.

**La línea no dice dónde está construida la regla ni qué falta por construir**, a propósito: eso caduca
con el siguiente PR, y un comentario que lo enumere es otra copia que se quedará vieja. Dice la decisión,
su alcance, y dónde vive la regla.

## Ⓓ El control del ticket: «si un test se mueve, has tocado algo que no era un comentario»

Instrumento: `docs/evidencias/scrum1400/control-solo-comentarios.mjs.txt`. Mide en el origen lo que una
tanda mediría de rebote: que entre la base y lo de después no cambia nada que no sea un comentario.

- **Los `.ts`:** el JavaScript que emite TypeScript con `removeComments` es **idéntico byte a byte** antes
  y después, en las dos rutas (sha256 en la salida). Control: el mismo fuente con un literal cambiado da
  un emitido distinto, así que el instrumento ve un cambio de código.
- **El diff:** cada fichero gana 6 líneas y pierde 0.

Salida del commit de las dos rutas: `docs/evidencias/scrum1400/control-1-las-dos-rutas.salida.txt`.

## Ⓔ Las citas por fichero y línea: por qué se han podido añadir líneas

El encargo pedía corregir sin mover líneas, porque estos ficheros están citados por línea. Medido sobre
todo `main`: **408** citas de la forma `fichero:línea` hacia `schema.prisma`, `invoicesAdmin.routes.ts` y
`quotesAdmin.routes.ts` (139, 177 y 92), y **ninguna** hacia `asignacionDeDocumento.ts`. De las 408,
**ninguna apunta a la línea tocada ni a ninguna por debajo** en su fichero (esquema desde la 1723: 0;
facturas desde la 1300: 0; presupuestos desde la 970: 0). Añadir líneas ahí no desplaza ninguna cita.

Límite: el patrón busca `fichero:número`. Una cita escrita en prosa («la línea 1723 del esquema») no la
ve; no he encontrado ninguna así hacia esas zonas, y el máster cita el comentario por su nombre, no por
su línea.

## Ⓕ El censo: ¿cuántas afirmaciones de principio están repetidas en comentarios?

Instrumento: `docs/evidencias/scrum1400/censo-frases-de-principio.mjs.txt`. Salida entera, con cada
frase y sus ficheros: `docs/evidencias/scrum1400/censo-frases-de-principio.salida.txt`.

**Qué mide:** rachas de tres o más palabras en MAYÚSCULAS, dentro de líneas que son enteras comentario,
que aparecen con las mismas palabras en dos o más ficheros de `src/`, `public/` y `prisma/`. Es la forma
en que esta casa escribe sus principios. Controles: la frase del ticket sale en sus 4 ficheros; la misma
con una letra cambiada da 0.

| | |
|---|---|
| ficheros leídos | 416 de 416 |
| líneas de comentario | 44.651 |
| frases distintas en mayúsculas | 3.755 |
| **repetidas en dos o más ficheros** | **258** |

**Clasificación, hecha A MANO y con sus límites.** De las 258, la mayoría son rótulos de comentario y no
afirmaciones («Y ES DELIBERADO», 17 ficheros; «EL DEFECTO QUE CIERRA», 14; «POR QUÉ EXISTE», 9). Aparté
48 que por su texto podían ser un principio y leí la línea de cada aparición. De esas 48:

- **22 son el mismo principio de producto, sobre el mismo asunto, escrito en dos o más ficheros** — o sea,
  lo que una decisión puede dejar falso en varios sitios a la vez. Incluida la de este ticket.
- **6 de las 22 son de permisos o de lo que ve cada rol**, la misma familia que ésta:
  «ASIGNAR NO ES UN PERMISO» (4 ficheros, ya fechada en los 4); «Y EL PROPIETARIO SE QUEDA FUERA» (a quién
  se puede asignar; 2); «EL CATÁLOGO SE CIERRA A ESCRITURA», el Operario sólo ve (2); «NI UN IMPORTE», lo
  que ve el Técnico en el parte (4); «UN TRABAJO SE ASIGNA A VARIOS EMPLEADOS» (2); «LOS TRES EJES» de
  quién ve un Trabajo (2).
- Las otras 16: «SE PROPONE. NO SE APLICA SOLO» (3), «NO PRECARGA NADA» (3), «EL TEXTO LO ESCRIBE EL
  MERCHANT» (2), «ESCONDER NO ES BORRAR» con «NUNCA SE ESCONDE UN CAMPO QUE TIENE ALGO ESCRITO» (2), «LA
  SELECCIÓN SE RECORTA A LO VISIBLE» (2), «EL MÓVIL SÓLO VIAJA SI HAY MÓVIL» (2), «SIN PRIMARIA NO SE
  PINTA NADA» (2), «UNA ANULADA NO VUELVE» (2), «EL ESTADO QUE NO RECONOCEMOS SE DICE» (2), «LAS CABECERAS
  DE APARTADO NO SUMAN» (2), «REGLA DEL PRESUPUESTO, QUE NO ES DOCUMENTO FISCAL» (2), «VACÍO ES VÁLIDO»
  (2), «NO SE INVENTA UN ESTADO QUE NO CONSTA» (2), «UN CÓDIGO DEL SERVIDOR NO ES UN MENSAJE PARA UNA
  PERSONA» (2), «Y NO TOCA EL DOCUMENTO» (2) y «DECLARA QUE NO RETIENE» (2).
- Las 26 restantes de las 48 no cuentan: la misma frase sobre asuntos distintos, invariantes técnicos,
  o rótulos.

**De qué NO responde este recuento:**

- Las otras 210 las descarté **por su texto, sin leer su contexto**. Puede haber algún principio entre
  ellas.
- De las 48 leí **la línea** de cada aparición, no el bloque entero.
- Un principio escrito en minúsculas, o con palabras distintas en cada sitio, no sale. El número real de
  principios duplicados es **como mínimo** 22.
- **No he medido si alguna de las 22 es falsa HOY.** El censo dice dónde puede pasar, no dónde ha pasado.
- No se ha arreglado ninguna: el encargo pedía el recuento.

Aparte, y es otra clase: hay afirmaciones de ESTADO repetidas que caducan con el código y no con una
decisión («MICROCOPY SIN APROBAR», 5 ficheros; «HOY NO EXISTE», 3; «ESTE MÓDULO NO LO LLAMA NADIE
TODAVÍA», 2). No están en las 22.

## Ⓖ Lo que he visto y no es de este ticket

- **El máster y dos registros siguen diciendo que la frase «queda falsa».** La última frase de la nota de
  «autor o asignado» de la Parte S1, `docs/master/SCRUM-1390.md` y `docs/master/SCRUM-1397.md` lo dicen en
  presente. Los registros son historia fechada y no se tocan; la frase del máster es un cambio de máster,
  y no es de este encargo. Dicho al orquestador.
- **El comentario de `asignacionDeDocumento.ts` dice «hay un guard que lo comprueba»** (que el fichero no
  exporta nada que responda «¿puede?»). No he encontrado ningún test que mire qué exporta ese módulo ni
  quién lee las tablas puente: ningún fichero de `tests/` nombra `asignacionDeDocumento`. Lo que sí hay es
  el caso NEGATIVO de `tests/scrum597-asignar-usuario-al-documento.test.mjs`, que comprueba por HTTP que un
  técnico asignado recibe 403 en seis acciones. Es una comprobación de comportamiento, no la estructural
  que el comentario describe. No lo he tocado: dicho al orquestador.

## Ⓗ Lo corrido, y lo que NO

Todo en local, sobre la rama con `main` `7779b0cb` mezclado (sin conflictos; `main` no tocó ninguno de
estos ficheros), con el comentario del esquema ya escrito en el árbol.

| qué | resultado |
|---|---|
| `control-solo-comentarios` sobre el commit de las dos rutas | SÓLO COMENTARIOS, salida 0; sus controles ven un literal cambiado |
| `prisma generate` y `npm run build` | salida 0 los dos |
| `scrum237`, `scrum976`, `scrum267`, `scrum1294`, los dos `scrum514` y los dos `scrum597` (8 ficheros, de 2 en 2) | 68 casos, 68 pasan, 0 caen, 0 saltos; los 10 «SCRUM-597 · …» leídos por nombre, y un nombre inventado da 0 |
| `npm run guards:entrada` | 12 guards, 132 casos, 0 caen, 12,1 s de 90 |

**NO corrido, y por qué:**

- **La dirigida (`scripts/tests-que-cubren.mjs --lanzar`): no se corrió, por decisión del orquestador.**
  Su razón: para este cambio, que el JavaScript emitido sea idéntico byte a byte prueba que nada cambia; una
  dirigida sólo diría que los tests siguen pasando.
- **La tanda completa:** no es alcanzable en esta máquina; el juez es el CI, que lee el orquestador.
- **Los guards de navegador:** no se tocó nada de `public/`.
- **Nada visto en yaqu.app:** el cambio no tiene nada que ver en pantalla.

Lo que este control NO cubre: un guard que lea el TEXTO de los comentarios de estos ficheros (no su
código) podría moverse y el control no lo vería. Los ocho ficheros de arriba y los de entrada son los que
se corrieron; el resto lo dirá el CI.

## Ⓙ El esquema: por qué se pudo tocar, y con qué permiso

`prisma/schema.prisma` es regla 40 del máster («no se toca sin ALTER previo»), una de las tres no
negociables. Y el mismo máster ordena corregir este comentario y nombra ese fichero. Las dos cosas apuntan
en direcciones distintas, así que **no lo interpretó la sesión ni el orquestador: se le preguntó al
fundador.**

**Autorización expresa del fundador, 2-oct-2026: literal «1-Sí». Consta en SCRUM-1400 c.18035**, que he
leído en Jira antes de escribir esto. Decidió con la frase de hoy y con la medición delante.

**Qué cubre, copiado de c.18035:** añadir líneas de comentario `//` al bloque de `QuoteAssignee` e
`InvoiceAssignee`, en su propio commit, el último y separado, para que se pueda revertir solo. **Qué NO:**
ninguna línea de modelo, ningún campo, ninguna `///`; no se borra la frase; y no se extiende a otros
comentarios del esquema (los de SCRUM-1401 se preguntan aparte).

**Por qué no hay ALTER: porque no hay nada que alterar.** Medido contra el esquema de `7779b0cb`:

| medición | resultado |
|---|---|
| el diff del esquema | 6 líneas añadidas, 0 quitadas, las 6 empiezan por `//` |
| el esquema sin sus líneas enteras de comentario `//` | idéntico antes y después: 1.128 líneas, mismo sha256 |
| líneas añadidas con triple barra `///` | 0 |
| `node scripts/preview-migracion.mjs --desde <esquema de main>` | «sin cambios pendientes», con su control positivo (33 tablas) |

**La diferencia entre `//` y `///` es lo que hace que «sólo comentarios» esté comprobado y no supuesto.**
En Prisma, `//` es un comentario y no sale del fichero; `///` es documentación y **entra en el cliente
generado**. Una línea `///` se vería en un diff igual que un comentario y cambiaría lo que se genera. Por
eso el instrumento las cuenta aparte, y tiene un control que demuestra que las ve: sembrando una `///` el
resultado cambia; sembrando una `//`, no.

Salida: `docs/evidencias/scrum1400/control-2-con-el-esquema.salida.txt`.

El fichero está en `.github/CODEOWNERS` y en `scripts/zona-roja.mjs`: el PR sale marcado como zona roja.
Medido por el orquestador (c.18035): la protección de `main` no exige revisión del dueño.

## Ⓘ Mis errores de esta tanda

1. **Sembré mal un control.** El de «un comentario más no cuenta» lo pegué al final del esquema y añadía,
   además, una línea en blanco: salió rojo por la línea, no por el comentario. El instrumento dio veredicto
   CIEGO y salida 2, que es lo que tenía que hacer. Ahora los tres controles se siembran dentro del texto.
2. **El censo no cortaba la racha en la coma.** «ASIGNAR NO ES UN PERMISO, Y ES LO PRIMERO QUE HAY QUE
   DECIR» salía como otra frase, y el control positivo dio 3 ficheros en vez de 4. Lo cazó el control.
3. **Quise apartar del árbol el cambio del esquema con `git restore`**, para partir el commit en dos como
   pidió el orquestador. El hook `guard-dangerous` lo paró antes de ejecutarse: descartaba un cambio sin
   commitear. No lo rodeé (ni `allow-destructivo` ni `stash`): partí el commit nombrando las rutas y dejé
   el esquema en el árbol hasta su commit. Es la línea `A9:` de arriba.
4. **Mi primer commit llevaba los tres ficheros juntos.** No estaba empujado; lo deshice con
   `reset --soft` y lo rehíce en dos.
