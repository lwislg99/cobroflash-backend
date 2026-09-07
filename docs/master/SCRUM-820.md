# SCRUM-820 · los estados del presupuesto, en castellano y dichos igual en todas partes

**Medido contra:** `origin/main` = `f2d1589041d04e5f465cc4deba010f5563ffea72` · 2026-09-07T17:56:11+02:00
**Medido en:** host `DESKTOP-T5MONF5` · rama `scrum-820-estados-en-castellano`
**Carril:** front / microcopy de estados

## La víctima

El fontanero que abre Presupuestos y lee **DRAFT, SENT, ACCEPTED, REJECTED**. Y la app
contradiciéndose: el MISMO presupuesto salía «Aceptado» en Inicio y ACCEPTED en la lista.

## PASO 0 · los mapas eran CINCO, no tres

El encargo hablaba de tres. Medido:

| # | dónde | qué traduce | cómo lo encontré |
|---|---|---|---|
| 1 | `customerDetailView.js:224` | 8 claves + mapa de clases | leyendo |
| 2 | `globalSearch.js:5` | 7 claves | leyendo |
| 3 | `homeView.js:520` | **4** claves, con `\|\| item.status` | leyendo |
| 4 | `api.js:1110` `invoiceStatusMeta` | el de FACTURAS, patrón `{label, pillClass}` | leyendo |
| 5 | `teamView.js:349` | 8 claves | 🔴 **lo encontró el guard**, no una lectura |

**El quinto no lo contaba nadie.** Salió cuando el censo del guard nuevo se puso rojo solo.

### Los sitios que vuelcan el identificador crudo — **5**, y el suelo pedía ≥4

`quotesListView.js:168` (`st.toUpperCase()`) · `api.js:1118` · `customerDetailView.js:253` y `:280`
(`|| q.status`, `|| inv.status`) · `homeView.js:522` (`|| item.status`).

## El control que decide: Inicio ↔ lista, los seis estados

Las dos pantallas **pintadas** con el mismo dato, el mismo instrumento en los dos lados.

### ANTES — discrepan **6 de 6**

| estado | LISTA | INICIO |
|---|---|---|
| draft | `DRAFT` | Borrador |
| sent | `SENT` | Enviado |
| accepted | `ACCEPTED` | Aceptado |
| rejected | `REJECTED` | Rechazado |
| expired | CADUCADO | `expired` |
| pending_approval | PENDIENTE APROBACIÓN | `pending_approval` |

🔴 **Hallazgo:** el ticket decía que la lista era la que fallaba. **Inicio también volcaba crudo**
en dos estados —`● expired`, `● pending_approval`— porque su mapa tenía cuatro claves de seis.

### DESPUÉS — discrepan **0 de 6**

| estado | LISTA | INICIO |
|---|---|---|
| draft · sent · accepted · rejected | Borrador · Enviado · Aceptado · Rechazado | ídem |
| expired | Caducado | Caducado |
| pending_approval | Pendiente de aprobación | Pendiente de aprobación |

## El arreglo: una sola copia, no un mapa nuevo

`quoteStatusMeta` en `api.js`, con el patrón que la casa ya usa (`invoiceStatusMeta`,
`cobroPillClass`, `jobStatusMeta`): `{label, pillClass}`. Es el diccionario que ya existía en
`customerDetailView`, traído al sitio donde viven los demás. La lista y Inicio leen de ella.

**Los literales son los de producción, sin cambiar una letra** (regla 30). Donde dos copias
discrepaban:

- `expired` → **«Caducado»** (masculino, el del presupuesto) y no «Caducada», que es el de la factura.
- `pending_approval` → **«Pendiente de aprobación»**, y aquí está la contradicción más fina de
  todas: **la propia lista ya usaba ese literal en su filtro** (`quotesListView.js:73`) mientras su
  píldora respondía «PENDIENTE APROBACIÓN». Se filtraba por una cosa y se leía otra, en la misma
  pantalla. Manda el del filtro, por el criterio de SCRUM-727: *el jefe filtra por lo que ve escrito*.

## El control negativo: lo desconocido no se vuelca crudo

Corrido en navegador con un estado que no existe (`pending_signature_v2`): la lista pinta **«—»**
y ni la lista ni Inicio meten el identificador en el HTML.

⚠️ **Y respeta la lección de SCRUM-153**, que decía lo contrario a medias: lo desconocido no puede
disfrazarse del más inocente. Sigue sin disfrazarse —no cae a «Aceptado» ni a «Pendiente»— pero
tampoco se le escupe un código de base de datos a un profesional. El guion es el respaldo que ese
mismo fichero ya usaba. **El rótulo definitivo está sin firmar y va propuesto abajo.**

## El guard

`tests/scrum820-estados-en-castellano.test.mjs`, 7 tests. No vigila «que haya traducción»: vigila
que haya **UNA SOLA** y que las pantallas lean de ella — un guard que sólo comprobara los seis
rótulos pasaría en verde el día que alguien escriba la sexta copia, que es como llegamos aquí.

**Los dos rojos, corridos:** una copia nueva del diccionario en otra vista → cae; el respaldo
volviendo a `toUpperCase()` del identificador → cae. Restaurado, vuelve el verde.

**Suelos:** si no encuentra la pieza, ciego; si el censo de copias baja de tres, ciego —
«no he mirado» no es «están limpias».

## 🖊️ Lo que necesita tu firma (no he inventado nada)

1. **`pending_approval` tiene TRES formas vivas** y he tomado la del filtro. Firma una:
   - «Pendiente de aprobación» — filtro de la lista, `quotesView`, `teamView` *(la aplicada)*
   - «PENDIENTE APROBACIÓN» — `quotesDetailView.js:185`
   - «Pend. aprob.» — `customerDetailView.js:224`
2. **Qué poner cuando el estado no se reconoce.** Hoy va un «—». Propuesta: *«Estado desconocido»*.
3. **`quotesView.js:4088` pinta `"DRAFT"` literal** en el previo del documento. Otro carril, reportado.

## Hallazgos abiertos (regla 37)

- `customerDetailView.js`, `globalSearch.js` y `teamView.js` siguen con su copia: **mezclan estados
  de presupuesto con estados de FACTURA** (`paid`, `pending`) y separarlos es otro ticket. Quedan
  **censados**: no pueden crecer sin que alguien lo afirme.
- Sigue en pie el hueco declarado en SCRUM-722: el censo de marcadores no mira los modales que se
  abren con un clic.
