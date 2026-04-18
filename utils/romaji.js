const ROMAJI_MAP = {
    'あ':['a'], 'い':['i'], 'う':['u','wu'], 'え':['e'], 'お':['o'],
    'か':['ka','ca'], 'き':['ki'], 'く':['ku','cu','qu'], 'け':['ke'], 'こ':['ko','co'],
    'さ':['sa'], 'し':['si','shi','ci'], 'す':['su'], 'せ':['se','ce'], 'そ':['so'],
    'た':['ta'], 'ち':['ti','chi'], 'つ':['tu','tsu'], 'て':['te'], 'と':['to'],
    'な':['na'], 'に':['ni'], 'ぬ':['nu'], 'ね':['ne'], 'の':['no'],
    'は':['ha'], 'ひ':['hi'], 'ふ':['hu','fu'], 'へ':['he'], 'ほ':['ho'],
    'ま':['ma'], 'み':['mi'], 'む':['mu'], 'め':['me'], 'も':['mo'],
    'や':['ya'], 'ゆ':['yu'], 'よ':['yo'],
    'ら':['ra'], 'り':['ri'], 'る':['ru'], 'れ':['re'], 'ろ':['ro'],
    'わ':['wa'], 'を':['wo'], 'ん':['nn','n'],
    'ぁ':['xa','la'], 'ぃ':['xi','li'], 'ぅ':['xu','lu'], 'ぇ':['xe','le'], 'ぉ':['xo','lo'],
    'ゃ':['xya','lya'], 'ゅ':['xyu','lyu'], 'ょ':['xyo','lyo'], 'ゎ':['xwa','lwa'], 
    'っ':['xtu','xtsu','ltu','ltsu'],
    'が':['ga'], 'ぎ':['gi'], 'ぐ':['gu'], 'げ':['ge'], 'ご':['go'],
    'ざ':['za'], 'じ':['zi','ji'], 'ず':['zu','du'], 'ぜ':['ze'], 'ぞ':['zo'],
    'だ':['da'], 'ぢ':['di','zi','ji'], 'づ':['du','zu'], 'で':['de'], 'ど':['do'],
    'ば':['ba'], 'び':['bi'], 'ぶ':['bu'], 'べ':['be'], 'ぼ':['bo'],
    'ぱ':['pa'], 'ぴ':['pi'], 'ぷ':['pu'], 'ぺ':['pe'], 'ぽ':['po'],
    'きゃ':['kya'], 'きゅ':['kyu'], 'きょ':['kyo'],
    'しゃ':['sya','sha'], 'しゅ':['syu','shu'], 'しょ':['syo','sho'],
    'ちゃ':['tya','cha','cya'], 'ちゅ':['tyu','chu','cyu'], 'ちょ':['tyo','cho','cyo'],
    'にゃ':['nya'], 'にゅ':['nyu'], 'にょ':['nyo'],
    'ひゃ':['hya'], 'ひゅ':['hyu'], 'ひょ':['hyo'],
    'みゃ':['mya'], 'みゅ':['myu'], 'みょ':['myo'],
    'りゃ':['rya'], 'りゅ':['ryu'], 'りょ':['ryo'],
    'ぎゃ':['gya'], 'ぎゅ':['gyu'], 'ぎょ':['gyo'],
    'じゃ':['zya','ja','jya'], 'じゅ':['zyu','ju','jyu'], 'じょ':['zyo','jo','jyo'],
    'ぢゃ':['dya'], 'ぢゅ':['dyu'], 'ぢょ':['dyo'],
    'びゃ':['bya'], 'びゅ':['byu'], 'びょ':['byo'],
    'ぴゃ':['pya'], 'ぴゅ':['pyu'], 'ぴょ':['pyo'],
    'ふぁ':['fa','fwa'], 'ふぃ':['fi','fwi','fyi'], 'ふぇ':['fe','fwe','fye'], 'ふぉ':['fo','fwo'],
    'てぃ':['thi'], 'でぃ':['dhi'], 'うぃ':['wi'], 'うぇ':['we'],
    'ー':['-'], '、':[','], '。':['.'], '？':['?'], '！':['!'], ' ':[ ' ' ]
};

