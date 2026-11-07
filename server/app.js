import express from 'express';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ZodError} from 'zod';
import {ApiError,routeSchema,narrationSchema,speechSchema,getRoute,narrate,getVoices,speech} from './services.js';
export function createApp(env=process.env,fetcher=fetch) {
  const app=express();app.disable('x-powered-by');
  app.use((req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');next();});
  app.use('/api',(req,res,next)=>{
    res.setHeader('Cache-Control','no-store');
    const allowed=new Set(['http://localhost:5173','http://127.0.0.1:5173',...(env.ALLOWED_ORIGIN||'').split(',').filter(Boolean)]);
    if(req.headers.origin && req.headers.origin!==req.protocol+'://'+req.get('host') && !allowed.has(req.headers.origin))return res.status(403).json({error:'This origin is not allowed.'});
    next();
  });
  const requests=new Map();
  app.use('/api',(req,res,next)=>{
    const now=Date.now();let entry=requests.get(req.ip);
    if(!entry||entry.until<now){if(requests.size>10000)requests.clear();entry={count:0,until:now+60000};requests.set(req.ip,entry);}
    if(++entry.count>60){res.setHeader('Retry-After',Math.ceil((entry.until-now)/1000));return res.status(429).json({error:'Too many requests. Please wait a moment.'});}next();
  });
  app.use(express.json({limit:'128kb'}));
  app.get('/api/config',(req,res)=>res.json({routes:Boolean(env.GOOGLE_MAPS_API_KEY),ai:Boolean(env.OPENAI_API_KEY),voices:Boolean(env.ELEVENLABS_API_KEY),googleMapsBrowserKey:env.GOOGLE_MAPS_BROWSER_KEY||''}));
  app.get('/api/health',(req,res)=>res.json({ok:true}));
  app.post('/api/routes',async(req,res)=>res.json(await getRoute(routeSchema.parse(req.body),env,fetcher)));
  app.post('/api/narration',async(req,res)=>res.json(await narrate(narrationSchema.parse(req.body),env,fetcher)));
  app.get('/api/voices',async(req,res)=>res.json({voices:await getVoices(env,fetcher)}));
  app.post('/api/speech',async(req,res)=>{const audio=await speech(speechSchema.parse(req.body),env,fetcher);res.type('audio/mpeg').send(audio);});
  app.use('/api',(req,res)=>res.status(404).json({error:'API endpoint not found.'}));
  const dist=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist');
  app.use(express.static(dist));
  app.get('/{*path}',(req,res,next)=>res.sendFile(path.join(dist,'index.html'),error=>error&&next(error)));
  app.use((error,req,res,next)=>{
    if(res.headersSent)return next(error);
    if(error instanceof ZodError)return res.status(400).json({error:'Please check your input.',details:error.issues.map(x=>x.path.join('.')+': '+x.message)});
    const status=error instanceof ApiError?error.status:error.status===413?413:error instanceof SyntaxError?400:500;
    res.status(status).json({error:error instanceof ApiError?error.message:status===413?'Request is too large.':status===400?'Invalid JSON request.':'Something went wrong. Please try again.'});
  });
  return app;
}
