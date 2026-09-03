# SCRUM-653 · Las DOS firmas del parte: FIRMA CLIENTE y FIRMA TÉCNICO

**Medido contra:** `origin/main` = `2becaeaa82a8e491a5705862d3df95d6d88e5bc3` · 2026-09-03T13:10:17+02:00
**Rama:** `scrum-653-dos-firmas`

## PASO 0

```
git ls-tree -r --name-only origin/main | grep -iE 'scrum-?653|firmante'
  src/modules/jobs/domain/albaranFirmante.ts
  tests/scrum300-firmante-ids-y-microcopy.test.mjs
  tests/scrum463-firmante-ve-el-contenido.test.mjs
  tests/scrum466-el-firmante-ve-el-albaran.test.mjs

git ls-remote --heads origin | grep -iE 'scrum-?653'   →  ninguna
```

**LA COSA no existe**, comprobado con control positivo (el mismo instrumento **sí** encuentra
`firmadoPorNombre` en `schema.prisma` y en dos ficheros de `src/`): cero para «segunda firma»,
`firmaTecnico`, `firma_tecnico`, `signatureUrlTecnico`, `firmadoPorTecnico` y «firma del técnico».

## 🔴 La medición que CAMBIÓ el encargo

> El encargo decía: «el modelo tiene un solo juego (`signatureUrl`, `firmadoAt`,
> `firmadoPorNombre`, `firmadoPorCalidad`)».

Medido: **ese es el juego del ALBARÁN. El parte no tiene `signatureUrl`.** Y peor —

**`POST /admin/partes/:id/firmar` VALIDA `signatureData` y lo TIRA.** Sus tres únicas apariciones
en el fichero son la regex de PNG/JPEG y el tope de tamaño; el `UPDATE` escribe estado, fecha,
nombre, calidad y el hash. **El trazo se descarta.** El parte guardaba *que* se firmó y *quién dijo
ser*, y no la firma.

Es un defecto de la fase C —mío— y sale a la luz justo al ir a añadir la segunda. Así que este
ticket no añade una firma: **añade la segunda y guarda la primera.**

## Las tres decisiones, medidas antes de escribir

### ① El sello: v:1 sellaba al firmante, y con dos firmas eso NO puede ser

`contenidoCanonicoParte` v:1 incluye `firmadoPorNombre` y `firmadoPorCalidad`. La huella se calcula
al firmar, así que con dos firmas:

```
firma el cliente  → técnico aún null  →  hash H1
firma el técnico  → los dos rellenos  →  hash H2 ≠ H1     (y al revés, otro par)
```

**Un documento cuya huella depende de quién firmó primero, con el mismo contenido.** Eso no es un
sello: es un número que cambia solo.

→ **v:2 sella sólo el CONTENIDO.** Las firmas son evidencia *adherida*: cada una con su trazo, su
fecha y su nombre, en la fila y **fuera** del hash. La v:1 se conserva **entera e intacta** —un
parte sellado con ella se verifica con ella— y una versión desconocida **lanza**, sin rama por
defecto (lección de SCRUM-438).

La alternativa —meter las dos y recalcular al completarse— es peor: el hash que se le enseñó al
primer firmante dejaría de valer.

### ② El congelado: se congela con la PRIMERA, y NO se cambia nada

**Medido antes de tocar:** `puedeEditarContenido` cierra con cualquier estado ≠ `borrador`, o sea
que **ya congelaba con la primera**. Se conserva, y con dos firmas el motivo es más fuerte: lo que
el primer firmante avaló no puede cambiar después. Si el contenido siguiera abierto hasta la
segunda, se podría modificar lo que el otro ya firmó — y no volvería a mirarlo.

La segunda firma es una **adición**: pone su trazo, su fecha y su nombre, y no toca el contenido,
así que el sello no se mueve.

🔴 **Lo que sí cambia es el CANDADO DE FIRMA: pasa de mirar el ESTADO a mirar la RANURA.** Con el
viejo, en cuanto el técnico firmaba el estado era `firmado` y **el cliente ya no podía firmar** —
el segundo firmante se quedaba fuera según el orden. Y el orden no se exige
(`ordenDeFirmaExigido()`): en la obra firma quien esté libre primero.

### ③ El técnico NO tiene «en calidad de»

