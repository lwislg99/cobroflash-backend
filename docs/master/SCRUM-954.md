# SCRUM-954 · Una sesión VIVA no es una sesión LISTADA

**Fecha:** 20-sep-2026 · **Carril:** S5 (automatización, eficiencia e infraestructura) · **Gate:** sin gate
**Medido contra:** `origin/main` = `f2fa091bfeb8c754ab0dcba5ddb95d0ed3d987d4` · 2026-09-20T13:19:47Z (hora de GitHub)
**Rama:** `scrum-954-vivo-no-es-listado` · worktree `D:/MILLONARIO/cobroFlash/wt-954` · CLI de Claude Code **2.1.278**

> Todo el PASO 0 de abajo se midió contra ese `f2fa091b`. La rama mergeó después `origin/main`
> `79061a9b6890c5f214695dd6614fe26836be5459` (28 commits, sin conflictos y sin tocar ninguno de sus
> ficheros), y la tanda de §3.2 corrió sobre esa fusión.
>
> El ticket lo abrió el orquestador del equipo de Javier el 18-sep-2026 (`dos-equipos.md` §5.1),
> medido sobre `4d8f3a15` con la CLI **2.1.276**. Dueño del área: S5 (`scripts/equipo/**`).

## 1 · PASO 0 — lo que se midió antes de escribir una línea

El encargo pedía medir el comportamiento real antes de construir. Menos mal.

### 1.1 · La causa que traía el ticket NO reproduce hoy

El ticket, y el comentario que lo afina, decían que `lanzar` en modo `reanudar` construye
`['--bg','--resume',sessionId,prompt]` **sin `-n`**, y que por eso la sesión reanudada pierde el
nombre y `estado`/`contexto`/`parar`/`relevar` dejan de verla. La lectura del código es correcta:
`argsLanzar({modo:'reanudar'})` no lleva `-n`, y eso se comprueba corriendo.

Lo que ya no se sostiene es la consecuencia. Medido con una sesión de prueba de verdad
(`prueba-954-20s`, id `07e54b18`, dos turnos triviales, parada al acabar):

```
$ claude --bg -n prueba-954-20s --permission-mode auto "<trivial>"
backgrounded · 07e54b18 · prueba-954-20s

$ claude stop 07e54b18
stopped 07e54b18

$ claude --bg --resume 07e54b18-3eab-4c07-95cd-2400e1cb9818 "<trivial>"     ← SIN -n
note: woke session 07e54b18 with its saved options (-n, --permission-mode).   (por stderr)
backgrounded · 07e54b18 · prueba-954-20s                                      (por stdout)

$ claude agents --json | …
{"…","name":"prueba-954-20s","…"}
$ type ~/.claude/jobs/07e54b18/state.json
name: "prueba-954-20s" · nameSource: "user" · respawnFlags: ["-n","prueba-954-20s","--permission-mode","auto"]
```

**En 2.1.278 la CLI restaura las opciones guardadas al reanudar: el nombre no se pierde.** Las dos
salidas están en `docs/master/evidencias/scrum954/bg-con-nombre.txt` y `bg-resume-sin-n.txt`.

⚠️ **Lo que esto NO dice, declarado:** la versión donde lo midió el equipo de Javier (2.1.276) ya no
está instalada en esta máquina y **no se puede probar**. Puede que lo arreglara el salto de versión,
o puede que su caso tuviera algo más (él había borrado el `~/.claude/jobs/<id>` antes). No se afirma
la causa; se declara que **hoy no tiene víctima**, y no se vende como arreglo lo que no está roto.

### 1.2 · La causa que SÍ tiene víctima hoy, y que nadie tenía

`claude agents --json` sigue listando un trabajo que terminó hace dos días, y lo lista como
`working`:

```
lista     : {"id":"df2fa38f","kind":"background","name":"sesion-5","state":"working"}   ← sin pid, sin status
state.json: {"state":"done", "firstTerminalAt":"2026-09-18T13:50:15.562Z", …}
```

Con esa entrada, corriendo las decisiones de `sesion.mjs` contra la lista real
(`docs/master/evidencias/scrum954/paso0-decisiones.txt`, población declarada: 9 entradas, 7 de fondo,
2 interactivas; 1 discrepancia de 7):

| | con el criterio de antes |
|---|---|
| `lanzar sesion-5` | **YA-VIVA** — no lanza |
| `relevar sesion-5` | **OCUPADA** — «no se para a mitad», aunque el traspaso esté recién escrito |
| `parar sesion-5` | PARAR + `claude stop`, que sobre un trabajo ya terminal **no lo quita de la lista** |

O sea: **el nombre del puesto queda quemado para siempre**, y lo que se rompe es exactamente el
relevo de la A19, que es «parar y volver a lanzar el MISMO nombre». No es el caso raro: es la
operación normal del equipo. El 20-sep el orquestador tuvo que inventar seis nombres nuevos
(`s0-20`, `s1-20`, `s2-20`, `s2b-20`, `s4-20`, `s5-20b`) porque los de siempre estaban ocupados.

