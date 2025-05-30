// 调试工具
export class Debug {
    constructor() {
        this.debugElement = document.getElementById('debug');
        this.isEnabled = false;
        this.stats = {};
        
        // 添加键盘快捷键
        document.addEventListener('keydown', (event) => {
            if (event.code === 'KeyD' && event.ctrlKey) {
                this.toggle();
            }
        });
    }
    
    toggle() {
        this.isEnabled = !this.isEnabled;
        this.debugElement.style.display = this.isEnabled ? 'block' : 'none';
        console.log(`调试模式: ${this.isEnabled ? '开启' : '关闭'}`);
    }
    
    update(stats) {
        if (!this.isEnabled) return;
        
        this.stats = {...this.stats, ...stats};
        
        let html = '';
        for (const [key, value] of Object.entries(this.stats)) {
            if (typeof value === 'object') {
                html += `<div><strong>${key}:</strong> ${JSON.stringify(value)}</div>`;
            } else {
                html += `<div><strong>${key}:</strong> ${value}</div>`;
            }
        }
        
        this.debugElement.innerHTML = html;
    }
    
    log(message) {
        if (!this.isEnabled) return;
        console.log(`[DEBUG] ${message}`);
    }
}
