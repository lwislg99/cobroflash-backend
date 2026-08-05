# MÉTODO_YAQU — cómo se mide aquí

> **Fichero COMPARTIDO entre sesiones.** Cada caso vive en su propia sección de segundo nivel con
> su fecha y su sesión. Si dos sesiones lo tocan a la vez, **se conservan LAS DOS entradas**: no se
> resuelve el conflicto eligiendo, se resuelve pegando las dos secciones seguidas. Un método que
> pierde casos al mergear deja de ser un método.

---

# 🔴 LA PRUEBA DE ROJO QUE NUNCA SE EJECUTÓ

**Descubierto por DOS sesiones la misma noche (5-ago-2026), por caminos que no se parecen en nada.**

Llevamos una semana apoyándonos en la prueba de rojo como la prueba fuerte: *«quita la cosa vigilada
y comprueba que sale rojo»*. Es correcta. Pero tiene un agujero que nadie había mirado:

> **Una prueba de rojo que sale verde no es una prueba superada: es una prueba que NO SE HA
> EJECUTADO. Antes de creerse el verde, hay que comprobar que la mutación llegó a aplicarse.**

Un rojo que no se inyectó y un verde son **indistinguibles** si no se mira. Los dos se ven igual en
la terminal: la suite pasa.

## Caso A · el ancla que no casa por los FINALES DE LÍNEA (SCRUM-302, sesión 1)

El más traicionero de los dos, porque **el fichero se ve idéntico**.

Se intentó sacar `allocateAlbaranNumber` fuera de la transacción para comprobar que el guard de la
carrera caía. La inyección buscaba:

```js
const viejo = '    const copia = await prisma.$transaction(async (tx) => {\n      const numero = …';
```

Y el fichero está en **CRLF**, así que `\n` no casa nunca. El script imprimió `[!! no encuentro el
ancla]`, la suite se corrió **sobre el código sin tocar** y salió verde. Dos intentos seguidos.

**Lo que lo delató** fue que el script imprimía su propio fallo. Sin esa línea, el verde habría
pasado por «rojo comprobado».

```js
// Lo que hay que hacer ANTES de creerse nada:
if (!s.includes(viejo)) { console.log('[!! no encuentro el ancla]'); process.exit(1); }
```

Y comprobar los finales de línea del fichero **antes** de escribir el ancla:

```js
const nl = s.includes('\r\n') ? '\r\n' : '\n';
```

⚠️ `cat -A` **no basta** para verlo: a través de Git Bash puede mostrar `$` (LF) sobre un fichero
que en disco es CRLF. Lo que no miente es leerlo con Node y preguntar por `\r\n`.

## Caso B · el símbolo que no existía (S3)

*(S3 escribe aquí el suyo — `replace('export', …)` sobre un fichero sin `export`: la mutación no
toca nada y la suite «pasa» en verde.)*

## La regla, para las dos

1. **La inyección declara si se aplicó.** Un script de rojo que no imprime `[inyección VERIFICADA]`
   —o que no sale con código ≠ 0 cuando no encuentra su ancla— no sirve.
2. **Se comprueba que el fichero cambió**, no que el script terminó. `git diff --stat`, un `grep` del
   texto nuevo, lo que sea: algo que mire el resultado y no el proceso.
3. **Y se restaura comprobando.** `git status` después, no antes.

Es la misma familia que ya conocíamos —*ver un verde y preguntarse qué mediría si el sistema
estuviera roto*— aplicada un nivel más abajo: al propio mecanismo con el que comprobamos los verdes.
