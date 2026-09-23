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

# APÉNDICE — Los tres aterrizajes antiguos (674 ×2, 610): ¿se perdió su contenido o llegó por otra vía?

**Fecha:** 23-sep-2026 09:57Z (GitHub) · **Carril:** J6 · calidad y seguridad
**Medido contra:** `origin/main` = `a457077f4d73bb0d3923f98916ddf03ffbd2fb13` · 2026-09-23T09:57:14Z
**Rama:** `scrum-1092-cuantas-veces-ha-pasado`

## 9 · El encargo, en una línea

De los tres commits de §3 que se quedaron para siempre en rama ajena (no el de hoy, que ya se
corrigió), decir por CONTENIDO — no por SHA ni por número de ticket — si lo que introducían está
hoy en `main`, y clasificar cada uno: (a) llegó igual · (b) llegó reescrito · (c) se perdió.

## 10 · Método

Para cada commit: `git merge-base --is-ancestor <sha> origin/main` (¿el commit exacto es
antepasado de main?) y, si no lo es, buscar su contenido por TEXTO/función en `origin/main` de hoy
— no por si existe un fichero con el mismo nombre.

## 11 · SCRUM-610 (`88f5da6c`, 5-sep 17:25) → **(a) llegó igual**

`git merge-base --is-ancestor 88f5da6c origin/main` → **SÍ es antepasado**. El commit, con su SHA
original intacto, vive hoy dentro de `origin/main`.

Cómo: la rama donde aterrizó por error (`scrum-609-registro-del-alter-y-p-doc-8`) **todavía no se
había mergeado** cuando el commit se le añadió (17:25) — se mergeó 29 minutos después, a las
17:54:17+01:00, con el PR #1069 (`c5bd379f`, `git log --oneline origin/main --grep=SCRUM-610`
lo confirma como ancestro directo). El commit viajó dentro de esa rama sin que nadie lo separara.
Por eso la rama ya no existe (`git ls-remote --heads origin scrum-609-registro-del-alter-y-p-doc-8`
→ vacío: el bot la borró al mergear, como con cualquier PR mergeado).

Contenido verificado hoy: `origin/main:docs/master/SCRUM-610.md` líneas 124-152 trae, palabra por
palabra, la «NOTA DE CADUCIDAD» que añadió ese commit (título, cita a `2e3e7685`, el bloque de
código con `costeUnitario`, y el párrafo «P6 sigue SIN FIRMAR»). Nada perdido, nada reescrito.

## 12 · SCRUM-674 (`6093240a` + `d6f5cb53`, 2-sep 17:59 y 18:02) → **(b) llegó reescrito**

Ninguno de los dos es antepasado de `origin/main` (confirmado con `merge-base --is-ancestor`,
también repetido tras un segundo `fetch` con `main` ya movido a `a457077f`: mismo resultado).

**Por qué éste NO viajó como el de 610:** la rama donde aterrizaron
(`scrum-661-coste-unitario-congelado`) YA se había mergeado — PR #929, `9f3d4b26`, a las
17:44:38+01:00 — **antes** de que el primero de los dos (17:59) se le añadiera. El tren ya se había
ido: esa rama no iba a volver a mergearse, así que los dos commits quedaron varados. La rama
**sigue existiendo hoy** en `origin` (`git ls-remote --heads origin
scrum-661-coste-unitario-congelado` → apunta a `d6f5cb53`, sin borrar, porque nunca se volvió a
mergear).

**Pero el TRABAJO no se perdió — se rehizo, sin saberlo, unas horas después:**

