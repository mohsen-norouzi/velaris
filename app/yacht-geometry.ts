// Surface samples remain three-dimensional through every transition and rotation.
type P = [number,number,number,number];
export const PARTICLES=32000;
function random(seed:number){let s=seed;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296}}
export function makeYacht(kind:number,count=PARTICLES){
 const rand=random(9021+kind*101),p:P[]=[];
 const add=(x:number,y:number,z:number,b=1)=>p.push([x,y,z,b]);
 const line=(a:number[],b:number[],density=36,bright=1.2)=>{const n=Math.max(2,Math.ceil(Math.hypot(...a.map((v,i)=>v-b[i]))*density));for(let i=0;i<n;i++){const t=i/(n-1);add(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t,bright)}};
 const circle=(x:number,y:number,z:number,r:number,plane='xy')=>{for(let i=0;i<85;i++){const t=i/85*Math.PI*2;add(x+Math.cos(t)*r,y+(plane==='xy'?Math.sin(t)*r:0),z+(plane==='xz'?Math.sin(t)*r:0),1.25)}};
 function hull(length:number,width:number,height:number,offset=0,center=0){
  const edge=(t:number,r:number,sign:number)=>{const taper=t<.26?Math.sin(t/.26*Math.PI/2):1-.12*(t-.26)/.74;return [center+(t-.5)*length+(1-r)*.7*(1-t),.06+height*r+.3*Math.pow(1-t,4),offset+sign*width*.5*taper*Math.pow(r,.54)]};
  for(let j=0;j<5800;j++){const t=rand(),r=rand(),s=rand()<.5?-1:1;const v=edge(t,r,s);add(v[0],v[1],v[2],.36+rand()*.32)}
  for(const r of [.08,.64,.92,1])for(const s of [-1,1]){for(let i=0;i<650;i++){const v=edge(i/649,r,s);add(v[0],v[1],v[2],r===1?1.35:.8)}}
  for(let j=0;j<1600;j++){const t=rand(),v=edge(t,1,1);add(v[0],v[1],offset+(v[2]-offset)*(rand()*2-1),.32)}
  for(let i=0;i<35;i++)for(const s of [-1,1]){const t=.10+i*.9/35,a=edge(t,1,s);line(a,[a[0],a[1]+.28,a[2]],18,.85)}
  for(const s of [-1,1])for(let i=0;i<650;i++){const v=edge(i/649,1,s);add(v[0],v[1]+.28,v[2],1.15)}
  for(let i=0;i<24;i++)for(const s of [-1,1]){const t=.28+i*.026,v=edge(t,.62,s);line([v[0]-.1,v[1],v[2]*1.005],[v[0]+.11,v[1],v[2]*1.005],30,1.35)}
  for(let i=0;i<9;i++){const r=i/8;line(edge(1,r,-1),edge(1,r,1),24,.7)}
 }
 function deck(start:number,end:number,width:number,y:number,height:number,offset=0){
  const perimeter=(t:number)=>{const a=t*Math.PI*2;return [(start+end)/2+(end-start)/2*Math.cos(a),offset+Math.sin(a)*width/2*(.83+.17*Math.cos(a))]};
  for(const h of [0,height*.23,height,height+.07]){for(let i=0;i<1000;i++){const [x,z]=perimeter(i/1000);add(x,y+h,z,1.3)}}
  for(let i=0;i<2200;i++){const a=rand()*Math.PI*2,r=Math.sqrt(rand());const x=(start+end)/2+(end-start)*.5*Math.cos(a)*r,z=offset+Math.sin(a)*width*.5*r*(.83+.17*Math.cos(a));add(x,y+height+.07,z,.32)}
  for(let i=0;i<1400;i++){const [x,z]=perimeter(rand());add(x,y+rand()*height,z,.25)}
  for(let i=0;i<42;i++){const [x,z]=perimeter(i/42);line([x,y+height*.25,z],[x+.05,y+height,z],18,.75)}
  for(let i=0;i<65;i++){const [x,z]=perimeter(i/65);line([x,y+height+.07,z],[x,y+height+.28,z],18,.6)}
  for(let i=0;i<900;i++){const [x,z]=perimeter(i/900);add(x,y+height+.28,z,1)}
 }
 const sphere=(x:number,y:number,z:number,r:number)=>{for(let i=0;i<500;i++){const a=rand()*Math.PI*2,b=Math.acos(rand()*2-1);add(x+r*Math.sin(b)*Math.cos(a),y+r*Math.cos(b),z+r*Math.sin(b)*Math.sin(a),.85)}};
 function mast(x:number,base:number,top:number,z=0){line([x,base,z],[x+.23,top,z],60,1.5);for(let j=0;j<3;j++)line([x-.55+j*.12,base+(top-base)*(.48+j*.18),z],[x+.65-j*.12,base+(top-base)*(.48+j*.18),z],45);sphere(x+.23,top,z,.065)}
 if(kind===0){hull(17,3.8,1.35);deck(-4.6,7.3,3.7,1.44,.75);deck(-3.1,6.7,3.05,2.30,.7);deck(-1.4,5.6,2.43,3.11,.58);deck(.2,4.25,1.9,3.82,.27);mast(2.45,4.25,6.7);for(const z of [-.69,.69])sphere(2.6,4.64,z,.25);line([-1,4.25,0],[2.45,5.38,0]);line([2.45,5.38,0],[4,4.25,0]);for(let i=0;i<6;i++)line([6+i*.22,1.38+i*.105,-1.2],[6+i*.22,1.38+i*.105,1.2],28,.95)}
 if(kind===1){hull(17,2.65,.85);deck(-1.9,4.8,2.05,.95,.36);mast(-1.1,1.3,9.2);line([-1.1,8.95,0],[-7.9,1.18,0]);line([-1.1,8.95,0],[7.1,1.2,0]);line([-1.05,1.65,0],[5.5,1.65,0],50);for(let i=0;i<11500;i++){let u=rand(),v=rand();if(u+v>1){u=1-u;v=1-v}const left=i<5400;const a=[-1.04,8.83,0],b=left?[-7.3,1.5,0]:[-.98,1.7,0],c=left?[-1.1,1.5,0]:[5.4,1.7,0];add(a[0]+u*(b[0]-a[0])+v*(c[0]-a[0]),a[1]+u*(b[1]-a[1])+v*(c[1]-a[1]),Math.sin(u*Math.PI)*Math.sin(v*Math.PI)*(left?.7:1.2),rand()<.2?.8:.35)}line([-7.3,1.5,0],[-1.1,1.5,0]);line([-1.04,8.83,0],[5.4,1.7,0]);for(let j=1;j<8;j++){const y=1.7+j*.8,t=(y-1.7)/7.13;line([-1.04,y,0],[5.4-(6.44*t),y,.07],30,.6)}}
 if(kind===2){hull(14,1.6,1.1,-2.5);hull(14,1.6,1.1,2.5);deck(-3.8,6.1,6.3,1.18,.57);deck(-1.8,4.7,4.8,1.87,.8);deck(.25,3.7,3.4,2.8,.24);mast(2,3.2,4.8);for(let j=0;j<25;j++)line([-5.8+j*.1,1.1,-1.8],[-5.8+j*.1,1.1,1.8],13,.4);for(const z of [-1.9,1.9])line([-6.5,1.35,z],[-2.5,1.35,z],45)}
 if(kind===3){hull(16,4.05,1.75);deck(-5.4,6.7,3.85,1.85,.54);deck(-5.1,2.8,3.36,2.5,.78);deck(-4.4,1.75,2.85,3.39,.79);deck(-3.6,.65,2.25,4.3,.27);mast(-1.2,4.6,7.1);sphere(-.3,4.95,.5,.3);circle(4.35,2.42,0,1.15,'xz');line([3.85,2.43,-.45],[3.85,2.43,.45]);line([4.85,2.43,-.45],[4.85,2.43,.45]);line([3.85,2.43,0],[4.85,2.43,0]);line([2.1,2.43,-1.35],[2.1,3.35,-1.35]);line([2.1,3.35,-1.35],[4.6,3.05,-1.35]);}
 if(kind===4){hull(18,2.5,1.07);hull(12,1.05,.63,-3.15,1.7);hull(12,1.05,.63,3.15,1.7);deck(-4.3,7.2,6.7,1.12,.36);deck(-3,5.9,4.1,1.58,.65);deck(-1.5,4.8,2.9,2.34,.41);for(const z of [-1.25,1.25]){for(let i=0;i<1200;i++){const t=i/1199;add(-2.4+t*7.4,2.35+Math.sin(t*Math.PI)*1.37,z*(1-.65*Math.sin(t*Math.PI)),1.3)}line([-.8,3.6,z*.5],[4.5,2.72,z],40)}mast(2.4,2.95,4.8);}
 const result=new Float32Array(count*4);for(let i=0;i<count;i++){const sample=p[Math.floor(rand()*p.length)];result.set(sample,i*4)}return result;
}
