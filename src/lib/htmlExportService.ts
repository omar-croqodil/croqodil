
import { SOCIAL_LINKS } from '../constants';

export interface HTMLSection {
  heading: string;
  body: string;
  type: 'text' | 'list' | 'table';
}

export function generateExportHTML(title: string, sections: HTMLSection[], forcedLang?: 'ar' | 'en') {
  const logoSVG = `
    <svg viewBox="0 0 709 539" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="531" cy="246" rx="17" ry="65" fill="#F0EDE6" />
      <ellipse cx="179" cy="246" rx="17" ry="65" fill="#F0EDE6" />
      <path d="M174 395.6L162.4 379.6C177.867 380.667 191.867 382.133 204.4 384C216.933 385.6 228.8 387.6 240 390C251.2 392.667 262.533 395.733 274 399.2C285.467 402.933 297.733 407.2 310.8 412C323.867 417.067 338.667 422.8 355.2 429.2C373.067 436.133 390.667 441.2 408 444.4C425.6 447.6 442.4 448.8 458.4 448C474.4 447.2 489.333 444.4 503.2 439.6C517.067 434.8 529.467 427.867 540.4 418.8L542.8 420.4C542 432.933 538 444.667 530.8 455.6C523.6 466.533 513.6 475.867 500.8 483.6C488 491.333 472.8 496.533 455.2 499.2C437.867 502.133 418.667 501.733 397.6 498C376.533 494.533 354.133 486.8 330.4 474.8C315.467 467.333 301.333 459.2 288 450.4C274.667 441.867 261.6 433.6 248.8 425.6C236.267 417.6 223.867 410.8 211.6 405.2C199.333 399.867 186.8 396.667 174 395.6ZM176.4 104.4C208.4 104.4 236.133 110.4 259.6 122.4C283.333 134.133 301.6 150.8 314.4 172.4C327.2 194 333.6 219.867 333.6 250C333.6 279.867 327.2 305.733 314.4 327.6C301.6 349.2 283.333 366 259.6 378C235.867 389.733 208.133 395.6 176.4 395.6C144.4 395.6 116.533 389.733 92.8 378C69.3333 366 51.2 349.2 38.4 327.6C25.6 306 19.2 280.133 19.2 250C19.2 220.133 25.6 194.4 38.4 172.8C51.2 150.933 69.3333 134.133 92.8 122.4C116.533 110.4 144.4 104.4 176.4 104.4ZM176.4 378.8C195.333 378.8 211.6 373.6 225.2 363.2C239.067 352.533 249.6 337.6 256.8 318.4C264.267 299.2 268 276.4 268 250C268 223.6 264.267 200.8 256.8 181.6C249.6 162.4 239.067 147.6 225.2 137.2C211.6 126.533 195.333 121.2 176.4 121.2C157.467 121.2 141.067 126.533 127.2 137.2C113.6 147.6 103.067 162.4 95.6 181.6C88.4 200.8 84.8 223.6 84.8 250C84.8 276.4 88.5333 299.2 96 318.4C103.467 337.6 114 352.533 127.6 363.2C141.467 373.6 157.733 378.8 176.4 378.8ZM534.222 104.4C566.222 104.4 593.955 110.4 617.422 122.4C641.155 134.133 659.422 150.8 672.222 172.4C685.289 194 691.822 219.867 691.822 250C691.822 279.867 685.289 305.733 672.222 327.6C659.422 349.2 641.155 366 617.422 378C593.955 389.733 566.222 395.6 534.222 395.6C502.222 395.6 474.355 389.733 450.622 378C427.155 366 409.022 349.2 396.222 327.6C383.422 306 377.022 280.133 377.022 250C377.022 220.133 383.422 194.4 396.222 172.8C409.022 150.933 427.155 134.133 450.622 122.4C474.355 110.4 502.222 104.4 534.222 104.4ZM534.222 378.8C553.155 378.8 569.422 373.6 583.022 363.2C596.622 352.533 607.155 337.6 614.622 318.4C622.089 299.2 625.822 276.4 625.822 250C625.822 223.6 622.089 200.8 614.622 181.6C607.155 162.4 596.622 147.6 583.022 137.2C569.422 126.533 553.155 121.2 534.222 121.2C515.555 121.2 499.289 126.533 485.422 137.2C471.822 147.6 461.289 162.4 453.822 181.6C446.355 200.8 442.622 223.6 442.622 250C442.622 276.4 446.355 299.2 453.822 318.4C461.289 337.6 471.822 352.533 485.422 363.2C499.289 373.6 515.555 378.8 534.222 378.8Z" fill="#F0EDE6" />
    </svg>
  `;

  const isArabic = forcedLang === 'ar' || (forcedLang === undefined && sections.some(s => /[\u0600-\u06FF]/.test(s.heading + String(s.body))));
  const dir = isArabic ? 'rtl' : 'ltr';
  const lang = isArabic ? 'ar' : 'en';

  const date = new Date().toLocaleDateString(isArabic ? 'ar-EG' : 'en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });

  const sidebarHTML = sections.map((s, i) => `
    <button class="sidebar-item" data-index="${i}">
      <span class="sidebar-number">0${i + 1}</span>
      <span class="sidebar-label">${s.heading}</span>
    </button>
  `).join('');

  const sectionsHTML = sections.map((s, i) => `
    <div id="section-${i}" class="content-page ${i === 0 ? 'active' : ''}">
      <div class="page-header">
        <div class="page-number">0${i + 1}</div>
        <h2 class="page-title">${s.heading}</h2>
      </div>
      <div class="section-body">${
        s.type === 'list'
          ? (Array.isArray(s.body) ? s.body.join('\n') : String(s.body || '')).split('\n').filter(Boolean).map(item =>
              `<div class="list-item">
                <span class="bullet">•</span>
                <div class="list-item-content">${item.trim().replace(/^[•\-\*]\s*/, '')}</div>
              </div>`
            ).join('')
          : `<div class="text-content">${String(s.body || '').replace(/\n/g, '<br/>')}</div>`
      }</div>
    </div>
  `).join('');

  const ICON_PATHS: Record<string, string> = {
    'Facebook': '<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>',
    'Instagram': '<rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>',
    'LinkedIn': '<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle>',
    'GitHub': '<path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>',
    'Gmail': '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline>',
    'X': '<path d="M4 4l11.733 16h4.267l-11.733 -16z M4 20l6.768 -6.768 M13.232 10.768l6.768 -6.768"></path>'
  };

  const socialLinksHTML = SOCIAL_LINKS.map(link => `
    <a href="${link.url}" 
       target="${link.name === 'Gmail' ? '_self' : '_blank'}" 
       rel="noopener noreferrer" 
       class="social-link" 
       title="${link.name}"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        ${ICON_PATHS[link.name] || ''}
      </svg>
    </a>
  `).join('');

  const html = `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title} — CROQODIL</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700&family=Cinzel:wght@700&family=Inter:wght@300;400;600;700&display=swap" rel="stylesheet"/>
<style>
  :root {
    --navy: #1C2D5E;
    --charcoal: #1A1A1A;
    --cream: #F0EDE6;
    --black: #050505;
    --accent: #F0EDE6;
    --sidebar-w: 280px;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; }

  body {
    background: var(--black);
    color: var(--cream);
    font-family: ${isArabic ? "'Cairo', sans-serif" : "'Inter', sans-serif"};
    overflow-x: hidden;
    line-height: 1.6;
  }

  /* LANDING COVER */
  #landing-cover {
    height: 100vh;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    background: radial-gradient(circle at center, #111 0%, #000 100%);
    z-index: 100;
    transition: transform 1.2s cubic-bezier(0.8, 0, 0.2, 1);
  }

  #landing-cover.dismissed {
    transform: translateY(-100%);
  }

  .landing-content {
    text-align: center;
    max-width: 800px;
    padding: 20px;
    animation: fadeInScale 2s ease-out;
  }

  @keyframes fadeInScale {
    from { opacity: 0; transform: scale(0.9); }
    to { opacity: 1; transform: scale(1); }
  }

  .landing-logo {
    width: 120px;
    margin: 0 auto 30px;
  }

  .landing-title {
    font-size: 3.5rem;
    font-weight: 700;
    margin-bottom: 5px;
    letter-spacing: -2px;
  }

  .landing-subtitle {
    font-family: 'Cinzel', serif;
    font-weight: 700;
    font-size: 1.2rem;
    letter-spacing: 12px;
    text-transform: uppercase;
    color: var(--accent);
    opacity: 0.8;
  }

  .landing-desc {
    margin-top: 2rem;
    font-size: 1rem;
    opacity: 0.4;
    letter-spacing: 2px;
    text-transform: uppercase;
  }

  .enter-btn {
    margin-top: 4rem;
    background: transparent;
    border: 1px solid rgba(240, 237, 230, 0.2);
    color: var(--cream);
    padding: 1.2rem 3.5rem;
    font-family: 'Cinzel', serif;
    font-size: 0.9rem;
    text-transform: uppercase;
    letter-spacing: 4px;
    cursor: pointer;
    transition: all 0.5s ease;
    border-radius: 4px;
  }

  .enter-btn:hover {
    background: var(--accent);
    color: var(--black);
    border-color: var(--accent);
    transform: translateY(-5px);
    box-shadow: 0 10px 40px rgba(0,0,0,0.5);
  }

  /* MAIN LAYOUT */
  #main-layout {
    display: flex;
    height: 100vh;
    width: 100%;
    position: fixed;
    top: 0;
    left: 0;
    opacity: 0;
    pointer-events: none;
    transition: opacity 1s linear;
  }

  #main-layout.visible {
    opacity: 1;
    pointer-events: auto;
  }

  /* SIDEBAR */
  .sidebar {
    width: var(--sidebar-w);
    background: #080808;
    border-${isArabic ? 'left' : 'right'}: 1px solid rgba(255,255,255,0.05);
    padding: 40px 0;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
  }

  .sidebar-header {
    padding: 0 40px 40px;
    border-bottom: 1px solid rgba(255,255,255,0.03);
  }

  .sidebar-logo {
    width: 50px;
    margin-bottom: 15px;
  }

  .sidebar-title {
    font-family: 'Cinzel', serif;
    font-size: 0.8rem;
    letter-spacing: 4px;
    opacity: 0.6;
  }

  .sidebar-menu {
    flex: 1;
    padding: 40px 0;
    overflow-y: auto;
  }

  .sidebar-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 18px 40px;
    background: transparent;
    border: none;
    color: var(--cream);
    cursor: pointer;
    text-align: ${isArabic ? 'right' : 'left'};
    transition: all 0.3s ease;
    opacity: 0.35;
    position: relative;
    font-family: inherit;
    font-size: 0.9rem;
    font-weight: 500;
  }

  .sidebar-item:hover, .sidebar-item.active {
    opacity: 1;
    background: rgba(255,255,255,0.02);
  }

  .sidebar-item.active::before {
    content: '';
    position: absolute;
    ${isArabic ? 'right' : 'left'}: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    background: var(--navy);
  }

  .sidebar-number {
    font-family: 'Cinzel', serif;
    font-size: 0.7rem;
    opacity: 0.5;
  }

  .sidebar-footer {
    padding: 40px;
    border-top: 1px solid rgba(255,255,255,0.03);
  }

  .footer-socials {
    display: flex;
    gap: 15px;
    margin-bottom: 20px;
  }

  .social-link {
    width: 32px;
    height: 32px;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--cream);
    text-decoration: none;
    transition: all 0.3s ease;
  }

  .social-link:hover {
    background: var(--cream);
    color: var(--black);
  }

  .social-link svg { width: 14px; height: 14px; }

  /* CONTENT AREA */
  .content-area {
    flex: 1;
    padding: 120px 10%;
    overflow-y: auto;
    background: var(--black);
    position: relative;
  }

  .content-page {
    display: none;
    animation: pageIn 0.8s cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  @keyframes pageIn {
    from { opacity: 0; transform: translateY(30px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .content-page.active {
    display: block;
  }

  .page-header {
    margin-bottom: 60px;
  }

  .page-number {
    font-family: 'Cinzel', serif;
    font-size: 1rem;
    color: var(--navy);
    letter-spacing: 4px;
    margin-bottom: 10px;
  }

  .page-title {
    font-size: 3rem;
    font-weight: 700;
    letter-spacing: -2px;
  }

  .section-body {
    max-width: 800px;
    font-size: 1.15rem;
    color: #bbb;
    line-height: 2;
    text-align: ${isArabic ? 'right' : 'left'};
  }

  .text-content {
    white-space: pre-line;
  }

  .list-item {
    display: flex;
    gap: 20px;
    margin-bottom: 30px;
    padding-bottom: 30px;
    border-bottom: 1px solid rgba(255,255,255,0.03);
  }

  .list-item:last-child { border: none; }

  .bullet {
    color: var(--navy);
    font-size: 1.5rem;
    line-height: 1;
  }

  .list-item-content {
    flex: 1;
  }

  /* MOBILE RESPONSIVENESS */
  @media (max-width: 1024px) {
    .sidebar { display: none; }
    #main-layout { flex-direction: column; }
    .content-area { padding: 40px 5%; }
    .page-title { font-size: 2.2rem; }
  }
</style>
</head>
<body>
  
  <div id="landing-cover">
    <div class="landing-content">
      <div class="landing-logo">${logoSVG}</div>
      <h1 class="landing-title">${title}</h1>
      <div class="landing-subtitle">CROQODIL</div>
      <p class="landing-desc">${date}</p>
      
      <div class="landing-socials" style="display:flex; gap:20px; justify-content:center; margin-top:30px; opacity:0.6;">
        ${socialLinksHTML}
      </div>

      <button class="enter-btn" onclick="enterApp()">Explore Neural Case</button>
    </div>
  </div>

  <div id="main-layout">
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="sidebar-logo">${logoSVG}</div>
        <div class="sidebar-title">CROQODIL</div>
      </div>
      <nav class="sidebar-menu">
        ${sidebarHTML}
      </nav>
      <div class="sidebar-footer">
        <div class="footer-socials">
          ${socialLinksHTML}
        </div>
        <div style="font-size: 9px; opacity: 0.3; letter-spacing: 2px;">NEURAL SYNTHESIS v3.0</div>
      </div>
    </aside>

    <main class="content-area">
      ${sectionsHTML}
    </main>
  </div>

  <script>
    function enterApp() {
      document.getElementById('landing-cover').classList.add('dismissed');
      setTimeout(() => {
        document.getElementById('main-layout').classList.add('visible');
      }, 800);
    }

    const mButtons = document.querySelectorAll('.sidebar-item');
    const mPages = document.querySelectorAll('.content-page');

    mButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const index = btn.getAttribute('data-index');
        
        mButtons.forEach(b => b.classList.remove('active'));
        mPages.forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        document.getElementById(\`section-\${index}\`).classList.add('active');

        // Scroll to top
        document.querySelector('.content-area').scrollTop = 0;
      });
    });

    // Active first one
    if(mButtons.length > 0) mButtons[0].classList.add('active');
  </script>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeTitle = title.replace(/\s+/g, '_');
  a.download = safeTitle + '_CROQODIL.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
