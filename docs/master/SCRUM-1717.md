# SCRUM-1717 · mitad S1 · `/admin/me` manda el motivo sin emisión (`motivoSinEmision`)

**Medido contra:** `origin/main` = `5203048057ac173083b036a214043a6a3debf356` · 2026-11-12T12:32:50Z

A9: comprobación → `tests/scrum1717-me-manda-el-motivo-sin-emision.test.mjs`

Puesto S1 (equipo Luis), 12-nov-2026. Ticket abierto por el orquestador del equipo de Javier; reparto en
c.21654: S1 el motivo en `/me`, S2 el aviso en Inicio/barra con los dos literales firmados.

## Origen y decisión

Con `INVOICING_ES_ENABLED` puesto y el SII en «Sí» o «No consta», M (SCRUM-1585) deja al profesional en
`receipt`, y `/admin/me` no decía por qué: el navegador no podía distinguirlo del flag apagado. Decisión
del fundador en SCRUM-1713 c.21583 (el aviso en Inicio o en la barra); líneas exactas de J1 en c.21586:
«S1: `/me` (`src/app.ts`) devuelve el motivo (`motivoSinEmision`: `sii_declarado` / `sii_no_consta` / nada)».

## Qué cambia

`src/app.ts` (contenedor S1), bloque de `GET /admin/me`:

- Nuevo campo `motivoSinEmision: motivoSiiSinEmision(merchantParaModo)` → `'sii_declarado'` ·
  `'sii_no_consta'` · `null`. Mismo objeto (`merchantParaModo`, que ya trae `llevaLibrosPorSii` desde
  SCRUM-1594) y misma función que el modo de emisión: el navegador recibe el veredicto, no la regla.
- Sin texto. Los dos literales (SCRUM-1585 c.20539) los pinta S2.

## Cómo se midió

- `tests/scrum1717-me-manda-el-motivo-sin-emision.test.mjs`: la app real por HTTP (`_banco-camino-real.mjs`),
  con un doble de `merchant.findUnique` que HONRA el `select`. Rojo primero: 5 de 6 caían con «/admin/me
  no manda `motivoSinEmision`». Verde: 6/6. Casos: «Sí» → `sii_declarado` (modo `receipt`), «No consta» →
  `sii_no_consta`, control «No» → `null` con modo `fiscal`, flag apagado → `null` con los tres valores del
  SII, fuera de España → `null`.
- Mutaciones sobre `dist/app.js` (bytes restaurados, hash comprobado): el campo a `null` → caen 2; quitar
  `llevaLibrosPorSii` del `select` → caen 2.
- Los 166 ficheros de `tests/` que nombran `/admin/me`, `app.ts` o `motivoSiiSinEmision`, con un banco
  Postgres desechable propio (`LIBRO_PG_URL`, loopback, `*_test`) para los gateados: 1232/1232, 0 saltados.

## Sin medir

- yaqu.app: verlo allí exige encender el flag a un merchant real (regla 24). El campo con el flag apagado
  (`null`) sí se puede ver en `/admin/me` en cuanto se despliegue.

## SCRUM-1717b · mitad S2 · el aviso del SII en Inicio (los dos literales firmados)

**Medido contra:** `origin/main` = `8f235725590f2c984b1709a5331ff26a53f25792` · 2026-11-12T15:43:23Z

A9: comprobación → `tests/scrum1717-aviso-sii-en-inicio.test.mjs`

**Skill UI:** cargada

Puesto S2 (equipo Luis), 12-nov-2026 (18.ª sesión). Rama `scrum-1717-aviso-sii-inicio`.

### Firma que lo cubre
- Literales Y colocación en Inicio: **SCRUM-1717 c.21705** (fundador, Luis), «firmo lo que dices», sobre
  el mensaje del orquestador con los dos literales completos de SCRUM-1585 c.20539 (J1) delante.
- Sin botón ni enlace: cualquier texto más es nuevo y necesita firma (descripción de 1717, «Textos»).

