# SCRUM-795 · Quién crea clientes, y quién se los queda

**Fecha:** 6-sep-2026 · **Carril:** producto · backend clientes — **MEDICIÓN** · **Gate:** sin gate
**Medido contra:** `origin/main` = `95be56e4dd523b45d3046bda8cf09578ff953ab8` · 2026-09-06T21:38:12+01:00
**Tanda:** 5692 tests, 5596 pass, 0 fail, 96 skipped

> 🛑 **ESTE TICKET NO ARREGLA NADA.** Ni una línea de `src/`, ni `prisma/schema.prisma`, ni
> `ensurePortalToken` (lo lleva SCRUM-767). Lo único que se entrega es
> `scripts/_censo-alta-de-cliente.mjs`, un instrumento de medición — no un guard.

---

## 🔴 EL CONTROL QUE DECIDE — provocado por el camino real, contra desarrollo

Handler **compilado y real** de `charges.routes.ts`, montado en express, base doblada por
`global.prisma` (el punto que ofrece `prisma.ts:13`), contra `…/yaqu_dev_javier` verificado como
DESARROLLO por `_db-guard.mjs` antes de abrir nada.

```
POST /charges → HTTP 201
  cliente id=902  merchantId=1  portalToken=NULL
  cargo   id=136  merchantId=1006
  merchant que hizo la petición : 1006
  merchant DUEÑO del cliente    : 1

¿LO VE ALGUIEN QUE NO DEBERÍA?
  listando como merchant 1 (demo)      : 1 coincidencia 🔴 id=902
  listando como merchant 1006 (el suyo): 0 coincidencias
```

**Sí aparece.** El demo lo ve; el dueño no ve a su propio cliente.

### Pero el diagnóstico de partida era inexacto, y en los dos sentidos

El encargo decía «un cliente sin merchantId… un registro que no pertenece a nadie». **Medido en el
schema:**

```prisma
merchantId  Int  @default(1) @map("merchant_id")
```

No es nullable. **No nace sin dueño: nace del merchant 1, que es el demo (regla 8).** Menos grave
que «de todos» —no lo ve cualquiera—, y más grave en la otra dirección: el dato aterriza en una
cuenta real y operada, y el profesional que lo creó **pierde a su cliente de su propia lista**.

### Lo que acota la urgencia, medido y no supuesto

- **`/charges` no es público:** `app.ts:334` → `app.use('/charges', requireInternalSecret, chargesRouter)`.
- **Ningún llamador del árbol hace `POST /charges` con `customer` dentro.** El panel usa
  `/admin/charges/…`, que es otro router; `app.ts:305` dice que a `/charges` lo llama CI.
- **0 cargos con cliente de otro merchant** en desarrollo (foto de las 20:0x del 6-sep-2026).

---

## ① EL CENSO DEL ALTA — `scripts/_censo-alta-de-cliente.mjs`

Por AST y con la población **derivada del schema**: qué modelos existen y qué forma tiene su
`merchantId` sale de leer `prisma/schema.prisma`. Ninguna lista cableada — sería un censo
congelado el día que se escribió (SCRUM-778).

**Sobre `src/` + `scripts/`, árbol `95be56e4`: 91 creaciones de fila, 7 de `Customer`.**

| camino | `merchantId` | `portalToken` |
| --- | --- | --- |
| `src/modules/billing/app/routes/charges.routes.ts:24` | **NO** | **NO** |
| `src/modules/system/customerAdmin.ts:147` (`createCustomer`) | sí | sí |
| `src/modules/whatsappBot/domain/botFlow.service.ts:264` | sí | **NO** |
| `scripts/e2e-critico.mjs:122` | sí | **NO** |
| `scripts/medir-concurrencia-emision.mjs:96` | sí | **NO** |
| `scripts/seed-staging.mjs:110` | sí | **NO** |
| `scripts/seed-video.mjs:390` | sí | **NO** |

**Vía `createCustomer` (el camino real): 4 llamadores** — `customersAdmin.routes.ts:106`,
`scripts/seed-demo.mjs:301`, y dos del panel (`customersView.js:1481`, `homeView.js:1240`).

