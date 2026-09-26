import { redirect } from "next/navigation";
import { MediaLibrary } from "@/components/media/media-library";
import { createClient } from "@/lib/supabase/server";
export const instant = false;
export default async function MediaPage() {
 const supabase=await createClient(); const {data:claims,error:claimsError}=await supabase.auth.getClaims(); if(claimsError||!claims?.claims?.sub) redirect("/auth/login");
 const userId=String(claims.claims.sub); const {data:files,error}=await supabase.storage.from("social-media-assets").list(userId,{limit:1000,sortBy:{column:"created_at",order:"desc"}});
 const initialFiles=(files??[]).filter(f=>f.id&&f.name).map(f=>({path:userId+"/"+f.name,name:f.name,size:f.metadata?.size??0,type:f.metadata?.mimetype??"application/octet-stream",createdAt:f.created_at??null,updatedAt:f.updated_at??null}));
 return <div className="space-y-8"><section><p className="text-sm font-medium text-primary">Media library</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Your media</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Keep your private images and videos organized, preview them, and reuse them in future posts.</p></section>{error?<div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">We could not load your media library. Please refresh and try again.</div>:<MediaLibrary initialFiles={initialFiles}/>}</div>;
}