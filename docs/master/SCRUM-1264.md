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

A9: aviso → cicatriz J5 «Al copiar un literal de Jira al fichero del asesor quité en silencio una cita a fichero y línea, por miedo a que la leyera scrum525d como ancla; lo vi al releer el bloque, antes del commit» — no se pudo comprobar: ningún guard compara lo copiado en docs/legal con el comentario de Jira del que sale.

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

---

# SCRUM-1264t · Los restos de 1129 y 1240 y dos datos del 1076: 1 fila nueva (48) y 2 ampliaciones (16 y 30)

**Medido contra:** `origin/main` = `37947dc1522a094320a4499eac28800f38cdc659` · 2026-11-16T15:44:47Z (cabecera `Date:` de GitHub)

A9: aviso → A10 «Cero resultados con tu vocabulario no es silencio del documento.» — no se pudo comprobar: la clave 18 se dio por ausente (SCRUM-1129 c.21909) buscando sólo en `PREGUNTAS_ASESOR.md`, y estaba como B5.(4) en la descripción de SCRUM-1264; ningún guard compara este fichero con la descripción viva de Jira.

Sesión J5 (IA, `jv-j5bc`), 16-nov-2026, por encargo del orquestador del equipo de Javier
(`cobroflash-backend-64`). **Solo docs.** No se toca `src/`, ni `public/`, ni el esquema, ni el camino de
emisión, ni la descripción de SCRUM-1264. Nada de esto es respuesta de asesor.

## Ⓐ Qué se leyó

- SCRUM-1264: descripción entera (índice de 45 filas y las 28 preguntas).
- SCRUM-1129: los 19 comentarios, hasta c.21912 (cierre). SCRUM-1240: descripción y los 12 comentarios,
  hasta c.21913 (cierre). SCRUM-1076: los 8 comentarios, hasta c.21916.
- SCRUM-1264 c.21914 (los restos que pasan aquí): los 27 comentarios bajados a un fichero y leído ese.
  Pide la clave 18 como «fila literal nueva»; va como ampliación de la fila 16 (Ⓑ), y se dice en el bloque.

## Ⓑ Medición, por contenido

Patrones sobre `git show origin/main:docs/legal/PREGUNTAS_ASESOR.md` (1.904 líneas, 159.866 B):
`mixta|clave 18|ClaveRegimen.{0,20}18|v1\.0\.4|Internet Archive|HAP/2194|art\. 4\.4` → **0**.
Positivo **sembrado**: una línea fabricada («factura mixta con la clave 18 y la HAP/2194») añadida a una
copia sale (línea 1906). Negativo: una frase inventada da 0. Positivo del árbol: «criterio de caja», 5.
Además se buscó a mano por concepto (recargo, B5, P13, Q-C4, Q-C8, 61 undecies, 6.1.p) y en el índice y
el texto de la descripción de SCRUM-1264.

| resto | veredicto | dónde queda |
| --- | --- | --- |
| clave 18: ¿quién la usa y cuándo? (1129 c.21909/c.21912) | **ya estaba en Jira** como B5.(4), fila 16 (c.21753 punto 5 ya la remitía allí); **no estaba en el fichero** (P13 = B5 no trae la (4)) | ampliación de la **fila 16**, con el dato de la v1.0.4 |
| factura mixta S1+S2 con criterio de caja (1240 c.21776/c.21910/c.21913) | **faltaba** en los dos sitios | **fila 48** |
| 390 → art. 4.4 suprimido; 347 → art. 17.2 HAP/2194/2013 NO VERIFICADO (1076 c.21868) | no son pregunta nueva: son remisiones sin leer de Q-C8 | ampliación de **Q-C8**, que es la **fila 30** (E4 = Q-C1 a Q-C8, `ENVIO_ASESOR_2026-09-28.md`) |

## Ⓒ Cómo se añadió

- **Al final**, bajo «# Añadidas el 16-nov-2026 (SCRUM-1264t)». Comprobado por bytes: los 159.866 B de
  `origin/main` son el prefijo exacto del fichero nuevo (`cmp`), 68 líneas añadidas y 0 quitadas, 0 CR.
- Texto copiado del Markdown que devuelve Jira, sin ninguna desviación declarada ni cita «fichero:línea».
- **Para el índice de la descripción de SCRUM-1264** (lo actualiza el orquestador): una fila nueva, la
  **48** («Factura mixta S1+S2 con criterio de caja: ¿lleva la mención?» · SCRUM-1240 c.21776/c.21910 ·
  SIN RESPUESTA · COM), y dos filas que cambian: la **16** (B5 → «B5 (+ clave 18, c.21912)») y la **30**
  (E4 → «E4 (+ remisiones del 390 y del 347, SCRUM-1076 c.21868)»). Las 46 y 47 siguen sin estar en el
  índice (1264s Ⓓ).

