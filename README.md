# RepoCity

RepoCity turns a repository into a navigable 3D city. Directories become districts, files become buildings, dependencies become streets, and commit activity becomes the skyline.

The first screen loads a metadata-only public sample based on `vitejs/vite`. RepoCity can also scan a local repository under `D:\Projects` or shallow-clone a public GitHub repository for analysis.

## What the city means

- Districts map to top-level folders.
- Building height reflects LOC, complexity, and commit activity.
- Building shape reflects file role: source towers, service spires, interface panels, docs archives, config cores, script stacks, style screens, data blocks, and test labs.
- Roads and aerial links represent import relationships.
- Timeline playback dims files that were not active yet.
- Cloud summaries are opt-in and disabled unless an OpenAI-compatible provider is configured.

## Visual references

RepoCity uses its own implementation, but the visual direction was informed by:

- [SynthCity](https://github.com/jeffbeene/synthcity) for cyberpunk city atmosphere, signs, towers, and generative street density.
- [threejs-procedural-building-generator](https://github.com/Aljullu/threejs-procedural-building-generator) for the idea of composing buildings from floors, roofs, windows, and roof objects.
- [Git City](https://github.com/srizzon/git-city) and related R3F city work for mapping GitHub/code activity into building scale, windows, and city density.

## Run

Use the bundled Codex runtime if `node` or `pnpm` are not on PATH:

```powershell
$env:PATH = "C:\Users\HONOR\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;C:\Users\HONOR\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin;$env:PATH"
$env:GIT_BIN = "C:\Users\HONOR\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\git\cmd\git.exe"
pnpm install
pnpm dev
```

Open `http://127.0.0.1:5173`.

## Cloud summaries

Cloud summaries are disabled unless an OpenAI-compatible provider is configured:

```powershell
$env:AI_BASE_URL = "https://api.openai.com/v1"
$env:AI_API_KEY = "..."
$env:AI_MODEL = "gpt-4.1-mini"
```

Local repository source is only sent when the UI includes explicit consent for that file.
