# SCRUM-837 · Censo de decisiones de producto encerradas dentro de una vista

**Medido contra:** `origin/main` = `54ad4a68b807b8f3e22c709947096fd48dd1d4ae` · 2026-09-09T16:30:40+02:00
**Rama:** `scrum-837-decisiones-encerradas`, partida de `main` con el PR #1214 ya dentro.

> El censo se midió primero contra `45e3012155ad5370a5404a5d725229cff7f55008` y se **recontó**
> sobre el árbol ya fusionado con `54ad4a68`, que trae SCRUM-832 tocando `quotesListView.js` — un
> fichero que este censo lee. Las dos cuentas dan **10**. Una cifra derivada que cruza un merge no
> se arrastra: se vuelve a contar.
**Entrega:** `docs/CENSO_DECISIONES_ENCERRADAS.md` — las tres columnas y el veredicto.

---

## 1 · De dónde sale

Del cierre de SCRUM-831, que fue **la tercera vez** que la misma forma costó un ticket: una
decisión de producto —qué se puede hacer con un documento— escrita dentro del fichero de la
pantalla que la estrenó, y la siguiente pantalla que la necesita no la encuentra.

| ticket | qué vivía encerrado | quién no lo tenía | qué se veía |
| --- | --- | --- | --- |
| SCRUM-366 | `jobNextAction` en `jobDetailView.js` | la lista de Trabajos | la lista decía «Marcar terminado» y el detalle «Enviar para firmar», del mismo Trabajo |
| SCRUM-823 | `abrirAgendar` en `jobsView.js` | el detalle del Trabajo | el detalle no sabía agendar |
| SCRUM-831 | `primariaDeAlbaran` en `jobDetailView.js` | la lista de Albaranes | la única de las cinco listas con CERO acciones |

🔒 *Una función correcta que la otra pantalla no puede nombrar acaba en una de dos: o se reescribe
peor (366), o no se usa (823, 831).*

## 2 · El instrumento

`scripts/censo-decisiones-encerradas.mjs` · `npm run censo:decisiones-encerradas`

- **AST, no `grep`**: hace falta saber si un literal de estado está en posición de DECISIÓN
  (`x === 'firmado'`) o es el texto de un rótulo, y si esa comparación GOBIERNA la creación de un
  control. Las dos son propiedades del sitio del nodo en el árbol, no de la cadena. Y un guard de
  texto se caza a sí mismo en el comentario que explica lo que prohíbe.
- **Los estados se leen de su fuente**, no se escriben dentro: los tres registros del panel y la
  FSM de `job.service.ts`. Copiarlos habría dejado el censo ciego justo en el estado nuevo que
  alguien añadiera mañana.
- **Tres familias calcadas de los tres casos**, no inventadas: ① resolutor, ② segunda fuente,
  ③ ejecutor.

### ⚠️ Lo que el censo NO afirma, y va en su cabecera

El panel son `<script>` clásicos sin módulos (regla 4): **todos comparten ámbito global**, así que
una `function` de nivel superior en una vista **sí** es técnicamente alcanzable desde otra. La
barrera no es de sintaxis: es de **descubrimiento** y de **orden de carga**. Por eso «vive en una
vista» no es el hallazgo — **el hallazgo es la tercera columna**.

## 3 · El suelo, y las dos cegueras que se cazó a sí mismo

Probado contra los **tres árboles de git de antes de cada arreglo**: `16ba5cf4^`, `786bdc59^`,
`9cacafad^`. Los tres se cazan. Y en la otra dirección: los tres, ya arreglados, **no** salen hoy —
sin eso, un detector que dijera «sí» a todo pasaría la mitad de arriba.

🔴 **El alias.** `invoiceDetailView.js` guarda `const REGISTRO_ACC = window.INVOICE_ACTION_REGISTRY`
y usa el alias, así que buscando el nombre del registro **el resolutor de FACTURA salía sin
documento y se descartaba**: el censo daba CERO resolutores de factura teniendo uno. Se cazó porque
`grep` decía un consumidor y el censo decía ninguno.

🔒 *La sospecha no encuentra cegueras; las encuentra un número que no cuadra con otro número.*

🔴 **La tercera columna definida de más.** «Pinta ese documento» era «decide por alguno de sus
estados», y `jobDetailView.js` pinta un Trabajo entero sin comparar contra ningún literal: quedaba
fuera de la población y **la columna de SCRUM-823 salía vacía**. Ahora también cuenta pedirlo por su
ruta.

Y un tercero, que fue de la COMPROBACIÓN y no del instrumento: SCRUM-823 renombró la función al
mudarla (`abrirAgendar` → `abrirAgendarTrabajo`), y buscar el nombre de después en el árbol de antes
decía «se escapa» sobre un censo que la cazaba bien.

## 4 · El resultado

**10 decisiones encerradas**, las 10 con otra pantalla que pinta ese documento y no las usa.
La respuesta corta se lee en una tabla:

| documento | ¿resolutor alcanzable? | consumidores de su registro |
| --- | --- | --- |
| trabajo | ✅ ficheros compartidos | 2 |
| albarán | ✅ `albaranAccion.js` (SCRUM-831) | 3 |
| **factura** | 🔴 ninguno: dentro de `renderInvoiceDetailView` | **1** |
| **presupuesto** | 🔴 ninguno: `QUOTE_ACTION_REGISTRY` tiene **0 consumidores** | **0** |

**Los dos documentos que se arreglaron tienen resolutor compartido. Los dos que no, no.**

## 5 · 🔨 Regla 37: sólo UNA se convierte en trabajo

**La lista de Facturas.** Es la única con una mentira medida hoy:

- el registro declara `btnTogglePaid` **`oculta`** en `annulled` y en `R1`;
- `soloFacturas()` sólo saca los justificantes, así que **las `annulled` y las `R1` se listan**;
- la casilla se crea en **todas** las filas sin mirar el estado, «Seleccionar todas» las incluye, y
  la barra ofrece **«✓ Marcar como pagadas»** sobre el lote;
- `invoicesView.js` consulta el registro **0 veces**, y su tabla tiene 7 columnas y **ninguna
  «Acciones»**.

Una acción ofrecida en un estado que no la admite — la forma de SCRUM-823 — con el agravante de que
**el registro que lo impediría ya existe**.

Cuadra con la otra medición, de ayer y por otro camino: en `docs/CENSO_ACCION_DEL_80.md` Facturas
salió como **«la segunda peor»** de las cinco listas. Dos instrumentos distintos, el mismo sitio.

**Las otras nueve quedan en la lista**, con su fila y su motivo, para cuando alguien las necesite.
La mayor es **presupuesto**: cuatro pantallas decidiendo por su cuenta sobre un registro que nadie
consulta. No tiene mentira medida todavía, así que no se mueve.

## 6 · Lo que este censo no cubre, dicho antes de que alguien lo dé por completo

Documentos sin lista de estados declarada (solicitudes, partes) · estados **homónimos** (`pending`
es de factura y de solicitud: por eso `loadRequests` es un falso positivo, declarado) · decisiones
que no miran el estado (permisos, importe, banderas) · el servidor. Y el 0 de la familia ② es un
artefacto del orden de asignación, no una ausencia.

## 7 · Lo que NO se ha tocado

Ni una línea de producto. Este ticket entrega el censo y su mecanismo; el arreglo de Facturas es el
siguiente ticket y va solo (A17: un ticket, una rama, un PR).