**Creaciones ANIDADAS de `Customer` (`{ Customer: { create: … } }`): 0.**
**En `tests/`: 281 creaciones, 78 de `Customer`, 0 donaciones.**

### ✅ Control positivo — los tres caminos conocidos

| camino | resultado |
| --- | --- |
| `botFlow.service.ts:264` | ✔ lo ve (creación directa) |
| `charges.routes.ts:24` | ✔ lo ve (creación directa) |
| sembrador (`seed-demo.mjs`) | ✔ lo ve — **pero ya no como creación directa** |

🔴 **El tercero cambió de cubo mientras medía, y se dice en vez de esconderse:** al mezclar `main`
entró **SCRUM-767**, que pasó el sembrador a `createCustomer(DEMO_ID, c)`. El censo lo encuentra,
en la lista de llamadores del camino real. En la foto anterior (antes de mezclar) aparecía como
`scripts/seed-demo.mjs:276`, creación directa con `portalToken` no escrito.

---

## ② 🔴 LA DONACIÓN SILENCIOSA — la cifra que decide

**De los 27 modelos del schema, 23 tienen `merchantId`. De esos, EXACTAMENTE UNO lo tiene con
`@default(1)`: `Customer`.**

| forma de la columna | modelos | creaciones | **omiten `merchantId`** | no se sabe |
| --- | --- | --- | --- | --- |
| `@default(1)` | 1 (`Customer`) | 7 | **1** | 0 |
| nullable (`Int?`) | 1 (`BotSession`) | 1 | 0 | 0 |
| obligatorio | 21 | 71 | 0 | 7 |

> ### 🔴 **UN (1) `create` en todo el árbol omite `merchantId` sobre una columna con `@default(1)`:**
> ### `src/modules/billing/app/routes/charges.routes.ts:24`

**✅ Control positivo del punto 6:** el censo encuentra ese camino, que es el que ya sabíamos que
omite el `merchantId`. Sin eso, la cifra de arriba no valdría.

**Por qué el resto no es riesgo silencioso:** en una columna **obligatoria** una omisión no dona,
**Prisma se niega** — el fallo es ruidoso y sale al primer intento. Los 7 «no se sabe» son todos
de columna obligatoria (`Albaran`, `AlbaranLineaFacturada` ×2, `Job`, `WhatsAppMessage`,
`AuditLog` ×2) y construyen su `data` fuera del literal o con spread: **no se dan por buenos ni
por malos, se declaran**.

**La superficie del riesgo es, por tanto, `Customer` y sólo `Customer`.** Cualquier decisión sobre
el `@default(1)` afecta a un modelo, no a veintitrés.

---

## ③ LA FICHA 360 CONTRA LA LISTA — recomendación, no construcción

| | qué hace | consecuencia |
| --- | --- | --- |
| **LISTA** (`customersView.js:630`) | pinta «Portal» **siempre**; al pulsar llama a `GET /admin/customers/:id/portal-url` | siempre funciona — **porque ese GET ESCRIBE**: `ensurePortalToken` hace `prisma.customer.update` |
| **FICHA 360** (`customerDetailView.js:76`) | pinta `🔗 Portal` **sólo si** `customer.portalUrl` | sin token **el botón no existe**. No falla el enlace: desaparece, sin decir nada |

El detalle calcula `portalUrl` en crudo (`customersAdmin.routes.ts:262`):
`customer.portalToken ? url : null`. No cura.

### Cuál es la correcta, y qué recomiendo

**Ninguna de las dos lo es del todo, y la que «funciona» lo hace por el motivo equivocado:** la
lista sólo acierta porque hay una **escritura dentro de un GET**. Eso no es el patrón a extender.

**Recomiendo el arreglo DE PANTALLA:** que la ficha 360 pinte el botón **siempre**, como la lista,
y llame al mismo `/portal-url` al pulsar. Motivos:

1. **No añade una segunda escritura dentro de un GET.** Hacer que el endpoint del detalle cure
   convertiría *otro* GET —el de la ficha, que se llama al abrirla— en una escritura, y encima una
   que se dispara sola sin que nadie pulse nada.
