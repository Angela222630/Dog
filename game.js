const GameController = (() => {
  let dogState = {
    affection: 20,
    satiety: 0,
    energy: 0,
    mood: "normal",
    adopted: false,
    escaped: false,
    bitten: false,
  };


  const actionMessages = {
    feed: "好吃！狗狗的好感度上升了！",
    music: "狗狗聽到音樂，開始判斷你的品味。",
    pet: "你伸手摸摸牠，狗狗正在思考要不要相信你。",
    play: "你們一起玩了一下，狗狗看起來有點心動。",
  };


  const actionRanges = { // 每個行動對好感度的影響範圍
    feed: [0, 0],
    music: [-8, 16],
    pet: [-22, 14],
    play: [-15, 24],
  };


  let elements = {};
  let interactionCount = 0;
  let metabolismClickThreshold = 2;
  let metabolismTimerId = null;
  let metabolismStartTimerId = null;
  let metabolismStarted = false;

  const PianoMode = (() => {
    let overlay = null;
    let closeBtn = null;
    let doneBtn = null;
    let keys = null;
    let feedback = null;
    let exitCallback = null;
    let audioContext = null;

    // 儲解碼後的真實鋼琴音訊緩衝區 (AudioBuffer)
    const audioBuffers = {};

    // 使用真實鋼琴音訊採樣網址 (這裡使用開源的鋼琴採樣)
    const noteUrls = {
      C: "https://tonejs.github.io/audio/salamander/C4.mp3",
      D: "https://tonejs.github.io/audio/salamander/D4.mp3",
      E: "https://tonejs.github.io/audio/salamander/E4.mp3",
      F: "https://tonejs.github.io/audio/salamander/F4.mp3",
      G: "https://tonejs.github.io/audio/salamander/G4.mp3",
      A: "https://tonejs.github.io/audio/salamander/A4.mp3",
      B: "https://tonejs.github.io/audio/salamander/B4.mp3",
    };

    // 鍵盤熱鍵映射表：對應鍵盤 A, S, D, F, G, H, J
    const keyboardMap = {
      a: "C",
      s: "D",
      d: "E",
      f: "F",
      g: "G",
      h: "A",
      j: "B",
      A: "C",
      S: "D",
      D: "E",
      F: "F",
      G: "G",
      H: "A",
      J: "B",
    };

    function init(domElements) {
      overlay = domElements.pianoOverlay;
      closeBtn = domElements.pianoClose;
      doneBtn = domElements.pianoDone;
      keys = domElements.pianoKeys;
      feedback = domElements.pianoFeedback;

      if (!overlay) return;

      closeBtn?.addEventListener("click", close);
      doneBtn?.addEventListener("click", close);
      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) close();
      });

      keys?.forEach((key) => {
        key.addEventListener("click", () => {
          handleKeyPress(key.dataset.note);
        });
      });

      // 預先非同步載入音色庫，避免點擊時卡頓
      preloadSamples();
    }

    // 非同步預載真實鋼琴聲音
    async function preloadSamples() {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      for (const [note, url] of Object.entries(noteUrls)) {
        try {
          const response = await fetch(url);
          const arrayBuffer = await response.arrayBuffer();
          audioBuffers[note] = await audioContext.decodeAudioData(arrayBuffer);
        } catch (e) {
          console.error(`無法載入音符 ${note} 的真實音檔，將使用備用方案`, e);
        }
      }
    }

    function open(onExit) {
      if (!overlay) {
        onExit?.();
        return;
      }
      exitCallback = onExit;
      overlay.classList.add("is-open");
      overlay.setAttribute("aria-hidden", "false");
      updateFeedback(
        "進入真實鋼琴模式！可以用滑鼠點擊，或敲擊鍵盤 [ A, S, D, F, G, H, J ] 演奏輕快旋律！"
      );
      window.addEventListener("keydown", handleKeyDown);
    }

    function close() {
      if (!overlay) {
        exitCallback?.();
        return;
      }
      overlay.classList.remove("is-open");
      overlay.setAttribute("aria-hidden", "true");
      updateFeedback("開始彈奏一段輕快的旋律吧！");
      window.removeEventListener("keydown", handleKeyDown);
      exitCallback?.();
    }

    // 處理鍵盤敲擊邏輯
    function handleKeyDown(event) {
      if (event.key === " " || event.code === "Space") {
        event.preventDefault();
        playQuickRiff();
        return;
      }

      const note = keyboardMap[event.key];
      if (note) {
        handleKeyPress(note);
        triggerVisualEffect(note);
      }
    }

    // 讓畫面的琴鍵有被按下的視覺回饋
    function triggerVisualEffect(note) {
      const activeKey = overlay.querySelector(`[data-note="${note}"]`);
      if (activeKey) {
        activeKey.classList.add("active");
        setTimeout(() => activeKey.classList.remove("active"), 100);
      }
    }

    function handleKeyPress(note) {
      if (audioBuffers[note]) {
        playSample(audioBuffers[note]);
      } else {
        playBackupOscillator(note);
      }

      if (feedback) {
        feedback.textContent = `你彈了 ${note}，這清脆的鋼琴聲讓狗狗聽得好開心！`;
      }
    }

    function playSample(buffer) {
      if (audioContext.state === "suspended") {
        audioContext.resume();
      }

      const now = audioContext.currentTime;
      const bufferSource = audioContext.createBufferSource();
      const gainNode = audioContext.createGain();

      bufferSource.buffer = buffer;
      gainNode.gain.setValueAtTime(1.0, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      bufferSource.connect(gainNode);
      gainNode.connect(audioContext.destination);

      bufferSource.start(now);
      bufferSource.stop(now + 0.3);
    }

    function playQuickRiff() {
      const riff = [ //當按下空白鍵時，播放小蜜蜂
        "G", "E", "E",null,
        "F", "D", "D",null,
        "C", "D", "E", "F",
        "G", "G", "G",null,
        "G", "E", "E",null,
        "F", "D", "D",null,
        "C", "E", "G", "G",
        "C", null, null, null,
      ];

      overlay.querySelectorAll(".piano-key").forEach(key => key.classList.remove("active"));
      
      riff.forEach((note, index) => {
        setTimeout(() => {
          if (note) {
            handleKeyPress(note);
            triggerVisualEffect(note);
          } else {
            // 【修正關鍵】遇到休止符 (null) 時，主動把畫面上所有亮起的琴鍵熄滅
            // 這樣畫面的律動感才會跟著音樂節奏「一彈一跳」
            overlay.querySelectorAll(".piano-key").forEach(key => key.classList.remove("active"));
          }
        }, index * 450); 
      });

      if (feedback) {
        feedback.textContent = "🎵 你按下空白鍵，狗狗聽到小蜜蜂旋律了！";
      }
    }

    function playBackupOscillator(note) {
      const backupFreqs = {
        C: 261.6,
        D: 293.7,
        E: 329.6,
        F: 349.2,
        G: 392.0,
        A: 440.0,
        B: 493.9,
      };
      const freq = backupFreqs[note];
      if (!freq) return;

      if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioContext.state === "suspended") {
        audioContext.resume();
      }

      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.2, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.start();
      osc.stop(audioContext.currentTime + 0.2);
    }

    function updateFeedback(text) {
      if (feedback) feedback.textContent = text;
    }

    return { init, open, close };
  })();


  function init(domElements) {
    elements = domElements;
    PianoMode.init(domElements);
    bindActionButtons();
    resetGame();
  }


  function resetGame() {
    dogState = {
      affection: 20,
      satiety: getRandomInt(5, 20), // 飽足值初始值範圍
      energy: getRandomInt(70, 90), // 體力值初始值範圍
      mood: "normal",
      adopted: false,
      escaped: false,
      bitten: false,
    };
    interactionCount = 0;
    metabolismClickThreshold = getRandomInt(2, 3);
    clearMetabolismTimer();
    scheduleInitialMetabolism();
    enableButtons();
    setStatus("狗狗正在等你陪牠玩喔！");
    updateUI();
  }


  function bindActionButtons() {
    document.querySelectorAll(".game-btn").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.action;
        if (action === "music") {
          openPianoMode();
          return;
        }

        interact(action);
      });
    });
  }


  function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }


  function clearMetabolismTimer(preserveStarted = false) {
    if (metabolismTimerId !== null) {
      clearTimeout(metabolismTimerId);
      metabolismTimerId = null;
    }
    if (metabolismStartTimerId !== null) {
      clearTimeout(metabolismStartTimerId);
      metabolismStartTimerId = null;
    }
    if (!preserveStarted) {
      metabolismStarted = false;
    }
  }


  function scheduleInitialMetabolism() {
    clearMetabolismTimer();
    metabolismStarted = false;

    metabolismStartTimerId = setTimeout(() => {
      if (!dogState.adopted && !dogState.escaped && !dogState.bitten) {
        metabolismStarted = true;
        scheduleMetabolismTimer();
      }
    }, 10000); // 進入遊戲後 10 秒內不會有自動代謝變動
  }


  function scheduleMetabolismTimer() {
    clearMetabolismTimer(true);

    const delay = getRandomInt(5000, 10000); // 降低飽足值和增加體力值的頻率 5到10秒
    metabolismTimerId = setTimeout(() => {
      if (!dogState.adopted && !dogState.escaped && !dogState.bitten) {
        applyMetabolismTick("time");
      }
      scheduleMetabolismTimer();
    }, delay);
  }


  function applyMetabolismTick(source) { // 隨時間或互動次數後 降低飽足值和增加體力值
    const satietyLoss = getRandomInt(3, 7); // 每次消化減少的飽足值範圍
    const energyGain = getRandomInt(10, 25); // 每次消化增加的體力值範圍

    dogState.satiety = clamp(dogState.satiety - satietyLoss, 0, 100);
    dogState.energy = clamp(dogState.energy + energyGain, 0, 100);

    const sourceLabel = source === "time" ? "時間過去" : "互動後";
    const metabolismNote = `${sourceLabel}，狗狗餓了但恢復了體力，飽足值 -${satietyLoss}，體力值 +${energyGain}`;

    setStatus(metabolismNote);
    updateUI();
  }
  function openPianoMode() {
    pauseMetabolism();
    disableButtons();
    PianoMode.open(() => {
      interact("music");
      resumeMetabolism();
      enableButtons();
    });
  }

  function pauseMetabolism() {
    clearMetabolismTimer(true);
  }

  function resumeMetabolism() {
    if (metabolismStarted) {
      scheduleMetabolismTimer();
    } else {
      scheduleInitialMetabolism();
    }
  }

  function interact(action) {
    if (dogState.adopted || dogState.escaped || dogState.bitten) {
      return;
    }


    let delta = 0;


    let customFeedMessage = null;

    if (action === "feed") {
      if (dogState.satiety > 90) { // 如果飢餓大於90，吃東西的好感度
        customFeedMessage = "狗狗很飽了，不要再餵食啦！";
      } else if (dogState.satiety > 70) { // 如果飢餓在70到90之間，吃東西的好感度
        customFeedMessage = "狗狗吃飽了！讓牠休息一下吧。";
      }

      if (dogState.satiety < 30) { // 如果飢餓小於30，吃東西的好感度
        delta = getRandomInt(15, 22);
      } else if (dogState.satiety > 90) { // 如果飢餓大於90，吃東西的好感度
        delta = getRandomInt(0, 3);
      } else if (dogState.satiety > 70) { // 如果飢餓在70到90之間，吃東西的好感度
        delta = getRandomInt(3, 10);
      } else {
        delta = getRandomInt(10, 18);
      }


      dogState.satiety = clamp(dogState.satiety + getRandomInt(5, 23), 0, 100);
    } else {
      if (action === "play") {
        if (dogState.energy < 25) { // 如果體力小於25，玩耍的好感度
          delta = getRandomInt(-30, -15);
        } else if (dogState.energy < 45) { // 如果體力在25到45之間，玩耍的好感度
          delta = getRandomInt(-13, 5);
        } else {
          const [minDelta, maxDelta] = actionRanges[action] || [0, 0];
          delta = getRandomInt(minDelta, maxDelta);
        }
        dogState.energy = clamp(dogState.energy - getRandomInt(10, 25), 0, 100);
      } else {
        const [minDelta, maxDelta] = actionRanges[action] || [0, 0];
        delta = getRandomInt(minDelta, maxDelta);


        if (action === "music") {
          dogState.energy = clamp(dogState.energy + getRandomInt(0, 5), 0, 100);
        } else if (action === "pet") {
          dogState.energy = clamp(dogState.energy + getRandomInt(0, 3), 0, 100);
        }
      }
    }


    dogState.affection = clamp(dogState.affection + delta, 0, 100);


    let statusMessage = actionMessages[action] || "狗狗看了你一眼。";


    if (action === "play") {
      if (dogState.energy < 25) { // 如果體力值小於25
        statusMessage = "狗狗累了，不是很想一起玩耍呢！";
      } else if (dogState.energy < 45) { // 如果體力值在25到45之間
        statusMessage = "你們一起玩了一下，但狗狗似乎有些累了。";
      } else {
        statusMessage = "你們一起玩了一下，狗狗看起來有點心動。";
      }
    }


    const sign = delta >= 0 ? "+" : "";

    if (action === "feed" && customFeedMessage) {
      statusMessage = customFeedMessage;
    }

    let finalStatus = `${statusMessage}（好感度 ${sign}${delta}）`;

    interactionCount += 1;
    if (interactionCount >= metabolismClickThreshold) {
      applyMetabolismTick("click");
      interactionCount = 0;
      metabolismClickThreshold = getRandomInt(2, 3);
      finalStatus += " 再加上狗狗的消化變化！";
    }

    setStatus(finalStatus);


    updateMood();
    checkEnding();
    updateUI();
  }


  function updateMood() {
    if (dogState.affection >= 70) {
      dogState.mood = "happy";
    } else if (dogState.affection < 30) {
      dogState.mood = "angry";
    } else {
      dogState.mood = "normal";
    }
  }


  function checkEnding() {
    if (dogState.affection >= 100) {
      dogState.adopted = true;
      setStatus("狗狗願意跟你回家！");
      disableButtons();
      clearMetabolismTimer();
    }


    if (dogState.affection <= 0) {
      dogState.bitten = true;
      setStatus("狗狗咬你一口！遊戲結束。");
      disableButtons();
      clearMetabolismTimer();
    }
  }


  function updateUI() {
    const clamped = clamp(dogState.affection, 0, 100);
    const clampedSatiety = clamp(dogState.satiety, 0, 100);
    const clampedEnergy = clamp(dogState.energy, 0, 100);


    if (elements.progressFill) {
      elements.progressFill.style.width = `${clamped}%`;


      if (clamped < 40) {
        elements.progressFill.style.background = "#ff6b6b";
      } else {
        elements.progressFill.style.background = "linear-gradient(90deg, #ff9f43 0%, #4fd56f 100%)";
      }
    }


    if (elements.affectionValue) {
      elements.affectionValue.textContent = `${clamped}%`;
    }


    if (elements.satietyValue) {
      elements.satietyValue.textContent = `${clampedSatiety}%`;
    }


    if (elements.energyValue) {
      elements.energyValue.textContent = `${clampedEnergy}%`;
    }


    if (elements.dogEmoji) {
      if (dogState.adopted) {
        elements.dogEmoji.textContent = "🥰";
      } else if (dogState.bitten) {
        elements.dogEmoji.textContent = "😡";
      } else if (dogState.mood === "happy") {
        elements.dogEmoji.textContent = "😊";
      } else if (dogState.mood === "angry") {
        elements.dogEmoji.textContent = "😠";
      } else {
        elements.dogEmoji.textContent = "🐶";
      }
    }
  }


  function setStatus(text) {
    if (elements.gameStatus) {
      elements.gameStatus.textContent = text;
    }
  }


  function openGame() {
    if (elements.gameOverlay) {
      elements.gameOverlay.classList.add("is-open");
      elements.gameOverlay.setAttribute("aria-hidden", "false");
    }
  }


  function closeGame() {
    if (elements.gameOverlay) {
      elements.gameOverlay.classList.remove("is-open");
      elements.gameOverlay.setAttribute("aria-hidden", "true");
    }
  }


  function setCapturedDogImage(imageDataURL) {
    if (!elements.capturedDog || !imageDataURL) {
      return;
    }


    elements.capturedDog.src = imageDataURL;
    elements.capturedDog.classList.add("has-image");
  }


  function clearCapturedDogImage() {
    if (!elements.capturedDog) {
      return;
    }


    elements.capturedDog.removeAttribute("src");
    elements.capturedDog.classList.remove("has-image");
  }


  function disableButtons() {
    document.querySelectorAll(".game-btn").forEach((button) => {
      button.disabled = true;
    });
  }


  function enableButtons() {
    document.querySelectorAll(".game-btn").forEach((button) => {
      button.disabled = false;
    });
  }


  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }


  return {
    init,
    resetGame,
    openGame,
    closeGame,
    setCapturedDogImage,
    clearCapturedDogImage,
  };
})();
