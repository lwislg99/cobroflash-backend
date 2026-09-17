# SCRUM-886 · La exportación de clientes, también desde la pantalla de Clientes

**Medido contra:** `origin/main` = `7fad98579f2fec757313562b4ab198216ebf15f9` · 2026-09-16T14:25:57Z
**Rama:** `scrum-886-exportar-desde-clientes` · **Carril:** Sesión 4 · **Gate:** GO del fundador (16-sep-2026), SOLO para esta entrada

> Una tercera acción en una fila que no salta de línea no se ve rota: se ve SIN la acción
> principal, porque la tarjeta recorta lo que sobra.

⏱ Hora **de GitHub** (cabecera `Date:` de `gh api -i zen`).

---

## 0 · PASO 0

- **La ruta:** `GET /admin/exports/customers.csv`, montada con `requireRole('admin')`, que deja
  pasar sólo `userRole === 'admin'`. Un técnico recibe 403.
- **Informes:** `⬇ Clientes CSV` (`btn-secondary btn-sm`, `<a>` a la ruta, sin rango de fechas).
- **La lista de Clientes:** ninguna entrada. El test lo confirmó corriendo: 0 entradas a la ruta.

## 1 · Lo construido

En la cabecera de Clientes, junto a «⬆ Importar CSV»: `<a class="btn-secondary btn-sm">` con el
literal de Informes, `⬇ Clientes CSV`, a la misma ruta. Sólo si `appUserRole === 'admin'`, el mismo
criterio que la ruta y que la vista «Descargar datos» (`app.js`). **Se oculta**, no se deshabilita
como el de importar: el ticket pide que quien no puede exportar no la vea. No lleva `title`,
porque sería un texto nuevo.

Ni ruta, ni formato, ni permisos nuevos. Informes no se toca.

## 2 · La medición que cambió la entrega

El test pasaba en verde, pero la cabecera se midió en Chromium real (`chrome-headless-shell` 1223,
CSS real de `public/`). **A 360 y 390 px, «Nuevo cliente» acababa en R=426 con la tarjeta en
344/374**, y `.data-card { overflow: hidden }` la recortaba sin aviso: la tercera acción se comía
la principal. Se añade `flex-wrap:wrap` al `cssText` que ya tenía el grupo de acciones (mismo
número de estilos en línea para el trinquete 713c). Con eso, «Nuevo cliente» baja a su línea a todo
el ancho. **A 768 y 1280 px, las coordenadas son idénticas** con y sin el salto.

Banco y salida: `docs/master/evidencias/scrum886/` (`banco-cabecera-clientes.html`, `medicion.txt`).
⚠️ El banco replica el DOM de la cabecera, no monta la vista real. Su control: la variante
«antes» cabe en los cuatro anchos y «después» se corta sólo en móvil, así que el banco distingue.

## 3 · El test y sus rojos

`tests/scrum886-exportar-clientes-desde-clientes.test.mjs`, 5 tests, montando las vistas reales con
`_banco-vistas.mjs`.

| pasada | pass | fail |
|---|---|---|
| código de `origin/main` | 3 | 2: Clientes tiene 0 entradas |
| con el arreglo | 5 | 0 |
| entrada visible para todos | 4 | 1: el técnico la ve |
| rótulo distinto del de Informes | 4 | 1 |
| la vista revienta al montar (suelo) | 2 | 3, con «NO PUDE MIRAR» |
| ruta montada con `requireRole('tecnico')` | 4 | 1: cambió quién puede exportar |

**Error propio:** el primer rojo de «visible para todos» NO era un rojo: el negativo comparaba
nodos con `deepEqual`, `assert` intentó pintar el grafo circular del banco y el proceso murió sin
memoria a los 128 s (4 tests reportados en vez de 5). Ahora compara una cuenta, y el rojo sale en
4 s con su mensaje.

## 4 · Hallazgos que NO se arreglan aquí

- **Informes no se oculta al técnico** (`app.js` le oculta Planes, Equipo, Descargar datos,
  Configuración y Gastos), así que ve `⬇ Clientes CSV` y la ruta le da 403.
- **Facturas y Presupuestos ya tienen su «⬇ CSV» en la cabecera de lista**, sin mirar el rol:
  un técnico lo ve y recibe 403.
- «⬆ Importar CSV» y el nuevo botón miden 30 px de alto: por debajo de los 44 px de AB6. Es la
  medida de `btn-sm` en todo el panel, así que no es de este ticket.

## 5 · La línea base de SCRUM-698

La suite completa dio un solo rojo, de 7.065: `renderCustomersView` monta 69 nodos y la línea base
decía 68. Es el producto, no el banco. Nodo **por identidad**: `a.btn-secondary.btn-sm` con
«⬇ Clientes CSV» (subárbol de 1). **Aislado:** sin su `appendChild`, 68 exactos. La igualdad sigue
siendo exacta; sube la línea base con su motivo escrito en el test.

**Segundo error propio:** mis logs de medición usaban `"$TMPDIR/.."`, y `$TMPDIR` está vacío en
este shell. Primero escribí que habían ido a `D:\`, y también era una deducción: medido, fueron a
la raíz de MSYS (`/`, la carpeta de instalación de Git). Fuera del árbol, pero no en el scratchpad.
Borrados los 26 por nombre, con recuento 0 después.
