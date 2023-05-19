
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
    this.nextTurn();

    const undo = () => {
      this.passCount = 0;
      this.nextTurn();
    }

    this.undoStack.push({ undo })

    if (this.passCount == 2) {
      this.emit('end')
    }
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
    this.nextTurn();

    if (this.totalScore == 64) {
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
    const el = document.createElementNS('http://www.w3.org/2000/svg', name);
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

class BruteForceFinder {
  constructor() {
    this.worker = new Worker('./brute-force-worker.js?v=c8887370')
  }
  async analyze(board, maxDepth = 1) {
    return new Promise((resolve) => {
      this.worker.addEventListener('message', e => {
        const result = []
        console.log(`gameTree`, e.data.tree)
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

class Bot extends EventEmitter {
  constructor(board, piece, finder, level) {
    super();
    this.board = board;
    this.piece = piece;
    this.finder = finder;
    this.level = level;
    this.timer = 0;
  }
  play() {
    const logStyle = 'color: yellow; font-size: 0.8rem;'

    this.board.on('turnChange', () => {
      if (this.board.nextPiece === this.piece) {
        this.timer = setTimeout(() => {
          console.info(`%cBot: thinking...`, logStyle);
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
              console.info('%cBot: playing (%d, %d)', logStyle, x, y);
              flippables[0].flip();
            } else {
              console.info('%cBot: pass :(', logStyle);
              this.board.pass();
            }
          })
        }, 300)
      } else {
        console.info(`%cBot: your turn`, logStyle);
        clearTimeout(this.timer)
      }
    })

    this.board.on('end', () => {
      console.info(`%cBot: good game :)`, logStyle);
      clearTimeout(this.timer)
    })
  }
}
