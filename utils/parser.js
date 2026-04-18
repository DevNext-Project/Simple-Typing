window.parseRuby = function(text) {
    const segments = [];
    const regex = /\{([^|]+)\|([^}]+)\}/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
        // Add plain text before the match as individual characters
        const before = text.substring(lastIndex, match.index);
        for (let char of before) {
            segments.push({ text: char, kana: char });
        }
        
        // Add the matched ruby segment
        segments.push({ text: match[1], kana: match[2] });
        lastIndex = regex.lastIndex;
    }
    
    // Add remaining plain text
    const after = text.substring(lastIndex);
    for (let char of after) {
        segments.push({ text: char, kana: char });
    }
    
    return segments;
};

window.generateTokensFromSegments = function(segments) {
    let fullKana = "";
    let indexToSeg = [];
    segments.forEach((seg, segIndex) => {
        for(let i=0; i<seg.kana.length; i++) {
            fullKana += seg.kana[i];
            indexToSeg.push(segIndex);
        }
    });

    const rawTokens = window.tokenizeKana(fullKana);
    return rawTokens.map(t => {
        return {
            ...t,
            segmentIndex: indexToSeg[t.sourceIndex]
        };
    });
};
