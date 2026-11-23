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

A9: aviso → A10 «Una tilde entre corchetes no casa en `git grep -E` ni en `grep -E`: el patrón da cero sin avisar. Se busca la raíz sin tilde y con un fichero que la tenga al lado.» — no se pudo comprobar: mi primer barrido de este fichero llevaba `garant[ií]a` y dio CERO líneas en total; lo vi porque sabía que «garantía contractual» estaba (Q-C5), y con la raíz sin tilde salió. Ningún guard sabe qué patrón escribe una sesión en su consola.

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
3. Cité la frase de A10 por la mitad en la línea `A9:`, y scrum1294 la tumbó: compara la línea entera, no
   una subcadena. Arreglado copiando la frase completa; lo cazó el guard antes del push.

# SCRUM-1264v · Lectura legal para el PR-2 de SCRUM-1732: el RIVA 69 bis no es el artículo; la frase está en el 69.5, y el asiento con caja se anota como si no hubiera caja

**Medido contra:** `origin/main` = `8c8c2b7c2896bf8963294b2120f208405d3e0f87` · 2026-11-18T05:11:00Z (cabecera `Date:` de GitHub)

A9: sin fallo que generalice — la cita equivocada (el 69 bis «apartado 3» por el 69.5) venía en el encargo, la cazó leer el bloque entero en el BOE antes de escribir, y lo que la para ya es norma de este puesto (leer el bloque vigente, no la memoria); el espacio duro del BOE se declara en Ⓑ y no se esconde.

Sesión J5 (IA, `jv-j5be`), 18-nov-2026, por encargo del orquestador del equipo de Javier
(`cobroflash-backend-ee`). **Solo docs.** No toca `src/`, ni el esquema, ni el camino de emisión.
**Esto NO es respuesta de asesor ni decisión de producto:** es la norma literal con su fuente, para que el
fundador decida con el texto delante (reglas 17 y 26: cero claims). Va como tramo nuevo al final, y no como
«Ⓔ debajo de Ⓓ» de 1264u, que pedía el encargo: 1264u ya tiene un Ⓔ («Lo que NO está medido»), e
insertar ahí movía todas las líneas de debajo.

## Ⓐ Qué se leyó, y la corrección al encargo

- SCRUM-1732 entero, descripción y los 15 comentarios, hasta c.22006 (J1, `jv-j1fb`), en esta sesión.
- API de legislación consolidada del BOE, el 18-nov-2026 entre las 05:09:56Z y las 05:10:17Z (cabecera
  `Date:` del BOE, las seis respuestas `200 OK`). Metadatos del RIVA (`BOE-A-1992-28925`):
  `estado_consolidacion` «Finalizado», `vigencia_agotada` N, `fecha_actualizacion` `20261105T101238Z`.

| bloque | norma | versiones | la vigente (la última) |
| --- | --- | --- | --- |
| `a69bis` | RIVA | 5 | `BOE-A-2023-8576`, publicada 20230405, vigente desde 20230701 |
| `a69` | RIVA | 3 | `BOE-A-2013-11216`, publicada 20131026, vigente desde 20131027; su nota: el apartado 5 «entrará en vigor el 1 de enero de 2014» |
| `a61decies` | RIVA | 1 | `BOE-A-2013-11216`, vigente desde 20140101 (la misma que leyó 1264u Ⓓ) |
| `a62` | RIVA | 7 | `BOE-A-2021-10026`, vigente desde 20210701 |
| `a63` | RIVA | 10 | `BOE-A-2023-8576`, vigente desde 20230701 |
| `a163terdecies` | LIVA (`BOE-A-1992-28740`) | 1 | `BOE-A-2013-10074` (Ley 14/2013), vigente desde 20140101 |

**Control de que es el consolidado y no el original:** ninguno de los cuatro preceptos que deciden aquí
estaba en el texto de 1992. El 69 bis lo añade el RD 596/2016, el 61 decies y el 69.5 el RD 828/2013, y el
163 terdecies la Ley 14/2013. Las notas de cada bloque lo dicen, y el índice consolidado los trae.

