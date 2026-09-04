# Los tres atajos de «Válido hasta» del presupuesto

**Aprobado por el ASESOR** el 4-sep-2026, en **SCRUM-605** (DOC-15).
**A la espera de la firma del fundador** — esto no es su firma, y queda dicho aquí para que nadie
lo lea como tal.
**Aplicado en el mismo acto** (regla 30).

## Texto aprobado, literal

Los **rótulos visibles** de los tres botones:

> 7 días

> 14 días

> 30 días

Los **nombres accesibles** (`aria-label`) de esos mismos tres botones:

> Válido hasta dentro de 7 días

> Válido hasta dentro de 14 días

> Válido hasta dentro de 30 días

## Dónde se pinta

`public/dashboard/js/quoteAtajosVencimiento.js` compone los seis desde dos constantes
(`UNIDAD_ROTULO`, `PREFIJO_ACCESIBLE`); el número es **dato del atajo**, no texto, así que añadir
un cuarto atajo no pide copy nuevo.

`public/dashboard/js/quotesView.js` los pinta bajo el campo «Válido hasta» del editor de
presupuestos: tres `button.quote-plantilla-chip` que, al pulsarse, escriben la fecha en el campo.

> ⚠️ **El nombre accesible está construido y NO cableado todavía.** Hoy la vista pone el **mismo**
> texto en el rótulo y en el `aria-label` (una sola llamada a `rotuloDeAtajo`), así que para que
> digan cosas distintas hace falta **una línea** en `quotesView.js` — fichero de otro carril en
> vuelo (SCRUM-594). Queda listo para que sea una línea y no un rediseño.

## Las cajas medidas, que son lo que decidió el texto

Medidas en navegador real con el CSS de verdad (`min-height:44px`, `padding:6px 14px`, `14px/600`):

| | 929 px | 390 px |
|---|---|---|
| ancho útil de la fila | 895 px | **356 px** |
| los tres, con el texto aprobado | — | **217 px** (sobran 139) |
| los tres, **antes**, con el marcador | 236+244+244 | **148 px de alto: TRES FILAS** |

**Retirar el marcador devuelve 104 px de pantalla** en el móvil de un profesional: la fila baja de
148 px a 44. Esto no era «un texto pendiente», era un tercio de la pantalla ocupado por una nota
interna.

## Por qué éstos y no otros

1. **Caben con holgura.** 217 px de 356. No se eligió el que iba justo (`7 días más…`, 306 px) ni
   el que rompía a dos filas (`Válido 7 días…`, 346 px).

2. 🔴 **No es «1 semana / 2 semanas / 1 mes»**, que también cabía (254 px): **«1 mes» describe algo
   que el mecanismo NO calcula.** El motor hace `hoy + 30`, y 30 días no son un mes en enero, ni en
   febrero, ni en ninguno salvo cuatro. Un rótulo que no describe lo que hace el mecanismo es la
   avería que este árbol lleva una semana cazando — y en un botón la ve el profesional.

3. **No es «7 d», «+7 días» ni «7 días más»**: los puntos suspensivos prometen otro paso —un
   diálogo, algo más— y no lo hay: se escribe la fecha y ya. Y abreviar «días» a «d» paga claridad
   por 51 px que sobran.

4. **El nombre accesible dice la acción completa** porque no tiene caja que lo limite. El botón
   puede decir «7 días» apoyándose en el campo que tiene al lado; un lector de pantalla puede no
   dar ese contexto, y «7 días» a secas no dice qué va a pasar.

## Qué cambió

Los seis salían de **una sola constante** con `[PENDIENTE microcopy oficial]` detrás del número.
Ahora son dos constantes —rótulo y prefijo accesible— porque los dos textos aprobados **son
distintos**, cosa que la forma anterior no permitía.

La entrada `'quoteAtajosVencimiento.js': 1` **sale del censo** de SCRUM-402: **borrada**, no puesta
a 0 (SCRUM-424 / SCRUM-405). Comprobado **con el número delante**: el censo pasa de **13 a 12
entradas**, y el fichero queda con **cero** marcas.

## Qué queda sin firmar en esa pantalla

**La firma del fundador sobre estos seis.** El asesor los aprobó y la del fundador está pedida.

Del resto del editor de presupuestos, este ticket no mide nada: su carril era el campo «Válido
hasta» y sus tres atajos.
