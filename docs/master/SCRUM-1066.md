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

---

# SCRUM-1066e · «Alquiler de local» en el 115 y en el 303

**Medido contra:** `origin/main` = `8878551f77b10df628fcb71b8727114656ec230f` · 2026-10-23T11:34:22Z
**Rama:** `scrum-1066e-alquiler-de-local` · **Puesto:** J1 (sesión `jv-j1an`) · **Encargo:** orquestador `cobroflash-backend-62`, 23-oct-2026 · **Decisiones:** Jira c.20479, c.20485 y c.20497

A9: aviso → cicatriz J1 «Escribí en el ticket para el otro equipo la ruta `GET /admin/expenses/categories` antes de leer dónde se monta; la leí después y era cierta, pero la afirmé sin haberla leído (SCRUM-1066e, SCRUM-1588)» — no se pudo comprobar: el texto de un ticket de Jira no pasa por ningún guard del repositorio

## PASO 0

- `git log origin/main --grep=1066`: 1066c (#2703) y 1066d (#2721) en `main`. Ninguno coloca nada en el 115 ni toca `CATEGORIAS_CORRIENTES`.
- `git ls-remote --heads origin` con `scrum-0*1066`: ninguna rama viva.
- El defecto, corriendo: el test nuevo sobre el código de `main` da **7 de 8 en rojo** (el octavo es el negativo «un 19 % sin la categoría», que tiene que seguir verde).

## Qué se ha hecho (carril J1: `src/modules/fiscal/**`)

1. **115** (`retencionesPracticadas.ts`): un gasto con `category === 'alquiler'` (`CATEGORIA_ALQUILER`) y retención anotada va a las casillas 1-5, **sea cual sea su tipo**: lo separa la categoría, no el 19 %. Un 19 % sin la categoría sigue sin clasificar (decisión A de 1066c). `TIPOS_115` se ha ido. `vacioPorque = 'sin_dato_de_arrendamiento'` sólo si ningún gasto del trimestre es un alquiler: un alquiler sin retención (≤ 900 €/año, SCRUM-1106) deja el 115 a cero y lo explica `sinRetencion`.
2. **El lector** (`retencionesPracticadas.repo.ts`) pide también `category`. Sigue filtrando sólo por merchant y trimestre.
3. **303** (`modelo303.ts`): `alquiler` entra en `CATEGORIAS_CORRIENTES` → 28/29, no `categoria_desconocida` (c.20497: «Sí, como gasto corriente»; en la lista del asesor).

Sin esquema, sin ruta, sin pantalla, sin texto nuevo que vea el usuario, sin tocar la emisión (`invoicing/` no está en el diff).

## Lo que NO es de J1: SCRUM-1588 (equipo de Luis)

La parte 1 del encargo (la categoría en `EXPENSE_CATEGORIES`, su etiqueta y su píldora) cruza de equipo, medido con `scripts/carriles.mjs de`: `expenses.service.ts` → S1 (`dos-equipos.md:136`), `expensesView.js` y `styles.css` → S2 (`dos-equipos.md:152`). Por orden del orquestador va a **SCRUM-1588** (`equipo-luis`, `area-s1`, `area-s2`, enlazado a 1066), con el rótulo firmado.

⚠️ **Consecuencia: hasta que entre SCRUM-1588, la ruta rechaza `alquiler` (`category_invalid`) y el 115 sigue a cero EN LA PRÁCTICA.** Lo de aquí es el borrador que lo sabrá leer el día que exista el dato.

## Aceptación → dónde se ve

| aceptación (del encargo) | dónde se ve |
|---|---|
| la categoría en `EXPENSE_CATEGORIES`, su etiqueta y su píldora | NO HECHO → SCRUM-1588 (S1 y S2, equipo de Luis) |
| el 115: los gastos de esa categoría con retención entran en sus casillas, con su fuente | `tests/scrum1066e-alquiler-de-local.test.mjs` (cifras a mano: 2 arrendadores, 1.300 de base, 247 retenidos) |
| el 303: «alquiler» en `CATEGORIAS_CORRIENTES` | `tests/scrum1066e-alquiler-de-local.test.mjs` (600 + 126 → 28/29) |
| ningún esquema, ninguna emisión | el diff no toca `prisma/` ni `invoicing/` |
| en yaqu.app | NO HECHO: no hay pantalla que lo pinte (1066c lo dejó sin ruta) |

## Lo que se corrió, con su población

- **Rojo primero:** test nuevo sobre el código de `main` → 8 tests, 1 pass, 7 fail.
- **Verde:** `scrum1066e` + `scrum1066c` + `scrum1063b` → 27 tests, 27 pass, 0 fail, 0 skipped.
- **Mutación:** las 17 declaraciones de `scrum1066e` (7) y `scrum1066c` (10) → 17 vivas, 0 mudas, 0 ciegas. Con un conductor temporal que lee las declaraciones con `mutacionesDeclaradas` de la casa, exige que caiga el caso de su `cae` y restaura por bytes; su control sembrado (una mutación de un comentario) salió MUDA, como tenía que salir. La pasada entera de `npm run meta:mutaciones` **no la corrí**: en 1066c la mató la máquina por memoria.
- La mutación de `scrum1066c` que apuntaba a `TIPOS_115` pasa a la línea que decide ahora (`a115`), con la misma idea: clasificar por el 19 %.
- `tsc` con tipos: 17 errores, **ninguno en `fiscal/`** (`quotes*`, `merchantAdmin`: cliente Prisma compartido; árbol anidado sin `node_modules`, `dist/` con `--noCheck`).
- **Guards de suite y de registro** (237, 976, 824, 836, 419, 702, 262, 267, 273, 1294, 921c, 854, 622, 745, 1387, 1185, 850 + los dos de retenciones): 19 ficheros, 179 tests, 177 pass, 2 fail en la primera pasada. Los dos eran el mismo: mi línea `A9:` citaba media cicatriz (la frase es la línea entera hasta la flecha) y `scrum976` cae porque `guards:entrada` incluye 1294. Corregida la cita, la repetición (los mismos 19 + `scrum1063b`): **20 ficheros, 188 tests, 188 pass, 0 fail, 0 skipped, 0 cancelled** (TAP a fichero fuera del árbol, 101.986 B; 188 líneas `ok` ancladas al inicio, 0 `not ok`).

## Mis errores

- La ruta `GET /admin/expenses/categories` del ticket SCRUM-1588 la escribí antes de leer dónde se monta; la leí después (`app.ts:583` + `expenses.routes.ts:81`) y es cierta. Va a mi cicatriz.
- Mi primera línea `A9:` citaba sólo un trozo de la cicatriz y `scrum1294` la tumbó: lo vi en local, antes de empujar.

# SCRUM-1066f · Lo que recibe de 1103: MIGRATIONS_PENDING, el cotejo en el BOE y el 190/180

**Medido contra:** `origin/main` = `63550e45e6e65f8461e80e4f7e8aa413d5483093` · 2026-10-27T17:41:01Z
**Rama:** `scrum-1066f-excepciones-115` · **Puesto:** J1 (sesión `jv-j1dh`) · **Encargo:** orquestador `cobroflash-backend-8b`, 27-oct-2026 · **De:** SCRUM-1103 c.21160, SCRUM-1066 c.21162 · **Jira:** c.21170

A9: aviso → A10 «La fecha de vigencia de un texto consolidado no es la fecha desde la que se aplica: se lee la nota, no el atributo.» — no se pudo comprobar: el cotejo contra el BOE se hace en la consola, y ningún guard del repositorio compara versiones de un bloque

## PASO 0

- `git log origin/main -i --grep=SCRUM-1066f`: 0 commits. `git ls-remote origin 'refs/heads/scrum-1066*'`: ninguna rama. `gh pr list --state all --search 1066f`: `[]`. Control positivo de la misma búsqueda con `1066`: salen #2703 (1066c) y #1746 (1066b), MERGED.
- Etiquetas de 1066: `equipo-javier`, `area-j1`. `carriles.mjs de`: `src/modules/fiscal/retenciones/` → J1; `docs/MIGRATIONS_PENDING.md` → sin fila, nadie lo reclama.

## 1 · `docs/MIGRATIONS_PENDING.md`

Entrada nueva al final, «SCRUM-1103 · tres columnas en `expenses`», con el formato de SCRUM-1490: DDL, de dónde sale y estado por base. Antes había **0** líneas con `retencion_practicada` o `1103` en ese fichero. El estado por base lo copio del tramo 1103b de `docs/master/SCRUM-1103.md`, y en cada una digo quién lo midió. **J1 no ha medido ninguna base**: este árbol no tiene claves.

## 2 · El cotejo en el BOE consolidado

Fuente: `https://www.boe.es/datosabiertos/api/legislacion-consolidada/id/<id>/texto`, bajada con GET público el 27-oct-2026 (cabecera `Date:` del BOE: 17:38:40Z y 17:38:45Z). Los ficheros no están en git: RIRPF 1.707.941 B, 215 bloques · IAE 3.249.061 B, 166 bloques.

**La premisa del encargo no casa con la norma.** Las dos excepciones NO están en el art. 100 RIRPF. Ese artículo (bloque `a100`, 3 versiones, vigente desde el 23-dic-2018, RD 1461/2018) sólo fija el tipo: «será el resultado de aplicar el porcentaje del 19 por ciento sobre todos los conceptos que se satisfagan al arrendador, excluido el Impuesto sobre el Valor Añadido». Las excepciones están en el **art. 75.3.g)**, como ya midió 1066b. Lo dijo el asesor «de memoria» (SCRUM-1103), y la referencia viajó hasta el encargo.

