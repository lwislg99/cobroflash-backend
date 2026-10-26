# SCRUM-1446 · Los tres importes del PDF, medidos juntos (con SCRUM-1447 y SCRUM-1448): el rojo de cada uno, cuántos, y qué habría que cambiar

**Medido contra:** `origin/main` = `a65a8c756c0363ec5ea6f4f0b1e811ba17a909c0` · 2026-10-07T23:34:34Z (hora de GitHub)

A9: comprobación → `tests/scrum1446-los-tres-importes-del-pdf.test.mjs`

Lo hace J1 (equipo de Javier), sesión `jv-j1`. **Es una medición, no un arreglo.** No toca `src/`,
`public/` ni `prisma/`: genera los PDF con el código de `dist/`, lee el papel y cuenta. Los tres
arreglos cambian una cifra impresa en un documento fiscal (regla 40) y uno de ellos cambia además un
texto (regla 39): se quedan parados, esperando al fundador.

Los tres tickets van en este registro porque son el mismo fichero y la misma clase de defecto, y uno
de ellos resultó más grande que su enunciado. `docs/master/SCRUM-1447.md` y `SCRUM-1448.md` sólo
apuntan aquí.

## 0 · En corto

| | qué sale mal, generado y leído del papel | cuántos | lo que NO se sabe |
|---|---|---|---|
| ① 1446 | Dos líneas de 12,50 € al 21 % imprimen 15,13 + 15,13 (suman 30,26) y **TOTAL 30,25**. En la factura y en el presupuesto. | 1 de cada 4 facturas de dos líneas, con cualquier tipo mayor que 0 (enumeración completa, tabla del §2). Con 0 %: 0. | Cuántas facturas guardadas. |
| ② 1447 | De los 7 tipos que el servidor admite, **uno** sale con un tipo que no es el suyo: el **7,5 %**. Y sale mal en **cuatro sitios, no en uno** (§3). | 1 de 7 tipos. Dos tipos fundidos en una fila: 0 de 21 pares. | Cuántas líneas guardadas llevan 7,5 %. |
| ③ 1448 | La factura con líneas imprime un total recalculado que no es el guardado: guardado 0,03 € → impreso 0,04 €. | Depende de la clase de factura: 0,2 % con un tipo y precios de dos decimales; **24 %** con dos tipos; **7-11 %** si va por tramos; **25 %** si lleva descuento de línea (§4). | Cuántas facturas guardadas. |

**Lo que el fundador pidió que se marcara aparte** (un segundo caso en el que el documento dice un
tipo que no es el que se aplicó): hay **tres más**, todos con el mismo 7,5 %, y dos no son papel. Están
en el §3, numerados.

**Ninguna de las tres cuentas se ha hecho sobre facturas reales.** Este árbol no tiene acceso a
ninguna base y la sesión no lo pide. La sonda trae un modo para hacerlo en un minuto con una consulta
de sólo lectura (§5).

## 1 · PASO 0 y el instrumento

- Los tres tickets, leídos enteros con sus comentarios. SCRUM-1447 ya traía contestada su primera
  pregunta (comentario 18410, medición de J4c del 6-oct): el desplegable del editor ofrece 21, 10, 4 y
  0; el 7,5 % entra por la API, por la IA, por una plantilla o rectificando una factura que ya lo
  lleve. Vuelto a ejecutar aquí: `invalidTipoIva` y el portón `tipoIvaNoEmitible` admiten los mismos 7
  tipos y rechazan 9,5 · 3 · 7 · 15 · 20 · 6,5 · 5,2 · 0,5 · 10,5 · 1,4 %. Y leído hoy: el «IVA por
  defecto» del editor también es un desplegable (`quotesView.js:823`), no un campo libre.
- SCRUM-1448 decía «no he buscado un caso donde diverjan». Sus comentarios 18236 y 18238 ya remiten a
  SCRUM-624, que lo midió sobre una **copia** de la aritmética, con una sola factura por presupuesto.
  Lo que faltaba, y es lo de hoy: el PDF de verdad, las facturas por tramos y con descuento, la rama
  sin líneas y el presupuesto.
- `docs/master/SCRUM-1496.md` y `SCRUM-624.md` nombran estos tickets. El primero sólo los censa
  («NADA EN MAIN»). El segundo trae la frecuencia de ① y ③ sobre 100.000 facturas inventadas por fila.

**El instrumento:** `docs/master/evidencias/SCRUM-1446/medir-los-tres-importes.mjs`, y su salida
entera en `salida.txt`, al lado. Genera 115 PDF y los lee con `tests/_texto-del-pdf.mjs`. Para contar
sobre cientos de miles de casos usa una copia de la aritmética del PDF, y **antes la calibra**: 60
facturas generadas, de 1 a 5 líneas con los 7 tipos, y la copia coincide con el papel en las 60 (filas,
rótulos y total). Rota a propósito en un céntimo, difiere. Si no coincidiera, la sonda aborta.

## 2 · ① SCRUM-1446 — la columna de las líneas no suma el TOTAL

Generado y leído (dos líneas iguales, cantidad 1):

| caso | líneas impresas | suma a la vista | TOTAL de la factura | Total del presupuesto |
|---|---|---|---|---|
| 2 × 0,50 al 21 % | 0,61 + 0,61 | 1,22 | 1,21 | 1,21 |
| 2 × 2,50 al 21 % | 3,03 + 3,03 | 6,06 | 6,05 | 6,05 |
| 2 × 12,50 al 21 % | 15,13 + 15,13 | 30,26 | **30,25** | 30,25 |
| 2 × 0,15 al 10 % | 0,17 + 0,17 | 0,34 | 0,33 | 0,33 |
| 2 × 7,25 al 21 % | 8,77 + 8,77 | 17,54 | 17,55 | 17,54 |
| control: 2 × 100 al 21 % | 121,00 + 121,00 | 242,00 | 242,00 | 242,00 |

La última fila con diferencia enseña otra cosa de paso: las mismas dos líneas dan 17,55 en la factura
y 17,54 en el presupuesto. Eso es SCRUM-141, decidido y escrito; no es de este ticket.

Cuántos, por enumeración completa de todos los pares de precios de 0,01 a 10,00 € (500.500 por tipo):

| tipo | la columna no suma el TOTAL | desvío máximo |
|---|---|---|
| 0 % (control) | 0 | — |
| 2 % | 125.250 (25,0 %) | 1 cént. |
| 4 % | 125.040 (25,0 %) | 1 cént. |
| 5 % | 125.614 (25,1 %) | 1 cént. |
| 7,5 % | 125.298 (25,0 %) | 1 cént. |
| 10 % | 126.710 (25,3 %) | 1 cént. |
| 21 % | 125.232 (25,0 %) | 1 cént. |

Coincide con el 25,8 % que S1 midió el 2-oct sobre otra población, y con más líneas sube (46 % con 5,
60 % con 10, según esa medición; no la he repetido).

**Qué habría que cambiar, sin cambiarlo:** en `pdf.service.ts`, la fila (`:493` y `:536`) y el pie
(`:562` y `:664`) redondean en momentos distintos. O el total pasa a ser la suma de las líneas ya
redondeadas, o la columna de la línea deja de llevar el impuesto. Cuál de las dos es la decisión que
SCRUM-624 tiene en la asesoría; el mismo cambio hace falta en la fila del presupuesto (`:979`).

## 3 · ② SCRUM-1447 — el tipo redondeado a entero, y no sólo en el rótulo

Una línea de 100,00 €, tipo a tipo, generado y leído:

| tipo real | factura: fila · pie | presupuesto: fila · pie · Total | `calcVatBreakdown().rate` | desglose del registro (tipo · cuota) |
|---|---|---|---|---|
| 0 % | — · (sin fila) | 0% · (sin fila) · 100,00 | 0 | (no clasificable: lanza) |
| 2 % | 2% · IVA 2%: 2,00 | 2% · IVA 2%: 2,00 · 102,00 | 2 | 2 · 2.00 |
| 4 % | 4% · IVA 4%: 4,00 | 4% · IVA 4%: 4,00 · 104,00 | 4 | 4 · 4.00 |
| 5 % | 5% · IVA 5%: 5,00 | 5% · IVA 5%: 5,00 · 105,00 | 5 | 5 · 5.00 |
| **7,5 %** | **8% · IVA 8%: 7,50** | **8% · IVA 8%: 8,00 · 107,50** | **8** | **8 · 7.50** |
| 10 % | 10% · IVA 10%: 10,00 | 10% · IVA 10%: 10,00 · 110,00 | 10 | 10 · 10.00 |
| 21 % | 21% · IVA 21%: 21,00 | 21% · IVA 21%: 21,00 · 121,00 | 21 | 21 · 21.00 |

Dos tipos fundidos en una fila: de los 21 pares de tipos admitidos, **0**, en el PDF y en
`calcVatBreakdown`. Control: 9,5 % y 10 %, que el portón rechaza, metidos a mano en el generador, salen
en una sola fila «IVA 10%: 19,50». O sea que la segunda consecuencia del ticket no es alcanzable hoy.

### Los casos en que el documento dice un tipo que no es el aplicado

El primero es el que ya constaba (J4c, comentario 18410). Los otros tres son de hoy.

1. **La factura** imprime «8%» en la fila y «IVA 8%: 7,50» en el pie, sobre una base de 100,00. La
   cuota es la correcta; el rótulo, no. *(Ya medido; aquí repetido.)*
2. 🔴 **El presupuesto no sólo rotula: calcula.** Su pie imprime «IVA 8%: **8,00**», y el Total sigue
   siendo 107,50. Base 100,00 + IVA 8,00 = 108,00: el papel no cuadra consigo mismo por 50 céntimos,
   y la diferencia crece con la base (medio punto de la base). Sobre 1.349 presupuestos de una línea
   al 7,5 %, el pie no suma el Total en 1.348, hasta 2,50 €. Viene de
   `presentacionIva.ts:179`, que multiplica por el `rate` ya redondeado.
