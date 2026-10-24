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
  - **Después de los dos arreglos, `npm test` entero:** 8.323 · 8.184 pass · **5 fail** · 134 skipped. Los 5 son los de la lista siguiente, y ninguno toca un fichero de esta rama.
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

## SCRUM-1063c · el motivo propio de los suplidos y la casilla 64 (J1, jv-j1bh, 24-oct-2026)

**Medido contra:** `origin/main` = `0e86dada4887f1ac54ce0ed5cad3c53c99c72c1c` · 2026-10-24T10:13:45Z

A9: sin fallo que generalice — el error propio de abajo (la 67 de c.20716) es de lectura de un impreso; el instrumento que lo impide es leer la imagen, y quedó dentro del test (`tests/scrum1063c-suplido-y-casilla-64.test.mjs`, «SIN la 67»).

Decisión del fundador: SCRUM-1063 c.20717 (transcrita por el orquestador), que contesta las preguntas 1 y 2 de c.20716.

### Qué se ha construido

1. **El suplido tiene su motivo.** `AsientoLibro` lleva un campo nuevo, `suplidosPorTipo`: la parte de `porTipo` que son suplidos, sacada con `partirPorSuplido` (`suplidos.ts`, sin cambiarlo) y el mismo `calcVatBreakdown`. `[]` = no hay; `null` = marca ilegible. **`porTipo`, `base`, `cuota` y `total` del libro no cambian** (caso a mano, verde en `main` y en la rama). El 303 aparta, de la entrada al 0 %, lo que es suplido con `motivo: 'suplido'`; el resto sigue `tipo_cero`. Se aparta restando, así que libro = casillas + sin clasificar sigue al céntimo. No llama a `desgloseConSuplidos` ni toca el camino de emisión.
2. **La 64 = 46**, en `resultadoFinal.sumaDeResultados`. **Vacías con su motivo como código**: 65, 66, 68, 69, 70 y 71 (`CASILLAS_RESULTADO_VACIAS` en `casillas.ts`). Procedencia: Orden HAC/27/2026, Anexo III, página 3 del impreso (`https://www.boe.es/datos/imagenes/disp/2026/23/1761_16563944_9.png`), recuadro «Resultado», leída como imagen el 24-oct.
3. **Texto.** El aviso «… sin calificación fiscal (exenta / no sujeta / ISP) …» deja de contar los suplidos. **No se ha escrito ningún aviso para el suplido** (regla 39): viaja como dato. El literal se le propone al fundador en el comentario de Jira.

### Error propio

En c.20716 (jv-j1bc, este mismo puesto) se escribió «la 67 (cuotas a compensar de periodos anteriores)». **En el impreso vigente no hay casilla 67**: las cuotas a compensar son la 110, la 78 y la 87. Por eso la lista de vacías salta de la 66 a la 68. La decisión dice «65 a 71»; se han dejado vacías las que existen.

### Cómo se ha medido

- **Rojo primero:** el test nuevo contra `origin/main` `137c7fad` compilado aparte: caen 9 de 14. Los dos casos que comprueban que el libro no cambia salen verdes en los dos.
- **Mutaciones sobre `dist/`** (nunca `src/`): sin `suplidosPorTipo` caen 5; el aviso que vuelve a contar el suplido, 2; la 64 = 27, 2; un resto a cero apuntado, 2; el suplido de vuelta a `tipo_cero`, 3; una 67 inventada, 1. Después, 14 de 14.
- **Guards dirigidos:** los 28 ficheros que nombran `libroRegistro` (`git grep -l libroRegistro tests/`) más `scrum1066c`, `scrum1066e` y `scrum500`: 273 casos, 0 caen, 4 saltados (`LIBRO_PG_URL`, banco local). Ninguno trata el libro como emisión (`scrum389-censo-vat` lo clasifica `DOCUMENTO`). Los de suite y de registro, en el comentario de Jira con su recuento.
- **Suite entera local: NO CORRIDA** (10 sesiones a la vez); hace de tanda el obligatorio de CI.

### Riesgo residual, dicho

- `porTipo` pierde la `causa` (SCRUM-1051). Si una factura tuviera al 0 % una línea S2 y un suplido, las dos entradas al 0 % no se distinguen en el libro, y el suplido se aparta de la primera que salga. Ninguna factura así existe hoy: medido no, deducido de que no hay merchants reales.
- El código `suplido` se ve en el CSV del paquete de evidencias (`SIN_CLASIFICAR suplido <número>`), igual que hoy `tipo_cero`.

## SCRUM-1063d · el aviso firmado de los suplidos, y el riesgo S2 + suplido medido (J1, jv-j1bj, 24-oct-2026)

