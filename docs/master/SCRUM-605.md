# SCRUM-605 · DOC-15 · Atajos de vencimiento — en el PRESUPUESTO

**Medido contra:** `origin/main` = `d695ead49969337baa2165fbbd8a2dde4e0cc515` · 2026-08-25T12:10:00+01:00

> ⚠️ Esa hora es la del trabajo de esta rama, no una lectura de reloj — criterio R14.

**Alcance:** los atajos «7 / 14 / 30» sobre el campo que **ya existía** en el presupuesto.
**La factura NO entra**, y el motivo está medido abajo.

---

## 1 · El ticket se partió, y por qué

La condición de parada del encargo pedía medir de dónde sale la fecha que usa el semáforo antes
de tocar la factura. Lo medido cambió el ticket:

| lo que se creía | lo medido |
|---|---|
| el plazo legal es de **30/60 días** según destinatario | **no existe** ningún plazo de 30/60 en el árbol: cero apariciones |
| el semáforo está en la bandeja de **cobros** | está en la de **pendientes de FACTURAR** (`invoicesView.js:101` y `:520`); `cobrosView.js` **no tiene semáforo** |
| un campo tecleable competiría con él | su fecha es **100 % derivada** y no lee ningún campo del documento |

```ts
// pendientesFacturar.service.ts:217-218
const fechaLimite = fechaLimiteRecapitulativa(g.mesKey, tipo);   // mes natural + tipoDestinatario
const semaforo    = calcularSemaforo(fechaLimite, hoy);
```

El plazo real es el del **art. 13.2 RD 1619/2012**: último día del mes (PARTICULAR) o **día 16 del
mes siguiente** (EMPRESARIO). Es un plazo de **EMISIÓN**, no de pago.

**Conclusión: no hay dos fuentes, porque no es el mismo dato.** El semáforo mide *cuándo hay que
EMITIR*; DOC-15 mediría *cuándo hay que PAGAR*. La pregunta «¿cuál manda?» no llega a plantearse,
y el riesgo de que el campo alimente el semáforo por accidente está descartado **por
construcción**: ese semáforo se calcula en el servidor sin leer ninguna fecha del documento.

**Pero apareció otra parada, y ésa sí es real:** la factura **no tiene dónde guardar la fecha**.

---

## 2 · 🛑 La factura: al fundador, con el diff descrito y NO aplicado

`Invoice` no tiene ninguna columna de vencimiento. Sus campos de fecha son `paidAt` y nada más;
el único `vencimiento` del esquema es `Charge.expiresAt`, que es del **enlace de cobro**, no del
documento. Y `validarFacturaSuelta` sigue aceptando sólo `{ customerId, lines }`.

**Un campo de vencimiento que no se guarda no es una mejora**: el profesional lo teclea, cierra y
se pierde. «Sólo visual» era la única salida sin esquema y es la que no sirve para nada.

### El diff de esquema que haría falta — **descrito, NO aplicado**

```prisma
model Invoice {
  // …
  dueDate  DateTime? @map("due_date")   // SCRUM-605 · vencimiento de PAGO (≠ plazo de emisión)
}
```

**Aditivo y nullable**, sin `@default`: las facturas ya emitidas no tienen vencimiento declarado y
`null` («no se sabe») no es una fecha inventada. No se ha tocado `prisma/schema.prisma` (es
dominio del fundador) y no se ha ejecutado ningún `db push`.

**Y no basta con la columna.** El dato tendría que atravesar además:

1. `validarFacturaSuelta` — que hoy reconstruye el cuerpo con dos claves y **descarta el resto**;
2. `emitInvoice` — para persistirlo.

Las dos son **camino de emisión** (reglas 29/38): necesitan GO explícito. Es la misma frontera que
ya se midió en SCRUM-619 con la marca de suplido.

**Y una pregunta que no es mía:** si la factura acaba teniendo vencimiento propio, ¿qué relación
guarda con el plazo legal de emisión que ya pinta el semáforo? Son dos plazos distintos, pero
conviven en la misma pantalla. Eso lo decide el fundador, no este ticket.

---

## 3 · Lo construido: los atajos, sobre el campo que ya estaba

El campo existía desde A16.2 (`quotesView.js`, id `quote-valid-until`, rótulo **«Válido hasta»**
—aprobado, se reutiliza tal cual—, valor por defecto **+30 d**, `min` **+1 d**). Lo único que le
faltaba eran los atajos.

