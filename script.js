let state = {
    cash: 1000.00,
    betaUnlocked: false,
    dropshipping: { assets: [] },
    local: {
        shopName: 'Venture Mart',
        style: 'food',
        stock: 12,
        served: 0,
        autoScanOwned: false,
        autoScanActive: false
    },
    farm: {
        wheatSeeds: 5, tomatoSeeds: 3, cornSeeds: 2,
        rawWheat: 0, rawTomato: 0, rawCorn: 0,
        preparedBread: 0, preparedPopcorn: 0, preparedPasta: 0, preparedFeast: 0,
        yieldLvl: 0, standLvl: 0
    },
    upgrades: { copywriting: 0, pixel: 0, lights: 0, hydroponics: 0 },
    achievements: {},
    stocks: {
        '67coin': { held: 0, priceHistory: [], currentPrice: 10, baseVolatility: 0.15 },
        'Bitcoin': { held: 0, priceHistory: [], currentPrice: 100, baseVolatility: 0.08 },
        'Moscoin': { held: 0, priceHistory: [], currentPrice: 5, baseVolatility: 0.25 },
        'Gold': { held: 0, priceHistory: [], currentPrice: 50, baseVolatility: 0.03 },
        'One Piece': { held: 0, priceHistory: [], currentPrice: 1000, baseVolatility: 0.80 }
    }
};

let farmPlots = Array(6).fill(null).map(() => ({ condition: 'empty', type: '', progress: 0 }));
let currentCustomer = null;
let coopRoom = null;
let coopPlayerName = 'Owner';
let peer = null;
let connections = [];
let isHost = false;

const SHOP_CATALOGS = {
    food: { label: '🌮 Food Truck', items: ['Street Taco', 'Loaded Nachos', 'Churro Pack', 'Burrito Bowl'], min: 18, max: 32 },
    coffee: { label: '☕ Cozy Coffeehouse', items: ['Iced Latte', 'Caramel Macchiato', 'Croissant', 'Matcha Tea'], min: 8, max: 16 },
    electronics: { label: '⚡ Electronics Boutique', items: ['Wireless Earbuds', 'Smart Watch', 'Mechanical Keyboard', 'LED Monitor'], min: 65, max: 140 },
    sneakers: { label: '👟 Luxury Sneaker Vault', items: ['Air Retro Highs', 'Limited Runner', 'Designer Slides', 'Collector Box'], min: 180, max: 350 }
};

const ACHIEVEMENTS_LIST = [
    { id: 'first_scan', tier: 'easy', name: 'Beep! First Sale', desc: 'Scan your very first item at the storefront register.' },
    { id: 'rename_shop', tier: 'easy', name: 'Grand Reopening', desc: 'Give your storefront a custom business name.' },
    { id: 'first_harvest', tier: 'easy', name: 'Green Thumb', desc: 'Harvest your first crop from the farm.' },
    { id: 'first_campaign', tier: 'easy', name: 'Digital Marketer', desc: 'Launch your first dropshipping product.' },
    { id: 'serve_25', tier: 'medium', name: 'Local Favorite', desc: 'Serve 25 customers at your storefront.' },
    { id: 'cook_feast', tier: 'medium', name: 'Master Chef', desc: 'Craft a Supreme Feast in the farm kitchen.' },
    { id: 'auto_scanner', tier: 'medium', name: 'Automation Age', desc: 'Unlock the Storefront Auto-Scanner.' },
    { id: 'coop_join', tier: 'medium', name: 'Business Partners', desc: 'Join or create a Storefront Co-Op Lobby.' },
    { id: 'cash_10k', tier: 'hard', name: 'Five-Figure Founder', desc: 'Hold $10,000.00 in liquid cash.' },
    { id: 'serve_100', tier: 'hard', name: 'Retail Tycoon', desc: 'Serve 100 customers at your storefront.' },
    { id: 'hq_max', tier: 'hard', name: 'Maxed Headquarters', desc: 'Reach Level 10+ on any HQ Upgrade.' },
    { id: 'cash_100k', tier: 'impossible', name: 'Six-Figure Empire', desc: 'Accumulate $100,000.00 in liquid cash.' },
    { id: 'cash_1m', tier: 'impossible', name: 'Venture Mogul', desc: 'Reach $1,000,000.00 in liquid cash.' },
    { id: 'one_piece_holder', tier: 'impossible', name: 'King of the Pirates', desc: 'Own at least 5 units of One Piece stock.' }
];

if (localStorage.getItem('venturecraft_save')) {
    try {
        const loaded = JSON.parse(localStorage.getItem('venturecraft_save'));
        if (loaded && typeof loaded.cash === 'number') {
            state = {
                ...state,
                ...loaded,
                local: { ...state.local, ...(loaded.local || {}) },
                farm: { ...state.farm, ...(loaded.farm || {}) },
                upgrades: { ...state.upgrades, ...(loaded.upgrades || {}) },
                achievements: { ...(loaded.achievements || {}) }
            };
        }
    } catch (e) { console.error("Save error."); }
}

document.addEventListener('DOMContentLoaded', () => {
    const nicheSel = document.getElementById('local-niche-select');
    if (nicheSel) nicheSel.value = state.local.style;
    renderAchievements();
    refreshUI();
    initStockMarketHTML();
    initStockMarketLoop();
    resizeCanvas();
});

function playScannerBeep(isCheckout = false) {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(isCheckout ? 1560 : 1200, ctx.currentTime);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (isCheckout ? 0.18 : 0.09));
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + (isCheckout ? 0.18 : 0.09));
    } catch (e) {}
}

