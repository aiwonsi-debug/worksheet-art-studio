// Replicate renderLayer for ink path with 3 points
const clamp = v => Math.max(0, Math.min(1, v));
const interpolate = (a, b, t) => ({ x: a.x + (b.x - a.x)*t, y: a.y + (b.y - a.y)*t });
const midpoint = (a, b) => ({ x: (a.x+b.x)/2, y: (a.y+b.y)/2 });
const smoothingJoin = (a, b, s) => interpolate(a, midpoint(a,b), s);
function ribbonStrokePath(points, smoothing=1, taper=0.55) {
  const amount = clamp(smoothing), n = points.length;
  const widths = points.map((p,i)=> i===0||i===n-1 ? (()=>{const o=i===0?points[1]:points[i-1];const r=Math.min(p.size,o.size)/(Math.max(p.size,o.size)||1);return p.size*Math.min(1,r+taper*(1-r));})() : p.size);
  const tangents = points.map((p,i)=>{ const pj=i>0?smoothingJoin(points[i-1],p,amount):p; const nj=i<n-1?smoothingJoin(p,points[i+1],amount):p; const tx=nj.x-pj.x,ty=nj.y-pj.y; const l=Math.hypot(tx,ty)||1; return {x:tx/l,y:ty/l}; });
  const left = points.map((p,i)=>({x:p.x-tangents[i].y*widths[i]/2, y:p.y+tangents[i].x*widths[i]/2}));
  const right = points.map((p,i)=>({x:p.x+tangents[i].y*widths[i]/2, y:p.y-tangents[i].x*widths[i]/2}));
  let d = `M ${left[0].x} ${left[0].y}`;
  for (let i=1;i<n;i++) d += ` L ${left[i].x} ${left[i].y}`;
  d += ` A ${widths[n-1]/2} ${widths[n-1]/2} 0 0 0 ${right[n-1].x} ${right[n-1].y}`;
  for (let i=n-2;i>=0;i--) d += ` L ${right[i].x} ${right[i].y}`;
  d += ` A ${widths[0]/2} ${widths[0]/2} 0 0 0 ${left[0].x} ${left[0].y} Z`;
  return d;
}
const pts=[{x:1,y:2,size:4},{x:8,y:9,size:15},{x:20,y:14,size:10}];
const d = ribbonStrokePath(pts);
const layer = {points: pts, opacity:1, color:"#4263eb", smoothing:1};
const fragment = `<g opacity="${layer.opacity}" style="mix-blend-mode:normal"><path d="${d}" fill="${layer.color}" /></g>`;
console.log(fragment.slice(-120));
console.log("---ends-with:", fragment.endsWith("</g>"));
console.log("contains Z:", fragment.includes("Z"));
