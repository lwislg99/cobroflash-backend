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
