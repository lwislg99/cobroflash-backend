# SCRUM-320 · G5: «Qué falta para cobrar» — la última del bloque G

**Fecha:** 6-ago-2026 · **Carril:** A · **Gate:** sin gate, corre en `npm test` · **UI:** vanilla (regla 4)

**Medido contra:** `origin/main` = `93e924e12c321c4a27749b249aaa17056e88d512` · 2026-08-06T10:56:59+02:00

## El defecto

La pantalla decía **cuánto** se ha cobrado y no decía **qué falta** para cobrar el resto. Es un
marcador, no una respuesta.

## La sección NO tiene CTA propio, y eso es la decisión que la desbloqueó

Estaba parada porque parecía que había que elegir entre extender `jobNextAction` —cambiando también
la cabecera y la tarjeta del listado— o repetir su CTA aquí. **Las dos opciones daban por hecho algo
falso: que esta sección tiene que elegir UNA acción.**

La cabecera contesta «¿cuál es LA siguiente acción de este Trabajo?» — una sola. Ésta contesta otra
pregunta: «¿qué falta para cobrar?», que puede tener **varias respuestas a la vez** (dos albaranes
sin firmar **y** 300 € facturados sin cobrar).

> Una sección que **enumera** huecos no tiene que elegir uno. Elegir es el trabajo de la cabecera, y
> hay una sola cabecera.

Así que cada hueco lleva **su propio enlace en su propia línea**. `jobNextAction` no se toca
(SCRUM-366 intacto), no hay una segunda escalera, y no hay forma de que las dos superficies se
contradigan. Hay guard de las tres cosas.

## Los cinco importes, cada uno de su fuente

| línea | de dónde |
|---|---|
| Aceptado | `job.totalAceptado` |
| Entregado y firmado | Σ `totales.total` de los albaranes **firmados** |
| Facturado | Σ `total` de **todas** las facturas del Trabajo |
| Cobrado | `job.totalCobrado` |
| **Te falta por cobrar** | `aceptado − cobrado` |

**Facturado incluye los justificantes**, y no es un descuido: un justificante es el mismo acto de
facturar con otro papel —se emite **en lugar** de la factura cuando el merchant ES real no tiene la
facturación activa—, así que excluirlo daría «Facturado 0 €» para todos los merchants reales de hoy.
Las rectificativas ya llegan con el importe **negado** (`-Number(original.total)`), de modo que la
resta la hace la propia suma y no hay que acordarse de ella en ningún sitio.

**«Te falta por cobrar» se mide contra lo ACEPTADO**, que es a lo que el cliente se comprometió.
Contra lo facturado diría otra cosa —y más pequeña— justo cuando aún queda por facturar, que es
cuando el pro necesita el número entero.

## 🔴 Solo cuenta como entregado lo FIRMADO

Un albarán en borrador o enviado-sin-firmar **no es entrega probada**. Contarlo sería decirle al
profesional que puede facturar algo que el cliente no ha aceptado, y ése es justo el euro que acaba
en discusión.

**Asimetría de coste:** contar de menos cuesta una comprobación; contar de más cuesta la factura y
el cliente. Tiene test explícito **y su contraste** — el mismo albarán firmado sí suma, para que el
control negativo no pase por no sumar nunca.

## Cada hueco se deriva POR DOCUMENTO, no restando

Es el detalle que lo hace correcto. En el ejemplo aprobado, **entregado (600) == facturado (600)** y
sin embargo **hay 600 € entregados sin facturar**: son documentos distintos que coinciden en el
total por caminos distintos. Restando, el hueco desaparecería estando ahí.

Se deriva por el `facturado` del propio albarán (que es `invoiceId != null`) y por el `status` de la
propia factura. Hay test que fija el fixture con los dos totales iguales **a propósito**.

Orden fijo, y no es estético: primero lo que el pro **puede resolver hoy mismo** (perseguir una
firma), luego lo suyo (facturar) y al final lo que depende del cliente (que pague).

## Sin huecos, la sección no se pinta

Misma regla del hueco que G3 y G4. Como el requisito se cumple **por ausencia**, el guard lleva
**control positivo**: comprueba que con un Trabajo saldado no se pinta **y** que con huecos sí — sin
eso, `seccionCobroVisible` podría devolver `false` siempre y el test pasaría por avería. Y comprueba
que el resto de la pantalla sigue montándose: «no se pinta» y «se rompió al pintar» se ven igual
desde fuera.

## El invariante con la cabecera

En vez de una escalera nueva: **si la cabecera propone una acción del eje COBRO, esta sección tiene
que listar algún hueco.** No rediseña nada y caza el día que las dos superficies empiecen a
divergir.

### 🔴 Y ya ha cazado algo — DECISIÓN PENDIENTE

Un Trabajo **`terminado`, con importe aceptado y sin ningún documento todavía** (ni albarán ni
factura): la cabecera propone «Cobrar el resto» y **esta sección no lista nada, así que no se pinta**.
La pantalla diría a la vez que hay que cobrar y que no falta nada.

