# SCRUM-853 · El avisador despierta solo por rojo OBLIGATORIO, y nadie escribe sobre un PR que ya entró

**Fecha:** 15-sep-2026 · **Carril:** automatización (Sesión 5) · **Gate:** sin gate
**Medido contra:** `origin/main` = `289cbf41141fd6f6ae018324879e11b7f4a8ff54` · 2026-09-15T13:55:34Z
**Rama:** `scrum-853-avisador-solo-obligatorio` · **PR:** #1287 · **commit:** `922e440fb364f29a8b9f6ad9f699310a924ab6c6`
**Tanda:** 853 34/34 · 834 41/41 · vigía 64/64 · 839c 10/10 · guards que leen `.github` 285/285 · mutaciones 9 de 9 vivas

## El defecto

El círculo, medido con el reloj de GitHub: meta-guard ciego en main → rojo en cada PR → el avisador
despierta a Claude → el PR ya ha entrado → el arreglo queda en una rama `claude/pr-*` → main sigue ciego.

- **47 ramas `claude/pr-*` vivas a las 13:55Z.** En todas, la hora del nombre de la rama es de 1 a 7 min
  POSTERIOR al `mergedAt` de su PR. Claude no llegaba tarde: **arrancaba sobre un PR ya mergeado**, y
  `claude-code-action@v1` (`src/github/operations/branch.ts`) crea una rama nueva cuando el PR está
  `CLOSED` o `MERGED`.
- **El avisador comentó DESPUÉS del merge en los 7 PR medidos.** El #1255: `build + tests` verde
  09:46:52 · merge 09:46:56 · meta-guard rojo 09:46:57 · aviso 09:47:14 · `claude.yml` 09:47:17 →
  `claude/pr-1255-20260915-0947`.
- Dos defectos de la puerta: despertaba con el workflow CI ENTERO en `failure`, sin mirar qué job cayó
  (en main solo es obligatorio `build + tests`), y no miraba si el PR seguía abierto.
- `claude.yml` llevaba 109 ejecuciones el 15-sep.

## La decisión, y por qué

1. `scripts/puerta-avisador-rojo.mjs` despierta solo por rojo en un check OBLIGATORIO. La lista se lee de
   las reglas vivas de main con las MISMAS funciones que el vigía (`checksObligatoriosDeReglas`,
   `checksEnRojo`): una sola fuente, y un censo exige que no haya otro lector. Sin lista,
   `SIN-LISTA-OBLIGATORIOS`: no despierta, y lo dice.
2. El PR abierto se comprueba en los DOS sitios que despiertan a Claude, con la misma regla
   (`prNoAbierto`): el avisador (`PR-YA-CERRADO`, `SIN-ESTADO-PR`) y `claude.yml` antes de la acción
   (`scripts/puerta-claude.mjs`). Donde se despierta, no donde se llama: una persona que escribe la
   mención en un PR ya mergeado recibe «No arranco». Decisión confirmada por el orquestador.
3. Después de la acción, siempre, se declaran las ramas mudas —una `claude/pr-N-*` nueva, o la rama del
   PR recreada tras el merge—: aviso a una persona y run en rojo.
4. `claude.yml` ejecuta su puerta desde `origin/main`, nunca desde el checkout del PR: en un comentario
   de revisión el checkout trae el código de quien comenta.
5. No se tocan la marca ni el tope (decisión confirmada), la puerta fiscal, `ci.yml` ni las ramas
   `claude/*` (A12: son la evidencia).

## Lo que se midió

- Laboratorio con los pasos REALES sacados del YAML y datos reales de GitHub, sin publicar nada: el paso
  del avisador da `PR-YA-CERRADO` para el #1255 y el #1280, que ese día sí lo despertaron. La CLI de la
  puerta, con cada comprobación aislada: `SIN-ROJO-OBLIGATORIO` (#1255), `AVISAR` (#1205 con su
  obligatorio en rojo), `SIN-LISTA-OBLIGATORIOS` y `SIN-ESTADO-PR`.
- El laboratorio cazó dos fallos que los tests no veían: la comprobación de la mención del aviso de rama
  muda no recibía la ruta (reventaba con código 1, se leía como «lleva la mención» y el aviso no salía
  nunca), y un 404 de `gh api -q` deja el cuerpo del error en stdout, que se tomaba por la cabeza de una
  rama ya borrada.

## Verificado en rojo

27 de 30 tests en rojo antes del código. 9 mutaciones declaradas: las 9 tumban su test, sobre una copia
del árbol y en el meta-guard del CI del #1287.