3. 🔴 **El desglose del registro de facturación lleva `TipoImpositivo` 8 con `CuotaRepercutida`
   7.50** sobre `BaseImponible` 100.00. Es lo que construyen `clasificarDetalleDesglose` y
   `buildDetallesDesgloseXml`, ejecutadas; el bloque entero está en `salida.txt`. Ese `rate` es
   `Math.round(tax × 100)` (`vat.service.ts:69`) y lo consumen también el libro registro
   (`libroRegistro.ts:220`, leído, no ejecutado). **Esto ya no es el papel: es lo que se remite.**
   No he comprobado qué hace la AEAT con un tipo 8 ni con una cuota que no es base por tipo.
4. 🔴 **Con descuento global, el 7,5 % cambia lo que se firma.** Un presupuesto de 100,00 € al 7,5 %
   con 10,00 € de descuento global: `calcTotal` da **96,70**; (100 − 10) × 1,075 son 96,75. Le quita
   al descuento el impuesto al 8 % (`utils.ts:187`). Y al facturarlo, la línea del descuento sale con
   `tax` 0,08, que el portón de emisión rechaza: ese presupuesto firmado no se puede facturar. El
   portón falla cerrado, que es lo correcto; lo que falla es lo de antes.

Control de los cuatro: con el 10 %, todo cuadra (base + cuota = total; 99,00 = 99,00; el portón pasa).

**Los cuatro necesitan una línea al 7,5 %.** El desplegable no la ofrece. Para un alcance real hace
falta saber cuántas líneas guardadas la llevan, y eso no lo he medido (§5).

**Qué habría que cambiar, sin cambiarlo:**
- el rótulo: los tres `toFixed(0)` de `pdf.service.ts` (`:534`, `:556`, `:990`) imprimirían el tipo con
  su decimal. Es texto de un documento fiscal: lo firma el fundador;
- la clave y el cálculo: `vat.service.ts:69` y `utils.ts:187` agrupan por el tipo redondeado; tendrían
  que agrupar por el tipo exacto. De ahí cuelgan el registro, el libro, el pie del presupuesto y el
  descuento global. Es el camino de emisión entero, no una línea del PDF.

## 4 · ③ SCRUM-1448 — el total recalculado y el guardado

`Invoice.total` es `grossOfLines(lines)`: base y cuota redondeadas por separado, por tipo. El PDF con
líneas imprime `subtotal + cuotas` redondeado una sola vez al final. Generado, pasándole el guardado:

| caso | guardado | TOTAL impreso |
|---|---|---|
| control: 1 × 100 al 21 % | 121,00 | 121,00 |
| 3 × 9,99 al 21 % (el de SCRUM-624) | 36,26 | 36,26 |
| el menor con un tipo, 21 %: 0,02 + 0,48 | 0,60 | **0,61** |
| el menor con un tipo, 10 %: 0,03 + 0,12 | 0,17 | **0,16** |
| el menor con 21 % y 10 %: 0,02 + 0,01 | 0,03 | **0,04** |
| el menor con 21 % y 4 %: 0,02 + 0,02 | 0,04 | **0,05** |

El caso de las tres líneas de 9,99 ya **no** diverge: el guardado es 36,26 desde la fase C de
SCRUM-624. `tests/scrum624b-guardado-vs-impreso.test.mjs` lo sigue comparando con 36,27, que es una
convención que ya no guarda ningún camino; no lo toco, lo digo.

Cuántos, por clase. Las líneas de cada clase las construyen las funciones reales
(`stageLinesReconciled`, `lineasParaFacturar`), y de cada clase con divergencia se generó un PDF:

| clase de factura | facturas | TOTAL impreso ≠ guardado | máx. |
|---|---|---|---|
| control: 1 línea, euros enteros, 21 % | 1.349 | 0 | — |
| 1 línea, precio de 2 decimales, 21 % | 1.349 | 3 (0,22 %) | 1 cént. |
| 2 líneas, 21 % + 10 % | 1.348 | 329 (24,41 %) | 1 cént. |
| **por tramos 30/70**, 1 línea al 21 % | 2.698 | 192 (7,12 %) | 1 cént. |
| **por tramos 50/50** | 2.698 | 308 (11,42 %) | 1 cént. |
| **por tramos 30/40/30** | 4.047 | 405 (10,01 %) | 1 cént. |
| **descuento de línea** del 5, 10, 15 y 33 % | 1.349 cada uno | 332 · 349 · 332 · 334 (≈ 25 %) | 1 cént. |
| descuento global de 10,00 € (línea negativa) | 1.324 | 5 (0,38 %) | 1 cént. |
| rectificativa de la de dos tipos (precios negados) | 1.348 | 328 (24,33 %) | 1 cént. |

Lo nuevo respecto a SCRUM-624 son los tramos y el descuento de línea: son facturas de **un solo tipo**,
las más corrientes, y ahí la divergencia no es el 0,2 % sino del 7 al 25 %. La causa es la misma en los
dos: el precio de la línea deja de tener dos decimales (1,0545 · 1,566).

El candidato que el ticket apuntaba, el descuento global en línea negativa (SCRUM-887): diverge poco,
0,38 %, como cualquier factura de un tipo.

**La factura sin líneas.** Generada con `lines = []` y total guardado 123,45: imprime 123,45, del
guardado. Con una línea y un guardado de 999,99: imprime 121,00, y lo ignora. Son las dos fuentes, a
la vista. ¿Es alcanzable hoy? Leído por texto, no por AST: los 7 sitios que llaman a
`crearFacturaEmitida` tienen `exigirLineasFacturables` por encima, y ese portón exige al menos una línea
con importe. Así que una factura nueva sin líneas no se emite. Las anteriores al portón, sin medir.

**El presupuesto** imprime siempre el guardado (`calcTotal`), pero su pie lo calcula otra función
(`pieDePresupuesto`). Base + cuotas del pie contra el Total:

| clase de presupuesto | presupuestos | Base + cuotas ≠ Total | máx. |
|---|---|---|---|
| control: 1 línea, euros enteros, 21 % | 1.349 | 0 | — |
| 1 línea de 2 decimales, 21 % | 1.349 | 8 (0,59 %) | 1 cént. |
| 2 líneas, 21 % + 10 % | 1.348 | 329 (24,41 %) | 1 cént. |
| 1 línea con descuento de línea del 15 % | 1.349 | 408 (30,24 %) | 1 cént. |
| 1 línea al 21 % con 10,00 € de descuento global | 1.324 | 2 (0,15 %) | 1 cént. |
| 1 línea al 7,5 % | 1.349 | 1.348 (99,93 %) | 2,50 € |

El comentario del propio fichero (`pdf.service.ts`, sobre el pie) dice «hoy no se ha visto separarse».
Se separan.

**Qué habría que cambiar, sin cambiarlo:** en `pdf.service.ts:664`, imprimir `params.total` —lo que ya
hace la rama sin líneas (`:671`) y el presupuesto (`:1110`)— en vez de `grandTotal`. Es la opción A de
SCRUM-624, y el fundador dejó escrito el 4-sep que no se elige número hasta que conteste la asesoría.
Con el guardado en el pie, la columna seguiría sin sumarlo (①): los dos se deciden juntos.

## 5 · Lo que no he medido, y cómo se mide

- **Ninguna factura real, ningún presupuesto real.** Las poblaciones de arriba son enumeraciones y
  barridos deterministas, no datos de nadie. Para la carta al asesor lo que falta es saber si hay
  alguna línea guardada al 7,5 %.
- Cómo: una consulta de sólo lectura, que corre quien tenga permiso sobre la base
  (`SELECT id, number, type, total, lines FROM invoices`), volcada a un JSON, y
  `node docs/master/evidencias/SCRUM-1446/medir-los-tres-importes.mjs . --filas <fichero.json>`.
  Dice sobre cuántas filas miró, cuántas caen en cada uno de los tres, qué tipos encontró y cinco
  ejemplos de cada. Probado con filas fabricadas (5 filas: 1 limpia, y las otras cuatro en su casilla)
  y con un fichero vacío, que sale «CIEGO» con código 2 en vez de dar un cero.
- Los presupuestos guardados (`Quote.lines`) no los clasifica ese modo: habría que añadirlo.
- No he ejecutado el libro registro ni el modelo 303 con una línea al 7,5 %: leídos.
- No he generado el PDF de una rectificativa (`type: 'R1'`); su clase está contada con la copia.
- No he recorrido las rutas que guardan un presupuesto para ver si alguna deja pasar un tipo que el
  portón de emisión rechazaría: el PDF del presupuesto no pasa por ese portón (lo dijo J4c).
- La tanda completa no se ha corrido (no hay turno ni memoria): sólo los ficheros nombrados abajo.

## 6 · El test, y lo que fija

`tests/scrum1446-los-tres-importes-del-pdf.test.mjs` genera los PDF y fija los importes exactos de
hoy, incluidos los que salen mal, como **declarados**: 8 casos, 5 declaraciones. No modifica nada del
camino de emisión; lo ejecuta. Cuando alguien arregle uno de los tres, ese caso cae y dice qué borrar.

Lo vi caer antes de darlo por bueno, y no a propósito: ver §7.

## 7 · Errores míos

- Puse a ojo el ejemplo de la factura por tramos en el test: «tramo 1 de 2». Era el tramo 2. El test
  salió rojo (guardado 1,28, no 1,27) y lo corregí leyendo lo que la función devuelve.
- En la sonda, la fila fabricada que tenía que caer en ③ no caía: había supuesto que 0,05 al 10 % más
  0,05 al 21 % divergía, y no. La cambié por el menor caso que la propia sonda encuentra, y ahora la
  sonda compara su recuento con el esperado y lo dice.
- Los dos son el mismo fallo: un ejemplo escrito antes de ejecutarlo. Por eso la línea `A9:` apunta al
  test, que es lo que lo cazó.
- El hook de arranque me dijo «SIN IDENTIDAD… no construyas» porque no reconoce el nombre `jv-j1`. Es
  SCRUM-1498, de S5; seguí, como dice la ficha común.
- `prisma generate` no se corrió: el árbol anidado no tiene `node_modules` y el cliente de Prisma es
  del checkout compartido. Nada de lo medido lo usa. `dist/` se emitió con `tsc --noCheck`.

## SCRUM-1446b · La sonda dejaba su carpeta temporal si salía a mitad (el rojo de #2289), y lo que `temporal()` sola no cubre en Windows

