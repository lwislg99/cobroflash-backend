# SCRUM-980 · El historial de trabajo en la ficha del cliente (v1 sin fotos)

Partido en dos PR, decisión de S1 comunicada al orquestador: **primero la ruta con su rojo**
(esta), **después la pestaña** (apéndice más abajo cuando entre).

## Mitad 1 · la ruta `GET /admin/customers/:id/historial`

**Medido contra:** `origin/main` = `6b0d92e425157ff3a8c1512bccd224f7e000e03d` · 2026-09-21T08:02:48Z (hora de GitHub, cabecera `Date:` de `gh api -i zen`)
**Rama:** `scrum-980-historial-ruta`

### Medido antes de construir

- `GET /admin/jobs` trae 200 filas y solo filtra por operario; `GET /admin/partes` **no recorta por
  rol** (el técnico ve los partes de todo el negocio). No había forma de pedir «los trabajos de este
  cliente».
- `Job` no tiene relación declarada con `Quote` (solo `quoteId`), `Albaran` no lleva `customerId` y
  `ParteTrabajo.customerId` es opcional y **no guarda autor**.

### Lo que hace (`src/modules/system/domain/historialDelCliente.ts`, ruta fina en `customersAdmin.routes.ts`)

- Cliente por `(id, merchantId)` → si no es suyo, `null` y la ruta da **404**.
- Sus trabajos por `(merchantId, customerId)`, **20 por página** con cursor (`?despuesDe=<jobId>`),
  y `siguiente` solo si hay más.
- Título de cada trabajo por **`tituloDeTrabajo()`** (SCRUM-944b), nunca `Job.titulo` crudo: el
  presupuesto se trae aparte, por sus ids y con `merchantId`.
- Partes de esos trabajos y, **sin recorte**, los **sueltos** del cliente (`jobId` nulo).
- Albaranes de esos trabajos con **cuántas fotos** tiene cada uno (`attachment.groupBy`,
  `entityType 'albaran'`, con `merchantId`). v1 no manda ninguna foto.
- **Próxima visita:** el trabajo `agendado` con `scheduledAt` más cercano **a partir de ahora**, entre
  todos los que quien mira puede ver. Sin ninguna, la clave **no viaja** (ausente no es cero).
- **`merchantId` en cada consulta**, también en las que van por ids ya acotados.
- **Técnico** (`seesOnlyOwnJobs`): sus trabajos por los tres ejes de SCRUM-650, los partes de ESOS
  trabajos y **ningún parte suelto** (sin autor en el esquema, no se le puede atribuir).
- Declarada en `adminRouteDeclarations.ts` (`TECNICO_ALLOWED`). Sin índice nuevo.

### El juez: `tests/scrum980-historial-del-cliente.test.mjs`

Gateado (banco desechable o staging), declarado en `GATEADOS_DECLARADOS` de 419. Rojo contra main:
el módulo no existía (`ERR_MODULE_NOT_FOUND`). Verde contra un Postgres 16 propio: **1 pass · 0 fail · 0 skipped**.
El peso lo llevan las mutaciones sobre el `dist`, con la base en verde antes y después:

| mutación | cae con |
|---|---|
| M1 · sin el recorte del técnico | «el técnico ve trabajos que no son suyos» |
| M2 · la consulta de trabajos sin `merchantId` | el suelo: «debía ver 4 trabajos y ve 5: INTRUSO…» |
| M3 · partes sueltos también al técnico | «al técnico le sale un parte suelto, que no tiene autor» |
| M4 · «próxima» admite fechas pasadas | «la próxima visita no es el agendado futuro más cercano» |

### Declarado, sin arreglar aquí

- **`GET /admin/partes` no recorta por rol**: un técnico ve en esa lista los partes de todos. Aquí
  no se replica; es un hallazgo de otro alcance y se reporta.
- Los partes sueltos no se paginan (son del cliente, no de la página de trabajos).

## Apéndice SCRUM-980b · Mitad 2: la pestaña «Trabajos» y la «Próxima visita» en la ficha del cliente