**Medido contra:** `origin/main` = `49045295ec2823bd98b4ebf7ab8d2f0125fabcb9` · 2026-10-24T10:25:35Z

A9: comprobación → `tests/scrum1063d-aviso-suplidos.test.mjs`

Firma del fundador: SCRUM-1063 c.20731 (regla 39, transcrita por el orquestador). Rama sobre `scrum-1063c-suplidos-y-64` @ `c185f80c`: **este PR depende del #2811**, que a esta hora sigue sin mergear.

### Qué se ha construido

1. En `motivosParaNoFiarse` del 303, para las entradas de `sinClasificar` con `motivo: 'suplido'`, el literal firmado: «{n} suplido(s) no entran en ninguna casilla: son gastos pagados por cuenta del cliente.» Un solo texto para singular y plural, como está en la firma. `{n}` cuenta entradas de `sinClasificar`, igual que el aviso de «operación(es)» de al lado.
2. `tests/scrum1063c-suplido-y-casilla-64.test.mjs`: dos aserciones fijaban «sin aviso» porque la firma no existía; ahora fijan el literal exacto. La comprobación es más estricta, no más laxa.

### Cómo se ha medido

- **Rojo primero:** el test nuevo contra el código de 1063c: caen 4 de 5 (el quinto es el negativo de la marca ilegible, verde en los dos).
- **Mutaciones sobre `dist/`:** sin el punto final caen 3; «suplidos» en vez de «suplido(s)», 4; umbral `> 1`, 3; contar todo `sinClasificar`, 3; aviso quitado, 4. Restaurado y comprobado.
- **Guards dirigidos:** 1063b/c/d, 1066c/e, 1232, 237, 976, 824, 824b, 836, 419, 702, 700, 719, 1415, 1294, 267, 273, 622 y 854: 22 ficheros, 215 casos, 0 caen, 0 saltados. Los 30 ficheros que nombran `modelo303` o `motivosParaNoFiarse`: 321 casos, 0 caen, 3 saltados (`LIBRO_PG_URL`).
- **Suite entera local: NO CORRIDA**; hace de tanda el obligatorio de CI.

### El riesgo de c.20728, medido (no arreglado: espera decisión)

Factura fabricada, pasada por `construirLibroRegistro` y `construirModelo303` reales:

- **S2 al 0 % (1000) primero, suplido (50) después:** el libro da `porTipo` = `[{0,1000},{0,50}]` sin `causa`. El 303 aparta el suplido **de la entrada S2**: `sinClasificar` = suplido 50, `tipo_cero` 950, `tipo_cero` 50. La suma cuadra (1050), pero la etiqueta va a la línea que no es y el aviso de «sin calificación» dice 2 donde hay 1. **Riesgo confirmado.**
- **Suplido primero:** sale bien (suplido 50, `tipo_cero` 1000).
- **De paso, otro más grave, anterior a 1063c:** una S2 con `tax: 0.21` (el validador de causa no exige `tax` 0) entra en la **casilla 07** del 21 % con base 1000 y cuota 0, sin aviso. La causa es la misma: el libro tira la `causa` al copiar `porTipo`.

### Riesgo residual, dicho

- Los dos casos de arriba siguen como estaban: arreglarlos pide que el libro conserve `causa` en `porTipo`, y eso es una decisión que se ha pedido en Jira.
- Si la marca de suplido es ilegible no hay aviso de suplido: queda en `tipo_cero`, como en 1063c.

## SCRUM-1063e · el libro guarda la causa S2 y el 303 la saca de la casilla de su tipo (J1, jv-j1bm, 24-oct-2026)

**Medido contra:** `origin/main` = `091e4d765ba13083b93fb6c168ffbd70fb1f1563` · 2026-10-24T10:55:33Z

A9: comprobación → `tests/scrum296-libro-registro.test.mjs`

Error propio: al importar el tipo `Causa` reescribí la línea `import { calcVatBreakdown }`, y ese guard (el libro reutiliza el cálculo del emisor) cayó en la dirigida. Se arregló el código con un `import type` aparte, no el guard.

Decisión del fundador: SCRUM-1063 c.20746 («Sí: guardar la causa y apartar la S2»), sobre la medición de c.20739. Rama sobre `scrum-1063d-aviso-suplidos` @ `ec68e591`, con `origin/main` mergeado dentro: **este PR depende de #2811 (1063c) y del PR de 1063d**, que a esta hora siguen sin mergear.

### Qué se ha construido

