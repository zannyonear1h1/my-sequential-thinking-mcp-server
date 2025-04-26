/**
 * Visualization Generator
 * 
 * Provides functionality for generating visual representations of thinking chains.
 * This module handles:
 * - Converting thinking chains to various diagram formats
 * - Generating Mermaid diagrams for thinking processes
 * - Creating JSON representations for visualization
 * - Preparing text-based visualizations for simple use cases
 */

export class VisualizationGenerator {
  constructor() {
    this.colorMap = {
      analytical: ['#3498db', '#2980b9'],  // Blue shades
      creative: ['#e74c3c', '#c0392b'],    // Red shades
      critical: ['#f39c12', '#d35400'],    // Orange shades
      systems: ['#2ecc71', '#27ae60'],     // Green shades
      'first-principles': ['#9b59b6', '#8e44ad'],  // Purple shades
      divergent: ['#1abc9c', '#16a085'],   // Teal shades
      convergent: ['#e67e22', '#d35400'],  // Orange shades
      inductive: ['#3498db', '#2c3e50'],   // Blue/Dark blue
      deductive: ['#f1c40f', '#f39c12']    // Yellow shades
    };
    
    this.defaultColor = ['#95a5a6', '#7f8c8d'];  // Gray shades
  }
  
  /**
   * Generate a visualization of a thinking chain
   * 
   * @param {Object} chainData - Thinking chain data
   * @param {string} format - Format of visualization (mermaid, json, text)
   * @param {Object} options - Additional options for visualization
   * @returns {string} Visualization code/data
   */
  async generateVisualization(chainData, format = 'mermaid', options = {}) {
    switch (format.toLowerCase()) {
      case 'mermaid':
        return this.generateMermaidDiagram(chainData, options);
      case 'json':
        return this.generateJsonVisualization(chainData, options);
      case 'text':
        return this.generateTextVisualization(chainData, options);
      default:
        throw new Error(`Unsupported visualization format: ${format}`);
    }
  }
  
