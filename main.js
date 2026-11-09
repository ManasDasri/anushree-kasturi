const $ = (s) => document.querySelector(s);
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const token = (v) => { const h = getComputedStyle(document.documentElement).getPropertyValue(v).trim(); return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); };

/* ---- a small WebGL runner for Forme's shaders (src/registry/shader-canvas.tsx): renders
   only while on screen and the tab is visible, at most ~30fps; one still frame with
   reduced motion. ---- */
function shader(canvas, fragment, { ratio = 1.25, speed = 1, start = 0, tint, size, pointer } = {}) {
  const gl = canvas.getContext("webgl", { alpha: false, antialias: false, powerPreference: "low-power" });
  if (!gl) return;
  const compile = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}"));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const U = (n) => gl.getUniformLocation(prog, n);
  const mouse = [0.5, 0.5], target = [0.5, 0.5];
  let visible = true, last = 0;
  const draw = (ms) => {
    mouse[0] += (target[0] - mouse[0]) * 0.08; mouse[1] += (target[1] - mouse[1]) * 0.08;
    gl.uniform2f(U("u_mouse"), mouse[0], mouse[1]);
    gl.uniform1f(U("u_time"), start + ms / 1000 * speed);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };
  const resize = () => {
    const r = Math.min(devicePixelRatio || 1, ratio), [w, h] = size();
    canvas.width = Math.round(w * r); canvas.height = Math.round(h * r);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(U("u_resolution"), canvas.width, canvas.height);
    gl.uniform1f(U("u_ratio"), r);
    draw(performance.now());
  };
  const recolor = () => { tint((n, rgb) => gl.uniform3f(U(n), ...rgb)); draw(performance.now()); };
  tint((n, rgb) => gl.uniform3f(U(n), ...rgb));
  resize();
  addEventListener("resize", resize);
  addEventListener("theme-change", recolor);
  if (pointer) pointer.addEventListener("pointermove", (e) => {
    const b = pointer.getBoundingClientRect();
    target[0] = (e.clientX - b.left) / b.width; target[1] = 1 - (e.clientY - b.top) / b.height;
  });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);
  if (REDUCED) return;
  (function loop(ms) {
    requestAnimationFrame(loop);
    if (!visible || document.hidden || ms - last < 33) return;
    last = ms; draw(ms);
  })(0);
}

/* ---- Forme's Contours (src/registry/contours-shader.tsx) behind the page, in the theme's
   colours: accent lines, secondary index lines ---- */
shader($("#contours"), `precision mediump float;
uniform vec2 u_resolution; uniform float u_time; uniform vec3 u_color; uniform vec3 u_index; uniform vec3 u_bg;
float hash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.0-2.0*f);
 return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);}
float height(vec2 p,float t){float h=0.0,a=.55;vec2 q=p+vec2(t*.04,-t*.025);
 for(int i=0;i<4;i++){h+=a*noise(q);q=q*2.03+vec2(1.7,9.2)+t*.015;a*=.5;}return h;}
void main(){
 vec2 p=(gl_FragCoord.xy-.5*u_resolution)/u_resolution.y*2.4;
 float t=u_time,levels=22.0,h=height(p,t)*levels,e=1.5/u_resolution.y*2.4;
 vec2 g=vec2(height(p+vec2(e,0.),t)-height(p-vec2(e,0.),t),height(p+vec2(0.,e),t)-height(p-vec2(0.,e),t))*levels/(2.*e);
 float px=length(g)*(2.4/u_resolution.y)+1e-4,d=abs(fract(h)-.5)*2.0,dist=(1.0-d)*.5/px;
 float line=1.0-smoothstep(.5,1.5,dist),index=step(mod(floor(h+.5),5.0),.5),lineIndex=1.0-smoothstep(.75,1.8,dist);
 float a=mix(line*.38,lineIndex*.9,index)*(1.0-.5*smoothstep(.6,1.9,length(p)));
 gl_FragColor=vec4(mix(u_bg,mix(u_color,u_index,index),a),1.0);}`, {
  ratio: 1, speed: 0.35, start: 20,
  size: () => [innerWidth, innerHeight],
  tint: (set) => { set("u_color", token("--sig")); set("u_index", token("--lav")); set("u_bg", token("--ink")); },
});

/* ---- Forme's Planet shader (src/registry/planet-shader.tsx) in the header: a ringed
   planet over a sea, drawn as ASCII inside the shader. The pointer moves the sunlight and
   ripples the water. Verbatim from Forme. ---- */
