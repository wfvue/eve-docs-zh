# Taste

- Communicates in Simplified Chinese; replies should be in Chinese. Confidence: 1.0

- For documentation translation projects, prefers Chinese-first translations that keep English technical terms and page titles in parentheses (e.g., 渠道（Channels）、沙盒（Sandbox）), preserve original code blocks and relative links unchanged, and stay faithful to the official docs structure. Confidence: 0.7

- Prefers the agent to execute large bulk tasks (e.g., translating many pages) autonomously at full speed without pausing to ask for confirmation at each step, then report a concise completion summary. Confidence: 0.7

- Delegates git operations to the agent with a single terse instruction (e.g., 提交代码吧): the agent reviews status, stages only work-related files (excluding tooling/memory files like .commandcode/ and AGENTS.md), writes a conventional-prefixed Chinese commit message with a detailed body, and verifies the commit result. Confidence: 0.6
