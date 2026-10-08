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
