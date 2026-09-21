# CLAUDE.md — Constitución de Claude Code para YaQu

> **DERIVADO de `docs/YAQU_MASTER.md` (v5.3, ÚNICA fuente de verdad).** Si este archivo
> y el master divergen, **gana el master** (regla 35). Aquí solo vive lo operativo mínimo.

**YaQu** — cobro por WhatsApp para oficios en España: presupuesto en 30s → WhatsApp con botones →
firma del cliente → (post SIF-1) factura VeriFactu → cobro de señal/total. **Antes de SIF-1, en España,
ni documento ni cobro por YaQu (regla 24; SCRUM-612).** España-first.
**Sprint activo y cola única: Parte U del master (regla 31). Prioridad absoluta de F1: SIF-1.**

- Producción: `https://yaqu.app` · Deploy: Railway auto-deploy desde `main`
- Repo: `github.com/lwislg99/cobroflash-backend` · Merchant demo: `demo@yaqu.app`, id=1 (regla 8)

## Protocolo de sesión (AA1 — obligatorio)

> **Flujo Git completo (ramas + PR + trabajo en equipo): `docs/FLUJO_DE_TRABAJO.md`.**

🔴 **LECTURA OBLIGATORIA, cada tanda: [`docs/equipo/00-normas-comunes.md`](docs/equipo/00-normas-comunes.md)** —
las normas comunes de todas las sesiones: preámbulo, PASO 0, cómo se mide aquí, git, el orden del
esquema, lo que no se toca y cómo se entrega. Tu identidad y tus trampas propias, en
`docs/equipo/sesion-N.md`, y tu carril en la tabla §11bis de `docs/equipo/orquestador.md`.

⚠️ **Lee estos ficheros desde `origin/main` (`git show origin/main:<ruta>`) o abre el chat en un worktree
al día:** el checkout compartido `cobroflash-backend` va miles de commits por detrás, y lo que se carga
desde él (este mismo CLAUDE.md incluido) puede ser una versión antigua. *(17-sep-2026, auditoría de la S0.)*

1. Leer este archivo → abrir `docs/YAQU_MASTER.md` → localizar el **sprint activo en la Parte U**.
   Duda → preguntar, nunca asumir.
2. **Una tarea → una RAMA (`scrum-<n>-<slug>`) → commit de feature (+ registro en `docs/master/SCRUM-<n>.md`, misma rama; nunca en YAQU_MASTER.md, lo bloquea SCRUM-273) → se empuja y el PR se abre y se arma solo (`pr-automatico.yml`; lo mergea yaqu-bot cuando pasa el check obligatorio).** `main` protegida: push directo BLOQUEADO. Claude no mergea a mano ni se salta checks. *(Corregido el 17-sep-2026: decía «el merge lo hace un HUMANO», y desde el 9-sep es automático.)* `git pull` de `main` antes de empezar cada tarea. Plan de archivos ANTES de tocar código (skill `/yaqu-sprint`).
3. Tests relevantes en verde antes de commit (`npm test`); verificación en **yaqu.app**
   (no localhost) antes de cerrar la tarea.
3bis. **REGLA 42 del master — un ticket no se cierra mientras su rama siga sin mergear.** El
   enunciado firmado por el fundador vive en `docs/YAQU_MASTER.md`, Parte I, regla 42, y **NO se
   repite aquí**: este archivo es derivado (regla 35) y una regla escrita dos veces son dos reglas
   que pueden divergir. Aquí va sólo CÓMO se cumple:
   · El enlace de comparación se **COPIA** de la salida de `git push` o de
     `npm run ramas:sin-mergear`. **Nunca se construye a partir del número del ticket** — ése es
     el defecto medido en SCRUM-637: `…/pull/new/scrum-614` para una rama que se llama
     `scrum-614-censo-rutas-sin-rol`. La referencia se LEE, no se deduce.
   · Qué hay esperando a que alguien lo mire: `npm run ramas:sin-mergear` (las que NO están en
     `main`, con su edad y su compare) · `npm run ramas:borrables` (las que ya están y se pueden
     tirar) · `npm run enlace:ticket-rama` (cuándo rama, commit, `docs/master/` y Jira discrepan).
