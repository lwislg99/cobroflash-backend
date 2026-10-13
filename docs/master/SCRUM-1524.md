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

## SCRUM-1524b · Tramo 2 (jv-j4f, 13-oct-2026): las desfasadas, separadas en vivas, fechadas y dudosas

**Medido contra:** `origin/main` = `9358f02b14e9648f1ab65fbdacf6464d50728242` · 2026-10-13T10:29:36Z (hora de GitHub)

A9: sin fallo que generalice — el tramo reusa el censo del tramo 1 sin tocarlo y lo único que añade es lectura; lo que salió mal fue una premisa del encargo (abajo, «Lo primero»), y ésa la cazó leer el comentario 19194 antes de medir, que es lo que el encargo pedía

**ES MEDIR Y PROPONER.** No se ha tocado ninguna cita, ni `docs/legal/`, ni `scrum525d`, ni nada en
`src/`. Instrumentos y salidas: `docs/master/evidencias/SCRUM-1524b/`.

### Lo primero: ninguna de las desfasadas vive en `docs/master`

El encargo decía que muchas de las 131 «viven en registros fechados de `docs/master`». **Son cero.** El censo
del tramo 1 sólo mira `docs/legal/` (su población es la del extractor de la casa), así que las 202 vivas y
todas sus desfasadas están en ocho documentos de `docs/legal/`. La separación entre vivo y fechado existe,
pero hay que hacerla **dentro de `docs/legal/`**, documento a documento.

Y `docs/master` no está censado por nadie: con el mismo extractor salen **4.786 coordenadas en 550 de sus
1.087 registros**. Cuántas están desfasadas, **no medido** — y por el principio del fundador no hay nada
que hacer con ellas, así que medirlo no cambiaría ninguna decisión.

| Zona | Ficheros | Coordenadas | Desfase |
|---|---|---|---|
| `docs/legal/` (control: tiene que dar 205) | 19 | 205 | medido, abajo |
| `docs/master/*.md`, registros | 1.087 | 4.786 | no medido |
| `docs/YAQU_MASTER.md` | 1 | 82 | no medido |
| `docs/equipo/` | 43 | 5 | leídas por encima: 1 desplazada (la de `sesion-4.md`, del equipo de Luis); las otras 4, sin juzgar |
| `docs/RUNBOOKS.md`, `docs/QA_MASTER.md`, `CLAUDE.md`, `.claude/skills/` | 39 | 0 | — |
| Cero derivado: un texto sembrado sin citas | 1 | 0 | — |

El extractor sólo ve citas entre acentos graves con extensión de su lista: un cero suyo en las skills es
«no hay ninguna escrita así», no «no citan código».

### El número se ha movido en seis horas: 137, no 131

Mismo instrumento, sin tocar, sobre el `main` de hoy. Control sembrado: 6 rotas vistas de 6, 0 buenas
marcadas; sin las rotas dice CIEGO y sale 2.

| | tramo 1 (`dfda86d65`) | hoy (`9358f02b1`) |
|---|---|---|
| Vivas | 202 | 202 |
| Desplazadas | 83 | 82 |
| Cambiadas | 48 | 55 |
| **Desfasadas** | **131** | **137** |
| Intactas | 69 | 63 |

Siete filas cambian de veredicto (seis intactas pasan a cambiadas y una desplazada también). Tres citan
el comentario de `modoVisible.ts` y tres citan líneas de otros documentos de `docs/legal/`: las seis las
editó hoy SCRUM-1500h. La séptima cita `settingsView.js`, y por qué cambió no lo he mirado.

### La separación

El criterio no es mío: lo fijó el fundador hoy mismo al corregir estos documentos (SCRUM-1500h, que cita su
decisión de SCRUM-1500 c.18993). A los dos inventarios les puso una **nota fechada** que dice «es del
19-ago-2026 y NO se reclasifica»; a la auditoría y a las preguntas del asesor las **corrigió en su sitio**.
⚠️ Esa decisión la he leído en el commit `311738c07` y en el texto de los documentos, **no en Jira**.