### Qué cambia
- `public/dashboard/js/app.js`: `window.appMotivoSinEmision` recibe `me.motivoSinEmision` solo si es
  `sii_declarado` o `sii_no_consta`; cualquier otra cosa cae a `null` (fallar cerrado, como `appModoEmision`).
- `public/dashboard/js/homeView.js`: `pintarAvisoSiiSinEmision` inserta `#home-aviso-sii`
  (`.alert.warning`, `role="status"`, `data-motivo`) justo debajo del saludo, con el literal por
  `textContent`. Con `null` no inserta nada: el Inicio sin motivo no cambia ni en un nodo (scrum697/698).
- `public/dashboard/css/styles.css`: `#home-aviso-sii { margin-bottom: 16px; }` (sin estilo inline).
- Bytes: el «›» de los dos literales es U+203A, el mismo del resto del repo para «Configuración › Empresa»
  (medido sobre el fichero: 168 y 97 caracteres; no ASCII: ó, ›, í, á / ó, ›).

### Decisión mía, declarada (MI LECTURA, reversible)
- **Solo lo ve el admin.** El literal pide cambiar Configuración › Empresa y el operario no entra en
  Configuración. La firma dice «un merchant … ve»; si Luis lo quiere también para el operario, es quitar
  una línea (la mutación ③ del test). Se lleva a la entrega como pregunta.
- **Inicio, no la barra.** La firma cubre «Inicio o barra»; en Inicio vive al lado de los otros avisos.

### Cómo se midió
- Test por efecto en el banco de vistas: monta el Inicio entero y lee el texto pintado — admin «Sí» →
  literal 1 byte a byte debajo del saludo; admin «No consta» → literal 2 y no el 1; `null`/`undefined` →
  nada; técnico con cualquiera de los dos → nada; la lista blanca de `app.js`. 5/5 en verde.
- En rojo a propósito: las tres mutaciones de `MUTACIONES_QUE_ME_TUMBAN` (quitar la llamada, quitar el
  filtro de rol, abrir la lista blanca de `app.js`) tumban el test con su prefijo.
- Dos re-anclajes de `tests/scrum601-copy-del-documento-vs-flag.test.mjs`, medidos con
  `git diff --numstat` y `grep -n`, cada uno con su nota fechada: `homeView.js` 944 → 980 (36 0) y
  `app.js` 394 → 399 (5 0).
- Los 214 tests que leen `homeView.js` o `app.js`, uno a uno: en verde salvo scrum811c (pedía este
  registro) y scrum601 (re-anclado arriba).

### Sin medir
- **yaqu.app:** con el flag apagado (hoy ningún merchant real lo tiene) no hay caso visible en
  producción. La verificación en prod será con rol/flag SIMULADO tras el merge (como H4), y se declara así;
  la aceptación entera («un merchant con el flag puesto…») espera a encender el flag (regla 24).
### 12-nov (S2, 2.º push) · las marcas de firma van POR LÍNEA

El CI de #3128 cayó en 4 casos REALES (no el heap): `scrum1157` ① y ③, `scrum1215g` (árbol real) y
`scrum1215i` (trinquete). Causa: los dos literales de `AVISO_SII_SIN_EMISION` sólo tenían la firma en la
CABECERA del objeto («Los DOS literales … FIRMADOS»), y el censo los aprobaba POR GRUPO sin nombrarlos — justo
lo que SCRUM-1215g prohíbe: una firma de grupo no cubre a quien llega después.
- Arreglo en el CÓDIGO, no en los guards (regla 41): cada literal lleva su marca al final de su misma línea,
  `// APROBADO por el fundador el 12-nov-2026 (SCRUM-1717 comentario 21705)` (formato de SCRUM-1157b; precedente
  `customerDetailView.js:110`). Ni un byte de los textos cambia.
- Verde: los tres censos + `scrum1717` + `scrum601` → **38/38**. Las anclas de `scrum601` no se mueven (las
  dos líneas se alargan, no se desplazan).

A9: comprobación → `tests/scrum1215g-una-firma-de-grupo-no-cubre-a-quien-llega-despues.test.mjs`
