# SCRUM-1603 · el banco del medidor de toque no enlaza Inter y mide con Segoe UI (la app sí la carga)

**Medido contra:** `origin/main` = `2c45bf589aeae007eb12ed388b3e0f4d2d8d98ed` · 2026-10-23T20:49:33Z (hora de GitHub al escribir: 2026-10-23T21:01:18Z; los ficheros medidos no cambian hasta `a7855fd70b1bf4a4d6e565fc83c6233df25e9050`)
A9: comprobación → `docs/master/evidencias/SCRUM-1603/sonda-fuente.mjs`

Puesto J3 (`jv-j3ax`) · rama `scrum-1603a-banco-sin-inter`. Encargo del orquestador del equipo de Javier
(`cobroflash-backend-62`): SÓLO MEDIR la frase «Inter no se carga en ningún sitio» de SCRUM-1592 c.20613 (J2,
`jv-j2ap`) y SCRUM-1584 c.20614, y abrir ticket para el equipo de Luis. El hook de arranque dijo «SIN IDENTIDAD»
(SCRUM-1498); el puesto lo da el encargo, y se dice aquí. Este PR es sólo de docs: no toca ningún fichero de
`public/`, `scripts/` ni `src/`. El ticket es del equipo de Luis (`equipo-luis`, `area-s3`); este registro guarda la
evidencia de la medición.

## La premisa era falsa para la app y cierta para el banco

- **Lo que pide el diseño:** `DESIGN.md:139` (Inter, con system-ui de reserva) y `public/dashboard/css/styles.css:108`
  (`--font: 'Inter', system-ui, -apple-system, sans-serif`).
- **Quién la carga:** Inter está autoalojada desde SCRUM-1234 (`public/fonts/inter.css`, 35 `@font-face`, 7
  `.woff2`). La enlazan las 16 superficies: 7 de `public/` (index, login, register, precios, privacidad, terminos,
  `dashboard/index.html:7`) y 9 de `src/` (payBank, payBizum, payInvoice, payMp, receipt, albaranPublic,
  customerPortal, quoteDecisionLanding, publicProfile.service). Producción: `GET https://yaqu.app/fonts/inter-latin.woff2`
  → 200, `Content-Type: font/woff2`, 48.256 B (`Date:` 21:00:02Z).
- **Qué se pinta** (`sonda-fuente.mjs`, Edge 155 headless, Windows, navegador por `scripts/_navegador.mjs`; salida
  entera en `salida-sonda.txt`): la fuente que el motor USÓ (`CSS.getPlatformFontsForNode`) sobre un texto hermano
  del campo `.input`.

| caso | fuente USADA | caja `.input` |
|---|---|---|
| A · banco del guard táctil tal cual (sin `inter.css`) | Segoe UI | 36 px |
| B · banco + `inter.css`, woff2 como `application/octet-stream` (los tipos del guard) | Inter (web) | 34 px |
| C · banco + `inter.css`, woff2 como `font/woff2` [positivo sembrado] | Inter (web) | 34 px |
| F · panel real `public/dashboard/index.html` servido del árbol | Inter (web) | 34 px |
| E · `public/login.html` del árbol | Inter (web) | — |
| G/H · `https://yaqu.app/` y `/login.html` (producción) | Inter (web) | — |

Controles: el positivo sembrado C TIENE que pintar Inter y el negativo A no puede; si falla cualquiera, la sonda
sale con 2 y dice CIEGO. `document.fonts.check('16px Inter')` da `true` en los 8 casos, también en A, que no tiene
ninguna cara Inter: no vale como sonda.

- **Qué bancos están así** (`censo-envoltorios.mjs`, sobre 1.986 ficheros de `scripts/` y `tests/` más una semilla
  que sale; sin semilla dice CIEGO, `salida-censo-sin-semilla.txt`): 5 montan página con `/tokens.css` o
  `/dashboard/css/styles.css`; 2 enlazan también `inter.css`; **3 no**: `scripts/guard-objetivo-tactil.mjs`
  (`PANEL_HTML`, `:190-193`, y `envolver`, `:238-241`), `scripts/censo-objetivo-tactil-panel.mjs` y
  `scripts/_banco-lista.mjs:80`.

## Impacto en la casa

- `guard:objetivo-tactil` (job «guards de navegador»): en Windows mide 2 px de más el campo `.input`. Es el 0 local
  que no predijo el rojo de CI en SCRUM-1584 c.20600. Con Inter, en Windows, la caja da 34, la cifra de CI.
- `censo:tactil-panel` (S3, informativo en cada PR): la misma hoja sin Inter.
- `_banco-lista.mjs`: lo importan, entre otros, `guard-lista-gastos`, `guard-lista-trabajos` y
  `guard-lista-trabajos-917`, que leen geometría. No he medido si alguno cambia de veredicto.
