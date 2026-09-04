# SCRUM-726 · `constaAprobado()` no sabía QUIÉN firmó

**Medido contra:** `origin/main` = `da5af22e347bbdfa3e57e1e658676e1cbd9bf310` · 2026-09-04T18:14:15+02:00
**Medido en:** host `DESKTOP-T5MONF5` · rama `scrum-726-quien-firma-la-microcopy`

**LA VÍCTIMA ES LA REGLA 30.** Dice que la microcopy **la aprueba el fundador**, y no había nada que
lo hiciera cierto: `constaAprobado()` contestaba «aprobado» en cuanto el texto estuviera escrito en
`docs/microcopy/`, **sin mirar la firma**. Comprobaba que ALGUIEN lo hubiera escrito. Dos
afirmaciones distintas con el mismo verde.

**Y es la segunda vez que esta misma función miente, por razones opuestas:** en SCRUM-715 mentía por
**cómo** comparaba —subcadena en vez de identidad—; aquí, por **qué no** compara.

## PASO 0 — el censo, con su control positivo

**Seis registros** en `docs/microcopy/` (más el congelado). El barrido encuentra el de SCRUM-605, que
era el control positivo:

| Firmante | Registros |
|---|---|
| fundador | 402 · 704 · 599 · 720 · 720c |
| **asesor** | **605** |

**Uno de seis**, así que el problema era uno y no veinte.

**Y el registro del 605 era escrupuloso**: decía «Aprobado por el **ASESOR**» y añadía «a la espera
de la firma del fundador — esto no es su firma». **El defecto no estaba en el fichero: estaba en mi
función**, que lo contaba igual.

**¿Contempla el formato la firma?** El `README.md` la pedía en prosa —«quién y cuándo: el fundador»—
y **nadie la comprobaba**. No era «crear el campo» ni «una línea de guard»: era que la convención
existía y la comprobación no.

## El arreglo

`constaAprobado()` y `literalesAprobados()` sólo cuentan registros cuyo firmante sea el fundador. Se
añade `pendientesDeFirma()`, que **lista** los demás con su literal.

**🔴 LA FIRMA SE LEE FUERA DE LAS LÍNEAS DE CITA**, y no es un detalle: ahí es donde los registros
guardan su historia. El del 605 conserva citada la frase «Aprobado por el ASESOR» que explica el
error; leyendo el fichero entero, la explicación decidiría por la firma. No es una ventana de N
líneas — es el mismo criterio estructural que ya usa el extractor de literales de SCRUM-715.

**El de SCRUM-605 no se retira:** la firma del fundador llegó, así que se corrige **la línea que la
atribuía mal** y se conserva, citada, la historia de cómo estaba escrita.

## Verificación

- **🔴 El rojo, corrido** sobre un directorio de registros de prueba: un texto firmado por otro
  **no** cuenta como aprobación, y el del fundador **sí**.
- **🔴 Y cae con el mecanismo viejo**: ese mismo texto salía «aprobado» ignorando la firma.
- **✅ Control positivo, enumerado**: los seis registros reales cuentan, **cero pendientes de firma**,
  195 literales del fundador, y una muestra de cuatro literales de registros distintos —incluido el
  congelado— sigue encontrándose.
- **✅ Control negativo**: la identidad de SCRUM-715 **no se relaja** — `Precio por` y `de obra`
  siguen sin constar, y la cadena vacía sigue lanzando.
- **El barrido es parametrizable** (`{ dir, congelado }`) para poder probarlo **sin escribir un
  registro de mentira en `docs/microcopy/`**, que cualquier otro guard en paralelo vería.

**Nada se cayó de la pantalla**: con la línea del 605 corregida, los seis registros llevan firma del
fundador y `pendientesDeFirma()` devuelve **cero**.

## Y de propina: un motivo caducado en `scrum387-censo-reparto` (lo avisó Javier)

Decía **«CI no tiene `origin/main` fetcheado»**. **Comprobado hoy: dejó de ser cierto** — hay
`fetch-depth: 0` en `ci.yml`, `vigia-despliegue.yml` y `zona-roja.yml` desde SCRUM-388. Se corrige
**el mensaje, no el guard**, y se le da la razón mejor que ya tenía: `origin/main` es un **blanco
móvil**, y un guard de PR que lo lea mide algo que puede cambiar entre abrir y mergear. La
referencia buena no es la que está disponible: es la que responde a la pregunta.