| Grupo | Documento | Desplazadas | Cambiadas | Desfasadas | Por qué va ahí |
|---|---|---|---|---|---|
| **1 · VIVO** | `AUDITORIA_CAMINO_EMISION.md` | 16 | 1 | **17** | dos skills mandan leerla «para saber qué está construido»; 27 commits; corregida en su sitio el 8 y el 13-oct |
| **1 · VIVO** | `PREGUNTAS_ASESOR.md` | 7 | 1 | **8** | 38 commits; la citan 14 tests y 4 ficheros de `src/`; corregida en su sitio |
| | **Grupo 1** | **23** | **2** | **25** | |
| **2 · FECHADO** | `INVENTARIO_AFIRMACIONES_VERIFACTU.md` | 25 | 27 | **52** | nota del fundador: «NO se reclasifica» |
| **2 · FECHADO** | `INVENTARIO_AFIRMACIONES_SKILLS.md` | 2 | 8 | **10** | la misma nota |
| **2 · FECHADO** | `MEDICION_GUION_H2_EN_PUBLIC.md` | 2 | 2 | **4** | misma forma que los inventarios («Medido: 19-ago · Contra: sha»), 1 commit, fuera de un script nadie la nombra. **Inferencia mía**: no tiene nota del fundador |
| | **Grupo 2** | **29** | **37** | **66** | |
| **3 · DUDOSO** | `AUDITLOG_FISCAL_CONTRATO.md` | 28 | 14 | **42** | abajo |
| **3 · DUDOSO** | `ENVIO_ASESOR_2026-09-28.md` | 0 | 2 | **2** | abajo |
| **3 · DUDOSO** | `EXPEDIENTE_FISCAL_ANTICIPOS_RECAPITULATIVA.md` | 2 | 0 | **2** | abajo |
| | **Grupo 3** | **30** | **16** | **46** | |
| | **Total** | **82** | **55** | **137** | suma comprobada contra el censo |

**Por qué dudo de cada uno del grupo 3:**

- **El contrato del auditlog (42, el mayor).** Su cabecera dice «escrito el 29-jul-2026 sobre `485ff72`» y
  «nada de esto está implementado»: por forma es un documento fechado. Pero el fundador lo corrigió en su
  sitio hoy, y lo citan `src/` y el máster: por uso es vivo. **No sé de cuál es, y lo que leí inclina a
  fechado:** de sus 14 cambiadas, las 14 apuntan hoy a una línea que no dice lo que la frase afirma, y en
  al menos 6 no es que la línea se moviera sino que **el código que describía se reescribió** (el tipo de
  acciones, `recordAudit` —hoy marcado LEGADO—, el `catch` de `lib/invoicing.ts`). Cambiarle 42 números
  dejaría una propuesta de julio con aspecto de recién verificada. De las otras 8, en 3 comprobé que el
  hecho sigue en pie en otra línea; las 5 restantes no las he leído más allá de la línea citada.
- **El envío al asesor (2).** Lleva la fecha en el nombre, y sus dos citas tienen testigo que la casa
  comprueba y hoy pasa: apuntan bien. El censo las da por cambiadas porque el texto de la línea citada se
  editó (decía «RESPONDIDA por el asesor fiscal», dice «RESPUESTA DE IA»). **No hay nada que arreglar**;
  dudo sólo de en qué grupo contarlas.
- **El expediente de anticipos (2, más las 2 sin referencia).** Borrador de julio que nadie toca desde el
  29-jul, pero lo citan otros tres documentos legales. No sé si alguien lo consulta.

### Grupo 1: el arreglo que propongo

Leídas las 25 contra su frase, una a una (`vivas-*-contra-su-frase.txt`):

| | Auditoría | Preguntas | Total |
|---|---|---|---|
| Cambiar el número, y nada más (el censo da un solo destino y la frase lo confirma) | 13 | 5 | **18** |
| Hay que leer antes de tocar | 3 | 2 | **5** |
| No necesitan nada (apuntan bien; se editó el texto citado y el documento ya lo anota) | 1 | 1 | **2** |

