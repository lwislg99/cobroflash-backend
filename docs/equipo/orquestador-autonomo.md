17-sep-2026 10:55 CEST · medido sobre `origin/main = 1e7d6de20a94bc67cad1dd8b04f00acfb8ec1507` · worktree `wt-jefe`

# El orquestador autónomo — cómo funciona

> Lo pidió el fundador el 17-sep-2026: *«que tú hables con las sesiones y seas el jefe de verdad, y
> yo solo tenga que hablar contigo a veces para añadir tareas; que con rutinas o lo que sea te pongas
> a trabajar solo y enciendas al equipo»*. Esto es cómo se hace, qué está MEDIDO y qué falta.
> Ticket de lo que falta: **SCRUM-899** (carril de la Sesión 5).

## 1 · Antes y ahora, en una frase

**Antes:** sesión → fundador copia la respuesta → orquestador → fundador copia el prompt → sesión.
**Ahora:** sesión ⇄ orquestador directamente. El fundador habla solo con el orquestador, cuando
quiere añadir trabajo o tiene que decidir algo reservado para él (§5).

## 2 · Las piezas y su estado

| pieza | estado | cómo se sabe |
|---|---|---|
| **F1 · Canal directo** orquestador ⇄ sesiones | ✅ **FUNCIONA** | **Medido el 17-sep ~08:50Z:** el orquestador escribió a las 7 sesiones locales y **las seis contestaron por el mismo canal en minutos**, sin cortar su trabajo. Desde ese momento los encargos van por ahí |
| **F1b · Una sesión despierta al orquestador parado** | ✅ **FUNCIONA** | **Medido el 17-sep ~09:02Z:** el informe de la S5 abrió un turno del orquestador, que estaba parado, sin que el fundador escribiera nada. El bucle sesión → orquestador → sesión corre solo **mientras el chat del orquestador siga abierto** |
| **F2 · Nombres estables** | ⏳ SCRUM-899 | Hoy cada chat tiene un nombre automático (`cobroflash-backend-35`…) que **cambia si el chat se reanuda** (según la documentación, no medido). Con `/rename` se fija un nombre estable |
| **F3 · Saber cuándo termina una sesión** sin preguntar | 🟡 disponible, sin usar todavía | `SendMessage` con `notify_when_idle`: un aviso cuando la sesión se queda libre. Prohibido mandar mensajes de «¿has terminado?» |
| **F4 · Abrir sesiones nuevas** | ✅ **MEDIDO** (17-sep) | Ya no hace falta el fundador: el orquestador lanza la sesión con `claude --bg -n sesion-N --permission-mode auto`, y a los ~2 min se presenta sola por el canal (prueba de la S0, id `f4dfafd0`). ⚠️ **No sale en la barra de VS Code**: se ve con `claude agents --json` y se abre con `claude attach <id>`. El flujo entero, en **§5bis**; la norma, la **A19** («El PUESTO es fijo; la SESIÓN se releva»). Lo que sigue siendo del fundador son **las autorizaciones, que no se heredan** (§5bis.5) |
| **F5 · Arrancar solo por la mañana** | 🟡 **PROVISIONAL en marcha** · lo robusto en SCRUM-899 | **17-sep:** `CronCreate` en el chat del orquestador, trabajo `80667c74`, **todos los días a las 8:57, 13:57 y 18:57** (hora de Madrid), con la orden de arranque (leer §0, medir, despertar a las libres, Jira, traspaso). **Límites, medidos en la herramienta:** vive solo mientras ese chat esté abierto (no se guarda en disco), se dispara solo con el chat parado y **caduca a los 7 días (renovar antes del 24-sep)**. Lo robusto, a MEDIR por la S5: tarea programada de Windows + CLI `claude` (instalado, 2.1.263). Las rutinas en la nube no sirven para mandar al equipo: clonan GitHub desde cero y no ven los worktrees, los bancos ni los chats locales |
| **F6 · Trabajar mientras haya uso disponible** | ⏳ SCRUM-899 | La S5 leyó en la documentación el ajuste `autoContinueAtUsageLimit` (≥2.1.234): espera a que se renueve el límite y sigue. **No medido.** Las tres horas del cron de F5 están pensadas para caer en ventanas de uso distintas |

## 3 · El protocolo del canal

