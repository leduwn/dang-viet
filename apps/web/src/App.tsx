import React, { useEffect, useState, useRef } from 'react';
import {
  type Look,
  type LookbookItem,
  type CultureCard,
  type AIStatus,
  type CommandAction,
  type CommandPayload,
  type MutationResult,
  type SaveLookbookResult,
} from '@dangviet/contracts';
import {
  fetchMeta,
  fetchLook,
  sendCommand,
  undoLook,
  fetchLookbook,
  saveToLookbook,
  deleteFromLookbook,
  fetchCultureCards,
  fetchAIStatus,
  sendAIChat,
  requestDesignProposal,
  validateDesignProposalApi,
} from './api/client.ts';
import { Navbar } from './components/Navbar.tsx';
import { ExploreSection } from './components/ExploreSection.tsx';
import { OutfitRoom } from './components/OutfitRoom.tsx';
import { DesignStudio } from './components/DesignStudio.tsx';
import { LookbookSection } from './components/LookbookSection.tsx';
import { CompareModal } from './components/CompareModal.tsx';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<'explore' | 'studio' | 'design' | 'lookbook'>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab === 'studio' || tab === 'design' || tab === 'lookbook') return tab;
    } catch {}
    return 'explore';
  });
  const [meta, setMeta] = useState<any | null>(null);
  const [look, setLook] = useState<Look | null>(null);
  const [cultureCards, setCultureCards] = useState<CultureCard[]>([]);
  const [lookbookItems, setLookbookItems] = useState<LookbookItem[]>([]);
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);
  const [compareData, setCompareData] = useState<{ lookA: any; lookB: any } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [viewingDesignTitle, setViewingDesignTitle] = useState<string | null>(null);
  const [bannerMessage, setBannerMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    if (bannerMessage) {
      const timer = setTimeout(() => setBannerMessage(null), 4500);
      return () => clearTimeout(timer);
    }
  }, [bannerMessage]);

  // Synchronous in-flight mutation guard preventing rapid double clicks
  const isMutatingRef = useRef(false);
  const [isBusy, setIsBusy] = useState(false);

  // Helper: Guard against stale responses overwriting newer displayed revision (scoped to same lookId)
  const updateLookSafe = (newLook: Look) => {
    setLook((prev) => {
      if (!prev) return newLook;
      if (newLook.id === prev.id && newLook.revision < prev.revision) {
        console.warn(`Bỏ qua phản hồi cũ: revision ${newLook.revision} < đang hiển thị ${prev.revision} (lookId: ${newLook.id})`);
        return prev;
      }
      return newLook;
    });
  };

  // Initialize data on mount: Core data first, AI status decoupled
  useEffect(() => {
    async function init() {
      try {
        setIsLoading(true);
        const [metaData, initialLook, cultureData, lookbookData] = await Promise.all([
          fetchMeta(),
          fetchLook('look_default_01'),
          fetchCultureCards('all'),
          fetchLookbook(),
        ]);

        setMeta(metaData);
        setLook(initialLook);
        setCultureCards(cultureData);
        setLookbookItems(lookbookData);
        setIsLoading(false);

        // Fetch AI status independently so AI slowness/offline never blocks the UI
        fetchAIStatus()
          .then((stat) => setAiStatus(stat))
          .catch((aiErr) => {
            console.warn('AI status fetch warning:', aiErr);
            setAiStatus({
              configured: false,
              endpointConnected: false,
              modelVerified: false,
              mode: 'mock',
              provider: 'Offline / Không kết nối',
              model: 'dangviet-rules-v1',
              capabilities: { textChat: true, structuredCommands: true, imageGen: false },
              message: 'Không thể kết nối dịch vụ AI. Đang chạy Chế độ mô phỏng an toàn.',
            });
          });
      } catch (err: any) {
        console.error('Initialization error:', err);
        setLoadError(err.message || 'Không thể kết nối đến máy chủ API Dáng Việt');
        setIsLoading(false);
      }
    }
    init();
  }, []);

  // 1. Dispatch Command with revision verification & conflict recovery
  const handleDispatchCommand = async (action: CommandAction, payload: any): Promise<MutationResult> => {
    if (!look) return { success: false, error: 'Chưa tải bộ phối' };
    if (isMutatingRef.current) {
      console.warn('Đang có thao tác đang xử lý, bỏ qua yêu cầu trùng.');
      return { success: false, busy: true, error: 'Hệ thống đang xử lý thao tác khác, vui lòng thử lại sau.' };
    }
    isMutatingRef.current = true;
    setIsBusy(true);
    const commandId = crypto.randomUUID();
    const command: CommandPayload = {
      commandId,
      lookId: look.id,
      expectedRevision: look.revision,
      action,
      payload,
      timestamp: new Date().toISOString(),
    };

    try {
      const result = await sendCommand(command);
      updateLookSafe(result.look);

      // Manage viewing design title state
      if (action === 'APPLY_DESIGN') {
        setViewingDesignTitle(payload.title || 'Thiết kế');
      } else if (action === 'RESET_OUTFIT') {
        setViewingDesignTitle(null);
      } else {
        setViewingDesignTitle((prev) => {
          if (!prev) return null;
          if (!prev.includes('(đã chỉnh sửa)')) return `${prev} (đã chỉnh sửa)`;
          return prev;
        });
      }
      return { success: true, look: result.look };
    } catch (err: any) {
      console.error('Command error:', err);
      let errorMsg = err.message || 'Lỗi thực hiện lệnh';
      let freshLook: Look | undefined;
      if (err.status === 409) {
        freshLook = await fetchLook(look.id);
        updateLookSafe(freshLook);
        if (err.code === 'DUPLICATE_COMMAND_ID') {
          errorMsg = 'Lệnh đã được ghi nhận trước đó (DUPLICATE_COMMAND_ID). Đã đồng bộ lại trạng thái mới nhất.';
        } else {
          errorMsg = `Xung đột phiên bản (REVISION_CONFLICT): Trạng thái trên giao diện không khớp với máy chủ. Đã tự động tải lại phiên bản v${freshLook.revision}.`;
        }
      }
      return {
        success: false,
        busy: false,
        error: errorMsg,
        code: err.code,
        look: freshLook,
      };
    } finally {
      isMutatingRef.current = false;
      setIsBusy(false);
    }
  };

  // 2. Undo with expectedRevision and commandId guard
  const handleUndo = async (): Promise<MutationResult> => {
    if (!look) return { success: false, error: 'Chưa tải bộ phối' };
    if (isMutatingRef.current) {
      console.warn('Đang có thao tác đang xử lý, bỏ qua hoàn tác trùng.');
      return { success: false, busy: true, error: 'Hệ thống đang xử lý thao tác khác, vui lòng thử lại sau.' };
    }
    isMutatingRef.current = true;
    setIsBusy(true);
    try {
      const res = await undoLook(look.id, {
        expectedRevision: look.revision,
        commandId: crypto.randomUUID(),
      });
      updateLookSafe(res.look);
      setViewingDesignTitle((prev) => (prev ? `${prev} (đã hoàn tác)` : null));
      return { success: true, look: res.look };
    } catch (err: any) {
      console.error('Undo error:', err);
      let errorMsg = err.message || 'Lỗi hoàn tác';
      let freshLook: Look | undefined;
      if (err.status === 409) {
        freshLook = await fetchLook(look.id);
        updateLookSafe(freshLook);
        if (err.code === 'DUPLICATE_COMMAND_ID') {
          errorMsg = 'Lệnh hoàn tác đã được thực thi trước đó (DUPLICATE_COMMAND_ID). Đã đồng bộ phiên bản mới nhất.';
        } else {
          errorMsg = `Xung đột phiên bản khi hoàn tác (REVISION_CONFLICT): Phiên bản v${look.revision} không khớp máy chủ v${err.currentRevision || freshLook.revision}. Đã tự động tải lại.`;
        }
      } else {
        try {
          freshLook = await fetchLook(look.id);
          updateLookSafe(freshLook);
        } catch {}
      }
      return {
        success: false,
        busy: false,
        error: errorMsg,
        code: err.code,
        look: freshLook,
      };
    } finally {
      isMutatingRef.current = false;
      setIsBusy(false);
    }
  };

  // 3. Reset Outfit
  const handleReset = async (): Promise<MutationResult> => {
    return handleDispatchCommand('RESET_OUTFIT', {});
  };

  // 4. Save Current Look to Lookbook
  const handleSaveLookbook = async (): Promise<SaveLookbookResult> => {
    if (!look) return { status: 'failed', message: 'Chưa tải bộ phối' };
    if (isMutatingRef.current) {
      console.warn('Đang có thao tác đang xử lý, bỏ qua lưu trùng.');
      return { status: 'busy', message: 'Hệ thống đang xử lý thao tác khác, vui lòng thử lại sau.' };
    }
    isMutatingRef.current = true;
    setIsBusy(true);
    const newItem: LookbookItem = {
      id: `lookbook_${Date.now()}`,
      title: `${look.title} (v${look.revision})`,
      lookId: look.id,
      revision: look.revision,
      snapshotConfig: JSON.parse(JSON.stringify(look.config)),
      eventId: look.eventId,
      styleId: look.styleId,
      notes: look.explanation,
      createdAt: new Date().toISOString(),
    };

    try {
      await saveToLookbook(newItem);
      let refetched = true;
      try {
        const updated = await fetchLookbook();
        setLookbookItems(updated);
      } catch (refetchErr: any) {
        console.error('Refetch lookbook error:', refetchErr);
        refetched = false;
      }
      return {
        status: 'saved',
        message: refetched
          ? 'Đã lưu thành công bộ phối vào Lookbook!'
          : 'Đã lưu, chưa làm mới được danh sách',
        item: newItem,
        refetched,
      };
    } catch (err: any) {
      console.error('Save lookbook error:', err);
      return {
        status: 'failed',
        message: err.message || 'Lỗi lưu Lookbook',
      };
    } finally {
      isMutatingRef.current = false;
      setIsBusy(false);
    }
  };

  // 5. Ask AI with Command Execution Loop & strict sequential failure reporting
  const handleAskAI = async (message: string, history: Array<{ role: 'user' | 'assistant'; content: string }>) => {
    if (!look) throw new Error('Chưa tải bộ phối');

    // Phase 1: Wait for model response WITHOUT locking UI. User can still interact.
    const res = await sendAIChat(look.id, message, history);

    let commandsStatus: 'none' | 'planned' | 'all_applied' | 'partially_applied' | 'failed' = 'none';
    let finalReply = res.reply;

    if (res.commands && res.commands.length > 0) {
      commandsStatus = 'planned';
      const totalCmds = res.commands.length;
      let appliedCount = 0;
      let failureReason = '';

      // Phase 2: Sequential execution under shared mutation guard
      if (isMutatingRef.current) {
        return {
          reply: `[Không thể áp dụng lệnh AI]: Hệ thống đang xử lý thao tác phối đồ khác. Vui lòng thử lại sau.\n\n*Đề xuất từ AI:* ${res.reply}`,
          explanation: res.explanation,
          citations: res.citations,
          mode: res.mode,
          model: res.model,
          commandsStatus: 'failed',
        };
      }

      isMutatingRef.current = true;
      setIsBusy(true);

      try {
        for (let i = 0; i < totalCmds; i++) {
          const cmd = res.commands[i];
          try {
            // DO NOT alter cmd.expectedRevision. Keep exact planned revision from server.
            // If user edited during model wait, backend will return 409 REVISION_CONFLICT.
            const cmdRes = await sendCommand(cmd);
            updateLookSafe(cmdRes.look);
            appliedCount++;
          } catch (err: any) {
            console.error(`AI plan command ${i + 1}/${totalCmds} failed:`, err);
            failureReason = err.message || 'Lỗi thực thi lệnh';
            if (err.status === 409) {
              const freshLook = await fetchLook(look.id);
              updateLookSafe(freshLook);
              if (err.code === 'REVISION_CONFLICT') {
                failureReason = 'Bộ phối đã được chỉnh sửa trong lúc chờ AI phản hồi';
              }
            }
            break; // Stop execution on first failure
          }
        }
      } finally {
        isMutatingRef.current = false;
        setIsBusy(false);
      }

      if (appliedCount === totalCmds) {
        commandsStatus = 'all_applied';
        finalReply = `[Thực thi: Đã áp dụng toàn bộ ${totalCmds}/${totalCmds} lệnh] ${res.reply}`;
      } else if (appliedCount === 0) {
        commandsStatus = 'failed';
        finalReply = `[Thực thi thất bại: Không thể áp dụng thay đổi từ AI (${failureReason})]\n\n*Đề xuất ban đầu từ AI:* ${res.reply}`;
      } else {
        commandsStatus = 'partially_applied';
        finalReply = `[Thực thi một phần: Chỉ áp dụng thành công ${appliedCount}/${totalCmds} lệnh (${failureReason})]\n\n*Đề xuất ban đầu từ AI:* ${res.reply}`;
      }
    }

    return {
      reply: finalReply,
      explanation: res.explanation,
      citations: res.citations,
      mode: res.mode,
      model: res.model,
      commandsStatus,
    };
  };

  // 6. Delete Lookbook item
  const handleDeleteLookbookItem = async (id: string) => {
    if (!window.confirm('Bạn có chắc muốn xóa bộ phối này khỏi Lookbook?')) return;
    try {
      await deleteFromLookbook(id);
      setLookbookItems((prev) => prev.filter((x) => x.id !== id));
    } catch (err: any) {
      alert(`Lỗi khi xóa mục Lookbook: ${err.message}`);
    }
  };

  // 7. Open Compare Modal for two presets or looks
  const handleOpenStudioCompare = () => {
    if (!look || !meta || !meta.presets) return;
    const altPreset = meta.presets.find((p: any) => p.id !== look.id) || meta.presets[1] || meta.presets[0];
    setCompareData({
      lookA: { title: `${look.title} (Hiện tại)`, config: look.config },
      lookB: { title: `${altPreset.title} (Gợi ý đối sánh)`, config: altPreset.config },
    });
  };

  const handleCompareLookbookItems = (itemA: LookbookItem, itemB: LookbookItem) => {
    setCompareData({
      lookA: { title: itemA.title, config: itemA.snapshotConfig },
      lookB: { title: itemB.title, config: itemB.snapshotConfig },
    });
  };

  if (loadError) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
        <h2 style={{ color: 'var(--accent-red)', marginBottom: '1rem' }}>Không thể khởi động Dáng Việt</h2>
        <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>{loadError}</p>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Hãy kiểm tra xem máy chủ backend API (port 3088) đã được chạy chưa bằng lệnh: <br />
          <code>npm run dev:server</code> hoặc <code>npm run setup</code>
        </p>
      </div>
    );
  }

  if (isLoading || !look || !meta) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '1rem' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid var(--border-medium)', borderTopColor: 'var(--accent-red)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <p style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Đang khởi tạo không gian Dáng Việt...</p>
      </div>
    );
  }

  return (
    <div className="app-container">
      <Navbar currentTab={currentTab} onSelectTab={setCurrentTab} aiStatus={aiStatus} />

      {bannerMessage && (
        <div
          style={{
            maxWidth: '1200px',
            margin: '0.75rem auto 0 auto',
            padding: '0.65rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            background: bannerMessage.type === 'success' ? '#E8F5E9' : bannerMessage.type === 'info' ? '#E1F5FE' : '#FFEBEE',
            color: bannerMessage.type === 'success' ? '#2E7D32' : bannerMessage.type === 'info' ? '#0277BD' : '#C62828',
            border: `1px solid ${bannerMessage.type === 'success' ? '#A5D6A7' : bannerMessage.type === 'info' ? '#81D4FA' : '#FFCDD2'}`,
            fontSize: '0.86rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: 'var(--shadow-sm)',
            zIndex: 99,
          }}
        >
          <span>{bannerMessage.text}</span>
          <button
            onClick={() => setBannerMessage(null)}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem', color: 'inherit' }}
          >
            ✕
          </button>
        </div>
      )}

      <main style={{ flex: 1 }}>
        {currentTab === 'explore' && (
          <ExploreSection
            events={meta.events}
            presets={meta.presets}
            cultureCards={cultureCards}
            onSelectEvent={(eventId) => {
              setCurrentTab('studio');
              handleDispatchCommand('SET_EVENT', { eventId });
            }}
            onApplyPreset={(preset) => {
              setCurrentTab('studio');
              handleDispatchCommand('APPLY_PRESET', {
                config: preset.config,
                title: preset.title,
                explanation: preset.explanation,
              });
            }}
          />
        )}

        {currentTab === 'studio' && (
          <OutfitRoom
            look={look}
            events={meta.events}
            styles={meta.styles}
            colors={meta.colors}
            catalog={meta.catalog}
            cultureCards={cultureCards}
            onDispatchCommand={handleDispatchCommand}
            onUndo={handleUndo}
            onReset={handleReset}
            onSaveLookbook={handleSaveLookbook}
            onOpenCompare={handleOpenStudioCompare}
            onAskAI={handleAskAI}
            isLoading={false}
            isBusy={isBusy}
            viewingDesignTitle={viewingDesignTitle}
          />
        )}

        {currentTab === 'design' && (
          <DesignStudio
            currentLook={look}
            events={meta.events}
            styles={meta.styles}
            onRequestProposal={async (prompt, eventId, styleId, history, activeProposalConfig) => {
              return requestDesignProposal({
                targetLookId: look.id,
                prompt,
                eventId: eventId as any,
                styleId: styleId as any,
                expectedRevision: look.revision,
                history,
                activeProposalConfig,
              });
            }}
            onApplyProposal={async (proposal, eventId, styleId) => {
              // 1. Client-side/Server-side validate proposal
              const validation = await validateDesignProposalApi(proposal);
              if (!validation.valid) {
                return { success: false, error: validation.errors.join('; ') };
              }

              // 2. Dispatch atomic command
              const res = await handleDispatchCommand('APPLY_DESIGN', {
                config: proposal.proposedConfig,
                title: proposal.title,
                explanation: proposal.explanation,
                eventId: eventId as any,
                styleId: styleId as any,
              });

              if (res.success) {
                setCurrentTab('studio');
                return { success: true };
              } else {
                return { success: false, error: res.error || 'Lỗi khi áp dụng thiết kế' };
              }
            }}
            onSaveDesignToLookbook={async (title, config, explanation, eventId, styleId) => {
              const newItem: LookbookItem = {
                id: `lookbook_design_${Date.now()}`,
                title,
                lookId: look.id,
                revision: look.revision,
                snapshotConfig: config,
                eventId: (eventId || look.eventId) as any,
                styleId: (styleId || look.styleId) as any,
                notes: explanation,
                createdAt: new Date().toISOString(),
              };
              await saveToLookbook(newItem);
              try {
                const updated = await fetchLookbook();
                setLookbookItems(updated);
              } catch (refetchErr) {
                console.error('Refetch lookbook failed:', refetchErr);
                throw new Error('Đã lưu thiết kế vào cơ sở dữ liệu nhưng chưa thể làm mới danh sách Lookbook');
              }
            }}
            onApplyToStudio={(config, title, explanation, eventId, styleId) => {
              setCurrentTab('studio');
              handleDispatchCommand('APPLY_DESIGN', {
                config,
                title,
                explanation,
                eventId: eventId as any,
                styleId: styleId as any,
              });
            }}
          />
        )}

        {currentTab === 'lookbook' && (
          <LookbookSection
            lookbookItems={lookbookItems}
            onOpenInStudio={(item) => {
              setCurrentTab('studio');
              const preservedLocks: string[] = [];
              if (look.locks.primaryColor && look.config.primaryColor.hex !== item.snapshotConfig.primaryColor.hex) preservedLocks.push('Màu áo');
              if (look.locks.pantsColor && look.config.pantsColor.hex !== item.snapshotConfig.pantsColor.hex) preservedLocks.push('Màu quần');
              if (look.locks.collarStyle && look.config.collarStyle !== item.snapshotConfig.collarStyle) preservedLocks.push('Cổ áo');
              if (look.locks.sleeveStyle && look.config.sleeveStyle !== item.snapshotConfig.sleeveStyle) preservedLocks.push('Tay áo');
              if (look.locks.fabric && look.config.fabric !== item.snapshotConfig.fabric) preservedLocks.push('Chất liệu');
              if (look.locks.pattern && look.config.pattern !== item.snapshotConfig.pattern) preservedLocks.push('Họa tiết');
              if (look.locks.accessories) preservedLocks.push('Phụ kiện');
              if (look.locks.bodyShape && look.config.bodyShape !== item.snapshotConfig.bodyShape) preservedLocks.push('Vóc dáng');
              if (look.locks.modelId && look.config.modelId !== item.snapshotConfig.modelId) preservedLocks.push('Mẫu áo');

              if (preservedLocks.length > 0) {
                setBannerMessage({
                  text: `Mở bản phối '${item.title}': Đang bảo lưu các thuộc tính bị khóa (${preservedLocks.join(', ')}).`,
                  type: 'info',
                });
              } else {
                setBannerMessage({
                  text: `Đã mở bản phối '${item.title}' vào phòng phối đồ.`,
                  type: 'success',
                });
              }

              handleDispatchCommand('APPLY_DESIGN', {
                config: item.snapshotConfig,
                title: item.title,
                explanation: item.notes,
                eventId: item.eventId,
                styleId: item.styleId,
              });
            }}
            onDeleteItem={handleDeleteLookbookItem}
            onCompareTwo={handleCompareLookbookItems}
          />
        )}
      </main>

      {/* Side-by-side Comparison Modal */}
      {compareData && (
        <CompareModal
          lookA={compareData.lookA}
          lookB={compareData.lookB}
          onClose={() => setCompareData(null)}
        />
      )}
    </div>
  );
};
