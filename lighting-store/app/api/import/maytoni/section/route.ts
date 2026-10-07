import { NextRequest, NextResponse } from 'next/server';

const allowedHost='maytoni.ru';

function decode(v:string){
  return v.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#x27;/gi,"'").replace(/&#39;/g,"'").replace(/&nbsp;/g,' ').trim();
}

function extractCatalogLinks(html:string,base:URL){
  const urls:string[]=[];
  const seen=new Set<string>();
  const tokens=html.split(/\s+/);
  for(const token of tokens){
    const cleanToken=token.replace(/^[^a-zA-Z]*(?:href|data-href)=/,'').replace(/^["']|["']$/g,'');
    if(!cleanToken.includes('/catalog/'))continue;
    const value=cleanToken.replace(/["'<>]/g,'');
    const start=value.indexOf('/catalog/');
    if(start<0)continue;
    const path=value.slice(start).split(/[?#"']/,1)[0];
    if(!path.endsWith('/'))continue;
    try{
      const u=new URL(path,base);
      if(u.hostname!==allowedHost||!u.pathname.startsWith('/catalog/'))continue;
      const parts=u.pathname.split('/').filter(Boolean);
      const last=parts.at(-1)||'';
      if(last.length<5||last==='catalog')continue;
      const href=u.href.replace(/\/$/,'')+'/';
      if(!seen.has(href)){seen.add(href);urls.push(href);}
    }catch{}
  }
  return urls;
}

export async function GET(request:NextRequest){
  const input=request.nextUrl.searchParams.get('url');
  if(!input)return NextResponse.json({error:'Передайте параметр url.'},{status:400});
  let url:URL;
  try{url=new URL(input);}catch{return NextResponse.json({error:'Некорректная ссылка.'},{status:400});}
  if(url.protocol!=='https:'||url.hostname!==allowedHost||!url.pathname.startsWith('/catalog/')){
    return NextResponse.json({error:'Разрешены только HTTPS-ссылки на разделы Maytoni.ru.'},{status:400});
  }
  try{
    const response=await fetch(url.href,{headers:{'User-Agent':'LumiHub Catalog Importer/1.2'},cache:'no-store'});
    if(!response.ok)return NextResponse.json({error:'Maytoni HTTP '+response.status},{status:502});
    const html=await response.text();
    const urls=extractCatalogLinks(html,url);
    return NextResponse.json({source:url.href,total:urls.length,urls});
  }catch{return NextResponse.json({error:'Не удалось получить раздел Maytoni.'},{status:502});}
}
