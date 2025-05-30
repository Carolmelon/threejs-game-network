import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { loadingManager } from '../utils/loadingManager.js';

export class BasePlayer {
    constructor(scene, initialPosition = new THREE.Vector3(0, 0, 0), playerId = null, isLocal = false) {
        this.scene = scene;
        this.playerId = playerId;
        this.isLocal = isLocal;

        this.height = 1.8;
        this.standingHeight = 1.8;
        this.crouchHeight = 0.9;
        this.radius = 0.5;

        this.position = new THREE.Vector3().copy(initialPosition);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.modelRotationY = 0;
        this.pitchRotationX = 0;

        this.model = null;
        this.mixer = null;
        this.actions = {};
        this.activeAction = null;
        this.previousAction = null;
        this.currentBaseAction = 'Idle';
        this.playingSpecialAnimation = false;
        this.animationStates = {
            Idle: 'Idle', Walking: 'Walking', Running: 'Running',
            Dance: 'Dance', Jump: 'Jump', Death: 'Death',
            Sitting: 'Sitting', Standing: 'Standing', Yes: 'Yes',
            No: 'No', Wave: 'Wave', Punch: 'Punch', ThumbsUp: 'ThumbsUp'
        };
        
        this.serverUpdates = [];
        this.lastServerState = null;
        this.interpolationAlpha = 0.1;

        this.loadCharacterModel();
    }

    loadCharacterModel() {
        const modelURL = 'https://threejs.org/examples/models/gltf/RobotExpressive/RobotExpressive.glb';
        const loader = new GLTFLoader(loadingManager);

        loader.load(modelURL, (gltf) => {
            this.model = gltf.scene;
            this.model.scale.set(0.5, 0.5, 0.5);
            
            this.model.traverse((object) => {
                if (object.isMesh) {
                    object.castShadow = true;
                    object.receiveShadow = true;
                }
            });

            this.scene.add(this.model);
            this.updateModelTransform();

            this.mixer = new THREE.AnimationMixer(this.model);
            this.actions = {};
            gltf.animations.forEach((clip) => {
                const action = this.mixer.clipAction(clip);
                this.actions[clip.name] = action;
                if (['Jump', 'Yes', 'No', 'Wave', 'Punch', 'ThumbsUp', 'Death', 'Sitting', 'Standing'].includes(clip.name)) {
                    action.loop = THREE.LoopOnce;
                    action.clampWhenFinished = true;
                }
            });

            if (this.actions['Idle']) {
                this.activeAction = this.actions['Idle'];
                this.activeAction.play();
            }
            console.log(`Character model loaded for player ${this.playerId || 'local'}`);
        }, undefined, (error) => {
            console.error('Error loading character model:', error);
        });
    }

    fadeToAction(name, duration = 0.2, isOneShot = false, onFinishedCallback = null) {
        if (!this.mixer || !this.actions[name]) {
            return;
        }

        this.previousAction = this.activeAction;
        this.activeAction = this.actions[name];

        if (this.previousAction !== this.activeAction) {
            if (this.previousAction) {
                this.previousAction.fadeOut(duration);
            }

            this.activeAction
                .reset()
                .setEffectiveTimeScale(1)
                .setEffectiveWeight(1)
                .fadeIn(duration)
                .play();
        }
        
        this.playingSpecialAnimation = isOneShot;

        if (isOneShot) {
            const actionToWatch = this.activeAction; 
            const onFinished = (e) => {
                if (e.action === actionToWatch) { 
                    this.mixer.removeEventListener('finished', onFinished);
                    this.playingSpecialAnimation = false;
                    if (onFinishedCallback) {
                        onFinishedCallback();
                    } else {
                        this.fadeToAction(this.currentBaseAction, 0.2);
                    }
                }
            };
            this.mixer.addEventListener('finished', onFinished);
        }
    }
    
    playAnimation(animationName, duration = 0.2, isOneShot = false) {
        if (this.playingSpecialAnimation && isOneShot) return;

        if (isOneShot) {
            this.fadeToAction(animationName, duration, true, () => {
                this.fadeToAction(this.currentBaseAction, 0.2);
            });
        } else {
            if (this.currentBaseAction !== animationName && !this.playingSpecialAnimation) {
                 this.currentBaseAction = animationName;
                 this.fadeToAction(animationName, duration);
            }
        }
    }

    updateModelTransform() {
        if (this.model) {
            this.model.position.copy(this.position);
            this.model.position.y -= this.height; 
            this.model.rotation.y = this.modelRotationY;
        }
    }
    
    updateAnimationMixer(delta) {
        if (this.mixer) {
            this.mixer.update(delta);
        }
    }

    update(delta) {
        this.updateAnimationMixer(delta);
    }

    setPosition(newPosition) {
        this.position.copy(newPosition);
        this.updateModelTransform();
    }

    setRotation(modelRotationY, pitchRotationX = null) {
        this.modelRotationY = modelRotationY;
        if (pitchRotationX !== null) {
            this.pitchRotationX = pitchRotationX;
        }
        this.updateModelTransform();
    }

    dispose() {
        if (this.model) {
            this.scene.remove(this.model);
        }
        if (this.mixer) {
            this.mixer.stopAllAction();
        }
        console.log(`Disposed player ${this.playerId}`);
    }

    getHeight() {
        return this.height;
    }

    setHeight(newHeight) {
        const heightChanged = this.height !== newHeight;
        this.height = newHeight;
        if (heightChanged) {
             this.updateModelTransform();
        }
    }
} 