# SCRUM-1032 · Llamar, escribir por WhatsApp o mandar un correo al cliente con un toque, desde la lista y la ficha (y ver también su móvil)

**Medido contra:** `origin/main` = `b6cde0517649d991a1b08eabb50017a81a03acfb` · 2026-09-21T17:27:29Z (hora de GitHub, cabecera `Date:` de `gh api -i zen`).
**Rama:** `scrum-986-chip-lista-y-contacto-1032` (PR A del primer lote CRM, junto con SCRUM-986). Bloque CRM (SCRUM-977), CRM-02; diseño en `docs/producto/CRM.md` §5.
**Ficheros de J2:** `customersView.js` y `customerDetailView.js`; comentario de aviso (decisión D1) puesto el 21-sep-2026 a las 17:27Z en este ticket (16252). No se toca `whatsapp.ts`, ni plantillas de Meta, ni `jobRailBlocks.js` (solo se consultó), ni el esquema.
**Microcopy:** ninguna nueva. El número y el correo son el dato mismo (el enlace lo lleva por texto); «WhatsApp» y su icono 💬 son el rótulo ya en uso en el bloque CLIENTE del panel del Trabajo (`jobRailBlocks.js:61`), y `Móvil (WhatsApp)` ya nombraba el campo en el formulario. **Pide confirmación del orquestador** que «WhatsApp» (visible en la ficha; nombre accesible y tooltip del icono en la lista) cuente como firmado por su uso allí.

## Paso 0: el defecto existía hoy

Contado con el banco de vistas sobre `origin/main`: la lista de Clientes y la ficha pintan **0 enlaces** `tel:` / `wa.me` / `mailto:`; el móvil no se pinta en la lista (`customersView.js` solo leía `c.phone`); en la ficha el teléfono y el correo son texto plano. Test escrito antes del arreglo: **5 de 5 en rojo**.

## Lo que cambia

| fichero | qué |
|---|---|
| `public/dashboard/js/api.js` | `contactoDelCliente({phone, mobile, email})`: la pieza compartida. Normaliza como el servidor (`normalizePhone`: espacios, guiones, paréntesis, puntos, `+`/`00` delante; 8–15 dígitos o no es teléfono). `wa.me` lleva **solo dígitos**. `tel:` lleva `+` si el número ya trae prefijo (lo escribió con `+`/`00`, o tiene 11 dígitos o más, que es cómo se guardan: `34600000000`); uno corto se marca tal cual, **sin inventarle un país**. WhatsApp va al móvil y, si no hay, al teléfono. Móvil y teléfono iguales → un solo enlace. Correo: se enlaza tal cual, y solo si parece un correo. Sin dato válido, `null`: nunca un botón muerto. |
| `public/dashboard/js/customersView.js` | la celda de teléfono muestra teléfono y, si lo hay y es otro, móvil; WhatsApp como icono 💬 con nombre accesible «WhatsApp» (la lista va justa de ancho); el correo, enlace. Los enlaces frenan el clic (`stopPropagation`): la fila entera abre la ficha. Sin ningún teléfono, «sin teléfono» como hasta hoy. |
| `public/dashboard/js/customerDetailView.js` | la cabecera: teléfono, móvil, «💬 WhatsApp» y correo como enlaces. Lo que no es un número o un correo se pinta como antes, sin enlace. |
| `public/dashboard/css/styles.css` | `.contacto` / `.contacto-link`: subrayado suave y el área de toque de AB6 (44 px hasta 768, 36 por encima). |
| `tests/scrum1032-contacto-con-un-toque.test.mjs` (5 pruebas) | A: cada caso límite del ticket con su resultado exacto (espacios, sin prefijo, +34/0034/paréntesis, extranjero, móvil = teléfono, distintos → WhatsApp al móvil, solo teléfono, correo con mayúsculas) y que sin dato válido salgan `null` y nunca «undefined»/«null» en un texto o un `href`. B: la lista, una fila con datos y otra vacía sin ningún enlace. C: la ficha, completa, vacía y con dato raro. D: los enlaces de la lista frenan el clic. |

Es un enlace del navegador, **no un envío de YaQu**: no manda nada solo y no pasa por J6 (regla 28). Ninguna llamada a la red nueva.

## Verificado en rojo (BASE 5/5)

Tres mutaciones (tope de un ticket S), restauradas con `fs`, **ninguna sobrevive**: M1 `wa.me` con el `+` (cae en 4 pruebas) · M2 los enlaces de la lista dejan de frenar el clic · M3 WhatsApp al fijo aunque haya móvil (3).

## Lo medido en navegador (Edge headless, `docs/prototipos/SCRUM-1032/capturas/`): 0 fallos

Enlaces contados por pantalla (lista: 7 en las tres filas del banco; ficha: 4), todos dentro de la pantalla, sin scroll horizontal de página, y con el área de toque exigida: **44 px de alto a 390** y **36 px a 1280** (el icono 💬 de la lista: 44×44 y 36×36). A 390 la columna de correo de la lista sigue oculta (como ya estaba: `col-hide-mobile`); el correo se ve y se toca en la ficha y a escritorio.

**Coste declarado:** las filas de la lista con datos de contacto crecen, por el área de toque mínima. A 1280: 88 → 145 px (teléfono + móvil + WhatsApp), 88 → 102 px (teléfono + WhatsApp), la vacía no cambia; a 390: 156 → 223 y 179 px. Es lo que cuesta un enlace que se pueda tocar (el guard de objetivo táctil lo exige y no se relaja).

## Errores míos, confesados (A9)

1. Mi primera versión ponía «💬 WhatsApp» como texto en la lista: a 1280 partía el teléfono en dos líneas y añadía 60 px por fila. Pasó a icono con nombre accesible.
2. Un `deepEqual` sobre un objeto nacido en el contexto del banco falló por el prototipo, y un `doesNotMatch(/null/)` sobre el JSON del resultado casaba con el `"movil": null` legítimo. Los dos eran del test, no del código; ahora se compara por valor y solo sobre lo que se pinta o se enlaza.

## Pendiente

Verificar en yaqu.app tras el merge (lista y ficha de un cliente con teléfono y móvil; que tocar el número no abra la ficha; que WhatsApp abra en pestaña aparte).
