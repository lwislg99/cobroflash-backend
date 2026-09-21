# El documento de la derecha — SCRUM-915e1

**Aprobado por el orquestador por delegación del fundador** el 18-sep-2026 — SCRUM-915 comentario 15868.

Firmados todos los textos de `docs/prototipos/SCRUM-915/textos-propuestos.md` menos UNO
(«Con su descripción, descuento y suplido.», que **no se construye**). Esta ficha registra los
que entran en código con el corte **915e1 · el documento vivo**, y se crea **en el mismo acto**
en que se aplican (regla 30). Cada corte de SCRUM-915 registra los suyos en su propia ficha: el
listado de este directorio ES el índice, y por eso aquí no se nombra a ninguna hermana (lo vigila
`scrum709-microcopy-por-fichero` — un fichero que cita a otro es un índice a mano, y un índice a
mano devuelve el punto único de escritura que este mecanismo vino a quitar).

## Texto aprobado, literal

El rótulo del documento y su segunda línea:

> Así lo verá el cliente

> Se actualiza mientras escribes

El hueco de la tabla de conceptos, mientras no hay ninguna línea válida:

> Aquí aparecerán los conceptos que añadas.

El pie del documento, que es una PLANTILLA:

> Presupuesto válido hasta el {dd/mm/aaaa}.

Las llaves son la notación de plantilla de este repositorio, no parte del texto: marcan el hueco
que el código rellena, igual que `{N} facturas` en el libro de registro. La aprobación escribe ese
hueco como `dd/mm/aaaa`, y la propia ficha del prototipo avisa de que «`N`, `M` y `«…»` se
rellenan». Sin las llaves, `scrum514-aprobado-y-aplicado` busca la frase LITERAL en el código, no
la encuentra nunca —el código compone la fecha— y da un rojo permanente por un texto que **sí**
está aplicado; con ellas, lo que se comprueba es su parte fija, que es lo único que un cruce con
el fuente puede afirmar de una plantilla. Esa parte fija la vigilan además `scrum600` (la ranura)
y `scrum600b` (el documento renderizado), y la fecha entera la vigila el caso D de
`npm run guard:documento-vivo`, que la cambia dos veces y comprueba que el pie va detrás.

## Dónde se pinta cada uno

| texto | dónde | qué sustituye |
|---|---|---|
| «Así lo verá el cliente» | `.quote-preview-title`, encima del documento | «Vista previa del documento» |
| «Se actualiza mientras escribes» | `.quote-preview-subtitle`, debajo del rótulo | nada: es nuevo |
| «Aquí aparecerán los conceptos que añadas.» | la única fila de la tabla del documento cuando no hay líneas | «Añade al menos una línea con concepto, cantidad y precio.» |
| «Presupuesto válido hasta el dd/mm/aaaa.» | `.preview-footer`, el pie del papel | «Presupuesto válido durante 30 días salvo indicación en contrario.» |

`dd/mm/aaaa` **no es un literal**: es la fecha del campo «Válido hasta», la misma que se guarda en
`validUntil` y la misma que se enseña en el resumen del paso Condiciones, escrita con la misma
función (`fechaCorta`). La ficha del prototipo lo dice con todas las letras: «sustituye al fijo
“…válido durante 30 días…”».

## Lo que esta ficha NO firma

- **«Nº al generar»**, también firmado en el comentario 15868 para este mismo bloque. No entra
  aquí porque hoy el documento no tiene ningún sitio donde pintar un número, y ponerle uno es
  estructura nueva del documento, no un rótulo: va con el corte que traiga el número
  (915g / 915i, según dónde caiga la fila).
- **«Con su descripción, descuento y suplido.»** — el único texto que el comentario 15868 dejó
  SIN firmar. No se toca y no se construye.

## Por qué el segundo texto no es decoración

«Se actualiza mientras escribes» es una promesa, y una promesa sin mecanismo es un texto que
miente. El mismo corte que la escribe cuelga el repintado del documento de la misma delegación de
eventos que ya refresca los pasos, y `npm run guard:documento-vivo` la comprueba en navegador:
se teclea un concepto y, **sin salir del campo y sin pulsar nada**, tiene que estar en el papel.
