import crypto from "node:crypto";

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {"content-type":"application/json; charset=utf-8","cache-control":"no-store"}
  });
}
function env(name) {
  const value=process.env[name];
  if(!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}
function serviceAccount() {
  const raw=Buffer.from(env("FIREBASE_SERVICE_ACCOUNT_B64").trim(),"base64").toString("utf8");
  const sa=JSON.parse(raw);
  if(!sa.project_id||!sa.client_email||!sa.private_key) throw new Error("Invalid Firebase service account.");
  return sa;
}
function b64url(input){ return Buffer.from(input).toString("base64url"); }

let accessToken="", accessExp=0;
async function getAccessToken(){
  const now=Math.floor(Date.now()/1000);
  if(accessToken && accessExp-60>now) return accessToken;
  const sa=serviceAccount();
  const header=b64url(JSON.stringify({alg:"RS256",typ:"JWT"}));
  const claims=b64url(JSON.stringify({
    iss:sa.client_email,
    scope:"https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/identitytoolkit",
    aud:"https://oauth2.googleapis.com/token",
    iat:now, exp:now+3600
  }));
  const unsigned=`${header}.${claims}`;
  const signature=crypto.sign("RSA-SHA256",Buffer.from(unsigned),sa.private_key).toString("base64url");
  const res=await fetch("https://oauth2.googleapis.com/token",{
    method:"POST",
    headers:{"content-type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion:`${unsigned}.${signature}`})
  });
  const data=await res.json().catch(()=>({}));
  if(!res.ok||!data.access_token) throw new Error(data.error_description||data.error||"Could not obtain service token.");
  accessToken=data.access_token; accessExp=now+Number(data.expires_in||3600);
  return accessToken;
}

async function verifyUser(request){
  const authz=request.headers.get("authorization")||"";
  if(!authz.startsWith("Bearer ")) throw new Error("Missing Firebase ID token.");
  const idToken=authz.slice(7);
  const res=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(env("FIREBASE_WEB_API_KEY"))}`,{
    method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({idToken})
  });
  const data=await res.json().catch(()=>({}));
  if(!res.ok||!data.users?.length) throw new Error(data.error?.message||"Invalid Firebase ID token.");
  return {uid:data.users[0].localId};
}

const pid=()=>serviceAccount().project_id;
const docName=(collection,id)=>`projects/${pid()}/databases/(default)/documents/${collection}/${id}`;
const docUrl=(collection,id)=>`https://firestore.googleapis.com/v1/${docName(collection,id)}`;

function decodeValue(v){
  if(!v)return null;
  if("stringValue" in v)return v.stringValue;
  if("booleanValue" in v)return !!v.booleanValue;
  if("integerValue" in v)return Number(v.integerValue);
  if("doubleValue" in v)return Number(v.doubleValue);
  if("timestampValue" in v)return v.timestampValue;
  if("nullValue" in v)return null;
  if("arrayValue" in v)return (v.arrayValue.values||[]).map(decodeValue);
  if("mapValue" in v)return Object.fromEntries(Object.entries(v.mapValue.fields||{}).map(([k,x])=>[k,decodeValue(x)]));
  return null;
}
function encodeValue(v){
  if(v===null||v===undefined)return {nullValue:null};
  if(typeof v==="string")return {stringValue:v};
  if(typeof v==="boolean")return {booleanValue:v};
  if(typeof v==="number")return Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v};
  if(Array.isArray(v))return {arrayValue:{values:v.map(encodeValue)}};
  if(typeof v==="object")return {mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,x])=>[k,encodeValue(x)]))}};
  return {stringValue:String(v)};
}
function encodeFields(obj){ return Object.fromEntries(Object.entries(obj).map(([k,v])=>[k,encodeValue(v)])); }

