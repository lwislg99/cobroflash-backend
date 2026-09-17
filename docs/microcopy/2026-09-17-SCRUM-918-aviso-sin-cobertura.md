# SCRUM-918 · el aviso de que la app ha arrancado sin cobertura

Aprobado por el orquestador por delegación del fundador · SCRUM-918 comentario 15792

**Aplicado en el mismo acto** (regla 30). La delegación es la permanente de
`docs/equipo/limites-del-fundador.md`, sección «Delegación permanente», línea de microcopy. Esta ficha
**no** lleva la firma del fundador.

## Texto aprobado, literal

> Sin cobertura. Ves lo que ya tenías en el móvil; lo demás se cargará cuando vuelva la conexión.

## Dónde se pinta

`public/dashboard/js/arranqueSinCobertura.js` — constante `AVISO_SIN_COBERTURA`. La pinta `app.js`
(`pintarAvisoSinCobertura`) arriba de la app, en ámbar (`.aviso-sin-cobertura`), cuando GET /admin/me falla
SIN RED y la app arranca con la copia local de la sesión. Se quita al volver la red si el servidor da la
sesión por buena. Lo lee el profesional o el técnico, normalmente a 390 px y en obra.

## Qué cambió

Antes no había texto: sin red, recargar la app acababa en la pantalla de error de Chrome sobre /login.html.
Firmado sin cambios respecto a la propuesta de la sesión (comentario 15791). La firma comprobó que no es un
texto bloqueado por el asesor ni tiene contenido legal.
