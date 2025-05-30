import asyncio
import time
from typing import Dict, List, Optional

from connection_manager import manager
from player_state import PlayerState


class GameRoom:
    def __init__(self, sio_server):
        self.sio = sio_server
        self.game_loop_task: Optional[asyncio.Task] = None
        self.tick_rate = 1.0 / 20.0 # 20 updates per second
        self.running = False

    async def handle_player_input(self, sid: str, data: dict):
        client_id = sid # client_id is the sid

        manager.update_player_from_input(client_id, data)
        
        # view_mode_changed is a specific piece of input data, handled here
        # as it directly affects player state for broadcasts.
        if 'view_mode_changed' in data:
            player = manager.get_player_state(client_id)
            if player:
                player.view_mode = data['view_mode_changed']
                print(f"Player {client_id} changed view mode to {player.view_mode}")


    async def handle_player_action(self, sid: str, data: dict):
        client_id = sid # client_id is the sid
        
        player = manager.get_player_state(client_id)
        if not player:
            print(f"Warning: Player action from unknown player {client_id}")
            return

        action_name = data.get("action_name")
        print(f"Player {player.username} ({client_id}) performed action: {action_name}")

        # Server can validate action or update server-side state if needed
        # For now, it primarily broadcasts.
        # Some actions might have immediate state impact on the server model of the player
        if action_name in ["Jump", "Yes", "No", "Wave", "Punch", "Death"]: # Example actions
            if action_name == "Jump":
                # The animation field in PlayerState is updated by client input normally.
                # This could be a redundant update or for specific server-side animation trigger.
                # For jump, client sends animation state already. This might be for ensuring it.
                player.animation = "Jump" # Explicitly set for server state if needed
            
            # Broadcast the action to other clients
            await self.sio.emit('action_broadcast', {
                'playerId': client_id,
                'action_name': action_name,
            }) # No skip_sid here, action broadcast should go to everyone for remote players.
               # The client originating the action might ignore it for its own local player if it also handles it locally.
               # Or client can check if playerId === localPlayerId.

    async def game_loop(self):
        self.running = True
        print("Game loop started.")
        last_log_time = time.time()
        log_interval = 10 # Log game state being sent every 10 seconds for debugging
        
        while self.running:
            loop_start_time = time.perf_counter()

            current_game_state = {
                "timestamp": int(time.time() * 1000),
                "players": manager.get_all_player_states_for_broadcast(),
                "world_events": [] # Placeholder for future world events
            }

            await self.sio.emit('game_state', current_game_state)

            if time.time() - last_log_time > log_interval:
                # print(f"Game state sent: {len(current_game_state['players'])} players.")
                last_log_time = time.time()

            elapsed_time = time.perf_counter() - loop_start_time
            await asyncio.sleep(max(0, self.tick_rate - elapsed_time))
        
        print("Game loop stopped.")

    def start_game_loop(self):
        if not self.running: # Check self.running instead of task status for clearer intent
            if self.game_loop_task and not self.game_loop_task.done():
                print("Warning: start_game_loop called but task exists and is not done. Cancelling old task.")
                self.game_loop_task.cancel() # Ensure old one is stopped if any
            self.game_loop_task = asyncio.create_task(self.game_loop())
        else:
            print("Game loop already running.")
            
    def stop_game_loop(self):
        if self.running:
            self.running = False 
            print("Game loop stopping...")
        else:
            print("Game loop already stopped or not running.") 