**Medido contra:** `origin/main` = `9dd6aa773799565c3753c51f289efae1a4ecbca0` · 2026-10-08T00:07:30Z (hora de GitHub)

A9: comprobación → `tests/scrum864c-el-temporal-no-vuelve.test.mjs`

Lo hace J1 (equipo de Javier), sesión `jv-j1`, relevo de la que escribió lo de arriba. Sólo cambia la
sonda `docs/master/evidencias/SCRUM-1446/medir-los-tres-importes.mjs`. Nada de `src/`, ningún texto,
ningún censo ni lista de excepciones. Lo medido es el árbol de la rama (base `a65a8c75`), en esta
máquina (Windows); la línea de arriba dice dónde estaba `origin/main` en ese momento, no que la rama
lo lleve dentro.

**El rojo.** El obligatorio de `c365c421` (job `113072029875`) caía por un caso:
`SCRUM-864c · ③`, con `[NO_GARANTIZADA] …medir-los-tres-importes.mjs:27 · mkdtempSync(…) → TMP · borra
en 403 SIN cobertura`. Tenía razón: la sonda borraba su carpeta en la última línea, y tiene cuatro
`process.exit` antes. Lo reproduje en local antes de tocar nada (3 ✔ y 1 ✖, el mismo).

**Dos manos en la misma rama.** A las 00:03:01Z, mientras yo medía, una ejecución automática de
`@claude` (la llama `yaqu-bot` cuando el obligatorio sale rojo) empujó `7d40a8fe`: el `import` y
`temporal('scrum1446-')`, que es lo que SCRUM-864c aconseja. Mi árbol no lo tenía; lo vi al leer la
punta del remoto antes de empujar. Lo fusioné con lo mío (un merge, sin reescribir nada).

**Lo que ese arreglo no cubre, medido.** La sonda hace `process.chdir` a su carpeta temporal, y
Windows no borra el directorio en el que sigue estando el proceso. `temporal()` borra al salir, con el
proceso todavía dentro: el borrado falla, y falla callado. Carpetas `scrum1446-*` en el temporal del
sistema, antes y después de una salida a mitad (`--filas` con un JSON `[]`, que sale con `EXIT=2`):

| versión de la sonda | antes | después |
|---|---|---|
| `c365c421` (la original; control) | 3 | 4 |
| `7d40a8fe` (`temporal()` sola) | 5 | 6 |
| ésta, quitándole la línea del `chdir` de salida (mutación) | 4 | 5 |
| ésta | 3 | 3 |
| ésta, segunda pasada | 6 | 6 |

Por eso la sonda registra, ANTES de llamar a `temporal()`, un manejador de `exit` que devuelve el
proceso al temporal del sistema: los manejadores corren por orden de registro, y cuando llega el
borrado el proceso ya está fuera. Las dos líneas finales (el `chdir` y el `rmSync` a mano) sobran y se
van. En el camino feliz ninguna versión deja resto.

**Los controles.**

- `tests/scrum864c-el-temporal-no-vuelve.test.mjs`: de 3 ✔ y 1 ✖ a 4 ✔ de 4. Los cuatro por nombre: ①,
  ①b, ② y ③.
- La sonda sigue midiendo lo mismo: su salida con el cambio es **idéntica** a `salida.txt` (`cmp`,
  12.216 bytes, 126 líneas, `EXIT=0`). Antes de tocarla también lo era: el control de que `salida.txt`
  se puede reproducir.

**Lo que NO he medido.** Linux: en el corredor de CI el borrado con el proceso dentro puede no fallar,
y entonces `7d40a8fe` bastaba allí. Tampoco he mirado cuántos otros llamadores de `temporal()` hacen
`chdir` a lo que crean; SCRUM-864c da por sano todo `temporal(…)` sin ejecutarlo, así que en Windows
ese caso sale ✔ dejando resto. `tests/_temporal.mjs` no es de mi carril: lo digo en la entrega y no lo
toco.

**Restos en esta máquina.** Seis carpetas `scrum1446-*` vacías en el temporal del sistema: tres de la
sesión anterior y tres de mis controles de arriba. No las borré: el arnés no me deja un `rm -rf` sobre
una ruta que sale de una variable.

**Errores míos.**

- Medí y arreglé durante siete minutos sin mirar la punta del remoto: la rama ya no era
  `c365c421`. Lo cazó el `git ls-remote` de antes de empujar, que es para lo que está (A4).
- El hook de arranque me dijo «SIN IDENTIDAD… no construyas» (`jv-j1`). Es SCRUM-1498, de S5; seguí,
  como dice la ficha común.

### SCRUM-1446b · ¿Se llega al presupuesto que no se puede facturar eligiendo en los desplegables?

**No.** Medido ejecutando el módulo real de los dos desplegables y, con lo que ofrecen, `calcTotal`,
`lineasParaFacturar` y el portón de tipos de `dist/`. Sonda y salida:
`docs/master/evidencias/SCRUM-1446/medir-el-descuento-global-por-el-desplegable.mjs` y
`salida-desplegable.txt`.

- Los dos desplegables («IVA por defecto» del documento y el de cada línea) ofrecen los mismos cuatro
  tipos: 21, 10, 4 y 0. El portón admite siete; los que no se pueden elegir son 7,5, 5 y 2.
- Con los cuatro elegibles, un solo tipo y descuento global: 76.600 casos (19.150 por tipo). El
  descuento se aplica con un tipo distinto del de la línea en **0**, y el portón rechaza la factura en
  **0**.
- Control, la misma población al 7,5 %: 19.150 de 19.150 en las dos columnas, y el caso del ticket tal
  cual (100,00 con 10,00 de descuento): se firma 96,70, la cuenta da 96,75, y la línea del descuento
  sale con tipo 0.08, que el portón rechaza.
- El 5 % y el 2 % tampoco fallan (0 y 0): el defecto necesita un tipo con decimales en el porcentaje, y
  entre los siete admitidos sólo lo es el 7,5 %.

**Lo que sí queda, y es otra cosa.** Con tipos elegibles, lo firmado difiere en 1 céntimo de
(base − descuento) × (1 + tipo) en 91 de los 76.600 (17 al 21 %, 74 al 10 %, 0 al 4 % y al 0 %). Son
empates exactos en medio céntimo que la coma flotante resuelve hacia abajo (8,51 al 21 % con 0,01 de
descuento: 1028,5 céntimos, se firma 10,28). Esas facturas pasan el portón. No he seguido si la
factura sale por lo firmado; es la familia de SCRUM-141 y SCRUM-624, no la de este defecto.

**Y un tercer caso que el desplegable sí alcanza, ya decidido:** dos tipos elegibles distintos con
descuento global no se facturan (6 pares de 6: sus líneas salen a 0). Es la decisión C de SCRUM-887,
escrita en `invoiceLines.service.ts`, no un hallazgo.

**Por dónde entra entonces un 7,5 %.** Si una línea LLEGA con 7,5 %, el desplegable lo enseña y lo
conserva (`opciones(7.5)` → 21, 10, 7.5, 4, 0): no es cerrado, a propósito. Las puertas por las que
puede llegar las he **leído, no ejecutado**: la API, el asistente (valida con la misma regla de siete
tipos, que admite 0.075), una plantilla o un borrador que ya lo traigan. No he mirado si alguna de
ellas lo produce en la práctica, ni si hay alguno guardado: no he consultado ninguna base.

## SCRUM-1446b · EL ARREGLO: el tipo de IVA deja de redondearse a entero al calcular y al construir el registro (②, ④, ⑤ y el descuento global). ① y ③ NO se tocan

**Medido contra:** `origin/main` = `fc639ef96164b56ae99c129b7202c56c66abdaf4` · 2026-10-08T01:16:05Z (hora de GitHub)

A9: comprobación → `tests/scrum1446-los-tres-importes-del-pdf.test.mjs`

Lo hace J1 (equipo de Javier), sesión `jv-j1`, rama `scrum-1446b-arreglo-de-los-importes`.
**Permiso:** GO del fundador en Jira, SCRUM-1446 `c.18865` («1-Ok go»), que levanta la regla 40 sólo
para los importes y los rótulos. El GO se corrigió en `c.18878`: decía «con el 10 % los CINCO casos
cuadran» y `c.18862` decía CUATRO.

### 0 · En corto

| caso del GO | qué pasa ahora | estado |
| --- | --- | --- |
| ⑤ desglose del registro que se REMITE | `TipoImpositivo` 7.5 · base 100.00 · cuota 7.50 (antes 8 · 100.00 · 7.50) | **arreglado** |
| ④ el PDF del presupuesto calculaba al 8 % | pie 7,50 sobre base 100,00, Total 107,50: cuadra (antes 8,00, no cuadraba por 50 cént.) | **arreglado**; el rótulo del pie sale «7.5%» con punto (ver §4) |
| descuento global al 7,5 % | se firma 96,75 = (100 − 10) × 1,075; la línea del descuento lleva `tax` 0.075 y pasa el portón (antes 96,70, `tax` 0.08, rechazada) | **arreglado** |
| ② rótulo «8%» | fila del PRESUPUESTO: «7,5%». Fila y pie de la FACTURA: siguen «8%» | **a medias**: la factura no se puede tocar sin cambiar dos guards (§3) |
| ① la columna no suma el TOTAL | igual que antes | **NO TOCADO**, a propósito (§2) |
| ③ impreso ≠ guardado | igual que antes | **NO TOCADO**, a propósito (§2) |

**El control que manda:** 22.184 casos sin 7,5 % (0, 2, 4, 5, 10 y 21 %), comparados byte a byte entre
el árbol de antes y el de después: **0 distintos**. De ellos 254 son PDF generados y leídos.

### 1 · Qué se ha cambiado

La causa era `Math.round(tax * 100)` en dos sitios. Ahora los dos llaman a `tipoEnPorcentaje`
(`core/utils/utils.ts`), que redondea a dos decimales de porcentaje: 0.075 → 7.5, 0.21 → 21.

- `src/modules/invoicing/domain/vat.service.ts` — `calcVatBreakdown` agrupa por el tipo con decimales.
  De él cuelgan el registro, el libro, el pie del presupuesto y la factura final.
