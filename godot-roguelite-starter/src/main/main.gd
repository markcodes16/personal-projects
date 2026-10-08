extends Node3D

const ENEMY_SCENE := preload("res://src/actors/enemies/chaser_enemy.tscn")
const ARENA_HALF_SIZE := 16.0

@onready var player: Player = $Player
@onready var spawn_timer: Timer = $EnemySpawnTimer
@onready var health_label: Label = $HUD/Margin/VBox/HealthLabel
@onready var score_label: Label = $HUD/Margin/VBox/ScoreLabel
@onready var time_label: Label = $HUD/Margin/VBox/TimeLabel
@onready var defeat_panel: Control = $HUD/DefeatPanel

var score := 0
var elapsed_time := 0.0
var _game_over := false
var _rng := RandomNumberGenerator.new()


func _ready() -> void:
	_register_input_actions()
	_rng.randomize()
	player.health_changed.connect(_on_player_health_changed)
	player.died.connect(_on_player_died)
	spawn_timer.timeout.connect(_spawn_enemy)
	_on_player_health_changed(player.health, player.max_health)
	_update_score()


func _process(delta: float) -> void:
	if _game_over:
		if Input.is_action_just_pressed("restart"):
			get_tree().reload_current_scene()
		return

	elapsed_time += delta
	time_label.text = "Time: %02d:%02d" % [int(elapsed_time) / 60, int(elapsed_time) % 60]
	spawn_timer.wait_time = maxf(0.35, 1.25 - elapsed_time * 0.008)


func _spawn_enemy() -> void:
	if _game_over:
		return
	var enemy := ENEMY_SCENE.instantiate() as ChaserEnemy
	var angle := _rng.randf_range(0.0, TAU)
	var distance := _rng.randf_range(10.0, ARENA_HALF_SIZE - 1.0)
	enemy.position = Vector3(cos(angle) * distance, 0.0, sin(angle) * distance)
	enemy.target = player
	enemy.max_health += floorf(elapsed_time / 30.0)
	enemy.move_speed += minf(elapsed_time * 0.006, 1.8)
	enemy.died.connect(_on_enemy_died)
	$Enemies.add_child(enemy)


func _on_enemy_died(points: int) -> void:
	score += points
	_update_score()


func _on_player_health_changed(current: float, maximum: float) -> void:
	health_label.text = "Health: %d / %d" % [ceili(current), ceili(maximum)]


func _on_player_died() -> void:
	_game_over = true
	spawn_timer.stop()
	defeat_panel.visible = true


func _update_score() -> void:
	score_label.text = "Score: %06d" % score


func _register_input_actions() -> void:
	_add_key_action("move_forward", [KEY_W, KEY_UP])
	_add_key_action("move_back", [KEY_S, KEY_DOWN])
	_add_key_action("move_left", [KEY_A, KEY_LEFT])
	_add_key_action("move_right", [KEY_D, KEY_RIGHT])
	_add_key_action("shoot", [KEY_SPACE])
	_add_key_action("restart", [KEY_R])

	if not InputMap.action_has_event("shoot", _mouse_button(MOUSE_BUTTON_LEFT)):
		InputMap.action_add_event("shoot", _mouse_button(MOUSE_BUTTON_LEFT))


func _add_key_action(action: StringName, keys: Array[Key]) -> void:
	if not InputMap.has_action(action):
		InputMap.add_action(action)
	for key in keys:
		var event := InputEventKey.new()
		event.physical_keycode = key
		if not InputMap.action_has_event(action, event):
			InputMap.action_add_event(action, event)


func _mouse_button(button: MouseButton) -> InputEventMouseButton:
	var event := InputEventMouseButton.new()
	event.button_index = button
	return event

