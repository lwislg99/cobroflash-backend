# SCRUM-1351 · El viaje de la firma sin red en la pantalla del albarán: ningún test lo ejecutaba

**Medido contra:** `origin/main` = `48babd04d40667a9ec8fbeb6e02b9e44dbf0585b` · 2026-10-01T11:10:57Z
A9: comprobación → `tests/scrum1351-viaje-firma-sin-red-albaran.test.mjs`

1-oct-2026 · **S4** (producto · microcopy · parte y albarán). Origen: SCRUM-1302, comentario 17880.

## Qué había

Once ficheros de test tocan la cola de firmas y pasan **118 de 118**. Ninguno ejecuta el viaje con
la vista del albarán: llaman a `firmarConRedDeSeguridad` a mano, usan el pad del parte
(`firmarParte`) o miran `albaranDetailView.js` por AST. El 29-sep este viaje quedó «sin poder
medirse» porque `tests/_banco-vistas.mjs` no trae IndexedDB.

**Sí se podía:** `tests/_banco-almacen-local.mjs` la monta con `fake-indexeddb`. Es ése el banco
que hay que usar, no `_banco-vistas.mjs` a secas ni el de #1971.

## Qué entra

Un solo fichero, `tests/scrum1351-viaje-firma-sin-red-albaran.test.mjs`. No toca código de
producto. Ejecuta el código real: `renderAlbaranDetailView` + `signaturePad.js` (trazo, nombre,
«Confirmar firma») + `colaDeFirmas.js` + `almacenLocal.js` + `api.js` sobre un `fetch` que se
enciende y se apaga.

| Test | Qué afirma |
| --- | --- |
| suelo | el banco ve el almacén, el camino carga sin fallos y sus diez funciones existen |
| control | con red: 1 POST, cola 0, la pantalla pasa sola a «firmado» |
| firmar sin red | cola = 1, el pad dice que está guardada y es verdad, «Reintentar» no duplica |
| tope | con 49 entra, con 50 no entra y el pad no dice que se guardó |
| sin IndexedDB / aborto | no hay firma guardada y el pad no afirma que sí (con testigo de que el aborto ocurrió) |
| drenado con 409 | `albaran_locked` saca la firma de la cola en un intento |
| defectos | lo medido es exactamente `DEFECTOS_DECLARADOS` |

## Los seis defectos, declarados y sin arreglar

El test los mide y exige que coincidan con la lista. Arreglar uno sin borrar su línea, o que
aparezca uno nuevo, lo pone en rojo. Los arreglos no son de este ticket.

| Defecto | Dónde | De quién |
| --- | --- | --- |
| firmar lo ya subido dice «No hemos podido registrar la firma» y la reencola | `colaDeFirmas.js:168-176` | S2 |
| reabrir sin red calla la firma guardada, y refirmar la sobrescribe | `albaranDetailView.js:376` | S4, espera texto firmado |
| el detalle abierto no se entera de que la cola subió | `colaDeFirmas.js:485-489` | S2 |
| el rechazo definitivo del drenado no se ve en el albarán | único lector en `parteDetailView.js:1233` | espera texto firmado |
| cerrar sesión borra la cola sin avisar | `app.js:853-865` | espera texto firmado |
| firmar con red deja la marca de que hubo cola | `colaDeFirmas.js:91`, `:188` | S2 |

Los detectores comparan conductas (la pantalla con cola frente a la pantalla sin ella), no buscan
frases: un arreglo traerá un texto que hoy no existe.

## Prueba en rojo

Sobre el defecto 1, las dos mitades (`rojo1351.mjs`, fuera del árbol; restaura lo que toca):

| Caso | Resultado |
| --- | --- |
| base | 7 pasan de 7 |
| defecto presente y retirado de la lista | 6 de 7, cae por «no estaba declarado» y lo nombra |
| defecto arreglado (mutación local: `albaran_locked` tratado como «ya la tiene» en la firma directa) y aún declarado | 6 de 7, cae por «ya NO se observa» y lo nombra |
| restaurado | 7 pasan de 7 |

## Defecto vivo que salió al proponer los textos (leído, NO ejecutado)

El texto firmado del parte (SCRUM-890, comentario 15665) dice «La firma que quedó pendiente no se
ha podido registrar. Vuelve a firmar el parte.» `parteDetailView.js:1244` lo pinta para cualquier
código de rechazo que no sea `parte_vacio`, y `RECHAZOS_DEFINITIVOS` (`colaDeFirmas.js:278-287`)
incluye `400:invalid_id`. Con ese código volver a firmar da el mismo no: el texto promete algo que
no se cumple. No lo he reproducido corriendo — hace falta una entrada de cola con un id que el
servidor rechace — y este test no lo cubre: es del parte, no del albarán. Queda para ticket propio.

## Lo que NO mide

Un navegador de verdad: la cuota de Safari, el desalojo, el evento `online` real y el orden de la
carrera del arranque (`app.js:764` y `:785`, sin `await`). De esa carrera sólo se mide la marca
que la hace posible.

## Error propio

La primera versión del test exigía `noMedida === null` al abrir el detalle sin red, y tres tests
cayeron: sin red la vista pasa por su `catch` y pinta lo precargado, que es justo lo que se mide.
El suelo sin red es ahora «se pintó el albarán y ofrece firmar».
