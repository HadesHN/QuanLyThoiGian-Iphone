param(
    [string]$JdkPath = ''
)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

# Gradle 8.10.2 cannot run on Java 25 (class file major 69).
# AGP 8.8.1 recommends JDK 17. Auto-select JDK 17, then JDK 21.
$script:javaCandidates = New-Object 'System.Collections.Generic.List[object]'
$script:seenHomes = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::OrdinalIgnoreCase)

function Get-JavaVersionMajor([string]$JavaExe) {
    if (-not (Test-Path -LiteralPath $JavaExe -PathType Leaf)) { return $null }
    try {
        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = $JavaExe
        $psi.Arguments = '-version'
        $psi.UseShellExecute = $false
        $psi.RedirectStandardError = $true
        $psi.RedirectStandardOutput = $true
        $psi.CreateNoWindow = $true
        $process = New-Object System.Diagnostics.Process
        $process.StartInfo = $psi
        [void]$process.Start()
        $output = $process.StandardError.ReadToEnd() + ' ' + $process.StandardOutput.ReadToEnd()
        $process.WaitForExit()
        if ($process.ExitCode -ne 0) { return $null }
        if ($output -match '(?:openjdk|java)(?:\s+version)?\s+"?(\d+)(?:[.\s"]|$)') {
            return [int]$Matches[1]
        }
    } catch { return $null }
    return $null
}

