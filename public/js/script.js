const socket = io();

let board = document.getElementById("board")
const pcs = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
let player = 'white';
let playAs = '';
let selectedPiece = '';
let hasPiece = false;
let check = false;
let suggestion = true;
let checkMoves = [];
localStorage.removeItem('user');

let historyMoves = [];
let moveNumber = 0;
let checker = null;
let whiteCaptured = [];
let blackCaptured = [];
let captured = [];
let promotion = {
    state: false,
    pieces: ['queen', 'bishop', 'knight', 'rook'],
    promote: null
}




let room = new URLSearchParams(location.search).get('room');
let play = new URLSearchParams(location.search).get('player');

if (room) {
    document.getElementById('room').value = room;
    document.getElementById('room').disabled = true;
}

if (play) {
    play = play === 'white' ? 'black' : 'white';
    document.getElementById(play).checked = true;
    document.querySelectorAll('input[name=player]').forEach(ele => ele.disabled = true);
}

document.querySelector('#submitBtn').onclick = (e) => {
    e.preventDefault();
    let room = document.getElementById('room').value;
    let name = document.getElementById('Name').value;
    let playAs = document.querySelector('input[type=radio]:checked');
    if (!room || !name || !playAs) return;
    localStorage.setItem('user', JSON.stringify({ name, room, playAs: playAs.id }));
    socket.emit('join', ({ name, room, playAs: playAs.id }));
    $('#gameLink').value = location.host + '/?room=' + room + '&player=' + playAs.id
    // socket.emit('newJoin', localStorage.getItem('user'));
    $('#player-' + playAs.id + ' .name').innerText = name;
}

socket.on('error', error => {
    document.getElementById('error').innerText = "choose another room " + error;
});

socket.on('success', (p) => {
    playAs = p;
    setupBoard();
    intiEvents();
    $('#join').style.display = 'none';
    $('#wait').style.display = 'flex';
    $('#game').style.display = 'flex';
    console.log('success');
});

socket.on('newJoin', (users) => {
    users.forEach(user => {
        $(`#player-${user.playAs} .name`).innerText = user.playAs === playAs ? '(You) ' + user.name : user.name;
    });
    if (users.length === 2) $('#wait').style.display = 'none';
});

socket.on('player-left', () => {
    // alert('Opponent resigned the game. You won!');
    // location = '/';
    console.log('user left')
})


function setupBoard() {
    board.innerHTML = '';
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            let div = document.createElement('div');
            div.setAttribute('piece', '');
            div.classList.add('box');
            div.id = `box-${i}-${j}`;

            div.classList.add(((i + j) % 2 === 0) ? 'light' : 'dark');

            if (i === 0 || i === 7) {
                div.setAttribute('piece', `${i === 0 ? 'black' : 'white'}-${pcs[j]}`);
                div.classList.add('placed');
            }
            if (i === 1 || i === 6) {
                div.setAttribute('piece', `${i === 1 ? 'black' : 'white'}-pawn`);
                div.classList.add('placed');
            }
            board.appendChild(div);
        }
    }
    if (playAs === 'black') board.style.setProperty('transform', 'rotate(180deg)')
}

function intiEvents() {
    document.querySelectorAll('.box').forEach(box => {
        box.onclick = async() => {
            if (player !== playAs) return;
            if (box.classList.contains('selected')) {
                removeSelection();
                socket.emit('deselect-piece');
                return;
            }

            if (!selectedPiece) {
                if (check) findCheckMoves(box);
                if (box.getAttribute('piece').indexOf(player) >= 0) {
                    selectPiece(box);
                    socket.emit('select-piece', box.id);
                }
            } else if (selectedPiece) {
                let a = selectedPiece.getAttribute('piece').split('-');
                let color = a[0];
                let type = a[1];

                if (box.getAttribute('piece').indexOf(player) >= 0) {
                    removeSelection();
                    selectPiece(box);
                    socket.emit('deselect-piece');
                    socket.emit('select-piece', box.id);
                } else if (box.classList.contains('legal')) {
                    if (isPromoting(box, color, type)) await promote(box, color, type);
                    setPiece(box, color, type)
                    switchPlayer();
                    isCheck(box.id);
                    delPiece();
                    // addCaptured(move.curr);
                    checkWinning();
                    removeSuggestion();
                    socket.emit('piece-move', { boxId: box.id, color, type, selId: selectedPiece.id });
                }
            }
        }
    });
}

