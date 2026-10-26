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
## SCRUM-1063c · el rojo de scrum411 en el PR #2811 (J1, relevo jv-j1bq, 24-oct-2026)

**Medido contra:** `origin/main` = `091e4d765ba13083b93fb6c168ffbd70fb1f1563` · 2026-10-24T11:02:38Z

A9: comprobación → `tests/scrum411-exports-inalcanzables.test.mjs`

Fue el que cazó en el obligatorio que el import nuevo de `libroRegistro.ts` resucitaba `suplidos.ts`; la dirigida del tramo de arriba no lo incluía.

### Qué decía el guard

Al importar `partirPorSuplido`, `suplidos.ts` deja de ser un módulo inalcanzable (4 de 173, tope 5) y sus exports sin consumidor de fuera entran en la segunda población sin declarar (medidos 250, declarados 245). El consejo del clasificador, export por export: **declarar** `desgloseConSuplidos` y `totalSuplidos`; **quitar el `export`** a `MARCA_SUPLIDO`, `leerMarcaSuplido` e `importeSuplido`.

### Por qué se puede tocar

`suplidos.ts` es carril J1 (`node scripts/carriles.mjs de …` → `dos-equipos.md:117`) y **no es camino de emisión**: `scrum389-censo-vat` lo clasifica `DOCUMENTO` (línea 83). Quitar un `export` no cambia ningún número: `dist/` compilado sólo pierde las tres líneas `exports.X = X`.

### Qué se ha hecho

1. Tope de inalcanzables **5 → 4**, con su entrada en `scrum411`.
2. `desgloseConSuplidos` y `totalSuplidos`, declarados `MOTOR_EN_ESPERA` en `_huerfanos-declarados.mjs`: cablearlos cambia lo que se sella (regla 38, c.20717).
3. Sin `export`: `MARCA_SUPLIDO`, `leerMarcaSuplido`, `importeSuplido`. El análisis por AST de `scrum411` dice que su consumidor está dentro del módulo y que de fuera sólo entran `scrum500-suplidos` y `scrum844f`; un `grep` de los tres nombres en `src/`, `tests/`, `public/` y `scripts/` da lo mismo (más comentarios y el literal propio de `quoteSuplido.js`). Esos casos se reescriben por la superficie pública (`partirPorSuplido`, `totalSuplidos`), con la clave escrita a mano. El de «front y dominio usan la misma clave» pasa a medir COMPORTAMIENTO: una línea marcada con la clave del front tiene que salir apartada, y con otra clave no.

⚠️ Precedente contrario, dicho: en SCRUM-293 (`_huerfanos-declarados.mjs`, bloque de `retencionIrpf.ts`) se declararon en vez de des-exportar, «para no tocar un módulo fiscal por un contador». Aquí el orquestador ordenó aplicar el consejo del guard, condicionado a que el fichero no fuera de emisión.

### Cómo se ha medido

- Rojo primero: los 3 de scrum411 en local antes de tocar nada, con las mismas cifras que el obligatorio (4/5, 250/245).
- Mutaciones sobre `dist/` contra los casos reescritos: la clave del dominio renombrada → caen 7; la línea que no es objeto leída como normal → 1; la marca ilegible aceptada → 2. Restaurado con `cmp`.
- Dirigida en el comentario de Jira, con su población. **Suite entera local: NO CORRIDA.**

## SCRUM-1063d · el aviso de suplidos en dos formas, sin «(s)» (J1, jv-j1bs, 24-oct-2026)

**Medido contra:** `origin/main` = `1b3395ecc6d3524e7b4ec711871d1d485ee67f28` · 2026-10-24T14:36:40Z

A9: comprobación → `tests/scrum377-plural-de-programador.test.mjs`

El obligatorio de #2825 cayó en `scrum377` («HAY 7 «(s)» EN TEXTO DE PANTALLA y el tope es 6 … modelo303.ts → suplido(s)»; job `120864632581`). La dirigida del tramo 1063d de arriba no lo incluía. Medición y preguntas en c.20796. El fundador eligió cambiar el texto y NO subir el tope (c.20797, regla 39). Esa firma sustituye a c.20731.

### Qué se ha hecho

1. `modelo303.ts`: el aviso de suplidos se parte en las dos formas firmadas en c.20797, singular para n = 1 y plural para el resto. Los literales se han cotejado por programa con el texto del comentario. El tope de `scrum377` no se toca.
2. `tests/scrum1063d-aviso-suplidos.test.mjs`: fija el singular (n = 1) y el plural (n = 2 y n = 3) por igualdad exacta. Añade un caso nuevo: ningún aviso de suplidos lleva «(s)», con su positivo, que exige que el aviso exista. Los controles casan las dos formas con UN token, `HABLA_DE_SUPLIDOS`.
3. `tests/scrum1063c-suplido-y-casilla-64.test.mjs`: sus dos aserciones de igualdad pasan al singular firmado. Siguen siendo igualdad exacta, así que no son más laxas.