const banner = $(".banner");
shader($("#planet"), `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 u_resolution; uniform vec2 u_mouse; uniform float u_time; uniform vec3 u_color; uniform float u_ratio;
// Cell size in CSS pixels; the canvas renders at device resolution so small glyphs stay crisp.
const vec2 CELL_CSS = vec2(4.5, 7.5);
// Whole device pixels, so every glyph lands on the pixel grid. Below 1.5x there are too
// few pixels to draw a glyph that small, so standard screens use a slightly larger cell.
#define CELL (u_ratio>1.5?floor(CELL_CSS*u_ratio+.5):vec2(6.,10.))
const float HORIZON = -0.24;
float hash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*noise(p);p*=2.03;a*=.5;}return v;}
mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}

vec3 violet=vec3(.33,.27,.62), pale=vec3(.84,.86,1.0), amber=vec3(1.0,.84,.56);
const vec2 PLANET=vec2(0.0,HORIZON+.31);
const float R=.2;
const float TILT=-.3;
// The ring plane seen from slightly above: depth d in the plane shows on screen as d*RING_SIN.
// RING_D points across the plane toward its far side; RING_N is the plane's normal.
const float RING_SIN=.22;
const vec3 RING_D=vec3(0.,.22,-.9755);
const vec3 RING_N=vec3(0.,.9755,.22);

vec3 lightDir(){return normalize(vec3((u_mouse.x-.5)*2.6,.5,.75));}

// Brightness across the ring, from its inner edge (0) to its outer edge (1): a faint inner
// ring, the bright main ring, the dark Cassini division, then the outer ring with a thin gap.
float ringProfile(float r){
 float c=smoothstep(.0,.05,r)*smoothstep(.2,.16,r)*.35;
 float b=smoothstep(.16,.2,r)*smoothstep(.6,.58,r)*(.85+.15*sin(r*60.));
 float a=smoothstep(.65,.67,r)*smoothstep(1.,.97,r)*.62*(1.-.8*smoothstep(.85,.86,r)*smoothstep(.88,.87,r));
 return c+b+a;
}

// Everything above the waterline: stars, horizon glow, the planet, and its ring.
vec3 sky(vec2 p, vec2 cell){
 float t=u_time;
 vec3 L=lightDir(), ice=u_color, col=vec3(0.0);
 vec2 c=PLANET;
 float s=hash(cell);
 col+=step(.986,s)*(.3+.3*sin(t*1.6+s*60.))*vec3(.85,.88,1.);
 col+=ice*.2*exp(-max(p.y-HORIZON,0.)*9.)*(.6+.4*exp(-abs(p.x-c.x)*1.4));
 // Planet frame: x along the ring, y along the spin axis.
 vec2 q=rot(TILT)*(p-c)/R;
 vec3 Lp=vec3(rot(TILT)*L.xy,L.z); // the light in the planet's frame
 float r2=dot(q,q);
 // The ring plane, seen from slightly above: inner edge 1.25R, outer edge 2.3R.
 float e=length(vec2(q.x,q.y/RING_SIN));
 float ringR=(e-1.25)/(2.3-1.25);
 float ring=ringR>0.&&ringR<1.?ringProfile(ringR):0.;
 bool behind=q.y>0.0 && r2<1.0;
 if(r2<1.0){
  float z=sqrt(1.-r2);
  vec3 n=vec3(rot(-TILT)*q,z);
  float diff=smoothstep(-.08,.5,dot(n,L));
  // Soft latitude bands that drift slowly, darker toward the limb.
  float lat=q.y;
  float lon=atan(q.x,z)+t*.05;
  float b=sin(lat*8.+fbm(vec2(lon*1.5,lat*3.)+t*.02)*1.3)*.5+sin(lat*21.)*.12;
  vec3 surf=mix(mix(pale,amber,.45),violet*1.3,.5-.5*b);
  surf=mix(surf,pale,smoothstep(.75,1.,lat)*.5);
  // The ring's shadow: follow the ray from this point toward the light to the ring plane,
  // and darken by how dense the ring is where it crosses. Gaps let the light through.
  vec3 np=vec3(q,z);
  float t1=-dot(np,RING_N)/dot(Lp,RING_N);
  float shade=1.;
  if(t1>0.){
   vec3 X=np+Lp*t1;
   float rr=(length(vec2(X.x,dot(X,RING_D)))-1.25)/(2.3-1.25);
   if(rr>0.&&rr<1.) shade=1.-.7*ringProfile(rr)*smoothstep(.0,.25,diff);
  }
  col=surf*(.03+.72*diff)*pow(z,.3)*shade;
  col+=ice*pow(1.-z,4.)*.35*diff;
 } else {
  float d=sqrt(r2)-1.;
  float lit=max(dot(vec3(rot(-TILT)*normalize(q),0.),L),0.);
  col+=ice*exp(-d*22.)*(.08+.55*lit);
 }
 if(!behind && ring>0.){
  // The planet's shadow on the ring: from this ring point, does the ray toward the light
  // pass through the planet? Soft at the edge, and it lands mostly on the far side.
  vec3 P=vec3(q.x,0.,0.)+RING_D*(q.y/RING_SIN);
  float bb=dot(P,Lp);
  float closest=sqrt(max(dot(P,P)-bb*bb,0.));
  float inShadow=(1.-smoothstep(.93,1.05,closest))*smoothstep(0.,-.2,bb);
  float planetShadow=1.-.82*inShadow;
  vec3 ringCol=mix(mix(pale,amber,.45),vec3(1.),.25);
  col=mix(col,ringCol*(.3+.95*ring)*planetShadow,clamp(ring*1.7,0.,1.));
 }
 return col;
}

// Swell height at a point on the sea, in perspective.
float swell(vec2 p){
 float t=u_time;
 float z=.32/(HORIZON-p.y+.012);
 float wx=p.x*z;
 return sin(wx*2.2+z*1.7-t*1.1)*.5+sin(wx*-1.3+z*2.9+t*.8)*.35+sin(wx*4.7-z*.9+t*1.7)*.15;
}

vec3 scene(vec2 p, vec2 cell){
 if(p.y>HORIZON) return sky(p,cell);
 float aspect=u_resolution.x/u_resolution.y;
 float t=u_time;
 vec3 ice=u_color, L=lightDir();
 float v=HORIZON-p.y;
 // Surface slope from the swells, by finite differences.
 float h=swell(p);
 const float E=.004;
 vec2 slope=vec2(swell(p+vec2(E,0.))-h,swell(p-vec2(0.,E))-h)/E*.012*(.3+v*2.5);
 // Pointer ripples: rings that tilt the surface, flattened by perspective and damped as
 // they spread. They fade in as the pointer drops below the horizon.
 vec2 m=vec2((u_mouse.x-.5)*aspect,u_mouse.y-.5);
 float onSea=smoothstep(HORIZON-.02,HORIZON-.14,m.y);
 vec2 dm=(p-m)*vec2(1.,2.8);
 float dist=length(dm)+1e-4;
 float phase=dist*46.-t*5.;
 float damp=exp(-dist*7.)*smoothstep(0.,.015,dist);
 float dr=(cos(phase)*46.-sin(phase)*7.)*damp;
 slope+=onSea*dr*(dm/dist)*vec2(1.,2.8)*.002;
 // Mirror the sky, a little compressed, and let the slope bend what the water shows.
 vec2 rp=vec2(p.x,HORIZON+v*.8)+slope*vec2(.9,1.6);
 vec2 rcell=floor((rp*u_resolution.y+.5*u_resolution)/CELL);
 float fresnel=mix(.95,.4,clamp(v*1.4,0.,1.));
 vec3 col=sky(rp,rcell)*fresnel*vec3(.86,.9,1.);
 // Facets turned toward the light catch a little of it; the far water hazes over.
 float facing=dot(normalize(vec3(-slope*6.,1.)),normalize(vec3(L.x,.35,.9)));
 col+=pale*pow(max(facing,0.),40.)*.25*exp(-v*1.4);
 col+=pale*.05*(h*.5+.5)*exp(-v*1.6);
 col+=ice*.24*exp(-v*14.);
 return col;
}

// Glyphs drawn from simple shapes, densest last: . : - + x # @
float glyph(vec2 g, float level){
 vec2 d=abs(g-.5);
 float dot1=step(length((g-vec2(.5,.22))*vec2(1.,1.6)),.12);
 if(level<1.) return 0.;
 if(level<2.) return dot1;
 if(level<3.) return max(dot1,step(length((g-vec2(.5,.62))*vec2(1.,1.6)),.12));
 float h=step(d.y,.06)*step(d.x,.32);
 if(level<4.) return h;
 float v=step(d.x,.08)*step(d.y,.3);
 if(level<5.) return max(h,v);
 vec2 r=rot(.6)*(g-.5)*vec2(1.,.62);
 vec2 r2=rot(-.6)*(g-.5)*vec2(1.,.62);
 float x=max(step(abs(r.x),.06)*step(abs(r.y),.3),step(abs(r2.x),.06)*step(abs(r2.y),.3));
 if(level<6.) return max(x,h);
 float hash2=max(step(abs(abs(g.y-.5)-.14),.05)*step(d.x,.34),step(abs(abs(g.x-.5)-.15),.06)*step(d.y,.34));
 if(level<7.) return hash2;
 return step(d.x,.36)*step(d.y,.36)*(1.-step(length((g-.5)*vec2(1.,.6)),.13));
}

void main(){
 vec2 cell=floor(gl_FragCoord.xy/CELL);
 vec2 center=(cell+.5)*CELL;
 vec2 p=(center-.5*u_resolution)/u_resolution.y;
 vec3 col=scene(p,cell);
 float lum=dot(col,vec3(.3,.59,.11));
 // Lift the midtones so lit surfaces fill with denser glyphs.
 float level=floor(pow(clamp(lum*1.05,0.,1.),.78)*7.99);
 float g=glyph(fract(gl_FragCoord.xy/CELL),level);
 vec3 tone=mix(col/max(lum,.04)*.8,vec3(1.),clamp((lum-.7)*2.,0.,.6));
 vec3 o=tone*g*clamp(.35+lum*1.4,0.,1.)+col*.06;
 gl_FragColor=vec4(o,1.);
}`, {
  ratio: 2, speed: 0.8,
  size: () => [banner.clientWidth, banner.clientHeight],
  tint: (set) => set("u_color", token("--lav")),
  pointer: banner,
});

