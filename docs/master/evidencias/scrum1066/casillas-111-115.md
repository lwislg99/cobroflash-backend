# Casillas oficiales de los modelos 111 y 115 — leídas de la imagen del BOE

- **Fecha de descarga:** 2026-10-23.
- **Método:** `curl` contra boe.es (HTML consolidado, página de análisis `buscar/doc.php?id=…` y PNG de los anexos) + lectura visual del PNG con la herramienta Read. Ni memoria ni web de la AEAT: cada número y cada concepto de las tablas es lo que imprime la imagen citada.
- **Carpeta de descarga:** temporal de la sesión, fuera del repositorio y no persistida. Cada imagen se vuelve a bajar con su URL.
- **Doble lectura:** la página 1 de cada impreso (`04948_001.png` y `21430_005.png`) la volvió a mirar la sesión que encargó la transcripción (`jv-j1ah`), por separado. Coinciden.

## Modelo 111 — Orden EHA/586/2011, de 9 de marzo (BOE-A-2011-4948)

### ¿Alguna orden posterior sustituyó el anexo?

No, según el BOE:

- El HTML consolidado (`BOE-A-2011-4948.html`), en «Seleccionar redacción», solo ofrece **«Texto inicial publicado el 18/03/2011»**: no hay ninguna versión posterior ni nota «Téngase en cuenta» / «Se sustituye» / «redacción dada por».
- La página de análisis (`https://www.boe.es/buscar/doc.php?id=BOE-A-2011-4948`, descargada con curl, 87.390 B) **no tiene sección «Referencias posteriores»**; solo «Referencias anteriores» (deroga la Orden EHA/30/2007 y otras, y modifica los anexos I y II de las Órdenes EHA/1658/2009 y EHA/2027/2007).

**Imagen usada: la de 2011** (anexo I de la Orden EHA/586/2011), porque el BOE no registra ninguna sustitución de ese anexo.

### Imágenes descargadas y leídas

| Página | URL | Bytes | Contenido |
|---|---|---|---|
| 1 | https://www.boe.es/datos/imagenes/disp/2011/66/04948_001.png | 112.478 | ANEXO I · impreso completo · «Ejemplar para el declarante» |
| 2 | https://www.boe.es/datos/imagenes/disp/2011/66/04948_002.png | 57.066 | «Ejemplar para la Entidad colaboradora – AEAT» (sin bloque de liquidación; solo cabecera, ingreso «casilla 30», negativa, complementaria, firma) |
| 3 | https://www.boe.es/datos/imagenes/disp/2011/66/04948_003.png | 113.808 | «Ejemplar para la Administración» · mismas casillas que la página 1 |
| 4 | https://www.boe.es/datos/imagenes/disp/2011/66/04948_004.png | 42.794 | ANEXO II · sobre de envío (sin casillas numeradas) |

### Tabla (fuente: 04948_001.png, página 1; cotejada con 04948_003.png, página 3 — coinciden)

Cabecera de columnas impresa sobre cada fila: «N.º de perceptores» · «Importe de las percepciones» (o «Valor percepciones en especie») · «Importe de las retenciones» (o «Importe de los ingresos a cuenta»).

