# Playlist Search Architecture Options

## Conclusion

GitHub Pages cannot replace the playlist-search API by itself. GitHub Pages is static hosting for HTML, CSS, and JavaScript; it does not run a server-side request handler or protect a Spotify client secret.[1] GitHub Actions can run the successful diagnostic workflow, but it is an unsuitable interactive API because workflows are job executions rather than an always-on request service, and repository secrets are exposed only inside the runner environment.[2]

The successful workflow proves that Spotify’s Search API and the repository credentials work from GitHub’s runner network. It does not prove that the same request will complete from Vercel’s runtime network. The current Vercel logs show query-dependent behavior: `fallout new vegas` completes, while `autumn affection` stalls during the outbound Spotify request. The earlier no-KV implementation still stalled, so removing KV is useful for reducing dependencies but is not, by itself, the root-cause fix.

The safest practical option is to keep the API server-side, remove KV from the playlist route, and replace the custom Node HTTPS request with a native `fetch` request using an explicit `AbortController` deadline. If Vercel still exhibits query-specific stalls after that change, the next option is to move only this small public-catalog proxy to another edge/serverless provider with a different egress path, while keeping the Spotify client secret server-side. GitHub Pages and GitHub Actions should not be used as the live search backend.

## Evidence from the successful workflow

The successful workflow obtained a client-credentials token and completed both searches from a GitHub Actions runner. It returned the following results:

| Request | Result | Elapsed time |
|---|---:|---:|
| Artist search, `Billie Holiday`, limit 5, market NO | HTTP 200 | 550 ms |
| Playlist search, `Nordic Hits`, limit 5, market NO | HTTP 200 | 392 ms |
| Playlist search, `test`, limit 8, market NO | HTTP 200 | 8 items returned |
| Playlist search, `test`, limit 5, market NO | HTTP 200 | 5 items returned |
| Artist search, `test`, limit 8, market NO | HTTP 200 | 8 items returned |

The workflow therefore validates the credentials, the client-credentials grant, the endpoint, the playlist type, and Spotify’s response format.

The Vercel logs demonstrate a different failure boundary. Vercel logs `Starting playlist search request` and then either logs completion with HTTP 200 or reaches its function timeout. The log appears after the KV session lookup and token acquisition, so the failing stage is the outbound Spotify search request from Vercel. The fact that the failure depends on the query indicates an upstream network, routing, or Spotify edge interaction rather than a JavaScript mapping error.

## Can GitHub Pages serve playlist search?

GitHub Pages is documented as a static site hosting service that publishes HTML, CSS, and JavaScript from a repository.[1] It can run JavaScript in the visitor’s browser, but it cannot execute a server-side function when a user enters a search query. It also cannot read GitHub Actions secrets at browser runtime.

A GitHub Pages page could call Spotify directly only if it already had a suitable access token. It must not contain `SPOTIFY_CLIENT_SECRET`, because every visitor can inspect the published JavaScript and network requests. Spotify documents the client-credentials flow as server-to-server authentication and requires the client secret in the token request.[3]

A browser-based alternative is Authorization Code with PKCE. Spotify documents PKCE as appropriate for mobile, single-page, and other public clients where a client secret cannot be safely stored.[4] That approach would require a separate browser OAuth design, token storage, token renewal, redirect configuration, and compatibility work for the project’s iOS 9.3.6 target. The project deliberately avoids Web Crypto and other newer browser requirements, while Spotify’s current PKCE examples use modern browser APIs. PKCE is technically possible with a carefully written ES5 implementation, but it is a larger authentication redesign rather than a simple playlist-search fix.

## Can GitHub Actions serve playlist search?

GitHub Actions is useful for diagnostics, scheduled jobs, and precomputing a finite dataset. It is not a suitable low-latency request backend for arbitrary user queries. A workflow must be started or scheduled, a runner must be allocated, the secret must be injected, the Spotify request must execute, and a result must be published somewhere. That introduces unpredictable startup latency and creates a new public abuse surface if arbitrary users can trigger workflows.

