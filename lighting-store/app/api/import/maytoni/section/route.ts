import { NextRequest, NextResponse } from 'next/server';

const allowedHost='maytoni.ru';

function decode(v:string){
  return v.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#x27;/gi,"'").replace(/&#39;/g,"'").replace(/&nbsp;/g,' ').trim();
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
    const seen=new Set<string>();
    const urls:string[]=[];
    const re=/href=["']([^"']*\/catalog\/[^"']+\/)["']/gi;
    let m:RegExpExecArray|null;
    while((m=re.exec(html))){
      try{
        const u=new URL(decode(m[1]),url);
        if(u.hostname!==allowedHost||!u.pathname.startsWith('/catalog/'))continue;
        const href=u.href.replace(/\/$/,'')+'/';
        const parts=u.pathname.split('/').filter(Boolean);
        const last=parts.at(-1)||'';
        if(last.length<5||last.includes('?')||last==='catalog')continue;
        if(!seen.has(href)){seen.add(href);urls.push(href);}
      }catch{}
    }
    return NextResponse.json({source:url.href,total:urls.length,urls});
  }catch{return NextResponse.json({error:'Не удалось получить раздел Maytoni.'},{status:502});}
}
