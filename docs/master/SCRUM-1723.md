# SCRUM-1723 · CSP paso 3, parte J2: las tres páginas de pago sin CSS en línea

**Medido contra:** `origin/main` = `ff2af3368930614c693353c144e521d3c50e8bc5` · 2026-11-12T16:40:57Z (cabecera `Date` de GitHub; la rama sale de ese main y no se ha movido)

A9: comprobación → `tests/scrum1415-nombres-construidos.test.mjs`

Escribe la sesión jv-j2bw (puesto J2). Excepción de carril y alcance firmados por el fundador en SCRUM-1723 c.21719
(«Sí, y las 5 páginas»). Aquí van **3 de las 5**: transferencia, Bizum y factura. **Tarjeta y Mercado Pago quedan
sin hacer**, por contexto (ver «Sin hacer»).

## PASO 0 (medido en el fuente sobre `ff2af3368`)

| página | `<style>` | `style=` |
| --- | --- | --- |
| `payBank` (transferencia) | 1 | 3 (★ obligatorio; «sin cuenta»; bloque de desarrollo) |
| `payBizum` | 1 | 1 (concepto) |
| `payInvoice` (factura) | 1 | 1 (sin métodos de pago) |
| `payCard` (fuera de este tramo) | 0 | 8 (dos páginas de error) |
| `payMp` (fuera de este tramo) | 2 | 1 (el resultado lleva `${color}` según el estado) |

Control positivo del contador: sobre `albaranPublic.routes.ts` de antes de `0151e10c8` da 1 y 2, lo que dice el commit de S1.

## Qué cambia

- `src/modules/billing/app/routes/pagoEstilo.ts` (nuevo): el `<style>` de cada página, **copiado tal cual** por
  `evidencias/SCRUM-1723/j2-generar.mjs.txt` (aborta si el CSS lleva `${` o una comilla grave), más una regla por cada
  `style=` del marcado, con las mismas declaraciones. Una hoja **por página**: las tres definen `body`, `.card` y
  `.copy-btn` de forma distinta, así que juntarlas cambiaría la cascada.
- Una sola ruta, `GET /pay/css/pago.css?p=<banco|bizum|factura>&v=<huella>`, en el router de `payInvoice.routes.ts`,
  junto al guion de SCRUM-1647. Página fuera del conjunto cerrado (`toString`, `__proto__`…): 404.
- La `<link>` ocupa el hueco del `<style>`, que es el mismo sitio de la cascada.
- `publicAccessDeclarations.ts` (S1): UNA línea, `GET /pay/css/pago.css` · `no-sensitive-resource`, firmada en c.21719.
  Declarada en `docs/equipo/dos-equipos.md` §3.4: se amplía la fila de J2 de c.21631 y los carriles se regeneran.
- Textos que ve el usuario: **ninguno** nuevo ni cambiado. El camino de dinero no se ha tocado: solo el marcado y el `<head>`.

## Medido

| qué | resultado |
| --- | --- |
| Edge 157.0.4341.46 (headless, `scripts/_navegador.mjs`), con `recorrido.mjs` y `servidor-csp.cjs` de SCRUM-1647, A = main sin política, B = main con política, C = rama con política, D = rama sin política | **A↔C 6/6 capturas idénticas** byte a byte (3 páginas × 390/1280) · A↔D 6/6 · D↔C 6/6 |
| Control: B↔C | 6/6 **distintas**. B informa `style-src-elem` 1/1/1 y `style-src-attr` 2/1/0 |
| Informes CSP en C | **0** en las tres páginas, de cualquier directiva (`script-src` incluido). Copiar 5/5 |
| Control sembrado del banco (script en línea + `onerror`) | 2 informes con la política, 0 sin ella |
| Test nuevo `tests/scrum1723-pago-sin-estilo-en-linea.test.mjs` | 7/7. Mutaciones del catálogo (`correr` + `aplicarUna`): **5/5 muertas**; control con una inocua: sale MUDA |
| `tsc -p .` con tipos | salida 0 |
| Guards dirigidos: 38 que nombran estas páginas, el fichero de rutas o los carriles, más 237, 976, 1387 (×3), 553, 98, 411, 737, 747, 1415, 1177, 700, 719, 85, 1646 y 1723 | 52 ficheros, 448 casos: 445 + 2 saltados (`scrum85`, sin `QA_DB_TEST`; **no corridos**) + 1 rojo mío (`scrum1415`), arreglado y re-corrido: 29/29 |

