# SCRUM-1702 · PILOTO-1 · «Trabajo nuevo»: elegir la dirección de la obra entre los sitios guardados

**Medido contra:** `origin/main` = `81f5795355200112e4d79feb4ec472b252ea243b` · 2026-11-11T16:47:42Z (cabecera `Date:` de `gh api -i zen`) · **Rama:** `scrum-1702-trabajo-nuevo-sitio-guardado` · **Carril:** S2.

**Skill UI:** cargada (`yaqu-premium-ui`; AB6: sin componente, clase, token ni CSS nuevos. Se monta el control que ya existe, `sitiosGuardados.montarSelector` (SCRUM-1144), con sus clases y su objetivo de 44 px)

A9: comprobación → `tests/scrum1702-trabajo-nuevo-sitio-guardado.test.mjs`

## Origen y decisión

Cierre de SCRUM-1681 (c.21500): en «Trabajo nuevo» la «Dirección de la obra» nace vacía y el piloto la teclea
en cada trabajo. **Camino 1, decisión del orquestador** (SCRUM-1702 c.21501, bajo la delegación): se reutiliza
«Elegir un sitio guardado». Es una acción MANUAL y no añade texto. Manda DOC-12 (SCRUM-602, 24-ago-2026: la
dirección de la obra nunca se prerrellena sola), que no se reabre. Si el piloto pide herencia automática, eso
es un SÍ del fundador que cite DOC-12.

## Qué cambia

`public/dashboard/js/jobNuevoModal.js`: bajo `#tn-direccion` se cuelgan el botón y la lista del control
compartido (`idLista: 'tn-sitios-guardados'`).

- **Sin cliente elegido** («Selecciona un cliente…» o la entrada «+ Nuevo cliente») el botón está pero
  `hidden`: sin cliente no hay sitios que ofrecer, igual que en la ficha del Trabajo.
- **Al cambiar de cliente** (en el `<select>` o al volver del alta) se cierra la lista, que era la del
  anterior, y se recalcula si se enseña.
- **Nada se rellena solo:** elegir cliente no pide los sitios ni escribe en el campo. Se escribe sólo al
  pulsar un sitio, y lo que se escribe es lo que compone el control compartido. El `POST /admin/jobs`
  ya mandaba `direccion` desde ese campo; no cambia.
- **Texto:** ninguno nuevo. «Elegir un sitio guardado», el vacío y el error son los de `sitiosGuardados.js`
  (aprobados en SCRUM-1144 c.17121); el modal no escribe ninguno.
- Si `window.sitiosGuardados` no está (o el campo no tiene padre), el modal queda como antes: así sigue
  pasando el test de juguete de 1681c, que no carga el control.

Queda fuera, y se dice: la pregunta del ticket «¿sale la dirección de facturación del cliente entre los
sitios?» — **no**: la lista es la de `/admin/customers/:id/sites`, los sitios guardados. Copiarla sería el
camino 2, que pide el SÍ del fundador contra DOC-12.

## Comprobación

- **Test** (banco de vistas, con `jobNuevoModal.js` y `sitiosGuardados.js` REALES): sin cliente, botón
  escondido · con cliente, a la vista, el campo vacío y sin pedir sitios (DOC-12) · pulsar botón y sitio
  escribe la dirección y «Abrir trabajo» la manda en el `POST` · cliente sin sitios: campo vacío y libre ·
  cambiar de cliente cierra la lista · volver al hueco esconde el botón · el rótulo no está copiado en el
  modal. 7/7, con 1681c y 651: 34/34 ✔.
- **Rojo por mutación:** sin montar (6 ✖) · botón siempre escondido (2 ✖) · sin `cerrar()` al cambiar (1 ✖) ·
  el `change` sin recalcular (2 ✖). Cuatro de cuatro, restaurado.
- **Tanda** de los 265 ficheros que leen `jobNuevoModal.js`, `sitiosGuardados.js` o el banco de vistas:
  2116 ✔ · 2 ✖ · 5 saltados. Los dos ✖ son SCRUM-1199, los mismos dos que el registro de SCRUM-1701
  declara de entorno en este equipo (no tocan nada de este ticket; su causa no la he medido aquí).
- **En yaqu.app:** pendiente del merge (390 y 1280, cuenta QA, un cliente con sitio y uno sin).
