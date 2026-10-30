const encoder=new TextEncoder();
export const hex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
export const newSalt=()=>hex(crypto.getRandomValues(new Uint8Array(16)));
export async function stretchPassword(password,{salt,iterations=100000}){
  if(typeof password!=='string'||password.length>128||!/^[a-f0-9]{32}$/.test(salt)||iterations!==100000)throw new Error('비밀번호 계산 설정이 올바르지 않습니다.');
  const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
  return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:encoder.encode(salt),iterations},key,256));
}