1. **El libro** (`libroRegistro.ts`): cada entrada de `porTipo` lleva `causa` **solo si la tiene**, al final y con la misma convención que `calcVatBreakdown` (SCRUM-1051). Sin S2 la entrada es la de antes, sin la clave. Base, cuota y total del asiento no cambian. No se toca `calcVatBreakdown` ni la emisión: el libro solo copia un campo que ya devolvía.
2. **El 303** (`modelo303.ts`): la entrada con `causa: 'S2'` sale **antes de mirar su tipo** y va a `sinClasificar` con `motivo: 'inversion_sujeto_pasivo'` (código, no texto). Los suplidos se apartan solo de las entradas sin causa.
3. **Aviso: ningún texto nuevo.** La S2 sigue contada en el aviso que ya existía, «operación(es) sin calificación fiscal (exenta / no sujeta / ISP)», para que un 303 con una base fuera de casilla no salga sin aviso. Es el texto que la S2 al 0 % ya daba antes de este ticket; la S2 con `tax: 0.21`, que antes caía en la 07 sin aviso, ahora también lo da. El literal propio se propone en Jira (regla 39).

### Cómo se ha medido

- **Rojo primero:** `tests/scrum1063e-causa-s2.test.mjs` contra el código de 1063d: caen 6 de 10. Los 4 que pasan en los dos son, a propósito, el `porTipo` byte a byte sin S2, «la causa no cambia base ni cuota», el cuadre libro = casillas + sin clasificar y el aviso existente.
- **Los dos casos de c.20739 son casos del test:** la S2 antes del suplido (`sinClasificar` = S2 1000 + suplido 50, sin `tipo_cero`) y la S2 con `tax: 0.21` (la 07 se queda con 800, la mano de obra).
- **Mutaciones sobre `dist/`** (7, restauradas y comprobadas): libro sin `causa`, caen 6 · `causa` siempre presente aunque sea `undefined`, cae 1 (el `Object.keys` del byte a byte; `JSON.stringify` se la come) · sin la rama S2, 5 · la rama S2 solo sin tripleta, 7 · la S2 con motivo `tipo_cero`, 5 · la rama S2 solo sin suplido pendiente, 1 · quitar `!e.causa` de los suplidos: **MUDA, y es esperado**: hoy `Causa` solo vale `'S2'` y la rama de arriba ya la ha apartado. Queda para cuando la lista de causas crezca.
- **`modelo390/` (#1077a, rama `scrum-1077a-borrador-390` @ `b57eb4bc`, sin mergear):** sus tres ficheros y su test, copiados un momento a este árbol y quitados después: 10 de 10. El 390 pasa `sinClasificar` del 303 tal cual (`...s`), y el código nuevo de motivo le llega como dato.
- **Guards dirigidos tras mergear main:** 57 ficheros (los que nombran `libroRegistro`, `modelo303` o `modelo390`, más 1063b/c/d/e, 1066c/e, 1065b, 1067b, 1232, 237, 976, 824, 836, 419, 702, 700, 719, 1415, 1294, 267, 273, 854, 622, 295, 296, 325, 389, 387 y 921): 606 casos, 602 pasan, 0 caen, 4 saltados (`LIBRO_PG_URL`). `tsc --noEmit` del proyecto, limpio.
- **Suite entera local: NO CORRIDA**; hace de tanda el obligatorio de CI. No hay pantalla del 303: en yaqu.app no se ha verificado nada.

### La casilla de la S2 en el impreso (leída, no aplicada)

Orden HAC/27/2026, Anexo III, leída como imagen el 24-oct:

- Página 1 (`https://www.boe.es/datos/imagenes/disp/2026/23/1761_16563944_7.png`, HTTP 200, 888.636 B): 12/13 «Otras operaciones con inversión del sujeto pasivo (excepto adq. intracom.)». Está en el **IVA devengado**: es la del destinatario que autorrepercute, no la de quien emite la S2.
- Página 3 (`https://www.boe.es/datos/imagenes/disp/2026/23/1761_16563944_9.png`, HTTP 200, 791.276 B), recuadro «Información adicional»: **122 «Operaciones sujetas con inversión del sujeto pasivo»**, una sola cifra, sin cuota.

Propuesta en Jira: la S2 a la 122, por su base. **No se ha puesto**: espera firma. No he leído las instrucciones del modelo, solo el impreso.

### Riesgo residual, dicho

- El aviso de «sin calificación» sigue contando la S2, y una S2 sí tiene calificación: es el texto viejo hasta que se firme uno propio.
- Si mañana se añade otra causa a `Causa`, irá con `!e.causa` fuera de los suplidos, pero sin rama propia: caerá en la casilla de su tipo. Lo sujeta el comentario de `vat.service.ts`, que obliga a ensanchar el tipo y su validador.
