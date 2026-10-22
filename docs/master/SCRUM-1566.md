# SCRUM-1566 · El expediente de los tres céntimos (1566 · 623 · 624 ②) — una firma

**Medido contra:** `origin/main` = `9839aa6c2baee741f6a38de4e99c7fc29a3fe807` · 2026-10-22T09:31:49Z

A9: sin fallo que generalice — tramo de papel, sólo lectura: ni `src/` ni `tests/`, y ningún arreglo aplicado

Sesión S1, encargo del orquestador (22-oct). **Sólo lectura.** No se ha tocado `vat.service.ts`,
`pdf.service.ts`, `registro.builder.ts` ni nada del camino de emisión, ni se propone texto de cara al
usuario. Enlaces: [SCRUM-623](SCRUM-623.md) (tramo del 19-oct en el PR #2616, abierto) ·
[SCRUM-624](SCRUM-624.md) (tramo «SCRUM-624c») · [SCRUM-1444](SCRUM-1444.md) (tramo 1444d, de donde
sale el 1566).

---

## 🔴 PARA EL FUNDADOR — lo que se firma (dos minutos)

**La pregunta:** ¿las tres se arreglan con UN cambio o con tres? **Respuesta medida (simulada sobre el
código de hoy, abajo cómo):**

1. **623 y 624 ② son EL MISMO defecto y se cierran con UN cambio (A).** Con A, las dos bajan a
   **0,0 %** en las siete poblaciones medidas, y **A no empeora ninguna otra columna**.
2. **1566 es OTRO cambio (B), en otro fichero.** A no lo toca.
3. **Hay un tercero escondido debajo de los tres: el empate de medio céntimo (C).** Y aquí está lo que
   no sabíamos: **arreglar una SÍ descuadra otra si se hace en mal orden.**
   - **C solo** (arreglar el redondeo del motor sin A) **empeora 623 y 624**: factura única al 10 %,
     de 1,2 % a **2,8 %**; tramos 50/50, de 12,4 % a **15,2 %**. Mueve el XML y el guardado, y el
     PDF se queda donde estaba.
   - **B solo empeora presupuesto contra factura**: con cantidades enteras al 10 %, de 0,0 % a
     **0,9 %**.
   - **A + B + C: las tres a 0,0 % en las siete poblaciones.**
4. **Lo que A + B + C NO cierran:** el presupuesto sigue sin cuadrar consigo mismo (base + IVA ≠
   total en el **21-48 %** de los presupuestos con cantidades decimales) y su IVA difiere del de la
   factura en **hasta un 3 %**. Eso lo cierra **un cuarto cambio (D): que el total que el cliente FIRMA salga
   de la misma cuenta.** D cambia un importe firmado: no es de este expediente, es de la asesoría.

**⇒ Tres tickets son UNA decisión: «la cuenta de `calcVatBreakdown` manda en TODAS las superficies»**
—que es extender a los papeles la que ya tomaste el 4-sep para el total guardado (SCRUM-624 fase C,
«gobierna la canónica»)—. Se ejecuta en este orden, y el orden es parte de la decisión:

| paso | qué | cierra | ¿antes de encender la facturación? |
|---|---|---|---|
| **A** | el bloque de totales del PDF de factura lee `calcVatBreakdown` y el total guardado | **623 y 624 ②** | **SÍ.** Es la que deja un céntimo mal PARA SIEMPRE en cada factura emitida |
| **B + C**, juntos | el pie del presupuesto usa la cuota de `calcVatBreakdown`; el empate se redondea bien en el motor | **1566** (y el empate) | C, sí (toca el XML), **pero nunca antes que A**; B puede esperar, pero NO puede ir sin C |
| **D** | el total del presupuesto sale de la misma cuenta | presupuesto ↔ factura | **después**, con la asesoría: cambia lo firmado |

**Lo que se contesta:** «autorizo A antes del SIF-1» · «autorizo A, B y C antes del SIF-1» ·
«después del SIF-1». **Si se elige «después», cada factura que se emita mientras tanto con el
descuadre se queda así: una factura emitida no se edita (regla 29), sólo se rectifica.**

---

## Las tres, una por una

| | **① SCRUM-1566** | **② SCRUM-623** | **③ SCRUM-624 ②** |
|---|---|---|---|
| **qué ve el cliente** | la página donde firma el presupuesto y el PDF del presupuesto dan un IVA distinto, por 1 céntimo | el PDF de su factura y el registro que va a Hacienda (XML VeriFactu) dicen base, IVA o total distintos, por 1-2 céntimos | el TOTAL impreso en su factura no es el guardado — el que se cobra y se declara (`ImporteTotal`) |
| **cada cuánto** (hoy) | cantidades decimales (m², horas): **4,4 %** al 21 %, **6,4 %** al 10 %, **7,7 %** mezclando tipos. Enteras: 0-0,9 %. *(1444d midió 5,9 % y 4,6 % en su población; aquí es la de 624c)* | factura única, un tipo: **0-1,6 %** · única, tipos mezclados: **28,8 %** · tramos: **12,4 %** · tramos mezclados: **40,0 %** | única, un tipo: **0-1,6 %** · única mezclados: **11,6 %** · tramos: **11,8 %** · tramos mezclados: **19,9 %** |
| **la línea que lo causa** | `presentacionIva.ts:179`: redondea la base del tipo y LUEGO multiplica · frente a `vat.service.ts:77` + `:84`: acumula la cuota línea a línea y redondea una vez. Se pintan en `quoteDecisionLanding.routes.ts:497` (página) y `pdf.service.ts:1093-1106` (PDF) | `pdf.service.ts:548-562`: su propio `vatMap`, suma sin redondear y redondea sólo al pintar (`:574`, `:630`/`:652`, `:664`) · frente a `vat.service.ts:84-90`, que redondea por tipo y suma, y que es lo que va al XML (`registro.builder.ts:315-332`, `verifactu.service.ts:297`) | `pdf.service.ts:562` (`grandTotal = subtotal + totalVat`, pintado en `:664`) · frente a `invoiceLines.service.ts:155-157` (`grossOfLines`, lo guardado), que va a `ImporteTotal` (`verifactu.service.ts:293`) |
| **qué se tocaría** | **B**: `presentacionIva.ts` (carril S1) | **A**: `pdf.service.ts`, bloque de totales de la factura (carril J1, camino de emisión) | **A**, el mismo |
| **si NO se arregla antes de encender la facturación** | no es documento fiscal: el presupuesto se puede reenviar. Muerde en credibilidad («¿cuál de los dos IVA es?»), no en Hacienda | **el papel y Hacienda dicen cosas distintas, y en cada factura emitida queda así para siempre** (regla 29). Las filas por tipo sí suelen coincidir (623, tramo 19-oct): lo que se separa es la base y el total agregados | **el cliente paga una cifra y su factura dice otra**, por 1-2 céntimos; inmutable igual que ② |

**Y el escondido — el empate (C):** `vat.service.ts:23-24`, `round2 = Math.round(n * 100) / 100`. En
un empate de medio céntimo decide el número binario: 1 × 22,50 € al 21 % → IVA exacto 4,725, YaQu
pone **4,72**. Lo midió 1444d: **0,30 %** al 21 %, **0,84 %** al 10 %. La misma forma está copiada en
`presentacionIva.ts:92`, `invoiceLines.service.ts:147` y `utils.ts:256` (`calcTotal`). El XML queda
cuadrado consigo mismo (base + cuota = total, medido: **0,0 %** de descuadre en todas las
poblaciones), pero con una cuota que no es base × tipo bien redondeado. **Si la AEAT lo rechaza: NO
LO SÉ.** Su catálogo tiene el error `1142` («CuotaRepercutida tiene un valor incorrecto para … base y
tipo», `docs/legal/fuentes/aeat-errores.properties`), y el margen que admite no está en ningún
documento del repositorio.

---

## La tabla que contesta la pregunta

% de documentos con el descuadre. Población por fila: 4.000 presupuestos (y las facturas que la
emisión real saca de ellos). Salida entera en `evidencias/SCRUM-1566/salida-expediente.txt`.

**Factura única · cantidades decimales · tipos 21/10/4 %** (la que más se mueve):

| escenario | ① 1566 | ② 623 | ③ 624 | presupuesto no cuadra consigo | presupuesto ≠ factura (IVA) |
|---|---|---|---|---|---|
| hoy | 7,7 % | 28,8 % | 11,6 % | 42,4 % | 9,9 % |
| sólo A | 7,7 % | **0,0 %** | **0,0 %** | 42,4 % | 9,9 % |
| sólo B | **0,0 %** | 28,8 % | 11,6 % | 42,4 % | 3,1 % |
| sólo C | 8,1 % | 29,0 % | 11,8 % | 42,8 % | 10,3 % |
| A + B + C | **0,0 %** | **0,0 %** | **0,0 %** | 42,8 % | 3,1 % |
| A + B + C + D | 0,0 % | 0,0 % | 0,0 % | **0,0 %** | **0,0 %** |

**Donde se ve que el orden importa** (las otras poblaciones, sólo las celdas que cambian):

| población | hoy | sólo C | sólo B | A + B + C |
|---|---|---|---|---|
| única · enteras · 21 % — ② 623 | 1,2 % | **2,1 %** ↑ | 1,2 % | 0,0 % |
| única · enteras · 10 % — ② 623 | 1,2 % | **2,8 %** ↑ | 1,2 % | 0,0 % |
| única · enteras · 10 % — presupuesto ≠ factura | 0,0 % | 0,0 % | **0,9 %** ↑ | 0,0 % |
| tramos 50/50 · enteras · 21 % — ② 623 | 12,4 % | **15,2 %** ↑ | 12,4 % | 0,0 % |

Las siete poblaciones dan lo mismo en lo que importa: **con A, ② y ③ a 0,0 % siempre; con A + B + C,
①, ② y ③ a 0,0 % siempre; y el XML cuadra consigo mismo en el 0,0 % de los casos en todos los
escenarios** — el registro fiscal es la referencia, son los papeles los que se separan de él.

---

## Cómo se ha medido, y qué vale

`docs/master/evidencias/SCRUM-1566/expediente-tres-centimos.cjs` —
`node <guion> <árbol con dist/> [300] [4000]`. Corrido contra el `dist/` del árbol `s1-624c`; los
ficheros de cuenta que usa no han cambiado entre su base (`eee7d2b4b`) y este `main` (`git log`: los
dos únicos commits en `src/modules/invoicing/` desde entonces tocan los libros y el emisor de JUST,
nada de lo que se llama aquí).

- **Los arreglos no se han hecho: se SIMULAN.** Hacerlos en el código sería modificar el camino de
  emisión (regla 38, STOP). El guion escribe una réplica de cada superficie con el redondeo como
  parámetro y **exige que, con el redondeo de hoy, dé lo mismo que el código real**:
  - el **PDF de factura de verdad** (`generateInvoicePdf` con `PDFDocument.prototype.text` espiado,
    como en 624c): **580 facturas, misma base, mismas filas de IVA y mismo TOTAL en las 580**;
  - `calcVatBreakdown`, `grossOfLines`, `pieDePresupuesto` y `calcTotal` reales: **1.700
    presupuestos y sus facturas, idénticos**. Si uno solo difiere, el guion se para.
- **Control positivo:** el caso a mano de 1444d (22,50 € al 21 %) sale 4,72 hoy y 4,73 con el
  redondeo simulado; si no, el guion se para.
- **Las facturas salen del camino de emisión real** (`lineasParaFacturar` → `stageLinesReconciled`
  con el objetivo de `distributeStageAmounts(calcTotal)`), con el generador y los planes de 624c.
- **Nada se escribe en el repositorio:** los PDF van a un temporal del sistema que se borra al salir.

**Lo que NO vale, declarado:**

- **Son poblaciones sintéticas, no facturas reales.** En producción no hay clientes reales; la
  consulta de sólo lectura de 624 fase C sigue sin correr.
- **C se simula con UN redondeo** (medio céntimo hacia arriba, en decimal). Es para medir el efecto,
  no una propuesta de convención: cuál manda es de la asesoría.
- **B se simula sin descuento global.** Con descuento global, `pieDePresupuesto` reparte el descuento
  entre tipos y recalcula la cuota sobre la base descontada: ahí B pide elegir cómo, y eso no se ha
  medido. Los presupuestos con descuento de línea quedan fuera de la columna ① a propósito: con
  descuento, página y PDF ya usan la misma función (`quoteDecisionLanding.routes.ts:476-488`).
- **D cambia el importe que el cliente firma** (`utils.ts:256`, `calcTotal`). Se ha medido para
  saber qué cierra; no se recomienda sin asesoría.
- **Fuera de la población:** facturas recapitulativas, factura final de tramos
  (`finalInvoice.service.ts`, que guarda un total explícito: si no casa con sus líneas, A imprimiría
  ese total) y la columna de importes por línea del PDF (SCRUM-1446).

## Lo que no está hecho

- **Nada arreglado.** A y C son camino de emisión y carril J1; B es carril S1, pero no puede ir sin C.
- **El trinquete de las dos mitades** que dejó pendiente el tramo de S3 en 623 sigue sin construir.
  El de este expediente se puede montar sobre este mismo guion el día que entre A.
