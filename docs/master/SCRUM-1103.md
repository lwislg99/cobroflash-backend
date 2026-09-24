# SCRUM-1103 · Retención IRPF PRACTICADA en gastos (111/115) — PASO 0, DDL propuesto, sin aplicar

**Fecha:** 23-sep-2026 · **Carril:** J1 (camino de emisión); esta tanda es **solo medición**, la
sesión de J1 estaba caída y Javier pidió el DDL directamente. **La construcción sigue siendo de J1.**
**Medido contra:** `origin/main` = `1cc2e6bb04fec54ef9e39b52a0ea2e173eb15c6c` · 2026-09-23T18:13:51Z

## Encargo

Frase del asesor de hoy (volcado de SCRUM-1106): *«111 y 115 dependen de gastos que el usuario
registre CON RETENCIÓN, no de sus ventas. Si no captáis la retención en las facturas RECIBIDAS, no
podéis calcularlos»* — y *«la retención la sufre el profesional [emisor], pero la presenta el
cliente [pagador]»*. Bloquea a SCRUM-1066. Alcance de esta tanda: **medir dónde vive el dato hoy,
comprobar si cabe sin ALTER, y si no cabe, generar el DDL offline** — sin tocar ninguna base ni
ningún fichero de código.

## 1 · El sentido está INVERTIDO respecto a lo que ya existe — medido, no supuesto

YaQu ya modela una retención de IRPF, pero es la contraria: `src/modules/invoicing/domain/retencionIrpf.ts`
(SCRUM-293) calcula la retención que el profesional **SUFRE** en sus propias facturas EMITIDAS
(el cliente-empresa le retiene 15 %/7 % al pagarle). Los modelos 111/115 son la retención que el
profesional **PRACTICA** como PAGADOR sobre facturas que él RECIBE (a su gestor, a un subcontratista
persona física, al alquiler de su local) — el dato no existe en ningún sitio hoy, ni con ese
sentido ni con el otro.

## 2 · Dónde vive hoy una factura recibida / un gasto — buscado por PALABRA, no por el ticket

Una única fuente, sin modelo intermedio: **`Expense`** (`prisma/schema.prisma:929-988`) ES la
factura recibida. La leen dos consumidores, ambos de solo lectura sobre esa misma tabla:

- `src/modules/invoicing/domain/libroRecibidas.ts` (SCRUM-426, A6) — el libro de compras. Su
  interfaz `GastoParaLibro` (líneas 53-70) declara EXACTAMENTE las columnas fiscales que ya existen:
  `baseAmount`, `vatRate`, `vatAmount`, `vatDeducible`, `providerInvoiceNumber`, `providerInvoiceDate`.
  Ninguna de retención.
- `src/modules/invoicing/domain/libroRecibidas.repo.ts:25-39` (`CAMPOS_GASTO`) — el `select` de
  Prisma que alimenta el libro. Mismo censo: cero columnas de retención.
- `src/modules/expenses/domain/expenses.service.ts` — `CreateExpenseInput` (líneas 9-42) y
  `CAMPOS_DE_LA_LISTA` (líneas 71-91): el alta y la lista del gasto. Tampoco tienen retención.

**Las columnas fiscales que SÍ existen en `Expense`** (`baseAmount`, `vatRate`, `vatAmount`,
`vatDeducible`) nacieron con SCRUM-403/E4 el 10-ago-2026, **todas nullable y sin `@default`**: `null`
= «nunca clasificado», no cero. Es el patrón que se reutiliza abajo.

## 3 · ¿Cabe en una columna JSON que ya exista? Medido, censo completo — NO cabe

El encargo pedía comprobar el patrón de `Invoice.lines` (SCRUM-1050: un `Json` existente puede
absorber un campo nuevo sin ALTER). Censo de **cada** columna `Json` del esquema (30 tablas, grep
+ script de mapeo modelo→columna, no a ojo):

