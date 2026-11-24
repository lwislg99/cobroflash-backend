# SCRUM-1578 · la columna «Móvil» en el export de clientes

## SCRUM-1578 · el export de clientes lleva el móvil (24-nov-2026)

**Medido contra:** `origin/main` = `a7cd8dea5e0b2f1193b724ba2fcb196d1d980159` · 2026-11-24T18:43:47Z
A9: comprobación → `tests/scrum1578-movil-en-export-clientes.test.mjs`

Puesto S1, rama `scrum-1578-movil-en-export`. Encargo del orquestador (`cobroflash-backend-41`, versión 1.1, ficha SCRUM-1835).

**Relevo (24-nov-2026, noche).** La primera S1 hizo la pieza en el árbol `s1-v11-facturas-redondas` (rama `scrum-1490b-anio-en-convertir`) y se quedó parada en un diálogo de permisos antes de crear la rama. La relevó otra S1, por decisión del orquestador (`orquestador`). Forense del árbol viejo (`git status --short`): `M src/modules/exports/domain/exportData.ts`, `?? docs/master/SCRUM-1578.md` y `?? tests/scrum1578-movil-en-export-clientes.test.mjs`. El `.claude/settings.local.json` también salía modificado, pero no se commitea. En `origin` no había ninguna rama `scrum-1578*` (`git ls-remote --heads`, 191 ramas). Árbol nuevo: `git worktree add -b scrum-1578-movil-en-export .claude/worktrees/s1-1578-movil origin/main`. Los tres ficheros se copiaron tal cual, sin git. Antes de copiar comprobé que `origin/main` no había tocado esas rutas desde la base de la antecesora: `git diff <su HEAD> origin/main` sobre las tres salió vacío. El árbol viejo y la rama 1490b siguen como estaban. En el árbol nuevo: `npm ci`, guard del cliente de Prisma `✔` y `npm run build`. El test da 8 de 8. Repetí M1 sobre el `dist` nuevo: 6 rojos, como en la tabla de abajo, y el `dist` restaurado quedó igual por hash.

**El GO.** SCRUM-1578 c.22568, fundador-J, STOP levantado para esta pieza: el export de clientes lleva la columna `Móvil` con `customer.mobile`, sin tocar consulta ni esquema, con test. Lo copio del encargo del orquestador; el comentario no lo he leído yo.

**Lo medido antes (c.21239, vale).** `buildClientes` y `buildClientesReferenciados` consultan con `findMany` sin `select`, así que `mobile` YA llegaba. Se perdía en `clienteRow`, al montar la fila. Desde SCRUM-590 el móvil y el fijo son dos campos: quien tenía sólo móvil salía del export sin ningún teléfono.

**Qué cambia en `src`.** Un fichero, `src/modules/exports/domain/exportData.ts`. Dos líneas de código, más comentarios:

| sitio | antes | después |
|---|---|---|
| `CLIENTES_HEADER` | `… 'Teléfono', 'Email', …` | `… 'Teléfono', 'Móvil', 'Email', …` |
| `clienteRow` | `c.phone ?? '', c.email ?? '', …` | `c.phone ?? '', c.mobile ?? '', c.email ?? '', …` |

- **El rótulo no se inventa.** Es `ETIQUETA_CAMPO.mobile` = `'Móvil'`, de `src/modules/system/domain/importarClientes.service.ts:140` (la pantalla de mapeo del importador). Así exportar e importar usan el mismo nombre. El test lo comprueba contra el importador compilado, no contra un literal.
- **Va justo después de «Teléfono».** Decisión del orquestador, del encargo. El test la fija.
- **Ni consulta ni esquema.** Las dos `findMany` siguen igual. El doble del test se pone en rojo si un día alguna lleva `select`, porque entonces el móvil podría dejar de venir.
- **Ni `portabilidadCompleta.ts` (es de J3) ni los otros 18 escalares que faltan.** No van en esta pieza.

**SCRUM-104, releído antes de tocar** (`docs/master/SCRUM-104.md` no existe; leí el commit `18bee8d3e`, fase 2). La divergencia que el comentario manda no «arreglar» es de FILTRO: el CSV suelto es la cartera por fecha de alta (R11), y el del paquete son los clientes referenciados por los documentos del rango. La cabecera y la fila son UNA y las comparten los dos usos. Añadir la columna ahí la pone en los dos a la vez, que es lo firmado, y no acerca los filtros. Lo he dejado escrito encima de `CLIENTES_HEADER`, para que la próxima columna no se meta en uno solo de los dos.

**El test** (puro: `dist/` real con `prisma.customer.findMany` doblado, la forma de SCRUM-1483). El doble filtra por `merchantId` y por el `id.in` de los referenciados, y lanza si recibe una clave que no sabe evaluar. Las dos funciones pasan por los tres controles. El CSV entero (`csvBody`, con BOM y `\r\n`) se vuelve a leer con el parser del importador (`trocearCsv`), que respeta las comillas:

- ① un cliente CON móvil sale con él bajo «Móvil», y «Teléfono», «Email», «Notas» (con `;` y comillas dentro), «Baja WhatsApp» y «Fecha de alta» siguen con su valor. Cada celda se lee por el NOMBRE de su columna;
- ② un cliente SIN móvil, con `null` y también con el campo ausente, deja la celda vacía, y en el CSV no aparecen `undefined` ni `null`;
- ③ se cuentan las celdas de la cabecera y las de cada fila, y se comparan;
- además, los dos usos llevan exactamente la misma cabecera.

**Rojo primero.** Con el `dist` de antes del cambio: 4 pass y 4 fail. Caen ① y ② en los dos usos (falta la columna «Móvil»). ③ sale verde, como debe: la base no estaba desplazada, sólo le faltaba un dato. Después de `npm run build`: 8 de 8.

Mutaciones: `tests/scrum1578-movil-en-export-clientes.test.mjs` — 6 mutantes sobre el `dist` compilado, 5 rojos y 1 equivalente, con `dist` restaurado y comprobado por hash:

| mutante | resultado |
|---|---|
| M1 la fila sin móvil (la cabecera sí lo tiene) | ROJO, 6: ③, ① y ② en los dos usos |
| M2 la cabecera sin «Móvil» (la fila sí lo tiene) | ROJO, 6: ③, ① y ② en los dos usos |
| M3 el móvil después del email, SÓLO en la fila | ROJO, 2: ① en los dos usos. **③ sigue verde**: las cuentas cuadran, y por eso ① lee cada celda por su nombre |
| M4 `c.mobile` sin `?? ''` | **sobrevive, porque es equivalente**: `csvEscape` ya convierte `null`/`undefined` en `''` |
| M5 `String(c.mobile)` | ROJO, 2: ② en los dos usos (escribe «null» o «undefined») |
| M6 «Móvil» delante de «Teléfono», en la cabecera y en la fila | ROJO, 2: ① en los dos usos (la posición decidida) |

El guion de los mutantes no se queda en git. Vivía en el temporal de la sesión.

**Lo que esto NO hace.** No cambia qué clientes entran en ninguno de los dos ficheros (SCRUM-104). No toca el LEEME del paquete: el LEEME no enumera las columnas de clientes.csv y sólo remite a «Fecha de alta», que sigue igual. Quien importe un CSV antiguo de 8 columnas en una herramienta propia por POSICIÓN verá la columna nueva. El importador de YaQu tiene pantalla de mapeo columna a columna, donde se elige qué campo es cada una (`ETIQUETA_CAMPO`). No he medido cómo se porta con la columna nueva: queda fuera de esta pieza.
