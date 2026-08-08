/**
 * LexiClash - Frontend Socket & UI Client Logic
 */

const SERVER_URL = "https://lexiclash-server.onrender.com";


const socket = io(SERVER_URL, {
    transports: ["websocket"],
    reconnection: true,
    reconnectionAttempts: 10
});

// State Management
const state = {
    playerName: '',
    roomCode: '',
    isHost: false,
    myTurn: false,
    wordLengthRange: '3-5',
    secretWord: '',
    opponentWordMask: [],
    ownWordMask: [],
    guessedLetters: []
};

// DOM Cache
const elements = {
    statusBadge: document.getElementById('connection-status'),
    toastContainer: document.getElementById('toast-container'),
    screens: {
        lobby: document.getElementById('screen-lobby'),
        room: document.getElementById('screen-room'),
        game: document.getElementById('screen-game')
    },

    // Lobby Elements & Errors
    inputPlayerName: document.getElementById('player-name'),
    errorPlayerName: document.getElementById('error-player-name'),
    inputRoomCode: document.getElementById('join-room-code'),
    errorRoomCode: document.getElementById('error-room-code'),
    btnCreateRoom: document.getElementById('btn-create-room'),
    btnJoinRoom: document.getElementById('btn-join-room'),

    // Room Setup
    displayRoomCode: document.getElementById('display-room-code'),
    btnCopyCode: document.getElementById('btn-copy-code'),
    p1Name: document.getElementById('p1-name'),
    p1Status: document.getElementById('p1-status'),
    p2Name: document.getElementById('p2-name'),
    p2Status: document.getElementById('p2-status'),
    setupSection: document.getElementById('setup-section'),
    rangeHostSection: document.getElementById('range-host-section'),
    rangeGuestSection: document.getElementById('range-guest-section'),
    wordRangeDisplay: document.getElementById('word-range-display'),
    rangeBtns: document.querySelectorAll('.range-btn'),
    inputSecretWord: document.getElementById('secret-word'),
    errorSecretWord: document.getElementById('error-secret-word'),
    toggleWordVisibility: document.getElementById('toggle-word-visibility'),
    wordHint: document.getElementById('word-hint'),
    btnSubmitWord: document.getElementById('btn-submit-word'),

    // Game Dashboard
    turnBanner: document.getElementById('turn-banner'),
    turnText: document.getElementById('turn-text'),
    oppWordDisplay: document.getElementById('opponent-word-display'),
    ownWordDisplay: document.getElementById('own-word-display'),
    mySecretWordDisplay: document.getElementById('my-secret-word-display'),
    actionControls: document.getElementById('action-controls'),
    formGuessLetter: document.getElementById('form-guess-letter'),
    inputLetter: document.getElementById('input-letter'),
    formGuessWord: document.getElementById('form-guess-word'),
    inputFullWord: document.getElementById('input-full-word'),
    guessedLettersList: document.getElementById('guessed-letters-list'),

    // Modal
    modalGameOver: document.getElementById('modal-game-over'),
    resultTitle: document.getElementById('result-title'),
    resultMessage: document.getElementById('result-message'),
    winnerIcon: document.getElementById('winner-icon'),
    summaryOwnWord: document.getElementById('summary-own-word'),
    summaryOppWord: document.getElementById('summary-opp-word'),
    btnPlayAgain: document.getElementById('btn-play-again'),
    btnReturnLobby: document.getElementById('btn-return-lobby')
};

/* ==========================================
   NOTIFICATION SYSTEM (TOASTS)
   ========================================== */

