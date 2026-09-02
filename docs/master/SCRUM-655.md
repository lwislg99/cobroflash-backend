# SCRUM-655 (T6, sprint Tecnosel) · Apartados, numeración derivada y la descripción que se pinta

**Fecha:** 2-sep-2026 · **Carril:** presupuestos · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `01d5c5a06027a443542cb327e029195ac561fda6` · 2026-09-02T11:06:57+02:00

> **El ticket encogió al medirlo, y eso fue lo mejor que le pasó.** El PASO 0 corrigió dos premisas
> del encargo y las dos correcciones quitaron trabajo en vez de añadirlo.

## 1 · El PASO 0, y los dos canales que no había que construir

«Multilínea» no describe el texto: describe el **canal**. Medidos los tres antes de escribir nada:

| canal | lo que se suponía | lo medido |
| --- | --- | --- |
| **PDF** | «depende del generador» | ✅ **ya resuelto**: `partirConceptoYDescripcion` (SCRUM-603) parte el concepto por el primer salto y lo pinta aparte. Una sola copia, compartida con la factura. **No se toca.** |
| **Pantalla** | «hay que pintarlo» | 🔴 **el hueco real**, con su línea: `quotesDetailView.js:500` metía el concepto como HTML —`<td>${escHtml(l.concept)}</td>`— y el HTML **colapsa** los saltos. Ocho renglones de texto técnico salían en una línea corrida. |
| **WhatsApp** | «llega tal cual» | 🔴 **no es un canal para este dato**: `concept` no aparece ni una vez en `whatsapp.ts`, y el presupuesto viaja como **enlace**. |

> **El tercer canal no había que medirlo: había que no inventarlo.** Es el error que esta casa ya
> pagó —`white-space: pre-line` en dos textos que no lo necesitaban— repetido por analogía.

## 2 · 🔴 Y la descripción tampoco se arregla con `white-space`

El reflejo es `pre-line`. **No se usa, y es deliberado**, por dos motivos que se sostienen solos:

1. Protegería un salto que **en el HTML ya no existe como estructura**.
2. Desde `node:test` **no hay forma de comprobar que el estilo esté puesto**: un test que mira el
   `.js` pasaría con el CSS borrado.

Así que la descripción se convierte en **estructura**: `celdaConcepto` devuelve **un elemento por
renglón**. El salto sobrevive sin depender de ninguna propiedad de CSS, y el test mide el árbol de
nodos que sale — el resultado, no la fuente.

## 3 · Un apartado es una LÍNEA MARCADA, y las cabeceras no suman

`Quote.lines` es plano y todos sus consumidores lo recorren: un array de apartados cambiaría la
forma para todos. La cabecera es **aditiva** — el que no sepa de apartados ve una línea más.

### 🔴 Y «no suman» no era lo que pasaba: era `NaN`

Medido con el `calcTotal` real **antes** de tocarlo:

```
calcTotal([{concept:'Mano de obra', qty:2, price:100}])              →  200
calcTotal([{concept:'1. APARTADO'}, {concept:'Mano de obra', …}])    →  NaN
```

`undefined * undefined` es `NaN`, y contamina la suma entera. Una cabecera sin este arreglo **no
deja el total igual: deja el presupuesto sin total.**

Se filtran **por su marca**, no por «no tener precio»: así una cabecera a la que alguien le meta un
importe sigue sin mover el total. Ése es el rojo que pediste, y está en el test.

## 4 · La numeración es derivada, y dos líneas no pueden compartir número

`1` para la cabecera, `1.01`, `1.02`… para sus partidas, todo desde el par (apartado, posición).
Mover una línea recoloca los números solos. Probado sobre **3 apartados × 15 líneas = 45 números
únicos**, no sobre el ejemplo de cinco: un contador que no se reinicia o un relleno de ceros que
colisiona sale ahí y no en el caso pequeño.

**Sin apartados no se numera nada** y **una línea anterior a la primera cabecera tampoco recibe
número** — darle un «0.01» sería inventarse una sección que nadie escribió.

