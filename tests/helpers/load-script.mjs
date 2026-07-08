import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

// Evaluates classic (non-module) browser scripts in a vm sandbox and returns
// the sandbox, so tests can call the globals the scripts defined.
export function loadScript(relPaths, extraContext) {
  const sandbox = Object.assign({ console }, extraContext || {});
  vm.createContext(sandbox);
  const paths = Array.isArray(relPaths) ? relPaths : [relPaths];
  for (const p of paths) {
    const code = readFileSync(path.resolve(p), 'utf8');
    vm.runInContext(code, sandbox, { filename: p });
  }
  return sandbox;
}
