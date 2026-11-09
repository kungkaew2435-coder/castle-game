/* เกมสร้างปราสาท — main app (Firebase + GitHub Pages) */
import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {getAuth,onAuthStateChanged,GoogleAuthProvider,signInWithPopup,signInWithEmailAndPassword,signOut,createUserWithEmailAndPassword,setPersistence,browserLocalPersistence,browserSessionPersistence} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {getFirestore,doc,getDoc,getDocs,setDoc,updateDoc,deleteDoc,addDoc,collection,query,where,onSnapshot,writeBatch,serverTimestamp,increment,arrayUnion,arrayRemove,deleteField} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import {firebaseConfig,SCHOOL} from './config.js';

const CONFIGURED=!String(firebaseConfig.apiKey||'').startsWith('YOUR');
const fb=CONFIGURED?initializeApp(firebaseConfig):null;
const auth=CONFIGURED?getAuth(fb):null;
const db=CONFIGURED?getFirestore(fb):null;
let auth2=null;function secondaryAuth(){if(!auth2)auth2=getAuth(initializeApp(firebaseConfig,'secondary'));return auth2}
const D=(...p)=>doc(db,...p),C=(...p)=>collection(db,...p);
const CARD_DOMAIN='castle.local';

/* ---------- data ---------- */
const STAGES=['ที่ดินว่าง','ปรับพื้นดิน วางหมุดเขตแดน','ฐานรากหิน','กำแพงชั้นล่าง','ประตูไม้ + สะพานชัก','คูน้ำ + หอคอย 2 มุม','หอคอยครบ 4 มุม','ปราการบนกำแพง + ธงประจำตัว','ปราสาทหลักกลางลาน','หลังคายอดแหลม + กระจกสี','ธงยอดสูงสุด + พลุฉลอง'];
const ITEMS=[
 {id:'out_knight',name:'ชุดอัศวิน',type:'outfit',price:50,lock:0},
 {id:'out_wizard',name:'ชุดนักเวท',type:'outfit',price:50,lock:0},
 {id:'out_princess',name:'ชุดเจ้าหญิง',type:'outfit',price:50,lock:0},
 {id:'pet_cat',name:'แมวเหมียว',type:'pet',price:20,lock:0},
 {id:'pet_owl',name:'นกฮูก',type:'pet',price:30,lock:0},
 {id:'pet_dragon',name:'มังกรน้อย',type:'pet',price:120,lock:6},
 {id:'flag_red',name:'ธงสีแดง',type:'flag',price:20,lock:0},
 {id:'flag_blue',name:'ธงสีน้ำเงิน',type:'flag',price:20,lock:0},
 {id:'flag_green',name:'ธงสีเขียว',type:'flag',price:20,lock:0},
 {id:'dec_fountain',name:'น้ำพุ',type:'decor',price:50,lock:3},
 {id:'dec_lamp',name:'โคมไฟหน้าประตู',type:'decor',price:30,lock:4},
 {id:'dec_guard',name:'ทหารเฝ้าประตู',type:'decor',price:50,lock:4},
 {id:'dec_cart_wood',name:'รถม้าไม้',type:'decor',price:50,lock:3},
 {id:'dec_cart_lux',name:'รถม้าทอง-เงินหรูหรา',type:'decor',price:150,lock:7},
 {id:'dec_tree',name:'ต้นไม้ใหญ่ให้ร่มเงา',type:'decor',price:40,lock:2},
 {id:'dec_cannon',name:'ปืนใหญ่ป้องกันปราสาท',type:'decor',price:60,lock:5},
 {id:'dec_dragon',name:'มังกรเฝ้าหอคอย',type:'decor',price:120,lock:6},
];
const TYPE={outfit:'ชุดตัวละคร',pet:'สัตว์เลี้ยง',flag:'ธง',decor:'ตกแต่งปราสาท'};
const item=id=>ITEMS.find(i=>i.id===id);
const tier=p=>p<=20?'ถูก':p<=50?'กลาง':'หายาก';
const LEVELS=['ม.1','ม.2','ม.3','ม.4','ม.5','ม.6'];
const STICKERS=['ปราสาทสวยมาก!','ชอบสวนดอกไม้','สู้ ๆ นะ','ธงเท่มาก'];

const defaultCats=()=>[{name:'คะแนนเก็บ',max:50,visible:true,castle:true},{name:'สอบกลางภาค',max:20,visible:true,castle:true},{name:'สอบปลายภาค',max:30,visible:false,castle:false}];
const EMPTY_SUB={id:'__none',settings:{subject:'',code:'',level:'ม.4',term:SCHOOL.term,pass:50,tradeLimit:3,villageMode:'full',cats:defaultCats()},rooms:[],quests:[],claims:[],trades:[],village:{},teacherUids:[]};
const S={students:[],subjects:[],subId:'__none',user:null,tab:null,apView:'room',apStudent:null,room:null,sort:'no',modal:null,toast:null,
 boot:CONFIGURED?'loading':'noconfig',bootMsg:'',me:null,teachers:[],personal:false,
 adm:{level:'ม.4',room:null,imp:null,cardLevel:'ม.4',cardRooms:[],addOpen:false}};
const SUBKEYS=['settings','rooms','quests','claims','trades','village'];
SUBKEYS.forEach(k=>Object.defineProperty(S,k,{get(){return curSub()[k]},set(v){curSub()[k]=v}}));
function curSub(){return S.subjects.find(x=>x.id===S.subId)||EMPTY_SUB}
const STKEYS=['scores','coins','inv','eq','special','stickers','seenStage'];
const blankProg=()=>({scores:{},coins:0,inv:[],eq:{outfit:null,pet:null,flag:null,decor:[]},special:[],stickers:0,seenStage:null});
function slot(st){return st.bySub[S.subId]||(st.bySub[S.subId]=blankProg())}
function newStudent(id,no,name,room){const st={id,no,name,room,bySub:{},pubBy:{}};STKEYS.forEach(k=>Object.defineProperty(st,k,{get(){return slot(st)[k]},set(v){slot(st)[k]=v},enumerable:true}));S.students.push(st);return st}
function upsertStudent(id,d){let st=S.students.find(s=>s.id===id);if(!st)st=newStudent(id,d.no||0,d.name||'',d.room||'');
 Object.assign(st,{no:+d.no||0,name:d.name||'',room:d.room||'',prefix:d.prefix||'',last:d.last||'',active:d.active!==false,uid:d.uid||null,cardVer:d.cardVer||0});return st}
const enrolled=st=>st.active===false?[]:S.subjects.filter(x=>x.rooms.includes(st.room));
function useSubject(id){S.subId=id;if(!S.rooms.includes(S.room))S.room=S.rooms[0]||null;S.modal=null}
function normProg(d){return {scores:d.scores||{},special:d.special||[],coins:d.coins||0,inv:d.inv||[],eq:Object.assign({outfit:null,pet:null,flag:null,decor:[]},d.eq||{}),stickers:0,seenStage:null}}
function subFromDoc(id,d){return {id,settings:Object.assign({},EMPTY_SUB.settings,{cats:defaultCats()},d.settings||{}),rooms:d.rooms||[],quests:[],claims:[],trades:[],village:d.village||{},teacherUids:d.teacherUids||[],_prog:new Set()}}
const newId=p=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,6);

/* ---------- logic ---------- */
function today(){return new Date().toISOString().slice(0,10)}
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const stu=id=>S.students.find(s=>s.id===id);
const ACT=()=>S.students.filter(s=>s.active!==false);
const quest=id=>S.quests.find(q=>q.id===id);
const cats=()=>S.settings.cats;
const castleMax=()=>cats().reduce((a,c)=>a+(c.castle?Number(c.max)||0:0),0);
const hiddenMax=()=>cats().reduce((a,c)=>a+(!c.castle?Number(c.max)||0:0),0);
function catScore(st,i){return S.quests.filter(q=>q.cat===i).reduce((a,q)=>a+Math.min(q.points,st.scores[q.id]||0),0)}
function scoreOf(st){return cats().reduce((a,c,i)=>a+(c.castle?catScore(st,i):0),0)}
function stageInfo(st){
 const max=castleMax(),sc=scoreOf(st),pct=max?Math.min(1,sc/max):0;
 let stage=Math.min(10,Math.floor(pct*10+1e-9));const frac=stage>=10?0:pct*10-stage;
 const nextAt=stage>=10?null:Math.ceil((stage+1)*max/10);
 return {sc,max,pct,stage,frac,toNext:nextAt==null?0:Math.max(0,nextAt-sc)};
}
function risk(st){
 const have=scoreOf(st),pass=S.settings.pass,fin=hiddenMax();
 if(have>=pass)return {k:'good',label:'ปลอดภัย',detail:'มีคะแนนถึงเกณฑ์ผ่านแล้ว'};
 const need=pass-have;
 if(need>fin)return {k:'crit',label:'เสี่ยงติด 0',detail:`ได้ปลายภาคเต็ม ${fin} ก็ยังขาด ${need-fin} คะแนน`};
 return {k:'warn',label:`ต้องได้ปลายภาค ${need}/${fin}`,detail:`ต้องได้ปลายภาคอย่างน้อย ${need} จาก ${fin} คะแนน`};
}
const pendingClaim=(sid,qid)=>S.claims.some(c=>c.sid===sid&&c.qid===qid&&c.status==='pending');
const inTrade=(sid,iid)=>S.trades.some(t=>t.status==='pending'&&((t.from===sid&&t.give===iid)||(t.to===sid&&t.get===iid)));
const tradable=st=>st.inv.filter(i=>item(i).lock===0&&!inTrade(st.id,i));
function villageOpen(room){const v=S.village[room];if(!v)return null;if(v.until<=Date.now()){delete S.village[room];return null}return v}
const daysLeft=v=>{const ms=v.until-Date.now();const d=Math.floor(ms/864e5),h=Math.floor(ms%864e5/36e5);return d>0?`${d} วัน ${h} ชม.`:`${h} ชม.`};

/* ---------- drawing: academic cute 3D (soft clay shading, gloss, soft outline, drop shadow) ---------- */
const OL='var(--outline)';
function so(tag,attrs,fill,o={}){const sw=o.sw??.9;const st=o.ol===false?'':` stroke="${OL}" stroke-opacity=".45" stroke-width="${sw}" stroke-linejoin="round"`;const sh=o.shine===false?'':`<${tag} ${attrs} fill="url(#${o.g||'gGloss'})"/>`;return `<${tag} ${attrs} fill="${fill}"${st}/>${sh}`}
const blob=(cx,cy,rx,ry,op=.22)=>`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#1b2838" opacity="${op}" filter="url(#fBlur)"/>`;
const spark=(x,y,r=1.2)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity=".9"/>`;
function eyes(y,big=1){return [-3.8,3.8].map(x=>`<ellipse cx="${x}" cy="${y}" rx="${1.9*big}" ry="${2.5*big}" fill="var(--ink)"/>${spark(x+.6,y-1,.8*big)}${spark(x-.5,y+.9,.35*big)}`).join('')+`<ellipse cx="-6.4" cy="${y+3.4}" rx="2.2" ry="1.3" fill="var(--crit)" opacity=".28"/><ellipse cx="6.4" cy="${y+3.4}" rx="2.2" ry="1.3" fill="var(--crit)" opacity=".28"/><path d="M-1.8 ${y+3.6} q1.8 1.6 3.6 0" stroke="var(--ink)" stroke-width="1" fill="none" stroke-linecap="round"/>`}
function head(o){let s=so('circle','cx="0" cy="-35" r="10.5"','url(#gSkin)',{g:'gGlossSoft'});
 if(o!=='out_knight'&&o!=='guard')s+=so('path','d="M-11 -35 a11 11 0 0 1 22 0 q-3 -5 -9 -4 q-2 3 -6 2 q-4 0 -7 2 z"','var(--hair)',{sw:.7});
 if(o==='out_princess')s+=so('path','d="M-11 -36 q-2 10 1 15 l3 -1 q-2 -6 -1 -13z M11 -36 q2 10 -1 15 l-3 -1 q2 -6 1 -13z"','var(--hair)',{sw:.6});
 return s+eyes(-33);}
function pChar(o,guard){
 if(guard)o='guard';
 let s=blob(0,0,11,2.6,.3);
 s+=so('ellipse','cx="-3.6" cy="-1.8" rx="3.4" ry="2.1"','var(--ink)')+so('ellipse','cx="3.6" cy="-1.8" rx="3.4" ry="2.1"','var(--ink)');
 s+=so('rect','x="-5.6" y="-10" width="4.4" height="8.5" rx="2"','var(--navy)',{shine:false})+so('rect','x="1.2" y="-10" width="4.4" height="8.5" rx="2"','var(--navy)',{shine:false});
 if(o==='out_knight'){s+=so('rect','x="-9" y="-26" width="18" height="17" rx="7"','url(#gSteel)')+so('circle','cx="0" cy="-18" r="3"','url(#gGold)',{sw:.6})+so('rect','x="11" y="-36" width="2.6" height="26" rx="1.2"','url(#gSteel)',{sw:.6})+so('rect','x="8.3" y="-11" width="8" height="2.6" rx="1.2"','url(#gGold)',{sw:.6})}
 else if(o==='out_wizard'){s+=so('path','d="M-8 -26 Q-12 -10 -11 -3 H11 Q12 -10 8 -26 Z"','var(--robe-wiz)')+`<path d="M-11 -4 H11" stroke="var(--accent)" stroke-width="1.6"/>`+so('rect','x="8" y="-20" width="8" height="10" rx="1.5"','var(--primary)',{sw:.6})+`<rect x="9.3" y="-19" width="5.4" height="8" rx="1" fill="var(--shirt)"/>`}
 else if(o==='out_princess'){s+=so('path','d="M-6 -26 H6 Q8 -16 14 -4 Q0 0 -14 -4 Q-8 -16 -6 -26 Z"','var(--robe-prin)')+`<path d="M-13 -5 Q0 -1 13 -5" stroke="#fff" stroke-width="1.4" opacity=".7" fill="none"/>`}
 else if(o==='guard'){s+=so('rect','x="-9" y="-26" width="18" height="17" rx="6"','var(--crit)')+`<path d="M0 -26 V-10" stroke="var(--accent)" stroke-width="1.2"/>`+so('rect','x="11" y="-54" width="2.2" height="54" rx="1"','url(#gWood)',{sw:.5,shine:false})+so('polygon','points="9.5,-54 12.1,-61 14.7,-54"','url(#gSteel)',{sw:.5})}
 else {s+=so('rect','x="-9" y="-26" width="18" height="16" rx="7"','var(--shirt)')+so('rect','x="-9" y="-14" width="18" height="5" rx="2"','var(--navy)',{shine:false})+so('polygon','points="-1.6,-25 1.6,-25 1,-17 0,-15.5 -1,-17"','var(--crit)',{sw:.4,shine:false})}
 s+=so('circle','cx="-10" cy="-15" r="2.6"','url(#gSkin)',{sw:.5,shine:false})+so('circle','cx="10" cy="-15" r="2.6"','url(#gSkin)',{sw:.5,shine:false});
 s+=head(o);
 if(o==='out_knight')s+=so('path','d="M-11 -35 a11 11 0 0 1 22 0 v2 h-22z"','url(#gSteel)')+`<rect x="-1.2" y="-52" width="2.4" height="8" rx="1" fill="var(--crit)"/>`;
 if(o==='guard')s+=so('rect','x="-8.5" y="-56" width="17" height="15" rx="4"','var(--ink)')+`<rect x="-8.5" y="-45" width="17" height="2.4" fill="var(--accent)"/>`;
 if(o==='out_wizard')s+=so('ellipse','cx="0" cy="-42" rx="14" ry="3.4"','var(--robe-wiz)')+so('path','d="M-9 -42 Q-3 -54 2 -66 Q4 -54 9 -42 Z"','var(--robe-wiz)')+so('polygon','points="1,-55 2.3,-52.4 5,-52 3,-50.2 3.5,-47.5 1,-48.8 -1.5,-47.5 -1,-50.2 -3,-52 -.3,-52.4"','url(#gGold)',{sw:.4,shine:false});
 if(o==='out_princess')s+=so('path','d="M-7 -44 L-6.5 -50 L-3 -46.5 L0 -52 L3 -46.5 L6.5 -50 L7 -44 Z"','url(#gGold)',{sw:.6})+`<circle cx="0" cy="-47.5" r="1.4" fill="var(--crit)"/>${spark(-.4,-48,.5)}`;
 return s;
}
function gradCap(k=1){return `<g transform="scale(${k})">${so('path','d="M-6 -2 v-4 h12 v4 q-6 3 -12 0z"','var(--ink)',{sw:.5})}${so('polygon','points="0,-11 13,-6.5 0,-2 -13,-6.5"','var(--ink)',{sw:.5})}<path d="M0 -6.5 L9 -4 V3" stroke="var(--accent)" stroke-width="1.1" fill="none"/>${so('circle','cx="9" cy="3.4" r="1.6"','url(#gGold)',{sw:.4,shine:false})}</g>`}
function pPet(p){
 if(p==='pet_cat')return blob(2,0,11,2.4,.28)+`<path d="M-8 -5 q-8 -3 -5 -12" stroke="var(--fur)" stroke-width="3.2" fill="none" stroke-linecap="round"/>`+so('ellipse','cx="0" cy="-5.5" rx="9" ry="5.8"','var(--fur)')+so('polygon','points="3,-16 4.5,-24 9,-18"','var(--fur)',{sw:.6,shine:false})+so('polygon','points="10,-18 14.5,-24 15,-15"','var(--fur)',{sw:.6,shine:false})+`<polygon points="4.6,-17.5 5.4,-21.5 7.6,-18.5" fill="var(--robe-prin)"/>`+so('circle','cx="9" cy="-13" r="7"','var(--fur)')+[6.4,11.6].map(x=>`<ellipse cx="${x}" cy="-13" rx="1.6" ry="2.1" fill="var(--ink)"/>${spark(x+.5,-13.8,.6)}`).join('')+`<ellipse cx="9" cy="-10.4" rx="1.1" ry=".7" fill="var(--robe-prin)"/>`;
 if(p==='pet_owl')return blob(0,0,9,2.2,.28)+so('ellipse','cx="0" cy="-11" rx="9" ry="11"','var(--wood)')+`<ellipse cx="0" cy="-7.5" rx="5.6" ry="6.6" fill="var(--wood-l)"/>`+so('circle','cx="-3.8" cy="-15" r="3.8"','#fff',{sw:.6,shine:false})+so('circle','cx="3.8" cy="-15" r="3.8"','#fff',{sw:.6,shine:false})+`<circle cx="-3.5" cy="-15" r="2" fill="var(--ink)"/><circle cx="4.1" cy="-15" r="2" fill="var(--ink)"/>${spark(-2.9,-15.8,.7)}${spark(4.7,-15.8,.7)}<polygon points="-1.4,-11.6 1.4,-11.6 0,-9" fill="var(--accent)"/><g transform="translate(0 -20)">${gradCap(.62)}</g>`;
 if(p==='pet_dragon')return pDragon(.75);
 return '';
}
function pDragon(k=1){return `<g transform="scale(${k})">${blob(0,0,13,2.6,.28)}<path d="M-10 -6 q-10 3 -13 -7" stroke="var(--grass)" stroke-width="4.4" fill="none" stroke-linecap="round"/>${so('path','d="M-3 -14 Q-12 -32 -19 -24 Q-14 -22 -15 -17 Q-10 -18 -7 -10Z"','var(--grass-d)',{sw:.7})}${so('ellipse','cx="0" cy="-8" rx="11" ry="8"','var(--grass)')}<ellipse cx="2" cy="-5" rx="6.4" ry="4" fill="var(--grass-l)"/>${so('circle','cx="11" cy="-18" r="7.5"','var(--grass)')}${so('path','d="M8 -24 q0 -5 2 -6 q0 4 1.6 6z M13.5 -24.5 q1 -5 3 -5.5 q-.6 4 .4 6z"','url(#gGold)',{sw:.4,shine:false})}<ellipse cx="13.4" cy="-18.6" rx="2" ry="2.6" fill="var(--ink)"/>${spark(14,-19.6,.8)}<ellipse cx="15.8" cy="-15" rx="1.8" ry="1" fill="var(--crit)" opacity=".3"/></g>`}
function pFlag(c){return so('rect','x="-1.3" y="-28" width="2.6" height="28" rx="1.2"','url(#gWood)',{sw:.5,shine:false})+so('circle','cx="0" cy="-29.5" r="2.6"','url(#gGold)',{sw:.5})+so('path','d="M1.3 -27 Q9 -29 20 -24 Q11 -19.5 1.3 -16 Z"',c,{sw:.7})+`<g transform="translate(9.5 -22.5) scale(.55)"><path d="M-6 -3 Q-3 -4.5 0 -3 V3 Q-3 1.5 -6 3Z M6 -3 Q3 -4.5 0 -3 V3 Q3 1.5 6 3Z" fill="var(--accent-l)"/></g>`}
const flagColor=f=>({flag_red:'var(--crit)',flag_blue:'var(--primary)',flag_green:'var(--grass-d)'}[f]||'var(--accent)');
function books(){const cs=['var(--crit)','var(--primary)','var(--grass-d)'];return cs.map((c,i)=>{const y=-5-i*5,w=20-i*3,x=-w/2+(i%2?1.5:-1);return so('rect',`x="${x}" y="${y}" width="${w}" height="5" rx="1.2"`,c,{sw:.5})+`<rect x="${x+w-3}" y="${y+1}" width="2.4" height="3" fill="#fff" opacity=".85"/>`}).join('')}
function pCart(lux){const body=lux?'url(#gSteel)':'url(#gWood)',trim=lux?'url(#gGold)':'var(--wood-d)',horse=lux?'#f4f1ec':'var(--wood)';
 let s=blob(0,1,34,3,.28);
 s+=so('ellipse','cx="20" cy="-14" rx="10" ry="6.5"',horse)+[13,17,23,27].map(x=>so('rect',`x="${x-1.2}" y="-10" width="2.4" height="10" rx="1"`,horse,{sw:.4,shine:false})).join('');
 s+=so('path','d="M27 -17 q4 -6 3 -12 l5 0 q2 4 0 8 q-2 5 -6 6z"',horse,{sw:.6})+`<circle cx="32" cy="-25" r="1" fill="var(--ink)"/>`+so('path','d="M29 -30 l1 -4 l2 3z"',horse,{sw:.4,shine:false})+`<path d="M27 -28 q-3 4 -1 9" stroke="${lux?'var(--accent)':'var(--wood-d)'}" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M10 -15 q-4 2 -3 8" stroke="${lux?'var(--accent)':'var(--wood-d)'}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
 if(lux)s+=`<path d="M12 -14 h16" stroke="var(--accent)" stroke-width="1.4"/>`;
 s+=`<path d="M3 -12 H12" stroke="var(--wood-d)" stroke-width="1.4"/>`;
 s+=lux?so('ellipse','cx="-12" cy="-18" rx="14" ry="12"',body)+so('rect','x="-17" y="-24" width="9" height="9" rx="3"','url(#gWin)',{sw:.5,shine:false})+`<path d="M-26 -14 Q-12 -9 2 -14" stroke="var(--accent)" stroke-width="1.6" fill="none"/>`+so('path','d="M-17 -30 l1 -5 l3 3 l1 -5 l1 5 l3 -3 l1 5z"',trim,{sw:.4})
  :so('rect','x="-26" y="-28" width="26" height="20" rx="3"',body)+so('rect','x="-28" y="-31" width="30" height="4" rx="2"','var(--wood-d)',{sw:.5,shine:false})+so('rect','x="-20" y="-24" width="9" height="8" rx="1.5"','url(#gWin)',{sw:.5,shine:false});
 [[-20,-6],[-4,-6]].forEach(([x,y])=>{s+=`<circle cx="${x}" cy="${y}" r="6" fill="none" stroke="${lux?'var(--accent)':'var(--wood-d)'}" stroke-width="2"/><path d="M${x-6} ${y} h12 M${x} ${y-6} v12" stroke="${lux?'var(--accent)':'var(--wood-d)'}" stroke-width="1"/><circle cx="${x}" cy="${y}" r="1.4" fill="${lux?'var(--accent)':'var(--wood-d)'}"/>`});
 return s}