function openWelcomeModal() { document.getElementById('welcome-modal').classList.add('active'); }
function closeWelcomeModal() { document.getElementById('welcome-modal').classList.remove('active'); resizeCanvas(); }

function showTutorial(tabName, btnEl) {
    document.querySelectorAll('.tut-pane').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tut-tab').forEach(b => b.classList.remove('active'));
    document.getElementById(`tut-${tabName}`).classList.add('active');
    if (btnEl) btnEl.classList.add('active');
}

function switchScreen(id, btnEl) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if (btnEl) {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btnEl.classList.add('active');
    }
    saveProfile();
    refreshUI();
    if (id === 'stock-screen') updateStockMarketVisuals();
    if (id === 'dropshipping-screen') resizeCanvas();
    if (id === 'achievements-screen') renderAchievements();
}

function toggleTheme() { document.body.classList.toggle('light-theme'); }
function saveProfile() { localStorage.setItem('venturecraft_save', JSON.stringify(state)); }
function resetGame() { if (confirm("Wipe completely?")) { localStorage.clear(); location.reload(); } }
function startMode(mode, btnEl) { switchScreen(`${mode}-screen`, btnEl); if (mode === 'farm') renderFields(); }

function createCoopLobby() {
    const nameInput = document.getElementById('coop-player-name').value.trim();
    const roomInput = document.getElementById('coop-room-input').value.trim().toUpperCase();
    if (!roomInput) return alert("Enter a Room Code to host (e.g. SHOP)!");
    
    coopPlayerName = nameInput || 'Host';
    coopRoom = roomInput;
    isHost = true;
    connections = [];

    if (peer) peer.destroy();
    document.getElementById('coop-status-box').innerText = '⏳ Starting Lobby...';

    peer = new Peer(`venturecraft-room-${coopRoom}`);

    peer.on('open', () => {
        setCoopUIActive(true);
        logLocalMessage(`👑 Created Online Lobby [${coopRoom}]! Tell friends to enter "${coopRoom}" and click Join Lobby.`, '#34d399');
        unlockAchievement('coop_join');
    });

    peer.on('connection', (conn) => {
        connections.push(conn);
        setupConnection(conn);
    });

    peer.on('error', (err) => {
        if (err.type === 'unavailable-id') {
            alert(`Room "${coopRoom}" is already taken! Try another code or click "Join Lobby".`);
        } else {
            alert(`Lobby error: ${err.type}`);
        }
        leaveCoopLobby();
    });
}

function joinCoopLobby() {
    const nameInput = document.getElementById('coop-player-name').value.trim();
    const roomInput = document.getElementById('coop-room-input').value.trim().toUpperCase();
    if (!roomInput) return alert("Enter the Host's Room Code (e.g. SHOP)!");

    coopPlayerName = nameInput || 'Partner';
    coopRoom = roomInput;
    isHost = false;
    connections = [];

    if (peer) peer.destroy();
    document.getElementById('coop-status-box').innerText = '⏳ Connecting...';

    peer = new Peer();

    peer.on('open', () => {
        const conn = peer.connect(`venturecraft-room-${coopRoom}`);
        connections.push(conn);
        setupConnection(conn);

        conn.on('open', () => {
            setCoopUIActive(true);
            conn.send({ type: 'HELLO', sender: coopPlayerName });
            logLocalMessage(`🤝 Connected to ${coopRoom}! Running the storefront together.`, '#34d399');
            unlockAchievement('coop_join');
        });
    });

    peer.on('error', () => {
        alert(`Could not find active lobby "${coopRoom}". Make sure the host created it first!`);
        leaveCoopLobby();
    });
}

function setupConnection(conn) {
    conn.on('data', (msg) => {
        if (msg.type === 'SYNC_STATE') {
            state.cash = msg.cash;
            state.local = { ...state.local, ...msg.local };
            currentCustomer = msg.customer;
            if (msg.log) logLocalMessage(msg.log, '#60a5fa');
            saveProfile();
            refreshUI();
            if (isHost) {
                connections.forEach(c => { if (c !== conn && c.open) c.send(msg); });
            }
        } else if (msg.type === 'HELLO') {
            document.getElementById('coop-staff-list').innerText = `${coopPlayerName} & ${msg.sender}`;
            logLocalMessage(`👋 ${msg.sender} joined your storefront team!`, '#fbbf24');
            if (isHost) {
                conn.send({ type: 'HELLO_ACK', hostName: coopPlayerName });
                broadcastCoopUpdate(`${coopPlayerName} synced the shop state!`);
            }
        } else if (msg.type === 'HELLO_ACK') {
            document.getElementById('coop-staff-list').innerText = `${msg.hostName} & ${coopPlayerName}`;
        }
    });

    conn.on('close', () => {
        logLocalMessage(`⚠️ A partner disconnected from the lobby.`, '#f87171');
    });
}

function setCoopUIActive(active) {
    document.getElementById('coop-join-controls').style.display = active ? 'none' : 'grid';
    document.getElementById('coop-active-controls').style.display = active ? 'flex' : 'none';
    document.getElementById('coop-top-badge').style.display = active ? 'inline-block' : 'none';
    if (active) {
        document.getElementById('coop-active-code').innerText = coopRoom;
        document.getElementById('coop-top-code').innerText = coopRoom;
        document.getElementById('coop-status-box').innerText = `🟢 Online: ${coopRoom}`;
        document.getElementById('coop-status-box').classList.add('coop-online');
        document.getElementById('coop-staff-list').innerText = coopPlayerName;
    } else {
        document.getElementById('coop-status-box').innerText = 'Offline (Solo Mode)';
        document.getElementById('coop-status-box').classList.remove('coop-online');
    }
}

