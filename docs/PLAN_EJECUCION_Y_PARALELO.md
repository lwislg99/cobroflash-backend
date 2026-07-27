# PLAN DE EJECUCIÓN POR FASES + TRABAJO EN PARALELO (Luis · Javier)
> Versión 1.0 — 14-jul-2026. Vive en `docs/`. Subordinado a `docs/YAQU_MASTER.md` (regla 35).
> Lo actualiza el asesor cuando cambian las fases. Si algo aquí contradice al máster, gana el máster.

---

## PARTE 1 — DÓNDE ESTAMOS (14-jul-2026)

**Hecho y en producción:** PAGOS-FLEX completo (34/35), staging aislado + QA autónomo Playwright 27 asserts (38/36/42), auth sin fugas (39), albaranes V1 firmables (14 + flecos), numeración consistente + confirmación de pago (43/44), SW cache bump (46), Visión Norte en el máster.
**En curso:** 2 plantillas Meta en revisión (`albaran_firmado_es`, `albaran_para_firmar_es`) · SCRUM-48 exprés (seguridad PDFs) en implementación · SCRUM-15 pendiente de reconciliar.
**Feedback real:** un fontanero vio la demo y pidió el contenido del sprint ("me vale para una de mis empresas"). Acción comercial pendiente: oferta founding condicionada al roadmap.

---

## PARTE 2 — LAS FASES

### FASE 0 · Bloque actual (esta semana)
| Qué | Ticket | Carril |
|---|---|---|
| Seguridad PDFs albarán (público/enumerable/colisión) | SCRUM-48 | Luis |
| Reconciliar SCRUM-15 (cubierta por 14+47+49) | SCRUM-15 | asesor |
| Esperar Approved de Meta (2 plantillas) | SCRUM-47 | Meta ⏳ |

### FASE 1 · Historia "Albaranes por WhatsApp" (1-2 semanas)
Orden estricto: **48 → 47 → 49 → 50**
| Qué | Ticket |
|---|---|
| Envío de copia firmada por WhatsApp (media_id, botón manual, guards completos) | SCRUM-47 |
| Página pública `/albaran/:token` + firma remota + auto-envío de copia (regla 28/J6) | SCRUM-49 |
| Bot: fallback ventana 24h, quick reply "Recibido", mensajes entrantes sobre albaranes | SCRUM-50 |

### FASE 2 · Fiscal — "lo del trimestre" (la gorda)
Orden: **16 → 17 → 20 → 18**. TODO detrás de flag (`INVOICING_ES_ENABLED` OFF para merchants reales — regla 24 intocable; VeriFactu solo por guion H2 — regla 26).
| Qué | Ticket |
|---|---|
| FISCAL-1 · Factura de anticipo con IVA + descuento en final | SCRUM-16 |
| FISCAL-2 · Factura recapitulativa (consolida albaranes del mes) | SCRUM-17 |
| VERIFACTU-TRABAJOS · Registro de las facturas nuevas | SCRUM-20 |
| FISCAL-3 · Certificaciones por % + retención 5% (abre el gate de la 37) | SCRUM-18 |

### FASE 3 · Pagos
Orden: **7 (spike) → 19 → 2/3/5 → 41**
| Qué | Ticket |
|---|---|
| Spike SEPA (viabilidad Connect + mandato) | SCRUM-7 |
| SEPA a nivel Trabajo | SCRUM-19 |
| Bizum automático (decisión de fee primero) | SCRUM-2/3/5 |
| Stripe LIVE (¡sin esto nadie paga de verdad!) | SCRUM-41 |

### CARRIL JAVIER (en paralelo desde YA)
Orden: **22 → 23 → 24 → 25**
| Qué | Ticket |
|---|---|
| OPERARIO-1 · Autoría del operario en el Trabajo | SCRUM-22 |
| OPERARIO-2 · El operario ve solo sus trabajos | SCRUM-23 |
| OPERARIO-3 · Vista admin de supervisión | SCRUM-24 |
| EXPORT-1 · ZIP facturas PDF+XML + CSVs | SCRUM-25 |

**Cola sin fase (cuando haya hueco):** SCRUM-45 (cache-busting raíz), SCRUM-40 (estrategia migrations — hacer ANTES de que Javier toque schema por primera vez), SCRUM-4/6 (métodos de pago discovery).

---

## PARTE 3 — TRABAJO EN PARALELO SIN PISARSE

### 3.1 El principio: propiedad por dominios
Cada carril es DUEÑO de sus módulos. El dueño puede tocarlos sin preguntar; el otro carril NO los toca sin coordinar en el ticket.

**Dominio LUIS (carril A):** `src/modules/jobs/*` (albaranes, PDFs), `src/modules/quotes/*`, todo lo de WhatsApp (`whatsapp.ts`, `whatsappTemplates.ts`, webhook, bot), fiscal/invoicing, Stripe/pagos, `pdf.service.ts`, landings públicas.

**Dominio JAVIER (carril B):** equipo/operarios (roles, invitaciones, visibilidad), export. Sus vistas de UI van en **ARCHIVOS NUEVOS** (`operariosView.js`, `exportView.js`...), nunca dentro de las vistas existentes.

