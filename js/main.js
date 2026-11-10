/* ฟาร์มพิชิตคะแนน — แอปหลัก (Firebase + GitHub Pages) · พัฒนาโดย Kru.Kungkaew */
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
const CARD_DOMAIN='castle.local',TEACH_DOMAIN='teacher.castle.local';
const HR=36e5;

/* ---------- ข้อมูลเกม (ราคา/เวลาในฟังก์ชันของ firestore.rules ต้องตรงกับตารางนี้) ---------- */
const CROPS={
 carrot:{name:'แครอท',em:'🥕',grow:3,price:5},
 tomato:{name:'มะเขือเทศ',em:'🍅',grow:6,price:10},
 cabbage:{name:'กะหล่ำปลี',em:'🥬',grow:12,price:20},
 pumpkin:{name:'ฟักทอง',em:'🎃',grow:24,price:40}};
const ANIMALS={
 chicken:{name:'ไก่',em:'🐔',price:60,unlock:4,prod:'egg',every:6,max:6,pen:'เล้าไก่'},
 sheep:{name:'แกะ',em:'🐑',price:120,unlock:6,prod:'wool',every:12,max:4,pen:'คอกแกะ'},
 pig:{name:'หมู',em:'🐷',price:200,unlock:8,prod:'bacon',every:24,max:3,pen:'คอกหมู'},
 horse:{name:'ม้า',em:'🐴',price:250,unlock:8,prod:'manure',every:24,max:2,pen:'คอกม้า'},
 fish:{name:'ปลา',em:'🐟',price:40,unlock:3,prod:'fish',every:12,max:6,pen:'บ่อปลา'}};
const PRODUCTS={
 carrot:{name:'แครอท',em:'🥕',price:5},tomato:{name:'มะเขือเทศ',em:'🍅',price:10},cabbage:{name:'กะหล่ำปลี',em:'🥬',price:20},pumpkin:{name:'ฟักทอง',em:'🎃',price:40},
 egg:{name:'ไข่ไก่',em:'🥚',price:8},wool:{name:'ขนแกะ',em:'🧶',price:18},bacon:{name:'เบคอน',em:'🥓',price:40},manure:{name:'ปุ๋ยคอกม้า',em:'🌱',price:30},fish:{name:'ปลา',em:'🐟',price:15}};
const DECOR={
 d_flowers:{name:'แปลงดอกไม้',em:'🌷',price:40,unlock:1},
 d_scarecrow:{name:'หุ่นไล่กา',em:'👒',price:50,unlock:2},
 d_mailbox:{name:'ตู้จดหมาย',em:'📮',price:40,unlock:2},
 d_well:{name:'บ่อน้ำ',em:'🪣',price:80,unlock:3},
 d_flag:{name:'ธงประจำฟาร์ม',em:'🚩',price:100,unlock:3},
 d_hay:{name:'กองฟาง',em:'🌾',price:60,unlock:4},
 d_windmill:{name:'กังหันลม',em:'🌀',price:200,unlock:5},
 d_hive:{name:'รังผึ้ง',em:'🐝',price:120,unlock:6},
 d_greenhouse:{name:'โรงเรือนกระจก',em:'🏡',price:300,unlock:8},
 d_tractor:{name:'รถแทรกเตอร์',em:'🚜',price:400,unlock:9}};
const STAGES=['ที่ดินว่างเปล่า','ปรับที่ดิน + ทางเดินดิน','เริ่มปลูกผัก (แปลงผักผุดขึ้นมา)','สระน้ำมีปลา (ปลดล็อกปลา)','บ้านไร่ + เล้าไก่ (ปลดล็อกไก่)','โรงนาแดง','คอกแกะ (ปลดล็อกแกะ)','สวนผลไม้ + ไซโล','คอกหมู + คอกม้า (ปลดล็อกหมู ม้า)','ทุ่งหญ้าและทิวทัศน์ครบ','ฟาร์มสมบูรณ์แบบ'];
const LEVELS=['ม.1','ม.2','ม.3','ม.4','ม.5','ม.6'];
const HELP_COIN=5,HELP_QUOTA=3;
const plotCount=stage=>Math.min(12,2+stage);

const defaultCats=()=>[{name:'คะแนนเก็บ',max:50,visible:true,castle:true},{name:'สอบกลางภาค',max:20,visible:true,castle:true},{name:'สอบปลายภาค',max:30,visible:false,castle:false}];
const EMPTY_SUB={id:'__none',settings:{subject:'',code:'',level:'ม.4',term:SCHOOL.term,pass:50,prices:{},cats:defaultCats()},rooms:[],quests:[],claims:[],sales:[],farms:{},stats:null,helps:[],teacherUids:[]};
const S={students:[],subjects:[],subId:'__none',user:null,tab:null,apView:'room',apStudent:null,room:null,sort:'no',modal:null,toast:null,
 boot:CONFIGURED?'loading':'noconfig',bootMsg:'',me:null,teachers:[],personal:true,loginMode:'student',lbSort:'earned',tsec:{},pickPlot:null,tilt:[0,0],
 sell:{},plant:null,
 adm:{level:'ม.4',room:null,imp:null,cardLevel:'ม.4',cardRooms:[],addOpen:false,newT:null,showPw:{}}};
const SUBKEYS=['settings','rooms','quests','claims','sales','farms','stats','helps'];
SUBKEYS.forEach(k=>Object.defineProperty(S,k,{get(){return curSub()[k]},set(v){curSub()[k]=v}}));
function curSub(){return S.subjects.find(x=>x.id===S.subId)||EMPTY_SUB}
const blankProg=()=>({scores:{},special:[]});
const blankFarm=()=>({stage:0,coins:0,earned:0,sold:0,inv:[],plots:{},animals:{},stock:{},lastHelp:''});
const normFarm=d=>Object.assign(blankFarm(),d||{});
function slot(st){return st.bySub[S.subId]||(st.bySub[S.subId]=blankProg())}
function newStudent(id,no,name,room){const st={id,no,name,room,bySub:{}};['scores','special'].forEach(k=>Object.defineProperty(st,k,{get(){return slot(st)[k]},set(v){slot(st)[k]=v},enumerable:true}));S.students.push(st);return st}
function upsertStudent(id,d){let st=S.students.find(s=>s.id===id);if(!st)st=newStudent(id,d.no||0,d.name||'',d.room||'');
 Object.assign(st,{no:+d.no||0,name:d.name||'',room:d.room||'',prefix:d.prefix||'',last:d.last||'',active:d.active!==false,uid:d.uid||null,cardVer:d.cardVer||0});return st}
const enrolled=st=>st.active===false?[]:S.subjects.filter(x=>x.rooms.includes(st.room));
function useSubject(id){S.subId=id;if(!S.rooms.includes(S.room))S.room=S.rooms[0]||null;S.modal=null}
function subFromDoc(id,d){return {id,settings:Object.assign({},EMPTY_SUB.settings,{cats:defaultCats(),prices:{}},d.settings||{}),rooms:d.rooms||[],quests:[],claims:[],sales:[],farms:{},stats:null,helps:[],teacherUids:d.teacherUids||[],_prog:new Set(),_farm:new Set(),_ld:{}}}
const newId=p=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,6);

/* ---------- logic ---------- */
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
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
 let stage=Math.min(10,Math.floor(pct*10+1e-9));
 const nextAt=stage>=10?null:Math.ceil((stage+1)*max/10);
 return {sc,max,pct,stage,toNext:nextAt==null?0:Math.max(0,nextAt-sc)};
}
function risk(st){
 const have=scoreOf(st),pass=S.settings.pass,fin=hiddenMax();
 if(have>=pass)return {k:'good',label:'ปลอดภัย',detail:'มีคะแนนถึงเกณฑ์ผ่านแล้ว'};
 const need=pass-have;
 if(need>fin)return {k:'crit',label:'เสี่ยงติด 0',detail:`ได้ปลายภาคเต็ม ${fin} ก็ยังขาด ${need-fin} คะแนน`};
 return {k:'warn',label:`ต้องได้ปลายภาค ${need}/${fin}`,detail:`ต้องได้ปลายภาคอย่างน้อย ${need} จาก ${fin} คะแนน`};
}
const pendingClaim=(sid,qid)=>S.claims.some(c=>c.sid===sid&&c.qid===qid&&c.status==='pending');
const farmOf=sid=>S.farms[sid]||blankFarm();
const priceOf=k=>{const p=S.settings.prices&&S.settings.prices[k];return p==null||p===''?PRODUCTS[k].price:Number(p)||0};
const tms=t=>typeof t==='number'?t:t&&t.toMillis?t.toMillis():(t&&t.seconds?t.seconds*1000:Date.now());
const thaiNow=()=>new Date(Date.now()+25200000);
const dayNum=()=>Math.floor((Date.now()+25200000)/864e5);
const isWeekend=()=>{const d=thaiNow().getUTCDay();return d===0||d===6};
function leftTxt(ms){if(ms<=0)return 'พร้อมแล้ว';const m=Math.ceil(ms/6e4);return m>=60?`${Math.floor(m/60)} ชม. ${m%60} นาที`:`${m} นาที`}
function plotInfo(p){const g=CROPS[p.k].grow*HR,el=Date.now()-tms(p.t);return {k:p.k,pct:Math.max(0,Math.min(1,el/g)),left:g-el,ready:el>=g}}
function animInfo(a){const A=ANIMALS[a.k],g=A.every*HR,el=Date.now()-tms(a.t);return {k:a.k,pct:Math.max(0,Math.min(1,el/g)),left:g-el,ready:el>=g}}
const pendingQty=(sid,k)=>S.sales.filter(s=>s.sid===sid&&s.status==='pending').reduce((a,s)=>a+((s.items&&s.items[k])||0),0);
const stockOf=(f,k)=>(f.stock&&f.stock[k])||0;
const availOf=(sid,k)=>Math.max(0,stockOf(farmOf(sid),k)-pendingQty(sid,k));
const salesTotal=items=>Object.keys(items||{}).reduce((a,k)=>a+(PRODUCTS[k]?(items[k]||0)*priceOf(k):0),0);
const itemsTxt=items=>Object.keys(items||{}).filter(k=>PRODUCTS[k]&&items[k]>0).map(k=>`${PRODUCTS[k].em}${PRODUCTS[k].name} ×${items[k]}`).join('  ')||'-';
const fmt=n=>(Number(n)||0).toLocaleString('th-TH');
const freeSlot=(map,prefix,max)=>{for(let i=0;i<max;i++)if(!map[prefix+i])return prefix+i;return null};
const animalsOf=(f,k)=>Object.keys(f.animals||{}).filter(x=>f.animals[x].k===k);

/* ---------- ภาพฟาร์ม (SVG การ์ตูนสดใส อ้างอิงภาพต้นแบบ) ---------- */
const sh=(x,y,rx,ry,o=.14)=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#1d3b12" opacity="${o}"/>`;
const tree=(x,y,s=1,fruit=true)=>`<g transform="translate(${x},${y}) scale(${s})">${sh(0,6,26,7)}<rect x="-5" y="-22" width="10" height="30" rx="3" fill="#8a5a2b"/><circle cx="-15" cy="-34" r="19" fill="#3b9a37"/><circle cx="15" cy="-34" r="19" fill="#44a93e"/><circle cx="0" cy="-48" r="22" fill="#55bb48"/>${fruit?'<circle cx="-12" cy="-38" r="3.8" fill="#e5382d"/><circle cx="11" cy="-30" r="3.8" fill="#e5382d"/><circle cx="2" cy="-54" r="3.8" fill="#e5382d"/><circle cx="19" cy="-44" r="3.8" fill="#e5382d"/>':''}</g>`;
const fence=(x1,y1,x2,y2)=>{const n=Math.max(2,Math.round(Math.hypot(x2-x1,y2-y1)/20));let s=`<line x1="${x1}" y1="${y1-7}" x2="${x2}" y2="${y2-7}" stroke="#c99a58" stroke-width="3"/><line x1="${x1}" y1="${y1-14}" x2="${x2}" y2="${y2-14}" stroke="#c99a58" stroke-width="3"/>`;for(let i=0;i<=n;i++){const x=x1+(x2-x1)*i/n,y=y1+(y2-y1)*i/n;s+=`<rect x="${x-2.5}" y="${y-19}" width="5" height="21" rx="1.5" fill="#a5733a"/>`}return s};
const cottage=(x,y)=>`<g transform="translate(${x},${y})">${sh(0,4,80,12)}<rect x="-58" y="-62" width="116" height="62" fill="#fff1cf" stroke="#e3c987" stroke-width="2"/><polygon points="-72,-58 0,-112 72,-58" fill="#d9573b"/><polygon points="-72,-58 0,-112 0,-100 -56,-58" fill="#ea6c4d"/><rect x="30" y="-106" width="14" height="30" fill="#b9553f"/><rect x="-14" y="-40" width="28" height="40" rx="3" fill="#8a5a2b"/><circle cx="8" cy="-20" r="2.2" fill="#ffd34d"/><rect x="-50" y="-46" width="24" height="22" rx="3" fill="#bfe6ff" stroke="#8a5a2b" stroke-width="3"/><rect x="26" y="-46" width="24" height="22" rx="3" fill="#bfe6ff" stroke="#8a5a2b" stroke-width="3"/><circle cx="0" cy="-70" r="7" fill="#bfe6ff" stroke="#8a5a2b" stroke-width="2.5"/></g>`;
const barn=(x,y)=>`<g transform="translate(${x},${y})">${sh(0,4,70,11)}<polygon points="-56,-56 -42,-92 42,-92 56,-56" fill="#a63a2c"/><rect x="-56" y="-56" width="112" height="56" fill="#d8483a"/><rect x="-24" y="-40" width="48" height="40" fill="#f4e9d2" stroke="#fff" stroke-width="3"/><path d="M-24 -40 L24 0 M24 -40 L-24 0" stroke="#fff" stroke-width="3"/><rect x="-10" y="-80" width="20" height="14" rx="2" fill="#f4e9d2"/><rect x="-60" y="-60" width="120" height="6" rx="2" fill="#7a2a21"/></g>`;
const silo=(x,y)=>`<g transform="translate(${x},${y})">${sh(0,4,24,7)}<rect x="-20" y="-86" width="40" height="86" fill="#cfd8e0"/><rect x="-20" y="-86" width="14" height="86" fill="#e5ebf0"/><path d="M-22 -86 Q0 -116 22 -86Z" fill="#b24437"/><path d="M-20 -60 H20 M-20 -36 H20 M-20 -14 H20" stroke="#9fb0bd" stroke-width="2"/></g>`;
const coop=(x,y)=>`<g transform="translate(${x},${y})">${sh(0,4,40,8)}<rect x="-32" y="-34" width="64" height="34" fill="#c98f4b"/><polygon points="-38,-32 0,-58 38,-32" fill="#b8563a"/><rect x="-8" y="-22" width="16" height="22" rx="8" fill="#5c3a1c"/><path d="M8 0 L26 0 L22 -8 L8 -8Z" fill="#a5733a"/></g>`;
const pond=(x,y)=>`<g transform="translate(${x},${y})"><ellipse cx="0" cy="0" rx="118" ry="62" fill="#9a6f3d"/><ellipse cx="0" cy="-2" rx="110" ry="56" fill="#4fb4e6"/><ellipse cx="-20" cy="-14" rx="70" ry="26" fill="#7bcbf0" opacity=".7"/><rect x="-128" y="-14" width="76" height="22" rx="3" fill="#b98a4e"/><path d="M-120 -14 V8 M-98 -14 V8 M-76 -14 V8 M-54 -14 V8" stroke="#8a5a2b" stroke-width="2"/><ellipse cx="60" cy="14" rx="14" ry="6" fill="#4caf50"/><ellipse cx="82" cy="-14" rx="10" ry="5" fill="#4caf50"/></g>`;
const dirt=`<path d="M470 600 C470 540 430 520 440 470 C450 420 510 410 500 360 C490 320 440 316 450 270 C456 240 500 230 500 190 L530 190 C530 240 490 256 496 290 C502 330 556 340 548 390 C540 440 490 450 504 500 C516 540 520 570 520 600Z" fill="#d8b17b"/><path d="M500 360 C560 360 600 330 640 300 L640 322 C600 350 560 384 500 388Z" fill="#d8b17b"/><path d="M450 270 C400 276 360 262 330 250 L330 232 C366 246 406 252 452 246Z" fill="#d8b17b"/>`;
const chicken=(x,y,f=1)=>`<g transform="translate(${x},${y}) scale(${f},1)">${sh(0,5,9,3)}<ellipse cx="0" cy="-8" rx="9" ry="8" fill="#fff"/><circle cx="8" cy="-15" r="5" fill="#fff"/><path d="M6 -21 q2 -4 4 0 q2 -3 3 1z" fill="#e5382d"/><path d="M13 -15 l5 2 l-5 1z" fill="#f5a623"/><circle cx="9" cy="-16" r="1.1" fill="#222"/><path d="M-9 -10 q-7 -2 -6 -8 q5 1 8 6z" fill="#e9e4da"/><path d="M-2 0 v4 M3 0 v4" stroke="#f5a623" stroke-width="1.6"/></g>`;
const sheep=(x,y,f=1)=>`<g transform="translate(${x},${y}) scale(${f},1)">${sh(0,5,14,4)}<circle cx="-8" cy="-10" r="8" fill="#fbfbf6"/><circle cx="2" cy="-13" r="9" fill="#fff"/><circle cx="9" cy="-9" r="8" fill="#fbfbf6"/><ellipse cx="17" cy="-9" rx="5.5" ry="6" fill="#4a4a4a"/><circle cx="18" cy="-10" r="1" fill="#fff"/><path d="M-6 -3 v8 M6 -3 v8" stroke="#4a4a4a" stroke-width="2.4" stroke-linecap="round"/></g>`;
const pig=(x,y,f=1)=>`<g transform="translate(${x},${y}) scale(${f},1)">${sh(0,5,15,4)}<ellipse cx="0" cy="-9" rx="14" ry="9" fill="#f7a8b8"/><circle cx="13" cy="-11" r="7" fill="#f7a8b8"/><ellipse cx="19" cy="-10" rx="3.2" ry="3" fill="#ee8aa0"/><path d="M11 -18 l3 -4 l2 5z" fill="#ee8aa0"/><circle cx="12" cy="-13" r="1" fill="#222"/><path d="M-6 -2 v7 M6 -2 v7" stroke="#ee8aa0" stroke-width="3" stroke-linecap="round"/><path d="M-14 -10 q-4 -3 -2 -6" stroke="#ee8aa0" stroke-width="1.6" fill="none"/></g>`;
const horse=(x,y,f=1)=>`<g transform="translate(${x},${y}) scale(${f},1)">${sh(0,5,20,5)}<ellipse cx="0" cy="-16" rx="18" ry="10" fill="#a8693a"/><path d="M12 -22 L22 -38 L32 -34 L30 -24 L20 -16Z" fill="#a8693a"/><path d="M20 -38 q-4 -4 -7 2 l4 6z" fill="#6b3f1e"/><circle cx="27" cy="-31" r="1.4" fill="#222"/><path d="M-12 -8 v14 M-4 -8 v14 M6 -8 v14 M14 -8 v14" stroke="#7a4a26" stroke-width="3.4" stroke-linecap="round"/><path d="M-18 -18 q-8 2 -8 12" stroke="#6b3f1e" stroke-width="3" fill="none" stroke-linecap="round"/></g>`;
const fishS=(x,y,f=1)=>`<g transform="translate(${x},${y}) scale(${f},1)"><ellipse cx="0" cy="0" rx="9" ry="5" fill="#ff9a3c"/><path d="M-8 0 l-7 -5 v10z" fill="#ff7a1c"/><circle cx="4" cy="-1" r="1.2" fill="#222"/></g>`;
const ANIM_ART={chicken,sheep,pig,horse};
/* จุดวางสัตว์ในแต่ละคอก */
const PENS={chicken:{x:800,y:218,w:140,h:76,pos:[[820,250],[850,272],[885,250],[915,274],[835,226],[900,230]]},
 sheep:{x:620,y:226,w:150,h:90,pos:[[650,270],[700,290],[740,264],[690,246]]},
 pig:{x:620,y:350,w:150,h:84,pos:[[656,396],[706,410],[748,388]]},
 horse:{x:800,y:340,w:140,h:96,pos:[[836,400],[896,392]]},
 fish:{pos:[[610,520],[650,540],[700,512],[740,540],[780,520],[690,556]]}};
