# SCRUM-1066 · Modelos 111 y 115 — medir qué datos hay (paso 1 de la aceptación)

**Medido contra:** `origin/main` = `e2f715939d0e27ca2661821e1b57292d4ec1c3cc` · 2026-09-22T08:57:39Z
**Rama:** `scrum-1063-lote-contabilidad-modelos` · **Puesto:** J1 · **Encargo:** orquestador, 22-sep-2026

## PASO 0 — no hay nada construido con otra redacción

`git log --oneline -- src/modules/fiscal` y un grep por `303|347|390|111|115|modelo|trimestre` no
encuentran ningún módulo de retenciones PRACTICADAS. Sí existe `src/modules/fiscal/modelo303/`
(SCRUM-295), que es otro ticket de este mismo lote (1063/1064) y no toca esto.

## El paso 1 de la aceptación era MEDIR, sin código. Esto es la medición.

**Pregunta:** ¿guarda YaQu hoy algún dato de una retención que el PROPIO profesional PRACTICA al
pagar a otro (empleado, subcontrata, alquiler del local)?

**Método:** grep de `retenci` (sin acento, case-insensitive) sobre `prisma/schema.prisma` y sobre
`src/`, más lectura de los dos sitios que el ticket señala (`retencionIrpf.ts:110,129`) y del
modelo `Expense`.

**Resultado — un solo eje, y es el otro:**

- `prisma/schema.prisma:168-169` — las únicas dos columnas de retención de todo el esquema:
  `retencionIrpfDeclarada` / `retencionIrpfTipo`, en el modelo `Merchant`. Por su propio
  comentario (`schema.prisma:155-167`, autorización expresa del fundador en SCRUM-293): declaran
  si al profesional **le retienen** sus clientes al pagarle sus facturas — la retención que
  **sufre**, no la que practica.
- `src/modules/invoicing/domain/retencionIrpf.ts` entero (líneas 90-150 leídas) calcula sobre esas
  mismas columnas: `calcularRetencion`, `liquidoAPercibir`, `bloqueRetencion` — todo restando del
  **total que cobra** el profesional. Es el dato que alimenta el 130 (SCRUM-1065), no el 111/115.
- `model Expense` (`schema.prisma:929-959`): `concept`, `amount`, `category` (incluye
  `subcontrata`), `baseAmount`, `vatRate` — **ningún campo de retención**. Un gasto de categoría
  `subcontrata` no distingue si esa factura llevaba una retención practicada.
- Cero resultados de `retenci` en `expenses.service.ts` y en cualquier fichero de `Empleado`
  (`TeamMember`) o de nóminas: no existe el concepto de nómina ni de pago a un empleado con
  retención en este esquema.
- El propio `retencionIrpf.ts:110,129` que cita el ticket son comentarios de diseño (el redondeo y
  el signo), no código de un eje distinto: no hay una segunda función ni una segunda tabla ahí.

**Conclusión medida, no deducida:** YaQu hoy **no guarda ningún dato** de una retención que el
profesional practique sobre un pago a un tercero. El único eje de retención que existe en el
producto es el que el ticket 1065 ya usa (la sufrida). La sospecha del propio ticket
("es probable... confirmar") queda **confirmada**.

## El ticket termina aquí, con la propuesta (aceptación punto 2)

No se construye pantalla sobre datos inexistentes (punto 2 de la aceptación). Propuesta de datos
mínimos, **sin aplicar** — el ALTER lo decide y lo aplica Javier (A5), y solo tendría sentido una
vez el asesor confirme Q-C8 (plazos/quién declara) y la orden del 111/115 esté citada
(SCRUM-1039), porque hoy no se sabe ni siquiera si YaQu es sujeto obligado a estos modelos con su
volumen de operaciones:

- `Expense.retencionPracticadaTipo` (Int?, nullable = "no consta") y
  `Expense.retencionPracticadaBase` (Decimal?, cuando difiera de `baseAmount`) — el mismo patrón de
  dos-por-el-null que ya usa `retencionIrpf` en `Merchant` (tres estados, no dos), aplicado por
  gasto en vez de por merchant, porque la retención practicada varía factura a factura, no es una
  política fija del profesional.
- Para nómina de empleados (si el oficio la tiene): no hay ni siquiera un concepto de "pago a
  empleado" en el esquema — `TeamMember` es una cuenta de acceso, no un beneficiario de pagos. Eso
  sería un modelo nuevo, no una columna, y está fuera de alcance de esta medición.

