# SCRUM-1437 · Consultoría por dentro: Verifacturamos, de presupuesto a cobro, contado en pasos

**Rama:** `scrum-1437-verifacturamos-por-dentro-pasos` · **Carril:** S0 · **Fecha:** 2-oct-2026
**Medido contra:** `origin/main` = `f30b1a4052957e245ebe1cfef53bbef410c5816b` · 2026-10-02T16:35Z (hora de GitHub)

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
| 3 | YaQu medido igual y EN PANTALLA | **NO HECHO.** Leído en código; la cuenta de QA la renueva el fundador |
| 4 | Tabla de tres columnas con el dato de pasos arriba | Hecho (§2, §3), con la columna «nosotros» sin ver en pantalla |
| 5 | Dicho qué se vio y qué no | Hecho (§6) |
| 6 | Sin copiar código, textos ni plantillas | Hecho |

El ticket NO está completo: falta el punto 3.

## Población

Verifacturamos: 26 capturas hechas, 25 comiteadas. La de la pantalla de entrada se queda fuera a propósito:
enseña la longitud de la contraseña. YaQu: 10 tramos leídos por un subagente de solo lectura; comprobadas a
mano 7 de sus citas, 6 exactas y 1 con la ruta mal (`quotesAdmin.routes.ts` vive en
`src/modules/system/app/routes/`, no en `quotes`), corregida en el documento.

## Error propio

Para abrir el menú «⋯» de una factura emitida de ejemplo usé un selector por posición y pulsó el botón
«Enviar», que despliega tres opciones. No se eligió ninguna y no salió nada: el desplegable se cerró con la
sesión. El ticket dejaba fuera pulsar «Enviar al cliente»; el botón pulsado fue el que abre el menú, no la
opción. Lo que enseñó ese menú está en el documento como visto, con este origen.
