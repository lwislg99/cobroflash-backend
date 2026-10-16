# TAREA ACTIVA — SCRUM-38 · Staging exprés en Railway para QA autónomo (Playwright MCP + login de test seed)

> Trabaja contra ESTE archivo + `docs/YAQU_MASTER.md` + el ticket Jira **SCRUM-38**. NO dependas del chat.
> Flujo de ramas (AA1.2): `git checkout main && git pull` → rama **`scrum-38-staging-expres`** → UN commit de feature + commit APARTE del máster/flujo, AMBOS en la rama → push + **PR a `main`** → merge del fundador.
> 🚨 ZONA SENSIBLE — el endpoint de test-login toca AUTH. Lee la **sección 5 (STOP)** antes de tocar nada. La seguridad del magic link de producción NO se modifica (el hallazgo del log a consola es SCRUM-39, NO va aquí).

---

## 0. CONTEXTO REAL DEL REPO (verificado en reconocimiento 12-jul — confírmalo, no lo re-descubras)

- Config centralizada en `env.ts:1-85` + 4 lecturas directas (`INTERNAL_API_SECRET`, `WHATSAPP_DRY_RUN` en `whatsapp.ts:22`, `PUBLIC_BASE_URL`, `DATABASE_URL`). `APP_ENV` no existe y NO hace falta: el apagado se logra por env vars.
- **WhatsApp: `WHATSAPP_DRY_RUN=1` ya existe** (`whatsapp.ts:18-27`): pasa guards, no llama a Meta, wamid simulado, log WA-0b. Cinturón extra: staging SIN `WHATSAPP_ACCESS_TOKEN`.
- **Email: apagado por ausencia** de `RESEND_API_KEY`/`SMTP_URL` (fallbacks inofensivos: buffer/`.eml` a outbox/console — `auth.service.ts:13-24`, `mailer.ts:8-17`, `email.service.ts:48/63`, `lifecycle.service.ts:15-16`). `DISABLE_CRONS=true` apaga recordatorios.
- **Auth**: magic link → `GET /auth/verify` → `AuthSession type='session'` (30 días) + cookie `pf_session` (`authMiddleware.ts:65-72`). Punto de inserción mínimo para test-login: endpoint nuevo en `auth.routes.ts` reutilizando `prisma.authSession.create` + `setCookie` existentes.
- **Seed**: existen `prisma/seed.ts` y `scripts/seed-demo.mjs` como patrón; falta un seed de staging. `seed-demo-fontaneria.mjs` es local con emails personales — **NO committear**.
- **Railway**: sin railway.json/Dockerfile → Nixpacks con package.json (`tsc` + `node dist/index.js`). Rama de deploy y servicios se configuran en el dashboard (lo hace Luis). Stripe: firmas por env vars (`stripe.routes.ts:34-37`, `connectWebhook.routes.ts:30`), URLs de webhook en el dashboard de Stripe, `success_url` desde `PUBLIC_BASE_URL`. Cero cambios de código para el entorno.
- **Playwright**: no está en el repo. `.codex/config.toml` trae el MCP para Codex, no para Claude Code. Falta `.mcp.json` del proyecto.

## DECISIONES TOMADAS (no reabrir)

- **Misma rama `main`, entorno separado por env vars** (no rama `staging`): el QA post-merge debe probar EXACTAMENTE lo mergeado. `NODE_ENV=production` en staging (fidelidad de cookies Secure, sin `/dev`).
- El test-login se gatea por **`E2E_TEST_LOGIN_ENABLED` + allowlist `E2E_TEST_LOGIN_EMAILS` + secret `E2E_TEST_LOGIN_SECRET`** (adición del asesor: staging tiene URL pública; tres cerraduras). Ninguna de las tres env vars existirá JAMÁS en producción. Sin flag → 404 indistinguible de no existir.
- El QA autónomo cubre **REGRESIÓN**; el primer E2E de features de zona de dinero lo sigue verificando un humano en yaqu.app.

## 1. QUÉ HAY QUE HACER (alcance EXACTO)

**Código (en la rama, PR normal):**
1. **`POST /auth/test-login`** en `auth.routes.ts` (~20 líneas): si `process.env.E2E_TEST_LOGIN_ENABLED !== 'true'` → 404. Body `{email, secret}`: `secret` debe igualar `E2E_TEST_LOGIN_SECRET` (si la var no existe → 404) y `email` estar en `E2E_TEST_LOGIN_EMAILS` (lista separada por comas). Si pasa: crea `AuthSession type='session'` para el user de ese email (debe existir — lo crea el seed) + `setCookie` con el helper existente. Rate-limit igual que `/auth/verify`. NO tocar nada más de auth.
2. **`scripts/seed-staging.mjs`** idempotente (ejecutable N veces sin duplicar): merchant QA (email `qa@staging.yaqu` o el que fije Luis) + customer + 3 quotes **accepted**: `FIFTY_FIFTY`, `FULL_UPFRONT`, y custom `[{0.3,'Anticipo'},{0.4,'Hito 1'},{0.3,'Hito 2'}]` con `total:'100.01'`. Patrón de `seed-demo.mjs`.
3. **`.mcp.json`** del proyecto con el MCP de Playwright para Claude Code.
4. **Suite E2E v1** (guion versionado, p.ej. `docs/QA/SUITE_REGRESION.md` + lo que necesites para ejecutarla con el MCP): login de test → custom 30/40/30 de 100,01: condiciones de pago muestran el plan, generar tramos 2 y 3 sin Terminado (40,00 y 30,01, suma exacta), "Plan de facturación completado", "Marcar como pagada" → "Ver justificante"; → **preset 50/50: copy y visibilidad idénticos al byte** (la regresión omitida en el E2E manual de SCRUM-34 — deuda anotada en su ticket); → 100% sin regresión.
5. **Docs (commit APARTE):** sección "E2E AUTOMATIZADO" en `FLUJO_DE_TRABAJO.md` + nota en el máster: nuevo paso del bucle = tras el merge y deploy, Claude Code ejecuta la suite en staging y reporta hallazgos; los briefs incluirán sección "E2E AUTOMATIZADO" con el guion de la tarea.