- `src/core/utils/utils.ts` — `descuentoGlobalEnCentimos`, lo mismo. Nombrado en el GO.
- `src/modules/invoicing/infra/pdf/pdf.service.ts` — sólo la fila del PRESUPUESTO (`generateQuotePdf`).
- `src/modules/invoicing/domain/finalInvoice.service.ts` — el concepto «Menos anticipo… — IVA 7,5 %»
  escribe el tipo con coma; su `tax` pasa de 0.08 a 0.075 sin tocar esa línea. **Leído, no ejecutado.**

Ningún texto nuevo: donde ponía una cifra hay otra cifra. No se toca el sellado, la huella, la cadena
ni la firma, ni `prisma/schema.prisma`, ni ninguna base.

**Lo que NO cambia ni con 7,5 %** (5.070 casos de dominio con alguna línea al 7,5 %): lo guardado
(`grossOfLines`, que es `Invoice.total`) 0 · la cuota total 0 · la base total 0 · lo firmado sin
descuento global 0. Cambian lo firmado CON descuento global (4.692) y el registro (4.349).

**Las facturas ya emitidas no se tocan (regla 29).** Las que salieron con «8%», y los registros ya
construidos con `TipoImpositivo` 8, se quedan como están. Cambia lo que se construye desde ahora.
No he mirado si existe alguna: no he consultado ninguna base.

### 2 · ① y ③ no se arreglan aquí, y no es por falta de permiso: falta una CONVENCIÓN

No salen de `Math.round(tax * 100)`. Medido con la sonda de `main` sobre `fc639ef9`, antes de tocar:

- **①** la columna no suma el TOTAL en **126.710 de 500.500** pares al 10 % y 125.232 al 21 %. Su
  control a cero es el 0 %, no el 10 %.
- **③** el TOTAL impreso no es el guardado en **8.699 de 500.500** al 10 % y 646 al 21 %; 24 % con
  21 % + 10 %.

Con dos decimales no pueden cuadrar a la vez la suma de las líneas y el total: hay que elegir cuál
manda en el papel, y cualquiera de las dos elecciones mueve céntimos en documentos al 10 % y al
21 %, que es lo que el control del GO prohíbe. Además ③ es la opción A de SCRUM-624, que según
`c.18234` de SCRUM-1446 el fundador dejó a la espera de la asesoría (`c.14405` de SCRUM-624: citado
de segunda mano, no lo he abierto).

### 3 · La fila y el pie de la FACTURA siguen diciendo «8%», y por qué

Las tres líneas que lo arreglan están dentro de `generateInvoicePdf` (`pdf.service.ts:534`, `:556`
y `:646`). Las escribí, y al correr la tanda cayeron dos guards que comparan esa función byte a byte
con la base de la rama y no tienen forma de admitir un cambio autorizado:
`tests/scrum603b-descripcion-en-el-albaran.test.mjs` y `tests/scrum723-guard-contra-su-base.test.mjs`.
Desde que existen, ningún PR ha cambiado esa función (el último que tocó el fichero, SCRUM-1470, no
entra en ella). Para que pase hay que cambiar los guards, y eso no lo decido yo (regla 41, y el GO
dice «ningún guard se relaja»). **Deshice las tres líneas.** El cambio pendiente, entero:

    :534  `${(taxR*100).toFixed(0)}%`      →  `${rotuloDeTipo(tipoEnPorcentaje(taxR))}%`
    :556  `${(t*100).toFixed(0)}%`         →  `${rotuloDeTipo(tipoEnPorcentaje(t))}%`
    :646  parseFloat(b[0]) - parseFloat(a[0])  →  lo mismo, cambiando antes la coma por punto

Con ellas puestas medí lo mismo que en §0: 0 distintos sin 7,5 %, y la factura imprimía
«7,5%» y «IVA 7,5%: 7,50». En la factura es sólo el rótulo: la cuota impresa ya era la buena (7,50).

### 4 · Lo que queda en carriles que no son el mío (leído, NO ejecutado, NO tocado)

Las escribí también y las deshice al ver de quién eran (`docs/equipo/dos-equipos.md` §3):

- `src/modules/quotes/domain/presentacionIva.ts:181` (S1) — el rótulo del pie del presupuesto se
  compone con `${e.rate}%`. Antes imprimía «IVA 8%:»; ahora «IVA 7.5%:», con punto. La cifra es buena.
- `src/modules/system/app/routes/quoteDecisionLanding.routes.ts:440` y `:452` (S1) — la página del
  cliente pinta `IVA (${e.rate}%)` y reconoce el pie con `/^IVA (\d+)%:$/`, que no casa con «7.5%».
- 🔴 `public/dashboard/js/quoteDescuentos.js:169` (S2) — la copia del editor sigue con
  `Math.round(tax * 100)`. Con una línea al 7,5 % y descuento global, **la pantalla calculará con 8 y
  el servidor firmará con 7,5**: antes coincidían (los dos mal) y ahora no. Es el único punto en que
  este arreglo deja algo peor de lo que estaba, y sólo con el tipo que los desplegables no ofrecen.
- `aiQuoteAssistant.js:145`, `productsView.js:820`, `quotesDetailView.js:635` — rótulos de pantalla
  con `toFixed(0)`: el mismo «8%», en pantalla.

### 5 · Los controles

**El rojo de partida.** `node docs/master/evidencias/SCRUM-1446/medir-los-tres-importes.mjs .` sobre
`fc639ef9`: `EXIT=0`, 12.215 bytes, idéntica a `salida.txt` salvo la línea 1, que lleva el nombre del
árbol. Una diferencia explicada.

**Byte a byte.** `docs/master/evidencias/SCRUM-1446b/volcar.mjs` vuelca 27.321 casos por árbol (321
PDF generados y leídos, más dominio: desglose, guardado, firmado, reparto, líneas a facturar, portón,
pie y registro) y `comparar.mjs` los compara línea a línea. Antes = un worktree en `fc639ef9`;
después = esta rama. Salida en `salida.txt`.

| | casos | distintos |
| --- | --- | --- |
| sin 7,5 % | 22.184 | **0** |
| con 7,5 % | 5.137 | 5.104 (los 33 iguales son los PDF de FACTURA, §3) |
| control: antes contra antes | 27.321 | 0, y el comparador se declara CIEGO (salida 2) en vez de dar un verde |

**Por nombre, vistos caer antes y pasar después.** El fichero nuevo del test, corrido contra el árbol
de antes: caen los tres, y sólo ellos (6 pasan, 3 caen). Contra esta rama: 9 de 9.

- `SCRUM-1447 · ② el pie del presupuesto calcula la cuota del 7,5 % al 7,5 %, y base + cuota es el Total`
- `SCRUM-1447 · ② el desglose del registro de facturación lleva el tipo REAL: tipo × base = cuota en todos los admitidos`
- `SCRUM-1447 · ② el descuento global de un presupuesto al 7,5 % se firma con su tipo y se puede facturar`

El segundo recorre los tipos que da `TIPOS_IVA_ES_BP`, no una lista copiada: un tipo con decimales
que se admita mañana entra solo. `DECLARADOS` baja de cinco a tres.

**El caso de los 91 de 76.600** (1 céntimo entre lo firmado y la cuenta, con tipos elegibles):
`medir-el-descuento-global-por-el-desplegable.mjs` en los dos árboles da las mismas filas elegibles
(21 %: 17 · 10 %: 74 · 4 %: 0 · 0 %: 0). **Ni lo arregla ni lo empeora.** En su control al 7,5 %: el
mecanismo pasa de 19.150 a 0, los rechazos del portón de 19.150 a 0, y «la cuenta no sale» de 11.981
(máx. 17 cént.) a 170 (máx. 1 cént.), que es la misma familia del medio céntimo.

**`TipoImpositivo` 7.5 y el esquema.** El patrón de `Tipo2.2Type` en
`src/modules/fiscal/verifactu/xsd/SuministroInformacion.xsd:517` admite «7.5» (control: «7,5» no).
Qué hace la AEAT al recibirlo no está comprobado.

**Tanda dirigida:** 152 ficheros (los que nombran lo tocado, más scrum237, 267, 514, 864c, 976, 1294 y
1295): 1.472 tests, 1.450 pasan, 0 caen, 22 saltan (todos por falta de base: `QA_DB_TEST`,
`LIBRO_PG_URL`, `SERIE_PG_URL`). `tsc --noEmit`: 0 errores.

### 6 · Lo que no he hecho

- La tanda completa en local (1.292 ficheros): la corre el check obligatorio.
- Ejecutar el libro registro, el modelo 303 y el recargo con un 7,5 %. Leído: reciben 7.5 donde
  recibían 8, y ni uno ni otro tienen casilla ni recargo en sus tablas.
- La factura final con un anticipo al 7,5 % (`finalInvoice.service.ts`): leído, no ejecutado.
- Contar facturas o presupuestos REALES al 7,5 %: no hay base a la que yo pueda preguntar. Un
  presupuesto ya firmado al 7,5 % con descuento global daría ahora otro total si se recalcula; no sé
  si existe alguno ni si su total se recalcula.
- Las dos sondas de `evidencias/SCRUM-1446/` se declaran CIEGAS (salida 3) sobre esta rama: su
  calibrado y su control llevan dentro el defecto que ya no está. No las he reescrito. Siguen
  valiendo contra un árbol anterior al arreglo.

### 7 · Errores míos

- Escribí en tres ficheros del otro equipo (`presentacionIva.ts`, `quoteDecisionLanding.routes.ts`,
  `quoteDescuentos.js`) antes de mirar de quién eran. La cerradura no me paró. Deshecho antes de
  comitear; lo cazaron un rojo de `scrum1325b` y otro de `scrum811c`, no yo.
- Toqué `generateInvoicePdf` sin preguntar antes a sus guards. Lo cazó la tanda dirigida.
- En `salida.txt` copié un `EXIT=0` que era el del `tail` de la tubería; el del comparador era 2.
  Corregido tras repetir la orden sin tubería.
- Puse a ojo un caso de 100,00 € en `casos-con-nombre.mjs` sobre una población que llega a 30,00 €:
  reventó al ejecutarlo.

