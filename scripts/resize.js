const sharp = require('sharp');
const fs = require('fs');

async function run() {
  try {
    console.log('Trimming the icon of any white spacing or padding...');
    
    // Use sharp to trim the transparent or solid background, 
    // then resize to explicitly fit edge to edge.
    const base = sharp('icon.png').trim();

    // Generate PWA icons
    await base.clone().resize(192, 192, { fit: 'cover' }).toFile('public/icon-192.png');
    await base.clone().resize(512, 512, { fit: 'cover' }).toFile('public/icon-512.png');
    
    // Generate Next.js static favicons
    await base.clone().resize(192, 192, { fit: 'cover' }).toFile('app/icon.png');
    await base.clone().resize(180, 180, { fit: 'cover' }).toFile('app/apple-icon.png');
    
    // Generate Android/Electron native assets
    await base.clone().resize(1024, 1024, { fit: 'cover' }).toFile('assets/icon.png');
    await base.clone().resize(1024, 1024, { fit: 'cover' }).toFile('electron/icon.png');

    // Ensure build/appx directory exists
    fs.mkdirSync('build/appx', { recursive: true });

    // Generate AppX Microsoft Store tile logos
    await base.clone().resize(50, 50, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toFile('build/appx/StoreLogo.png');
    await base.clone().resize(150, 150, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toFile('build/appx/Square150x150Logo.png');
    await base.clone().resize(44, 44, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toFile('build/appx/Square44x44Logo.png');
    await base.clone().resize(310, 150, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toFile('build/appx/Wide310x150Logo.png');

    console.log('✅ Success: All icons, including Microsoft Store AppX assets, are generated.');
  } catch (err) {
    console.error('Resize Error:', err.message);
  }
}

run();