function pTree(){let s=blob(0,1,22,4,.3)+so('path','d="M-4 0 Q-3 -16 -5 -30 H5 Q3 -16 4 0 Z"','url(#gWood)',{sw:.6})+`<path d="M-1 -22 q-6 -4 -9 -10 M1 -24 q6 -3 9 -9" stroke="var(--wood)" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
 [[-12,-36,13],[12,-38,12],[0,-50,15],[-4,-40,13],[8,-48,10]].forEach(([x,y,r])=>{s+=so('circle',`cx="${x}" cy="${y}" r="${r}"`,'var(--grass)',{sw:.6})});
 [[-8,-46],[6,-36],[2,-56],[-14,-34]].forEach(([x,y])=>{s+=`<circle cx="${x}" cy="${y}" r="2" fill="var(--crit)"/>${spark(x-.6,y-.6,.5)}`});return s}
function pCannon(){let s=blob(0,1,20,2.6,.3)+so('rect','x="-14" y="-12" width="20" height="8" rx="2"','url(#gWood)',{sw:.6})+so('path','d="M-12 -16 L16 -22 L17 -14 L-11 -9 Z"','#3a3f48',{sw:.6})+so('ellipse','cx="16.5" cy="-18" rx="2.6" ry="4.6"','#2a2e35',{sw:.5,shine:false})+so('circle','cx="-13" cy="-12.5" r="3"','#3a3f48',{sw:.5});
 s+=`<circle cx="-6" cy="-4" r="6" fill="none" stroke="var(--wood-d)" stroke-width="2"/><path d="M-12 -4 h12 M-6 -10 v12" stroke="var(--wood-d)" stroke-width="1"/>`;
 [[-22,-3],[-18,-3],[-20,-6.6]].forEach(([x,y])=>{s+=so('circle',`cx="${x}" cy="${y}" r="2.4"`,'#2a2e35',{sw:.4})});return s}
function pDecor(d){
 if(d==='dec_tree')return pTree();
 if(d==='dec_cannon')return pCannon();
 if(d==='dec_cart_wood')return pCart(false);
 if(d==='dec_cart_lux')return pCart(true);
 if(d==='dec_garden'){const cs=['var(--crit)','var(--accent)','var(--robe-prin)','var(--robe-wiz)','#fff','var(--accent)'];let s=blob(0,1,28,3,.25)+so('rect','x="-26" y="-6" width="52" height="7" rx="2"','url(#gWood)',{shine:false})+so('path','d="M-25 -6 q3 -6 8 -4 q4 -6 9 -3 q5 -6 9 -2 q5 -6 9 -2 q5 -5 7 1 z"','var(--grass-d)',{sw:.5});
  for(let i=0;i<6;i++){const x=-20+i*8,y=-12-(i%2)*3;for(let k=0;k<5;k++){const a=k*1.2566;s+=`<circle cx="${x+Math.cos(a)*2.5}" cy="${y+Math.sin(a)*2.5}" r="2" fill="${cs[i]}"/>`}s+=`<circle cx="${x}" cy="${y}" r="1.4" fill="var(--accent-l)"/>${spark(x-1.2,y-1.6,.5)}`}return s}
 if(d==='dec_fountain')return blob(0,0,19,3)+so('path','d="M-17 -7 V-2 Q0 4 17 -2 V-7 Z"','url(#gMarble)',{shine:false})+so('ellipse','cx="0" cy="-7" rx="17" ry="4.4"','var(--stone-l)',{shine:false})+`<ellipse cx="0" cy="-7" rx="14" ry="3" fill="url(#gWater)"/>`+so('rect','x="-2.4" y="-22" width="4.8" height="15" rx="1.5"','url(#gMarble)',{sw:.5,shine:false})+so('ellipse','cx="0" cy="-22" rx="8" ry="2.4"','var(--stone-l)',{sw:.5,shine:false})+`<path d="M0 -26 q-12 -7 -13 18 M0 -26 q12 -7 13 18" stroke="var(--water-l)" stroke-width="2" fill="none" stroke-linecap="round" opacity=".9"/><circle cx="0" cy="-28" r="2.2" fill="var(--water-l)"/>${spark(-.6,-28.6,.6)}`;
 if(d==='dec_lamp')return blob(0,0,5,1.6)+so('rect','x="-1.4" y="-22" width="2.8" height="22" rx="1"','var(--ink)',{sw:.4})+`<circle cx="0" cy="-26" r="11" fill="url(#gGlow)"/>`+so('path','d="M-4 -22 h8 l1.4 -8 h-10.8z"','url(#gGold)',{sw:.6})+so('polygon','points="-6,-30 0,-35 6,-30"','var(--ink)',{sw:.4})+`<rect x="-2" y="-28.6" width="4" height="5.4" rx="1" fill="#fff" opacity=".7"/>`;
 if(d==='dec_guard')return pChar(null,true);
 if(d==='dec_dragon')return pDragon(1.15);
 return '';
}
function iconSVG(id){return `<span class="icon" data-item="${id}">${iconSVG0(id)}</span>`}
function iconSVG0(id){
 const it=item(id);let inner='',vb='-28 -70 56 74';
 if(it.type==='outfit')inner=pChar(id);
 if(it.type==='pet'){inner=pPet(id);vb=id==='pet_dragon'?'-22 -32 46 36':id==='pet_owl'?'-18 -36 36 40':'-18 -27 38 30'}
 if(it.type==='flag'){inner=pFlag(flagColor(id));vb='-10 -36 38 40'}
 if(it.type==='decor'){inner=pDecor(id);vb=id.startsWith('dec_cart')?'-36 -40 76 44':id==='dec_tree'?'-30 -68 60 72':id==='dec_cannon'?'-26 -28 46 32':id==='dec_garden'?'-32 -26 64 30':id==='dec_guard'?'-28 -66 56 70':id==='dec_dragon'?'-26 -40 54 44':'-24 -42 48 46'}
 return `<svg viewBox="${vb}" aria-hidden="true">${inner}</svg>`;
}
function cyl(x,y,w,h,ring=true){let s=`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#pBrick)"/><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#gCylShade)" stroke="${OL}" stroke-opacity=".45" stroke-width=".9"/>`;
 s+=`<path d="M${x} ${y+h} a${w/2} ${w/6} 0 0 0 ${w} 0" fill="var(--stone-d)" stroke="${OL}" stroke-opacity=".45" stroke-width=".9"/>`;
 if(ring)s+=so('rect',`x="${x-1.5}" y="${y+3}" width="${w+3}" height="3.4" rx="1.7"`,'url(#gCylShade2)',{sw:.6,shine:false});
 return s+so('ellipse',`cx="${x+w/2}" cy="${y}" rx="${w/2}" ry="${w/6}"`,'var(--stone-l)',{shine:false,sw:.8});}
function cone(cx,y,w,h){const L=cx-w/2-4,R=cx+w/2+4;return so('ellipse',`cx="${cx}" cy="${y}" rx="${w/2+4}" ry="${w/6+1}"`,'var(--primary-d)',{shine:false,sw:.7})+`<path d="M${L} ${y} Q${cx} ${y+w/5} ${R} ${y} L${cx} ${y-h} Z" fill="url(#pShingle)"/><path d="M${L} ${y} Q${cx} ${y+w/5} ${R} ${y} L${cx} ${y-h} Z" fill="url(#gConeShade)" stroke="${OL}" stroke-opacity=".45" stroke-width=".9"/><path d="M${cx-w/4} ${y-2} L${cx-1.5} ${y-h+5}" stroke="#fff" stroke-width="2.4" opacity=".45" stroke-linecap="round"/>`+so('circle',`cx="${cx}" cy="${y-h-1.5}" r="2.4"`,'url(#gGold)',{sw:.5})}
function win(x,y,stain){return so('path',`d="M${x-1} ${y+13} V${y+4} a4.5 4.5 0 0 1 9 0 V${y+13} Z"`,'var(--stone-l)',{sw:.6,shine:false})+`<path d="M${x} ${y+12} V${y+4.5} a3.5 3.5 0 0 1 7 0 V${y+12} Z" fill="${stain?'url(#gStain)':'url(#gWin)'}"/><path d="M${x+3.5} ${y+1.5} V${y+12} M${x} ${y+7} H${x+7}" stroke="var(--wood-d)" stroke-width=".7"/>${spark(x+1.8,y+4.5,.7)}`}
function scaffold(n,frac){
 const B={1:[66,150,188,24],2:[66,154,188,20],3:[76,110,168,52],4:[140,128,40,34],5:[56,80,40,84],6:[96,84,128,42],7:[76,102,168,18],8:[124,54,84,68],9:[116,22,90,44],10:[138,-12,46,40]}[n];
 if(!B)return '';const [x,y,w,h]=B;let s=`<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="var(--accent-l)" fill-opacity=".18" stroke="var(--wood)" stroke-dasharray="4 3"/>`;
 s+=so('rect',`x="${x-2}" y="${y}" width="4" height="${h}" rx="1.5"`,'url(#gWood)',{sw:.5,shine:false})+so('rect',`x="${x+w-2}" y="${y}" width="4" height="${h}" rx="1.5"`,'url(#gWood)',{sw:.5,shine:false});
 const planks=Math.max(1,Math.ceil(frac*4));for(let i=1;i<=planks;i++){const py=y+h-i*h/5;s+=so('rect',`x="${x-4}" y="${py-2}" width="${w+8}" height="4" rx="1.5"`,'url(#gWood)',{sw:.5,shine:false})}
 s+=`<g transform="translate(${x+w-9} ${y+h-h/5*Math.min(planks,4)-2}) scale(.52)">${pChar(null)}<g transform="translate(0 -44)">${so('path','d="M-11 0 a11 9 0 0 1 22 0z"','var(--accent)')}</g></g>`;
 return s+'</g>';
}
function castleSVG(stage,frac,eq,label){
 eq=eq||{decor:[]};const D=eq.decor||[];const fc=flagColor(eq.flag);
 let s=`<svg class="castle" viewBox="0 -14 320 246" role="img" aria-label="${esc(label||'ปราสาทขั้น '+stage)}">`;
 s+=`<rect y="-14" width="320" height="246" fill="url(#gSky)"/><circle cx="276" cy="38" r="30" fill="url(#gGlow)"/>${so('circle','cx="276" cy="38" r="11.5"','url(#gGold)',{ol:false})}`;
 [[58,46,1],[196,26,.8],[300,92,.6]].forEach(([x,y,k])=>{s+=`<g transform="translate(${x} ${y}) scale(${k})"><ellipse cx="0" cy="2" rx="23" ry="8" fill="url(#gCloud)"/><circle cx="-9" cy="-3" r="9" fill="url(#gCloud)"/><circle cx="6" cy="-7" r="11" fill="url(#gCloud)"/></g>`});
 s+=`<ellipse cx="40" cy="150" rx="70" ry="16" fill="var(--grass-d)" opacity=".18"/><ellipse cx="290" cy="146" rx="80" ry="18" fill="var(--grass-d)" opacity=".16"/>`;
 s+=`<path d="M4 182 A156 30 0 0 0 316 182 V200 A156 30 0 0 1 4 200 Z" fill="url(#gDirt)" stroke="${OL}" stroke-opacity=".4" stroke-width=".9"/><path d="M8 194 A154 28 0 0 0 312 194" stroke="var(--wood-d)" stroke-width="1.4" fill="none" opacity=".35"/>`;
 [[60,219,4],[150,224,3],[244,220,3.6]].forEach(([x,y,r])=>{s+=so('ellipse',`cx="${x}" cy="${y}" rx="${r+1.5}" ry="${r}"`,'var(--stone)',{sw:.5})});
 s+=`<ellipse cx="160" cy="182" rx="156" ry="30" fill="url(#gGrass)" stroke="${OL}" stroke-opacity=".4" stroke-width=".9"/><path d="M14 176 A150 26 0 0 1 306 176" stroke="#f1dcba" stroke-width="2" fill="none" opacity=".7"/>`;
 [[28,190],[300,186],[90,204],[200,207],[268,196]].forEach(([x,y])=>{s+=`<path d="M${x-3} ${y} l1.2 -2 l3 -.6 l1.8 2.6z" fill="#a98157" opacity=".7"/>`});
 if(stage>=2)s+=blob(160,175,104,10,.28);
 s+=`<g filter="url(#fSoft)">`;
 if(stage>=5)s+=`<ellipse cx="160" cy="180" rx="112" ry="11" fill="url(#gWater)" stroke="${OL}" stroke-opacity=".4" stroke-width=".9"/><path d="M66 184 q10 3 20 0 M224 185 q10 3 20 0 M104 188 q6 2 12 0" stroke="#fff" stroke-width="1.4" fill="none" opacity=".7" stroke-linecap="round"/>`;
 if(stage>=8){s+=`<polygon points="192,64 206,57 206,116 192,122" fill="url(#pBrick)"/><polygon points="192,64 206,57 206,116 192,122" fill="#000" fill-opacity=".28" stroke="${OL}" stroke-opacity=".45" stroke-width=".9"/>`+so('polygon','points="128,64 142,57 206,57 192,64"','var(--stone-l)',{shine:false})+`<rect x="128" y="64" width="64" height="58" fill="url(#pBrick)"/><rect x="128" y="64" width="64" height="58" fill="url(#gWallShade)" stroke="${OL}" stroke-opacity=".45" stroke-width=".9"/>`+so('rect','x="126" y="63" width="68" height="4" rx="2"','var(--stone-l)',{sw:.6,shine:false})+win(136,86,stage>=9)+win(177,86,stage>=9);
  s+=so('circle','cx="160" cy="80" r="9.5"','url(#gGold)',{sw:.7})+`<circle cx="160" cy="80" r="7.4" fill="var(--shirt)"/><path d="M160 80 V75 M160 80 L164 82" stroke="var(--ink)" stroke-width="1.2" stroke-linecap="round"/>${[0,1,2,3].map(i=>`<circle cx="${160+Math.cos(i*Math.PI/2)*5.8}" cy="${80+Math.sin(i*Math.PI/2)*5.8}" r=".7" fill="var(--ink)"/>`).join('')}${spark(157,77,1)}`}
 if(stage>=9)s+=`<polygon points="192,64 206,57 167,26" fill="var(--primary-d)" stroke="${OL}" stroke-opacity=".45" stroke-width=".9"/><polygon points="122,64 198,64 162,28" fill="url(#pShingle)"/><polygon points="122,64 198,64 162,28" fill="url(#gConeShade)" stroke="${OL}" stroke-opacity=".45" stroke-width=".9"/><path d="M138 60 L156 36" stroke="#fff" stroke-width="2.6" opacity=".4" stroke-linecap="round"/>`;
 if(stage>=6){s+=cyl(98,92,20,32)+cyl(202,92,20,32);if(stage>=9)s+=cone(108,92,20,22)+cone(212,92,20,22)}
 if(stage===1)s+=`<path d="M70 168 L250 168" stroke="var(--wood-l)" stroke-width="1.4" stroke-dasharray="5 3"/>`+[70,110,150,190,230,250].map(x=>so('rect',`x="${x-2}" y="157" width="4" height="15" rx="1.5"`,'url(#gWood)',{sw:.5,shine:false})+`<polygon points="${x-2},172 ${x+2},172 ${x},176" fill="var(--wood-d)"/>`).join('');
 if(stage>=2){s+=so('rect','x="68" y="158" width="184" height="16" rx="6"','var(--stone-d)',{g:'gGlossSoft'});for(let x=72;x<250;x+=15)s+=so('ellipse',`cx="${x+6}" cy="${x%2?164:167}" rx="6.6" ry="4.2"`,'var(--stone)',{sw:.4})}
 if(stage>=3){s+=so('polygon','points="84,114 236,114 242,120 78,120"','var(--stone-l)',{shine:false,sw:.7})+`<rect x="78" y="120" width="164" height="40" fill="url(#pBrick)"/><rect x="78" y="120" width="164" height="40" fill="url(#gWallShade)" stroke="${OL}" stroke-opacity=".45" stroke-width=".9"/>`+so('rect','x="76" y="155" width="168" height="5" rx="2"','var(--stone-d)',{sw:.5,shine:false})}
 if(stage>=7){for(let x=78;x<242;x+=14)s+=so('rect',`x="${x}" y="106" width="9" height="10" rx="2"`,'var(--stone)',{sw:.6,g:'gGlossSoft'})+`<rect x="${x}" y="106" width="9" height="2.4" rx="1.2" fill="var(--stone-l)"/>`}
 if(stage>=4){s+=so('path','d="M140 162 V141 a20 20 0 0 1 40 0 V162 Z"','var(--stone-l)',{sw:.7,g:'gGlossSoft'})+`<path d="M145 142 l-4 -2 M150 132 l-3 -3.5 M160 128 v-4.5 M170 132 l3 -3.5 M175 142 l4 -2" stroke="var(--stone-d)" stroke-width=".9"/>`+so('path','d="M145 162 V143 a15 15 0 0 1 30 0 V162 Z"','url(#gWood)',{sw:.7});
  [151,157,163,169].forEach(x=>{s+=`<line x1="${x}" y1="130" x2="${x}" y2="162" stroke="var(--wood-d)" stroke-width=".8" opacity=".7"/>`});s+=`<rect x="145" y="140" width="30" height="2.6" fill="var(--ink)" opacity=".55"/><rect x="145" y="152" width="30" height="2.6" fill="var(--ink)" opacity=".55"/>${[148,154,166,172].map(x=>`<circle cx="${x}" cy="141.3" r=".9" fill="var(--accent-l)"/><circle cx="${x}" cy="153.3" r=".9" fill="var(--accent-l)"/>`).join('')}`+so('circle','cx="167" cy="147" r="2.4"','none',{sw:1.2,shine:false}).replace('stroke="var(--outline)" stroke-opacity=".45"','stroke="var(--accent)"');
  s+=so('polygon','points="145,162 175,162 180,187 140,187"','url(#gWood)',{sw:.7,shine:false});for(let y=166;y<187;y+=5)s+=`<line x1="${141+(y-162)/5}" y1="${y}" x2="${179-(y-162)/5}" y2="${y}" stroke="var(--wood-d)" stroke-width=".8"/>`;s+=`<path d="M146 142 L141 185 M174 142 L179 185" stroke="var(--ink)" stroke-width="1.1" stroke-dasharray="2 1.2" opacity=".8"/>`}
 if(stage>=5){[62,230].forEach(x=>{s+=cyl(x,88,28,76)+win(x+10.5,102,stage>=9)+win(x+10.5,132,false);
  if(stage>=7&&stage<9)[0,10,20].forEach(d=>{s+=so('rect',`x="${x+d}" y="80" width="8" height="9" rx="2"`,'var(--stone)',{sw:.6,g:'gGlossSoft'})})});
  if(stage>=9)s+=cone(76,88,28,32)+cone(244,88,28,32)}
 if(stage>=7)s+=`<g transform="translate(244 ${stage>=9?54:80})">${pFlag(fc)}</g>`;
 if(stage>=10)s+=`<g transform="translate(162 28)">${pFlag(fc)}</g><g transform="translate(145 10) rotate(-12)">${gradCap(1)}</g>`;
 if(stage<3){s+=`<g transform="translate(264 176)">${blob(0,0,26,4,.3)}<polygon points="22,0 34,-8 12,-34 0,-30" fill="var(--accent)" opacity=".75"/>${so('polygon','points="-22,0 22,0 0,-32"','url(#gGold)')}${so('path','d="M-6 0 Q0 -16 0 -14 Q0 -16 6 0Z"','var(--wood-d)',{sw:.5,shine:false})}</g><g transform="translate(234 182)">${blob(0,0,12,2.2,.3)}${books()}</g>`;
  s+=`<g transform="translate(40 178)">${blob(0,0,11,2.4,.3)}${so('rect','x="-2" y="-24" width="4" height="24" rx="1.5"','url(#gWood)',{sw:.5,shine:false})}${so('rect','x="-25" y="-41" width="50" height="19" rx="5"','url(#gWood)')}<text x="0" y="-28" text-anchor="middle" font-size="9.5" font-weight="600" fill="#fff" font-family="Mitr,IBM Plex Sans Thai,sans-serif">ที่ดิน</text></g>`}
 if(D.includes('dec_dragon')&&stage>=6)s+=`<g transform="translate(76 ${stage>=9?58:stage>=7?80:86})">${pDecor('dec_dragon')}</g>`;
 if(stage<10&&frac>0)s+=scaffold(stage+1,frac);
 if(D.includes('dec_tree'))s+=`<g transform="translate(306 182)">${pDecor('dec_tree')}</g>`;
 if(D.includes('dec_cannon'))s+=`<g transform="translate(196 214) scale(.8)">${pDecor('dec_cannon')}</g>`;
 if(D.includes('dec_cart_lux'))s+=`<g transform="translate(48 208) scale(.8)">${pDecor('dec_cart_lux')}</g>`;
 if(D.includes('dec_cart_wood'))s+=`<g transform="translate(${D.includes('dec_cart_lux')?44:46} ${D.includes('dec_cart_lux')?188:198}) scale(.8)">${pDecor('dec_cart_wood')}</g>`;
 if(D.includes('dec_lamp'))s+=`<g transform="translate(112 198)">${pDecor('dec_lamp')}</g><g transform="translate(208 198)">${pDecor('dec_lamp')}</g>`;
 if(D.includes('dec_fountain'))s+=`<g transform="translate(234 205)">${pDecor('dec_fountain')}</g>`;
 if(D.includes('dec_guard'))s+=`<g transform="translate(128 210) scale(.8)">${pDecor('dec_guard')}</g>`;
 if(eq.pet)s+=`<g transform="translate(262 203)">${pPet(eq.pet)}</g>`;
 s+=`<g transform="translate(288 198) scale(.92)">${pChar(eq.outfit)}</g>`;
 s+='</g>';
 if(stage>=10){[[44,74,'var(--accent)'],[296,112,'var(--crit)'],[110,30,'var(--robe-prin)']].forEach(([x,y,c],k)=>{let r='';for(let i=0;i<10;i++){const a=i*Math.PI/5;r+=`<line x1="${x+Math.cos(a)*4}" y1="${y+Math.sin(a)*4}" x2="${x+Math.cos(a)*12}" y2="${y+Math.sin(a)*12}" stroke="${c}" stroke-width="2.4" stroke-linecap="round"/><circle cx="${x+Math.cos(a)*14}" cy="${y+Math.sin(a)*14}" r="1.4" fill="${c}"/>`}s+=`<g class="burst" style="animation-delay:${k*.4}s">${r}</g>`});
  const cc=['var(--crit)','var(--accent)','var(--primary)','var(--robe-prin)','var(--grass)'];for(let i=0;i<22;i++){const x=(i*53+17)%300+10,y=(i*37+11)%120+6;s+=`<rect x="${x}" y="${y}" width="3.2" height="1.8" rx=".6" fill="${cc[i%5]}" transform="rotate(${(i*47)%180} ${x} ${y})"/>`}}
 return s+'</svg>';
}
function qrSVG(id){
 let h=0;for(const c of id+'castle')h=(h*31+c.charCodeAt(0))>>>0;
 const N=21;let s=`<svg viewBox="0 0 ${N} ${N}" shape-rendering="crispEdges" aria-hidden="true">`;
 const fin=(x,y)=>`<rect x="${x}" y="${y}" width="7" height="7" fill="#111"/><rect x="${x+1}" y="${y+1}" width="5" height="5" fill="#fff"/><rect x="${x+2}" y="${y+2}" width="3" height="3" fill="#111"/>`;
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){if((x<8&&y<8)||(x>12&&y<8)||(x<8&&y>12))continue;h=(h*1103515245+12345)>>>0;if((h>>16)&1)s+=`<rect x="${x}" y="${y}" width="1" height="1" fill="#111"/>`}
 return s+fin(0,0)+fin(14,0)+fin(0,14)+'</svg>';
}
/* ---------- real-time 3D (three.js r128): castle, characters, items ---------- */
const CK=new Map();
function castleKey(stage,frac,eq){const p=stage<10&&frac>0?Math.max(1,Math.ceil(frac*4)):0;const e=eq||{};return [stage,p,e.outfit||'',e.pet||'',e.flag||'',(e.decor||[]).slice().sort().join('+')].join('|')}
function castleView(stage,frac,eq,label,mode){const key=castleKey(stage,frac,eq);CK.set(key,{stage,frac,eq:eq||{decor:[]}});
 return `<div class="c3d ${mode}" data-key="${esc(key)}" role="img" aria-label="${esc(label||'ปราสาทขั้น '+stage)}">${castleSVG(stage,frac,eq,label)}</div>`}
const G3={state:'idle',T:null,snap:null,live:null,cache:new Map(),queue:[],busy:false,mats:new Map(),tex:{}};
function load3D(){if(G3.state!=='idle')return;G3.state='loading';if(window.THREE){G3.T=window.THREE;G3.state='ready';setTimeout(hydrate3D,0);return}
 const sc=document.createElement('script');sc.src='https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
 sc.onload=()=>{try{G3.T=window.THREE;const c=document.createElement('canvas');if(!(c.getContext('webgl')||c.getContext('experimental-webgl')))throw new Error('no webgl');G3.state='ready';hydrate3D()}catch(e){G3.state='failed';clearLoading()}};
 sc.onerror=()=>{G3.state='failed';clearLoading()};document.head.appendChild(sc)}
function clearLoading(){document.querySelectorAll('.loading3d').forEach(e=>e.remove())}
function hydrate3D(){
 if(G3.state==='idle')load3D();
 if(G3.state==='failed')return;
 const mains=[...document.querySelectorAll('.c3d.main')];
 if(G3.state!=='ready'){mains.forEach(m=>{if(!m.querySelector('.loading3d'))m.insertAdjacentHTML('beforeend','<span class="loading3d">กำลังโหลดภาพ 3 มิติ…</span>')});return}
 try{
  const live=mains[mains.length-1];
  document.querySelectorAll('.c3d').forEach(el=>{if(el===live)return;requestSnap('c:'+el.dataset.key,el,el.classList.contains('main')?2:1)});
  document.querySelectorAll('.icon[data-item]').forEach(el=>requestSnap('i:'+el.dataset.item,el,1));
  if(live)attachLive(live);else stopLive();
 }catch(e){console.error(e);G3.state='failed'}
}
/* ----- palette & materials (game-art colours, independent of page theme) ----- */
const P={grass:0x7cc95a,grassD:0x4f9a3c,dirt:0x9a6a3c,dirtD:0x6b4423,stone:0xd9d2c5,stoneD:0xa59c8e,stoneL:0xf0ebe2,roof:0x3f74c4,roofD:0x2a5290,wood:0xa06a3c,woodD:0x6e4423,water:0x58b6ea,gold:0xf2b632,ink:0x2b2f3a,skin:0xffd4b3,hair:0x4a3226,shirt:0xffffff,navy:0x2c4572,red:0xe0483f,wiz:0x8a5ad6,prin:0xf38cba,fur:0x6c6862,owl:0xa4703f,owlL:0xe9c99a,drag:0x6ccf6a,dragD:0x3e9a4a,glass:0xffd27a,pink:0xff8fa3,white:0xffffff,steel:0xc7ccd6};
function M(color,o={}){const T=G3.T;const k=color+'|'+JSON.stringify(o,(k,v)=>v&&v.uuid?v.uuid:v);if(G3.mats.has(k))return G3.mats.get(k);
 const m=new T.MeshStandardMaterial(Object.assign({color,roughness:o.rough??.62,metalness:o.metal??0},o.map?{map:o.map}:{},o.emissive?{emissive:o.emissive,emissiveIntensity:o.ei??.9}:{},o.opacity?{transparent:true,opacity:o.opacity}:{},o.side?{side:T.DoubleSide}:{},o.flat?{flatShading:true}:{}));G3.mats.set(k,m);return m}
