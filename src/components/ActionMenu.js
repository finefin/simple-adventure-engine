class ActionMenu {
  constructor(scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(300);
    this.container.setVisible(false);
    this.isOpen = false;
    this.target = null;
    this.targetType = null;
    this.bg = null;
  }

  open(x, y, target, targetType) {
    this.close();
    this.target = target;
    this.targetType = targetType;

    const defs = [
      { key: 'examine', label: 'Examine', defaultAction: true },
      { key: 'take', label: 'Take', requires: 'pickup', skipInventory: true },
      { key: 'open', label: 'Open', requires: 'open' },
      { key: 'talk', label: 'Talk', requires: 'talk' },
      { key: 'use', label: 'Use', defaultAction: true },
    ];

    if (targetType === 'inventory') {
      defs.push({ key: 'useWith', label: 'Use with...', defaultAction: true });
    }

    const verbs = defs.filter((d) => {
      if (d.skipInventory && targetType === 'inventory') return false;
      if (d.requires) {
        if (d.requires === 'pickup') return target.pickup;
        const msg = this.scene.getObjMessage(target, d.requires);
        return msg !== undefined && msg !== null;
      }
      return d.defaultAction;
    });

    if (!verbs.length) return;

    const px = Phaser.Math.Clamp(x, 80, this.scene.scale.width - 80);
    const py = Phaser.Math.Clamp(y - 20, 40, this.scene.scale.height - 120);

    const btnH = 26;
    const gap = 2;
    const totalH = verbs.length * (btnH + gap) - gap;

    const maxW = Math.max(...verbs.map((v) => v.label.length)) * 9 + 32;

    this.bg = this.scene.add.rectangle(px, py + totalH / 2, maxW + 16, totalH + 12, 0x111122, 0.9);
    this.bg.setStrokeStyle(1, 0x666688);
    this.container.add(this.bg);

    verbs.forEach((verb, i) => {
      const by = py + i * (btnH + gap);
      const text = this.scene.add.text(px, by, '  ' + verb.label, {
        fontSize: '13px', color: '#ddddee', fontFamily: 'monospace',
        backgroundColor: '#222233',
        padding: { x: 8, y: 3 },
      }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });

      text.on('pointerover', () => text.setStyle({ backgroundColor: '#444466' }));
      text.on('pointerout', () => text.setStyle({ backgroundColor: '#222233' }));
      text.on('pointerdown', (pointer) => {
        pointer.event.stopPropagation();
        this.executeVerb(verb.key, target, targetType);
      });

      this.container.add(text);
    });

    this.container.setVisible(true);
    this.isOpen = true;
  }

  executeVerb(key, target, targetType) {
    const scene = this.scene;

    if (key === 'examine') {
      scene.showMessage(scene.getObjMessage(target, 'look') || 'Nothing special.');
      if (target.examineReveals) {
        target.examineReveals.forEach((childId) => {
          const childDef = scene.roomManager.currentRoomData.objects.find((o) => o.id === childId);
          if (childDef) {
            scene.worldState[childDef.id + '_revealed'] = true;
            scene.roomManager.revealObjectById(childDef);
          }
        });
      }
      return;
    }

    if (key === 'take') {
      scene.roomManager.removeRoomObjectByDef(target);
      scene.inventory.addItem(target);
      scene.showMessage('Picked up ' + target.label + '.');
      return;
    }

    if (key === 'open') {
      scene.showMessage(scene.getObjMessage(target, 'open') || 'It won\'t open.');
      if (target.openSetsState) {
        scene.setObjState(target, target.openSetsState);
      }
      if (target.becomesDoor) {
        scene.worldState[target.id + '_doorOpen'] = true;
      }
      return;
    }

    if (key === 'talk') {
      if (target.dialogTree) {
        scene.dialogUI.open(target.dialogTree, target.dialogStart || 'start');
      } else {
        scene.showMessage(scene.getObjMessage(target, 'talk') || 'Nobody here.');
      }
      return;
    }

    if (key === 'use') {
      scene.showMessage(scene.getObjMessage(target, 'use') || 'Nothing happens.');
      return;
    }

    if (key === 'useWith') {
      scene.combineMode = { sourceItem: target };
      scene.showMessage('Use ' + target.label + ' with...?');
      return;
    }
  }

  close() {
    this.container.removeAll(true);
    this.container.setVisible(false);
    this.isOpen = false;
    this.target = null;
    this.targetType = null;
    this.bg = null;
  }

  destroy() {
    this.close();
    this.container.destroy();
  }
}
