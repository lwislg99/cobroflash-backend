# SCRUM-982 · la nota del cliente, a la vista en la ficha del Trabajo

**Fecha:** 21-sep-2026 · **Carril:** S2b (front + una ruta de lectura del servidor) · **Firmas y decisiones:** SCRUM-982 comentario 16065 (orquestador, por delegación del fundador)
**Medido contra:** `origin/main` = `5820ad9259054032ef0966c8101288b9f76e8248` · 2026-09-21T11:06:23Z (cabecera `Date:` de `gh api -i zen`)
**Rama:** `scrum-982-nota-del-cliente` · **Re-medido sobre** `origin/main` `092ccb5a4742ba8c7cc4b1c47b7c62303d713f76` · 2026-09-21T12:06:58Z, ya con el #1573 y el #1574 dentro de la rama (ver «Medido»).

## La víctima

Quien llega a la puerta abre el **Trabajo**, no la ficha del cliente. La nota del cliente
(«timbre roto, llamar al móvil, perro suelto») vive en `Customer.notes` y sólo se leía en la ficha
del cliente: el profesional (o su técnico) llegaba a la puerta sin ella delante.

**Sin víctimas reales:** en producción no hay ningún cliente real (dato del fundador, 21-sep-2026).
Es una mejora de producto pedida, no un defecto en curso.

## PASO 0 · medido antes de escribir una línea

- `git grep -nE "customer\??\.notes" origin/main -- public/dashboard/js` sobre `origin/main`
  `5820ad9259054032ef0966c8101288b9f76e8248` (2026-09-21, 11:06:23 GMT): **2 coincidencias, las dos en
  `customerDetailView.js`** (líneas 71 y 379). Ninguna pantalla de Trabajo la lee.
- Servidor: el `select` del cliente en `serializeJobDetail` era `{ email: true, taxId: true }`, y
  `CUSTOMER_SELECT` (la lista) trae `id, name, phone, mobile`. La nota no llegaba al front ni por la lista
  ni por el detalle.
- Staging (lo midió el orquestador y consta en el comentario 16065): `/version` = `53d756d7`, 15 Trabajos
  con cliente; la nota no viaja ni en la lista ni en el detalle.

## Qué se firmó (comentario 16065) y dónde queda escrito

- Rótulo **«Nota del cliente»**, como etiqueta pequeña, sin dos puntos y sin icono.
- Sin nota, **no hay línea** (ni «—» ni «Sin nota»).
- La nota va en el **detalle** del Trabajo (`notes` en el `select` de `serializeJobDetail`), **no** en
  `CUSTOMER_SELECT`: la lista no la pinta.
- **El técnico también la ve**: es quien llega a la puerta.
- Test obligatorio de «ninguna ruta pública» y un caso de banco con una nota larga a 360 px.

La firma delegada se registra en `docs/microcopy/2026-09-21-SCRUM-982-nota-del-cliente.md`, con la línea
que fija su README.

## Qué cambia

| dónde | qué |
|---|---|
| `src/modules/jobs/app/routes/jobs.routes.ts` | `notes` en el `select` del cliente de `serializeJobDetail` y en el `customer` que devuelve. **No** en `CUSTOMER_SELECT` |
| `public/dashboard/js/jobRailBlocks.js` | la línea de nota del bloque CLIENTE, con `etiqueta` = el rótulo firmado; se recortan los extremos y nada más (los saltos de dentro son del profesional); el bloque también aparece si el cliente sólo tiene nota; exporta `ROTULO_NOTA_DEL_CLIENTE` |
| `public/dashboard/js/jobDetailView.js` | la clase `detail-rail-linea--nota` en esa línea |
| `public/dashboard/css/styles.css` | tres reglas de `.detail-rail-linea--nota` (etiqueta encima del texto, `white-space: pre-line` para respetar los saltos, `overflow-wrap: anywhere` para que una URL larga no ensanche el rail, sin recorte) y `margin-top: 8px` = el `sm` de `DESIGN.md`. **Cero tokens nuevos** |
| `tests/scrum982-la-nota-del-cliente-en-el-trabajo.test.mjs` | 15 tests (abajo) |
| `docs/master/evidencias/scrum982/` | sonda de navegador, banco de mutaciones, capturas y sus salidas |

La nota se pinta como **texto** (`textContent`), entera, con los saltos que escribió el profesional. **No
hizo falta un «ver más»**: medida con una nota de 6 líneas (una URL de 100 caracteres dentro) a 1280, 390
y 360 px, se lee completa y el rail no desborda. Por eso no se ha inventado ningún texto nuevo.

## Lo que mide el test (15)

