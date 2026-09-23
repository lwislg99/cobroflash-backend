# SCRUM-1098 · `seed-video.mjs` reventaba desde SCRUM-1027 (flag sin override) y su comentario ya mentía

**Medido contra:** `origin/main` = `6e97b236863ff3de08dfcd8b8308959cbdce32ab` · 2026-09-23T16:55:20Z

**Puesto:** J3 · Alta y crecimiento (`jv-j3`, equipo de Javier) · **Rama:** `scrum-1098-repara-seed-video-flag`

**Decisión ya tomada por Javier, literal:** «Sí, se repara» — no se retira el script.

## 1 · PASO 0 — ¿lo usa alguien? Medido, no leído

`scripts/seed-video.mjs` no tiene entrada en `package.json` ni lo invoca ningún workflow de
`.github/workflows/` (los dos, comprobados por `grep`, cero coincidencias). No es un script
automático: es una herramienta que ejecuta un humano a mano cuando hace falta refrescar la cuenta
de vídeo (su propia cabecera: *"V0-6: cuenta realista para grabar el vídeo comercial (60s)"*).

**Sí lo usa el proyecto, de tres formas medibles, ninguna es "nadie":**

1. **El vídeo V0-6 sigue sin grabar.** El guion está citado y en revisión activa en varios tickets
   de hoy mismo (SCRUM-1016, comentario Jira 16200, ítem #10: *"no está grabado... urge corregir el
   guion antes de rodar"*). Mientras el vídeo no exista, alguien va a necesitar ejecutar este script.
2. **Diez ficheros de `tests/` leen su código fuente como texto y hacen cumplir invariantes sobre
   él** (URL de BD sin parseo a mano, actor `semilla` declarado, sin firmas fabricadas, sin segunda
   normalización de catálogo, `destinoSembrable` antes de escribir…). Un script muerto no se
   protege con diez guards activos — se borra el script y los guards con él. Nadie lo ha hecho.
3. **`public/index.html:599` y tres registros de máster** (`SCRUM-310`, `SCRUM-333`, `SCRUM-374`)
   citan literales que **viven ÚNICAMENTE** en este script como su única fuente. Si se retirara, esos
   tres expedientes quedarían citando un fichero que ya no existe.

**Conclusión del PASO 0: se repara, la premisa de Javier se sostiene.** No doy la vuelta atrás.

## 2 · El defecto, confirmado en rojo antes de tocar nada

`tx.merchant.create()` (línea ~355) creaba el merchant sintético con `country: 'ES'` y **sin**
`flags`. Desde SCRUM-1027 (21-sep-2026, regla 24), `allocateInvoiceNumber` para un merchant ES sin
el override `INVOICING_ES_ENABLED` **lanza `invoicing_es_disabled`** en cuanto el script intenta
emitir el primer documento de cobro (primer presupuesto aceptado) — y al estar todo dentro de un
único `prisma.$transaction`, la transacción entera revierte: **0 filas**, el script no siembra
nada, sin decir por qué a simple vista.

Y el propio comentario de la línea 352 seguía describiendo el comportamiento VIEJO: *"emite
JUSTIFICANTES (J-)"*. Falso por partida doble: (a) desde SCRUM-1027 ya no emite nada sin el
override, y (b) el tipo de documento "justificante" es lo que el fundador decidió retirar en
SCRUM-825 (su ejecución en código sigue parada — `Invoice.type` sigue aceptando `'JUST'` como string
libre — pero ya no es la descripción correcta de lo que este script debe fingir que hace).

## 3 · El arreglo — solo el script, nada de `src/` ni del camino de emisión

Un único campo añadido al `tx.merchant.create()`:

```js
flags: { INVOICING_ES_ENABLED: true }, // SCRUM-1098: override, sin él no emite NADA
```

Mismo patrón y mismo nombre de flag que ya usan `scripts/cambiar-flag-fiscal.mjs` y el test
`tests/scrum81-allocate-flags.test.mjs` (`Merchant.flags Json?` — Parte P, `{FLAG_NAME: bool}`,
precedencia merchant > país > env, la lee `core/flags.ts`). Con el override, `allocateInvoiceNumber`
resuelve modo FISCAL y emite serie `F1` — el propio `type: isReceiptNumber(invoiceNumber) ? 'JUST'
: 'F1'` (línea ~541) no hizo falta tocarlo: con el override, `isReceiptNumber` nunca es `true`, así
que esa rama queda inalcanzable pero no rota — no es su ticket arreglar SCRUM-825, así que la dejo
tal cual en vez de borrar código que no es mío decidir.

Reescritos los tres comentarios que describían el comportamiento viejo (líneas ~352, ~488, ~525) para
que digan lo que pasa HOY: factura fiscal con el override, no justificante.

**No toqué:** `src/`, el camino de emisión, `scripts/_db-guard.mjs` (`destinoSembrable` sigue
bloqueando producción exactamente igual — no se tocó ni una línea de ese fichero), ni ningún guard.

## 4 · Verificado — build + los diez guards que leen este fichero, en rojo antes / verde después

- **Rojo confirmado antes de tocar nada:** lectura directa del código — el `tx.merchant.create` sin
  `flags` y el camino de `allocateInvoiceNumber` (`src/modules/invoicing/domain/invoiceNumber.service.ts:506`)
  que lanza `invoicing_es_disabled` para cualquier merchant `country==='ES'` sin `flags.INVOICING_ES_ENABLED`
  — confirmado también por `tests/scrum81-allocate-flags.test.mjs` y `tests/scrum1027-atajo-flag-off-sin-documento.test.mjs`,
  que ya cubren ese camino con mocks (no hacía falta reproducirlo aparte).
- `npm run build` — sin errores (con `npm ci` primero: el worktree nació sin `node_modules` frescos).
- Los **10 ficheros de test** que leen `scripts/seed-video.mjs` como fuente: **49 pass · 0 fail · 0
  skip**, TAP a fichero fuera del árbol, comprobado con `grep -c "^not ok "` (no con `| tail`).
  `scrum381-semilla`, `scrum226-url-bd-sin-parseo-a-mano`, `scrum472-seed-no-fabrica-firmas`,
  `scrum761-sembrador-columnas-derivadas`, `scrum746b-guarda-en-la-conexion`,
  `scrum374-direccion-sin-escritores`, `scrum333-tarjetas-gremio`.

## 5 · 🔴 Lo que NO pude hacer, y lo digo en vez de callarlo: no lo ejercité contra una BD real

El encargo pide correr el seed de verdad, no solo compilar. **No tengo cómo, en este puesto:**
esta máquina no tiene Postgres ni Docker instalados (`which postgres`/`docker`/`pg_ctl`: los tres
sin resultado), y este worktree (`cobroflash-jv3`) no tiene `DATABASE_URL`, `DATABASE_URL_STAGING`
ni `DATABASE_URL_DEV` en su entorno ni ningún `.env.local` — medido con `env | grep DATABASE_URL`
(vacío) en Bash y `Get-ChildItem Env:` en PowerShell (vacío también). No he buscado ni pedido
credenciales por otra vía (regla 9: los secretos los pega el fundador directo en Railway).

Así que **esta entrega es "arreglado y verificado en frío", no "reparado"** en el sentido literal
que pedía el encargo — la parte que falta es correr `node scripts/seed-video.mjs` de verdad contra
una base (DEV o STAGING desechable) y comprobar que las filas se crean y el `type` de las facturas
sale `F1`. Dejo la rama en **borrador, auto-merge desarmado**, a la espera de que alguien con
`DATABASE_URL_DEV`/`STAGING` en su entorno lo ejecute, o me dé la variable por el canal que
corresponda (nunca en el chat).

`_db-guard.mjs` (`destinoSembrable`) sigue exigiendo `SEED_VIDEO_CONFIRM=<hostname>` antes de
escribir en cualquier caso — producción queda bloqueada igual que hoy, no lo cambié.