function leaveCoopLobby() {
    connections.forEach(c => c.close());
    connections = [];
    if (peer) peer.destroy();
    peer = null;
    coopRoom = null;
    isHost = false;
    setCoopUIActive(false);
}

function broadcastCoopUpdate(logText = '') {
    if (!coopRoom || connections.length === 0) return;
    const payload = {
        type: 'SYNC_STATE',
        cash: state.cash,
        local: state.local,
        customer: currentCustomer,
        log: logText
    };
    connections.forEach(c => {
        if (c.open) c.send(payload);
    });
}

/* INTERACTIVE STOREFRONT & WORKING CUSTOMER QUEUE */
function renameShop() {
    const newName = document.getElementById('shop-rename-input').value.trim();
    if (!newName) return alert("Enter a shop name!");
    state.local.shopName = newName;
    document.getElementById('shop-rename-input').value = '';
    logLocalMessage(`🏷️ Shop renamed to "${newName}"!`, '#fbbf24');
    unlockAchievement('rename_shop');
    saveProfile();
    refreshUI();
    broadcastCoopUpdate(`${coopPlayerName} renamed the shop to "${newName}"`);
}

function changeNiche() {
    state.local.style = document.getElementById('local-niche-select').value;
    currentCustomer = null;
    saveProfile();
    refreshUI();
    broadcastCoopUpdate(`${coopPlayerName} switched store niche`);
}

function buyInventory() {
    if (state.betaUnlocked) {
        state.local.stock += 50;
        logLocalMessage(`📦 [BETA] Restocked +50 units for FREE!`, '#c084fc');
        saveProfile();
        refreshUI();
        broadcastCoopUpdate(`${coopPlayerName} restocked +50 units`);
        return;
    }
    if (state.cash >= 100) {
        state.cash = parseFloat((state.cash - 100).toFixed(2));
        state.local.stock += 15;
        logLocalMessage(`📦 Restocked +15 shelf units (-$100.00)`, '#60a5fa');
        saveProfile();
        refreshUI();
        broadcastCoopUpdate(`${coopPlayerName} restocked +15 units`);
    } else {
        alert("Not enough cash to restock ($100 needed)!");
    }
}

function buyOrToggleAutoScan() {
    if (!state.local.autoScanOwned) {
        if (state.betaUnlocked || state.cash >= 400) {
            if (!state.betaUnlocked) state.cash = parseFloat((state.cash - 400).toFixed(2));
            state.local.autoScanOwned = true;
            state.local.autoScanActive = true;
            unlockAchievement('auto_scanner');
            logLocalMessage(`🤖 Auto-Scanner installed and active!`, '#c084fc');
            saveProfile();
            refreshUI();
        } else {
            alert("You need $400.00 to unlock the Auto-Scanner!");
        }
    } else {
        state.local.autoScanActive = !state.local.autoScanActive;
        saveProfile();
        refreshUI();
    }
}

function spawnCustomer() {
    if (currentCustomer || state.local.stock <= 0) return;
    const cat = SHOP_CATALOGS[state.local.style] || SHOP_CATALOGS.food;
    const avatars = ['🧑', '👩', '🧔', '👱‍♀️', '🧕', '👴', '👩‍💼', '🧑‍🎓'];
    const count = Math.min(state.local.stock, Math.floor(Math.random() * 3) + 1);
    let basket = [];
    for (let i = 0; i < count; i++) {
        const itemName = cat.items[Math.floor(Math.random() * cat.items.length)];
        const price = parseFloat((Math.random() * (cat.max - cat.min) + cat.min).toFixed(2));
        basket.push({ name: itemName, price });
    }
    currentCustomer = {
        avatar: avatars[Math.floor(Math.random() * avatars.length)],
        basket,
        scannedTotal: 0
    };
    refreshUI();
}

function scanCustomerItem() {
    if (!currentCustomer || currentCustomer.basket.length === 0) return;
    if (state.local.stock <= 0) {
        currentCustomer = null;
        refreshUI();
        return alert("Out of stock! Restock your shelves.");
    }

    const item = currentCustomer.basket.shift();
    state.local.stock--;
    currentCustomer.scannedTotal = parseFloat((currentCustomer.scannedTotal + item.price).toFixed(2));
    unlockAchievement('first_scan');

    if (currentCustomer.basket.length > 0) {
        playScannerBeep(false);
        logLocalMessage(`🔊 Scanned ${item.name} ($${item.price.toFixed(2)}) — ${currentCustomer.basket.length} left`, '#93c5fd');
        broadcastCoopUpdate(`${coopPlayerName} scanned ${item.name}`);
    } else {
        playScannerBeep(true);
        const earned = currentCustomer.scannedTotal;
        state.cash = parseFloat((state.cash + earned).toFixed(2));
        state.local.served++;
        logLocalMessage(`💰 Checkout complete! +$${earned.toFixed(2)} earned!`, '#10b981');
        currentCustomer = null;
        broadcastCoopUpdate(`${coopPlayerName} completed checkout (+$${earned.toFixed(2)})`);
    }

    saveProfile();
    refreshUI();
}

function logLocalMessage(msg, color = "#fff") {
    const feed = document.getElementById('local-feed');
    if (feed) feed.innerHTML = `<div style="color:${color};">${msg}</div>` + feed.innerHTML;
}

/* CUSTOMER SPAWN & AUTO-SCAN LOOP */
setInterval(() => {
    const trafficBoost = state.upgrades.lights * 0.08;
    if (!currentCustomer && state.local.stock > 0 && Math.random() < (0.45 + trafficBoost)) {
        spawnCustomer();
    } else if (currentCustomer && state.local.autoScanOwned && state.local.autoScanActive) {
        scanCustomerItem();
    }
}, 2200);

