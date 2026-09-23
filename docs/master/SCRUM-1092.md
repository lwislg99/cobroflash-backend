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

# APÉNDICE — Punto 1, profundizado: POR QUÉ no arranca (ejercitado, no deducido)

**Fecha:** 23-sep-2026 10:53Z (GitHub) · **Carril:** J6 · calidad y seguridad
**Medido contra:** `origin/main` = `d8d724e1f3f41d1ce50b785cbfb275b76bd7b729` · 2026-09-23T10:53:01Z
**Rama:** `scrum-1092-lanzador-cwd-por-sesion` (continúa el PR #1713, no abre uno nuevo: es la misma
pregunta de §14-18, un nivel más abajo)

> ⛔ `scripts/equipo/sesion.mjs` se LEYÓ, no se tocó. `.claude/hooks/guard-dangerous.mjs` (SCRUM-1091,
> S5) ni se miró. No se ha escrito ningún guard nuevo. `src/` intacto.

## 19 · El síntoma, reproducido con control: se registra, nunca tiene `pid`

Lancé de verdad —no leí, no deduje— un `claude --bg` desde dentro de `cobroflash-jv-j6` (el worktree
que dejó la sesión anterior, HEAD desatado, con `node_modules` ya instalado):

    cd cobroflash-jv-j6 && claude --bg -n j6-test-detached --permission-mode auto \
      --model claude-sonnet-5 "Responde unicamente con OK y termina."
    → backgrounded · 24072c88 · j6-test-detached

`claude agents --json` para `24072c88`: **sin `pid`**, igual que midió la sesión anterior. Pero el
`state.json` del job (`~/.claude/jobs/24072c88/state.json`) SÍ dice por qué, con una frase, no un
silencio:

    "state": "blocked",
    "detail": "1 new MCP server needs approval",
    "needs": "approve 1 new project MCP server (playwright) — attach to respond"

**No es un fallo mudo. Es un `state` legible que nadie había leído todavía** — la sesión anterior
mitió el `pid` (correcto, es el tell de SCRUM-954) pero no llegó a abrir `state.json`, que es donde
vive la razón.

## 20 · Por qué ese MCP concreto, y por qué sólo en un árbol NUEVO

`origin/main:.mcp.json` declara un único servidor de proyecto:

    { "mcpServers": { "playwright": { "command": "npx", "args": ["-y", "@playwright/mcp@latest"] } } }

Claude Code exige aprobación humana la PRIMERA vez que un `.mcp.json` de proyecto declara un
servidor para una ruta absoluta dada — lo guarda en `~/.claude.json` → `projects["<ruta>"]`. Grep de
ese fichero (30.843 tokens; **NO se lee entero — lección propia: mi primer intento sí lo leyó entero
y costó ~31k tokens de más, ver §23**) por `jv-j6` y `jv-j2`: **cero coincidencias**. Los worktrees de
prueba nunca habían tenido una entrada — son rutas genuinamente nuevas para Claude Code, no sólo para
git. Los cinco árboles con entrada en `projects` (`cobroflash-backend`, `-b1`…`-b5`) sí la tienen,
con `hasTrustDialogAccepted`.

`claude --help` confirma que el diálogo de CONFIANZA (trust) se salta en modo no interactivo
(`--bg`/`-p`) — y en efecto no bloqueó nada. **La aprobación de un servidor MCP de proyecto es una
puerta DISTINTA, y ésa no se salta.** En `--bg` nadie puede contestarla (`attach to respond` — hace
falta un terminal), así que el job se queda `blocked` para siempre: se registra (tiene `id`,
`state.json`), pero el proceso de trabajo real nunca arranca (`pid` nunca aparece).

## 21 · ¿Es el worktree, o es el `--detach`? Aislado con dos pruebas — NINGUNO de los dos

- **Detached, sin `--strict-mcp-config`** (`cobroflash-jv-j6`, HEAD suelto): bloqueado (§19, job
  `24072c88`).
