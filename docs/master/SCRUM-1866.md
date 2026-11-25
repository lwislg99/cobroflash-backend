# SCRUM-1866 · el trinquete

**Medido contra:** `origin/main` = `bdba2afe7ba22bb8f6e2cc08311094bb837cee35` · 2026-11-25T22:02:14Z (cabecera `Date:` de GitHub; sesión J6 `jv-j6gh`, por encargo del orquestador `cobroflash-backend-2d`; la rama sale de ese main, que no se movió durante la tanda)

A9: aviso → cicatriz J6 «Escribí `process.exitCode = 2` para el CIEGO de un test y node:test lo pisó con 1 al acabar: sólo lo vi corriéndolo con la población quitada» — no se pudo comprobar: ningún meta-guard corre un test nuevo en estado CIEGO para leer su código de salida

Mutaciones: catálogo → `tests/scrum1866-trinquete-csp-1756g.test.mjs` (5/5 cazadas con `correr` + `aplicarUna`; la inocua de control sale MUDA; `evidencias/SCRUM-1866/mutar.*`).

**Qué.** El censo 1756g convertido en guard, como pedía su propio tramo g («Propuesta, no hecha»). Tres ficheros en `tests/`, carril J6 (etiqueta `area-j6`; `carriles.mjs de --nueva` lo da a quien trabaja el ticket):
- `tests/_scrum1866-csp-1756g.mjs`: la **sonda 2 del guion** `evidencias/SCRUM-1756/1756g-censo.mjs.txt`, copiada con su cabecera (AST de `typescript` para cadena/comentario/código, HTML sin `<!-- -->` y con el cuerpo de `<script>` aparte, CSS sin `/* */`, `<script type="…json">` fuera). Sólo las cuatro columnas; `setAttribute('style'` y `href="javascript:` se quedan fuera porque 1756g los dejó «sin medir» (sin siembra). No es un segundo censo.
- `tests/_scrum1866-congelada.json`: la tabla, un fichero por línea, con `medidoSobre` = `bdba2afe7…` y la hora de GitHub.
- `tests/scrum1866-trinquete-csp-1756g.test.mjs`: 5 casos. Rojo con `fichero:columna:antes→ahora` por cada subida o fichero sin fila con cifra > 0. Si una cifra baja, cae y deja en `os.tmpdir()` la tabla recongelada para copiarla en el mismo PR (no la propone si hay subidas).

**Población** (la imprime el test): `git ls-files src public` = 523 ficheros; fuera el correo (`src/modules/messaging/**`) 13; quedan 510, de ellos **480 de texto** (ts/js/mjs/html/css), que son los que se analizan. El resto (imágenes, json, etc.) no entra, como en 1756g.

**Tabla congelada: 30 ficheros con cifra > 0** (580 `style="`, 3 `<style`, 2 `<script>` sin src, 6 `on*=`). Por carril, según la tabla de 1756g (no re-consultado fichero a fichero con `carriles.mjs`):
- **S2, 24:** `admin.html` (1·4·1·0), `dashboard/index.html` (0·8·1·0) y las 22 vistas de 1756g, con **543** `style="` y **6** `on*=`: las mismas cifras que dio 1756g el 18-nov.
- **S4, 2:** `albaranDetailView` (1), `parteDetailView` (19).
- **J3, 3:** `privacidad.html` (1 `<style`, c.22082 ②), `auth.service.ts` (4) y `soporte.ts` (1), estos dos correo de NO APLICA en 1756d.
- **S1, 1:** `publicProfile.service.ts` (1 `<style`).
- **J1, J2 y las vistas J3 del panel: 0**, tal como dejaron los tramos h, i y j.

Dos sondas que cuadran: los 30 son los 42 «vivos» de 1756g menos las 12 vistas de J, y las sumas por carril coinciden con su tabla. Ninguna cifra se ha tocado a mano: el JSON lo escribió el clasificador.

**Controles, dentro del test:**
- **Siembra** escrita en `fs.mkdtempSync(path.join(os.tmpdir(), …))` y censada con la misma `censar` que la población. Son los ficheros del guion (`public/siembra.html`, `src/siembra.ts`), que CAZAN 4/4, más `src/modules/messaging/siembra-correo.ts`, que tiene que quedar FUERA.
- **Cero** (`public/cero.html`: `<link>`, `<script src>`, `class="styles"`): da 0.
- **Sin siembra** el control da fallos: el caso 2 lo comprueba en cada tanda.
- **Rojo sembrado permanente** (caso 3): copia los 480 ficheros a un temporal y añade un `style="` a un fichero con fila y un `onclick=` a uno sin fila. Da EXACTAMENTE esas dos subidas, y ninguna bajada: la copia reproduce el árbol.
- **CIEGO:** `typescript` no carga, git no contesta, población vacía, un fichero ilegible, JSON ilegible o siembra no cazada. Todos los casos caen y **`node <test>` sale con 2**, medido con `GIT_DIR` apuntando a nada. Dentro de `node --test`, el runner agrega el fichero como 1: rojo, nunca verde.

**Rojo primero:** con el árbol commiteado (`ad951fd78`), el runner de la casa aplicó las cinco del catálogo y las cinco tumbaron el caso que nombran. La base limpia dio 5 pasan · 0 caen. Las cinco:
- un `style="` en `invoicesView.js` (J1, a 0);
- un `onclick=` en `admin.html` (con fila);
- una cifra subida a mano en el JSON (cae «no BAJA»);
- el clasificador sin cadenas;
- el correo dentro de la población.

`git status` limpio después.

**Tiempo:** el censo tarda ~1,3–1,7 s y el fichero entero ~3 s en primer plano. No hace falta prefiltrar con `git grep -l` (el umbral era 60 s).

**Verdes antes del empujón:** en la entrega y en el comentario de Jira, con su población.

**NO medido:**
- el obligatorio de CI;
- la suite ENTERA en local (no me cabía en el contexto);
- el carril de los 30 ficheros, fichero a fichero, con `carriles.mjs`;
- otras extensiones (`.svg`, `.cjs`, `.json`): fuera de la población, como en 1756g;
- ficheros sin seguimiento en git: no entran hasta el `git add`;
- yaqu.app: no aplica, porque el test no cambia nada servido.