function canvasTex(w,h,draw,rx=1,ry=1){const T=G3.T;const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(rx,ry);t.anisotropy=4;return t}
function rnd(i){const x=Math.sin(i*127.1+311.7)*43758.5453;return x-Math.floor(x)}
function baseTex(name){if(G3.tex[name])return G3.tex[name];let t;
 if(name==='brick')t=canvasTex(128,64,(g,w,h)=>{g.fillStyle='#b9b0a2';g.fillRect(0,0,w,h);const rows=4,bh=h/rows,bw=w/4;for(let r=0;r<rows;r++)for(let c=-1;c<5;c++){const x=c*bw+(r%2?bw/2:0),y=r*bh,v=rnd(r*9+c)*26-13;g.fillStyle=`rgb(${226+v},${219+v},${206+v})`;g.beginPath();g.roundRect?g.roundRect(x+2,y+2,bw-4,bh-4,3):g.rect(x+2,y+2,bw-4,bh-4);g.fill();g.fillStyle='rgba(255,255,255,.35)';g.fillRect(x+4,y+3,bw-10,2)}});
 if(name==='shingle')t=canvasTex(64,64,(g,w,h)=>{g.fillStyle='#2d5ba6';g.fillRect(0,0,w,h);for(let r=0;r<5;r++)for(let c=-1;c<5;c++){const x=c*16+(r%2?8:0),y=r*14;const gr=g.createRadialGradient(x+8,y+2,1,x+8,y+6,11);gr.addColorStop(0,'#6fa0e8');gr.addColorStop(1,'#2f5fae');g.fillStyle=gr;g.beginPath();g.arc(x+8,y+4,8,0,Math.PI);g.fill();g.strokeStyle='rgba(20,40,90,.45)';g.lineWidth=1;g.stroke()}});
 if(name==='wood')t=canvasTex(64,64,(g,w,h)=>{for(let i=0;i<4;i++){const v=rnd(i)*24;g.fillStyle=`rgb(${165+v},${108+v/2},${60})`;g.fillRect(i*16,0,16,h);g.fillStyle='rgba(70,40,15,.55)';g.fillRect(i*16,0,1.5,h);for(let k=0;k<3;k++){g.fillStyle='rgba(90,50,20,.25)';g.fillRect(i*16+4+k*3,rnd(i*5+k)*h,1,18)}}});
 if(name==='grass')t=canvasTex(128,128,(g,w,h)=>{g.fillStyle='#7cc95a';g.fillRect(0,0,w,h);for(let i=0;i<900;i++){const v=rnd(i);g.fillStyle=v>.5?'rgba(170,230,120,.5)':'rgba(60,140,50,.45)';g.fillRect(rnd(i+1)*w,rnd(i+2)*h,2,3)}},6,6);
 if(name==='soil')t=canvasTex(128,128,(g,w,h)=>{g.fillStyle='#d8b488';g.fillRect(0,0,w,h);for(let i=0;i<1100;i++){const v=rnd(i);g.fillStyle=v>.6?'rgba(250,230,200,.55)':v>.25?'rgba(160,115,70,.35)':'rgba(120,85,50,.4)';const r=.6+rnd(i+5)*1.6;g.beginPath();g.arc(rnd(i+1)*w,rnd(i+2)*h,r,0,7);g.fill()}},6,6);
 if(name==='dirt')t=canvasTex(128,64,(g,w,h)=>{const gr=g.createLinearGradient(0,0,0,h);gr.addColorStop(0,'#a4733f');gr.addColorStop(1,'#5f3b1f');g.fillStyle=gr;g.fillRect(0,0,w,h);for(let i=0;i<6;i++){g.fillStyle='rgba(60,35,15,.25)';g.fillRect(0,h*(i/6)+rnd(i)*4,w,2)}for(let i=0;i<40;i++){g.fillStyle='rgba(210,190,160,.35)';g.beginPath();g.arc(rnd(i)*w,rnd(i+9)*h,1+rnd(i+3)*2,0,7);g.fill()}},4,1);
 if(name==='stones')t=canvasTex(128,32,(g,w,h)=>{g.fillStyle='#8f8678';g.fillRect(0,0,w,h);for(let i=0;i<10;i++){const v=rnd(i)*24;g.fillStyle=`rgb(${190+v},${183+v},${170+v})`;g.beginPath();g.ellipse(i*13+6,h/2+(i%2?3:-3),7,8,0,0,7);g.fill()}});
 G3.tex[name]=t;return t}
function tex(name,rx,ry){const k=name+rx+'x'+ry;if(G3.tex[k])return G3.tex[k];const b=baseTex(name),t=b.clone();t.needsUpdate=true;t.repeat.set(rx,ry);G3.tex[k]=t;return t}
function flagTex(color){const k='flag'+color;if(G3.tex[k])return G3.tex[k];G3.tex[k]=canvasTex(128,80,(g,w,h)=>{g.fillStyle='#'+color.toString(16).padStart(6,'0');g.fillRect(0,0,w,h);const gr=g.createLinearGradient(0,0,w,0);gr.addColorStop(0,'rgba(255,255,255,.25)');gr.addColorStop(1,'rgba(0,0,0,.2)');g.fillStyle=gr;g.fillRect(0,0,w,h);g.fillStyle='#ffd65a';g.beginPath();g.moveTo(40,28);g.quadraticCurveTo(52,22,64,28);g.lineTo(64,54);g.quadraticCurveTo(52,48,40,54);g.closePath();g.moveTo(88,28);g.quadraticCurveTo(76,22,64,28);g.lineTo(64,54);g.quadraticCurveTo(76,48,88,54);g.closePath();g.fill();g.strokeStyle='rgba(120,80,0,.6)';g.lineWidth=2;g.beginPath();g.moveTo(64,28);g.lineTo(64,54);g.stroke()});G3.tex[k].wrapS=G3.tex[k].wrapT=G3.T.ClampToEdgeWrapping;return G3.tex[k]}
function signTex(){if(G3.tex.sign)return G3.tex.sign;const t=canvasTex(256,110,(g,w,h)=>{g.fillStyle='#a8703f';g.fillRect(0,0,w,h);for(let i=0;i<4;i++){g.fillStyle='rgba(80,45,20,.35)';g.fillRect(0,i*27+26,w,2)}g.fillStyle='#fff';g.font='600 58px Mitr, "IBM Plex Sans Thai", sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText('ที่ดิน',w/2,h/2+4)});t.wrapS=t.wrapT=G3.T.ClampToEdgeWrapping;G3.tex.sign=t;return t}
/* ----- mesh helpers ----- */
function ROT(m,x,y,z){m.rotation.set(x,y,z);return m}
function mesh(geo,mat,x=0,y=0,z=0){const m=new G3.T.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;return m}
function grp(...ch){const g=new G3.T.Group();ch.forEach(c=>c&&g.add(c));return g}
const BOX=(w,h,d)=>new G3.T.BoxGeometry(w,h,d),CYL=(rt,rb,h,s=24)=>new G3.T.CylinderGeometry(rt,rb,h,s),CONE=(r,h,s=24)=>new G3.T.ConeGeometry(r,h,s),SPH=(r,a=24,b=16)=>new G3.T.SphereGeometry(r,a,b);
function eyes3D(g,y,z,r=.62){[-1,1].forEach(sx=>{const e=mesh(SPH(.1,16,12),M(P.ink,{rough:.2}),sx*.23*r/.62,y,z);e.scale.set(1,1.3,.6);g.add(e);g.add(mesh(SPH(.035,8,6),M(P.white,{emissive:P.white,ei:.6}),sx*.23*r/.62+.03,y+.05,z+.05));const b=mesh(SPH(.09,12,8),M(P.pink,{opacity:.55}),sx*.4*r/.62,y-.14,z-.06);b.scale.set(1.3,.6,.4);g.add(b)})}
function char3D(o,guard){
 const T=G3.T,g=new T.Group();if(guard)o='guard';
 [-1,1].forEach(sx=>{const sh=mesh(SPH(.17,16,10),M(P.ink,{rough:.35}),sx*.2,.08,.06);sh.scale.set(1,.6,1.4);g.add(sh);g.add(mesh(CYL(.12,.12,.42,12),M(P.navy),sx*.18,.36,0))});
 if(o==='out_knight'){g.add(mesh(CYL(.38,.48,.8),M(P.steel,{metal:.75,rough:.28}),0,.95,0));g.add(mesh(SPH(.12,12,8),M(P.gold,{metal:.6,rough:.3}),0,1.05,.45));const sw=mesh(BOX(.08,1,.04),M(P.steel,{metal:.8,rough:.2}),.62,.85,.1);g.add(sw);g.add(mesh(BOX(.3,.06,.08),M(P.gold,{metal:.6}),.62,.42,.1))}
 else if(o==='out_wizard'){g.add(mesh(CONE(.62,1.25),M(P.wiz),0,.98,0));g.add(ROT(mesh(new T.TorusGeometry(.55,.04,8,24),M(P.gold,{metal:.5}),0,.42,0),Math.PI/2,0,0));g.add(mesh(BOX(.32,.4,.1),M(P.roof),.5,.85,.25))}
 else if(o==='out_princess'){g.add(mesh(CONE(.8,1.2,28),M(P.prin),0,.95,0));g.add(mesh(CYL(.3,.34,.4),M(P.prin),0,1.3,0))}
 else if(o==='guard'){g.add(mesh(CYL(.4,.48,.8),M(P.red),0,.95,0));g.add(mesh(BOX(.05,.75,.02),M(P.gold,{metal:.5}),0,.95,.47));g.add(mesh(CYL(.04,.04,2.6,8),M(P.wood),.62,1.3,.1));g.add(mesh(CONE(.09,.28,8),M(P.steel,{metal:.7}),.62,2.7,.1))}
 else {g.add(mesh(CYL(.4,.48,.66),M(P.shirt,{rough:.7}),0,1.02,0));g.add(mesh(CYL(.49,.5,.26),M(P.navy),0,.63,0));g.add(mesh(BOX(.11,.36,.05),M(P.red),0,1.13,.42))}
 [-1,1].forEach(sx=>g.add(mesh(SPH(.13,12,8),M(P.skin,{rough:.5}),sx*.55,.82,.05)));
 g.add(mesh(SPH(.62,32,24),M(P.skin,{rough:.48}),0,1.95,0));
 if(o!=='out_knight'&&o!=='guard'){const h=mesh(new T.SphereGeometry(.66,32,16,0,Math.PI*2,0,Math.PI*.52),M(P.hair,{rough:.45}),0,1.98,-.03);h.rotation.x=-.25;g.add(h)}
 if(o==='out_princess'){[-1,1].forEach(sx=>{const l=mesh(SPH(.22,12,10),M(P.hair,{rough:.45}),sx*.55,1.62,-.1);l.scale.set(.8,1.6,.8);g.add(l)});for(let i=0;i<5;i++){const a=(i-2)*.32;g.add(mesh(CONE(.07,.24,6),M(P.gold,{metal:.7,rough:.25}),Math.sin(a)*.42,2.62,Math.cos(a)*.42-.1))}g.add(ROT(mesh(new T.TorusGeometry(.42,.04,8,24),M(P.gold,{metal:.7,rough:.25}),0,2.5,-.1),Math.PI/2,0,0))}
 if(o==='out_knight'){const hm=mesh(new T.SphereGeometry(.68,32,16,0,Math.PI*2,0,Math.PI*.55),M(P.steel,{metal:.75,rough:.25}),0,1.98,0);g.add(hm);g.add(mesh(BOX(.08,.45,.5),M(P.red),0,2.75,-.05))}
 if(o==='guard'){g.add(mesh(CYL(.5,.55,.9),M(P.ink),0,2.65,-.03));g.add(mesh(CYL(.56,.56,.08),M(P.gold,{metal:.5}),0,2.25,-.03))}
 if(o==='out_wizard'){g.add(mesh(CYL(.85,.85,.06,28),M(P.wiz),0,2.45,0));const hat=mesh(CONE(.52,1.2),M(P.wiz),0,3.05,-.05);hat.rotation.z=.15;g.add(hat);g.add(mesh(new T.OctahedronGeometry(.1),M(P.gold,{metal:.6,emissive:P.gold,ei:.3}),.05,3.05,.38))}
 eyes3D(g,1.92,.585);
 const m=mesh(new T.TorusGeometry(.09,.022,6,12,Math.PI),M(P.ink),0,1.72,.6);m.rotation.z=Math.PI;g.add(m);
 return g;
}
function gradCap3D(){const T=G3.T,g=new T.Group();g.add(mesh(CYL(.4,.42,.32,20),M(P.ink,{rough:.4}),0,0,0));const b=mesh(BOX(1.2,.07,1.2),M(P.ink,{rough:.35}),0,.2,0);b.rotation.y=Math.PI/4;g.add(b);g.add(mesh(SPH(.06,8,6),M(P.gold,{metal:.6}),0,.25,0));g.add(mesh(CYL(.025,.025,.55,6),M(P.gold,{metal:.6}),.6,-.05,0));g.add(mesh(CYL(.07,.03,.2,8),M(P.gold,{metal:.6}),.6,-.4,0));return g}
function pet3D(p){const T=G3.T,g=new T.Group();
 if(p==='pet_cat'){const b=mesh(SPH(.4,24,16),M(P.fur),0,.33,0);b.scale.set(1.3,.85,.9);g.add(b);g.add(mesh(SPH(.34,24,16),M(P.fur),.42,.72,.12));[-1,1].forEach(sx=>{g.add(mesh(CONE(.11,.24,8),M(P.fur),.42+sx*.18,1.05,.12));g.add(mesh(CONE(.06,.14,8),M(P.pink),.42+sx*.18,1.03,.17))});const tl=mesh(new T.TorusGeometry(.3,.06,8,16,Math.PI*1.2),M(P.fur),-.5,.6,0);tl.rotation.z=1.2;g.add(tl);const e=new T.Group();eyes3D(e,0,0,.36);e.position.set(.42,.75,.45);e.scale.setScalar(.6);g.add(e)}
 if(p==='pet_owl'){const b=mesh(SPH(.48,24,18),M(P.owl),0,.55,0);b.scale.set(1,1.2,.95);g.add(b);const be=mesh(SPH(.32,20,14),M(P.owlL),0,.45,.25);be.scale.set(1,1.15,.6);g.add(be);[-1,1].forEach(sx=>{g.add(mesh(SPH(.17,16,12),M(P.white,{rough:.3}),sx*.19,.82,.36));g.add(mesh(SPH(.09,12,8),M(P.ink,{rough:.2}),sx*.19,.82,.5));g.add(mesh(SPH(.03,6,4),M(P.white,{emissive:P.white,ei:.6}),sx*.19+.03,.86,.58))});g.add(ROT(mesh(CONE(.06,.16,8),M(P.gold),0,.66,.5),Math.PI,0,0));const c=gradCap3D();c.scale.setScalar(.55);c.position.set(0,1.2,0);g.add(c)}
 if(p==='pet_dragon'||p==='big_dragon')g.add(dragon3D());
 return g}
function dragon3D(){const T=G3.T,g=new T.Group();const b=mesh(SPH(.5,24,16),M(P.drag),0,.5,0);b.scale.set(1.2,.9,.9);g.add(b);const be=mesh(SPH(.32,16,12),M(0xc6f0a0),.15,.4,.3);be.scale.set(1,.8,.5);g.add(be);g.add(mesh(SPH(.38,24,16),M(P.drag),.55,1.02,.1));
 [-1,1].forEach(sx=>{g.add(mesh(CONE(.07,.26,8),M(P.gold,{metal:.5}),.48+sx*.13,1.42,0));const w=mesh(new T.ConeGeometry(.45,.9,3),M(P.dragD,{side:true}),-.25,1.0,sx*.35);w.rotation.set(sx*.7,0,-.9);w.scale.z=.15;g.add(w)});
 const t=mesh(CONE(.18,.9,10),M(P.drag),-.85,.4,0);t.rotation.z=1.9;g.add(t);const e=new T.Group();eyes3D(e,0,0,.4);e.position.set(.62,1.05,.46);e.scale.setScalar(.6);e.rotation.y=.35;g.add(e);return g}
function flag3D(color){const T=G3.T,g=new T.Group();g.add(mesh(CYL(.05,.05,2.1,8),M(P.wood),0,1.05,0));g.add(mesh(SPH(.11,12,8),M(P.gold,{metal:.6,rough:.3}),0,2.15,0));const cl=mesh(new T.PlaneGeometry(1.3,.8,8,1),new T.MeshStandardMaterial({map:flagTex(color),side:T.DoubleSide,roughness:.7}),.68,1.7,0);cl.castShadow=true;cl.userData.flag=true;g.add(cl);return g}
const FLAGC={flag_red:0xe0483f,flag_blue:0x3f74c4,flag_green:0x3e9a4a};
function books3D(){const g=new G3.T.Group();[0xe0483f,0x3f74c4,0x3e9a4a].forEach((c,i)=>{const b=mesh(BOX(.9-i*.12,.2,.62),M(c),0,.1+i*.21,0);b.rotation.y=i*.25-.2;g.add(b);g.add(ROT(mesh(BOX(.04,.16,.55),M(P.white),(.9-i*.12)/2,.1+i*.21,0),0,i*.25-.2,0))});return g}
function horse3D(col,lux){const T=G3.T,g=new T.Group(),m=M(col,{rough:.5}),mn=M(lux?P.gold:0x5a3a22,{rough:.45,metal:lux?.5:0});
 const b=mesh(SPH(.5,24,16),m,0,1.15,0);b.scale.set(1.5,.85,.78);g.add(b);
 [[.45,.22],[.45,-.22],[-.45,.22],[-.45,-.22]].forEach(([x,z])=>{g.add(mesh(CYL(.1,.08,.85,10),m,x,.45,z));g.add(mesh(CYL(.1,.11,.12,10),M(P.ink,{rough:.4}),x,.06,z))});
 g.add(ROT(mesh(CYL(.18,.25,.8,12),m,.78,1.55,0),0,0,-.55));
 const h=mesh(SPH(.3,20,14),m,1.12,1.95,0);h.scale.set(1.45,.9,.85);g.add(ROT(h,0,0,-.35));
 [-1,1].forEach(sz=>{g.add(mesh(CONE(.07,.2,8),m,.98,2.24,sz*.11));g.add(mesh(SPH(.07,10,8),M(P.ink,{rough:.2}),1.2,2.02,sz*.22));g.add(mesh(SPH(.025,6,4),M(P.white,{emissive:P.white,ei:.6}),1.23,2.05,sz*.26))});
 for(let i=0;i<4;i++)g.add(ROT(mesh(BOX(.12,.28,.1),mn,.62+i*.12,1.75+i*.12,0),0,0,-.55));
 g.add(ROT(mesh(CONE(.13,.7,10),mn,-.85,1.05,0),0,0,2.5));
 if(lux){g.add(ROT(mesh(new T.TorusGeometry(.4,.05,8,24),M(P.gold,{metal:.7,rough:.25}),.2,1.15,0),0,Math.PI/2,0));g.add(mesh(CONE(.08,.3,8),M(P.prin),1.0,2.4,0))}
 return g}
function wheel3D(lux,x,z){const T=G3.T,g=new T.Group(),c=lux?M(P.gold,{metal:.75,rough:.22}):M(0x6e4423,{rough:.6});g.add(mesh(new T.TorusGeometry(.44,.07,10,28),c,0,0,0));
 for(let i=0;i<4;i++)g.add(ROT(mesh(BOX(.85,.05,.05),c,0,0,0),0,0,i*Math.PI/4));g.add(ROT(mesh(CYL(.09,.09,.16,12),c,0,0,0),Math.PI/2,0,0));g.position.set(x,.5,z);return g}
function cart3D(lux){const T=G3.T,g=new T.Group();
 const hz=horse3D(lux?0xf6f3ee:0xa8743f,lux);hz.position.x=1.5;g.add(hz);
 [-1,1].forEach(sz=>g.add(ROT(mesh(BOX(1.4,.06,.06),M(lux?P.gold:P.woodD,{metal:lux?.6:0}),.75,1.0,sz*.38),0,0,.12)));
 if(lux){const cab=mesh(SPH(.85,32,20),M(0xdfe3ea,{metal:.8,rough:.2}),-1.1,1.6,0);cab.scale.set(1.05,.95,.75);g.add(cab);
  g.add(ROT(mesh(new T.TorusGeometry(.86,.06,10,40),M(P.gold,{metal:.75,rough:.2}),-1.1,1.55,0),Math.PI/2,0,0));
  [-1,1].forEach(sz=>{g.add(mesh(new T.CircleGeometry(.3,20),M(P.glass,{emissive:P.glass,ei:.5}),-1.1,1.7,sz*.64)).children;const w=g.children[g.children.length-1];w.rotation.y=sz>0?0:Math.PI;w.castShadow=false});
  for(let i=0;i<5;i++){const a=i*Math.PI*2/5;g.add(mesh(CONE(.08,.26,6),M(P.gold,{metal:.75,rough:.2}),-1.1+Math.cos(a)*.22,2.52,Math.sin(a)*.22))}
  g.add(mesh(new T.TorusGeometry(.22,.04,8,20),M(P.gold,{metal:.75,rough:.2}),-1.1,2.4,0));g.children[g.children.length-1].rotation.x=Math.PI/2;
  g.add(mesh(SPH(.09,10,8),M(P.red,{rough:.3}),-1.1,2.6,0));g.add(mesh(BOX(.5,.08,.9),M(P.gold,{metal:.7,rough:.25}),-.05,1.05,0))}
 else{g.add(mesh(BOX(1.6,1.05,1.1),M(0xffffff,{map:tex('wood',3,2)}),-1.15,1.4,0));g.add(mesh(BOX(1.85,.14,1.3),M(P.woodD,{rough:.6}),-1.15,2.0,0));
  g.add(ROT(mesh(CYL(.65,.65,1.3,20,1),M(0xb07a45,{rough:.6}),-1.15,2.02,0),Math.PI/2,0,0));
  [-1,1].forEach(sz=>{const w=mesh(BOX(.6,.45,.04),M(P.glass,{emissive:P.glass,ei:.4}),-1.15,1.5,sz*.56);w.castShadow=false;g.add(w)});
  g.add(mesh(BOX(.5,.1,.9),M(P.woodD),-.1,1.05,0))}
 [[-1.6,.62],[-1.6,-.62],[-.55,.62],[-.55,-.62]].forEach(([x,z])=>g.add(wheel3D(lux,x,z)));
 g.scale.setScalar(.95);return g}
function tree3D(){const T=G3.T,g=new T.Group(),bark=M(0x8a5a32,{map:tex('wood',1,3),rough:.85});
 g.add(mesh(CYL(.32,.52,2.8,12),bark,0,1.4,0));[0,2.1,4.2].forEach(a=>g.add(ROT(mesh(CONE(.25,.7,8),bark,Math.cos(a)*.45,.2,Math.sin(a)*.45),0,0,Math.cos(a)*.9)));
 [[.5,2.6,.2,-.8],[-.5,2.8,-.1,.9]].forEach(([x,y,z,r])=>g.add(ROT(mesh(CYL(.1,.16,1.3,8),bark,x,y,z),0,0,r)));
 const lf=[0x5fb24a,0x6fc456,0x4f9e3e];[[0,4.1,0,1.75],[1.25,3.5,.4,1.2],[-1.2,3.6,-.3,1.3],[.3,5.1,.2,1.2],[-.4,3.9,1.1,1.1],[.5,3.8,-1.1,1.1]].forEach(([x,y,z,r],i)=>{const c=mesh(new T.IcosahedronGeometry(r,1),M(lf[i%3],{rough:.75,flat:true}),x,y,z);g.add(c)});
 [[.9,3.2,1.1],[-1.3,4.4,.6],[1.4,4.3,-.4],[-.2,3.1,1.6],[.2,5.4,1.0]].forEach(([x,y,z])=>g.add(mesh(SPH(.13,10,8),M(P.red,{rough:.3}),x,y,z)));
 return g}
function cannon3D(){const T=G3.T,g=new T.Group(),wd=M(P.wood,{map:tex('wood',2,1)}),ir=M(0x3a3f48,{metal:.7,rough:.35});
 [-1,1].forEach(sz=>{g.add(mesh(BOX(1.1,.45,.12),wd,-.1,.45,sz*.27));const w=new T.Group();w.add(mesh(new T.TorusGeometry(.32,.06,8,22),M(0x6e4423)));for(let i=0;i<4;i++)w.add(ROT(mesh(BOX(.6,.04,.04),M(0x6e4423)),0,0,i*Math.PI/4));w.position.set(.05,.34,sz*.42);g.add(w)});
 g.add(ROT(mesh(CYL(.05,.05,.95,8),M(P.ink,{metal:.5}),.05,.34,0),Math.PI/2,0,0));g.add(mesh(BOX(.9,.12,.5),wd,-.45,.18,0));
 const br=new T.Group();br.add(ROT(mesh(CYL(.15,.22,1.5,20),ir,.35,0,0),0,0,-Math.PI/2));br.add(ROT(mesh(new T.TorusGeometry(.17,.05,8,20),ir,1.1,0,0),0,Math.PI/2,0));br.add(mesh(SPH(.14,12,8),ir,-.45,0,0));
 br.add(ROT(mesh(new T.TorusGeometry(.22,.035,6,20),M(P.gold,{metal:.7,rough:.3}),-.15,0,0),0,Math.PI/2,0));br.position.set(0,.72,0);br.rotation.z=.22;g.add(br);
 [[-.85,.13,.15],[-.85,.13,-.15],[-1.12,.13,0],[-.95,.36,0]].forEach(([x,y,z])=>g.add(mesh(SPH(.14,12,8),ir,x,y,z)));
 return g}
function decor3D(d){
 if(d==='dec_tree')return tree3D();
 if(d==='dec_cannon')return cannon3D();const T=G3.T,g=new T.Group();
 if(d==='dec_garden'){g.add(mesh(BOX(2.4,.35,.8),M(P.wood,{map:tex('wood',3,1)}),0,.18,0));const h=mesh(SPH(.5,16,10),M(P.grassD),0,.42,0);h.scale.set(2.3,.55,.7);g.add(h);const cs=[0xe0483f,0xf2b632,0xff8fc0,0x9a6ae0,0xffffff,0xff7a3a];for(let i=0;i<7;i++){const x=-1+i*.33;const f=new T.Group();for(let k=0;k<5;k++){const a=k*1.2566;f.add(mesh(SPH(.07,8,6),M(cs[i%6],{rough:.5}),Math.cos(a)*.09,0,Math.sin(a)*.09))}f.add(mesh(SPH(.05,8,6),M(P.gold),0,.02,0));f.position.set(x,.72+(i%2)*.08,(i%3-1)*.15);g.add(f)}}
 if(d==='dec_fountain'){g.add(mesh(CYL(1,1.05,.4,28),M(P.stoneL,{rough:.35}),0,.2,0));g.add(mesh(CYL(.85,.85,.05,28),M(P.water,{rough:.1,metal:.1,opacity:.9}),0,.39,0));g.add(mesh(CYL(.12,.16,.9,12),M(P.stoneL,{rough:.35}),0,.8,0));g.add(mesh(CYL(.45,.3,.15,20),M(P.stoneL,{rough:.35}),0,1.25,0));g.add(mesh(SPH(.18,12,8),M(0xa8e2ff,{rough:.05,opacity:.85,emissive:0x6ac8ff,ei:.2}),0,1.45,0))}
 if(d==='dec_lamp'){g.add(mesh(CYL(.05,.08,1.6,8),M(P.ink,{metal:.5,rough:.4}),0,.8,0));g.add(mesh(BOX(.3,.36,.3),M(P.glass,{emissive:P.glass,ei:1.1}),0,1.75,0));g.add(ROT(mesh(CONE(.26,.22,4),M(P.ink,{metal:.5}),0,2.04,0),0,Math.PI/4,0))}
 if(d==='dec_cart_wood')g.add(cart3D(false));
 if(d==='dec_cart_lux')g.add(cart3D(true));
 if(d==='dec_guard')g.add(char3D(null,true));
 if(d==='dec_dragon')g.add(dragon3D());
 return g}
function item3D(id){const it=item(id);if(it.type==='outfit')return char3D(id);if(it.type==='pet')return pet3D(id);if(it.type==='flag')return flag3D(FLAGC[id]);return decor3D(id)}
function tower3D(x,z,r,h,stage,front){const T=G3.T,g=new T.Group();const y0=.5;
 g.add(mesh(CYL(r,r*1.06,h,32),M(P.stone,{map:tex('brick',Math.round(r*2*Math.PI/1.4),Math.round(h/.7))}),0,y0+h/2,0));
 g.add(ROT(mesh(new T.TorusGeometry(r*1.03,.09,8,32),M(P.stoneL),0,y0+h-.4,0),Math.PI/2,0,0));
 g.add(mesh(CYL(r*1.12,r*1.12,.22,32),M(P.stoneL),0,y0+h,0));
 const wins=front?[[0,y0+h*.35],[.9,y0+h*.65]]:[[.5,y0+h*.6]];wins.forEach(([a,y])=>{const w=mesh(BOX(.32,.55,.12),M(stage>=9&&y>y0+h*.5?0x7fb8ff:P.glass,{emissive:stage>=9&&y>y0+h*.5?0x5a8cff:P.glass,ei:.7}),Math.sin(a)*r,y,Math.cos(a)*r);w.rotation.y=a;g.add(w);const f=mesh(BOX(.44,.1,.16),M(P.stoneL),Math.sin(a)*r,y+.32,Math.cos(a)*r);f.rotation.y=a;g.add(f)});
 if(stage>=7&&stage<9)for(let i=0;i<8;i++){const a=i*Math.PI/4;const m=mesh(BOX(.34,.36,.3),M(P.stone,{map:tex('brick',1,1)}),Math.sin(a)*r*.95,y0+h+.28,Math.cos(a)*r*.95);m.rotation.y=a;g.add(m)}
 if(stage>=9){g.add(mesh(CONE(r*1.28,h*.62,32),M(P.roof,{map:tex('shingle',4,3),rough:.5}),0,y0+h+.11+h*.31,0));g.add(mesh(SPH(.16,12,8),M(P.gold,{metal:.6,rough:.25}),0,y0+h+.11+h*.62+.1,0))}
 g.position.set(x,0,z);g.userData.top=y0+h+(stage>=9?h*.62+.2:.11);return g}
function wall3D(len,rot,x,z,stage){const T=G3.T,g=new T.Group();const H=2.6,y0=.5;
 g.add(mesh(BOX(len,H,.7),M(P.stone,{map:tex('brick',Math.round(len/1.4),Math.round(H/.7))}),0,y0+H/2,0));
 g.add(mesh(BOX(len+.1,.16,.86),M(P.stoneL),0,y0+H+.08,0));
 g.add(mesh(BOX(len+.1,.25,.84),M(P.stoneD,{rough:.8}),0,y0+.12,0));
 if(stage>=7)for(let i=0;i<Math.floor(len/1.05);i++){g.add(mesh(BOX(.5,.48,.62),M(P.stone,{map:tex('brick',1,1)}),-len/2+.55+i*1.05,y0+H+.4,.08))}
 g.rotation.y=rot;g.position.set(x,0,z);return g}
function scaffold3D(n,planks){const T=G3.T,g=new T.Group();const R={1:[0,0,0,10.6,1.2,10.6],2:[0,0,0,10.8,1.1,10.8],3:[0,0,0,10.2,3.4,10.2],4:[0,0,4.9,3.2,3.2,1.6],5:[-4.8,0,4.8,3,5.4,3],6:[0,0,-4.8,12.4,4.8,3],7:[0,3,0,10.4,1.2,10.4],8:[0,.5,-1,4.4,4.4,4],9:[0,4.3,-1,4.4,3.4,4.2],10:[0,4.6,-1,2.4,5.2,2.4]}[n];if(!R)return g;
 const [cx,y0,cz,w,h,d]=R,wd=M(P.wood,{map:tex('wood',1,2)});[[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz])=>g.add(mesh(BOX(.14,h,.14),wd,cx+sx*w/2,y0+h/2,cz+sz*d/2)));
 for(let i=1;i<=planks;i++){const y=y0+h*i/5;g.add(mesh(BOX(w+.3,.1,.26),wd,cx,y,cz+d/2));g.add(mesh(BOX(.26,.1,d+.3),wd,cx+w/2,y,cz))}
 const tarp=mesh(BOX(w,h,d),new T.MeshStandardMaterial({color:0xffe6a8,transparent:true,opacity:.14,depthWrite:false}),cx,y0+h/2,cz);tarp.castShadow=false;g.add(tarp);
 const wk=char3D(null);wk.add(mesh(new T.SphereGeometry(.7,20,10,0,Math.PI*2,0,Math.PI/2),M(P.gold,{rough:.4}),0,2.05,0));wk.scale.setScalar(.42);wk.position.set(cx+w/2-.6,y0+h*Math.min(planks,4)/5+.05,cz+d/2+.05);wk.rotation.y=.4;wk.userData.worker=true;g.add(wk);return g}
function castle3D(stage,frac,eq){
 const T=G3.T,root=new T.Group();eq=eq||{decor:[]};const D=eq.decor||[];const anim={flags:[],spin:[],confetti:[],workers:[]};
 const gnd=new T.Group();gnd.add(ROT(mesh(new T.PlaneGeometry(140,140),M(0xffffff,{map:tex('soil',30,30),rough:.95}),0,0,0),-Math.PI/2,0,0));
 for(let i=0;i<70;i++){const a=rnd(i+40)*6.28,r=12.4+rnd(i+80)*16;gnd.add(mesh(new T.DodecahedronGeometry(.1+rnd(i+9)*.16),M(rnd(i)>.5?0xb48c60:0xcfc2ae,{rough:.9}),Math.sin(a)*r,.05,Math.cos(a)*r))}
 root.add(gnd);
 if(stage>=5){const wm=M(P.water,{rough:.08,metal:.25}),cp=M(P.stoneL,{rough:.6}),IN=10,OUT=11.4,W=OUT-IN,C=(IN+OUT)/2,Lg=OUT*2;
  [[0,C,Lg,W],[0,-C,Lg,W],[C,0,W,Lg-2*W],[-C,0,W,Lg-2*W]].forEach(([x,z,w,d])=>{const m=mesh(BOX(w,.08,d),wm,x,.02,z);m.castShadow=false;root.add(m)});
  [[IN,.18],[OUT,.18]].forEach(([h,t],k)=>{const o=k?t/2:-t/2,hh=h+o;[[0,hh,2*hh+t,t],[0,-hh,2*hh+t,t],[hh,0,t,2*hh-t],[-hh,0,t,2*hh-t]].forEach(([x,z,w,d])=>root.add(mesh(BOX(w,.16,d),cp,x,.08,z)))})}
 if(stage===1){const wd=M(P.wood,{map:tex('wood',1,2)});[[-5,-5],[5,-5],[-5,5],[5,5],[0,5],[0,-5],[5,0],[-5,0]].forEach(([x,z])=>root.add(mesh(BOX(.18,1,.18),wd,x,.5,z)));
  [[0,5,10,0],[0,-5,10,0],[5,0,10,Math.PI/2],[-5,0,10,Math.PI/2]].forEach(([x,z,l,r])=>{const rp=mesh(BOX(l,.04,.04),M(0xf4e2b5),x,.7,z);rp.rotation.y=r;root.add(rp)})}
 if(stage>=2){root.add(mesh(BOX(10.6,.5,10.6),M(P.stoneD,{map:tex('stones',8,1),rough:.85}),0,.25,0))}
 if(stage>=8){const k=new T.Group();k.add(mesh(BOX(3.8,4,3.4),M(P.stone,{map:tex('brick',3,6)}),0,.5+2,0));k.add(mesh(BOX(4,.18,3.6),M(P.stoneL),0,.5+4.05,0));
  const ck=mesh(CYL(.6,.6,.12,32),M(P.white,{rough:.3}),0,3.5,1.72);ck.rotation.x=Math.PI/2;k.add(ck);const rim=mesh(new T.TorusGeometry(.62,.08,10,32),M(P.gold,{metal:.65,rough:.25}),0,3.5,1.78);k.add(rim);
  k.add(mesh(BOX(.06,.38,.04),M(P.ink),0,3.66,1.8));const hh=mesh(BOX(.05,.28,.04),M(P.ink),.11,3.5,1.8);hh.rotation.z=-1.1;hh.position.set(.12,3.45,1.8);k.add(hh);
  [-1.1,1.1].forEach(x=>{k.add(mesh(BOX(.5,.8,.1),M(stage>=9?0x7fb8ff:P.glass,{emissive:stage>=9?0x6a8cff:P.glass,ei:.7}),x,2.3,1.72));k.add(mesh(BOX(.62,.1,.16),M(P.stoneL),x,2.75,1.72))});
  if(stage>=9){const rf=mesh(CONE(3.2,3,4),M(P.roof,{map:tex('shingle',5,3),rough:.5}),0,4.14+1.5,0);rf.rotation.y=Math.PI/4;k.add(rf);k.add(mesh(SPH(.2,12,8),M(P.gold,{metal:.6,rough:.25}),0,4.14+3.05,0));
   const sg=mesh(CYL(.55,.55,.1,24),M(0xffffff,{emissive:0xff9a5a,ei:.5}),0,5.1,1.12);sg.rotation.x=Math.PI/2-.5;k.add(sg)}
  k.position.set(0,0,-1);root.add(k)}
 if(stage>=6){root.add(tower3D(-4.8,-4.8,1.05,4,stage,false));root.add(tower3D(4.8,-4.8,1.05,4,stage,false))}
 if(stage>=3){root.add(wall3D(9.6,0,0,4.8,stage));root.add(wall3D(9.6,0,0,-4.8,stage));root.add(wall3D(9.6,Math.PI/2,4.8,0,stage));root.add(wall3D(9.6,Math.PI/2,-4.8,0,stage))}
 if(stage>=4){const gt=new T.Group();const fr=mesh(BOX(2.6,2.6,.5),M(P.stoneL,{map:tex('brick',2,3)}),0,1.75,5.15);gt.add(fr);
  const door=mesh(BOX(1.7,2,.12),M(P.wood,{map:tex('wood',2,2)}),0,1.5,5.43);gt.add(door);const dt=mesh(CYL(.85,.85,.12,24),M(P.wood,{map:tex('wood',2,1)}),0,2.5,5.43);dt.rotation.x=Math.PI/2;gt.add(dt);const ar=mesh(CYL(1.3,1.3,.5,24),M(P.stoneL,{map:tex('brick',2,1)}),0,3.05,5.15);ar.rotation.x=Math.PI/2;gt.add(ar);
  [1,2].forEach(y=>gt.add(mesh(BOX(1.72,.1,.14),M(P.ink,{metal:.5,rough:.4}),0,y,5.5)));gt.add(mesh(new T.TorusGeometry(.12,.03,6,16),M(P.gold,{metal:.6}),.45,1.5,5.52));
  const db=mesh(BOX(1.9,.14,1.4),M(P.wood,{map:tex('wood',3,2)}),0,.12,6.15);gt.add(db);[-1,1].forEach(sx=>{const ch=mesh(CYL(.03,.03,1.9,6),M(P.ink,{metal:.6}),sx*.9,1.05,5.95);ch.rotation.x=-.6;gt.add(ch)});for(let i=0;i<5;i++){const t=mesh(BOX(1.7,.1,.62),M(P.stoneL,{rough:.75}),(i%2?.06:-.06),.05,7.25+i*.68);t.rotation.y=(i%2?.04:-.05);gt.add(t)}const br=mesh(BOX(2.1,.18,2.4),M(P.wood,{map:tex('wood',3,3)}),0,.22,10.7);gt.add(br);[-1,1].forEach(sx=>{gt.add(mesh(BOX(.12,.5,2.4),M(P.woodD),sx*1.02,.5,10.7));[9.6,11.8].forEach(z=>gt.add(mesh(CYL(.08,.08,.8,8),M(P.woodD),sx*1.02,.4,z)))});root.add(gt)}
 if(stage>=5){const tl=tower3D(-4.8,4.8,1.3,4.6,stage,true),tr=tower3D(4.8,4.8,1.3,4.6,stage,true);root.add(tl);root.add(tr);
  if(stage>=7){const f=flag3D(FLAGC[eq.flag]||P.gold);f.position.set(4.8,tr.userData.top-.1,4.8);root.add(f);anim.flags.push(f)}
  if(D.includes('dec_dragon')&&stage>=6){const d=dragon3D();d.scale.setScalar(.95);d.position.set(-4.8,tl.userData.top-(stage>=9?.3:0),4.8);d.rotation.y=.8;root.add(d);anim.spin.push({o:d,bob:true,y:d.position.y})}}
 if(stage>=10){const f=flag3D(FLAGC[eq.flag]||P.gold);f.scale.setScalar(1.25);f.position.set(0,7.4,-1);root.add(f);anim.flags.push(f);
  const c=gradCap3D();c.scale.setScalar(1.3);c.position.set(-1.8,8.6,-1);root.add(c);anim.spin.push({o:c,spin:true,y:8.6,bob:true});
  const cc=[0xe0483f,0xf2b632,0x3f74c4,0xff8fc0,0x6ccf6a];for(let i=0;i<70;i++){const p=mesh(new T.PlaneGeometry(.22,.12),M(cc[i%5],{side:true,rough:.5}),(rnd(i)-.5)*20,2+rnd(i+7)*11,(rnd(i+3)-.5)*16);p.castShadow=false;p.rotation.set(rnd(i+1)*6,rnd(i+2)*6,0);root.add(p);anim.confetti.push(p)}}
 if(stage<3){const tn=mesh(CONE(1.7,2.2,4),M(P.gold,{rough:.55}),6.6,1.1,1.5);tn.rotation.y=Math.PI/4;root.add(tn);const dr=mesh(BOX(.7,1,.05),M(P.woodD),6.6,.5,2.68);root.add(dr);
  const bk=books3D();bk.position.set(4.6,0,3.8);root.add(bk);
  const sg=new T.Group();sg.add(mesh(BOX(.16,1.6,.16),M(P.wood),0,.8,0));const bd=mesh(BOX(2,.9,.12),new T.MeshStandardMaterial({map:signTex(),roughness:.7}),0,1.55,.1);bd.castShadow=true;sg.add(bd);sg.position.set(-6.6,0,4.2);sg.rotation.y=.35;root.add(sg)}
 const planks=stage<10&&frac>0?Math.max(1,Math.ceil(frac*4)):0;if(planks){const sc=scaffold3D(stage+1,planks);root.add(sc);sc.traverse(o=>{if(o.userData&&o.userData.worker)anim.workers.push({o,y:o.position.y})})}
 const place=(o,x,z,ry=0,s=1)=>{o.position.set(x,0,z);o.rotation.y=ry;o.scale.setScalar(s);root.add(o);return o};
 if(D.includes('dec_tree'))place(decor3D('dec_tree'),8.1,-4.6,.4,1.15);
 if(D.includes('dec_cannon')){place(decor3D('dec_cannon'),8,7.9,-Math.PI/4,1.1);place(decor3D('dec_cannon'),-8,-7.9,Math.PI*3/4,1.1)}
 if(D.includes('dec_cart_wood'))place(decor3D('dec_cart_wood'),-6.2,8.1,.2);
 if(D.includes('dec_cart_lux'))place(decor3D('dec_cart_lux'),-8,1.2,-Math.PI/2);
 if(D.includes('dec_lamp')){place(decor3D('dec_lamp'),-1.5,8.3);place(decor3D('dec_lamp'),1.5,8.3)}
 if(D.includes('dec_fountain'))place(decor3D('dec_fountain'),8,1.6);
 if(D.includes('dec_guard'))place(decor3D('dec_guard'),-2.7,7.1,.3,.95);
 if(eq.pet)place(pet3D(eq.pet),5.2,8.3,.5,eq.pet==='pet_dragon'?.85:1);
 place(char3D(eq.outfit),3.3,8.6,.45,1.05);
 root.userData.anim=anim;
 root.traverse(o=>{if(o.isMesh&&o.material&&o.material.transparent&&o.material.opacity<.5)o.castShadow=false});
 return root;
}
/* ----- scene, lighting, camera ----- */
function skyTex(){if(G3.tex.sky)return G3.tex.sky;const t=canvasTex(4,256,(g,w,h)=>{const gr=g.createLinearGradient(0,0,0,h);gr.addColorStop(0,'#8fc4ef');gr.addColorStop(.55,'#cfe6f8');gr.addColorStop(.62,'#e8f1f8');gr.addColorStop(1,'#e8f1f8');g.fillStyle=gr;g.fillRect(0,0,w,h)});t.wrapS=t.wrapT=G3.T.ClampToEdgeWrapping;G3.tex.sky=t;return t}
function makeScene(){const T=G3.T,sc=new T.Scene();sc.background=skyTex();sc.fog=new T.Fog(0xe8f1f8,34,90);sc.add(new T.HemisphereLight(0xdff1ff,0x7a6a50,.62));sc.add(new T.AmbientLight(0xffffff,.18));
 const sun=new T.DirectionalLight(0xfff1d6,.95);sun.position.set(14,26,16);sun.castShadow=true;sun.shadow.mapSize.set(1536,1536);const c=sun.shadow.camera;c.left=-18;c.right=18;c.top=18;c.bottom=-18;c.near=1;c.far=70;sun.shadow.bias=-.0006;sc.add(sun);
 const rim=new T.DirectionalLight(0xbfd8ff,.35);rim.position.set(-16,10,-12);sc.add(rim);return sc}
function makeRenderer(preserve){const T=G3.T,r=new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:!!preserve});r.setClearColor(0x000000,0);r.shadowMap.enabled=true;r.shadowMap.type=T.PCFSoftShadowMap;return r}
function castCam(aspect,yaw=0){const T=G3.T,cam=new T.PerspectiveCamera(30,aspect,.5,200);const d=42,el=.14,az=.5+yaw,ly=3.2;cam.position.set(Math.sin(az)*Math.cos(el)*d,ly+Math.sin(el)*d,Math.cos(az)*Math.cos(el)*d);cam.lookAt(0,ly,0);return cam}
function fitCam(obj,aspect){const T=G3.T,b=new T.Box3().setFromObject(obj),sz=new T.Vector3(),ct=new T.Vector3();b.getSize(sz);b.getCenter(ct);const cam=new T.PerspectiveCamera(30,aspect,.05,100);const r=Math.max(sz.x,sz.y,sz.z)*.62;const d=r/Math.tan(15*Math.PI/180)*1.05;cam.position.set(ct.x+d*.38,ct.y+d*.22,ct.z+d*.9);cam.lookAt(ct);return cam}
/* ----- snapshots (thumbnails & icons) ----- */
function requestSnap(key,el,scale){
 const done=G3.cache.get(key);if(done){putImg(el,done);return}
 if(!G3.queue.some(q=>q.key===key))G3.queue.push({key,scale});
 el.dataset.snap=key;pump()}
