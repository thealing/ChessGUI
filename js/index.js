const pieceImages = {
	"P": "images/white_pawn.svg",
	"N": "images/white_knight.svg",
	"B": "images/white_bishop.svg",
	"R": "images/white_rook.svg",
	"Q": "images/white_queen.svg",
	"K": "images/white_king.svg",
	"p": "images/black_pawn.svg",
	"n": "images/black_knight.svg",
	"b": "images/black_bishop.svg",
	"r": "images/black_rook.svg",
	"q": "images/black_queen.svg",
	"k": "images/black_king.svg",
};

const stockfish = STOCKFISH();

var side = 0;

var moves = [];

var pgn = [];

var boardFen = [];

var board = [];

var turn = 0;

var legalMoves = [];

var selectedSquare = -1;

onLoaded();

function onLoaded() {
	document.querySelectorAll("input").forEach(function(input) {
		const value = localStorage.getItem(input.id);
		if (value == null) {
			localStorage.setItem(input.id, input.value);
		}
		else {
			input.value = value;
		}
		input.addEventListener("input", function(event) {
			localStorage.setItem(input.id, input.value);
		});
		console.log(input.id);
	});
	generateBoard();
	onUpdate();
	onNewGameButtonClicked();
  const zoom = Math.min(document.documentElement.clientWidth / 900.0, document.documentElement.clientHeight / 550.0);
  document.body.style.transform = `scale(${zoom})`;
}

function onUpdate() {
	stockfish.postMessage("ucinewgame");
	stockfish.postMessage("position startpos moves " + moves.join(" "));
	stockfish.postMessage("d");
	stockfish.postMessage("isready");
	stockfish.onmessage = function(event) {
		if (event.includes("Fen")) {
			const fen = event.split(" ").slice(1);
			boardFen = fen[0];
			for (let i = 0, j = 0; i < boardFen.length; i++) {
				if (boardFen[i] == "/") {
					continue;
				}
				const digit = parseInt(boardFen[i]);
				if (!isNaN(digit)) {
					for (let k = 0; k < digit; k++) {
						board[j] = " ";
						j++;
					}
				}
				else {
					board[j] = boardFen[i];
					j++;
				}
			}
			turn = Number(fen[1] == "b");
		}
		if (event.includes("Legal uci moves")) {
			legalMoves = event.split(" ").slice(3, -1);
		}
		if (event.includes("readyok")) {
			draw();
			if (turn != side && legalMoves.length != 0) {
				playComputerMove();
			}
		}
	};
}

function onSquareClicked(event) {
	const clickedSquareElement = event.target;
	const clickedSquare = parseInt(event.target.id.split("_")[1]);
	if (selectedSquare == -1) {
		selectedSquare = clickedSquare;
	}
	else {
		if (clickedSquare != selectedSquare) {
			playMove(selectedSquare, clickedSquare);
		}
		selectedSquare = -1;
	}
	onUpdate();
}

function onNewGameButtonClicked() {
	moves = [];
	pgn = [];
	side = document.getElementById("sideInput").value;
	pgn.push(side == 1 ? "[White \"Engine\"]" : "[Black \"Engine\"]");
	generateBoard();
	onUpdate();
}

function onUndoButtonClicked() {
	if (moves.length >= 2) {
		moves.length -= 2;
		pgn.length -= 2;
	}
	onUpdate();
}

function onExportButtonClicked() {
	navigator.clipboard.writeText(pgn.join(" "));
}

function generateBoard() {
	const boardElement = document.getElementById("board");
	boardElement.innerHTML = "";
	for (let i = 0; i < 8; i++) {
		for (let j = 0; j < 8; j++) {
			const squareElement = document.createElement("div");
			squareElement.id = "square_" + makeSquare(i, j);
			squareElement.classList.add("square");
			squareElement.classList.add(i % 2 == j % 2 ? "light" : "dark");
			squareElement.style.position = "absolute";
			squareElement.style.top = (side == 1 ? 7 - i : i) * 64 + "px";
			squareElement.style.left = (side == 1 ? 7 - j : j) * 64 + "px";
			squareElement.addEventListener("click", onSquareClicked);
			boardElement.appendChild(squareElement);
		}
	}
}

function draw() {
	drawSquares();
	drawPieces();
}

function drawSquares() {
	for (let i = 0; i < 64; i++) {
		const squareElement = document.getElementById("square_" + i);
		if (i == selectedSquare) {
			squareElement.classList.add("selected");
		}
		else {
			squareElement.classList.remove("selected");
		}
	}
}

function drawPieces() {
	for (let i = 0; i < 64; i++) {
		const squareElement = document.getElementById("square_" + i);
		squareElement.style.backgroundImage = board[i] == " " ? "none" : "url(" + pieceImages[board[i]] + ")";
		squareElement.style.backgroundSize = "contain";
	}
}

function playMove(src, dst) {
	const move = formatMove(src, dst);
	if (turn == side && legalMoves.includes(move)) {
		moves.push(move);
		pgn.push(moveToSan(move));
		onUpdate();
	}
}

function playComputerMove() {
	const contemptValue = document.getElementById("contemptInput").value;
	const skillLevelValue = document.getElementById("skillLevelInput").value;
	const maximumErrorValue = document.getElementById("maximumErrorInput").value;
	const probabilityValue = document.getElementById("probabilityInput").value;
	const depthValue = document.getElementById("depthInput").value;
	const thinkingStartTime = performance.now();
	stockfish.postMessage("setoption name MultiPV value " + 30);
	stockfish.postMessage("setoption name Contempt value " + contemptValue);
	stockfish.postMessage("setoption name Skill Level value " + skillLevelValue);
	stockfish.postMessage("setoption name Skill Level Maximum Error value " + maximumErrorValue);
	stockfish.postMessage("setoption name Skill Level Probability value " + probabilityValue);
	stockfish.postMessage("go depth " + depthValue);
	stockfish.onmessage = function(event) {
		if (event.includes("bestmove")) {
			const thinkingEndTime = performance.now();
			const move = event.split(" ")[1];
			console.log("computer thought for " + (thinkingEndTime - thinkingStartTime) + "ms");
			moves.push(move);
			pgn.push(moveToSan(move));
			onUpdate();
		}
	};
}

function moveToSan(move) {
	const [src, dst] = parseMove(move);
	return board[src].toUpperCase() + move;
}

function parseMove(moveStr) {
	const src = parseSquare(moveStr.substring(0, 2));
	const dst = parseSquare(moveStr.substring(2, 4));
	return [src, dst];
}

function parseSquare(squareStr) {
	const file = squareStr.charCodeAt(0) - "a".charCodeAt();
	const rank = "8".charCodeAt() - squareStr.charCodeAt(1);
	return makeSquare(rank, file);
}

function formatMove(src, dst) {
	const srcStr = String.fromCharCode("a".charCodeAt() + getSquareFile(src)) + String.fromCharCode("8".charCodeAt() - getSquareRank(src));
	const dstStr = String.fromCharCode("a".charCodeAt() + getSquareFile(dst)) + String.fromCharCode("8".charCodeAt() - getSquareRank(dst));
	const promotionStr = board[src] == "P" && getSquareRank(dst) == 0 || board[src] == "p" && getSquareRank(dst) == 7 ? "q" : "";
	return srcStr + dstStr + promotionStr;
}

function makeSquare(rank, file) {
	return rank * 8 + file;
}

function getSquareRank(square) {
	return Math.floor(square / 8);
}

function getSquareFile(square) {
	return square % 8;
}
