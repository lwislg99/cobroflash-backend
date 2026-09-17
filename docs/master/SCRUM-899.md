# SCRUM-899 · Orquestador autónomo: el equipo arranca solo y trabaja por tandas

**Fecha:** 17-sep-2026 · **Carril:** S5 · automatización
**Medido contra:** `origin/main` = `2be8fe16a3245322e64837f789189875e0c9f560` · 2026-09-17T13:21:12Z
**Rama:** `scrum-899-orquestador-autonomo`
**Horas:** las locales del equipo cuando se dice «local» (el reloj local va ~5 min adelantado); el resto, de GitHub.

## ① Mediciones (claude 2.1.263, Windows; reglas `control-899-*` autorizadas por el fundador)

| # | Control | Resultado |
|---|---|---|
| 1 | `claude --bg -n control-899-nombre --permission-mode plan` + SendMessage por nombre | sale en `ListAgents` con ese nombre a los ~25 s; **no contesta**: `blocked`, `waitingFor: permission prompt` |
| 2 | igual, con `--permission-mode auto` (d521a2f6) | **contesta** por nombre sin aprobaciones |
| 3a | `--resume <id corto>` | copia (ee85231a) parada en el **selector interactivo** («No sessions match»; lo leyó el orquestador con `claude logs`) |
| 3b | `--resume <sessionId completo>` + flags | copia (eac28c28): «keeps its own saved options, so the flags you passed started a copy… Without flags, the same command continues it». Trae la conversación, conserva el nombre e inicia SendMessage sola |
| 4 | `MSYS_NO_PATHCONV=1 schtasks /create /sc once` → `.cmd` → `claude --bg -n control-899-arranque --permission-mode auto` | disparo a las 12:02:43 locales; servicio de fondo ~74 s; la sesión (ddfe6153) **escribe por el canal sin ningún chat abierto** |
| 5 | `autoContinueAtUsageLimit` | no está en ningún settings. En el binario es un ajuste de usuario (`/config`), apagable por una bandera remota: «wait for the limit to reset and continue… When off, the limit dialog offers the wait as a choice». **No medido en un límite real** |

Bloqueos por el camino, no rodeados:
- `claude stop/rm` exigen el id, no el nombre;
- `schtasks` desde PowerShell → clasificador («Unauthorized Persistence»);
- en Git Bash, sin `MSYS_NO_PATHCONV=1`, MSYS convierte `/create` en una ruta.

Limpieza: 0 sesiones `control-899`; la tarea `control-899-arranque` no existe (`schtasks /query`).

**Reglas de diseño:** nada interactivo en segundo plano; ids completos; reanudar sin flags; modo `auto`.

## ② Diseño aprobado (orquestador, 17-sep 13:25 CEST)

- Tandas diarias a las 08:00, 13:05 y 18:10. La tarea la crea el orquestador con la autorización expresa del fundador.
- Una sesión por carril, la de fondo.
- Los scripts se instalan desde `origin/main` fuera del repo y se niegan a actuar si difieren.

## ③ Hito 1 · `scripts/equipo/sesion.mjs`

- Lista blanca `^(orquestador|sesion-[0-5])$`.
- Lanzar: nueva en modo `auto`, o reanudar con el sessionId completo y sin flags si la anterior lleva ≤1 h parada.
- Parar: por id, solo si el nombre casa y es de fondo.
- Una sesión viva bloqueada se DICE (`BLOQUEADA`); no se rodea.
- **Puerta de integridad:** `DESDE-UN-ARBOL` si corre dentro de un árbol de git; `ALTERADO` si su contenido difiere de `origin/main:scripts/equipo/sesion.mjs`; `NO-PUDE-MIRAR` sin `config.json` o sin `origin/main`.
  ⚠️ Protege de una copia desfasada o tocada por accidente, **no de una reescritura deliberada**: quien reescribe el fichero puede quitarle la comprobación.

`tests/scrum899-sesion-lista-blanca.test.mjs`: repo git real con `origin/main`, copia instalada con `git show` y un `claude` falso que deja constancia si lo llaman.
- 9/9 en verde.
- **Cinco mutaciones declaradas, las cinco caen** (pasada local, fichero restaurado byte a byte): integridad apagada · árbol apagado · lista blanca `^.+$` · reanudar con flags · modo `bypassPermissions`.
- Guards de población: 140 ficheros, 1332 tests, 0 fail.

