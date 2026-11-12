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
