export async function api(path,body,options={}) {
  const response=await fetch('/api/'+path,{...options,...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
  if(!response.ok){let message='Could not reach the service.';try{message=(await response.json()).error||message;}catch{}throw new Error(message);}
  return options.audio?response.blob():response.json();
}
