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

---

# SCRUM-1264r · `docs/legal/PREGUNTAS_ASESOR.md` al día con el índice de 45: 19 bloques añadidos al final

**Medido contra:** `origin/main` = `deab373d6a379fcbfc7ec1fce0428111156f49d3` · 2026-11-12T17:10:53Z (cabecera `Date:` de GitHub)

A9: comprobación → `tests/scrum525d-anclas-que-apuntan.test.mjs`

Sesión J5 (IA, `jv-j5aw`), 12-nov-2026, por encargo del orquestador `cobroflash-backend-63`. **Solo
docs.** Fuente: SCRUM-1264, descripción (índice de 45) y c.21741 (texto de las añadidas), leídos en
Markdown por la herramienta de Jira; c.21743 decía que al fichero le faltaban «~12».

## Ⓐ Medición: qué faltaba, por contenido

Script con 1-5 palabras clave por entrada sobre `git show origin/main:docs/legal/PREGUNTAS_ASESOR.md`
(1.544 líneas, 128.351 B). Control positivo **sembrado** (una línea fabricada añadida a una copia: sale
1, y en el original 0) y uno negativo (cadena inventada: 0). El fichero no usa la numeración de 1264
(P11-P25, Q-C1…Q-C9, bloques A-G), así que «está» quiere decir que su CONTENIDO está.

- **Estaban (26):** A1 (P14), A2, A3, A4 (P19), 30-32 (P22-P24), B1 (P11), B2 (P16), B3 (bloque F),
  B4 (P12), B5 (P13), B6 (Q-C6), D1 (P20), D2 (P18), C2 (bloque C.8), E1 (P15), E2 (21.1-21.5), E3
  (SCRUM-324), E4 (Q-C8), Q-C5, E5 (Q-C7), F1, F2, F3 (bloque C), F4 (bloque G), G1 (bloque E), G2
  (P17), G3 (bloque C.9).
- **Faltaban con texto en Jira (19), añadidas:** Q-nueva-A, Q-nueva-B, R-1…R-4 + Q-redondeo, la
  ampliación de B3 (las «obras conexas»), la confirmación de D1, **D3, C1 y F5 (tres de las 28
  originales)**, 34 (E6) + A1-A6, E7, (e)(f)(g) + turismos, E10, E8, E9, 347-suplidos y G5.
- **Faltan y no se pueden añadir:** A5 y G4 — Jira no tiene su texto (c.17682 solo las nombra).

c.21743 decía ~12 porque miró solo las del comentario; las tres originales que faltaban (D3, C1, F5)
no las buscó.

## Ⓑ Cómo se añadió

- **Al final**, bajo «# Al día con SCRUM-1264 el 12-nov-2026». No arriba: `SCRUM-1023.md`,
  `SCRUM-1039.md`, los dos `INVENTARIO_AFIRMACIONES_*.md` y `ENVIO_ASESOR_2026-09-28.md` citan este
  fichero por número de línea. Comprobado por bytes: las 1.544 líneas de antes son idénticas.
- Texto cortado **por script** del Markdown que devuelve Jira, no tecleado. Control: los 16 bloques de
  c.21741 que se añaden están ENTEROS en el fichero, y D3, C1 y F5 de la descripción también; los 3 que
  no se añaden (A5, Q-C5, G4) y B2 (negativo) no están.
- **Única desviación del literal:** la ampliación de B3 cita «este fichero:889». Copiada tal cual,
  scrum525d sale ROJO (tomó el nombre de rama de la misma frase como testigo, y ese nombre está en la
  línea nueva, no en la 889). Se cambió la coordenada por una nota entre corchetes, y se dice en la
  cabecera del bloque. El guard no se tocó.

## Ⓒ Guards

Locales, por TAP: scrum525d, 267, 273, 1294, 737, 921c, 1106 y 1041 → antes del arreglo 64/65 (el
rojo de scrum525d de arriba); tras él y con este registro escrito, los ocho otra vez: 65/65, 0 saltados. No hay test con «1524» en el nombre:
el congelado de 1524 es `scripts/_anclas-sin-testigo.congelado.mjs`, y lo lee scrum525d. Suite
entera local: NO CORRIDA (solo docs).

## Ⓓ Lo que NO está medido

- Solo he comparado CONTENIDO por palabras clave: una entrada que «está» puede estar con otra
  redacción o con otra respuesta. No he cotejado la redacción de las 26 que ya estaban con la de Jira.
- No he tocado la descripción de SCRUM-1264 ni la parte de arriba del fichero (P14 sigue diciendo que
  es la más urgente, «al final del documento»; ahora hay algo más debajo).
- Q-C5 cuenta como presente, pero c.20959 le añade 4 confirmaciones (a)-(d) que aquí no están escritas
  como preguntas.

## Ⓔ Lo que me salió mal

1. Mi primer troceo de c.21741 cortaba por `---` y **se comió el final del bloque 23** (E6: el texto de
   la 34 y las A1-A6), porque ese bloque lleva un `---` dentro. Lo cazó el recuento por palabra clave
   («Bizum» no subía). Rehecho uniendo los trozos sin encabezado al anterior.
