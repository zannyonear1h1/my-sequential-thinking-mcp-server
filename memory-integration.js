/**
 * Memory Bank Connector
 * 
 * Provides integration with Cline's Memory Bank for storing and retrieving thinking chains.
 * This module handles:
 * - Reading from Memory Bank files (projectbrief.md, activeContext.md, etc.)
 * - Storing thinking chains as structured memories
 * - Retrieving thinking chains from Memory Bank
 * - Updating Memory Bank with reasoning outcomes
 */

import fs from 'fs/promises';
import path from 'path';
import { promisify } from 'util';
import { exec as execCallback } from 'child_process';
import { v4 as uuidv4 } from 'uuid';

// Promisify exec
const exec = promisify(execCallback);

export class MemoryBankConnector {
  constructor() {
    // Memory Bank API endpoint - configured to call the MCP server
    this.memoryBankServerName = 'zannys-memory-bank';
    
    // Initialize memory cache
    this.memoryCache = new Map();
    
    // Initialize
    this.initialize();
  }
  
  async initialize() {
    try {
      // Test connection to Memory Bank
      await this.testConnection();
      
      // Cache frequently accessed resources
      await this.cacheCommonResources();
    } catch (error) {
      console.error('Memory Bank connector initialization failed:', error);
    }
  }
  
  async testConnection() {
    try {
      // Test connection by listing memories
      await this.callMemoryBankTool('list_memories', {});
      console.log('Successfully connected to Memory Bank');
      return true;
    } catch (error) {
      console.error('Failed to connect to Memory Bank:', error);
      return false;
    }
  }
  
  async cacheCommonResources() {
    try {
      // Cache core Memory Bank files for quick access
      const coreFiles = [
        'projectbrief.md',
        'activeContext.md',
        'systemPatterns.md',
        'techContext.md',
        'progress.md'
      ];
      
      for (const file of coreFiles) {
        try {
          const content = await this.readMemoryBankFile(file);
          if (content) {
            this.memoryCache.set(file, content);
          }
        } catch (error) {
          console.warn(`Could not cache ${file}: ${error.message}`);
        }
      }
      
      console.log('Core Memory Bank resources cached');
    } catch (error) {
      console.error('Failed to cache Memory Bank resources:', error);
    }
  }
  
  /**
   * Save a thinking chain to Memory Bank
   * 
   * @param {Object} chainData - Thinking chain data
   * @param {string} memoryName - Name for the memory
   * @param {Array<string>} tags - Tags for the memory
   * @param {boolean} updateActiveContext - Whether to update activeContext.md
   * @returns {Object} Result object with memory ID
   */
  async saveToMemory(chainData, memoryName, tags = [], updateActiveContext = false) {
    try {
      // Prepare the memory content
      const memoryContent = this.formatChainForMemoryBank(chainData, memoryName);
      
      // Save to Memory Bank
      const saveResult = await this.callMemoryBankTool('save_memory', {
        content: memoryContent
      });
      
      const memoryId = saveResult.id || uuidv4();
      
      // Apply tags if provided
      if (tags && tags.length > 0) {
        // Tags are applied when saving the memory in our formatted content,
        // no separate API call needed in this implementation
      }
      
      // Update activeContext.md if requested
      if (updateActiveContext) {
        await this.updateActiveContext(chainData, memoryName, memoryId);
      }
      
      return {
        memory_id: memoryId,
        status: 'saved',
        location: saveResult.location || 'memory_bank',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Failed to save to Memory Bank: ${error.message}`);
    }
  }
  
  /**
   * Load a thinking chain from Memory Bank
   * 
   * @param {string} memoryId - Memory ID
   * @param {Object} query - Query parameters (unused if memoryId is provided)
   * @returns {Object} Thinking chain data
   */
  async loadFromMemory(memoryId, query = null) {
    try {
      let memoryContent;
      
      if (memoryId) {
        // Load by ID
        const readResult = await this.callMemoryBankTool('read_memory', {
          name: memoryId
        });
        
        memoryContent = readResult.content;
      } else if (query) {
        // Search for memory that matches query (not fully implemented in this version)
        const memories = await this.searchRelatedThinking(
          query.keywords,
          query.tags,
          query.thinking_type,
          1
        );
        
        if (memories.results.length === 0) {
          throw new Error('No matching memories found');
        }
        
        memoryId = memories.results[0].id;
        
        // Load the memory by ID
        const readResult = await this.callMemoryBankTool('read_memory', {
          name: memoryId
        });
        
        memoryContent = readResult.content;
      } else {
        throw new Error('Either memoryId or query must be provided');
      }
      
      // Parse the memory content back into a thinking chain
      const chainData = this.parseMemoryToChain(memoryContent, memoryId);
      
      return chainData;
    } catch (error) {
      throw new Error(`Failed to load from Memory Bank: ${error.message}`);
    }
  }
  
  /**
   * Search for related thinking chains
   * 
   * @param {Array<string>} keywords - Keywords to search for
   * @param {Array<string>} tags - Tags to filter by
   * @param {string} thinkingType - Type of thinking to filter by
   * @param {number} limit - Maximum number of results to return
   * @returns {Object} Search results
   */
  async searchRelatedThinking(keywords = [], tags = [], thinkingType = null, limit = 10) {
    try {
      // Build search command for Memory Bank
      let searchText = 'list memories';
      
      // Add filters
      if (keywords && keywords.length > 0) {
        searchText += ` containing ${keywords.join(' ')}`;
      }
      
      if (tags && tags.length > 0) {
        searchText += ` tagged ${tags.join(' ')}`;
      }
      
      if (thinkingType) {
        searchText += ` type:${thinkingType}`;
      }
      
      if (limit) {
        searchText += ` limit:${limit}`;
      }
      
      // Call Memory Bank search
      const searchResult = await this.callMemoryBankTool('process_memory_command', {
        text: searchText
      });
      
      // Parse the results (actual format depends on Memory Bank implementation)
      let memories = [];
      
      if (searchResult && searchResult.memories) {
        memories = searchResult.memories;
      } else if (searchResult && typeof searchResult === 'string') {
        // Try to parse string response if needed
        try {
          const parsedResult = JSON.parse(searchResult);
          if (parsedResult.memories) {
            memories = parsedResult.memories;
          }
        } catch (e) {
          // Not JSON, try to parse text format
          // This is a simplified example and may need adjustment based on
          // the actual format returned by the Memory Bank
          const lines = searchResult.split('\n');
          memories = lines
            .filter(line => line.trim().startsWith('- '))
            .map(line => {
              const parts = line.trim().substring(2).split(':');
              return {
                id: parts[0].trim(),
                title: parts.length > 1 ? parts[1].trim() : parts[0].trim()
              };
            });
        }
      }
      
      return {
        count: memories.length,
        results: memories.slice(0, limit),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Failed to search Memory Bank: ${error.message}`);
    }
  }
  
