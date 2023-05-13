
const $ = (path, parent = document) => parent.querySelector(path);
const $$ = (path, parent = document) => parent.querySelectorAll(path)

function main() {
  const canvas = $('#canvas');
  const board = new Board();
  const view = new BoardView(canvas, board);
  const ai = new BruteForceStrategy(board, 2);

  let [px, py] = [-1, -1]
  let flippable = null;

  function getCursorXY({ clientX, clientY }) {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(board.width * (clientX - rect.left) / rect.width);
    const y = Math.floor(board.height * (clientY - rect.top) / rect.height);
    return [x, y];
  }

  function updateScore() {
    $(`#info .player-b .score`).innerHTML = board.score['b'];
    $(`#info .player-w .score`).innerHTML = board.score['w'];
  }

  function updatePlayer() {
    $$(`#info .player`).forEach(e => e.classList.remove('current'));
    $(`#info .player-${board.nextPiece}`).classList.add('current');
  }

  function handlePreview(e) {
    const [x, y] = getCursorXY(e);
    if (x == px && y == py) return;
    [px, py] = [x, y];

    flippable = null;
    view.clearUI();

    if (!board.isEmpty(x, y)) {
      view.setCursorStyle('not-allowed');
      return
    }
    view.setCursorStyle('auto');

    flippable = board.getFlippable(x, y);
    if (flippable.length == 0) {
      view.setCursorStyle('not-allowed');
      return
    }

    view.previewFlippable(flippable)
  }

  function handleFlip(e) {
    if (flippable && flippable.length > 0) {
      view.clearUI();
      flippable.flip()
      flippable = null;
    }
  }

  function newGame() {
    board.reset();
    view.repaint();
    updateScore();
    updatePlayer();
  }

  canvas.oncontextmenu = () => false
  canvas.addEventListener('pointerup', handleFlip)
  canvas.addEventListener('pointermove', handlePreview)
  canvas.addEventListener('pointerdown', handlePreview)
  canvas.addEventListener('pointercancel', () => {
    view.clearUI();
    flippable = null;
  })

  board.on('turnChange', () => {
    updatePlayer()
  })

  board.on('set', () => {
    updateScore()
  })

  board.on('end', () => {
    setTimeout(() => {
      if (board.score['b'] > board.score['w']) {
        alert('Black wins!')
      }
      if (board.score['b'] < board.score['w']) {
        alert('White wins!')
      }
      if (board.score['b'] == board.score['w']) {
        alert('Draw!')
      }
    }, 300)
  })

  $('#controls .pass').addEventListener('click', e => {
    console.time('analyze')
    const flippables = ai.analyze()
    console.timeEnd('analyze')
    if (flippables.length > 0) {
      alert(`Don't pass yet! You can flip here!`)
      view.clearUI();
      view.previewFlippable(flippables[0])
    } else {
      board.pass();
    }
  })

  $('#controls .new').addEventListener('click', e => {
    newGame();
  })

  $('#controls .undo').addEventListener('click', e => {
    if (board.undoable()) {
      board.undo();
      [px, py] = [-1, -1];
      view.clearUI();
    } else {
      alert('Nothing to undo!')
    }
  })

  view.repaint();
  console.debug(board)
}

class EventEmitter {
  constructor() {
    this._listeners = {};
  }
  emit(event, ...args) {
    if (this._listeners[event]) {
      this._listeners[event].forEach(fn => fn(...args));
    }
  }
  on(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(fn);
  }
}

class Board extends EventEmitter {
  constructor() {
    super();
    this.reset();
  }
  get width() { return 8 }
  get height() { return 8 }
  get pieces() { return 'bw' }
  get nextPiece() {
    return this.pieces[this.turn];
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
  deepSearch(level = 1) {}
  undo() {
    if (!this.undoable()) return
    const undoable = this.undoStack.pop();
    undoable.undo();
  }
  undoable() {
    return this.undoStack.length > 0
  }
  pass() {
    this.passCount++;
    if (this.passCount == 2) {
      this.emit('end')
      return
    }
    this.nextTurn();

    const undo = () => {
      this.passCount = 0;
      this.nextTurn();
    }

    this.undoStack.push({ undo })
  }
  nextTurn() {
    this.turn = (this.turn + 1) % 2;
    this.emit('turnChange')
  }
  set(x, y) {
    const piece = this.nextPiece
    this.grid[y][x] = piece;
    this.score[piece]++;
    this.passCount = 0
    this.emit('set', { x, y, piece });

    if (this.score['b'] + this.score['w'] == 64) {
      this.emit('end')
      return
    }

    this.nextTurn();
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

const SVG_NS = 'http://www.w3.org/2000/svg'

class BoardView {
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
    const el = document.createElementNS(SVG_NS, name);
    Object.entries(attrs).forEach(([k, v]) => el.setAttributeNS(null, k, v));
    return el
  }
}

class Flippable {
  constructor(board, x, y) {
    this.board = board;
    this.x = x;
    this.y = y;
    this.flippables = []
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

class BruteForceStrategy {
  constructor(board, maxDepth = 1) {
    this.board = board;
    this.maxDepth = maxDepth;
    this.searchCount = 0;
    this.weights = [
      [10,1,5,5,5,5,1,10],
      [1,1,1,1,1,1,1,1],
      [5,1,1,1,1,1,1,5],
      [5,1,1,1,1,1,1,5],
      [5,1,1,1,1,1,1,5],
      [5,1,1,1,1,1,1,5],
      [1,1,1,1,1,1,1,1],
      [10,1,5,5,5,5,1,10],
    ];
  }
  analyze() {
    this.searchCount = 0;
    const candidates = this.analyzeRecursive(1, this.board.copy())
    console.debug(`searchCount`, this.searchCount);
    const best = candidates.reduce((a, b) => Math.max(a.score, b.score), -Infinity);
    // keep the best ones and shuffle
    return candidates
      .filter(f => f.score !== best)
      .sort(() => Math.random() - 0.5)
      .map(f => f.flippable)
  }
  analyzeRecursive(depth, board) {
    this.searchCount++;
    const candidates = board.search().map(f => {
      // score is negated at alternating depths
      const score = (this.weights[f.y][f.x] + f.length) * (depth % 2 === 0 ? -1 : 1)
      return { score, flippable: f }
    })
    const label = `analyze[${depth}/${this.maxDepth}]: candidates=${candidates.length}`;
    console.group(label);
    // stop early if there is only one candidate
    if (candidates.length > 1) {
      candidates.forEach(f => {
        const { x, y } = f.flippable;
        // flip and analyze the next move
        if (depth < this.maxDepth) {
          f.flippable.flip();
          const nextCandidates = this.analyzeRecursive(depth + 1, board);
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
      })
    }
    console.groupEnd(label);
    return candidates
  }
}

document.addEventListener('DOMContentLoaded', main);
