import {writeFile,readFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {provisionCredential,randomToken} from '../src/crypto.js';
const production=process.argv.includes('--production'),root=resolve(import.meta.dirname,'..');
const path=resolve(root,production?'private/bootstrap.local.json':'.dev.vars');
try{await readFile(path);console.log('Existing credentials preserved: '+path);process.exit(0);}catch(e){if(e.code!=='ENOENT')throw e;}
const pepper=randomToken(),values={PASSWORD_PEPPER:pepper,BOOTSTRAP_TEACHER_HASH:await provisionCredential('1234',pepper,'teacher'),BOOTSTRAP_ADMIN_HASH:await provisionCredential('1234',pepper,'admin')};
await mkdir(resolve(root,'private'),{recursive:true});
await writeFile(path,production?JSON.stringify(values,null,2)+'\n':Object.entries(values).map(([k,v])=>k+'="'+v+'"').join('\n')+'\n',{flag:'wx'});
console.log('Salted initial credentials generated (teacher/admin: 1234). File excluded from Git: '+path);