socket.on('toggle-suggestion', () => {
    suggestion = suggestion ? false : true;
    document.querySelectorAll('.legal').forEach(e => {
        suggestion ? e.classList.add('show') : e.classList.remove('show');
    });
    $('#suggest').checked = suggestion;
});

socket.on('deselect-piece', () => removeSelection());

socket.on('select-piece', id => selectPiece(document.getElementById(id)));

socket.on('piece-move', data => {
    let box = document.getElementById(data.boxId);
    setPiece(box, data.color, data.type);
    delPiece(document.getElementById(data.selId));

    switchPlayer();
    // isCheck(box.id);
    checkWinning();
    removeSuggestion();
});

function checkWinning() {
    if (!$('[piece=' + player + '-king]')) {
        setTimeout(() => {
            alert(`${player === 'white' ? 'black' : 'white'} has won`)
        }, 1000);
    }
}

function isKingInCheck(box) {
    document.querySelectorAll('.box').forEach(ele => ele.classList.remove('check'));
    let hasPlaced = false;
    let selectRemove = false;
    let isKing = {
        placeRemoved: false,
        attr: null,
        sudoattr: false,

    };


    let king = $(`[piece = ${player}-king]`);
    let kingPos = getPos(king.id);
    let opponentMoves = [];


    if ((selectedPiece.id === king.id)) {
        if (box.classList.contains('placed')) {
            box.classList.remove('placed');
            isKing.placeRemoved = true;
            isKing.attr = box.getAttribute('piece');
            box.setAttribute('piece', player + '-' + player);
        } else {
            // attr = box.getAttribute('piece');
            box.setAttribute('piece', player + '-' + player);
            isKing.sudoattr = true;
        }
    } else {
        if (box.classList.contains('placed')) hasPlaced = true;
        box.classList.add('placed');
    }
    selectedPiece.classList.remove('placed');
    selectRemove = true;


    let nextChecker = [];

    let allPieces = Array.from(document.querySelectorAll(`[piece^=${player === 'white' ? 'black' : 'white'}]`));

    // console.log(allPieces)

    Array.from(allPieces).forEach(piece => {
        try {
            const pieceMoves = getMoves(piece, true);
            // console.log(JSON.stringify(pieceMoves), piece);
            opponentMoves = [...opponentMoves, ...pieceMoves];

            if (JSON.stringify(pieceMoves).includes(JSON.stringify(kingPos))) nextChecker.push(piece);
        } catch (e) {
            console.log(piece);
        }
    });

    // opponentMoves = [...new Set(opponentMoves.map(JSON.stringify))].map(JSON.parse);

    opponentMoves.forEach(([i, j]) => $('#box' + '-' + i + '-' + j).classList.add('check'));

    // console.log(JSON.stringify(opponentMoves));

    // for (let piece of hasMoves) {
    //     let pieceMoves = getMoves(piece);
    //     let king = $(`[piece = ${player}-king]`);
    //     let kingPos = getPos(king.id);

    //     isPresent = JSON.stringify(pieceMoves).includes(JSON.stringify(kingPos));
    //     if (isPresent) {
    //         break;
    //     }
    // }

    let isPresent = JSON.stringify(opponentMoves).includes(JSON.stringify(kingPos));

    // if (isKing) {
    //     box.classList.add('placed');
    //     box.setAttribute('piece', attr);
    // }
    // document.querySelectorAll('.box').forEach(ele => ele.classList.remove('check'));
    if (!hasPlaced) {
        box.classList.remove('placed');
    };

    if (selectRemove) selectedPiece.classList.add('placed');

    if ((selectedPiece.id === king.id)) {
        // console.log('selectedPiece.id===king.id');
        if (isKing.placeRemoved) {
            box.classList.add('placed');
            box.setAttribute('piece', isKing.attr);
            // console.log("isKing.placeRemoved");
        }
        else if (isKing.sudoattr) {
            box.setAttribute('piece', '');
            // console.log("isKing.sudoattr");
        }
        return box.classList.contains('check');
    };

    if (check && (box.id === checker.id)) {
        // console.log('check && (box.id === checker.id)');
        return false;
    };


    for (const piece of nextChecker) {
        // console.log("const piece of nextChecker", piece);
        if (piece.id === box.id) return false;
    }

    return isPresent;
}


