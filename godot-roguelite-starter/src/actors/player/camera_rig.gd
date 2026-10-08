extends Node3D

@export var follow_speed: float = 14.0

@onready var target := get_parent() as Node3D


func _ready() -> void:
	top_level = true
	global_position = target.global_position


func _process(delta: float) -> void:
	if not is_instance_valid(target):
		return
	var weight := 1.0 - exp(-follow_speed * delta)
	global_position = global_position.lerp(target.global_position, weight)

