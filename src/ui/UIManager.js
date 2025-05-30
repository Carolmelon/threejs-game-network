export class UIManager {
    constructor() {
        this.loginOverlay = document.getElementById('login-overlay');
        this.usernameInput = document.getElementById('username-input');
        this.connectButton = document.getElementById('connect-btn');
        this.loadingElement = document.getElementById('loading');
        this.startPromptElement = document.getElementById('start-prompt');
        this.lockErrorElement = document.getElementById('lock-error');
        this.infoElement = document.getElementById('info');
        this.debugElement = document.getElementById('debug');

        this.chatDisplay = document.getElementById('chat-display');
        this.chatInput = document.getElementById('chat-input');
        this.chatSendButton = document.getElementById('chat-send-btn');
        this.playerListElement = document.getElementById('player-list-display');

        this.onConnectCallback = null;
        this.onSendMessageCallback = null;
        this.localPlayerRef = null;
        this.username = '';

        this.isPointerLocked = false;

        this.initEventListeners();
    }

    initEventListeners() {
        if (this.connectButton) {
            this.connectButton.addEventListener('click', () => {
                this.username = this.usernameInput.value.trim();
                if (this.username && this.onConnectCallback) {
                    this.onConnectCallback(this.username);
                    this.showLoading('正在连接服务器...');
                    this.loginOverlay.style.display = 'none';
                } else if (!this.username) {
                    alert('请输入用户名!');
                }
            });
        }

        if (this.startPromptElement) {
            this.startPromptElement.addEventListener('click', () => this.requestPointerLock());
        }
        
        document.addEventListener('pointerlockchange', this.handlePointerLockChange.bind(this), false);
        document.addEventListener('pointerlockerror', this.handlePointerLockError.bind(this), false);

        if (this.chatSendButton) {
            this.chatSendButton.addEventListener('click', () => this.sendChatMessage());
        }
        if (this.chatInput) {
            this.chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.sendChatMessage();
                }
            });
        }
        document.addEventListener('keydown', (event) => {
            if (event.code === 'KeyH' && this.isPointerLocked) {
                this.toggleInfo();
            }
            if (event.code === 'KeyT' && this.isPointerLocked && this.localPlayerRef) {
                this.localPlayerRef.toggleViewMode();
            }
        });
    }
    
    setLocalPlayer(player) {
        this.localPlayerRef = player;
    }

    requestPointerLock() {
        document.body.requestPointerLock = document.body.requestPointerLock ||
                                           document.body.mozRequestPointerLock ||
                                           document.body.webkitRequestPointerLock;
        if (document.body.requestPointerLock) {
            document.body.requestPointerLock();
        } else {
            this.showLockError('浏览器不支持指针锁定。');
        }
    }
    
    handlePointerLockChange() {
        if (document.pointerLockElement === document.body ||
            document.mozPointerLockElement === document.body ||
            document.webkitPointerLockElement === document.body) {
            this.isPointerLocked = true;
            if (this.startPromptElement) this.startPromptElement.style.display = 'none';
            if (this.lockErrorElement) this.lockErrorElement.style.display = 'none';
            if (this.chatInput) this.chatInput.blur();
            console.log('Pointer locked.');
        } else {
            this.isPointerLocked = false;
            if (this.startPromptElement && !this.loginOverlay.style.display || this.loginOverlay.style.display === 'none') {
                 this.startPromptElement.style.display = 'block';
            }
            console.log('Pointer unlocked.');
        }
    }

    handlePointerLockError() {
        this.showLockError('锁定鼠标失败。请确保窗口已激活，或检查浏览器设置。');
    }

    showLogin() {
        if (this.loginOverlay) this.loginOverlay.style.display = 'flex';
        if (this.loadingElement) this.loadingElement.style.display = 'none';
        if (this.startPromptElement) this.startPromptElement.style.display = 'none';
    }
    
    showLoading(message = '正在加载世界...') {
        if (this.loadingElement) {
            this.loadingElement.textContent = message;
            this.loadingElement.style.display = 'block';
        }
        if (this.loginOverlay) this.loginOverlay.style.display = 'none';
        if (this.startPromptElement) this.startPromptElement.style.display = 'none';
    }

    hideLoading() {
        if (this.loadingElement) this.loadingElement.style.display = 'none';
    }

    showStartPrompt() {
        if (this.startPromptElement) this.startPromptElement.style.display = 'block';
        this.hideLoading();
    }
    
    showLockError(message) {
        if (this.lockErrorElement) {
            this.lockErrorElement.textContent = message;
            this.lockErrorElement.style.display = 'block';
        }
         if (this.startPromptElement) {
            this.startPromptElement.style.display = 'block';
        }
    }

    toggleInfo() {
        if (this.infoElement) {
            this.infoElement.style.display = this.infoElement.style.display === 'none' ? 'block' : 'none';
        }
    }
    
    addChatMessage(sender, message, isLocal = false) {
        if (!this.chatDisplay) return;
        const messageElement = document.createElement('div');
        messageElement.classList.add('chat-message');
        if (isLocal) {
            messageElement.classList.add('local');
        }
        messageElement.innerHTML = `<strong>${sender}:</strong> ${this.sanitizeHTML(message)}`;
        this.chatDisplay.appendChild(messageElement);
        this.chatDisplay.scrollTop = this.chatDisplay.scrollHeight;
    }

    sendChatMessage() {
        if (!this.chatInput || !this.onSendMessageCallback) return;
        const message = this.chatInput.value.trim();
        if (message) {
            this.onSendMessageCallback(message);
            this.addChatMessage(this.username || 'Me', message, true); 
            this.chatInput.value = '';
        }
    }
    
    updatePlayerList(players) {
        if (!this.playerListElement) return;
        this.playerListElement.innerHTML = '<h3>在线玩家:</h3>';
        const ul = document.createElement('ul');
        players.forEach(player => {
            const li = document.createElement('li');
            li.textContent = `${player.username} (${player.id === this.localPlayerRef?.playerId ? 'You' : player.id.substring(0,6)})`;
            ul.appendChild(li);
        });
        this.playerListElement.appendChild(ul);
    }

    sanitizeHTML(str) {
        const temp = document.createElement('div');
        temp.textContent = str;
        return temp.innerHTML;
    }

    setConnectCallback(callback) {
        this.onConnectCallback = callback;
    }
    
    setSendMessageCallback(callback) {
        this.onSendMessageCallback = callback;
    }
} 