# Registro de trabajo — un fichero por ticket

Aquí vive el **registro de lo que se ha hecho**, a partir del 3-ago-2026 (SCRUM-273).
Un fichero por ticket: `SCRUM-<n>.md`.

## Por qué está separado del máster

Porque el conflicto no se resuelve mejor: **deja de existir**.

El 2-ago-2026 **siete ramas distintas chocaron en `docs/YAQU_MASTER.md`** en un solo día, todas
por lo mismo: cada ticket añadía su entrada al final de la misma sección y cuatro sesiones a la
vez escribían en el mismo punto. Medido: el máster tiene 1713 líneas, pero **las últimas 12
entradas ocupaban de la 1406 a la 1449** — el 11 % de las entradas en el 2,5 % del fichero.

Y el coste peor no era el tiempo. **Resolver conflictos a mano en la única fuente de verdad del
proyecto es la operación de más riesgo que se hace aquí**, y se hizo siete veces en un día. Ya
rozó: en la rama de SCRUM-234 el script de resolución ancló con `$` sobre un fichero en CRLF,
encontró 2 de 3 marcadores y abortó. Sin ese guard habría dejado un `=======` dentro del máster.

La causa raíz estaba un nivel más abajo: el máster mezclaba **lo que casi nunca cambia** (reglas,
decisiones, estrategia) con **lo que cambia cinco veces al día** (el registro). Esa mezcla es lo
que hacía que un apunte rutinario tocase el documento más delicado del repo.

**Dos ficheros nunca colisionan porque dos tickets nunca tienen el mismo número.**

## Lo que NO cambia

* **El máster sigue siendo la fuente de verdad** sobre reglas, decisiones y estrategia (regla 35).
  Esto cambia **dónde se escribe el registro**, no **qué manda**. Si algo aquí contradice al
  máster, gana el máster.
* **El histórico no se migró.** Las 110 entradas anteriores al 3-ago-2026 siguen en el máster, con
  su redacción y su orden intactos. Reescribir 476 KB para esto habría sido aceptar justo el
  riesgo que el cambio elimina.
* **No se duplica ni se enlaza hacia atrás.** Quien busca SCRUM-243 lo encuentra en el máster;
  quien busque SCRUM-274 lo encontrará aquí. Dos verdades sobre la misma entrada sería el defecto
  que esto viene a evitar, cometido por el propio arreglo.

## Formato

Encabezado en una línea con ticket, título, fecha, carril y si corre gateado. Después, el cuerpo
con el mismo criterio de siempre: **qué defecto cierra, qué se decidió y por qué, qué se midió,
en qué rojo se verificó, y qué NO se cubre**. Un lector dentro de seis meses tiene que poder
reconstruir la decisión sin preguntarle a nadie.

```markdown
# SCRUM-<n> · TÍTULO-CORTO: la frase que resume qué cambia

**Fecha:** <d-mmm-aaaa> · **Carril:** A|B · **Gate:** sin gate | gateado | STOP con GO
**Medido contra:** `origin/main` = `<sha de 40>` · <ISO-8601 con huso>
**Tanda:** <N> tests, <N> pass, <N> fail, <N> skipped

## El defecto
## La decisión, y por qué
## Lo que se midió
## Verificado en rojo
## Lo que NO cubre
## Ficheros
```

Ninguna sección es obligatoria salvo el encabezado: un ticket de recon no tiene rojo, y uno de
docs no tiene tanda. Lo que sí se espera siempre es **lo que NO cubre** — un registro que solo
cuenta lo que salió bien se lee, dentro de unos meses, como si hubiera cubierto más de lo que
cubrió.

## El ancla de medicion (SCRUM-267)

La linea `**Medido contra:**` es OBLIGATORIA y la exige
`tests/scrum267-ancla-de-medicion.test.mjs`. Dos exigencias, cada una con su incidente detras:

* **Sha de 40 posiciones, no abreviado.** `1bb0b5e` aparece en tres ramas distintas de este
  repo en una sola semana: un sha corto identifica un commit igual de mal que un numero de PR
  identifica un ticket. Si el ancla no distingue, no ancla.
* **Fecha Y HORA, con huso.** El incidente que lo origino no fue una medicion mal hecha: fue
  una CORRECTA que caduco en una hora porque `main` se movio tres veces. Sin hora, el ancla no
  distingue «medido hace cinco minutos» de «medido esta manana».

Va en el ENCABEZADO y no junto a cada afirmacion, a proposito: detectar afirmaciones («esta en
main», «mergeado») seria un guard de texto, y un guard de texto se caza a si mismo en la prosa
que explica la prohibicion — ademas de esquivarse reformulando. **Una regla que depende de como
escribas la frase no es una regla.**

### Por que hay entradas sin ancla, y por que NO se van a rellenar

`docs/master/` nacio con SCRUM-273 y el campo `Medido contra` lo anadio **SCRUM-267, el
3-ago-2026**. Entre uno y otro se escribieron varias entradas cuando **este README todavia no
mencionaba el campo**: quien las escribio hizo lo correcto segun la documentacion vigente, y
exigirles una regla que no estaba escrita seria castigar a quien siguio el formato.

Esas entradas —**SCRUM-231, SCRUM-244 y SCRUM-264**— estan censadas en el propio guard, con su
motivo, y **no se van a rellenar**. Decision del fundador, con su razon: el ancla sirve para saber
si una afirmacion sobre `main` **ha caducado**, y nadie relee la entrada de un ticket ya cerrado
para decidir nada. **Su valor es prospectivo.** Reconstruir hoy contra que `main` se midio entonces
no seria recordarlo: seria inventarlo, y un ancla que ancla a otra cosa es peor que ninguna.

El censo **no puede crecer** —cualquier entrada que no este en el necesita ancla o sale rojo— y
**si baja, tambien falla**: si alguien le pone su ancla a una de las tres, el guard le obliga a
actualizar el censo, para que la mejora quede anotada en vez de pasar desapercibida.

Si estas escribiendo una entrada NUEVA, nada de esto te afecta: pon el ancla.

## ANTES DE EMPUJAR: `npm run guards:entrada`

**No es un guard, son CUATRO**, y hasta ahora cada sesion los descubria EN ROJO despues de empujar,
cuando el PR ya estaba abierto:

| guard | lo que exige |
|---|---|
| SCRUM-273 | el fichero se llama `SCRUM-<n>.md`, y el trabajo no se escribe en `YAQU_MASTER.md` |
| SCRUM-267 | el ancla `**Medido contra:**`, con sha de **40** y hora con huso |
| SCRUM-391 | todo test que la entrada DECLARA existe en el arbol |
| SCRUM-242 | no se nombra un documento que no existe |

```
npm run guards:entrada
```

Tarda segundos: los cuatro son estructurales -no compilan ni tocan la base-. `npm test` tambien los
corre, pero compila y lanza 2.400 tests, asi que nadie lo usa para revisar un fichero de texto: por
eso los rojos llegaban por el PR.

Si el comando corre menos de cuatro, **falla nombrando cual falta**. Un agregador que se queda corto
da la tranquilidad entera con la cobertura a medias.

## El guard

`tests/scrum273-registro-por-fichero.test.mjs` se pone **rojo** si aparece una entrada de trabajo
nueva en `YAQU_MASTER.md`. El censo se congela por **número de ticket y cantidad**, no por línea:
por línea, cualquier edición diez líneas más arriba lo pondría en rojo, y un guard que grita sin
motivo se acaba puenteando igual que uno que no grita nunca.
