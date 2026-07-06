class DialogUI {
  constructor(scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(400);
    this.container.setVisible(false);
    this.isOpen = false;
    this.currentTree = null;
    this.currentNodeId = null;
    this.onClose = null;
  }

  open(tree, startNode, onClose) {
    this.currentTree = tree;
    this.currentNodeId = startNode || 'start';
    this.onClose = onClose || null;
    this.renderNode();
    this.isOpen = true;
    this.container.setVisible(true);
  }

  renderNode() {
    this.container.removeAll(true);

    const node = this.currentTree[this.currentNodeId];
    if (!node) {
      this.close();
      return;
    }

    const w = this.scene.scale.width;
    const padX = 30;
    const boxW = w - padX * 2;
    const textY = this.scene.scale.height - 220;
    const boxH = 200;

    const bg = this.scene.add.rectangle(w / 2, textY + boxH / 2, boxW, boxH, 0x0a0a1a, 0.95);
    bg.setStrokeStyle(2, 0x444477);
    this.container.add(bg);

    const npcText = this.scene.add.text(w / 2, textY + 16, node.text, {
      fontSize: '14px',
      color: '#ddddee',
      fontFamily: 'monospace',
      wordWrap: { width: boxW - 40 },
      lineSpacing: 4,
    }).setOrigin(0.5, 0);
    this.container.add(npcText);

    if (node.options) {
      node.options.forEach((opt, i) => {
        const oy = textY + 90 + i * 32;
        const optBg = this.scene.add.rectangle(w / 2, oy + 10, boxW - 40, 26, 0x222233, 1);
        optBg.setStrokeStyle(1, 0x555577);
        optBg.setInteractive({ useHandCursor: true });
        this.container.add(optBg);

        const optText = this.scene.add.text(w / 2, oy, '> ' + opt.text, {
          fontSize: '13px',
          color: '#aabbcc',
          fontFamily: 'monospace',
        }).setOrigin(0.5, 0);
        this.container.add(optText);

        optBg.on('pointerover', () => {
          optBg.setFillStyle(0x333355);
          optText.setColor('#ffffff');
        });
        optBg.on('pointerout', () => {
          optBg.setFillStyle(0x222233);
          optText.setColor('#aabbcc');
        });
        optBg.on('pointerdown', (pointer) => {
          pointer.event.stopPropagation();
          if (opt.next === null || opt.next === undefined) {
            this.close();
          } else {
            this.currentNodeId = opt.next;
            this.renderNode();
          }
        });
      });
    }
  }

  close() {
    this.container.setVisible(false);
    this.container.removeAll(true);
    this.isOpen = false;
    this.currentTree = null;
    this.currentNodeId = null;
    if (this.onClose) {
      this.onClose();
      this.onClose = null;
    }
  }

  destroy() {
    this.close();
    this.container.destroy();
  }
}
