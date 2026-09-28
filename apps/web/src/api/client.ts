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
    throw new Error(data.error || 'Lỗi thực thi lệnh phối đồ');
  }
  return data;
}

export async function undoLook(lookId: string): Promise<{ success: boolean; look: Look; message: string }> {
  const res = await fetch(`${API_BASE}/looks/${lookId}/undo`, {
    method: 'POST',
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Lỗi hoàn tác');
  }
  return data;
}

export async function fetchLookbook(): Promise<LookbookItem[]> {
  const res = await fetch(`${API_BASE}/lookbook`);
  if (!res.ok) throw new Error(`Lỗi tải Lookbook: ${res.statusText}`);
  return res.json();
}

export async function saveToLookbook(item: LookbookItem): Promise<LookbookItem> {
  const res = await fetch(`${API_BASE}/lookbook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Lỗi lưu Lookbook');
  return data;
}

export async function deleteFromLookbook(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/lookbook/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Lỗi xóa khỏi Lookbook');
}

export async function fetchCultureCards(status: string = 'published'): Promise<CultureCard[]> {
  const res = await fetch(`${API_BASE}/culture?status=${status}`);
  if (!res.ok) throw new Error(`Lỗi tải thẻ văn hóa: ${res.statusText}`);
  return res.json();
}

export async function fetchAIStatus(): Promise<AIStatus> {
  const res = await fetch(`${API_BASE}/ai/status`);
  if (!res.ok) throw new Error(`Lỗi kiểm tra AI: ${res.statusText}`);
  return res.json();
}

export async function sendAIChat(
  lookId: string,
  message: string,
  history: Array<{ role: string; content: string }>
): Promise<AIChatResponse> {
  const res = await fetch(`${API_BASE}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lookId, message, history }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Lỗi gửi tin nhắn tới AI');
  return data;
}

export async function requestAIDesign(
  req: StructuredDesignRequest
): Promise<{ config: GarmentConfig; title: string; explanation: string }> {
  const res = await fetch(`${API_BASE}/ai/design`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Lỗi sinh thiết kế');
  return data;
}
