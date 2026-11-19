# SCRUM-1756

## SCRUM-1756b · 18-nov: recibo público y portal del cliente sin CSS en línea (J2)

**Medido contra:** `origin/main` = `65b2e3b2a03a4a5cb6119b9b7e33465b89494769` · 2026-11-18T05:11:12Z (hora de GitHub; sesión J2 `jv-j2d1`, por encargo del orquestador `cobroflash-backend-ee`; la rama lleva main fusionado)

A9: aviso → cicatriz J2 «pasé una mutación por `sed -i` con `\n` dentro de la cadena y la escribió como un salto de línea REAL: el guion de mutaciones quedó con una cadena partida; lo vi al leer la salida antes de correrlo y lo rehíce con la herramienta de edición» — no se pudo comprobar: lo que se teclea en la consola no lo ve ningún guard

Las dos filas de J2 de la tabla de SCRUM-1756. Receta de SCRUM-1723b/c, sin ruta nueva y sin tocar
`publicAccessDeclarations.ts`.

### PASO 0 (sobre `8c8c2b7c2`)

0 commits en main con SCRUM-1756, 0 ramas `scrum-1756*` (control positivo: `scrum-1732c-invoice-payments` sí sale),
0 PR, ticket con 0 comentarios. HTML **servido** (sonda `evidencias/SCRUM-1756/contar-html.mjs.txt`, `dist` de main,
prisma doblado): recibo pagado 2 `<style>` y 9 `style=`; pendiente 1 y 9; portal 1 y 19 (8 en el fuente: la etiqueta
de estado se repite por tarjeta); portal 404 1 y 2. Control sembrado: 1 y 1.

### Qué cambia

- `src/modules/billing/app/routes/reciboPortalEstilo.ts` (nuevo): tres hojas, **copiadas tal cual** por
  `evidencias/SCRUM-1756/generar.mjs.txt` (aborta ante `${`, comilla grave, CR o un ancla que no esté las veces esperadas):
  `recibo` (el `<style>` de la cabecera + 9 clases), `recibo-valoracion` (el `<style>` del bloque de valoración, solo con
  el cobro pagado; su `<link>` queda dentro del bloque, después de la del recibo, como antes) y `portal` (el `<style>` +
  las clases de sus 8 `style=`). La etiqueta de estado del portal pintaba `${c.bg}`/`${c.fg}` de un mapa cerrado: el mapa
  se muda a la hoja y sale una clase por estado, con el gris de antes para un estado desconocido.
- `pagoEstilo.ts`: las tres hojas se sirven por la MISMA ruta, `GET /pay/css/pago.css?p=<hoja>&v=<huella>` (declarada en
  SCRUM-1723 c.21719: recurso constante, sin datos). Van en su propio mapa: `PAGO_CSS` no cambia y el suelo de 9 del test
  de 1723 sigue intacto. `payInvoice.routes.ts`: la ruta sirve `cssDeHoja(pagina)`.
- `receipt.routes.ts` y `customerPortal.routes.ts`: la `<link>` en el hueco de cada `<style>` y las clases. Nada de cómo se
  calcula, cobra o sella. Textos que ve el usuario: **ninguno** nuevo ni cambiado.

### Medido

| qué | resultado |
| --- | --- |
| Sonda del HTML servido, rama | recibo pagado / pendiente, portal y portal 404: **0 `<style>` y 0 `style=`** en las cuatro |
| `tests/scrum1756b-recibo-portal-sin-estilo-en-linea.test.mjs` + el de 1723 | 18/18 (7 nuevos + 11). Rojo primero: sobre main no carga (falta la hoja) — el rojo de contenido lo da la sonda de arriba |
| Edge (`scripts/_navegador.mjs`), `evidencias/SCRUM-1756/recorrido.*` + `servidor-csp.cjs.txt`, 5 vistas (recibo pagado con valoración y bloques de desarrollo, pendiente, fallido; portal con 8 estados; portal 404) × 390/1280 | **A main sin ↔ C rama con política aplicada: 10/10 idénticas** byte a byte · A↔D 10/10 · **control B main con ↔ C: 0/10** |
| Informes CSP en C | **0 de `style-src*`**. Sí hay **8 de `script-src-elem`**: recibo pagado 1 por carga, portal 2, portal 404 1 (ver «Sin hacer») |
| Informes en B (control) | 118 (`style-src-elem`, `style-src-attr`, `script-src-elem`); sembrado 2/2 con política en B y C, 0 sin ella |
| Mutaciones: `MUTACIONES_QUE_ME_TUMBAN` con `correr` + `aplicarUna` de la casa (`evidencias/SCRUM-1756/mutar.mjs.txt`) | **6/6 cazadas**; base limpia 7/7; control inocuo: **MUDA** |
| `tsc -p . --noEmit` con tipos | salida 0, 0 errores |

Mutaciones: `tests/scrum1756b-recibo-portal-sin-estilo-en-linea.test.mjs` → 6/6 (catálogo de la casa; `evidencias/SCRUM-1756/mutar.mjs.txt`).

Error propio en la medida, cazado por el control A↔D: la primera pasada dio **0/10** en A↔D porque compilé el `dist` de
main fuera del árbol y no encontraba `public/` (`inter.css` 404 solo en los puertos de main). Con el `dist` de main
dentro del árbol: 10/10. Lo único que queda en «recursos que faltan» es `favicon.ico` en los cuatro escenarios (el recibo
no lleva `<link rel="icon">`, también en main).

### Sin hacer

1. **Los `<script>` en línea (paso 2) — filas nuevas para la tabla de SCRUM-1756**: `receipt.routes.ts:383` (estrellas de
   valoración), `customerPortal.routes.ts:180` (desplegar líneas y formulario de solicitud) y `:574` (interpola la URL de
   la solicitud). Con la política aplicada dan `script-src-elem` y esos botones dejan de responder. Decisión del orquestador
   (mensaje a esta sesión, 18-nov): rama aparte `scrum-1756c-js-recibo-portal`, para un relevo; esta sesión no tiene contexto.
2. Tanda entera local: la parte corrida está en la entrega de Jira; otros navegadores y yaqu.app: no medidos.

## SCRUM-1756c · 18-nov: recibo público y portal del cliente sin `<script>` en línea (J2)

**Medido contra:** `origin/main` = `65b2e3b2a03a4a5cb6119b9b7e33465b89494769` · 2026-11-18T05:33:55Z (hora de GitHub; sesión J2 `jv-j2d2`, por encargo del orquestador `cobroflash-backend-ee`; rama `scrum-1756c-js-recibo-portal` sobre `scrum-1756b-css-recibo-portal` @ `5e5b1e99c`, que ya lleva main fusionado)

A9: aviso → cicatriz J2 «el recorrido del portal iba a pulsar «Enviar solicitud» con la URL de `data-url`, que es `${BASE_URL}/cliente/…`: sin fijar `PUBLIC_BASE_URL`, el navegador del recorrido la habría mandado a donde dijera el entorno de la máquina; lo vi al leer `env.ts` antes de correrlo» — no se pudo comprobar: el recorrido en navegador no lo ejecuta ningún test

### Qué cambia

Las tres filas que `jv-j2d1` declaró en c.22010, con la receta de SCRUM-1647 (c.21631):

- `receipt.routes.ts` · el `<script>` de las estrellas de la valoración (solo con el cobro pagado) → `${etiquetaGuionDePago('recibo')}`, en el mismo hueco, después del formulario.
- `customerPortal.routes.ts` · el `<script>` del pie de toda página del portal (desplegar líneas y «Solicitar nuevo presupuesto»; también el 404) → `${etiquetaGuionDePago('portal')}`.
- `customerPortal.routes.ts` · `<script>window.PF_REQUEST_URL = "…"</script>`, que interpolaba la URL → fuera. La URL va en `data-url` del `#pf-req-form`, escapada con `esc`.

