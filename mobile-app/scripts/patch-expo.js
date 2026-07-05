const fs = require('fs');
const path = require('path');

// 1. Patch PermissionsService.kt in expo-modules-core (Kotlin compiler null safety error)
const permissionsFile = path.join(__dirname, '../node_modules/expo-modules-core/android/src/main/java/expo/modules/adapters/react/permissions/PermissionsService.kt');
if (fs.existsSync(permissionsFile)) {
    try {
        let content = fs.readFileSync(permissionsFile, 'utf8');
        const target = 'return requestedPermissions.contains(permission)';
        const replacement = 'return requestedPermissions?.contains(permission) == true';

        if (content.includes(target)) {
            content = content.replace(target, replacement);
            fs.writeFileSync(permissionsFile, content, 'utf8');
            console.log('[PATCH] PermissionsService.kt successfully patched for Kotlin null safety!');
        } else if (content.includes(replacement)) {
            console.log('[PATCH] PermissionsService.kt is already patched.');
        } else {
            console.warn('[PATCH WARNING] Target pattern not found in PermissionsService.kt.');
        }
    } catch (err) {
        console.error('[PATCH ERROR] Failed to patch PermissionsService.kt:', err.message);
    }
} else {
    console.error('[PATCH ERROR] PermissionsService.kt does not exist.');
}

// 2. Patch ScreenStack.kt in react-native-screens (java.util.List.removeLast NoSuchMethodError crash on Android <= 13)
const screenStackFile = path.join(__dirname, '../node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreenStack.kt');
if (fs.existsSync(screenStackFile)) {
    try {
        let content = fs.readFileSync(screenStackFile, 'utf8');
        const target = 'if (drawingOpPool.isEmpty()) DrawingOp() else drawingOpPool.removeLast()';
        const replacement = 'if (drawingOpPool.isEmpty()) DrawingOp() else drawingOpPool.removeAt(drawingOpPool.size - 1)';

        if (content.includes(target)) {
            content = content.replace(target, replacement);
            fs.writeFileSync(screenStackFile, content, 'utf8');
            console.log('[PATCH] ScreenStack.kt successfully patched to prevent removeLast() crash!');
        } else if (content.includes(replacement)) {
            console.log('[PATCH] ScreenStack.kt is already patched.');
        } else {
            console.warn('[PATCH WARNING] Target pattern not found in ScreenStack.kt.');
        }
    } catch (err) {
        console.error('[PATCH ERROR] Failed to patch ScreenStack.kt:', err.message);
    }
} else {
    console.error('[PATCH ERROR] ScreenStack.kt does not exist.');
}
