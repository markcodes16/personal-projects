class_name Player
extends CharacterBody3D

signal health_changed(current: float, maximum: float)
signal died

const PROJECTILE_SCENE := preload("res://src/combat/projectile.tscn")

@export_group("Movement")
@export var move_speed: float = 8.0
@export var acceleration: float = 30.0

@export_group("Combat")
@export var max_health: float = 10.0
@export var fire_cooldown: float = 0.22

@onready var camera: Camera3D = $CameraRig/Camera3D
@onready var muzzle: Marker3D = $Muzzle

var health: float
var _fire_timer: float = 0.0
var _can_control := true


func _ready() -> void:
	health = max_health
	health_changed.emit(health, max_health)


func _physics_process(delta: float) -> void:
	if not _can_control:
		velocity = Vector3.ZERO
		return

	_fire_timer = maxf(_fire_timer - delta, 0.0)
	_update_aim()
	_update_movement(delta)

	if Input.is_action_pressed("shoot") and _fire_timer <= 0.0:
		_shoot()


func _update_movement(delta: float) -> void:
	var input := Input.get_vector("move_left", "move_right", "move_forward", "move_back")
	var desired := Vector3(input.x, 0.0, input.y) * move_speed
	velocity.x = move_toward(velocity.x, desired.x, acceleration * delta)
	velocity.z = move_toward(velocity.z, desired.z, acceleration * delta)
	velocity.y = 0.0
	move_and_slide()


func _update_aim() -> void:
	var mouse := get_viewport().get_mouse_position()
	var ray_origin := camera.project_ray_origin(mouse)
	var ray_direction := camera.project_ray_normal(mouse)
	var aim_plane := Plane(Vector3.UP, global_position.y)
	var hit: Variant = aim_plane.intersects_ray(ray_origin, ray_direction)
	if hit is Vector3:
		var target := hit as Vector3
		if target.distance_squared_to(global_position) > 0.01:
			look_at(Vector3(target.x, global_position.y, target.z), Vector3.UP)


func _shoot() -> void:
	_fire_timer = fire_cooldown
	var projectile := PROJECTILE_SCENE.instantiate() as PlayerProjectile
	get_tree().current_scene.add_child(projectile)
	projectile.setup(muzzle.global_position, -global_transform.basis.z)


func take_damage(amount: float) -> void:
	if not _can_control:
		return
	health = maxf(health - amount, 0.0)
	health_changed.emit(health, max_health)
	if health <= 0.0:
		_can_control = false
		died.emit()

