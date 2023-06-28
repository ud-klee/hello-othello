import { Board, BruteForceEngine } from './othello.js';

let engine = new BruteForceEngine();

globalThis.onmessage = function (e) {
  const { board, level } = e.data
  const gameTree = {}
  engine.findNextMove(new Board(board), level, gameTree).then(flippables => {
    globalThis.postMessage({
      result: flippables.map(({ x, y, flippables }) => ({ x, y, flippables })),
      tree: gameTree,
    })
  })
}
