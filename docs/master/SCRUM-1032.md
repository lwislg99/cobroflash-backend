# SCRUM-1032 · Llamar, escribir por WhatsApp o mandar un correo al cliente con un toque, desde la lista y la ficha (y ver también su móvil)

**Medido contra:** `origin/main` = `b6cde0517649d991a1b08eabb50017a81a03acfb` · 2026-09-21T17:27:29Z (hora de GitHub, cabecera `Date:` de `gh api -i zen`).
**Rama:** `scrum-1032-contacto-con-un-toque` (parte del PR A del primer lote CRM; va aparte de SCRUM-986 porque toca `guard:lista-trabajos`, que la regla 41 manda pedir). Bloque CRM (SCRUM-977), CRM-02; diseño en `docs/producto/CRM.md` §5.
**Ficheros de J2:** `customersView.js` y `customerDetailView.js`; comentario de aviso (decisión D1) puesto el 21-sep-2026 a las 17:27Z en este ticket (16252). No se toca `whatsapp.ts`, ni plantillas de Meta, ni `jobRailBlocks.js` (solo se consultó), ni el esquema.
**Microcopy:** ninguna nueva. El número y el correo son el dato mismo (el enlace lo lleva por texto); «WhatsApp» y su icono 💬 son el rótulo ya en uso en el bloque CLIENTE del panel del Trabajo (`jobRailBlocks.js:61`), y `Móvil (WhatsApp)` ya nombraba el campo en el formulario. **Confirmado por el orquestador -06 el 21-sep-2026 (mensaje en vivo):** reutilizar «WhatsApp» + 💬 cuenta como firmado (texto en la ficha; nombre accesible y tooltip del icono en la lista).
**Guard:** el orquestador -06 autorizó el mismo día declarar las piezas de este ticket en `guard:lista-trabajos` (regla 41: es añadir una declaración, precedente SCRUM-831/979), con tres condiciones: declaración exacta y mínima, prueba de que sin esas piezas el HTML sale idéntico a la base, y rojo previo sin la declaración. Están abajo.

## Paso 0: el defecto existía hoy

Contado con el banco de vistas sobre `origin/main`: la lista de Clientes y la ficha pintan **0 enlaces** `tel:` / `wa.me` / `mailto:`; el móvil no se pinta en la lista (`customersView.js` solo leía `c.phone`); en la ficha el teléfono y el correo son texto plano. Test escrito antes del arreglo: **5 de 5 en rojo**.

## Lo que cambia

| fichero | qué |
|---|---|
| `public/dashboard/js/api.js` | `contactoDelCliente({phone, mobile, email})`: la pieza compartida. Normaliza como el servidor (`normalizePhone`: espacios, guiones, paréntesis, puntos, `+`/`00` delante; 8–15 dígitos o no es teléfono). `wa.me` lleva **solo dígitos**. `tel:` lleva `+` si el número ya trae prefijo (lo escribió con `+`/`00`, o tiene 11 dígitos o más, que es cómo se guardan: `34600000000`); uno corto se marca tal cual, **sin inventarle un país**. WhatsApp va al móvil y, si no hay, al teléfono. Móvil y teléfono iguales → un solo enlace. Correo: se enlaza tal cual, y solo si parece un correo. Sin dato válido, `null`: nunca un botón muerto. |
| `public/dashboard/js/customersView.js` | la celda de teléfono muestra teléfono y, si lo hay y es otro, móvil; WhatsApp como icono 💬 con nombre accesible «WhatsApp» (la lista va justa de ancho); el correo, enlace. Los enlaces frenan el clic (`stopPropagation`): la fila entera abre la ficha. Sin ningún teléfono, «sin teléfono» como hasta hoy. |
| `public/dashboard/js/customerDetailView.js` | la cabecera: teléfono, móvil, «💬 WhatsApp» y correo como enlaces. Lo que no es un número o un correo se pinta como antes, sin enlace. |
| `public/dashboard/css/styles.css` | `.contacto-fila` / `.contacto-link`: subrayado suave y el área de toque de AB6 (44 px hasta 768, 36 por encima). |
| `tests/scrum1032-contacto-con-un-toque.test.mjs` (5 pruebas) | A: cada caso límite del ticket con su resultado exacto (espacios, sin prefijo, +34/0034/paréntesis, extranjero, móvil = teléfono, distintos → WhatsApp al móvil, solo teléfono, correo con mayúsculas) y que sin dato válido salgan `null` y nunca «undefined»/«null» en un texto o un `href`. B: la lista, una fila con datos y otra vacía sin ningún enlace. C: la ficha, completa, vacía y con dato raro. D: los enlaces de la lista frenan el clic. |

Es un enlace del navegador, **no un envío de YaQu**: no manda nada solo y no pasa por J6 (regla 28). Ninguna llamada a la red nueva.

## El guard de las listas hermanas (`guard:lista-trabajos`): rojo previo, declaración y prueba

