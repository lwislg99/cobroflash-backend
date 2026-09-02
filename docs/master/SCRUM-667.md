# SCRUM-667 · Los marcadores de microcopy que hoy VE un profesional

**Fecha:** 2-sep-2026 · **Carril:** microcopy y guards · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `a5aef1b9bbd2570eccbde82b407c9d3675192c2d` · 2026-09-02T17:30:07Z

> **La premisa cambió hoy.** Producción llevaba nueve días sin desplegar por deriva de esquema. Al
> arreglarse, **cada merge sale a producción** y desapareció el hueco entre mergear y desplegar que
> hacía inofensivo un marcador. Un `[PENDIENTE microcopy oficial]` dejó de ser una nota para el
> equipo y pasó a ser texto que lee un profesional que paga.

---

## 1 · PASO 0

### ENTRADA

**Sí hay entrada, y estaba en pantalla:** `public/dashboard/js/switchTipoArticulo.js`, el switch
del catálogo, pintado en el alta y en la edición de artículo desde `productsView.js`. Tres rótulos
—«Esto es», «Producto», «Servicio»— salían con el prefijo `[PENDIENTE microcopy oficial]` delante,
en la **primera pantalla del catálogo**, en producción.

Para la parte 2 la entrada es otra: **la próxima pantalla o PDF que alguien escriba**. Los tres de
hoy se encontraron *mirando*, por casualidad. El siguiente no vendrá con una captura.

### MECANISMO · existía, y a medias — el trabajo era darle superficie

| pieza | qué mira | ¿basta? |
| --- | --- | --- |
| `scripts/censo-marcadores.mjs` | `public/dashboard/js`, `public/` entero y **`src/`** | Cuenta bien, **pero no es un guard**: es una herramienta que hay que ejecutar a mano |
| `tests/scrum402-marcador-no-se-pinta.test.mjs` | **sólo `public/dashboard/js`** | Es el trinquete, y **no mira `src/`** |

🔴 **Ahí está el hueco, y no es el que decía el carril.** Se me dijo que «`src/` no lo mira nadie»:
para el **censo** es falso —lo barre desde que existe—, pero para el **trinquete** es exacto. Las
**8 marcas de `src/` las ve el censo y no las congela nadie**, y de `src/` salen justamente las que
se imprimen en un PDF.

---

## 2 · Lo medido, con la semilla PUESTA

El control positivo eran los tres del catálogo, así que se censó **antes** de retirarlos: si el
instrumento no los encontraba, estaba roto. Los encontró — y de paso enseñó su propia forma:

```
switchTipoArticulo.js →  1 marca escrita  ·  13 «usos»  ·  pero sólo 2 PINTAN
    L59  leyenda.textContent = MARCADOR + ' Esto es'
    L82  texto.textContent   = MARCADOR + ' ' + ETIQUETA[valor]     → «Producto» y «Servicio»
```

Los otros 11 «usos» son asignaciones y exportaciones que no pintan nada, y algunos van por
duplicado. **El censo cuenta usos del identificador, no superficies**; su total de «superficies
pintadas» está por encima de lo que un profesional ve. No se corrige aquí —no es este carril— pero
queda declarado.

**Población el 2-sep-2026, después de retirar los tres:** 344 ficheros leídos · **25 marcas**
(panel 16 · público 1 · **servidor 8**).

### 🔴 Y lo caro: qué llega al PDF DEL CLIENTE

Se comprobó **leyendo el papel** con `lineasDePdf` (SCRUM-659), no la plantilla:

| factura | marcadores impresos |
| --- | :-: |
| **un** tipo de IVA | **0** ← control negativo |
| **dos** tipos de IVA | **1** — `[PENDIENTE microcopy oficial]` |

**`MARCADOR_MICROCOPY_DESGLOSE` se imprime en la factura** cuando hay más de un tipo de IVA: es el
rótulo de la columna de bases del desglose. Ese PDF **lo ve el cliente de nuestro cliente**. El
propio fichero ya lo declaraba, y la medición lo confirma. Hoy no llega a un cliente real porque
`INVOICING_ES_ENABLED` está OFF para merchants ES (regla 24) y la demo lleva marca de agua — pero
**el único freno es un flag**.

> ⚠️ **Mi primera medición dio 0 y era FALSA.** Construí la factura con `quantity`/`unitPrice`/
> `vatRate` y el generador lee `qty`/`price`/`tax` (fracción): todas las líneas cayeron al 0 %, un
> solo tipo, y el marcador no salía. Un falso negativo perfecto — el mismo error que este ticket
> persigue, cometido midiéndolo. Por eso el guard lleva dentro el control de que el lector ve el
> PDF (`QA SL` = 1) **antes** de afirmar nada sobre lo que no ve.

---

## 3 · Qué se construyó

### Parte 1 · Los tres, retirados

