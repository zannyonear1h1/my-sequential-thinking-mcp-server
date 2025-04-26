/**
 * Tag Manager
 * 
 * Provides functionality for managing and organizing tags for thinking chains.
 * Implements a comprehensive tagging system for:
 * - Categorizing thinking chains
 * - Creating tag relationships and hierarchies
 * - Supporting tag-based search and retrieval
 * - Managing tag evolution and lifecycle
 */

import fs from 'fs/promises';
import path from 'path';
import { FileStorage } from './utils/file-storage.js';

export class TagManager {
  constructor() {
    this.tags = new Map();
    this.tagRelationships = new Map();
    this.entityTags = new Map();
    this.storage = new FileStorage('tags');
    
    // Tag taxonomy categories
    this.taxonomyCategories = [
      'thinking_type',    // analytical, creative, critical, systems, etc.
      'domain',           // business, science, technology, art, etc.
      'complexity',       // simple, moderate, complex
      'status',           // draft, validated, complete
      'confidence',       // low, medium, high
      'source',           // user, template, imported
      'usage',            // frequent, rare, favorite
      'visibility',       // public, private, shared
      'custom'            // user-defined categories
    ];
    
    // Initialize
    this.initialize();
  }
  
  async initialize() {
    try {
      await this.storage.ensureStorageExists();
      await this.loadPersistedTags();
    } catch (error) {
      console.error('Failed to initialize tag manager:', error);
    }
  }
  
  async loadPersistedTags() {
    try {
      // Load tags
      const tagsData = await this.storage.readEntity('tags');
      
      if (tagsData) {
        for (const [tagId, tagData] of Object.entries(tagsData)) {
          this.tags.set(tagId, tagData);
        }
      }
      
      // Load tag relationships
      const relationshipsData = await this.storage.readEntity('relationships');
      
      if (relationshipsData) {
        for (const [tagId, relatedTags] of Object.entries(relationshipsData)) {
          this.tagRelationships.set(tagId, relatedTags);
        }
      }
      
      // Load entity tags mappings
      const entityTagsData = await this.storage.readEntity('entity_tags');
      
      if (entityTagsData) {
        for (const [entityId, tags] of Object.entries(entityTagsData)) {
          this.entityTags.set(entityId, tags);
        }
      }
      
      console.log(`Loaded ${this.tags.size} tags, ${this.tagRelationships.size} relationships, and ${this.entityTags.size} entity-tag mappings`);
    } catch (error) {
      // If this is the first run, files might not exist yet
      if (!error.message.includes('ENOENT')) {
        console.error('Failed to load persisted tags:', error);
      }
      
      // Initialize with default tags
      await this.initializeDefaultTags();
    }
  }
  
  /**
   * Initialize default tags for thinking types
   * 
   * @private
   */
  async initializeDefaultTags() {
    // Create default thinking type tags
    const thinkingTypes = [
      'analytical',
      'creative',
      'critical',
      'systems',
      'first-principles',
      'divergent',
      'convergent',
      'inductive',
      'deductive'
    ];
    
    for (const type of thinkingTypes) {
      await this.createTag(type, 'thinking_type', `${type} thinking pattern`);
    }
    
    // Create default domain tags
    const domains = [
      'business',
      'science',
      'technology',
      'art',
      'ethics',
      'philosophy',
      'design',
      'problem-solving',
      'decision-making'
    ];
    
    for (const domain of domains) {
      await this.createTag(domain, 'domain', `${domain} domain`);
    }
    
    // Create default complexity tags
    const complexities = ['simple', 'moderate', 'complex'];
    
    for (const complexity of complexities) {
      await this.createTag(complexity, 'complexity', `${complexity} complexity level`);
    }
    
    // Create default status tags
    const statuses = ['draft', 'in_progress', 'validated', 'complete'];
    
    for (const status of statuses) {
      await this.createTag(status, 'status', `${status} status`);
    }
    
    // Persist the initial tags
    await this.persistTags();
    
    console.log('Initialized default tags');
  }
  