/* ---- Forme's Dock (src/registry/dock.tsx): icons swell toward the pointer ---- */
(function dock() {
  const small = innerWidth <= 640, SIZE = small ? 38 : 44, GAP = small ? 5 : 8, PAD = small ? 7 : 10, MAX_BOOST = 0.62;
  const ul = $(".forme-dock ul"), items = [...ul.children].filter((li) => !li.classList.contains("sep"));
  let space = Infinity, centers = [], raf = 0, px = null;
  // Measure each icon's centre once, at rest, when the pointer arrives. Re-measuring on every
  // move reads layout while the icons are resizing, which stalls the frame.
  const measure = () => { centers = items.map((el) => { const r = el.getBoundingClientRect(); return r.left + r.width / 2; }); };
  const magnify = (x) => {
    if (x === null || REDUCED) return items.forEach((el) => el.style.setProperty("--forme-dock-scale", "1"));
    const boosts = centers.map((c) => { const d = (x - c) / 90; return MAX_BOOST * Math.exp(-d * d); });
    const rest = items.length * SIZE + (items.length - 1) * GAP + PAD * 2;
    const room = Math.max(0, space - rest), growth = SIZE * boosts.reduce((a, b) => a + b, 0), k = growth > room ? room / growth : 1;
    items.forEach((el, i) => el.style.setProperty("--forme-dock-scale", String(1 + boosts[i] * k)));
  };
  ul.addEventListener("pointerenter", () => { space = $(".dock-wrap").clientWidth - 16; magnify(null); measure(); });
  addEventListener("resize", measure);
  // one update per frame; browsing the theme menu shouldn't magnify the icons
  ul.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    px = e.target.closest(".theme-menu") ? null : e.clientX;
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; magnify(px); });
  });
  ul.addEventListener("pointerleave", () => { cancelAnimationFrame(raf); raf = 0; magnify(null); });

  // the dot under the section in view
  const mark = (id) => items.forEach((li) => li.dataset.for === id ? li.setAttribute("data-active", "") : li.removeAttribute("data-active"));
  const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && mark(scrollY < 80 ? "top" : e.target.id)), { rootMargin: "-40% 0px -55% 0px" });
  items.forEach((li) => { const s = li.dataset.for && document.getElementById(li.dataset.for); if (s) io.observe(s); });
  addEventListener("scroll", () => scrollY < 80 && mark("top"), { passive: true });
  mark("top");
})();