4. **STOP CONDITIONS — parar y pedir OK del fundador si la tarea toca:**
   - claims fiscales/VeriFactu (en UI, marketing o copy)
   - dinero real o flujo de cobro en producción
   - plantillas o categoría de Meta (WhatsApp)
   - copy del bot o textos oficiales (K1/N5) y estados/flags cerrados (L/P) → cambio de master
   - cambios de schema **no aditivos**
   - datos de clientes (export/borrado)
   - flags de la Parte P a nivel **global**

   **NO es STOP (regla 38):** un test o guard que solo **LEE** el camino de emisión (rutas,
   servicios, documentos, XML generado) — se hace sin pedir GO. **SÍ lo es** si para escribirlo
   hay que **MODIFICAR** ese camino (extraer un helper, exportar algo, cambiar una firma, mover
   código), aunque el fin sea solo el test: en el diff eso no se distingue de tocar el sellado
   (regla 29). Antes de asumir el STOP, prueba a observar sin modificar: AST, no `grep` ni
   instrumentación (SCRUM-203).
5. **Prohibido inventar** estados, transiciones, flags o textos de landing/bot
   (Partes L, P, N5, K1; reglas 27 y 30). Necesidad nueva = propuesta de cambio de master.
6. Bugs → `docs/BUGS.md` con su formato; nada de arreglos "de paso" sin registrar.
7. Cierre de sprint: `/yaqu-release-check` (QA del sprint + docs + done/evidencias en U)
   y actualizar el master (✅ con motivo; nunca borrar).
8. Producción: deploy = MERGE del PR a `main` (Railway auto-deploy desde `main`; push directo
   bloqueado por protección de rama). Nada destructivo contra la BD de prod sin preview
   del diff (`prisma migrate diff`) y confirmación (hook `guard-dangerous`).
9. **Secretos NUNCA en el chat.** Tokens (`EAA…`), claves de API (`GEMINI_API_KEY`, Stripe
   `sk_`/`whsec_`) y `WHATSAPP_ACCESS_TOKEN` los pega el fundador DIRECTO en Railway, jamás en
   la conversación. Si un secreto aparece en el chat: revocarlo y regenerarlo.

## 10 reglas duras (resumen de la Parte I; el detalle manda)

1. **NUNCA n8n.** WhatsApp solo vía `src/integrations/whatsapp.ts` (Meta Cloud API directa).
2. **Multi-tenant:** toda query filtra por `req.merchantId` (inyectado por `requireAuth`).
3. **Esquema:** NUNCA `db push` contra PRODUCCIÓN (regla 3 del máster). Orden: ① decisión → ② ALTER
   aditivo en las tres bases, que aplica el colaborador → ③ un PR con esquema + código + tests (A5 de
   `docs/equipo/00-normas-comunes.md`). El DDL sale de `node scripts/preview-migracion.mjs`.
   `migrate dev` está PROHIBIDO (el hook lo bloquea). *(Corregido el 17-sep-2026: decía «siempre db push
   con preview antes de tocar prod», contra la regla 3.)* **Claves de BD — REGISTRO MEDIDO el
   10-ago-2026 (SCRUM-418), no afirmación de estado:** los cuatro worktrees llevan
   `DATABASE_URL_STAGING`, `_DEV` y `_TESTS`; **ninguno tiene `DATABASE_URL`, ninguno apunta a
   producción, y no existe ningún `.env.local`**. Quien lo vuelva a medir, que lo re-feche aquí:
   `node scripts/comprobar-claves-bd.mjs` (mapa y guard en `scripts/_clave-vs-destino.mjs`; en un
   árbol de trabajo NO vive producción, y desde SCRUM-418 el guard lo hace cumplir por DESTINO).
   `loadEnv.ts` sigue dando prioridad a `.env.local` **si aparece**.
