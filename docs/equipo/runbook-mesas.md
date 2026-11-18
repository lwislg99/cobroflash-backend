# Runbook · pasar el equipo a MESAS y armar la cerradura de carriles

> Lo ejecuta **UN JEFE**, con **EL EQUIPO PARADO**. No lo ejecuta una sesión. Dueña del texto: S0 (SCRUM-1295).
> Escrito el 1-oct-2026 contra `origin/main` = `66ba128c699de3000d806440d3ca0751927e3f48`. **Puesto al día
> el 18-nov-2026 (SCRUM-1708)** contra `origin/main` = `6881a0d27e8b4e337bd55175c3068791c8304c69`, leyendo
> `scripts/equipo/sesion.mjs` (`mesaDelLanzamiento`, `prepararMesa`) y `aparcar.mjs` / `sala.mjs` como están
> hoy. Cada paso dice si lo que afirma está MEDIDO o no.
>
> **Estado medido el 18-nov-2026:** el interruptor NO está dado. `%LOCALAPPDATA%\yaqu-equipo\config.json`
> trae `repo` y no `mesas`, así que **todo lanzamiento de hoy es `SIN-MESA` y arranca en `config.repo`**
> (`D:/MILLONARIO/cobroFlash/cobroflash-backend`, el checkout compartido). Que salga `SIN-MESA` es lo NORMAL
> mientras no se ejecute este runbook: no es una avería. En `D:/MILLONARIO/cobroFlash` hay tres carpetas
> `mesa-*` (`mesa-s3`, `mesa-s5`, `mesa-control-s5`) de pruebas anteriores; sin `mesas` en la config, el
> lanzador no las usa.

## Por qué hace falta parar

`CLAUDE.md`, los hooks (`.claude/settings.json`) y las reglas de carril se cargan desde la carpeta donde
ARRANCA cada sesión. Hoy todas arrancan en el checkout compartido, que va más de 1.400 commits por detrás:
**nada de lo mergeado en normas o en hooks desde el 22-sep le llega a nadie.** Eso incluye la A9, la
identidad, el latido al arrancar y el aviso del cierre (SCRUM-1294, 1295, 1356). Una mesa es un árbol al día,
uno por puesto, HERMANO del repositorio.

Y hace falta parar porque el último paso arma una cerradura que **para a toda sesión sin identidad**. Con
una sola sesión arrancada en la carpeta vieja, esa sesión se queda sin poder editar.

## Antes de empezar: lo que tiene que ser verdad

| # | condición | cómo se comprueba | medido |
|---|---|---|---|
| 0.1 | SCRUM-1295 (identidad y cerradura de carriles) está en `main` | `git log origin/main --oneline --grep=SCRUM-1295 -1` | sí (18-nov; el 1-oct era un borrador). El hook `carril.mjs` corre SIN `--exigir-identidad` |
| 0.2 | el lanzador va con el modelo decidido (opus) | `sesion.mjs lanzar` lo dice en su veredicto; sale de `modelo` en `config.json`, y sin la clave es opus (SCRUM-1364) | sí, en `main` |
| 0.3 | ninguna sesión trabajando | `node scripts/equipo/latido.mjs`, sección SESIONES: cero `working` | — |
| 0.4 | 🔴 **ninguna sesión BLOQUEADA con una pregunta dentro** | la misma pasada, secciones SESIONES y CEMENTERIO | **parar una sesión BORRA su pregunta** (medido por S5: 227 trabajos parados, 0 conservan `needs`). Se contesta o se apunta ANTES de parar |
| 0.5 | cada sesión cerró con su traspaso y su obligatorio dicho | sección TRASPASO del latido; el hook de cierre lo dice al parar | — |
| 0.6 | cada puesto parado a propósito está **APARCADO**, en el mismo bloque en que se para | `node scripts/equipo/aparcar.mjs S0,S1,… --hasta <hora o duración> --motivo "migración a mesas"`; sin argumentos, lista las marcas y si valen | sí, en `main`: `--hasta` y `--motivo` son OBLIGATORIOS (sin ellos sale 1). Sin la marca, la sala pinta cada puesto parado como `VACIO` («SIN CUBRIR»). La marca VENCE en su `--hasta`, y una sesión del puesto lanzada DESPUÉS la anula sola (se mira el `createdAt`): no hace falta quitarla al relanzar |

## Los pasos

