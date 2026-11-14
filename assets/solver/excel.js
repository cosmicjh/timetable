const DAYS=['월','화','수','목','금'];
const PBD=[[2,3,4,5,6,7],[1,2,3,4,5,6,7],[1,2,3,4],[1,2,3,4,5,6,7],[1,2,3,4,5,6,7]];
const RT={'1':[0,1,2,3,4,6,7,8],'2':[0,1,2,3,4,6,7,8],'3':[0,1,2,3,5,6,7,8]};
const labels=['1교시','2교시','3교시','4교시(1·2학년)','4교시(3학년)','5교시','6교시','7교시'];

export function teacherRows(teacher,result){
  const cells=new Map();
  for(const r of result.BAN_PLACE??[])if(r.t===teacher)cells.set(`${r.d},${RT[r.g][r.p]}`,`${r.cls} ${r.sub}`);
  for(const r of result.SEC_PLACE??[])if(r.t===teacher)cells.set(`${r.d},${RT[r.g][r.p]}`,`${r.g}${r.block} ${r.sub}`);
  return [['시간',...DAYS],...labels.map((label,i)=>[label,...DAYS.map((_,d)=>cells.get(`${d},${i+1}`)??'')])];
}

// Python's summary uses str(dict), while the other structured rows use JSON.
const pythonRepr=s=>{
  const quote=s.includes("'")&&!s.includes('"')?'"':"'";
  return quote+s.replaceAll('\\','\\\\').replaceAll(quote,'\\'+quote).replaceAll('\n','\\n').replaceAll('\r','\\r').replaceAll('\t','\\t')+quote;
};
const pythonDict=o=>'{'+Object.entries(o).map(([k,v])=>`${pythonRepr(k)}: ${v}`).join(', ')+'}';
const summaryJSON=v=>Array.isArray(v)?'['+v.map(summaryJSON).join(', ')+']':v&&typeof v==='object'?'{'+Object.entries(v).map(([k,x])=>JSON.stringify(k)+': '+summaryJSON(x)).join(', ')+'}':JSON.stringify(v);
export function workbookData(model,result){
  const teachers=[];
  for(const t of model.teachers)teachers.push([t],...teacherRows(t,result),[]);
  const grid=[['2·3학년 이동수업 블록 배치표 — 한 칸에 2학년·3학년 블록이 함께 열릴 수 있음 (하위분반 3C1/3C2 등은 기본 블록 3C로 표시)'],[],['교시',...DAYS]];
  for(let p=1;p<=7;p++)grid.push([String(p),...DAYS.map((_,d)=>PBD[d].includes(p)?['1','2','3'].map(g=>[...new Set((result.blockSlots??[]).filter(r=>r.d===d&&r.p===p&&r.g===g).map(r=>r.block))].sort().join(' ')).filter(Boolean).join('\n'):'')]);
  const detail=[['학년','블록','요일','교시','분반','과목','담당교사']];
  const fields=['g','block','d','p','div','sub'];
  const compare=(a,b)=>{for(const k of fields){if(a[k]<b[k])return -1;if(a[k]>b[k])return 1;}return 0;};
  for(const r of [...(result.SEC_PLACE??[])].sort(compare))detail.push([`${r.g}학년`,r.block,DAYS[r.d],`${r.p}교시`,r.div,r.sub,r.t]);
  const scores=Object.values(result.scores??{}),o=result.options,unplaced=result.UNPLACED??[];
  const summary=[['항목','값'],['미배치 수',unplaced.length],['최고 교사 불편 점수',['2','2.5'].includes(result.adoptedStage)?(scores.length?Math.max(...scores):0):'미산출(1단계 해 사용)'],['총 불편 점수',result.adoptedStage==='2.5'?scores.reduce((a,b)=>a+b,0):'(2.5단계 생략)'],['하루2회 분리 허용 과목',o.pairAllowList.length?o.pairAllowList.join(', '):'없음(모두 하루1회)'],['강사 출근일수',pythonDict(o.gangsaDayCount)]];
  if(unplaced.length){summary.push([],['미배치 목록','']);for(const r of unplaced)summary.push([`${r.g}학년 ${r.cls}반`,`${r.sub} / ${r.t}`]);}
  summary.push(['결과 상태',result.status],['독립 검사기',result.checker?.status??'미실행']);
  for(const e of result.checker?.errors??[])summary.push(['검증 실패',e]);
  for(const s of result.stages??[])summary.push(['단계 '+s.stage,summaryJSON(s)]);
  summary.push(['모델 SHA-256',result.modelHash??''],['옵션',summaryJSON(o)]);
  return [
    {name:'교사별 시간표',rows:teachers,widths:[14,18,18,18,18,18]},
    {name:'이동수업 배치표',rows:grid,widths:[6,18,18,18,18,18]},
    {name:'이동수업 분반 상세',rows:detail,widths:[8,8,6,8,10,22,12]},
    {name:'검증 요약',rows:summary,widths:[24,32]}
  ];
}

export function makeWorkbook(XLSX,model,result){
  const wb=XLSX.utils.book_new();
  for(const data of workbookData(model,result)){
    const sheet=XLSX.utils.aoa_to_sheet(data.rows);
    sheet['!cols']=data.widths.map(wch=>({wch}));
    if(data.name==='이동수업 배치표')sheet['!merges']=[{s:{r:0,c:0},e:{r:0,c:5}}];
    XLSX.utils.book_append_sheet(wb,sheet,data.name);
  }
  return wb;
}
