/**
 * CyberChef Utility
 * Generates deep links to CyberChef with pre-configured operations
 */

/**
 * CyberChef URL - Can be self-hosted or public
 */
const CYBERCHEF_URL = 'https://gchq.github.io/CyberChef';

/**
 * Generates a CyberChef deep link
 * @param input The data to analyze
 * @param operations Optional pre-configured operations (e.g., [{op: 'Magic', args: [3, false, false, '']}])
 */
export function getCyberChefUrl(input: string, operations: any[] = []): string {
  // CyberChef expects input in a specific format in the URL fragment
  // Format: #input=BASE64_DATA&recipe=JSON_RECIPE
  
  const base64Input = btoa(unescape(encodeURIComponent(input)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const recipe = operations.length > 0 
    ? encodeURIComponent(JSON.stringify(operations))
    : '';

  return `${CYBERCHEF_URL}/#input=${base64Input}${recipe ? `&recipe=${recipe}` : ''}`;
}

/**
 * Common CyberChef Recipes for SOC Analysts
 */
export const CyberChefRecipes = {
  /**
   * Use 'Magic' to automatically detect encoding/format
   */
  MAGIC: [{ op: 'Magic', args: [3, false, false, ''] }],
  
  /**
   * Format JSON for readability
   */
  FORMAT_JSON: [{ op: 'JSON Beautify', args: ['    ', false, true] }],
  
  /**
   * Decode Base64 and attempt to format as JSON
   */
  BASE64_JSON: [
    { op: 'From Base64', args: ['A-Za-z0-9+/=', true, false] },
    { op: 'JSON Beautify', args: ['    ', false, true] }
  ]
};
