# SCRUM-466 · Que el firmante VEA lo que firma

**Fecha:** 11-ago-2026 · **Carril:** H (offline) / evidencias · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `a18b67704073249cc37791416da08abba970c27d` · 2026-08-10T23:56:26Z

**Paso 0:** `docs/master/SCRUM-466.md` no existía en `main` ni en ninguna rama remota, y **su
ausencia no se dio por prueba**. La rama no la tenía ningún worktree. Premisa reconfirmada: mi
SCRUM-463 ya está en `main` y es la medición que abre esto.

## 1 · Qué arregla

SCRUM-463 midió que quien firma en el móvil del profesional **no veía nada** de lo que firmaba.
Nos habíamos gastado un bloque entero (SCRUM-438) congelando cinco campos para que nadie pudiera
discutirlos, y **el firmante no había leído ninguno**.

> No se sella lo que no se enseña, y no se enseña menos de lo que se sella.

Ahora el albarán va **dentro del pad, encima del recuadro y en la misma pantalla** (decisión 3 del
fundador): es lo que hace defendible el «lo vio» — estaba mirándolo mientras firmaba. Se enseñan
los **cuatro** que ya sellamos en v:3: **líneas** (concepto y cantidad), **cliente**, **fecha** y
**lugar de entrega**.

## 2 · 🔴 PASO 1 — y sale un DEFECTO que no es de este carril

**El encargo pedía comprobar que la regla «un albarán no lleva importes» ya se cumple. No se
cumple.** Medido generando el PDF de verdad y leyendo su texto:

| Modo | ¿Importes en el papel? | Qué aparece |
| --- | --- | --- |
| **VALORADO** | 🔴 **SÍ** | `PRECIO UD.` · `IMPORTE` · `Base: 24.690,00` · `Total: 29.875,00` |
| SIN_VALORAR | no *(control)* | — |

> ⚠️ **Mi primera búsqueda dijo `false` y estaba mal:** busqué el número crudo y en céntimos, y el
> PDF lo formatea con separador de miles (`987.654,00`). Lo destapó el trozo de texto alrededor de
> «Total» que imprimí por si acaso. **Un `false` de una búsqueda mal formada se lee igual que una
> ausencia.**

**Y eso responde la otra pregunta:** `modoValoracion` significa hoy, exactamente, **«el PDF que se
le manda al cliente lleva importes»**. No es un dato interno para facturar después: sale en el papel
que el cliente recibe por WhatsApp.

**Es la familia exacta que cerró SCRUM-452** —firma una cosa y se lleva otra—: el firmante ve un
albarán sin importes y recibe un PDF con ellos. **Reportado, no arreglado**: es otro carril.

## 3 · 🔴 Sin importes, y es la mitad del ticket

Ni unitario, ni de línea, ni total. El motivo no es de maquetación: **quien firma en obra no es
necesariamente quien acordó el precio** —un inquilino, un administrador de finca, el empleado de la
tienda—. Hacerle firmar un importe convierte un acuse de «esto se ha hecho» en una **aceptación de
precio de alguien sin autoridad sobre él**.

**Y no es solo que no se pinten: el llamador NO se los pasa.** `precioUnitario`, `totales`,
`modoValoracion` y `tipoIva` no cruzan la frontera, así que **no se pueden pintar por descuido** —
la misma forma que SCRUM-452 con el PDF. Con guard en los dos lados.

## 4 · La microcopy, y el censo que la cazó al nacer

Los dos textos aprobados (asesor, 11-ago-2026) viven en `ALBARAN_ROTULOS`, su fuente única. El censo
`ALBARAN_ROTULOS_APROBADOS` **los cazó al nacer**, que es exactamente para lo que existe: quedan
declarados con quién los aprobó y cuándo.

## 5 · 🔴 Un defecto que introduje yo, y lo cazó la medición en navegador

Al añadir el albarán, la tarjeta pasó a **700 px de alto**. A **320×568** se salía de la pantalla, y
con `align-items:center` **una tarjeta más alta que el viewport se centra y su parte de arriba queda
fuera y sin forma de alcanzarla**: el firmante habría perdido de vista justo lo que este ticket
existe para enseñarle, **y en el móvil más pequeño, que es donde se firma en obra**.

