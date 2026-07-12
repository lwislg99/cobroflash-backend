# FLUJO DE TRABAJO YAQU — Cómo construimos
> Documento de PROCESO, no de producto. El producto (estrategia, reglas, estados) vive en
> YAQU_MASTER.md. Esto es CÓMO trabajamos para construirlo sin romper nada.
> Última revisión: jul-2026 (flujo de ramas + PR, y trabajo en equipo). Se mejora con la
> experiencia; nunca se borra, se añade.

---

## LOS TRES ROLES (quién hace qué)
- **Claude asesor (el chat):** CTO/CPO. Estrategia, reconocimiento del código, escribe los
  prompts EXACTOS para Claude Code, valida lo que vuelve, gestiona Jira. Brutalmente honesto.
  Propone opciones; NO decide negocio.
- **Claude Code (repo en Windows):** ejecuta el código. Una tarea → un commit. Enseña el plan
  antes de tocar. Para en zonas sensibles y pide OK.
- **Fundador (Tu) / compañeros de equipo:** deciden TODO. Son el puente entre los dos. Verifican
  en producción. Las decisiones de negocio, las aprobaciones de dinero y el **merge de los PR**
  son siempre suyas.

---

## EL BUCLE (una tarea, de principio a fin)
0. **Partir de lo último:** `git checkout main && git pull` ANTES de empezar (por si un
   compañero mergeó algo). Elegir la siguiente tarea por ORDEN DE DEPENDENCIAS.
1. **RECONOCIMIENTO primero (solo lectura).** Claude Code inspecciona el código REAL antes de
   construir nada. Prompt de "no toques nada, solo repórtame X".
2. **Con el reconocimiento, Claude asesor:** (a) afina el ALCANCE del ticket en Jira si ha
   cambiado, y (b) escribe el brief afinado en `docs/Sprint Scrum/SESION_ACTUAL_SCRUM-<n>.md`
   contra el código real (un archivo POR TAREA).
3. **Se pega a Claude Code el prompt corto** (apunta al brief de esa tarea +
   `docs/YAQU_MASTER.md` + el ticket de Jira).
4. **Claude Code crea la RAMA de la tarea** (`git checkout -b scrum-<n>-<slug>`) y enseña
   PLAN + diff ANTES de tocar código. En zonas de dinero/fiscal/webhooks: PARA, enseña el
   código EXACTO que insertará, y espera OK.
5. **Se trae el plan/código a Claude asesor → se valida → se aprueba.**
6. **Claude Code ejecuta en la rama:** commit de feature (UNO) + commit del máster APARTE,
   AMBOS en la rama de la tarea. **NO push directo a `main` (está protegida).**
7. **Claude Code sube la rama y abre un Pull Request a `main`** (`git push -u origin <rama>`
   + PR con título "SCRUM-<n> · <resumen>" y descripción corta). El PR incluye la feature y
   el máster.
8. **Un humano revisa el PR y hace MERGE** (fundador o compañero). El merge es el que mete la
   feature + el máster en `main`. **Claude nunca mergea a producción.**
9. **Verificación en yaqu.app (PRODUCCIÓN), no localhost.** UI con login = la verifica un
   humano con sus ojos sobre datos reales. (Railway despliega desde `main` tras el merge.)
10. **Ticket a "En revisión" (con el ENLACE del PR) → verificación en prod → "Finalizada".**
11. **Hallazgos por el camino** (deuda, necesidades nuevas) → ticket APARTE en Jira. NUNCA se
    pegan a la tarea actual.

---

## FLUJO GIT: RAMAS + PULL REQUEST (main protegida)
- **`main` está protegida:** los `git push` directos a `main` están BLOQUEADOS. Todo cambio
  entra por Pull Request (PR = "solicitud de fusión": los cambios van en una rama aparte y se
  piden meter en `main`; un humano revisa y hace Merge).
- **Una tarea → una rama** (`scrum-<n>-<slug>`, p.ej. `scrum-27-pagos-flex`). La feature y el
  commit del máster van en esa rama.
