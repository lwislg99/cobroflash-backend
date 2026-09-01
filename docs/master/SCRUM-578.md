# SCRUM-578 · CONT-05: medido antes de construir, y DOS premisas no se sostienen

**Fecha:** 24-ago-2026 · **Carril:** producto · **Gate:** 🛑 PARADO — dos hallazgos que cambian el ticket
**Medido contra:** `origin/main` = `bcf30775b0e535c9c6534eb7636558b9a4200a3e` · 2026-08-24T18:00:00+02:00
**Tanda:** no procede todavía — no se ha escrito código de producto

> ⚠️ Esa hora es la del trabajo de esta rama, no una lectura de reloj — criterio R14.
>
> **🕳️ HUECO DECLARADO:** el encargo pedía leer SCRUM-578 entero en Jira antes de empezar. **No he
> podido:** el servidor MCP de Atlassian se desconectó en esta sesión. Trabajo con lo que trae el
> encargo. **Me faltan las cuatro consecuencias contra reglas del máster y los dos comentarios que
> lo desbloquean**, y no sé si alguno cambia lo de abajo.

---

## 🔴 HALLAZGO 1 · `normalizePhone` NO colapsa el caso de la evidencia

P-CONT-6 concluye: «la función ya existe, no hay que escribirla, hay que llevarla donde falta».
**Medido ejecutándola —no leyéndola, como pedía el encargo— eso es necesario pero NO suficiente.**

| Entrada | `normalizePhone` |
|---|---|
| `"+34 662629419"` | `"34662629419"` |
| `"662629419"` | `"662629419"` |
| `"0034662629419"` | `"34662629419"` |
| `"34 662 62 94 19"` | `"34662629419"` |

**Los dos valores de la evidencia NO colapsan:** `34662629419` ≠ `662629419`.

La función normaliza el **formato** (espacios, guiones, paréntesis, `+`, `00`) pero **no resuelve el
prefijo de país**. Aplicarla en el sitio donde falta arregla `"+34 662629419"` contra
`"+34662629419"`, pero **no el par exacto del ticket**.

Y está fijado así a propósito en la suite: `tests/utils.test.mjs:19` exige
`normalizePhone('(600) 111-222') === '600111222'` — nueve dígitos **sin** ganar prefijo.

> **Lo que sí lo resuelve es el punto (a) del propio encargo:** con un selector de prefijo el
> número no puede enviarse sin país, así que el caso deja de poder producirse **de aquí en
> adelante**. No por normalizar más fuerte, sino porque el formulario deja de admitir la
> ambigüedad. Encaja con (d) («sólo de aquí en adelante»).
>
> ⚠️ **Y la contrapartida, que hay que decir:** el aviso **no saltará** comparando un alta nueva
> (`34…`) contra una fila vieja guardada sin prefijo (`662629419`). No es lo mismo que (d) —(d)
> dice que no se fusionan los duplicados que ya existen; esto dice que el aviso **es ciego** a
> ellos. Es una limitación del diseño aprobado, no un defecto de implementación.

### Por qué NO se toca `normalizePhone` para arreglarlo

**Tiene ~40 llamadores**, y no son periféricos: `whatsapp.ts`, `whatsappNotifications.ts`,
`whatsappPolicy.ts`, `invoiceWhatsApp`, `albaranWhatsApp`, `sendQuote`, `botFlow`,
`whatsappIncoming`, `maintenance`… Es **el número al que se envía el WhatsApp**. Cambiar qué
devuelve cambia a dónde se manda un mensaje.

Si hiciera falta, la forma segura sería un **parámetro opcional** de prefijo por defecto —una sola
función, no una segunda normalización— dejando los 40 llamadores byte-idénticos. **No se ha hecho:
no hace falta si (a) entra, y no se toca el camino de mensajería sin GO.**

---

## 🔴 HALLAZGO 2 · No existe «móvil» ni «fijo»: hay UN solo campo `phone`

P-CONT-3 fija, y el bloque 7 exige probar explícitamente:

> «un valor guardado como **móvil** que ya existe como **fijo** en otro cliente TAMBIÉN avisa»