function putImg(el,url){if(el.querySelector('img[data-k3]'))return;const old=el.querySelector('svg');const im=new Image();im.src=url;im.alt='';im.dataset.k3='1';im.draggable=false;if(old)old.replaceWith(im);else el.prepend(im);el.querySelector('.loading3d')?.remove()}
function pump(){if(G3.busy||!G3.queue.length)return;G3.busy=true;
 const step=()=>{const job=G3.queue.shift();if(!job){G3.busy=false;return}
  try{const url=renderSnap(job);G3.cache.set(job.key,url);document.querySelectorAll(`[data-snap="${CSS.escape(job.key)}"]`).forEach(el=>putImg(el,url))}catch(e){console.error(e)}
  setTimeout(step,12)};step()}
function renderSnap(job){const T=G3.T;if(!G3.snap)G3.snap=makeRenderer(true);const r=G3.snap;let sc=makeScene(),cam,obj,w,h;
 if(job.key.startsWith('c:')){const spec=CK.get(job.key.slice(2));obj=castle3D(spec.stage,spec.frac,spec.eq);w=480*job.scale;h=Math.round(w*246/320);cam=castCam(w/h)}
 else{obj=item3D(job.key.slice(2));w=h=192;cam=fitCam(obj,1);sc.children.forEach(l=>{if(l.isDirectionalLight&&l.castShadow){l.shadow.camera.left=l.shadow.camera.bottom=-4;l.shadow.camera.right=l.shadow.camera.top=4;l.shadow.camera.updateProjectionMatrix()}})}
 sc.add(obj);r.setPixelRatio(1);r.setSize(w,h,false);r.render(sc,cam);const url=r.domElement.toDataURL('image/png');dispose(obj);return url}
function dispose(o){o.traverse(m=>{if(m.isMesh&&m.geometry)m.geometry.dispose()})}
/* ----- live interactive view ----- */
function attachLive(el){const T=G3.T,key=el.dataset.key,spec=CK.get(key);
 if(!G3.live){const r=makeRenderer(false);r.setPixelRatio(Math.min(2,window.devicePixelRatio||1));G3.live={r,scene:makeScene(),obj:null,key:null,yaw:0,vel:0,drag:null,raf:0,el:null,t0:performance.now()};
  const cv=r.domElement;cv.addEventListener('pointerdown',e=>{const L=G3.live;L.drag={x:e.clientX,yaw:L.yaw,t:performance.now()};L.el&&L.el.classList.add('drag');cv.setPointerCapture(e.pointerId);L.el&&L.el.querySelector('.hint')?.remove()});
  cv.addEventListener('pointermove',e=>{const L=G3.live;if(!L.drag)return;const ny=L.drag.yaw+(e.clientX-L.drag.x)*.008;L.vel=ny-L.yaw;L.yaw=ny});
  const up=()=>{const L=G3.live;L.drag=null;L.el&&L.el.classList.remove('drag')};cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
  G3.ro=new ResizeObserver(()=>sizeLive());}
 const L=G3.live;
 if(L.key!==key){if(L.obj){L.scene.remove(L.obj);dispose(L.obj)}L.obj=castle3D(spec.stage,spec.frac,spec.eq);L.scene.add(L.obj);L.key=key;L.yaw=0}
 if(L.el!==el||!el.contains(L.r.domElement)){el.querySelector('svg')?.remove();el.querySelector('.loading3d')?.remove();el.prepend(L.r.domElement);if(!el.querySelector('.hint'))el.insertAdjacentHTML('beforeend','<span class="hint">ลากเพื่อหมุนดูรอบปราสาท</span>');G3.ro.disconnect();G3.ro.observe(el);L.el=el}
 sizeLive();if(!L.raf)loop()}
function sizeLive(){const L=G3.live;if(!L||!L.el)return;const b=L.el.getBoundingClientRect();if(!b.width)return;L.r.setSize(b.width,b.height,false);L.cam=castCam(b.width/b.height,L.yaw)}
function stopLive(){const L=G3.live;if(L&&L.raf){cancelAnimationFrame(L.raf);L.raf=0}}
const RM=window.matchMedia?window.matchMedia('(prefers-reduced-motion: reduce)'):{matches:false};
function loop(){const L=G3.live;if(!L.el||!L.el.isConnected){L.raf=0;return}
 const t=(performance.now()-L.t0)/1000;if(!L.drag){L.vel*=.92;L.yaw+=L.vel;if(!RM.matches)L.yaw+=Math.sin(t*.35)*.0009}
 const b=L.el.getBoundingClientRect();L.cam=castCam(b.width/Math.max(1,b.height),L.yaw);
 const A=L.obj.userData.anim;if(!RM.matches){A.flags.forEach((f,i)=>{f.children.forEach(c=>{if(c.userData.flag)c.rotation.y=Math.sin(t*2.4+i)*.25})});A.spin.forEach(s=>{if(s.spin)s.o.rotation.y=t*.8;if(s.bob)s.o.position.y=s.y+Math.sin(t*1.6)*.15});A.workers.forEach(w=>w.o.position.y=w.y+Math.abs(Math.sin(t*3))*.12);A.confetti.forEach((p,i)=>{p.position.y-=.02+rnd(i)*.02;p.rotation.x+=.04;p.rotation.y+=.03;if(p.position.y<.5)p.position.y=13})}
 L.r.render(L.scene,L.cam);L.raf=requestAnimationFrame(loop)}

