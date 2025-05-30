import { io } from 'socket.io-client';
// loadingManager import is not strictly needed here anymore if its onLoad isn't called from here.
// import { loadingManager } from '../utils/loadingManager.js'; 

const SERVER_URL = `http://${window.location.hostname}:8000`; // Adjust if your server runs elsewhere

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
        this.socket = io(SERVER_URL, {
            transports: ['websocket'], // Prefer WebSocket
            // autoConnect: false // Potentially, to control connection explicitly, but default is fine.
        });

        this.socket.on('connect', () => {
            console.log('Connected to server. Socket ID:', this.socket.id);
            if (this.onConnectCallback) this.onConnectCallback();
            // Client identifies itself as ready with its username.
            // Server will use this.socket.id as the SID.
            this.socket.emit('client_ready', { username }); 
        });

        this.socket.on('disconnect', (reason) => {
            console.log('Disconnected from server:', reason);
            if (this.onDisconnectCallback) this.onDisconnectCallback(reason);
        });

        this.socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
            const loadingElement = document.getElementById('loading');
            if (loadingElement) {
                loadingElement.textContent = `连接服务器失败: ${error.message}. 请确保后端服务已启动并刷新页面。`;
                loadingElement.style.display = 'block'; // Make sure it's flex or block as per CSS
            }
            const startPrompt = document.getElementById('start-prompt');
            if(startPrompt) startPrompt.style.display = 'none';
            // Consider also hiding login overlay if connect_error occurs after attempting to connect from login.
            const loginOverlay = document.getElementById('login-overlay');
            if(loginOverlay) loginOverlay.style.display = 'none';
        });

        this.socket.on('client_id_assigned', (data) => {
            this.clientId = data.clientId; // Store the ID (which is the SID)
            console.log('Client ID assigned by server:', this.clientId);
            // DO NOT emit 'request_initial_state' here anymore.
            // Server will send 'initial_game_state' after it processes this client's 'client_ready' event.
        });
        
        // This event is now received after server processes 'client_ready' for this client.
        this.socket.on('initial_game_state', (state) => {
            console.log('Received initial game state:', state);
            if (this.onInitialState) {
                this.onInitialState(state); // Callback to main.js to process the state
            }
            // The call to loadingManager.onLoad() was here. It's generally for asset loading.
            // UI transitions related to game state loading are better handled in main.js's onInitialState.
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