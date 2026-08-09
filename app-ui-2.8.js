import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import {getAuth,createUserWithEmailAndPassword,signInWithEmailAndPassword,signOut,deleteUser,sendPasswordResetEmail,sendEmailVerification,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import {getFirestore,doc,getDoc,setDoc,updateDoc,deleteDoc,serverTimestamp,collection,getDocs,query,where,addDoc,writeBatch,onSnapshot} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import {getStorage,ref as storageRef,uploadBytes,getDownloadURL} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js';

const firebaseConfig={apiKey:'AIzaSyDIDmHohUqyJ4xhmY_YXV1Ba95jQ96IY8Q',authDomain:'asbavol-gestion.firebaseapp.com',projectId:'asbavol-gestion',storageBucket:'asbavol-gestion.firebasestorage.app',messagingSenderId:'112087607790',appId:'1:112087607790:web:051beaa435ccb14b7506ff'};
const ORG_ID='asbavol';
const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app),storage=getStorage(app);

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
let registrationInProgress=false;
let profile=null,players=[],categories=[],venues=[],events=[],announcements=[],charges=[],sinpeReports=[],allUsers=[],familyUsers=[],trainerUsers=[],families=[],seasons=[],trainingSeries=[],trainingExceptions=[],linkRequests=[],categoryVideos=[],attendanceRecords=[],notifications=[];
const state={authStatus:'loading',currentView:null,adminListeners:[],familyListeners:[],familiesReconciled:false,familyDataLoading:false,familyPickerId:null};
const bootWatchdog=setTimeout(()=>{
  if(!['loading','resolving'].includes(state.authStatus))return;
  console.error('VolleyCore: Firebase Authentication no respondió durante el tiempo esperado.');
  document.querySelector('#bootScreen')?.classList.add('hidden');
  document.querySelector('#appScreen')?.classList.add('hidden');
  document.querySelector('#authScreen')?.classList.remove('hidden');
  const status=document.querySelector('#startupStatus');
  if(status){status.textContent='No fue posible confirmar la sesión. Recarga la página. Si continúa, borra los datos del sitio para este dominio.';status.className='notice error';}
},30000);
let familyPlayers=[],familyCharges=[],familyEvents=[],familyAnnouncements=[],familyTrainingSeries=[],familyTrainingExceptions=[],familyLinkRequests=[];
let trainerPlayers=[],trainerCharges=[],trainerEvents=[],trainerAnnouncements=[],trainerTrainingSeries=[];
let generatedPaymentReport=[];
let importPreviewRows=[];

function cacheBustedImage(url,version){if(!url)return'';return `${url}${url.includes('?')?'&':'?'}v=${encodeURIComponent(version||'1')}`;}
async function compressImageFile(file,{maxDimension=1400,quality=.84}={}){
  if(!file)return null;if(file.size>5*1024*1024)throw Error('La imagen supera el máximo de 5 MB.');
  const bitmap=await createImageBitmap(file),scale=Math.min(1,maxDimension/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('No se pudo procesar la imagen.')),'image/jpeg',quality));bitmap.close?.();return blob;
}
async function uploadEntityPhoto(kind,id,file){
  const blob=await compressImageFile(file,{maxDimension:kind==='category'?1800:1200});
  const path=`orgs/${ORG_ID}/${kind==='category'?'categoryPhotos':'playerPhotos'}/${id}/profile.jpg`,r=storageRef(storage,path);
  await uploadBytes(r,blob,{contentType:'image/jpeg'});const url=await getDownloadURL(r);return{photoUrl:url,photoPath:path,photoVersion:Date.now()};
}
function previewPhoto(el,url,version,label){if(!el)return;el.innerHTML=url?`<img src="${esc(cacheBustedImage(url,version))}" alt="">`:`<span>${esc(label||'Sin foto')}</span>`;}
function notificationCategoryIds(){
  if(['admin','treasurer'].includes(profile?.role))return null;
  if(isCoachingRole(profile?.role))return [...new Set(profile.assignedCategoryIds||[])];
  const uid=auth.currentUser?.uid;
  const linked=(familyPlayers||[]).filter(p=>(p.linkedUserIds||[]).includes(uid));
  if(profile?.accountType==='player'||profile?.role==='player'){
    const own=profile?.playerId?linked.filter(p=>p.id===profile.playerId):linked;
    return [...new Set(own.flatMap(p=>playerCatIds(p)))];
  }
  return [...new Set(linked.flatMap(p=>playerCatIds(p)))];
}
function visibleNotifications(){const ids=notificationCategoryIds();return notifications.filter(n=>!n.categoryId||ids===null||ids.includes(n.categoryId)).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));}
function notificationIsRead(n){return (n.readBy||[]).includes(auth.currentUser?.uid)}
function renderNotifications(){
  const list=visibleNotifications(),unread=list.filter(n=>!notificationIsRead(n)),badge=$('#notificationCount');
  if(badge){badge.textContent=unread.length>99?'99+':String(unread.length);badge.classList.toggle('hidden',!unread.length);}
  $('#notificationList').innerHTML=list.slice(0,40).map(n=>`<button class="notification-item ${notificationIsRead(n)?'':'unread'}" data-notification-id="${n.id}" data-notification-kind="${esc(n.kind||'')}" data-notification-source="${esc(n.sourceId||'')}"><span class="notification-dot"></span><span><strong>${esc(n.title||'Notificación')}</strong><small>${n.categoryId?esc(catName(n.categoryId))+' · ':''}${esc(n.body||'')}</small></span></button>`).join('')||'<p class="muted">No tienes notificaciones.</p>';
}
async function loadNotifications(){try{notifications=await col('notifications',[where('orgId','==',ORG_ID)]);renderNotifications();}catch(e){console.warn(e);notifications=[];renderNotifications();}}
async function createCategoryNotification({kind,categoryId='',title,body='',sourceId=''}){await addDoc(collection(db,'notifications'),{orgId:ORG_ID,kind,categoryId,title,body,sourceId,createdBy:auth.currentUser?.uid||'',readBy:[],createdAt:serverTimestamp()});}
async function markNotificationRead(id){const n=notifications.find(x=>x.id===id);if(!n||notificationIsRead(n))return;const readBy=[...new Set([...(n.readBy||[]),auth.currentUser.uid])];await updateDoc(doc(db,'notifications',id),{readBy});n.readBy=readBy;renderNotifications();}
const money=n=>new Intl.NumberFormat('es-CR',{style:'currency',currency:'CRC',maximumFractionDigits:0}).format(Number(n)||0);
const norm=s=>(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
const today=()=>new Date().toISOString().slice(0,10);
const monthNow=()=>new Date().toISOString().slice(0,7);
const monthLabel=m=>{if(!m)return'Sin mes';const [y,mo]=m.split('-').map(Number);return new Intl.DateTimeFormat('es-CR',{month:'long',year:'numeric'}).format(new Date(y,mo-1,1)).replace(/^./,c=>c.toUpperCase())};
const dueDateForMonth=m=>`${m}-15`;
const chargeRemaining=c=>Math.max(0,Number(c?.amount||0)-Number(c?.paidAmount||0));
const chargeDueState=c=>{if(['paid','exempt'].includes(c?.status))return'closed';const due=c?.dueDate||dueDateForMonth(c?.month);return today()>due?'overdue':'current'};
const activeReportForCharge=id=>sinpeReports.find(r=>r.chargeId===id&&['reported','approved'].includes(r.status));
const approvedReportForCharge=id=>sinpeReports.filter(r=>r.chargeId===id&&r.status==='approved').sort((a,b)=>(b.approvedAt?.seconds||b.createdAt?.seconds||0)-(a.approvedAt?.seconds||a.createdAt?.seconds||0))[0];
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const typeLabel=t=>({match:'Partido',tournament:'Torneo',festival:'Festival',meeting:'Reunión',trip:'Gira',other:'Otra actividad'}[t]||t);
const statusLabel=s=>({active:'Activa',inactive:'Inactiva',scheduled:'Programado',changed:'Modificado',cancelled:'Cancelado',completed:'Completado',pending:'Pendiente',paid:'Pagado',partial:'Parcial',exempt:'Exonerado',published:'Publicado',draft:'Borrador',closed:'Cerrada',reported:'Reportado',approved:'Aprobado',rejected:'Rechazado',present:'Presente',absent:'Ausente'}[s]||s);
function toast(m){const t=$('#toast');t.textContent=m;t.classList.remove('hidden');setTimeout(()=>t.classList.add('hidden'),3000)}
function confirmAction(message,{title='Confirmar acción',acceptText='Confirmar'}={}){return new Promise(resolve=>{const d=$('#confirmDialog'),ttl=$('#confirmDialogTitle'),msg=$('#confirmDialogMessage'),accept=$('#confirmDialogAccept'),cancel=$('#confirmDialogCancel'),close=$('#confirmDialogClose');ttl.textContent=title;msg.textContent=message;accept.textContent=acceptText;let done=false;const finish=value=>{if(done)return;done=true;accept.onclick=null;cancel.onclick=null;close.onclick=null;d.oncancel=null;d.close();resolve(value)};accept.onclick=()=>finish(true);cancel.onclick=()=>finish(false);close.onclick=()=>finish(false);d.oncancel=e=>{e.preventDefault();finish(false)};d.showModal()})}

function busy(b,v,t){if(v){b.dataset.old=b.textContent;b.textContent=t;b.disabled=true}else{b.textContent=b.dataset.old||b.textContent;b.disabled=false}}
function err(e){console.error(e);const m={'auth/email-already-in-use':'Ese correo ya tiene una cuenta.','auth/invalid-credential':'Correo o contraseña incorrectos.','auth/weak-password':'La contraseña debe tener al menos 8 caracteres.','permission-denied':'No tiene permiso. Publica las reglas de Firestore incluidas con Sprint 1.1.','firestore/permission-denied':'No tiene permiso. Publica las reglas de Firestore incluidas con Sprint 1.1.','profile-timeout':'Firebase tardó demasiado en responder. Revisa tu conexión e intenta nuevamente.'};return m[e?.code]||e?.message||'Ocurrió un error.'}
function downloadCSV(filename,rows){if(!rows.length)return alert('No hay datos para exportar.');const keys=Object.keys(rows[0]),q=v=>`"${String(v??'').replace(/"/g,'""')}"`,csv='\ufeff'+[keys.join(','),...rows.map(r=>keys.map(k=>q(r[k])).join(','))].join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download=filename;a.click();URL.revokeObjectURL(a.href)}
async function col(name,filters=[]){let ref=collection(db,name);if(filters.length)ref=query(ref,...filters);const s=await getDocs(ref);return s.docs.map(d=>({id:d.id,...d.data()}))}
function profileCacheKey(uid){return `volleycore-profile-${uid}`}
function cacheProfile(uid,p){try{localStorage.setItem(profileCacheKey(uid),JSON.stringify({...p,id:uid}))}catch{}}
function readCachedProfile(uid){try{return JSON.parse(localStorage.getItem(profileCacheKey(uid))||'null')}catch{return null}}
function withTimeout(promise,ms=8000){return Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>{const e=new Error('Firebase tardó demasiado en responder.');e.code='profile-timeout';reject(e)},ms))])}
async function ensureProfile(user,data){const r=doc(db,'users',user.uid),s=await withTimeout(getDoc(r));if(s.exists()){const p={id:s.id,...s.data()};cacheProfile(user.uid,p);return p}if(!data)throw Error('La cuenta no tiene perfil en Firestore.');const requestedType=data.accountType||'guardian',isTrainerRequest=requestedType==='trainer',isAssistantRequest=requestedType==='assistant',isStaffRequest=isTrainerRequest||isAssistantRequest;const p={orgId:ORG_ID,fullName:data.fullName,firstName:data.firstName,lastName1:data.lastName1,lastName2:data.lastName2,phone:data.phone,email:user.email,accountType:requestedType,role:isAssistantRequest?'pendingAssistant':isTrainerRequest?'pendingTrainer':'family',status:isStaffRequest?'pending':'active',trainerLevel:isAssistantRequest?'assistant':isTrainerRequest?'head':'',assignedCategoryIds:[],permissions:{viewContacts:false,viewFinancialStatus:false},createdAt:serverTimestamp(),updatedAt:serverTimestamp()};await withTimeout(setDoc(r,p));const saved={id:user.uid,...p};cacheProfile(user.uid,saved);return saved}

