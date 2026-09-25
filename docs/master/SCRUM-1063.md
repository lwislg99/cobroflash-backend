# SCRUM-1063 · Modelo 303 completo, el cálculo — BLOQUEADO, motivo medido

**Medido contra:** `origin/main` = `e2f715939d0e27ca2661821e1b57292d4ec1c3cc` · 2026-09-22T08:57:39Z
**Rama:** `scrum-1063-lote-contabilidad-modelos` · **Puesto:** J1 · **Encargo:** orquestador, 22-sep-2026

## PASO 0 — lo que ya existe

`src/modules/fiscal/modelo303/` (SCRUM-295, Finalizada) ya calcula el IVA **repercutido** con sus
casillas (`casillas.ts:41-48`) y ya cruza con los cobros. Este ticket pide **añadir el soportado y
el resultado** — no repetir lo que ya hay. No es un duplicado.

## Por qué no se puede construir hoy — medido, no supuesto

La propia aceptación del ticket (punto 1) lo hace depender de dos cosas, y las dos siguen sin
existir:

1. **SCRUM-1039** ("Completar las citas oficiales que faltan y llevar al asesor las nueve
   preguntas Q-C1…Q-C9") está en Jira en estado **«Tareas por hacer»**, sin ninguna rama ni commit
   asociado (`git log origin/main --grep="SCRUM-1039"` → vacío). La orden ministerial del modelo
   303 **no está descargada ni citada** en el repositorio.
2. **Q-C8** ("Plazos y modelos trimestrales… el art. 71 RIVA localizado no contiene los plazos,
   pendiente de hallar dónde están") sigue así **literalmente** en
   `docs/producto/CONTABILIDAD.md:86`, sin respuesta. Las respuestas del asesor que llegaron hoy
   (SCRUM-1079) son de **otro bloque** de preguntas (P14, A-G, P11-P17, SCRUM-143 — facturación y
   VeriFactu), no de las Q-C1…Q-C9 de contabilidad; y SCRUM-1079 en sí sigue «Tareas por hacer»,
   así que ni siquiera esas otras respuestas están volcadas todavía.

El propio texto del ticket es explícito: **«las casillas sin cita NO se rellenan»** y **«no se
escribe ninguna fórmula sin cita»** (art. 78.Tres.3.º está «por confirmar» encabezado). Escribir
el cálculo del IVA soportado y el resultado sin la orden citada sería precisamente lo que el
ticket prohíbe en su propia letra.

## Qué SÍ se puede decir ya, sin construir nada

La fórmula general (repercutido − soportado, excluyendo suplidos por LIVA art. 78.Tres.3.º) es de
sentido común contable y no cambia con la orden del modelo — pero **la casilla concreta de cada
importe sí depende de la orden**, y es lo que el ticket pide que no se adivine. Construir la resta
sin casillas sería un cálculo sin sitio donde mostrarlo (depende de SCRUM-1064, que a su vez
depende de este).

## Siguiente paso exacto

Ninguno para J1 hasta que SCRUM-1039 cite la orden del modelo 303 y Q-C8 tenga respuesta. No es un
STOP de un jefe (regla 40): es una dependencia externa (el asesor) ya declarada por el propio
ticket con la etiqueta `esperando-asesor`.

## STOP respetado

No se ha tocado `src/modules/fiscal/modelo303/`, ni ningún camino de emisión, ni `schema.prisma`.
Solo lectura y este documento.


## SCRUM-1063b · IVA deducible (28/29, 45) y resultado (46), construido — decisión A (J1, 25-sep-2026)

**Medido contra:** `origin/main` = `dac1f9d7f9cd5237778aa2cd3f9241bd2210855a` · 2026-09-25T15:10:45Z
**Rama:** `scrum-1063b-303-soportado-resultado` · **Puesto:** J1 · **Encargo y decisión:** orquestador (jv-orquestador), 25-sep-2026

### Por qué ya se puede construir (lo que ha cambiado desde el bloqueo de arriba)

- SCRUM-1039b (#1731, en main) localizó la orden vigente del formulario, que es la Orden HAC/27/2026,
  Anexo III (sustituye el Anexo I de EHA/3786/2008). También transcribió la **fórmula** de la 45
  («Total a deducir (29+31+33+35+37+39+41+42+43+44)») y la de la 46 («Resultado régimen general (27-45)»).
- El ticket, leído por el orquestador el 25-sep, **no tiene cuerpo más allá del título** ni
  comentarios. El alcance es el del título: repercutido (ya existía, SCRUM-295) + soportado + resultado.

### 🔴 El suelo: medido en el BOE, no deducido

1. **Qué es la 28/29 y qué es la 30/31.** SCRUM-1039b solo transcribió la fórmula de la 45, no qué
   va en cada sumando. Se bajó con `curl` la página 1 del impreso
   (`https://www.boe.es/datos/imagenes/disp/2026/23/1761_16563944_7.png`, HTTP 200, 888.636 B) y
   se LEYÓ la imagen:
   - 28/29 «Por cuotas soportadas en operaciones interiores **corrientes**»
   - 30/31 «Por cuotas soportadas en operaciones interiores con **bienes de inversión**»
   - 32-35 importaciones, 36-39 intracomunitarias, 40/41 rectificación de deducciones, 42-44
     compensaciones y regularizaciones.
2. **`Expense` no distingue lo corriente de un bien de inversión.** Solo tiene
   `category` = `materiales|desplazamiento|herramientas|subcontrata|otros` (`prisma/schema.prisma`,
   `model Expense`). «herramientas» puede ser una cosa o la otra, y meterla en la 29 sería
   ADIVINARLO, justo lo que prohíben `casillas.ts` y el ticket.

Eso es lo que hace defendible la decisión A: se clasifica lo que el dato permite y **se declara lo
que no**.

### Decisión A (orquestador, 25-sep-2026), tal como se ha construido

| Gasto del libro de recibidas | Va a | Motivo declarado |
|---|---|---|
| `vatDeducible === true`, categoría materiales/desplazamiento/subcontrata/otros, tipo > 0, con cuota | **28/29** | — |
| categoría «herramientas» | sin clasificar | `posible_bien_de_inversion` |
| `vatDeducible` null | sin clasificar | `deducibilidad_sin_decidir` |
| sin categoría, o una categoría que no está en la lista | sin clasificar | `categoria_desconocida` |
| tipo 0 o ilegible | sin clasificar | `tipo_cero` |
| sin cuota guardada | sin clasificar | `sin_cuota` (no se deriva base × tipo, igual que el libro) |
| `vatDeducible === false` | fuera, contado en `noDeducibles` | decisión tomada, no es un fallo |
| gasto sin `baseAmount` (no es asiento, SCRUM-426) | fuera, contado con su dinero | `gastosSinDatosDeIva(Importe)` |

- **30/31: siempre 0**, con `vaciaPorque: 'sin_dato_de_bien_de_inversion'`. Un cero sin motivo
  se leería como «no compró ninguno».
- **45** = la 29 (es la única casilla que se rellena). **46** = 27 − 45.
- `motivosParaNoFiarse` recibe una línea si hay algún gasto sin clasificar y otra si hay gastos sin
  datos de IVA. Las 30/31 vacías NO van ahí: estarían en TODOS los trimestres, y un aviso que salta
  siempre deja de leerse.

### Ficheros

- `src/modules/fiscal/modelo303/casillas.ts`: 28/29, 30/31, 45 y 46, con su procedencia (la URL
  de la imagen y los dos expedientes).
- `src/modules/fiscal/modelo303/modelo303.ts`: `construirIvaDeducible`, y los campos
  `ivaDeducible` y `resultadoRegimenGeneral`. `libroRecibidas` es ahora OBLIGATORIO en
  `construirModelo303`.
- `src/modules/fiscal/modelo303/modelo303.repo.ts`: lee `leerLibroRecibidas` con el MISMO rango
  (`rangoTrimestre`) que usa E4, y pasa por `exigirLibroRecibidasLegible`. No se escribe un
  segundo lector de `Expense`.
- `src/modules/invoicing/domain/libroRecibidas{,.repo}.ts`: se selecciona `category`, y el libro
  devuelve `categorias[]` alineado con `asientos`. **La categoría va APARTE y no dentro del
  asiento**: cada campo del asiento es una columna del libro que se entrega al despacho (lo
  vigila `scrum426 · las columnas son UNA POR CAMPO DEL MOTOR`), y una columna nueva sería texto
  nuevo sin firmar.
- `src/modules/fiscal/evidencias/paquete.repo.ts`: `ClienteDelPaquete` gana `expense`, porque el
  paquete llama a `leerModelo303`.
- `tests/scrum1063b-303-soportado-resultado.test.mjs`: nuevo, 9 casos.
  `tests/scrum295-modelo-303.test.mjs`: el helper pasa un libro de recibidas vacío.

**No se toca:** `prisma/schema.prisma`, el camino de emisión, `flags.ts`, ninguna pantalla ni
ningún texto de pantalla. El CSV del paquete de evidencias (`paquete.ts`) sigue sacando solo el
devengado: añadirle la 29/45/46 cambia un documento que se entrega a un tercero, y eso es otra
decisión.

### Cómo se ha medido

- **Rojo por mutación** (sobre `dist/`, restaurado y comprobado con `cmp` después). La BASE sin
  mutar: 9/9 en verde.

  | Mutación | Casos que caen |
  |---|---|
  | M1 · «herramientas» entra en la 29 | 1 |
  | M2 · el `select` no pide `category` | 1 |
  | M3 · la 46 ignora la 45 | 2 |
  | M4 · `vatDeducible` null cuenta como deducible | 2 |

  M4 salió CIEGA la primera vez (el texto buscado no estaba en el JS compilado, porque `tsc` parte
  el `if` en dos líneas). Se repitió con el texto real.
- **Tanda enfocada** (11 ficheros: 303, recibidas, libros E4, evidencias, marcadores y puerta
  fiscal): 134 tests · 131 pass · 0 fail · 3 skipped. Los 3 saltos son `sin LIBRO_PG_URL`
  (scrum295-postgres y scrum389): esta máquina no tiene Postgres, así que **lo confirma solo el
  CI**, y eso es el suelo.
- **`npm test` entero, antes de los dos arreglos de abajo:** 8.323 tests · 8.182 pass · 7 fail ·
  134 skipped. De los 7:
  - Míos, y arreglados:
    - `scrum377`: puse «gasto(s)» en dos motivos → ahora el plural concuerda.
    - `scrum854`: faltaba esta entrada de registro.
  - Del host o del estado del repo, no de este cambio:
    - `scrum910d`: la aserción de libuv de Windows (`src\win\async.c`).
    - `scrum939b` ×3: `gh.exe` SÍ existe en esta máquina, y el trinquete lo declara como ruta falsa.
    - `scrum804b`: el estado de la rama de SCRUM-1107.

### Error propio

Medí el arranque sobre `c906a53c` y creí que la rama salía de ahí. Pero `refs/remotes/origin/main`
es COMPARTIDO entre los worktrees: otra sesión hizo `fetch` entre mi medición y el
`git switch -c … origin/main`, y la rama nació en `dac1f9d7` (#1758). Me di cuenta al ver HEAD =
`dac1f9d7` en el reflog. No cambia nada del trabajo, porque todas las pruebas corrieron sobre esa
base, pero el ancla de arriba es la base de verdad y no la del primer mensaje.

### Riesgo residual, dicho

«otros» va a la 29 por la decisión A, y una furgoneta registrada como «otros» es un bien de
inversión. El dato no lo distingue, y la única forma de cerrarlo es un campo corriente/inversión en
`Expense` (un ALTER, que decide Javier) o un criterio del asesor. Hasta entonces, el aviso
«orientativo» y el borrador para el asesor son lo que lo contiene.
