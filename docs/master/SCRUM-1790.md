# SCRUM-1790 · Configuración a 390 px: el aviso de «NIF vacío» al pulsar Guardar desde Cobros quedaba fuera de la pantalla

**Medido contra:** `origin/main` = `0b2f6451af74f2142cf27e18c9a4c42fb56c1e65` · 2026-11-23T08:29:11Z

A9: comprobación → `docs/master/evidencias/SCRUM-1790/mutar-1790.mjs`

**Skill UI:** cargada (`yaqu-premium-ui`), antes de la primera edición; `DESIGN.md` no se leyó: el cambio no usa tokens, clases ni estilos (sólo un desplazamiento sin animación).

Carril J3 (`public/dashboard/js/settingsView.js`, contenedor J3 según `node scripts/carriles.mjs de <ruta>`). Encargo del orquestador J (`cobroflash-backend-2d`), sesión `jv-j3cq`, relevo de `jv-j3cp` (medición en SCRUM-1790 c.22374). Ningún texto nuevo; el guard no se toca.

## La causa medida no es la que se proponía

c.22374 proponía: «si el campo ya queda en la ventana pegado al borde inferior, el navegador no desplaza y el aviso, que va debajo, se sale». **Medido aquí, es falso:** con el campo pegado al borde (ventana de 532 px), el navegador lo CENTRA igual (scroll 0 → 244), porque el panel lleva `scroll-padding-bottom: 80px`.

Lo que hace el resultado depender del momento es `html { scroll-behavior: smooth }` (`public/dashboard/css/styles.css:202`): el desplazamiento que hace el navegador hasta el campo inválido es **animado**, y el guard mide a los 400 ms. Línea de tiempo tras el clic, recorrido del guard, sin arreglo (`aviso-pegado-al-borde.mjs`):

| ancho | 0 ms | 100 ms | 200 ms | 400 ms | 1500 ms |
|---|---|---|---|---|---|
| 390 | aviso −85…−46 | −85…−46 | −41…−2 | **−41…−2** | 447…486 |
| 1280 | −224…−205 | −60…−41 | 298…317 | 418…437 | 419…438 |

En otra pasada la animación de 390 llegó a los 400 ms justos (441…480): de ahí «1 de 2» en una máquina y «0 de 6» en otra. Es el mismo defecto en escritorio, sólo que allí la animación acaba antes de los 400 ms.

## El arreglo (una línea en `settingsView.js`)

Tras `caja.appendChild(aviso)`: `caja.scrollIntoView({ block: "nearest", behavior: "instant" })`. Sin animación y antes de que el navegador valide; con la caja (rótulo, campo y aviso) a la vista, el navegador ya no desplaza.

**Corrección al diff propuesto en c.22374** (`aviso.scrollIntoView(...)`): lo medí y deja el aviso dentro, pero el campo queda por encima de `scroll-padding-top` (bajo la barra superior en el panel real), y el navegador vuelve a desplazar, animado, a los ~400 ms (scroll 463 → 88). Con la caja, las cinco muestras son idénticas (390: aviso 148…187, campo 96…141, scroll 387).

Lo que cambia en escritorio: el aviso se ve desde el primer cuadro (antes, a partir de ~200 ms), y la caja queda arriba (campo 96…141) en vez de centrada (367…412). Sin texto, sin estilos.

## Cómo se ve

- Rojo fabricado y repetible: `node docs/master/evidencias/SCRUM-1790/aviso-pegado-al-borde.mjs` — 2 casos × 5 muestras; sin el arreglo sale 1, con él 0; sin letra, sin pestaña o sin aviso sale 2.
- Mutaciones: una vez → `docs/master/evidencias/SCRUM-1790/mutar-1790.mjs` (base 0 → sin la línea 1, nombrando «el aviso queda fuera de la pantalla»; restaura y compara bytes). El catálogo + `aplicarUna` no aplica: juzga por nombre de test y esto es un guion de navegador (A10, SCRUM-1787g).
- `guard:falta-en-otra-pestana`: 5 de 5 en local con el arreglo, cada una 12 casos + resumen, 0 🔴, exit 0.
- Capturas a 390 en el comentario de Jira. ⚠️ La captura «antes, al pulsar» **no** pilla el instante malo: tarda más que la animación y sale ya colocada. El defecto lo prueba la línea de tiempo, no la imagen.

## Lo que no se ha medido

- **Suite entera, NO corrida en local**: por orden del orquestador J (contexto de la sesión a 187k, sobre un tope de 180k), la corre el check obligatorio del PR. En local: 14 ficheros dirigidos (1781b/c, 1773, 836, 700, 710b, 719, 1294, 267, 273, 525d, 854, 894, 811c) 159/159 y `npm run guards:entrada` 170/170.

- En yaqu.app, no (sin desplegar al escribir esto).
- Con `prefers-reduced-motion` el CSS pone `scroll-behavior: auto` y el defecto no debería darse; no lo he medido.
- El globo nativo «Rellene este campo.» tapa parte del aviso al enfocarse el campo (se ve en la captura «después»). Ya pasaba antes; no es de este ticket y no lo toco.