4. **Frontend vanilla** (sin React/Tailwind/bundler/build). `DESIGN.md` es la única fuente de
   tokens visuales; cambios de UI = una pantalla/componente, jamás rediseño total (Parte AB).
5. **Estados (L), flags (P) y microcopy (N5/K1) son CERRADOS.** Lo que no está en el master
   no se construye: se propone cambio de master primero.
6. **El Sprint Registry (U) es la cola única:** no reordenar ni intercalar sin cambio de master.
7. **Cero claims fiscales hasta SIF-1 8/8** (reglas 17/24/26): `INVOICING_ES_ENABLED=OFF` para
   merchants ES reales **—y con OFF, ni documento ni cobro por YaQu (regla 24)—**; demo con marca de agua; la pregunta VeriFactu se responde SOLO con el guion H2.
8. **Tarjeta real solo con Stripe Connect activo en ese merchant** (reglas 18/23). PROHIBIDO
   procesar pagos de clientes finales en la cuenta Stripe de plataforma. Mientras: transferencia/Bizum manual **—en España, solo con `INVOICING_ES_ENABLED` en ON (regla 24)—**.
9. **Una factura emitida JAMÁS se edita ni borra** (regla 29): solo R1 o anulación con registro.
   Anti-spam J6 es regla de canal: ningún envío automático nuevo sin pasar por su tabla (regla 28).
10. **`CLAUDE.md` y `.claude/*` son derivados del master** (regla 35). Prohibido instalar
    plugins/skills/hooks de terceros sin revisión explícita del fundador (regla 36).

## Las tres que no se negocian (valen para TODA ejecución, también la de `@claude`)

> Desde `.github/workflows/claude.yml`, un `@claude` en una issue o en una revisión de PR
> arranca una ejecución **cuyo prompt no ha revisado nadie**: ni el fundador ni otra sesión.
> Lo único que hereda son las normas del repositorio.

🔴 **LECTURA OBLIGATORIA ANTES DE ESCRIBIR UNA SOLA LÍNEA: `docs/YAQU_MASTER.md`, Parte I,
reglas 39, 40 y 41.** El texto literal vive ALLÍ y solo allí (regla 35: si este fichero y el
master divergen, gana el master; y dos copias del mismo párrafo divergen en dos semanas).
Aquí van únicamente los tres asuntos que cubren, para que sepas que te aplican:

1. **Texto que ve el usuario** → firma del fundador (regla 39; ensancha la 30).
2. **Camino de emisión fiscal y `prisma/schema.prisma`** → se leen; el esquema exige ALTER previo (regla 40; junta la 38 y la 3).
3. **Guard en rojo** → se arregla el código, nunca el guard (regla 41).

Si no puedes abrir el master, no estás en condiciones de tocar ninguno de los tres: para y dilo.

## Comandos

