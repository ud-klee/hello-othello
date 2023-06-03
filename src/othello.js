import EventEmitter from 'events';

export const $ = (path, parent = document) => parent.querySelector(path);
export const $$ = (path, parent = document) => parent.querySelectorAll(path);

export class Board extends EventEmitter {
  constructor(json) {
    super();
    this.reset();
    if (json) this.restore(json);
  }
  get width() { return 8 }
  get height() { return 8 }
  get pieces() { return 'bw' }
  get nextPiece() {
    return this.pieces[this.turn];
  }
  get totalScore() {
    return this.score['b'] + this.score['w'];
  }
  serialize() {
    return JSON.stringify({
      grid: this.grid,
      score: this.score,
      turn: this.turn,
      passCount: this.passCount,
    })
  }
  restore(json) {
    const data = JSON.parse(json);
    this.grid = data.grid;
    this.score = data.score;
    this.turn = data.turn;
    this.passCount = data.passCount;
  }
  copy() {
    const board = new Board();
    board.grid = this.grid.map(row => row.slice());
    board.score = { ...this.score };
    board.turn = this.turn;
    board.passCount = this.passCount;
    return board;
  }
  reset() {
    this.grid = [];
    for (let y = 0; y < this.height; y++) {
      this.grid[y] = [];
      for (let x = 0; x < this.width; x++) {
        this.grid[y][x] = null;
      }
    }
    this.grid[3][3] = 'w';
    this.grid[4][4] = 'w';
    this.grid[3][4] = 'b';
    this.grid[4][3] = 'b';
    this.score = { b: 2, w: 2 }
    this.turn = 0
    this.passCount = 0
    this.undoStack = []
  }
  search() {
    const dir = [[-1,-1], [0,-1], [1,-1], [-1,0], [1,0], [-1,1], [0,1], [1,1]];
    const candidates = new Map()

    // look for empty cells next to the opponent's pieces
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (!this.isEmpty(x, y) && this.grid[y][x] !== this.nextPiece) {
          for (let i = 0; i < dir.length; i++) {
            const [ dx, dy ] = dir[i];
            const [ nx, ny ] = [ x + dx, y + dy ];
            if (this.inRange(nx, ny) && this.isEmpty(nx, ny)) {
              candidates.set(`${nx},${ny}`, [nx, ny]);
            }
          }
        } 
      }
    }

    return [...candidates.values()]
      .map(([ x, y ]) => this.getFlippable(x, y))
      .filter(f => f.length > 0)
  }
  undo() {
    if (!this.undoable()) return
    const undoable = this.undoStack.pop();
    undoable.undo();
    // console.debug(`Board: undo - undoable=${this.undoStack.length}`)
  }
  undoable() {
    return this.undoStack.length > 0
  }
  pass() {
    if (this.passCount >= 2) return;

    this.passCount++;

    const ended = this.passCount == 2;
    this.nextTurn(ended);

    const undo = () => {
      this.passCount = 0;
      this.nextTurn();
    }

    this.undoStack.push({ undo })

    if (ended) {
      this.emit('end')
    }
  }
  nextTurn(ended = false) {
    this.turn = (this.turn + 1) % 2;
    this.emit('turnChange', ended)
  }
  set(x, y) {
    const piece = this.nextPiece
    this.grid[y][x] = piece;
    this.score[piece]++;
    this.passCount = 0
    this.emit('set', { x, y, piece });

    const ended = this.totalScore == 64
    this.nextTurn(ended);

    if (ended) {
      this.emit('end')
    }
  }
  unset(x, y) {
    const piece = this.grid[y][x];
    this.grid[y][x] = null;
    this.score[piece]--;
    this.emit('set', { x, y });
  }
  flip(x, y) {
    const before = this.grid[y][x];
    if (before == null) return;
    const after = before === 'w' ? 'b' : 'w';
    this.grid[y][x] = after;
    this.score[before]--;
    this.score[after]++;
    this.emit('flip', { x, y, before, after });
  }
  isEmpty(x, y) {
    if (this.inRange(x, y)) {
      return this.grid[y][x] == null;
    }
    return true;
  }
  inRange(x, y) {
    return x >= 0 && x < this.width && y >= 0 && y < this.height
  }
  getFlippable(x, y) {
    const flippable = new Flippable(this, x, y);
    const dir = [[-1,-1], [0,-1], [1,-1], [-1,0], [1,0], [-1,1], [0,1], [1,1]];

    for (let i = 0; i < dir.length; i++) {
      const [dx, dy] = dir[i];
      let [nx, ny] = [x, y];
      let line = []

      while (this.inRange(nx, ny)) {
        [nx, ny] = [nx + dx, ny + dy];
        if (this.isEmpty(nx, ny)) {
          line = [];
          break;
        }
        if (this.grid[ny][nx] === this.nextPiece) break;
        line.push([nx, ny]);
      }

      flippable.add(...line);
    }

    return flippable
  }
}

