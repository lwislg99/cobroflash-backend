# SCRUM-1003 · «Guardar en mis contactos» (.vcf) en la ficha del cliente

**Medido contra:** `origin/main` = `5588e3263847bd40ea906d325e4f83c883c24e6e` · 2026-09-22T08:42:00Z (hora de GitHub, cabecera `Date:` de `gh api -i zen`).
**Rama:** `scrum-1003-vcard-como-llegar`, montada sobre `scrum-1033-ficha-datos-y-etiquetas` = `bbeb3bb83cc31d2f2255be877ef71501c37bde34` (aún no en `origin/main`; SCRUM-1004 va en esta misma rama, encima de aquélla — depende de sus chips de dirección/NIF, PR B).
**Microcopy:** ✅ **texto firmado** por el orquestador por delegación del fundador (22-sep-2026, comentario de Jira en SCRUM-1003): botón **«Guardar en mis contactos»**.

## Paso 0: el defecto existía hoy

`git grep -i vcard` sobre `src/` y `public/` = 0 coincidencias (confirmado de nuevo antes de construir). La ficha del cliente no tenía forma de guardar el contacto en el móvil salvo copiar los datos a mano.

## Sobre el STOP de «datos de clientes (export/borrado)»

CRM.md (§5, CRM-03) pedía confirmar que esto no es el «export» del STOP de AA1.4. Lo dejé escrito en un comentario de Jira antes de construir: esto descarga, en el navegador, los datos de UN cliente concreto que la ficha YA muestra al merchant — no un listado, no bulk, no otro merchant. Lo entiendo como fuera de ese STOP (que es sobre operaciones admin/bulk); queda escrito para que alguien con más contexto lo corrija antes del merge si no es así.

## Lo que cambia

| fichero | qué |
|---|---|
| `public/dashboard/js/customerDetailView.js` | `construirVCard(customer)` — función PURA que arma un VCARD 3.0 (`N`/`FN`/`TEL` fijo y móvil/`EMAIL`/`ADR`) con **solo** lo que la ficha ya muestra: nombre, teléfono, móvil, email, dirección de facturación. Cada línea es condicional (ausente ≠ vacío: sin dato, sin línea). `nombreDeFicheroVCard(customer)` sanea el nombre para el nombre de fichero. Botón `#btn-vcard-360` en la cabecera: genera el `Blob`, `URL.createObjectURL`, `<a download>`, `click()`, `revokeObjectURL` a los 10s — el mismo patrón que ya usa `api.js` para descargar ficheros del servidor. Sin endpoint nuevo, sin esquema. |
| `tests/scrum1003-1004-vcard-como-llegar.test.mjs` (nuevo, compartido con SCRUM-1004) | `construirVCard` con cliente completo (los 5 datos, escapado RFC 6350 de comas) y casi vacío (ninguna línea de más); `nombreDeFicheroVCard` con caracteres que rompen un nombre de fichero; el botón existe con el texto firmado y está enganchado. |

## Por qué el click NO se ejercita entero en el banco de vistas (límite declarado)

`tests/_banco-vistas.mjs` deja `Blob` como `class {}` (stub) — es un límite conocido y escrito del banco, no un hueco silencioso. Por eso `construirVCard`/`nombreDeFicheroVCard` son funciones PURAS, separadas del `onclick`: el texto del `.vcf` se prueba entero sin tocar `Blob`/`URL.createObjectURL`; el `onclick` solo se comprueba por SUELO (existe, está enganchado). El click real (descarga en el móvil) queda para la verificación en yaqu.app.

## Verificado en rojo

Mutación en `construirVCard` (cambié el orden `billingCity`/`billingProvince` del `ADR`): el test de «un cliente completo» cayó (esperaba `Getafe;Madrid`, recibió `Madrid;Getafe`); restaurado, vuelve a verde.

## Pendiente

Verificar en yaqu.app: abrir un cliente con teléfono/móvil/email/dirección, pulsar el botón y comprobar que el .vcf se guarda como contacto (Android/iOS) con los campos correctos.
