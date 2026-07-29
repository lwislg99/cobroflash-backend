# CLAUDE.md — Constitución de Claude Code para YaQu

> **DERIVADO de `docs/YAQU_MASTER.md` (v5.3, ÚNICA fuente de verdad).** Si este archivo
> y el master divergen, **gana el master** (regla 35). Aquí solo vive lo operativo mínimo.

**YaQu** — cobro por WhatsApp para oficios en España: presupuesto en 30s → WhatsApp con botones →
firma del cliente → cobro de señal/total → (post SIF-1) factura VeriFactu. España-first.
**Sprint activo y cola única: Parte U del master (regla 31). Prioridad absoluta de F1: SIF-1.**

- Producción: `https://yaqu.app` · Deploy: Railway auto-deploy desde `main`
- Repo: `github.com/lwislg99/cobroflash-backend` · Merchant demo: `demo@yaqu.app`, id=1 (regla 8)

## Protocolo de sesión (AA1 — obligatorio)

> **Flujo Git completo (ramas + PR + trabajo en equipo): `docs/FLUJO_DE_TRABAJO.md`.**

1. Leer este archivo → abrir `docs/YAQU_MASTER.md` → localizar el **sprint activo en la Parte U**.
   Duda → preguntar, nunca asumir.
2. **Una tarea → una RAMA (`scrum-<n>-<slug>`) → commit de feature (+ commit del máster aparte, misma rama) → PR a `main`.** `main` protegida: push directo BLOQUEADO. El merge del PR lo hace un HUMANO, nunca Claude. `git pull` de `main` antes de empezar cada tarea. Plan de archivos ANTES de tocar código (skill `/yaqu-sprint`).
3. Tests relevantes en verde antes de commit (`npm test`); verificación en **yaqu.app**
   (no localhost) antes de cerrar la tarea.
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
3. **Prisma sin TTY:** siempre `db push` con preview del diff antes de tocar prod;
   `migrate dev` está PROHIBIDO (el hook lo bloquea). `.env` apunta a PROD; dev usa `.env.local`.
4. **Frontend vanilla** (sin React/Tailwind/bundler/build). `DESIGN.md` es la única fuente de
   tokens visuales; cambios de UI = una pantalla/componente, jamás rediseño total (Parte AB).
5. **Estados (L), flags (P) y microcopy (N5/K1) son CERRADOS.** Lo que no está en el master
   no se construye: se propone cambio de master primero.
6. **El Sprint Registry (U) es la cola única:** no reordenar ni intercalar sin cambio de master.
7. **Cero claims fiscales hasta SIF-1 8/8** (reglas 17/24/26): `INVOICING_ES_ENABLED=OFF` para
   merchants ES reales; demo con marca de agua; la pregunta VeriFactu se responde SOLO con el guion H2.
8. **Tarjeta real solo con Stripe Connect activo en ese merchant** (reglas 18/23). PROHIBIDO
   procesar pagos de clientes finales en la cuenta Stripe de plataforma. Mientras: transferencia/Bizum manual.
9. **Una factura emitida JAMÁS se edita ni borra** (regla 29): solo R1 o anulación con registro.
   Anti-spam J6 es regla de canal: ningún envío automático nuevo sin pasar por su tabla (regla 28).
10. **`CLAUDE.md` y `.claude/*` son derivados del master** (regla 35). Prohibido instalar
    plugins/skills/hooks de terceros sin revisión explícita del fundador (regla 36).

## Comandos

```bash
npm run dev              # hot reload; carga .env.local con prioridad (BD local + DISABLE_CRONS=true)
npm run build            # tsc → dist/
npm test                 # compila + node --test (tests/*.test.mjs contra dist/)
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script   # preview ANTES de db push
npx prisma db push --accept-data-loss   # solo tras preview aditivo + confirmación
npx prisma generate      # en Windows: matar node antes si el DLL queda bloqueado
```

## Mapa rápido (detalle en master Parte D)

- `src/app.ts` rutas+auth · `src/index.ts` entry+crons · `src/core/` config/db/http/i18n/cron/utils
- `src/integrations/` whatsapp, stripe, mercadopago, claude, mailer (Resend en prod)
- `src/modules/` auth · billing · quotes · invoicing (PDF+VeriFactu) · system (admin) · reports ·
  exports · products · expenses · team · messaging · metrics · ai · templates · quoteRequests · search
- Capas nuevas F1: `src/core/flags.ts` · `src/modules/fiscal/verifactu/` (SIF-1) ·
  `src/modules/payments/connect/` (CONNECT-1) · `src/modules/voice/` (VOZ-1)
- Público: `public/` (landing, auth, dashboard vanilla, `tokens.css` = tokens compartidos)
- Docs operativos: `docs/RUNBOOKS.md` · `docs/QA_MASTER.md` · `docs/BUGS.md` ·
  `docs/WHATSAPP_TEMPLATES.md` (spec plantillas) · `docs/MIGRATIONS_PENDING.md` (db push log)

## Skills locales (`.claude/skills/`)

- `/yaqu-sprint` — abrir sprint: registry → plan → OK → UNA tarea → done/rollback
- `/yaqu-release-check` — cierre de sprint (AA1.7)
- `yaqu-premium-ui` — obligatoria antes de tocar UI (DESIGN.md + Parte AB; checklist AB6).
  Jerarquía: DESIGN.md + Parte AB > yaqu-premium-ui > `frontend-design` oficial de Anthropic.
- `/yaqu-wa-templates` — estructura EXACTA de las plantillas de WhatsApp (Utility, vars en
  orden, botón, muestras EUR); usar al recrearlas en Meta o depurar #132000/#132001.
- `/yaqu-fase-b` — runbook de la WABA de producción (token por Usuario del sistema, 3 vars
  de Railway, 5 plantillas, verificación de empresa, nombre para mostrar).
- `yaqu-verifactu-sif` (se crea en S1-0b) · `yaqu-payments` (se crea en CONNECT-1)
