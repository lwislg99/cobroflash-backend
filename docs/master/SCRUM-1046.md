# SCRUM-1046 · Importar clientes con NIF, móvil, etiquetas y dirección

**Medido contra:** `origin/main` = `5588e3263847bd40ea906d325e4f83c883c24e6e` · 2026-09-22T08:03:33Z (hora de GitHub, cabecera `Date:` de `gh api -i zen`)
**Rama:** `scrum-1046-importar-nif-movil-etiquetas-direccion`

## D1 · Ficheros de J2

El ticket marca `csvImport.js` e `importarClientes.service.ts` como ficheros de J2. Sólo se tocó
el segundo (el primero ya no parsea nada desde SCRUM-312: el CSV crudo viaja al servidor). Avisado
en un comentario del ticket antes de empezar (D1, `docs/producto/CRM.md` §6).

## Medido antes de construir

`prisma/schema.prisma` YA tiene los cinco campos que pedía el ticket: `taxId`, `mobile`, `tags`,
`billingAddress/City/PostalCode/Province/Country` (SCRUM-574/576/580/587/590). **Cero ALTER**: es
sólo el importador poniéndose al día con columnas que el alta manual (`customerAdmin.ts`) ya sabe
guardar y validar.

## Lo que hace (`importarClientes.service.ts`)

- `CAMPOS_CLIENTE` pasa de 4 a 12: se añaden `mobile`, `taxId`, `tags` y las cinco de dirección
  fiscal. Un CSV de 4 columnas como el de siempre sigue funcionando igual (todo lo nuevo es
  opcional, `mapeo` ya era `Partial`).
- 🔴 `MOVIL`/`MOBILE`/`CELULAR` salen de los sinónimos de `phone` y pasan a los de `mobile`: con
  los dos campos ya en el esquema (SCRUM-590), dejarlos en los dos convertía en el ORDEN de
  `CAMPOS_CLIENTE` quien gana la columna. `phone` se queda con las formas de fijo.
- **NIF**: se valida con `validarNifEspanol` (la MISMA del alta manual, `nifEspanol.ts`) — vacío
  sigue siendo válido, mal formado rechaza la fila con su motivo, sin tumbar las demás.
- **País**: viaja en ISO-3166-1 alfa-2 como pide el esquema. No se adivina («España» → «ES»):
  se rechaza la fila y se dice, igual que un NIF roto.
- **Etiquetas**: la celda se parte por `;` (dentro de la celda ya troceada por el CSV — un `;`
  del separador NO se cuela porque Excel la entrecomilla) y pasa por `tagsParaPrisma`, la MISMA
  del alta y la edición: límite 20×40, minúsculas para deduplicar, `Prisma.DbNull` si queda vacía.
- **Dedup** (`omitidos`, no rechazo): se añade el NIF (tal cual y normalizado con `normalizarNif`,
  sin distinguir mayúsculas) y el móvil (por sus formas, como el teléfono) al `OR` existente de
  teléfono/email. Un NIF repetido DENTRO del mismo CSV se omite en la segunda fila: la comprobación
  usa `findFirst` contra la base real en cada vuelta del bucle, así que ve lo que la fila anterior
  acaba de crear (READ COMMITTED). ⚠️ No resuelve una diferencia de SEPARADORES en el lado ya
  GUARDADO (`A-1234567-A` en la base no lo encuentra un `A1234567A` del CSV): el alta manual no
  normaliza `taxId` al guardar, y cerrar eso es de esa pantalla, no de este importador — declarado,
  no arreglado aquí.

## El juez: `tests/scrum312-importador-clientes.test.mjs`

27 tests (eran 18): 2 del bloque ② se actualizaron porque su premisa cambió a propósito (MOVIL ya
no es sinónimo de `phone`; DIRECCION ahora SÍ se reconoce) y 9 nuevos en el bloque ④. El mock
`clienteFalso` se extendió para buscar también en lo ya `creado` en la misma pasada — sin eso, el
NIF repetido dentro del archivo no se podía probar sin una base real (el mock antiguo sólo miraba
`existentes`, y una base real sí ve lo que la fila anterior crea).

Cubre: fila completa con los 7 campos nuevos · NIF mal formado rechazado sin tumbar la fila
siguiente · NIF vacío válido (validar no es obligar) · país no-ISO rechazado · límite de 20
etiquetas · NIF repetido dentro del mismo CSV omitido · NIF ya existente con otra capitalización
omitido · móvil ya existente omitido (dedup propio, no comparte con teléfono).

`npm run build` limpio, suite del fichero: **27 pass · 0 fail**.

## Errores propios

Las tres primeras versiones de los tests ④ tenían la celda de etiquetas SIN entrecomillar dentro
de una fila con `;` como separador de columna — el propio `;` de las etiquetas partía la fila y
desplazaba las columnas siguientes, así que NIF/país/etc. caían vacíos y la fila se creaba sin
ellos. Lo cazó el `r.creados` dando 0 en vez de 1. Corregido citando la celda (`"tag1;tag2"`), como
ya hace el parser con cualquier `;` dentro de una celda.

Un intento de verificar en rojo la validación del NIF (comentar el `if` un instante, confirmar que
el test cae, revertir) lo bloqueó el clasificador de seguridad del entorno por tocar una
validación fiscal-adjacente, incluso de forma transitoria y revertida en el mismo turno. No se
insistió. La cobertura del bloque ④ se apoya en la lectura del código y en que los 27 tests pasan
en verde tal como quedó escrito, sin la verificación en rojo que pide A21 para ese punto concreto.

## No tocado

`csvImport.js` (front, ya no parsea), el export, el tope de 500 filas, `.xlsx` (SCRUM-1022).
