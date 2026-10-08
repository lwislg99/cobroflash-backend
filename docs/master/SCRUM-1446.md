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