### 1.3 · El tell, y de dónde sale

De un **control**, no de una teoría. La sesión de prueba, con su proceso VIVO, sale así; el resto,
con el proceso muerto, así:

```
viva  → { pid: 8756, id:'07e54b18', status:'idle', state:'done', … }
resto → {             id:'df2fa38f',               state:'working', … }
```

Cuando el proceso ya no está, **el `state` de la lista no describe nada**: se quedó con el último que
tuvo en vida, y el `pid` desaparece. Ese es el único dato que distingue, y es el que manda.

🔴 Y la otra mitad, que es la que casi me come: **una sesión de fondo VIVA también escribe
`state: "done"` y `firstTerminalAt` en su `state.json` entre turno y turno.** Si el criterio fuera el
`state.json`, media plantilla saldría «muerta». Por eso el `state.json` sólo puede **vetar** un
veredicto de muerte, nunca dictarlo.

## 2 · Lo que se construyó

Todo en `scripts/equipo/sesion.mjs`. Los tres puntos que pedía el ticket, y el arreglo de 1.2.

1. **`clasificarAgente(agente, job)` → `VIVA` | `MUERTA` | `NO-PUDE-MIRAR`.** El `pid` decide; el
   `state.json` del trabajo veta. **Falla cerrado:** sólo se declara MUERTA cuando las dos sondas lo
   dicen, y cualquier duda —sin `state.json`, ilegible, o que no diga que terminó— sale como
   `NO-PUDE-MIRAR`, que los tres que deciden tratan como viva. El motivo por qué: declarar muerta a
   una viva significa lanzar una segunda sesión encima de alguien que está entregando, o borrarle su
   conversación.
2. **`repartirPorNombre`**, y `decidirLanzar` / `decidirRelevar` / `decidirParar` pasan a usarla. El
   criterio vive en UN sitio: repetirlo en tres es la forma de que se separen sin que nadie lo note.
   Si no se les pasa la sonda `job`, se comportan **como antes de 954** — el conservador.
3. **`estado` saca dos bloques nuevos** (puntos 2 y 3 del ticket): `restos`, los trabajos terminados
   que siguen ocupando un nombre del equipo, y `otras`, las sesiones de fondo que **no** casan la
   lista blanca — incluidas las que **no tienen nombre**, que hasta hoy desaparecían del radar
   porque el filtro sólo dejaba pasar la lista blanca. `sesiones` no cambia de forma.
4. **Verbo nuevo `olvidar <nombre>`**: `claude rm` de los restos, para que la lista deje de mentir.
   Es un acto irreversible, así que no es la acción principal de nada (`lanzar` y `relevar` ya no lo
   necesitan), se niega entero si hay una viva con ese nombre, y no toca lo que no esté muerto por
   las dos sondas. Y la ayuda lo dice, que era el punto 3: hasta hoy había que salir de esta puerta
   y escribir `claude rm <id>` a mano, que además está **denegado** en el settings del fundador.
5. **La regex del `backgrounded`** deja de exigir un « · » detrás del id. Ese separador sólo existe
   cuando la sesión lleva nombre; sin él, una sesión que **sí** había arrancado se declaraba
   `NO-PUDE-MIRAR` y no se registraba. Es la familia de A21 vista del revés: una operación que se
   ejecutó, leída como un fallo. El caso lleva su **control negativo**: se comprueba que la regex
   vieja NO casa con esa salida, porque si casara el caso no demostraría nada.

### 2.1 · `lanzar` deja de reanudar — decisión, no descubrimiento

**Decisión del orquestador del 20-sep-2026, tomada y asumida por él, con su motivo escrito.** Y el
motivo **cambió por el camino, y hay que decirlo**: ya no es «reanudar pierde el nombre» (§1.1: hoy
es falso). Es sólo la A19 — reanudar dentro de la hora arrastra la conversación entera, que es justo
lo que el relevo viene a soltar; en el caso que midió el equipo de Javier habría reanudado una sesión
de **421.718 tokens** que acababa de pedir el relevo. `relevar` ya lanzaba siempre nueva; ahora
`lanzar` también.

🔴 **Muere con ello la regla de «menos de una hora parada → reanudar»**, que vivía en
`decidirLanzar`. `UNA_HORA_MS` se queda: lo sigue usando `decidirRelevo` para el caso 2 de la A19
(«más de 1 h parada → relevar»). **Esto hay que reflejarlo en las normas, y no es de este puesto: es
de la S0.**

### 2.2 · El censo (A12) — quién medía sobre lo que cambia

Antes de tocar, se buscó quién toma esta superficie como magnitud. Tres ficheros de otros tickets:

- `tests/scrum899-sesion-lista-blanca.test.mjs` afirmaba que con la caché caliente `lanzar` devuelve
  `REANUDAR`. Re-escrito a `NUEVA`, con el motivo dentro.
