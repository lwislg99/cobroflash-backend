# SCRUM-1043 · «Quién me debe»: clientes con saldo pendiente (parte de SERVIDOR)

**Medido contra:** `origin/main` = `9d665402f327af68a5a0195a2a85849c78e398c1` · 2026-09-21T18:39:33Z (cabecera `Date:` de `gh api -i zen`) · **Rama:** `scrum-1043-quien-me-debe-servidor` (apilada sobre SCRUM-1035) · **Carril:** S1 · CRM Ola 2 · solo lectura (dinero). Aviso D1 (ficheros de J2) dejado en el ticket.

## Alcance: solo el servidor
Los criterios 1-2 y 4-6 del ticket en lo que es API. **Queda para S2 y para FIRMA (regla 39):** el chip/filtro «con deuda», la columna de saldo en la fila y su captura a 390 px. Ese microcopy no está firmado y no se estrena aquí.

## Lo que cambia
- `src/modules/system/domain/saldoPendiente.ts` · `saldosPendientesPorCliente(merchantId, ids?)`: UNA consulta (`groupBy`) de facturas `pending` por cliente, siempre por `merchantId`. **Sitio único**: la ficha 360 (`stats.totalPending`, SCRUM-1035) y la lista salen de aquí (criterio 2: no dos formas de sumar).
- `GET /admin/customers` · `?conDeuda=1` deja solo a los deudores; `?orden=saldo` los ordena de mayor a menor; cada fila con deuda trae `saldoPendiente`. Cliente sin deuda = sin la clave (criterio 4, ausente no es cero). Sin parámetros la lista es la de antes más `saldoPendiente` en los deudores (aditivo).
- **Decisión mía, a confirmar:** el saldo es dinero; el rol que solo ve lo suyo (`seesOnlyOwnJobs`, el técnico) NO recibe `saldoPendiente` y `conDeuda`/`orden` se ignoran para él (como SCRUM-1078 con los precios).

## El juez: `tests/scrum1043-quien-me-debe-servidor.test.mjs` (sin banco)
Handler real sobre un mini-Prisma: 3 clientes del merchant (deuda 500, sin deuda, deuda parcial 700 sobre 1.000) y otro merchant con facturas propias incluso sobre el mismo id; orden por saldo distinto del orden de la lista; técnico sin saldos. Mutaciones (4, en rojo; restaurado, verde): técnico con saldos · sin `merchantId` · sin orden · filtro roto. `scrum1035` sigue verde con el helper compartido.

---

## SCRUM-1043a · «Quién me debe»: la mitad de PANTALLA en la lista de Clientes

**Medido contra:** `origin/main` = `f1c0ff3094c004ea7b99ffe2f1d13a21213c5ad1` · 2026-10-23T14:48:14Z
**Fecha:** 23-oct-2026 · **Rama:** `scrum-1043a-quien-me-debe-pantalla` · **Carril:** J2 (Clientes y cobro) · solo lectura (dinero)
**Skill UI:** cargada

Lo construyó jv-j2ah (dos commits, punta `5261b85271e5132c11c452d9e7291f5856a63f10`) y paró por contexto
sin empujar (Jira c.20543). El relevo (jv-j2al) revisó el diff, escribió este tramo, trajo `main` y empujó.

## Textos — firmados en c.20536 (todas las A de c.20533)

Registro: `docs/microcopy/2026-10-23-SCRUM-1043-quien-me-debe.md`. El texto vive en `filtroClientes.js`
(`TEXTOS_DEUDA`, `ORDEN_SALDO`, la columna `pendiente` y `lineasDeDeuda`). **Comparados por programa** con
los literales de Jira, cargando el módulo y no leyéndolo: filtro, orden, cabecera, cifra, garantía y vacío,
6 de 6 iguales en NFC; control sembrado («Con deuda» frente a «Con cobro pendiente») sale DISTINTO. La
garantía es el literal de SCRUM-1108, igual carácter a carácter que `customerDetailView.js:441`. Al
técnico: ni orden de saldo, ni columna, ni consulta de deuda (`veDinero`, solo `admin`, como `seesAllJobs`).

## Lo que cambia

- `public/dashboard/js/filtroClientes.js`: textos, `veDinero`, `ordenesPara`, `consultaDeDeuda`,
  `lineasDeDeuda` y la columna `pendiente` con `dinero: true`. `fijarDinero(false)` la saca de cabecera,
  selector y `colSpan` a la vez (los tres salen de `columnasDeLaTabla()`, SCRUM-584).
