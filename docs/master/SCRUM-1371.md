# SCRUM-1371 · En el presupuesto rápido, reintentar el envío no vuelve a crear el cliente ni el presupuesto

**Medido contra:** `origin/main` = `0bf1dc9b89e04f2a33af3f8ce6ffb9a612e8e633` · 2026-10-01T13:23:22Z
A9: comprobación → `tests/scrum1371-reintentar-no-vuelve-a-crear.test.mjs`

Carril S2 (`public/dashboard/js/homeView.js`; §11bis: «el resto es de la S2») · rama `scrum-1371-reintentar-no-vuelve-a-crear` · sesión `s2-1octb`. Sale de medir SCRUM-1198; es otro defecto.

**Skill UI:** cargada (`yaqu-premium-ui`, en esta sesión y antes de editar). Cambio de lógica en un fichero de `public/dashboard/js/`: sin marcado, sin estilos y **sin texto nuevo**.

(La A9: mi control «cerrar y abrir el modal empieza de cero» salió rojo y no era el código — el test abría el modal sin cerrarlo, y `openQuickQuoteModal` no hace nada si ya está en pantalla. Ahora el test comprueba que el modal se cerró antes de dar por nuevo el siguiente.)

## El defecto

«Enviar por WhatsApp» hace tres cosas seguidas: alta del cliente si es nuevo, alta del presupuesto y envío. Si el envío falla con error, el botón vuelve a encenderse y cada clic repetía las tres.

No es un doble clic con la petición en vuelo: el botón ya se apaga mientras envía. Es el reintento después del fallo.

| Dos clics, con el envío fallando | Antes | Ahora |
| --- | --- | --- |
| Cliente existente | 2 presupuestos | 1 |
| Cliente nuevo | 2 clientes + 2 presupuestos | 1 + 1 |

Hoy se alcanza en producción con un cliente existente sin teléfono: el envío contesta 400 `customer_missing_phone`.

## El arreglo

El modal recuerda lo que ya creó:

1. El cliente recién creado queda como cliente elegido. Teclear otro nombre lo olvida, como ya hacía el buscador.
2. El presupuesto creado se guarda junto a lo que se pidió. Un reintento con lo mismo no crea nada y vuelve a intentar el envío de ése. Si la persona cambia una línea, lo pedido ya no coincide y se crea otro.
3. Abrir el modal de nuevo empieza de cero.

No se usa `congelarMientrasGuarda`: ese patrón impide un segundo envío **mientras el primero está en vuelo**, y aquí el primero ya ha terminado.

## Verificado, ejecutando

`tests/scrum1371-reintentar-no-vuelve-a-crear.test.mjs`, vista real en el banco y red de mentira:

- **Con la vista de `main`:** 3 de 6; caen los tres del defecto (cliente existente, cliente nuevo, y «falla y a la segunda sale»).
- **Con el arreglo:** 6 de 6, incluidos los tres controles (un clic normal crea y envía uno; cambiar las líneas crea otro; reabrir empieza de cero).

## Lo que NO arregla ni mide

- **Qué se le dice a la persona.** Sin teléfono sigue saliendo el identificador interno, y el alta de un cliente nuevo sin teléfono sigue rechazándose antes de crear nada. Eso es SCRUM-1198 y espera decisión del fundador.
- **El presupuesto que queda si se cambian las líneas tras un fallo:** el primero sigue existiendo como borrador. Es lo que la persona pidió las dos veces; no se borra nada por ella.
- **En pantalla contra yaqu.app:** no medido.
