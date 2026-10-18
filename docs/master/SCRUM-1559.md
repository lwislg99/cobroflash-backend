# SCRUM-1559 · el serializador del banco perdía nodos y texto: un CRITERIO, no una fila

## 16-oct-2026 · S3 · causa, arreglo del instrumento y antes/después

**Medido contra:** `origin/main` = `ce054fb4da4240ce67aa6715c93380e3e0cfb0d1` · 2026-10-16T12:36:53Z

Hora de la cabecera `Date:` de GitHub · rama `scrum-1559-serializar-lee-los-dos-sitios`.

A9: comprobación → `tests/scrum1559-serializar-lee-los-dos-sitios.test.mjs`
A9: comprobación → `tests/scrum1294-a9-leccion-en-a10.test.mjs`

Error propio (17-oct): empujé esta entrada sin pasar los guards del registro en local, y el
obligatorio cayó tres veces por lo mismo que ya vigilaban: el ancla mal formada (`scrum267`), la
falta de esta línea A9 (`scrum1294`) y cuatro `includes('<etiqueta>')` con el `>` pegado en mi
propio test (`scrum553`; pasados a igualdad con la salida entera, que es más estricta).

### La pregunta
S2 midió que en Informes los 5 enlaces de la fila de descargas están en el DOM del banco (5 de 5) y
no en el HTML de `scripts/_pagina-panel.mjs` (0 de 5): el censo daba Informes = 8 medidos y en
producción son 13. Lo que había que contestar: ¿sólo esa fila, o un criterio?

### La respuesta: un criterio, con tres caras
El banco (`tests/_banco-vistas.mjs`) guarda cada dato de un nodo en DOS sitios —el campo y `_attrs`
/ `hijos`— y `serializar()` leía cada uno de UNO solo. Control positivo de la sonda: un `<a>` con
`href` por marcado SALE, por `setAttribute` SALE, por propiedad NO sale.

| # | Qué se perdía | Por qué | Medido en las 18 vistas que montan |
|---|---|---|---|
| 1 | atributo reflejado puesto por PROPIEDAD (`a.href = …`, `.title`, `.placeholder`, `.name`, `.download`, `.htmlFor`) | vive en el campo; sólo se emitía `_attrs` | 18 `<a href>` invisibles para `a[href]` en 5 vistas: Clientes 10/10, Informes 5/5, Facturas 1, Presupuestos 1, Trabajo 1 |
| 2 | `type` nacido del MARCADO | vive en `_attrs`; sólo se emitía el campo | 25 nodos en 7 vistas; `<input type="checkbox">` salía como cuadro de texto (Exportar: 9) |
| 3 | texto propio + un hijo (`btn.textContent = 'Nuevo cliente'; btn.appendChild(kbd)`) | con hijos se emitían sólo los hijos | 23 nodos; el CTA de Clientes se medía como «N» |

No se arregla (declarado): `value` (en el navegador la propiedad no es el atributo, y no mueve la
geometría); y un `_texto` anterior a un `innerHTML` (medido: 0 casos hoy; el arreglo 3 no se aplica
cuando hay `_html`).

Sondas: `docs/master/evidencias/scrum1559/sonda-serializar.mjs` y `sonda-texto.mjs`
(`node <sonda> <raíz-del-árbol>`).

### El arreglo
Sólo el instrumento: `scripts/_pagina-panel.mjs`, `serializar()`. Ninguna vista tocada.
Test `tests/scrum1559-serializar-lee-los-dos-sitios.test.mjs`: **ROJO antes del arreglo** (4 de 8
caen, los cuatro casos; los cuatro controles pasan) y verde después. Verdes también los demás
consumidores del serializador: `scrum1158b`, `scrum1158`, `scrum848b`, `scrum694c`, `scrum522`.

### Antes / después — 🔴 TODO LO QUE SE MUEVE, SUBE, y sube porque el instrumento VE MÁS
Un trinquete que sube sin declararlo se lee como regresión: **no lo es**. Ningún control del
producto ha cambiado.

**`censo:tactil-panel`**

