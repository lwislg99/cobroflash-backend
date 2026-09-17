# SCRUM-901 · El banco de vistas, fiel a la Inicio: anida, monta en el documento, y value/textContent

**Medido contra:** `origin/main` = `8c354ff3` · 2026-09-17T09:38:58Z (cabecera `Date` de GitHub, al cerrar la medición)
**Rama:** `scrum-901-banco-inicio-value-textcontent` · **Carril:** Sesión 3 (bancos) · **Estado:** EN PR

Nace de SCRUM-897: son sus tres hallazgos (Inicio 109 frente a 143 en Edge, `value` al parsear y `textContent`).

## PASO 0 · la Inicio, firma a firma

Las mismas dos sondas que en 897, pero comparando **firmas** (`ETIQUETA#id.clases`) en vez de totales:

- **Banco:** `pintarVista` y `todos()`.
- **Edge:** `puppeteer-core`, con los scripts del índice en su orden y `fetch` → `{}`, contenedor dentro del documento.

Edge da 143 tanto a 50 ms como a 1.000 ms, así que no es cuestión de tiempo. El banco daba 109, y seguía en 109 con un segundo más de espera: tampoco era tiempo del banco.

Los −34 son **tres causas del banco**, y cuadran exactas (109 − 16 + 51 = 144 = 143 + 1):

| Causa | Efecto | Cómo se midió |
|---|---|---|
| **A · el contenedor de `pintarVista` no estaba en el documento.** `document.querySelector` recorre `document.body`, y `renderSetupChecklist` no encontraba `.kpi-grid` | −51: faltaba «Completa tu configuración» con sus 9 «Ir →» | colgando el contenedor del body a mano: 109 → 160 |
| **B · el parser era plano.** Los esqueletos que el marcado pone dentro de `#kpi-grid` y `#activity-feed` eran hermanos suyos, y repintar esos contenedores no los quitaba. Además, `.kpi-grid .kpi-card` no casaba nunca | +16 (3 `.kpi-card`, 3 `.kpi-label.skeleton`, 2 `.activity-item`, 4 `span.skeleton`, 4 `div`) | padres medidos: el `div` exterior, no `#kpi-grid` |
| **C · el banco no tiene IndexedDB.** La Inicio pinta «No hemos podido comprobar si te queda algo por subir» | +1 `.alert.warning` | Edge, con IndexedDB real, no lo pinta |

**C NO se arregla aquí.** Inyectar IndexedDB por defecto en `cargarDashboard` cambiaría lo que reciben todas las vistas que hoy miden otros tests. `_banco-almacen-local.mjs` ya lo ofrece como opción (`fake-indexeddb`). Queda declarado en el trinquete de 698.

## A12 · el censo de 897, reutilizado y corregido

- **Corrección de 897:** escribí «90 ficheros de `tests/`» y son **80** ficheros de test sobre `018d1807` (833 tests), además de 5 módulos auxiliares y 14 scripts de primer nivel. El «54 cuentan nodos» también mezclaba auxiliares y scripts. Queda anotado en `SCRUM-897.md` y en los comentarios 15684 (897) y 15685 (901).
- **Qué ha cambiado desde 897:** hay un consumidor más, el propio `scrum897-repintar-reemplaza`, y son **81 ficheros**. Línea base sobre `8c354ff3`: **836/836**.

## ROJO · `tests/scrum901-banco-fiel-a-la-inicio.test.mjs`

Comiteado antes de tocar el banco (`f1e4a2b8`). Los 5 tests caen con el banco de main:

1. `value` y `checked` del marcado llegan a la propiedad al parsear; después de escribir, manda la propiedad.
2. `textContent` saca a los hijos del documento: `id` desregistrado y sin padre.
3. El marcado anida: hijos reales, descendencia que casa, `input` que no se traga a su hermano, comentarios que no pintan, `textarea` que no parsea. Repintar el contenedor de dentro quita lo que llevaba.
4. La vista se monta dentro del documento (`document.querySelector` la ve), y la anterior deja de estarlo.
5. La Inicio real: 0 esqueletos y 9 «Ir →», las cifras de Edge. SUELO: si no monta, no llega a 50 nodos o no tiene `#kpi-grid`, dice «NO PUDE MIRAR».

Un fallo mío en el rojo 5, corregido en `b1cb56fa`: tomé «9 botones» de la firma exacta `BUTTON.btn-ghost.btn-sm` de Edge, pero el filtro por clases también cogía `#btn-home-prefs` («⚙ Personalizar»). El test lo excluye ahora.

## Arreglo, en tres pasos, con los 81 consumidores tras cada uno

| Paso | Commit | Consumidores | Qué se mueve |
|---|---|---|---|
| 1 · `value`/`checked` al parsear + `textContent` suelta (helper `_soltarHijos`, compartido con `innerHTML`) | `83b4d8ba` | **836/836** | nada |
| 2 · el marcado anida | `784f47af` | 834/836 | scrum698 (Inicio 109 → 93) · scrum897 test 3 (ver abajo) |
| 3 · la vista se monta en el documento y la anterior sale | `8c5f1aea` | 835/836 | solo scrum698 (Inicio 93 → 144) |

**Tests que cambian, uno a uno:**

- **scrum897 test 3:** su instrumento suponía un parser plano («hijos directos = etiquetas del último marcado»). Con anidado, `.quote-totals` tiene 2 hijos y 6 descendientes. Ahora cuenta descendientes, y **sigue cayendo** con el mutante que vuelve a apilar (24 descendientes frente a 6).
- **scrum698 · CONTROL POSITIVO:** `renderHomeView` 109 → **144**, **recalculado con su contador**. Presupuestos, productos y clientes siguen en 237/166/69. Con el paso 3, la Inicio del banco coincide **firma a firma con Edge** salvo el `.alert.warning` de C.

**Un tropiezo, dicho:** en el paso 2 restauré un mutante con `git checkout` antes de comitear y se perdió el parser. Lo rehíce con las mismas ediciones, comprobé que las cifras eran idénticas (237/166/69/93 y los mismos tests) y lo comiteé antes de seguir.

## Mutantes (con todo comiteado), los 10 muertos

| Mutante | Cae |
|---|---|
| M1 no copiar `value` | test 1 |
| M2 no copiar `checked` | test 1 |
| M3 `textContent` sin soltar | test 2 |
| M4 nunca abre (plano) | tests 3 y 5 |
| M5 sin elementos vacíos | test 3 |
| M6 los cierres no cierran | tests 3 y 5 |
| M7 comentarios no se saltan | tests 3 y 5, **por reventar** (`toLowerCase` de undefined), no por su assert propio |
| M8 sin texto crudo | test 3 |
| M9 contenedor fuera del documento | tests 4 y 5 |
| M10 la vista anterior se queda | test 4 |

## Lo que el parser NO hace (declarado en el propio banco)

Cierres implícitos (`<p>`, `<li>` o `<td>` sin cerrar), el `<tbody>` que inserta el navegador, y texto agregado: el texto de un elemento sigue siendo el que va justo detrás de su apertura.