- `tests/scrum899c-relevar-y-contexto.test.mjs` usaba **esa misma reanudación como control** de que
  `relevar` no reanuda. El control se queda sin contraste, así que pasa a hacerse contra
  `argsLanzar({modo:'reanudar'})`, que sigue existiendo y sigue siendo lo que no se puede construir
  ahí. El hermano positivo de SCRUM-237, intacto.
- `tests/scrum951a-equipo-configurable.test.mjs` anclaba una mutación en la línea de la CLI que llama
  a `decidirLanzar`, y esa línea ganó el argumento `job`. **Re-anclada, no relajada:** lo que la
  mutación quita sigue siendo `equipo` y sigue teniendo que matar.

Y un hallazgo de paso, arreglado aquí porque es del mismo sitio: **los tres bancos que ejecutan la
CLI de verdad no declaraban carpeta de `jobs`**, así que `estadoDeJob` habría caído en
`%USERPROFILE%/.claude/jobs` — los trabajos REALES de la máquina. Hoy no cambiaba ningún resultado
(ningún id del banco existe ahí), y por eso se pone ahora: el día que coincida un id, el fallo va a
parecer cualquier otra cosa. *Un laboratorio que le presta su entorno al sujeto mide la suma de los
dos.*

## 3 · El rojo, corrido

`tests/scrum954-vivo-no-es-listado.test.mjs`, 12 casos, con la captura REAL de
`claude agents --json` del 20-sep dentro (`evidencias/scrum954/agents-20sep.json`). Las tres
mutaciones declaradas en `MUTACIONES_QUE_ME_TUMBAN`, una cada vez, con el `git diff --numstat` al
lado de cada veredicto y el árbol comprobado limpio al revertir:

```
BASE (sin mutar)              · tests 12 · pass 12 · fail 0 · EXIT=0
MUTANTE 1 · quitar el pid     · diff 1 1 · pass 10 · fail 2 · EXIT=1 → MUERTO
MUTANTE 2 · quitar el suelo   · diff 1 1 · pass 11 · fail 1 · EXIT=1 → MUERTO
MUTANTE 3 · resto = la dudosa · diff 1 1 · pass 10 · fail 2 · EXIT=1 → MUERTO
VUELTA A VERDE                · tests 12 · pass 12 · fail 0 · EXIT=0
MUTANTES VIVOS: 0 de 3
```

Registro entero: `docs/master/evidencias/scrum954/rojos.txt`.

### 3.1 · 🔴 El error propio: en la primera pasada, el mutante 1 SOBREVIVIÓ

Quitar el criterio del `pid` —o sea, invertir el arreglo entero— no rompía ningún caso. Dos fallos a
la vez, y los dos son de manual:

1. **Una aserción ciega.** El «control positivo» comprobaba `assert.match(motivo, /pid/)`, y el
   motivo del caso contrario es «**sin** pid», que casa igual. *Contar texto no es contar cosas.*
   Ahora se juzga por `clasificacion`, que es el campo que decide.
2. **Faltaba el caso que yo mismo había medido**: la sesión de prueba con el proceso VIVO y el
   `state.json` ya TERMINAL. Sin él, el criterio se podía invertir sin consecuencias — y con el
   criterio invertido, `olvidar` habría borrado la conversación de sesiones que estaban trabajando.

El arreglo se comiteó **aparte** (`9caa2ba4`) antes de volver a inyectar, y los tres rojos se
repitieron enteros.

    🔒 Una aserción que casa igual con el caso y con su contrario no es un control, es un adorno.

    🔒 Un guard que nunca has visto fallar es un guard que no sabes si funciona — y verlo fallar una
       vez tampoco basta: hay que ver fallar el caso que el arreglo existe para cubrir.

Y el caso que faltaba era **justo el que había medido con mis ojos** una hora antes. Por eso el rojo
se prueba antes de creerse el verde: el verde de la primera pasada era real, y no valía nada.

## 4 · Lo que hay que saber fuera de aquí

- 🔴 **La instalación de Javier se va a quedar parada en cuanto esto entre en `main`.**
  `puertaDeIntegridad` compara la copia instalada **byte a byte** con `origin/main`: hasta que su
  `arranque.cmd` la vuelva a copiar, su `sesion.mjs` dirá `ALTERADO` y no actuará. Lo avisa el
  orquestador en Jira. En la máquina de Luis no rompe nada, y por un motivo peor: **no hay
  instalación** (8 de 9 ficheros ausentes, 0 tareas programadas de 1.713 líneas de `schtasks`). Eso
  va en **SCRUM-959**, no aquí.
- **La norma de «menos de una hora → reanudar» ya no existe.** Cambio de `00-normas-comunes.md`, que
  es de la S0 (§2.1).
- **Para SCRUM-935:** cada mutación declarada nueva se paga en el trabajo del meta-guard, que es
  justo el que se cancela a los 10 min 14 s contra un presupuesto de 10 min. 954 deja **tres**, a
  propósito.

## 5 · Lo que NO se tocó

`src/`, `public/`, nada del camino de emisión fiscal, `prisma/schema.prisma`,
`.claude/settings.json` (es del fundador), `uso.mjs`, y la instalación real de ninguna máquina.