/* ACHIEVEMENTS SYSTEM */
function unlockAchievement(id) {
    if (state.achievements[id]) return;
    const ach = ACHIEVEMENTS_LIST.find(a => a.id === id);
    if (!ach) return;
    state.achievements[id] = true;
    saveProfile();

    const container = document.getElementById('achievement-toast-container');
    if (container) {
        const toast = document.createElement('div');
        toast.className = 'ach-toast';
        toast.innerHTML = `<div class="ach-toast-title">🏆 Achievement Unlocked (${ach.tier})</div>
            <div class="ach-toast-name">${ach.name}</div>
            <div class="ach-toast-desc">${ach.desc}</div>`;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 4500);
    }
    renderAchievements();
}

function checkStatAchievements() {
    if (state.local.served >= 25) unlockAchievement('serve_25');
    if (state.local.served >= 100) unlockAchievement('serve_100');
    if (state.cash >= 10000) unlockAchievement('cash_10k');
    if (state.cash >= 100000) unlockAchievement('cash_100k');
    if (state.cash >= 1000000) unlockAchievement('cash_1m');
    if (state.stocks['One Piece'] && state.stocks['One Piece'].held >= 5) unlockAchievement('one_piece_holder');
    const u = state.upgrades;
    if (u.copywriting >= 10 || u.pixel >= 10 || u.lights >= 10 || u.hydroponics >= 10) unlockAchievement('hq_max');
}

function renderAchievements() {
    const grid = document.getElementById('achievements-grid');
    const unlockedCount = Object.keys(state.achievements).length;
    if (document.getElementById('nav-ach-count')) document.getElementById('nav-ach-count').innerText = unlockedCount;
    if (document.getElementById('dash-ach-count')) document.getElementById('dash-ach-count').innerText = unlockedCount;
    if (!grid) return;

    grid.innerHTML = '';
    ACHIEVEMENTS_LIST.forEach(ach => {
        const isDone = !!state.achievements[ach.id];
        const card = document.createElement('div');
        card.className = `ach-card ${isDone ? 'unlocked' : ''}`;
        card.innerHTML = `
            <div class="ach-top">
                <span class="ach-tier tier-${ach.tier}">${ach.tier}</span>
                <span>${isDone ? '✅ UNLOCKED' : '🔒 LOCKED'}</span>
            </div>
            <h4>${ach.name}</h4>
            <p>${ach.desc}</p>`;
        grid.appendChild(card);
    });
}
/* BETA MODE (NO INFINITE MONEY) */
function unlockBeta() {
    const code = document.getElementById('beta-code-input').value.trim();
    if (code === '3105') {
        state.betaUnlocked = true;
        state.upgrades.copywriting = Math.max(state.upgrades.copywriting, 999);
        state.upgrades.pixel = Math.max(state.upgrades.pixel, 999);
        state.upgrades.lights = Math.max(state.upgrades.lights, 999);
        state.upgrades.hydroponics = Math.max(state.upgrades.hydroponics, 999);
        state.farm.yieldLvl = Math.max(state.farm.yieldLvl, 999);
        state.farm.standLvl = Math.max(state.farm.standLvl, 999);
        saveProfile();
        refreshUI();
        alert("🧪 Beta Mode Unlocked! Infinite Copywriting, Uncapped Free Upgrades, Free Auto-Scanner, and $0 Supplies enabled!");
    } else {
        alert("❌ Incorrect Beta Code!");
    }
}

function maxOutUpgrades() {
    state.upgrades.copywriting += 100;
    state.upgrades.pixel += 100;
    state.upgrades.lights += 100;
    state.upgrades.hydroponics += 100;
    state.farm.yieldLvl += 100;
    state.farm.standLvl += 100;
    saveProfile();
    refreshUI();
}

