import * as THREE from 'three';

// 创建加载管理器
export const loadingManager = new THREE.LoadingManager();

// 设置加载开始事件
loadingManager.onStart = function(url, itemsLoaded, itemsTotal) {
    console.log(`开始加载: ${url}`);
    console.log(`已加载 ${itemsLoaded} / ${itemsTotal} 个资源`);
};

// 设置加载进度事件
loadingManager.onProgress = function(url, itemsLoaded, itemsTotal) {
    console.log(`加载中: ${url}`);
    console.log(`已加载 ${itemsLoaded} / ${itemsTotal} 个资源`);
    
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
        loadingElement.textContent = `正在加载世界... ${Math.floor((itemsLoaded / itemsTotal) * 100)}%`;
    }
};

// 设置加载完成事件
loadingManager.onLoad = function() {
    console.log('所有资源加载完成');
    
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
        loadingElement.style.display = 'none';
    }
};

// 设置加载错误事件
loadingManager.onError = function(url) {
    console.error(`加载错误: ${url}`);
    
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
        loadingElement.textContent = `加载失败: ${url}`;
    }
}; 