`Merchant` (5), `Customer` (1), `Charge` (1), `Event` (1), `Quote` (7), `Invoice` (3), `BotSession`
(1), `QuoteTemplate` (2), `CustomerEvent` (1), `AuditLog` (1), `Albaran` (2), `ParteTrabajo` (2).

**`Expense` y `Provider` no tienen NINGUNA columna `Json`.** No hay un cajón flexible ya abierto en
el lado de gastos — a diferencia de `Invoice.lines` (que además está descartado por otra razón: es
el camino de emisión, y meter un dato de compra ahí sería mezclar dos conceptos sin relación,
mismo argumento que usó SCRUM-1107 para descartar `Charge.payMethods`). **Conclusión: hace falta
ALTER.** No es una suposición — es el resultado de mirar las 30 tablas, no solo `Invoice`.

## 4 · El diseño propuesto — tres columnas aditivas en `Expense`, mismo patrón que sus vecinas

Seguido el patrón YA usado en esta MISMA tabla para `vatRate`/`vatAmount`/`vatDeducible`
(`schema.prisma:957-963`): nullable, sin `@default`, sin backfill — no el patrón de dos columnas de
`Merchant` para el IRPF sufrido, porque aquí SÍ hace falta distinguir «nunca clasificado» de «se
decidió que no hay retención» (un gasto puede legítimamente no llevar retención — pagar en una
ferretería no la lleva — y eso no puede leerse igual que «nadie lo miró»):

```prisma
// Propuesta, NO aplicada — el ALTER lo decide y ejecuta Javier (A5)
retencionPracticadaTipo      Int?      @map("retencion_practicada_tipo")
retencionPracticadaCuota     Decimal?  @map("retencion_practicada_cuota") @db.Decimal(12, 2)
retencionPracticadaDeclarada Boolean?  @map("retencion_practicada_declarada")
```

- **Tipo** — entero de porcentaje, SIN cubo cerrado en el esquema (mismo criterio que `vatRate`):
  111 y 115 no comparten necesariamente los mismos tipos que `CUBO_DE_RETENCION` de
  `retencionIrpf.ts` (15/7/2/1, que es para la retención SUFRIDA); cuál tipo es válido para cada
  modelo es una decisión de J1/asesor, no una restricción de columna.
- **Cuota** — se GUARDA, no se deriva (mismo motivo que `vatAmount`: un redondeo distinto entre
  pantalla y libro es una discrepancia que después nadie explica).
- **Declarada** — `null` = nunca clasificado · `false` = se decidió que no lleva retención ·
  `true` = sí. Sin este tercer valor, un gasto sin clasificar y uno legítimamente sin retención
  se leerían igual — el mismo defecto que `vatDeducible` ya resuelve para el IVA.

**No propuesto, y es aparte a propósito:** ni una columna ni una categoría para distinguir 111 de
115 (p. ej. «alquiler»); `EXPENSE_CATEGORIES` (`expenses.service.ts:6`) no tiene esa categoría hoy.
Las excepciones de SCRUM-1106 para el 115 (alquileres ≤ 900 €/año, arrendador en epígrafe 861 con
catastral > 601.012 €, vivienda no afecta) son lógica de CÁLCULO sobre estos mismos datos, no
estructura nueva — se dejan escritas para quien construya SCRUM-1066, no se resuelven aquí.

## 5 · El DDL exacto — generado, no escrito a mano

`node scripts/preview-migracion.mjs --desde <copia intacta de schema.prisma>`, en modo OFFLINE
(compara dos ficheros, no toca ninguna base). Método idéntico al de J2 en SCRUM-1107 §6/§7:

1. Copia de `prisma/schema.prisma` guardada ANTES de tocarlo + su sha256:
   `4084abc34b97d8684840bcead9f27fc80cfa2449a8c5d78a00573ca14b9a77a2` — **el mismo hash que registró
   J2 el mismo día**, confirmando que el árbol no se había movido entre las dos medidas.
