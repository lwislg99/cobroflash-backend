# SCRUM-1092 (punto 2) · Cuántas veces ha pasado ya un aterrizaje en rama ajena

**Fecha:** 23-sep-2026 09:43Z (GitHub) · **Carril:** J6 · calidad y seguridad
**Medido contra:** `origin/main` = `2f66483eddeadb56d953d138a8c39583667de968` · 2026-09-23T09:43:03Z
**Rama:** `scrum-1092-cuantas-veces-ha-pasado`

> ⛔ `src/` intacto. No se ha tocado `.claude/hooks/guard-dangerous.mjs` (es de SCRUM-1091, S5) ni
> `scripts/equipo/sesion.mjs` (compartido por los dos equipos). No se ha escrito ningún guard nuevo.

## 0 · El encargo, en una línea

Medir sobre el historial cuántas veces un commit ha aterrizado en una rama que no era la de su
propio ticket, separando el caso con árbol sucio (avisa desde SCRUM-774) del caso con árbol limpio
(no avisa — el de hoy), y decir el suelo si el historial no permite distinguirlos.

## 1 · Método — se reutiliza el instrumento que ya existía, no se escribe un censo nuevo

`scripts/verificacion-s5/enlace-ticket-rama.mjs` ya cruza cuatro fuentes (nombre de rama, mensaje
de commit, `docs/master/SCRUM-N.md`, asunto de Jira) pero responde una pregunta distinta: si el
ticket se **menciona** en alguna de las cuatro. No comprueba si el commit **pertenece de verdad** al
ticket que el nombre de su rama declara — que es justo lo que pide este punto.

Sobre la MISMA fuente de verdad que ese instrumento (`git log --merges` de `origin/main`, el mismo
patrón para sacar la rama de `Merge pull request #N from …/<rama>`), se añadió la pregunta que
faltaba en dos censos complementarios, los dos de sólo lectura, ninguno registrado en
`package.json` ni en CI, los dos en `docs/master/evidencias/scrum1092/`:

- **A · `censo-merges.mjs`** — todo el historial de `origin/main`: para cada PR/merge cuya rama
  declara `scrum-N` (o `scrum-N-M` cuando el propio nombre declara varios tickets), los commits
  EXCLUSIVOS que aporta (`P1..P2` del merge) contra el ticket que menciona su propio mensaje
  (`SCRUM-<n>:` al inicio o en cualquier parte).
- **B · `censo-reflog.mjs`** — sólo este árbol compartido (`cobroflash-backend`, el checkout
  PRINCIPAL — `git rev-parse --git-dir` da `.git`, no un puntero de worktree —, que es donde las
  seis sesiones de este equipo arrancan por defecto si no piden un worktree propio): usa
  `git reflog show HEAD` para saber en qué rama estaba HEAD **de verdad** en el instante de cada
  commit — el dato que A sólo puede inferir a partir de dónde acabó fusionándose, nunca observar
  directamente.

Comando exacto de cada uno, en su propia cabecera.

## 2 · Resultados numéricos

**A (todo el historial):** 1519 ramas con `scrum-N` en el nombre mergeadas en `origin/main` · 3254
commits exclusivos analizados, de los que 3200 mencionan un ticket en su mensaje (54 no mencionan
ninguno) · **127 commits, repartidos en 57 ramas**, cuyo mensaje NO menciona el ticket de la rama
que los trajo · rango: 13-jul-2026 → 22-sep-2026. Cero CIEGO (todos los rangos `P1..P2` se pudieron
calcular).

**B (sólo este árbol compartido, reflog):** ventana `2026-08-17T13:46` → hoy — más atrás el reflog
ya no tiene datos: **eso no dice que antes no pasara, dice que ya no queda registro** (suelo, §6) ·
159 checkouts, 241 commits · **4 commits** hechos con HEAD, de verdad, en la rama de OTRO ticket.

## 3 · Los 4 de B, uno por uno — es la única evidencia que SÍ distingue algo

