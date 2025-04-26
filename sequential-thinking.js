/**
 * Sequential Thinking Engine
 * 
 * Core component for managing sequential thinking chains, steps, and reasoning validation.
 * Provides functionality for:
 * - Creating and managing thinking chains
 * - Adding steps with reasoning and evidence
 * - Validating logical connections between steps
 * - Applying reasoning templates
 */

import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ThinkingValidator } from './utils/thinking-validator.js';
import { FileStorage } from './utils/file-storage.js';

export class SequentialThinkingEngine {
  constructor() {
    this.chains = new Map();
    this.validator = new ThinkingValidator();
    this.storage = new FileStorage('chains');
    this.templatesDir = path.join(process.cwd(), 'templates');
    
    // Initialize storage
    this.initialize();
  }
  
  async initialize() {
    try {
      await this.storage.ensureStorageExists();
      await this.loadPersistedChains();
    } catch (error) {
      console.error('Failed to initialize thinking engine:', error);
    }
  }
  
  async loadPersistedChains() {
    try {
      const chainIds = await this.storage.listEntities();
      
      for (const chainId of chainIds) {
        const chainData = await this.storage.readEntity(chainId);
        this.chains.set(chainId, chainData);
      }
      
      console.log(`Loaded ${chainIds.length} thinking chains from storage`);
    } catch (error) {
      console.error('Failed to load persisted chains:', error);
    }
  }
  
  /**
   * Create a new thinking chain
   * 
   * @param {Object} params - Parameters for the new chain
   * @param {string} params.problem - Problem description
   * @param {string} params.thinking_type - Type of thinking to apply
   * @param {string} params.context - Additional context information
   * @returns {Object} Chain data with ID and structure
   */
  async createChain(params) {
    const chainId = uuidv4();
    const timestamp = new Date().toISOString();
    
    // Set default thinking type if not provided
    const thinkingType = params.thinking_type || 'analytical';
    
    const chainData = {
      id: chainId,
      problem: params.problem,
      thinking_type: thinkingType,
      context: params.context || '',
      created_at: timestamp,
      updated_at: timestamp,
      steps: [],
      metadata: {
        status: 'in_progress',
        validation_state: 'not_validated',
        completion_percentage: 0,
        tags: params.tags || []
      },
      structure: this.getInitialStructure(thinkingType)
    };
    
    // Store the chain
    this.chains.set(chainId, chainData);
    await this.persistChain(chainId);
    
    return {
      id: chainId,
      structure: chainData.structure
    };
  }
  
  /**
   * Add a new step to a thinking chain
   * 
   * @param {string} chainId - ID of the chain
   * @param {string} description - Step description
   * @param {string} reasoning - Reasoning for the step
   * @param {string} evidence - Supporting evidence
   * @param {number} confidence - Confidence level (0-1)
   * @returns {Object} Step data
   */
  async addStep(chainId, description, reasoning, evidence, confidence) {
    const chain = this.getChainById(chainId);
    
    const stepId = uuidv4();
    const timestamp = new Date().toISOString();
    
    // Create the step
    const stepData = {
      id: stepId,
      description,
      reasoning,
      evidence: evidence || '',
      confidence: confidence || 0.5,
      created_at: timestamp,
      updated_at: timestamp,
      previous_step_id: chain.steps.length > 0 ? chain.steps[chain.steps.length - 1].id : null,
      validation: {
        is_validated: false,
        issues: [],
        score: null
      }
    };
    
    // Add the step to the chain
    chain.steps.push(stepData);
    chain.updated_at = timestamp;
    
    // Update completion percentage
    if (chain.structure && chain.structure.expected_steps) {
      chain.metadata.completion_percentage = 
        Math.min(100, Math.round((chain.steps.length / chain.structure.expected_steps) * 100));
    }
    
    // Persist the updated chain
    await this.persistChain(chainId);
    
    return {
      id: stepId,
      chain_id: chainId
    };
  }
  
  /**
   * Validate a step in a thinking chain
   * 
   * @param {string} chainId - ID of the chain
   * @param {string} stepId - ID of the step to validate
   * @returns {Object} Validation results
   */
  async validateStep(chainId, stepId) {
    const chain = this.getChainById(chainId);
    const stepIndex = chain.steps.findIndex(step => step.id === stepId);
    
    if (stepIndex === -1) {
      throw new Error(`Step ${stepId} not found in chain ${chainId}`);
    }
    
    const step = chain.steps[stepIndex];
    const previousStep = stepIndex > 0 ? chain.steps[stepIndex - 1] : null;
    
    // Perform validation
    const validationResult = await this.validator.validateStep(step, previousStep, chain);
    
    // Update the step with validation results
    step.validation = {
      is_validated: true,
      issues: validationResult.issues,
      score: validationResult.score
    };
    
    // Persist the updated chain
    await this.persistChain(chainId);
    
    return validationResult;
  }
  
  /**
   * Get a thinking chain by ID
   * 
   * @param {string} chainId - ID of the chain
   * @param {boolean} includeMetadata - Whether to include metadata
   * @returns {Object} Chain data
   */
  async getChain(chainId, includeMetadata = false) {
    const chain = this.getChainById(chainId);
    
    if (!includeMetadata) {
      // Create a copy without metadata
      const { metadata, ...chainWithoutMetadata } = chain;
      return chainWithoutMetadata;
    }
    
    return chain;
  }
  