## Ⓓ Lo que NO está medido

- Si la descripción de SCRUM-1264 admite las tres filas sin pasar su tope de 32.000 caracteres (1264s Ⓑ).
- La redacción de B5.(4) para el asesor con el dato nuevo: va como los literales de Jira, sin redactar.

## Ⓔ Lo que me salió mal

1. Mi primera llamada a Jira usó el nombre del sitio como `cloudId` y rebotó; el bueno salió de
   `getAccessibleAtlassianResources`. Sin coste.
2. Pedí los comentarios de SCRUM-1264 enteros sabiendo que es el ticket más largo del equipo; tardó más de
   cinco minutos y murió sin respuesta; la segunda vez llegó a un fichero. Crucé los 200k leyendo Jira
   (211.078, avisado al orquestador en ese momento).

---

# SCRUM-1264u · La garantía retenida con criterio de caja (1732) y el ImporteTotal con suplido (1054): 1 fila nueva (49), 1 ampliación (15) y el RIVA 61 decies leído en el BOE

**Medido contra:** `origin/main` = `f84a8ca16ce3b3365fb4e1c08635a48377bcc683` · 2026-11-16T16:59:36Z (cabecera `Date:` de GitHub)

A9: aviso → A10 «Una tilde entre corchetes no casa en `git grep -E` ni en `grep -E`: el patrón da cero sin avisar.» — no se pudo comprobar: mi primer barrido de este fichero llevaba `garant[ií]a` y dio CERO líneas en total; lo vi porque sabía que «garantía contractual» estaba (Q-C5), y con la raíz sin tilde salió. Ningún guard sabe qué patrón escribe una sesión en su consola.

Sesión J5 (IA, `jv-j5bd`), 16-nov-2026, por encargo del orquestador del equipo de Javier
(`cobroflash-backend-64`). **Solo docs.** No se toca `src/`, ni `public/`, ni el esquema, ni el camino de
emisión, ni la descripción de SCRUM-1264. Nada de esto es respuesta de asesor.

## Ⓐ Qué se leyó

- SCRUM-1264: descripción entera (índice de 46 filas y las 28 preguntas).
- SCRUM-1732: descripción y los 10 comentarios, hasta c.21947; SCRUM-1054: descripción y los 6, hasta
  c.21866. Los dos los leyó un agente lector de esta sesión, que devolvió literales c.21820 ④, c.21926 §②,
  c.21862, c.21864 (pregunta 4) y c.21865, y una línea por cada comentario posterior. **No los he cotejado
  byte a byte en la pantalla de Jira.**
- Ninguno de los comentarios posteriores añade estas preguntas a SCRUM-1264 ni las contesta: c.21820
  dice «**no la he añadido**», y c.21865 deja los suplidos esperando a P12.1.

## Ⓑ Medición, por contenido

Sobre `docs/legal/PREGUNTAS_ASESOR.md` de esta rama (= `origin/main`, 1.972 líneas, 165.308 B):
`terdecies|garant|1\.310|1\.210|liberac` → 4 líneas, ninguna sobre devengo con caja (Q-C5, la garantía
como retención de pago en régimen general; 1344, 1394, 1521, ajenas). **Positivo del árbol:** «contractual»
→ 1 (la línea de Q-C5). `P12.1` → 1 (la P12 de junio, sin cifras). Además, a mano: B4, B6, P12, Q-C3,
Q-C5, Q-C6 y Q-C8, y el índice y el texto de la descripción de SCRUM-1264.

| pregunta | veredicto | dónde queda |
| --- | --- | --- |
| garantía retenida con caja y el tope del 31-dic (1732 c.21820 ④.4) | **faltaba**: B6 pregunta la fecha de cobro, no el devengo de lo retenido | **fila 49** |
| ImporteTotal con suplido, 1.310 o 1.210 (1054 c.21864/c.21865) | **ya estaba** como P12.1 en el fichero y B4.(2) en Jira, sin las cifras | ampliación de la **fila 15** (B4), con las cifras y el tramo al 0 % de c.21862 |

## Ⓒ Cómo se añadió

- **Al final**, bajo «# Añadidas el 16-nov-2026 (SCRUM-1264u)». Comprobado por bytes: los 165.308 B de
  `origin/main` son el prefijo exacto del fichero nuevo (`cmp -n`), 54 líneas añadidas y 0 quitadas, 0 CR.
