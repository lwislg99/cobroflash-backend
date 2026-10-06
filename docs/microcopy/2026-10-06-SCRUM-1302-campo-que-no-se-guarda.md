# El parte: un campo de la cabecera que no se ha guardado

Aprobado por el orquestador por delegación del fundador · SCRUM-1302 comentario 18288

Firmado el 6-oct-2026. La delegación de microcopy es la permanente de `docs/equipo/limites-del-fundador.md`.

## Texto aprobado, literal

> No se ha podido guardar el cambio — vuelve a intentarlo

## Dónde se pinta

`public/dashboard/js/parteDetailView.js`, `TEXTOS.noSeGuardoElCambio`.

Cuando falla el guardado de un campo de la cabecera del parte: entrada, salida, desplazamiento, kilómetros,
dirección de la obra, REF, técnicos, tipo de intervención o notas. La ficha se repinta con lo que quedó en el
servidor y el aviso sale en el paso de ese campo: junto a las horas, o dentro de su línea plegada, que se abre.

Se quita cuando ese mismo campo se guarda. Guardar otro campo no lo quita.

## Por qué este literal

Está calcado del que ya dice que las líneas no se han guardado (`TEXTOS.noSeGuardo`), cambiando sólo qué es lo
que no se guardó. El mismo fallo se cuenta con las mismas palabras.

## Lo que no cubre

- Las líneas del parte: tienen su texto, y no es éste.
- Los mensajes que el servidor manda con el rechazo («Los desplazamientos son un número entero.» y otros tres):
  no se enseñan. Si se pueden enseñar tal cual sigue sin decidir (SCRUM-1302 comentario 18288).
- Si tampoco se puede releer el parte, la ficha dice que no se ha podido cargar y este aviso no sale.
