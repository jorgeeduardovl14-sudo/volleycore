import { json, getDocument, commitWrites, updateWrite, transformServerTimestampWrite } from "./_firebase-rest.mjs";

function normalizePaidAmount(data){
  const minor=Number(data.amountTotal ?? data.receivedAmount ?? data.amount ?? 0);
  return Math.round(minor)/100;
}
function safeId(s){return String(s||"unknown").replace(/[^a-zA-Z0-9_.:-]/g,"_")}

export default async (request)=>{
  if(request.method!=="POST")return json(405,{error:"Method not allowed"});
  try{
    const expected=process.env.ONVO_WEBHOOK_SECRET;
    if(!expected)return json(503,{error:"Webhook secret is not configured."});
    const received=request.headers.get("x-webhook-secret")||"";
    if(received!==expected)return json(401,{error:"Invalid webhook secret."});

    const event=await request.json();
    const type=String(event.type||""),data=event.data||{},metadata=data.metadata||{};
    const chargeId=metadata.chargeId||"",objectId=data.id||"unknown";
    const eventId=safeId(`${type}:${objectId}`);

    if(!chargeId){
      try{
        await commitWrites([
          updateWrite("onvoWebhookEvents",eventId,{type,objectId,chargeId:null,processed:true,note:"No VolleyCore chargeId in metadata."},null,{exists:false}),
          transformServerTimestampWrite("onvoWebhookEvents",eventId,"receivedAt")
        ]);
      }catch(e){if(e.status!==409)throw e}
      return json(200,{received:true,ignored:true});
    }

    const charge=await getDocument("charges",chargeId);
    if(!charge)return json(200,{received:true,ignored:true,note:"Charge not found."});

    const writes=[
      updateWrite("onvoWebhookEvents",eventId,{type,objectId,chargeId,processed:true},null,{exists:false}),
      transformServerTimestampWrite("onvoWebhookEvents",eventId,"receivedAt")
    ];

    if(type==="checkout-session.succeeded" && data.paymentStatus==="paid"){
      const paidCRC=normalizePaidAmount(data),chargeAmount=Number(charge.amount||0),previousPaid=Number(charge.paidAmount||0);
      const newPaid=Math.min(chargeAmount,previousPaid+paidCRC),status=newPaid>=chargeAmount?"paid":"partial";
      writes.push(updateWrite("onvoPayments",objectId,{
        orgId:charge.orgId||metadata.orgId||"asbavol",chargeId,playerId:charge.playerId||metadata.playerId||"",
        userId:metadata.userId||"",month:charge.month||metadata.month||"",amount:paidCRC,
        currency:data.currency||"CRC",status:"paid",mode:data.mode||"test",checkoutSessionId:objectId,
        paymentIntentId:data.paymentIntentId||"",customerId:data.customerId||"",customerEmail:data.customer?.email||"",
        rawPaymentStatus:data.paymentStatus||""
      },null,{exists:false}));
      writes.push(transformServerTimestampWrite("onvoPayments",objectId,"paidAt"));
      writes.push(transformServerTimestampWrite("onvoPayments",objectId,"createdAt"));
      writes.push(updateWrite("charges",chargeId,{
        paidAmount:newPaid,status,onvoPaymentStatus:"paid",onvoLastCheckoutSessionId:objectId,onvoLastPaymentIntentId:data.paymentIntentId||null
      },["paidAmount","status","onvoPaymentStatus","onvoLastCheckoutSessionId","onvoLastPaymentIntentId"]));
      writes.push(transformServerTimestampWrite("charges",chargeId,"updatedAt"));
    }else if(type==="payment-intent.deferred"){
      writes.push(updateWrite("charges",chargeId,{onvoPaymentStatus:"processing"},["onvoPaymentStatus"]));
      writes.push(transformServerTimestampWrite("charges",chargeId,"updatedAt"));
    }else if(type==="payment-intent.failed"){
      writes.push(updateWrite("charges",chargeId,{onvoPaymentStatus:"failed"},["onvoPaymentStatus"]));
      writes.push(transformServerTimestampWrite("charges",chargeId,"updatedAt"));
    }

    try{
      await commitWrites(writes);
    }catch(e){
      if(e.status===409)return json(200,{received:true,duplicate:true});
      throw e;
    }
    return json(200,{received:true});
  }catch(error){
    console.error(error);
    return json(500,{error:error.message||"Webhook processing failed."});
  }
};
