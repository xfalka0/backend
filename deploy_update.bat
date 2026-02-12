@echo off
echo ==========================================
echo       FALKA DATING APP DEPLOYMENT
echo ==========================================
echo.
echo Guncellemeler yukleniyor (Deploying updates)...
echo.

:: Path found in GitHub Desktop
set GIT_PATH="C:\Users\Falka\AppData\Local\GitHubDesktop\app-3.5.4\resources\app\git\cmd\git.exe"

echo Admin paneli derleniyor (Building Admin Panel)...
cd web-admin
call npm run build
cd ..

if exist %GIT_PATH% (
    echo Git bulundu: %GIT_PATH%
    %GIT_PATH% add .
    %GIT_PATH% commit -m "Build: Admin panel and diagnostic fixes"
    %GIT_PATH% push origin main
) else (
    echo DIKKAT: Git programi otomatik bulunamadi.
    echo Lutfen 'GitHub Desktop' uygulamanizi acin ve oradan Commit/Push yapin.
)

echo.
echo ==========================================
echo Islem Tamamlandi. Pencereyi kapatabilirsiniz.
echo ==========================================
pause
