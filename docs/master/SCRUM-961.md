# SCRUM-961 · Lectura de tickets: el emparejamiento por NIF

## SCRUM-961b · Los dos negativos del NIF, y el caso que lo rellenaba sin mirarlo

**Medido contra:** `origin/main` = `c5d642fe889af753ef6d6de27aabc84bdc3fc79b` · 2026-09-20T20:26:07Z (hora de GitHub, cabecera `Date:` de `gh api -i zen`)
**Rama:** `scrum-961b-nif-que-no-cuela`
**Por qué 961b existe aparte:** el orquestador aprobó partir SCRUM-961 en dos. **961b es la mitad que NO necesita las fotos reales del fundador** ni gasta una lectura de Gemini: `leerTicket` recibe sus dos dependencias por parámetro (`completar` y `cliente`), así que el banco entero corre con dobles. En 961 queda sólo lo que espera las fotos.

Encargo del fundador, literal: *«el emparejamiento por NIF decide si un gasto acaba colgado del proveedor equivocado, y eso es dinero mal imputado, que es peor que un campo mal leído»*.

## 🔴 LO PRIMERO: EL EMPAREJAMIENTO YA ERA CORRECTO. `src/` NO SE HA TOCADO.

**Cero líneas de producción cambiadas.** Antes de escribir nada se leyó el mecanismo (`src/modules/expenses/domain/lecturaTicket.ts:329-336`):

```ts
if (propuesta.nifProveedor !== null) {
  const fichas = await cliente.provider.findMany({
    where: { merchantId: p.merchantId, taxId: { not: null } },
    select: { id: true, taxId: true },
  });
  const casan = fichas.filter((f) => normalizarNif(f.taxId) === propuesta.nifProveedor);
  if (casan.length === 1) propuesta.providerId = casan[0].id;
}
```

Es **igualdad exacta sobre NIF normalizado** (los dos lados pasan por `normalizarNif`, la única del producto), filtrada por `merchantId`, y sólo engancha si casa con **una**. No hay `contains`, ni `startsWith`, ni `mode: 'insensitive'`, ni emparejamiento por nombre — y que el nombre no decida está escrito arriba a propósito («Leroy» y «Leroy Merlin Alcobendas» serían el mismo o no según quién mire).

Así que **este ticket no arregla un defecto: pone el juez que no había**. Se dice así porque la diferencia importa para quien lea esto dentro de tres meses.

## ⚠️ ① y ② NACIERON VERDES, y por qué eso no los invalida — pero tampoco basta

Los dos negativos pasaron a la primera. **Un control que nace verde no ha demostrado nada**: podría estar midiendo otra puerta, o no medir ninguna. Lo que les da valor son las tres mutaciones de abajo, inyectadas de verdad en `src/` y con el árbol compilado en cada vuelta.

### Las tres mutaciones, y la discriminación que prueban

| Mutación en `lecturaTicket.ts` | Qué cae | Qué NO cae |
|---|---|---|
| **M1** · el `===` pasa a `.startsWith(` | **② solo** | ①, ③ y el de 912 siguen verdes |
| **M2** · engancha a `fichas[0]` sin comprobar que casa | ①, ② y el de 912 | ③ |
| **M3** · la consulta pierde el `merchantId` | ③ y el de 912 | ① y ② |

🔒 **M1 es la que decide.** Mata **sólo** el segundo control y deja el primero en pie: eso es lo que prueba que «un NIF que no existe no engancha» y «un NIF parecido no cuela» **no son el mismo verde dos veces**. Sin M1, tres controles verdes podrían ser uno repetido — y nadie lo sabría hasta el día que hiciera falta.

M3 es la regla 2 (multi-tenant): sin `merchantId`, el gasto se cuelga del proveedor de **otro negocio** con el mismo NIF.

## Lo que sostiene el banco nuevo (`tests/scrum961b-el-nif-que-no-cuela.test.mjs`)

**① Un NIF que NO EXISTE no se engancha a NADIE — y había a quién.** El suelo de este control es la **población**: con la base vacía, «no se ha enganchado a nadie» es cierto por no haber nadie, y saldría verde con el emparejador roto. El merchant tiene tres proveedores con NIF y ninguno es el del ticket. Y lleva **control positivo sobre las MISMAS fichas**: el NIF de una de ellas sí engancha, así que el `null` no es «no engancha nunca».

