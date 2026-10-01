# pasada.ps1 -Etiqueta <nombre> -Copias <n> -Mascara <afinidad> [-TechoMs <ms>]
# Lanza N copias de `node scripts/guards-entrada.mjs` a la vez, todas atadas a los mismos núcleos
# (la afinidad se le pone a ESTE proceso antes de lanzar y los hijos la heredan), y deja de cada
# una: salida, error, código y segundos. Todo FUERA del árbol.
param([string]$Etiqueta, [int]$Copias = 1, [int]$Mascara = 1, [string]$TechoMs = '')
$ErrorActionPreference = 'Stop'
$arbol = 'C:\Users\Javier Pereira\cobroflash-jv6'
$dir = 'C:\Users\Javier Pereira\.claude\jobs\b5c8ef64\tmp\s1345'
New-Item -ItemType Directory -Force $dir | Out-Null
Remove-Item Env:FORCE_COLOR -ErrorAction SilentlyContinue
Remove-Item Env:NODE_TEST_CONTEXT -ErrorAction SilentlyContinue
if ($TechoMs -ne '') { $env:GUARDS_ENTRADA_TECHO_MS = $TechoMs } else { Remove-Item Env:GUARDS_ENTRADA_TECHO_MS -ErrorAction SilentlyContinue }
$os = Get-CimInstance Win32_OperatingSystem
$antes = "libre_MB=" + [int]($os.FreePhysicalMemory/1024) + " node=" + @(Get-Process node -ErrorAction SilentlyContinue).Count + " cpu=" + (Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average
[System.Diagnostics.Process]::GetCurrentProcess().ProcessorAffinity = [IntPtr]$Mascara
$sha = (& git -C $arbol rev-parse HEAD)
$sucio = @(& git -C $arbol status --porcelain).Count
"POBLACION etiqueta=$Etiqueta copias=$Copias mascara=$Mascara techo_env='$TechoMs' HEAD=$sha sucios=$sucio FORCE_COLOR_ausente=$(-not (Test-Path Env:FORCE_COLOR)) $antes"
$ps = @()
$t0 = Get-Date
for ($i = 1; $i -le $Copias; $i++) {
  $ps += Start-Process -FilePath node -ArgumentList 'scripts/guards-entrada.mjs' -WorkingDirectory $arbol -PassThru -NoNewWindow `
    -RedirectStandardOutput "$dir\$Etiqueta-$i.out" -RedirectStandardError "$dir\$Etiqueta-$i.err"
}
# Sin tocar `.Handle` antes de que el proceso salga, PowerShell 5.1 pierde el ExitCode (sale vacío).
foreach ($p in $ps) { $null = $p.Handle }
$i = 0
foreach ($p in $ps) {
  $i++
  $p.WaitForExit()
  $seg = [math]::Round(($p.ExitTime - $p.StartTime).TotalSeconds, 1)
  "copia=$i afinidad=$($Mascara) EXIT=$($p.ExitCode) segundos=$seg"
}
"FIN total_s=" + [math]::Round(((Get-Date) - $t0).TotalSeconds, 1)