Los tres huecos aprobados hablan de **documentos**, y ahí no hay ninguno. **No he añadido un cuarto**
—sería inventar una decisión de producto y su microcopy—. El invariante se limita explícitamente a
los Trabajos con documentos, y **el caso tiene su propio test** que fija la situación tal y como se
reporta: si mañana cambia, ese test cae y esta entrada deja de describir la realidad.

> **Para decidir:** ¿se añade un cuarto hueco («aceptado y sin facturar») o se acepta que la sección
> no aparezca hasta que exista el primer documento?

## 🔴 Y un hueco de datos, también para decidir

**`totales` es `null` en los albaranes `SIN_VALORAR` — que es el modo por DEFECTO.** Con tres
albaranes firmados y sin valorar, «Entregado y firmado» sería `0,00 €`: una afirmación falsa, no un
hueco. **En la pantalla del dinero no se escribe un cero que no se ha medido**, así que la línea se
**omite** cuando no se pudo medir.

Consecuencia, dicha claro: **dos de los tres huecos solo aparecen con albaranes valorados.** El de
las firmas funciona siempre — y es el más útil, porque es lo único que el pro puede resolver hoy
mismo.

## Los ocho rojos

| # | Qué se rompe | Qué sale |
|---|---|---|
| 1 | Quitar el hueco `sin-firmar` | 🔴 **nombrándolo**, en el orden canónico |
| 2 | Quitar el hueco `sin-facturar` | 🔴 dos tests |
| 3 | Un albarán ENVIADO cuenta como entregado | 🔴 «el euro que acaba en discusión» |
| 4 | Los huecos por resta en vez de por documento | 🔴 «el hueco existe y ha desaparecido» |
| 5 | La sección se pinta sin huecos | 🔴 control positivo |
| 6 | Escribir `0,00 €` sin haberlo medido | 🔴 «sobre albaranes firmados de verdad» |
| 7 | Un botón primario en la sección | 🔴 «eso la convierte en una segunda cabecera» |
| 8 | Cegar el derivador de importes | 🔴 SUELO |

**Repetidos enteros después de mergear `main`**, y leídos por `$?`.

### Dos que no salieron a la primera

- **El suelo del invariante** avisó de que, al excluir el caso sin documentos, **ningún caso de
  prueba producía ya una acción del eje COBRO**: el invariante habría pasado **por vacío**. Se
  añadieron dos fixtures que sí lo ejercitan (nivel 1 «cobrar» y nivel 2 «recordar»).
- **El rojo 7** anclaba en `cobroSec` —la variable del **llamador**— y el botón se pinta dentro de
  `pintarQueFaltaParaCobrar`, donde la sección se llama `sec`: la ventana de búsqueda no llegaba
  nunca al botón. Reescrito recortando la función **con los dos extremos comprobados**.

## Verificación

- `npm run build` → **exit 0** y `npm test` → **exit 0**: **1898 tests · 1831 pass · 0 fail · 67
  skipped** (antes del último merge de `main`; los ocho rojos se repitieron después).

## Microcopy (regla 30)

Aprobada por el fundador y usada **literal**: `Qué falta para cobrar` · `Aceptado` · `Entregado y
firmado` · `Facturado` · `Cobrado` · `Te falta por cobrar` · `N albaranes sin firmar` · `Ver
albaranes` · `N € entregados sin facturar` · `Facturar lo entregado` · `N € facturados sin cobrar` ·
`Registrar cobro`. **Ni un texto inventado.**

## Huecos declarados

- **AB6 · matriz de dispositivos y capturas: PENDIENTE** (humano).
- **El cuarto hueco** (Trabajo terminado sin documentos) — decisión del fundador.
- **Dos de los tres huecos solo con albaranes valorados** — decisión del fundador.

## Lo que NO se tocó

`jobNextAction` (SCRUM-366 intacto) · el cobro · la firma · `prisma/schema.prisma` · el reparto de
DOCUMENTOS (**G4**) · ninguna migración ni `db push` a ninguna base (SCRUM-385/383).

---

> **SEGUNDA ENTREGA DEL MISMO TICKET.** Va aquí dentro y no en un fichero aparte: dos entregas
> son dos ENTRADAS del mismo registro, igual que al resolver un conflicto en `docs/master/` se
> conservan las dos y nunca se abre un nombre nuevo. Un fichero libre reintroduciría por la
> puerta de atrás la colisión que el trinquete de SCRUM-273 existe para impedir.
>
> **Cada entrada conserva SU PROPIA ancla, con su hora.** Fundirlas sería perder la trazabilidad
> de cuál midió qué: la de arriba midió G5 y la de abajo el cuarto hueco, contra `main` distintos.

## SCRUM-320 · C4: el cuarto hueco — «aceptados y sin facturar»

**Fecha:** 6-ago-2026 · **Carril:** A · **Gate:** sin gate, corre en `npm test` · **UI:** vanilla (regla 4)