  /**
   * Generate a Mermaid diagram for a thinking chain
   * 
   * @param {Object} chainData - Thinking chain data
   * @param {Object} options - Additional options
   * @returns {string} Mermaid diagram code
   */
  generateMermaidDiagram(chainData, options = {}) {
    const { 
      showValidation = true,
      showConfidence = true,
      showEvidence = false,
      simplified = false,
      layout = 'TD'  // TD (top-down) or LR (left-right)
    } = options;
    
    // Get colors for this thinking type
    const colors = this.getColorsForThinkingType(chainData.thinking_type);
    const primaryColor = colors[0];
    const secondaryColor = colors[1];
    
    // Start building the Mermaid diagram
    let diagram = `flowchart ${layout}\n`;
    
    // Add problem node
    const problemId = 'problem';
    diagram += `    ${problemId}["Problem: ${this.escapeText(chainData.problem.substring(0, 50))}\n${
      chainData.problem.length > 50 ? '...' : ''
    }"]\n`;
    diagram += `    style ${problemId} fill:${secondaryColor},color:white,stroke:${primaryColor},stroke-width:2px\n\n`;
    
    // Add context node if available
    let lastNodeId = problemId;
    if (chainData.context && !simplified) {
      const contextId = 'context';
      diagram += `    ${contextId}["Context: ${this.escapeText(chainData.context.substring(0, 50))}\n${
        chainData.context.length > 50 ? '...' : ''
      }"]\n`;
      diagram += `    style ${contextId} fill:white,stroke:${secondaryColor},stroke-width:1px,stroke-dasharray: 5 5\n\n`;
      diagram += `    ${problemId} --> ${contextId}\n`;
      lastNodeId = contextId;
    }
    
    // Add steps
    if (chainData.steps && chainData.steps.length > 0) {
      // For each step, add a node
      chainData.steps.forEach((step, index) => {
        const stepId = `step${index + 1}`;
        
        // Create step node with description
        diagram += `    ${stepId}["Step ${index + 1}: ${this.escapeText(step.description)}"]\n`;
        
        // Add style to the step node based on validation if available
        if (showValidation && step.validation && step.validation.is_validated) {
          const score = step.validation.score || 0.5;
          const color = this.getValidationColor(score);
          diagram += `    style ${stepId} fill:${color},color:white,stroke:${primaryColor},stroke-width:2px\n`;
        } else {
          diagram += `    style ${stepId} fill:${primaryColor},color:white,stroke:${primaryColor},stroke-width:2px\n`;
        }
        
        // Connect to previous node
        diagram += `    ${lastNodeId} --> ${stepId}\n`;
        
        // Add confidence subnode if requested
        if (showConfidence && step.confidence !== undefined) {
          const confidenceId = `${stepId}_conf`;
          const confidencePercent = Math.round(step.confidence * 100);
          diagram += `    ${confidenceId}("Confidence: ${confidencePercent}%")\n`;
          diagram += `    style ${confidenceId} fill:white,stroke:${secondaryColor},stroke-width:1px\n`;
          diagram += `    ${stepId} -.-> ${confidenceId}\n`;
        }
        
        // Add evidence subnode if requested
        if (showEvidence && step.evidence) {
          const evidenceId = `${stepId}_evid`;
          diagram += `    ${evidenceId}("Evidence: ${this.escapeText(step.evidence.substring(0, 30))}")\n`;
          diagram += `    style ${evidenceId} fill:white,stroke:${secondaryColor},stroke-width:1px\n`;
          diagram += `    ${stepId} -.-> ${evidenceId}\n`;
        }
        
        // Add validation issues as subnodes if available and requested
        if (showValidation && 
            step.validation && 
            step.validation.is_validated && 
            step.validation.issues && 
            step.validation.issues.length > 0) {
          
          const issuesId = `${stepId}_issues`;
          diagram += `    ${issuesId}("${step.validation.issues.length} validation issues")\n`;
          diagram += `    style ${issuesId} fill:white,stroke:#e74c3c,stroke-width:1px,color:#e74c3c\n`;
          diagram += `    ${stepId} -.-> ${issuesId}\n`;
        }
        
        lastNodeId = stepId;
      });
    }
    
    // Add conclusion node for the last step
    if (chainData.steps && chainData.steps.length > 0 && !simplified) {
      const lastStep = chainData.steps[chainData.steps.length - 1];
      const conclusionId = 'conclusion';
      
      diagram += `    ${conclusionId}[("Conclusion")]\n`;
      diagram += `    style ${conclusionId} fill:${secondaryColor},color:white,stroke:${primaryColor},stroke-width:2px\n`;
      diagram += `    ${lastNodeId} --> ${conclusionId}\n`;
    }
    
    // Add metadata
    if (!simplified) {
      const metaId = 'meta';
      diagram += `    ${metaId}["${chainData.thinking_type.toUpperCase()} Thinking"]\n`;
      diagram += `    style ${metaId} fill:white,stroke:${secondaryColor},stroke-width:1px,stroke-dasharray: 5 5\n\n`;
      diagram += `    ${problemId} -.-> ${metaId}\n`;
    }
    
    return diagram;
  }
  
  /**
   * Generate a JSON visualization for a thinking chain
   * 
   * @param {Object} chainData - Thinking chain data
   * @param {Object} options - Additional options
   * @returns {string} JSON representation as a string
   */
  generateJsonVisualization(chainData, options = {}) {
    const { simplified = false } = options;
    
    // Create a simplified version of the chain for visualization
    const visualizationData = {
      id: chainData.id,
      problem: chainData.problem,
      thinking_type: chainData.thinking_type,
      steps: chainData.steps.map(step => ({
        id: step.id,
        description: step.description,
        confidence: step.confidence,
        validation: step.validation?.is_validated ? {
          score: step.validation.score,
          issues_count: step.validation.issues?.length || 0
        } : null
      }))
    };
    
    // Include additional data if not simplified
    if (!simplified) {
      visualizationData.context = chainData.context;
      visualizationData.created_at = chainData.created_at;
      visualizationData.updated_at = chainData.updated_at;
      visualizationData.structure = chainData.structure;
      
      // Include full step data
      visualizationData.steps = chainData.steps.map(step => ({
        id: step.id,
        description: step.description,
        reasoning: step.reasoning,
        evidence: step.evidence,
        confidence: step.confidence,
        validation: step.validation
      }));
    }
    
    return JSON.stringify(visualizationData, null, 2);
  }
  
