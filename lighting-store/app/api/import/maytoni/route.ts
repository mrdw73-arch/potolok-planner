import { NextRequest, NextResponse } from 'next/server';
import { upsertProducts } from '../../../../lib/db';

type DetailProduct = {
  id:string; sku:string; name:string; category:string; price:number|null;
  image:string; images:string[]; sourceUrl:string; brand:string; stock:number;
  stockText:string; description:string; specs:string[]; attributes:Record<string,string>;
};

const allowedHost='maytoni.ru';

function decode(v:string){return v.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#x27;/gi,"'").replace(/&#39;/g,"'").replace(/&nbsp;/g,' ').replace(/&#x2F;/gi,'/').replace(/&#8211;/gi,'–').replace(/&#8212;/gi,'—').trim();}
function clean(v:string){return decode(v.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' '));}
function priceNumber(v?:string){if(!v)return null;const n=Number(v.replace(/[^0-9,.-]/g,'').replace(',','.'));return Number.isFinite(n)?n:null;}
function absolute(v:string,base:URL){try{return new URL(decode(v),base).href}catch{return ''}}
function unique(a:string[]){return [...new Set(a.filter(Boolean))]}
function categoryFromUrl(url:URL){
  const parts=url.pathname.split('/').filter(Boolean);
  return parts.length>=3?parts[parts.length-2]:'Декоративный свет';
}

function extractImages(html:string,base:URL){
  const out:string[]=[];
  const patterns=[
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/gi,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/gi,
    /(?:src|data-src|data-lazy-src)=["']([^"']+\.(?:jpg|jpeg|png|webp)(?:\?[^"']*)?)["']/gi
  ];
  for(const re of patterns){let m:RegExpExecArray|null;while((m=re.exec(html)))out.push(absolute(m[1],base));}
  return unique(out).slice(0,12);
}

function extractAttributes(html:string){
  const attrs:Record<string,string>={};
  const add=(k:string,v:string)=>{const key=clean(k),val=clean(v);if(key&&val&&key.length<100&&val.length<300&&!attrs[key])attrs[key]=val;};
  const rowRe=/<tr[^>]*>[\s\S]*?<th[^>]*>([\s\S]*?)<\/th>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<\/tr>/gi;
  let m:RegExpExecArray|null;
  while((m=rowRe.exec(html)))add(m[1],m[2]);
  const dlRe=/<dt[^>]*>([\s\S]*?)<\/dt>[\s\S]*?<dd[^>]*>([\s\S]*?)<\/dd>/gi;
  while((m=dlRe.exec(html)))add(m[1],m[2]);
  return attrs;
}

function parseDetail(html:string,url:URL):DetailProduct|null{
  const text=clean(html);
  const sku=(text.match(/Артикул\s+([A-Z0-9-]{5,})/i)?.[1]||url.pathname.split('/').filter(Boolean).pop()||'').toUpperCase();
  const name=clean(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1]||'');
  if(!sku||!name)return null;
  const attributes=extractAttributes(html);
  const images=extractImages(html,url);
  const price=priceNumber(text.match(/([0-9][0-9\s]{2,})\s*₽/)?.[1]);
  const stockText=text.match(/В наличии:\s*([^|]{1,60})/i)?.[1]?.trim()||'';
  const stockMatch=stockText.match(/(\d+)/);
  const description=clean(html.match(/О серии[\s\S]{0,1800}/i)?.[0]||'');
  const specs=unique([
    attributes['Источник света'],
    attributes['Количество ламп']?attributes['Количество ламп']+' ламп':'',
    attributes['Цветовая температура']?attributes['Цветовая температура']+'K':'',
    attributes['Мощность'],
    attributes['Световой поток'],
    attributes['Класс пылевлагозащиты']
  ]);
  return {
    id:'maytoni-'+sku.toLowerCase(),sku,name,category:categoryFromUrl(url),price,
    image:images[0]||'',images,sourceUrl:url.href,brand:attributes['Бренд']||'Maytoni',
    stock:stockMatch?Number(stockMatch[1]):(stockText.includes('>20')?21:0),
    stockText,description,specs,attributes
  };
}

async function fetchDetail(sourceUrl:string){
  const url=new URL(sourceUrl);
  if(url.protocol!=='https:'||url.hostname!==allowedHost||!url.pathname.startsWith('/catalog/'))throw new Error('Недопустимый URL Maytoni.');
  const response=await fetch(url.href,{headers:{'User-Agent':'LumiHub Catalog Importer/2.0'},cache:'no-store'});
  if(!response.ok)throw new Error('Maytoni HTTP '+response.status);
  return parseDetail(await response.text(),url);
}

export async function GET(request:NextRequest){
  const input=request.nextUrl.searchParams.get('url');
  if(!input)return NextResponse.json({error:'Передайте параметр url.'},{status:400});
  try{const product=await fetchDetail(input);if(!product)return NextResponse.json({error:'Не удалось распознать карточку товара Maytoni.'},{status:422});return NextResponse.json({source:input,product});}
  catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Ошибка загрузки Maytoni.'},{status:502});}
}

export async function POST(request:NextRequest){
  try{
    const body=await request.json();const urls:string[]=Array.isArray(body?.urls)?body.urls:[];
    if(!urls.length||urls.length>50)return NextResponse.json({error:'Передайте массив из 1–50 URL карточек Maytoni.'},{status:400});
    const results=await Promise.all(urls.map(async url=>{try{const product=await fetchDetail(url);return product?{ok:true,product}:{ok:false,url,error:'Карточка не распознана.'};}catch(error){return {ok:false,url,error:error instanceof Error?error.message:'Ошибка'};}}));
    const products=results.filter(x=>x.ok).map(x=>x.product);
    const storage=await upsertProducts(products);
    return NextResponse.json({source:'Maytoni product pages',total:results.length,imported:results.filter(x=>x.ok).length,products,errors:results.filter(x=>!x.ok),storage});
  }catch{return NextResponse.json({error:'Некорректный JSON-запрос.'},{status:400});}
}