2. Se insertan las tres columnas del §4 en el `Expense` del worktree.
3. `node scripts/preview-migracion.mjs --desde <copia>`:

```
✔ control positivo: la herramienta responde (30 tablas).

──────── SQL QUE SE APLICARÍA ────────
-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "retencion_practicada_cuota" DECIMAL(12,2),
ADD COLUMN     "retencion_practicada_declarada" BOOLEAN,
ADD COLUMN     "retencion_practicada_tipo" INTEGER;

──────── VEREDICTO ────────
✔ aditiva: ni DROP, ni RENAME, ni TRUNCATE, ni DELETE, ni SET NOT NULL.
```

4. Revertido: `git checkout -- prisma/schema.prisma`. Verificado por CONTENIDO, no solo porque el
   comando no fallara: `git status --short` no lista `schema.prisma`, Y `sha256sum` del fichero en
   el árbol contra la copia intacta — **hash idéntico**
   (`4084abc3…9a77a2` los dos, antes y después). El árbol quedó exactamente como estaba.

## 6 · Lo que esta tanda NO decide ni construye

- **Ningún ALTER aplicado** — se lo lleva el orquestador a Javier; lo aplica él en las tres bases.
- **Ningún código nuevo**, cero líneas en `src/`; el camino de emisión (`Invoice`, `verifactu.service.ts`)
  no se ha tocado ni se ha leído siquiera — este dato vive en `Expense`, fuera de ese camino. Sin STOP.
- **Ninguna cita del asesor propagada**: los artículos que fijan el tipo/umbral (art. 99 LIRPF,
  arts. 74-76 y 100 RIRPF) los marca y cita J4/SCRUM-1106; aquí no se ha usado ninguno.
- **Qué tipos son válidos para 111 vs. 115, y las excepciones del §4** quedan para quien construya
  SCRUM-1066 (J1), con el GO de Javier.

## Siguiente paso

Javier aplica el ALTER del §5 en las tres bases (staging/dev/tests). Con las columnas ya en la
base, SCRUM-1066 puede medir «qué datos hay» de verdad (su propio punto 1 de aceptación) y
construir el borrador de 111/115 — hoy estaba bloqueado antes incluso de poder medirse.

---

## SCRUM-1103b · ② ALTER en dev, y ③ esquema + código + tests

**Fecha:** 23-sep-2026 18:41Z · **Carril:** J1 · **Medido contra:** `origin/main` =
`671296fed22b1185898e0168c6d8b9a1e3eb8955` · 2026-09-23T18:41:56Z

### ② El ALTER, en la tercera base

Producción y staging: aplicados por Javier (23-sep-2026, «Query ran successfully» en las dos).
Dev: aplicado por J1 con `scripts/aplicar-sql-dev.mjs --go` (destino confirmado ANTES con
`describirBD`: `DATABASE_URL_DEV` → `yaqu_dev_javier`), mismo DDL byte a byte que el §5 de
arriba — `docs/sql/scrum-1103-retencion-practicada-gastos.sql`.

**Verificado leyendo `information_schema.columns`, no el mensaje de «aplicado»:**

```
control_ve_el_catalogo: 470 · tipo: 1 · cuota: 1 · declarada: 1
retencion_practicada_cuota      → numeric, nullable, precision 12 scale 2
retencion_practicada_declarada  → boolean, nullable
retencion_practicada_tipo       → integer, nullable
```

Las tres bases tienen ya el esquema. Paso ③ de A5 puede empezar.

### ③ Esquema + código + tests

**Schema** (`prisma/schema.prisma`, `model Expense`): las tres columnas del §4, con el mismo
`@map` que el DDL ya aplicado. `prisma generate` regenerado; `preview-migracion.mjs` contra dev
confirma que el schema y la base ya NO discrepan en `expenses.retencion_practicada_*` (el resto
del diff que ese preview muestra —`charges.retencion_garantia_*`, `customers.pay_methods_por_defecto`,
las FK de `quote_assignees`/`invoice_assignees`— es deriva PREEXISTENTE de otros tickets en curso,
SCRUM-1107 entre ellos; no se toca aquí, es de otro carril).

