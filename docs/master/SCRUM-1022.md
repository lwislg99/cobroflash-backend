# SCRUM-1022 · CLIENTES Y COBRO · qué pasa EXACTAMENTE hoy si a `csvImport` le das un `.xlsx` real, y con qué librería se leería

**Medido contra:** `origin/main` = `d5565ec88267a278dcf37be990587f08148fac13` · 2026-09-21T16:54:20Z

21-sep-2026 16:54Z · `origin/main = d5565ec88267a278dcf37be990587f08148fac13` · rama
`scrum-1022-medir-import-xlsx` · escrito por **J2** (puesto de Clientes y cobro del equipo de
Javier), sobre la propuesta abierta por J5 el 21-sep-2026 15:14Z (`origin/main =
92100e4fc018e59a948a0e9fccd898ae2d613963`), que convierte `docs/competencia/matriz.md` §16.5-B en
ticket.

## Encargo

El propio ticket declara el STOP: *"Añade una dependencia nueva: regla 36, lo decide el fundador,
no esta sesión"*. Lo que SÍ pide medir sin permiso: **cuánto falla hoy** y **con qué ficheros
reales** se encontraría un profesional. Esta tanda mide lo primero de forma EMPÍRICA (no solo por
grep, que es lo que ya hizo J5) y declara el suelo de lo segundo. **No se instala nada.**

## 1 · PASO 0 — repetido, y ampliado: no solo "no lee .xlsx", sino QUÉ HACE con uno

J5 ya midió por grep que `csvImport.js` y `package.json` no mencionan `xlsx|exceljs|papaparse|csv-parse`
(reconfirmado hoy, 0 coincidencias, sin cambios en el fichero desde entonces). Esta sesión va un
paso más allá: **construye un `.xlsx` real y válido** (formato OOXML/ZIP correcto: `[Content_Types].xml`,
`_rels/.rels`, `xl/workbook.xml`, `xl/worksheets/sheet1.xml`, con una fila de cabecera
`nombre;telefono;email` y una fila de datos «José García»/612345678/jose@example.com) con la
librería `archiver` **que YA está en `node_modules`** (dependencia existente del proyecto, `^8.0.0`,
usada en el propio export de portabilidad — no se instala nada nuevo) y lo hace pasar por el MISMO
camino que recorrería subido desde el navegador: `decodificarCsv` → `trocearCsv` → `proponerMapeo`
→ `importarClientes`, las cuatro funciones reales de `importarClientes.service.ts` y `csv.ts`,
sin mocks de esa parte.

**Resultado, medido, no supuesto:**

| paso | qué pasa |
|---|---|
| `decodificarCsv` (sin forzar) | **NO lanza.** UTF-8 estricto falla contra los bytes del ZIP → cae a `windows-1252`, que decodifica CUALQUIER byte sin error. El fichero binario se convierte en "texto" sin que nadie se entere de que era binario. |
| pantalla «¿Se ven bien los acentos?» | mostraría `primeraFila` = `"PK\u0003\u0004\u0014\u0000\b\u0000\b\u0000Ï„5]\u0000…[Content_Types].xml­‘»nÃ0…"` — basura binaria ilegible, pero NO vacía y NO un mensaje de error: un usuario que no lee con cuidado podría pulsar "Sí, continuar" por inercia. |
| `trocearCsv` sobre ese texto | detecta **1 sola "columna"** (todo el contenido binario, sin `;` ni `,` reales que lo separen en piezas con sentido) y **1 sola "fila"**. |
| `proponerMapeo` sobre esa cabecera | **0 columnas reconocidas** (`campo: null` en la única columna): normal, el contenido no se parece a `nombre/telefono/email` en ningún idioma. |
| `importarClientes` con el mapeo resultante (vacío, porque no hay nada que mapear a "Nombre") | **lanza `sin_columna_nombre`**, que la ruta ya captura y convierte en `400` con el mensaje `"Dinos cuál es la columna del nombre: sin ella no podemos crear los clientes."` |

**Conclusión medida:** un `.xlsx` real **no rompe el servidor, no crea clientes basura y no
corrompe datos** — el camino existente falla de forma segura. El problema real es de **experiencia**,
no de integridad: el profesional ve una pantalla de "acentos" con basura ilegible y, si sigue
adelante, un mensaje que le dice "falta la columna del nombre" — un mensaje **verdadero pero
engañoso**, porque el problema no es que falte esa columna: es que el fichero no es un CSV y nunca
lo va a ser. Nadie le dice "esto es un Excel de verdad (.xlsx) y hoy solo leemos .csv".

Script de medición (no se empuja: es un instrumento de esta sesión, queda descrito aquí para que
se pueda repetir; usa solo dependencias ya presentes — `archiver`, `ts-node` — ninguna nueva):
construye el `.xlsx` en memoria con `archiver` (API v8: `new (require('archiver').ZipArchive)(...)`,
no la función factory de versiones antiguas) y llama directamente a las cuatro funciones citadas
importándolas con `ts-node` en modo `transpileOnly`.

## 2 · Con qué ficheros reales se encontraría un profesional — SUELO DECLARADO

**No se ha podido medir con ficheros reales de la competencia.** `docs/competencia/` (capturas y
notas de J5) no incluye ningún `.xlsx` de exportación real de Holded, Contasimple, FacturaDirecta ni
Verifacturamos — solo capturas de pantalla y descripciones en markdown. Conseguir uno exigiría una
cuenta de prueba en esas herramientas, que esta sesión no tiene ni puede crear por su cuenta. El
`.xlsx` usado en el §1 es **estructuralmente real** (ZIP/OOXML válido, abrible por Excel) pero
**sintéticamente simple**: una hoja, sin celdas combinadas, sin filas vacías al principio, sin
`sharedStrings.xml` (usa `inlineStr`, que Excel también produce pero no es lo único que produce).
Un export real de un ERP podría traer varias hojas, la cabecera en una fila que no es la primera, o
columnas adicionales — nada de eso se ha medido aquí. **Declarado ciego, no «no falla».**

