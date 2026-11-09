# Anushree Kasturi · Portfolio

Static site (HTML/CSS/JS, no build step) hosted on Vercel at https://anushreekasturi.vercel.app. The GitHub workflow only runs checks.

All content is plain HTML in `index.html`; images and stack icons (Simple Icons) live in `img/`, the social preview is `og.png`. `main.js` draws a dense ASCII space scene behind the page (WebGL, real JetBrains Mono characters on a measured brightness ramp: three depths of stars drawn as . + * and the odd comet; layers parallax on scroll) and runs Forme components ported to plain JS (Dot grid header, Dock, Spotlight edge on project cards, Beam strip) plus 12 VS Code themes (tokens in `style.css`, all at 4.5:1 contrast), a ⌘K palette, the Now tabs, a live GitHub calendar and live open-source data (what is written in `index.html` is the fallback).

Upload the résumé as `resume/anushree_resume.pdf` and the résumé buttons appear on their own.



Preview locally: `python3 -m http.server` → http://localhost:8000
