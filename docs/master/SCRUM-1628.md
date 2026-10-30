# SCRUM-1628 · `carriles.mjs de tests/*` decía «nadie lo reclama» para cualquier test

## S0 · SCRUM-1628 · el test de un ticket sale NO-PUDE-MIRAR, con la regla y dónde mirar

**Medido contra:** `origin/main` = `0fc4e30b8ff8c2ed2ed688fc16bb8d6f4e957cfb` · 2026-10-27T18:28:49Z (hora de GitHub, cabecera `Date:`; S0, por encargo del orquestador de Luis. Al cerrar, main iba 7 commits por delante, `aaad2d7eb`, ninguno en estos ficheros)
A9: comprobación → `tests/scrum1628-de-ve-la-regla-del-test-de-un-ticket.test.mjs`

**El defecto, reproducido antes de tocar nada:** `node scripts/carriles.mjs de tests/scrum1621-latido-vigia-de-main-y-tanda.test.mjs`
→ «sin fila en §3: nadie lo reclama», con salida 0. `dos-equipos.md:171` («`tests/`: el test de un ticket» → «el
puesto que trabaja el ticket») no produce regla: `_carriles.mjs` sólo convierte RUTAS, y esa fila no tiene ninguna
detrás del «`tests/`:». El instrumento no la veía y contestaba como si no existiera.

**La elección: la ② del ticket (distinguir), no la ① (aplicar la regla).** El dueño que da `:171` es el puesto que
trabaja el ticket, y eso es la etiqueta `area-…` de Jira, que la tabla no tiene y el instrumento no lee (tampoco la
cerradura, que lee `.claude/carriles.json` sin red). Sacarlo del nombre, del autor de git o de la cabecera del
registro es justo lo que la propia tabla descarta («No se reparte por el nombre […] ni por quién lo tocó», §3.3).
Aplicar la ① sin Jira sería inventar el dueño. Así que `de` dice lo que sabe y lo que no:

    tests/scrum1621-… → NO-PUDE-MIRAR: sin fila de ruta, pero es el test de SCRUM-1621, y docs/equipo/dos-equipos.md:171
    («el test de un ticket» → el puesto que trabaja el ticket) lo da al puesto que trabaja ese ticket. Cuál es no está
    en la tabla: es la etiqueta area-… de SCRUM-1621 en Jira. NO quiere decir «nadie lo reclama».

con **salida 2** (la de NO-PUDE-MIRAR del propio script) si alguna de las rutas preguntadas cae ahí.

**Lo construido:**
- `scripts/_carriles.mjs`: `filasSinRuta(texto)` (las filas «directorio: descripción» sin ruta) y
  `testDeTicket(rel, texto)` (un `tests/scrumNNN…` + la fila «el test de un ticket», buscada por su texto). Sin esa
  fila en la tabla devuelve `null`: no inventa una regla que la tabla ya no dice.
- `scripts/carriles.mjs de`: la línea nueva y la salida 2. Una ruta con fila sigue contestando su fila (gana la fila).
- Lo generado (`carriles.json`, `rules/`) NO cambia: `carriles.mjs comprobar` → IGUAL a la tabla.

**Medido sobre todo el repo** (7791 ficheros, `de` de `origin/main` contra el de la rama, en lotes de 150; driver de un
solo uso, fuera del árbol):

| población | ficheros | resultado |
|---|---|---|
| fuera de `tests/` | 6007 | 6007 iguales, **0 distintos** (control negativo) |
| `tests/` con fila de ruta | 13 | iguales |
| `tests/` sin fila y sin número de ticket en el nombre | 257 | iguales: siguen «nadie lo reclama» (control positivo) |
| `tests/scrumNNN…` sin fila | 1514 | pasan de «nadie lo reclama» a NO-PUDE-MIRAR con su ticket |
| otro cambio | 0 | — |

**El test, visto en rojo** (commit del arreglo `64d4dc8b3da06ab899f68ce96fa37c0a5318fb78` ANTES de inyectar; cada
inyección se apartó commiteándola en una cabeza suelta y volviendo a ese commit, sin `restore`):
1. `scripts/carriles.mjs` de `origin/main` (el defecto) → cae «el rojo de partida» (6/7).
2. «todo test tiene dueño» (`testDeTicket` casa cualquier `tests/…`) → caen el CONTROL POSITIVO y el censo (5/7).
3. la regla sin anclar a `tests/` en el nombre → cae sólo el censo: el prefijo de la fila sigue protegiendo lo de fuera.
   Con el prefijo quitado también → cae además el CONTROL NEGATIVO (5/7).
Sin inyectar: 7/7, y con `scrum1295`, `1295b`, `1480e`, `1480f`, 26/26.

**Guards dirigidos:** 700, 719, 850, 1349, 710b, 824, 836, 419, 702, 237, 976, 1415, 1387, 1185, 411, 812, 273 →
214 de 215. Cae `scrum836` porque este árbol no tiene `dist/` (sus anclas apuntan a `dist/…/pdf.service.js`): es del
entorno, no de esta rama. Suite entera: NO CORRIDA.

**Aceptación 4, los tres ficheros que la S0 dejó «sin dueño» (1480i), revisados con la regla:**

| fichero | ¿lo cubre `:171`? | lectura |
|---|---|---|
| `tests/_salida-entera.mjs` | no: es un ayudante, no el test de un ticket | hueco REAL de la tabla |
| `tests/scrum1610b-salida-cortada-sale-ciega.test.mjs` | sí: SCRUM-1610, con `area-j6` | artefacto del instrumento: era J6 por la regla |
| `tests/scrum765-la-puerta-y-el-suelo.test.mjs` | sí, pero SCRUM-765 no lleva etiqueta de área | la regla calla: hueco real |