## STOP respetado

No se ha tocado `prisma/schema.prisma`, ni el camino de emisión, ni ningún flag. Solo lectura y
este documento.

---

# SCRUM-1066b · El dato ya existe; verificación de citas y qué sigue bloqueado

**Medido contra:** `origin/main` = `75036412164ce2d806d973341ba1440283048f75` · 2026-09-23T19:07Z
**Rama:** `scrum-1066b-citas-111-115-verificadas` · **Puesto:** J1 · **Encargo:** orquestador, 23-sep-2026

## PASO 0 — el eje que faltaba ya está en `main`

SCRUM-1103 (PR #1745) mergeó a `main` en el commit `75036412` (padre `f4be1800`), minutos antes de
esta medición. `prisma/schema.prisma` (modelo `Expense`) ya trae `retencionPracticadaTipo` (Int?),
`retencionPracticadaCuota` (Decimal(12,2)?) y `retencionPracticadaDeclarada` (Boolean?);
`expenses.service.ts` ya escribe `tipo`/`cuota` en `createExpense` (`declarada` a propósito NO —
decisión explícita dejada para este ticket, ver PASO 4). La conclusión de la sección de arriba
("YaQu hoy no guarda ningún dato...") queda **superada por el código, no por este documento**: el
ALTER está aplicado en las tres bases (prod y staging por Javier, dev verificado por la sesión
anterior contra `information_schema.columns`).

## PASO 1 — lo que trajo el asesor hoy (SCRUM-1106), y lo que de eso queda VERIFICADO

`docs/master/SCRUM-1106.md` y `docs/legal/PREGUNTAS_ASESOR.md` (Q-C8) traen la respuesta del asesor
de hoy, con sus citas marcadas ⚠ (de memoria, NO VERIFICADO hasta cotejo). El encargo de esta tanda
pide cotejar tres de esas citas contra el BOE — método: `curl` sobre el consolidado, nunca WebFetch
(la lección de SCRUM-1039c: WebFetch fabricó un artículo duplicado que no existe en la fuente).

**Descargado hoy, 2026-09-23 ~19:05Z, con GET público** (ficheros fuera de git, no persistidos —
mismo criterio que `CONTABILIDAD.md` §8):

| fuente | URL | tamaño |
|---|---|---|
| LIRPF · Ley 35/2006 | `https://www.boe.es/buscar/act.php?id=BOE-A-2006-20764` | 1.917.683 B |
| RIRPF · RD 439/2007 | `https://www.boe.es/buscar/act.php?id=BOE-A-2007-6820` | 965.153 B |

**Las tres citas que el orquestador señaló, cotejadas literalmente contra ese texto:**

1. **Art. 99 LIRPF** (obligación de retener) — ✅ **VERIFICADA**: *"quienes ejerzan actividades
   económicas respecto a las rentas que satisfagan o abonen en el ejercicio de dichas
   actividades"* están sujetos a la misma obligación de practicar retención. Confirma que un
   autónomo que PAGA (no solo el que cobra) puede estar obligado a retener.
2. **Art. 74 RIRPF** (obligación de practicar retenciones) — ✅ **VERIFICADA**: remite al art. 76
   (obligados) sobre las rentas del art. 75 (sujetas).
3. **Art. 75 RIRPF** (rentas sujetas) — ✅ **VERIFICADA** y trae el detalle que el 111/115
   necesitan:
   - 75.1.c: *"Los rendimientos de actividades profesionales"* sujetos a retención → base del 111.
   - 75.2.a: *"Los rendimientos procedentes del arrendamiento o subarrendamiento de inmuebles
     urbanos"* sujetos a retención → base del 115.
   - 75.3.g: **las tres excepciones del 115, literales y con su numeración real**: *"1.º Cuando se
     trate de arrendamiento de vivienda por empresas para sus empleados. 2.º Cuando las rentas
     satisfechas por el arrendatario a un mismo arrendador no superen los 900 euros anuales. 3.º
     Cuando la actividad del arrendador esté clasificada en alguno de los epígrafes del grupo 861
     [...] y aplicando al valor catastral [...] no hubiese resultado cuota cero. [...] el
     arrendador deberá acreditar frente al arrendatario el cumplimiento"* — coincide con lo que dio
     el asesor (≤900 €/año, epígrafe 861 + acreditación), **con una salvedad**: la cifra concreta
     "601.012 €" que dio el asesor NO aparece en este artículo — depende de las tarifas del grupo
     861 (RDLeg 1175/1990, tablas del IAE), fuente que NO he descargado esta pasada. Ese número
     concreto sigue **NO VERIFICADO**.
4. **Art. 76.1.b RIRPF** (obligados a retener) — ✅ **VERIFICADA**: *"Los contribuyentes que ejerzan
   actividades económicas, cuando satisfagan rentas en el ejercicio de sus actividades"* — confirma
   textual del asesor: el que PAGA (el autónomo/oficio) es quien retiene y presenta, no quien cobra.
5. **Art. 100 RIRPF** (importe de la retención en alquileres) — ✅ **VERIFICADA**, y es un dato
   nuevo útil: *"el resultado de aplicar el porcentaje del 19 por ciento sobre todos los conceptos
   que se satisfagan al arrendador, excluido el [IVA]"* (reducido 60 % en Ceuta/Melilla) — el TIPO
   del 115 es 19 %, no estaba citado en ningún sitio del repo hasta ahora.

**Lo que NO verifiqué esta pasada** (fuera del alcance de las tres citas señaladas):
- El tipo exacto de retención para profesionales que alimenta el 111 (15 % / 7 % inicio actividad)
  YA estaba verificado antes de hoy: `CONTABILIDAD.md` §3, `RIRPF art. 95.1`.
- **Las casillas concretas del impreso** (lo que pide el punto 3 de la aceptación del ticket): las
  órdenes EHA/586/2011 (111) y de 20-nov-2000/HAC-1276-2020 (115) que localizó SCRUM-1039 remiten el
  diseño del impreso a un **Anexo en PDF** (`BOE-A-2011-4948-consolidado.pdf` y equivalente), no a
  texto en el HTML consolidado — comprobado con `curl` + grep de "casilla": cero resultados en el
  articulado. Extraer los números de casilla del PDF es trabajo aparte, no hecho aquí.
- El resto de citas de Q-C8 (RGAT, RIVA nuevos, art. 107 LCSP, etc.) — no las tocan 111/115 y son de
  CON-03 (S0 + J4), no de este ticket.

## PASO 2 — lo que dijo el asesor y ya se puede usar como criterio de clasificación (111 vs. 115)

Con las citas de arriba respaldando la sustancia (no la letra exacta de cada frase del asesor, que
sigue marcada ⚠ donde no la cotejé palabra por palabra):

- **111** — genera 111 una factura recibida de un PROFESIONAL (no empresarial) con retención:
  gestoría, arquitecto, aparejador, abogado. NO genera 111: facturas de otro oficio, de proveedores
  de material, ni las propias emitidas por YaQu. Nóminas de empleados también generan 111, pero ese
  concepto no existe hoy en el esquema (`TeamMember` es cuenta de acceso, no beneficiario de pagos —
  ya lo decía la medición de la sección de arriba, sigue igual).
- **115** — alquiler de inmueble urbano AFECTO a la actividad (el local). Si trabaja desde casa sin
  pagar alquiler, no hay 115. Tres excepciones (verificadas arriba): ≤900 €/año al mismo arrendador
  · arrendador en epígrafe 861 con cuota cero acreditada (cifra catastral exacta sin verificar) ·
  vivienda no afecta.
- **190/180** — resúmenes anuales del 111/115 respectivamente: mismos datos, no piden captura nueva.

## PASO 3 — por qué esto NO construye todavía el borrador (punto 3 de la aceptación)

El propio `docs/producto/CONTABILIDAD.md` §7 (decisión **D2**, aún SIN decidir por el fundador):
*"¿Los modelos 130/111/115/347 salen solo como borrador pre-rellenado para el asesor y solo tras
CON-03?"* — recomendado «sí», no decidido. Y §6 clasifica este ticket (CON-12) en **Ola 3, "grande;
solo tras las anteriores"**, detrás de CON-03 (completar TODAS las citas, no solo las tres de hoy).
Construir la pantalla ahora adelantaría una decisión del fundador y un ticket que no es mío
(CON-03). Además, cualquier pantalla lleva texto — «borrador para tu asesor», las etiquetas de cada
campo — y regla 39 exige firma del fundador antes de escribir ese texto: no lo invento aquí.

## PASO 4 — lo que SÍ queda listo para cuando se decida avanzar

- El cubo de clasificación 111 vs. 115 de arriba (PASO 2), citado, listo para que quien construya la
  pantalla no tenga que volver a preguntárselo al asesor.
- La `retencionPracticadaDeclarada` (SCRUM-1103, `Expense`) es exactamente el campo de tres estados
  que este ticket necesitaba para no confundir "sin clasificar" con "sin retención" — ya construido,
  no hace falta tocar schema de nuevo.
- Falta, antes de construir pantalla/rutas: (a) decisión D2 del fundador, (b) casillas exactas del
  PDF anexo de cada orden, (c) firma del fundador para el texto de pantalla y para "las cuatro
  preguntas de alta" que propuso el asesor (`PREGUNTAS_ASESOR.md`, Q-C8 — ya marcado ahí como
  "propuesta de producto, no texto de pantalla: sin firma no se implementa").