El fundador aprobó los textos **tal cual**: «Esto es» · «Producto» · «Servicio». Se retiró **sólo
el prefijo**; el texto no se toca, ni se abrevia, ni se reordena, ni se le añade puntuación
(regla 30 — es copy del fundador desde ahora).

Y **se apagaron los tres a la vez**, que es justo lo que la entrada anterior del censo avisaba de
que *no* se podía dar por hecho: salían de una sola constante `MARCADOR`, así que aprobar uno solo
habría obligado a partirla. Se aprobaron los tres, así que la constante se retiró entera.

El censo baja **en el mismo commit**: `switchTipoArticulo.js` **sale** del `CENSO` de SCRUM-402 —
entrada borrada, no puesta a 0, como las once del 17-ago. Y `tests/scrum609b` deja de exigir el
marcador y pasa a exigir su **ausencia** y el texto literal.

### Parte 2 y 3 · `tests/scrum667-marcador-visible.test.mjs`

Deriva de `censar()` en vez de releer el árbol por su cuenta.

* **Trinquete de `src/`** por fichero, en **las dos direcciones**: uno nuevo o que sube es rojo; y
  si **baja**, también — «un trinquete que sólo sabe subir deja de significar algo el día que algo
  se cierra», que es exactamente lo que ha pasado hoy.
* **`EN_EL_PAPEL`**: la lista declarada de lo que puede imprimirse en un PDF, con su condición. Se
  verifica leyendo el papel.
* **Suelos**: menos de 100 ficheros o cero marcas → CIEGO. Y un **suelo por ámbito**: si `src/`
  dejara de barrerse, su trinquete pasaría en verde sobre un conjunto vacío — el estado del que
  sale este ticket.
* **Negativos**: un marcador en un **comentario** no cuenta, y `tests/` no entra en el censo.

---

## 4 · Evidencia

Commiteado en verde antes de mutar; **toda mutación revertida con `git status` vacío** como
post-condición.

| mutación | resultado |
| --- | --- |
| marcador nuevo en `src/core/entitlements.ts` | 🔴 cae nombrando el fichero: «HAY MARCADORES NUEVOS EN `src/`: src/core/entitlements.ts (+1)» |
| **segundo marcador impreso en el PDF** | 🔴 caen **dos** guards; el del papel dice «EL PAPEL DEL CLIENTE TRAE 2 MARCADOR(ES) Y HAY 1 DECLARADO(S)» y **transcribe el intruso** |
| retirar un marcador de `src/` sin bajar el censo | 🔴 cae: «han bajado, que es la dirección buena: `jobDireccion.ts`: 1 → 0. Actualiza `CENSO_SERVIDOR` en este mismo commit» |
| **negativo**: marcador en un **comentario** de `src/core/flags.ts` | ✅ **10 pass, 0 fail** — no lo tumba |
| **negativo**: factura de un solo tipo de IVA | ✅ 0 marcadores en el papel |

**Verde**: `npm test` completo después del último cambio, worktree limpio, `main` mezclado dentro,
Prisma regenerado y `dist/` reconstruido desde este worktree. `npm run guards:entrada` verde.

---

## 5 · Huecos declarados

* **El censo cuenta «usos», no superficies pintadas.** Medido: 13 usos donde pintan 2. Su total de
  superficies está inflado por asignaciones, exportaciones y duplicados. El trinquete de este
  ticket cuenta **marcas por fichero**, que sí es estable — pero quien lea «266 superficies» está
  leyendo un número mayor que lo que ve un profesional.
* **`EN_EL_PAPEL` cubre la FACTURA.** Presupuesto, albarán y parte generan PDF por caminos propios
  y **no** están bajo este guard. Es el siguiente escalón natural y no se ha hecho hoy.
* **La visibilidad real de los 16 del panel no se ha medido uno a uno.** El banco de vistas
  (SCRUM-666) podría decir si se pintan, con su tercera respuesta CIEGO; queda como trabajo
  declarado, no hecho. Lo que sí está cerrado es que **ninguno nuevo entra sin verse**.
* **No se ha tocado ningún marcador cuya copy no esté aprobada.** Los otros 25 se listan, no se
  inventan (regla 30).

---

## Tests que introduce esta entrada

* `tests/scrum667-marcador-visible.test.mjs` — 10 pruebas: dos suelos del censo (árbol y por
  ámbito), el trinquete de `src/` en las dos direcciones, el suelo del lector de PDF, el control
  negativo de la factura de un tipo, el guard del papel del cliente, los dos negativos
  (comentario y `tests/`) y la fijación de los tres textos aprobados.
* `tests/scrum609b-switch-tipo-articulo.test.mjs` — el test del microcopy se invierte: exigía el
  marcador, ahora exige su ausencia y el texto literal aprobado.
* `tests/scrum402-marcador-no-se-pinta.test.mjs` — `switchTipoArticulo.js` sale del `CENSO`.
