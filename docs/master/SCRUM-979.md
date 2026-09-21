# SCRUM-979 · «Última visita» en la lista de clientes, con filtro de 6 / 12 / 24 meses

**Medido contra:** `origin/main` = `3ac838a5e055bb9e70a484560ee5b23187c6f491` · 2026-09-21T07:55:06Z (hora de GitHub, cabecera `Date:` de `gh api -i zen`)
**Rama:** `scrum-979-ultima-visita`
**Microcopy:** `docs/microcopy/2026-09-21-SCRUM-979-ultima-visita.md` (firma delegada, SCRUM-979 comentario 16058).

## Paso 0, medido

- La lista (`GET /admin/customers` → `listCustomers`) no traía ningún dato de trabajo, y la pieza
  `filtroClientes.js` no tenía columna ni filtro de visita. El test nuevo salió **rojo 7 de 7**
  contra el código de `3ac838a5`.
- **La lista de clientes NO se recorta por rol**: el técnico ve la cartera entera. Sus
  **trabajos sí** (`jobs.routes.ts:756`, los tres ejes de SCRUM-650). Por eso «Última visita», para
  el técnico, sale solo de sus trabajos visibles; si no, le enseñaría la fecha de un trabajo que en
  su lista no existe. Admin y propietario ven todos. Decisión del orquestador.

## Lo que cambia

- **Servidor** · `customerAdmin.ts`: `listCustomers` añade `ultimaVisita` = el `scheduledAt` máximo
  de los trabajos `terminado` o `cerrado`, con **un solo `job.groupBy`** (la lista no pagina) y el
  `merchantId` dentro de la consulta (regla 2). Sin visita, la clave **no se añade** (ausente no es
  cero). La ruta le pasa `soloTrabajosDe` cuando `seesOnlyOwnJobs(rol)`.
  `nTrabajos` (en el texto del ticket) **no se añade**: ninguna pantalla lo pintaría.
- **Pieza** · `filtroClientes.js`: columna elegible `visita` (oculta en el móvil por defecto), filtro
  `filtrarPorVisita` encadenado en `aplicar`. Un cliente **sin** visita no entra en ningún
  «sin visitar desde hace N meses» (decisión del orquestador: «nunca» no es «hace más de N»).
- **Vista** · `customersView.js`: el selector nace oculto y solo aparece si algún cliente del lote
  tiene visita (como el de etiquetas); la celda, con el formato de «Alta».

## El juez: `tests/scrum979-ultima-visita.test.mjs`

Seis tests de la pieza sin banco (corren en cada `npm test`) y uno del servidor, gateado (banco
desechable o staging), declarado en `GATEADOS_DECLARADOS` de 419. Medido contra un Postgres 16 propio:
**7 pass · 0 fail · 0 skipped**.

Mutaciones, una a una, con la base en verde antes y después:

| mutación | cae con |
|---|---|
| M1 · sin el recorte del técnico | «al técnico le sale la fecha de un trabajo que en su lista NO existe» |
| M2 · cuenta también `en_curso` | «la última visita no es el máximo de los trabajos terminados o cerrados» |
| M3 · «nunca» entra en el filtro | el primer caso del filtro (6 meses) deja de dar `[2, 3, 4]` |

Dos tests de otros tickets, tocados con su motivo escrito en la línea:
- **698** (nodos de la vista): 69 → **78**, los nueve POR IDENTIDAD comparando las firmas de los dos
  árboles (`select` + 4 `option` + `th` + `label`/`input`/`span` de su casilla en «Columnas»), y en el
  otro lado no falta nada.
- **580**: la expresión exigía `FC.aplicar(…, etiquetaActiva)` con `)` justo detrás; ahora admite un
  argumento más detrás. Lo que vigila (la etiqueta llega en su posición) no cambia.

## La pantalla, medida en Edge (sonda de un solo uso, no versionada)

A 1280, 390 y 360 px, leyendo el DOM DESPUÉS de cambiar el filtro: el selector nace oculto hasta que
llega el lote; con «Sin visitar desde hace 12 meses» quedan solo los de hace 12 meses o más (el
cliente sin trabajos no entra); al quitarlo vuelven todos; la celda está oculta en el móvil por
defecto; sin scroll horizontal (ancho del documento = ancho de la ventana).

**Dos defectos que salieron al medir, ya arreglados:**
1. El selector se veía (y se podía pulsar sin efecto) sobre los esqueletos de carga → nace oculto.
2. Con el `max-width:220px` de los otros dos selectores, a 390 px el texto salía cortado
   («Sin visitar desde hace 12 m…») → sin ese tope. Medido con la fuente real: texto 206 px, hueco
   227 px, en los tres anchos.

**No medido:** staging, y el selector mide 36 px de alto, como los otros dos de la barra (el
objetivo AB6 es 44): es del componente `.input` y no se cambia en este ticket.

## El primer CI salió rojo, y los dos rojos eran de este ticket

1. **713c (estilos escritos desde JS, techo 340)**: el `style.cssText` del selector lo subía a 341.
   Arreglo: la regla va en `styles.css` (`.clientes-filtro-visita`), y el color de la celda también
   (`.cell-visita`), en vez de escribirlos desde JS.
2. **`guard:lista-trabajos` §⑥ congelaba Clientes por hash**, y este ticket la cambia a propósito.
   Mismo trato que SCRUM-831 dio a Albaranes: Clientes sale de la comparación por hash y se le exige
   que su diferencia con la base sea **exactamente la declarada** —el `th`, el `select`, su casilla en
   «Columnas» y una celda `cell-visita` por fila—; quitadas esas piezas, el HTML tiene que salir
   idéntico al de la base. Probado en rojo dos veces: un `<hr>` no declarado → «ha cambiado MÁS de
   lo declarado»; sin la celda → «la celda de cada fila: 0 de 2». Base en verde antes y después.

(El meta-guard también salía rojo, pero igual en otro PR del mismo momento, el de 976b: no es de este ticket.)

## Hueco declarado

Si un filtro deja la lista vacía, se pinta el vacío de pestaña, cuya segunda línea («Marca cada
cliente como empresa o persona al editarlo.») no describe la causa. Ya pasaba con el filtro de
etiqueta; arreglarlo pide un texto nuevo.
