import { io } from 'socket.io-client';
// loadingManager import is not strictly needed here anymore if its onLoad isn't called from here.
// import { loadingManager } from '../utils/loadingManager.js'; 

// const SERVER_URL = `http://${window.location.hostname}:8000`; // No longer needed with proxy

class NetworkManager {
    constructor() {
        this.socket = null;
        this.clientId = null; // This will be the client's own SID, assigned by server
        this.onGameStateUpdate = null;
        this.onPlayerJoined = null;
        this.onPlayerLeft = null;
        this.onChatMessage = null;
        this.onInitialState = null;
        this.onConnectCallback = null;
        this.onDisconnectCallback = null;
        this.onActionBroadcast = null; // Was missing from constructor properties
    }

    initialize(username) {
        // Initialize Socket.IO to connect to the current origin.
        // Vite's proxy will forward requests starting with /socket.io/
        // to the backend server specified in vite.config.js.
        // The path option defaults to '/socket.io/', which is what we want.
        this.socket = io({ 
            // transports: ['websocket'], // Keep commented to allow polling fallback if WS proxy fails
            reconnectionAttempts: 5, 
            reconnectionDelay: 3000, 
        });

        this.socket.on('connect', () => {
            console.log('Connected to server via proxy. Socket ID:', this.socket.id, 'Transport:', this.socket.io.engine.transport.name);
            if (this.onConnectCallback) this.onConnectCallback();
            // Client identifies itself as ready with its username.
            this.socket.emit('client_ready', { username }); 
        });

        this.socket.on('disconnect', (reason) => {
            console.log('Disconnected from server:', reason);
            if (this.onDisconnectCallback) this.onDisconnectCallback(reason);
            // Note: UIManager might be shown via loadingManager.onLoad if connection is lost then assets finish loading
            // Or handle UI updates more directly here or in main.js onDisconnectCallback
        });

        this.socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
            const loadingElement = document.getElementById('loading');
            if (loadingElement) {
                loadingElement.textContent = `连接服务器失败: ${error.message}. 请检查后端服务并刷新页面。`;
                loadingElement.style.display = 'block'; 
            }
            const startPrompt = document.getElementById('start-prompt');
            if(startPrompt) startPrompt.style.display = 'none';
            
            // Removed explicit hiding of loginOverlay here.
            // If loadingManager.onLoad in main.js runs later while !networkManager.isConnected(),
            // it will call uiManager.showLogin(), which should correctly reset the UI.
        });

        this.socket.on('reconnect_attempt', (attempt) => {
            console.log(`Attempting to reconnect... (Attempt ${attempt})`);
            const loadingElement = document.getElementById('loading');
            // Only update text if loading element is already visible (e.g. showing a connection error or initial loading)
            if (loadingElement && getComputedStyle(loadingElement).display !== 'none') {
                 loadingElement.textContent = `尝试重新连接服务器... (尝试次数 ${attempt})`;
            }
        });

        this.socket.on('reconnect_failed', () => {
            console.error('Failed to reconnect to the server after multiple attempts.');
            const loadingElement = document.getElementById('loading');
            if (loadingElement) {
                loadingElement.textContent = '无法重新连接到服务器。请刷新页面重试。';
                loadingElement.style.display = 'block';
            }
            // Consider calling uiManager.showLogin() here to allow the user to manually retry from the login screen.
            // This depends on how uiManager is accessible. For now, main.js loadingManager.onLoad might handle it on page refresh.
        });

        this.socket.on('client_id_assigned', (data) => {
            this.clientId = data.clientId; // Store the ID (which is the SID)
            console.log('Client ID assigned by server:', this.clientId);
        });
        
        this.socket.on('initial_game_state', (state) => {
            console.log('Received initial game state:', state);
            if (this.onInitialState) {
                this.onInitialState(state); // Callback to main.js to process the state
            }
        });

        this.socket.on('game_state', (state) => {
            // console.log('Received game state update'); // Can be too verbose
            if (this.onGameStateUpdate) {
                this.onGameStateUpdate(state);
            }
        });

        this.socket.on('player_joined', (playerData) => {
            console.log('Player joined:', playerData);
            if (this.onPlayerJoined) {
                this.onPlayerJoined(playerData);
            }
        });

        this.socket.on('player_left', (data) => {
            console.log('Player left:', data.playerId);
            if (this.onPlayerLeft) {
                this.onPlayerLeft(data.playerId);
            }
        });
        
        this.socket.on('chat_message', (messageData) => {
            console.log('Chat message received:', messageData);
            if (this.onChatMessage) {
                this.onChatMessage(messageData);
            }
        });

        this.socket.on('action_broadcast', (actionData) => {
            console.log('Action broadcast received:', actionData);
            if (this.onActionBroadcast) {
                this.onActionBroadcast(actionData);
            }
        });
    }

    sendPlayerInput(inputData) {
        if (this.socket && this.socket.connected) {
            this.socket.emit('player_input', inputData);
        }
    }

    sendPlayerAction(actionData) {
        if (this.socket && this.socket.connected) {
            this.socket.emit('player_action', actionData);
        }
    }
    
    sendChatMessage(message) {
        if (this.socket && this.socket.connected) {
            this.socket.emit('chat_message', { message });
        }
    }

    // getClientId() should return the clientId assigned by the server (which is the SID)
    getClientId() {
        return this.clientId; 
    }

    isConnected() {
        return this.socket && this.socket.connected;
    }
}

export const networkManager = new NetworkManager();