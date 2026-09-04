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

---

# FASE 2 · Las cajas medidas, y lo que faltaba de evidencia (4-sep-2026)

**Medido contra:** `origin/main` = `4719dc9e346bc747073509ed4199088684a0d7d5` · 2026-09-04T15:41:07+01:00

**Tanda:** **5.112 pruebas · 5.028 en verde · 0 fallos · 84 saltadas** — con `main` mergeado dentro
y medida DESPUÉS del último cambio de código.

> ⚠️ **La rama de la fase 1 ya estaba mergeada**, comprobado con el paso 2 del arranque
> (`git ls-remote --heads origin` en listado COMPLETO): `scrum-605-vencimiento-con-atajos` está en
> `main`. **El tablero decía que no y el tablero se equivocaba** — este apéndice mide qué hay de
> verdad en vez de fiarse de él, ni del test que lo destapó.

## PASO 0 — medido en el código, no en el tablero

### a) Qué está construido DE VERDAD: el motor entero, y funciona

| | |
|---|---|
| motor | `public/dashboard/js/quoteAtajosVencimiento.js` — `DIAS_ATAJO`, `fechaDeAtajo`, `rotuloDeAtajo`, `atajoPorDebajoDelMinimo` |
| pintado | `public/dashboard/js/quotesView.js:635-660` |
| ¿se pintan? | **sí** — tres `button.quote-plantilla-chip` con `type="button"` y `aria-label` |
| ¿funcionan? | **sí** — al pulsar escriben `validInput.value = fecha` |
| ¿calculan bien? | **sí**, y estaba probado: 13 tests verdes con fin de mes, bisiesto y cambio de año |
| ¿está en el índice y en el `sw`? | **sí**, en los dos |

**No es «un botón que pinta y no calcula».** La aritmética va por componentes locales
(`new Date(y, m, d + N)`) y no en milisegundos, con su motivo escrito: `86400000` supone días de
24 h —falso en los cambios de hora— y `toISOString()` formatea en UTC.

**Lo único que falta es el TEXTO.** Y no lo invento (regla 30).

### b) El marcador pinta SEIS superficies, desde UNA sola constante

Confirmado leyendo el pintado: por cada uno de los tres atajos se escribe el rótulo **y** el
`aria-label`, los dos desde `rotuloDeAtajo(dias)` → `MARCA_MICROCOPY`. **3 × 2 = 6.**

> ✅ **No hay que partir nada**, al contrario que en SCRUM-575: la constante ya es única y hay un
> test que lo fija (`la marca escrita aparece 1 vez en el fichero`). **Aprobar el copy apaga las
> seis de golpe.**

### c) 🔴 LAS CAJAS — lo que hace falta para firmar

Medido en navegador real, con el CSS de verdad (`.quote-plantilla-chip`: `min-height:44px`,
`padding:6px 14px`, `font-size:14px/600`, y la fila con `flex-wrap` y `gap:8px`).

| | 929 px | 390 px |
|---|---|---|
| ancho útil de la fila | **895 px** | **356 px** |
| chips **hoy**, con el marcador | 236 + 244 + 244 | 236 + 244 + 244 |
| alto de la fila **hoy** | 44 px (una fila) | **148 px — TRES FILAS APILADAS** |

> 🔴 **Ése es el daño de hoy en móvil**: el marcador no sólo es feo, hace que los tres atajos
> ocupen **tres filas** y empujen el resto del formulario.

**Cuánto cabe.** A 390 px hay **356 px para los tres**, y con los dos huecos de 8 px quedan
**~340 px de chips**. En el peor caso tipográfico (la «M», la letra más ancha) entran **21
caracteres por chip** a 929 px sin que ninguno se recorte.

**Candidatos medidos uno a uno a 390 px** — no son propuestas de copy, son **medidas**:

| textos | suma de anchos | ¿una sola fila? |
|---|---|---|
| `7 días` · `14 días` · `30 días` | 217 px | ✅ **sí** |
| `7 d` · `14 d` · `30 d` | 166 px | ✅ sí |
| `+7 días` · `+14 días` · `+30 días` | 246 px | ✅ sí |
| `1 semana` · `2 semanas` · `1 mes` | 254 px | ✅ sí |
| `7 días más` · `14 días más` · `30 días más` | 306 px | ✅ sí (justo) |
| `Válido 7 días` · `Válido 14 días` · `Válido 30 días` | 346 px | ❌ **no — pasa a dos filas** |

**El límite práctico está entre 306 y 346 px de suma.** Cualquier trío que sume ≤ 306 px cabe en
una fila a 390 px con holgura.