🔴 **Corrección al encargo, medida:** el orquestador recordaba «RIVA art. 69 bis apartado 3 ("Plazos para
las anotaciones registrales")». **No es así.**
- El artículo que se titula «Plazos para las anotaciones registrales» es el **69**, y la frase «como si a
  dichas operaciones no les hubiera sido de aplicación dicho régimen especial» está en su **apartado 5**.
- El **69 bis** se titula «Plazos para la remisión electrónica de los registros de facturación». Su
  apartado 1 se aplica solo a «las personas y entidades a que se refiere el artículo 62.6», es decir, el
  SII. Su **apartado 2** lleva la frase paralela para el *suministro*, y añade un plazo de cuatro días
  naturales para los cobros. Su apartado 3 trata de las rectificaciones registrales del art. 70, no de caja.
- El 62.6 manda al SII a quien tenga «un periodo de liquidación que coincida con el mes natural». Si algún
  comercio de YaQu liquida por mes: **sin medir** (no he mirado ninguna base).

**La frase que el orquestador recordaba existe y dice lo que recordaba.** Lo que estaba mal era el
artículo, y eso cambia a quién se aplica: el 69.5 vale para todo libro registro general; el 69 bis.2, solo
para el SII.

## Ⓑ Literales vigentes

NBSP: el BOE trae espacios duros (U+00A0) dentro del texto. Contados con un recuento: 8 en el 69 bis, 1 en el
61 decies, 8 en el 62 y 24 en el 63. Aquí van como espacio normal, igual que en 1264u Ⓓ. **Es la única
desviación del literal.** Se quitan las notas de modificación del bloque; sus fechas van en Ⓐ.

**RIVA art. 69 bis, entero** (`a69bis`, versión `BOE-A-2023-8576`):

> Artículo 69 bis. Plazos para la remisión electrónica de los registros de facturación.
>
> 1. En el caso de las personas y entidades a que se refiere el artículo 62.6 de este Reglamento, el suministro de los registros de facturación deberá realizarse en los siguientes plazos:
>
> a) La información correspondiente a las facturas expedidas, en el plazo de cuatro días naturales desde la expedición de la factura, salvo que se trate de facturas expedidas por el destinatario o por un tercero, de acuerdo con lo dispuesto en el artículo 164.dos de la Ley del Impuesto, en cuyo caso dicho plazo será de ocho días naturales. En ambos supuestos el suministro deberá realizarse antes del día 16 del mes siguiente a aquel en que se hubiera producido el devengo del Impuesto correspondiente a la operación que debe registrarse. No obstante, tratándose de operaciones no sujetas al Impuesto por las que se hubiera debido expedir factura, este último plazo se determinará con referencia a la fecha en que se hubiera realizado la operación.
>
> En los casos en los que no proceda la emisión de factura rectificativa y deba anotarse en el libro registro de facturas expedidas las regularizaciones o ajustes de la base imponible y cuota calculadas inicialmente en operaciones acogidas al régimen especial de las agencias de viajes o al régimen especial de los bienes usados, objetos de arte, antigüedades y objetos de colección, consecuencia de descuentos u otras circunstancias posteriores al devengo de la operación, el registro de estas anotaciones deberá realizarse antes del día 16 del mes siguiente a aquél en que se hayan advertido estas regularizaciones o ajustes.
>
> b) La información correspondiente a las facturas recibidas, en un plazo de cuatro días naturales desde la fecha en que se produzca el registro contable de la factura y, en todo caso, antes del día 16 del mes siguiente al periodo de liquidación en que se hayan incluido las operaciones correspondientes.
>
> En el caso operaciones de importación, los cuatro días naturales se deberán computar desde que se produzca el registro contable del documento en el que conste la cuota liquidada por las aduanas y en todo caso antes del día 16 del mes siguiente al final del periodo al que se refiera la declaración en la que se hayan incluido.
>
> c) La información de las operaciones a que se refiere el artículo 66.1, números 1.º y 2.º, de este Reglamento, en un plazo de cuatro días naturales, desde el momento de inicio de la expedición o transporte, o, en su caso, desde el momento de la recepción de los bienes a que se refieren.
>
> La información de las operaciones a que se refiere el artículo 66.1, número 3.º, de este Reglamento, antes del día 16 del mes siguiente a la fecha de llegada de los bienes al almacén, de la puesta a disposición del adquirente o de la operación que deba registrarse.
>
> d) La información correspondiente a las facturas rectificativas expedidas y recibidas, en el plazo de cuatro días naturales desde la fecha en que se produzca la expedición o el registro contable de la factura, respectivamente.
>
> No obstante, en el caso de que la rectificación determine un incremento del importe de las cuotas inicialmente deducidas de acuerdo con lo dispuesto en el número 1.º del apartado Dos del artículo 114 de la Ley del Impuesto, el plazo será el previsto en la letra b) anterior para las facturas recibidas.
>
> e) La información correspondiente al documento electrónico de reembolso al que se refiere el artículo 9.1.2.ºB) de este Reglamento, antes del día 16 del mes siguiente al período de liquidación en que se incluya la rectificación del Impuesto correspondiente a la devolución de la cuota soportada por el viajero.
>
> A efectos del cómputo del plazo de cuatro u ocho días naturales a que se refieren las letras a), b), c) y d) anteriores, se excluirán los sábados, los domingos y los declarados festivos nacionales.
>
> 2. El suministro de la información correspondiente a las operaciones a las que sea de aplicación el régimen especial del criterio de caja deberá realizarse en los plazos establecidos en los apartados anteriores, como si a dichas operaciones no les hubiera sido de aplicación dicho régimen especial, sin perjuicio de los datos que deban suministrarse en el momento en que se efectúen los cobros o pagos totales o parciales de las operaciones.
>
> La información correspondiente a los cobros y pagos se realizará en el plazo de cuatro días naturales desde el cobro o pago correspondiente.
>
> 3. En el caso de rectificaciones registrales a que se refiere el artículo 70 de este Reglamento, el suministro de los registros de facturación que recojan tales rectificaciones deberá realizarse antes del día 16 del mes siguiente al final del periodo en que el obligado tributario tenga constancia del error en que haya incurrido.

