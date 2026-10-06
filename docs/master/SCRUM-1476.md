# SCRUM-1476 · Los tres títulos de pestaña de la página pública salen enteros del locale

**Medido contra:** `origin/main` = `8dcc6d2ad6cab55e9b550220868b12adc82eb40e` · 2026-10-06T13:15:16Z

A9: aviso → cicatriz S1 «La hora de un mensaje o de un ticket se saca de GitHub en el momento de escribirla: calculada desde la última que miré, se adelanta.» — no se pudo comprobar: es una cifra tecleada en un mensaje a otra sesión o en Jira, y ningún guard los lee

Sesión S1 (`s1-6octd`) · rama `scrum-1476-titulos-de-la-pagina-del-locale`. Encargo del orquestador.

## El defecto

La página pública de un presupuesto que ya no se puede firmar titulaba la pestaña con la palabra
del documento más un participio fijo en femenino (`quoteDecisionLanding.routes.ts`):

| Estado | Se componía | En España se leía |
|---|---|---|
| caducado | `${locale.quote} caducada` | «Presupuesto caducada» |
| ya aceptado | `${locale.quote} ya aceptada` | «Presupuesto ya aceptada» |
| rechazado | `${locale.quote} rechazada` | «Presupuesto rechazada» |

Lo lee el cliente final. `renderPage(title, …)` pone ese texto en `<title>` y en ningún otro sitio.
El de «ya aceptada» lo había ejecutado la sesión anterior (SCRUM-1445, c.18380); los otros dos se
vieron al escribir el test: los tres salieron en rojo con ese texto antes de tocar `src/`.

## El arreglo

La frase entera viene del locale (`src/core/i18n/locales.ts`): tres campos nuevos,
`quoteExpiredTitle`, `quoteAcceptedTitle` y `quoteRejectedTitle`, escritos completos para cada uno
de los seis países. La ruta los lee tal cual. No se pega otra terminación: la palabra del documento
cambia de género por país, y una frase de palabra + participio se rompe en la mitad de ellos (regla
de SCRUM-1443).

| | ES, AR | MX, CO, PE, CL |
|---|---|---|
| caducado | «Presupuesto caducado» | «Cotización caducada» |
| ya aceptado | «Presupuesto ya aceptado» | «Cotización ya aceptada» |
| rechazado | «Presupuesto rechazado» | «Cotización rechazada» |

En los países de «Cotización» el texto queda como estaba. En España y Argentina cambia una letra en
cada título.

`getLocaleJson` (lo que recibe el panel) no lleva los campos nuevos: la página pública se pinta en
el servidor y el panel no los usa. `tests/locales.test.mjs` no se ha tocado.

## Test — `tests/scrum1476-titulos-de-la-pagina-del-locale.test.mjs` (7 casos)

Por la ruta real de `dist/`, con el presupuesto doblado (el arnés de `scrum1444`). Un suelo comprueba
que cada caso llega a SU página y no al formulario de firma.

En rojo antes de tocar `src/`: 7 casos, 5 rojos (verdes el suelo y México, que no cambia). Después,
26 ficheros (los que nombran la ruta o el locale, más `scrum409`, `scrum1344` y `scrum1415`):
**225 de 225**. **No corrida la tanda entera** (1.347 MB libres al medir, por debajo del umbral).

| Mutante (sobre `dist`; BASE 7/7; comprobado que la sustitución se aplica y que se restaura idéntico) | Rojos |
|---|---|
| el título de aceptado vuelve a componerse | 2 |
| el título de caducado vuelve a componerse | 2 |
| el título de rechazado vuelve a componerse | 2 |
| el locale de España vuelve al femenino en aceptado | 2 |
| la ruta cruza los campos de caducado y rechazado | 3 |

## Lo que NO está hecho

- **No visto en yaqu.app** (aceptación 5): se mira cuando despliegue, con un presupuesto aceptado de
  la cuenta QA.
- **Las otras frases de la página que concuerdan con el documento**, que en España se leen bien y
  fallarían con «la cotización»: «este presupuesto» (cinco sitios), «el presupuesto … pide uno
  actualizado», «¿me lo reenvías?», y los dos sitios que deducen el género de cómo acaba la palabra
  (`qg` y `delDeLa`). Nombradas en el ticket, sin tocar: cada una pide su literal firmado por país y
  hoy no hay negocios fuera de España.
