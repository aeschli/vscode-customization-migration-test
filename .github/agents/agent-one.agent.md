---
name: agent-one
description: This is agent one.
model: GPT-5.4
tools: [execute, read, edit, search, web, agent, todo]
handoffs: 
  - label: Start Implementation
    agent: agent
    prompt: Implement the plan
    send: true
    model: GPT-5.4 (copilot)
---