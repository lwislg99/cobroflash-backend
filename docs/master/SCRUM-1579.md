# SCRUM-1579 · El test de SCRUM-1515 contaba TODOS los merchants de la base compartida

**Medido contra:** `origin/main` = `00179a513a5fb11ca12d61fe25b1b2dec26b51ca` · 2026-10-23T04:38:29Z (hora de GitHub al escribir: 2026-10-23T09:22:29Z)
A9: comprobación → `tests/scrum1515-nuestra-puerta-de-alta.test.mjs`

Puesto J3 (`jv-j3al`) · árbol `j3al-1579` · rama `scrum-1579-cuenta-los-de-su-guion`. Encargo del orquestador del
equipo de Javier (`cobroflash-backend-62`). **Carril J3, declarado:** `node scripts/carriles.mjs de` dice «sin fila en
§3» para el test; sus tres últimos commits en `main` se declaran J3 (68e33c716, 409e05317, 2a899f653). Sólo se toca
el test: ni el guion de alta ni ninguna ruta.

## PASO 0

Sin commits en `origin/main` con «SCRUM-1579», sin rama `scrum-1579*` en el remoto y sin registro. El ticket no tenía
comentarios al leerlo (23-oct, ~09:15Z). El defecto, abierto por `jv-j2t` con la evidencia del job 120215050589.

## El defecto

`const cuantos = () => prisma.merchant.count();` contaba la tabla entera del banco que comparte la tanda. Se usa en
cuatro aserciones (la ruta cerrada no da de alta, el guion deja dos, pedir acceso no crea, al acabar siguen dos). Un
merchant creado por otro test mientras corre éste las tumba sin que el alta haya fallado.

## El arreglo

`cuantos` cuenta los merchants de ESTE caso: correo con el sello de la pasada (todos los que el caso manda al guion lo
llevan) más los dos sin sello que se mandan a la ruta cerrada (`x@y.es`, `sin-arroba`). El `+ 2` no cambia (regla 41).

Y un **control permanente** dentro del caso: justo después de `alEmpezar` se crea un merchant AJENO (correo sin el
sello, comprobado), como lo crearía otro test; se borra en el `finally`. Con el recuento de antes, ese ajeno tumba la
primera aserción; con el de ahora, no cuenta.

## Medido (banco PGlite local, `docs/master/evidencias/SCRUM-1515/banco-local.mjs`; 1 test por pasada)

Variantes fabricadas por `evidencias/SCRUM-1579/variantes.mjs` en ficheros aparte (`tests/_v1579-*.mjs`, borrados
después); el fichero del arreglo no se tocó durante las inyecciones.

| pasada | resultado | salida |
| --- | --- | --- |
| test de `main` sin tocar (base) | 1 pass · 0 fail | `salida-0-main-sin-tocar-VERDE.txt` |
| el arreglo | 1 pass · 0 fail | `salida-1-arreglo-VERDE.txt` |
| el arreglo SIN el filtro, con el ajeno | **cae**: «LA RUTA CERRADA HA DADO DE ALTA A ALGUIEN» `1 !== 0` | `salida-2-arreglo-sin-filtro-ROJO.txt` |
| test de `main` + un ajeno justo antes del último recuento | **cae**: «al acabar hay más merchants que los dos del guion» `3 !== 2` — el rojo del CI | `salida-3-main-con-ajeno-tarde-ROJO.txt` |
| el arreglo + el mismo ajeno tardío | 1 pass · 0 fail | `salida-4-arreglo-con-ajeno-tarde-VERDE.txt` |
| mutación: el guion crea un tercero con correo del caso | **cae**: «el guion no ha dejado exactamente dos merchants» `3 !== 2` | `salida-5-guion-crea-uno-de-mas-ROJO.txt` |

En las seis pasadas el banco acaba con 0 merchants: el ajeno se borra también cuando el caso cae.

## Lo que se pierde, dicho

Un alta que el guion hiciera con un correo que NO es el que se le pasó (ni lleva el sello) ya no la ve el recuento.
La foto campo a campo (`foto(correo)`) sigue exigiendo que A y B existan con su correo limpio.

## Sin medir

- **Quién creó el tercer merchant** en el job 120215050589: no lo he buscado (qué ficheros de la tanda crean merchants
  en el banco y en qué orden corrieron).
- PGlite no es el Postgres 16 del CI. El verde en CI se lee en el obligatorio de esta rama.
- La tanda completa no la he corrido en local; sí los guards de registro y de suite (entrega).
