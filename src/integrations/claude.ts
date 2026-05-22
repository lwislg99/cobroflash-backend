import Anthropic from '@anthropic-ai/sdk';
import { config } from '../core/config/env';

// Singleton del cliente Anthropic con prompt caching habilitado por defecto
export const anthropic = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
