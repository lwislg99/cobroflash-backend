# TAREA ACTIVA — SCRUM-69 · FACT-1: bandeja "Pendientes de facturar" + semáforo de plazo

> Gobierna: `docs/YAQU_MASTER.md` + ticket **SCRUM-69** (Medium, nace de la investigación de
> albaranes del 17-jul) + recon propio (23-jul, aprobado) + DECIDE de esta sesión, más abajo.
> Depende de SCRUM-17 (motor de rotura por mes natural, ya en prod). Carril A, sin schema
> destructivo. 🚨 ZONA: toca `Customer` (schema aditivo) — **STOP de diff antes de cualquier
> db push**, y confirmar con el fundador que no hay otro schema en vuelo antes de tocar
> staging/prod (se hizo en el recon: limpio a 23-jul).

## LA TAREA EN UNA FRASE

Ningún software revisado avisa del plazo legal del art. 13 RD 1619/2012 para agrupar partes de
trabajo en una factura recapitulativa (fin de mes natural para particulares, día 16 del mes
siguiente para empresarios) — YaQu sí, con una bandeja que agrupa lo firmado-y-no-facturado
por cliente y mes, y un semáforo que avisa ANTES de que el plazo venza.

## DECISIONES DEL FUNDADOR (23-jul, aplicadas — NO reabrir)

1. **"Emitidas" es la pestaña por defecto** al abrir Facturas — quien pulsa "Facturas" espera
   ver facturas. "Pendientes" lleva **badge/contador** cuando hay grupos ámbar o rojo: la
   urgencia se ve sin rehacer la expectativa del usuario.
2. **`tipoDestinatario` SIN banner global.** Silencio con el criterio más restrictivo
   (PARTICULAR) por defecto. Se ofrece editar en la **ficha del cliente** (no hay prompt
   forzado en ningún flujo — decisión V1: solo el punto 3 de "fuera de alcance").
3. **Importe potencial SÍ entra en V1** — es el gancho comercial. Copy obligatorio: **"pendiente
   de facturar"**, JAMÁS "pendiente de cobro" (son cosas distintas: facturar ≠ cobrar).
4. **Copy del estado rojo (plazo vencido)**, aprobado:
   > "El plazo de este mes venció — ya no se puede agrupar en una recapitulativa de [mes].
   > Puedes facturar estos partes igualmente (factura individual o recapitulativa del mes en
   > curso); si tienes dudas, consúltalo con tu asesor."
   (cambio respecto al recon: "coméntaselo a tu gestoría si quieres regularizarlo" →
   "si tienes dudas, consúltalo con tu asesor" — "regularizar" sonaba a que el usuario hizo
   algo mal).

## 0. CONTEXTO REAL (del recon 23-jul — confírmalo, no lo re-descubras)

- El motor de rotura por mes natural **ya existe y es 100 % reutilizable**:
  `groupByRotura`/`validarConsolidacion`/`mesNaturalKey`/`mesNaturalLabel`
  (`src/modules/jobs/domain/albaran.service.ts:148-211`) — puro, sin BD, ya testeado (SCRUM-17).
- **No existe ningún endpoint de listado agregado de albaranes** — todo lo que hay hoy es por
  Job individual (`POST /admin/jobs/:id/consolidar-albaranes`, `jobs.routes.ts:473`) o por
  albarán suelto (`albaranesRouter`, montado en `/admin/albaranes`, `app.ts:254`). La bandeja
  es un endpoint genuinamente nuevo, a nivel MERCHANT (cruza Jobs y clientes).
- `validarConsolidacion` ya excluye `Job.tipoOperacion === 'TRABAJO_UNICO'` — la bandeja hereda
  esa regla gratis, sin decisión nueva.
- `calcAlbaranTotales` (`albaran.service.ts:102-124`) ya calcula base/cuota/total en céntimos
  enteros — reutilizar para el importe potencial, no reimplementar aritmética.
- Cliente: `customerAdmin.ts` — `CUSTOMER_SELECT_NO_TOKEN` (línea 16-19) es el allowlist que
  hay que ampliar; `updateCustomer` (línea 57) ya acepta cualquier campo de
  `CustomerUpdateInput` (Zod, `core/validation/schemas.ts`) sin cambios de lógica — solo hay
  que sumar el campo al schema Zod y al `SELECT`.
- Dashboard: sidebar plano de 15 `nav-item` (`public/dashboard/index.html:24-125`); "Facturas"
  = `data-view="invoices"` (línea 91) → `invoicesView.js`, hoy lista simple sin tabs.

## 1. ALCANCE EXACTO

### 1.1 Schema (aditivo) — 🚨 STOP, enséñame el diff antes del db push

```prisma
// Customer
tipoDestinatario String? @map("tipo_destinatario") // PARTICULAR | EMPRESARIO — null = sin clasificar (se trata como PARTICULAR en cálculo, nunca se escribe el default)
```

Nullable, **SIN `@default` en la BD** — a propósito: así se puede distinguir "nunca
clasificado" (null) de "clasificado como particular" en el futuro (p. ej. para un aviso
agregado tipo "N clientes sin clasificar"), aunque V1 no lo use. El criterio seguro
(PARTICULAR) se aplica en CÓDIGO, no en el schema.

