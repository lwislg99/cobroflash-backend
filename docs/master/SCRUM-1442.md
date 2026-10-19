# SCRUM-1442 · La cabecera de apartado ya no pinta «NaN €» en la página donde firma el cliente (el PDF, NO)

**Medido contra:** `origin/main` = `e59be9fa384b5bb1d4fbaa6d429a32a5a8a6be8d` · 2026-10-18T00:05:57Z
A9: comprobación → `tests/scrum1442b-la-cabecera-no-pinta-nan.test.mjs`

Escribe S1 (equipo de Luis), en su carril: `quoteDecisionLanding.routes.ts` es de S1
(`.claude/carriles.json`). Vía decidida por el orquestador el 18-oct-2026: la cabecera de apartado
pinta su CONCEPTO y NO su importe, como la tabla del PDF. Sin texto nuevo, sin esquema y sin tocar
`core/validation/schemas.ts` (regla 40).

## 🔴 Lo primero: esto NO cierra el ticket

| sitio | carril | estado |
| --- | --- | --- |
| página pública, tarjeta de cada opción | S1 | ✅ este tramo |
| página pública, tabla del presupuesto (no estaba en el ticket, ver abajo) | S1 | ✅ este tramo |
| PDF, tarjeta de cada opción (`pdf.service.ts`, el bloque de las opciones) | **J1**, camino de emisión | ⛔ **NO ESTÁ.** Se lo pasa el orquestador |

## 🔴 Lo que el ticket no decía: la tabla del PRESUPUESTO también pintaba «NaN €», y ésa sí se alcanza desde el panel

El encargo decía «proteger la tarjeta igual que ya hace la tabla principal». **Eso es cierto en el PDF
y falso en la página pública**: la tabla del presupuesto de `renderQuoteDetail` calculaba también
`l.qty * l.price` sin mirar si salía un número.

Medido por la ruta real `GET /pay/quote/:token` (arnés de `scrum1431`), sobre `e59be9fa`, con una
sonda que primero vio un NaN sembrado a propósito (control positivo):

| caso | antes | después |
| --- | --- | --- |
| A · presupuesto NORMAL con una cabecera de apartado, tabla del presupuesto | **«NaN €»** | concepto, importe vacío |
| B · OPCIÓN con una cabecera de apartado, tarjeta (el del ticket) | **«NaN €»** | concepto, importe vacío |
| control: la línea normal de debajo | «100,00 €» | «100,00 €» |

**Por qué A importa más que B:** las cabeceras de apartado las crea el editor completo del panel
(SCRUM-655). Cualquier presupuesto con apartados enviado a un cliente le enseñaba «NaN €» en la
página donde firma. B, como decía el ticket, sólo se alcanza con un `POST /quote/create` hecho a mano.
Es el mismo fichero, el mismo carril y la misma vía decidida, así que se arregla aquí y se dice
(orden del fundador del 6-oct: un defecto de paso se arregla en el momento).

## Qué hace el arreglo

Una función, `importeDeLinea`, en `quoteDecisionLanding.routes.ts`: el neto (`qty × price`) si es un
número, y nada si no lo es. La usan las DOS tablas de la página, para que no vuelva a quedarse atrás
una de las dos. Es la regla de la tabla del PDF (`Number.isFinite` → celda vacía): no adivina qué
es una cabecera, así que no hace falta exportar `esApartado`, que es privado a propósito (SCRUM-411).

Consecuencia, dicha: una línea con un `price` que no sea un número tampoco pinta importe (antes
pintaba «NaN €»). El esquema no deja entrar una así. Es lo que ya hace el PDF.

## Rojo primero, y quitar cada pieza

Test nuevo, 3 casos: control (la línea normal sigue pintando su neto en las dos tablas), cabecera en
la tabla del presupuesto y cabecera en la tarjeta.

| árbol | resultado |
| --- | --- |
| `dist/` de `e59be9fa`, sin el arreglo | 1 de 3: caen los dos casos de cabecera |
| con el arreglo | 3 de 3 |
| sin la pieza de la tabla | cae sólo el caso de la tabla |
| sin la pieza de la tarjeta | cae sólo el caso de la tarjeta |

## Lo que se ha corrido

- Los 31 ficheros de `tests/` que nombran `quoteDecisionLanding` o `pay/quote`, más el nuevo y los 5
  de árbol entero (195, 414, 694, 710b, 737): 284 tests, 283 pasan, 0 caen, 1 saltado con su motivo.
- Los 7 que leen los censos (`_censo-gemelo-crudo`, `censo-fecha-sin-zona`, `_datos-del-censo`,
  `_expresiones-de-texto`): 87 de 87. `scripts/guard-firma-con-tramos.mjs`: en verde.
- `npm run guards:entrada`: 15 en verde.
- La tanda completa no (en esta máquina la mata la memoria): la juzga el obligatorio del CI.

## Lo que NO se ha medido

- No he generado la página en un navegador ni en yaqu.app: es el HTML que sale de la ruta de `dist/`,
  con Prisma doblado.
- El PDF: ni tocado (J1).
- Filas que ya existan con una cabecera dentro de una opción: sin acceso a la base, no se cuentan.
  Con este arreglo dejan de pintar «NaN €» en la página; en el PDF, no.
- `tsc` sale con el error ya conocido de `merchantAdmin.ts` (cliente de Prisma del árbol compartido,
  sin regenerar a propósito); emite `dist/` igual, y no viene de este cambio.

## Cómo se repite

    npm run build
    node --test tests/scrum1442b-la-cabecera-no-pinta-nan.test.mjs