**RIVA art. 69, entero** (`a69`, versión `BOE-A-2013-11216`):

> Artículo 69. Plazos para las anotaciones registrales.
>
> 1. Las operaciones que hayan de ser objeto de anotación registral deberán hallarse asentadas en los correspondientes libros registros en el momento en que se realice la liquidación y pago del impuesto relativo a dichas operaciones o, en cualquier caso, antes de que finalice el plazo legal para realizar la referida liquidación y pago en período voluntario.
>
> 2. No obstante, las operaciones efectuadas por el sujeto pasivo respecto de las cuales no se expidan facturas deberán anotarse en el plazo de siete días a partir del momento de la realización de las operaciones o de la expedición de los documentos, siempre que este plazo sea menor que el señalado en el apartado anterior.
>
> 3. Las facturas recibidas deberán anotarse en el correspondiente libro registro por el orden en que se reciban, y dentro del período de liquidación en que proceda efectuar su deducción.
>
> 4. Las operaciones a que se refiere el artículo 66.1 deberán anotarse en el plazo de siete días a partir del momento de inicio de la expedición o transporte de los bienes a que se refieren.
>
> 5. Las operaciones a las que sea de aplicación el régimen especial del criterio de caja que hayan de ser objeto de anotación registral deberán hallarse asentadas en los correspondientes Libros Registro generales en los plazos establecidos en los números anteriores como si a dichas operaciones no les hubiera sido de aplicación dicho régimen especial, sin perjuicio de los datos que deban completarse en el momento en que se efectúen los cobros o pagos totales o parciales de las operaciones.

**RIVA art. 61 decies, entero** (`a61decies`, versión `BOE-A-2013-11216`). **Cotejado con 1264u Ⓓ línea a
línea: idéntico**, salvo el espacio duro del apartado 1, que Ⓓ ya escribió como espacio normal:

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

**RIVA art. 63.3, primer párrafo** (`a63`, versión `BOE-A-2023-8576`; el resto del apartado son menciones
para el SII y no se copia):

> 3. En el libro registro de facturas expedidas se inscribirán, una por una, las facturas expedidas y se consignarán el número y, en su caso, serie, la fecha de expedición, la fecha de realización de las operaciones, en caso de que sea distinta de la anterior, el nombre y apellidos, razón social o denominación completa y número de identificación fiscal del destinatario, la base imponible de las operaciones, determinada conforme a los artículos 78 y 79 de la Ley del Impuesto y, en su caso, el tipo impositivo aplicado y, opcionalmente, también la expresión “IVA incluido”, la cuota tributaria y si la operación se ha efectuado conforme al régimen especial del criterio de caja, en cuyo caso se deberán incluir las menciones a que se refiere el apartado 1 del artículo 61 decies de este Reglamento.

**RIVA art. 62.6** (`a62`, versión `BOE-A-2021-10026`), que dice a quién alcanza el 69 bis:

