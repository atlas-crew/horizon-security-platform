import { Request, Response } from 'express';
import { SensorConfigService } from '../services/sensorConfigService.js';
import { SensorConfigSchema } from '../schemas/sensorConfig.js';

export class SensorConfigController {
  constructor(private service: SensorConfigService) {}

  async getConfig(req: Request, res: Response) {
    const { sensorId } = req.params;
    const config = await this.service.getConfig(sensorId);

    if (!config) {
      return res.status(404).json({ error: 'Configuration not found' });
    }

    return res.json(config);
  }

  async updateConfig(req: Request, res: Response) {
    const { sensorId } = req.params;
    
    // Check authentication
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Validate request body
    const result = SensorConfigSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ 
        error: 'Invalid configuration', 
        details: result.error.format() 
      });
    }

    try {
      const { version, commandId } = await this.service.updateConfig(sensorId, result.data, tenantId);
      return res.json({ 
        success: true, 
        version,
        commandId,
        message: commandId ? 'Configuration pushed to sensor' : 'Configuration saved (sensor offline)'
      });
    } catch (error: any) {
      (req as any).log?.error({ error, sensorId }, 'Failed to update sensor config');
      if (error.message.includes('does not belong to tenant')) {
        return res.status(403).json({ error: 'Access denied' });
      }
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}
