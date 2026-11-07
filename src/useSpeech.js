import {useCallback,useEffect,useRef,useState} from 'react';
import {api} from './api';
export function useSpeech() {
  const [deviceVoices,setDeviceVoices]=useState([]);const [speaking,setSpeaking]=useState(false);
  const session=useRef(0);const playback=useRef(null);const finish=useRef(null);const abort=useRef(null);
  useEffect(()=>{const synth=window.speechSynthesis;if(!synth)return;const update=()=>setDeviceVoices(synth.getVoices());update();synth.addEventListener('voiceschanged',update);return()=>synth.removeEventListener('voiceschanged',update);},[]);
  const stop=useCallback(()=>{session.current++;abort.current?.abort();abort.current=null;window.speechSynthesis?.cancel();if(playback.current){playback.current.audio.pause();URL.revokeObjectURL(playback.current.url);playback.current=null;}finish.current?.();finish.current=null;setSpeaking(false);},[]);
  useEffect(()=>()=>stop(),[stop]);
  const speak=useCallback(async(text,settings)=>{
    stop();const id=session.current;setSpeaking(true);
    try {
      if(settings.provider==='elevenlabs'){
        if(!settings.voiceId)throw new Error('Choose an ElevenLabs voice first.');
        const controller=new AbortController();abort.current=controller;
        const blob=await api('speech',{text,voiceId:settings.voiceId,speed:settings.rate},{audio:true,signal:controller.signal});
        if(id!==session.current)return;
        const url=URL.createObjectURL(blob),audio=new Audio(url);playback.current={url,audio};
        await new Promise((resolve,reject)=>{finish.current=resolve;audio.onended=resolve;audio.onerror=()=>reject(new Error('Could not play this audio. Try a device voice.'));audio.play().catch(()=>reject(new Error('Audio was blocked. Press Listen again to enable playback.')));});
      }else{
        if(!window.speechSynthesis)throw new Error('Your browser does not support device speech. Try Chrome, Edge, or an AI voice.');
        const utterance=new SpeechSynthesisUtterance(text);utterance.rate=settings.rate;utterance.pitch=settings.pitch||1;
        utterance.voice=window.speechSynthesis.getVoices().find(v=>v.voiceURI===settings.voiceId)||null;utterance.lang=utterance.voice?.lang||'en-US';
        await new Promise((resolve,reject)=>{finish.current=resolve;utterance.onend=resolve;utterance.onerror=e=>e.error==='canceled'||e.error==='interrupted'?resolve():reject(new Error('Device speech is unavailable. Try another voice.'));window.speechSynthesis.speak(utterance);});
      }
    }catch(error){if(error.name!=='AbortError')throw error;}finally{if(id===session.current){if(playback.current){URL.revokeObjectURL(playback.current.url);playback.current=null;}setSpeaking(false);finish.current=null;abort.current=null;}}
  },[stop]);
  return {deviceVoices,speaking,speak,stop};
}
