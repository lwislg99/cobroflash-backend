# SCRUM-1211 · La opción A de SCRUM-1203 (serie F nueva desde `F260001`), contra fuente primaria

**Medido contra:** `origin/main` = `29b492b0c2f246941e5c514d682887c18fd19494` · 2026-09-28T14:20:46Z

Sesión J5 (`jv-j5`), 28-sep-2026, por encargo del orquestador de Javier. Javier eligió la **opción A**
de SCRUM-1203 y pidió comprobar que es lo más adecuado. **Este documento sólo lee y cita.** No toca
`src/` ni el camino de emisión, y no redacta texto de pantalla. El encargo era **buscarle el fallo a la
A**, no elegir por Javier.

La opción A: las facturas de YaQu abren una serie propia que empieza en `F260001`, aunque el
profesional ya hubiera emitido facturas ese año con otro programa, en Excel o en papel. El formato se
ve en `src/core/documentos/formatoNumero.ts:9`: «Factura F → F260001».

## ⓪ Las fuentes

Todas se bajaron con `curl` el 28-sep-2026 entre las 13:38Z y las 14:20Z y se leyeron en su texto.
**Ninguna con WebFetch.** Las citas son copia literal.

| # | fuente | URL | consolidación / versión | sha256 |
|---|---|---|---|---|
| R1 | **RD 1619/2012**, Reglamento de facturación (ROF), texto consolidado | `https://www.boe.es/buscar/act.php?id=BOE-A-2012-14696` | «Última actualización publicada el 31/03/2026»; el art. 6.1.a está en la redacción del RD 1073/2014 | `2070c7479d98718bf7d938806eece23f6f8bf41d1235c3d600ecbc488251e6c2` |
| R2 | **RD 1007/2023**, RRSIF, texto consolidado | `https://www.boe.es/buscar/act.php?id=BOE-A-2023-24840` | «Última actualización publicada el 03/12/2025» | `510a3731093e6e57f46589897139b5962e048bdf47a9a2a60469419383223b7a` |
| A1 | AEAT, **Validaciones**, `Validaciones_Errores_Veri-Factu.pdf` | `https://www.agenciatributaria.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/Validaciones_Errores_Veri-Factu.pdf` | v1.2.2, 08/04/2026 | `426eb926fc098a36a163f66ca5f40d9e0847ca23300bbe5008979832d3513440` |
| A2 | AEAT, **lista de errores** en producción, `errores.properties` | `https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tikeV1.0/cont/ws/errores.properties` | sin versión; bajada 28-sep-2026 14:20Z | `06519ceb23422bd6b0ad3bfb659e3007615050da4920781d12cff536481d5902` |
| A3 | AEAT, **Aclaraciones a dudas de los desarrolladores**, `FAQs-Desarrolladores.pdf` | `https://www.agenciatributaria.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/FAQs-Desarrolladores.pdf` | v1.3 (pie: 4 de diciembre de 2025) | `73906dc8afbbb9da35f6cb489980352b42aed66d48828fd62a00168883c09d5e` |
| A4 | AEAT, sede, **FAQ «Características y requisitos de los SIF»** | `https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/preguntas-frecuentes/caracteristicas-requisitos-sif-capacidad-remision-etc_.html` | página viva; el HTML no trae fecha (el mismo sha en dos bajadas seguidas) | `e1009e226ebc1d000a3d9782810f339c87a58c2f1a9c7ce8ee4a10ff826968db` |

Lo que **no** se consultó: la doctrina de la DGT (consultas vinculantes). Su buscador no es un
documento que se pueda bajar con `curl`. Lo que sale «sin determinar» abajo podría tener respuesta ahí.

## ④ ¿Se rompe algo de VERI*FACTU si el primer registro en YaQu no es la primera factura del año?

**Respuesta: no por ser el primero. Sí si el número coincide con uno que el obligado ya emitió.**