Resultado entero: `evidencias/SCRUM-1723/j2-recorrido.resultado.json`. Las capturas no se suben: su sha256 está en el JSON.

**Lo que el recorrido no pinta:** la transferencia «sin cuenta» y la factura «sin métodos de pago» no salen con los
datos del banco. Sus dos clases las cubre el test (HTML servido sin `style=` y la regla presente en la hoja), pero
**en navegador no están medidas**.

## Sin hacer

1. **Tarjeta y Mercado Pago** (firmadas en c.21719). Tarjeta: 8 `style=` en las dos páginas de error de
   `payCard.routes.ts`, que es el fichero del Stripe Checkout; solo se toca el literal HTML. MP: `avisoMpHtml` y el
   resultado, cuyo `<style>` lleva `${esc(s.color)}` de 4 estados cerrados, así que sale una hoja por estado
   (`?p=mp-approved`…) y la misma ruta vale. Hay que añadir sus claves a `PAGO_CSS` y subir el suelo del test de 3 a 5.
2. Guards de navegador de la casa: no corridos. Tanda entera local: NO CORRIDA (la hace el obligatorio).
   Otros navegadores y yaqu.app: no medidos.

## A9

Dos fallos míos antes de empujar, cazados los dos por máquina: un comentario con comillas graves dentro del literal
del CSS (`tsc` no compiló) y casos con nombre construido en un bucle, que cazó `scrum1415`. Este último ya está
en las cicatrices de J2 (13-oct): lo que lo impide es el guard, y esta vez estaba en la muestra local.

## SCRUM-1723c · 12-nov: tarjeta y Mercado Pago sin CSS en línea (J2)

**Medido contra:** `origin/main` = `fe9c3e7dacda63bed660cf7aaf5b9f7667de05ab` · 2026-11-12T16:54:11Z (hora de GitHub; sesión J2 `jv-j2by`, por encargo del orquestador `cobroflash-backend-63`)

A9: comprobación → `scripts/meta-guard-mutaciones.mjs`

