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
  // En pokeapi el id es un número
  const id       = formatId(data.id);
  // En pokeapi el nombre viene todo en minúscula
  const name     = capitalize(data.name);
  // En pokeapi las imágenes oficiales están en sprites.other['official-artwork']
  const imageUrl = data.sprites.other['official-artwork'].front_default
  // En pokeapi los tipos, habilidades y stats vienen como arrays de objetos, así que los mapeamos a lo que necesitamos para mostrar
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

// ── BATALLA POKEMON ──────────────────────────────────────

// Cache para no repetir fetches del mismo pokemon
const pokemonCache = {};
// Maximo de turnos globales antes de declarar ganador por HP
const MAX_TURNS = 20;
// Los dos pokemon seleccionados para la batalla
let battlePokemon = [null, null];
// Estado actual de la batalla en curso
let battleState = null;
// Cola de entradas de log generadas; logShownIdx marca cuantas ya se mostraron
let logQueue = [], logShownIdx = 0;
// ID del setInterval del modo auto-play
let autoPlayInterval = null;

// Extrae el valor base de un stat por nombre desde datos de PokeAPI.
// Devuelve 50 como fallback si el stat no existe.
function getStat(data, name) {
  const s = data.stats.find(s => s.stat.name === name);
  return s ? s.base_stat : 50;
}

// Busqueda

// Busca pokemon por nombre parcial en la PokeAPI y muestra sugerencias en el dropdown.
// Solo usa nombre (no ID). Muestra hasta 8 resultados con fetch directo a la API.
async function searchPokemon(slot) {
  const query = document.getElementById(`search-${slot}`).value.trim().toLowerCase();
  const box   = document.getElementById(`suggestions-${slot}`);
  if (query.length < 2) { box.innerHTML = ''; return; }

  try {
    // La PokeAPI no tiene busqueda parcial nativa, usamos el endpoint de lista completa cacheado
    if (!searchPokemon._list) {
      const res = await fetch('https://pokeapi.co/api/v2/pokemon?limit=100000');
      searchPokemon._list = (await res.json()).results;
    }
    const matches = searchPokemon._list.filter(p => p.name.includes(query)).slice(0, 8);
    box.innerHTML = matches.length
      ? matches.map(p => `<div class="picker-suggestion-item" onclick="selectBattlePokemon(${slot},'${p.name}')">${capitalize(p.name)}</div>`).join('')
      : '<div class="picker-suggestion-item" style="color:#999">Sin resultados</div>';
  } catch(e) {
    box.innerHTML = '<div class="picker-suggestion-item" style="color:#999">Error de conexion</div>';
  }
}

// Descarga los datos completos del pokemon seleccionado y muestra imagen + tipos en el preview.
// Guarda los datos en battlePokemon[slot] y habilita el boton si ambos slots estan llenos.
async function selectBattlePokemon(slot, name) {
  document.getElementById(`suggestions-${slot}`).innerHTML = '';
  document.getElementById(`search-${slot}`).value = capitalize(name);
  const preview = document.getElementById(`preview-${slot}`);
  preview.innerHTML = '<span class="picker-placeholder">Cargando...</span>';
  try {
    if (!pokemonCache[name]) {
      pokemonCache[name] = await fetch(`https://pokeapi.co/api/v2/pokemon/${name}`).then(r => r.json());
    }
    const data = pokemonCache[name];
    battlePokemon[slot - 1] = data;
    const img = data.sprites.other['official-artwork'].front_default || data.sprites.front_default;
    preview.innerHTML = `
      <img src="${img}" alt="${data.name}">
      <div class="picker-preview-name">${capitalize(data.name)}</div>
      <div class="picker-preview-types">${buildTypesBadges(data.types.map(t => t.type.name))}</div>`;
  } catch(e) {
    preview.innerHTML = '<span class="picker-placeholder" style="color:red">Error al cargar</span>';
    battlePokemon[slot - 1] = null;
  }
  document.getElementById('start-battle-btn').disabled = !(battlePokemon[0] && battlePokemon[1]);
}

