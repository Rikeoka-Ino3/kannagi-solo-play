const STORAGE_KEYS = { deck: "miko_solo_deck" };
const HANIL_CARDS_JS_URL = "https://hanil524.github.io/kannagi-cardlist/cards.js";
const LOCAL_MASTER_JSON_URL = "./cards-master.json";
const CARD_BACK_IMAGE = "./card/logo/cardback.jpg";
let draggingHandUid = null;

const fallbackCatalog = [];

const state = {
  catalog: fallbackCatalog,
  deckBuild: loadDeck(), // [{number, count}]
  drawPile: [],
  hand: [],
  field: [],
  selectedHandId: null,
  lifeSelf: 30,
  lifeOpponent: 30,
  zeroSearchPhase: "idle", // idle | intro | select | done
  zeroSearchOrder: [],
};

const els = {
  viewSelect: document.getElementById("view-select"),
  tabDeck: document.getElementById("tab-deck"),
  tabPlay: document.getElementById("tab-play"),
  playmat: document.querySelector(".simple-playmat"),
  deckList: document.getElementById("deck-list"),
  deckTotal: document.getElementById("deck-total"),
  clearDeckButton: document.getElementById("clear-deck-button"),
  deckCodeInput: document.getElementById("deck-code-input"),
  deckCodeApplyButton: document.getElementById("deck-code-apply-button"),
  drawPileCount: document.getElementById("draw-pile-count"),
  handZone: document.getElementById("hand-zone"),
  fieldZone: document.getElementById("field-zone"),
  deckStack: document.getElementById("deck-stack"),
  cardPreviewModal: document.getElementById("card-preview-modal"),
  cardPreviewOverlay: document.getElementById("card-preview-overlay"),
  cardPreviewClose: document.getElementById("card-preview-close"),
  cardPreviewImage: document.getElementById("card-preview-image"),
  cardPreviewNumber: document.getElementById("card-preview-number"),
  cardPreviewName: document.getElementById("card-preview-name"),
  cardPreviewType: document.getElementById("card-preview-type"),
  lifeSelfValue: document.getElementById("life-self-value"),
  lifeSelfMinusButton: document.getElementById("life-self-minus-button"),
  lifeSelfPlusButton: document.getElementById("life-self-plus-button"),
  lifeSelfResetButton: document.getElementById("life-self-reset-button"),
  lifeOpponentValue: document.getElementById("life-opponent-value"),
  lifeOpponentMinusButton: document.getElementById("life-opponent-minus-button"),
  lifeOpponentPlusButton: document.getElementById("life-opponent-plus-button"),
  lifeOpponentResetButton: document.getElementById("life-opponent-reset-button"),
  zeroSearchModal: document.getElementById("zero-search-modal"),
  zeroSearchTitle: document.getElementById("zero-search-title"),
  zeroSearchDescription: document.getElementById("zero-search-description"),
  zeroSearchCards: document.getElementById("zero-search-cards"),
  zeroSearchSelected: document.getElementById("zero-search-selected"),
  zeroSearchStartButton: document.getElementById("zero-search-start-button"),
  zeroSearchApplyButton: document.getElementById("zero-search-apply-button"),
  zeroSearchBackButton: document.getElementById("zero-search-back-button"),
  zeroSearchSkipButton: document.getElementById("zero-search-skip-button"),
};

init();

async function init() {
  bindEvents();
  renderAll();
  await loadHanilCatalog();
  renderDeckBuilder();
}