**RIRPF (BOE-A-2007-6820), art. 75.3.g).** Bloque `a75`, 10 versiones; la última es la de vigencia 08-oct-2026 (RDL 29/2026, BOE-A-2026-20823), que modifica los apartados 3 y 4. **La letra g) es idéntica en las 10**: mismo SHA-256 (`b2cd4fa309ba`, 1.074 caracteres) desde la redacción original de 2007. Literal:

> «g) Los rendimientos procedentes del arrendamiento o subarrendamiento de inmuebles urbanos en los siguientes supuestos: 1.º Cuando se trate de arrendamiento de vivienda por empresas para sus empleados. 2.º Cuando las rentas satisfechas por el arrendatario a un mismo arrendador no superen los 900 euros anuales. 3.º Cuando la actividad del arrendador esté clasificada en alguno de los epígrafes del grupo 861 de la Sección Primera de las Tarifas del Impuesto sobre Actividades Económicas, aprobadas por el Real Decreto Legislativo 1175/1990, de 28 de septiembre, o en algún otro epígrafe que faculte para la actividad de arrendamiento o subarrendamiento de bienes inmuebles urbanos, y aplicando al valor catastral de los inmuebles destinados al arrendamiento o subarrendamiento las reglas para determinar la cuota establecida en los epígrafes del citado grupo 861, no hubiese resultado cuota cero. A estos efectos, el arrendador deberá acreditar frente al arrendatario el cumplimiento del citado requisito, en los términos que establezca el Ministro de Economía y Hacienda.»