**ZONA ROJA (compartida — reglas especiales, §3.3):** `prisma/schema.prisma`, `src/app.ts`, `jobs.routes.ts`, `public/dashboard/js/jobDetailView.js`, `homeView.js`, `docs/QA/SUITE_REGRESION.md`, `package.json`, `docs/YAQU_MASTER.md`.

> 📌 **Esta frase describe; la lista que MANDA es `ZONA_ROJA` en `scripts/zona-roja.mjs`** (SCRUM-168). Un test falla si las dos se separan, así que editar aquí sin editar allí sale en rojo. El job de CI `zona-roja.yml` comenta en cada PR qué ficheros de la lista toca, con el motivo de cada uno. **No hay gate de «Require review from Code Owners» y no va a haberlo** (decisión del fundador, 27-jul-2026): este aviso no complementa a nada, es la única señal que existe sobre la zona roja, para los dos carriles.
>
> **Hueco declarado — los serializers.** Salen de la lista: no son una ruta. Estaban como `jobs.routes.ts (serializers)` y esa entrada no cubría lo que decía: `serializ` aparece en 11 ficheros de 8 módulos (jobs, maintenance, exports, expenses, invoicing, quotes, `core/http`, `core/i18n`), así que cualquier patrón de ruta o deja fuera la mayoría o marca medio repo. El precedente de por qué importan es **SCRUM-97** (filtraban IBAN y `portalToken`) — y `portalToken` vive hoy en 5 ficheros, **ninguno** `jobs.routes.ts`: el caso exacto que justificaba la entrada caía fuera de ella. Se prefiere un hueco visible a una protección decorativa, porque la decorativa se cuenta como cobertura y nadie vuelve a mirarla.

### 3.2 Reglas de oro (las 8)
1. **Un ticket = una rama = un PR.** Ramas cortas (máx 2-3 días de vida). Mergear frecuente > ramas perfectas.
2. **Cada uno en SU máquina/carpeta.** Jamás dos sesiones de Claude Code sobre el mismo checkout (lección del 13-jul: colisión 14/43). Si un mismo humano necesita 2 sesiones: worktrees.

   > ⚠️ **RETIRAR un worktree: deshacer sus ENLACES primero** (incidente #11, 27-jul-2026, ver
   > `docs/ERRORES_ASESOR.md`). Los worktrees llevan un junction `node_modules → <repo>/node_modules`
   > para no duplicar 271 paquetes por copia. `git worktree remove` **entra por el enlace y borra
   > el contenido del destino**: una limpieza rutinaria de 37 worktrees dejó sin dependencias a
   > TODAS las sesiones a la vez, y ningún comando falló. Orden obligatorio, probado en los dos
   > sentidos (con enlace → el destino se vacía; con `rmdir` antes → sobrevive):
   >
   > ```bash
   > cmd //c "rmdir D:\ruta\al\worktree\node_modules"   # quita el ENLACE, no el destino
   > git worktree remove ../wt-loquesea                 # ahora sí
   > ```
   >
   > Si ya ha pasado: `npm ci` + `npx prisma generate` en el repo principal lo restaura, y los
   > junctions de los worktrees que sobrevivan vuelven a resolver solos.
