# SCRUM-917 · La lista de Trabajos y el detalle de HOY, medidos

No es una lectura del código: es una **medición del producto corriendo en staging**, el 17-sep-2026,
sobre `963c2732` (que lleva dentro todo lo mergeado hoy). A 1280 × 900 y a 390 × 844 táctil, con la
sesión QA. Las capturas están en `capturas/`.

> **Por qué se mide y no se deduce.** El ticket nace de dos capturas del fundador y de una frase,
> «parece rudimentario». Una frase no se discute con otra frase. Lo que sigue son cuentas: cuántas
> filas de cuántas, cuántos píxeles, cuántas veces sale la misma cifra.

**Los datos de staging el día de la medida:** 13 Trabajos · 1 agendado y 12 sin agendar · 3 sin
presupuesto · 13 sin ningún técnico asignado · 13 con eje de cobro · 9 con cero cobrado · el equipo
del merchant de pruebas está **vacío**.

---

## 1 · La lista

| | medido |
|---|---|
| columnas | Cliente (286 px) · Técnicos (122 px) · Importe (193 px) · Fecha (180 px) · Acciones (202 px) |
| grupos | «📅 Esta semana · 1» y «⏳ Sin agendar · 12» |
| filas | 13 |
| «Sin asignar» en la columna Técnicos | **13 de 13** (100 %) |
| píldora «SIN AGENDAR» en la columna Fecha | **12 de 13** (92 %) |
| botón «Agendar», idéntico, en la columna Acciones | **12 de 13** |
| filas cuyo Importe empieza por «—» | **3 de 13** |
| filas cuya segunda línea dice «0,00 € de …» | **9 de 13** |
| ¿dice la pantalla, en euros, cuánto falta por cobrar? | **NO, en ningún sitio** |
| alto de la pantalla a 390 px | 2.522 px para 13 filas (≈ 194 px por fila) |
| scroll horizontal | no, en ninguna de las dos anchuras |
| controles por debajo de 44 px | 32 a 1280 · 18 a 390 |

### 1.1 · Lo que estas cuentas significan

**① La pantalla no contesta la segunda pregunta del fundador.** Él quiere ver «cuánto falta por
cobrar». Sumando los 13 Trabajos salen **4.197,51 €**, y ese número **no aparece en la pantalla**.
Los filtros de arriba cuentan TRABAJOS —«Pendiente · 9 · Parcial · 1 · Pagado · 3»—, no euros. Para
saber cuánto le deben hay que salirse de Trabajos. No es un problema de estilo: es la pregunta sin
responder.

**② Tres columnas de las cinco dicen lo mismo en casi todas las filas.** Técnicos dice «Sin asignar»
13 veces; Fecha dice «SIN AGENDAR» 12 veces; Acciones dice «Agendar» 12 veces. Entre Técnicos y
Fecha se llevan **302 px de los 982 de la tabla (31 %)** para no distinguir una fila de otra.

**③ Y la píldora «SIN AGENDAR» repite, palabra por palabra, la cabecera que tiene tres píxeles
encima**: «⏳ Sin agendar · 12». La misma información, 13 veces en la misma pantalla.

**④ La cifra grande de cada fila es la que menos se necesita.** Lo que se ve grande es el total del
presupuesto (417,45 €) y lo que falta por cobrar va debajo, pequeño y gris, y encima dicho al revés:
«0,00 € de 417,45 €» obliga a restar. En 9 de 13 filas esa segunda línea empieza por «0,00 € de».

**⑤ Una celda enseña dos números que se contradicen, y no lo dice.** «SCRUM-883 Cliente
electricista» sale con **539,05 €** de importe y debajo **«628,60 € de 539,05 €»**: cobrado mayor
que la referencia. Puede ser dato de prueba o un caso real (un pago de más, un importe corregido
después de cobrar), pero la pantalla lo pinta como si fuera normal.

### 1.2 · ⚠️ Lo que esta medición NO puede decir

El merchant de staging **no tiene equipo**, así que la columna Técnicos cae a su celda de texto y
**los 13 «Sin asignar» son texto, no selectores**. El fundador vio en su captura «los selectores
"Sin asignar" repetidos en cada fila», que es el caso CON equipo: ahí cada celda monta un
desplegable. Esa repetición no la he medido y no la afirmo. Lo que sí vale para los dos casos: con
cero técnicos en el equipo la columna no informa **nunca**.

---

## 2 · El detalle (Trabajo 3099 · María López · agendado y PAGADO)

| | medido |
|---|---|
| secciones | 8 · dos de ellas **sin título** |
| alto total a 1280 | 1.426 px (a 390: 2.197 px) |
| alto de la cabecera | 139 px |
| botones | 12, ninguno repetido |
| «590,00 €» en pantalla | **7 veces** |
| «0,00 €» en pantalla | 2 veces |
| «María López» en pantalla | **5 veces** |
| «Presupuesto #5» | 2 veces |
| ancho del campo «Nombre del trabajo» | 205 px (igual el de «Dirección de la obra») |
| controles por debajo de 44 px | 26 a 1280 · 25 a 390 |

Orden de las secciones, tal como salen: **Qué falta para cobrar** (239 px) · *(sin título)* Total
aceptado (140 px) · *(sin título)* Quién ejecuta este trabajo (92 px) · Albaranes (152 px) · Tipo de
trabajo (97 px) · Datos (212 px) · Notas internas (159 px) · Gastos de este trabajo (86 px). A la
derecha, un rail con CLIENTE · DINERO · PRESUPUESTO · RESPONSABLE.

### 2.1 · Lo que estas cuentas significan