export class BoardView {
  constructor(canvas, board) {
    this.canvas = canvas;
    this.board = board;
    this.mobileView = true;

    if (window.innerWidth >= 1024) {
      canvas.setAttributeNS(null, 'width', 643);
      canvas.setAttributeNS(null, 'height', 643);
      this.mobileView = false;
    }

    window.addEventListener('resize', () => {
      this.detectViewChange();
    })

    canvas.appendChild(this.svgElem('g', { class: 'board' }))
    canvas.appendChild(this.svgElem('g', { class: 'pieces' }))
    canvas.appendChild(this.svgElem('g', { class: 'ui' }))

    board.on('set', ({ x, y, piece }) => {
      if (piece) {
        this.drawPiece(x, y, piece)
      } else {
        $(`.piece.piece-${x}-${y}`, this.canvas).remove()
      }
    });

    board.on('flip', ({ x, y, before, after }) => {
      const piece = $(`.piece.piece-${x}-${y}`, this.canvas);
      piece.classList.remove('piece-' + before);
      piece.classList.add('piece-' + after);
    })

    this.drawGrid();
  }
  get width() {
    return this.canvas.width.baseVal.value;
  }
  get height() {
    return this.canvas.height.baseVal.value;
  }
  detectViewChange() {
    const currentView = this.mobileView;
    if (window.innerWidth >= 1024 && this.mobileView) {
      canvas.setAttributeNS(null, 'width', 643);
      canvas.setAttributeNS(null, 'height', 643);
      this.mobileView = false;
    }
    if (window.innerWidth < 1024 && !this.mobileView) {
      canvas.setAttributeNS(null, 'width', 323);
      canvas.setAttributeNS(null, 'height', 323);
      this.mobileView = true;
    }
    if (this.mobileView != currentView) {
      this.clearUI();
      this.drawGrid();
      this.repaint();
    }
  }
  clearUI() {
    $('.ui', this.canvas).innerHTML = '';
  }
  previewFlippable(flippable) {
    flippable.forEach(([x, y]) => {
      this.previewPiece(x, y, 'flippable');
    })
    this.previewPiece(flippable.x, flippable.y, `piece-${this.board.nextPiece} piece`);
  }
  previewPiece(x, y, classNames = '') {
    const w = Math.round(this.width / this.board.width);
    const h = Math.round(this.height / this.board.height);
    const layer = $('.ui', this.canvas);
    this.drawCircle(x * w + w * 0.5, y * h + h * 0.5, Math.min(w, h) * 0.4, `preview ${classNames}`, layer);
  }
  setCursorStyle(style) {
    this.canvas.style.cursor = style;
  }
  repaint() {
    $('.pieces', this.canvas).innerHTML = '';
    this.drawPieces();
  }
  drawPieces() {
    for (let y = 0; y < this.board.height; y++) {
      for (let x = 0; x < this.board.width; x++) {
        const piece = this.board.grid[y][x];
        if (piece) {
          this.drawPiece(x, y, piece);
        }
      }
    }
  }
  drawPiece(x, y, piece) {
    const w = Math.round(this.width / this.board.width);
    const h = Math.round(this.height / this.board.height);
    const layer = $('.pieces', this.canvas);
    this.drawCircle(x * w + w * 0.5, y * h + h * 0.5, Math.min(w, h) * 0.4, `piece piece-${piece} piece-${x}-${y}`, layer);
  }
  drawGrid() {
    const w = Math.round(this.width / this.board.width);
    const h = Math.round(this.height / this.board.height);
    const layer = $('.board', this.canvas);
    layer.innerHTML = '';
    for (let x = 1; x < this.board.width; x++) {
      this.drawLine(x * w, 0, x * w, this.height, 'grid-line', layer);
    }
    for (let y = 1; y < this.board.height; y++) {
      this.drawLine(0, y * h, this.width, y * h, 'grid-line', layer);
    }
  }
  drawLine(x1, y1, x2, y2, classNames, layer = this.canvas) {
    const line = this.svgElem('line', { x1, y1, x2, y2, class: classNames });
    layer.appendChild(line);
  }
  drawCircle(x, y, r, classNames, layer = this.canvas) {
    const circle = this.svgElem('circle', { cx: x, cy: y, r, class: classNames });
    layer.appendChild(circle);
  }
  svgElem(name, attrs = {}) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', name);
    Object.entries(attrs).forEach(([k, v]) => el.setAttributeNS(null, k, v));
    return el
  }
}