**(a) «Primer registro» es por sistema informático y NIF, no por año ni por serie.**
- R2, art. 10.1.ñ (contenido del registro de alta), literal: *«Cuando no se trate del primer registro
  de facturación generado por el sistema informático, el número y, en su caso, la serie, así como la
  fecha de expedición de la factura que consta en el registro de facturación, de alta o de anulación,
  inmediatamente anterior, junto con parte de la huella o «hash» de dicho registro anterior.»*
- A1, §4.3.1 «Tratamiento de los errores en remisión voluntaria VERI*FACTU», literal: *«Si el registro de facturación remitido
  se marca como "PrimerRegistro" a "S" en el bloque de "Encadenamiento" y ya existen registros de
  facturación para dicho SIF y NIF obligado a emisión.»*
- A2, literal: *«2007 = No debe informarse como primer registro, existen facturas emitidas con el
  obligado emisión y el sistema informático actual.»*
- A4 (dos centros con sistemas independientes), literal: *«Estos Registros de Facturación deberán estar
  encadenados (con el hash correspondiente) de forma independiente dentro de cada SIF […] no tienen por
  qué -ni necesitan- saber qué facturas están expidiendo otros SIF de la misma sociedad o empresa».*

**Consecuencia:** el programa anterior del profesional es **otro SIF**. Su primer registro en YaQu es,
de verdad, el primero «para dicho SIF y NIF», y marcarlo `PrimerRegistro = S` es lo correcto. El 2007
que devolvió la AEAT esta tarde sale cuando YaQu ya había mandado registros de ese NIF, y **no mira ni la
serie ni el año**. La A no lo provoca.

**(b) 🔴 El agujero: el identificador de la factura no puede repetirse, y `F260001` es un formato corriente.**
- A3, §6 «Prohibición de numeración duplicada de un registro», literal: *«cada RF básicamente se
  considera que se "identifica" por el mismo identificador de la factura a la que hace referencia
  (Emisor+SerieYNúmeroFactura+FechaExped.).»* Y más abajo: *«ya NO es posible reutilizar la numeración
  de ninguna factura expedida, aunque sean facturas expedidas "de prueba".»*
- A2, literal: *«3000 = Registro de facturación duplicado.»*
- R1, art. 6.1.a: *«La numeración de las facturas dentro de cada serie será correlativa.»* Dos facturas
  con el mismo número en la misma serie no son una serie correlativa.

Si el programa anterior del profesional ya numeraba `F260001`, `F260002`… (es un formato habitual:
letra, año con dos cifras y un contador), la primera factura de YaQu, `F260001`, **repite un número
que ese mismo obligado ya expidió en 2026**.

**Lo que hace la AEAT con eso, según las fuentes:** el identificador incluye la **fecha de expedición**.
Por tanto el 3000 sólo saltaría si las dos `F260001` tienen también la misma fecha, y sólo si el
programa anterior también las envió. En el caso normal, con fechas distintas, **la AEAT acepta las
dos**, y el obligado queda con dos facturas `F260001` en 2026 sin que nada avise. Esto último es una
inferencia a partir de la composición del identificador que da A3, no un caso probado contra la AEAT.

**Qué ve YaQu hoy:** nada. La serie F deriva su secuencia de lo ya emitido *en YaQu* (SCRUM-1203 (b)),
y lo que el profesional declara en el alta no se lee.

## ① ¿Varias series a la vez, y una serie nueva desde el 1?

R1, art. 6.1.a, literal: *«Número y, en su caso, serie. La numeración de las facturas dentro de cada
serie será correlativa. Se podrán expedir facturas mediante series separadas cuando existan razones que
lo justifiquen y, entre otros supuestos, cuando el obligado a su expedición cuente con varios
establecimientos desde los que efectúe sus operaciones y cuando el obligado a su expedición realice
operaciones de distinta naturaleza.»*