- **Para el índice de la descripción de SCRUM-1264** (lo actualiza el orquestador): una fila nueva, la
  **47** («**49 (fichero)** · Garantía retenida con criterio de caja: ¿el IVA de lo retenido se devenga al
  liberarlo o el 31-dic del año siguiente (163 terdecies.Uno)?» · SCRUM-1732 c.21820 ④ · SIN RESPUESTA ·
  fichero), y una fila que cambia: la **15** (B4 → «B4 (+ P12.1 con cifras: ¿ImporteTotal 1.310 o 1.210?,
  SCRUM-1054 c.21864/c.21865)» · respuesta: «IA · 22-sep; la (2) con cifras SIN RESPUESTA» · «DESC +
  fichero (16-nov)»).

## Ⓓ Verificación legal: RIVA art. 61 decies (para el PR-2 de SCRUM-1732)

**Fuente:** API de legislación consolidada del BOE, `BOE-A-1992-28925` (RD 1624/1992, RIVA), bloque
`a61decies`, pedido el 16-nov-2026 a las 16:58:02Z (cabecera `Date:` del BOE). Metadatos de la norma:
`estado_consolidacion` «Finalizado», `vigencia_agotada` N, última actualización del consolidado
`20261105`. **El bloque tiene UNA sola versión:** `id_norma="BOE-A-2013-11216"`, `fecha_publicacion=20131026`,
`fecha_vigencia=20140101`; nota: «Se añade por el art. 1.21 del Real Decreto 828/2013, de 25 de octubre.»
**Control de que es el texto consolidado y no el original:** el artículo no existe en el RIVA de 1992 (lo
añade un RD de 2013), y el índice consolidado lo trae.

Literal, entero:

> Artículo 61 decies. Obligaciones registrales específicas.
>
> 1. Los sujetos pasivos acogidos al régimen especial del criterio de caja deberán incluir en el libro registro de facturas expedidas a que se refiere el artículo 63 de este Reglamento, la siguiente información:
>
> 1.º Las fechas del cobro, parcial o total, de la operación, con indicación por separado del importe correspondiente, en su caso.
>
> 2.º Indicación de la cuenta bancaria o del medio de cobro utilizado, que pueda acreditar el cobro parcial o total de la operación.
>
> 2. Los sujetos pasivos acogidos al régimen especial del criterio de caja así como los sujetos pasivos no acogidos al régimen especial del criterio de caja pero que sean destinatarios de las operaciones afectadas por el mismo deberán incluir en el libro registro de facturas recibidas a que se refiere el artículo 64 de este Reglamento, la siguiente información:
>
> 1.º Las fechas del pago, parcial o total, de la operación, con indicación por separado del importe correspondiente, en su caso.
>
> 2.º Indicación del medio de pago por el que se satisface el importe parcial o total de la operación.

**Contra lo que c.21926 §② recordaba «de memoria»** («el libro de expedidas con RECC tiene que llevar la
fecha y el importe de cada cobro y el medio»): **lo dice**, con cuatro matices que el PR-2 necesita:

1. **Por cada cobro, parcial o total:** su fecha y, «en su caso», su importe por separado. Un cobro
   total único no necesita importe aparte; varios cobros, sí, cada uno con el suyo.
2. **«la cuenta bancaria o del medio de cobro»:** es una alternativa, no dos campos. Pero no vale
   cualquier medio: tiene que ser uno «que pueda acreditar el cobro». Va con LIVA 163 terdecies.Uno:
   «deberá acreditarse el momento del cobro, total o parcial».
3. **El apartado 2 alcanza al libro de RECIBIDAS:** el propio profesional en caja, y también quien
   **no** está en caja pero recibe facturas de uno que sí, tiene que llevar fecha, importe y medio de cada
   **pago**. c.21926 no lo nombra.
4. **No dice nada del devengo por tramos** ni del tope del 31-dic: eso es LIVA 163 terdecies.Uno (literal
   en la fila 49 del fichero), y qué pasa con la garantía retenida es justo la pregunta 49.

## Ⓔ Lo que NO está medido

- Si la AEAT valida que el `ImporteTotal` cuadre con la suma del desglose (lo que haría inviable el 1.310
  con desglose de 1.210): no lo he mirado en las validaciones; c.21864 tampoco.
- Si el diseño de `InvoicePayment` (SCRUM-1732 c.21928) guarda la cuenta o el medio de cada cobro: no he
  leído el esquema ni el PR-1.
- Si la descripción de SCRUM-1264 admite la fila nueva sin pasar su tope de 32.000 caracteres (1264s Ⓑ).

## Ⓕ Lo que me salió mal

1. El barrido con `garant[ií]a` dio cero en todo (línea A9 de arriba). Lo cacé con el positivo que ya
   conocía; sin él habría escrito «no hay nada de garantía» en Ⓑ.
2. Los literales de Jira los trajo un agente lector, para no meter dos tickets enteros en mi contexto: son
   copia de una copia, y lo dice el propio bloque del fichero.