**Código** (`src/modules/expenses/domain/expenses.service.ts`), mismo patrón que
`baseAmount`/`vatRate`/`vatAmount` (SCRUM-324):

- `CreateExpenseInput` gana `retencionPracticadaTipo?`/`retencionPracticadaCuota?` — el dato
  OBJETIVO que trae la factura del proveedor, y `createExpense()` los escribe con `?? null`
  (un tipo 0 % legítimo no puede leerse como «no se sabe»).
- `CAMPOS_DE_LA_LISTA` gana las TRES columnas (incluida `retencionPracticadaDeclarada`): la
  lista las lee y las devuelve. Lo exige el guard existente de SCRUM-964 (el `select` de la
  lista tiene que ser EXACTAMENTE los escalares de `Expense` menos `receiptData`) — sin este
  cambio, ese guard cae solo con el ALTER ya aplicado.
- 🔴 **`retencionPracticadaDeclarada` NO entra en `CreateExpenseInput`, a propósito.** Mismo
  criterio que `vatDeducible`, que tampoco es parámetro de alta hoy (medido: no aparece en
  ningún `create()` ni en ninguna ruta): es una DECISIÓN de clasificación, no un dato que se
  transcribe, y su cubo de tipos válidos por 111 vs. 115 lo fija quien construya SCRUM-1066
  (§6 de arriba). Escribirla aquí sin esa validación dejaría entrar cualquier valor.
- **Las rutas HTTP (`POST`/`PUT /admin/expenses`) NO se tocan en este ticket.** El dominio ya
  sabe escribir y leer los tres campos —programáticamente, y para SCRUM-1066—; la pantalla de
  captura con su cubo de tipos válidos es del ticket que construya esa clasificación. Igual
  que SCRUM-403 (schema) fue anterior y distinto de SCRUM-324 (rutas + pantalla).
- `libroRecibidas.ts`/`.repo.ts` (el libro de COMPRAS, IVA) NO se tocan: la retención IRPF
  practicada es un dato para 111/115, una declaración distinta, no una columna de ese libro.
  Tocarlo aquí habría sido inventar un segundo consumidor sin que SCRUM-1066 lo haya pedido.

**Tests** (`tests/scrum1103-retencion-practicada-en-gastos.test.mjs`), patrón de
`scrum324-cadena-hasta-el-libro.test.mjs`:

1. SUELO — el schema declara las tres columnas, nullable, sin `@default`, con la precisión
   `Decimal(12,2)` de `cuota`.
2. SUELO — censo de escrituras (regex sobre el fuente, con control positivo) para
   `tipo`/`cuota`; y su espejo, la DECISIÓN de que `declarada` NO se escribe (con el mismo
   instrumento verificando que `vatDeducible` tampoco, para probar que el regex detecta
   ausencias reales y no es ciego).
3. `CAMPOS_DE_LA_LISTA` incluye las tres — control explícito, además del guard general de
   SCRUM-964.
4. Unidad sin base (doble de `_envio-doblado.mjs`): `createExpense` manda tipo/cuota al
   `create()` de Prisma, `null` si no llegan, y un tipo 0 % legítimo no se confunde con «no se
   sabe» (mismo defecto que `vatRate` en su día).
5. 🔴 LA CADENA ENTERA (gateada por `LIBRO_PG_URL`, banco desechable): alta con retención →
   se lee de vuelta por FUERA de la función que escribió (no «se aceptó y se perdió») → la
   LISTA también la trae → `updateExpense` corrige un campo sin borrar el otro. Y su control
   negativo: sin retención, las tres nacen `null`.

**Verificado, no asumido:**

