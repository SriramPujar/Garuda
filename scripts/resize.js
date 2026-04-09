const sharp = require('sharp');

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

    console.log('✅ Success: All icons are fully edge-to-edge with no padding.');
  } catch (err) {
    console.error('Resize Error:', err.message);
  }
}

run();