2. **Alinea las dos pantallas en un solo comportamiento**, que es lo que hoy no pasa.
3. **No toca `ensurePortalToken`**, que lleva otra sesión (SCRUM-767).

⚠️ Y la salvedad honesta: eso deja en pie la escritura-dentro-de-GET que ya existe. **No la
resuelve, la contiene.** Si se quiere quitar, es otro ticket y no es de pantalla.

---

## ④ LOS CLIENTES SIN TOKEN, POR ORIGEN

> ⚠️ **FOTO de una base COMPARTIDA.** `…/yaqu_dev_javier`, **2026-09-06T20:25:52Z**. Otras
> sesiones la editan mientras se mide.

**14 clientes · 11 sin token · 3 con token.**

| origen | cuántos | cómo se atribuye |
| --- | --- | --- |
| **sembrador** (`seed-demo.mjs`) | **7** | merchant 1, creados en el mismo segundo (05:20:47–49), y **los seis nombres comprobados están en el fuente del sembrador** (control negativo del mismo grep: 0) |
| **fixtures de test** (`scrum74` / `scrum85`) | **3** | «Cliente Secreto QA-S74-A», merchants 114/173/210 |
| **sin atribuir** | **1** | «Cliente QA», merchant 2, 23-jul-2026. Con las señales disponibles no se puede decir de dónde salió |

Suma: 7 + 3 + 1 = **11** ✔. No hay columna de origen: la atribución se **infiere** de merchant,
sello de tiempo y nombre, y donde no llega **se declara sin atribuir** en vez de repartirse.

---

## 🔴 LA BASE DE DEV SE MUEVE — y lo mediste tú mismo en mí

Tres censos míos del mismo día, sobre la misma base:

| hora (UTC) | clientes | sin token |
| --- | --- | --- |
| ~20:0x | 17 | 14 |
| ~20:2x (tras mi provocación y su limpieza) | 16 | 13 |
| 20:25:52 | **14** | **11** |

La diferencia **no es error mío**: comparando merchant a merchant, entre la primera y la segunda
desapareció el cliente del **merchant 1002** —limpieza de otra sesión— y mi propia fila sí volvió
(merchant 1: 7 → 8 → 7). **Toda cifra de dev de aquí en adelante lleva su hora.** El «11 de 14»
del encargo era cierto, dejó de serlo, y volvió a serlo en cinco horas.

---

## HUECOS DECLARADOS

**a) Lo que el censo NO ve**, y por qué no se da por bueno: `data` construido fuera del literal,
receptor con alias (`const t = tx.customer`), SQL en crudo, y migraciones a mano. Los dos primeros
salen como **«no se sabe»**, que es un resultado distinto de «omite».

**b) El censo mide `src/` y `scripts/`.** `tests/` se midió aparte (0 donaciones) y `public/` sólo
para los llamadores de `createCustomer`.

**c) Un defecto propio, corregido leyendo la primera salida.** El censo marcaba ILEGIBLE cualquier
literal con `...spread`, y con eso `createCustomer` —el único camino que hace las dos cosas bien—
salía como «no se sabe». La regla correcta es asimétrica: clave **visible** = la escribe (haya
spread o no); **ausente sin spread** = la omite; **ausente con spread** = no se sabe.

**d) `DATABASE_URL_TESTS` no se puede verificar en este worktree:** `b16` no está dado de alta en
`DESTINOS_ESPERADOS…porWorktree`. **No se ha dado de alta**, porque no sé qué base le toca a este
carril e inventármelo sería aprobar a ciegas. No hizo falta: sólo se usó `_DEV`.

**e) La tanda gateada (`npm run test:staging:gated`) NO se ha corrido:** necesita staging y su
turno. Este ticket no toca ninguna ruta ni el schema.

**f) Limpieza de lo sembrado en dev:** 0 clientes y 0 merchants con la marca `QA795`, verificado.
La primera limpieza me falló —usé un modelo inexistente, `chargeEvent`— y dejó tres filas; se
borraron en una segunda pasada comprobada.