function findCheckMoves(box) {
    let a = box.getAttribute('piece').split('-');
    let color = a[0];
    let type = a[1];

    let b = box.id.split('-');
    let i = parseInt(b[1]);
    let j = parseInt(b[2]);
}

function getPos(id) {
    let b = id.split('-');
    let i = parseInt(b[1]);
    let j = parseInt(b[2]);
    return [i, j];
}


function isCheck(id) {

    let moves = getMoves($('#' + id));
    // console.log(JSON.stringify(moves));
    let king = $(`[piece = ${player}-king]`);
    let kingPos = getPos(king.id);

    check = JSON.stringify(moves).includes(JSON.stringify(kingPos));

    if (check) {
        // king.classList.add('error');
        checker = $('#' + id);
    }


}

function selectPiece(box) {
    box.classList.add('selected');
    selectedPiece = box;
    // check ? findLegalMovesInCheck(box) : findLegalMoves(getMoves(selectedPiece));
    // findLegalMoves(getMoves(selectedPiece));
    let legalmoves = [];
    let moves = getMoves(selectedPiece);

    for (const [i, j] of moves) {
        let bx = $('#box-' + i + '-' + j);
        if (!isKingInCheck(bx)) legalmoves.push([i, j]);
    }
    // console.log(legalmoves);
    findLegalMoves(legalmoves);
}

function removeSelection() {
    selectedPiece.classList.remove('selected');
    selectedPiece = '';
    removeSuggestion();
}

function removeSuggestion() {
    document.querySelectorAll('.box').forEach(e => {
        e.classList.remove('legal');
        e.classList.remove('show')
    });
}



function isPromoting(box, color, type) {
    if (type !== 'pawn') return false;
    let row = getPos(box.id)[0];
    if ((color === 'white' && row === 0)) return true;
    if ((color === 'black' && row === 7)) return true;
    return false;
}


function promote(box, color, type) {
    return new Promise((resolve, reject) => {
        board.style.opacity = 0.3;
        let promo = $('#promotion');
        promo.style.display = 'block';
        for (const p of promotion.pieces) {
            let div = document.createElement('div');
            div.setAttribute('piece', color + '-' + p);
            div.addEventListener('click', () => {
                promotion.promote = color + '-' + p;
                resolve();
                promo.innerHTML = '';
                promo.style.display = 'none';
                board.style.removeProperty('opacity');
            });
            promo.appendChild(div);
        }
    })
}


function setPiece(box, color, type) {
    box.setAttribute('piece', color + '-' + type);
    box.classList.add('placed');
}

function delPiece() {
    selectedPiece.setAttribute('piece', '');
    selectedPiece.classList.remove('placed');
    selectedPiece.classList.remove('selected');
    selectedPiece = '';
}

function findLegalMoves(nextMoves) {
    for (var move of nextMoves) {
        var box = $('#box-' + move[0] + '-' + move[1]);
        box.classList.add('legal');
        if (suggestion) box.classList.add('show');
    }
}

function getMoves(box = selectedPiece, dia) {
    let a = box.getAttribute('piece').split('-');
    // console.log(box.getAttribute('piece'))
    let color = a[0];
    let type = a[1];

    let b = box.id.split('-');
    let i = parseInt(b[1]);
    let j = parseInt(b[2]);

    let nextMoves = [];
    let moves;
    switch (type) {
        case 'pawn':
            if (color === 'black') {
                moves = [
                    [1, 0], [2, 0], [1, -1], [1, 1]
                ];
            } else {
                moves = [
                    [-1, 0], [-2, 0], [-1, 1], [-1, -1]
                ];
            }
            nextMoves = getPawnMoves(i, j, color, moves, dia);
            break;
        case 'rook':
            moves = [
                [0, 1], [0, -1], [1, 0], [-1, 0]

            ];
            nextMoves = getQueenMoves(i, j, color, moves);
            break;
        case 'knight':
            moves = [
                [-1, -2], [-2, -1], [1, -2], [-2, 1],
                [2, -1], [-1, 2], [2, 1], [1, 2]
            ];
            nextMoves = getKnightMoves(i, j, color, moves);
            break;
        case 'bishop':
            moves = [
                [1, 1], [1, -1], [-1, 1], [-1, -1]
            ];
            nextMoves = getQueenMoves(i, j, color, moves);
            break;
        case 'queen':
            moves = [
                [1, 1], [1, -1], [-1, 1], [-1, -1], [0, 1], [0, -1], [1, 0], [-1, 0]
            ];
            nextMoves = getQueenMoves(i, j, color, moves);
            break;
        case 'king':
            moves = [
                [1, 1], [1, -1], [-1, 1], [-1, -1],
                [0, 1], [0, -1], [1, 0], [-1, 0]
            ];
            nextMoves = getKingMoves(i, j, color, moves);
            break;
        default:
            break;
    }

    return nextMoves;
}