> 6. No obstante lo dispuesto en los apartados anteriores, los libros registro a que se refiere el apartado 1 de este artículo, deberán llevarse a través de la Sede electrónica de la Agencia Estatal de Administración Tributaria, mediante el suministro electrónico de los registros de facturación, por los empresarios o profesionales y otros sujetos pasivos del Impuesto, que tengan un periodo de liquidación que coincida con el mes natural de acuerdo con lo dispuesto en el artículo 71.3 del presente Reglamento.

**LIVA art. 163 terdecies, apartados Uno y Dos** (`a163terdecies`, versión `BOE-A-2013-10074`; el Tres
trata de las deducciones y el Cuatro remite al reglamento, y no se copian):

> Artículo 163 terdecies. Contenido del régimen especial del criterio de caja.
>
> Uno. En las operaciones a las que sea de aplicación este régimen especial, el Impuesto se devengará en el momento del cobro total o parcial del precio por los importes efectivamente percibidos o si este no se ha producido, el devengo se producirá el 31 de diciembre del año inmediato posterior a aquel en que se haya realizado la operación.
>
> A estos efectos, deberá acreditarse el momento del cobro, total o parcial, del precio de la operación.
>
> Dos. La repercusión del Impuesto en las operaciones a las que sea de aplicación este régimen especial deberá efectuarse al tiempo de expedir y entregar la factura correspondiente, pero se entenderá producida en el momento del devengo de la operación determinado conforme a lo dispuesto en el apartado anterior.

## Ⓒ La tabla: libro, cobros, 303 y tope

| | pregunta | lo que dice la norma (literal entre comillas) | artículo y apartado |
| --- | --- | --- | --- |
| (a) | ¿En qué periodo se **anota** la factura expedida con caja? | «deberán hallarse asentadas en los correspondientes Libros Registro generales en los plazos establecidos en los números anteriores **como si a dichas operaciones no les hubiera sido de aplicación dicho régimen especial**». El plazo de «los números anteriores» es «en el momento en que se realice la liquidación y pago del impuesto relativo a dichas operaciones o, en cualquier caso, antes de que finalice el plazo legal para realizar la referida liquidación y pago en período voluntario». Se inscriben «una por una», con «la fecha de expedición» y la indicación de «si la operación se ha efectuado conforme al régimen especial del criterio de caja» | RIVA **69.5** y **69.1**; contenido, RIVA **63.3** |
| (b) | ¿Cómo y cuándo se **completan los cobros** parciales? | El asiento se completa: «sin perjuicio de los datos que deban completarse **en el momento en que se efectúen los cobros** o pagos totales o parciales». Qué datos: «Las fechas del cobro, parcial o total, de la operación, con indicación por separado del importe correspondiente, en su caso» y la «cuenta bancaria o del medio de cobro utilizado, que pueda acreditar el cobro». **Plazo en días: solo para el SII**, «cuatro días naturales desde el cobro». Fuera del SII, el 69.5 dice «en el momento», sin más | RIVA **69.5**; datos, **61 decies.1.1.º y 2.º**; SII, **69 bis.2** (segundo párrafo) |
| (c) | ¿Qué pide el 303, es decir, cuándo se **devenga**? | «el Impuesto se devengará en el momento del cobro total o parcial del precio **por los importes efectivamente percibidos**». Y «deberá acreditarse el momento del cobro». La repercusión se hace al expedir la factura, «pero se entenderá producida en el momento del devengo» | LIVA **163 terdecies.Uno** y **.Dos** |
| (d) | ¿Cuál es el **tope**? | «si este no se ha producido, el devengo se producirá el 31 de diciembre del año inmediato posterior a aquel en que se haya realizado la operación» | LIVA **163 terdecies.Uno** |

**Lo que la norma remite y no está leído aquí:**
- Que el 303 de un periodo recoja lo devengado en ese periodo sale de las reglas generales de
  declaración-liquidación (LIVA 164 y 167, y RIVA 71). **No las he abierto en esta sesión.** La fila (c)
  dice cuándo se devenga, no cómo se declara.
- El 163 terdecies.Cuatro remite al reglamento para las obligaciones formales. Leídos aquí: 61 decies, 63.3,
  69 y 69 bis. Los arts. 61 septies a 61 nonies (renuncia, exclusión y opción), **no**.
- El formato de los libros registro que publica la AEAT (sus columnas de cobro): **no leído**. Lo que
  pida en columnas no sale de estos artículos.

## Ⓓ Lectura, no decisión: qué implica para Q1 y Q2 de SCRUM-1732 c.22006

> Lo que sigue es una lectura del literal para que el fundador decida. No elige entre U y T, no contesta
> al asesor y no dice qué está bien en el código.

