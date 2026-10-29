# SCRUM-1067 · Modelo 347 (operaciones con clientes y proveedores) — BLOQUEADO, motivo medido

**Medido contra:** `origin/main` = `e2f715939d0e27ca2661821e1b57292d4ec1c3cc` · 2026-09-22T08:57:39Z
**Rama:** `scrum-1063-lote-contabilidad-modelos` · **Puesto:** J1 · **Encargo:** orquestador, 22-sep-2026

## PASO 0 — lo que ya existe

Ningún módulo ni fichero de `src/` o `public/dashboard/js/` contiene `347` ni `modelo347` (grep sin
resultados). El propio ticket lo dice: «el 347 no existe en YaQu». Confirmado.

## Por qué no se puede construir hoy — medido, no supuesto

La aceptación (punto 1) exige **«descargar y citar la orden y responder Q-C8»**. El umbral de
importe que decide quién entra en el 347 — el dato central de todo el ticket — está
**explícitamente sin citar**: «A quién obliga, a partir de qué importe y qué operaciones entran:
Q-C8 sin responder y SIN cita: el umbral NO se escribe en el código ni en el ticket hasta
citarlo». Medido igual que en 1063/1065: SCRUM-1039 «Tareas por hacer», Q-C8 sin respuesta en
`docs/producto/CONTABILIDAD.md:86`.

Escribir el agrupador por NIF sin el umbral sería construir una pantalla que no sabe a quién debe
mostrar — el propio ticket lo prohíbe en su punto 2 («el umbral que fije la orden citada decide
quién aparece»).

## Qué SÍ mide algo reutilizable

Los NIF de clientes ya existen en `Customer` y los de proveedores en `Provider` (verificado en
`prisma/schema.prisma`); agrupar por NIF con formatos distintos (con/sin guiones) es un problema de
normalización de texto que no depende de ninguna cita — pero construirlo aislado, sin el umbral que
decide quién aparece en el listado, no cumple la aceptación del ticket y se descarta como
adelanto parcial: dejaría un agrupador sin la pieza que el propio ticket señala como el dato que
lo justifica.

## Siguiente paso exacto

Ninguno para J1 hasta SCRUM-1039 + Q-C8 (concretamente, el umbral y qué operaciones entran).

## STOP respetado

No se ha construido nada; ni datos de cliente exportados ni tocados. Solo lectura y este
documento.

---

# SCRUM-1067b · El borrador del 347, sin pantalla

**Medido contra:** `origin/main` = `0e86dada4887f1ac54ce0ed5cad3c53c99c72c1c` · 2026-10-24T10:14:00Z
**Rama:** `scrum-1067b-borrador-347` · **Puesto:** J1 (sesión `jv-j1bd`) · **Encargo:** orquestador `cobroflash-backend-95`, 23-oct-2026 · **Desbloqueo:** D2, SCRUM-1066 c.16699 (nombra el 347) + la orden localizada en SCRUM-1039b (c.16649)

A9: sin fallo que generalice — mi suma a mano mal hecha (3.010,07 por 3.005,07) la cazó el propio test en rojo antes de empujar, y las cuatro mutaciones que mi conductor dio por CIEGAS eran líneas que `tsc` parte en dist/: lo dijo el conductor, no lo tapó

## PASO 0

- `git log origin/main -i --grep=SCRUM-1067`: nada; `git ls-remote origin 'refs/heads/scrum-1067*'`: nada; `gh pr list --search 1067`: sólo #1656 (el lote del 22-sep, que trajo el tramo de arriba, sin código).
- El bloqueo de arriba (orden sin citar, Q-C8 sin responder) lo levantan: la orden **EHA/3012/2008**, localizada por J5 en 1039b; Q-C8 respondida (con la salvedad de SCRUM-1261: respuesta de herramienta, sin revisión profesional); y **D2 firmada** («Vamos con ella también», 24-sep) sobre «130/111/115/347 sólo como borrador, sólo con las órdenes citadas». Etiquetas de 1067: `equipo-javier`, `area-j1`, `listo-para-construir`.
- `node scripts/carriles.mjs de src/modules/fiscal/modelo347/modelo347.ts` → J1.

## Las citas (curl del consolidado, 24-oct-2026 09:56Z, cabecera `Date:` del BOE)

