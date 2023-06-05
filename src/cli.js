import fs from 'fs'
import { Board, Flippable, analyze } from './othello.js'

const searchDepth = {
  'b': 4,
  'w': 4,
}

function main() {
  const board = new Board();
  const [,, file] = process.argv;
  let replay = null;

  if (file) {
    replay = JSON.parse(fs.readFileSync(file, 'utf8'));
  }

  const history = []
  const trainingData = []

  function *bot() {
    while (true) {
      const result = analyze(board.copy(), searchDepth[board.nextPiece]);
      if (result.length > 0) {
        const { x, y } = result[0];
        yield [x, y];
      } else {
        yield null;
      }
    }
  }

  function onEnd(result) {
    let subdir = 'draw'

    if (result == 0) { subdir = 'lose' }
    if (result == 1) { subdir = 'win' }

    if (!replay) {
      const now = Date.now();
      const dedup = Math.round(Math.random() * 1000);
      const filename = `${now}_${board.score.b}v${board.score.w}_${dedup}.json`;
      if (!fs.existsSync(`games/${filename}`)) {
        fs.writeFileSync(`games/${filename}`, JSON.stringify(history));
        fs.writeFileSync(`training/${subdir}/${filename}`, JSON.stringify(trainingData));
      } else {
        throw new Error('Failed to save results: file already exists')
      }
    }  
  }

  function onBeforeMove(move, who) {
    if (move != null) {
      const encoding = encodeBoard(board);
      trainingData.push([encoding, move, who]);
    }
  }

  function onAfterMove(move) {
    history.push(move);
  }

  function print(str) {
    console.info(str)
  }

  board.replay({
    source: replay ? replay.values() : bot(),
    printBoard: !!replay,
    print,
    onEnd,
    onBeforeMove,
    onAfterMove,
  });
}

function encodeBoard(board) {
  const encoding = [] 
  for (let y = 0; y < board.height; y++) {
    let blackBits = 0;
    let whiteBits = 0;
    for (let x = 0; x < board.width; x++) {
      const piece = board.grid[y][x];
      if (piece == 'b') {
        blackBits |= 1 << (7 - x);
      }
      if (piece == 'w') {
        whiteBits |= 1 << (7 - x);
      }
    }
    encoding.push(blackBits << 8 | whiteBits);
  }
  return encoding
}

main()