- Las 3 de la auditoría que piden lectura: la de la línea 39 (dos destinos posibles) y las de las líneas
  217 y 234, que citan la misma coordenada dentro de una frase fechada («MEDIDO el 16-sep-2026», «la 673
  se quedó vacía»): ahí el número forma parte de un relato.
- Las 2 de las preguntas (líneas 745 y 764): según la referencia nacieron apuntando a una llave de cierre
  y a una línea en blanco. O nacieron mal, o el autor midió sobre otro árbol que el del commit. No lo sé.

**Cabe en UN PR:** dos ficheros, 18 números en 16 líneas de documento (21 líneas si entran las cinco que
piden lectura). Se edita **en su sitio, sin
mover líneas**, porque otros documentos citan a estos dos por número de línea. Es `docs/legal/`: lo toca
J5 **con permiso del fundador**, que se da caso a caso y hoy no está dado.

⚠️ **El censo no sirve para comprobar ese PR.** Mide contra el commit en que la cita entró en el documento:
una cita recién corregida nace «intacta» por construcción, esté bien o mal. Se comprueba leyendo, y
`leer.mjs` pone cada frase al lado de lo que hay hoy en la línea citada.

**Opción aparte, que no propongo sin que la decida un jefe:** ponerles testigo a esas 18 al corregirlas.
Es el mecanismo que ya existe y es lo que la auditoría hace con las suyas (13 de sus 34 intactas lo
llevan). Tiene el coste que se midió en el tramo 1: cada cita con testigo pone en rojo el PR que la mueva.

### «Intacta no es correcta» y «cambiada no es falsa»: la muestra

- **34 intactas leídas contra su frase** (todas las de la auditoría): **34 dicen lo que la frase afirma.**
  ⚠️ Es el documento más cuidado de los ocho: no vale para los otros siete, cuyas 29 intactas no he leído.
- **18 cambiadas leídas de 55:** **4 no son falsas** (la cita apunta bien; se editó el texto citado) y
  **14 apuntan a otra cosa** — las 14 del contrato. En 3 de esas 14 (dos hechos) lo afirmado sigue siendo
  cierto en otra línea: el borrado del merchant sigue llevándose `auditLog`, y `audit_log` sigue en el volcado.
- **Las 37 cambiadas del grupo 2 no las he leído**, a propósito: no se van a tocar.

**¿Es mayor de lo que parece?** En los dos documentos vivos, no: es mecánico y pequeño. Donde sí lo es, es
en el contrato del auditlog, y no por los números de línea: describe un código que ya no existe y su
cabecera sigue diciendo que nada está implementado. Eso no lo arregla ninguna cita; es una decisión sobre
el documento entero (nota fechada, como los inventarios) y es del fundador.

### Lo que NO he medido

- La decisión c.18993 de SCRUM-1500 en Jira: la tengo por el commit y por las notas de los documentos.
- Las 29 apariciones de «fichero:línea» que el extractor deja fuera (tramo 1): siguen fuera de toda cifra.
- Si el contrato del auditlog está implementado y cuánto: sólo vi que tres de sus frases ya no describen el
  código de hoy.
- El desfase en `docs/master`, en el máster y en 4 de las 5 de `docs/equipo/`.
- La tanda completa de tests. Sí los guards de registro que toca este PR, abajo.

### Aceptación → dónde se ve

| aceptación (del encargo) | dónde se ve |
|---|---|
| Separar las que viven en documentos vivos | tabla «La separación», grupo 1 · `salida-tabla-por-documento.txt` |
| Decir cuántas viven en registros fechados y no se tocan | grupo 2: 66. En `docs/master`: 0 de las desfasadas, 4.786 sin censar |
| Las dudosas, y por qué | grupo 3: 46, con el motivo de cada documento |
| Para el grupo 1, el arreglo: cuántas, cuánto cuesta, cuántos PR | «Grupo 1: el arreglo que propongo» |
| Leer una muestra de las cambiadas contra su frase | 18 de 55 · `muestra-14-cambiadas-contrato.txt` |
| Positivo que tiene que aparecer y cero derivado | control sembrado del censo (6 de 6; CIEGO sin rotas) · control 205 y cero sembrado en `fuera.mjs` |

