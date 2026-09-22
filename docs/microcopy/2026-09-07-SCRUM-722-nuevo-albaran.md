# SCRUM-722 · el rótulo del botón de Albaranes

**Aprobado por el FUNDADOR el 7-sep-2026.**

## ⚠️ Esto REPONE una firma que el propio fundador retiró el día anterior

El 6-sep-2026, en SCRUM-769, retiró la firma de tres rótulos —«Nuevo producto», «Nuevo proveedor»
y **«Nuevo albarán»**— con estas palabras: *«Colgar N de un botón que confirma es atar una tecla a
un guardado. N abre, no guarda.»*

**No se reescribe aquel registro**: sigue en su fichero, con su fecha y su motivo. Esta aprobación
es posterior y vive en el suyo, que es como funciona este directorio: una aprobación, un fichero, y
manda el último fechado.

Y el motivo de la retirada **distingue** este caso de los otros dos: los botones de Productos y
Proveedores **envían** un formulario —por eso siguen retirados—, mientras que el de Albaranes
**abre** un modal. Está medido corriendo en el barrido de SCRUM-721: pasa las tres condiciones del
mecanismo del atajo (rótulo de la pieza, tecla de la pieza y acción registrada).

## El texto, literal

> Nuevo albarán

Sin corchetes y sin marcador, igual que sus cinco hermanos de `atajoNuevo.TEXTOS`.

## Dónde se pinta

`public/dashboard/js/atajoNuevo.js` → `TEXTOS.albaranes`. Desde ahí llega a dos sitios, que es
justo por lo que el rótulo vive en la pieza y no en la vista:

- el botón primario de la lista de Albaranes (`albaranesView.js:157`, vía `etiquetar`);
- el título del modal del buscador (`albaranDesdePresupuestoModal.js`).

## Qué había antes

> [PENDIENTE microcopy oficial] Nuevo albarán

Entró con marcador en SCRUM-606 (4-sep-2026) y **estuvo tres días a la vista en producción**, en
los tres estados de la lista —con datos, sin datos y en error—. La palabra ya era la buena; lo que
faltaba era la firma, y el marcador se pinta a propósito (SCRUM-402/667) para que nadie encienda
por descuido un texto que nadie ha aprobado. Al firmarlo, el marcador cae y el texto se queda.

## Cómo se encontró, que es la parte que importa

**De rebote.** Salió en el barrido de SCRUM-721, que medía otra cosa: si el botón «Nueva factura»
pasaba por el mecanismo del atajo. Ningún guard lo vio, y no por descuido — los tres que existían
miran otra cosa (ver la sección de SCRUM-722 en `docs/master/`). Eso es lo que cierra este ticket.

## Qué queda sin firmar, y no se toca

Dos ranuras más llegan al DOM y siguen **sin firma**; van reportadas al fundador con su literal y
su propuesta, y **no se ha inventado ni una palabra**:

- `exportView.js:87` y `:100` — VISIBLES en las tres estados de la pantalla de exportación.
- `quotesView.js:890`, `:1363` y `:1398` — presentes en el DOM pero **ocultas** en los tres
  estados medidos: son de la propuesta de pago, que sólo se despliega al elegir esa opción.
