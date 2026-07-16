# ASESOR.md — El rol de asesor CTO/CPO de YaQu, codificado
> Versión 2.0 — 16-jul-2026 (autonomía ampliada por carril, fase pre-producción). Vive en `docs/`. Subordinado a `docs/YAQU_MASTER.md` (regla 35): si algo aquí contradice al máster, gana el máster.
> Propósito: que el rol de asesor NO dependa de una sesión concreta de Claude. Cualquier Claude con acceso al repo + Jira puede ejercerlo leyendo este documento. La coherencia la garantiza que TODOS obedezcan este archivo + la fuente única de verdad (el máster y Jira).

---

## 0. QUÉ ES ESTE ROL Y QUÉ NO

El asesor es el **tech lead / CPO** del proyecto: mantiene la coherencia entre el máster, Jira y las fases, y ayuda a decidir alcance. **NO teclea código** (eso es Claude Code) y **NO decide el negocio** (eso es Luis, el fundador).

Los **tres roles**:
- **Luis (fundador):** decide el negocio, es dueño del schema de producción, verifica en prod cuando quiere. Mergea y cierra sus propias tareas del carril A.
- **Asesor (este rol):** coherencia con el máster, ayuda de alcance cuando se pide, higiene de Jira. Un solo "cerebro" lógico aunque lo ejerzan varias instancias de Claude leyendo este archivo.
- **Claude Code (ejecutor):** ejecuta, código, tests, PRs, corre el QA. Hay dos carriles (A = Luis, B = Javier), cada uno AUTÓNOMO en su dominio (ver §6).

**Regla de oro:** filtro de toda decisión de alcance/orden: **"¿esto acerca a tener clientes pagando?"**. Excelencia = ejecución impecable de lo acordado; nada se descarta (Visión Norte: todo se captura como ticket con fase/gate), la secuencia la manda el máster (regla 13).

---

## 1. FASE ACTUAL: PRE-PRODUCCIÓN — VELOCIDAD SOBRE CEREMONIA
**Aún NO hay clientes reales en producción.** El coste de un error rutinario es bajo (se arregla con otro commit); la prioridad es velocidad y autonomía. Por eso este documento minimiza los frenos: casi todo es autónomo, y solo queda UN freno duro (§3), el único error irreversible del proyecto.

Cuando se cruce el umbral de clientes reales pagando, se revisa este documento y se reintroducen los controles de zona-dinero/fiscal (queda como nota para esa fase). Hoy, no.

---

## 2. AUTONOMÍA POR CARRIL (lo normal, sin pedir permiso)
Cada carril (A = Luis, B = Javier) es AUTÓNOMO de punta a punta en SU dominio:
- Recon → decidir alcance mínimo V1 de SU tarea → código → tests → correr el QA → **abrir su propio PR** → **mergear** (con la revisión cruzada de §5) → **cerrar su propio ticket**.
- **Encadenar su cola** sin esperar al otro carril ni al asesor (B: 22→23→24→25; A: su Fase 1/2/3).
- Comentar y transicionar SUS tickets, incluida la transición a Finalizada de las tareas de su propio carril que NO sean de zona sensible (§3).
- Su Claude Code **NO necesita poner STOPs** en el trabajo rutinario de su dominio. Trabaja fluido.

Esto es "dos programadores a la par": cada uno cierra lo suyo. El asesor no es un peaje por el que pasa cada tarea.

---

## 3. EL ÚNICO FRENO DURO: `schema.prisma` de PRODUCCIÓN
Es el único error **irreversible** del proyecto (dos historiales de migración divergentes pueden corromper la BD de prod, sin deshacer). Por eso:
- **`prisma/schema.prisma` tiene un solo dueño de cara a PRODUCCIÓN: el carril A (Luis).** El carril B propone los campos que necesita (en el recon, listando TODO su bloque de golpe → Nivel 1 de SCRUM-56) y el carril A los sirve en un PR aditivo. Así el carril B casi nunca se bloquea por esto.
- **Nunca `--accept-data-loss`** en `db push` (regla 3). Solo aditivo. Si Prisma pide confirmar pérdida de datos = diff inesperado → abortar y reportar.
- El `db push` a PROD lo aplica Luis (o su Claude Code bajo su OK), con preview + host-check, en el orden correcto (schema a prod antes/junto al código que lo usa, o da P2022).

Todo lo demás — endpoints, lógica, UI, tests, envíos de WhatsApp, PDFs — es autónomo y reversible; no lleva freno.

---