## SCRUM-1446c · LA FACTURA SIGUE IMPRIMIENDO «8%»: el parche NO ha entrado, porque la «base» de los dos guards es un commit y no un fichero

**Medido contra:** `origin/main` = `176d0772eb0f4be574dad06f5c548f7da73c5ca7` · 2026-10-08T01:42:00Z (hora de GitHub)

A9: aviso → A10 «La base de un guard puede ser un commit y no un fichero: antes de autorizar moverla se lee contra qué compara.» — no se pudo comprobar: el permiso se escribe en Jira y ningún test del repositorio lee Jira

Lo hace J1 (equipo de Javier), sesión `jv-j1` (relevo), rama `scrum-1446c-la-factura-dice-siete-y-medio`.
Permiso leído: SCRUM-1446 `c.18885` (y el GO de origen, `c.18865`). Respuesta del orquestador al
aviso de esta tanda: `c.18895` (citado por su mensaje; no lo he abierto).

### 0 · En corto

**Este tramo no cambia ni una línea de `src/modules/invoicing/`. La fila y el pie de la FACTURA
siguen rotulando «8%» sobre una cuota del 7,5 %.** Quien lea este PR no debe creer que el papel de
la factura está arreglado: es la tercera vez que se escribe y sigue siendo verdad.

`c.18885` autoriza dos cosas: aplicar las tres líneas de §3 del tramo anterior y «actualizar la base
byte a byte» de `scrum603b` y `scrum723`, sin tocar su lógica. **La segunda no se puede hacer: no
hay ningún fichero de base.** Lo que los dos guards llaman «base» es el commit del que sale la rama.

### 1 · Contra qué comparan, medido

Leído en `tests/_base-de-la-rama.mjs` y visto en el mensaje de su propio rojo:

- `scrum603b` recorta el TEXTO FUENTE de `generateInvoicePdf` en `pdf.service.ts` del disco y lo
  compara con el mismo recorte de `git show <merge-base de HEAD con origin/main>:pdf.service.ts`.
- `scrum723` hace lo mismo con el ámbito alcanzable (la función más cinco piezas del módulo).
- Ninguno genera ni lee un PDF, y ninguno lee un fichero guardado. En CI el HEAD es el commit de
  mezcla, así que la diferencia es siempre «lo que aporta este PR».

Consecuencia: un PR que cambie esa función sale rojo en el obligatorio por construcción, y no existe
vía declarada para un cambio autorizado. Una vez dentro, la base se mueve sola para las ramas
siguientes: no hay nada que regenerar.

| estado del árbol | `SCRUM-603b · 🔴 EL PDF DE LA FACTURA NO SE HA TOCADO: byte a byte con la BASE de la rama` | `SCRUM-723 · 🔴 el ÁMBITO ENTERO de la factura no ha cambiado respecto a la base de la rama` |
| --- | --- | --- |
| tal cual (`176d0772`) | pasa | pasa |
| con las tres líneas puestas, y nada más | **cae** | **cae** |

Población: esos dos casos, filtrados por nombre (2 de 2 pasan; con el parche, 0 de 2). El mensaje
del primero: «respecto al punto de partida de esta rama (origin/main @ 176d0772): 22106 car. frente
a 22040». El del segundo: «base: origin/main @ 176d0772».

### 2 · Las dos vías, y ninguna la decide una sesión

- **A.** Darles a los dos guards una vía DECLARADA de cambio autorizado: admitir el ámbito del disco
  si su huella coincide con una declarada junto a la cita del permiso; todo lo demás sigue cayendo.
  Es tocar su lógica: pide permiso nuevo (regla 41). Es la que recomiendo.
- **B.** Que alguien con permiso mergee con el obligatorio en rojo por esos dos casos.

El orquestador ha subido la A al fundador y ha descartado la B (su mensaje del 8-oct).

**De quién son los dos guards:** `node scripts/carriles.mjs de <ruta>` contesta «sin fila en §3: nadie
lo reclama» para los dos y para sus dos ficheros de apoyo. Controles: `pdf.service.ts` → J1,
`presentacionIva.ts` → S1. Pero contesta lo mismo para un test que no existe, así que la herramienta
no dice nada sobre `tests/`. Lo que hay es `docs/equipo/dos-equipos.md:170`: el test de un ticket es
del puesto que trabaja el ticket. Nacieron el 3 y el 4-sep (SCRUM-603 y SCRUM-723). No he abierto
esos dos tickets para leer su área.

### 3 · El parche, que NO está aplicado, y lo que haría

Las tres líneas, tal cual las puse y las quité (ediciones inversas; `git status` limpio y diff vacío
comprobados antes de seguir): `docs/master/evidencias/SCRUM-1446c/parche-no-aplicado.diff.txt`.

    :534  `${(taxR*100).toFixed(0)}%`          →  `${rotuloDeTipo(tipoEnPorcentaje(taxR))}%`
    :556  `${(t*100).toFixed(0)}%`             →  `${rotuloDeTipo(tipoEnPorcentaje(t))}%`
    :646  parseFloat(b[0]) - parseFloat(a[0])  →  lo mismo, cambiando antes la coma por punto

Medido con el instrumento del tramo anterior (`evidencias/SCRUM-1446b/volcar.mjs` y `comparar.mjs`),
antes = este árbol sin el parche, después = con él, los dos compilados con `tsc --noCheck`:

| | casos | distintos |
| --- | --- | --- |
| sin 7,5 % (0, 2, 4, 5, 10 y 21 %) | 22.184 | **0** |
| con 7,5 % | 5.137 | 33: los 33 PDF de FACTURA con alguna línea al 7,5 %, y sólo ellos |
| control: antes contra antes | 27.321 | 0, y el comparador se declara CIEGO (salida 2) |

**Qué cambia dentro de esos 33**, trozo a trozo (`que-cambia.mjs`, salida en `salida-que-cambia.txt`):
69 líneas de texto del PDF, 0 casos con líneas de más o de menos. En las 69 el trozo que cambia es
«8» → «7,5» dentro de un rótulo de tipo: 41 con un rótulo («…8%…» en la fila, «IVA 8%:» en el pie) y
28 con dos en la misma línea del desglose («8%368,63 EURIVA 8%:27,65 EUR»). Ningún importe, ninguna
fecha, ningún orden. Control: el mismo guion, antes contra antes, se declara CIEGO (salida 2).

La línea 646 no cambia el orden de ninguno de estos casos: sin ella, «7,5%» se leería como 7, que
cae entre 5 y 10 igual que 7,5.

### 4 · Lo que no cambia, lo diga quien lo diga

- **Las facturas ya emitidas no se tocan (regla 29).** Las que salieron con «8%» se quedan como
  están, entre o no este parche.
- Nada del sellado, la huella, la cadena ni el XML. Ningún texto nuevo. Ninguna base consultada.
- `scrum603b`, `scrum723` y sus ficheros de apoyo: sin tocar.
- Los tres ficheros de carril ajeno de §4 del tramo anterior: sin tocar.

### 5 · Lo que no he hecho

- No he empujado el parche a ninguna rama: un rojo del obligatorio hace que `yaqu-bot` llame a una
  ejecución automática sobre la rama.
- No he generado un PDF a mano para mirarlo: lo de §3 es el texto que saca el lector de la casa.
- No he corrido la tanda completa ni `tsc --noEmit` (el árbol es anidado y no trae `node_modules`).
- No he abierto SCRUM-603 ni SCRUM-723 en Jira.

## SCRUM-1446d · LA VÍA DE CAMBIO AUTORIZADO de `scrum603b` y `scrum723`, y el «8%» de la factura arreglado por ella

**Medido contra:** `origin/main` = `37311b671db107cc48a31fc359104fe36525ad2e` · 2026-10-23T10:58:39Z (hora de GitHub)

A9: comprobación → `tests/scrum1446d-via-de-cambio-autorizado.test.mjs`

Carril J1 (`src/modules/invoicing/**`, `docs/equipo/dos-equipos.md:117`). Los dos guards y sus
ficheros de apoyo: `carriles.mjs` dice «nadie lo reclama» (ojo: contesta lo mismo para un fichero
que no existe, §5 del tramo SCRUM-1446c).

### 0 · La decisión, y lo que autoriza

SCRUM-1446 c.20473 (23-oct-2026, escrito por el orquestador del equipo de Javier transcribiendo al
fundador): Javier elige **«Sí, abrir la vía»** (la opción A de c.18901). Alcance, de ese comentario:
que los dos controles admitan un cambio AUTORIZADO con su firma localizable, sin relajar lo que
vigilan para cualquier otro cambio, y que entre el arreglo del «8%». El parche de 3 líneas es el de
c.18885 (`docs/master/evidencias/SCRUM-1446c/parche-no-aplicado.diff.txt`), aplicado con
`git apply` tal cual, sin una línea más.

El sufijo del encargo era «1446c», pero ya lo gastó el PR #2300 (rama
`scrum-1446c-la-factura-dice-siete-y-medio`, mergeada): este tramo y su rama van con «1446d».

### 1 · El mecanismo

`tests/_cambios-autorizados-de-la-factura.mjs`, con una lista `CAMBIOS_AUTORIZADOS`. Cada entrada
lleva su firma (`SCRUM-1446 c.20473`), su registro (este fichero), la cita literal y **dos pares de
huellas sha256**: el cuerpo de `generateInvoicePdf` (lo que compara `scrum603b`) y su ámbito
alcanzable (lo que compara `scrum723`), cada uno en la BASE y en el DISCO.

En los dos guards sólo se añade una línea antes de su `assert.equal`: si el texto ha cambiado y el
par (base → disco) está declarado, el caso termina; si no, el `assert.equal` de siempre, con su
mensaje de siempre. Lo que exigen no cambia:

- un cambio sin declarar → cae;
- el cambio autorizado MÁS un byte → cambia la huella del disco → cae;
- el mismo cambio sobre otra base (si `main` toca la factura entretanto) → cae, y hay que pedirlo
  otra vez;
- la vuelta atrás, o el par del cuerpo usado para el ámbito → cae.

