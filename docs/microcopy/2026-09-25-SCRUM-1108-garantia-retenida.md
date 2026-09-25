# Garantía retenida — el aviso de la retención de obra · SCRUM-1108

**Aprobado por el orquestador por delegación del fundador** el 25-sep-2026 — SCRUM-1108 comentario 17000.

La delegación está en `docs/equipo/limites-del-fundador.md` §«Delegación permanente», línea
«Javier, 25-sep-2026» (SCRUM-1121, PR #1769).

⚠️ **El texto de la ficha lo aprobó Javier en persona** el 25-sep-2026, por chat, poniendo
«Firmo» delante del literal. La delegación cubre el **registro** de una aprobación que ya era
suya, no la aprobación misma. Se dice porque no es lo mismo, y dentro de seis meses no se
distinguiría.

## Textos aprobados, literales

| Ranura | Texto aprobado |
|---|---|
| `garantiaRetenidaFicha` | Garantía retenida: {importe} · liberación desde el {dd/mm/aaaa} · sin cobrar |
| `digestSinPendientesConGarantia` | No tienes facturas pendientes de cobro. Tienes {importe} en garantía retenida, liberable desde el {dd/mm/aaaa}. |

## Dónde se pinta cada uno

- `garantiaRetenidaFicha` → la ficha 360 del cliente y la lista «quién me debe», sobre
  `src/modules/billing/domain/garantiasRetenidas.ts` (SCRUM-1108, PR #1765, ya en `main`).
  Propuesto por J2 tras medir que los dos mecanismos de aviso existentes no servían.
- `digestSinPendientesConGarantia` → `weeklyDigest.service.ts`.

El segundo texto lo aplica **J3**, que es el dueño del fichero según `dos-equipos.md` §3.1
—fila `auth/**`, `lifecycle.service.ts`, `weeklyDigest.service.ts`, `soporte.ts`—, ahí desde el
18-sep-2026 (SCRUM-951b). Va por **SCRUM-1116**, y consume `garantiasRetenidas.ts` de J2 como
fuente: el cálculo no se rehace.

🔴 **CORRECCIÓN — la primera versión de este registro decía que ese fichero «no aparece en la
tabla de carriles». Era FALSO**, y entró en `main` así (PR #1776). Lo escribí repitiendo lo que
me llegó sin comprobarlo: un `grep weeklyDigest` sobre `dos-equipos.md` lo habría desmentido en
un segundo. **Lo cazó J2**, que en vez de quedarse el fichero fue a la tabla y encontró al dueño
de verdad. Queda escrito porque un registro de aprobación es de los sitios donde una frase falsa
sobrevive años: nadie vuelve a él a dudar, se le cita.

## 🔴 Qué cambió, y por qué: el ✅ se quita a propósito

El literal de hoy es «✅ ¡No tienes facturas pendientes de cobro!», y se queda **igual** cuando no
hay facturas pendientes **ni** retención: ahí es cierto.

Lo que cambia es el caso en que **sí hay retención viva**. Y lo que se quita no es decorado:

**El visto verde es lo que convierte la frase en una afirmación que el profesional se cree.** Sin
él, la frase describe. Con él, certifica que no le deben nada — y con 500 € retenidos eso es
**falso**. No es que YaQu calle: es que afirma lo contrario de lo que sabe, con un símbolo de
conformidad delante.

**Quien toque esa línea después: el ✅ se retiró a propósito, no se perdió al editar.**

## Qué NO dicen, y por qué

**Ninguno de los dos tiene un verbo de reclamar.** YaQu **recuerda un dato que el profesional
metió**: no le dice que reclame, ni que tenga derecho a nada, ni cuándo ni a quién (regla 7, cero
asesoramiento). Fue una restricción de diseño desde el enunciado del ticket, no una casualidad de
redacción — y es la razón de que las dos frases sean tan escuetas.

## Lo que queda sin firmar en estas mismas pantallas

Nada más de la retención de garantía. La parte de servidor (SCRUM-1108) no pinta texto, y el
resto de la ficha 360 y de la lista «quién me debe» son literales ya existentes que este registro
no toca.