2. Copié una cita «fichero:línea» sin pensar que este repositorio las lee como anclas: lo cazó
   scrum525d (es la línea `A9:` de este tramo).
3. No me medí justo al acabar de leer Jira: lo hice después de medir el fichero (~152k).

---

# SCRUM-1264s · Las preguntas de la tarde del 12-nov (1063l y 1129): 2 nuevas al final, 2 grupos que ya estaban

**Medido contra:** `origin/main` = `8928099fe426f9a20857f1162c4cdbf4621d409a` · 2026-11-12T17:45:50Z (cabecera `Date:` de GitHub)

A9: aviso → cicatriz J5 «Al copiar un literal de Jira al fichero del asesor quité en silencio una cita a fichero y línea» — no se pudo comprobar: ningún guard compara lo copiado en docs/legal con el comentario de Jira del que sale.

Sesión J5 (IA, `jv-j5az`), 12-nov-2026, por encargo del orquestador `cobroflash-backend-63` (decisión
de Javier en SCRUM-1063 c.21764). **Solo docs.** Al ir a empujar, `origin/main` iba 2 commits por
delante (`2c52196fddfdee2f2875c38d51642785d2566812`) sin tocar ninguno de mis tres ficheros.

## Ⓐ Medición, por contenido

Script de patrones por candidata sobre `git show origin/main:docs/legal/PREGUNTAS_ASESOR.md` (1.847
líneas, 156.034 B). Control positivo del árbol: la (f) de las furgonetas (fila 28) sale en la 1770.
Control negativo: una frase inventada da 0. Positivo **sembrado**: una línea fabricada con «2 % … 2024
… 2026» añadida a una copia sale (1849), y en el original no. También se miró el índice de la
descripción de SCRUM-1264 (45 filas).

| candidata (c.21764) | veredicto | dónde |
| --- | --- | --- |
| 30/31 (N1) | **ya estaba** | fila 29 (E10: (a) y (b) de c.20863), línea 1782; la (c) de c.20863 es la (e) y la (d) quedó superada por la (f) y los turismos |
| (e), (f), (g) de c.20922 | **ya estaba** | fila 28, líneas 1769-1772 (c.20927) |
| los cuatro comportamientos de 1063j | **ya estaba** | fila 27 (E7, c.21140), líneas 1753-1756 |
| gasto al 2 % de 2024 apuntado en 2026 | **faltaba** → fila 46 | Q-C7 y E5 hablan de lo que se factura, no del soportado |
| R1 de una factura con criterio de caja (c.21756/c.21757) | **faltaba** → fila 47 | B6 (2)(3) y Q-nueva-A rozan, no la contestan |
| **de paso:** G3.(7) de c.21749 (disputa) | **faltaba** → dentro de G3 | c.21749 pide contarla dentro de G3, no como entrada nueva |

## Ⓑ Cómo se añadió

- **Al final**, bajo «# Añadidas el 12-nov-2026 por la tarde (SCRUM-1264s)». Comprobado por bytes: los
  156.034 B de `origin/main` son el prefijo exacto del fichero nuevo (`cmp`), 57 líneas añadidas y 0
  quitadas, 0 bytes CR.
- Texto copiado del Markdown que devuelve Jira. La fila 47 no tiene en Jira una redacción para el
  asesor: va como los dos literales de «sin decidir» de c.21756 y c.21757, y el bloque lo dice.
- **No se ha tocado la descripción de SCRUM-1264.** Mide 31.993 caracteres y su tope es 32.000
  (c.21743), y la herramienta de Jira la da como no editable: las filas 46-47 y G3.(7) van en el
  comentario de 1264s. Se cambia el **título** (45 → 47 entradas).

## Ⓒ Guards

Locales: scrum525d, 267, 273, 1294, 737, 921c, 1106 y 1041 (resultado en la entrega y en el comentario
de Jira). Suite entera local: NO CORRIDA (solo docs).

## Ⓓ Lo que NO está medido

- Si la R1 con criterio de caja es pregunta para el asesor o decisión del fundador: c.21757 no lo dice.
- Que el índice de la descripción recoja las filas 46-47: no cabe sin pasar el tope; lo decide el
  orquestador.
- La redacción de las «ya estaban» frente a Jira: solo su contenido.

## Ⓔ Lo que me salió mal

1. Al copiar el caso 2 de c.21763 quité la cita `modelo303.ts` + línea, temiendo a scrum525d, sin
   declararlo. Lo vi al releer, antes del commit, y la repuse entera; scrum525d la cazó (coordenada
   sin testigo), y entonces sí la cambié por una nota entre corchetes DECLARADA en la cabecera, como
   1264r. Lo que falló fue quitarla en silencio, y eso no lo caza ningún guard (es la línea `A9:`).
2. Leí la descripción entera de 1264 (32 KB) y los comentarios de 1264, 1063 y 1129: crucé de 94k a
   186k sólo leyendo Jira, y avisé al orquestador en ese momento, antes de los 200k.