Al entrar en `main`, base y disco vuelven a coincidir y la entrada ya no interviene: queda como
historia de quién autorizó qué. Las huellas salen EJECUTANDO
`docs/master/evidencias/SCRUM-1446d/huellas.mjs` (salida en `salida-huellas.txt`: 22040 → 22106
caracteres el cuerpo, los mismos que el mensaje rojo de c.18895; 27613 → 27679 el ámbito).

`tests/scrum1446d-via-de-cambio-autorizado.test.mjs` prueba el mecanismo con un par SEMBRADO por el
propio test (no con el cambio real, que dejará de serlo al entrar en `main`): el par pasa; sin él,
no; un byte de más, otra base, la vuelta atrás o el otro trozo, no. Y que cada entrada real tiene
una firma `SCRUM-N c.M` cuyo registro `docs/master/SCRUM-N.md` nombra ese comentario y lleva la cita
literal.

⚠️ Lo que no comprueba: que el comentario de Jira exista y diga lo que la cita dice. La tanda no lee
Jira; eso lo mira quien revisa el PR.

### 2 · El rojo primero, y la mutación

| árbol | `SCRUM-603b · … byte a byte con la BASE` | `SCRUM-723 · … el ÁMBITO ENTERO …` | total |
|---|---|---|---|
| tal cual (`37311b67`) | pasa | pasa | 17 de 17 |
| con el parche, sin la vía | **cae** | **cae** | 15 + 2 = 17 |
| con el parche y la vía | pasa | pasa | 20 de 20, con `scrum1446d` (§6) |

### 3 · El control que manda: 10 % y 21 %, idénticos por bytes

Con el instrumento de SCRUM-1446b (`volcar.mjs` + `comparar.mjs`), este árbol sin el parche contra
el mismo con él: `salida-comparar.txt`.

| | casos | distintos |
|---|---|---|
| sin 7,5 % (0, 2, 4, 5, 10 y 21 %) | 22.184 | **0** |
| con 7,5 % | 5.137 | 33, los 33 PDF de factura con alguna línea al 7,5 %, y sólo ellos |
| control: antes contra antes | 27.321 | 0, y el comparador se declara CIEGO (salida 2) |

Dentro de esos 33 (`salida-que-cambia.txt`, con `que-cambia.mjs` de 1446c): 69 hojas, 0 casos con
otra estructura, y lo que cambia es «8» → «7,5» dentro del rótulo del tipo. Sale idéntica, línea a
línea salvo la cabecera, a `evidencias/SCRUM-1446c/salida-que-cambia.txt` del 8-oct.

### 4 · Lo que no cambia

- **Las facturas ya emitidas no se tocan (regla 29).** Las que salieron con «8%» se quedan como
  están: lo que cambia es lo que se imprime de aquí en adelante.
- Nada del sellado, la huella, la cadena ni el XML: el diff de `src/` son las 3 líneas del PDF.
- Ningún texto nuevo: «8%» → «7,5%» es la cifra (c.18865).
- Lo que exigen `scrum603b` y `scrum723`, su ámbito y sus mensajes: sin tocar.
- Los ficheros de carril ajeno de SCRUM-1446b (`quoteDescuentos.js`, `presentacionIva.ts`,
  `quoteDecisionLanding.routes.ts`): sin tocar.

### 5 · Las mutaciones, cada una sobre el commit y revertida con `git restore`

Población: `scrum603b` + `scrum723` + `scrum1446d` (20 casos), y para M4 `scrum1446` + `scrum603b` + `scrum723` (26).

| mutación | cae | total |
|---|---|---|
| M1 · `CAMBIOS_AUTORIZADOS` vacía | `603b · byte a byte`, `723 · ÁMBITO ENTERO`, `1446d · ③` | 17 + 3 = 20 |
| M2 · el parche MÁS un espacio dentro de `generateInvoicePdf` | `603b · byte a byte`, `723 · ÁMBITO ENTERO` | 18 + 2 = 20 |
| M3 · `cambioAutorizado` deja de mirar la huella de la base | `1446d · ②` | 19 + 1 = 20 |
| M4 · `src/` sin el parche (con `dist/` reconstruido) | `1447 · ② ARREGLADO` y sólo él; 603b y 723 pasan, igual que en la base | 25 + 1 = 26 |

### 6 · Los tests

- Con el parche y la vía: `scrum603b`, `scrum723` y `scrum1446d`, 20 de 20.
- Guards de suite y de registro (237, 976, 824, 836, 267, 273, 1294, 921c, 622, 1446, 1572, 811c,
  1325b, 710b, 812, 850, 603b, 723, 1446d): 19 ficheros, **190 de 190**, 0 saltados. En la primera
  pasada cayeron dos, los dos por mí: `scrum921c` (mi comentario citaba una ruta de plantilla como
  si fuera un fichero) y `SCRUM-1447 · ② DECLARADO`, que es el caso que fijaba el «8%» y pide, en su
  propio mensaje, pasar a ARREGLADO en el mismo commit. Hecho: `DECLARADOS` 3 → 2.
- De paso en ese mismo caso: su lector del pie buscaba `IVA (\d+%)`, así que con «IVA 7,5%:» el pie
  salía VACÍO en vez de caer. Ahora `[\d,]+%`, el mismo patrón que ya usaba para la fila.
- La dirigida de `tests:que-cubren` (409 de 1463 ficheros, base `37311b67`): 3.890 casos, 3.879
  pasan, 4 caen, 7 saltan. Los 4 (`SCRUM-1298b` ×2, `SCRUM-351`, `SCRUM-476`) caen IGUAL, por
  nombre, en un árbol de la base sin mis cambios (29 + 4 de 34, 1 saltado): son del árbol anidado
  sin `node_modules` propio, no de esta rama. Ninguno de los tres ficheros lo toca mi diff.

### 7 · Lo que no he hecho

- La tanda completa ni `tsc --noEmit` (árbol anidado; `dist/` con `tsc --noCheck`). Ningún
  `prisma generate`.
- Generar un PDF y mirarlo a ojo: lo medido es el texto que saca el lector de la casa.
- Comprobar en Jira lo que no comprueba la tanda: que c.20473 diga lo que la cita dice. Lo leí yo,
  byte a byte, el 23-oct; el test sólo comprueba que la cita está aquí.
- Contar facturas reales al 7,5 % (no consulto ninguna base). Las ya emitidas siguen con «8%».
- Los rótulos de pantalla y los dos sitios de carril ajeno que listó SCRUM-1446b: sin tocar.

### 8 · Errores míos

- Creé la rama como `scrum-1446c-…` sin hacer antes el control del sufijo de A4: el `c` lo había
  gastado #2300. Lo vi al ir a escribir este tramo, antes de empujar nada, y pasé a `1446d`.
- Mi comentario de `tests/_cambios-autorizados-de-la-factura.mjs` citaba una ruta con `N` de
  plantilla y `scrum921c` la contó como procedencia fantasma. Cazado en local.
- Crucé los 200k de contexto sin avisar en el momento: lo medí después de la dirigida (239k) y
  avisé entonces.

## SCRUM-1446e · ① LA MEDICIÓN de jv-j1ch (SCRUM-1446 c.20915): qué quedaba de ① en `main`, y las preguntas al fundador

**Medido contra:** `origin/main` = `d2e468960494f9f35b22f9ff3c2dca4e3f48548a` · 2026-10-26T16:22:24Z (hora de GitHub)

A9: sin fallo que generalice — es una medición transcrita al registro desde su comentario de Jira; quien la hizo no lo dejó escrito aquí por contexto (197k), y eso ya lo recoge A19

Escrito por `jv-j1ck` (J1) a partir de **SCRUM-1446 c.20915**, que es de `jv-j1ch` (J1): ella midió y no dejó tramo. Lo que va aquí es lo que ese comentario dice; no lo he vuelto a medir salvo donde lo digo.