```bash
npm run dev              # hot reload; carga .env.local con prioridad (BD local + DISABLE_CRONS=true)
npm run build            # tsc → dist/
npm test                 # compila + node --test (tests/*.test.mjs contra dist/)
# ⚠️ `npm test` NO LO CORRE TODO, y su «0 fallos» no incluye lo que saltó (SCRUM-419/456).
# Los saltos DECLARAN su motivo: búscalos con el reporter TAP, porque `spec` NO lo imprime.
# ⚠️ SCRUM-850: el TAP va a FICHERO y se lee después, en DOS comandos. Con `| grep` el código de
# salida es el del `grep`, así que una tanda EN ROJO sale 0. Y el fichero va FUERA del árbol:
# un temporal dentro del repo es el rojo intermitente que midió SCRUM-824.
node --test --test-force-exit --test-reporter=spec --test-reporter-destination=stdout \
     --test-reporter=tap --test-reporter-destination="${TMPDIR:-/tmp}/yaqu-tanda.tap" tests/*.test.mjs
grep "# SKIP" "${TMPDIR:-/tmp}/yaqu-tanda.tap"
npm run test:staging:gated   # los gateados por QA_DB_TEST / A55_DB_TEST / BOT_SUITE_TEST.
                             # Toma el TURNO de staging y lo suelta (detalle en RUNBOOKS y en
                             # docs/QA/SUITE_REGRESION.md). NO lo lances con `| tail`.
# Los de LIBRO_PG_URL piden un Postgres DESECHABLE — loopback y base terminada en `_test`, que es
# lo que sus guards exigen antes de tocar nada (crean y BORRAN filas). Receta en docs/RUNBOOKS.md.
# preview OBLIGATORIO antes de db push (SCRUM-385). Lleva CONTROL POSITIVO dentro: si la
# herramienta no responde lo DICE, en vez de devolver un «no hay cambios» que no sabe.
# ⚠️ NO usar `npx prisma migrate diff` a pelo: si falta el CLI local, `npx` se baja otro de la
# red en silencio y su salida vacía se lee como «sin cambios» (incidente del 5-ago-2026).
node scripts/preview-migracion.mjs                        # contra la BD del entorno
node scripts/preview-migracion.mjs --desde viejo.prisma    # offline: schema viejo → actual
# db push: NUNCA contra producción (regla 3). Solo staging, con el turno.
./node_modules/.bin/prisma generate   # nunca `npx prisma` (SCRUM-385); en Windows, matar node antes si el DLL queda bloqueado
```

## Mapa rápido (detalle en master Parte D)

- `src/app.ts` rutas+auth · `src/index.ts` entry+crons · `src/core/` config/db/http/i18n/cron/utils
- `src/integrations/` whatsapp, stripe, mercadopago, claude, gemini, mailer (Resend en prod)
- `src/modules/` auth · billing · quotes · invoicing (PDF+VeriFactu) · system (admin) · reports ·
  exports · products · expenses · team · messaging · metrics · ai · templates · quoteRequests · search
- Capas nuevas F1: `src/core/flags.ts` · `src/modules/fiscal/verifactu/` (SIF-1) ·
  `src/modules/payments/connect/` (CONNECT-1) · ~~`src/modules/voice/` (VOZ-1)~~ (no existe; 17-sep-2026)
- Público: `public/` (landing, auth, dashboard vanilla, `tokens.css` = tokens compartidos)
- Docs operativos: `docs/RUNBOOKS.md` · `docs/QA_MASTER.md` · `docs/BUGS.md` ·
  `docs/WHATSAPP_TEMPLATES.md` (spec plantillas) · `docs/MIGRATIONS_PENDING.md` (db push log) ·
  `docs/CACHE_POLICY.md` (qué `Cache-Control` emite cada recurso; Cloudflare debe RESPETARLO)

## Skills locales (`.claude/skills/`)

- `/yaqu-sprint` — abrir sprint: registry → plan → OK → UNA tarea → done/rollback
- `/yaqu-release-check` — cierre de sprint (AA1.7)
- `yaqu-premium-ui` — obligatoria antes de tocar UI (DESIGN.md + Parte AB; checklist AB6).
  Jerarquía: DESIGN.md + Parte AB > yaqu-premium-ui > `frontend-design` oficial de Anthropic.
- `/yaqu-wa-templates` — estructura EXACTA de las plantillas de WhatsApp (Utility, vars en
  orden, botón, muestras EUR); usar al recrearlas en Meta o depurar #132000/#132001.
- `/yaqu-fase-b` — runbook de la WABA de producción (token por Usuario del sistema, 3 vars
  de Railway, 5 plantillas, verificación de empresa, nombre para mostrar).
- `yaqu-verifactu-sif` (obligatoria al tocar VeriFactu/SIF) · `verifactu` · `yaqu-payments` (se crea en CONNECT-1)
- `cerebro-yaqu` — arranque, disparadores anti-error y STOPs de cada sesión · `impeccable` — diseño de interfaz