**La distinción que hace la norma.** Con caja hay dos cosas distintas que no caen en el mismo periodo:
- **El libro de expedidas** anota la factura una vez, «una por una», en los plazos de una factura sin caja
  (69.5 y 63.3), y después se le **completan** los cobros (69.5 y 61 decies.1).
- **El devengo**, que es lo que va al 303, sigue a cada cobro y a su importe (163 terdecies.Uno).

El libro no se reparte por cobros. Lo que se reparte por cobros es el devengo.

**Q1 (forma del asiento: U, «un asiento por factura y periodo»).**
- **Encaja con el literal:**
  - `cobros[]` con fecha, importe y medio por cobro: es lo que pide el 61 decies.1.1.º y 2.º.
  - Que `fecha` siga siendo la de expedición: el 63.3 pide «la fecha de expedición».
- **No sale del literal:**
  - Que el asiento **viva en el periodo del cobro**, o se repita en cada periodo con cobros: el 69.5 lo
    sitúa donde estaría sin caja.
  - Que sus `base`, `cuota` y `total` sean **la parte devengada** en el periodo. El 63.3 pide «la base
    imponible de las operaciones» y «la cuota tributaria», que son las de la factura.
- **En la lectura literal:** una factura, un asiento, en su periodo de expedición, con todos sus cobros
  dentro, también los que lleguen en periodos posteriores. Los importes devengados por periodo serían una
  cuenta del 303, no la forma del asiento.
- **T** (un asiento por tramo, el `numero` repetido) se aleja aún más: el 63.3 dice «una por una».

**Q2 (que el filtro del libro AEAT pase a ser la fecha de devengo).**
- El 69.5 apunta al revés para el libro de expedidas: la factura emitida en el T1 y cobrada en el T2 se
  anota en el T1, y en el T2 se completa su cobro.
- **Leído así, el defecto que J1 describe en c.22006 ②.2** (`leerPorCaja` la trae al T2 y el libro AEAT del
  T2 la descarta) **estaría en `leerPorCaja`**, en traer la factura al libro del periodo del cobro, y no en
  el filtro por expedición.
- **Lo que el literal no cierra:**
  - Cómo se ve, en el libro del T2, el cobro de una factura anotada en el T1. El 69.5 dice que se completa,
    no dónde se pinta.
  - Si el formato AEAT de libros tiene columnas para eso: no leído (Ⓒ).

**¿Encaja la propuesta U con la norma literal?** **En parte.** Encajan `cobros[]` y la `fecha` de
expedición. No encajan que el asiento se reparta por periodo de devengo y que sus importes sean la parte
devengada. Una forma que encaja con el literal sería: un asiento por factura en su periodo de expedición,
con `cobros[]` completo, y el devengo por periodo calculado aparte para el 303. **Es una lectura, no una
recomendación de diseño:** el coste y los consumidores (303, evidencias, pantalla) son de J1.

**Lo que esto NO toca:**
- Q3 (tramo sin medio): el 61 decies.1.2.º pide un medio «que pueda acreditar el cobro»; qué se hace si
  falta es decisión.
- Q4 y Q5 (anulaciones, cobrado de más): el literal no los trata.
- Q6 (la garantía, pregunta 49 al asesor): sigue sin respuesta, y esta lectura no la contesta.

## Ⓔ Lo que NO está medido

- LIVA 164 y 167 y RIVA 71 (cómo se declara lo devengado en cada periodo): no abiertos (Ⓒ).
- El formato de los libros registro de la AEAT y sus columnas de cobro: no leído.
- Si algún comercio de YaQu liquida por mes (y entonces cae en el SII y en el 69 bis): sin medir, ninguna
  base consultada.
- El código de `leerPorCaja`, del libro AEAT y del 303: no leído en esta sesión. Lo que digo de ellos sale de
  c.22006, que dice que está leído y no ejecutado.
- Ninguna FAQ ni consulta vinculante de la AEAT sobre caja: no leídas. La cicatriz J5 del 22-oct (la FAQ
  dice lo contrario que el anexo) vale aquí también: el literal reglamentario no es todo lo que hay.

## Ⓕ Lo que me salió mal

1. Mi primera pasada de `x.mjs` sobre el 69 no escribió el fichero de texto (lo leí por consola y no lo
   guardé), y el primer recuento de espacios duros cayó con `ENOENT` en ese bloque. Lo rehice antes de
   copiar nada; no llegó al registro.

