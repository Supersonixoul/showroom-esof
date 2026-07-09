@echo off
setlocal enabledelayedexpansion

:: ============================================
:: Lancer-TV-Showroom.bat
:: Demarre le serveur du Showroom ESOF et affiche
:: l'adresse a saisir dans le navigateur de la TV.
:: ============================================

:: >>> Modifiez ce chemin si le projet se trouve ailleurs <<<
set "API_DIR=C:\Showroom\ESOF\api"

:: --- Verification des droits administrateur ---
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Ce programme a besoin des droits administrateur.
    echo Relance en cours, merci de patienter...
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

title Showroom ESOF - Vitrine TV
color 0A
echo ============================================
echo    SHOWROOM VIRTUEL ESOF - LANCEMENT TV
echo ============================================
echo.

:: --- Regle de pare-feu pour le port 3000 ---
echo Verification du pare-feu Windows...
netsh advfirewall firewall show rule name="API Showroom ESOF" >nul 2>&1
if %errorlevel% neq 0 (
    echo Ajout de l'autorisation reseau pour le port 3000...
    netsh advfirewall firewall add rule name="API Showroom ESOF" dir=in action=allow protocol=TCP localport=3000 >nul
    echo Autorisation ajoutee avec succes.
) else (
    echo L'autorisation existe deja, tout est en ordre.
)
echo.

:: --- Demarrage du serveur si necessaire ---
echo Verification du serveur...
powershell -NoProfile -Command "try { Invoke-WebRequest -Uri 'http://localhost:3000/tv' -UseBasicParsing -TimeoutSec 3 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if %errorlevel% equ 0 (
    echo Le serveur fonctionne deja, rien a faire.
) else (
    if not exist "%API_DIR%" (
        echo.
        echo ERREUR : le dossier du serveur est introuvable :
        echo   %API_DIR%
        echo Corrigez la ligne API_DIR en haut de ce fichier, puis reessayez.
        echo.
        pause
        exit /b 1
    )
    echo Le serveur n'est pas demarre. Demarrage en cours...
    start "Serveur Showroom ESOF" cmd /k "set PATH=C:\Program Files\nodejs;%%PATH%% && cd /d "%API_DIR%" && npm run start:dev"

    echo Merci de patienter pendant le demarrage...
    set "READY=0"
    for /L %%i in (1,1,30) do (
        if "!READY!"=="0" (
            timeout /t 2 /nobreak >nul
            powershell -NoProfile -Command "try { Invoke-WebRequest -Uri 'http://localhost:3000/tv' -UseBasicParsing -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
            if !errorlevel! equ 0 set "READY=1"
        )
    )
    if "!READY!"=="0" (
        echo.
        echo Le serveur met du temps a demarrer.
        echo Verifiez la fenetre "Serveur Showroom ESOF" qui vient de s'ouvrir,
        echo puis reessayez d'ouvrir l'adresse sur la TV dans une minute.
        echo.
    ) else (
        echo Le serveur est pret.
    )
)
echo.

:: --- Detection de l'adresse IP locale ---
:: On prend l'adresse de l'interface utilisee pour la route par defaut
:: (celle qui sort vraiment sur le reseau local/internet), pas juste
:: la premiere trouvee : un PC peut avoir plusieurs adresses (VPN,
:: reseaux virtuels...) qui ne sont pas joignables depuis la TV.
set "LOCAL_IP="
for /f "usebackq delims=" %%A in (`powershell -NoProfile -Command "$route = Get-NetRoute -DestinationPrefix '0.0.0.0/0' -AddressFamily IPv4 | Sort-Object -Property RouteMetric | Select-Object -First 1; (Get-NetIPAddress -InterfaceIndex $route.InterfaceIndex -AddressFamily IPv4 -AddressState Preferred | Select-Object -First 1 -ExpandProperty IPAddress)"`) do set "LOCAL_IP=%%A"

:: Filet de securite si la detection par route par defaut echoue
if "%LOCAL_IP%"=="" (
    for /f "usebackq delims=" %%A in (`powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.InterfaceAlias -notmatch 'VPN|Virtual|vEthernet|Loopback|Hyper-V|VMware|Docker|WSL' } | Select-Object -First 1 -ExpandProperty IPAddress)"`) do set "LOCAL_IP=%%A"
)

if "%LOCAL_IP%"=="" (
    echo.
    echo ERREUR : impossible de trouver l'adresse reseau de cet ordinateur.
    echo Verifiez que l'ordinateur est bien connecte au reseau (cable ou wifi).
    echo.
    pause
    exit /b 1
)

echo.
echo ============================================
echo.
echo   SUR LA TELEVISION DU SHOWROOM :
echo   1. Ouvrez le navigateur internet
echo   2. Tapez exactement cette adresse :
echo.
echo        http://%LOCAL_IP%:3000/tv
echo.
echo ============================================
echo.
echo Laissez cette fenetre ouverte tant que la vitrine
echo doit fonctionner sur la television.
echo.
pause
