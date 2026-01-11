import React, { useState, useEffect, useCallback } from 'react';

type Player = 'X' | 'O' | null;

interface TicTacToeLoaderProps {
    isLoading: boolean;
    onContinue: () => void;
    sourceMode?: 'upload' | 'text' | 'multimodal' | 'topic' | null;
    productType?: 'lesson' | 'activity' | 'exam' | 'podcast' | null;
}

const TicTacToeLoader: React.FC<TicTacToeLoaderProps> = ({ isLoading, onContinue, sourceMode, productType }) => {
    const [board, setBoard] = useState<Player[]>(Array(9).fill(null));
    const [isXNext, setIsXNext] = useState<boolean>(true); // Human is X
    const [winner, setWinner] = useState<Player | 'Draw' | null>(null);
    const [statusMessage, setStatusMessage] = useState<string>('');
    const [score, setScore] = useState({ player: 0, cpu: 0, draws: 0 });

    // Winning combinations
    const wins = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ];

    const checkWinner = useCallback((currentBoard: Player[]) => {
        for (let i = 0; i < wins.length; i++) {
            const [a, b, c] = wins[i];
            if (currentBoard[a] && currentBoard[a] === currentBoard[b] && currentBoard[a] === currentBoard[c]) {
                return currentBoard[a];
            }
        }
        if (!currentBoard.includes(null)) return 'Draw';
        return null;
    }, []);

    const resetGame = useCallback(() => {
        setBoard(Array(9).fill(null));
        setIsXNext(Math.random() < 0.5); // Randomize start
        setWinner(null);
        setStatusMessage('');
    }, []);

    // CPU Move Logic (Heuristic: Win -> Block -> Center -> Corner -> Random)
    const makeCpuMove = useCallback(() => {
        if (winner || !isLoading) return; // Stop playing if loading finished

        const availableIndices = board.map((val, idx) => val === null ? idx : null).filter(val => val !== null) as number[];
        if (availableIndices.length === 0) return;

        let moveIndex = -1;

        // Helper to find winning move for a specific player
        const findWinningMove = (player: Player) => {
            for (let i = 0; i < wins.length; i++) {
                const [a, b, c] = wins[i];
                const lineup = [board[a], board[b], board[c]];
                const countPlayer = lineup.filter(p => p === player).length;
                const countEmpty = lineup.filter(p => p === null).length;

                if (countPlayer === 2 && countEmpty === 1) {
                    if (board[a] === null) return a;
                    if (board[b] === null) return b;
                    if (board[c] === null) return c;
                }
            }
            return -1;
        };

        // 1. Try to WIN
        moveIndex = findWinningMove('O');

        // 2. Block Opponent (X)
        if (moveIndex === -1) {
            moveIndex = findWinningMove('X');
        }

        // 3. Take Center
        if (moveIndex === -1 && board[4] === null) {
            moveIndex = 4;
        }

        // 4. Take Corner
        if (moveIndex === -1) {
            const corners = [0, 2, 6, 8].filter(idx => board[idx] === null);
            if (corners.length > 0) {
                moveIndex = corners[Math.floor(Math.random() * corners.length)];
            }
        }

        // 5. Random
        if (moveIndex === -1) {
            moveIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
        }

        const newBoard = [...board];
        newBoard[moveIndex] = 'O';
        setBoard(newBoard);
        setIsXNext(true);

        // Check end state immediately after move
        // Note: checking strictly only for 'O' win is enough here usually, but keeping general check is safer
        let isWin = false;
        for (let i = 0; i < wins.length; i++) {
            const [a, b, c] = wins[i];
            if (newBoard[a] && newBoard[a] === newBoard[b] && newBoard[a] === newBoard[c]) {
                handleGameEnd(newBoard[a]);
                isWin = true;
                break;
            }
        }
        if (!isWin && !newBoard.includes(null)) {
            handleGameEnd('Draw');
        }
    }, [board, winner, isLoading, checkWinner]);

    const handleGameEnd = (result: Player | 'Draw') => {
        setWinner(result);

        // Update Score
        setScore(prev => ({
            ...prev,
            player: result === 'X' ? prev.player + 1 : prev.player,
            cpu: result === 'O' ? prev.cpu + 1 : prev.cpu,
            draws: result === 'Draw' ? prev.draws + 1 : prev.draws
        }));

        setStatusMessage(result === 'Draw' ? 'תיקו!' : result === 'X' ? 'ניצחת!' : 'הפסדת!');

        setTimeout(() => {
            if (isLoading) resetGame();
        }, 1500);
    };

    // Trigger CPU move if it's O's turn
    useEffect(() => {
        if (!isXNext && !winner && isLoading) {
            const timer = setTimeout(makeCpuMove, 500); // 500ms delay for natural feel
            return () => clearTimeout(timer);
        }
    }, [isXNext, winner, isLoading, makeCpuMove]);

    const handleClick = (index: number) => {
        if (board[index] || winner || !isXNext) return;

        const newBoard = [...board];
        newBoard[index] = 'X';
        setBoard(newBoard);
        setIsXNext(false); // Pass turn to CPU

        const result = checkWinner(newBoard);
        if (result) {
            handleGameEnd(result);
        }
    };

    // Debug log for isLoading prop changes
    useEffect(() => {
        console.log('isLoading prop changed:', isLoading);
    }, [isLoading]);

    // --- Dynamic Loading Text ---
    const productTypeHebrew = {
        'lesson': 'מערך השיעור',
        'activity': 'הפעילות לתלמיד',
        'exam': 'המבחן',
        'podcast': 'הפודקאסט'
    }[productType || 'lesson'] || 'הפעילות';

    const sourceTextHebrew = {
        'upload': 'מהקובץ שהעלתם',
        'text': 'מהטקסט שהדבקתם',
        'multimodal': 'מהסרטון שתמללתם',
        'topic': 'על הנושא שבחרתם'
    }[sourceMode || 'topic'] || '';

    const loadingMessage = `${productTypeHebrew} ${sourceTextHebrew} בבניה`;

    return (
        <div className="fixed inset-0 z-[200] bg-white/95 backdrop-blur-md flex flex-col items-center justify-center font-sans animate-fade-in" dir="ltr">

            {/* Header / Brand */}
            <div className="flex flex-col items-center animate-fade-in shrink-0" dir="rtl">
                <img src="/WizdiLogo.png" alt="Wizdi" className="h-20 w-auto mb-4 object-contain" loading="eager" decoding="async" />
                <h2 className="text-2xl md:text-3xl font-bold text-center px-4 leading-relaxed" style={{ color: '#0ea5e9' }}>
                    {loadingMessage}<br />בואו נשחק קצת...
                </h2>
                <p className="text-sm text-gray-400 mt-2 font-medium bg-white/50 px-3 py-1 rounded-full backdrop-blur-sm">
                    זמן היצירה עשוי להימשך בין דקה לדקה וחצי
                </p>
            </div>

            {/* Conditional Render: Game vs Success */}
            {isLoading ? (
                <div className="relative mt-8 animate-fade-in-up flex flex-col items-center gap-6" dir="ltr">
                    {/* Scoreboard */}
                    <div className="flex items-center gap-8 bg-gray-100 px-6 py-3 rounded-2xl shadow-inner text-gray-600 font-bold">
                        <div className="flex flex-col items-center">
                            <span className="text-xs uppercase tracking-widest mb-1 text-indigo-500">You</span>
                            <span className="text-2xl">{score.player}</span>
                        </div>
                        <div className="h-8 w-px bg-gray-300"></div>
                        <div className="flex flex-col items-center">
                            <span className="text-xs uppercase tracking-widest mb-1 text-gray-400">Draws</span>
                            <span className="text-2xl">{score.draws}</span>
                        </div>
                        <div className="h-8 w-px bg-gray-300"></div>
                        <div className="flex flex-col items-center">
                            <span className="text-xs uppercase tracking-widest mb-1 text-rose-500">CPU</span>
                            <span className="text-2xl">{score.cpu}</span>
                        </div>
                    </div>

                    {/* Status Overlay */}
                    {statusMessage && (
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none w-full flex justify-center">
                            <span className={`
                                text-5xl font-black animate-bounce-short drop-shadow-xl px-8 py-6 rounded-3xl border-4 bg-white/95 backdrop-blur shadow-2xl
                                ${statusMessage.includes('ניצחת') ? 'text-green-500 border-green-200' :
                                    statusMessage.includes('הפסדת') ? 'text-red-500 border-red-200' :
                                        'text-gray-500 border-gray-200'}
                            `}>
                                {statusMessage}
                            </span>
                        </div>
                    )}

                    <div className="grid grid-cols-3 gap-3 p-4 bg-gray-100/50 rounded-3xl border border-gray-200 shadow-xl">
                        {board.map((cell, i) => (
                            <button
                                key={i}
                                onClick={() => handleClick(i)}
                                disabled={!!cell || !!winner || !isXNext}
                                className={`
                                    w-20 h-20 md:w-24 md:h-24 bg-white rounded-2xl shadow-sm text-5xl font-bold flex items-center justify-center
                                    transition-all duration-200
                                    ${!cell && isXNext && !winner ? 'hover:scale-105 hover:bg-sky-50 cursor-pointer shadow-md' : ''}
                                    ${cell === 'X' ? 'text-indigo-500' : 'text-rose-400'}
                                    ${!!cell ? 'cursor-default' : ''}
                                `}
                            >
                                {cell}
                            </button>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="mt-0 pt-20 text-center animate-bounce-in z-50 flex flex-col items-center h-full justify-start" dir="rtl">
                    <h2 className="text-5xl font-black text-gray-800 mb-12 drop-shadow-sm leading-tight">
                        התכנים מוכנים!
                    </h2>
                    <button
                        onClick={onContinue}
                        className="bg-[#0ea5e9] text-white px-12 py-5 rounded-full text-2xl font-bold shadow-2xl hover:bg-sky-600 hover:scale-105 active:scale-95 transition-all ring-4 ring-sky-100 cursor-pointer flex items-center gap-4"
                    >
                        <span>המשיכו לתוצאות</span>
                        <span className="text-3xl">←</span>
                    </button>
                </div>
            )}

            {/* Footer */}
            {isLoading && (
                <p className="fixed bottom-8 text-gray-400 text-sm font-medium opacity-60">
                    Human (X) vs CPU (O)
                </p>
            )}
        </div>
    );
};

export default TicTacToeLoader;
