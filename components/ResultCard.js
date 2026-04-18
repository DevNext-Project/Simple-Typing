function ResultCard({ stats, nickname, onRetry }) {
    const [randomMessage, setRandomMessage] = React.useState('');
    
    React.useEffect(() => {
        const messages = [
            "素晴らしいタイピングです！",
            "いい調子！その調子で頑張りましょう！",
            "自己ベスト更新を目指して！",
            "日々の練習が力になります！",
            "ナイスファイト！",
            "ブラインドタッチマスターへの道は近いです！",
            "正確なタイピングが光っています！"
        ];
        setRandomMessage(messages[Math.floor(Math.random() * messages.length)]);
    }, []);

    const handleScreenshot = () => {
        const el = document.getElementById('result-capture-area');
        if (!el || !window.html2canvas) return;
        
        // Hide the action buttons temporarily for the screenshot
        const actions = document.getElementById('result-actions');
        if (actions) actions.style.display = 'none';
        
        window.html2canvas(el, { backgroundColor: null }).then(canvas => {
            if (actions) actions.style.display = 'flex';
            
            const link = document.createElement('a');
            link.download = 'typing-result.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
        }).catch(err => {
            if (actions) actions.style.display = 'flex';
            console.error('Screenshot failed', err);
        });
    };

    const timeSeconds = (stats.elapsedTime / 1000).toFixed(1);
    const cpm = stats.elapsedTime > 0 ? Math.round((stats.correctCount / (stats.elapsedTime / 1000)) * 60) : 0;
    const accuracy = stats.totalCount > 0 ? Math.max(0, Math.round((stats.correctCount / stats.totalCount) * 100)) : 100;
    
    const isTimeUp = stats.timeLimit > 0 && stats.elapsedTime >= stats.timeLimit * 1000;
    
    // Calculate a rank
    let rank = 'C';
    let rankColor = 'text-gray-500';
    if (cpm >= 300 && accuracy >= 95) { rank = 'S'; rankColor = 'text-yellow-500'; }
    else if (cpm >= 200 && accuracy >= 90) { rank = 'A'; rankColor = 'text-green-500'; }
    else if (cpm >= 100 && accuracy >= 85) { rank = 'B'; rankColor = 'text-blue-500'; }

    return (
        <div className="w-full max-w-2xl mx-auto bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-lg border border-gray-100 dark:border-slate-700 transition-colors" data-name="result-card" data-file="components/ResultCard.js">
            <div id="result-capture-area" className="p-4 rounded-xl bg-white dark:bg-slate-800">
                <div className="text-center mb-8">
                    <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full ${isTimeUp ? 'bg-red-50 dark:bg-red-900/30 text-red-500' : 'bg-blue-50 dark:bg-slate-700 text-[var(--primary-color)]'} mb-4`}>
                        <div className={`icon-${isTimeUp ? 'clock-alert' : 'trophy'} text-4xl`}></div>
                    </div>
                    <h2 className="text-3xl font-bold text-[var(--text-main)]">
                        {isTimeUp ? 'タイムアップ！' : 'お疲れ様でした！'}
                    </h2>
                    <div className="mt-3 text-lg font-bold text-[var(--primary-color)] bg-blue-50 dark:bg-slate-800/50 py-2 px-5 rounded-xl inline-block border border-blue-100 dark:border-slate-700">
                        {nickname ? `${nickname}さん、` : ''}{randomMessage}
                    </div>
                    <p className="text-[var(--text-muted)] mt-3">
                        {isTimeUp ? `${stats.targetCount}問中 ${stats.currentQuestionNum - 1}問クリア` : 'すべての問題をクリアしました'}
                    </p>
                </div>
                
                <div className="bg-gray-50 dark:bg-slate-900 rounded-xl p-6 mb-8 flex flex-col items-center justify-center border border-gray-100 dark:border-slate-700">
                    <div className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1">RANK</div>
                    <div className={`text-6xl font-black ${rankColor} drop-shadow-sm`}>{rank}</div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="bg-gray-50 dark:bg-slate-900 p-4 rounded-xl text-center border border-gray-100 dark:border-slate-700">
                        <div className="text-sm text-[var(--text-muted)] mb-1">クリア時間</div>
                        <div className="text-2xl font-bold text-[var(--text-main)] font-mono">{timeSeconds}<span className="text-sm font-normal ml-1">秒</span></div>
                    </div>
                    <div className="bg-gray-50 dark:bg-slate-900 p-4 rounded-xl text-center border border-gray-100 dark:border-slate-700">
                        <div className="text-sm text-[var(--text-muted)] mb-1">入力速度</div>
                        <div className="text-2xl font-bold text-[var(--text-main)] font-mono">{cpm}<span className="text-sm font-normal ml-1">キー/分</span></div>
                    </div>
                    <div className="bg-gray-50 dark:bg-slate-900 p-4 rounded-xl text-center border border-gray-100 dark:border-slate-700">
                        <div className="text-sm text-[var(--text-muted)] mb-1">正確さ</div>
                        <div className="text-2xl font-bold text-[var(--text-main)] font-mono">{accuracy}<span className="text-sm font-normal ml-1">%</span></div>
                    </div>
                    <div className="bg-gray-50 dark:bg-slate-900 p-4 rounded-xl text-center border border-gray-100 dark:border-slate-700">
                        <div className="text-sm text-[var(--text-muted)] mb-1">ミス入力</div>
                        <div className="text-2xl font-bold text-[var(--wrong-color)] font-mono">{stats.mistakes}<span className="text-sm font-normal text-[var(--text-muted)] ml-1">回</span></div>
                    </div>
                </div>
            </div>

            <div id="result-actions" className="flex flex-col sm:flex-row justify-center gap-4 pt-4 border-t border-gray-100 dark:border-slate-700">
                <button onClick={handleScreenshot} className="btn btn-secondary dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:hover:bg-slate-600">
                    <div className="icon-camera"></div>
                    結果を保存
                </button>
                <button onClick={onRetry} className="btn btn-primary">
                    <div className="icon-rotate-ccw"></div>
                    もう一度プレイ
                </button>
            </div>
        </div>
    );
}

window.ResultCard = ResultCard;
