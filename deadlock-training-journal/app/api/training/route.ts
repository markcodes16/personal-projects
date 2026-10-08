import { getChatGPTUser } from "@/app/chatgpt-auth";
import { storeDb } from "@/db/store";
import { z } from "zod";
export const dynamic = "force-dynamic";
const session = z.object({id:z.string().uuid(),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!Number.isNaN(Date.parse(v))),hero:z.enum(["Mina","Warden","Abrams","Pocket"]),lesson:z.number().int().min(1).max(24),minutes:z.number().int().min(1).max(1440),matches:z.number().int().min(0).max(100),successes:z.number().int().min(0).max(10000),opportunities:z.number().int().min(0).max(10000),focus:z.number().int().min(1).max(5),notes:z.string().max(6000),matchId:z.string().max(120),patch:z.string().max(80)}).refine(v=>v.successes<=v.opportunities,{message:"Successes cannot exceed opportunities."});
const lesson=z.object({id:z.number().int().min(1).max(24),status:z.enum(["Not started","Studying","Practicing","Gate passed"]),notes:z.string().max(6000)});
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{"Cache-Control":"no-store"}});
export async function GET(){
 const user=await getChatGPTUser();if(!user)return json({error:"Sign in to load your progress."},401);
 try {const rows=await storeDb().prepare("SELECT kind, data FROM training_records WHERE user_id = ? ORDER BY updated_at DESC").bind(user.userId).all<{kind:string,data:string}>();
 return json({sessions:rows.results.filter(r=>r.kind==="session").map(r=>JSON.parse(r.data)),lessons:rows.results.filter(r=>r.kind==="lesson").map(r=>JSON.parse(r.data))});
 }catch(e){console.error("Training load failed",e);return json({error:"Your progress could not be loaded. Please retry."},503)}
}
export async function POST(req:Request){
 const user=await getChatGPTUser();if(!user)return json({error:"Sign in to save your progress."},401);
 const origin=req.headers.get("origin");if(origin&&origin!==new URL(req.url).origin)return json({error:"Invalid request origin."},403);
 let raw:any;try{if(Number(req.headers.get("content-length"))>20000)return json({error:"Entry is too large."},413);raw=await req.json()}catch{return json({error:"Invalid entry."},400)}
 const parsed=raw.kind==="session"?session.safeParse(raw.data):raw.kind==="lesson"?lesson.safeParse(raw.data):null;
 if(!parsed?.success)return json({error:parsed?.error.issues[0]?.message??"Invalid entry."},400);
 try{const d=parsed.data;await storeDb().prepare("INSERT INTO training_records (user_id, kind, id, data, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id, kind, id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at").bind(user.userId,raw.kind,String(d.id),JSON.stringify(d),new Date().toISOString()).run();return json({ok:true,data:d});}
 catch(e){console.error("Training save failed",e);return json({error:"Could not save. Your changes are still here; please retry."},503)}
}
