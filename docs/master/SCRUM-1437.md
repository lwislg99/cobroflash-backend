# SCRUM-1437 · Consultoría por dentro: Verifacturamos, de presupuesto a cobro, contado en pasos

**Rama:** `scrum-1437-verifacturamos-por-dentro-pasos` · **Carril:** S0 · **Fecha:** 2-oct-2026
**Medido contra:** `origin/main` = `f30b1a4052957e245ebe1cfef53bbef410c5816b` · 2026-10-02T16:35Z (hora de GitHub)

**Skill UI:** no cargada · no se toca `public/`: esta entrada solo LEE y cita ficheros de la pantalla para contar pasos y costes; el PR cambia únicamente `docs/`

A9: aviso → cicatriz S0 «Un selector por posición pulsa lo que haya en esa posición: en una aplicación ajena, el control se elige por lo que dice y se excluye por nombre lo que no se pulsa.» — no se pudo comprobar: el conductor del recorrido vive fuera del repositorio y no hay test que lo alcance

## Qué entra

- `docs/competencia/pasos-verifacturamos-vs-yaqu.md`: el método de contar, el dato de pasos, la tabla
  ellos · nosotros · la diferencia y los dos lados tramo a tramo.
- `docs/competencia/capturas/verifacturamos/pasos-02…26-*.png` (25 capturas) y su fila en el `README.md`.

## Contra la aceptación del ticket

| # | Aceptación | Estado |
|---|---|---|
| 1 | Método escrito antes de la cifra, igual para los dos lados | Hecho (§1) |
| 2 | Verifacturamos por dentro: cliente, presupuesto, conversión, envío y cobro, con cifras y capturas | Hecho hasta el botón: «Enviar», «WhatsApp» y «Emitir» no pulsados (§4, §6) |
| 3 | YaQu medido igual y EN PANTALLA | **NO HECHO.** Leído en código. Con la cuenta de QA renovada (16:37Z) se abrió el inicio; el clasificador de permisos denegó pulsar y teclear en producción, y no se ha rodeado |
| 4 | Tabla de tres columnas con el dato de pasos arriba | Hecho (§2, §3), con la columna «nosotros» sin ver en pantalla |
| 5 | Dicho qué se vio y qué no | Hecho (§6) |
| 6 | Sin copiar código, textos ni plantillas | Hecho |

El ticket NO está completo: falta el punto 3.

## Población

Verifacturamos: 26 capturas hechas, 25 comiteadas. La de la pantalla de entrada se queda fuera a propósito:
enseña la longitud de la contraseña. YaQu: 10 tramos leídos por un subagente de solo lectura; comprobadas a
mano 7 de sus citas, 6 exactas y 1 con la ruta mal (`quotesAdmin.routes.ts` vive en
`src/modules/system/app/routes/`, no en `quotes`), corregida en el documento.

## Segunda entrega · los otros tres (2-oct-2026, misma rama)

Encargo del orquestador: el mismo recuento sobre Contasimple, Billin y ServiceM8 con el material ya escrito.
Hecho en §7 del documento, con dos avisos medidos: (1) ese material recorre la **factura suelta** de
Contasimple y Billin, no su presupuesto, su conversión ni su cobro, y describe campos, no pulsaciones: las
cifras van como deducidas; (2) la hipótesis «ninguno tiene cobro» **no se sostiene**: de los cuatro, solo
Verifacturamos está confirmado sin él, y el recuento del 21-sep ya daba al menos nueve de trece con cobro en
línea.

## Tercera entrega · ServiceM8 por dentro (2-oct-2026, rama `scrum-1437b-servicem8-por-dentro`)

Rama nueva porque #2175 mergeó (verde, `b3b9f7a6`) mientras se hacía este recorrido.

Encargo del orquestador: entrar en ServiceM8 y en Contasimple; Billin fuera (contraseña sin guardar).
ServiceM8 hecho (§8 del documento, 10 capturas `pasos-*` en su carpeta): el Trabajo pasa de presupuesto a
factura cambiando un campo de estado, 3 clics y 0 campos, sobre el mismo registro; hay un paso de aprobación
antes de «esperando pago»; cobrar es apuntar un cobro en otra pantalla. No pulsados: enviar, aprobar ni
añadir pago. **Contasimple NO hecho:** no hay credencial reconocible en la máquina; como Billin, pide
recuperar la contraseña por correo, que es del fundador.