Arreglado con `align-items:flex-start` + `overflow:auto`. Antes no se notaba porque la tarjeta
cabía: **lo rompió este cambio y lo arregla este cambio**.

### La caja, medida con el CSS REAL

Ejecutando **el pad de verdad** (no una copia del marcado) con `tokens.css` + `styles.css`
extraídos de `index.html`:

| Pantalla | Tarjeta | ¿Cabe / se alcanza? | Scroll horizontal | Texto aprobado |
| --- | --- | --- | --- | --- |
| 390 × 844 | 358 × 639 | ✅ entera | no | completo |
| **320 × 568** | 288 × 700 | ✅ **arriba visible**, overlay con scroll | no | completo, **2 líneas** |

> ⚠️ **Y antes de medir, comprobé que la página era la que creía** —hay diálogo, resumen del
> albarán, canvas, y los tokens del dashboard resuelven (`--ink: #0f1c17`); no es un login—. Es la
> lección de la medición falsa de hoy: *una medición en navegador no es fiable por ser en
> navegador*. De hecho el servidor viejo siguió sirviendo el HTML anterior tras el arreglo, y sin
> ese control habría medido la versión sin corregir.

## 6 · Verificación · 8 tests, ejercitando el pad DE VERDAD

| | |
| --- | --- |
| **🔴 CONTROL POSITIVO** | se ven líneas, cantidad, cliente, fecha y lugar — **uno a uno y nombrados** |
| **🔴 CONTROL NEGATIVO** | con un albarán **VALORADO**: no se cuela precio, ni total, ni `€`, ni ningún rótulo de importe. **Con su control positivo dentro**: lo que sí debe verse, se ve — para que «no hay importes» no lo cumpla un pad que no pinta nada |
| Imposible por construcción | el llamador no le pasa importes, **y sí le pasa lo que debe** |
| Microcopy | es la aprobada y no menciona dinero, **con el respaldo de la negación** |
| **REGRESIÓN** | la página pública sigue enseñando líneas y cliente, y sigue sin importes |
| **SIN RED** | el pad no hace `fetch`: si alguien le mete uno, dejaría de pintar justo en el sótano — el caso del bloque H |
| Aditivo | sin albarán, el pad sigue funcionando |
| **SUELO** | si el banco no monta el pad, el test **se declara ciego** |

### Los rojos por el mecanismo — cada uno con post-condición en disco (y `node --check`)

| Mutación | Cae diciendo |
| --- | --- |
| se quita el pintado de las líneas | *«EL FIRMANTE NO VE LO QUE FIRMA: falta las LÍNEAS (el concepto), la CANTIDAD»* (+2) |
| se cuela un precio en la tabla | *«SE HA COLADO UN IMPORTE EN LA PANTALLA DE FIRMA: el PRECIO UNITARIO (987654)»* |
| el llamador vuelve a pasar importes | *«la vista le pasa «precioUnitario» al pad de firma»* |
| la microcopy habla de dinero | *«…un rótulo de importe (Base/Total/Subtotal/IVA)»* (+1) |

> **SCRUM-237 me exigió respaldar una negación, y tenía razón:** mi patrón anti-dinero podía estar
> roto y habría absuelto siempre. Ahora se comprueba primero contra textos que **sí** deben caer.
> *Se arregla la negación, no se sube un número.*

## 7 · El test de SCRUM-463, ACTUALIZADO y no silenciado

Decía *«la pantalla desde la que se firma NO pinta el contenido»* — **falso desde hoy**. Ahora dice
lo que sigue siendo cierto y es más pequeño: **la pantalla de DETALLE del albarán sigue sin enseñar
su contenido**. No es el defecto de la firma —ése está cerrado—, pero es la pantalla del albarán y
no muestra el albarán. Queda medido, no exigido, y con el puntero a este ticket.

## 8 · Lo que NO se ha tocado

El sellado, el verificador y las versiones del sobre — **este cambio no toca qué se sella ni
cuándo**. Tampoco el banco de SCRUM-417 (su `destinoEfectivo` y su falta de `canvas` siguen siendo
hallazgo, no carril), la precarga (SCRUM-464), la cola (H3), `prisma/schema.prisma` ni ningún
albarán de producción.