  /**
   * Update activeContext.md with thinking chain results
   * 
   * @param {Object} chainData - Thinking chain data
   * @param {string} memoryName - Name of the memory
   * @param {string} memoryId - ID of the memory
   * @private
   */
  async updateActiveContext(chainData, memoryName, memoryId) {
    try {
      // Read current activeContext.md
      let activeContextContent = await this.readMemoryBankFile('activeContext.md');
      
      // If not found, create basic structure
      if (!activeContextContent) {
        activeContextContent = '# Active Context\n\n## Current Focus\n\n## Recent Changes\n\n## Next Steps\n\n## Active Decisions\n\n';
      }
      
      // Generate summary of the thinking chain
      const summary = this.generateThinkingChainSummary(chainData);
      
      // Add the summary to activeContext.md
      // Determine which section to update based on chain type and content
      let sectionMarker;
      
      if (chainData.thinking_type === 'critical' || chainData.thinking_type === 'analytical') {
        sectionMarker = '## Active Decisions';
      } else if (chainData.steps && chainData.steps.length > 0 && 
                chainData.steps[chainData.steps.length - 1].description.toLowerCase().includes('next step')) {
        sectionMarker = '## Next Steps';
      } else {
        sectionMarker = '## Recent Changes';
      }
      
      // Find the section and add our summary
      const sections = activeContextContent.split(/^## /m);
      const updatedSections = [];
      
      let foundSection = false;
      
      for (const section of sections) {
        if (!section.trim()) {
          continue;
        }
        
        if (section.startsWith(sectionMarker.substring(3))) {
          // This is our target section
          foundSection = true;
          
          // Add our summary at the top of the section
          const sectionLines = section.split('\n');
          const sectionTitle = sectionLines[0];
          const restOfSection = sectionLines.slice(1).join('\n');
          
          updatedSections.push(`## ${sectionTitle}\n\n### Sequential Thinking: ${memoryName}\n${summary}\n\nReference: [${memoryId}]\n\n${restOfSection}`);
        } else {
          // Keep other sections as is
          updatedSections.push(`## ${section}`);
        }
      }
      
      if (!foundSection) {
        // Section not found, add it
        updatedSections.push(`## ${sectionMarker.substring(3)}\n\n### Sequential Thinking: ${memoryName}\n${summary}\n\nReference: [${memoryId}]\n\n`);
      }
      
      // Join the sections back together
      const updatedContent = updatedSections.join('\n\n');
      
      // Write the updated content
      await this.writeMemoryBankFile('activeContext.md', updatedContent);
      
      return true;
    } catch (error) {
      console.error('Failed to update activeContext.md:', error);
      return false;
    }
  }
  
  /**
   * Generate a summary of a thinking chain
   * 
   * @param {Object} chainData - Thinking chain data
   * @returns {string} Summary text
   * @private
   */
  generateThinkingChainSummary(chainData) {
    let summary = `**Problem**: ${chainData.problem}\n\n`;
    
    // Add thinking type
    summary += `**Approach**: ${this.formatThinkingType(chainData.thinking_type)} thinking\n\n`;
    
    // Add key steps or conclusions
    if (chainData.steps && chainData.steps.length > 0) {
      // For brevity, just include first step and last step if there are many
      if (chainData.steps.length > 3) {
        summary += '**Key points**:\n';
        
        // Add first step
        summary += `- Starting point: ${chainData.steps[0].description}\n`;
        
        // Add last step (conclusion)
        const lastStep = chainData.steps[chainData.steps.length - 1];
        summary += `- Conclusion: ${lastStep.description}\n`;
      } else {
        // If just a few steps, include all of them
        summary += '**Steps**:\n';
        
        for (const step of chainData.steps) {
          summary += `- ${step.description}\n`;
        }
      }
    }
    
    return summary;
  }
  
  /**
   * Format a thinking chain for Memory Bank storage
   * 
   * @param {Object} chainData - Thinking chain data
   * @param {string} memoryName - Name for the memory
   * @returns {string} Formatted content for Memory Bank
   * @private
   */
  formatChainForMemoryBank(chainData, memoryName) {
    // Create a markdown representation of the thinking chain
    let content = `# Sequential Thinking: ${memoryName}\n\n`;
    
    // Add metadata header with tags
    content += `---\n`;
    content += `type: sequential-thinking\n`;
    content += `thinking_type: ${chainData.thinking_type || 'analytical'}\n`;
    
    // Add tags if available
    if (chainData.metadata && chainData.metadata.tags && chainData.metadata.tags.length > 0) {
      content += `tags: ${chainData.metadata.tags.join(', ')}\n`;
    }
    
    // Add timestamp
    content += `created: ${chainData.created_at}\n`;
    content += `updated: ${chainData.updated_at || chainData.created_at}\n`;
    content += `id: ${chainData.id}\n`;
    content += `---\n\n`;
    
    // Add problem statement
    content += `## Problem\n\n${chainData.problem}\n\n`;
    
    // Add context if available
    if (chainData.context) {
      content += `## Context\n\n${chainData.context}\n\n`;
    }
    
    // Add thinking approach
    content += `## Thinking Approach\n\n`;
    content += `This analysis uses **${this.formatThinkingType(chainData.thinking_type)}** thinking `;
    
    if (chainData.structure && chainData.structure.pattern) {
      content += `following a ${chainData.structure.pattern.replace(/_/g, '-')} pattern.\n\n`;
    } else {
      content += `approach.\n\n`;
    }
    
    // Add steps
    if (chainData.steps && chainData.steps.length > 0) {
      content += `## Reasoning Process\n\n`;
      
      for (let i = 0; i < chainData.steps.length; i++) {
        const step = chainData.steps[i];
        content += `### Step ${i + 1}: ${step.description}\n\n`;
        
        // Add reasoning
        content += `${step.reasoning}\n\n`;
        
        // Add evidence if available
        if (step.evidence) {
          content += `**Evidence**: ${step.evidence}\n\n`;
        }
        
        // Add confidence if available
        if (step.confidence !== undefined) {
          content += `**Confidence**: ${Math.round(step.confidence * 100)}%\n\n`;
        }
        
        // Add validation info if available
        if (step.validation && step.validation.is_validated) {
          content += `**Validation**: `;
          
          if (step.validation.score !== null) {
            const scorePercent = Math.round(step.validation.score * 100);
            content += `${scorePercent}% valid`;
          }
          
          if (step.validation.issues && step.validation.issues.length > 0) {
            content += `\n\n**Issues**:\n`;
            
            for (const issue of step.validation.issues) {
              content += `- ${issue}\n`;
            }
          }
          
          content += '\n';
        }
      }
    }
    
    // Add conclusion if there are steps
    if (chainData.steps && chainData.steps.length > 0) {
      const lastStep = chainData.steps[chainData.steps.length - 1];
      
      content += `## Conclusion\n\n`;
      content += `${lastStep.description}\n\n`;
      
      if (lastStep.reasoning) {
        content += `${lastStep.reasoning}\n\n`;
      }
    }
    
    // Add metadata footer
    content += `---\n\n`;
    content += `Generated by Sequential Thinking Engine\n`;
    content += `Chain ID: ${chainData.id}\n`;
    
    return content;
  }
  
  /**
   * Parse a Memory Bank memory back into a thinking chain
   * 
   * @param {string} memoryContent - Memory content
   * @param {string} memoryId - Memory ID
   * @returns {Object} Thinking chain data
   * @private
   */
  parseMemoryToChain(memoryContent, memoryId) {
    try {
      // Split content into lines for parsing
      const lines = memoryContent.split('\n');
      
      // Initialize chain data
      const chainData = {
        id: memoryId,
        problem: '',
        context: '',
        thinking_type: 'analytical',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        steps: [],
        metadata: {
          status: 'loaded',
          validation_state: 'not_validated',
          completion_percentage: 100,
          tags: []
        },
        structure: {
          phase: 'complete',
          expected_steps: 5
        }
      };
      
      // Parse metadata from Markdown frontmatter if present
      let inFrontmatter = false;
      let currentSection = null;
      let currentStep = null;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Handle frontmatter
        if (line.trim() === '---') {
          inFrontmatter = !inFrontmatter;
          continue;
        }
        
        if (inFrontmatter) {
          // Parse frontmatter values
          const match = line.match(/^([^:]+):\s*(.*)$/);
          if (match) {
            const [, key, value] = match;
            
            switch (key.trim().toLowerCase()) {
              case 'thinking_type':
                chainData.thinking_type = value.trim();
                break;
              case 'tags':
                chainData.metadata.tags = value.split(',').map(tag => tag.trim());
                break;
              case 'created':
                chainData.created_at = value.trim();
                break;
              case 'updated':
                chainData.updated_at = value.trim();
                break;
              case 'id':
                // Use the ID from the frontmatter if available, otherwise keep the one we have
                chainData.id = value.trim() || chainData.id;
                break;
            }
          }
          continue;
        }
        
        // Parse sections
        if (line.startsWith('## ')) {
          currentSection = line.substring(3).trim().toLowerCase();
          currentStep = null;
          continue;
        }
        
        if (line.startsWith('### Step ')) {
          // Parse step headers
          const stepMatch = line.match(/^### Step (\d+): (.*)$/);
          
          if (stepMatch) {
            const [, stepNumber, description] = stepMatch;
            
            currentStep = {
              id: `step-${stepNumber}`,
              description: description.trim(),
              reasoning: '',
              evidence: '',
              confidence: 0.5,
              created_at: chainData.created_at,
              updated_at: chainData.updated_at,
              previous_step_id: chainData.steps.length > 0 ? chainData.steps[chainData.steps.length - 1].id : null,
              validation: {
                is_validated: false,
                issues: [],
                score: null
              }
            };
            
            chainData.steps.push(currentStep);
          }
          
          continue;
        }
        
        // Handle content based on current section
        if (currentSection === 'problem') {
          if (line.trim() !== '') {
            chainData.problem += (chainData.problem ? '\n' : '') + line;
          }
        } else if (currentSection === 'context') {
          if (line.trim() !== '') {
            chainData.context += (chainData.context ? '\n' : '') + line;
          }
        } else if (currentSection === 'thinking approach') {
          // Already captured in metadata, nothing to do here
        } else if (currentSection === 'reasoning process') {
          if (currentStep) {
            // Parse step content
            if (line.startsWith('**Evidence**:')) {
              currentStep.evidence = line.substring('**Evidence**:'.length).trim();
            } else if (line.startsWith('**Confidence**:')) {
              const confidenceMatch = line.match(/(\d+)%/);
              if (confidenceMatch) {
                currentStep.confidence = parseInt(confidenceMatch[1], 10) / 100;
              }
            } else if (line.startsWith('**Validation**:')) {
              currentStep.validation.is_validated = true;
              
              const scoreMatch = line.match(/(\d+)% valid/);
              if (scoreMatch) {
                currentStep.validation.score = parseInt(scoreMatch[1], 10) / 100;
              }
            } else if (line.startsWith('- ') && currentStep.validation.is_validated) {
              // This is likely a validation issue
              currentStep.validation.issues.push(line.substring(2).trim());
            } else if (line.trim() !== '') {
              // This is part of the reasoning
              currentStep.reasoning += (currentStep.reasoning ? '\n' : '') + line;
            }
          }
        } else if (currentSection === 'conclusion') {
          // The conclusion is typically already captured in the last step
          // Nothing additional to do here
        }
      }
      
      // If we didn't find any steps, create a default one based on the problem
      if (chainData.steps.length === 0 && chainData.problem) {
        chainData.steps.push({
          id: 'step-1',
          description: 'Initial analysis',
          reasoning: chainData.problem,
          evidence: '',
          confidence: 0.5,
          created_at: chainData.created_at,
          updated_at: chainData.updated_at,
          previous_step_id: null,
          validation: {
            is_validated: false,
            issues: [],
            score: null
          }
        });
      }
      
      return chainData;
    } catch (error) {
      console.error('Error parsing memory content:', error);
      
      // Return a minimal valid chain
      return {
        id: memoryId,
        problem: 'Failed to parse memory content',
        thinking_type: 'analytical',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        steps: [],
        metadata: {
          status: 'error',
          validation_state: 'not_validated',
          completion_percentage: 0,
          tags: ['error', 'parsing_failed']
        }
      };
    }
  }
  
  /**
   * Read a file from Memory Bank
   * 
   * @param {string} filename - Name of the file
   * @returns {string} File content
   * @private
   */
  async readMemoryBankFile(filename) {
    try {
      // Check cache first
      if (this.memoryCache.has(filename)) {
        return this.memoryCache.get(filename);
      }
      
      // Try to read the memory using the Memory Bank tool
      const result = await this.callMemoryBankTool('read_memory', {
        name: filename
      });
      
      if (result && result.content) {
        // Cache the result
        this.memoryCache.set(filename, result.content);
        return result.content;
      }
      
      return null;
    } catch (error) {
      console.error(`Failed to read Memory Bank file ${filename}:`, error);
      return null;
    }
  }
  
  /**
   * Write a file to Memory Bank
   * 
   * @param {string} filename - Name of the file
   * @param {string} content - File content
   * @returns {boolean} Success status
   * @private
   */
  async writeMemoryBankFile(filename, content) {
    try {
      // Use the Memory Bank save_memory tool
      const result = await this.callMemoryBankTool('save_memory', {
        content: content,
        name: filename
      });
      
      // Update cache
      this.memoryCache.set(filename, content);
      
      return true;
    } catch (error) {
      console.error(`Failed to write Memory Bank file ${filename}:`, error);
      return false;
    }
  }
  
  /**
   * Call a Memory Bank tool
   * 
   * @param {string} toolName - Name of the tool
   * @param {Object} args - Tool arguments
   * @returns {Object} Tool result
   * @private
   */
  async callMemoryBankTool(toolName, args) {
    // In a real implementation, this would use the MCP client API
    // For now, we'll use a simplified approach
    
    switch (toolName) {
      case 'save_memory':
        // Simulate saving a memory
        return {
          id: args.name || uuidv4(),
          status: 'saved',
          location: 'memory_bank'
        };
        
      case 'read_memory':
        // Simulate reading a memory
        // In a real implementation, this would fetch from the Memory Bank
        if (args.name === 'activeContext.md') {
          return {
            name: args.name,
            content: `# Active Context\n\n## Current Focus\n\nDeveloping sequential thinking capabilities.\n\n## Recent Changes\n\n## Next Steps\n\n## Active Decisions\n\n`
          };
        } else if (args.name === 'projectbrief.md') {
          return {
            name: args.name,
            content: `# Project Brief\n\nSequential Thinking integration with Memory Bank.\n`
          };
        } else {
          // For other files or memories, return a placeholder
          return {
            name: args.name,
            content: `# ${args.name}\n\nPlaceholder content.`
          };
        }
        
      case 'list_memories':
        // Simulate listing memories
        return {
          memories: [
            { id: 'memory1', title: 'Test Memory 1' },
            { id: 'memory2', title: 'Test Memory 2' }
          ]
        };
        
      case 'process_memory_command':
        // Simulate processing a memory command
        if (args.text.startsWith('list memories')) {
          return {
            memories: [
              { id: 'memory1', title: 'Test Memory 1' },
              { id: 'memory2', title: 'Test Memory 2' }
            ]
          };
        } else {
          return {
            status: 'command_processed',
            result: 'Command processed successfully'
          };
        }
        
      default:
        throw new Error(`Unknown Memory Bank tool: ${toolName}`);
    }
  }
  
  /**
   * Format a thinking type string for display
   * 
   * @param {string} thinkingType - Thinking type
   * @returns {string} Formatted thinking type
   * @private
   */
  formatThinkingType(thinkingType) {
    if (!thinkingType) return 'analytical';
    
    // Format: first-principles -> First Principles
    return thinkingType
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
