# SCRUM-290 (A0.4) · Albarán → factura: el casador de líneas y su suelo

**Fecha:** 6-ago-2026 · **Carril:** A (facturación) · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `93e924e12c321c4a27749b249aaa17056e88d512` · 2026-08-06T13:40:00+02:00
**Tanda:** 1963 tests, 1896 pass, 0 fail, 67 gateados a staging

> **ENTREGA PARCIAL Y DECLARADA.** Esto es el **criterio** —qué se factura, a qué precio y qué
> no— con sus tests y su suelo. **No incluye la pantalla ni el endpoint**, y la microcopy está
> bloqueada a propósito por la sección **G** del cuestionario del asesor: un texto que le dice a un
> profesional lo que puede cobrarle a su cliente no se escribe sobre fuentes públicas.

## PASO 0 — medido antes de escribir una línea

| Qué | Resultado |
|---|---|
| ¿Rama con el 290? | **ninguna** (`ls-remote` completo) |
| ¿Entrada de máster? | **no existía** |
| ¿Mecanismo en el código? | **ninguno**: nadie nombra convertir un albarán en factura |
| SCRUM-288 (A0.2), bloqueo declarado | **hecho**, con entrada |
| SCRUM-195, dependencia declarada | **satisfecha**: rebanadas 1-2 en `main` y, lo que decide, el camino de crear un adicional atado al Trabajo existe (`quotes.routes.ts:168`, `jobId: jobIdDelAdicional`) |

**Dos premisas del ticket, resueltas midiendo:**

- **`Customer.tipoDestinatario` SÍ existe** (`null` = nunca clasificado). La pregunta abierta del
  ticket tiene respuesta, y `null` cae al criterio **estricto de consumidor** — que además no se
  inventa aquí: es la convención que ya sigue `pendientesFacturar.service.ts:16`.
- **No hay solape con SCRUM-170.** `modoValoracion` es `SIN_VALORAR` **por defecto** y
  `facturar-parcial` responde **409 `albaran_sin_precios`** a esos. O sea: **hoy el albarán normal
  —el que no lleva precios, decisión del fundador del 2-ago— no se puede facturar de ninguna
  manera.** Éste es ese hueco; 170 cubre el `VALORADO`. Complementarios.

## Regla 38 — el límite, y por qué no se ha cruzado

`emitInvoice(tx, input)` ya está extraído en `invoicing.service.ts`, y `EmitInvoiceInput` **acepta
tal cual** lo que hace falta: `lines` (Json), `albaranRefs`, `quoteId`, `total`, `currency`,
`actor`. Así que esto **añade un llamador**, no modifica el camino de emisión — que es exactamente
el límite que puso el fundador.

**Comprobado en el diff:** cero cambios en `src/modules/invoicing/`, cero en `prisma/`. Y regla 24
sigue en pie: esto **se construye, no se enciende**.

## El criterio

**CANTIDADES del albarán · PRECIOS del presupuesto firmado.** Lo entregado lo dice el albarán; lo
que cuesta lo dice lo que el cliente firmó. Cualquier otra fuente factura un importe que el cliente
**no aceptó**.

**Lo añadido en obra no se factura: dispara un presupuesto adicional.** No es cautela nuestra —el
presupuesto aceptado es vinculante para un consumidor y los trabajos nuevos exigen aceptación por
escrito—. La solución cómoda («entran a 0 € y se avisa») se descartó por incorrecta: convertiría a
YaQu en la herramienta que produce **la factura mayor que el presupuesto**.

**Nada se descarta en silencio.** Lo que no se factura sale **nombrado y con motivo**
(`no_estaba_en_el_presupuesto` · `linea_del_presupuesto_no_existe` ·
`exceso_sobre_lo_presupuestado` · `sin_cantidad`), para que pueda ir al adicional que se firma.

### Una decisión que el ticket no nombra, y la tomo estricta

El enunciado cubre entregar **de menos** (3 de 10 → se facturan 3). No dice qué hacer al entregar
**de más**. Aquí se factura **hasta lo firmado** y el exceso va al adicional, porque facturar 12 de
10 produce lo que la regla prohíbe —una factura mayor que el presupuesto— aunque el precio unitario
sí estuviera firmado: **la cantidad también forma parte de lo que el cliente aceptó**.
Queda señalado por si el fundador lo quiere de otra forma.

## 🔴 UN ROJO NO SALIÓ ROJO, Y ERA *LA* REGLA DEL TICKET

