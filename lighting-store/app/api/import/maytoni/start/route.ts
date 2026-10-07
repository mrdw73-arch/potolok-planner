import { NextRequest, NextResponse } from "next/server";
import { start } from "workflow/api";
import { createImportRunWithUrls, getActiveImportRun } from "../../../../../lib/db";
import { runMaytoniImport } from "../../../../../workflows/maytoni-import";

export const maxDuration=60;

const allowedHosts=new Set(["maytoni.ru","www.maytoni.ru","new-maytoni.maytoni.ru"]);

export async function POST(request:NextRequest){
  try{
    const body=await request.json().catch(()=>({}));
    const section=String(body?.url||"https://maytoni.ru/catalog/decorative/").trim();
    const parsed=new URL(section);
    if(parsed.protocol!=="https:"||!allowedHosts.has(parsed.hostname)||!parsed.pathname.startsWith("/catalog/")){
      return NextResponse.json({error:"Разрешён только HTTPS-каталог Maytoni."},{status:400});
    }

    const active=await getActiveImportRun("Maytoni");
    if(active) return NextResponse.json({runId:active.id,found:active.found,status:"already_running"});

    const discovery=new URL("/api/import/maytoni/section",request.url);
    discovery.searchParams.set("url",section);
    const response=await fetch(discovery,{cache:"no-store"});
    const data=await response.json().catch(()=>({}));
    if(!response.ok) return NextResponse.json({error:String(data?.error||"Не удалось получить список товаров Maytoni.")},{status:502});

    const urls=Array.isArray(data?.urls)?data.urls.map((x:unknown)=>String(x)).filter(Boolean):[];
    if(!urls.length) return NextResponse.json({error:"Maytoni не вернул ссылки на товары."},{status:422});

    const runId=await createImportRunWithUrls("Maytoni",section,urls);
    if(!runId) return NextResponse.json({error:"DATABASE_URL не настроен."},{status:503});

    const baseUrl=new URL(request.url).origin;
    const run=await start(runMaytoniImport,[runId,baseUrl]);

    return NextResponse.json({runId,workflowRunId:run.runId,found:urls.length,status:"started"});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Не удалось запустить импорт Maytoni."},{status:500});
  }
}
