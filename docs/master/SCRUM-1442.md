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

## SCRUM-1442c · la tarjeta de opción del PDF del PRESUPUESTO ya no pinta «× undefined» ni «NaN» (J1, jv-j1dx, 12-nov-2026)

**Medido contra:** `origin/main` = `ec7e19e64eab26361a3d5ebae929b60474ae08ba` · 2026-11-12T11:49:29Z

A9: comprobación → `tests/scrum1442c-la-tarjeta-del-pdf-sin-nan.test.mjs`

Escribe J1 (equipo de Javier), en su carril: `src/modules/invoicing/**` es de J1. Es la mitad que
1442b dejó pendiente (Jira c.21643, de jv-j4az). **GO del fundador (regla 40) sólo para esta
tarjeta: Jira c.21648** («Go»). Nada del PDF de factura, del registro, del XML ni de la huella.

### Rojo primero, reproducido

`docs/master/evidencias/SCRUM-1442/reproducir-tarjeta-pdf.mjs`: tres opciones; la recomendada lleva
una cabecera de apartado. El cuerpo pasa por `CreateQuoteSchema` (lo guarda como
`{"concept":"Fase 1","tax":0,"apartado":true}`), el total de cada opción por `calcTotal` y el PDF por
`paramsDePresupuestoParaPdf` → `generateQuotePdf`, la cadena de las rutas.

| PDF | «undefined» | «NaN» | «Fase 1» | «Revisión × 1» (positivo) |
|---|---|---|---|---|
| con cabecera, ANTES (`antes-con-cabecera.pdf`, `antes-tarjeta.png`) | 1 | 1 | 1 | 3 |
| sin cabecera, control ANTES | 0 | 0 | 0 | 3 |
| con cabecera, DESPUÉS (`despues-con-cabecera.pdf`, `despues-tarjeta.png`) | 0 | 0 | 1 | 3 |

Antes salía `Fase 1 × undefined` / `NaN EUR`; después, `Fase 1` y el importe vacío. El texto del
control sin cabecera sale **idéntico** antes y después (`diff` de `antes-sin-cabecera.txt` y
`despues-sin-cabecera.txt`, quitando el número del documento).

### La causa

La tarjeta nació el 22-may-2026 (`2b059dba3`, Good/Better/Best) dando por hecho que toda línea trae
`qty` y `price`. El 2-sep-2026 (`f834143c1`, SCRUM-655) la cabecera de apartado entró en
`QuoteLineSchema`, que las opciones comparten, y se guarda sin `qty` ni `price`: desde ese día
`l.qty * l.price` da `NaN`, `fmtImporte` lo escribe «NaN» y la plantilla escribe «× undefined». La
tabla principal del PDF ya se protegía con `Number.isFinite`; su gemela, la tarjeta, no.

### El arreglo

En `generateQuotePdf`, sólo el bucle de las líneas de una opción: si el importe no es finito, se pinta
el concepto sin «× cantidad» y no se pinta importe. Es la vía decidida el 18-oct-2026 y aplicada en la
página (1442b): **sin texto nuevo**. Una línea normal sale byte a byte igual (el control). El ancla
`(ivaFueraDelPapel ? 0 : (l.tax ?? 0))` de la M4 de `scrum1302m` se conserva.

### Lo que se ha corrido

- `tests/scrum1442c-la-tarjeta-del-pdf-sin-nan.test.mjs`: 3/3, salida 0, 0 saltados.
- Mutaciones (catálogo de la casa, `aplicarUna`): **3/3 VIVAS**, base sin mutar con 0 caídos
  (`evidencias/SCRUM-1442/mutaciones.txt`). Mi primera pasada salió **CIEGA** 3/3 por un error MÍO
  en el guion: le pasé a `correr` la ruta `tests/…` y la resolvió como `tests/tests/…`. Lo dijo el
  propio instrumento; corregido, y el árbol quedó restaurado (`git status` limpio en `src/`).
- `tsc -p .` **con tipos**: salida 0.
- `scrum523d`: verde, y `pdf.service.ts` **no** está en su población congelada: no hay nada que
  recongelar (la vía de SCRUM-1585 c.21290 no hace falta).
- La dirigida (abajo, en «Cómo se repite»), con el trabajo commiteado.

### Lo que NO se ha medido

- La suite entera en local: NO CORRIDA (diez sesiones a la vez; hace de tanda el obligatorio de CI).
- yaqu.app: no se ha mirado. El PDF de un presupuesto con una cabecera dentro de una opción sólo se
  alcanza por API (c.18216), y no hay cuenta con la que pedirlo sin tocar datos.
- Filas guardadas con una cabecera dentro de una opción: sin acceso a la base, no se cuentan.

### Visto de paso, sin tocar (fuera del GO, que es «solo esa parte»)

En las dos capturas: las tres tarjetas salen **en escalera** (cada una empieza donde acabó la
anterior, porque `yStart = doc.y` se lee después de pintar la previa) y la estrella de la recomendada
sale como **«&»** (`★` no existe en la codificación WinAnsi de Helvetica). Las dos son de la misma
tarjeta y de este carril; no se arreglan aquí porque el GO las deja fuera. Se nombran en la entrega.

### Cómo se repite

    npx tsc -p . --noCheck
    node docs/master/evidencias/SCRUM-1442/reproducir-tarjeta-pdf.mjs despues
    node --test tests/scrum1442c-la-tarjeta-del-pdf-sin-nan.test.mjs
    node docs/master/evidencias/SCRUM-1442/mutaciones.mjs