function bindEvents() {
  els.viewSelect.addEventListener("change", () => switchTab(els.viewSelect.value));
  els.clearDeckButton.addEventListener("click", () => {
    state.deckBuild = [];
    saveDeck();
    renderDeckBuilder();
  });
  els.deckCodeApplyButton.addEventListener("click", async () => {
    await applyDeckCode(els.deckCodeInput.value.trim());
  });
  els.deckStack.addEventListener("click", (event) => {
    if (isZeroSearchBlocking()) return;
    if (state.drawPile.length === 0 && state.hand.length === 0 && state.field.length === 0) {
      if (!loadDeckToPlay(true, 8)) return;
    }
    drawCards(event.shiftKey ? 5 : 1);
  });
  els.deckStack.addEventListener("contextmenu", (event) => {
    if (isZeroSearchBlocking()) return;
    event.preventDefault();
    state.drawPile = shuffle([...state.drawPile]);
    renderPlay();
  });
  els.fieldZone.addEventListener("dragover", (event) => {
    if (!draggingHandUid) return;
    event.preventDefault();
    els.fieldZone.classList.add("is-drop-target");
  });
  els.fieldZone.addEventListener("drop", (event) => {
    if (!draggingHandUid) return;
    event.preventDefault();
    const uid = draggingHandUid;
    const { width, height } = getFieldCardSize();
    clearHandDragState();
    const rect = els.fieldZone.getBoundingClientRect();
    moveHandCardToField(uid, {
      x: event.clientX - rect.left - width / 2,
      y: event.clientY - rect.top - height / 2,
    });
  });
  els.handZone.addEventListener("dragover", (event) => {
    if (!draggingHandUid) return;
    event.preventDefault();
    els.handZone.classList.add("is-drop-target");
  });
  els.handZone.addEventListener("dragleave", () => {
    els.handZone.classList.remove("is-drop-target");
  });
  els.handZone.addEventListener("drop", (event) => {
    if (!draggingHandUid) return;
    event.preventDefault();
    const uid = draggingHandUid;
    const dropIndex = getHandDropIndex(event.clientX);
    reorderHandByUid(uid, dropIndex);
    clearHandDragState();
    renderPlay();
  });
  document.addEventListener("dragend", clearHandDragState);
  els.cardPreviewOverlay.addEventListener("click", closeCardPreview);
  els.cardPreviewClose.addEventListener("click", closeCardPreview);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !els.cardPreviewModal.classList.contains("is-open")) return;
    if (event.key === "Escape") closeCardPreview();
  });
  els.lifeSelfMinusButton.addEventListener("click", () => {
    state.lifeSelf = Math.max(0, state.lifeSelf - 1);
    renderPlay();
  });
  els.lifeSelfPlusButton.addEventListener("click", () => {
    state.lifeSelf = Math.min(99, state.lifeSelf + 1);
    renderPlay();
  });
  els.lifeSelfResetButton.addEventListener("click", () => {
    state.lifeSelf = 30;
    renderPlay();
  });
  els.lifeOpponentMinusButton.addEventListener("click", () => {
    state.lifeOpponent = Math.max(0, state.lifeOpponent - 1);
    renderPlay();
  });
  els.lifeOpponentPlusButton.addEventListener("click", () => {
    state.lifeOpponent = Math.min(99, state.lifeOpponent + 1);
    renderPlay();
  });
  els.lifeOpponentResetButton.addEventListener("click", () => {
    state.lifeOpponent = 30;
    renderPlay();
  });
  els.zeroSearchStartButton.addEventListener("click", () => {
    state.zeroSearchPhase = "select";
    state.zeroSearchOrder = [];
    renderPlay();
  });
  els.zeroSearchApplyButton.addEventListener("click", () => {
    applyZeroSearch();
  });
  els.zeroSearchBackButton.addEventListener("click", () => {
    state.zeroSearchPhase = "intro";
    state.zeroSearchOrder = [];
    renderPlay();
  });
  els.zeroSearchSkipButton.addEventListener("click", () => {
    state.zeroSearchPhase = "done";
    state.zeroSearchOrder = [];
    renderPlay();
  });
}

function clearHandDragState() {
  draggingHandUid = null;
  els.fieldZone.classList.remove("is-drop-target");
  els.handZone.classList.remove("is-drop-target");
}

function isZeroSearchBlocking() {
  return state.zeroSearchPhase === "intro" || state.zeroSearchPhase === "select";
}

function getFieldCardSize() {
  const styles = getComputedStyle(document.documentElement);
  const widthRaw = styles.getPropertyValue("--field-card-width").trim();
  const width = Number.parseFloat(widthRaw) || 132;
  return { width, height: Math.round((width * 88) / 63) };
}

function switchTab(tab) {
  els.tabDeck.classList.toggle("is-active", tab === "deck");
  els.tabPlay.classList.toggle("is-active", tab === "play");
  if (tab === "play" && state.drawPile.length === 0 && state.hand.length === 0 && state.field.length === 0) {
    loadDeckToPlay(true, 8);
  }
}

function renderAll() {
  renderDeckBuilder();
  renderPlay();
}

