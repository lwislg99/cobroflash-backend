# SCRUM-582 · CONT-09 · Selección múltiple en la lista de clientes

**Fecha:** 4-sep-2026 · **Carril:** S3 · **Gate:** sin gate — corre en `npm test`

**Medido contra:** `origin/main` = `1a359f6ea2b90f110bfa40516d8bbcb58a7e0f94` · 2026-09-04T14:58:42+01:00

**Tanda:** 5104 tests, 5020 pass, **0 fail**, 84 skipped — medida DESPUÉS del último cambio, entrada incluida, con Prisma regenerado. Suelo: suelo 4798 · total 5104 · margen 306.

---

**Lo que entrega:** el mecanismo de selección. **Nada más.** Casilla por fila, casilla de
«seleccionar todos» con sus tres estados, y el estado consultable.

⛔ **Ni una acción en bloque**, y hay un test que cae el día que alguien añada un botón a la barra
«para probar». Tampoco va un contenedor de menú vacío: un menú «Acciones» que no hace nada es una
promesa rota cada vez que se pulsa.

⚠️ Y por escrito, aunque hoy no aplique: cualquier acción en bloque que **envíe mensajes** pasa por
la tabla anti-spam de la **regla 28** antes de existir. Seleccionar 300 clientes y mandarles algo es
el peor botón que se puede construir mal.

## PASO 0 — y dos premisas del encargo no se sostienen

### (a) ENTRADA

`pintar()` en `public/dashboard/js/customersView.js:352`. Las celdas se añaden **en el orden de
`FC.COLUMNAS`**, y `colSpanDeLaTabla()` **es** `COLUMNAS.length`: una columna nueva cuadra el
`colSpan` del vacío ella sola. Ése era el trabajo de SCRUM-584 y aquí se cobra.

🔴 **La trampa:** `tr.addEventListener("click", () => openCustomer360(c))` — **la fila entera abre
la ficha del cliente**. Una casilla dentro de esa fila la dispara.

### (b) MECANISMO — existe, y NO se reutiliza. Con la medida delante.

**La selección múltiple YA EXISTE** en `invoicesView.js`: casilla de cabecera (`#inv-check-all`),
`selectedIds`, barra flotante con contador. Pero:

* `selectedIds` se declara **dentro del cierre de `renderInvoicesView`** — medido por AST, la misma
  forma que tenía `buildModal` antes de SCRUM-591: no es invocable desde fuera;
* y las **únicas** piezas de nivel superior de ese fichero (`textoMarcadas`,
  `resultadoMarcadoEnBloque`) son las del **«marcar como pagadas»**, que es **flujo de dinero**.

Extraer un cierre que contiene el camino del dinero para una pantalla de clientes es lo que no se
hace. **Decisión confirmada por el asesor:** el estado se escribe en `filtroClientes.js` —puro y
probable sin navegador— y queda dicho ahí, con su motivo, para el día que facturas quiera
compartirlo. Eso es lo que lo convierte en un mecanismo y no en una copia.

### (c) El selector de columnas de SCRUM-584 — resuelto por construcción

`columnasElegibles()` filtra por `!fija`, así que la columna nueva entra con **`fija: true`** y el
selector **no la lista**. Y `claseDeColumna` sólo pone `col-hide-mobile` a las que lo declaran, así
que con **`ocultaEnMovil: false`** la casilla se ve también en el móvil.

Una casilla que el profesional pudiera apagar sin querer dejaría la selección inalcanzable **y sin
forma de recuperarla**: el control que la enciende estaría detrás de la propia columna.

### (d) 🔴 A 360 px NO hay tarjetas: la tabla de clientes es `table--stack-mobile`

El encargo daba por hecho `table--cards-mobile`. **Medido: no.** `customersView.js:265` construye
`table table--stack-mobile`, y seis vistas más usan la otra clase — clientes no.

Y lo que importa de verdad está en su CSS (`styles.css:2432`):

```css
@media (max-width: 640px) { .table--stack-mobile thead { display: none; } }
```

**A ≤640 px el `thead` entero desaparece**, y con él la casilla de «seleccionar todos». Las de cada
fila sobreviven (son `<td>`, y `td:empty` no las esconde porque llevan el `input` dentro).

**Por eso existe la barra de selección**, con la MISMA casilla de tres estados y el MISMO texto
aprobado: sin ella, en el móvil sólo se podría marcar de una en una — justo el profesional que más
lo necesita. Marcarla selecciona lo visible; desmarcarla lo suelta, así que también sirve de
«limpiar» sin inventar un segundo control ni un texto nuevo.

> 📌 **Consecuencia declarada:** en móvil hay que marcar **una** fila para que aparezca la barra y
> con ella «seleccionar todos». Desde cero no es alcanzable, porque la cabecera está oculta. La
> alternativa —una barra siempre visible— es una pantalla nueva y no es de este ticket.

## Las dos decisiones que este ticket toma, y quedan escritas

