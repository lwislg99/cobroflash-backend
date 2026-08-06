# SCRUM-319 · G4: DOCUMENTOS se parte por tipo

**Fecha:** 5-ago-2026 · **Carril:** A · **Gate:** sin gate, corre en `npm test` · **UI:** vanilla (regla 4)

**Medido contra:** `origin/main` = `c711b7968777f29fd00fcddae69c2ba8489c576a` · 2026-08-05T14:13:35+02:00

## El defecto

Una sola pila ordenada por fecha con objetos de ciclos de vida y significados legales distintos —la
«pestaña gigantesca»—. Un objeto que es **único** no pertenece a una lista, y dos documentos con
significados legales distintos no se ordenan juntos por fecha.

## 🔴 El censo derivado corrige al ticket en dos sitios

La lista de cuatro tipos del ticket salía de **una captura**. Derivada del código —por AST, de los
`docs.push({tipo})` y de los `return` de la función que clasifica— la pila tiene **cinco**:

| tipo | de dónde | destino |
|---|---|---|
| `presupuesto` | `job.quote` | rail (bloque PRESUPUESTO) |
| `albaran` | `job.albaranes` | sección **ALBARANES** |
| `justificante` | `job.invoices`, `type==='JUST'` o número `J-…` | rail (bloque **DINERO**) |
| `factura` | `job.invoices`, el resto | sección **FACTURAS** |
| `rectificativa` | `job.invoices`, `type==='R1'` | **anclada** a su factura original |

### GASTOS no está en la pila, y nunca estuvo

En esta vista **no hay ni un gasto**. Lo único que existe es el botón de alta, y el propio código lo
dice donde se creó: «el gasto no se pinta en esta ficha; mostrarlo sería rentabilidad por obra, que
es otro ticket».

Una sección `GASTOS` **con su total y su margen** exigiría traerlos, sumarlos y calcular margen:
**construir lo que no hay, no repartir lo que hay** — y el ticket declara «el mecanismo de gastos»
fuera de alcance. La sección queda **declarada y vacía**, con su motivo escrito y con un test que
cae el día que la pila sí lleve gastos.

### FACTURA y RECTIFICATIVA sí están, y el ticket no las nombra

Son literalmente el «quinto tipo que no está en las capturas» que el propio ticket manda **reportar
y no colocar por cuenta propia** (regla 9). Reportadas, y el fundador decidió: **FACTURAS va como
sección propia de la columna principal.** Ni al rail, ni al bloque `DINERO` con los justificantes
—eso sería el error de **B4** en dirección contraria—, ni fuera de la pantalla: que el Trabajo
enseñe el ciclo completo es el diferencial del producto.

**Orden final de las secciones, que es el ciclo:**

`QUÉ FALTA PARA COBRAR` (G5, hueco) → `ALBARANES` (lo entregado) → `FACTURAS` (lo facturado) →
`GASTOS` (hueco, no se pinta). El orden vive en `SECCIONES_CUERPO` y tiene test propio: no es
decorativo, es el ciclo del Trabajo.

## 🔴 La rectificativa nunca se pinta suelta — y el vínculo SÍ existía

Como fila más de una lista ordenada por fecha es **legalmente ilegible**: no dice a qué factura
corrige, y la normativa exige que una rectificativa identifique la factura rectificada.

**Medido antes de pintarla, y el resultado cambia la respuesta del ticket:** el vínculo **existe**
—`Invoice.rectifiesId`, con su relación `Rectification` en el modelo— pero **no llegaba a esta
pantalla**: no estaba ni en el `select` ni en el mapeo del serializer del Trabajo. El `rectifying`
de `formatInvoiceNumber` es la SERIE del número, no el vínculo; deducir de «2026-CF-R-001» a qué
factura corrige sería adivinar.

Así que **no ha hecho falta escalar nada al bloque A**: el dato estaba y solo había que dejarlo
pasar. Dos líneas **aditivas y de solo lectura** en `jobs.routes.ts`. Se declara aquí en voz alta
porque es backend y no se ve en la pantalla que este ticket toca.

> Si el vínculo **no** hubiera existido, la rectificativa se habría pintado en la sección con lo que
> hubiera y el hallazgo sería de **bloque A, no de esta pantalla**: la normativa exige que una
> rectificativa identifique la factura rectificada, y eso no se arregla maquetando.

