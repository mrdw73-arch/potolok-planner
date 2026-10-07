import { NextResponse } from 'next/server';
import { ensureCatalogSchema,getDb } from '../../../../lib/db';

export async function GET(){
  const sql=getDb();
  if(!sql)return NextResponse.json({enabled:false,runs:[]});
  try{
    await ensureCatalogSchema();
    const runs=await sql`SELECT id,provider,source,status,found,saved,updated,errors,error_message,started_at,finished_at FROM import_runs ORDER BY started_at DESC LIMIT 50`;
    return NextResponse.json({enabled:true,runs});
  }catch(error){
    return NextResponse.json({enabled:false,runs:[],error:error instanceof Error?error.message:'Не удалось получить журнал импорта.'},{status:503});
  }
}
