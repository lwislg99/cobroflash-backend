# SCRUM-1697 · PARTES · «Visita {n} de {m}» en la cabecera del parte (PILOTO-1)

**Medido contra:** `origin/main` = `ba6fe36b628f4c97dede14d18270ccc84cd4316b` · 2026-11-11T18:16:32Z

**Skill UI:** cargada (`yaqu-premium-ui`), **después** de escribir el cambio y antes de cerrarlo: se
revisó contra AB6 al cargarla. Sin componente, clase, token ni estilo nuevos (un `<span>` dentro del
`h3` del número, que hereda su estilo). Capturas antes/después a 390 abajo.

A9: comprobación → `tests/scrum1697-visita-n-de-m.test.mjs`

## Origen y firma

T4 de la ③ de SCRUM-1686 (D2 firmada, c.21461). **Regla:** M2 del máster, entrada por `073c67ade`
(#3066, GO c.21479): un trabajo, varios partes, uno por visita; «la visita ES su parte». «Visita {n}
de {m}» cuenta los partes del trabajo por `fecha` y, a igual fecha, por `numero`; `m` = todos los
partes del trabajo, también los borradores. **Texto FIRMADO:** N4 de la tanda N1-N13 de SCRUM-1686
(c.21471 según el máster), «Visita {n} de {m}», en la cabecera del parte, con varios en el trabajo.

## Qué cambia

`public/dashboard/js/parteDetailView.js` (carril S4):

- `TEXTOS.visitaDeLas = 'Visita {n} de {m}'` (N4, literal).
- `visitaDelParte(parteId, partes)`: ordena por fecha y número y devuelve `{ n, m }`; `null` con menos
  de dos partes (N4 es «con varios») o si el parte no está en la lista.
- `pintarVisita(contenedor, parte, pedir)`: lee `GET /admin/jobs/:jobId` (trae `partes[]` desde
  SCRUM-1671, también para el técnico: `TECNICO_ALLOWED`, «Detalle de SU trabajo») y pone
  «· Visita n de m» tras el número, en el mismo `h3`. **Falla cerrado:** sin trabajo, sin lista o con
  la lectura caída, la cabecera se queda sin número. No se espera: el parte se puede usar ya.
- El separador «·» es el de la maqueta firmada en SCRUM-1686 («PT-2026-005 · Visita 2 de 3»).

## Comprobación

- Rojo primero: 5/5 en rojo antes del cambio, 5/5 en verde después.
- yaqu.app con la cuenta QA, `parteDetailView.js` servido desde el árbol
  (`evidencias/SCRUM-1697/capturar.mjs`, sólo lectura). Trabajo #77, con dos partes:
  - antes: `PT-2026-006` · `antes-pt006-390.png`
  - después: `PT-2026-006 · Visita 2 de 2` (`despues-pt006-390.png`) y `PT-2026-004 · Visita 1 de 2`
    (`despues-pt004-390.png`). Cabe en una línea a 390.

## Pendiente

- Verlo en yaqu.app tras el merge (regla 42), en los dos partes del trabajo #77.
