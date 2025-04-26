/**
 * File Storage Utility
 * 
 * Provides file system-based storage for persistent data.
 * This utility handles:
 * - Storing entities in JSON files
 * - Reading entities from JSON files
 * - Listing available entities
 * - Ensuring storage directories exist
 */

import fs from 'fs/promises';
import path from 'path';

export class FileStorage {
  /**
   * Create a new file storage instance
   * 
   * @param {string} entityType - Type of entity to store (used for directory naming)
   */
  constructor(entityType) {
    this.entityType = entityType;
    // Use a directory within the MCP server directory instead of process.cwd()
    this.storageDir = path.join(path.resolve(path.dirname(process.argv[1])), 'data', entityType);
  }
  
  /**
   * Ensure storage directory exists
   * 
   * @returns {Promise<boolean>} Success status
   */
  async ensureStorageExists() {
    try {
      // Check if the directory exists
      try {
        await fs.access(this.storageDir);
      } catch (error) {
        // Create the directory structure if it doesn't exist
        await fs.mkdir(this.storageDir, { recursive: true });
      }
      
      return true;
    } catch (error) {
      console.error(`Failed to ensure storage directory exists: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Write an entity to storage
   * 
   * @param {string} entityId - Entity ID
   * @param {Object} entityData - Entity data to store
   * @returns {Promise<boolean>} Success status
   */
  async writeEntity(entityId, entityData) {
    try {
      // Ensure storage exists
      await this.ensureStorageExists();
      
      // Sanitize entity ID for file name
      const safeEntityId = this.sanitizeFileName(entityId);
      const filePath = path.join(this.storageDir, `${safeEntityId}.json`);
      
      // Write the data
      await fs.writeFile(filePath, JSON.stringify(entityData, null, 2), 'utf8');
      
      return true;
    } catch (error) {
      console.error(`Failed to write entity ${entityId}: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Read an entity from storage
   * 
   * @param {string} entityId - Entity ID
   * @returns {Promise<Object|null>} Entity data or null if not found
   */
  async readEntity(entityId) {
    try {
      // Sanitize entity ID for file name
      const safeEntityId = this.sanitizeFileName(entityId);
      const filePath = path.join(this.storageDir, `${safeEntityId}.json`);
      
      // Check if the file exists
      try {
        await fs.access(filePath);
      } catch (error) {
        return null;
      }
      
      // Read and parse the data
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error(`Failed to read entity ${entityId}: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Delete an entity from storage
   * 
   * @param {string} entityId - Entity ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteEntity(entityId) {
    try {
      // Sanitize entity ID for file name
      const safeEntityId = this.sanitizeFileName(entityId);
      const filePath = path.join(this.storageDir, `${safeEntityId}.json`);
      
      // Check if the file exists
      try {
        await fs.access(filePath);
      } catch (error) {
        return false;
      }
      
      // Delete the file
      await fs.unlink(filePath);
      
      return true;
    } catch (error) {
      console.error(`Failed to delete entity ${entityId}: ${error.message}`);
      return false;
    }
  }
  
  /**
   * List all entities in storage
   * 
   * @returns {Promise<Array<string>>} Array of entity IDs
   */
  async listEntities() {
    try {
      // Ensure storage exists
      await this.ensureStorageExists();
      
      // List files in the directory
      const files = await fs.readdir(this.storageDir);
      
      // Extract entity IDs from file names
      return files
        .filter(file => file.endsWith('.json'))
        .map(file => file.replace(/\.json$/, ''));
    } catch (error) {
      console.error(`Failed to list entities: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Sanitize a string for use as a file name
   * 
   * @param {string} fileName - File name to sanitize
   * @returns {string} Sanitized file name
   * @private
   */
  sanitizeFileName(fileName) {
    return fileName
      .replace(/[\/\\:*?"<>|]/g, '_') // Replace invalid file name characters
      .replace(/\s+/g, '_');          // Replace spaces with underscores
  }
}