/* ---- VS Code themes, from the dock. Each theme is a block of tokens in style.css; the
   choice is remembered per visitor. ---- */
(function themes() {
  const THEMES = [["sage", "Sage (default)"], ["dark-plus", "Dark+"], ["one-dark", "One Dark Pro"], ["dracula", "Dracula"], ["monokai", "Monokai"],
    ["github-dark", "GitHub Dark"], ["tokyo-night", "Tokyo Night"], ["catppuccin", "Catppuccin Mocha"], ["nord", "Nord"],
    ["light-plus", "Light+"], ["github-light", "GitHub Light"], ["solarized-light", "Solarized Light"]];
  const btn = $("#theme"), menu = $("#theme-menu");
  const current = () => document.documentElement.dataset.theme || "sage";
  for (const [id, name] of THEMES) {
    const b = document.createElement("button");
    b.type = "button"; b.setAttribute("role", "menuitemradio"); b.dataset.id = id;
    b.innerHTML = `<span class="sw" data-theme="${id}"></span>`;
    b.append(name);
    menu.append(b);
  }
  const sync = () => {
    menu.querySelectorAll("[role=menuitemradio]").forEach((b) => b.setAttribute("aria-checked", b.dataset.id === current()));
    document.querySelector('meta[name="theme-color"]').content = getComputedStyle(document.documentElement).getPropertyValue("--ink").trim();
  };
  const open = (on) => { menu.hidden = !on; btn.setAttribute("aria-expanded", on); if (on) menu.querySelector("[aria-checked=true]")?.focus(); };
  btn.addEventListener("click", () => open(menu.hidden));
  menu.addEventListener("click", (e) => {
    const b = e.target.closest("[role=menuitemradio]");
    if (!b) return;
    if (b.dataset.id === "sage") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = b.dataset.id;
    try { localStorage.setItem("theme", b.dataset.id); } catch {}
    sync(); dispatchEvent(new Event("theme-change"));
  });
  menu.addEventListener("keydown", (e) => {
    const list = [...menu.querySelectorAll("[role=menuitemradio]")], i = list.indexOf(document.activeElement);
    const d = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (d) { e.preventDefault(); list[(i + d + list.length) % list.length].focus(); }
  });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && !menu.hidden) { open(false); btn.focus(); } });
  addEventListener("pointerdown", (e) => { if (!menu.hidden && !e.target.closest("#theme, #theme-menu")) open(false); });
  sync();
})();

