# «Ajustes» en el menú de la línea — SCRUM-915h

**Aprobado por el orquestador por delegación del fundador** el 18-sep-2026 — SCRUM-915 comentario 15868.

Firmados todos los textos de `docs/prototipos/SCRUM-915/textos-propuestos.md` menos UNO
(«Con su descripción, descuento y suplido.», que **no se construye**). Esta ficha registra los que
entran con el corte **915h**, y se crea **en el mismo acto** en que se aplican (regla 30). Cada
corte de SCRUM-915 registra los suyos en su propia ficha, y aquí no se nombra a ninguna: el listado
de este directorio ES el índice.

## Texto aprobado, literal

> Ajustes (IVA, descuento, descripción…)

## Dónde se pinta

| texto | dónde | qué sustituye |
|---|---|---|
| «Ajustes (IVA, descuento, descripción…)» | primer ítem del menú ⋯ de cada línea del PRESUPUESTO, delante de Subir, Bajar y Eliminar línea | nada: hasta hoy la hoja de ajustes sólo se abría desde la ficha de la fila, y la ficha ya sólo se ve cuando la línea NO va con lo de siempre |

**No entra en el menú del documento suelto.** Allí la hoja de ajustes tiene un solo campo («IVA %»)
y el literal prometería descuento y descripción, que en ese modo no existen. En el suelto la ficha
de la fila se queda siempre a la vista, como hoy: es el único control del IVA de la línea.

## Lo que este corte reutiliza sin firmar nada nuevo

- «Suma de líneas», «Descuento» y «Descuento global» en el **documento** de la derecha: son los
  rótulos del pie del PDF (`presentacionIva.ts`, SCRUM-594) y de la página de firma (SCRUM-888), sin
  los dos puntos, igual que los pintaba el editor. Cambian de sitio, no de texto.
- «+ Añadir descuento»: el mismo botón, que cambia de sitio (junto a «+ Añadir línea»).

## Lo que esta ficha NO firma

- «Línea N», firmado en el comentario 15868 como título del menú de la línea: **no se construye en
  este corte**. El menú ⋯ es el helper compartido `overflowMenu` (`api.js`), que no pinta título;
  ponérselo es cambiar un componente que usan todas las pantallas. Irá con quien toque ese helper.
- «Este cliente tiene pactado un descuento del N %» y «Aplicar a las líneas»: son del corte 915k
  (los cuatro marcadores), no de éste.
- «Con su descripción, descuento y suplido.» — el único texto que 15868 dejó SIN firmar.
