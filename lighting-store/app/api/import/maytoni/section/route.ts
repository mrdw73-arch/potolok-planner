import { NextRequest, NextResponse } from 'next/server';

const allowedHost='maytoni.ru';

function decode(v:string){
  return v
    .replace(/&amp;/g,'&')
    .replace(/&quot;/g,'"')
    .replace(/&#x27;/gi,"'")
    .replace(/&#39;/g,"'")
    .replace(/&nbsp;/g,' ')
    .replace(/&#x2F;/gi,'/')
    .trim();
}

function absolute(value:string,base:URL){
  try{return new URL(decode(value),base).href}catch{return '';}
}

function isProductUrl(value:string,rootPath:string){
  try{
    const u=new URL(value);
    if(u.protocol!=='https:'||u.hostname!==allowedHost)return false;
    if(!u.pathname.startsWith(rootPath))return false;
    const parts=u.pathname.split('/').filter(Boolean);
    const last=parts.at(-1)||'';
    // Maytoni article URLs are SKU-like, e.g. MOD514PL-L15W3K or PA001-RS-B.
    return /^[A-Z]{1,8}\d{2,}[A-Z0-9-]*$/i.test(last);
  }catch{return false;}
}

function extractLocs(xml:string){
  const out:string[]=[];
  const re=/<loc>\s*([^<]+?)\s*<\/loc>/gi;
  let m:RegExpExecArray|null;
  while((m=re.exec(xml)))out.push(decode(m[1]));
  return [...new Set(out)];
}

async function fetchText(url:string){
  const response=await fetch(url,{
    headers:{'User-Agent':'LumiHub Catalog Importer/2.0'},
    cache:'no-store'
  });
  if(!response.ok)throw new Error('Maytoni HTTP '+response.status);
  return response.text();
}

async function discoverFromSitemap(rootPath:string){
  const candidates=['https://maytoni.ru/sitemap.xml','https://maytoni.ru/sitemap_index.xml'];
  for(const candidate of candidates){
    try{
      const xml=await fetchText(candidate);
      let locs=extractLocs(xml);
      const isIndex=/<sitemap(?:index)?[\s>]/i.test(xml)&&/<sitemap>/i.test(xml);
      if(isIndex){
        const children=locs.filter(x=>/sitemap/i.test(x)).slice(0,50);
        const childResults=await Promise.all(children.map(async child=>{
          try{return extractLocs(await fetchText(child));}catch{return [];}
        }));
        locs=childResults.flat();
      }
      const products=locs.filter(x=>isProductUrl(x,rootPath));
      if(products.length)return [...new Set(products)];
    }catch{}
  }
  return [];
}

function extractCatalogLinks(html:string,base:URL){
  const urls:string[]=[];
  const seen=new Set<string>();
  const re=/(?:href|data-href)=["']([^"']+)["']/gi;
  let m:RegExpExecArray|null;
  while((m=re.exec(html))){
    const href=absolute(m[1],base);
    if(!href)continue;
    try{
      const u=new URL(href);
      if(u.hostname!==allowedHost||!u.pathname.startsWith('/catalog/'))continue;
      const normalized=u.href.replace(/\/$/,'')+'/';
      if(!seen.has(normalized)){seen.add(normalized);urls.push(normalized);}
    }catch{}
  }
  return urls;
}

async function discoverByCategories(rootUrl:URL){
  const rootPath=rootUrl.pathname.endsWith('/')?rootUrl.pathname:rootUrl.pathname+'/';
  const rootHtml=await fetchText(rootUrl.href);
  const links=extractCatalogLinks(rootHtml,rootUrl);
  const categoryUrls=[rootUrl.href,...links.filter(x=>{
    try{
      const u=new URL(x);
      return u.pathname.startsWith(rootPath)&&u.pathname!==rootPath&&u.pathname.split('/').filter(Boolean).length===rootPath.split('/').filter(Boolean).length+1;
    }catch{return false;}
  })];
  const uniqueCategories=[...new Set(categoryUrls)];
  const found=new Set<string>();
  for(const category of uniqueCategories){
    for(let page=1;page<=120;page++){
      const u=new URL(category);
      if(page>1)u.searchParams.set('PAGEN_1',String(page));
      try{
        const html=await fetchText(u.href);
        const products=extractCatalogLinks(html,u).filter(x=>isProductUrl(x,rootPath));
        const before=found.size;
        products.forEach(x=>found.add(x));
        if(page>1&&found.size===before&&products.length===0)break;
      }catch{break;}
    }
  }
  return [...found];
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
    const rootPath=url.pathname.endsWith('/')?url.pathname:url.pathname+'/';
    let urls=await discoverFromSitemap(rootPath);
    let method='sitemap';
    if(!urls.length){
      urls=await discoverByCategories(url);
      method='category-crawl';
    }
    return NextResponse.json({
      source:url.href,
      method,
      total:urls.length,
      urls
    });
  }catch(error){
    return NextResponse.json({
      error:error instanceof Error?error.message:'Не удалось получить каталог Maytoni.'
    },{status:502});
  }
}