⚠️ **Error mío, cazado por CI:** el hito 1 se empujó (`0e40830e`) tras correr **solo ese subconjunto**, no la suite
entera. CI 35208941163 (`build + tests`) cayó en tres guards que el subconjunto no incluía:
- **SCRUM-237:** `doesNotMatch(/dangerously|bypass/)` sin hermano positivo;
- **SCRUM-723:** los `show` de `origin/main` de los repositorios sintéticos, sin declarar;
- **SCRUM-824:** `config.json` escrito en `path.join(b.repo, …)`, que el clasificador no puede probar temporal.

Los arregló el bot de Claude (`746916c4`, 10:23:20Z, despertado por el avisador), y #1412 entró en `main` a las
10:30:31Z. Mis arreglos, hechos en paralelo, chocaron con los suyos al mergear; se resolvió conservando lo suyo:
- mi `config.json` escrito dentro de `banco()` hace probable el temporal, así que `scrum899-sesion` **sale** de
  `SIN_PROBAR_CONOCIDOS` de SCRUM-824 (el bot lo había añadido);
- en SCRUM-723 se queda su declaración de indirectas y se añade la de `899b`.

⚠️ **Segundo error mío, la trampa de siempre:** empujé el hito 2 a `scrum-899-orquestador-autonomo` DESPUÉS de que #1412 se
mergeara y la rama se auto-borrara. El push la **recreó** y «PR automático» abrió **#1418**. Fue el final de una cadena
con `;`: el merge había fallado y el push se ejecutó igual. #1418 se queda como el PR del hito 2.
Desde entonces: la suite completa antes de cada push, y `ls-remote` + estado del PR como condición del push, no en otra orden.

## ④ Hito 2 · la tanda programada

- **`scripts/equipo/orquestador-arranque.mjs`:**
  - comprueba que no corre desde un árbol y que hay `config.json`;
  - compara **por bytes** contra `origin/main` su propia copia y la de `sesion.mjs`;
  - exige el prompt de la tanda y delega en `sesion.mjs lanzar orquestador`.
  🔴 **No importa `sesion.mjs`** para reutilizar su puerta: importar ejecuta el módulo, así que una copia alterada
  correría código antes de comprobarla. Lo cacé leyendo mi primera versión, antes de probarla.
- **`scripts/equipo/instalar.mjs`:**
  - escribe `config.json` ({ repo, claude }) y `arranque.cmd`, que en cada tanda hace `git fetch` + `git show origin/main:`
    de `sesion.mjs`, `orquestador-arranque.mjs` y `docs/equipo/prompt-tanda-orquestador.md`, y lanza el arranque;
  - **imprime** las órdenes de `schtasks` (tres diarias: 08:00, 13:05, 18:10); **no las ejecuta**.
  - 🔴 `arranque.cmd` hace **`cd /d <repo>`** antes de lanzar. Una tarea programada arranca en `System32`, y sin eso el
    orquestador nacería fuera del proyecto: sin sus settings ni su CLAUDE.md, y con el diálogo de confianza de carpeta,
    que en segundo plano bloquea. El control 4 funcionó porque su `.cmd` de prueba SÍ lo hacía; se me escapó al escribir
    el generador y lo cacé al preparar la orden de instalación. Tiene aserto y mutación (cuatro en total, las cuatro caen).
- **El prompt de la tanda lo escribe el orquestador:** `docs/equipo/prompt-tanda-orquestador.md`. Sin él, la tanda
  dice NO PUDE MIRAR y no lanza nada.
- ⚠️ **Límite:** si el orquestador de fondo está vivo y parado, la tanda contesta `YA-VIVA` y no lo despierta:
  reanudar una sesión viva arranca una copia. Eso lo cubre su cron interno; la tarea programada lo resucita si no existe.

`tests/scrum899b-arranque-de-la-tanda.test.mjs`: la tanda ENTERA sobre copias instaladas desde un `origin/main` de
banco, con un `claude` falso con estado.
- **POSITIVO:** lanza `orquestador` en modo `auto` con el prompt de main y deja el sessionId completo en el registro.
- Una segunda tanda con el orquestador vivo → `YA-VIVA`, sin segundo lanzamiento.
- **ROJO:** arranque alterado y `sesion.mjs` alterado → `ALTERADO`, cero llamadas a `claude`.
- **SUELO:** sin prompt → NO PUDE MIRAR, cero llamadas.
- `arranque.cmd` y órdenes de `schtasks` fijados.
- **Tres mutaciones declaradas, las tres caen**; las cinco del hito 1 re-verificadas tras tocar su test.