**② Un NIF PARECIDO no cuela — doce formas de parecerse**, una por línea: el dígito de control arriba y abajo, dos dígitos del medio, otra letra de entidad, un carácter de menos, uno de más por delante y por detrás, sin letra, con sufijo pegado, con el prefijo `ES`, y un prefijo del bueno. Cada una **sola** delante del NIF del ticket, a propósito: con varias, un `null` podría venir del desempate (`casan.length === 1`) en vez de la comparación, que es lo que se juzga. Cierra con el positivo en el mismo test.

⚠️ El `taxId` de la ficha **no pasa por el validador** —`POST /admin/expenses` lo escribe sin validar—, así que esas doce formas son las que de verdad puede haber guardadas, no hipótesis.

**③ El que SÍ es, casa** aunque la ficha se guardara `  a-5881.8501 `, y el `where` se mira **entero** (`{ merchantId, taxId: { not: null } }`): con un doble, lo único que protege al vecino es lo que se le pide a la base.

**④ El banco JUZGA el NIF en TODOS los casos que lo llevan puesto** — el punto 4 del encargo. **Éste sí estaba rojo**, y el caso era el que el fundador anunciaba sin saber cuál:

```
🔴 hay tests que hacen leer un ticket CON NIF y no dicen nada del proveedor que se engancha:
   · scrum912 · SCRUM-912 · 🔴 la IA NUNCA da un ticket por deducible: como mucho, «falta confirmar»
```

Ese test hace leer `LECTURA_COMPLETA` —que trae `NIF_BUENO`— contra un merchant **sin proveedores**, o sea que corre el emparejamiento entero, y no miraba el resultado. **Arreglo:** una línea, `providerId === null`. Sin ella, el día que el emparejador enganchara a alguien de la nada, ese test seguiría verde.

## 🔴 Dos veces me cazó mi propio suelo, y las dos por lo mismo

1. **Un filtro que mira el BLOQUE ENTERO no puede hablar de un CASO suyo.** ④ excluía los bloques que contuvieran `nifProveedor: null`, para saltarse los que no llevan NIF. Eso se llevó por delante el test del proveedor de `scrum912`, que tiene **tres casos y sólo uno sin NIF**: de 5 bloques quedaba 1. Se quitó el filtro: todo bloque que haga leer un ticket y llegue a una propuesta tiene que decir algo del proveedor, **también cuando lo que tiene que decir es «sin NIF no se engancha nadie»**.
2. **El suelo era una cifra escrita a mano, y caducó antes de nacer.** Puse `bloquesMirados >= 4`; la realidad eran 2. El suelo saltó acusando al instrumento de ciego **cuando el ciego era el umbral**. Se sustituyó por un **control positivo anclado**: el barrido tiene que encontrar un bloque que existe y que sí juzga (`el proveedor se propone solo si su NIF casa con UNA ficha del merchant`) y no marcarlo como mudo. Si el fichero se renombra o los tests dejan de declararse con `test(`, eso lo dice; un número no lo diría.

🔒 **Un umbral escrito a mano convierte «no he podido mirar» y «he mirado y está bien» en el mismo verde, o en el mismo rojo.** Es la misma lección que SCRUM-804 tiene en su último test, cometida aquí.

## Verde

`scrum961b` (4) + `scrum912` (21) = **25 tests, 0 fallos**. `npm run guards:entrada` en verde. Censos en verde.

## Lo que NO se ha mirado, y sale del alcance de 961b

- **Una colisión VÁLIDA.** Si la IA lee mal y el resultado **sigue pasando el dígito de control** y coincide exacto con el `taxId` de otro proveedor del mismo merchant, se engancha ése en silencio. El nombre leído del ticket **no participa en la decisión** (decisión escrita en el código). Contrastar nombre y NIF sería un ticket propio: no se abre aquí.
- **Falsos NEGATIVOS por separadores raros.** `normalizarNif` quita espacios, puntos y el guion ASCII; **no** quita `/` ni los guiones unicode (`–`, `—`). Una ficha guardada con esos no casaría nunca. Es un fallo hacia el lado seguro (no engancha a quien no es), y por eso no entra en 961b.
- **La RUTA nunca comprueba `providerId`**, y es deliberado: todos sus tests usan un NIF inválido a propósito para no tocar la base (declarado en `scrum912:40-42`). El emparejado se prueba en el dominio.
- **Nadie consume el endpoint todavía.** Ningún fichero de `public/` llama a `POST /admin/expenses/leer-ticket`, así que el `providerId` propuesto **no llega hoy a ninguna pantalla**. El mecanismo está y el juez también; la pantalla es otro ticket.
- **Ninguna foto real.** Eso es SCRUM-961, y sigue esperando las del fundador.
