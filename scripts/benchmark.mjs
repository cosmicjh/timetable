import {mkdir,writeFile} from 'node:fs/promises';
import {harness} from '../tests/harness.mjs';
import Core from '../src/core.js';
const st={term:'2026-2',settings:Core.defaultSettings(),students:[],sections:[],teacherRows:[],overrides:[],blocks:[]};
for(let g=1;g<=3;g++)for(let subject=0;subject<8;subject++)for(let n=1;n<=12;n++)st.sections.push({id:`section-${g}-${subject}-${n}`,grade:String(g),subject:'가상과목'+subject,code:String.fromCharCode(65+subject)+n,room:`가상실${g}-${n}`,shortName:'과목'+subject});
for(let g=1;g<=3;g++)for(let c=1;c<=10;c++)for(let n=1;n<=30;n++){const s={id:`student-${g}-${c}-${n}`,sourceKey:`${g}-${c}-${n}`,grade:String(g),classNum:String(c),number:String(n),name:`가상학생${g}-${c}-${n}`,status:'재학',note:'',manualFields:[],updatedAt:'',choices:{}};for(let k=0;k<8;k++)s.choices['가상과목'+k]=String.fromCharCode(65+k)+(n%12+1);st.students.push(s);}
const header=['순번','교사'],period=['',''];for(const day of Core.DAYS)for(let p=1;p<=7;p++){header.push(p===1?day:'');period.push(p);}st.teacherRows.push(header,period);
for(let t=0;t<120;t++){const row=[t+1,'가상교사'+t],room=['',''];for(let slot=0;slot<35;slot++){const s=st.sections[(t*7+slot)%st.sections.length];row.push(s.shortName+s.code);room.push(s.room);}st.teacherRows.push(row,room);}
const h=await harness(),metrics=[];
try{
 const loginAt=performance.now(),{cookie}=await h.login();metrics.push({operation:'login-with-client-KDF',count:1,medianMs:performance.now()-loginAt});
 const restore=await h.mutation('restore',{backup:{format:'school-timetable-backup',schemaVersion:1,store:st}},cookie);if(!restore.ok)throw Error(JSON.stringify(restore));
 for(const [action,args] of [['bootstrap',{}],['student',{studentNumber:'30101'}],['teacher',{teacher:'가상교사0'}],['adminBootstrap',{}],['roster',{query:{kind:'elective',sectionId:'section-3-0-2'}}]]){
  const samples=[];for(let i=0;i<10;i++){const r=await h.api(action,args,cookie);if(!r.ok)throw Error(JSON.stringify(r));samples.push({ms:r.elapsed,bytes:r.bytes,read:Number(r.headers.get('x-d1-rows-read')),written:Number(r.headers.get('x-d1-rows-written'))});}
  samples.sort((a,b)=>a.ms-b.ms);if(action==='adminBootstrap'&&samples[5].read>50000)throw Error('Admin student summary query regressed to excessive row reads');metrics.push({operation:action,count:samples.length,medianMs:samples[5].ms,p95Ms:samples[9].ms,bytes:samples[5].bytes,rowsRead:samples[5].read,rowsWritten:samples[5].written});
 }
 const detail=(await h.api('adminStudent',{id:'student-3-1-1'},cookie)).data.student,samples=[];
 for(let i=0;i<10;i++){const r=await h.mutation('saveStudent',{student:{...detail,note:'가상수정'+i}},cookie);if(!r.ok)throw Error(JSON.stringify(r));samples.push({ms:r.elapsed,bytes:r.bytes,read:Number(r.headers.get('x-d1-rows-read')),written:Number(r.headers.get('x-d1-rows-written'))});}
 samples.sort((a,b)=>a.ms-b.ms);metrics.push({operation:'saveStudent',count:10,medianMs:samples[5].ms,p95Ms:samples[9].ms,bytes:samples[5].bytes,rowsRead:samples[5].read,rowsWritten:samples[5].written});
 const report={date:'2026-10-30',environment:{node:process.version,platform:process.platform,runtime:'Miniflare 4 / workerd, isolated local D1; wall time, no remote CPU enforcement'},scale:{students:900,sections:288,assignments:7200,teachers:120},metrics};
 await mkdir('test-results',{recursive:true});await writeFile('test-results/benchmark.json',JSON.stringify(report,null,2)+'\n');console.table(metrics);
}finally{await h.close();}
