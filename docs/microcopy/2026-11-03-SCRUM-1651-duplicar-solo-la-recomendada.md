# Editor de presupuestos · el aviso al duplicar un presupuesto con varias opciones · SCRUM-1651

**Aprobado por el orquestador por delegación del fundador** el 3-nov-2026 — SCRUM-1651 comentario 21372.

El comentario 21372 lo escribe S2 y **transcribe** la decisión: el orquestador del equipo de Luis la dio en
su encargo a S2 del 3-nov-2026 (hacia las 07:33Z), citando la delegación del fundador de ese día. S2 no
la firma: la copia. El texto lo había propuesto la sesión S2 anterior en su pregunta (c.21366 y el
registro de `SCRUM-1651.md`), y el orquestador llegó a la misma frase sin haberla leído.

## Texto aprobado, literal

> Se duplica sólo la opción recomendada.

## Dónde se pinta

`avisoSoloLaRecomendada` en `public/dashboard/js/quotesView.js`: un aviso propio (`alert warning`) bajo la
cabecera del editor «Nuevo presupuesto». Sólo se enciende cuando la copia viene de «Duplicar» y el original
tenía más de una opción (`soloLaRecomendada`, en `duplicateQuote` de `quotesDetailView.js`). Lo fija
`tests/scrum1651-duplicar-avisa-solo-la-recomendada.test.mjs`.

## Por qué dice la verdad

«Recomendada» en el panel es la opción `better`: es la que lleva la insignia «Recomendada» en el
presupuesto rápido (`homeView.js`, `feat = lv.id === 'better'`) y la que se marca `recommended`. Y las líneas
que guarda el servidor como las del presupuesto, que son las que copia «Duplicar», son las de `better`
(`quotes.routes.ts`, `betterTier`). Es la misma opción.

## Qué no cubre esta firma

«Usar plantilla» con una plantilla de varias opciones pierde las otras igual y no lo dice. Este texto habla
de duplicar y no vale para ese camino: allí no se enciende.
