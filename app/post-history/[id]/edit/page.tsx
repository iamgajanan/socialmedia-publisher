import { redirect } from "next/navigation";
import { ArrowLeft, Edit3 } from "lucide-react";
import Link from "next/link";

import { PostComposer } from "@/components/create-post/post-composer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
 const { id } = await params;
 const supabase=await createClient();
 const {data:claims,error:claimsError}=await supabase.auth.getClaims();
 if(claimsError||!claims?.claims?.sub) redirect("/auth/login");
 const userId=String(claims.claims.sub);
 const [{data:post},{data:accounts},{data:profile},{data:links}]=await Promise.all([
   supabase.from("socialmedia_posts").select("id,content,status,scheduled_at,media_urls").eq("id",id).eq("profile_id",userId).maybeSingle(),
   supabase.from("socialmedia_social_accounts").select("id,platform,account_name,username,avatar_url").eq("profile_id",userId).eq("status","connected").order("created_at",{ascending:false}),
   supabase.from("socialmedia_profiles").select("timezone").eq("id",userId).maybeSingle(),
   supabase.from("socialmedia_post_platforms").select("social_account_id").eq("post_id",id),
 ]);
 if(!post||post.status==="published"||post.status==="publishing") redirect(`/post-history/${id}`);
 const accountIds=(links??[]).map(x=>x.social_account_id);
 const mediaPaths=Array.isArray(post.media_urls)?post.media_urls.filter((x):x is string=>typeof x==="string"):[];
 // This post was fetched with profile_id=userId. Only inspect objects under the same
 // user prefix, using the admin client because signed uploads are created server-side
 // and may not have an owner_id visible to the authenticated Storage SELECT policy.
 const ownedPaths=mediaPaths.filter((path)=>path.startsWith(`${userId}/`)&&!path.includes(".."));
 const admin=createAdminClient();
 const {data:storedMedia,error:storageError}=ownedPaths.length
   ? await admin.storage.from("social-media-assets").list(userId,{limit:1000,sortBy:{column:"created_at",order:"desc"}})
   : {data:[],error:null};
 const storageListing=storageError?[]:(storedMedia??[]);
 const media=mediaPaths.map((path)=>{
   const isOwned=ownedPaths.includes(path);
   const storageName=isOwned?path.slice(userId.length+1):"";
   const file=storageListing.find((item)=>item.name===storageName);
   const available=Boolean(isOwned&&file?.name);
   return {path,name:file?.name?.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i,"")??(storageName||path.split("/").pop()||path),size:Number(file?.metadata?.size??0),type:String(file?.metadata?.mimetype??""),available};
 });
 return <div className="space-y-6"><div className="flex items-center justify-between gap-3"><Button asChild variant="ghost"><Link href={`/post-history/${id}`}><ArrowLeft/>Back</Link></Button><Badge variant="secondary"><Edit3 className="mr-1.5 size-3.5"/>Edit post</Badge></div><PostComposer accounts={accounts??[]} timezone={profile?.timezone??"Asia/Kolkata"} initialPost={{id:post.id,content:post.content,accountIds,mediaPaths,media,mode:post.status==="scheduled"?"schedule":"draft",scheduledAt:post.scheduled_at}}/></div>;
}