function go(view){state.currentView=view;$$('.view').forEach(v=>v.classList.toggle('hidden',v.id!==`view-${view}`));$$('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===view));const map={dashboard:renderDashboard,players:renderPlayers,categories:renderCategories,seasons:renderSeasons,trainings:renderTrainings,attendance:renderAttendance,events:renderEvents,venues:renderVenues,announcements:renderAnnouncements,finances:renderCharges,sinpeAdmin:renderSinpeAdmin,users:renderUsers,trainers:renderTrainers,trainerHome:renderTrainerHome,trainerPlayers:renderTrainerPlayers,trainerTrainings:renderTrainerTrainings,trainerAttendance:renderTrainerAttendance,trainerEvents:renderTrainerEvents,trainerAnnouncements:renderTrainerAnnouncements,familyHome:renderFamilyHome,familyCategories:renderFamilyCategories,familyLink:renderFamilyLink,familyTrainings:renderFamilyTrainings,familyEvents:renderFamilyEvents,familyPayments:renderFamilyCharges,familyAnnouncements:renderFamilyAnnouncements,import:renderPlayerImport,about:()=>{}};map[view]?.()}

async function ensureCurrentMonthCharges(){
  const month=monthNow(),existing=new Set(charges.filter(c=>c.month===month).map(c=>c.playerId)),eligible=players.filter(p=>p.status==='active'&&!isFirstDivisionPrimary(p)&&playerMonthlyFee(p)>0&&!existing.has(p.id));
  if(!eligible.length)return false;
  const batch=writeBatch(db);
  for(const p of eligible){
    const amount=playerMonthlyFee(p),id=`${p.id}_${month}`;
    batch.set(doc(db,'charges',id),{orgId:ORG_ID,playerId:p.id,playerCode:p.playerCode,categoryId:p.categoryId,userIds:p.linkedUserIds||[],month,amount,paidAmount:0,status:'pending',dueDay:15,dueDate:dueDateForMonth(month),createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
  }
  await batch.commit();
  return true;
}

async function ensureFirstDivisionExemptions(){
  const target=charges.filter(c=>['pending','partial'].includes(c.status)&&isFirstDivisionPrimary(players.find(p=>p.id===c.playerId)));
  if(!target.length)return false;
  const batch=writeBatch(db);
  target.forEach(c=>batch.update(doc(db,'charges',c.id),{status:'exempt',paidAmount:0,notes:[c.notes,'Exonerada automáticamente: categoría principal Primera División.'].filter(Boolean).join(' '),updatedAt:serverTimestamp()}));
  await batch.commit();
  return true;
}
async function loadAdminData(){const [cs,ps,vs,es,as,chs,srs,us,ss,ts,te,lrs,fs,cvs,ats]=await Promise.all([
  col('categories',[where('orgId','==',ORG_ID)]),col('players',[where('orgId','==',ORG_ID)]),col('venues',[where('orgId','==',ORG_ID)]),col('events',[where('orgId','==',ORG_ID)]),col('announcements',[where('orgId','==',ORG_ID)]),col('charges',[where('orgId','==',ORG_ID)]),col('sinpeReports',[where('orgId','==',ORG_ID)]),col('users',[where('orgId','==',ORG_ID)]),col('seasons',[where('orgId','==',ORG_ID)]),col('trainingSeries',[where('orgId','==',ORG_ID)]),col('trainingExceptions',[where('orgId','==',ORG_ID)]),col('linkRequests',[where('orgId','==',ORG_ID)]),col('families',[where('orgId','==',ORG_ID)]),col('categoryVideos',[where('orgId','==',ORG_ID)]),col('attendanceRecords',[where('orgId','==',ORG_ID)])
]);
 categories=cs.sort((a,b)=>(a.name||'').localeCompare(b.name||''));players=ps.sort((a,b)=>(a.name||'').localeCompare(b.name||''));venues=vs.sort((a,b)=>(a.name||'').localeCompare(b.name||''));events=es.filter(e=>e.type!=='training').sort((a,b)=>(a.date||'').localeCompare(b.date||''));announcements=as.sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));charges=chs;sinpeReports=srs;generatedPaymentReport=generatedPaymentReport.length?paymentReportRows():[];allUsers=us.sort((a,b)=>(a.fullName||'').localeCompare(b.fullName||''));familyUsers=allUsers.filter(u=>u.role==='family');trainerUsers=allUsers.filter(u=>isCoachingRole(u.role));seasons=ss.sort((a,b)=>(b.startDate||'').localeCompare(a.startDate||''));trainingSeries=ts;trainingExceptions=te;linkRequests=lrs;families=fs.filter(f=>f.status!=='merged');categoryVideos=(cvs||[]).sort((a,b)=>(b.date||'').localeCompare(a.date||''));attendanceRecords=ats||[];if(await ensureCategoryNaming())categories=(await col('categories',[where('orgId','==',ORG_ID)])).sort((a,b)=>(a.name||'').localeCompare(b.name||''));if(await ensureFirstDivisionExemptions())charges=await col('charges',[where('orgId','==',ORG_ID)]);if(await ensureCurrentMonthCharges())charges=await col('charges',[where('orgId','==',ORG_ID)]);populateSelectors();renderDashboard();await loadNotifications();
}
async function loadFamilyData(){
  state.familyDataLoading=true;setFamilyLoading(true);
  const uid=auth.currentUser.uid;
  const [fps,cs,vs,ss,es,ts,te,as,fcs,srs,lrs,fs,cvs]=await Promise.all([
    col('players',[where('orgId','==',ORG_ID),where('linkedUserIds','array-contains',uid)]),
    col('categories',[where('orgId','==',ORG_ID)]),col('venues',[where('orgId','==',ORG_ID)]),col('seasons',[where('orgId','==',ORG_ID)]),
    col('events',[where('orgId','==',ORG_ID)]),col('trainingSeries',[where('orgId','==',ORG_ID)]),col('trainingExceptions',[where('orgId','==',ORG_ID)]),
    col('announcements',[where('orgId','==',ORG_ID),where('status','==','published')]),
    profile?.accountType==='player'?Promise.resolve([]):col('charges',[where('orgId','==',ORG_ID),where('userIds','array-contains',uid)]),
    profile?.accountType==='player'?Promise.resolve([]):col('sinpeReports',[where('orgId','==',ORG_ID),where('userId','==',uid)]),
    col('linkRequests',[where('orgId','==',ORG_ID),where('userId','==',uid)]),
    col('families',[where('orgId','==',ORG_ID),where('memberUserIds','array-contains',uid)]),
    col('categoryVideos',[where('orgId','==',ORG_ID)])
  ]);
  familyPlayers=fps;categories=cs;venues=vs;seasons=ss;events=es;trainingSeries=ts;trainingExceptions=te;announcements=as;familyCharges=fcs;sinpeReports=srs;familyLinkRequests=lrs;families=fs;categoryVideos=(cvs||[]).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  deriveFamilyData();populateSelectors();state.familyDataLoading=false;setFamilyLoading(false);renderFamilyHome();await loadNotifications();
}
function deriveFamilyData(){const catIds=[...new Set(familyPlayers.flatMap(p=>p.categoryIds?.length?p.categoryIds:[p.categoryId]).filter(Boolean))];familyEvents=events.filter(e=>e.type!=='training'&&catIds.includes(e.categoryId));familyTrainingSeries=trainingSeries.filter(t=>catIds.includes(t.categoryId)&&t.status==='active');familyTrainingExceptions=trainingExceptions.filter(x=>familyTrainingSeries.some(t=>t.id===x.seriesId));familyAnnouncements=announcements.filter(a=>!a.categoryId||catIds.includes(a.categoryId));}
function setFamilyLoading(v){if($('#familyPlayers'))$('#familyPlayers').innerHTML=v?'<div class="loading-placeholder"><div class="spinner"></div>Cargando jugadoras vinculadas…</div>':'';if($('#familyLinkRequests')&&v)$('#familyLinkRequests').innerHTML='<p class="muted">Cargando solicitudes…</p>';}


function populateSelectors(){const opts=categories.filter(c=>c.status==='active').map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');['playerCategory','eventCategory','trainingCategory'].forEach(id=>{if($('#'+id))$('#'+id).innerHTML=opts});if($('#linkCategory'))$('#linkCategory').innerHTML='<option value="">No estoy seguro/a</option>'+opts;if($('#playerCategoryFilter')){
  const current=$('#playerCategoryFilter').value;
  $('#playerCategoryFilter').innerHTML='<option value="">Selecciona una categoría</option><option value="__all__">Todas las categorías</option>'+opts;
  if([...$('#playerCategoryFilter').options].some(o=>o.value===current))$('#playerCategoryFilter').value=current;
}
['eventCategoryFilter','trainingCategoryFilter','generateCategory','announcementCategory','chargeCategoryFilter','attendanceCategory','importDefaultCategory'].forEach(id=>{if($('#'+id))$('#'+id).innerHTML='<option value="">Todas las categorías</option>'+opts});const vopts='<option value="">Sin sede</option>'+venues.filter(v=>v.status==='active').map(v=>`<option value="${v.id}">${esc(v.name)}</option>`).join('');['categoryVenue','eventVenue','trainingVenue','trainingExceptionVenue','trainingFutureVenue'].forEach(id=>{if($('#'+id))$('#'+id).innerHTML=vopts});const sopts=seasons.map(s=>`<option value="${s.id}">${esc(s.name)}${s.isCurrent?' · Actual':''}</option>`).join('');['categorySeason','eventSeason','trainingSeason'].forEach(id=>{if($('#'+id))$('#'+id).innerHTML=sopts});['eventSeasonFilter','trainingSeasonFilter'].forEach(id=>{if($('#'+id))$('#'+id).innerHTML='<option value="">Todas las temporadas</option>'+sopts})}
function playerCatIds(p){return p?.categoryIds?.length?p.categoryIds:[p?.categoryId].filter(Boolean)}function catNames(p){return playerCatIds(p).map(catName).join(', ')||'Sin categoría'}
const CATEGORY_NAME_MIGRATION={
  'iniciacion':{name:'Iniciación',ageGroup:'Iniciación',teamColor:''},
  'mini':{name:'U-13',ageGroup:'U-13',teamColor:''},
  'preinfantil':{name:'U-15',ageGroup:'U-15',teamColor:''},
  'pre-infantil':{name:'U-15',ageGroup:'U-15',teamColor:''},
  'infantil 1':{name:'U-17 Rojo',ageGroup:'U-17',teamColor:'Rojo'},
  'infantil 2':{name:'U-17 Negro',ageGroup:'U-17',teamColor:'Negro'},
  'infantil rojo':{name:'U-17 Rojo',ageGroup:'U-17',teamColor:'Rojo'},
  'infantil negro':{name:'U-17 Negro',ageGroup:'U-17',teamColor:'Negro'},
  'juvenil':{name:'U-19',ageGroup:'U-19',teamColor:''},
  'juegos nacionales':{name:'U-21',ageGroup:'U-21',teamColor:''},
  'primera division':{name:'Primera División',ageGroup:'Primera División',teamColor:''},
  'u-13':{name:'U-13',ageGroup:'U-13',teamColor:''},
  'u-15':{name:'U-15',ageGroup:'U-15',teamColor:''},
  'u-17 rojo':{name:'U-17 Rojo',ageGroup:'U-17',teamColor:'Rojo'},
  'u-17 negro':{name:'U-17 Negro',ageGroup:'U-17',teamColor:'Negro'},
  'u-19':{name:'U-19',ageGroup:'U-19',teamColor:''},
  'u-21':{name:'U-21',ageGroup:'U-21',teamColor:''}
};
async function ensureCategoryNaming(){
  const pending=categories.filter(c=>{
    const m=CATEGORY_NAME_MIGRATION[norm(c.name)];
    return m&&(c.name!==m.name||c.ageGroup!==m.ageGroup||(c.teamColor||'')!==m.teamColor);
  });
  if(!pending.length)return false;
  const batch=writeBatch(db);
  pending.forEach(c=>{const m=CATEGORY_NAME_MIGRATION[norm(c.name)];batch.update(doc(db,'categories',c.id),{name:m.name,ageGroup:m.ageGroup,teamColor:m.teamColor,updatedAt:serverTimestamp()})});
  await batch.commit();
  return true;
}


function categoryEventsList(id){
  return events.filter(e=>e.categoryId===id).sort((a,b)=>(a.date||'').localeCompare(b.date||''));
}
function categoryTrainingsList(id){
  return trainingSeries.filter(t=>t.categoryId===id&&t.status==='active');
}
function categoryVideosList(id){
  return categoryVideos.filter(v=>v.categoryId===id).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
}
function categoryDetailHTML(id,{familyMode=false}={}){
  const c=categories.find(x=>x.id===id);
  if(!c)return'<p class="muted">Categoría no encontrada.</p>';
  const roster=(familyMode?familyPlayers:players).filter(p=>playerCatIds(p).includes(id));
  const trainings=categoryTrainingsList(id);
  const games=categoryEventsList(id);
  const videos=categoryVideosList(id);

  return `${c.photoUrl?`<div class="category-team-photo-wrap"><img class="category-team-photo" src="${esc(cacheBustedImage(c.photoUrl,c.photoVersion))}" alt="Equipo ${esc(c.name)}"></div>`:''}<div class="category-detail-grid">
    <article class="panel">
      <span class="eyebrow">INFORMACIÓN</span>
      <h4>${esc(c.name)}</h4>
      <p><strong>Entrenador:</strong> ${esc(c.coach||'—')}<br>
      <strong>Asistente:</strong> ${esc(c.assistant||'—')}<br>
      <strong>Temporada:</strong> ${esc(seasonName(c.seasonId))}<br>
      <strong>Sede:</strong> ${esc(venueName(c.venueId))}</p>
      ${venueLinks(c.venueId)}
    </article>
    <article class="panel">
      <span class="eyebrow">RESUMEN</span>
      <h4>${roster.length} jugadoras</h4>
      <p>${trainings.length} horario${trainings.length===1?'':'s'} de entrenamiento<br>
      ${games.length} evento${games.length===1?'':'s'} / partido${games.length===1?'':'s'}<br>
      ${videos.length} video${videos.length===1?'':'s'} disponible${videos.length===1?'':'s'}</p>
    </article>
  </div>
  <section class="category-section">
    <h4>Entrenamientos</h4>
    ${trainings.map(t=>`<article class="panel"><strong>${esc(daysLabel(t.days||[]))}</strong><p>${esc(t.startTime||'')} – ${esc(t.endTime||'')} · ${esc(venueName(t.venueId))}</p></article>`).join('')||'<p class="muted">No hay entrenamientos configurados.</p>'}
  </section>
  <section class="category-section">
    <h4>Calendario de juegos y eventos</h4>
    ${games.map(e=>`<article class="panel"><div class="page-head compact-head"><div><span class="eyebrow">${esc(typeLabel(e.type))}</span><h4>${esc(e.title)}</h4></div><span class="badge ${e.status}">${esc(statusLabel(e.status))}</span></div><p><strong>${esc(e.date)}</strong> · ${esc(e.startTime||'')} ${e.endTime?'– '+esc(e.endTime):''}</p><p>${e.opponent?`Rival: ${esc(e.opponent)} · `:''}${esc(eventLocationName(e))}${e.homeAway==='away'&&e.awayAddress?` · ${esc(e.awayAddress)}`:''}</p></article>`).join('')||'<p class="muted">No hay partidos o eventos registrados.</p>'}
  </section>
  <section class="category-section">
    <h4>Videos de partidos</h4>
    ${videos.map(v=>`<article class="panel"><span class="eyebrow">${esc(v.date||'')}</span><h4>${esc(v.title)}</h4><p>${v.opponent?`Rival: ${esc(v.opponent)} · `:''}${esc(v.tournament||'')}</p><a href="${esc(v.url)}" target="_blank" rel="noopener">Abrir video</a><p class="muted">${esc(v.notes||'')}</p></article>`).join('')||'<p class="muted">No hay videos registrados.</p>'}
  </section>`;
}
function openCategoryDetail(id){
  const c=categories.find(x=>x.id===id);
  if(!c)return;
  $('#categoryDetailTitle').textContent=c.name;
  $('#categoryDetailContent').innerHTML=categoryDetailHTML(id);
  const addVideo=$('#addCategoryVideoButton');
  if(addVideo){addVideo.dataset.categoryId=id;addVideo.classList.remove('hidden');}
  $('#categoryCalendarButton').dataset.categoryId=id;
  $('#categoryDetailDialog').showModal();
}
function openFamilyCategoryDetail(id){
  const c=categories.find(x=>x.id===id);
  if(!c)return;
  $('#categoryDetailTitle').textContent=c.name;
  $('#categoryDetailContent').innerHTML=categoryDetailHTML(id,{familyMode:true});
  const addVideo=$('#addCategoryVideoButton');
  if(addVideo)addVideo.classList.add('hidden');
  $('#categoryCalendarButton').dataset.categoryId=id;
  $('#categoryDetailDialog').showModal();
}
function renderFamilyCategories(){
  const ids=[...new Set(familyPlayers.flatMap(p=>playerCatIds(p)))];
  $('#familyCategoriesList').innerHTML=ids.map(id=>{
    const c=categories.find(x=>x.id===id);
    if(!c)return'';
    const next=categoryEventsList(id).find(e=>e.date>=today()&&e.status!=='cancelled');
    return `<article class="panel category-card-with-photo">
      ${c.photoUrl?`<img class="category-card-photo" src="${esc(cacheBustedImage(c.photoUrl,c.photoVersion))}" alt="${esc(c.name)}">`:''}
      <span class="eyebrow">${esc(seasonName(c.seasonId))}</span>
      <h3>${esc(c.name)}</h3>
      <p><strong>Entrenador:</strong> ${esc(c.coach||'—')}</p>
      <p>${next?`Próximo evento: <strong>${esc(next.date)} · ${esc(next.title)}</strong>`:'Sin próximos eventos registrados.'}</p>
      <button class="btn primary" data-family-category="${id}">Ver categoría</button>
    </article>`;
  }).join('')||'<p class="muted">No tienes categorías vinculadas todavía.</p>';
}

function primaryCategoryName(p){return catName(p?.categoryId)}
function reinforcementCategoryIds(p){return Array.isArray(p?.reinforcementCategoryIds)?p.reinforcementCategoryIds:playerCatIds(p).filter(id=>id!==p?.categoryId)}
function reinforcementCategoryNames(p){return reinforcementCategoryIds(p).map(catName).join(', ')||'No refuerza otras categorías'}
function isFirstDivisionCategoryId(id){return norm(catName(id)).includes('primera division')}
function isFirstDivisionPrimary(p){return !!p?.categoryId&&isFirstDivisionCategoryId(p.categoryId)}
function playerMonthlyFee(p){
  if(isFirstDivisionPrimary(p))return 0;
  const raw=p?.customFee;
  if(raw!==undefined&&raw!==null&&raw!=='')return Number(raw)||0;
  return Number(categories.find(c=>c.id===p?.categoryId)?.fee||0);
}
function playerInsuranceState(p){
  if(!p?.insured)return{key:'uninsured',label:'No asegurada'};
  if(p.insurance?.expiryDate&&p.insurance.expiryDate<today())return{key:'overdue',label:'Seguro vencido'};
  if(p.insurance?.expiryDate){
    const days=Math.ceil((new Date(p.insurance.expiryDate+'T00:00:00')-new Date(today()+'T00:00:00'))/86400000);
    if(days>=0&&days<=30)return{key:'pending',label:'Seguro vence pronto'};
  }
  return{key:'insured',label:'Asegurada'};
}

function catName(id){return categories.find(c=>c.id===id)?.name||'Sin categoría'}function venueName(id){return venues.find(v=>v.id===id)?.name||'Sin sede'}function userName(id){return familyUsers.find(u=>u.id===id)?.fullName||'Usuario'}function playerName(id){return players.find(p=>p.id===id)?.name||familyPlayers.find(p=>p.id===id)?.name||'Jugadora'}
function seasonName(id){return seasons.find(s=>s.id===id)?.name||'Sin temporada'}
const dayNames=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
function daysLabel(days=[]){return [...days].sort((a,b)=>a-b).map(d=>dayNames[d]).join(', ')}
function datePlus(date,days){const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+days);return d.toISOString().slice(0,10)}
function safeMapUrl(url){const v=(url||'').trim();return /^https?:\/\//i.test(v)?v:''}
function venueLinks(id){const v=venues.find(x=>x.id===id);if(!v)return'';const url=safeMapUrl(v.mapUrl);return `<div class="actions">${url?`<a class="btn secondary" href="${esc(url)}" target="_blank" rel="noopener">📍 Abrir mapa</a>`:''}${v.address?`<button class="action" data-copy-address="${esc(v.address)}">Copiar dirección</button>`:''}</div>`}
function occurrences(series,from=today(),to=datePlus(today(),90)){const out=[],start=series.startDate>from?series.startDate:from,end=series.endDate<to?series.endDate:to;if(!start||!end||start>end)return out;let d=start;while(d<=end){const wd=new Date(d+'T12:00:00').getDay();if((series.days||[]).includes(wd)){const ex=trainingExceptions.find(x=>x.seriesId===series.id&&x.date===d);out.push({date:d,startTime:ex?.action==='changed'?(ex.startTime||series.startTime):series.startTime,endTime:ex?.action==='changed'?(ex.endTime||series.endTime):series.endTime,venueId:ex?.action==='changed'?(ex.venueId||series.venueId):series.venueId,status:ex?.action||'scheduled',notes:ex?.notes||series.notes||'',exceptionId:ex?.id||''})}d=datePlus(d,1)}return out}


function dashboardFormatDate(date){
  try{return new Intl.DateTimeFormat('es-CR',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(date+'T12:00:00'))}
  catch{return date}
}
function dashboardAttendancePercent(){
  const entries=attendanceRecords.flatMap(r=>r.entries||[]);
  if(!entries.length)return 0;
  const present=entries.filter(e=>e.status==='present').length;
  return Math.round(present*100/entries.length);
}
function dashboardNextTrainingOccurrence(){
  const all=trainingSeries.filter(t=>t.status==='active').flatMap(t=>occurrences(t,today(),datePlus(today(),45)).filter(o=>o.status!=='cancelled').map(o=>({...o,series:t})));
  return all.sort((a,b)=>`${a.date} ${a.startTime||''}`.localeCompare(`${b.date} ${b.startTime||''}`))[0]||null;
}
function dashboardActivityItems(){
  const items=[];
  players.slice(-4).forEach(p=>items.push({kind:'player',time:p.createdAt?.seconds||0,title:'Nueva jugadora',text:`${p.name} · ${catName(p.categoryId)}`}));
  sinpeReports.slice(-4).forEach(s=>items.push({kind:'payment',time:s.createdAt?.seconds||0,title:s.status==='approved'?'Pago aprobado':'Pago reportado',text:`${playerName(s.playerId)} · ${money(s.amount)}`}));
  attendanceRecords.slice(-4).forEach(a=>items.push({kind:'attendance',time:a.updatedAt?.seconds||a.createdAt?.seconds||0,title:'Asistencia registrada',text:`${catName(a.categoryId)} · ${a.date}`}));
  return items.sort((a,b)=>b.time-a.time).slice(0,5);
}

function renderSessionIdentity(){
  const full=(profile?.fullName||profile?.name||auth.currentUser?.displayName||auth.currentUser?.email||'Usuario').trim();
  const first=full.includes('@')?full.split('@')[0]:full;
  const role=statusLabel(profile?.role)||profile?.role||'Usuario';
  $$('.vc-session-user-name').forEach(el=>el.textContent=first);
  $$('.vc-session-user-role').forEach(el=>el.textContent=role);
}
function renderDashboard(){
  renderSessionIdentity();
  const activePlayers=players.filter(p=>p.status==='active').length;
  const openCharges=charges.filter(c=>['pending','partial'].includes(c.status));
  const pendingCount=openCharges.length;
  const overduePlayers=new Set(openCharges.filter(c=>chargeDueState(c)==='overdue').map(c=>c.playerId)).size;
  const attendance=dashboardAttendancePercent();
  const nextTraining=dashboardNextTrainingOccurrence();
  const nextMatch=events.filter(e=>e.type==='match'&&e.date>=today()&&e.status!=='cancelled').sort((a,b)=>`${a.date} ${a.startTime||''}`.localeCompare(`${b.date} ${b.startTime||''}`))[0]||null;
  const upcoming=events.filter(e=>e.date>=today()&&e.status!=='cancelled').sort((a,b)=>`${a.date} ${a.startTime||''}`.localeCompare(`${b.date} ${b.startTime||''}`)).slice(0,4);

  const name=(profile?.fullName||'').trim().split(/\s+/)[0]||'';
  const hour=new Date().getHours(),greeting=hour<12?'Buenos días':hour<18?'Buenas tardes':'Buenas noches';
  $('#dashboardGreeting').textContent=`¡${greeting}, ${name||'equipo'}!`;
  $('#dashboardToday').textContent=dashboardFormatDate(today());

  $('#summaryCards').innerHTML=[
    [activePlayers,'JUGADORAS ACTIVAS','♙','red','players'],
    [pendingCount,'PAGOS PENDIENTES','₡','green','sinpeAdmin'],
    [overduePlayers,'MOROSAS','!','red','finances'],
    [`${attendance}%`,'ASISTENCIA PROMEDIO','↗','cyan','attendance']
  ].map(([v,l,icon,color,view])=>`<article class="stat vc-kpi-card" data-dashboard-view="${view}">
    <span class="vc-round-icon ${color}">${icon}</span>
    <div><span>${l}</span><strong>${v}</strong><small>Ver detalles →</small></div>
  </article>`).join('');

  $('#dashboardNextTraining').innerHTML=nextTraining?`
    <h3 class="vc-feature-highlight cyan-text">${esc(catName(nextTraining.series.categoryId))}</h3>
    <div class="vc-feature-lines">
      <div>◷ <strong>${dashboardFormatDate(nextTraining.date)}</strong></div>
      <div>◴ ${esc(nextTraining.startTime||'')} ${nextTraining.endTime?'– '+esc(nextTraining.endTime):''}</div>
      <div>⌖ ${esc(venueName(nextTraining.venueId||nextTraining.series.venueId))}</div>
    </div>
    <button class="btn vc-cyan-button" data-dashboard-view="attendance">Tomar asistencia →</button>
  `:'<p class="muted">No hay entrenamientos próximos configurados.</p>';

  $('#dashboardNextMatch').innerHTML=nextMatch?`
    <h3 class="vc-feature-highlight red-text">${esc(catName(nextMatch.categoryId))}</h3>
    <p class="vc-opponent">${nextMatch.opponent?`vs ${esc(nextMatch.opponent)}`:esc(nextMatch.title)}</p>
    <div class="vc-feature-lines">
      <div>□ <strong>${dashboardFormatDate(nextMatch.date)}</strong></div>
      <div>◴ ${esc(nextMatch.startTime||'Hora por definir')}</div>
      <div>⌖ ${esc(eventLocationName(nextMatch))}</div>
    </div>
    <button class="btn primary" data-dashboard-view="events">Ver detalles →</button>
  `:'<p class="muted">No hay partidos próximos registrados.</p>';

  const pendingRows=openCharges
    .sort((a,b)=>(a.dueDate||dueDateForMonth(a.month)).localeCompare(b.dueDate||dueDateForMonth(b.month)))
    .slice(0,5);
  $('#dashboardPendingPayments').innerHTML=pendingRows.length?`<div class="table-wrap vc-embedded-table"><table>
    <thead><tr><th>Jugadora</th><th>Categoría</th><th>Concepto</th><th>Vencimiento</th><th>Monto</th><th>Estado</th></tr></thead>
    <tbody>${pendingRows.map(c=>{
      const due=chargeDueState(c),remaining=Math.max(0,Number(c.amount||0)-Number(c.paidAmount||0));
      return `<tr><td><strong>${esc(playerName(c.playerId))}</strong></td><td>${esc(catName(c.categoryId))}</td><td>${esc(monthLabel(c.month))}</td><td>${esc(c.dueDate||dueDateForMonth(c.month))}</td><td>${money(remaining)}</td><td><span class="badge ${due==='overdue'?'overdue':'pending'}">${due==='overdue'?'Morosa':'Pendiente'}</span></td></tr>`;
    }).join('')}</tbody></table></div>`:'<p class="muted">No hay pagos pendientes.</p>';

  $('#upcomingEvents').innerHTML=upcoming.map(e=>`<div class="vc-event-row" data-dashboard-event="${e.id}" role="button" tabindex="0">
    <div class="vc-date-box"><b>${String(Number((e.date||'').slice(8,10))||'').padStart(2,'0')}</b><span>${esc(monthLabel((e.date||'').slice(0,7)).split(' ')[0].slice(0,3).toUpperCase())}</span></div>
    <div><strong>${esc(e.title)}</strong><small>${esc(e.startTime||'')} · ${esc(eventLocationName(e))}</small></div>
  </div>`).join('')||'<p class="muted">No hay eventos próximos.</p>';

  const activity=dashboardActivityItems();
  $('#recentPlayers').innerHTML=activity.map(a=>`<div class="vc-activity-row">
    <span class="vc-round-icon ${a.kind==='payment'?'green':a.kind==='attendance'?'cyan':'red'}">${a.kind==='payment'?'✓':a.kind==='attendance'?'□':'♙'}</span>
    <div><strong>${esc(a.title)}</strong><small>${esc(a.text)}</small></div>
  </div>`).join('')||'<p class="muted">Sin actividad reciente.</p>';
}
function eventMini(e){return`<div class="recent-item"><div><strong>${esc(e.title)}</strong><div class="muted">${esc(e.date)} ${esc(e.startTime||'')} · ${esc(catName(e.categoryId))} · ${esc(eventLocationName(e))}</div></div><span class="badge ${e.status}">${statusLabel(e.status)}</span></div>`}
function guardianHTML(p){return(p.guardians||[]).map(g=>`<div class="guardian"><strong>${esc(g.name||'Sin nombre')}</strong><small>${esc(g.relationship||'Encargado')} · ${esc(g.phone||'Sin teléfono')}</small></div>`).join('')||'—'}
function playerCharges(p){if(isFirstDivisionPrimary(p))return[];return charges.filter(c=>c.playerId===p.id&&c.status!=='exempt').sort((a,b)=>(b.month||'').localeCompare(a.month||''))}
function playerFinancialState(p){
  if(isFirstDivisionPrimary(p))return{key:'first-division',label:'Primera División',detail:'Sin mensualidad'};
  const list=playerCharges(p),open=list.filter(c=>['pending','partial'].includes(c.status));
  const overdue=open.filter(c=>chargeDueState(c)==='overdue');
  if(overdue.length)return{key:'overdue',label:'Morosa',detail:`${overdue.length} mes${overdue.length===1?'':'es'} vencido${overdue.length===1?'':'s'}`};
  if(open.length)return{key:'pending',label:'Pendiente',detail:`${open.length} mes${open.length===1?'':'es'} pendiente${open.length===1?'':'s'}`};
  if(list.length)return{key:'paid',label:'Al día',detail:'Sin mensualidades pendientes'};
  return{key:'neutral',label:'Sin cargos',detail:'No hay mensualidades generadas'};
}
function openPlayerFinancialDetail(playerId){
  const p=players.find(x=>x.id===playerId);
  if(!p)return;
  const list=playerCharges(p),stateInfo=playerFinancialState(p);
  const pending=list.filter(c=>['pending','partial'].includes(c.status));
  const paid=list.filter(c=>c.status==='paid');
  const balance=pending.reduce((sum,c)=>sum+Math.max(0,Number(c.amount||0)-Number(c.paidAmount||0)),0);
  $('#playerFinancialTitle').textContent=p.name;
  $('#playerFinancialSummary').innerHTML=[
    [stateInfo.label,'Estado actual'],
    [pending.length,'Meses pendientes'],
    [paid.length,'Meses pagados'],
    [money(balance),'Saldo pendiente']
  ].map(([v,l])=>`<article class="stat"><strong>${esc(v)}</strong><span>${esc(l)}</span></article>`).join('');
  $('#playerFinancialContent').innerHTML=list.map(c=>{
    const due=chargeDueState(c),remaining=Math.max(0,Number(c.amount||0)-Number(c.paidAmount||0));
    const dueText=due==='overdue'?'Vencida':statusLabel(c.status);
    return`<article class="panel"><div class="page-head compact-head"><div><span class="eyebrow">${esc(monthLabel(c.month||''))}</span><h4>${money(c.amount)}</h4></div><span class="badge ${due}">${esc(dueText)}</span></div><p>Pagado: <strong>${money(c.paidAmount||0)}</strong> · Saldo: <strong>${money(remaining)}</strong></p><p class="muted">Fecha límite: 15 de ${esc(monthLabel(c.month||''))}</p></article>`;
  }).join('')||'<p class="muted">No hay mensualidades generadas para esta jugadora.</p>';
  $('#playerFinancialDialog').showModal();
}
function renderPlayers(){
  const q=norm($('#playerSearch').value),cat=$('#playerCategoryFilter').value,st=$('#playerStatusFilter').value;
  if(!cat){
    $('#playersBody').innerHTML='<tr><td colspan="9"><div class="vc-empty-state"><div><strong>Selecciona una categoría</strong><span>Elige una categoría o “Todas las categorías” para mostrar las jugadoras.</span></div></div></td></tr>';
    return;
  }
  const list=players.filter(p=>(cat==='__all__'||playerCatIds(p).includes(cat))&&(!st||p.status===st)&&(!q||norm([p.playerCode,p.name,p.phone,p.email,...(p.guardians||[]).flatMap(g=>[g.name,g.phone,g.phone2])].join(' ')).includes(q)));
  $('#playersBody').innerHTML=list.map(p=>{
    const financial=playerFinancialState(p),insurance=playerInsuranceState(p);
    return`<tr><td><strong>${esc(p.playerCode)}</strong></td><td><strong>${esc(p.name)}</strong><div class="muted">${esc(p.birthdate||'')}</div></td><td><strong>Jugadora de:</strong> ${esc(primaryCategoryName(p))}<div class="muted"><strong>Refuerza:</strong> ${esc(reinforcementCategoryNames(p))}</div></td><td>${guardianHTML(p)}</td><td>${(p.linkedUserIds||[]).map(id=>`<span class="chip">${esc(userName(id))}</span>`).join('')||'—'}</td><td>${isFirstDivisionPrimary(p)?'—':money(playerMonthlyFee(p))}</td><td><span class="badge ${financial.key}">${esc(financial.label)}</span><div class="muted">${esc(financial.detail)}</div>${isFirstDivisionPrimary(p)?'':`<button class="action" data-player-finances="${p.id}">Revisar meses</button>`}</td><td><span class="badge ${p.status}">${statusLabel(p.status)}</span><div><span class="badge ${insurance.key}">${esc(insurance.label)}</span></div></td><td><div class="actions"><button class="action" data-view-player="${p.id}">Ver ficha</button><button class="action" data-edit-player="${p.id}">Editar</button></div></td></tr>`;
  }).join('')||'<tr><td colspan="9">No hay jugadoras para los filtros seleccionados.</td></tr>';
}
function renderCategories(){$('#categoriesBody').innerHTML=categories.map(c=>`<tr><td><strong>${esc(c.name)}</strong><div class="muted">${esc(seasonName(c.seasonId))}</div></td><td>${esc(c.ageGroup||'—')}${c.teamColor?`<div class="muted">${esc(c.teamColor)}</div>`:''}</td><td>${esc(c.coach||'—')}<div class="muted">${esc(c.assistant||'')}</div></td><td>${esc(c.schedule||daysLabel(trainingSeries.filter(t=>t.categoryId===c.id&&t.status==='active').flatMap(t=>t.days||[]))||'—')}</td><td>${esc(venueName(c.venueId))}${venueLinks(c.venueId)}</td><td>${money(c.fee)}</td><td><span class="badge ${c.status}">${statusLabel(c.status)}</span></td><td><button class="action" data-view-category="${c.id}">Ver ficha</button><button class="action" data-edit-category="${c.id}">Editar</button></td></tr>`).join('')||'<tr><td colspan="8">No hay categorías.</td></tr>'}
function renderSeasons(){const el=$('#seasonsList');if(!el)return;el.innerHTML=seasons.map(s=>`<article class="panel"><div class="page-head compact-head"><div><span class="eyebrow">${s.isCurrent?'TEMPORADA ACTUAL':'TEMPORADA'}</span><h3>${esc(s.name)}</h3></div><span class="badge ${s.status}">${statusLabel(s.status)}</span></div><p>${esc(s.startDate)} — ${esc(s.endDate)}</p><button class="action" data-edit-season="${s.id}">Editar</button></article>`).join('')||'<p class="muted">No hay temporadas. Crea la temporada actual antes de programar entrenamientos.</p>'}
function renderTrainings(){const cat=$('#trainingCategoryFilter').value,se=$('#trainingSeasonFilter').value;const list=trainingSeries.filter(t=>(!cat||t.categoryId===cat)&&(!se||t.seasonId===se));$('#trainingsList').innerHTML=list.map(t=>{const next=occurrences(t,today(),datePlus(today(),60)).filter(o=>o.status!=='cancelled').slice(0,4);return`<article class="panel"><div class="page-head compact-head"><div><span class="eyebrow">${esc(catName(t.categoryId))} · ${esc(seasonName(t.seasonId))}</span><h3>${esc(daysLabel(t.days))}</h3></div><span class="badge ${t.status}">${statusLabel(t.status)}</span></div><p><strong>${esc(t.startTime)} – ${esc(t.endTime)}</strong> · ${esc(venueName(t.venueId))}</p><p>${esc(t.startDate)} a ${esc(t.endDate)}</p>${venueLinks(t.venueId)}<div class="mini-list">${next.map(o=>`<div>${esc(o.date)} · ${esc(o.startTime)}${o.status==='changed'?' · Modificado':''}</div>`).join('')||'<span class="muted">Sin próximas fechas.</span>'}</div><div class="actions"><button class="action" data-edit-training="${t.id}">Editar serie</button><button class="action" data-training-exception="${t.id}">Cambiar/cancelar fecha</button><button class="action" data-training-future="${t.id}">Cambiar siguientes</button></div></article>`}).join('')||'<p class="muted">No hay entrenamientos recurrentes.</p>'}
function renderFamilyTrainings(){const list=familyTrainingSeries;$('#familyTrainingsList').innerHTML=list.map(t=>{const upcomingExceptions=familyTrainingExceptions.filter(x=>x.seriesId===t.id&&x.date>=today()).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,5);return`<article class="panel"><span class="eyebrow">${esc(catName(t.categoryId))} · ${esc(seasonName(t.seasonId))}</span><h3>${esc(daysLabel(t.days))}</h3><p><strong>${esc(t.startTime)} – ${esc(t.endTime)}</strong></p><p>${esc(venueName(t.venueId))}</p>${venueLinks(t.venueId)}${upcomingExceptions.length?`<h4>Próximos cambios</h4>${upcomingExceptions.map(x=>`<div class="recent-item"><div><strong>${esc(x.date)}</strong><div class="muted">${x.action==='cancelled'?'Cancelado':`${esc(x.startTime||t.startTime)} – ${esc(x.endTime||t.endTime)} · ${esc(venueName(x.venueId||t.venueId))}`}</div></div><span class="badge ${x.action}">${statusLabel(x.action)}</span></div>`).join('')}`:''}</article>`}).join('')||'<p class="muted">No hay entrenamientos configurados para tus categorías.</p>'}
function renderEvents(){const cat=$('#eventCategoryFilter').value,tp=$('#eventTypeFilter').value,se=$('#eventSeasonFilter').value;const list=events.filter(e=>(!cat||e.categoryId===cat)&&(!tp||e.type===tp)&&(!se||e.seasonId===se));$('#eventsList').innerHTML=list.map(e=>`<article class="panel event-card"><div><span class="eyebrow">${typeLabel(e.type)} · ${esc(catName(e.categoryId))} · ${esc(seasonName(e.seasonId))}</span><h3>${esc(e.title)}</h3><p><strong>${esc(e.date)}</strong> · ${esc(e.startTime||'')} ${e.endTime?'– '+esc(e.endTime):''}</p><p>${esc(venueName(e.venueId))}${e.opponent?' · Rival: '+esc(e.opponent):''}</p>${venueLinks(e.venueId)}<p class="muted">${esc(e.notes||'')}</p></div><div><span class="badge ${e.status}">${statusLabel(e.status)}</span><div class="actions"><button class="action" data-edit-event="${e.id}">Editar</button><button class="action danger-action" data-delete-event="${e.id}">Eliminar</button></div></div></article>`).join('')||'<p class="muted">No hay eventos.</p>'}
function renderVenues(){$('#venuesList').innerHTML=venues.map(v=>`<article class="panel"><h3>${esc(v.name)}</h3><p>${esc(v.address)}</p><p class="muted">${esc(v.directions||'')}</p>${venueLinks(v.id)}<button class="action" data-edit-venue="${v.id}">Editar</button></article>`).join('')||'<p class="muted">No hay lugares registrados.</p>'}
function renderAnnouncements(){$('#announcementsList').innerHTML=announcements.map(a=>`<article class="panel"><div class="page-head compact-head"><div><span class="eyebrow">${a.categoryId?esc(catName(a.categoryId)):'Todas las categorías'}</span><h3>${esc(a.title)}</h3></div><span class="badge ${a.status}">${statusLabel(a.status)}</span></div><p>${esc(a.body)}</p><button class="action" data-edit-announcement="${a.id}">Editar</button></article>`).join('')||'<p class="muted">No hay comunicados.</p>'}
function renderCharges(){
  const mo=$('#chargeMonthFilter').value,cat=$('#chargeCategoryFilter').value,st=$('#chargeStatusFilter').value;
  const list=charges.filter(c=>{
    const p=players.find(x=>x.id===c.playerId);
    const categoryMatch=!cat||(p&&playerCatIds(p).includes(cat))||c.categoryId===cat;
    const dueState=chargeDueState(c);
    const statusMatch=!st||(st==='overdue'?dueState==='overdue':st==='pending'?(c.status==='pending'&&dueState!=='overdue'):c.status===st);
    return (!mo||c.month===mo)&&categoryMatch&&statusMatch;
  });
  const total=list.reduce((s,c)=>s+Number(c.amount||0),0),paid=list.reduce((s,c)=>s+Number(c.paidAmount||0),0),overdue=list.filter(c=>chargeDueState(c)==='overdue').length;
  $('#financeSummary').innerHTML=[[money(total),'Total generado'],[money(paid),'Pagado'],[money(total-paid),'Pendiente'],[overdue,'Morosos'],[list.length,'Cargos']].map(([v,l])=>`<article class="stat"><strong>${v}</strong><span>${l}</span></article>`).join('');
  $('#chargesBody').innerHTML=list.map(c=>{const p=players.find(x=>x.id===c.playerId),due=chargeDueState(c),label=due==='overdue'?'Morosa':statusLabel(c.status);return`<tr><td><strong>${esc(playerName(c.playerId))}</strong><div class="muted">${esc(c.playerCode||'')}</div></td><td>${esc(p?catNames(p):catName(c.categoryId))}</td><td>${esc(c.month)}</td><td>${money(c.amount)}</td><td>${money(c.paidAmount)}</td><td><span class="badge ${due}">${esc(label)}</span>${due==='overdue'?`<div class="muted">Venció el 15</div>`:''}</td><td><button class="action" data-edit-charge="${c.id}">Editar</button></td></tr>`}).join('')||'<tr><td colspan="7">No hay mensualidades para los filtros seleccionados.</td></tr>';
}
function sinpeReportMonth(s){return s.month||String(s.date||'').slice(0,7)}
function sinpeReportCategoryId(s){const p=players.find(x=>x.id===s.playerId);return p?.categoryId||p?.categoryIds?.[0]||''}
function paymentMethodValue(s){return s.paymentMethod||'sinpe'}
function paymentMethodLabel(method){return method==='transfer'?'Transferencia bancaria':'SINPE'}
function paymentApprovedDate(s){
  if(s.approvedAt?.toDate)return s.approvedAt.toDate().toISOString().slice(0,10);
  if(s.approvedAt?.seconds)return new Date(s.approvedAt.seconds*1000).toISOString().slice(0,10);
  return '';
}
function paymentMonthOptions(){
  const currentYear=new Date().getFullYear();
  const recordYears=sinpeReports.map(sinpeReportMonth).filter(m=>/^\d{4}-\d{2}$/.test(m)).map(m=>Number(m.slice(0,4)));
  const years=[...new Set([currentYear,...recordYears])].sort((a,b)=>b-a);
  return years.flatMap(year=>Array.from({length:12},(_,i)=>`${year}-${String(i+1).padStart(2,'0')}`));
}
function populatePaymentReportControls(){
  const category=$('#paymentReportCategory'),monthsBox=$('#paymentReportMonths');
  if(!category||!monthsBox)return;
  const selectedCategory=category.value;
  category.innerHTML='<option value="">Todas las categorías</option>'+categories.filter(c=>c.status==='active').map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');
  if([...category.options].some(o=>o.value===selectedCategory))category.value=selectedCategory;

  const previousSelected=new Set($$('#paymentReportMonths input:checked').map(i=>i.value));
  const months=paymentMonthOptions();
  monthsBox.innerHTML=months.map(m=>`<label class="multi-select-option"><input type="checkbox" value="${m}" ${previousSelected.size?previousSelected.has(m)?'checked':'':m===monthNow()?'checked':''}><span>${esc(monthLabel(m))}</span></label>`).join('');
  updatePaymentMonthsLabel();
}
function selectedPaymentReportMonths(){
  return $$('#paymentReportMonths input:checked').map(i=>i.value);
}
function updatePaymentMonthsLabel(){
  const selected=selectedPaymentReportMonths();
  const label=$('#paymentReportMonthsLabel');
  if(!label)return;
  if(!selected.length)label.textContent='Seleccionar meses';
  else if(selected.length===1)label.textContent=monthLabel(selected[0]);
  else label.textContent=`${selected.length} meses seleccionados`;
}
function togglePaymentMonthsMenu(force){
  const menu=$('#paymentReportMonthsMenu'),toggle=$('#paymentReportMonthsToggle');
  if(!menu||!toggle)return;
  const shouldOpen=typeof force==='boolean'?force:menu.classList.contains('hidden');
  menu.classList.toggle('hidden',!shouldOpen);
  toggle.setAttribute('aria-expanded',String(shouldOpen));
}

