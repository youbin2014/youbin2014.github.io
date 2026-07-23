# Hanbin Hong — personal website

Astro source for [hanbinhong.com](https://hanbinhong.com), deployed to GitHub Pages.

## Traffic map

The Global Reach panel is rendered from a build-time Cloudflare Web Analytics aggregate. The browser never receives
Cloudflare credentials or raw visitor records.

To enable the daily refresh, add these GitHub repository secrets:

- `CLOUDFLARE_ANALYTICS_API_TOKEN`: a read-only token with **Account → Account Analytics → Read** for the relevant
  Cloudflare account.
- `CLOUDFLARE_ACCOUNT_ID`: the Cloudflare account ID that owns the Web Analytics site.

The scheduled Pages workflow queries the account-level RUM dataset for `hanbinhong.com`, suppresses low-volume country
and referrer buckets, writes the temporary aggregate into the build, and deploys only the rendered result. No daily
analytics file is committed to the repository.

To refresh locally:

```powershell
$env:CLOUDFLARE_ANALYTICS_API_TOKEN = '...'
$env:CLOUDFLARE_ACCOUNT_ID = '...'
npm run analytics:fetch
npm run build
```

Without those variables, the committed placeholder renders an honest “collecting aggregate data” state.

```sh
npm create astro@latest -- --template minimal
```

> 🧑‍🚀 **Seasoned astronaut?** Delete this file. Have fun!

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

```text
/
├── public/
├── src/
│   └── pages/
│       └── index.astro
└── package.json
```

Astro looks for `.astro` or `.md` files in the `src/pages/` directory. Each page is exposed as a route based on its file name.

There's nothing special about `src/components/`, but that's where we like to put any Astro/React/Vue/Svelte/Preact components.

Any static assets, like images, can be placed in the `public/` directory.

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).