  /**
   * Apply a reasoning template to create a new chain
   * 
   * @param {string} templateName - Name of the template
   * @param {string} problemContext - Problem context
   * @param {Object} customize - Custom parameters
   * @returns {Object} New chain data
   */
  async applyTemplate(templateName, problemContext, customize = {}) {
    try {
      // Load the template
      const templatePath = path.join(this.templatesDir, `${templateName}.json`);
      const templateData = JSON.parse(await fs.readFile(templatePath, 'utf8'));
      
      // Create parameters for the new chain
      const chainParams = {
        problem: problemContext,
        thinking_type: templateData.thinking_type,
        context: `Template: ${templateName}. ${templateData.description || ''}`
      };
      
      // Create the chain
      const chainData = await this.createChain(chainParams);
      const chain = this.getChainById(chainData.id);
      
      // Apply template structure
      chain.structure = {
        ...chain.structure,
        ...templateData.structure,
        template_name: templateName,
        customized: !!customize
      };
      
      // Apply customizations if provided
      if (customize) {
        // Merge customizations with template
        chain.structure = {
          ...chain.structure,
          ...customize
        };
      }
      
      // Add template steps if defined
      if (templateData.steps && Array.isArray(templateData.steps)) {
        for (const templateStep of templateData.steps) {
          await this.addStep(
            chain.id,
            this.substituteVariables(templateStep.description, { problem: problemContext, ...customize }),
            this.substituteVariables(templateStep.reasoning || '', { problem: problemContext, ...customize }),
            templateStep.evidence || '',
            templateStep.confidence || 0.5
          );
        }
      }
      
      // Persist the updated chain
      await this.persistChain(chain.id);
      
      return {
        id: chain.id,
        structure: chain.structure
      };
    } catch (error) {
      throw new Error(`Failed to apply template: ${error.message}`);
    }
  }
  
  /**
   * Register a loaded chain from Memory Bank
   * 
   * @param {Object} chainData - Chain data
   * @returns {string} Chain ID
   */
  async registerLoadedChain(chainData) {
    // Ensure the chain has an ID
    const chainId = chainData.id || uuidv4();
    chainData.id = chainId;
    
    // Store the chain
    this.chains.set(chainId, chainData);
    await this.persistChain(chainId);
    
    return chainId;
  }
  
  /**
   * Get initial structure for a thinking chain based on type
   * 
   * @param {string} thinkingType - Type of thinking
   * @returns {Object} Initial structure
   */
  getInitialStructure(thinkingType) {
    // Common structure for all thinking types
    const structure = {
      phase: 'initial',
      expected_steps: 5
    };
    
    // Type-specific structure
    switch (thinkingType) {
      case 'analytical':
        return {
          ...structure,
          pattern: 'break_down_analyze_synthesize',
          expected_steps: 5
        };
      case 'creative':
        return {
          ...structure,
          pattern: 'diverge_explore_converge',
          expected_steps: 6
        };
      case 'critical':
        return {
          ...structure,
          pattern: 'question_evaluate_conclude',
          expected_steps: 4
        };
      case 'systems':
        return {
          ...structure,
          pattern: 'map_analyze_model',
          expected_steps: 7
        };
      case 'first-principles':
        return {
          ...structure,
          pattern: 'identify_break_down_reassemble',
          expected_steps: 5
        };
      case 'divergent':
        return {
          ...structure,
          pattern: 'generate_alternatives_explore',
          expected_steps: 6
        };
      case 'convergent':
        return {
          ...structure,
          pattern: 'analyze_evaluate_select',
          expected_steps: 4
        };
      case 'inductive':
        return {
          ...structure,
          pattern: 'observe_pattern_hypothesize',
          expected_steps: 5
        };
      case 'deductive':
        return {
          ...structure,
          pattern: 'premise_logic_conclusion',
          expected_steps: 4
        };
      default:
        return structure;
    }
  }
  
  /**
   * Get a chain by ID or throw an error if not found
   * 
   * @param {string} chainId - ID of the chain
   * @returns {Object} Chain data
   * @private
   */
  getChainById(chainId) {
    const chain = this.chains.get(chainId);
    
    if (!chain) {
      throw new Error(`Thinking chain ${chainId} not found`);
    }
    
    return chain;
  }
  
  /**
   * Persist a chain to storage
   * 
   * @param {string} chainId - ID of the chain
   * @private
   */
  async persistChain(chainId) {
    const chain = this.getChainById(chainId);
    await this.storage.writeEntity(chainId, chain);
  }
  
  /**
   * Substitute variables in a template string
   * 
   * @param {string} text - Template text
   * @param {Object} variables - Variables to substitute
   * @returns {string} Text with variables substituted
   * @private
   */
  substituteVariables(text, variables) {
    if (!text) return '';
    
    return text.replace(/\$\{([^}]+)\}/g, (match, key) => {
      return variables[key] || match;
    });
  }
}