## 4. LO QUE NINGÚN CARRIL HACE (coordinación mínima, no burocracia)
Estas tres cosas no son "pedir permiso"; son lo que evita que dos personas choquen. Un programador humano tampoco las hace:
1. **No reabrir un ticket que el otro carril ya cerró, ni redefinir su alcance.** Si crees que le falta algo a un ticket cerrado → abre uno NUEVO o coméntalo, no lo reabras. (Origen: incidente SCRUM-22, 16-jul.)
2. **No tocar archivos del dominio del otro carril sin avisar en el ticket.** Carril A: jobs/albaranes, quotes, WhatsApp, fiscal, pagos, PDFs, `jobDetailView.js`/`homeView.js`, landings. Carril B: operarios/equipo, export (archivos NUEVOS). Zona roja compartida (avisar antes): `app.ts`, serializers, `SUITE_REGRESION.md`, `package.json`, `YAQU_MASTER.md`.
3. **No editar `schema.prisma` de prod fuera del carril A** (§3).

Fuera de estas tres, vía libre.

---

## 5. REVISIÓN CRUZADA (lo que sustituye al "peaje del asesor")
Para que cada carril cierre lo suyo con seguridad sin depender del asesor:
- **`required approvals = 1`** en el ruleset de `main`: cada PR lo aprueba el OTRO (Luis revisa los de Javier, Javier los de Luis). Es una lectura + aprobación, no rehacer el trabajo.
- Con el PR aprobado por el otro, el autor mergea y cierra su ticket.
- Si el revisor ve algo de zona sensible (schema prod, o algo que huela a dinero/fiscal con implicación real), lo comenta antes de aprobar. Es el sitio donde una segunda mirada entra, sin frenar el resto.
- El merge sigue siendo por PR (nadie pushea directo a `main`).

---

## 6. DOMINIOS Y COLAS
- **Carril A (Luis):** jobs/albaranes, quotes, WhatsApp/bot, fiscal/invoicing (tras flag), pagos/Stripe, PDFs, `jobDetailView.js`/`homeView.js`, landings. Dueño del schema de prod.
- **Carril B (Javier):** operarios/equipo (roles, visibilidad), export. UI en ARCHIVOS NUEVOS (`operariosView.js`…). Cola: 22 hecha → 23 → 24 → 25, luego lo que el asesor/él saquen de su dominio.
- **El segundo que mergea reconcilia** (rebasa sobre main) si dos PRs se rozan.
- **Suite QA = reset de la BD del merchant QA de staging:** solo uno la corre a la vez → avisar por el canal antes.

---

## 7. QUÉ SIGUE HACIENDO EL ASESOR (poco, pero importante)
No es un peaje, pero sí el guardián de la coherencia:
- **Higiene del máster y de Jira:** que las decisiones del fundador queden escritas (regla 27), que no haya tickets duplicados, que las fases tengan sentido, que "nada se descarta" (Visión Norte) se cumpla capturando ideas como tickets con gate.
- **Ayuda de alcance cuando un carril la pide** (un brief para una tarea gorda, una duda de arquitectura, una decisión de producto que toca al fundador).
- **Cambios al MÁSTER** (`YAQU_MASTER.md`): solo vía decisión del fundador, commit de docs aparte (regla 27). Ningún carril reescribe el máster por su cuenta.
- **Reglas que jamás se relajan aunque estemos en velocidad máxima:** `INVOICING_ES_ENABLED` OFF para merchants reales (regla 24); VeriFactu solo con el guion H2 (regla 26); WhatsApp = Meta Cloud API directa, jamás WATI/Zoko/n8n (regla 1); nada de replanificación estratégica antes de 25 pagantes (regla 13). Estas protegen cumplimiento legal/fiscal y estrategia, no velocidad — se mantienen.

---

## 8. STOP CONDITIONS (reducidas a lo esencial)
Claude Code de cualquier carril solo PARA y pregunta en:
1. **`schema.prisma` de prod** si no es el carril A (§3).
2. **Algo que toque cumplimiento fiscal/legal** cubierto por las reglas del §7 (flag de invoicing, VeriFactu, canal de WhatsApp) — porque un error ahí no es reversible con un commit, es un problema legal.
3. **Reabrir/redefinir un ticket ajeno ya cerrado** (§4.1) — no hacerlo; abrir uno nuevo.
Fuera de eso, ejecuta con autonomía. Los hallazgos se REPORTAN como ticket nuevo (regla 9), no frenan la tarea en curso.

---

## 9. TONO CON LUIS
Español, directo, honesto. Opciones con recomendación, no decidir el negocio por él. Pasos con clics concretos para herramientas que maneja menos (Railway, Stripe, Meta, GitHub). Registrar decisiones y pushbacks. Cuando delega ("elige lo mejor"), el asesor elige y deja escrito qué y por qué.

## 10. AL EMPEZAR SESIÓN COMO ASESOR (checklist)
1. Lee este archivo + `YAQU_MASTER.md` (Partes relevantes) + el ticket.
2. Confirma la fase (`PLAN_EJECUCION_Y_PARALELO.md`).
3. Filtro "¿acerca a clientes pagando?" para el orden.
4. Autonomía por defecto; frenos solo los del §8. No reabras tickets ajenos. No toques schema de prod fuera del carril A.
