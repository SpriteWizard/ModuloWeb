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
// ═══════════════════════════════════════════════════════════
//  BATALLA POKEMON
// ═══════════════════════════════════════════════════════════

const pokemonCache = {};
let battlePokemon   = [null, null];
let battleNameList  = [];
let battleNameListLoaded = false;
let battleState     = null;
let logQueue        = [];   // todos los entries generados hasta ahora
let logShownIdx     = 0;    // cuántos ya se mostraron en pantalla
let autoPlayInterval = null;

// ── Helpers de stats ─────────────────────────────────────

function getStat(data, statName) {
  const s = data.stats.find(s => s.stat.name === statName);
  return s ? s.base_stat : 50;
}

// ── Autocompletar búsqueda ────────────────────────────────

async function ensureNameList() {
  if (battleNameListLoaded) return;
  try {
    const res  = await fetch('https://pokeapi.co/api/v2/pokemon?limit=100000');
    const data = await res.json();
    battleNameList = data.results;
    battleNameListLoaded = true;
  } catch(e) { console.error(e); }
}

function idFromUrl(url) {
  const parts = url.replace(/\/$/, '').split('/');
  return parseInt(parts[parts.length - 1]);
}

async function searchPokemon(slot) {
  await ensureNameList();
  const query = document.getElementById(`search-${slot}`).value.trim().toLowerCase();
  const box   = document.getElementById(`suggestions-${slot}`);
  if (!query) { box.innerHTML = ''; return; }

  const byId   = battleNameList.filter(p => String(idFromUrl(p.url)) === query);
  const byName = battleNameList.filter(p => p.name.includes(query));
  const matches = [...new Map([...byId, ...byName].map(p => [p.name, p])).values()].slice(0, 8);

  if (!matches.length) {
    box.innerHTML = '<div class="picker-suggestion-item" style="color:#999">Sin resultados</div>';
    return;
  }

  box.innerHTML = matches.map(p => {
    const id    = idFromUrl(p.url);
    const thumb = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
    return `<div class="picker-suggestion-item" onclick="selectBattlePokemon(${slot}, '${p.name}')">
              <img src="${thumb}" alt="" onerror="this.style.display='none'">
              <span>#${String(id).padStart(3,'0')} ${capitalize(p.name)}</span>
            </div>`;
  }).join('');
}