  /**
   * Generate a text visualization for a thinking chain
   * 
   * @param {Object} chainData - Thinking chain data
   * @param {Object} options - Additional options
   * @returns {string} Text representation
   */
  generateTextVisualization(chainData, options = {}) {
    const { 
      showValidation = true,
      showConfidence = true,
      showEvidence = true,
      simplified = false
    } = options;
    
    let text = `# ${chainData.thinking_type.toUpperCase()} THINKING CHAIN\n\n`;
    
    // Add problem statement
    text += `## Problem\n${chainData.problem}\n\n`;
    
    // Add context if available and not simplified
    if (chainData.context && !simplified) {
      text += `## Context\n${chainData.context}\n\n`;
    }
    
    // Add steps
    text += `## Steps\n\n`;
    
    if (chainData.steps && chainData.steps.length > 0) {
      chainData.steps.forEach((step, index) => {
        text += `### Step ${index + 1}: ${step.description}\n\n`;
        
        // Add reasoning
        if (!simplified) {
          text += `${step.reasoning}\n\n`;
        }
        
        // Add evidence if available and requested
        if (showEvidence && step.evidence) {
          text += `Evidence: ${step.evidence}\n\n`;
        }
        
        // Add confidence if requested
        if (showConfidence && step.confidence !== undefined) {
          const confidencePercent = Math.round(step.confidence * 100);
          text += `Confidence: ${confidencePercent}%\n\n`;
        }
        
        // Add validation info if available and requested
        if (showValidation && step.validation && step.validation.is_validated) {
          const score = step.validation.score || 0;
          const scorePercent = Math.round(score * 100);
          
          text += `Validation: ${scorePercent}% valid\n`;
          
          if (step.validation.issues && step.validation.issues.length > 0) {
            text += `Issues:\n`;
            
            for (const issue of step.validation.issues) {
              text += `- ${issue}\n`;
            }
            
            text += '\n';
          }
        }
      });
    }
    
    // Add conclusion
    if (chainData.steps && chainData.steps.length > 0) {
      const lastStep = chainData.steps[chainData.steps.length - 1];
      
      text += `## Conclusion\n${lastStep.description}\n\n`;
      
      if (!simplified && lastStep.reasoning) {
        text += `${lastStep.reasoning}\n\n`;
      }
    }
    
    return text;
  }
  
  /**
   * Get colors for a thinking type
   * 
   * @param {string} thinkingType - Thinking type
   * @returns {Array<string>} Array of primary and secondary colors
   * @private
   */
  getColorsForThinkingType(thinkingType) {
    return this.colorMap[thinkingType] || this.defaultColor;
  }
  
  /**
   * Get color based on validation score
   * 
   * @param {number} score - Validation score (0-1)
   * @returns {string} Color code
   * @private
   */
  getValidationColor(score) {
    if (score >= 0.8) {
      return '#27ae60';  // Green
    } else if (score >= 0.6) {
      return '#2ecc71';  // Light green
    } else if (score >= 0.4) {
      return '#f39c12';  // Orange
    } else if (score >= 0.2) {
      return '#e67e22';  // Dark orange
    } else {
      return '#e74c3c';  // Red
    }
  }
  
  /**
   * Escape special characters for Mermaid diagrams
   * 
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   * @private
   */
  escapeText(text) {
    if (!text) return '';
    
    return text
      .replace(/"/g, '\\"')         // Escape double quotes
      .replace(/\n/g, '\\n')        // Escape newlines
      .replace(/[\(\)]/g, match => `\\${match}`)  // Escape parentheses
      .replace(/[[\]]/g, match => `\\${match}`);  // Escape square brackets
  }
}