- **Cómo:** `dist/` de `main` con `tsc --noCheck`, `generateInvoicePdf` real, facturas en memoria (ninguna base), total guardado con `grossOfLines`, papel leído con `lineasDePdf`. 8 PDF. Control: 1 × 100 al 21 % cuadra.
- **Lo que quedaba de ①: sólo la columna.** Desde SCRUM-624e (#2863) el pie y el TOTAL de la F1 salen del registro: Base + IVA = TOTAL = guardado. La columna «TOTAL» de cada línea imprimía `cant × precio × (1 + tipo)` redondeado por línea: 2 × 12,50 al 21 % → 15,13 + 15,13 = 30,26 con TOTAL 30,25; 2 × 7,25 → 17,54 con 17,55.
- **El motivo del test estaba desfasado:** `tests/scrum1446-los-tres-importes-del-pdf.test.mjs:47` decía «el TOTAL sale de la suma sin redondear». Desde 624e el TOTAL de la F1 es el guardado; lo que no sumaba era la columna con IVA. En SCRUM-1446e② la entrada sale de `DECLARADOS` y su comentario lo dice.
- **Las preguntas:** P1 columna sin IVA (recomendada) · P2 TOTAL = suma de líneas (no recomendada: deshace 624e) · P3 dejarlo y declararlo convención · P4 el presupuesto igual · P5 aceptar que el papel regenerado de lo emitido cambie · P6-P8 de SCRUM-1448.
- **Decisión del fundador: SCRUM-1446 c.20917.** P1 ✅ con GO de la regla 40 para `pdf.service.ts` y la cabecera «IMPORTE» · P2 ❌ · P4 ✅ · P5 ✅ mientras no haya facturas reales · P6/P7: la R1 como está, del justificante primero se mide quién lo crea · P8 ❌.

## SCRUM-1446e · ② EL ARREGLO: en la F1 la columna va SIN IVA y se llama «IMPORTE»; el presupuesto, sin IVA; la R1 y el justificante, como hoy

**Medido contra:** `origin/main` = `d2e468960494f9f35b22f9ff3c2dca4e3f48548a` · 2026-10-26T16:35:31Z (hora de GitHub)

A9: comprobación → `tests/scrum1446e-la-columna-sin-iva.test.mjs`

Carril J1 (`src/modules/invoicing/**`, `docs/equipo/dos-equipos.md:117`). GO de la regla 40: SCRUM-1446 c.20917 (P1, P4). Lo que el fundador firmó en ese comentario, con sus palabras: la columna de cada línea sin IVA, las líneas suman la base del pie, y el literal de la cabecera «IMPORTE».

### 1 · Lo que cambia (`src/modules/invoicing/infra/pdf/pdf.service.ts`, nada más en `src/`)

- `generateInvoicePdf`: `columnaSinIva = (type ?? 'F1') === 'F1'`. En la F1 la línea imprime `cant × precio` y la cabecera «IMPORTE». En la R1 y el justificante, `cant × precio × (1 + tipo)` y «TOTAL», como hasta hoy (lo fija el caso ③ del test nuevo).
- `generateQuotePdf`, la tabla de líneas: `cant × precio` en los dos modos de IVA (antes sólo en `no_incluido`). **Su cabecera sigue diciendo «Total»**: el literal firmado es el de la factura, y otra palabra aquí sería texto nuevo (regla 39).
- ⛔ Ni un importe guardado, ni el XML, ni el sellado, ni el pie, ni el TOTAL (sigue siendo el guardado en la F1: P2 ❌). Las facturas emitidas no se tocan (regla 29); su papel, al regenerarse, sale con la columna nueva: es P5, aceptado mientras no haya facturas reales.
- **No tocado, y queda para quien decida:** las opciones del presupuesto (`tiers`, `pdf.service.ts`, la caja de cada opción) siguen enseñando cada línea CON IVA: no son la columna de la tabla y su caja no tiene base al lado. Y `src/modules/quotes/domain/presupuestoParaPdf.ts` (S1) no hacía falta: el pie no cambia.

### 2 · El rojo, primero, con el PDF real en memoria

Test nuevo `tests/scrum1446e-la-columna-sin-iva.test.mjs`, 7 casos. Con el `dist/` de la base (sin el cambio): **6 caen** (la columna imprime 15,13 + 15,13 y 121,00; la cabecera dice «TOTAL»; el tramo sin fijar) **y 1 pasa: ③, la R1 y el justificante**, que fija lo de hoy. Con el cambio: **7 de 7**.

| caso | qué fija |
|---|---|
| ① 2 × 12,50 al 21 % | 12,50 + 12,50 = Base 25,00, TOTAL 30,25 = guardado |
| ① control 1 × 100 | 100,00 · base 100,00 · TOTAL 121,00 |
| ① la cabecera | «IMPORTE», byte a byte (`49 4d 50 4f 52 54 45`) |
| ② 60 F1 de dos líneas, 21 % y 10 % | la columna suma la base en las 60; control: con IVA, no sumaría en alguna (si no, CIEGO) |
| ③ R1 y JUST | «TOTAL», 15,13 + 15,13, como hoy |
| ④ presupuesto 2 × 12,50 | 12,50 + 12,50 = Base 25,00, Total 30,25; cabecera «Total» |
| ⑤ DECLARADO: un tramo | ver §3 |

### 3 · Lo que la decisión NO cierra: los tramos

c.20915 lo dejó sin medir: en una factura por tramos las líneas guardadas llevan fracciones de céntimo. **Medido:** un tramo al 50 % de 2,11 + 3,33 al 21 % guarda 1,055 y 1,665; la columna imprime **1,06 + 1,67 = 2,73** y la base es **2,72**. Lo fija el caso ⑤ como DECLARADO.

Frecuencia, con una copia de la aritmética (`formatImporteEs(cant × precio)` por línea contra `calcVatBreakdown(...).base`) **calibrada contra ese PDF** (da 1,06 · 1,67 · 2,72): sobre pares de líneas al 21 % (precios de 1,01 a 11,00 y de 0,99 a 6,00 en pasos fijos), la columna no suma la base en **4.056 de 11.154 tramos (36,4 %) al 50/50**, **3.236 de 11.154 (29,0 %) al 30/70** y **4.814 de 16.731 (28,8 %) al 30/40/30**. El desvío máximo no lo he medido. **Control a cero:** las mismas 5.577 facturas sin tramos (143 × 39 pares), 0 en cada plan. Población inventada; no hay facturas reales con las que medir. Arreglarlo pide elegir cómo se reparte el redondeo entre líneas, que es otra convención: pregunta para el fundador, no construida.

### 4 · La vía de cambio autorizado y el ancla del literal

- `tests/_cambios-autorizados-de-la-factura.mjs`: un par más, firmado `SCRUM-1446 c.20917`, cita «IMPORTE», generado EJECUTANDO `docs/master/evidencias/SCRUM-1446d/huellas.mjs` (base `d2e46896`). Las dos huellas de partida son las de llegada de 624e: la cadena casa. Sin el par, caen `603b · byte a byte` y `723 · ÁMBITO ENTERO`, y sólo ellos (18 de 20); con él, 20 de 20.
- El literal lleva su marca en el comentario de `pdf.service.ts` («literal firmado por el fundador en SCRUM-1446 comentario 20917») y el par (1446, 20917) entra en `tests/_pares-leidos-en-jira.mjs`: lo leí yo hoy, con el ticket entero.
- `tests/scrum1446-los-tres-importes-del-pdf.test.mjs`: ① pasa de DECLARADO a ARREGLADO con los importes nuevos, en los dos papeles. `DECLARADOS` **1 → 0**.

### 5 · Mutaciones, con la casa

Declaradas en `MUTACIONES_QUE_ME_TUMBAN` del test nuevo y corridas con `docs/master/evidencias/SCRUM-1123f/arnes-mutaciones.mjs` (`aplicarUna`): **4 de 4 vivas** — la cabecera vuelve a «TOTAL» · la columna de la F1 vuelve a llevar IVA · la R1 también sin IVA · el presupuesto con IVA. Cada una tumba el caso que nombra. `pdf.service.ts` idéntico por `cmp` después. La primera pasada leyó **0 mutaciones** porque yo había puesto el fichero en una constante y el lector exige literales: un cero que habría parecido limpio.

### 6 · Los tests, y dos que movió mi cambio

- Dirigida: mi lista (familia 1446/624, 603/603b/723, 247, 844c, 921c, 387, 601, 1502h, 377, `pdfs`, y los de suite y registro 237, 976, 824, 836, 419, 702, 700, 719, 1415, 267, 273, 1294, 622, 710b) unida a los 54 que NOMBRAN `pdf.service.ts` según `tests:que-cubren`: **80 ficheros · 794 casos · 787 pasan · 0 caen · 7 saltan** (los 7, gateados por base: `A12.5d`, `SCRUM-593d` y similares). Los 390 que selecciona `tests:que-cubren` entero y la tanda completa: **NO CORRIDOS** (hoy hay diez sesiones; el juez es el obligatorio).
- En la primera pasada cayeron dos, los dos por mí:
  - `SCRUM-1446 · SUELO`: fijaba 121,00 + 121,00 en la columna de la F1. Ahora fija 100,00 + 100,00 = base 200,00, con TOTAL 242,00 = guardado. Mismo caso, mismo lector.
  - **De paso:** `SCRUM-836` cazó que la mutación M2 de `tests/scrum1302m-el-total-y-la-leyenda.test.mjs` anclaba a `(1 + (ivaFueraDelPapel ? 0 : l.tax))`, que mi cambio quita. Reanclada a la línea de hoy (`const lineTotal = l.qty * l.price;` → con IVA), que apaga lo mismo: con el arnés, **5 de 5 vivas** en 1302m.
- `tsc --noCheck` para `dist/` (este árbol no trae `node_modules`: lo enlacé al del checkout compartido con un junction, sin ningún `prisma generate`; `_prisma-client-guard` en ✔).

### 7 · Errores míos

- Crucé los 200k de contexto sin avisar en el momento: medí al acabar el arranque (≈92k) y al acabar Jira (≈156k), y no volví a mirar hasta acabar el rojo (229k). Es la cicatriz de J1 del 24-oct, otra vez.
- Declaré las mutaciones con una constante y el arnés leyó 0; lo cacé porque el arnés dice cuántas leyó.

## SCRUM-1446f · «IMPORTE» también en la cabecera del PDF del PRESUPUESTO

**Medido contra:** `origin/main` = `268eb55ddf33547063a620009e505e4ed833ba35` · 2026-10-26T22:25:01Z (hora de GitHub)

A9: comprobación → `tests/scrum1446e-la-columna-sin-iva.test.mjs`

Carril J1 (`src/modules/invoicing/**`, `docs/equipo/dos-equipos.md:117`). Decisión del fundador en SCRUM-1446 c.20939 (punto 1): «IMPORTE» también en la cabecera del PDF del presupuesto, el mismo literal firmado para la factura en c.20917. La rama sale de la de 1446e (`scrum-1446e-columna-sin-iva`, punta `f72be6ca15b9d2c39d318d86477f2c06c90ebbd6`), porque #2895 no había entrado en `main` al empezar; esa punta ya contenía `origin/main` `268eb55d` (`git rev-list --count HEAD..origin/main` = 0).

### 1 · Lo que cambia

- `src/modules/invoicing/infra/pdf/pdf.service.ts`, `generateQuotePdf` → `drawTableHeader`: la cabecera de la columna de cada línea pasa de «Total» a «IMPORTE». La marca va en el comentario de esa línea («literal firmado por el fundador en SCRUM-1446 comentario 20939»). Nada más en `src/`.
- ⛔ **Ningún otro texto.** **Las cajas de opciones del presupuesto (`tiers`) NO se tocan:** siguen enseñando cada línea con IVA (lo dejó dicho 1446e en su §1). Tampoco cambian el «Total presupuesto», la base, ningún importe, ni nada de la factura, la R1 o el justificante.
- `tests/scrum1446e-la-columna-sin-iva.test.mjs`: el caso ④ espera «IMPORTE» en vez de «Total», y su cabecera de comentario cita c.20939. Una mutación declarada más (`.text('IMPORTE', X_TOTAL, …` → `'Total'`), que cae en ④.
- `tests/_pares-leidos-en-jira.mjs`: el par (1446, 20939), la 28.ª fila. **Cruce de carril, declarado:** ese fichero es de J6 (`dos-equipos.md:194`), y su propio procedimiento pide la fila «en el mismo PR que la marca que lo cita». Lo leí yo hoy, con el ticket entero (20 comentarios).

### 2 · El rojo primero, con el PDF real en memoria

`generateQuotePdf` real, leído con el lector de la casa (`_texto-del-pdf.mjs`), sobre `dist/` sacado con `tsc --noCheck`:

| árbol | ④ | el resto del fichero |
|---|---|---|
| base (con el test nuevo y sin el cambio) | ✖ `cabecera: 'Total'` frente a `'IMPORTE'`; líneas, base y total, iguales | 6 ✔ |
| con el cambio | ✔ | 6 ✔ (7 de 7) |
| mutación en `dist/` (`'IMPORTE'` → `'Total'`), restaurado y comprobado con `cmp` | ✖ y sólo ④ | 6 ✔ |

El lector de declaraciones del meta-guard (`mutacionesDeclaradas`) lee 5 en el fichero (eran 4).

### 3 · Dirigida

36 ficheros: la familia 1446 (1446, 1446d, 1446e), 624 (624, 624b, 624c, 624e), los del PDF (pdfs, 452, 603, 603b, 604, 625, 659, 72, 762, 786d, 806, 987, 1302m), 247, 844c, 723, 921c, 387 (los dos), 601, 710b, 836, 178, 207, 237, 976, 267, 273 y 1294. **281 casos · 275 pasan · 0 caen · 6 saltan** (gateados por `QA_DB_TEST`/`LIBRO_PG_URL`: 72, 178 ×2, 207 ×2 y un caso de `pdfs`). En el TAP, 281 líneas `ok` y 0 `not ok`. 603b y 723 no se mueven: `generateQuotePdf` no está en el ámbito de la factura.
**La tanda completa en local: NO CORRIDA** (orden del orquestador: hoy hay diez sesiones a la vez). No hay tests de 1447 ni de 1448 con su número en el nombre del fichero; sus casos viven en `scrum1446-…`.

### 4 · Lo que no he hecho

- Mirar el PDF a ojo: lo medido es el texto que saca el lector.
- yaqu.app: **NO VISTO**, no ha entrado en `main`.
- `prisma generate`: no. `node_modules` es un junction al del checkout compartido, sólo para leer; el guard del cliente dio ✔.
- La parte 2 del encargo (convenciones de reparto del redondeo en los tramos) va sólo en Jira, como propuesta ✅/❌, por orden del orquestador.

## SCRUM-1446g · en una F1 por TRAMOS, el céntimo que falta va a la línea de MAYOR RESTO

**Medido contra:** `origin/main` = `6d5bf76c5bf02142e762ca2ddd3d2ae2b92f9a3e` · 2026-10-26T22:44:37Z (hora de GitHub)

A9: comprobación → `tests/scrum1446e-la-columna-sin-iva.test.mjs`

Carril J1 (`src/modules/invoicing/**`, `docs/equipo/dos-equipos.md:117`). Decisión del fundador en SCRUM-1446 c.20945, sobre las opciones medidas por jv-j1co en c.20944: «B, mayor resto», con GO de la regla 40 para `pdf.service.ts` («Solo cambia lo impreso: ni importes guardados, ni XML, ni lo emitido»). Aceptado en ese comentario: la línea que recibe el céntimo deja de coincidir exacta con cantidad × precio impreso. La rama sale de la de 1446f (`scrum-1446f-importe-en-presupuesto`, punta `8462de58ed7684d5ec9c9f036517348f29faf061`, PR #2898), que no había entrado en `main` al empezar; va 3 commits por detrás de `origin/main` y no lo mezclo: lo hace el orquestador con la punta de 1446f que arregla `scrum647`.

### 1 · Lo que cambia

- `src/modules/invoicing/infra/pdf/pdf.service.ts`: una función nueva del módulo, `importesDeLaColumnaSinIva`, y su llamada en `generateInvoicePdf` sólo para la F1. Dentro de cada grupo del desglose (tipo y causa, los mismos de `calcVatBreakdown`), todas las líneas bajan al céntimo y los céntimos que faltan para la base del grupo van a las de mayor fracción.
  - **Desempate** (c.20944 no lo fija): el primero en orden de línea.
  - **Un grupo que ya suma como se imprimía no se toca:** es el desempate «que respete el redondeo de hoy» de c.20944. Sin esa regla se moverían tramos que hoy cuadran (caso ⑥, encontrado barriendo: 30 % de 1,65 + 3,45 al 21 %, que guarda 0,495 y 1,035).
  - **«De tramo» = algún precio con fracción de céntimo**, que es lo único que el papel sabe de un tramo (`stageLabel` es `null` en los planes predefinidos). Sin tramos, la función devuelve `null` y la columna sale como hasta hoy. ⚠️ Una F1 SIN tramos con un precio de tres decimales también entraría por aquí: no lo he medido y no sé si el editor lo permite.
- ⛔ **Ningún texto nuevo. Ningún importe guardado, ni la base, la cuota o el TOTAL impresos, ni el XML, ni lo emitido** (regla 29): sólo el número de la columna de las líneas de un tramo. La R1, el justificante y el presupuesto (sus cajas de opciones incluidas) no pasan por aquí.
- `tests/scrum1446e-la-columna-sin-iva.test.mjs`: ⑤ pasa de DECLARADO a ARREGLADO (1,06 + 1,66 = Base 2,72; antes 1,06 + 1,67 = 2,73), y entran ⑥ (un tramo que ya suma no cambia) y ⑦ (70 tramos con su PDF real: la columna suma la base, ninguna línea se aleja un céntimo de su importe exacto, y el céntimo va a la de mayor resto).
- `tests/_cambios-autorizados-de-la-factura.mjs`: el par de huellas firmado `SCRUM-1446 c.20945`, generado ejecutando `docs/master/evidencias/SCRUM-1446d/huellas.mjs` (salida en `evidencias/SCRUM-1446g/salida-huellas.txt`).
- `tests/scrum723-guard-contra-su-base.test.mjs`: `importesDeLaColumnaSinIva` entra en `AMBITO_DECLARADO`, con su motivo, como pide el propio guard («Se declara aquí, con motivo»). Decide qué imprime la F1: tiene que quedar DENTRO de lo que vigilan 603b y 723. No se relaja nada: el contenido lo sigue sujetando el par de huellas.
- **`scrum624` me cayó dos veces, y lo arreglé en el código** (regla 41): mi primera versión metía en `pdf.service.ts` una tercera forma de redondear (`Math.round(x * 100)`), y la segunda llevaba el texto `* 100` dentro del `Math.round` que cuantiza los restos. Ahora los céntimos se leen de la cifra IMPRESA (`fmtImporte` sin separadores) y los restos se cuantizan sobre los exactos ya pasados a céntimos. El tope del guard (13) no se ha tocado.

### 2 · La medición: misma forma de población que jv-j1co, antes y después

Sonda en el repo: `docs/master/evidencias/SCRUM-1446g/medir-tramos.mjs`. Calibra contra **80 PDF reales** (`generateInvoicePdf` + `_texto-del-pdf.mjs`) y sale CIEGA si alguno difiere. Población: 56.000 tramos de 24.000 facturas (precios de 1,00 a 500,00, cantidad 1, un tipo, 2 y 3 líneas, 21 % y 10 %, planes 50/50, 30/70 y 30/40/30). Es la forma de la de c.20944, no la misma población: su sonda no está en el repo.

| plan | tramos | hoy no suma la base | con 1446g no suma |
|---|---|---|---|
| 50/50 | 16.000 | 7.657 (47,9 %) | **0** |
| 30/70 | 16.000 | 5.209 (32,6 %) | **0** |
| 30/40/30 | 24.000 | 7.752 (32,3 %) | **0** |

- Tramos que hoy suman y 1446g mueve: **0**. Desvío máximo de una línea frente a su importe exacto: **0,8 céntimos** (el mismo que dio c.20944 para B).
- Control a cero: las 24.000 facturas SIN tramos — no suman 0, cambia alguna línea en **0**.
- Control positivo: el tramo de ⑤ hoy suma 273 sobre base 272.
- Calibración: 80 de 80 iguales, antes y después. Salidas en `evidencias/SCRUM-1446g/salida-antes.txt` y `salida-despues.txt`.

### 3 · El rojo, primero

Con el `pdf.service.ts` de la base compilado sólo en `dist/` (`src/` sin tocar; `dist/` restaurado después): caen ⑤ y ⑦, y sólo ellos; ①-④ y ⑥ pasan, que es el control (⑥ fija el comportamiento de hoy). Con el cambio, 9 de 9.

### 4 · Mutaciones, con la casa

`docs/master/evidencias/SCRUM-1123f/arnes-mutaciones.mjs` (`aplicarUna`): **9 de 9 vivas**, las 5 de antes y 4 nuevas — el céntimo a la ÚLTIMA línea (la opción A, rechazada) cae en ⑦ · el desempate al revés cae en ⑤ · sin detectar el tramo cae en ⑤ · sin respetar el tramo que ya suma cae en ⑥. `pdf.service.ts` idéntico por `cmp` después. Salida en `evidencias/SCRUM-1446g/salida-mutaciones.txt`.

### 5 · Dirigida

Ver el comentario de entrega en Jira: 120 ficheros (la familia 1446/624, los que leen `pdf.service.ts` o la vía de cambio autorizado, 247, 844c, 921c, 387, 601, 603b, 723, 622, 636, 647, 745, 836, 1387 y los de suite y de registro). **La tanda completa en local: NO CORRIDA** (orden del orquestador).

### 6 · Lo que no he hecho

- Tramos con cantidad distinta de 1, o con dos tipos en la misma factura: el código reparte dentro de cada grupo, pero la población medida es de un tipo y cantidad 1.
- El PDF a ojo: lo medido es el texto que saca el lector. yaqu.app: **NO VISTO**, no ha entrado en `main`.
- `prisma generate`: no. `node_modules` es un junction al del checkout compartido, sólo para leer; el guard del cliente dio ✔.

### 7 · Errores míos

- Escribí que ⑦ medía 90 tramos y eran 70 (10 × 2 + 10 × 2 + 10 × 3): lo cazó la cuenta del propio test (`medidos`), que se declara antes de afirmar nada.
- Lancé el arnés de mutaciones con la ruta `tests/…` y espera el nombre relativo a `tests/`: salió con ENOENT, sin mutar nada, y lo leí antes de dar ningún número.