- El commit `96e36cb8` («SCRUM-674 (parte A) + SCRUM-685: el SQL aditivo…»), Sep 2 20:35:32+02:00
  (18:35Z — **posterior** a los dos huérfanos), añadió `docs/sql/scrum-674-aditivo.sql`. Diff
  línea por línea de las sentencias reales (sin comentarios) contra el DDL del huérfano
  `d6f5cb53:docs/sql/scrum-674-deriva-produccion.sql`: **las mismas 5 `ALTER TABLE` + el mismo
  `CREATE TABLE partes_trabajo` con sus 24 columnas + los mismos 2 `CREATE INDEX`**, sólo
  reordenados y realineados. Mismas columnas, mismos tipos (JSONB en `clausulas_presupuesto` y
  `clausulas_excluidas`, `revision INTEGER NOT NULL DEFAULT 0`), mismo veredicto aditivo.
  `96e36cb8` llegó a `main` por el PR #967 (`1f038152`, 3-sep 12:30:30+02:00). Nadie citó el
  commit huérfano al escribirlo (`grep` de `6093240a`/`d6f5cb53`/`coste-unitario-congelado` en
  `docs/master/SCRUM-674.md` → cero coincidencias): es una re-medición independiente que llegó a
  la misma DDL, no una recuperación consciente.
- La consulta de verificación manual que añadía `6093240a`
  (`verificacion-scrum-674.sql`, con sus controles `control_quotes_id`, `tipos_correctos`, etc.)
  **NO se encuentra hoy en `main` bajo ningún nombre** (`git grep` de sus fingerprints únicos
  — `tipos_correctos`, `control_quotes_id` — en todo `origin/main` sólo casa con un fichero de
  OTRO ticket, SCRUM-579, por casualidad de nomenclatura). Lo que SÍ cumple su misma función hoy
  es la sección propia `## Verificación, SIN tocar ninguna base` de
  `docs/master/SCRUM-674.md` (con su propio control positivo: «la conexión ve 385 columnas»),
  apoyada en `docs/sql/deriva-prod.sql` (censo genérico regenerado por
  `scripts/generar-sql-deriva.mjs`, no la consulta manual del huérfano). Mismo objetivo — saber
  si las seis cosas ya están — mecanismo distinto: por eso el veredicto de estos dos commits es
  **reescrito**, no **igual**.

## 13 · Conclusión — SIN víctima

**De los tres, ninguno es (c).** Nada de lo que introducían estos tres commits huérfanos falta hoy
en `main`: 610 llegó con su propio SHA (a), y las dos entradas de 674 llegaron con el mismo DDL
bajo otro nombre y otra sesión de medición, horas después (b). El mecanismo que SCRUM-1092 vino a
medir sigue siendo un riesgo de PROCESO real —hoy volvió a disparar dos veces (§3)—, pero **no
tiene, por ahora, ninguna víctima con nombre**: no hace falta recuperar nada de `main` de hoy.

# APÉNDICE — Punto 1: ¿puede el lanzador dar un árbol POR SESIÓN?

**Fecha:** 23-sep-2026 10:09Z (GitHub) · **Carril:** J6 · calidad y seguridad
**Medido contra:** `origin/main` = `13e967cde072faacf8abb4c3d15019a25ad9b721` · 2026-09-23T10:09:13Z
**Rama:** `scrum-1092-lanzador-cwd-por-sesion`

> ⛔ `scripts/equipo/sesion.mjs` se LEYÓ, no se tocó. No se ha tocado
> `.claude/hooks/guard-dangerous.mjs` (SCRUM-1091, S5). No se ha escrito ningún guard nuevo.
> `src/` intacto.

## 14 · Cómo fija el `cwd` HOY el lanzador — leído, no supuesto

**No lo fija. No existe ningún campo de `cwd` en su diseño.** `argsLanzar()` (`sesion.mjs:140`)
construye los argumentos de `claude` — `['--bg', '-n', nombre, '--permission-mode', 'auto',
'--model', MODELO_DEL_EQUIPO, prompt]` — y ni ahí ni en `claude()` (`sesion.mjs:619`, el
`spawnSync` que de verdad arranca el proceso) hay una opción `cwd`. Node, sin esa opción, hereda el
`process.cwd()` de quien invoca `sesion.mjs` en ESE instante. Ningún `chdir` en todo el fichero
(`grep -c chdir sesion.mjs` → 0). `config.repo` existe (`config.json`) pero SÓLO se usa para
comparar contra `origin/main` en la puerta de integridad (`sesion.mjs:595`) y para
`equipoVivo()` (`sesion.mjs:239`) — nunca se pasa como `cwd` al lanzar.

