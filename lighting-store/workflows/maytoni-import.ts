import { getImportBatch, markImportBatch, getImportRun, updateImportRunStatus } from "../lib/db";

type BatchRow={position:number;url:string;attempts:number};

async function loadRun(runId:string){
  "use step";
  return await getImportRun(runId);
}

async function loadBatch(runId:string):Promise<BatchRow[]>{
  "use step";
  return await getImportBatch(runId,5) as BatchRow[];
}

async function processBatch(runId:string,baseUrl:string,urls:string[]){
  "use step";
  const response=await fetch(baseUrl+"/api/import/maytoni",{
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({urls}),
    cache:"no-store"
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(String(data?.error||"Maytoni batch import failed"));
  return {
    saved:Number(data?.saved||0),
    updated:Number(data?.updated||0),
    errors:Number(data?.errors||0),
    products:Array.isArray(data?.products)?data.products.length:0
  };
}

async function recordBatch(runId:string,positions:number[],result:{saved:number;updated:number;errors:number;errorMessage?:string}){
  "use step";
  await markImportBatch(runId,positions,result);
}

async function finish(runId:string,status:string,errorMessage=""){
  "use step";
  await finishImportRun(runId,{status,saved:0,updated:0,errors:0,errorMessage});
}

export async function runMaytoniImport(runId:string,baseUrl:string){
  "use workflow";
  const run=await loadRun(runId);
  if(!run) throw new Error("Import run not found");
  const origin=baseUrl.replace(/\/$/,"");
  while(true){
    const batch=await loadBatch(runId);
    if(!batch.length){
      await finishImportRun(runId,{status:"completed",saved:0,updated:0,errors:0});
      return {runId,status:"completed"};
    }
    const positions=batch.map(x=>x.position);
    try{
      const result=await processBatch(runId,origin,batch.map(x=>x.url));
      await recordBatch(runId,positions,result);
    }catch(error){
      const message=error instanceof Error?error.message:String(error);
      await recordBatch(runId,positions,{saved:0,updated:0,errors:1,errorMessage:message});
      throw error;
    }
  }
}
