import { Board, analyze } from './othello';

globalThis.onmessage = function (e) {
  const { board, maxDepth } = e.data
  const gameTree = {}
  const flippables = analyze(new Board(board), maxDepth, gameTree)

  globalThis.postMessage({
    result: flippables.map(({ x, y, flippables }) => ({ x, y, flippables })),
    tree: gameTree,
  })
}
