import * as THREE from 'three';
import { BasePlayer } from './BasePlayer.js';
import { networkManager } from '../network/NetworkManager.js';

export class LocalPlayer extends BasePlayer {
    constructor(camera, ground, scene, initialPosition, playerId) {
        super(scene, initialPosition, playerId, true);
        this.camera = camera;
        this.ground = ground;

        this.moveSpeed = 10;
        this.jumpForce = 10;
        this.gravity = 20;
        this.standingSpeed = 10;
        this.crouchSpeed = 5;
        this.crouchJumpForce = 7;

        this.pitchObject = new THREE.Object3D();
        this.yawObject = new THREE.Object3D();
        this.eyeOffset = 1.7;
        this.crouchEyeOffset = 0.8;
        this.crouchAnimationSpeed = 8;

        this.pitchObject.position.y = this.eyeOffset;
        this.pitchObject.add(this.camera);
        this.yawObject.add(this.pitchObject);
        this.scene.add(this.yawObject);

        this.keys = {
            forward: false, backward: false, left: false, right: false,
            jump: false, crouch: false
        };
        this.mouseSensitivity = 0.002;
        this.direction = new THREE.Vector3();

        this.isJumping = false;
        this.isCrouching = false;

        this.viewMode = 'first-person';
        this.thirdPersonDistance = 12;
        this.MIN_DISTANCE = 3;
        this.MAX_DISTANCE = 20;
        this.ZOOM_SPEED = 0.5;
        this.cameraOrientation = 0;

        this.collidableObjects = [];
        this.boundOnKeyDown = null;
        this.boundOnKeyUp = null;

        this.initControls();
        this.updatePositionToGround();
        this.model.visible = this.viewMode === 'third-person';
    }

    initControls() {
        this.boundOnKeyDown = this.onKeyDown.bind(this);
        this.boundOnKeyUp = this.onKeyUp.bind(this);
        document.addEventListener('keydown', this.boundOnKeyDown, false);
        document.addEventListener('keyup', this.boundOnKeyUp, false);
    }
    
    registerCollidableObjects(objects) {
        this.collidableObjects = objects;
    }

    onKeyDown(event) {
        let actionTaken = false;
        switch (event.code) {
            case 'KeyW': case 'ArrowUp': this.keys.forward = true; break;
            case 'KeyS': case 'ArrowDown': this.keys.backward = true; break;
            case 'KeyA': case 'ArrowLeft': this.keys.left = true; break;
            case 'KeyD': case 'ArrowRight': this.keys.right = true; break;
            case 'Space': if (!this.isJumping) this.keys.jump = true; break;
            case 'ShiftLeft': case 'ShiftRight': this.keys.crouch = true; break;
            case 'KeyY': networkManager.sendPlayerAction({ action_name: 'Yes' }); actionTaken = true; break;
            case 'KeyN': networkManager.sendPlayerAction({ action_name: 'No' }); actionTaken = true; break;
            case 'KeyV': networkManager.sendPlayerAction({ action_name: 'Wave' }); actionTaken = true; break;
            case 'KeyP': networkManager.sendPlayerAction({ action_name: 'Punch' }); actionTaken = true; break;
            case 'KeyX': networkManager.sendPlayerAction({ action_name: 'Death' }); actionTaken = true; break;
        }
        if(actionTaken && this.actions[event.code.replace('Key','')] && !this.playingSpecialAnimation){
            this.playAnimation(event.code.replace('Key',''), 0.2, true);
        }
    }

    onKeyUp(event) {
        switch (event.code) {
            case 'KeyW': case 'ArrowUp': this.keys.forward = false; break;
            case 'KeyS': case 'ArrowDown': this.keys.backward = false; break;
            case 'KeyA': case 'ArrowLeft': this.keys.left = false; break;
            case 'KeyD': case 'ArrowRight': this.keys.right = false; break;
            case 'Space': this.keys.jump = false; break;
            case 'ShiftLeft': case 'ShiftRight': this.keys.crouch = false; break;
        }
    }