Las dos páginas que quedaban de las cinco firmadas en c.21719. La rama lleva fusionada `scrum-1723b-css-pago`
(`a1491650`, PR #3130, que no estaba en `main`): el tramo de arriba entra con éste.

### Qué cambia

- `pagoEstilo.ts`: seis hojas más en `PAGO_CSS`, en la MISMA ruta (`GET /pay/css/pago.css?p=…`). **Ninguna línea
  nueva en `publicAccessDeclarations.ts`.**
  - `tarjeta`: las dos páginas de error de `/pay/card/:token` (409 sin Connect y 503 si Stripe falla) no llevaban
    `<style>`; sus 8 `style=` son los mismos 4 en las dos, y pasan a 4 clases `pago-tarjeta-*` con las mismas declaraciones.
  - `mp-aviso`: el `<style>` de `avisoMpHtml` (503 y 502 de `/pay/mp/:token`), tal cual.
  - `mp-approved|rejected|pending|expired`: el `<style>` del resultado llevaba `${esc(s.color)}` (3 veces); una hoja
    por estado, del conjunto cerrado de cuatro, con el color escrito. `estiloDeResultadoMp` cae a `pending` como `statusMap`.
    El `style=` del concepto pasa a `.pago-mp-concepto`.
- `payCard.routes.ts`: **solo los dos literales HTML de error** (la `<link>` antes de `</head>` y las clases). Nada del
  Stripe Checkout. `payMp.routes.ts`: la `<link>` ocupa el hueco de cada `<style>`; ni la preferencia ni el estado.
- Textos que ve el usuario: ninguno nuevo ni cambiado.

### Medido

| qué | resultado |
| --- | --- |
| CSS servido frente al `<style>`/`style=` de antes (`evidencias/SCRUM-1723/j2c-css-igual.mjs.txt`, contra `42d6f4f09`) | `mp-aviso` y los 4 `mp-<estado>` **byte a byte iguales** (los colores, leídos del `statusMap` de antes); las 4 clases de tarjeta y la del concepto, iguales a su atributo. Control sembrado (un byte cambiado): DISTINTA |
| Test `tests/scrum1723-pago-sin-estilo-en-linea.test.mjs` | 11/11 (7 de antes + 4 nuevos: 409 y 503 de tarjeta con un doble de Stripe cuyo `create` lanza, aviso 503 de MP, y los 4 estados del resultado). Suelo de hojas: 3 → 9 |
| Mutaciones del catálogo con `correr` + `aplicarUna` de la casa (`evidencias/SCRUM-1723/j2c-mutar.mjs.txt`) | **8/8 cazadas** (5 de antes + 3 nuevas); control con una inocua: **MUDA** |
| `tsc -p .` con tipos | salida 0 |

### NO MEDIDO

- **Navegador con la CSP aplicada (Edge, capturas frente a main sin política): NO MEDIDO** en tarjeta ni en MP. El
  recorrido está escrito (`evidencias/SCRUM-1723/j2c-recorrido.mjs.txt` + `j2c-servidor-csp.cjs.txt`: 7 páginas × 390/1280,
  escenarios A/B/C/D y un control sembrado de `style-src`), pero **no corrió**: `scripts/_navegador.mjs` no levantó Edge
  en esta sesión (salida 3, «CORTADA EN proceso+ws» a 0,0 s, dos tandas de 3 intentos). Lo corre un relevo, con el `dist/`
  de main en un worktree aparte. Lo que hay es la igualdad del CSS byte a byte de la fila de arriba, que no es una captura.
- Tanda entera local: NO CORRIDA (la hace el obligatorio). yaqu.app: no medido.

### A9

Dos fallos míos con el runner de mutaciones, y los dos los cazó él diciendo CIEGA en vez de un número: importé el
test desde mi guion (lo ejecutó en mi proceso) y le pasé el guard con `tests/` delante (lo resuelve dentro de
`tests/`). Y volví a pasar un guion a node por bash (`node -e`); esta vez casó, pero es la cicatriz de J2 del 1-oct.

## SCRUM-1723d · 12-nov: login y alta, ya estaba; medido (J3)

**Medido contra:** `origin/main` = `deab373d6a379fcbfc7ec1fce0428111156f49d3` · 2026-11-12T17:05:14Z (hora de GitHub; sesión J3 `jv-j3cd`, por encargo del orquestador `cobroflash-backend-63`)

A9: aviso → cicatriz J3 «Séptima vez: añadí un tramo de registro con tildes y comillas por un heredoc, con seis líneas de esta misma cicatriz encima; salió intacto, por suerte y no por control.» — no se pudo comprobar: cómo escribe una sesión en un fichero no deja rastro en el árbol

El encargo era sacar el CSS en línea del login y del alta (la descripción decía «probablemente tienen lo mismo»).
**El PASO 0 lo tumbó: ya no había nada que sacar.** Lo quitaron 1647c (#3106, login) y 1647d (#3116, alta).
Este tramo no cambia código: solo deja la medición del login en navegador, que faltaba a 390 y 1280 px.

### PASO 0 (sobre `deab373d6`)

| qué | resultado |
| --- | --- |
| `public/login.html` · `public/register.html` | 0 `<style>` y 0 `style=` en las dos; solo `<link>` a `/fonts/inter.css`, `/tokens.css` y `/auth.css` |
| Control positivo del contador | sobre `9cdf6a24d` (antes de 1647c): 2 `style=` en cada página |
| HTML que inyectan los guiones (`loginNavegador.ts`, `altaNavegador.ts`) | 0 `style=`; solo `el.style.display`, que es CSSOM y la CSP no lo bloquea |
| Alta con la CSP aplicada | ya medida en 1647d: `evidencias/SCRUM-1647/1647d/salida.txt`, 4/4 idénticas (390/1280, con y sin invitación), alta con invitación completa, 0 informes |
| ¿Algo cambiado desde entonces? | `git log` sobre esos ficheros, `auth.css`, `tokens.css`, `public/fonts`, `src/modules/auth`, `huellaEstaticos.ts` y `csp.ts`: 0 commits desde `7786988f5`, y 0 desde `deab373d6` hasta `ebee34073` |

### Medido: el login en navegador con la CSP aplicada

Guion: `evidencias/SCRUM-1723/j3d-recorrido-login.mjs.txt`, sobre el servidor de 1647d (`evidencias/SCRUM-1647/1647d/servidor-alta.cjs`:
la `app` real de un `dist/`, prisma doblado, la cabecera de 1637 escrita como `Content-Security-Policy` o quitada).
Edge 157.0.4341.46. Vistas: `/login.html` y `/login.html?error=invalid_token` (caja de aviso abierta por el guion), a 390 y 1280 px.
Salida entera y capturas: `evidencias/SCRUM-1723/j3d/` (`salida.txt`, `resultado.json`, 16 capturas).

| comparación | resultado |
| --- | --- |
| main de hoy sin política ↔ main de hoy **con** política | **4/4 IDÉNTICAS** byte a byte · **0 informes** de cualquier directiva |
| main de antes de 1647c sin política ↔ main de hoy sin política | 4/4 idénticas |
| **Control:** main de antes sin política ↔ con política | 4/4 **distintas** · 12 informes (`style-src-attr` 2 + `script-src-elem` 1 por carga) |
| Control sembrado (`<script>` en línea + `onerror`) | 2 informes con política, 0 sin ella |
| Recursos propios que faltan · lecturas de la base | 0 · 0 |

**Ojo con el control:** no sale «sin estilos». El login nunca tuvo `<style>`; solo tenía 2 `style="display:none"`.
Con la política, lo que cambia en main de antes es que la caja de aviso vacía se ve y ocupa sitio
(`B-antes-aplicada-login-1280.png`: hueco entre el botón y «¿Primera vez?»).

### NO MEDIDO

- yaqu.app; otros navegadores. Tanda entera local: NO CORRIDA (la hace el obligatorio).
- El recorrido del enlace mágico bajo la política no se repitió aquí: lo midió 1647c (tramo 1647c de `SCRUM-1647.md`).

## SCRUM-1723e · 12-nov: tarjeta y Mercado Pago medidas en navegador con la CSP aplicada (J2, solo medir)

**Medido contra:** `origin/main` = `deab373d6a379fcbfc7ec1fce0428111156f49d3` · 2026-11-12T17:13:11Z (hora de GitHub; sesión J2 `jv-j2c0`, por encargo del orquestador `cobroflash-backend-63`)

A9: aviso → cicatriz J2 «el recorrido de SCRUM-1723c llamó `lanzarNavegador()` sin puppeteer y la sesión lo dio por un Edge que no arranca: el lanzador se traga el TypeError y lo imprime como «CORTADA EN proceso+ws» a 0,0 s, igual que un navegador que no levanta» — no se pudo comprobar: el recorrido vive en evidencias como .txt y ningún test lo ejecuta

Edge 157, rama de #3132 fusionada sobre main, 7 páginas × 390/1280: **rama con política ↔ main sin política 14/14 idénticas**, **0 informes** en la rama (ni `style-src` ni `script-src`); control main con política 0/14 iguales y 34 informes (`style-src-attr` 12, `style-src-elem` 10), sembrado 2/2. Edge sí arranca: el «NO MEDIDO» de 1723c era el recorrido sin puppeteer (corregido solo en la copia, `evidencias/SCRUM-1723/j2e-recorrido.*`). La rama fusionada chocaba con main en `dos-equipos.md`: resuelto con las dos filas y carriles regenerados (`comprobar` = IGUAL). No medido: otros navegadores, yaqu.app, tanda entera.
