import * as THREE from 'three';
import { SimplexNoise } from 'three/examples/jsm/math/SimplexNoise.js';

export class World {
    constructor(scene, loadingManager) {
        this.scene = scene;
        this.loadingManager = loadingManager;
        this.objects = [];
        this.trees = [];
        this.rocks = [];
        this.collidableObjects = []; // 可碰撞对象列表
        this.ground = null;
        this.terrainSize = 500;
        this.noise = new SimplexNoise();
        
        this.init();
    }
    
    init() {
        // 创建地形
        this.createTerrain();
        
        // 创建天空盒
        this.createSkybox();
        
        // 创建植被和岩石
        this.createVegetation();
    }
    
    createTerrain() {
        // 使用噪声生成高度图
        const resolution = 128;
        const size = this.terrainSize;
        const geometry = new THREE.PlaneGeometry(size, size, resolution, resolution);
        geometry.rotateX(-Math.PI / 2);     // 旋转90度，使平面朝下
        
        // 应用高度图
        const heightScale = 20;
        const vertices = geometry.attributes.position.array;
        
        for (let i = 0; i < vertices.length; i += 3) {
            const x = vertices[i];
            const z = vertices[i + 2];
            
            // 使用噪声函数生成高度
            const nx = x / size;
            const nz = z / size;
            
            // 多层次噪声以创建更自然的地形
            const height = 
                this.noise.noise(nx * 1, nz * 1) * 0.5 + 
                this.noise.noise(nx * 2, nz * 2) * 0.3 +
                this.noise.noise(nx * 4, nz * 4) * 0.2;
                
            vertices[i + 1] = height * heightScale;
        }
        
        // 重新计算顶点法线以获得正确的光照
        geometry.computeVertexNormals();
        
        // 创建地形材质
        const groundTexture = new THREE.TextureLoader(this.loadingManager).load(
            'https://threejs.org/examples/textures/terrain/grasslight-big.jpg'
        );
        groundTexture.wrapS = groundTexture.wrapT = THREE.RepeatWrapping;
        groundTexture.repeat.set(25, 25);
        groundTexture.anisotropy = 16;
        
        // THREE.MeshStandardMaterial是Three.js中的一种基于物理渲染(PBR)的材质
        // 它模拟真实世界的材质表现，支持金属度(metalness)和粗糙度(roughness)参数
        // map: 颜色贴图，用于定义材质的基本颜色
        // roughness: 粗糙度，值从0到1，0表示完全光滑(镜面反射)，1表示完全粗糙(漫反射)
        // metalness: 金属度，值从0到1，0表示非金属材质，1表示金属材质
        const terrainMaterial = new THREE.MeshStandardMaterial({
            map: groundTexture,     // 应用地面纹理
            roughness: 0.8,         // 较高的粗糙度，使地面看起来不光滑
            metalness: 0.1          // 低金属度，因为地面通常不是金属
        });
        
        // 创建地形网格
        // 这里的mesh是指3D网格对象，它由几何体(geometry)和材质(material)组成
        // 在这里，我们创建了一个表示地形的网格对象，使用之前定义的地形几何体和材质
        this.ground = new THREE.Mesh(geometry, terrainMaterial);
        this.ground.castShadow = false;
        this.ground.receiveShadow = true;
        this.scene.add(this.ground);
        
        // 为碰撞检测添加地形辅助对象
        this.objects.push(this.ground);
    }
    
    createSkybox() {
        // 使用纯色作为默认天空盒
        // 在实际项目中，可以用六面纹理贴图创建真正的天空盒
        this.scene.background = new THREE.Color(0x87CEEB);
        
        // 添加远处的雾效来模拟大气效果
        this.scene.fog = new THREE.FogExp2(0x87CEEB, 0.002);
    }
    
    createVegetation() {
        // 创建树木
        this.createTrees(100);
        
        // 创建岩石
        this.createRocks(50);
    }
    
