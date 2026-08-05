# SCRUM-304 (C3) · capturas de la tabla de albaranes (AB6)

**Medido contra:** `origin/main` = `56874623baa406a0e8e38b93c236f7a4740b1e6a` · 2026-08-05T16:43:57+01:00

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

### Lo que SIGUE sin caber, dicho sin adornos

Con los rótulos aprobados entran `Nº`, `Fecha` y `Estado`. **`Líneas` y `Acción` siguen fuera a
390 px**, alcanzables scrollando: el envoltorio de ESTA tabla se pasó a `overflow-x: auto` — **no se
tocó la clase compartida `.table-wrap`** (`overflow: hidden`, `styles.css:590`), que la usan otras
cinco pantallas sin medir.

Lo que ahora se come el ancho es la columna Estado, con el pill **más** los badges de facturación
(`BORRADOR` + `Sin precios`, `FIRMADO` + `Facturado en parte`). Quitar esos badges de la tabla es la
palanca obvia, y hay argumento de C2 —«facturado es CONTEXTO, no estado»— con la columna Acción ya
codificándolo. Pero es información que hoy ve el profesional: **decisión del fundador, no se toma de
paso**.

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
