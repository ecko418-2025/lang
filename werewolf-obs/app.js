// app.js - OBS Overlay Logic

document.addEventListener('DOMContentLoaded', async () => {
  // Ensure supabase is initialized
  if (!window.supabaseClient) {
    console.error('Supabase client not initialized.');
    return;
  }

  const supabase = window.supabaseClient;
  const GAME_STATE_ID = 1;

  // DOM Elements
  const elSetup = document.getElementById('game-setup');
  const elProcess = document.getElementById('game-process');
  const elLogo = document.getElementById('room-logo');
  const elLeftCol = document.getElementById('left-column');
  const elRightCol = document.getElementById('right-column');

  // Player Directory Cache
  let playerDirectory = {};

  // Fetch all players for quick lookup
  async function fetchPlayerDirectory() {
    const { data, error } = await supabase.from('player_directory').select('*');
    if (!error && data) {
      data.forEach(p => {
        playerDirectory[p.id] = p;
      });
    }
  }

  // Render a single seat card
  function createSeatCard(seatData, sheriffSeat, roleSets) {
    const player = playerDirectory[seatData.player_id] || { name: 'Empty Seat', avatar_url: '' };
    
    // Default avatar if none provided
    const avatarUrl = player.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(player.name)}&background=fff&color=333&size=100`;

    const isDead = !seatData.is_alive;
    const isLeft = seatData.seat_number <= 6;
    const sideClass = isLeft ? 'left-avatar-container' : 'right-avatar-container';
    const cardStateClass = isDead ? 'is-dead' : '';

    let statusText = '未知';
    let roleCat = 'unknown';
    if (seatData.identity) {
      statusText = seatData.identity;
      if (roleSets && roleSets.wolfSet.has(statusText)) {
        roleCat = 'wolf';
      } else if (roleSets && roleSets.godSet.has(statusText)) {
        roleCat = 'god';
      } else if (roleSets && roleSets.villagerSet.has(statusText)) {
        roleCat = 'villager';
      } else {
        // Fallback keyword guess if pool lookup fails
        const r = statusText.trim();
        const wolfRoles = ['恶灵骑士', '石像鬼', '血月使徒', '蚀日侍女', '噩梦之影', '寂夜导师', '狂爆恶魔', '梦魇', '大灰狼', '怪盗狼王'];
        if (r.includes('狼') || wolfRoles.includes(r)) roleCat = 'wolf';
        else if (r.includes('民')) roleCat = 'villager';
        else roleCat = 'god';
      }
    }

    let deathStampHtml = '';
    let deathIconHtml = '';
    if (isDead && seatData.death_cause) {
      deathStampHtml = `<div class="death-stamp-vertical">${seatData.death_cause}</div>`;
      const deathIcons = {
        '狼刀': 'langdao.png',
        '毒杀': 'dusha.png',
        '放逐': 'fangzu.png',
        '枪杀': 'qiangsha.png',
        '狼技': 'langji.png'
      };
      if (deathIcons[seatData.death_cause]) {
        deathIconHtml = `<img src="assets/${deathIcons[seatData.death_cause]}" class="death-icon" alt="${seatData.death_cause}">`;
      }
    }

    const customTextHtml = seatData.custom_text ? `<div class="custom-text-plate">${seatData.custom_text}</div>` : '';

    let campaignTagHtml = '';
    if (parseInt(sheriffSeat) === seatData.seat_number) {
      campaignTagHtml = `<div class="campaign-tag">警长</div>`;
    } else if (seatData.is_campaigning) {
      campaignTagHtml = `<div class="campaign-tag">上警</div>`;
    }

    return `
      <div class="avatar-container ${sideClass} ${cardStateClass}" id="seat-${seatData.seat_number}">
        <div class="avatar-wrapper">
          <div class="seat-badge">${seatData.seat_number}</div>
          <img src="${avatarUrl}" alt="${player.name}">
          <div class="name-plate">${player.name}</div>
          ${deathIconHtml}
        </div>
        <div class="status-box role-${roleCat}">
          ${statusText}
        </div>
        ${deathStampHtml}
        ${campaignTagHtml}
        ${customTextHtml}
      </div>
    `;
  }

  // Render the entire game state
  function renderGameState(state) {
    if (!state) return;

    // Update Header
    elSetup.textContent = state.setup_name || 'Werewolf';
    elProcess.textContent = state.process || 'Waiting...';
    if (state.logo_url) {
      elLogo.src = state.logo_url;
    }

    // Update Seats
    if (state.seats && Array.isArray(state.seats)) {
      elLeftCol.innerHTML = '';
      elRightCol.innerHTML = '';

      const sheriffSeat = state.sheriff_seat || 0;

      // Build role sets from role_pools stored in standby_config
      const rolePools = (state.standby_config && state.standby_config.role_pools) || {};
      const splitRoles = (str) => new Set((str || '').split(/[,，\s]+/).filter(Boolean));
      const roleSets = {
        wolfSet:     splitRoles(rolePools.wolves),
        godSet:      splitRoles(rolePools.gods),
        villagerSet: splitRoles(rolePools.villagers)
      };

      state.seats.forEach(seat => {
        const cardHtml = createSeatCard(seat, sheriffSeat, roleSets);
        if (seat.seat_number <= 6) {
          elLeftCol.innerHTML += cardHtml;
        } else {
          elRightCol.innerHTML += cardHtml;
        }
      });
    }
  }

  // Initial Fetch
  async function initialize() {
    await fetchPlayerDirectory();

    const { data, error } = await supabase
      .from('current_game_state')
      .select('*')
      .eq('id', GAME_STATE_ID)
      .single();

    if (error) {
      console.error('Error fetching game state:', error);
    } else {
      renderGameState(data);
    }

    // Subscribe to realtime updates
    supabase
      .channel('public:current_game_state')
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'current_game_state',
        filter: `id=eq.${GAME_STATE_ID}`
      }, async (payload) => {
        console.log('Realtime update received:', payload.new);
        // If a player was added, we might need to refresh directory, 
        // but typically the admin adds them before assigning.
        // For safety, re-fetch directory if we suspect changes, or just re-render.
        await fetchPlayerDirectory(); 
        renderGameState(payload.new);
      })
      .subscribe((status) => {
        console.log('Supabase Realtime status:', status);
      });
  }

  initialize();
});