function renderDeckBuilder() {
  els.deckList.innerHTML = "";
  const sorted = [...state.deckBuild].sort((a, b) => Number(a.number) - Number(b.number));
  sorted.forEach((entry) => {
    const meta = getCardMeta(entry.number);
    for (let i = 0; i < entry.count; i += 1) {
      const tile = document.createElement("div");
      tile.className = "deck-list-card";
      tile.title = `No.${entry.number} ${meta.name}（${meta.type}）`;
      tile.tabIndex = 0;

      const img = document.createElement("img");
      img.src = meta.image || "./card/logo/cardback.jpg";
      img.alt = meta.name || `No.${entry.number}`;
      img.loading = "lazy";
      img.addEventListener("error", () => {
        img.src = "./card/logo/cardback.jpg";
      });

      tile.addEventListener("click", () => openCardPreview(entry.number, meta));
      tile.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openCardPreview(entry.number, meta);
        }
      });

      tile.appendChild(img);
      els.deckList.appendChild(tile);
    }
  });
  els.deckTotal.textContent = String(state.deckBuild.reduce((sum, e) => sum + (Number(e.count) || 0), 0));
}

function openCardPreview(number, meta) {
  els.cardPreviewImage.src = meta.image || "./card/logo/cardback.jpg";
  els.cardPreviewImage.alt = meta.name || `No.${number}`;
  els.cardPreviewNumber.textContent = `No.${number}`;
  els.cardPreviewName.textContent = meta.name || `No.${number}`;
  els.cardPreviewType.textContent = meta.type || "不明";
  els.cardPreviewModal.classList.add("is-open");
  els.cardPreviewModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("is-modal-open");
}

function closeCardPreview() {
  els.cardPreviewModal.classList.remove("is-open");
  els.cardPreviewModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("is-modal-open");
}

async function applyDeckCode(code) {
  const normalizedCode = extractDeckCodeCandidate(code);
  if (!normalizedCode) {
    alert("デッキコードを入力してください。");
    return;
  }
  try {
    const deckMap = await codeToMap(normalizedCode);
    const ok = replaceDeckWithMap(deckMap);
    if (!ok) {
      alert("このコードのカードを確認できませんでした。");
      return;
    }
    loadDeckToPlay(true, 8);
    alert("デッキコードを適用しました。");
  } catch {
    alert("無効なデッキコードです。");
  }
}

function replaceDeckWithMap(map) {
  const next = [];
  Object.entries(map).forEach(([num, count]) => {
    const c = Number(count) || 0;
    if (c <= 0) return;
    next.push({ number: String(num), count: c });
  });
  if (next.length === 0) return false;
  state.deckBuild = next;
  saveDeck();
  renderDeckBuilder();
  return true;
}

function loadDeckToPlay(silent = false, openingHand = 0) {
  if (state.deckBuild.length === 0) {
    if (!silent) alert("デッキがありません。まず共有コードを適用してください。");
    return false;
  }
  const pile = [];
  state.deckBuild.forEach((entry) => {
    const meta = getCardMeta(entry.number);
    for (let i = 0; i < (Number(entry.count) || 0); i += 1) {
      pile.push({
        uid: crypto.randomUUID(),
        number: String(entry.number),
        name: meta.name,
        type: meta.type,
        image: meta.image || "./card/logo/cardback.jpg",
      });
    }
  });
  state.drawPile = shuffle(pile);
  state.hand = [];
  state.field = [];
  state.selectedHandId = null;
  state.lifeSelf = 30;
  state.lifeOpponent = 30;
  state.zeroSearchPhase = "intro";
  state.zeroSearchOrder = [];
  if (openingHand > 0) drawCards(openingHand);
  renderPlay();
  return true;
}

function drawCards(count) {
  for (let i = 0; i < count; i += 1) {
    if (state.drawPile.length === 0) break;
    state.hand.push(state.drawPile.pop());
  }
  renderPlay();
}

function playFromHand(uid) {
  moveHandCardToField(uid);
}

