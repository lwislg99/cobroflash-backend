# SCRUM-1061 · Las fotos de los Trabajos dentro del historial del cliente

**Medido contra:** `origin/main` = `80dfff3c0f19f21ede703740c7d34a7a16aa884d` · 2026-09-22T09:52:10Z (hora de GitHub, cabecera `Date:` de `gh api -i zen`).
**Rama:** `scrum-1061-fotos-en-historial`.
**Microcopy:** ✅ **textos firmados** por el orquestador por delegación del fundador (22-sep-2026, comentario de Jira en SCRUM-1061): `alt` de cada miniatura «Foto del trabajo»; indicador de sobrantes «+{n} más»; su `aria-label` «{n} fotos más».

## Paso 0 y dependencia

SCRUM-1060 (medición de peso/carga en staging) ya entregado (PR #1641): **3 fotos como máximo, sin miniatura de servidor** — la sirve la ruta ya existente `GET /admin/attachments/:id` (bytes completos, con su propio check de `merchantId`). Ese es el número (`MINIATURAS_POR_TRABAJO`) que usa este ticket.

## Lo que cambia

| fichero | qué |
|---|---|
| `src/modules/system/domain/historialDelCliente.ts` | El conteo de fotos por albarán pasa de `groupBy`+`_count` a `findMany` de `{id, entityId}` (mismo `merchantId` en la consulta, regla 2) — hacen falta los IDS para las miniaturas, no solo el número. Se mantiene `albaranes[].fotos` como el CONTEO de siempre (ningún consumidor existente se rompe). Se añade `trabajos[].fotos = {ids, total}` — agregado de TODAS las fotos de TODOS los albaranes del trabajo (no de uno solo), más recientes primero, `ids` capado a 3 y `total` sin capar (para el «+n más»). Ausente ≠ vacío: sin ninguna foto, la clave `fotos` NO viaja. |
| `public/dashboard/js/customerDetailView.js` | La columna «Documentos» del historial gana un bloque `.historial-fotos-mini` bajo los badges de siempre: hasta 3 `<a target="_blank"><img loading="lazy"></a>` apuntando a `/admin/attachments/:id` (sin ruta nueva), y el indicador «+n más» cuando `total > ids.length`. Una foto que falla al cargar se oculta (`img.onerror` → `img.hidden = true`), no deja el icono roto. |
| `public/dashboard/css/styles.css` | `.historial-fotos-mini`/`.historial-foto-mini`/`.historial-fotos-mas` — miniatura de 44×44 (AB6; es un enlace, así que cuenta), `object-fit:cover`. Nada por `style.cssText` desde JS (regla 4 / SCRUM-713c). |
| `tests/scrum980-historial-del-cliente.test.mjs` (ampliado, gateado — no corre local sin Postgres desechable) | El trabajo con albarán pasa de 3 a 5 fotos (para distinguir tope de total): `caldera.fotos.total === 5`, `caldera.fotos.ids` son las 3 MÁS RECIENTES, y un trabajo sin fotos no lleva la clave `fotos`. |
| `tests/scrum1061-fotos-en-historial.test.mjs` (nuevo, 5 pruebas, banco de vistas) | Con fotos: pinta hasta 3 miniaturas con su `href`/`alt`, y el «+n más» con la cifra y el aria-label correctos. Exactamente 3 de 3: sin «+n más». Sin fotos: sin bloque. Fallo de carga: la foto se oculta. |

## Por qué NO se tocó el almacenamiento ni las rutas de servido (como pide el ticket)

`GET /admin/attachments/:id` ya sirve el binario con su propio `where: { id, merchantId: req.merchantId }` — un intento de ver la foto de otro merchant ya da 404 hoy, sin cambiar nada aquí. Lo único nuevo es que el historial devuelve los IDS (que ya podía contar) en vez de solo el número.

## Verificado en rojo

Mutación real: cambié el texto de sobrante de «+n más» a «+n fotos» → cae el test que fija el literal firmado; restaurado, vuelve a verde. `guards:entrada`/`guards:visuales`/build: ver el pie de este expediente tras correrlos.

## Límite declarado

La mitad de servidor (agregación por trabajo, tope, orden) solo se verificó por el test GATEADO (Postgres desechable no disponible en este árbol): queda para el CI del PR, que sí lo levanta.

## Pendiente

Verificar en yaqu.app: un cliente con un Trabajo de más de 3 fotos, comprobar las miniaturas, el «+n más» y que abren la foto en una pestaña nueva.
