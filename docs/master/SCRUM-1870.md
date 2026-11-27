# SCRUM-1870 · El panel de versiones se GENERA: números calculados y «medido a las» por fila

**Medido contra:** `origin/main` = `b627357327a4d595c8116baa38183ca967160fda` · 2026-11-27T08:21:15Z

A9: sin fallo que generalice — cada regla del validador se vio caer con su mutación (5 de 5 VIVAS, base sin mutar limpia) antes de darla por buena.

Puesto S5 (`scripts/equipo/**` es de S5, `docs/equipo/dos-equipos.md` §3). Rama `scrum-1870-generador-panel`. Encargo del
orquestador (26-nov, tarde): la pieza A3 comprometida con el equipo J en SCRUM-1835 c.22778 — «panel generado, no a mano,
con números CALCULADOS y "medido a las" por fila». El número del ticket lo dio el orquestador (no 1869: ése es otro).

## Qué hay

| Fichero | Qué es |
|---|---|
| `scripts/equipo/panel/panel.schema.json` | El contrato de los datos (JSON Schema 2020-12). Versiones con estado, piezas {ticket, titulo, quien (S/J + puesto), estado, ref (#PR o c.N), medidoA}, KPIs. `additionalProperties:false` en todo. |
| `scripts/equipo/panel/generar-panel.mjs` | Lee `panel.data.json`, valida y escribe el HTML completo. Exporta `validarPanel`, `generarPanel`, `leerTokens`. |
| `scripts/equipo/panel/ejemplo.data.json` | Datos INVENTADOS para el test: merchant Demo, refs `#0000`/`c.0`, tickets `SCRUM-0`. El panel lo dice en grande. |
| `tests/scrum1870-generador-panel.test.mjs` | 7 casos, catálogo de 5 mutaciones. |

Uso: `node scripts/equipo/panel/generar-panel.mjs <panel.data.json> --salida <pagina.html>`. Salidas: 0 escrito · 1 datos
inválidos (no escribe nada) · 2 no pudo leer datos o tokens (no escribe nada).

## Lo que garantiza, y cómo

- **Ningún número sale de los datos.** El % de cada versión = Dentro ÷ total de SU tabla; cada KPI declara QUÉ estados cuenta
  de QUÉ versión y la cifra es la cuenta de filas; la hora de la cabecera es el intervalo de los `medidoA` de las filas. Una
  versión sin filas no pinta barra (un cero no es «0 %»). No hay reloj: mismos datos → mismos bytes (lo comprueba el test).
- **Una cifra escrita a mano PARA el generador**: una clave como `pct`/`total`/`porcentaje` (se nombra como cifra a mano, no
  como clave desconocida) o un «50 %» dentro de cualquier texto.
- **Cada fila lleva «a las HH:MM»** en hora de Madrid, fijada en el código (`Intl` con `Europe/Madrid`): no depende de la zona
  de la máquina, y el test compara contra una hora escrita para ese instante. Si la fila es de otro día que la última medida,
  lo dice («a las 23:30 del 25 nov»). Una fila sin `medidoA`, o con un instante sin zona, PARA.
- **Coherencia:** «dentro» o «robot» sin `#PR` PARA (lo que dice estar en main o en CI se tiene que poder comprobar); una
  versión «terminada» sin piezas, o con alguna fuera de «dentro», PARA; un KPI que cuenta una versión que no existe, PARA.
- **El panel es PÚBLICO:** un correo, un teléfono o un importe en cualquier texto PARAN el generador. El ejemplo sólo admite
  refs `#0000`/`c.0` y no enlaza nada; unos datos reales con `#0000` también PARAN (el ejemplo no se cuela sin marca).
- **Tokens:** se leen al generar de `public/tokens.css` (bloque `:root`, sin comentarios) y se copian al `<style>`. Si faltan
  `--brand` o `--logo-cyan`, PARA con salida 2. Lo que tokens.css no tiene (colores de estado de pieza, equipo J, modo
  oscuro) vive en una capa del panel, con `prefers-color-scheme` y `data-theme="dark"`, el mismo patrón que la v11 que el
  orquestador publicó a mano (usada sólo como referencia visual, no copiada al árbol). Los contornos usan `--border` de la casa
  (3:1, SCRUM-691); los divisores de fila, un tono suave decorativo.
- **El schema no es decoración:** el caso CONTROL comprueba que cada `required` de `panel.schema.json` es exactamente la lista
  que exige el validador, y que quitar cada uno de esos campos del ejemplo lo caza por su nombre.

## Rojo

Los casos 🔴 corren la línea de órdenes de verdad (proceso aparte, temporales en `os.tmpdir()`): exigen salida 1, que NO se
escriba el HTML y que el mensaje nombre el campo y la pieza. El CONTROL demuestra que el validador no rechaza por rechazar
(el ejemplo pasa, y cada regla cae por SU motivo).

Mutaciones: catálogo → tests/scrum1870-generador-panel.test.mjs

| # | Mutación | Cae |
|---|---|---|
| ① | `porcentajeDe` devuelve `33` fijo | «el ejemplo genera y CADA número…» |
| ② | `medidoA` fuera de `OBLIGATORIAS.pieza` | «🔴 una pieza SIN «medidoA»» (+ CONTROL, colateral esperado: schema y validador divergen) |
| ③ | `CLAVE_DE_CIFRA` desactivada | «🔴 … escrito a mano como CLAVE» |
| ④ | `PORCENTAJE_EN_TEXTO` desactivada | «🔴 … escrito a mano en un TEXTO» |
| ⑤ | `PUBLICO` vacío | «🔴 el panel es PÚBLICO» |

Base sin mutar: 0 caídos. Las 5 VIVAS, cada ancla casa una vez, restauradas y comparadas byte a byte (guion de un solo uso
en el tmp del job, no en el árbol). Tanda del fichero: 7/7, ~1 s.

QA visual (navegador, servido por HTTP local desde fuera del árbol): 1280 px claro y 390 px oscuro; a 390 sin desborde
horizontal (`scrollWidth` = `clientWidth` = 375). Visto ahí y corregido antes del commit: el plural «1 de 1 piezas» /
«Ver las 1 piezas».

## Lo que NO dice esto

- Que los datos reales estén bien: el generador comprueba FORMA y COHERENCIA, no que una fila «dentro» esté de verdad en
  `main`. Eso lo mide quien rellena `panel.data.json` (el orquestador, contra GitHub y Jira); el «medido a las» de cada fila
  dice cuándo.
- Los textos fijos del panel (leyenda, pie) salen de la v11 del orquestador; si alguno pide firma (regla 39), es suya.
- No publica nada: el HTML se publica a mano (Artifact) con el fichero que escribe.

## SCRUM-1870b · 26-nov noche (relevo de S5) · ajuste `orq`/`orqJ` y rojo de SCRUM-553

- **Ajuste pedido por el orquestador:** `quien.puesto` admite, además de S0-5 y J1-6, el orquestador de cada equipo:
  `orq` (equipo S) y `orqJ` (equipo J). En la 1.0 hay piezas del orquestador y mapearlas a un puesto falsearía el dato.
  Schema (`pattern ^([SJ]\d|orq|orqJ)$`), validador (`equipoDelPuesto`: `orq`→S, `orqJ`→J) y ejemplo (una pieza con `orqJ`).
  Rojo-primero en el test: `orqJ` en S, `orq` en J y `orquestador` como puesto se CAZAN; `orq` en S valida y se pinta.
- **Rojo del CI de la punta `86871d2c4`** (run 45863159589, 1 fallo de 14626): `scrum553` — 8 extractores del test de 1870
  con el `>` pegado subían el trinquete de 20 a 28. Curado en el test (hueco `[^>]*` a los atributos, lo vigilado sigue siendo
  el texto); el censo da 0 en el fichero. El trinquete no se toca (regla 41).
- **Rojo del CI de la punta `868b9667b`** (run 45961135163, 27-nov, relevo): 3 fallos de 14652, los tres de `scrum1839b` («letra
  de tramo sin su tramo»: el commit `686532593` se titula `SCRUM-1870b` y este registro lo encabezaba «Tramo b»), y su arrastre
  en el meta-guard parte 2 (`scrum1839` CIEGO: su base salía roja). Curado en el registro: la cabecera de este tramo pasa a
  `## SCRUM-1870b · …`, que es lo que pide el guard. Visto en local: `scrum1839` + `scrum267` + `scrum1294`, 24/24.
