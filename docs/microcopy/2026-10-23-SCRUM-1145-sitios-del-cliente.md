# «Sitios» — la pestaña de la ficha del cliente · SCRUM-1145 y SCRUM-1044

**Aprobado por el fundador** el 23-oct-2026, en **SCRUM-1145** (comentarios 20592 y 20598).

Los transcribe en Jira el orquestador del equipo de Javier (`cobroflash-backend-62`): «Firmo +
«Dirección fiscal»» en el comentario 20592, y «Firmo los seis» y «Piso 3ºB / Nave del polígono» en el
20598, que contesta a la petición de J2 del 20595. Lo escribe aquí la sesión que aplica los textos
(jv-j2ao, J2): es quien los aplicó contando que se firmaron, no la firma; la firma son los comentarios.

## Textos aprobados, literales

Del comentario 20592:

> Sitios

> + Nuevo sitio

> Todavía no hay sitios guardados para este cliente.

> Nombre del sitio

> Dirección

> Ciudad

> Código postal

> Provincia

> País

> Contacto en el sitio

> Teléfono del contacto

> Dirección fiscal

Del comentario 20598:

> Editar

> 🗑 Eliminar

> Guardar

> Cancelar

> No se pudieron cargar los sitios guardados. Inténtalo de nuevo.

> No se ha podido completar la acción. Vuelve a intentarlo.

> Piso 3ºB / Nave del polígono

«Cómo llegar» es el enlace ya firmado de SCRUM-1004 (el de la cabecera de la ficha), igual.

## Dónde se pinta cada uno

Todos en `public/dashboard/js/customerDetailView.js`, con el texto en `SITIOS_CLIENTE.TEXTOS`:

- «Sitios»: la quinta pestaña de la ficha, sin número (la lista se pide al abrirla).
- «Dirección fiscal»: la primera fila, de sólo lectura, con los `billing*` del cliente y su «Cómo
  llegar». Sin ninguno de los cinco, no se pinta.
- «+ Nuevo sitio»: el botón de alta, encima de la lista.
- «Todavía no hay sitios guardados para este cliente.»: el vacío, debajo de la fila fiscal.
- Los ocho rótulos de campo: el formulario de alta y de edición.
- «Piso 3ºB / Nave del polígono»: el texto de ejemplo del campo «Nombre del sitio».
- «Editar» y «🗑 Eliminar»: los dos botones de cada sitio guardado. Se borra sin confirmación.
- «Guardar» y «Cancelar»: el pie del formulario.
- «No se pudieron cargar los sitios guardados. Inténtalo de nuevo.»: si falla la lista.
- «No se ha podido completar la acción. Vuelve a intentarlo.»: si falla guardar o borrar.

Sin texto nuestro: el aviso de campo obligatorio lo pone el navegador (`required`), como acepta el
comentario 20598. Los nombres de país los pone el navegador (`prefijosPais.js`). La opción vacía del
país es el guion «—» del selector de la ficha del cliente (`customersView.js`), un símbolo que ya
estaba en producción. Ninguno de los dos comentarios lo nombra.