| Casilla | Bloque / fila (literal) | Columna (literal) | Fórmula impresa |
|---|---|---|---|
| 01 | I. Rendimientos del trabajo · Rendimientos dinerarios | N.º de perceptores | — |
| 02 | I. Rendimientos del trabajo · Rendimientos dinerarios | Importe de las percepciones | — |
| 03 | I. Rendimientos del trabajo · Rendimientos dinerarios | Importe de las retenciones | — |
| 04 | I. Rendimientos del trabajo · Rendimientos en especie | N.º de perceptores | — |
| 05 | I. Rendimientos del trabajo · Rendimientos en especie | Valor percepciones en especie | — |
| 06 | I. Rendimientos del trabajo · Rendimientos en especie | Importe de los ingresos a cuenta | — |
| 07 | II. Rendimientos de actividades económicas · Rendimientos dinerarios | N.º de perceptores | — |
| 08 | II. Rendimientos de actividades económicas · Rendimientos dinerarios | Importe de las percepciones | — |
| 09 | II. Rendimientos de actividades económicas · Rendimientos dinerarios | Importe de las retenciones | — |
| 10 | II. Rendimientos de actividades económicas · Rendimientos en especie | N.º de perceptores | — |
| 11 | II. Rendimientos de actividades económicas · Rendimientos en especie | Valor percepciones en especie | — |
| 12 | II. Rendimientos de actividades económicas · Rendimientos en especie | Importe de los ingresos a cuenta | — |
| 13 | III. Premios por la participación en juegos, concursos, rifas o combinaciones aleatorias · Premios en metálico | N.º de perceptores | — |
| 14 | III. … · Premios en metálico | Importe de las percepciones | — |
| 15 | III. … · Premios en metálico | Importe de las retenciones | — |
| 16 | III. … · Premios en especie | N.º de perceptores | — |
| 17 | III. … · Premios en especie | Valor percepciones en especie | — |
| 18 | III. … · Premios en especie | Importe de los ingresos a cuenta | — |
| 19 | IV. Ganancias patrimoniales derivadas de los aprovechamientos forestales de los vecinos en montes públicos · Percepciones dinerarias | N.º de perceptores | — |
| 20 | IV. … · Percepciones dinerarias | Importe de las percepciones | — |
| 21 | IV. … · Percepciones dinerarias | Importe de las retenciones | — |
| 22 | IV. … · Percepciones en especie | N.º de perceptores | — |
| 23 | IV. … · Percepciones en especie | Valor percepciones en especie | — |
| 24 | IV. … · Percepciones en especie | Importe de los ingresos a cuenta | — |
| 25 | V. Contraprestaciones por la cesión de derechos de imagen: ingresos a cuenta previstos en el artículo 92.8 de la Ley del Impuesto · Contraprestaciones dinerarias o en especie | N.º de perceptores | — |
| 26 | V. … · Contraprestaciones dinerarias o en especie | Contraprestaciones satisfechas | — |
| 27 | V. … · Contraprestaciones dinerarias o en especie | Importe de los ingresos a cuenta | — |
| 28 | Total liquidación: Suma de retenciones e ingresos a cuenta | — | ( 03 + 06 + 09 + 12 + 15 + 18 + 21 + 24 + 27 ) |
| 29 | A deducir (exclusivamente en caso de autoliquidación complementaria): Resultados a ingresar de anteriores autoliquidaciones por el mismo concepto, ejercicio y período | — | — |
| 30 | Resultado a ingresar | — | ( 28 – 29 ) |

Otras referencias impresas: en el bloque «Ingreso (4)», «Importe del ingreso … (casilla 30)», con un recuadro marcado «I». «Autoliquidación negativa» (5) y «Autoliquidación complementaria» (6) son recuadros de marcar **sin número de casilla**; en (6) va «N° de justificante».

Para un oficio que paga a un profesional: retenciones de actividades económicas = **07 / 08 / 09** (dinerarias).

## Modelo 115 — Orden de 20 de noviembre de 2000 (BOE-A-2000-21430)

### Qué imágenes son del 115

Según el HTML consolidado (`BOE-A-2000-21430.html`):

- **ANEXO I** (modelo 115 en pesetas): `21430_001.png` a `21430_004.png`.
- **ANEXO II** (modelo 115 en euros): `21430_005.png` a `21430_009.png`.
- ANEXO III: texto (datos mínimos del recibo), sin imagen.
- ANEXO IV (modelo 180 en pesetas) desde `21430_010.png`; ANEXO V (180 en euros) y ANEXO VI (diseños de registro) — todo lo demás, del 180.
- La corrección de errores **BOE-A-2000-23107** (BOE núm. 304, 20-dic-2000) dice literalmente: «Al final del anexo IV debe figurar el sobre anual y el sobre anual Programa de Ayuda, ambos en pesetas, correspondientes al modelo 180, que habían sido omitidos». Es del **180, no del 115**; su `23107_001.png` (leído) es el sobre «PROGRAMA DE AYUDA … Modelo 180».

### ¿Alguna orden posterior sustituyó el impreso del 115?

No, según el BOE:

- Redacciones del consolidado: 06/10/2005, 26/09/2014, 19/02/2015, 30/12/2020, 03/12/2021 y 30/11/2023.
- La página de análisis (`https://www.boe.es/buscar/doc.php?id=BOE-A-2000-21430`, 156.027 B), en «Referencias posteriores», solo recoge: modificaciones del **anexo VI** (Órdenes HFP/1284/2023, HFP/1351/2021, HAC/1276/2020), la **sustitución del anexo VI** (Orden HAP/1732/2014) y «SE DEROGA lo indicado y SE MODIFICA lo indicado» por la Orden EHA/3061/2005 (el consolidado marca como derogados párrafos del apartado 1 y el apartado 3.3; ninguno es un anexo).
- La Orden HAP/258/2015 (BOE-A-2015-1656) añade un apartado 4 al articulado (número de justificante, con efectos desde el 1T de 2015); no toca los anexos I ni II.
- Ninguna referencia sustituye el anexo I ni el II.

**Imagen usada: anexo II (115 en euros), `21430_005.png`**, cotejada con el anexo I (`21430_001.png`): las cinco casillas y sus conceptos coinciden; solo cambian la moneda de la cabecera y el «N.º de justificante», que en pesetas viene prerrellenado con «1 1 5».

### Imágenes descargadas y leídas

