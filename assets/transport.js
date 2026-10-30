(function(global){
 'use strict';
 const reads=new Set(['bootstrap','student','teacherBootstrap','teacher','roster','classBatch','adminBootstrap','adminStudent','adminSections','adminLinks','adminLessons','adminHistory','adminSettings','previewImport','downloadBackup']);
 async function request(action,args={}){
  const started=performance.now(),payload={...args};delete payload.token;
  async function send(name,data){
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),110000);
   try{const response=await fetch('/api/'+name,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:controller.signal});const result=await response.json();
    const perf=global.TIMETABLE_PERF||(global.TIMETABLE_PERF=[]);perf.push({action:name,elapsedMs:Math.round(performance.now()-started),bytes:Number(response.headers.get('Content-Length'))||new TextEncoder().encode(JSON.stringify(result)).length,serverTiming:response.headers.get('Server-Timing'),rowsRead:Number(response.headers.get('X-D1-Rows-Read')),rowsWritten:Number(response.headers.get('X-D1-Rows-Written'))});if(perf.length>80)perf.shift();
    if(!result.ok){const e=Error(result.error||'요청을 처리하지 못했습니다.');e.code=result.code;e.status=response.status;throw e;}return result.data;
   }catch(e){if(e.name==='AbortError')throw Error('응답을 확인하지 못했습니다. 입력값을 보관하고 새로고침하여 저장 결과를 확인하세요.');throw e;}finally{clearTimeout(timer);}
  }
  if(action==='login'||action==='changePassword'){
   const {stretchPassword,newSalt}=await import('./password.js'),p=await send('passwordParameters',{role:action==='login'?payload.role:'admin'});
   if(action==='login'){payload.password=await stretchPassword(payload.password,p);payload.credentialEpoch=p.epoch;}
   else {const password=payload.newPassword;if(typeof password!=='string'||password.length<4||password.length>128)throw Error('새 비밀번호는 4–128자로 입력하세요.');payload.currentPassword=await stretchPassword(payload.currentPassword,p);payload.currentEpoch=p.epoch;payload.passwordSalt=newSalt();payload.passwordProof=await stretchPassword(password,{salt:payload.passwordSalt});payload.passwordLength=password.length;delete payload.newPassword;}
  }
  try{return await send(action,payload);}catch(e){if(reads.has(action)&&e.code==='READ_CHANGED')return send(action,payload);throw e;}
 }
 global.TTApi={request};
})(window);
