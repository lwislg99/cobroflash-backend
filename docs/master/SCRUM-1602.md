# SCRUM-1602 · Descargar datos ofrece el «Paquete del trimestre» (`GET /admin/evidencias.zip`), sólo en modo fiscal

**Medido contra:** `origin/main` = `63550e45e6e65f8461e80e4f7e8aa413d5483093` · 2026-10-27T17:45:24Z (cabecera `Date:` de GitHub)

## SCRUM-1602 · la tarjeta, sus ocho textos firmados y el aviso de trimestre vacío (27-oct-2026)

**Skill UI:** cargada (yaqu-premium-ui) antes de tocar `public/dashboard/js/exportView.js` y `public/dashboard/css/styles.css`. Sin tokens nuevos: la tarjeta reutiliza `.customers-card`, `.btn-secondary` y el estilo Label de DESIGN.md §3; sus medidas son las de la tarjeta vecina, escritas en clases porque el trinquete de SCRUM-713c no admite estilos en línea nuevos.

A9: comprobación → `tests/scrum417-descargar-datos-carga.test.mjs`

El fallo de esa A9: la primera versión enganchaba el botón con `getElementById` y un `if (!btn) return` fuera de `fiscal`, o sea, pedía un id que el marcado no declaraba. Lo cazó el banco de SCRUM-417 en la pasada dirigida (2 de 213 caían); ahora el modo se lee UNA vez (`conPaquete`) y decide el marcado y el enganche. Y otro de proceso, sin guard: leí `docs/equipo/00-normas-comunes.md` con un `Read` (713 líneas) en vez de `node scripts/equipo/norma.mjs --arranque`, que es lo que pide su cabecera.

Puesto S2. `exportView.js` es S2 (`node scripts/carriles.mjs de public/dashboard/js/exportView.js` → `dos-equipos.md:152`). Rama `scrum-1602-paquete-del-trimestre`, worktree `.claude/worktrees/s2-27oct-1602`.

### Las decisiones, leídas en su fuente

- **SCRUM-1251 comentario 20675** (decisiones y firmas del fundador, transcritas por el orquestador J): dónde = «A · Descargar datos»; quién = «Solo en modo fiscal»; vacío = «Avisar»; y los ocho textos. Los ocho de la descripción de SCRUM-1602 casan LITERAL con esa tabla. El par está en `tests/_pares-leidos-en-jira.mjs` (fila nueva, leído el 27-oct).
- **La dependencia de J1 está en main:** `X-Yaqu-Filas` en `src/modules/fiscal/evidencias/evidencias.routes.ts:41`, PR #2793 (merge `599353bf2`). Por eso el aviso de vacío SÍ va enchufado.
- La propuesta de J4 (SCRUM-1251 c.20672) se comprobó contra el código: `descargarBinario` (`api.js:444`) acepta `tipoEsperado: 'zip'` y devuelve `{ nombre, res }`; la ruta lee `year`/`quarter` (no `año`/`trimestre` como emitidas) y, sin periodo, da el trimestre EN CURSO — por eso el test fija los nombres de los parámetros.

### Qué cambia

| fichero | qué |
|---|---|
| `public/dashboard/js/exportView.js` | `TARJETA_PAQUETE_TRIMESTRE` (T1–T4) justo debajo de «Facturas emitidas», sólo si `window.appModoEmision === 'fiscal'`; el manejador pide `/admin/evidencias.zip?year=&quarter=` con el año y trimestre de la tarjeta de emitidas, pone T5 en el botón mientras prepara, y escribe T6 o el aviso de vacío; T7 en el toast de error |
| `public/dashboard/css/styles.css` | bloque `.paquete-trimestre*` al final |
| `tests/scrum1602-paquete-del-trimestre.test.mjs` | 9 casos por efecto en el banco de vistas, con 4 mutaciones declaradas |
| `tests/_pares-leidos-en-jira.mjs` | el par SCRUM-1251 / 20675 |
| `docs/master/evidencias/scrum1602/mutar-1602.mjs` | rojo contra la vista de `origin/main` + las mutaciones que declara el test |

### Tres decisiones mías, declaradas

1. **Sin selector propio.** La tarjeta usa el año y el trimestre de «Facturas emitidas» (lo que dice el ticket: «el selector de año y trimestre de la tarjeta de emitidas»). Un segundo «Año»/«Trimestre» serían rótulos que la firma no cubre. Consecuencia visible: el periodo se elige en la tarjeta de arriba, y nada en la del paquete lo dice. Si se quiere decir, es un texto nuevo y se firma.
2. **El vacío sólo si el servidor lo dice.** Sin la cabecera, `Number(null)` es 0 y la tarjeta afirmaría «No hay facturas en este periodo.» sin haberlo mirado. Sin cabecera → «Descarga lista.».
   **De paso:** la tarjeta vecina «Facturas emitidas» tenía el mismo hueco (`Number(res.headers.get('X-Yaqu-Filas'))`). Es S2 y se arregla igual, sin tocar sus textos; tiene su caso y su mutación en el mismo test. Hoy no tenía víctima (la ruta manda siempre la cabecera): es el día que deje de mandarla.
3. **Un solo texto de error, T7, también cuando la respuesta no es un ZIP.** Las demás descargas de la pantalla usan `mensajeDescargaFallida` (SCRUM-405) para ese caso, pero sus textos no están en la firma de c.20675. El fichero no se guarda en ningún caso: `descargarBinario` lanza antes de crear el enlace. El suelo de `scrum405-microcopy-descarga` (5 ramas) no se mueve.

### Medido

- **Rojo primero** (`mutar-1602.mjs`): con la `exportView.js` de `origin/main`, 9 casos → 2 ok · **7 caen** (los dos que pasan son el suelo y el de «fuera de fiscal no existe», que en main es cierto porque no existe en ningún modo).
- **Mutaciones**, cada una cae en el caso que declara y en ninguno más (9 → 8 ok · 1 cae): ① `conPaquete = true` (la tarjeta en todos los modos) · ② `Number(crudo)` sin mirar el `null` · ③ lo mismo en emitidas (`Number(crudoLibro)`) · ④ los parámetros de emitidas (`año`/`trimestre`) en la ruta del ZIP.
- **Dirigida** (22 ficheros: el nuevo + 417, 1041, 405 ×2, 713c, 666b, 644, 921c, 1502h, 755, 714, 384, 356, 244, 455, 451, 402, 289b, 274, 1040, public-js-parsea): **213 de 213**, 0 caen, 0 saltos, `dist` con `tsc --noCheck`.

### Lo que NO se ha podido ver

- **En yaqu.app no se puede ver, y es lo correcto:** la tarjeta sólo se pinta con `modoEmision = 'fiscal'`, y en España nadie está en ese modo antes de SIF-1 (regla 24; `INVOICING_ES_ENABLED` en OFF). Ninguna cuenta de prueba la enseña. No lo he intentado en producción: no hay forma de llegar sin cambiar un flag, y eso es STOP.
- El contenido del ZIP con facturas reales no lo he descargado: es de J1 y tiene sus tests (`scrum297-*`, `scrum1252-*`, `scrum1251b-*`).
