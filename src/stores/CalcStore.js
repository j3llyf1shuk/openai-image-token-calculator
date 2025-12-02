export const calcStore = (set, get) => ({
  model: "",
  images: [],
  totalTokens: null,
  totalCost: null,

  setModel: (model) => set({ model }),

  addImage: (image) => set((state) => ({ images: [...state.images, image] })),
  updateImage: (index, field, value) => {
    const newImages = [...get().images];
    newImages[index][field] = value;
    set({ images: newImages });
  },
  removeImage: (index) => {
    const newImages = get().images.filter((_, i) => i !== index);
    set({ images: newImages });
  },

  resetCalculation: () => {
    set(() => ({ totalTokens: null, totalCost: null }));
  },
  runCalculation: () => {
    // Tile-based calculation (GPT-4o, GPT-4.1, GPT-5, o1, o3, etc.)
    function getResizedImageSize(maxDimension, minSide, height, width) {
      let resizedHeight = height;
      let resizedWidth = width;

      // Only scale down if larger than maxDimension on any side
      if (width > maxDimension || height > maxDimension) {
        const scaleFactor = Math.min(
          maxDimension / width,
          maxDimension / height
        );
        resizedWidth = width * scaleFactor;
        resizedHeight = height * scaleFactor;
      }

      // If the shortest side is greater than minSide, scale to minSide
      if (Math.min(resizedWidth, resizedHeight) > minSide) {
        const scaleFactor = minSide / Math.min(resizedWidth, resizedHeight);
        resizedWidth = resizedWidth * scaleFactor;
        resizedHeight = resizedHeight * scaleFactor;
      }

      resizedHeight = Math.round(resizedHeight);
      resizedWidth = Math.round(resizedWidth);

      return { height: resizedHeight, width: resizedWidth };
    }

    function getImageTileCount(tileSize, height, width) {
      const tilesHigh = Math.ceil(height / tileSize);
      const tilesWide = Math.ceil(width / tileSize);
      return { tilesHigh, tilesWide };
    }

    // Patch-based calculation (GPT-5-mini, GPT-5-nano, GPT-4.1-mini, GPT-4.1-nano, o4-mini)
    function calculatePatchTokens(width, height, patchSize, maxPatches, multiplier) {
      // Step A: Calculate raw patches needed
      const patchesWide = Math.ceil(width / patchSize);
      const patchesHigh = Math.ceil(height / patchSize);
      const rawPatches = patchesWide * patchesHigh;

      let finalWidth = width;
      let finalHeight = height;
      let finalPatchesWide = patchesWide;
      let finalPatchesHigh = patchesHigh;

      // Step B: If patches exceed maxPatches, scale down
      if (rawPatches > maxPatches) {
        // Calculate shrink factor
        let r = Math.sqrt((patchSize * patchSize * maxPatches) / (width * height));
        
        // Adjust r to ensure whole number of patches
        const widthFactor = Math.floor(width * r / patchSize) / (width * r / patchSize);
        const heightFactor = Math.floor(height * r / patchSize) / (height * r / patchSize);
        r = r * Math.min(widthFactor, heightFactor);

        finalWidth = Math.floor(width * r);
        finalHeight = Math.floor(height * r);
      }

      // Step C: Calculate final patch count (capped at maxPatches)
      finalPatchesWide = Math.ceil(finalWidth / patchSize);
      finalPatchesHigh = Math.ceil(finalHeight / patchSize);
      const imageTokens = Math.min(finalPatchesWide * finalPatchesHigh, maxPatches);

      // Step D: Apply multiplier
      const totalTokens = Math.ceil(imageTokens * multiplier);

      return {
        patchesWide: finalPatchesWide,
        patchesHigh: finalPatchesHigh,
        resizedWidth: finalWidth,
        resizedHeight: finalHeight,
        tokens: totalTokens,
        basePatches: imageTokens,
      };
    }

    const { model, images } = get();
    const costPerMillionTokens = model.costPerMillionTokens;

    // Check if this is a patch-based model
    if (model.calculationType === "patch") {
      const patchSize = model.patchSize;
      const maxPatches = model.maxPatches;
      const multiplier = model.multiplier;

      const imageResults = images.map((image) => {
        const result = calculatePatchTokens(
          image.width,
          image.height,
          patchSize,
          maxPatches,
          multiplier
        );

        image.resizedWidth = result.resizedWidth;
        image.resizedHeight = result.resizedHeight;
        image.tilesWide = result.patchesWide;
        image.tilesHigh = result.patchesHigh;
        image.totalTiles = result.basePatches * image.multiplier;
        image.tokens = result.tokens * image.multiplier;

        return result.tokens * image.multiplier;
      });

      set(() => ({ images: images }));

      const totalTokens = imageResults.reduce((acc, tokens) => acc + tokens, 0);
      set(() => ({ totalTokens: totalTokens }));

      const totalCost = (totalTokens / 1000000) * costPerMillionTokens;
      set(() => ({ totalCost: totalCost.toFixed(5) }));
    } else {
      // Tile-based calculation (original logic)
      const tokensPerTile = model.tokensPerTile;
      const maxImageDimension = model.maxImageDimension;
      const imageMinSizeLength = model.imageMinSizeLength;
      const tileSizeLength = model.tileSizeLength;
      const baseTokens = model.baseTokens;

      const imageTileCount = images.flatMap((image) => {
        const imgSize = getResizedImageSize(
          maxImageDimension,
          imageMinSizeLength,
          image.height,
          image.width
        );

        image.resizedHeight = imgSize.height;
        image.resizedWidth = imgSize.width;

        const imageTiles = getImageTileCount(
          tileSizeLength,
          imgSize.height,
          imgSize.width
        );

        image.tilesHigh = imageTiles.tilesHigh;
        image.tilesWide = imageTiles.tilesWide;

        const multiplier = image.multiplier;

        image.totalTiles =
          imageTiles.tilesHigh * imageTiles.tilesWide * multiplier;

        return Array.from({ length: multiplier }, () => imageTiles);
      });

      set(() => ({ images: images }));

      const totalTokens =
        imageTileCount.reduce(
          (acc, tiles) => acc + tiles.tilesHigh * tiles.tilesWide * tokensPerTile,
          0
        ) + baseTokens;

      set(() => ({ totalTokens: totalTokens }));

      const totalCost = (totalTokens / 1000000) * costPerMillionTokens;
      set(() => ({ totalCost: totalCost.toFixed(5) }));
    }
  },
});
