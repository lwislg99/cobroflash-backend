# SCRUM-1524 · Las coordenadas de `docs/legal/` que ya no apuntan a lo que decían

**Medido contra:** `origin/main` = `dfda86d65b8de9594b59b277fd38ea0ac3eda93a` · 2026-10-13T04:48:56Z

A9: aviso → cicatriz J4 «medí mi contexto leyendo el fichero de otra sesión: el jsonl más reciente de la carpeta de proyectos no es el mío, era el del orquestador y decía 958.354 cuando yo iba por 137.679» — no se pudo comprobar: el número de tokens no dice de qué sesión es, y nada obliga a mirar la ruta antes de leerlo

13-oct-2026 · **J4** (sesión `jv-j4`, equipo de Javier), por encargo del orquestador (`cobroflash-backend-2e`).
[Escrito por J4. El encargo se leyó en Jira: SCRUM-1524 entero y SCRUM-1521 c.19158.]

**Carril a mano.** El hook de arranque dijo «SIN IDENTIDAD» (SCRUM-1498); se siguió, como manda la ficha
común del 13-oct. **Es una medición:** no se ha tocado `docs/legal/`, ni `tests/scrum525d-…`, ni
`scripts/_anclas-*`. Lo único que entra es este registro, tres instrumentos de sólo lectura en
`docs/master/evidencias/SCRUM-1524/` con sus salidas, y una línea en mis cicatrices.

## Lo primero: no son 81

El encargo habla de «81 coordenadas sin testigo». **81 es sólo una de las tres casillas sin testigo**, y el
ejemplo vivo del encargo (`clean-staging-tests.mjs:78`) **no está entre esas 81**.

`docs/legal/` tiene hoy **19 documentos y 205 coordenadas: 202 vivas y 3 tachadas**. De las 202 vivas:

| Cómo las ve `scrum525d` | Cuántas | Qué comprueba de ellas |
| --- | --- | --- |
| Con testigo y ruta completa (`FIRME`) | 17 | que el fichero existe y que el testigo está en esa línea |
| Sin testigo, ruta completa (`SIN`) — **las 81 del encargo** | 81 | nada que haga caer el test |
| Citadas sólo por el nombre del fichero (`SIN_RUTA`) | 101 | nada: ni siquiera abre el fichero. **3 de ellas llevan testigo y tampoco se comprueba** |
| Ruta a medias, `lib/invoicing.ts` (`AUSENTE`) | 3 | las cuenta como «no resuelven» y **el test sigue verde** |

**Sin comprobar hay 185 de 202, no 81.** El guard comprueba 17.

## ① Cuántas apuntan a algo que ya no está donde dicen

Instrumento: `docs/master/evidencias/SCRUM-1524/censo-coordenadas.mjs`. Usa el extractor de la casa (la
población es la suya). Para cada coordenada busca en el historial del documento el commit en que entró,
lee qué había en esa línea del fichero citado **ese día**, y lo compara con lo que hay hoy. No deduce qué
afirma la frase.

**Los dos fallos, por separado, sobre las 202 vivas:**

| Fallo | Cuántas | |
| --- | --- | --- |
| **F1 · el fichero no existe** | **0** | más 1 tachada: `e2e-critico.mjs:305`, la de ayer |
| **F2 · la línea ya no dice lo que decía** | **131** | |
| · desplazada: lo que decía está hoy en otra línea | 83 | 71 en un solo sitio, 12 en varios. Salto: mínimo 1 línea, mediana 52, máximo 1.052 |
| · cambiada: lo que decía ya no está tal cual | 48 | 6 editadas en su sitio · 8 movidas y además editadas · 34 cuyo texto ya no está en el fichero |
| Intacta desde que se citó | 69 | |
| Sin referencia (no se pudo comparar) | 2 | al nacer la cita había más de un fichero con ese nombre |

**Y sólo las 81 del encargo: 50 con F2 (35 desplazadas, 15 cambiadas) y 31 intactas.** De las 101 citadas
por nombre: 76 con F2. De las 17 que el guard da por firmes: 15 intactas y **2 cambiadas** —el testigo sigue
en la línea, y la línea pasó de «RESPONDIDA por el asesor fiscal» a «RESPUESTA DE IA, SIN REVISIÓN
PROFESIONAL» (`ENVIO_ASESOR_2026-09-28.md:32`)—: es lo que la cabecera del criterio ya avisa que no juzga.