    handleMouseMovement(movementX, movementY) {
        if (this.viewMode === 'first-person') {
            this.yawObject.rotation.y -= movementX * this.mouseSensitivity;
            this.pitchObject.rotation.x -= movementY * this.mouseSensitivity;
            this.pitchObject.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.pitchObject.rotation.x));
            this.pitchRotationX = this.pitchObject.rotation.x;
            this.modelRotationY = this.yawObject.rotation.y - Math.PI;
        } else {
            this.cameraOrientation -= movementX * this.mouseSensitivity;
        }
    }
    
    handleMouseWheel(event) {
        if (this.viewMode === 'third-person') {
            this.thirdPersonDistance += event.deltaY * 0.01 * this.ZOOM_SPEED;
            this.thirdPersonDistance = Math.max(this.MIN_DISTANCE, Math.min(this.MAX_DISTANCE, this.thirdPersonDistance));
        }
    }

    toggleViewMode() {
        if (this.viewMode === 'first-person') {
            this.viewMode = 'third-person';
            this.cameraOrientation = this.yawObject.rotation.y;
            this.pitchObject.remove(this.camera);
            this.scene.add(this.camera);
            if (this.model) this.model.visible = true;
        } else {
            this.viewMode = 'first-person';
            this.scene.remove(this.camera);
            this.camera.position.set(0, 0, 0);
            this.camera.rotation.set(0, 0, 0);
            this.pitchObject.add(this.camera);
            this.yawObject.rotation.y = this.cameraOrientation;
            if (this.model) this.model.visible = false;
        }
        this.updateCameraHeight(0.016);
        networkManager.sendPlayerInput({ view_mode_changed: this.viewMode });
        console.log(`Switched to ${this.viewMode} view`);
    }

    update(delta) {
        super.updateAnimationMixer(delta);

        const previousPosition = this.position.clone();
        this.handleCrouching(delta);

        this.direction.set(0, 0, 0);
        if (this.keys.forward) this.direction.z = -1;
        if (this.keys.backward) this.direction.z = 1;
        if (this.keys.left) this.direction.x = -1;
        if (this.keys.right) this.direction.x = 1;

        let moveDirection = new THREE.Vector3();

        if (this.direction.lengthSq() > 0) {
            this.direction.normalize();
            const rotationMatrix = new THREE.Matrix4();
            if (this.viewMode === 'first-person') {
                rotationMatrix.makeRotationY(this.yawObject.rotation.y);
            } else {
                const cameraWorldDirection = new THREE.Vector3();
                this.camera.getWorldDirection(cameraWorldDirection);
                cameraWorldDirection.y = 0;
                cameraWorldDirection.normalize();

                const forward = cameraWorldDirection.clone();
                const right = new THREE.Vector3().crossVectors(this.camera.up, forward).normalize();

                let calculatedMoveDirection = new THREE.Vector3();
                if (this.keys.forward) calculatedMoveDirection.add(forward);
                if (this.keys.backward) calculatedMoveDirection.sub(forward);
                if (this.keys.left) calculatedMoveDirection.sub(right);
                if (this.keys.right) calculatedMoveDirection.add(right);
                
                if(calculatedMoveDirection.lengthSq() > 0) {
                    moveDirection.copy(calculatedMoveDirection.normalize());
                    const targetRotation = Math.atan2(moveDirection.x, moveDirection.z);
                    const rotationSpeed = 10;
                    this.modelRotationY = this.lerpAngle(this.modelRotationY, targetRotation, delta * rotationSpeed);
                }
            }
            if (this.viewMode === 'first-person') {
                moveDirection.copy(this.direction).applyMatrix4(rotationMatrix);
            }
        }

        this.velocity.y -= this.gravity * delta;
        if (this.keys.jump && !this.isJumping) {
            const jumpForce = this.isCrouching ? this.crouchJumpForce : this.jumpForce;
            this.velocity.y = jumpForce;
            this.isJumping = true;
            this.keys.jump = false;
            networkManager.sendPlayerAction({ action_name: 'Jump' });
        }

        const currentSpeed = this.isCrouching ? this.crouchSpeed : this.standingSpeed;
        this.position.x += moveDirection.x * currentSpeed * delta;
        this.position.z += moveDirection.z * currentSpeed * delta;
        this.position.y += this.velocity.y * delta;

        const groundHeight = this.getGroundHeight(this.position.x, this.position.z);
        let effectiveGroundHeight = groundHeight;

        const objectHeight = this.checkStandingOnObject();
        if (objectHeight !== null && this.position.y <= objectHeight + this.height) {
            effectiveGroundHeight = objectHeight;
            if (this.velocity.y <=0) {
                this.position.y = effectiveGroundHeight + this.height;
                this.velocity.y = 0;
                this.isJumping = false;
            }
        } else if (this.position.y <= groundHeight + this.height) {
            this.position.y = groundHeight + this.height;
            this.velocity.y = 0;
            this.isJumping = false;
        }

        if (this.checkObjectCollisions()) {
            this.position.x = previousPosition.x;
            this.position.z = previousPosition.z;
        }
        
        this.yawObject.position.copy(this.position);
        if (this.viewMode === 'first-person') {
            this.updateCameraHeight(delta);
            this.modelRotationY = this.yawObject.rotation.y - Math.PI;
            if(this.model) this.model.visible = false;
        } else {
            this.updateThirdPersonCamera();
            if(this.model) this.model.visible = true;
        }
        
        super.updateModelTransform();
        this.updateAnimationState(delta);
        this.sendStateToServer();
    }

    updateAnimationState(delta) {
        if (this.playingSpecialAnimation) return;

        let newBaseActionName = 'Idle';
        if (this.isJumping) {
            newBaseActionName = 'Jump';
        } else if (this.keys.forward || this.keys.backward || this.keys.left || this.keys.right) {
            newBaseActionName = this.isCrouching ? 'Walking' : 'Running';
        } else {
            newBaseActionName = this.isCrouching ? 'Sitting' : 'Idle';
        }
        
        if (this.currentBaseAction !== newBaseActionName || (newBaseActionName === 'Jump' && this.activeAction !== this.actions['Jump'])) {
             if (newBaseActionName === 'Jump') {
                 this.playAnimation('Jump', 0.2, true, () => {
                     this.isJumping = false;
                     let landedAction = (this.keys.forward || this.keys.backward || this.keys.left || this.keys.right) ? (this.isCrouching ? 'Walking' : 'Running') : (this.isCrouching ? 'Sitting' : 'Idle');
                     this.currentBaseAction = landedAction;
                     this.fadeToAction(landedAction, 0.1);
                 });
             } else {
                 this.currentBaseAction = newBaseActionName;
                 this.fadeToAction(newBaseActionName, 0.2);
             }
        }
    }
    
    sendStateToServer() {
        const inputPayload = {
            timestamp: Date.now(),
            keys: { ...this.keys },
            position: { x: this.position.x, y: this.position.y, z: this.position.z },
            velocity: { x: this.velocity.x, y: this.velocity.y, z: this.velocity.z },
            model_rotation_y: this.modelRotationY,
            pitch_rotation_x: this.pitchRotationX,
            is_crouching: this.isCrouching,
            height: this.height,
            animation: this.currentBaseAction,
            view_mode: this.viewMode,
            camera_orientation_y: (this.viewMode === 'third-person') ? this.cameraOrientation : this.yawObject.rotation.y
        };
        networkManager.sendPlayerInput(inputPayload);
    }

    updateCameraHeight(delta) {
        const targetEyeHeight = this.isCrouching ? this.crouchEyeOffset : this.eyeOffset;
        if (Math.abs(this.pitchObject.position.y - targetEyeHeight) > 0.01) {
            const diff = targetEyeHeight - this.pitchObject.position.y;
            this.pitchObject.position.y += diff * this.crouchAnimationSpeed * delta;
        } else {
            this.pitchObject.position.y = targetEyeHeight;
        }
    }
    
    updateThirdPersonCamera() {
        const idealOffset = new THREE.Vector3(0, this.thirdPersonDistance * 0.4, this.thirdPersonDistance);
        idealOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.cameraOrientation);
        idealOffset.add(this.position);

        this.camera.position.lerp(idealOffset, 0.15);

        const lookAtTarget = this.position.clone();
        lookAtTarget.y += this.isCrouching ? this.crouchEyeOffset + 0.5 : this.eyeOffset -0.2;
        this.camera.lookAt(lookAtTarget);
    }

    handleCrouching(delta) {
        const oldHeight = this.height;
        if (this.keys.crouch && !this.isCrouching) {
            this.isCrouching = true;
            super.setHeight(this.crouchHeight);
        } else if (!this.keys.crouch && this.isCrouching) {
            this.isCrouching = false;
            super.setHeight(this.standingHeight);
        }
        if (oldHeight !== this.height) {
            this.position.y += (oldHeight - this.height);
            this.updatePositionToGround();
        }
    }

    getGroundHeight(x, z) {
        if (!this.ground || !this.ground.geometry || !this.ground.geometry.attributes.position) return 0;
        
        const geometry = this.ground.geometry;
        const positionAttribute = geometry.attributes.position;
        const width = geometry.parameters.width;
        const planeHeight = geometry.parameters.height;
        const widthSegments = geometry.parameters.widthSegments;
        const heightSegments = geometry.parameters.heightSegments;

        const terrainX = (x + width / 2) / width * widthSegments;
        const terrainZ = (z + planeHeight / 2) / planeHeight * heightSegments;

        const x1 = Math.max(0, Math.min(Math.floor(terrainX), widthSegments -1));
        const z1 = Math.max(0, Math.min(Math.floor(terrainZ), heightSegments -1));
        const x2 = Math.min(x1 + 1, widthSegments);
        const z2 = Math.min(z1 + 1, heightSegments);
        
        const xFrac = terrainX - x1;
        const zFrac = terrainZ - z1;

        const idx = (idxZ, idxX) => (idxZ * (widthSegments + 1)) + idxX;

        const y11 = positionAttribute.getY(idx(z1, x1));
        const y12 = positionAttribute.getY(idx(z2, x1));
        const y21 = positionAttribute.getY(idx(z1, x2));
        const y22 = positionAttribute.getY(idx(z2, x2));
        
        const y1 = y11 * (1 - xFrac) + y21 * xFrac;
        const y2 = y12 * (1 - xFrac) + y22 * xFrac;
        const y = y1 * (1 - zFrac) + y2 * zFrac;
        return y;
    }

    updatePositionToGround() {
        if (this.ground) {
            const groundHeight = this.getGroundHeight(this.position.x, this.position.z);
            this.position.y = groundHeight + this.height;
            if (this.yawObject) this.yawObject.position.copy(this.position);
        }
    }

    checkObjectCollisions() {
        const playerXZ = new THREE.Vector2(this.position.x, this.position.z);
        for (const obj of this.collidableObjects) {
            if (!obj.position) continue;
            const objXZ = new THREE.Vector2(obj.position.x, obj.position.z);
            const distance = playerXZ.distanceTo(objXZ);
            
            let colRadius = (obj.type === 'tree') ? 1.0 : (obj.scale || 1.0);
            let objTop = (obj.type === 'tree') ? obj.height + obj.trunkHeight : obj.height + (obj.scale || 1.0);

            if (distance < this.radius + colRadius) {
                const playerBottom = this.position.y - this.height;
                if (playerBottom < objTop - 0.3) {
                    return true;
                }
            }
        }
        return false;
    }

    checkStandingOnObject() {
        if (this.velocity.y > 0) return null;
        const playerXZ = new THREE.Vector2(this.position.x, this.position.z);
        for (const obj of this.collidableObjects) {
            if (!obj.position) continue;
            const objXZ = new THREE.Vector2(obj.position.x, obj.position.z);
            const distance = playerXZ.distanceTo(objXZ);

            let colRadius = (obj.type === 'tree') ? 1.0 : (obj.scale || 1.0);
            let objTop = (obj.type === 'tree') ? obj.height + obj.trunkHeight : obj.height + (obj.scale || 1.0);
            
            if (distance < this.radius + colRadius) {
                const playerBottom = this.position.y - this.height;
                if (Math.abs(playerBottom - objTop) < 0.5) {
                    return objTop;
                }
            }
        }
        return null;
    }
    
    lerpAngle(start, end, t) {
        let diff = end - start;
        while (diff > Math.PI) diff -= 2 * Math.PI;
        while (diff < -Math.PI) diff += 2 * Math.PI;
        return start + diff * t;
    }

    dispose() {
        super.dispose();
        if (this.boundOnKeyDown) {
            document.removeEventListener('keydown', this.boundOnKeyDown, false);
        }
        if (this.boundOnKeyUp) {
            document.removeEventListener('keyup', this.boundOnKeyUp, false);
        }
        if (this.yawObject) this.scene.remove(this.yawObject);
        if (this.camera) {
            if (this.pitchObject && this.pitchObject.children.includes(this.camera)) {
                this.pitchObject.remove(this.camera);
            }
            if (this.scene && this.scene.children.includes(this.camera)) {
                this.scene.remove(this.camera);
            }
        }
    }
} 