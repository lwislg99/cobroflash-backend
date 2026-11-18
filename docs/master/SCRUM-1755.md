# SCRUM-1755 · Los bancos del panel miden con la letra del panel, y scrum1603 los censa

**Medido contra:** `origin/main` = `d69ccd51362c2861389ebc632a843e971330b406` · 2026-11-18T08:21:27Z
A9: comprobación → `tests/scrum1603-el-banco-mide-con-la-fuente-del-panel.test.mjs`

## SCRUM-1755 (18-nov-2026, S3) · censo + tanda 1 (semáforo y avisos)

**Origen.** SCRUM-1745c: `guard-hojas-del-trabajo-44` medía el ancho de un texto con la letra de reserva de cada
máquina (su banco no cargaba `/fonts/inter.css`) y el test de SCRUM-1603 nombraba tres bancos a mano, así que
no lo vio.

**⒈ Censo (Jira c.22020).** Población: todo `.mjs` de `scripts/` que nombra `styles.css`: 23. La pista de S4
tenía 13; le faltaban 2 bancos (`guard-notas-en-la-ficha`, `guard-marcadores-en-pantalla`) y le sobraba uno que
no es banco (`_contraste-de-tokens`, estático). Veredicto por script, leído en lo que cada uno empuja a sus
`fallos`/`hallazgos`:

| clase | scripts |
|---|---|
| TEXTO (desborde, líneas) | guard-caja-avisos ✅ · guard-caja-datos-del-cliente · guard-caja-documento-suelto · guard-caja-semaforo ✅ · guard-falta-en-otra-pestana |
| DEPENDE DE LA LETRA (altos y cabida que pone el texto) | guard-pad-de-firma-cabe · guard-notas-en-la-ficha |
| solo geometría / sin medida | guard-aviso-bizum · guard-modo-en-ajustes · guard-foto-del-gasto · guard-nif-del-gasto · guard-vias-de-cobro · guard-completar-lleva-al-campo · guard-marcadores-en-pantalla |
| no es banco a mano | guard-915e1-documento-vivo (monta el índice real) · recorrido-entre-vistas (la app real) · _contraste-de-tokens · _cobertura-visual · _medidor-de-toque |

✅ = arreglado en esta tanda.

**⒊ scrum1603 por censo** (`tests/scrum1603-el-banco-mide-con-la-fuente-del-panel.test.mjs`, casos ⑥). Todo
`.mjs` de `scripts/` que abre un navegador y monta el panel sale en una clase: `casa` (hojas del índice +
`esperarFuentes` + `cegueraDeLaFuente`, y cada navegación espera la letra: el ④, ahora para todos),
`casa-lista` (`servirListas`) o `a-mano`, que sólo vale declarado en `SOLO_GEOMETRIA` (con motivo, y cae si
empieza a usar una primitiva de texto) o en `DEUDA` (techo que sólo baja). Población medida: 27 bancos.

| qué se le hace | salida |
|---|---|
| nada | 7 pass · «27 (casa 5 · casa-lista 10 · a mano 12: 7 solo geometría + 5 de DEUDA)» |
| `scripts/guard-zz-1755-mutante.mjs` en disco, navegador + hojas a mano | 1 · «…monta el panel con sus hojas escritas a mano y no está declarado» |
| `guard-hojas-del-trabajo-44` sin su `cegueraDeLaFuente` (va al catálogo del meta-guard) | 1 · «CIEGO: el censo no ve …trabajo-44 como banco de la casa» |
| sacar un banco de la DEUDA sin arreglarlo (rojo primero de cada arreglo) | 1 |

El ④ no sabía leer un `goto` de nivel superior (el semáforo navega con `await` de módulo): ahora su ámbito es el
módulo y sólo cuentan las llamadas de ese nivel.

**⒉ Tanda 1, patrón de 1745c** (hojas del índice, letras en bytes, caras esperadas, CIEGO sin letra, `LETRA:` en
la salida). Medido en esta máquina (Windows, Edge):

| guard | base (reserva) | con Inter | `inter.css` 404 | `.woff2` 404 |
|---|---|---|---|---|
| guard-caja-semaforo | 0 · candidato 1 línea a 929 y 390 | 0 · igual | 2 · HOJA SIN CARGAR | 2 · FUENTE ROTA |
| guard-caja-avisos | 0 · cabe | 0 · cabe; **a 320 el aviso de pendientes pasa de 3 a 4 líneas** | 2 · HOJA SIN CARGAR | 2 · FUENTE ROTA |

## SCRUM-1755b (18-nov-2026, S3) · tanda 2

Mismo patrón y mismas cuatro pasadas por guard. En `guard-falta-en-otra-pestana` el servidor leía todo como
texto (`'utf8'`): las `.woff2` habrían llegado rotas; ahora van en bytes con su tipo.

| guard | base (reserva) | con Inter | `inter.css` 404 | `.woff2` 404 |
|---|---|---|---|---|
| guard-falta-en-otra-pestana | 0 · 12 de 12 | 0 · 12 de 12 | 2 · HOJA SIN CARGAR | 2 · FUENTE ROTA |
| guard-caja-datos-del-cliente | 0 · cabe | 0 · las mismas cifras | 2 · HOJA SIN CARGAR | 2 · FUENTE ROTA |
| guard-caja-documento-suelto | 0 · cabe | 0 · cabe; cambian los anchos («Nº factura» 86,2→95,9 px a 929, 50,0→52,7 px en móvil; «Emitir factura» 151,6→154,8), no las líneas | 2 · HOJA SIN CARGAR | 2 · FUENTE ROTA |

Censo tras la tanda: 27 bancos (casa 8 · casa-lista 10 · a mano 9: 7 solo geometría + 2 de DEUDA), techo 2.

**Lo que NO está medido.** Quedan 2 en la DEUDA, que siguen midiendo con la letra de reserva:
`guard-pad-de-firma-cabe` y `guard-notas-en-la-ficha`. Son para la sesión siguiente de S3. Inter en el runner (lo
dirá el CI). Ninguno de estos guards entra en `npm test`: sólo el censo (scrum1603) corre en la suite.
