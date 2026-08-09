# SCRUM-374

**Fecha:** 9-ago-2026 · **Carril:** B · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `8037a7a30049a442eb857733832c9eca0bf99ec2` · 2026-08-09T19:51:07+02:00

## Veredicto: el defecto YA NO ESTÁ — lo arregló C5, no este ticket

`Job.direccion` **no la escribe ningún camino de producto**: su único escritor en el árbol es
`scripts/seed-video.mjs:519`, el sembrador de la demo. Y el sello de la firma metía
`obra: job.direccion` dentro del hash, así que **todos los albaranes firmados en v:1 se sellaron
con el lugar de obra vacío** — y el hash salía igual de válido, porque `null` se hashea perfectamente.

**SCRUM-300 (C5) lo cambió**: la obra sale de `Albaran.lugarEntrega` y la versión del sobre subió a
2 *precisamente por eso*. El propio código lo dice en `ALBARAN_CONTENIDO_VERSION_ACTUAL`: *«subió de
1 a 2 porque el campo `obra` CAMBIÓ DE FUENTE»*.

## Lo que se añade aquí: que no se pueda volver atrás

`tests/scrum374-direccion-sin-escritores.test.mjs` — 4 tests **en ejecución**, no por texto:

* la versión de HOY toma la obra de `Albaran.lugarEntrega`, y con ese campo vacío da `null` —
  **no cae al Trabajo por detrás**;
* **v:1 SIGUE leyendo el Trabajo**, que es lo que hace verificables los sobres viejos;
* suelo: las dos versiones dan resultados **distintos** con las mismas fuentes.

⚠️ **Un test se escribió mal primero y conviene saberlo:** decía «el sellador no puede mencionar
`job.direccion`» y salió ROJO con el código **correcto** — el sellador SÍ lo lee, y debe, porque el
despacho por versión lo necesita para recalcular un v:1. Prohibirlo habría roto los vectores
congelados de SCRUM-369. El invariante no es «no lo menciones»: es «la versión de hoy no lo usa».

## Lo que NO se vigila, y no es olvido

Que nadie ESCRIBA `Job.direccion`. El schema declara esa columna como «se llenará en la UI (tarea
futura)», así que el escritor legítimo está previsto: un guard que dispara contra el futuro previsto
es un guard que alguien apaga. (Un intento de medirlo por texto casó **lecturas** como escrituras —
`direccion: job.direccion` no escribe nada.)
