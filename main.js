const $ = (s) => document.querySelector(s);
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const token = (v) => { const h = getComputedStyle(document.documentElement).getPropertyValue(v).trim(); return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); };

/* ---- a small WebGL runner for Forme's shaders (src/registry/shader-canvas.tsx): renders
   only while on screen and the tab is visible, at most ~30fps; one still frame with
   reduced motion. ---- */
function shader(canvas, fragment, { ratio = 1.25, speed = 1, start = 0, tint, size, pointer, hoverable = false, resized, each } = {}) {
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
  let visible = true, last = 0, hover = 0, hovering = !hoverable;
  const draw = (ms) => {
    mouse[0] += (target[0] - mouse[0]) * 0.3; mouse[1] += (target[1] - mouse[1]) * 0.3;
    hover += ((hovering ? 1 : 0) - hover) * 0.12;
    gl.uniform2f(U("u_mouse"), mouse[0], mouse[1]);
    gl.uniform1f(U("u_hover"), hover);
    gl.uniform1f(U("u_time"), start + ms / 1000 * speed);
    if (each) each(set);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };
  const resize = () => {
    const r = Math.min(devicePixelRatio || 1, ratio), [w, h] = size();
    canvas.width = Math.round(w * r); canvas.height = Math.round(h * r);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(U("u_resolution"), canvas.width, canvas.height);
    gl.uniform1f(U("u_ratio"), r);
    if (resized) resized(set, r);
    draw(performance.now());
  };
  const set = (n, v) => typeof v === "number" ? gl.uniform1f(U(n), v) : v.length === 2 ? gl.uniform2f(U(n), ...v) : v.length === 3 ? gl.uniform3f(U(n), ...v) : gl.uniform3fv(U(n), v);
  const apply = () => tint(set);
  const recolor = () => { apply(); draw(performance.now()); };
  apply();
  resize();
  addEventListener("resize", resize);
  addEventListener("theme-change", recolor);
  if (pointer) {
    pointer.addEventListener("pointermove", (e) => {
      const b = pointer === window ? { left: 0, top: 0, width: innerWidth, height: innerHeight } : pointer.getBoundingClientRect();
      target[0] = (e.clientX - b.left) / b.width; target[1] = 1 - (e.clientY - b.top) / b.height;
      if (!hovering) { mouse[0] = target[0]; mouse[1] = target[1]; }
      hovering = true;
    });
    (pointer === window ? document.documentElement : pointer).addEventListener("pointerleave", () => { hovering = false; });
  }
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);
  if (REDUCED) return;
  (function loop(ms) {
    requestAnimationFrame(loop);
    if (!visible || document.hidden || ms - last < 33) return;
    last = ms; draw(ms);
  })(0);
}