### Cómo se ha medido

- **Rojo primero:** con el literal viejo en `dist/`, caen 7 de 20 (los dos ficheros).
- **Mutaciones sobre `dist/`**, sobre 20 casos: siempre plural, caen 4; siempre singular, 1; sin el punto final, 4; umbral `> 1`, 6. Se restauró el `dist/` bueno y la base volvió a 20 de 20.
- **Dirigida** (1063b/c/d, 1066c/e, 1077, 1232, 237, 976, 824, 824b, 836, 419, 702, 700, 719, 1415, 377, 296, 411, 500, 844f, 622, 295 y 389): 31 ficheros, 307 casos, 303 pasan, 0 caen, 4 saltados (`LIBRO_PG_URL`). Control positivo: el caso del trinquete de 377 está en el TAP, y pasa.
- **Suite entera local: NO CORRIDA**; hace de tanda el obligatorio de CI.

### Error propio

Al reescribir los tests pasé un `\\b` por `node -e` desde bash, y en el fichero entró un carácter de retroceso (0x08) en lugar de `\b`. El control positivo del test nuevo lo cazó: daba 0 avisos donde había 1. Lo quité con un script escrito con la herramienta de escritura, y el recuento de caracteres de control en los tres ficheros tocados da 0. Es la cicatriz J1 del 2026-10-01 (texto por la línea de órdenes) repetida.

## SCRUM-1063f · la S2 del emisor a la casilla 122, y el aviso firmado para la que queda fuera (J1, jv-j1bs, 24-oct-2026)

**Medido contra:** `origin/main` = `bcfc99b0d9a4f4a3aaf9d1608dce06b3d3691482` · 2026-10-24T15:25:00Z

A9: comprobación → `tests/scrum1063f-s2-casilla-122.test.mjs`

Decisión c.20768 («Sí, a la 122») y firma c.20797, que sustituye al aviso de c.20768. Encima de 1063c, 1063d y 1063e, ya en `main`: #2811, #2825 (merge `052f6e94003a74af6a770dd826aedfaa79e60e0d`) y #2835 (merge `bcfc99b0d9a4f4a3aaf9d1608dce06b3d3691482`).

### Las instrucciones, leídas antes de escribir (condición de c.20768)

Fuente: las instrucciones de la AEAT para 2026, «Instrucciones 02 a 12 y 2T a 4T de 2026» (`sede.agenciatributaria.gob.es/…/modelo-303-iva-autoliquidacion_/instrucciones-2026/instrucciones-02-12-2t-4t-2026.html`), bajadas el 24-oct a las 15:11Z (cabecera `Date`). Texto, literal:

> 122 Operaciones sujetas con inversión del sujeto pasivo: se hará constar el importe total, en el período objeto de declaración, de: Las entregas de oro a las que sea de aplicación la regla contenida en el artículo 84, apartado Uno, número 2º, letra b) de la Ley y las entregas de oro de inversión a que se refiere el artículo 140 de la misma Ley. Las entregas de bienes y prestaciones de servicios realizadas a que se refiere el artículo 84 Uno. 2º a), c), d), e), f) y g) de la Ley.

**No contradicen al impreso.** Es la casilla del que EMITE, va en «Información adicional», es un importe sin cuota y no suma en el resultado. La Orden HAC/27/2026 del BOE no trae instrucciones: sus cinco anexos son impresos. Una búsqueda atribuía a la 122 la condición del art. 74.1 RIVA; en el texto, esa condición es de la **77**.

### Qué se ha construido

1. `casillas.ts`: `CASILLA_INVERSION_SUJETO_PASIVO = 122`, con el impreso y las instrucciones citados.
2. `modelo303.ts`: hay un campo nuevo, `informacionAdicional.inversionSujetoPasivo` = `{ casilla: 122, base, operaciones[] }` (una operación por entrada S2 del libro). Ese es el camino de la S2 con **cuota 0**. La S2 **con cuota** no cabe en la 122, que no tiene cuota: llevarla allí rompería `libro.cuota = 27 + cuota sin clasificar`. Esa se queda en `sinClasificar` con `inversion_sujeto_pasivo` y es la única que lleva el aviso firmado, en singular o en plural. La S2 deja de contar en el aviso de «sin calificación», porque sí tiene calificación. El aviso de «TODAS las casillas a cero sin nada declarado aparte» ya no salta si lo que hay está en la 122. El invariante de la cabecera suma la 122.
3. **Para no perderla en silencio:**
   - El 390 suma `sinClasificar`, y la S2 habría desaparecido del anual. Ahora sigue saliendo declarada con su trimestre, igual que antes de 1063f, porque su casilla en el 390 NO está decidida. Diferencia: va al final de las del trimestre y no en el orden del libro.
   - El CSV del 303 en el paquete de evidencias lleva una fila `122;;;INVERSION_SUJETO_PASIVO <número>;<base>;`.
