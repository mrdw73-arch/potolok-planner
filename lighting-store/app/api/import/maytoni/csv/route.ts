import { NextRequest, NextResponse } from 'next/server';
import { ensureCatalogSchema,finishImportRun,getDb,startImportRun,upsertProducts } from '../../../../../lib/db';

export async function POST(request:NextRequest){
  try{
    const body=await request.json();
    const products=Array.isArray(body?.products)?body.products:[];
    if(!products.length||products.length>200)return NextResponse.json({error:'Передайте от 1 до 200 нормализованных товаров.'},{status:400});
    const items=products.map((p:any)=>({
      id:'maytoni-'+String(p.sku||p.id||'').toLowerCase(),
      sku:String(p.sku||'').trim(),
      brand:'Maytoni',
      name:String(p.name||'Без названия'),
      category:String(p.category||'Без категории'),
      price:typeof p.price==='number'?p.price:null,
      stock:typeof p.stock==='number'?p.stock:0,
      stockText:'',
      image:String(p.image||''),
      images:p.image?[String(p.image)]:[],
      specs:[],
      attributes:{},
      description:String(p.description||''),
      sourceUrl:String(p.sourceUrl||'')
    })).filter((p:any)=>p.sku);
    if(!items.length)return NextResponse.json({error:'В данных нет артикулов SKU.'},{status:422});
    await ensureCatalogSchema();
    const runId=await startImportRun('Maytoni','CSV',items.length);
    const result=await upsertProducts(items);
    const updated=result.updated||0;
    if(runId) await finishImportRun(runId,{status:'completed',saved:result.saved,updated,errors:0});
    return NextResponse.json({saved:result.saved,updated,errors:0,found:items.length,runId,storage:result});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:'Ошибка импорта CSV.'},{status:500});
  }
}
