import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JavaScriptObfuscator from 'javascript-obfuscator';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pkgFile = path.join(__dirname, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));

const srcFile = path.join(__dirname, 'src', 'index.js');
const destDir = path.join(__dirname, 'lib');
const destFile = path.join(destDir, 'index.js');

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

console.log(`[BUILD] Building zireku-ls version ${pkg.version}...`);
console.log('[BUILD] Reading source code from:', srcFile);
let code = fs.readFileSync(srcFile, 'utf8');

// Inject latest package version into source
code = code.replace(/export const PACKAGE_VERSION = '[^']*';/, `export const PACKAGE_VERSION = '${pkg.version}';`);

console.log('[BUILD] Obfuscating code with ultra-strict protection settings...');

const obfuscationResult = JavaScriptObfuscator.obfuscate(code, {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 1.0,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.8,
  debugProtection: false,
  debugProtectionInterval: 0,
  disableConsoleOutput: false,
  identifierNamesGenerator: 'hexadecimal',
  numbersToExpressions: true,
  selfDefending: false,
  simplify: true,
  splitStrings: true,
  splitStringsChunkLength: 3,
  stringArray: true,
  stringArrayCallsTransform: true,
  stringArrayCallsTransformThreshold: 1.0,
  stringArrayEncoding: ['rc4', 'base64'],
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 5,
  stringArrayWrappersChainedCalls: true,
  stringArrayWrappersParametersMaxCount: 5,
  stringArrayWrappersType: 'function',
  stringArrayThreshold: 1.0,
  transformObjectKeys: true,
  target: 'node'
});

const outputCode = obfuscationResult.getObfuscatedCode();
fs.writeFileSync(destFile, outputCode, 'utf8');

console.log('[BUILD] Obfuscation complete!');
console.log(`[BUILD] Original size: ${code.length} bytes -> Obfuscated size: ${outputCode.length} bytes`);
console.log('[BUILD] Output saved to:', destFile);
