# SCRUM-1145 · la pestaña «Sitios» en la ficha del cliente (con SCRUM-1044: la fila fiscal y «Cómo llegar»)

**Medido contra:** `origin/main` = `c81f07621b6e21204722d42d3021e36965382949` · 2026-10-23T16:57:00Z (hora de GitHub al escribir)
A9: aviso → cicatriz J2 «crucé los 200k y los 300k de contexto sin avisar y avisé a 367k: no me medí al acabar la tanda entera» — no se pudo comprobar: la medición la hace la propia sesión con su contador, y ningún hook del repositorio la lee al acabar una tanda
A9: aviso → cicatriz J2 «un `sed` con una barra invertida falló y `node --test` arrancó con la lista vacía: corrió la suite entera de otro árbol en vez de 14 ficheros» — no se pudo comprobar: el comando se teclea en la consola, que ningún guard del repositorio ve
**Skill UI:** cargada · `yaqu-premium-ui`, por jv-j2ao antes de construir y otra vez por jv-j2ar al revisar (checklist AB6, abajo)

Puesto J2. Construido por `jv-j2ao` y cerrado por `jv-j2ar` (relevo). Rama `scrum-1145a-pestana-sitios`. Encargo del orquestador del
equipo de Javier (`cobroflash-backend-62`). El hook de arranque dijo «SIN IDENTIDAD» (SCRUM-1498): el puesto lo da el encargo.

## PASO 0

