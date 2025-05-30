from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import socketio
import time
import os

from connection_manager import manager
from game_room import GameRoom
from player_state import PlayerState

# 先创建 FastAPI 实例
fastapi_app = FastAPI()

fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 创建 Socket.IO 服务器
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')
# 注意 socketio_path 必须与前端一致
socket_app = socketio.ASGIApp(sio, socketio_path='socket.io')

# 顶层 ASGI 应用，将 FastAPI 作为回退
app = socketio.ASGIApp(
    sio,
    fastapi_app,
    socketio_path='socket.io'
)

game_room = GameRoom(sio_server=sio)


@sio.event
async def connect(sid, environ):
    print(f"Client connected: {sid}")
    manager.register_connection(sid)
    # Client ID sent to the client is its own SID.
    await sio.emit('client_id_assigned', {'clientId': sid}, room=sid)

@sio.event
async def disconnect(sid):
    print(f"Client disconnected: {sid}")
    # manager.disconnect now returns the sid if the client was known
    client_id = manager.disconnect(sid) 
    if client_id: # client_id is the sid of the disconnected player
        await sio.emit('player_left', {'playerId': client_id}, skip_sid=sid)
    
    if not manager.active_connections and game_room.running:
        print("No active connections, stopping game loop.")
        game_room.stop_game_loop()


@sio.event
async def client_ready(sid, data):
    username = data.get('username', f"Player_{sid[:4]}")
    client_id = sid # client_id is the sid
    print(f"Client {client_id} is ready with username: {username}")

    # create_or_update_player_state now takes client_id (which is sid) and username
    player_state = manager.create_or_update_player_state(client_id, username)

    # Notify other players that this player has joined
    player_joined_data = player_state.model_dump(exclude={'keys', 'sid'})
    await sio.emit('player_joined', {'player': player_joined_data }, skip_sid=sid)
    
    print(f"Player {player_state.username} ({client_id}) joined the game.")

    # Proactively send initial game state to the client that just became ready
    initial_state_for_client = {
        "timestamp": int(time.time() * 1000),
        "players": manager.get_all_player_states_for_broadcast(),
        "world_settings": { "terrainSize": 500 } # Example, can be dynamic
    }
    await sio.emit('initial_game_state', initial_state_for_client, room=sid)
    print(f"Sent initial game state to {client_id} after client_ready.")

    if not game_room.running and manager.active_connections:
        print("First player joined, starting game loop.")
        game_room.start_game_loop()


@sio.event
async def player_input(sid, data):
    # game_room.handle_player_input will use sid as client_id
    await game_room.handle_player_input(sid, data)

@sio.event
async def player_action(sid, data):
    print(f"Received action from {sid}: {data}")
    # game_room.handle_player_action will use sid as client_id
    await game_room.handle_player_action(sid, data)

@sio.event
async def chat_message(sid, data):
    client_id = sid # client_id is the sid
    player = manager.get_player_state(client_id)
    if not player: 
        print(f"Warning: Chat message from unknown sid {sid}")
        return

    message_text = data.get('message', '')
    if not message_text.strip(): return
    
    print(f"Chat from {player.username} ({client_id}): {message_text}")
    
    chat_data = {
        'sender_id': client_id,
        'username': player.username,
        'message': message_text
    }
    # Broadcast to all, including sender for local echo if client doesn't do it, 
    # or skip_sid=sid if client handles its own messages.
    # Current client handles its own message, so skip_sid is correct.
    await sio.emit('chat_message', chat_data, skip_sid=sid)


@fastapi_app.on_event("startup")
async def startup_event():
    print("Server starting up...")

@fastapi_app.on_event("shutdown")
async def shutdown_event():
    print("Server shutting down...")
    game_room.stop_game_loop()
    if game_room.game_loop_task and not game_room.game_loop_task.done():
        import asyncio
        try:
            await asyncio.wait_for(game_room.game_loop_task, timeout=2.0)
        except asyncio.TimeoutError:
            print("Game loop did not stop in time.")
            game_room.game_loop_task.cancel()


if __name__ == "__main__":
    import uvicorn
    print("Starting server with Uvicorn directly (for debugging).")
    print("Recommended: uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000")
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)