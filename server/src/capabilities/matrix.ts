export const CapabilityMatrix = {
  stability: {
    "sdxl-1.0": {
      sizes: [[512,512],[768,768],[1024,1024]],
      steps: { min: 10, max: 50, default: 30 },
      guidance: { min: 0, max: 20, default: 7 },
      qualityFlags: ["standard","high"],
      speedFlags: ["fast","balanced"],
      upscales: ["none","2x","4x"],
      formats: ["png","jpg","webp"],
      safety: ["standard","strict"]
    }
  },
  openai: {
    "gpt-image-1": {
      sizes: [[1024,1024],[1024,1792],[1792,1024]],
      steps: null, // not exposed
      guidance: null,
      qualityFlags: ["standard","hd"],
      speedFlags: ["fast","balanced"],
      upscales: ["none"],
      formats: ["png","webp","jpg"],
      safety: ["standard"]
    }
  },
  // ...more providers/models
} as const;