/* UI REFRESH */
function refreshUI() {
    checkStatAchievements();

    if (state.betaUnlocked) {
        if (document.getElementById('beta-lock-panel')) document.getElementById('beta-lock-panel').style.display = 'none';
        if (document.getElementById('beta-unlocked-panel')) document.getElementById('beta-unlocked-panel').style.display = 'block';
        if (document.getElementById('restock-btn-text')) document.getElementById('restock-btn-text').innerText = 'FREE for 50x Units';
        if (document.getElementById('cost-seed-w')) document.getElementById('cost-seed-w').innerText = '50x • FREE';
        if (document.getElementById('cost-seed-t')) document.getElementById('cost-seed-t').innerText = '50x • FREE';
        if (document.getElementById('cost-seed-c')) document.getElementById('cost-seed-c').innerText = '50x • FREE';
    }

    document.querySelectorAll('.global-cash-display').forEach(el => el.innerText = state.cash.toFixed(2));
    if (document.getElementById('dash-shop-name')) document.getElementById('dash-shop-name').innerText = state.local.shopName;
    if (document.getElementById('storefront-header-title')) document.getElementById('storefront-header-title').innerText = `🏪 ${state.local.shopName}`;
    if (document.getElementById('local-inv')) document.getElementById('local-inv').innerText = state.local.stock;
    if (document.getElementById('local-served-count')) document.getElementById('local-served-count').innerText = state.local.served;

    const lowBadge = document.getElementById('low-stock-badge');
    if (lowBadge) lowBadge.style.display = state.local.stock <= 5 ? 'inline-block' : 'none';

    const scanBtn = document.getElementById('scan-item-btn');
    if (currentCustomer && currentCustomer.basket.length > 0) {
        document.getElementById('customer-avatar').innerText = currentCustomer.avatar;
        document.getElementById('customer-status-title').innerText = `Customer at Checkout (${currentCustomer.basket.length} items)`;
        document.getElementById('customer-basket-text').innerText = `Next item: ${currentCustomer.basket[0].name} ($${currentCustomer.basket[0].price.toFixed(2)})`;
        document.getElementById('reg-items-left').innerText = currentCustomer.basket.length;
        document.getElementById('reg-order-total').innerText = currentCustomer.scannedTotal.toFixed(2);
        if (scanBtn) scanBtn.disabled = false;
    } else {
        document.getElementById('customer-avatar').innerText = state.local.stock > 0 ? '⏳' : '🚫';
        document.getElementById('customer-status-title').innerText = state.local.stock > 0 ? 'Waiting for next customer...' : 'Store Out of Stock!';
        document.getElementById('customer-basket-text').innerText = state.local.stock > 0 ? 'Shoppers will arrive automatically.' : 'Click Restock Bulk Inventory to reopen!';
        document.getElementById('reg-items-left').innerText = '0';
        document.getElementById('reg-order-total').innerText = '0.00';
        if (scanBtn) scanBtn.disabled = true;
    }

    const autoBtn = document.getElementById('auto-scan-btn');
    if (autoBtn) {
        if (!state.local.autoScanOwned) {
            autoBtn.innerText = state.betaUnlocked ? '🤖 Unlock Auto-Scanner (FREE)' : '🤖 Unlock Auto-Scanner ($400)';
        } else {
            autoBtn.innerText = state.local.autoScanActive ? '🤖 Auto-Scanner: ON (Click to Pause)' : '⏸️ Auto-Scanner: PAUSED (Click to Resume)';
        }
    }

    if (document.getElementById('farm-seeds-w')) document.getElementById('farm-seeds-w').innerText = state.farm.wheatSeeds;
    if (document.getElementById('farm-seeds-t')) document.getElementById('farm-seeds-t').innerText = state.farm.tomatoSeeds;
    if (document.getElementById('farm-seeds-c')) document.getElementById('farm-seeds-c').innerText = state.farm.cornSeeds;
    if (document.getElementById('inv-wheat')) document.getElementById('inv-wheat').innerText = state.farm.rawWheat;
    if (document.getElementById('inv-tomato')) document.getElementById('inv-tomato').innerText = state.farm.rawTomato;
    if (document.getElementById('inv-corn')) document.getElementById('inv-corn').innerText = state.farm.rawCorn;
    if (document.getElementById('inv-bread')) document.getElementById('inv-bread').innerText = state.farm.preparedBread;
    if (document.getElementById('inv-popcorn')) document.getElementById('inv-popcorn').innerText = state.farm.preparedPopcorn;
    if (document.getElementById('inv-pasta')) document.getElementById('inv-pasta').innerText = state.farm.preparedPasta;
    if (document.getElementById('inv-feast')) document.getElementById('inv-feast').innerText = state.farm.preparedFeast;

    document.getElementById('up-copy-lvl').innerText = state.upgrades.copywriting;
    document.getElementById('up-copy-cost').innerText = state.betaUnlocked ? '0' : (state.upgrades.copywriting >= 10 ? 'MAX' : (state.upgrades.copywriting + 1) * 200);
    document.getElementById('up-pixel-lvl').innerText = state.upgrades.pixel;
    document.getElementById('up-pixel-cost').innerText = state.betaUnlocked ? '0' : (state.upgrades.pixel >= 10 ? 'MAX' : (state.upgrades.pixel + 1) * 350);
    document.getElementById('up-lights-lvl').innerText = state.upgrades.lights;
    document.getElementById('up-lights-cost').innerText = state.betaUnlocked ? '0' : (state.upgrades.lights >= 10 ? 'MAX' : (state.upgrades.lights + 1) * 250);
    document.getElementById('up-hydro-lvl').innerText = state.upgrades.hydroponics;
    document.getElementById('up-hydro-cost').innerText = state.betaUnlocked ? '0' : (state.upgrades.hydroponics >= 10 ? 'MAX' : (state.upgrades.hydroponics + 1) * 300);

    if (document.getElementById('up-yield-lvl')) document.getElementById('up-yield-lvl').innerText = state.farm.yieldLvl;
    if (document.getElementById('up-yield-cost')) document.getElementById('up-yield-cost').innerText = state.betaUnlocked ? '0' : (state.farm.yieldLvl + 1) * 250;
    if (document.getElementById('up-stand-lvl')) document.getElementById('up-stand-lvl').innerText = state.farm.standLvl;
    if (document.getElementById('up-stand-cost')) document.getElementById('up-stand-cost').innerText = state.betaUnlocked ? '0' : (state.farm.standLvl + 1) * 400;
}
/* HQ & FARM UPGRADES */
function buyUpgrade(type) {
    if (type === 'hydroponic') type = 'hydroponics';
    if (state.betaUnlocked) { state.upgrades[type]++; saveProfile(); refreshUI(); return; }
    let currentLvl = state.upgrades[type];
    if (currentLvl >= 10) return alert("Max Level 10 reached!");
    let cost = type === 'copywriting' ? (currentLvl + 1) * 200 : type === 'pixel' ? (currentLvl + 1) * 350 : type === 'lights' ? (currentLvl + 1) * 250 : (currentLvl + 1) * 300;
    if (state.cash >= cost) {
        state.cash = parseFloat((state.cash - cost).toFixed(2));
        state.upgrades[type]++;
        saveProfile();
        refreshUI();
    } else { alert("Not enough money!"); }
}

