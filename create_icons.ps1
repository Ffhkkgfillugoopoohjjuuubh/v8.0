# Create placeholder PNG icons for Android
$base64 = "iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAA2klEQVRoQ+2ZwQ3AIAwD07VgJ3ZgJ3ZCB3ZiJ3ZiJ3ZiB3ZiB3ZiB3ZiJ3ZiB3ZiJ3ZiJ3ZiB3ZiB3ZiB3ZiJ3ZiJ3ZiJ3ZiB3ZiB3ZiJ3ZiJ3ZiB3ZiB3ZiJ3ZiJ3ZiB3ZiB3ZiJ3ZiJ3ZiB3ZiB3ZiJ3ZiJ3ZiB3ZiB3ZiJ3ZiJ3ZiB3ZiB3ZiJ3ZiJ3ZiB3ZiB3ZiJ3ZiJ3ZiB3ZiB3ZiJ3ZiJ3ZiB3ZiB3ZiJ3ZiJ3ZiB3ZiB3ZiJ3ZiJ3ZiB3ZiB3ZiJ3ZiJ3ZiB3ZiB3ZiJ3ZiJ3ZiB3ZiB3ZiJ3ZiJ3ZiB3ZiB3ZiJ3ZiJ3ZiB3ZiB3ZiJ3ZiJ3ZicAF+8gJb9cQAAAAASUVORK5CYII=";
$bytes = [System.Convert]::FromBase64String($base64);
$paths = @(
    "C:\Users\gdygh\Downloads\Echo-AI-Assistant (1)\Echo-AI-Assistant\flutter_app\android\app\src\main\res\mipmap-mdpi\ic_launcher.png",
    "C:\Users\gdygh\Downloads\Echo-AI-Assistant (1)\Echo-AI-Assistant\flutter_app\android\app\src\main\res\mipmap-hdpi\ic_launcher.png",
    "C:\Users\gdygh\Downloads\Echo-AI-Assistant (1)\Echo-AI-Assistant\flutter_app\android\app\src\main\res\mipmap-xhdpi\ic_launcher.png",
    "C:\Users\gdygh\Downloads\Echo-AI-Assistant (1)\Echo-AI-Assistant\flutter_app\android\app\src\main\res\mipmap-xxhdpi\ic_launcher.png",
    "C:\Users\gdygh\Downloads\Echo-AI-Assistant (1)\Echo-AI-Assistant\flutter_app\android\app\src\main\res\mipmap-xxxhdpi\ic_launcher.png"
);
foreach ($p in $paths) {
    [System.IO.File]::WriteAllBytes($p, $bytes);
    Write-Host "Created: $p";
}
Write-Host "Done!";