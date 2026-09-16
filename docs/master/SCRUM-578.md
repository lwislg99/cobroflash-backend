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

---

# APÉNDICE · 24-ago-2026 · ENTREGADOS (a) (b) (c) (d)

**Medido contra:** `origin/main` = `bcf30775b0e535c9c6534eb7636558b9a4200a3e`
**Tanda final:** 4131 tests, 4052 pass, 0 fail, 79 skipped · `guards:entrada` verde ·
los 9 de navegador verdes (54,5 s), **sólo como no-regresión de la landing**: no cubren este
formulario (SCRUM-628).

## (a) El selector de prefijo — el presupuesto se cumple CON LA LISTA COMPLETA

No hubo que recortar ni decidir nada. Medido con `node scripts/censo-peso-prefijos.mjs`:

| | |
|---|---|
| `prefijosPais.js` en disco | **7.584 B** |
| **gzip** — lo que viaja | **3.773 B · 3,7 KB** |
| brotli | 2,9 KB |
| Países | **222**, España incluida, derivado del módulo y sin ISO repetidos |
| Proporción | **0,8 %** del JS comprimido del panel |
| A 200 KB/s (4G lenta) | **18 ms** (presupuesto: <1.500 ms la pantalla entera) |

**Cabe porque lo caro NO VIAJA**, y son las dos decisiones que hacen reproducible el número:

1. **El nombre lo pone el navegador.** `Intl.DisplayNames(['es'], {type:'region'})` traduce el ISO
   a «España», «Francia», «Alemania»… **sin un byte de descarga**. Así que en el fichero sólo
   viajan ISO + prefijo. Con respaldo: si no existe, se enseña el código ISO — un selector que
   dice «FR +33» sigue siendo usable; uno que revienta deja al profesional sin poder escribir.
2. **La bandera se calcula, no se descarga.** Los emoji de bandera son dos *indicadores
   regionales*, que son las letras A-Z desplazadas a otro bloque Unicode: **la bandera de `ES` ES
   `ES` con otro código de carácter**. Cero imágenes, cero sprites, cero peticiones.

Ninguna librería (regla 36). Objetivo táctil 44 px cumplido a mano, porque aquí no hay guard.

## El censo de marcadores: **+1 marca · 2 superficies**

`customersView.js`, de una sola constante `MARCADOR_MICROCOPY`. Las dos superficies son el
**rótulo del teléfono** y el **aviso de duplicado**.

> 🔴 **LA LETRA PEQUEÑA, y no es un detalle:** el censo cuenta **MARCAS**, no rótulos — medido en
> SCRUM-615. Estas dos superficies comparten constante, así que **aprobar UNO de los dos textos NO
> apaga el otro**: son dos textos distintos que hoy van juntos por comodidad de implementación.
> **Habrá que PARTIR la constante** el día que el fundador escriba el primero de los dos. Decir
> «se apagan de golpe», como sí pasaba con `NF_PENDIENTE`, aquí sería falso.

El rótulo **tenía** texto —«Teléfono (E.164 sin +)»— y pasa a marcador a propósito: con el prefijo
en un selector aparte, describe un campo que ya no existe. Y era, él mismo, la prueba del ticket
de que una regla escrita en una etiqueta no la aplica nadie.

## (b) y (c) · resumen

* **(b)** `createCustomer` **y** `updateCustomer` normalizan con la `normalizePhone` que ya existe.
  Los dos: si sólo lo hiciera el alta, editar sería la puerta trasera. `normalizePhone` **no se
  toca** (~40 llamadores; es el número al que se manda el WhatsApp).
* **(c)** `identificadoresDuplicados.ts` — la lista de campos identificadores en **un sitio único**.
  Es aviso y no bloqueo, nunca el nombre, y compara sobre valor **canónico** (`canonParaComparar`
  llama a `normalizePhone` y le añade el prefijo por defecto **sólo para comparar**, en memoria:
  no escribe en ninguna fila, así que (d) se respeta entero).
* **(d)** No se ha auditado ni fusionado nada. No requería código.

## ⏳ PENDIENTE DE SCRUM-590 (CONT-19) — con la línea exacta

El cruce **móvil↔fijo** que fijó P-CONT-3 **no se construye aquí porque el segundo campo no
existe**: `Customer` tiene un solo `phone` (comprobado sobre el modelo completo).