Al inyectar «coge el precio del albarán si lo trae» (`l.precioUnitario ?? origen.price`), **la
suite entera siguió verde**. Ninguna línea de prueba llevaba precio, así que el fallback al
presupuesto lo tapaba: la regla más importante del ticket —los precios salen de lo que el cliente
firmó— **no estaba comprobada por nada**.

Y el caso existe: `modoValoracion: 'VALORADO'` (SCRUM-65) permite que el albarán lleve
`precioUnitario`. Ahí la fuente equivocada ganaría sin que nadie lo viera, y le costaría dinero al
cliente. Se añadió el test que lo fija —presupuesto 80 €, albarán anotado a 140 €, **gana 80**— y
con él el rojo sale nombrando el problema.

## Verificado en rojo

| # | Qué se rompe | Qué cae |
|---|---|---|
| 1 | El precio se coge del **albarán** en vez del presupuesto | 🔴 «se ha facturado el precio del ALBARÁN (140) en vez del que el cliente firmó (80)» |
| 2 | Se ignora lo **ya facturado** (obra por fases) | 🔴 la segunda entrega vuelve a facturar lo mismo |
| 3 | Lo añadido en obra entra en la factura **a 0 €** | 🔴 caen 4, incluidos los dos del suelo |
| 4 | Se permite emitir con **cero líneas casadas** | 🔴 «NINGUNA casa… regla 29» |

**Control negativo** (un cambio que NO debe hacer caer nada): renombrar el concepto en obra. El
casado va por `quoteLineIndex`, no por el texto — que el profesional retoque la descripción es
normalísimo y no puede cambiar el precio que se le cobra al cliente.

## El suelo, que es EL test

Si el casador deja de encontrar coincidencias, **falla en vez de emitir**. Una factura con cero
líneas es un documento fiscal que no dice nada, y una factura emitida **no se edita ni se borra**
(regla 29): el error queda para siempre y solo se corrige con una rectificativa.

Y distingue **los dos ceros**, que es lo que un contador solo no puede hacer:

- albarán **sin líneas** → el albarán está mal;
- albarán **con líneas y 0 casadas** → o falta el presupuesto, o `quoteLineIndex` no se escribió.

Aplanarlos escondería el segundo, que es el que indica que el casador está roto. Con su **hermano
positivo**: cuando sí casa, no hay motivos — sin él, todo lo anterior pasaría aunque
`motivosParaNoEmitir` devolviera siempre algo y no se pudiera facturar nunca.

## Las dos caras

Que la conversión funcione **y** que un albarán **sin presupuesto detrás no se convierta**. Probar
solo la primera no demuestra nada: un casador que dijera «adelante» siempre pasaría la mitad de la
suite.

## La trampa de unidades, dicha en voz alta

`Albaran.lineas[].tipoIva` es **porcentaje entero** (21); `Quote.lines[].tax` es **fracción**
(0.21). La conversión `/100` existe en tres sitios del árbol (`albaranes.routes.ts:852`,
`albaran.service.ts:191`, `recapitulativa.service.ts:83`). **Aquí no se convierte nada** —el
impuesto sale del presupuesto, que ya viene en fracción— y copiarla por inercia metería un IVA cien
veces mayor. Hay test que lo fija.

## Microcopy: BLOQUEADA, y a propósito (regla 30 + una capa más)

Sección **G** nueva en `docs/legal/PREGUNTAS_ASESOR.md`, cuatro preguntas (25-28), la 25 la urgente:
**¿basta la firma digital que ya usamos para acreditar que el consumidor aceptó por escrito el
presupuesto adicional?** Si vale, el mecanismo está construido y solo falta enchufarlo; si no,
hay que rediseñar la aceptación **antes** de escribir la pantalla.

No se ha escrito **ni un texto de pantalla**. Aquí no basta con que la microcopy la apruebe el
fundador: un texto legal mal escrito no es feo, **es peligroso**.

## Lo que falta para cerrar A0.4

1. El endpoint `POST /admin/albaranes/:id/convertir-en-factura` (llamador de `emitInvoice`).
2. La acción primaria en el albarán **firmado** — hoy `btnFacturar` cubre el `VALORADO` (SCRUM-170).
3. La creación del **presupuesto adicional** desde `paraAdicional`, sobre el camino que ya existe.
4. La microcopy, **cuando vuelva el asesor**.

Ficheros: `src/modules/jobs/domain/albaranAFactura.ts` (nuevo — el criterio) ·
`tests/scrum290-albaran-a-factura.test.mjs` (15, nuevo) ·
`docs/legal/PREGUNTAS_ASESOR.md` (sección G, preguntas 25-28).