| fuente | URL | tamaño |
|---|---|---|
| RGAT · RD 1065/2007 | `https://www.boe.es/buscar/act.php?id=BOE-A-2007-15984` | 1.383.431 B |
| Orden EHA/3012/2008 (modelo 347) | `https://www.boe.es/buscar/act.php?id=BOE-A-2008-16973` | 213.522 B |

Ficheros fuera de git, como en 1066b. Control: `3.005,06` aparece 3 veces en cada uno. Literales usados (RGAT en la redacción vigente desde el 01/01/2014; la orden, con última actualización publicada el 12/12/2025):

- **Art. 33.1 RGAT:** «…con quienes hayan efectuado operaciones que en su conjunto para cada una de dichas personas o entidades hayan superado la cifra de 3.005,06 euros durante el año natural correspondiente.» → **estrictamente mayor**.
- **Art. 33.1, 2.º párrafo:** «La información sobre las operaciones a las que se refiere el párrafo anterior se suministrará desglosada trimestralmente. A tales efectos, se computarán de forma separada las entregas y las adquisiciones de bienes y servicios.»
- **Anexo de la orden (clave de operación):** «A Adquisiciones de bienes y servicios superiores a 3.005,06 euros. B Entregas de bienes y prestaciones de servicios superiores a 3.005,06 euros.»
- **Art. 34.2.a):** «…se declarará el importe total de las contraprestaciones, incluidas las cuotas y recargos repercutidos o soportados por dicho impuesto.» → con IVA.
- **Art. 34.4:** «…neto de las devoluciones, descuentos y bonificaciones concedidos y de las operaciones que queden sin efecto en el mismo año natural.» **Art. 35.2:** si ocurren en otro trimestre, «deberán ser consignados en el apartado correspondiente al trimestre natural en que se hayan producido…».
- **Art. 35.1:** «…las operaciones se entenderán producidas en el período en el que, de acuerdo con lo previsto en el artículo 69 del Reglamento del Impuesto sobre el Valor Añadido, se debe realizar la anotación registral…».

## Qué se ha hecho

| fichero | qué |
|---|---|
| `src/modules/fiscal/modelo347/modelo347.ts` | `construirModelo347`: puro. La cabecera lleva cada regla con su cita |
| `src/modules/fiscal/modelo347/modelo347.repo.ts` | `leerBorradorModelo347`: el libro de expedidas del año con `soloFacturas`, el de recibidas y las fichas de proveedor (filtradas por `merchantId`) |
| `tests/scrum1067b-borrador-347.test.mjs` | 11 casos por el lector y los libros de verdad, con `MUTACIONES_QUE_ME_TUMBAN` (11) |
| `scripts/_sin-consumir-declarados.json` | las 2 piezas sin consumidor, declaradas J1 con motivo (SCRUM-1185): sin ruta a propósito |

**Sin ruta, sin pantalla, sin texto nuevo que vea el usuario, sin esquema y sin tocar la emisión.** El aviso es el `AVISO_ORIENTATIVO` del 303, importado. Los motivos van como códigos.

**Cómo cuenta:** por NIF normalizado (sin espacios, guiones ni puntos, en mayúsculas), cada sentido por separado (B entregas, A adquisiciones), con el TOTAL de cada asiento (IVA incluido). Una R1 cuenta con su signo en el trimestre de su fecha, y el trimestre sale de la fecha del asiento con los bordes de `rangoTrimestre`. Lo que pasa de 3.005,06 € (comparado en céntimos) entra en `declarados` con su desglose; lo que se queda en 3.005,06 o menos se cuenta en `porDebajo`.

## Los datos que faltan — medido en el código, NO en ninguna base

| dato | dónde está | qué pasa con él |
|---|---|---|
| NIF del cliente | `Invoice.customerTaxId`, congelado al emitir (SCRUM-1058c) | si es NULL o vacío → `sin_nif`, señalada con su total |
| NIF de las facturas ANTERIORES al congelado | no hay (`customerName` NULL) | `nif_sin_congelar`, señalada. **No se resuelve desde la ficha viva** del cliente: el libro copia, no resuelve |
| NIF del proveedor | sólo `Provider.taxId` (ficha VIVA, nullable, nació vacío en E4); el gasto no congela nada | sin proveedor → `sin_proveedor`; sin NIF → `sin_nif`. ⚠️ si cambia el NIF de la ficha, cambia el 347 de años pasados |
| total del gasto | `Expense.amount`, que es el `total` del libro de recibidas | ⚠️ el propio libro dice que de `amount` no consta si lleva IVA; aquí se usa el total del libro tal cual |
| gastos sin `baseAmount` | el libro de recibidas no los hace asiento | no entran; viajan en `gastosFueraDelLibro` con su importe |

