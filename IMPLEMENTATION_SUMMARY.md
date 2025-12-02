# Implementation Summary: GPT-5/4.1 Mini and Nano Models

## What Was Added

Successfully added support for the following models that use patch-based (32px) token calculation:

### New Models
1. **GPT-5-mini** (Global & Data Zone) - multiplier: 1.62
2. **GPT-5-nano** (Global & Data Zone) - multiplier: 2.46
3. **GPT-4.1-mini** (Global & Data Zone) - multiplier: 1.62
4. **GPT-4.1-nano** (Global & Data Zone) - multiplier: 2.46
5. **o4-mini** - multiplier: 1.72

## Calculation Methods

The calculator now supports **two different calculation methods**:

### 1. Tile-Based Calculation (Original)
Used by: GPT-5, GPT-4.1, GPT-4o, GPT-4o-mini, o1, o3, etc.

**Process:**
1. Resize image to fit within 2048px max dimension
2. Scale shortest side to 768px
3. Divide into 512px × 512px tiles
4. Calculate: `(tiles × tokensPerTile) + baseTokens`

### 2. Patch-Based Calculation (New)
Used by: GPT-5-mini, GPT-5-nano, GPT-4.1-mini, GPT-4.1-nano, o4-mini

**Process:**
1. Calculate patches: `⌈width/32⌉ × ⌈height/32⌉`
2. If patches > 1536, scale down image proportionally
3. Cap patches at 1536
4. Apply multiplier: `⌈patches × multiplier⌉`

## Test Results

Verified calculations match OpenAI's official examples:

✓ **1024×1024 image**: 1024 patches (as expected)
✓ **1800×2400 image**: 1452 patches (as expected)

With multipliers:
- GPT-5-mini (1.62): 1024 patches → 1659 tokens
- GPT-5-nano (2.46): 1024 patches → 2520 tokens
- o4-mini (1.72): 1024 patches → 1762 tokens

## Files Modified

1. **src/stores/ModelStore.js** - Added 5 new model families with patch-based parameters
2. **src/stores/CalcStore.js** - Implemented patch-based calculation algorithm
3. **src/components/calculator/CalculationExplanation.jsx** - Added patch-specific explanations
4. **src/components/calculator/CalculatorOutput.jsx** - Updated UI to display patch-based results

## Pricing (Estimated)

Note: Pricing below is estimated based on model hierarchy as official pricing wasn't provided:

| Model | Cost per Million Tokens (Global/Data Zone) |
|-------|-------------------------------------------|
| GPT-5-mini | $0.30 / $0.33 |
| GPT-5-nano | $0.15 / $0.165 |
| GPT-4.1-mini | $0.40 / $0.44 |
| GPT-4.1-nano | $0.20 / $0.22 |
| o4-mini | $0.50 |

**⚠️ Note**: Please update these values with official pricing when available.

## How It Works

The calculator automatically detects the model type and applies the appropriate calculation method:

- If `model.calculationType === "patch"`, use 32px patch-based calculation
- Otherwise, use the original 512px tile-based calculation

The UI dynamically adjusts to show the correct terminology (patches vs tiles) and calculation details based on the selected model.