function showToast(message, type = 'error', duration = 4000) {
    if (!elements.toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const iconMap = {
        error: 'fa-triangle-exclamation',
        success: 'fa-circle-check',
        info: 'fa-circle-info'
    };

    toast.innerHTML = `
    <i class="fa-solid ${iconMap[type] || iconMap.info}"></i>
    <span>${message}</span>
  `;

    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

/* ==========================================
   SOCKET SYSTEM & DISCONNECTION HANDLERS
   ========================================== */

function setOfflineStatus() {
    if (elements.statusBadge) {
        elements.statusBadge.className = 'status-badge offline';
        const textNode = elements.statusBadge.querySelector('.status-text');
        if (textNode) textNode.innerText = 'Disconnected';
    }
}

function setOnlineStatus() {
    if (elements.statusBadge) {
        elements.statusBadge.className = 'status-badge online';
        const textNode = elements.statusBadge.querySelector('.status-text');
        if (textNode) textNode.innerText = 'Connected';
    }
}

// Initial status setting on page load
if (!socket || !socket.connected) {
    setOfflineStatus();
}

if (socket) {
    socket.on('connect', () => {
        setOnlineStatus();
        showToast('Connected to Game Server!', 'success', 3000);
    });

    socket.on('disconnect', () => {
        setOfflineStatus();
        showToast('Server disconnected.', 'error', 4000);
    });

    socket.on('connect_error', () => {
        setOfflineStatus();
        showToast('Server disconnected. Please start backend server.', 'error', 4000);
    });

    socket.on('error_message', (data) => {
        const errMsg = typeof data === 'string' ? data : (data.message || 'An error occurred.');
        showToast(errMsg, 'error');
    });
}

/* ==========================================
   LOBBY & ROOM HANDLERS
   ========================================== */

function clearErrors() {
    document.querySelectorAll('.error-msg').forEach((el) => {
        el.innerText = '';
        el.classList.add('hidden');
    });
    document.querySelectorAll('input').forEach((el) => {
        el.classList.remove('input-invalid');
    });
}

function showFieldError(inputEl, errorEl, message) {
    if (inputEl) inputEl.classList.add('input-invalid');
    if (errorEl) {
        errorEl.innerText = message;
        errorEl.classList.remove('hidden');
    }
    showToast(message, 'error');
}

// 1. CREATE ROOM
if (elements.btnCreateRoom) {
    elements.btnCreateRoom.addEventListener('click', () => {
        clearErrors();
        const name = elements.inputPlayerName ? elements.inputPlayerName.value.trim() : '';

        if (!socket || !socket.connected) {
            return showToast('Server not connected.', 'error');
        }

        if (!name) {
            showFieldError(elements.inputPlayerName, elements.errorPlayerName, 'Please enter a player name first!');
            return;
        }

        state.playerName = name;
        socket.emit('create_room', { playerName: name });
    });
}

// 2. JOIN ROOM
if (elements.btnJoinRoom) {
    elements.btnJoinRoom.addEventListener('click', () => {
        clearErrors();
        const name = elements.inputPlayerName ? elements.inputPlayerName.value.trim() : '';
        const code = elements.inputRoomCode ? elements.inputRoomCode.value.trim().toUpperCase() : '';

        if (!socket || !socket.connected) {
            return showToast('Server not connected.', 'error');
        }

        let hasError = false;

        if (!name) {
            showFieldError(elements.inputPlayerName, elements.errorPlayerName, 'Please enter your player name.');
            hasError = true;
        }

        if (!code || code.length < 4) {
            showFieldError(elements.inputRoomCode, elements.errorRoomCode, 'Enter a valid room code.');
            hasError = true;
        }

        if (hasError) return;

        state.playerName = name;
        state.roomCode = code;
        socket.emit('join_room', { playerName: name, roomCode: code });
    });
}

if (socket) {
    socket.on('room_joined', (data) => {
        state.roomCode = data.roomCode;
        state.isHost = socket.id === data.players[0]?.id;
        if (data.wordLengthRange) {
            state.wordLengthRange = data.wordLengthRange;
            applyWordLengthRangeUI();
        }
        if (elements.displayRoomCode) elements.displayRoomCode.innerText = data.roomCode;
        switchScreen('room');
        updateRoomPlayers(data.players);
        updateSetupAccess();
        showToast(`Joined Room: ${data.roomCode}`, 'success');
    });

    socket.on('player_update', (players) => {
        updateRoomPlayers(players);
    });

    socket.on('word_range_update', (data) => {
        state.wordLengthRange = data.wordLengthRange;
        applyWordLengthRangeUI();
        if (!state.isHost) {
            showToast(`Word length set to ${formatRangeLabel(data.wordLengthRange)}.`, 'info', 3000);
        }
    });
}

function updateSetupAccess() {
    if (state.isHost) {
        if (elements.rangeHostSection) elements.rangeHostSection.classList.remove('hidden');
        if (elements.rangeGuestSection) elements.rangeGuestSection.classList.add('hidden');
    } else {
        if (elements.rangeHostSection) elements.rangeHostSection.classList.add('hidden');
        if (elements.rangeGuestSection) elements.rangeGuestSection.classList.remove('hidden');
    }
}

function formatRangeLabel(range) {
    const labels = {
        '3-5': '3–5 letters',
        '5-7': '5–7 letters',
        '7-9': '7–9 letters',
        '10+': '10+ letters'
    };
    return labels[range] || range;
}

function applyWordLengthRangeUI() {
    elements.rangeBtns.forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.range === state.wordLengthRange);
    });
    updateWordHint();
    if (elements.wordRangeDisplay) {
        elements.wordRangeDisplay.innerText = formatRangeLabel(state.wordLengthRange);
    }
}

