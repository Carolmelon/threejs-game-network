from pydantic import BaseModel, Field
from typing import Dict, Optional

class Vector3(BaseModel):
    x: float = 0.0
    y: float = 0.0
    z: float = 0.0

class PlayerState(BaseModel):
    id: str
    sid: Optional[str] = None
    username: str = "N/A"
    position: Vector3 = Field(default_factory=Vector3)
    velocity: Vector3 = Field(default_factory=Vector3)
    model_rotation_y: float = 0.0
    pitch_rotation_x: float = 0.0
    is_crouching: bool = False
    height: float = 1.8
    animation: str = "Idle"
    view_mode: str = "first-person"
    camera_orientation_y: float = 0.0
    last_update_time: float = 0.0
    health: int = 100
    keys: Dict[str, bool] = Field(default_factory=dict)

    class Config:
        str_strip_whitespace = True 