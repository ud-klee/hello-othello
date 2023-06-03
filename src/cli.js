import fs from 'fs'
import { Board, Flippable, analyze } from './othello.js'

const searchDepth = {
  'b': 3,
  'w': 4,
}

function main() {
  const board = new Board();
  let ended = false;
  let turn = 1;

  const [,,file] = process.argv;
  let replay = null;

  if (file) {
    replay = JSON.parse(fs.readFileSync(file, 'utf8'));
  }

  board.on('end', () => {
    ended = true;
  });

  const history = []
  const trainingData = []

  while (!ended) {
    let flippable = null;

    if (replay) {
      const nextMove = replay.shift();

      if (nextMove === undefined) {
        console.warn(`No more moves in replay file`);
        return;
      }

      if (nextMove !== null) {
        const [ x, y ] = nextMove;
        flippable = board.getFlippable(x, y);

        if (flippable.length === 0) {
          console.warn(`Invalid move: ${nextMove}`);
          return;
        }
      } else {
        const candidates = board.search()

        if (candidates.length > 0) {
          console.warn(`Invalid move: pass`);
          return;
        }
      }

    } else {
      const result = analyze(board.copy(), searchDepth[board.nextPiece]);
      if (result.length > 0) {
        const { x, y, flippables } = result[0];
        flippable = new Flippable(board, x, y, flippables)
      }
    }

    if (flippable) {
      const { x, y } = flippable;
      console.info(`Turn ${turn}: ${board.nextPiece} plays (${x}, ${y})`);
      const encoding = encodeBoard(board);
      trainingData.push([encoding, [x, y], board.turn]);
      flippable.flip();
      if (replay) {
        printBoard(board, x, y);
      }
      history.push([x, y]);
    } else {
      console.info(`Turn ${turn}: ${board.nextPiece} passes`);
      board.pass();
      history.push(null);
    }

    turn++;
  }

  const score = board.score;
  let result = 'draw';
  if (score.b > score.w) {
    result = 'lose';
  }
  if (score.w > score.b) {
    result = 'win';
  }

  if (result === 'lose') {
    console.info('Black wins! Score:', score)
  }
  if (result === 'win') {
    console.info('White wins! Score:', score)
  }
  if (result === 'draw') {
    console.info('Draw! Score:', score)
  }

  if (!replay) {
    let retry = 5;
    while (retry > 0) {
      const now = Date.now();
      const dedup = Math.round(Math.random() * 1000);
      const filename = `${now}_${score.b}v${score.w}_${dedup}.json`;
      if (!fs.existsSync(`games/${filename}`)) {
        fs.writeFileSync(`games/${filename}`, JSON.stringify(history));
        fs.writeFileSync(`training/${result}/${filename}`, JSON.stringify(trainingData));
        break;
      }
      retry--;
      if (retry == 0) {
        console.error(`Failed to save game ${filename} after 5 retries`);
      }
    }
  }
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

function printBoard(board, mx, my) {
  console.info('┌' + '─'.repeat(board.width * 2 + 1) + '┐');
  for (let y = 0; y < board.height; y++) {
    let row = '│';
    // let blackBits = 0;
    // let whiteBits = 0;
    for (let x = 0; x < board.width; x++) {
      const piece = board.grid[y][x];
      if (mx === x && my === y) {
        row += '▸';
      } else {
        row += ' ';
      }
      if (piece == 'b') {
        row += '●';
        // blackBits |= 1 << (7 - x);
      }
      if (piece == 'w') {
        row += '○';
        // whiteBits |= 1 << (7 - x);
      }
      if (!piece) {
        row += '‧';
      }
    }
    // const bits = Buffer.from([blackBits, whiteBits]).toString('hex');
    // console.info('%s %s', row + ' │', bits.padStart(4, '0'));
    console.info(row + ' │');
  }
  console.info('└' + '─'.repeat(board.width * 2 + 1) + '┘');
}

main()
