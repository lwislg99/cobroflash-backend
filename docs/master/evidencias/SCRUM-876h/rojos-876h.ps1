# Los rojos de SCRUM-876h: cada mutacion contra tests/scrum17-recapitulativa, en el banco local.
# Base sin mutar ANTES y DESPUES. Uso: .\rojos-876h.ps1
$b = "D:\MILLONARIO\cobroFlash\_banco-s3"
$wt = "D:\MILLONARIO\cobroFlash\wt-s3-1416"
$psql = "$b\pgsql\bin\psql.exe"
$url = "postgresql://postgres@127.0.0.1:55877/yaqu_libro_test"
$o = "$b\salidas"
Set-Location $wt
Remove-Item Env:FORCE_COLOR -ErrorAction SilentlyContinue
Remove-Item Env:QA_DB_TEST -ErrorAction SilentlyContinue
$env:LIBRO_PG_URL = $url
$f = 'scrum17-recapitulativa'

function Correr([string]$nombre) {
  & $psql -tAc "alter sequence merchants_id_seq restart with 1" -d $url | Out-Null
  & node --test --test-force-exit --test-reporter=tap "--test-reporter-destination=$o\$nombre.tap" "tests/$f.test.mjs" *> "$o\$nombre.out"
  $salida = $LASTEXITCODE
  $l = Get-Content "$o\$nombre.tap" -Encoding UTF8
  $casos = @($l | Where-Object { $_ -match '^(not ok|ok) \d+ - ' })
  $caidos = @($casos | Where-Object { $_ -match '^not ok' })
  $saltados = @($casos | Where-Object { $_ -match '# SKIP' })
  $cuales = ($caidos | ForEach-Object { ($_ -replace '^not ok (\d+) - .*$', '$1') }) -join ','
  $motivo = ''
  $i = ($l | Select-String -Pattern '^\s*error: ' | Select-Object -First 1).LineNumber
  if ($i) { $motivo = (($l[($i - 1)..([Math]::Min($i + 1, $l.Count - 1))] | ForEach-Object { $_.Trim() }) -join ' ') }
  if ($motivo.Length -gt 260) { $motivo = $motivo.Substring(0, 260) }
  $estado = if ($casos.Count -eq 0) { 'CIEGO' } elseif ($caidos.Count) { 'ROJO ' } else { 'VERDE' }
  "{0} · casos {1} · caidos {2} [{3}] · saltados {4} · salida {5} {6}" -f $estado, $casos.Count, $caidos.Count, $cuales, $saltados.Count, $salida, $motivo
}

$ids = 'una-sola-factura', 'refs-vacias', 'sin-marcar-facturado', 'salida-al-emitir', 'asercion-de-antes'
"POBLACION · 1 fichero ($f, 12 casos; el gateado es el 12) · $($ids.Count) mutaciones · HEAD $(git rev-parse HEAD) · FORCE_COLOR ausente: $(-not (Test-Path Env:FORCE_COLOR))"
"--- BASE (antes)"
"  " + (Correr "rh-base1")
"--- MUTACIONES"
foreach ($id in $ids) {
  $r = & node "$b\mutar-876h.mjs" $wt poner $id
  if ($LASTEXITCODE -ne 0) { "  $id :: CIEGO: no se pudo poner"; continue }
  $num = (git diff --numstat) -join ' | '
  $v = Correr "rh-$id"
  $q = & node "$b\mutar-876h.mjs" $wt quitar $id
  "  $id :: $v :: numstat [$num] · $r :: $(if ($LASTEXITCODE -eq 0) { 'restaurado' } else { 'NO RESTAURADO' })"
}
"--- BASE (despues)"
"  " + (Correr "rh-base2")
"git status: [$(git status --porcelain)]"
& $psql -tA -f "$b\poso-todo.sql" -d $url
"EXIT=0"
