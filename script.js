const cameraToggle = document.getElementById("cameraToggle");
const previewBox = document.getElementById("previewBox");
const cameraFeed = document.getElementById("cameraFeed");
const resultLabel = document.getElementById("resultLabel");
const resultConfidence = document.getElementById("resultConfidence");
const statusText = document.getElementById("statusText");
const triggerBadge = document.getElementById("triggerBadge");
const gameOverlay = document.getElementById("gameOverlay");
const gameClose = document.getElementById("gameClose");
const pianoOverlay = document.getElementById("pianoOverlay");
const pianoClose = document.getElementById("pianoClose");
const pianoDone = document.getElementById("pianoDone");
const pianoKeys = document.querySelectorAll(".piano-key");
const pianoFeedback = document.getElementById("pianoFeedback");
const progressFill = document.getElementById("progressFill");
const affectionValue = document.getElementById("affectionValue");
const satietyValue = document.getElementById("satietyValue");
const energyValue = document.getElementById("energyValue");
const gameStatus = document.getElementById("gameStatus");
const dogEmoji = document.getElementById("dogEmoji");
const capturedDog = document.getElementById("capturedDog");

let currentStream = null;
let currentFacingMode = "environment";
let cameraSwitchButton = null;
let dogDetected = false;
let capturedDogImage = null;

GameController.init({
  gameOverlay,
  pianoOverlay,
  pianoClose,
  pianoDone,
  pianoKeys,
  pianoFeedback,
  progressFill,
  affectionValue,
  satietyValue,
  energyValue,
  gameStatus,
  dogEmoji,
  capturedDog,
});

async function initPage() {
  createCameraSwitchButton();
  statusText.textContent = "模型載入中...";

  const loaded = await AIController.loadModel();

  if (loaded) {
    statusText.textContent = "模型已就緒，開啟鏡頭後會自動偵測";
  } else {
    statusText.textContent = "模型載入失敗，請檢查 tm-my-image-model 資料夾路徑";
  }
}

function createCameraSwitchButton() {
  cameraSwitchButton = document.createElement("button");
  cameraSwitchButton.type = "button";
  cameraSwitchButton.className = cameraToggle.className;
  cameraSwitchButton.style.display = "none";
  cameraSwitchButton.textContent = "切換鏡頭";
  cameraToggle.parentNode.insertBefore(cameraSwitchButton, cameraToggle.nextSibling);

  cameraSwitchButton.addEventListener("click", async () => {
    currentFacingMode = currentFacingMode === "environment" ? "user" : "environment";
    updateCameraSwitchButtonLabel();

    if (currentStream) {
      stopCamera();
      await startCamera();
    }
  });

  updateCameraSwitchButtonLabel();
}

function updateCameraSwitchButtonLabel() {
  if (!cameraSwitchButton) {
    return;
  }
  cameraSwitchButton.textContent =
    currentFacingMode === "environment"
      ? "切換到前置鏡頭"
      : "切換到後置鏡頭";
}

function getVideoConstraints() {
  return {
    facingMode: { ideal: currentFacingMode },
  };
}

async function startCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert("此瀏覽器不支援鏡頭功能。");
    return;
  }

  try {
    currentStream = await navigator.mediaDevices.getUserMedia({
      video: getVideoConstraints(),
      audio: false,
    });

    cameraFeed.srcObject = currentStream;
    await cameraFeed.play();

    previewBox.classList.add("is-active");
    cameraToggle.textContent = "關閉鏡頭";
    if (cameraSwitchButton) {
      cameraSwitchButton.style.display = "inline-block";
    }

    if (!AIController.modelReady) {
      statusText.textContent = "模型載入中...";
      const loaded = await AIController.loadModel();

      if (!loaded) {
        statusText.textContent = "模型載入失敗，請檢查 tm-my-image-model 資料夾路徑";
        return;
      }
    }

    statusText.textContent = "偵測中...";
    AIController.startPredictionLoop(cameraFeed, handlePredictionResult, 300);
  } catch (error) {
    console.error("無法開啟鏡頭：", error);
    alert("無法取得鏡頭畫面，請確認瀏覽器權限或裝置是否可用。");
  }
}

function stopCamera() {
  AIController.stopPredictionLoop();

  if (currentStream) {
    currentStream.getTracks().forEach((track) => track.stop());
    currentStream = null;
  }

  cameraFeed.srcObject = null;
  previewBox.classList.remove("is-active");
  cameraToggle.textContent = "開啟鏡頭";
  if (cameraSwitchButton) {
    cameraSwitchButton.style.display = "none";
  }

  resetDetectionState();
}

function handlePredictionResult(result, error) {
  if (error || !result) {
    statusText.textContent = "偵測中斷，請重新開啟鏡頭";
    return;
  }

  setResult(result.label, result.confidence, "偵測中");

  if (result.label === "dog" && result.confidence > 0.8) {
    handleDogDetected(result.confidence);
  }
}

function handleDogDetected(confidence) {
  if (!dogDetected) {
    dogDetected = true;
    capturedDogImage = captureCurrentVideoFrame();

    if (capturedDogImage) {
      GameController.setCapturedDogImage(capturedDogImage);
    }

    statusText.textContent = `已捕捉狗狗畫面，可開始互動（信心值 ${(confidence * 100).toFixed(2)}%）`;
  }

  // 重點修正 1：只要曾經偵測到狗，互動按鈕就會一直停留。
  triggerBadge.classList.add("is-visible");
}

function setResult(label, confidence, message) {
  resultLabel.textContent = label;
  resultConfidence.textContent = `${(confidence * 100).toFixed(2)}%`;

  if (!dogDetected) {
    statusText.textContent = message;
  }
}

function resetDetectionState() {
  dogDetected = false;
  capturedDogImage = null;

  resultLabel.textContent = "not_dog";
  resultConfidence.textContent = "0%";
  statusText.textContent = currentStream ? "偵測中..." : "等待開啟鏡頭";
  triggerBadge.classList.remove("is-visible");

  GameController.closeGame();
  GameController.resetGame();
  GameController.clearCapturedDogImage();
}

function captureCurrentVideoFrame() {
  if (!cameraFeed || cameraFeed.readyState < 2) {
    return null;
  }

  const canvas = document.createElement("canvas");
  const size = 320;

  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");

  const videoWidth = cameraFeed.videoWidth;
  const videoHeight = cameraFeed.videoHeight;

  if (!videoWidth || !videoHeight) {
    return null;
  }

  // 這裡是置中裁切成正方形，讓畫面變成虛擬狗頭像。
  const sourceSize = Math.min(videoWidth, videoHeight);
  const sourceX = (videoWidth - sourceSize) / 2;
  const sourceY = (videoHeight - sourceSize) / 2;

  ctx.drawImage(
    cameraFeed,
    sourceX,
    sourceY,
    sourceSize,
    sourceSize,
    0,
    0,
    size,
    size
  );

  return canvas.toDataURL("image/png");
}

cameraToggle.addEventListener("click", () => {
  if (currentStream) {
    stopCamera();
  } else {
    startCamera();
  }
});

triggerBadge.addEventListener("click", () => {
  if (triggerBadge.classList.contains("is-visible")) {
    GameController.openGame();
  }
});

gameClose.addEventListener("click", () => {
  resetDetectionState();
});

gameOverlay.addEventListener("click", (event) => {
  if (event.target === gameOverlay) {
    resetDetectionState();
  }
});

initPage();