- Contraste: depende del tamaño y del grosor, no de la familia. No lo he medido.

## Dueño

`node scripts/carriles.mjs de …`: `censo-objetivo-tactil-panel.mjs` → S3. `guard-objetivo-tactil.mjs` y
`_banco-lista.mjs` → sin cerradura (fila general de `scripts/`). `inter.css`, `tokens.css` y `styles.css` → S2.
Ticket con `equipo-luis` y `area-s3`; el dueño del guard y de `_banco-lista.mjs` lo decide el orquestador de Luis.

## Salidas (en el ticket, sin elegir)

① cargar Inter en los 3 bancos · ② quitar Inter del token (S2, cambio visual; contradice SCRUM-1234) · ③ dejar la
fuente del sistema y declararlo en los 3 ficheros.

## Errores

- **Míos:** la primera versión de la sonda leía el texto del `input` con un segundo `DOM.getDocument`, que invalida
  los `nodeId` del primero, y daba «(vacío)» en los 8 casos. La cazó su positivo sembrado (CIEGO, salida 2) y no la
  di por buena; ahora mide un `<span>` hermano. La primera versión del censo, sin semilla, salía verde en vez de
  CIEGO; la arreglé antes de subirla. Y la primera llamada a Jira para crear el ticket se colgó 300 s sin crearlo
  (lo comprobé buscando antes de reintentar).
- **De la premisa:** «Inter no se carga en ningún sitio» salió de c.20613 sin medir, y el orquestador la pasó al
  encargo copiada de allí (lo dijo él mismo por mensaje).

## Sin medir

Qué fuente de reserva usa el Chromium de Linux de CI; el guard y el censo reales con `inter.css` añadido (no he
modificado ningún fichero del árbol); los guards de lista; la landing (su campo inyectado heredaba `Arial` de su hoja).

---

## Tramo 1603b (S3, equipo de Luis, 24-oct-2026) · Salida ①: el banco mide con Inter, en los tres bancos

**Medido contra:** `origin/main` = `927bda7ab44b604d81bca8c453663e7fc6f6cda9` · 2026-10-24T12:27:02Z (antes y después del cambio de arnés, mismo árbol); y la fusión con `origin/main` = `def9d33d3f973dc75bfd7076478523ea1ac06afe` (entran 962f y 962g) · 2026-10-24T12:58:59Z
A9: comprobación → `docs/master/evidencias/SCRUM-1603b/sonda-tres-bancos.mjs`

Puesto S3 · rama `scrum-1603b-banco-inter`. Encargo del orquestador de Luis: «meter Inter en el banco» y medir ANTES y DESPUÉS qué instrumentos cambian de cifra. Se elige la salida ① del ticket.

### Qué cambia

- **`scripts/_hojas-del-panel.mjs` (nuevo).** Las hojas del banco salen DEL ÍNDICE (`public/dashboard/index.html`), en su orden, con el único lector de `<link>` de la casa (`hojasDeLaPagina`, SCRUM-676): `/fonts/inter.css`, `/tokens.css`, `/dashboard/css/styles.css`. Y una espera de la fuente que se evalúa en la página: pide cada cara declarada, espera `document.fonts.ready` y devuelve el RECUENTO (caras declaradas, cargadas, fallidas y hojas que no llegaron). `cegueraDeLaFuente` convierte ese recuento en veredicto: hoja sin cargar, cara rota o ninguna cargada = CIEGO.
- **`_banco-lista.mjs`:** `documento()` enlaza esas hojas (la propuesta de S2, comprobada: era el sitio), sirve `.woff2` como `font/woff2`, espera la fuente antes de `__listo` y, si falla, lo apunta en `__errores`. **Y `arbolDePartida` copia también los `.woff2`**: sin eso, el «antes» de los guards que comparan contra la base de la rama mediría con la fuente de reserva y el «después» con Inter, y dirían «HA CAMBIADO» sobre una rama que no toca nada. No estaba en la propuesta; salió al leer quién usa el banco.
- **`guard-objetivo-tactil.mjs` y `censo-objetivo-tactil-panel.mjs`:** las mismas hojas, y TODA navegación pasa por un `ir()` que espera la fuente. Los dos dicen ahora con qué fuente midieron y en cuántas páginas.

### ANTES y DESPUÉS, en el mismo árbol (`927bda7ab`): qué cifras se mueven

11 instrumentos, uno a uno, con su salida guardada (`antes-despues.txt`). Todos salen 0 antes y después.