1. **Rojo previo, sin la declaración** (sobre esta rama con el arreglo de 986 ya fusionado): `🔴 Clientes ha cambiado MÁS de lo declarado por SCRUM-979 · base 04ffb4183737ee82 ≠ hoy sin lo declarado …`; Presupuestos y Facturas, idénticos.
2. **La declaración** (`PIEZAS_1032`, en `scripts/guard-lista-trabajos.mjs`): DOS piezas, cada una con su forma completa —cada atributo escrito— y las veces que tiene que aparecer (una por fila de cliente): el teléfono como enlace, con su icono de WhatsApp opcional (`<td class="cell-date"><div class="contacto-fila"><a … href="tel:…">n</a>[<a … wa.me … aria-label="WhatsApp" …>💬</a>]</div></td>` → `<td class="cell-date">n</td>`) y el correo como enlace (`<a class="contacto-link" href="mailto:…">c</a>` → `c`). **El móvil no se declara** a propósito: las muestras del guard no lo llevan. **Sin el `>` pegado** (SCRUM-553 cuenta esos extractores y su tope, 20, solo baja: mi primera versión los escribía exactos y lo puso en 24): cada etiqueta deja un hueco `([^>]*)` y el sustituto es una función que solo deshace la pieza si los huecos están vacíos, así que la exactitud no se pierde —un atributo de más no lo absorbe la sustitución—.
3. **Un defecto del comparador que tuve que corregir, y no es relajarlo:** el guard quitaba las piezas declaradas de 979 **solo de HOY** y comparaba con la base «tal cual». Eso valía mientras la base no las trajera; desde que SCRUM-979 está en `main` la base YA las lleva, así que **cualquier cambio de Clientes, aunque fuera el declarado, daba siempre «MÁS de lo declarado»**. Ahora se deshacen **las mismas piezas en los dos lados** y se compara lo que queda: exige lo mismo que antes (el resto, idéntico) y ya no depende de si la base trae lo declarado. Una pieza que la base no tiene no se toca (su patrón no casa).
4. **Medido:** con la declaración, `✅ Clientes trae LO DECLARADO (SCRUM-979 y SCRUM-1032) y nada más · sin esas piezas (2 celdas de cada fila), idéntico a la base sin ellas 571a61ff7a50ea42`. Y seis controles sobre el PRODUCTO, restaurados con `fs`, **todos cazados**: G1 el enlace gana una clase de más · G2 el nombre accesible del WhatsApp cambia de forma · G3 el `<td>` del teléfono gana una clase · G4 el ID gana un espacio (cambio ajeno a lo declarado: cae por la rama «MÁS de lo declarado») · G5 el `<td>` del teléfono gana un atributo (`title`) · G6 el enlace del correo gana un atributo (G5 y G6 prueban que los huecos no absorben nada).

## Verificado en rojo (BASE 5/5)

Tres mutaciones (tope de un ticket S), restauradas con `fs`, **ninguna sobrevive**: M1 `wa.me` con el `+` (cae en 4 pruebas) · M2 los enlaces de la lista dejan de frenar el clic · M3 WhatsApp al fijo aunque haya móvil (3).

## Lo medido en navegador (Edge headless, `docs/prototipos/SCRUM-1032/capturas/`): 0 fallos

Enlaces contados por pantalla (lista: 7 en las tres filas del banco; ficha: 4), todos dentro de la pantalla, sin scroll horizontal de página, y con el área de toque exigida: **44 px de alto a 390** y **36 px a 1280** (el icono 💬 de la lista: 44×44 y 36×36). A 390 la columna de correo de la lista sigue oculta (como ya estaba: `col-hide-mobile`); el correo se ve y se toca en la ficha y a escritorio.

**Coste declarado:** las filas de la lista con datos de contacto crecen, por el área de toque mínima. A 1280: 88 → 145 px (teléfono + móvil + WhatsApp), 88 → 102 px (teléfono + WhatsApp), la vacía no cambia; a 390: 156 → 223 y 179 px. Es lo que cuesta un enlace que se pueda tocar (el guard de objetivo táctil lo exige y no se relaja).

## Errores míos, confesados (A9)

1. Mi primera versión ponía «💬 WhatsApp» como texto en la lista: a 1280 partía el teléfono en dos líneas y añadía 60 px por fila. Pasó a icono con nombre accesible.
2. El foco de tests cazó dos cosas que yo no había mirado, y las dos eran mías: **(a)** llamé `.contacto` a la caja del número y su WhatsApp, y `public/index.html` (la landing) ya usa esa clase sin cargar `styles.css` (SCRUM-378) → ahora `.contacto-fila`; **(b)** `scrum406` exige que cada `wa.me` del dashboard declare de quién es el número, y el mío (`api.js`) no lo estaba → declarado en `WA_DECLARADOS` como del CLIENTE FINAL, que es lo que pide su propio mensaje de error (no se relajó nada del test).
3. **Tres cosas más que cazó la suite entera y no mi foco**, y que un foco por palabras clave no ve: (a) `scrum262` —teléfonos de test de rango real en MI test de 986 (`34600000000`) y en el de este ticket: cayó el CI de 986 antes de que lo viera yo—; (b) `scrum553` —los extractores exactos del guard con el `>` pegado—; (c) `scrum378` y `scrum406` de arriba. **Suite local completa de esta rama: 7.990 pruebas, 7.870 pass, 116 skipped y 4 fail**: 1 era el `553` (arreglado) y 3 son de `scrum939b-trinquete-de-las-skills`, que **fallan igual en mi rama de 986 sin tocar skills y pasan en el CI** (dependen de algo que un worktree local no tiene). Desde este ticket corro la suite entera antes de empujar.
4. Un `deepEqual` sobre un objeto nacido en el contexto del banco falló por el prototipo, y un `doesNotMatch(/null/)` sobre el JSON del resultado casaba con el `"movil": null` legítimo. Los dos eran del test, no del código; ahora se compara por valor y solo sobre lo que se pinta o se enlaza.

## Pendiente

Verificar en yaqu.app tras el merge (lista y ficha de un cliente con teléfono y móvil; que tocar el número no abra la ficha; que WhatsApp abra en pestaña aparte).