### d) La FACTURA no tiene campo de vencimiento — una línea, sin tocarlo

`expiresAt @map("vencimiento")` existe en el esquema, pero es de **`Charge`** (el cobro), no de
`Invoice`. **No hay campo de vencimiento de factura que tocar**, así que la acotación del encargo
no sólo se respeta: hoy no habría dónde construirlo sin columna nueva.

---

## Lo construido en esta fase: las dos evidencias que faltaban

El encargo pedía dos cosas que **no estaban**, y se han añadido:

**① LOS TRES, RECORRIDOS.** Los casos límite estaban escritos uno a uno —fin de mes, bisiesto,
cambio de año—, que es lo que hay que probar de la aritmética. Faltaba **lo obvio**: que **cada uno
de los tres** ponga lo que su rótulo promete. Se recorre `DIAS_ATAJO`, así que un cuarto atajo se
mediría solo; y si entra uno sin fecha esperada, **el test lo dice** en vez de pasar de largo.

**② CONTROL NEGATIVO: el rótulo no decide la fecha.** El día que se firme la microcopy el rótulo
**cambia entero** — si el cálculo dependiera del texto, aprobar el copy rompería las fechas de un
documento que el cliente recibe.

### 🔴 Y ese control negativo NO valía, hasta que su prueba de rojo lo dijo

La primera versión sustituía `A.rotuloDeAtajo` y comprobaba que las fechas no cambiaban. **Pasaba
siempre**: `fechaDeAtajo` llama a la función **interna**, no a la propiedad exportada, así que un
acoplamiento **dentro** del módulo —«si el rótulo no lleva X, no calcules»— se colaba entero.

Ahora el desacoplamiento se comprueba **donde se decide**: el cuerpo de `fechaDeAtajo` no puede
mencionar `rotulo` ni `MARCA_MICROCOPY`. Con esa mutación, **cae y nombra el acoplamiento**.

### El rojo, probado por el mecanismo

| se rompe a propósito | cae |
|---|---|
| el atajo de **14** calcula mal | «caso corriente de 14 días» — **nombra cuál** |
| el atajo de **30** calcula mal | cinco tests, entre ellos «LOS TRES atajos…» — **nombra el 30** |
| el cálculo se ata al rótulo | «el RÓTULO no decide la fecha», nombrando el acoplamiento |

Y el **suelo** ya existía y es más fuerte que un suelo: `DIAS_ATAJO` se compara con `[7, 14, 30]`
por igualdad exacta, así que una lista vacía no pasa.

## ✅ APLICADO · la firma del ASESOR, 4-sep-2026

**Los seis literales**, tal cual: rótulos `7 días` · `14 días` · `30 días`; nombres accesibles
`Válido hasta dentro de 7 / 14 / 30 días`. Registrados en
`docs/microcopy/2026-09-04-SCRUM-605-atajos-valido-hasta.md` con sus motivos y sus cajas.

⚠️ **Es la firma del ASESOR, no la del fundador**, y así queda escrito en el código y en el
registro. Este carril **no lleva contador `SIN_APROBAR`** —comprobado— así que no había ninguno que
bajar.

### La medición DESPUÉS, que es la que dice si entró

| a 390 px | antes | después |
|---|---|---|
| alto de la fila | **148 px** (tres filas apiladas) | **44 px** (una) |
| los tres chips | 236+244+244 | **67+75+75 = 217** |
| ¿recorta? ¿scroll horizontal? | — | no y no |

> 🔴 **Retirar el marcador devuelve 104 px de pantalla** en el móvil de un profesional. No era «un
> texto pendiente»: era un tercio de la pantalla ocupado por una nota interna.

### El censo, con el número delante

La entrada `'quoteAtajosVencimiento.js': 1` **se BORRA** —no se pone a 0 (SCRUM-424 / SCRUM-405)—
con su nota de salida. **Medido antes y después: 13 → 12 entradas**, y **cero** marcas en el
fichero.

### 🔴 Y UNA PREMISA QUE SE CAYÓ AL APLICAR

El encargo decía que los seis salían de **una sola constante** y que sustituirla los apagaba de
golpe. **Salían de una sola FUNCIÓN**, que daba el **mismo** texto al rótulo y al `aria-label`. Y
los dos textos aprobados **son distintos**, así que la forma anterior no podía servirlos: hacen
falta dos constantes.