// Motor de batalla

// Construye el objeto de estado de un pokemon a partir de datos de PokeAPI.
// Solo extrae HP y speed; el resto de stats no se usan en este sistema de combate.
function buildPokemon(data) {
  return {
    name:     capitalize(data.name),
    img:      data.sprites.other['official-artwork'].front_default || data.sprites.front_default,
    hp:       getStat(data, 'hp'),
    maxHp:    getStat(data, 'hp'),
    speed:    getStat(data, 'speed'),
    // Contador de turnos propios jugados (sube solo cuando le toca actuar)
    ownTurns: 0,
    // Turno propio en que se uso cada accion especial por ultima vez (-99 = nunca)
    lastSpAtkTurn: -99,
    lastSpDefTurn: -99,
    // Modificador de dano activo para el proximo ataque recibido (1 = sin defensa)
    defMod: 1,
  };
}

// COOLDOWN
// Verifica si un pokemon puede usar ataque especial o defensa especial en este momento.
// Primer uso: requiere haber llegado al turno propio indicado por minTurn.
// Usos siguientes: requiere que hayan pasado al menos cooldown turnos propios desde el ultimo uso.
function canUse(p, lastTurnField, minTurn, cooldown) {
  if (p[lastTurnField] === -99) return p.ownTurns >= minTurn;
  return (p.ownTurns - p[lastTurnField]) >= cooldown;
}

// Ejecuta un turno del pokemon activo y agrega entradas a state.log.
// Incrementa turnos, verifica limite MAX_TURNS, elige accion aleatoria ponderada,
// aplica fallo, calcula dano con modificadores activos y verifica KO.
function executeTurn(state) {
  if (state.over) return;

  const ai = state.activeIdx, di = 1 - ai;
  const atk = state.pokemon[ai], def = state.pokemon[di];

  state.globalTurn++;
  atk.ownTurns++;

  // Limite de turnos: comparar HP absoluto restante
  if (state.globalTurn > MAX_TURNS) {
    state.over = true;
    state.winner = atk.hp >= def.hp ? ai : di;
    const w = state.pokemon[state.winner];
    state.log.push({ type: 'ko', text: `Turno ${MAX_TURNS} alcanzado. Gana ${w.name} por mas HP (${atk.hp} vs ${def.hp}).` });
    return;
  }

  // Construir lista de acciones disponibles con pesos
  // Ataque siempre disponible (peso 4), defensa y especiales si aplica
  // Hay que repetir cada accion en el array segun su peso para que la seleccion aleatoria sea ponderada
  const actions = ['ataque','ataque','ataque','ataque'];
  if (canUse(atk, 'lastSpAtkTurn', 4, 3)) actions.push('ataque-especial', 'ataque-especial');
  if (canUse(atk, 'lastSpDefTurn', 3, 2)) actions.push('defensa', 'defensa');
  // Defensa especial: mismo cooldown que ataque especial
  if (canUse(atk, 'lastSpDefTurn', 4, 3)) actions.push('defensa-especial');

  // Elegir accion aleatoria ponderadamente (mas opciones = mas probabilidad)
  const action = actions[Math.floor(Math.random() * actions.length)];
  state.log.push({ type: 'turn', text: `Turno ${state.globalTurn} - ${atk.name} usa ${action}` });

  // RANDOM
  // Probabilidad de fallo: 20% para acciones normales, 10% para especiales
  const failChance = (action === 'ataque-especial' || action === 'defensa-especial') ? 0.10 : 0.20;
  if (Math.random() < failChance) {
    state.log.push({ type: 'miss', text: `${atk.name} fallo ${action}.` });
    state.activeIdx = di;
    return;
  }

  if (action === 'defensa') {
    // Acumular modificador multiplicando el actual por 0.5
    atk.defMod *= 0.5;
    state.log.push({ type: 'defense', text: `${atk.name} uso Defensa. Proximo dano recibido x${atk.defMod}.` });

    // Acumular modificador multiplicando el actual por 0.5, pero dura 2 turnos propios en vez de 3
  } else if (action === 'defensa-especial') {
    atk.lastSpDefTurn = atk.ownTurns;
    atk.defMod *= 0.25;
    state.log.push({ type: 'defense', text: `${atk.name} uso Defensa Especial. Proximo dano recibido x${atk.defMod}.` });

  } else {
    // Calcular dano base segun tipo de ataque, luego aplicar defMod del defensor
    const baseDmg = action === 'ataque-especial' ? 8 : 4;
    if (action === 'ataque-especial') atk.lastSpAtkTurn = atk.ownTurns;

    const dmg = Math.max(1, Math.round(baseDmg * def.defMod));
    // El modificador se consume despues de recibir el ataque
    def.defMod = 1;
    def.hp = Math.max(0, def.hp - dmg);

    const hpPct = Math.round((def.hp / def.maxHp) * 100);
    state.log.push({
      type: action === 'ataque-especial' ? 'special' : 'attack',
      text: `${atk.name} hizo ${dmg} de dano. ${def.name}: ${hpPct}% (${def.hp}/${def.maxHp} HP).`,
      dmg, defIdx: di,
    });

    if (def.hp <= 0) {
      state.log.push({ type: 'ko', text: `${def.name} fue derrotado. Gana ${atk.name}.` });
      state.over = true; state.winner = ai;
      return;
    }
  }

  state.activeIdx = di;
}