⚠️ En la fuente, «Legislativo» lleva un guion blando invisible (U+00AD) entre «Legisla» y «tivo». Aquí está quitado: una búsqueda literal de esta cita contra el texto crudo no casa por ese carácter.

**Tarifas del IAE (RDLeg 1175/1990, BOE-A-1990-23930), Agrupación 86 de la Sección Primera.** Bloque `agrupacion86`, 4 versiones, vigente desde el 01-01-1996 (RDL 12/1995). Epígrafes 861.1 y 861.2: «Cuota nacional de: 0,10 por 100 del valor catastral», y nota 2.ª de los dos: «Los sujetos pasivos cuyas cuotas por esta actividad sean inferiores a 100.000 pesetas (601,01 euros) tributarán por cuota cero». En las notas del bloque: «Se incrementan en un 3,5 por 100 las cuotas, por el art. 26.1.a) del Real Decreto Ley 12/1995».

🔴 **La cifra del asesor NO casa.** Dijo «valor catastral > 601.012 € acreditado por certificado» (SCRUM-1103). El BOE no pone el umbral en el valor catastral: lo pone en la **cuota**, en 601,01 €. El 601.012 no aparece en el texto: es 100 millones de pesetas en euros. Lo derivo yo, y no es norma: con cuota = 0,10 % del valor catastral, la cuota cero acaba en 601.010 € de valor catastral. Si el +3,5 % de 1995 se aplica a esa cuota, acaba en unos 580.686 €. Cuál de las dos lecturas vale lo decide el asesor: **NO VERIFICADO**.

