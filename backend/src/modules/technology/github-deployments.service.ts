/** GitHub Actions is the only supported deployment history provider here.
 * Public GitHub API may work without a token; private repositories require a
 * server-side read-only credential. No browser token or invented deployment result.
 * The workflow conclusion is NOT evidence of a successful production deployment:
 * only an explicitly successful deploy job can confirm that. */
const apiRoot='https://api.github.com/repos/WIT-Colombia/WIT';
const githubActionsUrl='https://github.com/WIT-Colombia/WIT/actions';
// The history intentionally spans all repository branches; each run carries its real head_branch.
const branch='ALL_REPOSITORY_BRANCHES';
const runKinds=['CI','RELEASE','OTHER'] as const;
type Job={name:string;status:string;conclusion:string|null};
type WorkflowRun={
  id:number;name:string;head_branch:string|null;head_sha:string;
  status:string;conclusion:string|null;event:string;
  created_at:string;updated_at:string;html_url:string;run_number:number;
};
export function classifyProductionJob(jobs:ReadonlyArray<Job>){
  const deploy=jobs.find(job=>job.name==='deploy');
  if(!deploy)return 'UNVERIFIED' as const;
  if(deploy.status!=='completed')return 'IN_PROGRESS' as const;
  if(deploy.conclusion==='success')return 'CONFIRMED' as const;
  if(deploy.conclusion==='skipped')return 'SKIPPED' as const;
  if(deploy.conclusion==='failure'||deploy.conclusion==='cancelled')
    return 'FAILED_OR_CANCELLED' as const;
  return 'UNVERIFIED' as const;
}
const classification=(name:string)=>
  /production deploy/i.test(name)?'RELEASE' as const:
  /frontend validation|backend integration|backend ci|production release package/i.test(name)?'CI' as const:
  'OTHER' as const;
const token=()=>process.env.XAMUKO_GITHUB_READ_TOKEN?.trim()||'';
async function getGithub<T>(path:string):Promise<T> {
  const headers:Record<string,string>={
    'Accept':'application/vnd.github+json','User-Agent':'Xamuko-Admin-Technology/1.0',
    'X-GitHub-Api-Version':'2022-11-28',
  };
  if(token())headers.Authorization='Bearer '+token();
  const res=await fetch(apiRoot+path,{method:'GET',headers,signal:AbortSignal.timeout(7000)});
  if(!res.ok)throw new Error('GITHUB_SOURCE_UNAVAILABLE');
  return res.json() as Promise<T>;
}
type DeploymentPayload={
  connected:boolean;source:string;branch:string;checkedAt:string;
  actionsUrl:string;items:Array<{
    id:number;title:string;kind:typeof runKinds[number];branch:string|null;
    commit:string;createdAt:string;updatedAt:string;
    workflowStatus:string;workflowConclusion:string|null;
    deploymentStatus:string;url:string;runNumber:number;
  }>;
  summary:{runs:number;ciPassed:number;ciFailed:number;
    confirmedDeployments:number;skippedDeployments:number}|null;
  limitation:string;
};
let cache:{at:number;result:DeploymentPayload}|null=null;
export async function listTechnologyDeployments(force=false):Promise<DeploymentPayload> {
  if(!force&&cache&&Date.now()-cache.at<60000)return cache.result;
  const checkedAt=new Date().toISOString();
  const base={
    source:'GITHUB_ACTIONS',branch,checkedAt,actionsUrl:githubActionsUrl,
    limitation:'Los trabajos de CI y los empaquetados no prueban un despliegue. Solo se confirma despliegue de producción cuando el job deploy de GitHub Actions terminó correctamente.',
  };
  try{
    // Only fixed repository endpoints are used; no user supplied API URL.
    const response=await getGithub<{workflow_runs:WorkflowRun[]}>('/actions/runs?per_page=40');
    if(!Array.isArray(response.workflow_runs))throw new Error('GITHUB_INVALID_RESPONSE');
    const selected=response.workflow_runs.filter(x=>
      Number.isSafeInteger(x.id)&&x.id>0&&
      typeof x.name==='string'&&x.name.startsWith('XAMUKO ')).slice(0,22);
    const releases=selected.filter(run=>classification(run.name)==='RELEASE').slice(0,7);
    const verified=new Map<number,string>();
    await Promise.all(releases.map(async run=>{
      try{
        const r=await getGithub<{jobs:Job[]}>('/actions/runs/'+run.id+'/jobs?per_page=100');
        verified.set(run.id,Array.isArray(r.jobs)?classifyProductionJob(r.jobs):'UNVERIFIED');
      }catch{verified.set(run.id,'UNVERIFIED');}
    }));
    const items=selected.map(run=>{
      const kind=classification(run.name);
      return {
        id:run.id,title:run.name,kind,branch:run.head_branch??null,
        commit:typeof run.head_sha==='string'?run.head_sha.slice(0,12):'',
        createdAt:run.created_at,updatedAt:run.updated_at,
        workflowStatus:run.status,workflowConclusion:run.conclusion,
        deploymentStatus:kind==='RELEASE'?verified.get(run.id)??'UNVERIFIED':'NOT_APPLICABLE',
        url:githubActionsUrl+'/runs/'+run.id,
        runNumber:run.run_number,
      };
    });
    const result:DeploymentPayload={
      ...base,connected:true,items,
      summary:{
        runs:items.length,
        ciPassed:items.filter(i=>i.kind==='CI'&&i.workflowConclusion==='success').length,
        ciFailed:items.filter(i=>i.kind==='CI'&&i.workflowConclusion==='failure').length,
        confirmedDeployments:items.filter(i=>i.deploymentStatus==='CONFIRMED').length,
        skippedDeployments:items.filter(i=>i.deploymentStatus==='SKIPPED').length,
      },
    };
    cache={at:Date.now(),result};
    return result;
  }catch{
    const result:DeploymentPayload={
      ...base,connected:false,items:[],summary:null,
      limitation:'No se pudo consultar GitHub Actions. Si el repositorio es privado, configura XAMUKO_GITHUB_READ_TOKEN como secreto exclusivo del backend, con permiso de lectura de Actions. Ningún despliegue se presume exitoso sin consultar su job deploy.',
    };
    cache={at:Date.now(),result};
    return result;
  }
}
