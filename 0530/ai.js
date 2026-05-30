const AIController = (() => {
  const modelURL = "./tm-my-image-model/model.json";
  const metadataURL = "./tm-my-image-model/metadata.json";

  let model = null;
  let modelReady = false;
  let predictionTimer = null;

  async function loadModel() {
    if (modelReady) {
      return true;
    }

    try {
      model = await tmImage.load(modelURL, metadataURL);
      modelReady = true;
      return true;
    } catch (error) {
      console.error("無法載入 Teachable Machine 模型：", error);
      modelReady = false;
      return false;
    }
  }

  async function predict(videoElement) {
    if (!modelReady || !model || !videoElement) {
      return null;
    }

    const predictions = await model.predict(videoElement);
    const sorted = [...predictions].sort((a, b) => b.probability - a.probability);
    const topPrediction = sorted[0];

    const normalizedLabel = topPrediction.className === "狗勾" ? "dog" : "not_dog";

    return {
      label: normalizedLabel,
      originalLabel: topPrediction.className,
      confidence: topPrediction.probability,
      predictions,
    };
  }

  function startPredictionLoop(videoElement, onResult, interval = 300) {
    stopPredictionLoop();

    async function loop() {
      try {
        const result = await predict(videoElement);
        if (result && typeof onResult === "function") {
          onResult(result);
        }
      } catch (error) {
        console.error("偵測失敗：", error);
        if (typeof onResult === "function") {
          onResult(null, error);
        }
      }

      predictionTimer = window.setTimeout(loop, interval);
    }

    loop();
  }

  function stopPredictionLoop() {
    if (predictionTimer) {
      clearTimeout(predictionTimer);
      predictionTimer = null;
    }
  }

  return {
    loadModel,
    startPredictionLoop,
    stopPredictionLoop,
    get modelReady() {
      return modelReady;
    },
  };
})();
