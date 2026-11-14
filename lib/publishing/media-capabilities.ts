export type MediaKind = "image" | "video" | "document";
export type MediaCapability = { minFiles: number; maxFiles: number; imageTypes: string[]; videoTypes: string[] };
export type PlatformMediaIssue = { platform: string; message: string };
const ALL_IMAGE_TYPES = ["image/jpeg","image/png","image/webp","image/gif","image/avif","image/tiff","image/bmp"];
const ALL_VIDEO_TYPES = ["video/mp4","video/webm","video/quicktime","video/x-matroska"];
const LINKEDIN_IMAGE_TYPES = ["image/jpeg","image/png"];
const LINKEDIN_VIDEO_TYPES = ["video/mp4","video/quicktime"];
const PINTEREST_IMAGE_TYPES = ["image/jpeg","image/png","image/webp"];
const BLUESKY_IMAGE_TYPES = ["image/jpeg","image/png","image/webp"];
const GOOGLE_BUSINESS_IMAGE_TYPES = ["image/jpeg","image/png"];
export const PLATFORM_MEDIA_CAPABILITIES: Record<string,MediaCapability> = {
 facebook:{minFiles:0,maxFiles:10,imageTypes:ALL_IMAGE_TYPES,videoTypes:ALL_VIDEO_TYPES},
 instagram:{minFiles:1,maxFiles:10,imageTypes:ALL_IMAGE_TYPES,videoTypes:["video/mp4","video/quicktime"]},
 threads:{minFiles:0,maxFiles:20,imageTypes:["image/jpeg","image/png"],videoTypes:["video/mp4","video/quicktime"]},
 youtube:{minFiles:1,maxFiles:1,imageTypes:[],videoTypes:ALL_VIDEO_TYPES},
 tiktok:{minFiles:1,maxFiles:1,imageTypes:[],videoTypes:["video/mp4","video/quicktime"]},
 linkedin:{minFiles:0,maxFiles:20,imageTypes:LINKEDIN_IMAGE_TYPES,videoTypes:LINKEDIN_VIDEO_TYPES},
 x:{minFiles:0,maxFiles:0,imageTypes:[],videoTypes:[]},
 pinterest:{minFiles:1,maxFiles:1,imageTypes:PINTEREST_IMAGE_TYPES,videoTypes:[]},
 bluesky:{minFiles:0,maxFiles:4,imageTypes:BLUESKY_IMAGE_TYPES,videoTypes:[]},
 google_business_profile:{minFiles:0,maxFiles:1,imageTypes:GOOGLE_BUSINESS_IMAGE_TYPES,videoTypes:[]},
 reddit:{minFiles:0,maxFiles:20,imageTypes:ALL_IMAGE_TYPES,videoTypes:ALL_VIDEO_TYPES}
};
const DEFAULT_CAPABILITY:MediaCapability={minFiles:0,maxFiles:20,imageTypes:ALL_IMAGE_TYPES,videoTypes:ALL_VIDEO_TYPES};
function intersect(values:string[][]):string[]{return values.length?values.reduce((a,b)=>a.filter(v=>b.includes(v))):[];}
function union(values:string[][]):string[]{return [...new Set(values.flat())];}
export function getMediaCapability(platforms:string[]):MediaCapability{const c=platforms.map(p=>PLATFORM_MEDIA_CAPABILITIES[p]??DEFAULT_CAPABILITY);if(!c.length)return DEFAULT_CAPABILITY;return{minFiles:Math.max(...c.map(x=>x.minFiles)),maxFiles:Math.min(...c.map(x=>x.maxFiles)),imageTypes:intersect(c.map(x=>x.imageTypes)),videoTypes:intersect(c.map(x=>x.videoTypes))};}
export function getUploadMediaCapability(platforms:string[]):MediaCapability{const c=platforms.map(p=>PLATFORM_MEDIA_CAPABILITIES[p]??DEFAULT_CAPABILITY);if(!c.length)return DEFAULT_CAPABILITY;return{minFiles:0,maxFiles:Math.max(...c.map(x=>x.maxFiles)),imageTypes:[...union(c.map(x=>x.imageTypes)),...(platforms.includes("linkedin")?["application/pdf"]:[])],videoTypes:union(c.map(x=>x.videoTypes))};}
export function mediaTypeFromPath(path:string):string{const p=path.toLowerCase();if(p.endsWith(".pdf"))return"application/pdf";if(p.endsWith(".jpg")||p.endsWith(".jpeg"))return"image/jpeg";if(p.endsWith(".png"))return"image/png";if(p.endsWith(".webp"))return"image/webp";if(p.endsWith(".gif"))return"image/gif";if(p.endsWith(".avif"))return"image/avif";if(p.endsWith(".tif")||p.endsWith(".tiff"))return"image/tiff";if(p.endsWith(".bmp"))return"image/bmp";if(p.endsWith(".mp4"))return"video/mp4";if(p.endsWith(".webm"))return"video/webm";if(p.endsWith(".mov"))return"video/quicktime";if(p.endsWith(".mkv"))return"video/x-matroska";return"application/octet-stream";}
function forPlatform(platform:string,types:string[]):string[]{const docs=types.filter(t=>t==="application/pdf");if(platform==="linkedin"&&docs.length)return docs;return types.filter(t=>t!=="application/pdf");}
export function getPlatformMediaIssues(platforms:string[],mediaTypes:string[]):PlatformMediaIssue[]{return platforms.flatMap(platform=>{const c=PLATFORM_MEDIA_CAPABILITIES[platform]??DEFAULT_CAPABILITY;const types=forPlatform(platform,mediaTypes);if(!types.length)return c.minFiles?[{platform,message:platform+" requires media before publishing."}]:[];if(platform==="reddit")return[{platform,message:"OmniSocial's current Reddit integration supports text posts only. Remove media or deselect Reddit."}];if(platform==="linkedin"&&types[0]==="application/pdf")return types.length>1?[{platform,message:"LinkedIn supports one PDF document per post."}]:[];if(types.length>c.maxFiles)return[{platform,message:platform+" supports at most "+c.maxFiles+" media files per post."}];if(platform==="linkedin"&&types.some(t=>t.startsWith("video/"))&&types.length>1)return[{platform,message:"LinkedIn video posts support one video at a time."}];if(platform==="linkedin"&&types.some(t=>t.startsWith("image/"))&&types.some(t=>t.startsWith("video/")))return[{platform,message:"LinkedIn posts cannot mix images and videos."}];if(platform==="instagram"&&types.length>1&&types.some(t=>t.startsWith("image/"))&&types.some(t=>t.startsWith("video/")))return[{platform,message:"Instagram carousels cannot mix images and videos in the current publishing flow."}];if(platform==="youtube"&&types.some(t=>t.startsWith("image/")))return[{platform,message:"OmniSocial's current YouTube publishing integration supports video uploads only. Remove YouTube to publish this image post."}];if(["pinterest","google_business_profile","bluesky"].includes(platform)&&types.some(t=>t.startsWith("video/")))return[{platform,message:platform==="pinterest"?"OmniSocial's current Pinterest integration supports image Pins only. Remove the video or deselect Pinterest.":platform==="google_business_profile"?"Google Business Profile currently supports image media only in OmniSocial. Remove the video or deselect Google Business Profile.":"OmniSocial's current Bluesky integration supports image media only. Remove the video or deselect Bluesky."}];const bad=types.find(t=>!c.imageTypes.includes(t)&&!c.videoTypes.includes(t));return bad?[{platform,message:bad+" is not supported by "+platform+"."}]:[];});}
export function validateMediaSelection(platforms:string[],mediaTypes:string[]):string|null{for(const platform of platforms){const c=PLATFORM_MEDIA_CAPABILITIES[platform]??DEFAULT_CAPABILITY;const types=forPlatform(platform,mediaTypes);if(platform==="linkedin"&&types[0]==="application/pdf"){if(types.length>1)return"LinkedIn supports one PDF document per post.";continue;}if(types.length<c.minFiles)return platform+" requires at least "+c.minFiles+" "+(c.videoTypes.length&&!c.imageTypes.length?"video":"image or video")+".";if(types.length>c.maxFiles)return platform+" supports at most "+c.maxFiles+" media files per post.";if(platform==="linkedin"&&types.some(t=>t.startsWith("video/"))&&types.length>1)return"LinkedIn video posts support one video at a time.";if(platform==="linkedin"&&types.some(t=>t.startsWith("image/"))&&types.some(t=>t.startsWith("video/")))return"LinkedIn posts cannot mix images and videos.";for(const type of types)if(!c.imageTypes.includes(type)&&!c.videoTypes.includes(type))return type+" is not supported by "+platform+".";}return null;}


/**
 * Threads currently accepts one media asset per post. Keep the first slide
 * (the carousel cover) for Threads while preserving the full selection for
 * platforms that support multi-image posts.
 */
export function getMediaPathsForPlatform(platform: string, mediaPaths: string[]): string[] {
  return mediaPaths;
}

export function getMediaTypesForPlatform(platform: string, mediaTypes: string[]): string[] {
  return mediaTypes;
}
