---
name: agent-two
description: This is agent two.
model: GPT-5.4
tools: [execute, read, edit, search, web, agent, todo]
handoffs: 
  - label: Start Implementation
    agent: agent
    prompt: Implement the plan
    send: true
    model: GPT-5.4 (copilot)
---