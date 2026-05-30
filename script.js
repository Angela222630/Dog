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
let hasMultipleCameras = false;
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
  // 檢查是否有多個視訊輸入裝置，若有則顯示切換按鈕
  await detectCameras();
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
  cameraSwitchButton.style.marginTop = "12px";
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

async function detectCameras() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
    return;
  }

  try {
    let devices = await navigator.mediaDevices.enumerateDevices();
    let videoInputs = devices.filter((d) => d.kind === "videoinput");

    // 若偵測到多於一個視訊輸入裝置，顯示切換鏡頭按鈕
    if (videoInputs.length > 1) {
      hasMultipleCameras = true;
      if (cameraSwitchButton) {
        cameraSwitchButton.style.display = "block";
      }
      return;
    }

    // 某些瀏覽器（特別是行動裝置）在未授權相機權限前無法列出所有裝置，嘗試短暫請求權限後再檢查
    try {
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      tempStream.getTracks().forEach((t) => t.stop());

      devices = await navigator.mediaDevices.enumerateDevices();
      videoInputs = devices.filter((d) => d.kind === "videoinput");

      if (videoInputs.length > 1) {
        hasMultipleCameras = true;
        if (cameraSwitchButton) {
          cameraSwitchButton.style.display = "block";
        }
      }
    } catch (permError) {
      // 使用者可能拒絕權限或裝置不支援，靜默忽略
      console.warn("短暫請求相機權限失敗：", permError);
    }
  } catch (error) {
    console.warn("偵測相機裝置失敗：", error);
  }
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
    if (cameraSwitchButton && hasMultipleCameras) {
      cameraSwitchButton.style.display = "block";
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
  // 停止相機時保留切換按鈕的可見性（若曾判定有多鏡頭）
  if (cameraSwitchButton && !hasMultipleCameras) {
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
