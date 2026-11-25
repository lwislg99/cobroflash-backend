# SCRUM-1807 · apartados del presupuesto: la parte de S1 (tramos c, d y g)

Hijo de SCRUM-1786. Decisiones y literales firmados: SCRUM-1786 c.22269 (P1–P5 y los tres textos), c.22329 y c.22389. Encargo del orquestador (`orquestador`), con cinco condiciones: ① el tramo c es un refactor y el PDF del presupuesto y el portal tienen que salir idénticos byte a byte; ② el tramo d va sin esquema; ③ el tramo g lleva sólo literales firmados; ④ el PDF de FACTURA ni se mira (P4, regla 40); ⑤ los literales se piden si no están en main. Rama `scrum-1807-apartados-s1`, un tramo por commit.

## SCRUM-1807c · `capitulos()`: el recorrido cabecera → subpartidas, en un sitio (25-nov-2026)

**Medido contra:** `origin/main` = `7592c8c140cbe5ddb1bcc516c8c6af38af90d59d` · 2026-11-25T08:26:26Z
A9: sin fallo que generalice — tramo nuevo sobre `main` al día; el refactor se midió antes y después y no rompió nada que hubiera que contar.
Mutaciones: catálogo → `tests/scrum1807c-capitulos.test.mjs`

Puesto S1. En `origin/main` no había ninguna rama `scrum-1807*` (`git ls-remote --heads`).

**La deuda que se paga (c.22329).** El PDF del presupuesto (`generateQuotePdf`, SCRUM-1786f1) y el portal del cliente (`filasConTotalDelApartado`, SCRUM-1786g) hacían cada uno su recorrido de cabecera a subpartidas. El portal lo había COPIADO del PDF, porque allí vivía dentro de la función y no se podía importar.

**Qué cambia en `src`:**

| fichero | cambio |
|---|---|
| `src/modules/quotes/domain/apartados.ts` | **nuevo** `capitulos(lineas)` → `[{ cabecera, lineas }]`, y el tipo `Capitulo<T>`. Usa el mismo `esApartado` que `lineasQueSuman`: la marca es sólo el booleano `true` |
| `src/modules/invoicing/infra/pdf/pdf.service.ts` | sólo en `generateQuotePdf`: el `forEach` con `apartadoAbierto` pasa a ser `for … of capitulos()`, y el cuerpo de la fila pasa, sin cambiar una letra, a `pintarFila(l)`. `pintarTotalDelApartado` no se toca. El PDF de FACTURA no se ha abierto (condición ④) |
| `src/modules/system/app/routes/customerPortal.routes.ts` | `filasConTotalDelApartado` recorre `capitulos()` en vez de su copia |

**Lo que se comparte es SÓLO el recorrido.** La cifra la sigue poniendo cada consumidor. El PDF suma la columna IMPORTE sin IVA (`calcVatBreakdown(...).base`) y el portal suma las líneas con IVA (`calcTotal`), porque c.22389 decidió no igualarlas.

**El criterio, el que ya tenían los dos.** Una cabecera abre un capítulo, y sus líneas son las que la siguen hasta la próxima cabecera. Lo que va antes de la primera cabecera es un capítulo con `cabecera: null`, sin total. Dos cabeceras seguidas dan un capítulo con `lineas: []`, que sigue pintando su «Total del apartado» de 0,00, igual que antes. Sin cabeceras sale un solo capítulo sin cabecera. Las líneas son las mismas referencias que entraron.

### Condición ①: idéntico byte a byte, medido

Guion: `docs/master/evidencias/SCRUM-1807/comparar-antes-despues.cjs`. Carga los dos `dist/`, el de `origin/main` `77c000dea` antes del cambio (copiado fuera del árbol) y el de la rama. Congela el reloj, porque PDFKit escribe la fecha de creación. Compara el sha256 del PDF de `generateQuotePdf` y el del HTML de `GET /portal/:token`, que se sirve con el Prisma de mentira de scrum1786g. Lo corrí sobre 77c000d; entre 77c000d y `7592c8c` `main` no tocó ninguno de estos ficheros (`git diff --stat` vacío).