Sin commits en `origin/main` con «SCRUM-1145» (el único resultado de `--grep=1145` es el PR #1145, de SCRUM-482), sin rama
`scrum-1145*` ni `scrum-1044*` en el remoto y sin este registro. La pestaña no existía en `customerDetailView.js`. Jira leído entero:
c.20592, c.20595, c.20598 y c.20606; etiquetas `equipo-javier` + `area-j2`.

## Qué hace

- La ficha del cliente lleva una quinta pestaña, «Sitios», **sin número**. La lista (`GET /admin/customers/:id/sites`) se pide **al
  abrirla**, no al pintar la ficha: abrir la ficha no hace ninguna petición más que antes (c.20598).
- La primera fila es la **dirección fiscal**, de sólo lectura, compuesta con los `billing*` del cliente, y lleva su «Cómo llegar»
  (SCRUM-1044). Sale aunque el cliente no tenga sitios, y aunque la lista no cargue.
- Cada sitio guardado lleva nombre, dirección, contacto · teléfono, «Cómo llegar» (sólo si tiene dirección), «Editar» y «🗑 Eliminar».
- Alta y edición en un formulario sobre la lista. «Nombre del sitio» es el único obligatorio, con el `required` del navegador. Un campo
  en blanco viaja `null` (así se borra al editar). El país usa el mismo selector que la ficha del cliente (`prefijosPais.js`).
- **Borrar no pregunta** (c.20592) y es un botón fantasma, nunca la acción principal. **Conserva lo guardado:** ningún modelo apunta a
  `CustomerSite` y el selector de SCRUM-1144 copia la dirección como texto. El caso con base del test lo fija.
- `sitiosGuardados.js` y `api.js` (S2) sólo se llaman: no están en el diff.

## Textos

Los 20 de `SITIOS_CLIENTE.TEXTOS` llevan la firma en su línea. Registro: `docs/microcopy/2026-10-23-SCRUM-1145-sitios-del-cliente.md`.
**Comparados por programa** (jv-j2ar) contra las celdas de c.20592 y c.20598 leídas en ADF: 20 de 20 son literales firmados. El
control sembrado (un texto sin firma añadido a la población) sale «SIN FIRMA». Fuera de `TEXTOS` sólo se pinta el «—» del selector de
país, que es el de la ficha (`customersView.js`), el « · » que une contacto y teléfono, los nombres de país de `prefijosPais.js` y, en un
error, lo que devuelva `mensajeParaPersona` (el `message` del servidor si lo trae; si no, el texto firmado).

## Carriles

`customerDetailView.js` → J2. `styles.css` → S2 (contenedor): bloque nuevo marcado `-- J2 · SCRUM-1145/1044 --` al final.
`scripts/_sin-consumir-declarados.json` → S0 (contenedor): las tres rutas de sitios pasan a `retiradas` (ya se consumen), y POST/PUT
entran como `ciega-lector-cuerpo` de J2 (el handler pasa el cuerpo entero a su esquema y la sonda no ve qué campos lee).
`tests/scrum419-…` declara el caso con base del test nuevo.

## De paso

La fila de pestañas de la ficha **parte línea** (`.c360-pestanas { flex-wrap: wrap; }`). Con la quinta, a 390 px la pestaña quedaba
entre 390 y 456 px, fuera de la pantalla y sin barra para llegar. Y a 320 px las cuatro que ya había en `main` ocupaban 386 px en una
caja de 305. El test lo fija (caso «PARTE LÍNEA») y lo matan dos mutaciones.

Vistos y **no arreglados** (cabecera de la ficha, de `main`, fuera de este ticket): a 320 px «Guardar en mis contactos» sale cortado; a
1280 px un nombre largo se parte palabra a palabra.

## Pruebas

- `tests/scrum1145-pestana-sitios.test.mjs`: 13 casos. En local, 12 verdes y 1 saltado. El saltado es el caso **con base** (ruta real,
  aislamiento entre dos merchants, el borrado conserva la dirección del presupuesto): **NO corrido en local**, porque no hay Postgres en
  esta máquina. Lo corre el obligatorio.
- **Rojo primero y mutaciones** (`docs/master/evidencias/SCRUM-1145/mutar.mjs`, salida en `mutar-salida.txt`, corrido por jv-j2ar
  después del merge): con la vista de `origin/main` caen 12 de 13; las **9 mutaciones del catálogo** `MUTACIONES_QUE_ME_TUMBAN` mueren,
  cada una por su caso. El árbol queda restaurado por contenido.
- Capturas a 320, 390 y 1280 en `docs/master/evidencias/SCRUM-1145/` (`pagina.mjs`). Nada se sale en los 9 casos medidos.
- **Rojo que cazó la suite entera (jv-j2ar):** el catálogo nombraba el fichero con una variable (`fichero: VISTA`) y el meta-guard
  sólo lee literales: caían `scrum745`, `scrum757` y `scrum765`. Ahora cada entrada lleva el literal, y los tres salen verdes.
- **Suite entera local (jv-j2ar), en dos mitades que suman los 1480 ficheros:** A (`scrum1*`, 570) = 4352 casos: 4278 verdes + 4
  rojos + 70 saltados. B (el resto, 910) = 8020 casos: 7904 verdes + 23 rojos + 93 saltados. De los 27 rojos, **24 son del entorno**:
  caen igual en un árbol de `main` (`e306a6a5e`) con el mismo anidamiento (`scrum1199` ×2, `scrum1298b` ×2, y 20 de Prisma y
  `node_modules`). **Los otros 3 eran míos** (los de arriba), ya arreglados. No he repetido la suite entera después de ese arreglo:
  repetí los 5 ficheros afectados, 77 casos = 76 verdes + 1 saltado.
- Guards de navegador: `guard:objetivo-tactil`, `censo:tactil-panel` y `guard:portal-en-la-ficha`, los tres en verde. La pestaña
  «Sitios» la mide el primero (41 px) y entra en la excepción que ya existía para las pestañas del historial. **Ninguno abre la
  pestaña**: el formulario y sus botones no los mide ningún guard de navegador.

## Checklist AB6

- `required` + `label` en cada campo; `role="alert"` en los avisos de error.
- «Editar» y «🗑 Eliminar» son `btn-sm`: **30 px a la vista**, la excepción de DESIGN.md §5. No llegan a 44 px de toque. Lo dice este
  registro y no lo arregla.
- **No hay esqueleto** mientras llega la lista: la fiscal sale al momento y los sitios aparecen al llegar. No medido cuánto tarda.
- El Técnico también ve la pestaña: las cuatro rutas le dejan (`adminRouteDeclarations`).