## 3 · La dependencia nueva — comparativa medida (STOP: la decide un jefe, regla 36)

Consultado el registro de npm HOY (21-sep-2026), sin instalar nada, con `npm view <paquete> version
license dist.unpackedSize dependencies time`:

| paquete | licencia | tamaño sin empaquetar | dependencias propias | última publicación real | nota |
|---|---|---|---|---|---|
| `exceljs` | MIT | 21,8 MB | 9 (incluye `archiver@^5` y `jszip` — **coexistiría con el `archiver@8` que ya tenemos**, dos copias de una lógica parecida) | 4.4.1-prerelease.0, dic-2024 | lee Y escribe, mucho más de lo que hace falta para leer un import |
| `xlsx` (SheetJS, paquete de npm) | Apache-2.0 | 7,5 MB | 7 | **0.18.5, 24-mar-2022** — más de 4 años sin publicar en npm | SheetJS mueve sus versiones nuevas a su propio CDN (`cdn.sheetjs.com`), no al registro de npm; lo que se instala con `npm i xlsx` hoy es la versión de 2022 |
| `node-xlsx` | Apache-2.0 | 43 KB (el wrapper) | **1**, y es literalmente una URL: `"xlsx": "https://cdn.sheetjs.com/xlsx-0.20.2/xlsx-0.20.2.tgz"` | wrapper de abr-2024 | instalar esto hace que `npm install` descargue un tarball **fuera del registro de npm**, directo del CDN de un tercero — punto de confianza distinto al resto de dependencias del proyecto |
| `@e965/xlsx` | Apache-2.0 | 8,1 MB | **0** | jul-2024 | espejo mantenido de SheetJS SÍ publicado en el registro de npm, sin la vía del CDN |
| `read-excel-file` | MIT | **2,4 MB** | 4 (sin dependencias nativas) | **10-ago-2026** — hace 6 semanas | **solo lectura** (que es exactamente lo que pide el ticket), con un export `./node` dedicado para servidor (`require('read-excel-file/node')`), aparte del de navegador |

**Lectura de esta sesión, sin decidir por su cuenta:** para un import de solo-lectura en el
servidor, `read-excel-file` es la que menos peso añade, la más recientemente publicada, sin la
rareza del origen-CDN de `node-xlsx`, y sin duplicar el `archiver`/`jszip` que ya trae `exceljs`.
`@e965/xlsx` es la alternativa si se prefiere el analizador de SheetJS en sí (más probado en
producción por más gente) sin la vía del CDN. **Esta sesión NO instala ninguna de las dos**: lo que
propone es la comparativa, no la elección.

## 4 · Dónde engancharía, a grandes rasgos (sin construirlo)

El punto de inserción es `POST /admin/customers/import/preparar` y `POST /admin/customers/import`
(`customersAdmin.routes.ts:167` y `:193`, ambos de mi área): en vez de `decodificarCsv` directo
sobre los bytes, una comprobación de la firma del fichero (`PK\x03\x04` = ZIP/`.xlsx` vs. lo demás
= CSV) y, si es `.xlsx`, una rama que use la librería elegida para producir `{cabecera, filas}` en
la MISMA forma que `trocearCsv` ya devuelve — de modo que `proponerMapeo` e `importarClientes`, que
no saben ni les importa de dónde vino el texto, **no cambian una línea**. Esto es diseño, no
código: no se ha escrito nada de esto en el PR.

## 5 · Mientras tanto — lo que SÍ podría mejorar la experiencia hoy, propuesto y parado

Aunque no se instale nada, el hallazgo del §1 (mensaje engañoso «falta la columna del nombre» ante
un `.xlsx`) es arreglable sin ninguna dependencia nueva: mirar los 4 primeros bytes del fichero
subido y, si son `PK\x03\x04` (firma de ZIP — que es lo que es un `.xlsx`, un `.docx` o cualquier
Office moderno), devolver un error específico en vez de dejar que caiga en `sin_columna_nombre`.
**Esto SÍ es texto de usuario nuevo** (regla 30/39: propone y para). Literal propuesto:

    Este archivo parece un Excel (.xlsx). Por ahora solo leemos archivos .csv: en Excel,
    usa "Guardar como" → CSV y sube ese archivo.

No se construye en esta tanda: queda propuesto para que un jefe firme el literal, y entonces es un
cambio de una función pura (una comprobación de 4 bytes) sin dependencias, en mi propio fichero.

## 6 · Qué NO se ha hecho en esta tanda

No se ha instalado ninguna dependencia ni tocado `package.json`. No se ha escrito código de
producción: el script de medición del §1 no se empuja (vive en el scratchpad de esta sesión). No se
ha tocado el esquema. No se ha publicado ningún texto de usuario.

## Siguiente paso

Esperando de un jefe: (1) sí/no y qué librería para leer `.xlsx` de verdad (§3); (2) firma del
literal del error específico del §5, que no depende de (1) y se puede construir antes. Con
cualquiera de las dos respuestas, el ticket de construcción es nuevo y pequeño, y toca solo
`customersAdmin.routes.ts` (mío) más, si se elige la lectura real de `.xlsx`, la línea de
`package.json` que decida el jefe.