| Página | URL | Bytes | Contenido |
|---|---|---|---|
| Anexo I, p. 1 | https://www.boe.es/datos/imagenes/disp/2000/285/21430_001.png | 120.679 | 115 en pesetas, «Ejemplar para el declarante» (leída) |
| Anexo II, p. 1 | https://www.boe.es/datos/imagenes/disp/2000/285/21430_005.png | 127.848 | 115 «Declaración-documento de ingreso en euros», «Ejemplar para el declarante» (leída; **fuente de la tabla**) |
| Anexo II, p. 3 | https://www.boe.es/datos/imagenes/disp/2000/285/21430_007.png | 212.595 | «Instrucciones para cumplimentar el modelo» (euros), casillas 1 y 2 (leída) |
| Anexo II, p. 4 | https://www.boe.es/datos/imagenes/disp/2000/285/21430_008.png | 234.291 | Instrucciones (continuación), casillas 3, 4 y 5 (leída) |
| Corrección | https://www.boe.es/datos/imagenes/disp/2000/304/23107_001.png | 188.056 | Sobre «Programa de Ayuda», modelo 180 (leída; no es del 115) |

Descargadas pero **no leídas**: `21430_002.png` (102.475 B), `21430_003.png` (195.450 B), `21430_004.png` (230.026 B), `21430_006.png` (116.453 B), `21430_009.png` (181.277 B).

### Tabla (fuente: 21430_005.png, anexo II, página 1)

Bloque «Liquidación (3)» · encabezado «RETENCIONES E INGRESOS A CUENTA». Las casillas van impresas como **1 a 5** (un solo dígito, sin cero delante).

| Casilla | Concepto literal impreso | Fórmula impresa | Instrucción literal (21430_007/008) |
|---|---|---|---|
| 1 | N.º de perceptores | — | «Deberá consignar el número total de contribuyentes o sujetos pasivos a los que se les haya satisfecho rentas o rendimientos procedentes del arrendamiento o subarrendamiento de inmuebles urbanos sometidos a retención o ingreso a cuenta a que se refiere este modelo, durante el período declarado.» |
| 2 | Base de las retenciones e ingresos a cuenta | — | «Se consignará la suma total de las bases de retención e ingresos a cuenta correspondientes a los perceptores, declarados en la casilla 1 anterior.» |
| 3 | Retenciones e ingresos a cuenta | — | «Se consignará el importe total de las retenciones e ingresos a cuenta que correspondan a las bases de retenciones e ingresos a cuenta declarados en la casilla 2 anterior.» |
| 4 | A deducir (exclusivamente en caso de declaración complementaria): Resultado a ingresar de la anterior o anteriores declaraciones del mismo concepto, ejercicio y período | — | «Exclusivamente en el supuesto de declaración complementaria, se hará constar en esta casilla el resultado a ingresar de la declaración o declaraciones anteriormente presentadas por este mismo concepto y correspondientes al mismo ejercicio y período.» |
| 5 | Resultado a ingresar | ( 3 - 4 ) | «Consigne en esta casilla el resultado de efectuar la operación indicada en el impreso de declaración. En caso de declaración complementaria, dicho resultado habrá de ser siempre una cantidad positiva.» |

Otras referencias impresas: «Declaración complementaria» (4) es un recuadro de marcar con «N.º de justificante», sin número de casilla; en «Ingreso (5)», «Importe:» va con el recuadro «I», que según la instrucción (5) «coincidirá con la cantidad señalada en la casilla 5».

## Lo que no se pudo leer o no se comprobó

- **No hubo nada ilegible** en las páginas leídas: todos los números y conceptos de las dos tablas se leen con claridad.
- **Vigencia frente al impreso que hoy usa la AEAT: NO comprobada.** Que el BOE no registre una sustitución de los anexos solo dice que el último impreso **publicado en el BOE** es este. No se ha cotejado con el formulario electrónico ni con el diseño de registro vigentes (por ejemplo, si hoy existen casillas o bloques añadidos fuera de una orden con imagen). El encargo excluía la web de la AEAT.
- Modelo 111: no se ha leído ninguna orden posterior porque el BOE no lista «Referencias posteriores». No se ha hecho una búsqueda independiente en el BOE de órdenes que aprueben un «nuevo modelo 111» sin citar la de 2011.
- Modelo 115: no se han leído `21430_002/003/004/006/009.png` (ejemplares para la entidad colaboradora o la Administración, sobres y restos de instrucciones, según su posición en los anexos; esa clasificación es una **deducción** por posición, no se ha visto). Tampoco las del 180 (`21430_010` a `_028`) ni `23107_002` a `_004`.
- No se han leído los textos de las órdenes modificadoras del 115 (EHA/3061/2005, HAP/1732/2014, HAC/1276/2020, HFP/1351/2021, HFP/1284/2023); que no toquen los anexos I/II se ha deducido de la ficha de análisis del BOE, no de leer cada orden.
