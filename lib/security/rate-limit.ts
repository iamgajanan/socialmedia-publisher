import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
export async function consumeRateLimit(key:string,limit:number,windowSeconds:number){const admin=createAdminClient();const {data,error}=await admin.rpc("socialmedia_consume_rate_limit",{p_key:key.slice(0,240),p_limit:limit,p_window_seconds:windowSeconds});if(error)throw new Error(`Rate limit check failed: ${error.message}`);return data===true;}
export async function requestFingerprint(){const store=await headers();return store.get("x-forwarded-for")?.split(",")[0]?.trim()||store.get("x-real-ip")?.trim()||"unknown";}