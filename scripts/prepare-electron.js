import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// Create dist-electron directory if it doesn't exist
const distElectronDir = path.join(rootDir, 'dist-electron');
if (!fs.existsSync(distElectronDir)) {
  fs.mkdirSync(distElectronDir, { recursive: true });
}

// Copy electron files from electron/ to dist-electron/
const electronDir = path.join(rootDir, 'electron');
const files = ['main.cjs', 'preload.cjs'];

files.forEach(file => {
  const sourcePath = path.join(electronDir, file);
  const destPath = path.join(distElectronDir, file);
  
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, destPath);
    console.log(`Copied ${file} to dist-electron/`);
  } else {
    console.warn(`Warning: ${file} not found in electron/ directory`);
  }
});

console.log('Electron files prepared successfully');