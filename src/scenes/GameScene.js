class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  init(data) {
    this.worldData = data.worldData;
  }

  create() {
    this.createPlayer();
    this.createUI();
    this.worldState = {};
    this.combineMode = null;
    this.inventory = new Inventory(this);
    this.actionMenu = new ActionMenu(this);
    this.dialogUI = new DialogUI(this);
    this.roomManager = new RoomManager(this, this.worldData, this.inventory);
    this.roomManager.onTransition = (roomId) => {
      this.showMessage('Entered ' + this.roomManager.currentRoomData.name);
    };
    this.roomManager.start(this.worldData.startRoom);
    this.setupInput();
  }

  getObjState(objDef) {
    return this.worldState[objDef.id] || objDef.state;
  }

  setObjState(objDef, newState) {
    this.worldState[objDef.id] = newState;

    if (objDef.stateFrames && objDef.stateFrames[newState] !== undefined) {
      const entry = this.roomManager.roomObjects.find(o => o.def.id === objDef.id);
      if (entry) {
        entry.go.setFrame(objDef.stateFrames[newState]);
      }
    }

    if (objDef.reveals) {
      objDef.reveals.forEach((childId) => {
        const childDef = this.roomManager.currentRoomData.objects.find((o) => o.id === childId);
        if (childDef && !this.worldState[childDef.id + '_revealed']) {
          this.worldState[childDef.id + '_revealed'] = true;
          this.roomManager.revealObjectById(childDef);
        }
      });
    }
  }

  getObjMessage(objDef, key) {
    const state = this.getObjState(objDef);
    if (state && objDef.states && objDef.states[state] && objDef.states[state][key + 'Message'] !== undefined) {
      return objDef.states[state][key + 'Message'];
    }
    return objDef[key + 'Message'];
  }

  resolveCombineResult(a, b) {
    const bid = typeof b === 'string' ? b : b.id;
    const aid = typeof a === 'string' ? a : a.id;
    const r1 = a.combineMessages && a.combineMessages[bid];
    const r2 = b.combineMessages && b.combineMessages[aid];

    const conditionMet = (entry) => {
      if (!entry || typeof entry !== 'object' || !entry.requiresState) return true;
      return entry.requiresState.every((cond) => {
        return (this.worldState[cond.id] || null) === cond.state;
      });
    };

    const candidates = [
      { entry: r1 && typeof r1 === 'object' ? r1 : null, src: 'a' },
      { entry: r2 && typeof r2 === 'object' ? r2 : null, src: 'b' },
      { entry: typeof r1 === 'string' ? { message: r1 } : null, src: 'a' },
      { entry: typeof r2 === 'string' ? { message: r2 } : null, src: 'b' },
    ];

    for (const { entry, src } of candidates) {
      if (!entry) continue;
      if (!conditionMet(entry)) continue;
      return { message: entry.message, setState: entry.setState, setStateTarget: src === 'a' ? a : b };
    }

    return { message: 'Nothing happens.' };
  }

  createPlayer() {
    this.player = this.add.sprite(0, 0, 'player');
    this.player.setDepth(10).setScale(2);

    this.anims.create({
      key: 'idle',
      frames: this.anims.generateFrameNumbers('player', { start: 0, end: 1 }),
      frameRate: 2.5,
      repeat: -1
    });

    this.anims.create({
      key: 'walk',
      frames: this.anims.generateFrameNumbers('player', { start: 2, end: 3 }),
      frameRate: 10,
      repeat: -1
    });

    this.player.play('idle');

    this.playerMovement = new CharacterMovement(this, this.player, {
      speed: 220,
      onArrive: () => {}
    });
  }

  createUI() {
    this.roomLabel = this.add.text(12, 6, '', {
      fontSize: '14px',
      color: '#ffffff',
      fontFamily: 'monospace',
      backgroundColor: '#00000088',
      padding: { x: 6, y: 3 },
    }).setDepth(100);

    this.messageText = this.add.text(0, 0, '', {
      fontSize: '14px',
      color: '#ffffff',
      fontFamily: 'monospace',
      backgroundColor: '#000000aa',
      padding: { x: 10, y: 6 },
      wordWrap: { width: this.scale.width - 100 },
    }).setDepth(100).setVisible(false).setOrigin(0.5);
  }

  setupInput() {
    this.input.on('pointerdown', (pointer) => {
      if (this.dialogUI.isOpen) return;

      if (this._invClick) {
        this._invClick = false;
        return;
      }

      if (this.actionMenu.isOpen) {
        this.actionMenu.close();
        return;
      }

      const invY = this.scale.height - this.inventory.barHeight;
      if (pointer.y > invY) return;

      const hitDoor = this.doorHitTest(pointer.x, pointer.y);
      if (hitDoor) return;

      const hitDoorObj = this.doorObjectHitTest(pointer.x, pointer.y);
      if (hitDoorObj) return;

      const hitObject = this.objectHitTest(pointer.x, pointer.y);
      if (hitObject) return;

      if (this.combineMode) {
        this.combineMode = null;
        this.showMessage('Cancelled.');
        return;
      }

      this.player.setFlipX(pointer.x >= this.player.x);
      this.playerMovement.moveTo(pointer.x, pointer.y);
    });
  }

  resolveCombine(targetItem) {
    const source = this.combineMode.sourceItem;
    this.combineMode = null;

    const result = this.resolveCombineResult(targetItem, source);

    if (result.setState) {
      this.setObjState(result.setStateTarget, result.setState);
    }

    this.showMessage(result.message);
  }

  doorHitTest(x, y) {
    const door = this.roomManager.doors.find((d) => {
      const dx = d.go.x - x;
      const dy = d.go.y - y;
      const halfW = d.def.width / 2 + 3;
      const halfH = d.def.height / 2 + 3;
      return Math.abs(dx) <= halfW && Math.abs(dy) <= halfH;
    });
    if (!door) return false;

    this.playerMovement.moveTo(door.go.x, door.go.y);
    const origArrive = this.playerMovement.onArrive;
    this.playerMovement.onArrive = () => {
      this.playerMovement.onArrive = origArrive;
      this.roomManager.transitionTo(door.def);
    };
    return true;
  }

  doorObjectHitTest(x, y) {
    if (this.combineMode) return false;
    const obj = this.roomManager.roomObjects.find((o) => {
      if (!o.def.becomesDoor) return false;
      if (!this.worldState[o.def.id + '_doorOpen']) return false;
      const dx = o.go.x - x;
      const dy = o.go.y - y;
      const hw = (o.def.width || o.def.radius * 2) / 2 + 3;
      const hh = (o.def.height || o.def.radius * 2) / 2 + 3;
      return Math.abs(dx) <= hw && Math.abs(dy) <= hh;
    });
    if (!obj) return false;

    this.playerMovement.moveTo(obj.go.x, obj.go.y);
    const origArrive = this.playerMovement.onArrive;
    this.playerMovement.onArrive = () => {
      this.playerMovement.onArrive = origArrive;
      const bd = obj.def.becomesDoor;
      this.roomManager.transitionTo({ targetRoom: bd.targetRoom, targetX: bd.targetX, targetY: bd.targetY });
    };
    return true;
  }

  objectHitTest(x, y) {
    const hits = this.roomManager.roomObjects.filter((o) => {
      const dx = o.go.x - x;
      const dy = o.go.y - y;
      if (o.def.type === 'rect') {
        return Math.abs(dx) <= o.def.width / 2 && Math.abs(dy) <= o.def.height / 2;
      }
      return Math.sqrt(dx * dx + dy * dy) <= o.def.radius;
    });
    if (!hits.length) return false;

    const obj = hits.sort((a, b) => {
      if (a.def.pickup && !b.def.pickup) return -1;
      if (!a.def.pickup && b.def.pickup) return 1;
      const aArea = a.def.type === 'rect' ? a.def.width * a.def.height : a.def.radius * a.def.radius;
      const bArea = b.def.type === 'rect' ? b.def.width * b.def.height : b.def.radius * b.def.radius;
      return aArea - bArea;
    })[0];

    if (this.combineMode) {
      const source = this.combineMode.sourceItem;
      this.combineMode = null;
      this.playerMovement.moveTo(obj.go.x, obj.go.y);
      const origArrive = this.playerMovement.onArrive;
      this.playerMovement.onArrive = () => {
        this.playerMovement.onArrive = origArrive;
        const result = this.resolveCombineResult(obj.def, source);
        if (result.setState) {
          this.setObjState(result.setStateTarget, result.setState);
        }
        this.showMessage(result.message);

        if (obj.def.becomesDoor) {
          const conds = obj.def.becomesDoor.requiresState || [];
          if (conds.every((c) => (this.worldState[c.id] || null) === c.state)) {
            this.worldState[obj.def.id + '_doorOpen'] = true;
            if (obj.def.becomesDoor.openColor) {
              obj.go.setFillStyle(parseInt(obj.def.becomesDoor.openColor));
            }
            if (obj.def.becomesDoor.openLookMessage) {
              obj.def.lookMessage = obj.def.becomesDoor.openLookMessage;
            }
            this.showMessage(obj.def.becomesDoor.message);
          }
        }
      };
      return true;
    }

    this.playerMovement.moveTo(obj.go.x, obj.go.y);
    const origArrive = this.playerMovement.onArrive;
    this.playerMovement.onArrive = () => {
      this.playerMovement.onArrive = origArrive;
      this.actionMenu.open(obj.go.x, obj.go.y, obj.def, 'scene');
    };
    return true;
  }

  showMessage(text) {
    this.messageText.setText(text);
    this.messageText.setPosition(this.scale.width / 2, this.scale.height - this.inventory.barHeight - 16);
    this.messageText.setVisible(true);
    if (this.msgTimer) this.msgTimer.remove();
    this.msgTimer = this.time.delayedCall(4000, () => {
      this.messageText.setVisible(false);
    });
  }

  update(time, delta) {
    if (this.playerMovement) {
      this.playerMovement.update(time, delta);

      if (this.playerMovement.isMoving) {
        if (this.player.anims.currentAnim?.key !== 'walk') {
          this.player.play('walk');
        }
        if (this.playerMovement.target) {
          this.player.setFlipX(this.playerMovement.target.x >= this.player.x);
        }
      } else {
        if (this.player.anims.currentAnim?.key !== 'idle') {
          this.player.play('idle');
        }
      }
    }
  }
}
