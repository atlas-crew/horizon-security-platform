/**
 * API Versioning Middleware (labs-2j5u.17)
 * 
 * Enforces API versioning using the Accept header.
 * Supported format: application/vnd.atlascrew.v{version}+json
 */

import type { Request, Response, NextFunction } from 'express';
import { sendProblem } from '../lib/problem-details.js';

export interface VersioningOptions {
  defaultVersion: number;
  supportedVersions: number[];
}

/**
 * Middleware to validate and extract API version from Accept header
 */
export function apiVersioning(options: VersioningOptions) {
  const { defaultVersion, supportedVersions } = options;

  return function versionMiddleware(req: Request, res: Response, next: NextFunction): void {
    const acceptHeader = req.headers.accept;
    let version = defaultVersion;

    if (acceptHeader && acceptHeader !== '*/*') {
      // Look for vendor-specific media type: application/vnd.atlascrew.v1+json
      const match = acceptHeader.match(/application\/vnd\.atlascrew\.v(\d+)\+json/);
      
      if (match) {
        version = parseInt(match[1], 10);
      } else if (acceptHeader.includes('application/json')) {
        // Default to latest version if generic JSON requested
        version = defaultVersion;
      } else {
        // If it's some other non-generic Accept header, we might want to ignore or reject
        // For now, we'll allow it to default to v1 for compatibility with browser defaults
        version = defaultVersion;
      }
    }

    if (!supportedVersions.includes(version)) {
      sendProblem(res, 406, 'Unsupported API version', {
        code: 'UNSUPPORTED_VERSION',
        instance: req.originalUrl,
        details: {
          requestedVersion: version,
          supportedVersions,
        },
      });
      return;
    }

    // Attach version to request for downstream use if needed
    (req as any).apiVersion = version;
    
    // Set response header to indicate which version was used
    res.setHeader('X-API-Version', version.toString());
    res.setHeader('Content-Type', `application/vnd.atlascrew.v${version}+json`);

    next();
  };
}
