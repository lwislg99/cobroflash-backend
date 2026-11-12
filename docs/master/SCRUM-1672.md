# SCRUM-1672 · PILOTO-1 · TRABAJOS · la ficha del trabajo no enseñaba ni el día ni la hora de la cita

**Medido contra:** `origin/main` = `09212d6fbdb3373b96f1cd89b10707e1418bdd73` · 2026-11-10T17:47:43Z

A9: comprobación → `tests/scrum1294-a9-leccion-en-a10.test.mjs`

**Skill UI:** cargada (yaqu-premium-ui) antes de tocar `public/`. Sin CSS nuevo: la línea de la cita
reutiliza la clase `detail-sub` del subtítulo (mismo cuerpo, mismo color, mismos tokens).

Puesto: S2. Rama `scrum-1672-ficha-trabajo-cita`. Fichero tocado: `public/dashboard/js/jobDetailView.js`
(carril S2; `jobsView.js`, la lista, es de S4 y NO se toca: sólo se lee como referencia del dato).

## Causa (heredada del traspaso de S2 y re-verificada en el árbol)

- `jobDetailView.js:722` (en `09212d6fb`): `sub.textContent = unirCon(' · ', nombreCliente, fechaCorta(job.createdAt), refPresupuesto)`.
  El único día de la cabecera era la fecha de ALTA, sin rótulo.
- `scheduledAt` no se pintaba en ningún sitio de la ficha (su única aparición en el fichero es un comentario).
- La lista sí lo pinta: `jobsView.js` `jobRow` (`j.scheduledAt` → `toLocaleString('es-ES', …)`).

## Arreglo

1. Una línea nueva en la cabecera, bajo el subtítulo: **«Cita: jue 12 nov, 09:00»**, sólo si el trabajo
   tiene `scheduledAt`. Sin cita no se pinta (ni vacía ni con un hueco).
2. El subtítulo rotula la fecha de alta: «{cliente} · **Abierto el 10 nov** · Presupuesto #N».

Formato: día de la semana corto + día + mes corto + hora 24 h, en la zona horaria del navegador (la misma
que la lista). El literal firmado no lleva coma tras el día de la semana («jue 12 nov»), así que se
quita la que pone `es-ES` («jue, 12 nov»). El día va sin cero delante («3 sept»), como `fechaCorta`.

⚠️ Decisión declarada: la cita se enseña **siempre que haya `scheduledAt`**, también en `en_curso`,
`terminado` y `cerrado` (el #79 medido está ya `cerrado`). La firma dice «cuando el trabajo está
agendado»; lo leo como «cuando tiene cita», que es lo que hace la lista. Si el fundador la quiere sólo en
el estado `agendado`, es una condición de una línea.

## Textos (regla 39) — FIRMADOS, no propuestos

Tanda única de PILOTO-1, SCRUM-1656 c.21405, **entradas 1 y 2** (origen: SCRUM-1658 T1 y T2):

| Nº | dónde | literal |
|---|---|---|
| 1 | Cabecera de la ficha, cuando el trabajo está agendado | «Cita: jue 12 nov, 09:00» |
| 2 | Subtítulo de la ficha, siempre | «Abierto el 10 nov» |

Firma: **SCRUM-1656 c.21408** — el fundador, literal: «si firmo todo dale que mas falta que te diga»
(localizador: transcripción del orquestador, sesión `ed676fd1-feb4-4658-bda2-01f4bf9fb3fc`, 10-nov-2026);
alcance ①: «Entradas 1-23: aprobadas TAL CUAL están escritas en c.21405». La rectificación **c.21411**
sólo retira lo que c.21408 daba por cubierto del máster y del flag de invitaciones; no toca los textos.

## Test (rojo sin el cambio, verde con él)

`tests/scrum1672-cita-en-la-ficha-del-trabajo.test.mjs` — pinta `renderJobDetailView` con el dashboard
entero (`_banco-vistas.mjs`), TZ fijada en `Europe/Madrid`, el dato del ticket (`scheduledAt
2026-11-12T08:00:00.000Z`). Control de ceguera: el título tiene que estar pintado.

- Sin el cambio (`jobDetailView.js` de `09212d6fb`): **3/3 ✖**, y el mensaje enseña el defecto tal cual:
  `Líneas de la cabecera: ["Cliente Uno · 10 nov"]`.
- Con el cambio: **3/3 ✔**.

## En yaqu.app (cuenta QA, trabajo #79, build `d4ecb38a8`, sólo GET)

Sonda `docs/master/evidencias/SCRUM-1672/verif-1672.mjs` (copia de `sondas-s2/`): «antes» = producción
tal cual; «después» = producción con `jobDetailView.js` servido desde el árbol. Testigo: el fichero
servido lleva o no `detail-cita` según el modo, o la sonda se para. Interceptor con control positivo
(un POST de mentira no sale). Población: 4 filas (2 modos × 390/1280); `noGet 0`, `err 0` en las cuatro.

| modo | ancho | líneas visibles bajo el título | «12 nov» en la página | desborda |
|---|---|---|---|---|
| antes | 390 | «Marta Prieto (PILOTO-1 QA) · 10 nov» | 0 | no |
| antes | 1280 | ídem | 0 | no |
| después | 390 | «Marta Prieto (PILOTO-1 QA) · Abierto el 10 nov» · «Cita: jue 12 nov, 09:00» (20 px cada una, x der. 343) | 1 | no |
| después | 1280 | ídem | 1 | no |

Dato del #79 en esa lectura: `status cerrado`, `scheduledAt 2026-11-12T08:00:00.000Z`, `createdAt
2026-11-10T16:49:43.046Z`. Capturas: `evidencias/SCRUM-1672/{antes,despues}-{390,1280}.png`.

Pendiente para CERRAR (regla 42): el PR en main y la misma sonda contra producción con el arreglo ya
desplegado (modo «después» sin servir nada).
