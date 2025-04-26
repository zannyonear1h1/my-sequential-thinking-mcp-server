#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode
} from '@modelcontextprotocol/sdk/types.js';

import { SequentialThinkingEngine } from './sequential-thinking.js';
import { MemoryBankConnector } from './memory-integration.js';
import { TagManager } from './tag-manager.js';
import { VisualizationGenerator } from './visualization.js';

/**
 * Sequential Thinking MCP Server
 * 
 * This server provides structured tools for breaking down problems into 
 * sequential reasoning steps, tracking chains of thought, and integrating
 * with Cline's Memory Bank.
 */
class SequentialThinkingServer {
  constructor() {
    this.server = new Server(
      {
        name: 'sequential-thinking-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
    
    // Initialize core components
    this.thinkingEngine = new SequentialThinkingEngine();
    this.memoryConnector = new MemoryBankConnector();
    this.tagManager = new TagManager();
    this.visualizer = new VisualizationGenerator();
    
    // Set up tool handlers
    this.setupToolHandlers();
    
    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  setupToolHandlers() {
    // Register all tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'create_thinking_chain',
          description: 'Create a new sequential thinking process with specified parameters',
          inputSchema: {
            type: 'object',
            properties: {
              problem: {
                type: 'string',
                description: 'Problem description'
              },
              thinking_type: {
                type: 'string',
                description: 'Type of thinking to apply (e.g., "analytical", "creative", "critical", "systems")',
                enum: ["analytical", "creative", "critical", "systems", "first-principles", "divergent", "convergent", "inductive", "deductive"]
              },
              context: {
                type: 'string',
                description: 'Additional context information'
              },
              tags: {
                type: 'array',
                items: {
                  type: 'string'
                },
                description: 'Optional tags to categorize this thinking chain'
              }
            },
            required: ['problem']
          }
        },
        {
          name: 'add_thinking_step',
          description: 'Add a step to an existing thinking chain',
          inputSchema: {
            type: 'object',
            properties: {
              chain_id: {
                type: 'string',
                description: 'Identifier of the thinking chain'
              },
              description: {
                type: 'string',
                description: 'Step description'
              },
              reasoning: {
                type: 'string',
                description: 'Reasoning for this step'
              },
              evidence: {
                type: 'string',
                description: 'Supporting evidence for this step'
              },
              confidence: {
                type: 'number',
                description: 'Confidence level (0-1)',
                minimum: 0,
                maximum: 1
              }
            },
            required: ['chain_id', 'description', 'reasoning']
          }
        },
        {
          name: 'validate_step',
          description: 'Validate logical connections between steps',
          inputSchema: {
            type: 'object',
            properties: {
              chain_id: {
                type: 'string',
                description: 'Identifier of the thinking chain'
              },
              step_id: {
                type: 'string',
                description: 'Identifier of the step to validate'
              }
            },
            required: ['chain_id', 'step_id']
          }
        },
        {
          name: 'get_chain',
          description: 'Retrieve a complete thinking chain',
          inputSchema: {
            type: 'object',
            properties: {
              chain_id: {
                type: 'string',
                description: 'Identifier of the thinking chain'
              },
              include_metadata: {
                type: 'boolean',
                description: 'Whether to include metadata in the response',
                default: false
              }
            },
            required: ['chain_id']
          }
        },
        {
          name: 'generate_visualization',
          description: 'Create visual representation of a thinking chain',
          inputSchema: {
            type: 'object',
            properties: {
              chain_id: {
                type: 'string',
                description: 'Identifier of the thinking chain'
              },
              format: {
                type: 'string',
                description: 'Format of visualization (mermaid, json, text)',
                enum: ['mermaid', 'json', 'text'],
                default: 'mermaid'
              },
              options: {
                type: 'object',
                description: 'Additional options for visualization'
              }
            },
            required: ['chain_id']
          }
        },
        {
          name: 'save_to_memory',
          description: 'Save a thinking chain to Memory Bank',
          inputSchema: {
            type: 'object',
            properties: {
              chain_id: {
                type: 'string',
                description: 'Identifier of the thinking chain'
              },
              memory_name: {
                type: 'string',
                description: 'Name for the memory'
              },
              tags: {
                type: 'array',
                items: {
                  type: 'string'
                },
                description: 'Tags for the memory'
              },
              update_active_context: {
                type: 'boolean',
                description: 'Whether to update activeContext.md',
                default: false
              }
            },
            required: ['chain_id', 'memory_name']
          }
        },
        {
          name: 'load_from_memory',
          description: 'Load a thinking chain from Memory Bank',
          inputSchema: {
            type: 'object',
            properties: {
              memory_id: {
                type: 'string',
                description: 'Identifier of the memory'
              },
              query: {
                type: 'object',
                description: 'Search parameters if memory_id is not provided'
              }
            },
            required: ['memory_id']
          }
        },
        {
          name: 'search_related_thinking',
          description: 'Find related thinking chains based on parameters',
          inputSchema: {
            type: 'object',
            properties: {
              keywords: {
                type: 'array',
                items: {
                  type: 'string'
                },
                description: 'Keywords to search for'
              },
              tags: {
                type: 'array',
                items: {
                  type: 'string'
                },
                description: 'Tags to filter by'
              },
              thinking_type: {
                type: 'string',
                description: 'Type of thinking to filter by'
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results to return',
                default: 10
              }
            }
          }
        },
        {
          name: 'apply_template',
          description: 'Apply a reasoning template to current thinking',
          inputSchema: {
            type: 'object',
            properties: {
              template_name: {
                type: 'string',
                description: 'Name of the template to apply'
              },
              problem_context: {
                type: 'string',
                description: 'Context for the problem'
              },
              customize: {
                type: 'object',
                description: 'Custom parameters for the template'
              }
            },
            required: ['template_name', 'problem_context']
          }
        }
      ]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      // Tool handler implementation
      switch (request.params.name) {
        case 'create_thinking_chain':
          return await this.handleCreateThinkingChain(request.params.arguments);
        case 'add_thinking_step':
          return await this.handleAddThinkingStep(request.params.arguments);
        case 'validate_step':
          return await this.handleValidateStep(request.params.arguments);
        case 'get_chain':
          return await this.handleGetChain(request.params.arguments);
        case 'generate_visualization':
          return await this.handleGenerateVisualization(request.params.arguments);
        case 'save_to_memory':
          return await this.handleSaveToMemory(request.params.arguments);
        case 'load_from_memory':
          return await this.handleLoadFromMemory(request.params.arguments);
        case 'search_related_thinking':
          return await this.handleSearchRelatedThinking(request.params.arguments);
        case 'apply_template':
          return await this.handleApplyTemplate(request.params.arguments);
        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
      }
    });
  }

  // Tool handler implementations
  async handleCreateThinkingChain(args) {
    try {
      const chainData = await this.thinkingEngine.createChain(args);
      
      // Apply any tags passed to the chain
      if (args.tags && args.tags.length > 0) {
        await this.tagManager.applyTags(chainData.id, args.tags);
      }
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              chain_id: chainData.id,
              status: 'created',
              structure: chainData.structure,
              timestamp: new Date().toISOString()
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      return this.handleError('create_thinking_chain', error);
    }
  }

  async handleAddThinkingStep(args) {
    try {
      const stepData = await this.thinkingEngine.addStep(
        args.chain_id,
        args.description,
        args.reasoning,
        args.evidence,
        args.confidence
      );
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              chain_id: args.chain_id,
              step_id: stepData.id,
              status: 'added',
              timestamp: new Date().toISOString()
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      return this.handleError('add_thinking_step', error);
    }
  }

  async handleValidateStep(args) {
    try {
      const validationResult = await this.thinkingEngine.validateStep(
        args.chain_id,
        args.step_id
      );
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(validationResult, null, 2)
          }
        ]
      };
    } catch (error) {
      return this.handleError('validate_step', error);
    }
  }

  async handleGetChain(args) {
    try {
      const chainData = await this.thinkingEngine.getChain(
        args.chain_id,
        args.include_metadata
      );
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(chainData, null, 2)
          }
        ]
      };
    } catch (error) {
      return this.handleError('get_chain', error);
    }
  }

  async handleGenerateVisualization(args) {
    try {
      const chainData = await this.thinkingEngine.getChain(args.chain_id, true);
      const visualization = await this.visualizer.generateVisualization(
        chainData,
        args.format || 'mermaid',
        args.options
      );
      
      return {
        content: [
          {
            type: 'text',
            text: visualization
          }
        ]
      };
    } catch (error) {
      return this.handleError('generate_visualization', error);
    }
  }

  async handleSaveToMemory(args) {
    try {
      const chainData = await this.thinkingEngine.getChain(args.chain_id, true);
      const memoryResult = await this.memoryConnector.saveToMemory(
        chainData,
        args.memory_name,
        args.tags,
        args.update_active_context
      );
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(memoryResult, null, 2)
          }
        ]
      };
    } catch (error) {
      return this.handleError('save_to_memory', error);
    }
  }

  async handleLoadFromMemory(args) {
    try {
      const chainData = await this.memoryConnector.loadFromMemory(
        args.memory_id,
        args.query
      );
      
      // Register the loaded chain with the thinking engine
      await this.thinkingEngine.registerLoadedChain(chainData);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              chain_id: chainData.id,
              status: 'loaded',
              structure: chainData.structure,
              timestamp: new Date().toISOString()
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      return this.handleError('load_from_memory', error);
    }
  }

  async handleSearchRelatedThinking(args) {
    try {
      const searchResults = await this.memoryConnector.searchRelatedThinking(
        args.keywords,
        args.tags,
        args.thinking_type,
        args.limit
      );
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(searchResults, null, 2)
          }
        ]
      };
    } catch (error) {
      return this.handleError('search_related_thinking', error);
    }
  }

  async handleApplyTemplate(args) {
    try {
      const templateResult = await this.thinkingEngine.applyTemplate(
        args.template_name,
        args.problem_context,
        args.customize
      );
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              chain_id: templateResult.id,
              status: 'template_applied',
              structure: templateResult.structure,
              timestamp: new Date().toISOString()
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      return this.handleError('apply_template', error);
    }
  }

  handleError(toolName, error) {
    console.error(`Error in ${toolName}:`, error);
    
    if (error instanceof McpError) {
      throw error;
    }
    
    return {
      content: [
        {
          type: 'text',
          text: `Error in ${toolName}: ${error.message}`
        }
      ],
      isError: true
    };
  }

  async run() {
    try {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      console.error('Sequential Thinking MCP server running on stdio');
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }
}

const server = new SequentialThinkingServer();
server.run().catch(console.error);