async function getDocument(collection,id){
  const token=await getAccessToken();
  const res=await fetch(docUrl(collection,id),{headers:{authorization:`Bearer ${token}`}});
  if(res.status===404)return null;
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(data.error?.message||`Firestore get failed (${res.status}).`);
  return {id,...Object.fromEntries(Object.entries(data.fields||{}).map(([k,v])=>[k,decodeValue(v)]))};
}
async function runArrayContains(collection,field,value){
  const token=await getAccessToken();
  const res=await fetch(`https://firestore.googleapis.com/v1/projects/${pid()}/databases/(default)/documents:runQuery`,{
    method:"POST",
    headers:{authorization:`Bearer ${token}`,"content-type":"application/json"},
    body:JSON.stringify({structuredQuery:{
      from:[{collectionId:collection}],
      where:{fieldFilter:{field:{fieldPath:field},op:"ARRAY_CONTAINS",value:encodeValue(value)}}
    }})
  });
  const data=await res.json().catch(()=>[]);
  if(!res.ok)throw new Error(data.error?.message||`Firestore query failed (${res.status}).`);
  return (Array.isArray(data)?data:[]).filter(x=>x.document).map(x=>({
    id:(x.document.name||"").split("/").pop(),
    ...Object.fromEntries(Object.entries(x.document.fields||{}).map(([k,v])=>[k,decodeValue(v)]))
  }));
}
function updateWrite(collection,id,fields){
  return {update:{name:docName(collection,id),fields:encodeFields(fields)},updateMask:{fieldPaths:Object.keys(fields)}};
}
function deleteWrite(collection,id){ return {delete:docName(collection,id)}; }
async function commit(writes){
  if(!writes.length)return;
  const token=await getAccessToken();
  const res=await fetch(`https://firestore.googleapis.com/v1/projects/${pid()}/databases/(default)/documents:commit`,{
    method:"POST",
    headers:{authorization:`Bearer ${token}`,"content-type":"application/json"},
    body:JSON.stringify({writes})
  });
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(data.error?.message||`Firestore commit failed (${res.status}).`);
}
const without=(arr,uid)=>[...new Set((arr||[]).filter(x=>x!==uid))];

export default async (request)=>{
  if(request.method==="OPTIONS")return new Response(null,{status:204});
  if(request.method!=="POST")return json(405,{error:"Method not allowed"});
  try{
    const caller=await verifyUser(request);
    const callerProfile=await getDocument("users",caller.uid);
    if(!callerProfile||callerProfile.orgId!=="asbavol"||callerProfile.role!=="admin"){
      return json(403,{error:"Solo un Administrador puede eliminar usuarios."});
    }

    const body=await request.json().catch(()=>({}));
    const uid=String(body.uid||"").trim();
    if(!uid)return json(400,{error:"uid is required."});
    if(uid===caller.uid)return json(409,{error:"No puedes eliminar tu propia cuenta de Administrador."});

    const target=await getDocument("users",uid);
    if(!target)return json(404,{error:"No se encontró el usuario."});
    if(target.orgId!=="asbavol")return json(403,{error:"El usuario pertenece a otra organización."});
    const callerSuper=callerProfile.isSuperAdmin===true;
    if(target.role==="admin"&&target.isSuperAdmin===true)return json(403,{error:"Las cuentas Super Administrador están protegidas y no pueden eliminarse desde VolleyCore."});
    if(target.role==="admin"&&!callerSuper)return json(403,{error:"Solo un Super Administrador puede eliminar a otro Administrador."});

    const [players,privates,families,charges]=await Promise.all([
      runArrayContains("players","linkedUserIds",uid),
      runArrayContains("playerPrivate","linkedUserIds",uid),
      runArrayContains("families","memberUserIds",uid),
      runArrayContains("charges","userIds",uid)
    ]);

    const writes=[];
    players.forEach(x=>writes.push(updateWrite("players",x.id,{linkedUserIds:without(x.linkedUserIds,uid)})));
    privates.forEach(x=>writes.push(updateWrite("playerPrivate",x.id,{linkedUserIds:without(x.linkedUserIds,uid)})));
    families.forEach(x=>writes.push(updateWrite("families",x.id,{memberUserIds:without(x.memberUserIds,uid)})));
    charges.forEach(x=>writes.push(updateWrite("charges",x.id,{userIds:without(x.userIds,uid)})));
    writes.push(deleteWrite("users",uid));
    await commit(writes);

    const token=await getAccessToken();
    const authRes=await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(pid())}/accounts:delete`,{
      method:"POST",
      headers:{authorization:`Bearer ${token}`,"content-type":"application/json"},
      body:JSON.stringify({localId:uid})
    });
    const authData=await authRes.json().catch(()=>({}));
    if(!authRes.ok){
      console.error("Authentication delete failed",authRes.status,authData);
      return json(502,{error:authData.error?.message||"Firestore fue limpiado, pero no se pudo borrar la cuenta de Authentication."});
    }

    return json(200,{ok:true,uid});
  }catch(error){
    console.error("admin-user-delete error",error);
    return json(500,{error:error.message||"Unexpected server error."});
  }
};
