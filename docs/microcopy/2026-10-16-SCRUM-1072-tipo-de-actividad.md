# Configuración: el tipo de actividad, junto a la retención de IRPF

**Aprobado por el orquestador por delegación del fundador** el 16-oct-2026 — SCRUM-1072 comentario 19859.

La delegación de microcopy es la permanente de `docs/equipo/limites-del-fundador.md`. La firma es del
ORQUESTADOR, no del fundador. Firma estos cuatro literales y nada más.

## Texto aprobado, literal

El enunciado, encima de las opciones:

> ¿Qué tipo de actividad tienes?

Las tres opciones:

> Profesional

> Empresarial

> No lo sé

## 🔴 El límite de esta firma (del comentario 19859, y viaja con ella)

Son RÓTULOS, no un criterio fiscal. «Profesional» frente a «empresarial» es una distinción fiscal real en
España que decide si aplica retención de IRPF. Se firmaron porque hoy el campo solo se GUARDA y ningún
fichero de `src` lo lee (`tests/scrum1072-actividad-se-guarda.test.mjs` ⑥). **El día que algo DECIDA una
retención a partir de este campo, la clasificación necesita al ASESOR, no esta firma.**

## Lo que NO está aprobado

- **La ayuda de «No lo sé»** («pregúntaselo a tu asesor», en el ticket). No es microcopy: orienta sobre un
  asunto fiscal. Va a SCRUM-1264. La pantalla no la necesita: `no_lo_se` guardado ya es la respuesta.

## Dónde se pinta

- Todavía en ningún sitio. La pantalla es `public/dashboard/js/settingsView.js` (contenedor de J3), junto
  a «Retención de IRPF», y la pinta S2. Los valores que viajan al servidor son `profesional`,
  `empresarial`, `no_lo_se` y `null` (no consta), en `merchantProfileUpdateSchema.activityKind`.