**① La misma cifra, siete veces.** 590,00 € sale como «Aceptado», como «Facturado», como «Cobrado»,
como «TOTAL ACEPTADO» a 2,2 rem, dos veces dentro de «Cobrado 590,00 € de 590,00 €» y otra vez en el
rail. Nueve importes en pantalla para **dos valores distintos**. Eso es, medido, la sensación de
«rudimentario»: no hay nada mal calculado, hay una pantalla que no elige.

**② El nombre del cliente, cinco veces**, tres de ellas en los 139 px de la cabecera: en las migas
(«Trabajos › María López · Presupuesto #5 · María López»), en el título y en el subtítulo. Las migas
lo dicen dos veces ellas solas.

**③ «QUÉ FALTA PARA COBRAR» en un Trabajo que está PAGADO.** El chip dice PAGADO, la sección dice
«Te falta por cobrar 0,00 €» y la barra está al 100 %. La sección se pinta porque sí queda un hueco
—«2 líneas del presupuesto sin entregar»—, pero ése es un hueco de ENTREGA. El rótulo promete
dinero y enseña otra cosa. La lógica es correcta; el rótulo miente.

**④ Una sección entera para un estado vacío.** «QUIÉN EJECUTA ESTE TRABAJO» ocupa 92 px con
cabecera en versalitas para decir «Todavía no has dado de alta a nadie en tu equipo».

**⑤ «Incluir precios en el parte» es una casilla suelta** entre «+ Nuevo albarán» y «Parte de
trabajo», dentro de la sección ALBARANES. No se parece a un ajuste ni está donde tiene efecto.

**⑥ Todo lo que se edita está bajo el pliegue.** Tipo de trabajo, Datos, Notas y Gastos empiezan
pasados los 900 px de alto de la ventana.

---

## 3 · 🔴 LO QUE ESTÁ MAL DECIDIDO frente a LO QUE ESTÁ BIEN DECIDIDO Y MAL PRESENTADO

Es la distinción que pidió el orquestador, y es casi todo lo segundo.

### 3.1 · Bien decidido, y se queda (con su motivo comprobado hoy)

| decisión | ticket | ¿sigue siendo cierto su motivo? |
|---|---|---|
| Los GRUPOS por lo que toca, con su importe y su salvedad | SCRUM-428 | **Sí.** Son lo único que hoy jerarquiza la lista. |
| La lista es una TABLA como sus cuatro hermanas, no un componente propio | SCRUM-727b | **Sí.** Y cambiarlo movería las otras cuatro. |
| Agendar y asignar detrás de un gesto distinto del que navega | SCRUM-727b / 823 | **Sí.** Sigue siendo un candado necesario. |
| Sin eje de cobro NO se pinta chip: ausente ≠ cero | SCRUM-363 / 651 | **Sí**, y hay que extenderlo (ver 3.2 ④). |
| El acto irreversible (cerrar) no es nunca la acción principal | SCRUM-344 / 823 | **Sí.** No se toca. |
| El detalle: 1 estado + 1 acción + 1 lista; documentos fusionados | SCRUM-31 F1–F6 | **Sí.** Lo que falla es cuántas veces se repite el estado, no la jerarquía. |

### 3.2 · Bien decidido y MAL PRESENTADO — aquí está el trabajo

| qué | por qué se ve pobre | qué se cambia |
|---|---|---|
| ① Doce «Agendar» verdes idénticos | doce primarias iguales no jerarquizan: **si todo es primario, nada lo es** | la primaria se reserva para el momento del dinero; la acción repetida del grupo baja a secundaria. La función no se toca |
| ② «SIN AGENDAR» en 12 filas | repite la cabecera del grupo | se quita de la fila: **el grupo ya lo dijo**. La columna Fecha enseña fecha o nada |
| ③ «Sin asignar» en 13 filas | una columna que dice lo mismo siempre | Técnicos deja de ser columna y baja a la línea del cliente, y **sólo si hay equipo** (misma regla del hueco de 651) |
| ④ La cifra grande es el total | la pregunta del jefe es cuánto FALTA | la cifra grande pasa a ser lo que falta; el total, debajo y pequeño |
| ⑤ 590,00 € siete veces en el detalle | la pantalla no elige | el dinero se dice **una vez**, en una sola franja |
| ⑥ El cliente cinco veces en el detalle | migas + título + subtítulo dicen lo mismo | el título es el TRABAJO; el cliente vive en el rail, donde ya está |

### 3.3 · 🔴 MAL DECIDIDO (poco, pero lo hay)

| qué | por qué es una decisión y no una presentación |
|---|---|
| **① La lista no dice cuánto falta por cobrar, en euros.** | No es que se vea mal: es que **el dato no está**. Hoy hay que salirse de la pantalla para saber que son 4.197,51 €. Es la mitad de lo que el fundador pide ver de un vistazo. |
| **② «Qué falta para cobrar» se pinta cuando lo que falta no es dinero.** | El rótulo afirma algo falso en un Trabajo PAGADO. Se separan las dos preguntas: lo que falta por COBRAR y lo que falta por ENTREGAR. |
| **③ Cobrado mayor que la referencia se enseña sin decir nada.** | Dos números que se contradicen en la misma celda. O es un caso legítimo y hay que nombrarlo, o es un defecto y hay que verlo. Callarlo es la única opción que no vale. |

> ⚠️ El ③ **no lo arregla un prototipo**: hay que saber primero si cobrar de más es legítimo (un
> anticipo mayor, un importe corregido después de cobrar) o si es un defecto del cálculo. Eso es del
> carril de la S1. Aquí se propone **cómo se vería** una vez decidido, no qué se decide.
