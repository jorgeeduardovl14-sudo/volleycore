import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import {initializeAppCheck,ReCaptchaEnterpriseProvider} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app-check.js';
import {getAuth,createUserWithEmailAndPassword,signInWithEmailAndPassword,signOut,deleteUser,sendPasswordResetEmail,sendEmailVerification,onAuthStateChanged,getIdToken} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import {getFirestore,doc,getDoc,setDoc,updateDoc,deleteDoc,serverTimestamp,collection,getDocs,query,where,addDoc,writeBatch,onSnapshot,deleteField} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import {getStorage,ref as storageRef,uploadBytes,getDownloadURL} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js';

const firebaseConfig={apiKey:'AIzaSyDIDmHohUqyJ4xhmY_YXV1Ba95jQ96IY8Q',authDomain:'asbavol-gestion.firebaseapp.com',projectId:'asbavol-gestion',storageBucket:'asbavol-gestion.firebasestorage.app',messagingSenderId:'112087607790',appId:'1:112087607790:web:051beaa435ccb14b7506ff'};
const ORG_ID='asbavol';
const app=initializeApp(firebaseConfig);
const appCheck=initializeAppCheck(app,{
  provider:new ReCaptchaEnterpriseProvider('6LcZLoEtAAAAALVXiUfpp-SMXgG5KpeTvcmJfz_c'),
  isTokenAutoRefreshEnabled:true
});
const auth=getAuth(app),db=getFirestore(app),storage=getStorage(app);

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
let registrationInProgress=false;
let profile=null,playerPrivateById=new Map(),players=[],categories=[],venues=[],events=[],announcements=[],charges=[],sinpeReports=[],onvoPayments=[],shirtRequests=[],allUsers=[],familyUsers=[],trainerUsers=[],families=[],seasons=[],trainingSeries=[],trainingExceptions=[],linkRequests=[],categoryVideos=[],attendanceRecords=[],notifications=[],exitRecords=[],categoryGallery=[],fixedExpenses=[],sponsorIncome=[];
const state={authStatus:'loading',currentView:null,adminListeners:[],familyListeners:[],familiesReconciled:false,familyDataLoading:false,familyPickerId:null,notificationUnsub:null,shirtUnsub:null};

