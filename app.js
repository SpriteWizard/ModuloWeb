const POKEMON = 'rowlet'; // puedes poner 'pikachu', 'charizard', etc.

const STAT_LABELS = {
  hp: 'HP',
  attack: 'ATK',
  defense: 'DEF',
  'special-attack': 'SpA',
  'special-defense': 'SpD',
  speed: 'SPD',
};

function getStatColor(value) {
  if (value >= 80) return '#8BC34A';
  if (value >= 50) return '#FFCA28';
  return '#FF7043';
}

function formatId(id) {
  return '#' + String(id).padStart(4, '0');
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function buildTypesBadges(types) {
  return types
    .map(t => `<span class="type-badge type-${t}">${capitalize(t)}</span>`)
    .join('');
}

function buildAbilityBadges(abilities) {
  return abilities
    .map(a => `<span class="ability-badge">${a}</span>`)
    .join('');
}

function buildStatRows(stats) {
  return stats
    .map(({ name, value }) => {
      const pct   = Math.min(100, (value / 255) * 100);
      const color = getStatColor(value);
      const label = STAT_LABELS[name] || name.toUpperCase().slice(0, 3);
      return `
        <div class="stat-row">
          <span class="stat-label">${label}</span>
          <span class="stat-value">${value}</span>
          <div class="stat-bar-bg">
            <div class="stat-bar" data-pct="${pct}" style="background:${color}"></div>
          </div>
        </div>`;
    })
    .join('');
}

function renderCard(data) {
  const id       = formatId(data.id);
  const name     = capitalize(data.name);
  const imageUrl = data.sprites.other['official-artwork'].front_default
                || data.sprites.front_default;
  const types    = data.types.map(t => t.type.name);
  const abilities = data.abilities.map(a => a.ability.name.replace('-', ' '));
  const stats    = data.stats.map(s => ({ name: s.stat.name, value: s.base_stat }));

  const card = document.getElementById('card');

  card.innerHTML = `
    <div class="pokemon-number">${id}</div>

    <div class="pokemon-image-wrapper">
      <div class="pokemon-glow"></div>
      <img class="pokemon-image" src="${imageUrl}" alt="${name}" />
    </div>

    <div class="pokemon-name">${name}</div>

    <div class="types">
      ${buildTypesBadges(types)}
    </div>

    <div class="section-title">Habilidades</div>
    <div class="abilities">
      ${buildAbilityBadges(abilities)}
    </div>

    <div class="section-title">Stats base</div>
    <div class="stats">
      ${buildStatRows(stats)}
    </div>
  `;

  // Animate stat bars after render
  requestAnimationFrame(() => {
    document.querySelectorAll('.stat-bar').forEach(bar => {
      bar.style.width = bar.dataset.pct + '%';
    });
  });
}

async function loadPokemon() {
  try {
    const res  = await fetch(`https://pokeapi.co/api/v2/pokemon/${POKEMON}`);
    const data = await res.json();
    renderCard(data);
  } catch (err) {
    document.getElementById('card').innerHTML =
      `<div class="loading">Error cargando datos 😢</div>`;
    console.error(err);
  }
}

// ========== SESSION MANAGEMENT ==========

// Verificar sesión al cargar la página
window.addEventListener('DOMContentLoaded', function() {
    const userSession = localStorage.getItem('userSession');
    
    if (!userSession) {
        // No hay sesión, redirigir al login
        window.location.href = 'login.html';
        return;
    }
    
    try {
        const session = JSON.parse(userSession);
        
        // Validar que la sesión sea válida
        if (!session.isAuthenticated) {
            throw new Error('Sesión inválida');
        }
        
        // Verificar expiración (1 hora)
        const currentTime = new Date().getTime();
        const sessionAge = currentTime - session.timestamp;
        const oneHour = 60 * 60 * 1000;
        
        if (sessionAge > oneHour) {
            throw new Error('Sesión expirada');
        }
        
        console.log('Sesión válida para usuario:', session.user);
        
        // Cargar Pokémon solo si el elemento card existe (página principal)
        if (document.getElementById('card')) {
            loadPokemon();
        }
        
        // Cargar header y footer
        loadHeaderAndFooter();
        
    } catch (error) {
        // Sesión inválida o expirada
        console.log('Sesión inválida:', error.message);
        localStorage.removeItem('userSession');
        window.location.href = 'login.html';
    }
});

function loadHeaderAndFooter() {
    const headerContainer = document.getElementById('header-container');
    const footerContainer = document.getElementById('footer-container');
    
    if (headerContainer) {
        fetch('header.html')
            .then(response => response.text())
            .then(data => document.getElementById('header-container').innerHTML = data);
    }
    
    if (footerContainer) {
        fetch('footer.html')
            .then(response => response.text())
            .then(data => document.getElementById('footer-container').innerHTML = data);
    }
}

function logout() {
    localStorage.removeItem('userSession');
    console.log('Sesión cerrada');
    window.location.href = 'login.html';
}