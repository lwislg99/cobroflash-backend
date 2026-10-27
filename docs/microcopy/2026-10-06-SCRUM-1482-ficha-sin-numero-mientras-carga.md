# La ficha del presupuesto: qué se lee arriba mientras carga y si la carga falla

**Aprobado por el orquestador por delegación del fundador** el 6-oct-2026 — SCRUM-1482 comentario 18490.

La delegación de microcopy es la permanente de `docs/equipo/limites-del-fundador.md`. El literal
lo propuso S2 en el comentario 18482 del mismo ticket.

## Textos aprobados, literales

| Momento | Queda |
|---|---|
| mientras carga | Presupuesto |
| si la carga falla | Presupuesto |
| cargada | Presupuesto #4 (igual que antes) |

La palabra **no está escrita**: es `window.appLocale.quote`, la palabra del documento en el país de
la cuenta, sola y sin número. Ningún pronombre ni participio concuerda con ella. El aviso «Error
cargando presupuesto.» que sale debajo cuando la carga falla **no se toca**.

Es una firma **nueva, para el panel del profesional**. Coincide con la decisión de SCRUM-1444
(comentario 18405: sin número calculable se nombra el documento sin número), que se tomó para el
texto del cliente final, pero no se hereda de ella.

## Dónde se pinta

`public/dashboard/js/quotesDetailView.js`, la cabecera (`<h2>`) de la ficha del presupuesto.

Desde el 13-oct-2026 (SCRUM-1482b), también `public/dashboard/js/app.js`, el título de la vista que
escribe el router al abrir la ficha (`case 'quotes-detail'`).

## Qué cambió y por qué

Antes la cabecera decía «Presupuesto #205» mientras cargaba, y se quedaba así si la carga fallaba.
El 205 era el id de la tabla —de toda la plataforma—, no el número del presupuesto, que en esa
cuenta era el 4. Hasta que llega la respuesta el panel no sabe el número, así que no pinta ninguno.

## Lo que esta firma cubre y NO está aplicado

**El título de la vista** (la barra de arriba, `public/dashboard/js/app.js`): la misma tabla lo
cubre y sigue diciendo «Presupuesto #205» mientras carga y si falla. No se ha podido aplicar: un
caso de `tests/scrum832-atras-vuelve-a-la-lista.test.mjs` exige que el router escriba un título que
empiece por «Presupuesto #», y cambiar lo que ese caso exige necesita un permiso que no está dado.
Está escrito en SCRUM-1482.

**13-oct-2026 · aplicado (SCRUM-1482b).** El párrafo de arriba se queda como historia. El título de
la vista ya lo cubre esta misma firma en el código: el router escribe la palabra de
`window.appLocale.quote`, sola, mientras carga y si la carga falla, y la ficha lo corrige a su
número al cargar. No hay texto nuevo ni firma nueva: es la tabla de arriba, en el sitio que faltaba.
El caso de aquel test se cambió por orden del orquestador (SCRUM-1482, comentario 19093): ahora
ejecuta el enganche entre el router y la ficha en vez de comparar dos cadenas. La pestaña del
navegador sale de ese mismo título y deja de llevar el id de la tabla; no lleva el número del
presupuesto ni cargada (antes llevaba el id), y eso no entra en esta firma.

## Lo que no cubre

- La cabecera cuando el id de la ruta no es un número («Presupuesto #-»): se queda como estaba.
- Los «Presupuesto» escritos a mano que no pasan por el locale (cabecera y título una vez cargada
  la ficha): SCRUM-1487.