/* ---- $ whoami typewriter ---- */
const ROLES = ["CS student", "ML builder", "open-source contributor", "full-stack dev"];
if (!REDUCED) {
  const el = $("#role");
  let r = 0, n = ROLES[0].length, del = false;
  setTimeout(function step() {
    const word = ROLES[r];
    n += del ? -1 : 1;
    el.textContent = word.slice(0, n);
    let wait = del ? 40 : 85;
    if (!del && n === word.length) { del = true; wait = 1800; }
    else if (del && n === 0) { del = false; r = (r + 1) % ROLES.length; wait = 300; }
    setTimeout(step, wait);
  }, 1800);
}

/* ---- Now: segmented tabs (arrow keys move between them) ---- */
const seg = $(".segmented"), tabs = [...seg.querySelectorAll("button")];
const pick = (i) => {
  tabs.forEach((b, j) => {
    b.setAttribute("aria-selected", i === j);
    b.tabIndex = i === j ? 0 : -1;
    document.getElementById(b.getAttribute("aria-controls")).hidden = i !== j;
  });
  seg.dataset.i = i;
  $("#now-note").textContent = tabs[i].dataset.note;
};
tabs.forEach((b, i) => b.addEventListener("click", () => pick(i)));
seg.addEventListener("keydown", (e) => {
  const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
  if (!d) return;
  const i = ((+seg.dataset.i || 0) + tabs.length + d) % tabs.length;
  pick(i); tabs[i].focus();
});

/* ---- copy email ---- */
$("#copy").addEventListener("click", async (e) => {
  try { await navigator.clipboard.writeText("anushree.kasturi06@gmail.com"); e.target.textContent = "copied ✓"; setTimeout(() => e.target.textContent = "copy", 1800); } catch {}
});

/* ---- local time ---- */
const tick = () => $("#clock").textContent = new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" }) + " IST";
tick(); setInterval(tick, 30000);

