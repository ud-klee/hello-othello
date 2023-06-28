import { Board, analyze } from './othello.js';

globalThis.onmessage = function (e) {
  const { board, maxDepth } = e.data
  const gameTree = {}
  analyze(new Board(board), maxDepth, gameTree).then(flippables => {
    globalThis.postMessage({
      result: flippables.map(({ x, y, flippables }) => ({ x, y, flippables })),
      tree: gameTree,
    })
  })
}
