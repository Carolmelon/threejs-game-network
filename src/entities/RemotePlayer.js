import *  as THREE from 'three';
import { BasePlayer } from './BasePlayer.js';

const INTERPOLATION_TIME = 100;

export class RemotePlayer extends BasePlayer {
    constructor(scene, initialData, playerId) {
        super(scene, new THREE.Vector3(initialData.position.x, initialData.position.y, initialData.position.z), playerId, false);
        
        this.username = initialData.username || `Player_${playerId.substring(0,4)}`;
        this.targetPosition = new THREE.Vector3().copy(this.position);
        this.targetModelRotationY = initialData.model_rotation_y || 0;
        this.lastUpdateTime = 0;
        
        this.stateBuffer = [];

        if (this.model) {
             this.model.visible = true;
        }
        this.updateState(initialData, true);
    }

    updateState(newState, isInitialState = false) {
        if (!newState) return;

        this.stateBuffer.push({
            timestamp: newState.timestamp || Date.now(),
            position: new THREE.Vector3(newState.position.x, newState.position.y, newState.position.z),
            model_rotation_y: newState.model_rotation_y,
            height: newState.height,
            is_crouching: newState.is_crouching,
        });

        if(this.stateBuffer.length > 20) {
            this.stateBuffer.shift();
        }
        
        if(isInitialState) {
            this.position.copy(newState.position);
            this.modelRotationY = newState.model_rotation_y;
            super.setHeight(newState.height);
            this.isCrouching = newState.is_crouching;
            super.updateModelTransform();
        }

        if (newState.animation && this.currentBaseAction !== newState.animation && !this.playingSpecialAnimation) {
             if(newState.animation === "Jump"){
                 this.playAnimation('Jump', 0.2, true, () => {
                     let landedAction = newState.is_crouching ? 'Sitting' : 'Idle';
                     this.currentBaseAction = landedAction;
                     this.fadeToAction(landedAction, 0.1);
                 });
             } else {
                this.currentBaseAction = newState.animation;
                this.fadeToAction(this.currentBaseAction, 0.2);
             }
        } else if (!newState.animation && this.currentBaseAction !== 'Idle' && !this.playingSpecialAnimation) {
            this.currentBaseAction = 'Idle';
            this.fadeToAction(this.currentBaseAction, 0.2);
        }

        if (newState.action_name && this.animationStates[newState.action_name] && this.actions[newState.action_name]) {
            if (this.actions[newState.action_name].loop === THREE.LoopOnce) {
                this.playAnimation(newState.action_name, 0.2, true);
            }
        }
    }

    update(delta) {
        super.updateAnimationMixer(delta);

        const now = Date.now();
        const renderTimestamp = now - INTERPOLATION_TIME;

        let state1 = null;
        let state2 = null;

        for (let i = this.stateBuffer.length - 1; i >= 0; i--) {
            if (this.stateBuffer[i].timestamp <= renderTimestamp) {
                state1 = this.stateBuffer[i];
                if (i + 1 < this.stateBuffer.length) {
                    state2 = this.stateBuffer[i+1];
                } else {
                    state2 = state1;
                }
                break;
            }
        }
        
        if (!state1) {
            if (this.stateBuffer.length > 0) state1 = state2 = this.stateBuffer[0];
            else {
                 super.updateModelTransform();
                 return;
            }
        }
        if (!state2) state2 = state1;

        if (state1 && state2) {
            let t = 0;
            if (state1.timestamp !== state2.timestamp) {
                 t = (renderTimestamp - state1.timestamp) / (state2.timestamp - state1.timestamp);
            }
            t = Math.max(0, Math.min(1, t));

            this.position.lerpVectors(state1.position, state2.position, t);
            this.modelRotationY = this.lerpAngle(state1.model_rotation_y, state2.model_rotation_y, t);
            
            const targetHeight = state1.is_crouching ? this.crouchHeight : this.standingHeight;
            if (Math.abs(this.height - targetHeight) > 0.01) {
                const diff = targetHeight - this.height;
                super.setHeight(this.height + diff * 8 * delta);
            } else {
                super.setHeight(targetHeight);
            }
        }
        
        super.updateModelTransform();
    }
    
    lerpAngle(start, end, t) {
        let diff = end - start;
        while (diff > Math.PI) diff -= 2 * Math.PI;
        while (diff < -Math.PI) diff += 2 * Math.PI;
        return start + diff * t;
    }
    
    dispose() {
        super.dispose();
    }
} 