Las seis opciones de `albaranFirmante.ts` —«portero o conserje», «un familiar o conviviente»…—
existen porque quien firma **por el cliente** puede ser cualquiera. El técnico es un empleado
identificado: darle esa ranura sería ofrecerle declarar que firma *en nombre del cliente*, que es
justo lo que no puede hacer. Su nombre **sí** es obligatorio, con la misma regla que el del cliente.

Hay un test con **control positivo del detector**: comprueba que la ruta del técnico no la tiene
**y** que el mismo detector la encuentra en la del cliente, donde sí está.

## Sin cobertura: la misma cola, un tipo más

Ni una segunda cola. `RUTAS` pasa a guardar **la ruta entera** y no la base, porque la firma del
técnico cambia el *sufijo* (`/firmar-tecnico`) y con el mapa viejo habría hecho falta un `if`.
`albaran` sigue primero y sigue siendo el default: una firma encolada por una versión anterior no
tiene `tipo` y es de un albarán por construcción.

Las dos firmas del **mismo** parte tienen claves distintas —`firma:parte:7` y
`firma:parte-tecnico:7`— y hay un test que lo exige: con la misma clave, el `keyPath` del almacén
sobrescribe y **una de las dos desaparece en silencio**.

## Entregado en el orden de la casa

| | Qué | Dónde |
|---|---|---|
| ① | decisión | ya estaba |
| **②** | `ALTER` aditivo, **4 columnas nullable** | `docs/sql/scrum-653-dos-firmas.sql` |
| **③** | schema + dominio + rutas + vista + tests | este PR |

**Clasificador sobre el ②: 4 sentencias · 0 RECHAZADAS · 0 borrados · `ok=true` · exit 0.**
El fichero dice en cabecera que el ② va **antes** de mergear el ③.

## ⚠️ Esta rama va DESPUÉS de `scrum-652-puerta-al-parte`

Se construyó **encima** de ella, y no por comodidad: el cable de la pantalla
(`renderParteDetailView`) sólo existe ahí. Construir sobre `main` habría dejado dos botones que
nadie engancha, y un conflicto seguro en `parteDetailView.js`.

## 📌 Hallazgo de otro carril (regla 9): el delimitador de SCRUM-683b

Su test acota «la ruta del dictado» cortando desde `router.post('/:id/dictado'` **hasta
`export default router`** — o sea que da por supuesto que el dictado es **la última ruta del
fichero**. Cualquier ruta escrita después cae dentro de su corte y lo hace saltar aunque el dictado
no escriba nada.

**No se ha tocado su guard.** Se ha movido *mi* ruta antes de la suya, que además queda mejor
colocada (las dos firmas juntas). Queda dicho para que su carril lo mire.

## Declaraciones actualizadas al hecho, ninguna relajada

* **`scrum652`** · `PARTE_CONTENIDO_VERSION_ACTUAL` 1 → 2, y `firmadoPorCalidad` sale de la lista
  de campos que mueven la huella. **La comprobación no se borra: se INVIERTE** —ahora se exige que
  *no* la mueva— y `scrum653` comprueba que en v:1 sí la movía.
* **`scrum652c`** · «si el estado es `firmado`, no se ofrece firmar» pasa a ser **por ranura**. Con
  dos firmas, `firmado` ya no significa «el cliente firmó».
* **SCRUM-55** · la ruta nueva en `TECNICO_ALLOWED`, con motivo: es **su** firma.
* **SCRUM-411** · `ordenDeFirmaExigido` declarado como `ESPECIFICACION_EJECUTABLE_SIN_SUPERFICIE`:
  borrarla no quita código muerto, quita la única constancia de que esa decisión se tomó.
* **`docs/sql/deriva-prod.sql`** regenerado: 417 columnas.

## Microcopy (regla 30)

Propuesta, no aprobada: «Firma del cliente», «Firma del técnico», «Firmado por el cliente/técnico»,
«Falta una firma para cerrar el parte». Salen con marca y `parteDetailView.js` **ya estaba** en el
censo de SCRUM-402 con 1 — las cinco cuelgan de la misma constante `M`, así que el número no sube.
Es el caso de `libroRegistroView` otra vez: **un 1 que son cinco rótulos**.

## ⛔ No aplicado a ninguna base

Ni a dev. El ② lo ejecuta el fundador, base por base, antes de mergear esto.