function populatePaymentsInboxFilters(){
  const category=$('#paymentsInboxCategory');
  if(category){
    const selected=category.value;
    category.innerHTML='<option value="">Todas las categorías</option>'+categories.filter(c=>c.status==='active').map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');
    if([...category.options].some(o=>o.value===selected))category.value=selected;
  }
}
function filteredPaymentsInbox(){
  const q=norm($('#paymentsInboxSearch')?.value||'');
  const category=$('#paymentsInboxCategory')?.value||'';
  const method=$('#paymentsInboxMethod')?.value||'';
  const status=$('#paymentsInboxStatus')?.value||'reported';
  return sinpeReports.filter(s=>{
    const p=players.find(x=>x.id===s.playerId);
    const family=families.find(f=>(f.playerIds||[]).includes(s.playerId));
    if(category&&sinpeReportCategoryId(s)!==category)return false;
    if(method&&paymentMethodValue(s)!==method)return false;
    if(status&&s.status!==status)return false;
    if(q&&!norm([playerName(s.playerId),family?.name,s.reference,s.payerName,s.bank,s.phone].join(' ')).includes(q))return false;
    return true;
  }).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
}
function renderPaymentsInbox(){
  populatePaymentsInboxFilters();
  const list=filteredPaymentsInbox();
  const pendingCount=sinpeReports.filter(s=>s.status==='reported').length;
  $('#paymentsInboxCount').textContent=`${pendingCount} pendiente${pendingCount===1?'':'s'}`;
  $('#paymentsInboxList').innerHTML=list.map(s=>{
    const family=families.find(f=>(f.playerIds||[]).includes(s.playerId));
    return`<article class="panel"><div class="page-head compact-head"><div><span class="eyebrow">${esc(paymentMethodLabel(paymentMethodValue(s)))} · ${esc(monthLabel(sinpeReportMonth(s)))} · ${esc(catName(sinpeReportCategoryId(s)))}</span><h3>${esc(playerName(s.playerId))} — ${money(s.amount)}</h3></div><span class="badge ${s.status}">${esc(statusLabel(s.status))}</span></div><p>Familia: <strong>${esc(family?.name||'Sin familia')}</strong></p><p>Banco: <strong>${esc(s.bank||'—')}</strong> · Comprobante: <strong>${esc(s.reference||'—')}</strong></p><p>Pagador: ${esc(s.payerName||'—')} ${s.phone?`· Teléfono: ${esc(s.phone)}`:''}</p><p class="muted">${esc(s.notes||'')}</p>${s.status==='reported'?`<div class="actions"><button class="btn primary" data-approve-sinpe="${s.id}">Aprobar</button><button class="btn secondary" data-reject-sinpe="${s.id}">Rechazar</button></div>`:''}</article>`;
  }).join('')||'<p class="muted">No hay pagos para los filtros seleccionados.</p>';
}

function paymentReportType(){return $('#paymentReportType')?.value||'payments'}
function updatePaymentReportStatusOptions(){
  const select=$('#paymentReportStatus');
  if(!select)return;
  const current=select.value;
  if(paymentReportType()==='charges'){
    select.innerHTML='<option value="">Todos los estados</option><option value="paid">Pagada</option><option value="pending">Pendiente</option><option value="partial">Parcial</option><option value="overdue">Vencida</option><option value="exempt">Exonerada</option>';
  }else{
    select.innerHTML='<option value="">Todos los estados</option><option value="reported">Pendiente de revisión</option><option value="approved">Aprobado</option><option value="rejected">Rechazado</option>';
  }
  if([...select.options].some(o=>o.value===current))select.value=current;
}
function monthlyReportRows(){
  const category=$('#paymentReportCategory')?.value||'';
  const status=$('#paymentReportStatus')?.value||'';
  const periodType=$('#paymentReportPeriodType')?.value||'months';
  const selectedMonths=selectedPaymentReportMonths();
  const dateFrom=$('#paymentReportDateFrom')?.value||'';
  const dateTo=$('#paymentReportDateTo')?.value||'';
  return charges.filter(c=>{
    const p=players.find(x=>x.id===c.playerId);
    if(category&&!playerCatIds(p||{}).includes(category))return false;
    if(periodType==='months'&&!selectedMonths.includes(c.month))return false;
    if(periodType==='range'){
      const chargeDate=`${c.month||''}-01`;
      if(dateFrom&&chargeDate<dateFrom)return false;
      if(dateTo&&chargeDate>dateTo)return false;
    }
    const due=chargeDueState(c);
    if(status==='overdue')return due==='overdue';
    if(status&&c.status!==status)return false;
    return true;
  }).sort((a,b)=>(a.month||'').localeCompare(b.month||''));
}
function paymentReportRows(){
  const category=$('#paymentReportCategory')?.value||'';
  const status=$('#paymentReportStatus')?.value||'';
  const method=$('#paymentReportMethod')?.value||'';
  const periodType=$('#paymentReportPeriodType')?.value||'months';
  const selectedMonths=selectedPaymentReportMonths();
  const dateFrom=$('#paymentReportDateFrom')?.value||'';
  const dateTo=$('#paymentReportDateTo')?.value||'';
  return sinpeReports.filter(s=>{
    if(category&&sinpeReportCategoryId(s)!==category)return false;
    if(status&&s.status!==status)return false;
    if(method&&paymentMethodValue(s)!==method)return false;
    if(periodType==='months')return selectedMonths.includes(sinpeReportMonth(s));
    if(dateFrom&&String(s.date||'')<dateFrom)return false;
    if(dateTo&&String(s.date||'')>dateTo)return false;
    return true;
  }).sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));
}
function renderGeneratedPaymentReport(){
  const list=generatedPaymentReport;
  const reportType=paymentReportType();
  if(reportType==='charges'){
    const pending=list.filter(c=>c.status==='pending').length;
    const partial=list.filter(c=>c.status==='partial').length;
    const overdue=list.filter(c=>chargeDueState(c)==='overdue').length;
    const paid=list.filter(c=>c.status==='paid').length;
    const balance=list.reduce((sum,c)=>sum+Math.max(0,Number(c.amount||0)-Number(c.paidAmount||0)),0);
    $('#sinpeSummary').innerHTML=[[list.length,'Mensualidades'],[pending,'Pendientes'],[partial,'Parciales'],[overdue,'Vencidas'],[paid,'Pagadas'],[money(balance),'Saldo pendiente']].map(([v,l])=>`<article class="stat"><strong>${v}</strong><span>${l}</span></article>`).join('');
    $('#sinpeAdminList').innerHTML=list.map(c=>{
      const p=players.find(x=>x.id===c.playerId),family=families.find(f=>(f.playerIds||[]).includes(c.playerId));
      const due=chargeDueState(c),remaining=Math.max(0,Number(c.amount||0)-Number(c.paidAmount||0));
      const state=due==='overdue'?'Vencida':statusLabel(c.status);
      return`<article class="panel"><div class="page-head compact-head"><div><span class="eyebrow">${esc(catNames(p||{}))} · ${esc(monthLabel(c.month||''))}</span><h3>${esc(playerName(c.playerId))} — ${money(c.amount)}</h3></div><span class="badge ${due}">${esc(state)}</span></div><p>Familia: <strong>${esc(family?.name||'Sin familia')}</strong></p><p>Pagado: <strong>${money(c.paidAmount||0)}</strong> · Saldo: <strong>${money(remaining)}</strong> · Fecha límite: 15 de ${esc(monthLabel(c.month||''))}</p></article>`;
    }).join('')||'<p class="muted">No hay mensualidades para los criterios seleccionados.</p>';
  }else{
    const pending=list.filter(s=>s.status==='reported').length;
    const approved=list.filter(s=>s.status==='approved').length;
    const rejected=list.filter(s=>s.status==='rejected').length;
    const approvedTotal=list.filter(s=>s.status==='approved').reduce((sum,s)=>sum+Number(s.amount||0),0);
    $('#sinpeSummary').innerHTML=[[list.length,'Pagos reportados'],[pending,'Pendientes'],[approved,'Aprobados'],[rejected,'Rechazados'],[money(approvedTotal),'Ingresos aprobados']].map(([v,l])=>`<article class="stat"><strong>${v}</strong><span>${l}</span></article>`).join('');
    $('#sinpeAdminList').innerHTML=list.map(s=>`<article class="panel"><div class="page-head compact-head"><div><span class="eyebrow">${esc(catName(sinpeReportCategoryId(s)))} · ${esc(monthLabel(sinpeReportMonth(s)))} · ${esc(paymentMethodLabel(paymentMethodValue(s)))} · ${esc(s.date||'')}</span><h3>${esc(playerName(s.playerId))} — ${money(s.amount)}</h3></div><span class="badge ${s.status}">${statusLabel(s.status)}</span></div><p>Banco: <strong>${esc(s.bank||'—')}</strong> · Comprobante: <strong>${esc(s.reference)}</strong> · Pagador: ${esc(s.payerName)}</p><p class="muted">${s.phone?`Teléfono: ${esc(s.phone)} · `:''}${esc(s.notes||'')}</p>${s.status==='approved'?`<p class="payment-meta">Aprobado el ${esc(paymentApprovedDate(s)||'—')}</p>`:''}${s.status==='reported'?`<div class="actions"><button class="btn primary" data-approve-sinpe="${s.id}">Aprobar</button><button class="btn secondary" data-reject-sinpe="${s.id}">Rechazar</button></div>`:''}</article>`).join('')||'<p class="muted">No hay pagos para los criterios seleccionados.</p>';
  }
  const download=$('#downloadPaymentsReportButton');
  if(download)download.disabled=!list.length;
}
function renderSinpeAdmin(){
  renderPaymentsInbox();
  populatePaymentReportControls();
  if(!generatedPaymentReport.length){
    $('#sinpeSummary').innerHTML='';
    $('#sinpeAdminList').innerHTML='<article class="panel"><p class="muted">Selecciona los criterios y presiona “Generar reporte” para ver los resultados.</p></article>';
    const download=$('#downloadPaymentsReportButton');
    if(download)download.disabled=true;
    return;
  }
  renderGeneratedPaymentReport();
}
function generatePaymentReport(){
  const periodType=$('#paymentReportPeriodType')?.value||'months';
  const dateFrom=$('#paymentReportDateFrom')?.value||'';
  const dateTo=$('#paymentReportDateTo')?.value||'';
  if(periodType==='months'&&!selectedPaymentReportMonths().length)return alert('Selecciona al menos un mes para generar el reporte.');
  if(periodType==='range'&&!dateFrom&&!dateTo)return alert('Selecciona al menos una fecha para generar el rango.');
  if(periodType==='range'&&dateFrom&&dateTo&&dateFrom>dateTo)return alert('La fecha inicial no puede ser posterior a la fecha final.');
  generatedPaymentReport=paymentReportType()==='charges'?monthlyReportRows():paymentReportRows();
  renderGeneratedPaymentReport();
}
function exportPaymentReports(){
  if(!generatedPaymentReport.length)return alert('Primero genera un reporte con resultados.');
  const periodType=$('#paymentReportPeriodType')?.value||'months';
  const suffix=periodType==='months'?(selectedPaymentReportMonths().join('_')||'meses'):`${$('#paymentReportDateFrom')?.value||'inicio'}-a-${$('#paymentReportDateTo')?.value||'fin'}`;
  if(paymentReportType()==='charges'){
    downloadCSV(`reporte-mensualidades-${suffix}.csv`,generatedPaymentReport.map(c=>{
      const p=players.find(x=>x.id===c.playerId),family=families.find(f=>(f.playerIds||[]).includes(c.playerId));
      const due=chargeDueState(c),remaining=Math.max(0,Number(c.amount||0)-Number(c.paidAmount||0));
      return{
        Mes:c.month||'',
        Jugadora:playerName(c.playerId),
        Familia:family?.name||'',
        Categoría:catNames(p||{}),
        Monto:Number(c.amount||0),
        Pagado:Number(c.paidAmount||0),
        Saldo:remaining,
        Estado:due==='overdue'?'Vencida':statusLabel(c.status),
        'Fecha límite':c.month?`${c.month}-15`:''
      };
    }));
  }else{
    downloadCSV(`reporte-pagos-${suffix}.csv`,generatedPaymentReport.map(s=>({
      Fecha:s.date||'',
      Mes:sinpeReportMonth(s),
      Jugadora:playerName(s.playerId),
      Familia:families.find(f=>(f.playerIds||[]).includes(s.playerId))?.name||'',
      Categoría:catName(sinpeReportCategoryId(s)),
      Método:paymentMethodLabel(paymentMethodValue(s)),
      Banco:s.bank||'',
      Comprobante:s.reference||'',
      Monto:Number(s.amount||0),
      Estado:statusLabel(s.status),
      'Fecha de aprobación':paymentApprovedDate(s),
      'Aprobado por':s.approvedBy?userName(s.approvedBy):'',
      Pagador:s.payerName||'',
      Teléfono:s.phone||'',
      Observaciones:s.notes||''
    })));
  }
}
function updatePaymentReportPeriodControls(){
  const byRange=$('#paymentReportPeriodType')?.value==='range';
  $('#paymentReportMonthsBox')?.classList.toggle('hidden',byRange);
  $('#paymentReportDateFrom')?.classList.toggle('hidden',!byRange);
  $('#paymentReportDateTo')?.classList.toggle('hidden',!byRange);
}
function populateFamilyCategoryFilter(){
  const filter=$('#familyCategoryFilter');
  if(!filter)return;
  const selected=filter.value;
  filter.innerHTML='<option value="">Todas las categorías</option>'+categories.filter(c=>c.status==='active').map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');
  if([...filter.options].some(o=>o.value===selected))filter.value=selected;
}
function familyMatchesCategory(f,categoryId){
  if(!categoryId)return true;
  return (f.playerIds||[]).some(id=>playerCatIds(players.find(p=>p.id===id)||{}).includes(categoryId));
}

function trainerLevelLabel(level){return level==='coordinator'?'Coordinador deportivo':level==='assistant'?'Asistente':'Entrenador principal'}
function isCoachingRole(role){return ['trainer','assistant'].includes(role)}
function isPendingCoachingRole(role){return ['pendingTrainer','pendingAssistant'].includes(role)}
function pendingRoleLabel(role){return role==='pendingAssistant'?'Asistente pendiente':'Entrenador pendiente'}

function assignedCategoryNames(u){return (u.assignedCategoryIds||[]).map(catName).join(', ')||'Sin categorías asignadas'}

