import * as othello from './othello.js';

const { $, $$ } = othello;

const BOT_LEVEL = 4;  // 1 (fast) - 4 (slower)

export const board = new othello.Board(sessionStorage.getItem('board'));

const engine = new othello.OthelloEngine('./worker.min.js?v=a1ab5d53');
export const whiteBot = new othello.Bot(board, 'w', engine, BOT_LEVEL, false);
export const blackBot = new othello.Bot(board, 'b', engine, BOT_LEVEL - 1, false);

export async function replay(gameId = 0, maxTurns = 99) {
  if (maxTurns < 2) {
    return
  }

  const gameIndex = await gameIndexFuture;
  const gameFile = gameIndex[gameId];
  const gameHistory = await fetch(`replay/games/${gameFile}`).then(res => res.json());

  maxTurns = Math.min(maxTurns, gameHistory.length - 1);

  if (maxTurns % 2 == 1) {
    maxTurns++
  }

  board.reset()
  whiteBot.sleep();

  gameHistory.length = maxTurns;
  await board.replay({
    source: gameHistory,
    delay: 300,
  })

  whiteBot.wakeup();
}

const gameIndexFuture = fetch('replay/games-index.json').then(res => res.json())

function main() {
  const canvas = $('#canvas');
  const view = new othello.BoardView(canvas, board);

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

  board.on('reset', () => {
    refreshUI();
    $('#auto input').checked = false;
    blackBot.sleep();
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
    engine.analyze(board, 2).then(flippables => {
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
      board.reset()
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

  $('#auto input').addEventListener('change', e => {
    if (e.target.checked) {
      blackBot.wakeup();
    } else {
      blackBot.sleep();
    }
  })

  window.addEventListener('visibilitychange', () => {
    sessionStorage.setItem('board', board.serialize());
  })

  refreshUI();

  function botThinking(t) {
    view.setCursorStyle(t ? 'progress' : 'auto');
    $$('#controls button').forEach(e => e.disabled = t);
  }

  whiteBot.on('thinkstart', () => botThinking(true));
  whiteBot.on('thinkend', () => botThinking(false));
  whiteBot.play();

  blackBot.on('thinkstart', () => botThinking(true));
  blackBot.on('thinkend', () => botThinking(false));
  blackBot.play();
  blackBot.sleep();
}

document.addEventListener('DOMContentLoaded', main);
