# SCRUM-484 · Los motores sin cable: la lista leída, no el recuento

**Medido contra:** `origin/main` = `75b2b01820f71bdb1bf2b3244b19f801d69e24f6` · 2026-08-12T09:59:54+02:00
**Medido en:** host `DESKTOP-T5MONF5` · **Cero cables, cero schema, cero emisión.** Esto entrega el mapa.

---

## Lo que NO he reconstruido, y por qué

**El mecanismo ya existe y es mejor que el que yo habría escrito:** `tests/_alcance-dominio.mjs`
(SCRUM-411). Alcanzabilidad **por EXPORT**, no por módulo; grafo desde entradas reales
(`src/index.ts`, `src/app.ts` **y los `scripts/*.mjs` que `package.json` declara**, derivados);
`tests/` fuera a propósito — que es justo la trampa del encargo. Y lleva escrita dentro la lección
que lo hizo posible: *«un módulo vivo por una constante ESCONDE una función muerta»*.

Mi trabajo es el otro: **leer la lista y clasificarla.**

## 🔴 1 · El trinquete de 411 cuenta MÓDULOS, y tres de tus cinco no son módulos

| | |
|---|---|
| módulos **enteros** inalcanzables | **8** |
| exports **huérfanos dentro de módulos vivos** | **189** (+1 falso positivo, abajo) |

**De los cinco que nombraste:** `recargoEquivalencia` y el IRPF de A2 (`retencionIrpf`) son módulos
enteros — salen. **`justificante.ts`, `metodoParaAgrupar` (`metodoDeCobro.ts`) y `PAID_VIA`
(`paidVia.ts → esPaidViaValido`) NO son módulos inalcanzables: son funciones muertas dentro de
módulos vivos.** El trinquete de 411 **no puede verlas**, porque cuenta módulos.

> Ésa es la respuesta a «no hay ningún rojo que se encienda por esto»: sí lo hay, pero mide una de
> las dos poblaciones, y la que se te aparece cinco veces en 48 horas es **la otra**.

## 🔴 2 · Límite MEDIDO del instrumento, antes de publicar ningún número

`nombresImportados` solo lee imports **estáticos**. Un `const { X } = await import('…')` ata el
módulo (el grafo sí lo sigue) pero **no ata el nombre**, así que ese export sale como huérfano sin
serlo.

**Lo he acotado en vez de declararme ciego a medias:** los nombres desestructurados de un import
dinámico en `src/` son **cinco** (`getFoundingStatus`, `recordCustomerEvent`, `sendInvoiceEmail`,
`generateQuotePdf`, `sendQuoteEmail`) y de ellos **solo UNO** aparece en la lista:

* 🔴 **falso positivo: `email.service.ts → sendQuoteEmail`** — lo llama `quotesAdmin.routes.ts` por
  import dinámico.

**Y de los 8 módulos inalcanzables, contaminados: CERO.** Así que **los 8 son firmes** y el 190 es
**189 reales + 1 nombrado**. No toco `_alcance-dominio.mjs`: es el guard de otra sesión y arreglarlo
es su ticket (regla 9).

## Controles, antes de la lista

* **SUELO:** cero inalcanzables aborta por «CIEGO» — sabemos que hay al menos cinco. Salieron 8.
* **CONTROL NEGATIVO:** el camino de emisión (`invoiceNumber.service`, `verifactu`,
  `registro.builder`) **tiene** llamadores y **no** sale en la lista. Si saliera, el detector marca
  de más y el censo entero no vale.
* **Los tests no cuentan como llamador.** Es la trampa que hacía que los cinco parecieran vivos.

---

# LA LISTA · los 8 módulos, clasificados

> La clasificación sale de **lo que cada módulo declara en su propia cabecera**, no de lo que yo
> suponga. Donde no lo declara, lo digo.

### 1 · `invoicing/domain/recargoEquivalencia.ts` — **espera schema + STOP emisión**
`RECARGO_POR_TIPO_IVA` · `calcularRecargo` · `calcularRecargoDeFactura` · `leerRecargoDelCliente`
Necesita el campo de régimen en `Customer` (hoy `Customer` no tiene ninguno) y enchufarlo cambia
`Invoice.total`, que va **sellado**, y el desglose del XML.
> **Hoy un profesional que vende a un cliente en recargo no puede facturarle bien: le emite una
> factura sin recargo, y ese recargo lo tiene que ingresar él.**

### 2 · `invoicing/domain/retencionIrpf.ts` — **espera schema** (lo declara él mismo)
`TIPOS_RETENCION` · `esTipoRetencionValido` · `calcularRetencion` · `liquidoAPercibir` ·
`bloqueRetencion` · `leerTipoRetencion`
Su cabecera: *«ESTE MÓDULO NO LO LLAMA NADIE TODAVÍA, Y ESO ES DELIBERADO… los campos que hacen
falta necesitan migración, y las migraciones están paradas»*.
> **Un profesional que factura a empresa con retención no puede: la factura sale por el bruto y el
> líquido a percibir lo calcula a mano.**

