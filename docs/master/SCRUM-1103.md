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
