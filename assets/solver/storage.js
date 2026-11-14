function database(){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open('timetable-browser-solver',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('results');
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
    request.onblocked=()=>reject(Error('다른 계산 탭을 닫고 저장을 다시 시도하세요.'));
  });
}
export async function storedResult(term,value){
  const db=await database();
  try{return await new Promise((resolve,reject)=>{
    const tx=db.transaction('results',value===undefined?'readonly':'readwrite'),store=tx.objectStore('results');
    const request=value===undefined?store.get(term):store.put(value,term);
    tx.oncomplete=()=>resolve(request.result);
    tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error??Error('저장 작업이 중단되었습니다.'));
  });}finally{db.close();}
}
