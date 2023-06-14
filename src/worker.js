import { Board, analyze } from './othello.js';
import * as keras from './keras.js';

globalThis.importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@latest/dist/tf.min.js')

keras.init(tf, 'webgl', 'models/othello_cnn_2000');

globalThis.onmessage = function (e) {
  const { board, maxDepth, useNN } = e.data
  const gameTree = {}
  analyze(new Board(board), maxDepth, useNN, gameTree).then(flippables => {
    globalThis.postMessage({
      result: flippables.map(({ x, y, flippables }) => ({ x, y, flippables })),
      tree: gameTree,
    })
  })
}