function getPawnMoves(i, j, color, moves, dia = false) {
    let nextMoves = [];
    for (let index = 0; index < moves.length; index++) {
        let I = i + moves[index][0];
        let J = j + moves[index][1];
        if (!outOfBounds(I, J)) {
            let box = $('#box-' + I + '-' + J);
            if (index === 0 && !dia) {
                if (!box.classList.contains('placed')) {
                    nextMoves.push([I, J]);
                } else {
                    index++;
                }
            } else if (index === 1 && !dia) {
                if (((color === 'black' && i === 1) || (color === 'white' && i === 6)) && !box.classList.contains('placed')) {
                    nextMoves.push([I, J]);
                }
            } else if (index > 1) {
                // if (box.getAttribute('piece') !== '' && box.getAttribute('piece').indexOf(color) < 0) {
                //     nextMoves.push([I, J]);
                // }
                if ((box.classList.contains('placed') && box.getAttribute('piece').indexOf(color) < 0) || dia) {
                    nextMoves.push([I, J]);
                }
            }
        }
    }
    return nextMoves;
}

function getQueenMoves(i, j, color, moves) {
    var nextMoves = [];
    for (var move of moves) {
        var I = i + move[0];
        var J = j + move[1];
        var sugg = true;
        while (sugg && !outOfBounds(I, J)) {
            var box = $('#box-' + I + '-' + J);
            if (box.classList.contains('placed')) {
                if (box.getAttribute('piece').indexOf(color) >= 0) {
                    sugg = false;
                } else {
                    nextMoves.push([I, J]);
                    sugg = false;
                }
            }
            if (sugg) {
                nextMoves.push([I, J]);
                I += move[0];
                J += move[1];
            }
        }
    }
    return nextMoves;
}

function getKnightMoves(i, j, color, moves) {
    var nextMoves = [];
    for (var move of moves) {
        var I = i + move[0];
        var J = j + move[1];
        if (!outOfBounds(I, J)) {
            var box = $('#box-' + I + '-' + J);
            if (!box.classList.contains('placed') || box.getAttribute('piece').indexOf(color) < 0) {
                nextMoves.push([I, J]);
            }
        }
    }
    return nextMoves;
}


function getKingMoves(i, j, color, moves) {
    let nextMoves = [];
    for (let move of moves) {
        let I = i + move[0];
        let J = j + move[1];
        if (!outOfBounds(I, J)) {
            let box = $('#box-' + I + '-' + J);
            if (!box.classList.contains('placed') && !box.classList.contains('check') || box.getAttribute('piece').indexOf(color) < 0) {
                nextMoves.push([I, J]);
            }
        }
    }
    return nextMoves;
}

function outOfBounds(i, j) {
    return (i < 0 || i >= 8 || j < 0 || j >= 8);
}

// $('#suggest').onchange = () => {

//     suggestion = suggestion ? false : true
//     document.querySelectorAll('.legal').forEach(e => {
//         suggestion ? e.classList.add('show') : e.classList.remove('show')
//     });
//     $('#suggest').checked = suggestion
//     socket.emit('toggle-suggestion');
// }

function switchPlayer() {

    $('#player-' + player).classList.remove('playing');
    if (player === 'white') {
        player = 'black';
    }
    else {
        player = 'white'
    }
    $('#player-' + player).classList.add('playing');
    // console.log(player)
}

function $(cs) {
    return document.querySelector(cs);
}