async function selectBattlePokemon(slot, name) {
  document.getElementById(`suggestions-${slot}`).innerHTML = '';
  document.getElementById(`search-${slot}`).value = capitalize(name);
  const preview = document.getElementById(`preview-${slot}`);
  preview.innerHTML = '<span class="picker-placeholder">Cargando...</span>';

  try {
    if (!pokemonCache[name]) {
      const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${name}`);
      pokemonCache[name] = await res.json();
    }
    const data  = pokemonCache[name];
    battlePokemon[slot - 1] = data;

    const img   = data.sprites.other['official-artwork'].front_default || data.sprites.front_default;
    const types = data.types.map(t => t.type.name);

    preview.innerHTML = `
      <img src="${img}" alt="${data.name}">
      <div class="picker-preview-name">${capitalize(data.name)}</div>
      <div class="picker-preview-types">${buildTypesBadges(types)}</div>`;
  } catch(e) {
    preview.innerHTML = '<span class="picker-placeholder" style="color:red">Error al cargar</span>';
    battlePokemon[slot - 1] = null;
  }

  document.getElementById('start-battle-btn').disabled = !(battlePokemon[0] && battlePokemon[1]);
}

function buildPokemonState(data) {
  return {
    data,
    name:      capitalize(data.name),
    img:       data.sprites.other['official-artwork'].front_default || data.sprites.front_default,
    hp:        getStat(data, 'hp'),
    maxHp:     getStat(data, 'hp'),
    atk:       getStat(data, 'attack'),
    def:       getStat(data, 'defense'),
    spAtk:     getStat(data, 'special-attack'),
    spDef:     getStat(data, 'special-defense'),
    speed:     getStat(data, 'speed'),
    // Cuantos turnos propios ha jugado este pokemon
    ownTurns: 0,
    // Turno PROPIO en que se uso el ultimo especial (-99 = nunca)
    lastSpecialAtkTurn: -99,
    lastSpecialDefTurn: -99,
    // Defensas activas (para el proximo ataque recibido)
    defenseActive:        false,
    specialDefenseActive: false,
  };
}

function canUseSpecialAtk(p) {
  // Disponible a partir del turno propio #4 (primer uso)
  // Despues del primer uso: diferencia de turnos propios >= 3
  if (p.lastSpecialAtkTurn === -99) return p.ownTurns >= 4;
  return (p.ownTurns - p.lastSpecialAtkTurn) >= 3;
}

function canUseSpecialDef(p) {
  // Disponible a partir del turno propio #3 (primer uso)
  // Despues: diferencia >= 2
  if (p.lastSpecialDefTurn === -99) return p.ownTurns >= 3;
  return (p.ownTurns - p.lastSpecialDefTurn) >= 2;
}

// Pesos: 4x ataque, 1x defensa, especiales si aplica
function chooseAction(p) {
  const options = ['ataque', 'ataque', 'ataque', 'ataque', 'defensa'];
  if (canUseSpecialAtk(p)) options.push('ataque-especial', 'ataque-especial');
  if (canUseSpecialDef(p)) options.push('defensa-especial');
  return options[Math.floor(Math.random() * options.length)];
}

function calcDamage(atk, def, maxHp) {
  // Formula basada en division: daño proporcional al ratio atk/def
  // factor 0.12 = ~12% del HP maximo del defensor cuando stats son iguales
  return Math.max(1, Math.round((atk / def) * 0.12 * maxHp));
}

// Ejecuta UN turno del atacante (atkIdx) y empuja entradas al log interno
const MAX_TURNS = 20;

function executeTurn(state) {
  if (state.over) return;

  const atkIdx   = state.activeIdx;
  const defIdx   = 1 - atkIdx;
  const attacker = state.pokemon[atkIdx];
  const defender = state.pokemon[defIdx];

  // Incrementar turno global y turno propio del atacante ANTES de elegir accion
  state.globalTurn++;
  attacker.ownTurns++;

  // Limite de turnos: si se llega al turno 20 sin KO, gana quien tenga mas HP
  if (state.globalTurn > MAX_TURNS) {
    const [p0, p1] = state.pokemon;
    const p0pct = p0.hp / p0.maxHp;
    const p1pct = p1.hp / p1.maxHp;
    state.over = true;
    if (p0pct === p1pct) {
      state.winner = 0;
      state.log.push({ type: 'ko', text: `Se llego al turno ${MAX_TURNS} sin ganador. Empate tecnico: gana ${p0.name} por ser el primero.` });
    } else {
      state.winner = p0pct >= p1pct ? 0 : 1;
      const winner = state.pokemon[state.winner];
      state.log.push({ type: 'ko', text: `Se llego al turno ${MAX_TURNS}. Gana ${winner.name} por tener mas vida (${Math.round(p0pct*100)}% vs ${Math.round(p1pct*100)}%).` });
    }
    return;
  }

  const action = chooseAction(attacker);

  state.log.push({ type: 'turn', text: `Turno ${state.globalTurn} - ${attacker.name} actua (turno propio #${attacker.ownTurns})` });

  if (action === 'defensa') {
    if (Math.random() < 0.20) {
      state.log.push({ type: 'miss', text: `${attacker.name} intento defenderse pero fallo.` });
    } else {
      attacker.defenseActive = true;
      state.log.push({ type: 'defense', text: `${attacker.name} uso Defensa. El proximo ataque que reciba hara la mitad de danio.` });
    }

  } else if (action === 'defensa-especial') {
    if (Math.random() < 0.10) {
      state.log.push({ type: 'miss', text: `${attacker.name} intento Defensa Especial pero fallo.` });
    } else {
      attacker.specialDefenseActive = true;
      attacker.lastSpecialDefTurn   = attacker.ownTurns;
      state.log.push({ type: 'defense', text: `${attacker.name} uso Defensa Especial. Bloqueara el proximo ataque por completo.` });
    }

  } else {
    // Ataque normal o especial
    const isSpecial  = (action === 'ataque-especial');
    const failChance = isSpecial ? 0.10 : 0.20;

    if (isSpecial) {
      attacker.lastSpecialAtkTurn = attacker.ownTurns;
    }

    if (Math.random() < failChance) {
      const label = isSpecial ? 'Ataque Especial' : 'Ataque';
      state.log.push({ type: 'miss', text: `${attacker.name} intento usar ${label} pero fallo el golpe.` });
    } else {
      let dmg = isSpecial
        ? calcDamage(attacker.spAtk, defender.spDef, defender.maxHp)
        : calcDamage(attacker.atk,   defender.def,   defender.maxHp);

      // Defensas del defensor
      if (defender.specialDefenseActive) {
        defender.specialDefenseActive = false;
        state.log.push({ type: 'defense', text: `La Defensa Especial de ${defender.name} bloqueo el ataque por completo.` });
        dmg = 0;
      } else if (defender.defenseActive) {
        defender.defenseActive = false;
        dmg = Math.max(1, Math.floor(dmg / 2));
        state.log.push({ type: 'defense', text: `La Defensa de ${defender.name} redujo el danio a la mitad.` });
      }

      if (dmg > 0) {
        defender.hp = Math.max(0, defender.hp - dmg);
        const hpPct = Math.round((defender.hp / defender.maxHp) * 100);
        const label = isSpecial ? 'Ataque Especial' : 'Ataque';
        state.log.push({
          type: isSpecial ? 'special' : 'attack',
          text: `${attacker.name} uso ${label} e hizo ${dmg} de danio. ${defender.name} tiene ${hpPct}% de vida (${defender.hp}/${defender.maxHp} HP).`,
          hpPct,
          defIdx,
          dmg,
        });
      }

      if (defender.hp <= 0) {
        state.log.push({ type: 'ko', text: `${defender.name} fue derrotado. ${attacker.name} gana la batalla.` });
        state.over   = true;
        state.winner = atkIdx;
        return;
      }
    }
  }

  // Alternar turno
  state.activeIdx = defIdx;
}

function createBattleState(p1data, p2data) {
  const p1 = buildPokemonState(p1data);
  const p2 = buildPokemonState(p2data);
  // El de mayor speed ataca primero; empate -> p1
  const firstIdx = p2.speed > p1.speed ? 1 : 0;

  return {
    pokemon:     [p1, p2],
    activeIdx:   firstIdx,
    globalTurn:  0,
    log:         [],
    over:        false,
    winner:      null,
  };
}

// ── UI de batalla ────────────────────────────────────────

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

function addLogEntry(entry) {
  const log = document.getElementById('battle-log');
  const div = document.createElement('div');
  div.className = `log-entry log-${entry.type}`;
  div.textContent = entry.text;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

function startBattle() {
  const [p1, p2] = battlePokemon;
  if (!p1 || !p2) return;

  document.getElementById('battle-selector').style.display = 'none';
  document.getElementById('start-battle-btn').style.display = 'none';
  document.getElementById('battle-arena').style.display = 'block';
  document.getElementById('winner-screen').style.display = 'none';
  document.getElementById('battle-log').innerHTML = '';

  battleState  = createBattleState(p1, p2);
  logQueue     = [];
  logShownIdx  = 0;

  const b = battleState;
  document.getElementById('hud-name-1').textContent = b.pokemon[0].name;
  document.getElementById('hud-name-2').textContent = b.pokemon[1].name;
  document.getElementById('battle-sprite-1').src = b.pokemon[0].img;
  document.getElementById('battle-sprite-2').src = b.pokemon[1].img;
  updateHpBars(b);

  const first = b.pokemon[b.activeIdx];
  const info  = `Batalla iniciada. ${first.name} ataca primero (speed: ${first.speed}). HP: ${b.pokemon[0].name} ${b.pokemon[0].hp} | ${b.pokemon[1].name} ${b.pokemon[1].hp}`;
  addLogEntry({ type: 'turn', text: info });
}

// Muestra la siguiente entrada del log, o genera el siguiente turno si ya se mostraron todas
function battleNextStep() {
  if (!battleState) return;

  // Si quedan entradas en cola sin mostrar, muestra la siguiente
  if (logShownIdx < logQueue.length) {
    const entry = logQueue[logShownIdx++];
    addLogEntry(entry);
    if (entry.defIdx !== undefined && entry.dmg > 0) updateHpBars(battleState);
    if (battleState.over && logShownIdx >= logQueue.length) showWinner();
    return;
  }

  // Si ya terminó, mostrar ganador
  if (battleState.over) { showWinner(); return; }

  // Generar el siguiente turno
  const prevLen = battleState.log.length;
  executeTurn(battleState);
  // Las nuevas entradas son las que se agregaron a battleState.log
  const newEntries = battleState.log.slice(prevLen);
  logQueue.push(...newEntries);

  // Mostrar la primera nueva entrada
  if (logShownIdx < logQueue.length) {
    const entry = logQueue[logShownIdx++];
    addLogEntry(entry);
    if (entry.defIdx !== undefined && entry.dmg > 0) updateHpBars(battleState);
    if (battleState.over && logShownIdx >= logQueue.length) showWinner();
  }
}

function battleAutoPlay() {
  if (autoPlayInterval) {
    clearInterval(autoPlayInterval);
    autoPlayInterval = null;
    document.getElementById('btn-auto').textContent = 'Auto';
    return;
  }
  document.getElementById('btn-auto').textContent = 'Pausar';
  autoPlayInterval = setInterval(() => {
    if (!battleState) { clearInterval(autoPlayInterval); autoPlayInterval = null; return; }
    if (battleState.over && logShownIdx >= logQueue.length) {
      clearInterval(autoPlayInterval);
      autoPlayInterval = null;
      document.getElementById('btn-auto').textContent = 'Auto';
      showWinner();
      return;
    }
    battleNextStep();
  }, 800);
}

function showWinner() {
  if (autoPlayInterval) { clearInterval(autoPlayInterval); autoPlayInterval = null; }
  const winner = battleState.pokemon[battleState.winner];
  document.getElementById('battle-arena').style.display = 'none';
  document.getElementById('winner-screen').style.display = 'flex';
  document.getElementById('winner-img').src  = winner.img;
  document.getElementById('winner-name').textContent = winner.name;
}

function resetBattle() {
  if (autoPlayInterval) { clearInterval(autoPlayInterval); autoPlayInterval = null; }
  battleState = null; logQueue = []; logShownIdx = 0; battlePokemon = [null, null];
  [1, 2].forEach(slot => {
    document.getElementById(`search-${slot}`).value = '';
    document.getElementById(`suggestions-${slot}`).innerHTML = '';
    document.getElementById(`preview-${slot}`).innerHTML = '<span class="picker-placeholder">Sin seleccionar</span>';
  });
  document.getElementById('start-battle-btn').disabled = true;
  document.getElementById('start-battle-btn').style.display = '';
  document.getElementById('battle-selector').style.display = '';
  document.getElementById('battle-arena').style.display = 'none';
  document.getElementById('winner-screen').style.display = 'none';
}