El código va a dos ramas nuevas de `PAGO_JS` (`pagoNavegador.ts`: `data-pagina="recibo"` / `"portal"`), que sigue siendo una cadena constante sin `${`. Las dos ramas salen antes del escuchador del logo, que esas páginas no tenían. **Ruta: la MISMA `GET /pay/js/pago.js?v=<huella>`**, ya declarada en `publicAccessDeclarations.ts` (SCRUM-1647). **Ninguna ruta nueva** y ese fichero sin tocar; el portal ya usaba `/pay/css/pago.css` desde 1756b. **Cero textos nuevos:** «Enviando…», «Enviar solicitud», los dos `alert` y ▲/▼ son los mismos, movidos de sitio. La huella de `pago.js` cambia, así que las páginas de pago piden el guion nuevo, que les hace lo mismo.

### Medido

- **Rojo primero:** `tests/scrum1756c-recibo-portal-sin-script-en-linea.test.mjs` sobre la rama sin el arreglo: 6 casos, 1 pasa (el control) y 5 caen por su aserción, no por los suelos. Con el arreglo, 6/6; junto con `scrum1756b` y `scrum1647`, 22/22. Tipos con cliente Prisma propio: salida 0.
- **Navegador** (Edge del arnés, `scripts/_navegador.mjs`; `evidencias/SCRUM-1756/j2d2-recorrido.*`). B = antes de este tramo (`5e5b1e99c`) con la CSP de 1637 aplicada, C = rama aplicada, D = rama sin política. Control sembrado: un `<script>` en línea da `script-src-elem` y no corre en B y C; en D, sí corre.
  - C y D: la 3.ª estrella pone `stars=3` y enciende 3; enviar sin estrella no navega; desplegar abre y pone ▲; «Solicitar» abre el formulario; enviar llega al servidor por `/cliente/portal1756/quote-request` y pinta el aviso. **0 informes CSP** en recibo, portal y 404. 0 peticiones fuera de 127.0.0.1 y 0 diálogos.
  - B (el control): `stars=""`, 0 encendidas, enviar sin estrella sí navega, no despliega, el formulario no se abre, 0 solicitudes, y `script-src-elem` en las tres páginas.
  - El POST de la solicitud lo contesta el servidor del recorrido, sin llegar a la app: no se envía nada (regla 28).
- **Muestra de guards (no es la suite entera):** 74 ficheros, los que nombran estos ficheros o estas rutas, más los que recorren el árbol y los registros. Resultado: 641 casos, 632 pasan, 2 caen y 7 saltados (gateados por base: 1390e ×4, 72, 74 y 967b). Los 2 rojos eran míos. `scrum237` cayó porque una negación de `PF_REQUEST_URL` no tenía su positivo con el mismo token, y `scrum976` cayó por arrastre. Arreglado con el positivo en el control sembrado, y vuelto a correr: 237, 976, 1756c, 1294, 267 y 273, 49/49.

Mutaciones: `tests/scrum1756c-recibo-portal-sin-script-en-linea.test.mjs` → 4/4 (catálogo de la casa, `correr` + `aplicarUna`; inocua de control MUDA; `evidencias/SCRUM-1756/j2d2-mutar.*`).

### Sin hacer

- La suite entera en local. Otros navegadores. yaqu.app. Enviar de verdad una solicitud (toca WhatsApp: regla 28).
- El paso 3 (`csp.ts` a aplicada) no es de este tramo.

## SCRUM-1756d · 18-nov: landing, precios, términos y `/legal/*` sin CSS en línea; privacidad pendiente de decisión; tres filas clasificadas (J3)

**Medido contra:** `origin/main` = `65b2e3b2a03a4a5cb6119b9b7e33465b89494769` · 2026-11-18T05:29:57Z (hora de GitHub; sesión J3 `jv-j3cg`, por encargo del orquestador `cobroflash-backend-ee`; la rama sale de ese main y no se ha movido)

A9: aviso → cicatriz J3 «Monté un recorrido de capturas sin repetir la base contra sí misma: la primera pasada dio la landing distinta también sin política, y era una animación infinita que el movimiento reducido no para, no el CSS movido.» — no se pudo comprobar: el recorrido vive en evidencias como .txt y ningún test lo ejecuta

Las filas J3 de la tabla de la descripción. Excepción de carril firmada por el fundador en SCRUM-1756 c.22008: hojas
estáticas nuevas en la raíz de `public/` (patrón de S2), con el patrón de `public/login.html` → `/auth.css`.

### PASO 0 (sobre `65b2e3b2a`, que no tocó ninguno de estos ficheros desde `35153debf`)

| fichero | `<style>` | `style=` | qué es |
| --- | --- | --- | --- |
| `public/index.html` | 1 | 2 | landing |
| `public/precios.html` | 1 | 3 | dos son `display:none` que destapa el guion en línea |
| `public/privacidad.html` · `public/terminos.html` | 1 · 1 | 0 · 0 | el MISMO `<style>` en las dos (byte a byte) |
| `legalPages.routes.ts` (`legalShell`) | 1 | 0 | `/legal/alcance-beta` |

Nadie lo tenía: 0 commits con SCRUM-1756 en main, 0 PR con 1756 en la cabeza; en el remoto sólo `scrum-1756b-css-recibo-portal` (J2).

### Qué cambia

- Cuatro hojas nuevas, cada una el `<style>` de main **copiado tal cual** por `evidencias/SCRUM-1756/j3d-generar.mjs.txt`
  (que con `--comprobar` sale IGUAL en las cuatro; aborta si el CSS del literal de plantilla lleva `${`, comilla grave o
  barra invertida), más una regla por cada `style=`, con las mismas declaraciones:
  `landing.css` (+ `.landing-firma-titulo`, `.landing-ancho-completo`), `precios.css` (+ `.precios-empezar`,
  `.precios-oculto`), `legal.css` (hoy sólo términos; privacidad lleva el mismo `<style>`, ver abajo) y `legal-documento.css` (`legalShell`). Hoja por página
  donde las reglas chocan (`body`, `h1`, `.card`…).
- La `<link>` ocupa el hueco del `<style>`, que es el mismo sitio de la cascada.
- **Precios:** el banner founding y el precio tachado nacen ocultos por `.precios-oculto` (va detrás de `.founding`,
  que pone `display:flex`). El guion los destapaba con `style.display = 'flex'` y `style.display = ''`; el segundo ya
  no destaparía nada con la clase puesta, así que los dos pasan a `classList.remove('precios-oculto')`.
- `legalPages.routes.ts` enlaza `/legal-documento.css`: **ninguna ruta nueva**, `publicAccessDeclarations.ts` sin tocar.
- `docs/equipo/dos-equipos.md` §3.4: una fila por hoja (J3, c.22008) y carriles regenerados (`comprobar` = IGUAL).
- Textos que ve el usuario: **ninguno** nuevo ni cambiado.

### Medido