**Tanda completa** (local, sobre `373e9b1f`): 7282 tests, 7172 pass, 0 fail, 110 skipped.

**Tanda completa tras mergear main** (`2be8fe16`, que ya trae el prompt de la tanda, #1419): 7317 tests, 7206 pass,
**1 fail**, 110 skipped. El fallo es SCRUM-804 («la agrupación no pierde ni inventa ramas: `scrum-904 → SCRUM-904`»): lee
las ramas REMOTAS vivas, y existe `origin/scrum-904`, sin sufijo. **Control:** en un árbol limpio de `origin/main`
(`2be8fe16`, sin nada de este PR), los dos ficheros de SCRUM-804 dan exactamente el mismo fallo. Es del entorno, no de
este cambio, que no toca nada de 804.

## ⑤ A19 · el relevo de sesión, escrito en las normas (Sesión 0)

**Medido contra:** `origin/main` = `45eb9b8a97840a8306d494b3d85073e5e7b88756` · 2026-09-17T15:24:27Z

**Encargo del orquestador** (17-sep, por el canal): reescribir la A19 de `docs/equipo/00-normas-comunes.md` con el
flujo de relevo que el fundador decidió tras la prueba de este ticket. Dentro:
- puesto fijo y sesión desechable;
- cuándo se releva y cuándo no;
- la plantilla del traspaso;
- «traspaso listo» por el canal, y parar;
- las autorizaciones que no se heredan.

Con el ajuste del fundador (~15:30Z): **no en cada tarea**, sino al terminar una entrega si el contexto pasa de 300k,
tras más de 1 h parada o al empezar la tanda del día siguiente; y siempre con seis puestos ocupados.

**Qué cambia (solo `docs/`):**
- `docs/equipo/00-normas-comunes.md`: A19 reescrita y con la historia conservada. La versión del 16-sep queda citada
  como SUPERADA, sin borrar sus tres correcciones ni la medición de tokens. A14, punto 3, pasa a nombrar el aviso
  «traspaso listo».
- `docs/equipo/traspaso.md` §3bis: la entrada «A19 (chat nuevo)» queda marcada SUPERADA, con fecha y motivo.
- `docs/equipo/afirmaciones-verificadas.md`: en la fila de la medición de tokens del 16-sep, la lectura «mismo chat»
  queda marcada SUPERADA; la medición no cambia.

**Revisado sin cambios:** `sesion-0.md` … `sesion-5.md` no dicen «mismo chat» ni «chat nuevo».
- Comando: `grep -n "chat\|300k\|200k\|relev" docs/equipo/sesion-*.md`. Da 0 coincidencias.
- **Suelo:** la misma búsqueda sobre `traspaso.md` y `afirmaciones-verificadas.md` SÍ encuentra las líneas 55, 57 y 59,
  así que no está ciega.

**Visto y NO tocado, por carril:**
- `orquestador.md` (líneas 40-41 y 283-284: «chat nuevo» y «↩️ MISMO CHAT»). Es el método del orquestador y su §0 lo
  reescribe él.
- `orquestador-autonomo.md` (F4 «abrir sesiones nuevas… sigue siendo del fundador», líneas 24 y 68). Es de la S5.

Los dos siguen describiendo el flujo anterior.

**Lo que no está medido:** las frases del fundador llegan transmitidas por el orquestador y por la memoria del proyecto
(`feedback_relevo_sesion_fresca.md`), no citadas del chat del fundador. La norma lo declara.

## ⑥ Hito 3, punto 1 · el relevo escrito en el método del orquestador (SOLO DOCS)

**Medido contra:** `origin/main` = `f5977e8c6d33a436d6d43fd20e345b12120c3977` · 2026-09-17T19:02:28Z

La A19 la escribió la S0 en `00-normas-comunes.md` (#1449). **Ese fichero NO se toca aquí: es suyo.** Lo que faltaba era
el otro lado: los dos documentos del orquestador seguían describiendo el flujo anterior, y la S0 los dejó marcados
como «visto y NO tocado, por carril» en ⑤. Esto los alinea.

**Se cita la A19 por NÚMERO Y POR TÍTULO, y no se repite su contenido.**

🔴 **Trampa que casi me come, y por eso el título va siempre al lado del número.** El encargo decía «la A19 nueva», y al
leer `00-normas-comunes.md` aparece una nota —`⚠️ Nació como A19 y se renumeró a A21`— que parece decir que la norma del
relevo se movió. **No es así:** esa nota pertenece a OTRA norma (la de la cobaya, hoy A21). El índice real de
`origin/main` es A19 = «El PUESTO es fijo; la SESIÓN se releva» · A20 = fuera de carril · A21 = la cobaya. Si llego a
citar «A21» por creerme la nota, habría mandado a todo el mundo a la norma equivocada. El propio fichero lo dice mejor
que yo:

    🔒 Referenciar por posición caduca. Referenciar por identidad no.

**Qué cambia (solo `docs/`):**

- **`docs/equipo/orquestador-autonomo.md`:**
  - **§5bis nueva, «El relevo de sesión»**: cuándo (los tres casos de la A19, sin ampliarlos), cómo, el **prompt
    estándar de siete bloques con el encargo DENTRO**, que solo se lanzan sesiones con trabajo, que las autorizaciones
    no se heredan, y lo **medido** de `claude --bg` en la prueba de la S0 (`f4dfafd0`, ~14:57Z): **no sale en la barra
    de VS Code**, se ve con `claude agents --json`, se abre con `claude attach <id>`, se presentó sola en ~2 min, y la
    convención `sesion-N` es la dirección de `SendMessage`.
  - **§5ter nueva, «Cierre y arranque por FIN DE USO»**: lo que hasta hoy solo vivía en la memoria del orquestador —
    pedir traspaso, escribir el suyo, **borrar sus crones** y dejarle al fundador el prompt del orquestador nuevo; y al
    volver, **medir, parar las viejas y levantar los seis puestos**. Se escribe precisamente porque es lo que se pierde
    si el uso se corta de golpe.
  - **F4 (tabla §2)**: 🔴 «no documentado» → ✅ **MEDIDO**. Ya no hace falta el fundador para abrir una sesión.
  - **§5**: la viñeta «abrir un chat nuevo… mientras F4 no exista» queda **tachada y marcada SUPERADA**, con el puntero
    a lo que SÍ sigue siendo del fundador: las autorizaciones.
- **`docs/equipo/orquestador.md`:**
  - **§0, paso 5bis nuevo del turno: «RELEVAR EN VEZ DE REANUDAR»**, con el umbral de 300k medido, no estimado.
  - **§0, paso 5**: «si hace falta un chat nuevo se le pide al fundador» → ya no; lo lanza el orquestador.
  - **regla 11bis (16-sep)**: se **conserva entera**, incluida la frase «los puestos no se cierran nunca: lo que se
    cierra es el chat», que es la A19 dicha con un día de antelación. Se le añade que el camino normal ya no es pegar un
    prompt, y que la regla sigue valiendo para los que el fundador SÍ pega a mano.
  - **§11bis, fila S5**: puesto «automatización» → **«automatización y eficiencia»**, con el gasto de tokens y los
    fallos del flujo en el carril, y `scripts/equipo/` entre sus ficheros. El ⚠️ de las dos fuentes que se
    contradecían queda cerrado.
- **`docs/equipo/sesion-5.md`**: la cabecera pasa a **AUTOMATIZACIÓN Y EFICIENCIA** (ajuste del fundador).

**Lo que NO se toca, por carril:** `00-normas-comunes.md` (S0) y `traspaso.md`.

**Tres cosas que entran aquí y vienen del orquestador, no de mí:**
1. la instalación del arranque automático **se aplica en el relevo natural**, no parando a nadie a mitad — el fundador
   dijo el 17-sep que no se releva si no es por nuestras propias normas;
2. **ni un «acepto» de pasada basta**: el clasificador mide una autorización **expresa y literal** en ese chat;
3. **una regla duradera no nombra un chat por su nombre automático.** `cobroflash-backend-bb` dejó de existir el mismo
   día en que se escribió; se nombra el papel.

**Verificación:** es un PR solo de `docs/`. `guards:entrada` en verde y la tanda completa, porque un cambio de texto
también puede tumbar un guard estructural (SCRUM-242 nombra documentos que no existen; SCRUM-391, tests declarados).

**Tests declarados:** ninguno nuevo. Este punto no añade código.