**NO medido:** cuántas filas reales caen en cada caso. No tengo claves de ninguna base y no me he conectado.

## Lo que NO decide este borrador (va al asesor)

- **Art. 33.2.i** (lo ya declarado en otro modelo con contenido coincidente: ¿los alquileres y los profesionales con retención, que van al 180/190?): no se aplica ninguna exclusión.
- **Anuladas:** se apartan y se señalan (`anulada`, art. 34.4), pero el libro no trae la fecha de la anulación, así que el caso «anulada en otro año» (art. 35.2) no se mide.
- **Art. 34.1.d** (arrendamiento de local por separado), **34.1.h** (metálico > 6.000 €) y **32.1.b** (módulos): fuera de la población.
- El prefijo de país de un NIF («ES…») **no** se quita: no consta que lo sea.

## Aceptación → dónde se ve

| aceptación (literal) | dónde se ve |
|---|---|
| 1. Solo tras descargar y citar la orden y responder Q-C8. | las citas de arriba; Q-C8, con la salvedad de SCRUM-1261 |
| 2. Lista por NIF (clientes de las facturas emitidas y proveedores de los gastos) con total anual y desglose por trimestre; el umbral que fije la orden citada decide quién aparece. | casos «cifras a mano: 3 NIF por encima y 1 por debajo» y «el borde del umbral» |
| 3. Operaciones sin NIF se SEÑALAN, no se ocultan. | caso «lo que no tiene NIF se SEÑALA, con su dinero» |
| 4. Marca «borrador para tu asesor»; nada se presenta (regla 7). | `avisoObligatorio` (el del 303, `[PENDIENTE microcopy oficial]`) → NO HECHO como texto de pantalla: pide firma (regla 39) |
| 5. Los suplidos y las rectificativas se tratan como diga la orden, no como se suponga. | rectificativas: caso «la rectificativa resta en SU trimestre». **Suplidos: NO HECHO**: en el libro no hay nada que distinga un suplido |
| 6. Documentos emitidos y libros intactos. | el diff no toca `invoicing/` ni los libros; la base falsa del test sólo sabe `findMany` |
| Casos límite: NIF con formatos distintos · particular sin NIF · 31 dic / 1 ene · con o sin IVA · proveedor que también es cliente | casos del test con esos nombres; lo del IVA: se suma el total (art. 34.2.a) |
| `npm test` completo en verde | NO lo corrí entero (10 sesiones a la vez): lo juzga el obligatorio |

## Lo que se corrió, con su población

- **Test nuevo:** 11 de 11.
- **Rojo primero:** sobre `main` el test no arranca (el módulo no existe). Ese rojo es CIEGO y no lo cuento: el rojo que vale es el de la mutación.
- **Mutación:** un conductor temporal, fuera del árbol, lee las declaraciones con `mutacionesDeclaradas` de la casa, muta `dist/` (nunca `src/`) y restaura por bytes. Resultado: **11 de 11 vivas, 0 mudas y 0 ciegas**, y el control sembrado (una mutación inocua) sale **MUDA**, como debe. **No corrí** la pasada entera de `meta:mutaciones`.
- **Guards de suite** (237, 976, 824, 836, 419, 702, 700, 719 y 1415, más 1185, 1387, 745, 622, 850 y el nuevo): 15 ficheros, **170 tests: 169 pass y 1 fail**. El fallo era el 1185, porque faltaban mis 2 piezas; con ellas declaradas, el 1185 da 11 de 11. Los de registro van en la entrega.
- **Guards de navegador:** no se corrieron. No hay pantalla.

## Mis errores

- La primera cifra a mano del NIF con dos formatos estaba mal sumada (escribí 3.010,07 y es 3.005,07). La cazó el test.
- Cuatro declaraciones de mutación copiaban líneas de varias sentencias, que `tsc` parte al compilar, y mi conductor las dio por CIEGAS. Las reescribí con trozos que salen iguales en `dist/`.
- Intenté añadir este tramo con un heredoc con acentos, y bash lo rechazó (no escribió nada). Lo repetí con la herramienta de escritura.
