class_name ChaserEnemy
extends CharacterBody3D

signal died(points: int)

@export var move_speed: float = 3.2
@export var max_health: float = 3.0
@export var contact_damage: float = 1.0
@export var attack_range: float = 1.25
@export var attack_cooldown: float = 0.8
@export var score_value: int = 10

var target: Player
var health: float
var _attack_timer: float = 0.0


func _ready() -> void:
	health = max_health


func _physics_process(delta: float) -> void:
	if not is_instance_valid(target):
		velocity = Vector3.ZERO
		return

	_attack_timer = maxf(_attack_timer - delta, 0.0)
	var offset := target.global_position - global_position
	offset.y = 0.0

	if offset.length() > 0.05:
		velocity = offset.normalized() * move_speed
		look_at(global_position + offset, Vector3.UP)
	else:
		velocity = Vector3.ZERO
	move_and_slide()

	if offset.length() <= attack_range and _attack_timer <= 0.0:
		_attack_timer = attack_cooldown
		target.take_damage(contact_damage)


func take_damage(amount: float) -> void:
	health -= amount
	if health <= 0.0:
		died.emit(score_value)
		queue_free()