/* ---------- views ---------- */
const coinChip=n=>`<span class="chip gold num"><i class="coin"></i>${n} เหรียญ</span>`;
function loginView(){
 if(S.boot==='noconfig')return `<div class="panel"><h1>ยังไม่ได้ตั้งค่า Firebase</h1><p>เปิดไฟล์ <code>js/config.js</code> แล้ววางค่า firebaseConfig ของโปรเจกต์ ตามคู่มือใน README</p></div>`;
 if(S.boot==='loading')return `<div class="panel" style="text-align:center;padding:48px 16px"><span class="brand">เกมสร้างปราสาท</span><p class="muted">กำลังโหลดข้อมูล…</p></div>`;
 if(S.boot==='pending')return `<div class="panel" style="display:flex;flex-direction:column;gap:10px"><h2>${S.bootMsg?esc(S.bootMsg):'รอผู้ดูแลระบบอนุมัติ'}</h2><p class="muted" style="margin:0">บัญชี ${esc(auth.currentUser?.email||'')} ${S.bootMsg?'':'สมัครแล้ว เมื่อผู้ดูแลกดอนุมัติ ให้รีเฟรชหน้านี้แล้วเข้าใช้งานได้ทันที'}</p><div class="row"><button class="btn" data-act="reload">รีเฟรช</button><button class="btn ghost" data-act="logout">ออกจากระบบ</button></div></div>`;
 return `<div class="hero">
  <div style="display:flex;flex-direction:column;gap:12px">
   <span class="brand">เกมสร้างปราสาท</span>
   <h1>ทุกคะแนนคืออิฐหนึ่งก้อนของปราสาท</h1>
   <p class="muted" style="margin:0;max-width:52ch">${SCHOOL.name?esc(SCHOOL.name)+' · ':''}${esc(EMPTY_SUB.settings.term)}</p>
   ${S.bootMsg?`<div class="banner" style="background:var(--crit-soft)"><b>${esc(S.bootMsg)}</b></div>`:''}
   <div class="panel" style="display:flex;flex-direction:column;gap:10px"><h3>นักเรียน</h3>
    <div class="row"><button class="btn primary" data-act="scan-open">สแกนบัตรด้วยกล้อง</button><label class="btn" for="scan-file" style="cursor:pointer">อัปโหลดรูปบัตร</label><input type="file" id="scan-file" accept="image/*" hidden data-act-change="scanfile"></div>
    <label class="row small" style="gap:6px"><input type="checkbox" id="personal" data-act-change="personal" ${S.personal?'checked':''}> เครื่องส่วนตัว (จำการเข้าสู่ระบบไว้) ถ้าเป็นเครื่องของห้องเรียน ไม่ต้องติ๊ก</label></div>
   <div class="panel" style="display:flex;flex-direction:column;gap:8px"><h3>ครูและผู้ดูแลระบบ</h3><span class="small muted">ใช้บัญชี Google ครูที่สมัครใหม่ต้องรอผู้ดูแลอนุมัติ</span><div><button class="btn primary" data-act="login-google">เข้าสู่ระบบด้วย Google</button></div></div>
  </div>
  ${castleView(7,.5,{outfit:'out_knight',pet:'pet_owl',flag:'flag_blue',decor:['dec_cart_wood','dec_lamp','dec_fountain','dec_tree']},'ตัวอย่างปราสาท','main')}
 </div>`;
}
function subjSelect(st){const list=st?enrolled(st):S.subjects;if(!list.length)return '';
 return `<label class="row small" style="gap:6px">วิชา<select id="subj-switch" data-act-change="subj">${list.map(x=>`<option value="${x.id}" ${x.id===S.subId?'selected':''}>${esc(x.settings.subject)} ${esc(x.settings.code)}</option>`).join('')}</select></label>`}
function topBar(){
 const u=S.user;const st=u.role==='student'?stu(u.id):null;
 return `<div class="top"><span class="brand">เกมสร้างปราสาท</span><span class="muted small">${u.role==='admin'?'จัดการข้อมูลกลางของโรงเรียน · '+esc(S.settings.term):(S.subId==='__none'?'':esc(S.settings.subject)+' '+esc(S.settings.code)+' · ')+esc(S.settings.term)}</span><span class="grow"></span>
  ${u.role==='admin'?'<span class="chip gold">ผู้ดูแลระบบ</span>':subjSelect(st)+(st?`${coinChip(st.coins)}<span class="chip">${esc(st.name)} · ${st.room}</span>`:`<span class="chip">${esc(S.me?.name||'ครูผู้สอน')}</span>`)}
  ${S.me&&S.me.isAdmin?`<button class="btn sm" data-act="role-swap">${u.role==='admin'?'ไปหน้าครู':'ไปหน้าผู้ดูแล'}</button>`:''}
  <button class="btn sm ghost" data-act="logout">ออกจากระบบ</button></div>`;
}
function tabs(list){return `<div class="tabs" role="tablist">${list.map(([k,l,b])=>`<button class="tab" role="tab" aria-selected="${S.tab===k}" data-act="tab" data-k="${k}">${l}${b?`<span class="badge num">${b}</span>`:''}</button>`).join('')}</div>`}

/* student */
function studentApp(){
 const st=stu(S.user.id);
 if(!enrolled(st).length)return topBar()+`<div class="panel"><h2>ยังไม่มีรายวิชา</h2><p class="muted">ห้อง ${st.room} ยังไม่มีครูเพิ่มเข้ารายวิชาใด</p></div>`;
 if(!S.rooms.includes(st.room))useSubject(enrolled(st)[0].id);const v=villageOpen(st.room);
 const myTrades=S.trades.filter(t=>t.status==='pending'&&(t.from===st.id||t.to===st.id)).length;
 const T=[['castle','ปราสาทของฉัน'],['quests','ภารกิจ'],['shop','ร้านค้า'],['bag','กระเป๋า',myTrades]];if(v)T.push(['village','หมู่บ้าน']);
 if(S.tab==='village'&&!v)S.tab='castle';
 const body={castle:sCastle,quests:sQuests,shop:sShop,bag:sBag,village:sVillage}[S.tab](st);
 return topBar()+tabs(T)+body;
}
function sCastle(st){
 const I=stageInfo(st);const v=villageOpen(st.room);
 const steps=STAGES.map((n,i)=>{const cls=i<I.stage?'done':i===I.stage?'now':'todo';const at=Math.ceil(i*I.max/10);
  return `<li class="${i<=I.stage?(i===I.stage?'now':'done'):'todo'}"><span class="dot">${i}</span><span>${n}</span><span class="small muted num">${at}</span></li>`}).join('');
 const catRows=cats().map((c,i)=>c.visible&&c.castle?`<span>${esc(c.name)}</span><b class="num">${catScore(st,i)}/${c.max}</b>`:'').join('');
 return `${v?`<div class="banner"><b>หมู่บ้านเปิดแล้ว: ${esc(v.name)}</b><span class="small">เหลือเวลา ${daysLeft(v)} ไปเยี่ยมปราสาทเพื่อนและแลกไอเท็มได้</span><span class="grow"></span><button class="btn sm primary" data-act="tab" data-k="village">ไปที่หมู่บ้าน</button></div>`:''}
 <div class="stage-card">
  <div class="panel" style="display:flex;flex-direction:column;gap:12px">
   <div class="section-title"><h2>ขั้น ${I.stage}: ${STAGES[I.stage]}</h2><span class="chip num">${I.sc}/${I.max} คะแนน</span></div>
   ${castleView(I.stage,I.frac,st.eq,`ปราสาทของ ${st.name} ขั้น ${I.stage}`,'main')}
   <div><div class="bar" role="progressbar" aria-valuenow="${I.sc}" aria-valuemin="0" aria-valuemax="${I.max}"><i style="width:${(I.pct*100).toFixed(1)}%"></i></div>
   <div class="ticks num">${[...Array(10)].map((_,i)=>`<span>${(i+1)*10}%</span>`).join('')}</div></div>
   <p style="margin:0">${I.stage>=10?'<b>ปราสาทสมบูรณ์แบบแล้ว</b> เก่งมาก!':`อีก <b class="num">${I.toNext}</b> คะแนน จะสร้าง <b>${STAGES[I.stage+1]}</b> เสร็จ`}</p>
  </div>
  <div style="display:flex;flex-direction:column;gap:16px;min-width:0">
   <div class="panel"><h3 style="margin-bottom:8px">คะแนนที่สะสม</h3><div class="kv">${catRows}<span class="muted">เหรียญพิเศษ</span><b class="num">${st.coins}</b></div></div>
   <div class="panel"><h3 style="margin-bottom:8px">ขั้นการสร้าง</h3><ol class="steps">${steps}</ol></div>
  </div>
 </div>`;
}
function questRow(st,q){
 const reward=q.cat==null?`<span class="chip gold num"><i class="coin"></i>+${q.coins}</span>`:`<span class="chip num">+${q.points} คะแนน</span>`;
 let status;
 if(q.cat==null){status=st.special.includes(q.id)?`<span class="chip good">สำเร็จแล้ว</span>`:pendingClaim(st.id,q.id)?`<span class="chip warn">รอครูอนุมัติ</span>`:`<button class="btn sm primary" data-act="claim" data-q="${q.id}">แจ้งทำเสร็จ</button>`}
 else if(st.scores[q.id]!=null)status=`<span class="chip good num">ได้ ${st.scores[q.id]}/${q.points}</span>`;
 else if(pendingClaim(st.id,q.id))status=`<span class="chip warn">รอครูอนุมัติ</span>`;
 else status=q.claim?`<button class="btn sm primary" data-act="claim" data-q="${q.id}">แจ้งทำเสร็จ</button>`:`<span class="small muted">ครูเป็นผู้ให้คะแนน</span>`;
 return `<div class="item"><div class="grow"><b>${esc(q.name)}</b><div class="small muted">${q.cat==null?'ภารกิจพิเศษ':esc(cats()[q.cat].name)}</div></div>${reward}${status}</div>`;
}
function sQuests(st){
 const main=S.quests.filter(q=>q.cat!=null&&cats()[q.cat]&&cats()[q.cat].visible),sp=S.quests.filter(q=>q.cat==null);
 return `<div class="panel"><div class="section-title"><h2>ภารกิจหลัก</h2><span class="small muted">นับเข้าปราสาท</span></div><div class="list">${main.map(q=>questRow(st,q)).join('')}</div></div>
 <div class="panel"><div class="section-title"><h2>ภารกิจพิเศษ</h2><span class="small muted">ได้เหรียญไว้ซื้อของ</span></div><div class="list">${sp.map(q=>questRow(st,q)).join('')}</div></div>`;
}
function sShop(st){
 const stage=stageInfo(st).stage;
 const cards=ITEMS.map(it=>{let act;
  if(st.inv.includes(it.id))act=`<span class="chip good">มีแล้ว</span>`;
  else if(stage<it.lock)act=`<span class="chip">ปลดล็อกที่ขั้น ${it.lock}</span>`;
  else if(st.coins<it.price)act=`<button class="btn sm" disabled>เหรียญไม่พอ</button>`;
  else act=`<button class="btn sm primary" data-act="buy" data-i="${it.id}">ซื้อ</button>`;
  return `<div class="card">${iconSVG(it.id)}<div class="grow" style="display:flex;flex-direction:column;gap:4px"><span class="t">${it.name}</span><span class="small muted">${TYPE[it.type]} · ${tier(it.price)}${it.lock?` · ต้องถึงขั้น ${it.lock}`:''}</span><div class="row" style="gap:6px"><span class="chip gold num"><i class="coin"></i>${it.price}</span>${act}</div></div></div>`}).join('');
 return `<div class="panel"><div class="section-title"><h2>ร้านค้า</h2>${coinChip(st.coins)}</div></div><div class="grid shop">${cards}</div>`;
}
function sBag(st){
 const cards=st.inv.map(id=>{const it=item(id);const on=it.type==='decor'?st.eq.decor.includes(id):st.eq[it.type]===id;const lockT=inTrade(st.id,id);
  return `<div class="card" style="flex-direction:row;align-items:center">${iconSVG(id)}<div class="grow" style="display:flex;flex-direction:column;gap:4px"><span class="t">${it.name}</span><span class="small muted">${TYPE[it.type]}${it.lock?' · แลกไม่ได้':''}</span><div>${lockT?`<span class="chip warn">อยู่ในคำขอแลก</span>`:`<button class="btn sm ${on?'':'primary'}" data-act="equip" data-i="${id}">${on?'ถอดออก':'ใช้งาน'}</button>`}</div></div></div>`}).join('')||`<p class="muted">ยังไม่มีไอเท็ม ทำภารกิจพิเศษเพื่อเก็บเหรียญแล้วไปซื้อที่ร้านค้า</p>`;
 const tr=S.trades.filter(t=>t.from===st.id||t.to===st.id).slice().reverse();
 const trRows=tr.map(t=>{const mine=t.from===st.id;const other=stu(mine?t.to:t.from);const give=mine?t.give:t.get,get=mine?t.get:t.give;
  const sc={pending:'<span class="chip warn">รอครูอนุมัติ</span>',approved:'<span class="chip good">แลกสำเร็จ</span>',rejected:'<span class="chip crit">ครูไม่อนุมัติ</span>'}[t.status];
  return `<div class="item"><div class="grow">ให้ <b>${item(give).name}</b> แลกกับ <b>${item(get).name}</b> ของ ${esc(other?other.name:(mine?t.to:t.from))}</div>${sc}</div>`}).join('')||`<p class="muted small">ยังไม่มีการแลกไอเท็ม</p>`;
 return `<div class="panel"><h2 style="margin-bottom:12px">กระเป๋าไอเท็ม</h2><div class="grid">${cards}</div></div>
 <div class="panel"><div class="section-title"><h2>การแลกไอเท็ม</h2><span class="small muted">แลกได้เฉพาะช่วงเปิดหมู่บ้าน</span></div><div class="list">${trRows}</div></div>`;
}
function villageCastle(s,mode='thumb'){const p=s.pubBy&&s.pubBy[S.subId];const I=s.mate&&p?{stage:p.stage||0,frac:p.frac||0}:stageInfo(s);return S.settings.villageMode==='decor'?castleView(10,0,s.eq,`ปราสาทของ ${s.name}`,mode):castleView(I.stage,I.frac,s.eq,`ปราสาทของ ${s.name}`,mode)}
function sVillage(st){
 const v=villageOpen(st.room);const mates=ACT().filter(s=>s.room===st.room);
 return `<div class="banner"><b>${esc(v.name)}</b><span class="small">หมู่บ้าน ${st.room} · ปิดในอีก ${daysLeft(v)}</span><span class="grow"></span><span class="small">แลกได้วันละ ${S.settings.tradeLimit} ครั้ง</span></div>
 <div class="grid">${mates.map(s=>`<button class="card" data-act="visit" data-id="${s.id}">${villageCastle(s)}<span class="t">${esc(s.name)}${s.id===st.id?' (ฉัน)':''}</span><span class="small muted">ได้สติกเกอร์ ${s.stickers} ชิ้น</span></button>`).join('')}</div>`;
}

