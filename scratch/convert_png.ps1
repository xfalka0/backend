Add-Type -AssemblyName System.Drawing
$filePath = "D:\dating\backend\mobile-app\assets\fiva_profile_banner.png"
$tempPath = "D:\dating\backend\mobile-app\assets\fiva_profile_banner_real.png"

try {
    Write-Output "Loading image from $filePath"
    $img = [System.Drawing.Image]::FromFile($filePath)
    
    Write-Output "Saving image as real PNG to $tempPath"
    $img.Save($tempPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $img.Dispose()
    
    Write-Output "Replacing old image"
    Remove-Item -Path $filePath -Force
    Rename-Item -Path $tempPath -NewName "fiva_profile_banner.png"
    
    Write-Output "Success!"
} catch {
    Write-Error $_.Exception.Message
}
