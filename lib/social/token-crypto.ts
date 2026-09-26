import "server-only";
import { encryptTokenWithKey, decryptTokenWithKey } from "./token-crypto-core";
function getKey() { const raw=process.env.SOCIAL_OAUTH_ENCRYPTION_KEY; if(!raw) throw new Error("Missing SOCIAL_OAUTH_ENCRYPTION_KEY."); const key=Buffer.from(raw,"base64"); if(key.length!==32) throw new Error("SOCIAL_OAUTH_ENCRYPTION_KEY must be a base64-encoded 32-byte key."); return key; }
export function encryptToken(value:string){ return encryptTokenWithKey(value,getKey()); }
export function decryptToken(value:string){ return decryptTokenWithKey(value,getKey()); }
