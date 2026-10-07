import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

/** Wait for every previously issued two-hour upload capability to expire. */
export async function cleanupRejectedDocuments(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase.rpc("list_rejected_document_cleanup", { batch_size: 5 });
  if (error) return 0;
  let cleaned = 0;
  for (const document of (data ?? []) as { document_id: string; bucket: string; object_path: string }[]) {
    const removed = await supabase.storage.from(document.bucket).remove([document.object_path]);
    if (removed.error) continue;
    const completed = await supabase.rpc("complete_rejected_document_cleanup", { target_document_id: document.document_id });
    if (!completed.error) cleaned++;
  }
  return cleaned;
}
