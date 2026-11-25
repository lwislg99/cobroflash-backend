# SCRUM-1838 · BANCO DE EMISIÓN · relaciones de `Invoice` y el PDF en disco, para todos

## SCRUM-1838 · S3 · la cura, con rojo primero, el barrido y los envoltorios de 1787s fuera

**Medido contra:** `origin/main` = `db0a6c04541c258eda6499e1088cf16db9f1836b` · 2026-11-24T18:29:08Z

Puesto S3 (relevo; la sesión anterior murió por límite de uso sin traspaso), rama
`scrum-1838-banco-emision-relaciones`, por encargo del orquestador. La descripción del ticket me llegó
del orquestador por mensaje (sin Rovo en el encargo): viene de poner en verde #3201 (665e, PDF
persistente), medido por jv-j1kk (c.22668), jv-j1kl y jv-j1km (c.22670).

**El defecto.** `tests/_banco-emision-con-estado.mjs` tenía dos huecos desde SCRUM-665e:

1. `conRelaciones` sólo modelaba las relaciones de `charge`. `ensureInvoicePdf`
   (`src/lib/invoicing.ts:41`) relee la factura con
   `include: { merchant, customer, rectifies: { select: { number } } }` y, sin las dos primeras, lanza
   `missing_relations`. El camino de emisión **se lo traga** («PDF NO congelado al emitir … Se congelará
   la primera vez que se pida»), así que los consumidores seguían en verde sin que el PDF se
   congelara nunca en el banco.
2. El doble de `dist/lib/pdf.js` no escribía fichero, y 665e lee la huella del PDF en disco
   (`huellaDeFichero`, `src/lib/invoicing.ts:180`): ENOENT.

Mientras tanto, J1 puso **dos envoltorios locales** en `tests/scrum1787s-congelar-formas-de-pago.test.mjs`
(SCRUM-665g): uno para las relaciones y otro que escribía el fichero en un `mkdtemp` vía
`RAILWAY_VOLUME_MOUNT_PATH`.

**La cura** (`tests/_banco-emision-con-estado.mjs`):

- `RELACIONES`, una tabla por modelo: `charge` (`customer`, `merchant`, `events`, como antes) e
  `invoice` (`merchant`, `customer`, `rectifies`). `include: { rel: { select } }` proyecta como Prisma;
  `true`, la fila entera; siempre una COPIA. **Una relación pedida que el banco no sabe LANZA**
  (antes se ignoraba en silencio en cualquier tabla): una fila sin la relación haría leer «el código
  no la usa» donde pasa «el banco no la sabe».
- El doble del PDF cumple el contrato de `pdf.service.ts`: escribe `<disco>/invoices/<merchantId>-<number>.pdf`
  y devuelve `outPath` además de `publicUrlPath`. Escribe en la ruta derivada A LA VISTA del `mkdtemp`
  del banco, no en el `invoicesDir` que lea de `dirs.js`: así lo prueba el censo de SCRUM-824
  (`tests/scrum824-temporales-fuera-del-arbol.test.mjs` lo cazó en la suite completa con la primera
  forma: «ha cambiado el conjunto de ficheros con creaciones que NO se pueden probar»). Que `dirs.js`
  apunte al mismo sitio lo exige el caso ③.
- El disco: el banco crea un temporal del sistema (`mkdtemp` en `os.tmpdir()`), pone
  `RAILWAY_VOLUME_MOUNT_PATH` antes de que nada cargue `dist/`, lo expone como `banco.dirPdf` y lo borra
  al salir el proceso. Si `dist/core/storage/dirs.js` ya estaba cargado al importar el banco, **para en
  voz alta** (su `invoicesDir` sería otro y el doble escribiría donde el código no lee).

