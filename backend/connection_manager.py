from typing import Dict, List, Optional
# fastapi.WebSocket is not directly used by socket.io event handlers
import time
from player_state import Vector3

from player_state import PlayerState

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, bool] = {}  # Keyed by sid
        self.player_states: Dict[str, PlayerState] = {} # Keyed by sid (acting as client_id)

    def register_connection(self, sid: str):
        """Registers a new connection by its SID."""
        self.active_connections[sid] = True
        print(f"Connection registered for sid: {sid}")

    def disconnect(self, sid: str) -> Optional[str]:
        """
        Handles disconnection of a client by SID.
        Removes active connection and player state.
        Returns the SID if the connection was known, otherwise None.
        """
        client_id = sid # client_id is the sid

        was_active = self.active_connections.pop(sid, None)
        removed_player_state = self.player_states.pop(client_id, None)

        if was_active or removed_player_state:
            status_msg = f"Player {client_id} (sid: {sid}) processing disconnect. "
            status_msg += f"State was {'present' if removed_player_state else 'absent'}."
            if not was_active and removed_player_state: # Should not happen if logic is correct
                 status_msg += f" Active connection flag was already removed."
            print(status_msg)
            return client_id 
        
        print(f"Sid {sid} disconnect called, but was not found in active connections or player states.")
        return None


    def get_player_state(self, client_id: str) -> Optional[PlayerState]: # client_id is sid
        return self.player_states.get(client_id)

    def create_or_update_player_state(self, client_id: str, username: str = "Anonymous") -> PlayerState: # client_id is sid
        if client_id not in self.player_states:
            import random
            start_pos = Vector3(x=random.uniform(-10, 10), y=5.0, z=random.uniform(-10, 10))
            
            self.player_states[client_id] = PlayerState(
                id=client_id, # PlayerState.id is client_id (sid)
                username=username if username else f"Player_{client_id[:4]}",
                sid=client_id, # PlayerState.sid is also client_id (sid) for consistency
                position=start_pos,
                last_update_time=time.time()
            )
            print(f"Created new state for player {client_id} ({username}) at {start_pos.x},{start_pos.y},{start_pos.z}")
        else:
            # Update existing player, e.g., if they reconnected with same ID (though SID would be new)
            # Or if username changes, though not typical post-initial setup.
            self.player_states[client_id].username = username if username else self.player_states[client_id].username
            self.player_states[client_id].sid = client_id # Ensure sid field in PlayerState is also up-to-date
            self.player_states[client_id].last_update_time = time.time()
        return self.player_states[client_id]

    def update_player_from_input(self, client_id: str, data: dict): # client_id is sid
        player = self.get_player_state(client_id)
        if not player:
            print(f"Warning: Player state not found for {client_id} during update_player_from_input.")
            return

        player.last_update_time = data.get('timestamp', time.time()) / 1000.0
        
        if 'position' in data:
            player.position = Vector3(**data['position'])
        if 'velocity' in data:
            player.velocity = Vector3(**data['velocity'])
        if 'model_rotation_y' in data:
            player.model_rotation_y = data['model_rotation_y']
        if 'pitch_rotation_x' in data:
            player.pitch_rotation_x = data['pitch_rotation_x']
        if 'is_crouching' in data:
            player.is_crouching = data['is_crouching']
        if 'height' in data:
            player.height = data['height']
        if 'animation' in data:
            player.animation = data['animation']
        if 'view_mode' in data:
            player.view_mode = data['view_mode']
        if 'camera_orientation_y' in data:
            player.camera_orientation_y = data['camera_orientation_y']
        if 'keys' in data:
            player.keys = data['keys']
        
        min_y = -10 # Respawn or ground boundary check
        # This simple Y check might be insufficient for complex terrains,
        # but it's what was there. Player height should be accounted for properly.
        # e.g. if player.position.y - player.height < min_y
        if player.position.y < min_y + player.height: # Assuming player.position.y is eye-level or similar
             player.position.y = min_y + player.height
        
        # World boundaries
        world_boundary = 240 
        player.position.x = max(-world_boundary, min(world_boundary, player.position.x))
        player.position.z = max(-world_boundary, min(world_boundary, player.position.z))


    async def broadcast_message(self, message: dict, exclude_sid: Optional[str] = None):
        # This method is defined but not used in the provided code.
        # If used, sio instance would be needed here or passed.
        pass

    def get_all_player_states_for_broadcast(self) -> List[dict]:
        # PlayerState.id is the sid. PlayerState.sid field is also sid.
        # Excluding 'sid' from model_dump is fine if 'id' is the canonical identifier used by client.
        return [p.model_dump(exclude={'keys', 'sid'}) for p in self.player_states.values()]


manager = ConnectionManager() 