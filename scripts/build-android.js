/**
 * build-android.js
 * Temporarily swaps the Next.js config to the static-export version,
 * builds the static output, syncs to Android, then restores the original config.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '..', 'next.config.mjs');
const androidConfigPath = path.join(__dirname, '..', 'next.android.config.mjs');
const backupPath = path.join(__dirname, '..', 'next.config.mjs.bak');

console.log('🕉️  Garuda AI — Android Build Script');
console.log('====================================');

try {
    // 1. Backup the real config
    console.log('\n[1/4] Backing up Vercel config...');
    fs.copyFileSync(configPath, backupPath);

    // 2. Swap in the android config
    console.log('[2/4] Using Android (static export) config...');
    fs.copyFileSync(androidConfigPath, configPath);

    // 3. Build
    console.log('[3/4] Building static export...');
    execSync('npx next build', { stdio: 'inherit', cwd: path.join(__dirname, '..') });

    // 4. Sync to Android
    console.log('[4/4] Syncing to Android...');
    execSync('npx cap sync android', { stdio: 'inherit', cwd: path.join(__dirname, '..') });

    console.log('\n✅ Android build complete! Open Android Studio to generate your APK.');
} catch (err) {
    console.error('\n❌ Build failed:', err.message);
    process.exitCode = 1;
} finally {
    // Always restore the original config
    if (fs.existsSync(backupPath)) {
        fs.copyFileSync(backupPath, configPath);
        fs.unlinkSync(backupPath);
        console.log('\n🔄 Vercel config restored.');
    }
}
