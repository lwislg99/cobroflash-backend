# SCRUM-304 (C3) · capturas de la tabla de albaranes (AB6)

**Medido contra:** `origin/main` = `56874623baa406a0e8e38b93c236f7a4740b1e6a` · 2026-08-05T16:43:57+01:00

> ⚠️ **AB6 NO FIRMADO.** Estas capturas documentan un problema abierto, no una entrega limpia.

Banco aislado (puppeteer-core sobre el Edge instalado + servidor estático efímero sirviendo
`public/`), con los **41 scripts que carga `dashboard/index.html` en su orden** y la vista REAL
(`renderJobDetailView`) con `apiRequest` sustituido. Sin BD, sin auth, sin servidor de la app, sin
producción. El banco no se commitea: vivió en el scratchpad.

**Suelo del banco:** la tabla tiene que existir, computar `border-collapse: collapse` (o sea, con su
CSS de verdad) y traer **una fila por albarán**. Si no, para y no informa.

## Los cuatro casos de la columna Acción, en una sola pantalla

El fixture lleva un albarán por caso, y el banco imprime lo que sale:

```
filas: 4 · acciones: ["Emitir" + "Editar líneas", "Enviar para firmar",
                      "Facturar lo entregado", "(vacía)"]
```

| Albarán | Estado | Acción |
|---|---|---|
| ALB-2026-0001 | `borrador` | **Emitir** (navega al detalle) + `Editar líneas` |
| ALB-2026-0002 | `emitido` | **Enviar para firmar** (navega) |
| ALB-2026-0003 | `firmado` · facturado **a medias** | **Facturar lo entregado** (ejecuta aquí) |
| ALB-2026-0004 | `firmado` · facturado del todo | **(vacía)** — C2 dice que no hay siguiente paso |

## 🔴 Lo que enseña la captura y la suite no ve

![tabla 390](scrum304-tabla-390.png)

**A 390 px solo se ven `Nº` y `Fecha`. `Estado`, `Líneas` y `Acción` quedan fuera de pantalla.**

La causa está en la propia imagen: `[PENDIENTE MICROCOPY OFICIAL] Nº` ocupa casi toda la primera
columna. El marcador mide **29 caracteres por columna** y hay cinco columnas.

Dos cosas ya hechas para mitigarlo, y una tercera que depende del fundador:

1. El envoltorio de ESTA tabla pasa a `overflow-x: auto`, así que la columna Acción al menos se
   **alcanza** scrollando. **No se tocó `.table-wrap`** (`overflow: hidden`, `styles.css:590`): es
   compartida con otras cinco pantallas y ninguna está medida en este ticket.
2. La fecha se acorta a «12 jul». `docDate` da «12 jul 2026, 11:15» y empujaba sola la columna
   Acción fuera; el día y el mes distinguen una entrega de otra, y la hora vive en el detalle.
3. **Falta aprobar los cinco rótulos.** Con `Nº`, `Fecha`, `Estado`, `Líneas`, `Acción` la cabecera
   cae a una fracción de lo que mide hoy. Hasta entonces esto no se mergea: una tabla cuya única
   acción hay que buscar scrollando es justo lo que el ticket viene a arreglar.

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
| Contraste AA | Pills y tabla con los tonos existentes, sin colores inventados |
| Responsive 390 px | 🔴 **NO CUMPLE** — ver arriba. Alcanzable por scroll, pero la acción no está a la vista |
| Textos largos | Es exactamente el problema abierto: el marcador de microcopy es el texto más largo posible |

### Huecos declarados

- **Matriz de dispositivos (V0-5): HUECO.** Hay 390 px y 1280 px. **No hay Android de gama media,
  ni tablet, ni iPhone real**: el banco es Edge de escritorio con el viewport redimensionado, que no
  prueba fuentes del sistema, teclado en pantalla ni barra de navegador.
- **Focus visible / targets ≥44 px**: no medidos en esta tanda. Los botones son `mkBtn`, el mismo
  constructor de siempre, pero **no se ha comprobado en esta pantalla** y decirlo es más honesto que
  heredarlo por suposición.
- **Loading**: la tabla se pinta con el detalle del Trabajo, que ya se cargaba entero. Sin cambio.