**Medido contra:** `origin/main` = `dc6349675ebafac45c2be5e126063c064bb188d8` · 2026-08-06T13:32:39+02:00

### Qué cierra

El invariante de G5 —«si la cabecera propone una acción del eje COBRO, esta sección lista algún
hueco»— cazó una contradicción el primer día: un Trabajo `terminado`, con importe aceptado y **sin
ningún documento**, hacía que la cabecera dijera «Cobrar el resto» y la sección no listara nada, o
sea que no se pintara. La pantalla decía a la vez que había que cobrar y que no faltaba nada.

**Es el caso en que el 100 % del dinero está fuera, y callarse justo ahí es fallar cuando más falta
hace.** Decisión del fundador: entra el cuarto hueco.

### Lo que entra

```
853,05 € aceptados y sin facturar     → Facturar el trabajo
```

- **Condición:** importe aceptado > 0 **y ninguna factura**. «Sin facturar NADA» significa nada, no
  «poco»: con una factura emitida —aunque sea de 1 €— deja de ser cierto, y del resto informa
  `sin-cobrar`. Tiene control negativo.
- **Orden:** después del parcial. Leídos de arriba abajo escalan el alcance —«600 € de lo entregado»
  y luego «853,05 € del trabajo entero»—. Los dos pueden salir a la vez y son dos verdades
  distintas: esta sección **enumera**, no elige.
- **Destino del enlace: ALBARANES, no FACTURAS.** Este hueco sale precisamente cuando no hay
  ninguna factura, así que la sección FACTURAS no está pintada y el enlace no llevaría a ningún
  sitio. La de albaranes se monta siempre, y es donde se empieza a documentar lo que luego se
  factura.

### El test provisional se BORRÓ, no se adaptó

`el HUECO MEDIDO queda a la vista, no tapado` fijaba la situación provisional para que no se
quedara en una nota que nadie relee. Con la decisión tomada, esa situación ya no existe.

Adaptarlo habría dejado un test describiendo un estado superado — y eso es exactamente lo que se
cazó en A4: **un test que fija un defecto cuesta más que no tener test, porque el siguiente que lo
lea creerá que está decidido.** Lo que protegía lo protege ahora el invariante, ya **sin
exclusiones**: vuelve a valer para todos los casos, que es como tenía que ser.

### 🔴 Y el rojo 4 destapó una constante decorativa

Quitar `sin-facturar-nada` de `HUECOS_COBRO` **no rompía nada**: la lista canónica estaba declarada
y ningún test la contrastaba con lo que `huecosDeCobro` produce de verdad. Una lista que nadie
compara con la realidad se queda vieja sin avisar.

Ahora hay un test que construye un Trabajo donde salen los cuatro, compara el conjunto producido
con el declarado en las dos direcciones, y comprueba que el orden de salida es el canónico.

### Los cuatro rojos

| # | Qué se rompe | Qué sale |
|---|---|---|
| 1 | Quitar el cuarto hueco | 🔴 el test de C4 **y el invariante con la cabecera** |
| 2 | Sale aunque ya haya una factura | 🔴 «sería falso» + el control positivo |
| 3 | Lleva otro importe que el aceptado | 🔴 nombrando el importe |
| 4 | Se pierde en el orden canónico | 🔴 «hay un hueco que sale y nadie declaró» |

### Verificación

- `npm run build` → **exit 0** y `npm test` → **exit 0**: **1996 tests · 1929 pass · 0 fail · 67
  skipped**, ya con `main` mergeado hacia dentro.
- Los cuatro rojos, **repetidos enteros después de ese merge** y leídos por `$?`.

### 🔴 El error de proceso que casi entra, y cómo se ve venir

Al consolidar usé `git reset --soft origin/main` desde un worktree creado sobre un `main`
**anterior**. Eso compara mi árbol viejo contra el `main` nuevo: **todo lo que había entrado en
medio salió marcado como BORRADO** — 21 ficheros de otras sesiones (SCRUM-290, 296, 306, 386 y sus
tests, `libroRegistro.ts`, `albaranAFactura.ts`). Y se subió así.

Lo destapó leer el `--stat` del commit, no que el push fallara: el push dijo OK. Corregido
recuperando el estado bueno del reflog, mergeando `main` hacia dentro y consolidando **sin
`reset --soft`**.

**La regla que sale de aquí:** `git reset --soft <rama>` solo es seguro si tu base **ya contiene**
esa rama. Si no, no consolida: reescribe el diff contra un punto que tu árbol nunca vio. Y se
comprueba en una línea, mirando si el commit **borra** algo:

```
git diff --diff-filter=D --name-only origin/main...HEAD
```

En un ticket que solo añade, eso tiene que salir **vacío**.

### Microcopy (regla 30)

`853,05 € aceptados y sin facturar` y `Facturar el trabajo` — aprobados por el fundador y usados
literales. Ni un texto inventado.