Controles del cotejo: buscar `601.01` en el IAE da 0 bloques, y `601012` da 5, todos en la Regla 14 (un coeficiente por m², ajeno). `Grupo 861` sale en dos bloques: `agrupacion86`, la de los alquileres, y `agrupacion86-2`, que es OTRA agrupación 86 («Profesiones liberales, artísticas…», grupo 861 = pintores y escultores; de qué sección es no lo he medido). El número de grupo no basta para saber cuál es.

## 3 · Por qué NO se construyen las excepciones

El encargo decía «sólo si las dos quedan citadas». Quedan citadas, pero ninguna se puede construir sin inventar algo:

- **3.º, epígrafe 861:** hace falta el epígrafe del arrendador y que el arrendador lo acredite. En `prisma/schema.prisma` hay **0** líneas con `epigrafe`, `epígrafe`, `iae` o `catastral`, y `Provider` sólo tiene `name`, `legalName` y `taxId` como datos fiscales. No lo invento: queda declarado. Construirla pide esquema, y eso es una decisión del fundador (A5).
- **2.º, hasta 900 €:** el dato sí existe (categoría `alquiler`, `providerId` y `baseAmount`). Pero el límite es **anual** y el 115 es **trimestral**. Qué hacer a mitad de año, cuando aún no se sabe si se pasará de 900 €, es un criterio y no un dato. Pregunta para el asesor: «¿se retiene desde el primer pago si se prevé superar los 900 €, o sólo desde que se superan?». Construirlo antes de que conteste sería inventar la regla.
- Mientras tanto, el borrador no cambia: un alquiler sin retención anotada ya cuenta en `sinRetencion` y deja el 115 a cero (1066e).

## 4 · Los resúmenes 190 y 180: qué haría falta (medido, no construido)

- Las cifras salen del mismo dato que el 111 y el 115, sumado por año y por perceptor (`providerId`). No hace falta captura nueva para los importes.
- Lo que el esquema NO tiene (medido en `Provider`): la provincia del perceptor; y, para el 180, la referencia catastral y la dirección del inmueble alquilado. El NIF (`taxId`) y la razón social (`legalName`) existen, pero son nullable.
- ⚠️ La lista de campos de los dos impresos la doy de memoria y **no la he cotejado con sus órdenes ministeriales: NO VERIFICADO**. Antes de diseñar nada hay que bajar esas órdenes y sus anexos, como hizo 1066c con el 111 y el 115.

## Aceptación → dónde se ve

| encargo | dónde se ve |
|---|---|
| la entrada de MIGRATIONS_PENDING del ALTER de `schema.prisma:1027-1029` | `docs/MIGRATIONS_PENDING.md`, sección «SCRUM-1103 · tres columnas en `expenses`» |
| el cotejo en el BOE consolidado, literal y con su vigencia | este tramo, §2 |
| decir si la cifra no casa con la del asesor | §2: no casa |
| las excepciones construidas | NO HECHO: la del 861 no tiene dato y la de 900 € espera el criterio del asesor (§3) |
| 190/180: medir qué haría falta | §4, sin construir |

## Lo que se corrió

No hay código en el diff, así que no hay rojo primero ni mutación. Los guards de registro y de suite se corren en local antes de empujar, y sus cifras van en la entrega. **La suite entera en local: NO CORRIDA.**

## Mis errores

- La primera sonda que comparaba las versiones de la letra g) partía por `<version ` en TODO el XML del RIRPF, no sólo en el bloque `a75`, y salió «SIN g)» en todas las versiones. Lo cacé leyendo la salida, antes de afirmar nada, y la rehíce acotada al bloque.
- El primer comando de la tanda usó `$CLAUDE_JOB_DIR`, que en esta consola no está definido: el `git rev-parse` salió con 128 y no llegó a correr nada. Lo repetí con la ruta escrita.