function moveHandCardToField(uid, preferredPos = null) {
  const index = state.hand.findIndex((card) => card.uid === uid);
  if (index === -1) return;
  const [card] = state.hand.splice(index, 1);
  const { width, height } = getFieldCardSize();
  const defaultX = 20 + state.field.length * 24;
  const defaultY = 20 + (state.field.length % 4) * 28;
  const maxX = Math.max(0, els.fieldZone.clientWidth - width);
  const maxY = Math.max(0, els.fieldZone.clientHeight - height);
  const x = clamp(preferredPos?.x ?? defaultX, 0, maxX);
  const y = clamp(preferredPos?.y ?? defaultY, 0, maxY);
  state.field.push({
    ...card,
    viewMode: "front",
    x,
    y,
  });
  state.selectedHandId = null;
  renderPlay();
}

function renderPlay() {
  els.drawPileCount.textContent = String(state.drawPile.length);
  els.deckStack.classList.toggle("is-empty", state.drawPile.length === 0);
  els.lifeSelfValue.textContent = String(state.lifeSelf);
  els.lifeOpponentValue.textContent = String(state.lifeOpponent);
  const zeroSearchBlocking = isZeroSearchBlocking();
  els.playmat.classList.toggle("is-zero-search-active", zeroSearchBlocking);
  els.handZone.classList.toggle("is-hidden-for-zero-search", zeroSearchBlocking);
  els.handZone.innerHTML = "";
  const deckZone = document.getElementById("deck-zone");
  els.fieldZone.innerHTML = "";
  if (deckZone) els.fieldZone.appendChild(deckZone);

  if (!zeroSearchBlocking) {
    state.hand.forEach((card, i) => {
      const node = document.createElement("div");
      node.className = "hand-card";
      node.dataset.uid = card.uid;
      node.draggable = true;
      node.style.zIndex = String(100 + i);

      const img = document.createElement("img");
      img.className = "hand-card-image";
      img.src = card.image || CARD_BACK_IMAGE;
      img.alt = card.name || `No.${card.number}`;
      img.loading = "lazy";
      img.addEventListener("error", () => {
        img.src = CARD_BACK_IMAGE;
      });
      node.appendChild(img);

      attachHandCardInteractions(node, card);
      attachHandCardDragEvents(node, card);
      els.handZone.appendChild(node);
    });
  }

  state.field.forEach((card) => {
    const node = document.createElement("div");
    node.className = "field-card";
    if (card.viewMode === "side") node.classList.add("is-side");
    if (card.viewMode === "reverse") node.classList.add("is-reverse");
    node.style.left = `${card.x}px`;
    node.style.top = `${card.y}px`;
    const img = document.createElement("img");
    img.className = "field-card-image";
    img.src = card.viewMode === "back" ? CARD_BACK_IMAGE : (card.image || CARD_BACK_IMAGE);
    img.alt = card.name || `No.${card.number}`;
    img.draggable = false;
    img.addEventListener("error", () => {
      img.src = CARD_BACK_IMAGE;
    });
    node.appendChild(img);
    enableFieldDrag(node, card);
    node.addEventListener("click", () => {
      if (card.justDraggedUntil && card.justDraggedUntil > Date.now()) return;
      showFieldFaceMenu(card, node);
    });
    node.addEventListener("dblclick", () => {
      state.field = state.field.filter((f) => f.uid !== card.uid);
      state.hand.push({ uid: card.uid, number: card.number, name: card.name, type: card.type, image: card.image });
      renderPlay();
    });
    els.fieldZone.appendChild(node);
  });
  renderZeroSearchModal();
}