### 1.2 Dominio (nuevo, `src/modules/jobs/domain/pendientesFacturar.service.ts`, puro donde se pueda)

- `resolveTipoDestinatario(customer): 'PARTICULAR' | 'EMPRESARIO'` → `customer.tipoDestinatario ?? 'PARTICULAR'`.
- `fechaLimiteRecapitulativa(mesKey, tipoDestinatario): Date` → último día de `mesKey` si
  PARTICULAR; día 16 del mes siguiente si EMPRESARIO.
- `calcularSemaforo(fechaLimite, hoy = new Date()): 'verde' | 'ambar' | 'rojo'` →
  `diasHastaLimite = diffDays(fechaLimite, hoy)`; `rojo` si `< 0`; `ambar` si `0..5`; `verde`
  si `> 5`.
- `getPendientesFacturar(merchantId, prisma)`:
  1. `prisma.albaran.findMany({ where: { merchantId, estado: 'firmado', modoValoracion: 'VALORADO', invoiceId: null, job: { tipoOperacion: { not: 'TRABAJO_UNICO' } } }, include: { job: { select: { customerId: true } } } })`.
  2. Agrupar por `customerId` → dentro de cada uno, `groupByRotura()` (reuso literal).
  3. Por grupo: `calcAlbaranTotales()` sumado → importe potencial; `calcularSemaforo()` con el
     `tipoDestinatario` del cliente.
  4. Devuelve `{ customerId, customerName, grupos: [{mesKey, mesLabel, albaranes, importePotencial, semaforo, fechaLimite}] }[]`.

### 1.3 Endpoint

`GET /admin/albaranes/pendientes-facturar` (nuevo, en `albaranesRouter` ya montado en
`/admin/albaranes` — cero mount nuevo). Rol: cualquiera con acceso a Facturas (confirmar contra
`adminRouteDeclarations.ts` si Técnico ve Facturas hoy; replicar el mismo gate que ya tenga
`/admin/invoices`, no inventar uno nuevo).

### 1.4 Cliente — exponer/editar `tipoDestinatario`

- `customerAdmin.ts`: sumar `tipoDestinatario: true` a `CUSTOMER_SELECT_NO_TOKEN`.
- `core/validation/schemas.ts`: sumar `tipoDestinatario: z.enum(['PARTICULAR','EMPRESARIO']).nullable().optional()` a `CustomerCreateInput`/`CustomerUpdateInput`.
- Sin endpoint nuevo: `PUT /admin/customers/:id` ya acepta el campo en cuanto esté en el Zod.

### 1.5 UI

- `invoicesView.js`: tabs **"Emitidas"** (default, contenido actual intacto) / **"Pendientes"**
  (nueva). Badge en la pestaña "Pendientes" = nº de grupos ámbar+rojo (0 = sin badge).
- Pendientes: tarjetas por cliente→mes — importe potencial, semáforo (punto de color +
  etiqueta), fecha límite. Estado rojo: copy aprobado arriba, con botón/enlace a
  "Consolidar" (reusa el flujo ya existente de `jobDetailView.js`, no se duplica UI de
  selección — la bandeja es un LISTADO que lleva al flujo que ya existe, no un flujo nuevo).
- `customerDetailView.js` (o el form de edición de cliente que ya exista): un select
  "Tipo de cliente" (Particular/Empresa), sin banner, sin obligatoriedad.

## 2. FUERA DE ALCANCE V1

- Notificación proactiva in-app/WhatsApp (días 25-28, día 14) — capa aparte (cron + plantilla),
  ticket propio si se prioriza.
- Prompt forzado de `tipoDestinatario` en el flujo de consolidar — decisión 2: solo ficha del
  cliente.
- Aviso agregado "N clientes sin clasificar" — el campo nullable lo deja preparado, no se
  construye ahora.

## 3. 🚨 STOP CONDITIONS

- Diff del schema (`Customer.tipoDestinatario`) antes de CUALQUIER `db push`/`db execute`.
- No tocar staging/prod sin avisar al fundador — y revisar (`git worktree list` + merge-base
  contra `main`) que no hay otro schema en vuelo, mismo susto que SCRUM-95/SCRUM-102.
- Si el gate de rol de `/admin/invoices` no es trivial de replicar (p. ej. difiere de lo
  esperado), parar y preguntar antes de inventar una categoría nueva.

## 4. TESTS

- Puros: `fechaLimiteRecapitulativa` (fin de mes particular; día 16 empresario; meses de 28-31
  días; diciembre→enero), `calcularSemaforo` (fronteras exactas: 0, 5, 6, -1 días),
  `resolveTipoDestinatario` (null→PARTICULAR).
- Gateado (BD): `getPendientesFacturar` — excluye `TRABAJO_UNICO`, excluye `invoiceId != null`,
  excluye `SIN_VALORAR`, agrupa bien multi-cliente y multi-mes.

## 5. DEFINICIÓN DE HECHO

Schema aplicado (staging → OK fundador → prod, mismo orden que SCRUM-95) + dominio puro +
endpoint + UI (tabs + badge + ficha cliente) con build/test verdes. PR con descripción; ticket
a "En revisión".
