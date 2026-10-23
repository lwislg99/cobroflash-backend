# SCRUM-876h: scrum17 AL LADO de scrum1515, en el orden de la tanda, CON y SIN el cambio, a varias concurrencias.
# «SIN» = el scrum17 de origin/main (con solo LIBRO_PG_URL se SALTA: no crea merchants). Se cambia el FICHERO, no la lista,
# para que el reparto de la tanda sea el mismo. Cada proceso apunta su arranque y su salida (marcas-876h.mjs).
# Uso: .\medir-876h.ps1 -pasadas "con:3","sin:3"   (config:concurrencia, en el orden dado)
param([string[]]$pasadas, [int]$desde = 380, [int]$hasta = 440, [string]$etiqueta = 'm')
$b = 'D:\MILLONARIO\cobroFlash\_banco-s3'
$w = 'D:\MILLONARIO\cobroFlash\wt-s3-1416'
$psql = "$b\pgsql\bin\psql.exe"
$url = 'postgresql://postgres@127.0.0.1:55877/yaqu_libro_test'
$f17 = 'tests/scrum17-recapitulativa.test.mjs'
Set-Location $w
Remove-Item Env:FORCE_COLOR -ErrorAction SilentlyContinue
Remove-Item Env:QA_DB_TEST -ErrorAction SilentlyContinue
$env:LIBRO_PG_URL = $url
if (git status --porcelain) { "CIEGO: el arbol no esta limpio, no se cambia ningun fichero"; "EXIT=2"; exit 2 }
$todos = @([IO.Directory]::GetFiles("$w\tests", '*.test.mjs') | ForEach-Object { [IO.Path]::GetFileName($_) })
[Array]::Sort($todos, [StringComparer]::Ordinal)
$tramo = @($todos[($desde - 1)..($hasta - 1)] | ForEach-Object { "tests/$_" })
$p1515 = [Array]::IndexOf($todos, 'scrum1515-nuestra-puerta-de-alta.test.mjs') + 1
$p17 = [Array]::IndexOf($todos, 'scrum17-recapitulativa.test.mjs') + 1
"POBLACION · tanda entera = $($todos.Count) ficheros · tramo = posiciones $desde a $hasta = $($tramo.Count) ficheros · scrum1515 en la $p1515 · scrum17 en la $p17 · HEAD $(git rev-parse HEAD) · FORCE_COLOR ausente: $(-not (Test-Path Env:FORCE_COLOR)) · libreMB=$([int]((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1KB))"
if ($p1515 -lt $desde -or $p17 -gt $hasta) { "CIEGO: el tramo no contiene a los dos"; "EXIT=2"; exit 2 }
$n = 0
foreach ($p in $pasadas) {
  $n++
  $config, $conc = $p -split ':'
  $nombre = "$etiqueta-$n-$config-c$conc"
  if ($config -eq 'sin') { git restore --source=origin/main -- $f17 } else { git restore --source=HEAD -- $f17 }
  $lineas17 = (Get-Content $f17).Count
  $esMio = [bool](Select-String -Path $f17 -SimpleMatch '_banco-libro' -Quiet)
  & $psql -tAc "alter sequence merchants_id_seq restart with 1" -d $url | Out-Null
  $marcas = "$b\salidas\$nombre.marcas.tsv"
  if (Test-Path $marcas) { [IO.File]::Delete($marcas) }
  $env:MARCAS_876H = $marcas
  $env:NODE_OPTIONS = "--import=file:///D:/MILLONARIO/cobroFlash/_banco-s3/marcas-876h.mjs"
  $sw = [Diagnostics.Stopwatch]::StartNew()
  $a = @('--test', '--test-force-exit', "--test-concurrency=$conc", '--test-reporter=tap', "--test-reporter-destination=$b\salidas\$nombre.tap") + $tramo
  & node @a *> "$b\salidas\$nombre.out"
  $ex = $LASTEXITCODE
  $env:NODE_OPTIONS = $null
  $env:MARCAS_876H = $null
  $r = & node "$b\solape-876h.mjs" $marcas "$b\salidas\$nombre.tap" $tramo.Count
  "{0} · scrum17 {1} ({2} lineas, lleva el banco: {3}) · conc {4} · {5}s · salida {6} · {7}" -f $nombre, $config, $lineas17, $esMio, $conc, [int]$sw.Elapsed.TotalSeconds, $ex, $r
}
git restore --source=HEAD -- $f17
"git status al acabar: [$(git status --porcelain)]"
& $psql -tA -f "$b\poso-todo.sql" -d $url
"libreMB al acabar=$([int]((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1KB))"
"EXIT=0"
