# Lat UI

Lat UI lets you explore project knowledge alongside its code references, review local changes, and publish a read-only site for others.

## Browse locally

Run the browser from your project root to follow links, search knowledge, and inspect the graph.

```bash
lat ui
```

`lat ui run` is equivalent. The server listens locally; add `--no-git` if you want to hide Git changes.

Use `lat ui --host 0.0.0.0` to listen on all IPv4 interfaces, or pass a specific address with `--host <address>`. The default is `127.0.0.1`. Choose a port with `--port <number>`; other machines connect using the server machine's address and that port.

Non-loopback addresses and hostnames enable read-only sharing: public vault Markdown and explicitly linked public source files, project Markdown, and resources are available. In Git projects, add those files to Git first. Hidden, ignored, untracked, and unlinked files remain private, including local configuration and source files mentioned only by backlinks. Linked external sources use pinned content instead of local overrides.

Sharing includes Git diffs and change indicators for public Markdown; `--no-git` disables them. Editing, semantic search, and `lat section` output remain loopback-only. Removing links or adding ignore rules updates sharing permissions when the server refreshes.

Use the sidebar and table of contents to navigate, or follow references between explanations, source definitions, and tests. Validation errors and Git diffs appear beside the affected content.

You can edit local Markdown and save explicitly; conflicting changes are reported instead of silently overwritten. Source files and [[external_sources|external sources]] are read-only. Code highlighting, math, diagrams, maps, and 3D models render within documents.

## Publish

Choose a static site if you only need browsing, or a server build if readers also need semantic search.

Published sites preserve document links, code previews, external content, and graph navigation. They do not expose editing, Git state, or live updates. Rebuild to publish later changes.

### Static hosting

Use a static build for a site that needs no server process.

```bash
lat ui build static
```

Upload the contents of `.lat-build/static/` to your static host. This build does not include semantic search.

### Node.js hosting

Use the default server build for a portable site with semantic search, then install its dependencies and start it.

```bash
lat ui build server
cd .lat-build/server
npm install
npm start
```

Deploy the generated directory to a Node.js host. It contains a small Express app and static files in `public/`, which your host can serve through a CDN.

### Vercel hosting

Select the Vercel target to generate static CDN content and a search function together.

```bash
lat ui build server --target vercel
```

The result is Vercel Build Output in `.vercel/output/`, ready for your Vercel deployment workflow. See [[lat.md/knowledge/view/architecture#Browser Architecture#Build targets|build architecture]] for packaging and runtime details.

Builds refuse to overwrite an existing output directory. Use `--force` only when you intend to replace its contents.