| Cifra | Antes | Después | Por qué |
|---|---|---|---|
| distintos < 44 px | 45 | **53** (+8) | 10 elementos nuevos cortos; los tres «💬» de Clientes cuentan como 1 (la clave es pantalla+selector+texto: es la COLA 2, aparte) |
| mediciones cortas | 70 | **82** (+12) | |
| con `.btn-sm` | 23 | 26 | |
| Informes, medidos | 8 | **13** | lo que cuenta producción; 0 cortos a los dos anchos |
| Clientes, medidos 929 / 390 | 22 / 21 | 32 / 28 | |
| Exportar, medidos | 3 | 9 | sus 6 casillas, 46 px: cumplen |
| Facturas 929 / 390 | 4 / 4 | 6 / 5 | |
| Presupuestos 929 / 390 | 4 / 4 | 5 / 5 | |
| Trabajo | 10 | 11 | el `tel:` |

Diff elemento a elemento (`evidencias/scrum1559/diff-censo-viejo-vs-nuevo.txt`, con
`diff-censo.mjs`), emparejando por pantalla+ancho+selector+ordinal y con las dos copias del censo
reproduciendo las cifras reales (45 y 53) como control: **263 emparejados · 46 nuevos · 0
desaparecidos · 0 cambian de veredicto · 0 cambian de área ≥ 0,5 px.** La cara 3 cambió 16 textos
(«N» → «Nuevo clienteN», «· 0» → «Todos · 0»…) y ninguna área: **no había falsos cortos ni falsos
buenos por el texto perdido**, en esta población.

**Los cortos que aparecen** (controles de S2; aquí NO se arreglan):

| Vista | Selector | Texto | 929 px | 390 px |
|---|---|---|---|---|
| Clientes | `A.btn-secondary.btn-sm` | ⬇ Clientes CSV | 31,0 | 31,0 |
| Clientes | `A.contacto-link` (×3) | los tres teléfonos | 41,8 | 45,0 cumple |
| Clientes | `A.contacto-link.contacto-link--icono` (×3) | 💬 | 37,0 | 45,0 cumple |
| Facturas | `A.btn-secondary.btn-sm` | ⬇ CSV | 31,0 | 31,0 |
| Facturas | `INPUT` (casilla del marcado) | — | 14,0 | sin pintar |
| Presupuestos | `A.btn-secondary.btn-sm` | ⬇ CSV | 37,0 | 45,0 cumple |

**`guard:objetivo-tactil`** (36 px en escritorio, 44 en móvil): de **0 hallazgos** a **2 hallazgos,
un solo elemento**: «⬇ Clientes CSV», `A.btn-secondary.btn-sm`, 31 px < 36 a 929 y 31 < 44 a 390.
Interactivos de Clientes en el DOM servido 29 → 39; ficha de Trabajo 20 → 22. Los teléfonos y «💬»
de Clientes (41,8 y 37) pasan los 36 del guard en escritorio. El guard queda en ROJO al entrar esto
en main; no se le añade excepción ni se toca (regla 41): o se arregla el control, o se decide junto
con `.btn-sm` (las demás `.btn-sm` de Clientes ya esperan esa decisión del fundador).

## 16-oct-2026 · S3 · los datos de muestra del censo dan respuestas que el servidor nunca daría

S2 midió que el «undefined» de Ajustes (los tres `kpi-value` de Referidos) sale del fixture y no
del producto: `GET /admin/referral` siempre trae las cinco claves. Preguntado si era sólo ése: **es
un patrón, no un caso.** Sonda `evidencias/scrum1559/sonda-fixture-relleno.mjs`, con control (una
ruta servida sale como servida; una inventada cae en el relleno):

- **28 rutas reales** que piden las vistas caen en el `return []` de relleno de `DATOS`
  (`scripts/censo-objetivo-tactil-panel.mjs`), entre ellas endpoints que devuelven OBJETO:
  `/admin/referral`, `/admin/connect/status`, `/admin/metrics/home`, `/admin/reports/pl`,
  `/admin/reports/vat`, `/admin/expenses/summary`, `/admin/exports/datos.zip/info`…
- Rutas «servidas» con el fixture de OTRA: `/admin/customers/:n/historial` y `/whatsapp` casan con
  `/admin\/customers/` y reciben la LISTA de clientes; `/admin/jobs/:n/gastos` recibe el Trabajo;
  `/admin/albaranes/:n/fotos` recibe el albarán.
