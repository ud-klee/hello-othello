import { Board, BruteForceEngine } from './othello.js';

let engine;

globalThis.onmessage = function (e) {
  const { board, level } = e.data
  const gameTree = {}

  if (!engine) {
    engine = new BruteForceEngine(level)
  }

  engine.findNextMove(new Board(board), gameTree).then(nextMoves => {
    globalThis.postMessage({
      nextMoves,
      tree: gameTree,
    })
  })
}
