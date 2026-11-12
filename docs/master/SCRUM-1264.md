# SCRUM-1264q · Las preguntas de hoy para el asesor, contra el sitio único: 3 nuevas (36 → 39) y 4 que ya estaban

**Medido contra:** `origin/main` = `ec7e19e64eab26361a3d5ebae929b60474ae08ba` · 2026-11-12T11:44:49Z (cabecera `Date:` de GitHub)

A9: aviso → A10 «Un detector que acierta y publica donde nadie lee produce el mismo resultado que uno ciego.» — no se pudo comprobar: dos comentarios de este ticket (c.20892 y c.20927) «añadían» preguntas nombrando las de otro ticket (1316 §ⓓ A1–A6, 1063 c.20863 (a)–(d)) sin copiar su texto, así que quien lea sólo el sitio único no las ve; ningún guard lee Jira ni sabe si una pregunta nombrada está escrita donde se envía.

Sesión J5 (IA, `jv-j5at`), 12-nov-2026, por encargo del orquestador del equipo de Javier
(`cobroflash-backend-a0`). **Solo docs.** No se toca `src/`, ni `public/`, ni el esquema, ni el camino de
emisión, ni el máster, ni la descripción de SCRUM-1264. Nada de esto es respuesta de asesor: todo lo
fiscal va como pregunta. La lista completa vive en **SCRUM-1264 c.21663**; aquí va lo que la sostiene.

Primer registro de este ticket en `docs/master/`: hasta hoy SCRUM-1264 sólo vivía en Jira.

## Ⓐ Qué se leyó

- SCRUM-1264 entero: descripción (28 preguntas, texto del 28-sep) y los 18 comentarios, hasta c.21184.
- Literales: 1316 c.21629 · 1066 c.21622 y c.21634 · 1533 c.21593 · 1566 c.21585 · 1063 c.20863,
  c.21599 y c.21633.
- Registros en `origin/main`: `docs/master/SCRUM-1316.md` §ⓓ (A1–A6), `docs/master/SCRUM-1066.md` §4
  (190/180), `docs/master/SCRUM-1533.md` (tabla de huecos y puntos sobre la política).

## Ⓑ Veredicto, una por una

| De dónde | Pregunta | Veredicto |
|---|---|---|
| 1316 c.21629 | Si el RDL 29/2026 no se vota en plazo, ¿decae? | Ya estaba **por referencia**: A6 de `SCRUM-1316.md` §ⓓ, nombrada por la 34 (E6) de c.20892 sin su texto. Se transcriben A1–A6 en c.21663. Sin número nuevo. ⏰ 18/19-nov (cálculo de 1316g, no dato publicado). |
| 1066 c.21622 / c.21634 | ¿Siguen vigentes los impresos del 111 y del 115? | **Nueva → 37 (E9).** |
| 1066 c.21634 | Excepciones del 115 | Ya estaba: 36 (E8), c.21181. |
| 1066 c.21634 | Resúmenes 190/180 | Ya estaba en parte: E4 (quién los presenta). La lista de campos es cotejo nuestro con las órdenes (`SCRUM-1066.md` §4, «NO VERIFICADO») y lo que falta en `Provider` es esquema (A5): no es pregunta de asesor. |
| 1063 (N1, 30/31) | Bienes de inversión | (c) y (d) de c.20863 los cubren (e) y (f) de c.20927. **(a) y (b) nunca se copiaron → nueva 38 (E10).** |
| 1063 (lo demás) | Los cuatro casos de 1063j | Ya estaba: 35 (E7), c.21140. |
| 1533 | DPA de Railway, «UE» frente a «transferencia», los 4 marcados | ⚠️ No está en c.21593 (que es la firma de las notas y el dato de `GEMINI_API_KEY`): está en el registro de 1533. Los 4 marcados ya estaban en G3 (4). **El alojamiento nunca se preguntó → nueva 39 (G5).** |
| 1566 c.21585 | 2 céntimos entre tramos | No es nueva: **corrige la premisa de R-3** (c.20330, «un céntimo»): con 3 tramos llega a 2 céntimos en 12 de 2.000. Lo demás de c.21585 es diseño y GO del fundador. |

## Ⓒ Orden

SIF-1 primero (A1–A4, las dos de la declaración responsable de c.20879, A5, 30–32, el redondeo R-1…R-4,
B1–B6, D1–D3), después cobros (C1–C2), la 34 con fecha (A6 18/19-nov; A1–A5 1-dic), libros y modelos
(E1–E10, 29, 347), contratos (F1–F5) y datos (G1–G5). La tabla, con ticket y qué bloquea cada una, en
c.21663 §3.

## Ⓓ Lo que NO está medido

- No he recontado las 36 de c.21181 una a una: la numeración mezcla letras y números, y A5 y G4
  (citadas en c.17682) no tienen texto en el ticket; no he buscado dónde vive.
- No he comprobado si los impresos del 111/115 son los vigentes (por eso es la 37), ni las órdenes del
  190/180.
- No he tocado la descripción del ticket (sigue en 28 y con el texto del 28-sep).
- Suite entera local: NO CORRIDA (solo docs). Guards dirigidos: en el mensaje de entrega.

## Ⓔ Lo que me salió mal

1. **No corrí `node scripts/equipo/norma.mjs --arranque`.** Lo salté para que el encargo cupiera en
   contexto, y lo dije en el primer mensaje al orquestador y en c.21663.
2. **No me medí por separado al acabar el arranque**: la primera cifra (129.715) es arranque + la lectura
   de SCRUM-1264.
3. El encargo situaba el DPA de Railway en 1533 c.21593. Lo comprobé leyendo el comentario literal antes
   de clasificar: no estaba ahí, y lo tomé del registro de 1533.
