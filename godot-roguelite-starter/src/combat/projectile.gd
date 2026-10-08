class_name PlayerProjectile
extends Area3D

@export var speed: float = 22.0
@export var damage: float = 1.0
@export var lifetime: float = 2.0

var _direction: Vector3 = Vector3.FORWARD


func _ready() -> void:
	body_entered.connect(_on_body_entered)


func setup(spawn_position: Vector3, direction: Vector3) -> void:
	global_position = spawn_position
	_direction = direction.normalized()
	look_at(global_position + _direction, Vector3.UP)


func _physics_process(delta: float) -> void:
	global_position += _direction * speed * delta
	lifetime -= delta
	if lifetime <= 0.0:
		queue_free()


func _on_body_entered(body: Node3D) -> void:
	if body.has_method("take_damage"):
		body.take_damage(damage)
	queue_free()