| caso | PDF | portal |
|---|---|---|
| control: el mismo `dist` dos veces | IGUAL | IGUAL |
| control: un carácter distinto en una línea | DISTINTO | DISTINTO |
| sin apartados | IDÉNTICO `eea2d3ff68caee96` | IDÉNTICO `56daa5241a287aad` |
| dos apartados (el caso de 1786f1/g) | IDÉNTICO `4935f0278d6487c0` | IDÉNTICO `9cfd5ceb12a7e24b` |
| líneas antes de la primera cabecera y un apartado vacío (con `dto`) | IDÉNTICO `14c626a97a4ed8ed` | IDÉNTICO `2b8922437e80c964` |
| cabecera al final | IDÉNTICO `8fc3a1226d822bab` | IDÉNTICO `6e01f733ea9a2edf` |
| 60 filas en seis apartados (varios saltos de página) | IDÉNTICO `e727337ad685a67d` | IDÉNTICO `0959d58020f348b7` |

Para no estar comparando una cosa consigo misma: los tres compilados difieren entre los dos `dist` por hash, y el nuevo lleva `capitulos`.

### El test (`tests/scrum1807c-capitulos.test.mjs`)

El oráculo es el bucle de `filasConTotalDelApartado` tal y como estaba en `77c000dea`, copiado letra a letra. Sólo cambia la cifra: en vez de calcularla, guarda la lista de líneas que se habría sumado. El recorrido nuevo se compara con él por IDENTIDAD de referencia, en 10 casos escritos (con marcas que no son `true`, líneas `null` y apartados vacíos) y en 500 secuencias generadas con semilla fija. El test exige que más de 300 de ellas lleven cabecera, para no medir a ciegas. También prueba la entrada que no es lista y la forma del resultado.

**Rojo primero.** Con el `dist` de `main`, 0 de 4 (`capitulos` no existía). Compilado: 4 de 4. Junto a `scrum1786f1`, `scrum1786g`, `scrum1786b` y `scrum655`: 40 de 40.

**Mutaciones**, corridas con `aplicarUna` del meta-guard (`scripts/meta-guard-mutaciones.mjs`). Las seis caen y el árbol queda restaurado y verificado por el propio instrumento:

| catálogo | mutante | resultado |
|---|---|---|
| `scrum1807c` | se pierden las líneas de antes de la primera cabecera | CAE |
| `scrum1807c` | una cabecera no cierra la anterior y arrastra sus líneas | CAE |
| `scrum1786g` | el último apartado (el de 2 líneas) se queda sin total | CAE |
| `scrum1786g` | el total arrastra las líneas de los apartados anteriores | CAE |
| `scrum1786f1` | la fila «Total del apartado» desaparece | CAE (su catálogo no se ha tocado) |
| `scrum1786f1` | el total deja fuera su última línea | CAE (su catálogo no se ha tocado) |

**🔴 El catálogo de `scrum1786g` (carril J2) se ha REAPUNTADO, no rebajado.** Sus dos mutaciones citaban texto literal del bucle que el refactor quita (`if (abierto) filas.push(…)`), y una cita que ya no existe deja la declaración «caducada». Siguen siendo las mismas dos formas de fallar, ahora escritas sobre el código nuevo: una en `customerPortal.routes.ts` y la del arrastre en `apartados.ts`, que es donde vive ahora. No se ha tocado ningún aserto de ese test, sólo su catálogo y la línea de «deuda» de su cabecera. El de `scrum1786f1` sigue valiendo tal cual, porque `pintarTotalDelApartado` no cambia.

**La tanda entera en local NO terminó.** Claude Code la cortó porque la máquina se quedó sin memoria. Llegó a 10.477 `ok` y 4 `not ok`. Tres son los de esta máquina, que ya salen en SCRUM-1818.md: `scrum1726` D1 ×2 (el ICU de las fechas) y `scrum351` (junctions de `node_modules` rotas en otros árboles). El cuarto, `scrum534b-documentos-fantasma`, cayó a nivel de FICHERO a los 138 s, sin ningún subtest nombrado, en plena falta de memoria. Corrido solo, da 10 de 10. Lo que no llegó a correr lo corre el check obligatorio. Esto no es una tanda verde. `npm run guards:entrada`: 16 guards, en verde.

**Lo que esto NO hace.** No cambia ni una cifra ni un píxel: es la condición ①, y está medida. Tampoco toca la página de firma (eso es el tramo g) ni el PDF de factura.
