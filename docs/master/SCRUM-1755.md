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

## SCRUM-1755c (18-nov-2026, S3, sesión de relevo) · tanda 3

**⒈ El rojo de #3212** era de esta rama y sólo de ella: `scrum267` (la entrada no traía «Medido contra»); el
`scrum976 ④` caía en cadena porque corre `guards:entrada`. Arreglado con el ancla y la línea A9 de arriba.

**⒉ `guard-notas-en-la-ficha`.** Ya enlazaba `/fonts/inter.css`, pero escrito a mano, servía la `.woff2` como
`application/octet-stream; charset=utf-8` y no esperaba las caras. Ahora: hojas del índice, `.woff2` con su
tipo, `esperarFuentes` + `cegueraDeLaFuente` tras cada `goto`, `LETRA:` en la salida.

| qué se le hace | salida |
|---|---|
| sacarlo de DEUDA y techo 2→1, sin tocar el guard (rojo primero) | scrum1603 ⑥ en rojo: «…monta el panel con sus hojas escritas a mano y no está declarado» |
| base (guard viejo) | 0 · 9 filas: admin con notas ×3, sin notas ×3, técnico sin pestaña ×3 |
| con el arreglo | 0 · las mismas 9 filas, mismo veredicto · `LETRA: Inter · caras cargadas 5 de 35 · fallidas 0`; scrum1603 7/7 |
| `inter.css` 404 | 2 · HOJA SIN CARGAR |
| `.woff2` 404 | 2 · FUENTE ROTA |

**⒊ `guard-pad-de-firma-cabe` NO está hecho.** Es fichero de S4 (fila propia en `docs/equipo/dos-equipos.md`
§3, SCRUM-1742), y el cruce necesita su fila en §3.4, que es de S0. El orquestador la ha pedido a S0; cuando
esté en `main`, se arregla con la misma receta. Hasta entonces la DEUDA queda en 1, con techo 1.

## Fila de §3.4 (S0, rama scrum-1755c-fila-carril-pad) · S3 puede tocar la regla de medida de `scripts/guard-pad-de-firma-cabe.mjs`

**Medido contra:** `origin/main` = `d69ccd51362c2861389ebc632a843e971330b406` · 2026-11-18T08:27:35Z
**Sesión:** S0 (dueña de `docs/equipo/dos-equipos.md`), worktree `s0-1755c`, rama `scrum-1755c-fila-carril-pad`.

**Por qué.** S3 necesita cambiar `scripts/guard-pad-de-firma-cabe.mjs` para SCRUM-1755. El fichero es de S4
(`dos-equipos.md:189`, por SCRUM-1742) y la cerradura `.claude/hooks/carril.mjs` bloquea a S3 sin una fila en
§3.4. **Autoridad:** decisión del orquestador por la delegación general de firma (SCRUM-1656 c.21978), en su
encargo a S0 del 18-nov. El texto de la fila es el del encargo, literal.

**Qué entra.**
- `docs/equipo/dos-equipos.md` §3.4: la fila `scripts/guard-pad-de-firma-cabe.mjs | S3 | SCRUM-1755: cambiar
  sólo la regla de medida (hojas del índice + espera de las caras + LETRA en la salida), sin tocar ningún caso
  ni veredicto | SCRUM-1755`. El fichero sigue siendo de S4.
- `.claude/carriles.json`, regenerado con `node scripts/carriles.mjs generar` (84 filas · 211 reglas · 11
  excepciones; escritos 1, borrados 0).

**Comprobado.** `node scripts/carriles.mjs de scripts/guard-pad-de-firma-cabe.mjs` → S4 (puesto),
`dos-equipos.md:189`, con la excepción para S3 en `dos-equipos.md:268`.

A9: comprobación → `tests/scrum1295-carriles.test.mjs`

## SCRUM-1755d (18-nov-2026, S3, sesión de relevo) · el pad de firma, y la DEUDA a 0

**Medido contra:** `origin/main` = `2cce398c3007d23b6aa048d44f5cd2d54d592e9f` · 2026-11-18T11:50:05Z (reloj local)
A9: comprobación → `tests/scrum1603-el-banco-mide-con-la-fuente-del-panel.test.mjs`
**Autoridad:** la fila de §3.4 de arriba (S0, PR #3218, en `main`): sólo la regla de medida, sin tocar casos ni veredictos.

**⒈ `guard-pad-de-firma-cabe`.** Enlazaba `tokens.css` + `styles.css` a mano, sin `inter.css`, y su servidor leía
todo como texto (`'utf8'`). Ahora: hojas del índice (`enlacesDelPanel`), `.woff2` en bytes con su tipo,
`esperarFuentes` + `cegueraDeLaFuente` tras el `goto` (y CIEGO si no carga ninguna cara), `LETRA:` en la salida.
Ningún caso, umbral ni veredicto cambia.

| qué se le hace | salida |
|---|---|
| sacarlo de DEUDA y techo 1→0, sin tocar el guard (rojo primero) | scrum1603 ⑥ en rojo: «…guard-pad-de-firma-cabe.mjs monta el panel con sus hojas escritas a mano y no está declarado» |
| base (guard viejo, letra de reserva) | 0 · 11/11 ✔ · tarjeta 812/632/536/768 px · botones 44/44/44 |
| con el arreglo (Inter) | 0 · 11/11 ✔ · **las mismas cifras, caso a caso** · `LETRA: Inter · caras cargadas 5 de 35 declaradas · fallidas 0` |
| `inter.css` 404 | 2 · HOJA SIN CARGAR |
| `.woff2` 404 | 2 · FUENTE ROTA |

Ningún caso de la población 11/11 cambia de veredicto. MI LECTURA de por qué no cambia ni una cifra: la tarjeta
mide la ventana menos 32 px en todas (812 = 844 − 32 …) y el recuadro y el pie se colocan desde su borde de abajo;
la letra mueve lo de dentro del resumen, que se desplaza, no lo que el guard juzga.

**⒉ scrum1603 ⑥.** `DEUDA = {}` y `TECHO_DEUDA = 0`. La mutación «uno de la DEUDA ya arreglado sigue en la lista»
leía `Object.keys(DEUDA)[0]`, que con la lista vacía no tiene sujeto: ahora declara a propósito un banco que ya es
de la casa y comprueba que cae; la de «la deuda no sube» declara uno con techo 0 y comprueba que cae.
Censo: 27 bancos (casa 10 · casa-lista 10 · a mano 7: 7 solo geometría + 0 de DEUDA); scrum1603 en verde.

**Lo que NO está medido.** Inter en el runner del CI (lo dirá el CI). El pad sigue sin medir apaisado, teclado en
pantalla ni otro navegador que Chromium (declarado en el propio guard). Con la DEUDA a 0, el ticket se puede cerrar.