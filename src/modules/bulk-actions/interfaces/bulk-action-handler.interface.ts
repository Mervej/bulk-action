export interface IBulkActionHandler {
  /**
   * Unique identifier for the action type
   */
  actionType: string;
  
  /**
   * Validates the action payload before processing
   */
  validatePayload(payload: any): Promise<boolean>;
  
  /**
   * Processes a single entity
   */
  processEntity(entity: any, actionConfig: any): Promise<any>;
  
  /**
   * Returns the schema for the action configuration
   */
  getConfigSchema(): any;
}