## STOP respetado

No se ha tocado `prisma/schema.prisma`, el camino de emisión, ningún flag, ni se ha escrito texto
de pantalla. Solo lectura, dos descargas BOE por `curl` (no persistidas) y este documento.

---

# SCRUM-1066c · El borrador del 111 y del 115, sin pantalla

**Medido contra:** `origin/main` = `c4921cd1284049bff83dcb32d2cba551e3072233` · 2026-10-23T04:09:12Z
**Rama:** `scrum-1066c-borrador-111-115` · **Puesto:** J1 (sesión `jv-j1ah`) · **Encargo:** orquestador `cobroflash-backend-62`, 22-oct-2026 · **Desbloqueo:** D2, Jira c.16699

A9: comprobación → `tests/scrum1387-banco-nuevo-va-al-catalogo.test.mjs`

## PASO 0

- `src/`: ningún constructor de 111/115. `retencionPracticada` sólo aparece en `expenses.service.ts`.
- `git log origin/main --grep=SCRUM-1066`: 1066 y 1066b, los dos de medición, sin código. Y con `-S "modelo111"` desde el 20-sep, nada.
- JQL `text ~ "modelo 111" OR text ~ "modelo 115"`: 16 tickets, ninguno construye el borrador con otro número.
- Etiquetas de SCRUM-1066: `equipo-javier`, `area-j1`.

