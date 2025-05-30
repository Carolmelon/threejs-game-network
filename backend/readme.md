
### 1. 安装 uv

```bash
pipx install uv
# 或者
pip install uv
```

---

### 2. 初始化虚拟环境

在项目根目录（`/Users/zebralee/Desktop/codings/threejs-game-network`）下运行：

```bash
uv venv
```

会在当前目录下创建一个 `.venv` 虚拟环境。

---

### 3. 激活虚拟环境

macOS 下激活方式如下：

```bash
source .venv/bin/activate
```

---

### 4. 安装依赖

`backend/requirements.txt` 已经列出了依赖，直接用 uv 安装：

```bash
uv pip install -r requirements.txt
```

所有依赖会被安装到 `.venv` 虚拟环境中。

---

### 5. 运行项目

依赖装好后，确保虚拟环境已激活，然后就可以像以前一样运行 FastAPI 项目：

```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

---

### 6. 后续依赖管理

- 新增依赖时用 `uv pip install 包名`，然后用 `uv pip freeze > backend/requirements.txt` 更新依赖列表。
- 也可以用 `uv pip uninstall 包名` 卸载依赖。

---

### 总结

1. `uv venv`
2. `source .venv/bin/activate`
3. `uv pip install -r backend/requirements.txt`
4. 正常开发和运行

这样项目就完全由 uv 和虚拟环境管理，兼容 pip 的所有用法，但速度更快、体验更好！

如需自动激活虚拟环境，可以考虑用 [uv-auto-activate](https://github.com/astral-sh/uv#auto-activation) 插件。

如需具体 shell 命令或遇到报错，欢迎随时贴出来！