## SCRUM-1524c · Tramo 3 (jv-j5g, 13-oct-2026): las 25 citas vivas, arregladas, y la nota fechada del contrato del auditlog

**Medido contra:** `origin/main` = `6f35b50901fac64347d862255ec755a036ca1f0d` · 2026-10-13T11:00:33Z (hora de GitHub)

A9: aviso → A10 «El sitio al que un censo dice que se fue una línea es el del texto que había, no el de lo que la frase afirma: si la cita nació mal, su destino también.» — no se pudo comprobar: decidir qué afirma una frase es leerla; `leer.mjs` lo comprueba para estas 25 con el texto esperado escrito a mano, y no corre en CI

**ES CONSTRUIR, con permiso del fundador:** SCRUM-1524 c.19292 (las 25 citas del grupo 1 y la nota fechada).
Carril J5, a mano. Tres ficheros de `docs/legal/`, una línea en A10 y este registro. Nada en `src/`, ni en
`scrum525d`, ni en su congelado. Instrumentos y salidas: `docs/master/evidencias/SCRUM-1524c/`.

### Lo primero: cuatro de las «cambiar el número y nada más» no iban donde decía el censo

El tramo 2 clasificó 18 citas como «cambiar el número, y nada más», con el destino que da el censo. **En
cuatro de las cinco de `PREGUNTAS_ASESOR.md` ese destino era otro sitio.** El censo busca dónde está hoy
el texto que había en la línea citada el día que la cita entró. Las citas de la sección 21 (los avisos del
libro de facturas) entraron **apuntando ocho líneas más arriba de lo que su frase describe**: la que dice
«`descuadre` se dispara en la 231» apuntaba ese día a la línea de `importesIlegibles`. Seguir al censo
habría dejado cuatro citas con el número nuevo y apuntando igual de mal.

| Línea del documento | Decía | El censo daba | Lo que la frase describe está en |
|---|---|---|---|
| 693 | `:231` | 238 | **246** (`if (libro.miradas > 0) avisar(COPY.descuadre…`) |
| 693 | `:229` | 236 | **244** (`if (asientos.length === 0)`) |
| 724 | `:223-225` | 230 | **238-240** (el bloque de `importesIlegibles`) |
| 786 | `:332-334` | 339 | **346-349** (el bloque de `albaranesNoSellados`) |

El destino bueno sale del bloque de código que el propio documento pone debajo de cada cita. Las dos que
el tramo 2 dejó como «hay que leer» (745 y 764) son el mismo defecto: quedan en la 241 y la 242. La de la
704 sí iba donde decía el censo (60-62). En la auditoría, las 13 de «sólo el número» coinciden con el censo.

### Lo hecho

| | Auditoría | Preguntas | Total |
|---|---|---|---|
| Citas con el número cambiado | 16 | 7 | **23** |
| Sin tocar (apuntan bien: 223 y 461) | 1 | 1 | **2** |
| Líneas de documento tocadas | 15 | 6 | **21** |

- **Tres llevan además la fecha al lado, en su misma línea**, porque el número vive dentro de una frase
  fechada y esa frase no se reescribe (SCRUM-1521 c.19153): la 39 (ya contaba quién movió la línea; se le
  añade que decía 563) y la 217 y la 234 (dicen «MEDIDO el 16-sep-2026» y «la 673 se quedó vacía»: la cita
  pasa a la 930 y la nota dice que «la 674» y «la 673» del párrafo son las de aquel día).