export class Flippable {
  constructor(board, x, y, flippables = []) {
    this.board = board;
    this.x = x;
    this.y = y;
    this.flippables = flippables;
  }
  get length() {
    return this.flippables.length;
  }
  add(...args) {
    this.flippables.push(...args);
  }
  forEach(fn) {
    this.flippables.forEach(fn);
  }
  flip() {
    this.forEach(([x, y]) => this.board.flip(x, y));
    this.board.set(this.x, this.y);
    this.board.undoStack.push(this)
  }
  undo() {
    this.forEach(([x, y]) => this.board.flip(x, y));
    this.board.unset(this.x, this.y);
    this.board.nextTurn();
  }
}

export class BruteForceFinder {
  constructor(path) {
    this.worker = new Worker(path)
  }
  async analyze(board, maxDepth = 1) {
    return new Promise((resolve) => {
      this.worker.addEventListener('message', e => {
        const result = []
        // console.debug(`gameTree`, e.data.tree)
        for (const { x, y, flippables } of e.data.result) {
          const flippable = new Flippable(board, x, y);
          flippable.add(...flippables);
          result.push(flippable);
        }
        resolve(result);
      }, { once: true })

      this.worker.postMessage({ board: board.serialize(), maxDepth });
    })
  }
}

export class Bot extends EventEmitter {
  constructor(board, piece, finder, level) {
    super();
    this.board = board;
    this.piece = piece;
    this.finder = finder;
    this.level = level;
    this.timer = 0;
    this.sleeping = false;
  }
  get name() {
    return `Bot(${this.piece})`
  }
  say(msg, ...args) {
    const style = 'color: yellow; font-size: 0.8rem;'
    console.info(`%c%s: ${msg}`, style, this.name, ...args)
  }
  sleep() {
    this.sleeping = true;
  }
  wakeup() {
    this.sleeping = false;
    if (this.board.nextPiece === this.piece) {
      this._play();
    }
  }
  _play() {
    this.say(`thinking...`);
    this.emit('thinkstart');
    // adaptively adjust the search depth
    let level = this.level;
    if (this.board.totalScore < 8) {
      level -= 1;
    } else if (this.board.totalScore < 16) {
      // nop
    } else {
      level += 1;
    }
    this.finder.analyze(this.board, Math.max(1, level)).then(flippables => {
      this.emit('thinkend');
      if (flippables.length > 0) {
        const { x, y } = flippables[0];
        this.say(`playing (%d, %d)`, x, y);
        flippables[0].flip();
      } else {
        this.say(`pass :(`);
        this.board.pass();
      }
    })
  }
  play(responseTime = 300) {
    this.board.on('turnChange', ended => {
      if (ended || this.sleeping) return;
      if (this.board.nextPiece === this.piece) {
        this.timer = setTimeout(() => {
          this._play();
        }, responseTime)
      } else {
        this.say(`your turn`);
        clearTimeout(this.timer)
      }
    })

    this.board.on('end', () => {
      if (this.sleeping) return;
      this.say(`good game :)`);
      clearTimeout(this.timer)
    })
  }
}

const OpenWeights = [
  [20,-2,5,5,5,5,-2,20],
  [-2,-5,1,1,1,1,-5,-2],
  [ 5, 1,1,1,1,1, 1, 5],
  [ 5, 1,1,1,1,1, 1, 5],
  [ 5, 1,1,1,1,1, 1, 5],
  [ 5, 1,1,1,1,1, 1, 5],
  [-2,-5,1,1,1,1,-5,-2],
  [20,-2,5,5,5,5,-2,20],
];

const MidGameWeights = [
  [ 9, 0,3,3,3,3, 0, 9],
  [ 0,-2,1,1,1,1,-2, 0],
  [ 3, 1,1,1,1,1, 1, 3],
  [ 3, 1,1,1,1,1, 1, 3],
  [ 3, 1,1,1,1,1, 1, 3],
  [ 3, 1,1,1,1,1, 1, 3],
  [ 0,-2,1,1,1,1,-2, 0],
  [ 9, 0,3,3,3,3, 0, 9],
];

let searchCount;

export function analyze(board, maxDepth = 1, root = {}) {
  searchCount = 0;
  // console.time('analyze')
  const candidates = _analyzeRecursive(board, maxDepth, root)
  // console.timeEnd('analyze')
  const best = candidates.reduce((score, c) => Math.max(score, c.score), -Infinity);
  // console.debug(`searchCount / best`, searchCount, best);
  // console.debug(`candidates`, candidates.map(({ score, flippable }) => {
  //   const { x, y } = flippable
  //   return {
  //     x, y, score,
  //   }
  // }))
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
      } else {
        // if opponent has no move, we get an advantage
        // we favor such moves over anything else
        cand.score += 100;
      }
      board.undo();
    } else {
      // const { x, y } = cand.flippable;
      // console.debug(`(%d, %d) = %d`, x, y, cand.score);
    }
  }
  node.scores = candidates.map(({ score }) => score);
  // console.groupEnd(label);
  return candidates
}
