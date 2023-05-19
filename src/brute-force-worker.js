importScripts('./lib.js')

const OpenWeights = [
  [20,-2,5,5,5,5,-2,20],
  [-2,-2,1,1,1,1,-2,-2],
  [ 5, 1,1,1,1,1, 1, 5],
  [ 5, 1,1,1,1,1, 1, 5],
  [ 5, 1,1,1,1,1, 1, 5],
  [ 5, 1,1,1,1,1, 1, 5],
  [-2,-2,1,1,1,1,-2,-2],
  [20,-2,5,5,5,5,-2,20],
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
  const gameTree = {}
  const flippables = analyze(new Board(board), maxDepth, gameTree)

  self.postMessage({
    result: flippables.map(({ x, y, flippables }) => ({ x, y, flippables })),
    tree: gameTree,
  })
}

let searchCount;

function analyze(board, maxDepth = 1, root) {
  searchCount = 0;
  console.time('analyze')
  const candidates = _analyzeRecursive(board, maxDepth, root)
  console.timeEnd('analyze')
  console.debug(`searchCount`, searchCount);
  const best = candidates.reduce((score, c) => Math.max(score, c.score), -Infinity);
  console.debug(`best`, best);
  console.debug(`candidates`, candidates.map(({ score, flippable }) => {
    const { x, y } = flippable
    return {
      x, y, score,
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

function _analyzeRecursive(board, maxDepth, node, depth = 1) {
  searchCount++;
  let weights;
  if (board.totalScore <= 32) {
    weights = OpenWeights;
  } else {
    weights = MidGameWeights;
  }
  const candidates = board.search().map(f => {
    const score = weights[f.y][f.x] + f.length
    return {
      score,
      flippable: f,
      finalize(best, worst) {
        if (best < 0 && worst < 0) {
          this.score = Math.min(best, worst);
        } else if (best > 0 && worst > 0) {
          this.score =  Math.max(best, worst);
        } else {
          this.score =  best + worst;
        }
      },
    }
  })
  // const best = candidates.reduce((score, c) => Math.max(score, c.score), -Infinity);
  // const label = `analyze[${depth}/${maxDepth}]: c=${candidates.length} b=${best}`;
  node.gains = candidates.map(({ score }) => score);
  // node.best = best;
  node.children = []
  // console.group(label);
  for (const cand of candidates) {
    const { x, y } = cand.flippable;
    // flip and analyze the next move
    if (depth < maxDepth) {
      cand.flippable.flip();
      const child = {};
      let nextCandidates = _analyzeRecursive(board, maxDepth, child, depth + 1);
      node.children.push(child);
      if (nextCandidates.length > 0) {
        nextCandidates.forEach(c => {
          c.score = cand.score - c.score;
        })
        nextCandidates.sort((a, b) => b.score - a.score);
        child.best = nextCandidates[0].score;
        child.worst = nextCandidates[nextCandidates.length - 1].score;
        cand.finalize(child.best, child.worst);
        // const oldScore = f.score;
        // f.score += nextCandidates[0].score;
        // console.debug(`(%d, %d) = %d -> %d`, x, y, oldScore, f.score);
      }
      board.undo();
    } else {
      // console.debug(`(%d, %d) = %d`, x, y, f.score);
    }
  }
  node.scores = candidates.map(({ score }) => score);
  // console.groupEnd(label);
  return candidates
}
