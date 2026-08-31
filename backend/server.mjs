import express from 'express';
import OpenAI from 'openai';
import path from 'node:path';
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

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'v10-ai.html')));
app.get('/v10-ai.html', (req, res) => res.sendFile(path.join(__dirname, 'v10-ai.html')));
app.get('/health', (req, res) => res.json({ ok: true, service: 'TIYANINI SOCK AI', version: 'V10' }));

function getApiKey() {
  // Render can preserve accidental whitespace/quotes when a key is pasted.
  // Normalize only the value; never log or return the secret itself.
  return String(process.env.OPENAI_API_KEY || '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .trim();
}

function createOpenAIClient(apiKey) {
  const options = { apiKey };
  const organization = String(process.env.OPENAI_ORG_ID || '').trim();
  const project = String(process.env.OPENAI_PROJECT_ID || '').trim();
  if (organization) options.organization = organization;
  if (project) options.project = project;
  return new OpenAI(options);
}

// Safe authentication diagnostic: returns only the last 4 characters of the
// configured key and whether OpenAI accepts authentication. Never returns the key.
app.get('/api/check-openai', async (req, res) => {
  const apiKey = getApiKey();
  if (!apiKey) return res.status(503).json({ ok:false, error:'OPENAI_API_KEY_MISSING' });
  const client = createOpenAIClient(apiKey);
  try {
    const model = await client.models.retrieve('gpt-image-2');
    res.json({ ok:true, authenticated:true, keySuffix: apiKey.slice(-4), model:model?.id || 'gpt-image-2' });
  } catch (e) {
    res.status(e?.status || 500).json({
      ok:false,
      authenticated:false,
      keySuffix: apiKey.slice(-4),
      status:e?.status || null,
      error:e?.code || e?.type || 'OPENAI_AUTH_ERROR',
      message:e?.message || 'OpenAI authentication failed'
    });
  }
});

app.post('/api/generate', async (req, res) => {
  try {
    const apiKey = getApiKey();
    if (!apiKey) return res.status(503).json({ ok:false, error:'OPENAI_API_KEY_MISSING', message:'服务器尚未配置 OPENAI_API_KEY。' });

    const body = req.body || {};
    const {
      sockColor = '#eee7da', pattern = 'sun', patternColor = '#8a6d58',
      grip = 'dots', gripColor = '#ef6f91', sockType = 'mid-calf Pilates grip sock',
      style = 'premium feminine minimal fashion', view = '45-degree',
      customNotes = '', placement = 'center', customPattern = '', customGrip = ''
    } = body;

    const client = createOpenAIClient(apiKey);
    const prompt = `Create ONE photorealistic studio product photograph of a premium women's Pilates grip sock for TIYANINI. It must look physically knitted and manufactured, NOT a cartoon, illustration, flat drawing, generic 3D icon, or plastic render. Preserve exactly: sock type ${sockType}; fabric color ${sockColor}; body pattern ${pattern}${customPattern ? ` / custom pattern: ${customPattern}` : ''} with color ${patternColor}; anti-slip sole pattern ${grip}${customGrip ? ` / custom grip: ${customGrip}` : ''} with color ${gripColor}; view ${view}; placement ${placement}. Style: ${style}. ${customNotes}. Show realistic yarn fibers, knit loops, ribbed cuff, shaped heel and toe, subtle seams, believable thickness, natural folds and soft studio lighting on a neutral background. Show only one sock; no shoes, feet, extra socks, labels, text or unrelated decorations.`;

    const response = await client.images.generate({
      model: 'gpt-image-2',
      prompt,
      size: '1024x1536',
      quality: 'medium',
      output_format: 'png',
      n: 1
    });
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