### 3 · `invoicing/domain/criterioCaja.ts` — **falta el cable** (+ gate regla 24)
`ADVERTENCIA_CAJA` · `clasificarPorCobro` · `leerCriterioCaja`
Clasifica y avisa; no liquida. Nadie lo enseña en ninguna pantalla ni informe.
> **Un profesional en criterio de caja no ve en ningún sitio qué IVA le toca declarar este
> trimestre, aunque el producto sepa calcularlo.**

### 4 · `invoicing/domain/finalInvoice.service.ts` — **falta el cable + STOP emisión**
`buildFinalInvoice` — motor puro de la factura final con deducción de anticipos y tramos ya
facturados, con las referencias que la hacen auditable.
> **Quien cobró una señal no puede emitir la factura final descontándola: o factura de más, o
> resta a mano y pierde el rastro de qué descontó.**

### 5 · `invoicing/domain/huecosSerie.ts` — **falta el cable**
`MAX_SEQ_BARRIDO` · `huecosDeLaSerie`
Su cabecera: el competidor pone un aviso en gris; esto **comprueba** y dice qué números faltan.
> **Nadie le avisa de que en su serie falta el 147 — y eso es lo primero que mira una inspección.**

### 6 · `jobs/domain/albaranSerie.ts` — **falta el cable**
`componerNumeroAlbaran` · `huecosDeAlbaranes` · `vistaPreviaAlbaran`
> **No ve qué número le va a tocar al siguiente albarán ni si le falta alguno.**

### 7 · `jobs/domain/ventanaDeFirma.ts` — **falta el cable**
`FUENTES_DE_SUELO` · `elegirSuelo` · `contrastarReloj` · `cruzaDias`
Su cabecera: la fecha de una firma depende hoy **del reloj que controla el usuario**; firmando sin
red, el trazo sube días después y el servidor lo sella al llegar.
> **Una firma hecha el día 30 sin cobertura y subida el día 2 queda fechada el 2 — y puede cruzar
> de mes o de trimestre.**

### 8 · `system/domain/flagFiscal.service.ts` — **espera decisión de producto (del fundador)**
`FLAGS_FISCALES` · `esFlagFiscal` · `ErrorCambioFlag` · `cambiarFlagFiscal`
Su cabecera: encender `INVOICING_ES_ENABLED` para un merchant real es **la acción de mayor
consecuencia del producto**, y hasta hoy era un UPDATE a mano contra la base: sin actor, sin
momento y **sin poder acreditarle a una inspección desde cuándo emite**.
> **Nadie puede encender la facturación fiscal de un merchant dejando rastro; se hace a mano contra
> la base — que es exactamente lo que este módulo vino a impedir.**

**Ninguno es «muerto, se retira».** Los 8 tienen destinatario y motivo; lo que falta es el cable, un
campo, o una decisión.

---

# Los huérfanos dentro de módulos vivos — 189, y los que más pesan

No los clasifico todos: serían 189 juicios y el encargo pide leer, no inventariar. **Los que un
profesional nota**, con su fichero:

| export huérfano | qué no puede hacer hoy un profesional |
|---|---|
| `system/domain/borradoMerchant.ts → borrarMerchant` | 🔴 **pedir que borren su cuenta y sus datos.** Es RGPD-1, y su ticket (SCRUM-244) está **CERRADO** |
| `billing/domain/metodoDeCobro.ts → metodoParaAgrupar` · `paidVia.ts → esPaidViaValido` | agrupar sus cobros por método fiable: la validación existe y no se aplica |
| `expenses/domain/justificante.ts → avisaDeSimplificado`, `VEREDICTO`, `INCOHERENCIA` | que le avisen de que **con un ticket no puede deducir el IVA** (E3), aunque el veredicto esté construido |
| `messaging/domain/constanciaCorreo.ts → ESTADOS_CORREO, idDeLaRespuesta, avanzar` | saber si su correo llegó — es SCRUM-475/478, **con la tabla parada a propósito** |
| `exports/domain/portabilidadRegistro.ts → solicitudesPendientes, fechaLimite…` | que alguien vea si su solicitud de portabilidad se atendió dentro de plazo |
| `jobs/domain/albaran.service.ts → verificarEvidenciaAlbaran, recomputarHashDeEvidencia` | comprobar que la evidencia de una firma no se ha alterado |

⚠️ **`sendQuoteEmail` NO está en esta tabla**: es el falso positivo medido arriba.

---

## Lo que este censo NO cubre, declarado

* **El import dinámico por nombre** — acotado a 1 caso, no arreglado (fichero de otra sesión).
* **`import * as x`**: el analizador da el módulo por vivo entero, así que **puede esconder
  huérfanos**. El 189 es un **suelo**, no un techo.
* **El frontend**: `public/` es vanilla y no entra en este grafo. Un motor de `src/` que solo
  consumiera el navegador saldría aquí como huérfano; no he encontrado ninguno de los 8 en ese caso,
  pero no lo he medido export por export.
* **No he clasificado los 189.** Lo que entrego de ellos son los seis que más pesan, nombrados.

## Lo que NO se ha hecho

**Cero cables**: no he enchufado ninguno de los 8, ni tocado `prisma/schema.prisma`, ni el camino de
emisión, ni el guard de SCRUM-411. **No he retirado nada**: ningún módulo salió como muerto.
