import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {resolve,dirname} from 'node:path';
import './local-config.mjs';
const require=createRequire(import.meta.url),cli=resolve(dirname(require.resolve('wrangler/package.json')),'bin/wrangler.js');
const child=spawn(process.execPath,[cli,...process.argv.slice(2),'--config','wrangler.local.json'],{cwd:resolve(import.meta.dirname,'..'),env:{...process.env,WRANGLER_SEND_METRICS:'false',WRANGLER_LOG_PATH:resolve(import.meta.dirname,'../test-results/wrangler.log')},stdio:'inherit'});
child.on('exit',code=>process.exit(code||0));child.on('error',e=>{throw e;});