- **El máster se considera "pusheado" al MERGEAR el PR**, no antes. (Antes la regla era "push
  del máster al cerrar"; ahora es "el máster va en el PR y entra con el merge".)
- **El merge lo hace un humano**, nunca Claude. Es el punto de control antes de producción —
  encaja con "verificar antes de cerrar".
- **En Jira se enlaza el PR** (en vez de "hash en main"). El hash de `main` real existe tras
  el merge.
- Si `git log origin/main..HEAD` no queda vacío, es porque el PR aún no se ha mergeado — es
  normal; se cumple al mergear.

---

## E2E AUTOMATIZADO EN STAGING (SCRUM-38 — nuevo paso del bucle)

- **Staging exprés en Railway:** servicio duplicado sobre el MISMO `main` (nada de rama
  staging), con BD PostgreSQL propia y env vars de aislamiento: `WHATSAPP_DRY_RUN=1` y SIN
  `WHATSAPP_ACCESS_TOKEN` (el quality rating de Meta es un activo de producción), SIN
  `RESEND_API_KEY`/`SMTP_URL` (emails a buffer/outbox), Stripe TEST con su propio webhook,
  `DISABLE_CRONS=true`.
- **Nuevo paso tras el merge (amplía el paso 9 del bucle):** después del merge y del deploy,
  Claude Code corre la **suite de regresión** (`docs/QA/SUITE_REGRESION.md`) contra staging
  con el **Playwright MCP** (config en `.mcp.json`) y reporta el resultado. Cualquier fallo
  = HALLAZGO → ticket aparte (nunca se arregla "de paso"). El primer E2E de una feature de
  zona de dinero lo sigue verificando un humano en yaqu.app.
- **Login de test (SOLO staging):** `POST /auth/test-login` con tres cerraduras fail-closed
  (`E2E_TEST_LOGIN_ENABLED` + `E2E_TEST_LOGIN_SECRET` + `E2E_TEST_LOGIN_EMAILS`). Esas env
  vars **JAMÁS se añaden en producción** — allí la ruta cae al 404 estándar de la app. La
  seguridad del magic link real no se toca.
- **Seed reproducible:** `scripts/seed-staging.mjs` (idempotente; merchant QA + cliente + 3
  presupuestos: 50/50, 100 %, custom 30/40/30 de 100,01 €). Guard anti-prod integrado.
- **Schema de staging:** con `npx prisma db push` (MISMO mecanismo que prod). ⚠️ NO usar
  `migrate deploy`: `prisma/migrations` está congelada desde mar-2026 y dejaría el schema viejo.
- **Los briefs de tarea incluyen sección "E2E AUTOMATIZADO"** con el guion que Claude Code
  ejecuta en staging tras el merge de esa tarea.

---

## TRABAJANDO DOS (O MÁS) A LA VEZ (repo compartido)
- **`git pull` de `main` antes de empezar CADA tarea.** Partir de lo último evita conflictos.
- **Cada persona, su propia rama y sus propios tickets de Jira.** No trabajéis el mismo ticket
  a la vez ni la misma rama. Repartíos el backlog para no chocar.
- **Nada entra a `main` sin PR + merge de un humano.** Con dos manos, esto es lo que evita
  pisarse y que algo llegue a producción sin revisar.
- Si dos ramas tocan el mismo archivo, al mergear la segunda puede haber conflicto: se resuelve
  en el PR (Claude Code puede ayudar, pero el merge lo confirma un humano).
- **Fuente de verdad compartida = el REPO** (`CLAUDE.md`, `docs/FLUJO_DE_TRABAJO.md`,
  `docs/YAQU_MASTER.md`). El proyecto de Claude.ai es POR PERSONA (para el chat asesor), no se
  comparte solo por tener el mismo repo.

---

## NOMBRES DE LOS BRIEFS (convención)
- Cada tarea tiene su PROPIO archivo de brief, para no pisar los anteriores.
- Formato: `SESION_ACTUAL_SCRUM-<n>.md` en `docs/Sprint Scrum/`.
- El prompt corto para Claude Code apunta al archivo de ESA tarea por su nombre exacto.
- Los briefs no se borran: quedan como histórico.

---

## COLUMNAS DE JIRA (nombres exactos del board)
- Nacen en **"Tareas por hacer"**.
- Al abrir el PR / terminar el trabajo → **"En revisión"** (con comentario + evidencia + enlace del PR).
- Tras el merge y la verificación en yaqu.app → **"Finalizada"**.
- Usar SIEMPRE estos nombres; no inventar estados ni columnas.

---

## REGLAS DE ORO DEL PROCESO
- **Reconocimiento antes de construir.** Siempre que se toque código que ya existe. Barato
  (solo lectura) y evita gastar cuota construyendo mal. El repo casi siempre va por delante.
- **Ticket = mapa (qué/cuándo). Brief = instrucciones de montaje (cómo, al momento).**
- **Una tarea → un commit de feature. El máster, en commit APARTE. Ambos en la rama de la tarea.**
- **`main` protegida: nada de push directo. Todo por rama + PR + merge humano.**
- **Stop conditions (máster AA1.4):** dinero real, fiscal/VeriFactu, webhooks de pago, schema
  NO aditivo, o flags globales → Claude Code PARA y pide OK antes de tocar.
- **Idempotencia en dinero: suma desde cero, nunca incrementar.**
- **No inventar estados, flags ni textos** (reglas 27/30). Necesidad nueva = cambio de máster
  propuesto, aprobado por un humano.
- **Verificar en producción (yaqu.app), no en localhost.** "Funciona en mi máquina" no cuenta.
- **NO tocar la seguridad de producción (magic-link) para probar.** Pruebas automáticas de
  Claude Code → entorno de STAGING aislado (SCRUM-29). Nunca abrir producción.
- **Prisma siempre ADITIVO, `db push` con preview del diff. Nunca `migrate dev`.**

---

## CHECKLIST DE CIERRE DE TAREA (el gate)
- [ ] Partido de `main` al día (`git pull` antes de empezar)
- [ ] Trabajo en su RAMA (`scrum-<n>-<slug>`), una tarea = un commit de feature
- [ ] Máster en commit APARTE, dentro de la misma rama
- [ ] Rama subida + PR abierto a `main` (con descripción)
- [ ] PR revisado y MERGEADO por un humano (el máster entra con el merge)
- [ ] Verificado en yaqu.app (no localhost). UI con login = verificada por un humano
- [ ] Sin regresión (tests verdes + las vistas afectadas siguen bien)
- [ ] Ticket movido en Jira (con enlace del PR) + comentario con la evidencia
- [ ] Hallazgos capturados como tickets aparte (no colados en esta tarea)

---

## MANTENIMIENTO DEL CONTEXTO (para no perder nada al colapsar chats)
- **Jira** = el mapa persistente (todos los tickets). Claude Code y Claude asesor tienen el conector.
- **En el REPO (lo que comparten todos):**
  - `YAQU_MASTER.md` = constitución del producto.
  - `CLAUDE.md` = lo que Claude Code lee AUTOMÁTICAMENTE al trabajar (derivado del máster;
    debe apuntar a este flujo). Aquí es donde el flujo de ramas+PR queda "para siempre".
  - `docs/FLUJO_DE_TRABAJO.md` = este documento.
  - `docs/Sprint Scrum/SESION_ACTUAL_SCRUM-<n>.md` = los briefs por tarea.
- **En el proyecto de Claude.ai (POR PERSONA, para el chat asesor):** copia del máster + la
  investigación de sector + este flujo. ⚠️ Esta copia NO se actualiza sola: cada varias tareas,
  resubir el `YAQU_MASTER.md` bueno para que el asesor lea la versión al día. El compañero tiene
  su propio proyecto/chat; lo que comparten de verdad es el repo.

---

## ESTRATEGIA DE CUOTA
- El reconocimiento (solo lectura) es BARATO → hazlo siempre primero.
- Construir es CARO → que el brief esté muy afinado para que Claude Code no dé palos de ciego.
- Las UI grandes gastan más → mejor empezarlas con cuota fresca.
- Si la cuota aprieta a mitad de una tarea, no pasa nada: el brief está en `docs/Sprint Scrum/`,
  el estado en Jira, y el trabajo en su rama. Se retoma sin perder nada.

---

## POR QUÉ ESTE PROCESO FUNCIONA (no lo cambies a la ligera)
Cada capa tiene una salvaguarda:
- El **reconocimiento** evita construir a ciegas sobre código que no conoces.
- El **plan-antes-de-tocar** evita sorpresas y da el punto de control.
- Las **stop conditions** protegen el dinero y lo fiscal.
- La **rama + PR + merge humano** protege `main` y deja que dos personas trabajen sin pisarse.
- El **commit aparte del máster** protege tu única fuente de verdad.
- La **verificación en producción** evita el "funciona en mi máquina".
- **Capturar hallazgos aparte** mantiene "una tarea, un commit" y que nada se pierda.

Este bucle ya ha cazado bugs sutiles ANTES de romper nada, y ahora también un push directo a
`main` bloqueado por protección de rama (Claude Code paró en vez de forzar). Merece la pena la
disciplina.
