# SCRUM-1466 · `sembrar-qa perfil` acusaba en falso por el orden de las claves

## 18-oct-2026 · S3 · el arreglo

**Medido contra:** `origin/main` = `74e60ebe5923e79f63411bbb6be0e0f09ae98393` · 2026-10-18T18:35:55Z

A9: comprobación → `tests/scrum1466-sembrar-qa-compara-sin-orden.test.mjs`

Encargo del orquestador de Luis. El carril se discutió al abrir el ticket (c.18392: `scripts/qa/` no tenía fila); lo
cerró SCRUM-1480 con `scripts/qa/**` → S3 (`dos-equipos.md:173`). Nada contra producción: el test inyecta `fetch`.

**El defecto, todavía vivo hoy:** `scripts/qa/sembrar-qa.mjs:120`, `const igual = (a, b) => JSON.stringify(a ?? null)
=== JSON.stringify(b ?? null)`. Lo usaban los dos rojos de `guardarPerfil`: «🔴 DISTINTO» (lo enviado contra lo
releído) y «🔴 CAMBIÓ SIN ENVIARSE» (cada clave no enviada, antes y después). `JSON.stringify` depende del orden de
las claves, así que el mismo perfil con las claves en otro orden salía rojo.

**Qué cambia.** `igual` desaparece y entra `diferencia(a, b)`, exportada. Compara la estructura con la semántica de
JSON: lo `undefined` cae como en `JSON.stringify`, y `null` y `undefined` sueltos valen lo mismo, como antes. Las
claves de un objeto se comparan sin orden y las listas con orden. Devuelve DÓNDE difiere, o `null`. Los dos rojos
añaden, cuando la diferencia está dentro del valor, `· difiere en clausulas[1].texto: "dos" ≠ "DOS"`.

**La aceptación, punto por punto.**

| aceptación | dónde se ve |
|---|---|
| 1. mismo contenido, claves en otro orden (anidado y dentro de una lista de objetos) → iguales | test ①; y ② con `guardarPerfil` y un `fetch` falso que devuelve las claves en otro orden en cada lectura: cero rojos |
| 2. control positivo: un campo cambiado sigue saliendo, y dice qué clave y qué valor | test ③: `difiere en clausulas[1].texto: "dos" ≠ "DOS"` y `difiere en ajustes.y: 2 ≠ 3` |
| 3. el orden de una LISTA cuenta | test ④: dos cláusulas al revés salen `DISTINTO`, `difiere en clausulas[0].id: 1 ≠ 2` |
| 4. rojo primero, y una mutación que vuelva a `JSON.stringify` lo tumba | la mutación que pone `JSON.stringify` dentro de `diferencia` tumba los 4 tests; la que quita el «difiere en» tumba ③ y ④. Las dos van en `MUTACIONES_QUE_ME_TUMBAN` |
| 5. el gemelo, buscado y dicho | **no hay**: en `scripts/qa/` los demás `JSON.stringify` son cuerpos de petición (`sembrar-qa.mjs:114`, `sembrar-casos.mjs:136`, `sembrar-albaranes.mjs:131`, `sesion-panel.mjs:119`), un mensaje (`sembrar-casos.mjs:192`) y una escritura a disco (`sesion-panel.mjs:172`). `igual` no se exportaba, y `sembrar-casos` y `sembrar-albaranes` importan otras cosas de `sembrar-qa` |

**Verificado, ejecutando.**
- `tests/scrum1466-sembrar-qa-compara-sin-orden.test.mjs`: 4 de 4.
- Con el `sembrar-qa.mjs` de `main` en su sitio cae, pero por el `import` (no existe `diferencia`): es un rojo por
  el motivo equivocado. El rojo que vale es la mutación de la fila 4. Restaurado byte a byte (hash).
- Los 15 guards de entrada, los 5 de árbol entero, `scrum1268` y los tres `scrum1367*`: 278 de 278. La salida de
  `scrum1268` («DISTINTO retencionIrpfDeclarada», «CAMBIÓ SIN ENVIARSE address») no cambia.

**Error mío, cazado antes de empujar:** el primer «difiere en» salía relativo al valor (`[1].texto`) y no decía de
qué clave del perfil; lo cazó el propio test ③. Ahora lleva la clave delante.

**Lo que NO cubre.** No se ha ejecutado contra producción: la regla de ejecución del sembrador sigue siendo del
fundador (SCRUM-1367). Que el servidor de verdad devuelva las claves en otro orden no lo he medido; el ticket lo
midió S2 el 29-sep y el test lo simula.
