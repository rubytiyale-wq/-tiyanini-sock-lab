import express from 'express';
import OpenAI from 'openai';

const app = express();
app.use(express.json({ limit: '12mb' }));
app.use((req,res,next)=>{res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','Content-Type');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');if(req.method==='OPTIONS')return res.sendStatus(204);next();});

app.get('/health',(req,res)=>res.json({ok:true,service:'TIYANINI SOCK AI'}));

app.post('/api/generate', async (req,res)=>{
  try {
    if(!process.env.OPENAI_API_KEY) return res.status(500).json({error:'OPENAI_API_KEY is not configured on the server.'});
    const {sockColor='#eee7da', pattern='sun', patternColor='#8a6d58', grip='dots', gripColor='#ef6f91', sockType='mid-calf', style='minimal', view='45-degree'}=req.body||{};
    const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
    const prompt=`Create ONE photorealistic studio product photograph of a premium women's Pilates grip sock for the TIYANINI brand. It must look like a real manufactured knitted sock, not an illustration, cartoon, icon, or plastic 3D render. Preserve these design specifications: sock type ${sockType}; main knitted fabric color ${sockColor}; style ${style}; body pattern ${pattern} in ${patternColor}; anti-slip grip pattern ${grip} in ${gripColor}; camera view ${view}. Show realistic knitted yarn fibers, fine ribbed cuff, shaped heel, shaped toe, subtle seams, believable fabric thickness, natural folds, soft realistic studio lighting, and a clean neutral product-photography background. Show only one sock. Do not add shoes, feet, extra socks, labels, logos, text, or unrelated decorations.`;
    const response=await client.images.generate({model:'gpt-image-2',prompt,size:'1024x1536',quality:'medium',output_format:'png',n:1});
    const b64=response.data?.[0]?.b64_json;
    if(!b64) return res.status(502).json({error:'The image model did not return an image.'});
    res.json({ok:true,image:`data:image/png;base64,${b64}`});
  } catch(e){
    console.error(e);
    res.status(500).json({error:e?.message||'Image generation failed'});
  }
});

const port=process.env.PORT||10000;
app.listen(port,()=>console.log(`TIYANINI SOCK AI listening on ${port}`));