function buyFarmUpgrade(type) {
    if (state.betaUnlocked) {
        if (type === 'yield') state.farm.yieldLvl++;
        if (type === 'stand') state.farm.standLvl++;
        saveProfile(); refreshUI(); return;
    }
    const cost = type === 'yield' ? (state.farm.yieldLvl + 1) * 250 : (state.farm.standLvl + 1) * 400;
    if (state.cash >= cost) {
        state.cash = parseFloat((state.cash - cost).toFixed(2));
        if (type === 'yield') state.farm.yieldLvl++;
        if (type === 'stand') state.farm.standLvl++;
        saveProfile(); refreshUI();
    } else { alert("Not enough cash for farm equipment!"); }
}

function buySeeds(type) {
    if (state.betaUnlocked) {
        if (type === 'wheat') state.farm.wheatSeeds += 50;
        if (type === 'tomato') state.farm.tomatoSeeds += 50;
        if (type === 'corn') state.farm.cornSeeds += 50;
        saveProfile(); refreshUI(); return;
    }
    if (type === 'wheat' && state.cash >= 10) { state.cash = parseFloat((state.cash - 10).toFixed(2)); state.farm.wheatSeeds += 5; }
    else if (type === 'tomato' && state.cash >= 25) { state.cash = parseFloat((state.cash - 25).toFixed(2)); state.farm.tomatoSeeds += 3; }
    else if (type === 'corn' && state.cash >= 40) { state.cash = parseFloat((state.cash - 40).toFixed(2)); state.farm.cornSeeds += 4; }
    else { return alert("Not enough cash for seeds!"); }
    saveProfile(); refreshUI();
}

/* FARM PLOTS, ROADSIDE STAND & KITCHEN */
function renderFields() {
    const grid = document.getElementById('farmPlotsContainer');
    if (!grid) return;
    grid.innerHTML = '';
    farmPlots.forEach((plot, idx) => {
        const card = document.createElement('div');
        card.className = `plot-card ${plot.condition}`;
        if (plot.condition === 'empty') {
            card.innerHTML = `<h4>Plot ${idx + 1}</h4>
                <button class="btn btn-primary btn-sm" onclick="plantCrop(${idx}, 'wheat')">🌾 Wheat</button>
                <button class="btn btn-warning btn-sm" onclick="plantCrop(${idx}, 'tomato')">🍅 Tomato</button>
                <button class="btn btn-success btn-sm" onclick="plantCrop(${idx}, 'corn')">🌽 Corn</button>`;
        } else if (plot.condition === 'growing') {
            card.innerHTML = `<h4>Plot ${idx + 1}</h4><p style="color:#60a5fa; font-size:0.85rem;">Growing ${plot.type} (${plot.progress}%)</p>`;
        } else if (plot.condition === 'ready') {
            card.innerHTML = `<h4>Plot ${idx + 1}</h4><button class="btn btn-success btn-sm" onclick="harvestCrop(${idx})">✨ Harvest ${plot.type}</button>`;
        }
        grid.appendChild(card);
    });
}

window.plantCrop = function (idx, type) {
    if (type === 'wheat' && state.farm.wheatSeeds > 0) { state.farm.wheatSeeds--; farmPlots[idx] = { condition: 'growing', type: 'wheat', progress: 0 }; }
    else if (type === 'tomato' && state.farm.tomatoSeeds > 0) { state.farm.tomatoSeeds--; farmPlots[idx] = { condition: 'growing', type: 'tomato', progress: 0 }; }
    else if (type === 'corn' && state.farm.cornSeeds > 0) { state.farm.cornSeeds--; farmPlots[idx] = { condition: 'growing', type: 'corn', progress: 0 }; }
    else { return alert("No seeds available!"); }
    renderFields(); refreshUI();
    let speed = 1 + (state.upgrades.hydroponics * 0.25);
    let interval = setInterval(() => {
        if (farmPlots[idx] && farmPlots[idx].condition === 'growing') {
            farmPlots[idx].progress += Math.round(10 * speed);
            if (farmPlots[idx].progress >= 100) { farmPlots[idx].progress = 100; farmPlots[idx].condition = 'ready'; clearInterval(interval); }
            if (document.getElementById('farm-screen').classList.contains('active')) renderFields();
        } else { clearInterval(interval); }
    }, 800);
};

window.harvestCrop = function (idx) {
    const bonus = 2 + state.farm.yieldLvl;
    if (farmPlots[idx].type === 'wheat') state.farm.rawWheat += bonus;
    else if (farmPlots[idx].type === 'tomato') state.farm.rawTomato += bonus;
    else if (farmPlots[idx].type === 'corn') state.farm.rawCorn += bonus;
    farmPlots[idx] = { condition: 'empty', type: '', progress: 0 };
    unlockAchievement('first_harvest');
    saveProfile(); renderFields(); refreshUI();
};

setInterval(() => {
    if (state.farm.standLvl > 0) {
        let sold = 0;
        if (state.farm.rawWheat > 0) { state.farm.rawWheat--; sold += 8 * state.farm.standLvl; }
        else if (state.farm.rawTomato > 0) { state.farm.rawTomato--; sold += 12 * state.farm.standLvl; }
        else if (state.farm.rawCorn > 0) { state.farm.rawCorn--; sold += 15 * state.farm.standLvl; }
        if (sold > 0) {
            state.cash = parseFloat((state.cash + sold).toFixed(2));
            logFarmMessage(`🛖 Roadside Stand auto-sold raw crop (+$${sold.toFixed(2)})`, '#10b981');
            refreshUI();
        }
    }
}, 8000);

