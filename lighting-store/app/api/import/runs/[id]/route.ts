import { NextResponse } from "next/server";
import { getImportRun } from "../../../../../lib/db";

export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const {id}=await params;
    const run=await getImportRun(id);
    if(!run) return NextResponse.json({error:"Импорт не найден."},{status:404});
    return NextResponse.json({run});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Не удалось получить статус импорта."},{status:500});
  }
}
