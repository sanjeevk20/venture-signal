import {spawnSync} from 'node:child_process';
import {writeFileSync,appendFileSync} from 'node:fs';
const names=['CLOUDFLARE_API_TOKEN','CLOUDFLARE_ACCOUNT_ID','OPENAI_API_KEY'];
const missing=names.filter(name=>!process.env[name]);
const writeConfig=url=>writeFileSync('dist/config.json',JSON.stringify({apiBaseUrl:url}));
if(missing.length){
 writeConfig('');console.log('Backend setup pending. Missing repository secrets: '+missing.join(', '));
 if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,'\n### AI backend setup pending\nAdd these repository secrets: '+missing.join(', ')+'. News feeds and discussion research remain available.\n');
 process.exit(0);
}
function run(args,input){const result=spawnSync('npx',['--yes','wrangler@4',...args],{cwd:'backend',env:process.env,encoding:'utf8',input,timeout:180000});if(result.status!==0)throw new Error('Cloudflare command failed. Check account permissions and Worker configuration.');return (result.stdout||'')+'\n'+(result.stderr||'')}
try{
 const deployed=run(['deploy']);
 const endpoint=deployed.match(/https:\/\/venture-signal-api\.[a-zA-Z0-9.-]+\.workers\.dev/);
 if(!endpoint)throw new Error('Worker deployed but endpoint could not be determined.');
 run(['secret','put','OPENAI_API_KEY'],process.env.OPENAI_API_KEY+'\n');
 const response=await fetch(endpoint[0]+'/health',{signal:AbortSignal.timeout(20000)});
 const health=await response.json();if(!response.ok||!health.research_configured)throw new Error('Worker health check failed.');
 writeConfig(endpoint[0]);console.log('AI backend deployed and configured: '+endpoint[0]);
 if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,'\nAI backend deployed: '+endpoint[0]+'\n');
}catch(error){console.error(error.message);process.exit(1)}