**Consecuencia medida, no supuesta:** el árbol en el que nace una sesión nueva es, siempre, el
directorio en el que el ORQUESTADOR (quien ejecuta `node sesion.mjs lanzar/relevar`) tenía puesto
su propio shell en ese momento. Que hoy las seis nazcan en árboles distintos depende enteramente
de que el orquestador se acuerde de `cd` a un worktree propio ANTES de cada `lanzar` — es la
"costumbre" que dice el encargo, y el fichero no la exige ni la registra en ningún sitio.

## 15 · ¿CREAR o EXIGIR? Las dos son mecánicamente viables — y no resuelven lo mismo

**CREAR** (aprovisionar un worktree nuevo antes de lanzar, y pasarlo como `cwd`): el fichero ya
tiene las dos piezas que hacen falta. `gitReal(cwd, args)` (`sesion.mjs:606`) ya envuelve `git -C
<cwd> …`, así que un `git worktree add <ruta> origin/main` encaja en el mismo patrón; y
`spawnSync` (usado en `claude()`) acepta una opción `cwd` que hoy simplemente no se pasa. Es
trabajo NUEVO (decidir la ruta por puesto, si se reusa una ya existente de una tanda anterior,
quién la borra al cerrar el puesto) pero no hay ningún obstáculo estructural: ⚠️ decisiones de
diseño que no tomo yo aquí — no toco `sesion.mjs`.

**EXIGIR** (negarse a lanzar si el `cwd` donde nacería la sesión ya está ocupado por OTRA sesión
viva): es MÁS barato que crear, y usa un dato que el fichero YA LEE. `equipoVivo()`
(`sesion.mjs:239`) ya recorre `claude agents --json`, que trae el `cwd` REAL de cada agente vivo
(`a.cwd`), y ya sabe filtrar por raíz de repo y por "vivo, no resto muerto"
(`clasificarAgente`, `sesion.mjs:181`). Extender `decidirLanzar`/`decidirRelevar` para negarse si
`process.cwd()` (el `cwd` que heredaría la sesión nueva) coincide con el `cwd` de un agente vivo
de OTRO `nombre` es una comprobación de LECTURA sobre datos que el lanzador ya trae — cero
aprovisionamiento, cero coste de `npm ci`.

**No son alternativas — resuelven momentos distintos, y por eso NO descarto ninguna:**
EXIGIR sólo actúa en el INSTANTE del `lanzar`/`relevar`. No puede impedir que una sesión YA VIVA,
a mitad de su propio turno, haga `git checkout <rama-ajena>` dentro de SU árbol compartido — eso
ya no es un evento de lanzamiento, es un evento de la sesión en marcha, y es exactamente el hueco
que cubre (para árbol sucio) SCRUM-774 y que el punto 4 de este encargo pide extender (árbol
limpio). CREAR es la única de las dos que ataca la CAUSA en la raíz: si cada sesión nace ya en su
propio árbol, un `checkout` posterior dentro de ESE árbol nunca puede chocar con el de otra sesión,
porque son directorios distintos — no hace falta ni el guard de SCRUM-774 ni ninguna extensión suya.

## 16 · El coste de `npm ci` — MEDIDO, no estimado, y NO es el bloqueo que se temía

Worktree nuevo, genuinamente sin `node_modules` (`git worktree add <ruta> origin/main`, confirmado
`ls node_modules` → no existe antes de medir):

    2026-09-23T10:05:33Z → npm ci --no-audit --no-fund → "added 400 packages in 16s"
    real 0m16.121s · 2026-09-23T10:05:49Z

