# SCRUM-987 · «Válido hasta» en el PDF del presupuesto (y la landing y el papel dicen la misma frase)

**Medido contra:** `origin/main` = `320c7f2035067bf845e582373b63aba8c4fd6fa9` · 2026-09-21T13:58:22Z (hora de GitHub, cabecera `Date:` de `gh api -i zen`). El Paso 0 y el diseño se midieron antes, sobre `2631bb9a53905c89537c8461c9cf2ab12de796f8` (13:30Z–13:45Z); `main` avanzó un solo merge (`#1583`, solo `docs/`) y se fusionó en la rama sin tocar ninguno de los ficheros de este PR.
**Rama:** `scrum-987-valido-hasta-en-el-pdf`
**Microcopy:** `docs/microcopy/2026-09-21-SCRUM-987-valido-hasta-en-el-pdf.md` (firma delegada, SCRUM-915 comentario 16165).
**Excepción de carril:** el ticket toca servidor (`src/`, carril de la S1) y la encargó el orquestador a la S2 por mensaje en vivo.

## Paso 0: el defecto existía hoy

Sobre `2631bb9a`, con el generador REAL de `dist/` y `validUntil` puesto en los parámetros: el PDF sale con **296 caracteres**, lleva el total (`121,00`) y **no lleva «Válido hasta» ni el mes**. La validez solo se le enseñaba al cliente en la landing donde decide (`quoteDecisionLanding.routes.ts`); el papel que el profesional manda por correo o WhatsApp y que el cliente guarda no decía hasta cuándo vale el precio.

## Lo que cambia

| fichero | qué |
|---|---|
| `src/modules/quotes/domain/validez.ts` (nuevo) | `textoDeValidez({validUntil, createdAt, merchant})` → «Válido hasta el 15 de octubre de 2026» o `null`. La fecha sale en la zona del negocio (`zonaDelMerchant`, SCRUM-633/643), con el respaldo `creación + 30 d` de los presupuestos anteriores a A16.2 y con día de dos cifras (como la landing). Una fecha que no es fecha da `null`: nunca «Invalid Date» en un papel del cliente. El rótulo NO se exporta (el censo de SCRUM-411 caza un export sin llamador, y un test que importara la constante para compararla consigo misma no fijaría nada). |
| `src/modules/invoicing/infra/pdf/pdf.service.ts` | `ParamsPdfPresupuesto` gana `validez?: string \| null` (la frase YA compuesta) y `generateQuotePdf` la pinta debajo de «Presupuesto #N», mismo estilo (11 pt, gris, a la derecha), solo si llega. **`generateInvoicePdf` no se toca** (el tipo va antes de esa función y la línea después: el guard de frontera de SCRUM-603b/723 sigue en verde). |
| `src/modules/quotes/domain/presupuestoParaPdf.ts` | El constructor único produce `validez`: `null` si el presupuesto está firmado, la frase si no. `Completo<>` hace que un olvido no compile: probado (M18). Las cuatro puertas (`quotes.routes` ×2, `quotesAdmin.routes`, `quoteDecisionLanding.routes`) delegan en él y traen el merchant entero (con `timezone`) y la fila entera. |
| `src/modules/system/app/routes/quoteDecisionLanding.routes.ts` | La landing deja de componer la fecha y el rótulo y pide la frase a `textoDeValidez` (el ⏳ sigue siendo de la página). Mismo texto para el cliente; el único cambio de comportamiento es que una `validUntil` corrupta ya no imprime «Invalid Date»: no pinta el badge. |
| `tests/scrum633-caducidad-en-la-zona.test.mjs` | **Re-anclado, sin relajar:** «las CUATRO impresiones de la landing» pasa a TRES en la landing + UNA en `validez.ts`, cada una con su `timeZone: zonaDelMerchant(`, y exige además que la landing le pase a `textoDeValidez` el merchant DEL PRESUPUESTO (no cualquier `merchant:`). El motivo está escrito en el propio test. |

## Una decisión que queda escrita

**Un presupuesto ya firmado sale SIN la línea** (`acceptedAt`, `signatureUrl` o `evidenciaFirma`, cada una por sí sola). Añadirla no cambia ningún hash: el sello de SCRUM-805 sella `validUntil` como dato, no los bytes del PDF. Lo que sí cambiaría es el ASPECTO de un papel ya firmado, porque `GET /admin/quotes/:id/pdf` regenera y sobrescribe `pdfUrl`, y P2 regenera al firmar con la fila ya firmada. La validez ya la vio el cliente en la landing donde firmó. Alternativa NO elegida: una fecha de corte (`acceptedAt >= <fecha>`) para que lo firmado después sí la lleve; pide el OK del orquestador.

**Desvío del diseño previo, declarado:** el traspaso pensaba pasar `validUntil` al PDF. Se pasa la frase YA compuesta (`validez`), porque así el generador no necesita conocer la zona del merchant ni el estado de la firma: llegan los datos resueltos, y la decisión vive en un solo sitio.

## El juez: `tests/scrum987-valido-hasta-en-el-pdf.test.mjs` (15 pruebas)

