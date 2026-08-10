# SCRUM-426 · El libro de facturas RECIBIDAS (A6), y E4 lo consume

**Medido contra:** `origin/main` = `74dbd20ab9308ff9cf980a1cdf29bf8d19e3adc6` · 2026-08-10T16:57:04+02:00
**Rama:** `scrum-426-libro-recibidas` · **Carril:** A (dominio) + la conexión en E (entrega)

---

## 🔴 La corrección del fundador, que es la mitad del ticket

Mi primera entrega dejó el motor **construido, verde y desconectado**, y justifiqué no cablearlo a
E4 así: *«sería que la capa de formato calcule»*. **Estaba mal, y mezclaba dos cosas.**

> E4 **calcularía** si leyera `Expense` y armara asientos por su cuenta. E4 **llamando** a
> `construirLibroRecibidas` y pintando lo que devuelve **no cruza la frontera: la ejerce.** Un
> motor puro cuyo consumidor natural tiene prohibido consumirlo no es una frontera, es un muro.

Y el argumento que lo cierra: el daño que enuncia este mismo ticket es *«E4 entregaría un libro
vacío que se lee como este trimestre no compré nada»*. **Un motor desconectado deja ese daño
intacto al 100 %.** Con el módulo suelto el ticket no quedaba a medias: quedaba **sin hacer, con
código nuevo de propina**.

**El tope de SCRUM-411 no se tocó.** Al conectar el motor, `LIBROS_DISPONIBLES` pasa de 1 a 2, los
inalcanzables bajan de **9 a 8** y la rama se pone verde **por construcción, no por permiso**. El
trinquete cazó exactamente lo que existe para cazar, y se corrigió haciendo lo que pedía.

---

## El motor (A6) — `libroRecibidas.ts`

Hermano de `construirLibroRegistro`: puro, filtra por merchant aunque la consulta ya lo haga
(SCRUM-243 tiene un agujero conocido, SCRUM-348) y **cuenta todo lo que descarta**.

### 🔴 La decisión que pedía el ticket: un gasto sin `baseAmount` NO es un asiento

TODAS las filas anteriores al 10-ago-2026 lo tienen a `NULL` — nacieron así en la migración, y no
se rellenaron por suposición porque `amount` es ambiguo por diseño. **Se excluyen del libro.** Las
tres alternativas, y por qué no:

| alternativa | por qué no |
|---|---|
| entrarlo con **base 0** | sería afirmar «compró y la base fue cero». Un cero afirma; aquí no se sabe. Es el defecto de SCRUM-403 por el otro lado |
| entrarlo con **`amount` como base** | inventar los datos fiscales de alguien. `amount` puede ser base o total: no consta |
| entrarlo con **celdas vacías**, como emitidas hace con `importeIlegible` | tampoco, y **la asimetría es deliberada** |

**La asimetría, explicada**, porque es lo que hace correcta la decisión: una factura **emitida** sin
importe legible **sigue siendo un hecho fiscal** —tiene número, salió de casa, consumió serie—, así
que omitirla escondería una emisión real. Un gasto sin clasificar **no es una factura recibida**: es
un apunte de caja, que es exactamente lo que el schema dice de él. No se omite un asiento: es que
no lo hay.

**Pero excluir en silencio sería el mismo defecto con otra cara.** 190 gastos fuera y un libro de 10
asientos se lee como «compré diez cosas». Por eso `sinClasificar` y `sinClasificarImporte` viajan
con el libro **y llegan hasta dentro del fichero** — ver abajo.

### Las otras reglas duras

- **`miradas` viaja siempre.** Un periodo sin compras y un lector roto dan el mismo libro vacío.
  `exigirLibroRecibidasLegible` lanza si no viene: cero asientos es una respuesta legítima, así que
  no puede ser también la respuesta al fallo.
- **La cuota se LEE, no se deriva** de base × tipo. La especificación de la columna dice que se
  guarda «porque un redondeo distinto entre pantalla y libro es una discrepancia que después nadie
  sabe explicar». Si falta, va `null` y se cuenta en `sinCuota`.
- **`null` ≠ `false`** en deducible: «nunca se clasificó» y «se decidió que no» salen distintos.
- **Las dos fechas no se confunden**: la del proveedor no se sustituye por la del apunte.
- **El tipo va en entero de porcentaje**; un `0.21` (la convención de `Quote.lines[].tax`) se
  **rechaza**: un libro con «tipo 0,21 %» no se puede entregar.

---

## La conexión (E4) — y por qué no cruza la frontera

Cadena: **ruta de E4 → `leerLibroRecibidasDelTrimestre` (E4) → `leerLibroRecibidas` (A6) → motor**.
E4 no lee `Expense` en ninguna parte: llama y pinta.

`GET /admin/libros/recibidas.csv?año&trimestre`, mismo contrato que expedidas: periodo obligatorio
(400 si falta), `X-Yaqu-Filas`, `X-Yaqu-Miradas`, `Cache-Control: no-store`, CSV heredando el
formato de la casa (SCRUM-86) con su BOM.

### Las columnas: una por campo del motor, en el orden del motor

