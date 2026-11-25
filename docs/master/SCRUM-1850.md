# SCRUM-1850 · ficha 360: lo que quedaba por debajo de 44 px después de SCRUM-1841, por contenedor

**Medido contra:** `origin/main` = `e28f3582ec13e3c6102245a33bab02e4e7fa2370` · 2026-11-25T03:17:59Z (Date de GitHub; la rama nace de la punta de SCRUM-1841, `46dce9f3d0fed6a327c082ec022d53eae70d7181`, y no lleva main mergeado)

**Skill UI:** no cargada · no la cargué antes de editar `styles.css` (fallo mío, el mismo de la cicatriz J2 del 21-nov); el cambio es solo `min-height` acotado a tres contenedores de la ficha, sin color, tipografía, espaciado ni texto, y cargarla después no habría guiado nada

A9: aviso → cicatriz J2 «otra vez no me medí entre la lectura de Jira (121k) y el final de la construcción» — no se pudo comprobar: el aviso de 200k lo dio un hook que vive en el scratchpad del orquestador, no en el repositorio, y ningún guard del repositorio lee el contexto a mitad de tanda.

**Decisión:** SCRUM-1845 c.22728 (fundador, «2-Ok si es lo que ha dicho Luis sí»): un `.btn-sm` que no es la acción primaria de su pantalla se queda (DESIGN.md:171); todo lo demás por debajo de 44 se cura, por contenedor. Y «1-Sí amplio»: el permiso de endurecer `guard-objetivo-tactil.mjs` de SCRUM-1841 c.22708 vale para este ticket.

## Qué cambia

- `public/dashboard/css/styles.css`, bloque `/* J2: SCRUM-1850 … */ … /* J2: fin del bloque SCRUM-1850 */`, detrás de las reglas de SCRUM-1841: `.c360-pestanas > button`, `.c360-datos .contacto-link, #c360-meta .contacto-link` y `#c360-meta .input`, las tres a `min-height: 44px`. Solo tamaño; `.contacto-link`, `.input` y `.btn-sm` globales no se tocan. Especificidad: (0,1,1), (0,2,0)/(1,1,0) y (1,1,0), por encima de `.contacto-link` (0,1,0) y de `.input`; ninguna compite con `.btn.btn-sm`.
- En el bloque J2 de SCRUM-1592, `#c360-meta .input` sale de la regla de escritorio de 38 px (ahora vive en la de 44 de arriba, una sola regla por anchura); su regla de móvil se queda. `tests/scrum1592-campos-clientes-44.test.mjs` sigue en verde.
- `scripts/guard-objetivo-tactil.mjs`: la ficha 360 pasa de `distintosEsperados: 6` a `2`, y sale la excepción `BUTTON` (las pestañas), que el detector nombró SOBRANTE. Las dos líneas citan «SCRUM-1845 c.22728». Solo endurece.
- Test nuevo: `tests/scrum1850-ficha-360-resto-44.test.mjs` (navegador, 390 · 929 · 1280).

## Antes y después (`docs/master/evidencias/SCRUM-1850/medir.mjs`, árbitro `__areaDeToque` del guard y del censo)

Población: 17 interactivos visibles en cada anchura, 0 sin alcanzar. Salidas enteras en `medida-antes.txt` y `medida-despues.txt`.

| elemento | clase | ¿primaria? | toque antes 390 · 929 · 1280 | después 390 · 929 · 1280 | |
|---|---|---|---|---|---|
| «Presupuestos (1)», «Facturas (1)», «Trabajos (1)», «WhatsApp (1)», «Sitios», «Notas» | `BUTTON` en `.c360-pestanas` | no | 39 · 39 · 39 | 45 · 45 · 45 | curado |
| «34000000001», «💬 WhatsApp», «admin@fincassoler.es» | `A.contacto-link` en `.c360-datos` | no | 45 · 37 · 37 | 45 · 45 · 45 | curado |
| campo de etiquetas | `INPUT.input` en `#c360-meta` | no | 44,9 · 38,9 · 38,9 | 44,9 · 44,9 · 44,9 | curado |
| «Cómo llegar» (`#c360-como-llegar`) | `A.contacto-link` en `#c360-meta` | no | — · 37 · 37 (solo en el test: el censo no lo ve, su cliente no tiene dirección) | — · ≥ 44 · ≥ 44 | curado |
| «← Volver a Clientes» | `BUTTON.btn-ghost.btn-sm` | no: navegación | 30,5 · 30,5 · 30,5 | igual | **exento por c.22728** |
| «Ver →» (fila de la tabla) | `BUTTON.btn-ghost.btn-sm` | no: acción de fila | 30,8 · 30,6 · 30,6 | igual | **exento por c.22728** |

La primaria de la pantalla es «+ Nuevo presupuesto» (`btn-primary`), a 44 desde SCRUM-1841. Cortos: 8 · 12 · 12 antes; 2 · 2 · 2 después (los dos exentos). Capturas: `antes/360-{390,929,1280}.png` y `despues/360-{390,929,1280}.png`.

## Rojo y verde

- Test nuevo ANTES de la cura: 5 casos = 2 pass + 3 fail; «28 de 48 mediciones por debajo de 44 px» (las 6 pestañas × 3, los 3 enlaces × 2, el campo × 2, «Cómo llegar» × 2). Salida en `rojo-antes-de-la-cura.txt`.
- Después: 5 de 5. Su caso d) quita del CSSOM, en la misma página, las 3 reglas del bloque (fuera de `@media`): pestañas, enlaces y campo vuelven a quedar por debajo de 44 y los exentos miden lo mismo.
- `node scripts/guard-objetivo-tactil.mjs`: antes de endurecer, salida 1 (suelo «mide 2, espera 6» y `BUTTON` SOBRANTE). Después, salida 2: 0 hallazgos, suelo de la 360 «2, midió 2», y 4 ciegos, que son las 4 «FUENTE ROTA en /» de la landing que ya registró SCRUM-1841b (fuentes que no bajan en esta máquina). Salida en `guard-objetivo-tactil-despues.txt`.

## Lo que NO está medido

- El merge con main. Main lleva +257 líneas en `customerDetailView.js` (pestaña «Documentos», SCRUM-1005d): su botón cuelga de `.c360-pestanas` y lo cubre la regla de las pestañas, pero no lo he medido. Lo mide el check obligatorio.
- El contenido de las pestañas que no son la primera (Facturas, Trabajos, WhatsApp, Sitios, Notas, Documentos) y el modal de editar: se pintan al abrirlos, y el banco sirve la página sin JS. Ahí hay `.input` del formulario de Sitios y `.btn-ghost.btn-sm` de fila, sin medir.

## De paso (sin tocar: el encargo era SOLO tamaño)

- A 929 y 1280, la fila de acciones de la cabecera (`.c360-cabecera-acciones`, `flex-shrink: 0` por encima de 768) aprieta la columna del nombre a unos 90 px y «✎ Editar» queda ENCIMA de «Administración de Fincas Soler…». Ya pasaba antes de esta cura: se ve igual en `antes/360-1280.png` y en `despues/360-1280.png`. Lo reporto al orquestador.
