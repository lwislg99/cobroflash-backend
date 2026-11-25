# SCRUM-1846 · un guard sin `dist/` salía con 1 («hallazgo») en vez de 2 («no supe medir»)

**Medido contra:** `origin/main` = `bdd808ebe9bae708028e8aab87c52bc7b0ee6a28` · 2026-11-25T03:01Z (hora del registro de la sesión; `gh api -i zen` no consultado)

Carril J6 (sin cerradura: `scripts/_hallazgos-y-ciegos.mjs` y los 4 guards tocados).

## Censo (población declarada)

46 `scripts/guard-*.mjs`, grafo de imports relativos (estático, `import()` literal, `require` literal) + `grep` de rutas calculadas a `dist`:

- **Llegan a `dist/` por import literal y morían con 1:** `guard-aviso-bizum`, `guard-firma-con-tramos`, `guard-vias-de-cobro` (estático, fallaba al enlazar) y `guard-objetivo-tactil` (require perezoso en `tests/_banco-vistas.mjs:1357`, S3).
- **Llegan por ruta calculada y ya salían con 2:** `guard-nif-del-gasto`, `guard-notas-en-la-ficha`, `guard-pad-de-firma-cabe` (leídos en el código, no corridos sin `dist/`).
- **De Luis, sin tocar:** `guard-detalle-trabajo-917` (S4) llega por el mismo require del banco y sigue saliendo con 1 → necesita una línea `vigilarArranque();` (el helper ya está).
- **No llegan:** 38. El envoltorio `npm run guards:visuales` (job «guards de navegador») compila antes: en CI no muerde.
- **Control:** el gancho del test lleva su marca y el test exige verla (si no quitó `dist/`, cae); en el caso 3, un error que no es de módulo sigue saliendo con 1 y sin error con 0.

## Arreglo (un sitio)

`vigilarArranque()` en `scripts/_hallazgos-y-ciegos.mjs`: `uncaughtExceptionMonitor` que, SOLO para `ERR_MODULE_NOT_FOUND`/`MODULE_NOT_FOUND`, dice qué faltó, «npm run build» y la línea de veredicto, y sale con 2. Los tres imports estáticos de `dist/` pasan a `await import(…)` después de la llamada. No cambia qué mide ningún guard (regla 41).

**Rojo primero:** con el código de hoy, `guard-aviso-bizum` salió con 1 y el caso 2 nombró los 3 estáticos. Tras el arreglo, verde.

A9: comprobación → `tests/scrum1846-arranque-sin-dist-sale-2.test.mjs`
A9: aviso → cicatriz J6 «Corrí `carriles.mjs de` sobre el test nuevo después de escribirlo, con los guards y el helper ya consultados antes: la cuarta de la familia de SCRUM-1218d» — no se pudo comprobar: ningún hook exige la consulta antes de la primera escritura

Mutaciones: catálogo → `tests/scrum1846-arranque-sin-dist-sale-2.test.mjs`

## Lo medido después (misma sesión, tras el traspaso a 155k; el orquestador subió el tope a 230k)

- **Mutaciones** con `correr` + `aplicarUna` de `scripts/meta-guard-mutaciones.mjs`, una por proceso: base 3/3 en verde. Quitar `vigilarArranque();` de `guard-vias-de-cobro` → cae el caso 1. Salir con 1 en el helper → caen el 1 y el 3. `git status` limpio después de cada una.
- **Con `dist/`** (`tsc --noCheck` en este árbol; `node_modules` es enlace al compartido, cliente de Prisma ✔, sin `generate`): los 4 guards, versión de `main` (`git show bdd808ebe…`) frente a la nueva, salida IDÉNTICA. aviso-bizum, firma-con-tramos y vias-de-cobro salen 0; objetivo-tactil sale 2 con 4 ciegos en las dos versiones (es de esta máquina, no de este cambio).
- **Sin `dist/` de verdad** (`mv dist dist.aparte`, restaurado; 7 entradas antes y después): vias-de-cobro sale 2 con «no llegó a arrancar» y «npm run build». Control: `guard-nombres-no-declarados` (no llega a `dist/`) sale 0 con y sin él, salida idéntica.
- **Verdes:** 1846, 237, 976, 700, 1294, 267, 854, 719 → 88/88 en TAP, 0 `not ok`. `npm run guards:entrada` 0. `tsc -p .` con tipos 0 (no toca `src/`). No he corrido la suite entera: el encargo la prohíbe.

## Para Luis (S4)

- `scripts/guard-detalle-trabajo-917.mjs` llega a `dist/` por el `require` perezoso de `tests/_banco-vistas.mjs:1357` y sin `dist/` sigue saliendo con 1. El arreglo es una línea: importar `vigilarArranque` de `./_hallazgos-y-ciegos.mjs` y llamarla al principio del cuerpo. Cuando entre, se añade al `GUARDS` del test.
