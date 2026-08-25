import {
  json, verifyFirebaseUser, getDocument, queryDocuments, commitWrites,
  updateWrite, deleteWrite, getServiceAccessToken, projectId
} from "./_firebase-rest.mjs";

const uniq = xs => [...new Set(xs||[])];

export default async (request) => {
  if (request.method === "OPTIONS") return new Response(null,{status:204});
  if (request.method !== "POST") return json(405,{error:"Method not allowed"});

  try {
    const caller = await verifyFirebaseUser(request);
    const callerProfile = await getDocument("users",caller.uid);
    if (!callerProfile || callerProfile.orgId !== "asbavol" || callerProfile.role !== "admin") {
      return json(403,{error:"Only an Administrator can delete users."});
    }

    const body = await request.json().catch(()=>({}));
    const targetUid = String(body.uid||"").trim();
    if (!targetUid) return json(400,{error:"uid is required."});
    if (targetUid === caller.uid) {
      return json(409,{error:"You cannot delete your own Administrator account from VolleyCore."});
    }

    const target = await getDocument("users",targetUid);
    if (!target) return json(404,{error:"User profile not found."});
    if (target.orgId !== "asbavol") return json(403,{error:"User belongs to another organization."});

    const [players,families,privatePlayers,charges] = await Promise.all([
      queryDocuments("players","linkedUserIds","ARRAY_CONTAINS",targetUid),
      queryDocuments("families","memberUserIds","ARRAY_CONTAINS",targetUid),
      queryDocuments("playerPrivate","linkedUserIds","ARRAY_CONTAINS",targetUid),
      queryDocuments("charges","userIds","ARRAY_CONTAINS",targetUid),
    ]);

    const writes=[];

    for (const p of players) {
      writes.push(updateWrite("players",p.id,{
        linkedUserIds:uniq((p.linkedUserIds||[]).filter(x=>x!==targetUid))
      },["linkedUserIds"]));
    }
    for (const p of privatePlayers) {
      writes.push(updateWrite("playerPrivate",p.id,{
        linkedUserIds:uniq((p.linkedUserIds||[]).filter(x=>x!==targetUid))
      },["linkedUserIds"]));
    }
    for (const f of families) {
      writes.push(updateWrite("families",f.id,{
        memberUserIds:uniq((f.memberUserIds||[]).filter(x=>x!==targetUid))
      },["memberUserIds"]));
    }
    for (const c of charges) {
      writes.push(updateWrite("charges",c.id,{
        userIds:uniq((c.userIds||[]).filter(x=>x!==targetUid))
      },["userIds"]));
    }

    writes.push(deleteWrite("users",targetUid));
    if (writes.length) await commitWrites(writes);

    const token = await getServiceAccessToken();
    const authRes = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(projectId())}/accounts:delete`,{
      method:"POST",
      headers:{authorization:`Bearer ${token}`,"content-type":"application/json"},
      body:JSON.stringify({localId:targetUid}),
    });
    const authData = await authRes.json().catch(()=>({}));
    if (!authRes.ok) {
      console.error("Firebase Auth delete failed",authRes.status,authData);
      return json(502,{
        error:authData.error?.message||"The Firestore profile was removed, but Firebase Authentication deletion failed. Review the function logs."
      });
    }

    return json(200,{
      ok:true,
      uid:targetUid,
      unlinkedPlayers:players.length,
      unlinkedFamilies:families.length,
      unlinkedCharges:charges.length
    });
  } catch(error) {
    console.error(error);
    return json(500,{error:error.message||"Unexpected server error."});
  }
};
