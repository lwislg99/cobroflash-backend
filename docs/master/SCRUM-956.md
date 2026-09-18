# SCRUM-956 · El fichero de afirmaciones del equipo de Javier nace con contenido medido

**Fecha:** 18-sep-2026 · **Puesto:** J6 · calidad y seguridad (equipo de Javier) · **Gate:** documento del puesto
**Medido contra:** `origin/main` = `17b0c86b84fb0544013923314d250d7181d913db` · 2026-09-18T15:25:42Z
**Rama:** `scrum-956-afirmaciones-javier`

> **Obligación 0 (A4):** ninguna rama ni PR `scrum-0*956[a-z]?-` en ningún estado, y ningún commit
> de `main` con `SCRUM-956`. El control positivo sale: la misma búsqueda encuentra `908c` (#1519).

## Qué entra

`docs/equipo/afirmaciones-verificadas-javier.md` es el mecanismo de `orquestador.md` §13 para el
equipo de Javier: lo que el orquestador escribe como hecho pasa por J6, o se escribe como pregunta.
Es J6 quien lo crea, en su primera tanda (`dos-equipos.md` §3.3). Lleva las mismas tres columnas que
`afirmaciones-verificadas.md`, y **nace con filas medidas, no vacío**:

- **3 de la instalación.** `gh` sí está (re-medido). Las sesiones de fondo no alimentan el aviso de
  uso (del registro). El `statusLine` del instalador sale sin comillas, y eso lo dicen dos sondas
  independientes; está pedido a S5 como SCRUM-953.
- **4 de SCRUM-908.** Los logs del meta-guard SÍ se leen. 71 de 112 `cancelled` son el tope de 10
  minutos. El «15 de 72» mezclaba dos mudas. #1505 entró con su meta-guard en rojo.
- **La calibración del puesto**, en las dos direcciones: SCRUM-928 y SCRUM-850, arreglados; SCRUM-942
  y SCRUM-836 ②, vivos. Todo comprobado corriendo.

## Lo no tocado

Solo son dos ficheros de `docs/`. Ni `src/`, ni `public/`, ni `prisma/schema.prisma`; tampoco
`scripts/equipo/` (S5) ni `afirmaciones-verificadas.md` (S0). Ningún texto que vea el usuario.

## Error propio, cazado antes del push (A9)

**18-sep-2026 · 15:56Z · segunda sesión de J6.** Antes de la suite comprobé qué rutas del repo cita el
fichero y si están en `origin/main` (`17b0c86b84fb0544013923314d250d7181d913db`). **Población:** 13 rutas
citadas en `afirmaciones-verificadas-javier.md`. **Control positivo:** `scripts/equipo/instalar.mjs` y
`tests/scrum850-la-poblacion-del-instrumento.test.mjs` salen como presentes.

Cinco no estaban en `main`, y todas eran del mismo sitio: `docs/master/evidencias/scrum908c/` y cuatro de
sus scripts (`cancel-clasif.mjs`, `censo-meta-ci.mjs`, `logs-mudos.mjs`, `bytes-control.mjs`). Tampoco
estaba la § 908c de `SCRUM-908.md`. Todo eso vive en la rama de #1519, que está en rojo a propósito y no
va a entrar pronto. Así que el fichero habría llegado a `main` con cinco comandos «enteros y pegables»
que fallan al pegarlos: justo lo que su cabecera prohíbe. Otras dos rutas no casaron, pero eran prefijos
cortados con «…» por mi propio recuento (`tests/scrum806-`, `tests/scrum807-`), y sus rutas completas sí
están.

**Arreglo:** una nota en la sección de SCRUM-908 que dice dónde viven esos scripts y cómo se sacan de
la cabeza empujada `d0295b0d21d2d46a30cb575a1eebce43c1858a83`. Lo probé con `bytes-control.mjs` y da
los mismos 1 y 4 NUL que su fila. No he copiado el banco a esta rama: dos copias del mismo banco
serían dos anclas.