function updateRoomPlayers(players) {
    if (!players) return;

    state.isHost = socket.id === players[0]?.id;
    updateSetupAccess();

    if (players[0]) {
        if (elements.p1Name) elements.p1Name.innerText = players[0].name;
        if (elements.p1Status) elements.p1Status.innerText = players[0].ready ? 'Ready' : 'Connected';
    }
    if (players[1]) {
        if (elements.p2Name) elements.p2Name.innerText = players[1].name;
        if (elements.p2Status) elements.p2Status.innerText = players[1].ready ? 'Ready' : 'Connected';
        if (elements.setupSection) elements.setupSection.classList.remove('hidden');
    } else {
        if (elements.p2Name) elements.p2Name.innerText = 'Waiting...';
        if (elements.p2Status) elements.p2Status.innerText = 'Waiting for opponent';
        if (state.isHost && elements.setupSection) {
            elements.setupSection.classList.remove('hidden');
        } else if (elements.setupSection) {
            elements.setupSection.classList.add('hidden');
        }
    }
}

// Copy Room Code Action
if (elements.btnCopyCode) {
    elements.btnCopyCode.addEventListener('click', () => {
        if (state.roomCode) {
            navigator.clipboard.writeText(state.roomCode);
            showToast('Room code copied to clipboard!', 'info');
        }
    });
}

// Range Selector (host only)
elements.rangeBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
        if (!state.isHost) return;

        state.wordLengthRange = btn.dataset.range;
        applyWordLengthRangeUI();

        if (socket && socket.connected && state.roomCode) {
            socket.emit('set_word_range', {
                roomCode: state.roomCode,
                range: state.wordLengthRange
            });
        }
    });
});

function updateWordHint() {
    if (!elements.wordHint) return;
    const hints = {
        '3-5': '3 to 5 letters long',
        '5-7': '5 to 7 letters long',
        '7-9': '7 to 9 letters long',
        '10+': '10 or more letters long'
    };
    elements.wordHint.innerText = `Word must be ${hints[state.wordLengthRange] || 'valid'}.`;
}

// Password Eye Toggle
if (elements.toggleWordVisibility) {
    elements.toggleWordVisibility.addEventListener('click', () => {
        const input = elements.inputSecretWord;
        const icon = elements.toggleWordVisibility.querySelector('i');
        if (!input) return;

        if (input.type === 'password') {
            input.type = 'text';
            if (icon) icon.className = 'fa-solid fa-eye-slash';
        } else {
            input.type = 'password';
            if (icon) icon.className = 'fa-solid fa-eye';
        }
    });
}

// Secret Word Submission
if (elements.btnSubmitWord) {
    elements.btnSubmitWord.addEventListener('click', () => {
        clearErrors();
        const word = elements.inputSecretWord ? elements.inputSecretWord.value.trim().toUpperCase() : '';

        if (!socket || !socket.connected) {
            return showToast('Server not connected.', 'error');
        }

        if (!word) {
            showFieldError(elements.inputSecretWord, elements.errorSecretWord, 'Secret word cannot be empty.');
            return;
        }

        if (!validateWordLength(word, state.wordLengthRange)) {
            showFieldError(elements.inputSecretWord, elements.errorSecretWord, `Word must match selected length (${state.wordLengthRange}).`);
            return;
        }

        state.secretWord = word;
        socket.emit('submit_word', { roomCode: state.roomCode, secretWord: word });
        elements.btnSubmitWord.disabled = true;
        elements.btnSubmitWord.innerText = 'Waiting for Opponent...';
        showToast('Secret word locked in!', 'success');
    });
}

