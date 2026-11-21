# SCRUM-1788

## SCRUM-1788a · 21-nov: la tabla de la factura empieza debajo del bloque más alto (emisor o cliente) (J1, GO c.22299)

**Medido contra:** `origin/main` = `53cde1aa49e8b8235b6b562f9a81bb6d175ac571` · 2026-11-21T05:14:16Z (cabecera `Date:` de `gh api -i zen`; sesión J1 `jv-j1gv`, por encargo del orquestador `cobroflash-backend-87`)

A9: comprobación → `tests/scrum1788a-emisor-no-pisa-la-tabla.test.mjs`
Mutaciones: catálogo → tests/scrum1788a-emisor-no-pisa-la-tabla.test.mjs

### Qué cambia

GO del fundador en SCRUM-1788 c.22299: «Sí go». En `generateInvoicePdf` (`src/modules/invoicing/infra/pdf/pdf.service.ts`) el
final del bloque EMISOR se guarda en `finEmisorY` justo después de pintarlo, y la tabla arranca en
`Math.max(doc.y, finEmisorY, cy + 16)`. Antes era `Math.max(doc.y, cy + 16)`: pintar el cliente en su columna
(`doc.text(…, col2X, cy)`) mueve `doc.y`, así que el final del emisor se perdía y la tabla se colocaba sólo por
debajo del CLIENTE. Sin texto nuevo y sin cambiar qué datos salen. Autorizado en
`tests/_cambios-autorizados-de-la-factura.mjs` (huellas de `evidencias/SCRUM-1446d/huellas.mjs` sobre el sha de arriba).

La 5.ª línea del emisor es el correo (`merchant.email`): razón social, NIF/CIF, dirección, teléfono y correo
(`pdf.service.ts`, bloque «2. EMISOR / CLIENTE»). Una dirección larga parte en dos y lo empeora.

El PDF del PRESUPUESTO (`generateQuotePdf`) no comparte el defecto: pinta «Emisor:» y el cliente uno debajo del otro
con el cursor corrido, sin columnas. No se toca.

### Medido

- Rojo primero (commit `6d8b504685e8e4e697cfbece2a9de41780e8fd26`): 2 casos, 1 cae — el correo del emisor quedaba a 6,71 de la
  base de «CONCEPTO» (umbral 16, el alto de la banda). Verde tras el arreglo: 2/2; el mismo correo queda a 23,05.
- Control: con el cliente como bloque más alto (emisor de 1 línea y de 4), la cabecera sale en la MISMA `y` que antes
  del arreglo (651,77 con la sonda antes y después).
- Mutación «la tabla vuelve a colocarse sólo bajo el cliente» con `aplicarUna`
  (`docs/master/evidencias/SCRUM-1788/mutar.mjs`): `ok: true`, 0 colaterales; árbol limpio después.
- Capturas del PDF fabricado (emisor ficticio de 6 líneas): `docs/master/evidencias/SCRUM-1788/antes-largo.png` (el
  correo tapado por la banda) y `despues-largo.png`. Sonda: `evidencias/SCRUM-1788/sonda.mjs`.
- Error mío, cazado por `tests/scrum262-telefonos-de-prueba.test.mjs` en el tramo 8: sembré el teléfono del emisor
  ficticio en un rango de móvil real (`+34 600…`). Pasado al rango imposible (`+34 000 000 000`); las dos capturas
  son de ANTES de ese cambio y todavía lo muestran.
- Suite entera por tramos (`scripts/tanda-entera-por-tramos.mjs`, con `TMP`/`TEMP` sin espacios): 15 de 15 tramos,
  1.733 ficheros, 14.016 tests, 13.832 pass, 0 fail — VEREDICTO VERDE. Repetida tras `git merge origin/main`
  (`be85bc71640bb7a8e8af969e2717d233a223e161`; las huellas de la vía no cambian): 1.738 ficheros, 14.050 tests,
  13.866 pass, 0 fail — VERDE. Build con tipos (`tsc -p .`): salida 0.
  `npm run guards:entrada`: 15 guards en verde.

### Para SCRUM-1787 (medido aquí, no construido)

- `generateInvoicePdf` se llama en `src/lib/invoicing.ts:123`, `src/lib/invoicing.ts:289` y
  `src/modules/system/app/routes/invoicesAdmin.routes.ts:1338` (`git grep`, sobre el sha de arriba).
- `Invoice` (`prisma/schema.prisma`) congela del cliente `customerName`, `customerLegalName`, `customerTaxId`,
  `customerEmail` y `customerPhone`; NO guarda su dirección. La dirección congelada de SCRUM-602 es la de la OBRA,
  no la del cliente. Pintar la dirección del cliente exige guardarla al emitir (ALTER aditivo): decisión del fundador.

### Sin medir

- La factura real del fundador (F260001): no se ha abierto; el emisor de 5+ líneas se fabricó.
- yaqu.app tras el despliegue: no visto todavía.
- Las líneas de la factura de prueba usan nombres de campo que el PDF no lee (sale «0,00»); no afecta a la
  posición de la tabla, que es lo que se mide.
