import { NextResponse } from 'next/server';
import { ensureCatalogSchema, getDb } from '../../../lib/db';

export async function GET(){
  const sql=getDb();
  if(!sql) return NextResponse.json({enabled:false,products:[]});
  try{
    await ensureCatalogSchema();
    const products=await sql`SELECT * FROM products ORDER BY updated_at DESC`;
    return NextResponse.json({enabled:true,products});
  }catch{
    return NextResponse.json({enabled:false,products:[],error:'База данных пока не подключена.'},{status:503});
  }
}