- **Rama PROPIA, sin `--strict-mcp-config`** (worktree nuevo creado con
  `git worktree add <ruta> -b jv-j6-test-branch-scratch origin/main`, nunca `EnterWorktree`): **el
  mismo bloqueo, palabra por palabra** —

      "state": "blocked", "detail": "1 new MCP server needs approval",
      "needs": "approve 1 new project MCP server (playwright) — attach to respond"

  (job `299277e1`, `cwd` = la rama nueva). Limpiado después: `claude stop 299277e1`,
  `git worktree remove` (sin `--force`; con `--force` el hook `guard-dangerous` lo bloqueó, correcto:
  pedía mi OK, no el del fundador, y no insistí) y `git branch -D jv-j6-test-branch-scratch`. Queda
  huérfana en disco (no en `git worktree list`) `C:/Users/Javier Pereira/cobroflash-jv-j6-branch-test`
  — un fichero se quedó bloqueado (probablemente el `.jsonl` de la sesión recién parada) y
  `git worktree remove` sin `--force` dio *Permission denied*; lo declaro en vez de forzarlo.

**La variable que decide es la RUTA absoluta y si ya tiene entrada en `~/.claude.json`, no si el
`HEAD` está suelto o en una rama.** `--detach` era una pista falsa — coincidía con el primer worktree
que se probó, no con la causa.

## 22 · SÍ hay una forma de que arranque en su propio árbol — medida de principio a fin, con un coste real

    cd cobroflash-jv-j6 && claude --bg -n j6-test-strict --permission-mode auto \
      --model claude-sonnet-5 --strict-mcp-config "Responde unicamente con OK y termina."
    → backgrounded · fe97428a

`claude agents --json` a los pocos segundos: **`"pid": 25324, "status": "busy"`**. El job terminó
solo, sin que nadie lo tocara:

    "state": "done", "detail": "responded as requested", "output": { "result": "OK" }