- `npm run build` limpio.
- `tests/scrum1103-retencion-practicada-en-gastos.test.mjs`: 6/8 verde, 2 SKIP declarados (sin
  `LIBRO_PG_URL` en esta máquina — sin Docker/Postgres, **suelo del entorno**, no del código;
  CI los confirma).
- Los 6 no gateados se comprobaron en ROJO contra `origin/main` (sin este cambio) antes de
  darlos por buenos: los tres censos basados en regex/schema dan `false`/ausente sobre el
  `expenses.service.ts` y el `schema.prisma` de `origin/main`, así que miden el cambio real y
  no una tautología.
- Guard de SCRUM-964 (`el select de la lista es EXACTAMENTE Expense menos receiptData`): verde
  con las tres columnas nuevas dentro de `CAMPOS_DE_LA_LISTA`.
- Guard de SCRUM-860 (trinquete del select en ficheros con respuesta HTTP): verde — no sube el
  suelo de lecturas nuevas sin `select`, aunque este ticket no toca ninguna ruta.
- **Deriva de esquema regenerada**: `docs/sql/deriva-prod.sql` (`node
  scripts/generar-sql-deriva.mjs`) estaba desfasado tras el ALTER — lo cazaron en rojo
  `tests/scrum222-deriva-arranque.test.mjs`, `scrum461-censo-no-encoge.test.mjs` y
  `scrum733-el-censo-no-se-encoge-en-silencio.test.mjs`. Regenerado y verde.
- **Inventario de gateados actualizado**: `tests/scrum419-ci-declara-lo-que-no-corre.test.mjs`
  cayó porque el fichero nuevo trae 2 tests gateados por `LIBRO_PG_URL` sin declarar — se
  añadió al `GATEADOS_DECLARADOS` con su motivo. Verde.
- **Registro de rama** (`scrum854-todo-merge-deja-entrada.test.mjs`): esta misma sección es su
  entrada — el guard lo exige para toda rama que toque código.
- `npm test` completo corrido en esta máquina: aparte de lo de arriba, quedan cuatro grupos en
  rojo AJENOS a este ticket, confirmados preexistentes corriendo los mismos ficheros contra el
  checkout sin tocar (`cobroflash-backend`, sin este cambio): `scrum910d` (el `fetch()` de
  Windows revienta con la aserción de libuv, SCRUM-100/560/809), `scrum932` (resolución de
  `.env`/`--base` específica de esta máquina) y `scrum939b` (`gh.exe` SÍ existe en esta
  máquina en la ruta que el censo de falsas declaradas esperaba que no existiera). No se
  tocan: son suelo del entorno, no de este ticket.

### Errores propios (A9)

- El primer intento de leer `DATABASE_URL_DEV` con `dotenv` capturó también la línea de aviso
  de `dotenv` («injecting env…») dentro del `$(...)` de bash, y el `DATABASE_URL` quedó vacío
  — el preview de Prisma falló con «debe empezar por postgresql://» hasta usar `{quiet:true}`
  y `2>/dev/null`. No llegó a imprimir ninguna credencial (el fallo fue un string vacío, no un
  string filtrado), pero el diagnóstico costó dos vueltas.
- Sobrepensé el reparto tipo/cuota vs. `declarada` dándole varias vueltas antes de fijarlo por
  el precedente YA existente en el propio fichero (`vatDeducible`) en vez de inventar un
  criterio nuevo — el precedente estaba a la vista desde el principio.

### Desbloquea

SCRUM-1066 (modelos 111/115): las tres bases tienen el esquema, y el dominio ya sabe
escribir/leer `retencionPracticadaTipo`/`Cuota` sin tener que tocar `expenses.service.ts` de
nuevo. Lo que SCRUM-1066 SÍ tiene que construir: el cubo de tipos válidos por 111 vs. 115, la
pantalla de captura (rutas incluidas) y la clasificación de `retencionPracticadaDeclarada`.