- **La nota fechada del contrato** va en la línea 2 de `AUDITLOG_FISCAL_CONTRATO.md`, que estaba en
  blanco. Dice que el documento se deja como se escribió el 29-jul-2026, que su cabecera («Cero código»,
  «Nada de esto está implementado») dejó de ser cierta **ese mismo día** y que sus coordenadas no se ponen
  al día a propósito. Sus 42 números no se han tocado.
  - **Desde cuándo, medido:** el contrato entró en `f4d1f0bc2` (29-jul, 13:39 +02:00) y `df8890e63`
    (29-jul, 16:33 +02:00), que lo tiene por ancestro y está en `main`, cambió seis ficheros de `src/` con
    el título «SCRUM-207: "si no consta, no se emite" deja de ser una intención».
  - **NO medido, y la nota lo dice:** cuánto de lo que el contrato propone está construido hoy.

### Antes de añadir líneas: quién cita estos tres ficheros por fichero:línea

Medido con `git grep` sobre todo el árbol (positivo: una cita que existe hoy sale; cero: un nombre
fabricado da 0):

| Documento | Lo citan por línea (fuera de `docs/master`) | En `docs/master` |
|---|---|---|
| `PREGUNTAS_ASESOR.md` | 8 sitios: `src/…/libroRegistro.repo.ts`, `public/…/expensesView.js`, 2 tests y 3 documentos legales | 15 registros |
| `AUDITLOG_FISCAL_CONTRATO.md` | 1 (un inventario, líneas 300 y 777) | 8 registros |
| `AUDITORIA_CAMINO_EMISION.md` | 0 | 14 registros |

**Decisión: no se añade ni se quita ninguna línea en ninguno de los tres.** Todo va dentro de líneas que
ya existían, y la nota del contrato ocupa una línea que estaba vacía. `aplicar.mjs` se niega a escribir si
el número de líneas cambia; `git diff --numstat` da 15/15, 6/6 y 1/1, y los tres siguen en 240, 1.410 y 800.

### La política de privacidad

Ninguna de las 25 cae en ella, y no se ha tocado ni una palabra. En `PREGUNTAS_ASESOR.md` «privacidad»
aparece en las líneas 57, 63, 95, 1257 y 1316; las citas tocadas están entre la 693 y la 786. Los otros
dos documentos no la nombran. ⚠️ En `docs/legal/` no he encontrado el texto de la política en sí: lo que
hay son menciones a la publicada en `yaqu.app/privacidad`, y un documento sobre el tratamiento de datos
que este tramo no abre.

### Cómo se comprobó: leyendo, no con el censo

`leer.mjs` pone cada cita junto a la línea a la que apunta en el árbol y exige que esa línea contenga un
texto escrito a mano a partir de la frase (`tabla.mjs`).

| Pasada | Resultado |
|---|---|
| Antes de aplicar (`salida-leer-ANTES.txt`) | 2 bien de 25, 23 rotas: las 23 porque el documento aún no llevaba la cita. Sale 1 |
| Después (`salida-leer-DESPUES.txt`) | **25 bien de 25**, 0 rotas. Sale 0 |
| Control positivo, sembrado | 2 citas rotas fabricadas (una línea más arriba; fichero que no existe): vistas 2 de 2 |
| Cero derivado, sembrado | 1 cita buena fabricada: no la marca |
| Sin las rotas (`--sin-rotas`) | dice CIEGO, no da ninguna cifra y sale 2 |

Y leídas con los ojos las 25 de `salida-leer-DESPUES.txt`, una a una.

### Lo que NO he hecho ni medido

- **Las 34 intactas de la auditoría no se han releído** (ya leídas en el tramo 2).
- **Cuatro coordenadas sueltas de la misma sección 21 siguen desfasadas y no se han tocado**: `:56-58`,
  `:59`, `:60` y `:73`, que van sin nombre de fichero y por eso no están entre las 25 (el extractor no las
  ve). Comprobada una: `:56-58` se refiere al texto de `avisoIlegibles`, que hoy está en 63-65. El permiso
  cubre las 25; éstas se le dicen al orquestador.
- Las seis coordenadas de `libroRegistro.ts` de esa sección (`:105`, `:107`, `:109`, `:120`, y sueltas
  `:18-20` y `:118`): las cuatro con nombre de fichero no salen desfasadas en el censo, las dos sueltas el
  censo no las ve, y **ninguna la he leído contra su frase**. Después de lo de arriba, «no desfasada» ahí
  vale menos que en la auditoría.
