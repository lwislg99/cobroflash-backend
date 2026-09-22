# SCRUM-1059 · Acciones sobre varios clientes a la vez: etiquetar (servidor)

**Medido contra:** `origin/main` = `b5b229d7b6f7b78b24366696f6f84c25748ee27f` · 2026-09-22T08:21:48Z (hora de GitHub, cabecera `Date:` de `gh api -i zen`)
**Rama:** `scrum-1059-etiquetado-masivo`

## Alcance de este PR: solo el punto 1 (añadir/quitar etiqueta)

El ticket tiene tres puntos. Este PR es el servidor del **punto 1**. El punto 3 (exportar la
selección) es su **propio commit** por ser STOP (datos de cliente) — no entra aquí. El front
(pantalla, botones, «contrato del DOM») es S2.

## D1 · Ficheros de J2

El ticket marca ficheros de J2. Se tocó `customersAdmin.routes.ts` (servidor de clientes) —
avisado en un comentario del ticket antes de empezar. No se tocó `filtroClientes.js` (front, S2).

## «Depende de SCRUM-1034» — por qué no bloquea el servidor

1034 (editar etiquetas desde la ficha, front) comparte VALIDACIÓN con este ticket. Esa validación
(`tagsDelCliente.ts`: límite 20×40, comparación sin distinguir mayúsculas, ausente ≠ vacío) **ya
existe** desde SCRUM-580 y es independiente de que 1034 tenga su pantalla construida. El servidor
de este ticket la reutiliza tal cual, sin inventar una segunda decisión.

## Lo que hace

- `src/modules/system/domain/etiquetadoMasivo.ts`:
  - `aplicarEtiquetaMasiva` (PURA): decide qué le pasa a UN cliente — añadir, quitar, o
    declararse sin tocar (ya la tenía / ya tiene 20 / etiqueta vacía / no la tenía). No consulta
    ni escribe nada, así que se prueba sin base.
  - `etiquetarSeleccion`: la orquestación con base — lee los clientes del `merchantId`, aplica la
    función pura a cada uno, y escribe SOLO los que cambian, en una transacción (una fila por
    escritura: cada cliente cambia a un valor DISTINTO, no se puede resolver con un `updateMany`).
- `POST /admin/customers/bulk-tags` — `{ ids, accion: 'add'|'remove', etiqueta }` →
  `{ actualizados, resultados: [{ id, actualizado, motivo? }] }`.
- **Un cliente que no se puede actualizar NO tumba a los demás** (acceptance 2): se declara en
  `resultados` con su motivo y la tanda sigue. Verificado con una selección MIXTA (dos libres, uno
  con 20 etiquetas, uno de otro merchant) en el test con base.
- **Tenencia** (regla 2): un id que no es de este merchant se declara «No encontrado» — no dice
  que el cliente existe en OTRO sitio.
- **NO** hay «avisar a la selección» (sería un envío nuevo, regla 28, ticket aparte).

## El juez: dos ficheros, como el resto de la casa

- `tests/scrum1059-etiquetado-masivo.test.mjs` — 11 tests de `aplicarEtiquetaMasiva`, SIN base,
  corren en cada `npm test`. Cubre: añadir, ya la tenía, límite de 20, que el lleno NO tumba al
  libre de al lado, etiqueta vacía, sin etiquetas previas, quitar (con y sin distinguir
  mayúsculas), quitar la única deja `Prisma.DbNull` (no `[]`) — la MISMA traducción que
  `tagsParaPrisma` usa en el alta y la edición manual.
- `tests/scrum1059b-etiquetado-masivo-postgres.test.mjs` — gateado, declarado en `scrum419`.
  **No se pudo correr en esta sesión**: no hay un Postgres desechable montado en esta
  máquina/turno. Cubre tenencia, selección mixta (dos libres + uno lleno + uno de otro merchant),
  relectura tras escritura (quinto eslabón, SCRUM-580), remove y selección vacía.

`npm run build` limpio. `guards:entrada` 95/95. Censos de tenencia 348/289 en verde.

## Declarado, sin arreglar aquí

- Exportar la selección (punto 3 del ticket): STOP, aparte.
- «Contrato del DOM» del test 6 del ticket: es de la pantalla, S2.
- El front que llama a `bulk-tags` no existe todavía (S2).

## Errores propios

Ninguno de construcción. El intento de verificar en ROJO la validación fiscal-adjacente de
SCRUM-1046 (ticket anterior de este mismo lote) lo bloqueó el clasificador de seguridad del
entorno; aquí no se ha necesitado ese tipo de verificación porque `aplicarEtiquetaMasiva` no toca
nada fiscal ni de emisión, así que el rojo/verde de sus 11 casos se pudo comprobar con normalidad
añadiendo y quitando aserciones mientras se escribían (no queda rastro de eso en el commit final,
solo el resultado).

## Tercera corrección (22-sep, mismo día): `guards de navegador` en rojo, y NO es de este ticket

`@claude` avisó (avisador-rojo) de que el check obligatorio salía en rojo en
`guard:marcadores-en-pantalla` (SCRUM-722), job «guards de navegador (fuera de la tanda)», sobre
el commit `15cc1977`. Medido antes de tocar nada (regla 41): el diff de esta rama no toca
`public/dashboard/js/exportView.js` ni ese guard, así que no lo causó SCRUM-1059. Origen real:
SCRUM-1041 (commit `80b60238`, bloque A) ya en `origin/main` firmó y quitó el marcador
`[PENDIENTE microcopy oficial]` de `exportView.js`, pero solo actualizó el censo de
`tests/scrum402-marcador-no-se-pinta.test.mjs` y no el censo APARTE que lleva
`scripts/guard-marcadores-en-pantalla.mjs` (uno mide el FUENTE, el otro el DOM renderizado). La
entrada `export: 6` quedó caduca en `origin/main` — rompía a cualquier PR sobre main en esa
ventana, no solo a éste. Otra sesión de `@claude` ya lo midió y arregló igual en `origin/main`
(commit `cf6b454d`, sobre la rama de SCRUM-773) antes de que esta rama se actualizara: aquí se
aplica el mismo arreglo —se borra la entrada `export` del `CENSO`, no se pone a 0— para que el
check obligatorio de ESTA rama también pase sin depender de cuándo se actualice con `main`. No se
relaja ninguna aserción: la vista sale del censo porque ya no pinta nada, y si algún día vuelve a
pintar el marcador caerá como «VISTA NUEVA», más estricto que antes.