| fecha (hora local del commit) | rama en ese instante (reflog) | ticket del commit | qué pasó después |
|---|---|---|---|
| 2-sep 17:59 | `scrum-661-coste-unitario-congelado` (661) | SCRUM-674 | se queda ahí para siempre: SCRUM-674 tiene su propio `docs/master/SCRUM-674.md`, con **«Rama: `scrum-674-schema-cinco`»** — nunca se volvió a esa rama para este commit |
| 2-sep 18:02 | `scrum-661-…` (661) | SCRUM-674 | mismo par, misma sesión de trabajo |
| 5-sep 17:25 | `scrum-609-registro-del-alter-y-p-doc-8` (609) | SCRUM-610 | se queda ahí; `docs/master/SCRUM-610.md` NO declara una rama propia — es la misma sesión moviéndose de 609 a 610 sin cambiar de rama, no dos sesiones chocando |
| **23-sep 09:01 (hoy)** | `scrum-1086-lote-cobro-web-aplicado` (1086 — carril de J3, worktree `cobroflash-jv3`) | **SCRUM-1089** | **62 segundos después:** `checkout` a `scrum-1089-skill-verifactu-duplicada` + `cherry-pick` del MISMO commit (`30b354fc` → `f238ac2b`) sobre la rama correcta. Corregida a mano, no por ningún instrumento — es la MISMA forma que el incidente de J5 de hoy, en otro ticket, y no está contada en ningún traspaso ni en Jira |

El cuarto es nuevo: ocurrió en el arranque de esta propia rama (`scrum-1089-skill-verifactu-duplicada`,
la que traía este puesto antes de que se le asignara este encargo), en el mismo árbol compartido y
en la misma mañana que el de J5, y **nadie lo había reportado** hasta este censo. Con este, el
recuento de HOY sube a **2 aterrizajes conocidos**, no 1.

## 4 · Separación de causas — (a) árbol sucio vs (b) árbol limpio: NO SE PUEDE, y son dos motivos medidos