function renderZeroSearchModal() {
  const open = isZeroSearchBlocking();
  els.zeroSearchModal.classList.toggle("is-open", open);
  els.zeroSearchModal.setAttribute("aria-hidden", open ? "false" : "true");
  if (!open) return;

  if (state.zeroSearchPhase === "intro") {
    els.zeroSearchTitle.textContent = "零探し";
    els.zeroSearchDescription.textContent = "任意枚数の手札を山札の一番下に置き、同じ枚数を1回だけ引けます。";
    els.zeroSearchCards.innerHTML = "";
    els.zeroSearchSelected.textContent = "最初の手札を確認して、必要なら零探しを行ってください。";
    els.zeroSearchStartButton.style.display = "";
    els.zeroSearchSkipButton.style.display = "";
    els.zeroSearchApplyButton.style.display = "none";
    els.zeroSearchBackButton.style.display = "none";
    return;
  }

  els.zeroSearchTitle.textContent = "零探し - 入れ替える札を選択";
  els.zeroSearchDescription.textContent = "クリック順が山札下に置く順番になります。";
  els.zeroSearchCards.innerHTML = "";
  const orderMap = new Map(state.zeroSearchOrder.map((uid, idx) => [uid, idx + 1]));
  state.hand.forEach((card) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "zero-card";
    if (orderMap.has(card.uid)) button.classList.add("is-picked");
    const orderNo = orderMap.get(card.uid);
    button.innerHTML = `
      <img src="${escapeHtml(card.image || CARD_BACK_IMAGE)}" alt="${escapeHtml(card.name || `No.${card.number}`)}" />
      ${orderNo ? `<span class="order-badge">${orderNo}</span>` : ""}
    `;
    button.addEventListener("click", () => {
      const existing = state.zeroSearchOrder.indexOf(card.uid);
      if (existing >= 0) {
        state.zeroSearchOrder.splice(existing, 1);
      } else {
        state.zeroSearchOrder.push(card.uid);
      }
      renderZeroSearchModal();
    });
    els.zeroSearchCards.appendChild(button);
  });
  els.zeroSearchSelected.textContent = `選択中: ${state.zeroSearchOrder.length} 枚`;
  els.zeroSearchStartButton.style.display = "none";
  els.zeroSearchSkipButton.style.display = "";
  els.zeroSearchApplyButton.style.display = "";
  els.zeroSearchBackButton.style.display = "";
}

function applyZeroSearch() {
  const order = state.zeroSearchOrder.filter((uid) => state.hand.some((c) => c.uid === uid));
  const selectedCards = [];
  order.forEach((uid) => {
    const idx = state.hand.findIndex((c) => c.uid === uid);
    if (idx >= 0) selectedCards.push(state.hand.splice(idx, 1)[0]);
  });
  selectedCards.forEach((card) => {
    state.drawPile.unshift(card);
  });
  for (let i = 0; i < selectedCards.length; i += 1) {
    if (state.drawPile.length === 0) break;
    state.hand.push(state.drawPile.pop());
  }
  state.zeroSearchOrder = [];
  state.zeroSearchPhase = "done";
  renderPlay();
}

function attachHandCardInteractions(node, card) {
  let clickTimer = null;
  let pressTimer = null;
  let pressStartX = 0;
  let pressStartY = 0;
  let pointerId = null;
  let previewOpenedByLongPress = false;
  let dragStarted = false;
  let dragGhost = null;
  let suppressClick = false;

  const clearPressTimer = () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
  };

  const clearDragGhost = () => {
    if (dragGhost) {
      dragGhost.remove();
      dragGhost = null;
    }
    node.classList.remove("is-dragging");
    els.fieldZone.classList.remove("is-drop-target");
  };

  const updateDragGhost = (clientX, clientY) => {
    if (!dragGhost) return;
    dragGhost.style.left = `${clientX}px`;
    dragGhost.style.top = `${clientY}px`;
  };

  node.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    pointerId = event.pointerId;
    node.setPointerCapture(event.pointerId);
    pressStartX = event.clientX;
    pressStartY = event.clientY;
    previewOpenedByLongPress = false;
    dragStarted = false;
    suppressClick = false;
    clearPressTimer();
    pressTimer = setTimeout(() => {
      if (dragStarted) return;
      previewOpenedByLongPress = true;
      openCardPreview(card.number, card);
    }, 420);
  });

  node.addEventListener("pointermove", (event) => {
    if (pointerId !== event.pointerId) return;
    const moved = Math.hypot(event.clientX - pressStartX, event.clientY - pressStartY);
    if (moved > 8) clearPressTimer();
    if (!dragStarted && moved > 10) {
      dragStarted = true;
      previewOpenedByLongPress = false;
      suppressClick = true;
      clearPressTimer();
      node.classList.add("is-dragging");
      els.fieldZone.classList.add("is-drop-target");
      dragGhost = document.createElement("div");
      dragGhost.className = "hand-drag-ghost";
      dragGhost.innerHTML = `<img src="${escapeHtml(card.image || CARD_BACK_IMAGE)}" alt="${escapeHtml(card.name || `No.${card.number}`)}" />`;
      document.body.appendChild(dragGhost);
    }
    if (dragStarted) updateDragGhost(event.clientX, event.clientY);
  });

  node.addEventListener("pointerup", (event) => {
    if (pointerId !== event.pointerId) return;
    clearPressTimer();
    if (dragStarted) {
      const rect = els.fieldZone.getBoundingClientRect();
      const inside = event.clientX >= rect.left
        && event.clientX <= rect.right
        && event.clientY >= rect.top
        && event.clientY <= rect.bottom;
      if (inside) {
        const { width, height } = getFieldCardSize();
        moveHandCardToField(card.uid, {
          x: event.clientX - rect.left - width / 2,
          y: event.clientY - rect.top - height / 2,
        });
      } else {
        renderPlay();
      }
    }
    clearDragGhost();
    dragStarted = false;
    pointerId = null;
  });
  node.addEventListener("pointercancel", () => {
    clearPressTimer();
    clearDragGhost();
    dragStarted = false;
    pointerId = null;
  });
  node.addEventListener("pointerleave", () => {
    if (!dragStarted) clearPressTimer();
  });

  node.addEventListener("click", () => {
    if (suppressClick || dragStarted) {
      suppressClick = false;
      return;
    }
    if (previewOpenedByLongPress) {
      previewOpenedByLongPress = false;
      return;
    }
    if (clickTimer) clearTimeout(clickTimer);
    clickTimer = setTimeout(() => {
      openCardPreview(card.number, card);
      clickTimer = null;
    }, 170);
  });

  node.addEventListener("dblclick", () => {
    if (clickTimer) {
      clearTimeout(clickTimer);
      clickTimer = null;
    }
    playFromHand(card.uid);
  });
}

