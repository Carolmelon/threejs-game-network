import * as THREE from 'three';
import { LocalPlayer } from '../entities/LocalPlayer.js';
import { RemotePlayer } from '../entities/RemotePlayer.js';
import { networkManager } from '../network/NetworkManager.js';
import { Debug } from '../utils/debug.js';

export class GameStateManager {
    constructor(scene, camera, ground, uiManager, debugInstance) {
        this.scene = scene;
        this.camera = camera;
        this.ground = ground;
        this.uiManager = uiManager;
        this.debug = debugInstance || new Debug();

        this.localPlayer = null;
        this.remotePlayers = new Map();
        this.collidableObjects = [];
    }

    initialize(clientId, initialState, collidableObjects) {
        this.collidableObjects = collidableObjects;

        const localPlayerData = initialState.players.find(p => p.id === clientId);
        let startPos = new THREE.Vector3(0, 5, 0);
        if (localPlayerData && localPlayerData.position) {
            startPos.set(localPlayerData.position.x, localPlayerData.position.y, localPlayerData.position.z);
        }
        
        this.localPlayer = new LocalPlayer(this.camera, this.ground, this.scene, startPos, clientId);
        this.localPlayer.registerCollidableObjects(this.collidableObjects);
        this.uiManager.setLocalPlayer(this.localPlayer);

        initialState.players.forEach(playerData => {
            if (playerData.id !== clientId) {
                this.addRemotePlayer(playerData);
            } else {
                this.localPlayer.setPosition(new THREE.Vector3(playerData.position.x, playerData.position.y, playerData.position.z));
                this.localPlayer.setRotation(playerData.model_rotation_y, playerData.pitch_rotation_x);
                this.localPlayer.setHeight(playerData.height);
                this.localPlayer.isCrouching = playerData.is_crouching;
                if (playerData.view_mode && this.localPlayer.viewMode !== playerData.view_mode) {
                    if (playerData.view_mode === 'third-person' && this.localPlayer.viewMode === 'first-person') {
                        this.localPlayer.toggleViewMode();
                    } else if (playerData.view_mode === 'first-person' && this.localPlayer.viewMode === 'third-person') {
                        this.localPlayer.toggleViewMode();
                    }
                }
                if (playerData.animation) this.localPlayer.playAnimation(playerData.animation);
            }
        });
        this.updatePlayerListUI();
    }

    handleGameStateUpdate(gameState) {
        if (!this.localPlayer) return;

        gameState.players.forEach(playerData => {
            if (playerData.id === this.localPlayer.playerId) {
            } else {
                const remotePlayer = this.remotePlayers.get(playerData.id);
                if (remotePlayer) {
                    remotePlayer.updateState(playerData);
                } else {
                    this.addRemotePlayer(playerData);
                }
            }
        });
    }

    handlePlayerJoined(playerData) {
        if (!this.localPlayer || playerData.id === this.localPlayer.playerId) return;
        if (this.remotePlayers.has(playerData.id)) return;

        this.addRemotePlayer(playerData);
        this.updatePlayerListUI();
    }

    handlePlayerLeft(playerId) {
        if (this.remotePlayers.has(playerId)) {
            const player = this.remotePlayers.get(playerId);
            player.dispose();
            this.remotePlayers.delete(playerId);
            console.log(`Removed remote player ${playerId}`);
            this.updatePlayerListUI();
        }
    }
    
    handleActionBroadcast(actionData) {
        if (!this.localPlayer) return;
        const { playerId, action_name } = actionData;

        if (playerId === this.localPlayer.playerId) {
        } else {
            const remotePlayer = this.remotePlayers.get(playerId);
            if (remotePlayer && remotePlayer.animationStates[action_name] && remotePlayer.actions[action_name]) {
                 if (remotePlayer.actions[action_name].loop === THREE.LoopOnce) {
                    remotePlayer.playAnimation(action_name, 0.2, true);
                 }
            }
        }
    }

    addRemotePlayer(playerData) {
        const remotePlayer = new RemotePlayer(this.scene, playerData, playerData.id);
        this.remotePlayers.set(playerData.id, remotePlayer);
        console.log(`Added remote player ${playerData.id} at`, playerData.position);
    }
    
    updatePlayerListUI() {
        const players = [];
        if (this.localPlayer) {
            players.push({ id: this.localPlayer.playerId, username: this.uiManager.username || 'Local Player' });
        }
        this.remotePlayers.forEach(player => {
            const username = player.username || player.playerId;
            players.push({ id: player.playerId, username });
        });
        this.uiManager.updatePlayerList(players);
    }

    update(delta) {
        if (this.localPlayer) {
            this.localPlayer.update(delta);
            this.debug.update({
                fps: this.debug.stats.fps,
                position: {
                    x: this.localPlayer.position.x.toFixed(2),
                    y: this.localPlayer.position.y.toFixed(2),
                    z: this.localPlayer.position.z.toFixed(2)
                },
                controls: { ...this.localPlayer.keys },
                state: {
                    jumping: this.localPlayer.isJumping,
                    crouching: this.localPlayer.isCrouching,
                    view: this.localPlayer.viewMode
                },
                netId: networkManager.getClientId(),
                playersOnline: 1 + this.remotePlayers.size,
            });
        }

        this.remotePlayers.forEach(player => {
            player.update(delta);
        });
    }

    getLocalPlayer() {
        return this.localPlayer;
    }
    
    dispose() {
        if (this.localPlayer) {
            this.localPlayer.dispose();
            this.localPlayer = null;
        }
        this.remotePlayers.forEach(player => player.dispose());
        this.remotePlayers.clear();
        console.log("GameStateManager disposed all players.");
    }
} 