Desde SCRUM-1610 c.21189 los tres tienen fila de J6 (SCRUM-1610c, rama aparte), así que ya no queda pregunta para
Javier.

**Lo que esto NO arregla, y se dice:** los 52 ficheros de `tests/banco-scrumNNN/` (15 directorios) llevan número de ticket en el nombre
del DIRECTORIO, no del fichero, y siguen «nadie lo reclama». La fila `:169` da a S3 «bancos e instrumentos», pero su
patrón es sólo `_banco-*`. Es una pregunta de la tabla (¿de S3 o del ticket?), no de este instrumento, y no la
decide esta rama.

## Tramo 1628b · el banco COMPARTIDO y el banco de UN ticket (S0)

**Medido contra:** `origin/main` = `5deff8b3b7b0f8a8d3cd037baabbca454ea7aa29` · 2026-10-29 10:0xZ (`Date:` de GitHub)
A9: comprobación → `tests/scrum1628-de-ve-la-regla-del-test-de-un-ticket.test.mjs`

*(La lección de este tramo, que la línea A9 no deja escribir en su formato: una regla que reconoce el número de ticket sólo en el nombre del FICHERO calla sobre los 52 de `tests/banco-scrumNNN/`, y el encargo la daba por cubierta. La comprobación es el test `SCRUM-1628b` de ese fichero (`:66`), que recorre los 15 bancos y exige el ticket del DIRECTORIO. Añadida el 29-oct-2026 ~10:4xZ, tras caer el obligatorio de #2980 por faltar esta línea: `scrum1294`, «ancla del 2026-10-29 sin línea A9».)*

Encargo del orquestador de Luis (29-oct): una fila en `dos-equipos.md` §3 que distinga el banco compartido (`tests/banco-scrum911/`) del banco de un ticket, con la medida de S0 del 27-oct como procedencia, y con control negativo: los que no son compartidos siguen cayendo en la regla «el test de un ticket».

### Lo que el encargo traía y no aguantó la medida

- **«los que no son compartidos deben SEGUIR cayendo en `:171`».** No caían: `carriles.mjs de` daba «sin fila en §3: nadie lo reclama» a los **52** ficheros de los 15 bancos, porque `testDeTicket` sólo reconocía el número de ticket en el nombre del FICHERO (`tests/scrumNNN…`), no en el del directorio (`tests/banco-scrumNNN/`). Lo dejó dicho el propio registro de 1628 («Lo que esto NO arregla»). La regla `:171` sólo los cubría en el papel.

### Qué cambia

- `docs/equipo/dos-equipos.md` §3: la fila `:171` nombra el banco de un ticket, y debajo entra la fila `tests/banco-scrum911/**` → **S3** (banco compartido = «bancos e instrumentos», la fila `:169`). **Que sea S3 es lectura de S0**, no decisión del orquestador: él decidió distinguir.
- `scripts/_carriles.mjs`: `testDeTicket` reconoce también `tests/banco-scrumNNN/`. En `de` gana la fila de ruta, así que `banco-scrum911` da S3.
- `.claude/carriles.json` y `.claude/rules/carril-s3.md`, regenerados con `node scripts/carriles.mjs generar` (`comprobar` los daba DISTINTOS de la tabla).
- `tests/scrum1628-de-ve-la-regla-del-test-de-un-ticket.test.mjs`: un caso nuevo (1628b) y la forma del nombre de ticket ampliada en el censo.

### Cómo se midió

| qué | comando | resultado |
|---|---|---|
| los bancos y quién los usa desde fuera | node sobre `tests/` y `scripts/`, buscando el nombre del directorio fuera de él | 15 dirs, 52 ficheros. **Importado** desde fuera: sólo `banco-scrum911` (29 ficheros; `scrum1575d:20`). Leídos como muestra: 1102f, 1322, 1329 (`scrum1349`), 1257 (su propio test), 911 (`scrum1575c`). Sólo en comentarios: 1220, 825. Nadie los nombra: 1325, 1334, 1341, 1397, 1436, 1456, 1477, 931 |
| antes del cambio | `carriles.mjs de` sobre `banco-scrum911/_entorno.mjs` y `banco-scrum1334/README.md` | los dos «nadie lo reclama» |
| después, los 52 | `carriles.mjs de` sobre `git ls-files "tests/banco-scrum*"` | **29 → S3** (banco-scrum911) · **23 → NO-PUDE-MIRAR con `:171`** (los otros 14 directorios) · 0 «nadie lo reclama» |
| control positivo | `de tests/zz-huerfano.test.mjs` · `de tests/_banco-no-existe.mjs` | el huérfano sigue «nadie lo reclama»; `_banco-*` sigue S3 por `:169` |
| control negativo | `de scripts/equipo/latido.mjs` · `de tests/_salida-entera.mjs` | S5 y J6, como antes |
| tests | los 9 ficheros de `tests/` que nombran `dos-equipos` o `carriles` | **83 tests · 83 pass · 0 fail · 0 skipped** |

### Lo que NO se ha hecho

- No se ha preguntado a S3 si acepta el banco: la fila le da cerradura sobre `tests/banco-scrum911/`. Si S1 vuelve a SCRUM-911 (encender MANT-1) y necesita tocar su banco, lo pide por su orquestador.
- Una cita con número de línea de `dos-equipos.md` en `docs/equipo/para-javier.md:415` (`:176`) apunta ahora una línea más arriba. Es un mensaje fechado a Javier; no se reescribe.
