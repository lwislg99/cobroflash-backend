# SCRUM-1806 · el rótulo firmado en el aviso de la bandeja (tercer sitio de SCRUM-1782b)

**Medido contra:** `origin/main` = `2ab4549bd7ab38803be901e99fdc22b1fdeed195` · 2026-11-25T14:08:55Z (cabecera `Date:` de `gh api -i zen`)
A9: comprobación → `tests/scrum1387-banco-nuevo-va-al-catalogo.test.mjs`
Mutaciones: catálogo → `tests/scrum615-pedir-tipo-destinatario.test.mjs`

Puesto S2. Hijo de SCRUM-1782. Firma del fundador: SCRUM-1782 c.22268 (el literal) y c.22272 («1-Sí»: el mismo literal en el aviso de la bandeja). El re-anclaje de `scrum615` y `scrum601` lo autorizó c.22373.

**Por qué va ENCIMA de la rama de J2.** `scrum-1782b-rotulo-factura-como` (@ `812d9793d`, PR #3317) cambió las dos fichas, y `scrum615` exige los TRES sitios iguales. Sin esta línea, el PR nace rojo, y por eso J2 lo cerró a propósito: para que el bot no «arreglara» el rojo. Esta rama es la suya + `origin/main` + mi línea. Es la que vuelve a #3317.

**El cambio, una línea:** `public/dashboard/js/tipoDestinatarioPendiente.js:58`. `ETIQUETA` pasa de `'Tipo de cliente'` a `'¿Factura como empresa o autónomo (IVA)?'`. `OPCIONES` no cambia. Ningún texto más.

**Rojo primero.** Con la línea vieja, `scrum615` da 11 de 12, y cae «los cuatro textos del campo son los que YA existen, letra a letra». Con la nueva, 12 de 12. `scrum1782b` da 3 de 3. `scrum601` da 20 de 20 tras el re-anclaje de abajo.

**Mutaciones.** Las corre `correr` + `aplicarUna`, con base limpia 12 / 0 / 0. Viven en `MUTACIONES_QUE_ME_TUMBAN` de `scrum615`: es el test que ata los tres sitios, y hasta hoy no tenía catálogo. Las dos caen y el árbol queda restaurado.

**Error mío, cazado por un guard que ya existía.** Primero las escribí en un guion propio dentro de `evidencias/`. `scrum1387` (está en `guards:entrada`) lo tumbó por ser un banco de mutación nuevo fuera del catálogo. El guion se ha borrado, y la lista vive en el test.

| mutante en `:58` | resultado |
|---|---|
| vuelve a «Tipo de cliente» | CAE |
| el literal sin «(IVA)» | CAE |

**`scrum601`: dos cifras derivadas, re-medidas sobre el árbol FUSIONADO (`main` 2ab4549bd + 1782b + 1806).**
- `VEREDICTO_AL_MEDIR`: el merge chocó, porque 1787w (en `main`) y 1782b subieron `aPelo` 163 → 164 cada una por su literal. Medido: `{ flag: 8, tipo: 12, aPelo: 166 }`. Cuadra con la suma (main 164, +1 de `customersView.js:1511`, +1 de `:58`), y la suma se usa sólo como comprobación.
- `NO_LEGIBLES_AL_MEDIR` 41 → 42: la línea 58 entra en el censo porque ahora lleva la diana («Factura»), y entra como no legible (sumidero `DOM:textContent`, alcance `const ETIQUETA`). La miré a mano: el texto final es la constante, letra a letra. Es la única construcción no legible nueva.

**🔴 Sin `npm run build`.** Este worktree cuelga del `node_modules` compartido, y su cliente de Prisma va 18 campos por detrás de `schema.prisma` (lo dice `_prisma-client-guard.mjs`). No lo he regenerado (A1), y se lo he dicho al orquestador. Los tres tests de arriba leen el fuente o montan el banco de vistas, y no dependen de `dist/`. La tanda entera la corre el check obligatorio.

**Sin medir:** yaqu.app. Se verá tras el merge de #3317.

# APÉNDICE SCRUM-1806 · r42 en vivo (26-nov-2026, S2)

**Medido contra:** `origin/main` = `13e5bb69532b7d56d8d0be4b8386210aa2e5202b` · 2026-11-26T21:26:01Z (relevo de S2; #3317 ya mergeado).

A9: sin fallo que generalice — la medida salió a la primera; el único tropiezo fue la sesión +qa caducada (24 h), que `sesion-panel.mjs estado` ya dice.

**Método recibo, escrituras cero.** yaqu.app sirve TODO (nada local: se mide lo desplegado), cuenta +qa. La bandeja real está vacía (`GET /admin/albaranes/pendientes-facturar` → `{"clientes":[]}`, leído con `scripts/qa/sesion-panel.mjs get`), así que la respuesta de ESE GET se sustituye en el navegador por dos clientes de EJEMPLO: uno sin tipo declarado y otro con él (control). Toda escritura se intercepta y no sale: la única fue `POST /admin/entorno`. Guion: `docs/master/evidencias/SCRUM-1806/r42-1806-bandeja.mjs` · medida: `r42-1806-medida.json` · fotos `r42-1806-bandeja-{390,1280}.png`.

| ancho | el fichero desplegado lleva el literal | rótulo pintado | caja del rótulo | tarjetas que preguntan (de 2) | errores · desborde |
|---|---|---|---|---|---|
| 390 | sí | «¿Factura como empresa o autónomo (IVA)?» | `[50,431,260,39]` | 1 | 0 · no |
| 1280 | sí | «¿Factura como empresa o autónomo (IVA)?» | `[310,382,260,39]` | 1 | 0 · no |

Opciones: «Sin clasificar», «Particular», «Empresa / profesional» (las de siempre). El cliente CON tipo no pregunta: el sentido negativo también se ve en vivo.

**Visto y declarado, fuera de este ticket:** encima del rótulo sigue el marcador `[PENDIENTE microcopy oficial]` del aviso (salida C de SCRUM-615), que no es de 1806 ni lo toca.

**Veredicto r42: VERDE.** Lo cierra el orquestador.