---

# SCRUM-1264w · Lo que 1264v dejó sin leer para el libro con caja: la Orden HAC/773/2019 es del IRPF, y LIVA 164 y 167 y RIVA 71 no añaden plazo ni forma que cambie U′

**Medido contra:** `origin/main` = `bcff9d8b1ea465938ef797c17548cb5217de02bc` · 2026-11-18T15:37:05Z (cabecera `Date:` de GitHub)

A9: aviso → cicatriz J5 «Leí la orden que nombraba el encargo y era la de otro impuesto: la HAC/773/2019 es del IRPF, y la de los libros del IVA en sede es la HFP/417/2017» — no se pudo comprobar: ningún guard sabe qué norma quería leer una sesión; lo que lo para es leer el título del BOE antes que el articulado.

Sesión J5 (IA, `jv-j5bf`), 18-nov-2026, por encargo del orquestador del equipo de Javier
(`cobroflash-backend-ee`). **Solo docs.** No toca `src/`, ni el esquema, ni el camino de emisión.
**Esto NO es respuesta de asesor ni decisión de producto** (reglas 17 y 26). El encargo pedía un «Ⓕ al
final»; 1264v ya tiene un Ⓕ («Lo que me salió mal»), así que va como tramo nuevo, como hizo 1264v.
Comentario en Jira: SCRUM-1732 c.22054.

## Ⓐ Qué se leyó, y la corrección al encargo

API de legislación consolidada del BOE, 18-nov-2026, 15:33:57Z–15:36:05Z (cabecera `Date:` del BOE),
todas `200`. De cada bloque se toma la última versión, y en los cinco es la de `fecha_vigencia` mayor.

| bloque | norma | versiones | la vigente |
| --- | --- | --- | --- |
| texto entero | Orden HAC/773/2019 (`BOE-A-2019-10487`) | — | `estado_consolidacion` «Finalizado», `vigencia_agotada` N, vigente desde 20200101 |
| `a1-4` (art. 12) | ídem | 2 | `BOE-A-2020-15598`, vigente desde 20210101 |
| `a164` | LIVA (`BOE-A-1992-28740`) | 7 | `BOE-A-2023-11022`, vigente desde 20240101 |
| `a167` | LIVA | 4 | `BOE-A-2022-22128`, vigente desde 20230101 |
| `a71` | RIVA (`BOE-A-1992-28925`) | 14 | `BOE-A-2024-26694`, vigente desde 20241222 |
| `a62` | RIVA | 7 | `BOE-A-2021-10026` (la misma que en 1264v) |
| índice, `a1`, `ai` | Orden HFP/417/2017 (`BOE-A-2017-5312`) | `ai`: 6 | `ai`: `BOE-A-2026-1761`, vigente desde 20260127 |

🔴 **Corrección al encargo, medida:** el encargo describía la Orden HAC/773/2019 como la que «regula la
llevanza de los libros registro del IVA a través de la sede electrónica y el formato normalizado». Su
título en el BOE es otro: «Orden HAC/773/2019, de 28 de junio, por la que se regula la llevanza de los
libros registros en el Impuesto sobre la Renta de las Personas Físicas.» En el texto entero, «caja»
aparece **0** veces y «cobro» **0**. El control, «valor añadido», aparece **11**, así que el recuento
funciona. La orden que corresponde a lo que el encargo describía es la **HFP/417/2017**, que es la del SII.
Su título: «…por la que se regulan las especificaciones normativas y técnicas que desarrollan la llevanza
de los Libros registro del Impuesto sobre el Valor Añadido a través de la Sede electrónica de la Agencia
Estatal de Administración Tributaria establecida en el artículo 62.6…». Su identificador lo saqué de la
URL ELI del BOE, que sí introduje de memoria, y lo comprobé leyendo el `<title>` de la página.

## Ⓑ Literales vigentes

Sin espacios duros en los bloques citados (recuento: 0 en 164, 167 y la Orden; 2 en el 71, fuera de los
párrafos citados). Se quitan las notas de modificación.

**Orden HAC/773/2019, art. 12** (`a1-4`, versión `BOE-A-2020-15598`), primer párrafo:

> Los libros registros regulados en esta orden podrán ser utilizados a efectos del Impuesto sobre el Valor Añadido, siempre que se ajusten a los requisitos que se establecen en el Reglamento del Impuesto sobre el Valor Añadido aprobado por Real Decreto 1624/1992, de 29 de diciembre.

