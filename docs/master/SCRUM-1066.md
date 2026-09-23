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
