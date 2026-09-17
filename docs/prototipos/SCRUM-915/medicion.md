# SCRUM-915 · Medición del prototipo v3

Chromium 148 local (puppeteer-core), `file://`, 17-sep-2026, rama `scrum-915c-prototipo-v3`.

## Pasada 2 · con el ajuste de la HOJA DE ENVÍO (17-sep-2026, tarde)

Recorrido en cada anchura, **automatizado, no a ojo**: «Comunidad Los Olivos» → 2 conceptos (6 × 38 € + 1 × 119 €) →
Condiciones → abrir y cerrar «Ajustes del documento» → Revisar y enviar → «Guardar y enviar» (abre la hoja) →
«📲 Enviar por WhatsApp» dentro de la hoja.

| Anchura | Errores de consola | Scroll horizontal | Controles < 44 px | Total | Modal tapando tras enviar | Confirmación en la pantalla |
|---|---|---|---|---|---|---|
| 1280 × 900 | 0 | no | 0 | 419,87 € | no | «✓ Enviado por WhatsApp a Comunidad Los Olivos · pendiente de firma» |
| 390 × 844 táctil | 0 | no | 0 | 419,87 € | no | igual |

**La hoja de envío, medida:**

| | 390 (móvil) | 1280 (escritorio) |
|---|---|---|
| `align-items` del fondo | `flex-end` | `center` |
| pegada abajo | **sí** | no |
| centrada (H / V) | sí / no | **sí / sí** |
| ancho × alto de la hoja | 390 × 772 (vista 844) | 460 × 728 (vista 900) |
| el contenido desborda la hoja | **no** | no |
| «📲 Enviar por WhatsApp» | primario, a todo el ancho, 52 px de alto, `rgb(22,163,74)` | igual |
| visible sin scrollear | sí | sí |
| canales debajo | ✉ Enviar por email · ⬇ Descargar PDF · 🔗 Copiar enlace · Lo envío luego | igual |

Es el mismo `.overlay/.modal` del prototipo: a ≤640 px se convierte en hoja inferior y por encima sale centrado —
el patrón de AB3 (bottom sheet de SCRUM-31 F2), no un componente nuevo. El «equivalente centrado en escritorio» que
pedía el ajuste **no hubo que construirlo: ya salía de ahí**, y lo de arriba es la comprobación de que sale.

**El texto del mensaje, tal como lo pinta la hoja** (las dos anchuras, idéntico):

    Hola Comunidad Los Olivos 👋
    Fontanería Ejemplo te ha preparado un presupuesto:
    Presupuesto #128
    Total: 419.87 EUR
    Tócalo para verlo y responder 👇
    Enviado con Yaqu
    [Ver presupuesto]

No es texto nuevo: es la plantilla firmada `quote_decision_es` (`docs/WHATSAPP_TEMPLATES.md` §1) con sus 4 variables
puestas. Por eso **no va subrayado**.

> ⚠️ **El total sale «419.87 EUR» y no «419,87 €», a propósito.** No es una elección de estilo: es lo que el código
> envía hoy. `src/modules/quotes/domain/sendQuote.service.ts:89` construye la variable `{{4}}` como
> `${Number(quote.total).toFixed(2)} ${quote.currency}`. Las líneas 73 y 81 del mismo fichero —el texto de sesión que
> sale cuando la ventana de 24 h está abierta— usan `formatMoneyEs` y dan «419,87 €». O sea: **el mismo presupuesto le
> llega al cliente de dos formas distintas según algo que el cliente no puede saber.**
>
> Decisión del orquestador (17-sep-2026): la hoja pinta lo que de verdad se envía, aunque se lea peor y aunque no cuadre
> con el «419,87 €» del documento de al lado. Que se vea feo es el dato, no el problema — es justo para lo que sirve un
> prototipo. Unificarlo es **SCRUM-931**; cuando se cierre, aquí cambia una línea (`totalDeLaPlantilla`) y ya.

**El bloque «Ajustes del documento», medido** (las dos anchuras, idéntico):

| | valor |
|---|---|
| al llegar | `aria-expanded="false"`, galón **▸**, resumen «IVA sumado · sin dirección de obra» |
| detalle desplegado de entrada | no |
| al tocar «Cambiar» | `aria-expanded="true"`, galón **▾**, 10 controles **en la página** |
| ¿se abre en un modal? | **no** |

**La pestaña «Inventario antes → después», medida aparte** (1280, `1280-11-inventario.png`): pinta, 0 errores de
consola, sin scroll horizontal, **48 filas de contenido** en 13 grupos (eran 47: el ajuste añade la fila que dice que
el texto del mensaje sale de la plantilla firmada). Contiene ya «HOJA DE ENVÍO» y «Bloque plegable».

## Pasada 1 · la v3 antes del ajuste (17-sep-2026, mediodía) — se conserva

| Anchura | Errores | Scroll horizontal | Controles < 44 px | Botones fuera de la barra fija | Total final | Confirmación tras enviar | Modal abierto | «Obra» en el documento | Filas del inventario |
|---|---|---|---|---|---|---|---|---|---|
| 1280 × 860 | 0 | no | 0 | — | 460,65 € | «✓ Enviado por WhatsApp a Comunidad Los Olivos · pendiente de firma» | no | sí | 47 |
| 390 × 844 táctil | 0 | no | 0 | 0 | 460,65 € | igual | no | sí | 47 |

El total cambia entre las dos pasadas (460,65 € → 419,87 €) porque el recorrido de la pasada 2 mete **otros conceptos**,
no porque la cuenta se haya movido: 6 × 38 + 119 = 347,00 € de base, 72,87 € de IVA al 21 %, 419,87 € de total.

- Nº «#128» en la cabecera del documento tras guardar; el ⚙︎ de arriba ya no existe.
- ⚠️ Primera pasada en 390: la barra inferior del último paso no cabía («Enviado por WhatsApp» cortado): en ese paso la
  barra lleva sólo el total y el botón; «Ver documento» queda dentro del paso. Se añadió a la medida la comprobación de
  botones fuera de la barra fija, que antes no se miraba.
- ⚠️ En la pasada 2, la hoja **sí desbordaba** a 390 px en el primer intento (contenido > 772 px, había que scrollear
  dentro para ver «Lo envío luego»). Se acortaron los dos textos explicativos de la hoja y dejó de desbordar. Se deja
  escrito porque es la clase de cosa que vuelve en cuanto alguien añada un canal más.

## Cómo se contaron los «controles < 44 px», que no es obvio

Dos exclusiones, declaradas para que el 0 signifique algo:
1. **La barra `.proto`** (el conmutador Prototipo / Inventario / Presupuesto / Justificante y la casilla «Resaltar
   textos nuevos») no es producto: es el andamio del prototipo. Fuera del recuento.
2. Un **checkbox o radio de 20 px dentro de una etiqueta `.check` de ≥ 44 px** cuenta como que cumple: el blanco de
   toque es la etiqueta entera, no la casilla.

Sin esas dos exclusiones el recuento daría 5 en cada pantalla, y los 5 serían del andamio.

- La cuenta es ILUSTRATIVA: al construir manda la de hoy (887/888).