- **Varias series a la vez: sí**, verificado. La norma las admite y en algunos casos las obliga
  (rectificativas, art. 6.1.a 2.º; simplificadas junto a completas en el mismo año, art. 7.1:
  *«será obligatoria la expedición mediante series separadas de unas y otras»*).
- **Que una serie nueva empiece en 1:** la norma no fija el número de arranque. Sólo exige que la
  numeración sea correlativa *dentro de cada serie*. Ningún texto leído lo prohíbe.
- **⚠️ SIN DETERMINAR: si «cambiar de programa» es una de las «razones que lo justifiquen».** La lista
  es abierta («entre otros supuestos»), pero el cambio de sistema **no aparece** en ella ni en ningún
  texto leído. Es plausible, pero no se ha encontrado fuente que lo diga. Si hay doctrina de la DGT,
  está donde no se ha mirado (ver ⓪).

## ② ¿Correlatividad dentro de la serie o sobre todo lo que emite el obligado?

**Dentro de cada serie.** Verificado, R1 art. 6.1.a: *«La numeración de las facturas dentro de cada
serie será correlativa.»* Lo mismo en el art. 7.1.a para las simplificadas.

Eso sí, es lo que convierte ④(b) en un problema: **la correlatividad protege la serie**. Si la serie
de YaQu y la del programa anterior se llaman igual, son **la misma serie**, y un `F260001` repetido
la rompe.

## ③ ¿Dice algo la normativa del que cambia de sistema a mitad de año?

**SIN DETERMINAR.** En R1 y R2 (textos consolidados enteros) no hay ningún precepto sobre el cambio de
sistema de facturación ni sobre qué pasa con la numeración al cambiar. Se buscó «cambi», «sustitu»,
«nuevo sistema», «varios sistemas» y «series separadas».

Lo más cercano está en la AEAT, y habla de hash, no de numeración:
- A4 (arriba): cada SIF encadena por su cuenta y no necesita saber lo que emiten los otros.
- A3, §10 «Importación de facturas desde otro sistema», literal: *«la responsabilidad del fabricante
  de un SIF alcanza a los RFs de las facturas emitidas por el SIF que haya certificado, pero no alcanza
  en modo alguno a los RFs correspondientes a facturas emitidas con otro SIF.»*

Ninguna de las dos dice cómo tiene que numerar quien cambia de programa.

## ⑤ Veredicto

**La A tiene un problema, y es éste:** es defendible *si y sólo si* la serie de YaQu no puede coincidir
con una que el profesional ya usó ese año. Tal como está (una `F` seguida del año y del contador, que
empieza en 1), **puede coincidir**. Entonces YaQu expediría un número que ese obligado ya expidió, que
es justo lo que la AEAT dice que *«ya NO es posible»* (A3 §6). Y casi nunca habría un error que lo
avisara (④(b)).

Lo que **sí** aguanta de la A, con fuente:
- Tener una serie propia a la vez que otras: sí (R1 6.1.a).
- Que esa serie empiece en 1: nada lo prohíbe; la correlatividad es por serie (R1 6.1.a).
- Que el primer registro en YaQu no sea la primera factura del año: no rompe VERI*FACTU (R2 10.1.ñ,
  A1, A2 2007, A4). «Primero» es por SIF y NIF.

Lo que falta para que la A aguante, y que **decide Javier, no esta sesión**: garantizar que la serie
de YaQu es **distinta** de la anterior del profesional. Es decisión de producto, y probablemente toca
el camino de emisión (regla 40) o texto de pantalla (regla 39). Por eso aquí no se propone una forma
concreta.

Queda **sin determinar**, sin fuente leída:
1. Si el cambio de programa es una «razón que lo justifique» para abrir serie (①).
2. Si la normativa dice algo del cambio de sistema a mitad de año (③).
3. Qué hace la AEAT con dos `F260001` del mismo NIF con fechas distintas. La inferencia de ④(b) sale
   de A3; no se ha probado.