function attachHandCardDragEvents(node, card) {
  node.addEventListener("dragstart", (event) => {
    draggingHandUid = card.uid;
    node.classList.add("is-dragging");
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", card.uid);
    }
  });
  node.addEventListener("dragend", () => {
    node.classList.remove("is-dragging");
    clearHandDragState();
  });
}

function getHandDropIndex(clientX) {
  const cards = [...els.handZone.querySelectorAll(".hand-card")];
  if (cards.length === 0) return 0;
  for (let i = 0; i < cards.length; i += 1) {
    const rect = cards[i].getBoundingClientRect();
    const center = rect.left + rect.width / 2;
    if (clientX < center) return i;
  }
  return cards.length;
}

function reorderHandByUid(uid, targetIndex) {
  const fromIndex = state.hand.findIndex((c) => c.uid === uid);
  if (fromIndex === -1) return;
  const [moved] = state.hand.splice(fromIndex, 1);
  const safeTarget = clamp(targetIndex, 0, state.hand.length);
  const toIndex = fromIndex < safeTarget ? safeTarget - 1 : safeTarget;
  state.hand.splice(toIndex, 0, moved);
}

function showFieldFaceMenu(card, node) {
  const old = document.querySelector(".field-face-menu");
  if (old) old.remove();

  const menu = document.createElement("div");
  menu.className = "field-face-menu";

  const closeMenu = () => {
    menu.remove();
    document.removeEventListener("pointerdown", onOutsidePointerDown);
  };

  const addAction = (label, nextMode) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      card.viewMode = nextMode;
      closeMenu();
      renderPlay();
    });
    menu.appendChild(button);
  };

  const currentMode = card.viewMode || "front";
  if (currentMode === "back") {
    addAction("表", "front");
  } else if (currentMode === "side") {
    addAction("起", "front");
  } else if (currentMode === "reverse") {
    addAction("戻", "front");
  } else {
    addAction("裏", "back");
    addAction("伏", "side");
    addAction("逆", "reverse");
  }

  els.fieldZone.appendChild(menu);

  const nodeRect = node.getBoundingClientRect();
  const fieldRect = els.fieldZone.getBoundingClientRect();
  const left = Math.min(
    Math.max(8, nodeRect.left - fieldRect.left + node.offsetWidth + 8),
    Math.max(8, els.fieldZone.clientWidth - 96),
  );
  const top = Math.min(
    Math.max(8, nodeRect.top - fieldRect.top),
    Math.max(8, els.fieldZone.clientHeight - 84),
  );
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;

  const onOutsidePointerDown = (event) => {
    if (!menu.contains(event.target)) closeMenu();
  };
  setTimeout(() => {
    document.addEventListener("pointerdown", onOutsidePointerDown);
  }, 0);
}

