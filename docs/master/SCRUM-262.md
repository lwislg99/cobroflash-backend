# SCRUM-262c · el guard de teléfonos de prueba también mira `mobile`

**Medido contra:** `origin/main` = `099cfd383764b8cd87ab78e9ef7df8ca57a206a7` · 2026-10-14T16:35:59Z

Puesto S3 (2ª tanda del 14-oct). Lo pidió el orquestador el 14-oct, con una condición: los rangos de ficción reservados van en una lista blanca explícita.

## Por qué

`tests/scrum262-telefonos-de-prueba.test.mjs` vigilaba `phone`, `whatsappPhone`, `merchantPhone` y `toPhone`, pero no `mobile`, y `Customer.mobile` existe en el esquema. Con el mismo recorte de ficheros y la misma forma de literal había 22 `mobile: '…'`. De ellos, 5 estaban fuera del rango imposible y el guard no veía ninguno. Lo encontré porque mi propio test de 1367e llevaba uno (#2460).

## Qué cambia

* `ESCRITURA` incluye `mobile`.
* Lista blanca explícita, `RANGOS_DE_FICCION`, con tres bloques reservados por su regulador: Ofcom Londres (020 7946 0000–0999), Ofcom móvil (07700 900000–900999) y NANP 555-0100 a 0199. El vecino que queda fuera de cada bloque se sigue cazando, y un test lo comprueba.
* **Ficheros de otros tickets que cambian:**
  * `tests/scrum312-importador-clientes.test.mjs:303-304` (SCRUM-312): `34600000009`, un móvil de RANGO REAL, pasa a `34010000009`, que es `telefonoDePrueba(10000009)`. Uso un índice ≥ `PRIMER_INDICE_NACIONAL_ESTABLE` para que el tramo nacional no empiece por `00`. El dedup sigue midiendo: con un número distinto en el CSV, el test cae (comprobado).
  * `tests/scrum1032-contacto-con-un-toque.test.mjs:81` (SCRUM-1032): `5550100999` pasa a `+1 202 555 0199`.
* **Desviación del encargo, declarada:** el encargo daba por hecho que los dos números de `scrum1032` eran de ficción. Al medirlo, `+44 20 7946 0958` (`:47`) sí lo es, y la lista blanca lo deja pasar sin tocar el fichero. Pero `5550100999` no está en el bloque NANP de ficción, que es NPA-555-01XX: es área 555 y central 010, que ni siquiera es un número NANP válido. No lo he metido en la lista blanca (eso sería ensancharla a ojo); lo he cambiado por uno canónico del bloque. El test sólo comprueba que no sale «undefined» ni «null», y lo sigue comprobando.

## Medido

* Rojo primero: con el guard ensanchado y los ficheros sin tocar, la regla señala `scrum1032:81` (dos veces) y `scrum312:303`, y NO `scrum1032:47`.
* Control positivo del guard viejo: quitando `mobile` de `ESCRITURA` y devolviendo el `34600000009`, la regla sale VERDE (el número pasa sin que lo vea) y los dos controles nuevos de 262c caen.
* Con todo puesto: `node --test` sobre 262, 1032 y 312 da 39 tests, 39 pass.

A9: comprobación → `tests/scrum262-telefonos-de-prueba.test.mjs`
