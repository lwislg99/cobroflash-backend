# SCRUM-917c · los singulares del pie de «Por cobrar»

**Aprobado por el orquestador por delegación del fundador** el 18-sep-2026 — SCRUM-917 comentario 15938.

**Aplicado en el mismo acto** (regla 30), en el corte 917c (`jobsView.js`). La delegación es la permanente de
`docs/equipo/limites-del-fundador.md`, sección «Delegación permanente», línea de microcopy.

Los plurales se firmaron en el comentario 15881, y tienen su propia ficha de SCRUM-917 en este directorio. Con
N = 1 el plural firmado habría pintado «en 1 trabajos sin cerrar»; estos dos son su forma en singular.

## Formato aprobado, literal

> en 1 trabajo sin cerrar

> 1 sin importe de referencia, no entra

## Texto aprobado: sus partes fijas, tal cual están en el código

> trabajo

> no entra

## Dónde se pinta

`public/dashboard/js/jobsView.js`, función `pintarCifrasDeLaLista`: el pie de la cifra «Por cobrar», cuando
hay exactamente un Trabajo con dinero pendiente, o exactamente uno sin importe de referencia.

## Qué cambió

Nada visible antes: la cifra «Por cobrar» es nueva en SCRUM-917c.

## Qué queda sin firmar

Nada en esta ranura. En el mismo comentario el orquestador dejó escrito que con N = 0 la parte «en N trabajos
sin cerrar» no se pinta, y que la barra fija de móvil queda fuera de 917c.
