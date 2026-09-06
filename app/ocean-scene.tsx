'use client';
import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { makeYacht, PARTICLES } from './yacht-geometry';
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
 if(uReflect>.5){float height=p.y;p.y=-p.y*.83-.06;p.x+=sin(p.z*5.+uTime*1.5+height*3.)*(.025+height*.045);p.z+=sin(p.x*3.-uTime*.8)*.075;vAlpha*=.37*exp(-height*.16);}
 vec4 mv=modelViewMatrix*vec4(p,1.0); gl_Position=projectionMatrix*mv;
 gl_PointSize=clamp((25.+aSeed.z*28.)*uDpr/-mv.z, .7, 4.5*uDpr);
 if(uReflect>.5)gl_PointSize*=1.45;
}
`;
const fragment=`
uniform float uReflect;uniform vec3 uColor;varying float vAlpha;varying float vGold;
void main(){vec2 uv=gl_PointCoord-.5; if(uReflect>.5)uv.x*=1.6;float d=length(uv);if(d>.5)discard;float glow=pow(1.-d*2.,1.35);vec3 col=mix(vec3(.96,.97,.91),uColor,vGold*.65);gl_FragColor=vec4(col*vAlpha*1.42,glow*min(vAlpha,1.));}
`;
const waterVertex=`uniform float uTime;varying vec3 vPos;void main(){vec3 p=position;p.z+=sin(p.x*.8+uTime*.7)*.015+sin(p.y*.6-uTime*.8)*.015;vPos=vec3(p.x,p.z,p.y);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`;
const waterFragment=`uniform float uTime;varying vec3 vPos;void main(){vec2 p=vPos.xz;float wave=sin(p.y*14.+sin(p.x*.8+uTime*.5)*2.+uTime)*.5+.5;float fine=pow(wave,24.);float path=exp(-pow(p.x*.13,2.));float fade=exp(-length(p)*.045);float shimmer=fine*path*fade*.12;vec3 c=vec3(.003,.008,.009)+vec3(.46,.43,.34)*shimmer;gl_FragColor=vec4(c,1.);}`;
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
  const reflectionMaterial=material.clone();reflectionMaterial.uniforms.uReflect.value=1;const reflection=new THREE.Points(geometry,reflectionMaterial);reflection.frustumCulled=false;yacht.add(reflection);
  const waterGeometry=new THREE.PlaneGeometry(180,180,1,1);const waterMaterial=new THREE.ShaderMaterial({vertexShader:waterVertex,fragmentShader:waterFragment,uniforms:{uTime:{value:0}},transparent:true,depthWrite:false});const water=new THREE.Mesh(waterGeometry,waterMaterial);water.rotation.x=-Math.PI/2;water.position.y=-.075;water.renderOrder=-1;scene.add(water);
  const seaCount=mobile?8500:17000,seaPositions=new Float32Array(seaCount*3),seaSeeds=new Float32Array(seaCount);for(let i=0;i<seaCount;i++){seaPositions[i*3]=(Math.random()-.5)*115;seaPositions[i*3+1]=-.015;seaPositions[i*3+2]=(Math.random()-.5)*105;seaSeeds[i]=Math.random()}
  const seaGeometry=new THREE.BufferGeometry();seaGeometry.setAttribute('position',new THREE.BufferAttribute(seaPositions,3));seaGeometry.setAttribute('aSeed',new THREE.BufferAttribute(seaSeeds,1));
  const seaMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{uTime:{value:0},uDpr:{value:renderer.getPixelRatio()}},vertexShader:`attribute float aSeed;uniform float uTime,uDpr;varying float vAlpha;void main(){vec3 p=position;p.y+=sin(p.x*.5+uTime*.65)*.035+sin(p.z*.8-uTime*.5)*.035;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp((6.+aSeed*19.)*uDpr/-mv.z,.65,4.*uDpr);vAlpha=(.08+pow(aSeed,14.)*.65)*(.45+.55*pow(sin(p.x*2.+p.z*3.+uTime*.6)*.5+.5,3.));vAlpha*=exp(-abs(p.x)*.026);}`,fragmentShader:`varying float vAlpha;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(.72,.76,.69,(1.-d*2.)*vAlpha);}`});scene.add(new THREE.Points(seaGeometry,seaMaterial));
  const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));const bloom=new UnrealBloomPass(new THREE.Vector2(1,1),.62,.6,.62);composer.addPass(bloom);composer.addPass(new OutputPass());
  let targetRotation=.12,rotation=.12,targetElevation=3.55,elevation=3.55,drag=false,lastX=0,lastY=0,raf=0,elapsed=0,lastTime=0,smooth=progress.current,chapter=-1,disposed=false;
  function resize(){const w=el.clientWidth,h=el.clientHeight;renderer.setSize(w,h);composer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix()};resize();window.addEventListener('resize',resize);
  function down(e:PointerEvent){if(e.button!==0)return;drag=true;lastX=e.clientX;lastY=e.clientY;renderer.domElement.setPointerCapture(e.pointerId)}
  function move(e:PointerEvent){if(!drag)return;targetRotation+=(e.clientX-lastX)*.006;targetElevation=THREE.MathUtils.clamp(targetElevation+(e.clientY-lastY)*.018,1.1,13);lastX=e.clientX;lastY=e.clientY}
  function up(){drag=false}renderer.domElement.addEventListener('pointerdown',down);renderer.domElement.addEventListener('pointermove',move);renderer.domElement.addEventListener('pointerup',up);renderer.domElement.addEventListener('pointercancel',up);
  const contextLost=(e:Event)=>{e.preventDefault();setFailed(true);cancelAnimationFrame(raf)};renderer.domElement.addEventListener('webglcontextlost',contextLost);
  resetRef.current=()=>{targetRotation=.12;targetElevation=3.55};
  const colors=['#e4c99c','#d7e1ec','#afd8d4','#bbcab1','#c8c2e9'];const color=new THREE.Color();
  function frame(time:number){if(disposed)return;raf=requestAnimationFrame(frame);const dt=Math.min((time-lastTime)/1000,.05)||.016;lastTime=time;if(document.hidden)return;if(!pausedRef.current&&!reduced)elapsed+=dt;
   smooth=THREE.MathUtils.damp(smooth,progress.current,5,dt);if(Math.abs(smooth-progress.current)<.0001)smooth=progress.current;const current=Math.min(3,Math.floor(smooth)),mix=Math.min(1,smooth-current);
   if(chapter!==current){geometry.setAttribute('aFrom',new THREE.BufferAttribute(shapes[current],4));geometry.setAttribute('aTo',new THREE.BufferAttribute(shapes[current+1],4));chapter=current}
   color.set(colors[current]).lerp(new THREE.Color(colors[current+1]),mix);for(const mat of [material,reflectionMaterial]){mat.uniforms.uMix.value=mix;mat.uniforms.uTime.value=elapsed;mat.uniforms.uColor.value.copy(color)}waterMaterial.uniforms.uTime.value=elapsed;seaMaterial.uniforms.uTime.value=elapsed;
   rotation=THREE.MathUtils.damp(rotation,targetRotation,6,dt);elevation=THREE.MathUtils.damp(elevation,targetElevation,6,dt);yacht.rotation.y=rotation+(reduced||pausedRef.current?0:Math.sin(elapsed*.10)*.035);yacht.position.x=window.innerWidth<800?0:1.3;
   const narrow=camera.aspect<1,dist=narrow?37:25;camera.position.set(-dist*.30,elevation*(narrow?1.4:1),dist);camera.lookAt(narrow?0:-.8,narrow?3.3:2.2,0);composer.render();
  }raf=requestAnimationFrame(frame);setReady(true);
  return()=>{disposed=true;cancelAnimationFrame(raf);window.removeEventListener('resize',resize);renderer.domElement.removeEventListener('pointerdown',down);renderer.domElement.removeEventListener('pointermove',move);renderer.domElement.removeEventListener('pointerup',up);renderer.domElement.removeEventListener('pointercancel',up);renderer.domElement.removeEventListener('webglcontextlost',contextLost);geometry.dispose();material.dispose();reflectionMaterial.dispose();waterGeometry.dispose();waterMaterial.dispose();seaGeometry.dispose();seaMaterial.dispose();bloom.dispose();composer.dispose();renderer.dispose();renderer.domElement.remove();resetRef.current=()=>{}};
 },[progress,resetRef]);
 return <div ref={host} className="scene" role="img" aria-label="Interactive three-dimensional particle yacht reflected on a living sea. Drag horizontally to rotate and vertically to change the viewing angle.">{!ready&&!failed&&<div className="loading">The horizon is taking shape</div>}{failed&&<div className="fallback"><h2>A different horizon awaits.</h2><p>This 3D voyage needs WebGL. Enable graphics acceleration in your browser, then reload to explore the vessels.</p></div>}</div>
}
