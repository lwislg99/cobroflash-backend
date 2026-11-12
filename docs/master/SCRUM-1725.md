# SCRUM-1725 — Trabajos del operario: la lista sin el estado de cobro (D1, mitad de la lista)

**Puesto:** S4 · **Rama:** `scrum-1725-lista-operario-sin-cobro` · 12-nov-2026
**Skill UI:** no cargada · sólo quita elementos por rol; ni un estilo, token, clase ni texto nuevo
**Medido contra:** `origin/main` = `8f235725590f2c984b1709a5331ff26a53f25792` · 2026-11-12T15:30:00Z
A9: comprobación → `tests/scrum1725-lista-operario-sin-cobro.test.mjs`

**Encargo:** GO del orquestador a la propuesta de S4 (D1): recorte por rol en `jobsView.js` — sin «Por cobrar», sin filtros de cobro y sin «X € de Y €» para quien no ve el cobro; cero textos; desde main, sin esperar al paquete 1662+1707. La ficha (`jobDetailView.js`) y «Qué hay que hacer» son de S2.

## Por qué (medido en yaqu.app, propuesta de 1725 §⓪)
Firmado en SCRUM-1707 c.21547 (Q1): el operario ve el importe de sus trabajos, «pero SIN la tarjeta "Por cobrar" ni los filtros de cobro del negocio». El 1707 de servidor vacía `totalCobrado` y `estadoCobro`, pero esta lista calcula «lo que falta» en el navegador: simulado el paquete sobre yaqu.app a 390, con rol técnico y sólo sus trabajos, seguían «POR COBRAR 1,21 €», «Pendiente · 0 / Parcial · 0 / Pagado · 0» y «1,21 € de 1,21 €». Con lo cobrado vacío (→ 0), en un trabajo cobrado a medias la lista diría que falta todo. Una cifra falsa.

## Qué cambia (sólo `public/dashboard/js/jobsView.js`)
- `veEstadoDeCobro(rol)`: lista blanca (`admin`), fail-closed como `puedeVerEconomia` (SCRUM-597). Va en `window` para que la ficha haga la MISMA pregunta (canon de SCRUM-831).
- Para quien no la pasa: sin la tarjeta «Por cobrar»; sin los filtros Pendiente/Parcial/Pagado (y el filtro vuelve a «todos»); sin «· X por cobrar» en la cabecera de Terminados ni su salvedad; la celda de importe, una línea con el importe (`importeReferencia`), sin «de» ni lo que falta. «Sin importe / no hay presupuesto aceptado» se queda como está.
- Para el admin no cambia nada.
- Textos: ninguno nuevo. La cabecera «✅ Terminados — cobra el resto» se queda para todos: cambiarla al operario es M1 de la propuesta, y pide firma.

## Comprobación
- Test nuevo, con la vista REAL en el banco (sin navegador): técnico y un rol desconocido (`contable`) no ven nada del cobro y sí el importe; el admin, de control positivo, lo ve todo. 3/3.
- Mutación: `veEstadoDeCobro` → `true` (el comportamiento de main) tumba los dos casos sin permiso (2 ✖); el positivo sigue verde.
- Vecinos: los 33 ficheros `tests/*.test.mjs` que nombran `jobsView`/`renderJobsView`, más el nuevo: **334/334, 0 fallos, 0 saltos**.
- En yaqu.app, tras el merge (regla 42): la sonda de la propuesta (`sonda-trabajos.mjs`, FIEL=1) sin nada local, a 390 y 1280.
