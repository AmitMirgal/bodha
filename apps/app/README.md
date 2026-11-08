# Code Comprehension

Practice for the code comprehension interview round: read an unfamiliar codebase, find bugs,
add a feature that fits the design, speed up a slow function, and work with an AI assistant
without trusting it blindly.

Unofficial. The round's format here is based on public candidate and prep-site reports.

## Run

    npm install
    npm run dev        # http://localhost:3000
    npm run build && npm start

Next.js (App Router). Routes: `/` (pick a round), `/round/[id]`, `/results/[id]`.
Progress lives in the browser's localStorage, so there is no database or login.

The AI sidekick is optional. It works with Gemini, Claude, or OpenRouter (including its free
models), using the visitor's own API key, kept in their browser.

## Add a challenge

Create `challenges/<id>/` with:

- `meta.json`: title, blurb, difficulty, minutes, and the tasks (ids `bugs`, `feature`, `perf`)
- `starter/`: the files the candidate sees, including a `README.md` that specs the behaviour
- `reference/`: a working solution
- `tests.js`: hidden tests using `test(taskId, name, fn)` and `expect(...)`

Then run `npm run validate`. Starter code should fail its tests and the reference should pass all of them.

Tests run in a Web Worker (`public/harness.js`) in the candidate's browser.
The reference solution is only sent when the results page asks for it.