Cuando SCRUM-590 cree el campo, el cruce **sale solo**: la búsqueda ya compara TODOS los
identificadores contra TODOS. Basta añadir **una línea** a `IDENTIFICADORES`, en
`src/modules/system/domain/identificadoresDuplicados.ts`:

```ts
{ campo: 'mobile', canon: canonParaComparar },
```

Hay un test que lo sostiene —«el cruce entre campos YA funciona: es lo que SCRUM-590 necesita»—
para que ese día no haya que rehacer el mecanismo, sólo declarar el campo.

## 🔴 Las tres correcciones que me hicieron

**1 · `SCRUM-311` cazó un `|| "34"`** en la lectura del selector de prefijo. El guard vigila
«cantidades inventadas» y aquí era un prefijo, no una cantidad — **pero tiene razón igual**: el
patrón es el mismo, un valor escrito a mano como respaldo de la lectura de un control. Ahora sale
de la fuente declarada (`prefijosPais.ESPANA.prefijo`), no de un literal.

**2 · Dos de mis propios guards se cazaban a sí mismos** en los comentarios que explican la
prohibición: el que comprueba que «E.164 sin +» ya no está caía por el comentario que dice que ya
no está, y el del `|| "34"` por el que lo explica. **Es exactamente el error de SCRUM-574**, y por
eso el filtro quita las líneas de comentario **y los comentarios al final de línea** — con su
suelo, que exige que el filtrado no se haya llevado el código por delante.

**3 · Una suposición mía sobre `Intl`:** escribí que `nombreDe('ZZ')` caería al respaldo. **Falso:
`ZZ` es un código VÁLIDO de ICU y devuelve «Región desconocida».** El test decía lo que yo creía,
no lo que pasa. Corregido, y de paso reforzado con el invariante que de verdad importa: **ninguna
de las 222 opciones se queda sin rótulo**, que es como se rompería el selector de verdad.

## Lo que NO cubre

* **La importación (`importarClientes.service.ts`) sigue deduplicando por igualdad literal.** Está
  medido y dicho, y **no se ha tocado**: comparte el defecto pero tiene su propio camino.
* **Ni una comprobación contra registro externo.** Fuera de alcance por decisión.
* **Los duplicados existentes**, intactos (d) — y con la consecuencia asumida: nadie sabe cuántos
  son, porque no se va a auditar.
* **Cero microcopy escrita.**
* **🕳️ No pude leer SCRUM-578 en Jira** (MCP de Atlassian caído): las cuatro consecuencias contra
  reglas del máster llegaron por el encargo, no del ticket.

## 🔴 DOS CORRECCIONES A LO QUE ESTE MISMO DOCUMENTO DICE MÁS ARRIBA

No se borra nada (SCRUM-273: un fichero por ticket). Pero dejar en pie una frase que la
medición posterior desmintió es justo de donde salen las premisas falsas — es lo que yo mismo
reproché al comentario obsoleto de `scrum262-…:142`. Así que se corrigen aquí, con el número.

**① El encabezado dice «Gate: 🛑 PARADO».** Ya no: el fundador contestó los dos hallazgos
(el cruce va por la lectura **A**, sin tocar esquema; la ceguera se resolvió con la forma canónica
en vez de aceptarse) y (a)(b)(c)(d) están **entregados**. El encabezado es la foto del día en que
se paró, no el estado.

**② «El rango imposible SIRVE, no hay hallazgo ahí» — ERA FALSO, y lo hay.** Esa frase se escribió
midiendo sólo la forma CON prefijo. Al construir el test hizo falta también la forma **nacional**,
y ahí:

```
telefonoDePrueba(1) = 34000000001  →  nacional "000000001"  →  normalizePhone = ""
```

`normalizePhone` quita el `00` inicial por prefijo internacional, quedan 7 dígitos y falla su
propio `^\d{8,15}$`. O sea que **el par natural para este test compara `""` contra `""` y pasaría
en VERDE sin probar nada.** Con `n` grande el tramo nacional empieza por `01…` y sobrevive; por eso
los fixtures usan `telefonoDePrueba(12345678)` y llevan un suelo que exige que no sean vacíos.

Está abierto como **SCRUM-629** y no es de este ticket. Ningún número real se usó en su lugar.
