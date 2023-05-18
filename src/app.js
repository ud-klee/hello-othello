
const $ = (path, parent = document) => parent.querySelector(path);
const $$ = (path, parent = document) => parent.querySelectorAll(path)

const BOT_LEVEL = 3;  // 1 (easy) - 4 (hard)

function main() {
  const canvas = $('#canvas');
  const board = new Board(sessionStorage.getItem('board'));
  const view = new BoardView(canvas, board);
  const finder = new BruteForceFinder();

  let [px, py] = [-1, -1]
  let flippable = null;

  function getCursorXY({ clientX, clientY }) {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(board.width * (clientX - rect.left) / rect.width);
    const y = Math.floor(board.height * (clientY - rect.top) / rect.height);
    return [x, y];
  }

  function updateScore() {
    $(`#info .player-b .score`).innerHTML = board.score['b'];
    $(`#info .player-w .score`).innerHTML = board.score['w'];
  }

  function updatePlayer() {
    $$(`#info .player`).forEach(e => e.classList.remove('current'));
    $(`#info .player-${board.nextPiece}`).classList.add('current');
  }

  function handlePreview(e) {
    if (board.nextPiece !== 'b') return

    const [x, y] = getCursorXY(e);
    if (x == px && y == py) return;
    [px, py] = [x, y];

    flippable = null;
    view.clearUI();

    if (!board.isEmpty(x, y)) {
      view.setCursorStyle('not-allowed');
      return
    }
    view.setCursorStyle('auto');

    flippable = board.getFlippable(x, y);
    if (flippable.length == 0) {
      view.setCursorStyle('not-allowed');
      return
    }

    view.previewFlippable(flippable)
  }

  function handleFlip(e) {
    if (board.nextPiece !== 'b') return
    if (flippable && flippable.length > 0) {
      view.clearUI();
      flippable.flip()
      flippable = null;
    }
  }

  function refreshUI() {
    view.clearUI();
    view.repaint();
    updateScore();
    updatePlayer();
  }

  function newGame() {
    board.reset();
    refreshUI();
  }

  canvas.oncontextmenu = () => false
  canvas.addEventListener('pointerup', handleFlip)
  canvas.addEventListener('pointermove', handlePreview)
  canvas.addEventListener('pointerdown', handlePreview)
  canvas.addEventListener('pointercancel', () => {
    view.clearUI();
    flippable = null;
  })

  board.on('turnChange', () => {
    updatePlayer()
  })

  board.on('set', () => {
    updateScore()
  })

  board.on('end', () => {
    setTimeout(() => {
      if (board.score['b'] > board.score['w']) {
        alert('Black wins!')
      }
      if (board.score['b'] < board.score['w']) {
        alert('White wins!')
      }
      if (board.score['b'] == board.score['w']) {
        alert('Draw!')
      }
    }, 300)
  })

  $('#controls .pass').addEventListener('click', e => {
    finder.analyze(board, 2).then(flippables => {
      if (flippables.length > 0) {
        alert(`Don't pass yet! You can flip here!`)
        view.clearUI();
        view.previewFlippable(flippables[0])
      } else {
        board.pass();
      }
    })
  })

  $('#controls .new').addEventListener('click', e => {
    if (confirm('Start a new game?')) {
      newGame();
    }
  })

  $('#controls .undo').addEventListener('click', e => {
    if (board.undoable()) {
      board.undo();
      board.undo();
      [px, py] = [-1, -1];
      view.clearUI();
    } else {
      alert('Nothing to undo!')
    }
  })

  window.addEventListener('visibilitychange', () => {
    sessionStorage.setItem('board', board.serialize());
  })

  refreshUI();
  // console.debug(board)

  const bot = new Bot(board, 'w', finder, BOT_LEVEL);
  bot.on('thinkstart', () => {
    view.setCursorStyle('progress');
    $$('#controls button').forEach(e => e.disabled = true);
  });
  bot.on('thinkend', () => {
    view.setCursorStyle('auto');
    $$('#controls button').forEach(e => e.disabled = false);
  });
  bot.play();
}

document.addEventListener('DOMContentLoaded', main);