function enableFieldDrag(node, card) {
  let startX = 0;
  let startY = 0;
  let originX = 0;
  let originY = 0;
  let dragging = false;
  let moved = false;
  node.addEventListener("pointerdown", (event) => {
    dragging = true;
    moved = false;
    startX = event.clientX;
    startY = event.clientY;
    originX = card.x;
    originY = card.y;
    node.setPointerCapture(event.pointerId);
  });
  node.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
    const maxX = els.fieldZone.clientWidth - node.offsetWidth;
    const maxY = els.fieldZone.clientHeight - node.offsetHeight;
    card.x = clamp(originX + dx, 0, maxX);
    card.y = clamp(originY + dy, 0, maxY);
    node.style.left = `${card.x}px`;
    node.style.top = `${card.y}px`;
  });
  node.addEventListener("pointerup", () => {
    dragging = false;
    if (moved) card.justDraggedUntil = Date.now() + 140;
  });
}

async function loadHanilCatalog() {
  const localCatalog = await loadLocalMasterCatalog();
  if (localCatalog.length > 0) {
    state.catalog = localCatalog;
    return;
  }
  try {
    const cardsHtml = await loadHanilCardsHtml();
    const parsed = parseHanilCards(cardsHtml);
    if (parsed.length > 0) state.catalog = parsed;
  } catch {
    // fallbackCatalogをそのまま使う
  }
}

async function loadLocalMasterCatalog() {
  try {
    const res = await fetch(LOCAL_MASTER_JSON_URL, { cache: "no-store" });
    if (!res.ok) return [];
    const json = await res.json();
    const cards = Array.isArray(json) ? json : json.cards;
    if (!Array.isArray(cards)) return [];
    const normalized = cards
      .map((c) => ({
        number: String(c.number || "").trim(),
        name: c.name || "",
        type: c.type || "不明",
        image: c.image || "./card/logo/cardback.jpg",
      }))
      .filter((c) => c.number);
    if (normalized.length === 0) return [];
    const hasNonPlaceholder = normalized.some(
      (c) => c.image && !/\/placeholder\.jpg$/i.test(String(c.image)),
    );
    return hasNonPlaceholder ? normalized : [];
  } catch {
    return [];
  }
}

function loadHanilCardsHtml() {
  return new Promise((resolve, reject) => {
    const done = () => {
      if (typeof window.__CARDS_HTML === "string" && window.__CARDS_HTML.length > 0) {
        resolve(window.__CARDS_HTML);
      } else {
        reject(new Error("cards html not found"));
      }
    };
    if (typeof window.__CARDS_HTML === "string" && window.__CARDS_HTML.length > 0) {
      done();
      return;
    }
    const script = document.createElement("script");
    script.src = HANIL_CARDS_JS_URL;
    script.async = true;
    script.onload = done;
    script.onerror = () => reject(new Error("failed loading cards.js"));
    document.head.appendChild(script);
  });
}

function parseHanilCards(cardsHtml) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = cardsHtml;
  return [...wrapper.querySelectorAll(".card")]
    .map((el) => {
      const num = String(el.dataset.number || "").trim();
      if (!num) return null;
      const imgEl = el.querySelector("img");
      const rawSrc = imgEl?.getAttribute("data-src") || imgEl?.getAttribute("src") || "";
      const absoluteImage = rawSrc.startsWith("http") ? rawSrc : `https://hanil524.github.io/kannagi-cardlist/${rawSrc.replace(/^\.?\//, "")}`;
      return {
        number: num,
        name: el.dataset.name || `No.${num}`,
        type: el.dataset.type || "不明",
        image: absoluteImage,
      };
    })
    .filter(Boolean);
}

function getCardMeta(number) {
  const found = state.catalog.find((c) => String(c.number) === String(number));
  if (found) return found;
  return { number: String(number), name: `No.${number}`, type: "不明", image: "./card/logo/cardback.jpg" };
}

function saveDeck() {
  localStorage.setItem(STORAGE_KEYS.deck, JSON.stringify(state.deckBuild));
}

function loadDeck() {
  const raw = localStorage.getItem(STORAGE_KEYS.deck);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((e) => ({ number: String(e.number || ""), count: Number(e.count) || 0 }))
      .filter((e) => e.number && e.count > 0);
  } catch {
    return [];
  }
}