/* teacher */
function teacherApp(){
 if(S.subId==='__none'&&S.tab!=='settings')S.tab='settings';
 const pend=S.claims.filter(c=>c.status==='pending').length+S.trades.filter(t=>t.status==='pending').length;
 const body=S.subId==='__none'?subjPanel():({overview:tOverview,approve:tApprove,village:tVillage,settings:tSettings}[S.tab]());
 return topBar()+tabs([['overview','ภาพรวมห้อง'],['approve','อนุมัติ/คะแนน',pend],['village','หมู่บ้าน'],['settings','ตั้งค่าวิชา']])+body;
}
function tOverview(){
 if(!S.rooms.length)return `<div class="panel"><h2>ยังไม่ได้เลือกห้องที่สอน</h2><p class="muted">ไปที่ ตั้งค่าวิชา แล้วเลือกห้องที่สอนก่อน</p><button class="btn sm primary" data-act="tab" data-k="settings">ไปที่ตั้งค่าวิชา</button></div>`;
 let list=ACT().filter(s=>s.room===S.room);
 const R=list.map(s=>[s,risk(s),stageInfo(s)]);
 const cnt={good:0,warn:0,crit:0};R.forEach(r=>cnt[r[1].k]++);
 if(S.sort==='low')R.sort((a,b)=>a[2].sc-b[2].sc);else R.sort((a,b)=>a[0].no-b[0].no);
 const roomTabs=S.rooms.map(r=>`<button class="btn sm ${r===S.room?'primary':''}" data-act="room" data-r="${r}">${r}</button>`).join('');
 return `<div class="row between"><div class="row">${roomTabs}</div><div class="row small"><span class="chip good">ปลอดภัย ${cnt.good}</span><span class="chip warn">ต้องทำปลายภาค ${cnt.warn}</span><span class="chip crit">เสี่ยง ${cnt.crit}</span>
  <button class="btn sm" data-act="cards-room">บัตร QR ห้อง ${S.room}</button>
  <label class="row" style="gap:6px">เรียง <select id="sort" data-act-change="sort"><option value="no" ${S.sort==='no'?'selected':''}>เลขที่</option><option value="low" ${S.sort==='low'?'selected':''}>คะแนนน้อยสุด</option></select></label></div></div>
 ${R.length?'':'<div class="panel muted">ห้องนี้ยังไม่มีรายชื่อนักเรียน ผู้ดูแลนำเข้าได้จากห้องเรียนกลาง</div>'}<div class="grid">${R.map(([s,r,I])=>`<button class="card risk-${r.k}" data-act="detail" data-id="${s.id}">${castleView(I.stage,I.frac,s.eq,`ปราสาทของ ${s.name}`,'thumb')}<span class="t">${s.no}. ${esc(s.name)}</span><span class="small muted num">ขั้น ${I.stage} · ${I.sc}/${I.max} คะแนน</span><span class="chip ${r.k}">${r.label}</span></button>`).join('')}</div>
 <p class="small muted" style="margin:0">สถานะคำนวณจากเกณฑ์ผ่าน ${S.settings.pass} คะแนน และคะแนนปลายภาคเต็ม ${hiddenMax()} ที่นักเรียนไม่เห็น</p>`;
}
function apCell(st,q){
 const pend=pendingClaim(st.id,q.id);let c;
 if(q.cat==null)c=`<input type="checkbox" class="ck" id="g-${st.id}-${q.id}" data-g="sp|${st.id}|${q.id}" ${st.special.includes(q.id)?'checked':''} aria-label="${esc(st.name)} ${esc(q.name)}">`;
 else if(q.input==='check')c=`<input type="checkbox" class="ck" id="g-${st.id}-${q.id}" data-g="ck|${st.id}|${q.id}" ${st.scores[q.id]!=null?'checked':''} aria-label="${esc(st.name)} ${esc(q.name)}">`;
 else c=`<input type="number" class="gi num" id="g-${st.id}-${q.id}" data-g="sc|${st.id}|${q.id}" min="0" max="${q.points}" value="${st.scores[q.id]??''}" placeholder="-" aria-label="${esc(st.name)} ${esc(q.name)}">`;
 return {html:c,pend};
}
function apTotal(st){const I=stageInfo(st);return `<b class="num">${I.sc}</b><span class="muted num">/${I.max}</span>`}
function apCols(){
 const C=cats(),cols=[];
 C.forEach((c,i)=>{if(!c.castle&&!S.quests.some(q=>q.cat===i))return;
  const ck=S.quests.filter(q=>q.cat===i&&q.input==='check'),sc=S.quests.filter(q=>q.cat===i&&q.input!=='check');
  if(ck.length)cols.push({label:`${c.name} · ติ๊กถูก`,qs:ck});if(sc.length)cols.push({label:`${c.name} · กรอกคะแนน`,qs:sc})});
 const sp=S.quests.filter(q=>q.cat==null);if(sp.length)cols.push({label:'ภารกิจพิเศษ · ให้เหรียญ',qs:sp});
 return cols;
}
function tApprove(){
 if(!S.rooms.length)return tOverview();
 const roomStu=ACT().filter(s=>s.room===S.room).sort((a,b)=>a.no-b.no);
 const pendRoom=S.claims.filter(c=>c.status==='pending'&&stu(c.sid)&&stu(c.sid).room===S.room);
 const view=`<div class="row between"><div class="row">${S.rooms.map(r=>`<button class="btn sm ${r===S.room?'primary':''}" data-act="room" data-r="${r}">${r}</button>`).join('')}</div>
  <div class="seg" role="group" aria-label="มุมมอง"><button class="${S.apView==='room'?'on':''}" data-act="apview" data-v="room">ทั้งห้อง</button><button class="${S.apView==='person'?'on':''}" data-act="apview" data-v="person">รายบุคคล</button></div></div>
  <div class="row small"><span class="chip warn" id="pend-chip">รออนุมัติ ${pendRoom.length} รายการ</span><span class="muted">ช่องสีเหลือง = นักเรียนแจ้งทำเสร็จแล้ว ติ๊กหรือกรอกคะแนนเพื่ออนุมัติ · กด Enter เพื่อลงไปคนถัดไป</span><span class="grow"></span>${pendRoom.some(c=>{const q=quest(c.qid);return q.cat==null||q.input==='check'})?`<button class="btn sm good" data-act="ap-pend">อนุมัติที่รอทั้งหมด (ติ๊กถูก)</button>`:''}
  <button class="btn sm" data-act="xl-room">ดาวน์โหลด Excel ${S.room}</button><button class="btn sm" data-act="xl-all">ทุกห้อง (แยกชีต)</button></div>`;
 let body;
 if(!roomStu.length)body=`<div class="panel muted">ห้องนี้ยังไม่มีรายชื่อนักเรียน</div>`;
 else if(S.apView==='room'){
  const cols=apCols();
  const h1=cols.map(g=>`<th colspan="${g.qs.length}" class="grp">${esc(g.label)}</th>`).join('');
  const h2=cols.flatMap(g=>g.qs.map(q=>`<th class="qh"><span>${esc(q.short||q.name)}</span><small class="muted num">${q.cat==null?q.coins+' เหรียญ':q.points+' คะแนน'}</small>${q.cat==null||q.input==='check'?`<button class="btn sm ghost" data-act="col-all" data-q="${q.id}" title="ติ๊กให้ทุกคนในห้อง">ทั้งห้อง</button>`:''}</th>`)).join('');
  const rows=roomStu.map(st=>`<tr><td class="nm"><button class="linkbtn" data-act="ap-person" data-id="${st.id}">${st.no}. ${esc(st.name)}</button></td>${cols.flatMap(g=>g.qs.map(q=>{const c=apCell(st,q);return `<td class="cc ${c.pend?'pend':''}">${c.html}</td>`})).join('')}<td class="tot" id="tot-${st.id}">${apTotal(st)}</td></tr>`).join('');
  body=`<div class="panel" style="padding:0"><div class="tablewrap"><table class="gt"><thead><tr><th rowspan="2" class="nm">รายชื่อ</th>${h1}<th rowspan="2" class="tot">รวม</th></tr><tr>${h2}</tr></thead><tbody>${rows}</tbody></table></div></div>`;
 } else {
  if(!roomStu.some(s=>s.id===S.apStudent))S.apStudent=roomStu[0].id;
  const st=stu(S.apStudent),idx=roomStu.indexOf(st),I=stageInfo(st);
  const groups=apCols().map(g=>`<div class="pgrp"><h3>${esc(g.label)}</h3>${g.qs.map(q=>{const c=apCell(st,q);return `<label class="prow ${c.pend?'pend':''}" for="g-${st.id}-${q.id}"><span class="grow">${esc(q.name)}${c.pend?' <span class="chip warn">แจ้งทำเสร็จแล้ว</span>':''}</span><span class="small muted num">${q.cat==null?q.coins+' เหรียญ':'เต็ม '+q.points}</span>${c.html}</label>`}).join('')}</div>`).join('');
  body=`<div class="panel" style="display:flex;flex-direction:column;gap:14px">
   <div class="row"><button class="btn sm" data-act="ap-step" data-d="-1" ${idx<=0?'disabled':''} aria-label="คนก่อนหน้า">‹</button>
   <select id="ap-stu" data-act-change="apstu" aria-label="เลือกนักเรียน">${roomStu.map(s=>`<option value="${s.id}" ${s.id===st.id?'selected':''}>${s.no}. ${esc(s.name)}</option>`).join('')}</select>
   <button class="btn sm" data-act="ap-step" data-d="1" ${idx>=roomStu.length-1?'disabled':''} aria-label="คนถัดไป">›</button><span class="grow"></span>
   <span class="small">รวม</span><span id="tot-${st.id}">${apTotal(st)}</span><span class="chip">ขั้น ${I.stage}</span><span class="chip ${risk(st).k}">${risk(st).label}</span></div>
   <div class="pgrid">${groups}</div></div>`;
 }
 const tr=S.trades.filter(t=>t.status==='pending');
 const tRows=tr.filter(t=>stu(t.from)&&stu(t.to)).map(t=>{const a=stu(t.from),b=stu(t.to);return `<div class="item"><div class="grow"><b>${esc(a.name)}</b> ให้ ${item(t.give).name} ↔ <b>${esc(b.name)}</b> ให้ ${item(t.get).name}<div class="small muted">${a.room} · ทั้งสองฝ่ายยืนยันแล้ว · ของถูกกันไว้ระหว่างรอ</div></div><button class="btn sm good" data-act="tr-ok" data-t="${t.id}">อนุมัติ</button><button class="btn sm" data-act="tr-no" data-t="${t.id}">ไม่อนุมัติ</button></div>`}).join('')||`<p class="muted small">ไม่มีคำขอแลกไอเท็ม</p>`;
 return view+body+`<div class="panel"><div class="section-title"><h2>คำขอแลกไอเท็ม</h2></div><div class="list">${tRows}</div></div>`;
}
function tVillage(){
 const rooms=S.rooms.map(r=>{const v=villageOpen(r);
  return `<div class="panel" style="display:flex;flex-direction:column;gap:10px"><div class="section-title"><h3>หมู่บ้าน ${r}</h3>${v?'<span class="chip good">เปิดอยู่</span>':'<span class="chip">ปิด</span>'}</div>
  ${v?`<span>${esc(v.name)} · เหลือ ${daysLeft(v)}</span><div class="row"><button class="btn sm" data-act="v-ext" data-r="${r}">ขยายเวลา 3 วัน</button><button class="btn sm" data-act="v-close" data-r="${r}">ปิดตอนนี้</button></div>`
   :`<label class="small muted" for="vname-${r.replace('/','-')}">ชื่อรอบ</label><input type="text" id="vname-${r.replace('/','-')}" value="ฉลองจบบทเรียน"><div><button class="btn sm primary" data-act="v-open" data-r="${r}">เปิดหมู่บ้าน 7 วัน</button></div>`}</div>`}).join('');
 const log=S.trades.filter(t=>t.status!=='pending').slice().reverse().map(t=>`<div class="item small"><div class="grow">${esc(stu(t.from).name)} ↔ ${esc(stu(t.to).name)} · ${item(t.give).name} / ${item(t.get).name}</div><span class="chip ${t.status==='approved'?'good':'crit'}">${t.status==='approved'?'อนุมัติ':'ไม่อนุมัติ'}</span></div>`).join('')||'<p class="muted small">ยังไม่มีประวัติ</p>';
 return `<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(260px,1fr))">${rooms}</div>
 <div class="panel" style="display:flex;flex-direction:column;gap:8px"><h3>การแสดงปราสาทในหมู่บ้าน</h3>
  <label class="row" style="gap:8px"><input type="radio" name="vmode" id="vm-full" value="full" ${S.settings.villageMode==='full'?'checked':''} data-act-change="vmode"> แสดงเต็มตามขั้นจริง</label>
  <label class="row" style="gap:8px"><input type="radio" name="vmode" id="vm-decor" value="decor" ${S.settings.villageMode==='decor'?'checked':''} data-act-change="vmode"> โชว์ของตกแต่งอย่างเดียว (ทุกคนแสดงปราสาทแบบเดียวกัน เพื่อนเดาคะแนนไม่ได้)</label></div>
 <div class="panel"><h3 style="margin-bottom:6px">บันทึกการแลก</h3><div class="list">${log}</div></div>`;
}
function subjPanel(){
 const cards=S.subjects.map(x=>{const on=x.id===S.subId;const n=ACT().filter(st=>x.rooms.includes(st.room)).length;const mx=x.settings.cats.reduce((a,c)=>a+(c.castle?+c.max||0:0),0);
  return `<button class="card subj ${on?'on':''}" data-act="subj-pick" data-id="${x.id}" aria-pressed="${on}"><span class="t">${esc(x.settings.subject)}</span><span class="small muted">${esc(x.settings.code||'ยังไม่ใส่รหัส')} · ${x.settings.level}</span><span class="small">${x.rooms.length?x.rooms.join(', '):'ยังไม่เลือกห้อง'}</span><span class="small muted num">นักเรียน ${n} คน · ปราสาทเต็ม ${mx}</span>${on?'<span class="chip good" style="align-self:flex-start">กำลังแก้ไข</span>':''}</button>`}).join('');
 return `<div class="panel" style="display:flex;flex-direction:column;gap:12px"><div class="section-title"><h2>รายวิชาของฉัน</h2><button class="btn sm primary" data-act="subj-new">สร้างรายวิชาใหม่</button></div>
  <div class="grid">${cards}</div><span class="small muted">แต่ละวิชามีเกณฑ์คะแนน งาน ปราสาท เหรียญ และไอเท็มแยกกัน นักเรียนห้องเดียวกันเรียนหลายวิชาได้ด้วยบัตรใบเดียว</span></div>`;
}
function tSettings(){
 const C=cats();const total=C.reduce((a,c)=>a+(Number(c.max)||0),0);
 const rows=C.map((c,i)=>{const used=S.quests.some(q=>q.cat===i);return `<tr><td><input type="text" id="cn${i}" value="${esc(c.name)}" data-cat="${i}|name"></td><td><input type="number" id="cm${i}" min="0" value="${c.max}" data-cat="${i}|max"></td>
  <td><input type="checkbox" id="cv${i}" ${c.visible?'checked':''} data-cat="${i}|visible" aria-label="นักเรียนเห็น"></td><td><input type="checkbox" id="cc${i}" ${c.castle?'checked':''} data-cat="${i}|castle" aria-label="นับเข้าปราสาท"></td>
  <td><button class="btn sm" data-act="cat-del" data-i="${i}" ${used?'disabled title="มีงานในหมวดนี้"':''}>ลบ</button></td></tr>`}).join('');
 const qs=C.map((c,i)=>{const list=S.quests.filter(q=>q.cat===i);const sum=list.reduce((a,q)=>a+q.points,0);
  const msg=!c.castle&&!list.length?`<span class="small muted">ใช้เป็นเกณฑ์เท่านั้น ครูไม่ได้กรอกผ่านระบบ</span>`:sum===Number(c.max)?`<span class="okline">รวม ${sum}/${c.max} ครบแล้ว</span>`:`<span class="warnline">รวม ${sum}/${c.max} ${sum<c.max?'ยังขาด '+(c.max-sum):'เกิน '+(sum-c.max)}</span>`;
  return `<div style="margin-top:10px"><div class="section-title"><b>${esc(c.name)}</b>${msg}</div>${list.map(q=>`<div class="item small"><span class="grow">${esc(q.name)}</span><button class="btn sm ghost" data-act="q-del" data-q="${q.id}" title="ลบงาน">ลบ</button><span class="num">${q.points} คะแนน</span><span class="muted">${q.input==='check'?'ติ๊กถูก':'กรอกคะแนน'} · ${q.claim?'นักเรียนกดรับได้':'ครูให้คะแนน'}</span></div>`).join('')}</div>`}).join('');
 const sp=S.quests.filter(q=>q.cat==null).map(q=>`<div class="item small"><span class="grow">${esc(q.name)}</span><button class="btn sm ghost" data-act="q-del" data-q="${q.id}" title="ลบงาน">ลบ</button><span class="num">${q.coins} เหรียญ</span></div>`).join('');
 return subjPanel()+`<div class="panel" style="display:flex;flex-direction:column;gap:12px">
  <div class="section-title"><h2>ข้อมูลวิชา: ${esc(S.settings.subject)}</h2>${S.subjects.length>1?(S.confirmDel?`<span class="row small"><span class="warnline">ลบวิชานี้และคะแนนทั้งหมด?</span><button class="btn sm" data-act="subj-del-yes" style="color:var(--crit)">ยืนยันลบ</button><button class="btn sm" data-act="subj-del-no">ยกเลิก</button></span>`:`<button class="btn sm ghost" data-act="subj-del">ลบรายวิชานี้</button>`):''}</div><div class="row">
  <label class="field">ชื่อวิชา<input type="text" id="subj" value="${esc(S.settings.subject)}" data-set="subject"></label>
  <label class="field">รหัสวิชา<input type="text" id="scode" value="${esc(S.settings.code)}" data-set="code" placeholder="เช่น ว31101"></label>
  <label class="field">ระดับชั้น<select id="slevel" data-set="level">${LEVELS.map(l=>`<option ${l===S.settings.level?'selected':''}>${l}</option>`).join('')}</select></label></div>
  <div class="field">ห้องที่สอน<div class="row" style="gap:6px">${[...Array(8)].map((_,i)=>{const r=`${S.settings.level}/${i+1}`;const n=ACT().filter(x=>x.room===r).length;return `<label class="pick"><input type="checkbox" id="room-${i+1}" data-room="${r}" ${S.rooms.includes(r)?'checked':''}><span>${r}<small class="muted"> ${n?n+' คน':'ไม่มีรายชื่อ'}</small></span></label>`}).join('')}</div>
  ${S.rooms.length?'':'<span class="warnline">ยังไม่ได้เลือกห้องที่สอน</span>'}</div>
  <div class="row"><label class="field">เกณฑ์ผ่าน<input type="number" id="pass" value="${S.settings.pass}" data-set="pass"></label>
  <label class="field">แลกไอเท็มต่อวัน<input type="number" id="tlim" value="${S.settings.tradeLimit}" data-set="tradeLimit"></label></div></div>
 <div class="panel"><div class="section-title"><h2>หมวดคะแนน</h2><button class="btn sm" data-act="cat-add">เพิ่มหมวด</button></div>
  <div class="tablewrap"><table><thead><tr><th>หมวด</th><th>คะแนนเต็ม</th><th>นักเรียนเห็น</th><th>นับเข้าปราสาท</th><th></th></tr></thead><tbody>${rows}
  <tr><td><b>รวม</b></td><td class="num"><b>${total}</b></td><td colspan="3" class="small">ปราสาทเต็มที่ <b class="num">${castleMax()}</b> คะแนน · ขึ้นขั้นทุก <span class="num">${(castleMax()/10).toFixed(1).replace('.0','')}</span> คะแนน</td></tr></tbody></table></div>
  ${total!==100?`<p class="warnline" style="margin:8px 0 0">คะแนนรวมทุกหมวดเป็น ${total} ไม่เท่ากับ 100</p>`:''}</div>
 <div class="panel"><div class="section-title"><h2>รายการงาน</h2></div>${qs}
  <div style="margin-top:14px"><b>ภารกิจพิเศษ (เหรียญ)</b>${sp}</div>
  <div class="row" style="margin-top:14px;padding-top:12px;border-top:1px solid var(--line)">
   <input type="text" id="nq-name" placeholder="ชื่องานใหม่" aria-label="ชื่องานใหม่">
   <select id="nq-cat" aria-label="หมวด">${C.map((c,i)=>`<option value="${i}">${esc(c.name)}</option>`).join('')}<option value="sp">ภารกิจพิเศษ (เหรียญ)</option></select>
   <input type="number" id="nq-pts" value="5" min="1" aria-label="คะแนนหรือเหรียญ">
   <select id="nq-input" aria-label="วิธีให้คะแนน"><option value="check">ติ๊กถูก (ได้เต็ม)</option><option value="score">กรอกคะแนน</option></select>
   <label class="row small" style="gap:4px"><input type="checkbox" id="nq-claim" checked> นักเรียนกดรับได้</label>
   <button class="btn sm primary" data-act="q-add">เพิ่มงาน</button></div></div>`;
}

/* ---------- admin (school data: rooms, roster import, QR cards, teacher approval) ---------- */
const allRooms=()=>[...new Set(S.students.map(s=>s.room))].sort((a,b)=>a.localeCompare(b,'th',{numeric:true}));
const fullName=st=>`${st.prefix||''}${st.name}${st.last?' '+st.last:''}`;
function adminApp(){const pend=S.teachers.filter(t=>t.status==='pending').length;
 const body={rooms:aRooms,import:aImport,cards:aCards,teachers:aTeachers}[S.tab]();
 return topBar()+tabs([['rooms','ห้องเรียนกลาง'],['import','นำเข้ารายชื่อ'],['cards','บัตร QR'],['teachers','อนุมัติครู',pend]])+body}
function aRooms(){const A=S.adm;const rooms=allRooms();const lvls=LEVELS.filter(l=>rooms.some(r=>r.startsWith(l+'/')));if(!lvls.includes(A.level))A.level=lvls[0]||'ม.4';
 const lr=rooms.filter(r=>r.startsWith(A.level+'/'));if(!lr.includes(A.room))A.room=lr[0]||null;
 const list=S.students.filter(s=>s.room===A.room).sort((a,b)=>a.no-b.no);
 const sum=LEVELS.map(l=>{const n=ACT().filter(s=>s.room.startsWith(l+'/')).length,rc=rooms.filter(r=>r.startsWith(l+'/')).length;return n?`<button class="card ${l===A.level?'subj on':''}" data-act="a-level" data-l="${l}"><span class="t">${l}</span><span class="small muted num">${rc} ห้อง · ${n} คน</span></button>`:''}).join('');
 const rows=list.map(st=>`<tr class="${st.active===false?'off':''}"><td class="num">${st.no}</td><td class="num">${st.id}</td><td>${esc(fullName(st))}</td><td>${st.active===false?'<span class="chip">ไม่ใช้งาน</span>':st.uid?'<span class="chip good">ใช้งาน</span>':'<span class="chip warn">ยังไม่มีบัญชี</span>'}</td>
  <td class="row" style="gap:4px;flex-wrap:nowrap">${st.active===false?`<button class="btn sm" data-act="a-on" data-id="${st.id}">เปิดใช้งาน</button>`:`<button class="btn sm" data-act="card-one" data-id="${st.id}">พิมพ์บัตร</button><button class="btn sm" data-act="reissue" data-id="${st.id}">ออกบัตรใหม่</button><button class="btn sm ghost" data-act="a-off" data-id="${st.id}">ไม่ใช้งาน</button>`}</td></tr>`).join('');
 return `<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(140px,1fr))">${sum}</div>
 <div class="panel" style="display:flex;flex-direction:column;gap:12px">
  <div class="section-title"><div class="row">${lr.map(r=>`<button class="btn sm ${r===A.room?'primary':''}" data-act="a-room" data-r="${r}">${r}</button>`).join('')}</div><div class="row">${(()=>{const n=ACT().filter(s=>!s.uid).length;return n?`<button class="btn sm good" data-act="a-acc">สร้างบัญชีที่ค้าง (${n})</button>`:''})()}<button class="btn sm" data-act="a-add">เพิ่มนักเรียนทีละคน</button><button class="btn sm" data-act="tab" data-k="import">นำเข้าจาก Excel</button></div></div>
  ${A.addOpen?`<div class="row" style="background:var(--surface-2);padding:10px;border-radius:10px">
   <label class="field">เลขประจำตัว<input type="text" id="na-id" size="8"></label><label class="field">คำนำหน้า<select id="na-pre"><option>ด.ช.</option><option>ด.ญ.</option><option>นาย</option><option>นางสาว</option></select></label>
   <label class="field">ชื่อ<input type="text" id="na-name" size="10"></label><label class="field">นามสกุล<input type="text" id="na-last" size="10"></label><label class="field">เลขที่<input type="number" id="na-no" value="${(list.reduce((a,s)=>Math.max(a,s.no),0)+1)}"></label>
   <button class="btn sm primary" data-act="a-add-save" style="align-self:flex-end">เพิ่มเข้า ${A.room}</button></div>`:''}
  <div class="tablewrap"><table><thead><tr><th>เลขที่</th><th>เลขประจำตัว</th><th>ชื่อ-สกุล</th><th>สถานะ</th><th></th></tr></thead><tbody>${rows||'<tr><td colspan="5" class="muted">ยังไม่มีรายชื่อ</td></tr>'}</tbody></table></div>
  <p class="small muted" style="margin:0">นักเรียนที่ลาออกให้ตั้งเป็น "ไม่ใช้งาน" แทนการลบ คะแนนเดิมยังเก็บไว้ และบัตรจะเข้าระบบไม่ได้ ครูผู้สอนแก้ไขรายชื่อตรงนี้ไม่ได้</p></div>`}
function aImport(){const I=S.adm.imp;
 let res='';
 if(I){const c={new:0,move:0,same:0,err:0};I.rows.forEach(r=>c[r.kind]++);
  const lab={new:['good','เพิ่มใหม่'],move:['warn','ย้ายห้อง'],same:['','มีอยู่แล้ว'],err:['crit','ข้อผิดพลาด']};
  res=`<div class="panel" style="display:flex;flex-direction:column;gap:12px"><div class="section-title"><h2>ตรวจข้อมูลก่อนบันทึก</h2><span class="small muted">${esc(I.file)} · ${I.rows.length} แถว</span></div>
  <div class="row small"><span class="chip good">เพิ่มใหม่ ${c.new}</span><span class="chip warn">ย้ายห้อง ${c.move}</span><span class="chip">มีอยู่แล้ว ${c.same}</span><span class="chip crit">ข้อผิดพลาด ${c.err}</span></div>
  <div class="tablewrap"><table><thead><tr><th>แถว</th><th>เลขประจำตัว</th><th>ชื่อ-สกุล</th><th>ห้อง</th><th>เลขที่</th><th>ผลตรวจ</th></tr></thead><tbody>${I.rows.map(r=>`<tr class="${r.kind==='err'?'bad':''}"><td class="num">${r.line}</td><td class="num">${esc(r.id)}</td><td>${esc(r.prefix+r.name+(r.last?' '+r.last:''))}</td><td>${esc(r.room)}</td><td class="num">${esc(r.no)}</td><td><span class="chip ${lab[r.kind][0]}">${lab[r.kind][1]}</span> <span class="small ${r.kind==='err'?'warnline':'muted'}">${esc(r.note||'')}</span></td></tr>`).join('')}</tbody></table></div>
  <div class="row"><button class="btn primary" data-act="a-imp-ok" ${c.new+c.move?'':'disabled'}>บันทึก ${c.new+c.move} รายการ</button><button class="btn" data-act="a-imp-cancel">ยกเลิก</button>${c.err?'<span class="small warnline">แถวที่มีข้อผิดพลาดจะไม่ถูกบันทึก แก้ในไฟล์แล้วอัปโหลดใหม่ได้</span>':''}</div></div>`}
 return `<div class="panel" style="display:flex;flex-direction:column;gap:12px"><h2>นำเข้ารายชื่อนักเรียน</h2>
  <ol class="small" style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:4px"><li>ดาวน์โหลดแม่แบบ แล้ววางรายชื่อจากไฟล์ของงานทะเบียน (SGS / DMC) ให้ตรงคอลัมน์</li><li>อัปโหลดไฟล์ .xlsx หรือ .csv</li><li>ตรวจผล แล้วกดบันทึก ระบบสร้างห้องเรียนและบัญชีให้อัตโนมัติ</li></ol>
  <div class="tablewrap"><table><thead><tr><th>เลขประจำตัว</th><th>คำนำหน้า</th><th>ชื่อ</th><th>นามสกุล</th><th>ชั้น</th><th>ห้อง</th><th>เลขที่</th></tr></thead><tbody><tr class="muted"><td>66101</td><td>ด.ญ.</td><td>กานดา</td><td>รักเรียน</td><td>ม.4</td><td>3</td><td>1</td></tr></tbody></table></div>
  <div class="row"><button class="btn" data-act="a-tpl">ดาวน์โหลดแม่แบบ Excel</button><label class="btn primary" for="imp-file" style="cursor:pointer">เลือกไฟล์รายชื่อ</label><input type="file" id="imp-file" accept=".xlsx,.xls,.csv" hidden data-act-change="impfile"></div></div>${res}`}
function aCards(){const A=S.adm;const rooms=allRooms().filter(r=>r.startsWith(A.cardLevel+'/'));A.cardRooms=A.cardRooms.filter(r=>allRooms().includes(r));
 const pick=rooms.map(r=>{const n=ACT().filter(s=>s.room===r).length;return `<label class="pick"><input type="checkbox" id="cr-${r.replace('/','-')}" data-croom="${r}" ${A.cardRooms.includes(r)?'checked':''}><span>${r}<small class="muted"> ${n} คน</small></span></label>`}).join('');
 const sel=ACT().filter(s=>A.cardRooms.includes(s.room)).sort((a,b)=>a.room.localeCompare(b.room,'th',{numeric:true})||a.no-b.no);
 return `<div class="panel" style="display:flex;flex-direction:column;gap:12px"><h2>พิมพ์บัตร QR</h2>
  <div class="row"><label class="field">ระดับชั้น<select id="c-level" data-act-change="clevel">${LEVELS.map(l=>`<option ${l===A.cardLevel?'selected':''}>${l}</option>`).join('')}</select></label></div>
  <div class="field">ห้อง<div class="row" style="gap:6px">${pick||'<span class="muted">ระดับนี้ยังไม่มีรายชื่อ</span>'}<button class="btn sm ghost" data-act="c-all">เลือกทุกห้อง</button></div></div>
  <div class="row"><button class="btn primary" data-act="c-dl" ${sel.length?'':'disabled'}>ดาวน์โหลดไฟล์บัตร ${sel.length} ใบ</button><span class="small muted">พิมพ์ซ้ำใช้ QR เดิม บัตรเก่ายังใช้ได้</span></div></div>
 <div class="cardprev">${sel.slice(0,8).map(st=>cardFace(st,null)).join('')}</div>${sel.length>8?`<p class="small muted" style="text-align:center;margin:0">แสดงตัวอย่าง 8 จาก ${sel.length} ใบ</p>`:''}`}
function aTeachers(){const row=t=>`<div class="item"><div class="grow"><b>${esc(t.name)}</b><div class="small muted">${esc(t.email)}</div></div>${t.status==='pending'?`<button class="btn sm good" data-act="t-ok" data-u="${t.uid}">อนุมัติ</button><button class="btn sm" data-act="t-no" data-u="${t.uid}">ปฏิเสธ</button>`:`<span class="chip good">อนุมัติแล้ว</span><button class="btn sm ghost" data-act="t-no" data-u="${t.uid}">ยกเลิกสิทธิ์</button>`}</div>`;
 const p=S.teachers.filter(t=>t.status==='pending'),a=S.teachers.filter(t=>t.status==='approved');
 return `<div class="panel"><div class="section-title"><h2>รออนุมัติ</h2><span class="small muted">ครูที่สมัครด้วยบัญชี Google</span></div><div class="list">${p.map(row).join('')||'<p class="muted small">ไม่มีคำขอใหม่</p>'}</div></div>
 <div class="panel"><h2 style="margin-bottom:6px">ครูที่ใช้งานได้</h2><div class="list">${a.map(row).join('')}</div></div>`}
/* roster parsing */
function parseCSV(t){return t.replace(/^\uFEFF/,'').split(/\r?\n/).filter(l=>l.trim()).map(l=>{const out=[];let cur='',q=false;for(const ch of l){if(ch==='"')q=!q;else if(ch===','&&!q){out.push(cur);cur=''}else cur+=ch}out.push(cur);return out.map(x=>x.trim())})}
async function readRoster(file){let rows;
 if(/\.csv$/i.test(file.name))rows=parseCSV(await file.text());
 else{const X=await loadXLSX();const wb=X.read(await file.arrayBuffer(),{type:'array'});rows=X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:'',raw:false})}
 const hi=rows.findIndex(r=>r.some(c=>String(c).includes('เลขประจำตัว')));if(hi<0)throw new Error('head');
 const H=rows[hi].map(c=>String(c).trim());const col=k=>H.findIndex(h=>h.includes(k));
 const ci={id:col('เลขประจำตัว'),pre:col('คำนำหน้า'),name:H.findIndex(h=>h==='ชื่อ'||h.startsWith('ชื่อ')&&!h.includes('สกุล')),last:col('สกุล'),lvl:col('ชั้น'),room:col('ห้อง'),no:col('เลขที่')};
 const seenId=new Map(),seenNo=new Set();const out=[];
 rows.slice(hi+1).forEach((r,k)=>{const g=i=>i<0?'':String(r[i]??'').trim();const id=g(ci.id),name=g(ci.name);if(!id&&!name)return;
  let lvl=g(ci.lvl),rm=g(ci.room);if(rm.includes('/')){lvl=rm.split('/')[0];rm=rm.split('/')[1]}lvl=lvl.replace(/^ม\.?\s*/,'ม.');const room=lvl&&rm?`${lvl}/${rm}`:'';const no=g(ci.no);
  const o={line:hi+k+2,id,prefix:g(ci.pre),name,last:g(ci.last),room,no,kind:'new',note:''};
  if(!id||!name||!room||!no){o.kind='err';o.note='ข้อมูลไม่ครบ'+(!id?' (เลขประจำตัว)':!name?' (ชื่อ)':!room?' (ชั้น/ห้อง)':' (เลขที่)')}
  else if(!LEVELS.includes(lvl)){o.kind='err';o.note='ระดับชั้นไม่ถูกต้อง'}
  else if(!/^\d+$/.test(no)){o.kind='err';o.note='เลขที่ต้องเป็นตัวเลข'}
  else if(seenId.has(id)){o.kind='err';o.note=`เลขประจำตัวซ้ำกับแถว ${seenId.get(id)}`}
  else if(seenNo.has(room+'#'+no)){o.kind='err';o.note=`เลขที่ ${no} ซ้ำในห้อง ${room}`}
  else{const ex=stu(id);if(ex){if(ex.room!==room){o.kind='move';o.note=`ย้ายจาก ${ex.room} → ${room}`}else{o.kind='same';o.note='ไม่มีการเปลี่ยนแปลง'}}}
  if(id&&!seenId.has(id))seenId.set(id,o.line);if(room&&no)seenNo.add(room+'#'+no);out.push(o)});
 return out}
