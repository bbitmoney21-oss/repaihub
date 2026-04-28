// Writes dist-server/package.json so Node.js treats the compiled output as CommonJS.
// Needed because root package.json has "type":"module" for Vite/ESM tooling,
// but tsc compiles the server to CommonJS (require/exports).
import { writeFileSync, mkdirSync } from 'fs';
mkdirSync('dist-server', { recursive: true });
writeFileSync('dist-server/package.json', JSON.stringify({ type: 'commonjs' }, null, 2));
console.log('✓ dist-server/package.json written (type: commonjs)');