4. Tests:
   - `scrum1063e`: sus casos de la S2 pasan a fijar la 122 por igualdad exacta, con `sinClasificar` vacío. El cuadre suma la 122, con un positivo de 2000.
   - Fixtures de `scrum297-paquete-piezas` y `scrum438-atestiguar`: llevan el campo nuevo.
   - `_veredicto-mudez.json`: regenerado con `npm run censo:mudez -- --escribir` porque `scrum438` cambió. Resultado: VIVO.

### Cómo se ha medido

- **Rojo primero**, con `dist/` del código de 1063e: el test nuevo da 10 de 11 rojos y `scrum1063e` reescrito da 7 de 10.
- **Literales:** cotejados por programa contra el texto del comentario c.20797. Los dos, idénticos en código y test.
- **Mutaciones sobre `dist/`**, sobre 21 casos (1063f + 1063e). Caen todas:

  | mutación | caen |
  |---|---|
  | la S2 a sin clasificar | 12 |
  | toda S2 a la 122 | 4 |
  | contarla en «sin calificación» | 3 |
  | sin aviso | 4 |
  | siempre plural | 2 |
  | base 0 | 7 |
  | «TODAS a cero» sin mirar la 122 | 1 |
  | el 390 no la traspasa | 1 |
  | el CSV sin la fila | 1 |

  Restaurado con `cmp`, y la base vuelve a 21 de 21.