function Add-JavaCandidate([string]$JdkHome, [string]$Label) {
    # Do not use $Home: PowerShell reserves $HOME as a read-only automatic variable.
    if ([string]::IsNullOrWhiteSpace($JdkHome)) { return }
    $JdkHome = [Environment]::ExpandEnvironmentVariables($JdkHome.Trim().Trim('"'))
    $JdkHome = $JdkHome.TrimEnd('\')
    if (-not $script:seenHomes.Add($JdkHome)) { return }
    $JavaExe = Join-Path $JdkHome 'bin\java.exe'
    $JavacExe = Join-Path $JdkHome 'bin\javac.exe'
    if (-not (Test-Path -LiteralPath $JavacExe -PathType Leaf)) { return }
    $major = Get-JavaVersionMajor $JavaExe
    if ($null -ne $major) {
        $script:javaCandidates.Add([PSCustomObject]@{
            Home = $JdkHome
            Major = $major
            Label = $Label
        })
    }
}

function Add-JavaChildren([string]$Parent, [string]$Label) {
    if (-not (Test-Path -LiteralPath $Parent -PathType Container)) { return }
    Get-ChildItem -LiteralPath $Parent -Directory -ErrorAction SilentlyContinue | ForEach-Object {
        Add-JavaCandidate -JdkHome $_.FullName -Label $Label
    }
}

try {
    # Explicit per-project override (do not change global Windows JAVA_HOME).
    Add-JavaCandidate $JdkPath 'manual -JdkPath'
    Add-JavaCandidate $env:JAVA_HOME 'JAVA_HOME'
    Add-JavaCandidate $env:STUDIO_JDK 'STUDIO_JDK'
    Add-JavaCandidate $env:ANDROID_STUDIO_JDK 'ANDROID_STUDIO_JDK'

    $programFiles = ${env:ProgramFiles}
    if (-not $programFiles) { $programFiles = 'C:\Program Files' }

    # Android Studio installs a suitable JetBrains Runtime on most computers.
    Add-JavaCandidate (Join-Path $programFiles 'Android\Android Studio\jbr') 'Android Studio JBR'
    Add-JavaCandidate (Join-Path $programFiles 'Android\Android Studio\jre') 'Android Studio JRE'

    Add-JavaChildren (Join-Path $programFiles 'Eclipse Adoptium') 'Eclipse Temurin'
    Add-JavaChildren (Join-Path $programFiles 'Microsoft') 'Microsoft OpenJDK'
    Add-JavaChildren (Join-Path $programFiles 'Java') 'Oracle/OpenJDK'
    Add-JavaChildren (Join-Path $programFiles 'Amazon Corretto') 'Amazon Corretto'
    Add-JavaChildren (Join-Path $programFiles 'Zulu') 'Azul Zulu'

    $javaCmd = Get-Command 'java.exe' -ErrorAction SilentlyContinue
    if ($javaCmd -and $javaCmd.Source) {
        $javaDir = Split-Path -Parent $javaCmd.Source
        if ((Split-Path -Leaf $javaDir) -ieq 'bin') {
            Add-JavaCandidate (Split-Path -Parent $javaDir) 'system PATH'
        }
    }

    $selected = $null
    if (-not [string]::IsNullOrWhiteSpace($JdkPath)) {
        $selected = $script:javaCandidates | Where-Object {
            $_.Label -eq 'manual -JdkPath' -and $_.Major -ge 17 -and $_.Major -le 23
        } | Select-Object -First 1
        if (-not $selected) { throw 'Invalid -JdkPath: point to a JDK 17-23 directory containing bin\java.exe and bin\javac.exe.' }
    }
    foreach ($preferred in @(17, 21, 18, 19, 20, 22, 23)) {
        if ($selected) { break }
        $selected = $script:javaCandidates | Where-Object { $_.Major -eq $preferred } | Select-Object -First 1
        if ($selected) { break }
    }

    if (-not $selected) {
        Write-Host ''
        Write-Host 'ERROR: No compatible JDK found (required: JDK 17, recommended).' -ForegroundColor Red
        Write-Host 'Gradle 8.10.2 cannot run with Java 25.' -ForegroundColor Yellow
        if ($script:javaCandidates.Count -gt 0) {
            Write-Host 'Detected JDK versions:'
            $script:javaCandidates | ForEach-Object { Write-Host ('  Java {0}: {1}' -f $_.Major, $_.Home) }
        }
        Write-Host 'Install JDK 17 (e.g., Eclipse Temurin 17) or select the JDK installed with Android Studio.'
        Write-Host 'Then rerun tao-apk-windows.bat.'
        Write-Host 'Or use: powershell -NoProfile -ExecutionPolicy Bypass -File .\tao-apk-windows.ps1 -JdkPath "C:\path\to\jdk-17"'
        throw 'Compatible JDK not found.'
    }

    $env:JAVA_HOME = $selected.Home
    $env:Path = (Join-Path $selected.Home 'bin') + ';' + $env:Path
    Write-Host ('Selected Java {0} ({1})' -f $selected.Major, $selected.Label) -ForegroundColor Green
    Write-Host ('JAVA_HOME = {0}' -f $env:JAVA_HOME)

    $jar = Join-Path $PSScriptRoot 'gradle\wrapper\gradle-wrapper.jar'
    $url = 'https://raw.githubusercontent.com/gradle/gradle/v8.10.2/gradle/wrapper/gradle-wrapper.jar'
    $expected = '2db75c40782f5e8ba1fc278a5574bab070adccb2d21ca5a6e5ed840888448046'

    if (-not (Test-Path -LiteralPath $jar)) {
        Write-Host 'Downloading official Gradle Wrapper 8.10.2...'
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        $temp = "$jar.tmp"
        Invoke-WebRequest -Uri $url -OutFile $temp -UseBasicParsing
        $hash = (Get-FileHash -LiteralPath $temp -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($hash -ne $expected) {
            Remove-Item -LiteralPath $temp -Force
            throw "Wrapper JAR checksum mismatch: $hash"
        }
        Move-Item -LiteralPath $temp -Destination $jar -Force
    }
    $actual = (Get-FileHash -LiteralPath $jar -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $expected) {
        throw "Untrusted wrapper JAR: SHA-256 mismatch ($actual)"
    }

    Write-Host 'Building APK with Gradle 8.10.2 and AGP 8.8.1...'
    & (Join-Path $PSScriptRoot 'gradlew.bat') --no-daemon :app:assembleDebug
    if ($LASTEXITCODE -ne 0) { throw "Gradle failed with exit code $LASTEXITCODE" }

    $apk = Join-Path $PSScriptRoot 'app\build\outputs\apk\debug\app-debug.apk'
    if (-not (Test-Path -LiteralPath $apk)) { throw "APK not found: $apk" }
    $out = Join-Path $PSScriptRoot 'ThoiGianCuaToi-debug.apk'
    Copy-Item -LiteralPath $apk -Destination $out -Force
    Write-Host 'BUILD SUCCESSFUL' -ForegroundColor Green
    Write-Host "APK: $out"
} catch {
    Write-Host ''
    Write-Host ('BUILD FAILED: ' + $_.Exception.Message) -ForegroundColor Red
    exit 1
}