**Direcciones de hoy (17-sep, cambian si el chat se reanuda hasta que haya nombres fijos):**
`cobroflash-backend-bb` = orquestador · `35` = S0 · `40` = S1 · `9c` = S2 · `7d` = S3 · `02` = S4 ·
`b9` = S5 · `a3` = chat del orquestador ANTERIOR, parado, que no cuenta en el equipo. Antes de escribir,
`ListAgents`, y si una dirección no casa, se pregunta: «dime qué Sesión eres, en una línea».

**Del orquestador a una sesión:**
- La **primera línea** dice sesión · carril · ticket · qué es. Es lo único que se ve sin desplegar.
- Casado con su carril (`orquestador.md` §11bis) y **completo**: PASO 0, rojo, positivo, negativo,
  suelo y lo que no se toca (§4).
- Solo a quien ha entregado, o a quien hay que parar o avisar de algo que le cambia el trabajo. **Nunca
  «¿cómo vas?»**: para eso existe `notify_when_idle`.
- **Nunca se le pide a una sesión algo que al orquestador le han denegado.** Eso es saltarse el permiso
  del fundador por la puerta de al lado.

**De una sesión al orquestador:**
- Primera línea: **hora y SHA** (A14), ticket y estado en una frase.
- Informe completo detrás, incluido lo que NO ha mirado y sus errores (A9).
- Las sesiones **no se escriben entre ellas**: todo pasa por el orquestador. Así no hay bucles ni
  decisiones que nadie ve.

**Lo que se sigue haciendo en cada turno** (`orquestador.md` §0): cuadro del bucle, Jira (cerrar por
efecto, poner En curso), decidir lo delegado, traspaso en memoria y, **cuando el fundador aparece**,
explicarle en plano qué ha pasado y lo que es suyo AL FINAL.

## 4 · Lo que decide el orquestador solo

Todo lo que ya tenía delegado (`limites-del-fundador.md`): repartir por carril, firmar microcopy
(comentario de Jira con la firma delegada, que es lo que exige SCRUM-861), cerrar y reabrir tickets
por efecto, desatascar, y dar GO a empujar lo que NO toque lo de §5.

## 5 · Lo que SIEMPRE vuelve al fundador

- **Desplegar un arreglo del cobro**: el visto bueno de producto lo tiene delegado el orquestador (17-sep),
  pero el sí de EMPUJAR lo escribe el fundador en el chat de la sesión (§7). **Camino de emisión fiscal**
  : STOP, sin delegar.
- **Coste o dependencia nueva**: también rutinas o planes que gasten más. (la regla 36 del máster es otra cosa: plugins, skills y hooks de terceros; y la 38 dice que un test que solo LEE el camino fiscal NO es STOP. Estas reservas vienen de las STOP CONDITIONS de CLAUDE.md y de lo que el fundador ha dicho; se citaban mal, lo cazó la auditoría de la Sesión 0 del 17-sep).
- **Schema** (① decisión → ② ALTER de Javier → ③ PR) e **infraestructura de producción**.
- **Secretos**: nunca por el canal ni por el chat.
- ~~**Abrir un chat nuevo** de una sesión, mientras F4 no exista.~~ **SUPERADO el 17-sep-2026:** F4 está medido y la
  sesión nueva la lanza el orquestador (§5bis.6). Lo que sigue siendo del fundador no es abrir el chat, sino **las
  autorizaciones, que no se heredan** (A19 · §5bis.5).
- **Aprobar un mensaje** si una sesión corre con otro modo de permisos y lo retiene.

## 5bis · El relevo de sesión

La norma es la **A19 de `00-normas-comunes.md`, «El PUESTO es fijo; la SESIÓN se releva»**, que es de la Sesión 0 y
manda. Aquí **no se repite**: aquí va lo que es del orquestador —el cómo, el prompt y lo medido— y lo que la norma deja
abierto.

⚠️ **Se cita por número Y por título, a propósito.** `00-normas-comunes.md` lleva dentro el aviso de lo que cuesta lo
contrario: una norma renumerada rompe todo lo que la cite por posición. Hoy conviven ahí una A19 que es ésta y una A21
que **nació como A19**. Al leer, se comprueba el título, no el número.

### 5bis.1 · Cuándo se releva

Los tres casos son los de la A19 y no se amplían: entrega verificada con el contexto **por encima de 200k**; más de
**1 hora parada**; o el comienzo de la tanda del día siguiente. **Nunca a mitad de una entrega**, y **no en cada
tarea**: si una entrega cierra por debajo de 200k, el encargo siguiente entra en la misma sesión.

Para saber si pasa de 200k no se estima: se mide, con `sesion.mjs contexto N`.