## Qué se ha hecho

| fichero | qué |
|---|---|
| `src/modules/fiscal/retenciones/casillas.ts` | las casillas, cada una con su fuente (orden, anexo, página y URL de la imagen) |
| `src/modules/fiscal/retenciones/retencionesPracticadas.ts` | `construirBorradorRetenciones`: pura, sin base de datos |
| `src/modules/fiscal/retenciones/retencionesPracticadas.repo.ts` | `leerBorradorRetenciones`: un `findMany` filtrado por `merchantId` y por el trimestre (fecha del apunte, el mismo criterio que el 303 y el libro de recibidas) |
| `tests/scrum1066c-borrador-111-115.test.mjs` | 10 casos con datos fabricados y cifras a mano por perceptor, más `MUTACIONES_QUE_ME_TUMBAN` (10) |
| `docs/master/evidencias/scrum1066/casillas-111-115.md` | la transcripción de los dos impresos |
| `scripts/_sin-consumir-declarados.json` | las 9 piezas sin consumidor, declaradas como J1 y con motivo (SCRUM-1185): no hay ruta, a propósito |

**Sin ruta, sin pantalla, sin texto que vea el usuario, sin esquema y sin tocar la emisión.** El aviso
viaja dentro del resultado, y es el MISMO `AVISO_ORIENTATIVO` del 303, importado: no hay texto nuevo.
Los motivos van como códigos (`gastos_sin_clasificar`, `ninguna_retencion_anotada`), no como frases.

## Casillas: de dónde salen

Método de SCRUM-1039b: `curl` del BOE y lectura visual del PNG del anexo, porque el articulado no las
trae. La leyó un subagente y yo volví a mirar las dos páginas por mi cuenta: coinciden.

- **111** · Orden EHA/586/2011, Anexo I, pág. 1 (`https://www.boe.es/datos/imagenes/disp/2011/66/04948_001.png`).
  Consolidado sin sustitución del anexo («Texto inicial publicado el 18/03/2011»).
- **115** · Orden de 20-nov-2000, Anexo II (euros), pág. 1 (`https://www.boe.es/datos/imagenes/disp/2000/285/21430_005.png`).

