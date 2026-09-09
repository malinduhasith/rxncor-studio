import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

export function loadTs(path, mocks = {}) {
  const require = createRequire(path);
  const source = readFileSync(path, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  });
  const unit = { exports: {} };
  const scopedRequire = (name) => Object.hasOwn(mocks, name) ? mocks[name] : require(name);
  new Function("require", "module", "exports", outputText)(scopedRequire, unit, unit.exports);
  return unit.exports;
}