/* modals */
function modalView(){
 const m=S.modal;if(!m)return '';let inner='';
 if(m.type==='progress'){inner=`<h2>${esc(m.title)}</h2><div class="bar"><i style="width:${m.total?Math.round(m.done/m.total*100):0}%"></i></div><p class="muted num" style="margin:0">${m.done} / ${m.total} บัญชี อย่าปิดหน้านี้จนกว่าจะเสร็จ</p>`}
 if(m.type==='visit'){const me=stu(S.user.id),s=stu(m.id);const self=me.id===s.id;
  const todayCount=S.trades.filter(t=>t.from===me.id&&t.day===today()).length;const mine=tradable(me),theirs=tradable(s);
  inner=`<div class="section-title"><h2>ปราสาทของ ${esc(s.name)}</h2><button class="btn sm ghost" data-act="close">ปิด</button></div>${villageCastle(s,'main')}
  ${self?'<p class="muted" style="margin:0">นี่คือปราสาทของคุณเอง</p>':`<div class="row">${STICKERS.map((t,i)=>`<button class="btn sm" data-act="sticker" data-id="${s.id}" data-k="${i}">${t}</button>`).join('')}</div>
  <div class="panel" style="display:flex;flex-direction:column;gap:10px;background:var(--surface-2)"><h3>ขอแลกไอเท็ม</h3>
   ${!mine.length||!theirs.length?`<p class="muted small" style="margin:0">${!mine.length?'คุณยังไม่มีไอเท็มที่แลกได้':'เพื่อนยังไม่มีไอเท็มที่แลกได้'} (ของที่ล็อกตามขั้นแลกไม่ได้)</p>`:
   todayCount>=S.settings.tradeLimit?`<p class="warnline" style="margin:0">วันนี้แลกครบ ${S.settings.tradeLimit} ครั้งแล้ว ลองใหม่พรุ่งนี้</p>`:
   `<div class="row"><label class="row small" style="gap:6px">ของที่ให้ <select id="tg">${mine.map(i=>`<option value="${i}">${item(i).name}</option>`).join('')}</select></label>
   <label class="row small" style="gap:6px">ของที่อยากได้ <select id="tw">${theirs.map(i=>`<option value="${i}">${item(i).name}</option>`).join('')}</select></label></div>
   <p class="small muted" style="margin:0">ในต้นแบบนี้จำลองว่าเพื่อนกดยืนยันแล้ว คำขอจะไปรอครูอนุมัติ</p><div><button class="btn sm primary" data-act="trade" data-id="${s.id}">ส่งคำขอแลก</button></div>`}</div>`}`}
 if(m.type==='cards'){const list=ACT().filter(x=>x.room===m.room).sort((a,b)=>a.no-b.no);
  inner=`<div class="section-title"><h2>บัตร QR ห้อง ${esc(m.room)}</h2><button class="btn sm ghost" data-act="close">ปิด</button></div>
  <p class="small muted" style="margin:0">${list.length} ใบ ขนาดเท่าบัตรประชาชน (85.6×54 มม.) ดาวน์โหลดไฟล์แล้วเปิดในเบราว์เซอร์ กดพิมพ์ แล้วตัดตามเส้นประ การพิมพ์ซ้ำใช้ QR เดิม บัตรเก่ายังใช้ได้</p>
  <div><button class="btn primary" data-act="cards-dl" data-r="${esc(m.room)}">ดาวน์โหลดไฟล์บัตรสำหรับพิมพ์</button></div>
  <div class="cardprev">${list.map(st=>cardFace(st,null)).join('')}</div>`}
 if(m.type==='detail'){const s=stu(m.id);const I=stageInfo(s),r=risk(s);
  const qrows=S.quests.filter(q=>q.cat!=null).map(q=>`<tr><td>${esc(q.name)}</td><td class="small muted">${esc(cats()[q.cat]?.name||'')}</td><td><input type="number" id="sc-${s.id}-${q.id}" min="0" max="${q.points}" value="${s.scores[q.id]??''}" placeholder="-" data-score="${s.id}|${q.id}"> <span class="small muted num">/${q.points}</span></td></tr>`).join('');
  inner=`<div class="section-title"><h2>${s.no}. ${esc(s.name)} <span class="small muted">${s.room} · ${s.id}</span></h2><button class="btn sm ghost" data-act="close">ปิด</button></div>
  <div class="stage-card"><div>${castleView(I.stage,I.frac,s.eq,`ปราสาทของ ${s.name}`,'main')}</div><div style="display:flex;flex-direction:column;gap:8px">
   <span class="chip ${r.k}" style="align-self:flex-start">${r.label}</span><span class="small">${r.detail}</span>
   <div class="kv">${cats().map((c,i)=>c.castle?`<span>${esc(c.name)}</span><b class="num">${catScore(s,i)}/${c.max}</b>`:`<span class="muted">${esc(c.name)} (ซ่อน)</span><span class="muted num">-/${c.max}</span>`).join('')}<span>ขั้นปราสาท</span><b class="num">${I.stage}/10</b><span>เหรียญ</span><b class="num">${s.coins}</b></div>
   <div class="row"><button class="btn sm" data-act="coin" data-id="${s.id}">+10 เหรียญ</button><button class="btn sm" data-act="card-one" data-id="${s.id}">พิมพ์บัตร QR</button><button class="btn sm" data-act="reissue" data-id="${s.id}">ออกบัตรใหม่</button></div></div></div>
  <div class="tablewrap"><table><thead><tr><th>งาน</th><th>หมวด</th><th>คะแนน</th></tr></thead><tbody>${qrows}</tbody></table></div>
  <div class="small muted">ไอเท็ม: ${s.inv.map(i=>item(i).name).join(', ')||'ยังไม่มี'}</div>`}
 return `<div class="scrim" data-act="scrim"><div class="modal" role="dialog" aria-modal="true">${inner}</div></div>`;
}

/* ---------- Excel export (scores only, no coins) ---------- */
let xlsxLib=null;
function loadXLSX(){if(window.XLSX)return Promise.resolve(window.XLSX);if(xlsxLib)return xlsxLib;
 xlsxLib=new Promise((ok,no)=>{const sc=document.createElement('script');sc.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';sc.onload=()=>ok(window.XLSX);sc.onerror=()=>{xlsxLib=null;no(new Error('load'))};document.head.appendChild(sc)});return xlsxLib}
function roomSheet(X,room){
 const C=cats(),qs=S.quests.filter(q=>q.cat!=null&&C[q.cat]&&C[q.cat].castle);
 const castleCats=C.map((c,i)=>({c,i})).filter(o=>o.c.castle),hidden=C.filter(c=>!c.castle);
 const head=['เลขที่','เลขประจำตัว','ชื่อ',...qs.map(q=>`${q.name} (${q.points})`),...castleCats.map(o=>`รวม${o.c.name} (${o.c.max})`),`รวมระหว่างภาค (${castleMax()})`,...hidden.map(c=>`${c.name} (${c.max}) กรอกเอง`),'รวมทั้งหมด (100)'];
 const top=[[`${S.settings.subject} ${S.settings.code}`],[`${S.settings.term} · ห้อง ${room}`],[`ส่งออกเมื่อ ${new Date().toLocaleDateString('th-TH',{dateStyle:'long'})}`],[],head];
 const list=ACT().filter(s=>s.room===room).sort((a,b)=>a.no-b.no);
 const rows=list.map(st=>[st.no,st.id,st.name,...qs.map(q=>st.scores[q.id]??null)]);
 const ws=X.utils.aoa_to_sheet(top.concat(rows));
 const col=X.utils.encode_col,R0=top.length;
 list.forEach((st,k)=>{const r=R0+k+1;let c=3+qs.length;const catCells=[];
  castleCats.forEach(o=>{const cols=qs.map((q,j)=>q.cat===o.i?col(3+j)+r:null).filter(Boolean);const addr=col(c)+r;ws[addr]={t:'n',f:cols.length?`SUM(${cols.join(',')})`:'0',v:catScore(st,o.i)};catCells.push(addr);c++});
  const mid=col(c)+r;ws[mid]={t:'n',f:`SUM(${catCells.join(',')})`,v:scoreOf(st)};c++;const hid=[];hidden.forEach(()=>{hid.push(col(c)+r);c++});
  ws[col(c)+r]={t:'n',f:`SUM(${[mid,...hid].join(',')})`,v:scoreOf(st)};
  ws['!ref']=X.utils.encode_range({s:{r:0,c:0},e:{r:R0+list.length-1,c:c}});});
 ws['!cols']=[{wch:6},{wch:12},{wch:16},...qs.map(()=>({wch:12})),...castleCats.map(()=>({wch:14})),{wch:16},...hidden.map(()=>({wch:16})),{wch:16}];
 return ws;
}
async function exportXL(rooms){
 let X;try{X=await loadXLSX()}catch(e){toast('โหลดตัวสร้างไฟล์ Excel ไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองใหม่');render();return}
 const wb=X.utils.book_new();rooms.forEach(r=>X.utils.book_append_sheet(wb,roomSheet(X,r),r.replace('/','-')));
 const buf=X.write(wb,{type:'array',bookType:'xlsx'});
 const name=`คะแนน_${S.settings.code||S.settings.subject}_${rooms.length===1?rooms[0].replace('/','-'):'ทุกห้อง'}.xlsx`;
 await saveFile(name,new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));render();
}
async function saveFile(name,blob){
 let dl=null;try{dl=window.claude&&window.claude.use?await window.claude.use('downloads'):null}catch(e){dl=null}
 if(dl){try{await dl.save({filename:name,data:blob});toast('บันทึกไฟล์แล้ว')}catch(e){toast(e&&e.code==='declined'?'ยกเลิกการดาวน์โหลด':'ดาวน์โหลดไม่ได้ในหน้านี้')}}
 else{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000);toast('ดาวน์โหลดไฟล์แล้ว')}
}
/* ---------- QR login cards (admin and subject teachers) ---------- */
function cardFace(st,payload){return `<div class="qc"><div class="qcq">${payload?realQR(payload):'<div style="width:100%;height:100%;border:2px dashed #b8c2cf;border-radius:6px;display:grid;place-items:center;color:#8a96a6;font-size:12px">QR</div>'}</div><div class="qct"><div class="qcb">${esc(SCHOOL.name||'เกมสร้างปราสาท')}</div><div class="qcn">${esc(st.name)}</div><div class="qcm">${esc(st.room)} · เลขที่ ${st.no}</div><div class="qcm">เลขประจำตัว ${esc(st.id)}</div><div class="qcs">ใช้สแกนเข้าระบบ ห้ามให้ผู้อื่นยืม</div></div></div>`}
const CARD_CSS=`.qc{display:flex;gap:3mm;align-items:center;width:85.6mm;height:54mm;box-sizing:border-box;padding:4mm;border:1px dashed #9aa6b5;border-radius:3mm;background:#fff;color:#1b2838;font-family:"IBM Plex Sans Thai",Tahoma,sans-serif;break-inside:avoid}
.qcq{width:30mm;height:30mm;flex:none;background:#fff}.qcq svg{width:100%;height:100%;display:block}
.qct{display:flex;flex-direction:column;gap:1mm;min-width:0}.qcb{font-weight:600;color:#2e5b8c;font-size:10pt}.qcn{font-weight:600;font-size:15pt}.qcm{font-size:9.5pt;color:#3a4a5c}.qcs{font-size:7.5pt;color:#7a8696;margin-top:1mm}`;
async function exportCards(list,label){
 let pay;try{await loadQRLib();pay=await cardPayloads(list)}catch(e){fail(e,'โหลดข้อมูลบัตรไม่สำเร็จ');return}
 const miss=list.filter(st=>!pay.has(st.id));list=list.filter(st=>pay.has(st.id));
 if(!list.length){toast('นักเรียนกลุ่มนี้ยังไม่มีบัญชี ให้ผู้ดูแลกด "สร้างบัญชีที่ค้าง" ก่อน');render();return}
 if(miss.length)toast(`ข้าม ${miss.length} คนที่ยังไม่มีบัญชี`);
 const html=`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>บัตร QR ${esc(label)}</title><style>@page{size:A4;margin:10mm}body{margin:0;font-family:"IBM Plex Sans Thai",Tahoma,sans-serif}
.bar{padding:8px;display:flex;gap:12px;align-items:center}.bar button{font-size:16px;padding:6px 16px}.sheet{display:grid;grid-template-columns:repeat(2,85.6mm);gap:4mm;justify-content:center}
@media print{.bar{display:none}}${CARD_CSS}</style></head><body><div class="bar"><button onclick="print()">พิมพ์</button><span>${SCHOOL.name?esc(SCHOOL.name)+' · ':''}${esc(label)} · ${list.length} ใบ · ขนาดบัตร 85.6×54 มม. ตัดตามเส้นประ</span></div>
<div class="sheet">${list.map(st=>cardFace(st,pay.get(st.id))).join('')}</div></body></html>`;
 await saveFile(`บัตรQR_${label.replace(/[\/ ]/g,'-')}.html`,new Blob([html],{type:'text/html'}));render();
}

/* ---------- render scheduling (never re-render while the teacher is typing) ---------- */
let rq=0,pendingRender=false;
function busyTyping(){const a=document.activeElement;return a&&a.matches&&a.matches('input[type=number],input[type=text],textarea,select')}
function soon(){if(rq)return;rq=requestAnimationFrame(()=>{rq=0;if(busyTyping()){pendingRender=true;return}render()})}
document.addEventListener('focusout',()=>{if(pendingRender)setTimeout(()=>{if(!busyTyping()&&pendingRender){pendingRender=false;render()}},60)});
function fail(e,msg){console.error(e);const code=e&&e.code||'';toast(code==='permission-denied'?'ไม่มีสิทธิ์ทำรายการนี้':(msg||'บันทึกไม่สำเร็จ')+(code?` (${code})`:''));soon()}

/* ---------- listeners ---------- */
let UN=[];function stopAll(){UN.forEach(u=>{try{u()}catch(e){}});UN=[]}
function seenKey(sid,sub){return `seen:${sid}:${sub}`}
function getSeen(sid,sub){try{const v=localStorage.getItem(seenKey(sid,sub));return v==null?null:+v}catch(e){return null}}
function setSeen(sid,sub,v){try{localStorage.setItem(seenKey(sid,sub),v)}catch(e){}}

function watchQuests(sub){UN.push(onSnapshot(C('subjects',sub.id,'quests'),qs=>{sub.quests=qs.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.order||0)-(b.order||0));soon()},e=>fail(e,'โหลดงานไม่สำเร็จ')))}
function watchSubjectTeacher(sub){
 watchQuests(sub);
 UN.push(onSnapshot(query(C('subjects',sub.id,'claims'),where('status','==','pending')),qs=>{sub.claims=qs.docs.map(d=>({id:d.id,...d.data()}));soon()},e=>fail(e)));
 UN.push(onSnapshot(C('subjects',sub.id,'trades'),qs=>{sub.trades=qs.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.atMs||0)-(b.atMs||0));soon()},e=>fail(e)));
 UN.push(onSnapshot(C('subjects',sub.id,'progress'),qs=>{qs.docs.forEach(d=>{const st=stu(d.id);if(st){const old=st.bySub[sub.id];st.bySub[sub.id]=Object.assign(normProg(d.data()),{seenStage:old?old.seenStage:null})}});
  sub._prog=new Set(qs.docs.map(d=>d.id));ensureProgress(sub);soon()},e=>fail(e)));
}
async function ensureProgress(sub){
 if(sub._ensuring)return;const need=ACT().filter(st=>sub.rooms.includes(st.room)&&!sub._prog.has(st.id));if(!need.length)return;
 sub._ensuring=true;
 try{for(let i=0;i<need.length;i+=100){const b=writeBatch(db);need.slice(i,i+100).forEach(st=>{
   b.set(D('subjects',sub.id,'progress',st.id),{scores:{},special:[],coins:0,inv:[],eq:{outfit:null,pet:null,flag:null,decor:[]}});
   b.set(D('subjects',sub.id,'public',st.id),{name:st.name,room:st.room,no:st.no,stage:0,frac:0,eq:{outfit:null,pet:null,flag:null,decor:[]},inv:[],stickers:0});sub._prog.add(st.id)});await b.commit()}}
 catch(e){fail(e,'สร้างข้อมูลนักเรียนในวิชาไม่สำเร็จ')}finally{sub._ensuring=false}
}
const pubTimers={};
function syncPublic(st){const sub=curSub();if(sub.id==='__none')return;const key=sub.id+st.id;clearTimeout(pubTimers[key]);
 const I=stageInfo(st),data={name:st.name,room:st.room,no:st.no,stage:I.stage,frac:Math.round(I.frac*100)/100,eq:st.eq,inv:st.inv};
 pubTimers[key]=setTimeout(()=>setDoc(D('subjects',sub.id,'public',st.id),data,{merge:true}).catch(e=>fail(e)),700)}

/* ---------- boot: who is signed in ---------- */
async function bootStaff(user){
 const cfgSnap=await getDoc(D('config','app'));const cfg=cfgSnap.exists()?cfgSnap.data():{};
 const isAdmin=(cfg.adminEmails||[]).includes(user.email);
 let u=await getDoc(D('users',user.uid));
 if(!u.exists()&&!isAdmin){await setDoc(D('users',user.uid),{email:user.email,name:user.displayName||user.email,status:'pending',at:serverTimestamp()});u=await getDoc(D('users',user.uid))}
 const status=u.exists()?u.data().status:'approved';
 S.me={uid:user.uid,email:user.email,name:user.displayName||user.email,isAdmin,isTeacher:isAdmin||status==='approved'};
 if(cfg.term)EMPTY_SUB.settings.term=cfg.term;
 if(!S.me.isTeacher){S.boot='pending';S.bootMsg=status==='rejected'?'ผู้ดูแลระบบไม่อนุมัติบัญชีนี้':'';render();return}
 const st=await getDocs(C('students'));st.docs.forEach(d=>upsertStudent(d.id,d.data()));
 const subs=await getDocs(query(C('subjects'),where('teacherUids','array-contains',user.uid)));
 S.subjects=subs.docs.map(d=>subFromDoc(d.id,d.data()));
 S.subjects.forEach(watchSubjectTeacher);
 if(isAdmin){await loadTeachers()}
 if(S.subjects[0])useSubject(S.subjects[0].id);
 S.user={role:isAdmin?'admin':'teacher'};S.tab=isAdmin?'rooms':'overview';S.boot='ready';
 const lv=allRooms()[0];if(lv){S.adm.level=lv.split('/')[0];S.adm.cardLevel=S.adm.level}
 render();
}
async function loadTeachers(){const us=await getDocs(C('users'));S.teachers=us.docs.map(d=>({uid:d.id,...d.data()})).filter(t=>t.status!=='rejected')}
async function bootStudent(user){
 const a=await getDoc(D('studentAuth',user.uid));
 if(!a.exists()){S.boot='login';S.bootMsg='บัตรนี้ถูกยกเลิกแล้ว ขอบัตรใบใหม่จากครู';await signOut(auth);return}
 const sid=a.data().sid;const sd=await getDoc(D('students',sid));
 if(!sd.exists()||sd.data().active===false){S.boot='login';S.bootMsg='บัญชีนี้ถูกปิดใช้งาน ติดต่อครูหรือผู้ดูแลระบบ';await signOut(auth);return}
 const me=upsertStudent(sid,sd.data());S.me={uid:user.uid,sid,student:true};
 const subs=await getDocs(query(C('subjects'),where('rooms','array-contains',me.room)));
 S.subjects=subs.docs.map(d=>subFromDoc(d.id,d.data()));
 S.subjects.forEach(sub=>{
  me.bySub[sub.id]=Object.assign(blankProg(),{seenStage:getSeen(sid,sub.id)});
  watchQuests(sub);
  UN.push(onSnapshot(D('subjects',sub.id),d=>{if(!d.exists())return;const x=d.data();sub.settings=Object.assign({},sub.settings,x.settings||{});sub.rooms=x.rooms||[];sub.village=x.village||{};soon()}));
  UN.push(onSnapshot(D('subjects',sub.id,'progress',sid),d=>{if(!d.exists())return;const old=me.bySub[sub.id];me.bySub[sub.id]=Object.assign(normProg(d.data()),{seenStage:old?old.seenStage:null});if(S.subId===sub.id)checkLevel(me);soon()},e=>fail(e,'โหลดคะแนนไม่สำเร็จ')));
  UN.push(onSnapshot(query(C('subjects',sub.id,'claims'),where('sid','==',sid)),qs=>{sub.claims=qs.docs.map(d=>({id:d.id,...d.data()}));soon()}));
  const tmap={from:[],to:[]};const tset=k=>qs=>{tmap[k]=qs.docs.map(d=>({id:d.id,...d.data()}));sub.trades=[...tmap.from,...tmap.to].sort((a,b)=>(a.atMs||0)-(b.atMs||0));soon()};
  UN.push(onSnapshot(query(C('subjects',sub.id,'trades'),where('from','==',sid)),tset('from')));
  UN.push(onSnapshot(query(C('subjects',sub.id,'trades'),where('to','==',sid)),tset('to')));
 });
 if(S.subjects[0])useSubject(S.subjects[0].id);
 S.user={role:'student',id:sid};S.tab='castle';S.boot='ready';render();
 if(!S.personal)startIdle();
}
/* classmates' castles are read only while the village is open */
async function loadMates(){const st=stu(S.user.id),sub=curSub();if(!villageOpen(st.room))return;
 try{const qs=await getDocs(query(C('subjects',sub.id,'public'),where('room','==',st.room)));
  qs.docs.forEach(d=>{const p=d.data();let m=S.students.find(s=>s.id===d.id);if(!m){m=newStudent(d.id,p.no||0,p.name||'',p.room);m.mate=true;m.active=true}
   m.pubBy[sub.id]=p;const old=m.bySub[sub.id]||blankProg();if(m.mate)m.bySub[sub.id]=Object.assign(old,{eq:Object.assign({outfit:null,pet:null,flag:null,decor:[]},p.eq||{}),inv:p.inv||[]});m.bySub[sub.id].stickers=p.stickers||0});
  soon()}catch(e){fail(e,'โหลดหมู่บ้านไม่สำเร็จ')}}
if(CONFIGURED)onAuthStateChanged(auth,async user=>{
 stopAll();S.students=[];S.subjects=[];S.subId='__none';S.user=null;S.modal=null;
 if(!user){S.boot='login';render();return}
 S.boot='loading';S.bootMsg='';render();
 try{if((user.email||'').endsWith('@'+CARD_DOMAIN))await bootStudent(user);else await bootStaff(user)}
 catch(e){console.error(e);S.boot='login';S.bootMsg='เข้าสู่ระบบไม่สำเร็จ: '+(e.code||e.message);render();try{await signOut(auth)}catch(x){}}
});
let idleT;function startIdle(){const reset=()=>{clearTimeout(idleT);idleT=setTimeout(()=>{toast('ออกจากระบบอัตโนมัติเพราะไม่มีการใช้งาน');signOut(auth)},10*60*1000)};['pointerdown','keydown'].forEach(ev=>document.addEventListener(ev,reset,{passive:true}));reset()}

/* ---------- student QR login ---------- */
let scanner=null;
function loadScript(src,global){if(window[global])return Promise.resolve(window[global]);return new Promise((ok,no)=>{const s=document.createElement('script');s.src=src;s.onload=()=>window[global]?ok(window[global]):no(new Error('load'));s.onerror=()=>no(new Error('load'));document.head.appendChild(s)})}
const loadScanLib=()=>loadScript('https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js','Html5Qrcode');
const loadQRLib=()=>loadScript('https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js','qrcode');
async function loginWithCard(text){
 let c;try{c=JSON.parse(text)}catch(e){c=null}
 if(!c||!c.e||!c.p){toast('QR นี้ไม่ใช่บัตรเข้าเกม');render();return}
 try{await setPersistence(auth,S.personal?browserLocalPersistence:browserSessionPersistence);await signInWithEmailAndPassword(auth,c.e,c.p)}
 catch(e){S.bootMsg=e.code==='auth/invalid-credential'||e.code==='auth/user-not-found'?'บัตรนี้ใช้ไม่ได้แล้ว ขอบัตรใบใหม่จากครู':'เข้าสู่ระบบไม่สำเร็จ ('+(e.code||e.message)+')';render()}
}
async function openScanner(){
 closeScanner();const ov=document.createElement('div');ov.className='scrim';ov.id='scan-ov';
 ov.innerHTML=`<div class="modal" role="dialog" aria-modal="true"><div class="section-title"><h2>สแกนบัตร</h2><button class="btn sm ghost" id="scan-close">ปิด</button></div><div id="qr-reader" style="width:100%;max-width:420px;margin:0 auto"></div><p class="small muted" style="margin:0;text-align:center">หันบัตรให้ QR อยู่ในกรอบ</p></div>`;
 document.body.appendChild(ov);ov.querySelector('#scan-close').onclick=closeScanner;
 try{const H=await loadScanLib();scanner=new H('qr-reader');
  await scanner.start({facingMode:'environment'},{fps:10,qrbox:{width:220,height:220}},txt=>{closeScanner();loginWithCard(txt)},()=>{})}
 catch(e){closeScanner();toast('เปิดกล้องไม่ได้ ลองอัปโหลดรูปบัตรแทน');render()}
}
function closeScanner(){const s=scanner;scanner=null;if(s){try{s.stop().catch(()=>{}).finally(()=>{try{s.clear()}catch(e){}})}catch(e){}}document.getElementById('scan-ov')?.remove()}
async function scanImage(file){try{const H=await loadScanLib();const el=document.createElement('div');el.id='qr-file';el.style.display='none';document.body.appendChild(el);const r=new H('qr-file');const txt=await r.scanFile(file,false);el.remove();loginWithCard(txt)}catch(e){document.getElementById('qr-file')?.remove();toast('อ่าน QR จากรูปไม่ได้ ถ่ายให้ชัดแล้วลองใหม่');render()}}