| qué | resultado |
| --- | --- |
| `tests/scrum1756d-publicas-sin-estilo-en-linea.test.mjs` | rojo primero (6/7 caen; pasa sólo el control sembrado), verde después **7/7** |
| Mutaciones del catálogo con `correr` + `aplicarUna` de la casa (`evidencias/SCRUM-1756/j3d-mutar.mjs.txt`) | **5/5 cazadas**; control con una inocua: **MUDA** |
| Edge 157.0.4341.60, `prefers-reduced-motion: reduce`, animaciones congeladas en su instante 0; 8 vistas × 390/1280 (las cinco páginas, landing y precios con plazas founding, la demo de la landing en la pantalla de firma) | A↔A2 (main contra main) **16/16 idénticas** · A↔I **16/16 idénticas** · A↔D **16/16 idénticas** · 0 informes en I ni en D |
| Control: A↔B (main con política) | **0/16 iguales** · B da `style-src-elem` 16 y `style-src-attr` 24 |
| C = rama con la política ENTERA | `style-src`: **0**. `script-src-elem`: **10** (1 por carga de landing y precios: su `<script>` en línea). Por eso la landing y precios-con-plazas salen distintas en C (8/16 iguales): el guion no corre, no es el CSS |
| Sembrado (`<script>`, `onerror`, `<style>`, `style=`) | B y C: las cuatro directivas; I: sólo `style-src` (elem y attr), sin `script-src` |

A = main sin política · B = main con política · C = rama con política · I = rama con política salvo `script-src
'unsafe-inline'` (sólo para separar el CSS del guion en línea) · D = rama sin política. Servidor:
`evidencias/SCRUM-1756/j3d-servidor.cjs.txt` (copia del de 1647d con el modo `aislada`). Salida y resultado:
`j3d-recorrido.salida.txt` y `j3d-recorrido.resultado.json` (las capturas no se suben; su sha256 está en el JSON).

### Clasificadas: no aplica

| fichero | por qué (la línea que lo prueba) |
| --- | --- |
| `src/modules/auth/domain/auth.service.ts` (4 `style=`) | líneas 112-113 y 233-234: `bodyHtml` de `renderEmailLayout`, que va a `sendEmail` (enlace mágico e invitación). Correo: la CSP no aplica |
| `src/modules/system/domain/soporte.ts` (1) | línea 99: `html` de `construirCorreoSoporte`; `soporteAdmin.routes.ts` lo pasa a `enviarCorreo` y contesta JSON. Correo |
| `src/modules/auth/app/routes/altaNavegador.ts` (2) | líneas 7 y 13: comentarios `//` que cuentan cómo 1647d los quitó. Confirmado c.21747 |

### `public/privacidad.html`: PENDIENTE DE DECISIÓN (sin tocar en este PR)

Sacarle el `<style>` tumba `tests/scrum1196-fecha-de-la-politica.test.mjs`: «SCRUM-1196 · 🔴 EL QUE DECIDE: la fecha
NO es anterior al último cambio de la página» (compara la cabecera con `git log`; su comentario avisa de que un cambio
sólo de formato también obliga). El arreglo sería mover el texto visible «Última actualización: 30 de septiembre de
2026» al día de publicación. Decisión del orquestador J (18-nov, por mensaje): **salida B**, privacidad se queda como
en main y su fila sigue abierta. Las dos salidas, para el fundador: ① mover la fecha con su firma (la forma está
firmada en SCRUM-1196 c.17453, pero decir que la política cambió por un cambio de CSS es decisión suya), o ② esperar a
la próxima edición real de la política y sacar el `<style>` en ese mismo PR. `legal.css` ya existe (lo usa términos)
y es byte a byte el `<style>` de privacidad: ese PR sólo cambia el `<style>` por `<link rel="stylesheet" href="/legal.css"/>`.
El recorrido de arriba se midió con privacidad ya cambiada (commit `57e531077`): 4/4 idénticas, 0 informes; eso
sirve para cuando se haga.

### Fila nueva para SCRUM-1756 (no es de este tramo)

`<script>` en línea que bloquea `script-src 'self'`: `public/index.html` 1 (la demo, la aparición al hacer scroll y
las plazas founding) y `public/precios.html` 1 (las plazas founding). Medido arriba: 10 informes `script-src-elem`
en C. Con la política entera, precios con plazas no destapa ni el banner ni el tachado. El `application/ld+json` de
la landing no da informe.

### NO MEDIDO

- yaqu.app; otros navegadores. `prefers-reduced-motion: no-preference` (las animaciones de la landing en marcha).
- `SCRUM-1756.md` lo crea también 1756b (J2, rama `scrum-1756b-css-recibo-portal`, sin mergear al escribir esto): las
  dos ramas CREAN el fichero. Lo vigila scrum1572 en CI.

### Relevo · 18-nov · jv-j3ch (J3): main unido, los tests de la landing leen la hoja, 498/541 clasificados, suite

**Medido sobre:** `origin/main` = `bcff9d8b1ea465938ef797c17548cb5217de02bc` · 2026-11-18T15:35:01Z (cabecera `Date:` de GitHub) · sesión `jv-j3ch`, por encargo del orquestador `cobroflash-backend-ee`. La rama del PR #3209 estaba en `2b20d4c89` (sólo el merge del bot encima de `58f4312d5` de jv-j3cg).

**Skill UI:** no cargada · el relevo no toca `public/`: sólo tests, un censo de `scripts/` y registros. Lo de `public/` es de jv-j3cg (el CSS en línea pasado tal cual a hojas, capturas idénticas byte a byte); si ella cargó la skill no consta en su tramo, y no lo afirmo.

A9: comprobación → `tests/scrum676-hojas-del-indice.test.mjs`

(El fallo: mi primer lector de la hoja enlazada llevaba su propia regex de `<link>`, y la del test de 1756d otra; el guard de un solo extractor las cazó en el tramo 12 y ahora las dos derivan de `hojasDeLaPagina`.)

- **Merge de `origin/main`** (`bcff9d8b1`): `.claude/carriles.json` tomado de main y regenerado (`carriles.mjs comprobar` = IGUAL; la primera pasada dio «ambigua ×3» porque el fichero seguía en conflicto en el índice: tras `git add`, limpio); `docs/equipo/dos-equipos.md` §3.4 con las filas de las DOS ramas (las 4 de 1756d y la de SCRUM-1755). Cero marcadores. `tsc -p .` con tipos: salida 0. Guard del cliente de Prisma: ✔.
- **El registro entrelazado:** el merge del bot `2b20d4c89` había entrelazado este fichero (lo crearon las dos ramas; lo cazó `scrum1572` en el tramo 6). Se rehízo: 1756b y 1756c tal cual están en main, y 1756d detrás tal cual lo dejó `58f4312d5`. Control: 0 de 179 líneas no vacías de las dos versiones faltan.
- **Los tests que leían el CSS dentro de `index.html`:** `scrum541`, `542`, `543`, `544` y `333` leen ahora la landing CON las hojas que enlaza (`tests/_pagina-con-sus-hojas.mjs`, que saca la hoja del `<link>` de la propia página con `hojasDeLaPagina`); el censo de `scrum562` (`scripts/censo-arbitro-de-toque.mjs`) cuenta las reglas de la hoja enlazada con su página, y las hojas que ya están en su superficie (`tokens.css`, `auth.css`) una vez. **Ninguna aserción, ningún umbral ni ningún literal esperado cambia**: los cinco candidatos de 562 siguen saliendo como `public/index.html — …`. Antes del cambio, 541+542+543+544+562: 13 rojos; después, 0.
- **Rojos propios de la rama que cazó la suite y no estaban en la lista de jv-j3cg:** `scrum1415` (el test de 1756d construía el nombre de sus 4 casos en un bucle; ahora `casosEscritos`, nombres escritos), `scrum676` (arriba), `scrum811c` (este tramo no declaraba `**Skill UI:**`; ahora sí), `scrum1572` (arriba) y `scrum333` (la misma causa que 541-544).
- **498:** verde hoy (tramo 11). Su caso «los DOS instrumentos dan la misma lista, o hay un cliente desparejado» compara el cliente de Prisma con el esquema; hoy el guard del cliente da ✔ tras regenerarse el compartido con main. → **entorno**, deducido de qué compara: no re-medido en el árbol de jv-j3cg.
- **541:** de **la rama**, misma causa que 542-544 (busca `.cmp-lbl{display:block` en `index.html`). Arreglado como ellos.
- **`scrum351`** («sin `node_modules` en ningún ancestro: SIN DEPENDENCIAS»): **entorno**. Existe `C:\Users\Javier Pereira\node_modules` (fecha 13-nov, con `@prisma` dentro), ancestro del temporal donde el test monta su árbol «sin dependencias». No es de esta rama y no lo he borrado.

