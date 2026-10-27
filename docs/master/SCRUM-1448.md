# SCRUM-1448 · Dos fuentes para «el total»: medido junto a SCRUM-1446 y SCRUM-1447

**Medido contra:** `origin/main` = `a65a8c756c0363ec5ea6f4f0b1e811ba17a909c0` · 2026-10-07T23:34:34Z (hora de GitHub)

A9: comprobación → `tests/scrum1446-los-tres-importes-del-pdf.test.mjs`

La medición entera está en `docs/master/SCRUM-1446.md`, §4. Aquí, sólo el resultado:

- El caso que el ticket pedía buscar existe, generado y leído del papel: guardado 0,03 €, impreso
  0,04 € (0,02 al 21 % más 0,01 al 10 %).
- Con un tipo y precios de dos decimales diverge el 0,2 %; con dos tipos, el 24 %. Lo nuevo: una
  factura por tramos diverge entre el 7 y el 11 %, y una con descuento de línea el 25 %, con un solo
  tipo.
- La factura sin líneas imprime el guardado; con líneas lo ignora. Una factura nueva sin líneas no se
  puede emitir (leído por texto: los 7 sitios que crean factura pasan antes por el portón de líneas).
- En el presupuesto, el pie y el Total salen de dos funciones y también se separan.
- No se ha arreglado nada: la fuente del total es la decisión de SCRUM-624, que espera a la asesoría.
- No medido: ninguna factura real.

## SCRUM-1448a · ¿Algún camino crea hoy un JUST? No: 0 de 12 en `src/`, y los 3 de `scripts/` tienen la rama muerta

**Medido contra:** `origin/main` = `5078f80c3726c93b3751baf9c10134b4a486eaa4` · 2026-10-27T11:52:43Z (hora de GitHub)

A9: comprobación → `docs/master/evidencias/SCRUM-1448/censo-just.mjs`

[Escrito por J1 (`jv-j1cx`). El encargo es la decisión del fundador en SCRUM-1448 c.20918 («JUST: antes de
decidir nada, se mide si algún camino lo crea hoy»), leída entera en Jira con los otros cuatro comentarios.
Sólo lectura: no se ha tocado nada del camino de emisión. Cuando terminé, `origin/main` iba por `e19665301`; entre
las dos puntas no cambia nada en `src/`, `scripts/` ni `tests/_embudo-factura.mjs` (`git diff --stat` vacío).]

### En corto

- **Ningún camino de `src/` crea hoy un documento JUST ni con número `J-`.** Población: 340 ficheros de `src/`
  leídos por AST; 8 creaciones de `Invoice` (las mismas 8 que el censo de la casa, `tests/_embudo-factura.mjs`) y 4
  llamadas a `emitInvoice`: **12 caminos, 0 con JUST**. Nueve escriben `F1` literal, uno `R1` (`POST /:id/rectify`), y
  dos sólo pasan el valor: el `create` interno de `crearFacturaEmitida` (su `type` lo ponen sus 7 llamadores) y el de
  `emitInvoice` (`input.type ?? 'F1'`, que fijan sus 4 llamadores, los cuatro con `'F1'`).
- **Ninguna escritura posterior convierte una fila en JUST:** 24 `invoice.update|updateMany` en `src/`; ninguno
  escribe `type` ni `number`. Dos con `data` que el AST no ve, leídos a mano: `invoicesAdmin.routes.ts:791` sólo pone
  las fechas del recordatorio, e `invoiceAdmin.ts:310` sólo `status`, `paidAt` y `paidVia` (`campoPaidViaAlMarcar`).
- **Cruce por el nombre del campo (A10, SCRUM-1401):** 0 propiedades `type: 'JUST'` en todo `src/`. Los 7 literales
  `'JUST'` que hay son 5 lecturas (cuatro comparaciones y un filtro `not`), la declaración del tipo `TipoDocumento`
  (`tipoDocumento.ts:52`) y la etiqueta del registro de auditoría de `invoiceNumber.service.ts:431`, que no es la fila.
- **El número `J-` no se compone en ningún sitio:** de los 4 literales que empiezan por `J-`, 3 son lecturas (dos
  `startsWith` y una regex `/^J-/i`) y el cuarto es la declaración de `RECEIPT_NUMBER_PREFIX`. Esa constante tiene UNA lectura,
  `isReceiptNumber`. `allocateInvoiceNumber` lanza `invoicing_es_disabled` en modo `receipt` (SCRUM-1027), y es el
  único número de las 12 creaciones (el embudo da `motivo: null` a las 8).
- **Fuera de `src/` sí hay tres escritores de JUST** (`scripts/seed-demo.mjs:384` y `:441`, `scripts/seed-video.mjs:555`):
  `type: isReceiptNumber(number) ? 'JUST' : 'F1'`. Los tres toman el número de `allocateInvoiceNumber`, así que esa
  rama no puede salir: **código muerto, leído en el código y no ejecutado.**
- **Conclusión de la medición:** un JUST que se imprima hoy sólo puede ser una fila que YA exista, creada antes de
  SCRUM-1027 (21-sep-2026). Cuántas hay en cada base no lo he medido: no tengo base a la que preguntar (es la P8).

### El instrumento y sus controles

`node docs/master/evidencias/SCRUM-1448/censo-just.mjs .` → `salida-censo.txt` (salida 0, MEDIDO).

- **Siembra:** un fuente fabricado dentro del propio script, con un JUST por cada pregunta (creación,
  `emitInvoice`, `update`, prefijo), pasa por las mismas funciones. Con `--sin-siembra` sale **CIEGO, salida 2**
  (`salida-censo-ciego-sin-siembra.txt`), no verde.
- **Otro tipo:** el árbol real tiene que dar al menos una creación con `type` F1 literal (da nueve); si no, CIEGO.
- **Dos sondas:** la población de creaciones sale de mi recorrido Y de `analizarFuente` de la casa, y los conjuntos
  `ruta:línea` tienen que ser idénticos (8 = 8; 0 sólo míos, 0 sólo de la casa). Anidadas o SQL en crudo: 0.

### Lo que no he medido

- Filas JUST o `J-` que ya existan en dev, staging o producción: ninguna base (P8).
- Rutas: cada camino se nombra por su `router.<método>('<ruta>')` relativo al router; el prefijo de montaje no
  está resuelto.
- Receptores con alias (`const t = tx.invoice; t.create(…)`): el AST de la casa y el mío no los ven (el embudo lo
  dice en su cabecera).

### Errores míos

- La primera pasada etiquetaba «default de la BD» un `update` sin `type`, que en realidad quiere decir «no lo toca»;
  lo cacé al leer la salida, y la salida empujada es la corregida.
- En la primera redacción de este tramo escribí tres recuentos de memoria (10 F1, 6 lecturas de `'JUST'`, «4 literales
  y la regex»), y los tres estaban mal; los corregí releyendo `salida-censo.txt` antes de empujar.
- En el comentario de Jira (c.21002) empecé tres celdas de tabla con «0.», y Jira lo leyó como lista y se comió el
  cero sin dar error; lo vi en el cuerpo que devolvió la herramienta y lo edité.
- El encargo decía `src/`, y los escritores de JUST estaban en `scripts/`: los encontré porque pasé el embudo también
  por `scripts/` y `prisma/`, no porque el encargo lo pidiera.
