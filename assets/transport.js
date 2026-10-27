(function (global) {
  'use strict';
  let ready=null, bridge=null, peer=null, channel='', counter=0;
  const pending=new Map();
  const direct=()=>!!(global.google&&google.script&&google.script.run);
  function endpoint(){return localStorage.getItem('timetable.apiUrl')||(global.TIMETABLE_CONFIG||{}).apiUrl||'';}
  function validateUrl(value){return /^https:\/\/script\.google\.com\/(?:macros\/s\/|a\/macros\/[^/]+\/s\/)[A-Za-z0-9_-]+\/exec$/.test(value);}
  function connect(){
    if(ready)return ready;
    const url=endpoint();
    if(!validateUrl(url)){const error=Error('연결 주소를 설정하세요.');error.code='CONNECTION_REQUIRED';return Promise.reject(error);}
    channel=Array.from(crypto.getRandomValues(new Uint8Array(24)),b=>b.toString(16).padStart(2,'0')).join('');
    ready=new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{cleanup();ready=null;reject(Error('서버 연결을 확인하세요. Apps Script 직접 주소로도 접속할 수 있습니다.'));},40000);
      function listener(e){
        if(!/^https:\/\/(?:[a-z0-9-]+-)?script\.googleusercontent\.com$/i.test(e.origin)&&e.origin!=='https://script.google.com')return;
        if(!e.data||e.data.channel!==channel)return;
        if(e.data.type==='TT_READY'&&!peer){peer={window:e.source,origin:e.origin};clearTimeout(timer);resolve();}
        if(e.data.type==='TT_RESPONSE'&&peer&&e.source===peer.window&&e.origin===peer.origin){const ticket=pending.get(e.data.id);if(ticket){clearTimeout(ticket.timer);pending.delete(e.data.id);ticket.resolve(e.data.result);}}
      }
      function cleanup(){global.removeEventListener('message',listener);if(bridge)bridge.remove();bridge=null;peer=null;}
      global.addEventListener('message',listener);
      bridge=document.createElement('iframe');bridge.hidden=true;bridge.title='시간표 서버 연결';bridge.referrerPolicy='no-referrer';
      bridge.src=url+'?bridge=1&origin='+encodeURIComponent(location.origin)+'&channel='+channel;
      document.body.appendChild(bridge);
    });
    return ready;
  }
  async function request(action,args,token){
    const payload=Object.assign({},args||{},{action:action,token:token||''});
    let result;
    if(direct())result=await new Promise((resolve,reject)=>google.script.run.withSuccessHandler(resolve).withFailureHandler(()=>reject(Error('서버 연결을 확인하세요.'))).api(payload));
    else {await connect();result=await new Promise((resolve,reject)=>{const id=channel+':'+(++counter);const timer=setTimeout(()=>{pending.delete(id);reject(Error('응답을 확인하지 못했습니다. 새로고침하여 저장 결과를 확인하세요.'));},110000);pending.set(id,{resolve,reject,timer});peer.window.postMessage({type:'TT_REQUEST',channel:channel,id:id,payload:payload},peer.origin);});}
    if(!result||!result.ok){const error=Error(result&&result.error||'요청을 처리하지 못했습니다.');error.code=result&&result.code||'REQUEST_ERROR';throw error;}
    return result.data;
  }
  global.TTApi={request,endpoint,validateUrl,direct};
})(window);
