# SCRUM-1559 · el serializador del banco perdía nodos y texto: un CRITERIO, no una fila

## 16-oct-2026 · S3 · causa, arreglo del instrumento y antes/después

**Cabecera.** 2026-10-16 12:36:53Z (`Date:` de GitHub) · medido sobre `origin/main`
`ce054fb4da4240ce67aa6715c93380e3e0cfb0d1` · rama `scrum-1559-serializar-lee-los-dos-sitios`.

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
