# SCRUM-1852 · cabecera de la ficha 360: «✎ Editar» encima del nombre del cliente

**Medido contra:** `origin/main` = `c83ebdbea13a426c2a3e3b5655fca37567d62300` · 2026-11-25T03:38:13Z (Date de GitHub; la rama nace de la punta de SCRUM-1850, `889566003854f1af19358c93f77a958e90ee09b3`, PR #3434 sin mergear, y no lleva main mergeado)

jv-j2ey (puesto J2), carril J2: `public/dashboard/css/styles.css` es contenedor de S2 y el cambio va en un bloque J2 marcado.

A9: comprobación → `docs/master/evidencias/SCRUM-1852/medir.mjs`

**Skill UI:** no cargada · motivo: la sesión jv-j2ey no la declaró en su entrada; línea repuesta por el orquestador del equipo S al curar el rojo de main (guard scrum1340, run 45548131902). Si J2 la cargó, que corrija este motivo en su carril.

(Mi tropiezo: las primeras capturas de la carcasa salieron a mitad del fundido de entrada, la misma cicatriz J2 del 21-nov. Lo vi al abrir la de 929 y el medidor ahora espera a `document.getAnimations()` antes de capturar. Las cajas no cambiaron: la medida repetida salió idéntica.)

## La causa, medida (no la que suponía el ticket)

`.c360-identidad` lleva `flex:1;min-width:0` (el literal de SCRUM-1756i) y `.c360-cabecera-acciones`, `flex-shrink:0`. A 929 y 1280 la fila de acciones (721 px) cabe en la línea, y la identidad se queda con lo que sobra: **141 px para un contenido de 201** (avatar 52 + 14 + la palabra o el correo más ancho, 135). El contenido desborda por debajo de los botones. **No depende de que el nombre sea largo**: con «Carmen Ruiz» (`CLIENTES_DE_MUESTRA[1]`) también lo tapaba, porque el ancho mínimo lo pone el correo. El control que pedía el ticket («un nombre corto no solapa») era FALSO antes de la cura.

**Y otro defecto en la misma fila** (de paso, en el carril, A13): el banco del censo no lleva barra lateral. Dentro de la carcasa de `index.html` (`--sidebar-w` 248 px), a 929 la fila baja de línea pero no encoge, y «+ Nuevo presupuesto», la acción primaria, **salía 128,9 px fuera de la tarjeta** (recortada).

## Cura (2 declaraciones, bloque `J2: SCRUM-1852` tras el de 1850)

- `.c360-identidad { min-width: auto; }`: la identidad conserva su ancho mínimo y, si no cabe junto a las acciones, la fila de acciones baja de línea.
- `.c360-cabecera-acciones { flex-shrink: 1; min-width: 0; }`: lo que SCRUM-1841 hacía solo por debajo de 768, en todas las anchuras.

Sin texto nuevo, sin JS, sin tocar clases globales ni tamaños. El literal de 1756i se queda como estaba (lo ata su test).

## Antes y después (`medir.mjs`: acciones × tinta y caja del `h2`; «sale» = px fuera de la tarjeta)

| marco · ancho | largo antes | largo después | corto antes | corto después |
|---|---|---|---|---|
| banco · 390 | 0 | 0 | 0 | 0 |
| banco · 929 | Editar ∩tinta 1.445 px² | 0 | Editar ∩tinta 426 px² | 0 |
| banco · 1280 | Editar ∩tinta 1.445 px² | 0 | Editar ∩tinta 426 px² | 0 |
| app · 390 | 0 | 0 | 0 | 0 |
| app · 929 | «+ Nuevo presupuesto» sale 128,9 px | 0 | sale 128,9 px | 0 |
| app · 1280 | Editar encima | 0 | Editar encima | 0 |

Población: 12 páginas × 5 acciones = 60 mediciones (con el rol admin, que pinta «Fusionar»). Salidas: `medida-antes.txt`, `medida-despues.txt`. Capturas del nombre largo: `antes/` y `despues/` (`360-<ancho>.png` banco, `360-<ancho>-app.png` carcasa).

## Rojo y verde

- `tests/scrum1852-editar-encima-del-nombre.test.mjs`, en el commit `6710d1c9f66c8212d4004ebcc4d12cfb02919cc6` y sin la cura: **rojo** b) «8 de 60 acciones tapan el nombre o salen de la tarjeta» y d) «se han quitado 0» reglas. Con la cura (`a59ee417523e6199b36960497209c4feb5993f44`): 5 de 5.
- Control d): en la misma página se QUITAN por CSSOM las dos reglas (por selector Y declaración, porque el selector solo casaría con la de 1756i y con la base de la fila): el solape vuelve a 1280 en los dos marcos y la acción que se sale vuelve a 929 en la carcasa.
- Verdes: `scrum1841-boton-presupuesto-360` 4/4 · `scrum1850-ficha-360-resto-44` 5/5 (sus 44 px intactos; el caso c) del mío mide el alto de cada acción) · 237, 976, 700 y 719: 61/61 (719 sin `--escribir`) · `guard-objetivo-tactil`: 0 hallazgos y salida 2 por 4 ciegos, los cuatro «FUENTE ROTA en /» (la landing, 3 de 41 caras sin bajar), `evidencias/SCRUM-1852/guard-objetivo-tactil-despues.txt`.

## Lo que NO está medido

- yaqu.app: no (la rama no está en main). El marco `app` es la carcasa de `index.html` con la barra vacía, no la aplicación con sesión.
- La suite entera: no (el encargo la prohíbe hoy).
- Un correo sin cortes más ancho que la tarjeta a 390: con `min-width:auto` la identidad puede salirse de la tarjeta igual que hoy se sale su contenido; no lo he fabricado.