⚠️ **NO comprobado:** que sea el impreso que la AEAT usa HOY. Lo único que se sabe es que el BOE no
registra ninguna sustitución de esos anexos, y eso dice que son los últimos PUBLICADOS. No se ha
cotejado con el formulario electrónico vigente: va al asesor.

## Población cubierta — qué casillas sí y cuáles no

| modelo | casilla | ¿se rellena? | por qué |
|---|---|---|---|
| 111 | 07 · 08 · 09 (actividades económicas, dinerarios) | **sí** | gastos con retención anotada al 15 % o al 7 % (RIRPF art. 95.1) |
| 111 | 28 (suma de retenciones) | **sí** | = 09: es el único sumando con dato |
| 111 | 29 (a deducir) | a 0 | sólo existe en la complementaria, que no está construida |
| 111 | 30 (resultado) | **sí** | 28 − 29 |
| 111 | 01-06 (trabajo) | **no** | no hay nóminas en el esquema (`TeamMember` es una cuenta de acceso) |
| 111 | 10-12 (actividades en especie), 13-18 (premios), 19-24 (aprovechamientos forestales), 25-27 (derechos de imagen) | **no** | ningún dato de YaQu los representa |
| 115 | 1 · 2 · 3 · 5 | **a 0, con `vacioPorque: 'sin_dato_de_arrendamiento'`** | ver abajo |
| 115 | 4 (a deducir) | a 0 | complementaria |

**Por qué el 115 sale a cero.** Nada en `Expense` dice que un gasto sea el ALQUILER de un inmueble
(`category` = materiales|desplazamiento|herramientas|subcontrata|otros). El 19 % es el tipo del alquiler
(RIRPF art. 100, verificado en 1066b), pero no es el único 19 %. **Decisión A del orquestador
(22-oct-2026):** clasificar por el tipo sería inventarse el dato. El 19 %, y cualquier tipo que no sea
15 o 7, va a `sinClasificar` con su dinero (`tipo_sin_modelo`). **La opción C —una categoría «alquiler»
en el gasto— es una propuesta de esquema para el fundador. No está construida.**

Además, fuera de la población: la periodicidad MENSUAL (grandes empresas) y el 190/180 anuales.

**El invariante**, que el test comprueba al céntimo: Σ cuota anotada = 09 + 3 + sin clasificar.
Lo que no se coloca se declara, cada cosa con su motivo: `sin_tipo`, `sin_cuota` (la cuota se guarda,
no se recalcula), `sin_base`, `sin_perceptor` (sin proveedor no hay «nº de perceptores»),
`importe_ilegible` y `tipo_sin_modelo`. «No lleva retención» (tipo 0 o `declarada === false`) y
«nadie lo dijo» (todo a `null`) se cuentan aparte, y si TODOS los gastos del periodo están en el
segundo caso sale `ninguna_retencion_anotada`: un 111 a cero no informa de nada, y tiene que decirlo.
Un gasto de otro comercio rompe (regla 2), no se descarta en silencio.

## Aceptación → dónde se ve

