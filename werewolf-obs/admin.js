// admin.js - Admin Dashboard Logic

document.addEventListener('DOMContentLoaded', async () => {
  if (!window.supabaseClient) {
    alert('Supabase 客户端未初始化，请检查 supabase-config.js 文件中是否正确配置了 URL 和密钥，并确保网络正常。');
    return;
  }

  const supabase = window.supabaseClient;
  const GAME_STATE_ID = 1;

  // State
  let players = [];
  let currentGameState = null;

  // DOM Elements
  const elPlayerForm = document.getElementById('add-player-form');
  const elPlayerId = document.getElementById('new-player-id');
  const elPlayerName = document.getElementById('new-player-name');
  const elPlayerAvatarFile = document.getElementById('new-player-avatar-file');
  const elPlayersTable = document.querySelector('#players-table tbody');
  
  const elConfigSetupName = document.getElementById('config-setup-name');
  const elConfigProcess = document.getElementById('config-process');
  const btnUpdateConfig = document.getElementById('btn-update-config');
  
  const elSetupSelect = document.getElementById('config-setup-select');
  const elGods = document.getElementById('config-gods');
  const elWolves = document.getElementById('config-wolves');
  const elVillagers = document.getElementById('config-villagers');
  const elCardCount = document.getElementById('setup-card-count');
  const btnSaveSetup = document.getElementById('btn-save-setup');
  const btnDeleteSetup = document.getElementById('btn-delete-setup');

  const elSeatsContainer = document.getElementById('seats-container');
  const btnSaveSeats = document.getElementById('btn-save-seats');

  // Standby config
  const elStandbyLeft = document.getElementById('standby-left');
  const elStandbyTitle = document.getElementById('standby-title');
  const elStandbyDate = document.getElementById('standby-date');
  const elStandbyFooter = document.getElementById('standby-footer');
  const elStandbyMvp = document.getElementById('standby-mvp');
  const elStandbySvp = document.getElementById('standby-svp');
  const elStandbyScapegoat = document.getElementById('standby-scapegoat');
  const btnSyncStandby = document.getElementById('btn-sync-standby');

  const elSheriffSelect = document.getElementById('sheriff-select');
  const btnConfirmSheriff = document.getElementById('btn-confirm-sheriff');

  const DEATH_CAUSES = ['毒杀', '枪杀', '放逐', '狼刀', '狼技'];

  // ---- Section A: Players ----

  async function loadPlayers() {
    const { data, error } = await supabase.from('player_directory').select('*').order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching players:', error);
      return;
    }
    players = data;
    renderPlayersTable();
    renderSeats(); // Re-render seats to update player dropdowns
  }

  function renderPlayersTable() {
    elPlayersTable.innerHTML = '';
    players.forEach(p => {
      const tr = document.createElement('tr');
      tr.className = 'border-t border-[#8D6E63]';
      tr.innerHTML = `
        <td class="p-2"><img src="${p.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&background=ccc&color=fff`}" class="w-10 h-10 rounded bg-gray-200 object-cover"></td>
        <td class="p-2 font-bold">${p.name}<br><span class="text-xs text-gray-500 font-normal">ID: ${p.id}</span></td>
        <td class="p-2">
          <button class="btn-danger text-xs" onclick="deletePlayer('${p.id}')">删除</button>
        </td>
      `;
      elPlayersTable.appendChild(tr);
    });
  }

  // ---- Cropper Logic ----
  let cropper = null;
  let croppedBlob = null;
  const cropperModal = document.getElementById('cropper-modal');
  const cropperImage = document.getElementById('cropper-image');
  const btnCancelCrop = document.getElementById('btn-cancel-crop');
  const btnConfirmCrop = document.getElementById('btn-confirm-crop');

  elPlayerAvatarFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        cropperImage.src = event.target.result;
        cropperImage.classList.remove('hidden');
        cropperModal.classList.remove('hidden');
        
        if (cropper) {
          cropper.destroy();
        }
        
        cropper = new Cropper(cropperImage, {
          aspectRatio: 1, // enforce 1:1 square/circle
          viewMode: 1,    // restrict crop box to not exceed canvas
          dragMode: 'move', // allow dragging image
          autoCropArea: 0.8,
          restore: false,
          guides: false,
          center: false,
          highlight: false,
          cropBoxMovable: true,
          cropBoxResizable: true,
          toggleDragModeOnDblclick: false,
        });
      };
      reader.readAsDataURL(file);
    }
  });

  btnCancelCrop.addEventListener('click', () => {
    cropperModal.classList.add('hidden');
    elPlayerAvatarFile.value = ''; // Reset file input
    croppedBlob = null;
    if (cropper) {
      cropper.destroy();
      cropper = null;
    }
  });

  btnConfirmCrop.addEventListener('click', () => {
    if (!cropper) return;
    
    // Get cropped canvas
    const canvas = cropper.getCroppedCanvas({
      width: 400, // Export size
      height: 400,
    });
    
    canvas.toBlob((blob) => {
      croppedBlob = blob;
      cropperModal.classList.add('hidden');
      if (cropper) {
        cropper.destroy();
        cropper = null;
      }
      // Optional: change file input text or add a visual indicator here
    }, 'image/png');
  });

  elPlayerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    let id = elPlayerId.value.trim();
    const name = elPlayerName.value.trim();
    const originalFile = elPlayerAvatarFile.files[0];

    // Use cropped blob if available, otherwise original file (if any)
    const fileToUpload = croppedBlob || originalFile;

    // Show loading state
    const submitBtn = elPlayerForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerText;
    submitBtn.innerText = '上传中...';
    submitBtn.disabled = true;

    let avatar_url = null;

    try {
      if (fileToUpload) {
        // If croppedBlob is used, it doesn't have a .name property
        const fileExt = fileToUpload.name ? fileToUpload.name.split('.').pop() : 'png';
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${fileName}`;

        const { data, error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, fileToUpload, {
            contentType: fileToUpload.type || 'image/png'
          });

        if (uploadError) {
          throw new Error('Error uploading avatar: ' + uploadError.message);
        }

        const { data: publicUrlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);
          
        avatar_url = publicUrlData.publicUrl;
      }

      const payload = { name };
      if (id) payload.id = id;
      if (avatar_url) payload.avatar_url = avatar_url;

      const { error } = await supabase.from('player_directory').upsert([payload]);
      if (error) {
        throw new Error('Error adding/updating player: ' + error.message);
      }

      // Success
      elPlayerId.value = '';
      elPlayerName.value = '';
      elPlayerAvatarFile.value = '';
      croppedBlob = null; // Reset blob after successful upload
      loadPlayers();
    } catch (err) {
      alert(err.message);
    } finally {
      submitBtn.innerText = originalText;
      submitBtn.disabled = false;
    }
  });

  window.deletePlayer = async (id) => {
    if (confirm('确定要删除该玩家吗？')) {
      const { error } = await supabase.from('player_directory').delete().eq('id', id);
      if (error) alert('Error deleting player');
      else loadPlayers();
    }
  };

  // ---- Section B: Game Config ----

  let savedSetups = [];

  async function loadSetups() {
    const { data, error } = await supabase.from('game_setups').select('*').order('created_at', { ascending: true });
    if (error) {
      console.error('Error fetching setups:', error);
      return;
    }
    savedSetups = data || [];
    renderSetupSelect();
  }

  function renderSetupSelect() {
    elSetupSelect.innerHTML = '<option value="">-- 自定义新版型 --</option>';
    savedSetups.forEach((setup, i) => {
      elSetupSelect.innerHTML += `<option value="${i}">${setup.name}</option>`;
    });
  }

  function getParsedRoles() {
    const gods = elGods.value.split(/[,，\s]+/).filter(Boolean);
    const wolves = elWolves.value.split(/[,，\s]+/).filter(Boolean);
    const villagers = elVillagers.value.split(/[,，\s]+/).filter(Boolean);
    return [...gods, ...wolves, ...villagers];
  }

  function updateCardCount() {
    const roles = getParsedRoles();
    elCardCount.textContent = `当前卡牌总数: ${roles.length} 张`;
    if (roles.length !== 12) {
      elCardCount.className = "text-sm font-bold text-red-600";
    } else {
      elCardCount.className = "text-sm font-bold text-green-700";
    }
  }

  elSetupSelect.addEventListener('change', (e) => {
    const i = e.target.value;
    if (i !== "") {
      const setup = savedSetups[i];
      elConfigSetupName.value = setup.name;
      elGods.value = setup.gods;
      elWolves.value = setup.wolves;
      elVillagers.value = setup.villagers;
    }
    updateCardCount();
    renderSeats(); 
  });

  [elGods, elWolves, elVillagers].forEach(el => {
    el.addEventListener('input', () => {
      updateCardCount();
      renderSeats();
    });
  });

  btnSaveSetup.addEventListener('click', async () => {
    const name = elConfigSetupName.value.trim();
    if (!name) return alert('请填写版型名称！');
    
    const newSetup = {
      name,
      gods: elGods.value,
      wolves: elWolves.value,
      villagers: elVillagers.value
    };
    
    // UPSERT into database
    const { error } = await supabase.from('game_setups').upsert([newSetup], { onConflict: 'name' });
    if (error) {
      if (error.code === '42P01') {
        alert('数据库中尚未创建 game_setups 表，请先在 Supabase 运行建表 SQL！');
      } else {
        alert('保存版型失败: ' + error.message);
      }
      return;
    }
    
    await loadSetups();
    elSetupSelect.value = savedSetups.findIndex(s => s.name === name);
    alert('版型已永久保存到云端数据库！');
  });

  btnDeleteSetup.addEventListener('click', async () => {
    const name = elConfigSetupName.value.trim();
    if (!name) return alert('请先选择或输入要删除的版型名称！');
    
    if (!confirm(`确定要从数据库中永久删除版型【${name}】吗？`)) return;

    const { error } = await supabase.from('game_setups').delete().eq('name', name);
    if (error) {
      return alert('删除失败: ' + error.message);
    }
    
    alert('版型已成功删除！');
    elConfigSetupName.value = '';
    elGods.value = '';
    elWolves.value = '';
    elVillagers.value = '';
    await loadSetups();
    updateCardCount();
    renderSeats();
  });

  renderSetupSelect();
  updateCardCount();

  async function loadGameState() {
    const { data, error } = await supabase.from('current_game_state').select('*').eq('id', GAME_STATE_ID).single();
    if (error) {
      console.error('Error loading game state:', error);
      if (error.code === 'PGRST116') {
        alert('未找到游戏状态数据 (id=1)。请在 Supabase 的 current_game_state 表中手动插入一行 id=1 的数据。');
      }
      return;
    }
    
    currentGameState = data;
    elConfigSetupName.value = data.setup_name || '';
    elConfigProcess.value = data.process || '';
    
    const setupIdx = savedSetups.findIndex(s => s.name === data.setup_name);
    if (setupIdx >= 0) {
      const activeSetup = savedSetups[setupIdx];
      elGods.value = activeSetup.gods;
      elWolves.value = activeSetup.wolves;
      elVillagers.value = activeSetup.villagers;
      elSetupSelect.value = setupIdx;
    }

    if (data.standby_config) {
      elStandbyLeft.value = data.standby_config.left_text || '';
      elStandbyTitle.value = data.standby_config.title || '';
      elStandbyDate.value = data.standby_config.date_text || '';
      elStandbyFooter.value = data.standby_config.footer || '';
      elStandbyMvp.value = data.standby_config.mvp || '0';
      elStandbySvp.value = data.standby_config.svp || '0';
      elStandbyScapegoat.value = data.standby_config.scapegoat || '0';
      
      // Load score corrections
      const corrections = data.standby_config.score_corrections || [];
      const selects = document.querySelectorAll('.score-correction-select');
      selects.forEach((sel, i) => {
        sel.value = (corrections[i] !== undefined) ? corrections[i] : '0';
      });
    }

    if (data.sheriff_seat !== undefined) {
      elSheriffSelect.value = data.sheriff_seat || '0';
    }

    updateCardCount();
    renderSeats();
  }

  btnUpdateConfig.addEventListener('click', async () => {
    const setup_name = elConfigSetupName.value;
    const roles = getParsedRoles();

    if (roles.length !== 12) {
      if (!confirm(`当前卡牌总数为 ${roles.length} 张，不是标准的 12 张。确定要继续吗？`)) return;
    }

    // Read existing standby_config, then merge role_pools into it
    const { data: existing } = await supabase.from('current_game_state').select('standby_config').eq('id', GAME_STATE_ID).single();
    const mergedConfig = Object.assign({}, (existing && existing.standby_config) || {}, {
      role_pools: {
        wolves:    elWolves.value.trim(),
        gods:      elGods.value.trim(),
        villagers: elVillagers.value.trim()
      }
    });

    const { error } = await supabase.from('current_game_state').update({
      setup_name,
      standby_config: mergedConfig
    }).eq('id', GAME_STATE_ID);

    if (error) {
      alert('更新全局状态失败: ' + error.message);
    } else {
      alert('版型状态已同步至 OBS！');
    }
  });

  // ---- Section D: Standby Config ----
  btnSyncStandby.addEventListener('click', async () => {
    const config = {
      left_text: elStandbyLeft.value,
      title: elStandbyTitle.value.trim() || '出战表',
      date_text: elStandbyDate.value.trim(),
      footer: elStandbyFooter.value.trim() || '狼管家 Studio · 沉浸式狼人杀体验',
      mvp: parseInt(elStandbyMvp.value, 10),
      svp: parseInt(elStandbySvp.value, 10),
      scapegoat: parseInt(elStandbyScapegoat.value, 10),
      score_corrections: Array.from(document.querySelectorAll('.score-correction-select')).map(sel => parseFloat(sel.value))
    };

    const { error } = await supabase.from('current_game_state').update({ standby_config: config }).eq('id', GAME_STATE_ID);
    if (error) {
      if (error.code === '42703') {
        alert('数据库中尚未添加 standby_config 字段，请先在 Supabase 运行 ALTER TABLE 语句！');
      } else {
        alert('同步出战表配置失败: ' + error.message);
      }
    } else {
      alert('出战表配置已成功同步！');
    }
  });

  const btnResetScores = document.getElementById('btn-reset-scores');
  btnResetScores.addEventListener('click', () => {
    // 1. Reset all score corrections
    document.querySelectorAll('.score-correction-select').forEach(sel => sel.value = '0');
    
    // 2. Reset honors selectors (MVP, SVP, Scapegoat)
    if (elStandbyMvp) elStandbyMvp.value = '0';
    if (elStandbySvp) elStandbySvp.value = '0';
    if (elStandbyScapegoat) elStandbyScapegoat.value = '0';
  });

  const btnSaveHistory = document.getElementById('btn-save-history');
  btnSaveHistory.addEventListener('click', async () => {
    if (!currentGameState) return alert('尚未加载游戏状态');
    if (!confirm('确定要存储本局统计数据吗？')) return;

    btnSaveHistory.disabled = true;
    btnSaveHistory.innerText = '存储中...';

    try {
      // 1. Prepare role sets for scoring logic - USE LIVE UI VALUES
      const elWolves = document.getElementById('config-wolves');
      const elGods = document.getElementById('config-gods');
      const elVillagers = document.getElementById('config-villagers');
      const elVictory = document.getElementById('standby-left');
      const elMvp = document.getElementById('standby-mvp');
      const elSvp = document.getElementById('standby-svp');
      const elScapegoat = document.getElementById('standby-scapegoat');
      
      const split = (str) => new Set((str || '').split(/[,，\s]+/).filter(Boolean));
      const roleSets = {
        wolfSet:     split(elWolves.value),
        godSet:      split(elGods.value),
        villagerSet: split(elVillagers.value)
      };

      const victoryStatus = elVictory.value;
      const mvpSeat = parseInt(elMvp.value);
      const svpSeat = parseInt(elSvp.value);
      const scapegoatSeat = parseInt(elScapegoat.value);

      // Fetch ALL score corrections from UI
      const correctionsMap = {};
      document.querySelectorAll('.score-correction-select').forEach(sel => {
        const seatNum = parseInt(sel.getAttribute('data-seat'));
        correctionsMap[seatNum] = parseFloat(sel.value) || 0;
      });

      function getRoleCat(role) {
        const r = (role || '').trim();
        if (!r || r === '未知') return 'unknown';
        // 只要在狼人池子里的就是狼，否则就是好人
        if (roleSets.wolfSet.has(r)) return 'wolf';
        return 'good';
      }

      // 2. Fetch player names for history
      const { data: allPlayers } = await supabase.from('player_directory').select('id, name');
      const playerMap = {};
      allPlayers?.forEach(p => playerMap[p.id] = p.name);

      // 3. Calculate results for each seat
      const results = currentGameState.seats.map((seat, i) => {
        const roleCat = getRoleCat(seat.identity);
        let baseScore = 0;
        if (victoryStatus === '好人胜利' && roleCat === 'good') {
          baseScore = 5;
        } else if (victoryStatus === '狼人胜利' && roleCat === 'wolf') {
          baseScore = 5;
        }
        
        const correction = correctionsMap[seat.seat_number] || 0;
        return {
          seat_number: seat.seat_number,
          player_id: seat.player_id,
          player_name: playerMap[seat.player_id] || '空缺',
          identity: seat.identity || '未知',
          base_score: baseScore,
          correction: correction,
          final_score: baseScore + correction
        };
      });

      // 4. Save to game_history
      const historyEntry = {
        setup_name: currentGameState.setup_name || '未命名版型',
        victory_status: victoryStatus || '未知',
        date_text: new Date().toISOString().split('T')[0],
        results: results,
        mvp: mvpSeat,
        svp: svpSeat,
        scapegoat: scapegoatSeat,
        role_pools: {
          wolves: elWolves.value.trim(),
          gods: elGods.value.trim(),
          villagers: elVillagers.value.trim()
        }
      };

      const { error } = await supabase.from('game_history').insert([historyEntry]);
      if (error) {
        if (error.code === '42P01') {
          throw new Error('数据库中尚未创建 game_history 表，请联系管理员或运行建表 SQL！');
        }
        throw error;
      }

      alert('本局统计数据已成功存储到历史记录！');
    } catch (err) {
      alert('存储失败: ' + err.message);
    } finally {
      btnSaveHistory.disabled = false;
      btnSaveHistory.innerText = '本局统计存储';
    }
  });

  // ---- Section E: Sheriff ----
  btnConfirmSheriff.addEventListener('click', async () => {
    const sheriffSeat = parseInt(elSheriffSelect.value, 10);
    
    // Clear campaigning state for all seats
    const updatedSeats = currentGameState.seats.map(seat => ({
      ...seat,
      is_campaigning: false
    }));

    const { error } = await supabase.from('current_game_state').update({ 
      sheriff_seat: sheriffSeat,
      seats: updatedSeats
    }).eq('id', GAME_STATE_ID);

    if (error) {
      alert('更新警长失败: ' + error.message);
    } else {
      loadGameState(); // Refresh UI to uncheck campaign boxes
    }
  });

  // ---- Section C: Seats ----

  // Refresh all identity dropdowns to reflect current assignments
  function refreshIdentityDropdowns() {
    const allRoles = getParsedRoles(); // Full pool with duplicates
    const seatDivs = elSeatsContainer.querySelectorAll('[data-seat-index]');

    // Snapshot currently selected identity per seat index
    const selectedByIndex = {};
    seatDivs.forEach(div => {
      const idx = parseInt(div.dataset.seatIndex);
      selectedByIndex[idx] = div.querySelector('.seat-identity')?.value || '';
    });

    // Rebuild each seat's dropdown
    seatDivs.forEach(div => {
      const idx = parseInt(div.dataset.seatIndex);
      const currentVal = selectedByIndex[idx];

      // Available = full pool minus roles taken by OTHER seats
      const available = [...allRoles];
      Object.entries(selectedByIndex).forEach(([i, role]) => {
        if (parseInt(i) !== idx && role) {
          const pos = available.indexOf(role);
          if (pos !== -1) available.splice(pos, 1);
        }
      });

      const select = div.querySelector('.seat-identity');
      select.innerHTML = `<option value="">-- 身份 --</option>`;
      available.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r;
        opt.textContent = r;
        if (r === currentVal) opt.selected = true;
        select.appendChild(opt);
      });
      // If current value was somehow removed, restore it
      if (currentVal && !available.includes(currentVal)) {
        const opt = document.createElement('option');
        opt.value = currentVal;
        opt.textContent = currentVal;
        opt.selected = true;
        select.appendChild(opt);
      }
    });
  }

  function renderSeats() {
    if (!currentGameState) return;

    let seats = currentGameState.seats;
    // Initialize default seats if missing or empty
    if (!seats || !Array.isArray(seats) || seats.length !== 12) {
      seats = Array.from({ length: 12 }, (_, i) => ({
        seat_number: i + 1,
        player_id: '',
        identity: '',
        is_identity_visible: false,
        is_alive: true,
        is_campaigning: false,
        death_cause: ''
      }));
    }

    elSeatsContainer.innerHTML = '';

    // Pre-compute all assigned roles to determine each seat's available options
    const allRoles = getParsedRoles();
    const assignedRoles = seats.map(s => s.identity || '');

    // Build category sets from the actual config inputs
    const wolfSet = new Set(elWolves.value.split(/[,，\s]+/).filter(Boolean));
    const godSet  = new Set(elGods.value.split(/[,，\s]+/).filter(Boolean));
    // anything else is villager
    function getAdminRoleCat(role) {
      if (!role) return '';
      if (wolfSet.has(role)) return 'wolf';
      if (godSet.has(role))  return 'god';
      return 'villager';
    }

    seats.forEach((seat, index) => {
      const seatDiv = document.createElement('div');
      seatDiv.className = 'border border-[#8D6E63] p-4 rounded bg-[#faf8f5] space-y-3 relative';
      seatDiv.dataset.seatIndex = index;

      // Player Options
      let playerOptions = `<option value="">-- 选择玩家 --</option>`;
      players.forEach(p => {
        const selected = p.id === seat.player_id ? 'selected' : '';
        playerOptions += `<option value="${p.id}" ${selected}>${p.id} - ${p.name}</option>`;
      });

      // Death Cause Options
      let causeOptions = `<option value="">-- 死因 --</option>`;
      DEATH_CAUSES.forEach(c => {
        const selected = c === seat.death_cause ? 'selected' : '';
        causeOptions += `<option value="${c}" ${selected}>${c}</option>`;
      });

      // Role Options: full pool minus roles taken by OTHER seats
      const available = [...allRoles];
      assignedRoles.forEach((role, i) => {
        if (i !== index && role) {
          const pos = available.indexOf(role);
          if (pos !== -1) available.splice(pos, 1);
        }
      });
      let roleOptions = `<option value="">-- 身份 --</option>`;
      available.forEach(r => {
        const selected = r === seat.identity ? 'selected' : '';
        roleOptions += `<option value="${r}" ${selected}>${r}</option>`;
      });

      seatDiv.innerHTML = `
        <div class="absolute top-2 left-2 bg-[#5D4037] text-white rounded-full w-6 h-6 flex items-center justify-center font-bold text-xs">${seat.seat_number}</div>
        <div class="pl-8 flex justify-between items-center font-bold border-b border-gray-300 pb-1 mb-2">
          <span class="text-gray-800">${seat.seat_number} 号位</span>
          <div class="flex items-center gap-2">
            <div class="flex items-center gap-1 bg-white px-2 py-0.5 rounded shadow-sm border border-gray-200">
              <input type="checkbox" class="seat-campaign cursor-pointer" ${seat.is_campaigning ? 'checked' : ''} id="campaign-${index}">
              <label class="text-[10px] font-bold text-blue-700 cursor-pointer" for="campaign-${index}">竞选</label>
            </div>
            <div class="flex items-center gap-1 bg-white px-2 py-0.5 rounded shadow-sm border border-gray-200">
              <input type="checkbox" class="seat-alive cursor-pointer" ${seat.is_alive ? 'checked' : ''} id="alive-${index}">
              <label class="text-[10px] font-bold text-green-700 cursor-pointer" for="alive-${index}">存活</label>
            </div>
          </div>
        </div>
        
        <div>
          <label class="text-xs font-bold text-gray-600">玩家</label>
          <select class="seat-player text-sm mt-1"><option value="">-- 选择玩家 --</option></select>
        </div>

        <div>
          <label class="text-xs font-bold text-gray-600">身份</label>
          <div class="flex gap-2">
            <select class="seat-identity text-sm mt-1">${roleOptions}</select>
          </div>
        </div>

        <div class="death-cause-container mt-2 ${seat.is_alive ? 'hidden' : ''}">
          <label class="text-xs font-bold text-gray-600">死因</label>
          <select class="seat-cause text-sm mt-1">${causeOptions}</select>
        </div>

        <div class="mt-2 pt-2 border-t border-gray-200">
          <input type="text" class="seat-custom-text w-full mt-1 border border-gray-300 rounded p-1 text-sm bg-blue-50" value="${seat.custom_text || ''}">
        </div>
      `;

      // Toggle death cause visibility
      const aliveCheckbox = seatDiv.querySelector('.seat-alive');
      const causeContainer = seatDiv.querySelector('.death-cause-container');
      aliveCheckbox.addEventListener('change', (e) => {
        if (e.target.checked) {
          causeContainer.classList.add('hidden');
        } else {
          causeContainer.classList.remove('hidden');
        }
      });

      // Press Enter in custom text box to sync immediately
      seatDiv.querySelector('.seat-custom-text').addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          await syncSeats();
        }
      });

      // When identity changes, refresh all other dropdowns
      // Apply role category background color to identity select
      const identitySelect = seatDiv.querySelector('.seat-identity');
      function applyIdentityColor(select) {
        const cat = getAdminRoleCat(select.value);
        select.classList.remove('bg-red-100', 'bg-green-100', 'bg-yellow-100', 'bg-[#faf8f5]');
        if (cat === 'wolf')     select.classList.add('bg-red-100');
        else if (cat === 'god') select.classList.add('bg-green-100');
        else if (cat === 'villager') select.classList.add('bg-yellow-100');
        else                    select.classList.add('bg-[#faf8f5]');
      }
      applyIdentityColor(identitySelect);

      identitySelect.addEventListener('change', (e) => {
        applyIdentityColor(e.target);
        refreshIdentityDropdowns();
      });

      elSeatsContainer.appendChild(seatDiv);

      // Initialize Tom Select on the player dropdown
      const playerSelectEl = seatDiv.querySelector('.seat-player');
      const tomOptions = [{ value: '', text: '-- 选择玩家 --' }];
      players.forEach(p => tomOptions.push({ value: p.id, text: `${p.id} - ${p.name}` }));
      const ts = new TomSelect(playerSelectEl, {
        options: tomOptions,
        items: seat.player_id ? [seat.player_id] : [],
        valueField: 'value',
        labelField: 'text',
        searchField: ['text'],
        create: false,
        selectOnTab: true,
        allowEmptyOption: true,
        placeholder: '输入 ID 或名称搜索',
        render: {
          option: (data) => `<div>${data.text}</div>`,
          item: (data) => `<div>${data.text}</div>`
        }
      });
      // Map Tom Select value back to the hidden select so syncSeats() can read it
      function updatePlayerSelectColor(tsInstance) {
        const val = tsInstance.getValue();
        console.log('Seat value:', val);
        if (val && val !== "") {
          tsInstance.control.style.setProperty('background-color', '#eff6ff', 'important');
        } else {
          tsInstance.control.style.setProperty('background-color', 'white', 'important');
        }
      }

      ts.on('change', (val) => { 
        playerSelectEl.value = val; 
        updatePlayerSelectColor(ts);
      });

      setTimeout(() => updatePlayerSelectColor(ts), 100);
    });
  }

  // Shared sync function used by button and Enter key
  async function syncSeats() {
    const process = elConfigProcess.value;
    const seatDivs = elSeatsContainer.querySelectorAll('[data-seat-index]');
    const updatedSeats = [];

    seatDivs.forEach(div => {
      const index = div.dataset.seatIndex;
      updatedSeats.push({
        seat_number: parseInt(index) + 1,
        player_id: div.querySelector('.seat-player').value,
        identity: div.querySelector('.seat-identity').value,
        is_identity_visible: true,
        is_alive: div.querySelector('.seat-alive').checked,
        is_campaigning: div.querySelector('.seat-campaign').checked,
        death_cause: div.querySelector('.seat-alive').checked ? null : div.querySelector('.seat-cause').value,
        custom_text: div.querySelector('.seat-custom-text').value.trim()
      });
    });

    // Capture current role pools from the UI to ensure colors stay in sync
    const currentRolePools = {
      wolves:    elWolves.value.trim(),
      gods:      elGods.value.trim(),
      villagers: elVillagers.value.trim()
    };

    // Read existing standby_config, then merge current role_pools into it
    const { data: existing } = await supabase.from('current_game_state').select('standby_config').eq('id', GAME_STATE_ID).single();
    const mergedConfig = Object.assign({}, (existing && existing.standby_config) || {}, {
      role_pools: currentRolePools
    });

    const { error } = await supabase.from('current_game_state').update({ 
      seats: updatedSeats, 
      process: process,
      standby_config: mergedConfig
    }).eq('id', GAME_STATE_ID);
    if (error) {
      alert('更新失败: ' + error.message);
    } else {
      alert('进度及座位信息已成功同步至 OBS！');
      loadGameState();
    }
  }

  btnSaveSeats.addEventListener('click', syncSeats);

  const btnResetGame = document.getElementById('btn-reset-game');
  btnResetGame.addEventListener('click', async () => {
    if (!currentGameState) return;
    if (!confirm('确定要重置所有玩家状态吗？(将清除身份、死因和备注，恢复存活，并重置进度为"等待游戏开始"，但保留玩家座位)')) return;

    const process = "等待游戏开始";
    const resetSeats = currentGameState.seats.map(seat => ({
      ...seat,
      identity: '',
      is_alive: true,
      is_campaigning: false,
      death_cause: '',
      custom_text: ''
    }));

    const { error } = await supabase.from('current_game_state').update({ 
      seats: resetSeats, 
      process: process,
      sheriff_seat: 0
    }).eq('id', GAME_STATE_ID);

    if (error) {
      alert('重置失败: ' + error.message);
    } else {
      elConfigProcess.value = process;
      elSheriffSelect.value = "0";
      alert('状态已重置并同步至 OBS！');
      loadGameState();
    }
  });

  // Initialization
  // Run sequence
  async function initAdmin() {
    await loadSetups();
    await loadGameState();
    loadPlayers();
  }
  initAdmin();
});