**16 segundos, no "varios minutos".** `node_modules` resultante: **414-451 MB** (medido dos
veces, `Get-ChildItem -Recurse` y `du -sh`, con esa diferencia entre las dos herramientas). Espacio
libre en disco: **287 GB de 931 GB** — seis worktrees más (~2,5 GB) son el 0,3 % del disco. Ninguno
de los dos costes —tiempo, disco— hace inviable la opción CREAR en ESTA máquina.

⚠️ **Por qué sale tan rápido, para que el número no se lea fuera de contexto:** la caché LOCAL de
npm (`%LocalAppData%\npm-cache`) está **caliente y es COMPARTIDA por los ~60 worktrees que ya
existen en esta máquina** — medida en **1,7 GB**. `npm ci` no baja paquetes de la red: los sirve de
esa caché. Es el número correcto para "¿cuánto cuesta crear un worktree MÁS en esta máquina, hoy?"
— que es la pregunta del encargo — pero NO generaliza a una máquina nueva sin esa caché (un runner
de CI, por ejemplo), donde `npm ci` sí bajaría los 400 paquetes de la red.

*(Medición hecha en un worktree de usar y tirar, `git worktree add` + `git worktree remove`
—nunca `EnterWorktree`—, retirado al terminar de medir; no queda en `git worktree list`.)*

## 17 · La pregunta del punto 4 — sí se propone, pero como COMPLEMENTO, no como sustituto

El encargo pide proponer el síntoma "sólo si se descarta la opción 1". **No la descarto** (§15-16):
crear es viable y barato en esta máquina. Pero §15 ya dijo por qué EXIGIR/CREAR y el aviso de
SCRUM-774 no compiten por el mismo hueco — cubren instantes distintos del ciclo de vida de una
sesión — así que la propuesta tiene sentido aunque la primera no se descarte:

**Extender el aviso de SCRUM-774 al caso "árbol LIMPIO con otra sesión viva encima"** (hoy sólo
avisa con árbol sucio, decisión explícita del fundador citada en `docs/master/SCRUM-774.md` §2) es
tratar el SÍNTOMA: detecta el choque en el momento en que una sesión hace `checkout` a una rama que
ya ocupa OTRA sesión viva, pero no impide que dos sesiones sigan arrancando por defecto en el mismo
árbol. **Es un parche sobre la costumbre, no una cura de la causa** — la causa (§14: ningún `cwd`
por sesión) sólo la cierra CREAR. Con CREAR en marcha, esta extensión de SCRUM-774 seguiría
teniendo valor como segunda red: cubre el caso de una sesión que, aun teniendo su propio árbol, se
mueve por error al árbol de otra a mano.

## 18 · Por qué `sesion.mjs contexto` responde `DESDE-UN-ARBOL` — mismo principio, mecanismo DISTINTO

`puertaDeIntegridad()` (`sesion.mjs:573`) exige que el PROPIO fichero `sesion.mjs` que se está
ejecutando NO esté dentro de ningún árbol de git (`git rev-parse --is-inside-work-tree` sobre su
propio directorio). Es AL REVÉS de lo que este punto pregunta: no es que la sesión NUEVA nazca sin
árbol propio, es que sólo la COPIA INSTALADA (fuera de cualquier worktree, sólo la rellena el
instalador desde `origin/main`) puede actuar — para que nadie pueda alterar el lanzador editando una
rama y lanzando desde ahí (línea 53-56 del propio fichero lo declara: protege de una copia
desfasada o tocada por accidente, no de una reescritura deliberada). Por eso CUALQUIER copia de
`sesion.mjs` que yo ejecute desde dentro de este repo —`main` o cualquier worktree— cae en
`DESDE-UN-ARBOL`: es el diseño funcionando como declara, no un error. **Es el mismo PRINCIPIO** que
§14-15 (desconfiar de qué árbol trae cada actor) **pero un mecanismo distinto**: éste protege la
INTEGRIDAD del propio lanzador; §14-15 habla de qué árbol hereda la sesión que el lanzador arranca.
No son la misma pregunta y no comparten arreglo.
