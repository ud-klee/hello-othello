import { Board } from './othello.js';

let gamesIndex = [];

function main() {
  const slider = document.getElementById('slider');
  const game_id = document.getElementById('game_id');
  const result = document.getElementById('result');
  const replay = document.getElementById('replay');

  function selectGame(index) {
    const gameFile = gamesIndex[index];

    const [ , score ] = gameFile.split('_');
    const [ black, white ] = score.split('v');

    result.innerText = `Black: ${black} White: ${white}`;

    history.replaceState(null, '', `#/game/${index}`);
  }

  slider.addEventListener('input', (event) => {
    const index = event.target.value;
    selectGame(index);
    game_id.value = index;
  });

  game_id.addEventListener('change', (event) => {
    if (event.target.validity.valid) {
      const index = event.target.value;
      selectGame(index);
      slider.value = index;
    }
  });

  replay.addEventListener('click', (event) => {
    event.target.disabled = true;

    loadAndReplayGame(gamesIndex[slider.value]).then(() => {
      event.target.disabled = false;
    });
  })

  loadGamesIndex().then(() => {
    const max = gamesIndex.length - 1
    slider.max = max;
    game_id.max = max;

    let id = 0;
    const hash = window.location.hash.slice(1);

    if (hash) {
      const matches = hash.match(/^\/game\/(\d+)/);
      if (matches) {
        id = Math.min(parseInt(matches[1]), max);
        slider.value = id;
        game_id.value = id;
      }
    }

    selectGame(id);
  });
}

async function loadGamesIndex() {
  const res = await fetch('games-index.json');

  if (res.ok) {
    gamesIndex = await res.json();
  }
}

async function loadAndReplayGame(gameFile) {
  const res = await fetch(`games/${gameFile}`);

  if (res.ok) {
    const history = await res.json();
    try {
      await replayGame(history);
    } catch (err) {
      console.error(err);
      alert('Something went wrong! Check the console for details.');
    }
  }
}

async function replayGame(history) {
  const board = new Board();
  let currentTurn = 0;

  const replay_output = document.getElementById('replay_output');
  replay_output.innerHTML = '';

  function print(str) {
    const pre = document.createElement('pre');
    pre.innerText = str;
    let container = replay_output.querySelector(`.turn-${currentTurn}`);
    container.appendChild(pre);
  }

  function onBeforeMove(move, who, turn) {
    let container = replay_output.querySelector(`.turn-${turn}`);
    if (!container) {
      container = document.createElement('div');
      container.classList.add(`turn-${turn}`, `turn`);
      replay_output.appendChild(container);
    }
    currentTurn = turn;
  }

  await board.replay({
    source: history,
    printBoard: true,
    print,
    onBeforeMove,
  })
}

document.addEventListener('DOMContentLoaded', main);
