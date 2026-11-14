import ts from 'typescript';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
await mkdir('.sites-runtime/tests',{recursive:true});
for(const name of ['domain','service']){const source=await readFile(`lib/${name}.ts`,'utf8');const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replaceAll("'./domain'","'./domain.mjs'");await writeFile(`.sites-runtime/tests/${name}.mjs`,js)}
const result=spawnSync(process.execPath,['--test','tests/service.test.mjs'],{stdio:'inherit'});process.exit(result.status??1);
