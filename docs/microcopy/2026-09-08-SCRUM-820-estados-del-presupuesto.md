# SCRUM-820 · los estados del presupuesto, y qué se dice cuando no se reconoce uno

**Aprobados por el FUNDADOR el 8-sep-2026.**

## Los textos, literales

Los seis estados del presupuesto, dichos igual en las cuatro superficies que los pintan:

> Borrador

> Enviado

> Aceptado

> Rechazado

> Caducado

> Pendiente de aprobación

Y el que faltaba, cuando el estado no se reconoce:

> Estado desconocido

## Dónde se pintan

`public/dashboard/js/api.js` → `quoteStatusMeta`, la única copia. De ahí leen las cuatro:

- la **lista** de Presupuestos (`quotesListView.js`) y su **ficha** (`quotesDetailView.js`);
- el feed de **Inicio** (`homeView.js`);
- la tabla de presupuestos de la **ficha del cliente** (`customerDetailView.js`);
- el **previo del documento** que el profesional envía a su cliente (`quotesView.js`, `setResult`).

## Qué había antes, y por qué esto cierra el ticket y no lo deja a medias

**«Pendiente de aprobación» tenía tres redacciones vivas a la vez:**

| forma | dónde vivía | qué pasa ahora |
|---|---|---|
| «Pendiente de aprobación» | filtro de la lista, `quotesView`, `teamView` | **la firmada** |
| «PENDIENTE APROBACIÓN» | píldora de la lista y de la ficha del presupuesto | se alinea |
| «Pend. aprob.» | `customerDetailView.js:224` | se alinea |

El fundador lo decidió con su motivo, literal: *«si no cabe en la columna, se adapta la columna, no
la palabra: dos formas del mismo estado es lo que abrió este ticket y no lo cerramos dejando una»*.

Y la contradicción que lo destapó: **la propia lista filtraba por «Pendiente de aprobación» y su
píldora respondía «PENDIENTE APROBACIÓN»** — la misma pantalla contradiciéndose consigo misma.

**El estado no reconocido** pintaba un «—». Motivo del cambio, del fundador: *«un guion parece un
dato que falta y se traga en silencio; "Estado desconocido" es honesto y, si alguien lo ve alguna
vez, nos lo cuenta. Eso es lo que queremos que pase»*.

## Qué queda sin firmar en esta pantalla

Nada de los estados del presupuesto. El diccionario de **facturas** (`invoiceStatusMeta`) es otro
conjunto y no se toca aquí: sus rótulos son femeninos —«Pagada», «Caducada», «Anulada»— porque el
sustantivo lo es, y ése es justo el motivo por el que un mapa compartido entre los dos documentos
no podía estar bien para ninguno.