- Vistas de detalle montadas SIN id: `/admin/jobs/NaN`, `/admin/albaranes/undefined`,
  `/admin/partes/undefined` (sólo la 360 lleva argumento en `ARGUMENTOS_DE_VISTA`).

No arreglado aquí: mueve las cifras de pantalla y mezclarlo con el serializador no dejaría saber
cuál las movió. No medido: los datos propios que `guard:objetivo-tactil` pasa a cada superficie.

## 16-oct-2026 12:42Z · S3 · 1559b — el censo cuenta cada ELEMENTO (la COLA 2)

Rama `scrum-1559b-censo-cuenta-cada-elemento`, encima de la de 1559 (GO del orquestador).
«Distinto» en `censo:tactil-panel` era pantalla + selector + texto: tres «💬» de Clientes contaban
UNO. Ahora es pantalla + posición del elemento en `querySelectorAll(INTERACTIVOS)`
(`scripts/_censo-distintos.mjs`). Sirve de identidad a los dos anchos porque el censo sirve el MISMO
HTML a 929 y a 390. Test `tests/scrum1559b-censo-cuenta-cada-elemento.test.mjs`: con la clave vieja
cae 1 de 5 (el caso), los 4 controles pasan; con la nueva, 5 de 5.

🔴 **El total SUBE, y sube porque el instrumento cuenta lo que antes juntaba:**

| Cifra | Con 1559 | Con 1559b | Qué entra |
|---|---|---|---|
| distintos < 44 px | 53 | **61** (+8) | todo en Clientes, filas que se juntaban |
| `BUTTON.btn-secondary.btn-sm` | 12 | 16 (+4) | «Editar» ×3 y «Portal» ×3 contaban 2 |
| `BUTTON.btn-ghost.btn-sm` | 3 | 5 (+2) | «📊 Historial» ×3 contaba 1 |
| `A.contacto-link.contacto-link--icono` | 1 | 3 (+2) | «💬» ×3 contaba 1 |
| con `.btn-sm` | 26 | 32 | |
| mediciones cortas | 82 | **82** | sin cambio: control de que sólo cambió la cuenta, no la medida |

Quién cita las cifras viejas: `docs/master/SCRUM-1158.md` (62 → 51 con la clave vieja y el banco
de antes de 1559). No se reescribe: es lo que se midió entonces con aquel instrumento.
Declarado y sin tocar: el suelo de `guard:objetivo-tactil` (`distintosEsperados`) usa la misma
clave `sel|texto` (`scripts/guard-objetivo-tactil.mjs`, el `Set` de distintos), así que subcuenta
igual. Es un suelo (mínimo): subcontar lo hace más fácil de cumplir, no da rojos falsos.

17-oct · error propio: `scripts/_censo-distintos.mjs` nació sin fila en `dos-equipos.md` §3.3 y el
obligatorio cayó por `scrum1480f`. Fila propia a nombre de S3, con su motivo (decisión del
orquestador de Luis), y `.claude/carriles.json` + `carril-s3.md` regenerados con
`node scripts/carriles.mjs generar`.

## 18-oct-2026 · S2 · 1559g — los 16 controles NUESTROS de la §20, a 44 px

**Medido contra:** `origin/main` = `e59be9fa384b5bb1d4fbaa6d429a32a5a8a6be8d` · 2026-10-17T23:51:18Z
A9: comprobación → `tests/scrum1559g-dieciseis-controles-44px.test.mjs`
**Skill UI:** cargada · `yaqu-premium-ui`: sólo tamaño (`min-height`/`min-width` 44 px y el área de una casilla), cero tokens, cero texto, cero componentes.

S2 · rama `scrum-1559g-dieciseis-controles-nuestros-44px` · worktree `s2-1559g`. Encargo del orquestador
(18-oct): los 16 de `docs/equipo/para-javier.md` §20 que son nuestros, con el patrón de SCRUM-1158c (decisión
del fundador de SCRUM-786, opción ③: reglas ACOTADAS, nunca `.btn-sm` global). Los 15 de J1/J2/J3 no se tocan.

**Recuento propio, no cifra heredada.** `censo:tactil-panel` sobre `main` (`e59be9fa3`), con el detalle por
elemento de las cuatro pantallas: salen los **16** de S3, uno a uno, con las mismas medidas.