function attendanceDocId(categoryId,date){return `${categoryId}_${date}`}
function attendancePlayersForCategory(categoryId,sourcePlayers=players){return sourcePlayers.filter(p=>p.status==='active'&&playerCatIds(p).includes(categoryId)).sort((a,b)=>(a.name||'').localeCompare(b.name||''))}
function attendanceRecord(categoryId,date){return attendanceRecords.find(r=>r.categoryId===categoryId&&r.date===date)}
function absenceReasons(){return ['Enfermedad','Lesión','Estudio','Viaje','Permiso','Otro']}
function attendanceRowHTML(p,entry,prefix){
  const status=entry?.status||'present';
  const justification=entry?.justification||((entry?.reason||entry?.note)?'justified':'unjustified');
  const reason=entry?.reason||'',note=entry?.note||'';
  return `<div class="attendance-row" data-player-id="${p.id}">
    <div><strong>${esc(p.name)}</strong><div class="muted">${esc(p.playerCode||'')}</div></div>
    <div class="attendance-actions">
      <label class="attendance-choice"><input type="radio" name="${prefix}-${p.id}" value="present" ${status!=='absent'?'checked':''}> Asistió</label>
      <label class="attendance-choice"><input type="radio" name="${prefix}-${p.id}" value="absent" ${status==='absent'?'checked':''}> No asistió</label>
    </div>
    <div class="attendance-absence ${status==='absent'?'':'hidden'}">
      <label class="attendance-choice"><input type="radio" name="${prefix}-just-${p.id}" value="justified" ${justification==='justified'?'checked':''}> Justificada</label>
      <label class="attendance-choice"><input type="radio" name="${prefix}-just-${p.id}" value="unjustified" ${justification==='unjustified'?'checked':''}> Injustificada</label>
      <select class="attendance-reason ${justification==='justified'?'':'hidden'}"><option value="">Motivo</option>${absenceReasons().map(x=>`<option value="${x}" ${x===reason?'selected':''}>${x}</option>`).join('')}</select>
      <input class="attendance-note" value="${esc(note)}" placeholder="Observación opcional">
    </div>
  </div>`;
}
function bindAttendanceRoster(containerId,prefix){
  const container=$('#'+containerId);if(!container)return;
  container.onchange=e=>{
    const row=e.target.closest('.attendance-row');if(!row)return;
    if(e.target.name===`${prefix}-${row.dataset.playerId}`){
      row.querySelector('.attendance-absence')?.classList.toggle('hidden',e.target.value!=='absent');
    }
    if(e.target.name===`${prefix}-just-${row.dataset.playerId}`){
      const isJust=e.target.value==='justified';
      row.querySelector('.attendance-reason')?.classList.toggle('hidden',!isJust);
      if(!isJust)row.querySelector('.attendance-reason').value='';
    }
  };
}
function loadAttendanceRoster(prefix,{trainer=false}={}){
  const categoryId=$('#'+prefix+'Category')?.value||'',date=$('#'+prefix+'Date')?.value||today();
  if(!categoryId)return alert('Selecciona una categoría.');
  if(trainer&&!(profile.assignedCategoryIds||[]).includes(categoryId))return alert('No tienes permiso para esta categoría.');
  const source=trainer?trainerPlayers:players,roster=attendancePlayersForCategory(categoryId,source),record=attendanceRecord(categoryId,date),entries=new Map((record?.entries||[]).map(e=>[e.playerId,e]));
  const containerId=prefix==='trainerAttendance'?'trainerAttendanceRoster':'attendanceRoster';
  $('#'+containerId).innerHTML=roster.map(p=>attendanceRowHTML(p,entries.get(p.id),prefix)).join('')||'<p class="muted">No hay jugadoras activas en esta categoría.</p>';
  bindAttendanceRoster(containerId,prefix);
}
function markAllAttendancePresent(prefix){
  const containerId=prefix==='trainerAttendance'?'trainerAttendanceRoster':'attendanceRoster';
  $$('#'+containerId+' .attendance-row').forEach(row=>{
    const radio=row.querySelector('input[value="present"]');if(radio)radio.checked=true;
    row.querySelector('.attendance-absence')?.classList.add('hidden');
  });
}
async function saveAttendance(prefix,{trainer=false}={}){
  const categoryId=$('#'+prefix+'Category')?.value||'',date=$('#'+prefix+'Date')?.value||today();
  if(!categoryId)return alert('Selecciona una categoría.');
  if(trainer&&!(profile.assignedCategoryIds||[]).includes(categoryId))return alert('No tienes permiso para esta categoría.');
  const containerId=prefix==='trainerAttendance'?'trainerAttendanceRoster':'attendanceRoster',rows=$$('#'+containerId+' .attendance-row');
  if(!rows.length)return alert('Carga primero el roster.');
  const entries=rows.map(row=>{
    const playerId=row.dataset.playerId;
    const status=row.querySelector(`input[name="${prefix}-${playerId}"]:checked`)?.value||'present';
    const justification=status==='absent'?(row.querySelector(`input[name="${prefix}-just-${playerId}"]:checked`)?.value||'unjustified'):'';
    return {playerId,status,justification,reason:status==='absent'&&justification==='justified'?(row.querySelector('.attendance-reason')?.value||''):'',note:status==='absent'?(row.querySelector('.attendance-note')?.value.trim()||''):''};
  });
  const id=attendanceDocId(categoryId,date),payload={orgId:ORG_ID,categoryId,date,entries,recordedBy:auth.currentUser.uid,updatedAt:serverTimestamp()};
  const existing=attendanceRecord(categoryId,date);
  if(existing)await updateDoc(doc(db,'attendanceRecords',existing.id),payload);
  else await setDoc(doc(db,'attendanceRecords',id),{...payload,createdAt:serverTimestamp()});
  const fresh={id,...payload};attendanceRecords=attendanceRecords.filter(r=>!(r.categoryId===categoryId&&r.date===date));attendanceRecords.push(fresh);
  toast('Asistencia guardada.');
  renderAttendanceSummary(prefix,{trainer});
}
function attendanceSummaryRows(categoryId,month,sourcePlayers=players){
  const roster=attendancePlayersForCategory(categoryId,sourcePlayers),records=attendanceRecords.filter(r=>r.categoryId===categoryId&&r.date?.startsWith(month));
  return roster.map(p=>{
    const entries=records.map(r=>(r.entries||[]).find(e=>e.playerId===p.id)).filter(Boolean),present=entries.filter(e=>e.status==='present').length,absent=entries.filter(e=>e.status==='absent').length,total=entries.length;
    const justified=entries.filter(e=>e.status==='absent'&&e.justification==='justified').length;
    const unjustified=entries.filter(e=>e.status==='absent'&&e.justification!=='justified').length;
    return {player:p,total,present,absent,justified,unjustified,percent:total?Math.round(present*100/total):0};
  });
}
function renderAttendanceSummary(prefix,{trainer=false}={}){
  const categoryId=$('#'+prefix+'Category')?.value||'',month=$('#'+prefix+'SummaryMonth')?.value||monthNow(),target=prefix==='trainerAttendance'?'trainerAttendanceSummary':'attendanceSummary';
  if(!categoryId){$('#'+target).innerHTML='<p class="muted">Selecciona una categoría para ver el resumen.</p>';return}
  const rows=attendanceSummaryRows(categoryId,month,trainer?trainerPlayers:players);
  $('#'+target).innerHTML=`<div class="table-wrap"><table><thead><tr><th>Jugadora</th><th>Registros</th><th>Presentes</th><th>Ausentes</th><th>Justificadas</th><th>Injustificadas</th><th>% asistencia</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.player.name)}</td><td>${r.total}</td><td>${r.present}</td><td>${r.absent}</td><td>${r.justified}</td><td>${r.unjustified}</td><td><strong>${r.percent}%</strong></td></tr>`).join('')||'<tr><td colspan="7">Sin registros.</td></tr>'}</tbody></table></div>`;
}
function setupAttendanceView(prefix,{trainer=false}={}){
  const cat=$('#'+prefix+'Category'),date=$('#'+prefix+'Date'),month=$('#'+prefix+'SummaryMonth');
  if(!cat)return;
  const allowed=trainer?categories.filter(c=>(profile.assignedCategoryIds||[]).includes(c.id)):categories.filter(c=>c.status==='active');
  const selected=cat.value;cat.innerHTML='<option value="">Selecciona categoría</option>'+allowed.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');if(allowed.some(c=>c.id===selected))cat.value=selected;
  if(!date.value)date.value=today();if(!month.value)month.value=monthNow();
  renderAttendanceSummary(prefix,{trainer});
}
function renderAttendance(){setupAttendanceView('attendance',{trainer:false})}
function renderTrainerAttendance(){setupAttendanceView('trainerAttendance',{trainer:true})}
function exportAttendanceCSV(){
  const categoryId=$('#attendanceCategory').value,month=$('#attendanceSummaryMonth').value||monthNow();
  if(!categoryId)return alert('Selecciona una categoría.');
  const rows=attendanceSummaryRows(categoryId,month,players);
  downloadCSV(`asistencia-${catName(categoryId)}-${month}.csv`,rows.map(r=>({Jugadora:r.player.name,PlayerID:r.player.playerCode,Registros:r.total,Presentes:r.present,Ausentes:r.absent,Justificadas:r.justified,Injustificadas:r.unjustified,'Porcentaje asistencia':`${r.percent}%`})));
}

function renderTrainers(){
  const pending=allUsers.filter(u=>isPendingCoachingRole(u.role)&&u.status==='pending');
  const active=trainerUsers.filter(u=>u.status==='active');
  $('#trainersSummary').innerHTML=[[pending.length,'Solicitudes pendientes'],[trainerUsers.length,'Personal deportivo'],[active.length,'Activos'],[trainerUsers.filter(u=>u.role==='trainer').length,'Entrenadores'],[trainerUsers.filter(u=>u.role==='assistant').length,'Asistentes']].map(([v,l])=>`<article class="stat"><strong>${v}</strong><span>${l}</span></article>`).join('');
  const pendingHTML=pending.length?`<div class="trainer-request-section"><div class="page-head compact-head"><div><span class="eyebrow">SOLICITUDES</span><h3>Pendientes de aprobación</h3></div></div>${pending.map(u=>`<article class="panel trainer-request-card"><div><span class="badge pending">Pendiente</span><h3>${esc(u.fullName||u.email)}</h3><p>${esc(u.email||'')} · ${esc(u.phone||'Sin teléfono')}</p><p class="muted">Solicitó registrarse como ${u.role==='pendingAssistant'?'asistente':'entrenador/a'}.</p></div><div class="actions"><button class="btn primary" data-approve-trainer="${u.id}">Revisar y aprobar</button><button class="btn secondary" data-reject-trainer="${u.id}">Rechazar</button></div></article>`).join('')}</div>`:'';
  const trainerHTML=trainerUsers.map(u=>`<article class="panel"><div class="page-head compact-head"><div><span class="eyebrow">${esc(u.role==='assistant'?'Asistente':trainerLevelLabel(u.trainerLevel))}</span><h3>${esc(u.fullName||u.email)}</h3></div><span class="badge ${u.status||'active'}">${esc(statusLabel(u.status||'active'))}</span></div><p><strong>Categorías:</strong> ${esc(assignedCategoryNames(u))}</p><p class="muted">Contactos: ${u.permissions?.viewContacts?'Sí':'No'} · Estado financiero general: ${u.permissions?.viewFinancialStatus?'Sí':'No'}</p><button class="btn secondary" data-edit-trainer="${u.id}">Editar permisos</button></article>`).join('');
  $('#trainersList').innerHTML=pendingHTML+(trainerHTML||(!pending.length?'<p class="muted">No hay entrenadores configurados.</p>':''));
}

function openTrainerEditor(u=null){
  const candidates=allUsers.filter(x=>!['admin','treasurer'].includes(x.role)&&x.status!=='rejected');
  $('#trainerUserId').innerHTML=candidates.map(x=>`<option value="${x.id}">${esc(x.fullName||x.email)} · ${esc(x.role||'family')}</option>`).join('');
  $('#trainerUserId').disabled=!!u;
  $('#trainerUserId').value=u?.id||candidates[0]?.id||'';
  $('#trainerRole').value=u?.role==='assistant'||u?.role==='pendingAssistant'?'assistant':'trainer';$('#trainerLevel').value=u?.role==='assistant'||u?.role==='pendingAssistant'?'assistant':u?.trainerLevel||'head';$('#trainerLevel').disabled=$('#trainerRole').value==='assistant';
  $('#trainerStatus').value=u?.status||'active';
  $('#trainerViewContacts').checked=!!u?.permissions?.viewContacts;
  $('#trainerViewFinancial').checked=!!u?.permissions?.viewFinancialStatus;
  $('#trainerCategoriesEditor').innerHTML=categories.filter(c=>c.status==='active').map(c=>`<label class="check-item"><input type="checkbox" value="${c.id}" ${(u?.assignedCategoryIds||[]).includes(c.id)?'checked':''}><span>${esc(c.name)}</span></label>`).join('');
  $('#trainerForm').dataset.editId=u?.id||'';
  $('#trainerDialog').showModal();
}
$('#trainerForm').onsubmit=async e=>{
  e.preventDefault();
  const uid=e.currentTarget.dataset.editId||$('#trainerUserId').value;
  const assignedCategoryIds=$$('#trainerCategoriesEditor input:checked').map(x=>x.value);
  if(!uid)return alert('Selecciona un usuario.');
  if(!assignedCategoryIds.length)return alert('Selecciona al menos una categoría.');
  const selectedRole=$('#trainerRole').value;
  await updateDoc(doc(db,'users',uid),{
    role:selectedRole,
    accountType:selectedRole==='assistant'?'assistant':'trainer',
    trainerLevel:selectedRole==='assistant'?'assistant':$('#trainerLevel').value,
    assignedCategoryIds,
    permissions:{viewContacts:$('#trainerViewContacts').checked,viewFinancialStatus:$('#trainerViewFinancial').checked},
    status:$('#trainerStatus').value,
    updatedAt:serverTimestamp()
  });
  $('#trainerDialog').close();
  toast('Perfil de entrenador actualizado.');
};
$('#trainerRole').onchange=()=>{const a=$('#trainerRole').value==='assistant';if(a)$('#trainerLevel').value='assistant';$('#trainerLevel').disabled=a;};
$('#newTrainerButton').onclick=()=>openTrainerEditor();

async function loadTrainerData(){
  const ids=profile.assignedCategoryIds||[];
  const [cs,vs,ss]=await Promise.all([
    col('categories',[where('orgId','==',ORG_ID)]),
    col('venues',[where('orgId','==',ORG_ID)]),
    col('seasons',[where('orgId','==',ORG_ID)])
  ]);
  categories=cs;venues=vs;seasons=ss;
  const merge=arrs=>[...new Map(arrs.flat().map(x=>[x.id,x])).values()];
  const [playerSets,trainingSets,eventSets,announcementSets,chargeSets,attendanceSets]=await Promise.all([
    Promise.all(ids.map(id=>col('players',[where('orgId','==',ORG_ID),where('categoryIds','array-contains',id)]))),
    Promise.all(ids.map(id=>col('trainingSeries',[where('orgId','==',ORG_ID),where('categoryId','==',id)]))),
    Promise.all(ids.map(id=>col('events',[where('orgId','==',ORG_ID),where('categoryId','==',id)]))),
    Promise.all(ids.map(id=>col('announcements',[where('orgId','==',ORG_ID),where('categoryId','==',id),where('status','==','published')]))),
    profile.permissions?.viewFinancialStatus?Promise.all(ids.map(id=>col('charges',[where('orgId','==',ORG_ID),where('categoryId','==',id)]))):Promise.resolve([]),
    Promise.all(ids.map(id=>col('attendanceRecords',[where('orgId','==',ORG_ID),where('categoryId','==',id)])))
  ]);
  trainerPlayers=merge(playerSets).sort((a,b)=>(a.name||'').localeCompare(b.name||''));
  trainerTrainingSeries=merge(trainingSets);
  trainerEvents=merge(eventSets).filter(e=>e.type!=='training').sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  trainerAnnouncements=merge(announcementSets).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
  trainerCharges=merge(chargeSets);attendanceRecords=merge(attendanceSets);
  populateTrainerSelectors();
  renderTrainerHome();
  await loadNotifications();
}
function populateTrainerSelectors(){
  const ids=profile.assignedCategoryIds||[];
  $('#trainerPlayerCategory').innerHTML='<option value="">Todas mis categorías</option>'+categories.filter(c=>ids.includes(c.id)).map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');
}
function trainerPlayerFinancialState(p){
  if(!profile.permissions?.viewFinancialStatus)return null;
  const list=trainerCharges.filter(c=>c.playerId===p.id);
  const open=list.filter(c=>['pending','partial'].includes(c.status));
  if(open.some(c=>chargeDueState(c)==='overdue'))return'Morosa';
  if(open.length)return'Pendiente';
  return list.length?'Al día':'Sin cargos';
}
function renderTrainerHome(){
  $('#trainerWelcome').textContent=`Bienvenido/a, ${profile.fullName||'Entrenador/a'}`;
  $('#trainerSummary').innerHTML=[[trainerPlayers.length,'Jugadoras'],[(profile.assignedCategoryIds||[]).length,'Categorías'],[trainerTrainingSeries.filter(t=>t.status==='active').length,'Horarios activos'],[trainerEvents.filter(e=>e.date>=today()).length,'Próximos eventos']].map(([v,l])=>`<article class="stat"><strong>${v}</strong><span>${l}</span></article>`).join('');
  $('#trainerUpcomingTrainings').innerHTML=trainerTrainingSeries.filter(t=>t.status==='active').slice(0,6).map(t=>`<div class="recent-item"><div><strong>${esc(catName(t.categoryId))}</strong><div class="muted">${esc(daysLabel(t.days||[]))} · ${esc(t.startTime||'')}–${esc(t.endTime||'')}</div></div></div>`).join('')||'<p class="muted">No hay entrenamientos configurados.</p>';
  $('#trainerUpcomingEvents').innerHTML=trainerEvents.filter(e=>e.date>=today()).slice(0,6).map(eventMini).join('')||'<p class="muted">No hay eventos próximos.</p>';
}
function renderTrainerPlayers(){
  const q=norm($('#trainerPlayerSearch').value),cat=$('#trainerPlayerCategory').value;
  const list=trainerPlayers.filter(p=>(!cat||playerCatIds(p).includes(cat))&&(!q||norm(`${p.name} ${p.playerCode}`).includes(q)));
  $('#trainerPlayersList').innerHTML=list.map(p=>{
    const contacts=profile.permissions?.viewContacts?(p.guardians||[]).map(g=>`${g.name}: ${g.phone||g.email||'—'}`).join(' · '):'Contactos restringidos';
    const financial=trainerPlayerFinancialState(p);
    return`<article class="panel"><div class="page-head compact-head"><div><span class="eyebrow">${esc(p.playerCode)} · ${esc(catNames(p))}</span><h3>${esc(p.name)}</h3></div><span class="badge ${p.status||'active'}">${esc(statusLabel(p.status||'active'))}</span></div><p>Número: ${esc(p.number||'—')} · Posición: ${esc(p.position||'—')}</p><p class="muted">${esc(contacts)}</p>${financial?`<p><strong>Estado financiero:</strong> ${esc(financial)}</p>`:''}<button class="btn secondary" data-view-player="${p.id}">Ver ficha</button></article>`;
  }).join('')||'<p class="muted">No hay jugadoras para los filtros seleccionados.</p>';
}
function renderTrainerTrainings(){
  $('#trainerTrainingsList').innerHTML=trainerTrainingSeries.map(t=>`<article class="panel"><span class="eyebrow">${esc(catName(t.categoryId))}</span><h3>${esc(daysLabel(t.days||[]))}</h3><p>${esc(t.startTime||'')}–${esc(t.endTime||'')} · ${esc(venueName(t.venueId))}</p></article>`).join('')||'<p class="muted">No hay entrenamientos asignados.</p>';
}
function trainerEventCard(e){
  const locationUrl=safeExternalUrl(e.locationUrl||'');
  return `<article class="panel trainer-event-card" data-trainer-event="${e.id}" role="button" tabindex="0">
    <div class="page-head compact-head">
      <div><span class="eyebrow">${esc(catName(e.categoryId))}</span><h3>${esc(e.title||typeLabel(e.type))}</h3></div>
      <span class="badge ${e.status||'scheduled'}">${esc(statusLabel(e.status||'scheduled'))}</span>
    </div>
    <p><strong>${esc(e.date||'')}</strong> ${e.startTime?`· ${esc(e.startTime)}`:''}${e.opponent?` · vs ${esc(e.opponent)}`:''}</p>
    <p class="muted">${esc(eventLocationName(e))} · Uniforme: ${esc(uniformLabel(e.uniform))}${locationUrl?' · Ubicación disponible':''}</p>
  </article>`;
}
function renderTrainerEvents(){
  const assigned=new Set((profile.assignedCategoryIds||[]).map(String));
  const visible=trainerEvents.filter(e=>assigned.has(String(e.categoryId))).sort((a,b)=>`${a.date||''} ${a.startTime||''}`.localeCompare(`${b.date||''} ${b.startTime||''}`));
  $('#trainerEventsList').innerHTML=visible.map(trainerEventCard).join('')||'<p class="muted">No hay eventos asignados a tus categorías.</p>';
}
function renderTrainerAnnouncements(){
  $('#trainerAnnouncementsList').innerHTML=trainerAnnouncements.map(a=>`<article class="panel"><span class="eyebrow">${esc(a.categoryId?catName(a.categoryId):'General')}</span><h3>${esc(a.title)}</h3><p>${esc(a.body||'')}</p></article>`).join('')||'<p class="muted">No hay comunicados.</p>';
}
$('#trainerPlayerSearch').oninput=renderTrainerPlayers;
$('#trainerPlayerCategory').onchange=renderTrainerPlayers;
$('#trainerEventsList').onclick=e=>{const card=e.target.closest('[data-trainer-event]');if(card)openEventDetail(card.dataset.trainerEvent);};
$('#trainerEventsList').onkeydown=e=>{const card=e.target.closest('[data-trainer-event]');if(card&&(e.key==='Enter'||e.key===' ')){e.preventDefault();openEventDetail(card.dataset.trainerEvent);}};
$('#eventHomeAway').onchange=syncEventVenueFields;
$('#trainerNewEventButton').onclick=()=>openEvent();

$('#loadAttendanceButton').onclick=()=>loadAttendanceRoster('attendance',{trainer:false});
$('#markAllPresentButton').onclick=()=>markAllAttendancePresent('attendance');
$('#saveAttendanceButton').onclick=()=>saveAttendance('attendance',{trainer:false}).catch(e=>alert(err(e)));
$('#attendanceCategory').onchange=()=>{loadAttendanceRoster('attendance',{trainer:false});renderAttendanceSummary('attendance',{trainer:false})};
$('#attendanceSummaryMonth').onchange=()=>renderAttendanceSummary('attendance',{trainer:false});
$('#exportAttendanceButton').onclick=exportAttendanceCSV;
$('#trainerLoadAttendanceButton').onclick=()=>loadAttendanceRoster('trainerAttendance',{trainer:true});
$('#trainerMarkAllPresentButton').onclick=()=>markAllAttendancePresent('trainerAttendance');
$('#trainerSaveAttendanceButton').onclick=()=>saveAttendance('trainerAttendance',{trainer:true}).catch(e=>alert(err(e)));
$('#trainerAttendanceCategory').onchange=()=>{loadAttendanceRoster('trainerAttendance',{trainer:true});renderAttendanceSummary('trainerAttendance',{trainer:true})};
$('#trainerAttendanceSummaryMonth').onchange=()=>renderAttendanceSummary('trainerAttendance',{trainer:true});


function renderUsers(){
  populateFamilyCategoryFilter();
  const selectedCategory=$('#familyCategoryFilter')?.value||'';
  const filteredFamilies=families.filter(f=>familyMatchesCategory(f,selectedCategory));
  const activeFamilies=filteredFamilies.filter(f=>(f.status||'active')==='active');
  const filteredPlayerIds=new Set(filteredFamilies.flatMap(f=>f.playerIds||[]));
  const filteredUserIds=new Set(filteredFamilies.flatMap(f=>f.memberUserIds||[]));
  const unassignedPlayers=players.filter(p=>!p.familyId&&(!selectedCategory||playerCatIds(p).includes(selectedCategory)));
  const unassignedUsers=familyUsers.filter(u=>!u.familyId);
  $('#familiesSummary').innerHTML=[[activeFamilies.length,'Familias activas'],[unassignedPlayers.length,'Jugadoras sin familia'],[unassignedUsers.length,'Usuarios sin familia'],[money(activeFamilies.reduce((s,f)=>s+familyBalance(f),0)),'Saldo familiar pendiente']].map(([v,l])=>`<article class="stat"><strong>${v}</strong><span>${l}</span></article>`).join('');
  $('#familiesList').innerHTML=filteredFamilies.map(f=>{const pids=f.playerIds||[],uids=f.memberUserIds||[],location=f.address||'Dirección pendiente',balance=familyBalance(f);return`<article class="panel family-card"><div class="page-head compact-head"><div><span class="eyebrow">${esc(f.familyCode||f.id)}</span><h3>${esc(f.name||'Grupo familiar')}</h3></div><span class="badge ${f.status||'active'}">${statusLabel(f.status||'active')}</span></div><div class="family-metrics"><div><strong>${uids.length}</strong><span>responsables/usuarios</span></div><div><strong>${pids.length}</strong><span>jugadoras</span></div><div><strong>${money(balance)}</strong><span>saldo pendiente</span></div></div><div class="family-people"><h4>Jugadoras</h4>${pids.map(id=>`<button class="person-row" data-view-player="${id}"><span class="person-icon">🏐</span><span><strong>${esc(playerName(id))}</strong><small>${esc(catNames(players.find(p=>p.id===id)||{}))}</small></span><span aria-hidden="true">›</span></button>`).join('')||'<p class="muted">Sin jugadoras asociadas.</p>'}<h4>Usuarios</h4>${uids.map(id=>`<button class="person-row" data-view-user="${id}"><span class="person-icon">👤</span><span><strong>${esc(userName(id))}</strong><small>${esc(familyUsers.find(u=>u.id===id)?.accountType==='player'?'Jugadora':'Padre, madre o encargado')}</small></span><span aria-hidden="true">›</span></button>`).join('')||'<p class="muted">Sin usuarios asociados.</p>'}</div><p class="family-location">📍 ${esc(location)}</p><div class="actions"><button class="btn primary" data-view-family="${f.id}">Ver familia</button><button class="btn secondary" data-manage-family-members="${f.id}">Gestionar miembros</button><button class="btn secondary" data-edit-family="${f.id}">Editar datos</button></div></article>`}).join('')||'<p class="muted">No hay familias para la categoría seleccionada.</p>';
  $('#usersBody').innerHTML=familyUsers.map(u=>`<tr><td><strong>${esc(u.fullName)}</strong><div class="muted">${u.accountType==='player'?'Jugadora':'Padre, madre o encargado'}</div></td><td>${esc(u.email)}</td><td>${esc(u.phone)}</td><td>${players.filter(p=>(p.linkedUserIds||[]).includes(u.id)).map(p=>`<button class="chip chip-button" data-view-player="${p.id}">${esc(p.name)}</button>`).join('')||'—'}</td><td><span class="badge ${u.status}">${statusLabel(u.status)}</span></td></tr>`).join('')||'<tr><td colspan="5">No hay usuarios registrados.</td></tr>';
  $('#linkRequestsAdmin').innerHTML=linkRequests.filter(r=>r.status==='pending').map(r=>`<article class="panel"><strong>${esc(r.playerName)}</strong><p>${esc(userName(r.userId))} · ${esc(r.playerCode||'Sin Player ID')} · ${esc(catName(r.categoryId))}</p><p class="muted">${esc(r.relationship||'')} ${esc(r.notes||'')}</p><button class="btn primary" data-approve-link="${r.id}">Aprobar</button> <button class="btn secondary" data-reject-link="${r.id}">Rechazar</button></article>`).join('')||'<p class="muted">No hay solicitudes pendientes.</p>';
}

function renderFamilyHome(){if(state.familyDataLoading){setFamilyLoading(true);return}const bal=familyCharges.filter(c=>['pending','partial'].includes(c.status)).reduce((s,c)=>s+Number(c.amount||0)-Number(c.paidAmount||0),0);$('#familyWelcome').textContent=`Bienvenido, ${profile?.fullName||''}`;$('#familyPlayers').innerHTML=familyPlayers.map(p=>`<article class="panel athlete-card clickable-card" data-view-player="${p.id}"><span class="eyebrow">${esc(p.playerCode)}</span><h3>${esc(p.name)}</h3><p><strong>${esc(catNames(p))}</strong></p><button class="btn secondary" data-view-player="${p.id}">Ver perfil</button></article>`).join('')||'<article class="panel"><h3>Sin jugadoras vinculadas</h3><p>Tu información ya terminó de cargar. Puedes enviar una solicitud desde “Vincular jugadora”.</p></article>';$('#familyUpcoming').innerHTML=familyEvents.filter(e=>e.date>=today()&&e.status!=='cancelled').slice(0,5).map(eventMini).join('')||'<p class="muted">No hay eventos próximos.</p>';const isPlayer=profile?.accountType==='player';$('#familyBalancePanel').classList.toggle('hidden',isPlayer);if(!isPlayer)$('#familyBalance').innerHTML=`<div class="big-number">${money(bal)}</div><p class="muted">Saldo total pendiente de las jugadoras vinculadas.</p>`}

function renderFamilyLink(){if(state.familyDataLoading){$('#familyLinkRequests').innerHTML='<p class="muted">Cargando solicitudes…</p>';return}$('#familyLinkRequests').innerHTML=familyLinkRequests.map(r=>`<div class="recent-item"><div><strong>${esc(r.playerName)}</strong><div class="muted">${esc(r.playerCode||'')} · ${esc(catName(r.categoryId))}</div></div><span class="badge ${r.status}">${statusLabel(r.status)}</span></div>`).join('')||'<p class="muted">No has enviado solicitudes.</p>'}
function renderFamilyEvents(){$('#familyEventsList').innerHTML=familyEvents.filter(e=>e.date>=today()).map(e=>`<article class="panel"><span class="eyebrow">${typeLabel(e.type)} · ${esc(catName(e.categoryId))}</span><h3>${esc(e.title)}</h3><p><strong>${esc(e.date)}</strong> · ${esc(e.startTime||'')} ${e.endTime?'– '+esc(e.endTime):''}</p><p>${esc(eventLocationName(e))}${e.homeAway==='away'&&e.awayAddress?`<br>${esc(e.awayAddress)}`:''}</p>${e.locationUrl?`<p><a href="${esc(e.locationUrl)}" target="_blank" rel="noopener">Abrir ubicación</a></p>`:venueLinks(e.venueId)}<p class="muted">${esc(e.notes||'')}</p><button class="btn secondary" data-family-calendar-event="${e.id}" type="button">📅 Agregar al calendario</button></article>`).join('')||'<p class="muted">No hay eventos para tus categorías.</p>'}
function renderFamilyCharges(){
  const list=[...familyCharges].sort((a,b)=>(b.month||'').localeCompare(a.month||'')||(playerName(a.playerId)).localeCompare(playerName(b.playerId)));
  $('#familyChargesList').innerHTML=list.map(c=>{
    const remaining=chargeRemaining(c),due=c.dueDate||dueDateForMonth(c.month),dueState=chargeDueState(c),active=activeReportForCharge(c.id),approved=approvedReportForCharge(c.id);
    const visibleStatus=c.status==='paid'?'Pagado':c.status==='exempt'?'Exonerado':c.status==='partial'?(dueState==='overdue'?'Parcial · Morosa':'Parcial'):(dueState==='overdue'?'Pendiente · Morosa':'Pendiente');
    const statusClass=c.status==='paid'?'paid':c.status==='exempt'?'exempt':dueState==='overdue'?'overdue':c.status;
    const paymentInfo=approved?`<p class="payment-meta">Pago confirmado: ${esc(approved.date||'')} · ${esc(paymentMethodLabel(paymentMethodValue(approved)))} · ${esc(approved.bank||'—')} · Comprobante ${esc(approved.reference||'—')}</p>`:active?.status==='reported'?'<p class="payment-meta pending-review">Pago reportado y pendiente de revisión.</p>':'';
    return`<article class="panel family-charge-card"><div class="page-head compact-head"><div><span class="eyebrow">${esc(monthLabel(c.month))}</span><h3>${esc(playerName(c.playerId))}</h3></div><span class="badge ${statusClass}">${esc(visibleStatus)}</span></div><div class="charge-values"><span>Total <strong>${money(c.amount)}</strong></span><span>Pagado <strong>${money(c.paidAmount)}</strong></span><span>Saldo <strong>${money(remaining)}</strong></span></div><p class="muted">${dueState==='overdue'&&!['paid','exempt'].includes(c.status)?`Venció el ${esc(due)}.`:`Fecha límite: ${esc(due)}.`}</p>${paymentInfo}</article>`;
  }).join('')||'<p class="muted">No hay mensualidades registradas.</p>';
}
function renderFamilyAnnouncements(){$('#familyAnnouncementsList').innerHTML=familyAnnouncements.map(a=>`<article class="panel"><span class="eyebrow">${a.categoryId?esc(catName(a.categoryId)):'General'}</span><h3>${esc(a.title)}</h3><p>${esc(a.body)}</p></article>`).join('')||'<p class="muted">No hay comunicados.</p>'}

function guardianRow(g={}){return`<div class="guardian-row" data-id="${g.id||crypto.randomUUID()}" data-source-user-id="${esc(g.sourceUserId||'')}"><div class="guardian-grid"><input class="g-name" placeholder="Nombre completo" value="${esc(g.name||'')}"><input class="g-rel" placeholder="Relación" value="${esc(g.relationship||'')}"><input class="g-phone" placeholder="Teléfono" value="${esc(g.phone||'')}"><input class="g-email" placeholder="Correo" value="${esc(g.email||'')}"></div><button class="link-button remove-guardian" type="button">Eliminar</button></div>`}
function guardiansFromLinkedUsers(linkedUserIds,manualGuardians=[]){
  const manual=manualGuardians.filter(g=>!g.sourceUserId);
  const fromUsers=linkedUserIds.map(uid=>{
    const u=familyUsers.find(x=>x.id===uid);
    if(!u)return null;
    return {
      id:`user_${uid}`,
      sourceUserId:uid,
      name:u.fullName||u.email||'Encargado',
      relationship:'Encargado/a',
      phone:u.phone||'',
      email:u.email||''
    };
  }).filter(Boolean);
  const manualByEmailPhone=manual.filter(g=>!fromUsers.some(u=>(g.email&&u.email&&norm(g.email)===norm(u.email))||(g.phone&&u.phone&&norm(g.phone)===norm(u.phone))));
  return [...fromUsers,...manualByEmailPhone];
}
function linkedUsersHTML(selected=[]){return familyUsers.map(u=>`<label class="check-item"><input type="checkbox" value="${u.id}" ${selected.includes(u.id)?'checked':''}><span><strong>${esc(u.fullName||u.email)}</strong><small>${esc(u.email||'')} · ${esc(u.phone||'Sin teléfono')} · Encargado registrado</small></span></label>`).join('')||'<p class="muted">Aún no hay usuarios familiares registrados.</p>'}
function nextCode(){const n=players.reduce((m,p)=>Math.max(m,Number((p.playerCode||'').match(/\d+/)?.[0])||0),0)+1;return`ASB-${String(n).padStart(4,'0')}`}
function nextFamilyCode(){const n=families.reduce((m,f)=>Math.max(m,Number((f.familyCode||'').match(/\d+/)?.[0])||0),0)+1;return`FAM-${String(n).padStart(4,'0')}`}
function familyBalance(f){const ids=new Set(f.playerIds||[]);return charges.filter(c=>ids.has(c.playerId)&&['pending','partial'].includes(c.status)).reduce((s,c)=>s+Number(c.amount||0)-Number(c.paidAmount||0),0)}
function familyUserOptions(selected=[]){return familyUsers.map(u=>`<label class="check-item"><input type="checkbox" value="${u.id}" ${selected.includes(u.id)?'checked':''}><span><strong>${esc(u.fullName)}</strong><small>${esc(u.email)} · ${esc(u.phone||'Sin teléfono')}</small></span></label>`).join('')||'<p class="muted">No hay usuarios registrados.</p>'}
function familyPlayerOptions(selected=[]){return players.map(p=>`<label class="check-item"><input type="checkbox" value="${p.id}" ${selected.includes(p.id)?'checked':''}><span><strong>${esc(p.name)}</strong><small>${esc(p.playerCode)} · ${esc(catNames(p))}</small></span></label>`).join('')||'<p class="muted">No hay jugadoras registradas.</p>'}
function openFamily(f){$('#familyForm').reset();$('#familyDocId').value=f?.id||'';$('#familyCode').value=f?.familyCode||nextFamilyCode();$('#familyName').value=f?.name||'';$('#familyPhone').value=f?.phone||'';$('#familyAddress').value=f?.address||'';$('#familyNotes').value=f?.notes||'';$('#familyStatus').value=f?.status||'active';$('#familyUsersEditor').innerHTML=familyUserOptions(f?.memberUserIds||[]);$('#familyPlayersEditor').innerHTML=familyPlayerOptions(f?.playerIds||[]);$('#familyDialogTitle').textContent=f?'Editar familia':'Nueva familia';$('#familyDialog').showModal()}
function openFamilyDetail(id){const f=families.find(x=>x.id===id);if(!f)return alert('No se encontró la familia.');const famPlayers=(f.playerIds||[]).map(id=>players.find(p=>p.id===id)).filter(Boolean),famUsers=(f.memberUserIds||[]).map(id=>familyUsers.find(u=>u.id===id)).filter(Boolean);$('#familyDetailCode').textContent=f.familyCode||f.id;$('#familyDetailTitle').textContent=f.name||'Grupo familiar';$('#familyDetailContent').innerHTML=`<div class="family-detail-grid"><article class="panel"><h4>Contacto</h4><p><strong>Teléfono:</strong> ${esc(f.phone||'—')}<br><strong>Dirección:</strong> ${esc(f.address||'—')}<br><strong>Estado:</strong> ${esc(statusLabel(f.status||'active'))}</p><p class="muted">${esc(f.notes||'')}</p></article><article class="panel"><h4>Resumen financiero</h4><div class="big-number">${money(familyBalance(f))}</div><p class="muted">Saldo pendiente de las jugadoras de esta familia.</p></article></div><h4>Jugadoras</h4><div class="member-list">${famPlayers.map(p=>`<button class="person-row" data-view-player="${p.id}"><span class="person-icon">🏐</span><span><strong>${esc(p.name)}</strong><small>${esc(p.playerCode)} · ${esc(catNames(p))}</small></span><span>›</span></button>`).join('')||'<p class="muted">No hay jugadoras asociadas.</p>'}</div><h4>Usuarios</h4><div class="member-list">${famUsers.map(u=>`<button class="person-row" data-view-user="${u.id}"><span class="person-icon">👤</span><span><strong>${esc(u.fullName)}</strong><small>${esc(u.accountType==='player'?'Jugadora':'Padre, madre o encargado')} · ${esc(u.email)} · ${esc(u.phone||'Sin teléfono')}</small></span><span>›</span></button>`).join('')||'<p class="muted">No hay usuarios asociados.</p>'}</div>`;$('#editFamilyFromDetail').dataset.familyId=f.id;$('#manageFamilyMembersFromDetail').dataset.familyId=f.id;$('#familyDetailDialog').showModal()}
function renderPlayerReinforcementEditor(selected=[]){
  const primary=$('#playerCategory').value;
  $('#playerCategoriesEditor').innerHTML=categories.filter(c=>c.status==='active'&&c.id!==primary).map(c=>`<label class="check-item"><input type="checkbox" value="${c.id}" ${selected.includes(c.id)?'checked':''}><span>${esc(c.name)}</span></label>`).join('')||'<p class="muted">No hay otras categorías disponibles.</p>';
}
function syncPlayerFinancialUI(){
  const first=isFirstDivisionCategoryId($('#playerCategory').value);
  $('#firstDivisionFinancialNotice').classList.toggle('hidden',!first);
  $('#playerFee').disabled=first;
  if(first)$('#playerFee').value='';
}
function syncInsuranceFields(){
  const enabled=$('#playerInsured').checked;
  ['playerInsurer','playerPolicyNumber','playerInsuranceExpiry','playerInsuranceNotes'].forEach(id=>$('#'+id).disabled=!enabled);
}
function openPlayer(p){
  $('#playerForm').reset();$('#playerPhotoFile').value='';previewPhoto($('#playerPhotoPreview'),p?.photoUrl,p?.photoVersion,'Sin foto');$('#playerDocId').value=p?.id||'';$('#playerCode').value=p?.playerCode||nextCode();$('#playerName').value=p?.name||'';$('#playerBirthdate').value=p?.birthdate||'';$('#playerType').value=p?.playerType||'minor';
  $('#playerCategory').value=p?.categoryId||p?.categoryIds?.[0]||categories[0]?.id||'';renderPlayerReinforcementEditor(reinforcementCategoryIds(p));
  $('#playerNumber').value=p?.number||'';$('#playerPosition').value=p?.position||'';$('#playerPermanentReinforcement').checked=!!p?.permanentReinforcement;
  $('#playerPhone').value=p?.phone||'';$('#playerEmail').value=p?.email||'';$('#playerProvince').value=p?.province||'';$('#playerCantonDistrict').value=p?.cantonDistrict||'';$('#playerAddress').value=p?.address||'';
  $('#playerEmergencyName').value=p?.emergencyContact?.name||'';$('#playerEmergencyPhone').value=p?.emergencyContact?.phone||'';
  $('#playerInsured').checked=!!p?.insured;$('#playerInsurer').value=p?.insurance?.provider||'';$('#playerPolicyNumber').value=p?.insurance?.policyNumber||'';$('#playerInsuranceExpiry').value=p?.insurance?.expiryDate||'';$('#playerInsuranceNotes').value=p?.insurance?.notes||'';
  $('#playerFee').value=(p?.customFee===undefined||p?.customFee===null)?'':p.customFee;$('#playerStatus').value=p?.status||'active';$('#playerNotes').value=p?.notes||'';
  const linkedIds=p?.linkedUserIds||[],displayGuardians=guardiansFromLinkedUsers(linkedIds,p?.guardians||[]);
  $('#guardiansEditor').innerHTML=(displayGuardians.length?displayGuardians:[{}]).map(guardianRow).join('');
  $('#linkedUsersEditor').innerHTML=linkedUsersHTML(linkedIds);
  $('#playerDialogTitle').textContent=p?'Editar jugadora':'Nueva jugadora';syncPlayerFinancialUI();syncInsuranceFields();$('#playerDialog').showModal();
}

function renderCategoryEditorRelations(categoryId){
  const saved=!!categoryId;
  const notice=$('#categorySaveFirstNotice');
  if(notice)notice.classList.toggle('hidden',saved);

  ['addTrainingFromCategoryButton','addEventFromCategoryButton','addVideoFromCategoryButton'].forEach(id=>{
    const b=$('#'+id);
    if(b)b.disabled=!saved;
  });

  const roster=$('#categoryRosterEditor');
  if(roster){
    roster.innerHTML=players.map(p=>`<label class="check-item">
      <input type="checkbox" value="${p.id}" ${categoryId&&playerCatIds(p).includes(categoryId)?'checked':''}>
      <span><strong>${esc(p.name)}</strong><small>${esc(p.playerCode||'')} · Principal: ${esc(catName(p.categoryId))}${reinforcementCategoryIds(p).length?` · Refuerza: ${esc(reinforcementCategoryNames(p))}`:''}</small></span>
    </label>`).join('')||'<p class="muted">No hay jugadoras registradas.</p>';
  }

  if(!saved){
    if($('#categoryTrainingsEditorList'))$('#categoryTrainingsEditorList').innerHTML='<p class="muted">Guarda primero la categoría.</p>';
    if($('#categoryEventsEditorList'))$('#categoryEventsEditorList').innerHTML='<p class="muted">Guarda primero la categoría.</p>';
    if($('#categoryVideosEditorList'))$('#categoryVideosEditorList').innerHTML='<p class="muted">Guarda primero la categoría.</p>';
    return;
  }

  const trainings=trainingSeries.filter(t=>t.categoryId===categoryId&&t.status==='active');
  if($('#categoryTrainingsEditorList')){
    $('#categoryTrainingsEditorList').innerHTML=trainings.map(t=>`<article class="panel"><div class="page-head compact-head">
      <div><strong>${esc(daysLabel(t.days||[]))}</strong><div class="muted">${esc(t.startTime||'')} – ${esc(t.endTime||'')} · ${esc(venueName(t.venueId))}</div></div>
      <button class="action" type="button" data-edit-training="${t.id}">Editar</button>
    </div></article>`).join('')||'<p class="muted">No hay entrenamientos configurados.</p>';
  }

  const games=events.filter(e=>e.categoryId===categoryId).sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  if($('#categoryEventsEditorList')){
    $('#categoryEventsEditorList').innerHTML=games.map(e=>`<article class="panel"><div class="page-head compact-head">
      <div><strong>${esc(e.title)}</strong><div class="muted">${esc(e.date||'')} · ${esc(e.startTime||'')} ${e.opponent?'· '+esc(e.opponent):''}</div></div>
      <div class="actions"><button class="action" type="button" data-edit-event="${e.id}">Editar</button><button class="action danger-action" type="button" data-delete-event="${e.id}">Eliminar</button></div>
    </div></article>`).join('')||'<p class="muted">No hay partidos o eventos registrados.</p>';
  }

  const videos=categoryVideos.filter(v=>v.categoryId===categoryId).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  if($('#categoryVideosEditorList')){
    $('#categoryVideosEditorList').innerHTML=videos.map(v=>`<article class="panel"><div class="page-head compact-head">
      <div><strong>${esc(v.title)}</strong><div class="muted">${esc(v.date||'')} ${v.opponent?'· '+esc(v.opponent):''}</div><a href="${esc(v.url)}" target="_blank" rel="noopener">Abrir enlace</a></div>
      <div class="actions"><button class="action" type="button" data-edit-category-video="${v.id}">Editar</button><button class="action danger-action" type="button" data-delete-category-video="${v.id}">Eliminar</button></div>
    </div></article>`).join('')||'<p class="muted">No hay videos registrados.</p>';
  }
}


function openCategoryVideo(v=null,categoryId=''){
  $('#categoryVideoForm').reset();
  $('#categoryVideoDocId').value=v?.id||'';
  $('#categoryVideoCategoryId').value=v?.categoryId||categoryId;
  $('#categoryVideoTitle').value=v?.title||'';
  $('#categoryVideoDate').value=v?.date||today();
  $('#categoryVideoOpponent').value=v?.opponent||'';
  $('#categoryVideoTournament').value=v?.tournament||'';
  $('#categoryVideoUrl').value=v?.url||'';
  $('#categoryVideoNotes').value=v?.notes||'';
  $('#categoryVideoDialog').showModal();
}
function openEventForCategory(categoryId){
  openEvent();
  $('#eventCategory').value=categoryId;
  const c=categories.find(x=>x.id===categoryId);
  if(c?.seasonId)$('#eventSeason').value=c.seasonId;
  if(c?.venueId)$('#eventVenue').value=c.venueId;
}
function openTrainingForCategory(categoryId){
  openTraining();
  $('#trainingCategory').value=categoryId;
  const c=categories.find(x=>x.id===categoryId);
  if(c?.seasonId)$('#trainingSeason').value=c.seasonId;
  if(c?.venueId)$('#trainingVenue').value=c.venueId;
}

function openCategory(c){
  $('#categoryForm').reset();$('#categoryPhotoFile').value='';previewPhoto($('#categoryPhotoPreview'),c?.photoUrl,c?.photoVersion,'Sin foto del equipo');
  $('#categoryDocId').value=c?.id||'';
  $('#categoryName').value=c?.name||'';
  $('#categoryAgeGroup').value=c?.ageGroup||'';
  $('#categoryTeamColor').value=c?.teamColor||'';
  $('#categoryFee').value=c?.fee||'';
  $('#categoryDueDay').value=c?.dueDay||15;
  $('#categorySeason').value=c?.seasonId||seasons.find(s=>s.isCurrent)?.id||seasons[0]?.id||'';
  $('#categoryStatus').value=c?.status||'active';
  $('#categoryCoach').value=c?.coach||'';
  $('#categoryAssistant').value=c?.assistant||'';
  $('#categorySchedule').value=c?.schedule||'';
  $('#categoryVenue').value=c?.venueId||'';
  $('#categoryNotes').value=c?.notes||'';
  $('#categoryDialogTitle').textContent=c?'Editar categoría':'Nueva categoría';
  renderCategoryEditorRelations(c?.id||'');
  $('#categoryDialog').showModal();
}
function openVenue(v){$('#venueForm').reset();$('#venueDocId').value=v?.id||'';$('#venueName').value=v?.name||'';$('#venueAddress').value=v?.address||'';$('#venueMapUrl').value=v?.mapUrl||'';$('#venueDirections').value=v?.directions||'';$('#venueStatus').value=v?.status||'active';$('#venueDialogTitle').textContent=v?'Editar lugar':'Nuevo lugar';$('#venueDialog').showModal()}


function icsEscape(value=''){return String(value).replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;')}
function icsDateTime(date,time=''){
  const d=(date||'').replace(/-/g,'');
  if(!time)return d;
  return `${d}T${String(time).replace(':','')}00`;
}
function icsEndDate(date){
  const d=new Date(`${date}T00:00:00`);
  d.setDate(d.getDate()+1);
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
}
function eventCalendarDescription(e){
  return [
    `Categoría: ${catName(e.categoryId)}`,
    e.opponent?`Rival: ${e.opponent}`:'',
    `Casa / visita: ${e.homeAway==='home'?'Casa':e.homeAway==='away'?'Visitante':'No aplica'}`,
    `Uniforme: ${uniformLabel(e.uniform)}`,
    e.awayAddress?`Dirección: ${e.awayAddress}`:'',
    e.locationUrl?`Ubicación: ${e.locationUrl}`:'',
    e.notes||''
  ].filter(Boolean).join('\n');
}
function eventToICS(e){
  const uid=`${e.id||crypto.randomUUID()}@volleycore.asbavol`;
  const dtstamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
  const timed=!!e.startTime;
  const dtstart=timed?`DTSTART:${icsDateTime(e.date,e.startTime)}`:`DTSTART;VALUE=DATE:${icsDateTime(e.date)}`;
  let dtend='';
  if(timed&&e.endTime)dtend=`\nDTEND:${icsDateTime(e.date,e.endTime)}`;
  else if(!timed)dtend=`\nDTEND;VALUE=DATE:${icsEndDate(e.date)}`;
  return `BEGIN:VEVENT
