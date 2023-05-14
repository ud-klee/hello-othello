importScripts('./lib.js')

const OpenWeights = [
  [10,-2,5,5,5,5,-2,10],
  [-2,-2,1,1,1,1,-2,-2],
  [ 5, 1,1,1,1,1, 1, 5],
  [ 5, 1,1,1,1,1, 1, 5],
  [ 5, 1,1,1,1,1, 1, 5],
  [ 5, 1,1,1,1,1, 1, 5],
  [-2,-2,1,1,1,1,-2,-2],
  [10,-2,5,5,5,5,-2,10],
];

const MidGameWeights = [
  [ 5,-1,3,3,3,3,-1, 5],
  [-1,-1,1,1,1,1,-1,-1],
  [ 3, 1,1,1,1,1, 1, 3],
  [ 3, 1,1,1,1,1, 1, 3],
  [ 3, 1,1,1,1,1, 1, 3],
  [ 3, 1,1,1,1,1, 1, 3],
  [-1,-1,1,1,1,1,-1,-1],
  [ 5,-1,3,3,3,3,-1, 5],
];

self.onmessage = function (e) {
  const { board, maxDepth } = e.data

  const flippables = analyze(new Board(board), maxDepth)

  self.postMessage(flippables.map(({ x, y, flippables }) => ({ x, y, flippables })))
}

let searchCount;

function analyze(board, maxDepth = 1) {
  searchCount = 0;
  console.time('analyze')
  const candidates = _analyzeRecursive(board, maxDepth)
  console.timeEnd('analyze')
  console.debug(`searchCount`, searchCount);
  const best = candidates.reduce((score, c) => Math.max(score, c.score), -Infinity);
  console.debug(`best`, best);
  console.debug(`candidates`, candidates.map(({ score, flippable }) => {
    const { x, y } = flippable
    return {
      move: [ x, y ],
      score,
    }
  }))
  // keep the best ones and shuffle
  return candidates
    .filter(f => f.score === best)
    .sort(() => Math.random() - 0.5)
    .map(f => {
      return f.flippable
    })
}

function _analyzeRecursive(board, maxDepth, depth = 1) {
  searchCount++;
  let weights;
  if (board.totalScore <= 32) {
    weights = OpenWeights;
  } else {
    weights = MidGameWeights;
  }
  const candidates = board.search().map(f => {
    // score is negated at alternating depths
    const score = (weights[f.y][f.x] + f.length) * (depth % 2 === 0 ? -1 : 1)
    return { score, flippable: f }
  })
  const label = `analyze[${depth}/${maxDepth}]: candidates=${candidates.length}`;
  console.group(label);
  // stop early if there is only one candidate
  if (candidates.length > 1) {
    for (const f of candidates) {
      const { x, y } = f.flippable;
      // flip and analyze the next move
      if (depth < maxDepth) {
        f.flippable.flip();
        const nextCandidates = _analyzeRecursive(board, maxDepth, depth + 1);
        if (nextCandidates.length > 0) {
          // sort by absolute score to find the next best move
          nextCandidates.sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
          const oldScore = f.score;
          f.score += nextCandidates[0].score;
          console.debug(`(%d, %d) = %d -> %d`, x, y, oldScore, f.score);
        }
        board.undo();
      } else {
        console.debug(`(%d, %d) = %d`, x, y, f.score);
      }
    }
  }
  console.groupEnd(label);
  return candidates
}
