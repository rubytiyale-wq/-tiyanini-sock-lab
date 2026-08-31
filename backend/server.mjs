import express from 'express';
import OpenAI from 'openai';

const app = express();
app.use(express.json({ limit: '12mb' }));
app.use((req,res,next)=>{res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','Content-Type');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');if(req.method==='OPTIONS')return res.sendStatus(204);next();});

app.get('/health',(req,res)=>res.json({ok:true,service:'TIYANINI SOCK AI'}));

app.post('/api/generate', async (req,res)=>{
  try {
    if(!process.env.OPENAI_API_KEY) return res.status(500).json({error:'OPENAI_API_KEY is not configured on the server.'});
    const {sockColor='#eee7da', pattern='sun', patternColor='#8a6d58', grip='dots', gripColor='#ef6f91', sockType='mid-calf', style='minimal', view='45-degree', referenceImage=null}=req.body||{};
    const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
    const prompt=`Create a photorealistic studio product photograph of ONE premium women's Pilates grip sock for the TIYANINI brand. The sock must look physically manufactured, not an illustration or 3D cartoon. Preserve these design specifications exactly: sock type ${sockType}; main fabric color ${sockColor}; style ${style}; body pattern ${pattern} in ${patternColor}; grip/anti-slip pattern ${grip} in ${gripColor}; camera view ${view}. Show realistic knitted yarn fibers, ribbed cuff, heel shaping, toe shaping, subtle seams, natural fabric folds, believable thickness, soft studio lighting and a clean neutral background. Keep the design centered and commercially realistic. Do not add shoes, extra socks, labels, text, logos, or unrelated decorations. If a reference design image is provided, use it as the design blueprint and preserve its colors, placement and proportions as closely as possible.`;
    const input = referenceImage ? [{role:'user',content:[{type:'input_text',text:prompt},{type:'input_image',image_url:referenceImage}]}] : prompt;
    const response=await client.responses.create({model:'gpt-5.6-luna',input,tools:[{type:'image_generation',background:'opaque'}]});
    const call=response.output?.find(x=>x.type==='image_generation_call');
    if(!call?.result) return res.status(502).json({error:'The image model did not return an image.',details:response.output});
    res.json({ok:true,image:`data:image/png;base64,${call.result}`});
  } catch(e){
    console.error(e);
    res.status(500).json({error:e?.message||'Image generation failed'});
  }
});

const port=process.env.PORT||10000;
app.listen(port,()=>console.log(`TIYANINI SOCK AI listening on ${port}`));
