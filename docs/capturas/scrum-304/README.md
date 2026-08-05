# SCRUM-304 (C3) · capturas de la tabla de albaranes (AB6)

**Medido contra:** `origin/main` = `d5ac9761da139bf9b6de3c808d7c990aa6b82157` · 2026-08-05T17:04:15+01:00

> **Microcopy APROBADA** (5-ago-2026, los cinco rótulos tal cual): estas capturas son las del texto
> definitivo. Queda **un punto medido y sin resolver**, en su sección.

Banco aislado (puppeteer-core sobre el Edge instalado + servidor estático efímero sirviendo
`public/`), con los **41 scripts que carga `dashboard/index.html` en su orden** y la vista REAL
(`renderJobDetailView`) con `apiRequest` sustituido. Sin BD, sin auth, sin servidor de la app, sin
producción. El banco no se commitea: vivió en el scratchpad.

**Suelo del banco:** la tabla tiene que existir, computar `border-collapse: collapse` (o sea, con su
CSS de verdad) y traer **una fila por albarán**. Si no, para y no informa.

## Los cuatro casos de la columna Acción, en una sola pantalla

| Albarán | Estado | Acción |
|---|---|---|
| ALB-2026-0001 | `borrador` | **Emitir** (navega al detalle) + `Editar líneas` |
| ALB-2026-0002 | `emitido` | **Enviar para firmar** (navega) |
| ALB-2026-0003 | `firmado` · facturado **a medias** | **Facturar lo entregado** (ejecuta aquí) |
| ALB-2026-0004 | `firmado` · facturado del todo | **(vacía)** — C2 dice que no hay siguiente paso |

## 390 px — iPhone estándar

![tabla 390](scrum304-tabla-390.png)

### 🔴 La primera tanda medía el MARCADOR, no la pantalla

Con `[PENDIENTE microcopy oficial]` delante de cada nombre de columna —**29 caracteres por columna,
cinco columnas**— solo cabían `Nº` y `Fecha`. Eso no era maquetación: era el coste del marcador.

> **CON MARCADOR NO SE JUZGA EL LAYOUT. Solo se comprueba que el marcador esté.**

### La columna Estado APILA en movil, y Lineas se oculta

Decision del fundador, y el motivo importa: **los badges NO se quitan**. Una celda de Accion vacia
es ambigua entre «facturado del todo» y «no facturable por ser SIN_VALORAR», y el badge es lo unico
que se lo dice al profesional. Quitarlo repetiria el error de aplanar el PARCIAL.

Así que en móvil crece el **alto**, que sobra, en vez del **ancho**, que falta: pill arriba, badge
debajo (`.jobdet-alb-estado`). Y si aun así no entra, la que se oculta es **Líneas** —un número
informativo que no acciona nada—, **nunca Acción**: la acción es la razón de ser de la tabla. El
dato no se pierde: está en el detalle del albarán, a un toque del número.

### 🔴 Medido despues de las dos palancas: TODAVIA no entra

| | 390 px | 1280 px |
|---|---|---|
| Borde derecho de la celda Accion | **515 px** | 940 px |
| Viewport | 390 px | 1280 px |
| ¿Entra sin scrollear? | 🔴 **NO** (faltan 125 px) | ✅ sí |

Las dos palancas acercaron —`Acción` ya asoma en la cabecera y los botones empiezan a verse— pero
**no bastan**. Lo que queda comiendo ancho, por orden: el enlace del número (`ALB-2026-0001`), el
badge `Facturado en parte` y el rótulo `Facturar lo entregado`. **No se toca más sin decisión del
fundador**: acortar cualquiera de los tres es quitar información o retocar copy aprobada.

### Foco y targets: MEDIDOS, no supuestos

| | A 390 px | AB6 |
|---|---|---|
| Anillo de foco | **SÍ** (por `box-shadow`; se ve en la captura sobre ALB-2026-0001) | ✅ |
| Botones de acción (`btn-secondary btn-sm`) | **30 px** | 🔴 < 44 |
| Enlace del número (`.detail-miga-link`) | **20 px** | 🔴 < 44 |

**No lo introduce esta tarea:** los botones salen de `mkBtn`, el constructor que ya usaba toda la
vista, y `.btn-sm` está **deliberadamente fuera** del bump de SCRUM-352 (su censo lo declara con
`:not(.btn-sm)`). Pero esta tabla los convierte en la superficie principal de los albaranes, así que
aquí duele más que antes. Se reporta, no se arregla de paso: subir `.btn-sm` alcanza a todo el
producto y es su propio ticket.

## Escritorio — 1280 px

![tabla 1280](scrum304-tabla-1280.png)

## Estado vacío — sin albaranes NO se pinta la tabla

Una cabecera con nada debajo es lo que el ticket pide evitar. El texto es el que ya existía de G4:
no se ha tocado.

![vacío](scrum304-vacio-390.png)

## Checklist AB6

| Punto | Estado |
|---|---|
| Componentes | `.table` / `.table-wrap` / `.status-pill` / `.detail-miga-link` del inventario AB3. **Cero componentes nuevos, cero tokens nuevos** |
| Estados empty | ✅ capturado — sin albaranes no hay tabla |
| Focus visible | ✅ **medido** |
| Targets ≥44 px | 🔴 **medido y NO cumple** (30 px / 20 px) — reportado arriba |
| Responsive 390 px | 🔴 **NO cumple**: `Líneas` y `Acción` fuera de pantalla, alcanzables por scroll |
| Contraste AA | Pills y tabla con los tonos existentes, sin colores inventados |
| Textos largos | Los rótulos aprobados son los más cortos posibles; el caso peor (con marcador) también se midió |

### Huecos declarados

- **Matriz de dispositivos (V0-5): HUECO.** Hay 390 px y 1280 px. **No hay Android de gama media,
  ni tablet, ni iPhone real**: el banco es Edge de escritorio con el viewport redimensionado, que no
  prueba fuentes del sistema, teclado en pantalla ni barra de navegador.
- **Loading**: la tabla se pinta con el detalle del Trabajo, que ya se cargaba entero. Sin cambio.
