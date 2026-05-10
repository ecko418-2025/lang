// players.js - Player Management Logic

document.addEventListener('DOMContentLoaded', async () => {
  if (!window.supabaseClient) {
    alert('Supabase 客户端未初始化，请检查 supabase-config.js');
    return;
  }

  const supabase = window.supabaseClient;

  // Initialize CloudBase - Not needed for direct fetch

  // State
  let allPlayers = [];
  let filteredPlayers = [];
  let cropper = null;
  let croppedBlob = null;
  let isEditing = false;
  let selectedPlayerIds = new Set(); // Track selected player IDs

  // DOM Elements
  const elPlayersGrid = document.getElementById('players-grid');
  const elSearchInput = document.getElementById('search-input');
  const elBtnAddPlayer = document.getElementById('btn-add-player');
  
  const elPlayerModal = document.getElementById('player-modal');
  const elModalTitle = document.getElementById('modal-title');
  const elPlayerForm = document.getElementById('player-form');
  const elEditOriginalId = document.getElementById('edit-original-id');
  const elPlayerId = document.getElementById('player-id');
  const elPlayerName = document.getElementById('player-name');
  const elPlayerAvatarFile = document.getElementById('player-avatar-file');
  const elAvatarPreview = document.getElementById('current-avatar-preview');
  const elBtnCloseModal = document.getElementById('btn-close-modal');
  const elBtnSubmitPlayer = document.getElementById('btn-submit-player');

  const elCropperModal = document.getElementById('cropper-modal');
  const elCropperImage = document.getElementById('cropper-image');
  const elBtnCancelCrop = document.getElementById('btn-cancel-crop');
  const elBtnConfirmCrop = document.getElementById('btn-confirm-crop');

  // ---- Data Loading ----

  async function loadPlayers() {
    const { data, error } = await supabase
      .from('player_directory')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching players:', error);
      return;
    }
    
    allPlayers = data;
    filterAndRender();
  }

  function filterAndRender() {
    const query = elSearchInput.value.toLowerCase().trim();
    filteredPlayers = allPlayers.filter(p => 
      p.name.toLowerCase().includes(query) || 
      p.id.toString().toLowerCase().includes(query)
    );
    renderPlayers();
  }

  function renderPlayers() {
    if (filteredPlayers.length === 0) {
      elPlayersGrid.innerHTML = `
        <div class="col-span-full py-20 text-center text-gray-500 text-lg italic">
          未找到匹配的玩家
        </div>
      `;
      return;
    }

    elPlayersGrid.innerHTML = '';
    filteredPlayers.forEach(p => {
      const avatarUrl = p.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&background=ccc&color=fff`;
      const isSelected = selectedPlayerIds.has(p.id);
      
      const card = document.createElement('div');
      card.className = `panel p-4 flex flex-col items-center space-y-4 player-card bg-white relative transition-all ${isSelected ? 'ring-4 ring-blue-500 border-blue-500' : ''}`;
      card.innerHTML = `
        <!-- Selection Checkbox -->
        <div class="absolute top-3 left-3 z-10">
          <input type="checkbox" class="player-select-cb w-5 h-5 cursor-pointer" data-id="${p.id}" ${isSelected ? 'checked' : ''}>
        </div>

        <img src="${avatarUrl}" class="w-24 h-24 rounded-full object-cover border-4 border-[#8D6E63] shadow-inner bg-gray-50">
        <div class="text-center">
          <div class="font-bold text-xl">${p.name}</div>
          <div class="text-sm text-gray-500">ID: ${p.id}</div>
        </div>
        <div class="flex gap-2 w-full pt-2 border-t border-gray-100">
          <button class="btn-secondary flex-1 py-1 text-sm font-bold edit-btn" data-id="${p.id}">编辑</button>
          <button class="btn-danger flex-1 py-1 text-sm font-bold delete-btn" data-id="${p.id}">删除</button>
        </div>
      `;
      
      // Checkbox Change Logic
      const cb = card.querySelector('.player-select-cb');
      cb.onchange = (e) => {
        if (e.target.checked) {
          selectedPlayerIds.add(p.id);
          card.classList.add('ring-4', 'ring-blue-500', 'border-blue-500');
        } else {
          selectedPlayerIds.delete(p.id);
          card.classList.remove('ring-4', 'ring-blue-500', 'border-blue-500');
        }
        updateSyncButtonState();
      };

      // Event Listeners for buttons
      card.querySelector('.edit-btn').onclick = () => openEditModal(p);
      card.querySelector('.delete-btn').onclick = () => handleDelete(p.id, p.name);
      
      elPlayersGrid.appendChild(card);
    });
  }

  function updateSyncButtonState() {
    const elBtnSyncFeishu = document.getElementById('btn-sync-feishu');
    if (elBtnSyncFeishu) {
      // Preserve the SVG icon while updating text
      const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>`;
      
      if (selectedPlayerIds.size > 0) {
        elBtnSyncFeishu.innerHTML = `${svgIcon} 同步选中 (${selectedPlayerIds.size})`;
        elBtnSyncFeishu.classList.remove('opacity-50', 'cursor-not-allowed');
        elBtnSyncFeishu.disabled = false;
      } else {
        elBtnSyncFeishu.innerHTML = `${svgIcon} 同步至飞书`;
        elBtnSyncFeishu.disabled = false;
      }
    }
  }

  // ---- Modal Logic ----

  function openAddModal() {
    isEditing = false;
    elModalTitle.innerText = '新增玩家';
    elPlayerForm.reset();
    elEditOriginalId.value = '';
    elPlayerId.disabled = false;
    elAvatarPreview.innerHTML = '<span class="text-xs text-gray-400">无头像</span>';
    croppedBlob = null;
    elPlayerModal.classList.remove('hidden');
  }

  function openEditModal(player) {
    isEditing = true;
    elModalTitle.innerText = '修改玩家信息';
    elEditOriginalId.value = player.id;
    elPlayerId.value = player.id;
    elPlayerId.disabled = false; // Allow changing ID, though upsert handles it
    elPlayerName.value = player.name;
    
    const avatarUrl = player.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(player.name)}&background=ccc&color=fff`;
    elAvatarPreview.innerHTML = `<img src="${avatarUrl}" class="w-full h-full object-cover">`;
    
    croppedBlob = null;
    elPlayerAvatarFile.value = '';
    elPlayerModal.classList.remove('hidden');
  }

  elBtnCloseModal.onclick = () => elPlayerModal.classList.add('hidden');

  // ---- Cropper Logic ----

  elPlayerAvatarFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        elCropperImage.src = event.target.result;
        elCropperImage.classList.remove('hidden');
        elCropperModal.classList.remove('hidden');
        
        if (cropper) cropper.destroy();
        
        cropper = new Cropper(elCropperImage, {
          aspectRatio: 1,
          viewMode: 1,
          dragMode: 'move',
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

  elBtnCancelCrop.onclick = () => {
    elCropperModal.classList.add('hidden');
    elPlayerAvatarFile.value = '';
    croppedBlob = null;
    if (cropper) {
      cropper.destroy();
      cropper = null;
    }
  };

  elBtnConfirmCrop.onclick = () => {
    if (!cropper) return;
    const canvas = cropper.getCroppedCanvas({ width: 400, height: 400 });
    canvas.toBlob((blob) => {
      croppedBlob = blob;
      elAvatarPreview.innerHTML = `<img src="${URL.createObjectURL(blob)}" class="w-full h-full object-cover">`;
      elCropperModal.classList.add('hidden');
      if (cropper) {
        cropper.destroy();
        cropper = null;
      }
    }, 'image/png');
  };

  // ---- Actions ----

  elPlayerForm.onsubmit = async (e) => {
    e.preventDefault();
    const id = elPlayerId.value.trim();
    const name = elPlayerName.value.trim();
    const originalId = elEditOriginalId.value;
    
    if (!name) return alert('请输入玩家姓名');

    elBtnSubmitPlayer.disabled = true;
    elBtnSubmitPlayer.innerText = '正在保存...';

    try {
      let avatar_url = null;

      // Handle avatar upload if a new one was cropped/selected
      if (croppedBlob) {
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.png`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, croppedBlob, { contentType: 'image/png' });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(fileName);
        
        avatar_url = publicUrlData.publicUrl;
      }

      const payload = { name };
      if (id) payload.id = id;
      if (avatar_url) payload.avatar_url = avatar_url;

      // If we are editing and the ID has changed, we might want to delete the old one or just upsert
      // The current schema uses ID as primary key. Upserting with a new ID creates a new record.
      // If originalId exists and is different from current id, we should delete the old one.
      if (isEditing && originalId && originalId !== id) {
        if (!confirm(`正在修改玩家 ID (从 ${originalId} 改为 ${id})。这将保留玩家信息但更改其标识符。是否继续？`)) {
           elBtnSubmitPlayer.disabled = false;
           elBtnSubmitPlayer.innerText = '保存玩家';
           return;
        }
        await supabase.from('player_directory').delete().eq('id', originalId);
      }

      const { error } = await supabase.from('player_directory').upsert([payload]);
      if (error) throw error;

      elPlayerModal.classList.add('hidden');
      loadPlayers();
    } catch (err) {
      alert('保存失败: ' + err.message);
    } finally {
      elBtnSubmitPlayer.disabled = false;
      elBtnSubmitPlayer.innerText = '保存玩家';
    }
  };

  async function handleDelete(id, name) {
    if (!confirm(`确定要彻底删除玩家 "${name}" (ID: ${id}) 吗？`)) return;
    
    const { error } = await supabase.from('player_directory').delete().eq('id', id);
    if (error) {
      alert('删除失败: ' + error.message);
    } else {
      loadPlayers();
    }
  }

  // ---- Events ----

  elBtnAddPlayer.onclick = openAddModal;
  elSearchInput.oninput = filterAndRender;

  // ---- Feishu Sync ----
  const elBtnSyncFeishu = document.getElementById('btn-sync-feishu');
  if (elBtnSyncFeishu) {
    elBtnSyncFeishu.onclick = async () => {
      const originalText = elBtnSyncFeishu.innerText;
      try {
        // Determine which players to sync
        let playersToSync = [];
        if (selectedPlayerIds.size > 0) {
          playersToSync = allPlayers.filter(p => selectedPlayerIds.has(p.id));
        } else {
          playersToSync = allPlayers;
        }

        if (playersToSync.length === 0) return alert('当前没有玩家数据可同步');
        const confirmMsg = selectedPlayerIds.size > 0 
          ? `确定要同步选中的 ${playersToSync.length} 名玩家信息至飞书吗？`
          : `您未勾选任何选手，确定要同步“全员” (${playersToSync.length} 名) 吗？`;
        
        if (!confirm(confirmMsg)) return;

        elBtnSyncFeishu.disabled = true;
        elBtnSyncFeishu.innerText = '正在同步中...';

        const records = playersToSync.map(p => ({
          "玩家姓名": String(p.name || '未知'),
          "玩家 ID": String(p.id || '0').padStart(3, '0'),
          "头像链接": String(p.avatar_url || ''),
          "更新时间": String(new Date().toLocaleString())
        }));

        const FEISHU_CONFIG = {
          appId: 'cli_a97758782db95cc9',
          appSecret: '5OSZq6riErmGUOiCT1CV8b5DZtIOhddy',
          appToken: 'XKHGbfUJSaKp8Kse4MQczYyTnNg',
          tableId: 'tblOWlC1AlJ4qAun'
        };

        const response = await fetch('http://localhost:3000/api/feishu-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ config: FEISHU_CONFIG, fields: records })
        });

        const result = await response.json();
        if (result.success) {
          alert(`同步成功！已将 ${playersToSync.length} 名玩家资料上传至飞书。`);
        } else {
          alert('同步失败: ' + (result.message || '格式校验未通过'));
        }
      } catch (err) {
        alert('同步报错: ' + err.message);
      } finally {
        elBtnSyncFeishu.disabled = false;
        elBtnSyncFeishu.innerText = originalText;
      }
    };
  }

  // ---- Select All Logic ----
  const elSelectAllCb = document.getElementById('select-all-cb');
  if (elSelectAllCb) {
    elSelectAllCb.onchange = (e) => {
      const isChecked = e.target.checked;
      if (isChecked) {
        // Select all filtered players
        filteredPlayers.forEach(p => selectedPlayerIds.add(p.id));
      } else {
        // Deselect all filtered players
        filteredPlayers.forEach(p => selectedPlayerIds.delete(p.id));
      }
      renderPlayers(); // Re-render to show visual feedback
      updateSyncButtonState();
    };
  }

  // Initial Load
  loadPlayers();
});
