# «Eliminar este cliente» — la tarjeta y el modal de la ficha del cliente · SCRUM-1868b

**Aprobado por el fundador** el 26-nov-2026, en **SCRUM-1868** (la descripción: «1-B / 2-Los textos valen») y en **SCRUM-1868 c.22850** (el toast: «1-✅»). La fila «Solicitudes de presupuesto» del modal de revisión, en **SCRUM-1868 c.22867** («1-Ok»), detrás de «Historial de actividad»; la aplica jv-j2fm (J2).

Lo transcribe en Jira el orquestador del equipo de Javier. Lo escribe aquí la sesión que aplica los
textos (jv-j2fl, J2): es quien los aplicó contando que se firmaron, no la firma; la firma son la
descripción y el comentario. Se pintan en `public/dashboard/js/customerDetailView.js`
(`BORRAR_CLIENTE`). `{nombre}` es el nombre del cliente; `{n}` y `{m}`, las facturas emitidas y los
presupuestos. Singular, plural y «solo una de las dos» se derivan del literal sin palabras nuevas,
como permite la descripción.

## Textos aprobados, literales

> Eliminar este cliente

> Se borra su ficha con sus documentos, sus sitios y sus equipos. No se puede deshacer. Si tiene presupuestos o facturas, no se puede eliminar.

> Solo lo ve el administrador.

> Eliminar cliente

> Revisa lo que se borra antes de confirmar

> Se borra

> La ficha de {nombre}

> Documentos adjuntos

> Sitios

> Equipos

> Historial de actividad

> Solicitudes de presupuesto

> Este cliente no tiene presupuestos ni facturas: por eso se puede eliminar.

> Esto no se puede deshacer.

> Cancelar

> Eliminar

> No se puede eliminar a {nombre}. Tiene {n} facturas emitidas y {m} presupuestos, y una factura emitida no se borra.

> Lo que lo impide

> Facturas emitidas

> Presupuestos

> Puedes fusionarlo con otro cliente o dejarlo como está.

> fusionarlo con otro cliente

> Cerrar

> Cliente eliminado

> No se ha podido completar la acción. Vuelve a intentarlo.
