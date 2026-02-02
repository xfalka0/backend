@echo off
echo ==========================================
echo       FALKA DATING APP DEPLOYMENT
echo ==========================================
echo.
echo Guncellemeler yukleniyor (Deploying updates)...
echo.

:: Try explicit path first (since we detected it)
set GIT_PATH="C:\Program Files\Git\cmd\git.exe"

if exist %GIT_PATH% (
    echo Git bulundu: %GIT_PATH%
    %GIT_PATH% add .
    %GIT_PATH% commit -m "Update admin implementation"
    %GIT_PATH% push origin main
) else (
    echo Git standart konumda bulunamadi, global komut deneniyor...
    git add .
    git commit -m "Update admin implementation"
    git push origin main
)

echo.
echo ==========================================
echo Islem Tamamlandi. Pencereyi kapatabilirsiniz.
echo ==========================================
pause
