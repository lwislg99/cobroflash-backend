# SCRUM-577 · CONT-04: los dos campos YA existen — y los documentos los usan AL REVÉS de lo que dice el ticket

**Fecha:** 24-ago-2026 · **Carril:** producto (bloque A) · **Gate:** 🛑 PARADO en la mitad del documento
**Medido contra:** `origin/main` = `aa9309e7bdf80717373d0273f1d03f01f2008b8c` · 2026-08-24T21:00:00+02:00
**Tanda:** no procede todavía — no se ha escrito código de producto

> ⚠️ Esa hora es la del trabajo de esta rama, no una lectura de reloj — criterio R14.
> El ticket llegó **pegado en el encargo**: el MCP de Atlassian sigue caído.

---

# PUNTO 1 · ¿Existen los dos campos? **SÍ. No hace falta esquema.**

| Campo | Dónde | Tipo |
|---|---|---|
| `Customer.name` | `prisma/schema.prisma:33` | `String` — **obligatorio** |
| `Customer.legalName` | `prisma/schema.prisma:28` | `String?` — opcional, `@map("legal_name")` |

**Ninguno es nuevo, así que no hay diff de esquema que preparar.** Y no es sólo que existan: **ya
significan lo que el ticket quiere**, y se demuestra por lo que LEE cada consumidor — todos
prefieren la denominación legal y caen al otro nombre:

| Consumidor | Línea | Qué hace |
|---|---|---|
| PDF de **presupuesto** | `pdf.service.ts:482` | `customer.legalName \|\| customer.name \|\| '—'` |
| Libro AEAT | `librosAeat.repo.ts:58` | `c.legalName \|\| c.name` |
| Albarán | `albaran.service.ts:637` | `customer?.legalName \|\| customer?.name` |
| Bandeja «pendientes» | `pendientesFacturar.service.ts:218` | `legalName \|\| name` |
| Exportación CSV | `exportData.ts:150` | `c.legalName ?? ''` — columna propia |

Así que `name` es de facto **el nombre con el que se conoce al cliente** y `legalName` **la
denominación legal**. Los dos campos del ticket ya están; lo que no está es lo de abajo.

---

# 🔴 EL HALLAZGO · LA FACTURA NO PUEDE ENSEÑAR LA RAZÓN SOCIAL, Y EL PRESUPUESTO SÍ

El ticket dice, y es su justificación entera:

> «El presupuesto quiere el nombre con el que el cliente se reconoce; la factura quiere la
> denominación legal.»

**Medido: está exactamente al revés.**

| Función | Línea | Su tipo de `customer` |
|---|---|---|
| `generateQuotePdf` (**presupuesto**) | `pdf.service.ts:398`, tipo en `:411-416` | **incluye `legalName`** → y usa `legalName \|\| name` en `:482` |
| `generateInvoicePdf` (**factura**) | `pdf.service.ts:55`, tipo en `:64` | `{ name; email?; phone? }` — **NO incluye `legalName`** |

Y quien alimenta la factura lo confirma: `src/lib/invoicing.ts:113` y `:249` construyen
`customer: { name: inv.customer.name, email, phone }` — **sin `legalName`**.

> 🔴 **Consecuencia:** hoy la **factura** sólo puede imprimir `name`, y el **presupuesto** es el
> único documento que prefiere la razón social. Es la asignación contraria a la que el ticket da
> por buena.

**No es un descuido de tipado que se arregle de paso:** `generateInvoicePdf` es el **camino de
emisión**. Ampliar su tipo y pasarle `legalName` cambia lo que se imprime en una factura — y una
factura emitida no se edita (regla 29). Leerlo para medirlo no es STOP (regla 38); **modificarlo
sí**. Por eso esto para aquí.

---

# LO QUE ESTO LE HACE AL ALCANCE

El encargo decía: «si los dos existen → esto es cablearlos y separarlos en el formulario». Los dos
existen, **pero el trabajo que queda no es el que el ticket suponía**:

1. **Los campos ya están separados en el formulario** (`customersView.js`: `name` y
   `fieldLegalName`). No hay nada que partir.
2. **Lo que falta es que la factura pueda usar la denominación legal** — y eso es camino de
   emisión, no formulario.
3. **Y CONT-18 (SCRUM-589) no puede elegir entre dos valores en la factura**, porque hoy sólo le
   llega uno. Este ticket es su dependencia declarada, y la dependencia real no son los campos
   —que ya están— sino **el dato llegando al documento**.

---

# 🔴 UNA SEGUNDA DECISIÓN, Y ES SOBRE ALGO QUE CONSTRUÍ YO

El ticket dice que en Holded el nombre comercial está **en Empresa Y en Persona**, y que CONT-04
debe hacer lo mismo.

Pero **SCRUM-574 esconde `legalName` en el lado Persona**, y lo hice yo:
`public/dashboard/js/switchFormaJuridica.js:145` → `var SOLO_EMPRESA = ['legalName'];`

Eso fue aprobado en su momento con este razonamiento: la razón social es *la* señal de sociedad, y
el switch existía para relevarla de ese papel. **Ahora este ticket pide lo contrario**, y las dos
cosas no pueden ser verdad a la vez.

⚠️ **No lo cambio por mi cuenta.** Quitar `legalName` de `SOLO_EMPRESA` revierte una decisión
aprobada del ticket anterior; hacerlo en silencio sería deshacer 574 por la puerta de atrás. Es
**una línea** cuando lo decidas.

---

# LO QUE HACE FALTA PARA SEGUIR

1. **¿Se amplía `generateInvoicePdf` para que la factura pueda usar `legalName`?** Es camino de
   emisión (regla 38 / AA1.4) y necesita GO explícito. Sin eso, CONT-04 no tiene mitad de
   documento y CONT-18 se queda sin los dos valores entre los que elegir.
2. **¿La razón social se ve también en el lado PERSONA?** Contradice lo aprobado en SCRUM-574. Una
   línea, tuya la decisión.

**Y lo que SÍ se puede hacer sin ninguna de las dos respuestas:** dejar el **sitio único** para
CONT-18, como se hizo con `IDENTIFICADORES` para SCRUM-590 — que elegir qué nombre sale en cada
documento sea **una tabla** y no un `||` repetido en cinco ficheros. Hoy esa preferencia está
escrita **cinco veces a mano** (las cinco de la tabla del punto 1), y ésa es la forma en la que
CONT-18 nace cara.

---

## Lo que NO cubre este documento

* **No se ha escrito código de producto.** Ni el formulario, ni el PDF, ni el esquema.
* **No se ha tocado `SOLO_EMPRESA`** (574), ni `contact_kind`, ni `tipoDestinatario` (615), ni el
  aviso de duplicados ni la validación de NIF (578/575).
* **Los checkboxes de presentación NO entran**: son CONT-18 (SCRUM-589).
* **Cero microcopy.** Y aplicando el criterio de hoy: «Razón social (empresa, opcional)» **no se
  marcaría** — sigue describiendo bien el campo… *salvo* que se decida enseñarlo también en
  Persona, y entonces el «(empresa)» deja de ser cierto. Otra consecuencia de la decisión 2.
* **🕳️ No he leído el ticket en Jira** (MCP caído). Trabajo con lo pegado en el encargo.