**Los envoltorios de 1787s, fuera, en este mismo PR.** El cruce de carril (1787s es fichero de J1) lo
autoriza el propio ticket: SCRUM-1838, descripción del orquestador J, «el banco modela las dos cosas
para todos Y se quitan los dos envoltorios de 1787s EN EL MISMO PR (dejarlos = dos dobles para lo
mismo)». Se quitan los dos envoltorios y el `mkdtemp` propio. El test
`SCRUM-665g · el disco del doble es un temporal del sistema…` **se queda**: ahora compara con
`banco.dirPdf`, o sea, vigila al banco. Nada más cambia en 1787s (y sale el `import os` que se quedó sin uso).

**Rojo primero.** `tests/scrum1838-banco-emision-relaciones-y-pdf.test.mjs`, 8 casos:

| banco | resultado |
|---|---|
| el de main | **6/8 ✖**: ① relaciones de `invoice` con `select`, ① control positivo (`rectifies: null`, cada factura con SU comercio), ① relación desconocida lanza, ③ el disco es un temporal fuera del árbol, ② el doble escribe el fichero y devuelve `outPath`, ④ punta a punta (`pdf_sha256` = huella del fichero; cae por `missing_relations`) |
| con la cura | 8/8 ✔ |

Los dos controles pasan en los dos bancos: «las relaciones de `charge` siguen como estaban» y «el
fallo a propósito del PDF sigue fallando y no deja fichero».

**Mutaciones** — declaradas en `MUTACIONES_QUE_ME_TUMBAN` del test nuevo (las ejecuta el meta-guard), cada
mitad de la cura quitada por separado: `invoice` sin `merchant` · `rectifies` ignora su `select` · la
relación desconocida se ignora · el doble no escribe el fichero · el disco se desvía a otro sitio que
el del banco (dentro del mismo temporal, para que la mutación no escriba en el árbol). Medidas una vez
antes de pasar al catálogo, también contra 1787s: «`invoice` sin `merchant`» y «el doble no escribe»
tumban además sus 4 casos ⑦⑧⑨ que emiten. 1787s ya depende del banco, no de un envoltorio.

### Barrido: los consumidores del banco

Población: los 7 `tests/*.test.mjs` que importan el banco (`git grep -l _banco-emision-con-estado`) + el
nuevo. Mismo árbol y misma orden (`node --test --test-force-exit`, TAP a fichero fuera del árbol):

| banco | ficheros | tests | pass | fail | saltados |
|---|---|---|---|---|---|
| main | 7 | 71 | 71 | 0 | 0 |
| cura (+ el nuevo) | 8 | 79 | 79 | 0 | 0 |

Conjunto de fallos: vacío en los dos. **Ningún test cambia de veredicto.** Lo que esto NO prueba
(**no medido**): cuáles de los otros seis consumidores llegan a `ensureInvoicePdf` y se tragaban el
`missing_relations`. Si alguno llega, ahora congela el PDF de verdad en el banco y ningún caso suyo lo
mira; su verde no dice nada sobre el PDF, ni antes ni ahora.

### Suite completa (local, Windows) y lo que no es de aquí

`tests/*.test.mjs` entero: 14.410 tests, 7 ✖ con la primera forma del doble. Uno era mío (824, arriba,
arreglado y re-medido). Los demás, re-corridos uno a uno en este árbol:
`scrum854` (el registro aún no estaba en git; pasa con el commit) · `scrum1244c` y `scrum824` como intermitencia
de la tanda (pasan solos) · `scrum1726` D1 ×2 (cae igual sin este cambio: el barrido de SCRUM-1825 lo
mide en los dos bancos) · `scrum351` (29 worktrees AJENOS de la máquina con `node_modules` roto) ·
`scrum1633` (**hallazgo de paso, para su dueño**: su muestra de 1 de cada 40 rutas absolutas ya suma ~33.950
caracteres, por encima de los 32.767 de una línea de órdenes de Windows en un worktree de ruta larga;
`spawnSync` no arranca y `r.stdout` llega `undefined`. Con el repo creciendo, le pasará a más árboles).
Los 5 de árbol entero de SCRUM-1560: verdes.

A9: comprobación → `tests/scrum1838-banco-emision-relaciones-y-pdf.test.mjs`
Mutaciones: catálogo → `tests/scrum1838-banco-emision-relaciones-y-pdf.test.mjs`
