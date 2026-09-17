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
| **F4 · Abrir sesiones nuevas** | 🔴 **no documentado** | Una sesión no puede abrir otro chat interactivo. Hasta que la S5 mida otra vía, **abrir un chat nuevo sigue siendo del fundador** (§5) |
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
- **Abrir un chat nuevo** de una sesión, mientras F4 no exista.
- **Aprobar un mensaje** si una sesión corre con otro modo de permisos y lo retiene.

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
