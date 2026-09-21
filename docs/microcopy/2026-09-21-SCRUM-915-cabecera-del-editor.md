# La cabecera del editor y el menú «⋯» de arriba — SCRUM-915i

**Aprobado por el orquestador por delegación del fundador** el 18-sep-2026 — SCRUM-915 comentario 15868.

Firmados todos los textos de `docs/prototipos/SCRUM-915/textos-propuestos.md` menos UNO
(«Con su descripción, descuento y suplido.», que **no se construye**). Esta ficha registra los que
entran con el corte **915i**, y se crea **en el mismo acto** en que se aplican (regla 30). Cada
corte de SCRUM-915 registra los suyos en su propia ficha, y aquí no se nombra a ninguna: el listado
de este directorio ES el índice.

## Texto aprobado, literal

> Más acciones

> ¿Vaciar este documento?

> Se quitan el cliente, las líneas y los cambios de este documento. Tus plantillas y tus opciones de siempre no se tocan.

> No, seguir

## Dónde se pinta

| texto | dónde | qué sustituye |
|---|---|---|
| «Más acciones» | `aria-label` del «⋯» de la fila del título del editor (presupuesto y documento suelto), y del menú que abre | nada: el menú de arriba no existía |
| «¿Vaciar este documento?» | título de la hoja que abre «Limpiar formulario» | nada: limpiar vaciaba sin preguntar |
| «Se quitan el cliente, las líneas y los cambios de este documento. Tus plantillas y tus opciones de siempre no se tocan.» | cuerpo de esa hoja | nada |
| «No, seguir» | botón de la hoja que cierra sin tocar nada (lleva el foco al abrirse) | nada |

**La frase de la hoja obliga, y por eso limpiar cambió por dentro.** El reset de antes devolvía
cinco campos a mano y se dejaba el IVA del presupuesto, la validez, las formas de pago, los datos
del cliente, «incluir descripción» y el descuento global. Con esa frase delante habría mentido. Al
confirmar se vuelve a pintar la pantalla entera: todo lo del documento se va, y las plantillas (del
servidor) y las opciones de siempre (que se vuelven a leer al pintar) se quedan, que es lo que dice.

## Lo que este corte reutiliza sin firmar nada nuevo

- «Nuevo presupuesto»: el rótulo que la app ya pone a esta ruta (`L.quoteNew` en `app.js`) y al botón
  de la lista que abre esta pantalla. Sustituye a «Crear presupuesto» en el título del editor.
- «Limpiar formulario» y «💾 Guardar como plantilla»: los mismos botones, que cambian de sitio (del
  último paso al menú «⋯» de arriba). «Limpiar formulario» es también el botón que confirma en la hoja,
  como en el prototipo v3.

## Lo que esta ficha NO firma

- «Línea N» (título del menú de cada línea): firmado en 15868 y **sin construir**. El menú es el
  helper compartido `overflowMenu` (`api.js`), que no pinta título; ponérselo cambia un componente de
  todas las pantallas. Sigue pendiente, y no entra de paso.
- «Con su descripción, descuento y suplido.»: el único texto que 15868 dejó SIN firmar.
