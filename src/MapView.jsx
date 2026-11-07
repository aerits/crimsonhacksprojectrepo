import {useEffect,useRef,useState} from 'react';
import {Plus,Minus,LocateFixed,ArrowUpRight,MapPinned} from 'lucide-react';
import {decodePolyline,googleMapsUrl} from '../shared/navigation';
let mapsPromise;
function loadGoogle(key){
  if(window.google?.maps?.Map)return Promise.resolve(window.google.maps);
  if(!mapsPromise)mapsPromise=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://maps.googleapis.com/maps/api/js?key='+encodeURIComponent(key)+'&loading=async&callback=wayvoMapsReady';script.async=true;window.wayvoMapsReady=()=>resolve(window.google.maps);script.onerror=()=>{mapsPromise=null;script.remove();reject(new Error('Google Maps could not load.'));};window.gm_authFailure=()=>{mapsPromise=null;reject(new Error('Google Maps rejected the browser key. Check its API and referrer restrictions.'));};document.head.appendChild(script);});
  return mapsPromise;
}
const markers=[[650,343],[405,343],[405,260],[405,191],[570,191],[570,133]];
export default function MapView({route,step,browserKey}){
  const [zoom,setZoom]=useState(1);const [mapError,setMapError]=useState('');const host=useRef(null);const map=useRef(null);const bounds=useRef(null);
  useEffect(()=>{
    if(route.source!=='google'||!browserKey)return;let active=true;let objects=[];setMapError('');
    loadGoogle(browserKey).then(maps=>{if(!active||!host.current)return;const points=decodePolyline(route.encodedPolyline||'');if(!points.length)throw new Error('No map geometry was returned for this route.');map.current=new maps.Map(host.current,{disableDefaultUI:true,gestureHandling:'cooperative',zoom:13,center:points[0]});const line=new maps.Polyline({path:points,strokeColor:'#7761d7',strokeWeight:6,map:map.current});bounds.current=new maps.LatLngBounds();points.forEach(p=>bounds.current.extend(p));map.current.fitBounds(bounds.current,60);objects=[line,...[points[0],points.at(-1)].map(center=>new maps.Circle({center,radius:25,fillColor:'#7761d7',fillOpacity:1,strokeColor:'#fff',strokeWeight:3,map:map.current}))];}).catch(e=>active&&setMapError(e.message));
    return()=>{active=false;objects.forEach(x=>x.setMap(null));map.current=null;};
  },[route,browserKey]);
  useEffect(()=>{if(map.current&&route.steps[step]?.point)map.current.panTo(route.steps[step].point);},[step,route]);
  const changeZoom=delta=>{if(map.current)map.current.setZoom(map.current.getZoom()+delta);else setZoom(z=>Math.min(1.8,Math.max(1,z+delta*0.2)));};
  return <div className="map-area">
    {route.source==='demo'?<svg viewBox={((850-850/zoom)/2)+' '+((490-490/zoom)/2)+' '+850/zoom+' '+490/zoom} className="demo-map" role="img" aria-label="Illustrative campus demo route from the University of Alabama to Tuscaloosa Riverwalk">
      <defs><pattern id="blocks" width="92" height="82" patternUnits="userSpaceOnUse" patternTransform="rotate(-6)"><rect x="9" y="9" width="70" height="59" rx="7" fill="#e6e4e1"/><rect x="16" y="17" width="23" height="16" rx="3" fill="#dedcd8"/><rect x="45" y="37" width="25" height="20" rx="3" fill="#dedcd8"/></pattern><filter id="shadow"><feDropShadow dx="0" dy="3" stdDeviation="5" floodOpacity=".15"/></filter></defs>
      <rect width="850" height="490" fill="#f3f1ed"/><rect width="850" height="490" fill="url(#blocks)"/>
      <path d="M-20 92 C150 182 200 6 390 63 S650 159 900 0" fill="none" stroke="#cbdcce" strokeWidth="150"/>
      <path d="M-20 80 C150 170 210 0 390 58 S650 145 900 -5" fill="none" stroke="#d3e4e8" strokeWidth="85"/>
      <path d="M-20 80 C150 170 210 0 390 58 S650 145 900 -5" fill="none" stroke="#e7f0f1" strokeWidth="1"/>
      <path d="M-20 210L870 210M-20 343L870 343M405 140V520M651 210V500M-20 434L870 434M180 180V490M760 155V500" stroke="#fffdfa" strokeWidth="18" fill="none"/>
      <path d="M-20 285L870 285M310 180V500M530 160V500" stroke="#fffdfa" strokeWidth="12" fill="none"/>
      <path d="M-20 211 C200 225 360 159 550 177 S770 167 900 105" fill="none" stroke="#fffdfa" strokeWidth="20"/>
      <rect x="676" y="234" width="61" height="90" rx="15" fill="#dbe4d3"/><rect x="555" y="366" width="73" height="47" rx="10" fill="#dbe4d3"/>
      <g fill="#b8cbb4"><circle cx="680" cy="184" r="9"/><circle cx="701" cy="174" r="7"/><circle cx="740" cy="148" r="9"/><circle cx="610" cy="149" r="7"/><circle cx="305" cy="125" r="8"/><circle cx="290" cy="132" r="6"/><circle cx="712" cy="266" r="7"/></g>
      <g className="map-labels"><text x="88" y="377">DOWNTOWN</text><text x="88" y="394">TUSCALOOSA</text><text x="662" y="395">THE UNIVERSITY</text><text x="662" y="412">OF ALABAMA</text><text transform="translate(294 66) rotate(-8)" className="river-label">Black Warrior River</text><text x="451" y="333" className="road-label">University Blvd</text><text x="246" y="201" className="road-label">Jack Warner Pkwy</text><text transform="translate(393 314) rotate(-90)" className="road-label">Greensboro Ave</text></g>
      <path d="M650 343H405V191H570V133" stroke="white" strokeWidth="13" fill="none" strokeLinejoin="round"/><path d="M650 343H405V191H570V133" stroke="#8065d5" strokeWidth="7" fill="none" strokeLinejoin="round"/>
      <circle cx="650" cy="343" r="10" fill="white" stroke="#8065d5" strokeWidth="4"/>
      <g transform="translate(570 119)" filter="url(#shadow)"><path d="M0 19C-4 13-15 3-15-6a15 15 0 1 1 30 0c0 9-11 19-15 25" fill="#7060ce"/><circle cy="-6" r="5" fill="white"/></g>
      <g transform="translate(587 99)" filter="url(#shadow)"><rect width="151" height="32" rx="9" fill="white"/><text x="12" y="21" fontSize="12" fontWeight="600" fill="#47424d">Tuscaloosa Riverwalk</text></g>
      <g transform={'translate('+markers[Math.min(step,5)].join(' ')+')'}><circle r="25" fill="#8065d5" opacity=".15"/><circle r="16" fill="#8065d5" stroke="white" strokeWidth="3" filter="url(#shadow)"/><path d="m0-8 7 14-7-4-7 4Z" fill="white"/></g>
    </svg>:browserKey&&!mapError?<div className="google-map" ref={host}/>:<div className="map-empty"><MapPinned size={44}/><h3>Your route is ready</h3><p>{mapError||'Add a Google Maps browser key to see the interactive map here.'}</p><a className="text-link" href={googleMapsUrl(route.origin,route.destination,route.mode)} target="_blank" rel="noreferrer">View in Google Maps <ArrowUpRight size={16}/></a></div>}
    <div className="map-topline"><span className="map-chip"><span className="status-dot"/>{route.source==='demo'?'Campus demo':'Google route'}</span><span className="map-chip map-location">Tuscaloosa, AL{route.source==='google'?' · route preview':''}</span></div>
    <div className="map-tools"><button aria-label="Zoom in" onClick={()=>changeZoom(1)}><Plus size={18}/></button><button aria-label="Zoom out" onClick={()=>changeZoom(-1)}><Minus size={18}/></button><button aria-label="Fit route" onClick={()=>{setZoom(1);if(map.current&&bounds.current)map.current.fitBounds(bounds.current,60);}}><LocateFixed size={18}/></button></div>
    <span className="map-caption">{route.source==='demo'?'Illustrative map · Demo directions only':'Map data © Google'}</span>
  </div>;
}
