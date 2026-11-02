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
