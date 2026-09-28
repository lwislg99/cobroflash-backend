# SCRUM-1184 · Dos módulos de albaranes sin importador: por qué, y qué hace falta con cada uno

**Medido contra:** `origin/main` = `494c0a7165d4b3e39e9b4b39d50616e32616a710` · 2026-09-27T17:56:08Z

**Escribe:** Sesión 1 (S1) · **Rama:** `scrum-1184-ventana-firma-alter` · **Carril:** S1 (servidor) con S4.

La pregunta del PASO 0 (orquestador): **¿por qué no se importan?** Tres respuestas posibles:
① pantalla que nunca llegó · ② resto de un refactor que se puede borrar · ③ necesita un ALTER.

| Módulo | Ticket de origen (`git log`) | Respuesta | Qué hace falta |
|---|---|---|---|
| `jobs/domain/albaranSerie.ts` | `c69cc54c` SCRUM-306 (C7), 6-ago | **① pantalla que nunca llegó** | ruta de lectura + pantalla + texto firmado |
| `jobs/domain/ventanaDeFirma.ts` | `e2c255ad` SCRUM-359 (H4), 11-ago | **③ ALTER**, y además **STOP de la regla 38** para cablearlo | `.sql` (en esta rama) → GO del fundador → cableado |

Ninguno es ②: los dos siguen describiendo una necesidad viva y nada los ha sustituido. **No se
propone borrar nada.**

## 1 · `albaranSerie.ts` — construido para una pantalla que no se hizo

- Su registro (`docs/master/SCRUM-306.md`, «Microcopy») lo dice: *«Nada de esto se pinta todavía:
  son módulos de dominio… El rótulo de la serie de albaranes llegará con la pantalla»*.
- **Otra pieza no hace ya lo mismo** (medido): ningún otro detector de huecos de serie en `src/` ni
  `public/` (`jobCobroHuecos.js` y `paquete.ts` son huecos de COBRO y de evidencias, otra cosa);
  ninguna vista previa del número siguiente en ninguna pantalla.
- Sus dos funciones siguen apoyadas en las piezas vivas: `formatAlbaranNumber`/`resolveAlbaranSeq`
  (`albaranNumber.service.ts`, las mismas de `allocateAlbaranNumber`).
- **Para enchufarlo:** servidor = una ruta de LECTURA (número siguiente + huecos del año, sin
  escribir nada, sin ALTER); front = dónde se enseña (al crear el albarán y/o en la serie) + texto
  del aviso firmado (regla 39). **No se construye la ruta sola**: una ruta sin pantalla sería otra
  pieza construida y sin consumir, la misma deuda con otro nombre. Va cuando se reparta el front.
- El prefijo configurable de la serie (hueco declarado en SCRUM-306) sí necesitaría columna; es
  aparte y no hace falta para lo anterior.

### 🔴 Hallazgo: el censo no ve lo que sólo consume un módulo muerto

`huecosDeLaSerie` (`invoicing/domain/huecosSerie.ts`, SCRUM-291 · A4, «detectar los huecos» de la
serie de FACTURAS) **no tiene ningún consumidor de producción**: su único importador en `src/` es
`albaranSerie.ts`, que a su vez no importa nadie (`git log -S` sobre `src/`: el único commit que
lo importa es el de SCRUM-306). El censo de SCRUM-1185 lo da por consumido porque cuenta un
importador muerto como consumidor. Es de J1 (facturas); se reporta, no se toca.

## 2 · `ventanaDeFirma.ts` — necesita columnas, y cablearlo es STOP

- Su registro (`docs/master/SCRUM-359.md` §4-§5): diff de tres columnas «PREPARADO Y PARADO»,
  y tres pasos para llegar al profesional: ① columnas · ② `encoladaEn` viaja en el `POST …/firmar`
  (hoy `colaDeFirmas.js` lo pone y no lo manda) · ③ cablear `contrastarReloj` donde se hace
  `const firmadoAt = new Date()`.
- **Medido hoy:** ninguna de las tres columnas existe en `prisma/schema.prisma` ni en `docs/sql/`.
  Nadie guarda la hora del dispositivo por otro camino.
- **Hecho en esta rama:** `docs/sql/scrum-359-ventana-de-firma.sql`, generado offline
  (`preview-migracion.mjs --desde`, control positivo OK, veredicto «aditiva»), idéntico al diff de
  §4. `prisma/schema.prisma` intacto; nada aplicado. Se suma a la cola de ALTER del equipo de Javier.
- **El paso ③ sigue siendo STOP (regla 38):** añade una escritura a los endpoints que sellan la
  firma. Va con GO explícito del fundador. El paso ② es front (S4/S2).
- ⚠️ **Hallazgo:** hoy hay **tres** caminos que sellan `firmadoAt = new Date()`, no dos:
  `albaranes.routes.ts:994`, `albaranPublic.routes.ts:431` y **`partes.routes.ts:740`** (el parte de
  trabajo, posterior a SCRUM-359, que también firma por `colaDeFirmas.js`). El `.sql` cubre sólo
  `albaranes`, que es lo que decidió el fundador; si la ventana debe valer también para el parte,
  es una decisión nueva (y otras columnas en su tabla).

## Lo que no se tocó

`prisma/schema.prisma` · los endpoints de firma · `colaDeFirmas.js` · `huecosSerie.ts` · ningún texto.

## Apéndice 28-sep-2026 · trozo 1 construido: `GET /admin/albaranes/serie` (S1, s1-28b)

Medido contra `origin/main` `a59dc1e6` (28-sep-2026 14:57Z). Decisión y firma: comentario 17342 de Jira. Se construye **solo la vista previa**; los huecos no.

- `siguienteNumeroDeAlbaran(db, merchantId, now)` en `albaranSerie.ts`. El año sale de `diaNaturalEn(now, zonaDelMerchant(m))`, las mismas dos funciones que `allocateAlbaranNumber`. Solo lee: no toma el cerrojo ni avanza el contador.
- Contrato para S2: `200 { siguiente: "AB260005" }` · `409 { error: "serie_sin_anio" }` (`AlbaranSerieSinAnioError`, sin texto) · `404` si el merchant no existe · `500`. Admin y técnico (`TECNICO_ALLOWED`, mismo criterio que el alta).
- **Un solo PR con la pantalla de S2** (trozo 3): con la ruta sola, el trinquete de SCRUM-1185 cae en `build + tests`.
- Censos: `vistaPreviaAlbaran` pasa a `retiradas`; `huecosDeAlbaranes` se queda declarada con su motivo y su condición de reapertura (bases renumeradas). SCRUM-411: el tope de módulos inalcanzables baja de 7 a 5, porque `albaranSerie.ts` y `huecosSerie.ts` pasan a estar vivos. Sus exports sin llamador de fuera se declaran, y salen las cuatro declaraciones que ahora sí se consumen (`CORTE_FORMATO_F` y tres de `albaranNumber.service.ts`).
- Test `tests/scrum1184-serie-siguiente-numero.test.mjs`: incluye el caso de Nochevieja (en Madrid, 23:30Z del 31-dic ya es el año siguiente → `AB270001`), el 409, que la ruta vaya antes de la ficha de un albarán suelto, y que la ruta no escriba nada. 5/5 en rojo contra el `dist` anterior; verde después.