| grupo | qué exige |
|---|---|
| frase y fecha (5) | suelo (dos fechas dan dos frases, la zona cambia el día); la frase firmada escrita **a mano** en el test, con `Date` y con cadena, día de dos cifras, sin emoji; zona del negocio (Madrid 15 / sin zona 14 / zona corrupta cae a UTC); respaldo `creación + 30 d` y gana la columna; sin fecha o con basura → `null` |
| constructor (3) | el positivo (un borrador la lleva); **cada una de las TRES marcas de la firma la quita** y las marcas vacías no cuentan; el constructor pasa la zona y `createdAt` |
| el papel, ejecutado (3) | el PDF real lleva la frase entre el número y el emisor, una sola vez; sin la línea sale como salía (clave ausente = clave a `null`); un firmado sale con **el mismo texto** que sin línea, y su positivo (el mismo borrador) sí la lleva y su texto es distinto |
| PDF = landing (1) | se ejecutan los dos sobre el mismo presupuesto en cuatro casos (columna, respaldo, cruce de medianoche en Madrid, el mismo instante sin zona): la landing (`renderQuoteDetail`) y el PDF dicen la frase esperada |
| puertas y sitio único (3) | el constructor produce `validez` y ninguna puerta del censo compartido la pierde; la landing sigue delegando en el constructor; la frase se escribe UNA vez (`validez.ts`) y ni la landing, ni el generador, ni el constructor la escriben a mano; la ficha de microcopy lleva la frase y la línea de la firma delegada con su comentario |

**Suelos:** el PDF trae su total (`121,00`) antes de afirmar nada sobre «Válido hasta»; los casos negativos de la firma llevan su positivo al lado; el bucle de cuatro casos cuenta que se recorrieron los cuatro.

## Verificado en rojo (BASE 28/28 con `scrum987` + `scrum633`; punta `b61a2bdf`, y `327e8e5d` para M1, M15 y M17, que se repitieron)

Diecinueve mutaciones sobre el árbol comiteado, cada una con el `git diff --numstat` a la vista, `npm run build` antes de cada mutante y otra vez tras restaurarlo, y `git status --porcelain` vacío tras cada restauración. **Ninguna sobrevive, ninguna «no se aplicó»**:

| mutación | cae |
|---|---|
| landing: no le pasa el merchant / vuelve a escribir el rótulo / deja de pedir la frase al dominio | 2 (633 y PDF=landing) / 2 (PDF=landing y sitio único) / 3 (633, PDF=landing y sitio único) |
| constructor: sin la regla del firmado / sin mirar `evidenciaFirma` / `signatureUrl` / `acceptedAt` | la regla de las tres marcas (y, para el primero y `acceptedAt`, también el papel firmado) |
| constructor: no pasa `createdAt` / no pasa el merchant / `validez` siempre `null` | 2 (constructor y PDF=landing) / 2 (las mismas) / 6 pruebas |
| constructor: se borra la clave `validez` | **no compila** (`Completo<>`), que es lo que se afirmaba |
| generador: no pinta la línea / la pinta después del emisor | 3 (papel, firmado, PDF=landing) / el orden |
| dominio: rótulo «Válida» / respaldo 29 d / respaldo pisa a la columna / UTC fijo / día sin cero / fecha inválida impresa | 10 / 3 / 7 / 5 (con 633) / la frase firmada / «nunca Invalid Date» |

## Verificado en conjunto

97 ficheros de test (los 76 que leen lo tocado —`pdf.service`, `presupuestoParaPdf`, `quoteDecisionLanding`, `zonaDelMerchant`, `toLocaleDateString`, el lector de PDF…— más los guards que barren `tests/` enteros: 262, 710b, 850, 921, 411, 813…): **928 tests · 914 pass · 0 fail · 14 saltados**, `NODE_EXIT=0`. No es la suite completa (turno del orquestador y memoria no medidos): el CI prueba el merge.

**Medida de la cabecera** (no hay renderizador de PDF en la máquina: se leen las posiciones del propio flujo del PDF con `lineasDePdf`). Sin logo: número a y=762,6 · validez a y=749,9 · «Emisor» a y=728,8 (sin la línea, 741,5): el cuerpo baja **12,7 pt**, una línea. Con logo (40 pt de alto) la cabecera ya ocupaba ese hueco: el cuerpo baja **0,9 pt**. La línea queda entre el número y el emisor en los dos casos y no toca al logo (a la izquierda; la frase mide unos 185 pt y va pegada a la derecha).

## Errores propios

1. **Dos mutantes mal formados**: M15 (`false ? new Date(f.validUntil)…`) y M17 (`null && …`) no compilaban por tipos y el runner los contó «NO COMPILA», no «CAE». Los dejé fuera de la cuenta, los rehíce como mutantes que compilan (respaldo primero; `(firmado || true) ? null : …`) y cayeron: 7 y 6 pruebas.
2. **La primera versión del test de 633 dejaba pasar `merchant: null`**: el mutante M1 solo lo cazaba mi prueba PDF=landing, no la de 633 (su regex pedía «`merchant:` a secas»). Se endureció a «el `merchant` del presupuesto» y ahora caen las dos.
3. **Exporté `ROTULO_VALIDEZ` al principio** y el censo de SCRUM-411 cayó (dos pruebas, 241 huérfanos contra 240 declarados). Se arregla en MI código —dejar de exportarlo—, no declarándolo en el censo; el test escribe la frase firmada a mano en su lugar.
4. Un primer `git commit` con el mensaje en un here-string con comillas dobles lo partió PowerShell 5.1 en pathspecs; no llegó a crear el commit (comprobado con `git log`) y se rehízo con `-F fichero`.

## Lo que NO cubre

- **No verificado en yaqu.app ni en staging**: se hará con el merge (un PDF real de un presupuesto sin firmar y otro firmado, `GET /admin/quotes/:id/pdf`).
- **No hay captura del PDF** (no hay renderizador): la posición está medida en el flujo, no vista.
- **Paginación** de un presupuesto con la hoja llena: la línea empuja el cuerpo 12,7 pt; no se ha medido un caso que cruce de página.
- El formato de fecha es `es-ES` fijo, igual que la landing; un merchant de otro país lo lee igual que antes.
- Un presupuesto `expired`/`rejected` sin firma sigue llevando la línea con su fecha (que es verdad); solo lo firmado la pierde.