function normalizeWholeCode(s) {
  return String(s || "").replace(/[\u00A0\u200B-\u200D\uFEFF]/g, "").replace(/\uFF5C/g, "|").replace(/\uFF1A/g, ":").replace(/\s+/g, "").trim();
}
function extractDeckCodeCandidate(input) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  const normalized = normalizeWholeCode(raw);
  if (/^(?:v?\d+|5)\|/i.test(normalized)) return normalized;

  try {
    const maybeUrl = new URL(raw);
    const fromParams = maybeUrl.searchParams.get("code") || maybeUrl.searchParams.get("deck") || maybeUrl.searchParams.get("d");
    if (fromParams) {
      const picked = normalizeWholeCode(fromParams);
      if (/^(?:v?\d+|5)\|/i.test(picked)) return picked;
    }
  } catch {
    // URLでなければそのまま継続
  }

  const match = normalized.match(/((?:v?\d+|5)\|[0-9a-f]{10}\|[A-Za-z0-9\-_]+)/i);
  return match ? match[1] : "";
}
function normalizeDeckCodeBody(s) {
  return String(s || "").replace(/[\u00A0\u200B-\u200D\uFEFF]/g, "").replace(/\uFF1A/g, ":").replace(/\uFF5C/g, "|").replace(/\s+/g, "").replace(/\|{2,}/g, "|").trim();
}
async function sha256Hex(text) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function b64urlEncode(str) {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function b64urlDecode(s) {
  let b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  return atob(b64);
}
function v6VarintDecode(bytes, pos) {
  let shift = 0;
  let res = 0;
  let i = pos;
  while (i < bytes.length) {
    const b = bytes[i++];
    res |= (b & 0x7f) << shift;
    if ((b & 0x80) === 0) return { value: res >>> 0, next: i };
    shift += 7;
  }
  return { value: null, next: i };
}
function v6BinaryToBytes(str) {
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i += 1) out[i] = str.charCodeAt(i) & 0xff;
  return out;
}
async function codeToMap(code) {
  const raw = normalizeWholeCode(code);
  if (/^5\|/.test(raw)) {
    const first = raw.indexOf("|");
    const rest = raw.slice(first + 1);
    const sep = rest.indexOf("|");
    if (sep < 0) throw new Error("bad format");
    const checksum = String(rest.slice(0, sep) || "").replace(/[^0-9a-f]/gi, "").toLowerCase();
    const payload = rest.slice(sep + 1);
    const expect = (await sha256Hex(payload)).slice(0, 10);
    if (checksum !== expect) throw new Error("checksum mismatch");
    const bytes = v6BinaryToBytes(b64urlDecode(payload));
    const map = {};
    let i = 0;
    let prev = 0;
    while (i < bytes.length) {
      const d = v6VarintDecode(bytes, i);
      if (d.value == null) break;
      i = d.next;
      const c = v6VarintDecode(bytes, i);
      if (c.value == null) break;
      i = c.next;
      const id = prev + d.value;
      prev = id;
      if (c.value > 0) map[String(id)] = (map[String(id)] || 0) + c.value;
    }
    return map;
  }
  const first = raw.indexOf("|");
  if (first <= 0) throw new Error("bad format");
  const versionRaw0 = raw.slice(0, first).toLowerCase();
  const versionRaw = versionRaw0.startsWith("v") ? versionRaw0.slice(1) : versionRaw0;
  const rest = raw.slice(first + 1);
  const sep = rest.indexOf("|");
  if (sep < 0) throw new Error("bad format");
  const checksum = String(rest.slice(0, sep) || "").replace(/[^0-9a-f]/gi, "").toLowerCase();
  const body = normalizeDeckCodeBody(rest.slice(sep + 1));
  const expect = (await sha256Hex(body)).slice(0, 10);
  if (checksum !== expect) throw new Error("checksum mismatch");
  const map = {};
  if (!body) return map;
  body.split("|").forEach((pair) => {
    const [idPart, countPart] = pair.split(":");
    if (!idPart || !countPart) return;
    const id = versionRaw === "1" ? idPart : String(parseInt(idPart, 36));
    const count = versionRaw === "1" ? parseInt(countPart, 10) : parseInt(countPart, 36);
    if (id && Number.isFinite(count) && count > 0) map[id] = (map[id] || 0) + count;
  });
  return map;
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