**Orden HAC/773/2019, preámbulo** (el formato de la AEAT):

> …la Agencia Estatal de Administración Tributaria publicará en su página web un formato tipo de libros registros. La puesta a disposición de este formato de libros trata de asistir en el cumplimiento de las obligaciones tributarias formales registrales y pretende ofrecer seguridad jurídica y certeza en el contenido mínimo que pueda exigirse sobre los mismos.

**Orden HAC/773/2019, art. 2.1.e)** (el libro de ventas e ingresos; los demás apartados del 2.1 piden número, fechas, destinatario, concepto y retención, y ninguno pide cobros):

> e) Importe de la operación o, si la operación está sujeta al Impuesto sobre el Valor Añadido, la base imponible de las operaciones determinada conforme a los artículos 78 y 79 de la Ley 37/1992, de 28 de diciembre, del Impuesto sobre el Valor Añadido y, en su caso, el tipo impositivo aplicado y la cuota tributaria. Igualmente será válida la anotación de una misma factura en varios asientos correlativos cuando incluya operaciones que tributen a distintos tipos impositivos.

**Orden HAC/773/2019, art. 10.1** (plazo, IRPF):

> 1. Las operaciones que hayan de ser objeto de anotación registral deberán hallarse asentadas en los correspondientes libros registros antes de que finalice el plazo para realizar la declaración e ingreso de los pagos fraccionados a que se refieren los artículos 109 a 112 del Reglamento del Impuesto sobre la Renta de las Personas Físicas.

**LIVA art. 164.Uno, 4.º y 6.º** (`a164`, versión `BOE-A-2023-11022`):

> Uno. Sin perjuicio de lo establecido en el título anterior, los sujetos pasivos del Impuesto estarán obligados, con los requisitos, límites y condiciones que se determinen reglamentariamente, a:
>
> 4.º) Llevar la contabilidad y los registros que se establezcan en la forma definida reglamentariamente, sin perjuicio de lo dispuesto en el Código de Comercio y demás normas contables.
>
> 6.º) Presentar las declaraciones-liquidaciones correspondientes e ingresar el importe del Impuesto resultante.

**LIVA art. 167.Uno** (`a167`, versión `BOE-A-2022-22128`):

> Uno. Salvo lo dispuesto en el apartado siguiente, los sujetos pasivos deberán determinar e ingresar la deuda tributaria en el lugar, forma, plazos e impresos que establezca el Ministro de Economía y Hacienda.

**RIVA art. 71.3, primer párrafo, y 71.4, dos primeros** (`a71`, versión `BOE-A-2024-26694`; en el 71.3, la
lista de quienes liquidan por mes se resume: más de 6.010.121,04 € de volumen, adquirentes de patrimonio,
inscritos en el registro de devolución mensual del art. 30, grupos de entidades y depósitos fiscales):

> 3. El período de liquidación coincidirá con el trimestre natural.
>
> No obstante, dicho período de liquidación coincidirá con el mes natural, cuando se trate de los empresarios o profesionales que a continuación se relacionan:
>
> 4. La declaración-liquidación deberá cumplimentarse y ajustarse al modelo que, para cada supuesto, determine el Ministro de Hacienda y Función Pública y presentarse durante los veinte primeros días naturales del mes siguiente al correspondiente período de liquidación trimestral.
>
> Sin embargo, la declaración-liquidación correspondiente al último período del año deberá presentarse durante los treinta primeros días naturales del mes de enero.

En el RIVA 71 entero, «caja» aparece **0** veces.

**Orden HFP/417/2017, art. 1.1** (`a1`, versión única):

> 1. Los empresarios o profesionales y otros sujetos pasivos del Impuesto sobre el Valor Añadido obligados a la llevanza de los libros registro del Impuesto través de la Sede electrónica de la Agencia Estatal de Administración Tributaria son los establecidos en el artículo 62.6 del Reglamento del Impuesto sobre el Valor Añadido, aprobado por el Real Decreto 1624/1992, de 29 de diciembre.

Su **Anexo I** (los campos de registro) lo sustituyó el Anexo V de la Orden HAC/27/2026 (`BOE-A-2026-1761`),
que se aplica a «operaciones realizadas a partir de 1 de febrero de 2026». En el BOE son **62 imágenes**,
sin texto. **No leído.** Vi la primera imagen del Anexo V de la 417/2017, que es el modelo 303 de 2017, y no
seguí por contexto.

## Ⓒ La tabla