**Ni una inventada.** No hay especificación del formato en el repositorio, así que aquí no se decide
qué columnas pide un libro de recibidas: se pinta lo que el motor sabe. Cuando P15.1 responda, el
cambio es **renombrar cabeceras**, no rehacer nada — y hay un test que lo fija derivando las
columnas del asiento que produce el motor, no de una lista escrita a mano.

⚠️ **La única excepción al 1:1, dicha para que se pueda recortar de una línea:** el motor devuelve
`proveedorId`, que es un id interno y no dice nada en un libro. Se resuelve a **NIF y nombre**,
igual que el de expedidas resuelve `clienteId`, y por el motivo que ya declara `librosAeat.repo.ts`:
*«resolver un id contra la ficha es ENTREGA, no cálculo — no suma, no reparte IVA y no toca un
asiento»*. Si prefieres una sola columna, se quita una línea.

⚠️ `nombreProveedor` sale de `Provider.name`, que es el nombre **comercial**: `Provider` no tiene
`legalName` (pendiente de schema, aprobado en principio, se acumula con la siguiente migración).
Un libro identifica por razón social, así que la columna está **incompleta a sabiendas**.

### 🔴 Los avisos van DENTRO del fichero

No en una cabecera HTTP ni en una nota de la pantalla: **el fichero viaja solo**. Se lo reenvían al
despacho por correo y ahí ya no hay pantalla que explique nada — si el aviso no está dentro, no
existe. Van dos, en sus propias filas antes de la cabecera, con el BOM conservado el primero:

1. que el formato es **provisional**, no contrastado contra especificación oficial;
2. cuántos gastos quedaron fuera y **por cuánto dinero** (solo si los hay).

**Microcopy PROPUESTA, no aprobada** (regla 30) — va con `MARCA_PENDIENTE`:

> `[PENDIENTE] Formato provisional: no contrastado contra especificación oficial.`
> `[PENDIENTE] 2 gastos sin datos de IVA no figuran en este libro. Importe total: 100.`
> *(en singular: «1 gasto sin datos de IVA no figura en este libro. Importe total: 60.»)*

---

## La prueba de que la conexión EXISTE: se ejecuta, no se menciona

Cuatro tests **recorren la cadena entera con una base falsa** y comparan lo que sale con lo que el
motor calculó. No comprueban que haya un `import` ni que un comentario hable de la conexión:

- la cadena corre y devuelve **1 fila de 2 gastos** (el otro no es asiento) con `miradas: 2`;
- las cifras son **las del motor** (base 100, cuota 21, tipo 21), no unas recalculadas;
- el `proveedorId` **se resolvió** a NIF y nombre, y el id interno **no se pinta**;
- el periodo se aplicó y la consulta va **acotada al merchant**;
- `LIBROS_DISPONIBLES` declara los dos: si «recibidas» desaparece, el motor vuelve a ser dominio
  inalcanzable — que es lo que cazó SCRUM-411;
- el CSV **contiene** los avisos y el BOM sigue siendo el primer byte.

---

## 🔴 UN GUARD AJENO SE QUEDA EN ROJO, Y NO LO TOCO

`tests/scrum325-libros-por-periodo.test.mjs:283` — **fichero de Javier**, y la orden de esta tanda
es no tocar guards ajenos:

```js
assert.equal(LIBROS_DISPONIBLES.length, 1,
  '🔴 hay más de un libro ofrecido. Si se ha añadido RECIBIDAS, `Expense` tiene que haber ganado ' +
  'antes NIF de proveedor, base, tipo y cuota de IVA — y eso es schema, que no es de este ticket.');
assert.equal(LIBROS_DISPONIBLES[0].clave, 'expedidas');
```

**Su propia condición está cumplida**: `Expense` ganó NIF de proveedor, base, tipo y cuota **el
10-ago-2026**, en las tres bases. El guard no está equivocado — está **caducado**, y dice
exactamente qué lo caducaría.

El cambio es de dos líneas y lo reparte el fundador:

```js
assert.equal(LIBROS_DISPONIBLES.length, 2, '…');
assert.deepEqual(LIBROS_DISPONIBLES.map((l) => l.clave), ['expedidas', 'recibidas']);
```

**Suite: 2516 tests, 1 fallo — solo ése.** Los otros dos rojos que salieron eran míos y están
arreglados:

- **SCRUM-377** («el "(s)" de programador no sube»): mi aviso decía `gasto(s)`. Reescrito
  resolviendo el plural de verdad. El tope **no se subió**.
- **SCRUM-289** (censo de quién ata una factura a su origen): mi `where` usaba spread condicional y
  salía `OPACO`. En vez de añadir una entrada al censo ajeno, **reescribí el `where` con las claves
  a la vista** — se ve que filtra por merchant y fecha y **no por `quoteId`**, que es lo que ese
  censo vigila. Mejor código y cero ficheros ajenos tocados.

## Lo que NO se ha tocado

`prisma/schema.prisma` · el camino de emisión (regla 38) · el 303 (A5) · `INVOICING_ES_ENABLED`
(regla 24: esto es **exportación, no emisión** — no se lee para decidir nada aquí) · ningún guard ni
entrada de máster ajenos.

⚠️ **`npm run guards:entrada` NO EXISTE** en `package.json`. Los que hay son `guard:contraste` y
`guard:prisma`: **los dos en verde**.
