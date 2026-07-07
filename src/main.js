const config = {
  type: Phaser.AUTO,
  scale: {
    mode: Phaser.Scale.FIT},
  width: 800,
  height: 600,
  parent: document.body,
  backgroundColor: '#000000',
  scene: [BootScene, GameScene],
  pixelArt: true, 
  roundPixels: true 
};

const game = new Phaser.Game(config);