- el rótulo literal y su forma (sin dos puntos);
- el constructor del rail: con nota, sin nota, sólo espacios, extremos;
- **AST del servidor**: `notes` está en el `select` de `serializeJobDetail` y en el `customer` devuelto, y
  **no** en `CUSTOMER_SELECT`;
- 🔒 **ninguna ruta pública** (por AST, sin modificar el camino): `jobs.routes` exporta sólo `default`;
  `serializeJobDetail` sólo se llama desde handlers de `router.<verbo>`; de los ficheros de `src/` sólo
  `app.ts` importa `jobs.routes`; `jobsRouter` sólo se monta con `mountAdmin(app, '/admin/jobs', …)` y
  DESPUÉS de `app.use('/admin', requireAuth)`;
- el DOM montado en el banco de vistas: la nota entera y sin marcado (compara **censos** contra la misma
  ficha con una nota sin marcado);
- el CSS.

## Medido, con su población

- `npm run build` **EXIT 0**, sobre el árbol fusionado (`66ec219584b28d36f0525f24495060eb966f03ab`).
- Test de 982: **15/15**, 0 caen, 0 saltados — en el árbol previo al merge y otra vez en el fusionado.
- **Rojo** — `docs/master/evidencias/scrum982/mutar-nota-982.mjs`: BASE sin mutar 15/15 y **13 mutaciones,
  las 13 cazadas**, cada una con su `git diff --numstat` al lado y el árbol restaurado. Dos pasadas:
  - sobre `38849170fb91c9e1f8deb811c7729b8a80278763`, con `origin/main` `5820ad92…` dentro
    (`salida-mutaciones-21sep.txt`);
  - sobre `995e555c614e401375eb16ad55d29dc18593c449`, con `origin/main`
    `092ccb5a4742ba8c7cc4b1c47b7c62303d713f76` dentro, 2026-09-21 12:08:48 GMT
    (`salida-mutaciones-fusionado-21sep.txt`).
- **Navegador (Edge real)** — `medir-nota-en-navegador.mjs`: **114 comprobaciones** (2 estados × 3 anchuras:
  1280, 390, 360). DESPUÉS: **0 caídas**. ANTES (control negativo, la hoja sin las reglas de la nota): **11
  caídas, por anchura 5 / 3 / 3** — cae en cada una. Dos pasadas, mismo resultado
  (`salida-navegador-21sep.txt` sobre `38849170…`, y `salida-navegador-fusionado-21sep.txt` sobre
  `66ec2195…`, 12:06:58 GMT). Además, teléfono y WhatsApp siguen a 44 px con la nota debajo. Capturas
  `nota-{antes,despues}-{1280,390,360}.png`.
- Grupo de tests que nombran rail, `jobRailBlocks`, `jobDetailView`, `jobs.routes`, `styles.css`,
  microcopy, `serializeJobDetail` o `CUSTOMER_SELECT`: **162 ficheros, 1.496 tests, 1.491 pass, 0 fail, 5
  saltados**, medido sobre el árbol previo al merge del #1573.

## Errores propios

1. **Un test que cayó contra código correcto.** La primera versión de «sin marcado» buscaba `<b>` en TODA la
   ficha, y la ficha ya lleva `<b>` (las cifras de la franja del dinero). Medía otra cosa. Ahora compara
   **censos** contra la misma ficha con una nota sin marcado.
2. **Capturas tapadas por el asistente de bienvenida.** El banco contesta `/admin/merchant` sin
   `onboardingCompleted` y `#onboarding-backdrop` cubría la ficha. Las medidas del DOM no se veían
   afectadas (no dependen de lo que se ve); la sonda lo quita antes de fotografiar.
3. **Un SHA de `origin/main` leído después de que otra sesión hiciera fetch.** Los refs se comparten entre
   worktrees: las cabeceras de las evidencias decían `70bbd54c` y lo medido era `5820ad92`. Lo cacé
   releyendo y quedó corregido en `ba94cb15`. Regla que sale: el SHA se lee en el MISMO comando que la
   medida.
4. **El banco de mutaciones se negó a correr** en su segunda pasada (`EXIT=2`) porque yo había dejado la
   salida de la sonda sin comitear. Es su guard (A23 nº 9) haciendo lo suyo; se comiteó y se repitió.

## Lo que NO cubre

- **La suite completa no se ha corrido en local** (sin turno): la corre el PR.
- **Sin verificar en staging tras el despliegue.** Hace falta una autorización nueva del orquestador (cliente
  con nota larga + un Trabajo suyo, leer `/admin/jobs/:id` y mirar el rail). La de 983 no vale.
- Una nota **enorme** (miles de caracteres) no se ha medido: sólo la de 6 líneas con una URL de 100. Si
  algún día hiciera falta, sería un «ver más», y su literal iría a firma.