- **Dirigida**, antes de mezclar main: la lista de 1063d más todo test que nombra `modelo303`, `modelo390`, el paquete, `motivosParaNoFiarse` o `informacionAdicional`, en total 58 ficheros. Cayeron dos, los dos por mí:
  - `scrum719` (1395b): el veredicto de mudez caducado por `scrum438`. Regenerado.
  - `scrum976` → `scrum811c`: midió la cadena justo cuando `origin/main` se movió 16 commits (entraron #2825 y #2835) y nombró mi merge local `23f3a5cde`. Repetido tras mezclar main: ver el comentario de Jira.
- `tsc --noEmit`: limpio. `scrum1077` (390): verde dentro de la dirigida.
- **Suite entera local: NO CORRIDA**; hace de tanda el obligatorio de CI. **yaqu.app: NO HECHO**, porque no hay pantalla del 303.

### Riesgo residual, dicho

- La S2 con cuota es **inalcanzable hoy**: `calcVatBreakdown` da cuota 0 también a una S2 con `tax: 0.21`. El aviso firmado sólo sale con un libro fabricado. Existe porque la decisión lo pide («si alguna S2 queda fuera») y para que un cambio del cálculo no la meta en la 122 perdiendo su cuota.
- La 122 recoge TODA S2 del libro. Las instrucciones la limitan al art. 84.Uno.2º (y al oro). Que cada S2 de YaQu sea de ese artículo no lo he medido: la factura no guarda la letra.
- Las rectificativas suman con su signo en la 122: el libro no las distingue (aviso `rectificativas_sin_casilla_propia` del 390).
- Para el 390 no hay casilla decidida: la S2 sigue «sin clasificar» en el anual.

## SCRUM-1063g · casillas 30/31 (bienes de inversión): medición y propuesta, sin ALTER (J5, jv-j5am, 26-oct-2026)

**Medido contra:** `origin/main` = `289ca894656c7c3686a0469d34785512b960e0b3` · 2026-10-26T15:18:32Z

A9: sin fallo que generalice — es una medición sin código; el riesgo que no estaba escrito («otros» manda a la 28/29 un bien de inversión) queda en este tramo y en la pregunta 4 de Jira c.20863

**Encargo:** orquestador `cobroflash-backend-8b`, «SOLO MEDIR Y PROPONER». Ni ALTER, ni `db push`, ni código, ni texto de pantalla. Lo entregado está en Jira, c.20863 (preguntas ✅/❌ incluidas). Aquí va lo que hay que poder volver a medir.

### PASO 0

- `git log origin/main --grep=SCRUM-1063`: 1063b a 1063f, y nada de 1063g. `git ls-remote origin 'refs/heads/scrum-1063*'` sale vacío. `gh pr list --search 1063` sólo enseña #1656 (mergeado).
- El ticket lleva `area-j1` y `equipo-javier`. Este tramo es sólo docs: `carriles.mjs de docs/master/SCRUM-1063.md` → sin cerradura, «quien trabaja el ticket».

### La norma, con su fuente

- **Art. 108 LIVA** (`BOE-A-1992-28740`, bloque `a108` de `datosabiertos/api/legislacion-consolidada`): una sola versión, vigente desde el 1-1-1993. Control: el bloque `a91` de la misma API trae 44 versiones (la última, del 8-10-2026), así que la API sí devuelve historial.
  - Uno: «se considerarán de inversión los bienes corporales, muebles, semovientes o inmuebles que, por su naturaleza y función, estén normalmente destinados a ser utilizados por un período de tiempo superior a un año como instrumentos de trabajo o medios de explotación.»
  - Dos.5.º: no lo son los bienes «cuyo valor de adquisición sea inferior a quinientas mil pesetas». 3.005,06 € es una conversión MÍA (500.000 / 166,386): el texto consolidado sigue en pesetas.
- **Instrucciones del 303 de 2026** (la misma URL de sede que cita `casillas.ts:127`), bajadas a las 15:15Z, HTTP 200, 113.580 B. Control: en esa página está el literal de la 122 que citó 1063f. Para la 28 a la 39 dicen: «distinguiendo si se trata de operaciones corrientes u operaciones con bienes de inversión (Artículo 108 LIVA)». El impreso no añade ningún criterio propio.
- Lo que cuelga del mismo dato y queda FUERA de este tramo: la 43 (regularización, arts. 107-110 LIVA), la 99 (entregas de bienes de inversión, que se restan en la 88) y el **art. 65 RIVA** (`BOE-A-1992-28925`, bloque `a65`, vigente desde el 1-7-2017). El art. 65 pide un libro de bienes de inversión, con cada bien «debidamente individualizado», a quien «tenga que practicar la regularización».

### El código (leído, no ejecutado sobre datos)

- `model Expense` no tiene ningún campo que separe lo corriente de la inversión. `EXPENSE_CATEGORIES` (`src/modules/expenses/domain/expenses.service.ts:6`) = materiales, desplazamiento, herramientas, subcontrata, otros. `alquiler` no se puede escribir hasta SCRUM-1588 (S1 y S2, por hacer).
- `construirIvaDeducible` (`src/modules/fiscal/modelo303/modelo303.ts`): «herramientas» se aparta entera (`posible_bien_de_inversion`), y el resto de `CATEGORIAS_CORRIENTES` va a la 28/29. 30/31 a 0, con `vaciaPorque`. En el 390 pasa lo mismo con la 50/51 (`modelo390/casillas.ts:69`).
- La 45 es 29 + 31 + … (`casillas.ts:61`). **Si un gasto va a la 29 o a la 31, el resultado (46) no cambia.** Lo que sí cambia hoy el resultado es apartar las herramientas: ese IVA no se deduce en el borrador.
- **Riesgo no escrito hasta hoy:** un bien de inversión apuntado en «otros» (una furgoneta, un ordenador) va a la 28/29 sin aviso.

### Las tres alternativas

- **A · Umbral, sin ALTER (J1).** «herramientas» con base + cuota < 3.005,06 € → 28/29; las que llegan o pasan siguen apartadas. Sólo es seguro en ese sentido: si el gasto ENTERO no llega, ningún bien que lleve dentro llega (108.Dos.5.º), y como base + cuota ≥ base, la conclusión vale con IVA o sin él.
- **B · Categoría nueva, sin ALTER (S1 + S2 + J1, con rótulo firmado).** Mezcla QUÉ es el gasto con CUÁNTO dura, y «herramientas» sigue ambigua. No se recomienda.
- **C · ALTER mínimo (J5 + J1 + S1 + S2).** `bienDeInversion Boolean? @map("bien_de_inversion")`, sin `@default` (convención de `vatDeducible`: null = nadie lo clasificó).
  - DDL, salido de `previewMigracion` (`scripts/preview-migracion.mjs`, modo `--desde`, sin conectar a ninguna base) sobre dos copias del esquema en el temporal de la sesión. **No se ha aplicado, y `prisma/schema.prisma` no se ha tocado:** `ALTER TABLE "expenses" ADD COLUMN "bien_de_inversion" BOOLEAN;`
  - Controles: igual → igual da `-- This is an empty migration.` (`sin_cambios`). El control positivo de la casa ve 33 tablas = 33 `model` (`grep -c "^model "`).

Recomendación de J5: **A ahora; C después, preguntando sólo a partir del umbral.** Las cuatro preguntas para el fundador y las cuatro del asesor (valor con o sin IVA, umbral por unidad, art. 65 RIVA con el 100 % deducible, vehículos y art. 95.Tres sin leer) están en c.20863.

### Sin medir

- Cuántos gastos reales caen a cada lado del umbral: no se ha tocado ninguna base.
- El detalle de las instrucciones de la 43 y la 99, visto sólo de pasada.
- **Suite: NO CORRIDA** (sólo docs); los guards de registro, en la entrega. En yaqu.app no hay nada que ver.
