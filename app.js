const { useState, useEffect, useRef, useCallback } = React;

let audioCtx = null;
const playTypeSound = (type, isEnabled) => {
    if (!isEnabled) return;
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        if (type === 'correct') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.1);
        } else if (type === 'wrong') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(200, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.15);
        }
    } catch (e) {
        console.error('Audio play error:', e);
    }
};

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, errorInfo) { console.error('ErrorBoundary caught an error:', error, errorInfo.componentStack); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">エラーが発生しました</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-4">予期せぬエラーが発生しました。ページを再読み込みしてください。</p>
            <button onClick={() => window.location.reload()} className="btn btn-primary">再読み込み</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const THEME_COLORS = [
  { name: 'Blue', value: '#3b82f6', hover: '#2563eb' },
  { name: 'Green', value: '#10b981', hover: '#059669' },
  { name: 'Purple', value: '#8b5cf6', hover: '#7c3aed' },
  { name: 'Orange', value: '#f97316', hover: '#ea580c' },
  { name: 'Pink', value: '#ec4899', hover: '#db2777' },
];

function App() {
  const urlParams = new URLSearchParams(window.location.search);
  const vParam = urlParams.get('v');
  const activeVersion = ['1.0.0', '1.0', '1.0.1', '1.0.2', '1.0.3'].includes(vParam) ? (vParam === '1.0' ? '1.0.0' : vParam) : '1.0.3';
  const isOldVersion = activeVersion !== '1.0.3';
  const isV1_0 = activeVersion === '1.0.0';

  const initialCustoms = JSON.parse(localStorage.getItem('customSentences') || '[]');
  const [customSentences, setCustomSentences] = useState(initialCustoms);
  const allSentences = [...window.SENTENCES, ...customSentences];

  // App Modes: 'setup', 'playing', 'result'
  const [appMode, setAppMode] = useState('setup');
  const [questionQueue, setQuestionQueue] = useState([]);
  
  // Settings
  const [targetCount, setTargetCount] = useState(5);
  const [timeLimit, setTimeLimit] = useState(60); // 0 means unlimited
  const [difficulty, setDifficulty] = useState('random'); // easy, normal, hard, random
  const [isDark, setIsDark] = useState(false);
  const [primaryColor, setPrimaryColor] = useState(THEME_COLORS[0]);
  
  // Session Stats (Cumulative)
  const [currentQuestionNum, setCurrentQuestionNumber] = useState(1);
  const [sessionTime, setSessionTime] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // Current Question State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [status, setStatus] = useState('idle'); // idle, playing, finished
  const [segments, setSegments] = useState([]);
  const [tokens, setTokens] = useState([]);
  const [currentTokenIndex, setCurrentTokenIndex] = useState(0);
  const [typedInToken, setTypedInToken] = useState("");
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRankingModal, setShowRankingModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [customInput, setCustomInput] = useState("");
  
  const [showTopNotice, setShowTopNotice] = useState(true);
  const [noticeExpanded, setNoticeExpanded] = useState(false);

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedTime = `${currentTime.getFullYear()}/${String(currentTime.getMonth()+1).padStart(2, '0')}/${String(currentTime.getDate()).padStart(2, '0')} ${String(currentTime.getHours()).padStart(2, '0')}:${String(currentTime.getMinutes()).padStart(2, '0')}`;
  
  const [settings, setSettings] = useState(() => JSON.parse(localStorage.getItem('typingSettings') || '{"isSoundOn": true, "bgImageUrl": "", "bgmUrl": "", "nickname": ""}'));
  
  const [scores, setScores] = useState(() => JSON.parse(localStorage.getItem('typingScores') || '[]'));
  const scoreSavedRef = useRef(false);
  const bgmRef = useRef(null);

  const bestScore = React.useMemo(() => {
    if (!scores || scores.length === 0) return null;
    return scores.reduce((max, obj) => (obj.cpm > max.cpm ? obj : max), scores[0]);
  }, [scores]);

  useEffect(() => {
    try {
      localStorage.setItem('typingSettings', JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save settings:', e);
      if (e.name === 'QuotaExceededError') {
        alert('ブラウザの保存容量の上限に達しました。ファイルサイズが大きすぎるため、設定を保存できませんでした。');
        setSettings(s => ({ ...s, bgImageUrl: '', bgmUrl: '' }));
      }
    }
  }, [settings]);

  useEffect(() => {
    if (bgmRef.current) {
        bgmRef.current.volume = 0.15;
        if (settings.bgmUrl) {
            bgmRef.current.play().catch(e => console.log('BGM Autoplay prevented until user interaction'));
        } else {
            bgmRef.current.pause();
        }
    }
  }, [settings.bgmUrl]);

  const handleClearScores = () => {
    if (window.confirm('すべてのプレイ履歴を消去します。よろしいですか？')) {
        setScores([]);
        localStorage.removeItem('typingScores');
    }
  };
  
  const lastUpdateRef = useRef(Date.now());
  const timerRef = useRef(null);

  const saveScore = useCallback((finalTime, finalCorrect, finalTotal, finalMistakes) => {
    if (scoreSavedRef.current) return;
    scoreSavedRef.current = true;

    const finalCpm = finalTime > 0 ? Math.round((finalCorrect / (finalTime / 1000)) * 60) : 0;
    const finalAccuracy = finalTotal > 0 ? Math.max(0, Math.round((finalCorrect / finalTotal) * 100)) : 100;
    
    let rank = 'C';
    if (finalCpm >= 300 && finalAccuracy >= 95) rank = 'S';
    else if (finalCpm >= 200 && finalAccuracy >= 90) rank = 'A';
    else if (finalCpm >= 100 && finalAccuracy >= 85) rank = 'B';

    const newScore = {
        id: Date.now(),
        date: new Date().toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
        cpm: finalCpm,
        accuracy: finalAccuracy,
        mistakes: finalMistakes,
        rank,
        targetCount,
        timeLimit,
        isTimeUp: timeLimit > 0 && finalTime >= timeLimit * 1000
    };

    setScores(prev => {
        const updated = [newScore, ...prev].slice(0, 100); // keep latest 100
        localStorage.setItem('typingScores', JSON.stringify(updated));
        return updated;
    });
  }, [targetCount, timeLimit]);

  useEffect(() => {
    document.documentElement.style.setProperty('--primary-color', primaryColor.value);
    document.documentElement.style.setProperty('--primary-hover', primaryColor.hover);
  }, [primaryColor]);

  useEffect(() => {
    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDark]);

  useEffect(() => {
    localStorage.setItem('customSentences', JSON.stringify(customSentences));
  }, [customSentences]);

  const currentSentenceText = allSentences[currentIndex] || "";

  const initQuestion = useCallback(() => {
    setStatus('idle');
    setCurrentTokenIndex(0);
    setTypedInToken("");
    lastUpdateRef.current = Date.now();
    
    if (currentSentenceText) {
      const parsed = window.parseRuby(currentSentenceText);
      const generated = window.generateTokensFromSegments(parsed);
      setSegments(parsed);
      setTokens(generated);
      
      if (generated.length === 0) {
        setStatus('finished');
      }
    }
  }, [currentSentenceText]);

  const getFilteredSentences = useCallback(() => {
    return allSentences.filter(sentence => {
      const plainText = sentence.replace(/\{([^|]+)\|[^}]+\}/g, '$1');
      const len = plainText.length;
      if (difficulty === 'easy') return len <= 12;
      if (difficulty === 'normal') return len > 12 && len <= 25;
      if (difficulty === 'hard') return len > 25;
      return true;
    });
  }, [allSentences, difficulty]);

  const advanceToNextQuestion = useCallback((nextQuestionNum) => {
    if (questionQueue.length === 0) return;
    const qIndex = (nextQuestionNum - 1) % questionQueue.length;
    setCurrentIndex(allSentences.indexOf(questionQueue[qIndex]));
  }, [questionQueue, allSentences]);

  // Handle starting the entire session
  const handleStartSession = () => {
    const available = getFilteredSentences();
    if (available.length === 0) {
      alert('該当する難易度の問題がありません。別の難易度を選択してください。');
      return;
    }

    let queue = [];
    const shuffled = [...available].sort(() => 0.5 - Math.random());
    
    if (difficulty === 'random') {
      queue = shuffled;
    } else {
      queue = shuffled.sort((a, b) => {
        const lenA = a.replace(/\{([^|]+)\|[^}]+\}/g, '$1').length;
        const lenB = b.replace(/\{([^|]+)\|[^}]+\}/g, '$1').length;
        return lenA - lenB;
      });
    }

    let finalQueue = [];
    while(finalQueue.length < targetCount) {
        finalQueue = finalQueue.concat(queue);
    }
    finalQueue = finalQueue.slice(0, targetCount);

    setQuestionQueue(finalQueue);
    scoreSavedRef.current = false;
    setCurrentQuestionNumber(1);
    setSessionTime(0);
    setMistakes(0);
    setCorrectCount(0);
    setTotalCount(0);
    
    setCurrentIndex(allSentences.indexOf(queue[0]));
    setAppMode('playing');
  };

  // When currentIndex changes, initialize the new question
  useEffect(() => {
    if (appMode === 'playing') {
      initQuestion();
    }
  }, [currentIndex, appMode, initQuestion]);

  // Main Timer (Cumulative) & Time Limit Check
  useEffect(() => {
    if (appMode === 'playing' && status === 'playing') {
      lastUpdateRef.current = Date.now();
      timerRef.current = setInterval(() => {
        const now = Date.now();
        const delta = now - lastUpdateRef.current;
        lastUpdateRef.current = now;
        
        setSessionTime(prev => {
          const newTime = prev + delta;
          if (timeLimit > 0 && newTime >= timeLimit * 1000) {
            setStatus('finished');
            setAppMode('result');
            saveScore(newTime, correctCount, totalCount, mistakes);
          }
          return newTime;
        });
      }, 100);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [appMode, status, timeLimit]);

  // Auto advance to next question or result screen
  useEffect(() => {
    if (status === 'finished' && tokens.length > 0 && appMode === 'playing') {
      const advanceTimer = setTimeout(() => {
        if (currentQuestionNum >= targetCount) {
          setAppMode('result');
          saveScore(sessionTime, correctCount, totalCount, mistakes);
        } else {
          const nextNum = currentQuestionNum + 1;
          setCurrentQuestionNumber(nextNum);
          advanceToNextQuestion(nextNum);
        }
      }, 200); // 最小限の遅延で自動スキップ
      return () => clearTimeout(advanceTimer);
    }
  }, [status, tokens.length, currentQuestionNum, targetCount, appMode, saveScore, sessionTime, correctCount, totalCount, mistakes, advanceToNextQuestion]);

  const handleKeyDown = useCallback((e) => {
    if (appMode !== 'playing' || showAddModal || status === 'finished') return;
    if (e.ctrlKey || e.altKey || e.metaKey || e.key.length > 1) return;
    if (e.key === ' ') e.preventDefault();

    const inputChar = e.key.toLowerCase();
    
    if (status === 'idle') {
      setStatus('playing');
      lastUpdateRef.current = Date.now();
    }

    const currentToken = tokens[currentTokenIndex];
    if (!currentToken) return;

    const proposedString = typedInToken + inputChar;
    const matchingRomaji = currentToken.romaji.filter(r => r.startsWith(proposedString));

    if (matchingRomaji.length > 0) {
      playTypeSound('correct', settings.isSoundOn);
      setCorrectCount(prev => prev + 1);
      setTypedInToken(proposedString);
      
      if (matchingRomaji.includes(proposedString)) {
        const updatedTokens = [...tokens];
        updatedTokens[currentTokenIndex] = { ...currentToken, typedRomaji: proposedString };
        setTokens(updatedTokens);
        setTypedInToken("");
        
        const nextIndex = currentTokenIndex + 1;
        setCurrentTokenIndex(nextIndex);
        
        if (nextIndex >= tokens.length) {
          setStatus('finished');
        }
      }
    } else {
      // 連続する「ん」の入力（nn）を許容するための特別な処理
      if (inputChar === 'n') {
        const prevToken = tokens[currentTokenIndex - 1];
        if (prevToken && prevToken.kana === 'ん' && prevToken.typedRomaji === 'n') {
           if (typedInToken === "" || typedInToken === "n") {
               const updatedTokens = [...tokens];
               updatedTokens[currentTokenIndex - 1] = { ...prevToken, typedRomaji: 'nn' };
               setTokens(updatedTokens);
               playTypeSound('correct', settings.isSoundOn);
               setCorrectCount(prev => prev + 1);
               setTotalCount(prev => prev + 1);
               return;
           }
        }
      }

      playTypeSound('wrong', settings.isSoundOn);
      setMistakes(m => m + 1);
    }
    setTotalCount(prev => prev + 1);
    
  }, [appMode, status, tokens, currentTokenIndex, typedInToken, showAddModal, settings.isSoundOn]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  const handleAddCustom = () => {
    if (customInput.trim()) {
      setCustomSentences(prev => [customInput.trim(), ...prev]);
      setCustomInput("");
    }
  };

  const handleDeleteCustom = (index) => {
    if (window.confirm('このカスタム問題を削除しますか？')) {
      setCustomSentences(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleClearCustoms = () => {
    if (window.confirm('すべてのカスタム問題を削除しますか？')) {
      setCustomSentences([]);
    }
  };

  const handleTestCustom = (sentence) => {
    setQuestionQueue([sentence]);
    scoreSavedRef.current = false;
    setCurrentQuestionNumber(1);
    setSessionTime(0);
    setMistakes(0);
    setCorrectCount(0);
    setTotalCount(0);
    setTargetCount(1);
    setTimeLimit(0); // Test mode is unlimited time
    setCurrentIndex(allSentences.indexOf(sentence));
    setAppMode('playing');
    setShowAddModal(false);
  };

  const timeSeconds = (sessionTime / 1000).toFixed(1);
  const timeLeft = Math.max(0, timeLimit - (sessionTime / 1000)).toFixed(1);
  const cpm = sessionTime > 0 ? Math.round((correctCount / (sessionTime / 1000)) * 60) : 0;
  const accuracy = totalCount > 0 ? Math.max(0, Math.round((correctCount / totalCount) * 100)) : 100;

  return (
    <div className="min-h-screen relative overflow-x-hidden select-none transition-colors duration-300" data-name="app">
      
      {settings.bgImageUrl && (
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center transition-all duration-500"
          style={{ backgroundImage: `url(${settings.bgImageUrl})` }}
        >
          <div className="absolute inset-0 bg-white/85 dark:bg-slate-900/85 backdrop-blur-[2px]"></div>
        </div>
      )}

      {settings.bgmUrl && (
        <audio ref={bgmRef} src={settings.bgmUrl} loop />
      )}

      <div className="relative z-10 py-8 px-4 sm:px-6 lg:px-8 flex flex-col items-center min-h-screen">
      
      {/* Global Top Bar */}
      <div className="w-full max-w-4xl flex justify-between items-center mb-8">
        <div className="flex gap-3">
          {appMode !== 'setup' && (
            <button 
              onClick={() => {
                if (appMode === 'playing' && !window.confirm('プレイを中断してホームに戻りますか？')) return;
                setAppMode('setup');
              }}
              className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-slate-800 px-4 py-2 rounded-full shadow-sm border border-gray-100 dark:border-slate-700 hover:text-[var(--primary-color)] transition-colors"
              title="ホームに戻る"
            >
              <div className="icon-house text-lg"></div>
              <span className="hidden sm:inline whitespace-nowrap">ホーム</span>
            </button>
          )}
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-slate-800 px-4 py-2 rounded-full shadow-sm border border-gray-100 dark:border-slate-700 hover:text-[var(--primary-color)] transition-colors shrink-0 h-fit"
          >
            <div className="icon-square-plus text-lg shrink-0"></div>
            <span className="hidden sm:inline whitespace-nowrap">カスタム問題</span>
          </button>
          
          <button 
            onClick={() => setShowRankingModal(true)}
            className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-slate-800 px-4 py-2 rounded-full shadow-sm border border-gray-100 dark:border-slate-700 hover:text-[var(--primary-color)] transition-colors shrink-0 h-fit"
          >
            <div className="icon-medal text-lg shrink-0"></div>
            <span className="hidden sm:inline whitespace-nowrap">ランキング・履歴</span>
          </button>
        </div>

        <div className="flex gap-4 items-center">
          {!isV1_0 && (
            <>
              <div className="hidden lg:block text-sm font-medium text-gray-500 dark:text-gray-400 font-mono bg-white dark:bg-slate-800 px-4 py-2 rounded-full shadow-sm border border-gray-100 dark:border-slate-700 select-text cursor-default">
                {formattedTime}
              </div>
              <a 
                href="https://devnext.yuucraft.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-800 rounded-full shadow-sm border border-gray-100 dark:border-slate-700 hover:scale-105 transition-transform overflow-hidden shrink-0"
                title="devnext.yuucraft.com"
              >
                <img src="https://app.trickle.so/storage/public/images/usr_1d6ad33b40000001/4122f154-0cf0-4796-a255-960370076dda.png" alt="DevNext" className="w-full h-full object-cover" />
              </a>
              <button 
                onClick={() => setShowInfoModal(true)}
                className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-800 rounded-full shadow-sm border border-gray-100 dark:border-slate-700 text-gray-600 dark:text-gray-300 hover:text-[var(--primary-color)] transition-all shrink-0"
                title="アップデート情報"
              >
                <div className="icon-info text-xl"></div>
              </button>
            </>
          )}
          <button 
            onClick={() => setShowSettingsModal(true)}
            className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-800 rounded-full shadow-sm border border-gray-100 dark:border-slate-700 text-gray-600 dark:text-gray-300 hover:text-[var(--primary-color)] transition-all"
            title="カスタム設定"
          >
            <div className="icon-settings text-xl"></div>
          </button>
          <div className="flex gap-2 bg-white dark:bg-slate-800 p-2 rounded-full shadow-sm border border-gray-100 dark:border-slate-700">
            {THEME_COLORS.map(color => (
              <button
                key={color.name}
                onClick={() => setPrimaryColor(color)}
                className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${primaryColor.name === color.name ? 'border-gray-800 dark:border-gray-200 scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: color.value }}
              />
            ))}
          </div>
          <button 
            onClick={() => setIsDark(!isDark)}
            className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-800 rounded-full shadow-sm border border-gray-100 dark:border-slate-700 text-gray-600 dark:text-gray-300 hover:text-[var(--primary-color)] transition-all"
          >
            <div className={`icon-${isDark ? 'sun' : 'moon'} text-xl`}></div>
          </button>
        </div>
      </div>

      {showTopNotice && (
        <div className="w-full max-w-4xl mb-6 bg-blue-50/80 dark:bg-slate-800/80 border border-blue-200 dark:border-blue-900/50 rounded-xl p-4 flex items-start gap-3 shadow-sm transition-all duration-300">
          <div className="icon-info text-[var(--primary-color)] text-xl shrink-0 mt-0.5"></div>
          <div className="flex-1 text-sm text-[var(--text-main)] leading-relaxed">
            <p>
              このソフトウェアは静的コードでGithubPagesを経由してインターネット上に配信しております。
              {!noticeExpanded && (
                <button onClick={() => setNoticeExpanded(true)} className="text-[var(--primary-color)] hover:underline ml-2 font-bold whitespace-nowrap">
                  続きを読む...
                </button>
              )}
            </p>
            {noticeExpanded && (
              <div className="mt-2 text-gray-700 dark:text-gray-300 space-y-1 transition-all duration-300">
                <p>一部教育用フィルター等ではブロックされる場合があります。</p>
                <p>このソフトウェアは教育向けにも最適なように開発され、生徒及びお客様の情報をこちら側が入手することはありません。フィルター設定等は組織などでお願いします。</p>
                <button onClick={() => setNoticeExpanded(false)} className="text-[var(--primary-color)] hover:underline mt-2 font-bold text-xs">
                  一部を隠す
                </button>
              </div>
            )}
          </div>
          <button onClick={() => setShowTopNotice(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0 p-1 transition-colors" title="閉じる">
            <div className="icon-x text-xl"></div>
          </button>
        </div>
      )}

      <div className="w-full max-w-4xl">
        
        {appMode === 'setup' && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="icon-keyboard text-6xl text-[var(--primary-color)] mb-6"></div>
            <h1 className="text-4xl font-bold text-[var(--text-main)] mb-4">Simple Typing</h1>
            <p className="text-[var(--text-muted)] mb-6 text-center max-w-md">
              高性能・美しいUIで誰でも使いやすいタイピング練習Webサイトです。<br/>
              すべての機能が無料で、カスタマイズ性も抜群です
            </p>

            {!isV1_0 && bestScore && (
              <div 
                onClick={() => setShowRankingModal(true)}
                className="mb-8 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/30 dark:to-orange-900/30 border border-yellow-200 dark:border-yellow-700/50 rounded-full px-6 py-2.5 flex items-center gap-3 shadow-sm cursor-pointer hover:scale-105 transition-transform"
                title="ランキング・履歴を見る"
              >
                <div className="icon-trophy text-yellow-500 text-xl"></div>
                <div className="flex items-baseline gap-2 sm:gap-3">
                  <span className="text-sm font-bold text-yellow-700 dark:text-yellow-500 hidden sm:inline">ハイスコア:</span>
                  <span className="text-xl font-black font-mono text-gray-800 dark:text-gray-100">{bestScore.cpm}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">キー/分</span>
                  <span className="text-sm font-bold text-gray-400">|</span>
                  <span className="text-sm font-bold text-gray-700 dark:text-gray-300">正確さ {bestScore.accuracy}%</span>
                  <span className="text-sm font-bold text-gray-400">|</span>
                  <span className={`text-lg font-black ${bestScore.rank === 'S' ? 'text-yellow-500' : bestScore.rank === 'A' ? 'text-green-500' : bestScore.rank === 'B' ? 'text-blue-500' : 'text-gray-500'}`}>
                    {bestScore.rank}
                  </span>
                </div>
              </div>
            )}
            
            <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 flex flex-col items-center w-full max-w-md">
              
              {/* Difficulty */}
              <div className="w-full mb-8">
                <div className="flex justify-between items-center mb-3 px-2">
                  <label className="text-[var(--text-main)] font-bold block">難易度</label>
                  <span className="text-xs text-[var(--text-muted)]">文字数で変動</span>
                </div>
                <div className="grid grid-cols-4 gap-2 bg-gray-100 dark:bg-slate-700 p-1 rounded-xl">
                  {[
                    { id: 'easy', label: '簡単' },
                    { id: 'normal', label: '普通' },
                    { id: 'hard', label: '難しい' },
                    { id: 'random', label: 'ランダム' }
                  ].map(level => (
                    <button
                      key={level.id}
                      onClick={() => setDifficulty(level.id)}
                      className={`py-2 text-sm font-bold rounded-lg transition-all ${difficulty === level.id ? 'bg-white dark:bg-slate-800 text-[var(--primary-color)] shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-600'}`}
                    >
                      {level.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Question Count */}
              <div className="w-full mb-8">
                <div className="flex justify-between items-center mb-3 px-2">
                  <label className="text-[var(--text-main)] font-bold block">問題数</label>
                  <div className="text-xs text-[var(--text-muted)] bg-blue-50 dark:bg-slate-700 px-2 py-1 rounded-md">
                    推奨時間: <span className="font-bold">{targetCount * 8}秒</span>
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-slate-900/50 p-4 rounded-xl border border-gray-100 dark:border-slate-700">
                  <div className="flex justify-between items-end mb-4 px-2">
                    <span className="text-gray-400 dark:text-slate-500 font-medium text-sm">5</span>
                    <span className="text-4xl font-black text-[var(--primary-color)]">{targetCount}<span className="text-lg font-bold ml-1 text-[var(--text-main)]">問</span></span>
                    <span className="text-gray-400 dark:text-slate-500 font-medium text-sm">100</span>
                  </div>
                  <input 
                    type="range" 
                    min="5" max="100" step="5" 
                    value={targetCount} 
                    onChange={(e) => {
                      const newCount = Number(e.target.value);
                      setTargetCount(newCount);
                      setTimeLimit(newCount * 8);
                    }}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-600"
                  />
                </div>
              </div>

              {/* Time Limit */}
              <div className="w-full mb-8">
                <div className="flex justify-between items-center mb-3 px-2">
                  <label className="text-[var(--text-main)] font-bold block">制限時間</label>
                  <label className="flex items-center gap-2 text-sm text-[var(--text-muted)] cursor-pointer hover:text-[var(--text-main)] transition-colors bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded-md">
                    <input 
                      type="checkbox" 
                      checked={timeLimit === 0} 
                      onChange={(e) => setTimeLimit(e.target.checked ? 0 : 60)} 
                      className="w-4 h-4 rounded text-[var(--primary-color)] focus:ring-[var(--primary-color)] border-gray-300"
                    />
                    <span className="font-bold">無制限</span>
                  </label>
                </div>
                
                <div className="bg-gray-50 dark:bg-slate-900/50 p-4 rounded-xl border border-gray-100 dark:border-slate-700">
                  {timeLimit > 0 ? (
                    <>
                      <div className="flex justify-between items-end mb-4 px-2">
                        <span className="text-gray-400 dark:text-slate-500 font-medium text-sm">30秒</span>
                        <span className="text-3xl font-black text-[var(--primary-color)]">
                          {timeLimit >= 60 ? `${Math.floor(timeLimit / 60)}分${timeLimit % 60 > 0 ? `${timeLimit % 60}秒` : ''}` : `${timeLimit}秒`}
                        </span>
                        <span className="text-gray-400 dark:text-slate-500 font-medium text-sm">30分</span>
                      </div>
                      <input 
                        type="range" 
                        min="30" max="1800" step="10" 
                        value={timeLimit} 
                        onChange={(e) => setTimeLimit(Number(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-600"
                      />
                    </>
                  ) : (
                    <div className="py-4 text-center">
                      <span className="text-lg font-bold text-[var(--text-muted)]">時間無制限モード</span>
                    </div>
                  )}
                </div>
              </div>
              
              <button 
                onClick={handleStartSession}
                className="w-full btn btn-primary text-xl py-4 shadow-md shadow-blue-500/20 font-bold rounded-xl mt-2"
              >
                <div className="icon-circle-play text-2xl"></div>
                スタート
              </button>
            </div>
          </div>
        )}

        {appMode === 'playing' && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <h1 className="text-2xl font-bold text-[var(--text-main)] flex items-center gap-3">
                <div className="icon-keyboard text-[var(--primary-color)]"></div>
                Simple Typing
              </h1>
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="bg-white dark:bg-slate-800 text-[var(--primary-color)] px-3 py-1.5 rounded-full font-bold shadow-sm border border-blue-100 dark:border-slate-700 text-sm sm:text-base">
                  残り {Math.max(0, targetCount - currentQuestionNum)}問
                </div>
                <div className="bg-[var(--primary-color)] text-white px-3 py-1.5 rounded-full font-bold shadow-sm text-sm sm:text-base">
                  {currentQuestionNum} / {targetCount}問
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <window.StatsCard 
                icon="timer" 
                label={timeLimit > 0 ? "残り時間" : "合計時間"} 
                value={timeLimit > 0 ? timeLeft : timeSeconds} 
                unit="秒" 
                className={timeLimit > 0 && timeLeft <= 10 ? "text-red-500" : ""}
              />
              <window.StatsCard icon="gauge" label="平均速度" value={cpm} unit="キー/分" />
              <window.StatsCard icon="circle-check" label="正確さ" value={accuracy} unit="%" />
              <window.StatsCard icon="file-text" label="ミス合計" value={mistakes} unit="回" />
            </div>

            {/* Typing Area */}
            <div className="bg-white dark:bg-slate-800 p-6 sm:p-10 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 mb-8 relative outline-none transition-all duration-300">
              
              {status === 'finished' && tokens.length > 0 && (
                <div className="absolute top-4 right-4 flex items-center gap-2 text-green-600 dark:text-green-400 font-bold bg-green-50 dark:bg-green-900/30 px-4 py-2 rounded-lg z-10 animate-pulse">
                  <div className="icon-circle-check"></div>
                  クリア！
                </div>
              )}

              {/* Original Text with Segmented Highlights */}
              <div className="mb-6 text-2xl sm:text-3xl font-bold break-words leading-relaxed tracking-wide">
                {segments.map((seg, i) => {
                  let statusClass = 'text-[var(--text-main)]'; 
                  const segTokens = tokens.filter(t => t.segmentIndex === i);
                  
                  if (segTokens.length === 0) {
                    const currentSegIndex = tokens[currentTokenIndex]?.segmentIndex ?? tokens.length;
                    if (i < currentSegIndex) statusClass = 'text-[var(--correct-color)] opacity-70';
                    else statusClass = 'text-gray-400 dark:text-slate-500';
                  } else {
                    const allPast = segTokens.every(t => tokens.indexOf(t) < currentTokenIndex);
                    const anyCurrent = segTokens.some(t => tokens.indexOf(t) === currentTokenIndex);
                    if (allPast) statusClass = 'text-[var(--correct-color)]';
                    else if (anyCurrent) statusClass = 'text-[var(--primary-color)] underline decoration-2 underline-offset-4';
                  }
                  return <span key={i} className={`transition-colors duration-200 ${statusClass}`}>{seg.text}</span>;
                })}
              </div>

              <hr className="mb-6 border-gray-100 dark:border-slate-700" />

              {/* Tokens Display */}
              <div className="flex flex-wrap gap-x-1 gap-y-4 font-mono text-xl sm:text-3xl">
                {tokens.map((token, index) => {
                  const isPast = index < currentTokenIndex;
                  const isCurrent = index === currentTokenIndex;
                  const isFuture = index > currentTokenIndex;
                  
                  let typedPart = "";
                  let untypedPart = token.romaji[0];

                  if (isPast) {
                    typedPart = token.typedRomaji || token.romaji[0];
                    untypedPart = "";
                  } else if (isCurrent) {
                    const bestMatch = token.romaji.find(r => r.startsWith(typedInToken)) || token.romaji[0];
                    typedPart = typedInToken;
                    untypedPart = bestMatch.substring(typedInToken.length);
                  }

                  return (
                    <div key={index} className={`flex flex-col items-center transition-transform duration-75 ${isCurrent ? 'scale-110 -translate-y-1' : ''}`}>
                      <div className={`text-sm sm:text-base font-sans mb-1 font-bold ${isPast ? 'text-gray-300 dark:text-slate-600' : isCurrent ? 'text-[var(--primary-color)]' : 'text-gray-500 dark:text-slate-500'}`}>
                        {token.kana}
                      </div>
                      <div className="flex">
                        <span className="text-[var(--text-main)] font-bold">{typedPart}</span>
                        <span className={`
                          ${isCurrent ? 'text-gray-400 dark:text-slate-400 bg-gray-100 dark:bg-slate-700 rounded-sm' : ''} 
                          ${isFuture ? 'text-gray-300 dark:text-slate-600' : ''}
                          ${isCurrent && untypedPart.length > 0 ? 'border-b-2 border-[var(--primary-color)]' : ''}
                        `}>
                          {untypedPart}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-center gap-4">
              <button onClick={() => setAppMode('setup')} className="btn btn-secondary dark:bg-slate-800 dark:border-slate-700 dark:text-gray-300">
                やめる
              </button>
              <button 
                onClick={() => {
                  if (currentQuestionNum >= targetCount) setAppMode('result');
                  else {
                    const nextNum = currentQuestionNum + 1;
                    setCurrentQuestionNumber(nextNum);
                    advanceToNextQuestion(nextNum);
                  }
                }} 
                className="btn btn-primary"
              >
                スキップ
                <div className="icon-arrow-right"></div>
              </button>
            </div>
          </>
        )}

        {appMode === 'result' && (
          <window.ResultCard 
            stats={{ elapsedTime: sessionTime, timeLimit, targetCount, currentQuestionNum, correctCount, totalCount, mistakes }} 
            nickname={settings.nickname}
            onRetry={() => setAppMode('setup')} 
          />
        )}
      </div>

      {/* Footer */}
      <div className="w-full max-w-4xl mt-auto pt-12 pb-6 flex flex-col items-center justify-center gap-3">
        <button 
          onClick={() => setShowAboutModal(true)}
          className="text-sm text-[var(--primary-color)] hover:underline font-bold flex items-center gap-1.5"
        >
          <div className="icon-info"></div>
          このソフトについて
        </button>
        <div className="text-xs text-gray-400 dark:text-slate-500 font-medium">
          Created by ゆーくら devnext-project.netのタイピングゲーム。
        </div>
      </div>

      {/* About Modal */}
      {showAboutModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md shadow-xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-6 shrink-0">
              <h2 className="text-xl font-bold text-[var(--text-main)] flex items-center gap-2">
                <div className="icon-info text-[var(--primary-color)]"></div>
                このソフトについて
              </h2>
              <button onClick={() => setShowAboutModal(false)} className="text-gray-500 hover:text-gray-800 dark:hover:text-white">
                <div className="icon-x text-2xl"></div>
              </button>
            </div>
            
            <div className="space-y-4 text-sm text-[var(--text-main)] leading-relaxed overflow-y-auto pr-2 flex-1">
              <p>
                このタイピングゲームは、サーバーサイドの処理を持たない<strong>完全な静的コードのみ（HTML/CSS/JavaScript）</strong>で作成されています。
              </p>
              <div className="bg-blue-50 dark:bg-slate-700/50 p-4 rounded-xl border border-blue-100 dark:border-slate-600 space-y-3">
                <p>
                  <strong>1. 安全性と機能の制限について</strong><br/>
                  静的コードであるため、プログラム上インターネット全体でのスコア共有機能などはご利用いただけません。その代わり、インターネットでのデータ共有が制限されることで、安全性が確保されやすいというメリットがあります。
                </p>
                <p>
                  <strong>2. データ保存とバックアップについて</strong><br/>
                  お客様情報（プレイ履歴や設定など）はすべてお客様自身のWebブラウザに保存されています。履歴やCookieなどのブラウザデータを削除しますと、データが消失・破損し正常に作動しなくなりますのでご注意ください。なお、現在バックアップ機能は備わっておりません。
                </p>
              </div>

              <div className="bg-gray-50 dark:bg-slate-900 p-4 rounded-xl border border-gray-100 dark:border-slate-700 mt-6 space-y-3">
                <p className="font-bold text-[var(--text-main)] border-b border-gray-200 dark:border-slate-700 pb-2 flex items-center gap-2">
                  <span className="icon-code"></span>コードの特徴と工夫点
                </p>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2 list-disc list-inside">
                  <li><strong>高度な入力判定:</strong> 「し」を「shi」「si」どちらでも打てるなど、柔軟な複数パターンのローマ字入力アルゴリズムを独自実装しています。</li>
                  <li><strong>ルビ構文とハイライト:</strong> <code>{'{漢字|かんじ}'}</code>の構文をパースし、入力進行度に合わせて文字単位でリアルタイムに色が変わるUIを実現しています。</li>
                  <li><strong>遅延のない音声:</strong> Web Audio API (Oscillator) を用いることで、音声ファイルを読み込まず、打鍵と完全に同期した正解・エラー音を生成しています。</li>
                  <li><strong>モダンな技術構成:</strong> React 18とTailwindCSSをCDN経由で利用し、ビルド不要の完全な静的ファイル（SPA）として完結させています。</li>
                </ul>
              </div>

              <div className="bg-gray-50 dark:bg-slate-900 p-4 rounded-xl border border-gray-100 dark:border-slate-700 mt-6">
                <p className="font-bold mb-2 text-[var(--text-main)]">ソースコードの公開について</p>
                <p className="text-gray-600 dark:text-gray-400 mb-3 text-xs">
                  本プロジェクトのソースコードはGitHubにて公開しています。学習やカスタマイズにお役立てください。
                </p>
                <a 
                  href="#" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="inline-flex items-center gap-1.5 text-[var(--primary-color)] hover:text-[var(--primary-hover)] hover:underline font-bold"
                >
                  <div className="icon-external-link"></div>
                  GitHubリポジトリを見る（準備中）
                </a>
              </div>
            </div>

            <div className="mt-6 flex justify-end shrink-0">
              <button 
                onClick={() => setShowAboutModal(false)}
                className="px-6 py-2 rounded-lg font-medium bg-[var(--primary-color)] text-white hover:bg-[var(--primary-hover)] transition-colors shadow-sm"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ranking Modal */}
      {showRankingModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-2xl shadow-xl flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center mb-6 shrink-0">
              <h2 className="text-2xl font-bold text-[var(--text-main)] flex items-center gap-2">
                <div className="icon-medal text-[var(--primary-color)]"></div>
                プレイ履歴
              </h2>
              <div className="flex items-center gap-4">
                {scores.length > 0 && (
                  <button onClick={handleClearScores} className="text-sm flex items-center gap-1 text-red-500 hover:text-red-700 font-medium px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors">
                    <div className="icon-trash"></div>
                    履歴を消去
                  </button>
                )}
                <button onClick={() => setShowRankingModal(false)} className="text-gray-500 hover:text-gray-800 dark:hover:text-white">
                  <div className="icon-x text-2xl"></div>
                </button>
              </div>
            </div>
            
            <div className="overflow-y-auto pr-2 flex-1">
              {scores.length === 0 ? (
                <p className="text-center text-gray-500 py-10">まだプレイ履歴がありません。<br/>プレイして記録を残しましょう！</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {scores.map((score, idx) => (
                    <div key={score.id} className="bg-gray-50 dark:bg-slate-900 rounded-xl p-4 flex flex-col sm:flex-row items-center gap-4 border border-gray-100 dark:border-slate-700">
                      <div className="flex items-center gap-4 w-full sm:w-auto">
                        <div className="w-8 text-center text-gray-400 font-bold">#{idx + 1}</div>
                        <div className={`w-12 h-12 flex items-center justify-center rounded-full text-2xl font-black bg-white dark:bg-slate-800 shadow-sm
                          ${score.rank === 'S' ? 'text-yellow-500' : score.rank === 'A' ? 'text-green-500' : score.rank === 'B' ? 'text-blue-500' : 'text-gray-500'}
                        `}>
                          {score.rank}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm text-gray-500">{score.date}</span>
                          <span className="text-xs text-gray-400">
                            {score.targetCount}問 / {score.timeLimit === 0 ? '無制限' : `${score.timeLimit}秒`}
                            {score.isTimeUp && ' (時間切れ)'}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex-1 flex justify-end gap-6 w-full sm:w-auto text-center sm:text-left">
                        <div>
                          <div className="text-xs text-gray-500 mb-1">速度</div>
                          <div className="font-mono font-bold text-[var(--text-main)]">{score.cpm} <span className="text-xs font-normal">キー/分</span></div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">正確さ</div>
                          <div className="font-mono font-bold text-[var(--text-main)]">{score.accuracy} <span className="text-xs font-normal">%</span></div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">ミス</div>
                          <div className="font-mono font-bold text-[var(--wrong-color)]">{score.mistakes} <span className="text-xs font-normal text-gray-500">回</span></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Custom Modal (Manager) */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-2xl shadow-xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-4 shrink-0">
              <h2 className="text-xl font-bold text-[var(--text-main)] flex items-center gap-2">
                <div className="icon-square-plus text-[var(--primary-color)]"></div>
                カスタム問題の管理
              </h2>
              <button onClick={() => setShowAddModal(false)} className="text-gray-500 hover:text-gray-800 dark:hover:text-white">
                <div className="icon-x text-2xl"></div>
              </button>
            </div>
            
            <div className="flex flex-col gap-4 overflow-y-auto pr-2 flex-1">
              <div className="bg-gray-50 dark:bg-slate-900 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-3">
                  漢字と読みがなを対応させるには、<code className="bg-gray-200 dark:bg-slate-600 px-1 py-0.5 rounded">{"{漢字|かんじ}"}</code> の形式で入力してください。<br/>
                  例: <code className="bg-gray-200 dark:bg-slate-600 px-1 py-0.5 rounded">{"{健|けん}{康|こう}のため"}</code> と入力すると、「けん」を打った時点で「健」だけが緑になります。
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <textarea
                    className="flex-1 min-h-[60px] p-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-[var(--text-main)] focus:ring-2 focus:ring-[var(--primary-color)] outline-none text-sm"
                    placeholder="例: {健|けん}{康|こう}のために、{毎|まい}{朝|あさ}走ります。"
                    value={customInput}
                    onChange={e => setCustomInput(e.target.value)}
                  />
                  <button 
                    onClick={handleAddCustom}
                    className="whitespace-nowrap px-4 py-2 h-fit rounded-lg font-bold bg-[var(--primary-color)] text-white hover:bg-[var(--primary-hover)] shadow-sm self-end sm:self-center flex items-center gap-1"
                  >
                    <div className="icon-plus"></div>
                    追加
                  </button>
                </div>
              </div>

              <div className="mt-2">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-bold text-[var(--text-main)] text-sm">登録済みのカスタム問題 ({customSentences.length}件)</h3>
                  {customSentences.length > 0 && (
                    <button onClick={handleClearCustoms} className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1">
                      <div className="icon-trash"></div>
                      一括削除
                    </button>
                  )}
                </div>
                
                {customSentences.length === 0 ? (
                  <div className="text-center text-gray-400 dark:text-slate-500 py-6 border border-dashed border-gray-300 dark:border-slate-700 rounded-xl">
                    追加された問題はありません
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {customSentences.map((sentence, idx) => (
                      <div key={idx} className="flex justify-between items-center gap-4 bg-white dark:bg-slate-800 p-3 rounded-lg border border-gray-100 dark:border-slate-700 shadow-sm">
                        <div className="flex-1 truncate text-sm text-[var(--text-main)] font-medium">
                          {sentence}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button 
                            onClick={() => handleTestCustom(sentence)}
                            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-[var(--primary-color)] text-xs font-bold rounded-md transition-colors"
                          >
                            テストプレイ
                          </button>
                          <button 
                            onClick={() => handleDeleteCustom(idx)}
                            className="p-1.5 text-gray-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 transition-colors"
                            title="削除"
                          >
                            <div className="icon-trash"></div>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            <div className="mt-4 flex justify-end shrink-0 pt-4 border-t border-gray-100 dark:border-slate-700">
              <button 
                onClick={() => setShowAddModal(false)}
                className="px-6 py-2 rounded-lg font-medium bg-[var(--primary-color)] text-white hover:bg-[var(--primary-hover)] transition-colors shadow-sm"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-6 shrink-0">
              <h2 className="text-xl font-bold text-[var(--text-main)] flex items-center gap-2">
                <div className="icon-info text-[var(--primary-color)]"></div>
                アップデート情報
              </h2>
              <button onClick={() => setShowInfoModal(false)} className="text-gray-500 hover:text-gray-800 dark:hover:text-white">
                <div className="icon-x text-2xl"></div>
              </button>
            </div>
            
            <div className="overflow-y-auto pr-2 space-y-6">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 p-4 rounded-xl border border-blue-100 dark:border-blue-800/50">
                <h3 className="font-bold text-[var(--primary-color)] mb-2 flex items-center gap-2">
                  <div className="icon-megaphone"></div>
                  お知らせ
                </h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  devnext-project.netは夏頃からの活動を予定しております。<br/>
                  GithubPagesでの無償内部配布を中心に、静的コードで構築されたツール類を誰でも見やすいように配信しております。
                </p>
              </div>

              <div className="border-l-2 border-[var(--primary-color)] pl-4">
                <div className="text-xs text-gray-500 mb-1">2026/04/20</div>
                <div className="font-bold text-[var(--text-main)] mb-2">v1.0.3 自動スキップ・ニックネーム機能</div>
                <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1 list-disc list-inside">
                  <li>問題クリア時の自動スキップを高速化しました。</li>
                  <li>成績画面に表示されるニックネーム設定を追加しました。</li>
                  <li>検定モードを削除しました。</li>
                </ul>
              </div>

              <div className="border-l-2 border-gray-300 dark:border-slate-600 pl-4 opacity-80 mt-4">
                <div className="text-xs text-gray-500 mb-1">2026/04/18</div>
                <div className="font-bold text-[var(--text-main)] mb-2">v1.0.2 コンテンツ・管理機能拡充</div>
                <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1 list-disc list-inside mb-3">
                  <li>タイピングの課題文を大幅に増量しました。</li>
                  <li>「検定(長文)」の難易度モードを追加しました。</li>
                  <li>カスタム問題の一覧表示、個別テストプレイ、削除機能を実装しました。</li>
                </ul>
                <a href="?v=1.0.2" className="inline-flex items-center gap-1.5 text-xs bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 px-3 py-1.5 rounded-lg transition-colors font-medium text-[var(--text-main)] shadow-sm">
                  <div className="icon-history"></div>
                  v1.0.2 を起動する
                </a>
              </div>

              <div className="border-l-2 border-gray-300 dark:border-slate-600 pl-4 opacity-80 mt-4">
                <div className="text-xs text-gray-500 mb-1">2026/04/17</div>
                <div className="font-bold text-[var(--text-main)] mb-2">v1.0.1 機能追加・UI改善</div>
                <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1 list-disc list-inside mb-3">
                  <li>ハイスコアの表示と現在時刻の時計を追加しました。</li>
                </ul>
                <a href="?v=1.0.1" className="inline-flex items-center gap-1.5 text-xs bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 px-3 py-1.5 rounded-lg transition-colors font-medium text-[var(--text-main)] shadow-sm">
                  <div className="icon-history"></div>
                  v1.0.1 を起動する
                </a>
              </div>

              <div className="border-l-2 border-gray-300 dark:border-slate-600 pl-4 opacity-80 mt-4">
                <div className="text-xs text-gray-500 mb-1">2026/4/10</div>
                <div className="font-bold text-[var(--text-main)] mb-2">v1.0.0 正式リリース</div>
                <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1 list-disc list-inside mb-3">
                  <li>本格的なローマ字入力（複数パターン対応）の基本機能を実装しました。</li>
                  <li>成績のランキング機能、カスタム問題機能を追加しました。</li>
                  <li>背景画像、BGM、各種テーマカラーの設定に対応しました。</li>
                </ul>
                <a href="?v=1.0.0" className="inline-flex items-center gap-1.5 text-xs bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 px-3 py-1.5 rounded-lg transition-colors font-medium text-[var(--text-main)] shadow-sm">
                  <div className="icon-history"></div>
                  v1.0.0 を起動する
                </a>
              </div>
            </div>

            <div className="mt-6 flex justify-end shrink-0">
              <button 
                onClick={() => setShowInfoModal(false)}
                className="px-6 py-2 rounded-lg font-medium bg-[var(--primary-color)] text-white hover:bg-[var(--primary-hover)] transition-colors shadow-sm"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Old Version Banner */}
      {isOldVersion && (
        <div className="fixed bottom-6 right-6 bg-slate-800 text-white px-5 py-3 rounded-xl shadow-2xl z-50 flex items-center gap-4 border border-slate-700 animate-[pulse_2s_ease-in-out_infinite]">
          <div className="flex flex-col">
            <span className="text-xs text-slate-400 font-bold">旧バージョン</span>
            <span className="text-sm font-medium">現在 v{activeVersion} を実行中</span>
          </div>
          <a href="?" className="text-xs font-bold bg-[var(--primary-color)] hover:bg-[var(--primary-hover)] px-3 py-2 rounded-lg transition-colors shadow-sm whitespace-nowrap">
            最新版に戻る
          </a>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-6 shrink-0">
              <h2 className="text-xl font-bold text-[var(--text-main)] flex items-center gap-2">
                <div className="icon-settings text-[var(--primary-color)]"></div>
                カスタム設定
              </h2>
              <button onClick={() => setShowSettingsModal(false)} className="text-gray-500 hover:text-gray-800 dark:hover:text-white">
                <div className="icon-x text-2xl"></div>
              </button>
            </div>

            <div className="space-y-6 overflow-y-auto pr-2 flex-1">
              {/* Nickname Setting */}
              <div>
                <div className="flex justify-between items-end mb-1">
                  <label className="block font-bold text-[var(--text-main)]">ニックネーム</label>
                </div>
                <div className="text-xs text-gray-500 mb-2">結果画面でランダムな応援メッセージとともに表示される名前です。</div>
                <input 
                  type="text" 
                  value={settings.nickname || ""}
                  onChange={e => setSettings(s => ({ ...s, nickname: e.target.value }))}
                  placeholder="例: ゲスト"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-900 text-[var(--text-main)] focus:ring-2 focus:ring-[var(--primary-color)] outline-none"
                />
              </div>

              {/* Typing Sound Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-[var(--text-main)]">タイプ音</div>
                  <div className="text-sm text-gray-500">キー入力時の正解・ミス音を鳴らす</div>
                </div>
                <button 
                  onClick={() => setSettings(s => ({ ...s, isSoundOn: !s.isSoundOn }))}
                  className={`w-12 h-6 rounded-full relative transition-colors ${settings.isSoundOn ? 'bg-[var(--primary-color)]' : 'bg-gray-300 dark:bg-slate-600'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${settings.isSoundOn ? 'left-7' : 'left-1'}`}></div>
                </button>
              </div>

              {/* Background Image URL / Upload */}
              <div>
                <div className="flex justify-between items-end mb-1">
                  <label className="block font-bold text-[var(--text-main)]">背景画像</label>
                  {settings.bgImageUrl && (
                    <button onClick={() => setSettings(s => ({ ...s, bgImageUrl: '' }))} className="text-xs text-red-500 hover:text-red-700 font-medium">画像設定をリセット</button>
                  )}
                </div>
                <div className="text-xs text-gray-500 mb-2">画像のURLを指定するか、直接アップロードできます。設定はブラウザに保存されます。</div>
                <div className="flex flex-col gap-2">
                  <input 
                    type="text" 
                    value={settings.bgImageUrl}
                    onChange={e => setSettings(s => ({ ...s, bgImageUrl: e.target.value }))}
                    placeholder="https://example.com/image.png"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-900 text-[var(--text-main)] focus:ring-2 focus:ring-[var(--primary-color)] outline-none"
                  />
                  <label className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors shadow-sm">
                    <div className="icon-image text-lg"></div>
                    画像をアップロード
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => setSettings(s => ({ ...s, bgImageUrl: event.target.result }));
                          reader.readAsDataURL(file);
                        }
                      }} 
                    />
                  </label>
                </div>
              </div>

              {/* BGM URL / Upload */}
              <div>
                <div className="flex justify-between items-end mb-1">
                  <label className="block font-bold text-[var(--text-main)]">BGM</label>
                  {settings.bgmUrl && (
                    <button onClick={() => setSettings(s => ({ ...s, bgmUrl: '' }))} className="text-xs text-red-500 hover:text-red-700 font-medium">BGM設定をリセット</button>
                  )}
                </div>
                <div className="text-xs text-gray-500 mb-2">音楽ファイルのURLを指定するか、直接アップロードできます（バックグラウンドでループ再生されます）。</div>
                <div className="flex flex-col gap-2">
                  <input 
                    type="text" 
                    value={settings.bgmUrl}
                    onChange={e => setSettings(s => ({ ...s, bgmUrl: e.target.value }))}
                    placeholder="https://example.com/bgm.mp3"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-900 text-[var(--text-main)] focus:ring-2 focus:ring-[var(--primary-color)] outline-none"
                  />
                  <label className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors shadow-sm">
                    <div className="icon-music text-lg"></div>
                    音楽をアップロード
                    <input 
                      type="file" 
                      accept="audio/*" 
                      className="hidden" 
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => setSettings(s => ({ ...s, bgmUrl: event.target.result }));
                          reader.readAsDataURL(file);
                        }
                      }} 
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end shrink-0">
              <button 
                onClick={() => setShowSettingsModal(false)}
                className="px-6 py-2 rounded-lg font-medium bg-[var(--primary-color)] text-white hover:bg-[var(--primary-hover)]"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
      
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
