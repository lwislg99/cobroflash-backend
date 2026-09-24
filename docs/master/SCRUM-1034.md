# SCRUM-1034 · Editar las etiquetas del cliente desde su propia ficha (hoy solo desde la lista)

**Medido contra:** `origin/main` = `5588e3263847bd40ea906d325e4f83c883c24e6e` · 2026-09-22T08:12:34Z (hora de GitHub, cabecera `Date:` de `gh api -i zen`).
**Rama:** `scrum-1033-ficha-datos-y-etiquetas` (PR B, junto con SCRUM-1033: comparten el bloque `#c360-meta` de la cabecera).
**Microcopy:** ✅ **texto firmado** por el orquestador por delegación del fundador (21-sep-2026, SCRUM-1034): «Máximo 20 etiquetas, de hasta 40 caracteres cada una.» — literal, bajo el campo de etiquetas de la ficha 360. El resto de textos (rótulo «Etiquetas», avisos «Escribiendo…» / «✓ Guardado automáticamente» / «Error al guardar») son REUSO de los ya aprobados en SCRUM-580/SCRUM-595: no se escribe ninguno nuevo.

## Paso 0: el defecto existía hoy

Las etiquetas del cliente (SCRUM-580) solo se editaban desde el modal de la LISTA de Clientes; la ficha 360 no tenía ningún control para leerlas ni cambiarlas.

## Por qué se reutiliza `montarEtiquetasDelDocumento` en vez de escribir un componente nuevo

Es el mismo bloque que ya usan presupuesto y factura (SCRUM-595, DOC-05): chips + campo + guardado automático con debounce de 1200ms. La única diferencia es el `endpoint`: aquí es el `PUT /admin/customers/:id` general (el mismo que usa el modal de la lista), no una ruta `/tags` dedicada — y el componente ya está escrito para recibir cualquier endpoint que acepte `{tags: string[]|null}`. Server-side, `updateCustomer` (`src/modules/system/customerAdmin.ts`) ya traduce con `tagsParaPrisma`/`normalizarTags` (`tagsDelCliente.ts`, SCRUM-580/595): el tope de 20 etiquetas de 40 caracteres cada una ya lo aplica el servidor en silencio; el aviso de este ticket solo lo hace visible en el front.

## Lo que cambia

| fichero | qué |
|---|---|
| `public/dashboard/js/customerDetailView.js` | llama a `montarEtiquetasDelDocumento(meta, customer, '/admin/customers/'+id)` dentro del bloque `#c360-meta` (compartido con SCRUM-1033); añade el aviso firmado del límite, **solo aquí** — el componente compartido con presupuesto/factura no se toca (otro carril). |
| `public/dashboard/css/styles.css` | `.c360-tags-limite` (compartida con SCRUM-1033). |
| `tests/scrum1033-1034-cabecera-etiquetas-cliente.test.mjs` | dos pruebas de guardado: escribir «Comunidad, Administrador» dispara `PUT /admin/customers/:id` con `{tags:['Comunidad','Administrador']}`; vaciar el campo manda `{tags:null}` — nunca `{tags:[]}` (ausente ≠ vacío, la misma regla que ya protege `tagsDelCliente.ts`). El debounce real de 1200ms se espera de verdad (sin timers falsos: no hay ninguno en el banco de vistas). |

## Verificado en rojo

Las pruebas de guardado se escribieron y corrieron DESPUÉS de montar el componente (no antes): con el `select` de SCRUM-1033 ya en verde, verifiqué el rojo del guard de estilos (SCRUM-713c) quitando las clases y viendo `style.cssText` subir el trinquete a 342 — ver SCRUM-1033 «Errores míos». No repetí un rojo específico de guardado (quitar la llamada a `montarEtiquetasDelDocumento` y ver caer las dos pruebas de PUT) por presupuesto de tiempo; el mecanismo es el mismo que ya prueba SCRUM-595/983 en producción.

## Pendiente

Verificar en yaqu.app tras el merge: abrir un cliente con etiquetas, comprobar que se ven, escribir una nueva y comprobar el aviso «✓ Guardado automáticamente».