| pantalla | control | antes 929 / 390 | después 929 / 390 |
|---|---|---|---|
| Inicio | «Ver resumen» | 30,9 / 30,6 | 44,6 / 44,6 |
| Inicio | «✕» | 30,9 / 30,6 | 44,6 / 44,6 |
| Inicio | «Ver facturas →» | 30,7 / 30,5 | 44,7 / 44,5 |
| ficha de presupuesto | «📄 PDF», «⎘ Duplicar», «← Volver» | 31 / 31 | 45 / 45 |
| ficha de presupuesto | «↻ Reenviar por WhatsApp», «↻ Reenviar por correo» | 30,5 / 30,5 | 44,5 / 44,5 |
| ficha de presupuesto | «Aceptar presupuesto», «Rechazar presupuesto» | 30,5 / 30,6 | 44,5 / 44,6 |
| ficha de presupuesto | «+ Añadir gasto a este trabajo» | 30,6 / 30,7 | 44,6 / 44,7 |
| ficha de presupuesto | casilla de `documentoAsignados` | 21 / 21 | 45 / 45 |
| Solicitudes | «+ Crear presupuesto», «✓ Marcar gestionada» | 30,7 / 30,9 | 44,7 / 44,9 |
| Albaranes | número «A-2026-0031» | — / 17 | — / 45 |
| Albaranes | «Enviar para firmar» | 30,8 / 44,6 | 44,8 / 44,6 |

Total del censo: distintos bajo 44 px **97 → 80** (−17), mediciones cortas **143 → 111**. Los 17 son los 16 más
la casilla en la ficha de FACTURA de J1: `documentoAsignados.js` es un componente compartido, y arreglarlo aquí lo
arregla allí (avisado al orquestador para que J1 no lo toque también). Las otras 46 filas pantalla × anchura,
**idénticas** a las de `main`, comparadas fila a fila. Quedan, sin tocar y fuera del encargo: «Nuevo albarán» (37)
y «Crear revisión» (36,7) a 929, que cumplen los 36 px de escritorio de `DESIGN.md`.

### Qué cambia
- `public/dashboard/css/styles.css`: una regla de alto para `#btn-ver-resumen-trimestre`, `.home-hero-card > .btn-sm`,
  `.presupuesto-ficha .btn-sm`, `.solicitud-acciones > .btn-sm` y `.table--albaranes td.cell-actions > .btn-sm`;
  alto y ancho para «✕» (un glifo); el número del albarán a 44 sólo en la tarjeta (≤640 px); y la casilla con el
  mecanismo de `.casilla-tactil-44` (SCRUM-786), con `inset: -12px` y no -16: 20 + 2 × 12 = 44 cabe en su fila de
  44, y -16 se metería 2 px en la de al lado, que marca a OTRA persona.
- La ficha del presupuesto va ENTERA (`.presupuesto-ficha`) y no botón a botón: el censo sólo ve lo que pintan sus
  datos, y «Confirmar aceptación», «Archivar» o el del albarán son la misma pantalla.
- `quotesDetailView.js` y `quoteRequestsView.js`: una clase de enganche cada uno, en la MISMA línea (no se mueve
  ninguna). `homeView.js` y `albaranesView.js` no se tocan: sus ids y clases ya bastaban.
- `tests/scrum1559g-dieciseis-controles-44px.test.mjs`: las reglas con 44 px, `.btn-sm` global intacto, el `inset`
  contra el alto de la fila, y que cada vista siga pintando sus controles DENTRO de lo que la regla nombra, montada
  con los datos del censo (`_datos-del-censo.mjs`).

### Verificado, ejecutando
- **Censo en navegador**, `main` contra esta rama (un árbol desechable de `main` al lado, misma `dist`): la tabla de arriba.
- **Rojo primero, por mutación** (cada una aplicada y restaurada byte a byte): sin `presupuesto-ficha` en la ficha,
  con la regla renombrada, con `inset: -16px`, sin `solicitud-acciones`, y sin el ancho de «✕»: cae 1 cada vez. Base: 6 de 6.
- `guard:objetivo-tactil`: rojo, y AJENO: «⬇ Clientes CSV» (J2, §17), el que anunció 1559b. Ninguna excepción sobra.
- **yaqu.app:** pendiente del merge (el despliegue sale de `main`).