const VIEW_STORAGE_KEY='volleycore-current-view';
const viewGroups={
  admin:new Set(['dashboard','players','categories','seasons','trainings','attendance','events','venues','announcements','finances','sinpeAdmin','users','userAdmin','linkAdmin','offboarding','shirtAdmin','pilotAdmin','trainers','import','reports','profile','about']),
  coaching:new Set(['trainerHome','trainerPlayers','trainerTrainings','trainerAttendance','trainerEvents','trainerAnnouncements','pilotSurvey','pilotFeature','profile','about']),
marketing:new Set(['marketingHome','marketingCalendar','marketingEvents','marketingAnnouncements','marketingRoster','marketingContent','profile','about']),
  family:new Set(['familyHome','familyCategories','familyLink','familyTrainings','familyEvents','familyPayments','familyAnnouncements','pilotSurvey','pilotFeature','profile','about']),
  pending:new Set(['trainerPending','profile','about'])
};
function storedView(){try{return sessionStorage.getItem(VIEW_STORAGE_KEY)||''}catch{return ''}}
function rememberView(view){
  try{sessionStorage.setItem(VIEW_STORAGE_KEY,view)}catch{}
  const hash=`#${encodeURIComponent(view)}`;
  if(location.hash!==hash)history.replaceState(history.state||{},'',`${location.pathname}${location.search}${hash}`);
}
function requestedView(allowed,fallback){
  const hash=decodeURIComponent((location.hash||'').replace(/^#/,''));
  const candidate=hash||storedView();
  return allowed.has(candidate)?candidate:fallback;
}

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
let pilotSettings={surveyEnabled:true,featureEnabled:true,surveyCategoryIds:[],featureCategoryIds:[]};
let pilotFeedback=[],featureRequests=[];
let marketingContentTasks=[];

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

function isPlayerProfile(p=profile){return p?.role==='player'||p?.accountType==='player'}
function playerIdentityStatusForUser(u){
  if(!u||effectiveUserRole(u)!=='player')return null;
  const byId=u.playerId?players.find(p=>p.id===u.playerId):null;
  const byLink=players.filter(p=>(p.linkedUserIds||[]).includes(u.id));
  const player=byId||byLink[0]||null;
  if(!player)return{ok:false,label:'Sin ficha de jugadora vinculada',player:null};
  return{ok:true,label:`${player.name} · ${primaryCategoryName(player)}${reinforcementCategoryIds(player).length?` · Refuerza: ${reinforcementCategoryNames(player)}`:''}`,player,categoryIds:playerCatIds(player)};
}
async function loadOwnPlayerProfile(uid){
  if(!isPlayerProfile())return null;
  if(profile?.playerId){
    const snap=await getDoc(doc(db,'players',profile.playerId));
    if(snap.exists()){
      const p={id:snap.id,...snap.data()};
      if(!(p.linkedUserIds||[]).includes(uid)){
        const linkedUserIds=[...new Set([...(p.linkedUserIds||[]),uid])];
        await updateDoc(doc(db,'players',p.id),{linkedUserIds,updatedAt:serverTimestamp()});
        p.linkedUserIds=linkedUserIds;
      }
      return p;
    }
  }
  const linked=await col('players',[where('orgId','==',ORG_ID),where('linkedUserIds','array-contains',uid)]);
  if(linked.length===1)return linked[0];
  return null;
}
function notificationCategoryIds(){
  if(['admin','treasurer'].includes(profile?.role))return null;
  if(isCoachingRole(profile?.role))return [...new Set(profile.assignedCategoryIds||[])];
  if(isPlayerProfile())return [...new Set((familyPlayers||[]).flatMap(p=>playerCatIds(p)))];
  const uid=auth.currentUser?.uid;
  const linked=(familyPlayers||[]).filter(p=>(p.linkedUserIds||[]).includes(uid));
  return [...new Set(linked.flatMap(p=>playerCatIds(p)))];
}
function visibleNotifications(){
  const ids=notificationCategoryIds(),uid=auth.currentUser?.uid;
  return notifications.filter(n=>{
    if(notificationIsHidden(n))return false;
    if(n.targetUserId&&n.targetUserId!==uid)return false;
    if(n.targetRole&&n.targetRole!==profile?.role)return false;
    return !n.categoryId||ids===null||ids.includes(n.categoryId);
  }).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
}
function notificationIsRead(n){return (n.readBy||[]).includes(auth.currentUser?.uid)}
function notificationIsHidden(n){return (n.hiddenBy||[]).includes(auth.currentUser?.uid)}
function renderNotifications(){
  const list=visibleNotifications(),unread=list.filter(n=>!notificationIsRead(n)),badge=$('#notificationCount');
  if(badge){badge.textContent=unread.length>99?'99+':String(unread.length);badge.classList.toggle('hidden',!unread.length);}
  $('#notificationList').innerHTML=list.slice(0,40).map(n=>`<div class="notification-row ${notificationIsRead(n)?'':'unread'}">
    <button class="notification-item" data-notification-id="${n.id}" data-notification-kind="${esc(n.kind||'')}" data-notification-source="${esc(n.sourceId||'')}"><span class="notification-dot"></span><span><strong>${esc(n.title||'Notificación')}</strong><small>${n.categoryId?esc(catName(n.categoryId))+' · ':''}${esc(n.body||'')}</small></span></button>
    <button class="notification-dismiss" data-dismiss-notification="${n.id}" type="button" aria-label="Quitar notificación" title="Quitar">×</button>
  </div>`).join('')||'<p class="muted">No tienes notificaciones.</p>';
}
async function hideNotification(id){
  const n=notifications.find(x=>x.id===id);if(!n)return;
  const hiddenBy=[...new Set([...(n.hiddenBy||[]),auth.currentUser.uid])];
  await updateDoc(doc(db,'notifications',id),{hiddenBy});
  n.hiddenBy=hiddenBy;renderNotifications();
}
async function clearReadNotifications(){
  const read=visibleNotifications().filter(notificationIsRead);
  for(const n of read)await hideNotification(n.id);
}

async function loadNotifications(){try{notifications=await col('notifications',[where('orgId','==',ORG_ID)]);renderNotifications();}catch(e){console.warn(e);notifications=[];renderNotifications();}}
function startNotificationRealtime(){
  if(state.notificationUnsub){state.notificationUnsub();state.notificationUnsub=null;}
  state.notificationUnsub=onSnapshot(
    query(collection(db,'notifications'),where('orgId','==',ORG_ID)),
    snap=>{notifications=snap.docs.map(d=>({id:d.id,...d.data()}));renderNotifications();},
    e=>console.error('Notification realtime error:',e)
  );
}
function stopNotificationRealtime(){
  if(state.notificationUnsub){state.notificationUnsub();state.notificationUnsub=null;}
}
async function createCategoryNotification({kind,categoryId='',title,body='',sourceId=''}){await addDoc(collection(db,'notifications'),{orgId:ORG_ID,kind,categoryId,title,body,sourceId,createdBy:auth.currentUser?.uid||'',readBy:[],createdAt:serverTimestamp()});}
async function markNotificationRead(id){const n=notifications.find(x=>x.id===id);if(!n||notificationIsRead(n))return;const readBy=[...new Set([...(n.readBy||[]),auth.currentUser.uid])];await updateDoc(doc(db,'notifications',id),{readBy});n.readBy=readBy;renderNotifications();}


const shirtProductLabel=v=>v==='initiation_uniform'?'Uniforme de Iniciación':'Camisa de aficionado';

let shirtCatalog={fan_shirt:{},initiation_uniform:{}};
async function loadShirtCatalog(){
  try{const rows=await col('shirtCatalog',[where('orgId','==',ORG_ID)]);shirtCatalog={fan_shirt:{},initiation_uniform:{}};rows.forEach(r=>{if(r.product)shirtCatalog[r.product]=r});renderShirtProductPreview();renderShirtCatalogAdmin()}catch(e){console.error('Shirt catalog load error',e)}
}
function renderShirtProductPreview(){const el=$('#shirtProductPreview');if(!el)return;const product=$('#shirtProduct')?.value||'fan_shirt',item=shirtCatalog[product]||{};el.innerHTML=item.photoUrl?`<img src="${esc(item.photoUrl)}" alt="${esc(shirtProductLabel(product))}"><div><strong>${esc(shirtProductLabel(product))}</strong></div>`:`<div class="shirt-photo-placeholder">👕</div><div><strong>${esc(shirtProductLabel(product))}</strong></div>`}
function renderShirtCatalogAdmin(){[['fan_shirt','#fanShirtAdminPreview'],['initiation_uniform','#initiationUniformAdminPreview']].forEach(([product,sel])=>{const el=$(sel);if(!el)return;const item=shirtCatalog[product]||{};el.innerHTML=item.photoUrl?`<img src="${esc(item.photoUrl)}" alt="${esc(shirtProductLabel(product))}">`:'<span>Sin foto</span>'})}
async function saveShirtProductPhoto(product,input){if(profile?.role!=='admin')return;const file=input?.files?.[0];if(!file)return alert('Selecciona una imagen.');if(file.size>5*1024*1024)return alert('La imagen no puede superar 5 MB.');const path=`shirtCatalog/asbavol/${product}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;const storageRef=ref(storage,path);await uploadBytes(storageRef,file);const photoUrl=await getDownloadURL(storageRef);await setDoc(doc(db,'shirtCatalog',product),{orgId:ORG_ID,product,photoUrl,photoPath:path,updatedAt:serverTimestamp(),updatedBy:auth.currentUser.uid},{merge:true});await loadShirtCatalog();toast('Foto del producto guardada.')}

const shirtStatusLabel=v=>({pending:'Pendiente',processing:'En proceso',ready:'Lista para entregar',delivered:'Entregada',cancelled:'Cancelada'}[v]||v);
const shirtStatusClass=v=>v==='delivered'?'paid':v==='cancelled'?'cancelled':v==='ready'?'active':'pending';
async function loadShirtRequests(){
  if(!auth.currentUser)return;
  try{
    shirtRequests=profile?.role==='admin'
      ?await col('shirtRequests',[where('orgId','==',ORG_ID)])
      :await col('shirtRequests',[where('orgId','==',ORG_ID),where('requestedBy','==',auth.currentUser.uid)]);
    renderMyShirtRequests();
    if(profile?.role==='admin')renderShirtAdmin();
  }catch(e){console.error('Shirt requests load error:',e);shirtRequests=[];}
}
function startShirtRealtime(){
  if(state.shirtUnsub){state.shirtUnsub();state.shirtUnsub=null;}
  if(!auth.currentUser)return;
  const q=profile?.role==='admin'
    ?query(collection(db,'shirtRequests'),where('orgId','==',ORG_ID))
    :query(collection(db,'shirtRequests'),where('orgId','==',ORG_ID),where('requestedBy','==',auth.currentUser.uid));
  state.shirtUnsub=onSnapshot(q,snap=>{
    shirtRequests=snap.docs.map(d=>({id:d.id,...d.data()}));
    renderMyShirtRequests();
    if(profile?.role==='admin'&&state.currentView==='shirtAdmin')renderShirtAdmin();
  },e=>console.error('Shirt requests realtime error:',e));
}
function stopShirtRealtime(){if(state.shirtUnsub){state.shirtUnsub();state.shirtUnsub=null;}}
function renderMyShirtRequests(){
  const el=$('#myShirtRequests');if(!el)return;
  const list=shirtRequests.filter(r=>r.requestedBy===auth.currentUser?.uid).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
  el.innerHTML=list.map(r=>`<article class="panel shirt-request-card"><div class="page-head compact-head"><div><span class="eyebrow">${esc(shirtProductLabel(r.product))}</span><h4>${esc(r.size||'Sin talla')} · Cantidad ${Number(r.quantity||1)}</h4></div><span class="badge ${shirtStatusClass(r.status)}">${esc(shirtStatusLabel(r.status))}</span></div>${r.playerName?`<p><strong>Jugadora:</strong> ${esc(r.playerName)}</p>`:''}<p class="muted">${esc(r.notes||'Sin observaciones')}</p><small>Solicitud: ${r.createdAt?.seconds?new Date(r.createdAt.seconds*1000).toLocaleString('es-CR'):'recién enviada'}</small></article>`).join('')||'<p class="muted">Todavía no has enviado solicitudes de camiseta.</p>';
}
function renderShirtAdmin(){
  if(!$('#shirtAdminList'))return;
  renderShirtCatalogAdmin();
  const status=$('#shirtAdminStatusFilter')?.value||'',product=$('#shirtAdminProductFilter')?.value||'';
  const list=shirtRequests.filter(r=>(!status||r.status===status)&&(!product||r.product===product)).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
  $('#shirtAdminSummary').innerHTML=[
    [shirtRequests.length,'Solicitudes',''],
    [shirtRequests.filter(r=>r.status==='pending').length,'Pendientes','pending'],
    [shirtRequests.filter(r=>r.status==='processing').length,'En proceso','processing'],
    [shirtRequests.filter(r=>r.status==='ready').length,'Listas para entregar','ready']
  ].map(([v,l,s])=>`<button type="button" class="stat clickable-stat shirt-summary-card" data-shirt-summary-status="${s}"><strong>${v}</strong><span>${l}</span></button>`).join('');
  $('#shirtAdminList').innerHTML=list.map(r=>`<article class="panel shirt-admin-card clickable-card" data-shirt-request-detail="${r.id}" role="button" tabindex="0">
    <div class="page-head compact-head"><div><span class="eyebrow">${esc(shirtProductLabel(r.product))}</span><h3>${esc(r.requesterName||r.requesterEmail||'Usuario')}</h3></div><span class="badge ${shirtStatusClass(r.status)}">${esc(shirtStatusLabel(r.status))}</span></div>
    <div class="grid two"><p><strong>Talla:</strong> ${esc(r.size||'—')}<br><strong>Cantidad:</strong> ${Number(r.quantity||1)}</p><p><strong>Correo:</strong> ${esc(r.requesterEmail||'—')}${r.playerName?`<br><strong>Jugadora:</strong> ${esc(r.playerName)}`:''}</p></div>
    <p class="muted">${esc(r.notes||'Sin observaciones')}</p>
    <label>Actualizar estado<select data-shirt-status="${r.id}"><option value="pending" ${r.status==='pending'?'selected':''}>Pendiente</option><option value="processing" ${r.status==='processing'?'selected':''}>En proceso</option><option value="ready" ${r.status==='ready'?'selected':''}>Lista para entregar</option><option value="delivered" ${r.status==='delivered'?'selected':''}>Entregada</option><option value="cancelled" ${r.status==='cancelled'?'selected':''}>Cancelada</option></select></label>
  </article>`).join('')||'<p class="muted">No hay solicitudes para los filtros seleccionados.</p>';
}
async function updateShirtRequestStatus(id,status){
  if(profile?.role!=='admin')return;
  const r=shirtRequests.find(x=>x.id===id);if(!r||r.status===status)return;
  await updateDoc(doc(db,'shirtRequests',id),{status,updatedAt:serverTimestamp(),updatedBy:auth.currentUser.uid});
  await addDoc(collection(db,'notifications'),{
    orgId:ORG_ID,kind:'shirt_request_status',categoryId:'',targetUserId:r.requestedBy,
    title:'Actualización de solicitud de camiseta',
    body:`${shirtProductLabel(r.product)}: ${shirtStatusLabel(status)}.`,
    sourceId:id,createdBy:auth.currentUser.uid,readBy:[],createdAt:serverTimestamp()
  });
  toast('Estado de la solicitud actualizado.');
}
async function openShirtRequestDialog(){
  await Promise.all([loadShirtRequests(),loadShirtCatalog()]);
  $('#shirtRequestForm').reset();$('#shirtQuantity').value=1;
  renderMyShirtRequests();
  $('#shirtRequestDialog').showModal();
}
function onvoPaymentForCharge(chargeId){
  return onvoPayments.filter(p=>p.chargeId===chargeId).sort((a,b)=>(b.paidAt?.seconds||b.createdAt?.seconds||0)-(a.paidAt?.seconds||a.createdAt?.seconds||0))[0]||null;
}
function onvoStatusLabel(s){
  return s==='paid'?'Pagado':s==='processing'?'Procesando':s==='failed'?'Fallido':s==='checkout_created'?'Checkout creado':s||'';
}
async function startOnvoCheckout(chargeId,button){
  const charge=familyCharges.find(c=>c.id===chargeId);
  if(!charge)return alert('No se encontró la mensualidad.');
  const remaining=chargeRemaining(charge);
  if(remaining<=0)return alert('Esta mensualidad ya no tiene saldo pendiente.');
  const ok=confirm(`Vas a abrir ONVO Checkout en modo de prueba para pagar ${money(remaining)}. ¿Continuar?`);
  if(!ok)return;
  const old=button?.textContent;
  if(button){button.disabled=true;button.textContent='Abriendo ONVO…';}
  try{
    const token=await getIdToken(auth.currentUser,true);
    const res=await fetch('/.netlify/functions/onvo-create-checkout',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
      body:JSON.stringify({chargeId,returnBaseUrl:window.location.origin})
    });
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw Error(data.error||`No se pudo crear el Checkout (${res.status}).`);
    if(!data.url)throw Error('ONVO no devolvió una URL de Checkout.');
    window.location.href=data.url;
  }catch(e){
    alert(`ONVO: ${e.message||e}`);
  }finally{
    if(button){button.disabled=false;button.textContent=old||'Pagar con ONVO';}
  }
}
function handleOnvoReturn(){
  const params=new URLSearchParams(location.search);
  const state=params.get('onvo');
  if(!state)return;
  if(state==='success')toast('Pago enviado correctamente. VolleyCore lo confirmará automáticamente cuando ONVO notifique el resultado.');
  if(state==='cancel')toast('El pago con ONVO fue cancelado. No se registró como pagado.');
  params.delete('onvo');params.delete('charge');
  const qs=params.toString();
  history.replaceState({},'',`${location.pathname}${qs?'?'+qs:''}${location.hash||''}`);
}
function renderOnvoAdmin(){
  if(!$('#onvoAdminList'))return;
  const list=[...onvoPayments].sort((a,b)=>(b.paidAt?.seconds||b.createdAt?.seconds||0)-(a.paidAt?.seconds||a.createdAt?.seconds||0));
  $('#onvoAdminCount').textContent=`${list.length} transacciones`;
  $('#onvoAdminList').innerHTML=list.slice(0,50).map(p=>`<article class="panel onvo-payment-card">
    <div class="page-head compact-head">
      <div><span class="eyebrow">ONVO · ${esc((p.mode||'test').toUpperCase())}</span><h3>${esc(playerName(p.playerId))}</h3></div>
      <span class="badge ${p.status==='paid'?'paid':'pending'}">${esc(onvoStatusLabel(p.status))}</span>
    </div>
    <p><strong>${money(p.amount||0)}</strong> · ${esc(monthLabel(p.month||''))}</p>
    <p class="muted">Checkout: ${esc(p.checkoutSessionId||'—')} · Intent: ${esc(p.paymentIntentId||'—')}</p>
    <p class="muted">${esc(p.customerEmail||'')} ${p.paidAt?.seconds?`· ${new Date(p.paidAt.seconds*1000).toLocaleString('es-CR')}`:''}</p>
  </article>`).join('')||'<p class="muted">Todavía no hay pagos procesados por ONVO.</p>';
}
const money=n=>new Intl.NumberFormat('es-CR',{style:'currency',currency:'CRC',maximumFractionDigits:0}).format(Number(n)||0);
const norm=s=>(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
const today=()=>new Date().toISOString().slice(0,10);
const monthNow=()=>new Date().toISOString().slice(0,7);
const monthLabel=m=>{if(!m)return'Sin mes';const [y,mo]=m.split('-').map(Number);return new Intl.DateTimeFormat('es-CR',{month:'long',year:'numeric'}).format(new Date(y,mo-1,1)).replace(/^./,c=>c.toUpperCase())};
const dueDateForMonth=m=>`${m}-15`;
const chargeRemaining=c=>Math.max(0,Number(c?.amount||0)-Number(c?.paidAmount||0));
const chargeDueState=c=>{if(['paid','exempt'].includes(c?.status))return'closed';const due=c?.dueDate||dueDateForMonth(c?.month);return today()>due?'overdue':'current'};
const reportChargeIds=r=>[...new Set([r?.chargeId,...((r?.allocations||[]).map(a=>a.chargeId))].filter(Boolean))];
const activeReportForCharge=id=>sinpeReports.find(r=>reportChargeIds(r).includes(id)&&['reported','approved'].includes(r.status));
const approvedReportForCharge=id=>sinpeReports.filter(r=>reportChargeIds(r).includes(id)&&r.status==='approved').sort((a,b)=>(b.approvedAt?.seconds||b.createdAt?.seconds||0)-(a.approvedAt?.seconds||a.createdAt?.seconds||0))[0];
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const typeLabel=t=>({match:'Partido',tournament:'Torneo',festival:'Festival',meeting:'Reunión',trip:'Gira',other:'Otra actividad'}[t]||t);
const nationalFlagSvg=()=>'<svg class="status-symbol cr-flag-symbol" viewBox="0 0 30 18" aria-hidden="true"><rect width="30" height="18" fill="#17458f"/><rect y="3" width="30" height="12" fill="#fff"/><rect y="6" width="30" height="6" fill="#d91e36"/></svg>';
const injuryCrossSvg=()=>'<svg class="status-symbol injury-symbol" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 2h6v7h7v6h-7v7H9v-7H2V9h7z"/></svg>';
const playerVisualBadges=p=>`${p?.nationalTeam?`<span class="badge national-team-badge">${nationalFlagSvg()} Seleccionada Nacional</span>`:''}${p?.status==='injured'?`<span class="badge injured visual-status-badge">${injuryCrossSvg()} Lesionada</span>`:''}`;
const statusLabel=s=>({injured:'Lesionada',active:'Activa',inactive:'Inactiva',scheduled:'Programado',changed:'Modificado',cancelled:'Cancelado',completed:'Completado',pending:'Pendiente',paid:'Pagado',partial:'Parcial',exempt:'Exonerado',published:'Publicado',draft:'Borrador',closed:'Cerrada',reported:'Reportado',approved:'Aprobado',rejected:'Rechazado',present:'Presente',absent:'Ausente'}[s]||s);
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

const viewRenderers={dashboard:renderDashboard,players:renderPlayers,categories:renderCategories,seasons:renderSeasons,trainings:renderTrainings,attendance:renderAttendance,events:renderEvents,venues:renderVenues,announcements:renderAnnouncements,finances:renderCharges,sinpeAdmin:renderSinpeAdmin,users:renderUsers,userAdmin:renderUserAdmin,linkAdmin:renderLinkAdmin,offboarding:renderOffboarding,shirtAdmin:renderShirtAdmin,marketingHome:renderMarketingHome,marketingCalendar:renderMarketingCalendar,marketingEvents:renderMarketingEvents,marketingAnnouncements:renderMarketingAnnouncements,marketingRoster:renderMarketingRoster,marketingContent:renderMarketingContent,pilotAdmin:renderPilotAdmin,pilotSurvey:renderPilotSurvey,pilotFeature:renderPilotFeature,trainers:renderTrainers,trainerHome:renderTrainerHome,trainerPlayers:renderTrainerPlayers,trainerTrainings:renderTrainerTrainings,trainerAttendance:renderTrainerAttendance,trainerEvents:renderTrainerEvents,trainerAnnouncements:renderTrainerAnnouncements,familyHome:renderFamilyHome,familyCategories:renderFamilyCategories,familyLink:renderFamilyLink,familyTrainings:renderFamilyTrainings,familyEvents:renderFamilyEvents,familyPayments:renderFamilyCharges,familyAnnouncements:renderFamilyAnnouncements,import:renderPlayerImport,about:()=>{},profile:()=>{},reports:()=>{},trainerPending:()=>{}};


function marketingCategoryIds(){return profile?.role==='marketing'?[...new Set(profile?.assignedCategoryIds||[])]:[]}
function marketingAllowed(id){return marketingCategoryIds().includes(id)}
function marketingEventsData(){return events.filter(e=>[...(e.categoryIds||[]),...(e.categoryId?[e.categoryId]:[])].some(marketingAllowed))}
function marketingPlayersData(){return players.filter(p=>playerCatIds(p).some(marketingAllowed))}
function renderMarketingHome(){const ev=marketingEventsData(),pl=marketingPlayersData(),pend=marketingContentTasks.filter(x=>x.status!=='published');$('#marketingSummary').innerHTML=[[marketingCategoryIds().length,'Categorías asignadas'],[pl.length,'Jugadoras visibles'],[ev.length,'Eventos'],[pend.length,'Contenido pendiente']].map(([v,l])=>`<article class="stat"><strong>${v}</strong><span>${l}</span></article>`).join('');$('#marketingUpcomingEvents').innerHTML=ev.slice(0,5).map(e=>`<p><strong>${esc(e.title||e.name||'Evento')}</strong></p>`).join('')||'<p class="muted">No hay eventos.</p>';$('#marketingPendingContent').innerHTML=pend.slice(0,5).map(x=>`<p><strong>${esc(x.title||'Contenido')}</strong></p>`).join('')||'<p class="muted">No hay contenido pendiente.</p>'}
function renderMarketingEvents(){$('#marketingEventsList').innerHTML=marketingEventsData().map(e=>`<article class="panel"><h3>${esc(e.title||e.name||'Evento')}</h3><p class="muted">${esc(e.date||e.startDate||'')}</p></article>`).join('')||'<p class="muted">No hay eventos.</p>'}
function renderMarketingCalendar(){const list=marketingEventsData();$('#marketingCalendarList').innerHTML=list.map(e=>`<article class="panel"><h3>${esc(e.title||e.name||'Evento')}</h3><p class="muted">${esc(e.date||e.startDate||'')}</p></article>`).join('')||'<p class="muted">No hay actividades.</p>'}
function renderMarketingAnnouncements(){$('#marketingAnnouncementsList').innerHTML=announcements.filter(a=>[...(a.categoryIds||[]),...(a.categoryId?[a.categoryId]:[])].some(marketingAllowed)).map(a=>`<article class="panel"><h3>${esc(a.title||'Comunicado')}</h3><p>${esc(a.body||a.message||'')}</p></article>`).join('')||'<p class="muted">No hay comunicados.</p>'}
function renderMarketingRoster(){const ids=marketingCategoryIds(),cid=$('#marketingRosterCategory').value||'',q=norm($('#marketingRosterSearch').value||'');$('#marketingRosterCategory').innerHTML='<option value="">Todas mis categorías</option>'+ids.map(id=>`<option value="${id}" ${cid===id?'selected':''}>${esc(catName(id))}</option>`).join('');$('#marketingRosterList').innerHTML=marketingPlayersData().filter(p=>(!cid||playerCatIds(p).includes(cid))&&(!q||norm(playerName(p.id)).includes(q))).map(p=>`<article class="panel public-player-card"><h3>${esc(playerName(p.id))}</h3><p class="muted">${esc(catNames(p))}${p.number?` · #${esc(String(p.number))}`:''}${p.position?` · ${esc(p.position)}`:''}</p></article>`).join('')||'<p class="muted">No hay jugadoras.</p>'}
function renderMarketingContent(){const st=$('#marketingContentStatus').value||'';$('#marketingContentList').innerHTML=marketingContentTasks.filter(x=>!st||x.status===st).map(x=>`<article class="panel"><h3>${esc(x.title||'Contenido')}</h3><p class="muted">${esc(catName(x.categoryId))} · ${esc(x.status||'pending')}</p></article>`).join('')||'<p class="muted">No hay tareas de contenido.</p>'}
const PILOT_VERSION='UI 2.14.25';
const PILOT_DEFAULTS={surveyEnabled:true,featureEnabled:true,surveyCategoryIds:[],featureCategoryIds:[]};
function pilotUserCategoryIds(){
  if(['admin','treasurer'].includes(profile?.role))return categories.filter(c=>c.status==='active').map(c=>c.id);
  if(isCoachingRole(profile?.role))return [...new Set(profile?.assignedCategoryIds||[])];
  return [...new Set((familyPlayers||[]).flatMap(p=>playerCatIds(p)).filter(Boolean))];
}
function pilotModuleAllowed(kind){
  const enabled=kind==='survey'?pilotSettings.surveyEnabled:pilotSettings.featureEnabled;
  const configured=kind==='survey'?(pilotSettings.surveyCategoryIds||[]):(pilotSettings.featureCategoryIds||[]);
  if(!enabled)return false;
  if(['admin','treasurer'].includes(profile?.role))return true;
  const mine=pilotUserCategoryIds();
  return configured.length===0 ? mine.length>0 : mine.some(id=>configured.includes(id));
}
function pilotAllowedCategoryIds(kind){
  const mine=pilotUserCategoryIds();
  const configured=kind==='survey'?(pilotSettings.surveyCategoryIds||[]):(pilotSettings.featureCategoryIds||[]);
  return configured.length?mine.filter(id=>configured.includes(id)):mine;
}
function syncPilotNavVisibility(){
  const survey=pilotModuleAllowed('survey'),feature=pilotModuleAllowed('feature');
  $$('.pilot-survey-nav').forEach(b=>b.classList.toggle('hidden',!survey));
  $$('.pilot-feature-nav').forEach(b=>b.classList.toggle('hidden',!feature));
}
async function loadPilotContext(){
  try{
    const snap=await getDoc(doc(db,'pilotSettings','main'));
    pilotSettings=snap.exists()?{...PILOT_DEFAULTS,...snap.data()}:structuredClone(PILOT_DEFAULTS);
    if(profile?.role==='admin'&&!snap.exists())await setDoc(doc(db,'pilotSettings','main'),{orgId:ORG_ID,...pilotSettings,updatedBy:auth.currentUser.uid,updatedAt:serverTimestamp()});
  }catch(e){console.warn('Pilot settings:',e);pilotSettings=structuredClone(PILOT_DEFAULTS);}
  try{
    if(profile?.role==='admin'){
      [pilotFeedback,featureRequests]=await Promise.all([
        col('pilotFeedback',[where('orgId','==',ORG_ID)]).catch(()=>[]),
        col('featureRequests',[where('orgId','==',ORG_ID)]).catch(()=>[])
      ]);
    }else{
      const uid=auth.currentUser.uid;
      [pilotFeedback,featureRequests]=await Promise.all([
        col('pilotFeedback',[where('createdBy','==',uid)]).catch(()=>[]),
        col('featureRequests',[where('createdBy','==',uid)]).catch(()=>[])
      ]);
      pilotFeedback=pilotFeedback.filter(x=>x.orgId===ORG_ID);
      featureRequests=featureRequests.filter(x=>x.orgId===ORG_ID);
    }
  }catch(e){console.warn('Pilot data:',e);pilotFeedback=[];featureRequests=[];}
  syncPilotNavVisibility();
}
function pilotRoleLabel(role){
  return role==='family'?'Padre / encargado':role==='player'?'Jugadora':role==='trainer'?'Entrenador':role==='assistant'?'Asistente':role||'Usuario';
}
function pilotDate(x){
  const s=x?.createdAt?.seconds;return s?new Date(s*1000).toLocaleString('es-CR',{dateStyle:'medium',timeStyle:'short'}):'—';
}
function pilotAverage(r){
  const vals=['ease','navigation','usefulness','performance','trust','satisfaction'].map(k=>Number(r[k]||0)).filter(Boolean);
  return vals.length?(vals.reduce((a,b)=>a+b,0)/vals.length):0;
}
function populatePilotCategorySelect(id,kind){
  const el=$('#'+id);if(!el)return;
  const ids=pilotAllowedCategoryIds(kind);
  el.innerHTML=ids.map(cid=>`<option value="${cid}">${esc(catName(cid))}</option>`).join('')||'<option value="">Sin categoría habilitada</option>';
}
function renderPilotSurvey(){
  if(!pilotModuleAllowed('survey')){
    $('#pilotSurveyForm').closest('.panel').innerHTML='<p class="muted">La evaluación del piloto no está habilitada para tus categorías.</p>';return;
  }
  populatePilotCategorySelect('pilotSurveyCategory','survey');
  $('#pilotSurveyRole').value=pilotRoleLabel(profile?.role);
  const mine=[...pilotFeedback].sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
  $('#pilotMySurveyHistory').innerHTML=mine.map(r=>`<article class="panel"><div class="page-head compact-head"><div><span class="eyebrow">${esc(catName(r.categoryId))}</span><h3>Satisfacción ${Number(r.satisfaction||0)}/5</h3></div><span class="badge neutral">${esc(r.reviewStatus==='actioned'?'Con acción':r.reviewStatus==='reviewed'?'Revisada':'En revisión')}</span></div><p class="muted">${esc(pilotDate(r))} · ${esc(r.version||'')}</p></article>`).join('')||'<p class="muted">Todavía no has enviado evaluaciones.</p>';
}
function renderPilotFeature(){
  if(!pilotModuleAllowed('feature')){
    $('#pilotFeatureForm').closest('.panel').innerHTML='<p class="muted">Las solicitudes de mejora no están habilitadas para tus categorías.</p>';return;
  }
  populatePilotCategorySelect('pilotFeatureCategory','feature');
  const mine=[...featureRequests].sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
  $('#pilotMyFeatureHistory').innerHTML=mine.map(r=>`<article class="panel"><div class="page-head compact-head"><div><span class="eyebrow">${esc(catName(r.categoryId))} · ${esc(r.module||'')}</span><h3>${esc(r.title||'Solicitud')}</h3></div><span class="badge ${r.status==='implemented'?'paid':r.status==='declined'?'rejected':'pending'}">${esc(r.status==='review'?'En revisión':r.status==='approved'?'Aprobada':r.status==='planned'?'Planificada':r.status==='implemented'?'Implementada':r.status==='declined'?'No aprobada':'Nueva')}</span></div><p class="muted">${esc(pilotDate(r))}</p></article>`).join('')||'<p class="muted">Todavía no has enviado solicitudes.</p>';
}
function pilotCategoryCheckboxes(containerId,selected=[]){
  const el=$('#'+containerId);if(!el)return;
  el.innerHTML=categories.filter(c=>c.status==='active').map(c=>`<label class="check-item"><input type="checkbox" value="${c.id}" ${selected.includes(c.id)?'checked':''}><span>${esc(c.name)}</span></label>`).join('');
}
function syncPilotSettingsControls(){
  $('#pilotSurveyEnabled').checked=pilotSettings.surveyEnabled!==false;
  $('#pilotFeatureEnabled').checked=pilotSettings.featureEnabled!==false;
  $('#pilotSurveyScope').value=(pilotSettings.surveyCategoryIds||[]).length===0?'all':'selected';
  $('#pilotFeatureScope').value=(pilotSettings.featureCategoryIds||[]).length===0?'all':'selected';
  pilotCategoryCheckboxes('pilotSurveyCategorySettings',pilotSettings.surveyCategoryIds||[]);
  pilotCategoryCheckboxes('pilotFeatureCategorySettings',pilotSettings.featureCategoryIds||[]);
  $('#pilotSurveyCategorySettings').classList.toggle('pilot-settings-disabled',$('#pilotSurveyScope').value==='all');
  $('#pilotFeatureCategorySettings').classList.toggle('pilot-settings-disabled',$('#pilotFeatureScope').value==='all');
}
function renderPilotAdmin(){
  if(profile?.role!=='admin')return;
  syncPilotSettingsControls();
  const avgSat=pilotFeedback.length?(pilotFeedback.reduce((s,r)=>s+Number(r.satisfaction||0),0)/pilotFeedback.length).toFixed(1):'—';
  $('#pilotAdminSummary').innerHTML=[
    [pilotFeedback.length,'Evaluaciones','feedback-all'],[avgSat==='—'?'—':`${avgSat}/5`,'Satisfacción promedio','feedback-summary'],[featureRequests.length,'Feature requests','features-all'],[featureRequests.filter(r=>(r.status||'new')==='new').length,'Nuevas por revisar','features-new']
  ].map(([v,l,a])=>`<button type="button" class="stat clickable-stat pilot-summary-card" data-pilot-summary="${a}"><strong>${v}</strong><span>${l}</span></button>`).join('');
  renderPilotFeedbackAdmin();
  renderPilotFeatureAdmin();
}
function renderPilotFeedbackAdmin(){
  const q=norm($('#pilotFeedbackSearch')?.value||''),role=$('#pilotFeedbackRoleFilter')?.value||'',review=$('#pilotFeedbackReviewFilter')?.value||'';
  const list=[...pilotFeedback].filter(r=>(!role||r.userRole===role)&&(!review||(r.reviewStatus||'new')===review)&&(!q||norm([r.userName,r.mostUseful,r.mostDifficult,r.oneChange,catName(r.categoryId)].join(' ')).includes(q))).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
  $('#pilotFeedbackList').innerHTML=list.map(r=>`<article class="panel pilot-feedback-card">
    <div class="page-head compact-head"><div><span class="eyebrow">${esc(catName(r.categoryId))} · ${esc(pilotRoleLabel(r.userRole))}</span><h3>${esc(r.userName||'Usuario')} · ${Number(r.satisfaction||0)}/5</h3></div><span class="badge neutral">Promedio ${pilotAverage(r).toFixed(1)}/5</span></div>
    <div class="pilot-score-line"><span>Facilidad <strong>${r.ease}/5</strong></span><span>Navegación <strong>${r.navigation}/5</strong></span><span>Utilidad <strong>${r.usefulness}/5</strong></span><span>Desempeño <strong>${r.performance}/5</strong></span><span>Confianza <strong>${r.trust}/5</strong></span></div>
    <p><strong>Más útil:</strong> ${esc(r.mostUseful||'—')}</p><p><strong>Difícil/confuso:</strong> ${esc(r.mostDifficult||'—')}</p><p><strong>Cambiaría:</strong> ${esc(r.oneChange||'—')}</p>
    <div class="grid two"><label>Clasificación<select data-pilot-feedback-class="${r.id}"><option value="unclassified" ${(r.classification||'unclassified')==='unclassified'?'selected':''}>Sin clasificar</option><option value="positive" ${r.classification==='positive'?'selected':''}>Feedback positivo</option><option value="ux" ${r.classification==='ux'?'selected':''}>Experiencia / UX</option><option value="bug" ${r.classification==='bug'?'selected':''}>Posible bug</option><option value="training" ${r.classification==='training'?'selected':''}>Capacitación / uso</option><option value="other" ${r.classification==='other'?'selected':''}>Otro</option></select></label>
    <label>Revisión<select data-pilot-feedback-review="${r.id}"><option value="new" ${(r.reviewStatus||'new')==='new'?'selected':''}>Nueva</option><option value="reviewed" ${r.reviewStatus==='reviewed'?'selected':''}>Revisada</option><option value="actioned" ${r.reviewStatus==='actioned'?'selected':''}>Con acción</option></select></label></div>
    <p class="muted">${esc(pilotDate(r))} · ${esc(r.version||'')}</p>
  </article>`).join('')||'<p class="muted">No hay evaluaciones para estos filtros.</p>';
}
function renderPilotFeatureAdmin(){
  const q=norm($('#pilotFeatureSearch')?.value||''),status=$('#pilotFeatureStatusFilter')?.value||'',classification=$('#pilotFeatureClassFilter')?.value||'';
  const list=[...featureRequests].filter(r=>(!status||(r.status||'new')===status)&&(!classification||(r.classification||'unclassified')===classification)&&(!q||norm([r.title,r.problem,r.proposal,r.userName,r.module,catName(r.categoryId)].join(' ')).includes(q))).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
  $('#pilotFeatureAdminList').innerHTML=list.map(r=>`<article class="panel pilot-feature-card">
    <div class="page-head compact-head"><div><span class="eyebrow">${esc(catName(r.categoryId))} · ${esc(r.module||'')}</span><h3>${esc(r.title)}</h3></div><span class="badge neutral">${esc(pilotRoleLabel(r.userRole))}</span></div>
    <p><strong>Problema:</strong> ${esc(r.problem||'')}</p><p><strong>Propuesta:</strong> ${esc(r.proposal||'')}</p>
    <p class="muted">Solicita: ${esc(r.userName||'Usuario')} · Importancia percibida: ${esc(r.urgency||'—')} · ${esc(pilotDate(r))}</p>
    <div class="grid two">
      <label>Clasificación<select data-feature-class="${r.id}"><option value="unclassified" ${(r.classification||'unclassified')==='unclassified'?'selected':''}>Sin clasificar</option><option value="bug" ${r.classification==='bug'?'selected':''}>Bug</option><option value="ux" ${r.classification==='ux'?'selected':''}>Mejora UX</option><option value="feature" ${r.classification==='feature'?'selected':''}>Nueva funcionalidad</option><option value="training" ${r.classification==='training'?'selected':''}>Capacitación / uso</option><option value="out_of_scope" ${r.classification==='out_of_scope'?'selected':''}>Fuera de alcance</option></select></label>
      <label>Estado<select data-feature-status="${r.id}"><option value="new" ${(r.status||'new')==='new'?'selected':''}>Nueva</option><option value="review" ${r.status==='review'?'selected':''}>En revisión</option><option value="approved" ${r.status==='approved'?'selected':''}>Aprobada</option><option value="planned" ${r.status==='planned'?'selected':''}>Planificada</option><option value="implemented" ${r.status==='implemented'?'selected':''}>Implementada</option><option value="declined" ${r.status==='declined'?'selected':''}>No aprobada</option></select></label>
    </div>
  </article>`).join('')||'<p class="muted">No hay solicitudes para estos filtros.</p>';
}
function renderCurrentView(){viewRenderers[state.currentView]?.()}
function go(view,{remember=true}={}){
  state.currentView=view;
  if(remember)rememberView(view);
  $$('.view').forEach(v=>v.classList.toggle('hidden',v.id!==`view-${view}`));
  $$('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  viewRenderers[view]?.();
}

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
const PLAYER_PRIVATE_FIELDS=['identificationNumber','phone','email','province','cantonDistrict','address','emergencyContact','insured','insurance','guardians'];
function playerPrivateData(p={}){return {orgId:ORG_ID,playerId:p.id||'',categoryIds:playerCatIds(p),linkedUserIds:p.linkedUserIds||[],identificationNumber:p.identificationNumber||'',phone:p.phone||'',email:p.email||'',province:p.province||'',cantonDistrict:p.cantonDistrict||'',address:p.address||'',emergencyContact:p.emergencyContact||{name:'',phone:''},insured:!!p.insured,insurance:p.insurance||{provider:'',policyNumber:'',expiryDate:'',notes:''},guardians:p.guardians||[],updatedAt:serverTimestamp()}}
function mergePlayerPrivate(p){const priv=playerPrivateById.get(p.id);return priv?{...p,...priv,id:p.id}:p}
async function loadPlayerPrivateForAdmin(){
  const docs=await col('playerPrivate',[where('orgId','==',ORG_ID)]).catch(()=>[]);
  playerPrivateById=new Map(docs.map(x=>[x.id,x]));
}
async function loadPlayerPrivateForPlayers(list){
  const pairs=await Promise.all((list||[]).map(async p=>{try{const s=await getDoc(doc(db,'playerPrivate',p.id));return s.exists()?[p.id,{id:s.id,...s.data()}]:null}catch(e){console.warn('Private player read denied/unavailable:',p.id,e?.code||e);return null}}));
  playerPrivateById=new Map(pairs.filter(Boolean));
  return (list||[]).map(mergePlayerPrivate);
}
const loadPlayerPrivateForFamily=loadPlayerPrivateForPlayers;
async function migrateLegacyPlayerPrivate(){
  if(profile?.role!=='admin')return false;
  const legacy=players.filter(p=>PLAYER_PRIVATE_FIELDS.some(k=>Object.prototype.hasOwnProperty.call(p,k)));
  if(!legacy.length)return false;
  for(let i=0;i<legacy.length;i+=150){
    const batch=writeBatch(db);
    legacy.slice(i,i+150).forEach(p=>{
      batch.set(doc(db,'playerPrivate',p.id),playerPrivateData(p),{merge:true});
      const clean={updatedAt:serverTimestamp()}; PLAYER_PRIVATE_FIELDS.forEach(k=>clean[k]=deleteField());
      batch.update(doc(db,'players',p.id),clean);
    });
    await batch.commit();
  }
  return true;
}
async function loadAdminData(){const [cs,ps,vs,es,as,chs,srs,us,ss,ts,te,lrs,fs,cvs,ats,xrs]=await Promise.all([
  col('categories',[where('orgId','==',ORG_ID)]),col('players',[where('orgId','==',ORG_ID)]),col('venues',[where('orgId','==',ORG_ID)]),col('events',[where('orgId','==',ORG_ID)]),col('announcements',[where('orgId','==',ORG_ID)]),col('charges',[where('orgId','==',ORG_ID)]),col('sinpeReports',[where('orgId','==',ORG_ID)]),col('users',[where('orgId','==',ORG_ID)]),col('seasons',[where('orgId','==',ORG_ID)]),col('trainingSeries',[where('orgId','==',ORG_ID)]),col('trainingExceptions',[where('orgId','==',ORG_ID)]),col('linkRequests',[where('orgId','==',ORG_ID)]),col('families',[where('orgId','==',ORG_ID)]),col('categoryVideos',[where('orgId','==',ORG_ID)]),col('attendanceRecords',[where('orgId','==',ORG_ID)]),col('exitRecords',[where('orgId','==',ORG_ID)])
]);
 categories=cs.sort((a,b)=>(a.name||'').localeCompare(b.name||''));players=ps.sort((a,b)=>(a.name||'').localeCompare(b.name||''));if(profile?.role==='admin'&&await migrateLegacyPlayerPrivate())players=(await col('players',[where('orgId','==',ORG_ID)])).sort((a,b)=>(a.name||'').localeCompare(b.name||''));if(profile?.role==='admin'){await loadPlayerPrivateForAdmin();players=players.map(mergePlayerPrivate);}else{playerPrivateById=new Map();}venues=vs.sort((a,b)=>(a.name||'').localeCompare(b.name||''));events=es.filter(e=>e.type!=='training').sort((a,b)=>(a.date||'').localeCompare(b.date||''));announcements=as.sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));charges=chs;sinpeReports=srs;generatedPaymentReport=generatedPaymentReport.length?paymentReportRows():[];allUsers=us.sort((a,b)=>(a.fullName||'').localeCompare(b.fullName||''));familyUsers=allUsers.filter(u=>['family','player'].includes(u.role));trainerUsers=allUsers.filter(u=>isCoachingRole(u.role));seasons=ss.sort((a,b)=>(b.startDate||'').localeCompare(a.startDate||''));trainingSeries=ts;trainingExceptions=te;linkRequests=lrs;families=fs.filter(f=>f.status!=='merged');categoryVideos=(cvs||[]).sort((a,b)=>(b.date||'').localeCompare(a.date||''));attendanceRecords=ats||[];exitRecords=(xrs||[]).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));if(await ensureCategoryNaming())categories=(await col('categories',[where('orgId','==',ORG_ID)])).sort((a,b)=>(a.name||'').localeCompare(b.name||''));if(await ensureFirstDivisionExemptions())charges=await col('charges',[where('orgId','==',ORG_ID)]);if(await ensureCurrentMonthCharges())charges=await col('charges',[where('orgId','==',ORG_ID)]);onvoPayments=await col('onvoPayments',[where('orgId','==',ORG_ID)]).catch(()=>[]);await syncCategoryJerseyAvailability();populateSelectors();renderDashboard();await loadNotifications();await loadPilotContext();
}
async function loadFamilyData(){
  state.familyDataLoading=true;setFamilyLoading(true);
  const uid=auth.currentUser.uid,isPlayer=isPlayerProfile();
  const [ownPlayer,fps,cs,vs,ss,es,ts,te,as,fcs,srs,lrs,fs,cvs]=await Promise.all([
    isPlayer?loadOwnPlayerProfile(uid):Promise.resolve(null),
    isPlayer?Promise.resolve([]):col('players',[where('orgId','==',ORG_ID),where('linkedUserIds','array-contains',uid)]),
    col('categories',[where('orgId','==',ORG_ID)]),col('venues',[where('orgId','==',ORG_ID)]),col('seasons',[where('orgId','==',ORG_ID)]),
    col('events',[where('orgId','==',ORG_ID)]),col('trainingSeries',[where('orgId','==',ORG_ID)]),col('trainingExceptions',[where('orgId','==',ORG_ID)]),
    col('announcements',[where('orgId','==',ORG_ID),where('status','==','published')]),
    isPlayer?Promise.resolve([]):col('charges',[where('orgId','==',ORG_ID),where('userIds','array-contains',uid)]),
    isPlayer?Promise.resolve([]):col('sinpeReports',[where('orgId','==',ORG_ID),where('userId','==',uid)]),
    isPlayer?Promise.resolve([]):col('linkRequests',[where('orgId','==',ORG_ID),where('userId','==',uid)]),
    isPlayer?Promise.resolve([]):col('families',[where('orgId','==',ORG_ID),where('memberUserIds','array-contains',uid)]),
    col('categoryVideos',[where('orgId','==',ORG_ID)])
  ]);
  familyPlayers=await loadPlayerPrivateForFamily(isPlayer?(ownPlayer?[ownPlayer]:[]):fps);
  categories=cs;venues=vs;seasons=ss;events=es;trainingSeries=ts;trainingExceptions=te;announcements=as;familyCharges=fcs;sinpeReports=srs;familyLinkRequests=lrs;families=fs;categoryVideos=(cvs||[]).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  deriveFamilyData();populateSelectors();state.familyDataLoading=false;setFamilyLoading(false);renderFamilyHome();await loadNotifications();await loadPilotContext();
}
function deriveFamilyData(){const catIds=[...new Set(familyPlayers.flatMap(p=>playerCatIds(p)).filter(Boolean))];familyEvents=events.filter(e=>e.type!=='training'&&sportsCategoryIds(e).some(id=>catIds.includes(id)));familyTrainingSeries=trainingSeries.filter(t=>catIds.includes(t.categoryId)&&t.status==='active');familyTrainingExceptions=trainingExceptions.filter(x=>familyTrainingSeries.some(t=>t.id===x.seriesId));familyAnnouncements=announcements.filter(a=>!a.categoryId||catIds.includes(a.categoryId));}
function setFamilyLoading(v){if($('#familyPlayers'))$('#familyPlayers').innerHTML=v?'<div class="loading-placeholder"><div class="spinner"></div>Cargando jugadoras vinculadas…</div>':'';if($('#familyLinkRequests')&&v)$('#familyLinkRequests').innerHTML='<p class="muted">Cargando solicitudes…</p>';}


function populateSelectors(){const opts=categories.filter(c=>c.status==='active').map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');['playerCategory','eventCategory','trainingCategory'].forEach(id=>{if($('#'+id))$('#'+id).innerHTML=opts});if($('#linkCategory'))$('#linkCategory').innerHTML='<option value="">No estoy seguro/a</option>'+opts;if($('#playerCategoryFilter')){
  const current=$('#playerCategoryFilter').value;
  $('#playerCategoryFilter').innerHTML='<option value="">Selecciona una categoría</option><option value="__all__">Todas las categorías</option>'+opts;
  if([...$('#playerCategoryFilter').options].some(o=>o.value===current))$('#playerCategoryFilter').value=current;
}
['eventCategoryFilter','trainingCategoryFilter','generateCategory','announcementCategory','chargeCategoryFilter','attendanceCategory','importDefaultCategory'].forEach(id=>{if($('#'+id))$('#'+id).innerHTML='<option value="">Todas las categorías</option>'+opts});const vopts='<option value="">Sin sede</option>'+venues.filter(v=>v.status==='active').map(v=>`<option value="${v.id}">${esc(v.name)}</option>`).join('');['categoryVenue','eventVenue','trainingVenue','trainingExceptionVenue','trainingFutureVenue'].forEach(id=>{if($('#'+id))$('#'+id).innerHTML=vopts});const sopts=seasons.map(s=>`<option value="${s.id}">${esc(s.name)}${s.isCurrent?' · Actual':''}</option>`).join('');['categorySeason','eventSeason','trainingSeason'].forEach(id=>{if($('#'+id))$('#'+id).innerHTML=sopts});['eventSeasonFilter','trainingSeasonFilter'].forEach(id=>{if($('#'+id))$('#'+id).innerHTML='<option value="">Todas las temporadas</option>'+sopts})}
function playerCatIds(p){
  return [...new Set([
    p?.categoryId,
    ...(Array.isArray(p?.categoryIds)?p.categoryIds:[]),
    ...(Array.isArray(p?.reinforcementCategoryIds)?p.reinforcementCategoryIds:[])
  ].filter(Boolean))];
}
function catNames(p){return playerCatIds(p).map(catName).join(', ')||'Sin categoría'}
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
  return events.filter(e=>sportsHasCategory(e,id)).sort((a,b)=>`${a.date||''} ${a.startTime||''}`.localeCompare(`${b.date||''} ${b.startTime||''}`));
}
function categoryGroupedEventsHTML(list,categoryId){
  if(!list.length)return'<p class="muted">No hay partidos o eventos registrados.</p>';
  const groups=new Map();
  [...list].sort((a,b)=>`${a.date||''} ${a.startTime||''}`.localeCompare(`${b.date||''} ${b.startTime||''}`)).forEach(e=>{
    const key=`${categoryId}__${e.date||''}__${sportsEventVenueGroupKey(e)}`;
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push(e);
  });
  return [...groups.values()].map(group=>{
    const first=group[0],visual=sportsEventVisualType(group),location=eventLocationName(first),status=group.every(e=>e.status==='completed')?'completed':group.some(e=>e.status==='cancelled')?'scheduled':first.status;
    if(visual==='festival')return `<article class="panel category-festival-card"><div class="page-head compact-head"><div><span class="eyebrow">FESTIVAL · ${esc(catName(categoryId))}</span><h4>${esc(first.date||'')}</h4></div><span class="badge ${status}">${esc(statusLabel(status))}</span></div><p><strong>Sede:</strong> ${esc(location||'Por definir')}</p><div class="category-festival-games">${group.map(e=>`<div><strong>${esc(e.startTime||'Hora por definir')}</strong>${e.opponent?` · vs ${esc(e.opponent)}`:` · ${esc(e.title||'Partido')}`}</div>`).join('')}</div></article>`;
    return group.map(e=>`<article class="panel"><div class="page-head compact-head"><div><span class="eyebrow">${esc(typeLabel(e.type))}</span><h4>${esc(e.title)}</h4></div><span class="badge ${e.status}">${esc(statusLabel(e.status))}</span></div><p><strong>${esc(e.date)}</strong> · ${esc(e.startTime||'')} ${e.endTime?'– '+esc(e.endTime):''}</p><p>${e.opponent?`Rival: ${esc(e.opponent)} · `:''}${esc(eventLocationName(e))}${e.homeAway==='away'&&e.awayAddress?` · ${esc(e.awayAddress)}`:''}</p></article>`).join('');
  }).join('');
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
  ${categoryNumbersHTML(id)}
  ${categoryGalleryHTML(id)}
  <section class="category-section">
    <h4>Entrenamientos</h4>
    ${trainings.map(t=>`<article class="panel"><strong>${esc(daysLabel(t.days||[]))}</strong><p>${esc(t.startTime||'')} – ${esc(t.endTime||'')} · ${esc(venueName(t.venueId))}</p></article>`).join('')||'<p class="muted">No hay entrenamientos configurados.</p>'}
  </section>
  <section class="category-section">
    <h4>Calendario de juegos y eventos</h4>
    ${categoryGroupedEventsHTML(games,id)}
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
  $('#categoryCalendarButton').dataset.categoryId=id;$('#categoryCalendarDownloadButton').dataset.categoryId=id;
  $('#categoryCalendarButton').textContent='⇧ Importar calendario de categoría';
  $('#categoryDetailDialog').showModal();
}
function openFamilyCategoryDetail(id){
  const c=categories.find(x=>x.id===id);
  if(!c)return;
  $('#categoryDetailTitle').textContent=c.name;
  $('#categoryDetailContent').innerHTML=categoryDetailHTML(id,{familyMode:true});
  const addVideo=$('#addCategoryVideoButton');
  if(addVideo)addVideo.classList.add('hidden');
  $('#categoryCalendarButton').dataset.categoryId=id;$('#categoryCalendarDownloadButton').dataset.categoryId=id;
  $('#categoryCalendarButton').textContent='📅 Agregar calendario';
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


function categoryJerseyRange(c){const start=Math.max(0,Number(c?.jerseyNumberStart??1)||1),end=Math.max(start,Number(c?.jerseyNumberEnd??99)||99);return{start,end}}
function categoryUsedNumbers(categoryId){const c=categories.find(x=>x.id===categoryId);if(profile?.role!=='admin'&&Array.isArray(c?.occupiedJerseyNumbers))return [...new Set(c.occupiedJerseyNumbers.map(Number).filter(Number.isFinite))].sort((a,b)=>a-b);return [...new Set(players.filter(p=>p.status!=='inactive'&&playerCatIds(p).includes(categoryId)&&String(p.number??'').trim()!=='').map(p=>Number(p.number)).filter(Number.isFinite))].sort((a,b)=>a-b)}
async function syncCategoryJerseyAvailability(){if(profile?.role!=='admin')return;for(const c of categories){const nums=[...new Set(players.filter(p=>p.status!=='inactive'&&playerCatIds(p).includes(c.id)&&String(p.number??'').trim()!=='').map(p=>Number(p.number)).filter(Number.isFinite))].sort((a,b)=>a-b);const old=(c.occupiedJerseyNumbers||[]).map(Number).sort((a,b)=>a-b);if(JSON.stringify(nums)!==JSON.stringify(old)){await updateDoc(doc(db,'categories',c.id),{occupiedJerseyNumbers:nums,jerseyAvailabilityUpdatedAt:serverTimestamp()});c.occupiedJerseyNumbers=nums}}}
function categoryAvailableNumbers(categoryId){const c=categories.find(x=>x.id===categoryId),{start,end}=categoryJerseyRange(c),used=new Set(categoryUsedNumbers(categoryId)),out=[];for(let n=start;n<=end;n++)if(!used.has(n))out.push(n);return out}
function categoryNumbersHTML(categoryId){const used=categoryUsedNumbers(categoryId),available=categoryAvailableNumbers(categoryId);return `<section class="category-section jersey-availability"><h4>Números disponibles</h4><p class="muted">Se actualizan automáticamente con el roster de la categoría.</p><div class="jersey-number-grid">${available.map(n=>`<span class="jersey-number available">${n}</span>`).join('')||'<span class="muted">No hay números disponibles.</span>'}</div>${used.length?`<p class="muted">En uso: ${used.map(n=>'#'+n).join(', ')}</p>`:''}</section>`}
function userCanUploadCategoryPhoto(categoryId){if(profile?.role==='admin')return true;if(profile?.role==='family')return familyPlayers.some(p=>playerCatIds(p).includes(categoryId));if(profile?.role==='player')return familyPlayers.some(p=>p.id===profile?.playerId&&playerCatIds(p).includes(categoryId));return false}
function categoryGalleryHTML(categoryId){const photos=categoryGallery.filter(x=>x.categoryId===categoryId).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));return `<section class="category-section"><div class="page-head compact-head"><div><h4>Mural de fotos</h4><p class="muted">Fotos compartidas para esta categoría.</p></div>${userCanUploadCategoryPhoto(categoryId)?`<label class="btn secondary">Subir fotos<input type="file" accept="image/*" multiple data-category-gallery-upload="${categoryId}" hidden></label>`:''}</div><div class="category-gallery-grid">${photos.map(x=>`<figure class="category-gallery-item"><img src="${esc(x.photoUrl)}" alt="${esc(x.caption||catName(categoryId))}" loading="lazy"><figcaption>${esc(x.caption||'Foto de la categoría')}<small>${esc(x.uploadedByName||'Familia')}</small></figcaption></figure>`).join('')||'<p class="muted">Todavía no hay fotos compartidas.</p>'}</div></section>`}
async function uploadCategoryGalleryPhotos(categoryId,input){if(!userCanUploadCategoryPhoto(categoryId))throw Error('No tienes permiso para subir fotos a esta categoría.');const files=[...(input?.files||[])];if(files.length>10)throw Error('Puedes subir hasta 10 fotos a la vez.');for(const file of files){if(file.size>5*1024*1024)throw Error(`${file.name}: supera 5 MB.`);const blob=await compressImageFile(file,{maxDimension:1800}),id=`${Date.now()}-${Math.random().toString(36).slice(2,8)}`,path=`orgs/${ORG_ID}/categoryGallery/${categoryId}/${auth.currentUser.uid}/${id}.jpg`,rf=storageRef(storage,path);await uploadBytes(rf,blob,{contentType:'image/jpeg'});const photoUrl=await getDownloadURL(rf);await addDoc(collection(db,'categoryGallery'),{orgId:ORG_ID,categoryId,photoUrl,photoPath:path,uploadedBy:auth.currentUser.uid,uploadedByName:profile?.fullName||auth.currentUser.email||'Usuario',createdAt:serverTimestamp()})}await loadCommunityData();$('#categoryDetailContent').innerHTML=categoryDetailHTML(categoryId,{familyMode:profile?.role!=='admin'});toast('Fotos agregadas al mural.')}
function financeTxnDate(x){return String(x.date||x.paidDate||x.paymentDate||'').slice(0,10)}
function approvedPaymentTransactionRows(){return sinpeReports.filter(x=>x.status==='approved').map(x=>({id:x.id,source:'SINPE/Transferencia',date:financeTxnDate(x)||paymentApprovedDate(x),amount:Number(x.amount||0),reference:String(x.reference||''),description:x.allocations?.length?`${x.allocations.length} mensualidades · ${x.payerName||''}`:`${playerName(x.playerId)} · ${monthLabel(sinpeReportMonth(x))}`})).concat(onvoPayments.filter(x=>['paid','approved','succeeded','completed'].includes(String(x.status||'').toLowerCase())).map(x=>{const c=charges.find(c=>c.id===x.chargeId);return{id:x.id,source:'ONVO',date:financeTxnDate(x),amount:Number(x.amount||c?.paidAmount||0),reference:String(x.paymentIntentId||x.checkoutSessionId||''),description:`${playerName(c?.playerId)} · ${c?.month?monthLabel(c.month):''}`}}))}
function approvedPaymentRows(){const a=[];sinpeReports.filter(x=>x.status==='approved').forEach(x=>{const allocations=x.allocations?.length?x.allocations:[{chargeId:x.chargeId,playerId:x.playerId,month:x.month,amount:x.amount,categoryId:sinpeReportCategoryId(x)}];allocations.forEach(z=>a.push({id:`${x.id}_${z.chargeId||z.playerId+'_'+z.month}`,transactionId:x.id,source:'SINPE/Transferencia',date:financeTxnDate(x)||paymentApprovedDate(x),amount:Number(z.amount||0),reference:String(x.reference||''),playerId:z.playerId||x.playerId,categoryId:z.categoryId||players.find(p=>p.id===(z.playerId||x.playerId))?.categoryId||'',description:`${playerName(z.playerId||x.playerId)} · ${monthLabel(z.month||x.month)}`}))});const b=onvoPayments.filter(x=>['paid','approved','succeeded','completed'].includes(String(x.status||'').toLowerCase())).map(x=>{const c=charges.find(c=>c.id===x.chargeId),p=players.find(p=>p.id===c?.playerId);return{id:x.id,source:'ONVO',date:financeTxnDate(x),amount:Number(x.amount||c?.paidAmount||0),reference:String(x.paymentIntentId||x.checkoutSessionId||''),playerId:c?.playerId||'',categoryId:p?.categoryId||c?.categoryId||'',description:`${playerName(c?.playerId)} · ${c?.month?monthLabel(c.month):''}`}});return[...a,...b]}
function categoryIncomeRows(){const rows=approvedPaymentRows().map(x=>({...x,kind:'payment'}));sponsorIncome.filter(x=>x.status!=='cancelled').forEach(x=>rows.push({id:x.id,kind:'sponsor',source:'Patrocinio',date:x.date,amount:Number(x.amount||0),reference:x.reference||'',categoryId:x.categoryId||'',description:x.sponsorName||'Patrocinador'}));return rows}
let financeAppliedFilters={from:'',to:'',category:''};
function financeMonthOptions(){
  const years=[...new Set([new Date().getFullYear()-1,new Date().getFullYear(),new Date().getFullYear()+1,...charges.map(x=>Number(String(x.month||'').slice(0,4))).filter(Boolean)])].sort((a,b)=>a-b),out=[];
  years.forEach(y=>{for(let m=1;m<=12;m++){const value=`${y}-${String(m).padStart(2,'0')}`;out.push({value,label:monthLabel(value)})}});return out;
}
function populateFinancePeriodSelectors(){
  const opts=financeMonthOptions(),now=monthNow(),fromEl=$('#financePeriodFrom'),toEl=$('#financePeriodTo');
  [fromEl,toEl].forEach(el=>{if(!el)return;const keep=el.value;el.innerHTML=opts.map(o=>`<option value="${o.value}">${esc(o.label)}</option>`).join('');el.value=keep&&opts.some(o=>o.value===keep)?keep:now});
  if(!financeAppliedFilters.from){financeAppliedFilters={from:now,to:now,category:''};if(fromEl)fromEl.value=now;if(toEl)toEl.value=now;}
}
function financePeriod(){let from=financeAppliedFilters.from||monthNow(),to=financeAppliedFilters.to||from;if(from>to)[from,to]=[to,from];return{from,to}}
function monthInFinancePeriod(month){const{from,to}=financePeriod();return !!month&&month>=from&&month<=to}
function financePeriodMonthCount(){const{from,to}=financePeriod(),[fy,fm]=from.split('-').map(Number),[ty,tm]=to.split('-').map(Number);return Math.max(1,(ty-fy)*12+(tm-fm)+1)}
function financeAppliedCategory(){return financeAppliedFilters.category||''}
function financeAppliedLabel(){const{from,to}=financePeriod(),cat=financeAppliedCategory(),period=from===to?monthLabel(from):`${monthLabel(from)} – ${monthLabel(to)}`;return `Mostrando resultados: ${period} · ${cat?catName(cat):'Todas las categorías'}`}
function applyFinanceFilters(){let from=$('#financePeriodFrom')?.value||monthNow(),to=$('#financePeriodTo')?.value||from;if(from>to)[from,to]=[to,from];financeAppliedFilters={from,to,category:$('#financeGlobalCategory')?.value||''};renderCharges();renderFinanceEnhancements();renderBankReconciliation();toast('Filtros aplicados.')}
function clearFinanceFilters(){const now=monthNow();financeAppliedFilters={from:now,to:now,category:''};if($('#financePeriodFrom'))$('#financePeriodFrom').value=now;if($('#financePeriodTo'))$('#financePeriodTo').value=now;if($('#financeGlobalCategory'))$('#financeGlobalCategory').value='';renderCharges();renderFinanceEnhancements();renderBankReconciliation()}
function setFinanceTab(tab){
  const allowed=['summary','dues','income','expenses','reconciliation'];if(!allowed.includes(tab))tab='summary';
  $$('[data-finance-tab]').forEach(b=>b.classList.toggle('active',b.dataset.financeTab===tab));
  $$('.finance-tab-panel').forEach(p=>p.classList.toggle('hidden',p.dataset.financePanel!==tab));
}
function renderFinanceEnhancements(){
  populateFinancePeriodSelectors();const{from,to}=financePeriod(),cat=financeAppliedCategory(),months=financePeriodMonthCount();
  if($('#financeActiveFilters'))$('#financeActiveFilters').textContent=financeAppliedLabel();
  ['#financeGlobalCategory','#fixedExpenseCategory','#sponsorCategory'].forEach(sel=>{const el=$(sel);if(el){const old=el.value;el.innerHTML='<option value="">'+(sel==='#financeGlobalCategory'?'Todas las categorías':'General / todas')+'</option>'+categories.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');el.value=old}});
  const incomes=categoryIncomeRows().filter(x=>monthInFinancePeriod(String(x.date||'').slice(0,7))&&(!cat||x.categoryId===cat));
  const expenses=fixedExpenses.filter(x=>x.active!==false&&(!cat||!x.categoryId||x.categoryId===cat));
  const incomeTotal=incomes.reduce((a,x)=>a+Number(x.amount||0),0),monthlyExpense=expenses.reduce((a,x)=>a+Number(x.amount||0),0),expenseTotal=monthlyExpense*months;
  if($('#financeInsightsSummary'))$('#financeInsightsSummary').innerHTML=[[money(incomeTotal),'Ingreso real'],[money(expenseTotal),`Gastos fijos · ${months} mes${months===1?'':'es'}`],[money(incomeTotal-expenseTotal),'Resultado estimado'],[incomes.filter(x=>x.kind==='sponsor').reduce((a,x)=>a+Number(x.amount||0),0),'Patrocinios recibidos']].map(([v,l])=>`<article class="stat"><strong>${v}</strong><span>${l}</span></article>`).join('');
  if($('#categoryIncomeBody')){const by=new Map();categories.forEach(c=>by.set(c.id,{name:c.name,payments:0,sponsors:0}));incomes.forEach(x=>{if(!x.categoryId)return;const z=by.get(x.categoryId)||{name:catName(x.categoryId),payments:0,sponsors:0};z[x.kind==='sponsor'?'sponsors':'payments']+=Number(x.amount||0);by.set(x.categoryId,z)});$('#categoryIncomeBody').innerHTML=[...by.entries()].filter(([id])=>!cat||id===cat).map(([id,z])=>`<tr><td><strong>${esc(z.name)}</strong></td><td>${money(z.payments)}</td><td>${money(z.sponsors)}</td><td><strong>${money(z.payments+z.sponsors)}</strong></td></tr>`).join('')||'<tr><td colspan="4">Sin ingresos en el período seleccionado.</td></tr>'}
  if($('#fixedExpensesList'))$('#fixedExpensesList').innerHTML=expenses.map(x=>`<article class="panel"><div class="page-head compact-head"><div><span class="eyebrow">${esc(x.categoryId?catName(x.categoryId):'General')} · Mensual</span><h4>${esc(x.name||'Gasto fijo')}</h4></div><strong>${money(x.amount)}</strong></div><p class="muted">Día de pago: ${esc(String(x.dueDay||'—'))} · ${esc(x.notes||'')}</p></article>`).join('')||'<p class="muted">No hay gastos fijos registrados.</p>';
  if($('#sponsorIncomeList'))$('#sponsorIncomeList').innerHTML=sponsorIncome.filter(x=>monthInFinancePeriod(String(x.date||'').slice(0,7))&&(!cat||x.categoryId===cat)).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))).map(x=>`<article class="panel"><div class="page-head compact-head"><div><span class="eyebrow">${esc(x.categoryId?catName(x.categoryId):'General')} · ${esc(x.date||'')}</span><h4>${esc(x.sponsorName||'Patrocinador')}</h4></div><strong>${money(x.amount)}</strong></div><p class="muted">${esc(x.concept||'Patrocinio')} ${x.reference?'· Ref. '+esc(x.reference):''}</p></article>`).join('')||'<p class="muted">No hay ingresos de patrocinadores en el período.</p>';
}
let bankImportRows=[];
function parseBankCsv(text){const lines=text.replace(/\r/g,'').split('\n').filter(Boolean);if(lines.length<2)return[];const split=line=>{const out=[];let cur='',q=false;for(const ch of line){if(ch==='"'){q=!q;continue}if((ch===','||ch===';')&&!q){out.push(cur.trim());cur=''}else cur+=ch}out.push(cur.trim());return out},headers=split(lines[0]).map(norm),pick=(row,names)=>{for(const n of names){const i=headers.findIndex(h=>h.includes(n));if(i>=0)return row[i]||''}return''};return lines.slice(1).map((line,i)=>{const row=split(line),raw=pick(row,['monto','amount','credito','credit','importe']).replace(/[₡$,\s]/g,'');return{id:i,date:pick(row,['fecha','date']).replace(/(\d{2})\/(\d{2})\/(\d{4})/,'$3-$2-$1'),description:pick(row,['descripcion','description','detalle','concepto']),reference:pick(row,['referencia','reference','comprobante','documento']),amount:Number(raw)||0}}).filter(x=>x.amount)}
function reconcileBankRows(){const app=approvedPaymentTransactionRows().filter(a=>monthInFinancePeriod(String(a.date||'').slice(0,7))),used=new Set(),bank=bankImportRows.filter(b=>!b.date||monthInFinancePeriod(String(b.date).slice(0,7)));return bank.map(b=>{let best=null,score=0;app.forEach(a=>{if(used.has(a.id))return;let z=0;if(b.reference&&a.reference&&norm(b.reference)===norm(a.reference))z+=100;if(Math.abs(b.amount-a.amount)<.01)z+=30;if(b.date&&a.date&&b.date===a.date)z+=20;if(z>score){score=z;best=a}});if(best&&score>=30)used.add(best.id);return{...b,match:score>=30?best:null}}).concat(app.filter(a=>!used.has(a.id)).map(a=>({id:'app-'+a.id,date:a.date,description:a.description,reference:a.reference,amount:a.amount,appOnly:a})))}
function renderBankReconciliation(){if(!$('#bankReconciliationBody'))return;const rows=reconcileBankRows();$('#bankReconciliationSummary').innerHTML=[[rows.filter(x=>x.match).length,'Coincidencias'],[rows.filter(x=>!x.match&&!x.appOnly).length,'Solo banco'],[rows.filter(x=>x.appOnly).length,'Solo VolleyCore']].map(([v,l])=>`<article class="stat"><strong>${v}</strong><span>${l}</span></article>`).join('');$('#bankReconciliationBody').innerHTML=rows.map(x=>`<tr><td>${esc(x.date||'—')}</td><td>${esc(x.description||x.appOnly?.description||'—')}</td><td>${esc(x.reference||x.appOnly?.reference||'—')}</td><td>${money(x.amount)}</td><td><span class="badge ${x.match?'paid':x.appOnly?'pending':'overdue'}">${x.match?'Conciliado':x.appOnly?'Solo VolleyCore':'Solo banco'}</span></td><td>${x.match?esc(x.match.description):x.appOnly?esc(x.appOnly.source):'Revisar'}</td></tr>`).join('')||'<tr><td colspan="6">Carga un archivo CSV del banco para iniciar la conciliación.</td></tr>'}
async function loadCommunityData(){const results=await Promise.allSettled([col('categoryGallery',[where('orgId','==',ORG_ID)]),col('fixedExpenses',[where('orgId','==',ORG_ID)]),col('sponsorIncome',[where('orgId','==',ORG_ID)])]);categoryGallery=results[0].status==='fulfilled'?results[0].value:[];fixedExpenses=results[1].status==='fulfilled'?results[1].value:[];sponsorIncome=results[2].status==='fulfilled'?results[2].value:[];results.filter(x=>x.status==='rejected').forEach(x=>console.debug('Optional community/finance collection unavailable for role:',x.reason?.code||x.reason))}

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
function dashboardUpcomingEventGroups(limit=5){
  const grouped=new Map();
  events.filter(e=>e.date>=today()&&e.status!=='cancelled')
    .sort((a,b)=>`${a.date} ${a.startTime||''}`.localeCompare(`${b.date} ${b.startTime||''}`))
    .forEach(e=>{const key=trainingCalendarEventGroupKey(e);if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(e)});
  return [...grouped.values()]
    .sort((a,b)=>`${a[0]?.date||''} ${a[0]?.startTime||''}`.localeCompare(`${b[0]?.date||''} ${b[0]?.startTime||''}`))
    .slice(0,limit);
}
function dashboardUpcomingGroupHTML(group){
  const first=group[0],visual=sportsEventVisualType(group),location=eventLocationName(first);
  if(visual==='festival')return `<div class="vc-dashboard-match-row vc-dashboard-festival-row"><strong>FESTIVAL · ${esc(sportsCategoryNames(first))}</strong><span>${esc(location)}</span><small>${dashboardFormatDate(first.date)}</small><div class="vc-dashboard-festival-games">${group.map(e=>`<small><b>${esc(e.startTime||'Hora por definir')}</b>${e.opponent?` · vs ${esc(e.opponent)}`:` · ${esc(e.title||typeLabel(e.type))}`}</small>`).join('')}</div></div>`;
  return `<div class="vc-dashboard-match-row"><strong>${esc(sportsCategoryNames(first))}</strong><span>${first.type==='match'&&first.opponent?`vs ${esc(first.opponent)}`:esc(first.title||typeLabel(first.type))}</span><small>${dashboardFormatDate(first.date)} · ${esc(first.startTime||'Hora por definir')} · ${esc(location)}</small></div>`;
}
function renderDashboard(){
  renderSessionIdentity();
  const activePlayers=players.filter(p=>p.status==='active').length;
  const openCharges=charges.filter(c=>['pending','partial'].includes(c.status));
  const pendingCount=openCharges.length;
  const overduePlayers=new Set(openCharges.filter(c=>chargeDueState(c)==='overdue').map(c=>c.playerId)).size;
  const attendance=dashboardAttendancePercent();
  const nextTraining=dashboardNextTrainingOccurrence();
  const upcomingEventGroups=dashboardUpcomingEventGroups(5);
  const activeTrainingSeries=trainingSeries.filter(t=>t.status!=='inactive');
  const trainingCategoryCount=new Set(activeTrainingSeries.map(t=>t.categoryId).filter(Boolean)).size;

  const name=(profile?.fullName||'').trim().split(/\s+/)[0]||'';
  const hour=new Date().getHours(),greeting=hour<12?'Buenos días':hour<18?'Buenas tardes':'Buenas noches';
  $('#dashboardGreeting').textContent=`¡${greeting}, ${name||'equipo'}!`;
  $('#dashboardToday').textContent=dashboardFormatDate(today());

  $('#summaryCards').innerHTML=[
    [activePlayers,'JUGADORAS ACTIVAS','♙','red','players',''],
    [pendingCount,'PAGOS PENDIENTES','₡','green','sinpeAdmin','pending'],
    [overduePlayers,'MOROSAS','!','red','sinpeAdmin','overdue'],
    [`${attendance}%`,'ASISTENCIA PROMEDIO','↗','cyan','attendance','']
  ].map(([v,l,icon,color,view,paymentMode])=>`<article class="stat vc-kpi-card" data-dashboard-view="${view}" ${paymentMode?`data-dashboard-payment-mode="${paymentMode}"`:''}>
    <span class="vc-round-icon ${color}">${icon}</span>
    <div><span>${l}</span><strong>${v}</strong><small>Ver detalles →</small></div>
  </article>`).join('');

  $('#dashboardNextTraining').innerHTML=`
    <h3 class="vc-feature-highlight cyan-text">${activeTrainingSeries.length} horarios recurrentes</h3>
    <div class="vc-feature-lines">
      <div>◉ <strong>${trainingCategoryCount} categorías</strong> con entrenamiento configurado</div>
      ${nextTraining?`<div>◷ Próximo: <strong>${esc(catName(nextTraining.series.categoryId))}</strong> · ${dashboardFormatDate(nextTraining.date)} · ${esc(nextTraining.startTime||'')}</div>`:'<div>No hay una próxima sesión calculada.</div>'}
    </div>
    <span class="vc-card-link">Ver entrenamientos →</span>
  `;

  $('#dashboardNextMatch').innerHTML=upcomingEventGroups.length?`
    <div class="vc-dashboard-match-list">${upcomingEventGroups.map(dashboardUpcomingGroupHTML).join('')}</div>
    <span class="vc-card-link">Ver calendario →</span>
  `:'<p class="muted">No hay eventos próximos registrados.</p>';

  const pendingRows=openCharges
    .sort((a,b)=>(a.dueDate||dueDateForMonth(a.month)).localeCompare(b.dueDate||dueDateForMonth(b.month)))
    .slice(0,5);
  $('#dashboardPendingPayments').innerHTML=pendingRows.length?`<div class="table-wrap vc-embedded-table"><table>
    <thead><tr><th>Jugadora</th><th>Categoría</th><th>Concepto</th><th>Vencimiento</th><th>Monto</th><th>Estado</th></tr></thead>
    <tbody>${pendingRows.map(c=>{
      const due=chargeDueState(c),remaining=Math.max(0,Number(c.amount||0)-Number(c.paidAmount||0));
      return `<tr><td><strong>${esc(playerName(c.playerId))}</strong></td><td>${esc(catName(c.categoryId))}</td><td>${esc(monthLabel(c.month))}</td><td>${esc(c.dueDate||dueDateForMonth(c.month))}</td><td>${money(remaining)}</td><td><span class="badge ${due==='overdue'?'overdue':'pending'}">${due==='overdue'?'Morosa':'Pendiente'}</span></td></tr>`;
    }).join('')}</tbody></table></div>`:'<p class="muted">No hay pagos pendientes.</p>';

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
  if(isFirstDivisionPrimary(p))return{key:'first-division',label:'Primera División',detail:''};
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
    return`<tr><td><strong>${esc(p.playerCode)}</strong></td><td><strong>${esc(p.name)}</strong><div class="player-visual-badges">${p?.nationalTeam?`<span class="badge national-team-badge">${nationalFlagSvg()} Seleccionada Nacional</span>`:''}</div><div class="muted">${esc(p.birthdate||'')}</div></td><td><strong>Jugadora de:</strong> ${esc(primaryCategoryName(p))}<div class="muted"><strong>Refuerza:</strong> ${esc(reinforcementCategoryNames(p))}</div></td><td>${guardianHTML(p)}</td><td>${(p.linkedUserIds||[]).map(id=>`<span class="chip">${esc(userName(id))}</span>`).join('')||'—'}</td><td>${isFirstDivisionPrimary(p)?'—':money(playerMonthlyFee(p))}</td><td><span class="badge ${financial.key}">${esc(financial.label)}</span><div class="muted">${esc(financial.detail)}</div>${isFirstDivisionPrimary(p)?'':`<button class="action" data-player-finances="${p.id}">Revisar meses</button>`}</td><td><span class="badge ${p.status}">${p.status==='injured'?injuryCrossSvg():''}${esc(statusLabel(p.status))}</span><div><span class="badge ${insurance.key}">${esc(insurance.label)}</span></div></td><td><div class="actions"><button class="action" data-view-player="${p.id}">Ver ficha</button><button class="action" data-edit-player="${p.id}">Editar</button></div></td></tr>`;
  }).join('')||'<tr><td colspan="9">No hay jugadoras para los filtros seleccionados.</td></tr>';
}
function renderCategories(){$('#categoriesBody').innerHTML=categories.map(c=>`<tr><td><strong>${esc(c.name)}</strong><div class="muted">${esc(seasonName(c.seasonId))}</div></td><td>${esc(c.ageGroup||'—')}${c.teamColor?`<div class="muted">${esc(c.teamColor)}</div>`:''}</td><td>${esc(c.coach||'—')}<div class="muted">${esc(c.assistant||'')}</div></td><td>${esc(c.schedule||daysLabel(trainingSeries.filter(t=>t.categoryId===c.id&&t.status==='active').flatMap(t=>t.days||[]))||'—')}</td><td>${esc(venueName(c.venueId))}${venueLinks(c.venueId)}</td><td>${money(c.fee)}</td><td><span class="badge ${c.status}">${statusLabel(c.status)}</span></td><td><button class="action" data-view-category="${c.id}">Ver ficha</button><button class="action" data-edit-category="${c.id}">Editar</button></td></tr>`).join('')||'<tr><td colspan="8">No hay categorías.</td></tr>'}
function renderSeasons(){const el=$('#seasonsList');if(!el)return;el.innerHTML=seasons.map(s=>`<article class="panel"><div class="page-head compact-head"><div><span class="eyebrow">${s.isCurrent?'TEMPORADA ACTUAL':'TEMPORADA'}</span><h3>${esc(s.name)}</h3></div><span class="badge ${s.status}">${statusLabel(s.status)}</span></div><p>${esc(s.startDate)} — ${esc(s.endDate)}</p><div class="actions"><button class="action" data-edit-season="${s.id}">Editar</button><button class="action danger-action" data-delete-season="${s.id}">Eliminar</button></div></article>`).join('')||'<p class="muted">No hay temporadas. Crea la temporada actual antes de programar entrenamientos.</p>'}
let trainingWeekOffset=0,trainingMonthOffset=0,trainingViewMode='week';
const TRAINING_CATEGORY_COLORS={'primera division':'#22b8b8','u21 jdn':'#22c55e','u-19':'#facc15','u19':'#facc15','17-negro':'#111827','u17-negro':'#111827','u17-rojo':'#dc2626','u15':'#2563eb','u13':'#9ca3af','iniciacion':'#f97316'};
const TRAINING_CATEGORY_FALLBACK=['#7c3aed','#0891b2','#db2777','#65a30d','#4f46e5','#ea580c'];
function trainingCategoryKey(name=''){return norm(name).replace(/\s+/g,' ').trim()}
function trainingColor(categoryId){const key=trainingCategoryKey(catName(categoryId)||'');const fixed=TRAINING_CATEGORY_COLORS[key];if(fixed)return fixed;const ordered=[...categories].sort((a,b)=>(a.name||'').localeCompare(b.name||''));const i=Math.max(0,ordered.findIndex(c=>c.id===categoryId));return TRAINING_CATEGORY_FALLBACK[i%TRAINING_CATEGORY_FALLBACK.length]}
function trainingWeekStart(){const d=new Date(`${today()}T12:00:00`),day=d.getDay(),diff=(day===0?-6:1-day)+(trainingWeekOffset*7);d.setDate(d.getDate()+diff);return d.toISOString().slice(0,10)}
function trainingMonthDate(){const d=new Date(`${today().slice(0,7)}-01T12:00:00`);d.setMonth(d.getMonth()+trainingMonthOffset);return d}
function isoDateLocal(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}

function sportsCategoryIds(item){
  return [...new Set([...(item?.categoryIds||[]),...(item?.categoryId?[item.categoryId]:[])])].filter(Boolean);
}
function sportsCategoryNames(item){return sportsCategoryIds(item).map(catName).filter(Boolean).join(' + ')||'Sin categoría'}
function sportsHasCategory(item,categoryId){return !categoryId||sportsCategoryIds(item).includes(categoryId)}
function sportsTypeLabel(type,count=1){
  if(type==='training')return 'ENTRENAMIENTO';
  if(type==='festival')return 'FESTIVAL';
  if(type==='match')return count>1?`${count} PARTIDOS`:'PARTIDO';
  return 'EVENTO';
}
function sportsEventVisualType(group){
  if(group.some(e=>e.type==='festival'))return'festival';
  if(group.length>=2&&group.every(e=>e.type==='match'))return'festival';
  if(group.every(e=>e.type==='match'))return'match';
  return'other';
}
function trainingMinutes(t){const [sh,sm]=(t.startTime||'00:00').split(':').map(Number),[eh,em]=(t.endTime||'00:00').split(':').map(Number);return Math.max(0,(eh*60+em)-(sh*60+sm))}
function trainingFilteredSeries(){const cat=$('#trainingCategoryFilter').value,se=$('#trainingSeasonFilter').value,venue=$('#trainingVenueFilter').value,tp=$('#sportsActivityTypeFilter')?.value||'';return trainingSeries.filter(t=>sportsHasCategory(t,cat)&&(!se||t.seasonId===se)&&(!venue||t.venueId===venue)&&t.status!=='inactive'&&(!tp||tp==='training'))}
function trainingFilteredEvents(from,to){
  const cat=$('#trainingCategoryFilter').value,se=$('#trainingSeasonFilter').value,venue=$('#trainingVenueFilter').value,tp=$('#sportsActivityTypeFilter')?.value||'';
  return events.filter(e=>e.status!=='cancelled'&&e.date>=from&&e.date<=to&&sportsHasCategory(e,cat)&&(!se||e.seasonId===se)&&(!venue||e.venueId===venue||e.sourceVenueName===venueName(venue))&&(!tp||(tp==='other'?!['match','festival'].includes(e.type):e.type===tp)));
}
function trainingFilteredMatches(from,to){return trainingFilteredEvents(from,to).filter(e=>e.type==='match')}
function timeToMinutes(v){if(!v)return null;const [h,m]=String(v).split(':').map(Number);return Number.isFinite(h)&&Number.isFinite(m)?h*60+m:null}
function rangesOverlap(aStart,aEnd,bStart,bEnd){const as=timeToMinutes(aStart),ae=timeToMinutes(aEnd),bs=timeToMinutes(bStart),be=timeToMinutes(bEnd);if(as===null||bs===null)return aStart===bStart;const a2=ae===null?as+120:ae,b2=be===null?bs+120:be;return as<b2&&bs<a2}
function trainingSuppressedByMatch(o,t,matches){const tids=sportsCategoryIds(t);return matches.some(e=>e.date===o.date&&sportsCategoryIds(e).some(id=>tids.includes(id))&&rangesOverlap(o.startTime,o.endTime,e.startTime,e.endTime))}
function eventDisplayIcon(e){if(e.type==='festival')return '🎪';return eventEffectiveHomeAway(e)==='away'?'🚌':'🏠'}
function eventDisplayLabel(e){return e.type==='festival'?'FESTIVAL':(eventEffectiveHomeAway(e)==='away'?'VISITA':'CASA')}
function eventTimeLabel(e){const start=e.startTime||'Hora por definir',end=e.endTime||'';return end?`${start} – ${end}`:start}
function renderTrainingLegend(list){const ids=[...new Set(list.map(t=>t.categoryId).filter(Boolean))];$('#trainingLegend').innerHTML=ids.map(id=>`<span class="training-legend-item"><i style="--training-color:${trainingColor(id)}"></i>${esc(catName(id))}</span>`).join('')+`<span class="training-legend-item training-match-legend">🏠 Casa</span><span class="training-legend-item">🚌 Visita</span><span class="training-legend-item">🎪 Festival</span>`}

function sportsEventVenueGroupKey(e){return norm(eventLocationName(e)||'sede por definir').replace(/\s+/g,' ').trim()}
function trainingCalendarEventGroupKey(e){return `${sportsCategoryIds(e).sort().join('+')}__${e.date||''}__${sportsEventVenueGroupKey(e)}`}
function sportsGroupToken(group){
  const first=group[0];return encodeURIComponent(JSON.stringify({date:first.date||'',ids:sportsCategoryIds(first).sort(),venue:sportsEventVenueGroupKey(first)}));
}
function renderGroupedSportsEvents(eventsForDay,{month=false}={}){
  const groups=new Map();
  [...eventsForDay].sort((a,b)=>(a.startTime||'').localeCompare(b.startTime||'')).forEach(e=>{
    const key=trainingCalendarEventGroupKey(e);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(e);
  });
  return [...groups.values()].map(group=>{
    const first=group[0],categoryId=sportsCategoryIds(first)[0]||first.categoryId,color=trainingColor(categoryId),visual=sportsEventVisualType(group);
    const locationNames=[...new Set(group.map(eventLocationName).filter(Boolean))];
    const typeTitle=visual==='festival'?'FESTIVAL':visual==='match'?sportsTypeLabel('match',group.length):'EVENTO';
    const schedule=group.map(e=>`${e.startTime||'—'}${e.opponent?' · vs '+e.opponent:''}`).join(' | ');
    return `<button type="button" class="training-event-group ${month?'month-group':''} ${visual==='festival'?'has-festival':''}" style="--training-color:${color}" data-open-sports-group="${sportsGroupToken(group)}">
      <header><span class="training-category-dot"></span><strong>${esc(typeTitle)} · ${esc(sportsCategoryNames(first))}</strong></header>
      ${locationNames.length===1?`<small class="sports-group-venue">${esc(locationNames[0])}</small>`:''}
      <div class="training-event-group-list">${group.map(e=>`<span class="training-group-event-row"><span class="training-group-event-main"><b>${eventDisplayIcon(e)} ${esc(eventTimeLabel(e))}</b><span>${e.opponent?'vs '+esc(e.opponent):esc(e.title||typeLabel(e.type))}</span></span></span>`).join('')}</div>
    </button>`;
  }).join('');
}
function openSportsDayGroup(token){
  let payload={date:'',ids:[],venue:''};
  try{payload=JSON.parse(decodeURIComponent(token||''))}catch{return}
  const date=payload.date||'',ids=Array.isArray(payload.ids)?payload.ids.filter(Boolean):[],venue=payload.venue||'';
  const group=events.filter(e=>e.date===date&&sportsCategoryIds(e).slice().sort().join(',')===ids.slice().sort().join(',')&&sportsEventVenueGroupKey(e)===venue&&e.status!=='cancelled').sort((a,b)=>(a.startTime||'').localeCompare(b.startTime||''));
  if(!group.length)return;
  const first=group[0],visual=sportsEventVisualType(group),locations=[...new Set(group.map(eventLocationName).filter(Boolean))];
  $('#sportsDayDetailTitle').textContent=`${visual==='festival'?'Festival':visual==='match'?sportsTypeLabel('match',group.length):'Evento'} · ${sportsCategoryNames(first)} · ${date}`;
  $('#sportsDayDetailContent').innerHTML=`${locations.length===1?`<article class="panel"><strong>Sede</strong><p>${esc(locations[0])}</p></article>`:''}<div class="cards-list">${group.map(e=>`<article class="panel sports-detail-event"><div><span class="eyebrow">${esc(typeLabel(e.type))}</span><h3>${eventDisplayIcon(e)} ${esc(e.startTime||'Hora por definir')}${e.endTime?' – '+esc(e.endTime):''}</h3><p>${e.opponent?`<strong>Rival:</strong> ${esc(e.opponent)}<br>`:''}${locations.length!==1?`<strong>Sede:</strong> ${esc(eventLocationName(e))}<br>`:''}<strong>Condición:</strong> ${esc(eventDisplayLabel(e))}</p></div><div class="actions"><button class="btn secondary" type="button" data-edit-event="${e.id}">Editar</button><button class="btn secondary danger-action" type="button" data-delete-event="${e.id}">Eliminar</button></div></article>`).join('')}</div>`;
  $('#sportsDayDetailDialog').showModal();
}
function renderTrainingMonth(list){
  const md=trainingMonthDate(),first=new Date(md.getFullYear(),md.getMonth(),1,12),last=new Date(md.getFullYear(),md.getMonth()+1,0,12);
  const gridStart=new Date(first),back=first.getDay()===0?6:first.getDay()-1;gridStart.setDate(gridStart.getDate()-back);
  const gridEnd=new Date(last),forward=last.getDay()===0?0:7-last.getDay();gridEnd.setDate(gridEnd.getDate()+forward);
  const from=isoDateLocal(gridStart),to=isoDateLocal(gridEnd);
  const sportsEvents=trainingFilteredEvents(from,to),matches=sportsEvents.filter(e=>e.type==='match');
  const trainingOcc=list.flatMap(t=>occurrences(t,from,to).filter(o=>o.status!=='cancelled'&&!trainingSuppressedByMatch(o,t,matches)).map(o=>({...o,series:t,kind:'training'})));
  const calendarEvents=sportsEvents.map(e=>({kind:'event',date:e.date,startTime:e.startTime||'',event:e}));
  const entries=[...trainingOcc,...calendarEvents].sort((a,b)=>`${a.date} ${a.startTime||''}`.localeCompare(`${b.date} ${b.startTime||''}`));
  const days=[];for(let d=new Date(gridStart);d<=gridEnd;d.setDate(d.getDate()+1))days.push(isoDateLocal(d));
  const monthName=new Intl.DateTimeFormat('es-CR',{month:'long',year:'numeric'}).format(md);$('#trainingWeekLabel').textContent=monthName.charAt(0).toUpperCase()+monthName.slice(1);
  $('#trainingMonthCalendar').innerHTML=`<div class="training-month-weekdays">${['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(x=>`<strong>${x}</strong>`).join('')}</div><div class="training-month-grid">${days.map(date=>{
    const inMonth=date.slice(0,7)===isoDateLocal(md).slice(0,7),items=entries.filter(x=>x.date===date);
    const eventItems=items.filter(x=>x.kind==='event').map(x=>x.event);
    const trainingItems=items.filter(x=>x.kind==='training');
    return`<section class="training-month-day ${inMonth?'':'outside-month'}"><header>${Number(date.slice(8,10))}</header><div class="training-month-items">${renderGroupedSportsEvents(eventItems,{month:true})}${trainingItems.map(x=>{const t=x.series;return`<button type="button" class="training-month-item training" style="--training-color:${trainingColor(t.categoryId)}" data-training-occurrence="${t.id}|${x.date}"><b>🏐 ENTRENAMIENTO · ${esc(sportsCategoryNames(t))}</b><span>${esc(x.startTime)} – ${esc(x.endTime)} · ${esc(venueName(x.venueId||t.venueId))}</span></button>`}).join('')}</div></section>`;
  }).join('')}</div>`;
}
function renderTrainings(){
  const cv=$('#trainingVenueFilter').value||'';$('#trainingVenueFilter').innerHTML='<option value="">Todos los gimnasios</option>'+venues.map(v=>`<option value="${v.id}" ${cv===v.id?'selected':''}>${esc(v.name||'Gimnasio')}</option>`).join('');
  const list=trainingFilteredSeries(),ws=trainingWeekStart(),we=datePlus(ws,6);
  const weekEvents=trainingFilteredEvents(ws,we),weekMatches=weekEvents.filter(e=>e.type==='match');
  const weekOcc=list.flatMap(t=>occurrences(t,ws,we).filter(o=>o.status!=='cancelled'&&!trainingSuppressedByMatch(o,t,weekMatches)).map(o=>({...o,series:t})));
  const upcoming=list.flatMap(t=>occurrences(t,today(),datePlus(today(),60)).filter(o=>o.status!=='cancelled')).length,activeCats=new Set(list.map(t=>t.categoryId)).size,hours=weekOcc.reduce((s,o)=>s+trainingMinutes(o.series),0)/60;
  $('#trainingStats').innerHTML=[[upcoming+weekEvents.filter(e=>e.date>=today()).length,'Próximas actividades','upcoming'],[weekOcc.length+weekEvents.length,'Esta semana','week'],[new Set([...list.flatMap(sportsCategoryIds),...weekEvents.flatMap(sportsCategoryIds)]).size,'Categorías activas','categories'],[hours.toFixed(hours%1?1:0),'Horas de entrenamiento','hours']].map(([v,l,a])=>`<button type="button" class="stat clickable-stat training-stat-card compact-training-stat" data-training-stat="${a}"><strong>${v}</strong><span>${l}</span></button>`).join('');
  renderTrainingLegend(list);
  $('#trainingPrevWeek').textContent=trainingViewMode==='month'?'‹ Mes anterior':'‹ Semana anterior';$('#trainingNextWeek').textContent=trainingViewMode==='month'?'Mes siguiente ›':'Semana siguiente ›';$('#trainingTodayWeek').textContent=trainingViewMode==='month'?'Este mes':'Esta semana';$('.training-week-nav')?.classList.toggle('hidden',trainingViewMode==='list');
  if(trainingViewMode==='week'){
    $('#trainingWeekLabel').textContent=`${ws} — ${we}`;const names=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
    $('#trainingCalendar').innerHTML=names.map((name,i)=>{
      const date=datePlus(ws,i);
      const dayEvents=weekEvents.filter(e=>e.date===date);
      const dayTrainings=weekOcc.filter(o=>o.date===date).sort((a,b)=>(a.startTime||'').localeCompare(b.startTime||''));
      const groupedEvents=renderGroupedSportsEvents(dayEvents);
      const trainingsHtml=dayTrainings.map(x=>{const t=x.series;return`<button class="training-block" style="--training-color:${trainingColor(t.categoryId)}" data-training-occurrence="${t.id}|${x.date}" type="button"><span class="training-category-dot"></span><strong>🏐 ENTRENAMIENTO · ${esc(sportsCategoryNames(t))}</strong><span>${esc(x.startTime)} – ${esc(x.endTime)}</span><small>${esc(venueName(x.venueId||t.venueId))}</small>${x.status==='changed'?'<em>Modificado</em>':''}</button>`}).join('');
      return`<section class="training-day"><header><strong>${name}</strong><span>${date.slice(8,10)}/${date.slice(5,7)}</span></header><div class="training-day-body">${groupedEvents}${trainingsHtml}${!groupedEvents&&!trainingsHtml?'<span class="training-empty">Sin entrenamientos ni partidos</span>':''}</div></section>`;
    }).join('');
  }else if(trainingViewMode==='month'){renderTrainingMonth(list)}
  const listEvents=trainingFilteredEvents(today(),datePlus(today(),365));
  const listGroups=new Map();listEvents.forEach(e=>{const k=trainingCalendarEventGroupKey(e);if(!listGroups.has(k))listGroups.set(k,[]);listGroups.get(k).push(e)});
  const eventListHtml=[...listGroups.values()].sort((a,b)=>`${a[0].date} ${a[0].startTime||''}`.localeCompare(`${b[0].date} ${b[0].startTime||''}`)).map(group=>{const first=group[0],visual=sportsEventVisualType(group),locations=[...new Set(group.map(eventLocationName).filter(Boolean))],label=visual==='festival'?'FESTIVAL':visual==='match'?sportsTypeLabel('match',group.length):'EVENTO';return `<button type="button" class="panel training-list-card clickable-card" style="--training-color:${trainingColor(sportsCategoryIds(first)[0]||first.categoryId)}" data-open-sports-group="${sportsGroupToken(group)}"><div class="page-head compact-head"><div><span class="eyebrow">${esc(label)} · ${esc(sportsCategoryNames(first))}</span><h3>${esc(first.date)}</h3></div></div>${locations.length===1?`<p><strong>Sede:</strong> ${esc(locations[0])}</p>`:''}<p>${group.map(e=>`${esc(e.startTime||'—')}${e.opponent?' · vs '+esc(e.opponent):''}`).join('<br>')}</p></button>`}).join('');
  const trainingListHtml=list.map(t=>`<article class="panel training-list-card clickable-card" style="--training-color:${trainingColor(t.categoryId)}" data-edit-training="${t.id}" role="button" tabindex="0"><div class="page-head compact-head"><div><span class="eyebrow">ENTRENAMIENTO · ${esc(sportsCategoryNames(t))} · ${esc(seasonName(t.seasonId))}</span><h3>${esc(daysLabel(t.days))}</h3></div><span class="badge ${t.status}">${statusLabel(t.status)}</span></div><p><strong>${esc(t.startTime)} – ${esc(t.endTime)}</strong> · ${esc(venueName(t.venueId))}</p><div class="actions"><button class="action" data-edit-training="${t.id}">Editar serie</button><button class="action" data-training-exception="${t.id}">Cambiar/cancelar fecha</button><button class="action" data-training-future="${t.id}">Cambiar siguientes</button></div></article>`).join('');
  $('#trainingsList').innerHTML=eventListHtml+trainingListHtml||'<p class="muted">No hay actividades para los filtros seleccionados.</p>';
  $('#trainingCalendar').classList.toggle('hidden',trainingViewMode!=='week');$('#trainingMonthCalendar').classList.toggle('hidden',trainingViewMode!=='month');$('#trainingsList').classList.toggle('hidden',trainingViewMode!=='list');
}
function renderFamilyTrainings(){const list=familyTrainingSeries;$('#familyTrainingsList').innerHTML=list.map(t=>{const upcomingExceptions=familyTrainingExceptions.filter(x=>x.seriesId===t.id&&x.date>=today()).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,5);return`<article class="panel"><span class="eyebrow">ENTRENAMIENTO · ${esc(sportsCategoryNames(t))} · ${esc(seasonName(t.seasonId))}</span><h3>${esc(daysLabel(t.days))}</h3><p><strong>${esc(t.startTime)} – ${esc(t.endTime)}</strong></p><p>${esc(venueName(t.venueId))}</p>${venueLinks(t.venueId)}${upcomingExceptions.length?`<h4>Próximos cambios</h4>${upcomingExceptions.map(x=>`<div class="recent-item"><div><strong>${esc(x.date)}</strong><div class="muted">${x.action==='cancelled'?'Cancelado':`${esc(x.startTime||t.startTime)} – ${esc(x.endTime||t.endTime)} · ${esc(venueName(x.venueId||t.venueId))}`}</div></div><span class="badge ${x.action}">${statusLabel(x.action)}</span></div>`).join('')}`:''}</article>`}).join('')||'<p class="muted">No hay entrenamientos configurados para tus categorías.</p>'}
function eventAdminCard(e,{past=false}={}){
  const locationUrl=safeExternalUrl(e.locationUrl||'');
  return `<article class="panel event-card ${past?'past-event-card':''}">
    <div>
      <span class="eyebrow">${esc(typeLabel(e.type))} · ${esc(sportsCategoryNames(e))} · ${esc(seasonName(e.seasonId))}</span>
      <h3>${esc(e.title)}</h3>
      <p><strong>${esc(e.date)}</strong> · ${esc(e.startTime||'')} ${e.endTime?'– '+esc(e.endTime):''}</p>
      <p>${esc(eventLocationName(e))}${e.opponent?' · Rival: '+esc(e.opponent):''}${e.homeAway==='away'&&e.awayAddress?`<br>${esc(e.awayAddress)}`:''}</p>
      ${locationUrl?`<a href="${esc(locationUrl)}" target="_blank" rel="noopener">Abrir ubicación</a>`:venueLinks(e.venueId)}
      <p class="muted">${esc(e.notes||'')}</p>
    </div>
    <div>
      <span class="badge ${e.status}">${esc(statusLabel(e.status))}</span>
      <div class="actions"><button class="action" data-edit-event="${e.id}">Editar</button><button class="action danger-action" data-delete-event="${e.id}">Eliminar</button></div>
    </div>
  </article>`;
}
function dateDaysAgo(days){
  const d=new Date(`${today()}T00:00:00`);d.setDate(d.getDate()-days);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function renderEvents(){
  const cat=$('#eventCategoryFilter').value,tp=$('#eventTypeFilter').value,se=$('#eventSeasonFilter').value;
  const filtered=events.filter(e=>sportsHasCategory(e,cat)&&(!tp||e.type===tp)&&(!se||e.seasonId===se));
  const current=filtered.filter(e=>e.date>=today()).sort((a,b)=>`${a.date} ${a.startTime||''}`.localeCompare(`${b.date} ${b.startTime||''}`));
  const cutoff=dateDaysAgo(7);
  const past=filtered.filter(e=>e.date<today()&&e.date>=cutoff).sort((a,b)=>`${b.date} ${b.startTime||''}`.localeCompare(`${a.date} ${a.startTime||''}`));
  $('#eventsList').innerHTML=current.map(e=>eventAdminCard(e)).join('')||'<p class="muted">No hay eventos actuales o próximos para los filtros seleccionados.</p>';
  $('#pastEventsList').innerHTML=past.map(e=>eventAdminCard(e,{past:true})).join('')||'<p class="muted">No hay eventos anteriores en los últimos 7 días.</p>';
}
function renderVenues(){$('#venuesList').innerHTML=venues.map(v=>`<article class="panel"><h3>${esc(v.name)}</h3><p>${esc(v.address)}</p><p class="muted">${esc(v.directions||'')}</p>${venueLinks(v.id)}<div class="actions"><button class="action" data-edit-venue="${v.id}">Editar</button><button class="action danger-action" data-delete-venue="${v.id}">Eliminar</button></div></article>`).join('')||'<p class="muted">No hay lugares registrados.</p>'}
function renderAnnouncements(){$('#announcementsList').innerHTML=announcements.map(a=>`<article class="panel"><div class="page-head compact-head"><div><span class="eyebrow">${a.categoryId?esc(catName(a.categoryId)):'Todas las categorías'}</span><h3>${esc(a.title)}</h3></div><span class="badge ${a.status}">${statusLabel(a.status)}</span></div><p>${esc(a.body)}</p><button class="action" data-edit-announcement="${a.id}">Editar</button></article>`).join('')||'<p class="muted">No hay comunicados.</p>'}
function applyFinanceStatusFilter(status){
  const filter=$('#chargeStatusFilter');if(!filter)return;
  filter.value=status||'';
  renderCharges();
}
function renderCharges(){renderFinanceEnhancements();renderBankReconciliation();
  const {from:periodFrom,to:periodTo}=financePeriod(),cat=financeAppliedCategory()||$('#chargeCategoryFilter')?.value||'',st=$('#chargeStatusFilter').value;
  const list=charges.filter(c=>{
    const p=players.find(x=>x.id===c.playerId);
    const categoryMatch=!cat||(p&&playerCatIds(p).includes(cat))||c.categoryId===cat;
    const dueState=chargeDueState(c);
    const statusMatch=!st||(st==='overdue'?dueState==='overdue':st==='pending'?(c.status==='pending'&&dueState!=='overdue'):c.status===st);
    return (!c.month||(c.month>=periodFrom&&c.month<=periodTo))&&categoryMatch&&statusMatch;
  });
  const total=list.reduce((s,c)=>s+Number(c.amount||0),0),paid=list.reduce((s,c)=>s+Number(c.paidAmount||0),0),overdue=list.filter(c=>chargeDueState(c)==='overdue').length;
  $('#financeSummary').innerHTML=[
    [money(total),'Total generado',''],
    [money(paid),'Pagado','paid'],
    [money(total-paid),'Pendiente','pending'],
    [overdue,'Morosos','overdue'],
    [list.length,'Cargos','']
  ].map(([v,l,s])=>`<button type="button" class="stat clickable-stat finance-summary-card ${st===s||(s===''&&st==='')?'selected':''}" data-finance-status="${s}"><strong>${v}</strong><span>${l}</span></button>`).join('');
  $('#chargesBody').innerHTML=list.map(c=>{const p=players.find(x=>x.id===c.playerId),due=chargeDueState(c),label=due==='overdue'?'Morosa':statusLabel(c.status);return`<tr class="clickable-row" data-edit-charge="${c.id}" role="button" tabindex="0"><td><strong>${esc(playerName(c.playerId))}</strong><div class="muted">${esc(c.playerCode||'')}</div></td><td>${esc(p?catNames(p):catName(c.categoryId))}</td><td>${esc(c.month)}</td><td>${money(c.amount)}</td><td>${money(c.paidAmount)}</td><td><span class="badge ${due}">${esc(label)}</span>${due==='overdue'?`<div class="muted">Venció el 15</div>`:''}</td><td><button class="action" data-edit-charge="${c.id}">Editar</button></td></tr>`}).join('')||'<tr><td colspan="7">No hay mensualidades para los filtros seleccionados.</td></tr>';
}
function sinpeReportMonth(s){return s.month||s.allocations?.[0]?.month||String(s.date||'').slice(0,7)}
function sinpeReportCategoryId(s){const cid=s.allocations?.[0]?.categoryId;if(cid)return cid;const p=players.find(x=>x.id===s.playerId);return p?.categoryId||p?.categoryIds?.[0]||''}
function sinpeHasCategory(s,categoryId){return !categoryId||(s.allocations?.length?s.allocations.some(a=>(a.categoryId||players.find(p=>p.id===a.playerId)?.categoryId)===categoryId):sinpeReportCategoryId(s)===categoryId)}
function sinpeCategoryLabel(s){const ids=[...new Set((s.allocations?.length?s.allocations.map(a=>a.categoryId||players.find(p=>p.id===a.playerId)?.categoryId):[sinpeReportCategoryId(s)]).filter(Boolean))];return ids.length>1?`${ids.length} categorías`:catName(ids[0]||'')}
function sinpeAllocationSummary(s){const a=s.allocations||[];if(!a.length)return'';return a.map(x=>`${playerName(x.playerId)} · ${monthLabel(x.month)} · ${money(x.amount)}`).join(' | ')}
function paymentReceiptHTML(s){return s.receiptUrl?`<p><a class="action" href="${esc(s.receiptUrl)}" target="_blank" rel="noopener">Ver comprobante adjunto</a></p>`:''}
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
    if(category&&!sinpeHasCategory(s,category))return false;
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
    const allocationPlayerIds=(s.allocations||[]).map(a=>a.playerId).filter(Boolean),family=families.find(f=>(f.playerIds||[]).some(id=>id===s.playerId||allocationPlayerIds.includes(id)));
    return`<article class="panel"><div class="page-head compact-head"><div><span class="eyebrow">${esc(paymentMethodLabel(paymentMethodValue(s)))} · ${esc(monthLabel(sinpeReportMonth(s)))} · ${esc(catName(sinpeReportCategoryId(s)))}</span><h3>${s.allocations?.length>1?esc(`${s.allocations.length} mensualidades`):esc(playerName(s.playerId))} — ${money(s.amount)}</h3></div><span class="badge ${s.status}">${esc(statusLabel(s.status))}</span></div><p>Familia: <strong>${esc(family?.name||'Sin familia')}</strong></p><p>Banco: <strong>${esc(s.bank||'—')}</strong> · Comprobante: <strong>${esc(s.reference|| (s.receiptUrl?'Foto adjunta':'—'))}</strong></p><p>Pagador: ${esc(s.payerName||'—')} ${s.phone?`· Teléfono: ${esc(s.phone)}`:''}</p>${s.allocations?.length?`<p class="muted"><strong>Distribución:</strong> ${esc(sinpeAllocationSummary(s))}</p>`:''}${paymentReceiptHTML(s)}<p class="muted">${esc(s.notes||'')}</p>${s.status==='reported'?`<div class="actions"><button class="btn primary" data-approve-sinpe="${s.id}">Aprobar</button><button class="btn secondary" data-reject-sinpe="${s.id}">Rechazar</button></div>`:''}</article>`;
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
    if(category&&!sinpeHasCategory(s,category))return false;
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
    $('#sinpeAdminList').innerHTML=list.map(s=>`<article class="panel"><div class="page-head compact-head"><div><span class="eyebrow">${esc(sinpeCategoryLabel(s))} · ${s.allocations?.length>1?esc(`${s.allocations.length} mensualidades`):esc(monthLabel(sinpeReportMonth(s)))} · ${esc(paymentMethodLabel(paymentMethodValue(s)))} · ${esc(s.date||'')}</span><h3>${s.allocations?.length>1?esc(`${s.allocations.length} mensualidades`):esc(playerName(s.playerId))} — ${money(s.amount)}</h3></div><span class="badge ${s.status}">${statusLabel(s.status)}</span></div><p>Banco: <strong>${esc(s.bank||'—')}</strong> · Comprobante: <strong>${esc(s.reference)}</strong> · Pagador: ${esc(s.payerName)}</p>${s.allocations?.length?`<p class="muted"><strong>Distribución:</strong> ${esc(sinpeAllocationSummary(s))}</p>`:''}${paymentReceiptHTML(s)}<p class="muted">${s.phone?`Teléfono: ${esc(s.phone)} · `:''}${esc(s.notes||'')}</p>${s.status==='approved'?`<p class="payment-meta">Aprobado el ${esc(paymentApprovedDate(s)||'—')}</p>`:''}${s.status==='reported'?`<div class="actions"><button class="btn primary" data-approve-sinpe="${s.id}">Aprobar</button><button class="btn secondary" data-reject-sinpe="${s.id}">Rechazar</button></div>`:''}</article>`).join('')||'<p class="muted">No hay pagos para los criterios seleccionados.</p>';
  }
  const download=$('#downloadPaymentsReportButton');
  if(download)download.disabled=!list.length;
}

let paymentControlMode='all';
const paymentControlModeLabel=mode=>({
  all:'Todos los pagos',
  pending:'Pagos pendientes',
  overdue:'Morosos',
  paid:'Pagados este mes',
  review:'Requieren revisión'
}[mode]||'Todos los pagos');

function populatePaymentControlFilters(){
  const month=$('#paymentControlMonth'),category=$('#paymentControlCategory');
  if(month){
    const selected=month.value;
    const months=[...new Set(charges.map(c=>c.month).filter(Boolean))].sort().reverse();
    month.innerHTML='<option value="">Todos los meses</option>'+months.map(m=>`<option value="${m}">${esc(monthLabel(m))}</option>`).join('');
    if([...month.options].some(o=>o.value===selected))month.value=selected;
  }
  if(category){
    const selected=category.value;
    category.innerHTML='<option value="">Todas las categorías</option>'+categories.filter(c=>c.status==='active').map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');
    if([...category.options].some(o=>o.value===selected))category.value=selected;
  }
}
function paymentControlFilteredCharges(){
  const q=norm($('#paymentControlSearch')?.value||'');
  const month=$('#paymentControlMonth')?.value||'';
  const category=$('#paymentControlCategory')?.value||'';
  return charges.filter(c=>{
    const p=players.find(x=>x.id===c.playerId);
    const due=chargeDueState(c);
    if(q&&!norm([playerName(c.playerId),c.playerCode,catNames(p||{})].join(' ')).includes(q))return false;
    if(month&&c.month!==month)return false;
    if(category&&!((p&&playerCatIds(p).includes(category))||c.categoryId===category))return false;
    if(paymentControlMode==='pending')return ['pending','partial'].includes(c.status)&&due!=='overdue';
    if(paymentControlMode==='overdue')return ['pending','partial'].includes(c.status)&&due==='overdue';
    if(paymentControlMode==='paid')return c.status==='paid'&&c.month===monthNow();
    return true;
  }).sort((a,b)=>{
    const ad=chargeDueState(a)==='overdue'?0:1,bd=chargeDueState(b)==='overdue'?0:1;
    return ad-bd||(a.dueDate||dueDateForMonth(a.month)).localeCompare(b.dueDate||dueDateForMonth(b.month))||playerName(a.playerId).localeCompare(playerName(b.playerId));
  });
}
function setPaymentControlMode(mode,{fromDashboard=false}={}){
  paymentControlMode=mode||'all';
  if(fromDashboard&&['pending','overdue'].includes(paymentControlMode)){
    if($('#paymentControlMonth'))$('#paymentControlMonth').value='';
  }
  if(paymentControlMode==='paid'&&$('#paymentControlMonth'))$('#paymentControlMonth').value=monthNow();
  renderPaymentControlCenter();
}
function renderPaymentControlCenter(){
  if(!$('#paymentControlCards'))return;
  populatePaymentControlFilters();
  const open=charges.filter(c=>['pending','partial'].includes(c.status));
  const pending=open.filter(c=>chargeDueState(c)!=='overdue');
  const overdue=open.filter(c=>chargeDueState(c)==='overdue');
  const paid=charges.filter(c=>c.status==='paid'&&c.month===monthNow());
  const review=sinpeReports.filter(s=>s.status==='reported');
  const pendingTotal=pending.reduce((s,c)=>s+chargeRemaining(c),0);
  const overdueTotal=overdue.reduce((s,c)=>s+chargeRemaining(c),0);
  const paidTotal=paid.reduce((s,c)=>s+Number(c.paidAmount||c.amount||0),0);
  const reviewTotal=review.reduce((s,p)=>s+Number(p.amount||0),0);
  const cards=[
    ['pending','PENDIENTES',new Set(pending.map(c=>c.playerId)).size,pendingTotal],
    ['overdue','MOROSOS',new Set(overdue.map(c=>c.playerId)).size,overdueTotal],
    ['paid','PAGADOS ESTE MES',new Set(paid.map(c=>c.playerId)).size,paidTotal],
    ['review','REQUIEREN REVISIÓN',review.length,reviewTotal]
  ];
  $('#paymentControlCards').innerHTML=cards.map(([mode,label,count,total])=>`<button class="stat payment-control-card ${paymentControlMode===mode?'selected':''}" type="button" data-payment-control-mode="${mode}"><span>${esc(label)}</span><strong>${count}</strong><small>${money(total)}</small></button>`).join('');
  $('#paymentControlTitle').textContent=paymentControlModeLabel(paymentControlMode);
  const body=$('#paymentControlBody');
  if(paymentControlMode==='review'){
    body.innerHTML=review.length?`<tr><td colspan="8"><button class="btn primary" type="button" data-scroll-payment-review>Ver ${review.length} pago${review.length===1?'':'s'} que requieren revisión ↓</button></td></tr>`:'<tr><td colspan="8">No hay pagos pendientes de revisión.</td></tr>';
    return;
  }
  const list=paymentControlFilteredCharges();
  body.innerHTML=list.map(c=>{
    const p=players.find(x=>x.id===c.playerId),due=chargeDueState(c),remaining=chargeRemaining(c);
    const label=c.status==='paid'?'Pagado':due==='overdue'?'Morosa':c.status==='partial'?'Parcial':'Pendiente';
    return`<tr>
      <td><strong>${esc(playerName(c.playerId))}</strong><div class="muted">${esc(c.playerCode||'')}</div></td>
      <td>${esc(p?catNames(p):catName(c.categoryId))}</td>
      <td><span class="badge ${c.status==='paid'?'paid':due==='overdue'?'overdue':'pending'}">${esc(label)}</span></td>
      <td>${money(c.amount)}</td><td>${money(c.paidAmount||0)}</td><td><strong>${money(remaining)}</strong></td>
      <td>${esc(c.dueDate||dueDateForMonth(c.month))}</td>
      <td><button class="action" type="button" data-edit-charge="${c.id}">Ver</button></td>
    </tr>`;
  }).join('')||'<tr><td colspan="8">No hay pagos para los filtros seleccionados.</td></tr>';
}


let paymentRegistryTab='pending';
function setPaymentRegistryTab(tab){paymentRegistryTab=tab;$$('[data-payment-registry-tab]').forEach(b=>b.classList.toggle('active',b.dataset.paymentRegistryTab===tab));const status=$('#paymentsInboxStatus');if(status){status.value=tab==='pending'?'reported':tab==='approved'?'approved':tab==='rejected'?'rejected':''}const control=$('.payment-control-panel'),review=$('.payment-review-panel'),report=$('.payment-report-panel');if(control)control.classList.toggle('hidden',tab!=='history');if(report)report.classList.toggle('hidden',tab!=='history');if(review)review.classList.remove('hidden');renderPaymentsInbox()}
document.addEventListener('click',e=>{const b=e.target.closest('[data-payment-registry-tab]');if(b)setPaymentRegistryTab(b.dataset.paymentRegistryTab)});

function renderSinpeAdmin(){
  renderPaymentControlCenter();
  setPaymentRegistryTab(paymentRegistryTab);
  populatePaymentReportControls();
  if(!generatedPaymentReport.length){
    $('#sinpeSummary').innerHTML='';
    $('#sinpeAdminList').innerHTML='<article class="panel"><p class="muted">Selecciona los criterios y presiona “Generar reporte” para ver los resultados.</p></article>';
    const download=$('#downloadPaymentsReportButton');
    if(download)download.disabled=true;
    return;
  }
  renderGeneratedPaymentReport();
renderOnvoAdmin();}
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


function effectiveUserRole(u){
  if(u?.role==='family'&&u?.accountType==='player')return'player';
  return u?.role||'family';
}
function isSuperAdmin(u=profile){return u?.role==='admin'&&u?.isSuperAdmin===true}
function isProtectedAdmin(u){return effectiveUserRole(u)==='admin'}
function userRoleLabel(uOrRole){
  if(typeof uOrRole!=='string'&&isSuperAdmin(uOrRole))return 'Super Administrador';
  const role=typeof uOrRole==='string'?uOrRole:effectiveUserRole(uOrRole);
  return role==='admin'?'Administrador':role==='treasurer'?'Tesorería':role==='trainer'?'Entrenador':role==='assistant'?'Asistente':role==='marketing'?'Mercadeo':role==='player'?'Jugadora':role==='pendingTrainer'?'Entrenador pendiente':role==='pendingAssistant'?'Asistente pendiente':'Familia';
}
async function logAdminAudit(action,target,before={},after={},reason=''){
  try{await addDoc(collection(db,'adminAudit'),{orgId:ORG_ID,action,targetId:target?.id||'',targetName:target?.fullName||target?.email||target?.name||'',actorId:auth.currentUser?.uid||'',actorName:profile?.fullName||profile?.email||'',before,after,reason,createdAt:serverTimestamp()})}catch(e){console.warn('Audit log failed',e)}
}
function syncRoleManagerFields(){
  const role=$('#roleManagerRole')?.value,coaching=['trainer','assistant'].includes(role),playerRole=role==='player';
  $('#roleManagerCategoriesField')?.classList.toggle('hidden',!coaching);
  $('#roleManagerPermissionsField')?.classList.toggle('hidden',!coaching);
  $('#roleManagerPlayerField')?.classList.toggle('hidden',!playerRole);
  $('#roleManagerPlayerNote')?.classList.toggle('hidden',!playerRole);
}
function openRoleManager(u){
  if(profile?.role!=='admin')return alert('Solo un Administrador puede cambiar roles.');
  if(!u)return;
  if(isProtectedAdmin(u)&&!isSuperAdmin())return alert('Solo un Super Administrador puede modificar a otro Administrador.');
  if(isSuperAdmin(u)&&u.id!==auth.currentUser?.uid)return alert('Las cuentas Super Administrador están protegidas y no pueden ser degradadas o eliminadas desde la interfaz.');
  $('#roleManagerUserId').value=u.id;
  $('#deleteUserFromRoleManager').classList.toggle('hidden',u.id===auth.currentUser?.uid||isSuperAdmin(u)||isProtectedAdmin(u)&&!isSuperAdmin());
  $('#deleteUserFromRoleManager').dataset.userId=u.id;
  $('#roleManagerUserName').textContent=u.fullName||u.email||'Usuario';
  $('#roleManagerUserEmail').textContent=u.email||'';
  const adminOption=$('#roleManagerRole option[value="admin"]');
  if(adminOption)adminOption.disabled=!isSuperAdmin()&&effectiveUserRole(u)!=='admin';
  $('#roleManagerRole').value=effectiveUserRole(u);
  $('#roleManagerStatus').value=u.status==='inactive'?'inactive':'active';
  $('#roleManagerCategories').innerHTML=categories.filter(c=>c.status==='active').map(c=>`<label class="check-item"><input type="checkbox" value="${c.id}" ${(u.assignedCategoryIds||[]).includes(c.id)?'checked':''}><span>${esc(c.name)}</span></label>`).join('');
  const linkedPlayers=players.filter(p=>(p.linkedUserIds||[]).includes(u.id));
  const currentPlayerId=u.playerId||linkedPlayers[0]?.id||'';
  $('#roleManagerPlayerId').innerHTML='<option value="">Selecciona una jugadora</option>'+players.filter(p=>p.status==='active').map(p=>`<option value="${p.id}" ${p.id===currentPlayerId?'selected':''}>${esc(p.name)} · ${esc(primaryCategoryName(p))}${reinforcementCategoryIds(p).length?` · Refuerza: ${esc(reinforcementCategoryNames(p))}`:''}</option>`).join('');
  $('#roleManagerViewContacts').checked=!!u.permissions?.viewContacts;
  $('#roleManagerViewFinancial').checked=!!u.permissions?.viewFinancialStatus;
  syncRoleManagerFields();
  $('#roleManagerDialog').showModal();
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
function markAllAttendancePresent(prefix,{trainer=false}={}){
  const containerId=prefix==='trainerAttendance'?'trainerAttendanceRoster':'attendanceRoster';
  let rows=[...document.querySelectorAll(`#${containerId} .attendance-row`)];
  if(!rows.length){
    const categoryId=$('#'+prefix+'Category')?.value||'';
    if(!categoryId)return alert('Selecciona una categoría primero.');
    loadAttendanceRoster(prefix,{trainer});
    rows=[...document.querySelectorAll(`#${containerId} .attendance-row`)];
  }
  if(!rows.length)return alert('No hay jugadoras cargadas para seleccionar.');
  rows.forEach(row=>{
    const radio=row.querySelector('input[type="radio"][value="present"]');
    if(radio){radio.checked=true;radio.dispatchEvent(new Event('change',{bubbles:true}));}
    row.querySelector('.attendance-absence')?.classList.add('hidden');
  });
  toast(`${rows.length} jugadoras marcadas como presentes.`);
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

let trainerSummaryFilter='all';
function renderTrainers(){
  const pending=allUsers.filter(u=>isPendingCoachingRole(u.role)&&u.status==='pending');
  const active=trainerUsers.filter(u=>u.status==='active');
  const summary=[
    [pending.length,'Solicitudes pendientes','pending'],
    [trainerUsers.length,'Personal deportivo','all'],
    [active.length,'Activos','active'],
    [trainerUsers.filter(u=>u.role==='trainer').length,'Entrenadores','trainer'],
    [trainerUsers.filter(u=>u.role==='assistant').length,'Asistentes','assistant']
  ];
  $('#trainersSummary').innerHTML=summary.map(([v,l,f])=>`<button type="button" class="stat trainer-summary-stat ${trainerSummaryFilter===f?'selected':''}" data-trainer-summary="${f}" aria-pressed="${trainerSummaryFilter===f}"><strong>${v}</strong><span>${l}</span></button>`).join('');
  const showPending=trainerSummaryFilter==='all'||trainerSummaryFilter==='pending';
  const visibleTrainers=trainerUsers.filter(u=>trainerSummaryFilter==='all'||trainerSummaryFilter==='active'&&u.status==='active'||trainerSummaryFilter==='trainer'&&u.role==='trainer'||trainerSummaryFilter==='assistant'&&u.role==='assistant');
  const pendingHTML=showPending&&pending.length?`<div class="trainer-request-section"><div class="page-head compact-head"><div><span class="eyebrow">SOLICITUDES</span><h3>Pendientes de aprobación</h3></div></div>${pending.map(u=>`<article class="panel trainer-request-card"><div><span class="badge pending">Pendiente</span><h3>${esc(u.fullName||u.email)}</h3><p>${esc(u.email||'')} · ${esc(u.phone||'Sin teléfono')}</p><p class="muted">Solicitó registrarse como ${u.role==='pendingAssistant'?'asistente':'entrenador/a'}.</p></div><div class="actions"><button class="btn primary" data-approve-trainer="${u.id}">Revisar y aprobar</button><button class="btn secondary" data-reject-trainer="${u.id}">Rechazar</button></div></article>`).join('')}</div>`:'';
  const trainerHTML=visibleTrainers.map(u=>`<article class="panel"><div class="page-head compact-head"><div><span class="eyebrow">${esc(u.role==='assistant'?'Asistente':trainerLevelLabel(u.trainerLevel))}</span><h3>${esc(u.fullName||u.email)}</h3></div><span class="badge ${u.status||'active'}">${esc(statusLabel(u.status||'active'))}</span></div><p><strong>Categorías:</strong> ${esc(assignedCategoryNames(u))}</p><p class="muted">Contactos: ${u.permissions?.viewContacts?'Sí':'No'} · Estado financiero general: ${u.permissions?.viewFinancialStatus?'Sí':'No'}</p><button class="btn secondary" data-edit-trainer="${u.id}">Editar permisos</button></article>`).join('');
  $('#trainersList').innerHTML=pendingHTML+(trainerHTML||(!pendingHTML?'<p class="muted">No hay registros para este filtro.</p>':''));
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


$('#offboardingSummary').onclick=e=>{
  const card=e.target.closest('[data-offboarding-type]');if(!card)return;
  $('#offboardingEntityFilter').value=card.dataset.offboardingType||'';
  const reason=card.dataset.offboardingReason||'';
  if(reason==='__dissatisfaction__'){
    $('#offboardingReasonFilter').value='';
    $('#offboardingReasonFilter').dataset.special='dissatisfaction';
  }else{
    delete $('#offboardingReasonFilter').dataset.special;
    $('#offboardingReasonFilter').value=reason;
  }
  renderOffboarding();
};
$('#shirtAdminSummary').onclick=e=>{
  const card=e.target.closest('[data-shirt-summary-status]');if(!card)return;
  $('#shirtAdminStatusFilter').value=card.dataset.shirtSummaryStatus||'';
  renderShirtAdmin();
};
$('#offboardingReason').onchange=syncOffboardingConditionalFields;
$('#offboardingSearch').oninput=renderOffboarding;
$('#offboardingEntityFilter').onchange=renderOffboarding;
$('#offboardingReasonFilter').onchange=()=>{delete $('#offboardingReasonFilter').dataset.special;renderOffboarding();};
$('#offboardingList').addEventListener('click',e=>{const card=e.target.closest('[data-offboarding-detail]');if(!card)return;e.preventDefault();e.stopPropagation();openOffboardingDetail(card.dataset.offboardingDetail);});
$('#offboardingList').addEventListener('keydown',e=>{const card=e.target.closest('[data-offboarding-detail]');if(!card||!['Enter',' '].includes(e.key))return;e.preventDefault();openOffboardingDetail(card.dataset.offboardingDetail);});
$('#roleManagerRole').onchange=syncRoleManagerFields;
$('#roleManagerForm').onsubmit=async e=>{
  e.preventDefault();
  if(profile?.role!=='admin')return alert('Solo un Administrador puede cambiar roles.');
  const uid=$('#roleManagerUserId').value,u=allUsers.find(x=>x.id===uid);if(!u)return alert('Usuario no encontrado.');
  const newRole=$('#roleManagerRole').value,status=$('#roleManagerStatus').value;
  const oldRole=effectiveUserRole(u),oldStatus=u.status||'active';
  if(isSuperAdmin(u)&&(newRole!=='admin'||status!=='active'))return alert('Una cuenta Super Administrador no puede degradarse o desactivarse desde esta pantalla.');
  if(oldRole==='admin'&&!isSuperAdmin())return alert('Solo un Super Administrador puede modificar a otro Administrador.');
  if(newRole==='admin'&&oldRole!=='admin'&&!isSuperAdmin())return alert('Solo un Super Administrador puede asignar el rol Administrador.');
  if(uid===auth.currentUser.uid&&newRole!=='admin')return alert('No puedes quitar tu propio rol de Administrador desde esta pantalla.');

  const coaching=['trainer','assistant'].includes(newRole),playerRole=newRole==='player';
  let assignedCategoryIds=coaching?$$('#roleManagerCategories input:checked').map(i=>i.value):[];
  if(coaching&&!assignedCategoryIds.length)return alert('Selecciona al menos una categoría para este perfil deportivo.');

  const selectedPlayerId=playerRole?$('#roleManagerPlayerId').value:'';
  const selectedPlayer=selectedPlayerId?players.find(p=>p.id===selectedPlayerId):null;
  if(playerRole&&!selectedPlayer)return alert('Para el rol Jugadora debes seleccionar la ficha de jugadora correspondiente.');
  if(playerRole)assignedCategoryIds=playerCatIds(selectedPlayer);

  if(status==='inactive'&&oldStatus!=='inactive'){const entityType=['trainer','assistant'].includes(oldRole)?'trainer':'user';const proceed=await createOffboardingRecordIfNeeded({entityType,entityId:uid,entityName:u.fullName||u.email||'Usuario',oldStatus,newStatus:status});if(!proceed)return;}
  if(!confirm(`¿Guardar los cambios de ${u.fullName||u.email}?`))return;

  const accountType=newRole==='player'?'player':newRole==='family'?'guardian':newRole==='trainer'?'trainer':newRole==='assistant'?'assistant':'admin';
  const data={role:newRole,accountType,status,assignedCategoryIds,playerId:playerRole?selectedPlayerId:'',updatedAt:serverTimestamp()};
  if(coaching)data.permissions={viewContacts:$('#roleManagerViewContacts').checked,viewFinancialStatus:$('#roleManagerViewFinancial').checked};
  else data.permissions={viewContacts:false,viewFinancialStatus:false};
  if(newRole==='assistant')data.trainerLevel='assistant';
  if(newRole==='trainer')data.trainerLevel=u.trainerLevel&&u.trainerLevel!=='assistant'?u.trainerLevel:'head';

  const batch=writeBatch(db);
  batch.update(doc(db,'users',uid),data);

  if(playerRole){
    // A player account belongs to one player profile. Remove only player-account links
    // previously owned by this UID, then attach the selected profile.
    players.forEach(p=>{
      const linked=p.linkedUserIds||[];
      if(linked.includes(uid)&&p.id!==selectedPlayerId){
        batch.update(doc(db,'players',p.id),{linkedUserIds:linked.filter(x=>x!==uid),updatedAt:serverTimestamp()});
      }
    });
    const selectedLinks=[...new Set([...(selectedPlayer.linkedUserIds||[]),uid])];
    batch.update(doc(db,'players',selectedPlayerId),{linkedUserIds:selectedLinks,updatedAt:serverTimestamp()});
  }

  await batch.commit();
  await logAdminAudit('role_change',u,{role:oldRole,status:oldStatus},{role:newRole,status},'Cambio desde Administración de usuarios');
  $('#roleManagerDialog').close();
  await loadAdminData();
  go('userAdmin');
  renderUserAdmin();
  toast(playerRole?'Rol y ficha de jugadora vinculados correctamente.':'Rol actualizado correctamente.');
};
$('#trainerForm').onsubmit=async e=>{
  e.preventDefault();
  const uid=e.currentTarget.dataset.editId||$('#trainerUserId').value;
  const assignedCategoryIds=$$('#trainerCategoriesEditor input:checked').map(x=>x.value);
  if(!uid)return alert('Selecciona un usuario.');
  if(!assignedCategoryIds.length)return alert('Selecciona al menos una categoría.');
  const selectedRole=$('#trainerRole').value,current=allUsers.find(x=>x.id===uid),newStatus=$('#trainerStatus').value,oldStatus=current?.status||'active';
  if(newStatus==='inactive'&&oldStatus!=='inactive'){const proceed=await createOffboardingRecordIfNeeded({entityType:'trainer',entityId:uid,entityName:current?.fullName||current?.email||'Personal deportivo',oldStatus,newStatus});if(!proceed)return;}
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
  trainerPlayers=await loadPlayerPrivateForPlayers(trainerPlayers);
  trainerTrainingSeries=merge(trainingSets);
  trainerEvents=merge(eventSets).filter(e=>e.type!=='training').sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  trainerAnnouncements=merge(announcementSets).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
  trainerCharges=merge(chargeSets);attendanceRecords=merge(attendanceSets);
  populateTrainerSelectors();
  renderTrainerHome();
  await loadNotifications();
  await loadPilotContext();
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
  const visible=trainerEvents.filter(e=>assigned.has(String(e.categoryId))&&e.date>=today()).sort((a,b)=>`${a.date||''} ${a.startTime||''}`.localeCompare(`${b.date||''} ${b.startTime||''}`));
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
$('#markAllPresentButton').onclick=()=>markAllAttendancePresent('attendance',{trainer:false});
$('#saveAttendanceButton').onclick=()=>saveAttendance('attendance',{trainer:false}).catch(e=>alert(err(e)));
$('#attendanceCategory').onchange=()=>{loadAttendanceRoster('attendance',{trainer:false});renderAttendanceSummary('attendance',{trainer:false})};
$('#attendanceSummaryMonth').onchange=()=>renderAttendanceSummary('attendance',{trainer:false});
$('#exportAttendanceButton').onclick=exportAttendanceCSV;
$('#trainerLoadAttendanceButton').onclick=()=>loadAttendanceRoster('trainerAttendance',{trainer:true});
$('#trainerMarkAllPresentButton').onclick=()=>markAllAttendancePresent('trainerAttendance',{trainer:true});
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
  $('#familiesList').innerHTML=filteredFamilies.map(f=>{const pids=f.playerIds||[],uids=f.memberUserIds||[],location=f.address||'Dirección pendiente',balance=familyBalance(f);return`<article class="panel family-card clickable-card" data-view-family="${f.id}"><div class="page-head compact-head"><div><span class="eyebrow">${esc(f.familyCode||f.id)}</span><h3>${esc(f.name||'Grupo familiar')}</h3></div><span class="badge ${f.status||'active'}">${statusLabel(f.status||'active')}</span></div><div class="family-metrics"><div><strong>${uids.length}</strong><span>responsables/usuarios</span></div><div><strong>${pids.length}</strong><span>jugadoras</span></div><div><strong>${money(balance)}</strong><span>saldo pendiente</span></div></div><div class="family-people"><h4>Jugadoras</h4>${pids.map(id=>`<button class="person-row" data-view-player="${id}"><span class="person-icon">🏐</span><span><strong>${esc(playerName(id))}</strong><small>${esc(catNames(players.find(p=>p.id===id)||{}))}</small></span><span aria-hidden="true">›</span></button>`).join('')||'<p class="muted">Sin jugadoras asociadas.</p>'}<h4>Usuarios</h4>${uids.map(id=>`<button class="person-row" data-view-user="${id}"><span class="person-icon">👤</span><span><strong>${esc(userName(id))}</strong><small>${esc(familyUsers.find(u=>u.id===id)?.accountType==='player'?'Jugadora':'Padre, madre o encargado')}</small></span><span aria-hidden="true">›</span></button>`).join('')||'<p class="muted">Sin usuarios asociados.</p>'}</div><p class="family-location">📍 ${esc(location)}</p><div class="actions"><button class="btn primary" data-view-family="${f.id}">Ver familia</button><button class="btn secondary" data-manage-family-members="${f.id}">Gestionar miembros</button><button class="btn secondary" data-edit-family="${f.id}">Editar datos</button></div></article>`}).join('')||'<p class="muted">No hay familias para la categoría seleccionada.</p>';
  $('#linkRequestsAdmin').innerHTML=linkRequests.filter(r=>r.status==='pending').map(r=>`<article class="panel"><strong>${esc(r.playerName)}</strong><p>${esc(userName(r.userId))} · ${esc(r.playerCode||'Sin Player ID')} · ${esc(catName(r.categoryId))}</p><p class="muted">${esc(r.relationship||'')} ${esc(r.notes||'')}</p><button class="btn primary" data-approve-link="${r.id}">Aprobar</button> <button class="btn secondary" data-reject-link="${r.id}">Rechazar</button></article>`).join('')||'<p class="muted">No hay solicitudes pendientes.</p>';
}



function linkRequestUserName(r){
  const u=allUsers.find(x=>x.id===r.userId);
  return u?.fullName||u?.email||'Usuario';
}
function linkRequestDate(r){
  const seconds=r.createdAt?.seconds;
  return seconds?new Date(seconds*1000).toLocaleString('es-CR',{dateStyle:'medium',timeStyle:'short'}):'—';
}
function linkRequestProcessedBy(r){
  const uid=r.approvedBy||r.rejectedBy||'';
  if(!uid)return'—';
  const u=allUsers.find(x=>x.id===uid);
  return u?.fullName||u?.email||'Administrador';
}
function updateLinkRequestNavBadge(){
  const badge=$('#linkAdminNavBadge');
  if(!badge)return;
  const count=linkRequests.filter(r=>r.status==='pending').length;
  badge.textContent=String(count);
  badge.classList.toggle('hidden',count===0);
}
function populateLinkAdminCategories(){
  const el=$('#linkAdminCategoryFilter');if(!el)return;
  const current=el.value;
  el.innerHTML='<option value="">Todas las categorías</option>'+categories.filter(c=>c.status==='active').map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');
  if([...el.options].some(o=>o.value===current))el.value=current;
}
function renderLinkAdmin(){
  if(!$('#linkAdminList'))return;
  updateLinkRequestNavBadge();
  populateLinkAdminCategories();
  const q=norm($('#linkAdminSearch')?.value||'');
  const status=$('#linkAdminStatusFilter')?.value??'pending';
  const category=$('#linkAdminCategoryFilter')?.value||'';
  const pending=linkRequests.filter(r=>r.status==='pending');
  const approved=linkRequests.filter(r=>r.status==='approved');
  const rejected=linkRequests.filter(r=>r.status==='rejected');
  $('#linkAdminSummary').innerHTML=[
    [pending.length,'Pendientes','pending'],
    [approved.length,'Aprobadas','approved'],
    [rejected.length,'Rechazadas','rejected'],
    [linkRequests.length,'Total','']
  ].map(([v,l,s])=>`<button type="button" class="stat link-admin-summary ${status===s?'selected':''}" data-link-admin-status="${s}"><strong>${v}</strong><span>${l}</span></button>`).join('');

  const list=[...linkRequests].filter(r=>{
    if(status&&r.status!==status)return false;
    if(category&&r.categoryId!==category)return false;
    if(q&&!norm([r.playerName,r.playerCode,linkRequestUserName(r),r.relationship,catName(r.categoryId)].join(' ')).includes(q))return false;
    return true;
  }).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));

  $('#linkAdminList').innerHTML=list.map(r=>`<article class="panel link-request-card">
    <div class="page-head compact-head">
      <div><span class="eyebrow">${esc(catName(r.categoryId)||'Categoría no indicada')}</span><h3>${esc(r.playerName||'Jugadora')}</h3></div>
      <span class="badge ${r.status||'pending'}">${esc(statusLabel(r.status||'pending'))}</span>
    </div>
    <div class="grid two">
      <p><strong>Solicitante:</strong> ${esc(linkRequestUserName(r))}<br><strong>Relación:</strong> ${esc(r.relationship||'—')}<br><strong>Player ID:</strong> ${esc(r.playerCode||'—')}</p>
      <p><strong>Enviada:</strong> ${esc(linkRequestDate(r))}<br><strong>Procesada por:</strong> ${esc(linkRequestProcessedBy(r))}</p>
    </div>
    ${r.notes?`<p class="muted"><strong>Notas:</strong> ${esc(r.notes)}</p>`:''}
    ${r.status==='pending'?`<div class="actions"><button class="btn primary" data-approve-link="${r.id}" type="button">Aprobar</button><button class="btn secondary" data-reject-link="${r.id}" type="button">Rechazar</button></div>`:''}
  </article>`).join('')||'<p class="muted">No hay solicitudes para los filtros seleccionados.</p>';
}

const OFFBOARDING_REASONS={team_change:'Cambio de equipo',relocation:'Mudanza',study:'Estudios',injury:'Lesión',financial:'Razones económicas',schedule:'Incompatibilidad de horarios',sport_dissatisfaction:'Insatisfacción deportiva',administrative_dissatisfaction:'Insatisfacción administrativa',family_decision:'Decisión familiar',retirement:'Retiro del deporte',employment_end:'Fin de relación / función',other:'Otro'};
const OFFBOARDING_DISSATISFACTION={coach:'Entrenador/a',playing_time:'Tiempo de juego',communication:'Comunicación',treatment:'Trato',organization:'Organización',facilities:'Instalaciones',costs:'Costos / pagos',schedule:'Horarios',team_environment:'Ambiente de equipo',other:'Otro'};
function offboardingTypeLabel(v){return v==='player'?'Jugadora':v==='trainer'?'Personal deportivo':'Usuario'}
function offboardingReasonLabel(v){return OFFBOARDING_REASONS[v]||v||'—'}
function syncOffboardingConditionalFields(){
  const reason=$('#offboardingReason')?.value||'';
  $('#offboardingDestinationTeamField')?.classList.toggle('hidden',reason!=='team_change');
  $('#offboardingDissatisfactionField')?.classList.toggle('hidden',!['sport_dissatisfaction','administrative_dissatisfaction'].includes(reason));
}
function requestOffboardingRecord({entityType,entityId,entityName}){
  return new Promise(resolve=>{
    const dlg=$('#offboardingDialog'),form=$('#offboardingForm');
    form.reset();$('#offboardingEntityType').value=entityType;$('#offboardingEntityId').value=entityId;$('#offboardingEntityName').value=entityName||'';$('#offboardingDialogTitle').textContent=`Registrar baja · ${entityName||offboardingTypeLabel(entityType)}`;$('#offboardingEffectiveDate').value=today();syncOffboardingConditionalFields();
    let settled=false;
    const finish=v=>{if(settled)return;settled=true;dlg.removeEventListener('close',onClose);form.removeEventListener('submit',onSubmit);resolve(v)};
    const onClose=()=>finish(null);
    const onSubmit=e=>{e.preventDefault();const reason=$('#offboardingReason').value;if(!reason)return alert('Selecciona el motivo principal.');if(reason==='team_change'&&!$('#offboardingDestinationTeam').value.trim())return alert('Indica el equipo destino.');const dissatisfaction=$('#offboardingDissatisfaction').value;if(['sport_dissatisfaction','administrative_dissatisfaction'].includes(reason)&&!dissatisfaction)return alert('Selecciona el área de insatisfacción.');const record={orgId:ORG_ID,entityType,entityId,entityName:entityName||'',effectiveDate:$('#offboardingEffectiveDate').value,exitType:$('#offboardingExitType').value,reason,destinationTeam:$('#offboardingDestinationTeam').value.trim(),dissatisfactionArea:dissatisfaction,details:$('#offboardingDetails').value.trim(),notes:$('#offboardingNotes').value.trim(),processedBy:auth.currentUser.uid,processedByName:profile?.fullName||profile?.email||'Administrador',createdAt:serverTimestamp(),updatedAt:serverTimestamp()};dlg.close();finish(record)};
    dlg.addEventListener('close',onClose,{once:true});form.addEventListener('submit',onSubmit);dlg.showModal();
  });
}
async function createOffboardingRecordIfNeeded({entityType,entityId,entityName,oldStatus,newStatus}){
  if(oldStatus==='inactive'||newStatus!=='inactive')return true;
  const record=await requestOffboardingRecord({entityType,entityId,entityName});if(!record)return false;
  await addDoc(collection(db,'exitRecords'),record);return true;
}
function renderOffboarding(){
  if(profile?.role!=='admin')return;
  const reasonSelect=$('#offboardingReasonFilter');if(reasonSelect&&reasonSelect.options.length<=1)reasonSelect.innerHTML='<option value="">Todos los motivos</option>'+Object.entries(OFFBOARDING_REASONS).map(([v,l])=>`<option value="${v}">${esc(l)}</option>`).join('');
  const q=norm($('#offboardingSearch')?.value||''),type=$('#offboardingEntityFilter')?.value||'',reason=$('#offboardingReasonFilter')?.dataset.special==='dissatisfaction'?'__dissatisfaction__':($('#offboardingReasonFilter')?.value||'');
  const list=exitRecords.filter(r=>{
    const reasonMatch=!reason||(reason==='__dissatisfaction__'?['sport_dissatisfaction','administrative_dissatisfaction'].includes(r.reason):r.reason===reason);
    return (!type||r.entityType===type)&&reasonMatch&&(!q||norm([r.entityName,r.destinationTeam,r.details,r.notes,offboardingReasonLabel(r.reason)].join(' ')).includes(q));
  });
  $('#offboardingSummary').innerHTML=[
    [exitRecords.length,'Bajas registradas','',''],
    [exitRecords.filter(r=>r.entityType==='player').length,'Jugadoras','player',''],
    [exitRecords.filter(r=>r.entityType==='trainer').length,'Personal deportivo','trainer',''],
    [exitRecords.filter(r=>['sport_dissatisfaction','administrative_dissatisfaction'].includes(r.reason)).length,'Por insatisfacción','','__dissatisfaction__']
  ].map(([v,l,t,rs])=>`<button type="button" class="stat clickable-stat offboarding-summary-card" data-offboarding-type="${t}" data-offboarding-reason="${rs}"><strong>${v}</strong><span>${l}</span></button>`).join('');
  $('#offboardingList').innerHTML=list.map(r=>`<article class="panel offboarding-card clickable-card" data-offboarding-detail="${r.id}" role="button" tabindex="0"><div class="page-head compact-head"><div><span class="eyebrow">${esc(offboardingTypeLabel(r.entityType))}</span><h3>${esc(r.entityName||'Registro')}</h3></div><span class="badge inactive">${r.exitType==='temporary'?'Temporal':'Definitiva'}</span></div><div class="grid two"><p><strong>Fecha efectiva:</strong> ${esc(r.effectiveDate||'—')}<br><strong>Motivo:</strong> ${esc(offboardingReasonLabel(r.reason))}${r.destinationTeam?`<br><strong>Equipo destino:</strong> ${esc(r.destinationTeam)}`:''}</p><p><strong>Procesado por:</strong> ${esc(r.processedByName||userName(r.processedBy)||'—')}${r.dissatisfactionArea?`<br><strong>Área de insatisfacción:</strong> ${esc(OFFBOARDING_DISSATISFACTION[r.dissatisfactionArea]||r.dissatisfactionArea)}`:''}</p></div><p>${esc(r.details||'')}</p>${r.notes?`<p class="muted">${esc(r.notes)}</p>`:''}</article>`).join('')||'<p class="muted">No hay bajas registradas para los filtros seleccionados.</p>';
}

function openOffboardingDetail(id){
  const r=exitRecords.find(x=>x.id===id);if(!r)return;
  $('#offboardingDetailTitle').textContent=r.entityName||'Detalle de baja';
  $('#offboardingDetailContent').innerHTML=`<div class="detail-stack">
    <p><strong>Tipo:</strong> ${esc(offboardingTypeLabel(r.entityType))}<br><strong>Fecha efectiva:</strong> ${esc(r.effectiveDate||'—')}<br><strong>Baja:</strong> ${r.exitType==='temporary'?'Temporal':'Definitiva'}</p>
    <p><strong>Motivo:</strong> ${esc(offboardingReasonLabel(r.reason))}${r.destinationTeam?`<br><strong>Equipo destino:</strong> ${esc(r.destinationTeam)}`:''}${r.dissatisfactionArea?`<br><strong>Área de insatisfacción:</strong> ${esc(OFFBOARDING_DISSATISFACTION[r.dissatisfactionArea]||r.dissatisfactionArea)}`:''}</p>
    <p><strong>Detalle:</strong><br>${esc(r.details||'—')}</p>
    ${r.notes?`<p><strong>Observaciones:</strong><br>${esc(r.notes)}</p>`:''}
    <p class="muted"><strong>Procesado por:</strong> ${esc(r.processedByName||userName(r.processedBy)||'—')}</p>
  </div>`;
  $('#offboardingDetailDialog').showModal();
}
function openShirtRequestDetail(id){
  const r=shirtRequests.find(x=>x.id===id);if(!r)return;
  $('#shirtRequestDetailTitle').textContent=r.requesterName||r.requesterEmail||'Solicitud';
  $('#shirtRequestDetailContent').innerHTML=`<div class="detail-stack">
    <p><strong>Producto:</strong> ${esc(shirtProductLabel(r.product))}<br><strong>Estado:</strong> ${esc(shirtStatusLabel(r.status))}</p>
    <p><strong>Talla:</strong> ${esc(r.size||'—')}<br><strong>Cantidad:</strong> ${Number(r.quantity||1)}${r.playerName?`<br><strong>Jugadora:</strong> ${esc(r.playerName)}`:''}</p>
    <p><strong>Solicitante:</strong> ${esc(r.requesterName||'—')}<br><strong>Correo:</strong> ${esc(r.requesterEmail||'—')}</p>
    <p><strong>Observaciones:</strong><br>${esc(r.notes||'Sin observaciones')}</p>
    <p class="muted">Solicitud: ${r.createdAt?.seconds?new Date(r.createdAt.seconds*1000).toLocaleString('es-CR'):'—'}</p>
  </div>`;
  $('#shirtRequestDetailDialog').showModal();
}
function renderUserAdmin(){
  if(profile?.role!=='admin'){$('#userAdminBody').innerHTML='<tr><td colspan="7">Solo los Administradores pueden gestionar roles.</td></tr>';return;}
  const q=norm($('#userAdminSearch')?.value||''),role=$('#userAdminRoleFilter')?.value||'',status=$('#userAdminStatusFilter')?.value||'';
  const list=allUsers.filter(u=>(!q||norm(`${u.fullName||''} ${u.email||''} ${u.phone||''}`).includes(q))&&(!role||effectiveUserRole(u)===role)&&(!status||(u.status||'active')===status));
  $('#userAdminSummary').innerHTML=[
    [allUsers.length,'Usuarios','',''],
    [allUsers.filter(u=>effectiveUserRole(u)==='player').length,'Jugadoras','player',''],
    [allUsers.filter(u=>['trainer','assistant'].includes(effectiveUserRole(u))).length,'Personal deportivo','trainer',''],
    [allUsers.filter(u=>(u.status||'active')==='active').length,'Activos','','active']
  ].map(([v,l,r,s])=>`<button type="button" class="stat clickable-stat" data-user-admin-role="${r}" data-user-admin-status="${s}"><strong>${v}</strong><span>${l}</span></button>`).join('');
  $('#userAdminBody').innerHTML=list.map(u=>{
    const identity=playerIdentityStatusForUser(u),linked=players.filter(p=>(p.linkedUserIds||[]).includes(u.id));
    const playerCell=identity?(identity.ok?`<span class="player-link-ok">✓ ${esc(identity.label)}</span>`:'<span class="player-link-warning">⚠ Sin ficha de jugadora vinculada</span>'):(linked.map(p=>`<button class="chip chip-button" data-view-player="${p.id}">${esc(p.name)}</button>`).join('')||'—');
    const protectedAdmin=isProtectedAdmin(u)&&!isSuperAdmin();
    return `<tr class="${protectedAdmin?'':'clickable-row'}" ${protectedAdmin?'':`data-manage-role="${u.id}" role="button" tabindex="0"`}><td><strong>${esc(u.fullName||'—')}</strong><div class="muted">${esc(u.accountType||'')}</div></td><td>${esc(u.email||'')}</td><td>${esc(u.phone||'')}</td><td><span class="badge neutral">${esc(userRoleLabel(u))}</span>${isSuperAdmin(u)?'<div class="muted">Cuenta protegida</div>':''}</td><td>${playerCell}</td><td><span class="badge ${u.status||'active'}">${esc(statusLabel(u.status||'active'))}</span></td><td>${protectedAdmin?'<span class="muted">Solo Super Admin</span>':`<button class="btn secondary" data-manage-role="${u.id}" type="button">Gestionar rol</button>`}</td></tr>`;
  }).join('')||'<tr><td colspan="7">No hay usuarios para los filtros seleccionados.</td></tr>';
}

function familySportsEventGroups(list){
  const groups=new Map();
  [...list].filter(e=>e.status!=='cancelled').sort((a,b)=>`${a.date||''} ${a.startTime||''}`.localeCompare(`${b.date||''} ${b.startTime||''}`)).forEach(e=>{
    const key=trainingCalendarEventGroupKey(e);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(e);
  });
  return [...groups.values()].sort((a,b)=>`${a[0]?.date||''} ${a[0]?.startTime||''}`.localeCompare(`${b[0]?.date||''} ${b[0]?.startTime||''}`));
}
function familySportsGroupHTML(group,{compact=false}={}){
  const first=group[0],visual=sportsEventVisualType(group),location=eventLocationName(first),title=visual==='festival'?`FESTIVAL · ${sportsCategoryNames(first)}`:`${typeLabel(first.type)} · ${sportsCategoryNames(first)}`;
  if(visual==='festival')return `<article class="panel family-festival-card"><span class="eyebrow">${esc(title)}</span><h3>${esc(first.date||'')}</h3>${location?`<p><strong>Sede:</strong> ${esc(location)}</p>`:''}<div class="category-festival-games">${group.map(e=>`<div><strong>${esc(e.startTime||'Hora por definir')}</strong>${e.opponent?` · vs ${esc(e.opponent)}`:` · ${esc(e.title||'Partido')}`}</div>`).join('')}</div>${compact?'':`<button class="btn secondary" data-family-calendar-event="${first.id}" type="button">📅 Agregar al calendario</button>`}</article>`;
  return group.map(e=>`<article class="panel"><span class="eyebrow">${esc(typeLabel(e.type))} · ${esc(sportsCategoryNames(e))}</span><h3>${esc(e.title)}</h3><p><strong>${esc(e.date)}</strong> · ${esc(e.startTime||'')} ${e.endTime?'– '+esc(e.endTime):''}</p><p>${esc(eventLocationName(e))}${e.homeAway==='away'&&e.awayAddress?`<br>${esc(e.awayAddress)}`:''}</p>${compact?'':`${e.locationUrl?`<p><a href="${esc(e.locationUrl)}" target="_blank" rel="noopener">Abrir ubicación</a></p>`:venueLinks(e.venueId)}<p class="muted">${esc(e.notes||'')}</p><button class="btn secondary" data-family-calendar-event="${e.id}" type="button">📅 Agregar al calendario</button>`}</article>`).join('');
}
function renderFamilyReportedPayments(){
  const el=$('#familyReportedPayments');if(!el)return;
  const reports=[...sinpeReports].sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
  el.innerHTML=reports.map(r=>{const label=r.status==='reported'?'Pendiente de revisión':r.status==='approved'?'Aprobado':'Rechazado',cls=r.status==='reported'?'reported':r.status;return `<article class="panel family-payment-report-card"><div class="page-head compact-head"><div><span class="eyebrow">REPORTE DE PAGO</span><h3>${money(r.amount)} · ${esc(paymentMethodLabel(paymentMethodValue(r)))}</h3></div><span class="badge ${cls}">${esc(label)}</span></div><p>${esc(r.date||'')} ${r.time?`· ${esc(r.time)}`:''} · ${esc(r.bank||'—')}</p>${r.allocations?.length?`<p class="muted"><strong>Mensualidades:</strong> ${esc(sinpeAllocationSummary(r))}</p>`:''}${r.reference?`<p class="muted">Comprobante # ${esc(r.reference)}</p>`:''}${paymentReceiptHTML(r)}${r.status==='rejected'&&r.rejectionReason?`<p class="notice info"><strong>Motivo:</strong> ${esc(r.rejectionReason)}</p>`:''}</article>`}).join('')||'<p class="muted">Todavía no has enviado reportes de pago.</p>';
}

function renderFamilyHome(){
  if(state.familyDataLoading){setFamilyLoading(true);return}
  const bal=familyCharges.filter(c=>['pending','partial'].includes(c.status)).reduce((s,c)=>s+Number(c.amount||0)-Number(c.paidAmount||0),0),isPlayer=isPlayerProfile();
  $('#familyWelcome').textContent=`Bienvenido, ${profile?.fullName||''}`;
  $('#familyPlayers').innerHTML=familyPlayers.map(p=>`<article class="panel athlete-card clickable-card" data-view-player="${p.id}"><span class="eyebrow">${esc(p.playerCode)}</span><h3>${esc(p.name)}</h3><p><strong>${esc(catNames(p))}</strong></p><button class="btn secondary" data-view-player="${p.id}">Ver perfil</button></article>`).join('')||(isPlayer?'<article class="panel profile-warning-card"><h3>Perfil de jugadora incompleto</h3><p>Tu cuenta tiene rol Jugadora, pero no tiene una ficha deportiva válida vinculada. Un Administrador debe seleccionar tu ficha en Administración de usuarios.</p></article>':'<article class="panel"><h3>Sin jugadoras vinculadas</h3><p>Tu información ya terminó de cargar. Puedes enviar una solicitud desde “Vincular jugadora”.</p></article>');
  const upcomingGroups=familySportsEventGroups(familyEvents.filter(e=>e.date>=today())).slice(0,5);$('#familyUpcoming').innerHTML=upcomingGroups.map(g=>familySportsGroupHTML(g,{compact:true})).join('')||'<p class="muted">No hay eventos próximos.</p>';
  $('#familyBalancePanel').classList.toggle('hidden',isPlayer);if(!isPlayer)$('#familyBalance').innerHTML=`<div class="big-number">${money(bal)}</div><p class="muted">Saldo total pendiente de las jugadoras vinculadas.</p>`;
}
function renderFamilyLink(){if(state.familyDataLoading){$('#familyLinkRequests').innerHTML='<p class="muted">Cargando solicitudes…</p>';return}$('#familyLinkRequests').innerHTML=familyLinkRequests.map(r=>`<div class="recent-item"><div><strong>${esc(r.playerName)}</strong><div class="muted">${esc(r.playerCode||'')} · ${esc(catName(r.categoryId))}</div></div><span class="badge ${r.status}">${statusLabel(r.status)}</span></div>`).join('')||'<p class="muted">No has enviado solicitudes.</p>'}
function renderFamilyEvents(){const groups=familySportsEventGroups(familyEvents.filter(e=>e.date>=today()));$('#familyEventsList').innerHTML=groups.map(g=>familySportsGroupHTML(g)).join('')||'<p class="muted">No hay eventos para tus categorías.</p>'}
let familyPaymentView='pending';

function familyChargeIsActionable(c){
  if(['paid','exempt'].includes(c.status))return false;
  const remaining=chargeRemaining(c);
  return remaining>0 || c.status==='partial' || activeReportForCharge(c.id)?.status==='reported';
}
function populateFamilyPaymentHistoryPlayers(){
  const el=$('#familyPaymentHistoryPlayer');if(!el)return;
  const current=el.value;
  const ids=[...new Set(familyCharges.map(c=>c.playerId).filter(Boolean))];
  el.innerHTML='<option value="">Todas las jugadoras</option>'+ids.map(id=>`<option value="${id}">${esc(playerName(id))}</option>`).join('');
  if([...el.options].some(o=>o.value===current))el.value=current;
}
function syncFamilyPaymentTabs(){
  const pending=familyChargeIsActionable;
  const count=familyCharges.filter(pending).length;
  if($('#familyPaymentsPendingCount'))$('#familyPaymentsPendingCount').textContent=String(count);
  $$('.family-payment-tab').forEach(btn=>{
    const selected=btn.dataset.familyPaymentView===familyPaymentView;
    btn.classList.toggle('active',selected);
    btn.setAttribute('aria-selected',selected?'true':'false');
  });
  $('#familyPaymentHistoryFilters')?.classList.toggle('hidden',familyPaymentView!=='history');
}
function renderFamilyCharges(){
  renderFamilyReportedPayments();
  populateFamilyPaymentHistoryPlayers();
  syncFamilyPaymentTabs();

  const all=[...familyCharges].sort((a,b)=>(b.month||'').localeCompare(a.month||'')||(playerName(a.playerId)).localeCompare(playerName(b.playerId)));
  let list=all;

  if(familyPaymentView==='pending'){
    list=all.filter(familyChargeIsActionable);
  }else{
    const status=$('#familyPaymentHistoryStatus')?.value||'';
    const playerId=$('#familyPaymentHistoryPlayer')?.value||'';
    const month=$('#familyPaymentHistoryMonth')?.value||'';
    list=all.filter(c=>(!status||c.status===status)&&(!playerId||c.playerId===playerId)&&(!month||c.month===month));
  }

  $('#familyChargesList').innerHTML=list.map(c=>{
    const remaining=chargeRemaining(c),due=c.dueDate||dueDateForMonth(c.month),dueState=chargeDueState(c),active=activeReportForCharge(c.id),approved=approvedReportForCharge(c.id);
    const reviewing=active?.status==='reported';
    const visibleStatus=c.status==='paid'?'Pagado':c.status==='exempt'?'Exonerado':reviewing?'Pago reportado · En revisión':c.status==='partial'?(dueState==='overdue'?'Parcial · Morosa':'Parcial'):(dueState==='overdue'?'Pendiente · Morosa':'Pendiente');
    const statusClass=c.status==='paid'?'paid':c.status==='exempt'?'exempt':reviewing?'reported':dueState==='overdue'?'overdue':c.status;
    const paymentInfo=approved?`<p class="payment-meta">Pago confirmado: ${esc(approved.date||'')} · ${esc(paymentMethodLabel(paymentMethodValue(approved)))} · ${esc(approved.bank||'—')} · Comprobante ${esc(approved.reference||'—')}</p>`:reviewing?'<p class="payment-meta pending-review">Pago reportado y pendiente de revisión.</p>':'';
    const onvoInfo=c.onvoPaymentStatus?`<p class="payment-meta onvo-meta">ONVO: ${esc(onvoStatusLabel(c.onvoPaymentStatus))}</p>`:'';
    const payButton=remaining>0&&!['paid','exempt'].includes(c.status)&&!reviewing?`<button class="btn primary onvo-pay-button" data-pay-onvo="${c.id}" type="button">Pagar con ONVO · Prueba</button>`:'';
    return`<article class="panel family-charge-card"><div class="page-head compact-head"><div><span class="eyebrow">${esc(monthLabel(c.month))}</span><h3>${esc(playerName(c.playerId))}</h3></div><span class="badge ${statusClass}">${esc(visibleStatus)}</span></div><div class="charge-values"><span>Total <strong>${money(c.amount)}</strong></span><span>Pagado <strong>${money(c.paidAmount)}</strong></span><span>Saldo <strong>${money(remaining)}</strong></span></div><p class="muted">${dueState==='overdue'&&!['paid','exempt'].includes(c.status)?`Venció el ${esc(due)}.`:`Fecha límite: ${esc(due)}.`}</p>${paymentInfo}${onvoInfo}<div class="actions">${payButton}</div></article>`;
  }).join('')||(familyPaymentView==='pending'
    ?'<article class="panel vc-empty-state"><div><strong>No tienes mensualidades pendientes</strong><p class="muted">Cuando una mensualidad requiera atención aparecerá aquí.</p></div></article>'
    :'<p class="muted">No hay movimientos para los filtros seleccionados.</p>');
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
  $('#playerForm').reset();$('#playerPhotoFile').value='';previewPhoto($('#playerPhotoPreview'),p?.photoUrl,p?.photoVersion,'Sin foto');$('#playerDocId').value=p?.id||'';$('#playerCode').value=p?.playerCode||nextCode();$('#playerName').value=p?.name||'';$('#playerBirthdate').value=p?.birthdate||'';$('#playerNationalTeam').checked=!!p?.nationalTeam;$('#playerIdentification').value=p?.identificationNumber||'';
  $('#playerCategory').value=p?.categoryId||p?.categoryIds?.[0]||categories[0]?.id||'';renderPlayerReinforcementEditor(reinforcementCategoryIds(p));
  $('#playerNumber').value=p?.number||'';$('#playerPosition').value=p?.position||'';$('#playerPermanentReinforcement').checked=!!p?.permanentReinforcement;
  $('#playerPhone').value=p?.phone||'';$('#playerEmail').value=p?.email||'';$('#playerProvince').value=p?.province||'';$('#playerCantonDistrict').value=p?.cantonDistrict||'';$('#playerAddress').value=p?.address||'';
  $('#playerEmergencyName').value=p?.emergencyContact?.name||'';$('#playerEmergencyPhone').value=p?.emergencyContact?.phone||'';
  $('#playerInsured').checked=!!p?.insured;$('#playerInsurer').value=p?.insurance?.provider||'';$('#playerPolicyNumber').value=p?.insurance?.policyNumber||'';$('#playerInsuranceExpiry').value=p?.insurance?.expiryDate||'';$('#playerInsuranceNotes').value=p?.insurance?.notes||'';
  $('#playerFee').value=(p?.customFee===undefined||p?.customFee===null)?'':p.customFee;$('#playerStatus').value=p?.status||'active';$('#playerNotes').value=p?.notes||'';
  const linkedIds=p?.linkedUserIds||[],displayGuardians=guardiansFromLinkedUsers(linkedIds,p?.guardians||[]);
  $('#guardiansEditor').innerHTML=(displayGuardians.length?displayGuardians:[{}]).map(guardianRow).join('');
  $('#linkedUsersEditor').innerHTML=linkedUsersHTML(linkedIds);
  $('#playerDialogTitle').textContent=p?'Editar jugadora':'Nueva jugadora';
  $('#deletePlayerFromEdit').classList.toggle('hidden',!p||profile?.role!=='admin');
  $('#deletePlayerFromEdit').dataset.playerId=p?.id||'';
  syncPlayerFinancialUI();syncInsuranceFields();$('#playerDialog').showModal();
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

  const games=events.filter(e=>sportsHasCategory(e,categoryId)).sort((a,b)=>(a.date||'').localeCompare(b.date||''));
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
  $('#categoryCoach').value=c?.coach||'';$('#categoryJerseyStart').value=c?.jerseyNumberStart??1;$('#categoryJerseyEnd').value=c?.jerseyNumberEnd??99;
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

function deviceCalendarInfo(){
  const ua=navigator.userAgent||'',platform=navigator.platform||'';
  const iOS=/iPad|iPhone|iPod/.test(ua)||(platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const android=/Android/i.test(ua);
  const mobile=iOS||android||/Mobi/i.test(ua);
  return{iOS,android,mobile};
}
function calendarEventDatesForGoogle(e){
  const date=(e.date||'').replace(/-/g,'');
  if(!e.startTime){
    const end=icsEndDate(e.date);
    return `${date}/${end}`;
  }
  const start=`${date}T${String(e.startTime).replace(':','')}00`;
  const endTime=e.endTime||(()=>{
    const [h,m]=String(e.startTime).split(':').map(Number);
    const total=h*60+m+120;
    return `${String(Math.floor((total%1440)/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;
  })();
  const end=`${date}T${String(endTime).replace(':','')}00`;
  return `${start}/${end}`;
}
function googleCalendarUrl(e){
  const params=new URLSearchParams({
    action:'TEMPLATE',
    text:`${catName(e.categoryId)} · ${e.title||typeLabel(e.type)}`,
    dates:calendarEventDatesForGoogle(e),
    details:eventCalendarDescription(e),
    location:[eventLocationName(e),e.awayAddress||''].filter(Boolean).join(' · '),
    ctz:'America/Costa_Rica'
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
function eventICSBlob(e){
  const body=`BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//VolleyCore ASBAVOL//ES
CALSCALE:GREGORIAN
METHOD:PUBLISH
${eventToICS(e)}
END:VCALENDAR`;
  return new Blob([body],{type:'text/calendar;charset=utf-8'});
}
function openNativeCalendarICS(e){
  const blob=eventICSBlob(e),url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.target='_self';
  a.rel='noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),15000);
}
function openGoogleCalendarEvent(e){
  const url=googleCalendarUrl(e);
  const win=window.open(url,'_blank','noopener');
  if(!win)window.location.href=url;
}
let pendingCalendarEventId='';
function openCalendarChoice(e){
  pendingCalendarEventId=e.id;
  const info=deviceCalendarInfo();
  $('#calendarChoiceText').textContent=info.android
    ?'En Android recomendamos Google Calendar. También puedes intentar abrir el calendario del dispositivo.'
    :info.iOS
      ?'En iPhone/iPad recomendamos Calendario del dispositivo. Google Calendar también está disponible.'
      :'Selecciona cómo deseas agregar este evento.';
  $('#calendarGoogleButton').classList.toggle('primary',!info.iOS);
  $('#calendarGoogleButton').classList.toggle('secondary',info.iOS);
  $('#calendarDeviceButton').classList.toggle('primary',info.iOS);
  $('#calendarDeviceButton').classList.toggle('secondary',!info.iOS);
  $('#calendarChoiceDialog').showModal();
}
function addEventToCalendarUniversal(eventId){
  const e=events.find(x=>x.id===eventId)||trainerEvents.find(x=>x.id===eventId);
  if(!e)return alert('No se encontró el evento.');
  const info=deviceCalendarInfo();
  if(info.android){
    openGoogleCalendarEvent(e);
    return;
  }
  if(info.iOS){
    openNativeCalendarICS(e);
    return;
  }
  openCalendarChoice(e);
}

let categoryCalendarPreviewRows=[];
function openCategoryCalendarImport(categoryId){
  const c=categories.find(x=>x.id===categoryId);if(!c)return;
  $('#calendarImportCategoryId').value=categoryId;$('#calendarImportTitle').textContent=`Importar calendario · ${c.name}`;
  $('#categoryCalendarImportFile').value='';$('#categoryCalendarImportPreview').innerHTML='';$('#categoryCalendarImportSummary').innerHTML='';$('#confirmCategoryCalendarButton').disabled=true;categoryCalendarPreviewRows=[];
  $('#categoryDetailDialog')?.close();$('#categoryCalendarImportDialog').showModal();
}
function downloadCategoryCalendarTemplate(){
  if(typeof XLSX==='undefined')return alert('No fue posible cargar el lector de Excel.');
  const rows=[{Fecha:'2026-09-05',Inicio:'18:00',Fin:'20:00',Tipo:'Partido',Rival:'Escazú','Casa/Visita':'Casa',Sede:'Santa Bárbara',Direccion:'',Notas:''},{Fecha:'2026-09-12',Inicio:'15:00',Fin:'17:00',Tipo:'Partido',Rival:'Atenas','Casa/Visita':'Visita',Sede:'Gimnasio Municipal de Atenas',Direccion:'',Notas:''},{Fecha:'2026-09-19',Inicio:'08:00',Fin:'16:00',Tipo:'Festival',Rival:'','Casa/Visita':'Visita',Sede:'Alajuela',Direccion:'',Notas:''}];
  const ws=XLSX.utils.json_to_sheet(rows),wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Calendario');XLSX.writeFile(wb,'VolleyCore-plantilla-calendario.xlsx');
}
function normalizeCalendarDate(v){
  if(!v)return'';if(v instanceof Date&&!isNaN(v))return isoDateLocal(v);
  if(typeof v==='number'&&typeof XLSX!=='undefined'){const d=XLSX.SSF.parse_date_code(v);if(d)return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`}
  const s=String(v).trim();if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
  const m=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);return m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:'';
}
function normalizeCalendarTime(v){
  if(v===null||v===undefined||v==='')return'';if(typeof v==='number'){const mins=Math.round(v*24*60)%1440;return `${String(Math.floor(mins/60)).padStart(2,'0')}:${String(mins%60).padStart(2,'0')}`}
  const s=String(v).trim();const m=s.match(/^(\d{1,2}):(\d{2})/);return m?`${m[1].padStart(2,'0')}:${m[2]}`:'';
}
function calendarRowValue(row,names){for(const n of names){const k=Object.keys(row).find(x=>norm(x)===norm(n));if(k!==undefined)return row[k]}return''}

function pdfGroupItemsByY(items,tolerance=2.8){
  const rows=[];
  const sorted=[...items].filter(i=>String(i.str||'').trim()).sort((a,b)=>b.y-a.y||a.x-b.x);
  for(const item of sorted){
    let row=rows.find(r=>Math.abs(r.y-item.y)<=tolerance);
    if(!row){row={y:item.y,items:[]};rows.push(row)}
    row.items.push(item);
  }
  rows.forEach(r=>r.items.sort((a,b)=>a.x-b.x));
  return rows.sort((a,b)=>b.y-a.y);
}
function pdfColumnText(row,minX,maxX){
  return row.items.filter(i=>i.x>=minX&&i.x<maxX).map(i=>String(i.str||'').trim()).filter(Boolean).join(' ').replace(/\s+/g,' ').trim();
}
function pdfVenueBlocks(rows){
  const lines=rows.map(r=>({y:r.y,text:pdfColumnText(r,155,225)})).filter(x=>x.text);
  const blocks=[];
  for(const line of lines){
    const last=blocks[blocks.length-1];
    if(last&&Math.abs(last.lastY-line.y)<=15){
      last.lines.push(line.text);last.lastY=line.y;last.ys.push(line.y);
    }else blocks.push({lines:[line.text],ys:[line.y],lastY:line.y});
  }
  return blocks.map(b=>({text:b.lines.join(' ').replace(/\s+/g,' ').trim(),center:b.ys.reduce((s,y)=>s+y,0)/b.ys.length}));
}
function pdfNearestVenue(y,venueBlocks){
  if(!venueBlocks.length)return'';
  return [...venueBlocks].sort((a,b)=>Math.abs(a.center-y)-Math.abs(b.center-y))[0]?.text||'';
}
function pdfDateToISO(v){
  const s=String(v||'').trim(),m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:'';
}
function pdfTeamEqual(a,b){return norm(a||'').replace(/\s+/g,' ').trim()===norm(b||'').replace(/\s+/g,' ').trim()}
const VOLLEYCORE_HOME_VENUE='Liceo de Santa Barbara';
function isVolleyCoreHomeVenue(name=''){return norm(name).replace(/\s+/g,' ').trim()===norm(VOLLEYCORE_HOME_VENUE).replace(/\s+/g,' ').trim()}
function eventEffectiveHomeAway(e){
  if(e?.sourceVenueName)return isVolleyCoreHomeVenue(e.sourceVenueName)?'home':'away';
  return e?.homeAway||'';
}
async function extractCategoryScheduleFromPdf(file,teamAlias){
  if(!window.pdfjsLib)throw Error('No fue posible cargar el lector de PDF.');
  const bytes=new Uint8Array(await file.arrayBuffer());
  const pdf=await window.pdfjsLib.getDocument({data:bytes}).promise;
  const result=[];
  for(let pageNo=1;pageNo<=pdf.numPages;pageNo++){
    const page=await pdf.getPage(pageNo),content=await page.getTextContent();
    const items=content.items.map(i=>({str:i.str,x:Number(i.transform?.[4]||0),y:Number(i.transform?.[5]||0)}));
    const rows=pdfGroupItemsByY(items),venuesOnPage=pdfVenueBlocks(rows);
    for(const row of rows){
      const rawDate=pdfColumnText(row,80,126),date=pdfDateToISO(rawDate);
      const time=pdfColumnText(row,126,160);
      if(!date||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))continue;
      const home=pdfColumnText(row,280,398),away=pdfColumnText(row,425,565);
      if(!home||!away)continue;
      const isHome=pdfTeamEqual(home,teamAlias),isAway=pdfTeamEqual(away,teamAlias);
      if(!isHome&&!isAway)continue;
      const venue=pdfNearestVenue(row.y,venuesOnPage);
      result.push({
        Fecha:date,Inicio:time,Fin:'',Tipo:'Partido',
        Rival:isHome?away:home,
        'Casa/Visita':isVolleyCoreHomeVenue(venue)?'Casa':'Visita',
        Sede:venue,Direccion:'',
        Notas:`Importado desde PDF · página ${pageNo}`,
        _pdfPage:pageNo,_homeTeam:home,_awayTeam:away
      });
    }
  }
  return result;
}
function normalizeCategoryCalendarRow(row,index,categoryId){
  const date=normalizeCalendarDate(calendarRowValue(row,['Fecha','Date'])),startTime=normalizeCalendarTime(calendarRowValue(row,['Inicio','Hora inicio','Start'])),endTime=normalizeCalendarTime(calendarRowValue(row,['Fin','Hora fin','End']));
  const typeRaw=norm(calendarRowValue(row,['Tipo','Type'])),type=typeRaw.includes('festival')?'festival':'match';
  const homeRaw=norm(calendarRowValue(row,['Casa/Visita','Casa visita','Local/Visita','Home/Away'])),homeAway=homeRaw.includes('visita')||homeRaw==='away'?'away':homeRaw.includes('casa')||homeRaw.includes('local')||homeRaw==='home'?'home':'';
  const venueText=String(calendarRowValue(row,['Sede','Gimnasio','Lugar','Venue'])||'').trim(),venue=venues.find(v=>norm(v.name)===norm(venueText));
  const opponent=String(calendarRowValue(row,['Rival','Opponent'])||'').trim(),address=String(calendarRowValue(row,['Direccion','Dirección','Address'])||'').trim(),notes=String(calendarRowValue(row,['Notas','Notes'])||'').trim();
  const duplicate=events.find(e=>e.categoryId===categoryId&&e.date===date&&e.type===type&&(!startTime||e.startTime===startTime)&&norm(e.opponent||'')===norm(opponent));
  const errors=[];if(!date)errors.push('Fecha inválida');if(!startTime)errors.push('Hora de inicio requerida');if(type==='match'&&!homeAway)errors.push('Define Casa/Visita');
  const warnings=[];if(venueText&&!venue)warnings.push('Sede no registrada; se conservará el nombre del PDF');
  return{index:index+1,date,startTime,endTime,type,opponent,homeAway,venueText,sourceVenueName:venueText,venueId:venue?.id||'',awayVenueName:homeAway==='away'?venueText:'',awayAddress:homeAway==='away'?address:'',notes,duplicateId:duplicate?.id||'',warnings,status:errors.length?'invalid':duplicate?'duplicate':'valid',errors};
}
function renderCategoryCalendarPreview(){
  const valid=categoryCalendarPreviewRows.filter(r=>r.status==='valid').length,dup=categoryCalendarPreviewRows.filter(r=>r.status==='duplicate').length,bad=categoryCalendarPreviewRows.filter(r=>r.status==='invalid').length;
  $('#categoryCalendarImportSummary').innerHTML=[[categoryCalendarPreviewRows.length,'Filas'],[valid,'Válidas'],[dup,'Duplicados'],[bad,'Revisar']].map(([v,l])=>`<article class="stat"><strong>${v}</strong><span>${l}</span></article>`).join('');
  $('#categoryCalendarImportPreview').innerHTML=`<table><thead><tr><th>Fila</th><th>Fecha</th><th>Horario</th><th>Tipo</th><th>Rival</th><th>Casa/Visita</th><th>Sede</th><th>Estado</th></tr></thead><tbody>${categoryCalendarPreviewRows.map(r=>`<tr><td>${r.index}</td><td>${esc(r.date||'—')}</td><td>${esc(r.startTime||'—')}${r.endTime?' – '+esc(r.endTime):''}</td><td>${esc(typeLabel(r.type))}</td><td>${esc(r.opponent||'—')}</td><td>${esc(r.homeAway==='home'?'Casa':r.homeAway==='away'?'Visita':'—')}</td><td>${esc(r.venueText||'—')}</td><td><span class="badge ${r.status==='valid'?'active':r.status==='duplicate'?'pending':'inactive'}">${r.status==='valid'?'Lista':r.status==='duplicate'?'Duplicado · se omitirá':esc(r.errors.join(', '))}</span>${r.warnings?.length?`<div class="muted">${esc(r.warnings.join(' · '))}</div>`:''}</td></tr>`).join('')}</tbody></table>`;
  $('#confirmCategoryCalendarButton').disabled=!valid;
}
async function previewCategoryCalendar(){
  const file=$('#categoryCalendarImportFile').files[0];if(!file)return alert('Selecciona un archivo Excel, CSV o PDF.');
  const categoryId=$('#calendarImportCategoryId').value;
  const isPdf=file.type==='application/pdf'||/\.pdf$/i.test(file.name||'');
  let rows=[];
  if(isPdf){
    const alias=$('#calendarImportTeamAlias').value.trim();
    if(!alias)return alert('Indica el nombre del equipo que VolleyCore debe localizar dentro del PDF.');
    rows=await extractCategoryScheduleFromPdf(file,alias);
    if(!rows.length)return alert(`No se encontraron partidos de "${alias}" en este PDF. Revisa el nombre del equipo o el formato del documento.`);
  }else{
    if(typeof XLSX==='undefined')return alert('No fue posible cargar el lector de Excel.');
    const data=await file.arrayBuffer(),wb=XLSX.read(data,{type:'array',cellDates:true}),sheet=wb.Sheets[wb.SheetNames[0]];
    rows=XLSX.utils.sheet_to_json(sheet,{defval:'',raw:true});
  }
  categoryCalendarPreviewRows=rows.map((r,i)=>normalizeCategoryCalendarRow(r,i,categoryId));
  renderCategoryCalendarPreview();
  if(isPdf)toast(`${rows.length} partidos encontrados en el PDF para ${$('#calendarImportTeamAlias').value.trim()}.`);
}
async function confirmCategoryCalendar(){
  const categoryId=$('#calendarImportCategoryId').value,c=categories.find(x=>x.id===categoryId);if(!c)return;
  const ready=categoryCalendarPreviewRows.filter(r=>r.status==='valid');if(!ready.length)return alert('No hay eventos válidos para importar.');
  if(!confirm(`¿Importar ${ready.length} eventos a ${c.name}? Los duplicados detectados se omitirán.`))return;
  const seasonId=c.seasonId||seasons.find(s=>s.isCurrent)?.id||seasons[0]?.id||'';
  const b=$('#confirmCategoryCalendarButton');busy(b,true,'Importando…');
  try{
    for(const r of ready)await addDoc(collection(db,'events'),{orgId:ORG_ID,categoryId,seasonId,type:r.type,title:r.type==='festival'?'Festival':r.opponent?`Partido vs ${r.opponent}`:'Partido',opponent:r.opponent,date:r.date,startTime:r.startTime,endTime:r.endTime,homeAway:r.homeAway,venueId:r.venueId,sourceVenueName:r.sourceVenueName||r.venueText||'',awayVenueName:r.awayVenueName,awayAddress:r.awayAddress,locationUrl:'',uniform:'',status:'scheduled',notes:r.notes,createdBy:auth.currentUser.uid,createdByName:profile?.fullName||profile?.email||'Administrador',createdByRole:profile?.role||'',importedFrom:/\.pdf$/i.test($('#categoryCalendarImportFile').files[0]?.name||'')?'category_calendar_pdf':'category_calendar',createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
    await logAdminAudit('calendar_import',c,{}, {eventsImported:ready.length},'Importación de calendario por categoría');
    $('#categoryCalendarImportDialog').close();await loadAdminData();toast(`${ready.length} eventos importados a ${c.name}.`);
  }catch(x){alert(err(x))}finally{busy(b,false)}
}

function syntheticTrainingCalendarEvents(categoryId=''){
  const from=today(),to=datePlus(today(),365);
  return trainingSeries.filter(t=>t.status!=='inactive'&&sportsHasCategory(t,categoryId)).flatMap(t=>occurrences(t,from,to).filter(o=>o.status!=='cancelled').map(o=>({
    id:`training_${t.id}_${o.date}`,categoryId:t.categoryId,categoryIds:sportsCategoryIds(t),type:'training',
    title:`Entrenamiento · ${sportsCategoryNames(t)}`,date:o.date,startTime:o.startTime,endTime:o.endTime,
    venueId:o.venueId||t.venueId,homeAway:'',notes:o.notes||t.notes||'',status:'scheduled'
  })));
}
function downloadFullSportsCalendarFile(){
  const list=[...events.filter(e=>e.date>=today()&&e.status!=='cancelled'),...syntheticTrainingCalendarEvents()].sort((a,b)=>`${a.date} ${a.startTime||''}`.localeCompare(`${b.date} ${b.startTime||''}`));
  downloadICS('VolleyCore-Calendario-Deportivo.ics','VolleyCore · Calendario Deportivo',list);
}
function downloadCategoryCalendar(categoryId){
  const c=categories.find(x=>x.id===categoryId);if(!c)return;
  const list=[...events.filter(e=>sportsHasCategory(e,categoryId)&&e.date>=today()&&e.status!=='cancelled'),...syntheticTrainingCalendarEvents(categoryId)]
    .sort((a,b)=>`${a.date} ${a.startTime||''}`.localeCompare(`${b.date} ${b.startTime||''}`));
  downloadICS(`VolleyCore-${(c.name||'categoria').replace(/[^\w-]+/g,'-')}.ics`,`${c.name} · VolleyCore`,list);
}
function downloadSingleEventCalendar(eventId){addEventToCalendarUniversal(eventId)}
function eventLocationName(e){
  if(e?.homeAway==='away')return e.awayVenueName||e.sourceVenueName||e.awayAddress||'Sede visitante por definir';
  return e?.venueId?venueName(e.venueId):(e?.sourceVenueName||'Sede por definir');
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
function sportsEventCreatorLabel(e){
  if(!e)return 'No disponible';
  if(e.createdByName)return e.createdByName;
  const u=allUsers.find(x=>x.id===e.createdBy);
  if(u)return u.fullName||u.email||'Usuario';
  if(e.createdBy===auth.currentUser?.uid)return profile?.fullName||profile?.email||'Usuario';
  const role=e.createdByRole||'';
  return role==='admin'?'Administrador':isCoachingRole(role)?'Entrenador / asistente':'Usuario';
}
function canManageSportsEvent(e){
  if(!e)return false;
  if(['admin','treasurer'].includes(profile?.role))return true;
  return isCoachingRole(profile?.role)&&sportsCategoryIds(e).every(id=>(profile.assignedCategoryIds||[]).includes(id));
}
function openEventDetail(id){
  const e=events.find(x=>x.id===id)||trainerEvents.find(x=>x.id===id);if(!e)return;
  const locationUrl=safeExternalUrl(e.locationUrl||'');
  $('#eventDetailTitle').textContent=e.title||'Detalle del evento';
  $('#eventDetailContent').innerHTML=`
    <div class="category-detail-grid">
      <article class="panel"><span class="eyebrow">${esc(typeLabel(e.type))}</span><h4>${esc(e.title)}</h4><p><strong>Categoría(s):</strong> ${esc(sportsCategoryNames(e))}<br><strong>Temporada:</strong> ${esc(seasonName(e.seasonId))}<br>${e.opponent?`<strong>Rival:</strong> ${esc(e.opponent)}<br>`:''}<strong>Estado:</strong> ${esc(statusLabel(e.status))}</p></article>
      <article class="panel"><span class="eyebrow">FECHA Y LUGAR</span><h4>${esc(e.date||'')}</h4><p><strong>Hora:</strong> ${esc(e.startTime||'—')}${e.endTime?' – '+esc(e.endTime):''}<br><strong>Lugar:</strong> ${esc(eventLocationName(e))}<br>${e.homeAway==='away'&&e.awayAddress?`<strong>Dirección:</strong> ${esc(e.awayAddress)}<br>`:''}<strong>Casa / visita:</strong> ${esc(e.homeAway==='home'?'Casa':e.homeAway==='away'?'Visita':'No aplica')}<br><strong>Uniforme:</strong> ${esc(uniformLabel(e.uniform))}</p>${locationUrl?`<a class="btn vc-cyan-button event-location-link" href="${esc(locationUrl)}" target="_blank" rel="noopener noreferrer">Abrir ubicación / Waze →</a>`:''}</article>
    </div>
    ${e.notes?`<article class="panel"><h4>Observaciones</h4><p>${esc(e.notes)}</p></article>`:''}
    <article class="panel event-audit-panel"><span class="eyebrow">REGISTRO DEL EVENTO</span><p><strong>Creado por:</strong> ${esc(sportsEventCreatorLabel(e))}<br><strong>Rol:</strong> ${esc(userRoleLabel(e.createdByRole||'')||e.createdByRole||'No disponible')}</p></article>`;
  const canManage=canManageSportsEvent(e);
  $('#editEventFromDetail').dataset.eventId=e.id;
  $('#deleteEventFromDetail').dataset.eventId=e.id;
  $('#eventCalendarButton').dataset.eventId=e.id;
  $('#editEventFromDetail').classList.toggle('hidden',!canManage);
  $('#deleteEventFromDetail').classList.toggle('hidden',!canManage);
  $('#eventDetailDialog').showModal();
}
function openEvent(e){
  $('#eventForm').reset();
  const coaching=isCoachingRole(profile?.role),allowedIds=profile?.assignedCategoryIds||[];
  const allowedCategories=coaching?categories.filter(c=>allowedIds.includes(c.id)):categories;
  $('#eventCategory').innerHTML=allowedCategories.filter(c=>c.status==='active').map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');
  const selectedIds=e?sportsCategoryIds(e):[];
  $('#eventCategoriesEditor').innerHTML=allowedCategories.filter(c=>c.status==='active').map(c=>`<label class="check-item"><input type="checkbox" value="${c.id}" ${selectedIds.includes(c.id)?'checked':''}><span>${esc(c.name)}</span></label>`).join('');
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
  $('#deleteEventFromEditor').dataset.eventId=e?.id||'';
  $('#deleteEventFromEditor').classList.toggle('hidden',!e||!canManageSportsEvent(e));
  $('#eventDialog').showModal();
}
async function deleteEventById(id){
  const event=events.find(e=>e.id===id)||trainerEvents.find(e=>e.id===id);
  if(!event)return alert('No se encontró el evento.');
  if(!canManageSportsEvent(event))return alert('No tienes permiso para eliminar este evento.');
  const label=event.type==='match'?'partido':event.type==='festival'?'festival':'evento';
  const ok=confirm(`¿Eliminar definitivamente este ${label}?\n\n${event.title||typeLabel(event.type)}\n${event.date||''}${event.startTime?' · '+event.startTime:''}\n${event.opponent?'Rival: '+event.opponent+'\n':''}\nEsta acción no se puede deshacer.`);
  if(!ok)return;
  try{
    await deleteDoc(doc(db,'events',id));
    const deletedBy=profile?.fullName||profile?.email||'Usuario';
    const notifyCategoryIds=sportsCategoryIds(event);
    for(const cid of notifyCategoryIds){
      await createCategoryNotification({kind:'event_deleted',categoryId:cid,title:`${typeLabel(event.type)} eliminado`,body:`${event.title||typeLabel(event.type)} · ${event.date||''}${event.startTime?' · '+event.startTime:''} · Eliminado por ${deletedBy}`,sourceId:id}).catch(console.warn);
    }
    events=events.filter(e=>e.id!==id);
    trainerEvents=trainerEvents.filter(e=>e.id!==id);
    ['eventDialog','eventDetailDialog','sportsDayDetailDialog'].forEach(dialogId=>{const d=$('#'+dialogId);if(d?.open)d.close()});
    if(isCoachingRole(profile?.role)){await loadTrainerData();renderTrainerEvents();}else{await loadAdminData();renderTrainings();renderEvents();renderDashboard();}
    toast(`${label.charAt(0).toUpperCase()+label.slice(1)} eliminado correctamente.`);
  }catch(x){alert(err(x))}
}


async function deleteVenue(id){
  const v=venues.find(x=>x.id===id);if(!v)return;
  const categoryCount=categories.filter(x=>x.venueId===id).length;
  const trainingCount=trainingSeries.filter(x=>x.venueId===id).length;
  const eventCount=events.filter(x=>x.venueId===id).length;
  if(categoryCount+trainingCount+eventCount){
    return alert(`No se puede eliminar "${v.name}" porque todavía está vinculada.\n\nCategorías: ${categoryCount}\nEntrenamientos: ${trainingCount}\nEventos/partidos: ${eventCount}\n\nReasigna primero esos registros para proteger la integridad de la información.`);
  }
  if(!confirm(`¿Eliminar definitivamente la sede "${v.name}"?\n\nEsta acción no se puede deshacer.`))return;
  try{
    await deleteDoc(doc(db,'venues',id));
    venues=venues.filter(x=>x.id!==id);
    populateSelectors();renderVenues();toast('Sede eliminada correctamente.');
  }catch(x){alert(err(x))}
}
async function deleteSeason(id){
  const s=seasons.find(x=>x.id===id);if(!s)return;
  const categoryCount=categories.filter(x=>x.seasonId===id).length;
  const trainingCount=trainingSeries.filter(x=>x.seasonId===id).length;
  const eventCount=events.filter(x=>x.seasonId===id).length;
  if(categoryCount+trainingCount+eventCount){
    return alert(`No se puede eliminar "${s.name}" porque todavía tiene información asociada.\n\nCategorías: ${categoryCount}\nEntrenamientos: ${trainingCount}\nEventos/partidos: ${eventCount}\n\nReasigna o elimina primero esos registros.`);
  }
  if(!confirm(`¿Eliminar definitivamente la temporada "${s.name}"?${s.isCurrent?'\n\nEsta es la temporada marcada como actual.':''}\n\nEsta acción no se puede deshacer.`))return;
  try{
    await deleteDoc(doc(db,'seasons',id));
    seasons=seasons.filter(x=>x.id!==id);
    populateSelectors();renderSeasons();toast('Temporada eliminada correctamente.');
  }catch(x){alert(err(x))}
}
function openSeason(s){$('#seasonForm').reset();$('#seasonDocId').value=s?.id||'';$('#seasonName').value=s?.name||String(new Date().getFullYear());$('#seasonStart').value=s?.startDate||`${new Date().getFullYear()}-01-01`;$('#seasonEnd').value=s?.endDate||`${new Date().getFullYear()}-12-31`;$('#seasonStatus').value=s?.status||'active';$('#seasonCurrent').checked=!!s?.isCurrent;$('#seasonDialogTitle').textContent=s?'Editar temporada':'Nueva temporada';$('#seasonDialog').showModal()}
function openTraining(t){$('#trainingForm').reset();$('#trainingDocId').value=t?.id||'';const selectedIds=t?sportsCategoryIds(t):[];$('#trainingCategoriesEditor').innerHTML=categories.filter(c=>c.status==='active').map(c=>`<label class="check-item"><input type="checkbox" value="${c.id}" ${selectedIds.includes(c.id)?'checked':''}><span>${esc(c.name)}</span></label>`).join('');$('#trainingCategory').value=t?.categoryId||categories[0]?.id||'';$('#trainingSeason').value=t?.seasonId||seasons.find(s=>s.isCurrent)?.id||seasons[0]?.id||'';$('#trainingStartTime').value=t?.startTime||'';$('#trainingEndTime').value=t?.endTime||'';$('#trainingStartDate').value=t?.startDate||seasons.find(s=>s.isCurrent)?.startDate||today();$('#trainingEndDate').value=t?.endDate||seasons.find(s=>s.isCurrent)?.endDate||`${new Date().getFullYear()}-12-31`;$('#trainingVenue').value=t?.venueId||'';$('#trainingStatus').value=t?.status||'active';$('#trainingNotes').value=t?.notes||'';$$('input[name="trainingDay"]').forEach(i=>i.checked=(t?.days||[]).includes(Number(i.value)));$('#trainingDialogTitle').textContent=t?'Editar entrenamiento recurrente':'Nuevo entrenamiento recurrente';$('#trainingDialog').showModal()}
function openTrainingOccurrenceChoice(seriesId,date){const t=trainingSeries.find(x=>x.id===seriesId);if(!t)return;$('#trainingOccurrenceSeriesId').value=seriesId;$('#trainingOccurrenceDate').value=date;$('#trainingOccurrenceChoiceTitle').textContent=`Entrenamiento · ${sportsCategoryNames(t)} · ${date}`;$('#trainingOccurrenceChoiceDialog').showModal()}
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
  if(admin){go(requestedView(viewGroups.admin,'dashboard'));loadAdminData().then(()=>{startAdminRealtime();startNotificationRealtime();loadShirtRequests().then(startShirtRealtime);if(!state.familiesReconciled&&families.length===0&&players.some(x=>(x.linkedUserIds||[]).length)){state.familiesReconciled=true;reconcileFamilies(false).catch(console.error)}}).catch(e=>alert(err(e)))}
  else if(coachingStaff){go(requestedView(viewGroups.coaching,'trainerHome'));loadTrainerData().then(()=>{startNotificationRealtime();loadShirtRequests().then(startShirtRealtime);}).catch(e=>alert(err(e)));}
  else if(pendingStaff){const label=p.role==='pendingAssistant'?'asistente':'entrenador';$('#trainerPendingStatus').textContent=p.status==='rejected'?'Solicitud no aprobada':'Pendiente de aprobación';$('#trainerPendingTitle').textContent=p.status==='rejected'?`Solicitud de ${label}`:`Solicitud de ${label} pendiente`;go(requestedView(viewGroups.pending,'trainerPending'));startNotificationRealtime();loadShirtRequests().then(startShirtRealtime);}
  else{state.familyDataLoading=true;go(requestedView(viewGroups.family,'familyHome'));loadFamilyData().then(()=>{startFamilyRealtime();startNotificationRealtime();loadShirtRequests().then(startShirtRealtime);handleOnvoReturn();}).catch(e=>alert(err(e)));const playerMode=isPlayerProfile(p);const payBtn=$('[data-view="familyPayments"]');if(payBtn)payBtn.classList.toggle('hidden',playerMode);const linkBtn=$('[data-view="familyLink"]');if(linkBtn)linkBtn.classList.toggle('hidden',playerMode);}
  if(admin||coachingStaff)setTimeout(handleOnvoReturn,0);
}

function showOut(){clearTimeout(bootWatchdog);state.authStatus='unauthenticated';stopRealtime();stopNotificationRealtime();stopShirtRealtime();$('#bootScreen').classList.add('hidden');$('#appScreen').classList.add('hidden');$('#authScreen').classList.remove('hidden')}

$$('.auth-tab').forEach(b=>b.onclick=()=>{$$('.auth-tab').forEach(x=>x.classList.toggle('active',x===b));$$('.auth-panel').forEach(x=>x.classList.toggle('active',x.id===b.dataset.panel))});
$$('.nav button').forEach(b=>b.onclick=()=>go(b.dataset.view));
window.addEventListener('hashchange',()=>{
  if(state.authStatus!=='authenticated'||!profile)return;
  const admin=['admin','treasurer'].includes(profile.role),coaching=['trainer','assistant'].includes(profile.role),pending=['pendingTrainer','pendingAssistant'].includes(profile.role);
  const group=admin?viewGroups.admin:coaching?viewGroups.coaching:pending?viewGroups.pending:viewGroups.family;
  const next=decodeURIComponent((location.hash||'').replace(/^#/,''));
  if(group.has(next)&&next!==state.currentView)go(next,{remember:false});
});
$$('.mobile-logout-button').forEach(b=>b.onclick=()=>signOut(auth));

$$('.shirt-request-launch').forEach(b=>b.onclick=openShirtRequestDialog);
$('#shirtProduct').onchange=()=>{$('#shirtPlayerNameField').classList.toggle('shirt-player-required',$('#shirtProduct').value==='initiation_uniform');renderShirtProductPreview();};
$('#shirtRequestForm').onsubmit=async e=>{
  e.preventDefault();
  try{
    const product=$('#shirtProduct').value,size=$('#shirtSize').value.trim(),quantity=Math.max(1,Number($('#shirtQuantity').value)||1),playerName=$('#shirtPlayerName').value.trim(),notes=$('#shirtNotes').value.trim();
    if(product==='initiation_uniform'&&!playerName)return alert('Para Uniforme de Iniciación indica el nombre de la jugadora.');
    const ref=await addDoc(collection(db,'shirtRequests'),{
      orgId:ORG_ID,requestedBy:auth.currentUser.uid,requesterName:profile?.fullName||'',requesterEmail:profile?.email||auth.currentUser.email||'',
      product,size,quantity,playerName,notes,status:'pending',createdAt:serverTimestamp(),updatedAt:serverTimestamp()
    });
    await addDoc(collection(db,'notifications'),{
      orgId:ORG_ID,kind:'shirt_request',categoryId:'',targetRole:'admin',
      title:'Nueva solicitud de camiseta',body:`${profile?.fullName||'Usuario'} solicitó ${shirtProductLabel(product)} · talla ${size} · cantidad ${quantity}.`,
      sourceId:ref.id,createdBy:auth.currentUser.uid,readBy:[],createdAt:serverTimestamp()
    });
    $('#shirtRequestForm').reset();$('#shirtQuantity').value=1;await loadShirtRequests();toast('Solicitud enviada correctamente.');$('#shirtRequestDialog').close();
  }catch(x){alert(err(x))}
};
$('#shirtAdminStatusFilter').onchange=renderShirtAdmin;
$('#shirtAdminProductFilter').onchange=renderShirtAdmin;
$('#saveFanShirtPhoto').onclick=()=>saveShirtProductPhoto('fan_shirt',$('#fanShirtPhotoFile')).catch(x=>alert(err(x)));
$('#saveInitiationUniformPhoto').onclick=()=>saveShirtProductPhoto('initiation_uniform',$('#initiationUniformPhotoFile')).catch(x=>alert(err(x)));
document.addEventListener('change',e=>{const sel=e.target.closest('[data-shirt-status]');if(sel)updateShirtRequestStatus(sel.dataset.shirtStatus,sel.value).catch(x=>alert(err(x)));});

$('#dashboardOpenPayments').onclick=()=>go('sinpeAdmin');
$('#eventCalendarButton').onclick=e=>downloadSingleEventCalendar(e.currentTarget.dataset.eventId);
$('#calendarGoogleButton').onclick=()=>{
  const e=events.find(x=>x.id===pendingCalendarEventId)||trainerEvents.find(x=>x.id===pendingCalendarEventId);
  if(!e)return;
  $('#calendarChoiceDialog').close();openGoogleCalendarEvent(e);
};
$('#calendarDeviceButton').onclick=()=>{
  const e=events.find(x=>x.id===pendingCalendarEventId)||trainerEvents.find(x=>x.id===pendingCalendarEventId);
  if(!e)return;
  $('#calendarChoiceDialog').close();openNativeCalendarICS(e);
};
$('#categoryCalendarButton').onclick=e=>profile?.role==='admin'?openCategoryCalendarImport(e.currentTarget.dataset.categoryId):downloadCategoryCalendar(e.currentTarget.dataset.categoryId);
$('#categoryCalendarDownloadButton').onclick=e=>downloadCategoryCalendar(e.currentTarget.dataset.categoryId);
$('#downloadCalendarTemplateButton').onclick=downloadCategoryCalendarTemplate;
$('#previewCategoryCalendarButton').onclick=()=>previewCategoryCalendar().catch(e=>alert(err(e)));
$('#confirmCategoryCalendarButton').onclick=()=>confirmCategoryCalendar().catch(e=>alert(err(e)));
$('#editEventFromDetail').onclick=e=>{const id=e.currentTarget.dataset.eventId;$('#eventDetailDialog').close();openEvent(events.find(x=>x.id===id)||trainerEvents.find(x=>x.id===id));};
$('#dashboardOpenReports').onclick=()=>go('reports');
$('#dashboardRegisterPayment').onclick=()=>go('sinpeAdmin');
$('#dashboardNewEvent').onclick=()=>openEvent();
$('#dashboardNewPlayer').onclick=()=>openPlayer();
document.addEventListener('click',e=>{
  const summary=e.target.closest('[data-trainer-summary]');
  if(summary){trainerSummaryFilter=summary.dataset.trainerSummary||'all';renderTrainers();return;}
});
document.addEventListener('click',e=>{
  const target=e.target.closest('[data-dashboard-view]');
  if(!target)return;
  const view=target.dataset.dashboardView;
  if(view==='sinpeAdmin'&&target.dataset.dashboardPaymentMode){
    go(view);
    setPaymentControlMode(target.dataset.dashboardPaymentMode,{fromDashboard:true});
    return;
  }
  go(view);
});
document.addEventListener('click',e=>{
  const btn=e.target.closest('[data-pay-onvo]');
  if(btn)startOnvoCheckout(btn.dataset.payOnvo,btn);
});



document.addEventListener('click',e=>{
  const tab=e.target.closest('[data-family-payment-view]');
  if(!tab)return;
  familyPaymentView=tab.dataset.familyPaymentView==='history'?'history':'pending';
  renderFamilyCharges();
});
$('#familyPaymentHistoryStatus').onchange=renderFamilyCharges;
$('#familyPaymentHistoryPlayer').onchange=renderFamilyCharges;
$('#familyPaymentHistoryMonth').onchange=renderFamilyCharges;



$('#pilotAdminSummary').onclick=e=>{const c=e.target.closest('[data-pilot-summary]');if(!c)return;const a=c.dataset.pilotSummary;if(a.startsWith('feedback')){$('#pilotFeedbackRoleFilter').value='';$('#pilotFeedbackReviewFilter').value='';renderPilotFeedbackAdmin();$('#pilotFeedbackList').closest('.panel').scrollIntoView({behavior:'smooth'});}else{$('#pilotFeatureStatusFilter').value=a==='features-new'?'new':'';$('#pilotFeatureClassFilter').value='';renderPilotFeatureAdmin();$('#pilotFeatureAdminList').closest('.panel').scrollIntoView({behavior:'smooth'});}};
$('#marketingRosterCategory').onchange=renderMarketingRoster;$('#marketingRosterSearch').oninput=renderMarketingRoster;$('#marketingContentStatus').onchange=renderMarketingContent;
$('#pilotSurveyScope').onchange=()=>$('#pilotSurveyCategorySettings').classList.toggle('pilot-settings-disabled',$('#pilotSurveyScope').value==='all');
$('#pilotFeatureScope').onchange=()=>$('#pilotFeatureCategorySettings').classList.toggle('pilot-settings-disabled',$('#pilotFeatureScope').value==='all');
$('#savePilotSettings').onclick=async()=>{
  if(profile?.role!=='admin')return;
  const surveyAll=$('#pilotSurveyScope').value==='all',featureAll=$('#pilotFeatureScope').value==='all';
  const surveyCategoryIds=surveyAll?[]:$$('#pilotSurveyCategorySettings input:checked').map(x=>x.value);
  const featureCategoryIds=featureAll?[]:$$('#pilotFeatureCategorySettings input:checked').map(x=>x.value);
  pilotSettings={surveyEnabled:$('#pilotSurveyEnabled').checked,featureEnabled:$('#pilotFeatureEnabled').checked,surveyCategoryIds,featureCategoryIds};
  await setDoc(doc(db,'pilotSettings','main'),{orgId:ORG_ID,...pilotSettings,updatedBy:auth.currentUser.uid,updatedAt:serverTimestamp()},{merge:true});
  syncPilotNavVisibility();toast('Configuración del piloto guardada.');
};
$('#pilotSurveyForm').onsubmit=async e=>{
  e.preventDefault();
  if(!pilotModuleAllowed('survey'))return alert('La evaluación no está habilitada para tu categoría.');
  const categoryId=$('#pilotSurveyCategory').value;if(!categoryId)return alert('Selecciona una categoría.');
  const data={orgId:ORG_ID,categoryId,createdBy:auth.currentUser.uid,userName:profile?.fullName||profile?.email||'Usuario',userRole:profile?.role||'',version:PILOT_VERSION,
    ease:Number($('#pilotEase').value),navigation:Number($('#pilotNavigation').value),usefulness:Number($('#pilotUsefulness').value),performance:Number($('#pilotPerformance').value),trust:Number($('#pilotTrust').value),satisfaction:Number($('#pilotSatisfaction').value),
    mostUseful:$('#pilotMostUseful').value.trim(),mostDifficult:$('#pilotMostDifficult').value.trim(),oneChange:$('#pilotOneChange').value.trim(),classification:'unclassified',reviewStatus:'new',createdAt:serverTimestamp(),updatedAt:serverTimestamp()};
  const ref=await addDoc(collection(db,'pilotFeedback'),data);
  pilotFeedback.unshift({...data,id:ref.id,createdAt:{seconds:Math.floor(Date.now()/1000)}});
  $('#pilotSurveyForm').reset();renderPilotSurvey();toast('Evaluación enviada. Gracias por ayudarnos a mejorar VolleyCore.');
};
$('#pilotFeatureForm').onsubmit=async e=>{
  e.preventDefault();
  if(!pilotModuleAllowed('feature'))return alert('Las solicitudes de mejora no están habilitadas para tu categoría.');
  const categoryId=$('#pilotFeatureCategory').value;if(!categoryId)return alert('Selecciona una categoría.');
  const data={orgId:ORG_ID,categoryId,createdBy:auth.currentUser.uid,userName:profile?.fullName||profile?.email||'Usuario',userRole:profile?.role||'',version:PILOT_VERSION,
    module:$('#pilotFeatureModule').value,title:$('#pilotFeatureTitle').value.trim(),problem:$('#pilotFeatureProblem').value.trim(),proposal:$('#pilotFeatureProposal').value.trim(),beneficiary:$('#pilotFeatureBeneficiary').value,urgency:$('#pilotFeatureUrgency').value,
    classification:'unclassified',status:'new',createdAt:serverTimestamp(),updatedAt:serverTimestamp()};
  const ref=await addDoc(collection(db,'featureRequests'),data);
  featureRequests.unshift({...data,id:ref.id,createdAt:{seconds:Math.floor(Date.now()/1000)}});
  $('#pilotFeatureForm').reset();renderPilotFeature();toast('Feature Request enviado para análisis.');
};
$('#pilotFeedbackSearch').oninput=renderPilotFeedbackAdmin;
$('#pilotFeedbackRoleFilter').onchange=renderPilotFeedbackAdmin;
$('#pilotFeedbackReviewFilter').onchange=renderPilotFeedbackAdmin;
$('#pilotFeatureSearch').oninput=renderPilotFeatureAdmin;
$('#pilotFeatureStatusFilter').onchange=renderPilotFeatureAdmin;
$('#pilotFeatureClassFilter').onchange=renderPilotFeatureAdmin;
$('#pilotFeedbackList').onchange=async e=>{
  const classEl=e.target.closest('[data-pilot-feedback-class]'),reviewEl=e.target.closest('[data-pilot-feedback-review]');
  if(!classEl&&!reviewEl)return;
  const id=(classEl?.dataset.pilotFeedbackClass||reviewEl?.dataset.pilotFeedbackReview),r=pilotFeedback.find(x=>x.id===id);if(!r)return;
  const patch=classEl?{classification:classEl.value}:{reviewStatus:reviewEl.value};
  await updateDoc(doc(db,'pilotFeedback',id),{...patch,reviewedBy:auth.currentUser.uid,updatedAt:serverTimestamp()});Object.assign(r,patch);renderPilotAdmin();
};
$('#pilotFeatureAdminList').onchange=async e=>{
  const classEl=e.target.closest('[data-feature-class]'),statusEl=e.target.closest('[data-feature-status]');
  if(!classEl&&!statusEl)return;
  const id=(classEl?.dataset.featureClass||statusEl?.dataset.featureStatus),r=featureRequests.find(x=>x.id===id);if(!r)return;
  const patch=classEl?{classification:classEl.value}:{status:statusEl.value};
  await updateDoc(doc(db,'featureRequests',id),{...patch,reviewedBy:auth.currentUser.uid,updatedAt:serverTimestamp()});Object.assign(r,patch);renderPilotAdmin();
};

$('#notificationBellButton').onclick=()=>{$('#notificationPanel').classList.toggle('hidden');renderNotifications();};
$('#closeNotificationPanel').onclick=()=>$('#notificationPanel').classList.add('hidden');
$('#notificationList').onclick=async e=>{
  const dismiss=e.target.closest('[data-dismiss-notification]');
  if(dismiss){e.stopPropagation();await hideNotification(dismiss.dataset.dismissNotification).catch(console.warn);return;}
  const item=e.target.closest('[data-notification-id]');if(!item)return;
  await markNotificationRead(item.dataset.notificationId).catch(console.warn);const n=notifications.find(x=>x.id===item.dataset.notificationId);$('#notificationPanel').classList.add('hidden');if(!n)return;
  if(n.kind==='event'&&n.sourceId)openEventDetail(n.sourceId);else if(n.kind==='announcement')go(isCoachingRole(profile?.role)?'trainerAnnouncements':profile?.role==='family'?'familyAnnouncements':'announcements');else if(n.kind==='link_request'&&profile?.role==='admin'){go('linkAdmin');$('#linkAdminStatusFilter').value='pending';renderLinkAdmin();}
};
$('#markAllNotificationsRead').onclick=async()=>{for(const n of visibleNotifications().filter(n=>!notificationIsRead(n)))await markNotificationRead(n.id).catch(console.warn);};
$('#clearReadNotifications').onclick=async()=>{await clearReadNotifications().catch(console.warn);};
document.addEventListener('click',e=>{if(!e.target.closest('#notificationPanel')&&!e.target.closest('#notificationBellButton'))$('#notificationPanel')?.classList.add('hidden');});
document.addEventListener('click',e=>{
  if(e.target.closest('button,a,input,select,textarea,label'))return;
  const shirt=e.target.closest('[data-shirt-request-detail]');if(shirt){openShirtRequestDetail(shirt.dataset.shirtRequestDetail);return;}
});
document.addEventListener('keydown',e=>{
  if(!['Enter',' '].includes(e.key))return;
  const target=e.target.closest('[data-dashboard-view],[data-manage-role],[data-edit-charge],[data-offboarding-detail],[data-shirt-request-detail]');
  if(!target||['BUTTON','A','INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;
  e.preventDefault();
  if(target.dataset.offboardingDetail){openOffboardingDetail(target.dataset.offboardingDetail);return;}
  if(target.dataset.shirtRequestDetail){openShirtRequestDetail(target.dataset.shirtRequestDetail);return;}
  target.click();
});
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
    const requestRef=await addDoc(collection(db,'linkRequests'),{
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
    try{
      await addDoc(collection(db,'notifications'),{
        orgId:ORG_ID,
        kind:'link_request',
        targetRole:'admin',
        categoryId:'',
        title:'Nueva solicitud de vinculación',
        body:`${profile?.fullName||auth.currentUser.email||'Un usuario'} solicita vincular a ${playerName}.`,
        sourceId:requestRef.id,
        createdBy:auth.currentUser.uid,
        readBy:[],
        createdAt:serverTimestamp()
      });
    }catch(notificationError){
      console.warn('La solicitud se guardó, pero no se pudo crear la notificación administrativa.',notificationError);
    }
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
$('#newFamilyButton').onclick=()=>openFamily();$('#newSeasonButton').onclick=()=>openSeason();$('#newCategoryButton').onclick=()=>openCategory();$('#newVenueButton').onclick=()=>openVenue();$('#newEventButton').onclick=()=>openEvent();
$('#trainingOccurrenceChoiceDialog').onclick=e=>{const b=e.target.closest('[data-training-choice]');if(!b)return;const id=$('#trainingOccurrenceSeriesId').value,date=$('#trainingOccurrenceDate').value,t=trainingSeries.find(x=>x.id===id);if(!t)return;$('#trainingOccurrenceChoiceDialog').close();if(b.dataset.trainingChoice==='single'){openTrainingException(t);$('#trainingExceptionDate').value=date;return}if(b.dataset.trainingChoice==='future'){openTrainingFuture(t);$('#trainingFutureDate').value=date;return}openTraining(t)};
$('#downloadFullSportsCalendar').onclick=downloadFullSportsCalendarFile;
$('#deleteEventFromEditor').onclick=()=>{const id=$('#deleteEventFromEditor').dataset.eventId;if(id)deleteEventById(id);};
$('#deleteEventFromDetail').onclick=()=>{const id=$('#deleteEventFromDetail').dataset.eventId;if(id)deleteEventById(id);};
$('#newSportsActivityButton').onclick=()=>$('#sportsCreateDialog').showModal();
$('#sportsCreateDialog').onclick=e=>{const b=e.target.closest('[data-create-sports]');if(!b)return;$('#sportsCreateDialog').close();if(b.dataset.createSports==='training')return openTraining();openEvent();$('#eventType').value=b.dataset.createSports==='other'?'other':b.dataset.createSports;$('#eventDialogTitle').textContent=b.dataset.createSports==='festival'?'Nuevo festival':b.dataset.createSports==='match'?'Nuevo partido':'Nuevo evento';};
$('#trainingCalendar').onclick=e=>{const g=e.target.closest('[data-open-sports-group]');if(g){e.preventDefault();return openSportsDayGroup(g.dataset.openSportsGroup)}const o=e.target.closest('[data-training-occurrence]');if(o){const [id,date]=o.dataset.trainingOccurrence.split('|');return openTrainingOccurrenceChoice(id,date)}};
$('#trainingMonthCalendar').onclick=e=>{const g=e.target.closest('[data-open-sports-group]');if(g){e.preventDefault();return openSportsDayGroup(g.dataset.openSportsGroup)}const o=e.target.closest('[data-training-occurrence]');if(o){const [id,date]=o.dataset.trainingOccurrence.split('|');return openTrainingOccurrenceChoice(id,date)}};
$('#trainingsList').addEventListener('click',e=>{const g=e.target.closest('[data-open-sports-group]');if(g){e.preventDefault();e.stopPropagation();openSportsDayGroup(g.dataset.openSportsGroup)}});
$('#sportsDayDetailContent').onclick=e=>{
  const del=e.target.closest('[data-delete-event]');if(del)return deleteEventById(del.dataset.deleteEvent);
  const edit=e.target.closest('[data-edit-event]');if(!edit)return;
  $('#sportsDayDetailDialog').close();openEvent(events.find(x=>x.id===edit.dataset.editEvent)||trainerEvents.find(x=>x.id===edit.dataset.editEvent));
};$('#newAnnouncementButton').onclick=()=>openAnnouncement();
$('#addGuardianButton').onclick=()=>{if($$('.guardian-row').length>=3)return alert('Máximo 3 encargados.');$('#guardiansEditor').insertAdjacentHTML('beforeend',guardianRow())};
$('#guardiansEditor').onclick=e=>{if(e.target.classList.contains('remove-guardian'))e.target.closest('.guardian-row').remove()};
$('#playerSearch').oninput=renderPlayers;$('#playerCategoryFilter').onchange=renderPlayers;$('#playerStatusFilter').onchange=renderPlayers;$('#eventCategoryFilter').onchange=renderEvents;$('#eventTypeFilter').onchange=renderEvents;$('#eventSeasonFilter').onchange=renderEvents;$('#trainingCategoryFilter').onchange=renderTrainings;$('#trainingSeasonFilter').onchange=renderTrainings;$('#trainingVenueFilter').onchange=renderTrainings;$('#sportsActivityTypeFilter').onchange=renderTrainings;
$('#trainingPrevWeek').onclick=()=>{if(trainingViewMode==='month')trainingMonthOffset--;else trainingWeekOffset--;renderTrainings()};
$('#trainingNextWeek').onclick=()=>{if(trainingViewMode==='month')trainingMonthOffset++;else trainingWeekOffset++;renderTrainings()};
$('#trainingTodayWeek').onclick=()=>{if(trainingViewMode==='month')trainingMonthOffset=0;else trainingWeekOffset=0;renderTrainings()};
$$('[data-training-view]').forEach(b=>b.onclick=()=>{trainingViewMode=b.dataset.trainingView;$$('[data-training-view]').forEach(x=>x.classList.toggle('active',x===b));renderTrainings()});
$('#trainingStats').onclick=e=>{const c=e.target.closest('[data-training-stat]');if(!c)return;const a=c.dataset.trainingStat;if(a==='categories'){$('#trainingCategoryFilter').focus();return;}trainingViewMode=a==='upcoming'?'list':'week';if(trainingViewMode==='week')trainingWeekOffset=0;$$('[data-training-view]').forEach(x=>x.classList.toggle('active',x.dataset.trainingView===trainingViewMode));renderTrainings();};$('#chargeStatusFilter').onchange=renderCharges;
$('#chargesBody').addEventListener('click',e=>{const row=e.target.closest('tr[data-edit-charge]');if(!row||e.target.closest('button,a,input,select,textarea'))return;e.preventDefault();openCharge(charges.find(x=>x.id===row.dataset.editCharge));});
$('#chargesBody').addEventListener('keydown',e=>{const row=e.target.closest('tr[data-edit-charge]');if(!row||!['Enter',' '].includes(e.key))return;e.preventDefault();openCharge(charges.find(x=>x.id===row.dataset.editCharge));});
$('#financeSummary').addEventListener('click',e=>{
  const card=e.target.closest('[data-finance-status]');if(!card)return;
  e.preventDefault();e.stopPropagation();
  applyFinanceStatusFilter(card.dataset.financeStatus||'');
});$('#paymentsInboxSearch').oninput=renderPaymentsInbox;$('#paymentsInboxCategory').onchange=renderPaymentsInbox;$('#paymentsInboxMethod').onchange=renderPaymentsInbox;$('#paymentsInboxStatus').onchange=renderPaymentsInbox;

$('#paymentControlSearch').oninput=renderPaymentControlCenter;
$('#paymentControlMonth').onchange=renderPaymentControlCenter;
$('#paymentControlCategory').onchange=renderPaymentControlCenter;
$('#clearPaymentControlFilters').onclick=()=>{
  paymentControlMode='all';
  $('#paymentControlSearch').value='';
  $('#paymentControlMonth').value='';
  $('#paymentControlCategory').value='';
  renderPaymentControlCenter();
};
document.addEventListener('click',e=>{
  const card=e.target.closest('[data-payment-control-mode]');
  if(card){setPaymentControlMode(card.dataset.paymentControlMode);return;}
  if(e.target.closest('[data-scroll-payment-review]'))document.querySelector('.payment-review-panel')?.scrollIntoView({behavior:'smooth',block:'start'});
});
$('#paymentReportType').onchange=()=>{generatedPaymentReport=[];updatePaymentReportStatusOptions();renderSinpeAdmin();};$('#paymentReportPeriodType').onchange=updatePaymentReportPeriodControls;$('#generatePaymentsReportButton').onclick=generatePaymentReport;$('#downloadPaymentsReportButton').onclick=exportPaymentReports;$('#paymentReportMonthsToggle').onclick=()=>togglePaymentMonthsMenu();$('#paymentReportMonths').onchange=updatePaymentMonthsLabel;$('#selectAllReportMonthsButton').onclick=()=>{$$('#paymentReportMonths input').forEach(i=>i.checked=true);updatePaymentMonthsLabel();};$('#clearReportMonthsButton').onclick=()=>{$$('#paymentReportMonths input').forEach(i=>i.checked=false);updatePaymentMonthsLabel();};$('#familyCategoryFilter').onchange=renderUsers;
$('#userAdminSearch').oninput=renderUserAdmin;
$('#userAdminRoleFilter').onchange=renderUserAdmin;
$('#userAdminStatusFilter').onchange=renderUserAdmin;
$('#userAdminSummary').onclick=e=>{
  const card=e.target.closest('[data-user-admin-role]');if(!card)return;
  $('#userAdminRoleFilter').value=card.dataset.userAdminRole||'';
  $('#userAdminStatusFilter').value=card.dataset.userAdminStatus||'';
  renderUserAdmin();
};
$('#linkAdminSearch').oninput=renderLinkAdmin;
$('#linkAdminStatusFilter').onchange=renderLinkAdmin;
$('#linkAdminCategoryFilter').onchange=renderLinkAdmin;
document.addEventListener('click',e=>{
  const card=e.target.closest('[data-link-admin-status]');
  if(!card)return;
  $('#linkAdminStatusFilter').value=card.dataset.linkAdminStatus||'';
  renderLinkAdmin();
});document.addEventListener('click',e=>{if(!e.target.closest('#paymentReportMonthsBox'))togglePaymentMonthsMenu(false);});updatePaymentReportStatusOptions();updatePaymentReportPeriodControls();


document.addEventListener('change',e=>{const input=e.target.closest('[data-category-gallery-upload]');if(input)uploadCategoryGalleryPhotos(input.dataset.categoryGalleryUpload,input).catch(x=>alert(err(x)))});
$('#applyFinanceFilters')?.addEventListener('click',applyFinanceFilters);$('#clearFinanceFilters')?.addEventListener('click',clearFinanceFilters);document.addEventListener('click',e=>{const b=e.target.closest('[data-finance-tab]');if(b)setFinanceTab(b.dataset.financeTab)});
$('#bankStatementFile')?.addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;bankImportRows=parseBankCsv(await f.text());renderBankReconciliation()});
$('#fixedExpenseForm')?.addEventListener('submit',async e=>{e.preventDefault();await addDoc(collection(db,'fixedExpenses'),{orgId:ORG_ID,name:$('#fixedExpenseName').value.trim(),amount:Number($('#fixedExpenseAmount').value)||0,frequency:'monthly',dueDay:Number($('#fixedExpenseDueDay').value)||1,categoryId:$('#fixedExpenseCategory').value||'',notes:$('#fixedExpenseNotes').value.trim(),active:true,createdAt:serverTimestamp(),createdBy:auth.currentUser.uid});e.target.reset();await loadCommunityData();renderFinanceEnhancements();toast('Gasto fijo guardado.')});
$('#sponsorIncomeForm')?.addEventListener('submit',async e=>{e.preventDefault();await addDoc(collection(db,'sponsorIncome'),{orgId:ORG_ID,sponsorName:$('#sponsorName').value.trim(),amount:Number($('#sponsorAmount').value)||0,date:$('#sponsorDate').value,categoryId:$('#sponsorCategory').value||'',concept:$('#sponsorConcept').value.trim(),reference:$('#sponsorReference').value.trim(),status:'received',createdAt:serverTimestamp(),createdBy:auth.currentUser.uid});e.target.reset();await loadCommunityData();renderFinanceEnhancements();toast('Ingreso de patrocinador guardado.')});

document.body.onclick=e=>{const t=e.target.closest('[data-edit-player],[data-edit-category],[data-view-category],[data-edit-venue],[data-edit-event],[data-edit-season],[data-edit-training],[data-training-exception],[data-training-future],[data-copy-address],[data-edit-announcement],[data-edit-charge],[data-approve-sinpe],[data-reject-sinpe],[data-view-player],[data-approve-link],[data-reject-link],[data-add-player-family],[data-view-family],[data-edit-family],[data-manage-family-members],[data-view-user],[data-manage-role],[data-player-finances],[data-edit-trainer],[data-approve-trainer],[data-reject-trainer],[data-delete-event],[data-delete-season],[data-delete-venue],[data-family-category],[data-edit-category-video],[data-delete-category-video]');if(!t)return;const id=t.dataset.editPlayer;if(id)openPlayer(players.find(x=>x.id===id));const c=t.dataset.editCategory;if(c)openCategory(categories.find(x=>x.id===c));const vc=t.dataset.viewCategory;if(vc)openCategoryDetail(vc);const v=t.dataset.editVenue;if(v)openVenue(venues.find(x=>x.id===v));const ev=t.dataset.editEvent;if(ev)openEvent(events.find(x=>x.id===ev)||trainerEvents.find(x=>x.id===ev));const ss=t.dataset.editSeason;if(ss)openSeason(seasons.find(x=>x.id===ss));const tr=t.dataset.editTraining;if(tr)openTraining(trainingSeries.find(x=>x.id===tr));const tx=t.dataset.trainingException;if(tx)openTrainingException(trainingSeries.find(x=>x.id===tx));const tf=t.dataset.trainingFuture;if(tf)openTrainingFuture(trainingSeries.find(x=>x.id===tf));if(t.dataset.copyAddress){navigator.clipboard?.writeText(t.dataset.copyAddress);toast('Dirección copiada.')}const a=t.dataset.editAnnouncement;if(a)openAnnouncement(announcements.find(x=>x.id===a));const ch=t.dataset.editCharge;if(ch)openCharge(charges.find(x=>x.id===ch));const ap=t.dataset.approveSinpe;if(ap)approveSinpe(ap);const rj=t.dataset.rejectSinpe;if(rj)rejectSinpe(rj);const vp=t.dataset.viewPlayer;if(vp)openPlayerDetail(vp);const al=t.dataset.approveLink;if(al)approveLink(al);const rl=t.dataset.rejectLink;if(rl)rejectLink(rl);const af=t.dataset.addPlayerFamily;if(af)openFamilyMemberPicker(af);const mf=t.dataset.manageFamilyMembers;if(mf)openFamilyMemberPicker(mf);const vu=t.dataset.viewUser;if(vu)openUserDetail(vu);const mr=t.dataset.manageRole;if(mr)openRoleManager(allUsers.find(u=>u.id===mr));const vf=t.dataset.viewFamily;if(vf)openFamilyDetail(vf);const ef=t.dataset.editFamily;if(ef)openFamily(families.find(x=>x.id===ef));const pf=t.dataset.playerFinances;if(pf)openPlayerFinancialDetail(pf);const et=t.dataset.editTrainer;if(et)openTrainerEditor(trainerUsers.find(u=>u.id===et));const at=t.dataset.approveTrainer;if(at){const u=allUsers.find(x=>x.id===at);if(u){openTrainerEditor(u);$('#trainerRole').value=u.role==='pendingAssistant'?'assistant':'trainer';$('#trainerRole').onchange();}}const rt=t.dataset.rejectTrainer;if(rt){const u=allUsers.find(x=>x.id===rt);if(u&&confirm(`¿Rechazar la solicitud de ${u.role==='pendingAssistant'?'asistente':'entrenador'} de ${u.fullName||u.email}?`)){updateDoc(doc(db,'users',rt),{role:u.role,status:'rejected',updatedAt:serverTimestamp()}).then(()=>toast('Solicitud rechazada.')).catch(x=>alert(err(x)));}}const de=t.dataset.deleteEvent;if(de)deleteEventById(de);const ds=t.dataset.deleteSeason;if(ds)deleteSeason(ds);const dv=t.dataset.deleteVenue;if(dv)deleteVenue(dv);const fc=t.dataset.familyCategory;if(fc)openFamilyCategoryDetail(fc);const fce=t.dataset.familyCalendarEvent;if(fce)downloadSingleEventCalendar(fce);const ecv=t.dataset.editCategoryVideo;if(ecv)openCategoryVideo(categoryVideos.find(v=>v.id===ecv));const dcv=t.dataset.deleteCategoryVideo;if(dcv){const v=categoryVideos.find(x=>x.id===dcv);if(v&&confirm(`¿Está seguro de que desea eliminar el video "${v.title}"?`)){deleteDoc(doc(db,'categoryVideos',dcv)).then(async()=>{await loadAdminData();openCategoryDetail(v.categoryId);toast('Video eliminado.');}).catch(x=>alert(err(x)));}}};

$('#familyForm').onsubmit=async e=>{e.preventDefault();try{const id=$('#familyDocId').value,memberUserIds=$$('#familyUsersEditor input:checked').map(i=>i.value),playerIds=$$('#familyPlayersEditor input:checked').map(i=>i.value),data={orgId:ORG_ID,familyCode:$('#familyCode').value.trim(),name:$('#familyName').value.trim(),phone:$('#familyPhone').value.trim(),address:$('#familyAddress').value.trim(),notes:$('#familyNotes').value.trim(),status:$('#familyStatus').value,memberUserIds,playerIds,updatedAt:serverTimestamp()};let familyId=id;if(id)await updateDoc(doc(db,'families',id),data);else{const ref=await addDoc(collection(db,'families'),{...data,createdAt:serverTimestamp()});familyId=ref.id}const old=families.find(f=>f.id===id),oldUsers=new Set(old?.memberUserIds||[]),oldPlayers=new Set(old?.playerIds||[]),newUsers=new Set(memberUserIds),newPlayers=new Set(playerIds),batch=writeBatch(db);let operations=0;for(const u of familyUsers){if(newUsers.has(u.id)){batch.update(doc(db,'users',u.id),{familyId,updatedAt:serverTimestamp()});operations++;}else if(oldUsers.has(u.id)&&u.familyId===familyId){batch.update(doc(db,'users',u.id),{familyId:'',updatedAt:serverTimestamp()});operations++;}}for(const p of players){if(newPlayers.has(p.id)){const linkedUserIds=[...new Set(memberUserIds)];batch.update(doc(db,'players',p.id),{familyId,linkedUserIds,updatedAt:serverTimestamp()});operations++;charges.filter(c=>c.playerId===p.id).forEach(c=>{batch.update(doc(db,'charges',c.id),{userIds:linkedUserIds,updatedAt:serverTimestamp()});operations++;});}else if(oldPlayers.has(p.id)&&p.familyId===familyId){batch.update(doc(db,'players',p.id),{familyId:'',linkedUserIds:[],updatedAt:serverTimestamp()});operations++;charges.filter(c=>c.playerId===p.id).forEach(c=>{batch.update(doc(db,'charges',c.id),{userIds:[],updatedAt:serverTimestamp()});operations++;});}}if(operations)await batch.commit();$('#familyDialog').close();await loadAdminData();toast('Familia guardada.')}catch(x){alert(err(x))}};

$('#playerPhotoFile').onchange=e=>{const f=e.target.files?.[0];if(f)previewPhoto($('#playerPhotoPreview'),URL.createObjectURL(f),Date.now(),'Sin foto');};
$('#categoryPhotoFile').onchange=e=>{const f=e.target.files?.[0];if(f)previewPhoto($('#categoryPhotoPreview'),URL.createObjectURL(f),Date.now(),'Sin foto del equipo');};
$('#playerForm').onsubmit=async e=>{
  e.preventDefault();
  try{
    const id=$('#playerDocId').value,manualGuardians=$$('.guardian-row').map(r=>({id:r.dataset.id,sourceUserId:r.dataset.sourceUserId||'',name:r.querySelector('.g-name').value.trim(),relationship:r.querySelector('.g-rel').value.trim(),phone:r.querySelector('.g-phone').value.trim(),email:r.querySelector('.g-email').value.trim()})).filter(g=>g.name||g.phone||g.email),linkedUserIds=$$('#linkedUsersEditor input:checked').map(i=>i.value),guardians=guardiansFromLinkedUsers(linkedUserIds,manualGuardians);
    const primaryCategoryId=$('#playerCategory').value,reinforcementCategoryIds=$$('#playerCategoriesEditor input:checked').map(i=>i.value).filter(cid=>cid!==primaryCategoryId),categoryIds=[primaryCategoryId,...reinforcementCategoryIds],feeRaw=$('#playerFee').value;
    const data={orgId:ORG_ID,playerCode:$('#playerCode').value.trim(),name:$('#playerName').value.trim(),birthdate:$('#playerBirthdate').value,nationalTeam:$('#playerNationalTeam').checked,categoryId:primaryCategoryId,reinforcementCategoryIds,categoryIds,permanentReinforcement:$('#playerPermanentReinforcement').checked,number:$('#playerNumber').value.trim(),position:$('#playerPosition').value.trim(),customFee:isFirstDivisionCategoryId(primaryCategoryId)?null:(feeRaw===''?null:Number(feeRaw)||0),status:$('#playerStatus').value,notes:$('#playerNotes').value.trim(),linkedUserIds,updatedAt:serverTimestamp()};
    if(id){const current=players.find(p=>p.id===id),oldStatus=current?.status||'active';if(data.status==='inactive'&&oldStatus!=='inactive'){const proceed=await createOffboardingRecordIfNeeded({entityType:'player',entityId:id,entityName:data.name||current?.name||'Jugadora',oldStatus,newStatus:data.status});if(!proceed)return;}}
    const privateData={orgId:ORG_ID,categoryIds,linkedUserIds,identificationNumber:$('#playerIdentification').value.trim(),phone:$('#playerPhone').value.trim(),email:$('#playerEmail').value.trim(),province:$('#playerProvince').value.trim(),cantonDistrict:$('#playerCantonDistrict').value.trim(),address:$('#playerAddress').value.trim(),emergencyContact:{name:$('#playerEmergencyName').value.trim(),phone:$('#playerEmergencyPhone').value.trim()},insured:$('#playerInsured').checked,insurance:{provider:$('#playerInsurer').value.trim(),policyNumber:$('#playerPolicyNumber').value.trim(),expiryDate:$('#playerInsuranceExpiry').value,notes:$('#playerInsuranceNotes').value.trim()},guardians,updatedAt:serverTimestamp()};
    let playerId=id;if(id){await updateDoc(doc(db,'players',id),data);const related=charges.filter(c=>c.playerId===id);if(related.length){const batch=writeBatch(db);related.forEach(c=>batch.update(doc(db,'charges',c.id),{userIds:linkedUserIds,categoryId:primaryCategoryId,updatedAt:serverTimestamp()}));await batch.commit()}}else{const ref=await addDoc(collection(db,'players'),{...data,createdAt:serverTimestamp()});playerId=ref.id}
    await setDoc(doc(db,'playerPrivate',playerId),{...privateData,playerId},{merge:true});
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
    const data={orgId:ORG_ID,name:$('#categoryName').value.trim(),ageGroup:$('#categoryAgeGroup').value.trim(),teamColor:$('#categoryTeamColor').value.trim(),fee:Number($('#categoryFee').value)||0,dueDay:Number($('#categoryDueDay').value)||15,jerseyNumberStart:Number($('#categoryJerseyStart').value)||1,jerseyNumberEnd:Number($('#categoryJerseyEnd').value)||99,seasonId:$('#categorySeason').value,status:$('#categoryStatus').value,coach:$('#categoryCoach').value.trim(),assistant:$('#categoryAssistant').value.trim(),schedule:$('#categorySchedule').value.trim(),venueId:$('#categoryVenue').value,notes:$('#categoryNotes').value.trim(),updatedAt:serverTimestamp()};
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
      batch.set(doc(db,'playerPrivate',p.id),{orgId:ORG_ID,playerId:p.id,categoryIds:next,linkedUserIds:p.linkedUserIds||[],updatedAt:serverTimestamp()},{merge:true});
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
    const id=$('#eventDocId').value,coaching=isCoachingRole(profile?.role),categoryIds=$$('#eventCategoriesEditor input:checked').map(i=>i.value);
    if(!categoryIds.length)return alert('Selecciona al menos una categoría.');
    if(coaching&&categoryIds.some(id=>!(profile.assignedCategoryIds||[]).includes(id)))return alert('Solo puedes crear o editar eventos de tus categorías asignadas.');
    const categoryId=categoryIds[0];
    const data={orgId:ORG_ID,categoryId,categoryIds,seasonId:$('#eventSeason').value,type:$('#eventType').value,title:$('#eventTitle').value.trim(),opponent:$('#eventOpponent').value.trim(),date:$('#eventDate').value,startTime:$('#eventStart').value,endTime:$('#eventEnd').value,homeAway:$('#eventHomeAway').value,venueId:$('#eventHomeAway').value==='away'?'':$('#eventVenue').value,awayVenueName:$('#eventAwayVenueName').value.trim(),awayAddress:$('#eventAwayAddress').value.trim(),locationUrl:$('#eventLocationUrl').value.trim(),uniform:$('#eventUniform').value,status:$('#eventStatus').value,notes:$('#eventNotes').value.trim(),updatedAt:serverTimestamp()};
    let eventId=id;if(id){const existing=events.find(x=>x.id===id)||trainerEvents.find(x=>x.id===id);if(coaching&&(!existing||sportsCategoryIds(existing).some(id=>!(profile.assignedCategoryIds||[]).includes(id))))return alert('No tienes permiso para editar este evento.');await updateDoc(doc(db,'events',id),data);}else{const ref=await addDoc(collection(db,'events'),{...data,createdBy:auth.currentUser.uid,createdByName:profile?.fullName||profile?.email||'Usuario',createdByRole:profile?.role||'',createdAt:serverTimestamp()});eventId=ref.id}
    for(const cid of categoryIds)await createCategoryNotification({kind:'event',categoryId:cid,title:id?'Evento actualizado':`Nuevo ${typeLabel(data.type).toLowerCase()}`,body:`${data.title} · ${data.date}${data.startTime?' · '+data.startTime:''}${data.homeAway==='away'?' · Visitante':''}`,sourceId:eventId});
    $('#eventDialog').close();
    if(coaching){await loadTrainerData();renderTrainerEvents();}else{await loadAdminData();}
    toast('Evento guardado.');
    if($('#categoryDialog')?.open)renderCategoryEditorRelations($('#categoryDocId').value);
  }catch(x){alert(err(x))}
};
$('#seasonForm').onsubmit=async e=>{e.preventDefault();try{const id=$('#seasonDocId').value,isCurrent=$('#seasonCurrent').checked,batch=writeBatch(db);if(isCurrent)seasons.filter(s=>s.isCurrent&&s.id!==id).forEach(s=>batch.update(doc(db,'seasons',s.id),{isCurrent:false,updatedAt:serverTimestamp()}));const data={orgId:ORG_ID,name:$('#seasonName').value.trim(),startDate:$('#seasonStart').value,endDate:$('#seasonEnd').value,status:$('#seasonStatus').value,isCurrent,updatedAt:serverTimestamp()};if(id)batch.update(doc(db,'seasons',id),data);else batch.set(doc(collection(db,'seasons')),{...data,createdAt:serverTimestamp()});await batch.commit();$('#seasonDialog').close();await loadAdminData();toast('Temporada guardada.')}catch(x){alert(err(x))}};
$('#trainingForm').onsubmit=async e=>{e.preventDefault();try{const id=$('#trainingDocId').value,days=$$('input[name="trainingDay"]:checked').map(i=>Number(i.value)),categoryIds=$$('#trainingCategoriesEditor input:checked').map(i=>i.value);if(!categoryIds.length)return alert('Selecciona al menos una categoría.');if(!days.length)return alert('Selecciona al menos un día de entrenamiento.');const data={orgId:ORG_ID,categoryId:categoryIds[0],categoryIds,seasonId:$('#trainingSeason').value,days,startTime:$('#trainingStartTime').value,endTime:$('#trainingEndTime').value,startDate:$('#trainingStartDate').value,endDate:$('#trainingEndDate').value,venueId:$('#trainingVenue').value,status:$('#trainingStatus').value,notes:$('#trainingNotes').value.trim(),updatedAt:serverTimestamp()};if(id)await updateDoc(doc(db,'trainingSeries',id),data);else await addDoc(collection(db,'trainingSeries'),{...data,createdAt:serverTimestamp()});$('#trainingDialog').close();await loadAdminData();toast('Entrenamiento recurrente guardado.');if($('#categoryDialog')?.open)renderCategoryEditorRelations($('#categoryDocId').value);}catch(x){alert(err(x))}};
$('#trainingExceptionForm').onsubmit=async e=>{e.preventDefault();try{const seriesId=$('#trainingExceptionSeriesId').value,date=$('#trainingExceptionDate').value,existing=trainingExceptions.find(x=>x.seriesId===seriesId&&x.date===date);const data={orgId:ORG_ID,seriesId,date,action:$('#trainingExceptionAction').value,startTime:$('#trainingExceptionStart').value,endTime:$('#trainingExceptionEnd').value,venueId:$('#trainingExceptionVenue').value,notes:$('#trainingExceptionNotes').value.trim(),updatedAt:serverTimestamp()};if(existing)await updateDoc(doc(db,'trainingExceptions',existing.id),data);else await addDoc(collection(db,'trainingExceptions'),{...data,createdAt:serverTimestamp()});$('#trainingExceptionDialog').close();await loadAdminData();toast('Excepción guardada.')}catch(x){alert(err(x))}};
$('#trainingFutureForm').onsubmit=async e=>{e.preventDefault();try{const id=$('#trainingFutureSeriesId').value,t=trainingSeries.find(x=>x.id===id),from=$('#trainingFutureDate').value;if(!t||from<=t.startDate||from>t.endDate)return alert('La fecha debe estar dentro de la serie y ser posterior al inicio.');const batch=writeBatch(db);batch.update(doc(db,'trainingSeries',id),{endDate:datePlus(from,-1),updatedAt:serverTimestamp()});const {id:oldId,createdAt:oldCreated,updatedAt:oldUpdated,...base}=t;batch.set(doc(collection(db,'trainingSeries')),{...base,startDate:from,startTime:$('#trainingFutureStart').value,endTime:$('#trainingFutureEnd').value,venueId:$('#trainingFutureVenue').value,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});await batch.commit();$('#trainingFutureDialog').close();await loadAdminData();toast('Cambios aplicados a los entrenamientos siguientes.')}catch(x){alert(err(x))}};
$('#announcementForm').onsubmit=async e=>{e.preventDefault();try{const id=$('#announcementDocId').value,data={orgId:ORG_ID,title:$('#announcementTitle').value.trim(),categoryId:$('#announcementCategory').value,body:$('#announcementBody').value.trim(),status:$('#announcementStatus').value,updatedAt:serverTimestamp()};let announcementId=id;if(id)await updateDoc(doc(db,'announcements',id),data);else{const ref=await addDoc(collection(db,'announcements'),{...data,createdAt:serverTimestamp()});announcementId=ref.id}if(data.status==='published')await createCategoryNotification({kind:'announcement',categoryId:data.categoryId,title:id?'Comunicado actualizado':'Nuevo comunicado',body:data.title,sourceId:announcementId});$('#announcementDialog').close();await loadAdminData();toast('Comunicado guardado.')}catch(x){alert(err(x))}};
$('#chargeForm').onsubmit=async e=>{e.preventDefault();try{await updateDoc(doc(db,'charges',$('#chargeDocId').value),{amount:Number($('#chargeAmount').value)||0,paidAmount:Number($('#chargePaidAmount').value)||0,status:$('#chargeStatus').value,notes:$('#chargeNotes').value.trim(),updatedAt:serverTimestamp()});$('#chargeDialog').close();await loadAdminData();renderCurrentView();toast('Mensualidad actualizada.')}catch(x){alert(err(x))}};

$('#generateChargesButton').onclick=()=>{$('#generateMonth').value=monthNow();$('#generateCategory').value='';$('#generateDialog').showModal()};
$('#generateForm').onsubmit=async e=>{e.preventDefault();const month=$('#generateMonth').value,cat=$('#generateCategory').value,eligible=players.filter(p=>p.status==='active'&&!isFirstDivisionPrimary(p)&&playerMonthlyFee(p)>0&&(!cat||playerCatIds(p).includes(cat)));try{const existing=new Set(charges.filter(c=>c.month===month).map(c=>`${c.playerId}|${c.month}`)),batch=writeBatch(db);let count=0;for(const p of eligible){if(existing.has(`${p.id}|${month}`))continue;const amount=playerMonthlyFee(p);batch.set(doc(db,'charges',`${p.id}_${month}`),{orgId:ORG_ID,playerId:p.id,playerCode:p.playerCode,categoryId:p.categoryId,userIds:p.linkedUserIds||[],month,amount,paidAmount:0,status:'pending',dueDay:15,dueDate:dueDateForMonth(month),createdAt:serverTimestamp(),updatedAt:serverTimestamp()});count++}if(count)await batch.commit();$('#generateDialog').close();await loadAdminData();toast(`${count} mensualidades generadas.`)}catch(x){alert(err(x))}};

function availableSinpeCharges(){return familyCharges.filter(c=>['pending','partial'].includes(c.status)&&chargeRemaining(c)>0&&!activeReportForCharge(c.id))}
function selectedBulkChargeIds(){return $$('#sinpeChargeList input[type="checkbox"]:checked').map(i=>i.value)}
function pendingBulkAllocations(){return selectedBulkChargeIds().map(id=>familyCharges.find(c=>c.id===id)).filter(Boolean).map(c=>({chargeId:c.id,playerId:c.playerId,playerCode:c.playerCode||'',categoryId:c.categoryId||familyPlayers.find(p=>p.id===c.playerId)?.categoryId||'',month:c.month,amount:chargeRemaining(c),createCharge:false}))}
function advanceBulkAllocations(){const out=[];$$('.sinpe-advance-row').forEach(row=>{const playerId=row.dataset.playerId,advanceAmount=Math.max(0,Number(row.querySelector('input').value)||0);if(!advanceAmount)return;const p=familyPlayers.find(x=>x.id===playerId),fee=playerMonthlyFee(p);if(!fee)return;let remaining=advanceAmount,cursor=latestKnownMonthForPlayer(playerId),i=1;while(remaining>=fee&&i<=36){const month=addMonths(cursor,i++),existing=familyCharges.find(c=>c.playerId===playerId&&c.month===month);if(existing&&['paid','exempt'].includes(existing.status))continue;if(existing&&activeReportForCharge(existing.id))continue;const allocationAmount=existing?Math.min(chargeRemaining(existing),remaining):fee;if(allocationAmount<=0)continue;out.push({chargeId:existing?.id||'',playerId,playerCode:p?.playerCode||'',categoryId:p?.categoryId||'',month,amount:allocationAmount,createCharge:!existing});remaining-=allocationAmount}if(remaining>0)out.push({chargeId:'',playerId,playerCode:p?.playerCode||'',categoryId:p?.categoryId||'',month:'',amount:0,createCharge:false,creditOnly:remaining})});return out}
function currentBulkAllocations(){return $('#sinpePaymentIntent')?.value==='advance'?advanceBulkAllocations().filter(a=>!a.creditOnly):pendingBulkAllocations()}
function currentAdvanceCredit(){return $('#sinpePaymentIntent')?.value==='advance'?advanceBulkAllocations().filter(a=>a.creditOnly).reduce((z,a)=>z+Number(a.creditOnly||0),0):0}
function updateBulkPaymentTotal(){const intent=$('#sinpePaymentIntent')?.value||'pending',allocations=currentBulkAllocations();let total;if(intent==='advance')total=$$('.sinpe-advance-row input').reduce((z,i)=>z+(Number(i.value)||0),0);else total=allocations.reduce((z,a)=>z+Number(a.amount||0),0);$('#sinpeCalculatedTotal').textContent=money(total);$('#sinpeAmount').value=total||'';$('#sinpeAmount').readOnly=true;if($('#sinpeSelectionSummary'))$('#sinpeSelectionSummary').textContent=allocations.length?`${allocations.length} mensualidad${allocations.length===1?'':'es'} seleccionada${allocations.length===1?'':'s'}`:'Selecciona al menos una mensualidad';if(intent==='advance'){const covered=allocations.length,credit=currentAdvanceCredit();$('#sinpeAmountHelp').textContent=total?`${covered} mensualidad${covered===1?'':'es'} futura${covered===1?'':'s'} identificada${covered===1?'':'s'}${credit?` · ${money(credit)} quedará como saldo a favor`:''}.`:'Ingresa el monto que deseas adelantar para una o más jugadoras.'}else $('#sinpeAmountHelp').textContent='El total se calcula según las mensualidades pendientes seleccionadas.';$('#sinpeSubmitButton').disabled=total<=0}
function renderBulkPaymentOptions(){const available=availableSinpeCharges().sort((a,b)=>String(a.month).localeCompare(String(b.month))||playerName(a.playerId).localeCompare(playerName(b.playerId)));$('#sinpeChargeList').innerHTML=available.map(c=>`<label class="bulk-charge-option"><input type="checkbox" value="${c.id}"><span><strong>${esc(playerName(c.playerId))}</strong><small>${esc(monthLabel(c.month))} · Saldo ${money(chargeRemaining(c))}${chargeDueState(c)==='overdue'?' · Morosa':''}</small></span><strong>${money(chargeRemaining(c))}</strong></label>`).join('')||'<p class="muted">No hay mensualidades pendientes existentes.</p>';$('#sinpeAdvancePlayers').innerHTML=familyPlayers.filter(p=>playerMonthlyFee(p)>0).map(p=>`<div class="sinpe-advance-row" data-player-id="${p.id}"><div><strong>${esc(p.name)}</strong><small>Mensualidad ${money(playerMonthlyFee(p))} · siguiente período después de ${esc(monthLabel(latestKnownMonthForPlayer(p.id)))}</small></div><label>Monto a adelantar<input type="number" min="0" step="1" placeholder="₡0"></label></div>`).join('')||'<p class="muted">No hay jugadoras con mensualidad configurada.</p>';syncSinpePaymentIntent()}
function syncSinpePaymentIntent(){const advance=$('#sinpePaymentIntent')?.value==='advance';$('#sinpePendingSection')?.classList.toggle('hidden',advance);$('#sinpeAdvanceSection')?.classList.toggle('hidden',!advance);$('#sinpeTotalLabel').textContent=advance?'Total a adelantar':'Total adeudado seleccionado';$('#sinpeAmountLabel').childNodes[0].nodeValue=advance?'Monto a adelantar ':'Monto del reporte ';updateBulkPaymentTotal()}

function addMonths(month,offset){
  const base=/^\d{4}-\d{2}$/.test(String(month||''))?String(month):monthNow();
  const [y,m]=base.split('-').map(Number),d=new Date(y,m-1+Number(offset||0),1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}
function latestKnownMonthForPlayer(playerId){
  const months=[
    ...familyCharges.filter(c=>c.playerId===playerId&&/^\d{4}-\d{2}$/.test(String(c.month||''))).map(c=>c.month),
    ...sinpeReports.flatMap(r=>(r.allocations||[]).filter(a=>a.playerId===playerId&&/^\d{4}-\d{2}$/.test(String(a.month||''))).map(a=>a.month))
  ].sort();
  return months.at(-1)||monthNow();
}

function localTimeHHMM(){const d=new Date();return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`}
async function uploadPaymentReceipt(file){if(!file)return{receiptUrl:'',receiptPath:''};if(file.size>5*1024*1024)throw Error('El comprobante no puede superar 5 MB.');const blob=await compressImageFile(file,{maxDimension:1800}),id=`${Date.now()}-${Math.random().toString(36).slice(2,8)}`,path=`orgs/${ORG_ID}/paymentReceipts/${auth.currentUser.uid}/${id}.jpg`,rf=storageRef(storage,path);try{await uploadBytes(rf,blob,{contentType:'image/jpeg'});return{receiptUrl:await getDownloadURL(rf),receiptPath:path}}catch(e){if(String(e?.code||'').includes('unauthorized'))throw Error('No fue posible subir el comprobante. Las reglas de Firebase Storage deben estar desplegadas para permitir comprobantes de familias.');throw e}}
$('#openSinpeButton').onclick=()=>{if(!availableSinpeCharges().length&&!familyPlayers.some(p=>playerMonthlyFee(p)>0))return alert('No hay mensualidades disponibles para reportar.');$('#sinpeForm').reset();$('#paymentMethod').value='sinpe';$('#sinpeDate').value=today();$('#sinpeTime').value=localTimeHHMM();$('#sinpePhone').value=profile.phone||'';$('#sinpePayer').value=profile.fullName||'';$('#sinpePaymentIntent').value='pending';renderBulkPaymentOptions();$('#sinpeDialog').showModal()};
document.addEventListener('change',e=>{if(e.target.matches('#sinpePaymentIntent'))syncSinpePaymentIntent();if(e.target.closest('#sinpeChargeList')||e.target.closest('#sinpeAdvancePlayers'))updateBulkPaymentTotal()});
$('#sinpeForm').onsubmit=async e=>{e.preventDefault();const b=$('#sinpeSubmitButton');try{const intent=$('#sinpePaymentIntent').value,allocations=currentBulkAllocations(),amount=Number($('#sinpeAmount').value),receiptFile=$('#sinpeReceipt')?.files?.[0],reference=$('#sinpeReference').value.trim();if(amount<=0)throw Error(intent==='advance'?'Ingresa un monto para adelantar.':'Selecciona al menos una mensualidad pendiente.');if(!reference&&!receiptFile)throw Error('Debes indicar un número de comprobante o adjuntar una foto del comprobante.');if(intent==='pending'&&!allocations.length)throw Error('Selecciona al menos una mensualidad pendiente.');if(intent==='advance'&&!allocations.length&&currentAdvanceCredit()===0)throw Error('El monto indicado no permite identificar mensualidades futuras.');for(const a of allocations){if(a.chargeId&&activeReportForCharge(a.chargeId))throw Error(`Ya existe un pago reportado para ${playerName(a.playerId)} · ${monthLabel(a.month)}.`)}const calculated=allocations.reduce((z,a)=>z+Number(a.amount||0),0),credit=intent==='advance'?currentAdvanceCredit():Math.max(0,amount-calculated);busy(b,true,'Enviando…');const receipt=await uploadPaymentReceipt(receiptFile);const first=allocations[0]||{playerId:familyPlayers[0]?.id||'',playerCode:familyPlayers[0]?.playerCode||'',categoryId:familyPlayers[0]?.categoryId||'',month:'',chargeId:''};await addDoc(collection(db,'sinpeReports'),{orgId:ORG_ID,userId:auth.currentUser.uid,chargeId:first.chargeId||'',playerId:first.playerId,playerCode:first.playerCode||'',month:first.month||'',paymentIntent:intent,paymentMethod:$('#paymentMethod').value,amount,date:$('#sinpeDate').value,time:$('#sinpeTime').value||localTimeHHMM(),bank:$('#sinpeBank').value.trim(),phone:$('#sinpePhone').value.trim(),payerName:$('#sinpePayer').value.trim(),reference,notes:$('#sinpeNotes').value.trim(),allocations,calculatedAmount:calculated,creditBalance:credit,...receipt,status:'reported',createdAt:serverTimestamp(),updatedAt:serverTimestamp()});$('#sinpeDialog').close();await loadFamilyData();showView('familyPayments');renderFamilyCharges();const confirmation=$('#familyPaymentConfirmation');if(confirmation){confirmation.textContent=`✓ Reporte enviado correctamente · ${money(amount)} · Pendiente de revisión.`;confirmation.classList.remove('hidden');confirmation.scrollIntoView({behavior:'smooth',block:'start'})}toast('Reporte enviado correctamente · pendiente de revisión.')}catch(x){alert(err(x))}finally{busy(b,false)}};
async function approveSinpe(id){if(!confirm('¿Aprobar y aplicar este pago a todas las mensualidades indicadas?'))return;try{const report=sinpeReports.find(x=>x.id===id);if(!report)throw Error('No se encontró el reporte.');if(report.status!=='reported')throw Error('Este reporte ya fue procesado.');const allocations=report.allocations?.length?report.allocations:[{chargeId:report.chargeId,playerId:report.playerId,playerCode:report.playerCode,month:report.month,amount:report.amount,categoryId:sinpeReportCategoryId(report),createCharge:false}],batch=writeBatch(db);for(const a of allocations){let c=charges.find(x=>x.id===a.chargeId)||charges.find(x=>x.playerId===a.playerId&&x.month===a.month);if(!c){const p=players.find(x=>x.id===a.playerId),amount=Number(a.amount||playerMonthlyFee(p));const chargeId=`${a.playerId}_${a.month}`;batch.set(doc(db,'charges',chargeId),{orgId:ORG_ID,playerId:a.playerId,playerCode:a.playerCode||p?.playerCode||'',categoryId:a.categoryId||p?.categoryId||'',userIds:p?.linkedUserIds||[],month:a.month,amount,paidAmount:amount,status:'paid',dueDay:15,dueDate:dueDateForMonth(a.month),createdAt:serverTimestamp(),updatedAt:serverTimestamp()});continue}const remaining=chargeRemaining(c);if(remaining<=0)continue;const applied=Math.min(Number(a.amount||0),remaining),paid=Number(c.paidAmount||0)+applied,status=paid>=Number(c.amount||0)?'paid':'partial';batch.update(doc(db,'charges',c.id),{paidAmount:paid,status,updatedAt:serverTimestamp()})}batch.update(doc(db,'sinpeReports',id),{status:'approved',approvedBy:auth.currentUser.uid,approvedAt:serverTimestamp(),updatedAt:serverTimestamp()});await batch.commit();await loadAdminData();renderCurrentView();toast('Pago múltiple aprobado y distribuido.')}catch(x){alert(err(x))}}
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
    const adminAllowed=profile.role==='admin',familyAllowed=(p.linkedUserIds||[]).includes(auth.currentUser.uid)||isPlayerProfile()&&profile?.playerId===p.id,trainerAllowed=isCoachingRole(profile.role)&&playerCatIds(p).some(cid=>(profile.assignedCategoryIds||[]).includes(cid));
    if(!adminAllowed&&!familyAllowed&&!trainerAllowed)throw Error('No tienes acceso a esta jugadora.');
    const dlg=$('#playerDetailDialog');$('#playerDetailTitle').textContent=p.name;
    $('#deletePlayerFromDetail').classList.toggle('hidden',profile?.role!=='admin');
    $('#deletePlayerFromDetail').dataset.playerId=p.id;
    const insurance=playerInsuranceState(p),financial=playerFinancialState(p),showPrivate=adminAllowed||familyAllowed||trainerAllowed,showContacts=showPrivate,showFinancial=adminAllowed||familyAllowed||(trainerAllowed&&profile.permissions?.viewFinancialStatus);
    const categoryBlocks=playerCatIds(p).map(cid=>{const c=categories.find(x=>x.id===cid)||{},tr=trainingSeries.filter(t=>t.categoryId===cid&&t.status==='active'),ev=events.filter(e=>e.categoryId===cid&&e.date>=today()&&e.status!=='cancelled').slice(0,5);return`<article class="panel profile-section"><span class="badge ${cid===p.categoryId?'active':'neutral'}">${cid===p.categoryId?'Categoría principal':'Refuerzo'}</span><h4>${esc(c.name||'Categoría')}</h4><p>Entrenador/a: ${esc(c.coach||'Por definir')}<br>Asistente: ${esc(c.assistant||'Por definir')}</p>${tr.map(t=>`<div><strong>${esc(daysLabel(t.days||[]))}</strong> · ${esc(t.startTime||'')} – ${esc(t.endTime||'')}<br>${esc(venueName(t.venueId))}${venueLinks(t.venueId)}</div>`).join('')||'<p class="muted">Sin entrenamiento configurado.</p>'}${ev.length?`<h5>Próximos eventos</h5>${ev.map(eventMini).join('')}`:''}</article>`}).join('');
    const guardians=showContacts?`<article class="panel"><h4>Contactos / encargados</h4>${(p.guardians||[]).map(g=>`<p><strong>${esc(g.name)}</strong><br>${esc(g.relationship||'')} · ${esc(g.phone||'')} · ${esc(g.email||'')}</p>`).join('')||'<p class="muted">Sin encargados registrados.</p>'}${p.phone||p.email?`<hr><p><strong>Contacto de la jugadora</strong><br>${esc(p.phone||'—')} · ${esc(p.email||'—')}</p>`:''}</article>`:'';
    $('#playerDetailContent').innerHTML=`<div class="profile-label-row"><span class="badge active">Jugadora de: ${esc(primaryCategoryName(p))}</span>${reinforcementCategoryIds(p).length?`<span class="badge neutral">Refuerza: ${esc(reinforcementCategoryNames(p))}</span>`:''}${p.permanentReinforcement?'<span class="badge neutral">Refuerzo permanente</span>':''}${playerVisualBadges(p)}<span class="badge ${insurance.key}">${esc(insurance.label)}</span>${showFinancial?`<span class="badge ${financial.key}">${esc(financial.label)}</span>`:''}</div><div class="grid two"><article class="panel"><div class="player-profile-hero">${p.photoUrl?`<img class="player-profile-photo" src="${esc(cacheBustedImage(p.photoUrl,p.photoVersion))}" alt="${esc(p.name)}">`:'<div class="player-profile-photo placeholder">🏐</div>'}<div><span class="eyebrow">${esc(p.playerCode)}</span><h3>${esc(p.name)}</h3></div></div><div class="profile-data-list"><div><strong>Fecha de nacimiento</strong>${esc(p.birthdate||'—')}</div>${showPrivate?`<div><strong>Cédula / identificación</strong>${esc(p.identificationNumber||'—')}</div>`:''}<div><strong>Número</strong>${esc(p.number||'—')}</div><div><strong>Posición</strong>${esc(p.position||'—')}</div>${showContacts?`<div><strong>Teléfono</strong>${esc(p.phone||'—')}</div><div><strong>Correo</strong>${esc(p.email||'—')}</div><div><strong>Residencia</strong>${esc([p.cantonDistrict,p.province].filter(Boolean).join(', ')||'—')}</div>`:''}</div></article>${guardians}</div>${showPrivate?`<article class="panel"><h4>Información privada / emergencia</h4><p><strong>Dirección:</strong> ${esc(p.address||[p.cantonDistrict,p.province].filter(Boolean).join(', ')||'—')}</p><p><strong>Contacto de emergencia:</strong> ${esc(p.emergencyContact?.name||'—')} · ${esc(p.emergencyContact?.phone||'—')}</p></article>`:''}<article class="panel"><h4>Seguro médico</h4><p><strong>Estado:</strong> ${esc(insurance.label)}<br><strong>Aseguradora:</strong> ${esc(p.insurance?.provider||'—')}<br><strong>Póliza:</strong> ${esc(p.insurance?.policyNumber||'—')}<br><strong>Vencimiento:</strong> ${esc(p.insurance?.expiryDate||'—')}</p><p class="muted">${esc(p.insurance?.notes||'')}</p></article>${showFinancial?`<article class="panel"><h4>Estado financiero</h4><p><strong>${esc(financial.label)}</strong>${financial.detail?` · ${esc(financial.detail)}`:''}</p></article>`:''}<h3>Información por categoría</h3><div class="cards-grid">${categoryBlocks||'<p class="muted">Sin categorías asociadas.</p>'}</div>`;
    if(!dlg.open)dlg.showModal();
  }catch(x){alert(err(x))}
}
async function deletePlayerById(playerId){
  if(profile?.role!=='admin')return alert('Solo un Administrador puede eliminar jugadoras.');
  const p=players.find(x=>x.id===playerId);
  if(!p)return alert('No se encontró la jugadora.');
  const warning=`¿Está seguro de querer eliminar a ${p.name}?\n\nSe eliminarán su ficha deportiva y sus datos privados. El historial financiero existente se conservará para auditoría. Esta acción no se puede deshacer.`;
  if(!confirm(warning))return;
  try{
    const batch=writeBatch(db);
    batch.delete(doc(db,'playerPrivate',playerId));
    batch.delete(doc(db,'players',playerId));
    families.filter(f=>(f.playerIds||[]).includes(playerId)).forEach(f=>batch.update(doc(db,'families',f.id),{playerIds:(f.playerIds||[]).filter(id=>id!==playerId),updatedAt:serverTimestamp()}));
    allUsers.filter(u=>u.playerId===playerId).forEach(u=>batch.update(doc(db,'users',u.id),{playerId:'',updatedAt:serverTimestamp()}));
    await batch.commit();
    $('#playerDialog')?.close();
    $('#playerDetailDialog')?.close();
    await loadAdminData();
    renderCurrentView();
    toast('Jugadora eliminada.');
  }catch(x){alert(err(x))}
}
$('#deletePlayerFromEdit').onclick=e=>deletePlayerById(e.currentTarget.dataset.playerId);
$('#deletePlayerFromDetail').onclick=e=>deletePlayerById(e.currentTarget.dataset.playerId);

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
    batch.set(doc(db,'playerPrivate',p.id),{orgId:ORG_ID,playerId:p.id,categoryIds:playerCatIds(p),linkedUserIds:ids,updatedAt:serverTimestamp()},{merge:true});
    batch.update(doc(db,'users',r.userId),{familyId:fam.id,updatedAt:serverTimestamp()});
    batch.update(doc(db,'linkRequests',id),{
      status:'approved',
      playerId:p.id,
      playerCode:p.playerCode||r.playerCode||'',
      categoryId:p.categoryId||r.categoryId||'',
      familyId:fam.id,
      approvedBy:auth.currentUser.uid,
      approvedAt:serverTimestamp(),
      updatedAt:serverTimestamp()
    });
    charges.filter(c=>c.playerId===p.id).forEach(c=>batch.update(doc(db,'charges',c.id),{userIds:ids,updatedAt:serverTimestamp()}));
    await batch.commit();
    await loadAdminData();
    toast('Vinculación aprobada.');
  }catch(x){alert(err(x))}
}

async function rejectLink(id){await updateDoc(doc(db,'linkRequests',id),{status:'rejected',rejectedBy:auth.currentUser.uid,rejectedAt:serverTimestamp(),updatedAt:serverTimestamp()});await loadAdminData();if(state.currentView==='linkAdmin')renderLinkAdmin();toast('Solicitud rechazada.')}

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

function openUserDetail(id){const u=allUsers.find(x=>x.id===id);if(!u)return alert('No se encontró el usuario.');const linked=players.filter(p=>(p.linkedUserIds||[]).includes(id));$('#userDetailTitle').textContent=u.fullName;
$('#deleteUserFromDetail').classList.toggle('hidden',profile?.role!=='admin'||id===auth.currentUser?.uid);
$('#deleteUserFromDetail').dataset.userId=id;$('#userDetailContent').innerHTML=`<article class="panel"><span class="eyebrow">${esc(u.accountType==='player'?'Cuenta de jugadora':'Cuenta familiar')}</span><p><strong>Correo:</strong> ${esc(u.email||'—')}<br><strong>Teléfono:</strong> ${esc(u.phone||'—')}<br><strong>Estado:</strong> ${esc(statusLabel(u.status||'active'))}</p></article><h4>Jugadoras vinculadas</h4><div class="member-list">${linked.map(p=>`<button class="person-row" data-view-player="${p.id}"><span class="person-icon">🏐</span><span><strong>${esc(p.name)}</strong><small>${esc(p.playerCode)} · ${esc(catNames(p))}</small></span><span>›</span></button>`).join('')||'<p class="muted">No tiene jugadoras vinculadas.</p>'}</div>`;$('#userDetailDialog').showModal()}


async function deleteVolleyCoreUser(uid){
  if(profile?.role!=='admin')return alert('Solo un Administrador puede eliminar usuarios.');
  const u=allUsers.find(x=>x.id===uid);
  if(!u)return alert('No se encontró el usuario.');
  if(uid===auth.currentUser?.uid)return alert('No puedes eliminar tu propia cuenta de Administrador desde VolleyCore.');
  if(isSuperAdmin(u))return alert('Una cuenta Super Administrador está protegida y no puede eliminarse desde VolleyCore.');
  if(isProtectedAdmin(u)&&!isSuperAdmin())return alert('Solo un Super Administrador puede eliminar a otro Administrador.');

  const linked=players.filter(p=>(p.linkedUserIds||[]).includes(uid));
  const label=u.fullName||u.email||'este usuario';
  const details=linked.length?`\n\nActualmente está vinculado a: ${linked.map(p=>p.name).join(', ')}.`:'';
  const ok=confirm(`¿Está seguro de querer eliminar a ${label}?${details}\n\nSe eliminará su acceso a VolleyCore y su cuenta de Firebase Authentication. Se conservarán historiales de pagos y auditoría, pero el usuario será desvinculado de jugadoras, familias y cobros. Esta acción no se puede deshacer.`);
  if(!ok)return;

  try{
    const token=await getIdToken(auth.currentUser,true);
    const res=await fetch('/.netlify/functions/admin-user-delete',{
      method:'POST',
      headers:{'content-type':'application/json',authorization:`Bearer ${token}`},
      body:JSON.stringify({uid})
    });
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw Error(data.error||`No se pudo eliminar el usuario (${res.status}).`);
    $('#userDetailDialog')?.close();
    $('#roleManagerDialog')?.close();
    await loadAdminData();
    renderCurrentView();
    toast('Usuario eliminado correctamente.');
  }catch(x){alert(err(x))}
}
$('#deleteUserFromDetail').onclick=e=>deleteVolleyCoreUser(e.currentTarget.dataset.userId);
$('#deleteUserFromRoleManager').onclick=e=>deleteVolleyCoreUser(e.currentTarget.dataset.userId);

function stopRealtime(){[...state.adminListeners,...state.familyListeners].forEach(u=>{try{u()}catch{}});state.adminListeners=[];state.familyListeners=[];}
function startAdminRealtime(){state.adminListeners.push(onSnapshot(query(collection(db,'attendanceRecords'),where('orgId','==',ORG_ID)),snap=>{attendanceRecords=snap.docs.map(d=>({id:d.id,...d.data()}));if(state.currentView==='attendance')renderAttendance();},console.error));state.adminListeners.push(onSnapshot(query(collection(db,'categoryVideos'),where('orgId','==',ORG_ID)),snap=>{categoryVideos=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.date||'').localeCompare(a.date||''));if(state.currentView==='categories')renderCategories();},console.error));stopRealtime();const org=qname=>query(collection(db,qname),where('orgId','==',ORG_ID));
state.adminListeners.push(onSnapshot(org('charges'),snap=>{charges=snap.docs.map(d=>({id:d.id,...d.data()}));if(state.currentView==='finances')renderCharges();if(state.currentView==='sinpeAdmin'){renderSinpeAdmin();}},console.error));
state.adminListeners.push(onSnapshot(org('onvoPayments'),snap=>{onvoPayments=snap.docs.map(d=>({id:d.id,...d.data()}));if(state.currentView==='sinpeAdmin')renderOnvoAdmin();},console.error));state.adminListeners.push(onSnapshot(org('linkRequests'),snap=>{linkRequests=snap.docs.map(d=>({id:d.id,...d.data()}));updateLinkRequestNavBadge();if(state.currentView==='users')renderUsers();if(state.currentView==='linkAdmin')renderLinkAdmin();renderDashboard();},console.error));state.adminListeners.push(onSnapshot(org('players'),async snap=>{if(profile?.role==='admin')await loadPlayerPrivateForAdmin();players=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.name||'').localeCompare(b.name||''));if(profile?.role==='admin')players=players.map(mergePlayerPrivate);if(state.currentView==='players')renderPlayers();if(state.currentView==='users')renderUsers();renderDashboard();},console.error));state.adminListeners.push(onSnapshot(query(collection(db,'users'),where('orgId','==',ORG_ID)),snap=>{allUsers=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.fullName||'').localeCompare(b.fullName||''));familyUsers=allUsers.filter(u=>u.role==='family');trainerUsers=allUsers.filter(u=>isCoachingRole(u.role));if(state.currentView==='users')renderUsers();if(state.currentView==='trainers')renderTrainers();renderDashboard();},console.error));state.adminListeners.push(onSnapshot(org('families'),snap=>{families=snap.docs.map(d=>({id:d.id,...d.data()})).filter(f=>f.status!=='merged');if(state.currentView==='users')renderUsers();renderDashboard();},console.error));}
function startFamilyRealtime(){
  state.familyListeners.forEach(u=>u());state.familyListeners=[];
  const uid=auth.currentUser.uid,isPlayer=isPlayerProfile();

  state.familyListeners.push(onSnapshot(query(collection(db,'events'),where('orgId','==',ORG_ID)),snap=>{
    events=snap.docs.map(d=>({id:d.id,...d.data()}));deriveFamilyData();renderFamilyHome();renderNotifications();
    if(state.currentView==='familyEvents')renderFamilyEvents();
    if(state.currentView==='familyCategories')renderFamilyCategories();
  },e=>console.error('Event realtime error:',e)));

  if(isPlayer&&profile?.playerId){
    state.familyListeners.push(onSnapshot(doc(db,'players',profile.playerId),snap=>{
      familyPlayers=snap.exists()?[{id:snap.id,...snap.data()}]:[];deriveFamilyData();renderFamilyHome();renderNotifications();
      if(state.currentView==='familyTrainings')renderFamilyTrainings();
      if(state.currentView==='familyEvents')renderFamilyEvents();
      if(state.currentView==='familyCategories')renderFamilyCategories();
    },e=>console.error('Player profile realtime error:',e)));
  }else{
    state.familyListeners.push(onSnapshot(query(collection(db,'players'),where('orgId','==',ORG_ID),where('linkedUserIds','array-contains',uid)),snap=>{
      familyPlayers=snap.docs.map(d=>({id:d.id,...d.data()}));deriveFamilyData();renderFamilyHome();renderNotifications();
      if(state.currentView==='familyTrainings')renderFamilyTrainings();
      if(state.currentView==='familyEvents')renderFamilyEvents();
      if(state.currentView==='familyCategories')renderFamilyCategories();
    },e=>console.error('Linked player realtime error:',e)));
  }

  if(!isPlayer){
    state.familyListeners.push(onSnapshot(query(collection(db,'charges'),where('orgId','==',ORG_ID),where('userIds','array-contains',uid)),snap=>{familyCharges=snap.docs.map(d=>({id:d.id,...d.data()}));if(state.currentView==='familyPayments')renderFamilyCharges();renderFamilyHome();},e=>console.error('Charge realtime error:',e)));
    state.familyListeners.push(onSnapshot(query(collection(db,'linkRequests'),where('orgId','==',ORG_ID),where('userId','==',uid)),snap=>{familyLinkRequests=snap.docs.map(d=>({id:d.id,...d.data()}));renderFamilyLink();},e=>console.error(e)));
    state.familyListeners.push(onSnapshot(query(collection(db,'families'),where('orgId','==',ORG_ID),where('memberUserIds','array-contains',uid)),snap=>{families=snap.docs.map(d=>({id:d.id,...d.data()}));},e=>console.error(e)));
  }
}
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