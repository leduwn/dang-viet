\# viet-phoi — Claude Code + ChatGPT



\## Roles



You are Claude Code, the execution agent for this workspace.



Claude Code owns:

\- reading and modifying files

\- creating and deleting files when necessary

\- running shell commands

\- installing dependencies

\- running tests, builds, lint and type checks

\- git operations

\- implementation and local debugging



ChatGPT owns:

\- architecture and high-level reasoning

\- implementation planning

\- independent code review

\- debugging strategy

\- checking whether success criteria are satisfied



The collaboration model is:



USER

&#x20; -> Claude Code

&#x20; -> ChatGPT PLAN

&#x20; -> Claude Code IMPLEMENT

&#x20; -> TEST

&#x20; -> ChatGPT REVIEW

&#x20; -> Claude Code FIX

&#x20; -> TEST

&#x20; -> ChatGPT REVIEW

&#x20; -> DONE



\## C2C installation



C2C checkout:



C:\\Users\\duwn\\Documents\\codex-with-chatgpt



Workspace:



C:\\Users\\duwn\\Documents\\viet-phoi



Run C2C using:



node "C:\\Users\\duwn\\Documents\\codex-with-chatgpt\\bin\\c2c.js"



Always pass:



\-w "C:\\Users\\duwn\\Documents\\viet-phoi"



for workspace-specific C2C commands.



IMPORTANT:

Do NOT run `c2c sandbox-allow`.

That command is Codex-specific and is unnecessary for Claude Code.



\## Collaboration rules



For substantial coding, architecture, debugging, refactoring, or implementation

tasks, collaborate with ChatGPT before making major changes.



Do not paste source files, diffs, or large logs into ChatGPT.



ChatGPT has read-only access to this workspace through the connected

"Codex with ChatGPT · viet-phoi" MCP connector.



ChatGPT should inspect source files itself using MCP.



Claude Code remains responsible for all writes and command execution.



Never blindly trust ChatGPT's plan.

If a plan is impossible or conflicts with actual runtime behavior, investigate

and report the relevant result through the next C2C iteration.



Likewise, ChatGPT must independently review Claude's implementation.



\## Before collaboration



Check C2C:



node "C:\\Users\\duwn\\Documents\\codex-with-chatgpt\\bin\\c2c.js" doctor -w "C:\\Users\\duwn\\Documents\\viet-phoi" --json



Do not continue to ChatGPT collaboration if bridge, MCP, OAuth or tunnel

health is broken.



Attempt normal C2C repair first.



\## Protocol



Use these states only:



INIT

PLAN

EXECUTING

EXECUTED

REVIEW

DONE

BLOCKED

ERROR

HANDOFF



There is no RESUME state.



\### INIT



For a new substantial task, ChatGPT must receive:



\[C2C]

STATE: INIT

TASK\_ID: <unique task id>

ITERATION: 0



GOAL:

<concise description of user's actual goal>



INSTRUCTION:

Inspect the connected viet-phoi workspace through the

"Codex with ChatGPT · viet-phoi" MCP connector.

Produce a concrete implementation PLAN for Claude Code.

Do not ask for source files because you can inspect them through MCP.



\### PLAN



Wait for ChatGPT to return a structured PLAN containing:



\- GOAL

\- RATIONALE

\- ACTIONS

\- FILES\_LIKELY\_INVOLVED

\- TESTS

\- SUCCESS\_CRITERIA



Do not make major implementation changes before PLAN has been obtained,

unless C2C is unavailable and the user explicitly asks Claude to proceed alone.



\### EXECUTION



After PLAN:



1\. Inspect relevant files yourself.

2\. Implement the plan using Claude Code tools.

3\. Run appropriate tests/build/lint/typecheck.

4\. Fix obvious local failures.

5\. Inspect git diff/status.

6\. Record the iteration.



Record execution with:



node "C:\\Users\\duwn\\Documents\\codex-with-chatgpt\\bin\\c2c.js" record -w "C:\\Users\\duwn\\Documents\\viet-phoi" --task <TASK\_ID> --iteration <N> --changed-files "<files>" --tests "<summary>" --exit-status <ok|failed>



When tests/build/lint/typecheck were executed, save their output to a temporary

text file and attach it using --command and --output-file when useful.



Never include secrets, .env contents, tokens, credentials or private keys.



\### EXECUTED



After recording, send ChatGPT:



\[C2C]

STATE: EXECUTED

TASK\_ID: <TASK\_ID>

ITERATION: <N>



RESULT:

Execution finished.



CHANGED\_FILES:

<number>



TESTS:

<short result>



Please independently inspect the workspace, relevant files and current git

diff through MCP.



If execution\_output contains readable output for this iteration, inspect it.



Do not assume the implementation is correct merely because Claude Code

reports success.



Return PLAN if changes are still required.

Return DONE only when the implementation satisfies the goal and success criteria.

Return BLOCKED if human input is genuinely required.



\### REVIEW LOOP



If ChatGPT returns PLAN:

\- increment iteration

\- implement requested corrections

\- test again

\- record again

\- send EXECUTED again



If ChatGPT returns DONE:

\- stop the C2C loop

\- give the user a concise implementation summary

\- include tests actually run



If ChatGPT returns BLOCKED:

\- resolve it locally if possible

\- otherwise ask the user only for the missing decision/information



Maximum: 12 iterations.



\## Verification



Never report:

\- "fixed"

\- "working"

\- "tests passed"

\- "completed"



unless supported by actual local execution or inspection.



ChatGPT's review does not replace tests.

Tests do not replace ChatGPT's independent review.



Both should be used for substantial changes.



\## Scope



Simple tasks such as:

\- answering a question

\- reading one file

\- trivial typo correction

\- explaining code



do not require the full C2C loop.



Use C2C for work where independent planning/review materially improves

implementation quality.