## Lo que NO cubre

- El avisador está desactivado a mano en GitHub desde las 14:28:04Z. Lo reactiva el fundador cuando esto
  esté en main; la verificación por efecto es de la orquestación.
- `vigia-atascados.yml` (FECHA) arrastra el mismo patrón roto de `gh api`: va aparte.

## Ficheros

`scripts/puerta-avisador-rojo.mjs` · `scripts/puerta-claude.mjs` · `.github/workflows/avisador-rojo.yml` ·
`.github/workflows/claude.yml` · `tests/scrum853-avisador-solo-obligatorio.test.mjs` ·
`tests/scrum834-puerta-avisador-rojo.test.mjs`

---

# SCRUM-853 · APÉNDICE — las lecturas del avisador fallan CERRADAS

**Fecha:** 15-sep-2026 · **Carril:** automatización (Sesión 5) · **Gate:** sin gate
**Medido contra:** `origin/main` = `e8510c9c4ff7d6afab45c5e43c24ec641345b9d3` · 2026-09-15T14:47:24Z
**Tanda:** lecturas 11/11 · 853 34/34 · 834 41/41 · vigía 64/64 · 839c 10/10 · guards que leen `.github` 305/305 · mutaciones 5 de 5 vivas

## El defecto

El #1287 no podía entrar: `build + tests` en rojo por SCRUM-854, porque faltaba esta entrada. Nadie se
enteró porque el avisador está apagado.

Y el patrón roto que el laboratorio encontró en `claude.yml` estaba también en el paso `puerta` del
avisador, en **cinco** lecturas, no en las tres que se habían declarado. Medido contra la API real: en un
error, `gh api -q` sale con 1 **y deja el cuerpo JSON del error en stdout**, y `$(… || X)` se queda con él.

| lectura | medido | qué hacía |
|---|---|---|
| PR | 422 | el cuerpo del error como número de PR: el paso reventaba más abajo, sin veredicto |
| PERMISO | 404 con un usuario inexistente (el bot da `none`, no 404) | el error como permiso; cerrado por casualidad |
| CHECK | 422 | `{…}ci` dentro de la marca |
| FICHEROS | 404 | 🔴 un «fichero» que no es fiscal: la puerta fiscal NO escalaba |
| PREVIAS | error | 🔴 la tubería con `grep` lo dejaba vacío: el tope contaba cero avisos previos |

## La decisión, y por qué

Cada lectura se captura solo si la orden sale bien (`if ! V="$(gh api …)"; then …; fi`). PR y PREVIAS
ilegibles salen con su propio código (`PR-ILEGIBLE`, `AVISOS-PREVIOS-ILEGIBLES`) y no avisan; FICHEROS
ilegible deja la lista vacía y la puerta fiscal escala, que es su diseño; PERMISO queda vacío, que no es
escritura; CHECK cae a `ci`, el respaldo de siempre. No cambia la lógica de la puerta fiscal ni la del
tope: cambia que no se les dé un dato que nadie ha medido.

## Verificado en rojo

`tests/scrum853-lecturas-que-fallan-cerrado.test.mjs` ejecuta el paso `puerta` REAL del YAML con un `gh`
falso que falla como el de verdad. Antes del arreglo: 5 rojos, uno por lectura, y 6 verdes (dos suelos y
cuatro controles). Después, 11/11. Cada lectura tiene su mutación, que le devuelve el `|| …`: las 5
tumban su test.

El primer push de este apéndice (`32cc49697fc5e78c51a0e3c1a634221d292bb0d8`) volvió a dejar `build +
tests` en rojo, esta vez por SCRUM-824 (1 fallo de 6793): tres escrituras del test nuevo colgaban de un
temporal devuelto por un ayudante, y el censo de temporales no atraviesa el valor de retorno de una
función. Se le enseñó al censo de dónde cuelga —el temporal se crea a la vista, con `os.tmpdir()`— en vez
de ampliar su lista de ficheros sin probar.

## Lo que NO cubre

`AUTOR` se lee sin respaldo: si falla, el paso aborta y el veredicto final lo declara «SIN VEREDICTO».
`vigia-atascados.yml` (FECHA) va aparte, después.

## Ficheros

`.github/workflows/avisador-rojo.yml` · `tests/scrum853-lecturas-que-fallan-cerrado.test.mjs` ·
`docs/master/SCRUM-853.md`

---

# SCRUM-853c · APÉNDICE — el vigía tampoco se cree un error, y un «no lo sé» no es un «no hay»