const VOWELS = ['a', 'i', 'u', 'e', 'o'];

function kataToHira(str) {
    return str.replace(/[\u30a1-\u30f6]/g, function(match) {
        return String.fromCharCode(match.charCodeAt(0) - 0x60);
    });
}

function tokenizeKana(rawKanaStr) {
    // Convert Katakana to Hiragana and lowercase English letters
    const kanaStr = kataToHira(rawKanaStr).toLowerCase();
    
    const tokens = [];
    let i = 0;

    while (i < kanaStr.length) {
        let matched = false;

        // Check for 2-character combos (きゃ, しゃ, etc.)
        if (i + 1 < kanaStr.length) {
            const twoChars = kanaStr.substring(i, i + 2);
            if (ROMAJI_MAP[twoChars]) {
                const combined = [...ROMAJI_MAP[twoChars]];
                // Also allow split typing (e.g. si + xyo)
                const char1 = twoChars[0];
                const char2 = twoChars[1];
                if (ROMAJI_MAP[char1] && ROMAJI_MAP[char2]) {
                    for (const r1 of ROMAJI_MAP[char1]) {
                        for (const r2 of ROMAJI_MAP[char2]) {
                            combined.push(r1 + r2);
                        }
                    }
                }
                tokens.push({ sourceIndex: i, kana: twoChars, romaji: combined });
                i += 2;
                continue;
            }
        }

        const char = kanaStr[i];

        // Ignore common symbols, so they don't need to be typed
        const SYMBOLS = ['、', '。', '！', '？', ' ', '・', '「', '」', '（', '）', ',', '.', '!', '?'];
        if (SYMBOLS.includes(char)) {
            i += 1;
            continue;
        }

        // Check for sokuon (っ)
        if (char === 'っ' && i + 1 < kanaStr.length) {
            const nextChar = kanaStr[i + 1];
            // Find what the next char would be to double its first consonant
            let nextRomajiList = ROMAJI_MAP[nextChar];
            
            // Handle cases where next char is a 2-char combo (っきゃ)
            if (i + 2 < kanaStr.length) {
                const nextTwoChars = kanaStr.substring(i + 1, i + 3);
                if (ROMAJI_MAP[nextTwoChars]) {
                    nextRomajiList = ROMAJI_MAP[nextTwoChars];
                }
            }

            if (nextRomajiList) {
                // The single consonant to type for 'っ' is the first character of the next romaji.
                // We should only do this if the first character is a consonant (and not 'n').
                const doubledConsonants = nextRomajiList
                    .map(r => r[0])
                    .filter(c => !VOWELS.includes(c) && c !== 'n');
                
                // Deduplicate
                const uniqueConsonants = [...new Set(doubledConsonants)];
                const sokuonAlone = ['xtu', 'xtsu', 'ltu', 'ltsu']; 
                
                if (uniqueConsonants.length > 0) {
                    tokens.push({ sourceIndex: i, kana: 'っ', romaji: [...uniqueConsonants, ...sokuonAlone] });
                } else {
                    tokens.push({ sourceIndex: i, kana: 'っ', romaji: sokuonAlone });
                }
                i += 1;
                continue;
            } else {
                tokens.push({ sourceIndex: i, kana: char, romaji: ['xtu', 'xtsu', 'ltu', 'ltsu'] });
                i += 1;
                continue;
            }
        }

        // Check for hatsuon (ん)
        if (char === 'ん') {
            tokens.push({ sourceIndex: i, kana: char, romaji: ['n', 'nn', 'xn'] });
            i += 1;
            continue;
        }
        
        // Check for single character
        if (ROMAJI_MAP[char]) {
            tokens.push({ sourceIndex: i, kana: char, romaji: ROMAJI_MAP[char] });
            i += 1;
            continue;
        }

        // Fallback (unknown char)
        // If it's an english letter or number, or ascii character, allow it
        if (/^[a-zA-Z0-9\-_]$/.test(char)) {
            tokens.push({ sourceIndex: i, kana: char, romaji: [char] });
        } else {
            // Ignore un-typable characters (like kanji without ruby) so they don't block typing
        }
        i += 1;
    }

    return tokens;
}

window.tokenizeKana = tokenizeKana;