### 5bis.2 · Cómo se releva

1. El orquestador **pide** el traspaso por el canal.
2. La sesión escribe `project_sN_traspaso.md` (**≤ 5 KB**) y su línea en `MEMORY.md` (**≤ 220 bytes**), contesta
   **«traspaso listo»** y **para**. Los dos topes y por qué, en 5bis.3bis.
3. El orquestador la **detiene** y lanza la nueva **con el encargo dentro del mismo prompt**.
4. La nueva lee desde `origin/main` lo suyo y se presenta: «Sesión N lista · <siguiente paso>».

🔴 **Se releva, NO se reanuda.** `--resume` con flags arranca una COPIA, y sin flags arrastra la caché vieja entera
(medido en SCRUM-899, control 3b). Una sesión nueva con su traspaso cuesta mucho menos que un contexto de 800k, que es
donde acabó la tanda del 17-sep.

🔴 **No se para a nadie sin traspaso.** Parar antes pierde justo lo que el relevo existe para conservar, y encima en
silencio: la nueva arranca creyéndose al día. Si el traspaso no está, se dice y no se para.

### 5bis.3 · El prompt estándar

Siete bloques, y **el encargo va dentro**:

1. quién es y cuál es su **puesto fijo**;
2. el arranque **barato** de 5bis.3bis (SCRUM-996): `git fetch`, las normas por secciones con `norma.mjs`, su
   `sesion-N.md`, SU fila de §11bis (no el fichero entero) y su traspaso, **midiendo antes de creérselo**;
3. presentarse por el canal con **hora y SHA** (A14);
4. **el encargo concreto, completo**;
5. las normas de la tanda, incluida la A19: las autorizaciones no se heredan;
6. las **trampas del entorno**: `FORCE_COLOR=0` en todo (SCRUM-928), dónde está `gh`, el cloudId de Jira;
7. qué hacer al cierre.

Sin el punto 4 la sesión arranca sin trabajo y gasta contexto preguntando qué hacer.

### 5bis.3bis · El arranque barato (SCRUM-996, 21-sep-2026)

**Por qué.** El fundador dijo que el gasto no es sostenible. Medido sobre 44-46 sesiones de 24 h (herramienta:
`node scripts/equipo/gasto-arranque.mjs sesiones`): el **suelo** del primer mensaje son 54-59k tokens y la **lectura del
arranque** otros 43-67k, y los dos se releen en CADA turno. Juntos son el 40,7 % de todo el contexto procesado (≈ 34,5 %
del coste con pesos de precio SUPUESTOS: escritura 1,25, lectura 0,1, salida 5). De esa lectura, las normas enteras son
~25k (51,8 KB) y el traspaso medio pesa 11,4 KB. Aparte, los resultados de herramientas de ≥ 6 KB son el 7,8 % de las
llamadas y el 21 % del coste.

**Bloque 2 del prompt, para pegar tal cual** (sustituye a «lee `00-normas-comunes.md`, `CLAUDE.md`…»):

```
ARRANQUE BARATO (SCRUM-996)
1. `git fetch origin`. CLAUDE.md: si `git rev-list --count HEAD..origin/main` da 0, ya lo tienes cargado y NO lo releas;
   si no, léelo desde origin/main.
2. Normas: `node scripts/equipo/norma.mjs --arranque` (14 secciones + el índice de las otras 11). NO leas
   `00-normas-comunes.md` entero: lo demás se trae al vuelo, p. ej. `node scripts/equipo/norma.mjs A23` antes de
   escribir un guard. Si ese script no existe en tu carpeta: `cmd /c "git show origin/main:scripts/equipo/norma.mjs >
   %TEMP%\norma.mjs"` y `node %TEMP%\norma.mjs --arranque`.
3. Tu ficha `docs/equipo/sesion-N.md`; tu FILA de §11bis con `git grep -n -E "^\| \*\*S<N>\*\* \|" origin/main --
   docs/equipo/orquestador.md` (no leas el fichero entero); y tu traspaso `project_sN_traspaso.md`. El
   `project_sN_historial.md` NO se lee salvo que el traspaso te mande a él.
4. LECTURAS: ningún Read de más de 6 KB sin offset/limit fuera de este arranque; Grep antes que leer un fichero entero
   para buscar una línea; las salidas largas de PowerShell, a un fichero y con solo el resumen en pantalla.
