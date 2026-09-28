import {
  type Look,
  type CommandPayload,
  type CommandResult,
  type LookbookItem,
  type CultureCard,
  type AIStatus,
  type AIChatResponse,
  type StructuredDesignRequest,
  type GarmentConfig,
} from '@dangviet/contracts';

export class ApiError extends Error {
  status: number;
  code?: string;
  currentRevision?: number;

  constructor(message: string, status: number, code?: string, currentRevision?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.currentRevision = currentRevision;
  }
}

const API_BASE = '/api';

export async function fetchMeta(): Promise<{
  events: any[];
  styles: any[];
  colors: any[];
  catalog: any;
  presets: any[];
}> {
  const res = await fetch(`${API_BASE}/meta`);
  if (!res.ok) throw new Error(`Lỗi tải dữ liệu mẫu: ${res.statusText}`);
  return res.json();
}

export async function fetchLook(id: string): Promise<Look> {
  const res = await fetch(`${API_BASE}/looks/${id}`);
  if (!res.ok) throw new Error(`Lỗi tải bộ phối: ${res.statusText}`);
  return res.json();
}

export async function sendCommand(command: CommandPayload): Promise<CommandResult> {
  const res = await fetch(`${API_BASE}/looks/${command.lookId}/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new ApiError(data.error || 'Lỗi thực thi lệnh phối đồ', res.status, data.code, data.currentRevision);
  }
  return data;
}

export async function undoLook(
  lookId: string,
  options?: { expectedRevision?: number; commandId?: string }
): Promise<{ success: boolean; look: Look; message: string; remainingUndoSteps?: number }> {
  const res = await fetch(`${API_BASE}/looks/${lookId}/undo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options || {}),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new ApiError(data.error || 'Lỗi hoàn tác', res.status, data.code, data.currentRevision);
  }
  return data;
}

export async function fetchLookbook(): Promise<LookbookItem[]> {
  const res = await fetch(`${API_BASE}/lookbook`);
  if (!res.ok) throw new ApiError(`Lỗi tải Lookbook: ${res.statusText}`, res.status);
  return res.json();
}

export async function saveToLookbook(item: LookbookItem): Promise<LookbookItem> {
  const res = await fetch(`${API_BASE}/lookbook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item),
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError(data.error || 'Lỗi lưu Lookbook', res.status, data.code);
  return data;
}

export async function deleteFromLookbook(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/lookbook/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(data.error || 'Lỗi xóa khỏi Lookbook', res.status);
  }
}

export async function fetchCultureCards(status: string = 'published'): Promise<CultureCard[]> {
  const res = await fetch(`${API_BASE}/culture?status=${status}`);
  if (!res.ok) throw new ApiError(`Lỗi tải thẻ văn hóa: ${res.statusText}`, res.status);
  return res.json();
}

export async function fetchAIStatus(): Promise<AIStatus> {
  const res = await fetch(`${API_BASE}/ai/status`);
  if (!res.ok) throw new ApiError(`Lỗi kiểm tra AI: ${res.statusText}`, res.status);
  return res.json();
}

export async function sendAIChat(
  lookId: string,
  message: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<AIChatResponse> {
  const res = await fetch(`${API_BASE}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lookId, message, history }),
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError(data.error || 'Lỗi gửi tin nhắn tới AI', res.status, data.code);
  return data;
}

export async function requestAIDesign(
  req: StructuredDesignRequest
): Promise<{ config: GarmentConfig; title: string; explanation: string; mode?: 'mock' | 'live'; model?: string }> {
  const res = await fetch(`${API_BASE}/ai/design`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError(data.error || 'Lỗi sinh thiết kế', res.status, data.code);
  return data;
}