| instrumento | antes → después | lectura |
|---|---|---|
| editor de 962c (`_banco-lista`) | 109 · 29 cortos · **4 DEFECTO · 1 DUDOSO** · 21 · **3 ARTEFACTO** → 109 · 29 · **6 · 0** · 21 · **2** | «Descuento global» e «IVA %» 44,6 → **43,6**, la cifra de producción al decimal |
| `guard:objetivo-tactil` | 0 hallazgos · 0 ciegos → 0 · 0 | se mueven alturas dentro de excepciones ya declaradas (pestañas del historial 41 → 39; «Borrar» 44,9 → 44,6, sigue ≥ 44) |
| `censo:tactil-panel` | 101 distintos cortos → **101** | alturas −1/−2 px; **Cobros a 929: 7 medidos → 6, 0 no tocables → 1** (abajo) |
| `guard:lista-trabajos` | igual | «113 ficheros» → «120» en el «antes»: son los 7 `.woff2` que ahora copia |
| `guard:lista-trabajos-917`, `guard:lista-gastos`, `guard:escalera-por-estado`, `guard:albaranes-con-acciones`, `censo:accion-del-80`, `censo:clics-del-80` | idénticos | — |
| `scrum889b`, `scrum710b`, `scrum1142` | 34/34 → 34/34 | — |

Una segunda pasada DESPUÉS, con la versión final del recuento, sale idéntica a la primera (11 de 11): con la espera, el banco no oscila.

**La única bajada, mirada antes de creérmela:** en Cobros a 929 el enlace «factura F-2026-0021» pasa de medido (46,9, cumple) a «el detector no lo alcanza ni en su centro». Medido con una sonda puntual: con Inter el texto ya no cabe en su celda (161 px) y el enlace en línea **se parte en dos renglones** (102 + 31 px de ancho); el centro de su caja cae entre los dos y el detector toca la celda. Es una limitación del árbitro (`_medidor-de-toque.mjs`) con los enlaces partidos, que la fuente destapa; no cambia ningún corto. **No lo arreglo aquí:** es otro cambio de arnés, y el encargo es uno a la vez.

🔴 **PUNTO CIEGO DECLARADO** (condición del orquestador para empujar): `censo:tactil-panel`, `renderCobrosView` a 929 px · elemento `A` «factura F-2026-0021» (`<a href="#invoice-detail">`) dentro de `TD.cell-id` (161 px de ancho) · **causa:** con Inter el enlace se parte en dos renglones (102 + 31 px) y el árbitro prueba el centro de la caja, que cae entre los dos · **efecto:** sale en «no tocables» y **NO está entre los 101 cortos distintos ni entre los medidos**; su área de toque real no la mide nadie. Se cierra cuando el árbitro pruebe cada renglón (`getClientRects`) y no el centro de la caja (pendiente 3 del traspaso de S3).

### El control positivo: con Inter, ¿el banco da lo de producción?

**Corrección a la premisa del encargo:** pedía «los 8 defectos de producción, no los 4». Por la propia tabla de S2 (§962g ②), producción con `/fonts/*` cortado daba 6: los 2 de más que tiene producción son de la **barra superior** («Menú» y el buscador), que el banco no monta. Lo que la fuente tiene que explicar es **4 → 6**, con dudosos 1 → 0 y artefactos 3 → 2. **Es exactamente lo que da**, y con los dos controles que S2 nombró. La fuente era la causa de su mitad; la otra mitad es la barra, sin tocar hoy.

Sobre la fusión con `main` (962f y 962g ya dentro), el editor da **1 DEFECTO · 21 · 3 ARTEFACTO con el banco de `main` y con este**: los suelos de 44 de S2 ya no dependen de la fuente.

### La aceptación del ticket

| aceptación (literal) | dónde se ve |
|---|---|
| Con la salida elegida, la fuente que el motor USA en el banco de cada uno de los 3 ficheros es la que el banco declara → se ve con la sonda de `docs/master/evidencias/` del registro de este ticket (positivo y negativo). | `docs/master/evidencias/SCRUM-1603b/sonda-tres-bancos.mjs` y su `salida-sonda.txt`: A (`_banco-lista`) y C (la cabecera de guard y censo) USAN Inter (web); B y B2 (hoja de la fuente abortada y en 404) y D (la cabecera de antes) usan Segoe UI, y B y B2 los canta el banco. Guard y censo lo dicen además en su propia salida (`⟦fuente⟧ … Inter · caras cargadas 5 de 35`) |
| Si se elige ①: `censo:tactil-panel` y `guard:objetivo-tactil` dan en Windows las mismas cajas `.input` de Clientes que en CI → se ve en sus salidas. | Windows: la caja `.input` da **34 px** con la cabecera nueva y 36 con la de antes (caso C/D de la sonda; los 34 de CI son la cifra de J3). La comparación contra el job de CI de ESTE PR, en el comentario de entrega del ticket: NO HECHO al escribir esto (el PR aún no ha corrido) |
| Ningún guard se relaja ni gana excepciones (regla 41). | El diff no toca `EXCEPCIONES` ni ningún umbral; `tests/scrum1603-el-banco-mide-con-la-fuente-del-panel.test.mjs` sólo añade exigencias |