Por documento (vivas · desplazadas/cambiadas · intactas): `AUDITLOG_FISCAL_CONTRATO` 50 · 28/14 · 8 ·
`INVENTARIO_AFIRMACIONES_VERIFACTU` 59 · 26/23 · 10 · `AUDITORIA_CAMINO_EMISION` 51 · 16/0 · 35 ·
`PREGUNTAS_ASESOR` 20 · 7/1 · 12 · `INVENTARIO_AFIRMACIONES_SKILLS` 11 · 2/6 · 3 · `MEDICION_GUION_H2` 5 ·
2/2 · 1 · `EXPEDIENTE_FISCAL_ANTICIPOS` 4 · 2/0 (2 sin referencia) · `ENVIO_ASESOR` 2 · 0/2 · 0. Los otros
once documentos no tienen coordenadas. Las 205, una a una, en `las-205-una-a-una.tsv`.

**Un caso que lo enseña entero:** `AUDITORIA_CAMINO_EMISION.md` cita `sellarTrasEmision` dos veces. Con
testigo, en `selladoEstado.ts:119`: firme. Sin testigo, en `:116` (línea 145 del documento): desfasada tres
líneas. Mismo documento, mismo símbolo; la que lleva testigo se corrigió y la otra no.

### El control

Sembrado, no prestado: el instrumento fabrica un repositorio desechable con dos commits y ocho citas —2
buenas y 6 rotas: fichero borrado (con ruta y por nombre), fichero que nunca existió, línea desplazada,
línea cambiada y línea fuera de rango— y exige cada una con su clase. **Ve 6 de 6 y no marca ninguna de las
2 buenas.** Con `--sin-rotas` dice **CIEGO, sale 2 y no imprime ninguna cifra**
(`salida-control-sin-rotas.txt`). Aparte, y prestado del árbol (no es el control): `clean-staging-tests.mjs:78`
sale desplazada, con lo que decía hoy en la 175, que es lo que midió J3.

### Lo que este número NO dice

- **«Intacta» no es «correcta».** Es «no se ha movido desde que se escribió». Si una cita nació apuntando
  mal, sale intacta. Dos de las desplazadas nacieron sobre una línea que no dice nada (una llave y una
  línea en blanco, `libroRegistroView.js:226` y `:227`).
- **«Cambiada» no es «falsa».** De las 48 no he leído ninguna contra su frase. Varias son de los dos
  inventarios de afirmaciones, que citan un texto para decir que estaba mal: que ese texto ya no esté es
  justo lo que el inventario pedía. Cuántas son de ese tipo **no lo he contado**.
- **La referencia es el commit en que la cita entró en el documento**, no el commit sobre el que su autor
  midió. `AUDITLOG_FISCAL_CONTRATO.md` declara que leyó `485ff72`; yo comparo contra `f4d1f0bc2`. No he
  medido cuánto difieren.
- **El extractor de la casa no lo ve todo:** con un patrón más ancho salen 29 apariciones de «fichero:línea»
  que no están entre sus coordenadas (15 `.ts`, 11 `.html`, 2 `.mjs`, 1 `.js`). Las `.html` quedan fuera
  porque esa extensión no está en su lista; **las otras 18 no he mirado por qué.** No están en ninguna cifra
  de arriba.

## ② Por qué `scrum525d` no las ve

Instrumento: `por-que-no-las-ve.mjs`. Saca una copia de `HEAD` a un temporal, le hace a la copia lo que
haría un PR, y corre el test de la copia cada vez. El árbol de trabajo no se toca.

| Experimento | Pasan |
| --- | --- |
| E0 · sin tocar | 8 de 8 |
| E1 · borrar un fichero citado con ruta y sin testigo (`scripts/backup-dump.mjs`) | **8 de 8** |
| E2 · borrar un fichero citado sólo por nombre (`scripts/clean-staging-tests.mjs`) | **8 de 8** |
| E3 · control: borrar un fichero citado **con** testigo | 7 de 8 |
| E4 · desplazar tres líneas un fichero citado sin testigo | **8 de 8** |
| E5 · control: desplazar tres líneas uno citado **con** testigo | 7 de 8 |
| **E6 · borrar de golpe los 41 ficheros que sólo se citan sin testigo** | **8 de 8** |
| E7 · cita nueva sin testigo a un fichero inexistente, par nuevo | 7 de 8 (cae el trinquete) |
| E8 · cita nueva con testigo a un fichero inexistente | 7 de 8 |
| E9 · cita nueva sin testigo a una línea inexistente, en un par ya perdonado | **8 de 8** |