**Dashboard (lo hace LUIS, con tu checklist guiado):**
- Servicio staging duplicado sobre `main`, auto-deploy ON; PostgreSQL nuevo vacío conectado.
- Env vars staging: `NODE_ENV=production`, `PUBLIC_BASE_URL=https://<staging>.up.railway.app`, `SESSION_SECRET` propio, `WHATSAPP_DRY_RUN=1`, **sin** `WHATSAPP_ACCESS_TOKEN`, **sin** `RESEND_API_KEY`/`SMTP_URL`, `DISABLE_CRONS=true`, `STRIPE_SECRET_KEY` TEST + webhook TEST creado en Stripe apuntando a staging con su `STRIPE_WEBHOOK_SECRET`, `INTERNAL_API_SECRET` propio, `E2E_TEST_LOGIN_ENABLED=true`, `E2E_TEST_LOGIN_EMAILS`, `E2E_TEST_LOGIN_SECRET` (generado aleatorio).
- En producción: NO añadir ninguna `E2E_*`.

**NO INCLUYE:** tocar el flujo real del magic link (SCRUM-39 aparte); tocar producción; WhatsApp/Resend reales en staging bajo ningún concepto; datos personales en seeds committeados.

## 2. PARIDAD DE SCHEMA (verificación obligatoria — adición del asesor)

Antes de poblar la BD staging: **verifica cómo obtiene prod su schema** (¿migrations con `prisma migrate deploy` en el build/start, o `db push` manual?). Staging usa EXACTAMENTE el mismo mecanismo. Si prod usa migrations, staging = `migrate deploy`; `db push` solo si prod también. Repórtalo en la entrega.

## 3. SEGURIDAD DEL TEST-LOGIN (no negociable)

- Sin `E2E_TEST_LOGIN_ENABLED==='true'` → 404 antes de leer el body.
- Sin `E2E_TEST_LOGIN_SECRET` definida → 404 (fail-closed: jamás "sin secret = sin comprobación").
- Comparación del secret en tiempo constante si hay helper a mano; si no, al menos no loguear ni el secret ni el body.
- Ningún log del endpoint debe contener el secret ni tokens de sesión.

## 4. E2E AUTOMATIZADO (la suite v1 es parte del DONE)

Ejecutar la suite completa del punto 1.4 contra staging con Playwright MCP y adjuntar el resultado (pasos, asserts de importes 40,00/30,01 y de textos de CTA, y capturas si el MCP las da).

## 5. 🚨 STOP CONDITIONS (AA1.4)

- **ANTES de tocar `auth.routes.ts`, PARA y enseña:** el diff completo del endpoint + confirmación de que el flujo del magic link queda intacto y de las 3 cerraduras fail-closed. Espera OK explícito.
- Si el seed necesitara tocar schema → PARA (no debería: usa modelos existentes).
- La `DATABASE_URL` de staging en tu `.env.local` local para el seed: JAMÁS la de producción. Si en algún paso solo tienes la de prod a mano → PARA y pide la de staging.
- Hallazgos → reportar, no arreglar (regla 9).

## 6. DEFINICIÓN DE HECHO (Gate)

- PR mergeado; staging desplegado desde `main` con BD propia y vars del punto 1.
- `POST /auth/test-login` devuelve 404 en producción (verificarlo explícitamente) y funciona en staging solo con email+secret correctos.
- Seed corrido: merchant QA con los 3 presupuestos.
- **Suite v1 ejecutada por Claude Code vía Playwright MCP en staging, en verde**, incluida la regresión de presets 50/50 y 100%.
- Ni un solo mensaje de WhatsApp ni email real disparado desde staging (revisar log WA-0b/outbox como evidencia).
- `FLUJO_DE_TRABAJO.md` + máster actualizados (commit aparte).

## 7. AL TERMINAR — MÁSTER/FLUJO (commit SEPARADO)

Añadir (regla 16, solo añadir): el entorno staging exprés (mismo `main`, env vars), las tres env vars `E2E_*` como flags que JAMÁS existen en producción, y el nuevo paso "E2E automatizado post-merge" en el bucle. Di qué líneas tocas.

## 8. JIRA

Al abrir el PR: SCRUM-38 → "En revisión" con diffs, checklist de dashboard para Luis, resultado de la suite y enlace del PR. NO cerrar: el fundador verifica (incluido el 404 en prod) y el asesor mueve a Finalizada. Al cerrar la 38, comentar en SCRUM-36 si queda cubierta (probable duplicada).

## 9. FORMATO DE ENTREGA

- Diff del test-login — ANTES de aplicar (STOP).
- Tras OK: archivos, checklist Railway para Luis paso a paso, mecanismo de schema verificado (punto 2), resultado de la suite v1, evidencia de cero envíos reales, hallazgos.