**Medido contra:** `origin/main` = `092ccb5a4742ba8c7cc4b1c47b7c62303d713f76` · 2026-09-21T12:05:41Z (hora de GitHub, cabecera `Date:` de `gh api -i zen`; ese `main` va mezclado dentro de la rama, sin conflictos, AA2)
**Rama:** `scrum-980b-historial-pestana` · segunda mitad, después de #1570 (la ruta) y de #1568 (SCRUM-983, que toca el mismo fichero)

### Lo que trae

- **`public/dashboard/js/customerDetailView.js`:** la tercera pestaña de la ficha 360, con el mismo
  mecanismo que Presupuestos y Facturas. Lee `GET /admin/customers/:id/historial` **en paralelo** a `/detail`
  y **con su propio `.catch`**: si el historial falla, la ficha sale como antes, sin la pestaña.
  Filas Fecha · Trabajo · Estado · Documentos; el título entra **como texto** (nunca `innerHTML`), el estado sale
  de `jobStatusMeta`; enlaces al trabajo, al parte y al albarán, este con «📷 n» y su `aria-label` («3 fotos»);
  «Ver más trabajos» **acumula** la página siguiente (cursor `despuesDe`) y el título de la pestaña pasa de
  «(20+)» a «(24)»; «Partes sin trabajo» solo si la ruta los manda (admin y propietario); y la línea
  «Próxima visita: …» de la cabecera **solo si viaja la clave** (ausente no es cero). Textos: los firmados en
  `docs/microcopy/2026-09-21-SCRUM-980-historial-del-cliente.md` (comentario 16061).
- **`public/dashboard/js/app.js`:** `parte-detail` entra en `DETALLES` (la sexta ficha), con el aviso P8
  «Ese parte ya no existe.» (comentario 16062, `docs/microcopy/2026-09-21-SCRUM-980-aviso-del-parte.md`) y
  vuelta a Trabajos. Sin esa entrada, **recargar estando en la ficha del parte la perdía**.
- **`public/dashboard/css/styles.css`:** siete clases `.historial-*`. Cero `style=` en línea nuevos
  (713c: el techo sigue en 340 y pasa). Las dos de celda llevan `.table td.` delante porque `.table td` (y su
  versión móvil) pone su propio padding y color y **una clase sola perdía**, que es lo que el estilo en línea no hacía.
- **`tests/scrum832-atras-vuelve-a-la-lista.test.mjs`:** el suelo pasa de cinco a **seis** fichas declaradas.
- **Microcopy:** los registros de 967 y 974 pasan de bloques con sangría a líneas de cita (`> …`), que es
  lo que lee `tests/_microcopy-aprobada.mjs`.

### El juez: `tests/scrum980b-pestana-trabajos.test.mjs`

Sin base de datos y en cada `npm test`: la ficha 360 **real** montada en el banco de vistas, midiendo el
estado **después de pulsar** (A6). 4 tests.

- **Rojo contra `main`: 0 de 4.** Medido en esta sesión (21-sep, entre las 12:05Z y las 12:16Z, hora de GitHub) poniendo las versiones de `origin/main` de
  `customerDetailView.js`, `app.js` y `styles.css` sobre la rama (`git diff --cached --numstat`: 1/171, 0/4 y 0/14, o
  sea que la inyección **sí se aplicó**): `# tests 4 · pass 0 · fail 4`. Revertido con `git restore --source=HEAD`,
  árbol limpio.
- **Mutaciones sobre `customerDetailView.js`** (base 4/4 antes y 4/4 después; `numstat` 1/1 en cada una):

| mutación | cae con |
|---|---|
| M1 · la línea «Próxima visita» se pinta siempre | «NEGATIVOS: sin próxima visita no hay línea…» |
| M2 · sin el `.catch` de `/historial` | «NEGATIVOS: … si `/historial` falla, la ficha sale igual» |
| M3 · «Ver más trabajos» **sustituye** en vez de acumular | «la ficha: próxima visita, pestaña, filas, enlaces, fotos, «Ver más»…» |
| M4 · el título del trabajo por `innerHTML` | «la ficha: …» (el título sale como TEXTO) |

