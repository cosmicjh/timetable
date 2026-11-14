import {solveTimetable} from '../course-allocation/shared/timetable-cpsat.js';

self.onmessage=async({data})=>{
  try{
    if(!self.crossOriginIsolated)throw Error('계산 페이지의 보안 헤더를 확인하세요.');
    const api=await import('./lib/browser/cp-sat.js');
    api.setCloudNoticeEnabled(false);
    const result=await solveTimetable(data.model,data.options,api,{
      limits:data.limits,workers:data.workers,warmStart:data.warmStart,
      onProgress:progress=>self.postMessage({type:'progress',progress})
    });
    self.postMessage({type:'result',result});
  }catch(error){self.postMessage({type:'error',message:error.message});}
};