1. **SCRUM-774** (PR #1649, mergeada `4a6651a` el 22-sep-2026 09:41Z) sólo cubre `checkout -b` /
   `switch -c` **CON el árbol sucio**. `git checkout <rama-que-ya-existe>` sin crearla queda **fuera
   a propósito** — decisión explícita del fundador, citada en `docs/master/SCRUM-774.md` §2 — esté
   el árbol sucio o limpio. Los cuatro casos de la tabla de arriba son TODOS de esa segunda forma
   (cambiar a una rama que ya existía): nunca se han avisado, ni antes ni después de SCRUM-774.
2. **Git no registra si el árbol estaba sucio o limpio en un checkout pasado** — ni el reflog ni el
   log lo guardan, sólo la rama de origen, la de destino y la hora. Aunque el guard cubriera HOY el
   caso (b), no hay manera de reconstruir RETROACTIVAMENTE el estado del árbol en los tres casos
   antiguos de la tabla para decidir si habrían caído bajo (a) o (b) si hubieran ocurrido hoy.

**Conclusión de este punto: no se puede separar (a) de (b) sobre el historial que hay. Lo único que
distingue el caso de hoy de los tres antiguos no es la causa, es que alguien lo VIO y lo corrigió a
los 62 segundos** — y eso pasó porque una persona leyó el nombre de la rama en la salida de su
propio commit, exactamente como describe el incidente de J5, no porque ningún instrumento avisara.

## 5 · Por qué los 127 de A NO son, en su mayoría, esto — y cómo se comprobó, no se supuso

Agrupando A por rama (columna completa en `censo-merges.mjs --agrupado`, aquí el resumen): la
inmensa mayoría de las 57 ramas con commits ajenos NO son "un commit suelto que se coló", son
**carriles reutilizados durante semanas para varios tickets relacionados**, con muchos commits
propios al lado de los ajenos:

- `scrum-637-verificacion-s5`: 11 merges distintos entre el 9 y el 15-sep, 9 de 16 commits ajenos.
- `scrum-475-firma-del-webhook`: 3 merges, 9 de 12 ajenos. `scrum-547-microcopy-bloque-f`: 3 merges,
  7 de 8. `scrum-222-deriva-al-dia`: 4 merges, 6 de 6 (el 100 %).
- Un caso está auto-documentado y confirma el patrón: el commit `fc6d1844b9` (`SCRUM-864c:` en la
  rama de SCRUM-970) generó un registro propio, **`docs/master/SCRUM-864.md` §"SCRUM-864d"**, donde
  la propia sesión explica: es SU rama, SIN cambiar de sitio, con un commit cuyo contenido cae en el
  territorio de otro ticket por cómo lo clasifica el guard de SCRUM-854 (que exige un
  `docs/master/SCRUM-<n>.md` por cada ticket cuyo territorio toca un commit) — no un árbol que
  cambió de rama bajo nadie.
- Los dos casos de B del 2 y 5-sep (SCRUM-674 y SCRUM-610) encajan en el mismo molde: **674 SÍ tiene
  rama propia declarada** (`scrum-674-schema-cinco`, en su propio `docs/master/SCRUM-674.md`) pero
  su commit de esa fecha se hizo sin volver a ella — la misma sesión, en el mismo carril, sin
  cambiar de sitio. **610 nunca declaró rama propia.**

Es decir: el cribado léxico (nombre de rama ↔ ticket del mensaje) capta sobre todo un **estilo de
trabajo YA CONOCIDO y aceptado** (carriles de verificación/registro reutilizados, y el patrón que
SCRUM-854/864d ya resuelven con un registro), no aterrizajes por árbol compartido. De los 127, sólo
el de hoy (§3, la fila 4) tiene la forma exacta del incidente que abrió este ticket: corrección
inmediata por cherry-pick, sin registro cruzado posterior.

## 6 · SUELO — lo que este censo NO puede decir, y por qué un cero sería ceguera

- **Git registra QUÉ rama y CUÁNDO, nunca QUIÉN** (qué sesión, qué proceso). No se puede distinguir,
  ni en el caso de hoy ni en ninguno de los tres antiguos, si fue una sesión chocando con OTRA que
  tenía el árbol (como describe J5) o una misma sesión que encadenó un commit antes de cambiar de
  rama por su cuenta. Las dos formas dejan el MISMO rastro en `git log`/`reflog`.
- **Un aterrizaje cuyo commit menciona un ticket que "encaja" con el de la rama no deja NINGÚN
  rastro léxico.** El censo A y B sólo cazan un ajeno porque su MENSAJE lo delata (`SCRUM-<otro
  número>:`). Un commit sin ese prefijo, o que mencione (por casualidad o por redacción) el ticket
  de la rama en la que aterrizó por error, es invisible a los dos censos — es la misma ceguera que
  el propio `enlace-ticket-rama.mjs` declara para el caso SCRUM-706 ("su trabajo real no tiene
  ticket propio"): un discriminador de contenido no existe todavía.
- **B sólo ve ESTE árbol compartido** (`cobroflash-backend`), y sólo desde el 17-ago-2026: lo que
  pasó en cualquiera de los ~60 worktrees dedicados que hay hoy (`git worktree list`, cada uno con
  su propio reflog de HEAD, no compartido) o antes de esa fecha en éste, **no está medido, no está
  descartado**. Ningún merge del censo A anterior a esa fecha se pudo contrastar con un reflog real.
- Ni siquiera con el guard de SCRUM-774 puesto (que además no cubre el caso (b), §4) se podría
  reconstruir HOY si un aterrizaje viejo fue con árbol sucio o limpio: ese dato nunca se guardó.

**Por eso el número de este censo es un SUELO, no una cifra final: al menos 2 aterrizajes conocidos
hoy mismo (J5 + el de §3), y al menos 3 más antiguos con la misma forma léxica (674 ×2, 610) que NO
se pueden clasificar como colisión de árbol o como reutilización deliberada de carril con la
certeza de un instrumento — sólo con el peso de lo que cada caso, revisado a mano, sugiere.** Decir
"127" o "4" como si fueran el recuento real de colisiones sería el error que este ticket pide evitar:
un cero — o una cifra con más decimales de los que el método sostiene — que se lee como respuesta
sin serlo.

## 7 · Lo que esta tanda NO ha hecho, a propósito

- ⛔ No se ha tocado `.claude/hooks/guard-dangerous.mjs` — es de SCRUM-1091 (S5); el punto 1 de
  SCRUM-1092 (si el lanzador puede dar un árbol POR SESIÓN) sigue sin contestar, y endurecer un
  guard sobre una práctica sin arreglar sale más caro que dejarlo para cuando se conteste.
- ⛔ No se ha tocado `scripts/equipo/sesion.mjs` — es compartido por los dos equipos.
- ⛔ No se ha escrito ningún guard ni instrumento nuevo en `tests/` ni en `package.json`: los dos
  censos son evidencia de una sola tanda, no vigilancia continua — esa decisión es de quien la pida,
  con su propio criterio de qué hacer con un aterrizaje detectado.
- ⛔ Cero ficheros de `src/`.

## 8 · Ficheros

- `docs/master/evidencias/scrum1092/censo-merges.mjs` — censo A, todo el historial.
- `docs/master/evidencias/scrum1092/censo-reflog.mjs` — censo B, sólo el árbol compartido
  `cobroflash-backend` (ejecutar DESDE ahí: usa el reflog de ESE checkout, no el de un worktree).
