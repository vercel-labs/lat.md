# External sources

External sources let your project reference the upstream documentation and code it depends on. Links are pinned to a commit, so they remain reproducible as upstream changes.

## Configure a source

Run `lat external add` for interactive setup, or provide the source details as arguments.

This example adds Node.js documentation under the handle `node`:

```bash
lat external add node https://github.com/nodejs/node \
  --commit main \
  --prefix doc \
  --default-file-extension md \
  --strategy fetch
```

Lat resolves `main` to a specific commit when you add the source; it does not keep following the branch. Here, `doc` is the directory containing documentation, `md` supplies the extension when a link omits it, and `fetch` downloads individual referenced files.

Use `checkout` instead of `fetch` when you want Lat to manage a Git checkout. If you already have a matching checkout, a [[external-sources#Local Overrides|local override]] can use it without changing shared configuration.

## Link it

Start the link with the source handle, then a path relative to its configured prefix. Add a heading or symbol after `#` to target a specific part.

```md
[[node:api/assert#Strict assertion mode]]
```

This resolves to the Strict assertion mode heading in Node's `doc/api/assert.md`. Markdown, reStructuredText, AsciiDoc, and supported source languages allow named targets; the same links work in `@lat:` comments.

## Validate and inspect

Run `lat check` to validate the configured source and the files and fragments your graph references.

```bash
lat check
lat section 'node:api/assert#Strict assertion mode'
```

`lat section` retrieves the referenced content; `lat external show node` inspects configuration and cache status. The first retrieval may require network access, and later reads reuse cached content.

Browse the same links in [[browser|Lat UI]] or include them in published sites. External content is read-only and is not included in semantic search; use exact links to retrieve it.
