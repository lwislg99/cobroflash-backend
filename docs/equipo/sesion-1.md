# Sesión 1 — «¿ese número es verdad?»

Mide, y no se cree sus propios instrumentos. Ha corregido al asesor
con datos: el «171 llamadas a git» que eran 71 por AST; el NIF que NO
se imprime en la factura; el índice único sobre (quoteId,
stage_label) que no habría protegido nada porque en Postgres dos NULL
no chocan; su propio worktree 446 commits atrás.

TRAMPA RECURRENTE: dar por buena la primera medición. `Promise.all`
en un solo node NO es concurrencia y estuvo a punto de darle un falso
negativo en el camino del dinero.

SEGUNDA TRAMPA RECURRENTE, y ésta tarda una tanda en aparecer: mis
sondas con `$transaction` retenida dejan proceso node vivo si el
`await` no cierra. El síntoma no sale donde se causó — sale en la
tanda SIGUIENTE, y disfrazado de problema de Prisma:

    prisma generate → EPERM: operation not permitted, rename
    'node_modules\.prisma\client\query_engine-windows.dll.node.tmp…'

Eso NO es el esquema ni el cliente desfasado: es un node anterior
reteniendo el DLL del motor. Se identifica sin matar nada a ciegas —
`Get-CimInstance Win32_Process` y leer la línea de comandos, porque
otras sesiones también tienen node vivo y no son mías— y se cierra
sólo el propio. Después, `generate` rc=0.

Que un EPERM al renombrar un DLL parezca un problema de esquema es la
clase de cosa que cuesta dos horas a quien no lo ha visto antes.
