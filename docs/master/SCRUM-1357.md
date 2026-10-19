# SCRUM-1357 · El latido: las bloqueadas se leen del registro, y el cementerio de preguntas

**Medido contra:** `origin/main` = `7a30dbb0e50e1cc4d54949619f7be8d4aac0193f` · 2026-10-01T11:56:53Z

A9: comprobación → `tests/scrum1350-latido.test.mjs`

Carril S5 (`scripts/equipo/latido.mjs` y su test). No toca hooks, ni settings, ni producto. Sigue a
SCRUM-1350, que se cerró partido: lo de engancharlo (`SessionStart`, obligar `cierre`) es SCRUM-1356, de S0.

## Lo que pasó

| Qué | Medido |
|---|---|
| Un lanzamiento que no cuajó | El orquestador lanzó S1 y S3 desde una carpeta nueva. Las dos quedaron pidiendo aprobar un MCP. El lanzador dijo «backgrounded» con su id, `ListAgents` no las listaba, y se las dio por trabajando una hora. Lo delató un mensaje que rebotó |
| El bloqueo no está siempre en `state` | 1-oct 11:53Z, `s3-1octc`: `state=working`, `tempo=blocked`, `needs="approve Entering worktree"` |
| El cementerio | 8 trabajos en `state=blocked`, del 28-sep 14:13Z al 29-sep 18:08Z, cada uno con su pregunta en `needs`. Ninguna contestada. El latido no los veía: SESIONES solo mira 24 h |
| Lo que el lector callaba | `leerSesiones` saltaba con `continue` un `state.json` que no parseaba |
| Parar una sesión borra su pregunta | De 241 `state.json`: 227 en done/failed/stopped, **0 con `needs`**; los 8 `blocked` y 1 `working` lo llevan |

## Lo que entra

| Pieza | Qué hace |
|---|---|
| SESIONES | Bloqueada = `state=blocked` **o** `tempo=blocked` **o** hay `needs`. Si el `state` dice otra cosa, la línea dice en qué campo estaba el bloqueo. La población declara «leído del REGISTRO, no del panel» |
| CEMENTERIO (sección 6) | La pregunta de toda sesión que espera desde hace más de 24 h, con su edad, la más vieja primero |
| Fail-closed | `leerTrabajos` devuelve aparte los `state.json` ilegibles y las carpetas sin `state.json`. Con uno ilegible, CEMENTERIO sale «NO PUDE MIRAR» (salida 2) **y enseña igualmente lo que sí leyó**. SESIONES lo dice en su población |
| El libro | `%LOCALAPPDATA%\yaqu-equipo\cementerio.json`. Cada pasada copia ahí las preguntas que ve. Una pregunta sale del libro solo si la sesión SIGUIÓ (`working`/`done`: se le contestó) o si se marca. Que la paren o borren su carpeta no la saca |
| `latido.mjs contestada <id> <dónde>` | Apunta que la pregunta tiene respuesta y dónde está escrita. Otra pregunta de la misma sesión vuelve a avisar |

## Comprobado

- `tests/scrum1350-latido.test.mjs`: 22 casos (15 de 1350 + 7 nuevos), 22 pasan. Uno contra disco, en un temporal fuera del árbol.
- 12 mutaciones a mano, con la BASE sin mutar verde antes: las 12 caen (tempo no cuenta · needs no cuenta · ilegible saltado · cementerio no ciego · libro corrupto leído como vacío · ciego tapa lo leído · parada = contestada · solo mira hoy · contestada no calla · respuesta vieja contesta pregunta nueva · huérfana del libro no sale · carpeta sin state.json no se nombra). No se declaran en `MUTACIONES_QUE_ME_TUMBAN`: cada una se paga en el CI de todos (SCRUM-935).
- Contra el mundo, 1-oct ~11:57Z: 241 trabajos leídos, 0 ilegibles, 0 carpetas sin `state.json`; CEMENTERIO da las 8 (s0-27c, s4-28d, s4-28e, s4-29a, s3-29b, s3-29c, s5-29e, s4-29c) y SESIONES da `s3-1octc` con «su state dice working: el bloqueo está en tempo».

## Mis errores

1. **Dos mutaciones VIVÍAN en la primera pasada** (`needs` solo como bloqueo; la respuesta vieja contestando a la pregunta nueva). La segunda estaba tapada por una comprobación redundante dos líneas más abajo: el test pasaba por la segunda, no por la que yo creía estar probando. → dos aserciones más; ahora caen.
2. **Escribí «0 de 233» en un comentario antes de contarlo.** Eran 227. → corregido con el recuento delante.
3. **No pude reproducir el caso de origen.** Las dos sesiones del MCP (`s1-1octb`, `s3-1octb`) ya estaban en `stopped` cuando miré, y parar borra `needs`: no sé qué decía su `state.json` mientras esperaban. Lo cubierto es el caso que SÍ medí (`s3-1octc`). Si un lanzamiento que no cuaja no llega a escribir `state.json`, hoy solo saldría como «carpeta sin state.json» en la población, no como alerta.

## Lo que NO hace

- El libro solo conserva lo que alguna pasada del latido llegó a VER. Una sesión que se bloquea y se para entre dos pasadas pierde su pregunta igual que antes. Lo cierra que el latido corra solo: SCRUM-1356.
- No cruza con el panel: no dice «el panel no la ve», dice lo que hay en el registro.
- No decide si una pregunta está contestada: `s4-28d` lleva dos preguntas en un `needs` y solo una tiene respuesta (SCRUM-1353, comentario 17881). Marcarla es de quien contestó.

---

## 13-oct-2026 · SCRUM-1357b · PARADOS: las bloqueadas se cuentan por SESIÓN, cruzando el panel con el registro

**Medido contra:** `origin/main` = `cf0a4cb7eb8613d394f98bc3134ba9a89896839c` · 2026-10-13T13:54:59Z

A9: comprobación → `tests/scrum1357b-parados.test.mjs`

Carril S5 (`scripts/equipo/parados.mjs`, su test y su línea de `package.json`). No toca el latido, ni
`sesion.mjs`, ni hooks, ni producto.

### Lo que pasó