| campo o requisito que exige la norma | fuente | ¿lo cubre `cobros[]` de U′ (SCRUM-1732 c.22012, ✅ c.22014)? |
| --- | --- | --- |
| fecha de cada cobro, parcial o total | RIVA 61 decies.1.1.º (literal en 1264v Ⓑ) | **sí** · `fecha` |
| importe de cada cobro, «por separado» | ídem | **sí** · `importe` |
| «la cuenta bancaria o del medio de cobro utilizado, que pueda acreditar el cobro» | RIVA 61 decies.1.2.º | **en parte** · `metodo` es un valor de `PAID_VIA` (`card`, `bizum_auto`, `bizum_manual`, `transfer`, `cash`; `src/modules/billing/domain/paidVia.ts:23`), y no guarda ninguna cuenta. Si ese medio «puede acreditar» el cobro, **la norma no lo dice** → pregunta 50 |
| la indicación de «si la operación se ha efectuado conforme al régimen especial del criterio de caja» | RIVA 63.3 | **no es un campo de `cobros[]`**. Si el asiento la lleva en otro campo: **no leído** |
| libro de ventas e ingresos del IRPF | Orden 773/2019 art. 2 | **la norma no dice nada de cobros** |
| campos de cobros del SII | Orden 417/2017 Anexo I | **no leído** (imágenes) |
| formato tipo de libros de la web de la AEAT | Orden 773/2019, preámbulo | **no leído** (no está en el BOE) |

| obligación de plazo o forma | cambia U′ |
| --- | --- |
| LIVA 164.Uno.4.º · los registros «en la forma definida reglamentariamente» | **no** · remite al RIVA, cuyo 61 decies, 63 y 69 ya leyó 1264v |
| LIVA 164.Uno.6.º · presentar las declaraciones-liquidaciones | **no** |
| LIVA 167.Uno · «lugar, forma, plazos e impresos que establezca el Ministro» | **no** · remite a orden |
| RIVA 71.3 · periodo trimestral, y mensual solo en los casos que enumera | **no** para un trimestral. Si un comercio liquida por mes, entra en el SII (62.6) y en los cuatro días por cobro del 69 bis.2, y U′ no remite nada |
| RIVA 71.4 · el 303, en los veinte primeros días del mes siguiente (enero, treinta) | **no** · es el plazo de la declaración, no del libro |
| Orden 773/2019 art. 10 · plazo del IRPF | **no** · para el IVA manda el RIVA 69 (1264v) |

## Ⓓ Lectura, no decisión: qué implica para PR-2

> No elige diseño, no contesta al asesor y no dice qué está bien en el código.

- Ninguna norma de las leídas añade un plazo o una forma que cambie U′ para un comercio trimestral
  fuera del SII. Lo que la norma pide sobre cobros sigue siendo el 61 decies.1.
- `cobros[]` cubre fecha e importe. El medio, en parte: no hay cuenta, y no sé si un `metodo` de un
  conjunto cerrado basta para «pueda acreditar» (pregunta 50). Q3 de c.22007 decide qué se hace si falta
  el medio, pero no si el que hay es suficiente.
- La marca de criterio de caja del 63.3 no la trae `cobros[]`. Si el asiento la lleva, se ve en el
  código de PR-2, que no he leído.
- Si algún comercio liquida por mes, el formato que manda es el del SII (Anexo I), y está sin leer.

## Ⓔ Lo que NO está medido

- El Anexo I de la Orden 417/2017, en la versión de la HAC/27/2026 (62 imágenes).
- El formato tipo de libros de la AEAT, en su web, y las FAQ de la AEAT sobre caja.
- El código de PR-2 (`scrum-1732d-libro-por-tramos-u`), y si el asiento lleva la marca del 63.3.
- Si algún comercio de YaQu liquida por mes: no he consultado ninguna base.
- RIVA 61 septies a nonies: siguen sin leer.

## Ⓕ Lo que me salió mal

1. Empecé por la orden que nombraba el encargo y leí su articulado antes de mirar el título. Era la del
   IRPF. No llegó a ningún sitio porque el recuento de «caja» dio 0 y el control dio 11, y eso me hizo
   leer el título. Va como cicatriz de J5 en este mismo PR.
2. En SCRUM-1732 c.22054, Jira movió dos negritas que rodeaban un código: el texto se lee bien, pero
   no es exactamente lo que envié.
3. Me quedé sin contexto antes de leer el Anexo I. Lo digo en Ⓔ, y no relleno lo que no he leído.
