# SCRUM-1651 · Duplicar un presupuesto de 3 opciones pierde dos en silencio

**Medido contra:** `origin/main` = `70eefc40cba2eb9636992b733223bf1555c1755f` · 2026-11-02T22:12:48Z

A9: sin fallo que generalice — medir y corregir el registro de bugs; ningún código cambiado

## SCRUM-1651 · S2, 2-nov-2026: la mitad ① NO basta, y no se construye sin decisión

El encargo pedía medir primero si «que Duplicar arrastre las tres» bastaba para cerrar el ticket sin texto
nuevo. **No basta, y no se puede hacer sin una decisión de diseño.** Lo medido LEYENDO el código de `main`
(no en pantalla: el defecto lo midió S1 en yaqu.app el mismo día, `SCRUM-1545 c.21354`):

| hecho | dónde |
|---|---|
| `duplicateQuote` YA mete `tiers` en la plantilla | `quotesDetailView.js:1530` |
| el editor que la recibe no tiene opciones y no lee `tiers` | `quotesView.js:5114-5116` (su comentario lo dice) |
| `lines` de un presupuesto de 3 opciones = las de la recomendada | `quotes.routes.ts:137-139` |
| si el alta lleva `tiers`, el servidor IGNORA `lines` | `quotes.routes.ts:135-139` |
| el único sitio del panel que pinta 3 opciones es el presupuesto rápido | `homeView.js:1441-1459` |
| y ése sólo sabe UNA línea por opción, con `tax: 0`, ids fijos `good/better/best`, y su botón es «Enviar por WhatsApp» | `homeView.js:1451-1458`, `:1006-1008` |
| «Usar plantilla» abre el mismo editor: una plantilla con `tiers` también pierde dos | `quotesView.js:5091-5117` |

Por eso, las tres formas de «arrastrar las tres» sin decidir nada son peores que el defecto:

1. **Pasar `tiers` por el editor sin enseñarlos** → el servidor tira las líneas editadas y crea las tres
   opciones originales. Lo que el profesional cambió se pierde, y en silencio: el mismo defecto, al revés.
2. **Mandar Duplicar al presupuesto rápido** → cambia el flujo (de «editor y luego genera» a «envía por
   WhatsApp»), pone el IVA a 0 y sólo cabe una opción de una línea: se pierden otras cosas.
3. **Un editor de opciones en `quotesView`** → es pantalla nueva con rótulos nuevos: es el punto 1 (diseño)
   y el 4 (textos) de SCRUM-1545, que esperan al fundador. Y, como midió S1, nunca en modo documento suelto
   (emite, regla 38).

La aceptación 3 (ida y vuelta por plantilla) cae en el mismo sitio: ninguna pantalla del panel consume
`template.tiers` hoy.

**Lo que SÍ va en esta rama (aceptación 4):** `docs/BUGS.md` P2-1 deja de afirmar que Duplicar «carga las
líneas/tiers». La línea vieja se conserva y debajo va la corrección con fecha, para que se vea qué decía.

**Lo que falta, y de quién es:** decidir entre ② (aviso firmado: «se duplica sólo la opción recomendada»)
o 3 (editor de opciones, SCRUM-1545). Es del orquestador y del fundador; S2 no lo construye sin eso.

## SCRUM-1651 ② · S2, 3-nov-2026: el editor que abre «Duplicar» DICE que sólo va la recomendada

**Skill UI:** cargada (yaqu-premium-ui) antes de tocar `public/`. Sin tokens ni clases nuevas: reutiliza `.alert.warning` (`styles.css`), el aviso de la casa en su tono de aviso.

Decisión del orquestador por delegación del fundador (encargo a S2, 3-nov-2026 ~07:33Z): entra la ②, la ① sigue
FUERA. Texto: no había literal firmado que sirviera (búsqueda de «opción recomendada» y «sólo la opción» en
`public/`: cero), así que va el suyo, **«Se duplica sólo la opción recomendada.»**, transcrito en SCRUM-1651
c.21372 y fichado en `docs/microcopy/2026-11-03-SCRUM-1651-duplicar-solo-la-recomendada.md`.

| qué | dónde |
|---|---|
| `duplicateQuote` marca la copia con `soloLaRecomendada` si el original tiene más de una opción | `public/dashboard/js/quotesDetailView.js`, `duplicateQuote` |
| el editor pinta el aviso en un nodo PROPIO bajo la cabecera, encendido sólo por esa marca | `public/dashboard/js/quotesView.js`, `avisoSoloLaRecomendada` |
| test por efecto en el banco: «Duplicar» de verdad → editor de verdad, con 3 controles (sin opciones, una opción, editor a pelo) | `tests/scrum1651-duplicar-avisa-solo-la-recomendada.test.mjs` |
| rojo primero: sin el cambio de código, 1 fallo (el principal) y 3 controles verdes; con el cambio, 4/4 | corrido en local sobre `556d453ca` |

**Por qué un nodo propio y no `setAlert`:** con una plantilla, `loadInitialData` no restaura borrador y acaba en
`setAlert(null, "")`, que vacía el aviso «Plantilla … cargada» en cuanto llegan merchant y clientes. Medido en el
banco: al terminar de cargar, ese aviso ya está vacío. Un texto puesto ahí no lo leería nadie.

**Por qué el texto dice la verdad:** «recomendada» en el panel = `better` (`homeView.js`, insignia y `recommended`),
y las líneas que guarda el servidor y copia «Duplicar» son las de `better` (`quotes.routes.ts`, `betterTier`).

**De paso, sin arreglar (no es mío decidirlo):** «Usar plantilla» con una plantilla de varias opciones pierde las
otras igual, y este texto no le vale (habla de duplicar). Y el aviso verde «Plantilla … cargada» del mismo editor
no se ve nunca, por el `setAlert(null, "")` de arriba. Arreglar el segundo haría visible un texto cuya firma no he encontrado (regla 39): lo nombro y no lo toco.
**Visto en pantalla, en yaqu.app** (3-nov-2026 ~08:05Z, build `70eefc40c`, cuenta QA), con los dos `.js` de esta rama
servidos sobre producción (`docs/master/evidencias/scrum1651/duplicar-1651.mjs`, que corta todo lo que no es GET con
control positivo; «Duplicar» sólo hace GET y navega):

| caso | resultado | captura |
|---|---|---|
| #210 (nº 7, borrador, 3 opciones) con la rama, 1280 | aviso visible, arriba del paso 1, sin desplazar (top 178 px, 42 px de alto) | `evidencias/scrum1651/rama-q210-1280.png` |
| #210 con la rama, 390 | aviso visible, sin desplazar (top 183 px) | `evidencias/scrum1651/rama-q210-390.png` |
| CONTROL #212 (sin opciones) con la rama | el aviso existe y está oculto | `evidencias/scrum1651/rama-q212-1280.png` |
| CONTROL #210 en prod a pelo | sin aviso: el defecto de hoy | `evidencias/scrum1651/prod-q210-1280.png` |

Las líneas que llegan al editor desde #210 son las de «Opción 2» (la del medio, `better`): el texto dice lo que se ve.
Y en los ocho casos, también en prod, el aviso «Plantilla … cargada» no está en pantalla: el «de paso» de arriba, medido.

**Residuo, nombrado:** #210 es un dato viejo cuyas opciones no llevan `recommended: true`, así que su ficha no resalta
ninguna; para él, «la recomendada» no tiene una marca en pantalla que la señale. Todo presupuesto con opciones que crea el
panel hoy la lleva en `better` (`homeView.js`, `recommended: lv.id === "better"`).