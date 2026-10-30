# «Quién me debe» — la lista de Clientes · SCRUM-1043

**Aprobado por el fundador** el 23-oct-2026, en **SCRUM-1043** (comentario 20536).

Lo transcribe en Jira el orquestador del equipo de Javier (`cobroflash-backend-62`): «Javier elige
**todas las A**» de la propuesta de J2 en el comentario 20533. La decisión de que el técnico no vea
la deuda es del comentario 20532. Lo escribe aquí la sesión que aplica los textos (jv-j2ah, J2): es
quien los aplicó contando que se firmaron, no la firma; la firma es el comentario.

## Textos aprobados, literales

> Con cobro pendiente

> Más pendiente de cobro

> Pendiente de cobro

> {importe} sin cobrar

> Ningún cliente tiene cobros pendientes.

La garantía retenida usa el literal ya firmado de SCRUM-1108 (`garantiaRetenidaFicha`, firmado en
SCRUM-1108 c.17000), igual, una línea por retención.

## Dónde se pinta cada uno

Todos en `public/dashboard/js/customersView.js`, con el texto en `filtroClientes.js` (`TEXTOS_DEUDA`):

- «Con cobro pendiente»: el botón de alternar de la barra, junto a Todos / Empresas / Personas.
- «Más pendiente de cobro»: la tercera opción del desplegable de orden.
- «Pendiente de cobro»: la cabecera de la columna y su casilla en el selector «Columnas». Ya estaba
  en producción en la tarjeta de la ficha 360, sin registro de firma; queda firmado en este acto.
- «{importe} sin cobrar»: la cifra en cada fila, que en el móvil va sin cabecera.
- «Ningún cliente tiene cobros pendientes.»: el vacío con el filtro puesto, en una línea.

Al técnico no se le pinta ninguno: se le ocultan filtro, orden y columna, sin texto (comentario 20532).

## Lo que queda sin firmar en esta pantalla

La segunda línea del vacío de pestaña, «Marca cada cliente como empresa o persona al editarlo.», es
falsa cuando el que vacía la lista es el filtro de etiqueta o el de visita. No se toca aquí: va en
otro ticket con su firma (comentario 20536).
