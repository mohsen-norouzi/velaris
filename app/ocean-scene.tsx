'use client';
import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { makeYacht, PARTICLES } from './yacht-geometry';
import { createSea, makeReflectionSamples } from './sea-system';
import { CameraOrbit } from './camera-orbit';
const vertex=`
attribute vec4 aFrom; attribute vec4 aTo; attribute vec3 aSeed;
uniform float uMix,uTime,uReflect,uDpr,uReduced; varying float vAlpha;varying float vGold;
void main(){
 float t=smoothstep(0.0,1.0,uMix);float burst=sin(t*3.14159265)*(1.0-uReduced);
 vec3 p=mix(aFrom.xyz,aTo.xyz,t);
 vec3 orbit=vec3(sin(aSeed.x*30.0+uTime*.28),cos(aSeed.y*22.0+uTime*.21),sin(aSeed.z*25.0+uTime*.17));
 p=mix(p,p*.25+orbit*vec3(7.0,4.0,5.0)+vec3(0.,2.,0.),burst*.88);
 p+=orbit*.016*(1.0+burst*4.0);p.y+=sin(uTime*.5)*.025;
 vAlpha=mix(aFrom.w,aTo.w,t)*(.73+.27*sin(uTime*.9+aSeed.x*60.));vGold=aSeed.y;
 if(uReflect>.5){float height=p.y;p.y=-p.y*(.015+aSeed.z*1.95)-.06;p.x+=sin(p.z*5.+uTime*1.5+height*3.)*(.025+height*.045);p.z+=sin(p.x*3.-uTime*.8)*.075;vAlpha*=.95*exp(-height*.075);}
 vec4 mv=modelViewMatrix*vec4(p,1.0); gl_Position=projectionMatrix*mv;
 float breathing=.82+.18*sin(uTime*(.4+aSeed.y*.65)+aSeed.x*43.);
 float glint=pow(.5+.5*sin(uTime*(.7+aSeed.x*.4)+aSeed.y*67.),8.);
 float size=(17.+pow(aSeed.z,2.4)*49.)*breathing*(1.+glint*.32);
 gl_PointSize=clamp(size*uDpr/-mv.z, .65*uDpr, 5.2*uDpr);
 if(uReflect>.5)gl_PointSize*=1.6;
}
`;
const fragment=`
uniform float uReflect;uniform vec3 uColor;varying float vAlpha;varying float vGold;
void main(){vec2 uv=gl_PointCoord-.5; if(uReflect>.5)uv.x*=1.6;float d=length(uv);if(d>.5)discard;float glow=pow(1.-d*2.,1.35);vec3 col=mix(vec3(.96,.97,.91),uColor,vGold*.65);gl_FragColor=vec4(col*vAlpha*1.42,glow*min(vAlpha,1.));}
`;
export default function OceanScene({progress,paused,resetRef}:{progress:MutableRefObject<number>;paused:boolean;resetRef:MutableRefObject<()=>void>}){
 const host=useRef<HTMLDivElement>(null),pausedRef=useRef(paused);pausedRef.current=paused;
 const [ready,setReady]=useState(false),[failed,setFailed]=useState(false);
 useEffect(()=>{
  if(!host.current)return;const el=host.current;let renderer:THREE.WebGLRenderer;
  try{renderer=new THREE.WebGLRenderer({antialias:false,alpha:false,powerPreference:'high-performance'})}catch{setFailed(true);return}
  const mobile=window.innerWidth<800,count=mobile?19000:PARTICLES;const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,mobile?1.6:2));renderer.setClearColor(0x020303);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;el.appendChild(renderer.domElement);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(37,1,.1,180);const yacht=new THREE.Group();scene.add(yacht);
  const shapes=Array.from({length:5},(_,i)=>makeYacht(i,count));const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(count*3),3));geometry.setAttribute('aFrom',new THREE.BufferAttribute(shapes[0],4));geometry.setAttribute('aTo',new THREE.BufferAttribute(shapes[1],4));
  const seeds=new Float32Array(count*3);let seed=32;for(let i=0;i<seeds.length;i++){seed=(seed*1664525+1013904223)>>>0;seeds[i]=seed/4294967296}geometry.setAttribute('aSeed',new THREE.BufferAttribute(seeds,3));
  const uniforms={uMix:{value:0},uTime:{value:0},uReflect:{value:0},uDpr:{value:renderer.getPixelRatio()},uReduced:{value:reduced?1:0},uColor:{value:new THREE.Color('#dbc39a')}};
  const material=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,uniforms,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});const points=new THREE.Points(geometry,material);points.frustumCulled=false;yacht.add(points);
  const sea=createSea(scene,mobile,renderer.getPixelRatio());
  const reflectionMaterial=material.clone();reflectionMaterial.uniforms.uReflect.value=1;
  const reflectionSamples=makeReflectionSamples(shapes,mobile);
  const reflection=new THREE.Points(reflectionSamples.geometry,reflectionMaterial);reflection.frustumCulled=false;
  const reflectedYacht=new THREE.Group();reflectedYacht.add(reflection);sea.reflectionScene.add(reflectedYacht);
  const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));const bloom=new UnrealBloomPass(new THREE.Vector2(1,1),.62,.6,.62);composer.addPass(bloom);composer.addPass(new OutputPass());
  const orbit=new CameraOrbit();
  let activePointer:number|null=null,lastX=0,lastY=0,raf=0,elapsed=0,lastTime=0,smooth=progress.current,chapter=-1,disposed=false;
  // The vessel and sea stay in world space; only the camera orbits.
  yacht.rotation.y=.12;
  function resize(){
    const w=el.clientWidth,h=el.clientHeight;
    renderer.setSize(w,h);composer.setSize(w,h);sea.resize(w,h);camera.aspect=w/h;
    camera.setViewOffset(w,h,w>=800?-w*.085:0,0,w,h);
    camera.updateProjectionMatrix();
  }
  resize();window.addEventListener('resize',resize);
  function down(e:PointerEvent){
    if(e.button!==0||activePointer!==null)return;
    activePointer=e.pointerId;lastX=e.clientX;lastY=e.clientY;orbit.begin(e.timeStamp);
    renderer.domElement.setPointerCapture(e.pointerId);
  }
  function move(e:PointerEvent){
    if(e.pointerId!==activePointer)return;
    orbit.move(e.clientX-lastX,e.clientY-lastY,e.timeStamp);lastX=e.clientX;lastY=e.clientY;
  }
  function up(e:PointerEvent){
    if(e.pointerId!==activePointer)return;
    activePointer=null;orbit.end(e.timeStamp,e.type!=='pointerup');
    if(renderer.domElement.hasPointerCapture(e.pointerId))renderer.domElement.releasePointerCapture(e.pointerId);
  }
  function blur(){activePointer=null;orbit.end(performance.now(),true)}
  function key(e:KeyboardEvent){
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(e.key))return;
    e.preventDefault();e.stopPropagation();
    if(e.key==='Home')orbit.reset();
    else orbit.nudge(e.key==='ArrowLeft'?.15:e.key==='ArrowRight'?-.15:0,e.key==='ArrowUp'?.07:e.key==='ArrowDown'?-.07:0);
  }
  renderer.domElement.tabIndex=0;
  renderer.domElement.setAttribute('aria-label','Orbit the yacht and sea: drag, or use arrow keys. Home resets the camera.');
  renderer.domElement.addEventListener('pointerdown',down);renderer.domElement.addEventListener('pointermove',move);
  renderer.domElement.addEventListener('pointerup',up);renderer.domElement.addEventListener('pointercancel',up);
  renderer.domElement.addEventListener('lostpointercapture',up);renderer.domElement.addEventListener('keydown',key);
  window.addEventListener('blur',blur);
  const contextLost=(e:Event)=>{e.preventDefault();setFailed(true);cancelAnimationFrame(raf)};renderer.domElement.addEventListener('webglcontextlost',contextLost);
  resetRef.current=()=>{orbit.reset()};
  const colors=['#e4c99c','#d7e1ec','#afd8d4','#bbcab1','#c8c2e9'];const color=new THREE.Color();
  function frame(time:number){if(disposed)return;raf=requestAnimationFrame(frame);const dt=Math.min((time-lastTime)/1000,.05)||.016;lastTime=time;if(document.hidden)return;if(!pausedRef.current&&!reduced)elapsed+=dt;
   smooth=THREE.MathUtils.damp(smooth,progress.current,5,dt);if(Math.abs(smooth-progress.current)<.0001)smooth=progress.current;const current=Math.min(3,Math.floor(smooth)),mix=Math.min(1,smooth-current);
   if(chapter!==current){geometry.setAttribute('aFrom',new THREE.BufferAttribute(shapes[current],4));geometry.setAttribute('aTo',new THREE.BufferAttribute(shapes[current+1],4));reflectionSamples.geometry.setAttribute('aFrom',new THREE.BufferAttribute(reflectionSamples.targets[current],4));reflectionSamples.geometry.setAttribute('aTo',new THREE.BufferAttribute(reflectionSamples.targets[current+1],4));chapter=current}
   color.set(colors[current]).lerp(new THREE.Color(colors[current+1]),mix);for(const mat of [material,reflectionMaterial]){mat.uniforms.uMix.value=mix;mat.uniforms.uTime.value=elapsed;mat.uniforms.uColor.value.copy(color)}
   orbit.update(dt,reduced);
   const narrow=camera.aspect<1,radius=narrow?38.65:26.14,targetY=narrow?3.3:2.2;
   const horizontal=radius*Math.cos(orbit.elevation);
   camera.position.set(horizontal*Math.sin(orbit.azimuth),targetY+radius*Math.sin(orbit.elevation),horizontal*Math.cos(orbit.azimuth));
   camera.lookAt(0,targetY,0);
   reflectedYacht.position.copy(yacht.position);reflectedYacht.rotation.copy(yacht.rotation);
   sea.render(renderer,camera,elapsed);composer.render();
  }raf=requestAnimationFrame(frame);setReady(true);
  return()=>{disposed=true;cancelAnimationFrame(raf);window.removeEventListener('resize',resize);window.removeEventListener('blur',blur);renderer.domElement.removeEventListener('lostpointercapture',up);renderer.domElement.removeEventListener('keydown',key);renderer.domElement.removeEventListener('pointerdown',down);renderer.domElement.removeEventListener('pointermove',move);renderer.domElement.removeEventListener('pointerup',up);renderer.domElement.removeEventListener('pointercancel',up);renderer.domElement.removeEventListener('webglcontextlost',contextLost);geometry.dispose();material.dispose();reflectionMaterial.dispose();reflectionSamples.geometry.dispose();sea.dispose();bloom.dispose();composer.dispose();renderer.dispose();renderer.domElement.remove();resetRef.current=()=>{}};
 },[progress,resetRef]);
 return <div ref={host} className="scene" role="img" aria-label="Interactive three-dimensional particle yacht reflected on a living sea. Drag to orbit the camera around the yacht and sea, with smooth release inertia.">{!ready&&!failed&&<div className="loading">The horizon is taking shape</div>}{failed&&<div className="fallback"><h2>A different horizon awaits.</h2><p>This 3D voyage needs WebGL. Enable graphics acceleration in your browser, then reload to explore the vessels.</p></div>}</div>
}
