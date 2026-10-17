# OpenCode inventory contract

The Hermes Control Center never talks to OpenCode at runtime, and no OpenCode
credential ever reaches this project. The Models page compares Hermes' own
catalogue with an **OpenCode inventory snapshot** that the integrator exports
as a static JSON file.

## Where the file lives

```
public/opencode-inventory.json      # written by tools/generate-opencode-inventory.ps1
```

Vite copies `public/` into `dist/`, so the proxy serves it at
`http://127.0.0.1:9200/opencode-inventory.json`. The app fetches it from the
same origin (see `src/services/adapters/opencode/loader.ts`).

## How to generate it

```powershell
# from the project root
powershell -NoProfile -ExecutionPolicy Bypass -File tools/generate-opencode-inventory.ps1
```

The generator is read-only towards OpenCode and Hermes. It:

1. Runs `opencode models` to read the authoritative list of enabled model ids.
2. Downloads the public `https://models.dev/api.json` catalogue (no key, no
   account) for context windows, pricing, capabilities and modalities.
3. Joins the two and writes `public/opencode-inventory.json`.

Models that are not present in the public catalogue are still listed, but with
`verified: false` and zero pricing so they are never presented as confirmed.

## Schema (`schemaVersion: "1.0"`)

```jsonc
{
  "schemaVersion": "1.0",
  "generatedAt": "2026-10-17T14:28:06Z",
  "source": "opencode",
  "opencodeVersion": "1.19.3",
  "models": [
    {
      "modelId": "opencode/big-pickle",   // provider/model, as printed by `opencode models`
      "name": "Big Pickle",
      "providerId": "opencode",
      "providerName": "OpenCode",
      "pricing": "free",                  // "free" only when input+output are both 0
      "inputPrice": 0,                    // USD per 1M prompt tokens
      "outputPrice": 0,                   // USD per 1M completion tokens
      "contextWindow": 200000,
      "maxOutputTokens": 32000,
      "capabilities": {
        "reasoning": true,
        "vision": false,
        "toolCalling": true,
        "streaming": true,
        "jsonMode": true
      },
      "releaseDate": "2025-10-17",
      "tags": ["opencode", "free", "reasoning", "tools", "big-pickle", "metadata-verified"],
      "description": "Reasoning model for deliberate analysis, multi-step problem solving, and tool use",
      "configured": true,
      "authenticated": true,
      "verified": true                   // false when the public catalogue had no metadata
    }
  ]
}
```

### Readiness axes

`catalogAvailable` is always `true` for an entry that is present in the file.
`configured` / `authenticated` mirror the fact that the model came from the
enabled OpenCode list. `verified` is `true` only when the metadata came from the
public catalogue. The UI surfaces these axes separately and never collapses them
into a single "available" flag.

## Failure behaviour

If the file is missing or malformed, `loadOpenCodeInventory()` resolves to an
empty list, logs a warning to the console, and the Models page shows a notice
explaining how to generate the file. Hermes' own catalogue keeps working — the
comparison view simply has nothing to compare against.
