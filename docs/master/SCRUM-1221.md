# SCRUM-1221 · El banco de vistas convertía un fallo real en «la máquina no da»

**Medido contra:** `origin/main` = `cd78b8264d042dc01afe1ee714b002278f25e0a1` · 2026-09-28T14:46:20Z

28-sep-2026 · **S3** (bancos e instrumentos). Hallazgo de S4 midiendo SCRUM-993 (nota en
`docs/master/SCRUM-993.md` de la rama `scrum-993-sin-numero-no-se-ofrece`); encargo del orquestador.

## ① Un `assert` rojo sobre un nodo agotaba la memoria
**Reproducido antes de tocar nada:** lista de clientes pintada en el banco (93 nodos), una celda,
`assert.equal(celda, null)` → no sale `AssertionError`: sale `RangeError: Array buffer allocation
failed` a los **~94 s**. Con un nodo suelto (sin vista alrededor) fallaba bien, en 3 ms.

**Causa, medida (no deducida):** `assert` construye su mensaje con `util.inspect(…, { getters: true,
depth: 1000 })`. Los 8 accesores enumerables del nodo (`parentNode`, `children`, `firstElementChild`,
`lastElementChild`, `innerHTML`, `textContent`, `id`, `selectedOptions`) devuelven objetos nuevos en
cada lectura, que la detección de ciclos no reconoce. Inspección de la celda: profundidad 4 →
273 k caracteres; profundidad 8 → 9,7 M; profundidad 1000 → OOM.

**Arreglo:** al final de `nodo()`, los accesores y `_padre` pasan a no enumerables (en el navegador
esos accesores viven en el prototipo; `_padre` no es de ningún DOM). Lo que devuelven no cambia.
Con el arreglo, el mismo assert falla en **1 ms** con un mensaje de **4 KB** legible.

## ② `removeChild` dejaba vivos los id del subárbol
Sólo desregistraba el nodo quitado. Ahora recorre su subárbol con `todos()`, como ya hacían
`_soltarHijos` (SCRUM-897) y el montaje de `pintarVista`. `remove()` pasa por `removeChild`.

## Test — `tests/scrum1221-banco-fallo-visible.test.mjs` (en el check obligatorio)
- ① corre en un **subproceso con 512 MB y 60 s**: si el defecto vuelve, el test cae ROJO diciendo
  que es SCRUM-1221, en vez de agotar la memoria de la tanda. Suelo: la vista tiene nodos y celdas.
- Control de que ocultar los accesores no cambia lo que devuelven (`parentNode`, `children`, `id`).
- ② con control positivo (se encuentran antes de quitarlos), por `removeChild` y por `remove()`.

**Rojo probado:** con `tests/_banco-vistas.mjs` de `origin/main` → 3/3 rojos; el ① lo acusa en 5 s
(el subproceso muere con status 134, y el mensaje lo nombra). Con el arreglo, 3/3 verdes.
**Sin regresión:** los 116 ficheros que usan el banco, 1.120/1.120; metaguardas, 402/402.

## Consecuencia para quien lea un OOM
Hasta este arreglo, un OOM en un test de vistas no probaba que fuera «la máquina»: podía ser un
assert rojo. Los dos OOM archivados el 28-sep como ajenos (S1 y S3) se leyeron así antes de saberlo.