**El nombre accesible queda CONSTRUIDO Y SIN CABLEAR**, y se declara en vez de esconderlo: la vista
pone el mismo texto en los dos sitios con una sola llamada, así que cablearlo es **una línea** en
`quotesView.js` — fichero de otro carril en vuelo (SCRUM-594). Hoy el `aria-label` dice «7 días»,
que es correcto pero **no es el literal firmado**.

### Los guards, RE-ANCLADOS a la forma nueva (no relajados)

Dos tests apuntaban al marcador y a `MARCA_MICROCOPY`, que ya no existen. **Se voltean a la forma
de hoy**, como manda el protocolo cuando cambia lo que el guard busca:

* el que fijaba el marcador pasa a fijar **los seis literales con `===`**, y además comprueba que
  **no puede volver** un `[PENDIENTE` al fichero —su entrada ya salió del censo, así que se
  pintaría sin que ningún trinquete lo contara—;
* y prohíbe explícitamente **«mes» y «semana»** en el rótulo: el motor cuenta DÍAS, y prometer un
  mes cuando se suman 30 es mentir donde el profesional sí mira;
* el control negativo del rótulo pasa a prohibir las constantes **nuevas** en el cuerpo de
  `fechaDeAtajo`.

## 🔴 LO QUE FALTA, Y NO LO PUEDO HACER YO

~~**Los textos no están aprobados**, así que **el marcador se queda**~~ — **HECHO el 4-sep**, ver arriba. El plan que se siguió fue éste:

1. se sustituye `MARCA_MICROCOPY` por el copy aprobado —**una sola constante, seis superficies**—;
2. se **BORRA** la entrada `'quoteAtajosVencimiento.js': 1` del `CENSO` de SCRUM-402, **no se pone
   a 0** (SCRUM-424 / SCRUM-405);
3. y se comprueba **con el número delante** que el censo pasa de **13 a 12 entradas**.

> **Medido hoy:** el censo tiene **13 entradas** y suma **13 marcas**; la de este fichero es **1**.

⚠️ **Y la grafía importa, porque ya se pagó una vez:** el encargo original del 605 pedía
`[copy: fundador]`, que **ese censo no cuenta**. La marca que cuenta empieza por `[PENDIENTE`, y
la que hay puesta es la correcta — hay un test que lo fija.

## Ficheros

`tests/scrum605-atajos-vencimiento.test.mjs` (dos tests nuevos: 13 → 15) · este apéndice.

**No se ha tocado:** `quoteAtajosVencimiento.js` —el motor está bien y no había nada que
arreglar— · `quotesView.js` (S2, SCRUM-594) · `customersView.js` (S3) · el camino de emisión ·
`prisma/schema.prisma` · el censo de SCRUM-402 —**se borra su entrada cuando se firme el copy, no
antes**— · los 41 anclajes por línea de SCRUM-710.

## Los huecos que declaro

1. **No he probado el clic en un navegador real.** Que `validInput.value = fecha` escriba lo que
   debe está probado sobre la función pura y sobre la forma del pintado, pero **nadie ha pulsado
   los tres botones** y mirado el campo.
2. **Las cajas se midieron con una réplica del campo**, no con la pantalla de presupuesto entera:
   monté el `.quote-plantillas` con su CSS real, pero el contenedor de la vista podría tener
   márgenes que no reproduje. El ancho útil (895 / 356) es el de mi réplica.
3. **Los candidatos de la tabla NO son propuestas de copy.** Son cadenas de prueba para medir
   cuánto cabe; aprobarlos es del asesor, y elegirlos yo sería inventar microcopy.
4. **No he medido a otros anchos** que 929 y 390, que son los que pedía el encargo.
5. **`atajoPorDebajoDelMinimo` no lo ejercita nadie en el pintado**: la vista no lo llama. Está
   probado como función, pero es un mecanismo sin superficie — lo declaro y no lo cableo, porque
   `quotesView.js` es de otro carril.

## HALLAZGOS FUERA DE CARRIL — una línea cada uno

* El valor por defecto del campo se calcula en `quotesView.js` con `Date.now() + 30*86400000` y `toISOString()`, así que en los cambios de hora y en horas locales tempranas puede dar **un día distinto** que el atajo de 30 — ya está declarado en la cabecera del módulo y sigue sin unificar.
* `atajoPorDebajoDelMinimo` está construido, probado y **no lo llama nadie**: es un mecanismo sin superficie, y el propio comentario dice que existe «por si algún día se añade un atajo de 0 días».
* El `expiresAt @map("vencimiento")` de `Charge` usa el mismo nombre de columna que tendría un vencimiento de factura, así que quien busque «vencimiento» en el esquema lo encuentra y puede creer que la factura ya lo tiene.