### Suite (un tramo por comando, sobre esta rama con main unido)

| tramo | casos | rojos | qué |
|---|---|---|---|
| 4 | 1106 | 0 | |
| 5 | 1043 | 1 | `scrum1415` → arreglado |
| 6 | 681 | 1 | `scrum1572` → arreglado |
| 7 | 685 | 0 | |
| 8 | 854 | 0 | |
| 9 | 1095 | 2 | `scrum333` → arreglado · `scrum351` → entorno |
| 10 | 992 | 0 | |
| 11 | 1184 | 1 | `scrum541` → arreglado |
| 12 | 1119 | 1 | `scrum676` → arreglado |
| 13 | 879 | 0 | |
| 14 | 940 | 1 | `scrum811c` → arreglado |
| 15 | 1001 | 1 | `scrum976` ④ (corre los guards de entrada: arrastre de los de arriba; ver la re-pasada) |

Los tramos 1-3 los corrió jv-j3cg sobre su rama sin main; la re-pasada final, en el comentario de entrega de Jira.

## SCRUM-1756e · 18-nov: el paquete de disputa sin CSS en línea (J1)

**Medido contra:** `origin/main` = `51efbb280039077d30599604fbaea1b809cf41a3` · 2026-11-18T16:31:12Z (cabecera `Date:` de GitHub; sesión J1 `jv-j1fi`, por encargo del orquestador `cobroflash-backend-ee`; la rama sale de ese main y no se ha movido)

**Skill UI:** no cargada · el tramo no cambia nada visible: el `<style>` pasa tal cual a una hoja y cada `style=` a una clase con la misma declaración; el aspecto en navegador NO se ha medido (abajo).

A9: comprobación → `scripts/meta-guard-mutaciones.mjs`

Escribí el arreglo antes que el test: el rojo lo vi después, compilando el fichero de main en `dist` y volviendo al mío. Y copié el guion de mutaciones de 1756c con `sed`, y dos sustituciones (las que llevaban `\n` y comillas) no casaron sin dar error: la inocua seguía apuntando a una cadena de `receipt.routes.ts`. Lo cacé con un `grep` antes de correrlo; si no, `aplicarUna` la habría dado CIEGA («el ancla no está»), y el guion sale 1 sin una inocua MUDA.

### PASO 0 (sobre `51efbb280`)

