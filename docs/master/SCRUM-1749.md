# SCRUM-1749 · La ficha del Trabajo: como mucho UNA rellena, el paso de hoy — mitad FICHA (S2)

**Medido contra:** `origin/main` = `c9c8a7c3a2e9d2b5525494164755144f35d762d4` · 2026-11-18T12:15:26Z
**Rama:** `scrum-1749-ficha-primarias` · **Carril:** S2
**Skill UI:** cargada (`yaqu-premium-ui`) · no hay token, color, texto ni componente nuevo: solo cambia la CLASE de dos botones que ya existían
A9: comprobación → `tests/scrum1749-ficha-una-rellena.test.mjs`

**La regla** es la reconciliación de SCRUM-1739 **c.22030**: «como mucho UNA rellena por pantalla = el paso que hace avanzar el trabajo HOY». La aplica a la ficha la decisión del orquestador en SCRUM-1749 **c.22041**, tomada con la delegación de SCRUM-1656 c.21978.

## PASO 0 · lo que enseñaba la ficha ANTES (medido en yaqu.app)

Sonda de solo GET `sondas-s2/paso0-1749-ficha-primarias.mjs` (fuera del repo). Build `c9c8a7c3a`, cuenta QA con 11 trabajos, admin real. Dio lo mismo a 390 y a 1280.

| estado (trabajo QA) | cabecera | rellena | puerta al parte |
|---|---|---|---|
| sin agendar (#83) | Agendar | **Agendar** | «+ Nuevo parte», contorno, en su sección |
| agendado PARA HOY (#86) | ▶ Empezar | **▶ Empezar** | igual |
| en curso (#77) | + Nuevo albarán · Marcar terminado · + Añadir gasto | **+ Nuevo albarán** | igual |
| terminado SIN resto (#76) | Enviar para firmar · + Añadir gasto · ⋯ | **Enviar para firmar** | igual |
| cerrado (#79) | — | ninguna | no hay |

El CTA de la escalera (`jobNextAction`) salía SIEMPRE relleno, fuera cual fuera el estado. La ficha no tiene «Abrir parte»: su puerta al parte es «+ Nuevo parte» (N9).

## Lo que cambia (c.22041)

| estado | rellena DESPUÉS |
|---|---|
| sin agendar | ninguna: «Agendar» pasa a contorno |
| agendado PARA HOY | «▶ Empezar» |
| agendado otro día | ninguna: «▶ Empezar» con contorno |
| en curso | «+ Nuevo parte», donde está (opción **a**); el albarán de la cabecera pasa a contorno |
| terminado CON resto | «💰 Cobrar el resto (…)», como antes |
| terminado SIN resto | ninguna: el albarán con contorno («como mucho una» es techo, no suelo) |

- **Qué no cambia.** La escalera (`jobNextAction`), el registro de la cabecera (`jobActionsRegistry.js`) y los rótulos. Cada acción sigue en su sitio y con su ejecutor; solo cambia cuánto pesa. «Recordar pago» y los tres botones del albarán van con contorno, igual que en la tarjeta.
- **«Hoy»** lo decide `grupoDeTrabajo` (`jobsView.js`, de S4): se LLAMA sin tocarla. Es la misma regla que la tarjeta, el grupo «📅 Hoy» y la cifra «Para hoy». `jobsView.js` se carga en todo el panel antes que `jobDetailView.js` (index.html). **Declarado:** si no estuviera cargada, la ficha no rellena «▶ Empezar» (falla cerrado), y el test lo fija.
- **La rellena es `btn-primary` sin `btn-sm`.** Es la primaria de la pantalla: SCRUM-380 y SCRUM-412. Cuando el CTA no rellena, lleva la clase de sus vecinas de cabecera (`btn-secondary btn-sm job-toolbar-btn-44`, 44 px).
- ⚠️ **DECLARADO (c.22041): a 390 px, la rellena de EN CURSO queda bajo el pliegue**, en la sección Partes; la cabecera se ve sin rellena. Subir la puerta del parte al hueco de la primaria (opción **b**) queda como mejora anotada: toca el registro, la escalera y `guard:escalera-por-estado`, y no se construye hoy.
- **NO MEDIDO en yaqu.app:** «agendado otro día» y «terminado CON resto». La cuenta QA no tiene ningún trabajo así. Los fija el test en el banco de vistas.

## Pruebas

- **Rojo primero:** con el `jobDetailView.js` de main caen 5 de 7, justo los estados que cambian. Los dos que ya eran rellenas (▶ Empezar de hoy y Cobrar) pasan con las dos versiones.
- **Verde:** 7/7. El recuento de rellenas no cuenta lo que no se ve: «Consolidar seleccionados» nace con `display:none` (barra del modo selección). Un CONTROL exige que el filtro lo vea oculto, para que el «0 rellenas» no salga de un filtro ciego.
- **Vista previa en yaqu.app ANTES del merge** (misma sonda, con `LOCAL_DIR` = este árbol, solo GET): los 5 estados medidos salen como en la tabla de arriba, a 390 y 1280, con 0 errores y desborde 0. Capturas antes y después fuera de git: `sondas-s2/evid-1749-ficha/paso0-antes` y `…/despues-vista-previa`.