/* ---- live GitHub calendar: stats, month labels, hover readout ---- */
const fmtDay = (iso) => new Date(iso + "T00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
function streaks(days) {
  let longest = 0, run = 0;
  for (const d of days) { run = d.count ? run + 1 : 0; longest = Math.max(longest, run); }
  let i = days.length - 1, cur = 0;
  if (i >= 0 && !days[i].count) i--; // today not counted yet doesn't break the streak
  while (i >= 0 && days[i].count) { cur++; i--; }
  return { longest, cur };
}
fetch("https://github-contributions-api.jogruber.de/v4/AnushreeKasturi?y=last")
  .then((r) => r.ok ? r.json() : Promise.reject())
  .then(({ contributions }) => {
    // coerce API fields before they touch innerHTML
    const all = contributions.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.date))
      .map((d) => ({ date: d.date, count: Math.max(0, d.count | 0), level: Math.min(4, Math.max(0, d.level | 0)) }));
    // the last six months (26 weeks), starting on a Sunday
    let start = all.length - 26 * 7;
    while (start > 0 && new Date(all[start].date + "T00:00").getDay() !== 0) start--;
    const days = all.slice(Math.max(0, start));
    const pad = new Date(days[0].date + "T00:00").getDay(); // first column starts on Sunday
    const cells = [...Array(pad).fill(null), ...days];
    $("#heat").innerHTML = cells.map((d) => d ? `<i data-l="${d.level}" data-c="${d.count}" data-d="${d.date}"></i>` : `<i class="pad"></i>`).join("");
    // a month's label sits over the first week that starts in it
    const weeks = Math.ceil(cells.length / 7);
    let prev = -1, months = "";
    for (let w = 0; w < weeks; w++) {
      const d = cells[w * 7] || cells[w * 7 + 6] || days[0], m = new Date(d.date + "T00:00").getMonth();
      months += `<span>${m !== prev && w < weeks - 2 ? new Date(d.date + "T00:00").toLocaleString("en-US", { month: "short" }) : ""}</span>`;
      prev = m;
    }
    $("#months").innerHTML = months;
    const total = days.reduce((s, d) => s + d.count, 0), { longest, cur } = streaks(days);
    $("#s-total").textContent = total.toLocaleString();
    $("#s-active").textContent = days.filter((d) => d.count).length;
    $("#s-long").textContent = longest + "d";
    $("#s-cur").textContent = cur + "d";
    $("#heat").setAttribute("aria-label", `${total} GitHub contributions in the last six months`);
    const tip = $("#tip");
    $("#heat").addEventListener("pointerover", (e) => {
      const c = e.target.dataset.c;
      if (c !== undefined) tip.textContent = `${c === "0" ? "No" : c} contribution${c === "1" ? "" : "s"} on ${fmtDay(e.target.dataset.d)}`;
    });
    $("#heat").addEventListener("pointerleave", () => tip.textContent = "hover a day");
  })
  .catch(() => { $(".cal").remove(); $(".gh-foot").remove(); $("#gh-tiles").outerHTML = `<p class="note" style="margin:0">couldn't reach GitHub right now · <a href="https://github.com/AnushreeKasturi">see the profile ↗</a></p>`; });

/* ---- open source, live from GitHub's search API. The numbers and list already in the
   page are the fallback if GitHub is unreachable or rate-limits the visitor. ---- */
(async function openSource() {
  const q = (extra) => fetch(`https://api.github.com/search/issues?per_page=100&sort=updated&q=${encodeURIComponent(`author:AnushreeKasturi type:pr -user:AnushreeKasturi ${extra}`)}`)
    .then((r) => r.ok ? r.json() : Promise.reject());
  try {
    const [merged, open] = await Promise.all([q("is:merged"), q("is:open")]);
    const repoOf = (pr) => pr.repository_url.split("/repos/")[1];
    $("#o-merged").textContent = merged.total_count;
    $("#o-repos").textContent = new Set(merged.items.map(repoOf)).size;
    $("#o-open").textContent = open.total_count;
    $("#oss-note").textContent = "pull requests merged into other people's projects · live from GitHub";
    // the newest merges, one per repository, with each repository's stars and language
    const seen = new Set(), latest = [];
    for (const pr of merged.items) { const r = repoOf(pr); if (!seen.has(r) && latest.length < 9) { seen.add(r); latest.push(pr); } }
    const repos = await Promise.all(latest.map((pr) => fetch(pr.repository_url).then((r) => r.ok ? r.json() : {}).catch(() => ({}))));
    const k = (n) => n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(n);
    const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; };
    $("#prs").replaceChildren(...latest.map((pr, i) => {
      const a = el("a"); a.href = pr.html_url; a.target = "_blank"; a.rel = "noopener";
      const repo = el("span", "repo", repoOf(pr));
      if (repos[i].stargazers_count) repo.append(el("em", "", `★ ${k(repos[i].stargazers_count)}`));
      a.append(repo, el("span", "t", pr.title));
      if (repos[i].language) a.append(el("span", "lang", repos[i].language));
      const li = el("li"); li.append(a); return li;
    }));
  } catch {}
})();
