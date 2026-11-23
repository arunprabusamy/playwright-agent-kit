import path from "path";

/**                                                         
     * Directory where Playwright session and API auth state    
     files are stored.                                          
     * Anchored to project root so folder nesting depth never   
     breaks the resolution.                                     
     */
export const AUTH_DIR = path.resolve(__dirname, "../playwright/.auth");

/**                                                         
     * File path for browser UI storage state (cookies,         
     localStorage).                                             
     */
export const UI_AUTH_FILE = path.join(AUTH_DIR, "user.json");

/**
 * File path for API authentication token storage state.  
 */
export const API_AUTH_FILE = path.join(AUTH_DIR, "api-user.json");
