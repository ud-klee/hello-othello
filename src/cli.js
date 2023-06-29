import fs from 'fs'
import { Board, BruteForceEngine, MonteCarloTreeSearchEngine } from './othello.js'

const config = {
  'b': {
    engine: new BruteForceEngine(4),
  },
  'w': {
    engine: new MonteCarloTreeSearchEngine('https://othello-mcts.ring0.hk', 4),
    // engine: new BruteForceEngine(4),
  },
}

async function main() {
  const board = new Board();
  const [,, file] = process.argv;
  let replay = null;

  if (file) {
    replay = JSON.parse(fs.readFileSync(file, 'utf8'));
  }

  const history = []

  async function *bot() {
    while (true) {
      const { engine } = config[board.nextPiece];
      const nextMoves = await engine.findNextMove(board.copy());
      if (nextMoves.length > 0) {
        yield nextMoves[0];
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
      } else {
        throw new Error('Failed to save results: file already exists')
      }
    }  
  }

  function onAfterMove(move) {
    history.push(move);
  }

  await board.replay({
    source: replay ?? bot(),
    printBoard: true, //!!replay,
    onEnd,
    onAfterMove,
  });
}

main()