function validateWordLength(word, range) {
    const len = word.length;
    if (range === '3-5') return len >= 3 && len <= 5;
    if (range === '5-7') return len >= 5 && len <= 7;
    if (range === '7-9') return len >= 7 && len <= 9;
    if (range === '10+') return len >= 10;
    return false;
}

/* ==========================================
   GAMEPLAY ENGINE
   ========================================== */

if (socket) {
    socket.on('game_start', (data) => {
        switchScreen('game');
        state.opponentWordMask = Array(data.opponentWordLength).fill('_');
        state.ownWordMask = Array(state.secretWord.length).fill('_');
        state.myTurn = data.activePlayerId === socket.id;
        state.guessedLetters = [];

        renderMySecretWord();
        renderOpponentWord();
        renderOwnWord();
        renderHistoryTags();
        updateTurnUI();
        showToast('Match Started!', 'info');
    });
}

function renderMySecretWord() {
    if (!elements.mySecretWordDisplay) return;
    elements.mySecretWordDisplay.innerText = state.secretWord || '----';
}

function renderOpponentWord() {
    if (!elements.oppWordDisplay) return;
    elements.oppWordDisplay.innerHTML = '';
    state.opponentWordMask.forEach((char) => {
        const tile = document.createElement('div');
        tile.className = `letter-tile ${char !== '_' ? 'revealed' : ''}`;
        tile.innerText = char !== '_' ? char : '';
        elements.oppWordDisplay.appendChild(tile);
    });
}

function renderOwnWord() {
    if (!elements.ownWordDisplay) return;
    elements.ownWordDisplay.innerHTML = '';
    const mask = state.ownWordMask.length
        ? state.ownWordMask
        : Array(state.secretWord.length).fill('_');

    mask.forEach((char) => {
        const tile = document.createElement('div');
        tile.className = `letter-tile ${char !== '_' ? 'revealed' : ''}`;
        tile.innerText = char !== '_' ? char : '';
        elements.ownWordDisplay.appendChild(tile);
    });
}

function updateTurnUI() {
    if (!elements.turnBanner || !elements.turnText) return;

    if (state.myTurn) {
        elements.turnBanner.className = 'glass-panel turn-banner active-turn';
        elements.turnText.innerText = 'Your Turn to Guess!';
        if (elements.actionControls) elements.actionControls.classList.remove('hidden');
    } else {
        elements.turnBanner.className = 'glass-panel turn-banner inactive-turn';
        elements.turnText.innerText = "Opponent's Turn...";
        if (elements.actionControls) elements.actionControls.classList.add('hidden');
    }
}

// Single Letter Submission
if (elements.formGuessLetter) {
    elements.formGuessLetter.addEventListener('submit', (e) => {
        e.preventDefault();
        const letter = elements.inputLetter ? elements.inputLetter.value.trim().toUpperCase() : '';

        if (!socket || !socket.connected) {
            return showToast('Server not connected.', 'error');
        }

        if (!letter || !/^[A-Z]$/.test(letter)) {
            return showToast('Enter a valid letter (A-Z).', 'error');
        }

        if (state.guessedLetters.some((item) => item.letter === letter)) {
            return showToast(`Letter '${letter}' has already been tried.`, 'error');
        }

        socket.emit('guess_letter', { roomCode: state.roomCode, letter });
        if (elements.inputLetter) elements.inputLetter.value = '';
    });
}

// Word Solve Submission
if (elements.formGuessWord) {
    elements.formGuessWord.addEventListener('submit', (e) => {
        e.preventDefault();
        const word = elements.inputFullWord ? elements.inputFullWord.value.trim().toUpperCase() : '';

        if (!socket || !socket.connected) {
            return showToast('Server not connected.', 'error');
        }

        if (!word) {
            return showToast('Enter a word to solve.', 'error');
        }

        socket.emit('guess_word', { roomCode: state.roomCode, word });
        if (elements.inputFullWord) elements.inputFullWord.value = '';
    });
}

