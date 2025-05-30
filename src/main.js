import * as THREE from 'three';
import { World } from './World.js';
import { loadingManager } from './utils/loadingManager.js';
import { Debug } from './utils/debug.js';
import { networkManager } from './network/NetworkManager.js';
import { GameStateManager } from './state/GameStateManager.js';
import { UIManager } from './ui/UIManager.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 2, 5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
directionalLight.position.set(50, 200, 100);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.near = 10;
directionalLight.shadow.camera.far = 500;
directionalLight.shadow.camera.left = -150;
directionalLight.shadow.camera.right = 150;
directionalLight.shadow.camera.top = 150;
directionalLight.shadow.camera.bottom = -150;
scene.add(directionalLight);

const debug = new Debug();
const uiManager = new UIManager();
const world = new World(scene, loadingManager);
const gameStateManager = new GameStateManager(scene, camera, world.getGround(), uiManager, debug);

let gameStarted = false;
let lastInputSendTime = 0;
const inputSendInterval = 1000 / 20;

networkManager.onConnectCallback = () => {
    uiManager.showLoading('已连接, 等待玩家数据...');
};

networkManager.onDisconnectCallback = (reason) => {
    uiManager.showLoading(`与服务器断开连接: ${reason}. 请刷新页面重试.`);
    gameStarted = false;
    gameStateManager.dispose();
};

networkManager.onInitialState = (initialState) => {
    console.log("Received initial state from server, initializing game state manager.");
    gameStateManager.initialize(networkManager.getClientId(), initialState, world.getCollidableObjects());
    uiManager.hideLoading();
    uiManager.showStartPrompt();
    gameStarted = true;
    if (!animationFrameId) animate();
};

networkManager.onGameStateUpdate = (gameState) => {
    if (gameStarted) gameStateManager.handleGameStateUpdate(gameState);
};

networkManager.onPlayerJoined = (playerData) => {
    if (gameStarted) gameStateManager.handlePlayerJoined(playerData);
};

networkManager.onPlayerLeft = (playerId) => {
    if (gameStarted) gameStateManager.handlePlayerLeft(playerId);
};

networkManager.onChatMessage = (messageData) => {
    const localPlayer = gameStateManager.getLocalPlayer();
    if (localPlayer && messageData.sender_id === localPlayer.playerId) {
        return; 
    }
    uiManager.addChatMessage(messageData.username || messageData.sender_id, messageData.message);
};

networkManager.onActionBroadcast = (actionData) => {
    if (gameStarted) gameStateManager.handleActionBroadcast(actionData);
};

uiManager.setConnectCallback((username) => {
    networkManager.initialize(username);
});
uiManager.setSendMessageCallback((message) => {
    networkManager.sendChatMessage(message);
});

uiManager.showLogin();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

document.addEventListener('mousemove', (event) => {
    if (uiManager.isPointerLocked && gameStateManager.getLocalPlayer()) {
        gameStateManager.getLocalPlayer().handleMouseMovement(event.movementX, event.movementY);
    }
});

document.addEventListener('wheel', (event) => {
    if (uiManager.isPointerLocked && gameStateManager.getLocalPlayer()) {
        gameStateManager.getLocalPlayer().handleMouseWheel(event);
    }
});

let prevTime = performance.now();
let frameCount = 0;
let fps = 0;
let lastFpsUpdate = 0;
let animationFrameId = null;

function animate() {
    animationFrameId = requestAnimationFrame(animate);
    
    if (!gameStarted) {
        // Keep rendering the scene (e.g., for loading screen background or login UI) 
        // even if the game hasn't fully started or connected.
        renderer.render(scene, camera);
        return;
    }

    const time = performance.now();
    const delta = (time - prevTime) / 1000;
    prevTime = time;

    frameCount++;
    if (time - lastFpsUpdate > 1000) {
        fps = Math.round(frameCount * 1000 / (time - lastFpsUpdate));
        frameCount = 0;
        lastFpsUpdate = time;
        debug.update({ fps });
    }

    if (gameStateManager.getLocalPlayer() && time - lastInputSendTime > inputSendInterval) {
        gameStateManager.getLocalPlayer().sendStateToServer();
        lastInputSendTime = time;
    }
    
    gameStateManager.update(delta);

    const localPlayer = gameStateManager.getLocalPlayer();
    if (localPlayer) {
      world.update(delta, localPlayer.position);
    }

    renderer.render(scene, camera);
}

loadingManager.onLoad = () => {
    console.log('All initial assets loaded (textures, static models). Waiting for server connection or initial state.');
    if (networkManager.isConnected() && !gameStarted) {
        uiManager.showLoading('资源加载完毕, 等待服务器初始数据...');
    } else if (!networkManager.isConnected()){
        uiManager.showLogin();
    }
};

if (!animationFrameId) {
    animate();
} 