1. **«Seleccionar todo» selecciona LO FILTRADO**, no la base entera. Si significara los 300, el
   profesional marcaría a ciegas gente que la pantalla no le enseña.
2. **Al cambiar de filtro, la selección se RECORTA a lo visible.** Guardar lo que ya no se ve deja
   una selección **invisible** —el contador diría «12» con tres filas marcadas— y así es como se
   borra lo que nadie quería borrar. Se pierde trabajo al cambiar de filtro, y ése es el precio:
   lo que se ve es lo que hay.

## 🔴 Los rojos, por el mecanismo

Commiteado en verde antes de mutar; cada mutación comprueba que cambió el fichero que dice, se
restaura y se re-verifica. Control antes y después: `fail=0`.

| Mutación | Cae | Qué nombra |
|---|---|---|
| se rompe el `stopPropagation` de la casilla | **1** | «EL QUE MÁS RABIA DA: marcar NO abre la ficha» |
| desaparece la casilla de la **barra** | **2** | la del móvil, y la de «ni una acción en bloque» |
| se pierde el **tercer estado** | **1** | «los TRES ESTADOS… el del medio es el que importa» |
| «todos» pasa a coger la **base entera** | **3** | «selecciona LO FILTRADO», y dos más |
| la selección **sobrevive** al cambio de filtro | **1** | «se RECORTA a lo visible» |
| la columna pasa a ser **ocultable** | **2** | «NO es ocultable, y va la PRIMERA» |
| **aparece una acción en bloque** | **1** | «⛔ NO HAY NI UNA ACCIÓN EN BLOQUE, y esto es el ticket» |
| **CONTROL NEGATIVO** · renombrar la columna «Alta» | **0** ✅ | no cae, como debe |

El del `stopPropagation` **ejecuta el manejador de verdad** y observa la llamada: no comprueba que
la línea exista, comprueba que se llama.

## Microcopy

| Ranura | Estado | Texto |
|---|---|---|
| nombre accesible de «seleccionar todos» | ✅ **aprobado por el asesor** (4-sep-2026) | `Seleccionar todos` |
| contador de selección | ⚠️ **sin aprobar por nadie** | marcador `[PENDIENTE microcopy · CONT-09 contador de selección]` |
| nombre accesible de cada fila | — | **el nombre del cliente**, que es DATO, no copy |

**El censo de SCRUM-402 SUBE, con el número delante:**

```
ANTES (origin/main)     → 13 marcadores pintables en 13 ficheros
AHORA (con el contador) → 14 marcadores pintables en 14 ficheros   (+1)
árbol: origin/main = 1a359f6e con la rama scrum-582 dentro · 4-sep-2026
```

Entrada declarada en el censo con su motivo. `filtroClientes.js` **ya estuvo ahí y salió** en
SCRUM-581 cuando el fundador retiró los marcadores de pantalla: vuelve por **uno nuevo**, no por
aquéllos.

Y `SIN_APROBAR` de la pieza sube de **5 a 7**: el nombre accesible (del asesor, esperando al
fundador) y el contador (de nadie).

### Sobre el nombre accesible de cada fila, y por qué no inventé un texto

El encargo pide que diga **a quién** selecciona. Se usa el **nombre del cliente**: dice a quién y no
inventa copy. Escribir «Seleccionar ‹nombre›» habría sido componer una frase que no ha aprobado
nadie. Si el asesor quiere el verbo delante, lo firma y se pone en una línea.

## 🕳️ Huecos declarados

1. 🔴 **La caja del contador NO está medida en navegador real.** El servidor MCP de Playwright está
   caído en esta sesión (`CONNECT_TIMEOUT`), así que **no hay número que dar** y no me lo invento.
   Lo que sí consta del CSS: la barra es `display:flex`, `padding:10px 14px`, dentro de `.data-card`
   —que ocupa el ancho de `.view-container`—, con la casilla (18 px) y un `gap` de 10 px delante, y
   el contador a `font-size:13.5px; font-weight:600`. **Falta la medida real, y con ella la firma.**
2. **El objetivo táctil de 44 px no lo he verificado en navegador**, por lo mismo. Las casillas se
   pintan a 18×18 px con el `cursor` y el `accent-color` de la casa; el objetivo real lo da la
   celda que las contiene, y eso hay que verlo. ⚠️ Y **`guard:objetivo-tactil` no avisa** —sale
   verde con un botón de 30 px, SCRUM-711—, así que aquí no hay red.
3. **No he verificado en yaqu.app.** Lo medido es la tanda, el banco de vistas y el CSS leído.
4. **La barra no es alcanzable en móvil con cero seleccionados** (ver (d)). Declarado, no resuelto.

## Hallazgos fuera de carril

* `invoicesView.js` tiene una selección múltiple **completa y acoplada** a su cierre, con su barra y
  su contador: el día que se comparta el mecanismo, ahí hay una segunda opinión que retirar.
* La barra de facturas dice «N facturas seleccionadas» con plural resuelto a mano; el contador de
  aquí está sin aprobar. Cuando se firme, conviene mirar los dos a la vez.