const sprout=(k,p,x,y)=>{const s=p<.34?.45:p<1?.75:1;
 const art={carrot:`<path d="M-5 0 L5 0 L0 12Z" fill="#ff8a1f" transform="translate(0,${p>=1?-2:2})"/><path d="M0 0 q-6 -9 -9 -7 M0 0 q0 -11 0 -12 M0 0 q6 -9 9 -7" stroke="#3f9d3a" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  tomato:`<path d="M0 8 V-6" stroke="#3f9d3a" stroke-width="3"/><circle cx="0" cy="-8" r="${p>=1?8:4}" fill="${p>=1?'#e5382d':'#7bc96b'}"/><path d="M-5 -14 l5 3 l5 -3" stroke="#3f9d3a" stroke-width="2.4" fill="none"/>`,
  cabbage:`<circle cx="0" cy="-3" r="10" fill="#8fd16a"/><circle cx="0" cy="-3" r="6.5" fill="#b6e48b"/><path d="M-6 -3 q6 -6 12 0" stroke="#69b04b" stroke-width="2" fill="none"/>`,
  pumpkin:`<ellipse cx="0" cy="-2" rx="11" ry="8.5" fill="#ff8a1f"/><path d="M-4 -9 q-1 8 0 14 M4 -9 q1 8 0 14" stroke="#e06c0a" stroke-width="1.6" fill="none"/><rect x="-1.5" y="-14" width="3" height="6" fill="#3f9d3a"/>`}[k];
 return `<g transform="translate(${x},${y}) scale(${s})">${art}</g>`};
function plotSVG(i,p){const col=i%4,row=Math.floor(i/4),x=44+col*94,y=222+row*80;
 let s=`<rect x="${x}" y="${y}" width="84" height="62" rx="9" fill="#8b5a2b"/><rect x="${x+3}" y="${y+3}" width="78" height="56" rx="7" fill="#a06a35"/><path d="M${x+8} ${y+22} H${x+76} M${x+8} ${y+42} H${x+76}" stroke="#7d4f24" stroke-width="3" stroke-linecap="round"/>`;
 if(p){const I=plotInfo(p);[0,1,2].forEach(j=>{s+=sprout(p.k,I.pct,x+16+j*26,y+34)});if(I.ready)s+=`<text x="${x+68}" y="${y+16}" font-size="14" text-anchor="middle">✨</text>`}
 return s}
const girl=(x,y)=>`<g transform="translate(${x},${y})">${sh(0,5,12,4)}<rect x="-8" y="-26" width="16" height="22" rx="6" fill="#4aa3e8"/><rect x="-6" y="-6" width="5" height="9" fill="#f3c9a0"/><rect x="1" y="-6" width="5" height="9" fill="#f3c9a0"/><circle cx="0" cy="-34" r="9" fill="#f3c9a0"/><path d="M-10 -36 a10 10 0 0 1 20 0 q-4 -4 -10 -3 q-6 -1 -10 3z" fill="#6b3f1e"/><path d="M-11 -37 q-3 12 0 18" stroke="#6b3f1e" stroke-width="4" fill="none"/><ellipse cx="0" cy="-42" rx="14" ry="3" fill="#f1c85a"/><circle cx="-3" cy="-33" r="1.1" fill="#222"/><circle cx="3" cy="-33" r="1.1" fill="#222"/><path d="M8 -20 l14 4" stroke="#f3c9a0" stroke-width="4" stroke-linecap="round"/><rect x="18" y="-22" width="12" height="9" rx="2" fill="#5fb85f"/><path d="M30 -19 l8 -4" stroke="#5fb85f" stroke-width="3"/><path d="M40 -22 l3 6 M43 -22 l3 6 M46 -22 l3 6" stroke="#6ec6ff" stroke-width="1.6"/></g>`;
const birds=`<g fill="none" stroke="#3b4a5a" stroke-width="2" stroke-linecap="round"><path d="M650 40 q6 -8 12 0 q6 -8 12 0"/><path d="M700 62 q5 -7 10 0 q5 -7 10 0"/><path d="M590 52 q4 -6 8 0 q4 -6 8 0"/></g>`;
const DECO={
 d_flowers:`<g transform="translate(405,206)"><ellipse cx="0" cy="2" rx="30" ry="9" fill="#7a4a24"/>${[-20,-10,0,10,20].map((x,i)=>`<circle cx="${x}" cy="${-2+(i%2)*3}" r="5" fill="${['#ff6b8a','#ffd34d','#fff','#ff9a3c','#c77dff'][i]}"/><circle cx="${x}" cy="${-2+(i%2)*3}" r="1.8" fill="#ffb300"/>`).join('')}</g><g transform="translate(540,206)"><ellipse cx="0" cy="2" rx="26" ry="8" fill="#7a4a24"/>${[-14,0,14].map((x,i)=>`<circle cx="${x}" cy="${-2}" r="5" fill="${['#ffd34d','#ff6b8a','#fff'][i]}"/>`).join('')}</g>`,
 d_scarecrow:`<g transform="translate(300,262)">${sh(0,4,12,4)}<rect x="-2" y="-40" width="4" height="44" fill="#8a5a2b"/><path d="M-22 -26 H22" stroke="#8a5a2b" stroke-width="4" stroke-linecap="round"/><rect x="-9" y="-34" width="18" height="18" rx="3" fill="#e5382d"/><circle cx="0" cy="-44" r="8" fill="#f1c97a"/><path d="M-12 -47 h24 l-4 -9 h-16z" fill="#8a5a2b"/><circle cx="-3" cy="-44" r="1.2" fill="#222"/><circle cx="3" cy="-44" r="1.2" fill="#222"/></g>`,
 d_mailbox:`<g transform="translate(590,196)"><rect x="-2" y="-18" width="4" height="22" fill="#8a5a2b"/><rect x="-11" y="-32" width="22" height="16" rx="6" fill="#3a7bd5"/><rect x="6" y="-40" width="3" height="10" fill="#e5382d"/></g>`,
 d_well:`<g transform="translate(538,238)">${sh(0,4,20,6)}<rect x="-16" y="-20" width="32" height="22" rx="4" fill="#9aa4ad"/><rect x="-16" y="-20" width="32" height="6" rx="3" fill="#b8c1c9"/><path d="M-18 -20 V-44 M18 -20 V-44" stroke="#8a5a2b" stroke-width="4"/><polygon points="-24,-44 0,-58 24,-44" fill="#b8563a"/></g>`,
 d_flag:`<g transform="translate(372,172)"><rect x="-1.5" y="-48" width="3" height="50" fill="#8a5a2b"/><path d="M1 -48 L28 -41 L1 -32Z" fill="#e5382d"/><circle cx="0" cy="-50" r="3" fill="#ffc83d"/></g>`,
 d_hay:`<g transform="translate(596,318)">${sh(0,4,22,6)}<ellipse cx="0" cy="-12" rx="18" ry="14" fill="#e6c157"/><ellipse cx="0" cy="-12" rx="9" ry="7" fill="none" stroke="#c9a23a" stroke-width="2"/><ellipse cx="26" cy="-8" rx="13" ry="10" fill="#efd070"/></g>`,
 d_windmill:`<g transform="translate(572,100)">${sh(0,4,22,6)}<polygon points="-14,0 14,0 8,-54 -8,-54" fill="#f4e9d2" stroke="#d9c79a" stroke-width="2"/><polygon points="-10,-54 10,-54 0,-68" fill="#c0503a"/><g transform="translate(0,-48)"><path d="M0 0 L-6 -30 L6 -30Z M0 0 L30 -6 L30 6Z M0 0 L6 30 L-6 30Z M0 0 L-30 6 L-30 -6Z" fill="#fff" stroke="#c9b27a" stroke-width="1.5"><animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="14s" repeatCount="indefinite"/></path><circle r="4" fill="#8a5a2b"/></g></g>`,
 d_hive:`<g transform="translate(70,200)"><rect x="-10" y="-4" width="20" height="8" fill="#a5733a"/><rect x="-11" y="-28" width="22" height="10" rx="3" fill="#ffc83d"/><rect x="-11" y="-18" width="22" height="10" rx="3" fill="#f0b21f"/><circle cx="16" cy="-24" r="2" fill="#222"/><circle cx="-18" cy="-14" r="2" fill="#222"/></g>`,
 d_greenhouse:`<g transform="translate(110,516)">${sh(0,4,52,9)}<rect x="-48" y="-40" width="96" height="40" fill="#d6f1ff" stroke="#8fb9d4" stroke-width="3" opacity=".9"/><path d="M-48 -40 Q0 -72 48 -40Z" fill="#e6f7ff" stroke="#8fb9d4" stroke-width="3"/><path d="M-16 -40 V0 M16 -40 V0" stroke="#8fb9d4" stroke-width="2"/><circle cx="-30" cy="-12" r="6" fill="#e5382d"/><circle cx="0" cy="-12" r="6" fill="#e5382d"/><circle cx="30" cy="-12" r="6" fill="#ff8a1f"/></g>`,
 d_tractor:`<g transform="translate(330,520)">${sh(0,6,36,7)}<rect x="-20" y="-30" width="36" height="22" rx="4" fill="#3fa34d"/><rect x="2" y="-48" width="22" height="22" rx="3" fill="#2f8a3c"/><rect x="6" y="-44" width="14" height="12" fill="#bfe6ff"/><circle cx="-22" cy="-6" r="12" fill="#333"/><circle cx="-22" cy="-6" r="5" fill="#ccc"/><circle cx="22" cy="-2" r="8" fill="#333"/><circle cx="22" cy="-2" r="3.5" fill="#ccc"/></g>`};
/* ฉากฟาร์มทั้งฉาก */
function farmScene(f,stage,o={}){
 const inv=f.inv||[],A=f.animals||{},P=f.plots||{};
 let s=`<svg viewBox="0 0 960 600" class="scene${o.cls?' '+o.cls:''}" role="img" aria-label="${esc(o.label||'ฟาร์ม')}" xmlns="http://www.w3.org/2000/svg"><rect width="960" height="600" fill="#a6dd63"/><g fill="#9ad457">${[...Array(12)].map((_,i)=>`<rect x="0" y="${i*50+10}" width="960" height="24" opacity=".35"/>`).join('')}</g>`;
 if(stage>=1)s+=dirt;
 if(stage<1)s+=`<g fill="#8a5a2b">${[[60,210],[440,210],[60,470],[440,470],[880,200],[880,450]].map(([x,y])=>`<rect x="${x}" y="${y}" width="4" height="22"/><path d="M${x+4} ${y+4} l14 4 l-14 4z" fill="#ff6b5b"/>`).join('')}</g>`;
 if(stage>=7)s+=[[60,86,1],[140,66,1.05],[222,92,1],[104,150,.95],[196,158,1]].map(([x,y,k])=>tree(x,y+30,k)).join('');
 if(stage>=3)s+=cottage(430,170);
 if(stage>=5)s+=barn(740,150);
 if(stage>=7)s+=silo(830,140);
 if(stage>=2){for(let r=0;r<3;r++)s+=fence(36,214+r*80,430,214+r*80).replace(/<line[^>]*\/>/g,'');}
 for(let i=0;i<12;i++){if(i<plotCount(stage))s+=plotSVG(i,P[`p${i}`]);else if(stage>=1)s+=`<rect x="${44+(i%4)*94}" y="${222+Math.floor(i/4)*80}" width="84" height="62" rx="9" fill="#9bd05a" stroke="#86bb48" stroke-width="2" stroke-dasharray="6 5"/>`}
 if(stage>=2)s+=fence(36,486,430,486);
 if(stage>=4)s+=`<g>${fence(790,296,946,296)}${fence(790,206,790,296)}</g>${coop(912,214)}`;
 if(stage>=6)s+=`${fence(614,320,774,320)}${fence(614,226,614,320)}${fence(774,226,774,320)}`;
 if(stage>=8)s+=`<rect x="614" y="340" width="160" height="96" rx="12" fill="#a57850"/>${fence(614,440,774,440)}${fence(614,346,614,440)}${fence(774,346,774,440)}${fence(790,440,946,440)}${fence(790,346,790,440)}<rect x="790" y="340" width="156" height="100" rx="12" fill="#b99b5e" opacity=".5"/>`;
 if(stage>=9)s+=pond(680,540);
 for(const k of ['chicken','sheep','pig','horse']){const list=animalsOf(f,k);list.forEach((id,j)=>{const pp=PENS[k].pos[j%PENS[k].pos.length];s+=ANIM_ART[k](pp[0],pp[1],j%2?-1:1)})}
 if(stage>=9)animalsOf(f,'fish').forEach((id,j)=>{const pp=PENS.fish.pos[j%6];s+=fishS(pp[0],pp[1],j%2?-1:1)});
 inv.forEach(id=>{if(DECO[id])s+=DECO[id]});
 if(stage>=1)s+=girl(486,330);
 s+=birds;
 if(stage>=10)s+=`<g transform="translate(480,40)"><rect x="-130" y="-22" width="260" height="40" rx="12" fill="#8a5a2b"/><rect x="-124" y="-17" width="248" height="30" rx="9" fill="#ffd96b"/><text x="0" y="5" text-anchor="middle" font-family="Kanit,sans-serif" font-size="19" font-weight="600" fill="#6b3f1e">${esc(o.title||'ฟาร์มสมบูรณ์แบบ')}</text></g><g>${[[300,70,'#ff6b8a'],[660,86,'#4aa3e8'],[860,60,'#ffc83d']].map(([x,y,c])=>`<ellipse cx="${x}" cy="${y}" rx="16" ry="20" fill="${c}"/><path d="M${x} ${y+20} v26" stroke="#555" stroke-width="1.5"/>`).join('')}</g>`;
 return s+'</svg>';
}

/* ---------- ฉากฟาร์มจากภาพจริง (ฉากเล่น 2.5D เคลื่อนไหวได้) ---------- */
const PH={plots:{x:6.6,y:63.2,w:48.6,h:31.8},
 pen:{chicken:{x:58,y:55},sheep:{x:67.5,y:40},horse:{x:89,y:30},pig:{x:86,y:56},fish:{x:83,y:74}},
 zone:{chicken:[49,46,20,12],sheep:[58,28,18,12],pig:[80,52,15,8],horse:[82,19,14,11],fish:[71,66,24,18]}};
const ph=d=>`animation-delay:-${((performance.now()/1000)%d).toFixed(2)}s`;
const hsh=s=>{let h=2166136261;for(const c of String(s))h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0)/4294967296};
const GIRL=[26.5,62,5.8,18.5];
const REVEAL=[[],
 [[41,56,6,12],[46,78,10,14],[52,92,12,10]],
 [[28,79,31,22]],
 [[84,76,22,24]],
 [[33,22,16,24],[58,50,15,13]],
 [[60,13,16,18]],
 [[67,35,15,13]],
 [[13,48,17,32],[71,8,7,11],[50,4,42,9]],
 [[85,53,14,12],[90,24,13,17]],
 [[50,50,64,64]]];
function revealStyle(stage){
 if(stage>=10)return '';
 const g=[];if(stage<10)g.push(`radial-gradient(ellipse ${GIRL[2]}% ${GIRL[3]}% at ${GIRL[0]}% ${GIRL[1]}%,#000 55%,transparent 100%)`);for(let k=1;k<=Math.min(stage,9);k++)(REVEAL[k]||[]).forEach(([x,y,rx,ry])=>g.push(`radial-gradient(ellipse ${rx}% ${ry}% at ${x}% ${y}%,#000 52%,transparent 100%)`));
  const v=g.join(',');return `-webkit-mask-image:${v};mask-image:${v};-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;`;
}
function ambient(f,stage){
 let s='<div class="amb" aria-hidden="true"><i class="rays" style="'+ph(14)+'"></i><i class="cloud c1" style="'+ph(90)+'"></i><i class="cloud c2" style="'+ph(140)+'"></i>';
 [[8,70,'🐦'],[16,95,'🐦'],[5,120,'🕊️']].forEach(([top,d,e],i)=>{s+=`<b class="bird" style="top:${top+i*3}%;animation-duration:${d}s;${ph(d)}"><span style="animation-delay:-${(i*.3).toFixed(1)}s">${e}</span></b>`});
 [[22,76,34],[14,82,45]].forEach(([x,y,d],i)=>{s+=`<b class="bfly" style="left:${x}%;top:${y}%;animation-duration:${d}s;${ph(d)}">🦋</b>`});
 if(stage>=3)for(let i=0;i<6;i++)s+=`<i class="glint" style="left:${72+hsh('g'+i)*22}%;top:${66+hsh('h'+i)*18}%;animation-delay:-${(i*.7).toFixed(1)}s">✦</i>`;
 const A=f&&f.animals||{};
 for(const id of Object.keys(A)){const a=A[id],k=a.k;if(!PH.zone[k])continue;const z=PH.zone[k],r1=hsh(id+'x'),r2=hsh(id+'y'),r3=hsh(id+'d');
  const dx=(r3<.5?-1:1)*(1.5+r1*3.5),dy=(r2-.5)*(k==='fish'?3:2.4),dur=k==='fish'?(9+r1*8):(14+r2*14);
  s+=`<b class="wa ${k}" style="left:${(z[0]+r1*z[2]).toFixed(1)}%;top:${(z[1]+r2*z[3]).toFixed(1)}%;--dx:${dx.toFixed(1)}cqw;--dy:${dy.toFixed(1)}cqw;animation-duration:${dur.toFixed(1)}s;${ph(dur)}"><span style="animation-delay:-${(r3*2).toFixed(1)}s">${ANIMALS[k].em}</span></b>`}
 return s+'</div>';
}
function photoScene(f,stage,o={}){
 const P=f.plots||{},n=plotCount(stage);
 const thumb=o.cls==='thumb',rv=revealStyle(stage),style=rv?` style="${rv}"`:'',tl=S.tilt||[0,0];
 let s=`<div class="pwrap"><div class="pscene${o.cls?' '+o.cls:''}" style="--px:${tl[0]};--py:${tl[1]}" role="group" aria-label="${esc(o.label||'ฟาร์ม')}"><div class="pback"><img class="pimg" src="img/farm.jpg" alt=""${style} draggable="false">${thumb?'':ambient(f,stage)}</div>`;
 if(o.bare)return s+'</div></div>';
 s+='<div class="pfront">';
 const play=!!o.play,pick=play&&S.pickPlot&&!P[S.pickPlot]?S.pickPlot:null,B=play?'button':'div';
 const cw=PH.plots.w/4,ch=PH.plots.h/3;
 for(let i=0;i<12;i++){
  const x=PH.plots.x+(i%4)*cw,y=PH.plots.y+Math.floor(i/4)*ch,pos=`left:${x.toFixed(2)}%;top:${y.toFixed(2)}%;width:${(cw-.7).toFixed(2)}%;height:${(ch-1.1).toFixed(2)}%`;
  const p=P['p'+i];
  if(i>=n){s+=stage<2?`<div class="ptile ghost" style="${pos}"></div>`:`<div class="ptile lock" style="${pos}" title="ปลดล็อกเมื่อคะแนนเพิ่ม">🔒</div>`;continue}
  if(!p){s+=`<${B} class="ptile empty${stage<2?' soil':''}${pick==='p'+i?' sel':''}" style="${pos}" ${play?`data-act="pick" data-p="p${i}" aria-label="ปลูกแปลง ${i+1}"`:''}><span class="pe">＋</span></${B}>`;continue}
  const I=plotInfo(p),C=CROPS[p.k];
  s+=`<${B} class="ptile ${I.ready?'ready':'grow'}${stage<2?' soil':''}" style="${pos}" ${play&&I.ready?`data-act="harvest" data-p="p${i}" aria-label="เก็บเกี่ยว${C.name}"`:play?'disabled':''} title="${C.name}${I.ready?' พร้อมเก็บ':' อีก '+leftTxt(I.left)}"><span class="pe">${I.ready?C.em:'🌱'}</span><i class="pb"><u style="width:${(I.pct*100).toFixed(0)}%"></u></i>${I.ready?'<span class="spark">✨</span>':''}</${B}>`;
 }
 for(const k of Object.keys(ANIMALS)){
  const A_=ANIMALS[k],q=PH.pen[k],list=animalsOf(f,k),ready=list.filter(id=>animInfo(f.animals[id]).ready);
  const pos=`left:${q.x}%;top:${q.y}%`;
  if(stage<A_.unlock){s+=`<div class="pen lock" style="${pos}" title="${A_.pen} ปลดล็อกที่ขั้น ${A_.unlock}"><span>🔒</span><b>ขั้น ${A_.unlock}</b></div>`;continue}
  const act=play?(ready.length?`data-act="collect-kind" data-k="${k}"`:`data-act="tab" data-k="shop"`):'';
  s+=`<${B} class="pen${ready.length?' ready':''}" style="${pos}" ${act} title="${A_.pen}: ${list.length}/${A_.max}${ready.length?' · กดเก็บผลผลิต':play?' · กดไปซื้อเพิ่ม':''}"><span>${A_.em}</span><b class="num">${list.length}/${A_.max}</b>${ready.length?`<em>${PRODUCTS[A_.prod].em}×${ready.length}</em>`:''}</${B}>`;
 }
 const deco=(f.inv||[]).filter(id=>DECOR[id]);
 if(deco.length)s+=`<div class="pdeco" title="ของตกแต่ง">${deco.map(id=>`<span title="${esc(DECOR[id].name)}">${DECOR[id].em}</span>`).join('')}</div>`;
 s+=`<div class="pstage">ขั้น ${stage}/10 · ${esc(STAGES[stage])}</div>`;
 if(pick){const i=+pick.slice(1);s+=`<div class="seedbar"><b>แปลง ${i+1}</b>${Object.keys(CROPS).map(k=>`<button class="seed" data-act="plant" data-p="${pick}" data-k="${k}"><span>${CROPS[k].em}</span><small>${CROPS[k].name} · ${CROPS[k].grow}ชม.</small></button>`).join('')}<button class="btn sm ghost" data-act="pick" data-p="">ยกเลิก</button></div>`}
 return s+'</div></div></div>';
}

/* ---------- views ---------- */
const coinChip=n=>`<span class="chip gold num"><i class="coin"></i>${fmt(n)} เหรียญ</span>`;
const ICON={home:'🏠',farm:'🌾',sell:'💰',shop:'🛒',visit:'🤝',quests:'🎯',sales:'💰',approve:'📝',farms:'🧑‍🌾',settings:'⚙️',rooms:'🏫',import:'📥',cards:'🪪',teachers:'👩‍🏫',clear:'🧹'};

function loginView(){
 if(S.boot==='noconfig')return `<div class="panel"><h1>ยังไม่ได้ตั้งค่า Firebase</h1><p>เปิดไฟล์ <code>js/config.js</code> แล้ววางค่า firebaseConfig ของโปรเจกต์ ตามคู่มือใน README</p></div>`;
 if(S.boot==='loading')return `<div class="splash"><div class="logo big">🌾</div><h1>ฟาร์มพิชิตคะแนน</h1><p class="muted">กำลังโหลดข้อมูล…</p></div>`;
 if(S.boot==='pending')return `<div class="splash"><div class="panel" style="display:flex;flex-direction:column;gap:10px;max-width:460px"><h2>${esc(S.bootMsg||'บัญชีนี้ยังไม่มีสิทธิ์ใช้งาน')}</h2><div class="row"><button class="btn" data-act="reload">ลองใหม่</button><button class="btn ghost" data-act="logout">ออกจากระบบ</button></div></div></div>`;
 const demo=farmScene({inv:['d_flowers','d_scarecrow','d_mailbox','d_well','d_flag','d_hay','d_windmill','d_hive'],plots:{p0:{k:'carrot',t:{seconds:1}},p1:{k:'tomato',t:{seconds:1}},p2:{k:'cabbage',t:{seconds:1}},p3:{k:'pumpkin',t:{seconds:1}},p5:{k:'carrot',t:{seconds:1}},p6:{k:'tomato',t:{seconds:1}},p8:{k:'cabbage',t:{seconds:1}},p9:{k:'carrot',t:{seconds:1}},p10:{k:'pumpkin',t:{seconds:1}},p11:{k:'tomato',t:{seconds:1}}},animals:{a0:{k:'chicken',t:{seconds:1}},a1:{k:'chicken',t:{seconds:1}},a2:{k:'chicken',t:{seconds:1}},a3:{k:'sheep',t:{seconds:1}},a4:{k:'sheep',t:{seconds:1}},a5:{k:'pig',t:{seconds:1}},a6:{k:'pig',t:{seconds:1}},a7:{k:'horse',t:{seconds:1}},a8:{k:'fish',t:{seconds:1}},a9:{k:'fish',t:{seconds:1}},a10:{k:'fish',t:{seconds:1}}}},10,{label:'ตัวอย่างฟาร์ม',title:'ฟาร์มพิชิตคะแนน'});
 const stu_=S.loginMode==='student';
 return `<div class="login">
  <div class="login-card">
   <span class="brand">🌾 ฟาร์มพิชิตคะแนน</span>
   <h1>ฟาร์มของฉัน<br>ยิ่งเก่ง ยิ่งรวย <i class="coin"></i></h1>
   <p class="muted" style="margin:0">ทุกคะแนนที่สะสมทำให้ฟาร์มของคุณเติบโต ปลูกผัก เลี้ยงสัตว์ แล้วนำไปขายเป็นเหรียญพิเศษ</p>
   ${S.bootMsg?`<div class="banner bad"><b>${esc(S.bootMsg)}</b></div>`:''}
   <div class="seg big" role="tablist"><button class="${stu_?'on':''}" data-act="lmode" data-m="student">🎒 นักเรียน</button><button class="${!stu_?'on':''}" data-act="lmode" data-m="teacher">👩‍🏫 ครู</button></div>
   ${stu_?`<div class="panel soft" style="display:flex;flex-direction:column;gap:10px"><div class="row"><button class="btn primary lg" data-act="scan-open">📷 สแกนบัตร QR</button><label class="btn lg" for="scan-file" style="cursor:pointer">🖼️ อัปโหลดรูปบัตร</label><input type="file" id="scan-file" accept="image/*" hidden data-act-change="scanfile"></div></div>`
   :`<form class="panel soft" style="display:flex;flex-direction:column;gap:10px" data-form="tlogin"><label class="field">รหัสผู้ใช้งาน<input type="text" id="t-user" autocomplete="username" autocapitalize="none" placeholder="เช่น kru.somchai"></label><label class="field">รหัสผ่าน<input type="password" id="t-pass" autocomplete="current-password"></label><div><button class="btn primary lg" type="submit">เข้าสู่ระบบ</button></div><span class="small muted">รหัสผู้ใช้งานและรหัสผ่านขอได้จากผู้ดูแลระบบ</span></form>`}
   <div class="small muted" style="margin-top:4px">ผู้ดูแลระบบ <button class="linkbtn" data-act="login-google">เข้าสู่ระบบด้วย Google</button></div>
  </div>
  <div class="login-art">${photoScene({},10,{bare:true,label:'ภาพฟาร์มในฝัน'})}</div>
 </div>`;
}
function subjSelect(st){const list=st?enrolled(st):S.subjects;if(!list.length)return '';
 return `<label class="row small" style="gap:6px">วิชา<select id="subj-switch" data-act-change="subj">${list.map(x=>`<option value="${x.id}" ${x.id===S.subId?'selected':''}>${esc(x.settings.subject)} ${esc(x.settings.code)}</option>`).join('')}</select></label>`}
function topBar(){
 const u=S.user;const st=u.role==='student'?stu(u.id):null;
 const f=st?farmOf(st.id):null;
 return `<header class="top"><span class="muted small">${u.role==='admin'?'จัดการข้อมูลกลาง · ':(S.subId==='__none'?'':esc(S.settings.subject)+' '+esc(S.settings.code)+' · ')}${esc(S.settings.term)}</span><span class="grow"></span>
  ${u.role==='admin'?'<span class="chip gold">ผู้ดูแลระบบ</span>':subjSelect(st)+(st?`${coinChip(f.coins)}<span class="chip">${esc(st.name)} · ${st.room}</span>`:`<span class="chip">${esc(S.me?.name||'ครูผู้สอน')}</span>`)}
  ${S.me&&S.me.isAdmin?`<button class="btn sm" data-act="role-swap">${u.role==='admin'?'ไปหน้าครู':'ไปหน้าผู้ดูแล'}</button>`:''}
  <button class="btn sm ghost" data-act="logout">ออกจากระบบ</button></header>`;
}
function shell(list,body){
 const nav=list.map(([k,l,b])=>`<button class="nav${S.tab===k?' on':''}" data-act="tab" data-k="${k}" aria-current="${S.tab===k}"><span class="ic">${ICON[k]||'•'}</span><span class="lb">${l}</span>${b?`<span class="badge num">${b}</span>`:''}</button>`).join('');
 return `<div class="layout"><nav class="side" aria-label="เมนูหลัก"><div class="logo"><span>🌾</span><b>ฟาร์ม<br>พิชิตคะแนน</b></div>${nav}</nav><div class="main">${topBar()}<div class="content">${body}</div></div></div>`;
}

/* หน้าแรก: สถิติการขาย + อันดับเหรียญพิเศษ (ทุกคนเห็น) */
function homeView(){
 if(S.subId==='__none')return `<div class="panel"><h2>ยังไม่มีรายวิชา</h2><p class="muted">เมื่อมีรายวิชา สถิติการขายและอันดับจะแสดงที่นี่</p></div>`;
 const me=S.user.role==='student'?S.user.id:null;
 const arr=Object.entries(S.farms).map(([sid,f])=>({sid,f})).filter(x=>x.f.name);
 arr.sort((a,b)=>(b.f[S.lbSort]||0)-(a.f[S.lbSort]||0)||(a.f.no||0)-(b.f.no||0));
 const top=arr[0]?(arr[0].f[S.lbSort]||0):0,st=S.stats||{sold:{},total:0,count:0,recent:[]};
 const wk=isWeekend();
 const medal=['🥇','🥈','🥉'];
 const pod=arr.slice(0,3).map((x,i)=>`<div class="pod p${i+1}"><span class="medal">${medal[i]}</span><b>${esc(x.f.name)}</b><span class="small muted">${esc(x.f.room||'')}</span><span class="chip gold num"><i class="coin"></i>${fmt(x.f[S.lbSort])}</span></div>`).join('')||'<p class="muted">ยังไม่มีข้อมูล</p>';
 const rows=arr.slice(0,15).map((x,i)=>{const v=x.f[S.lbSort]||0;return `<div class="lbrow${x.sid===me?' me':''}"><span class="rk num">${i+1}</span><span class="nm">${esc(x.f.name)}${x.sid===me?' <span class="chip good">ฉัน</span>':''}<small class="muted"> ${esc(x.f.room||'')}</small></span><span class="lbbar"><i style="width:${top?Math.max(3,v/top*100):0}%"></i></span><b class="num">${fmt(v)}</b></div>`}).join('');
 const myIdx=me?arr.findIndex(x=>x.sid===me):-1;
 const prods=Object.keys(st.sold||{}).filter(k=>PRODUCTS[k]).sort((a,b)=>(st.sold[b].n||0)-(st.sold[a].n||0));
 const mx=prods.length?st.sold[prods[0]].n:0;
 const pbars=prods.map(k=>`<div class="lbrow"><span class="em">${PRODUCTS[k].em}</span><span class="nm">${PRODUCTS[k].name}</span><span class="lbbar alt"><i style="width:${mx?Math.max(3,st.sold[k].n/mx*100):0}%"></i></span><b class="num">${fmt(st.sold[k].n)}</b></div>`).join('')||'<p class="muted small">ยังไม่มีการขายสินค้า</p>';
 const recent=(st.recent||[]).slice().reverse().map(r=>`<div class="item small"><span class="grow"><b>${esc(r.name)}</b> ขาย ${esc(r.txt)}</span><span class="chip gold num"><i class="coin"></i>+${fmt(r.total)}</span></div>`).join('')||'<p class="muted small">ยังไม่มีรายการขาย</p>';
 return `<div class="hero-banner"><div><h1>ตลาดฟาร์ม · ${esc(S.settings.subject)}</h1><p style="margin:4px 0 0">${wk?'🎉 <b>วันนี้เปิดเยี่ยมชมฟาร์มเพื่อนแล้ว!</b> ไปช่วยรดน้ำผัก ให้อาหารสัตว์ รับเหรียญเพิ่ม':'🏡 เปิดเยี่ยมชมฟาร์มเพื่อนทุกวันเสาร์-อาทิตย์ · ปลูกผักเลี้ยงสัตว์แล้วนำมาขายให้ครู'}</p></div><div class="tiles"><div class="tile"><b class="num">${fmt(st.count)}</b><span>รายการขาย</span></div><div class="tile"><b class="num">${fmt(st.total)}</b><span>เหรียญที่ครูจ่ายแล้ว</span></div><div class="tile"><b class="num">${arr.length}</b><span>ฟาร์มในวิชา</span></div></div></div>
 <div class="panel"><div class="section-title"><h2>🏆 อันดับเหรียญพิเศษ</h2><div class="seg" role="group"><button class="${S.lbSort==='earned'?'on':''}" data-act="lbsort" data-v="earned">เหรียญรวมทั้งหมด</button><button class="${S.lbSort==='sold'?'on':''}" data-act="lbsort" data-v="sold">ยอดขายให้ครู</button></div></div>
  <p class="small muted" style="margin:0 0 10px">ท้ายเทอมผู้ที่ได้เหรียญสะสมมากที่สุดจะได้รับรางวัลจากครู (นับเหรียญที่หามาได้ทั้งหมด แม้นำไปซื้อของแล้ว)</p>
  <div class="podium">${pod}</div>${me&&myIdx>=3?`<p class="small" style="text-align:center;margin:8px 0 0">อันดับของคุณตอนนี้: <b>ที่ ${myIdx+1}</b> จาก ${arr.length} ฟาร์ม</p>`:''}
  <div class="lb">${rows}</div>${arr.length>15?`<p class="small muted" style="margin:8px 0 0">แสดง 15 อันดับแรกจาก ${arr.length}</p>`:''}</div>
 <div class="grid2"><div class="panel"><h2 style="margin-bottom:10px">📊 สินค้าขายดี</h2><div class="lb">${pbars}</div></div><div class="panel"><h2 style="margin-bottom:10px">🧾 ขายล่าสุด</h2><div class="list">${recent}</div></div></div>`;
}

/* ---------- นักเรียน ---------- */
function studentApp(){
 const st=stu(S.user.id);
 if(!enrolled(st).length)return shell([['home','หน้าแรก']],`<div class="panel"><h2>ยังไม่มีรายวิชา</h2><p class="muted">ห้อง ${st.room} ยังไม่มีครูเพิ่มเข้ารายวิชาใด</p></div>`);
 if(!S.rooms.includes(st.room))useSubject(enrolled(st)[0].id);
 const f=farmOf(st.id);
 const ready=Object.values(f.plots).filter(p=>plotInfo(p).ready).length+Object.values(f.animals).filter(a=>animInfo(a).ready).length;
 const pend=S.sales.filter(s=>s.status==='pending').length;
 const T=[['home','หน้าแรก'],['farm','ฟาร์มของฉัน',ready],['sell','ขายให้ครู',pend],['shop','ร้านค้า'],['visit','เยี่ยมฟาร์มเพื่อน'],['quests','ภารกิจ']];
 if(!T.some(t=>t[0]===S.tab))S.tab='home';
 const body={home:homeView,farm:sFarm,sell:sSell,shop:sShop,visit:sVisit,quests:sQuests}[S.tab](st);
 return shell(T,body);
}
function plotCard(f,i){const p=f.plots['p'+i];
 if(!p)return `<div class="plot empty"><b>แปลง ${i+1}</b><span class="small muted">ว่าง · เลือกพืชที่จะปลูก</span><div class="seeds">${Object.keys(CROPS).map(k=>`<button class="seed" data-act="plant" data-p="p${i}" data-k="${k}" title="${CROPS[k].name} ${CROPS[k].grow} ชม."><span>${CROPS[k].em}</span><small>${CROPS[k].grow}ชม.</small></button>`).join('')}</div></div>`;
 const I=plotInfo(p),C=CROPS[p.k];
 return `<div class="plot ${I.ready?'ready':''}"><b>${C.em} ${C.name}</b><div class="bar"><i style="width:${(I.pct*100).toFixed(0)}%"></i></div>${I.ready?`<button class="btn sm primary" data-act="harvest" data-p="p${i}">เก็บเกี่ยว</button>`:`<span class="small muted">อีก ${leftTxt(I.left)}</span>`}</div>`;
}
function sFarm(st){
 const f=farmOf(st.id),I=stageInfo(st),stage=f.stage;
 const n=plotCount(stage),plots=[...Array(n)].map((_,i)=>plotCard(f,i)).join('');
 const rp=Object.keys(f.plots).filter(k=>plotInfo(f.plots[k]).ready).length,ra=Object.keys(f.animals).filter(k=>animInfo(f.animals[k]).ready).length;
 const empty=[...Array(n)].filter((_,i)=>!f.plots['p'+i]).length;
 const anim=Object.keys(ANIMALS).map(k=>{const A=ANIMALS[k];const list=animalsOf(f,k);
  if(stage<A.unlock)return `<div class="animrow lock"><span class="em">${A.em}</span><b>${A.name}</b><span class="small muted">ปลดล็อกเมื่อฟาร์มถึงขั้น ${A.unlock} (${A.pen})</span></div>`;
  return `<div class="animrow"><span class="em">${A.em}</span><div class="grow"><b>${A.name}</b> <span class="small muted">${list.length}/${A.max} ตัว · ผลิต${PRODUCTS[A.prod].em}${PRODUCTS[A.prod].name} ทุก ${A.every} ชม.</span>${list.length?`<div class="chips">${list.map(id=>{const a=animInfo(f.animals[id]);return a.ready?`<button class="chip good btn-chip" data-act="collect" data-a="${id}">เก็บ${PRODUCTS[A.prod].em}</button>`:`<span class="chip">${leftTxt(a.left)}</span>`}).join('')}</div>`:'<div class="small muted">ยังไม่มี ไปซื้อได้ที่ร้านค้า</div>'}</div></div>`}).join('');
 const stock=Object.keys(PRODUCTS).filter(k=>stockOf(f,k)>0).map(k=>`<span class="chip num">${PRODUCTS[k].em} ${PRODUCTS[k].name} ×${stockOf(f,k)}</span>`).join('')||'<span class="muted small">โกดังยังว่าง ปลูกผักหรือเก็บผลผลิตจากสัตว์ก่อน</span>';
 const steps=STAGES.map((nm,i)=>`<li class="${i<stage?'done':i===stage?'now':'todo'}"><span class="dot">${i}</span><span>${nm}</span><span class="small muted num">${Math.ceil(i*I.max/10)}</span></li>`).join('');
 const catRows=cats().map((c,i)=>c.visible&&c.castle?`<span>${esc(c.name)}</span><b class="num">${catScore(st,i)}/${c.max}</b>`:'').join('');
 const helped=S.helps.filter(h=>h.farm===st.id);
 return `<div class="panel scenepanel"><div class="section-title"><h2>ฟาร์มของ ${esc(st.name)}</h2><span class="chip num">ขั้น ${stage}: ${STAGES[stage]}</span></div>${photoScene(f,stage,{label:`ฟาร์มของ ${st.name}`,play:true})}
  <div><div class="bar" role="progressbar" aria-valuenow="${I.sc}" aria-valuemin="0" aria-valuemax="${I.max}"><i style="width:${(I.pct*100).toFixed(1)}%"></i></div>
  <p style="margin:8px 0 0">${I.stage>=10?'<b>คะแนนเต็มขั้นสูงสุดแล้ว</b> ฟาร์มสมบูรณ์แบบ!':`คะแนน <b class="num">${I.sc}/${I.max}</b> · อีก <b class="num">${I.toNext}</b> คะแนน จะได้ <b>${STAGES[I.stage+1]}</b>`}${I.stage!==stage?' <span class="small muted">(ฟาร์มจะอัปเดตขั้นเมื่อครูบันทึกคะแนน)</span>':''}</p>${helped.length?`<p class="small" style="margin:4px 0 0">💚 วันนี้เพื่อนมาช่วย ${helped.map(h=>h.type==='water'?'รดน้ำผัก':'ให้อาหารสัตว์').join(' และ ')} ให้คุณแล้ว</p>`:''}</div></div>
 <div class="grid2"><div class="panel"><div class="section-title"><h2>🥕 แปลงผัก</h2><span class="small muted">${n}/12 แปลง (ปลดล็อกเพิ่มตามคะแนน)</span></div>
  <div class="row small" style="margin-bottom:10px">${rp?`<button class="btn sm primary" data-act="harvest-all">เก็บเกี่ยวที่พร้อม (${rp})</button>`:''}${empty?`<span class="muted">ปลูกทั้งหมด ${empty} แปลง:</span>${Object.keys(CROPS).map(k=>`<button class="btn sm" data-act="plant-all" data-k="${k}">${CROPS[k].em}</button>`).join('')}`:''}</div>
  <div class="plots">${plots}</div></div>
  <div style="display:flex;flex-direction:column;gap:16px;min-width:0"><div class="panel"><div class="section-title"><h2>🐔 สัตว์เลี้ยง</h2>${ra?`<button class="btn sm primary" data-act="collect-all">เก็บผลผลิต (${ra})</button>`:''}</div><div class="list">${anim}</div></div>
  <div class="panel"><div class="section-title"><h2>📦 โกดังของฉัน</h2><button class="btn sm primary" data-act="tab" data-k="sell">ไปขายให้ครู</button></div><div class="chips">${stock}</div></div></div></div>
 <div class="grid2"><div class="panel"><h3 style="margin-bottom:8px">คะแนนที่สะสม</h3><div class="kv">${catRows}<span class="muted">เหรียญคงเหลือ</span><b class="num">${fmt(f.coins)}</b><span class="muted">เหรียญที่หามาได้รวม</span><b class="num">${fmt(f.earned)}</b></div></div>
 <div class="panel"><h3 style="margin-bottom:8px">ขั้นของฟาร์ม</h3><ol class="steps">${steps}</ol></div></div>`;
}
function sSell(st){
 const f=farmOf(st.id);
 const keys=Object.keys(PRODUCTS).filter(k=>availOf(st.id,k)>0);
 const sel={};keys.forEach(k=>{sel[k]=Math.max(0,Math.min(availOf(st.id,k),+S.sell[k]||0))});
 const total=salesTotal(sel),cnt=Object.values(sel).reduce((a,b)=>a+b,0);
 const rows=keys.map(k=>`<div class="item"><span class="em">${PRODUCTS[k].em}</span><div class="grow"><b>${PRODUCTS[k].name}</b><div class="small muted">มี ${availOf(st.id,k)} ชิ้น · ครูรับซื้อชิ้นละ <b class="num">${priceOf(k)}</b> เหรียญ</div></div><div class="row" style="gap:4px"><button class="btn sm" data-act="sell-d" data-k="${k}" data-d="-1" aria-label="ลด">−</button><input type="number" class="gi num" id="sell-${k}" min="0" max="${availOf(st.id,k)}" value="${sel[k]}" data-sell="${k}" aria-label="จำนวน${PRODUCTS[k].name}"><button class="btn sm" data-act="sell-d" data-k="${k}" data-d="1" aria-label="เพิ่ม">+</button><button class="btn sm ghost" data-act="sell-max" data-k="${k}">ทั้งหมด</button></div></div>`).join('')||'<p class="muted">ยังไม่มีสินค้าในโกดัง ไปปลูกผักหรือเก็บผลผลิตสัตว์ที่หน้า "ฟาร์มของฉัน"</p>';
 const hist=S.sales.slice().sort((a,b)=>(b.atMs||0)-(a.atMs||0)).slice(0,12).map(s=>{const sc={pending:'<span class="chip warn">รอครูรับซื้อ</span>',approved:`<span class="chip good num">ได้ +${fmt(s.paid)} เหรียญ</span>`,rejected:'<span class="chip crit">ครูไม่รับ</span>'}[s.status];return `<div class="item small"><span class="grow">${esc(itemsTxt(s.items))}</span>${sc}</div>`}).join('')||'<p class="muted small">ยังไม่เคยขายให้ครู</p>';
 return `<div class="panel"><div class="section-title"><h2>💰 ขายสินค้าให้ครู</h2>${coinChip(f.coins)}</div><p class="small muted" style="margin:0 0 10px">เลือกสินค้าจากโกดัง กดส่งขาย แล้วนำของไปให้ครูตรวจรับ เมื่อครูกดรับซื้อ เหรียญจะเข้ากระเป๋าทันที</p><div class="list">${rows}</div>
  ${keys.length?`<div class="sellbar"><span>รวม <b class="num">${cnt}</b> ชิ้น = <b class="num">${fmt(total)}</b> เหรียญ</span><button class="btn primary" data-act="sell-send" ${cnt?'':'disabled'}>ส่งรายการขายให้ครู</button></div>`:''}</div>
 <div class="panel"><h2 style="margin-bottom:10px">ประวัติการขาย</h2><div class="list">${hist}</div></div>`;
}
function sShop(st){
 const f=farmOf(st.id),stage=f.stage;
 const acard=k=>{const A=ANIMALS[k],have=animalsOf(f,k).length;let act;
  if(stage<A.unlock)act=`<span class="chip">ปลดล็อกที่ขั้น ${A.unlock}</span>`;
  else if(have>=A.max)act=`<span class="chip good">เต็มคอก ${have}/${A.max}</span>`;
  else if(f.coins<A.price)act=`<button class="btn sm" disabled>เหรียญไม่พอ</button>`;
  else act=`<button class="btn sm primary" data-act="buy-animal" data-k="${k}">ซื้อ</button>`;
  return `<div class="card shopc"><span class="big-em">${A.em}</span><div class="grow"><span class="t">${A.name}</span><span class="small muted">ผลิต${PRODUCTS[A.prod].em}${PRODUCTS[A.prod].name} ทุก ${A.every} ชม. · มี ${have}/${A.max}</span><div class="row" style="gap:6px"><span class="chip gold num"><i class="coin"></i>${A.price}</span>${act}</div></div></div>`};
 const dcard=id=>{const d=DECOR[id];let act;
  if(f.inv.includes(id))act='<span class="chip good">มีแล้ว</span>';
  else if(stage<d.unlock)act=`<span class="chip">ปลดล็อกที่ขั้น ${d.unlock}</span>`;
  else if(f.coins<d.price)act='<button class="btn sm" disabled>เหรียญไม่พอ</button>';
  else act=`<button class="btn sm primary" data-act="buy-decor" data-i="${id}">ซื้อ</button>`;
  return `<div class="card shopc"><span class="big-em">${d.em}</span><div class="grow"><span class="t">${d.name}</span><span class="small muted">แต่งฟาร์มให้สมบูรณ์</span><div class="row" style="gap:6px"><span class="chip gold num"><i class="coin"></i>${d.price}</span>${act}</div></div></div>`};
 return `<div class="panel"><div class="section-title"><h2>🛒 ร้านค้า</h2>${coinChip(f.coins)}</div><p class="small muted" style="margin:0">ใช้เหรียญพิเศษซื้อสัตว์และของตกแต่ง ทำให้ฟาร์มสมบูรณ์แบบ</p></div>
 <h3 class="sec">สัตว์เลี้ยง</h3><div class="grid shop">${Object.keys(ANIMALS).map(acard).join('')}</div>
 <h3 class="sec">ของตกแต่งฟาร์ม</h3><div class="grid shop">${Object.keys(DECOR).map(dcard).join('')}</div>`;
}
function weekendInfo(){
 if(isWeekend())return null;
 const d=thaiNow().getUTCDay();const days=d===0?0:(6-d);const txt=days===1?'พรุ่งนี้':`อีก ${days} วัน`;return txt;
}
const myHelpsToday=()=>S.helps.filter(h=>h.by===S.user.id);
function sVisit(st){
 const wk=isWeekend();
 const used=myHelpsToday().length;
 const mates=Object.entries(S.farms).filter(([sid,f])=>f.room===st.room&&sid!==st.id&&f.name).sort((a,b)=>(a[1].no||0)-(b[1].no||0));
 const head=wk?`<div class="banner ok"><b>🎉 วันนี้เปิดเยี่ยมชมฟาร์มเพื่อน</b><span class="small">ช่วยรดน้ำผัก หรือให้อาหารสัตว์ ได้ครั้งละ +${HELP_COIN} เหรียญ · ฟาร์มหนึ่งรับความช่วยเหลือแต่ละอย่างได้วันละครั้ง</span><span class="grow"></span><span class="chip num">โควต้าวันนี้ ${used}/${HELP_QUOTA}</span></div>`
  :`<div class="banner"><b>🔒 ปิดเยี่ยมชมในวันจันทร์-ศุกร์</b><span class="small">เปิดทุกวันเสาร์-อาทิตย์ (${weekendInfo()}) · ดูฟาร์มเพื่อนได้ แต่ช่วยเหลือรับเหรียญได้เฉพาะวันหยุด</span></div>`;
 const cards=mates.map(([sid,f])=>{const hw=S.helps.some(h=>h.farm===sid&&h.type==='water'),hf=S.helps.some(h=>h.farm===sid&&h.type==='feed');
  return `<button class="card visitc" data-act="visit" data-id="${sid}">${photoScene(f,f.stage,{cls:'thumb',bare:true,label:'ฟาร์มของ '+f.name})}<span class="t">${esc(f.name)}</span><span class="small muted">ขั้น ${f.stage||0} · เลขที่ ${f.no||''}</span><span class="chips"><span class="chip ${hw?'':'good'}">💧 ${hw?'มีคนรดแล้ว':'รอรดน้ำ'}</span><span class="chip ${hf?'':'good'}">🌾 ${hf?'มีคนให้อาหารแล้ว':'รอให้อาหาร'}</span></span></button>`}).join('')||'<div class="panel muted">ยังไม่มีฟาร์มของเพื่อนในห้อง</div>';
 return head+`<div class="grid visit">${cards}</div>`;
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
 return `<div class="panel"><div class="section-title"><h2>ภารกิจหลัก</h2><span class="small muted">คะแนนทำให้ฟาร์มเติบโต</span></div><div class="list">${main.map(q=>questRow(st,q)).join('')||'<p class="muted small">ยังไม่มีภารกิจ</p>'}</div></div>
 <div class="panel"><div class="section-title"><h2>ภารกิจพิเศษ</h2><span class="small muted">ได้เหรียญไว้ซื้อของ</span></div><div class="list">${sp.map(q=>questRow(st,q)).join('')||'<p class="muted small">ยังไม่มีภารกิจพิเศษ</p>'}</div></div>`;
}

/* ---------- ครู ---------- */
function teacherApp(){
 if(S.subId==='__none'&&S.tab!=='settings')S.tab='settings';
 const pend=S.claims.filter(c=>c.status==='pending').length,ps=S.sales.filter(s=>s.status==='pending').length;
 const T=[['home','หน้าแรก'],['sales','รับซื้อสินค้า',ps],['approve','คะแนน/อนุมัติ',pend],['farms','ฟาร์มนักเรียน'],['settings','ตั้งค่าวิชา']];
 if(!T.some(t=>t[0]===S.tab))S.tab='home';
 const body=S.subId==='__none'?subjPanel():({home:homeView,sales:tSales,approve:tApprove,farms:tFarms,settings:tSettings}[S.tab]());
 return shell(T,body);
}
function tFarms(){
 if(!S.rooms.length)return `<div class="panel"><h2>ยังไม่ได้เลือกห้องที่สอน</h2><p class="muted">ไปที่ ตั้งค่าวิชา แล้วเลือกห้องที่สอนก่อน</p><button class="btn sm primary" data-act="tab" data-k="settings">ไปที่ตั้งค่าวิชา</button></div>`;
 const R=ACT().filter(s=>s.room===S.room).map(s=>[s,risk(s),stageInfo(s)]);
 const cnt={good:0,warn:0,crit:0};R.forEach(r=>cnt[r[1].k]++);
 if(S.sort==='low')R.sort((a,b)=>a[2].sc-b[2].sc);else R.sort((a,b)=>a[0].no-b[0].no);
 const roomTabs=S.rooms.map(r=>`<button class="btn sm ${r===S.room?'primary':''}" data-act="room" data-r="${r}">${r}</button>`).join('');
 return `<div class="row between"><div class="row">${roomTabs}</div><div class="row small"><span class="chip good">ปลอดภัย ${cnt.good}</span><span class="chip warn">ต้องทำปลายภาค ${cnt.warn}</span><span class="chip crit">เสี่ยง ${cnt.crit}</span>
  <button class="btn sm" data-act="cards-room">บัตร QR ห้อง ${S.room}</button>
  <label class="row" style="gap:6px">เรียง <select id="sort" data-act-change="sort"><option value="no" ${S.sort==='no'?'selected':''}>เลขที่</option><option value="low" ${S.sort==='low'?'selected':''}>คะแนนน้อยสุด</option></select></label></div></div>
 ${R.length?'':'<div class="panel muted">ห้องนี้ยังไม่มีรายชื่อนักเรียน ผู้ดูแลนำเข้าได้จากห้องเรียนกลาง</div>'}<div class="grid visit">${R.map(([s,r,I])=>{const f=farmOf(s.id);return `<button class="card visitc risk-${r.k}" data-act="detail" data-id="${s.id}">${photoScene(f,f.stage,{cls:'thumb',bare:true,label:'ฟาร์มของ '+s.name})}<span class="t">${s.no}. ${esc(s.name)}</span><span class="small muted num">ฟาร์มขั้น ${f.stage} · ${I.sc}/${I.max} คะแนน · <i class="coin"></i> ${fmt(f.coins)}</span><span class="chip ${r.k}">${r.label}</span></button>`}).join('')}</div>
 <p class="small muted" style="margin:0">สถานะคำนวณจากเกณฑ์ผ่าน ${S.settings.pass} คะแนน และคะแนนปลายภาคเต็ม ${hiddenMax()} ที่นักเรียนไม่เห็น</p>`;
}
function saleCalc(s,sim){const f=farmOf(s.sid),stock=sim&&sim[s.sid]?sim[s.sid]:Object.assign({},f.stock);const actual={};let clamp=false;
 Object.keys(s.items||{}).forEach(k=>{if(!PRODUCTS[k])return;const want=s.items[k]|0,n=Math.min(want,stock[k]||0);if(n<want)clamp=true;if(n>0){actual[k]=n;stock[k]=(stock[k]||0)-n}});
 if(sim)sim[s.sid]=stock;return {actual,total:salesTotal(actual),clamp}}
function tSales(){
 const mineRooms=new Set(S.rooms);const pend=S.sales.filter(s=>s.status==='pending').sort((a,b)=>(a.atMs||0)-(b.atMs||0));
 const rows=pend.map(s=>{const c=saleCalc(s);const f=S.farms[s.sid]||{};
  return `<div class="item"><div class="grow"><b>${esc(f.name||s.sid)}</b> <span class="small muted">${esc(f.room||s.room||'')}</span><div>${esc(itemsTxt(s.items))}</div>${c.clamp?`<div class="small warnline">ของในโกดังไม่พอบางรายการ จะรับซื้อเท่าที่มี: ${esc(itemsTxt(c.actual))}</div>`:''}</div><span class="chip gold num"><i class="coin"></i>${fmt(c.total)}</span><button class="btn sm good" data-act="sale-ok" data-id="${s.id}" ${c.total?'':'disabled'}>รับซื้อ</button><button class="btn sm" data-act="sale-no" data-id="${s.id}">ไม่รับ</button></div>`}).join('')||'<p class="muted small">ยังไม่มีรายการรอรับซื้อ</p>';
 const hist=S.sales.filter(s=>s.status!=='pending').sort((a,b)=>(b.atMs||0)-(a.atMs||0)).slice(0,25).map(s=>{const f=S.farms[s.sid]||{};return `<div class="item small"><span class="grow"><b>${esc(f.name||s.sid)}</b> · ${esc(itemsTxt(s.items))}</span>${s.status==='approved'?`<span class="chip good num">จ่าย ${fmt(s.paid)}</span>`:'<span class="chip crit">ไม่รับ</span>'}</div>`}).join('')||'<p class="muted small">ยังไม่มีประวัติ</p>';
 const st=S.stats||{total:0,count:0};
 return `<div class="panel"><div class="section-title"><h2>💰 รับซื้อสินค้าจากนักเรียน</h2><div class="row"><span class="chip">จ่ายแล้ว ${fmt(st.total)} เหรียญ · ${fmt(st.count)} รายการ</span>${pend.length>1?`<button class="btn sm good" data-act="sale-all">รับซื้อทั้งหมด (${pend.length})</button>`:''}</div></div>
  <p class="small muted" style="margin:0 0 10px">นักเรียนนำสินค้ามาขาย ตรวจแล้วกด "รับซื้อ" ระบบหักของออกจากโกดังและโอนเหรียญพิเศษให้ทันที · ปรับราคารับซื้อได้ที่ ตั้งค่าวิชา</p><div class="list">${rows}</div></div>
 <div class="panel"><h2 style="margin-bottom:10px">ประวัติการรับซื้อ</h2><div class="list">${hist}</div></div>`;
}

/* ---------- ตาราง/ตั้งค่า (คงจากเวอร์ชันก่อน) + ผู้ดูแล ---------- */
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
 if(!S.rooms.length)return tFarms();
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
 
 
 return view+body;
}
function subjPanel(){
 const cards=S.subjects.map(x=>{const on=x.id===S.subId;const n=ACT().filter(st=>x.rooms.includes(st.room)).length;const mx=x.settings.cats.reduce((a,c)=>a+(c.castle?+c.max||0:0),0);
  return `<button class="card subj ${on?'on':''}" data-act="subj-pick" data-id="${x.id}" aria-pressed="${on}"><span class="t">${esc(x.settings.subject)}</span><span class="small muted">${esc(x.settings.code||'ยังไม่ใส่รหัส')} · ${x.settings.level}</span><span class="small">${x.rooms.length?x.rooms.join(', '):'ยังไม่เลือกห้อง'}</span><span class="small muted num">นักเรียน ${n} คน · ฟาร์มเต็ม ${mx}</span>${on?'<span class="chip good" style="align-self:flex-start">กำลังแก้ไข</span>':''}</button>`}).join('');
 return `<div class="panel" style="display:flex;flex-direction:column;gap:12px"><div class="section-title"><h2>รายวิชาของฉัน</h2><button class="btn sm primary" data-act="subj-new">สร้างรายวิชาใหม่</button></div>
  <div class="grid">${cards}</div><span class="small muted">แต่ละวิชามีเกณฑ์คะแนน งาน ฟาร์ม และเหรียญแยกกัน นักเรียนห้องเดียวกันเรียนหลายวิชาได้ด้วยบัตรใบเดียว</span></div>`;
}
function qRow(q){
 if(S.editQ===q.id){const C=cats(),sp=q.cat==null;
  return `<div class="item small" style="flex-direction:column;align-items:stretch;gap:8px;background:#fff8e1"><b>แก้ไขงาน</b><div class="row">
  <input type="text" id="eq-name" value="${esc(q.name)}" aria-label="ชื่องาน">
  <select id="eq-cat" aria-label="หมวด">${C.map((c,i)=>`<option value="${i}" ${q.cat===i?'selected':''}>${esc(c.name)}</option>`).join('')}<option value="sp" ${sp?'selected':''}>ภารกิจพิเศษ (เหรียญ)</option></select>
  <input type="number" id="eq-pts" min="1" value="${sp?q.coins:q.points}" aria-label="คะแนนหรือเหรียญ" style="width:90px">
  <select id="eq-input" aria-label="วิธีให้คะแนน"><option value="check" ${q.input!=='score'?'selected':''}>ติ๊กถูก (ได้เต็ม)</option><option value="score" ${q.input==='score'?'selected':''}>กรอกคะแนน</option></select>
  <label class="row small" style="gap:4px"><input type="checkbox" id="eq-claim" ${q.claim?'checked':''}> นักเรียนกดรับได้</label></div>
  <div class="row"><button class="btn sm primary" data-act="q-edit-save" data-q="${q.id}">บันทึก</button><button class="btn sm" data-act="q-edit" data-q="">ยกเลิก</button></div></div>`}
 const val=q.cat==null?`<span class="num">${q.coins} <i class="coin"></i>เหรียญ</span>`:`<span class="num">${q.points} คะแนน</span><span class="muted">${q.input==='check'?'ติ๊กถูก':'กรอกคะแนน'} · ${q.claim?'นักเรียนกดรับได้':'ครูให้คะแนน'}</span>`;
 return `<div class="item small"><span class="grow">${esc(q.name)}</span><button class="btn sm ghost" data-act="q-edit" data-q="${q.id}">แก้ไข</button><button class="btn sm ghost" data-act="q-copy" data-q="${q.id}">คัดลอก</button><button class="btn sm ghost" data-act="q-del" data-q="${q.id}">ลบ</button>${val}</div>`}
function tSettings(){
 const C=cats();const total=C.reduce((a,c)=>a+(Number(c.max)||0),0);
 const rows=C.map((c,i)=>{const used=S.quests.some(q=>q.cat===i);return `<tr><td><input type="text" id="cn${i}" value="${esc(c.name)}" data-cat="${i}|name"></td><td><input type="number" id="cm${i}" min="0" value="${c.max}" data-cat="${i}|max"></td>
  <td><input type="checkbox" id="cv${i}" ${c.visible?'checked':''} data-cat="${i}|visible" aria-label="นักเรียนเห็น"></td><td><input type="checkbox" id="cc${i}" ${c.castle?'checked':''} data-cat="${i}|castle" aria-label="นับเข้าฟาร์ม"></td>
  <td><button class="btn sm" data-act="cat-del" data-i="${i}" ${used?'disabled title="มีงานในหมวดนี้"':''}>ลบ</button></td></tr>`}).join('');
 const qs=C.map((c,i)=>{const list=S.quests.filter(q=>q.cat===i);const sum=list.reduce((a,q)=>a+q.points,0);
  const msg=!c.castle&&!list.length?`<span class="small muted">ใช้เป็นเกณฑ์เท่านั้น ครูไม่ได้กรอกผ่านระบบ</span>`:sum===Number(c.max)?`<span class="okline">รวม ${sum}/${c.max} ครบแล้ว</span>`:`<span class="warnline">รวม ${sum}/${c.max} ${sum<c.max?'ยังขาด '+(c.max-sum):'เกิน '+(sum-c.max)}</span>`;
  return `<div style="margin-top:10px"><div class="section-title"><b>${esc(c.name)}</b>${msg}</div>${list.map(qRow).join('')}</div>`}).join('');
 const sp=S.quests.filter(q=>q.cat==null).map(qRow).join('');
 return subjPanel()+`<div class="panel" style="display:flex;flex-direction:column;gap:12px">
  <div class="section-title"><h2>ข้อมูลวิชา: ${esc(S.settings.subject)}</h2>${S.subjects.length>1?(S.confirmDel?`<span class="row small"><span class="warnline">ลบวิชานี้และคะแนนทั้งหมด?</span><button class="btn sm" data-act="subj-del-yes" style="color:var(--crit)">ยืนยันลบ</button><button class="btn sm" data-act="subj-del-no">ยกเลิก</button></span>`:`<button class="btn sm ghost" data-act="subj-del">ลบรายวิชานี้</button>`):''}</div><div class="row">
  <label class="field">ชื่อวิชา<input type="text" id="subj" value="${esc(S.settings.subject)}" data-set="subject"></label>
  <label class="field">รหัสวิชา<input type="text" id="scode" value="${esc(S.settings.code)}" data-set="code" placeholder="เช่น ว31101"></label>
  <label class="field">ระดับชั้น<select id="slevel" data-set="level">${LEVELS.map(l=>`<option ${l===S.settings.level?'selected':''}>${l}</option>`).join('')}</select></label></div>
  <div class="field">ห้องที่สอน<div class="row" style="gap:6px">${[...Array(8)].map((_,i)=>{const r=`${S.settings.level}/${i+1}`;const n=ACT().filter(x=>x.room===r).length;return `<label class="pick"><input type="checkbox" id="room-${i+1}" data-room="${r}" ${S.rooms.includes(r)?'checked':''}><span>${r}<small class="muted"> ${n?n+' คน':'ไม่มีรายชื่อ'}</small></span></label>`}).join('')}</div>
  ${S.rooms.length?'':'<span class="warnline">ยังไม่ได้เลือกห้องที่สอน</span>'}</div>
  <div class="row"><label class="field">เกณฑ์ผ่าน<input type="number" id="pass" value="${S.settings.pass}" data-set="pass"></label></div></div>
 <div class="panel"><div class="section-title"><h2>ราคารับซื้อสินค้า (เหรียญ/ชิ้น)</h2><button class="btn sm ghost" data-act="price-reset">คืนค่าเริ่มต้น</button></div><p class="small muted" style="margin:0 0 8px">ปรับราคาได้ตามต้องการ เช่น ลดราคาเมื่อมีสินค้าล้นตลาด หรือเพิ่มราคาเพื่อกระตุ้นการปลูก</p><div class="pricegrid">${Object.keys(PRODUCTS).map(k=>`<label class="field">${PRODUCTS[k].em} ${PRODUCTS[k].name}<input type="number" min="0" id="pr-${k}" data-price="${k}" value="${priceOf(k)}"></label>`).join('')}</div></div>
 <div class="panel"><div class="section-title"><h2>หมวดคะแนน</h2><button class="btn sm" data-act="cat-add">เพิ่มหมวด</button></div>
  <div class="tablewrap"><table><thead><tr><th>หมวด</th><th>คะแนนเต็ม</th><th>นักเรียนเห็น</th><th>นับเข้าฟาร์ม</th><th></th></tr></thead><tbody>${rows}
  <tr><td><b>รวม</b></td><td class="num"><b>${total}</b></td><td colspan="3" class="small">ฟาร์มสมบูรณ์เมื่อได้ <b class="num">${castleMax()}</b> คะแนน · ขึ้นขั้นทุก <span class="num">${(castleMax()/10).toFixed(1).replace('.0','')}</span> คะแนน</td></tr></tbody></table></div>
  ${total!==100?`<p class="warnline" style="margin:8px 0 0">คะแนนรวมทุกหมวดเป็น ${total} ไม่เท่ากับ 100</p>`:''}</div>
 <div class="panel"><div class="section-title"><h2>รายการงาน</h2></div>${qs}
  <div style="margin-top:14px"><b>ภารกิจพิเศษ (เหรียญ)</b>${sp}</div>
  <div class="row" style="margin-top:14px;padding-top:12px;border-top:1px solid var(--line)">
   <input type="text" id="nq-name" placeholder="ชื่องานใหม่" aria-label="ชื่องานใหม่">
   <select id="nq-cat" aria-label="หมวด">${C.map((c,i)=>`<option value="${i}">${esc(c.name)}</option>`).join('')}<option value="sp">ภารกิจพิเศษ (เหรียญ)</option></select>
   <input type="number" id="nq-pts" value="5" min="1" aria-label="คะแนนหรือเหรียญ">
   <select id="nq-input" aria-label="วิธีให้คะแนน"><option value="check">ติ๊กถูก (ได้เต็ม)</option><option value="score">กรอกคะแนน</option></select>
   <label class="row small" style="gap:4px"><input type="checkbox" id="nq-claim"> นักเรียนกดรับได้</label>
   <button class="btn sm primary" data-act="q-add">เพิ่มงาน</button></div></div>`;
}
/* ---------- admin (school data: rooms, roster import, QR cards, teacher approval) ---------- */
const allRooms=()=>[...new Set(S.students.map(s=>s.room))].sort((a,b)=>a.localeCompare(b,'th',{numeric:true}));
const fullName=st=>`${st.prefix||''}${st.name}${st.last?' '+st.last:''}`;
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


/* ---------- ล้างข้อมูลภาคเรียน (ผู้ดูแลระบบ) ---------- */
const CLR_COLS={history:['helps','visits','claims'],reset:['progress','farms','stats','claims','sales','helps','visits'],delete:['quests','progress','farms','stats','claims','sales','helps','visits']};
const CLR_NAME={quests:'ภารกิจ',progress:'คะแนน',farms:'ฟาร์ม',stats:'สถิติ',claims:'คำขอ',sales:'รายการขาย',helps:'การช่วยเพื่อน',visits:'การเยี่ยม'};
const CLR_MODE={history:['🧹 ล้างเฉพาะประวัติ','ลบประวัติเยี่ยมฟาร์ม/ช่วยเพื่อน/คำขอ เก็บฟาร์ม คะแนน และการขายไว้ (ประหยัดพื้นที่แบบเบา)'],reset:['♻️ เริ่มภาคเรียนใหม่ในวิชาเดิม','ลบคะแนน ฟาร์ม สถิติ การขาย และประวัติทั้งหมด แต่เก็บวิชา ภารกิจ และการตั้งค่าไว้ ครูใช้ต่อได้ทันที'],delete:['🗑️ ลบวิชานี้ทั้งหมด','ลบทุกอย่างรวมถึงตัววิชาและภารกิจ ใช้เมื่อวิชานี้จบแล้วและไม่ใช้อีก']};
const jsonSafe=(k,v)=>v&&typeof v==='object'&&typeof v.toDate==='function'?v.toDate().toISOString():v;
function clrState(){const A=S.adm;if(!A.clr)A.clr={list:null,sel:{},mode:'reset',busy:false,log:'',ok:false};return A.clr}
async function loadClear(){
 const K=clrState();K.list=null;K.log='';soon();
 try{if(!S.teachers.length)await loadTeachers();
  const snap=await getDocs(C('subjects'));const out=[];
  for(const d of snap.docs){const x=d.data(),s=x.settings||{},cnt={};
   await Promise.all(CLR_COLS.delete.map(async c=>{cnt[c]=(await getDocs(C('subjects',d.id,c))).docs.length}));
   out.push({id:d.id,name:s.subject||'(ไม่มีชื่อ)',code:s.code||'',term:s.term||'ไม่ระบุภาคเรียน',rooms:x.rooms||[],teachers:(x.teacherUids||[]).map(u=>(S.teachers.find(t=>t.uid===u)||{}).name||'ผู้ดูแล/ไม่ทราบ'),cnt,total:Object.values(cnt).reduce((a,b)=>a+b,0)+1})}
  out.sort((a,b)=>String(b.term).localeCompare(String(a.term),'th')||String(a.name).localeCompare(String(b.name),'th'));K.list=out}
 catch(e){K.list=[];fail(e,'โหลดรายการวิชาไม่สำเร็จ')}
 soon();
}
function aClear(){
 const K=clrState();
 if(K.list===null)return `<div class="panel"><h2>🧹 ล้างข้อมูลภาคเรียน</h2><p class="muted">กำลังนับข้อมูลของแต่ละวิชา...</p></div>`;
 const terms=[...new Set(K.list.map(x=>x.term))];
 const chosen=K.list.filter(x=>K.sel[x.id]);
 const docs=chosen.reduce((a,x)=>a+(K.mode==='delete'?x.total:CLR_COLS[K.mode].reduce((b,c)=>b+x.cnt[c],0)),0);
 const rows=K.list.map(x=>`<label class="item" style="cursor:pointer"><input type="checkbox" data-act-change="clr-sel" data-id="${esc(x.id)}" ${K.sel[x.id]?'checked':''} ${K.busy?'disabled':''}>
  <div class="grow"><b>${esc(x.name)}</b> <span class="small muted">${esc(x.code)} · ${esc(x.term)}</span><div class="small muted">ห้อง ${esc(x.rooms.join(', ')||'-')} · ครู ${esc(x.teachers.join(', ')||'-')}</div>
  <div class="chips">${CLR_COLS.delete.filter(c=>x.cnt[c]).map(c=>`<span class="chip num">${CLR_NAME[c]} ${x.cnt[c]}</span>`).join('')||'<span class="chip">ไม่มีข้อมูลเกม</span>'}</div></div><span class="chip num">${x.total} รายการ</span></label>`).join('')||'<p class="muted">ยังไม่มีวิชาในระบบ</p>';
 const modes=Object.keys(CLR_MODE).map(k=>`<button class="btn ${K.mode===k?'primary':''}" data-act="clr-mode" data-m="${k}" ${K.busy?'disabled':''}>${CLR_MODE[k][0]}</button>`).join('');
 return `<div class="panel" style="display:flex;flex-direction:column;gap:12px"><h2>🧹 ล้างข้อมูลภาคเรียน</h2>
  <p class="small muted" style="margin:0">ข้อมูลฟาร์ม การขาย และการเยี่ยมของแต่ละวิชาสะสมเรื่อย ๆ จนกินพื้นที่ฐานข้อมูล เลือกวิชาที่จบภาคเรียนแล้วเพื่อล้างได้ที่นี่ ข้อมูลที่ลบแล้วกู้คืนไม่ได้ จึงมีไฟล์สำรองให้ดาวน์โหลดก่อน รายชื่อนักเรียน บัตร QR และบัญชีครูจะไม่ถูกลบ</p>
  <div class="banner warn"><b>ก่อนล้าง</b><span class="small">ให้ครูและนักเรียนปิดเว็บก่อน (ถ้าเปิดค้างไว้ ข้อมูลบางส่วนอาจถูกสร้างกลับมา)</span></div>
  <div class="row small"><span class="muted">เลือกทั้งภาคเรียน:</span>${terms.map(tm=>`<button class="btn sm" data-act="clr-term" data-t="${esc(tm)}" ${K.busy?'disabled':''}>${esc(tm)}</button>`).join('')}<button class="btn sm ghost" data-act="clr-term" data-t="" ${K.busy?'disabled':''}>ยกเลิกทั้งหมด</button></div>
  <div class="list">${rows}</div></div>
 <div class="panel" style="display:flex;flex-direction:column;gap:12px"><h2>วิธีล้าง</h2><div class="row">${modes}</div><p class="small" style="margin:0">${esc(CLR_MODE[K.mode][1])}</p>
  <div class="row"><button class="btn" data-act="clr-backup" ${chosen.length&&!K.busy?'':'disabled'}>⬇️ ดาวน์โหลดไฟล์สำรอง (${chosen.length} วิชา)</button></div>
  <label class="row small" style="gap:6px"><input type="checkbox" data-act-change="clr-ok" ${K.ok?'checked':''} ${K.busy?'disabled':''}> ฉันสำรองข้อมูลแล้ว และเข้าใจว่าลบแล้วกู้คืนไม่ได้</label>
  <label class="field"><span>พิมพ์คำว่า <b>ล้างข้อมูล</b> เพื่อยืนยัน</span><input type="text" id="clr-confirm" autocomplete="off" placeholder="ล้างข้อมูล" ${K.busy?'disabled':''}></label>
  <div class="row"><button class="btn primary" style="background:var(--crit);border-color:var(--crit)" data-act="clr-run" ${chosen.length&&!K.busy?'':'disabled'}>${K.busy?'กำลังล้าง...':`ล้างข้อมูล ${chosen.length} วิชา (${docs} รายการ)`}</button></div>
  ${K.log?`<pre class="small" style="margin:0;white-space:pre-wrap;background:var(--soft);padding:10px;border-radius:12px">${esc(K.log)}</pre>`:''}</div>`;
}
async function clrBackup(){
 const K=clrState(),ids=K.list.filter(x=>K.sel[x.id]);if(!ids.length)return;
 K.log='กำลังรวบรวมข้อมูลสำรอง...';soon();
 try{const out={exportedAt:new Date().toISOString(),subjects:{}};
  for(const x of ids){const sd=await getDoc(D('subjects',x.id));const o={doc:sd.data()||{}};
   for(const c of CLR_COLS.delete){const sn=await getDocs(C('subjects',x.id,c));o[c]={};sn.docs.forEach(d=>{o[c][d.id]=d.data()})}
   out.subjects[x.id]=o}
  const blob=new Blob([JSON.stringify(out,jsonSafe,1)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`สำรองข้อมูลฟาร์ม-${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000);
  K.log=`ดาวน์โหลดไฟล์สำรอง ${ids.length} วิชาแล้ว`}
 catch(e){K.log='';fail(e,'สำรองข้อมูลไม่สำเร็จ')}
 soon();
}
async function wipeCol(sub,col,K){
 const sn=await getDocs(C('subjects',sub,col));let n=0;
 for(let i=0;i<sn.docs.length;i+=400){const b=writeBatch(db);sn.docs.slice(i,i+400).forEach(d=>b.delete(d.ref));await b.commit();n+=Math.min(400,sn.docs.length-i)}
 return n;
}
async function clrRun(){
 const K=clrState(),ids=K.list.filter(x=>K.sel[x.id]);
 const word=(document.getElementById('clr-confirm')||{}).value||'';
 if(!ids.length)return;
 if(!K.ok){toast('ติ๊กยืนยันว่าสำรองข้อมูลแล้วก่อน');return}
 if(word.trim()!=='ล้างข้อมูล'){toast('พิมพ์คำว่า ล้างข้อมูล ให้ถูกต้องก่อน');return}
 K.busy=true;K.log='เริ่มล้างข้อมูล...\n';soon();
 try{let total=0;
  for(const x of ids){K.log+=`\n▶ ${x.name} (${x.term})\n`;soon();
   for(const c of CLR_COLS[K.mode]){const n=await wipeCol(x.id,c,K);total+=n;if(n)K.log+=`  ลบ${CLR_NAME[c]} ${n} รายการ\n`;soon()}
   if(K.mode==='delete'){await deleteDoc(D('subjects',x.id));total++;K.log+='  ลบตัววิชาแล้ว\n'}
   else if(K.mode==='reset'){await updateDoc(D('subjects',x.id),{clearedAt:serverTimestamp()}).catch(()=>{})}}
  K.log+=`\n✅ เสร็จแล้ว ลบทั้งหมด ${total} รายการ`;K.sel={};K.ok=false;toast('ล้างข้อมูลเสร็จแล้ว')}
 catch(e){K.log+=`\n❌ หยุดกลางคัน: ${e&&e.message||e}`;fail(e,'ล้างข้อมูลไม่สำเร็จ')}
 K.busy=false;
 const keep=K.log;await loadClear();K.log=keep;soon();
}
function adminApp(){
 if(!['home','rooms','import','cards','teachers','clear'].includes(S.tab))S.tab='rooms';
 const body={home:homeView,rooms:aRooms,import:aImport,cards:aCards,teachers:aTeachers,clear:aClear}[S.tab]();
 return shell([['home','หน้าแรก'],['rooms','ห้องเรียนกลาง'],['import','นำเข้ารายชื่อ'],['cards','บัตร QR'],['teachers','บัญชีครู'],['clear','ล้างข้อมูล']],body);
}
function aTeachers(){const A=S.adm;
 if(!A.newPw)A.newPw=randPwd(8);
 const rows=S.teachers.map(t=>{const sec=S.tsec[t.username],show=A.showPw[t.username];
  return `<div class="item"><div class="grow"><b>${esc(t.name)}</b><div class="small muted">รหัสผู้ใช้งาน <b class="num">${esc(t.username)}</b> · รหัสผ่าน ${sec?(show?`<b class="num">${esc(sec.p)}</b>`:'••••••••'):'<span class="warnline">ไม่พบข้อมูล</span>'}</div></div>
  ${sec?`<button class="btn sm ghost" data-act="t-show" data-u="${esc(t.username)}">${show?'ซ่อน':'แสดงรหัสผ่าน'}</button><button class="btn sm" data-act="t-slip" data-u="${esc(t.username)}">พิมพ์ใบรหัส</button>`:''}
  <button class="btn sm" data-act="t-reset" data-u="${esc(t.username)}">ออกรหัสผ่านใหม่</button><button class="btn sm ghost" data-act="t-del" data-u="${esc(t.username)}" style="color:var(--crit)">ลบ</button></div>`}).join('')||'<p class="muted small">ยังไม่มีบัญชีครู</p>';
 return `<div class="panel" style="display:flex;flex-direction:column;gap:12px"><h2>เพิ่มบัญชีครู</h2>
  <div class="row"><label class="field">ชื่อครู<input type="text" id="nt-name" placeholder="เช่น ครูสมชาย ใจดี"></label><label class="field">รหัสผู้ใช้งาน (a-z 0-9 . _ -)<input type="text" id="nt-user" autocapitalize="none" placeholder="เช่น kru.somchai"></label><label class="field">รหัสผ่าน (ตั้งเอง หรือใช้ที่สุ่มให้)<input type="text" id="nt-pass" value="${esc(A.newPw)}"></label><button class="btn primary" data-act="t-create" style="align-self:flex-end">สร้างบัญชีครู</button></div>
  <p class="small muted" style="margin:0">ครูเข้าระบบที่แท็บ "ครู" หน้าแรกด้วยรหัสผู้ใช้งานและรหัสผ่านนี้ ครูสร้างวิชาและเลือกห้องที่สอนเองได้หลังเข้าระบบ</p></div>
 <div class="panel"><div class="section-title"><h2>บัญชีครู</h2><span class="small muted">${S.teachers.length} บัญชี</span></div><div class="list">${rows}</div>
  <p class="small muted" style="margin:10px 0 0">ครูลืมรหัสผ่าน: กด "ออกรหัสผ่านใหม่" ระบบจะสร้างรหัสใหม่และย้ายวิชาของครูไปอยู่กับบัญชีใหม่ให้อัตโนมัติ</p></div>`}
function modalView(){
 const m=S.modal;if(!m)return '';let inner='';
 if(m.type==='progress'){inner=`<h2>${esc(m.title)}</h2><div class="bar"><i style="width:${m.total?Math.round(m.done/m.total*100):0}%"></i></div><p class="muted num" style="margin:0">${m.done} / ${m.total} ${esc(m.unit||'บัญชี')} อย่าปิดหน้านี้จนกว่าจะเสร็จ</p>`}
 if(m.type==='visit'){const me=stu(S.user.id),f=S.farms[m.id];if(!f){S.modal=null;return ''}
  const wk=isWeekend(),used=myHelpsToday().length,hw=S.helps.some(h=>h.farm===m.id&&h.type==='water'),hf=S.helps.some(h=>h.farm===m.id&&h.type==='feed');
  const nPlots=Object.keys(f.plots||{}).length,nAn=Object.keys(f.animals||{}).length;
  const btn=(type,label,done,can,why)=>`<button class="btn lg ${done||!can?'':'primary'}" data-act="help" data-t="${type}" data-id="${m.id}" ${done||!can?'disabled':''}>${label}${done?' · มีคนช่วยแล้ววันนี้':!can?` · ${why}`:` +${HELP_COIN} เหรียญ`}</button>`;
  const self=m.id===me.id;
  inner=`<div class="section-title"><h2>ฟาร์มของ ${esc(f.name)}</h2><button class="btn sm ghost" data-act="close">ปิด</button></div>${photoScene(f,f.stage||0,{label:'ฟาร์มของ '+f.name})}
  ${self?'<p class="muted" style="margin:0">นี่คือฟาร์มของคุณเอง</p>':!wk?'<p class="muted" style="margin:0">🔒 ช่วยเพื่อนรับเหรียญได้เฉพาะวันเสาร์-อาทิตย์ ตอนนี้ชมฟาร์มได้อย่างเดียว</p>':`<div class="row">${btn('water','💧 รดน้ำผัก',hw,nPlots>0&&used<HELP_QUOTA,nPlots?'โควต้าวันนี้ครบแล้ว':'ยังไม่มีผักให้รด')}${btn('feed','🌾 ให้อาหารสัตว์',hf,nAn>0&&used<HELP_QUOTA,nAn?'โควต้าวันนี้ครบแล้ว':'ยังไม่มีสัตว์')}</div><p class="small muted" style="margin:0">โควต้าวันนี้ ${used}/${HELP_QUOTA} ครั้ง · แต่ละฟาร์มรับการรดน้ำและให้อาหารได้อย่างละ 1 ครั้งต่อวัน</p>`}`}
 if(m.type==='cards'){const list=ACT().filter(x=>x.room===m.room).sort((a,b)=>a.no-b.no);
  inner=`<div class="section-title"><h2>บัตร QR ห้อง ${esc(m.room)}</h2><button class="btn sm ghost" data-act="close">ปิด</button></div>
  <p class="small muted" style="margin:0">${list.length} ใบ ขนาดเท่าบัตรประชาชน (85.6×54 มม.) ดาวน์โหลดไฟล์แล้วเปิดในเบราว์เซอร์ กดพิมพ์ แล้วตัดตามเส้นประ การพิมพ์ซ้ำใช้ QR เดิม บัตรเก่ายังใช้ได้</p>
  <div><button class="btn primary" data-act="cards-dl" data-r="${esc(m.room)}">ดาวน์โหลดไฟล์บัตรสำหรับพิมพ์</button></div>
  <div class="cardprev">${list.map(st=>cardFace(st,null)).join('')}</div>`}
 if(m.type==='detail'){const s=stu(m.id);const I=stageInfo(s),r=risk(s),f=farmOf(s.id);
  const qrows=S.quests.filter(q=>q.cat!=null).map(q=>`<tr><td>${esc(q.name)}</td><td class="small muted">${esc(cats()[q.cat]?.name||'')}</td><td><input type="number" id="sc-${s.id}-${q.id}" min="0" max="${q.points}" value="${s.scores[q.id]??''}" placeholder="-" data-score="${s.id}|${q.id}"> <span class="small muted num">/${q.points}</span></td></tr>`).join('');
  inner=`<div class="section-title"><h2>${s.no}. ${esc(s.name)} <span class="small muted">${s.room} · ${s.id}</span></h2><button class="btn sm ghost" data-act="close">ปิด</button></div>
  ${photoScene(f,f.stage,{label:'ฟาร์มของ '+s.name})}
  <div style="display:flex;flex-direction:column;gap:8px"><span class="chip ${r.k}" style="align-self:flex-start">${r.label}</span><span class="small">${r.detail}</span>
   <div class="kv">${cats().map((c,i)=>c.castle?`<span>${esc(c.name)}</span><b class="num">${catScore(s,i)}/${c.max}</b>`:`<span class="muted">${esc(c.name)} (ซ่อน)</span><span class="muted num">-/${c.max}</span>`).join('')}<span>ขั้นของฟาร์ม</span><b class="num">${f.stage}/10${I.stage!==f.stage?` (คำนวณได้ ${I.stage})`:''}</b><span>เหรียญคงเหลือ</span><b class="num">${fmt(f.coins)}</b><span>เหรียญที่หามาได้รวม</span><b class="num">${fmt(f.earned)}</b><span>ยอดขายให้ครู</span><b class="num">${fmt(f.sold)}</b></div>
   <div class="row"><button class="btn sm" data-act="coin" data-id="${s.id}">+10 เหรียญ</button><button class="btn sm" data-act="card-one" data-id="${s.id}">พิมพ์บัตร QR</button><button class="btn sm" data-act="reissue" data-id="${s.id}">ออกบัตรใหม่</button></div></div>
  <div class="tablewrap"><table><thead><tr><th>งาน</th><th>หมวด</th><th>คะแนน</th></tr></thead><tbody>${qrows}</tbody></table></div>`}
 return `<div class="scrim" data-act="scrim"><div class="modal wide" role="dialog" aria-modal="true">${inner}</div></div>`;
}

/* ---------- บัตร QR เข้าสู่ระบบ ---------- */
function cardFace(st,payload){return `<div class="qc"><div class="qcq">${payload?realQR(payload):'<div style="width:100%;height:100%;border:2px dashed #b8c2cf;border-radius:6px;display:grid;place-items:center;color:#8a96a6;font-size:12px">QR</div>'}</div><div class="qct"><div class="qcb">🌾 ฟาร์มพิชิตคะแนน</div><div class="qcn">${esc(st.name)}</div><div class="qcm">${esc(st.room)} · เลขที่ ${st.no}</div><div class="qcm">เลขประจำตัว ${esc(st.id)}</div><div class="qcs">ใช้สแกนเข้าระบบ ห้ามให้ผู้อื่นยืม</div></div></div>`}
const CARD_CSS=`.qc{display:flex;gap:3mm;align-items:center;width:85.6mm;height:54mm;box-sizing:border-box;padding:4mm;border:1px dashed #9aa6b5;border-radius:3mm;background:#fff;color:#1b2838;font-family:"Sarabun",Tahoma,sans-serif;break-inside:avoid}
.qcq{width:30mm;height:30mm;flex:none;background:#fff}.qcq svg{width:100%;height:100%;display:block}
.qct{display:flex;flex-direction:column;gap:1mm;min-width:0}.qcb{font-weight:600;color:#2f8a3c;font-size:10pt}.qcn{font-weight:600;font-size:15pt}.qcm{font-size:9.5pt;color:#3a4a5c}.qcs{font-size:7.5pt;color:#7a8696;margin-top:1mm}`;
async function exportCards(list,label){
 let pay;try{await loadQRLib();pay=await cardPayloads(list)}catch(e){fail(e,'โหลดข้อมูลบัตรไม่สำเร็จ');return}
 const miss=list.filter(st=>!pay.has(st.id));list=list.filter(st=>pay.has(st.id));
 if(!list.length){toast('นักเรียนกลุ่มนี้ยังไม่มีบัญชี ให้ผู้ดูแลกด "สร้างบัญชีที่ค้าง" ก่อน');render();return}
 if(miss.length)toast(`ข้าม ${miss.length} คนที่ยังไม่มีบัญชี`);
 const html=`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>บัตร QR ${esc(label)}</title><style>@page{size:A4;margin:10mm}body{margin:0;font-family:"Sarabun",Tahoma,sans-serif}
.bar{padding:8px;display:flex;gap:12px;align-items:center}.bar button{font-size:16px;padding:6px 16px}.sheet{display:grid;grid-template-columns:repeat(2,85.6mm);gap:4mm;justify-content:center}
@media print{.bar{display:none}}${CARD_CSS}</style></head><body><div class="bar"><button onclick="print()">พิมพ์</button><span>${esc(label)} · ${list.length} ใบ · ขนาดบัตร 85.6×54 มม. ตัดตามเส้นประ</span></div>
<div class="sheet">${list.map(st=>cardFace(st,pay.get(st.id))).join('')}</div></body></html>`;
 await saveFile(`บัตรQR_${label.replace(/[\/ ]/g,'-')}.html`,new Blob([html],{type:'text/html'}));render();
}
async function exportSlip(t,sec){
 const url=location.origin+location.pathname;
 const html=`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>ใบรหัสผู้ใช้งาน ${esc(t.username)}</title><style>@page{size:A5;margin:12mm}body{font-family:"Sarabun",Tahoma,sans-serif;color:#1b2838;margin:0;padding:16px}.box{border:2px dashed #2f8a3c;border-radius:12px;padding:18px;max-width:420px}h1{font-size:20px;margin:0 0 6px;color:#2f8a3c}.r{display:flex;gap:10px;margin:8px 0;font-size:16px}.r span{width:110px;color:#667}.r b{font-size:18px}.s{font-size:12px;color:#667;margin-top:12px}button{font-size:15px;padding:6px 14px;margin-bottom:10px}@media print{button{display:none}}</style></head><body><button onclick="print()">พิมพ์</button><div class="box"><h1>🌾 ฟาร์มพิชิตคะแนน</h1><div>ข้อมูลเข้าใช้งานสำหรับครู</div><div class="r"><span>ชื่อ</span><b>${esc(t.name)}</b></div><div class="r"><span>รหัสผู้ใช้งาน</span><b>${esc(t.username)}</b></div><div class="r"><span>รหัสผ่าน</span><b>${esc(sec.p)}</b></div><div class="r"><span>เว็บไซต์</span><b style="font-size:13px">${esc(url)}</b></div><div class="s">เข้าที่แท็บ "ครู" หน้าแรกของเว็บ กรอกรหัสผู้ใช้งานและรหัสผ่านนี้ · เก็บเป็นความลับ</div></div></body></html>`;
 await saveFile(`ใบรหัสครู_${t.username}.html`,new Blob([html],{type:'text/html'}));render();
}

/* ---------- render scheduling (ไม่วาดใหม่ระหว่างที่กำลังพิมพ์) ---------- */
let rq=0,pendingRender=false;
function busyTyping(){const a=document.activeElement;return a&&a.matches&&a.matches('input[type=number],input[type=text],input[type=password],textarea,select')}
function soon(){if(rq)return;rq=requestAnimationFrame(()=>{rq=0;if(busyTyping()){pendingRender=true;return}render()})}
document.addEventListener('focusout',()=>{if(pendingRender)setTimeout(()=>{if(!busyTyping()&&pendingRender){pendingRender=false;render()}},60)});
function fail(e,msg){console.error(e);const code=e&&e.code||'';toast(code==='permission-denied'?'ไม่มีสิทธิ์ทำรายการนี้ (หรือเงื่อนไขไม่ผ่าน)':(msg||'บันทึกไม่สำเร็จ')+(code?` (${code})`:''));soon()}
setInterval(()=>{if(S.user&&!S.modal&&['farm','visit','sell'].includes(S.tab))soon()},30000);

/* ---------- listeners ---------- */
let UN=[];function stopAll(){UN.forEach(u=>{try{u()}catch(e){}});UN=[]}
function withSub(sub,fn){const o=S.subId;S.subId=sub.id;try{return fn()}finally{S.subId=o}}
function watchQuests(sub){UN.push(onSnapshot(C('subjects',sub.id,'quests'),qs=>{sub.quests=qs.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.order||0)-(b.order||0));sub._ld.q=1;afterLoad(sub);soon()},e=>fail(e,'โหลดงานไม่สำเร็จ')))}
function watchFarms(sub,mine){UN.push(onSnapshot(C('subjects',sub.id,'farms'),qs=>{
  const prev=mine&&sub.farms[mine]?sub.farms[mine].stage:null;
  sub.farms={};qs.docs.forEach(d=>{sub.farms[d.id]=normFarm(d.data())});sub._farm=new Set(qs.docs.map(d=>d.id));sub._ld.f=1;
  if(mine&&prev!=null&&sub.farms[mine]&&sub.farms[mine].stage>prev)toast(`🎉 ฟาร์มขึ้นขั้น ${sub.farms[mine].stage}: ${STAGES[sub.farms[mine].stage]}`);
  afterLoad(sub);soon()},e=>fail(e,'โหลดฟาร์มไม่สำเร็จ')))}
function watchStats(sub){UN.push(onSnapshot(D('subjects',sub.id,'stats','main'),d=>{sub.stats=d.exists()?d.data():null;soon()},()=>{}))}
function watchSubjectTeacher(sub){
 watchQuests(sub);watchFarms(sub,null);watchStats(sub);
 UN.push(onSnapshot(query(C('subjects',sub.id,'claims'),where('status','==','pending')),qs=>{sub.claims=qs.docs.map(d=>({id:d.id,...d.data()}));soon()},e=>fail(e)));
 UN.push(onSnapshot(C('subjects',sub.id,'sales'),qs=>{sub.sales=qs.docs.map(d=>({id:d.id,...d.data()}));soon()},e=>fail(e)));
 UN.push(onSnapshot(C('subjects',sub.id,'progress'),qs=>{qs.docs.forEach(d=>{const st=stu(d.id);if(st){st.bySub[sub.id]={scores:d.data().scores||{},special:d.data().special||[]}}});
  sub._prog=new Set(qs.docs.map(d=>d.id));sub._ld.p=1;afterLoad(sub);soon()},e=>fail(e)));
}
function afterLoad(sub){if(S.me&&!S.me.student&&sub._ld.q&&sub._ld.p&&sub._ld.f){ensureProgress(sub);clearTimeout(sub._st);sub._st=setTimeout(()=>syncStages(sub),700)}}
async function ensureProgress(sub){
 if(sub._ensuring)return;const stus=ACT().filter(st=>sub.rooms.includes(st.room));const need=stus.filter(st=>!sub._prog.has(st.id)||!sub._farm.has(st.id));if(!need.length)return;
 sub._ensuring=true;
 try{for(let i=0;i<need.length;i+=100){const b=writeBatch(db);need.slice(i,i+100).forEach(st=>{
   if(!sub._prog.has(st.id)){b.set(D('subjects',sub.id,'progress',st.id),{scores:{},special:[]});sub._prog.add(st.id)}
   if(!sub._farm.has(st.id)){b.set(D('subjects',sub.id,'farms',st.id),Object.assign(blankFarm(),{name:st.name,room:st.room,no:st.no}));sub._farm.add(st.id)}});await b.commit()}}
 catch(e){fail(e,'สร้างข้อมูลนักเรียนในวิชาไม่สำเร็จ')}finally{sub._ensuring=false}
}
/* ขั้นของฟาร์มคำนวณจากคะแนนโดยเครื่องครู แล้วเขียนลงเอกสารฟาร์ม (นักเรียนแก้เองไม่ได้) */
async function syncStages(sub){
 if(sub._syncing)return;const ops=[];
 withSub(sub,()=>{ACT().filter(st=>sub.rooms.includes(st.room)).forEach(st=>{const f=sub.farms[st.id];if(!f)return;const I=stageInfo(st);
  const ch={};if(f.stage!==I.stage)ch.stage=I.stage;if(f.name!==st.name)ch.name=st.name;if(f.room!==st.room)ch.room=st.room;if(f.no!==st.no)ch.no=st.no;
  if(Object.keys(ch).length)ops.push(b=>b.update(D('subjects',sub.id,'farms',st.id),ch))})});
 if(!ops.length)return;sub._syncing=true;
 try{await commitChunks(ops)}catch(e){fail(e)}finally{sub._syncing=false}
}
const stageTimers={};
function syncStageSoon(st){const sub=curSub();if(sub.id==='__none')return;const key=sub.id+st.id;clearTimeout(stageTimers[key]);
 stageTimers[key]=setTimeout(()=>{const I=withSub(sub,()=>stageInfo(st));const f=sub.farms[st.id];if(f&&f.stage!==I.stage)updateDoc(D('subjects',sub.id,'farms',st.id),{stage:I.stage}).catch(e=>fail(e))},700)}

/* ---------- boot ---------- */
async function bootStaff(user){
 const cfgSnap=await getDoc(D('config','app'));const cfg=cfgSnap.exists()?cfgSnap.data():{};
 const isAdmin=(cfg.adminEmails||[]).includes(user.email);let name=user.displayName||user.email;
 if(!isAdmin){
  const u=await getDoc(D('users',user.uid));
  if(!u.exists()||u.data().status!=='approved'){S.boot='login';S.bootMsg='บัญชีนี้ไม่มีสิทธิ์ใช้งาน ติดต่อผู้ดูแลระบบ';await signOut(auth);return}
  name=u.data().name||name;
 }
 S.me={uid:user.uid,email:user.email,name,isAdmin,isTeacher:true};
 if(cfg.term)EMPTY_SUB.settings.term=cfg.term;
 const st=await getDocs(C('students'));st.docs.forEach(d=>upsertStudent(d.id,d.data()));
 const subs=await getDocs(query(C('subjects'),where('teacherUids','array-contains',user.uid)));
 S.subjects=subs.docs.map(d=>subFromDoc(d.id,d.data()));
 S.subjects.forEach(watchSubjectTeacher);
 if(isAdmin)await loadTeachers();
 if(S.subjects[0])useSubject(S.subjects[0].id);
 S.user={role:isAdmin?'admin':'teacher'};S.tab=isAdmin?'rooms':'home';S.boot='ready';
 const lv=allRooms()[0];if(lv){S.adm.level=lv.split('/')[0];S.adm.cardLevel=S.adm.level}
 render();
}
async function loadTeachers(){
 const us=await getDocs(C('users'));S.teachers=us.docs.map(d=>({uid:d.id,...d.data()})).filter(t=>t.username&&t.status==='approved').sort((a,b)=>String(a.name).localeCompare(String(b.name),'th'));
 const sc=await getDocs(C('teacherSecrets'));S.tsec={};sc.docs.forEach(d=>{S.tsec[d.id]=d.data()});
}
async function bootStudent(user){
 const a=await getDoc(D('studentAuth',user.uid));
 if(!a.exists()){S.boot='login';S.bootMsg='บัตรนี้ถูกยกเลิกแล้ว ขอบัตรใบใหม่จากครู';await signOut(auth);return}
 const sid=a.data().sid;const sd=await getDoc(D('students',sid));
 if(!sd.exists()||sd.data().active===false){S.boot='login';S.bootMsg='บัญชีนี้ถูกปิดใช้งาน ติดต่อครูหรือผู้ดูแลระบบ';await signOut(auth);return}
 const me=upsertStudent(sid,sd.data());S.me={uid:user.uid,sid,student:true};
 const subs=await getDocs(query(C('subjects'),where('rooms','array-contains',me.room)));
 S.subjects=subs.docs.map(d=>subFromDoc(d.id,d.data()));
 S.subjects.forEach(sub=>{
  me.bySub[sub.id]=blankProg();watchQuests(sub);watchFarms(sub,sid);watchStats(sub);
  UN.push(onSnapshot(D('subjects',sub.id),d=>{if(!d.exists())return;const x=d.data();sub.settings=Object.assign({},sub.settings,x.settings||{});sub.rooms=x.rooms||[];soon()}));
  UN.push(onSnapshot(D('subjects',sub.id,'progress',sid),d=>{if(!d.exists())return;me.bySub[sub.id]={scores:d.data().scores||{},special:d.data().special||[]};soon()},e=>fail(e,'โหลดคะแนนไม่สำเร็จ')));
  UN.push(onSnapshot(query(C('subjects',sub.id,'claims'),where('sid','==',sid)),qs=>{sub.claims=qs.docs.map(d=>({id:d.id,...d.data()}));soon()}));
  UN.push(onSnapshot(query(C('subjects',sub.id,'sales'),where('sid','==',sid)),qs=>{sub.sales=qs.docs.map(d=>({id:d.id,...d.data()}));soon()}));
  UN.push(onSnapshot(query(C('subjects',sub.id,'helps'),where('dn','==',dayNum())),qs=>{sub.helps=qs.docs.map(d=>({id:d.id,...d.data()}));soon()},()=>{}));
 });
 if(S.subjects[0])useSubject(S.subjects[0].id);
 S.user={role:'student',id:sid};S.tab='home';S.boot='ready';render();
 if(!S.personal)startIdle();
}
if(CONFIGURED)onAuthStateChanged(auth,async user=>{
 stopAll();S.students=[];S.subjects=[];S.subId='__none';S.user=null;S.modal=null;S.me=null;
 if(!user){S.boot='login';render();return}
 S.boot='loading';S.bootMsg='';render();
 try{if((user.email||'').endsWith('@'+CARD_DOMAIN))await bootStudent(user);else await bootStaff(user)}
 catch(e){console.error(e);S.boot='login';S.bootMsg='เข้าสู่ระบบไม่สำเร็จ: '+(e.code||e.message);render();try{await signOut(auth)}catch(x){}}
});
let idleT;function startIdle(){const reset=()=>{clearTimeout(idleT);idleT=setTimeout(()=>{toast('ออกจากระบบอัตโนมัติเพราะไม่มีการใช้งาน');signOut(auth)},10*60*1000)};['pointerdown','keydown'].forEach(ev=>document.addEventListener(ev,reset,{passive:true}));reset()}
async function teacherLogin(){
 const u=(document.getElementById('t-user')?.value||'').trim().toLowerCase(),p=document.getElementById('t-pass')?.value||'';
 if(!u||!p){toast('กรอกรหัสผู้ใช้งานและรหัสผ่านก่อน');render();return}
 try{await setPersistence(auth,browserSessionPersistence);const l=await getDoc(D('teacherLogin',u));if(!l.exists())throw {code:'auth/user-not-found'};
  await signInWithEmailAndPassword(auth,`${u}.v${l.data().ver}@${TEACH_DOMAIN}`,p)}
 catch(e){S.bootMsg=['auth/invalid-credential','auth/user-not-found','auth/wrong-password','auth/invalid-email'].includes(e.code)?'รหัสผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง':'เข้าสู่ระบบไม่สำเร็จ ('+(e.code||e.message)+')';render()}
}
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

/* ---------- บัญชีครู (ผู้ดูแลสร้างให้) ---------- */
async function createTeacherAccount(name,username,pwd,prev){
 const ver=(prev?(S.tsec[username]&&S.tsec[username].ver)||prev.ver||0:0)+1,email=`${username}.v${ver}@${TEACH_DOMAIN}`;
 const a2=secondaryAuth();const cred=await createUserWithEmailAndPassword(a2,email,pwd);const uid=cred.user.uid;await signOut(a2);
 const b=writeBatch(db);b.set(D('users',uid),{email,name,username,status:'approved',ver,at:serverTimestamp()});b.set(D('teacherLogin',username),{ver});b.set(D('teacherSecrets',username),{p:pwd,e:email,ver,name});
 if(prev)b.delete(D('users',prev.uid));await b.commit();
 if(prev){const subs=await getDocs(query(C('subjects'),where('teacherUids','array-contains',prev.uid)));
  for(const d of subs.docs)await updateDoc(d.ref,{teacherUids:[...(d.data().teacherUids||[]).filter(x=>x!==prev.uid),uid]})}
 await loadTeachers();
}

/* ---------- render & actions (ทุกการเปลี่ยนแปลงบันทึกลง Firestore) ---------- */
const app=document.getElementById('app'),mroot=document.getElementById('modal-root');
function render(){
 app.innerHTML=(S.boot==='ready'&&S.user?(S.user.role==='student'?studentApp():S.user.role==='admin'?adminApp():teacherApp()):loginView());
 mroot.innerHTML=modalView()+(S.toast?`<div class="toast" role="status">${esc(S.toast)}</div>`:'');
}
let tt;function toast(t){S.toast=t;clearTimeout(tt);tt=setTimeout(()=>{S.toast=null;soon()},3200)}
const sref=(...p)=>D('subjects',S.subId,...p);
async function commitChunks(ops){for(let i=0;i<ops.length;i+=200){const b=writeBatch(db);ops.slice(i,i+200).forEach(f=>f(b));await b.commit()}}
let busy=false;
async function seq(list,fn,okMsg){if(busy)return;busy=true;let n=0;try{for(const x of list){await fn(x);n++}if(okMsg)toast(okMsg(n))}catch(e){fail(e,'ทำรายการไม่สำเร็จ')}finally{busy=false;soon()}}
const meFarmRef=()=>sref('farms',S.user.id);
/* ครู: ให้คะแนน/ภารกิจพิเศษ แล้วปิดคำขอที่ค้าง */
function opsGrade(st,q,val,ops){
 const pr=sref('progress',st.id),fr=sref('farms',st.id);
 if(q.cat==null){const has=st.special.includes(q.id);
  if(val&&!has){st.special=[...st.special,q.id];ops.push(b=>b.update(pr,{special:arrayUnion(q.id)}));ops.push(b=>b.update(fr,{coins:increment(q.coins),earned:increment(q.coins)}))}
  if(!val&&has){st.special=st.special.filter(x=>x!==q.id);ops.push(b=>b.update(pr,{special:arrayRemove(q.id)}));ops.push(b=>b.update(fr,{coins:increment(-q.coins),earned:increment(-q.coins)}))}}
 else{if(val==null){delete st.scores[q.id];ops.push(b=>b.update(pr,{[`scores.${q.id}`]:deleteField()}))}else{st.scores[q.id]=val;ops.push(b=>b.update(pr,{[`scores.${q.id}`]:val}))}}
 if(val!=null&&val!==false)S.claims.filter(c=>c.sid===st.id&&c.qid===q.id&&c.status==='pending').forEach(c=>{c.status='approved';ops.push(b=>b.update(sref('claims',c.id),{status:'approved',doneAt:serverTimestamp()}))});
 syncStageSoon(st);
}
function grade(st,q,val){const ops=[];opsGrade(st,q,val,ops);commitChunks(ops).catch(e=>fail(e))}
function approveClaim(c,ops){const st=stu(c.sid),q=quest(c.qid);if(!st||!q)return;opsGrade(st,q,q.cat==null?true:q.points,ops)}
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
async function deleteSubjectData(id){for(const sc of ['quests','progress','farms','claims','sales','helps','visits','stats']){const qs=await getDocs(C('subjects',id,sc));const refs=qs.docs.map(d=>d.ref);for(let i=0;i<refs.length;i+=400){const b=writeBatch(db);refs.slice(i,i+400).forEach(r=>b.delete(r));await b.commit()}}await deleteDoc(D('subjects',id))}
/* ครู: รับซื้อสินค้า */
function approveSales(list){
 const sim={},ops=[],patch={total:0,count:0,sold:{}},recent=[];
 list.forEach(s=>{const c=saleCalc(s,sim);if(!c.total){ops.push(b=>b.update(sref('sales',s.id),{status:'rejected',doneAt:serverTimestamp()}));return}
  const f=S.farms[s.sid]||{};const upd={coins:increment(c.total),earned:increment(c.total),sold:increment(c.total)};
  Object.keys(c.actual).forEach(k=>{upd[`stock.${k}`]=increment(-c.actual[k]);patch.sold[k]={n:increment(c.actual[k]),c:increment(c.actual[k]*priceOf(k))}});
  patch.total=(patch.total||0)+c.total;patch.count++;recent.push({name:f.name||s.sid,txt:itemsTxt(c.actual),total:c.total});
  ops.push(b=>b.update(sref('farms',s.sid),upd));ops.push(b=>b.update(sref('sales',s.id),{status:'approved',paid:c.total,items:c.actual,doneAt:serverTimestamp()}))});
 const old=(S.stats&&S.stats.recent)||[];
 const tot=recent.reduce((a,r)=>a+r.total,0);
 if(recent.length)ops.push(b=>b.set(sref('stats','main'),{total:increment(tot),count:increment(recent.length),sold:patch.sold,recent:[...old,...recent].slice(-12)},{merge:true}));
 return commitChunks(ops).then(()=>toast(recent.length?`รับซื้อแล้ว ${recent.length} รายการ จ่ายรวม ${fmt(tot)} เหรียญ`:'ไม่มีของในโกดัง ปฏิเสธรายการแล้ว')).catch(e=>fail(e,'รับซื้อไม่สำเร็จ'));
}
const helpAllowed=(farm,type)=>{const f=S.farms[farm];return isWeekend()&&farm!==S.user.id&&f&&myHelpsToday().length<HELP_QUOTA&&!S.helps.some(h=>h.farm===farm&&h.type===type)&&(type==='water'?Object.keys(f.plots||{}).length>0:Object.keys(f.animals||{}).length>0)};

const A={
 'login-google'(){signInWithPopup(auth,new GoogleAuthProvider()).catch(e=>{if(e.code!=='auth/popup-closed-by-user'){S.bootMsg='เข้าสู่ระบบด้วย Google ไม่สำเร็จ ('+e.code+')';render()}});return false},
 'scan-open'(){openScanner();return false},
 lmode(d){S.loginMode=d.m;S.bootMsg=''},
 reload(){location.reload();return false},
 logout(){closeScanner();signOut(auth);return false},
 'role-swap'(){S.user.role=S.user.role==='admin'?'teacher':'admin';S.tab=S.user.role==='admin'?'rooms':(S.subId==='__none'?'settings':'home')},
 tab(d){S.tab=d.k;if(S.user.role==='admin'&&d.k==='teachers')loadTeachers().then(soon).catch(e=>fail(e));if(S.user.role==='admin'&&d.k==='clear')loadClear()},
 lbsort(d){S.lbSort=d.v},
 /* นักเรียน: ฟาร์ม */
 plant(d){const f=farmOf(S.user.id);if(f.plots[d.p]||!(+d.p.slice(1)<plotCount(f.stage)))return false;
  updateDoc(meFarmRef(),{[`plots.${d.p}`]:{k:d.k,t:serverTimestamp()}}).then(()=>toast(`ปลูก${CROPS[d.k].name}แล้ว`)).catch(e=>fail(e,'ปลูกไม่สำเร็จ'));return false},
 'plant-all'(d){const f=farmOf(S.user.id);const slots=[...Array(plotCount(f.stage))].map((_,i)=>'p'+i).filter(p=>!f.plots[p]);
  seq(slots,p=>updateDoc(meFarmRef(),{[`plots.${p}`]:{k:d.k,t:serverTimestamp()}}),n=>`ปลูก${CROPS[d.k].name} ${n} แปลงแล้ว`);return false},
 harvest(d){const f=farmOf(S.user.id),p=f.plots[d.p];if(!p||!plotInfo(p).ready)return false;
  updateDoc(meFarmRef(),{[`plots.${d.p}`]:deleteField(),[`stock.${p.k}`]:increment(1)}).then(()=>toast(`เก็บเกี่ยว${CROPS[p.k].name}แล้ว ไปที่โกดัง`)).catch(e=>fail(e,'เก็บเกี่ยวไม่สำเร็จ'));return false},
 'harvest-all'(){const f=farmOf(S.user.id);const ks=Object.keys(f.plots).filter(k=>plotInfo(f.plots[k]).ready);
  seq(ks,k=>updateDoc(meFarmRef(),{[`plots.${k}`]:deleteField(),[`stock.${f.plots[k].k}`]:increment(1)}),n=>`เก็บเกี่ยว ${n} แปลงแล้ว`);return false},
 collect(d){const f=farmOf(S.user.id),a=f.animals[d.a];if(!a||!animInfo(a).ready)return false;const pr=ANIMALS[a.k].prod;
  updateDoc(meFarmRef(),{[`animals.${d.a}.t`]:serverTimestamp(),[`stock.${pr}`]:increment(1)}).then(()=>toast(`ได้${PRODUCTS[pr].name}แล้ว`)).catch(e=>fail(e,'เก็บผลผลิตไม่สำเร็จ'));return false},
 'clr-mode'(d){clrState().mode=d.m},
 'clr-term'(d){const K=clrState();K.sel={};if(d.t)K.list.filter(x=>x.term===d.t).forEach(x=>{K.sel[x.id]=true})},
 'clr-backup'(){clrBackup();return false},
 'clr-run'(){clrRun();return false},
 pick(d){S.pickPlot=d.p||null},
 'collect-kind'(d){const f=farmOf(S.user.id);const ks=Object.keys(f.animals).filter(k=>f.animals[k].k===d.k&&animInfo(f.animals[k]).ready);
  seq(ks,k=>updateDoc(meFarmRef(),{[`animals.${k}.t`]:serverTimestamp(),[`stock.${ANIMALS[d.k].prod}`]:increment(1)}),n=>`เก็บผลผลิต ${n} รายการแล้ว`);return false},
 'collect-all'(){const f=farmOf(S.user.id);const ks=Object.keys(f.animals).filter(k=>animInfo(f.animals[k]).ready);
  seq(ks,k=>updateDoc(meFarmRef(),{[`animals.${k}.t`]:serverTimestamp(),[`stock.${ANIMALS[f.animals[k].k].prod}`]:increment(1)}),n=>`เก็บผลผลิต ${n} รายการแล้ว`);return false},
 'buy-animal'(d){const f=farmOf(S.user.id),A_=ANIMALS[d.k],slot=freeSlot(f.animals,'a',16);
  if(!slot||f.coins<A_.price||f.stage<A_.unlock||animalsOf(f,d.k).length>=A_.max){toast('ซื้อไม่ได้ในตอนนี้');return}
  updateDoc(meFarmRef(),{coins:increment(-A_.price),[`animals.${slot}`]:{k:d.k,t:serverTimestamp()}}).then(()=>toast(`ซื้อ${A_.name}แล้ว ไปดูที่ฟาร์มของฉัน`)).catch(e=>fail(e,'ซื้อไม่สำเร็จ'));return false},
 'buy-decor'(d){const f=farmOf(S.user.id),it=DECOR[d.i];if(!it||f.inv.includes(d.i)||f.coins<it.price||f.stage<it.unlock)return;
  updateDoc(meFarmRef(),{coins:increment(-it.price),inv:arrayUnion(d.i)}).then(()=>toast(`ซื้อ${it.name}แล้ว ฟาร์มสวยขึ้น!`)).catch(e=>fail(e,'ซื้อไม่สำเร็จ'));return false},
 /* นักเรียน: ขายให้ครู */
 'sell-d'(d){const mx=availOf(S.user.id,d.k);S.sell[d.k]=Math.max(0,Math.min(mx,(+S.sell[d.k]||0)+(+d.d)))},
 'sell-max'(d){S.sell[d.k]=availOf(S.user.id,d.k)},
 'sell-send'(){const st=stu(S.user.id),items={};Object.keys(PRODUCTS).forEach(k=>{const n=Math.min(availOf(st.id,k),+S.sell[k]||0);if(n>0)items[k]=n});
  if(!Object.keys(items).length){toast('เลือกจำนวนสินค้าก่อน');return}
  S.sell={};addDoc(sref('sales'),{sid:st.id,room:st.room,items,status:'pending',at:serverTimestamp(),atMs:Date.now()}).then(()=>toast('ส่งรายการแล้ว นำของไปให้ครูตรวจรับได้เลย')).catch(e=>fail(e,'ส่งรายการไม่สำเร็จ'))},
 visit(d){S.modal={type:'visit',id:d.id}},
 help(d){const type=d.t,farm=d.id;if(!helpAllowed(farm,type)){toast('ช่วยไม่ได้ในตอนนี้');return false}
  const me=S.user.id,dn=dayNum(),n=myHelpsToday().length+1,hid=`${dn}_${farm}_${type}`,qid=`${dn}_${me}_${n}`;
  const b=writeBatch(db);b.set(sref('helps',hid),{by:me,farm,type,dn,q:qid,at:serverTimestamp()});b.set(sref('visits',qid),{by:me,dn,n,help:hid});b.update(sref('farms',me),{coins:increment(HELP_COIN),earned:increment(HELP_COIN),lastHelp:hid});
  S.helps.push({id:hid,by:me,farm,type,dn});
  b.commit().then(()=>toast(`${type==='water'?'💧 รดน้ำผัก':'🌾 ให้อาหารสัตว์'}ให้เพื่อนแล้ว +${HELP_COIN} เหรียญ`)).catch(e=>{S.helps=S.helps.filter(h=>h.id!==hid);fail(e,'ช่วยเพื่อนไม่สำเร็จ (อาจมีคนช่วยไปก่อนแล้ว)')})},
 claim(d){const st=stu(S.user.id);const c={sid:st.id,qid:d.q,status:'pending',at:serverTimestamp(),atMs:Date.now()};
  S.claims.push(Object.assign({id:'tmp'},c));addDoc(sref('claims'),c).then(()=>toast('ส่งให้ครูตรวจแล้ว')).catch(e=>fail(e))},
 close(){S.modal=null},
 scrim(d,el,e){if(e.target===el&&S.modal&&S.modal.type!=='progress')S.modal=null;else return false},
 /* ครู */
 'sale-ok'(d){const s=S.sales.find(x=>x.id===d.id);if(s)approveSales([s]);return false},
 'sale-all'(){approveSales(S.sales.filter(s=>s.status==='pending'));return false},
 'sale-no'(d){updateDoc(sref('sales',d.id),{status:'rejected',doneAt:serverTimestamp()}).then(()=>toast('ไม่รับรายการนี้ ของยังอยู่ในโกดังนักเรียน')).catch(e=>fail(e));return false},
 'price-reset'(){S.settings.prices={};saveSub();toast('คืนราคาเริ่มต้นแล้ว')},
 room(d){S.room=d.r},
 detail(d){S.modal={type:'detail',id:d.id}},
 apview(d){S.apView=d.v},
 'ap-person'(d){S.apStudent=d.id;S.apView='person'},
 'ap-step'(d){const l=ACT().filter(s=>s.room===S.room).sort((a,b)=>a.no-b.no);const i=l.findIndex(s=>s.id===S.apStudent)+(+d.d);if(l[i])S.apStudent=l[i].id},
 'col-all'(d){const q=quest(d.q),ops=[];ACT().filter(s=>s.room===S.room).forEach(st=>opsGrade(st,q,q.cat==null?true:q.points,ops));commitChunks(ops).then(()=>toast(`ให้ ${q.short||q.name} ครบทั้งห้องแล้ว`)).catch(e=>fail(e))},
 'ap-pend'(){const ops=[];const l=S.claims.filter(c=>c.status==='pending'&&stu(c.sid)&&stu(c.sid).room===S.room&&quest(c.qid)&&(quest(c.qid).cat==null||quest(c.qid).input==='check'));l.forEach(c=>approveClaim(c,ops));commitChunks(ops).then(()=>toast(`อนุมัติ ${l.length} รายการแล้ว`)).catch(e=>fail(e))},
 coin(d){updateDoc(sref('farms',d.id),{coins:increment(10),earned:increment(10)}).then(()=>toast('เพิ่ม 10 เหรียญแล้ว')).catch(e=>fail(e))},
 reissue(d){const st=stu(d.id);toast('กำลังออกบัตรใหม่...');createStudentAccount(st).then(()=>{toast(`ออกบัตรใหม่ให้ ${st.name} แล้ว บัตรเดิมใช้ไม่ได้`);exportCards([st],`${st.room} เลขที่ ${st.no} ${st.name}`)}).catch(e=>fail(e,'ออกบัตรใหม่ไม่สำเร็จ'))},
 'cards-room'(){S.modal={type:'cards',room:S.room}},
 'cards-dl'(d){toast('กำลังเตรียมไฟล์บัตร...');exportCards(ACT().filter(x=>x.room===d.r).sort((a,b)=>a.no-b.no),'ห้อง '+d.r)},
 'card-one'(d){const st=stu(d.id);toast('กำลังเตรียมไฟล์บัตร...');exportCards([st],`${st.room} เลขที่ ${st.no} ${st.name}`)},
 'xl-room'(){toast('กำลังสร้างไฟล์ Excel...');exportXL([S.room])},
 'xl-all'(){toast('กำลังสร้างไฟล์ Excel...');exportXL(S.rooms.slice())},
 'subj-pick'(d){useSubject(d.id);S.confirmDel=false},
 'subj-new'(){const settings=Object.assign({},EMPTY_SUB.settings,{subject:'รายวิชาใหม่',cats:defaultCats(),prices:{}});
  addDoc(C('subjects'),{settings,rooms:[],teacherUids:[S.me.uid],createdAt:serverTimestamp()}).then(r=>{const sub=subFromDoc(r.id,{settings,rooms:[],teacherUids:[S.me.uid]});S.subjects.push(sub);watchSubjectTeacher(sub);useSubject(sub.id);S.tab='settings';S.confirmDel=false;toast('สร้างรายวิชาใหม่แล้ว ตั้งชื่อ รหัส และเลือกห้องที่สอน');soon()}).catch(e=>fail(e))},
 'subj-del'(){S.confirmDel=true},
 'subj-del-no'(){S.confirmDel=false},
 'subj-del-yes'(){const id=S.subId,name=S.settings.subject;S.confirmDel=false;toast('กำลังลบรายวิชา...');
  deleteSubjectData(id).then(()=>{S.subjects=S.subjects.filter(x=>x.id!==id);S.students.forEach(st=>delete st.bySub[id]);useSubject(S.subjects[0]?S.subjects[0].id:'__none');toast(`ลบรายวิชา ${name} แล้ว`);soon()}).catch(e=>fail(e,'ลบไม่สำเร็จ'))},
 'cat-add'(){S.settings.cats.push({name:'หมวดใหม่',max:0,visible:true,castle:true});saveSub()},
 'cat-del'(d){const i=+d.i;S.settings.cats.splice(i,1);const ops=[];S.quests.forEach(q=>{if(q.cat!=null&&q.cat>i){q.cat--;ops.push(b=>b.update(sref('quests',q.id),{cat:q.cat}))}});commitChunks(ops).catch(e=>fail(e));saveSub()},
 'q-add'(){const n=document.getElementById('nq-name').value.trim();if(!n){toast('ใส่ชื่องานก่อน');return}const c=document.getElementById('nq-cat').value,p=Math.max(1,+document.getElementById('nq-pts').value||1),cl=document.getElementById('nq-claim').checked;
  const q=c==='sp'?{name:n,short:n.slice(0,14),cat:null,coins:p,claim:cl,order:Date.now()}:{name:n,short:n.slice(0,14),cat:+c,points:p,claim:cl,input:document.getElementById('nq-input').value,order:Date.now()};
  const id=newId('q');S.quests.push(Object.assign({id},q));setDoc(sref('quests',id),q).then(()=>toast('เพิ่มงานแล้ว')).catch(e=>fail(e))},
 'q-edit'(d){S.editQ=d.q||null},
 'q-copy'(d){const q=S.quests.find(x=>x.id===d.q);if(!q)return false;const {id:_,...rest}=q;const n=Object.assign({},rest,{name:q.name+' (สำเนา)',short:(q.name+' (สำเนา)').slice(0,14),order:Date.now()});const id=newId('q');S.quests.push(Object.assign({id},n));S.editQ=id;setDoc(sref('quests',id),n).then(()=>toast('คัดลอกงานแล้ว แก้ไขชื่อและคะแนนได้เลย')).catch(e=>fail(e))},
 'q-edit-save'(d){const q=S.quests.find(x=>x.id===d.q);if(!q)return;const g=i=>document.getElementById(i);const n=g('eq-name').value.trim();if(!n){toast('ใส่ชื่องานก่อน');return}
  const c=g('eq-cat').value,p=Math.max(1,+g('eq-pts').value||1),cl=g('eq-claim').checked;
  const u=c==='sp'?{name:n,short:n.slice(0,14),cat:null,coins:p,claim:cl,points:deleteField(),input:deleteField()}:{name:n,short:n.slice(0,14),cat:+c,points:p,claim:cl,input:g('eq-input').value,coins:deleteField()};
  const loc=c==='sp'?{name:n,short:n.slice(0,14),cat:null,coins:p,claim:cl}:{name:n,short:n.slice(0,14),cat:+c,points:p,claim:cl,input:g('eq-input').value};
  if(c==='sp'){delete q.points;delete q.input}else delete q.coins;Object.assign(q,loc);S.editQ=null;render();
  updateDoc(sref('quests',q.id),u).then(()=>toast('บันทึกงานแล้ว')).catch(e=>fail(e));return false},
 'q-del'(d){deleteDoc(sref('quests',d.q)).then(()=>toast('ลบงานแล้ว')).catch(e=>fail(e))},
 /* ผู้ดูแลระบบ */
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
 'c-dl'(){const A_=S.adm;const sel=ACT().filter(s=>A_.cardRooms.includes(s.room)).sort((a,b)=>a.room.localeCompare(b.room,'th',{numeric:true})||a.no-b.no);toast('กำลังเตรียมไฟล์บัตร...');exportCards(sel,A_.cardRooms.length===1?'ห้อง '+A_.cardRooms[0]:A_.cardLevel+' '+A_.cardRooms.length+' ห้อง')},
 't-create'(){const name=document.getElementById('nt-name').value.trim(),u=document.getElementById('nt-user').value.trim().toLowerCase(),p=document.getElementById('nt-pass').value;
  if(!name||!u||!p){toast('กรอกชื่อ รหัสผู้ใช้งาน และรหัสผ่านให้ครบ');return false}
  if(!/^[a-z0-9][a-z0-9._-]{2,19}$/.test(u)){toast('รหัสผู้ใช้งานใช้ a-z 0-9 . _ - ยาว 3-20 ตัว');return false}
  if(p.length<6){toast('รหัสผ่านต้องยาวอย่างน้อย 6 ตัว');return false}
  if(S.teachers.some(t=>t.username===u)){toast('รหัสผู้ใช้งานนี้มีแล้ว');return false}
  S.modal={type:'progress',title:'กำลังสร้างบัญชีครู',done:0,total:1,unit:'บัญชี'};render();
  createTeacherAccount(name,u,p,null).then(()=>{S.modal=null;S.adm.newPw=null;S.adm.showPw[u]=true;toast(`สร้างบัญชี ${u} แล้ว กดพิมพ์ใบรหัสให้ครูได้`);soon()}).catch(e=>{S.modal=null;fail(e,e.code==='auth/email-already-in-use'?'รหัสผู้ใช้งานนี้เคยถูกใช้แล้ว':'สร้างบัญชีไม่สำเร็จ')});return false},
 't-show'(d){S.adm.showPw[d.u]=!S.adm.showPw[d.u]},
 't-slip'(d){const t=S.teachers.find(x=>x.username===d.u);if(t&&S.tsec[d.u])exportSlip(t,S.tsec[d.u]);return false},
 't-reset'(d){const t=S.teachers.find(x=>x.username===d.u);if(!t)return;const pw=randPwd(8);S.modal={type:'progress',title:'กำลังออกรหัสผ่านใหม่',done:0,total:1,unit:'บัญชี'};render();
  createTeacherAccount(t.name,t.username,pw,t).then(()=>{S.modal=null;S.adm.showPw[d.u]=true;toast('ออกรหัสผ่านใหม่แล้ว วิชาของครูย้ายมาที่บัญชีใหม่ให้เรียบร้อย');soon()}).catch(e=>{S.modal=null;fail(e,'ออกรหัสใหม่ไม่สำเร็จ')});return false},
 't-del'(d){if(S.adm.confirmDel!==d.u){S.adm.confirmDel=d.u;toast('กดลบอีกครั้งเพื่อยืนยัน (ครูจะเข้าระบบไม่ได้ทันที)');return}
  const t=S.teachers.find(x=>x.username===d.u);S.adm.confirmDel=null;if(!t)return;
  const b=writeBatch(db);b.delete(D('users',t.uid));b.delete(D('teacherLogin',d.u));b.delete(D('teacherSecrets',d.u));
  b.commit().then(()=>{S.teachers=S.teachers.filter(x=>x.username!==d.u);toast('ลบบัญชีครูแล้ว');soon()}).catch(e=>fail(e))},
};
let tiltRq=0;
document.addEventListener('pointermove',e=>{const el=e.target.closest&&e.target.closest('.pscene');if(!el||el.classList.contains('thumb'))return;
 if(tiltRq)return;tiltRq=requestAnimationFrame(()=>{tiltRq=0;const r=el.getBoundingClientRect();const x=Math.max(-1,Math.min(1,((e.clientX-r.left)/r.width-.5)*2)),y=Math.max(-1,Math.min(1,((e.clientY-r.top)/r.height-.5)*2));S.tilt=[+x.toFixed(2),+y.toFixed(2)];el.style.setProperty('--px',S.tilt[0]);el.style.setProperty('--py',S.tilt[1])})});
document.addEventListener('pointerout',e=>{const el=e.target.closest&&e.target.closest('.pscene');if(!el||el.contains(e.relatedTarget))return;S.tilt=[0,0];el.style.setProperty('--px',0);el.style.setProperty('--py',0)});
document.addEventListener('click',e=>{const el=e.target.closest('[data-act]');if(!el||el.tagName==='SELECT'||el.tagName==='INPUT')return;const f=A[el.dataset.act];if(!f)return;if(f(el.dataset,el,e)===false)return;render()});
document.addEventListener('submit',e=>{if(e.target.dataset&&e.target.dataset.form==='tlogin'){e.preventDefault();teacherLogin()}});
document.addEventListener('change',e=>{const t=e.target;
 if(t.dataset.g){gridChange(t);return}
 if(t.dataset.sell){const k=t.dataset.sell;S.sell[k]=Math.max(0,Math.min(availOf(S.user.id,k),Math.floor(+t.value||0)));render();return}
 if(t.dataset.price){const k=t.dataset.price;if(!S.settings.prices)S.settings.prices={};S.settings.prices[k]=Math.max(0,Math.round(+t.value||0));saveSub();render();return}
 if(t.dataset.actChange==='clr-sel'){clrState().sel[t.dataset.id]=t.checked;render();return}
 if(t.dataset.actChange==='clr-ok'){clrState().ok=t.checked;render();return}
 if(t.dataset.actChange==='personal'){S.personal=t.checked;return}
 if(t.dataset.actChange==='scanfile'){const f=t.files&&t.files[0];if(f)scanImage(f);return}
 if(t.dataset.actChange==='impfile'){const f=t.files&&t.files[0];if(!f)return;toast('กำลังอ่านไฟล์...');render();readRoster(f).then(rows=>{S.adm.imp={file:f.name,rows};render()}).catch(e=>{toast(e.message==='head'?'ไม่พบหัวคอลัมน์ "เลขประจำตัว" ในไฟล์ ใช้แม่แบบแล้วลองใหม่':'อ่านไฟล์ไม่สำเร็จ ลองบันทึกเป็น .csv แล้วอัปโหลดใหม่');render()});return}
 if(t.dataset.actChange==='clevel'){S.adm.cardLevel=t.value;S.adm.cardRooms=allRooms().filter(r=>r.startsWith(t.value+'/'));render();return}
 if(t.dataset.croom){const r=t.dataset.croom;S.adm.cardRooms=t.checked?[...new Set([...S.adm.cardRooms,r])]:S.adm.cardRooms.filter(x=>x!==r);render();return}
 if(t.dataset.actChange==='subj'){useSubject(t.value);S.confirmDel=false;render();return}
 if(t.dataset.actChange==='apstu'){S.apStudent=t.value;render();return}
 if(t.dataset.actChange==='sort'){S.sort=t.value;render();return}
 if(t.dataset.cat){const [i,f]=t.dataset.cat.split('|');const c=S.settings.cats[+i];c[f]=t.type==='checkbox'?t.checked:f==='max'?Math.max(0,+t.value||0):t.value;saveSub();render();return}
 if(t.dataset.room){const r=t.dataset.room;S.rooms=t.checked?[...new Set([...S.rooms,r])].sort():S.rooms.filter(x=>x!==r);if(!S.rooms.includes(S.room))S.room=S.rooms[0]||null;saveSub();render();return}
 if(t.dataset.set==='level'){S.settings.level=t.value;S.rooms=S.rooms.filter(r=>r.startsWith(t.value+'/'));if(!S.rooms.includes(S.room))S.room=S.rooms[0]||null;saveSub();render();return}
 if(t.dataset.set){S.settings[t.dataset.set]=t.type==='number'?(+t.value||0):t.value;saveSub();render();return}
 if(t.dataset.score){const [sid,qid]=t.dataset.score.split('|');const s=stu(sid),q=quest(qid);grade(s,q,t.value===''?null:Math.max(0,Math.min(q.points,+t.value||0)));render();return}
});
document.addEventListener('keydown',e=>{const t=e.target;if(e.key!=='Enter'||!t.dataset||!t.dataset.g||t.type!=='number')return;e.preventDefault();
 const td=t.closest('td');if(!td){t.blur();return}const col=[...td.parentNode.children].indexOf(td);const next=td.parentNode.nextElementSibling;const n=next&&next.children[col]&&next.children[col].querySelector('input');t.blur();if(n){n.focus();n.select&&n.select()}});
render();
