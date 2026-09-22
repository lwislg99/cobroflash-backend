# SCRUM-1033 · La cabecera de la ficha 360 no enseñaba NIF/CIF, dirección, referencia interna ni etiquetas

**Medido contra:** `origin/main` = `5588e3263847bd40ea906d325e4f83c883c24e6e` · 2026-09-22T08:12:34Z (hora de GitHub, cabecera `Date:` de `gh api -i zen`).
**Rama:** `scrum-1033-ficha-datos-y-etiquetas` (PR B del segundo lote CRM, junto con SCRUM-1034: mismo bloque de pantalla, mismo `select`).
**Microcopy:** ninguna nueva en este ticket. Los rótulos de los chips («NIF/CIF», «Dirección», «Referencia») son etiquetas de campo, no textos de producto; el único texto de producto que entra en este PR es el de SCRUM-1034, firmado aparte.

## Paso 0: el defecto existía hoy

`GET /admin/customers/:id/detail` no traía `tags`, `billingAddress/City/PostalCode/Province/Country` ni `internalRef` en su `select` (`src/modules/system/app/routes/customersAdmin.routes.ts`), así que la ficha 360 no podía pintar ninguno de los cuatro aunque el cliente los tuviera guardados: NIF/CIF sólo se veía abriendo «Editar», y los otros tres no se veían en ninguna parte del panel salvo el importador CSV.

## Lo que cambia

| fichero | qué |
|---|---|
| `src/modules/system/app/routes/customersAdmin.routes.ts` | el `select` de `GET /:id/detail` gana `tags`, `billingAddress`, `billingCity`, `billingPostalCode`, `billingProvince`, `billingCountry`, `internalRef`. **El `where` no se toca**: sigue `{ id, merchantId: req.merchantId }` — un cliente de otro merchant sigue sin ser visible (test AST, no DB). |
| `public/dashboard/js/customerDetailView.js` | bloque `#c360-meta` bajo la cabecera: chips `.badge.badge-slate` de NIF/CIF, Dirección (los 5 campos unidos en una línea) y Referencia — **solo si el cliente tiene el dato** (ausente ≠ vacío). Las etiquetas se pintan con el componente YA existente `montarEtiquetasDelDocumento` (SCRUM-595), pasándole el cliente y el endpoint del PUT general (ver SCRUM-1034). |
| `public/dashboard/css/styles.css` | `.c360-chips` y `.c360-tags-limite`: la fila de chips y el aviso del límite, como CLASES — no como `style.cssText` desde JS (regla 4; ver «Errores míos» abajo). |
| `tests/scrum983-la-ficha-360-carga-lo-que-edita.test.mjs` (+2 pruebas) | ④ los siete campos nuevos están en el `select`. ⑤ AST: el `where` de `prisma.customer.findFirst` en `/:id/detail` sigue llevando `merchantId: req.merchantId` literal — el caso "un técnico (u otro merchant) no ve el cliente ajeno" que pedía el ticket, medido sin DB (A2/A3), igual que los censos de tenencia de SCRUM-289/348. |
| `tests/scrum1033-1034-cabecera-etiquetas-cliente.test.mjs` (nuevo, 6 pruebas) | cliente completo → los cuatro chips y el aviso del límite se pintan con sus valores; cliente casi vacío → NINGUNO de los tres chips condicionales se pinta y no aparece la palabra «null» ni «undefined» en la cabecera (ver SCRUM-1034 para las dos pruebas de guardado). |

## Verificado en rojo

Quité `tags` del `select` y confirmé que `SCRUM-1033 · 🔴 el select del /detail trae etiquetas, dirección y referencia interna` cae (`actual: ['tags'], expected: []`); lo restauré y volvió a verde. No repetí la mutación sobre el `where` (quitar `merchantId`): el clasificador de permisos de la sesión la bloqueó por debilitar tenencia real, y es la decisión correcta — se deja sin ejercitar en rojo real, pero el AST del test la habría cazado igual (mismo mecanismo que SCRUM-289/348).

## Errores míos, confesados (A9)

Mi primera versión escribía `chipsFila.style.cssText` y `limiteTags.style.cssText` desde JS — dos estilos en línea nuevos. `SCRUM-713c` (el trinquete de estilos escritos desde JS) subió de 340 a 342 y cayó en la suite completa. Se corrigió sacando las dos reglas a `styles.css` como `.c360-chips`/`.c360-tags-limite`: la regla 4 («ni un estilo en línea») también aplica a lo que JS escribe en `style`, no solo al marcado.

## Pendiente

Verificar en yaqu.app tras el merge (ficha de un cliente con NIF, dirección y etiquetas ya guardados).