- Los grupos 2 y 3, salvo la nota del contrato. No se ha puesto testigo a ninguna cita: es decisión de un jefe.
- La tanda completa de tests. Sí los guards que tocan estos ficheros, abajo.

### Aceptación → dónde se ve

| aceptación (del encargo y de c.19292) | dónde se ve |
|---|---|
| Arreglar las 25 citas vivas | `docs/legal/AUDITORIA_CAMINO_EMISION.md` y `docs/legal/PREGUNTAS_ASESOR.md` · `docs/master/evidencias/SCRUM-1524c/salida-leer-DESPUES.txt` |
| Nota fechada al contrato, sin mover sus 42 números, sin decir cuánto hay hecho | `docs/legal/AUDITLOG_FISCAL_CONTRATO.md`, línea 2 |
| Ni una palabra de la política de privacidad | apartado «La política de privacidad» |
| Medir quién cita por línea antes de añadir líneas, y declarar la decisión | apartado «Antes de añadir líneas» |
| Comprobar leyendo, no con el censo | `docs/master/evidencias/SCRUM-1524c/leer.mjs` y sus dos salidas |
| Positivo que tiene que aparecer y cero derivado | controles sembrados de `leer.mjs`; CIEGO con `--sin-rotas` |

### Corrección tras el primer obligatorio (jv-j5i, 13-oct-2026): el temporal de `leer.mjs`

El primer empujón de este tramo (`90365e6574d4e9787754f00516c555e81a5c0603`, PR #2369) dejó el obligatorio en
ROJO, y no por las citas: por el propio instrumento. `leer.mjs` creaba su directorio de controles con
`mkdtempSync` y lo borraba en la línea siguiente al uso, por el camino feliz. Lo acusó
`tests/scrum864c-el-temporal-no-vuelve.test.mjs` (`[NO_GARANTIZADA] …/leer.mjs:49 · borra en 61 SIN cobertura`).
El tramo se entregó sin leer el obligatorio; lo leyó el orquestador.

- **El log, contado** (job 115263942409, 1.812.571 B, 15.121 líneas, anclando al inicio del caso):
  11.107 pasan · **1 cae** · 93 saltan · suma 11.201, que es el total que declara node, partida a partida.
  La cruz a secas daba 2 en el tramo y 4 en todo el log. Control positivo (el caso caído) 1; cero derivado
  (su nombre del revés) 0; sin el positivo dice CIEGO.
- **El arreglo:** el borrado pasa a un `finally`. Sólo `leer.mjs`; ni el guard ni `scripts/_censo-mkdtemp.mjs`.
- **En rojo primero:** con el fichero de antes el guard da 3 pasan · 1 cae de 4; con el de ahora, 4 de 4.
- **Por efecto, no sólo por forma:** con un `throw` sembrado justo antes de juzgar los controles, la versión
  de antes deja 1 directorio `scrum1524c-*` en TMPDIR y la de ahora 0; sin `throw`, las dos dejan 0. El
  sujeto deja testigo (revienta, o imprime su POBLACION) y el banco aborta si falta.
- **La salida no cambia:** `leer.mjs` da byte a byte `salida-leer-DESPUES.txt` (9.033 B), y `--sin-rotas`
  sigue diciendo CIEGO con salida 2.

No medido: un proceso matado a lo bruto no ejecuta ningún `finally` (es el límite que declara el propio
guard); la tanda completa en local; y `aplicar.mjs` y `tabla.mjs` no crean temporales (leídos, sin
`mkdtemp`), así que no se tocan. El contador y el banco van en `docs/master/evidencias/SCRUM-1524c/`
(`contar-log.mjs`, `banco-temporal.mjs` y sus dos salidas); el log del job no se sube, se vuelve a bajar.
De paso, error propio: el contador nació con un BOM literal dentro (lo escribí como escape y aterrizó como
carácter); lo cazó el recuento de bytes antes de subirlo, y el recuento del log se repitió con el corregido.
