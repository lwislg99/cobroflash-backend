# SCRUM-1251 · El `evidencias.zip` no lo ofrece ninguna pantalla: desde dónde se descarga (PROPUESTA)

**Fecha:** 23-oct-2026 · **Carril:** el ticket es `area-j1`; este tramo lo escribe **J4** (`jv-j4x`) por encargo
del orquestador `cobroflash-backend-62`. J4 no construye: mide y propone. Solo toca este expediente y su banco.
**Medido contra:** `origin/main` = `2c45bf589aeae007eb12ed388b3e0f4d2d8d98ed` · 2026-10-23T20:56:09Z (cabecera `Date:` de GitHub)
**Entrega en Jira:** SCRUM-1251 c.20672 (ahí están la propuesta y el cuestionario completos; aquí, lo medido y cómo).
**Identidad:** el hook de arranque dijo «SIN IDENTIDAD» (S5, SCRUM-1498). Seguí, como dice la ficha del orquestador.

## Lo medido

| pregunta | resultado | cómo |
|---|---|---|
| ¿alguna pantalla llama a la ruta? | **0** | `git grep "evidencias.zip" origin/main -- public`. Control positivo con la misma orden: `libros/recibidas.csv` → 3 en `facturasRecibidasView.js` |
| ¿qué dicen de «evidencias» las 12 líneas de `public/`? | 12 comentarios, 0 llamadas | `git grep -n evidencias origin/main -- public`, leídas una a una (corrección abajo) |
| montaje y gates | `src/app.ts:608`, `requireRole('admin')`; **ni flag ni país** | lectura |
| qué lleva el ZIP | **7 ficheros**, ejecutado | sonda de abajo |
| trimestre vacío | sale el ZIP entero, con un solo aviso (el de los albaranes) y **sin recuento en la respuesta** | la misma sonda, merchant sin facturas |
| dependencia SCRUM-1232/1252 | cumplida en el código (`AVISO_LIBRO_SOLO_FACTURAS`, `paquete.ts`) | lectura; **el estado de 1232 en Jira no lo volví a mirar** |
| de quién es cada pantalla | `exportView.js` y `reportsView.js` → **S2** · `settingsSubmenus.js` → J3 | `node scripts/carriles.mjs de …` |
| qué dice el máster | no nombra `evidencias.zip` (0 en `YAQU_MASTER.md`). R13 pide otro paquete (XML RRSIF + PDF + declaración responsable) | grep |

**La sonda** — `docs/master/evidencias/SCRUM-1251/sonda-zip.cjs` y su salida, `salida-sonda.txt`:
- **Qué ejecuta:** el lector real, `leerPaqueteEvidencias`, con un prisma falso (Proxy) y un merchant fabricado (id 777) sin filas, para el 3T de 2026.
- **Contra qué:** un `dist/` sacado con `tsc --noCheck` fuera del árbol.
- **Control positivo:** los 7 nombres de `FICHEROS` tienen que salir todos, y salen.
- **Llamadas que hizo a la base:** `merchant.findUnique invoice.findMany albaran.findMany expense.findMany`.
- ⚠️ **Lo que no ejecutó:** el ZIP con facturas y albaranes reales. Eso lo cubren los tests con base de `scrum297-*`, que **no corrí**.

**Corrección mía, ya publicada mal en Jira (c.20672):** escribí que las 12 líneas eran «comentarios con rutas a
`docs/master/evidencias/…`». **Diez lo son. Dos son prosa sin ruta:**
- `api.js:25`: «un ZIP de evidencias y un listado de cobros…».
- `settingsSubmenus.js:336`: «la firma, las evidencias…».

La conclusión no cambia: ninguna de las 12 es una llamada.

## Propuesta (sin elegir) — el detalle, en c.20672

| sitio | pantalla | carril | qué cuesta | lo que juega en contra |
|---|---|---|---|---|
| **A** | tarjeta nueva en «Descargar datos» | S2 | ~40-60 líneas + test de que se llega | cruza de equipo |
| **B** | botón junto a «IVA repercutido · modelo 303» en Informes | S2 | el selector de trimestre ya existe | Informes trata de la rentabilidad |
| **C** | dentro de SCRUM-322 | — | hoy, nada | 322 está parado (c.13273): el ZIP sigue sin poder alcanzarse |

**Textos T1-T7, propuestos y SIN FIRMAR (regla 39):**
- **T2 roza un claim** («resumen de IVA»).
- **T4-T7 ya están en `exportView.js`.** Que estén allí no acredita que nadie los firmara para esto.
- **Términos excluidos:** VeriFactu, Hacienda, AEAT, libro registro, modelo 303, cumplimiento, demuestra, inspección.

**Cuestionario:**
- **P1** · desde dónde.
- **P2** · en qué modo se enseña. Aquí entra un aviso: dentro del ZIP, los nombres `libro-registro.csv` y `modelo-303.csv` son rótulos que el profesional ve.
- **P3** · qué hacer con el trimestre vacío. La opción (ii) toca `evidencias.routes.ts`, y eso lo decide un jefe.
- **P4** · la firma de T1-T7.
- **P5** · si sale A o B: ticket para S2 o excepción declarada.

## Lo que NO se hizo

- Ni una línea de `src/` ni de `public/`.
- No se tocó el generador.
- No se cambió el estado del ticket (A13).

A9: aviso → cicatriz J4 «escribí en Jira que las 12 líneas con la palabra evidencias de public/ eran comentarios con rutas a docs/master/evidencias, y dos eran prosa sin ruta» — no se pudo comprobar: la clasificación la hice a ojo sobre la salida de un grep de un solo uso, y ninguna herramienta compara una frase de un comentario de Jira con las filas que dice resumir; lo cazó releer el comentario publicado contra la salida.
