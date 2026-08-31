import express from 'express';
import OpenAI from 'openai';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.json({ limit: '20mb' }));
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const FREE_PREVIEW_SCRIPT = `
<script>
(function(){
  function q(s){return document.querySelector(s)}
  function applyCustomSockColor(){
    const hex=q('#sockHex'), color=q('#sockColor');
    if(!hex||!color)return false;
    const v=hex.value.trim();
    if(!/^#[0-9a-fA-F]{6}$/.test(v)){
      hex.style.borderColor='#c44';
      return false;
    }
    const normalized=v.toUpperCase();
    color.value=normalized;
    hex.value=normalized;
    document.documentElement.style.setProperty('--sock',normalized);
    hex.style.borderColor='';
    return true;
  }
  function addFreeSave(){
    const actions=q('.actions');
    if(!actions||q('#saveDesign'))return;
    const b=document.createElement('button');
    b.id='saveDesign'; b.textContent='💾 保存当前设计';
    b.title='无需 AI credits，保存右侧实时设计预览';
    actions.appendChild(b);
    b.onclick=function(){
      const sock=q('#sock');
      if(!sock)return;
      const sockColor=(getComputedStyle(document.documentElement).getPropertyValue('--sock')||'#EEE7DA').trim();
      const gripColor=(getComputedStyle(document.documentElement).getPropertyValue('--grip')||'#EF6F91').trim();
      const pattern=(q('#pattern')?.textContent||'').replace(/[&<>]/g,'');
      const anti=(q('#anti')?.textContent||'').replace(/[&<>]/g,'');
      const w=620,h=900;
      const svg='<!doctype html><svg xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'"><rect width="100%" height="100%" fill="#eeeae3"/><text x="310" y="55" text-anchor="middle" font-family="Arial,sans-serif" font-size="24" font-weight="700" fill="#282621">TIYANINI SOCK DESIGN</text><g transform="translate(155 110)"><path d="M140 0h155v75c0 12-8 20-20 20h-115c-12 0-20-8-20-20z" fill="'+sockColor+'" stroke="#aaa"/><path d="M140 75h155v300c0 12-8 20-20 20h-115c-12 0-20-8-20-20z" fill="'+sockColor+'" stroke="#aaa"/><path d="M137 355h160c60 0 105 22 105 72 0 47-40 73-100 73H175c-25 0-38-14-38-36z" fill="'+sockColor+'" stroke="#aaa"/><text x="217" y="225" text-anchor="middle" font-family="Arial,sans-serif" font-size="68" fill="'+((q('#patColor')?.value)||'#8A6D58')+'">'+pattern+'</text><text x="217" y="430" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" letter-spacing="5" fill="'+gripColor+'">'+anti+'</text></g><text x="310" y="850" text-anchor="middle" font-family="Arial,sans-serif" font-size="15" fill="#777">Saved from TIYANINI SOCK LAB V10</text></svg>';
      const blob=new Blob([svg],{type:'image/svg+xml;charset=utf-8'});
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');a.href=url;a.download='tiyanini-sock-design.svg';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    };
  }
  function init(){
    const hex=q('#sockHex');
    if(hex){
      const handler=applyCustomSockColor;
      hex.addEventListener('input',function(){ if(/^#[0-9a-fA-F]{6}$/.test(hex.value.trim())) handler(); });
      hex.addEventListener('change',handler);
      hex.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();handler();hex.blur();}});
    }
    const color=q('#sockColor'); if(color) color.addEventListener('input',function(){const hex=q('#sockHex');if(hex){hex.value=color.value.toUpperCase();hex.style.borderColor='';}document.documentElement.style.setProperty('--sock',color.value);});
    addFreeSave();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
</script>`;

async function sendV10(req,res){
  const html=await fs.readFile(path.join(__dirname,'v10-ai.html'),'utf8');
  res.type('html').send(html.replace('</body>',FREE_PREVIEW_SCRIPT+'</body>'));
}
app.get('/', sendV10);
app.get('/v10-ai.html', sendV10);
app.get('/health', (req, res) => res.json({ ok: true, service: 'TIYANINI SOCK AI', version: 'V10' }));

function getApiKey() {
  return String(process.env.OPENAI_API_KEY || '').trim().replace(/^['"]|['"]$/g, '').trim();
}

function createOpenAIClient(apiKey) {
  const options = { apiKey };
  const organization = String(process.env.OPENAI_ORG_ID || '').trim();
  const project = String(process.env.OPENAI_PROJECT_ID || '').trim();
  if (organization) options.organization = organization;
  if (project) options.project = project;
  return new OpenAI(options);
}

app.get('/api/check-openai', async (req, res) => {
  const apiKey = getApiKey();
  if (!apiKey) return res.status(503).json({ ok:false, error:'OPENAI_API_KEY_MISSING' });
  const client = createOpenAIClient(apiKey);
  try {
    const model = await client.models.retrieve('gpt-image-2');
    res.json({ ok:true, authenticated:true, keySuffix: apiKey.slice(-4), model:model?.id || 'gpt-image-2' });
  } catch (e) {
    res.status(e?.status || 500).json({ ok:false, authenticated:false, keySuffix: apiKey.slice(-4), status:e?.status || null, error:e?.code || e?.type || 'OPENAI_AUTH_ERROR', message:e?.message || 'OpenAI authentication failed' });
  }
});

app.post('/api/generate', async (req, res) => {
  try {
    const apiKey = getApiKey();
    if (!apiKey) return res.status(503).json({ ok:false, error:'OPENAI_API_KEY_MISSING', message:'服务器尚未配置 OPENAI_API_KEY。' });
    const body = req.body || {};
    const { sockColor = '#eee7da', pattern = 'sun', patternColor = '#8a6d58', grip = 'dots', gripColor = '#ef6f91', sockType = 'mid-calf Pilates grip sock', style = 'premium feminine minimal fashion', view = '45-degree', customNotes = '', placement = 'center', customPattern = '', customGrip = '' } = body;
    const client = createOpenAIClient(apiKey);
    const prompt = `Create ONE photorealistic studio product photograph of a premium women's Pilates grip sock for TIYANINI. It must look physically knitted and manufactured, NOT a cartoon, illustration, flat drawing, generic 3D icon, or plastic render. Preserve exactly: sock type ${sockType}; fabric color ${sockColor}; body pattern ${pattern}${customPattern ? ` / custom pattern: ${customPattern}` : ''} with color ${patternColor}; anti-slip sole pattern ${grip}${customGrip ? ` / custom grip: ${customGrip}` : ''} with color ${gripColor}; view ${view}; placement ${placement}. Style: ${style}. ${customNotes}. Show realistic yarn fibers, knit loops, ribbed cuff, shaped heel and toe, subtle seams, believable thickness, natural folds and soft studio lighting on a neutral background. Show only one sock; no shoes, feet, extra socks, labels, text or unrelated decorations.`;
    const response = await client.images.generate({ model: 'gpt-image-2', prompt, size: '1024x1536', quality: 'medium', output_format: 'png', n: 1 });
    const b64 = response.data?.[0]?.b64_json;
    if (!b64) return res.status(502).json({ ok:false, error:'NO_IMAGE', message:'AI 没有返回图片。' });
    res.json({ ok: true, image: `data:image/png;base64,${b64}` });
  } catch (e) {
    console.error('GENERATION_ERROR', e);
    res.status(e?.status || 500).json({ ok:false, error:'GENERATION_FAILED', message:e?.message || 'Image generation failed' });
  }
});

const port = process.env.PORT || 10000;
app.listen(port, () => console.log(`TIYANINI SOCK AI V10 listening on ${port}`));