**1 · Los permisos del fundador, a las mesas.** El `settings.local.json` del checkout compartido tiene
**20 reglas `allow` que no están en `main`** (71 contra 51, medido el 1-oct). Una mesa nace con las de
`main`. Sin esas 20, una sesión de fondo se queda pidiendo un permiso que nadie puede dar: es lo que les
pasó el 1-oct a dos sesiones lanzadas desde una carpeta nueva, y el lanzador dijo «backgrounded» igual.
→ Las decide y las sube EL FUNDADOR (regla a regla, por PR). Ninguna sesión copia permisos.
→ Comprobación: `git diff origin/main -- .claude/settings.local.json` en el checkout compartido sale vacío.

**2 · Dónde van las mesas.** Añadir a `%LOCALAPPDATA%\yaqu-equipo\config.json` la clave `mesas` con una
ruta ABSOLUTA, hermana del repositorio: `"mesas": "D:/MILLONARIO/cobroFlash"`. Es el interruptor: sin ella,
la sesión arranca en `config.repo` (el checkout compartido), **no** en la carpeta de quien lanza, y el
veredicto lo dice (`SIN-MESA`, SCRUM-1298c). Sin `repo` ni `mesas`, no se lanza (`NO-PUDE-MIRAR`).
→ El equipo de Javier declara además `identidades` (`sesion-1` → `J1`…): sin esa traducción, la mesa de un
puesto J no se puede preparar (`SIN-IDENTIDAD`) y la sesión **arranca igual, en el repo**, con veredicto
`MESA-FALLIDA` (SCRUM-1298d). Ya no se para el lanzamiento: se lee el veredicto.
→ Medido en el código: una mesa dentro del repositorio no se prepara (`MESA-DENTRO-DEL-REPO`) y cae también
a `MESA-FALLIDA`. No medido: el alta de la clave en esta máquina (18-nov: sigue sin darse).

**Los tres veredictos de la mesa** (campo `mesa` de lo que imprime `sesion.mjs lanzar` y `relevar`):

| veredicto | dónde arranca la sesión | qué significa | qué se hace |
|---|---|---|---|
| `MESA` | `<mesas>/mesa-sN`, un worktree `--detach` en `origin/main` recién traído, con su identidad escrita | el interruptor está dado y la mesa quedó al día | nada: es lo esperado tras el paso 2 |
| `SIN-MESA` | `config.repo` | la instalación no declara `mesas` | nada, mientras no se ejecute este runbook: es el estado de hoy |
| `MESA-FALLIDA` | `config.repo`, como sin mesas | con `mesas` declarada, la mesa no se pudo preparar. Su `fallo` dice por qué: `MESA-NO-VALIDA` (ruta no absoluta), `MESA-DENTRO-DEL-REPO`, `SIN-IDENTIDAD`, `MESA-AJENA` (existe y no es un worktree de este repo), `MESA-SUCIA` (tiene cambios sin guardar: alguien trabajó dentro), `MESA-NO-AL-DIA` o `NO-PUDE-MIRAR` (fetch o `worktree add` caídos) | la sesión trabaja, pero en el checkout compartido y sin identidad de mesa. Se arregla la causa de `fallo` y se relanza ese puesto. Una `MESA-SUCIA` no se limpia a ciegas: es trabajo de alguien |

Un lanzador que no lanza es peor que una mesa vieja (orden del orquestador, 11-nov-2026): por eso un fallo de
mesa NO bloquea y solo lo dice el veredicto. Quien lanza lo LEE.

**3 · `node_modules` y `dist`.** Una mesa nace sin ninguno de los dos.
→ `node_modules` por junction a uno que ya exista. 🔴 Para QUITAR una junction: `[IO.Directory]::Delete(junction, $false)`
y comprobar después que el destino sigue lleno. `git worktree remove --force` sobre una mesa con junctions
VACÍA el destino (pasó).
→ `dist`: `npm run build` en la mesa, o el recuento de tests saldrá con cientos de fallos que no son de nadie.