/* ---------- student accounts & cards ---------- */
function randPwd(n=20){const a='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';const r=new Uint32Array(n);crypto.getRandomValues(r);return [...r].map(x=>a[x%a.length]).join('')}
async function createStudentAccount(st){
 const ver=(st.cardVer||0)+1,email=`${String(st.id).toLowerCase().replace(/[^a-z0-9]/g,'')}.v${ver}@${CARD_DOMAIN}`,pwd=randPwd();
 const a2=secondaryAuth();const cred=await createUserWithEmailAndPassword(a2,email,pwd);const uid=cred.user.uid;await signOut(a2);
 const b=writeBatch(db);b.set(D('studentAuth',uid),{sid:st.id});if(st.uid)b.delete(D('studentAuth',st.uid));
 b.update(D('students',st.id),{uid,cardVer:ver});b.set(D('cardSecrets',st.id),{e:email,p:pwd,ver});await b.commit();st.uid=uid;st.cardVer=ver;
}
async function createAccounts(list){
 const todo=list.filter(st=>!st.uid);if(!todo.length)return 0;let done=0;
 for(const st of todo){S.modal={type:'progress',title:'กำลังสร้างบัญชีนักเรียน',done,total:todo.length};render();
  try{await createStudentAccount(st);done++}
  catch(e){console.error(e);S.modal=null;render();
   toast(e.code==='auth/too-many-requests'||e.code==='auth/quota-exceeded'?`สร้างได้ ${done} บัญชี แล้ว Firebase จำกัดจำนวนต่อชั่วโมง รอสักครู่แล้วกด "สร้างบัญชีที่ค้าง" อีกครั้ง`:`สร้างบัญชีไม่สำเร็จที่ ${st.id} (${e.code||e.message})`);return done}}
 S.modal=null;return done;
}
async function cardPayloads(list){const out=new Map();for(let i=0;i<list.length;i+=20){const part=await Promise.all(list.slice(i,i+20).map(st=>getDoc(D('cardSecrets',st.id))));part.forEach((d,k)=>{if(d.exists()){const x=d.data();out.set(list[i+k].id,JSON.stringify({v:1,e:x.e,p:x.p}))}})}return out}
function realQR(text){const q=window.qrcode(0,'M');q.addData(text);q.make();return q.createSvgTag({cellSize:4,margin:0,scalable:true})}


/* ---------- render & actions (every change is written to Firestore) ---------- */
const app=document.getElementById('app'),mroot=document.getElementById('modal-root');
function render(){
 app.innerHTML=(S.boot==='ready'&&S.user?(S.user.role==='student'?studentApp():S.user.role==='admin'?adminApp():teacherApp()):loginView());
 mroot.innerHTML=modalView()+(S.toast?`<div class="toast" role="status">${esc(S.toast)}</div>`:'');
 try{hydrate3D()}catch(e){console.error(e)}
}
let tt;function toast(t){S.toast=t;clearTimeout(tt);tt=setTimeout(()=>{S.toast=null;soon()},3200)}
function checkLevel(st){const I=stageInfo(st);if(st.seenStage!=null&&I.stage>st.seenStage){toast(`ปราสาทขึ้นขั้น ${I.stage}: ${STAGES[I.stage]}`)}st.seenStage=I.stage;if(S.user&&S.user.role==='student')setSeen(st.id,S.subId,I.stage)}
const sref=(...p)=>D('subjects',S.subId,...p);
async function commitChunks(ops){for(let i=0;i<ops.length;i+=200){const b=writeBatch(db);ops.slice(i,i+200).forEach(f=>f(b));await b.commit()}}
/* teacher: apply a score / special result to one student, closing any pending claim for it */
function opsGrade(st,q,val,ops){
 const pr=sref('progress',st.id);
 if(q.cat==null){const has=st.special.includes(q.id);
  if(val&&!has){st.special=[...st.special,q.id];st.coins+=q.coins;ops.push(b=>b.update(pr,{special:arrayUnion(q.id),coins:increment(q.coins)}))}
  if(!val&&has){st.special=st.special.filter(x=>x!==q.id);st.coins=Math.max(0,st.coins-q.coins);ops.push(b=>b.update(pr,{special:arrayRemove(q.id),coins:increment(-q.coins)}))}}
 else{if(val==null){delete st.scores[q.id];ops.push(b=>b.update(pr,{[`scores.${q.id}`]:deleteField()}))}else{st.scores[q.id]=val;ops.push(b=>b.update(pr,{[`scores.${q.id}`]:val}))}}
 if(val!=null&&val!==false)S.claims.filter(c=>c.sid===st.id&&c.qid===q.id&&c.status==='pending').forEach(c=>{c.status='approved';ops.push(b=>b.update(sref('claims',c.id),{status:'approved',doneAt:serverTimestamp()}))});
 syncPublic(st);
}
function grade(st,q,val){const ops=[];opsGrade(st,q,val,ops);commitChunks(ops).catch(e=>fail(e))}
function approveClaim(c,ops){const st=stu(c.sid),q=quest(c.qid);if(!st||!q)return;opsGrade(st,q,q.cat==null?true:q.points,ops)}
function resolveClaim(){}
function gridChange(t){
 const [k,sid,qid]=t.dataset.g.split('|');const st=stu(sid),q=quest(qid);
 if(k==='ck')grade(st,q,t.checked?q.points:null);
 if(k==='sc'){if(t.value==='')grade(st,q,null);else{const v=Math.max(0,Math.min(q.points,Math.round(+t.value||0)));t.value=v;grade(st,q,v)}}
 if(k==='sp')grade(st,q,t.checked);
 if(!pendingClaim(sid,qid))t.closest('.pend')?.classList.remove('pend');
 const tot=document.getElementById('tot-'+sid);if(tot)tot.innerHTML=apTotal(st);
 const pc=document.getElementById('pend-chip');if(pc)pc.textContent=`รออนุมัติ ${S.claims.filter(c=>c.status==='pending'&&stu(c.sid)&&stu(c.sid).room===S.room).length} รายการ`;
}
let subTimer=null;function saveSub(){const sub=curSub();if(sub.id==='__none')return;clearTimeout(subTimer);subTimer=setTimeout(()=>updateDoc(D('subjects',sub.id),{settings:sub.settings,rooms:sub.rooms}).then(()=>ensureProgress(sub)).catch(e=>fail(e)),600)}
function saveVillage(){updateDoc(D('subjects',S.subId),{village:S.village}).catch(e=>fail(e))}
function takeItem(s,i){const inv=s.inv.slice();inv.splice(inv.indexOf(i),1);const eq=JSON.parse(JSON.stringify(s.eq));eq.decor=(eq.decor||[]).filter(x=>x!==i);['outfit','pet','flag'].forEach(k=>{if(eq[k]===i)eq[k]=null});return {inv,eq}}
async function deleteSubjectData(id){for(const sc of ['quests','progress','public','claims','trades']){const qs=await getDocs(C('subjects',id,sc));const refs=qs.docs.map(d=>d.ref);for(let i=0;i<refs.length;i+=400){const b=writeBatch(db);refs.slice(i,i+400).forEach(r=>b.delete(r));await b.commit()}}await deleteDoc(D('subjects',id))}

const A={
 'login-google'(){signInWithPopup(auth,new GoogleAuthProvider()).catch(e=>{if(e.code!=='auth/popup-closed-by-user'){S.bootMsg='เข้าสู่ระบบด้วย Google ไม่สำเร็จ ('+e.code+')';render()}});return false},
 'scan-open'(){openScanner();return false},
 reload(){location.reload();return false},
 logout(){closeScanner();signOut(auth);return false},
 'role-swap'(){S.user.role=S.user.role==='admin'?'teacher':'admin';S.tab=S.user.role==='admin'?'rooms':(S.subId==='__none'?'settings':'overview')},
 tab(d){S.tab=d.k;if(d.k==='village'&&S.user.role==='student')loadMates();if(S.user.role==='admin'&&d.k==='teachers')loadTeachers().then(soon).catch(e=>fail(e))},
 /* student */
 claim(d){const st=stu(S.user.id);const c={sid:st.id,qid:d.q,status:'pending',at:serverTimestamp(),atMs:Date.now()};
  S.claims.push(Object.assign({id:'tmp'},c));addDoc(sref('claims'),c).then(()=>toast('ส่งให้ครูตรวจแล้ว')).catch(e=>fail(e))},
 buy(d){const st=stu(S.user.id),it=item(d.i);if(st.coins<it.price||st.inv.includes(it.id))return;const inv=[...st.inv,it.id],coins=st.coins-it.price;
  updateDoc(sref('progress',st.id),{coins,inv}).then(()=>{updateDoc(sref('public',st.id),{inv}).catch(()=>{});toast(`ซื้อ${it.name}แล้ว ไปที่กระเป๋าเพื่อใช้งาน`)}).catch(e=>fail(e,'ซื้อไม่สำเร็จ'));st.inv=inv;st.coins=coins},
 equip(d){const st=stu(S.user.id),it=item(d.i);const eq=JSON.parse(JSON.stringify(st.eq));eq.decor=eq.decor||[];if(it.type==='decor'){const k=eq.decor.indexOf(it.id);k>=0?eq.decor.splice(k,1):eq.decor.push(it.id)}else eq[it.type]=eq[it.type]===it.id?null:it.id;
  st.eq=eq;updateDoc(sref('progress',st.id),{eq}).then(()=>updateDoc(sref('public',st.id),{eq})).catch(e=>fail(e))},
 visit(d){S.modal={type:'visit',id:d.id}},
 sticker(d){const m=stu(d.id);m.stickers=(m.stickers||0)+1;updateDoc(sref('public',d.id),{stickers:increment(1)}).then(()=>toast(`ส่งสติกเกอร์ "${STICKERS[d.k]}" แล้ว`)).catch(e=>fail(e))},
 trade(d){const g=document.getElementById('tg').value,w=document.getElementById('tw').value;const t={from:S.user.id,to:d.id,give:g,get:w,status:'pending',day:today(),at:serverTimestamp(),atMs:Date.now()};
  S.trades.push(Object.assign({id:'tmp'},t));S.modal=null;addDoc(sref('trades'),t).then(()=>toast('ส่งคำขอแล้ว รอครูอนุมัติ')).catch(e=>fail(e))},
 close(){S.modal=null},
 scrim(d,el,e){if(e.target===el&&S.modal&&S.modal.type!=='progress')S.modal=null;else return false},
 /* teacher */
 room(d){S.room=d.r},
 detail(d){S.modal={type:'detail',id:d.id}},
 apview(d){S.apView=d.v},
 'ap-person'(d){S.apStudent=d.id;S.apView='person'},
 'ap-step'(d){const l=ACT().filter(s=>s.room===S.room).sort((a,b)=>a.no-b.no);const i=l.findIndex(s=>s.id===S.apStudent)+(+d.d);if(l[i])S.apStudent=l[i].id},
 'col-all'(d){const q=quest(d.q),ops=[];ACT().filter(s=>s.room===S.room).forEach(st=>opsGrade(st,q,q.cat==null?true:q.points,ops));commitChunks(ops).then(()=>toast(`ให้ ${q.short||q.name} ครบทั้งห้องแล้ว`)).catch(e=>fail(e))},
 'ap-pend'(){const ops=[];const l=S.claims.filter(c=>c.status==='pending'&&stu(c.sid)&&stu(c.sid).room===S.room&&quest(c.qid)&&(quest(c.qid).cat==null||quest(c.qid).input==='check'));l.forEach(c=>approveClaim(c,ops));commitChunks(ops).then(()=>toast(`อนุมัติ ${l.length} รายการแล้ว`)).catch(e=>fail(e))},
 'tr-ok'(d){const t=S.trades.find(x=>x.id===d.t),a=stu(t.from),b=stu(t.to);
  if(!a.inv.includes(t.give)||!b.inv.includes(t.get)){updateDoc(sref('trades',t.id),{status:'rejected'});toast('อนุมัติไม่ได้ ไอเท็มไม่อยู่ในกระเป๋าแล้ว ระบบยกเลิกคำขอให้');return}
  const A1=takeItem(a,t.give),B1=takeItem(b,t.get);A1.inv.push(t.get);B1.inv.push(t.give);
  const bt=writeBatch(db);bt.update(sref('progress',a.id),A1);bt.update(sref('progress',b.id),B1);bt.update(sref('public',a.id),A1);bt.update(sref('public',b.id),B1);bt.update(sref('trades',t.id),{status:'approved'});
  bt.commit().then(()=>toast('สลับไอเท็มให้แล้ว')).catch(e=>fail(e));t.status='approved'},
 'tr-no'(d){updateDoc(sref('trades',d.t),{status:'rejected'}).then(()=>toast('ไม่อนุมัติ ของกลับคืนเจ้าของเดิม')).catch(e=>fail(e))},
 'v-open'(d){const n=document.getElementById('vname-'+d.r.replace('/','-')).value||'เปิดหมู่บ้าน';S.village[d.r]={name:n,until:Date.now()+7*864e5};saveVillage();toast(`เปิดหมู่บ้าน ${d.r} 7 วันแล้ว`)},
 'v-ext'(d){S.village[d.r].until+=3*864e5;saveVillage();toast('ขยายเวลาอีก 3 วันแล้ว')},
 'v-close'(d){delete S.village[d.r];saveVillage();toast(`ปิดหมู่บ้าน ${d.r} แล้ว`)},
 coin(d){const st=stu(d.id);st.coins+=10;updateDoc(sref('progress',st.id),{coins:increment(10)}).then(()=>toast('เพิ่ม 10 เหรียญแล้ว')).catch(e=>fail(e))},
 reissue(d){const st=stu(d.id);toast('กำลังออกบัตรใหม่...');createStudentAccount(st).then(()=>{toast(`ออกบัตรใหม่ให้ ${st.name} แล้ว บัตรเดิมใช้ไม่ได้`);exportCards([st],`${st.room} เลขที่ ${st.no} ${st.name}`)}).catch(e=>fail(e,'ออกบัตรใหม่ไม่สำเร็จ'))},
 'cards-room'(){S.modal={type:'cards',room:S.room}},
 'cards-dl'(d){toast('กำลังเตรียมไฟล์บัตร...');exportCards(ACT().filter(x=>x.room===d.r).sort((a,b)=>a.no-b.no),'ห้อง '+d.r)},
 'card-one'(d){const st=stu(d.id);toast('กำลังเตรียมไฟล์บัตร...');exportCards([st],`${st.room} เลขที่ ${st.no} ${st.name}`)},
 'xl-room'(){toast('กำลังสร้างไฟล์ Excel...');exportXL([S.room])},
 'xl-all'(){toast('กำลังสร้างไฟล์ Excel...');exportXL(S.rooms.slice())},
 'subj-pick'(d){useSubject(d.id);S.confirmDel=false},
 'subj-new'(){const settings=Object.assign({},EMPTY_SUB.settings,{subject:'รายวิชาใหม่',cats:defaultCats()});
  addDoc(C('subjects'),{settings,rooms:[],village:{},teacherUids:[S.me.uid],createdAt:serverTimestamp()}).then(r=>{const sub=subFromDoc(r.id,{settings,rooms:[],teacherUids:[S.me.uid]});S.subjects.push(sub);watchSubjectTeacher(sub);useSubject(sub.id);S.tab='settings';S.confirmDel=false;toast('สร้างรายวิชาใหม่แล้ว ตั้งชื่อ รหัส และเลือกห้องที่สอน');soon()}).catch(e=>fail(e))},
 'subj-del'(){S.confirmDel=true},
 'subj-del-no'(){S.confirmDel=false},
 'subj-del-yes'(){const id=S.subId,name=S.settings.subject;S.confirmDel=false;toast('กำลังลบรายวิชา...');
  deleteSubjectData(id).then(()=>{S.subjects=S.subjects.filter(x=>x.id!==id);S.students.forEach(st=>delete st.bySub[id]);useSubject(S.subjects[0]?S.subjects[0].id:'__none');toast(`ลบรายวิชา ${name} แล้ว`);soon()}).catch(e=>fail(e,'ลบไม่สำเร็จ'))},
 'cat-add'(){S.settings.cats.push({name:'หมวดใหม่',max:0,visible:true,castle:true});saveSub()},
 'cat-del'(d){const i=+d.i;S.settings.cats.splice(i,1);const ops=[];S.quests.forEach(q=>{if(q.cat!=null&&q.cat>i){q.cat--;ops.push(b=>b.update(sref('quests',q.id),{cat:q.cat}))}});commitChunks(ops).catch(e=>fail(e));saveSub()},
 'q-add'(){const n=document.getElementById('nq-name').value.trim();if(!n){toast('ใส่ชื่องานก่อน');return}const c=document.getElementById('nq-cat').value,p=Math.max(1,+document.getElementById('nq-pts').value||1),cl=document.getElementById('nq-claim').checked;
  const q=c==='sp'?{name:n,short:n.slice(0,14),cat:null,coins:p,claim:cl,order:Date.now()}:{name:n,short:n.slice(0,14),cat:+c,points:p,claim:cl,input:document.getElementById('nq-input').value,order:Date.now()};
  const id=newId('q');S.quests.push(Object.assign({id},q));setDoc(sref('quests',id),q).then(()=>toast('เพิ่มงานแล้ว')).catch(e=>fail(e))},
 'q-del'(d){deleteDoc(sref('quests',d.q)).then(()=>toast('ลบงานแล้ว')).catch(e=>fail(e))},
 /* admin */
 'a-level'(d){S.adm.level=d.l;S.adm.room=null},
 'a-room'(d){S.adm.room=d.r},
 'a-add'(){S.adm.addOpen=!S.adm.addOpen},
 'a-add-save'(){const v=k=>document.getElementById(k).value.trim();const id=v('na-id'),name=v('na-name');if(!id||!name){toast('ใส่เลขประจำตัวและชื่อก่อน');return}if(!/^[A-Za-z0-9]+$/.test(id)){toast('เลขประจำตัวใช้ได้เฉพาะตัวเลขและตัวอักษรอังกฤษ');return}if(stu(id)){toast('เลขประจำตัวนี้มีในระบบแล้ว');return}
  const data={prefix:v('na-pre'),name,last:v('na-last'),room:S.adm.room,no:+v('na-no')||1,active:true,uid:null,cardVer:0};
  setDoc(D('students',id),data).then(async()=>{const st=upsertStudent(id,data);S.adm.addOpen=false;await createAccounts([st]);toast(`เพิ่ม ${name} เข้า ${S.adm.room} และสร้างบัญชีแล้ว`);soon()}).catch(e=>fail(e))},
 'a-off'(d){const st=stu(d.id);st.active=false;updateDoc(D('students',d.id),{active:false}).then(()=>toast('ตั้งเป็นไม่ใช้งานแล้ว บัตรของนักเรียนคนนี้เข้าระบบไม่ได้')).catch(e=>fail(e))},
 'a-on'(d){const st=stu(d.id);st.active=true;updateDoc(D('students',d.id),{active:true}).then(()=>toast('เปิดใช้งานแล้ว')).catch(e=>fail(e))},
 'a-acc'(){const list=ACT().filter(s=>!s.uid);createAccounts(list).then(n=>{if(n)toast(`สร้างบัญชีแล้ว ${n} คน พิมพ์บัตรได้ที่แท็บ บัตร QR`);soon()})},
 'a-tpl'(){toast('กำลังสร้างแม่แบบ...');(async()=>{const head=['เลขประจำตัว','คำนำหน้า','ชื่อ','นามสกุล','ชั้น','ห้อง','เลขที่'],ex=['66101','ด.ญ.','กานดา','รักเรียน','ม.4','3','1'];
  try{const X=await loadXLSX();const ws=X.utils.aoa_to_sheet([head,ex]);ws['!cols']=head.map(()=>({wch:14}));const wb=X.utils.book_new();X.utils.book_append_sheet(wb,ws,'รายชื่อ');await saveFile('แม่แบบรายชื่อนักเรียน.xlsx',new Blob([X.write(wb,{type:'array',bookType:'xlsx'})]))}
  catch(e){await saveFile('แม่แบบรายชื่อนักเรียน.csv',new Blob(['﻿'+head.join(',')+'\n'+ex.join(',')+'\n'],{type:'text/csv'}))}soon()})();return false},
 'a-imp-cancel'(){S.adm.imp=null},
 'a-imp-ok'(){const I=S.adm.imp;const bad=I.rows.filter(r=>(r.kind==='new'||r.kind==='move')&&!/^[A-Za-z0-9]+$/.test(r.id));if(bad.length){toast(`เลขประจำตัวแถว ${bad[0].line} มีอักขระที่ใช้ไม่ได้`);return}
  const ops=[],fresh=[];let n=0,m=0;
  I.rows.forEach(r=>{if(r.kind==='new'){const data={prefix:r.prefix,name:r.name,last:r.last,room:r.room,no:+r.no,active:true,uid:null,cardVer:0};ops.push(b=>b.set(D('students',r.id),data));fresh.push([r.id,data]);n++}
   else if(r.kind==='move'){ops.push(b=>b.update(D('students',r.id),{room:r.room,no:+r.no}));const st=stu(r.id);st.room=r.room;st.no=+r.no;m++}});
  const first=I.rows.find(r=>r.kind==='new'||r.kind==='move');S.adm.imp=null;if(first){S.adm.level=first.room.split('/')[0];S.adm.room=first.room}S.tab='rooms';
  commitChunks(ops).then(async()=>{const sts=fresh.map(([id,d])=>upsertStudent(id,d));toast(`บันทึกแล้ว: เพิ่มใหม่ ${n} คน ย้ายห้อง ${m} คน`);soon();const made=await createAccounts(sts);if(made)toast(`บันทึกแล้ว และสร้างบัญชี ${made} คน พิมพ์บัตรได้ที่แท็บ บัตร QR`);soon()}).catch(e=>fail(e,'บันทึกรายชื่อไม่สำเร็จ'))},
 'c-all'(){S.adm.cardRooms=allRooms().filter(r=>r.startsWith(S.adm.cardLevel+'/'))},
 'c-dl'(){const A=S.adm;const sel=ACT().filter(s=>A.cardRooms.includes(s.room)).sort((a,b)=>a.room.localeCompare(b.room,'th',{numeric:true})||a.no-b.no);toast('กำลังเตรียมไฟล์บัตร...');exportCards(sel,A.cardRooms.length===1?'ห้อง '+A.cardRooms[0]:A.cardLevel+' '+A.cardRooms.length+' ห้อง')},
 't-ok'(d){const t=S.teachers.find(x=>x.uid===d.u);t.status='approved';updateDoc(D('users',d.u),{status:'approved'}).then(()=>toast('อนุมัติแล้ว ครูเข้าใช้งานได้ทันที')).catch(e=>fail(e))},
 't-no'(d){S.teachers=S.teachers.filter(x=>x.uid!==d.u);updateDoc(D('users',d.u),{status:'rejected'}).then(()=>toast('นำออกจากรายชื่อครูแล้ว')).catch(e=>fail(e))},
};
document.addEventListener('click',e=>{const el=e.target.closest('[data-act]');if(!el||el.tagName==='SELECT'||el.tagName==='INPUT')return;const f=A[el.dataset.act];if(!f)return;if(f(el.dataset,el,e)===false)return;render()});
document.addEventListener('change',e=>{const t=e.target;
 if(t.dataset.g){gridChange(t);return}
 if(t.dataset.actChange==='personal'){S.personal=t.checked;return}
 if(t.dataset.actChange==='scanfile'){const f=t.files&&t.files[0];if(f)scanImage(f);return}
 if(t.dataset.actChange==='impfile'){const f=t.files&&t.files[0];if(!f)return;toast('กำลังอ่านไฟล์...');render();readRoster(f).then(rows=>{S.adm.imp={file:f.name,rows};render()}).catch(e=>{toast(e.message==='head'?'ไม่พบหัวคอลัมน์ "เลขประจำตัว" ในไฟล์ ใช้แม่แบบแล้วลองใหม่':'อ่านไฟล์ไม่สำเร็จ ลองบันทึกเป็น .csv แล้วอัปโหลดใหม่');render()});return}
 if(t.dataset.actChange==='clevel'){S.adm.cardLevel=t.value;S.adm.cardRooms=allRooms().filter(r=>r.startsWith(t.value+'/'));render();return}
 if(t.dataset.croom){const r=t.dataset.croom;S.adm.cardRooms=t.checked?[...new Set([...S.adm.cardRooms,r])]:S.adm.cardRooms.filter(x=>x!==r);render();return}
 if(t.dataset.actChange==='subj'){useSubject(t.value);S.confirmDel=false;if(S.user&&S.user.role==='student'){const st=stu(S.user.id);checkLevel(st);if(S.tab==='village')loadMates()}render();return}
 if(t.dataset.actChange==='apstu'){S.apStudent=t.value;render();return}
 if(t.dataset.actChange==='sort'){S.sort=t.value;render();return}
 if(t.dataset.actChange==='vmode'){S.settings.villageMode=t.value;saveSub();render();return}
 if(t.dataset.cat){const [i,f]=t.dataset.cat.split('|');const c=S.settings.cats[+i];c[f]=t.type==='checkbox'?t.checked:f==='max'?Math.max(0,+t.value||0):t.value;saveSub();render();return}
 if(t.dataset.room){const r=t.dataset.room;S.rooms=t.checked?[...new Set([...S.rooms,r])].sort():S.rooms.filter(x=>x!==r);if(!S.rooms.includes(S.room))S.room=S.rooms[0]||null;saveSub();render();return}
 if(t.dataset.set==='level'){S.settings.level=t.value;S.rooms=S.rooms.filter(r=>r.startsWith(t.value+'/'));if(!S.rooms.includes(S.room))S.room=S.rooms[0]||null;saveSub();render();return}
 if(t.dataset.set){S.settings[t.dataset.set]=t.type==='number'?(+t.value||0):t.value;saveSub();render();return}
 if(t.dataset.score){const [sid,qid]=t.dataset.score.split('|');const s=stu(sid),q=quest(qid);grade(s,q,t.value===''?null:Math.max(0,Math.min(q.points,+t.value||0)));render();return}
});
document.addEventListener('keydown',e=>{const t=e.target;if(e.key!=='Enter'||!t.dataset||!t.dataset.g||t.type!=='number')return;e.preventDefault();
 const td=t.closest('td');if(!td){t.blur();return}const col=[...td.parentNode.children].indexOf(td);const next=td.parentNode.nextElementSibling;const n=next&&next.children[col]&&next.children[col].querySelector('input');t.blur();if(n){n.focus();n.select&&n.select()}});
render();
