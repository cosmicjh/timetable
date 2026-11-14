import {exportSolverModel} from '../course-allocation/shared/timetable-model.js';
import {DEFAULT_OPTIONS,validateModel,validateWarmStart} from '../course-allocation/shared/timetable-cpsat.js';
import {checkTimetable} from '../course-allocation/shared/timetable-checker.js';
import {teacherRows,makeWorkbook} from './excel.js';
import {storedResult} from './storage.js';

const $=id=>document.getElementById(id),listKeys=['buja','gangsa','pairAllowList'],jsonKeys=['gangsaDayCount','blockTimeBan','dependents'],weights=['over4','run3','lunch','firstlast'];
let model=null,result=null,saved=null,warm=null,worker=null,wake=null,loading=false,fileReading=false,loadId=0,fileId=0,stage='준비',began=0,stageBegan=0;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function message(s){$('message').textContent=s;}
function update(){
  $('run').disabled=!model||!!worker||loading||fileReading||!crossOriginIsolated;
  $('cancel').disabled=!worker;$('reload').disabled=loading||!!worker||fileReading;
  for(const el of $('form').elements)if(!['run','cancel'].includes(el.id))el.disabled=!!worker||loading||fileReading;
  $('warm-run').querySelector('[value=saved]').disabled=!saved;
}
function apply(o){
  for(const k of listKeys)if(Array.isArray(o[k]))$(k).value=o[k].join('\n');
  for(const k of jsonKeys)if(o[k]!==undefined)$(k).value=JSON.stringify(o[k],null,2);
  for(const k of weights)if(o.weights?.[k]!==undefined)$(k).value=o.weights[k];
  if(o.startLimit!==undefined)$('startLimit').value=o.startLimit;
}
function options(){
  const o={};for(const k of listKeys)o[k]=$(k).value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  for(const k of jsonKeys){try{o[k]=JSON.parse($(k).value);}catch{throw Error(`${$(k).labels[0].firstChild.textContent.trim()}: JSON 형식을 확인하세요.`);}}
  o.weights=Object.fromEntries(weights.map(k=>[k,Number($(k).value)]));o.startLimit=Number($('startLimit').value);return o;
}
function warmSummary(){
  if(!warm){$('warm-summary').innerHTML='시작점이 없으면 수십 분 이상 걸릴 수 있습니다. 처음부터 계산할 때는 <a href="https://github.com/cosmicjh/course-allocation/tree/main/timetable-solver" target="_blank" rel="noopener">로컬 솔버</a>도 사용할 수 있습니다.';return;}
  const current=new Set([...model.blocks,...model.bans].map(r=>r.rowId)),old=new Set([...(warm.SEC_PLACE??[]),...(warm.BAN_PLACE??[])].map(r=>r?.rowId).filter(r=>typeof r==='string'));
  const matched=[...old].filter(r=>current.has(r)).length;
  $('warm-summary').textContent=`학기 ${warm.source?.term??'정보 없음'} · 현재 학기 ${model.source.term} · rowId 대응 ${matched}/${old.size} (${old.size?Math.round(100*matched/old.size):0}%) · 0단계는 생략합니다.`;
}
async function load(){
  const id=++loadId;loading=true;model=null;result=null;saved=null;warm=null;++fileId;fileReading=false;
  $('result-section').hidden=true;$('warm-file').value='';$('warm-run').value='';$('validation').textContent='확정 배당을 읽고 있습니다.';$('issues').replaceChildren();update();
  try{
    const [admin,workspace]=await Promise.all([TTApi.request('adminBootstrap',{workspaceOnly:true}),TTApi.request('courseWorkspace',{role:'admin',path:'/workspace',method:'GET',data:{all:true}})]);
    if(id!==loadId)return;
    const {global,parts,revisions}=workspace,term=global.school.year+'-'+global.school.semester;
    if(term!==admin.store.term)throw Error(`시수배당표 학기(${term})가 현재 학기(${admin.store.term})와 다릅니다. 시수배당표에서 학기를 확인하세요.`);
    const byId=new Map(parts.map(p=>[p.department.id,p])),ordered=global.departmentIds.map(key=>byId.get(key));
    if(ordered.some(p=>!p))throw Error('전체 교과군을 불러오지 못했습니다. 배당 다시 읽기를 눌러 주세요.');
    const source={school:global.school,departments:ordered.map(p=>p.department),departmentRevisions:revisions};
    for(const k of ['teachers','courses','groups','assignments','unmapped'])source[k]=ordered.flatMap(p=>p[k]);
    const exported=exportSolverModel(source,{exportedAt:new Date().toISOString()});
    $('issues').innerHTML=[...exported.errors,...exported.warnings].map(e=>`<li>${esc(e)}</li>`).join('');
    $('validation').textContent=exported.errors.length?`오류 ${exported.errors.length}건 · 배당표를 수정한 뒤 다시 읽으세요.`:`${term} · 점검 통과`;
    if(exported.errors.length)return;
    model=exported.model;apply({...DEFAULT_OPTIONS,...model.options,buja:model.buja,gangsa:model.gangsa});
    $('model-summary').textContent=`교사 ${model.teachers.length}명 · 이동수업 ${model.blocks.length}행 · 반수업 ${model.bans.length}행`;
    try{saved=await storedResult(term);if(saved){validateWarmStart(saved);warm=saved;$('warm-run').value='saved';}}
    catch{saved=null;message('이 브라우저의 이전 결과를 읽지 못했습니다. result.json을 선택할 수 있습니다.');}
    warmSummary();
  }catch(error){
    $('validation').textContent=error.message;
    if(error.code==='AUTH_REQUIRED')showLogin('관리자 로그인이 필요합니다.');
  }finally{if(id===loadId){loading=false;update();}}
}
function showLogin(text){++loadId;++fileId;loading=false;fileReading=false;model=null;result=null;saved=null;warm=null;$('workspace').hidden=true;$('login').hidden=false;$('logout').hidden=true;$('auth-message').textContent=text;update();}
async function open(){
  try{await TTApi.request('adminBootstrap',{workspaceOnly:true});$('login').hidden=true;$('workspace').hidden=false;$('logout').hidden=false;$('auth-message').textContent=crossOriginIsolated?'':'계산에 필요한 보안 헤더가 없습니다. Worker 도메인에서 이 페이지를 열어 주세요.';await load();}
  catch(error){showLogin(error.code==='AUTH_REQUIRED'?'관리자 로그인이 필요합니다.':error.message);}
}
$('login').onsubmit=async event=>{
  event.preventDefault();const button=$('login').querySelector('button');button.disabled=true;
  try{await TTApi.request('login',{role:'admin',password:$('password').value,initialize:true});$('password').value='';await open();}
  catch(error){$('auth-message').textContent=error.message;}finally{button.disabled=false;}
};
$('logout').onclick=async()=>{if(worker)stop('계산을 취소했습니다.');try{await TTApi.request('logout',{role:'admin'});showLogin('로그아웃했습니다.');}catch(e){message(e.message);}};
$('reload').onclick=load;
$('warm-run').onchange=()=>{++fileId;fileReading=false;$('warm-file').value='';warm=$('warm-run').value==='saved'?saved:null;warmSummary();update();};
$('warm-clear').onclick=()=>{++fileId;fileReading=false;warm=null;$('warm-run').value='';$('warm-file').value='';warmSummary();update();};
$('warm-file').onchange=async()=>{
  const file=$('warm-file').files[0],id=++fileId;warm=null;$('warm-run').value='';fileReading=!!file;update();
  try{if(file){if(file.size>32*1024*1024)throw Error('시작점 파일은 32MB 이하로 선택하세요.');const value=JSON.parse(await file.text());validateWarmStart(value);if(id===fileId)warm=value;}}
  catch(e){if(id===fileId)message(e.message);}finally{if(id===fileId){fileReading=false;warmSummary();update();}}
};
$('settings').onchange=async()=>{
  const file=$('settings').files[0];if(!file)return;const id=loadId;fileReading=true;update();
  try{
    if(file.size>1024*1024)throw Error('설정 파일은 1MB 이하로 선택하세요.');
    const value=JSON.parse(await file.text());if(value._type!=='고교학점제_설정'||value._version!==1||!value.timetable)throw Error('고교학점제_설정 버전 1 JSON을 선택하세요.');
    if(id!==loadId)return;const s=value.timetable;
    apply({...s,...(s.pairAllow?{pairAllowList:s.pairAllow}:{}),...(s.bujaList?{buja:s.bujaList}:{})});message('설정을 불러왔습니다. 규칙 적용 여부를 확인하세요.');
  }catch(e){message(e.message);}finally{fileReading=false;update();}
};
function stages(items){
  $('stages').innerHTML='<div class="table-wrap"><table><thead><tr><th>단계</th><th>상태</th><th>목적값</th><th>소요 초</th><th>채택</th></tr></thead><tbody>'+items.map(s=>`<tr><td>${esc(s.stage)}</td><td>${esc(s.status)}</td><td>${esc(s.objective??'—')}</td><td>${Number(s.wall_time).toFixed(2)}</td><td>${s.adopted?'채택':''}</td></tr>`).join('')+'</tbody></table></div>';
}
function clock(){if(worker)$('progress').textContent=`${stage} · 전체 ${Math.floor((performance.now()-began)/1000)}초 · 단계 ${Math.floor((performance.now()-stageBegan)/1000)}초`;}
setInterval(clock,1000);
async function lock(){try{if('wakeLock' in navigator){const requested=await navigator.wakeLock.request('screen');if(worker)wake=requested;else await requested.release();}}catch{/* The calculation works without a wake lock. */}}
document.addEventListener('visibilitychange',()=>{if(worker&&!document.hidden)lock();});
function stop(text){worker?.terminate();worker=null;wake?.release().catch(()=>{});wake=null;$('keep-open').hidden=true;message(text);$('progress').textContent=text;update();}
function renderResult(){
  $('result-section').hidden=false;$('result-status').textContent=`${result.status} · ${result.checker.status}`;
  $('result').innerHTML=(result.checker.errors.length?'<ul>'+result.checker.errors.map(e=>`<li>${esc(e)}</li>`).join('')+'</ul>':'')+model.teachers.map(t=>`<details><summary>${esc(t)}${result.scores?.[t]!==undefined?' · 불편 '+esc(result.scores[t]):''}</summary><div class="table-wrap"><table><tbody>${teacherRows(t,result).map((r,i)=>'<tr>'+r.map((v,j)=>`<${i===0||j===0?'th':'td'}>${esc(v)}</${i===0||j===0?'th':'td'}>`).join('')+'</tr>').join('')}</tbody></table></div></details>`).join('');
  stages(result.stages);
}
async function save(){
  const current=result,term=model.source.term;
  try{await storedResult(term,current);if(result!==current)return;saved=current;$('storage-status').textContent='이 브라우저에 저장했습니다.';update();}
  catch{if(result===current)$('storage-status').textContent='저장하지 못했습니다. result.json을 내려받아 보관하세요.';}
}
$('form').onsubmit=event=>{
  event.preventDefault();if(!model||worker||loading||fileReading)return;
  try{
    if(!crossOriginIsolated)throw Error('Worker 도메인에서 계산 페이지를 열어 주세요.');
    const limits=[1,2,3].map(i=>Number($('limit'+i).value)),o=options(),checked=validateModel(model,o,limits),workers=Number($('workers').value);
    if(checked.errors.length)throw Error(checked.errors.join('\n'));
    if(!Number.isInteger(workers)||workers<1||workers>32)throw Error('워커 수는 1~32 정수로 입력하세요.');
    if(warm)validateWarmStart(warm);
    result=null;$('result-section').hidden=true;$('storage-status').textContent='';$('stages').replaceChildren();
    worker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});const active=worker;began=stageBegan=performance.now();stage='엔진 준비';
    active.onmessage=async({data})=>{
      if(worker!==active)return;
      if(data.type==='progress'){const p=data.progress;if(p.type==='stage-start'){stage=p.stage+'단계';stageBegan=performance.now();}stages(p.stages);clock();}
      else if(data.type==='error')stop(`계산 오류: ${data.message} · 메모리가 부족하면 워커 수를 줄여 다시 실행하세요.`);
      else if(data.type==='result'){
        result=data.result;
        if(result.BAN_PLACE){result.checker=checkTimetable(checked.model,result,checked.options);if(!result.checker.ok)result.status='검증 실패';}
        result.source=model.source;stop(`계산 완료 · ${result.status}`);
        if(result.BAN_PLACE){renderResult();await save();}else{stages(result.stages);message([result.status,...(result.errors??[])].join(' · '));}
      }
    };
    active.onerror=()=>stop('계산 워커가 중단되었습니다. 메모리가 부족하면 워커 수를 줄여 다시 실행하세요.');
    active.postMessage({model,options:o,limits,workers,warmStart:warm});$('keep-open').hidden=false;message('계산 중');update();clock();lock();
  }catch(e){stop(e.message);}
};
$('cancel').onclick=()=>stop('계산을 취소했습니다.');
$('save').onclick=save;
$('json').onclick=()=>{
  const url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='result.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
$('excel').onclick=async()=>{const button=$('excel');button.disabled=true;const current=result,currentModel=model;try{const XLSX=await TTAssets.load('xlsx');XLSX.writeFile(makeWorkbook(XLSX,currentModel,current),'result.xlsx');}catch(e){message(e.message);}finally{button.disabled=false;}};
window.addEventListener('beforeunload',event=>{if(worker){event.preventDefault();event.returnValue='';}});
$('workers').value=Math.min(navigator.deviceMemory<8?4:8,navigator.hardwareConcurrency||4);
apply(DEFAULT_OPTIONS);await open();
