# Runbook · pasar el equipo a MESAS y armar la cerradura de carriles

> Lo ejecuta **UN JEFE**, con **EL EQUIPO PARADO**. No lo ejecuta una sesión. Dueña del texto: S0 (SCRUM-1295).
> Escrito el 1-oct-2026 contra `origin/main` = `66ba128c699de3000d806440d3ca0751927e3f48`. **Nadie lo ha
> ejecutado todavía:** cada paso dice si lo que afirma está MEDIDO o no.

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
| 0.1 | #2001 (SCRUM-1295) está en `main` | `git log origin/main --oneline --grep=SCRUM-1295 -1` | hoy NO: es un borrador |
| 0.2 | el lanzador va con el modelo decidido (opus) | `sesion.mjs lanzar` lo dice en su veredicto; sale de `modelo` en `config.json`, y sin la clave es opus (SCRUM-1364) | sí, en `main` |
| 0.3 | ninguna sesión trabajando | `node scripts/equipo/latido.mjs`, sección SESIONES: cero `working` | — |
| 0.4 | 🔴 **ninguna sesión BLOQUEADA con una pregunta dentro** | la misma pasada, secciones SESIONES y CEMENTERIO | **parar una sesión BORRA su pregunta** (medido por S5: 227 trabajos parados, 0 conservan `needs`). Se contesta o se apunta ANTES de parar |
| 0.5 | cada sesión cerró con su traspaso y su obligatorio dicho | sección TRASPASO del latido; el hook de cierre lo dice al parar | — |

## Los pasos

**1 · Los permisos del fundador, a las mesas.** El `settings.local.json` del checkout compartido tiene
**20 reglas `allow` que no están en `main`** (71 contra 51, medido el 1-oct). Una mesa nace con las de
`main`. Sin esas 20, una sesión de fondo se queda pidiendo un permiso que nadie puede dar: es lo que les
pasó el 1-oct a dos sesiones lanzadas desde una carpeta nueva, y el lanzador dijo «backgrounded» igual.
→ Las decide y las sube EL FUNDADOR (regla a regla, por PR). Ninguna sesión copia permisos.
→ Comprobación: `git diff origin/main -- .claude/settings.local.json` en el checkout compartido sale vacío.

**2 · Dónde van las mesas.** Añadir a `%LOCALAPPDATA%\yaqu-equipo\config.json` la clave `mesas` con una
ruta ABSOLUTA, hermana del repositorio: `"mesas": "D:/MILLONARIO/cobroFlash"`. Es el interruptor: sin ella,
`sesion.mjs` sigue heredando la carpeta de quien lanza, y lo dice (`SIN-MESA`).
→ El equipo de Javier declara además `identidades` (`sesion-1` → `J1`…): sin esa traducción, la mesa de un
puesto J no se escribe (salida 2 al LANZAR, que es donde tiene que fallar).
→ Medido: una mesa dentro del repositorio se rechaza (`MESA-DENTRO-DEL-REPO`). No medido: el alta de la clave
en esta máquina.

**3 · `node_modules` y `dist`.** Una mesa nace sin ninguno de los dos.
→ `node_modules` por junction a uno que ya exista. 🔴 Para QUITAR una junction: `[IO.Directory]::Delete(junction, $false)`
y comprobar después que el destino sigue lleno. `git worktree remove --force` sobre una mesa con junctions
VACÍA el destino (pasó).
→ `dist`: `npm run build` en la mesa, o el recuento de tests saldrá con cientos de fallos que no son de nadie.

**4 · Lanzar el primer puesto, y solo uno.** `node %LOCALAPPDATA%\yaqu-equipo\sesion.mjs lanzar sesion-0 <prompt>`.
`prepararMesa` crea `<mesas>/mesa-s0` en `origin/main` y escribe su `.yaqu-puesto.json`.
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

**6 · El resto de los puestos**, uno a uno, con las tres comprobaciones del paso 4.

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
| una mesa no arranca, o arranca mal | quitar `mesas` de `config.json`: el lanzador vuelve a heredar la carpeta (`SIN-MESA`) |
| la cerradura para a quien no debe | revertir el PR del paso 8. Los hooks de aviso siguen |
| un hook deja a las sesiones esperando | `YAQU_LATIDO=no` apaga el latido de arranque. El de cierre no tiene interruptor y no lo necesita: avisa una vez y pasa |

## Lo que este runbook NO sabe

- Cuánto tarda. Nadie lo ha hecho.
- Si las mesas del equipo de Javier necesitan algo más que `identidades`: su máquina no la he medido.
- Qué pasa con una sesión que se REANUDA después de la migración: reanuda en su carpeta vieja, sin
  identidad. Por eso el paso 8 exige que no quede ninguna viva en el checkout compartido.
- La cerradura ve `Edit`/`Write`/`NotebookEdit`. Una escritura por la terminal solo la ve con el matcher
  ampliado del paso 8, y solo las formas que `carril.mjs` sabe leer.
