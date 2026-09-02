# SCRUM-695 · Los cuatro tests que se fueron — y el recibo que NO debe entrar en git

**Fecha:** 2-sep-2026 · **Carril:** S3 (instrumentos) · **Gate:** sin gate — corre en `npm test`

**Medido contra:** `origin/main` = `f803ec1e4ba189041a34d017fbf890081331ce45` · 2026-09-02T22:10:48+01:00

**Tanda:** 4764 tests, 4681 pass, **0 fail**, 83 skipped — medida DESPUÉS del último cambio de código (que en este ticket es NINGUNO: sólo entra esta entrada). Lo único posterior a la medición es esta misma línea.

---

El encargo traía dos mitades y **las dos se contestan con una medición, no con una construcción**.
Este ticket no añade una línea de código a `src/` ni a `tests/`. Lo que añade es el veredicto, y la
prueba de que el veredicto no es una opinión.

## 🛑 Mitad ① · Antes del hallazgo, el SUELO del método

El encargo avisaba: *«si tu diff no enseña ninguna retirada, estás mirando el commit equivocado»*.
Pasó exactamente eso.

    git show ec1845cd -- tests/scrum498-cifra-derivada.test.mjs   →  0 retiradas

**`ec1845cd` es un MERGE** (`878bfd9e` + `a8850075`, PR #932). `git show` sobre un merge imprime el
diff **combinado**, que oculta lo que sólo cambió en una de las ramas. Con el instrumento correcto:

    git diff ec1845cd~1 ec1845cd -- <fichero>   →  4 retirados, 0 añadidos

Sin ese suelo, la respuesta habría sido «no encuentro nada» — y habría sido falsa.

## Qué vigilaba cada uno

Los cuatro giran sobre **el mismo sujeto**: `AFIRMACIONES`, el registro de frases del árbol que
escribían **a mano** el tamaño de la población de modelos con `merchantId`.

| Retirado | Qué vigilaba |
|---|---|
| `🔴 CONTROL POSITIVO: con el esquema tal cual…` | que hoy no hubiera ninguna frase ya caducada |
| `🔴 ninguna afirmación atada está CIEGA` | que ninguna frase hubiera cambiado de redacción dejando al guard mirando a la pared |
| `🔴 EL ENSAYO DEL DÍA D` | que al entrar `EmailMessage` las doce frases cayeran **nombradas** |
| `el registro cubre los ocho ficheros del encargo` | que las ocho fuentes con frases estuvieran atadas, y cuál quedaba fuera |

## ✅ Veredicto: DELIBERADO — y además, OBLIGATORIO

**El motivo ya estaba escrito**, y no sólo en el mensaje del commit (*«SCRUM-498 se retira con su
motivo, y el hecho sigue vigilado»*): está en la **cabecera del propio fichero**, con los cuatro
nombres y el porqué. Un test retirado con su motivo en el sitio donde alguien lo buscaría no es
cobertura perdida.

**Se quedaron sin sujeto.** SCRUM-680 hizo que las doce frases **dejaran de decir un número** —
donde hacía falta saber *cuáles*, se nombran (`Quote` e `Invoice`), y una frase sin número no se
desincroniza. Medido hoy: `AFIRMACIONES` tiene **0 entradas**, y un barrido del árbol buscando prosa
que cite el recuento no devuelve **ninguna afirmación viva**: la única aparición del «23» está en
`portabilidadCompleta.ts` y es el **relato del defecto cazado**, no una afirmación.

### 🔴 Y no era optativo: mantenerlos era imposible

Vaciar un registro tiene la forma exacta de *ajustar el guard al código*, así que no basta con que el
motivo esté escrito. **Se resucitó el fichero de antes de la retirada y se corrió contra el registro
de hoy:**

    # tests 9 · # pass 7 · # fail 2
    not ok 7 — EL ENSAYO DEL DÍA D
    not ok 8 — el registro cubre los ocho ficheros

* **Dos se quedan en VERDE HUECO** (`CONTROL POSITIVO` y `CIEGAS`): con el registro vacío recorren
  cero frases y no encuentran cero problemas. Pasan **porque no miran nada**, que es la peor
  variante de verde que hay.
* **Dos se ponen ROJOS Y SE QUEDAN ASÍ.** El ENSAYO cae con `🔴 el rojo no NOMBRA qué frase se quedó
  vieja`: sin frases atadas, el día D no derriba nada que se pueda nombrar.

Mantener los cuatro no era «más cobertura»: eran **dos rojos permanentes y dos verdes que mienten**.

> Predicción escrita antes de medir: tres verdes huecos y un rojo. **Medido: dos y dos.** Se deja
> dicho porque el ENSAYO no cae por lo que yo suponía, y la diferencia la dio ejecutarlo.

### El hecho sigue vigilado — probado por el mecanismo, no por el comentario

La cabecera **afirma** que otro guard cubre el hecho. Una afirmación se mide:

    inyectado en prisma/schema.prisma:  model CuadernoDeObra { merchantId Int }
    node --test tests/scrum172-cobertura-tenancy.test.mjs

      🔴 Modelo(s) con `merchantId` que NADIE barre:
         · cuadernoDeObra

Cae, y **lo nombra**. Retirada la inyección: verde (4/4) y el árbol sin rastro. `scrum172` deriva del
**esquema**, no de la prosa, así que no envejece. La otra mitad —supresión, no portabilidad— la
sostiene `ORDEN_BORRADO_MERCHANT` (SCRUM-192).

**Nada que restaurar. Se cierra.**

## 🛑 Mitad ② · El recibo en git: PARA

El encargo pedía versionar `.claude/evidencia-tanda.json` *con la lección de SCRUM-662 delante*, y
parar si el remedio reproducía el problema del contador. **Lo reproduce, y además hay algo peor.**

### ① La decisión ya estaba tomada, con su motivo, en DOS sitios

De `.gitignore:154` (SCRUM-161):

> recibo de la tanda gateada. LOCAL Y NUNCA COMMITEADO […] si viajara con la rama seria un artefacto
> que se COPIA entre ramas, y una prueba que se copia deja de probar nada.

De `scripts/_evidencia-tanda.mjs:72`:

> El recibo NO se commitea (`.gitignore`), como el sentinel de `db push`: si viajara con la rama se
> convertiría en un artefacto que se copia entre ramas — lo contrario de una prueba.

No es un olvido que rellenar: es una decisión vigente. El recibo certifica que **ESTE** árbol pasó la
tanda; commiteado, viaja a árboles donde no se corrió.

### ② Es la fábrica de conflictos del 662, y peor

SCRUM-662 retiró una **cuenta** porque *«una cuenta no distingue tu script del mío»*. Aquel contador
sólo cambiaba cuando un humano añadía un script. Éste lleva `commit`, `huella` y `terminadaEn`:

**se reescribe entero en CADA ejecución, y lo escribe una máquina.** Con **nueve worktrees en vuelo**
(medido con `git worktree list`), cada tanda de cada sesión ensucia el mismo fichero. No es un
conflicto ocasional en una línea: es conflicto garantizado, en JSON, y en un fichero que nadie edita
a mano — o sea que quien lo resuelva estaría eligiendo a ciegas entre dos recibos, y ninguno de los
dos describe su árbol.

### ③ Y aun sin conflictos, no daría el histórico que se buscaba

El objetivo era el hueco nº 2 de SCRUM-672: *el total de aquellos commits no es recuperable*. Un
fichero **sobrescrito** no es un histórico: su `git log` sería el pisoteo de nueve ramas. Y el recibo
mide la tanda **GATEADA**, no la de `npm test`, que es donde se midió el defecto.

**Conclusión: no se construye** — tal como pedía el encargo: *prefiero no tener histórico a tener una
fábrica de conflictos*.

### Lo que sí daría histórico, para que lo decida el asesor (NO construido aquí)

El CI ya escribe el TAP y ya lo guarda como artefacto… **con `if: failure()`** (`ci.yml:217`,
retención 7 días). O sea que **de las tandas VERDES no queda nada** — y verde es justo como sale el
defecto que persigue el 672. Poner ahí `if: always()` daría histórico de 7 días sin fichero en git,
sin conflictos y sin dependencias nuevas. **Es otro carril y no se toca aquí.**

## 🕳️ Huecos y lo que NO se ha tocado

1. **No se ha tocado el suelo de SCRUM-672** (`SUELO_TESTS`) ni `SUELO_TOTAL = 646`. Prohibido por el
   encargo.
2. **Fuera de carril, una línea:** el suelo del 672 **no distingue una retirada documentada de una
   pérdida silenciosa** — habría llorado igual ante esta retirada, que era correcta. Es su diseño (es
   un suelo, no un juez), pero quien lo baje legítimamente debe saber que **bajarlo a propósito es
   lícito**: la regla «se queda el más alto» resuelve un choque entre dos ramas, no prohíbe retirar
   tests con motivo.
3. **`AFIRMACIONES` vacío deja la maquinaria viva pero sin uso.** La autoprueba sobre fuente sintética
   sigue probando que el mecanismo funciona, así que el día que alguien vuelva a escribir una cifra a
   mano puede registrarla y funcionará. Lo que **no** hay es nada que obligue a registrarla — igual
   que antes de SCRUM-680, porque el registro siempre fue manual.