Población: 4 Trabajos creados para un recorrido que cabía en 1. Dos se gastaron porque un Trabajo en estado
Presupuesto no aparece en la lista de la pizarra y no supe reabrirlo; uno, por un selector que casaba con dos
elementos y que el conductor rechazó en vez de pulsar el primero.

## Cuarta entrega · la página para el fundador (2-oct-2026, misma rama que la tercera)

§10 del documento: la frase de procedencia arriba, lo medido en cuatro líneas y las tres cosas que la
comparación abre, cada una con su base, lo que ahorra, lo que cuesta leído en nuestro código y su etiqueta
(medido / deducido / no mirado). Dos de las tres tocan esquema o camino de emisión: se nombran y se paran.
Leído para el coste: `prisma/schema.prisma` (`customerId Int` en `Quote`), `src/core/validation/schemas.ts`
y `public/dashboard/js/homeView.js`. No se ha leído la decisión que dejó el asistente en cuatro pasos.

## Quinta entrega · la decisión de los cuatro pasos (2-oct-2026, misma rama)

§11 del documento. La decisión EXISTE y tiene motivo: SCRUM-915, v2 → v3 del prototipo, aprobada por el
fundador el 17-sep-2026 tras decir de la v1 que era «un poco lioso». El motivo es claridad; la decisión no
contó pulsaciones. Condiciones se dibujó para llegar relleno. Cuántas veces se toca: no se puede saber hoy
(sin rastro en el editor, sin clientes reales). Quitar ese paso ahorra 1 clic y el mecanismo existe (el
justificante ya corre con tres pasos), pero cambia una pantalla firmada y la sujetan guards no leídos uno a
uno. Leído: `docs/prototipos/SCRUM-915/direccion-de-diseno.md`, `medicion.md`, `docs/master/SCRUM-915.md`
(por búsqueda, no entero: 1.180 líneas) y `public/dashboard/js/quotesView.js` en torno a `PASOS_DEL_EDITOR`.

## Sexta entrega · YaQu en pantalla (2-oct-2026, misma rama)

Con permiso escrito del fundador en la sesión. §12 del documento. Recorrido en yaqu.app con la cuenta de QA y
toda petición que no fuera de lectura cortada: **nada creado, enviado ni aceptado**. Visto: el editor
completo hasta «Generar presupuesto», el presupuesto rápido hasta «Enviar por WhatsApp», la ficha de un
borrador, el formulario de aceptar a mano, y las listas de Facturas, Cobros, Albaranes y Trabajos.

**Punto 3 de la aceptación: HECHO HASTA DONDE LA CUENTA DEJA.** Presupuesto y aceptación, vistos. Factura y
cobro NO: la cuenta de QA tiene la facturación apagada y la pantalla lo dice. No es un hueco de datos que se
siembre: hace falta una cuenta con la facturación encendida (apuntado en SCRUM-1367).

**Cifra corregida por la pantalla:** el editor son 7 clics, no 6. El subagente listó siete pulsaciones y sumó
seis; copié la suma sin recontarla y la repetí en cuatro entregas y en dos mensajes al orquestador.

A9: aviso → cicatriz S0 «Una suma que trae un subagente se recuenta contra su propia lista antes de copiarla: la lista era de siete y la suma decía seis.» — no se pudo comprobar: es un recuento a mano sobre un informe en prosa, sin fichero que un test pueda leer

## Error propio

Para abrir el menú «⋯» de una factura emitida de ejemplo usé un selector por posición y pulsó el botón
«Enviar», que despliega tres opciones. No se eligió ninguna y no salió nada: el desplegable se cerró con la
sesión. El ticket dejaba fuera pulsar «Enviar al cliente»; el botón pulsado fue el que abre el menú, no la
opción. Lo que enseñó ese menú está en el documento como visto, con este origen.