UID:${icsEscape(uid)}
DTSTAMP:${dtstamp}
${dtstart}${dtend}
SUMMARY:${icsEscape(`${catName(e.categoryId)} · ${e.title||typeLabel(e.type)}`)}
LOCATION:${icsEscape(eventLocationName(e))}
DESCRIPTION:${icsEscape(eventCalendarDescription(e))}
END:VEVENT`;
}
function downloadICS(filename,calendarName,eventList){
  const valid=eventList.filter(e=>e.date&&e.status!=='cancelled');
  if(!valid.length)return alert('No hay eventos disponibles para calendarizar.');
  const body=`BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//VolleyCore ASBAVOL//ES
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:${icsEscape(calendarName)}
${valid.map(eventToICS).join('\n')}
END:VCALENDAR`;
  const blob=new Blob([body],{type:'text/calendar;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=filename;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function downloadCategoryCalendar(categoryId){
  const c=categories.find(x=>x.id===categoryId);if(!c)return;
  const list=events.filter(e=>e.categoryId===categoryId&&e.date>=today()&&e.status!=='cancelled')
    .sort((a,b)=>`${a.date} ${a.startTime||''}`.localeCompare(`${b.date} ${b.startTime||''}`));
  downloadICS(`VolleyCore-${(c.name||'categoria').replace(/[^\w-]+/g,'-')}.ics`,`${c.name} · VolleyCore`,list);
}
function downloadSingleEventCalendar(eventId){
  const e=events.find(x=>x.id===eventId)||trainerEvents.find(x=>x.id===eventId);if(!e)return;
  downloadICS(`VolleyCore-${(e.title||'evento').replace(/[^\w-]+/g,'-')}.ics`,e.title||'Evento VolleyCore',[e]);
}
function eventLocationName(e){
  if(e?.homeAway==='away')return e.awayVenueName||e.awayAddress||'Sede visitante por definir';
  return venueName(e?.venueId);
}
function syncEventVenueFields(){
  const away=$('#eventHomeAway')?.value==='away';
  $('#eventVenueRegisteredField')?.classList.toggle('hidden',away);
  $('#eventAwayVenueField')?.classList.toggle('hidden',!away);
  $('#eventAwayAddressField')?.classList.toggle('hidden',!away);
  if(away&&$('#eventVenue'))$('#eventVenue').value='';
}
function uniformLabel(value){return value==='red'?'Rojo':value==='black'?'Negro':value==='white'?'Blanco':value==='cyan_fuchsia'?'Celeste / Fucsia':'Por definir'}
function safeExternalUrl(url){
  try{const u=new URL(url);return ['http:','https:'].includes(u.protocol)?u.href:''}catch{return''}
}
function openEventDetail(id){
  const e=events.find(x=>x.id===id)||trainerEvents.find(x=>x.id===id);if(!e)return;
  const locationUrl=safeExternalUrl(e.locationUrl||'');
  $('#eventDetailTitle').textContent=e.title||'Detalle del evento';
  $('#eventDetailContent').innerHTML=`
    <div class="category-detail-grid">
      <article class="panel"><span class="eyebrow">${esc(typeLabel(e.type))}</span><h4>${esc(e.title)}</h4><p><strong>Categoría:</strong> ${esc(catName(e.categoryId))}<br><strong>Temporada:</strong> ${esc(seasonName(e.seasonId))}<br>${e.opponent?`<strong>Rival:</strong> ${esc(e.opponent)}<br>`:''}<strong>Estado:</strong> ${esc(statusLabel(e.status))}</p></article>
      <article class="panel"><span class="eyebrow">FECHA Y LUGAR</span><h4>${esc(e.date||'')}</h4><p><strong>Hora:</strong> ${esc(e.startTime||'—')}${e.endTime?' – '+esc(e.endTime):''}<br><strong>Lugar:</strong> ${esc(eventLocationName(e))}<br>${e.homeAway==='away'&&e.awayAddress?`<strong>Dirección:</strong> ${esc(e.awayAddress)}<br>`:''}<strong>Casa / visita:</strong> ${esc(e.homeAway==='home'?'Casa':e.homeAway==='away'?'Visita':'No aplica')}<br><strong>Uniforme:</strong> ${esc(uniformLabel(e.uniform))}</p>${locationUrl?`<a class="btn vc-cyan-button event-location-link" href="${esc(locationUrl)}" target="_blank" rel="noopener noreferrer">Abrir ubicación / Waze →</a>`:''}</article>
    </div>
    ${e.notes?`<article class="panel"><h4>Observaciones</h4><p>${esc(e.notes)}</p></article>`:''}`;
  $('#editEventFromDetail').dataset.eventId=e.id;
  $('#eventCalendarButton').dataset.eventId=e.id;
  $('#editEventFromDetail').classList.toggle('hidden',!(['admin','treasurer'].includes(profile?.role)||(isCoachingRole(profile?.role)&&(profile.assignedCategoryIds||[]).includes(e.categoryId))));
  $('#eventDetailDialog').showModal();
}
function openEvent(e){
  $('#eventForm').reset();
  const coaching=isCoachingRole(profile?.role),allowedIds=profile?.assignedCategoryIds||[];
  const allowedCategories=coaching?categories.filter(c=>allowedIds.includes(c.id)):categories;
  $('#eventCategory').innerHTML=allowedCategories.filter(c=>c.status==='active').map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');
  $('#eventDocId').value=e?.id||'';
  $('#eventCategory').value=e?.categoryId||allowedCategories[0]?.id||'';
  $('#eventSeason').value=e?.seasonId||seasons.find(s=>s.isCurrent)?.id||seasons[0]?.id||'';
  $('#eventType').value=e?.type==='training'?'match':(e?.type||'match');
  $('#eventTitle').value=e?.title||'';
  $('#eventOpponent').value=e?.opponent||'';
  $('#eventDate').value=e?.date||today();
  $('#eventStart').value=e?.startTime||'';
  $('#eventEnd').value=e?.endTime||'';
  $('#eventHomeAway').value=e?.homeAway||'';
  $('#eventVenue').value=e?.venueId||'';
  $('#eventAwayVenueName').value=e?.awayVenueName||'';
  $('#eventAwayAddress').value=e?.awayAddress||'';
  $('#eventLocationUrl').value=e?.locationUrl||'';
  syncEventVenueFields();
  $('#eventUniform').value=e?.uniform||'';
  $('#eventStatus').value=e?.status||'scheduled';
  $('#eventNotes').value=e?.notes||'';
  $('#eventDialogTitle').textContent=e?'Editar evento':'Nuevo evento';
  $('#eventDialog').showModal();
}
async function deleteEventById(id){
  const event=events.find(e=>e.id===id);
  if(!event)return;
  const ok=confirm(`¿Está seguro de que desea eliminar el evento "${event.title}"? Esta acción no se puede deshacer.`);
  if(!ok)return;
  try{
    await deleteDoc(doc(db,'events',id));
    events=events.filter(e=>e.id!==id);
    renderEvents();
    renderDashboard();
    toast('Evento eliminado correctamente.');
  }catch(x){
    alert(err(x));
  }
}

function openSeason(s){$('#seasonForm').reset();$('#seasonDocId').value=s?.id||'';$('#seasonName').value=s?.name||String(new Date().getFullYear());$('#seasonStart').value=s?.startDate||`${new Date().getFullYear()}-01-01`;$('#seasonEnd').value=s?.endDate||`${new Date().getFullYear()}-12-31`;$('#seasonStatus').value=s?.status||'active';$('#seasonCurrent').checked=!!s?.isCurrent;$('#seasonDialogTitle').textContent=s?'Editar temporada':'Nueva temporada';$('#seasonDialog').showModal()}
function openTraining(t){$('#trainingForm').reset();$('#trainingDocId').value=t?.id||'';$('#trainingCategory').value=t?.categoryId||categories[0]?.id||'';$('#trainingSeason').value=t?.seasonId||seasons.find(s=>s.isCurrent)?.id||seasons[0]?.id||'';$('#trainingStartTime').value=t?.startTime||'';$('#trainingEndTime').value=t?.endTime||'';$('#trainingStartDate').value=t?.startDate||seasons.find(s=>s.isCurrent)?.startDate||today();$('#trainingEndDate').value=t?.endDate||seasons.find(s=>s.isCurrent)?.endDate||`${new Date().getFullYear()}-12-31`;$('#trainingVenue').value=t?.venueId||'';$('#trainingStatus').value=t?.status||'active';$('#trainingNotes').value=t?.notes||'';$$('input[name="trainingDay"]').forEach(i=>i.checked=(t?.days||[]).includes(Number(i.value)));$('#trainingDialogTitle').textContent=t?'Editar entrenamiento recurrente':'Nuevo entrenamiento recurrente';$('#trainingDialog').showModal()}
function openTrainingException(t){$('#trainingExceptionForm').reset();$('#trainingExceptionSeriesId').value=t.id;$('#trainingExceptionDate').value=t.startDate>today()?t.startDate:today();$('#trainingExceptionStart').value=t.startTime;$('#trainingExceptionEnd').value=t.endTime;$('#trainingExceptionVenue').value=t.venueId||'';$('#trainingExceptionDialog').showModal()}
function openTrainingFuture(t){$('#trainingFutureForm').reset();$('#trainingFutureSeriesId').value=t.id;$('#trainingFutureDate').value=t.startDate>today()?t.startDate:today();$('#trainingFutureStart').value=t.startTime;$('#trainingFutureEnd').value=t.endTime;$('#trainingFutureVenue').value=t.venueId||'';$('#trainingFutureDialog').showModal()}
function openAnnouncement(a){$('#announcementForm').reset();$('#announcementDocId').value=a?.id||'';$('#announcementTitle').value=a?.title||'';$('#announcementCategory').value=a?.categoryId||'';$('#announcementBody').value=a?.body||'';$('#announcementStatus').value=a?.status||'published';$('#announcementDialogTitle').textContent=a?'Editar comunicado':'Nuevo comunicado';$('#announcementDialog').showModal()}
function openCharge(c){$('#chargeDocId').value=c.id;$('#chargeAmount').value=c.amount||0;$('#chargePaidAmount').value=c.paidAmount||0;$('#chargeStatus').value=c.status||'pending';$('#chargeNotes').value=c.notes||'';$('#chargeDialog').showModal()}

function showApp(user,p){
  clearTimeout(bootWatchdog);profile=p;state.authStatus='authenticated';
  $('#bootScreen').classList.add('hidden');$('#authScreen').classList.add('hidden');$('#appScreen').classList.remove('hidden');
  const admin=['admin','treasurer'].includes(p.role),trainer=p.role==='trainer',assistant=p.role==='assistant',coachingStaff=trainer||assistant,pendingTrainer=p.role==='pendingTrainer',pendingAssistant=p.role==='pendingAssistant',pendingStaff=pendingTrainer||pendingAssistant;
  $('#adminNav').classList.toggle('hidden',!admin);
  $('#familyNav').classList.toggle('hidden',admin||coachingStaff||pendingStaff);
  $('#trainerNav').classList.toggle('hidden',!coachingStaff);
  $('#pendingTrainerNav').classList.toggle('hidden',!pendingStaff);
  $('#roleBadge').textContent=p.role==='admin'?'Administrador':p.role==='treasurer'?'Tesorería':coachingStaff?(assistant?'Asistente':trainerLevelLabel(p.trainerLevel)):pendingStaff?pendingRoleLabel(p.role):p.accountType==='player'?'Jugadora':'Familia';
  $('#profileName').textContent=p.fullName||'—';$('#profileEmail').textContent=p.email||user.email;$('#profilePhone').textContent=p.phone||'—';
  $('#profileRole').textContent=pendingStaff?`${p.accountType==='assistant'?'Asistente':'Entrenador/a'} · pendiente de aprobación`:p.role+(p.accountType?` · ${p.accountType==='player'?'jugadora':p.accountType==='trainer'?'entrenador/a':p.accountType==='assistant'?'asistente':'encargado/a'}`:'');
  $('#editFullName').value=p.fullName||'';$('#editPhone').value=p.phone||'';$('#emailNotice').classList.toggle('hidden',user.emailVerified);stopRealtime();
  if(admin){go('dashboard');loadAdminData().then(()=>{startAdminRealtime();if(!state.familiesReconciled&&families.length===0&&players.some(x=>(x.linkedUserIds||[]).length)){state.familiesReconciled=true;reconcileFamilies(false).catch(console.error)}}).catch(e=>alert(err(e)))}
  else if(coachingStaff){go('trainerHome');loadTrainerData().catch(e=>alert(err(e)));}
  else if(pendingStaff){const label=p.role==='pendingAssistant'?'asistente':'entrenador';$('#trainerPendingStatus').textContent=p.status==='rejected'?'Solicitud no aprobada':'Pendiente de aprobación';$('#trainerPendingTitle').textContent=p.status==='rejected'?`Solicitud de ${label}`:`Solicitud de ${label} pendiente`;go('trainerPending');}
  else{state.familyDataLoading=true;go('familyHome');loadFamilyData().then(startFamilyRealtime).catch(e=>alert(err(e)));const payBtn=$('[data-view="familyPayments"]');if(payBtn)payBtn.classList.toggle('hidden',p.accountType==='player');}
}

function showOut(){clearTimeout(bootWatchdog);state.authStatus='unauthenticated';stopRealtime();$('#bootScreen').classList.add('hidden');$('#appScreen').classList.add('hidden');$('#authScreen').classList.remove('hidden')}

$$('.auth-tab').forEach(b=>b.onclick=()=>{$$('.auth-tab').forEach(x=>x.classList.toggle('active',x===b));$$('.auth-panel').forEach(x=>x.classList.toggle('active',x.id===b.dataset.panel))});
$$('.nav button').forEach(b=>b.onclick=()=>go(b.dataset.view));
$('#dashboardOpenPayments').onclick=()=>go('sinpeAdmin');
$('#dashboardOpenEvents').onclick=()=>go('events');
$('#upcomingEvents').onclick=e=>{const row=e.target.closest('[data-dashboard-event]');if(row)openEventDetail(row.dataset.dashboardEvent);};
$('#upcomingEvents').onkeydown=e=>{const row=e.target.closest('[data-dashboard-event]');if(row&&(e.key==='Enter'||e.key===' ')){e.preventDefault();openEventDetail(row.dataset.dashboardEvent);}};
$('#eventCalendarButton').onclick=e=>downloadSingleEventCalendar(e.currentTarget.dataset.eventId);
$('#categoryCalendarButton').onclick=e=>downloadCategoryCalendar(e.currentTarget.dataset.categoryId);
$('#editEventFromDetail').onclick=e=>{const id=e.currentTarget.dataset.eventId;$('#eventDetailDialog').close();openEvent(events.find(x=>x.id===id)||trainerEvents.find(x=>x.id===id));};
$('#dashboardOpenReports').onclick=()=>go('reports');
$('#dashboardRegisterPayment').onclick=()=>go('sinpeAdmin');
$('#dashboardNewEvent').onclick=()=>openEvent();
$('#dashboardNewPlayer').onclick=()=>openPlayer();
document.addEventListener('click',e=>{
  const target=e.target.closest('[data-dashboard-view]');
  if(target)go(target.dataset.dashboardView);
});

$('#notificationBellButton').onclick=()=>{$('#notificationPanel').classList.toggle('hidden');renderNotifications();};
$('#closeNotificationPanel').onclick=()=>$('#notificationPanel').classList.add('hidden');
$('#notificationList').onclick=async e=>{const item=e.target.closest('[data-notification-id]');if(!item)return;await markNotificationRead(item.dataset.notificationId).catch(console.warn);const n=notifications.find(x=>x.id===item.dataset.notificationId);$('#notificationPanel').classList.add('hidden');if(!n)return;if(n.kind==='event'&&n.sourceId)openEventDetail(n.sourceId);else if(n.kind==='announcement')go(isCoachingRole(profile?.role)?'trainerAnnouncements':profile?.role==='family'?'familyAnnouncements':'announcements');};
$('#markAllNotificationsRead').onclick=async()=>{for(const n of visibleNotifications().filter(n=>!notificationIsRead(n)))await markNotificationRead(n.id).catch(console.warn);};
document.addEventListener('click',e=>{if(!e.target.closest('#notificationPanel')&&!e.target.closest('#notificationBellButton'))$('#notificationPanel')?.classList.add('hidden');});
$$('.close-dialog').forEach(b=>b.onclick=()=>b.closest('dialog').close());
$('#registerPanel').onsubmit=async e=>{e.preventDefault();const b=$('#registerButton'),pw=$('#regPassword').value;if(pw!==$('#regPassword2').value)return alert('Las contraseñas no coinciden.');busy(b,true,'Creando…');registrationInProgress=true;let createdUser=null;try{const d={firstName:$('#regFirstName').value.trim(),lastName1:$('#regLastName1').value.trim(),lastName2:$('#regLastName2').value.trim(),phone:$('#regPhone').value.trim(),accountType:$('#regAccountType').value};d.fullName=`${d.firstName} ${d.lastName1} ${d.lastName2}`.replace(/\s+/g,' ').trim();const c=await createUserWithEmailAndPassword(auth,$('#regEmail').value.trim(),pw);createdUser=c.user;const p=await ensureProfile(c.user,d);await sendEmailVerification(c.user).catch(()=>{});registrationInProgress=false;showApp(c.user,p);toast(d.accountType==='trainer'?'Cuenta creada. Solicitud de entrenador enviada para aprobación.':d.accountType==='assistant'?'Cuenta creada. Solicitud de asistente enviada para aprobación.':'Cuenta creada.')}catch(x){if(createdUser){await deleteUser(createdUser).catch(()=>{});}registrationInProgress=false;alert(err(x))}finally{busy(b,false)}};
$('#loginPanel').onsubmit=async e=>{e.preventDefault();const b=$('#loginButton');busy(b,true,'Ingresando…');try{await signInWithEmailAndPassword(auth,$('#loginEmail').value.trim(),$('#loginPassword').value)}catch(x){alert(err(x))}finally{busy(b,false)}};
$('#forgotButton').onclick=async()=>{const email=$('#loginEmail').value.trim()||prompt('Correo:');if(email)try{await sendPasswordResetEmail(auth,email);toast('Correo de recuperación enviado.')}catch(x){alert(err(x))}};
$('#logoutButton').onclick=()=>signOut(auth);$('#resendVerificationButton').onclick=async()=>{try{await sendEmailVerification(auth.currentUser);toast('Verificación reenviada.')}catch(x){alert(err(x))}};

$('#linkRequestForm').onsubmit=async e=>{
  e.preventDefault();
  try{
    const playerCode=$('#linkPlayerCode').value.trim();
    const playerName=$('#linkPlayerName').value.trim();
    const categoryId=$('#linkCategory').value;
    if(!playerName)return alert('Escribe el nombre completo de la jugadora.');
    const duplicate=familyLinkRequests.some(r=>r.status==='pending'&&norm(r.playerName)===norm(playerName)&&norm(r.playerCode||'')===norm(playerCode));
    if(duplicate)return alert('Ya existe una solicitud pendiente para esta jugadora.');
    await addDoc(collection(db,'linkRequests'),{
      orgId:ORG_ID,
      userId:auth.currentUser.uid,
      playerCode,
      playerName,
      categoryId,
      relationship:$('#linkRelationship').value.trim(),
      notes:$('#linkNotes').value.trim(),
      status:'pending',
      createdAt:serverTimestamp(),
      updatedAt:serverTimestamp()
    });
    $('#linkRequestForm').reset();
    toast('Solicitud enviada para aprobación.');
  }catch(x){alert(err(x))}
};

$('#profileForm').onsubmit=async e=>{e.preventDefault();try{await updateDoc(doc(db,'users',auth.currentUser.uid),{fullName:$('#editFullName').value.trim(),phone:$('#editPhone').value.trim(),updatedAt:serverTimestamp()});profile.fullName=$('#editFullName').value.trim();profile.phone=$('#editPhone').value.trim();showApp(auth.currentUser,profile);toast('Perfil actualizado.')}catch(x){alert(err(x))}};

$('#newPlayerButton2').onclick=()=>openPlayer();

$('#addCategoryVideoButton').onclick=()=>{const id=$('#addCategoryVideoButton').dataset.categoryId;if(id)openCategoryVideo(null,id);};
$('#addVideoFromCategoryButton').onclick=()=>{const id=$('#categoryDocId').value;if(id)openCategoryVideo(null,id);};
$('#addEventFromCategoryButton').onclick=()=>{const id=$('#categoryDocId').value;if(id)openEventForCategory(id);};
$('#addTrainingFromCategoryButton').onclick=()=>{const id=$('#categoryDocId').value;if(id)openTrainingForCategory(id);};

$('#playerCategory').onchange=()=>{const selected=$$('#playerCategoriesEditor input:checked').map(i=>i.value);renderPlayerReinforcementEditor(selected);syncPlayerFinancialUI();};$('#playerInsured').onchange=syncInsuranceFields;
$('#newFamilyButton').onclick=()=>openFamily();$('#newSeasonButton').onclick=()=>openSeason();$('#newTrainingButton').onclick=()=>openTraining();$('#newCategoryButton').onclick=()=>openCategory();$('#newVenueButton').onclick=()=>openVenue();$('#newEventButton').onclick=()=>openEvent();$('#newAnnouncementButton').onclick=()=>openAnnouncement();
$('#addGuardianButton').onclick=()=>{if($$('.guardian-row').length>=3)return alert('Máximo 3 encargados.');$('#guardiansEditor').insertAdjacentHTML('beforeend',guardianRow())};
$('#guardiansEditor').onclick=e=>{if(e.target.classList.contains('remove-guardian'))e.target.closest('.guardian-row').remove()};
$('#playerSearch').oninput=renderPlayers;$('#playerCategoryFilter').onchange=renderPlayers;$('#playerStatusFilter').onchange=renderPlayers;$('#eventCategoryFilter').onchange=renderEvents;$('#eventTypeFilter').onchange=renderEvents;$('#eventSeasonFilter').onchange=renderEvents;$('#trainingCategoryFilter').onchange=renderTrainings;$('#trainingSeasonFilter').onchange=renderTrainings;$('#chargeMonthFilter').onchange=renderCharges;$('#chargeCategoryFilter').onchange=renderCharges;$('#chargeStatusFilter').onchange=renderCharges;$('#paymentsInboxSearch').oninput=renderPaymentsInbox;$('#paymentsInboxCategory').onchange=renderPaymentsInbox;$('#paymentsInboxMethod').onchange=renderPaymentsInbox;$('#paymentsInboxStatus').onchange=renderPaymentsInbox;$('#paymentReportType').onchange=()=>{generatedPaymentReport=[];updatePaymentReportStatusOptions();renderSinpeAdmin();};$('#paymentReportPeriodType').onchange=updatePaymentReportPeriodControls;$('#generatePaymentsReportButton').onclick=generatePaymentReport;$('#downloadPaymentsReportButton').onclick=exportPaymentReports;$('#paymentReportMonthsToggle').onclick=()=>togglePaymentMonthsMenu();$('#paymentReportMonths').onchange=updatePaymentMonthsLabel;$('#selectAllReportMonthsButton').onclick=()=>{$$('#paymentReportMonths input').forEach(i=>i.checked=true);updatePaymentMonthsLabel();};$('#clearReportMonthsButton').onclick=()=>{$$('#paymentReportMonths input').forEach(i=>i.checked=false);updatePaymentMonthsLabel();};$('#familyCategoryFilter').onchange=renderUsers;document.addEventListener('click',e=>{if(!e.target.closest('#paymentReportMonthsBox'))togglePaymentMonthsMenu(false);});updatePaymentReportStatusOptions();updatePaymentReportPeriodControls();

document.body.onclick=e=>{const t=e.target.closest('[data-edit-player],[data-edit-category],[data-view-category],[data-edit-venue],[data-edit-event],[data-edit-season],[data-edit-training],[data-training-exception],[data-training-future],[data-copy-address],[data-edit-announcement],[data-edit-charge],[data-approve-sinpe],[data-reject-sinpe],[data-view-player],[data-approve-link],[data-reject-link],[data-add-player-family],[data-view-family],[data-edit-family],[data-manage-family-members],[data-view-user],[data-player-finances],[data-edit-trainer],[data-approve-trainer],[data-reject-trainer],[data-delete-event],[data-family-category],[data-edit-category-video],[data-delete-category-video]');if(!t)return;const id=t.dataset.editPlayer;if(id)openPlayer(players.find(x=>x.id===id));const c=t.dataset.editCategory;if(c)openCategory(categories.find(x=>x.id===c));const vc=t.dataset.viewCategory;if(vc)openCategoryDetail(vc);const v=t.dataset.editVenue;if(v)openVenue(venues.find(x=>x.id===v));const ev=t.dataset.editEvent;if(ev)openEvent(events.find(x=>x.id===ev));const ss=t.dataset.editSeason;if(ss)openSeason(seasons.find(x=>x.id===ss));const tr=t.dataset.editTraining;if(tr)openTraining(trainingSeries.find(x=>x.id===tr));const tx=t.dataset.trainingException;if(tx)openTrainingException(trainingSeries.find(x=>x.id===tx));const tf=t.dataset.trainingFuture;if(tf)openTrainingFuture(trainingSeries.find(x=>x.id===tf));if(t.dataset.copyAddress){navigator.clipboard?.writeText(t.dataset.copyAddress);toast('Dirección copiada.')}const a=t.dataset.editAnnouncement;if(a)openAnnouncement(announcements.find(x=>x.id===a));const ch=t.dataset.editCharge;if(ch)openCharge(charges.find(x=>x.id===ch));const ap=t.dataset.approveSinpe;if(ap)approveSinpe(ap);const rj=t.dataset.rejectSinpe;if(rj)rejectSinpe(rj);const vp=t.dataset.viewPlayer;if(vp)openPlayerDetail(vp);const al=t.dataset.approveLink;if(al)approveLink(al);const rl=t.dataset.rejectLink;if(rl)rejectLink(rl);const af=t.dataset.addPlayerFamily;if(af)openFamilyMemberPicker(af);const mf=t.dataset.manageFamilyMembers;if(mf)openFamilyMemberPicker(mf);const vu=t.dataset.viewUser;if(vu)openUserDetail(vu);const vf=t.dataset.viewFamily;if(vf)openFamilyDetail(vf);const ef=t.dataset.editFamily;if(ef)openFamily(families.find(x=>x.id===ef));const pf=t.dataset.playerFinances;if(pf)openPlayerFinancialDetail(pf);const et=t.dataset.editTrainer;if(et)openTrainerEditor(trainerUsers.find(u=>u.id===et));const at=t.dataset.approveTrainer;if(at){const u=allUsers.find(x=>x.id===at);if(u){openTrainerEditor(u);$('#trainerRole').value=u.role==='pendingAssistant'?'assistant':'trainer';$('#trainerRole').onchange();}}const rt=t.dataset.rejectTrainer;if(rt){const u=allUsers.find(x=>x.id===rt);if(u&&confirm(`¿Rechazar la solicitud de ${u.role==='pendingAssistant'?'asistente':'entrenador'} de ${u.fullName||u.email}?`)){updateDoc(doc(db,'users',rt),{role:u.role,status:'rejected',updatedAt:serverTimestamp()}).then(()=>toast('Solicitud rechazada.')).catch(x=>alert(err(x)));}}const de=t.dataset.deleteEvent;if(de)deleteEventById(de);const fc=t.dataset.familyCategory;if(fc)openFamilyCategoryDetail(fc);const fce=t.dataset.familyCalendarEvent;if(fce)downloadSingleEventCalendar(fce);const ecv=t.dataset.editCategoryVideo;if(ecv)openCategoryVideo(categoryVideos.find(v=>v.id===ecv));const dcv=t.dataset.deleteCategoryVideo;if(dcv){const v=categoryVideos.find(x=>x.id===dcv);if(v&&confirm(`¿Está seguro de que desea eliminar el video "${v.title}"?`)){deleteDoc(doc(db,'categoryVideos',dcv)).then(async()=>{await loadAdminData();openCategoryDetail(v.categoryId);toast('Video eliminado.');}).catch(x=>alert(err(x)));}}};

$('#familyForm').onsubmit=async e=>{e.preventDefault();try{const id=$('#familyDocId').value,memberUserIds=$$('#familyUsersEditor input:checked').map(i=>i.value),playerIds=$$('#familyPlayersEditor input:checked').map(i=>i.value),data={orgId:ORG_ID,familyCode:$('#familyCode').value.trim(),name:$('#familyName').value.trim(),phone:$('#familyPhone').value.trim(),address:$('#familyAddress').value.trim(),notes:$('#familyNotes').value.trim(),status:$('#familyStatus').value,memberUserIds,playerIds,updatedAt:serverTimestamp()};let familyId=id;if(id)await updateDoc(doc(db,'families',id),data);else{const ref=await addDoc(collection(db,'families'),{...data,createdAt:serverTimestamp()});familyId=ref.id}const old=families.find(f=>f.id===id),oldUsers=new Set(old?.memberUserIds||[]),oldPlayers=new Set(old?.playerIds||[]),newUsers=new Set(memberUserIds),newPlayers=new Set(playerIds),batch=writeBatch(db);let operations=0;for(const u of familyUsers){if(newUsers.has(u.id)){batch.update(doc(db,'users',u.id),{familyId,updatedAt:serverTimestamp()});operations++;}else if(oldUsers.has(u.id)&&u.familyId===familyId){batch.update(doc(db,'users',u.id),{familyId:'',updatedAt:serverTimestamp()});operations++;}}for(const p of players){if(newPlayers.has(p.id)){const linkedUserIds=[...new Set(memberUserIds)];batch.update(doc(db,'players',p.id),{familyId,linkedUserIds,updatedAt:serverTimestamp()});operations++;charges.filter(c=>c.playerId===p.id).forEach(c=>{batch.update(doc(db,'charges',c.id),{userIds:linkedUserIds,updatedAt:serverTimestamp()});operations++;});}else if(oldPlayers.has(p.id)&&p.familyId===familyId){batch.update(doc(db,'players',p.id),{familyId:'',linkedUserIds:[],updatedAt:serverTimestamp()});operations++;charges.filter(c=>c.playerId===p.id).forEach(c=>{batch.update(doc(db,'charges',c.id),{userIds:[],updatedAt:serverTimestamp()});operations++;});}}if(operations)await batch.commit();$('#familyDialog').close();await loadAdminData();toast('Familia guardada.')}catch(x){alert(err(x))}};

$('#playerPhotoFile').onchange=e=>{const f=e.target.files?.[0];if(f)previewPhoto($('#playerPhotoPreview'),URL.createObjectURL(f),Date.now(),'Sin foto');};
$('#categoryPhotoFile').onchange=e=>{const f=e.target.files?.[0];if(f)previewPhoto($('#categoryPhotoPreview'),URL.createObjectURL(f),Date.now(),'Sin foto del equipo');};
$('#playerForm').onsubmit=async e=>{
  e.preventDefault();
  try{
    const id=$('#playerDocId').value,manualGuardians=$$('.guardian-row').map(r=>({id:r.dataset.id,sourceUserId:r.dataset.sourceUserId||'',name:r.querySelector('.g-name').value.trim(),relationship:r.querySelector('.g-rel').value.trim(),phone:r.querySelector('.g-phone').value.trim(),email:r.querySelector('.g-email').value.trim()})).filter(g=>g.name||g.phone||g.email),linkedUserIds=$$('#linkedUsersEditor input:checked').map(i=>i.value),guardians=guardiansFromLinkedUsers(linkedUserIds,manualGuardians);
    const primaryCategoryId=$('#playerCategory').value,reinforcementCategoryIds=$$('#playerCategoriesEditor input:checked').map(i=>i.value).filter(cid=>cid!==primaryCategoryId),categoryIds=[primaryCategoryId,...reinforcementCategoryIds],feeRaw=$('#playerFee').value;
    const data={orgId:ORG_ID,playerCode:$('#playerCode').value.trim(),name:$('#playerName').value.trim(),birthdate:$('#playerBirthdate').value,playerType:$('#playerType').value,categoryId:primaryCategoryId,reinforcementCategoryIds,categoryIds,permanentReinforcement:$('#playerPermanentReinforcement').checked,number:$('#playerNumber').value.trim(),position:$('#playerPosition').value.trim(),phone:$('#playerPhone').value.trim(),email:$('#playerEmail').value.trim(),province:$('#playerProvince').value.trim(),cantonDistrict:$('#playerCantonDistrict').value.trim(),address:$('#playerAddress').value.trim(),emergencyContact:{name:$('#playerEmergencyName').value.trim(),phone:$('#playerEmergencyPhone').value.trim()},insured:$('#playerInsured').checked,insurance:{provider:$('#playerInsurer').value.trim(),policyNumber:$('#playerPolicyNumber').value.trim(),expiryDate:$('#playerInsuranceExpiry').value,notes:$('#playerInsuranceNotes').value.trim()},customFee:isFirstDivisionCategoryId(primaryCategoryId)?null:(feeRaw===''?null:Number(feeRaw)||0),status:$('#playerStatus').value,notes:$('#playerNotes').value.trim(),guardians,linkedUserIds,updatedAt:serverTimestamp()};
    let playerId=id;if(id){await updateDoc(doc(db,'players',id),data);const related=charges.filter(c=>c.playerId===id);if(related.length){const batch=writeBatch(db);related.forEach(c=>batch.update(doc(db,'charges',c.id),{userIds:linkedUserIds,categoryId:primaryCategoryId,updatedAt:serverTimestamp()}));await batch.commit()}}else{const ref=await addDoc(collection(db,'players'),{...data,createdAt:serverTimestamp()});playerId=ref.id}
    const photoFile=$('#playerPhotoFile').files?.[0];if(photoFile){const photo=await uploadEntityPhoto('player',playerId,photoFile);await updateDoc(doc(db,'players',playerId),{...photo,updatedAt:serverTimestamp()});}
    $('#playerDialog').close();await loadAdminData();toast('Jugadora guardada.');
  }catch(x){alert(err(x))}
};


$('#categoryVideoForm').onsubmit=async e=>{
  e.preventDefault();
  try{
    const id=$('#categoryVideoDocId').value;
    const categoryId=$('#categoryVideoCategoryId').value;
    if(!categoryId)return alert('No se pudo identificar la categoría.');
    const data={
      orgId:ORG_ID,
      categoryId,
      title:$('#categoryVideoTitle').value.trim(),
      date:$('#categoryVideoDate').value,
      opponent:$('#categoryVideoOpponent').value.trim(),
      tournament:$('#categoryVideoTournament').value.trim(),
      url:$('#categoryVideoUrl').value.trim(),
      notes:$('#categoryVideoNotes').value.trim(),
      updatedAt:serverTimestamp()
    };
    if(id)await updateDoc(doc(db,'categoryVideos',id),data);
    else await addDoc(collection(db,'categoryVideos'),{...data,createdAt:serverTimestamp()});
    $('#categoryVideoDialog').close();
    await loadAdminData();
    if($('#categoryDialog')?.open)renderCategoryEditorRelations(categoryId);
    else if($('#categoryDetailDialog')?.open)openCategoryDetail(categoryId);
    toast('Video guardado.');
  }catch(x){alert(err(x))}
};

$('#categoryForm').onsubmit=async e=>{
  e.preventDefault();
  try{
    const id=$('#categoryDocId').value;
    const data={orgId:ORG_ID,name:$('#categoryName').value.trim(),ageGroup:$('#categoryAgeGroup').value.trim(),teamColor:$('#categoryTeamColor').value.trim(),fee:Number($('#categoryFee').value)||0,dueDay:Number($('#categoryDueDay').value)||15,seasonId:$('#categorySeason').value,status:$('#categoryStatus').value,coach:$('#categoryCoach').value.trim(),assistant:$('#categoryAssistant').value.trim(),schedule:$('#categorySchedule').value.trim(),venueId:$('#categoryVenue').value,notes:$('#categoryNotes').value.trim(),updatedAt:serverTimestamp()};
    let categoryId=id;
    if(id)await updateDoc(doc(db,'categories',id),data);
    else{const ref=await addDoc(collection(db,'categories'),{...data,createdAt:serverTimestamp()});categoryId=ref.id;}
    const categoryPhotoFile=$('#categoryPhotoFile').files?.[0];if(categoryPhotoFile){const photo=await uploadEntityPhoto('category',categoryId,categoryPhotoFile);await updateDoc(doc(db,'categories',categoryId),{...photo,updatedAt:serverTimestamp()});}

    const selectedPlayers=new Set($$('#categoryRosterEditor input:checked').map(i=>i.value));
    const batch=writeBatch(db);
    let operations=0;
    for(const p of players){
      const ids=playerCatIds(p);
      const has=ids.includes(categoryId);
      const should=selectedPlayers.has(p.id);
      if(has===should)continue;
      let next=should?[...new Set([...ids,categoryId])]:ids.filter(x=>x!==categoryId);
      const primary=next.includes(p.categoryId)?p.categoryId:(next[0]||'');
      batch.update(doc(db,'players',p.id),{categoryIds:next,categoryId:primary,reinforcementCategoryIds:next.filter(cid=>cid!==primary),updatedAt:serverTimestamp()});
      operations++;
    }
    if(operations)await batch.commit();

    await loadAdminData();
    $('#categoryDialog').close();
    toast('Categoría guardada correctamente.');
  }catch(x){alert(err(x))}
};
$('#venueForm').onsubmit=async e=>{e.preventDefault();try{const id=$('#venueDocId').value,data={orgId:ORG_ID,name:$('#venueName').value.trim(),address:$('#venueAddress').value.trim(),mapUrl:$('#venueMapUrl').value.trim(),directions:$('#venueDirections').value.trim(),status:$('#venueStatus').value,updatedAt:serverTimestamp()};if(id)await updateDoc(doc(db,'venues',id),data);else await addDoc(collection(db,'venues'),{...data,createdAt:serverTimestamp()});$('#venueDialog').close();await loadAdminData();toast('Lugar guardado.')}catch(x){alert(err(x))}};
$('#eventForm').onsubmit=async e=>{
  e.preventDefault();
  try{
    const id=$('#eventDocId').value,categoryId=$('#eventCategory').value,coaching=isCoachingRole(profile?.role);
    if(coaching&&!(profile.assignedCategoryIds||[]).includes(categoryId))return alert('Solo puedes crear o editar eventos de tus categorías asignadas.');
    const data={orgId:ORG_ID,categoryId,seasonId:$('#eventSeason').value,type:$('#eventType').value,title:$('#eventTitle').value.trim(),opponent:$('#eventOpponent').value.trim(),date:$('#eventDate').value,startTime:$('#eventStart').value,endTime:$('#eventEnd').value,homeAway:$('#eventHomeAway').value,venueId:$('#eventHomeAway').value==='away'?'':$('#eventVenue').value,awayVenueName:$('#eventAwayVenueName').value.trim(),awayAddress:$('#eventAwayAddress').value.trim(),locationUrl:$('#eventLocationUrl').value.trim(),uniform:$('#eventUniform').value,status:$('#eventStatus').value,notes:$('#eventNotes').value.trim(),updatedAt:serverTimestamp()};
    let eventId=id;if(id){const existing=events.find(x=>x.id===id)||trainerEvents.find(x=>x.id===id);if(coaching&&(!existing||!(profile.assignedCategoryIds||[]).includes(existing.categoryId)))return alert('No tienes permiso para editar este evento.');await updateDoc(doc(db,'events',id),data);}else{const ref=await addDoc(collection(db,'events'),{...data,createdBy:auth.currentUser.uid,createdByRole:profile?.role||'',createdAt:serverTimestamp()});eventId=ref.id}
    await createCategoryNotification({kind:'event',categoryId,title:id?'Evento actualizado':`Nuevo ${typeLabel(data.type).toLowerCase()}`,body:`${data.title} · ${data.date}${data.startTime?' · '+data.startTime:''}${data.homeAway==='away'?' · Visitante':''}`,sourceId:eventId});
    $('#eventDialog').close();
    if(coaching){await loadTrainerData();renderTrainerEvents();}else{await loadAdminData();}
    toast('Evento guardado.');
    if($('#categoryDialog')?.open)renderCategoryEditorRelations($('#categoryDocId').value);
  }catch(x){alert(err(x))}
};
$('#seasonForm').onsubmit=async e=>{e.preventDefault();try{const id=$('#seasonDocId').value,isCurrent=$('#seasonCurrent').checked,batch=writeBatch(db);if(isCurrent)seasons.filter(s=>s.isCurrent&&s.id!==id).forEach(s=>batch.update(doc(db,'seasons',s.id),{isCurrent:false,updatedAt:serverTimestamp()}));const data={orgId:ORG_ID,name:$('#seasonName').value.trim(),startDate:$('#seasonStart').value,endDate:$('#seasonEnd').value,status:$('#seasonStatus').value,isCurrent,updatedAt:serverTimestamp()};if(id)batch.update(doc(db,'seasons',id),data);else batch.set(doc(collection(db,'seasons')),{...data,createdAt:serverTimestamp()});await batch.commit();$('#seasonDialog').close();await loadAdminData();toast('Temporada guardada.')}catch(x){alert(err(x))}};
$('#trainingForm').onsubmit=async e=>{e.preventDefault();try{const id=$('#trainingDocId').value,days=$$('input[name="trainingDay"]:checked').map(i=>Number(i.value));if(!days.length)return alert('Selecciona al menos un día de entrenamiento.');const data={orgId:ORG_ID,categoryId:$('#trainingCategory').value,seasonId:$('#trainingSeason').value,days,startTime:$('#trainingStartTime').value,endTime:$('#trainingEndTime').value,startDate:$('#trainingStartDate').value,endDate:$('#trainingEndDate').value,venueId:$('#trainingVenue').value,status:$('#trainingStatus').value,notes:$('#trainingNotes').value.trim(),updatedAt:serverTimestamp()};if(id)await updateDoc(doc(db,'trainingSeries',id),data);else await addDoc(collection(db,'trainingSeries'),{...data,createdAt:serverTimestamp()});$('#trainingDialog').close();await loadAdminData();toast('Entrenamiento recurrente guardado.');if($('#categoryDialog')?.open)renderCategoryEditorRelations($('#categoryDocId').value);}catch(x){alert(err(x))}};
$('#trainingExceptionForm').onsubmit=async e=>{e.preventDefault();try{const seriesId=$('#trainingExceptionSeriesId').value,date=$('#trainingExceptionDate').value,existing=trainingExceptions.find(x=>x.seriesId===seriesId&&x.date===date);const data={orgId:ORG_ID,seriesId,date,action:$('#trainingExceptionAction').value,startTime:$('#trainingExceptionStart').value,endTime:$('#trainingExceptionEnd').value,venueId:$('#trainingExceptionVenue').value,notes:$('#trainingExceptionNotes').value.trim(),updatedAt:serverTimestamp()};if(existing)await updateDoc(doc(db,'trainingExceptions',existing.id),data);else await addDoc(collection(db,'trainingExceptions'),{...data,createdAt:serverTimestamp()});$('#trainingExceptionDialog').close();await loadAdminData();toast('Excepción guardada.')}catch(x){alert(err(x))}};
$('#trainingFutureForm').onsubmit=async e=>{e.preventDefault();try{const id=$('#trainingFutureSeriesId').value,t=trainingSeries.find(x=>x.id===id),from=$('#trainingFutureDate').value;if(!t||from<=t.startDate||from>t.endDate)return alert('La fecha debe estar dentro de la serie y ser posterior al inicio.');const batch=writeBatch(db);batch.update(doc(db,'trainingSeries',id),{endDate:datePlus(from,-1),updatedAt:serverTimestamp()});const {id:oldId,createdAt:oldCreated,updatedAt:oldUpdated,...base}=t;batch.set(doc(collection(db,'trainingSeries')),{...base,startDate:from,startTime:$('#trainingFutureStart').value,endTime:$('#trainingFutureEnd').value,venueId:$('#trainingFutureVenue').value,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});await batch.commit();$('#trainingFutureDialog').close();await loadAdminData();toast('Cambios aplicados a los entrenamientos siguientes.')}catch(x){alert(err(x))}};
$('#announcementForm').onsubmit=async e=>{e.preventDefault();try{const id=$('#announcementDocId').value,data={orgId:ORG_ID,title:$('#announcementTitle').value.trim(),categoryId:$('#announcementCategory').value,body:$('#announcementBody').value.trim(),status:$('#announcementStatus').value,updatedAt:serverTimestamp()};let announcementId=id;if(id)await updateDoc(doc(db,'announcements',id),data);else{const ref=await addDoc(collection(db,'announcements'),{...data,createdAt:serverTimestamp()});announcementId=ref.id}if(data.status==='published')await createCategoryNotification({kind:'announcement',categoryId:data.categoryId,title:id?'Comunicado actualizado':'Nuevo comunicado',body:data.title,sourceId:announcementId});$('#announcementDialog').close();await loadAdminData();toast('Comunicado guardado.')}catch(x){alert(err(x))}};
$('#chargeForm').onsubmit=async e=>{e.preventDefault();try{await updateDoc(doc(db,'charges',$('#chargeDocId').value),{amount:Number($('#chargeAmount').value)||0,paidAmount:Number($('#chargePaidAmount').value)||0,status:$('#chargeStatus').value,notes:$('#chargeNotes').value.trim(),updatedAt:serverTimestamp()});$('#chargeDialog').close();await loadAdminData();toast('Mensualidad actualizada.')}catch(x){alert(err(x))}};

$('#generateChargesButton').onclick=()=>{$('#generateMonth').value=monthNow();$('#generateCategory').value='';$('#generateDialog').showModal()};
$('#generateForm').onsubmit=async e=>{e.preventDefault();const month=$('#generateMonth').value,cat=$('#generateCategory').value,eligible=players.filter(p=>p.status==='active'&&!isFirstDivisionPrimary(p)&&playerMonthlyFee(p)>0&&(!cat||playerCatIds(p).includes(cat)));try{const existing=new Set(charges.filter(c=>c.month===month).map(c=>`${c.playerId}|${c.month}`)),batch=writeBatch(db);let count=0;for(const p of eligible){if(existing.has(`${p.id}|${month}`))continue;const amount=playerMonthlyFee(p);batch.set(doc(db,'charges',`${p.id}_${month}`),{orgId:ORG_ID,playerId:p.id,playerCode:p.playerCode,categoryId:p.categoryId,userIds:p.linkedUserIds||[],month,amount,paidAmount:0,status:'pending',dueDay:15,dueDate:dueDateForMonth(month),createdAt:serverTimestamp(),updatedAt:serverTimestamp()});count++}if(count)await batch.commit();$('#generateDialog').close();await loadAdminData();toast(`${count} mensualidades generadas.`)}catch(x){alert(err(x))}};

function availableSinpeCharges(){return familyCharges.filter(c=>['pending','partial'].includes(c.status)&&chargeRemaining(c)>0&&!activeReportForCharge(c.id))}
function populateSinpeMonths(){
  const playerId=$('#sinpePlayer').value,list=availableSinpeCharges().filter(c=>c.playerId===playerId).sort((a,b)=>(b.month||'').localeCompare(a.month||''));
  $('#sinpeMonth').innerHTML=list.map(c=>`<option value="${c.id}">${esc(monthLabel(c.month))} · Saldo ${money(chargeRemaining(c))}${chargeDueState(c)==='overdue'?' · Morosa':''}</option>`).join('');
  const c=list[0];$('#sinpeCharge').value=c?.id||'';$('#sinpeAmount').value=c?chargeRemaining(c):'';$('#sinpeSubmitButton').disabled=!c;
}
$('#openSinpeButton').onclick=()=>{
  const available=availableSinpeCharges(),playerIds=[...new Set(available.map(c=>c.playerId))];
  if(!available.length)return alert('No hay mensualidades disponibles para reportar. Los meses pagados o con un reporte pendiente no pueden pagarse nuevamente.');
  $('#sinpeForm').reset();$('#paymentMethod').value='sinpe';$('#sinpePlayer').innerHTML=playerIds.map(id=>`<option value="${id}">${esc(playerName(id))}</option>`).join('');
  $('#sinpeDate').value=today();$('#sinpePhone').value=profile.phone||'';$('#sinpePayer').value=profile.fullName||'';populateSinpeMonths();$('#sinpeDialog').showModal();
};
$('#sinpePlayer').onchange=populateSinpeMonths;
$('#sinpeMonth').onchange=()=>{const id=$('#sinpeMonth').value,c=familyCharges.find(x=>x.id===id);$('#sinpeCharge').value=id;if(c)$('#sinpeAmount').value=chargeRemaining(c)};
$('#sinpeForm').onsubmit=async e=>{e.preventDefault();const b=$('#sinpeSubmitButton');try{const c=familyCharges.find(x=>x.id===$('#sinpeCharge').value);if(!c)throw Error('Selecciona una mensualidad.');if(!['pending','partial'].includes(c.status)||chargeRemaining(c)<=0)throw Error('Esta mensualidad ya no tiene saldo pendiente.');if(activeReportForCharge(c.id))throw Error('Ya existe un pago reportado o aprobado para esta mensualidad.');const amount=Number($('#sinpeAmount').value),remaining=chargeRemaining(c);if(amount<=0||amount>remaining)throw Error(`El monto debe estar entre ₡1 y ${money(remaining)}.`);busy(b,true,'Enviando…');await addDoc(collection(db,'sinpeReports'),{orgId:ORG_ID,userId:auth.currentUser.uid,chargeId:c.id,playerId:c.playerId,playerCode:c.playerCode,month:c.month,paymentMethod:$('#paymentMethod').value,amount,date:$('#sinpeDate').value,time:$('#sinpeTime').value,bank:$('#sinpeBank').value.trim(),phone:$('#sinpePhone').value.trim(),payerName:$('#sinpePayer').value.trim(),reference:$('#sinpeReference').value.trim(),notes:$('#sinpeNotes').value.trim(),status:'reported',createdAt:serverTimestamp(),updatedAt:serverTimestamp()});$('#sinpeDialog').close();await loadFamilyData();toast('Pago reportado para revisión.')}catch(x){alert(err(x))}finally{busy(b,false)}};
async function approveSinpe(id){if(!confirm('¿Aprobar y aplicar este pago?'))return;try{const s=sinpeReports.find(x=>x.id===id),c=charges.find(x=>x.id===s.chargeId);if(!s||!c)throw Error('No se encontró la mensualidad asociada.');if(s.status!=='reported')throw Error('Este reporte ya fue procesado.');const remaining=chargeRemaining(c);if(remaining<=0)throw Error('Esta mensualidad ya está pagada.');const applied=Math.min(Number(s.amount||0),remaining),paid=Number(c.paidAmount||0)+applied,status=paid>=Number(c.amount||0)?'paid':'partial';const batch=writeBatch(db);batch.update(doc(db,'charges',c.id),{paidAmount:paid,status,updatedAt:serverTimestamp()});batch.update(doc(db,'sinpeReports',id),{status:'approved',approvedBy:auth.currentUser.uid,approvedAt:serverTimestamp(),updatedAt:serverTimestamp()});await batch.commit();await loadAdminData();toast('Pago aprobado.');renderPaymentsInbox();}catch(x){alert(err(x))}}
async function rejectSinpe(id){const reason=prompt('Motivo del rechazo:')||'';try{await updateDoc(doc(db,'sinpeReports',id),{status:'rejected',rejectionReason:reason,updatedAt:serverTimestamp()});await loadAdminData();toast('Pago rechazado.');renderPaymentsInbox();}catch(x){alert(err(x))}}


function renderPlayerImport(){populateSelectors();if($('#importDefaultCategory')&&!$('#importDefaultCategory').dataset.ready){const current=$('#importDefaultCategory').value;$('#importDefaultCategory').innerHTML='<option value="">Usar la categoría del archivo</option>'+categories.filter(c=>c.status==='active').map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');$('#importDefaultCategory').value=current;$('#importDefaultCategory').dataset.ready='true'}}
function canonicalImportKey(k){return norm(k).replace(/[^a-z0-9]/g,'')}
function importValue(row,names){const keys=Object.keys(row);for(const n of names){const found=keys.find(k=>canonicalImportKey(k)===canonicalImportKey(n));if(found!==undefined&&row[found]!==undefined&&row[found]!==null)return String(row[found]).trim()}return''}
function findCategoryByImportName(name){if(!name)return null;const n=norm(name);return categories.find(c=>norm(c.name)===n||norm(c.ageGroup)===n)||null}
function normalizeImportRow(row,index){
  const defaultCategory=$('#importDefaultCategory')?.value||'';
  const playerCode=importValue(row,['Player ID','PlayerID','Código','Codigo']);
  const name=importValue(row,['Nombre completo','Nombre','Jugadora']);
  const primaryText=importValue(row,['Categoría principal','Categoria principal','Categoría','Categoria']);
  const primary=defaultCategory?categories.find(c=>c.id===defaultCategory):findCategoryByImportName(primaryText);
  const reinforcementText=importValue(row,['Categorías que refuerza','Categorias que refuerza','Refuerza']);
  const reinforcementIds=reinforcementText.split(/[,;|]/).map(x=>findCategoryByImportName(x.trim())?.id).filter(Boolean).filter(id=>id!==primary?.id);
  const duplicate=players.some(p=>(playerCode&&norm(p.playerCode)===norm(playerCode))||(!playerCode&&name&&norm(p.name)===norm(name)&&p.categoryId===primary?.id));
  const errors=[];if(!name)errors.push('Falta nombre');if(!primary)errors.push('Categoría no reconocida');
  return {
    row:index+2,playerCode,name,primaryCategoryId:primary?.id||'',primaryCategoryName:primary?.name||primaryText,
    reinforcementCategoryIds:[...new Set(reinforcementIds)],
    birthdate:importValue(row,['Fecha de nacimiento','Nacimiento']),
    number:importValue(row,['Número','Numero']),
    position:importValue(row,['Posición','Posicion']),
    phone:importValue(row,['Teléfono','Telefono']),
    email:importValue(row,['Correo','Email']),
    insured:/^(si|sí|yes|true|1)$/i.test(importValue(row,['Seguro médico','Seguro medico','Asegurada'])),
    insurer:importValue(row,['Aseguradora']),
    policyNumber:importValue(row,['Número de póliza','Numero de poliza','Póliza','Poliza']),
    insuranceExpiry:importValue(row,['Vencimiento seguro','Vencimiento póliza','Vencimiento poliza']),
    guardianName:importValue(row,['Encargado','Nombre encargado']),
    guardianPhone:importValue(row,['Teléfono encargado','Telefono encargado']),
    permanentReinforcement:/^(si|sí|yes|true|1)$/i.test(importValue(row,['Refuerzo permanente'])),
    duplicate,errors,status:errors.length?'error':duplicate?'duplicate':'valid'
  };
}
function renderImportPreview(){
  const valid=importPreviewRows.filter(r=>r.status==='valid').length,duplicates=importPreviewRows.filter(r=>r.status==='duplicate').length,errors=importPreviewRows.filter(r=>r.status==='error').length;
  $('#playerImportSummary').innerHTML=[[importPreviewRows.length,'Filas'],[valid,'Listas para importar'],[duplicates,'Posibles duplicados'],[errors,'Con errores']].map(([v,l])=>`<article class="stat"><strong>${v}</strong><span>${l}</span></article>`).join('');
  $('#confirmPlayerImportButton').disabled=!valid;
  $('#playerImportPreview').innerHTML=`<table><thead><tr><th>Fila</th><th>Player ID</th><th>Nombre</th><th>Principal</th><th>Refuerza</th><th>Estado</th></tr></thead><tbody>${importPreviewRows.map(r=>`<tr><td>${r.row}</td><td>${esc(r.playerCode||'—')}</td><td>${esc(r.name||'—')}</td><td>${esc(r.primaryCategoryName||'—')}</td><td>${esc(r.reinforcementCategoryIds.map(catName).join(', ')||'—')}</td><td class="import-status-${r.status}">${r.status==='valid'?'Lista':r.status==='duplicate'?'Duplicado':esc(r.errors.join(', '))}</td></tr>`).join('')}</tbody></table>`;
}
function downloadPlayerTemplate(){
  if(!window.XLSX)return alert('No fue posible cargar el lector de Excel.');
  const rows=[{'Player ID':'ASB-0001','Nombre completo':'Nombre Apellido','Fecha de nacimiento':'2010-05-05','Categoría principal':'U-17 Rojo','Categorías que refuerza':'U-19, Primera División','Número':'11','Posición':'Outside Hitter','Teléfono':'','Correo':'','Seguro médico':'Sí','Aseguradora':'','Número de póliza':'','Vencimiento seguro':'','Encargado':'','Teléfono encargado':'','Refuerzo permanente':'No'}];
  const wb=XLSX.utils.book_new(),ws=XLSX.utils.json_to_sheet(rows);XLSX.utils.book_append_sheet(wb,ws,'Jugadoras');XLSX.writeFile(wb,'VolleyCore-Plantilla-Jugadoras.xlsx');
}
async function previewPlayerImport(){
  const file=$('#playerImportFile').files[0];if(!file)return alert('Selecciona un Excel o CSV.');
  if(!window.XLSX)return alert('No fue posible cargar el lector de Excel.');
  const data=await file.arrayBuffer(),wb=XLSX.read(data,{type:'array'}),sheet=wb.Sheets[wb.SheetNames[0]],rows=XLSX.utils.sheet_to_json(sheet,{defval:''});
  importPreviewRows=rows.map(normalizeImportRow);renderImportPreview();
}
async function confirmPlayerImport(){
  const ready=importPreviewRows.filter(r=>r.status==='valid');if(!ready.length)return alert('No hay registros válidos.');
  const b=$('#confirmPlayerImportButton');busy(b,true,'Importando…');
  try{
    let count=0;
    for(const r of ready){
      const categoryIds=[r.primaryCategoryId,...r.reinforcementCategoryIds];
      const guardians=r.guardianName||r.guardianPhone?[{id:crypto.randomUUID?.()||String(Date.now()+count),name:r.guardianName,relationship:'Encargado/a',phone:r.guardianPhone,email:''}]:[];
      await addDoc(collection(db,'players'),{
        orgId:ORG_ID,playerCode:r.playerCode||`ASB-${String(players.length+count+1).padStart(4,'0')}`,name:r.name,birthdate:r.birthdate,
        playerType:'minor',categoryId:r.primaryCategoryId,reinforcementCategoryIds:r.reinforcementCategoryIds,categoryIds,permanentReinforcement:r.permanentReinforcement,
        number:r.number,position:r.position,phone:r.phone,email:r.email,province:'',cantonDistrict:'',address:'',emergencyContact:{name:'',phone:''},
        insured:r.insured,insurance:{provider:r.insurer,policyNumber:r.policyNumber,expiryDate:r.insuranceExpiry,notes:''},
        customFee:null,status:'active',notes:'Importada desde Excel/CSV',guardians,linkedUserIds:[],createdAt:serverTimestamp(),updatedAt:serverTimestamp()
      });count++;
    }
    toast(`${count} jugadoras importadas.`);importPreviewRows=[];$('#playerImportFile').value='';$('#playerImportPreview').innerHTML='';$('#playerImportSummary').innerHTML='';$('#confirmPlayerImportButton').disabled=true;await loadAdminData();
  }catch(x){alert(err(x))}finally{busy(b,false)}
}
$('#downloadPlayerTemplateButton').onclick=downloadPlayerTemplate;
$('#previewPlayerImportButton').onclick=()=>previewPlayerImport().catch(e=>alert(err(e)));
$('#confirmPlayerImportButton').onclick=()=>confirmPlayerImport().catch(e=>alert(err(e)));

$('#exportPlayersButton').onclick=()=>downloadCSV('volleycore-jugadoras.csv',players.map(p=>({PlayerID:p.playerCode,Nombre:p.name,Categorias:catNames(p),Nacimiento:p.birthdate,Numero:p.number,Posicion:p.position,Encargados:(p.guardians||[]).map(g=>`${g.name} (${g.phone})`).join(' | '),Estado:p.status})));
$('#exportChargesButton').onclick=()=>downloadCSV('volleycore-mensualidades.csv',charges.map(c=>({Jugadora:playerName(c.playerId),PlayerID:c.playerCode,Mes:c.month,Monto:c.amount,Pagado:c.paidAmount,Estado:c.status})));
$('#exportEventsButton').onclick=()=>downloadCSV('volleycore-eventos.csv',events.map(e=>({Temporada:seasonName(e.seasonId),Categoria:catName(e.categoryId),Tipo:typeLabel(e.type),Titulo:e.title,Fecha:e.date,Inicio:e.startTime,Fin:e.endTime,Rival:e.opponent,Sede:venueName(e.venueId),Estado:e.status,Notas:e.notes})));$('#exportTrainingsButton').onclick=()=>downloadCSV('volleycore-entrenamientos.csv',trainingSeries.map(t=>({Temporada:seasonName(t.seasonId),Categoria:catName(t.categoryId),Dias:daysLabel(t.days),Inicio:t.startTime,Fin:t.endTime,Desde:t.startDate,Hasta:t.endDate,Sede:venueName(t.venueId),Estado:t.status,Notas:t.notes})));

$('#importV2Button').onclick=async()=>{const f=$('#v2File').files[0];if(!f)return alert('Selecciona el respaldo JSON.');const b=$('#importV2Button');busy(b,true,'Importando…');try{const data=JSON.parse(await f.text()),oldCats=data.categories||data.categorias||[],oldPlayers=data.players||data.jugadoras||[];const catMap=new Map(categories.map(c=>[norm(c.name),c.id]));for(const c of oldCats){const name=c.name||c.nombre;if(!name||catMap.has(norm(name)))continue;const r=await addDoc(collection(db,'categories'),{orgId:ORG_ID,name,fee:Number(c.fee||c.cuota||0),dueDay:Number(c.dueDay||10),status:c.status||'active',coach:'',assistant:'',schedule:'',venueId:'',createdAt:serverTimestamp(),updatedAt:serverTimestamp()});catMap.set(norm(name),r.id)}const codes=new Set(players.map(p=>p.playerCode));let count=0;for(const p of oldPlayers){const code=p.playerCode||p.code||p.id;if(!code||codes.has(code))continue;const catNameOld=p.categoryName||p.category||p.categoria||'';await addDoc(collection(db,'players'),{orgId:ORG_ID,playerCode:code,name:p.name||p.nombre||'',birthdate:p.birthdate||p.fechaNacimiento||'',categoryId:catMap.get(norm(catNameOld))||'',categoryIds:[catMap.get(norm(catNameOld))].filter(Boolean),number:p.number||p.numero||'',position:p.position||p.posicion||'',customFee:Number(p.customFee||p.fee||0),status:p.status||'active',notes:p.notes||'',guardians:p.guardians||p.encargados||[],linkedUserIds:[],createdAt:serverTimestamp(),updatedAt:serverTimestamp()});count++}$('#importResult').textContent=`Importación completada: ${count} jugadoras nuevas.`;$('#importResult').classList.remove('hidden');await loadAdminData()}catch(x){alert(err(x))}finally{busy(b,false)}};


function openPlayerDetail(id){
  try{
    const p=players.find(x=>x.id===id)||familyPlayers.find(x=>x.id===id)||trainerPlayers.find(x=>x.id===id);
    if(!p)throw Error('No se encontró la jugadora.');
    const adminAllowed=['admin','treasurer'].includes(profile.role),familyAllowed=(p.linkedUserIds||[]).includes(auth.currentUser.uid),trainerAllowed=isCoachingRole(profile.role)&&playerCatIds(p).some(cid=>(profile.assignedCategoryIds||[]).includes(cid));
    if(!adminAllowed&&!familyAllowed&&!trainerAllowed)throw Error('No tienes acceso a esta jugadora.');
    const dlg=$('#playerDetailDialog');$('#playerDetailTitle').textContent=p.name;
    const insurance=playerInsuranceState(p),financial=playerFinancialState(p),showContacts=adminAllowed||familyAllowed||(trainerAllowed&&profile.permissions?.viewContacts),showFinancial=adminAllowed||familyAllowed||(trainerAllowed&&profile.permissions?.viewFinancialStatus);
    const categoryBlocks=playerCatIds(p).map(cid=>{const c=categories.find(x=>x.id===cid)||{},tr=trainingSeries.filter(t=>t.categoryId===cid&&t.status==='active'),ev=events.filter(e=>e.categoryId===cid&&e.date>=today()&&e.status!=='cancelled').slice(0,5);return`<article class="panel profile-section"><span class="badge ${cid===p.categoryId?'active':'neutral'}">${cid===p.categoryId?'Categoría principal':'Refuerzo'}</span><h4>${esc(c.name||'Categoría')}</h4><p>Entrenador/a: ${esc(c.coach||'Por definir')}<br>Asistente: ${esc(c.assistant||'Por definir')}</p>${tr.map(t=>`<div><strong>${esc(daysLabel(t.days||[]))}</strong> · ${esc(t.startTime||'')} – ${esc(t.endTime||'')}<br>${esc(venueName(t.venueId))}${venueLinks(t.venueId)}</div>`).join('')||'<p class="muted">Sin entrenamiento configurado.</p>'}${ev.length?`<h5>Próximos eventos</h5>${ev.map(eventMini).join('')}`:''}</article>`}).join('');
    const guardians=showContacts?`<article class="panel"><h4>Contactos / encargados</h4>${(p.guardians||[]).map(g=>`<p><strong>${esc(g.name)}</strong><br>${esc(g.relationship||'')} · ${esc(g.phone||'')} · ${esc(g.email||'')}</p>`).join('')||'<p class="muted">Sin encargados registrados.</p>'}${p.phone||p.email?`<hr><p><strong>Contacto de la jugadora</strong><br>${esc(p.phone||'—')} · ${esc(p.email||'—')}</p>`:''}</article>`:'';
    $('#playerDetailContent').innerHTML=`<div class="profile-label-row"><span class="badge active">Jugadora de: ${esc(primaryCategoryName(p))}</span>${reinforcementCategoryIds(p).length?`<span class="badge neutral">Refuerza: ${esc(reinforcementCategoryNames(p))}</span>`:''}${p.permanentReinforcement?'<span class="badge neutral">Refuerzo permanente</span>':''}<span class="badge ${insurance.key}">${esc(insurance.label)}</span>${showFinancial?`<span class="badge ${financial.key}">${esc(financial.label)}</span>`:''}</div><div class="grid two"><article class="panel"><div class="player-profile-hero">${p.photoUrl?`<img class="player-profile-photo" src="${esc(cacheBustedImage(p.photoUrl,p.photoVersion))}" alt="${esc(p.name)}">`:'<div class="player-profile-photo placeholder">🏐</div>'}<div><span class="eyebrow">${esc(p.playerCode)}</span><h3>${esc(p.name)}</h3></div></div><div class="profile-data-list"><div><strong>Fecha de nacimiento</strong>${esc(p.birthdate||'—')}</div><div><strong>Tipo</strong>${esc(p.playerType==='adult'?'Mayor de edad':'Menor de edad')}</div><div><strong>Número</strong>${esc(p.number||'—')}</div><div><strong>Posición</strong>${esc(p.position||'—')}</div>${showContacts?`<div><strong>Teléfono</strong>${esc(p.phone||'—')}</div><div><strong>Correo</strong>${esc(p.email||'—')}</div><div><strong>Residencia</strong>${esc([p.cantonDistrict,p.province].filter(Boolean).join(', ')||'—')}</div>`:''}</div></article>${guardians}</div><article class="panel"><h4>Seguro médico</h4><p><strong>Estado:</strong> ${esc(insurance.label)}<br><strong>Aseguradora:</strong> ${esc(p.insurance?.provider||'—')}<br><strong>Póliza:</strong> ${esc(p.insurance?.policyNumber||'—')}<br><strong>Vencimiento:</strong> ${esc(p.insurance?.expiryDate||'—')}</p><p class="muted">${esc(p.insurance?.notes||'')}</p></article>${showFinancial?`<article class="panel"><h4>Estado financiero</h4><p><strong>${esc(financial.label)}</strong> · ${esc(financial.detail)}</p>${isFirstDivisionPrimary(p)?'<p class="muted">Primera División no genera mensualidad.</p>':''}</article>`:''}<h3>Información por categoría</h3><div class="cards-grid">${categoryBlocks||'<p class="muted">Sin categorías asociadas.</p>'}</div>`;
    if(!dlg.open)dlg.showModal();
  }catch(x){alert(err(x))}
}
async function approveLink(id){
  const r=linkRequests.find(x=>x.id===id);
  if(!r)return;
  try{
    let p=null;

    // 1) Prefer an already resolved Firestore player document id.
    if(r.playerId)p=players.find(x=>x.id===r.playerId)||null;

    // 2) Exact Player ID/code if supplied.
    if(!p&&r.playerCode){
      const exactCode=players.filter(x=>norm(x.playerCode)===norm(r.playerCode));
      if(exactCode.length===1)p=exactCode[0];
    }

    // 3) Exact full name + category.
    if(!p&&r.playerName){
      let exactName=players.filter(x=>norm(x.name)===norm(r.playerName));
      if(r.categoryId){
        const inCategory=exactName.filter(x=>playerCatIds(x).includes(r.categoryId));
        if(inCategory.length===1)p=inCategory[0];
      }
      // 4) Exact full name globally if unique, even if category in request is stale.
      if(!p&&exactName.length===1)p=exactName[0];
    }

    if(!p){
      return alert('No se pudo identificar de forma segura a la jugadora. Revisa el Player ID, nombre y categoría de la solicitud antes de aprobar.');
    }

    const ids=[...new Set([...(p.linkedUserIds||[]),r.userId])];
    const playerFam=families.find(f=>(f.playerIds||[]).includes(p.id));
    const userFam=families.find(f=>(f.memberUserIds||[]).includes(r.userId));
    let fam=playerFam||userFam;

    if(playerFam&&userFam&&playerFam.id!==userFam.id){
      const mergedUsers=[...new Set([...(playerFam.memberUserIds||[]),...(userFam.memberUserIds||[])])];
      const mergedPlayers=[...new Set([...(playerFam.playerIds||[]),...(userFam.playerIds||[])])];
      const mb=writeBatch(db);
      mb.update(doc(db,'families',playerFam.id),{memberUserIds:mergedUsers,playerIds:mergedPlayers,updatedAt:serverTimestamp()});
      mb.update(doc(db,'families',userFam.id),{status:'merged',mergedInto:playerFam.id,updatedAt:serverTimestamp()});
      mergedPlayers.forEach(pid=>mb.update(doc(db,'players',pid),{familyId:playerFam.id,updatedAt:serverTimestamp()}));
      mergedUsers.forEach(uid=>mb.update(doc(db,'users',uid),{familyId:playerFam.id,updatedAt:serverTimestamp()}));
      await mb.commit();
      fam={...playerFam,memberUserIds:mergedUsers,playerIds:mergedPlayers};
    }

    if(!fam){
      const ref=await addDoc(collection(db,'families'),{
        orgId:ORG_ID,
        familyCode:`FAM-${String(families.length+1).padStart(4,'0')}`,
        name:`Familia ${p.name.split(' ').slice(-2).join(' ')}`,
        memberUserIds:ids,
        playerIds:[p.id],
        status:'active',
        createdAt:serverTimestamp(),
        updatedAt:serverTimestamp()
      });
      fam={id:ref.id,memberUserIds:ids,playerIds:[p.id]};
    }

    const memberUserIds=[...new Set([...(fam.memberUserIds||[]),...ids])];
    const playerIds=[...new Set([...(fam.playerIds||[]),p.id])];
    const batch=writeBatch(db);
    batch.update(doc(db,'families',fam.id),{memberUserIds,playerIds,updatedAt:serverTimestamp()});
    batch.update(doc(db,'players',p.id),{linkedUserIds:ids,familyId:fam.id,updatedAt:serverTimestamp()});
    batch.update(doc(db,'users',r.userId),{familyId:fam.id,updatedAt:serverTimestamp()});
    batch.update(doc(db,'linkRequests',id),{
      status:'approved',
      playerId:p.id,
      playerCode:p.playerCode||r.playerCode||'',
      categoryId:p.categoryId||r.categoryId||'',
      familyId:fam.id,
      approvedBy:auth.currentUser.uid,
      updatedAt:serverTimestamp()
    });
    charges.filter(c=>c.playerId===p.id).forEach(c=>batch.update(doc(db,'charges',c.id),{userIds:ids,updatedAt:serverTimestamp()}));
    await batch.commit();
    await loadAdminData();
    toast('Vinculación aprobada.');
  }catch(x){alert(err(x))}
}

async function rejectLink(id){await updateDoc(doc(db,'linkRequests',id),{status:'rejected',updatedAt:serverTimestamp()});await loadAdminData();toast('Solicitud rechazada.')}

function openFamilyMemberPicker(familyId){const fam=families.find(f=>f.id===familyId);if(!fam)return;state.familyPickerId=familyId;$('#familyMemberPickerTitle').textContent=`Miembros de ${fam.name||'la familia'}`;$('#familyMemberSearch').value='';$('#familyMemberCategory').innerHTML='<option value="">Todas las categorías</option>'+categories.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');$('#familyMemberOnlyUnassigned').checked=false;renderFamilyMemberPicker();$('#familyMemberPickerDialog').showModal()}
function renderFamilyMemberPicker(){const fam=families.find(f=>f.id===state.familyPickerId);if(!fam)return;const term=norm($('#familyMemberSearch').value),cat=$('#familyMemberCategory').value,only=$('#familyMemberOnlyUnassigned').checked;const ps=players.filter(p=>(!term||norm(`${p.name} ${p.playerCode}`).includes(term))&&(!cat||playerCatIds(p).includes(cat))&&(!only||!p.familyId||p.familyId===fam.id));const us=familyUsers.filter(u=>(!term||norm(`${u.fullName} ${u.email} ${u.phone}`).includes(term))&&(!only||!u.familyId||u.familyId===fam.id));$('#familyMemberPlayers').innerHTML=ps.map(p=>`<label class="picker-item"><input type="checkbox" value="${p.id}" ${(fam.playerIds||[]).includes(p.id)?'checked':''}><span><strong>${esc(p.name)}</strong><small>${esc(p.playerCode)} · ${esc(catNames(p))}</small>${p.familyId&&p.familyId!==fam.id?`<em>Actualmente en ${esc(families.find(f=>f.id===p.familyId)?.name||'otra familia')}</em>`:''}</span></label>`).join('')||'<p class="muted">No hay jugadoras que coincidan.</p>';$('#familyMemberUsers').innerHTML=us.map(u=>`<label class="picker-item"><input type="checkbox" value="${u.id}" ${(fam.memberUserIds||[]).includes(u.id)?'checked':''}><span><strong>${esc(u.fullName)}</strong><small>${esc(u.email)} · ${esc(u.phone||'Sin teléfono')}</small>${u.familyId&&u.familyId!==fam.id?`<em>Actualmente en ${esc(families.find(f=>f.id===u.familyId)?.name||'otra familia')}</em>`:''}</span></label>`).join('')||'<p class="muted">No hay usuarios que coincidan.</p>'}
async function saveFamilyMembers(){
  const fam=families.find(f=>f.id===state.familyPickerId);if(!fam)return;
  const saveButton=$('#saveFamilyMembersButton');
  const playerIds=$$('#familyMemberPlayers input:checked').map(x=>x.value),memberUserIds=$$('#familyMemberUsers input:checked').map(x=>x.value);
  const movedPlayers=players.filter(p=>playerIds.includes(p.id)&&p.familyId&&p.familyId!==fam.id),movedUsers=familyUsers.filter(u=>memberUserIds.includes(u.id)&&u.familyId&&u.familyId!==fam.id);
  if(movedPlayers.length||movedUsers.length){
    const total=movedPlayers.length+movedUsers.length;
    const ok=await confirmAction(`${total} ${total===1?'persona pertenece':'personas pertenecen'} a otra familia. ¿Deseas mover ${total===1?'este registro':'estos registros'} a ${fam.name||'esta familia'}?`,{title:'Mover miembros de familia',acceptText:'Mover y guardar'});
    if(!ok)return;
  }
  busy(saveButton,true,'Guardando…');
  try{
    const batch=writeBatch(db);batch.update(doc(db,'families',fam.id),{playerIds,memberUserIds,updatedAt:serverTimestamp()});
    for(const p of players){if(playerIds.includes(p.id)){const linkedUserIds=[...new Set([...(p.linkedUserIds||[]),...memberUserIds])];batch.update(doc(db,'players',p.id),{familyId:fam.id,linkedUserIds,updatedAt:serverTimestamp()});charges.filter(c=>c.playerId===p.id).forEach(c=>batch.update(doc(db,'charges',c.id),{userIds:linkedUserIds,updatedAt:serverTimestamp()}));}else if(p.familyId===fam.id){batch.update(doc(db,'players',p.id),{familyId:null,updatedAt:serverTimestamp()});}}
    for(const u of familyUsers){if(memberUserIds.includes(u.id))batch.update(doc(db,'users',u.id),{familyId:fam.id,updatedAt:serverTimestamp()});else if(u.familyId===fam.id)batch.update(doc(db,'users',u.id),{familyId:null,updatedAt:serverTimestamp()});}
    for(const other of families.filter(x=>x.id!==fam.id)){const np=(other.playerIds||[]).filter(id=>!playerIds.includes(id)),nu=(other.memberUserIds||[]).filter(id=>!memberUserIds.includes(id));if(np.length!==(other.playerIds||[]).length||nu.length!==(other.memberUserIds||[]).length)batch.update(doc(db,'families',other.id),{playerIds:np,memberUserIds:nu,updatedAt:serverTimestamp()});}
    await batch.commit();$('#familyMemberPickerDialog').close();toast('✓ Miembros de la familia actualizados.');
  }finally{busy(saveButton,false)}
}

function openUserDetail(id){const u=familyUsers.find(x=>x.id===id);if(!u)return alert('No se encontró el usuario.');const linked=players.filter(p=>(p.linkedUserIds||[]).includes(id));$('#userDetailTitle').textContent=u.fullName;$('#userDetailContent').innerHTML=`<article class="panel"><span class="eyebrow">${esc(u.accountType==='player'?'Cuenta de jugadora':'Cuenta familiar')}</span><p><strong>Correo:</strong> ${esc(u.email||'—')}<br><strong>Teléfono:</strong> ${esc(u.phone||'—')}<br><strong>Estado:</strong> ${esc(statusLabel(u.status||'active'))}</p></article><h4>Jugadoras vinculadas</h4><div class="member-list">${linked.map(p=>`<button class="person-row" data-view-player="${p.id}"><span class="person-icon">🏐</span><span><strong>${esc(p.name)}</strong><small>${esc(p.playerCode)} · ${esc(catNames(p))}</small></span><span>›</span></button>`).join('')||'<p class="muted">No tiene jugadoras vinculadas.</p>'}</div>`;$('#userDetailDialog').showModal()}

function stopRealtime(){[...state.adminListeners,...state.familyListeners].forEach(u=>{try{u()}catch{}});state.adminListeners=[];state.familyListeners=[];}
function startAdminRealtime(){state.adminListeners.push(onSnapshot(query(collection(db,'attendanceRecords'),where('orgId','==',ORG_ID)),snap=>{attendanceRecords=snap.docs.map(d=>({id:d.id,...d.data()}));if(state.currentView==='attendance')renderAttendance();},console.error));state.adminListeners.push(onSnapshot(query(collection(db,'categoryVideos'),where('orgId','==',ORG_ID)),snap=>{categoryVideos=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.date||'').localeCompare(a.date||''));if(state.currentView==='categories')renderCategories();},console.error));stopRealtime();const org=qname=>query(collection(db,qname),where('orgId','==',ORG_ID));state.adminListeners.push(onSnapshot(org('linkRequests'),snap=>{linkRequests=snap.docs.map(d=>({id:d.id,...d.data()}));if(state.currentView==='users')renderUsers();renderDashboard();},console.error));state.adminListeners.push(onSnapshot(org('players'),snap=>{players=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.name||'').localeCompare(b.name||''));if(state.currentView==='players')renderPlayers();if(state.currentView==='users')renderUsers();renderDashboard();},console.error));state.adminListeners.push(onSnapshot(query(collection(db,'users'),where('orgId','==',ORG_ID)),snap=>{allUsers=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.fullName||'').localeCompare(b.fullName||''));familyUsers=allUsers.filter(u=>u.role==='family');trainerUsers=allUsers.filter(u=>isCoachingRole(u.role));if(state.currentView==='users')renderUsers();if(state.currentView==='trainers')renderTrainers();renderDashboard();},console.error));state.adminListeners.push(onSnapshot(org('families'),snap=>{families=snap.docs.map(d=>({id:d.id,...d.data()})).filter(f=>f.status!=='merged');if(state.currentView==='users')renderUsers();renderDashboard();},console.error));}
function startFamilyRealtime(){state.familyListeners.forEach(u=>u());state.familyListeners=[];const uid=auth.currentUser.uid;state.familyListeners.push(onSnapshot(query(collection(db,'players'),where('orgId','==',ORG_ID),where('linkedUserIds','array-contains',uid)),snap=>{familyPlayers=snap.docs.map(d=>({id:d.id,...d.data()}));deriveFamilyData();renderFamilyHome();if(state.currentView==='familyTrainings')renderFamilyTrainings();if(state.currentView==='familyEvents')renderFamilyEvents();if(state.currentView==='familyCategories')renderFamilyCategories();},e=>console.error(e)));state.familyListeners.push(onSnapshot(query(collection(db,'linkRequests'),where('orgId','==',ORG_ID),where('userId','==',uid)),snap=>{familyLinkRequests=snap.docs.map(d=>({id:d.id,...d.data()}));renderFamilyLink();},e=>console.error(e)));state.familyListeners.push(onSnapshot(query(collection(db,'families'),where('orgId','==',ORG_ID),where('memberUserIds','array-contains',uid)),snap=>{families=snap.docs.map(d=>({id:d.id,...d.data()}));},e=>console.error(e)));}
async function reconcileFamilies(showToast=true){const linked=players.filter(p=>(p.linkedUserIds||[]).length);if(!linked.length){if(showToast)toast('No hay vinculaciones para reconciliar.');return}const unseen=new Set(linked.map(p=>p.id)),components=[];while(unseen.size){const seed=unseen.values().next().value,queue=[seed],pids=[],uids=new Set;unseen.delete(seed);while(queue.length){const id=queue.shift(),p=players.find(x=>x.id===id);if(!p)continue;pids.push(id);(p.linkedUserIds||[]).forEach(u=>uids.add(u));for(const other of [...unseen]){const op=players.find(x=>x.id===other);if((op?.linkedUserIds||[]).some(u=>uids.has(u))){unseen.delete(other);queue.push(other);}}}components.push({pids,uids:[...uids]});}
for(const comp of components){const matched=families.filter(f=>(f.playerIds||[]).some(id=>comp.pids.includes(id))||(f.memberUserIds||[]).some(id=>comp.uids.includes(id)));let fam=matched[0];if(!fam){const first=players.find(p=>p.id===comp.pids[0]);const ref=await addDoc(collection(db,'families'),{orgId:ORG_ID,familyCode:`FAM-${String(families.length+1).padStart(4,'0')}`,name:`Familia ${(first?.name||'VolleyCore').split(' ').slice(-2).join(' ')}`,memberUserIds:comp.uids,playerIds:comp.pids,status:'active',createdAt:serverTimestamp(),updatedAt:serverTimestamp()});fam={id:ref.id};families.push(fam)}const batch=writeBatch(db);batch.update(doc(db,'families',fam.id),{memberUserIds:comp.uids,playerIds:comp.pids,status:'active',updatedAt:serverTimestamp()});matched.slice(1).forEach(extra=>batch.update(doc(db,'families',extra.id),{status:'merged',mergedInto:fam.id,updatedAt:serverTimestamp()}));comp.pids.forEach(id=>batch.update(doc(db,'players',id),{familyId:fam.id,updatedAt:serverTimestamp()}));comp.uids.forEach(id=>batch.update(doc(db,'users',id),{familyId:fam.id,updatedAt:serverTimestamp()}));await batch.commit();}if(showToast)toast('Familias reconciliadas correctamente.');}
$('#reconcileFamiliesButton').onclick=()=>reconcileFamilies(true).catch(e=>alert(err(e)));$('#editFamilyFromDetail').onclick=e=>{const id=e.currentTarget.dataset.familyId;$('#familyDetailDialog').close();openFamily(families.find(f=>f.id===id));};$('#manageFamilyMembersFromDetail').onclick=e=>{const id=e.currentTarget.dataset.familyId;$('#familyDetailDialog').close();openFamilyMemberPicker(id)};$('#familyMemberSearch').oninput=renderFamilyMemberPicker;$('#familyMemberCategory').onchange=renderFamilyMemberPicker;$('#familyMemberOnlyUnassigned').onchange=renderFamilyMemberPicker;$('#saveFamilyMembersButton').onclick=()=>saveFamilyMembers().catch(e=>alert(err(e)));

onAuthStateChanged(auth,async user=>{
  state.authStatus=user?'resolving':'loading';
  $('#bootScreen').classList.remove('hidden');
  $('#authScreen').classList.add('hidden');
  $('#appScreen').classList.add('hidden');
  if(!user){showOut();$('#startupStatus').textContent='Firebase conectado. Puedes ingresar o crear una cuenta.';$('#startupStatus').className='notice success';return}
  if(registrationInProgress){state.authStatus='resolving';return;}
  try{
    const cached=readCachedProfile(user.uid);
    if(cached){
      showApp(user,cached);
      ensureProfile(user).then(fresh=>{
        profile=fresh;cacheProfile(user.uid,fresh);
        if(fresh.role!==cached.role||fresh.status!==cached.status||JSON.stringify(fresh.assignedCategoryIds||[])!==JSON.stringify(cached.assignedCategoryIds||[])){
          showApp(user,fresh);
        }
      }).catch(e=>console.warn('No se pudo refrescar el perfil en segundo plano:',e));
      return;
    }
    const p=await ensureProfile(user);
    showApp(user,p);
  }catch(x){
    clearTimeout(bootWatchdog);console.error('Error de inicio:',x);
    $('#bootScreen').classList.add('hidden');
    $('#appScreen').classList.add('hidden');
    $('#authScreen').classList.remove('hidden');
    $('#startupStatus').textContent=err(x);
    $('#startupStatus').className='notice error';
  }
});