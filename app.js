// Cuántos pokémon mostramos por bloque
const PAGE_SIZE = 50;

// Nombres cortos para las stats
const STAT_LABELS = {
  hp: 'HP',
  attack: 'ATK',
  defense: 'DEF',
  'special-attack': 'SpA',
  'special-defense': 'SpD',
  speed: 'SPD',
};

// Helpers
// El color de la barra cambia según qué tan buena es la stat
function getStatColor(value) {
  if (value >= 80) return '#8BC34A';
  if (value >= 50) return '#FFCA28';
  return '#FF7043';
}

// Formatea el id como #0025 en vez de solo 25
function formatId(id) {
  return '#' + String(id).padStart(4, '0');
}

// Primera letra en mayúscula, para nombres y habilidades
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Builders de HTML
// Cada función arma un pedazo del HTML de la tarjeta

function buildTypesBadges(types) {
  // El CSS ya tiene una clase por tipo (.type-grass, .type-fire, etc.)
  return types
    .map(t => `<span class="type-badge type-${t}">${capitalize(t)}</span>`)
    .join('');
}

// Las habilidades no tienen un color específico
function buildAbilityBadges(abilities) {
  return abilities
    .map(a => `<span class="ability-badge">${a}</span>`)
    .join('');
}

// Cada stat es una fila con el nombre, el valor numérico y una barra de progreso
function buildStatRows(stats) {
  return stats
    .map(({ name, value }) => {
      // Convertimos el valor (0-255) a porcentaje para el ancho de la barra
      const pct   = Math.min(100, (value / 255) * 100);
      const color = getStatColor(value);
      const label = STAT_LABELS[name] || name.toUpperCase().slice(0, 3);
      return `
        <div class="stat-row">
          <span class="stat-label">${label}</span>
          <span class="stat-value">${value}</span>
          <div class="stat-bar-bg">
            <div class="stat-bar" style="width:${pct}%; background:${color}"></div>
          </div>
        </div>`;
    })
    .join('');
}

// Arma la tarjeta completa y la devuelve como string de HTML.
// Guardamos id, nombre y tipos como data-* para filtrar sin volver a la API.
function buildCard(data) {
  const id       = formatId(data.id);
  const name     = capitalize(data.name);
  const imageUrl = data.sprites.other['official-artwork'].front_default
                || data.sprites.front_default;
  const types    = data.types.map(t => t.type.name);
  const abilities = data.abilities.map(a => a.ability.name.replace('-', ' '));
  const stats    = data.stats.map(s => ({ name: s.stat.name, value: s.base_stat }));

  return `
    <div class="card" data-id="${data.id}" data-name="${data.name}" data-types="${types.join(',')}">
      <div class="pokemon-number">${id}</div>
      <div class="pokemon-image-wrapper">
        <img class="pokemon-image" src="${imageUrl}" alt="${name}" />
      </div>
      <div class="pokemon-name">${name}</div>
      <div class="types">${buildTypesBadges(types)}</div>
      <div class="section-title">Habilidades</div>
      <div class="abilities">${buildAbilityBadges(abilities)}</div>
      <div class="section-title">Stats base</div>
      <div class="stats">${buildStatRows(stats)}</div>
    </div>`;
}

// Filtros

// allPokemonData guarda TODOS los datos bajados de la API (sin límite de generación).
// Lo necesitamos para filtrar por id/nombre/tipo sin volver a hacer fetch.
let allPokemonData = [];

// Cuántos pokémon hay actualmente en pantalla
let displayedCount = PAGE_SIZE;

// Pone las tarjetas en el grid y, si quedan más por mostrar, agrega el botón
function renderGrid(pokemon) {
  const grid = document.getElementById('pokedex-grid');
  grid.innerHTML = pokemon.slice(0, displayedCount).map(buildCard).join('');

  // Solo mostramos el botón si hay más pokémon que los que están en pantalla
  if (displayedCount < pokemon.length) {
    grid.innerHTML += `<button class="load-more-btn" onclick="loadMore()">Cargar más</button>`;
  }
}

