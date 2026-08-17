(function () {
  const v = typeof window.AE_VER !== 'undefined' ? '?v=' + window.AE_VER : '';
  const worldFile = (typeof SELECTED_WORLD !== 'undefined' && SELECTED_WORLD
    ? 'data/' + SELECTED_WORLD : 'data/demo.json') + v;

  function createGame(ww, wh) {
    const config = {
      type: Phaser.AUTO,
      scale: {
        mode: Phaser.Scale.FIT
      },
      width: ww,
      height: wh,
      parent: 'gameContainer',
      backgroundColor: '#000000',
      scene: [BootScene, GameScene],
      pixelArt: true,
      roundPixels: true
    };
    new Phaser.Game(config);
  }

  fetch(worldFile)
    .then(r => r.json())
    .then(worldData => {
      window.AE_AVATAR = worldData.avatar || 'char1';
      createGame((worldData && worldData.worldWidth) || 800, (worldData && worldData.worldHeight) || 600);
    })
    .catch(() => {
      window.AE_AVATAR = 'char1';
      createGame(800, 600);
    });
})();
