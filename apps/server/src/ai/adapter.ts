import {
  type AIStatus,
  type Look,
  type AIChatResponse,
  type StructuredDesignRequest,
  type GarmentConfig,
  type DesignProposal,
  type DesignProposalRequest,
} from '@dangviet/contracts';

export interface AIAdapter {
  getStatus(): Promise<AIStatus>;
  chat(look: Look, message: string, history: Array<{ role: string; content: string }>): Promise<AIChatResponse>;
  generateStructuredDesign(
    req: StructuredDesignRequest,
    baseLook?: Look
  ): Promise<{ config: GarmentConfig; title: string; explanation: string; mode?: 'mock' | 'live'; model?: string }>;
  generateProposal(
    req: DesignProposalRequest,
    baseLook: Look
  ): Promise<DesignProposal>;
  generateConceptImage(prompt: string): Promise<{ success: boolean; imageUrl?: string; message?: string }>;
}