A workflow could periodically generate a static file containing results for a fixed list of popular queries and publish it to GitHub Pages. It could not efficiently support arbitrary phrases such as `autumn affection` entered at runtime. It would also create stale search data and consume Actions minutes. Repository secrets are intended for workflow execution on the runner, not for exposure to website visitors.[2]

## Is there a public playlist-search API?

Spotify’s official Search endpoint requires OAuth 2.0 and supports `playlist` as a search type.[5] The documented request accepts a maximum `limit` of 10 and requires a market or user market context. Spotify does not provide an anonymous public search endpoint that removes the need for authorization.

Unofficial proxy endpoints, scraped web search endpoints, and third-party Spotify mirrors are poor choices for this application. They may violate provider terms, break without notice, expose user queries to an unknown operator, return stale or incomplete results, or create a new dependency that is less reliable than the current server. They should not be introduced merely to avoid one problematic egress path.

## Architecture comparison

| Option | Keeps secret server-side | Supports arbitrary live queries | Compatible with iOS 9 frontend | Reliability assessment | Recommendation |
|---|---:|---:|---:|---|---|
| GitHub Pages direct with client secret | No | Yes, but insecure | Yes | Secret exposure | Reject |
| GitHub Pages with PKCE | Yes, no client secret | Yes | Possible, but significant ES5/OAuth work | Depends on browser OAuth and CORS behavior | Consider only as a larger redesign |
| GitHub Actions on demand | Yes | Technically, but with runner latency | Yes | Not interactive or predictable | Reject |
| GitHub Actions precomputed files | Yes | Only fixed/preselected queries | Yes | Stale and incomplete | Suitable only for a demo/catalog |
| Vercel route with KV/session | Yes | Yes | Yes | Current query-dependent stalls | Avoid for playlist search |
| Vercel route without KV using native fetch and abort | Yes | Yes | Yes | Lowest-change server-side option | Recommended first |
| Separate edge/serverless proxy | Yes | Yes | Yes | Different egress may avoid Vercel-specific stalls | Recommended fallback |
| Unofficial public proxy | Unclear | Yes | Yes | Terms, privacy, and availability risks | Reject |

## Recommended implementation path

The first implementation should make playlist search a server-side, no-KV route and use the runtime’s native HTTP client with `AbortController`. The request should have a hard deadline below the Vercel function limit. The route should obtain a short-lived client-credentials token, call Spotify Search with `limit=5` or `limit=3`, and return a controlled error if the deadline expires. The browser contract does not need to change.

The native client is important because the current custom HTTPS helper has already shown that a socket timeout and a wall-clock timer can behave differently from the platform’s request lifecycle. Native `fetch` with an abort signal is the runtime-supported cancellation path and makes it easier to distinguish token timeout from search timeout in logs.

The second implementation should test the same query set from Vercel and GitHub Actions, including `autumn affection`, `fallout new vegas`, `Nordic Hits`, and `test`. Logs should record the stage, query hash or safely truncated query, elapsed time, status, and whether an abort occurred. Secrets and access tokens must never be logged.

If Vercel still stalls on the same queries after native cancellation, the correct conclusion is that Vercel’s outbound route to Spotify is unsuitable for those requests. At that point, move only the playlist catalog proxy to a separate serverless provider with server-side secrets. The rest of the application can remain on Vercel. The provider should be selected for a compatible runtime, secret storage, request cancellation, HTTPS, CORS or same-origin proxying, and a documented free-tier policy.

## References

[1]: https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages "GitHub Pages: What is GitHub Pages?"

[2]: https://docs.github.com/actions/security-guides/using-secrets-in-github-actions "GitHub Actions: Using secrets in GitHub Actions"

[3]: https://developer.spotify.com/documentation/web-api/tutorials/client-credentials-flow "Spotify Web API: Client Credentials Flow"

[4]: https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow "Spotify Web API: Authorization Code with PKCE Flow"

[5]: https://developer.spotify.com/documentation/web-api/reference/search "Spotify Web API: Search for Item"