**Medido sobre `prisma/schema.prisma`, el modelo `Customer` completo:** los campos son
`contactKind · legalName · taxId · id · merchantId · name · **phone** · email · notes ·
portalToken · waOptOut · tipoDestinatario · recargoEquivalencia · billingPeriodicity`.

**Hay UN campo de teléfono.** No hay móvil, no hay fijo.

Así que **el caso del cruce, tal y como está decidido, no se puede construir ni probar hoy**, y es
uno de los cuatro controles obligatorios del cierre. Dos lecturas, y no las elijo yo:

| | Lectura | Qué implica |
|---|---|---|
| **A** | El cruce es entre los identificadores que SÍ existen (`phone`, `email`, `taxId`) | Construible hoy. Pero «un teléfono que coincide con el NIF de otro» no es el caso que se decidió, y como control positivo no prueba lo que el fundador quiso probar |
| **B** | CONT-05 debe **añadir** un segundo campo de teléfono | 🛑 **Cambio de esquema.** `prisma/schema.prisma` es de los fundadores, y la autorización de SCRUM-574 era **puntual para `contact_kind`** y no se extiende |

---

## Lo demás que salió al medir (contexto para decidir)

* **Tres caminos de escritura de `Customer.phone`, y sólo uno normaliza.**
  `charges.routes.ts:27` sí (`normalizePhone`) · `customerAdmin.ts:45,61`
  (`createCustomer`/`updateCustomer`) **no**: pasan `data` tal cual a Prisma · `botFlow:264` crea
  con un valor ya normalizado. El punto (b) del encargo apunta justo al hueco del medio.
* **Y una cuarta tolerancia, ad-hoc, en una consulta:** `whatsappIncoming.routes.ts:257` hace
  `where: { phone: { in: [phone, '+' + phone] } }`. Es una tercera forma de «tolerar el formato»,
  escrita a mano en un `where`.
* **Zod no restringe el formato:** `phone: z.string().min(5).optional()` (`schemas.ts:237`). La
  regla «E.164 sin +» **sólo vive en la etiqueta**, que es exactamente lo que el ticket denuncia.
* **La importación (punto 4 del encargo):** `importarClientes.service.ts` deduplica por igualdad
  literal — confirmado que comparte el defecto. **No se ha tocado**: depende de la misma decisión
  de normalización que lo demás.
* **El rango imposible SIRVE, no hay hallazgo ahí.** `telefonoDePrueba(1)` = `34000000001`
  sobrevive a `normalizePhone` sin cambios, y `"+34 000000001"` normaliza a `34000000001` — o sea
  que el caso «mismo número, dos formatos» se puede montar entero con el rango imposible.
* **Un comentario obsoleto que induce a error:** `tests/scrum262-telefonos-de-prueba.test.mjs:142`
  dice «`normalizePhone('34600…')` prueba que un móvil ES de 9 dígitos **gana el prefijo**». La
  función **no hace eso** (ver Hallazgo 1). No se toca —es de otro ticket— pero queda dicho, porque
  es la clase de frase de la que sale una premisa falsa.

---

## Lo que hace falta para seguir

1. **Hallazgo 2 — el cruce:** ¿lectura **A** (cruce entre `phone`/`email`/`taxId`, construible hoy)
   o **B** (segundo campo de teléfono, que es cambio de esquema y necesita GO)?
2. **Hallazgo 1 — confirmar la limitación:** ¿se acepta que el aviso sea **ciego a las filas
   viejas sin prefijo**? Es consecuencia del diseño aprobado, no un defecto, pero conviene que esté
   dicho antes y no después.

**No se ha escrito código de producto.** Con la lectura A se construye sin tocar esquema; con la B
se prepara el diff y se para.

## Lo que NO cubre este documento

* **No he leído el ticket en Jira** (arriba). Las cuatro consecuencias contra reglas del máster y
  los dos comentarios no están incorporados.
* **No se ha tocado nada**: ni `normalizePhone`, ni el esquema, ni la importación, ni el
  formulario, ni `contact_kind`, ni `tipoDestinatario`.
* **Cero microcopy.**
