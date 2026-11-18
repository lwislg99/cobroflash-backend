# SCRUM-1756

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