## 5 · Hallazgo arreglado dentro (regla 37): `calcTierTotal` era una segunda copia

Lo destapó el compilador al hacer `qty`/`price` opcionales: `quotes.routes.ts:14` tenía **la misma
aritmética del total escrita otra vez**. Se habría quedado sumando `undefined` mientras la de
`utils` ya sabía saltarse las cabeceras. **Ahora delega.** Misma zona, bloqueaba la tarea, cabía.

Efecto medido: `quotes.routes.ts` **sale** del censo de aritmética de IVA de SCRUM-627, y la bajada
queda anotada — un arreglo sin anotar se deshace solo.

## 6 · La revisión: campo aparte, derivación construida, **cable parado**

`numeroConRevision` y `vigenteDe` están escritos y probados: crear la `.1` **añade**, no sustituye,
y «vigente» es la revisión más alta, derivada.

🛑 **No se cablea, y el diff va preparado**: `Quote` tiene `quoteNumber Int?` y **no** tiene campo de
revisión. `prisma/schema.prisma` es del fundador.

```prisma
model Quote {
  …
  // SCRUM-655 (T6) · La revisión de un presupuesto. `0` = original, `1` = el «P2004226.1».
  // VA APARTE y NO dentro del texto del número: metido en la cadena, saber qué revisiones hay
  // obligaría a PARSEAR UN TEXTO ESCRITO PARA HUMANOS, y el día que alguien cambie el formato el
  // mecanismo muere en silencio. «Vigente» tampoco es una bandera: es la revisión más alta,
  // derivada — una bandera puede contradecir a los datos (dos vigentes, o ninguna).
  revision Int @default(0)
}
```

```sql
ALTER TABLE "quotes" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0;

-- Verificación, detrás y en la misma sesión. Y su suelo: cero filas significa que el ALTER no se
-- aplicó, no que esté bien.
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'quotes' AND column_name = 'revision';
```

Es 100 % aditivo y con `DEFAULT 0`: todos los presupuestos existentes quedan como originales, que es
lo que son. Orden de siempre: **staging → verificar → producción → verificar → `schema.prisma` al
final.**

## 7 · Los guards ajenos que saltaron, y qué decidió cada uno

Nueve, y ninguno se apagó:

| guard | qué cazó | qué se hizo |
| --- | --- | --- |
| `_banco-vistas` ×2 | 67 scripts donde declaraba 66 | subido, con el motivo |
| SCRUM-411 (trinquete) | dominio nuevo inalcanzable | **7 → 8** a conciencia: `revision.ts` espera su campo |
| SCRUM-411 (huérfanos) | `MARCA_APARTADO` y `esApartado` exportados sin consumidor externo | **se les quitó el `export`** — y la clave compartida pasó a probarse **por efecto**, que es más fuerte |
| **SCRUM-619** ×2 | el vocabulario de la línea creció | **la decisión, escrita** — abajo |
| SCRUM-627 ×2 | la lista de aritmética de IVA cambió | anotada la bajada de `quotes.routes.ts` |

### 🔴 La decisión que SCRUM-619 exigía: qué hace la factura con `apartado`

**Nada, y es deliberado.** Un apartado es la estructura de lectura de una **oferta**; la factura es
otro documento y no la hereda. Al facturar, `Invoice.lines` recibe las líneas sin las cabeceras y
sin la marca.

**Los importes no cambian** —las cabeceras nunca sumaron—, así que no hay un euro en juego: lo que
se pierde es el agrupamiento visual. Y no se arregla aquí: tocar la puerta de la factura es camino
de emisión y está fuera de T6. Queda declarado para que la decisión sea de alguien y no del
descuido.

## 8 · Lo que NO se ha tocado

El IVA, los totales con IVA y las cláusulas de cierre (**T7**, la tanda siguiente) · el PDF ·
`whatsapp.ts` · la factura y el camino de emisión · `prisma/schema.prisma` · trabajos, partes y
empleados.

**Suite entera: 4.303 tests · 4.224 pasan · 0 fallos · 79 saltados.**