**El control negativo manda sobre el diseño:** no se ha tocado el valor por defecto, ni el `min`,
ni la nota de caducidad, ni se le ha colgado ningún *listener* al campo — hoy no tenía ninguno y
su valor sólo se lee al enviar. **Quien no pulse un atajo ve exactamente lo de antes**, incluida
la caducidad automática y el «pide uno actualizado» que ve el cliente.

### La aritmética, fuera de la vista

`public/dashboard/js/quoteAtajosVencimiento.js`, en funciones puras — mismo motivo que
`quoteMargen.js` y `quoteSuplido.js`: a un módulo de navegador sólo se le puede exigir la **forma**
de su fuente, y aquí lo que hay que exigir es que «30 días» dé la fecha correcta el 31 de enero.

Se calcula con `new Date(y, m, d + N)` y se formatea desde los **componentes locales**. `Date`
normaliza sola el desbordamiento de mes y de año, así que fin de mes, cambio de año y bisiesto
salen bien **sin tabla de meses y sin ninguna librería** (regla 36).

> **Hallazgo declarado, no arreglado:** el valor por defecto del campo usa
> `Date.now() + 30*86400000` y `toISOString()`, que supone días de 24 h y formatea en **UTC**. En
> los cambios de hora y a horas locales tempranas eso puede dar un día distinto del que da el
> atajo de 30. No se unifica porque tocar el defecto cambiaría lo que ve quien no pulsa nada —
> que es justo el control negativo de este ticket.

### AB3/AB6: cero CSS nuevo

Los atajos **reutilizan la ficha que ya existe** (`quote-plantillas` + `quote-plantilla-chip`, de
SCRUM-139 F6), que trae los **44 px** de objetivo táctil y el anillo de foco. `btn-sm` se descartó:
está en **30 px**, por debajo de AB6.

---

## 4 · ⚠️ Microcopy: el encargo daba por hecho que no haría falta, y sí hace falta

Un botón necesita rótulo y **nombre accesible**. «7» a secas no dice de qué, y sin `aria-label` no
es accesible. Es texto **nuevo**, así que sale con el marcador de la casa
**`[PENDIENTE microcopy oficial]`** (regla 30).

**Censo de SCRUM-402: sube de 8 a 9 ficheros**, declarado en su tabla con su motivo. Se cuenta
**1**: los tres botones y sus tres `aria-label` salen de **una sola constante**, así que aprobar el
texto los apaga de golpe. El **número** va delante del marcador y no es microcopy —es el dato del
atajo—, que es lo que los mantiene distinguibles mientras el texto no llegue.

> 🔴 El encargo pedía el marcador `[copy: fundador]`. **Ese marcador no lo cuenta el censo**, que
> busca `[PENDIENTE`: habría sido un marcador **invisible para el trinquete que existe justo para
> verlo** — el mismo censo ciego que se cerró en SCRUM-627, con la ventana abierta por la
> notación. Se usa el de la casa. (Corregido también en el encargo siguiente.)

---

## 5 · Verificación

**Los bordes, calculados con el módulo y no razonados:**

| caso | desde | + | da |
|---|---|---|---|
| fin de mes, febrero de 28 | 2026-01-31 | 30 | **2026-03-02** |
| fin de mes en año **bisiesto** | 2024-01-31 | 30 | **2024-03-01** |
| la fecha **cae en el 29 de febrero** | 2024-01-30 | 30 | **2024-02-29** |
| cambio de **año** | 2026-12-15 | 30 | **2027-01-14** |
| cambio de año desde el 31 de diciembre | 2026-12-31 | 7 | **2027-01-07** |
| mes de 30 días | 2026-03-31 | 30 | **2026-04-30** |

**¿Puede un atajo caer por debajo del `min`? No** — y se comprueba en los días que más duelen (31
de enero, 29 de febrero bisiesto, 31 de diciembre, 30 de junio), no se razona. El detector lleva
su **control positivo**: con un atajo de 0 días dice que sí cae, así que su «no» de los otros vale.

**Lo que no se puede calcular devuelve `null`, nunca una fecha inventada** (`0`, `-7`, `7.5`,
`NaN`, `'7'`, `null`, `undefined`, `{}`), con el control al revés de que un dato bueno sí da fecha.

## Tests que introduce esta entrada

* `tests/scrum605-atajos-vencimiento.test.mjs` — los bordes, el control negativo del campo de
  siempre, la pregunta del `min` y la constante única del marcador.
