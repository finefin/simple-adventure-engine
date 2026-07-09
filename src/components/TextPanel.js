class TextPanel {
  constructor(scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(500);
    this.container.setVisible(false);
    this.isOpen = false;
  }

  open(text) {
    this.container.removeAll(true);

    const w = this.scene.scale.width;
    const h = this.scene.scale.height;

    const overlay = this.scene.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.8);
    overlay.setInteractive();
    this.container.add(overlay);

    const padX = 60;
    const padY = 100;
    const panelW = w - padX * 2;
    const panelH = h - padY * 2;

    const panel = this.scene.add.rectangle(w / 2, h / 2, panelW, panelH, 0x0a0a1a, 0.95);
    panel.setStrokeStyle(2, 0x666688);
    this.container.add(panel);

    const textObj = this.scene.add.text(w / 2, h / 2, text, {
      fontSize: '24px',
      color: '#ddddee',
      fontFamily: 'monospace',
      wordWrap: { width: panelW - 60 },
      lineSpacing: 6,
      align: 'center',
    }).setOrigin(0.5);
    this.container.add(textObj);

    overlay.on('pointerdown', () => {
      this.close();
    });

    this.container.setVisible(true);
    this.isOpen = true;
  }

  close() {
    this.container.setVisible(false);
    this.container.removeAll(true);
    this.isOpen = false;
  }

  destroy() {
    this.close();
    this.container.destroy();
  }
}
