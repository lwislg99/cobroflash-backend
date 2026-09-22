# Los cuatro marcadores del editor de presupuestos, ya firmados — SCRUM-915k

**Aprobado por el orquestador por delegación del fundador** el 18-sep-2026 — SCRUM-915 comentario 15868.

Firmados todos los textos de `docs/prototipos/SCRUM-915/textos-propuestos.md` menos UNO
(«Con su descripción, descuento y suplido.», que **no se construye**). Esta ficha registra los
cuatro que entran con el corte **915k**: los que hasta hoy se pintaban como marcador
`[PENDIENTE microcopy oficial]` (regla 30) y que el comentario 15868 ya firmó. Se crea **en el mismo
acto** en que se aplican. Cada corte de SCRUM-915 registra los suyos en su propia ficha, y aquí no
se nombra a ninguna: el listado de este directorio ES el índice.

## Texto aprobado, literal

> Descripción

> Aplicar

> Este cliente tiene pactado un descuento del N %

> Aplicar a las líneas

`N` es el porcentaje que el profesional tiene pactado con ese cliente (el dato es suyo y se enseña
tal cual: es lo que le deja decidir). Los cuatro salen de `textos-propuestos.md`, sección «Los
cuatro marcadores visibles de hoy» (columna «Propuesto»).

## Dónde se pinta, y qué sustituye

| texto | dónde | qué sustituye |
|---|---|---|
| «Descripción» | rótulo del campo de descripción de la línea (el `textarea` propio de cada línea del editor) | «[PENDIENTE microcopy oficial] descripción» (y su atributo `data-microcopy="PENDIENTE_FUNDADOR"`) |
| «Aplicar» | botón de la tira «Formas de pago pactadas» del presupuesto, cuando el cliente elegido tiene formas de pago pactadas | el marcador `[PENDIENTE microcopy oficial]` que llevaba desde SCRUM-586 |
| «Este cliente tiene pactado un descuento del N %» | frase de la tira del descuento pactado, encima del botón, cuando el cliente elegido tiene un descuento por defecto | «[PENDIENTE microcopy oficial] · N %» |
| «Aplicar a las líneas» | botón de esa misma tira; aplica el descuento a las líneas, sin pisar uno tecleado a mano | el marcador `[PENDIENTE microcopy oficial]` que llevaba desde SCRUM-587 |

La tira del descuento se pinta **sólo en el presupuesto**: en el documento suelto (justificante) no
se pinta, porque su dato no sobrevive al emisor. Ese comportamiento no cambia.

## Lo que este corte reutiliza sin firmar nada nuevo

- «Formas de pago pactadas»: el rótulo de la tira de pagos, que ya estaba firmado y no se toca.
- El rótulo del campo «Cliente» y todo el resto de la pantalla del editor: no se tocan.

## Lo que esta ficha NO firma

- «Sale bajo el concepto si en Opciones marcas «Incluir descripción en el PDF».»: la ayuda de la
  descripción que 15868 también firmó. **No es de los cuatro marcadores** y este corte **no la
  construye**.
- «Con su descripción, descuento y suplido.»: el único texto que 15868 dejó SIN firmar.
- El porcentaje decimal sale con punto («7.5 %»), igual que antes de este corte: no se cambia el
  formato del número.