**4 · Lanzar el primer puesto, y solo uno.** `node %LOCALAPPDATA%\yaqu-equipo\sesion.mjs lanzar sesion-0 <prompt>`.
`prepararMesa` crea `<mesas>/mesa-s0` en `origin/main` y escribe su `.yaqu-puesto.json`.
→ Comprobación 0, el veredicto: `mesa.veredicto` es `MESA`. Si sale `MESA-FALLIDA`, la sesión YA está
lanzada, pero en el repo: se lee su `fallo` antes de seguir, y no se pasa al paso 5.
→ Comprobación A, la carpeta: `claude agents --json` → el `cwd` de esa sesión es la mesa, no el checkout.
→ Comprobación B, la identidad: preguntarle «¿qué puesto eres y quién te lo ha dicho?». Tiene que citar el
hook de inicio (`IDENTIDAD (hook de inicio, SCRUM-1295)`), no su prompt.
→ Comprobación C, que el registro la ve: `node scripts/equipo/latido.mjs`, sección SESIONES. El panel
puede no listarla: manda el registro.
→ Si algo falla aquí, se arregla con UN puesto parado, no con seis.

**5 · El orquestador, desde un árbol al día.** Es quien más lo necesita y el único que no lanza nadie: lo
abre el fundador. Tiene que abrirse en una carpeta con el `settings.json` de `main`.
→ Comprobación: `node .claude/hooks/latido-arranque.mjs corrio` → 0, con una línea de hace minutos y
`source: startup`. Si sale 2, el latido NO le está llegando, diga lo que diga este runbook.
→ ⚠️ Su carpeta de hoy tiene cambios sin comitear y esos permisos locales. No se toca desde aquí: lo decide
el fundador.

**6 · El resto de los puestos**, uno a uno, con las comprobaciones del paso 4. Lanzar un puesto anula
su marca de aparcado (paso 0.6) sin tocarla; los que aún no se lanzan siguen aparcados mientras su `--hasta`
no venza. Si la migración se alarga más que el `--hasta`, se vuelve a aparcar con otro: vencida, la sala
los pinta `VACIO` otra vez.

**7 · Una jornada con la cerradura SIN armar.** Los hooks ya corren: `carril.mjs` para a quien edita fuera
de su carril, pero deja pasar a quien no tiene identidad. Se mira qué para y a quién.
→ Lo que hay que ver: cero avisos de DISCREPANCIA (carpeta dice un puesto y nombre otro). Uno solo es un
fallo del montaje, no de la sesión.

**8 · EL ÚLTIMO, y no antes: armar `--exigir-identidad`.** En `.claude/settings.json`, por PR:
`node .claude/hooks/carril.mjs --exigir-identidad`, con matcher `Edit|Write|NotebookEdit|MultiEdit|Bash|PowerShell`.
Desde ese merge, una sesión sin identidad no puede editar.
→ Antes de mergear: `claude agents --json` y comprobar que NINGUNA sesión viva tiene el `cwd` en el
checkout compartido.

## Cómo se vuelve atrás

| qué se rompió | marcha atrás |
|---|---|
| una mesa no se prepara | nada que deshacer: la sesión ya arrancó en el repo con `MESA-FALLIDA` y su `fallo`. Se arregla la causa y se relanza ese puesto |
| las mesas se preparan pero algo va mal dentro | quitar `mesas` de `config.json`: todo lanzamiento vuelve a arrancar en `config.repo` (`SIN-MESA`), como hoy. No vuelve a heredar la carpeta de quien lanza (eso acabó con SCRUM-1298c) |
| la cerradura para a quien no debe | revertir el PR del paso 8. Los hooks de aviso siguen |
| un hook deja a las sesiones esperando | `YAQU_LATIDO=no` apaga el latido de arranque. El de cierre no tiene interruptor y no lo necesita: avisa una vez y pasa |

## Lo que este runbook NO sabe

- Cuánto tarda. Nadie lo ha hecho entero (18-nov: el paso 2 sigue sin darse).
- Qué se hace con las tres carpetas `mesa-*` que ya existen. Si alguna tiene cambios sin guardar, el primer
  lanzamiento de su puesto saldrá `MESA-FALLIDA` con `MESA-SUCIA`, como debe: se mira de quién es antes de
  tocarla.
- Si las mesas del equipo de Javier necesitan algo más que `identidades`: su máquina no la he medido.
- Qué pasa con una sesión que se REANUDA después de la migración: reanuda en su carpeta vieja, sin
  identidad. Por eso el paso 8 exige que no quede ninguna viva en el checkout compartido.
- La cerradura ve `Edit`/`Write`/`NotebookEdit`. Una escritura por la terminal solo la ve con el matcher
  ampliado del paso 8, y solo las formas que `carril.mjs` sabe leer.
