# SCRUM-1699 · PILOTO-1 · Partes por valorar: «n líneas» y columnas rotuladas

**Medido contra:** `origin/main` = `80954a90154c0f813b75fed0df976da3b1f14ee6` · 2026-11-11T16:55Z

**Skill UI:** cargada (`yaqu-premium-ui`; AB6: sin componente ni token nuevos. Cuatro `style.cssText` pasan
a clases `.po-*` de `styles.css` con los mismos valores que pintaban; se añade una regla de móvil)

A9: comprobación → `tests/scrum1699-partes-n-lineas-y-cabeceras.test.mjs`

## Origen y firma

T6 de la ③ de SCRUM-1686 (Jira c.21459; registro `docs/master/SCRUM-1686.md`, tabla T1-T8).

**Textos FIRMADOS:** tanda N1-N13, SCRUM-1686 c.21470. Firma del fundador «si firmo» en c.21471 (~12:05
local; alcance: los trece TAL CUAL).

- **N10:** la fila de «Partes por valorar» dice «{n} líneas» · «1 línea», en lugar de «{n} ⚬».
- **N11:** las cabeceras del detalle, «Cant. · Precio ud. · Importe». Extiende a esta pantalla el alcance
  de las firmadas nº 18-19 (SCRUM-1656 c.21405, firma c.21408). No hay literal nuevo.

## Qué cambia

`public/dashboard/js/parteOficinaView.js` (carril S2):

- `parteOficinaLineas(n)` pinta N10 en la fila.
- El rótulo de cada bloque («Mano de obra» / «Materiales») pasa a ser la **cabecera de sus columnas**
  (`.po-bloque-cab`). A su derecha van «Cant.», «Precio ud.» e «Importe» (`PARTE_OFICINA_COLUMNAS`). No se
  añade otra fila.
- Cabecera y línea usan **las mismas clases de columna** (`.po-col-desc/-cant/-precio/-importe`). Así el
  rótulo cae encima de su columna, y si cambia una de las dos cambia también la otra.

`public/dashboard/css/styles.css`: las reglas `#po-detalle .po-*`, con las anchuras, la letra y el borde que
ya se pintaban en línea. Van por `#po-detalle` para ganar al `input` global.

### Lo que la medida obligó a cambiar (no estaba en el ticket)

A 390 el detalle **ya bailaba** antes de este cambio. Las tres columnas de números encogían de forma distinta
en cada línea, según la palabra más larga de la descripción, y la descripción se partía palabra a palabra
(captura «antes»). Con rótulos encima eso habría quedado a la vista. Ahora:

- Las columnas de números **no encogen** (`flex: 0 0 …`) y encoge la descripción (`min-width: 0`,
  `overflow-wrap: anywhere`).
- Por debajo de 480 px van más estrechas: Cant. 40 · Precio ud. 80 · Importe 76, con hueco de 8. Así la
  descripción tiene sitio, y caben «CANT.», que mide unos 39 px, y un importe de 9.999,99 €.
- El `@media` va DETRÁS de la regla base de `.po-linea`. Al principio iba delante, y el `gap: 10px` de la
  base le ganaba al del móvil: 4 px de descuadre medidos. El test lo ata.

## Medido en yaqu.app

Cuenta QA, sólo GET. `sondas-s2/prod-1699.mjs`, que sirve el JS y el CSS de la rama sobre prod con testigo
(los dos ficheros servidos llevan `SCRUM-1699`). Parte PT-2026-004: 4 líneas, 2 de mano de obra y 2 de
materiales.

| ancho | fila | cabeceras | descuadre cabecera↔celda (peor) | desborde de la tarjeta / de la página |
|---|---|---|---|---|
| 390 antes (prod) | «4 ⚬» | — | columnas a distinta altura por línea | 0 / 0 |
| 390 rama | «4 líneas» | Mano de obra · Cant. · Precio ud. · Importe (y Materiales) | **0 px** | 0 / 0 |
| 1280 rama | «4 líneas» | ídem | **0 px** | 0 / 0 |

Capturas, fuera del repo: `D:\MILLONARIO\cobroFlash\sondas-s2\cap1699-antes\` y `…\cap1699-local\`
(`po-detalle-*-390.png`, `po-detalle-*-1280.png`).

⚠️ **No medido con datos reales:** el singular «1 línea», porque la cuenta QA no tiene ningún parte por
valorar de una sola línea, y un importe de 9.999,99 €. El singular lo cubre el test. El ancho del importe,
la cuenta de arriba.

## Trinquete

`tests/scrum713c-…` `TECHO`: **328 → 324**. Salen cuatro `style.cssText` de la vista. Lo dijo el propio guard
sobre `80954a901` + la rama («HAN BAJADO … 324 frente al techo 328»). ⚠️ #3075 (SCRUM-1696) lo baja a 326 por
su lado. Si entra antes, la cifra **se regenera** al fusionar con el contador, no se suma de memoria.

## Pruebas

- **Rojo primero:** espejo con los tests de la rama y `parteOficinaView.js` + `styles.css` de `origin/main`
  (testigo: 0 apariciones de `SCRUM-1699` en el fichero del espejo). Caen **3/3**, cada uno por su aserción:
  «1 ⚬» en lugar de «1 línea», 0 cabeceras de bloque y la regla `#po-detalle .po-col-*` ausente.
- **Verde:** 1699 + 1692 + 1562c, 9/9, y 713c con el techo nuevo.
