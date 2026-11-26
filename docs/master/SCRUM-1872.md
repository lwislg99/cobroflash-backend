# SCRUM-1872 · el borde del trimestre, probado por el camino real
**Medido contra:** `origin/main` = `f336e00c20b23a7fa11ae491c8cf8bfaa931fd6d` · 2026-11-26T17:17:02Z

Carril J1 (jv-j1ky). Solo `tests/` y este registro: nada en `src/`, ni esquema, ni `src/modules/fiscal/verifactu/` (reglas 38/40).

**Lo que ya estaba hecho (SCRUM-1445, `docs/master/SCRUM-1445.md`):** 1445d dio a `rangoTrimestre` el parámetro `zona` (`src/modules/fiscal/modelo303/modelo303.ts:209`), y 1445f hizo que los lectores de J1 se la pasen. 1445f dejó escrito que el `DEFECTO_CONOCIDO` ② de `scrum1055b` seguía declarado sin mirar.

**Lo que medí (punto 1), con `git grep` de `rangoTrimestre(` y `leerLibroRegistro(` en `src/` sobre el sha del ancla:** los tres lectores que leen el libro con el criterio de caja del merchant sacan la zona de `zonaDelMerchantParaElLibro` y se la pasan a `rangoTrimestre` y a `leerLibroRegistro`. Son `src/modules/fiscal/modelo303/modelo303.repo.ts:19-27` (el 303, con `devengo: true`), `src/modules/fiscal/librosAeat/librosAeat.repo.ts:44-51` y `src/modules/fiscal/evidencias/paquete.repo.ts:37-50`. `GET /admin/libro-registro` (`src/modules/invoicing/app/routes/libroRegistro.routes.ts:32`) no usa ni trimestre ni caja: toma el rango del query. Los dos únicos que llaman sin zona son `src/modules/reports/app/routes/reports.routes.ts:274` y `:368` (carril S1, sin criterio de caja). **No hay defecto en el producto de J1**, así que no hay rojo que ver ni nada que arreglar en `src/`.

**De paso, un error mío que el propio test cazó:** di por hecho que el libro de expedidas devengaba por cobro. No es así: corta por la fecha de expedición (no lleva `devengo`, RIVA 63), y una factura emitida en dic-2025 no sale nunca en él. El estado CIEGO del test nuevo lo dijo en la primera pasada (`libro de expedidas … → T[]`). El libro de caja real es el 303.

**El test** (`tests/scrum1055b-caja-31mar-zona-y-devolucion.test.mjs`): `bordeEnZonaDelProceso` pasa a `declarado: false`. ② mide ahora por `leerModelo303` (el borde del cobro, con criterio de caja) y por `leerLibroExpedidasDelTrimestre` (el mismo borde, por emisión). La zona y el criterio salen de la fila del merchant, y el proceso corre en `UTC`, `Europe/Madrid` y `Atlantic/Canary`. El proceso se fija en `UTC` antes de cargar `dist/`, con el patrón de `scrum1445d`, y cada cambio de zona comprueba que el proceso la VE. Resultado: el 1-abr 00:30 de Madrid (`2026-03-31T22:30Z`) cae en el T2 en las 6 lecturas. Controles: el 31-mar 23:30 de Madrid cae en el T1; el mismo instante con el merchant en Canarias cae en el T1, así que manda la zona del merchant y no una fija; el defecto sembrado (el respaldo sin zona) sale DEFECTO; un instante de dic-2025 o la falta de lectores sale CIEGO, y lo no esperado sale OTRO. ① y ③ siguen leyendo por `porTrimestre` sin zona: ninguno de los dos toca un borde. Resultado: **11/11** (`node --test` del fichero).

Mutaciones: catálogo → `tests/scrum1055b-caja-31mar-zona-y-devolucion.test.mjs`

Con `correr` + `aplicarUna` de `scripts/meta-guard-mutaciones.mjs`: la base dio 11 pasados, 0 caídos y 0 saltados, y **las 5 declaraciones tumban su test**. Tres son nuevas: volver a `declarado: true`, quitar la zona en `librosAeat.repo.ts` y quitarla en `modelo303.repo.ts`. Las otras dos (① y ③) ya estaban. Después, `git status`: solo el test.

**Verdes, con población:** el build con tipos (`npm run build`) salió 0. 7 ficheros, 58 casos, 58 pasan, 0 caídos y 0 saltados: `scrum1055b`, `scrum1445d`, `scrum237`, `scrum700`, `scrum824`, `scrum419` y `scrum976`. `scrum1294` y `scrum267` se corren sobre este registro antes de empujar.

**NO corrido:** la suite entera por tramos, `scrum854` y `npm run censo:mudez` (no hay fichero de test nuevo). Lo corre el orquestador, porque esta sesión llegó a 195k de contexto antes del primer empujón.

**Pendiente, de S1 y no de J:** `reports.routes.ts:274` y `:368` siguen sin pasar la zona (SCRUM-1835, Luis). Hasta entonces, el respaldo «sin zona» de `rangoTrimestre` (`modelo303.ts:214-219`) **no se toca**. Cuando S1 lo pase, se queda sin llamadores y se puede quitar (1445d).

A9: comprobación → `tests/scrum1055b-caja-31mar-zona-y-devolucion.test.mjs`