const SPACE = `precision mediump float;
uniform vec2 u_resolution; uniform float u_time; uniform float u_ratio; uniform float u_scroll;
uniform vec3 u_color; uniform vec3 u_index; uniform vec3 u_bg; uniform vec3 u_text;
uniform vec2 u_left; uniform vec2 u_right; uniform float u_margin;
float hash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*noise(p);p*=2.03;a*=.5;}return v;}
mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
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
 vec2 CELL=floor(vec2(6.,10.)*u_ratio+.5);
 vec2 cell=floor(gl_FragCoord.xy/CELL);
 vec2 c=(cell+.5)*CELL;
 float t=u_time, sc=u_scroll*u_ratio;
 vec3 L=normalize(vec3(.6,.5,.62));
 float lum=0.; vec3 col=u_text; float w=0.;

 // stars: three depths that drift and slide with scroll at different speeds
 for(int k=0;k<3;k++){
  float fk=float(k);
  vec2 off=vec2(t*(2.+fk*3.),sc*(.04+fk*.06))*u_ratio;
  vec2 sc2=floor((c+off)/CELL);
  float h=hash(sc2+fk*31.7);
  float on=step(.986-fk*.004,h);
  float tw=.55+.45*sin(t*(1.+fk)+h*120.);
  float b=on*tw*(.28+fk*.22);
  if(b>lum){lum=b; col=mix(u_text,u_index,step(.5,fract(h*13.))*.5);}
 }

 // left: a ringed planet with a moon, lit from the page's side, rising slowly as you scroll
 float R=u_margin*.34;
 vec2 P=u_left+vec2(0.,sc*.12);
 float tilt=-.32;
 vec2 q=rot(tilt)*((c-P)/R);
 vec3 Lp=vec3(rot(tilt)*L.xy,L.z);
 float r2=dot(q,q);
 // the ring: a flat ellipse from 1.35R to 2.3R with a dark gap, drawn behind or in front
 float e=length(vec2(q.x,q.y/.26));
 float rr=(e-1.35)/(2.3-1.35);
 float ring=0.;
 if(rr>0.&&rr<1.) ring=smoothstep(0.,.06,rr)*smoothstep(1.,.92,rr)*(.75+.25*sin(rr*30.))*(1.-.85*step(.56,rr)*step(rr,.63));
 bool ringFront=q.y<0.;
 if(ring>0.&&!ringFront&&r2>1.){lum=ring*.55; col=u_index;}
 if(r2<1.){
  vec3 n=vec3(q,sqrt(1.-r2));
  float diff=clamp(dot(n,Lp),0.,1.);
  float bands=sin(q.y*7.+fbm(vec2(q.x*1.5+t*.02,q.y*4.))*1.8);
  float rim=pow(1.-n.z,3.)*.35;
  float b=.05+.9*pow(diff,.8)*(.88+.12*bands)+rim*diff;
  lum=b; col=mix(u_text,u_color,.35+.2*bands);
 }
 if(ring>0.&&ringFront){
  // where the ring crosses in front of the planet's lit face it reads brighter
  float b=ring*(r2<1.?.95:.7);
  lum=max(lum*.25,b); col=u_index;
 }
 // a soft halo
 float pr=sqrt(r2);
 if(pr>1.) lum=max(lum,exp(-(pr-1.)*5.)*.16);
 // a moon on a slow orbit
 vec2 M=P+vec2(cos(t*.06+1.),sin(t*.06+1.)*.3)*R*2.9;
 vec2 mq=(c-M)/(R*.2);
 if(dot(mq,mq)<1.){vec3 mn=vec3(mq,sqrt(1.-dot(mq,mq))); lum=.05+.85*clamp(dot(mn,L),0.,1.); col=u_text;}

 // right: a spiral galaxy over a faint nebula, sliding a little slower than the page
 vec2 G=u_right+vec2(0.,sc*.07);
 vec2 g=rot(.55)*((c-G)/(u_margin*1.15)); g.y*=1.8;
 float r=length(g), a=atan(g.y,g.x);
 float arms=pow(.5+.5*cos(2.*a-5.5*log(r+.05)+t*.12),3.);
 float core=exp(-r*r*30.);
 float gal=exp(-r*2.)*(.2+.85*arms)*(.5+.6*fbm(g*4.+t*.05))+core*1.3;
 if(gal>lum){lum=gal; col=mix(u_color,u_text,clamp(core*1.5,0.,1.));}
 float neb=smoothstep(.45,.9,fbm((c-G)/u_resolution.y*2.6+vec2(t*.02,0.)))*exp(-r*.6)*.35;
 if(neb>lum){lum=neb; col=u_index;}

 // a shooting star every few seconds, in one margin or the other
 float per=6.5, k=floor(t/per), ph=fract(t/per);
 float hk=hash(vec2(k,7.3));
 vec2 A=vec2(mix(u_left.x,u_right.x,step(.5,hk))+(hash(vec2(k,1.1))-.5)*u_margin, u_resolution.y*(.55+.4*hash(vec2(k,2.2))));
 vec2 dir=normalize(vec2(mix(-1.,1.,step(.5,hash(vec2(k,3.3)))),-.55));
 float len=u_margin*1.2, head=clamp(ph/.12,0.,1.)*len;
 vec2 rel=c-A; float along=dot(rel,dir), across=length(rel-dir*along);
 float trail=(ph<.16)?step(across,CELL.y*.6)*smoothstep(head-len*.45,head,along)*step(along,head)*(1.-ph/.16):0.;
 if(trail>lum){lum=trail; col=u_text;}

 float level=floor(pow(clamp(lum,0.,1.),.75)*7.99);
 float gl=glyph(fract(gl_FragCoord.xy/CELL),level);
 float alpha=gl*clamp(.25+lum,0.,1.);
 gl_FragColor=vec4(mix(u_bg,col,alpha),1.);
}`;

/* ---- behind the page: an ASCII night sky, drawn as glyphs in a shader (glyph set from
   Forme's Planet shader). A ringed planet with a moon in the left margin, a spiral galaxy
   over a nebula in the right, three depths of stars, a shooting star every few seconds.
   Scrolling slides each layer at its own speed. ---- */
