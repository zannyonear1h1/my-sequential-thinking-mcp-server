# Sequential Thinking MCP Server

A Model Context Protocol (MCP) server focused on structured sequential thinking capabilities, designed to integrate with Cline's Memory Bank. This server helps break down complex problems into structured sequential steps, track reasoning chains, and store thinking patterns.

## Features

- Create and manage sequential thinking chains for problem-solving
- Track chains of thought with validation at each step
- Store and retrieve reasoning patterns
- Analyze the quality of reasoning processes
- Visualize thinking pathways
- Seamlessly integrate with the Memory Bank system

## Architecture

The server consists of the following core components:

- **Sequential Thinking Engine**: Manages thinking chains, steps, and reasoning validation
- **Memory Bank Connector**: Integrates with Cline's Memory Bank
- **Tag Manager**: Implements a comprehensive tagging system
- **Visualization Generator**: Creates visual representations of thinking chains
- **Utilities**: File storage, thinking validation, and other helpers

## Available Tools

The server provides the following MCP tools:

### create_thinking_chain
Create a new sequential thinking process with specified parameters.
- **Input**: problem description, thinking type, context
- **Output**: chain_id and initial structure

### add_thinking_step
Add a step to an existing thinking chain.
- **Input**: chain_id, step description, reasoning, evidence
- **Output**: updated step information

### validate_step
Validate logical connections between steps.
- **Input**: chain_id, step_id
- **Output**: validation results, potential issues

### get_chain
Retrieve a complete thinking chain.
- **Input**: chain_id
- **Output**: full chain with all steps

### generate_visualization
Create visual representation of a thinking chain.
- **Input**: chain_id, format (mermaid, json, text)
- **Output**: visualization code/data

### save_to_memory
Save a thinking chain to Memory Bank.
- **Input**: chain_id, memory_name, tags
- **Output**: confirmation and memory_id

### load_from_memory
Load a thinking chain from Memory Bank.
- **Input**: memory_id or search parameters
- **Output**: complete chain

### search_related_thinking
Find related thinking chains based on parameters.
- **Input**: keywords, tags, thinking_type
- **Output**: list of relevant chains

### apply_template
Apply a reasoning template to current thinking.
- **Input**: template_name, problem_context
- **Output**: pre-structured thinking chain

## Thinking Types

The server supports various thinking types, each with specific patterns and structures:

- **Analytical** - Break down, analyze, synthesize
- **Creative** - Diverge, explore, converge
- **Critical** - Question, evaluate, conclude
- **Systems** - Map, analyze, model
- **First-Principles** - Identify, break down, reassemble
- **Divergent** - Generate alternatives, explore
- **Convergent** - Analyze, evaluate, select
- **Inductive** - Observe, pattern, hypothesize
- **Deductive** - Premise, logic, conclusion

## Templates

The server includes ready-to-use reasoning templates to jumpstart the thinking process:

- **First Principles Analysis** - Break down a complex problem into its fundamental principles
- **Systems Thinking Analysis** - Analyze complex systems holistically

## Installation

1. Ensure Node.js v14+ is installed
2. Clone the repository
3. Install dependencies:
   ```
   npm install
   ```

## Usage

1. Start the server:
   ```
   node index.js
   ```

2. The server will be available as an MCP server that you can connect to via Claude/Cline

## Memory Bank Integration

This server is designed to integrate with Cline's Memory Bank, allowing:

1. Reading from Memory Bank files (projectbrief.md, activeContext.md, etc.)
2. Storing complete thinking chains as structured memories
3. Updating activeContext.md with reasoning outcomes
4. Creating links between reasoning and Memory Bank sections

## Example Tool Usage

```javascript
// Example: Create a new thinking chain
{
  "problem": "How to improve user engagement on our platform",
  "thinking_type": "systems",
  "context": "Our user engagement metrics have decreased by 15% over the past quarter"
}

// Example: Add a thinking step
{
  "chain_id": "3a7e4fc0-5c1d-4b9f-9d1a-8b5e7c5a9d3e",
  "description": "Identify key components of the engagement system",
  "reasoning": "User engagement consists of several interconnected components including onboarding, core user actions, notification systems, and retention mechanisms.",
  "evidence": "Analysis of our user journey maps and analytics data",
  "confidence": 0.8
}

// Example: Generate a visualization
{
  "chain_id": "3a7e4fc0-5c1d-4b9f-9d1a-8b5e7c5a9d3e",
  "format": "mermaid",
  "options": {
    "showValidation": true,
    "showConfidence": true
  }
}
```

## Tag System

The server implements a comprehensive tagging system with multiple dimensions:

- **Thinking Type** - analytical, creative, critical, systems, etc.
- **Domain** - business, science, technology, art, etc.
- **Complexity** - simple, moderate, complex
- **Status** - draft, validated, complete
- **Custom** - user-defined tags

## License

MIT