### Test y rojos

`tests/scrum1603-el-banco-mide-con-la-fuente-del-panel.test.mjs` (sin gate): ① las hojas del banco son las del índice, con la fuente · ② la página de `_banco-lista` las enlaza, sirve las letras con su tipo y espera la fuente ANTES de darse por lista (servidor real, sin navegador) · ③ el «antes» copia las letras que pide `inter.css` · ④ guard y censo montan con las hojas del índice y **toda** llamada `.goto(` va seguida, antes del siguiente `goto`, de una llamada a `esperarFuentes` o a un ayudante que la llama (por AST) · ⑤ el veredicto del recuento. **Rojo primero:** las 9 mutaciones de su `MUTACIONES_QUE_ME_TUMBAN`, cada una aplicada (numstat al lado), tumban su caso y se restauran (`mutar-1603.txt`); base sin mutar verde.

### Errores (míos)

- **Dos veces di por sabido qué deja Chromium en una hoja que no llega.** Primero miré `!link.sheet` (con la hoja cortada, `sheet` sigue puesto); luego traté como «cargada» la hoja cuyas reglas no se dejan leer (abortada, leerlas LANZA, aun siendo del mismo origen; en 404 tiene 0 reglas). Las dos las cazó el negativo B de mi propia sonda, que salió CIEGO (salida 2), antes de empujar. Ahora hay caso con aborto y caso con 404.
- La primera pasada ANTES cayó entera en guard, censo y tests: el worktree nació sin `dist/`. No eran cifras; se repitió con `dist/`.
- **Mi ayudante `ir()` del guard táctil navegaba por dentro, y eso escondía sus URL al censo de solapes** (`scripts/_solape-de-guards.mjs`, SCRUM-548, lee el primer argumento de cada `.goto(`): el `5×/index.html` bajó a 4× y cayeron `scrum548` y `scrum976` ④ en la tanda dirigida. Una bajada con forma de «un solape menos». El arreglo fue en mi código, no en el censo: cada `page.goto` vuelve a su línea de `main` (`git diff origin/main` no toca ni una) y la espera va justo detrás.
- **Y el fichero nuevo nació sin fila** en `dos-equipos.md` §3.3: lo cazó `scrum1480f`. Fila de S3 (área del ticket) y `carriles.mjs generar`.

### La suite

La suite completa la paró Claude Code por falta de memoria en la máquina, con 4.130 casos juzgados: no es un veredicto (un run CORTADO sólo ve lo que juzgó antes del corte) y no la relancé. En lo que juzgó, 3 rojos: `scrum1480f` (el de la fila, arreglado), `scrum1321` (cae siempre en local: temporal en C:, repo en D:) y `scrum1244c` (pasa solo: carga). Tanda dirigida de 35 ficheros (los que leen los tres bancos, los de registro, los de carriles y `1387/622/864/976`): 295/298 con mi ayudante, y sus 3 rojos explicados arriba; **DESPUÉS de los arreglos, la misma tanda ampliada a 41 ficheros (más los guards de registro y `scrum812`), sobre la punta `4270b90d38b39130b8354f4cf9d7a9c155d5a1ef`: 348/348, 0 saltados, salida 0.** El 295/298 de arriba es de ANTES: esos tres rojos ya no existen. El veredicto entero es el del CI de este PR.

**Trinquete que se mueve, y SUBE:** `scrum812` (la cobertura auto-declarada no baja), **34 → 35**: el test nuevo declara sus mutaciones y sus casos dicen CIEGO. Regenerado con la cifra del instrumento («LA COBERTURA HA SUBIDO a 35 (el suelo decía 34)»), con su copia en la mutación ④ del propio fichero, que su ancla exige. Corrige lo que le dije al orquestador antes de correr la suite («ningún trinquete se mueve»): lo dije sin medirlo.

### Sin hacer, y a quién

- **La barra superior en el banco** (la otra mitad de S2): no se toca hoy, por encargo.
- **El árbitro y los enlaces partidos en dos renglones** (Cobros, arriba): propuesta para el orquestador; es cambio de arnés.
- El texto de la excepción de las pestañas del historial en `guard-objetivo-tactil.mjs` dice «a 41,0 px»: con Inter miden 39. La excepción no la toco (las retira el fundador); su prosa queda vieja y se dice aquí.

**Reancla (24-oct, tras el rojo del #2846):** al quitar `new URL` de `_hojas-del-panel.mjs` dejé la mutación ① del test 1603 anclada a esa línea; `tests/scrum836-ancla-de-mutacion-viva.test.mjs` la cazó («el ancla `de` no está en el fichero»). Se reancló a `return r.locales.map((h) =>`, que no depende de cómo se resuelve la ruta. La comprobación que ya lo impide es ese test de 836.