  /**
   * Create a new tag
   * 
   * @param {string} name - Tag name
   * @param {string} category - Tag category
   * @param {string} description - Tag description
   * @returns {string} Tag ID
   */
  async createTag(name, category = 'custom', description = '') {
    // Normalize the tag name and generate ID
    const normalizedName = this.normalizeTagName(name);
    const tagId = `${category}:${normalizedName}`;
    
    // Check if tag already exists
    if (this.tags.has(tagId)) {
      return tagId;
    }
    
    // Create the tag
    const tagData = {
      id: tagId,
      name: normalizedName,
      display_name: name,
      category,
      description: description || `${name} tag`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      usage_count: 0
    };
    
    // Store the tag
    this.tags.set(tagId, tagData);
    
    // Persist tags
    await this.persistTags();
    
    return tagId;
  }
  
  /**
   * Get a tag by ID
   * 
   * @param {string} tagId - Tag ID
   * @returns {Object|null} Tag data or null if not found
   */
  getTag(tagId) {
    return this.tags.get(tagId) || null;
  }
  
  /**
   * Get tags by category
   * 
   * @param {string} category - Tag category
   * @returns {Array<Object>} Array of tag data
   */
  getTagsByCategory(category) {
    const result = [];
    
    for (const [tagId, tagData] of this.tags.entries()) {
      if (tagData.category === category) {
        result.push(tagData);
      }
    }
    
    return result;
  }
  
  /**
   * Find a tag by name (exact or closest match)
   * 
   * @param {string} name - Tag name to find
   * @param {string} category - Optional category to restrict search
   * @returns {Object|null} Tag data or null if not found
   */
  findTagByName(name, category = null) {
    const normalizedName = this.normalizeTagName(name);
    
    // First try exact match
    for (const [tagId, tagData] of this.tags.entries()) {
      if (tagData.name === normalizedName) {
        if (!category || tagData.category === category) {
          return tagData;
        }
      }
    }
    
    // If no exact match, try to find closest match
    let bestMatchScore = 0;
    let bestMatch = null;
    
    for (const [tagId, tagData] of this.tags.entries()) {
      if (category && tagData.category !== category) {
        continue;
      }
      
      const score = this.calculateSimilarity(normalizedName, tagData.name);
      
      if (score > bestMatchScore && score > 0.7) { // 0.7 is similarity threshold
        bestMatchScore = score;
        bestMatch = tagData;
      }
    }
    
    return bestMatch;
  }
  
  /**
   * Set a relationship between tags
   * 
   * @param {string} tagId - Source tag ID
   * @param {string} relatedTagId - Related tag ID
   * @param {string} relationship - Type of relationship
   * @returns {boolean} Success status
   */
  async setTagRelationship(tagId, relatedTagId, relationship = 'related') {
    // Ensure both tags exist
    if (!this.tags.has(tagId) || !this.tags.has(relatedTagId)) {
      return false;
    }
    
    // Get existing relationships
    let relationships = this.tagRelationships.get(tagId) || {};
    
    // Update or create the relationship
    relationships[relatedTagId] = relationship;
    
    // Store the relationships
    this.tagRelationships.set(tagId, relationships);
    
    // Persist the relationships
    await this.persistTagRelationships();
    
    return true;
  }
  
  /**
   * Get related tags for a tag
   * 
   * @param {string} tagId - Tag ID
   * @param {string} relationship - Optional relationship type filter
   * @returns {Array<Object>} Array of related tag data with relationship type
   */
  getRelatedTags(tagId, relationship = null) {
    const results = [];
    const relationships = this.tagRelationships.get(tagId) || {};
    
    for (const [relatedTagId, relType] of Object.entries(relationships)) {
      if (!relationship || relType === relationship) {
        const tagData = this.getTag(relatedTagId);
        
        if (tagData) {
          results.push({
            ...tagData,
            relationship: relType
          });
        }
      }
    }
    
    return results;
  }
  