El 13-oct-2026 el panel tenía 37 sesiones y 31 BLOQUEADAS, siete de ese día, paradas entre 12 y 70
minutos (cifras del orquestador, no recontadas por mí: cuando miré ya había parado 26). Su vigía decía
«nadie parado» y con eso le dijo tres veces al fundador «los seis trabajando». El fundador lo vio antes,
en su panel. La causa que da el orquestador: aquel vigía miraba UN PUESTO, cogía SU SESIÓN MÁS RECIENTE
y, si estaba viva, daba el puesto por bueno.

Lo que NO pude mirar: ese vigía (`vigia2.mjs`). No está en `origin/main` ni lo encontré en disco
(`~/.claude/jobs`, el perfil a 7 niveles, `D:\` a 4). La causa la tomo del encargo; lo que sí he medido
es que el caso que describe existía, y es el de abajo.

El latido (SCRUM-1350 · 1357) ya enseñaba las bloqueadas de hoy, una por una, en su sección SESIONES.
Lo que falló no fue que faltara el detector: es que tarda minutos y habla con GitHub, y en mitad de un
turno se miró otra cosa más rápida. Por eso esto es un instrumento aparte y de un segundo, no una sección más.

### Lo que entra

`node scripts/equipo/parados.mjs` (o `npm run parados`) · `--json` · `--jobs <carpeta>`.

| | |
|---|---|
| unidad | la SESIÓN. El puesto sólo agrupa la salida |
| fuentes | el PANEL (`claude agents --json`) y el REGISTRO (`~/.claude/jobs/<id>/state.json`), cruzados por id |
| bloqueada | lo dice CUALQUIERA de las dos: panel `state=blocked` o `waitingFor`; registro `state`, `tempo` o `needs` |
| por cada una | puesto, nombre, id, parada desde cuándo, hace cuánto, si tiene proceso, quién lo dice y la pregunta (`needs`) entera |
| desde cuándo | del `timeline.jsonl`; si el bloqueo no dejó evento, del `updatedAt`, y se rotula como tal |
| por puesto | trabajando · bloqueadas · acabadas · restos · no sé. Un puesto sin nadie trabajando lo dice |
| salida | 0 nadie · 1 hay bloqueadas · 2 NO PUDE MIRAR algo (gana al 1) |

Se llama, no se copia: `leerTrabajos`, `espera`, `preguntaDe`, `puestoDe` (latido); `clasificarAgente`,
`ESTADOS_TERMINALES` (`sesion.mjs`); `leerLinea`, `tramosDe` (`scripts/espera-del-equipo.mjs`).

**NO PUDE MIRAR (salida 2), nunca «ninguna»:** el panel no contesta, sale con error, no es JSON o no es
una lista · no existe la carpeta de trabajos · una sesión del panel sin `state.json` legible · una que
el panel da por `working` sin proceso y sin haber terminado · un `state` que no se conoce · una sesión
`working` en el registro que el panel no lista. Con algo sin mirar, un cero no se escribe con las
palabras del verde.

### Contra el mundo

Primera pasada, 13-oct 13:43Z del reloj de la máquina (va unos 6 min por delante de GitHub: medido
13:50:34 contra `Date: 13:44:40`). 18 entradas en el panel, 16 de fondo; 394 trabajos en el registro,
0 ilegibles. Tarda 1 s. Salida 1:

| puesto | sesión | parada | espera |
|---|---|---|---|
| S3 | s3-13octc | 97 min | «approve Entering worktree» (el panel: permission prompt) |
| S0 | s0-13octc | 84 min | «Dar relevo del carril y decidir: 1434 (¿fundador?) y los 11 de 32 sin etiqueta» |
| S4 | s4-13octc | 82 min | «Los cinco hallazgos de la página van a S1: ¿los repartes tú?» |
| S2 | s2-13octc | 64 min | «GO en SCRUM-1215 para cambiar SIN_APROBAR_DIRECCION_OBRA de 4 a 0; levantar el relevo de S2» |
| sin puesto | 883375c0 | 4 min | «send a prompt to start» |
| sin puesto | 3cdc6018 | 2 min | «send a prompt to start» |

Las cuatro primeras son el caso del encargo: S0, S2, S3 y S4 tenían cada uno su sesión `…13octd`
trabajando y la `…13octc` bloqueada debajo. Las dos últimas eran dos lanzamientos sin nombre y sin
prompt, de minutos antes, que nadie había visto. Y cuatro restos que el panel daba por `working`
(sesion-5, s1-21, s1-27a, s3-28b: sin proceso, terminados según su registro) no contaron como trabajando.

### La aceptación → dónde se ve

| lo pedido (literal del encargo) | dónde se ve |
|---|---|
| «cuántas sesiones están `blocked`, de qué puesto, desde cuándo y con qué pregunta dentro (`needs` del `state.json`)» | `tests/scrum1357b-parados.test.mjs` («EL CASO DEL 13-OCT», «se cuenta por SESIÓN», «paradaDesde») |
| «leyendo lo mismo que el panel: `claude agents --json`» | «leerPanel», «de punta a punta» (el doble exige que le pidan `agents --json`) |
| «fabrica el caso —un puesto con una sesión viva y otra bloqueada— y comprueba que el instrumento lo CAZA» | «EL CASO DEL 13-OCT», y «de punta a punta» con el guion de verdad |
| «que diga lo que NO pudo mirar. Si `claude agents --json` no contesta, eso no es "nadie parado"» | «el panel NO CONTESTA», «sin REGISTRO», «una bloqueada del panel sin state.json», «`working` sin proceso», «de punta a punta» (tres paneles rotos) |

### Probado en rojo

21 casos, 21 pasan. 16 mutaciones sobre `parados.mjs`, con la BASE sin mutar en verde antes y después;
las 16 tumban el test: la sesión más reciente de cada puesto y las demás no se miran (el defecto del
13-oct: caen 3) · un panel que no contesta se lee como vacío · sin registro no es «no pude mirar» · el
bloqueo sólo en `state` · `waitingFor` no cuenta · `working` es trabajando con o sin proceso · sesión
sin `state.json` no ciega · «no sé si trabaja» no ciega · lo que el panel no lista no se busca · una
lista tapa el «no pude mirar» · con algo sin mirar el titular es el del verde · «parada desde» ignora
la línea de tiempo · `leerPanel` devuelve lista vacía con código distinto de 0 · con salida que no es
JSON · sin poder lanzar · las de más de 24 h de fuera del panel entran en la tabla. No se declaran en
`MUTACIONES_QUE_ME_TUMBAN` (SCRUM-935).

### Mis errores

1. **La primera versión marcaba «0 ⚠️ NADIE» en la fila «sin puesto».** Las sesiones sin puesto no
   forman uno. Lo vi en la primera pasada contra el mundo. → comprobación: el caso «una sesión que no es
   de ningún puesto».
2. **Con el panel sin leer y ninguna bloqueada en el registro, la segunda línea decía «De lo que SÍ
   pude leer: ninguna sesión bloqueada».** Las palabras del verde debajo de un «no pude mirar». Lo vi al
   escribir el test, antes de correrlo. → comprobación: «el panel NO CONTESTA» exige que esas palabras
   no salgan.
3. **Una edición mía se comió un espacio de la tabla** y dos casos cayeron por ello. El test lo cazó.

### Lo que NO hace

- No sabe si una pregunta YA SE CONTESTÓ. Una bloqueada a la que se respondió relanzando su puesto sigue
  saliendo hasta que alguien la para. Y parar una sesión borra su `needs` del registro (13-oct: 131
  trabajos `stopped`, ninguno lo conserva): quien quiera guardarla pasa antes el latido, que la copia a
  su libro.
- No corre solo. Dice lo que hay cuando alguien lo lanza. Que el orquestador lo lance en cada turno
  es una línea de `docs/equipo/orquestador.md`, que es suyo: va propuesta en la entrega, no hecha.
- Fuera del panel sólo mira las últimas 24 h; lo más viejo lo cuenta y lo manda al cementerio del latido.
- Las sesiones interactivas (el orquestador, el fundador) no son trabajos: las cuenta y no las mira.
- Si el panel se cuelga, espera 60 s y lo dice; no mata al proceso que dejó colgado.

## 16-oct-2026 · SCRUM-1357c · PARADOS: la sesión que ACABÓ SU TURNO y sigue viva te espera; y los puestos vacíos

**Medido contra:** `origin/main` = `48fc00f6a90089b0f172b58c49413d889288bec0` · 2026-10-16T11:17:22Z (`Date:` de GitHub)

A9: comprobación → `tests/scrum1357c-te-espera.test.mjs`

Encargo del orquestador (16-oct, 1.ª tanda, punto 3): pasar su vigía `quien-me-espera.mjs` (vivía sólo en
su scratchpad) a `scripts/equipo/`. **No entra como fichero nuevo:** `parados.mjs` ya hacía sus ① (si no
puede mirar lo dice y sale 2) y ② (sesiones vivas sin registro legible = ciego), y contaba por SESIÓN. Un
segundo vigía duplicaba eso y daba dos fuentes de verdad. Lo que le faltaba a `parados.mjs` era otra cosa,
y es la que importa. Decisión avisada al orquestador antes de construir; aceptada.

### El defecto, medido

Una sesión de fondo que acaba su turno queda en `state=done · tempo=idle` (284 de los 455 `state.json`
del registro el 16-oct). **`done` NO es terminal**: con un mensaje vuelve a `working`. En los
`timeline.jsonl` del 15-oct: `s3-15octb` `done` a las 16:54Z → `working` a las 17:33Z (**39 min
esperando**); `s0-15octb` `done` 16:35Z → `working` 16:36Z. `parados.mjs` leía el `state` terminal como
«acabada» sin mirar el proceso, y con eso salía **0 con ✅**: el 15-oct, el día en que el fundador avisó
al orquestador de cinco puestos sin atender, el instrumento le decía «nadie parado». Y un puesto sin
ninguna sesión no tenía fila: la tabla sólo listaba los puestos que tenían alguna.

### Lo que entra (sólo `scripts/equipo/parados.mjs` y su test nuevo)

- **TE ESPERA** = terminada en el panel **o** en el registro (basta uno, como con el bloqueo) **y** con
  proceso (`pid`). Sale 1, en su tabla, con la hora del último `done` de su línea de tiempo (o
  `updatedAt`, rotulado) y su último `detail`. Un bloqueo gana: si hay pregunta, es «bloqueada».
- **Puestos vacíos** (`--puestos`, por defecto S0-S5; `--puestos ninguno` no los mira): un puesto pedido
  sin ninguna sesión con proceso sale 1 con su línea. Si alguna suya es «no sé», no se afirma (ya va en
  los ciegos). **Sin panel no se afirma ninguno** (no hay procesos que ver). Un `--puestos` que no se
  entiende sale 2: no se lee como «ninguno».
- El titular verde de 1357b no cambia (su test lo fija literal); lo nuevo va en la línea de debajo.
- `medir` recibe `puestos` y por defecto no mira ninguno: los 21 casos de 1357b no se han tocado.

**Desviación declarada y aceptada por el orquestador:** su vigía tomaba DOS muestras del tamaño de la
transcripción para distinguir «quieta» de «pensando». Aquí no: «quieta» no se deduce de un tamaño que no
crece; la afirman las dos fuentes al acabar el turno, y una sesión pensando está en `working`.

### Probado en rojo

| corrida | resultado |
|---|---|
| los casos de 1357c contra el `parados.mjs` de `main` (commit `d6a15a67a466368ba0a8b1b019bfcf94a5819fa2`) | 9 de 9 caen; el del 15-oct por lo que importa: `0 !== 1` |
| con el arreglo | 1357b + 1357c: **31 de 31** |
| 11 mutaciones (BASE 31/31 antes y después; bytes restaurados en `finally`) | **11 cazadas** |

Las mutaciones: el `done` con proceso vuelve a «acabada» (3 rojos) · no se mira el proceso · sólo cuenta
el panel · el bloqueo deja de ganar · la salida no mira a las que esperan · **la salida no mira los
puestos vacíos** · un resto sin proceso cuenta como viva · vacíos también sin panel · la que espera pinta
NADIE en su puesto · un `--puestos` ilegible se lee como «ninguno» · la hora no sale de la línea de tiempo.
La de los puestos vacíos **sobrevivió** en la primera pasada: todos mis casos con un puesto vacío tenían
además una sesión esperando. Se añadió «un puesto vacío y NADA MÁS basta para salir 1» y cae.
No se declaran en `MUTACIONES_QUE_ME_TUMBAN` (SCRUM-935), como las de 1357b.

### Contra el mundo

- 16-oct 11:21Z (reloj de la máquina): salida 1 por las dos bloqueadas de ayer (s4-15oct, s1-15octb);
  «ninguna te espera · puestos pedidos: S0…S5 — todos con alguna sesión viva». Correcto: los seis
  `…16oct` estaban `busy`.
- **El caso nuevo NO lo he visto en vivo:** a esa hora ninguna sesión estaba en `done` con proceso. Lo
  prueban la línea de tiempo del 15-oct y el caso fabricado.
- **La ceguera, con el guion de verdad y el registro de verdad:** panel que no se puede lanzar → salida 2,
  «NO PUDE MIRAR», y debajo lo que sí se leyó; `--puestos S9x` → salida 2.

### Mis errores

1. **La mutación de los puestos vacíos sobrevivió** (arriba): el test no lo comprobaba aislado.
2. **De paso, en SCRUM-1494 (mismo día):** para el rojo de su línea `A9:` usé `git stash push` + `pop` en
   el mismo comando. A15 lo prohíbe: el almacén es compartido entre worktrees. Comprobado después: la
   única entrada que queda es ajena y del 8-sep, y el commit llevaba mi versión. Sin daño, pero era la
   herramienta prohibida. El rojo se hace con un commit y `git restore --source=HEAD`, no con `stash`.

### Lo que NO hace

- No distingue «te espera porque acabó su lote» de «te espera porque se quedó sin uso»: las dos son
  `done` con proceso (ver el límite de uso del 9-oct). Lo dice su `detail`, que va en la tabla.
- No lo lanza nadie solo: sigue siendo una orden que el orquestador corre. `notify_when_idle` es el aviso
  que llega sin pedirlo; esto es la foto cuando se pide.

## 16-oct-2026 · SCRUM-1357d · SALA: el panel del fundador, alimentado por `parados.mjs` y desde el repo

**Medido contra:** `origin/main` = `665bcd17ff7fe0f63959b300bda92cdc6bf448c7` · 2026-10-16T12:08:36Z (`Date:` de GitHub)

### Lo que pasó

Encargo del orquestador. El plugin `yaqu-sala` (el renglón «SALA ·» bajo el prompt y `/sala`) corría un
vigía que vivía en el scratchpad de UNA sesión del orquestador (`register.js:21`): muere con su relevo. Y
sólo conocía los nombres `sN-…`; el 16-oct las sesiones se lanzaron como `sesion-N` y el panel enseñó los
seis puestos «SIN CUBRIR» con los seis trabajando. A las 12:01Z, ese vigía dijo «ningún puesto que
atender» mientras `parados.mjs` cazaba a `sesion-3` bloqueada en un permiso.

### Lo que entra

- `scripts/equipo/sala.mjs`: **llama** a `parados.mjs --json` como proceso (no lo importa ni lo copia) y
  traduce su informe a las líneas que el plugin ya lee — `AVERIA|…`, `VACIO|S3|…|su puesto está SIN
  CUBRIR`, `BLOQUEADA|S3|sesion-3|hace 8 min|pid …|«pregunta»`, `TE ESPERA|…` y `HUÉRFANAS|…`. Nada que
  atender = ninguna línea y salida 0; hay = 1; avería = 2, y la avería también va en línea.
- Los nombres los resuelve `puestoDe` (`latido.mjs`): `sN`, `sN-…`, `sesion-N`, `sesion-N-…`. Una sesión
  con proceso que no casa con ninguno sale como `HUÉRFANAS`, no se calla.
- **No escribe la línea de PR** que pedía el encargo: el plugin ya los cuenta él (`register.js:45-58`), y
  cada línea que recibe del vigía la cuenta como un puesto que atender (`register.js:97`). Una línea de PR
  aquí saldría como «1 puesto(s) que atender».
- **No hay «SIN MOVERSE»**: era la deducción por quietud del vigía viejo. Lo que la sustituye es
  `TE ESPERA` (terminada y con proceso), por lo mismo que en 1357c.

### Comprobado

| corrida | resultado |
|---|---|
| test nuevo `tests/scrum1357d-sala.test.mjs` | 8 de 8 |
| 4 mutaciones a mano (bytes restaurados en `finally`) | **4 cazadas** |
| el instrumento de mutación, sobre `scrum899d` como control | 8 de 8 |
| contra el mundo, 12:0xZ | salida 1 · `BLOQUEADA` de `sesion-3` (permiso de worktree), `sesion-4`, `sesion-1` (preguntas al fundador) y las dos viejas sin proceso del 15-oct |

Las mutaciones: **`puestoDe` que sólo conoce `sN` (el defecto del 16-oct tal cual) → cae «lo presente se
ve presente»** · las huérfanas no se miran · los ciegos de `parados.mjs` no se traducen · un informe que
no cuadra con su salida se cree. No se declaran en `MUTACIONES_QUE_ME_TUMBAN` (SCRUM-935).

Los dos sentidos del control, como pidió el orquestador: las seis vivas con las cuatro formas de nombre
dan CERO líneas; sin la de S3 sale exactamente `VACIO|S3|…`; y dos vivas sin puesto (`javier-16oct`,
`s12-16oct`) salen como huérfanas, con el control de que una sin proceso no lo es.

### Mis errores

1. **Mi instrumento de mutación dio «0 de 4 cazadas» la primera vez**: lo copié con `Get-Content` sin
   `-Encoding UTF8` y se corrompieron los `✖`/`✔` que busca. Como falla cerrado, lo marcó todo como
   superviviente en vez de como cazado. Rehecho en UTF-8 y comprobado contra 899d (8/8) antes de creerlo.

### Lo que NO hace

- **El plugin sigue apuntando al vigía del scratchpad**: el cambio de `register.js` es del orquestador.
- **El plugin no mira el código de salida** (`register.js:35-37`): si el guion no existe en la ruta,
  `node` sale 1 sin imprimir nada y el plugin pinta «los 6 trabajando». `sala.mjs` no puede arreglar eso
  desde dentro; lo arregla el plugin mirando `exitCode`.
- **No hay árbol al día del que correrlo**: el compartido va 3.226 commits por detrás y no tiene
  `parados.mjs`; `parados.mjs` arrastra `latido.mjs` y su cadena de imports, así que no se copia suelto a
  `%LOCALAPPDATA%`. Necesita una carpeta que siga a `origin/main`.
- Sigue sin verse en vivo una fila `TE ESPERA` (pendiente, como en 1357c).

A9: comprobación → `tests/scrum1357d-sala.test.mjs`


## 17-oct-2026 · SCRUM-1357e · APARCADO NO ES CAÍDO: el puesto que el orquestador para a propósito no alarma

**Medido contra:** `origin/main` = `c646bee25e320a69dda62ec4e63beabc56cdd466` · 2026-10-17T19:43:51Z

A9: comprobación → `tests/scrum1357e-aparcado-no-es-caido.test.mjs`

### El defecto

El 16-oct el orquestador paró al equipo por gasto y el panel del fundador pintó cinco puestos «SIN
CUBRIR». Era verdad, y el fundador preguntó DOS VECES si pasaba algo. Encargo: que un puesto parado a
propósito se vea distinto de uno caído, con dos condiciones: ⓐ si no sabe cuál es, lo dice y avisa;
ⓑ control en los dos sentidos.

### El mecanismo, y por qué una marca y no una deducción

- **Marca escrita por quien aparca**: `node scripts/equipo/aparcar.mjs S1,S2 --hasta 30h --motivo "gasto"`
  (o `--hasta 2026-10-18T09:00Z`; `--quitar S3|todos`; sin argumentos, lista). Vive en
  `%LOCALAPPDATA%\yaqu-equipo\aparcados.json`, junto al resto del estado del equipo.
- **Descartada la deducción por el último estado** (`stopped` = alguien lo paró): callaría el caso
  peligroso. `sesion.mjs relevar` PARA la sesión vieja antes de lanzar la nueva; si la nueva no arranca,
  el puesto queda con un `stopped` encima y sin cubrir de verdad. Deducido, eso saldría «aparcado».
- `parados.mjs` decide con `juzgarAparcado`. La marca **sólo vale** si: trae `desde` y `hasta`
  legibles · no ha vencido · **ninguna sesión del puesto se lanzó después** (`createdAt` del registro,
  no `updatedAt`: parar una sesión la toca después de aparcar y eso no es un relanzamiento) · una sesión
  del puesto sin `createdAt` no se movió después · hay registro que mirar. Si no vale, el puesto sale
  `VACIO` como siempre, con un quinto campo: `estaba aparcado, pero <por qué>`.
- `--hasta` y `--motivo` son **obligatorios**: una marca sin fin callaría el puesto para siempre, y el
  motivo es lo que lee el fundador en lugar de «SIN CUBRIR». Un `--hasta` sin huso se rechaza.
- **Marca ilegible = ciego** (parados sale 2, sala `AVERIA`), y los puestos salen `VACIO`, nunca
  `APARCADO`. `aparcar.mjs` se niega a escribir encima de una marca que no sabe leer.
- `sala.mjs` escribe `APARCADO|S3|hasta <ISO>|«motivo»|aparcado a las <ISO>`. **No cuenta para la
  salida** (sólo `APARCADO` → 0). La huella del plugin (tres primeros campos) lleva el `hasta`, no un
  «hace N min»: no suena cada tres minutos.
- Con `--jobs` (otro registro) y sin `--aparcados`, no se lee la marca de la máquina: hermético para
  los tests de la familia, que corren con `--jobs` en la máquina del equipo.

### Comprobado

| corrida | resultado |
|---|---|
| test nuevo `scrum1357e` + los de 1357b, 1357c y 1357d | **49 de 49** (`tests 49`, `skipped 0`) |
| 8 mutaciones a mano (restauradas en `finally` y comparadas byte a byte) | **8 cazadas** |
| `sala.mjs` contra el mundo, sin marca | salida 1, dos `BLOQUEADA` (S4, S1): lo de siempre |

Las mutaciones: no leer las marcas (ⓑ, cae el aparcado) · ignorar el vencimiento · ignorar el
relanzamiento · creerse una sesión sin `createdAt` · creerse la marca sin registro · callar la marca
ilegible · contar `APARCADO` como aviso · leer la marca de la máquina con `--jobs`. No se declaran en
`MUTACIONES_QUE_ME_TUMBAN` (SCRUM-935), como las de 1357b, c y d.

Los dos sentidos (ⓑ): el MISMO equipo parado (S0 viva, S1-S5 `stopped`) da cinco `APARCADO` y salida 0
con la marca, y cinco `VACIO` y salida 1 sin ella. Y por efecto, con los guiones de verdad: aparcar →
la sala deja de alarmar; quitar S3 → vuelve `VACIO|S3`.

### Lo que NO hace

- **El plugin `yaqu-sala` cuenta TODA línea como «puesto que atender»** (`register.js`, `renglon()` y la
  huella del aviso). Sin tocarlo, un `APARCADO` sale en `/sala` con su texto («APARCADO|S3|hasta…»), pero
  el renglón sigue diciendo «N puesto(s) que atender» y suena el aviso una vez. El plugin es del
  orquestador: el parche (filtrar las líneas `APARCADO|` antes de contar y de la huella, y pintarlas
  aparte) va en mano al orquestador. Hasta que entre, esto es la mitad.
- `_sala` sigue a `origin/main` a mano: hasta que se ponga al día, el panel corre el `sala.mjs` viejo.
- **Aparcar no para nada**, ni `sesion.mjs parar` aparca: son dos órdenes. Juntarlas tocaría la puerta
  única de `sesion.mjs`, que no recibe flags de fuera; no se ha hecho.


## 17-oct-2026 · SCRUM-1357f · PREGUNTA: la sesión muerta con su pregunta dentro no es un puesto vacío

**Medido contra:** `origin/main` = `d66ca7942c47ced5648fabe0280cc9ffcf2ec1a2` · 2026-10-17T21:47:50Z

A9: comprobación → `tests/scrum1357f-pregunta-sin-proceso.test.mjs`

### El defecto, medido

`sesion-2` (trabajo `7ffe11d9`) pasó a `blocked` a las **20:07:56Z** pidiendo una firma («Ficha de gasto
1156c lista; falta tu firma en SCRUM-1156»), según su `timeline.jsonl`. No hubo otro evento hasta que el
orquestador la paró a las **21:32:58Z**: 85 minutos. El panel pintaba `VACIO|S2|ninguna sesión suya con
proceso|su puesto está SIN CUBRIR`, igual que un puesto que se cubre cuando se pueda.

Simulado con el `sala.mjs` de `main` (una `sesion-2` bloqueada, sin proceso, con su `needs`): la pregunta
**sí salía**, como `BLOQUEADA|S2|sesion-2|hace 83 min|sin proceso|«…»`, pero en la ÚLTIMA línea y debajo
de un `VACIO|S2|…` del mismo puesto que la contradecía.

**Y había una segunda causa, fuera de este ticket:** la caché compartida del plugin
(`~/.claude/yaqu-sala-cache.json`) la estaba escribiendo TAMBIÉN el vigía viejo (`vigia2.mjs`, el del
scratchpad de una sesión del orquestador), desde una sesión que cargó el plugin antes del parche del
16-oct. Su formato lo delata (`VACIO|s0|no tiene ninguna sesión que se haya movido en 120 min|…`), y su
filtro de 120 min esconde a la sesión quieta. Avisado al orquestador; lo retiró él (ahora imprime
`AVERIA|vigía RETIRADO…` y sale 2) y se cura relanzando esa sesión.

### Lo que entra (sólo `scripts/equipo/sala.mjs` y su test nuevo)

- **`PREGUNTA|S2|sesion-2|hace 83 min|sin proceso|«<needs>»|su puesto está SIN CUBRIR`**: una bloqueada
  de `parados.mjs` SIN `pid` y CON pregunta. Va **antes** que los `VACIO` y **sustituye** al `VACIO` de su
  puesto: dos líneas que se contradicen sobre el mismo puesto son peor que una. El último campo sólo va si
  el puesto está vacío; si ya se relanzó, la pregunta vieja sigue saliendo sin él (nadie sabe si se
  contestó: lo mismo que ya decía `parados.mjs`).
- Cuenta como «que atender» (salida 1) y el plugin no necesita cambio: toda línea que no es `APARCADO|`
  ya cuenta. La huella (`PREGUNTA|S2|sesion-2`) no lleva el «hace N min»: suena una vez.
- `parados.mjs` no cambia: ya leía el `needs` de las fichas sin proceso de las últimas 24 h, incluidas las
  `stopped`. Lo que faltaba era la traducción.

### Comprobado

| corrida | resultado |
|---|---|
| test nuevo `scrum1357f` + los de 1357b, c, d y e | **55 de 55** (`fail 0`) |
| 4 mutaciones a mano (con Edit y vuelta atrás; árbol limpio después) | **4 cazadas** |
| `sala.mjs` contra el mundo | salida 1, cuatro `VACIO` (S0, S1, S3, S4) y ninguna `PREGUNTA`: ninguna ficha muerta conserva `needs` ahora |

Las mutaciones: no comerse el `VACIO` del puesto con pregunta · sacar `PREGUNTA` también con proceso ·
no sacar ninguna · dejarla también como `BLOQUEADA`. Los dos sentidos: muerta CON `needs` → `PREGUNTA`
(bloqueada fuera del panel, `stopped`, y en el panel sin `pid`); muerta SIN `needs` → `VACIO` y sólo eso.
No se declaran en `MUTACIONES_QUE_ME_TUMBAN` (SCRUM-935), como las de 1357b-e.

### La lección

**Un instrumento acotado a propósito se vuelve mentiroso si su mensaje no dice dónde termina.** Aquí,
«VACIO» era verdad (no había proceso), pero era más ANCHO que lo medido: decía «no hay nadie» donde había
alguien esperando. Y la del orquestador al retirar el vigía viejo: **fallar cerrado es IMPRIMIR una
línea, no desaparecer** — borrar el guion habría dado `node` saliendo 1 sin nada, y la copia vieja del
plugin, que no mira el código de salida, lo habría pintado como «nadie que atender».

### Lo que NO hace

- **Parar una sesión borra su `needs`**, como se midió el 13-oct: la ficha de `7ffe11d9` tras pararla ya
  no lo trae (sí conserva `suggestedReply`). Una pregunta que se contesta parando la sesión desaparece del
  panel; la que se para SIN contestar, también. El latido la guarda en su libro (`latido.mjs preguntas`).
  La pregunta sobrevive a que el PROCESO muera, no a que alguien la PARE.
- 🔴 **De ahí sale una regla de cómo se para a alguien, no un detalle del instrumento** (la pidió el
  orquestador al leer lo de arriba, 17-oct): **el `needs` se LEE ANTES de parar, nunca después.** Ese día
  paró a `sesion-2` con la pregunta ya leída y contestada; de no ser así, se habría perdido para siempre
  y la sesión siguiente no sabría ni que existió.
- `_sala` sigue a `origin/main` a mano: hasta que se ponga al día, el panel corre el `sala.mjs` anterior.

## 18-oct-2026 · SCRUM-1357g · `parados.mjs --control`: el control positivo que se corre sin `npm test`

**Medido contra:** `origin/main` = `06c6289d46d5998493ec014fa26ff3353946b58b` · 2026-10-18T17:46:18Z

A9: comprobación → `tests/scrum1357g-parados-control.test.mjs`

### De dónde viene
El orquestador pidió pasar a `scripts/equipo/` su `quien-me-espera.mjs`. Ese guion vivía en un scratchpad,
llevaba `--control` y se creía probado en caliente. **No se ha portado.** Medido a la vez que `parados.mjs`,
contra el panel de verdad (17:43Z):

| | `quien-me-espera.mjs` | `parados.mjs` |
|---|---|---|
| sin argumento | filtra por «oct»; ningún nombre lo lleva (son `sesion-N`) → «ninguna casa», **sale 0** | mira todo |
| `sesion-2`, bloqueada 18 min, que el panel da por `working` | «trabajando» (su transcripción crece) | **BLOQUEADA**, con su `detail` |
| puestos | «SIN NINGUNA SESION VIVA: s0…s5» en cada pasada (`slice(0,2)` de `sesion-N` = `se`) | por `puestoDe` |
| su control | prueba una COPIA de la condición, no la que usa `pintar` | (no tenía, sólo los tests de CI) |

El acierto que se le atribuía («las seis que me esperaban») era de `sala.mjs`, no suyo: lo corrigió el
propio orquestador. El orquestador lo da por tirado y deja `parados.mjs` como el vigía oficial. Le pidió a
`parados.mjs` lo único que el otro tenía: un control que se corra sin `npm test`.

### Lo que entra (sólo `scripts/equipo/parados.mjs` y su test nuevo)
- **`control()` exportada y `--control` en la línea de órdenes.** Cinco casos fabricados: una que trabaja
  (0) · una que acabó su turno con proceso (1, TE ESPERA) · una bloqueada que el panel da por `working`
  (1, BLOQUEADA, con la pregunta de su `needs`) · **un panel que no se puede leer (2, «NO PUDE MIRAR», sin
  ✅ ni «ninguna sesión bloqueada»)** · un state.json ilegible (2).
- **Pasa por las piezas de verdad, no por una copia:** el `leerPanel` de aquí con un lanzador falso (el JSON
  se parsea con el código de siempre), el `leerTrabajos` del latido sobre state.json escritos en un
  `os.tmpdir()` que se borra, y `medir`. No toca el panel ni el registro reales.
- Sale **0** si caza los cinco y **2** si no: un vigía cuyo control falla está ciego aunque mire.

### Comprobado
| corrida | resultado |
|---|---|
| `node scripts/equipo/parados.mjs --control` | ✅ los 5 casos, salida 0 |
| test nuevo + 1357b-f + `scrum824` | **71/71** tras arreglar mi propio test (abajo) |
| 52 ficheros de censos que barren `scripts/` y vecinos | 539/549. Los 10 caídos son `scrum1398` y `scrum381`: «falta `dist/`», árbol nuevo sin compilar, y este cambio no añade ningún `import` |

**El control del control** (el test): el control CAE, y nombra SOLO el caso que toca, con cada pieza rota
como un defecto que ya tuvimos. `leerPanel` que da `[]` cuando no pudo leer (el vigía del 13-oct) → cae
«panel que no se puede leer». `medir` que con el panel ciego contesta 0 → el mismo. `medir` que no mira
`needs`/`tempo` → cae «bloqueada que el panel da por working». `leerTrabajos` que se salta el ilegible →
cae «state.json ilegible». `medir` que revienta → los cinco 🔴 con «reventó», y el control no revienta.

**Mutación a mano** (Edit y vuelta, árbol limpio): con `--control` cayendo a la foto de verdad (sin su
`exit` y sin la guarda), el test «NO mira el panel de verdad» cae.

**Mi error, cazado por el test:** el chivato de «ha hecho la foto de verdad» buscaba `NO PUDE MIRAR` a secas,
y la descripción del cuarto caso lo lleva. Es la trampa de auto-referencia de siempre. Ahora busca lo que
sólo escribe la foto (`PARADOS · NO PUDE MIRAR`, `mirado a las`).

### Lo que NO hace
- No prueba el `claude agents --json` real: si el CLI cambia su forma, lo que lo dice es la propia foto
  (sale 2 con su motivo), no el control. El control prueba que LA LÓGICA ve lo que debe.
- No cubre TE ESPERA por `timeline.jsonl` ni APARCADO: ésos siguen en los tests de 1357c y 1357e.

## 19-oct-2026 · SCRUM-1357h · LA SALA pintaba seis verdes sin nadie vivo: el panel se comía el «no sé» del vigía

**Medido contra:** `origin/main` = `cd85e34b1e5bfaf561f010f550296bd94b659e75` · hora real 2026-10-19T06:49Z
(cabecera `Date:` de `gh api -i zen`; el reloj local va adelantado).

A9: aviso → cicatriz S5 «Dos parches a la sala (16 y 17-oct) fueron a una copia del plugin que no carga ninguna sesión: un mod se arregla en la copia que se CARGA (mods-yaqu, marketplace directory) y se comprueba con su chivato o con el log de VS Code, no leyendo el fichero» — no se pudo comprobar: el plugin vive fuera del repo y ningún test de la tanda lo ve

**Este tramo no cambia nada del repo** (salvo esta línea y su cicatriz). El arreglo vive en el plugin, que está fuera del repo
(`D:/MILLONARIO/cobroFlash/mods-yaqu/yaqu-sala/`, sin git). Aquí queda el registro. Tiene el OK del
orquestador a los seis puntos (19-oct, por mensaje), y el orquestador se lo cuenta al fundador.

### El defecto, medido
A las 06:36Z el fundador preguntó: «¿puede ser que LA SALA no funcione? Le doy a refrescar y me sale que
están trabajando, y ahora no está trabajando ninguno, ¿no?». Ese mismo minuto, `parados.mjs` decía:
«PUESTO(S) SIN NINGUNA SESIÓN VIVA: S0…S5».

- **Lo que mira el fundador es el PANEL** (`/panel`, el que tiene el botón «Refrescar»), no la línea de
  estado. El log de la extensión de VS Code (`…/exthost/Anthropic.claude-code/Claude VSCode.log`, que va con
  `--debug`) recoge a las 06:34Z `ui.render key=yaqu-sala#0` y `ui.press`, y a continuación una medida.
- **La línea de estado no dijo nunca «trabajando»**: son 608 repintados en 30 h y todos dicen «1 puesto(s)
  que atender». Ese «puesto» era el AVERIA del vigía retirado, contado como si fuera un puesto. No mentía en
  verde, pero estuvo 30 h sin decir nada útil.

**Primera causa: se carga OTRA COPIA del plugin.** El marketplace `yaqu` es de tipo `directory`
(`~/.claude/plugins/known_marketplaces.json` → `D:/MILLONARIO/cobroFlash/mods-yaqu`). Las sesiones cargan
`mods-yaqu/yaqu-sala/hooks/register.js` (del 9-oct). La de `~/.claude/plugins/cache/yaqu/yaqu-sala/0.1.0/`
no la carga ninguna. Los parches del 16-oct (código de salida, `VIGIA` → `sala.mjs`) y del 17-oct (APARCADO
de 1357e) se escribieron en esa copia de la caché: no corrieron NUNCA. Lo prueban tres cosas:
(a) `~/.claude/yaqu-sala-chivato.txt`, que sólo escribe la copia de mods-yaqu, lo reescribió una sesión de
hoy a las 06:40:29Z; (b) el log dice `node with 2 args`, y es la copia de mods-yaqu la que pasa `'14'`;
(c) el Pane sólo existe en esa copia. Y la caché compartida seguía diciendo «vigía RETIRADO» a las 06:46Z,
con los seis puestos ya arrancados: ninguno corría `sala.mjs`.

**Segunda causa:** esa copia apuntaba al `vigia2.mjs` del scratchpad, que es un stub desde el 17-oct: imprime
`AVERIA|vigía RETIRADO…` y sale 2.

**Tercera causa, la del verde:** `porPuesto()` sólo colocaba un renglón si su segundo campo era `s0`…`s5`,
tiraba todos los demás, y el Pane pintaba «✅ … trabajando» a cada puesto sin renglón. La línea `AVERIA` no
lleva puesto, así que se tiraba, y salían seis verdes **mientras el vigía decía que NO SABÍA**. Hay más:
`sala.mjs` escribe el puesto en MAYÚSCULA (`S0`), así que aunque hubiera apuntado a `sala.mjs`, también
habría tirado cada línea y pintado todo en verde.

🔴 **El test `sala.test.ts:237` («un renglón de un puesto desconocido se ignora, no rompe el panel») hacía
permanente el defecto.** Se ha cambiado porque **CONSAGRABA EL DEFECTO, no porque estorbe**. **NO es
arreglar un guard en rojo (regla 41): era un test que protegía el fallo.** Quien lo vea cambiado, que no
lo revierta: el texto viejo está en `sala.test.ts.bak-19oct-antes-de-s5`.

### Lo que entra (en `mods-yaqu/yaqu-sala/`, con `.bak-19oct-antes-de-s5` de los dos ficheros)
1. `VIGIA` → `D:/MILLONARIO/cobroFlash/_sala/scripts/equipo/sala.mjs`, sin el `'14'`.
2. **`juzgarVigia()`**: una línea `AVERIA|…` es una avería aunque vengan más líneas con ella. Sólo dos
   salidas cuentan como limpias: 0 sin avisos, o 1 con avisos. Cualquier otra (0 con avisos, 1 sin ninguno,
   2 sin la avería escrita, un código que falta) es «no cuadra, NO SÉ cómo está el equipo».
3. **`porPuesto()` ya no tira nada**: lee el puesto sin distinguir mayúsculas, admite varios avisos por
   puesto, y lo que no casa con ningún puesto va a `sueltas`, que el Pane enseña con «❔». **Ningún puesto sale
   ✅ si el vigía no salió limpio**: con avería, el puesto sin aviso sale «❔ no sé: el vigía no pudo mirar».
   APARCADO se pinta aparte («⏸») y no cuenta como aviso (lo de 1357e, portado ahora a la copia que corre).
4. **La hora de la medida va en todas partes**: en el Pane, en la línea de estado, en `/sala`, en `/panel` y
   en `/jefe` («medido a las 06:53Z (hace 0 min)»). Si el reloj se para, se nota que la medida es vieja.
5. La caché pasa a llamarse `~/.claude/yaqu-sala-cache-v2.json`. Así, lo que siga escribiendo una sesión
   arrancada con la copia vieja no lo lee ninguna sesión nueva.
6. Tests: se cambia el de :237 y se añaden seis: puesto en MAYÚSCULA → cae en su fila · `juzgarVigia` con el
   stub y con varias líneas · la tabla de códigos de salida · **stub → `/sala` dice NO PUDE MIRAR y nunca
   «trabajando»** · **lo mismo en `/panel`** · la hora de la medida.

La copia 0.1.0 de la caché **queda marcada como muerta y NO se borra**: lleva una cabecera en su
`register.js` y un `COPIA-MUERTA-LEEME.txt` al lado.

### Comprobado
| corrida | resultado |
|---|---|
| `claude plugin test .` ANTES (línea base) | 22/22 |
| `claude plugin test .` DESPUÉS | **28/28** |
| `claude plugin validate .` | ✔ (los avisos «gating hook without .catch» ya estaban antes) |
| los dos tests de comportamiento contra el `register.js` VIEJO | **los 2 caen**, con el texto exacto del verde falso: «🔴 1 puesto(s) que atender: · AVERIA\|vigía RETIRADO…» y ningún «NO PUDE MIRAR» |
| de punta a punta: `claude -p "/sala"`, que carga el plugin desde cero y corre el `sala.mjs` real | «medido a las 06:53Z (hace 0 min) · ✅ Los seis puestos trabajando», y ese verde es verdadero: `ListAgents` daba los seis `busy`. La caché v2 se escribe con su `cuando` |
| `sala.mjs` con un puesto caído (06:41Z, antes de que arrancara S0) | salida 2: `AVERIA\|no pude mirar 1 sesión(es)…` + `VACIO\|S0\|…`. Con el código nuevo esto sale «NO PUDE MIRAR» + la fila roja de S0, y ningún ✅ |

### Mis errores
- El orquestador sospechaba que el panel contaba por puesto y no por sesión. Le pedí que me contradijera si
  lo que veía decía otra cosa, y el log lo contradijo: la causa era otra y peor.
- No hay ningún test del DIBUJO del Pane. **No he intentado** llamar a `ui.render` desde el arnés de
  `claude plugin test`. Lo que sí está probado son sus entradas (`porPuesto`, `juzgarVigia`) y el texto de
  `/panel`, que sale del mismo `ultimo`. La prueba de verdad es que el fundador lo vea.

### Lo que NO hace
- **Sólo vale en las sesiones que arranquen DESPUÉS del cambio**: un mod se carga al arrancar. La sesión de
  VS Code del orquestador lleva abierta desde el 15-oct y **seguirá pintando verde hasta que se reinicie**.
  Las seis `sesion-N` de hoy también llevan la copia vieja hasta su relevo.
- `mods-yaqu` no está en git: el único historial son los `.bak`.
- La línea de estado sigue diciendo «los 6 trabajando» cuando el vigía sale 0 limpio. Eso es lo correcto,
  y ahora va con la hora de la medida.