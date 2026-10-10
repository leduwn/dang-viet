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
  type DesignProposal,
  type DesignProposalRequest,
  type ValidateProposalResponse,
  type SessionState,
  type AIImageGenerateRequest,
  type AIImageJob,
  type FaceReferenceItem,
  type ConversationalEditRequest,
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

/**
 * Universal fetch wrapper ensuring cookie credentials are sent and received
 */
async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const mergedInit: RequestInit = {
    ...init,
    credentials: 'include',
    headers: {
      ...init.headers,
    },
  };
  return fetch(input, mergedInit);
}

// 0. Session API
export async function fetchSession(): Promise<SessionState> {
  const res = await apiFetch(`${API_BASE}/session`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(data.error || 'Lỗi tải phiên làm việc', res.status, data.code);
  }
  return res.json();
}

export async function updateCurrentLook(lookId: string): Promise<SessionState> {
  const res = await apiFetch(`${API_BASE}/session/current`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lookId }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new ApiError(data.error || 'Lỗi cập nhật bản phối hiện tại', res.status, data.code);
  }
  return data;
}

export async function resetSessionLook(): Promise<SessionState> {
  const res = await apiFetch(`${API_BASE}/session/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new ApiError(data.error || 'Lỗi làm mới bản phối phiên', res.status, data.code);
  }
  return data;
}

export async function fetchMeta(): Promise<{
  events: any[];
  styles: any[];
  colors: any[];
  catalog: any;
  presets: any[];
}> {
  const res = await apiFetch(`${API_BASE}/meta`);
  if (!res.ok) throw new Error(`Lỗi tải dữ liệu mẫu: ${res.statusText}`);
  return res.json();
}

export async function fetchLook(id: string): Promise<Look> {
  const res = await apiFetch(`${API_BASE}/looks/${id}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(data.error || `Lỗi tải bộ phối: ${res.statusText}`, res.status, data.code);
  }
  return res.json();
}

export async function sendCommand(command: CommandPayload): Promise<CommandResult> {
  const res = await apiFetch(`${API_BASE}/looks/${command.lookId}/command`, {
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
  options: { expectedRevision: number; commandId: string }
): Promise<{ success: boolean; look: Look; message: string; remainingUndoSteps?: number }> {
  const res = await apiFetch(`${API_BASE}/looks/${lookId}/undo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new ApiError(data.error || 'Lỗi hoàn tác', res.status, data.code, data.currentRevision);
  }
  return data;
}

export async function fetchLookbook(): Promise<LookbookItem[]> {
  const res = await apiFetch(`${API_BASE}/lookbook`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(data.error || `Lỗi tải Lookbook: ${res.statusText}`, res.status, data.code);
  }
  return res.json();
}

export async function fetchLookbookItem(id: string): Promise<LookbookItem> {
  const res = await apiFetch(`${API_BASE}/lookbook/${id}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(data.error || `Lỗi tải mục Lookbook: ${res.statusText}`, res.status, data.code);
  }
  return res.json();
}

export async function saveToLookbook(item: LookbookItem): Promise<LookbookItem> {
  const res = await apiFetch(`${API_BASE}/lookbook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item),
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError(data.error || 'Lỗi lưu Lookbook', res.status, data.code);
  return data;
}

export async function deleteFromLookbook(id: string): Promise<void> {
  const res = await apiFetch(`${API_BASE}/lookbook/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(data.error || 'Lỗi xóa khỏi Lookbook', res.status);
  }
}

export async function fetchCultureCards(status: string = 'published'): Promise<CultureCard[]> {
  const res = await apiFetch(`${API_BASE}/culture?status=${status}`);
  if (!res.ok) throw new ApiError(`Lỗi tải thẻ văn hóa: ${res.statusText}`, res.status);
  return res.json();
}

export async function fetchAIStatus(): Promise<AIStatus> {
  const res = await apiFetch(`${API_BASE}/ai/status`);
  if (!res.ok) throw new ApiError(`Lỗi kiểm tra AI: ${res.statusText}`, res.status);
  return res.json();
}

export async function sendAIChat(
  lookId: string,
  message: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<AIChatResponse> {
  const res = await apiFetch(`${API_BASE}/ai/chat`, {
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
  const res = await apiFetch(`${API_BASE}/ai/design`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError(data.error || 'Lỗi sinh thiết kế', res.status, data.code);
  return data;
}

export async function requestDesignProposal(
  req: DesignProposalRequest
): Promise<DesignProposal> {
  const res = await apiFetch(`${API_BASE}/ai/proposal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError(data.error || 'Lỗi sinh đề xuất thiết kế', res.status, data.code);
  return data;
}

export async function validateDesignProposalApi(
  proposal: DesignProposal
): Promise<ValidateProposalResponse> {
  const res = await apiFetch(`${API_BASE}/ai/proposal/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(proposal),
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError(data.error || 'Lỗi xác thực đề xuất thiết kế', res.status, data.code);
  return data;
}

// 7. AI 2D Ao Dai Image Generation API
export async function requestAIImage(
  req: AIImageGenerateRequest
): Promise<{ success: boolean; job: AIImageJob; isExisting?: boolean }> {
  const res = await apiFetch(`${API_BASE}/ai/images/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new ApiError(data.error || 'Lỗi tạo ảnh minh họa Áo dài AI', res.status, data.code);
  }
  return data;
}

export async function fetchAIImageJobs(): Promise<{ jobs: AIImageJob[] }> {
  const res = await apiFetch(`${API_BASE}/ai/images`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(data.error || 'Lỗi tải danh sách ảnh AI', res.status, data.code);
  }
  return res.json();
}

export async function fetchAIImageJob(id: string): Promise<{ job: AIImageJob }> {
  const res = await apiFetch(`${API_BASE}/ai/images/jobs/${id}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(data.error || 'Lỗi tải trạng thái tạo ảnh', res.status, data.code);
  }
  return res.json();
}

export async function deleteAIImage(id: string): Promise<{ success: boolean; id: string }> {
  const res = await apiFetch(`${API_BASE}/ai/images/${id}`, {
    method: 'DELETE',
  });
  const data = await res.json();
  if (!res.ok) {
    throw new ApiError(data.error || 'Lỗi xóa ảnh AI', res.status);
  }
  return data;
}

export async function uploadFaceReference(
  data: string,
  filename?: string
): Promise<{ success: boolean; reference: FaceReferenceItem }> {
  const res = await apiFetch(`${API_BASE}/ai/images/upload-reference`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data, filename }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new ApiError(json.error || 'Lỗi tải ảnh chân dung tham chiếu', res.status);
  }
  return json;
}

export async function deleteFaceReference(id: string): Promise<{ success: boolean; id: string }> {
  const res = await apiFetch(`${API_BASE}/ai/images/references/${id}`, {
    method: 'DELETE',
  });
  const json = await res.json();
  if (!res.ok) {
    throw new ApiError(json.error || 'Lỗi xóa ảnh chân dung tham chiếu', res.status);
  }
  return json;
}

export async function editAIImage(
  req: ConversationalEditRequest
): Promise<{ success: boolean; job: AIImageJob }> {
  const res = await apiFetch(`${API_BASE}/ai/images/edit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new ApiError(json.error || 'Lỗi chỉnh sửa ảnh hội thoại', res.status);
  }
  return json;
}

export async function fetchAIImageLineage(
  id: string
): Promise<{ lineage: AIImageJob[] }> {
  const res = await apiFetch(`${API_BASE}/ai/images/${id}/lineage`);
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new ApiError(json.error || 'Lỗi tải lịch sử phiên bản ảnh', res.status);
  }
  return res.json();
}