window.processFood = function (type) {
    if (type === 'bread' && state.farm.rawWheat >= 3) { state.farm.rawWheat -= 3; state.farm.preparedBread++; logFarmMessage("🍞 Baked 1x Fresh Bread!", "#38bdf8"); }
    else if (type === 'popcorn' && state.farm.rawCorn >= 3) { state.farm.rawCorn -= 3; state.farm.preparedPopcorn++; logFarmMessage("🍿 Popped 1x Butter Popcorn!", "#38bdf8"); }
    else if (type === 'pasta' && state.farm.rawWheat >= 2 && state.farm.rawTomato >= 2) { state.farm.rawWheat -= 2; state.farm.rawTomato -= 2; state.farm.preparedPasta++; logFarmMessage("🍝 Cooked 1x Tomato Pasta!", "#38bdf8"); }
    else if (type === 'feast' && state.farm.rawWheat >= 2 && state.farm.rawTomato >= 2 && state.farm.rawCorn >= 2) {
        state.farm.rawWheat -= 2; state.farm.rawTomato -= 2; state.farm.rawCorn -= 2; state.farm.preparedFeast++;
        unlockAchievement('cook_feast');
        logFarmMessage("🌮 Crafted 1x Supreme Feast!", "#fbbf24");
    } else { return alert("Not enough raw crops in your silo!"); }
    saveProfile(); refreshUI();
};

window.sellFood = function (type) {
    const prices = { bread: 45, popcorn: 65, pasta: 90, feast: 160 };
    const keys = { bread: 'preparedBread', popcorn: 'preparedPopcorn', pasta: 'preparedPasta', feast: 'preparedFeast' };
    if (state.farm[keys[type]] > 0) {
        state.farm[keys[type]]--;
        state.cash = parseFloat((state.cash + prices[type]).toFixed(2));
        logFarmMessage(`💰 Sold 1x ${type.toUpperCase()} for $${prices[type].toFixed(2)}!`, "#10b981");
        saveProfile(); refreshUI();
    } else { alert("None in kitchen stock to sell!"); }
};

function logFarmMessage(msg, color = "#fff") {
    const feed = document.getElementById('farm-feed');
    if (feed) feed.innerHTML = `<div style="color:${color};">${msg}</div>` + feed.innerHTML;
}
/* DROPSHIPPING & STOCKS */
const board = document.getElementById('productCanvas');
let drawEngine = board ? board.getContext('2d') : null;
let painting = false, lastDrawX = 0, lastDrawY = 0;

function resizeCanvas() {
    if (board && board.offsetWidth > 0) { board.width = board.offsetWidth; board.height = board.offsetHeight || 150; }
}

if (board && drawEngine) {
    board.addEventListener('mousedown', (e) => {
        painting = true; const d = board.getBoundingClientRect();
        lastDrawX = (e.clientX - d.left) * (board.width / d.width);
        lastDrawY = (e.clientY - d.top) * (board.height / d.height);
    });
    board.addEventListener('mouseup', () => painting = false);
    board.addEventListener('mouseleave', () => painting = false);
    board.addEventListener('mousemove', (e) => {
        if (!painting || !drawEngine) return;
        drawEngine.lineWidth = 4; drawEngine.lineCap = 'round'; drawEngine.strokeStyle = '#0f172a';
        const d = board.getBoundingClientRect();
        const cx = (e.clientX - d.left) * (board.width / d.width);
        const cy = (e.clientY - d.top) * (board.height / d.height);
        drawEngine.beginPath(); drawEngine.moveTo(lastDrawX, lastDrawY); drawEngine.lineTo(cx, cy); drawEngine.stroke();
        lastDrawX = cx; lastDrawY = cy;
    });
}
function clearCanvas() { if (drawEngine) drawEngine.clearRect(0, 0, board.width, board.height); }

function saveProduct() {
    const tBox = document.getElementById('drop-name'), cBox = document.getElementById('drop-price'), dBox = document.getElementById('drop-desc');
    if (!tBox.value || !cBox.value || !dBox.value) return alert("Fill fields!");
    const price = parseFloat(cBox.value), pitch = dBox.value.toLowerCase();
    let score = 25;
    if (pitch.length > 25) score += 20;
    if (pitch.length > 70) score += 20;
    if (pitch.includes("premium") || pitch.includes("luxury")) score += 15;
    score += (state.upgrades.copywriting * 15);
    let conv = Math.max(6, score - (price / (3.0 + state.upgrades.pixel)));
    state.dropshipping.assets.push({ title: tBox.value, cost: price, conversionChance: Math.min(conv, 95) });
    document.getElementById('drop-feed').innerHTML = `<div>[SYS] "${tBox.value}" launched (${Math.round(conv)}% chance)</div>` + document.getElementById('drop-feed').innerHTML;
    unlockAchievement('first_campaign');
    tBox.value = ''; cBox.value = ''; dBox.value = ''; clearCanvas(); saveProfile(); refreshUI();
}

setInterval(() => {
    if (state.dropshipping.assets.length > 0 && document.getElementById('dropshipping-screen').classList.contains('active')) {
        const item = state.dropshipping.assets[Math.floor(Math.random() * state.dropshipping.assets.length)];
        if (Math.random() * 100 < item.conversionChance) {
            const net = parseFloat((item.cost * 0.6).toFixed(2));
            state.cash = parseFloat((state.cash + net).toFixed(2));
            document.getElementById('drop-feed').innerHTML = `<div style="color:#10b981;">✔ Bought 1x "${item.title}" (+$${net})</div>` + document.getElementById('drop-feed').innerHTML;
        }
        refreshUI();
    }
}, 3800);

