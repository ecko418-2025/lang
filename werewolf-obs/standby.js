const GAME_STATE_ID = 1;

const elRosterGrid = document.getElementById('roster-grid');
const elSetupName = document.getElementById('setup-name');
const elCurrentDate = document.getElementById('current-date');
const elLeftBannerText = document.getElementById('left-banner-text');
const elStandbyTitle = document.getElementById('standby-title');
const elStandbyFooter = document.getElementById('standby-footer-display');

function buildRoleSets(rolePools) {
  const split = (str) => new Set((str || '').split(/[,，\s]+/).filter(Boolean));
  return {
    wolfSet:     split(rolePools.wolves),
    godSet:      split(rolePools.gods),
    villagerSet: split(rolePools.villagers)
  };
}

function getRoleCategory(identity, roleSets) {
  const r = (identity || '').trim();
  if (!r || r === '未知') return 'unknown';
  
  if (roleSets) {
    if (roleSets.wolfSet.has(r)) return 'wolf';
    if (roleSets.godSet.has(r))  return 'god';
    if (roleSets.villagerSet.has(r)) return 'villager';
  }

  // Fallback keyword guess if pool lookup fails
  if (r.includes('狼') || r === '恶灵骑士' || r === '梦魇' || r === '大灰狼') return 'wolf';
  if (r.includes('民')) return 'villager';
  
  return 'god'; // Final fallback
}

async function fetchAndRender() {
  if (!window.supabaseClient) return;
  const supabaseClient = window.supabaseClient;

  // 1. Fetch game state
  const { data: gameState, error: stateError } = await supabaseClient
    .from('current_game_state')
    .select('*')
    .eq('id', GAME_STATE_ID)
    .single();

  if (stateError) {
    console.error('Error fetching game state:', stateError);
    return;
  }

  // 2. Fetch all players
  const { data: allPlayers, error: playersError } = await supabaseClient
    .from('player_directory')
    .select('*');

  if (playersError) {
    console.error('Error fetching players:', playersError);
    return;
  }

  const playerDirectory = {};
  allPlayers.forEach(p => {
    playerDirectory[p.id] = p;
  });

  // 3. Render
  elSetupName.textContent = gameState.setup_name || '12人标准局';
  
  const standbyConfig = gameState.standby_config || {};
  const roleSets = buildRoleSets(standbyConfig.role_pools || {});
  elLeftBannerText.textContent = standbyConfig.left_text || '狼管家';
  elStandbyTitle.textContent = standbyConfig.title || '出战表';
  elStandbyFooter.textContent = standbyConfig.footer || '狼管家 Studio · 沉浸式狼人杀体验';
  
  if (standbyConfig.date_text) {
    elCurrentDate.textContent = standbyConfig.date_text;
  } else {
    const now = new Date();
    elCurrentDate.textContent = `比赛时间：${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  }

  let seats = gameState.seats;
  if (!seats || !Array.isArray(seats) || seats.length !== 12) {
    // Generate empty 12 seats if not synced yet
    seats = Array.from({ length: 12 }, (_, i) => ({
      seat_number: i + 1,
      player_id: '',
      identity: ''
    }));
  }

  elRosterGrid.innerHTML = '';

  seats.forEach(seat => {
    const player = playerDirectory[seat.player_id] || { name: '空缺', avatar_url: '' };
    const avatarUrl = player.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(player.name)}&background=3E2415&color=F9E596&size=200`;
    
    const roleText = seat.identity || '未知';
    const roleCat = getRoleCategory(seat.identity, roleSets);
    
    // Score Calculation
    let baseScore = 0;
    const victoryStatus = standbyConfig.left_text;
    if (victoryStatus === '好人胜利' && (roleCat === 'god' || roleCat === 'villager')) {
      baseScore = 5;
    } else if (victoryStatus === '狼人胜利' && roleCat === 'wolf') {
      baseScore = 5;
    }
    
    const corrections = standbyConfig.score_corrections || [];
    const correction = corrections[seat.seat_number - 1] || 0;
    const finalScore = baseScore + correction;
    const scoreHtml = `<div class="score-badge">${finalScore > 0 ? '+' : ''}${finalScore}</div>`;

    let medalHtml = '';
    if (standbyConfig.mvp === seat.seat_number) {
      medalHtml = `<div class="medal-stamp medal-mvp">MVP</div>`;
    } else if (standbyConfig.svp === seat.seat_number) {
      medalHtml = `<div class="medal-stamp medal-svp">SVP</div>`;
    } else if (standbyConfig.scapegoat === seat.seat_number) {
      medalHtml = `<div class="medal-stamp medal-scapegoat">背锅</div>`;
    }

    const cardHtml = `
      <div class="player-card">
        <div class="avatar-ring">
          ${medalHtml}
          ${scoreHtml}
          <div class="seat-badge">${seat.seat_number}</div>
          <img src="${avatarUrl}" alt="${player.name}">
        </div>
        <div class="name-plate">${player.name}</div>
        <div class="identity-plate identity-${roleCat}">${roleText}</div>
      </div>
    `;
    elRosterGrid.innerHTML += cardHtml;
  });
}

// Ensure Supabase client is initialized from supabase-config.js
if (typeof window.supabaseClient !== 'undefined') {
  const supabaseClient = window.supabaseClient;
  
  // Initial fetch
  fetchAndRender();

  // Real-time subscriptions
  supabaseClient
    .channel('public:current_game_state_standby')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'current_game_state', filter: `id=eq.${GAME_STATE_ID}` }, payload => {
      fetchAndRender();
    })
    .subscribe();

  supabaseClient
    .channel('public:player_directory_standby')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'player_directory' }, payload => {
      fetchAndRender();
    })
    .subscribe();
} else {
  console.error("Supabase client not loaded. Please check supabase-config.js or network.");
}
