const sharp = require('sharp');

async function run() {
  try {
    console.log('Resizing PWA Icons...');
    await sharp('icon.png').resize(192, 192).toFile('public/icon-192.png');
    await sharp('icon.png').resize(512, 512).toFile('public/icon-512.png');
    
    // Also copy to app directory so Next.js natively uses it as website favicon
    await sharp('icon.png').resize(192, 192).toFile('app/icon.png');
    await sharp('icon.png').resize(180, 180).toFile('app/apple-icon.png');
    
    console.log('Resizing App Icon for Android directly filling bounds (no spaces)...');
    await sharp('icon.png')
        .resize(1024, 1024, { fit: 'cover' })
        .toFile('assets/icon.png');
    
    console.log('✅ Success: All icons resized perfectly to fill spaces completely.');
  } catch (err) {
    console.error('Resize Error:', err.message);
  }
}

run();
