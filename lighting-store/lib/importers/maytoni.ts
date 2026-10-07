export type MaytoniRow={article?:string;name?:string;category?:string;description?:string;price?:string;stock?:string;image?:string;url?:string;[key:string]:unknown};
export type LumiProduct={sku:string;brand:string;name:string;category:string;description:string;price:number|null;stock:number|null;image:string|null;sourceUrl:string|null;raw:MaytoniRow};
const n=(v:unknown)=>typeof v==='string'?v.trim():'';
const num=(v:unknown)=>{const x=Number(String(v??'').replace(/[^0-9,.-]/g,'').replace(',','.'));return Number.isFinite(x)?x:null};
export function normalizeMaytoni(row:MaytoniRow):LumiProduct{return{sku:n(row.article)||n(row.sku)||n(row.code),brand:'Maytoni',name:n(row.name)||n(row.title)||'Без названия',category:n(row.category)||'Без категории',description:n(row.description),price:num(row.price),stock:num(row.stock),image:n(row.image)||n(row.imageUrl)||null,sourceUrl:n(row.url)||null,raw:row};}
export function normalizeMaytoniBatch(rows:MaytoniRow[]){return rows.map(normalizeMaytoni);}
