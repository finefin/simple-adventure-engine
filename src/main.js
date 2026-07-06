const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: document.body,
  backgroundColor: '#000000',
  scene: [BootScene, GameScene],
};

const game = new Phaser.Game(config);