  /**
   * Apply tags to an entity
   * 
   * @param {string} entityId - Entity ID
   * @param {Array<string>} tags - Array of tag names or IDs
   * @returns {Array<string>} Array of applied tag IDs
   */
  async applyTags(entityId, tags) {
    const appliedTags = [];
    const existingTags = this.entityTags.get(entityId) || [];
    
    for (const tag of tags) {
      let tagId;
      
      // Check if the tag is already an ID
      if (tag.includes(':') && this.tags.has(tag)) {
        tagId = tag;
      } else {
        // Try to find the tag by name
        const tagData = this.findTagByName(tag);
        
        if (tagData) {
          tagId = tagData.id;
        } else {
          // Create a new tag if not found
          tagId = await this.createTag(tag);
        }
      }
      
      if (tagId && !existingTags.includes(tagId)) {
        existingTags.push(tagId);
        
        // Increment usage count
        const tagData = this.tags.get(tagId);
        if (tagData) {
          tagData.usage_count += 1;
          tagData.updated_at = new Date().toISOString();
          this.tags.set(tagId, tagData);
        }
      }
      
      appliedTags.push(tagId);
    }
    
    // Store the updated entity tags
    this.entityTags.set(entityId, existingTags);
    
    // Persist entity tags
    await this.persistEntityTags();
    
    // Persist updated tag data
    await this.persistTags();
    
    return appliedTags;
  }
  
  /**
   * Remove tags from an entity
   * 
   * @param {string} entityId - Entity ID
   * @param {Array<string>} tags - Array of tag names or IDs to remove
   * @returns {Array<string>} Array of remaining tag IDs
   */
  async removeTags(entityId, tags) {
    const existingTags = this.entityTags.get(entityId) || [];
    const tagsToRemove = [];
    
    for (const tag of tags) {
      let tagId;
      
      // Check if the tag is already an ID
      if (tag.includes(':') && this.tags.has(tag)) {
        tagId = tag;
      } else {
        // Try to find the tag by name
        const tagData = this.findTagByName(tag);
        
        if (tagData) {
          tagId = tagData.id;
        }
      }
      
      if (tagId) {
        tagsToRemove.push(tagId);
      }
    }
    
    // Filter out the tags to remove
    const updatedTags = existingTags.filter(tagId => !tagsToRemove.includes(tagId));
    
    // Store the updated entity tags
    this.entityTags.set(entityId, updatedTags);
    
    // Persist entity tags
    await this.persistEntityTags();
    
    return updatedTags;
  }
  
  /**
   * Get all tags for an entity
   * 
   * @param {string} entityId - Entity ID
   * @returns {Array<Object>} Array of tag data
   */
  getEntityTags(entityId) {
    const tagIds = this.entityTags.get(entityId) || [];
    const tagData = [];
    
    for (const tagId of tagIds) {
      const tag = this.getTag(tagId);
      
      if (tag) {
        tagData.push(tag);
      }
    }
    
    return tagData;
  }
  
  /**
   * Get all entities with specific tags
   * 
   * @param {Array<string>} tags - Array of tag names or IDs
   * @param {boolean} matchAll - Whether all tags must match (AND) or any tag (OR)
   * @returns {Array<string>} Array of entity IDs
   */
  findEntitiesByTags(tags, matchAll = true) {
    const tagIds = [];
    
    // Convert tag names to IDs
    for (const tag of tags) {
      let tagId;
      
      if (tag.includes(':') && this.tags.has(tag)) {
        tagId = tag;
      } else {
        const tagData = this.findTagByName(tag);
        
        if (tagData) {
          tagId = tagData.id;
        }
      }
      
      if (tagId) {
        tagIds.push(tagId);
      }
    }
    
    const results = [];
    
    // Search entities
    for (const [entityId, entityTags] of this.entityTags.entries()) {
      if (matchAll) {
        // All specified tags must be present
        const allTagsPresent = tagIds.every(tagId => entityTags.includes(tagId));
        
        if (allTagsPresent) {
          results.push(entityId);
        }
      } else {
        // Any specified tag must be present
        const anyTagPresent = tagIds.some(tagId => entityTags.includes(tagId));
        
        if (anyTagPresent) {
          results.push(entityId);
        }
      }
    }
    
    return results;
  }
  
