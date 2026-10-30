import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import Core from '../src/core.js';
import {assertStore} from '../src/domain.js';
function stable(value){if(Array.isArray(value))return value.map(stable);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));return value;}
const hash=v=>createHash('sha256').update(JSON.stringify(stable(v))).digest('hex');
export function summarize(raw){
 if(raw.format!=='school-timetable-backup'||raw.schemaVersion!==1)throw Error('Unsupported backup format');const st=raw.store;assertStore(st);const rt=Core.runtime(st),sort=a=>a.sort((a,b)=>String(a.id).localeCompare(String(b.id)));
 const students=sort(st.students.map(s=>({id:s.id,sourceKey:s.sourceKey||Core.key(s),grade:s.grade,classNum:s.classNum,number:s.number,name:s.name,status:s.status||'재학',note:s.note||'',manualFields:[...(s.manualFields||[])].sort(),choices:s.choices})));
 const sections=sort(st.sections.map(s=>({id:s.id,grade:s.grade,subject:s.subject,code:s.code,room:s.room||'',shortName:s.shortName||''})));
 return {term:st.term,counts:{students:st.students.length,activeStudents:st.students.filter(Core.active).length,sections:st.sections.length,assignments:st.students.reduce((n,s)=>n+Object.values(s.choices||{}).filter(Boolean).length,0),teachers:rt.teachers.length,overrides:st.overrides.length,blocks:st.blocks.length},
 hashes:{students:hash(students),sections:hash(sections),settings:hash(st.settings),studentTimetables:hash(students.filter(Core.active).map(s=>Core.studentTimetable(rt,s))),teacherTimetables:hash(rt.teachers.map(t=>Core.teacherTimetable(rt,t.name)).sort((a,b)=>a.name.localeCompare(b.name))),rosters:hash(sections.map(s=>Core.roster(rt,{kind:'elective',sectionId:s.id}))),overrides:hash(st.overrides),blocks:hash(st.blocks)}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [before,after]=process.argv.slice(2);if(!before)throw Error('Usage: node scripts/compare-backups.mjs private/before.json [private/after.json]');
 const a=summarize(JSON.parse(await readFile(before,'utf8'))),b=after?summarize(JSON.parse(await readFile(after,'utf8'))):null;
 const equal=b?JSON.stringify(a)===JSON.stringify(b):null;console.log(JSON.stringify({before:a,...(b?{after:b,equal}:{})},null,2));if(b&&!equal)process.exitCode=1;
}
