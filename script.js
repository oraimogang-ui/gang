const blogPosts = [
  {
    title: 'Designing Synesthetic Interfaces for Mixed Reality',
    excerpt: 'Harness multi-sensory cues to accelerate comprehension inside immersive control rooms.',
    category: 'Experience Design',
    readingTime: '7 min read',
    published: 'May 18, 2042',
    url: '#'
  },
  {
    title: 'Deploying Edge AI for Responsive Brand Worlds',
    excerpt: 'Move your experiences closer to the visitor with lightweight inference pipelines and real-time mood mapping.',
    category: 'AI Systems',
    readingTime: '9 min read',
    published: 'Apr 30, 2042',
    url: '#'
  },
  {
    title: 'Design Ops for Quantum Product Teams',
    excerpt: 'Governance frameworks that keep hybrid teams shipping at light speed.',
    category: 'Future of Work',
    readingTime: '6 min read',
    published: 'Apr 14, 2042',
    url: '#'
  },
  {
    title: 'Narrative UX: Crafting Story-driven Onboarding',
    excerpt: 'Layer narrative arcs into your onboarding flows to boost adoption and loyalty.',
    category: 'Narrative UX',
    readingTime: '5 min read',
    published: 'Mar 28, 2042',
    url: '#'
  }
];

const learningTracks = [
  {
    title: 'Spatial Interface Architect',
    description: 'Prototype holographic interactions, volumetric layouts, and multisensory cues.',
    category: 'design',
    duration: '6 weeks',
    level: 'Intermediate'
  },
  {
    title: 'Edge AI Systems for Brand Ops',
    description: 'Deploy micro-models that adapt your experiences to live visitor signals.',
    category: 'development',
    duration: '8 weeks',
    level: 'Advanced'
  },
  {
    title: 'Strategic Foresight Lab',
    description: 'Run trend-mapping and scenario planning sprints for future-ready teams.',
    category: 'strategy',
    duration: '4 weeks',
    level: 'Beginner'
  },
  {
    title: 'Generative Narrative Design',
    description: 'Blend GPT-powered story weaving with ethical guardrails.',
    category: 'design',
    duration: '5 weeks',
    level: 'Intermediate'
  },
  {
    title: 'Autonomous Ops Dashboarding',
    description: 'Build decision cockpits using live data streams and predictive automation.',
    category: 'development',
    duration: '6 weeks',
    level: 'Advanced'
  }
];

const portfolioItems = [
  {
    title: 'Heliosverse Immersive Expo',
    summary: 'A hybrid expo environment with adaptive narratives, 8K volumetric streaming, and multi-sensory engagement.',
    tags: ['Immersive', 'XR', 'Event'],
    result: 'Increased dwell time by 212% for 60k visitors.'
  },
  {
    title: 'PulseOS Mission Control',
    summary: 'Centralized intelligence dashboard orchestrating AI insights, automation triggers, and human override protocols.',
    tags: ['AI Ops', 'Analytics', 'SaaS'],
    result: 'Reduced response times across teams by 48%. '
  },
  {
    title: 'Lumen Labs Brand Universe',
    summary: 'Persistent narrative-driven universe spanning web, VR, and physical installations.',
    tags: ['Brand', 'Story', 'Cross-media'],
    result: 'Enabled a 3x increase in loyalty membership conversions.'
  },
  {
    title: 'NovaStack Learning Grid',
    summary: 'Adaptive microlearning platform with biometric feedback loops and AI mentors.',
    tags: ['Learning', 'Platform', 'AI'],
    result: 'Achieved a 96% satisfaction rating across 12 enterprise cohorts.'
  }
];

const blogList = document.querySelector('#blog-list');
const learningList = document.querySelector('#learning-list');
const learningFilter = document.querySelector('#learning-filter');
const portfolioList = document.querySelector('#portfolio-list');
const assetForm = document.querySelector('#asset-form');
const assetList = document.querySelector('#asset-list');
const assetSearch = document.querySelector('#asset-search');
const assetExport = document.querySelector('#asset-export');
const navToggle = document.querySelector('.nav__toggle');
const navList = document.querySelector('.nav__list');
const metricNumbers = document.querySelectorAll('.metric__number');
const yearSpan = document.querySelector('#year');

const LOCAL_STORAGE_KEY = 'neon-nexus-assets-v1';

function renderBlogPosts() {
  blogPosts.forEach((post) => {
    const article = document.createElement('article');
    article.className = 'card';
    article.setAttribute('role', 'listitem');
    article.innerHTML = `
      <span class="learning__badge">${post.category}</span>
      <h3>${post.title}</h3>
      <p>${post.excerpt}</p>
      <div class="card__meta">
        <span>${post.published}</span>
        <span>${post.readingTime}</span>
      </div>
      <a class="btn btn--ghost" href="${post.url}">Read Story</a>
    `;
    blogList.appendChild(article);
  });
}

function renderLearningTracks(filter = 'all') {
  learningList.innerHTML = '';
  const filtered = learningTracks.filter((track) => filter === 'all' || track.category === filter);
  filtered.forEach((track) => {
    const card = document.createElement('article');
    card.className = 'learning__card';
    card.setAttribute('role', 'listitem');
    card.innerHTML = `
      <span class="learning__badge">${track.category}</span>
      <h3>${track.title}</h3>
      <p>${track.description}</p>
      <div class="learning__meta">
        <span>${track.duration}</span>
        <span>${track.level}</span>
      </div>
      <button class="btn btn--ghost" type="button">View Syllabus</button>
    `;
    learningList.appendChild(card);
  });
}