if (socket) {
    // Turn Processing Feedback
    socket.on('turn_result', (data) => {
        state.myTurn = data.nextTurnPlayerId === socket.id;

        if (data.guessedLetter) {
            if (data.role === 'guesser') {
                state.guessedLetters.push({
                    letter: data.guessedLetter,
                    hit: data.isHit
                });
                renderHistoryTags();
                showToast(
                    data.isHit
                        ? `Hit! Letter '${data.guessedLetter}' found.`
                        : `Miss! '${data.guessedLetter}' not present.`,
                    data.isHit ? 'success' : 'error'
                );
            } else if (data.role === 'defender') {
                showToast(
                    data.isHit
                        ? `Opponent guessed '${data.guessedLetter}' — hit on your word!`
                        : `Opponent guessed '${data.guessedLetter}' — miss.`,
                    data.isHit ? 'error' : 'info'
                );
            }
        }

        // Only the guesser updates their opponent-word progress
        if (data.updatedMask) {
            state.opponentWordMask = data.updatedMask;
            renderOpponentWord();
        }

        // Defender sees letters revealed on their own word
        if (data.defenseMask) {
            state.ownWordMask = data.defenseMask;
            renderOwnWord();
        }

        updateTurnUI();
    });
}

function renderHistoryTags() {
    if (!elements.guessedLettersList) return;
    elements.guessedLettersList.innerHTML = '';
    state.guessedLetters.forEach((item) => {
        const tag = document.createElement('span');
        tag.className = `tag ${item.hit ? 'tag-hit' : 'tag-miss'}`;
        tag.innerText = item.letter;
        elements.guessedLettersList.appendChild(tag);
    });
}

/* ==========================================
   WIN / LOSS & REPLAY MANAGEMENT
   ========================================== */

if (socket) {
    socket.on('game_over', (data) => {
        const isWinner = data.winnerId === socket.id;

        if (elements.resultTitle) elements.resultTitle.innerText = isWinner ? 'Victory!' : 'Defeat!';
        if (elements.resultMessage) {
            elements.resultMessage.innerText = isWinner
                ? 'Outstanding! You cracked the opponent\'s word first.'
                : 'Better luck next time! Your opponent solved it.';
        }

        if (elements.winnerIcon) {
            elements.winnerIcon.className = `result-icon ${isWinner ? 'win' : 'lose'}`;
            elements.winnerIcon.innerHTML = isWinner ? '<i class="fa-solid fa-trophy"></i>' : '<i class="fa-solid fa-skull"></i>';
        }

        if (elements.summaryOwnWord) elements.summaryOwnWord.innerText = state.secretWord;
        if (elements.summaryOppWord) elements.summaryOppWord.innerText = data.opponentWord;

        if (elements.modalGameOver) elements.modalGameOver.classList.remove('hidden');

        // Confetti trigger for victory
        if (isWinner) {
            if (typeof confetti === 'function') {
                confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
            } else if (typeof JSConfetti !== 'undefined') {
                const jsConfetti = new JSConfetti();
                jsConfetti.addConfetti();
            }
        }
    });
}

if (elements.btnPlayAgain) {
    elements.btnPlayAgain.addEventListener('click', () => {
        if (elements.modalGameOver) elements.modalGameOver.classList.add('hidden');
        if (elements.btnSubmitWord) {
            elements.btnSubmitWord.disabled = false;
            elements.btnSubmitWord.innerText = 'Lock In Secret Word';
        }
        if (elements.inputSecretWord) elements.inputSecretWord.value = '';
        if (socket && socket.connected) {
            socket.emit('request_replay', { roomCode: state.roomCode });
        }
    });
}

if (elements.btnReturnLobby) {
    elements.btnReturnLobby.addEventListener('click', () => {
        window.location.reload();
    });
}

function switchScreen(screenName) {
    if (!elements.screens) return;
    Object.keys(elements.screens).forEach((s) => {
        if (elements.screens[s]) elements.screens[s].classList.remove('active');
    });
    if (elements.screens[screenName]) {
        elements.screens[screenName].classList.add('active');
    }
}