5. AL CERRAR: traspaso ≤ 5 KB (`node scripts/equipo/gasto-arranque.mjs traspaso sN`; si excede, lo histórico y las
   trampas van a `project_sN_historial.md`) y tu línea de MEMORY.md ≤ 220 bytes.
```

**Cómo se comprueba, por efecto** (no por lo que digan los ficheros): tras un relevo,
`node scripts/equipo/gasto-arranque.mjs sesiones --desde <hora ISO con Z del relevo> --min-turnos 8` da el turno 8 de
las sesiones nuevas y lo compara con el criterio de SCRUM-996: **U8 mediano ≤ 90.000** y **lectura de arranque ≤ 10 %
del contexto procesado**. Sale con 0 si cumple, 1 si no, 2 si no vio ninguna sesión.

**Qué NO hace esto**, dicho para que nadie lo dé por bueno de más: no toca `sesion.mjs`, `prompt-tanda-orquestador.md`
ni ninguna copia de `%LOCALAPPDATA%\yaqu-equipo` (la puerta de integridad de `sesion.mjs` exige que sean idénticas a
`origin/main`, así que tocarlas obliga a reinstalar). El tope de 5 KB del traspaso lo comprueba quien lo escribe, con
`gasto-arranque.mjs traspaso`, y **no** el relevo: avisar también desde `relevar` obliga a tocar `sesion.mjs` y queda
para la próxima instalación. Y la A19 de `00-normas-comunes.md` (dueña: la Sesión 0) sigue sin decir nada del tope de
5 KB: la propuesta va a la S0 en `docs/master/SCRUM-996.md`.

### 5bis.4 · Solo se lanzan sesiones CON TRABAJO

Los seis **puestos** existen siempre; las seis **sesiones**, no. Un puesto sin cola no se levanta: una sesión viva sin
encargo gasta uso y contesta mensajes que no llevan a nada.

### 5bis.5 · 🔴 Las autorizaciones NO se heredan

Está en la A19, y se repite aquí porque es lo primero que se salta al automatizar. Un GO de dinero, un alta en un
servicio de terceros o un borrado que el fundador autorizó en el chat de una sesión valen **para esa sesión**. La nueva
no los usa hasta que se los escriban a ella.

Con el matiz medido el 17-sep: **ni un «acepto» dicho de pasada basta**. Lo que el clasificador mide es una
autorización **expresa y literal** en ese chat. El orquestador pide la frase exacta, y solo con ella actúa él mismo.

Corolario para cualquier regla duradera: **no se nombra un chat por su nombre automático**. `cobroflash-backend-bb` era
el chat de una mañana y dejó de existir el mismo día. Se nombra el papel: «la sesión que el fundador haya designado
orquestador, se llame como se llame».

### 5bis.6 · Lo MEDIDO de `claude --bg` (17-sep-2026)

Prueba de relevo de la S0, `claude --bg -n 0 --permission-mode auto`, id `f4dfafd0`, ~14:57Z:

| qué | resultado |
|---|---|
| ¿sale en la barra de VS Code? | **NO.** Quien la busque ahí concluirá que no arrancó |
| cómo se ve | **`claude agents --json`** (sin TTY, `--json` es obligatorio) |
| cómo se abre su chat | **`claude attach <id>`** |
| cuánto tardó en presentarse | **~2 min**, por el canal, sola |
| nombre | convención **`sesion-N`**, que ES la dirección de `SendMessage` |

Esto es lo que cierra **F4**: una sesión ya no necesita al fundador para abrir otra.

## 5ter · Cierre y arranque por FIN DE USO

Hasta el 17-sep esto solo vivía en la memoria del orquestador. Se escribe porque es precisamente lo que se pierde si el
uso se corta de golpe: lo que no está escrito, no existe.

**Al acercarse el límite de uso, el orquestador:**

1. **pide el traspaso** a cada puesto vivo (A19) y espera el «traspaso listo»;
2. **escribe el suyo** —el del orquestador— para quien no ha visto su chat;
3. **borra sus crones**: un `CronCreate` vive solo mientras ese chat esté abierto y caduca a los 7 días, así que dejarlo
   puesto no da arranque y sí da la falsa sensación de que lo hay;
4. le deja al fundador, **en un bloque listo para pegar, el prompt del orquestador nuevo**.

**Al volver, el orquestador nuevo:**

1. **mide** antes de creerse ningún traspaso (§0 de `orquestador.md`): PR abiertos y mergeados, CI, Jira, `ListAgents`.
   Un traspaso es una foto con fecha, no el ahora;
   - 🔴 **y corre el censo de huérfanos** (SCRUM-946), que es lo que ningún traspaso puede contar porque lo dejó quien
     ya no pudo escribirlo:

         node scripts/equipo/huerfanos.mjs

     Lista los worktrees con commits que no están en NINGÚN remoto (siempre) y los que tienen cambios sin commitear
     tocados en las últimas 72 h; los más viejos los cuenta sin listarlos. Sale con 0 (nada), 1 (hay algo) o 2 (algún
     worktree no se pudo mirar: eso NO es «limpio»). Solo lee: no empuja, no borra, no cambia de rama.
     Cada línea de la lista se casa con un puesto y va en su encargo. El 17-sep la tanda murió sin aviso por el límite
     de uso de la cuenta y dejó tres trabajos que nadie sabía que existían; con este paso habrían salido en una lista.
2. **para las sesiones viejas**. Siguen vivas con su contexto entero y contestarían con un estado caducado;
3. **levanta los seis puestos**, cada uno con su encargo dentro del prompt (§5bis.3), y solo los que tienen trabajo
   (§5bis.4).

🔴 **Éste es también el momento de aplicar los cambios de settings y la instalación del arranque automático.** El
fundador dijo el 17-sep que no se para ni se releva a nadie si no es por nuestras propias normas; así que la instalación
**no interrumpe a nadie a mitad**: se hace en el relevo natural —fin de tanda o cierre por uso—, que es cuando las
sesiones están paradas de todos modos.

## 6 · Riesgos, dichos antes de que pasen

- **Coste en tokens.** Cada mensaje cuenta como un prompt, y lo caro es arrastrar un contexto grande
  (A19). Mensajes cortos, con la primera línea útil, y solo los necesarios.
- **Dos orquestadores sobre el mismo Jira.** El 17-sep una sesión de Javier cogió SCRUM-890, que estaba
  en «Tareas por hacer» mientras nuestra S4 hacía su PR 2, y lo cerró. La única defensa es **A13 sin
  excepciones**: el ticket que se trabaja está En curso y asignado, y el orquestador lo comprueba en
  cada turno.
- **Silencio no es acuerdo.** Una entrega no está recibida hasta que llega por el canal. Si una sesión
  no contesta, se mira `ListAgents` (ocupada, libre o desaparecida) antes de suponer nada.
- **Un nombre automático caduca.** Mientras no haya nombres fijos (F2), una dirección vieja puede ser
  otro chat. Si no casa, se pregunta.

## 7 · Lo que el sistema de permisos NO deja hacer al orquestador (medido el 17-sep-2026)

Cada uno salió bloqueado por el clasificador de permisos de Claude Code. **Ninguno se rodea**: se le pasa
al fundador con los pasos exactos, uno a uno. Pedirle a una sesión que haga lo que al orquestador le han
denegado es saltarse el permiso del fundador por la puerta de al lado.

| lo que se intentó | motivo del bloqueo | quién lo hace entonces |
|---|---|---|
| Añadir una regla de permiso en `.claude/settings.local.json` (para SCRUM-899) | *Self-Modification* | El **fundador**, a mano |
| Lanzar sesiones de Claude en segundo plano (`claude --bg`, incluso `claude agents --help`) desde la S5 | *Create Unsafe Agents* | Con una regla de permiso acotada que pone el fundador |
| Dar por el canal el «adelante, empuja» a un PR del camino del cobro con auto-merge (empujar = desplegar a producción) | *Production Deploy* | El **fundador escribe el sí en el chat de esa sesión**. El orquestador prepara, revisa y se lo explica en plano |
| Un comentario de firma en Jira (SCRUM-890) | *External System Writes*, **una vez**; el mismo comentario, repetido más tarde por petición expresa del fundador, pasó | Si se bloquea, lo pega el fundador |

**Medido después, el mismo 17-sep (~09:38Z):** cuando el fundador escribió en el chat del orquestador una autorización EXPRESA para esas dos acciones («te doy todos los permisos para hacerlo»), la regla de permiso se añadió con Edit y el aviso de despliegue a la S1 pasó. Lo que el clasificador frena es la acción sin autorización expresa del fundador en ese chat. La regla de la casa: el orquestador pide la autorización expresa en una línea, y solo con ella lo hace él mismo. Nunca se rodea sin ella.

🔒 Un bloqueo de permisos no es un fallo a arreglar: es la raya que el fundador aún no ha movido.
