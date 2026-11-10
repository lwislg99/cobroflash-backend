# SCRUM-1570c · banco de la opción ③(2): reservar la altura de la barra de anuncio

Medido por jv-j3r (puesto J3) el 21-oct-2026 sobre `origin/main` `67dde0caf421c9c246775098ab75aee6e8cc41e7`, Edge de Windows.
El informe y las cifras están en SCRUM-1570, comentario 20169. **No se ha aplicado nada a `public/index.html`.**

- `guard-copia.mjs`: copia de `scripts/guard-cls-barra-anuncio.mjs` que se corre FUERA del árbol, con
  `RAIZ_REPO=<árbol> INYECTA=<fichero> ESPERA=<ms>`. Inyecta el contenido de `INYECTA` antes de `</head>` en el
  `index.html` que sirve, y retiene `/__sonda/espera.css` los ms de `ESPERA`.
- `sonda.mjs`: `node sonda.mjs <árbol> alturas|cls [anchos] [retrasos]`. `RESERVA=<carpeta con DejaVuSans.ttf y
  DejaVuSans-Bold.ttf>` o `RESERVA_LOCAL=<familia instalada>` cambian la fuente de reserva. El retraso -1 significa Inter rota.
- `iny-*.html.txt`: lo que se inyectó. Las variantes con DejaVu no se suben (llevan la fuente en base64, 1,9 MB).
  Se rehacen con DejaVu Sans 2.37 (paquete npm `dejavu-fonts-ttf`), como en `sonda.mjs`.
- `v1-index.html.diff`: la variante V1, sin cambio visible con Inter, en forma de diff. Aplicada por jv-j3t
  en la opción (a) (abajo).
- `*.txt`: las salidas. Controles: `g-espera.txt` (sólo retención, que reproduce `base.txt`) y las filas con
  «retraso rota» de `cls-base-*.txt` (con Inter rota, CLS 0).

## Opción (a) · jv-j3t, 21-oct-2026 (registro: tramo SCRUM-1570c de `docs/master/SCRUM-1570.md`)

Se corren a mano, fuera de la tanda, desde la raíz del árbol. `<dv>` = carpeta con `DejaVuSans.ttf` y
`DejaVuSans-Bold.ttf` (`npm pack dejavu-fonts-ttf@2.37.3`); `<base>` = `git show origin/main:public/index.html`.
- `metricas.mjs <árbol> <dv> [ancho]` → `metricas.txt`: de dónde salen `size-adjust` y los overrides.
- `banco-a.mjs <árbol> <base> <dv> [anchos] [repeticiones]` → `banco-a.txt`: CLS antes/después por reserva
  (sistema, Arial, DejaVu), con Inter y con Inter rota. `banco-a-1-muestra-en-bruto.txt`: la primera pasada,
  con la muestra mal hecha y un CIEGO mal puesto (los dos, en el tramo).
- `eyebrow.mjs <árbol> <dv> [ancho]` → `eyebrow.txt`: por qué DejaVu a 360 sube a 0,015.
- `cajas.mjs <árbol> <base> [anchos]` → `cajas.txt`: con Inter cargada, todas las cajas antes y después.
