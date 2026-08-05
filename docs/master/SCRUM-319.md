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
| `factura` | `job.invoices`, el resto | **sin destino decidido** |
| `rectificativa` | `job.invoices`, `type==='R1'` | **sin destino decidido** |

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
y no colocar por cuenta propia** (regla 9). Y aquí importa más de lo normal: mandar una **factura**
al bloque `DINERO` junto a los justificantes sería repetir el error que **B4** vino a arreglar —dos
documentos con significados legales distintos compartiendo sitio—, esta vez en dirección contraria.

**Se quedan juntas y visibles, con el título que ya tenían**, hasta que decidas. Es la única opción
que no inventa un diseño **ni pierde un documento**: las dos cosas que este ticket prohíbe.

> **DECISIÓN PENDIENTE:** ¿dónde van las facturas y las rectificativas de un Trabajo? ¿Sección
> propia, rail, o fuera de esta pantalla?

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

- `npm run build` → **exit 0** y `npm test` → **exit 0** en esa misma tirada: **1627 tests · 1560
  pass · 0 fail · 67 skipped**.
- `origin/main` no se movió durante el ticket: la rama sale de `c711b79` y ahí sigue.

## Microcopy (regla 30)

**Cero texto nuevo.** `Albaranes` y `Documentos` son los rótulos que ya tenía la pantalla; el estado
vacío de albaranes se mueve verbatim. `QUÉ FALTA PARA COBRAR` y `GASTOS` quedan **declaradas y sin
pintar**, así que sus rótulos llegan con quien las llene.

## Huecos declarados

- **AB6 · matriz de dispositivos y capturas: PENDIENTE** (humano).
- **`QUÉ FALTA PARA COBRAR`** — declarada, es **G5**.
- **`GASTOS`** — declarada y vacía por medición, no por alcance.

## Lo que NO se tocó

La tabla de albaranes en sí (**C3**), el mecanismo de gastos, el cobro, la firma,
`prisma/schema.prisma`, el contenido de «Qué falta para cobrar» (**G5**) y la casilla de precios.