    createTrees(count) {
        // 简单的树木 - 圆柱体树干和圆锥体树冠
        const trunkGeometry = new THREE.CylinderGeometry(0.5, 0.7, 2, 8);
        const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
        
        const leavesGeometry = new THREE.ConeGeometry(2, 4, 8);
        const leavesMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22 });
        
        for (let i = 0; i < count; i++) {
            // 随机位置
            const x = (Math.random() - 0.5) * this.terrainSize * 0.8;
            const z = (Math.random() - 0.5) * this.terrainSize * 0.8;
            
            // 获取地形高度
            const height = this.getHeightAt(x, z);
            
            // 创建树干
            const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
            trunk.position.set(x, height + 1, z); // 树干底部在地面上，高度为地面高度+1
            trunk.castShadow = true;
            trunk.receiveShadow = true;
            this.scene.add(trunk);
            
            // 创建树冠
            const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
            leaves.position.set(x, height + 4, z); // 树冠底部在树干顶部，高度为地面高度+4
            leaves.castShadow = true;
            leaves.receiveShadow = true;
            this.scene.add(leaves);
            
            // 将树添加到集合中
            const treeObject = { 
                trunk, 
                leaves, 
                position: new THREE.Vector3(x, height, z), // 树的底部位置
                height: height, // 地面高度
                trunkHeight: 2, // 树干高度
                type: 'tree'
            };
            this.trees.push(treeObject);
            
            // 添加到可碰撞对象列表
            this.collidableObjects.push(treeObject);
        }
    }
    
    createRocks(count) {
        const rockGeometry = new THREE.DodecahedronGeometry(1, 0);
        const rockMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x888888,
            roughness: 0.9,
            metalness: 0.1 
        });
        
        for (let i = 0; i < count; i++) {
            // 随机位置
            const x = (Math.random() - 0.5) * this.terrainSize * 0.8;
            const z = (Math.random() - 0.5) * this.terrainSize * 0.8;
            
            // 获取地形高度
            const height = this.getHeightAt(x, z);
            
            // 创建不同大小的岩石
            const scale = 0.5 + Math.random() * 1.5;
            const rock = new THREE.Mesh(rockGeometry, rockMaterial);
            rock.position.set(x, height + scale * 0.5, z); // 岩石底部在地面上，中心高度为地面高度+半径
            rock.scale.set(scale, scale, scale);
            
            // 随机旋转
            rock.rotation.x = Math.random() * Math.PI;
            rock.rotation.y = Math.random() * Math.PI;
            rock.rotation.z = Math.random() * Math.PI;
            
            rock.castShadow = true;
            rock.receiveShadow = true;
            this.scene.add(rock);
            
            // 将岩石添加到集合中
            const rockObject = { 
                mesh: rock, 
                position: new THREE.Vector3(x, height, z), // 岩石底部位置
                height: height, // 地面高度
                scale: scale, // 岩石尺寸
                type: 'rock'
            };
            this.rocks.push(rockObject);
            
            // 添加到可碰撞对象列表
            this.collidableObjects.push(rockObject);
        }
    }
    
    // 根据x,z坐标计算地形高度
    getHeightAt(x, z) {
        if (!this.ground) return 0;
        
        // 转换到地形坐标
        const nx = x / this.terrainSize;
        const nz = z / this.terrainSize;
        
        // 使用与地形创建相同的噪声函数
        const heightScale = 20;
        const height = 
            this.noise.noise(nx * 1, nz * 1) * 0.5 + 
            this.noise.noise(nx * 2, nz * 2) * 0.3 +
            this.noise.noise(nx * 4, nz * 4) * 0.2;
            
        return height * heightScale;
    }
    
    // 更新世界
    update(delta, playerPosition) {
        // 这里可以添加动态世界元素的更新
        // 例如：树叶摇曳、水流动画等
        
        // 实现简单的"无限"世界 - 当玩家移动时，世界会更新
        // 在实际游戏中，可以实现更复杂的区块加载系统
    }
    
    // 获取可碰撞对象列表
    getCollidableObjects() {
        return this.collidableObjects;
    }
    
    // 获取地面对象（用于碰撞检测）
    getGround() {
        return this.ground;
    }
} 