shader($("#contours"), SPACE, {
  ratio: 1.5, speed: 1, start: 40,
  size: () => [innerWidth, innerHeight],
  tint: (set) => { set("u_color", token("--sig")); set("u_index", token("--lav")); set("u_bg", token("--ink")); set("u_text", token("--text")); },
  resized: (set, r) => {
    const col = $("main.col").getBoundingClientRect(), m = Math.max(col.left, innerWidth - col.right, 160);
    set("u_margin", m * r);
    set("u_left", [Math.max(col.left / 2, 90) * r, innerHeight * 0.42 * r]);
    set("u_right", [Math.min((col.right + innerWidth) / 2, innerWidth - 90) * r, innerHeight * 0.62 * r]);
  },
  each: (set) => set("u_scroll", scrollY),
});

/* ---- the header: Forme's Dot grid (src/registry/dot-grid.tsx), a dot matrix with a slow
   swell; dots near the pointer glow in the theme's accent colour ---- */
(function dots() {
  const node = $("#dots"), ctx = node.getContext("2d"), SP = 20;
  const p = { x: 0, y: 0, tx: 0, ty: 0, s: 0, on: false };
  let w = 0, h = 0, t = 0, last = performance.now(), visible = true, dot = "0,0,0", glow = "0,0,0";
  const rgbOf = (v) => token(v).map((c) => Math.round(c * 255)).join(",");
  const colors = () => { dot = rgbOf("--mute"); glow = rgbOf("--sig"); };
  const paint = (now) => {
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    if (!REDUCED) t += dt;
    p.x += (p.tx - p.x) * 0.25; p.y += (p.ty - p.y) * 0.25; p.s += ((p.on ? 1 : 0) - p.s) * 0.15;
    ctx.clearRect(0, 0, w, h);
    for (let y = SP / 2; y < h; y += SP) for (let x = SP / 2; x < w; x += SP) {
      const swell = REDUCED ? 0 : 0.5 + 0.5 * Math.sin(x * 0.012 + y * 0.009 - t * 0.9);
      const d = Math.hypot(x - p.x, y - p.y), g = p.s * Math.exp(-(d * d) / 7000);
      ctx.fillStyle = g > 0.05 ? `rgba(${glow},${(0.35 + g * 0.65).toFixed(3)})` : `rgba(${dot},${(0.35 + swell * 0.25).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(x, y, 1.1 + g * 1.6, 0, 6.2832); ctx.fill();
    }
  };
  const size = () => {
    w = banner.clientWidth; h = banner.clientHeight;
    const r = Math.min(devicePixelRatio || 1, 2);
    node.width = w * r; node.height = h * r; ctx.setTransform(r, 0, 0, r, 0, 0); paint(performance.now());
  };
  colors(); size();
  addEventListener("resize", size);
  addEventListener("theme-change", () => { colors(); paint(performance.now()); });
  banner.addEventListener("pointermove", (e) => { const b = node.getBoundingClientRect(); p.tx = e.clientX - b.left; p.ty = e.clientY - b.top; if (p.s < 0.02) { p.x = p.tx; p.y = p.ty; } p.on = true; });
  banner.addEventListener("pointerleave", () => { p.on = false; });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(node);
  (function loop(ms) { requestAnimationFrame(loop); if (visible && !document.hidden && ms - last >= 32) paint(ms); })(0);
})();

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
const THEMES = [["sage", "Sage (default)"], ["dark-plus", "Dark+"], ["one-dark", "One Dark Pro"], ["dracula", "Dracula"], ["monokai", "Monokai"],
    ["github-dark", "GitHub Dark"], ["tokyo-night", "Tokyo Night"], ["catppuccin", "Catppuccin Mocha"], ["nord", "Nord"],
    ["light-plus", "Light+"], ["github-light", "GitHub Light"], ["solarized-light", "Solarized Light"]];
let applyTheme;
(function themes() {
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
  applyTheme = (id) => {
    if (id === "sage") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = id;
    try { localStorage.setItem("theme", id); } catch {}
    sync(); dispatchEvent(new Event("theme-change"));
  };
  menu.addEventListener("click", (e) => { const b = e.target.closest("[role=menuitemradio]"); if (b) applyTheme(b.dataset.id); });
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
    $("#heat").innerHTML = cells.map((d, i) => d ? `<i data-l="${d.level}" data-c="${d.count}" data-d="${d.date}" style="--w:${(i / 7) | 0}"></i>` : `<i class="pad"></i>`).join("");
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
    countTo($("#s-total"), total.toLocaleString());
    countTo($("#s-active"), String(days.filter((d) => d.count).length));
    countTo($("#s-long"), longest + "d");
    countTo($("#s-cur"), cur + "d");
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
    countTo($("#o-merged"), String(merged.total_count));
    countTo($("#o-repos"), String(new Set(merged.items.map(repoOf)).size));
    countTo($("#o-open"), String(open.total_count));
    $("#oss-note").textContent = "pull requests merged into other people's projects · live from GitHub";
    // the newest merges, one per repository and skipping the pinned ones, with stars and language
    const seen = new Set([...document.querySelectorAll("#prs .repo")].map((e) => e.firstChild.textContent.trim())), latest = [];
    for (const pr of merged.items) { const r = repoOf(pr); if (!seen.has(r) && latest.length < 8) { seen.add(r); latest.push(pr); } }
    const repos = await Promise.all(latest.map((pr) => fetch(pr.repository_url).then((r) => r.ok ? r.json() : {}).catch(() => ({}))));
    const k = (n) => n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(n);
    const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; };
    $("#prs-h-label").innerHTML = `<span class="live-dot"></span>latest merges, live from GitHub`;
    $("#prs-live").replaceChildren(...latest.map((pr, i) => {
      const a = el("a"); a.href = pr.html_url; a.target = "_blank"; a.rel = "noopener";
      const repo = el("span", "repo", repoOf(pr));
      if (repos[i].stargazers_count) repo.append(el("em", "", `★ ${k(repos[i].stargazers_count)}`));
      a.append(repo, el("span", "t", pr.title));
      if (repos[i].language) a.append(el("span", "lang", repos[i].language));
      const li = el("li"); li.append(a); return li;
    }));
  } catch {}
})();

/* ---- project cards: the screenshot tilts toward the pointer, with a glare and Forme's
   spotlight edge following it ---- */
if (!REDUCED) document.querySelectorAll(".cards > li > a").forEach((a) => {
  const shot = a.querySelector(".shot");
  a.addEventListener("pointermove", (e) => {
    const r = shot.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    shot.classList.add("live");
    shot.style.setProperty("--x", `${x * 100}%`); shot.style.setProperty("--y", `${y * 100}%`);
    shot.style.setProperty("--rx", `${(0.5 - y) * 9}deg`); shot.style.setProperty("--ry", `${(x - 0.5) * 11}deg`);
  });
  a.addEventListener("pointerleave", () => { shot.classList.remove("live"); shot.style.setProperty("--rx", "0deg"); shot.style.setProperty("--ry", "0deg"); });
});

/* ---- open source: four pinned PRs; the latest merges behind a button ---- */
const prsMore = $("#prs-more"), prsRest = $("#prs-rest");
prsMore.addEventListener("click", () => {
  prsRest.hidden = !prsRest.hidden;
  prsMore.setAttribute("aria-expanded", !prsRest.hidden);
  prsMore.textContent = prsRest.hidden ? "show latest merges ↓" : "hide ↑";
});

/* ---- small motion: section titles decode as they arrive, numbers count up, the
   calendar fills in. All of it is skipped with reduced motion. ---- */
const GLYPHS = "!<>-_\\/[]{}=+*^?#01";
function decode(el) {
  const text = el.textContent, start = performance.now(), dur = 520;
  el.setAttribute("aria-label", text);
  (function frame(now) {
    const k = Math.min(1, (now - start) / dur), shown = Math.floor(k * text.length);
    el.textContent = text.slice(0, shown) + [...text.slice(shown)].map((c) => c === " " ? " " : GLYPHS[(Math.random() * GLYPHS.length) | 0]).join("");
    if (k < 1) requestAnimationFrame(frame); else el.textContent = text;
  })(start);
}
// counts a tile from its current number to `text` (keeps any suffix: d, k, ★)
function countTo(el, text) {
  const m = String(text).match(/^([\d,.]+)(.*)$/);
  if (REDUCED || !m) { el.textContent = text; return; }
  const to = parseFloat(m[1].replace(/,/g, "")), from = parseFloat((el.textContent.match(/[\d,.]+/) || ["0"])[0].replace(/,/g, "")) || 0;
  const dec = (m[1].split(".")[1] || "").length, start = performance.now(), dur = 900;
  (function frame(now) {
    const k = Math.min(1, (now - start) / dur), e = 1 - Math.pow(1 - k, 3), v = from + (to - from) * e;
    el.textContent = (dec ? v.toFixed(dec) : Math.round(v).toLocaleString()) + m[2];
    if (k < 1) requestAnimationFrame(frame);
  })(start);
}
if (!REDUCED) {
  const seen = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    seen.unobserve(e.target);
    if (e.target.tagName === "H2") decode(e.target);
    else if (e.target.tagName === "DT") { const final = e.target.textContent; e.target.textContent = "0"; countTo(e.target, final); }
    else e.target.classList.add("in");
  }), { rootMargin: "0px 0px -12% 0px" });
  document.querySelectorAll("section h2, #oss .tiles dt, .heat").forEach((el) => seen.observe(el));
}

/* ---- ⌘K: jump to a section, switch theme, copy the email, open a profile ---- */
(function palette() {
  const dlg = $("#palette"), input = $("#pal-in"), list = $("#pal-list");
  const go = (id) => () => document.getElementById(id).scrollIntoView({ behavior: REDUCED ? "auto" : "smooth" });
  const link = (url) => () => window.open(url, "_blank", "noopener");
  const ITEMS = [
    ["Go to", "Top", go("top")], ["Go to", "Selected work", go("work")], ["Go to", "Open source", go("oss")], ["Go to", "Now", go("now")],
    ["Go to", "Stack", go("stack")], ["Go to", "Activity", go("activity")], ["Go to", "Contact", go("contact")],
    ["Action", "Copy email address", () => navigator.clipboard?.writeText("anushree.kasturi06@gmail.com")],
    ["Action", "Send an email", () => { location.href = "mailto:anushree.kasturi06@gmail.com"; }],
    ["Open", "GitHub", link("https://github.com/AnushreeKasturi")], ["Open", "LinkedIn", link("https://www.linkedin.com/in/anushree-kasturi/")],
    ["Open", "LeetCode", link("https://leetcode.com/u/AnushreeKasturi/")], ["Open", "Forme", link("https://forme-amber.vercel.app")],
    ...THEMES.map(([id, name]) => ["Theme", name, () => applyTheme(id)]),
  ];
  let shown = [], sel = 0;
  const render = () => {
    const q = input.value.trim().toLowerCase();
    shown = ITEMS.filter(([g, n]) => (g + " " + n).toLowerCase().includes(q));
    sel = Math.min(sel, Math.max(0, shown.length - 1));
    list.replaceChildren(...shown.map(([g, n], i) => {
      const li = document.createElement("li");
      li.id = "pal-" + i; li.setAttribute("role", "option"); li.setAttribute("aria-selected", i === sel);
      const a = document.createElement("span"); a.className = "g"; a.textContent = g;
      li.append(a, n);
      li.addEventListener("click", () => run(i));
      li.addEventListener("pointermove", () => { if (sel !== i) { sel = i; render(); } });
      return li;
    }));
    if (!shown.length) { const li = document.createElement("li"); li.className = "none"; li.textContent = "nothing matches"; list.append(li); }
    input.setAttribute("aria-activedescendant", shown.length ? "pal-" + sel : "");
    list.querySelector("[aria-selected=true]")?.scrollIntoView({ block: "nearest" });
  };
  const open = () => { input.value = ""; sel = 0; render(); dlg.showModal(); input.focus(); };
  const run = (i) => { const it = shown[i]; if (!it) return; dlg.close(); it[2](); };
  addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); dlg.open ? dlg.close() : open(); }
  });
  document.querySelectorAll("[data-palette]").forEach((b) => b.addEventListener("click", open));
  input.addEventListener("input", () => { sel = 0; render(); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); sel = (sel + (e.key === "ArrowDown" ? 1 : -1) + shown.length) % Math.max(1, shown.length); render(); }
    else if (e.key === "Enter") { e.preventDefault(); run(sel); }
  });
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
})();

/* ---- résumé links appear once resume.pdf is deployed next to the page ---- */
fetch("resume.pdf", { method: "HEAD" }).then((r) => { if (r.ok) document.querySelectorAll("[data-resume]").forEach((a) => a.hidden = false); }).catch(() => {});
