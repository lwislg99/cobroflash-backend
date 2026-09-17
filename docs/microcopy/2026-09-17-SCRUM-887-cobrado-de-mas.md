# SCRUM-907 · el aviso de cobro por encima de lo aceptado, en la ficha del Trabajo

Aprobado por el orquestador por delegación del fundador · SCRUM-887 comentario 15697

**Aplicado en el mismo acto** (regla 30), en SCRUM-907 (el PR 4 de SCRUM-887 que salió a su propio
ticket). La delegación es la permanente de `docs/equipo/limites-del-fundador.md`, sección «Delegación
permanente», línea de microcopy. Esta ficha **no** lleva la firma del fundador.

## Formato aprobado, literal

> Has cobrado {importe} más de lo aceptado.

`{importe}` es el exceso formateado como el resto de importes de la ficha. Ejemplo, tal como se pinta:
«Has cobrado 89,55 € más de lo aceptado.»

## Texto aprobado: sus partes fijas, tal cual están en el código

Una plantilla con huecos no aparece nunca literal en el código (la compone), así que lo que se cruza con
el código (guard SCRUM-514) son sus dos partes fijas:

> Has cobrado

> más de lo aceptado.

## Dónde se pinta

`public/dashboard/js/jobCobroHuecos.js` — función `avisoCobradoDeMas`. La usan las dos piezas de la ficha
del Trabajo: la sección «Qué falta para cobrar» (`jobDetailView.js`, bajo «Te falta por cobrar») y el bloque
«Dinero» del rail (`jobRailBlocks.js`). Sale solo si lo cobrado supera lo aceptado en más de 0,02 €.

## Qué cambió

Antes no había texto: con el cobro por encima de lo aceptado, las dos piezas decían «0,00 €» y nada más.