**La respuesta, derivada de eso:** sí recorre `docs/legal/` y sí las ve —las cuenta y las imprime—, pero
**sólo afirma algo de las que llevan testigo**. De las demás imprime un recuento («sin testigo 81 · sin
ruta 101 · no resuelven 3») y pasa. No es que no mire: **mira y no exige**. Y lo que protege a futuro es el
PAR documento↔fichero, no la cita: E7 cae porque el par es nuevo, E9 no porque el par ya estaba perdonado.
Hoy hay 86 pares perdonados.

**Carril:** el test y sus dos ficheros de `scripts/` los creó SCRUM-525d (commit `3dbd34171`, 16-sep).
`dos-equipos.md` da `tests/` «el test de un ticket» al puesto que trabaja el ticket y `scripts/` a la fila
general; ninguno de los tres tiene fila propia. **De qué puesto fue SCRUM-525d no lo he leído en Jira.**
`docs/legal/`: J4 propone, firma un jefe.

## ③ Impedir, avisar, o exigir tocar la cita en el mismo PR

Instrumento: `numeros-para-decidir.mjs`, contra `origin/main` = `dfda86d65`.

- **Borrados.** Desde el primer commit de `docs/legal/` (13-jun-2026) se han borrado o renombrado 216
  ficheros en el repositorio. **Citado alguna vez desde `docs/legal/`: 1**, el de ayer. Población: 102
  versiones de documento, 85 rutas citadas alguna vez.
- **Movimientos de línea.** 58 ficheros citados. En 30 días, **149 de 1.071 PR (14 %)** tocaron alguno;
  sin el máster ni los propios `docs/legal/`, 120 (11 %). En 7 días, 16 de 152 (11 %).

**Lo que dicen esos números:** las tres vías del encargo discuten el BORRADO, y el borrado ha pasado una
vez en cuatro meses. **Lo que ha pasado 131 veces es que la línea se movió**, y ninguna de las tres lo
toca. Exigir que la retirada toque la cita en el mismo PR es barato (una vez en cuatro meses) y habría
bastado ayer; no arregla ni una de las 131.

Para el desplazamiento, un guard que exigiera tocar la cita cada vez que se mueve la línea saltaría en uno
de cada nueve PR, casi siempre a quien no ha abierto el documento. El mecanismo que ya existe y no tiene ese
coste es el testigo: una cita con testigo sólo cae cuando el símbolo deja de estar en su línea, y el rojo
dice a qué línea ir. **Está puesto en 20 de 202.**

No propongo arreglo: es decisión de un jefe y `docs/legal/` no se edita sin permiso. Lo que sí queda medido
es que la pregunta de fondo tiene dos mitades de tamaño muy distinto.

## Lo que NO he hecho

- No he arreglado ninguna cita ni tocado el guard, el congelado ni `docs/legal/`.
- **No he leído `docs/equipo/00-normas-comunes.md` ni mi traspaso enteros** (65 KB y 84 KB): iba por 182.604
  tokens al llegar a ellos y me habrían pasado de 200.000. Leí la ficha común, los dos tickets y la tabla de
  carriles.
- No he corrido la tanda completa: el cambio son documentos y tres scripts que nada importa. Corrí los
  guards del registro y de bytes de control (abajo).
- El pendiente del PR #2323 (dos bytes ESC en mi evidencia de SCRUM-1339) **sigue sin hacer**: es otra rama
  y no me quedaba sitio.
- Ticket sin transicionar.

## Mis errores

- **Medí mi contexto en el fichero de otra sesión.** Cogí el `.jsonl` más reciente de la carpeta de
  proyectos y era el del orquestador: 958.354. El mío estaba en la carpeta del worktree e iba por 137.679.
  Lo cazó que la cifra era imposible para una sesión recién arrancada; con una creíble no lo habría visto.
- Escribí la línea A9 citando un trozo de mi cicatriz y no la frase entera. Lo paró
  `tests/scrum1294-a9-leccion-en-a10.test.mjs`, en rojo, antes del commit.
- La primera versión del censo metía en un solo saco «cambiada» tres cosas distintas (editada en su sitio,
  movida y editada, texto desaparecido). Lo vi al leer las 48 filas y lo partí con criterios discretos.