3. **Empezar SIEMPRE con `git checkout main && git pull`.** Rebase de main a la rama si pasa de 1 día.
4. **Anunciar zona roja:** antes de empezar un ticket, comentar en él qué archivos de zona roja tocará. El otro carril lo lee antes de arrancar el suyo.
5. **El segundo reconcilia:** si dos PRs tocan lo mismo, el que mergea segundo resuelve conflictos rebasando sobre main (patrón del PR #10). Los merges los hace Luis con "Create a merge commit" si hay 2+ commits.
6. **Cero refactors oportunistas** (regla 9 del máster): hallazgo → ticket, no arreglo. Un refactor sorpresa en zona compartida es una granada de conflictos.
7. **Jira:** Javier usa label `dev2` en sus tickets. Estados: En curso → En revisión (con PR) → **Finalizada SOLO la pone el asesor** tras verificación.
8. **~~Una suite a la vez~~ → UNA BD POR CARRIL (SCRUM-84, 23-jul-2026).** Ya no hay que
   pedir ventana para correr tests gateados: cada carril tiene su propia base de datos
   **dentro del mismo servicio Postgres de staging** (`postgres-staging`, host
   `acela.proxy.rlwy.net:40802`). Coste cero — un servidor Postgres aloja N bases.

   | Carril | Base de datos |
   | --- | --- |
   | **Sesión 1 (Javier / carril B)** | `yaqu_dev_javier` |
   | **Sesión 2** | `railway` (la original) |

   Cada uno la apunta en `DATABASE_URL_STAGING` de **su `.env` local** — nunca en el repo.
   Las dos están sembradas con `scripts/seed-staging.mjs`, que es **obligatorio**: crea el
   merchant demo `id=1` que exigen `a55-window-quote`, `bot-suite`, `scrum13-cobrado` y
   `scrum52-operario`. Sin él, esos cuatro fallan **solo en un carril** — el rojo ambiguo
   que este cambio vino a eliminar.

   **`scripts/clean-staging-tests.mjs` pasa a ser por carril:** lee `DATABASE_URL_STAGING`,
   así que cada uno limpia la suya. Ya no es una herramienta compartida.

   > **Los 4 merchants huérfanos `qa-s74-*` (#339, #340, #381, #383) viven en `railway`**, o
   > sea en el carril de la Sesión 2. Medidos **inocuos** en SCRUM-79 (limpiar de 12 a 2
   > merchants movió la mediana de `SELECT 1` ocho milisegundos: ruido). Sin ticket; se
   > anotan solo para que no desaparezcan del radar al cambiar de dueño.

   **LO QUE SIGUE SIENDO SERIAL, y sí necesita aviso por el canal: el `db push` de schema.**
   El carril A sirve el campo nuevo y **después cada carril lo aplica a SU base**. Dos manos
   en `prisma/schema.prisma` siguen prohibidas (§3.3).

### 3.3 Zona roja: protocolo por archivo
- **`prisma/schema.prisma` — SOLO carril Luis.** Es dominio del fundador (AA1.4). Si Javier necesita campos/tablas: los pide en su ticket (comentario con el modelo propuesto) → el carril de Luis los entrega en un PR aditivo previo → Javier construye encima. Nunca dos manos en el schema.
- **`app.ts`:** añadir rutas nuevas = línea propia al final del bloque de routers (conflicto trivial). No reordenar lo existente.
- **`jobs.routes.ts` / serializers:** añadir campos al JSON es aditivo y seguro; modificar campos existentes = coordinar en el ticket.
- **`jobDetailView.js` / `homeView.js`:** SOLO carril Luis mientras duren Fases 1-2. La integración de operarios en el detalle del Trabajo (si la 22 la pide) la ejecuta el carril de Luis sobre spec de Javier, o se coordina fecha.
- **`SUITE_REGRESION.md`:** secciones por dominio (Javier añade "§6 Operarios"). El que mergea segundo sube el número de versión (v1.5 → v1.6...).
- **`package.json`:** ojo con la lista explícita de tests (bug P3-7) — al añadir un test NUEVO, añadirlo a la lista en el mismo PR.
- **`YAQU_MASTER.md`:** cambios solo vía commit de docs aparte con decisión del fundador (regla 27). Javier propone, no edita.

### 3.4 Setup del Claude Code de Javier (checklist de onboarding)
1. **Acceso:** colaborador en GitHub (`lwislg99/cobroflash-backend`) — ya lo es. Clona el repo en SU máquina, carpeta propia.
2. **Abrir SIEMPRE la carpeta raíz del repo** en VS Code (no una carpeta madre) — así su Claude Code carga `.mcp.json` (Playwright MCP) y `CLAUDE.md` automáticamente. Primera sesión: verificar con `/mcp` que playwright aparece.
3. **Lectura obligatoria (día 1):** `docs/YAQU_MASTER.md` → este documento → `docs/FLUJO_DE_TRABAJO.md` → `docs/QA/SUITE_REGRESION.md`. Su Claude Code hereda las mismas reglas: briefs como fuente de verdad, STOP conditions (AA1.4), regla 9 (hallazgo→reporte), nunca transicionar a Finalizada, nunca `--accept-data-loss`, PRs con descripción pegada ANTES de crear.
4. **Briefs:** mismo sistema — el asesor escribe `docs/Srpint Scrum/SESION_ACTUAL_SCRUM-<n>.md`, Luis se lo pasa a Javier, Javier se lo da a su Claude Code. Recon primero, brief después, código al final.
5. **Secrets:** Luis le pasa por canal privado (nunca chat de Claude ni el repo) lo que necesite: URL de staging y `E2E_TEST_LOGIN_SECRET` para la suite. La `DATABASE_URL_STAGING` solo si su tarea exige seed — de inicio, NO (sus tickets 22-24 no tocan seed).
6. **Jira:** Javier comenta y mueve a "En revisión"; Finalizada = asesor. Si su Claude Code tiene conector Atlassian, mismas reglas.
7. **Primera tarea (rodaje sin riesgo):** RECON de SCRUM-22 en solo-lectura → reporte con rutas:líneas → el asesor escribe el brief → construye. Así aprende el flujo completo con una tarea de su dominio.
8. **GitHub approvals:** cuando Javier esté activo, restaurar required approvals = 1 en el ruleset "protect main" → cada PR lo revisa el otro (Luis revisa los de Javier, Javier los de Luis). El merge a main lo sigue haciendo Luis.

### 3.5 Canal de coordinación diaria
Un mensaje corto al empezar el día (WhatsApp/Slack entre Luis y Javier): "hoy toco X (tickets), zona roja: Y, suite: sí/no". 30 segundos que ahorran horas de conflictos.

---

## PARTE 4 — REGLA DE ORO DEL PLAN
Cada fase termina con algo ENSEÑABLE a un cliente. Si una tarea no acerca a que el fontanero (u otro) firme la oferta founding, se cuestiona su orden. El backlog sirve al cliente, no al revés.