### La sonda de Edge, después de pulsar (`docs/master/evidencias/scrum980/`)

Banco desechable (Postgres 16 portable, base `*_test` en loopback) + el servidor del worktree con el login de QA
+ `puppeteer-core` sobre Edge. Reproducible: `seed.mjs` → `servidor.mjs` → `sonda.mjs` (`conn.mjs` monta la URL
desde `PGHOST/PGPORT/PGUSER/PGDATABASE`, sin cadena literal). La salida de la pasada final va en git:
**`sonda-pasada-final.txt` · población: 3 anchos (1280, 390, 360) × 31 comprobaciones = 93 · 0 rojos · `EXIT=0`.**
Cada comprobación se hace sobre el DOM ejecutado tras pulsar: 20 filas, columnas, «Terminado», «📷 3» / «3 fotos»,
estilos **computados** iguales a los que llevaban en línea, «Ver más» 20 → 24 con «Trabajos (24)» y sin botón,
enlace del parte `#parte-detail/13` y **recargar en él no lo pierde**, parte inexistente → «Ese parte ya no
existe.», «Sin trabajos» (padding 24, centrado), sin «Próxima visita» cuando no hay, sin scroll horizontal de
la página, sin errores de consola ni respuestas ≥ 400 salvo las declaradas.

**Los 4 rojos de la 4.ª pasada eran de la SONDA, no de la pantalla.** «Ver más trabajos» «no tocable en su
centro» a 1280 y a 390, la pestaña del cliente sin trabajos a 390, y a 360 la pestaña que «no abre filas». Causa
medida: `html { scroll-behavior: smooth }` (`styles.css`, línea 113): `scrollIntoView` a secas mide **a medio
desplazamiento**. Con la sonda volcando *qué hay encima* (`encima`, con su caja): en «Ver más», `elementFromPoint` daba
`null` porque el centro caía en y=1924 con la ventana en 800; a 390 el «?» de la guía (`#tut-help-btn`, fijo)
aún estaba encima porque el control no había terminado de subir; y a 360 el clic **cayó en ese «?»**, abrió «Guía de
inicio» y tapó la pantalla entera para el segundo intento. Entre la 4.ª y la 5.ª pasada **solo cambió la sonda**
(`behavior: 'instant'` y dos fotogramas de espera); ni una línea de `public/` ni de `src/`. Un instrumento que solo
sabe callar no es un instrumento: esta sonda **sí sabe decir «no»** (dijo cuatro), y se separó lo suyo de lo
del producto midiendo el punto, no leyendo el CSS.

### Declarado, no defecto de esta pantalla

- **360 px ya está medido** (en la 3.ª pasada no lo estaba): cabe, y no hay scroll horizontal de la página.
- **A 390 y 360 el carril de la tabla mide 520 dentro de 364 y 334:** la columna Documentos se ve deslizando
  dentro de la tarjeta, igual que en Presupuestos y Facturas. Es de `.table-scroll`, no de esta pestaña.
- **Observación, sin ticket, del botón de guía (`tutorial.js`, no de esta pestaña):** sin desplazar y con la
  ventana a 390×800, la caja de la pestaña «Trabajos» (269,718 · 109×54) y la del «?» fijo (322,732 · 48×48) **se
  solapan**: la mitad derecha de la tercera pestaña abre la guía. Su parte izquierda sigue siendo tocable y al
  desplazar el «?» deja de taparla. Antes de esta pestaña no ocurría (las dos anteriores terminan en x≈254).
  Se reporta al orquestador; no se toca aquí (otro carril).
- **Ruido de red declarado en la sonda:** el 401 de `/admin/me` antes del login (la página de login pregunta por
  la sesión) y el 404 de `favicon.ico`. Ninguno es de esta pantalla.
- **`GET /admin/partes` sin recorte por rol** sigue en pie (hallazgo de la mitad 1); no se replica aquí.