**Fecha:** 16-sep-2026 · **Carril:** automatización (Sesión 5) · **Gate:** sin gate
**Medido contra:** `origin/main` = `77ce9d1e86d6ffa921b1c92561ec2d7994f8e5eb` · 2026-09-16T06:42:56Z
**Rama:** `scrum-853c-fecha-del-vigia`
**Tanda:** 853c 9/9 · vigía 64/64 · 839c 10/10 · 824 9/9 · guards que leen `.github` 321/321 · mutaciones 3 de 3 vivas

## El defecto

Quedaba pendiente la lectura `FECHA` del vigía, con el patrón de SCRUM-853. Al medir las cinco lecturas
del workflow, una por una y contra la API real, salieron **dos formas distintas de fallar** y tres
lecturas rotas, no una:

| lectura | orden | en un error | ¿fallaba abierta? |
|---|---|---|---|
| EST | `gh pr view` | stdout VACÍO → `UNKNOWN` | no: el CLI escribe por stderr |
| SHA | `gh pr view` | stdout VACÍO → vacío | no, por lo mismo |
| FECHA | `gh api` | el CUERPO del error | 🔴 sí → `MINUTOS=NaN` |
| NUM | `gh issue list` | vacío → «no hay issue» | 🔴 sí → el publicador **crearía otro issue** |
| ANTES | `gh issue view` + `sed` | vacío → «memoria vacía» | 🔴 sí → **todo atasco saldría como nuevo** |

`gh api` escribe el cuerpo del error por stdout; los subcomandos del CLI (`pr`, `issue`) no escriben
nada. Por eso EST y SHA ya fallaban cerradas — medido, no supuesto—, y por eso las otras tres no.

Las dos últimas no son el mecanismo del cuerpo del error, pero son su misma familia y tienen peor
consecuencia: un fallo pasajero de la API partiría la memoria del vigía entre dos issues, o le haría
comentar la lista entera como si acabara de aparecer. La regla «solo se avisa cuando EMPEORA» descansa
sobre esa memoria.

## La decisión, y por qué

- `FECHA` se captura solo si la orden sale bien; si no, queda SIN DATO, que es lo que el clasificador ya
  sabe tratar (sin ese dato no se regala la gracia del push reciente).
- `NUM` y `ANTES`: si no se pueden leer, **la pasada para** con su código (`ISSUE-ILEGIBLE`,
  `MEMORIA-ILEGIBLE`) y sin publicar nada. Reescribir el issue con una memoria en blanco sería perderla.
- Un vacío LEGÍTIMO sigue pasando, y tiene su control: que el issue no exista todavía (primer día), y
  que el cuerpo no tenga aún la marca de memoria.
- EST y SHA se dejan como están, con la medición escrita al lado: arreglar lo que no está roto habría
  sido cambiar código sin dato que lo pidiera.

## Verificado en rojo

`tests/scrum853c-el-vigia-no-se-cree-un-error.test.mjs` ejecuta los DOS pasos reales del vigía —el de
reunir y el de clasificar— con un `gh` falso que imita las dos formas de fallar medidas. Antes del
arreglo: 3 rojos (FECHA, NUM, ANTES) y 6 verdes (tres suelos, el control de EST/SHA y dos controles de
vacío legítimo). Después, 9/9. Tres mutaciones, una por lectura: las tres tumban su test.

## Lo que NO cubre

`gh pr list`, `gh issue create/edit/comment` y la escritura de `reglas.json`/`checks/*.json` no se tocan:
las tres primeras fallan cerradas por `bash -e` (y el suelo del veredicto lo declara), y las dos últimas
sobrescriben el fichero con el respaldo, así que el cuerpo del error no sobrevive.

## Ficheros

`.github/workflows/vigia-atascados.yml` · `tests/scrum853c-el-vigia-no-se-cree-un-error.test.mjs` ·
`docs/master/SCRUM-853.md`

---

# SCRUM-853d · APÉNDICE — el cortacircuitos: 6 despertares por ventana de 60 minutos

**Fecha:** 16-sep-2026 · **Carril:** automatización (Sesión 5) · **Gate:** sin gate
**Medido contra:** `origin/main` = `956be91d588031cd46b68b577968b82c4bc01660` · 2026-09-16T07:30:01Z
**Rama:** `scrum-853d-cortacircuitos`
**Tanda:** 853d 16/16 · 853 34/34 · lecturas 11/11 · 853c 9/9 · 824 9/9 · 237 8/8 · mutaciones 4 de 4 vivas