// BATTLE
// Crea el objeto inicial de la batalla con ambos pokemon y decide quien va primero.
// El de mayor speed ataca primero; en empate gana el pokemon 1.
function createBattle(p1data, p2data) {
  const p1 = buildPokemon(p1data), p2 = buildPokemon(p2data);
  return {
    pokemon: [p1, p2],
    activeIdx: p2.speed > p1.speed ? 1 : 0,
    globalTurn: 0, log: [], over: false, winner: null,
  };
}

// UI

// Actualiza el ancho y color de las barras de HP en pantalla para ambos pokemon.
// Azul > 50%, amarillo 25-50%, rojo < 25%.
function updateHpBars(state) {
  [0, 1].forEach(i => {
    const p   = state.pokemon[i];
    const pct = Math.max(0, Math.round((p.hp / p.maxHp) * 100));
    const bar = document.getElementById(`hp-bar-${i + 1}`);
    bar.style.width = pct + '%';
    bar.style.background = pct > 50 ? '#3b82f6' : pct > 25 ? '#f59e0b' : '#ef4444';
    document.getElementById(`hp-text-${i + 1}`).textContent = `${pct}% (${p.hp}/${p.maxHp})`;
  });
}

// Crea un div con la clase CSS del tipo de entrada y lo agrega al log en pantalla.
// Hace scroll automatico al fondo para mostrar siempre la entrada mas reciente.
function addLogEntry(entry) {
  const log = document.getElementById('battle-log');
  const div = document.createElement('div');
  div.className = `log-entry log-${entry.type}`;
  div.textContent = entry.text;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

// Inicializa la batalla: oculta selector, muestra arena, carga sprites y HUD.
// Crea el estado con createBattle y muestra el mensaje inicial con quien va primero.
function startBattle() {
  const [p1, p2] = battlePokemon;
  if (!p1 || !p2) return;
  document.getElementById('battle-selector').style.display = 'none';
  document.getElementById('start-battle-btn').style.display = 'none';
  document.getElementById('battle-arena').style.display = 'block';
  document.getElementById('winner-screen').style.display = 'none';
  document.getElementById('battle-log').innerHTML = '';

  battleState = createBattle(p1, p2);
  logQueue = []; logShownIdx = 0;

  const b = battleState;
  document.getElementById('hud-name-1').textContent = b.pokemon[0].name;
  document.getElementById('hud-name-2').textContent = b.pokemon[1].name;
  document.getElementById('battle-sprite-1').src = b.pokemon[0].img;
  document.getElementById('battle-sprite-2').src = b.pokemon[1].img;
  updateHpBars(b);

  const first = b.pokemon[b.activeIdx];
  addLogEntry({ type: 'turn', text: `Batalla iniciada. ${first.name} ataca primero (SPD: ${first.speed}). HP: ${b.pokemon[0].name} ${b.pokemon[0].hp} | ${b.pokemon[1].name} ${b.pokemon[1].hp}` });
}

// Avanza la batalla un paso por click del usuario.
// Si hay entradas pendientes en logQueue las muestra una a una.
// Si no, ejecuta el siguiente turno con executeTurn y muestra la primera entrada nueva.
function battleNextStep() {
  if (!battleState) return;
  if (logShownIdx < logQueue.length) {
    const entry = logQueue[logShownIdx++];
    addLogEntry(entry);
    if (entry.dmg > 0) updateHpBars(battleState);
    if (battleState.over && logShownIdx >= logQueue.length) showWinner();
    return;
  }
  if (battleState.over) { showWinner(); return; }

  const prevLen = battleState.log.length;
  executeTurn(battleState);
  logQueue.push(...battleState.log.slice(prevLen));

  if (logShownIdx < logQueue.length) {
    const entry = logQueue[logShownIdx++];
    addLogEntry(entry);
    if (entry.dmg > 0) updateHpBars(battleState);
    if (battleState.over && logShownIdx >= logQueue.length) showWinner();
  }
}

// Alterna entre modo automatico (un paso cada 800ms) y pausado.
// Detiene el intervalo solo cuando la batalla termina y no quedan entradas pendientes.
function battleAutoPlay() {
  if (autoPlayInterval) {
    clearInterval(autoPlayInterval);
    autoPlayInterval = null;
    document.getElementById('btn-auto').textContent = 'Auto';
    return;
  }
  document.getElementById('btn-auto').textContent = 'Pausar';
  autoPlayInterval = setInterval(() => {
    if (!battleState || (battleState.over && logShownIdx >= logQueue.length)) {
      clearInterval(autoPlayInterval); autoPlayInterval = null;
      document.getElementById('btn-auto').textContent = 'Auto';
      showWinner(); return;
    }
    battleNextStep();
  }, 800);
}

// Oculta la arena y muestra la pantalla de ganador con imagen y nombre del victorioso.
function showWinner() {
  if (autoPlayInterval) { clearInterval(autoPlayInterval); autoPlayInterval = null; }
  const winner = battleState.pokemon[battleState.winner];
  document.getElementById('battle-arena').style.display = 'none';
  document.getElementById('winner-screen').style.display = 'flex';
  document.getElementById('winner-img').src = winner.img;
  document.getElementById('winner-name').textContent = winner.name;
}

// Limpia todo el estado y regresa a la pantalla de seleccion de pokemon.
// Resetea battlePokemon, logQueue, inputs y previews de ambos slots.
function resetBattle() {
  if (autoPlayInterval) { clearInterval(autoPlayInterval); autoPlayInterval = null; }
  battleState = null; logQueue = []; logShownIdx = 0; battlePokemon = [null, null];
  [1, 2].forEach(s => {
    document.getElementById(`search-${s}`).value = '';
    document.getElementById(`suggestions-${s}`).innerHTML = '';
    document.getElementById(`preview-${s}`).innerHTML = '<span class="picker-placeholder">Sin seleccionar</span>';
  });
  document.getElementById('start-battle-btn').disabled = true;
  document.getElementById('start-battle-btn').style.display = '';
  document.getElementById('battle-selector').style.display = '';
  document.getElementById('battle-arena').style.display = 'none';
  document.getElementById('winner-screen').style.display = 'none';
}