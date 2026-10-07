import { NextRequest, NextResponse } from "next/server";

export const maxDuration=60;

export async function GET(request:NextRequest){
  const secret=process.env.CRON_SECRET;
  const auth=request.headers.get("authorization");
  if(!secret||auth!==`Bearer ${secret}`) return NextResponse.json({error:"Unauthorized"},{status:401});
  const startUrl=new URL("/api/import/maytoni/start",request.url);
  const response=await fetch(startUrl,{method:"POST",headers:{"content-type":"application/json","authorization":auth},body:JSON.stringify({url:"https://maytoni.ru/catalog/decorative/"})});
  const data=await response.json().catch(()=>({}));
  return NextResponse.json(data,{status:response.status});
}