**`--strict-mcp-config` ("Only use MCP servers from --mcp-config, ignoring all other MCP
configurations") evita la puerta de §20 por completo: si no hay ningún servidor de proyecto que
aprobar, no hay nada que bloquee.** Confirmado también en el worktree de rama propia (no sólo el
desatado): con el flag, arranca igual.

**Pero tiene un coste que medí, no que supuse — y es serio para este equipo:** lancé un tercer job,
mismo flag, pidiéndole *sólo* que dijera si veía alguna herramienta MCP de Jira/Atlassian (sin
llamarla, sin escribir nada):

    "output": { "result": "NO — no Jira/Atlassian MCP tools available" }

Control: mi PROPIA sesión, arrancada desde el árbol compartido ya confiado y SIN
`--strict-mcp-config`, sí tiene `mcp__claude_ai_Atlassian_Rovo__*` disponible (los mismos que uso
para comentar tickets). **`--strict-mcp-config` no sólo quita `playwright`: quita también el
conector de cuenta de claude.ai (Atlassian Rovo, Claude Docs) que las seis sesiones usan para Jira**
(`claudeAiMcpEverConnected` en `~/.claude.json` — es un conector de CUENTA, no algo que declare
`.mcp.json`, y aun así el flag lo apaga). Aplicar `--strict-mcp-config` sin más en el lanzador
arreglaría el arranque y rompería en silencio el único canal por el que cada puesto cierra su parte
del ciclo de A13. No es una solución gratis: es cambiar un bloqueo visible por uno invisible.

## 23 · Lo que no medí, y por qué — suelo declarado, no una causa plausible sin comprobar

No probé la vía que parece más limpia sobre el papel: pre-aprobar `playwright` para la ruta nueva
ANTES de lanzar (escribir en `~/.claude.json` → `projects["<ruta>"].enabledMcpjsonServers =
["playwright"]`, imitando la entrada que ya tienen `cobroflash-backend`/`-b1`…`-b5`), que en teoría
evitaría el bloqueo del §19 SIN perder el conector de Jira del §22. **No lo hice porque
`~/.claude.json` es un fichero de 1.807 líneas que las seis sesiones vivas de esta máquina —además de
la mía— están leyendo y escribiendo AHORA MISMO** (`lastCost`, `lastGracefulShutdown`… se actualizan
por sesión, en caliente): escribirlo yo a mano, desde fuera del propio Claude Code, es tocar estado
compartido en producción sin el control atómico que tiene el proceso que normalmente lo escribe —
justo el tipo de acción que se para y se declara en vez de ejecutar. Si esto se implementa, lo hace
el propio lanzador (o `claude mcp add --scope project`, que sí pasa por el camino oficial) dentro de
`sesion.mjs`, que es territorio compartido con el otro equipo y que este encargo me pidió no tocar.

Error propio, para la bitácora: mi primer intento de mirar `~/.claude.json` lo leí ENTERO (offset/limit
por defecto) antes de darme cuenta de que pesaba 30.843 tokens — contra la norma de arranque barato
(§4 del prompt de relevo). A partir de ahí usé `Grep` para todo lo demás en ese fichero.

## 24 · Respuesta a los cuatro puntos del encargo, en una tabla

| punto | respuesta | evidencia |
|---|---|---|
| 1. ¿Por qué no arranca? | Aprobación de servidor MCP de PROYECTO (`playwright`, de `.mcp.json`) pendiente para una ruta que `~/.claude.json` no ha visto nunca; en `--bg` nadie puede contestarla y el job se queda `blocked` sin `pid` para siempre. | §19-20, job `24072c88` |
| 2. ¿Worktree o `--detach`? | Ninguno de los dos. Mismo bloqueo, palabra por palabra, en un worktree con rama PROPIA. | §21, job `299277e1` |
| 3. ¿Hay forma de que SÍ arranque en su árbol? | Sí: `--strict-mcp-config`, medido de principio a fin (`pid` real, `state: done`, salida correcta). Pero apaga también el conector de Jira/Atlassian que usan las seis sesiones — no es gratis. | §22, jobs `fe97428a`, `4d1da327` |
| 4. Si no se puede ver, declararlo | No aplica: SÍ se pudo ver — `state.json` lo dice literalmente. Lo que sí queda sin medir es la vía de pre-aprobación por fichero (§23), declarada y no ejecutada por tocar estado compartido en caliente. | §23 |

**Para SCRUM-1092 punto 1: EXIGIR (que el lanzador se niegue si el `cwd` ya lo ocupa otra sesión
viva, §15) sigue siendo la propuesta más segura — no depende de resolver esta puerta de MCP. CREAR
(que el lanzador dé un árbol nuevo por sesión) es viable en coste (§16) pero, si además quiere
arrancar SIN tocar `~/.claude.json` a mano, necesita decidir entre `--strict-mcp-config` (pierde
Jira) o una pre-aprobación por el camino oficial (§23, sin medir) — esa decisión de diseño le toca a
quien implemente dentro de `sesion.mjs`, coordinado entre los dos equipos.**

## 25 · Encargo nuevo (23-sep, tarde) · Por qué cayeron las SEIS a la vez — NO es MCP

**Fecha:** 23-sep-2026 16:06Z (GitHub) · **Carril:** J6 · calidad y seguridad
**Medido contra:** `origin/main` = `b2df30887f1a1e1cff193b748d6beb0ef499e9e9` · 2026-09-23T16:06:21Z
**Rama:** `scrum-1092h-por-que-cayeron-las-seis`, en un `git worktree add` propio (nunca la
herramienta `EnterWorktree`, prohibida en el encargo): el árbol compartido tenía cambios sin
commitear de otra sesión y `guard-dangerous` lo bloqueó correctamente al primer intento — se midió
sólo en lectura ahí y se escribió aquí.

> ⛔ `src/`, `scripts/equipo/sesion.mjs`, `.mcp.json` y `~/.claude.json` — SOLO LECTURA. Ningún
> guard nuevo.

### 25.1 · La hipótesis de §19-24 (MCP de proyecto) NO aplica aquí, y se descarta con evidencia

El encargo la daba por dudosa porque las seis arrancaron en el árbol de siempre, ya aprobado, y
trabajaron horas. Confirmado: los `state.json` de las seis sesiones de HOY ya no existen en
`~/.claude/jobs/` (`sesion.mjs parar` hace `claude stop <id>` + `claude rm <id>`, y eso borra el
directorio — es lo que hizo el orquestador al relanzar antes de este encargo). Pero la evidencia
sobrevive en otro sitio que el encargo no pedía mirar y que sí tiene los datos: los transcripts
`.jsonl` en `~/.claude/projects/C--Users-Javier-Pereira-cobroflash-backend/`, que `claude rm` no
toca. Ahí está la causa, con hora y texto literal.

### 25.2 · El texto exacto, en TRES sesiones distintas, con menos de 7 minutos de diferencia

Grep de `"session limit"` sobre todos los `.jsonl` de hoy. Tres sesiones —de seis— alcanzaron a
escribirlo como mensaje del asistente, palabra por palabra igual en las tres:

    You've hit your session limit · resets 1:40pm (Europe/London)

| puesto | fichero (session id) | primera vez que lo dice |
|---|---|---|
| J2 | `07a2d7a6-e407-4314-a286-cdb03133e1d5.jsonl` | 2026-09-23T11:14:36.502Z |
| J5 | `c35ca612-4765-4de6-8df9-fe2358c3c2f2.jsonl` | 2026-09-23T11:14:37.486Z |
| J1 | `198927f9-dbd7-4216-9edb-1aa473288f57.jsonl` | 2026-09-23T11:21:54.198Z (tras varios "Sigo esperando" desde 11:14) |

J2 y J5 lo dicen con **1 segundo** de diferencia. No es un permiso de MCP: es el **límite de uso de
la CUENTA** de Claude Code (una ventana de sesión compartida, no por-sesión), agotado por las seis
sesiones de fondo consumiendo el mismo presupuesto a la vez. `1:40pm (Europe/London)` = **12:40Z**
(BST = UTC+1 el 23-sep).

### 25.3 · Confirmado también del lado del lanzador, no sólo del transcript

`claude agents --json` AHORA MISMO, para la sesión bloqueada que sigue viva desde ayer
(`34714ba0`, jv-j3 — un bloqueo VIEJO y de otro tipo, ver §25.5):

    {"id":"34714ba0","name":"jv-j3","state":"blocked"}

**No hay campo `waitingFor` en absoluto.** En `scripts/equipo/sesion.mjs` líneas 279-280, 462-463 y
555: `v.waitingFor || 'algo interactivo'` — **«algo interactivo» es un texto de RELLENO que pone el
propio lanzador cuando el campo viene vacío, no algo que diga Claude Code.** El CLI no reporta
ningún permiso pendiente: reporta `blocked` a secas. La sospecha de "un permiso que nadie puede
contestar" no es literal — no hay ningún permiso en el JSON; hay una cuenta sin cupo y un texto de
relleno que lo disfraza de aprobación interactiva.

### 25.4 · Dos familias, y por qué — pregunta 2 y 3 del encargo, juntas

Censo de las SEIS últimas sesiones antes del relanzamiento (`last-prompt` de cada `.jsonl` da el
puesto; `firstTs`/`lastTs` son las marcas de tiempo del propio transcript, no el mtime del fichero
— el mtime miente aquí, ver nota):

| puesto | último transcript antes del relanzamiento | qué hacía | cómo termina |
|---|---|---|---|
| J1 | `198927f9` (10:43–11:21Z) | trabajando en SCRUM-1051/#1715 | **Familia A** — a mitad de turno, escribe el aviso y reintenta ("Sigo esperando") hasta las 11:21, luego nada |
| J2 | `07a2d7a6` (10:57–11:14Z) | — | **Familia A** — mismo patrón, aviso a las 11:14:36 |
| J5 | `c35ca612` (10:44–11:14Z) | — | **Familia A** — aviso a las 11:14:37 |
| J3 | `5a93a388` (10:57–11:04Z) | acababa de entregar SCRUM-1025/1029 al orquestador | **Familia B** — cierra limpio a las 11:04:15, nunca vuelve a escribir nada |
| J4 | `0798b6d7` (10:43–11:10Z) | acababa de cerrar SCRUM-1094 #5/#6 | **Familia B** — cierra limpio a las 11:10:18, nunca vuelve a escribir nada |
| J6 (predecesora) | `13e2e0f5` (11:00–11:12Z) | acababa de entregar el censo de PR #1724 | **Familia B** — cierra limpio a las 11:12:00, nunca vuelve a escribir nada |

**Familia A (bloqueadas, "sin pid" del encargo) = pilladas A MITAD DE TURNO** cuando se agotó la
cuota: alcanzan a escribir el aviso y quedan reintentando sin avanzar — eso es lo que el lanzador ve
como `blocked` sin `waitingFor`.
**Familia B (muertas, NO-VIVA) = ENTRE turnos**: acababan de entregar y esperaban el siguiente
encargo del orquestador. Cuando la cuenta se quedó sin cupo, el daemon no les dio ni un turno más
para escribir nada — de ahí que el lanzador las vea sin rastro, no bloqueadas con mensaje.

**El disparador (pregunta 3) no es una herramienta concreta**: es el **reloj de la cuota de la
cuenta**, agotada por las SEIS sesiones de fondo compartiendo el mismo presupuesto simultáneamente
— no una llamada de una sesión en particular. Ninguna de las tres transcripciones de la Familia A
muestra una llamada a herramienta justo antes del aviso; el aviso sustituye al turno entero.

**Nota sobre el mtime:** los ficheros `.jsonl` de las tres de la Familia A tienen mtime ~16:54-17:00
(hora en que el orquestador las paró), pero su ÚLTIMO contenido con marca de tiempo real es
~11:14-11:22Z. El mtime del fichero no es la hora del suceso; la marca de tiempo DENTRO del JSON sí
lo es. Medido comparando ambas en los tres casos.

### 25.5 · Lo que NO es esta causa — el bloqueo viejo de jv-j3 es OTRA cosa, y no se confunden

`34714ba0` (jv-j3, blocked desde 22-sep 23:39Z, sigue vivo en el lanzador ahora) tiene
`detail: "SCRUM-537: subtitle guard blocking; awaiting next decision"` y `needs: "decide: fix
subtitle guard or escalate to orquestador"` — un bloqueo de DECISIÓN (un guard cayó, la sesión paró
y pidió al orquestador, correctamente, regla 41) de **ayer**, no relacionado con el límite de cuenta
de hoy. Se nombra aquí solo para no agruparlo por parecido superficial ("blocked" + "sin pid") con
la causa de §25.2-25.4: son dos familias de bloqueo DISTINTAS del propio lanzador, y ésta ya estaba
diagnosticada antes de este encargo.

### 25.6 · El hueco de 11:14Z a 15:57Z — SUELO declarado, no una causa que no comprobé

El aviso decía que el cupo se restaura a las **12:40Z**. El relanzamiento (las seis, `estado` nuevo)
ocurrió a las **~15:57Z** — casi **3h17min DESPUÉS** de la restauración anunciada. Esto importa para
la pregunta 4 (prevención): **esperar el reloj no basta por sí solo** para que una sesión ya atascada
en el bucle de reintento se recupere sola — necesita que alguien la pare y la relance (lo que hizo el
orquestador).

**Medido, no supuesto:** el transcript del propio orquestador (`a11e92b8-…jsonl`, la sesión más
grande del directorio, sigue viva) **no tiene NINGUNA línea con marca de tiempo entre las
11:14:00Z y las 15:40:29Z** — 4h26min sin actividad, incluida la tanda programada de las 13:30 de
`config.json`. Su primera línea después del hueco es a las 15:40:29Z, y lanza las seis sesiones
nuevas a las ~15:57Z. **No puedo saber, con lo que hay, si el orquestador estuvo parado por el mismo
límite de cuenta compartido, si esperaba a Javier, o si simplemente no había tanda programada hasta
las 13:30 y ésa tampoco produjo nada visible** — el transcript no dice POR QUÉ no escribió nada en
4h26min, solo que no lo hizo. Declarado como suelo: no es una causa plausible sin comprobar, es lo
que no se puede saber con la evidencia disponible.

### 25.7 · Respuesta a las cuatro preguntas del encargo

| pregunta | respuesta | evidencia |
|---|---|---|
| 1. ¿Qué permiso exacto esperan? | Ninguno. No es un permiso: es el **límite de uso de la cuenta** («You've hit your session limit · resets 1:40pm (Europe/London)» = 12:40Z), y el CLI no reporta ningún `waitingFor` — «algo interactivo» es relleno del propio `sesion.mjs`, no un dato de Claude Code. | §25.2, §25.3 |
| 2. ¿Un mensaje o dos familias? | Mismo mensaje literal en las tres que alcanzaron a escribirlo (J1, J2, J5); las otras tres (J3, J4, J6) no escriben nada — no es un segundo mensaje, es la ausencia total de turno. Dos familias por CUÁNDO las pilló el límite (a mitad de turno / entre turnos), no por texto distinto. | §25.4 |
| 3. ¿Qué disparó el bloqueo? | El reloj de cupo de la cuenta, agotado por las seis sesiones a la vez — no una herramienta ni una sesión concreta. | §25.4 |
| 4. ¿Se puede prevenir sin apagar nada? | Sin medir un arreglo (no era el encargo): esperar el reset no basta solo — hace falta parar+relanzar tras él (§25.6). Repartir la cuota entre menos sesiones de fondo simultáneas reduciría la probabilidad de tocar el techo a la vez, pero esa es una decisión de cuántos puestos corren en paralelo, no de `sesion.mjs`. | §25.6 |

**Lo que NO se tocó:** `scripts/equipo/sesion.mjs` (solo lectura), `.mcp.json`, `~/.claude.json`
(ni se abrió), `.claude/hooks/guard-dangerous.mjs`, ningún guard nuevo, cero `src/`.