| aceptación (literal) | dónde se ve |
|---|---|
| 1. Primero, MEDIR (sin código): qué datos de retenciones practicadas guarda YaQu hoy… | tramo SCRUM-1066 y 1066b de este fichero |
| 2. Si los datos no existen: … el ALTER aditivo para Javier (A5) | ya hecho: SCRUM-1103 (PR #1745) |
| 3. Si existen: borrador de cada modelo con la casilla de la orden (citada) en cada importe, marcado «borrador para tu asesor», sin presentar nada (regla 7). | `src/modules/fiscal/retenciones/` · `tests/scrum1066c-borrador-111-115.test.mjs`. **El marcado** viaja como `avisoObligatorio` (el del 303, sin aprobar todavía: lleva `[PENDIENTE microcopy oficial]`) → NO HECHO como texto de pantalla: pide la firma del fundador (regla 39) |
| 4. Solo para quien practique retenciones, según lo que confirme el asesor. | NO HECHO → es una pantalla, y no la hay. El dato para decidirlo ya sale: `miradas`, `sinRetencion` y `sinDatoDeRetencion` |
| 5. Documentos emitidos y libros intactos. | el diff no toca `src/modules/invoicing/` ni los libros; el lector es un `findMany` (lo comprueba el test del lector) |
| Tests: con datos, cifras a mano por perceptor | `tests/scrum1066c-borrador-111-115.test.mjs`, caso «cifras a mano por perceptor» |
| Tests: sin datos, la pantalla no aparece | NO HECHO → no hay pantalla |
| Tests: `npm test` completo en verde | NO lo corrí entero (ver abajo). Lo juzga el CI |

## Lo que se corrió, con su población

- El test nuevo: **10 de 10** en verde.
- Mutación con la red de la casa (`node scripts/meta-guard-mutaciones.mjs`): **las 10 de este test caen**.
  Por memoria, la máquina mató la pasada completa después de mis 10, así que de las demás no hay
  veredicto. Al morir dejó un mutante puesto en `tests/scrum303-albaran-una-pantalla.test.mjs`. Quité
  esa línea a mano y comprobé que el fichero vuelve a ser idéntico a HEAD (`git diff --quiet`).
- Dirigida final (`tests-que-cubren --lanzar`, 4 de 4 tramos sobre el árbol con `main` mergeado y
  `dist/` recompilado): **393 ficheros · 3.758 tests · 3.749 pass · 4 fail**. Las 5 que faltan para
  sumar 3.758 no salen ni como pass ni como fail: no las he mirado una a una. Una primera pasada
  me dio además 2 rojos de `scrum1571c`, que venían de un `dist/` sin recompilar tras el merge
  (9 de 9 en verde después de compilar). Los 4 rojos, y los de la pasada anterior:
  - `scrum1298b`: cae 2 de 8 también sobre `origin/main` limpio (c4921cd1).
  - `scrum351` y `scrum476`: este worktree no tiene `node_modules` propio. Son del entorno.
  - `scrum854`: faltaba este registro.
  - `scrum1185` y `scrum1387`: eran míos y están arreglados (ver abajo).
- Tipos: `tsc --noEmit` da 17 errores, todos de `archivedAt` en `quotes`/`system` (el cliente de Prisma
  compartido va desfasado) y **ninguno en `src/modules/fiscal/retenciones/`**.

## Mis errores

- Escribí un banco de mutación con su propia lista (`mutar.mjs`), en vez de declarar
  `MUTACIONES_QUE_ME_TUMBAN` en el test. Lo cazó `scrum1387`. El banco se ha ido y las mutaciones
  están en el test. Eso es la línea `A9:` de arriba.
- La primera versión del catálogo nombraba el fichero con una variable. El meta-guard exige literales,
  y lo dijo.
- Lancé el meta-guard completo en primer plano sin medir antes cuánto duraba: pasó a segundo plano y
  la máquina lo mató.

---

# SCRUM-1066d · La categoría «alquiler»: el ALTER que pedía la decisión NO EXISTE

**Medido contra:** `origin/main` = `37311b671db107cc48a31fc359104fe36525ad2e` · 2026-10-23T10:56:12Z
**Rama:** `scrum-1066d-alquiler-alter-propuesta` · **Puesto:** J5 (sesión `jv-j5ac`) · **Encargo:** orquestador `cobroflash-backend-62`, 23-oct-2026 · **Decisión:** Jira c.20479 («Sí, añadirla»)

A9: aviso → A10 «Una idea de un jefe es una hipótesis con su literal, no una orden de construir.» — no se pudo comprobar: la premisa «es un cambio en la base de datos» venía en la pregunta al fundador, y ningún guard lee el tipo de una columna antes de que un encargo pida su ALTER

## PASO 0

- `git log origin/main --grep=1066`: 1066, 1066b y 1066c (#2703, `00179a513`). Ninguno añade la categoría.
- `git log origin/main -S"'alquiler'" -- src public`: vacío. `gh pr list --search "1066d OR alquiler in:title"`: `[]`. `ls-remote` `scrum-1066*`: ninguna rama viva.
- Etiquetas de SCRUM-1066: `equipo-javier`, `area-j1`. Comentarios leídos: 5 de 5 (c.16416 → c.20479).

## La medición: añadir «alquiler» no pide DDL

`Expense.category` es `String @default("otros")` (`prisma/schema.prisma:987`). La lista de valores
vive en un **comentario** de esa línea y en el código, **no en la base**:

- `src/modules/expenses/domain/expenses.service.ts:6`: `EXPENSE_CATEGORIES`, que valida la ruta (`:349`, y `expenses.routes.ts:257,364` devuelve 400).
- No hay `enum` de Prisma ni `CHECK` declarado. En `docs/MIGRATIONS_PENDING.md` (203.167 B) hay 0 líneas
  con `expenses` + `categor|check|constraint`. Control positivo del mismo grep: 17 líneas con `expenses`
  y 12 con `constraint|CHECK (`.

Sonda offline (`--desde`, datamodel→datamodel, sin `DATABASE_URL`), con `previewMigracion` y el CLI
Prisma 6.18.0 del checkout compartido (`migrate diff` no escribe nada), clasificada con `_clasificador-sql.mjs`:

| caso | qué cambia en el esquema | DDL | clasificador |
| --- | --- | --- | --- |
| control de la herramienta | esquema entero contra vacío | 33 `CREATE TABLE` | — |
| N · negativo | nada (el esquema contra sí mismo) | `-- This is an empty migration.` | sin sentencias |
| **A · lo decidido** | el comentario de `category` pasa a `…subcontrata\|alquiler\|otros` | **`-- This is an empty migration.`** | **sin sentencias** |
| P · positivo sembrado | `sondaPositivo1066d String? @map("sonda_positivo_1066d")` | `ALTER TABLE "expenses" ADD COLUMN "sonda_positivo_1066d" TEXT;` | ✅ ADD COLUMN ×1 (permitida) |

**Conclusión:** el paso ② de A5 (ALTER aplicado por el colaborador en las tres bases) **no tiene
contenido**, y no hay nada que pedirle a Javier. Todo es paso ③: código y tests, más el comentario
de `schema.prisma:987`, que no genera DDL.

⚠️ **No medido:** que ninguna de las tres bases tenga un `CHECK` puesto a mano fuera del esquema. Este
árbol no tiene claves de base y no se conecta con ninguna. Con la base al día, el preview normal
(`node scripts/preview-migracion.mjs` contra staging, con su turno) lo enseñaría como diferencia.
La sonda es de esta sesión y no se ha comiteado.

## El rótulo, para la firma del fundador (regla 39)

La clave interna sería `alquiler` y el profesional no la ve. Lo que ve es la etiqueta de
`CATEGORY_LABELS` (`public/dashboard/js/expensesView.js:5-11`), junto a «Materiales», «Desplazamiento»,
«Herramientas», «Subcontrata» y «Otros».

| opción | literal | por qué |
| --- | --- | --- |
| **A (recomendada)** | **Alquiler de local** | El 115 sólo recoge arrendamientos de **inmuebles urbanos** (SCRUM-1106; RIRPF art. 100, verificado en 1066b). «Alquiler» a secas también invita a apuntar la furgoneta, el andamio o la maquinaria, que no van al 115. |
| B | Alquiler | Es la más corta y la más parecida a las otras cinco, pero tiene la ambigüedad de A. |
| C | Local o nave | Nombra el inmueble y no el contrato. Es la que más se aleja del vocabulario de las otras. |

Ninguna se ha escrito en el código: se propone, no se da por buena.

## Lo que tiene que hacer el paso ③ (no construido aquí)

1. `EXPENSE_CATEGORIES` y el comentario de `schema.prisma:987`, con la clave `alquiler`.
2. `CATEGORY_LABELS` y una píldora `.gasto-cat--alquiler` en `styles.css` (UI: `yaqu-premium-ui`, DESIGN.md).
3. **303** (`modelo303.ts:172`): `alquiler` no está en `CATEGORIAS_CORRIENTES`, y sin tocarlo cae en
   `categoria_desconocida`, fuera de la 28/29. Hay que decidir si el alquiler del local es gasto
   corriente (la decisión A de 1063b sólo aparta «herramientas»).
4. **115** (`retencionesPracticadas.ts:43`): se clasifica por **categoría** + retención anotada, no por el 19 %
   (decisión A). El invariante del 111+115+sin clasificar se mantiene.
5. Tests con cifras a mano y, antes, en rojo.

## STOP respetado

No se ha tocado `prisma/schema.prisma`, el camino de emisión, ningún texto de pantalla, ningún flag
ni ninguna base. Lo único que cambia es este tramo.

## Mis errores

- Busqué un `CHECK` con un `grep -r` sobre `docs` entero, sin filtrar, y me volvieron 978 KB de JSON de
  evidencias. Lo repetí acotado a `docs/MIGRATIONS_PENDING.md`.
- La primera pasada de la sonda no corrió: le pasé rutas con forma de bash a `node` en Windows, y
  `import.meta.url` dejó un `%20` en la ruta temporal. No dio ningún resultado que pudiera leerse como bueno,
  y la repetí.