function initStockMarketHTML() {
    const container = document.getElementById('stock-grid-container');
    if (!container) return;
    container.innerHTML = '';
    for (let name in state.stocks) {
        let id = name.replace(' ', '-');
        let card = document.createElement('div');
        card.className = 'panel'; card.id = `stock-card-${id}`; card.style.marginBottom = '0';
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <div><h3 style="margin:0; border:none; padding:0;" id="stock-name-${id}">${name}</h3><small id="stock-held-${id}">Owned: 0</small></div>
                <div style="text-align:right;"><div style="font-size:1.3rem; font-weight:bold;" id="stock-price-${id}">$0</div><small id="stock-trend-${id}">📈 WANTED</small></div>
            </div>
            <div style="height:40px; background:rgba(0,0,0,0.2); border-radius:4px; margin-bottom:10px;">
                <svg viewBox="0 0 100 40" preserveAspectRatio="none" style="width:100%; height:100%;"><polyline fill="none" id="stock-polyline-${id}" stroke="#10b981" stroke-width="2" points="0,20 100,20"/></svg>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <div><input type="number" id="amt-buy-${id}" placeholder="Amount ($)" style="margin-bottom:5px; padding:6px;"><button class="btn btn-success btn-sm" onclick="tradeAsset('${name}', 'buy')">Buy</button></div>
                <div><input type="number" id="amt-sell-${id}" placeholder="Units" style="margin-bottom:5px; padding:6px;"><button class="btn btn-sm" style="background:var(--danger-color);" onclick="tradeAsset('${name}', 'sell')">Sell</button></div>
            </div>`;
        container.appendChild(card);
    }
}

function initStockMarketLoop() {
    setInterval(() => {
        let alerts = [];
        for (let name in state.stocks) {
            let asset = state.stocks[name];
            let change = (Math.random() - 0.48) * 2 * asset.baseVolatility;
            if (name === 'One Piece') { if (Math.random() < 0.01) change = 8.0; else change = (Math.random() - 0.65) * asset.baseVolatility; }
            asset.currentPrice = Math.max(0.50, asset.currentPrice * (1 + change));
            asset.priceHistory.push(asset.currentPrice);
            if (asset.priceHistory.length > 15) asset.priceHistory.shift();
            if (change > 0.15 && asset.held > 0) alerts.push(`🔥 "${name}" is highly WANTED! Sell now!`);
        }
        const displayAlert = document.getElementById('market-notification');
        if (displayAlert) {
            if (alerts.length > 0 && document.getElementById('stock-screen').classList.contains('active')) {
                displayAlert.innerText = alerts.join(" | "); displayAlert.style.display = 'block';
            } else { displayAlert.style.display = 'none'; }
        }
        if (document.getElementById('stock-screen').classList.contains('active')) updateStockMarketVisuals();
    }, 6000);
}

function updateStockMarketVisuals() {
    for (let name in state.stocks) {
        let asset = state.stocks[name], id = name.replace(' ', '-'), hist = asset.priceHistory;
        let trend = hist.length > 1 ? hist[hist.length - 1] >= hist[hist.length - 2] : true, color = trend ? '#10b981' : '#ef4444';
        if (document.getElementById(`stock-card-${id}`)) document.getElementById(`stock-card-${id}`).style.borderColor = color;
        if (document.getElementById(`stock-name-${id}`)) document.getElementById(`stock-name-${id}`).style.color = color;
        if (document.getElementById(`stock-held-${id}`)) document.getElementById(`stock-held-${id}`).innerText = `Owned: ${asset.held.toFixed(2)}`;
        if (document.getElementById(`stock-price-${id}`)) { document.getElementById(`stock-price-${id}`).innerText = `$${asset.currentPrice.toFixed(2)}`; document.getElementById(`stock-price-${id}`).style.color = color; }
        if (document.getElementById(`stock-trend-${id}`)) { document.getElementById(`stock-trend-${id}`).innerText = trend ? '📈 WANTED' : '📉 UNWANTED'; document.getElementById(`stock-trend-${id}`).style.color = color; }
        if (document.getElementById(`stock-polyline-${id}`)) {
            let min = Math.min(...hist), max = Math.max(...hist), r = max - min === 0 ? 1 : max - min;
            let pts = hist.map((v, i) => `${(i / Math.max(1, hist.length - 1)) * 100},${40 - (((v - min) / r) * 32 + 4)}`).join(' ');
            document.getElementById(`stock-polyline-${id}`).setAttribute('points', pts);
            document.getElementById(`stock-polyline-${id}`).setAttribute('stroke', color);
        }
    }
}

window.tradeAsset = function (name, action) {
    let asset = state.stocks[name], id = name.replace(' ', '-');
    if (action === 'buy') {
        let val = parseFloat(document.getElementById(`amt-buy-${id}`).value);
        if (isNaN(val) || val <= 0 || state.cash < val) return alert("Invalid entry or funds!");
        state.cash = parseFloat((state.cash - val).toFixed(2));
        asset.held += (val / asset.currentPrice);
    } else {
        let units = parseFloat(document.getElementById(`amt-sell-${id}`).value);
        if (isNaN(units) || units <= 0 || asset.held < units) return alert("Invalid units!");
        state.cash = parseFloat((state.cash + (units * asset.currentPrice)).toFixed(2));
        asset.held -= units;
    }
    document.getElementById(`amt-buy-${id}`).value = ''; document.getElementById(`amt-sell-${id}`).value = '';
    saveProfile(); refreshUI(); updateStockMarketVisuals();
};