- `public/dashboard/js/customersView.js`: botón de alternar «Con cobro pendiente» (el componente
  `.customers-tab`, en su propia barra), opción de orden, celda con `.badge-red` y una `.alert` por
  garantía, vacío de una línea. Filtro y orden los resuelve el SERVIDOR (`?conDeuda=1`, `?orden=saldo`,
  c.16244: «ordenar y filtrar en servidor»); sólo pinta la respuesta del último pedido.
- `public/dashboard/css/styles.css`: un bloque J2 de una línea, `.table td.cell-pendiente { white-space:
  normal }`. La clase sólo la pone esta celda (`grep cell-pendiente public/` = la regla y su uso).
- **De paso** (carril J2, `src/modules/system/customerAdmin.ts`): un saldo ≤ 0 (un abono) ya no entra en
  `conDeuda`. Lo pide c.16244 («saldo negativo por un abono no cuenta como deuda»). La cifra que se manda
  no cambia; el orden tampoco.

## El juez

`tests/scrum1043a-quien-me-debe-pantalla.test.mjs`: 3 clientes (deuda, sin deuda, parcial), orden,
filtro, vacío, técnico, aislamiento entre merchants y abono. Capturas a 320/390/1280 en
`docs/master/evidencias/SCRUM-1043a/`, sobre la vista montada por el banco de la casa (`pagina.mjs`).

## `guard:lista-trabajos` ⑥ — la lista de Clientes, declarada (autorizado en c.20547)

El guard (de navegador, fuera del obligatorio) fija el HTML de Clientes contra la base y sólo admite las
piezas declaradas. El relevo lo corrió dentro de `censo:guards-navegador` (38 ejecutados, 37 verdes) y
cayó por esta pantalla. El orquestador autorizó declararla en SCRUM-1043 c.20547, como 1032 y 1135.
`node scripts/carriles.mjs de scripts/guard-lista-trabajos.mjs` → «SIN CERRADURA», sólo la fila general de
`scripts/`: no es de un puesto S.

Las piezas, MEDIDAS en el HTML que pinta el banco del guard (base `f1c0ff30` frente a la rama, 1280 px,
admin, 2 filas sin deuda), con su recuento: la barra con el botón «Con cobro pendiente» (1), la opción «Más
pendiente de cobro» (1), su casilla en «Columnas» (1), el `<th>` «Pendiente de cobro» (1) y la celda
`cell-pendiente` vacía de cada fila (2). Textos firmados en c.20536. Van en `PIEZAS_1043a`.

- **Sin la declaración, ROJO:** `🔴 Clientes ha cambiado MÁS de lo declarado por SCRUM-979, SCRUM-1032 y
  SCRUM-1135 · base sin lo declarado e1699a55aeb0ecbf ≠ hoy sin lo declarado 8de162b9ff40ca9e`
- **Con ella, VERDE:** `✅ Clientes trae LO DECLARADO (SCRUM-979, SCRUM-1032, SCRUM-1135 y SCRUM-1043a) y
  nada más · sin esas piezas (2 celdas de cada fila), idéntico a la base sin ellas e1699a55aeb0ecbf`
- **Mutaciones** (una pieza de más sin declarar, en `customersView.js`, restaurado después con
  `git diff` vacío): un `<span>` dentro de la barra del filtro → ROJO «NO trae lo declarado · la barra del
  filtro "Con cobro pendiente": 0 de 1»; un `<span>` en la barra de herramientas, fuera de las piezas →
  ROJO «ha cambiado MÁS de lo declarado». Corridas antes de dar a la casilla el hueco de atributos del
  `<span>` (SCRUM-553 lo pidió: lo había escrito con el `>` pegado); después, el guard sigue verde.

## Lo que NO cubre

- **No se ha visto en yaqu.app**: sin sesión de comercio en esta máquina. Las capturas son del banco.
- Las 6 mutaciones que jv-j2ah dio por muertas las corrió con un `mutar.mjs` de su temporal, que NO está
  en git: el relevo no las ha repetido.
- AB6 «importes grandes»: `admin-390.png` lleva «9.999,99 € sin cobrar» y dos garantías, y cabe. En las
  tres tarjetas de esa captura (también la que no debe nada) no se ve el borde derecho: no he medido si
  es el recorte de la captura o la tarjeta.
- La segunda línea del vacío de pestaña («Marca cada cliente como empresa o persona al editarlo.»), falsa
  con otros filtros: otro ticket con su firma (c.20536).

A9: comprobación → `tests/scrum584-selector-de-columnas.test.mjs`
