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
| **F2 · Nombres estables** | ⏳ SCRUM-899 | Hoy cada chat tiene un nombre automático (`cobroflash-backend-35`…) que **cambia si el chat se reanuda** (según la documentación, no medido). Con `/rename` se fija un nombre estable |
| **F3 · Saber cuándo termina una sesión** sin preguntar | 🟡 disponible, sin usar todavía | `SendMessage` con `notify_when_idle`: un aviso cuando la sesión se queda libre. Prohibido mandar mensajes de «¿has terminado?» |
| **F4 · Abrir sesiones nuevas** | 🔴 **no documentado** | Una sesión no puede abrir otro chat interactivo. Hasta que la S5 mida otra vía, **abrir un chat nuevo sigue siendo del fundador** (§5) |
| **F5 · Arrancar solo por la mañana** | ⏳ SCRUM-899 | Opciones según la documentación, a MEDIR en local: `/loop` (local, el chat tiene que seguir abierto), tareas programadas de escritorio (locales) y rutinas en la nube (clonan el repo desde cero, sin worktrees ni bancos locales, y gastan del mismo uso de la suscripción) |
| **F6 · Trabajar mientras haya uso disponible** | ⏳ SCRUM-899 | No hay forma documentada de «seguir cuando se renueve el límite». Se diseñará con horas fijas y un parar limpio |

## 3 · El protocolo del canal

**Direcciones de hoy (17-sep, cambian si el chat se reanuda hasta que haya nombres fijos):**
`cobroflash-backend-bb` = orquestador · `35` = S0 · `40` = S1 · `9c` = S2 · `7d` = S3 · `02` = S4 ·
`b9` = S5. Antes de escribir, `ListAgents`, y si una dirección no casa, se pregunta: «dime qué Sesión
eres, en una línea».

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

- **Dinero y camino fiscal** (regla 38): el orquestador revisa, se lo explica en plano y **espera su GO**
  antes de que la sesión empuje.
- **Coste o dependencia nueva** (regla 36): también rutinas o planes que gasten más.
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