Con el vínculo, la rectificativa **cuelga de su factura**, sangrada y con filete: el vínculo se ve,
no se deduce.

**Y si su original NO está en este Trabajo**, no se esconde: baja a la sección de facturas, visible,
y queda anotada como huérfana para que el guard lo diga. Perderla sería peor que enseñarla mal.

## Nada se pierde

El test que más importa. La pila original se reconstruye por **clave estable** (`tipo:id`), se
reparte, y se compara **conjunto contra conjunto**: lo perdido y lo aparecido se listan por nombre.

Y hay una segunda red: un tipo que la tabla no conozca **no se descarta**. Cae en `desconocidos`, el
guard falla **y la pantalla lo pinta igual** con el resto. La red y el aviso son dos cosas
distintas: avisar sin enseñarlo dejaría el documento perdido mientras alguien lee el rojo.

## Una sola clasificación

`jobDetDocLabel` era la única que sabía distinguir un justificante de una factura. El reparto habría
necesitado su propia copia de esa condición, y serían **dos sitios decidiendo lo mismo** sobre
documentos con significados legales distintos: un cambio en una mandaría el mismo documento a dos
sitios, o a ninguno. Ahora el rótulo se queda en la vista (es microcopy) y la **clasificación** vive
en `tipoDeFactura`, que usan los tres consumidores. Hay guard de que no se duplique.

## «Incluir precios en el parte» — intacto

El ticket lo llamaba `Iniciar precio en el parte` y **ese botón no existe**: es una **casilla**, se
llama `Incluir precios en el parte` y escribe `modoValoracion` al crear el albarán. No se mueve, no
se renombra y no se esconde un control cuyo significado no está medido — **esconder no es proteger**.

## Los seis rojos

| # | Qué se rompe | Qué sale |
|---|---|---|
| 1 | Un documento se descarta en el reparto | 🔴 «se perdería en silencio» |
| 2 | Un tipo se queda sin destino | 🔴 **nombrándolo**: «SIN DESTINO EN LA TABLA: albaran» |
| 3 | Una factura se cuela en DINERO (el error de B4) | 🔴 nombrando el documento |
| A | La rectificativa se pinta suelta | 🔴 «no dice a qué factura corrige» |
| B | Se ancla a OTRA factura | 🔴 «estaría adivinando» |
| C | El backend deja de mandar el vínculo | 🔴 «volvería a pintarla suelta» |
| D | Una huérfana se descarta en vez de bajar a la sección | 🔴 «se habría perdido» |
| 4 | El rótulo vuelve a clasificar por su cuenta | 🔴 «dos condiciones decidiendo lo mismo» |
| 5 | Renombrar la casilla de precios | 🔴 «se renombró un control sin medir» |
| 6 | Cegar el derivador de tipos | 🔴 ESCÁNER CIEGO |

### El rojo 5 no salió a la primera

El assert comprobaba que el texto **apareciera en el fichero**, y aparece **dos veces** (la casilla
del alta y la del editor del albarán): al renombrar una, la otra mantenía el verde. Un guard que se
conforma con «existe en algún sitio» no protege un control — protege la palabra. Ahora cuenta las
dos apariciones y además comprueba que la casilla siga gobernando `modoValoracion`.

Corregido y **comiteado antes de seguir inyectando**, que es la regla nueva.

## Verificación

- `npm run build` → **exit 0** y `npm test` → **exit 0** en esa misma tirada: **1630 tests · 1563 pass · 0 fail · 67 skipped**.
- `origin/main` no se movió durante el ticket: la rama sale de `c711b79` y ahí sigue.

## Microcopy (regla 30)

**Cero texto nuevo.** `Albaranes` y `Facturas` son rótulos que ya tenía el producto; el estado
vacío de albaranes se mueve verbatim. `QUÉ FALTA PARA COBRAR` y `GASTOS` quedan **declaradas y sin
pintar**, así que sus rótulos llegan con quien las llene.

## Huecos declarados

- **AB6 · matriz de dispositivos y capturas: PENDIENTE** (humano).
- **`QUÉ FALTA PARA COBRAR`** — declarada, es **G5**.
- **`GASTOS`** — declarada y vacía por medición, no por alcance.

## Lo que NO se tocó

La tabla de albaranes en sí (**C3**), el mecanismo de gastos, el cobro, la firma,
`prisma/schema.prisma`, el contenido de «Qué falta para cobrar» (**G5**) y la casilla de precios.