- Ni rama `scrum-1756e*` en el remoto, ni commit en main con «1756e», ni PR (`gh pr list --search 1756`: sólo #1756, otro ticket, y #3209 = 1756d).
- `invoicesAdmin.routes.ts` → J1 (`carriles.mjs de`). En main, igual que en el encargo: `<style>` en :433, tres `style="width:…"` en :478 y `style="margin-top:26px"` en :485.
- No toca la emisión: sólo el handler de `GET /:id/dispute-package` (lee factura, presupuesto y mensajes y pinta HTML) y una ruta nueva DENTRO de este router, junto a la del guion de imprimir (SCRUM-1647f). `rectify` y `POST /` sin tocar.

### Qué cambia

- `DISPUTA_CSS`: el cuerpo del `<style>` de main, byte a byte, más cuatro reglas al final (`.disputa-col-fecha{width:170px}`, `.disputa-col-tipo{width:110px}`, `.disputa-col-estado{width:110px}`, `.disputa-pie{margin-top:26px}`). Van detrás de `th{…width:220px}` y de `.sub{…}` para ganarles como les ganaba el atributo.
- `GET /admin/invoices/css/disputa.css` (`RUTA_DISPUTA_CSS`): mismo `requireRole('admin')` que la página, `text/css; charset=utf-8`, `private, no-cache`. **No es ruta pública**: `publicAccessDeclarations.ts` sin tocar.
- El HTML enlaza `<link rel="stylesheet" href="/admin/invoices/css/disputa.css"/>` donde iba el `<style>`, y los cuatro `style=` pasan a esas clases. **Ni un texto nuevo ni cambiado.**

### Medido

- `tests/scrum1756e-paquete-disputa-sin-estilo-en-linea.test.mjs`, 5 casos, por la capa de la ruta (gate incluido) del router real de `dist` con `prisma` doblado. Rojo primero con el fichero de main compilado: 4 de 5 caen por su aserción (0 `<style>`, la clase en el marcado, el export de la hoja, la ruta); pasa el control sembrado, que copia el marcado de main y da 1 `<style>` y 4 `style=`. Con la rama: 5/5.
- Con los otros tests del paquete (`scrum1647f`, `scrum342`, `scrum1727`, `scrum1726`, `scrum1576b`): 33 casos, 33 pasan.
- `tsc -p . --noEmit` con tipos: salida 0.

Mutaciones: catálogo → `tests/scrum1756e-paquete-disputa-sin-estilo-en-linea.test.mjs` (5/5 cazadas con `correr` + `aplicarUna`; la inocua de control sale MUDA; `evidencias/SCRUM-1756/j1-mutar.*`).

- **Rojo propio que cazó la suite:** `scrum1436d` (tramo 5). Su caso del paquete quitaba el `<style>` antes de buscar importes en crudo, porque las cifras del CSS no son importes, y su control exigía haber quitado algo. Sin `<style>` en la página, ese control caía: «CIEGO: no se ha quitado la hoja de estilo». Ahora el control exige lo contrario (ningún `<style>` y la hoja enlazada) y el importe en crudo se busca en el HTML ENTERO. La aserción del importe no cambia, y mira más texto que antes. Comprobado que sigue cazando: con «1419.87 EUR» sembrado a mano en el `dist` del paquete, cae «queda un importe en crudo en el paquete: «9.87 EUR»»; luego recompilado y vuelto a verde.
- **Suite entera**, un tramo por comando, todos sobre la misma pasada (`--resumen 15`, pasada `8f2d6fed7a0377ae`): 15 de 15 tramos, 1709 ficheros, 13.861 casos, 13.677 pasan y 2 caen. Los 2 son `scrum1298b` (el latido y los hooks del árbol principal), que jv-j3cg midió cayendo en main limpio (tramo 1756d). Yo no lo he vuelto a medir, y este diff no toca hooks ni el latido. Los 182 restantes son saltados, que no he enumerado.
- Guards dirigidos (1294, 267, 273, 525d, 854, 1415, 676, 811c, 757, 745, 1321, 237, 976, 1572 + el test nuevo): 146 casos, 146 pasan. `meta-guard-mutaciones.mjs --solo-censo`: salida 0, y el test nuevo entra con sus declaraciones.

### NO MEDIDO

- **El navegador.** Ni capturas a 390/1280 ni informes CSP: el paquete pide una factura de la base y sesión de admin, y en esta máquina no hay Postgres; tampoco me cabía en el contexto montar el servidor de 1756 con el paquete doblado. Lo que sí está medido es que la hoja contiene el `<style>` de main byte a byte y que cada clase lleva la declaración de su `style=`, en el orden que gana.
- yaqu.app y el check obligatorio.

### Fila J1 de la tabla

| fichero | `<style>` | `style="` | estado |
| --- | --- | --- | --- |
| `src/modules/system/app/routes/invoicesAdmin.routes.ts` | 1 → 0 | 4 → 0 | hecha en la rama `scrum-1756e-css-paquete-disputa`, PR del bot pendiente |

(La tabla de la descripción dice 2 `style="` para este fichero porque `git grep -c` cuenta líneas: los tres `<th>` van en una.)
## SCRUM-1756f · 18-nov: landing y precios sin `<script>` en línea → `public/landing.js` y `public/precios.js` (J3)

**Medido contra:** `origin/main` = `64ec33eecace555eaca35bb034e62a22b88b3f9e` · 2026-11-18T16:54:25Z (hora de GitHub; sesión J3 `jv-j3ci`, por encargo del orquestador `cobroflash-backend-ee`; al empujar, main iba por `dd26ef66f`, que no toca ninguno de estos ficheros)

A9: comprobación → `tests/scrum1756f-publicas-sin-script-en-linea.test.mjs`

Mutaciones: catálogo → `tests/scrum1756f-publicas-sin-script-en-linea.test.mjs` (4/4 cazadas con `correr` + `aplicarUna`; inocua de control MUDA; `evidencias/SCRUM-1756/j3ci-mutar.*`).

**Skill UI:** no cargada · cero cambios visibles: el guion pasa byte a byte a un `.js` y la etiqueta queda en el mismo sitio; lo visual lo prueba el recorrido en Edge (capturas idénticas byte a byte), no la skill. Es la misma omisión que la cicatriz J3 del 22-oct, y lo digo.

La fila nueva de c.22017 (paso 2). Excepción de carril firmada por el fundador en SCRUM-1756 c.22082 ① («Sí firmo»): dos guiones estáticos nuevos en la raíz de `public/` (patrón de S2), declarados en `dos-equipos.md` §3.4 (`carriles comprobar` = IGUAL). `public/privacidad.html` NO se toca (c.22082 ②).

| fila | estado | dónde se ve |
| --- | --- | --- |
| `public/index.html` `<script>` en línea :420-511 | → `public/landing.js` (5.548 B), `<script src="/landing.js">` en el mismo sitio, sin `defer` (se ejecuta en el mismo punto del análisis que el guion en línea) | `tests/scrum1756f-publicas-sin-script-en-linea.test.mjs` |
| `public/precios.html` `<script>` en línea :56-77 | → `public/precios.js` (1.479 B), ídem | ídem |
| `public/index.html` `<script type="application/ld+json">` :27-49 | **se queda**: son datos, no código. Medido: con la política aplicada, la landing de la rama da 0 informes con él puesto | `evidencias/SCRUM-1756/j3ci-recorrido.salida.txt` |

- **Byte a byte:** el texto de cada `.js` es el de las líneas estrictamente entre `<script>` y `</script>` de main, más un salto final. Lo midieron dos sondas: la que lo movió y otra por `indexOf` sobre `git show 64ec33eec:…`. Las dos dan el mismo sha-256 (`a19bfdd7…` y `947ed1a9…`), que el test fija.
- **Servido sin declarar nada:** `GET /landing.js` y `GET /precios.js` contestan 200 `application/javascript` por la `app` de `dist/`, el mismo estático que sirve `/js/atribucion.js`. No se ha tocado nada de S1 (`publicAccessDeclarations.ts`, `csp.ts`, `app.ts`).
- **Rojo primero:** en un árbol de main (`64ec33eec`), el test sale 4/5 rojo por su aserción («/ lleva un `<script>` en línea…», «/landing.js no existe»). Con la rama, 5/5 verde. El control sembrado pasa en los dos.
- **Lectores que leían el guion dentro del HTML** (se rompieron 18 casos en 5 ficheros al moverlo): `scrum1130`, `scrum330`, `scrum544` y `scrum1756d` ③ leen ahora la página CON sus guiones (`tests/_pagina-con-sus-guiones.mjs`, gemelo de `_pagina-con-sus-hojas.mjs`, con el extractor único `scriptsDeLaPagina`). El censo de `scripts/_censo-microcopy-sin-marcar.mjs` (549) suma los guiones que la página enlaza. La mutación de 1756d sobre el guion de precios apunta ahora a `public/precios.js`. **No cambia ninguna aserción, ningún umbral ni ningún literal esperado.** Después: 390 casos, 389 pasan; el que caía (`scrum553`, el `>` pegado de una etiqueta literal en mi test) era mío y está arreglado en mi test, no en el guard.
- **Navegador** (Edge 157, la CSP de 1637; `j3ci-recorrido.mjs.txt`, copia de `j3d-recorrido` sin el escenario «aislada»; servidor `j3d-servidor.cjs.txt` sin cambios): main contra main 16/16 idénticas · main sin política ↔ rama sin política 16/16 · **main sin política ↔ rama con la política APLICADA 14/16 idénticas byte a byte**. Las dos distintas son `privacidad`, a 390 y a 1280: es su `<style>`, que se queda por c.22082 ② y está fuera del criterio. **La rama aplicada da 0 informes `script-src-elem`** (el control, main aplicada, da 10). Su único informe es `style-src-elem` ×2, de privacidad. Precios y landing con plazas destapan banner y tachado en la rama aplicada igual que en main. Main aplicada no los destapa. La demo llega a la pantalla de firma.
- **Un error mío en el instrumento:** la 1.ª pasada (`j3ci-recorrido.pasada1.salida.txt`) salió CIEGA porque heredé de 1756d un control que exigía que main aplicada rompiera las vistas BASE. Ese control era del CSS en línea, que ya está en main (#3209). Ahora mira las vistas que dependen del guion (plazas y demo). Los números de las dos pasadas son los mismos.
- `tsc -p .` con tipos: salida 0 (la rama no toca `src/`).

| aceptación (literal) | dónde se ve |
| --- | --- |
| Cada fila de la tabla tiene su PR mergeado o su «no aplica» medido | fila de c.22017 (`<script>` de index y precios): `tests/scrum1756f-publicas-sin-script-en-linea.test.mjs` · PR de esta rama, sin mergear todavía · privacidad: PENDIENTE por decisión (c.22082 ②) |
| (encargo) capturas 390/1280 idénticas entre main sin política y la rama con la CSP APLICADA, 0 `script-src-elem`, control distinto, banner de precios | `docs/master/evidencias/SCRUM-1756/j3ci-recorrido.salida.txt` (+ `.resultado.json`) |

**NO MEDIDO:** la suite entera por tramos. Corrí los 43 ficheros que leen landing o precios (390 casos) y los guards que se nombran en el comentario de entrega de Jira. Tampoco he mirado el obligatorio, yaqu.app ni otros navegadores.

## SCRUM-1756g · 18-nov: censo final de lo que bloquea el paso 3 de la CSP en el main de hoy (J3, solo medir)

**Medido contra:** `origin/main` = `e37a7051f87b195ceeae4852c56a02bc0d218438` · 2026-11-18T23:45:53Z (hora de GitHub; sesión J3 `jv-j3cj`, por encargo del orquestador `cobroflash-backend-8a`; la rama sale de ese main y no toca `src/` ni `public/`)

A9: aviso → cicatriz J3 «Saqué el dueño de cada fichero con la ÚLTIMA línea de `carriles.mjs de`, y para `teamView.js` esa línea era la de una excepción de S1: el censo lo daba sin carril; lo vi al leer la salida y lo medí aparte (J3).» — no se pudo comprobar: el censo es un guion de evidencias que corre a mano y ningún test lo ejecuta

**Skill UI:** no aplica · solo docs: el tramo no cambia nada de `src/` ni de `public/`.

**Qué mide.** Lo que queda en `src/**` + `public/**` (518 ficheros; fuera los 13 de `src/modules/messaging/**`, el correo: quedan 505) que, con `csp.ts` APLICADA (`script-src 'self'`, `style-src 'self'`), deja CSS sin pintar o un botón mudo: `<style`, `style="`, `<script>` sin `src` y `on*=`. Guion `evidencias/SCRUM-1756/1756g-censo.mjs.txt`; salida entera en `1756g-censo.txt`.

- **Sonda 1, `git grep` por LÍNEA** (como la tabla original del 18-nov sobre `35153debf`): 68 ficheros con algún acierto.
- **Sonda 2, análisis por OCURRENCIA** sobre los 475 ficheros de texto. Los TS/JS van por el AST de `typescript`, que separa cadena, comentario y código. El HTML va sin `<!-- -->` y con el cuerpo de `<script>` aparte, y el CSS sin `/* */`. Los `<script type="…json">` son datos y no se ejecutan: no cuentan. Salen 68 ficheros, 42 de ellos «vivos». **Los conjuntos de las dos sondas coinciden**: ningún fichero está en una y no en la otra.
- **Controles:** una siembra fabricada por el guion (`public/siembra.html` y `src/siembra.ts`, con recuentos derivados de su texto) pasa por las dos sondas: CAZA 4/4. El fichero cero, con casi-aciertos (`<link>`, `<script src>`, `class="styles"`), da 0. **Con `--sin-siembra` el censo sale CIEGO, código 2**, no verde. Al acabar, `git status` está limpio.
- **Navegador** (Chrome 157, página `data:` con las tres directivas de `csp.ts` en un `<meta>`): un `style="…"` y un `onclick="…"` metidos por `innerHTML` **no pintan y no corren**, con informes `style-src-attr` y `script-src-attr`. `elemento.style.x = …` (CSSOM) sí pinta. El control sin política pinta, corre y da 0 informes. Esto importa porque casi todo lo que queda está en cadenas que el panel mete por `innerHTML`.

### 🔴 Lo que la tabla original no tenía

**`public/dashboard/js/*.js`: 36 ficheros con `style="` dentro de las cadenas que pintan el panel.** Hoy son 880 ocurrencias, y 6 `on*=` en 5 de ellos. En `35153debf` ya había 36 ficheros con 856 líneas, y **ninguno estaba en la tabla**: su población fue, en la práctica, `*.ts` + `*.html`. Esto lo deduzco de las filas que tiene; la descripción no da el glob. **Con la tabla original vacía, el paso 3 rompería igualmente el panel entero.**

### Tabla final

| fichero | `<style` | `style="` | `<script>` sin `src` | `on*=` | carril (`carriles.mjs de`) | estado |
| --- | --- | --- | --- | --- | --- | --- |
| `receipt.routes.ts` (recibo) | 0 | 0 | 0 | 0 | J2 | **HECHO** · #3205 + #3208 |
| `customerPortal.routes.ts` (portal) | 0 | 0 | 0 | 0 | J2 | **HECHO** · #3205 + #3208 |
| `public/index.html` | 0 | 0 | 0 (1 línea es `ld+json`: datos) | 0 | J3 | **HECHO** · #3209 + #3236 |
| `public/precios.html` | 0 | 0 | 0 | 0 | J3 | **HECHO** · #3209 + #3236 |
| `public/terminos.html` | 0 | 0 | 0 | 0 | J3 | **HECHO** · #3209 |
| `legalPages.routes.ts` | 0 | 0 | 0 | 0 | J3 | **HECHO** · #3209 |
| `invoicesAdmin.routes.ts` (paquete de disputa) | 0 (S1 da 2 líneas: comentario :378-379) | 0 | 0 | 0 | J1 | **HECHO** · #3237 |
| `src/core/http/publicNotFound.ts` (404 público) | 0 (S1 da 2: comentario :7, :10) | 0 | 0 | 0 | S1 (no medido hoy: no tiene ocurrencias vivas) | **HECHO** por SCRUM-1646 (`32585791d`), no por este ticket |
| `auth.service.ts` | 0 | 4 (cadena :112-113, :233-234) | 0 | 0 | J3 | **NO APLICA**: correo (`renderEmailLayout` → `sendEmail`), medido en 1756d; las líneas no se han movido |
| `soporte.ts` | 0 | 1 (cadena :99) | 0 | 0 | J3 | **NO APLICA**: correo (`construirCorreoSoporte` → `enviarCorreo`), 1756d |
| `altaNavegador.ts` | 0 | 0 (S1 da 2: comentario) | 0 (S1 da 3: comentario) | 0 | J3 | **NO APLICA**: comentarios |
| `quoteDecisionLanding.routes.ts` | 0 (S1 da 2: comentario :80, :413) | 0 | 0 (`application/json` :596: datos) | 0 | — | **NO APLICA** (c.21849) |
| `*Estilo.ts`, `*Navegador.ts`, `payBank`, `albaranPublic`, `csp.ts`, `huellaEstaticos.ts`, `sw.js`, `styles.css` | sólo comentarios o bloques JSON | | | | — | **NO APLICA** (lista entera en la salida, sección S2) |
| `public/privacidad.html` | **1** (:10) | 0 | 0 | 0 | J3 | **PENDIENTE con disparador**: se espera a la edición real de la política (c.22082 ②) |
| `publicProfile.service.ts` (perfil público) | **1** (cadena :89, HTML servido) | 0 | 0 | 0 | S1 | **PENDIENTE** · Luis |
| `public/admin.html` | **1** (:7) | **4** (:576-593) | **1** (:613) | 0 | S2 | **PENDIENTE** · Luis |
| `public/dashboard/index.html` | 0 | **8** | **1** (:402) | 0 | S2 (contenedor) | **PENDIENTE** · Luis |
| `public/dashboard/js/*`, 22 ficheros: `aiQuoteAssistant`, `api`, `app`, `estadoFirma`, `expensesView`, `exportView`, `facturasRecibidasView`, `globalSearch`, `homeView`, `jobDetailView`, `jobNuevoModal`, `parteOficinaView`, `productsView`, `providersView`, `quoteRequestsView`, `quoteRevisiones`, `quotesDetailView`, `quotesListView`, `quotesView`, `reportsView`, `signaturePad`, `templatesView` | 0 | **543** | 0 | **6** | S2 | **PENDIENTE** · Luis · **NUEVA** |
| `public/dashboard/js/`: `albaranDetailView` (1), `parteDetailView` (19) | 0 | **20** | 0 | 0 | S4 | **PENDIENTE** · Luis · **NUEVA** |
| `public/dashboard/js/`: `onboardingView` (54), `plansView` (52), `settingsView` (75, contenedor), `teamView` (32), `tutorial` (15) | 0 | **228** | 0 | 0 | J3 | **PENDIENTE** · J3 · **NUEVA** |
| `public/dashboard/js/`: `cobrosView` (1), `csvImport` (31), `customerDetailView` (28), `customersView` (1) | 0 | **61** | 0 | 0 | J2 | **PENDIENTE** · J2 · **NUEVA** |
| `public/dashboard/js/`: `invoiceDetailView` (8), `invoicesView` (5), `puertaSerie` (15) | 0 | **28** | 0 | 0 | J1 | **PENDIENTE** · J1 · **NUEVA** |

Las cifras de `style="` del panel son ocurrencias (sonda 2), no líneas. Los `on*=` vivos son seis: `expensesView.js:726` (`onerror`), `globalSearch.js:160-161` (`onmouseenter` y `onmouseleave`), `homeView.js:577`, `quotesDetailView.js:1342` y `templatesView.js:24` (`onclick`).

**Comprobación de lo HECHO:** las siete filas que dan por hechas los tramos b–f dan 0 VIVOS en las cuatro columnas. En la sonda 1 sólo quedan comentarios (`invoicesAdmin.routes.ts:378-379`) y el `ld+json` de `index.html:27`.

### Qué se rompe si se aplica la política hoy

- **Privacidad** (J3): se pinta sin su hoja. Es lo esperado y está decidido (c.22082 ②).
- **Perfil público** (S1): se pinta sin CSS.
- **Admin** (S2): se pinta sin CSS y su guion de `:613` no corre, así que la página no funciona.
- **Panel** (`dashboard/index.html`, S2): su guion de `:402` no corre y 8 elementos pierden su estilo.
- **Panel, vistas** (S2, S4, J1, J2, J3): todo lo que pintan por `innerHTML` pierde los estilos en línea (880 ocurrencias en 36 ficheros: márgenes, colores, `display:none`…). Un `display:none` que no se aplica ENSEÑA lo que debía ir oculto. Además, los 6 `on*=` dejan mudos estos controles: el enlace «+ Nuevo presupuesto» de plantillas, el botón del paso de `homeView`, el de gastos de `quotesDetailView`, y el resaltado de la búsqueda global. Y en gastos, una imagen que no carga ya no se oculta (`onerror="this.style.display='none'"`).

**Sin medir:**
- `setAttribute('style', …)` y `href="javascript:"`. El guion los busca y no salen, pero esos dos patrones no tienen siembra, así que su cero no vale.
- Qué `display:none` de cada vista cambia lo que se ve.
- Si `api.js` (10) pinta siempre o sólo en errores.
- yaqu.app.
- Si el panel tiene alguna vía, fuera de `innerHTML`, por la que un `style=` se libre. La medí en una página `data:`, no en el panel.

**Propuesta, no hecha:** este censo, convertido en un guard trinquete que no deje subir ninguna columna, impediría que la tabla vuelva a nacer con una población más corta que la real. Es otro ticket (A23), y no lo abro.

# SCRUM-1756j

**Medido contra:** `origin/main` = `3dfeeaa99404dcce83417c5b589bc182eb45c290` · 2026-11-19T00:09:29Z (cabecera `Date:` de GitHub; sesión J1 `jv-j1fk`, por encargo del orquestador `cobroflash-backend-8a`; la rama lleva ese main fusionado)

A9: aviso → A10 «Un bloque al principio de una hoja pierde contra las reglas posteriores: quien elige el sitio del bloque elige también la cascada.» — no se pudo comprobar: dónde va un bloque en un contenedor lo decide quien reparte, y ningún guard lee el reparto

Mutaciones: catálogo → `tests/scrum1756j-panel-j1-sin-style-en-linea.test.mjs` (4/4 cazadas con `correr` + `aplicarUna`; la inocua de control sale MUDA; `evidencias/SCRUM-1756/j1fk-mutar.*`).

**Skill UI:** no cargada · cero cambios visibles: cada `style=` pasa a una clase con las mismas declaraciones, y lo visual lo decide la sonda de navegador de abajo (capturas idénticas byte a byte), no la skill.

**Qué:** la fila J1 del censo 1756g (c.22122): 28 `style="` en cadenas de `innerHTML` de `public/dashboard/js/invoiceDetailView.js` (8), `invoicesView.js` (5) y `puertaSerie.js` (15). Mi recuento con el mismo patrón (`RX.style_attr` de `1756g-censo.mjs.txt`) sobre el AST de las cadenas da 8 + 5 + 15 = 28 en main y 0 en la rama. Cada uno pasa a una clase con sus declaraciones, en el bloque `/* J1: SCRUM-1756j … */ … /* J1: fin del bloque SCRUM-1756j */` de `public/dashboard/css/styles.css`. Es contenedor de S2, así que sólo se añade el bloque marcado, al PRINCIPIO del fichero, por decisión del orquestador (mensaje a jv-j1fk del 19-nov: J1 al principio, J2 tras :5483, J3 al final, para que no choquen los tres PR). Cero textos nuevos o cambiados.

**Por qué `!important` (y dónde no).** Un `style=` gana a toda regla de autor sin `!important`. Al principio de la hoja, una clase de igual especificidad pierde contra las reglas que vienen detrás. La causa es el sitio del bloque, no la receta:
- **Con `!important`, las 13 de facturas y del modal de anular (13 reglas).** Cada declaración lo lleva, para ganar como ganaba el atributo: `.j1-anul-modal` a `.modal` y a `.modal-overlay .modal` en móvil, `.j1-bulk-cancelar` a `.btn-ghost` y a su `:hover`, `.j1-fac-vacio-cta` a `.btn-primary`, `.j1-fac-col-*` a `th`/`.table`, y las demás por lo mismo. Ningún guion toca estas piezas con `el.style` (medido con grep sobre los dos ficheros), así que el `!important` no le quita nada.
- **Sin `!important`, las 15 de la puerta de la serie (14 reglas: los dos botones comparten una).** Van bajo `#puerta-serie` (la caja, con id fijo): especificidad (1,1,0), que gana a `.field input`, `.field input:focus`, `.field label` y `.btn-*`. No llevan `!important` porque el guion cambia `display` y `border-color` con `el.style.*`, y eso tiene que seguir ganando.
- **Sin `!important`, el `display:none` inicial del error de anular**, en su propia regla `.modal .j1-anul-err`, por lo mismo.

**Un cambio de comportamiento, no visible:** el error de anular (`invoiceDetailView.js`, «err») se enseñaba con `err.style.display = ''`, que lo devolvía al `display` de `.alert` (block). Con la clase, `''` lo deja oculto, así que ahora se enseña con `'block'`, que es el valor que salía. Lo cubre el caso ③ del test, y lo tumba la mutación 4.

**Test** `tests/scrum1756j-panel-j1-sin-style-en-linea.test.mjs` (4 casos):
- ① 0 `style=` en las cadenas de los tres ficheros;
- ② cada una de las 28 de main, copiada con su línea de `e37a7051f` (las 28 casan con `origin/main`), tiene su marcado nuevo UNA vez y su regla con EXACTAMENTE sus declaraciones;
- ③ los `display:none` que el guion enciende siguen sin `!important`, y el error se enseña con `'block'`.
- Control sembrado: 4 `style=` en cadenas más 1 en un comentario dan 4, y el control cero da 0.
- **Rojo primero** con los cuatro ficheros de main en su sitio: 3/4 caen por su aserción y el control pasa.

**Navegador** (Chromium del MCP de Playwright, `evidencias/SCRUM-1756/j1fk-sonda.cjs.txt`). Cada una de las 28 piezas va montada en el contenedor de su vista (`#puerta-serie.field`, `.modal-overlay .modal .modal-body`, `table.table--cards-mobile thead`, la barra del lote, `.empty-state`), con `tokens.css` y la hoja entera. Tres páginas: A = main sin política, B = rama con `style-src 'self'` APLICADA, C = control, marcado de main con política. Resultado, a 390 y a 1280:
- **capturas A y B idénticas byte a byte** (6.739 B y 14.409 B);
- **0 informes en B**;
- C sale distinta y con 28 informes `style-src-attr`.

Estilos computados, todas las propiedades, A frente a B: dos diferencias, explicadas:
- `:848` (acciones del modal): mi sonda le fuerza `el.style.display='block'` a todas las piezas, y el `!important` le gana. Es un artefacto de la sonda: ningún guion hace eso con esa pieza.
- `:824` a 390: opacidad 0,999976 y una traslación de 0,0006 px. Es un fotograma de la animación de entrada del modal; la captura es idéntica.

**NO MEDIDO:**
- Las vistas reales con datos del servidor (lista, detalle, modal de anular, puerta de la serie dentro de ajustes): en esta máquina no hay Postgres, y doblar las rutas del panel no me cabía en el contexto. La sonda mide las piezas en su contenedor, no la vista entera.
- `:hover` y `:focus` en navegador; razonado por especificidad, arriba.
- La suite ENTERA: sólo los guards del encargo y los tests que leen `styles.css` (en la entrega).
- yaqu.app y el obligatorio.

**Un rojo mío, arreglado antes de empujar:** `scrum737` (cifras sin ancla) cayó por un comentario de mi test que decía «las 28 ocurrencias». Lo reformulé sin número: la población la ata el caso de control (`CAMBIOS.length`). No cambié el guard ni su censo.

**Medido antes del empujón** (rama con main `3dfeeaa99` fusionado, `dist/` compilado con `tsc --noCheck`; no toco `src/`):
- los 13 guards del encargo y el test: 139/139;
- los 160 ficheros que leen `styles.css` o los tres ficheros: 1.290 casos, 1.289 pasan, 0 caen, 1 se salta (pide `LIBRO_PG_URL`);
- `guards:entrada`: 15 guards y 170 casos en verde;
- los 5 de árbol entero que nombra, más `scrum622`: 50 casos, 50 pasan después del arreglo de arriba;
- meta-guard `--solo-censo`: salida 0, 1.294 declaraciones. Su listado sólo enseña la frontera `src/`↔`dist/`, así que no nombra este fichero.

**Relevo jv-j1fo, 19-nov (rojo del obligatorio en el run 44432520334, `scrum719` · SCRUM-1395b, «sin ficha»):** relevo jv-j1fo: ficha de mudez regenerada con `censo:mudez --escribir`; A9: comprobación → `tests/scrum719-el-suelo-de-los-doce.test.mjs`. El censo midió 1 de 136 y el diff de `tests/_veredicto-mudez.json` es una línea: este test, `NO APLICA` (4 tests, no llama al filtro de comentarios).
## SCRUM-1756h · 19-nov: las cinco vistas de J3 del panel sin `style="…"` en las cadenas de `innerHTML` (J3)

**Medido contra:** `origin/main` = `3dfeeaa99404dcce83417c5b589bc182eb45c290` · 2026-11-19T00:07:52Z (cabecera `Date:` de GitHub; sesión J3 `jv-j3ck`, por encargo del orquestador `cobroflash-backend-8a`; la rama lleva ese main fusionado, y entre su base `d86f7ef92` y él main solo cambió este registro)

A9: comprobación → `tests/scrum1756h-panel-j3-sin-style-en-linea.test.mjs`

Mutaciones: catálogo → `tests/scrum1756h-panel-j3-sin-style-en-linea.test.mjs` (4/4 cazadas con `correr` + `aplicarUna`; la inocua de control sale MUDA; `evidencias/SCRUM-1756/j3ck-mutar.*`).

**Skill UI:** `yaqu-premium-ui` cargada y leída. No aplica nada más que «cero estilos inline aleatorios»: se mueven las declaraciones byte a byte y no se cambia ningún token, componente ni texto. El aspecto en navegador NO se ha medido (abajo).

| fichero | `style="` en cadenas (AST), antes → después | carril |
| --- | --- | --- |
| `public/dashboard/js/onboardingView.js` | 54 → 0 | J3 |
| `public/dashboard/js/plansView.js` | 52 → 0 | J3 |
| `public/dashboard/js/settingsView.js` | 76 → 0 | J3 (contenedor) |
| `public/dashboard/js/teamView.js` | 32 → 0 | J3 (la excepción S1 de `dos-equipos.md:264` es sólo el clic de «+ Añadir miembro», y no se ha tocado) |
| `public/dashboard/js/tutorial.js` | 15 → 0 | J3 |

- **Son 229 y no 228.** La 229.ª es `settingsView.js:1048`, `'style="width:100%">'`, una cadena que empieza con `style=`. La regex del censo 1756g (`\sstyle\s*=`) exige un blanco delante, y ese blanco está en la cadena anterior, al otro lado del `+`. El caso CONTROL del test siembra justo esa forma.
- **Dónde va el CSS:** en un bloque `/* J3: SCRUM-1756h … */ … /* J3: fin del bloque SCRUM-1756h */` al final de `public/dashboard/css/styles.css`, que es contenedor de S2. Lo permite la regla de los contenedores (`dos-equipos.md:95-97` y `:150`) y lo decidió el orquestador J al acusar c.22122/c.22127. No hay hoja nueva y `dashboard/index.html` no se ha tocado. Para no chocar: J2 (1756i) pone su bloque detrás de `/* J2: SCRUM-1132 */` y J1 (1756j) al principio.
- **Cómo se ha hecho:** con el guion `evidencias/SCRUM-1756/1756h-transformar.mjs.txt`, por AST. Cada valor da una regla `.j3e-<7 hex del sha1>:not(#j3-sin-id):not(#j3-sin-id){<declaraciones byte a byte>}`: 181 reglas para 229 atributos. Antes de mover, los 168 valores estáticos de HEAD están todos en el bloque (faltan 0).
- **Por qué los dos `:not(#…)`:** suben la especificidad a (2,1,0). El máximo medido en `styles.css` es un id (`#home-aviso-sii`). Así la clase gana donde ganaba el atributo, y un `el.style.x` del guion sigue ganando a la clase, como ganaba al atributo.
- **Los 7 valores con `${…}`:** los 6 ternarios pasan a elegir entre dos o tres clases. `settingsView.js:1275`, `width:${pct}%`, es un dato: lleva `data-j3-ancho` y su ancho se pone por CSSOM tras pintar, que la CSP permite (c.22122). Es la única línea de guion nueva, con el OK del orquestador.
- **Dos `className =` que habrían borrado la clase nueva:** los botones Sí/No del alta (`onboardingView.js:231`) y `#invite-alert` (`teamView.js:306`). Pasan a `classList`, con el mismo efecto sobre las clases que ya tenían. Sin este cambio, al pulsar Sí/No los botones perdían su estilo. Lo vigila el caso ⑤ del test.
- **Cero textos nuevos o cambiados.**

| aceptación (literal) | dónde se ve |
| --- | --- |
| Cada fila de la tabla tiene su PR mergeado o su «no aplica» medido | fila J3 del panel de c.22122/c.22127: `tests/scrum1756h-panel-j3-sin-style-en-linea.test.mjs` (10 casos) · PR de esta rama, sin mergear |
| (encargo) 0 `style="` dentro de cadenas (AST) y la hoja contiene cada declaración movida, byte a byte | el mismo test: un caso por fichero, el del hash y el del sha-256 del conjunto. Rojo primero sobre las copias de HEAD: 9 de 10 caen y el control pasa (`evidencias/SCRUM-1756/j3ck-rojo-sobre-head.salida.txt`) |
| (encargo) mutaciones en el catálogo | `evidencias/SCRUM-1756/j3ck-mutar.salida.txt`: 4/4 cazadas, inocua MUDA |
| (encargo) capturas 390/1280 idénticas con la política aplicada, 0 informes `style-src`, control distinto | **NO HECHO** → relevo sobre esta punta: no me cabía en el contexto. Las vistas necesitan la sesión del panel y datos del servidor |

**Corrido:** los 138 ficheros de `tests/` que nombran estos cinco ficheros o `styles.css` dan 1.197 casos: 1.196 pasan, 0 caen y 1 saltado. Además, los guards de la lista del encargo (en el comentario de entrega).

**Error mío:** la primera pasada del guion escribía cada fichero según lo acababa. Abortó en `settingsView.js` con dos ficheros ya escritos y sus reglas CSS perdidas. Los devolví a HEAD con `git show` (el hook había parado `git checkout --`, con razón), rehíce a mano sus cuatro marcadores, y ahora el guion escribe todo al final o nada. Me lo encontré yo al ver el `diff --stat`.

**NO MEDIDO:** las capturas 390/1280 y los informes CSP en navegador; la suite entera por tramos (por contexto); otros `className =` de fuera de estos cinco ficheros (`app.js`, S2) que pudieran tocar estos elementos; yaqu.app.
