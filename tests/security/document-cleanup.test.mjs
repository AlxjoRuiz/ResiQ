import assert from "node:assert/strict";
import test from "node:test";
import { cleanupRejectedDocuments } from "../../supabase/functions/process-email-jobs/cleanup-documents.ts";
test("quota is released only after successful Storage removal", async () => {
 const events=[];
 const client={rpc:async(name)=>{events.push(name);return name==='list_rejected_document_cleanup'?{data:[{document_id:'id',bucket:'private-documents',object_path:'test.pdf'}],error:null}:{error:null};},storage:{from:()=>({remove:async()=>{events.push('remove');return {error:null};}})}};
 assert.equal(await cleanupRejectedDocuments(client),1);
 assert.deepEqual(events,['list_rejected_document_cleanup','remove','complete_rejected_document_cleanup']);
 events.length=0;
 client.storage.from=()=>({remove:async()=>({error:{message:'test failure'}})});
 assert.equal(await cleanupRejectedDocuments(client),0);
 assert.deepEqual(events,['list_rejected_document_cleanup']);
});
