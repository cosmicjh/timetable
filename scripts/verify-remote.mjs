// Read-only application checks plus temporary login/logout sessions. No student imports or edits.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {stretchPassword} from '../src/password.js';
const origin=new URL(process.argv[2]||'https://school-timetable.cosmicjh.workers.dev').origin;
if(!origin.startsWith('https://'))throw Error('Use the deployed HTTPS origin');
const password=process.env.TIMETABLE_TEST_PASSWORD||'1234',results=[];
async function api(action,data={},cookie='',extra={}){
 const at=performance.now(),r=await fetch(origin+'/api/'+action,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...extra},body:JSON.stringify(data),redirect:'error'});
 const p=await r.json();results.push({action,status:r.status,ms:Math.round(performance.now()-at),cacheControl:r.headers.get('cache-control')});assert.equal(r.headers.get('cache-control'),'no-store');return {response:r,status:r.status,...p};
}
for(const path of ['/','/student.html','/teacher.html','/admin.html','/assets/app.js','/api/health']){const r=await fetch(origin+path);assert(r.ok,path+' '+r.status);if(path==='/api/health')assert.equal((await r.json()).data.storage,'D1');results.push({path,status:r.status});}
for(const path of ['/api','/api/missing','/api/not-found.html']){const r=await fetch(origin+path);assert.equal(r.status,404);assert.match(r.headers.get('content-type'),/json/);assert.equal((await r.json()).ok,false);}
for(const path of ['/src/worker.js','/tests/worker.mjs','/.dev.vars','/private/bootstrap.local.json','/__fixture_sql'])assert([403,404].includes((await fetch(origin+path)).status),path);
assert.equal((await api('adminBootstrap')).status,401);assert.equal((await api('teacherBootstrap')).status,401);assert.equal((await api('bootstrap',{},'',{Origin:'https://example.invalid'})).status,403);
for(const role of ['teacher','admin']){
 const parameters=await api('passwordParameters',{role});assert(parameters.ok,JSON.stringify(parameters));
 const r=await api('login',{role,password:await stretchPassword(password,parameters.data),credentialEpoch:parameters.data.epoch,initialize:true});assert(r.ok,JSON.stringify(r));
 const headers=r.response.headers.getSetCookie();assert(headers.every(c=>c.includes('HttpOnly')&&c.includes('Secure')&&c.includes('SameSite=Strict')));const cookie=headers.map(c=>c.split(';')[0]).join('; ');assert.equal(r.data.token,'cookie');
 const protectedAction=role==='admin'?'adminBootstrap':'teacherBootstrap';assert.equal((await api(protectedAction,{},cookie)).status,200);if(role==='teacher')assert.equal((await api('adminBootstrap',{},cookie)).status,401);
 assert.equal((await api('logout',{},cookie)).status,200);assert.equal((await api(protectedAction,{},cookie)).status,401);
}
await mkdir('test-results',{recursive:true});await writeFile('test-results/remote-verification.json',JSON.stringify({origin,checkedAt:new Date().toISOString(),results},null,2)+'\n');console.log('PASS deployed Static Assets, D1 health, API routing, private-file exclusion, role permissions, cookie flags, login and session revocation: '+origin);
