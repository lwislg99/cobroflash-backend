# Capturas de Holded · qué es cada una y qué prueba

**Tomadas el 20-sep-2026 a las 19:20:38Z (hora de GitHub)** sobre `origin/main` =
`8fcfd13fc7e14069bef9ce2b9c3f94fe969f2506`, en la cuenta de prueba de Holded del 17-sep, con el
navegador vivo del recorrido (CDP en el 9333). **Solo lectura:** no se pulsó ningún interruptor, no
se guardó nada y no se envió ningún documento.

Existen porque el fundador preguntó el 20-sep si había capturas de Holded en el repo y **no había
ninguna**: `git ls-tree` sobre todo el árbol daba 0 ficheros con «holded» en el nombre. La norma que
sale de ahí, y que vale para Jobber y los que vengan: **cada propuesta nace con su captura.** Una
afirmación sobre el producto de otro, sin imagen, es un recuerdo.

| fichero | qué enseña | qué propuesta sostiene |
|---|---|---|
| `portal-cliente-nueve-acciones.png` | Su artículo `9382835`, entero: las **nueve acciones** del Portal del Cliente —resumen, pagos, aceptar presupuestos, descargar o imprimir, comentar, catálogo, pedidos, **crear y modificar contraseña** e idioma—, cada una con su propia pantalla | **El enlace del portal, en el mensaje** (matriz §10.1) |
| `caducidad-firma-lista-cerrada.png` | `Configuración > CRM > Firma digital`: «Tiempo de expiración de la firma» → **«Días para que expire la firma»**, un desplegable cerrado | **Caducidad en un toque** (matriz §10.3) |
| `varios-firmantes-ayuda-10900972.png` | Su ayuda, literal: *«¿Pueden firmar varias personas un mismo documento? Sí. Puedes añadir varios firmantes al enviar el documento.»* Y al lado, su encuadre legal: la firma *«no equivale a una firma electrónica cualificada»* | **Que el presupuesto llegue a quien decide** (matriz §10.2) |

## Lo que estas capturas NO son, dicho antes de que nadie se confunda

🔴 **La tercera NO es la caja de envío.** Es su **fuente escrita** sobre la caja de envío. La caja no
se ha fotografiado porque **el clic que la abre sigue prohibido** —lo bloquea el clasificador de
permisos de la máquina para controles de envío de aplicaciones de facturación de terceros, no
Holded—, y no se busca la vuelta. Está declarado en la matriz §9.4. Si algún día se autoriza ese
clic, la captura que falta es ésa.

**Del desplegable de caducidad se fotografía el control, no la lista desplegada**: un desplegable
abierto no sale en una captura. Sus cinco valores se leyeron del DOM, que es mejor prueba que la
imagen:

    <select> n=5 actual=«15» · 1 Día | 2 Días | 7 Días | 15 Días | 30 Días

🔴 Y ahí hay un dato que no estaba escrito en ninguna parte y que afina la propuesta §10.3:
**su valor por defecto es 15 días; el nuestro son 30** (`quotes.routes.ts:223`). No es que ellos
ofrezcan elegir y nosotros no: es que **arrancan en la mitad de tiempo que nosotros**.

## Un estado que cambió, y se dice porque tumba lo escrito

En la captura de los ajustes **los cinco tipos de documento salen apagados**, incluido
**Presupuestos**, que la entrega anterior (matriz §9.5) dejó **encendido a propósito** y verificado
tras recargar la página entera. Medido hoy en una pestaña recién abierta, leyendo el DOM y no la
imagen:

    node interruptores.mjs "digitalsignature"
    → POBLACION interruptores=6 · los 6 en estado=false

**El hecho es ése: hoy están los seis en `false`.** Por qué volvió a apagarse no se sabe desde aquí
—no se tocó—, y no se inventa una causa. Queda reportado al orquestador y **no se ha vuelto a
encender**: la autorización del 20-sep describía un interruptor que ya estaba puesto, no daba
permiso para ponerlo, y una autorización no se estira (A19).

    🔒 Verificar recargando la página demuestra que se guardó entonces, no que siga guardado después.
