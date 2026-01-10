import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // List all buckets
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      throw new Error(`Erro ao listar buckets: ${bucketsError.message}`);
    }

    const allFiles: Array<{
      bucket: string;
      path: string;
      publicUrl: string;
      size: number;
      createdAt: string;
    }> = [];

    // For each bucket, list all files recursively
    for (const bucket of buckets || []) {
      const files = await listAllFiles(supabase, bucket.id, "");
      
      for (const file of files) {
        const { data: urlData } = supabase.storage
          .from(bucket.id)
          .getPublicUrl(file.name);
        
        allFiles.push({
          bucket: bucket.id,
          path: file.name,
          publicUrl: urlData.publicUrl,
          size: file.metadata?.size || 0,
          createdAt: file.created_at || "",
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        totalFiles: allFiles.length,
        buckets: buckets?.map(b => b.id) || [],
        files: allFiles,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

async function listAllFiles(
  supabase: any,
  bucketId: string,
  folder: string
): Promise<any[]> {
  const allFiles: any[] = [];
  
  const { data: items, error } = await supabase.storage
    .from(bucketId)
    .list(folder, { limit: 1000 });

  if (error) {
    console.error(`Erro ao listar ${bucketId}/${folder}:`, error);
    return [];
  }

  for (const item of items || []) {
    const fullPath = folder ? `${folder}/${item.name}` : item.name;
    
    // If it's a folder (no metadata), recurse into it
    if (!item.metadata) {
      const subFiles = await listAllFiles(supabase, bucketId, fullPath);
      allFiles.push(...subFiles);
    } else {
      allFiles.push({ ...item, name: fullPath });
    }
  }

  return allFiles;
}