// Se llama cada vez que el usuario escribe o cambia un filtro.
// Busca en allPokemonData y muestra solo los que coinciden con los filtros.
function applyFilters() {
  const name = document.getElementById('filter-name').value.toLowerCase().trim();
  const id   = document.getElementById('filter-id').value.trim();
  const type = document.getElementById('filter-type').value;
  const grid = document.getElementById('pokedex-grid');

  // Sin filtros = vista normal con paginación
  const noFilters = !name && !id && !type;
  if (noFilters) {
    renderGrid(allPokemonData);
    return;
  }

  // Con filtros buscamos en TODOS.
  const filtered = allPokemonData.filter(p => {
    const matchName = !name || p.name.includes(name);
    const matchId   = !id   || String(p.id) === id;
    const matchType = !type || p.types.map(t => t.type.name).includes(type);
    return matchName && matchId && matchType;
  });

  grid.innerHTML = filtered.length
    ? filtered.map(buildCard).join('')
    : `<div class="loading">No se encontraron resultados 🔍</div>`;
}

// Carga de datos
// Al cargar la página, bajamos todos los pokémon de la API de una vez y los guardamos en allPokemonData.
async function loadPokedex() {
  const grid = document.getElementById('pokedex-grid');

  try {
    // Sin limit la API devuelve todos los pokémon que existen
    const res  = await fetch(`https://pokeapi.co/api/v2/pokemon?limit=100000`); // Si bien no hay tantos pokemon, esto asegura que bajamos todo lo que hay 
    const list = await res.json(); // list.results es un array con { name, url } de cada pokémon

    // Bajamos todos en paralelo con Promise.all (mucho más rápido que uno por uno)
    allPokemonData = await Promise.all(
      list.results.map(p => fetch(p.url).then(r => r.json()))
    );

    // Mostramos el primer bloque con el botón de cargar más al final
    renderGrid(allPokemonData);

// Si algo falla en el proceso, mostramos un mensaje de error en el grid
  } catch (err) {
    grid.innerHTML = `<div class="loading">Error cargando la Pokédex</div>`;
    console.error(err);
  }
}

// Muestra el siguiente bloque de 50 al hacer click en "Cargar más"
function loadMore() {
  displayedCount += PAGE_SIZE;
  renderGrid(allPokemonData);
}

// Session Management
// Al cargar la página, verificamos si hay una sesión válida en localStorage
window.addEventListener('DOMContentLoaded', function() {
    const userSession = localStorage.getItem('userSession');

    // Si no hay sesión guardada, mandamos al login de una vez
    if (!userSession) {
        window.location.href = 'login.html';
        return;
    }

    // Si hay sesión, la validamos (puede ser inválida o expirada)
    try {
        const session = JSON.parse(userSession);

        if (!session.isAuthenticated) {
            throw new Error('Sesión inválida');
        }

        // La sesión expira después de 1 hora
        const sessionAge = new Date().getTime() - session.timestamp;
        if (sessionAge > 60 * 60 * 1000) {
            throw new Error('Sesión expirada');
        }

        console.log('Sesión válida para usuario:', session.user);

        // Solo cargamos la pokédex en la página que tiene el grid
        if (document.getElementById('pokedex-grid')) {
            loadPokedex();
        }

        loadHeaderAndFooter();

    } catch (error) {
        // Cualquier problema con la sesión → limpiamos y al login
        console.log('Sesión inválida:', error.message);
        localStorage.removeItem('userSession');
        window.location.href = 'login.html';
    }
});

// Carga el header y footer desde sus archivos HTML correspondientes
function loadHeaderAndFooter() {
    const headerContainer = document.getElementById('header-container');
    const footerContainer = document.getElementById('footer-container');

    if (headerContainer) {
        fetch('header.html')
            .then(r => r.text())
            .then(data => headerContainer.innerHTML = data);
    }

    if (footerContainer) {
        fetch('footer.html')
            .then(r => r.text())
            .then(data => footerContainer.innerHTML = data);
    }
}

// Función para cerrar sesión: borra la sesión del localStorage y redirige al login
function logout() {
    localStorage.removeItem('userSession');
    console.log('Sesión cerrada');
    window.location.href = 'login.html';
}