## Por qué, y de dónde sale el número

El 853 quitó el 96% de las causas de despertar (88 de 92 rojos del 15-sep eran de checks NO
obligatorios). Lo que queda es el bucle con un rojo obligatorio REAL: Claude empuja, CI vuelve a
rojo, el avisador vuelve a despertar. Contra eso no hay puerta que valga: hace falta un techo.

Los datos sobre los que el orquestador decidió **6 por ventana de 60 minutos**:

| dato | medido |
|---|---|
| ejecuciones de `claude.yml` el 15-sep | 116 · 58 saltadas · **58 despertares reales** |
| pico en una hora | **34**, desde las 09:31Z |
| coste de UN despertar legítimo (16-sep) | **0,7369 USD** · 31 turnos · 137,7 s · `claude-sonnet-5` |
| demanda legítima de un día malo entero | **4** rojos obligatorios |

A ese precio el pico de ayer habrían sido ~25 USD en una hora; con el tope, ~4,4 USD. Y 6 por hora
sigue siendo más que toda la demanda legítima de un día concentrada en sesenta minutos.

## La decisión, y por qué

- **Dónde:** en la puerta de `claude.yml` — donde se DESPIERTA—, no en el avisador, que es solo uno
  de los que llaman. Una persona que escribe la mención gasta hueco igual.
- **Qué cuenta:** las ejecuciones de `claude.yml` de los últimos 60 min, EXCEPTO la actual (no se
  cuenta a sí misma) y las SALTADAS (el `if` del job dio falso: no gastaron nada). Las que están EN
  MARCHA sí cuentan: ya están gastando.
- **Falla cerrado:** si la lista no se puede leer, o alguna fecha no se puede leer, NO se despierta
  (`SIN-CUENTA-DE-DESPERTARES`). Es la misma familia que mordió dos veces: `gh api` escribe el cuerpo
  del error por stdout, y una cuenta hecha sobre eso daría CERO, que es el número con el que un tope
  no corta nunca. Por eso la lista se captura solo si la orden sale bien.
- **Contesta a quien llama:** con cuántos van y **a qué hora se abre el próximo hueco** (cuando el
  más viejo de la ventana sale de ella). Un tope silencioso se vive como una avería.
- **Orden:** primero la puerta del PR cerrado —la razón más concreta— y solo si ésa abre, el tope. Un
  PR ya cerrado no gasta hueco, porque nunca llega a despertar.
- **No se toca** el tope del avisador (3 avisos por PR), ni la marca, ni la puerta fiscal.

## Verificado en rojo

`tests/scrum853d-cortacircuitos.test.mjs`: 16/16, y antes del código el fichero entero no cargaba
—faltaban los exports—. Las cuatro propiedades que pidió el orquestador tienen su test: el 7.º no
despierta y dice cuándo podrá, el 6.º SÍ despierta, sin cuenta no se despierta, y con la ventana
vacía se despierta como hasta ahora. Más los bordes que deciden si la cuenta es honrada: la actual no
se cuenta, las saltadas no cuentan, las de 60 min exactos ya están fuera.

El laboratorio ejecuta el paso `puerta` REAL de `claude.yml` con un `gh` falso. **Y ahí se cazó un
fallo del propio laboratorio**, que se dice porque cambia lo que el verde significa: mi `gh` falso
devolvía el objeto crudo (`{workflow_runs: …}`) donde el real, con `-q`, devuelve la lista ya
transformada. El paso contestaba `SIN-CUENTA-DE-DESPERTARES` — el fail-closed funcionando, pero por
el motivo equivocado. Corregida la fidelidad del falso, los tres casos del laboratorio pasan.

Cuatro mutaciones, las cuatro vivas: `>=` por `>` (el tope que se queda corto), el fail-closed que
cuenta «no sé» como cero, la ventana que deja de filtrar, y las saltadas contando como despertares.

## Lo que NO cubre

- Solo cuenta despertares de `claude.yml`. Si algún día hay otro camino que gaste cuota, no lo ve.
- El `action_required` que retiene las ejecuciones disparadas por el bot sigue abierto: la medición
  de si `yaqu-bot` puede relanzarlas va después de esto, y es solo medición.

## Ficheros

`scripts/puerta-claude.mjs` · `.github/workflows/claude.yml` ·
`tests/scrum853d-cortacircuitos.test.mjs` · `docs/master/SCRUM-853.md`

---

# APÉNDICE EXPERIMENTO B — prueba de merge=union (rama desechable, se borra)

Línea que solo escribe la rama B.