  /**
   * Get all available tags
   * 
   * @param {string} category - Optional category filter
   * @returns {Array<Object>} Array of tag data
   */
  getAllTags(category = null) {
    if (category) {
      return this.getTagsByCategory(category);
    }
    
    return Array.from(this.tags.values());
  }
  
  /**
   * Suggest related tags based on existing tags
   * 
   * @param {Array<string>} existingTags - Array of existing tag IDs
   * @param {number} limit - Maximum number of suggestions
   * @returns {Array<Object>} Array of suggested tag data
   */
  suggestRelatedTags(existingTags, limit = 5) {
    const suggestions = new Map();
    
    // For each existing tag, find related tags
    for (const tagId of existingTags) {
      const relatedTags = this.getRelatedTags(tagId);
      
      for (const relatedTag of relatedTags) {
        if (!existingTags.includes(relatedTag.id)) {
          // Track suggestion count
          const count = suggestions.get(relatedTag.id) || 0;
          suggestions.set(relatedTag.id, count + 1);
        }
      }
    }
    
    // Sort by number of relations
    const sortedSuggestions = Array.from(suggestions.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);
    
    // Convert to tag data
    return sortedSuggestions.map(([tagId, count]) => {
      const tagData = this.getTag(tagId);
      return { ...tagData, suggestion_strength: count };
    });
  }
  
  /**
   * Normalize a tag name for storage and comparison
   * 
   * @param {string} name - Tag name
   * @returns {string} Normalized tag name
   * @private
   */
  normalizeTagName(name) {
    return name.toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-_]/g, '');
  }
  
  /**
   * Calculate similarity between two strings
   * 
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Similarity score (0-1)
   * @private
   */
  calculateSimilarity(str1, str2) {
    if (str1 === str2) return 1.0;
    if (str1.length === 0 || str2.length === 0) return 0.0;
    
    // Simple Levenshtein distance implementation
    const len1 = str1.length;
    const len2 = str2.length;
    const maxDist = Math.max(len1, len2);
    
    // Initialize matrix
    let matrix = Array(len1 + 1).fill().map(() => Array(len2 + 1).fill(0));
    
    // Initialize first row and column
    for (let i = 0; i <= len1; i++) matrix[i][0] = i;
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;
    
    // Fill matrix
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,     // deletion
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j - 1] + cost  // substitution
        );
      }
    }
    
    // Calculate similarity as inverse of normalized distance
    const distance = matrix[len1][len2];
    return 1 - (distance / maxDist);
  }
  
  /**
   * Persist tags to storage
   * 
   * @private
   */
  async persistTags() {
    const tagsData = {};
    
    for (const [tagId, tagData] of this.tags.entries()) {
      tagsData[tagId] = tagData;
    }
    
    await this.storage.writeEntity('tags', tagsData);
  }
  
  /**
   * Persist tag relationships to storage
   * 
   * @private
   */
  async persistTagRelationships() {
    const relationshipsData = {};
    
    for (const [tagId, relationships] of this.tagRelationships.entries()) {
      relationshipsData[tagId] = relationships;
    }
    
    await this.storage.writeEntity('relationships', relationshipsData);
  }
  
  /**
   * Persist entity tags to storage
   * 
   * @private
   */
  async persistEntityTags() {
    const entityTagsData = {};
    
    for (const [entityId, tags] of this.entityTags.entries()) {
      entityTagsData[entityId] = tags;
    }
    
    await this.storage.writeEntity('entity_tags', entityTagsData);
  }
}