function renderPortfolio() {
  portfolioItems.forEach((item) => {
    const card = document.createElement('article');
    card.className = 'portfolio__item';
    card.setAttribute('role', 'listitem');
    const tagMarkup = item.tags.map((tag) => `<span>#${tag}</span>`).join('');
    card.innerHTML = `
      <h3>${item.title}</h3>
      <p>${item.summary}</p>
      <div class="portfolio__tags">${tagMarkup}</div>
      <p class="card__meta">${item.result}</p>
      <button class="btn btn--primary" type="button">Book Case Study</button>
    `;
    portfolioList.appendChild(card);
  });
}

function getStoredAssets() {
  try {
    const stored = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY));
    return Array.isArray(stored) ? stored : [];
  } catch (error) {
    console.error('Error parsing assets', error);
    return [];
  }
}

function saveAssets(assets) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(assets));
}

function renderAssetTags(tags) {
  if (!tags.length) {
    return '<span class="asset-card__tag">untagged</span>';
  }
  return tags.map((tag) => `<span class="asset-card__tag">${tag}</span>`).join('');
}

function createAssetCard(asset, index) {
  const card = document.createElement('article');
  card.className = 'asset-card';
  card.setAttribute('role', 'listitem');
  card.innerHTML = `
    <strong>${asset.name}</strong>
    <div class="asset-card__meta">
      <span>Type: ${asset.type}</span>
      <a href="${asset.link}" target="_blank" rel="noopener" class="btn btn--ghost">Open Asset</a>
    </div>
    <div class="asset-card__tags">
      ${renderAssetTags(asset.tags)}
    </div>
    <button type="button" aria-label="Remove asset">✕</button>
  `;
  const removeButton = card.querySelector('button');
  removeButton.addEventListener('click', () => {
    const assets = getStoredAssets();
    assets.splice(index, 1);
    saveAssets(assets);
    renderAssets(assetSearch.value.trim());
  });
  return card;
}

function renderAssets(query = '') {
  const assets = getStoredAssets();
  const normalizedQuery = query.toLowerCase();
  assetList.innerHTML = '';
  assets
    .map((asset) => ({
      ...asset,
      tags: Array.isArray(asset.tags) ? asset.tags : []
    }))
    .filter((asset) => {
      if (!normalizedQuery) return true;
      return (
        asset.name.toLowerCase().includes(normalizedQuery) ||
        asset.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery))
      );
    })
    .forEach((asset, index) => {
      assetList.appendChild(createAssetCard(asset, index));
    });

  if (!assetList.children.length) {
    const empty = document.createElement('p');
    empty.textContent = 'No assets logged yet. Add your first item to populate the vault.';
    assetList.appendChild(empty);
  }
}

function handleAssetSubmit(event) {
  event.preventDefault();
  const formData = new FormData(assetForm);
  const name = formData.get('asset-name').trim();
  const type = formData.get('asset-type');
  const link = formData.get('asset-link').trim();
  const tags = (formData.get('asset-tags') || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);

  if (!name || !type || !link) {
    return;
  }

  const newAsset = { name, type, link, tags };
  const assets = getStoredAssets();
  assets.unshift(newAsset);
  saveAssets(assets);
  assetForm.reset();
  renderAssets(assetSearch.value.trim());
}

function exportAssets() {
  const assets = getStoredAssets();
  const blob = new Blob([JSON.stringify(assets, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const downloadLink = document.createElement('a');
  downloadLink.href = url;
  downloadLink.download = 'neon-nexus-assets.json';
  downloadLink.click();
  URL.revokeObjectURL(url);
}

function animateMetrics(entries) {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    const element = entry.target;
    const target = Number(element.dataset.count || 0);
    const duration = 1200;
    const start = performance.now();

    function update(now) {
      const progress = Math.min((now - start) / duration, 1);
      element.textContent = Math.floor(progress * target);
      if (progress < 1) {
        requestAnimationFrame(update);
      }
    }

    requestAnimationFrame(update);
    observer.unobserve(element);
  });
}

function toggleNavigation() {
  const expanded = navToggle.getAttribute('aria-expanded') === 'true';
  navToggle.setAttribute('aria-expanded', String(!expanded));
  navList.setAttribute('aria-expanded', String(!expanded));
}

function closeNavigation() {
  if (window.innerWidth > 800) return;
  navToggle.setAttribute('aria-expanded', 'false');
  navList.setAttribute('aria-expanded', 'false');
}

function initNavigation() {
  navToggle.addEventListener('click', toggleNavigation);
  navList.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', closeNavigation);
  });
}

function init() {
  renderBlogPosts();
  renderLearningTracks();
  renderPortfolio();
  renderAssets();

  yearSpan.textContent = new Date().getFullYear();

  learningFilter.addEventListener('change', (event) => {
    renderLearningTracks(event.target.value);
  });

  assetForm.addEventListener('submit', handleAssetSubmit);
  assetSearch.addEventListener('input', (event) => {
    renderAssets(event.target.value.trim());
  });
  assetExport.addEventListener('click', exportAssets);

  initNavigation();

  if (window.innerWidth > 800) {
    navList.setAttribute('aria-expanded', 'true');
    navToggle.setAttribute('aria-expanded', 'false');
  } else {
    navList.setAttribute('aria-expanded', 'false');
  }

  window.addEventListener('resize', () => {
    if (window.innerWidth > 800) {
      navList.setAttribute('aria-expanded', 'true');
      navToggle.setAttribute('aria-expanded', 'false');
    } else {
      navList.setAttribute('aria-expanded', 'false');
    }
  });

  metricNumbers.forEach((number) => {
    number.textContent = '0';
  });
}

const observer = new IntersectionObserver(animateMetrics, {
  threshold: 0.6
});

metricNumbers.forEach((number) => observer.observe(number));

window.addEventListener('DOMContentLoaded', init);
